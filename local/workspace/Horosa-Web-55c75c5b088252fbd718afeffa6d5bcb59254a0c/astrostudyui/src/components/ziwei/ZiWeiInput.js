import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Checkbox, Collapse } from 'antd';
import {convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import ZWSihuaCustomModal from './ZWSihuaCustomModal';
import DateTime from '../comp/DateTime';
import SpaceTimePanel from '../comp/SpaceTimePanel';
// R4-B2(S1 止血):紫微是 chartFree(本页不消费 /chart),旧默认让选步长走全局 handler
// 预取 4 个 /chart = 纯空烧;函数型 onStepSelect 屏蔽全局,改走武装引擎(skipChart,
// 只预取登记的 /ziwei/birth ±depth)。
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { XQSelect as Select, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import XQIcon from '../xq-icons';
import { ZWEngineOptions, DAXIAN_SPAN_OPTIONS, TIANMA_BASIS_OPTIONS, STAR_SET_OPTIONS, SANPAN_OPTIONS, SHANGSHI_OPTIONS, LEAP_MONTH_OPTIONS, LATE_ZI_OPTIONS, YEAR_BOUNDARY_OPTIONS, HUOLING_OPTIONS, KONG_NAMING_OPTIONS, BRIGHTNESS_SOURCE_OPTIONS } from './ziweiOptions';
import { ZIWEI_SCHOOL_PRESETS, ZIWEI_PRESET_OPTIONS, presetOf } from './ziweiPresets';

const {Option} = Select;

// 紫云太岁关系人生肖(下拉单选,地支+生肖)。
const SHENGXIAO_OPTIONS = [
	{ value: '', label: '（无）' },
	{ value: '子', label: '子（鼠）' }, { value: '丑', label: '丑（牛）' }, { value: '寅', label: '寅（虎）' },
	{ value: '卯', label: '卯（兔）' }, { value: '辰', label: '辰（龙）' }, { value: '巳', label: '巳（蛇）' },
	{ value: '午', label: '午（马）' }, { value: '未', label: '未（羊）' }, { value: '申', label: '申（猴）' },
	{ value: '酉', label: '酉（鸡）' }, { value: '戌', label: '戌（狗）' }, { value: '亥', label: '亥（猪）' },
];

class ZiWeiInput extends Component{
	
	constructor(props) {
		super(props);

		let showTips = true;
		let tips = localStorage.getItem('ziweiTips');
		if(tips !== undefined && tips !== null){
			if(tips+'' === '1'){
				showTips = true;
			}else{
				showTips = false;
			}
		}

		let showOthers = true;
		let so = localStorage.getItem('ziweiShowOthers');
		if(so !== null){ showOthers = (so + '' === '1'); }
		let showSmall = false;
		let ss = localStorage.getItem('ziweiShowSmall');
		if(ss !== null){ showSmall = (ss + '' === '1'); }

		// P1-A 四化流派：默认 beipai（=现状）；立即同步全局单例 + 兼容垫片 + 失效四化缓存。
		let sihuaSchool = localStorage.getItem('ziweiSihuaSchool') || 'beipai';
		ZWCont.ZWSchool.school = sihuaSchool;
		ZWCont.refreshActiveSiHua();
		ZiWeiHelper.resetHuaMap();
		// P1-B 小限顺逆：'0'=男顺女逆(现状) / '1'=阳男阴女顺(中州)
		let xiaoxianMode = localStorage.getItem('ziweiXiaoxianYinyang') || '0';

		// 传本/排盘开关(本地引擎):大限跨度/天马依据/星集/三盘。读 localStorage→同步可变单例 ZWEngineOptions(默认=现状零回归)。
		const lsNum = (k, def)=>{ const v = localStorage.getItem(k); return v === null ? def : (v === 'ju' ? 'ju' : (Number.isNaN(Number(v)) ? v : Number(v))); };
		ZWEngineOptions.daxianSpan = lsNum('ziweiDaxianSpan', 10);
		ZWEngineOptions.tianmaBasis = localStorage.getItem('ziweiTianmaBasis') || 'month';
		ZWEngineOptions.starSet = localStorage.getItem('ziweiStarSet') || 'full';
		ZWEngineOptions.sanPan = localStorage.getItem('ziweiSanPan') || 'tian';
		ZWEngineOptions.shangShi = localStorage.getItem('ziweiShangShi') || 'fixed';
		ZWEngineOptions.leapMonth = localStorage.getItem('ziweiLeapMonth') || 'mid_split';
		ZWEngineOptions.lateZi = localStorage.getItem('ziweiLateZi') || 'zi_chu';
		ZWEngineOptions.yearBoundary = localStorage.getItem('ziweiYearBoundary') || 'lichun';
		ZWEngineOptions.huoling = localStorage.getItem('ziweiHuoling') || 'sanhe';
		ZWEngineOptions.kongNaming = localStorage.getItem('ziweiKongNaming') || 'modern';
		// 亮度源(WP-L) + 6 显示 overlay 开关(WP-1..6) + 紫云关系人列表(WP-6)。默认全关/空=零回归。
		ZWEngineOptions.brightnessSource = localStorage.getItem('ziweiBrightnessSource') || 'zi_jian';
		const lsBool = (k)=>localStorage.getItem(k) === '1';
		ZWEngineOptions.childLimit = lsBool('ziweiChildLimit');
		ZWEngineOptions.zhongxian = lsBool('ziweiZhongxian');
		ZWEngineOptions.huoPan = lsBool('ziweiHuoPan');
		ZWEngineOptions.qishuWei = lsBool('ziweiQishuWei');
		ZWEngineOptions.borrowPalace = lsBool('ziweiBorrowPalace');
		ZWEngineOptions.taiSuiRuGua = lsBool('ziweiTaiSuiRuGua');
		try{ ZWEngineOptions.taiSuiRelatives = JSON.parse(localStorage.getItem('ziweiTaiSuiRelatives') || '[]') || []; }catch(e){ ZWEngineOptions.taiSuiRelatives = []; }

		this.state = {
			showTips: showTips,
			showOthers: showOthers,
			showSmall: showSmall,
			sihuaSchool: sihuaSchool,
			xiaoxianMode: xiaoxianMode,
			sihuaCustomOpen: false,
			daxianSpan: ZWEngineOptions.daxianSpan,
			tianmaBasis: ZWEngineOptions.tianmaBasis,
			starSet: ZWEngineOptions.starSet,
			sanPan: ZWEngineOptions.sanPan,
			shangShi: ZWEngineOptions.shangShi,
			leapMonth: ZWEngineOptions.leapMonth,
			lateZi: ZWEngineOptions.lateZi,
			yearBoundary: ZWEngineOptions.yearBoundary,
			huoling: ZWEngineOptions.huoling,
			kongNaming: ZWEngineOptions.kongNaming,
			brightnessSource: ZWEngineOptions.brightnessSource,
			childLimit: ZWEngineOptions.childLimit,
			zhongxian: ZWEngineOptions.zhongxian,
			huoPan: ZWEngineOptions.huoPan,
			qishuWei: ZWEngineOptions.qishuWei,
			borrowPalace: ZWEngineOptions.borrowPalace,
			taiSuiRuGua: ZWEngineOptions.taiSuiRuGua,
			taiSuiRelatives: ZWEngineOptions.taiSuiRelatives,
			zwPresetPicked: localStorage.getItem('ziweiPreset') || 'sanhe',
		}

        this.tmHook = {
            getValue: null,
        }

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);

		this.onGenderChange = this.onGenderChange.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);
		this.onTipsChange = this.onTipsChange.bind(this);
		this.onShowOthersChange = this.onShowOthersChange.bind(this);
		this.onShowSmallChange = this.onShowSmallChange.bind(this);
		this.redrawChart = this.redrawChart.bind(this);
		this.onSihuaSchoolChange = this.onSihuaSchoolChange.bind(this);
		this.onXiaoxianModeChange = this.onXiaoxianModeChange.bind(this);
		this.onSihuaCustomOk = this.onSihuaCustomOk.bind(this);
		this.onSihuaCustomCancel = this.onSihuaCustomCancel.bind(this);
		this.onDaxianSpanChange = this.onDaxianSpanChange.bind(this);
		this.onTianmaBasisChange = this.onTianmaBasisChange.bind(this);
		this.onStarSetChange = this.onStarSetChange.bind(this);
		this.onSanPanChange = this.onSanPanChange.bind(this);
		this.onShangShiChange = this.onShangShiChange.bind(this);
		this.onLeapMonthChange = this.onLeapMonthChange.bind(this);
		this.onLateZiChange = this.onLateZiChange.bind(this);
		this.onYearBoundaryChange = this.onYearBoundaryChange.bind(this);
		this.onHuolingChange = this.onHuolingChange.bind(this);
		this.onKongNamingChange = this.onKongNamingChange.bind(this);
		this.onBrightnessSourceChange = this.onBrightnessSourceChange.bind(this);
		this.onOverlayToggle = this.onOverlayToggle.bind(this);
		this.onTaiSuiRelativesChange = this.onTaiSuiRelativesChange.bind(this);
		this.onPresetChange = this.onPresetChange.bind(this);

		let type = localStorage.getItem('ziweiChartType');
		if(type !== undefined && type !== null){
			ZWCont.ZWChart.chart = parseInt(type+'');
		}

	}

	// [Windows-only] horosa_ziwei_input_scu_v1(补接):左栏纯 props 浅比 sCU。
	// 病灶:本组件 ~540 行(Collapse + 十余个 Select + SpaceTimePanel/DateTime),此前零 sCU ——
	// 宿主 ZiWeiMain 的任意 setState(点星改 tips、updating 角标、换右栏页签、大限/流曜选取…)
	// 都让整张左表重渲一遍,而左栏的输入只有 props.fields 一项。
	// 语义:
	//   - state 变一律返回 true(本组件自身 setState 恒新引用 → 十余个开关/流派预设/自定义四化弹层
	//     的即时反馈零延迟;它们改的可变单例 ZWEngineOptions / ZWChart.chart / getActiveSiHuaGan()
	//     也只由本组件自己写,且每次都紧跟 setState 或 onFieldsChange,故不存在「外部改了单例、
	//     本组件却不重渲」的陈旧面)。
	//   - props 用 wrapperPropsEqual 机械全覆盖浅比(免手抄 keys 的漏渲风险):props 只有
	//     fields(dva 每次 astro/save 都 {...fields,...patch} 新建 → 引用必变)与函数型
	//     onFieldsChange(视为恒等,详 wrapperPropsEqual)。
	// kill-switch 同 chartSCU(horosa.perf.chartSCU 关 = 恒重渲的旧行为)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	onChartTypeChange(val){
		ZWCont.ZWChart.chart = val;
		safeLocalStorageSet('ziweiChartType', val);
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				zwchart: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onGenderChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				gender: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}
	
	onTimeAlgChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				timeAlg: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},
			});
		}
	}

	onTimeChanged(value){
		if(this.props.onFieldsChange){
			let dt = value.time;

			this.props.onFieldsChange({
				__confirmed: !!value.confirmed,
				...(value.step ? { __stepHint: value.step } : {}),
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				}
			});
		}
	}



	onTipsChange(e){
		let val = e.target.checked;
		safeLocalStorageSet('ziweiTips', val ? 1 : 0);
		this.setState({
			showTips: val,
		});
	}

	// P0-4：杂曜/十二神显示开关 — 写 localStorage 后触发盘面重绘（后端缓存命中，仅刷新渲染）。
	redrawChart(){
		if(this.props.onFieldsChange && this.tmHook && this.tmHook.getValue){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: dt.zone },
			});
		}
	}

	// 杂曜/十二神是纯显示层:不进排盘请求体,故 redrawChart()(重传同一份时间字段)对它们无效——
	// 参数逐字节相等会被 requestDedupe 命中,chart 不变则盘面不重渲染。改发显示层广播强制重绘。
	onShowOthersChange(e){
		let val = e.target.checked;
		safeLocalStorageSet('ziweiShowOthers', val ? 1 : 0);
		this.setState({ showOthers: val });
		ZiWeiHelper.bumpZwDisplayRev('showOthers', val);
	}

	onShowSmallChange(e){
		let val = e.target.checked;
		safeLocalStorageSet('ziweiShowSmall', val ? 1 : 0);
		this.setState({ showSmall: val });
		ZiWeiHelper.bumpZwDisplayRev('showSmall', val);
	}

	// P1-A 四化流派切换：写全局单例 + localStorage + 刷新兼容垫片 + 失效四化缓存 + 重绘。
	applySihuaSchool(val){
		ZWCont.ZWSchool.school = val;
		safeLocalStorageSet('ziweiSihuaSchool', val);
		ZWCont.refreshActiveSiHua();
		ZiWeiHelper.resetHuaMap();
	}

	onSihuaSchoolChange(val){
		if(val === 'custom'){
			// 切到自定义：先标记 + 打开编辑器（保存后才真正生效；未存过则编辑器以当前表预填）。
			this.applySihuaSchool('custom');
			this.setState({ sihuaSchool: 'custom', sihuaCustomOpen: true });
			this.redrawChart();
			return;
		}
		this.applySihuaSchool(val);
		this.setState({ sihuaSchool: val });
		this.redrawChart();
	}

	// WP-D 流派预设:一键套全开关组合(四化 + 全 ZWEngineOptions)。custom 只标记;选 preset 套组合后可再手调单项(→自动判 custom)。
	onPresetChange(val){
		if(val === 'custom'){ this.setState({ zwPresetPicked: 'custom' }); safeLocalStorageSet('ziweiPreset', 'custom'); return; }
		const p = ZIWEI_SCHOOL_PRESETS[val];
		if(!p){ return; }
		this.applySihuaSchool(p.sihua);
		const lsMap = { daxianSpan: 'ziweiDaxianSpan', tianmaBasis: 'ziweiTianmaBasis', starSet: 'ziweiStarSet', sanPan: 'ziweiSanPan', shangShi: 'ziweiShangShi', leapMonth: 'ziweiLeapMonth', lateZi: 'ziweiLateZi', yearBoundary: 'ziweiYearBoundary', huoling: 'ziweiHuoling', kongNaming: 'ziweiKongNaming', brightnessSource: 'ziweiBrightnessSource' };
		Object.keys(lsMap).forEach((k)=>{ ZWEngineOptions[k] = p[k]; safeLocalStorageSet(lsMap[k], String(p[k])); });
		// 6 显示 overlay 开关(bool):套 preset 时一并设。
		const boolMap = { childLimit: 'ziweiChildLimit', zhongxian: 'ziweiZhongxian', huoPan: 'ziweiHuoPan', qishuWei: 'ziweiQishuWei', borrowPalace: 'ziweiBorrowPalace', taiSuiRuGua: 'ziweiTaiSuiRuGua' };
		Object.keys(boolMap).forEach((k)=>{ ZWEngineOptions[k] = !!p[k]; safeLocalStorageSet(boolMap[k], p[k] ? 1 : 0); });
		safeLocalStorageSet('ziweiPreset', val);
		this.setState({ zwPresetPicked: val, sihuaSchool: p.sihua, daxianSpan: p.daxianSpan, tianmaBasis: p.tianmaBasis, starSet: p.starSet, sanPan: p.sanPan, shangShi: p.shangShi, leapMonth: p.leapMonth, lateZi: p.lateZi, yearBoundary: p.yearBoundary, huoling: p.huoling, kongNaming: p.kongNaming, brightnessSource: p.brightnessSource, childLimit: !!p.childLimit, zhongxian: !!p.zhongxian, huoPan: !!p.huoPan, qishuWei: !!p.qishuWei, borrowPalace: !!p.borrowPalace, taiSuiRuGua: !!p.taiSuiRuGua });
		this.redrawChart();
	}

	onSihuaCustomOk(table){
		safeLocalStorageSet('ziweiSihuaCustom', JSON.stringify(table));
		this.applySihuaSchool('custom');
		this.setState({ sihuaSchool: 'custom', sihuaCustomOpen: false });
		this.redrawChart();
	}

	onSihuaCustomCancel(){
		// 取消时若无有效自定义表，回退到 beipai（避免停在空自定义态）。
		const has = !!localStorage.getItem('ziweiSihuaCustom');
		if(!has){
			this.applySihuaSchool('beipai');
			this.setState({ sihuaSchool: 'beipai', sihuaCustomOpen: false });
			this.redrawChart();
			return;
		}
		this.setState({ sihuaCustomOpen: false });
	}

	onXiaoxianModeChange(val){
		safeLocalStorageSet('ziweiXiaoxianYinyang', val);
		this.setState({ xiaoxianMode: val });
		this.redrawChart();
	}

	// 传本/排盘开关:写可变单例 ZWEngineOptions + localStorage,重绘(→requestZiWei 走本地引擎双路)。
	onDaxianSpanChange(val){ ZWEngineOptions.daxianSpan = val; safeLocalStorageSet('ziweiDaxianSpan', String(val)); this.setState({ daxianSpan: val }); this.redrawChart(); }
	onTianmaBasisChange(val){ ZWEngineOptions.tianmaBasis = val; safeLocalStorageSet('ziweiTianmaBasis', val); this.setState({ tianmaBasis: val }); this.redrawChart(); }
	onStarSetChange(val){ ZWEngineOptions.starSet = val; safeLocalStorageSet('ziweiStarSet', val); this.setState({ starSet: val }); this.redrawChart(); }
	onSanPanChange(val){ ZWEngineOptions.sanPan = val; safeLocalStorageSet('ziweiSanPan', val); this.setState({ sanPan: val }); this.redrawChart(); }
	onShangShiChange(val){ ZWEngineOptions.shangShi = val; safeLocalStorageSet('ziweiShangShi', val); this.setState({ shangShi: val }); this.redrawChart(); }
	onLeapMonthChange(val){ ZWEngineOptions.leapMonth = val; safeLocalStorageSet('ziweiLeapMonth', val); this.setState({ leapMonth: val }); this.redrawChart(); }
	onLateZiChange(val){ ZWEngineOptions.lateZi = val; safeLocalStorageSet('ziweiLateZi', val); this.setState({ lateZi: val }); this.redrawChart(); }
	onYearBoundaryChange(val){ ZWEngineOptions.yearBoundary = val; safeLocalStorageSet('ziweiYearBoundary', val); this.setState({ yearBoundary: val }); this.redrawChart(); }
	onHuolingChange(val){ ZWEngineOptions.huoling = val; safeLocalStorageSet('ziweiHuoling', val); this.setState({ huoling: val }); this.redrawChart(); }
	onKongNamingChange(val){ ZWEngineOptions.kongNaming = val; safeLocalStorageSet('ziweiKongNaming', val); this.setState({ kongNaming: val }); this.redrawChart(); }
	// WP-L 亮度源(改安星路径,走本地引擎)。
	onBrightnessSourceChange(val){ ZWEngineOptions.brightnessSource = val; safeLocalStorageSet('ziweiBrightnessSource', val); this.setState({ brightnessSource: val }); this.redrawChart(); }
	// WP-1..6 显示 overlay 开关(纯后处理,不改安星):通用 checkbox → 写单例 + localStorage + 重绘。
	onOverlayToggle(stateKey, optKey, lsKey, checked){
		ZWEngineOptions[optKey] = checked;
		safeLocalStorageSet(lsKey, checked ? 1 : 0);
		this.setState({ [stateKey]: checked });
		this.redrawChart();
	}
	// WP-6 紫云关系人列表(逗号分隔生肖 + 角色 + 性别的简式;存 localStorage,随盘)。
	onTaiSuiRelativesChange(list){
		const arr = Array.isArray(list) ? list : [];
		ZWEngineOptions.taiSuiRelatives = arr;
		safeLocalStorageSet('ziweiTaiSuiRelatives', JSON.stringify(arr));
		this.setState({ taiSuiRelatives: arr });
		this.redrawChart();
	}


	changeGeo(rec){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时)。
			// setZone 仅改时区标签、保留出生钟面时刻(见 DateTime.setZone),不移位时间。
			if(dt && dt.setZone){
				try{
					if(rec.zone){
						dt.setZone(rec.zone);
					}else{
						const ds = dt.format ? dt.format('YYYY-MM-DD') : null;
						const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
						if(z && z.offset){ dt.setZone(z.offset); }
					}
				}catch(e){ /* 推断失败保留原时区 */ }
			}
			this.props.onFieldsChange({
				lon: {
					value: convertLonToStr(rec.lng),
				},
				lat: {
					value: convertLatToStr(rec.lat),
				},
				gpsLon: {
					value: rec.gpsLng
				},
				gpsLat: {
					value: rec.gpsLat
				},
				...geoNameFieldPatch(rec),
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			let str = fields.date.value.format('YYYY-MM-DD') + ' ' + 
						fields.time.value.format('HH:mm');
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}

		let zwchart = ZWCont.ZWChart.chart;
		if(fields.zwchart !== undefined && fields.zwchart !== null &&
			fields.zwchart.value !== undefined && fields.zwchart.value !== null){
			zwchart = fields.zwchart.value;
		}
		let timeAlg = fields.timeAlg && fields.timeAlg.value !== undefined && fields.timeAlg.value !== null
			? fields.timeAlg.value
			: 0;

		return (
			<div className="horosa-ziwei-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">紫微设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与排盘选项</div>
					</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					timeHook={this.tmHook}
					onGeoChange={this.changeGeo}
					onStepSelect={(unit)=>{ try{ armStepPrefetch('unit-select', { unit, skipChart: true }); }catch(e){ /* 武装失败静默 */ } }}
				/>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="ziwei.options" className="horosa-side-input-section">
					<div className="horosa-ziwei-select-grid">
						<label className="horosa-ziwei-select-field">
							<span>性别</span>
							<Select value={fields.gender.value} onChange={this.onGenderChange} size='small'>
								<Option value={-1}>未知</Option>
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</label>
						<label className="horosa-ziwei-select-field">
							<span>时间算法</span>
							<Select value={timeAlg} onChange={this.onTimeAlgChange} size='small'>
								<Option value={0}>真太阳时</Option>
								<Option value={1}>直接时间</Option>
							</Select>
						</label>
						<label className="horosa-ziwei-select-field horosa-ziwei-select-field-wide">
							<span>盘式</span>
							<Select value={zwchart} onChange={this.onChartTypeChange} size='small'>
								<Option value={ZWCont.ZWChart_SiHua}>四化盘</Option>
								<Option value={ZWCont.ZWChart_SangHe}>三合盘</Option>
							</Select>
						</label>
						<label className="horosa-ziwei-select-field horosa-ziwei-select-field-wide">
							<span>流派预设</span>
							<Select value={presetOf(this.state.sihuaSchool, ZWEngineOptions, this.state.zwPresetPicked)} onChange={this.onPresetChange} size='small'>
								{ZIWEI_PRESET_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-ziwei-select-field horosa-ziwei-select-field-wide">
							<span>四化流派</span>
							<Select value={this.state.sihuaSchool} onChange={this.onSihuaSchoolChange} size='small'>
								<Option value="beipai">通用·飞星(现状)</Option>
								<Option value="zhongzhou">中州派</Option>
								<Option value="quanshu">全书系</Option>
								<Option value="beixiang">北派(天相忌)</Option>
								<Option value="custom">自定义…</Option>
							</Select>
						</label>
					</div>
					<div className="horosa-ziwei-option-card">
						<Checkbox checked={this.state.showTips} onChange={this.onTipsChange}>允许提示</Checkbox>
						<Checkbox checked={this.state.showOthers} onChange={this.onShowOthersChange}>显示杂曜</Checkbox>
						<Checkbox checked={this.state.showSmall} onChange={this.onShowSmallChange}>显示十二神</Checkbox>
					</div>
					<Collapse ghost size="small" className="horosa-ziwei-school-collapse">
						<Collapse.Panel header="流派·传本设置" key="school">
							<div className="horosa-ziwei-select-grid">
							<label className="horosa-ziwei-select-field">
								<span>观察盘</span>
								<Select value={this.state.sanPan} onChange={this.onSanPanChange} size='small'>
									{SANPAN_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>小限顺逆</span>
								<Select value={this.state.xiaoxianMode} onChange={this.onXiaoxianModeChange} size='small'>
									<Option value="0">男顺女逆（现状）</Option>
									<Option value="1">阳男阴女顺（中州）</Option>
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>大限跨度</span>
								<Select value={this.state.daxianSpan} onChange={this.onDaxianSpanChange} size='small'>
									{DAXIAN_SPAN_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>天马依据</span>
								<Select value={this.state.tianmaBasis} onChange={this.onTianmaBasisChange} size='small'>
									{TIANMA_BASIS_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>星集</span>
								<Select value={this.state.starSet} onChange={this.onStarSetChange} size='small'>
									{STAR_SET_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>天伤天使</span>
								<Select value={this.state.shangShi} onChange={this.onShangShiChange} size='small'>
									{SHANGSHI_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>火铃起宫</span>
								<Select value={this.state.huoling} onChange={this.onHuolingChange} size='small'>
									{HUOLING_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>空劫命名</span>
								<Select value={this.state.kongNaming} onChange={this.onKongNamingChange} size='small'>
									{KONG_NAMING_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>星曜亮度</span>
								<Select value={this.state.brightnessSource} onChange={this.onBrightnessSourceChange} size='small'>
									{BRIGHTNESS_SOURCE_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>闰月归月</span>
								<Select value={this.state.leapMonth} onChange={this.onLeapMonthChange} size='small'>
									{LEAP_MONTH_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>晚子时</span>
								<Select value={this.state.lateZi} onChange={this.onLateZiChange} size='small'>
									{LATE_ZI_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							<label className="horosa-ziwei-select-field">
								<span>定年界线</span>
								<Select value={this.state.yearBoundary} onChange={this.onYearBoundaryChange} size='small'>
									{YEAR_BOUNDARY_OPTIONS.map((o)=><Option key={o.value} value={o.value}>{o.label}</Option>)}
								</Select>
							</label>
							</div>
							{this.state.sihuaSchool === 'custom' && (
								<button type="button" className="horosa-ziwei-school-edit-btn" onClick={()=>this.setState({ sihuaCustomOpen: true })}>编辑自定义四化表…</button>
							)}
						</Collapse.Panel>
						<Collapse.Panel header="流派叠层·显示" key="overlay">
							<div className="horosa-ziwei-overlay-card">
								<Checkbox checked={this.state.childLimit} onChange={(e)=>this.onOverlayToggle('childLimit', 'childLimit', 'ziweiChildLimit', e.target.checked)}>童限(上大限前逐岁本命宫)</Checkbox>
								<Checkbox checked={this.state.zhongxian} onChange={(e)=>this.onOverlayToggle('zhongxian', 'zhongxian', 'ziweiZhongxian', e.target.checked)}>沈氏三限(大限细分2.5年中限)</Checkbox>
								<Checkbox checked={this.state.qishuWei} onChange={(e)=>this.onOverlayToggle('qishuWei', 'qishuWei', 'ziweiQishuWei', e.target.checked)}>河洛气数位(官禄宫干四化回照)</Checkbox>
								<Checkbox checked={this.state.borrowPalace} onChange={(e)=>this.onOverlayToggle('borrowPalace', 'borrowPalace', 'ziweiBorrowPalace', e.target.checked)}>中州借宫(空宫借对宫正曜)</Checkbox>
								<Checkbox checked={this.state.huoPan} onChange={(e)=>this.onOverlayToggle('huoPan', 'huoPan', 'ziweiHuoPan', e.target.checked)}>活盘(点宫为太极点重排宫名)</Checkbox>
								<Checkbox checked={this.state.taiSuiRuGua} onChange={(e)=>this.onOverlayToggle('taiSuiRuGua', 'taiSuiRuGua', 'ziweiTaiSuiRuGua', e.target.checked)}>紫云太岁入卦(关系人生肖落宫)</Checkbox>
								{this.state.taiSuiRuGua && (
									<label className="horosa-ziwei-select-field" style={{ marginTop: 4 }}>
										<span>关系人生肖</span>
										<Select value={((this.state.taiSuiRelatives || [])[0] || {}).branch || ''}
											onChange={(v)=>this.onTaiSuiRelativesChange(v ? [{ branch: v, role: '', sex: '' }] : [])}
											size='small'>
											{SHENGXIAO_OPTIONS.map((o)=><Option key={o.value || 'none'} value={o.value}>{o.label}</Option>)}
										</Select>
									</label>
								)}
							</div>
						</Collapse.Panel>
					</Collapse>
					<ZWSihuaCustomModal
						open={this.state.sihuaCustomOpen}
						table={ZWCont.getActiveSiHuaGan()}
						onOk={this.onSihuaCustomOk}
						onCancel={this.onSihuaCustomCancel}
					/>
				</XQSideSection>
			</div>
		);
	}

}

export default ZiWeiInput;
