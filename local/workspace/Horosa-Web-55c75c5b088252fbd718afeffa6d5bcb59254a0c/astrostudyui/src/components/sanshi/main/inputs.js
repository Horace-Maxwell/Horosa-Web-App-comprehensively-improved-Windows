// 三式合一页 · 时间 / 地点 / 性别 / 选项改值与起盘入口
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { lockDayBoundary } from '../../../utils/dayBoundaryLock';
import * as AstroConst from '../../../constants/AstroConst';
import { convertLatToStr, convertLonToStr } from '../../astro/AstroHelper';
import { resolveGeoZone } from '../../../utils/timezone';
import { recordNewChartSeeds } from '../../../utils/newChartSeeds';
import { geoNameFieldPatch } from '../../../utils/geoName';
import DateTime from '../../comp/DateTime';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { safe } from '../../dunjia/qimenPageShared';
import { normalizeAscRaMode } from '../../../utils/ascRaMode';
import { normalizeKenQimenOptions, SANSHI_PAGE_SETTINGS, SANSHI_RECALC_OPTION_KEYS } from './options';
import { normalizeTimeAlg, normalizeZoneOffset } from './format';
import { buildOuterData } from './outerRing';

export const inputMethods = {
	// 快捷栏契约:「此刻起盘」:局时=当下并立即重排。借道 clickPlot 全管道(同步/预取/兜底定时器),
	// 起盘瞬间临时屏蔽左栏时间草稿(timeHook)——点「此刻」语义就是 NOW,不该被旧草稿覆盖。
	clickPlotNow(){
		if(this.state.loading){
			return;
		}
		const base = this.state.localFields || this.props.fields;
		if(!base){
			return;
		}
		const now = new DateTime();
		this.pendingTimeFields = {
			...base,
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		};
		const hookGet = this.timeHook && this.timeHook.getValue;
		if(hookGet){
			this.timeHook.getValue = ()=>null;
		}
		try{
			this.clickPlot();
		}finally{
			if(hookGet){
				this.timeHook.getValue = hookGet;
			}
		}
	},

	onFieldsChange(field, requestMode){
		// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 拉底盘重排),不写主盘
		if(sendScopedFields(this.props, field)){
			return;
		}
		if(this.props.dispatch){
			const requestOptions = (typeof requestMode === 'object' && requestMode)
				? requestMode
				: {
					silentRequest: !!requestMode,
					nohook: !!requestMode,
				};
			const silentRequest = !!requestOptions.silentRequest;
			const nohook = !!requestOptions.nohook;
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			const payload = silentRequest ? {
				...flds,
				__requestOptions: {
					silent: true,
				},
				nohook,
			} : flds;
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload,
			});
		}
	},

	onTimeChanged(value){
		const dt = value.time;
		const confirmed = !!value.confirmed;
		const base = this.props.fields || {};
		const zoneValue = normalizeZoneOffset(dt.zone, safe(base.zone && base.zone.value, '+08:00'));
		const localFields = {
			...base,
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: zoneValue },
		};
		this.pendingTimeFields = localFields;
		// [时间即时传导](horosa_live_time_propagation_v1)用户定版语义:
		//   · **尚未起盘**:改时间只更新草稿,中栏保持「点击起盘」态 —— 首盘必须显式点「确定」/「起盘」;
		//   · **已经起盘**:改时间即刻按新时间重算中栏与右栏(方便连续进退),无需再点确定。
		// 旧行为只认 confirmed(点「确定」/内联步进才带 true;Popover 里改年月日时分秒带 false)
		// ⇒ 用户实告「时间改了盘不动,只有直接时间那栏变」。confirmed 与否不再决定「算不算」,
		// 只决定「是不是一次显式提交」——已起盘态下两者走同一条重算链,语义因此统一。
		const liveReplot = !confirmed && !!this.state.hasPlotted;
		if(confirmed || liveReplot){
			this.setState({ localFields }, ()=>{
				// 与“起盘”按钮保持一致：点击“确定”后直接按最新时间起盘。
				this.clickPlot();
			});
			const syncedFields = {
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: zoneValue },
			};
			this.syncFields(syncedFields);
			this.onFieldsChange({
				...syncedFields,
				// 步进方向提示只进 fetchByFields 链(syncFields 的 astro/save 不携带)
				...(value.step ? { __stepHint: value.step } : {}),
			}, {
				silentRequest: true,
				nohook: true,
			});
			this.prefetchNongliForFields(localFields);
			this.prefetchJieqiSeedForFields(localFields);
		}
	},

	onTimeAlgChange(val){
		const nextVal = normalizeTimeAlg(val);
		this.onOptionChange('timeAlg', nextVal);
		this.jieqiYearSeeds = {};
		this.jieqiSeedPromises = {};
		this.panCache.clear();
		this.taiyiCache.clear();
		this.lastRecalcSignature = '';
		this.lastKey = '';
		// 时间算法只作用于本页(与六壬 / 八字覆盖层同):不写共用字段 —— 此前写进 fields.timeAlg,
		// 紫微 / 七政本次会话跟着变,重开又回到新盘缺省
		const localFields = {
			...this.getActiveFields(),
			timeAlg: { value: nextVal },
		};
		this.setState({ localFields }, ()=>{
			this.prefetchNongliForFields(localFields);
			this.prefetchJieqiSeedForFields(localFields);
			// 不再走字段通道后,已起盘时要在这里按新口径重算重画(否则标签换了、三盘仍是旧口径)
			if(this.state.hasPlotted){
				this.refreshAll(localFields, true);
			}
		});
	},

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		}, true);
	},

		onOptionChange(key, value, opts){
			// 年/月/日家(paiPanType 0/1/2)走本地 calcDunJia 各家局法(与独立遁甲同源),不依赖后端 → 全部放行,与独立页排盘选项一致。
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(key === 'after23NewDay' && !(opts && opts.fromGlobal)){
				lockDayBoundary(this, 'after23');
			}
			// v2.2.1: 时柱开关同款局部覆盖
			if(key === 'lateZiHourUseNextDay' && !(opts && opts.fromGlobal)){
				lockDayBoundary(this, 'lateZi');
			}
			// 用户亲手改的口径 → 落盘(全局广播带 fromGlobal,不落;非设置键会被 store 忽略)。
			// 太乙流派是一张表:只落这次亲手改的那个子键(opts.subKey),以库里那份为底 —— 当前 state 里的表可能刚被事盘回灌过。
			if(!(opts && opts.fromGlobal) && this.usesSavedSettings()){
				if(key === 'taiyiSchool' && opts && opts.subKey){
					SANSHI_PAGE_SETTINGS.saveMapEntry('taiyiSchool', opts.subKey, (value || {})[opts.subKey]);
				}else{
					SANSHI_PAGE_SETTINGS.save({ [key]: value });
				}
			}
			const options = normalizeKenQimenOptions({
				...(this.state.options || {}),
				[key]: value,
			});
		this.setState({ options }, ()=>{
			if(key === 'after23NewDay' || key === 'lateZiHourUseNextDay' || key === 'paiPanType' || key === 'qijuMethod'){
				const flds = this.getActiveFields();
				this.prefetchNongliForFields(flds);
				this.prefetchJieqiSeedForFields(flds, options);
				// after23NewDay / lateZi 切换必须真正重算(prefetch 只填 cache,不重画盘)
				if((key === 'after23NewDay' || key === 'lateZiHourUseNextDay') && this.state.hasPlotted){
					this.refreshAll(flds, true);
				}
			}
			// 🔴 选项改了不重算根治:以下计算型控件都已进 recalcSignature(getQimenOptions/getKintaiyiPan/六壬 layout 消费),
			// 但 refreshAll 的 lastKey 只含 field/sex/after23/timeAlg → 不强制重算则改值后盘面纹丝不动(用户核心诉求)。
			// 凡能改变任一子盘(奇门/太乙/六壬)计算结果的 key,改值即 refreshAll(force) 真重算重画;默认值时盘与改前一致(零回归)。
			if(this.state.hasPlotted && SANSHI_RECALC_OPTION_KEYS.has(key)){
				this.refreshAll(this.getActiveFields(), true);
			}
		});
	},

	onAstroFieldOptionChange(key, value){
		// 「新盘种子」:共享盘面字段(宫制)的亲手改动 = 新命盘缺省;三式择日内嵌不记(usesSavedSettings 同一门)
		if(this.usesSavedSettings()){ recordNewChartSeeds({ [key]: value }); }
		this.onOptionChange(key, value);
		this.onFieldsChange({
			[key]: { value },
		}, true);
		const localFields = {
			...this.getActiveFields(),
			[key]: { value },
		};
		this.setState({ localFields });
	},

	// 黄道复合值(回归 / 恒星:ayanāṃśa)→ 同步 zodiacal + siderealAyanamsa,单次请求(避免连续 onOptionChange 因 setState 异步互相覆盖)。
	onAstroZodiacalChange(val){
		const parsed = AstroConst.parseZodiacSelectValue(val);
		if(this.usesSavedSettings()){ recordNewChartSeeds({ zodiacal: parsed.zodiacal, siderealAyanamsa: parsed.siderealAyanamsa }); }
		const options = normalizeKenQimenOptions({
			...(this.state.options || {}),
			zodiacal: parsed.zodiacal,
			siderealAyanamsa: parsed.siderealAyanamsa,
		});
		const patch = {
			zodiacal: { value: parsed.zodiacal },
			siderealAyanamsa: { value: parsed.siderealAyanamsa },
		};
		const localFields = {
			...this.getActiveFields(),
			...patch,
		};
		this.setState({ options, localFields });
		this.onFieldsChange(patch, true);
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
		const fallbackZone = safe(baseFields && baseFields.zone && baseFields.zone.value, '+08:00');
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: normalizeZoneOffset(dt.zone, fallbackZone) },
		};
	},

	clickPlot(){
		if(this.state.loading){
			// [连续进退不丢击](horosa_sanshi_no_drop_step_v1)重算期间的起盘请求不再静默丢弃——
			// 旧行为=丢击:时间控件已步进、盘不跟算,直到用户再补一击(「连续进退卡很久」的真身)。
			// 记队列标记+最后一击时刻,本轮重算落地后经 trailing 静默期补发
			// (latest-wins:pendingTimeFields 持续更新,补发恒最新;连点期间不起中间轮)。
			this.queuedPlotWhileLoading = true;
			this.lastQueuedPlotAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
			return;
		}
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		// 草稿优先:onTimeChanged 每次改时间都把最新时刻写进 pendingTimeFields,而
		//   timeHook.getValue() 读的是注册 hook 的那个控件实例(左栏内联 / 隐藏实例)的 value —— 未起盘时
		//   在弹层里改完直接点「起盘」,它还是旧时刻,此前它排在前面就把草稿盖掉 = 按旧时刻起盘,
		//   与「首盘必须显式点确定 / 起盘」的意图相反。selector 只在没有草稿时兜底。
		const baseFields = this.pendingTimeFields || this.state.localFields || this.props.fields;
		const timeFields = this.pendingTimeFields || this.getTimeFieldsFromSelector(baseFields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const curFields = this.props.fields || {};
		const patchFields = {};
		const patchRaw = (key)=>{
			if(nextFields[key] && nextFields[key].value !== undefined){
				patchFields[key] = { value: nextFields[key].value };
			}
		};
		const patchDateTime = (key)=>{
			if(nextFields[key] && nextFields[key].value instanceof DateTime){
				patchFields[key] = { value: nextFields[key].value.clone() };
			}
		};
		const maybePatchRaw = (key)=>{
			const nextVal = safe(nextFields[key] && nextFields[key].value);
			const curVal = safe(curFields[key] && curFields[key].value);
			if(nextVal !== curVal){
				patchRaw(key);
			}
		};
		const maybePatchDateTime = (key, format)=>{
			const nextVal = nextFields[key] && nextFields[key].value instanceof DateTime ? nextFields[key].value.format(format) : '';
			const curVal = curFields[key] && curFields[key].value instanceof DateTime ? curFields[key].value.format(format) : '';
			if(nextVal !== curVal){
				patchDateTime(key);
			}
		};
		maybePatchDateTime('date', 'YYYY-MM-DD HH:mm:ss');
		maybePatchDateTime('time', 'YYYY-MM-DD HH:mm:ss');
		maybePatchRaw('ad');
		maybePatchRaw('zone');
		maybePatchRaw('lon');
		maybePatchRaw('lat');
		maybePatchRaw('gpsLon');
		maybePatchRaw('gpsLat');
		maybePatchRaw('zodiacal');
		maybePatchRaw('hsys');
		maybePatchRaw('gender');
		// 时间算法只作用于本页(本页计算读 options / 本页 fields 里的 timeAlg):不写共用字段,否则紫微 / 七政等跟着变
		const needChartSync = Object.keys(patchFields).length > 0;
		this.prefetchNongliForFields(nextFields);
		this.prefetchJieqiSeedForFields(nextFields);
		this.awaitingChartSync = false;
		if(needChartSync){
			this.syncFields(patchFields);
			this.onFieldsChange(patchFields, {
				silentRequest: true,
				nohook: true,
			});
			this.awaitingChartSync = true;
			if(this.awaitingSyncTimer){
				clearTimeout(this.awaitingSyncTimer);
				this.awaitingSyncTimer = null;
			}
			// [不等 /chart 回流](horosa_sanshi_no_wait_chart_v1)旧行为=等 chartObj 回流触发
			// didUpdate 快路径、1200ms timer 兜底——实测回流常缺席,每步硬吃满 1.2s(连续进退
			// 「卡很久」的最大单项)。chartObj 只供 isDiurnal(昼夜贵人)与外圈联动,不值硬等:
			// 立即用现值起算;回流后 didUpdate 仍会 refreshAll(force)——recalcSignature 含
			// isDiurnal/outerChartKey,没变=签名去重瞬时 no-op,真变(跨昼夜界/外圈)=自动校正重算。
			this.refreshAll(nextFields, true);
		}
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
			plottedFields: nextFields,
			loading: needChartSync ? true : this.state.loading,
		}, ()=>{
			this.pendingTimeFields = null;
			if(needChartSync){
				return;
			}
			this.refreshAll(nextFields, true);
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
		// 🔑 刷新左栏显示(localFields)+ 实时重算(silent fetchByFields):改地点/时区即重排三式
		Object.assign(geoPatch, geoNameFieldPatch(rec));
		this.setState({ localFields: { ...base, ...geoPatch } });
		this.onFieldsChange(geoPatch, true);
	},

	// 外圈坐标缓存必须按「当前所选坐标」校验:此前三条快照路径只看 `outerDataCache.data`
	// 在不在,而重建只发生在 performRecalcByNongli 内、且重算签名不含 outerCoord(点「起盘」也被去重拦下)
	// → 切到赤道后,存档与导出刷新拿的还是黄道那份,「星盘:」行不带「(赤经)」且地支与中栏不符。
	currentOuterData(astroChart){
		const coord = this.outerCoordCacheKey();   // 赤道分宫另带上升取法
		if(this.outerDataCache && this.outerDataCache.data && this.outerDataCache.coord === coord){
			return this.outerDataCache.data;
		}
		return buildOuterData(astroChart, this.state.outerCoord || 'ecliptic', this.state.ascRaMode);
	},

	// 外圈缓存键:赤道分宫另带上升取法(两档地支可能不同);黄道不读上升赤经,键与旧版同
	outerCoordCacheKey(){
		const coord = this.state.outerCoord || 'ecliptic';
		return coord === 'equatorial' ? `${coord}:${normalizeAscRaMode(this.state.ascRaMode)}` : coord;
	},

	onAscRaModeChange(mode){
		const m = normalizeAscRaMode(mode);
		if(this.usesSavedSettings()){ SANSHI_PAGE_SETTINGS.save({ ascRaMode: m }); }
		this.setState({ ascRaMode: m }, ()=>{
			if(!this._lastSnapshotPayload){ return; }
			const chartWrap = this.state.castChart;
			const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
			const outerData = this.currentOuterData(astroChart);
			this.outerDataCache = { ...(this.outerDataCache || {}), coord: this.outerCoordCacheKey(), data: outerData };
			this.scheduleSnapshotSave({ ...this._lastSnapshotPayload, outerData }, this._lastSnapshotMeta);
		});
	},

	// 外圈切换:中栏本就按新坐标重绘,这里另把快照补拍一次(重算是纯本地 buildOuterData,
	// 不发请求),否则实时挂载快照要等到下一次时间/盘变化才跟上。
	onOuterCoordChange(coord){
		if(this.usesSavedSettings()){ SANSHI_PAGE_SETTINGS.save({ outerCoord: coord }); }
		this.setState({ outerCoord: coord }, ()=>{
			if(!this._lastSnapshotPayload){ return; }
			const chartWrap = this.state.castChart;
			const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
			const outerData = this.currentOuterData(astroChart);
			this.outerDataCache = { ...(this.outerDataCache || {}), coord: this.outerCoordCacheKey(), data: outerData };
			this.scheduleSnapshotSave({ ...this._lastSnapshotPayload, outerData }, this._lastSnapshotMeta);
		});
	},
};
