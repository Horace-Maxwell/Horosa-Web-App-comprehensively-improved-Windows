// 三式合一页 · 事盘回灌、外部时间同步、存案
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { castSourceKey, castChartFor, castFailureKeeps } from '../../../utils/derivedChartSource';
import { loadFreshModuleAISnapshot } from '../../../utils/moduleSnapshotRefresh';
import { getStore } from '../../../utils/storageutil';
import { caseRestoreKey, caseFieldSnapshot, caseGenderValue, getKentangSavedCaseFieldsPatch } from '../../../utils/kentangCaseSave';
import { normalizeTaiyiSchool } from '../../taiyi/core/taiyiSchool';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { zeriRestoredLockMarks } from '../../../divination/zeri/zeriPageCalibre';
import { normalizeKenQimenOptions, QIMEN_OPTIONS, SANSHI_PAGE_SETTINGS } from './options';
import { normalizeTimeAlg, getFieldSyncKey, getOuterChartKey } from './format';
import { buildSanShiUnitedSnapshotText } from './snapshot';

export const caseStateMethods = {
	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	},

	restoreOptionsFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		// 🔴 按本实例 scope 判(曾硬编码 'sanshiunited':择日宿主实例也吃主三式事盘——
		// 初始盘被劫持,审查实抓;DunJiaMain scope 判同律)
		const scope = this.props.techniqueScope || 'sanshiunited';
		// 读档去重键走共用件(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;
		// 编辑 / 存为事盘 / 保存编辑换掉的当前事盘不是载入 → null,不还原(存下的就是所见那张盘,择日里也不换内嵌页覆盖层)。禁另拼一份。
		const caseVersion = caseRestoreKey(scope, userState);
		if(!caseVersion){
			return;
		}
		if(!force && caseVersion === this.lastRestoredCaseId){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== scope && caseType !== scope){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
			// 事盘里没有的口径键回**出厂值**,而不是留着本机保存的偏好:本页口径现在跨会话保留,按出厂口径存下的旧案不带后来才有的键,
			// 不回出厂就会被按你现在的偏好重排(盘变了,与存档里的快照也对不上)。时间算法的出厂值 = 跨页共享字段的现值(与构造函数同一来源)。
			const { outerCoord: _oc, showWeakSolid: _sw, ascRaMode: _ar, ...factoryOptionKeys } = SANSHI_PAGE_SETTINGS.defaults();
			factoryOptionKeys.timeAlg = normalizeTimeAlg(this.props.fields && this.props.fields.timeAlg ? this.props.fields.timeAlg.value : 0);
			const options = {
				...(this.state.options || {}),
				...factoryOptionKeys,
			};
			if(payload.options && typeof payload.options === 'object'){
				if(payload.options.mode === 'ming' || payload.options.mode === 'shi'){
					options.mode = payload.options.mode;
				}
				if(payload.options.timeAlg === 0 || payload.options.timeAlg === 1){
					options.timeAlg = payload.options.timeAlg;
				}
				if(payload.options.sex === 0 || payload.options.sex === 1){
					options.sex = payload.options.sex;
				}
				if(payload.options.guireng >= 0 && payload.options.guireng <= 4){
					options.guireng = payload.options.guireng;
				}
				if(payload.options.zodiacal === 0 || payload.options.zodiacal === 1){
					options.zodiacal = payload.options.zodiacal;
				}
				if(typeof payload.options.siderealAyanamsa === 'string'){
					options.siderealAyanamsa = payload.options.siderealAyanamsa;
				}
				if(payload.options.hsys !== undefined && payload.options.hsys !== null){
					options.hsys = payload.options.hsys;
				}
				if(payload.options.after23NewDay === 0 || payload.options.after23NewDay === 1){
					options.after23NewDay = payload.options.after23NewDay;
				}
				if(payload.options.paiPanType !== undefined){
					options.paiPanType = payload.options.paiPanType;
				}
				if(payload.options.zhiShiType !== undefined){
					options.zhiShiType = payload.options.zhiShiType;
				}
				if(payload.options.yueJiaQiJuType !== undefined){
					options.yueJiaQiJuType = payload.options.yueJiaQiJuType;
				}
				if(payload.options.qijuMethod){
					options.qijuMethod = payload.options.qijuMethod;
				}
				if(payload.options.kongMode){
					options.kongMode = payload.options.kongMode;
				}
				if(payload.options.yimaMode){
					options.yimaMode = payload.options.yimaMode;
				}
				if(payload.options.shiftPalace !== undefined){
					options.shiftPalace = payload.options.shiftPalace;
				}
				if(payload.options.taiyiStyle !== undefined){
					options.taiyiStyle = payload.options.taiyiStyle;
				}
				if(payload.options.taiyiAccum !== undefined){
					options.taiyiAccum = payload.options.taiyiAccum;
				}
				if(payload.options.taiyiTimeBasis === 'direct' || payload.options.taiyiTimeBasis === 'trueSolar'){   // 存案还原太乙时间基准
					options.taiyiTimeBasis = payload.options.taiyiTimeBasis;
				}
				// 奇门流派/起局补充
				if(payload.options.school){
					options.school = payload.options.school;
				}
				if(payload.options.shuziReportNumber !== undefined){
					options.shuziReportNumber = payload.options.shuziReportNumber;
				}
				if(payload.options.fengJu !== undefined){
					options.fengJu = !!payload.options.fengJu;
				}
				if(payload.options.zhirunLeapDays !== undefined){
					options.zhirunLeapDays = payload.options.zhirunLeapDays;
				}
				// 太乙博弈 + 流派
				if(payload.options.gameTheory === 0 || payload.options.gameTheory === 1){
					options.gameTheory = payload.options.gameTheory;
				}
				if(payload.options.taiyiSchool && typeof payload.options.taiyiSchool === 'object'){
					options.taiyiSchool = normalizeTaiyiSchool(payload.options.taiyiSchool);
				}
				// 大六壬流派
				if(payload.options.yueJiangMethod){
					options.yueJiangMethod = payload.options.yueJiangMethod;
				}
				if(payload.options.fenZhouYe){
					options.fenZhouYe = payload.options.fenZhouYe;
				}
				if(payload.options.seHaiMethod){
					options.seHaiMethod = payload.options.seHaiMethod;
				}
				if(payload.options.seHaiBoundary){
					options.seHaiBoundary = payload.options.seHaiBoundary;
				}
				if(payload.options.shiRuKe !== undefined){
					options.shiRuKe = !!payload.options.shiRuKe;
				}
				if(payload.options.yearShenShaSort){
					options.yearShenShaSort = payload.options.yearShenShaSort;
				}
				if(payload.options.yinyangSystem){
					options.yinyangSystem = payload.options.yinyangSystem;
				}
				// 🔴 奇门键集驱动灌注(根治手写白名单漏新键=存档载入丢设置):
				// QIMEN_OPTIONS 默认表的每个键都从存档取——独立页 restore 以 Object.keys(DEFAULT_OPTIONS)
				// 驱动的同构范式,新增奇门键零维护自动跟随;已手写键幂等覆盖同值无害。
				Object.keys(QIMEN_OPTIONS).forEach((qk)=>{
					if(payload.options[qk] !== undefined){
						options[qk] = payload.options[qk];
					}
				});
				if(payload.options.tuWangShuai){
					options.tuWangShuai = payload.options.tuWangShuai;
				}
			}
		const normalizedOptions = normalizeKenQimenOptions(options);
		this.lastRestoredCaseId = caseVersion;
		// 择日内嵌:记下哪些锁定项是由存案复原成非扫描口径的(显式标记,见 zeriLockProps 第四参)
		if(this.props.zeriLocked){ this._zeriRestoredLocks = zeriRestoredLockMarks(this.props.zeriLocked, normalizedOptions); }
		const patchFields = {};
		if(options.zodiacal !== undefined){
			patchFields.zodiacal = { value: options.zodiacal };
		}
		if(options.siderealAyanamsa !== undefined){
			patchFields.siderealAyanamsa = { value: options.siderealAyanamsa };
		}
		if(options.hsys !== undefined){
			patchFields.hsys = { value: options.hsys };
		}
		if(options.sex !== undefined){
			patchFields.gender = { value: options.sex };
		}
		if(options.timeAlg !== undefined){
			patchFields.timeAlg = { value: normalizeTimeAlg(options.timeAlg) };
		}
		// 择日内嵌:存案那一刻的时间地点(主页载入事盘时主盘字段已是它,不用另补)
		const casePatch = this.props.techniqueScope ? (getKentangSavedCaseFieldsPatch(scope) || {}) : {};
		const nextLocalFields = {
			...this.getActiveFields(),
			...casePatch,
			...patchFields,
		};
		// 事盘带的时间算法只进本页 fields(同「时间算法只作用于本页」);其余随盘键照写共用字段
		const sharedPatch = { ...patchFields };
		delete sharedPatch.timeAlg;
		// 择日内嵌:覆盖层整个换成存案的时间地点 + 这几键(此前并进旧覆盖层、且时刻停在择日页当前,按它重排);主页照写共用字段
		if(!sendScopedFields(this.props, { ...casePatch, ...sharedPatch }, { replace: true }) && Object.keys(sharedPatch).length){
			this.onFieldsChange(sharedPatch, true);
		}
		this.setState({
			options: normalizedOptions,
			hasPlotted: true,
			localFields: nextLocalFields,
			plottedFields: nextLocalFields,
		}, ()=>{
			// 换了时刻(择日内嵌回到存案那一刻)要重取农历;同一时刻(屏上那一课与它同一起课时刻地点)按现有农历重算
			const sameLessonNongli = castFailureKeeps(this.state.lessonSig, castSourceKey(nextLocalFields)) ? this.state.nongli : null;
			if(sameLessonNongli && !Object.keys(casePatch).length){
				this.recalcByNongli(nextLocalFields, sameLessonNongli, normalizedOptions);
			}else{
				this.refreshAll(nextLocalFields, true);
			}
		});
	},

	handleExternalFieldsSync(fields, chartObj){
		const nextFields = fields || this.props.fields;
		if(!nextFields){
			return;
		}
		const chartKey = getOuterChartKey(castChartFor(chartObj || this.props.chartObj || this.props.chart || null, nextFields));
		const syncKey = `${getFieldSyncKey(nextFields)}|${chartKey}`;
		if(syncKey && syncKey === this.lastExternalFieldsKey && !this.awaitingChartSync){
			return;
		}
		this.lastExternalFieldsKey = syncKey;
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		this.awaitingChartSync = false;
		this.pendingTimeFields = null;
		const currentOptions = this.state.options || {};
		const nextOptions = {
			...currentOptions,
		};
		const fieldGender = nextFields.gender ? nextFields.gender.value : null;
		if(fieldGender === 0 || fieldGender === 1){
			nextOptions.sex = fieldGender;
		}
		const shouldReplot = !!this.state.hasPlotted;
		const patch = {
			localFields: nextFields,
			options: nextOptions,
		};
		if(shouldReplot){
			patch.plottedFields = nextFields;
			patch.loading = true;
		}
		this.setState(patch, ()=>{
			this.prefetchNongliForFields(nextFields);
			this.prefetchJieqiSeedForFields(nextFields, nextOptions);
			if(!shouldReplot){
				return;
			}
			setTimeout(()=>{
				if(this.unmounted){
					return;
				}
				this.refreshAll(nextFields, true);
			}, 0);
		});
	},

	syncFields(field){
		// 择日宿主内嵌:改动交给宿主的覆盖层(只更新显示,重排由随后的 onFieldsChange 交给宿主),不写主盘
		if(sendScopedFields(this.props, field, { recompute: false })){
			return;
		}
		if(!this.props.dispatch){
			return;
		}
		const flds = {
			...(this.props.fields || {}),
			...(field || {}),
		};
		this.props.dispatch({
			type: 'astro/saveUserFields',
			payload: {
				fields: flds,
			},
		});
	},

	clickSave(){
		if(!this.state.hasPlotted || !this.state.dunjia){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.plottedFields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		if((this.state.options || {}).mode === 'ming'){
			// 命局存为命盘:与独立奇门页同口径代填起局时间(作生时)、经纬度 / 地名 / 时区与性别(此前开空白新建框)
			if(this.props.dispatch){
				const opt = this.state.options || {};
				const birthStr = flds.date && flds.time && flds.date.value && flds.time.value
					? `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}` : undefined;
				this.props.dispatch({
					type: 'astro/openDrawer',
					payload: {
						key: 'chartadd',
						record: {
							birth: birthStr,
							zone: flds.zone ? flds.zone.value : undefined,
							lat: flds.lat ? flds.lat.value : undefined,
							lon: flds.lon ? flds.lon.value : undefined,
							gpsLat: flds.gpsLat ? flds.gpsLat.value : undefined,
							gpsLon: flds.gpsLon ? flds.gpsLon.value : undefined,
							pos: flds.pos ? flds.pos.value : undefined,
							gender: opt.sex === 0 || opt.sex === 1 ? opt.sex : undefined,
						},
					},
				});
			}
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		// 存档即写格式化快照(与导出/挂载同源 buildSanShiUnitedSnapshotText)。否则挂载该 case 走
		// buildSanshiUnifiedFallbackSnapshot 兜底,产出[奇门遁甲]等不在 sanshiunited preset 的段名,
		// 自定义过导出段的用户会被静默删。对齐 sixyao/mundane「存档带 snapshot」范式(extractCaseSnapshotText 直读 payload.snapshot)。
		const chartWrap = this.state.castChart;   // 这一课所用的参照盘(与课同一次落定)
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const outerData = this.currentOuterData(astroChart);
		const lrSnapInput = this.state.liurengSnapshotInput || {};
		const snapshotText = buildSanShiUnitedSnapshotText({
			fields: flds,
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
		});
			// 择日宿主内按宿主键(sanshizeri)存档;快照取宿主槽(含择时段),缺则用本页快照。
			const ssScope = this.props.techniqueScope || 'sanshiunited';
			// 先请本页按此刻所见重存再读(宿主刚出的择时结果经 composeAiSnapshot 并入;直读槽 = 扫描前的旧文)
			const ssScopeSnap = ssScope !== 'sanshiunited' ? loadFreshModuleAISnapshot(ssScope) : null;
			const payload = {
				module: ssScope,
				snapshot: (ssScopeSnap && ssScopeSnap.content) ? ssScopeSnap.content : (snapshotText || ''),
				options: {
					...(this.state.options || {}),
				},
			result: {
				nongli: this.state.nongli,
				liureng: this.state.liureng,
				dunjia: this.state.dunjia,
				taiyi: this.state.taiyi,
				keData: this.state.keData,
				sanChuan: this.state.sanChuan,
			},
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `${ssScope === 'sanshizeri' ? '三式择日' : '三式合一占断'} ${divTime}`,
						caseType: ssScope,
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						gender: caseGenderValue(flds),
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: ssScope,
					},
				},
			});
		}
	},

	// 只有独立三式页读写保存值;三式择日里内嵌的那份(techniqueScope='sanshizeri')不读不写(理由见 SANSHI_PAGE_SETTINGS 注)。
	usesSavedSettings(){
		return (this.props.techniqueScope || 'sanshiunited') === 'sanshiunited';
	},
};
