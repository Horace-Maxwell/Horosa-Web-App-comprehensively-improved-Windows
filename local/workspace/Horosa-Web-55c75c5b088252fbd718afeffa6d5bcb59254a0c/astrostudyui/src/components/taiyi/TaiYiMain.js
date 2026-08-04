import { Component, createRef } from 'react';
import { message, Spin } from 'antd';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { fetchPreciseNongli } from '../../utils/preciseCalcBridge';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { geoNameFieldPatch } from '../../utils/geoName';
import { resolveGeoZone } from '../../utils/timezone';
import XQIcon from '../xq-icons';
import { computeTaiyiShuli, shuliTone } from './core/taiyiShuli';
import { computeGeju } from './core/taiyiGeju';
import { computeVictory, computeFenye, computeShenSuan, computeTaisuiAlias, TAIYI_GONG_INFO, activeDoorJixiong, computeEhui, shenMeaning, computeSanyuan, computeLimitYun, computeShiJing, computeWuziyuan, computeHeShen } from './core/taiyiDuanfa';
import { computeTaiyiNayin } from './core/taiyiNayin';
import { applyTaiyiSchool, DEFAULT_TAIYI_SCHOOL, TAIYI_SCHOOL_OPTIONS, normalizeTaiyiSchool, dunOfKook } from './core/taiyiSchool';
import {
	STYLE_OPTIONS,
	METHOD_OPTIONS,
	TIME_BASIS_OPTIONS,
	DAY_SWITCH_OPTIONS,
	GAME_THEORY_OPTIONS,
	fetchTaiyiPan,
	buildTaiyiSnapshotText,
	getStyleLabel,
	getMethodLabel,
	getMethodSource,
} from './TaiYiCalc';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { chartDrawGuardEnabled, stepPrefetchEnabled, kentangCacheEnabled, stepSelectPrefetchEnabled } from '../../utils/perfFlags';
// R4-B2(horosa_prefetch_registry_v1):太乙 stage-1 步进预取登记。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

const { Option } = Select;
const { TabPane } = Tabs;
const LAYER2_NUMS = ['二', '七', '六', '一', '八', '三', '四', '九'];
const LAYER3_BRANCH_GUA = ['午', '未', '坤', '申', '酉', '戌', '乾', '亥', '子', '丑', '艮', '寅', '卯', '辰', '巽', '巳'];
// 按 12地支+4卦固定分野（从午位开始顺时针）
// 午大威，子地主
// 🔴 索引 1–7 曾整体错位一位(「大义」被塞到未位,把天道…阴德逐格挤下,亥位丢「大义」);
// 标准序=单一真值表(地主子/阳德丑/和德艮/吕申寅/高丛卯/太阳辰/大炅巽/大神巳/大威午/
// 天道未/大武坤/武德申/太簇酉/阴主戌/阴德乾/大义亥),按 LAYER3 支序(自午起)排列。
const LAYER4_FIXED = ['大威', '天道', '大武', '武德', '太簇', '阴主', '阴德', '大义', '地主', '阳德', '和德', '吕申', '高丛', '太阳', '大炅', '大神'];
const TAIYI_FONT = '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif';
const PRECISE_NONGLI_TIMEOUT_MS = 3500;

function withTimeout(promise, timeoutMs) {
	return Promise.race([
		promise,
		new Promise((resolve) => {
			setTimeout(() => resolve(null), timeoutMs);
		}),
	]);
}

// —— R4-B3:太乙 stage-1(/nongli/time)构参的模块级纯函数(组件 genParams 纯委托)。
//    抽出来的唯一目的:预热要在【组件之外】构出与首点逐字节同键的 body。语义逐字节不变。
function buildTaiYiNongliParamsPure(flds, options) {
	if (!flds) {
		return null;
	}
	const opts = options || {};
	return {
		date: flds.date.value.format('YYYY-MM-DD'),
		time: flds.time.value.format('HH:mm:ss'),
		ad: (flds.ad && flds.ad.value !== undefined) ? flds.ad.value : (flds.date.value.ad || 1),
		zone: flds.zone.value,
		lon: flds.lon.value,
		lat: flds.lat.value,
		gpsLat: flds.gpsLat.value,
		gpsLon: flds.gpsLon.value,
		gender: flds.gender.value,
		after23NewDay: opts.after23NewDay || 0,
	};
}

// R4-B3(数据层空闲预热):太乙 stage-1 = /nongli/time(确定性历法计算)。
// after23NewDay 取 defaultAfter23NewDay() —— 与组件构造时 state.options 的初值同一口径,
// 故 key/body 与用户首点逐字节一致。
// 🔴 绝不预热 /taiyi/pan:它吃 stage-1 结果 + 组件态(积年/流派),提前构不出同键。
// silent(fetchPreciseNongli 内置)、丢结果、绝不 dispatch/setState;失败静默。
export async function warmTaiYiStage1(fields) {
	try {
		if (!fields || !fields.date || !fields.date.value || !fields.date.value.format) {
			return null;
		}
		const params = buildTaiYiNongliParamsPure(fields, { after23NewDay: defaultAfter23NewDay() });
		if (!params) {
			return null;
		}
		return await fetchPreciseNongli(params);
	} catch (e) {
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}

class TaiYiMain extends Component {
	constructor(props) {
		super(props);

		this.state = {
			loading: false,
			nongli: null,
			pan: null,
			options: {
				style: 3,
				tn: 0,
				sex: '男',
				timeBasis: 'direct',
				after23NewDay: defaultAfter23NewDay(),
				lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
				gameTheory: 0,
				school: { ...DEFAULT_TAIYI_SCHOOL },
				showBoardMark: false, // 盘面标注(分野/落宫高亮/主客标记/格局连线/点击)默认关→盘面简洁不被灰字标注/连线压住;左栏可手动开
			},
			rightPanelTab: 'overview',
			schoolOverrides: null,
			selectedPalace: null,
		};

		this.unmounted = false;
		this.timeHook = {};
		this.taiyiRequestSeq = 0;
		// 格局缓存(单槽,按 pan 引用):render() 内 computeGeju(pan) 被调 3 次(格局连线 + 点击面板筛选 + 右栏 geju),
		// 切右栏 tab/选宫/开关标注等任意 setState 重渲都把这纯函数重算 3 遍。pan 是后端每次起盘返回的新对象,
		// 引用稳定即结果稳定;按引用缓存 → 同 pan 只算一次、跨重渲复用(byte-perfect:同输入同输出)。
		this._gejuCache = null;
		this.gejuOf = this.gejuOf.bind(this);
		// 顶部遮挡兜底:实测盘面可视盒,svg 用显式像素钳进盒内(见 componentDidMount 的 measure)。
		this.boardHostRef = createRef();
		this.boardSize = null;
		this.boardObserver = null;
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if (this.props.hook) {
			this.props.hook.fun = (fields) => {
				if (this.unmounted) {
					return;
				}
				this.requestNongli(fields || this.props.fields);
			};
			// R4-B3(A6):太乙同为【两段式】—— stage-1(/nongli/time)先回来盘才能推。
			// 与主 /chart 无关,在 /chart 返回之前并行发出即把 stage-1 摘出关键路径
			// (latency sum→max)。闸:horosa.perf.prewarmRequests(关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds) => {
				if (this.unmounted) {
					return;
				}
				try {
					const params = this.genParams(flds || this.props.fields);
					if (params) {
						fetchPreciseNongli(params).catch(() => { /* 预热静默 */ });
					}
				} catch (e) { /* 预热失败无害 */ }
			};
			// R4-B2(horosa_prefetch_registry_v1):只登记 stage-1(/nongli/time,确定性历法计算)。
			// 🔴 绝不预取 /taiyi/pan:它吃 stage-1 结果 + 组件态(积年/局数流派),提前构不出同键。
			if (stepPrefetchEnabled()) {
				this._taiyiStepPrefetcher = (steppedFields) => {
					if (this.unmounted || !steppedFields) {
						return [];
					}
					let params = null;
					try {
						params = this.genParams(steppedFields);
					} catch (e) {
						return [];
					}
					if (!params) {
						return [];
					}
					return [{
						name: 'taiyi:nongli',
						path: '/nongli/time',
						run: () => fetchPreciseNongli(params),
					}];
				};
				registerStepPrefetcher('taiyi', this._taiyiStepPrefetcher);
			}
		}
	}


	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 详 wrapperPropsEqual;开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲
	// (setState 恒换引用)。收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}
	componentDidMount() {
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再覆盖
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				if(this._after23BoundaryUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && typeof this.onOptionChange === 'function'){
					this.onOptionChange('after23NewDay', v, { fromGlobal: true });
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(this._lateZiHourUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && typeof this.onOptionChange === 'function'){
					this.onOptionChange('lateZiHourUseNextDay', v, { fromGlobal: true });
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 顶部遮挡兜底(双保险):无论哪层容器样式失配,svg 元素都不大于「实测可视盒 ∩ 视口」,
		// meet 模式下视觉等价但顶部(农历行)永不被裁。canvas 在首帧可能尚未渲染(pan 未回来),
		// 故 didMount/didUpdate 都尝试挂载(只挂一次)。
		this.ensureBoardObserver();
		if (this.restoreFromCurrentCase(true)) {
			return;
		}
		if (this.props.fields) {
			this.requestNongli(this.props.fields);
		}
	}

	componentDidUpdate(prevProps) {
		this.ensureBoardObserver();
		if (prevProps.fields !== this.props.fields && this.props.fields) {
			if (this.restoreFromCurrentCase(false)) {
				return;
			}
			this.requestNongli(this.props.fields);
		}
	}

	ensureBoardObserver(){
		if(this.unmounted){
			return;
		}
		if(typeof window === 'undefined' || typeof window.ResizeObserver !== 'function' || !this.boardHostRef.current){
			return;
		}
		const el = this.boardHostRef.current;
		// loading/Spin 切换会重建 canvas 子树 → ref 指向新元素而 observer 还盯着旧节点(永不再触发)。
		// 每次 didUpdate 校验观察目标,变了就换绑并立即量一次。
		if(this.boardObserver && this.boardObservedEl === el){
			return;
		}
		const measure = ()=>{
			try{
				const node = this.boardHostRef.current;
				if(!node){
					return;
				}
				const r = node.getBoundingClientRect();
				const w = Math.min(r.width, (window.innerWidth || r.width) - r.left);
				const h = Math.min(r.height, (window.innerHeight || r.height) - r.top);
				if(w > 0 && h > 0 && (!this.boardSize || Math.abs(this.boardSize.w - w) > 2 || Math.abs(this.boardSize.h - h) > 2)){
					this.boardSize = { w, h };
					if(!this.unmounted){
						this.forceUpdate();
					}
				}
			}catch(e){
				// 测量失败维持现状(CSS 100%)
			}
		};
		this.boardMeasure = measure;
		if(!this.boardObserver){
			this.boardObserver = new window.ResizeObserver(measure);
		}
		if(this.boardObservedEl){
			try{ this.boardObserver.unobserve(this.boardObservedEl); }catch(e){ /* 旧节点可能已脱离 */ }
		}
		this.boardObserver.observe(el);
		this.boardObservedEl = el;
		// window resize 直连兜底:RO 盯的元素若被父级重建(无 React 更新可触发重绑)会失联,
		// window 级监听永不失联——先重绑再量当前 ref。
		if(!this._boardWindowResize){
			this._boardWindowResize = ()=>{
				this.ensureBoardObserver();
				if(this.boardMeasure){
					this.boardMeasure();
				}
			};
			window.addEventListener('resize', this._boardWindowResize);
		}
		measure();
	}

	componentWillUnmount() {
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._taiyiStepPrefetcher){
			try{ unregisterStepPrefetcher('taiyi', this._taiyiStepPrefetcher); }catch(e){ /* ignore */ }
			this._taiyiStepPrefetcher = null;
		}
		if(this.boardObserver){
			this.boardObserver.disconnect();
			this.boardObserver = null;
		}
		if(typeof window !== 'undefined' && this._boardWindowResize){
			window.removeEventListener('resize', this._boardWindowResize);
			this._boardWindowResize = null;
		}
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」,Win 用户实测)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'taiyi'){
			return;
		}
		const pan = this.state ? this.state.pan : null;
		if(!pan){
			return;
		}
		const snapshotText = `${buildTaiyiSnapshotText(pan) || ''}`.trim();
		if(snapshotText){
			saveModuleAISnapshot('taiyi', snapshotText);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = snapshotText;
			}
		}
	}

	onFieldsChange(field) {
		if (this.props.dispatch) {
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	onTimeChanged(value) {
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
			// [R3-A2] 步进方向提示透传:驱动 astro model settle 后 /chart ±步预取
			// (fetchByFields 消费后即剥离,绝不落 state.fields)
			...(value.step ? { __stepHint: value.step } : {}),
		});
		// [R3-A4] 顺向 +1 步 pan 预取:太乙是「时间变更即重排」流,当前步 T 的 pan 由正式
		// 请求落 kentangCache;此处再静默备下 T+1 —— 连点下一下也命中 ≈ 瞬间。
		this.prefetchNextStepPan(dt, value.step);
	}

	// [R3-A4] 与真实链同源:genParams→fetchPreciseNongli→fetchTaiyiPan(同一 builder,
	// 键逐字节等);失败静默,结果只落 kentangCache。防抖 150ms(连点只备最后方向)。
	prefetchNextStepPan(dt, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){
				return;
			}
			if(!stepHint || !stepHint.dir || !dt || typeof dt.clone !== 'function'){
				return;
			}
			if(this.prefetchStepTimer){
				clearTimeout(this.prefetchStepTimer);
			}
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){
					return;
				}
				this._prefetchPanAtStep(dt, stepHint.unit || 'm', stepHint.dir, 1);
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	}

	// 取数内核:以 dt 为基按 unit 走 k 步×dir,同源构参预取该时刻 pan(nongli→pan 链)。
	// prefetchNextStepPan(+1 同向)与 prefetchStepSelect(±1 双向)共用,防两处步进加法漂移。
	_prefetchPanAtStep(dt, unit, dir, k){
		try{
			const dt2 = dt.clone();
			for(let i = 0; i < (k || 1); i += 1){
				if(unit === 'y'){ dt2.addYear(dir); }
				else if(unit === 'M'){ dt2.addMonth(dir); }
				else if(unit === 'd'){ dt2.addDate(dir); }
				else if(unit === 'h'){ dt2.addHour(dir); }
				else { dt2.addMinute(4 * dir); }
			}
			const flds2 = {
				...(this.props.fields || {}),
				date: { value: dt2.clone() },
				time: { value: dt2.clone() },
				ad: { value: dt2.ad },
				zone: { value: dt2.zone },
			};
			const params = this.genParams(flds2);
			if(!params){ return; }
			fetchPreciseNongli(params).then((nongli)=>{
				if(this.unmounted){ return null; }
				return fetchTaiyiPan(flds2, nongli, this.state.options);
			}).catch(()=>null);
		}catch(e){ /* 预取失败无害 */ }
	}

	// [R3-A1 下放] 选步长即预取:太乙时间自持(localFields),全局 handler 对本页是错键 ——
	// 以当前时间为基 ±1 双向预热 pan(第一下步进即命中;第二下起 settle 链 +1 同向接管)。
	prefetchStepSelect(unit){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled() || !stepSelectPrefetchEnabled() || !unit){
				return;
			}
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			const flds = this.getTimeFieldsFromSelector(this.props.fields) || this.state.localFields || this.props.fields || {};
			const dt = flds.date && flds.date.value;
			if(!dt || typeof dt.clone !== 'function'){ return; }
			this._prefetchPanAtStep(dt, unit, 1, 1);
			this._prefetchPanAtStep(dt, unit, -1, 1);
		}catch(e){ /* 预取失败无害 */ }
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		const patch = {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		return {
			...(baseFields || {}),
			...patch,
		};
	}

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		if(nextFields.date && nextFields.time && nextFields.zone){
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
		}
		this.requestNongli(nextFields);
	}

	// 快捷栏契约:「此刻起局」:局时=当下并立即重排,绕过左栏时间草稿(点「此刻」即要 NOW)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动;左栏跟显靠 onFieldsChange 受控回流。
	clickPlotNow(){
		const base = this.props.fields;
		if(!base){
			return;
		}
		const now = new DateTime();
		const patch = {
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		};
		this.onFieldsChange(patch);
		this.requestNongli({ ...base, ...patch });
	}

	onGenderChange(val) {
		this.onOptionChange('sex', val === 0 ? '女' : '男');
		this.onFieldsChange({
			gender: { value: val },
		});
	}

	changeGeo(rec) {
		const payload = {
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		};
		// 选地点 → 时区自动校正 + 重锚 date/time 到新时区(clone+setZone:保留钟面时刻、瞬时随之偏移);
		// 否则排盘仍用 date 实例残留的旧时区算瞬时/真太阳时。手动改过时区则沿用 rec.zone。
		const f = this.props.fields || {};
		const dDt = f.date && f.date.value;
		const tDt = f.time && f.time.value;
		const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
		const z = resolveGeoZone(rec, ds);
		if(z){
			payload.zone = { value: z };
			if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); payload.date = { value: nd }; payload.ad = { value: nd.ad }; }
			if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); payload.time = { value: nt }; }
		}
		Object.assign(payload, geoNameFieldPatch(rec));
		this.onFieldsChange(payload);
	}

	genParams(fields) {
		// R4-B3:构造原样抽为模块级纯函数(预热复用同一路径 ⇒ key/body 逐字节一致);
		// 本方法保持既有签名与 props 兜底语义,纯委托零行为变化。
		return buildTaiYiNongliParamsPure(fields || this.props.fields, this.state.options);
	}

	async recalc(fields, nongli, options) {
		const reqSeq = ++this.taiyiRequestSeq;
		const nextFields = fields || this.props.fields;
		const nextNongli = nongli || this.state.nongli;
		const nextOptions = options || this.state.options;
		if(!nextFields){
			return;
		}
		this.setState({ loading: true });
		let pan = null;
		try{
			pan = await fetchTaiyiPan(nextFields, nextNongli, nextOptions);
		}catch(e){
			console.warn('kintaiyi backend failed', e);
			pan = null;
			if(!this.unmounted && reqSeq === this.taiyiRequestSeq){
				message.error('太乙计算失败：本地太乙服务不可用');
			}
		}
		if(this.unmounted || reqSeq !== this.taiyiRequestSeq){
			return;
		}
		// P1 流派覆盖层:以 kintaiyi base pan 为底,按所选流派开关覆盖受影响神煞 + 几何重算主客算(默认=空操作,字节不变)。
		const ov = pan ? applyTaiyiSchool(pan, nextOptions.school) : { pan, overrides: null };
		const displayPan = ov.pan || pan;
		this.setState({ pan: displayPan, schoolOverrides: ov.overrides, selectedPalace: null, loading: false }, () => {
			// horosa_panel_ready_v1:太乙面板(中栏盘 + 右栏六页签)全部数据来自这一个 pan,
			// 故本次 setState 落定 = 中栏+右栏画完。双 rAF 由 markPanelReady 内部完成。
			markPanelReady('taiyi');
			if (displayPan) {
				saveModuleAISnapshotLazy('taiyi', ()=>buildTaiyiSnapshotText(displayPan));
			}
		});
	}

	setRightPanelTab(key) {
		this.setState({
			rightPanelTab: key,
		});
	}

	navigateFeature(tabKey, subTab) {
		if (this.props.dispatch) {
			const payload = {
				currentTab: tabKey,
			};
			if (subTab) {
				payload.currentSubTab = subTab;
			}
			this.props.dispatch({
				type: 'astro/save',
				payload,
			});
		}
	}

	async requestNongli(fields) {
		const params = this.genParams(fields);
		if(!params){
			return;
		}
		this.setState({ loading: true });
		if (this.unmounted) {
			return;
		}
		let nongli = null;
		try {
			nongli = await withTimeout(fetchPreciseNongli(params), PRECISE_NONGLI_TIMEOUT_MS);
		} catch (e) {
			console.warn('taiyi precise nongli failed, continuing with kintaiyi calendar fields', e);
		}
		if (this.unmounted) {
			return;
		}
		this.setState({ nongli });
		await this.recalc(fields || this.props.fields, nongli, this.state.options);
	}

	onOptionChange(key, value, opts) {
		// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。fromGlobal 时不打标记。
		if(key === 'after23NewDay' && !(opts && opts.fromGlobal)){
			this._after23BoundaryUserOverrode = true;
		}
		const options = {
			...this.state.options,
			[key]: value,
		};
		this.setState({ options }, () => {
			this.recalc(this.props.fields, this.state.nongli, options);
		});
	}

	restoreFromCurrentCase(force) {
		const saved = getKentangSavedCasePayload('taiyi');
		if (!saved || !saved.payload) {
			return false;
		}
		if (!force && this.lastRestoredCaseId === saved.caseVersion) {
			return false;
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.taiyiRequestSeq += 1;
		this.setState({
			loading: false,
			options: {
				...this.state.options,
				...options,
			},
			nongli: payload.nongli || null,
			pan: payload.pan || null,
			rightPanelTab: 'overview',
		}, () => {
			if (this.state.pan) {
				const pan = this.state.pan;
				saveModuleAISnapshotLazy('taiyi', ()=>buildTaiyiSnapshotText(pan));
			}
		});
		return true;
	}

	clickSaveCase() {
		if (!this.state.pan) {
			message.warning('请先起盘后再保存');
			return;
		}
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'taiyi',
			label: '太乙',
			payload: {
				options: this.state.options,
				nongli: this.state.nongli,
				pan: this.state.pan,
				snapshot: buildTaiyiSnapshotText(this.state.pan),
			},
		});
	}

	polarPoint(cx, cy, r, angleDeg) {
		const rad = angleDeg * Math.PI / 180;
		return {
			x: cx + r * Math.cos(rad),
			y: cy + r * Math.sin(rad),
		};
	}

	// 命法十二宫独立盘(style=5):后端 taiyi_life 数据全现成,纯渲染。与事盘同族(同 token/字体/viewBox 防裁切)。
	// 十二命宫环:命宫金框高亮、身宫次高亮;各宫落神 + 飛祿/飛馬/黑符 markers;中宫命身+性别;底栏行限/年卦月卦。
	renderLifeBoard() {
		const pan = this.state.pan;
		if (!pan) {
			return <div className="horosa-taiyi-empty horosa-taiyi-board-empty">暂无太乙命法盘数据</div>;
		}
		// 4×4 方格布局(十二宫命盘标准式):每宫独立矩形格,宫名/地支/落神竖排分层,中宫 2×2 放命身信息;
		// 彻底消除环形放射的径向文字互相遮挡。地支按传统命盘格位固定(巳午未申 / 辰□□酉 / 卯□□戌 / 寅丑子亥)。
		const W = 720, H = 720, cell = W / 4;   // 每格 180×180
		const stroke = 'var(--horosa-border-strong, #4a4335)';
		const gridLine = 'var(--horosa-border, rgba(150,140,110,0.4))';
		const gold = 'var(--horosa-accent, #d7ad69)';
		const DI_ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
		// 地支→[row,col](传统命盘格位;中央 2×2 留作中宫)
		const GRID = { 巳: [0, 0], 午: [0, 1], 未: [0, 2], 申: [0, 3], 酉: [1, 3], 戌: [2, 3], 亥: [3, 3], 子: [3, 2], 丑: [3, 1], 寅: [3, 0], 卯: [2, 0], 辰: [1, 0] };
		const boardViewBox = `-6 -6 ${W + 12} ${H + 12}`;
		// 十二命宫排列:后端序列化为「子命宮、丑兄弟、…」串 → 解析 地支→宫名。
		const arrStr = this.getSectionValue('十二命宫', '') || this.getSectionValue('十二命宮排列', '');
		const gongOfZhi = {};
		String(arrStr).split(/[、,，]/).forEach((tok) => { const t = tok.trim(); if (t.length >= 2 && DI_ZHI.indexOf(t.charAt(0)) >= 0) { gongOfZhi[t.charAt(0)] = t.slice(1); } });
		const mingZhi = this.getSectionValue('命宫', '') || this.getSectionValue('安命宮', '');
		const shenZhi = this.getSectionValue('身宫', '') || this.getSectionValue('安身宮', '');
		const feiLu = this.getSectionValue('飞禄', '') || this.getSectionValue('飛祿', '');
		const feiMa = this.getSectionValue('飞马', '') || this.getSectionValue('飛馬', '');
		const heiFu = this.getSectionValue('黑符', '');
		const nianGua = this.getSectionValue('年卦', ''), yueGua = this.getSectionValue('月卦', '');
		const sexLabel = (pan.options && pan.options.sexLabel) || pan.sex || '';
		const zao = pan.zhao || (String(sexLabel).indexOf('女') >= 0 ? '坤造' : '乾造');
		const branchItems = {};
		(pan.branch12 || []).forEach((b) => { if (b && b.branch) { branchItems[b.branch] = (b.items || []).filter(Boolean); } });
		const boardSvgStyle = { background: 'transparent', textRendering: 'geometricPrecision' };
		const els = [];
		DI_ZHI.forEach((zhi) => {
			const pos = GRID[zhi]; if (!pos) { return; }
			const [r, c] = pos;
			const x = c * cell, y = r * cell;
			const isMing = zhi === mingZhi, isShen = zhi === shenZhi;
			const gname = gongOfZhi[zhi] || '';
			const items = branchItems[zhi] || [];
			// 格底 + 边框(命宫金框金染、身宫淡金染)
			els.push(<rect key={`lb-bg-${zhi}`} x={x} y={y} width={cell} height={cell} fill={(isMing || isShen) ? gold : 'transparent'} fillOpacity={isMing ? 0.13 : (isShen ? 0.06 : 0)} stroke={isMing ? gold : gridLine} strokeWidth={isMing ? 2 : 1} />);
			// 宫名(左上,醒目)
			els.push(<text key={`lb-g-${zhi}`} x={x + 12} y={y + 30} textAnchor="start" dominantBaseline="middle" fill={isMing ? gold : 'var(--horosa-text, #e8e2d2)'} stroke="none" fontSize="19" fontWeight={isMing ? 700 : 560} fontFamily={TAIYI_FONT}>{gname || '　'}</text>);
			// 地支 + 命/身 徽(右上角)
			const badge = isMing && isShen ? '命身' : (isMing ? '命' : (isShen ? '身' : ''));
			els.push(<text key={`lb-z-${zhi}`} x={x + cell - 10} y={y + 26} textAnchor="end" dominantBaseline="middle" fill={badge ? gold : 'var(--horosa-text-muted, #8a8a8a)'} stroke="none" fontSize="14" fontFamily={TAIYI_FONT}>{zhi}{badge ? `·${badge}` : ''}</text>);
			// 落神(左列竖排,每神一行,fontSize 12,至多 5 行不溢格)
			items.slice(0, 5).forEach((it, ii) => {
				els.push(<text key={`lb-s-${zhi}-${ii}`} x={x + 12} y={y + 60 + ii * 20} textAnchor="start" dominantBaseline="middle" fill="var(--horosa-text-soft, #9a8f78)" stroke="none" fontSize="12" fontFamily={TAIYI_FONT}>{String(it).slice(0, 4)}</text>);
			});
			// 飛祿/飛馬/黑符 徽(格底右下角,彩色小药丸)
			const mk = [];
			if (zhi === feiLu) { mk.push(['祿', gold]); }
			if (zhi === feiMa) { mk.push(['馬', 'var(--horosa-info, #4a7fb5)']); }
			if (zhi === heiFu) { mk.push(['符', 'var(--horosa-danger, #c0563a)']); }
			mk.forEach(([lb, col], mi) => {
				const mx = x + cell - 16 - mi * 22, my = y + cell - 16;
				els.push(<circle key={`lb-mk-${zhi}-${mi}`} cx={mx} cy={my} r="9" fill={col} />);
				els.push(<text key={`lb-mkt-${zhi}-${mi}`} x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="none" fontSize="11" fontFamily={TAIYI_FONT}>{lb}</text>);
			});
		});
		// 中宫(2×2 合并格):性别乾坤造 + 命身宫 + 命局 + 年卦月卦,居中竖排。
		const cx0 = W / 2, cy0 = H / 2;
		els.push(<rect key="lb-center-bg" x={cell} y={cell} width={cell * 2} height={cell * 2} fill="var(--horosa-surface-raised, #16140f)" fillOpacity="0.35" stroke={stroke} strokeWidth="1.5" />);
		const centerLines = [`${zao} · ${sexLabel}`, `命宫 ${mingZhi || '—'}　身宫 ${shenZhi || '—'}`, `${pan.kook ? pan.kook.text : '—'}`];
		if (nianGua || yueGua) { centerLines.push(`年卦 ${nianGua || '—'}　月卦 ${yueGua || '—'}`); }
		els.push(<text key="lb-center" x={cx0} y={cy0 - (centerLines.length - 1) * 15} textAnchor="middle" fill="var(--horosa-text, #e8e2d2)" stroke="none" fontSize="17" fontFamily={TAIYI_FONT}>{centerLines.map((t, i) => <tspan key={i} x={cx0} dy={i === 0 ? 0 : 30} fontSize={i === 0 ? 19 : (i >= 2 ? 14 : 16)} fill={i >= 2 ? 'var(--horosa-text-muted, #8a8a8a)' : 'var(--horosa-text, #e8e2d2)'}>{t}</tspan>)}</text>);
		// 外框
		els.push(<rect key="lb-frame" x={0} y={0} width={W} height={H} fill="none" stroke={stroke} strokeWidth="2.5" />);
		return (
			<div className="horosa-taiyi-board-canvas" ref={this.boardHostRef}>
				<div className="horosa-taiyi-board-svg-wrap">
					<svg className="horosa-taiyi-board-svg" viewBox={boardViewBox} preserveAspectRatio="xMidYMid meet" style={boardSvgStyle}>
						{els}
					</svg>
				</div>
			</div>
		);
	}

	renderLeft() {
		const pan = this.state.pan;
		if (!pan) {
			return <div className="horosa-taiyi-empty horosa-taiyi-board-empty">暂无太乙盘数据</div>;
		}
		const width = 860;
		const height = 720;
		const centerX = 430;
		const centerY = 360;
		const r0 = 78;
		const r1 = 124;
		const r2 = 172;
		const r3 = 222;
		const r4 = 304;
		const stroke = 'var(--horosa-border-strong, #111)';
		const textColor = 'var(--horosa-text, #111)';
		const textWeight = '500';
			const palaceInfo = {};
			(pan.palaces || []).forEach((p) => {
				palaceInfo[p.palace] = p.items || [];
			});
			const layer5 = LAYER3_BRANCH_GUA.map((p) => (palaceInfo[p] ? palaceInfo[p].slice(0) : []));
			const pillars = pan && pan.ganzhi ? pan.ganzhi : {};
			const panOptions = pan && pan.options ? pan.options : {};
			const topLeftInfo = [
				`农历：${pan.lunarText || '—'}`,
				`直接时间：${pan.clockTime || '—'}　真太阳时：${pan.realSunTime || '—'}`,
				`年柱：${pillars.year || '—'}　月柱：${pillars.month || '—'}`,
				`日柱：${pillars.day || '—'}　时柱：${pillars.time || '—'}`,
				`节气：${pan.jiedelta || '—'}`,
				`计法：${panOptions.styleLabel || '—'}　古法：${panOptions.methodLabel || panOptions.accumLabel || '—'}`,
				`年号：${pan.reignYear || this.getSectionValue('年號')}`,
				`纪元：${pan.calendarEra || pan.jiyuan || this.getSectionValue('紀元')}`,
			];
			const topMetaX = 14;
			const topMetaY = 4;
			const topMetaLineHeight = 17;
			const topMetaFontSize = 13;
			const bottomRightInfo = [
				`积数:${pan.accNum}`,
				`命式:${pan.zhao}`,
				`局:${pan.kook ? pan.kook.text : ''}`,
				`定算:${pan.setCal}`,
				`主算:${pan.homeCal}`,
			`客算:${pan.awayCal}`,
			`太乙数:${pan.taiyiNum}`,
		];
		// 顶部「农历」行裁切·结构性根治(2026-06-12,用户三度实告):
		// 历史上这里给 svg 加过「按实测可视盒算的显式像素 width/height」想兜底遮挡,但那恰恰是裁切之源——
		// 测量在 flex 布局/窗口缩放下易过期偏大,svg 元素遂超出 wrap,而 wrap align-items:center 居中 +
		// overflow:hidden → 顶部(农历行)被切。彻底删除内联像素覆盖:svg 只靠 viewBox + preserveAspectRatio
		// 'xMidYMid meet' + CSS width/height:100%。meet 的定义即「整个 viewBox 等比缩放至完全装入视口」,
		// svg 元素 == 容器尺寸(100%)永不溢出 → 数学上不可能裁切,宽高比不符时四周留白居中。无需任何 JS 测量。
		const boardSvgStyle = { background: 'transparent', textRendering: 'geometricPrecision' };
		// 第二道硬保险:viewBox 顶部留 24 单位 padding(底部 8)。农历行画在 y=4,几乎贴 viewBox 顶 →
		// meet 缩放后顶部 padding 被压成 ~1px,矮窗下随时可能被亚像素/字体上沿吃掉。把 viewBox 上沿
		// 抬到 -24,农历行上方恒有 28 单位空白,任何缩放比下都映射成肉眼可见的安全余量,绝不贴顶。
		const VB_PAD_TOP = 24;
		const VB_PAD_BOTTOM = 8;
		const boardViewBox = `0 ${-VB_PAD_TOP} ${width} ${height + VB_PAD_TOP + VB_PAD_BOTTOM}`;
		return (
			<div className="horosa-taiyi-board-canvas" ref={this.boardHostRef}>
					<div className="horosa-taiyi-board-svg-wrap">
						<svg
							className="horosa-taiyi-board-svg"
							viewBox={boardViewBox}
							preserveAspectRatio="xMidYMid meet"
							style={boardSvgStyle}
						>
							<circle cx={centerX} cy={centerY} r={r0} fill="none" stroke={stroke} strokeWidth="2.5" />
							<circle cx={centerX} cy={centerY} r={r1} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r2} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r3} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r4} fill="none" stroke={stroke} strokeWidth="2.5" />

								<text
									x={topMetaX}
									y={topMetaY}
									textAnchor="start"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize={topMetaFontSize}
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{topLeftInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_${lineIdx}`} x={topMetaX} dy={lineIdx === 0 ? 0 : topMetaLineHeight}>
											{line}
										</tspan>
									))}
								</text>
								<text
									x={width - 20}
									y={height - 20 - ((bottomRightInfo.length - 1) * 20)}
									textAnchor="end"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize="15"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{bottomRightInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_bottom_${lineIdx}`} x={width - 20} dy={lineIdx === 0 ? 0 : 20}>
											{line}
										</tspan>
									))}
								</text>

							{LAYER2_NUMS.map((_, idx) => {
								const angle = -112.5 + idx * 45;
								const p1 = this.polarPoint(centerX, centerY, r0, angle);
								const p2 = this.polarPoint(centerX, centerY, r1, angle);
								return (
									<line
										key={`l2_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.8"
									/>
								);
							})}

							{LAYER3_BRANCH_GUA.map((_, idx) => {
								const angle = -101.25 + idx * 22.5;
								const p1 = this.polarPoint(centerX, centerY, r1, angle);
								const p2 = this.polarPoint(centerX, centerY, r4, angle);
								return (
									<line
										key={`l345_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.5"
									/>
								);
							})}

								<text
									x={centerX}
									y={centerY - 12}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="48"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									五
							</text>
								<text
									x={centerX}
									y={centerY + 30}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="34"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									中宫
							</text>

							{LAYER2_NUMS.map((txt, idx) => {
								const angle = -90 + idx * 45;
								const p = this.polarPoint(centerX, centerY, (r0 + r1) / 2, angle);
								return (
									<text
										key={`l2_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="36"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER3_BRANCH_GUA.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r1 + r2) / 2, angle);
								return (
									<text
										key={`l3_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="34"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER4_FIXED.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r2 + r3) / 2, angle);
								return (
									<text
										key={`l4_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="23"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{layer5.map((lines, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r3 + r4) / 2, angle);
								const merged = (lines || []).filter(Boolean).slice(0, 3);
								const fontSize = merged.length >= 3 ? 14 : (merged.length === 2 ? 15 : 16);
								const lineHeight = merged.length >= 3 ? 16 : 17;
								const firstDy = -((merged.length - 1) * lineHeight) / 2;
								if (!merged.length) {
									return null;
								}
								return (
									<text
										key={`l5_txt_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize={fontSize}
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
										{merged.map((ln, lnIdx) => (
											<tspan key={`l5_tspan_${idx}_${lnIdx}`} x={p.x} dy={lnIdx === 0 ? firstDy : lineHeight}>
												{ln}
											</tspan>
										))}
									</text>
								);
							})}

							{/* P0-7 盘面增强(由「盘面标注」开关控制):太乙落宫高亮 + 八正宫分野(门·州·绝气) + 文昌/始击主客配色 + 中宫注 */}
							{pan && this.state.options.showBoardMark && (() => {
								const ZHENG_ANGLE = { 午: -90, 坤: -45, 酉: 0, 乾: 45, 子: 90, 艮: 135, 卯: 180, 巽: 225 };
								const ZHENG_NUM = { 午: 2, 坤: 7, 酉: 6, 乾: 1, 子: 8, 艮: 3, 卯: 4, 巽: 9 };
								const ringAngle = (ps) => { const i = LAYER3_BRANCH_GUA.indexOf(ps); return i < 0 ? null : -90 + i * 22.5; };
								const els = [];
								// 正宫落点→绝气(分野底染色)。淡填八正宫扇区,气象一目了然(最底层,opacity 极低不压盘)。
								const QI_FILL = { 绝阳: 'var(--horosa-danger, #c0563a)', 绝阴: 'var(--horosa-info, #4a7fb5)', 绝气: 'var(--horosa-text-muted, #8a8a8a)', 易气: 'var(--horosa-accent, #d7ad69)', 和: 'var(--horosa-ok, #5a9367)' };
								const sectorPath = (ang) => {
									const a0 = ang - 11.25, a1 = ang + 11.25;
									const s1 = this.polarPoint(centerX, centerY, r1, a0), s2 = this.polarPoint(centerX, centerY, r4, a0);
									const s3 = this.polarPoint(centerX, centerY, r4, a1), s4 = this.polarPoint(centerX, centerY, r1, a1);
									return `M${s1.x},${s1.y} L${s2.x},${s2.y} A${r4},${r4} 0 0 1 ${s3.x},${s3.y} L${s4.x},${s4.y} A${r1},${r1} 0 0 0 ${s1.x},${s1.y} Z`;
								};
								Object.keys(ZHENG_ANGLE).forEach((ps) => {
									const info = TAIYI_GONG_INFO[ZHENG_NUM[ps]];
									const col = info && QI_FILL[info.qi];
									if (col) { els.push(<path key={`ty-qi-${ps}`} d={sectorPath(ZHENG_ANGLE[ps])} fill={col} fillOpacity="0.05" stroke="none" />); }
								});
								// 主客配色微染:主方(文昌+主大将正宫)金、客方(始击+客大将)蓝(叠在分野底染之上,opacity 低)。
								const tintSector = (ps, color, key) => { const ang = ringAngle(ps); if (ang === null) { return; } els.push(<path key={key} d={sectorPath(ang)} fill={color} fillOpacity="0.08" stroke="none" />); };
								tintSector(pan.skyeyes, 'var(--horosa-accent, #d7ad69)', 'tint-wc');
								tintSector(pan.homeGeneralPalace, 'var(--horosa-accent, #d7ad69)', 'tint-hg');
								tintSector(pan.sf, 'var(--horosa-info, #4a7fb5)', 'tint-sj');
								tintSector(pan.awayGeneralPalace, 'var(--horosa-info, #4a7fb5)', 'tint-ag');
								const tA = ZHENG_ANGLE[pan.taiyiPalace];
								if (tA !== undefined) {
									const a0 = tA - 11.25, a1 = tA + 11.25;
									const q1 = this.polarPoint(centerX, centerY, r1, a0), q2 = this.polarPoint(centerX, centerY, r4, a0);
									const q3 = this.polarPoint(centerX, centerY, r4, a1), q4 = this.polarPoint(centerX, centerY, r1, a1);
									els.push(<path key="ty-hl" d={`M${q1.x},${q1.y} L${q2.x},${q2.y} A${r4},${r4} 0 0 1 ${q3.x},${q3.y} L${q4.x},${q4.y} A${r1},${r1} 0 0 0 ${q1.x},${q1.y} Z`} fill="var(--horosa-accent, #d7ad69)" fillOpacity="0.14" stroke="var(--horosa-accent, #d7ad69)" strokeWidth="1.5" />);
								}
								Object.keys(ZHENG_ANGLE).forEach((ps) => {
									const info = TAIYI_GONG_INFO[ZHENG_NUM[ps]];
									if (!info) { return; }
									const fyAng = ZHENG_ANGLE[ps];
									const pp = this.polarPoint(centerX, centerY, r4 + 18, fyAng);
									const fyCos = Math.cos(fyAng * Math.PI / 180);
									const fyAnchor = fyCos > 0.35 ? 'start' : (fyCos < -0.35 ? 'end' : 'middle');
									els.push(<text key={`ty-fy-${ps}`} x={pp.x} y={pp.y} textAnchor={fyAnchor} dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="11" fontFamily={TAIYI_FONT}>{`${info.men}·${info.zhou}·${info.qi}`}</text>);
								});
								// 目/将 markers:四目(昌/击/计/定)内环 r4+40、主客大将外环 r4+62,分环避重叠;r=8 小圆+白字。
								const mark = (ps, color, lb, key, rad) => {
									const ang = ringAngle(ps); if (ang === null) { return; }
									const pp = this.polarPoint(centerX, centerY, rad, ang);
									els.push(<circle key={`ty-mk-${key}`} cx={pp.x} cy={pp.y} r="8" fill={color} />);
									els.push(<text key={`ty-mkt-${key}`} x={pp.x} y={pp.y} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="none" fontSize="10.5" fontFamily={TAIYI_FONT}>{lb}</text>);
								};
								mark(pan.skyeyes, 'var(--horosa-accent, #d7ad69)', '昌', 'wc', r4 + 40);
								mark(pan.sf, 'var(--horosa-info, #4a7fb5)', '击', 'sj', r4 + 40);
								mark(pan.jigod, 'var(--horosa-text-muted, #8a8a8a)', '计', 'js', r4 + 40);   // 计神(中性)
								mark(pan.se, 'var(--horosa-text-soft, #6c6c6c)', '定', 'dm', r4 + 40);       // 定目(次要)
								mark(pan.homeGeneralPalace, 'var(--horosa-accent, #d7ad69)', '主', 'hg', r4 + 62);   // 主大将(金·外环)
								mark(pan.awayGeneralPalace, 'var(--horosa-info, #4a7fb5)', '客', 'ag', r4 + 62);     // 客大将(蓝·外环)
								// P1-5 格局连线:太乙↔文昌/始击/主客大将,凶色虚线(掩=同宫描圈,对=长虚线,击=大将连线);「关」为数理关系无落点、不连线。
								const POS_OF = { 太乙: pan.taiyiPalace, 文昌: pan.skyeyes, 始击: pan.sf, 主大将: pan.homeGeneralPalace, 客大将: pan.awayGeneralPalace };
								const boardAngle = (ps) => { const i = LAYER3_BRANCH_GUA.indexOf(ps); return i < 0 ? null : -90 + i * 22.5; };
								this.gejuOf(pan).forEach((g, gi) => {
									const fp = POS_OF[g.from], tp = POS_OF[g.to];
									const fa = boardAngle(fp), ta = boardAngle(tp);
									if (fp == null || tp == null || fa === null || ta === null) { return; }
									const rr = (r1 + r2) / 2;
									if (fp === tp) {
										const c = this.polarPoint(centerX, centerY, rr, fa);
										els.push(<circle key={`gj-${gi}`} cx={c.x} cy={c.y} r="28" fill="none" stroke="var(--horosa-danger, #c0563a)" strokeWidth="2" strokeDasharray="4 3" />);
									} else {
										const a = this.polarPoint(centerX, centerY, rr, fa), b = this.polarPoint(centerX, centerY, rr, ta);
										els.push(<line key={`gj-${gi}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--horosa-danger, #c0563a)" strokeWidth="2" strokeDasharray={g.kind === 'dui' ? '9 5' : '4 3'} />);
									}
								});
								els.push(<text key="ty-zz" x={centerX} y={centerY + 56} textAnchor="middle" dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="13" fontFamily={TAIYI_FONT}>考治不居</text>);
								// 图例(右下角):昌/击/计/定/主/客 markers 释义 + 分野气色。停放 viewBox 右下空白,不压盘面。
								const LEGEND = [['昌', 'var(--horosa-accent, #d7ad69)', '文昌'], ['击', 'var(--horosa-info, #4a7fb5)', '始击'], ['计', 'var(--horosa-text-muted, #8a8a8a)', '计神'], ['定', 'var(--horosa-text-soft, #6c6c6c)', '定目'], ['主', 'var(--horosa-accent, #d7ad69)', '主大将'], ['客', 'var(--horosa-info, #4a7fb5)', '客大将']];
								const lgX = width - 96, lgY0 = 44;
								LEGEND.forEach(([lb, col, desc], li) => {
									const ly = lgY0 + li * 20;
									els.push(<circle key={`lg-c-${li}`} cx={lgX} cy={ly} r="7" fill={col} />);
									els.push(<text key={`lg-l-${li}`} x={lgX} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="none" fontSize="9.5" fontFamily={TAIYI_FONT}>{lb}</text>);
									els.push(<text key={`lg-d-${li}`} x={lgX + 13} y={ly} dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="11" fontFamily={TAIYI_FONT}>{desc}</text>);
								});
								return els;
							})()}

							{/* P1-5 宫位点击(由「盘面标注」开关控制):16 透明命中扇区 + 信息面板(驻神/正间/门州气/格局/主事) */}
							{pan && this.state.options.showBoardMark && (() => {
								const els = [];
								const ZN = { 午: 2, 坤: 7, 酉: 6, 乾: 1, 子: 8, 艮: 3, 卯: 4, 巽: 9 };
								const POS = { 太乙: pan.taiyiPalace, 文昌: pan.skyeyes, 始击: pan.sf, 主大将: pan.homeGeneralPalace, 客大将: pan.awayGeneralPalace, 计神: pan.jigod, 定目: pan.se };
								const sel = this.state.selectedPalace;
								for (let idx = 0; idx < 16; idx++) {
									const a0 = -90 + idx * 22.5 - 11.25, a1 = -90 + idx * 22.5 + 11.25;
									const q1 = this.polarPoint(centerX, centerY, r1, a0), q2 = this.polarPoint(centerX, centerY, r4, a0);
									const q3 = this.polarPoint(centerX, centerY, r4, a1), q4 = this.polarPoint(centerX, centerY, r1, a1);
									const on = sel === idx;
									els.push(<path key={`hit-${idx}`} d={`M${q1.x},${q1.y} L${q2.x},${q2.y} A${r4},${r4} 0 0 1 ${q3.x},${q3.y} L${q4.x},${q4.y} A${r1},${r1} 0 0 0 ${q1.x},${q1.y} Z`} fill={on ? 'var(--horosa-accent, #d7ad69)' : '#ffffff'} fillOpacity={on ? 0.12 : 0} stroke={on ? 'var(--horosa-accent, #d7ad69)' : 'none'} strokeWidth="1.5" style={{ cursor: 'pointer' }} onClick={() => this.setState({ selectedPalace: on ? null : idx })} />);
								}
								if (sel !== null && sel >= 0) {
									const lp = LAYER3_BRANCH_GUA[sel], shen = LAYER4_FIXED[sel], isZ = sel % 2 === 0;
									const info = isZ ? TAIYI_GONG_INFO[ZN[lp]] : null;
									const zhu = (layer5[sel] || []).filter(Boolean);
									const gj = this.gejuOf(pan).filter((g) => POS[g.from] === lp || POS[g.to] === lp);
									const roles = Object.keys(POS).filter((k) => POS[k] === lp);
									const ln = [`${lp}·${shen}（${isZ ? '正宫' : '间神'}）${roles.length ? '  ←' + roles.join('/') : ''}`];
									const sm = shenMeaning(lp);
									if (sm) { ln.push(`主事:${sm}`); }
									if (info) { ln.push(`${ZN[lp]}${info.gua}·${info.men}·${info.zhou}·${info.qi}`); }
									if (zhu.length) { ln.push(`驻神:${zhu.join('、').slice(0, 22)}`); }
									if (gj.length) { ln.push(`格局:${gj.map((g) => g.name).join('、')}`); }
									// 弹窗锚到 viewBox 最底空白条(原 by=height-24-bh 偏上、压住盘面下半);下移到底部并贴左下角,
									// 圆盘在 860×720 里两侧/底部留白处停放,最大化减少对盘面的遮挡(点同宫可关闭)。
									const bw = 320, bh = ln.length * 20 + 16, bx = 10, by = height + VB_PAD_BOTTOM - bh - 4;
									els.push(<rect key="pp-bg" x={bx} y={by} width={bw} height={bh} rx="8" fill="var(--horosa-surface-raised, #16140f)" fillOpacity="0.96" stroke="var(--horosa-accent, #d7ad69)" strokeWidth="1.2" />);
									els.push(<text key="pp-tx" x={bx + 12} y={by + 20} fill="var(--horosa-text, #e8e2d2)" stroke="none" fontSize="14" fontFamily={TAIYI_FONT}>{ln.map((t, i) => <tspan key={i} x={bx + 12} dy={i === 0 ? 0 : 20}>{t}</tspan>)}</text>);
								}
								return els;
							})()}
						</svg>
					</div>
			</div>
		);
	}

	renderInputPanel() {
		const opt = this.state.options;
		const fields = this.props.fields || {};
		const isLifeStyle = opt.style === 5;
		let datetm = new DateTime();
		if (fields.date && fields.time) {
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if (fields.zone) {
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div className="horosa-taiyi-input-stack">
				<div>
					<div className="horosa-side-panel-title">太乙设置</div>
					<div className="horosa-side-panel-subtitle">时间、地点与起盘选项</div>
				</div>

{/* [观象P1] 太乙左栏分段:时间地点(不折叠)/盘式选项(折叠记忆) */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					onStepSelect={this.prefetchStepSelect}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				</XQSideSection>
				<XQSideSection iconName="taiyi" title="盘式选项" storageKey="taiyi.panshi" className="horosa-taiyi-input-section">
					<div className="horosa-taiyi-select-grid">
						<label className="horosa-taiyi-select-field">
							<span>{isLifeStyle ? '命法性别' : '性别'}</span>
							<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={isLifeStyle ? (opt.sex === '女' ? 0 : 1) : (fields.gender ? fields.gender.value : 1)} onChange={this.onGenderChange}>
								{!isLifeStyle && <Option value={-1}>未知</Option>}
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</label>
						<label className="horosa-taiyi-select-field">
							<span>盘式</span>
							<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.style} onChange={(v) => this.onOptionChange('style', v)}>
								{STYLE_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{/* 古法公式(tn)已移入下方「流派设置」分组(算法设置派),此处不再重复 */}
						<label className="horosa-taiyi-select-field">
							<span>时间基准</span>
							<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.timeBasis} onChange={(v) => this.onOptionChange('timeBasis', v)}>
								{TIME_BASIS_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-taiyi-select-field">
							<span>换日</span>
							<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.after23NewDay} onChange={(v) => this.onOptionChange('after23NewDay', v)}>
								{DAY_SWITCH_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{!isLifeStyle && (
							<label className="horosa-taiyi-select-field">
								<span>博弈</span>
								<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.gameTheory} onChange={(v) => this.onOptionChange('gameTheory', v)}>
									{GAME_THEORY_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						)}
							<label className="horosa-taiyi-select-field">
								<span>盘面标注</span>
								<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.showBoardMark ? 1 : 0} onChange={(v) => this.onOptionChange('showBoardMark', v === 1)}>
									<Option value={0}>关(简洁)</Option>
									<Option value={1}>开(分野/高亮/连线/点击)</Option>
								</Select>
							</label>
					</div>
				</XQSideSection>

				{!isLifeStyle && (
					<XQSideSection iconName="taiyi" title="流派设置" storageKey="taiyi.school" className="horosa-taiyi-input-section">
						<div style={{ fontSize: 11, color: 'var(--horosa-text-muted, #8a8a8a)', marginBottom: 4 }}>默认=从盘·字节不变;改则前端古法重算</div>
						<div className="horosa-taiyi-select-grid">
							{/* 古法公式(积年常数派)归流派设置分组;命法style下前面已隐藏本整段 */}
							<label className="horosa-taiyi-select-field">
								<span>古法公式</span>
								<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={opt.tn} onChange={(v) => this.onOptionChange('tn', v)}>
									{METHOD_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
							{[['jishen', '计神方向'], ['wenchang', '文昌重留'], ['keJianChen', '客算间辰'], ['sanji', '三基起宫'], ['youshen', '游神方向'], ['shijiCoord', '始击坐标']].map(([k, label]) => {
								const active = ((opt.school || {})[k] || 'default') !== 'default';
								const isExp = k === 'shijiCoord';
								return (
									<label className="horosa-taiyi-select-field" key={`school-${k}`}>
										<span>{label}{isExp ? <span style={{ marginLeft: 4, fontSize: 10, padding: '0 4px', borderRadius: 6, border: '1px solid var(--horosa-danger, #c0563a)', color: 'var(--horosa-danger, #c0563a)' }} title="始击坐标系二式未核实,实验开关;默认仍从盘,勿据以论断">存疑·待源</span> : null}</span>
										<Select dropdownMatchSelectWidth={false} dropdownClassName="horosa-taiyi-field-dropdown" value={(opt.school || {})[k] || 'default'} onChange={(v) => this.onOptionChange('school', { ...normalizeTaiyiSchool(opt.school), [k]: v })} style={active ? { fontWeight: 600 } : undefined}>
											{TAIYI_SCHOOL_OPTIONS[k].map((it) => <Option key={it.value} value={it.value}>{it.label}</Option>)}
										</Select>
									</label>
								);
							})}
						</div>
					</XQSideSection>
				)}
				<div className="horosa-taiyi-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
					<Button onClick={this.clickSaveCase}>保存</Button>
				</div>
			</div>
		);
	}

	renderInfoRows() {
		const pan = this.state.pan;
		const opt = this.state.options;
		const fields = this.props.fields || {};
		const panOptions = pan && pan.options ? pan.options : {};
		const isLifeStyle = opt.style === 5;
		// P0 纯派生:数理十类/格局/胜负/分野/诸神之算/太岁古名(据 kintaiyi pan,零碰后端 golden)
		const shuli = pan ? computeTaiyiShuli(pan) : null;
		const geju = this.gejuOf(pan);
		const victory = pan ? computeVictory(pan, geju) : null;
		const fenye = pan ? computeFenye(pan) : null;
		const shenSuan = pan ? computeShenSuan(pan) : null;
		const taisuiAlias = pan ? computeTaisuiAlias(pan) : '';
		const doorJx = pan ? activeDoorJixiong(pan) : null;
		const ehui = pan ? computeEhui(pan) : [];
		const limitYun = pan ? computeLimitYun(pan) : null;
		// 手册补齐:纳音/十精/五子元/合神六合(纯派生,零碰后端 golden)
		const nayin = pan ? computeTaiyiNayin(pan) : null;
		const shijing = pan ? computeShiJing(pan) : null;
		const wuziyuan = pan ? computeWuziyuan(pan) : '';
		const heshen = pan ? computeHeShen(pan) : null;
		const calCell = (num, tags) => (
			<span>
				<span style={{ marginRight: 6 }}>{num === undefined || num === null ? '—' : num}</span>
				{(tags || []).map((t, i) => {
					const tone = shuliTone(t);
					const color = tone === 'bad' ? 'var(--horosa-danger, #c0563a)' : tone === 'good' ? 'var(--horosa-accent, #d7ad69)' : 'var(--horosa-text-muted, #8a8a8a)';
					return <span key={i} style={{ display: 'inline-block', fontSize: 11, lineHeight: 1.5, padding: '0 5px', marginRight: 4, borderRadius: 7, border: `1px solid ${color}`, color }}>{t}</span>;
				})}
			</span>
		);
		const fieldTime = fields.date && fields.time
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
			: '—';
		const geo = fields.lon && fields.lat ? `${fields.lon.value} ${fields.lat.value}` : '—';
		const sanyuan = pan ? computeSanyuan(pan) : '';
		// 概览分类成卡片(时空基准/起局/三算胜负/盘面要素/将神与基/风游)，避免一长串平铺。
		const sections = [];
		sections.push({ title: '时空基准', rows: [
			['直接时间', pan ? (pan.clockTime || '—') : '—'],
			['真太阳时', pan ? (pan.realSunTime || '—') : '—'],
			['地点', geo],
			['时间基准', panOptions.timeBasisLabel || '直接时间'],
			['换日', panOptions.daySwitchLabel || '23点算第二天'],
		] });
		if (isLifeStyle) {
			sections.push({ title: '起局·命局', rows: [
				['起盘方式', panOptions.styleLabel || getStyleLabel(opt.style)],
				['历史年号', pan ? (pan.reignYear || this.getSectionValue('年號')) : '—'],
				['太乙纪元', pan ? `${pan.calendarEra || pan.jiyuan || this.getSectionValue('紀元')}${sanyuan ? `·${sanyuan}` : ''}` : '—'],
				['性别', panOptions.sexLabel || opt.sex || '—'],
				['命局', this.getSectionValue('命局', pan && pan.kook ? pan.kook.text : '—')],
				['命宫/身宫', `${this.getSectionValue('安命宮')}/${this.getSectionValue('安身宮')}`],
				['飞禄/飞马', `${this.getSectionValue('飛祿')}/${this.getSectionValue('飛馬')}`],
				['黑符', this.getSectionValue('黑符')],
			] });
			sections.push({ title: '行限', rows: [
				['阳九/百六', `${this.getSectionValue('陽九')}/${this.getSectionValue('百六')}`],
				['阳九行限', this.getSectionValue('陽九行限')],
				['百六行限', this.getSectionValue('百六行限')],
			] });
		} else {
			const dunChar = dunOfKook(pan);
			const dun = dunChar ? `${dunChar}遁` : '—';
			sections.push({ title: '起局', rows: [
				['起盘方式', panOptions.styleLabel || getStyleLabel(opt.style)],
				['历史年号', pan ? (pan.reignYear || this.getSectionValue('年號')) : '—'],
				['太乙纪元', pan ? `${pan.calendarEra || pan.jiyuan || this.getSectionValue('紀元')}${sanyuan ? `·${sanyuan}` : ''}` : '—'],
				['五子元', pan ? (wuziyuan || '—') : '—'],
				['阴阳遁', dun],
				['古法公式', panOptions.methodLabel || panOptions.accumLabel || getMethodLabel(opt.tn)],
				['古法出处', panOptions.methodSource || getMethodSource(opt.tn)],
				['博弈', panOptions.gameTheoryLabel || (opt.gameTheory === 1 ? '开启' : '关闭')],
				['局式', pan ? (pan.kook && pan.kook.text ? pan.kook.text : '—') : '—'],
				['流派', pan && pan._schoolNote ? (<span style={{ color: 'var(--horosa-astro-blue, #7fa8d8)' }} title="左栏「流派设置」非默认;被覆盖神煞与主客算据古法重算">{pan._schoolNote}</span>) : '默认(从盘·字节不变)'],
			] });
			sections.push({ title: '三算·胜负·格局', rows: [
				['主算', pan ? calCell(pan.homeCal, shuli && shuli.home) : '—'],
				['客算', pan ? calCell(pan.awayCal, shuli && shuli.away) : '—'],
				['定算', pan ? calCell(pan.setCal, shuli && shuli.set) : '—'],
				['胜负', pan && victory ? (
					<span title={victory.reasons.join('\n')} style={{ fontWeight: 640, color: victory.side === '主胜' ? 'var(--horosa-accent, #d7ad69)' : victory.side === '客胜' ? 'var(--horosa-danger, #c0563a)' : 'var(--horosa-text-muted, #8a8a8a)' }}>{victory.side}</span>
				) : '—'],
				['格局', pan ? (geju.length ? (
					<span>{geju.map((g, i) => (
						<span key={i} title={g.text} style={{ display: 'inline-block', marginRight: 5, marginBottom: 2, padding: '0 6px', borderRadius: 7, fontSize: 11, lineHeight: 1.6, border: '1px solid var(--horosa-danger, #c0563a)', color: 'var(--horosa-danger, #c0563a)' }}>{g.name}</span>
					))}</span>
				) : '无显著掩迫囚格对') : '—'],
				['值使门', pan && doorJx ? `${doorJx.door}门·${doorJx.jixiong}` : '—'],
				['厄会', pan ? (ehui.length ? (<span style={{ color: 'var(--horosa-danger, #c0563a)' }}>{ehui.join('、')}</span>) : '无厄会') : '—'],
				['限运', pan && limitYun ? `大限太乙临${limitYun.daxian.at}(${limitYun.daxian.span})·小限文昌临${limitYun.xiaoxian.at}(${limitYun.xiaoxian.span})·二限大游${limitYun.erxian.dayou}/小游${limitYun.erxian.xiaoyou}` : '—'],
				['阳九/百六', `${this.getSectionValue('陽九')}/${this.getSectionValue('百六')}`],
			] });
			sections.push({ title: '盘面要素', rows: [
				['太乙', pan ? `${pan.taiyiPalace || '—'}宫` : '—'],
				['文昌', pan ? pan.skyeyes : '—'],
				['始击', pan ? pan.sf : '—'],
				['纳音', pan && nayin ? `${nayin.pillar}柱 ${nayin.ganzhi}·${nayin.nayin}` : '—'],
				['分野', pan && fenye && fenye.taiyi ? `太乙临${fenye.taiyi.gong}${fenye.taiyi.gua}·${fenye.taiyi.zhou}(${fenye.taiyi.men}·${fenye.taiyi.qi})·${fenye.taiyi.omen}${fenye.shiji ? `;始击临${fenye.shiji.gong}${fenye.shiji.gua}·${fenye.shiji.zhou}` : ''}` : '—'],
				['太岁', pan ? `${pan.taishui || '—'}${taisuiAlias ? `(${taisuiAlias})` : ''}` : '—'],
				['合神', pan ? `${pan.hegod || '—'}${heshen && heshen.he ? `(六合${heshen.he})` : ''}` : '—'],
				['计神', pan ? pan.jigod : '—'],
				['定目', pan ? (pan.se || '—') : '—'],
				['飞鸟', pan ? (pan.flybird || '—') : '—'],
			] });
			sections.push({ title: '将神与基', rows: [
				['主大将/参将', pan ? `${pan.homeGeneralPalace || '—'}/${pan.homeVGenPalace || '—'}` : '—'],
				['客大将/参将', pan ? `${pan.awayGeneralPalace || '—'}/${pan.awayVGenPalace || '—'}` : '—'],
				['定大将/参将', pan ? `${pan.setGeneralPalace || '—'}/${pan.setVGenPalace || '—'}` : '—'],
				['君臣民基', pan ? `${pan.kingbase || '—'}/${pan.officerbase || '—'}/${pan.pplbase || '—'}` : '—'],
				['诸神之算', pan && shenSuan ? (
					<span>{Object.keys(shenSuan).map((k, i) => (shenSuan[k] ? (
						<span key={i} title={(shenSuan[k].tags || []).join('、')} style={{ marginRight: 8 }}>{k}<strong style={{ color: 'var(--horosa-accent, #d7ad69)' }}>{shenSuan[k].value}</strong></span>
					) : null))}</span>
				) : '—'],
				['四神/天乙/地乙', pan ? `${pan.fgd || '—'}/${pan.skyyi || '—'}/${pan.earthyi || '—'}` : '—'],
				['直符/飞符', pan ? `${pan.zhifu || '—'}/${pan.flyfu || '—'}` : '—'],
				['五福/帝符/太尊', pan ? `${pan.wufuPalace || '—'}/${pan.kingfu || '—'}/${pan.taijun || '—'}` : '—'],
			] });
			if (pan && shijing) {
				// 十精(今义):二目 + 八将,有序 10 项。角色着色:目=金、将=蓝、基=中性。
				sections.push({ title: '十精(二目·八将)', rows: [
					['十精', (
						<span>{shijing.map((it, i) => {
							const color = it.role === '目' ? 'var(--horosa-accent, #d7ad69)' : it.role === '将' ? 'var(--horosa-astro-blue, #7fa8d8)' : 'var(--horosa-text-muted, #8a8a8a)';
							return <span key={i} style={{ display: 'inline-block', fontSize: 11, lineHeight: 1.7, padding: '0 6px', marginRight: 4, marginBottom: 3, borderRadius: 7, border: `1px solid ${color}`, color }}>{it.name}·{it.at}</span>;
						})}</span>
					)],
				] });
			}
			sections.push({ title: '风游', rows: [
				['三风/五风/八风', pan ? `${this.formatWindValue('threewind')}/${this.formatWindValue('fivewind')}/${this.formatWindValue('eightwind')}` : '—'],
				['大游/小游', pan ? `${this.formatWindValue('bigyo')}/${this.formatWindValue('smyo')}` : '—'],
			] });
		}
		return sections.map((sec) => (
			<div className="horosa-taiyi-info-card horosa-taiyi-section-card" key={sec.title}>
				<div className="horosa-taiyi-info-heading">{sec.title}</div>
				{sec.rows.map(([label, value]) => (
					<div className="horosa-taiyi-info-row" key={label}>
						<span>{label}</span>
						<strong>{value}</strong>
					</div>
				))}
			</div>
		));
	}

	formatWindValue(prefix) {
		const pan = this.state.pan;
		if (!pan) {
			return '—';
		}
		const palaceKey = `${prefix}Palace`;
		const numKey = `${prefix}Num`;
		const palace = pan[palaceKey] || '—';
		const num = pan[numKey];
		return num ? `${palace}(${num})` : palace;
	}

	getSectionValue(sourceKey, fallback = '—') {
		const pan = this.state.pan;
		const sections = pan && pan.sections ? pan.sections : [];
		for (let i = 0; i < sections.length; i += 1) {
			const rows = sections[i].rows || [];
			for (let j = 0; j < rows.length; j += 1) {
				if (rows[j].sourceKey === sourceKey || rows[j].label === sourceKey) {
					return this.formatDisplayValue(rows[j].value);
				}
			}
		}
		return fallback;
	}

	hasSectionTitles(titles) {
		const pan = this.state.pan;
		const sections = pan && pan.sections ? pan.sections : [];
		const titleSet = new Set(titles);
		return sections.some((section) => titleSet.has(section.title));
	}

	renderPalaceRows() {
		const pan = this.state.pan;
		if (!pan || !pan.palace16) {
			return <div className="horosa-taiyi-empty">暂无十六宫数据</div>;
		}
		return pan.palace16.map((item) => (
			<div className="horosa-taiyi-palace-row" key={item.palace}>
				<strong>{item.palace}</strong>
				<span>{(item.items || []).join('、') || '—'}</span>
			</div>
		));
	}

	formatDisplayValue(value) {
		if (value === undefined || value === null || value === '') {
			return '—';
		}
		if (Array.isArray(value)) {
			return value.map((item) => this.formatDisplayValue(item)).filter((item) => item && item !== '—').join('、') || '—';
		}
		if (typeof value === 'object') {
			const text = Object.keys(value).map((key) => {
				const item = this.formatDisplayValue(value[key]);
				if (!item || item === '—') {
					return '';
				}
				return `${key}：${item}`;
			}).filter(Boolean).join('；');
			return text || '—';
		}
		return `${value}`.replace(/得None/g, '未得').replace(/None/g, '未得');
	}

	renderSectionRows(titles) {
		const pan = this.state.pan;
		const sections = pan && pan.sections ? pan.sections : [];
		const titleSet = titles && titles.length ? new Set(titles) : null;
		const filtered = titleSet ? sections.filter((section) => titleSet.has(section.title)) : sections;
		if (!filtered.length) {
			return <div className="horosa-taiyi-empty">暂无输出</div>;
		}
		return filtered.map((section) => (
			<div className="horosa-taiyi-info-card horosa-taiyi-section-card" key={section.title}>
				<div className="horosa-taiyi-info-heading">{section.title}</div>
				{(section.rows || []).map((row) => (
					<div className="horosa-taiyi-info-row" key={`${section.title}_${row.label}`}>
						<span>{row.label}</span>
						<strong>{this.formatDisplayValue(row.value)}</strong>
					</div>
				))}
			</div>
		));
	}

	renderRightPanel() {
		const pan = this.state.pan;
		const showLifeTab = this.hasSectionTitles(['命法', '命宫行限']);
		const showDoorsTab = this.hasSectionTitles(['八门与宿曜']);
		const showRulingsTab = this.hasSectionTitles(['断法', '七大兵法', '博弈']);
		const tabKeys = ['overview', 'palaces', 'spirits'];
		if (showDoorsTab) {
			tabKeys.push('doors');
		}
		if (showRulingsTab) {
			tabKeys.push('rulings');
		}
		if (showLifeTab) {
			tabKeys.push('life');
		}
		const activeKey = tabKeys.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-taiyi-tabs">
				{/* horosa_freeze_subtabs_v1:右栏六页签 keep-alive,原先每次父重渲(切时间/改选项/换页签)
				    都把六个面板的 renderPalaceRows/renderSectionRows 全跑一遍。函数式 FreezeSubTab:
				    非激活时既不求值也不 reconcile;切回时拿本轮最新 children 立即渲一帧(不卸载、不闪烁)。 */}
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{()=>(
						<div className="horosa-taiyi-overview-stack">
							{this.renderInfoRows()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="十六宫" key="palaces">
					<FreezeSubTab active={activeKey === 'palaces'}>{()=>(
						<div className="horosa-taiyi-palace-list">
							{this.renderPalaceRows()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞" key="spirits">
					<FreezeSubTab active={activeKey === 'spirits'}>{()=>(
						<div className="horosa-taiyi-section-list">
							{this.renderSectionRows(['太乙诸神', '风游', '十二神'])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				{showDoorsTab && (
					<TabPane tab="八门" key="doors">
						<FreezeSubTab active={activeKey === 'doors'}>{()=>(
							<div className="horosa-taiyi-section-list">
								{this.renderSectionRows(['八门与宿曜'])}
							</div>
						)}</FreezeSubTab>
					</TabPane>
				)}
				{showRulingsTab && (
					<TabPane tab="断法" key="rulings">
						<FreezeSubTab active={activeKey === 'rulings'}>{()=>(
							<div className="horosa-taiyi-section-list">
								{this.renderSectionRows(['断法', '七大兵法', '博弈'])}
							</div>
						)}</FreezeSubTab>
					</TabPane>
				)}
				{showLifeTab && (
					<TabPane tab="命法" key="life">
						<FreezeSubTab active={activeKey === 'life'}>{()=>(
							<div className="horosa-taiyi-section-list">
								{this.renderSectionRows(['命法', '命宫行限'])}
							</div>
						)}</FreezeSubTab>
					</TabPane>
				)}
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像(概览/十六宫/神煞/八门/断法/命法)全撤,只留本页没有的动词。
	renderBottomQuickDock() {
		return (
			<QuickDockBar
				page="taiyi"
				className="horosa-taiyi-quick-dock"
				hasResult={!!this.state.pan}
				primary={{ key: 'plot', label: '起盘', onClick: this.clickPlot }}
				extras={[
					{ key: 'nowPlot', label: '此刻起局', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickPlotNow() },
				]}
				save={this.clickSaveCase}
				dispatch={this.props.dispatch}
			/>
		);
	}

	// 按 pan 引用缓存 computeGeju(pan):render 内三处共用,同 pan 只算一次、跨重渲复用(byte-perfect)。
	gejuOf(pan) {
		if (!pan) {
			return [];
		}
		if (!chartDrawGuardEnabled()) {
			return computeGeju(pan); // kill-switch:回到每处各自实算
		}
		if (this._gejuCache && this._gejuCache.pan === pan) {
			return this._gejuCache.data;
		}
		const data = computeGeju(pan);
		this._gejuCache = { pan, data };
		return data;
	}

	render() {
		// 修(用户实告:窗口缩放后农历行被中间栏上端裁掉):props.height 来自 model 写死的固定值、
		// 永不随窗口变 → 固定像素页高在矮窗下被 flex 居中裁顶。与遁甲同款修法:有 props.height 时
		// 页高交给 CSS('100%',外层 tabpane 已锁 calc(100vh-72px));minHeight 置 0 移除像素地板。
		let height = this.props.height ? this.props.height : 760;
		if (height === '100%') {
			height = 760;
		} else {
			height = Number(height);
			height = Number.isFinite(height) && height > 0 ? height : 760;
		}
		const pageHeight = this.props.height ? '100%' : height;
		return (
			<div className="horosa-taiyi-page horosa-astro-redesign horosa-taiyi-redesign" style={{ height: pageHeight, minHeight: 0, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-taiyi-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-taiyi-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-taiyi-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-taiyi-chart-panel xq-chart-renderer xq-chart-renderer-taiyi">
								<div className="horosa-taiyi-board-host">
									{this.state.options.style === 5 ? this.renderLifeBoard() : this.renderLeft()}
								</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-taiyi-info-panel">
								<div className="horosa-side-panel-heading horosa-taiyi-info-heading">
									<div>
										<div className="horosa-side-panel-title">太乙信息</div>
										<div className="horosa-side-panel-subtitle">概览、十六宫与神煞</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</Spin>
					{this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}

export default TaiYiMain;
