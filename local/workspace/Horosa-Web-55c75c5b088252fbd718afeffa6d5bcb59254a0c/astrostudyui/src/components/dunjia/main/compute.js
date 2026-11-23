// 奇门页 · 起盘取数:盘缓存、时间 / 地点 / 选项改值后重算、节气种子与农历预取
// 从 DunJiaMain.js 按职责拆出的 DunJiaMain 方法:this 仍是 DunJiaMain 实例,门面里 mixinMethods(DunJiaMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { lockDayBoundary, dayBoundaryLockHeld } from '../../../utils/dayBoundaryLock';
import { stepPrefetchEnabled, kentangCacheEnabled, stepSelectPrefetchEnabled, stepPrefetchDepth } from '../../../utils/perfFlags';
import { armStepPrefetch } from '../../../utils/stepPrefetchArm';
import { message } from 'antd';
import { saveModuleAISnapshot, clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { castSourceKey, castFailureKeeps } from '../../../utils/derivedChartSource';
import { castIsDiurnal } from '../../../utils/castDiurnal';
import { geoNameFieldPatch } from '../../../utils/geoName';
import { getNongliLocalCache, setNongliLocalCache } from '../../../utils/localCalcCache';
import { fetchPreciseNongli, fetchPreciseJieqiSeed } from '../../../utils/preciseCalcBridge';
import DateTime from '../../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../../astro/AstroHelper';
import { resolveGeoZone } from '../../../utils/timezone';
import { calcDunJia, fetchQimenPan, isQimenLocalRoute, needJieqiYearSeed, jieqiSeedYears, jieqiSeedSignature, normalizeKinqimenData } from '../DunJiaCalc';
import { BAGONG_PALACE_ORDER } from '../DunJiaBaGongRules';
import { safe, resolveCalcGeo, buildDisplaySolarParams, getNongliKey } from '../qimenPageShared';
import { DEFAULT_OPTIONS, DUNJIA_PAGE_SETTINGS, normalizeKenQimenOptions } from './options';
import { normalizeTimeAlg, getFieldKey, getNongliRequestKey, getQimenOptionsKey, rememberDunJiaLiveState, buildDunJiaNongliParamsPure } from './pageState';
// [Windows-only] horosa_panel_ready_v1(P5):遁甲「画完」观测钉(验收配对靠它)。
import { markPanelReady } from '../../../utils/perfMark';

export const computeMethods = {
	getCachedPan(fields, nongli, options, displaySolarTime){
		const ctx = this.getContext(fields, displaySolarTime);
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(options),
			safe(ctx && ctx.isDiurnal, ''),
			safe(ctx && ctx.displaySolarTime, ''),
			// 种子签名:日家(节气三元60日块)/飞盘超神等依赖节气种子;种子异步到达后 key 变→不命中旧(退化)缓存,强制带种子重算。
			jieqiSeedSignature(ctx && ctx.jieqiYearSeeds),
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		const pan = calcDunJia(fields, nongli, options, ctx);
		this.panCache.set(key, pan);
		if(this.panCache.size > 64){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	},

	async getResolvedPan(fields, nongli, options, displaySolarTime){
		const ctx = this.getContext(fields, displaySolarTime);
		const fallbackPan = this.getCachedPan(fields, nongli, options, displaySolarTime);
		// 路由单源 isQimenLocalRoute(DunJiaCalc):年/月/日/刻/金函家、飞盘(飞宫九神)/混合(飞转结合)/数字起局(报数定局,后端无此入参)、
		// 以及七组本地口径任一非缺省(值使/置闰天数/八神/寄宫/暗干/空亡并标/移星值符:后端不收、合并不施加)均走本地
		// calcDunJia;时家/综合·转盘·全缺省口径仍走后端(转盘字节护栏)。
		if(!fallbackPan || isQimenLocalRoute(options)){
			return fallbackPan;
		}
		const backendPan = await fetchQimenPan(fields, nongli, options, ctx);
		return normalizeKinqimenData(backendPan, fallbackPan, options, nongli);
	},

	onFieldsChange(field, syncOnly){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			if(syncOnly){
				this.props.dispatch({
					type: 'astro/saveUserFields',
					payload: {
						fields: flds,
					},
				});
				return;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	},

	onTimeChanged(value){
		const dt = value.time;
		const base = this.props.fields || {};
		const localFields = {
			...base,
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		// [时间即时传导](horosa_live_time_propagation_v1)用户定版语义,与三式合一/择日同款:
		//   · **尚未起盘**:改时间只更新草稿,中栏保持「点击左侧起盘后显示遁甲盘」——首盘必须显式起局;
		//   · **已经起盘**:改时间即刻按新时间重算中栏与右栏(方便连续进退),无需再点起局。
		// 旧行为只落 localFields + 预取,盘面纹丝不动(用户实告)。此处只在已起盘态补一次真重算,
		// 未起盘态行为逐字不变(草稿+预取照旧,首盘仍必须显式点起局)。
		this.setState({ localFields }, ()=>{
			if(this.state.hasPlotted){
				this.requestNongli(localFields, true);
			}
		});
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
		}
		const stepHint = value && value.step ? value.step : null;
		this.prefetchSeedTimer = setTimeout(()=>{
			this.prefetchSeedTimer = null;
			if(this.unmounted){
				return;
			}
			this.prefetchJieqiSeedForFields(localFields);
			this.prefetchNongliForFields(localFields);
			// 草稿时间一变即预取该时刻 pan(kinqimen 后端模式):用户点「起局」时
			// nongli+pan 双双已热 ≈ 瞬间。步进时再顺向多备一步(连点第二下也不冷)。
			this.prefetchQimenPanForFields(localFields, stepHint);
			// R4-B2(b′,与上游互补):遁甲未确认步进只落 localFields、不经 fetchByFields
			// ⇒ settle 武装在此自己做 —— ±depth 双向 stage-1 经登记的预取器构造走共享调度器
			// (上游预取当前时刻+顺向一步;本武装铺双向全窗)。skipChart:/chart 不在本页步进路径上。
			try{ armStepPrefetch('local-settle', { fieldsOverride: localFields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
		}, 120);
	},

	// pan 预取:与真实链同源复刻(genParams→fetchPreciseNongli→
	// resolveDisplaySolarTime→getContext→fetchQimenPan),body 构造同一函数 → 键逐字节等;
	// 结果只落 kentangCache,返回值丢弃。仅 kinqimen 后端模式(本地 calcDunJia 即时无需预取);
	// 飞盘/混合/报数走本地,同 getResolvedPan 判据。失败静默。
	prefetchQimenPanForFields(localFields, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){
				return;
			}
			const options = this.state.options || {};
			// 本地路由(单源 isQimenLocalRoute)无 HTTP 免热。
			if(isQimenLocalRoute(options)){
				return;
			}
			const targets = [localFields];
			const baseDt = localFields && localFields.date && localFields.date.value;
			const canStep = baseDt && typeof baseDt.clone === 'function';
			// 步距加法单源(m 档=±4 分,与 DateTimeSelector 一致);dirs 由 stepHint 形态决定:
			// dir 真值(步进 settle)=顺向 +1;dir=0+depth(选步长 intent)=±1 双向(第一下即命中)。
			const stepTo = (unit, dir)=>{
				const dt2 = baseDt.clone();
				if(unit === 'y'){ dt2.addYear(dir); }
				else if(unit === 'M'){ dt2.addMonth(dir); }
				else if(unit === 'd'){ dt2.addDate(dir); }
				else if(unit === 'h'){ dt2.addHour(dir); }
				else { dt2.addMinute(4 * dir); }
				return { ...localFields, date: { value: dt2.clone() }, time: { value: dt2.clone() } };
			};
			if(stepHint && canStep){
				const unit = stepHint.unit || 'm';
				if(stepHint.dir){
					targets.push(stepTo(unit, stepHint.dir));
				}else if(stepHint.depth >= 1){
					// R4-B2:±1 固定窗 → ±min(depth, stepPrefetchDepth()) 全窗(pan 是重端点,
					// 深窗任务经 kentangCache 在途去重与 L1 即时吸收,真实网络数远小于目标数)。
					const d = Math.max(1, Math.min(stepHint.depth, stepPrefetchDepth()));
					for(let k = 1; k <= d; k += 1){
						targets.push(stepTo(unit, k));
						targets.push(stepTo(unit, -k));
					}
				}
			}
			targets.forEach((flds)=>{
				let params = null;
				try{ params = this.genParams(flds); }catch(e){ return; }
				if(!params){ return; }
				fetchPreciseNongli(params).then(async (nongli)=>{
					if(!nongli || this.unmounted){ return; }
					setNongliLocalCache(params, nongli);
					const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
					if(this.unmounted){ return; }
					const ctx = this.getContext(flds, displaySolarTime);
					await fetchQimenPan(flds, nongli, options, ctx);
				}).catch(()=>null);
			});
		}catch(e){ /* 预取失败无害 */ }
	},

	// 选步长即预取:奇门时间自持(localFields 草稿),全局 handler 对本页错键 ——
	// 以当前草稿时间为基 ±1 双向预热 pan(复用 prefetchQimenPanForFields 的 depth 语义,
	// 键与真点同源);同 unit 5s 去重。第一下步进/起局即命中,第二下起 settle 链接管。
	prefetchStepSelect(unit){
		try{
			if(!stepSelectPrefetchEnabled() || !unit){ return; }
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			// 先读左栏草稿(时间自持):弹层里改了步长 / 时间,草稿才是最新的
			const flds = this.state.localFields || this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
			if(!flds){ return; }
			this.prefetchQimenPanForFields(flds, { unit, dir: 0, depth: 1 });
		}catch(e){ /* 预取失败无害 */ }
	},

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		}, true);
	},

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	},

	clickPlot(){
		if(this.state.loading){
			return;
		}
		this._queuedExternalPlot = null;   // 亲手起盘在后:排着的外部起盘不再补起
		const timeFields = this.getTimeFieldsFromSelector(this.state.localFields || this.props.fields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const nextKey = getFieldKey(nextFields);
		const curKey = getFieldKey(this.props.fields);
		if(nextKey && nextKey !== curKey){
			this.onFieldsChange({
				date: { value: nextFields.date.value.clone() },
				time: { value: nextFields.time.value.clone() },
				ad: { value: nextFields.ad.value },
				zone: { value: nextFields.zone.value },
			}, true);
		}
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			const shouldForce = !this.state.nongli
				|| getNongliRequestKey(nextFields, this.state.options) !== this.lastNongliKey;
			this.requestNongli(nextFields, shouldForce);
		});
	},

	// 快捷栏契约:「此刻起局」:课时=当下并立即重排,绕过左栏时间草稿(用户点「此刻」即要 NOW)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动;左栏跟显靠 onFieldsChange 受控回流。
	clickPlotNow(){
		if(this.state.loading){
			return;
		}
		this._queuedExternalPlot = null;   // 同 clickPlot
		const base = this.state.localFields || this.props.fields;
		if(!base){
			return;
		}
		const now = new DateTime();
		const patch = {
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		};
		this.onFieldsChange(patch, true);
		const nextFields = { ...base, ...patch };
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			this.requestNongli(nextFields, true);
		});
	},

	// [奇门择日] 外挂 API(ref 调用):工作台播种当前 时空+22 参数。全部拷贝,防外部改动污染实例态。
	getScanContext(){
		const flds = this.state.localFields || this.props.fields || null;
		return {
			fields: flds,
			params: flds ? this.genParams(flds) : null,
			options: { ...this.state.options },
			hasPlotted: this.state.hasPlotted,
		};
	},

	// [奇门择日] 外挂 API(ref 调用):pick 命中时刻回写主盘。patch = { date/time(DateTime 实例)/ad/zone/
	// lat/lon/gpsLat/gpsLon/pos + 可选 options }。走 clickPlotNow 同款受控回流 + requestNongli(force)
	// 标准链重排 —— 显示路由(时家转盘经后端/其余本地)与独立奇门页按构造恒等。
	applyExternalPlot(patch){
		if(!patch){
			return;
		}
		// 正在取数时的外部起盘(择日点结果行)不丢:记下最后一次,这次取数落地后补起(见 componentDidUpdate)。
		// 此前直接丢弃,宿主却照样关上工作台 —— 盘停在旧时刻
		if(this.state.loading){
			this._queuedExternalPlot = patch;
			return;
		}
		this._queuedExternalPlot = null;
		const base = this.state.localFields || this.props.fields;
		if(!base){
			return;
		}
		const fieldPatch = {};
		['date', 'time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos'].forEach((k)=>{
			if(patch[k] !== undefined){
				fieldPatch[k] = { value: patch[k] };
			}
		});
		const nextState = { hasPlotted: true };
		let timeAlgChanged = false;
		if(patch.options && typeof patch.options === 'object'){
			const mergedOptions = normalizeKenQimenOptions({ ...this.state.options, ...patch.options });
			timeAlgChanged = normalizeTimeAlg(mergedOptions.timeAlg) !== normalizeTimeAlg(this.state.options.timeAlg);
			nextState.options = mergedOptions;
		}
		// 时间算法只进本页(见 onOptionChange):共用字段只写时间地点
		this.onFieldsChange(fieldPatch, true);
		const nextFields = { ...base, ...fieldPatch, ...(timeAlgChanged ? { timeAlg: { value: normalizeTimeAlg(nextState.options.timeAlg) } } : {}) };
		nextState.localFields = nextFields;
		this.setState(nextState, ()=>{
			if(timeAlgChanged){
				// 与 onOptionChange('timeAlg') 同款失效语义:种子/盘缓存/签名全清,防旧口径缓存串盘。
				this.jieqiSeedPromises = {};
				this.jieqiYearSeeds = {};
				this.panCache.clear();
				this.lastPanSignature = '';
				this.lastNongliKey = '';
			}
			this.requestNongli(nextFields, true);
		});
	},

	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		const dDt = base.date && base.date.value;
		const tDt = base.time && base.time.value;
		const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
		// 选地点 → 时区自动校正 + 重锚 date/time 到新时区(保留钟面时刻、瞬时随之偏移);手动改过时区则沿用 rec.zone。
		const z = resolveGeoZone(rec, ds);
		const geoPatch = {
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		};
		if(z){
			geoPatch.zone = { value: z };
			if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); geoPatch.date = { value: nd }; geoPatch.ad = { value: nd.ad }; }
			if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); geoPatch.time = { value: nt }; }
		}
		// 🔑 刷新左栏 + 让时间选择器(datetm 由 localFields 派生 + setZone)同步到新经度/时区,再走 clickPlot 重排。
		// 注意:此处【不】调 onFieldsChange(save)——save 会触发 hook 预取竞态、以旧盘(旧经纬/时区)以更高 seq 覆盖重算,
		// 导致真太阳时/四柱/局停在旧值;clickPlot 内部会在 key 变化时自行 save(顺序正确,无竞态)。
		Object.assign(geoPatch, geoNameFieldPatch(rec));
		const nextFields = { ...base, ...geoPatch };
		this.setState({ localFields: nextFields, hasPlotted: true }, ()=>{
			if(this._geoRecalcTimer){ clearTimeout(this._geoRecalcTimer); }
			// 直接用捕获的重锚 NY fields 强制重排(绕过时间选择器同步竞态);延后让 setState 提交后再跑。
			this._geoRecalcTimer = setTimeout(()=>{
				this._geoRecalcTimer = null;
				if(this.unmounted){ return; }
				this.requestNongli(nextFields, true);
				// 重排发起后再异步存盘(redux props.fields 同步供储存/AI),此时不再与重排抢 seq。
				this.onFieldsChange(geoPatch, true);
			}, 320);
		});
	},

	genParams(fields){
		// R4-B3:构造原样抽为模块级纯函数(预热复用同一路径 ⇒ key/body 逐字节一致);
		// 本方法保持既有签名与兜底语义(localFields/props 兜底),纯委托零行为变化。
		return buildDunJiaNongliParamsPure(
			fields || this.state.localFields || this.props.fields,
			this.state.options || DEFAULT_OPTIONS
		);
	},

	async recalc(fields, nongli, options, displaySolarTime){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return;
		}
		// 只认最后一次发起的取盘:与 requestNongli 共用 requestSeq(改档与改时间互相作废)。
		// 取号在去重之前 —— 去重命中说明屏上就是最新意图,此前在途的那次回来也不得再落屏。
		const seq = ++this.requestSeq;
		const displaySolar = safe(displaySolarTime, this.state.displaySolarTime);
		const fixedOptions = {
			...(options || this.state.options),
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
			const panSignature = [
				getFieldKey(flds),
				getNongliKey(nongli),
				getQimenOptionsKey(fixedOptions),
				safe(this.getContext(flds, displaySolar).isDiurnal, ''),
				displaySolar,
			].join('|');
		if(this.state.pan && panSignature === this.lastPanSignature){
			if(this.state.loading){ this.setState({ loading: false }); }   // 被作废的那次挂的加载态由最新这次收掉
			return;
		}
		const remoteMode = !isQimenLocalRoute(fixedOptions);
		if(remoteMode && !this.state.loading){
			this.setState({ loading: true });
		}
		try{
			const pan = await this.getResolvedPan(flds, nongli, fixedOptions, displaySolar);
			if(this.unmounted || seq !== this.requestSeq){
				return;
			}
			this.applyFaRelatedToPan(pan);
			// 单一真值：把当前「盘类（命/事）」戳进 pan.options，供 AI 快照(无 ctx 路径)与用神/化解命事局语义同源。
			if(pan && pan.options){ pan.options.chartCategory = this.state.chartCategory; }
			this.lastPanSignature = panSignature;
			this.setState({ pan, panSig: castSourceKey(flds), displaySolarTime: displaySolar, loading: false }, ()=>{
				// [Windows-only] horosa_panel_ready_v1:奇门中栏九宫盘 + 右栏五页签全部派生自这一个 pan,
				// 故本次 setState 落定 = 中栏+右栏画完(pan 为 null 时也算「本次交互到此为止」,
				// 不记会让该次交互永远配不上对)。已在 panSignature 去重与 loading 置位之后。
				markPanelReady('dunjia');
				if(pan){
					rememberDunJiaLiveState(this.scope, {
						fieldKey: getFieldKey(flds),
						lastNongliKey: this.lastNongliKey,
						lastPanSignature: this.lastPanSignature,
						nongli,
						displaySolarTime: displaySolar,
						pan,
						options: fixedOptions,
						boundaryTouched: this.boundaryTouchedMap(),
						faRelatedPeople: this.state.faRelatedPeople,
					});
					const snapshotText = this.saveLiveSnapshot(pan);
					if(snapshotText){
						saveModuleAISnapshot(this.scope, snapshotText);
					}
				}
			});
		}catch(e){
			if(!this.unmounted && seq === this.requestSeq){
				this.settleCastFailure(flds);
				message.error('遁甲计算失败：本地奇门服务不可用');
			}
		}
	},

	// 取盘失败:失败那次与屏上那张盘是同一课(只改了设置)→ 留存;换了起课时刻 / 地点 → 屏上那张是上一课,
	// 清掉(连同本页 AI 快照槽),不让上一课顶着新时刻显示 / 交给 AI。之后同一组参数照常可重取。
	settleCastFailure(flds){
		if(castFailureKeeps(this.state.panSig, castSourceKey(flds))){
			this.setState({ loading: false });
			return;
		}
		this.lastPanSignature = '';
		this.setState({ loading: false, pan: null, panSig: '' });
		clearModuleAISnapshot(this.scope);
	},

	genJieqiParams(fields, year){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const options = this.state.options || DEFAULT_OPTIONS;
		const calcGeo = resolveCalcGeo(flds, options);
		return {
			year: `${year}`,
			ad: flds.ad ? flds.ad.value : 1,
			zone: flds.zone.value,
			lon: calcGeo.lon,
			lat: calcGeo.lat,
			gpsLat: calcGeo.gpsLat,
			gpsLon: calcGeo.gpsLon,
			timeAlg: normalizeTimeAlg(options.timeAlg),
			hsys: 0,
			zodiacal: 0,
			doubingSu28: false,
		};
	},

	async resolveDisplaySolarTime(params, primaryResult){
		if(!params){
			return safe(primaryResult && primaryResult.birth, '');
		}
		const current = safe(primaryResult && primaryResult.birth, '');
		if(normalizeTimeAlg(params.timeAlg) === 0){
			return current;
		}
		const solarParams = buildDisplaySolarParams(params);
		const cachedSolar = getNongliLocalCache(solarParams);
		if(cachedSolar && cachedSolar.birth){
			return safe(cachedSolar.birth, current);
		}
		try{
			const solarResult = await fetchPreciseNongli(solarParams);
			if(solarResult){
				setNongliLocalCache(solarParams, solarResult);
			}
			return safe(solarResult && solarResult.birth, current);
		}catch(e){
			// 显示用真太阳时请求失败时，回退主请求时间，不中断排盘。
			return current;
		}
	},

	getContext(fields, displaySolarTime){
		const flds = fields || this.state.localFields || this.props.fields;
		let year = null;
		if(flds && flds.date && flds.date.value){
			year = parseInt(flds.date.value.format('YYYY'), 10);
		}
		return {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			// 昼夜单源 castIsDiurnal:参照盘与本次起课同一时刻地点才用它的;否则按起课时刻地点本地算
			// (主盘在途 / 取失败 / 择日宿主传下的是别的时刻的盘,都不拿来定贵人昼夜)
			isDiurnal: castIsDiurnal(this.props.value, flds),
			displaySolarTime: safe(displaySolarTime, this.state.displaySolarTime),
		};
	},

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		// 缓存命中须含日家所需「冬至/夏至」(旧版种子只取大雪/芒种);缺则放行重取(避免返回不全的旧种子致日家退化)。
		if(this.jieqiYearSeeds[year] && this.jieqiYearSeeds[year].冬至 && this.jieqiYearSeeds[year].夏至){
			return this.jieqiYearSeeds[year];
		}
		if(this.jieqiSeedPromises[year]){
			return this.jieqiSeedPromises[year];
		}
		const params = this.genJieqiParams(fields, year);
		if(!params){
			return null;
		}
		this.jieqiSeedPromises[year] = Promise.resolve().then(async()=>{
			let seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
				this.onJieqiSeedArrived();
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		return this.jieqiSeedPromises[year];
	},

	// 新 jieqi 种子到达:飞盘/混合短路的本地置闰·无闰超神·茅山交节 + 日家(节气三元60日块)依赖此种子;panCache key 不含种子→
	// 可能缓存了漏超神/漏块/茅山退拆补的盘,故失效缓存并重算其视图(转盘走后端不受影响)。
	// 条件改用单源 needJieqiYearSeed(此前只含飞/混与日家:金函/刻家/转盘本地口径非缺省 的种子晚到不重算)。
	// 只在「屏上的农历就是当前时间地点的」时就地重算:换了时间的那次取盘正在途中时,它自己会等种子、按新时间出盘;
	// 此时按新时间 + 旧农历重算会出一张错配的盘,还把在途那次作废。
	onJieqiSeedArrived(){
		if(this.unmounted || !this.state.hasPlotted || !needJieqiYearSeed(this.state.options || {})){
			return;
		}
		if(this.panCache){ this.panCache.clear(); }
		this.lastPanSignature = '';
		const flds = this.state.localFields || this.props.fields;
		if(flds && this.state.nongli && getNongliRequestKey(flds, this.state.options) === this.lastNongliKey){
			this.recalc(flds, this.state.nongli, this.state.options, this.state.displaySolarTime);
		}
	},

	prefetchJieqiSeedForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !flds.date || !flds.date.value){
			return;
		}
		const fixedOptions = {
			...this.state.options,
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(!needJieqiYearSeed(fixedOptions)){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		if(!year || Number.isNaN(year)){
			return;
		}
		// 种子年份集单源 jieqiSeedYears:日家/金函 晚12月冬至界需次年冬至定半年/至甲子 → y-1,y,y+1;其余 y-1,y。
		const seedTasks = jieqiSeedYears(fixedOptions, year).map((yy)=>this.ensureJieqiSeed(flds, yy));
		Promise.all(seedTasks).catch(()=>null);
	},

	prefetchNongliForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		let params = null;
		try{
			params = this.genParams(flds);
		}catch(e){
			return;
		}
		if(!params){
			return;
		}
		fetchPreciseNongli(params).then((result)=>{
			if(result){
				setNongliLocalCache(params, result);
			}
		}).catch(()=>null);
	},

	async requestNongli(fields, force){
		const fldsToUse = fields || this.state.localFields || this.props.fields;
		let params = null;
		try{
			params = this.genParams(fldsToUse);
		}catch(e){
			message.error('遁甲起盘参数无效，请确认时间与经纬度后重试');
			return;
		}
		if(!params){
			return;
		}
		const requestKey = getNongliRequestKey(fldsToUse, this.state.options);
		if(!force && this.state.nongli && requestKey && requestKey === this.lastNongliKey){
			this.recalc(fldsToUse, this.state.nongli, this.state.options, this.state.displaySolarTime);
			return;
		}
		// 同键合并只合并「仍是最新、且盘面档位相同」的在途请求:被改档作废的那次、或按旧档位出盘的那次,不能顶替这一次
		const pendingOptionsKey = getQimenOptionsKey(this.state.options || {});
		if(this.pendingNongli && this.pendingNongli.key === requestKey
			&& this.pendingNongli.seq === this.requestSeq && this.pendingNongli.optionsKey === pendingOptionsKey){
			return this.pendingNongli.promise;
		}
		const seq = ++this.requestSeq;
		if(force && !this.state.loading){
			this.setState({ loading: true });
		}

		const reqPromise = (async ()=>{
			const fixedOptions = {
				...this.state.options,
				jieQiType: 1,
				yearGanZhiType: 2,
				monthGanZhiType: 1,
				dayGanZhiType: 1,
			};
			const shouldWaitSeed = needJieqiYearSeed(fixedOptions);
			const flds = fldsToUse;
			let year = null;
			if(flds && flds.date && flds.date.value){
				year = parseInt(flds.date.value.format('YYYY'), 10);
			}
			const waitSeed = !!(year && shouldWaitSeed);
			// 种子年份集单源 jieqiSeedYears(日家/金函 y-1,y,y+1;其余 y-1,y)。
			const seedYears = jieqiSeedYears(fixedOptions, year);
			const seedPromise = waitSeed ? Promise.all(seedYears.map((yy)=>this.ensureJieqiSeed(flds, yy))) : null;
			const missingSeed = waitSeed && seedYears.some((yy)=>!this.jieqiYearSeeds[yy]);
			if(missingSeed && !this.state.loading){
				this.setState({ loading: true });
			}
				try{
					const result = await fetchPreciseNongli(params);
					if(!result){
						throw new Error('precise.nongli.unavailable');
					}
					setNongliLocalCache(params, result);
					const displaySolarTime = await this.resolveDisplaySolarTime(params, result);
					if(this.unmounted || seq !== this.requestSeq){
						return;
					}
				if(waitSeed){
					const seeds = await seedPromise;
					if(!seeds[0] || !seeds[1]){
						throw new Error('precise.jieqi.unavailable');
					}
				}
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
					const panSignature = [
						getFieldKey(flds),
						getNongliKey(result),
						getQimenOptionsKey(fixedOptions),
						safe(this.getContext(flds, displaySolarTime).isDiurnal, ''),
						displaySolarTime,
					].join('|');
					const pan = await this.getResolvedPan(flds, result, fixedOptions, displaySolarTime);
					if(this.unmounted || seq !== this.requestSeq){
						return;
					}
					this.applyFaRelatedToPan(pan);
					this.lastNongliKey = requestKey;
					this.lastPanSignature = panSignature;
						this.setState({
							nongli: result,
							displaySolarTime,
							pan,
							panSig: castSourceKey(flds),
							hasPlotted: true,
							loading: false,
						}, ()=>{
						if(pan){
							rememberDunJiaLiveState(this.scope, {
								fieldKey: getFieldKey(flds),
								lastNongliKey: this.lastNongliKey,
								lastPanSignature: this.lastPanSignature,
								nongli: result,
								displaySolarTime,
								pan,
								options: fixedOptions,
								boundaryTouched: this.boundaryTouchedMap(),
								faRelatedPeople: this.state.faRelatedPeople,
							});
							const snapshotText = this.saveLiveSnapshot(pan);
							if(snapshotText){
								saveModuleAISnapshot(this.scope, snapshotText);
							}
						}
					});
			}catch(e){
				if(!this.unmounted && seq === this.requestSeq){
					this.settleCastFailure(flds);
					message.error('遁甲计算失败：精确历法服务不可用');
				}
			}finally{
				if(this.pendingNongli && this.pendingNongli.key === requestKey && seq === this.requestSeq){
					this.pendingNongli = null;
				}
			}
		})();
		this.pendingNongli = {
			key: requestKey,
			seq,
			optionsKey: pendingOptionsKey,
			promise: reqPromise,
		};
		return reqPromise;
	},

	// 日界两键是否被本页左栏显式改过(供 live 态记账:未改过的重建时按全局现值)
	boundaryTouchedMap(){
		return {
			after23NewDay: dayBoundaryLockHeld(this, 'after23'),
			lateZiHourUseNextDay: dayBoundaryLockHeld(this, 'lateZi'),
		};
	},

	onOptionChange(key, value, opts){
		// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖(最高权限)。fromGlobal 时不打用户改过的标记。
		if(key === 'after23NewDay' && !(opts && opts.fromGlobal)){
			lockDayBoundary(this, 'after23');
		}
		// v2.2.1: 时柱开关同款局部覆盖语义
		if(key === 'lateZiHourUseNextDay' && !(opts && opts.fromGlobal)){
			lockDayBoundary(this, 'lateZi');
		}
		const nextVal = key === 'timeAlg' ? normalizeTimeAlg(value) : value;
		// 用户亲手改的口径 → 落盘(全局广播带 fromGlobal、程序同步带 programmatic,都不落;非设置键会被 store 忽略)。
		// 独立遁甲页与奇门择日内嵌实例同用(理由见 DUNJIA_PAGE_SETTINGS 注);择日工作台下发口径不经本入口。
		if(!(opts && (opts.fromGlobal || opts.programmatic))){
			DUNJIA_PAGE_SETTINGS.save({ [key]: nextVal });
		}
		const options = normalizeKenQimenOptions({
			...this.state.options,
			[key]: nextVal,
		});
		const nextState = { options };
		// 切 排盘体例/盘式/起局 → 八宫子选复位到默认宫(右栏各 tab 数据本就随 resolved pan 重算,此处只复位子选避免停留旧宫)。
		if(['paiPanType', 'school', 'qijuMethod'].indexOf(key) >= 0){
			nextState.bagongPalace = BAGONG_PALACE_ORDER[0];
		}
		if(key === 'timeAlg'){
			nextState.localFields = {
				...(this.state.localFields || this.props.fields || {}),
				timeAlg: { value: nextVal },
			};
		}
		this.setState(nextState, ()=>{
			// [奇门择日] 参数镜像:宿主工作台 chips 实时跟随左栏(after23/timeAlg 分支提前 return,故放回调开头)。
			if(typeof this.props.onOptionsChange === 'function'){
				this.props.onOptionsChange({ ...options });
			}
			this.replotAfterOptionChange(key, options);
		});
	},

	// 盘面选项改了之后的重排(左栏亲手改 / 外部性别同步共用)
	replotAfterOptionChange(key, options){
		if(key === 'timeAlg'){
			this.jieqiSeedPromises = {};
			this.jieqiYearSeeds = {};
			this.panCache.clear();
			this.lastPanSignature = '';
			this.lastNongliKey = '';
			// 时间算法只作用于本页(与六壬 / 八字覆盖层同):不写共用字段 —— 此前写进 fields.timeAlg,
			// 紫微 / 七政本次会话跟着变,重开又回到新盘缺省
		}
		const calcFields = this.state.localFields || this.props.fields;
		const calcFieldKey = getFieldKey(calcFields);
		this.prefetchJieqiSeedForFields(calcFields);
		const canRecalc = this.state.nongli
			&& calcFieldKey
			&& getNongliRequestKey(calcFields, options) === this.lastNongliKey;
		if(key === 'after23NewDay' || key === 'timeAlg'){
			this.prefetchNongliForFields(calcFields);
			if(this.state.hasPlotted){
				this.requestNongli(calcFields, true);
			}
			return;
		}
		if(this.state.hasPlotted && canRecalc){
			this.recalc(this.state.localFields || this.props.fields, this.state.nongli, options, this.state.displaySolarTime);
		}else if(this.state.hasPlotted){
			// [QA] 🔴 档位已改而农历缺失/键不匹配(如后端刚就绪窗口):自动补请农历并重排——
			// 否则用户改档位盘面无反应,必须手点「起盘」(实机抓获;与 after23/timeAlg 分支同款成熟路径)。
			this.requestNongli(calcFields, true);
		}
	},
};
