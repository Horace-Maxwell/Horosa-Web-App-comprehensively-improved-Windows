// 三式合一页 · 重算调度:按农历整盘重算、等待与收尾、AI 快照保存与刷新
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { saveModuleAISnapshot, clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { castSourceKey, castFailureKeeps } from '../../../utils/derivedChartSource';
import { castIsDiurnal } from '../../../utils/castDiurnal';
import { needJieqiYearSeed, jieqiSeedYears, jieqiSeedSignature } from '../../dunjia/DunJiaCalc';
import { getNongliLocalCache, setNongliLocalCache } from '../../../utils/localCalcCache';
import { fetchPreciseNongli } from '../../../utils/preciseCalcBridge';
import { normalizeTaiyiSchool } from '../../taiyi/core/taiyiSchool';
import { buildLiuRengReferenceBundle } from '../../lrzhan/LiuRengMain';
import { safe, getNongliKey } from '../../dunjia/qimenPageShared';
import { SANSHI_FAST_BUDGET_MS, SANSHI_CAST_CHART_WAIT_MS, SANSHI_RECALC_HELD, SANSHI_RECALC_DEFER_MS, SANSHI_SNAPSHOT_DEFER_MS } from './options';
import { normalizeTimeAlg, timeoutResolve, getFieldKey, getQimenOptionsKey, getChartYue, getOuterChartKey } from './format';
import { pickSanshiLiurengCastOpts, buildSanshiLiuRengCastOverride, buildLiuRengLayout, buildLrNongli, buildKeData, buildSanChuan } from './liureng';
import { buildOuterData } from './outerRing';
import { buildSanShiUnitedSnapshotText } from './snapshot';
import { markPanelReady } from '../../../utils/perfMark';

export const recalcMethods = {
	// 结掉队列里此刻全部的调用方(取消 / 卸载用);某一次重算只结它自己开跑时取走的那一批(settleRecalcResolvers)
	resolvePendingRecalc(result){
		const resolvers = (this.pendingRecalcResolvers || []).slice();
		this.pendingRecalcResolvers = [];
		this.settleRecalcResolvers(resolvers, result);
	},

	// 只结给定这一批调用方。一次重算在定时器触发、开跑那一刻把队列取走,回包后只结这一批:被作废的旧那次(回包为 false)
	// 不得把开跑之后才入队、属于后发那次的调用方一起定成 false —— 否则后发那次还在途,调用方就收起加载态、放行排队的起盘补发
	settleRecalcResolvers(list, result){
		const resolvers = Array.isArray(list) ? list : [];
		if(resolvers.length === 0){
			return;
		}
		resolvers.forEach((fn)=>{
			try{
				fn(result);
			}catch(e){
				return;
			}
		});
		// [连续进退不丢击] 重算落地 → 期间被队列化的起盘请求经 trailing 静默期补发:
		// 距最后一击 <180ms 说明用户还在连点,推迟再查——连点期间不起中间轮
		// (旧「resolve 即补」= 每 ~600ms 一轮全算,6 连击串行 3-4 轮;现=停手后一轮定稿)。
		// loading 已随 commitPatch 同帧清掉;若又有新一轮在途则本次跳过,由那一轮 resolve 接力。
		if(this.queuedPlotWhileLoading){
			const tryFlush = ()=>{
				if(this.unmounted || !this.queuedPlotWhileLoading){
					return;
				}
				if(this.state.loading){
					return;
				}
				const nowTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
				if(this.lastQueuedPlotAt && nowTs - this.lastQueuedPlotAt < 180){
					setTimeout(tryFlush, 120);
					return;
				}
				this.queuedPlotWhileLoading = false;
				this.clickPlot();
			};
			setTimeout(tryFlush, 0);
		}
	},

	cancelPendingRecalc(result = false){
		if(this.pendingRecalcTimer){
			clearTimeout(this.pendingRecalcTimer);
			this.pendingRecalcTimer = null;
		}
		this.pendingRecalcPayload = null;
		this.resolvePendingRecalc(result);
	},

	scheduleSnapshotSave(snapshotPayload, snapshotMeta){
		// 留底最近一次 payload/meta:紫微四化 tab 的盘经异步归来时(上报点
		// handleZiweiSihuaSnapshotState)据此换键补拍——重算路径按值捕获,四化后到不补则挂载恒缺段。
		this._lastSnapshotPayload = snapshotPayload;
		this._lastSnapshotMeta = snapshotMeta;
		if(this.pendingSnapshotTimer){
			clearTimeout(this.pendingSnapshotTimer);
			this.pendingSnapshotTimer = null;
		}
		if(this.pendingSnapshotIdle && typeof cancelIdleCallback === 'function'){
			cancelIdleCallback(this.pendingSnapshotIdle);
			this.pendingSnapshotIdle = null;
		}
		// [连击不被快照顶住](horosa_sanshi_snapshot_idle_v1)buildSanShiUnitedSnapshotText 是
		// 三盘全家文本化的同步大构建(实测 ~950ms 长任务)。原 setTimeout(120) 让它恰好插进
		// 「上一步落地 → 下一步 recalc 28ms timer」之间,把下一步顶住近一秒——连续进退
		// 「每步都慢」的隐藏大头。改 requestIdleCallback:主线程空闲才构建,连击期间被上面的
		// cancel 逐次作废(latest-wins,只有停手后最后一份真跑);timeout 兜底保「AI 挂载最新」。
		const buildAndSave = ()=>{
			this.pendingSnapshotIdle = null;
			this.pendingSnapshotTimer = null;
			if(this.unmounted){
				return;
			}
			let snapshotText = buildSanShiUnitedSnapshotText(snapshotPayload);
			if(!snapshotText){
				return;
			}
			// 择日宿主 scope 化:独立快照槽+composeAiSnapshot 拼接择时三段(主页零影响)
			if(typeof this.props.composeAiSnapshot === 'function'){
				try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
			}
			saveModuleAISnapshot(this.props.techniqueScope || 'sanshiunited', snapshotText, snapshotMeta);
		};
		if(typeof requestIdleCallback === 'function'){
			this.pendingSnapshotIdle = requestIdleCallback(buildAndSave, { timeout: 4000 });
		}else{
			this.pendingSnapshotTimer = setTimeout(buildAndSave, SANSHI_SNAPSHOT_DEFER_MS);
		}
	},

	// 紫微四化 tab(SanShiZiWeiSihua)上报其盘与大运/流年选中态——落实例字段,
	// 供快照三条路径(重算 scheduleSnapshotSave/存档 clickSave/导出刷新 handleSnapshotRefreshRequest)payload 带上。
	handleZiweiSihuaSnapshotState(payload){
		this.ziweiSihuaSnapshotInput = payload || null;
		// 四化上报实变即补拍(子组件已同值去重,此处必为实变):重算路径的
		// snapshotPayload 按值捕获,四化盘异步归来若只落实例字段不重存,挂载快照恒缺
		// [紫微四化] 段——而导出刷新路径实时读实例字段反而有,两路径不同构。
		if(payload && this._lastSnapshotPayload){
			this.scheduleSnapshotSave({ ...this._lastSnapshotPayload, ziweiSihua: payload }, this._lastSnapshotMeta);
		}
	},

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== (this.props.techniqueScope || 'sanshiunited')){
			return;
		}
		// 导出刷新必须与左侧当前“已起盘”展示保持一致，优先使用 plottedFields。
		const fields = this.state.hasPlotted
			? (this.state.plottedFields || this.state.localFields || this.props.fields)
			: this.getActiveFields();
		const chartWrap = this.state.castChart;
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const outerData = this.currentOuterData(astroChart);
		const lrSnapInput = this.state.liurengSnapshotInput || {};
		const snapshotPayload = {
			fields,
			options: this.state.options || {},
			nongli: this.state.nongli,
			displaySolarTime: this.state.displaySolarTime,
			liureng: this.state.liureng,
			dunjia: this.state.dunjia,
			taiyi: this.state.taiyi,
			keData: this.state.keData,
			sanChuan: this.state.sanChuan,
			lrLayout: this.state.lrLayout,
			liurengRefBundle: this.state.liurengRefBundle,
			outerData,
			guirengType: lrSnapInput.guirengType,
			liurengChartForLr: lrSnapInput.chartForLr,
			lrCastOverride: lrSnapInput.lrCastOverride,
			lrCastOpts: lrSnapInput.lrCastOpts,
			liurengRunYear: lrSnapInput.runYearRef,
			ziweiSihua: this.ziweiSihuaSnapshotInput || null,
		};
		let snapshotText = buildSanShiUnitedSnapshotText(snapshotPayload);
		if(!snapshotText){
			return;
		}
		const snapshotMeta = {
			date: fields && fields.date ? fields.date.value.format('YYYY-MM-DD') : '',
			time: fields && fields.time ? fields.time.value.format('HH:mm:ss') : '',
			zone: fields && fields.zone ? fields.zone.value : '',
			lon: fields && fields.lon ? fields.lon.value : '',
			lat: fields && fields.lat ? fields.lat.value : '',
		};
		if(typeof this.props.composeAiSnapshot === 'function'){
			try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		saveModuleAISnapshot(this.props.techniqueScope || 'sanshiunited', snapshotText, snapshotMeta);
		if(evt && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	},

	recalcByNongli(fields, nongli, overrideOptions, displaySolarTime, commitPatch){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return Promise.resolve(false);
		}
		// commitPatch:调用方要与盘结果【同帧】提交的 state 补丁(loading:false/
		// displaySolarTime)。防抖窗内 payload 被覆盖时合并保留旧补丁(refined/seed 补算不带补丁,
		// 不得把主链的 loading:false 冲掉)。(v3.7.1 收敛注:取代我方 S5 提交期内折形态 —— 同一
		// 消闪帧目标,上游穿线形对防抖窗覆盖更精确,#49 换形。)
		this.pendingRecalcPayload = {
			fields: flds,
			nongli,
			overrideOptions,
			displaySolarTime,
			commitPatch: {
				...(this.pendingRecalcPayload && this.pendingRecalcPayload.commitPatch),
				...commitPatch,
			},
		};
		if(this.pendingRecalcTimer){
			clearTimeout(this.pendingRecalcTimer);
			this.pendingRecalcTimer = null;
		}
		return new Promise((resolve)=>{
			this.pendingRecalcResolvers.push(resolve);
			this.pendingRecalcTimer = setTimeout(()=>{
				this.pendingRecalcTimer = null;
				if(this.unmounted){
					this.cancelPendingRecalc(false);
					return;
				}
				const payload = this.pendingRecalcPayload;
				this.pendingRecalcPayload = null;
				// 这一次运行的调用方 = 此刻队列里的全部(防抖合并进来的都按这一次的结果);之后入队的留给下一次
				const mine = this.pendingRecalcResolvers.splice(0);
					if(!payload){
						this.settleRecalcResolvers(mine, false);
						return;
					}
					try{
						this.lastRecalcError = null;
						Promise.resolve(this.performRecalcByNongli(
							payload.fields,
							payload.nongli,
							payload.overrideOptions,
							payload.displaySolarTime,
							payload.commitPatch
						)).then((changed)=>{
							this.settleRecalcResolvers(mine, changed);
						}).catch((e)=>{
							this.lastRecalcError = e;
							if(!this.unmounted){
								this.setState({ loading: false });
								console.error('[SanShiUnited] performRecalcByNongli failed', e);
							}
							this.settleRecalcResolvers(mine, false);
						});
					}catch(e){
						this.lastRecalcError = e;
						if(!this.unmounted){
							this.setState({ loading: false });
							console.error('[SanShiUnited] performRecalcByNongli failed', e);
						}
						this.settleRecalcResolvers(mine, false);
					}
				}, SANSHI_RECALC_DEFER_MS);
			});
		},

	async performRecalcByNongli(fields, nongli, overrideOptions, displaySolarTime, commitPatch){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return false;
		}
		// 只认最后一次开始的重算(防抖只合并还没开始的那次;已在途的奇门 / 太乙后端取盘先发后回会盖掉后发)。
		// 取号在签名去重之前:去重命中说明屏上就是最新意图,在途的旧那次回来也不得再落屏。
		const seq = ++this._recalcSeq;
		const stateOptions = this.state.options || {};
		// 合并 state + override 为单一真值源(签名/缓存键/各子盘计算同源,避免漂移)。
		const mergedOptions = {
			...stateOptions,
			...(overrideOptions || {}),
		};
		const guirengType = mergedOptions.guireng;
		const qimenOptions = this.getQimenOptions(overrideOptions);
		// 参照盘只认与这一课同一起课时刻地点的那张。手上的参照盘是别的时刻的(主盘 / 宿主底盘还在途):这一课先不落 ——
		// 屏上仍是上一课的整套(更新中),这一刻的参照盘到了(componentDidUpdate → refreshAll)再落;等不到(取失败)
		// 就按「没有参照盘」落(月将 / 外圈留空、昼夜本地算),绝不拿上一刻的底盘定这一课
		const chartWrap = this.castChartOf(flds);
		const castKey = castSourceKey(flds);
		if(!chartWrap && castSourceKey(this.props.chartObj || this.props.chart || null) && this._castChartGaveUp !== castKey){
			this.armCastChartWait(flds);
			if(!this.state.loading){ this.setState({ loading: true }); }
			return SANSHI_RECALC_HELD;
		}
		const isDiurnal = castIsDiurnal(chartWrap, flds);
		const outerChartKey = getOuterChartKey(chartWrap);
		// 大六壬流派覆盖(换将/分昼夜/涉害/昼夜阳阴);默认全 default → null(零回归,与原本固定月将一致)。
		const lrCastOverride = chartWrap && chartWrap.chart ? buildSanshiLiuRengCastOverride({
			...chartWrap.chart,
			nongli: nongli,
		}, mergedOptions) : null;
		const lrCastKey = lrCastOverride ? [
			safe(lrCastOverride.yue),
			`${safe(lrCastOverride.isDiurnal, '')}`,
			safe(lrCastOverride.yinyangSystem),
			lrCastOverride.seHaiOpts ? `${safe(lrCastOverride.seHaiOpts.method)}-${safe(lrCastOverride.seHaiOpts.boundary)}-${lrCastOverride.seHaiOpts.shiRuKe ? 1 : 0}` : '',
		].join('~') : '';
		const recalcSignature = [
			getFieldKey(flds),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${guirengType}`,
			`${safe(mergedOptions.taiyiStyle)}`,
			`${safe(mergedOptions.taiyiAccum)}`,
			`${safe(mergedOptions.gameTheory)}`,
			mergedOptions.taiyiSchool ? JSON.stringify(normalizeTaiyiSchool(mergedOptions.taiyiSchool)) : '',
			`${safe(mergedOptions.taiyiTimeBasis)}`,   // 曾漏:改太乙时间基准签名不变 → 去重直接不重算
			lrCastKey,
			`${safe(mergedOptions.yearShenShaSort)}`,
			`${safe(mergedOptions.tuWangShuai)}`,
			`${safe(mergedOptions.after23NewDay)}`,
			`${safe(mergedOptions.lateZiHourUseNextDay)}`,
			`${safe(normalizeTimeAlg(mergedOptions.timeAlg))}`,
			safe(flds && flds.zodiacal && flds.zodiacal.value),
			safe(flds && flds.hsys && flds.hsys.value),
			`${safe(isDiurnal, '')}`,
			outerChartKey,
			`${this.state.outerCoord || 'ecliptic'}`,   // 外圈坐标进签名:否则切了坐标再起盘被去重拦下
			`${this.outerCoordCacheKey()}`,   // 赤道分宫另带上升取法(切了取法再起盘同样不被去重拦下)
			jieqiSeedSignature(this.jieqiYearSeeds),   // 种子到达后签名变 → 去重不吞掉带种子的重算
		].join('|');
		if(this.state.dunjia && recalcSignature === this.lastRecalcSignature){
			return false;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		// 奇门(getKinqimenDunJia)与太乙(getKintaiyiPan)两后端取盘相互独立(太乙仅吃 flds/nongli/mergedOptions,
		// 不依赖奇门结果),原为串行 await(网络往返叠加)。改并行:先各自起 promise,再 Promise.all 等齐;
		// 太乙命中本地缓存则不发请求(promise=已解析的缓存值),仅缓存未命中才真并发。结果/快照 byte-perfect 不变。
		const taiyiCacheKey = [
			getFieldKey(flds),
			getNongliKey(nongli),
			`${safe(mergedOptions.taiyiStyle)}`,
			`${safe(mergedOptions.taiyiAccum)}`,
			`${safe(mergedOptions.sex)}`,
			`${safe(mergedOptions.gameTheory)}`,
			mergedOptions.taiyiSchool ? JSON.stringify(normalizeTaiyiSchool(mergedOptions.taiyiSchool)) : '',
			// getKintaiyiPan 读的键须全入(时间基准曾漏 → 切「真太阳时」命中旧盘;换日两项同理补齐)
			`${safe(mergedOptions.taiyiTimeBasis)}`,
			`${safe(mergedOptions.after23NewDay)}`,
			`${safe(mergedOptions.lateZiHourUseNextDay)}`,
		].join('|');
		const taiyiCached = this.taiyiCache.get(taiyiCacheKey);
		const dunjiaPromise = this.getKinqimenDunJia(
			flds,
			nongli,
			qimenOptions,
			year,
			isDiurnal,
			displaySolarTime || this.state.displaySolarTime
		);
		const taiyiPromise = taiyiCached
			? Promise.resolve(taiyiCached)
			: this.getKintaiyiPan(flds, nongli, mergedOptions);
		const [dunjia, taiyiResolved] = await Promise.all([dunjiaPromise, taiyiPromise]);
		if(this.unmounted || seq !== this._recalcSeq){
			return false;
		}
		// 太乙缓存未命中 → 落缓存(LRU 上限 48);命中则 taiyiResolved===缓存值,无需重写。
		const taiyi = taiyiResolved;
		if(!taiyiCached){
			this.taiyiCache.set(taiyiCacheKey, taiyi);
			if(this.taiyiCache.size > 48){
				const firstKey = this.taiyiCache.keys().next().value;
				if(firstKey){
					this.taiyiCache.delete(firstKey);
				}
			}
		}
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const lrNongli = buildLrNongli(nongli, dunjia);
		const nianMing = safe(lrNongli && lrNongli.runyear, '')
			|| ((dunjia && dunjia.ganzhi && dunjia.ganzhi.year) ? dunjia.ganzhi.year.substring(1, 2) : '');
		const chartForLr = astroChart ? {
			...astroChart,
			nongli: lrNongli,
		} : null;
		const lrCacheKey = [
			getChartYue(astroChart),
			safe(lrNongli.dayGanZi),
			safe(lrNongli.time),
			`${guirengType}`,
			// 昼夜:缺省「晨昏分昼夜」时覆盖为 null、lrCastKey 不含昼夜,而贵人取昼/夜贵读 chartObj.isDiurnal →
			// 同一时辰内跨日出/日没命中旧缓存,十二天将整环沿用旧昼夜(重算签名含昼夜会重算,六壬层却命中旧包)。
			`${safe(chartForLr && chartForLr.isDiurnal, '')}`,
			lrCastKey,
		].join('|');
		let lrBundle = this.lrBundleCache[lrCacheKey];
		if(!lrBundle){
			const lrLayout = buildLiuRengLayout(chartForLr, guirengType, lrCastOverride);
			const keData = buildKeData(lrLayout, chartForLr);
			const sanChuan = buildSanChuan(lrLayout, keData.raw, chartForLr, lrCastOverride);
			lrBundle = {
				lrLayout,
				keData,
				sanChuan,
				yue: lrLayout ? lrLayout.yue : '',
				timezi: lrLayout ? lrLayout.timezi : '',
				guizi: lrLayout ? lrLayout.guizi : '',
			};
			this.lrBundleCache[lrCacheKey] = lrBundle;
			const cacheKeys = Object.keys(this.lrBundleCache);
			if(cacheKeys.length > 36){
				delete this.lrBundleCache[cacheKeys[0]];
			}
		}
		const liureng = {
			nongli: lrNongli,
			nianMing: nianMing,
			yue: lrBundle.yue,
			timezi: lrBundle.timezi,
			guizi: lrBundle.guizi,
			fourColumns: {
				year: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.year || '') : '',
				month: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.month || '') : '',
				day: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '',
				time: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '',
			},
		};
		let liurengRefBundle = null;
		const runYearRef = lrNongli && lrNongli.runyear ? { year: lrNongli.runyear } : null;
		try{
			liurengRefBundle = buildLiuRengReferenceBundle(liureng, chartForLr, guirengType, runYearRef, lrCastOverride);
		}catch(e){
			liurengRefBundle = null;
		}
		// 六壬断卦层快照入参(供 buildSanShiUnitedSnapshotText 复用独立 buildLiuRengSnapshotText);
		// 随快照各路径(recalc/存档/还原)同源传递,故落 state 让 state 派生的两处 payload 也带得上。
		const liurengSnapshotInput = {
			guirengType,
			chartForLr,
			lrCastOverride,
			// 断卦层要的是 castOpts 形态(yueJiangMethod/fenZhouYe/涉害/年神/土旺/占类…),override 对象另带;
			// 此前把 lrCastOverride 当第 8 参 castOpts 传 → 键名全不匹配 → 12 个断卦段按默认盘重算。
			lrCastOpts: pickSanshiLiurengCastOpts(mergedOptions, lrNongli),
			runYearRef,
		};
		// 太乙 taiyi 已在 dunjia 前并行取得并落缓存(见上方 Promise.all)。
		let outerData = this.outerDataCache.data;
		const outerCoordKey = this.outerCoordCacheKey();
		if(this.outerDataCache.chartKey !== outerChartKey || this.outerDataCache.coord !== outerCoordKey){
			outerData = buildOuterData(astroChart, this.state.outerCoord, this.state.ascRaMode);
			this.outerDataCache = {
				chartKey: outerChartKey,
				coord: outerCoordKey,
				data: outerData,
			};
		}
			const snapshotPayload = {
				fields: flds,
				options: mergedOptions,
				nongli,
				displaySolarTime: this.state.displaySolarTime,
				liureng,
				dunjia,
				taiyi,
				liurengRefBundle,
			keData: lrBundle.keData,
			sanChuan: lrBundle.sanChuan,
			lrLayout: lrBundle.lrLayout,
			outerData,
			guirengType: liurengSnapshotInput.guirengType,
			liurengChartForLr: liurengSnapshotInput.chartForLr,
			lrCastOverride: liurengSnapshotInput.lrCastOverride,
			lrCastOpts: liurengSnapshotInput.lrCastOpts,
			liurengRunYear: liurengSnapshotInput.runYearRef,
			ziweiSihua: this.ziweiSihuaSnapshotInput || null,
		};
		const snapshotMeta = {
			date: flds && flds.date ? flds.date.value.format('YYYY-MM-DD') : '',
			time: flds && flds.time ? flds.time.value.format('HH:mm:ss') : '',
			zone: flds && flds.zone ? flds.zone.value : '',
			lon: flds && flds.lon ? flds.lon.value : '',
			lat: flds && flds.lat ? flds.lat.value : '',
		};
		this.lastRecalcSignature = recalcSignature;
		this.clearCastChartWait();
		// 双提交合一:盘结果与调用方补丁(loading:false/displaySolarTime)同一次
		// setState 落地 —— 旧形态先渲「新盘 + loading 还挂着」一帧再渲去转圈一帧,肉眼即闪帧。
		// (horosa_sanshi_render_slice_v1 S5 收敛注:同目标,提交期内折形态换上游 commitPatch
		//  穿线形 #49;refreshAll 尾部兜底现按 !changed 门控,常态零第二次提交。)
		this.setState({
			nongli,
			liureng,
			dunjia,
			taiyi,
			castChart: chartWrap,
			lessonSig: castKey,
			liurengRefBundle,
			liurengSnapshotInput,
			lrLayout: lrBundle.lrLayout,
			keData: lrBundle.keData,
			sanChuan: lrBundle.sanChuan,
			...(commitPatch || null),
		}, ()=>{
			// horosa_panel_ready_v1:三式合一的中栏(六壬/遁甲/太乙三盘)与右栏 5 页签全部派生自本次
			// setState 的这一组字段,故这里 = 「中栏+右栏画完」。本行已在 recalcByNongli 的
			// SANSHI_RECALC_DEFER_MS 去抖与 refreshSeq 竞态守卫【之后】(陈旧轮次在上游即已 return),
			// 故不会给作废的那一轮记点;markPanelReady 自身另有 generation 去重兜底。
			markPanelReady('sanshiunited');
			this.scheduleSnapshotSave(snapshotPayload, snapshotMeta);
		});
		return true;
	},

	// 起课取失败:与屏上那一课同一起课时刻地点(只改了设置)→ 留存;换了时刻 / 地点 → 屏上那一课是上一课,
	// 清掉(连同本页 AI 快照槽),不让上一课顶着新时刻显示 / 交给 AI
	settleCastFailure(fields){
		if(castFailureKeeps(this.state.lessonSig, castSourceKey(fields))){
			this.setState({ loading: false });
			return;
		}
		this.clearCastChartWait();
		this.lastRecalcSignature = '';
		this._lastSnapshotPayload = null;
		this.setState({
			loading: false, nongli: null, liureng: null, dunjia: null, taiyi: null, castChart: null, lessonSig: '',
			liurengRefBundle: null, liurengSnapshotInput: null, lrLayout: null, keData: null, sanChuan: null,
		});
		clearModuleAISnapshot(this.props.techniqueScope || 'sanshiunited');
	},

	// 等这一刻的参照盘:到了由 componentDidUpdate 照常 refreshAll;超时就按「没有参照盘」落这一课
	armCastChartWait(flds){
		const key = castSourceKey(flds);
		if(this._castChartWait && this._castChartWait.key === key){ return; }
		this.clearCastChartWait();
		const timer = setTimeout(()=>{
			if(this.unmounted || !this._castChartWait || this._castChartWait.key !== key){ return; }
			this._castChartWait = null;
			const cur = this.state.plottedFields || this.state.localFields || this.props.fields;
			if(castSourceKey(cur) !== key){ return; }
			this._castChartGaveUp = key;
			this.refreshAll(cur, true);
		}, SANSHI_CAST_CHART_WAIT_MS);
		this._castChartWait = { key, timer };
	},

	clearCastChartWait(){
		if(this._castChartWait){
			clearTimeout(this._castChartWait.timer);
			this._castChartWait = null;
		}
	},

	async refreshAll(fields, force){
		if(!fields){
			return;
		}
		const stateOptions = this.state.options || {};
		const key = `${getFieldKey(fields)}|${safe(stateOptions.sex)}|${safe(stateOptions.after23NewDay)}|${normalizeTimeAlg(stateOptions.timeAlg)}`;
		if(this.pendingRefresh && this.pendingRefresh.key === key){
			return this.pendingRefresh.promise;
		}
		if(!force && key === this.lastKey){
			return;
		}
		this.lastKey = key;
		const params = this.genParams(fields);
		if(!params){
			return;
		}
		const seq = ++this.refreshSeq;
		const refreshPromise = (async ()=>{
			const qimenOptions = this.getQimenOptions();
			const shouldWaitSeed = needJieqiYearSeed(qimenOptions);
			try{
				const year = parseInt(fields.date.value.format('YYYY'), 10);
				const waitSeed = !!(year && shouldWaitSeed);
				// 种子年份集单源 jieqiSeedYears(日家/金函含 y+1);缺任一年即 missingSeed → 种子到齐后 recalcByNongli 重算。
				const seedYears = waitSeed ? jieqiSeedYears(qimenOptions, year) : [];
				const seedPromise = waitSeed ? Promise.all(seedYears.map((yy)=>this.ensureJieqiSeed(fields, yy))) : null;
				const missingSeed = waitSeed && seedYears.some((yy)=>!this.jieqiYearSeeds[yy]);
				const precisePromise = fetchPreciseNongli(params);
				const cachedNongli = getNongliLocalCache(params);
				let nongli = cachedNongli;
				let usedFallback = false;
				if(!nongli){
					if((missingSeed || force) && !this.state.loading){
						this.setState({ loading: true });
					}
					const budgetResult = await Promise.race([
						precisePromise.then((result)=>({
							result,
						})),
						timeoutResolve(SANSHI_FAST_BUDGET_MS, {
							result: null,
						}),
					]);
					let preciseHit = !!(budgetResult && budgetResult.result);
					nongli = preciseHit ? budgetResult.result : null;
					if(!nongli){
						nongli = await precisePromise;
						preciseHit = !!nongli;
					}
					if(!nongli){
						usedFallback = true;
						nongli = this.getChartNongliFallback(fields);
						// 主盘农历恒按真太阳时:所选不是真太阳时就打上标记,盘面与快照如实写
						if(nongli && Number(params.timeAlg) !== 0){ nongli = { ...nongli, __trueSolarFallback: true }; }
					}
					// 屏上的农历只在是同一课(只改了设置)时才拿来兜底;换了起课时刻 / 地点,上一课的农历不顶这一课
					if(!nongli && this.state.nongli && castFailureKeeps(this.state.lessonSig, castSourceKey(fields))){
						usedFallback = true;
						nongli = {
							...this.state.nongli,
						};
					}
					if(!nongli){
						throw new Error('precise.nongli.unavailable');
					}
					if(preciseHit){
						setNongliLocalCache(params, nongli);
					}
				}
					const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
						if(this.unmounted || seq !== this.refreshSeq){
							return;
						}
						// 补丁预算好随盘结果同帧提交(recalcByNongli 第五参);
						// 仅当 recalc 未落 setState(签名去重/守卫 early-return,changed=false)时才在
						// 这里兜底单独提交 —— 否则「新盘+转圈」中间帧重现。
						const commitPatch = {};
						if(this.state.loading){
							commitPatch.loading = false;
						}
						if(displaySolarTime !== this.state.displaySolarTime){
							commitPatch.displaySolarTime = displaySolarTime;
						}
						const changed = await this.recalcByNongli(fields, nongli, null, displaySolarTime, commitPatch);
						if(!changed && !this.state.dunjia && this.lastRecalcError){
							throw this.lastRecalcError;
						}
						if(!this.unmounted && seq === this.refreshSeq && !changed){
							const patch = {};
							if(this.state.loading){
								patch.loading = false;
							}
							if(displaySolarTime !== this.state.displaySolarTime){
								patch.displaySolarTime = displaySolarTime;
							}
							if(Object.keys(patch).length > 0){
								this.setState(patch);
							}
					}
					const baseNongliKey = getNongliKey(nongli);
					precisePromise.then((refinedNongli)=>{
						if(!refinedNongli || this.unmounted || seq !== this.refreshSeq){
							return;
						}
							setNongliLocalCache(params, refinedNongli);
							this.resolveDisplaySolarTime(params, refinedNongli).then((nextDisplaySolarTime)=>{
								if(this.unmounted || seq !== this.refreshSeq){
									return;
								}
								if(nextDisplaySolarTime !== this.state.displaySolarTime){
									this.setState({ displaySolarTime: nextDisplaySolarTime });
								}
							}).catch(()=>null);
							// horosa_sanshi_render_slice_v1(S6):精算农历同键短路。fallback 路径原本因
							// usedFallback 无条件补跑一轮 recalcByNongli,但六键(年/月/日干支/时辰/节气/闰年)
							// 逐字相同的精算结果在 performRecalcByNongli 里也只会撞 recalcSignature 早退 ——
							// 白付一次去抖定时器 + 全套签名计算。仅当上一轮已产出健康盘面(dunjia 在位且无
							// recalcError)才跳过;键不同、或上一轮失败(保留这次兜底重试机会)照旧全算,
							// 非 fallback 路径的既有短路语义逐字不变。
							if(getNongliKey(refinedNongli) === baseNongliKey){
								if(!usedFallback){
									return;
								}
								if(this.state.dunjia && !this.lastRecalcError){
									return;
								}
							}
						this.recalcByNongli(fields, refinedNongli);
					}).catch(()=>null);
					if(waitSeed && missingSeed && seedPromise){
						seedPromise.then(()=>{
						if(this.unmounted || seq !== this.refreshSeq){
							return;
						}
							const latestNongli = (castFailureKeeps(this.state.lessonSig, castSourceKey(fields)) && this.state.nongli) || nongli;
							if(!latestNongli){
								return;
							}
							this.recalcByNongli(fields, latestNongli);
						}).catch(()=>null);
						}
				}catch(e){
					if(!this.unmounted && seq === this.refreshSeq){
						this.lastKey = '';   // 失败不记成「已算过」:同一组参数之后照常重取
						this.settleCastFailure(fields);
						const errText = `${safe(e && e.message, '')}`.toLowerCase();
						if(errText.indexOf('precise.nongli.unavailable') >= 0){
							message.error('三式合一计算失败：精确历法服务不可用');
						}else{
							const detail = safe(e && e.message, '').trim();
							message.error(detail ? `三式合一计算异常：${detail}` : '三式合一计算异常，请重试');
						}
						if(e){
							console.error('[SanShiUnited] refreshAll failed', e);
						}
					}
				}finally{
				if(this.pendingRefresh && this.pendingRefresh.seq === seq){
					this.pendingRefresh = null;
				}
			}
		})();
		this.pendingRefresh = {
			key,
			seq,
			promise: refreshPromise,
		};
		return refreshPromise;
	},
};
