import { Component } from 'react';
import moment from 'moment';
import { Row, Col, Slider, Tree, Collapse, Table } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import UranianDial from './UranianDial';
import UranianModulusDial from './UranianModulusDial';
import UranianCosmogram from './UranianCosmogram';
import UranianRectify from './UranianRectify';
import { midpointTree, planetaryPictures, midpointList, spiegelContacts, solarArcDirections, crossContacts } from '../../utils/uranianDial';
import { factorLabel, composeShort } from '../../data/uranianMeanings';
import { getStoredUranianDisplay, saveUranianDisplay, URANIAN_DIAL_BASES, dialBaseLabel } from './UranianDialStyle';
import { XQSelect, XQTabs, XQSideSection, XQSwitch, XQSegmented, XQDatePicker, XQInputNumber } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { SCHOOL_OPTIONS, presetForSchool, personalSetForSchool, schoolToBackendParams } from './UranianSchools';
import { listLocalCharts } from '../../utils/localcharts';

const DIAL_BODY_IDS = new Set([
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
	AstroConst.JUPITER, AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.ASC, AstroConst.MC,
]);

// 个人点集随当前流派派生(见 personalSet();classic 汉堡六点+白羊 / cosmo Basic Five)——
// 扫描器默认只围绕个人点展开,减少过载。原固定常量已下放到 UranianSchools.personalSetForSchool。

// 8 颗 TNP 虚星 id 集合——供行星图/中点列表/映点的「含 TNP」优先级排序与锚点剪枝。
const URANIAN_SET = new Set(AstroConst.LIST_URANIAN);

// 行星图常用「盘基」快捷:90°(4 次谐波,默认)/45°(8 次谐波,宇宙生物学)/22.5°(16 次谐波)。
const QUICK_BASES = [90, 45, 22.5];

function sunLon(chartRoot){
	const inner = (chartRoot && chartRoot.chart) ? chartRoot.chart : (chartRoot || {});
	const o = (inner.objects || []).find((x) => x.id === AstroConst.SUN);
	return o && Number.isFinite(Number(o.lon)) ? Number(o.lon) : null;
}

function msg(id){ return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || id; }
const pad = (n) => (n < 10 ? '0' + n : '' + n);

// DateTime 无 valueOf()（之前导致太阳弧/年龄算成 NaN）；从 jdn(儒略日，JD2440587.5=Unix纪元) 取毫秒时间戳。
function birthEpochMs(birth){
	const jdn = birth ? Number(birth.jdn) : NaN;
	if (!Number.isFinite(jdn) || jdn === 0) return NaN;
	return (jdn - 2440587.5) * 86400000;
}

// 右栏因子用字形（与盘一致，hover 显名）：TNP=缩写；白羊点=全站 Aries 字形；其余=AstroMsg+AstroChartFont。
// hover 标题=名 · 因子义(增强;原 msg(id) 作 fallback,factorLabel 缺则只剩名)。
function tipOf(id){ const lab = factorLabel(id); return lab && lab !== msg(id) ? msg(id) + ' · ' + lab : msg(id); }
function glyphOf(id){
	const tnp = AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT;
	if (tnp) return <span style={{ fontWeight: 600, letterSpacing: '0.3px' }} title={tipOf(id)}>{AstroText.uranianGlyph(id)}</span>;
	const ch = id === AstroConst.ARIES_POINT ? AstroText.AstroMsg[AstroConst.ARIES] : AstroText.AstroMsg[id];
	if (ch) return <span style={{ fontFamily: AstroConst.AstroChartFont }} title={tipOf(id)}>{ch}</span>;
	return <span title={tipOf(id)}>{msg(id)}</span>;
}

// 安全取 field 值（field 缺失/未填时返回 undefined，绝不抛错）。
function fv(fields, key){
	const f = fields && fields[key];
	return f ? f.value : undefined;
}
function fmt(val, pattern){
	return (val && typeof val.format === 'function') ? val.format(pattern) : undefined;
}

// 一律先校验再发请求：缺/空的 date/time/zone/lat/lon 会让后端 PerChart→GeoPos/Datetime 抛错、
// 回 {err:'param error'}，而 request() 即便 silent 仍会对抛错弹 message.error 提示——故宁可前端拦下不发。
function dialParamsError(p){
	if (!p) return '请先完善出生信息';
	const need = ['date', 'time', 'zone', 'lat', 'lon'];
	for (const k of need){
		const v = p[k];
		if (v === undefined || v === null || `${v}`.trim() === '') return '请先设置出生日期/时间与经纬度';
	}
	return null;
}

function fieldsToParams(fields){
	if (!fields) return null;
	return {
		date: fmt(fv(fields, 'date'), 'YYYY/MM/DD'), time: fmt(fv(fields, 'time'), 'HH:mm:ss'),
		zone: fv(fields, 'zone') || '+08:00', lat: fv(fields, 'lat'), lon: fv(fields, 'lon'),
		gpsLat: fv(fields, 'gpsLat'), gpsLon: fv(fields, 'gpsLon'),
		hsys: fv(fields, 'hsys'), zodiacal: fv(fields, 'zodiacal'), siderealAyanamsa: fv(fields, 'siderealAyanamsa') || '', tradition: false, predictive: 0,
		name: fv(fields, 'name') || '', pos: fv(fields, 'pos') || '',
	};
}

// WP-9 合盘叠盘人配色(与子盘 RING_TONE 的 syn0..3 一致;UI 左栏色点/右栏标签用)。
const SYN_TONE = ['var(--horosa-accent, #2f7df1)', '#8e6fd0', '#1f8a8a', '#c08a2f'];
// 合盘叠盘最多 4 人(spec WP-9 上限)。
const SYN_MAX = 4;

// fieldsAry(antd Form 字段数组,convertToArray(fields) 的产物)→ 可选「叠盘人」清单。
// 每条目形如 {name:'date', value:DateTime} 等;只有携带出生信息的【整盘】才有意义——这里把【整个 fieldsAry】
// 视作「当前盘」一个人(其 name 字段值=人名)。
// 返回 [{id, label, source:'current', fields}] —— id=固定 'cur'(区别于库盘 'lib:<cid>'),fields=可喂 fieldsToParams。
function fieldsAryToObject(fieldsAry){
	if (!Array.isArray(fieldsAry)) return null;
	const obj = {};
	fieldsAry.forEach((f) => {
		if (!f) return;
		// convertToArray 把对象键塞进 f.name(字符串)或保留原 name 数组;两种都兼容取键名。
		let key = null;
		if (typeof f.name === 'string') key = f.name;
		else if (Array.isArray(f.name) && f.name.length) key = f.name[f.name.length - 1];
		if (key) obj[key] = f;
	});
	return Object.keys(obj).length ? obj : null;
}
// 命盘库 id 前缀:库内每条以 'lib:<cid>' 唯一标识(避免与当前盘 'cur' 及库内同名盘相撞)。
const LIB_PREFIX = 'lib:';
// 库记录(localcharts:{name,birth:'YYYY-MM-DD HH:mm:ss',zone,lat,lon,gpsLat,gpsLon,pos,hsys,zodiacal,siderealAyanamsa})
//   → /chart + /germany/midpoint 出参(与 fieldsToParams 同形;复用既有拉盘逻辑,不新建算法)。
//   出生信息缺失(无 birth/lat/lon)的记录返回 null,由调用方过滤。
function libraryChartParams(rec){
	if (!rec) return null;
	const birth = rec.birth ? `${rec.birth}` : '';
	const m = birth ? moment(birth, 'YYYY-MM-DD HH:mm:ss') : null;
	if (!m || !m.isValid()) return null;
	return {
		date: m.format('YYYY/MM/DD'), time: m.format('HH:mm:ss'),
		zone: rec.zone, lat: rec.lat, lon: rec.lon,
		gpsLat: rec.gpsLat, gpsLon: rec.gpsLon,
		hsys: rec.hsys, zodiacal: rec.zodiacal, siderealAyanamsa: rec.siderealAyanamsa || '', tradition: false, predictive: 0,
		name: rec.name || '', pos: rec.pos || '',
	};
}
// 叠盘人候选 = 当前页盘(source:'current')∪ 命盘库(source:'library')。
//   当前盘 fields=fieldsAry 对象映射(走 fieldsToParams);库盘 record=原始记录(走 libraryChartParams)。
//   库内有出生信息的盘才入列;label 用人名,库盘缺名以出生日兜底,UI 另以 source 标注区分。
function buildPersonList(fieldsAry){
	const out = [];
	const obj = fieldsAryToObject(fieldsAry);
	if (obj){
		const nm = obj.name && obj.name.value ? `${obj.name.value}` : '当前盘';
		out.push({ id: 'cur', label: nm, source: 'current', fields: obj });
	}
	let lib = [];
	try { lib = listLocalCharts() || []; } catch (e) { lib = []; }
	lib.forEach((rec) => {
		if (!rec || !rec.cid) return;
		if (!libraryChartParams(rec)) return; // 缺出生信息 → 不可叠盘
		const nm = rec.name ? `${rec.name}` : (rec.birth ? `${rec.birth}`.slice(0, 10) : '未命名');
		out.push({ id: `${LIB_PREFIX}${rec.cid}`, label: nm, source: 'library', record: rec });
	});
	return out;
}

// 流派 + 容许度 → /germany/midpoint 出参增量(WP-0 白名单已通:school/includeTnp/orb/personalOrb/frames)。
// 后端按 school 推 include_tnp(cosmo→无虚星)、用 orb / personalOrb;默认 classic 即现状字节零回归。
function schoolRequestParams(state){
	const sp = schoolToBackendParams(state.school);   // {school, includeTnp, orbMidpoint, orbPersonal, frames}
	return {
		...sp,
		orb: state.orb,                 // 盘上容许度(用户可逐项覆盖,优先于预设 orbMidpoint)
		personalOrb: state.orbPersonal, // 个人点放宽容许度(Basic Five)
		// 赤纬接触(WP-11):仅请求该字段;false 时后端不算 declination(省算)。include_tnp 仍随 school。
		declination: state.showDeclination !== false,
	};
}

// 从盘对象（本命/行运同形）取参与点：行星+三王+北交南交+Asc/MC。
function chartToPoints(chartRoot){
	const inner = (chartRoot && chartRoot.chart) ? chartRoot.chart : (chartRoot || {});
	const out = []; const seen = new Set();
	const sp = (v) => (Number.isFinite(Number(v)) ? Number(v) : null); // lonspeed:逆行标记用,缺失=null
	const push = (id, lon, speed) => { if (id && Number.isFinite(Number(lon)) && !seen.has(id)) { out.push({ id, lon: Number(lon), speed: sp(speed) }); seen.add(id); } };
	(inner.objects || []).forEach((o) => { if (DIAL_BODY_IDS.has(o.id)) push(o.id, o.lon, o.lonspeed); });
	(inner.angles || []).forEach((o) => { if (DIAL_BODY_IDS.has(o.id)) push(o.id, o.lon, o.lonspeed); });
	return out;
}

// 全链路 TNP 过滤：showTnp=false 时一并从盘绘制+指针读数+中点树剔除（用户验收口径,2026-06-02）。
function filterByTnp(points, showTnp){
	if (showTnp) return points;
	return (points || []).filter((p) => !AstroText.isUranian(p.id) || p.id === AstroConst.ARIES_POINT);
}

// 数字解析：空串/非数→null（视为「跟本命同地点」）。
function parseNum(v){
	if (v === undefined || v === null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

export default class UranianDialMain extends Component {
	constructor(props){
		super(props);
		const disp = getStoredUranianDisplay();
		this.state = {
			...disp,
			showTransit: disp.showTransit || false,
			showSolarArc: disp.showSolarArc || false,
			onlyPersonal: disp.onlyPersonal === undefined ? true : disp.onlyPersonal,
			natalTnp: [],
			natalDecl: null,       // WP-11 赤纬接触:本命 declination 响应字段(后端缺则 null)
			transitPoints: null,
			// WP-9 合盘叠盘:已选叠盘人(名数组)+ 各人盘点缓存(name → [{id,lon}]);上限 SYN_MAX。
			synastryPeople: Array.isArray(disp.synastryPeople) ? disp.synastryPeople.slice(0, SYN_MAX) : [],
			synastryPersonPoints: {},
			// WP-10 校时事件(只读预览):[{label,date(moment),type}];date 持久化为 ISO,加载时转 moment。
			rectifyEvents: (Array.isArray(disp.rectifyEvents) ? disp.rectifyEvents : []).map((e) => ({
				label: e && e.label ? `${e.label}` : '',
				type: e && e.type ? `${e.type}` : 'other',
				date: e && e.date ? moment(e.date) : null,
			})),
			readout: [],
			dataNote: null,        // 出生信息不全时的友好提示（取代裸 param error）
			dialStyle: disp.dialStyle === 'modulus' ? 'modulus' : 'folded', // 盘式：折叠盘 / 多环模数盘
			saArcDirected: 0,      // 太阳弧环被拖动的定向弧(黄道度)
			saAge: 0,              // 由定向弧按 saKey 反推的年龄
			saKey: disp.saKey === 'oneDeg' ? 'oneDeg' : 'naibod', // 太阳弧换算：Naibod / 1°每年
			transitTime: null,     // 行运时刻(null=此刻)，可调
			// 行运/SA 地点可调(null=同本命)。SA 一般地心黄经无需地点,但允许覆盖以方便 relocated 想法。
			transitLat: null, transitLon: null,
			saLat: null, saLon: null,
			// viewport 高度(用于动态算盘 size + 左右栏滚动 maxHeight;props.height 不含底部 Dock 安全距离,
			// 须用 window.innerHeight 实测 + 减去顶栏/tab/Dock 估算)。
			vh: typeof window !== 'undefined' ? window.innerHeight : 900,
			// 中间盘列的实测可用宽/高(中点盘按 min(列宽, 列高) 最大化,永不超出列的方框)。
			colW: 0,
			colH: 0,
		};
		this.unmounted = false;
		this._measure = this._measure.bind(this);
		this.requestNatalTnp = this.requestNatalTnp.bind(this);
		this.requestTransit = this.requestTransit.bind(this);
		this.requestPersonChart = this.requestPersonChart.bind(this);
		this.changeSynastryPeople = this.changeSynastryPeople.bind(this);
		this.onRectifyEventsChange = this.onRectifyEventsChange.bind(this);
		this.onReadout = this.onReadout.bind(this);
		this.onSaArc = this.onSaArc.bind(this);
		this._onResize = this._onResize.bind(this);
		if (this.props.hook) this.props.hook.fun = () => { if (!this.unmounted) { this.requestNatalTnp(); if (this.state.showTransit) this.requestTransit(); this._measure(); } };
	}

	componentDidMount(){
		this.unmounted = false;
		this.requestNatalTnp();
		if (this.state.showTransit) this.requestTransit();
		this.loadSynastryCharts(false); // WP-9:恢复持久化的叠盘人 → 拉其盘点
		if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);
		// 监听中间盘列尺寸变化(含 tab 由隐藏→显示时 0→真实尺寸),据此最大化盘 size。
		if (typeof ResizeObserver !== 'undefined' && this._host){
			this._ro = new ResizeObserver(() => this._measure());
			this._ro.observe(this._host);
		}
		this._measure();
	}
	componentWillUnmount(){
		this.unmounted = true;
		if (typeof window !== 'undefined') window.removeEventListener('resize', this._onResize);
		if (this._ro){ try { this._ro.disconnect(); } catch (e) { /* noop */ } this._ro = null; }
	}
	_onResize(){ if (!this.unmounted) { this.setState({ vh: window.innerHeight }); this._measure(); } }
	// 实测中间盘列的内容框宽/高(列为 grid 居中 + overflow:hidden,故按其 client 尺寸取 min 即「方框内最大」)。
	_measure(){
		if (this.unmounted || !this._host) return;
		const col = this._host.querySelector('.horosa-midpoint-chart-col');
		if (!col) return;
		const w = col.clientWidth, h = col.clientHeight;
		if (w > 0 && h > 0 && (Math.abs(w - this.state.colW) > 2 || Math.abs(h - this.state.colH) > 2)) this.setState({ colW: w, colH: h });
	}
	componentDidUpdate(prev, prevState){
		if (prev.fields !== this.props.fields) {
			// 改本命 → 拨回默认地点(null=同本命),否则用旧本命的覆盖坐标算新本命的行运,误导。
			this.setState({ saArcDirected: 0, saAge: 0, transitLat: null, transitLon: null, saLat: null, saLon: null });
			this.requestNatalTnp();
			if (this.state.showTransit) this.requestTransit();
		}
		// WP-9:本命/页面 fieldsAry 变 → 叠盘人盘点失效,强制重拉(同 transit 因 school 换算也需重发)。
		if (prev.fields !== this.props.fields || prev.fieldsAry !== this.props.fieldsAry) {
			this.setState({ synastryPersonPoints: {} }, () => this.loadSynastryCharts(true));
		} else if (prevState && prevState.school !== this.state.school) {
			this.loadSynastryCharts(true); // 流派换 → midpoint 参数变,重拉 TNP
		}
		// TNP 关 → 即时裁剪现有 readout(否则上次拖动留下的 TNP 行还在;中点树由 render 即时重算,无需处理)。
		if (prevState && prevState.showTnp !== this.state.showTnp && !this.state.showTnp){
			const isTnp = (id) => AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT;
			const filtered = (this.state.readout || []).filter((h) => {
				if (h.kind === 'body') return !isTnp(h.id);
				return !isTnp(h.a) && !isTnp(h.b);
			});
			if (filtered.length !== (this.state.readout || []).length) this.setState({ readout: filtered });
		}
	}
	toggleSolarArc(v){ this.saveDisp({ showSolarArc: v }); }

	async requestNatalTnp(){
		const params = fieldsToParams(this.props.fields);
		const perr = dialParamsError(params);
		if (perr) { if (!this.unmounted) this.setState({ dataNote: perr }); return; }
		if (!this.unmounted && this.state.dataNote) this.setState({ dataNote: null });
		try {
			const data = await request(`${Constants.ServerRoot}/germany/midpoint`, { body: JSON.stringify({ ...params, ...schoolRequestParams(this.state) }), silent: true });
			const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			if (!this.unmounted && result) {
				const patch = {};
				if (Array.isArray(result.tnp)) patch.natalTnp = result.tnp;
				// 赤纬接触(WP-11):后端缺该字段(declination:false 或老后端)→ 存 null,面板显「需后端赤纬数据」。
				patch.natalDecl = (result.declination && typeof result.declination === 'object') ? result.declination : null;
				this.setState(patch);
			}
		} catch (e) { /* 静默 */ }
	}

	async requestTransit(){
		const base = fieldsToParams(this.props.fields);
		if (dialParamsError(base)) return; // 缺出生地经纬度等 → 不发 transit /chart，避免 param error 提示
		// 行运时刻可调：state.transitTime(moment)优先，否则此刻。
		const tt = this.state.transitTime;
		const dstr = tt ? tt.format('YYYY/MM/DD') : (() => { const n = new Date(); return `${n.getFullYear()}/${pad(n.getMonth() + 1)}/${pad(n.getDate())}`; })();
		const tstr = tt ? tt.format('HH:mm:ss') : (() => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}:00`; })();
		// 行运地点可调：null=同本命；显式数字才覆盖（relocated transit）。
		const overrideLat = this.state.transitLat, overrideLon = this.state.transitLon;
		const loc = (overrideLat != null && overrideLon != null) ? { lat: overrideLat, lon: overrideLon, gpsLat: overrideLat, gpsLon: overrideLon } : {};
		const params = { ...base, ...loc, date: dstr, time: tstr };
		try {
			const [chartData, mpData] = await Promise.all([
				request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify({ ...params, cid: null }), silent: true }),
				request(`${Constants.ServerRoot}/germany/midpoint`, { body: JSON.stringify({ ...params, ...schoolRequestParams(this.state) }), silent: true }),
			]);
			const chartObj = chartData && chartData[Constants.ResultKey] ? chartData[Constants.ResultKey] : null;
			const mp = mpData && mpData[Constants.ResultKey] ? mpData[Constants.ResultKey] : null;
			const pts = chartToPoints(chartObj);
			// TNP 透传(过滤交给 buildRings 统一裁剪,避免开关时还需重发请求);带 lonspeed 供逆行标记。
			if (mp && Array.isArray(mp.tnp)) mp.tnp.forEach((t) => pts.push({ id: t.id, lon: t.lon, speed: Number.isFinite(Number(t.lonspeed)) ? Number(t.lonspeed) : null }));
			if (!this.unmounted) this.setState({ transitPoints: pts });
		} catch (e) { /* 静默 */ }
	}

	// WP-9:取某「叠盘人」(当前页盘或命盘库盘)的盘点(行星+三王+交点+Asc/MC + TNP)。
	// 复用 requestTransit 同款 /chart + /germany/midpoint(后端零碰);params 已由调用方按来源构好
	//   (当前盘→fieldsToParams / 库盘→libraryChartParams),此处只管发请求落盘点。
	async requestPersonChart(personId, params){
		if (dialParamsError(params)) return; // 缺出生信息 → 不发请求
		try {
			const [chartData, mpData] = await Promise.all([
				request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify({ ...params, cid: null }), silent: true }),
				request(`${Constants.ServerRoot}/germany/midpoint`, { body: JSON.stringify({ ...params, ...schoolRequestParams(this.state) }), silent: true }),
			]);
			const chartObj = chartData && chartData[Constants.ResultKey] ? chartData[Constants.ResultKey] : null;
			const mp = mpData && mpData[Constants.ResultKey] ? mpData[Constants.ResultKey] : null;
			const pts = chartToPoints(chartObj);
			if (mp && Array.isArray(mp.tnp)) mp.tnp.forEach((t) => pts.push({ id: t.id, lon: t.lon, speed: Number.isFinite(Number(t.lonspeed)) ? Number(t.lonspeed) : null }));
			if (!this.unmounted) this.setState((s) => ({ synastryPersonPoints: { ...s.synastryPersonPoints, [personId]: pts } }));
		} catch (e) { /* 静默 */ }
	}

	// 拉取所有当前选中但尚未缓存的叠盘人盘点(切人/切流派后调用)。
	// params 按来源构建:当前盘→fieldsToParams(fields);库盘→libraryChartParams(record)。
	loadSynastryCharts(force){
		const people = buildPersonList(this.props.fieldsAry);
		const paramsById = {};
		people.forEach((p) => {
			paramsById[p.id] = p.source === 'library' ? libraryChartParams(p.record) : fieldsToParams(p.fields);
		});
		(this.state.synastryPeople || []).slice(0, SYN_MAX).forEach((id) => {
			const params = paramsById[id];
			if (!params) return; // 该人已不在候选(页面盘换 / 库盘被删)→ 跳过
			if (force || !this.state.synastryPersonPoints[id]) this.requestPersonChart(id, params);
		});
	}

	// 左栏「叠盘层」多选改变:存名(上限 SYN_MAX)+ 拉新人盘点。
	changeSynastryPeople(vals){
		const next = (Array.isArray(vals) ? vals : []).slice(0, SYN_MAX);
		this.saveDisp({ synastryPeople: next });
		this.setState({ synastryPeople: next }, () => this.loadSynastryCharts(false));
	}

	// WP-10:校时事件改变(来自 UranianRectify)。state 存 moment;持久化转 ISO(date.format)。
	onRectifyEventsChange(events){
		const evs = Array.isArray(events) ? events : [];
		this.setState({ rectifyEvents: evs });
		const persist = evs.map((e) => ({
			label: e && e.label ? `${e.label}` : '',
			type: e && e.type ? `${e.type}` : 'other',
			date: e && e.date && typeof e.date.format === 'function' ? e.date.format('YYYY-MM-DD') : null,
		}));
		saveUranianDisplay({ rectifyEvents: persist });
	}

	natalPoints(){
		const pts = chartToPoints(this.props.chart);
		// 全量入 + filterByTnp 在出口处裁剪,这样 TNP 开关切换无需重发后端请求,即时反映。
		(this.state.natalTnp || []).forEach((t) => pts.push({ id: t.id, lon: t.lon, speed: Number.isFinite(Number(t.lonspeed)) ? Number(t.lonspeed) : null }));
		pts.push({ id: AstroConst.ARIES_POINT, lon: 0 }); // 白羊点/世界轴 = 0°（=AR 对称图）
		return filterByTnp(pts, this.state.showTnp);
	}

	// 真太阳弧：SA = λ_Sun(出生 + age 年) − λ_Sun(出生)，1 历日 = 1 年（推荐默认）。
	async requestSolarArc(){
		const base = fieldsToParams(this.props.fields);
		const natalSun = sunLon(this.props.chart);
		const birth = this.props.fields && this.props.fields.date ? this.props.fields.date.value : null;
		const ms = birthEpochMs(birth);
		if (dialParamsError(base) || natalSun == null || !Number.isFinite(ms)) return;
		const ageYears = (Date.now() - ms) / (86400000 * 365.2422);
		const d = new Date(ms + ageYears * 86400000); // 出生 + age 日（1日=1年二次推进）
		const overrideLat = this.state.saLat, overrideLon = this.state.saLon;
		const loc = (overrideLat != null && overrideLon != null) ? { lat: overrideLat, lon: overrideLon, gpsLat: overrideLat, gpsLon: overrideLon } : {};
		const params = { ...base, ...loc, date: `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` };
		try {
			const chartData = await request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify({ ...params, cid: null }), silent: true });
			const co = chartData && chartData[Constants.ResultKey] ? chartData[Constants.ResultKey] : null;
			const progSun = sunLon(co);
			if (progSun != null && !this.unmounted) this.setState({ saArcDeg: (((progSun - natalSun) % 360) + 360) % 360 });
		} catch (e) { /* 退回近似 */ }
	}

	solarArcDeg(){
		if (this.state.saArcDeg != null) return this.state.saArcDeg; // 真太阳弧
		try {
			const birth = this.props.fields && this.props.fields.date ? this.props.fields.date.value : null;
			const ms = birthEpochMs(birth);
			if (!Number.isFinite(ms)) return 0;
			const days = (Date.now() - ms) / 86400000;
			return Math.max(0, days / 365.2422 * 0.9856473); // 退回 Naibod 近似
		} catch (e) { return 0; }
	}

	// 叠盘人 id → 唯一显示名(供环标签/接触表/读数 ring tag/色点共用一致文案)。
	//   当前盘记 '人名(当前)';库盘记人名,库内同名或与当前盘撞名时后缀 ' ·库'/序号以保唯一(ringTone 按文案键控)。
	personLabelMap(){
		const list = buildPersonList(this.props.fieldsAry);
		const byId = {}; const used = {};
		list.forEach((p) => {
			let base = p.source === 'current' ? `${p.label}（当前）` : `${p.label}`;
			let label = base; let n = 2;
			while (used[label]) { label = `${base} ·${n}`; n += 1; } // 同名库盘 → 后缀序号保唯一
			used[label] = true;
			byId[p.id] = label;
		});
		return byId;
	}

	buildRings(){
		const natalPts = this.natalPoints();
		const rings = [{ key: 'natal', label: '本命', points: natalPts }];
		if (this.state.showTransit && this.state.transitPoints) {
			rings.push({ key: 'transit', label: '行运', points: filterByTnp(this.state.transitPoints, this.state.showTnp) });
		}
		// 太阳弧=交互式向运盘：初始贴本命(不预移)，拖动该环=向运,环旋转量即定向弧→反推年龄(见 onSaArc)。
		if (this.state.showSolarArc) {
			rings.push({ key: 'solararc', label: '太阳弧', points: natalPts });
		}
		// WP-9 合盘人环(最多 SYN_MAX 人):每位选中且已拉到盘点的人各一环,TNP 过滤随全局开关。
		//   环标签=人名(经 personLabelMap 去重),与右栏接触表/色点同源,ringTone 也按此键控。
		const labelMap = this.personLabelMap();
		(this.state.synastryPeople || []).slice(0, SYN_MAX).forEach((id, idx) => {
			const pts = this.state.synastryPersonPoints[id];
			if (Array.isArray(pts) && pts.length) {
				rings.push({ key: `syn${idx}`, label: labelMap[id] || id, points: filterByTnp(pts, this.state.showTnp), synastry: true });
			}
		});
		return rings;
	}

	onReadout(readout){ this.setState({ readout }); }
	// 太阳弧环被拖动 → 报告定向弧(黄道度)；按 SA key 反推对应年龄。
	onSaArc(arc){
		const a = ((Number(arc) % 360) + 360) % 360;
		const rate = this.state.saKey === 'oneDeg' ? 1.0 : 0.9856473354; // 1°/年 或 Naibod
		this.setState({ saArcDirected: a, saAge: a / rate });
	}

	saveDisp(patch){ this.setState(patch); saveUranianDisplay(patch); }
	toggleTransit(v){ this.saveDisp({ showTransit: v }); if (v) this.requestTransit(); }

	// WP-3:由出生时间(birthEpochMs)算当前周岁,供「按当前年龄填充」差值表目标年龄。缺出生信息→null。
	currentAgeYears(){
		const birth = this.props.fields && this.props.fields.date ? this.props.fields.date.value : null;
		const ms = birthEpochMs(birth);
		if (!Number.isFinite(ms)) return null;
		const y = (Date.now() - ms) / (86400000 * 365.2422);
		return y > 0 ? Math.round(y * 10) / 10 : 0;
	}

	// 切流派:一次性套该派默认(虚星/盘基/中点 orb/个人点 orb/十字指针/宫框/宇宙图盘式),之后用户可逐项覆盖。
	// 宇宙生物学(cosmo)建议宇宙图盘式;classic 复原现状(虚星开/orb1/无十字指针/有宫框/折叠盘)=零回归。
	// 写完默认后:重发后端(虚星/orb/personalOrb 经 schoolRequestParams 换算)+ 行运(若开)。
	changeSchool(school){
		const p = presetForSchool(school);
		const patch = {
			school,
			dialBase: p.dialBase,
			showTnp: p.includeTnp,
			orb: p.orbMidpoint,
			orbPersonal: p.orbPersonal,
			crossPointer: p.crossPointer,
			showHouseFrames: p.showHouseFrames,
			cosmogram: !!p.cosmogramDefault,
			// 互斥盘式三选一:宇宙生物学默认宇宙图;其余流派若当前是宇宙图则回落折叠盘(避免残留)。
			dialStyle: p.cosmogramDefault ? 'cosmogram' : (this.state.dialStyle === 'cosmogram' ? 'folded' : this.state.dialStyle),
		};
		this.setState(patch, () => {
			this.requestNatalTnp();
			if (this.state.showTransit) this.requestTransit();
		});
		saveUranianDisplay(patch);
	}

	buildTreeData(tree){
		return Object.keys(tree).map((pid) => ({
			title: (<span><b>{glyphOf(pid)}</b> <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>· {tree[pid].length} 组</span></span>),
			key: pid,
			children: tree[pid].map((r, i) => ({
				title: (<span>{glyphOf(r.a)} <span style={{ color: 'var(--horosa-text-soft)' }}>/</span> {glyphOf(r.b)} <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>- {r.sep.toFixed(2)}°</span></span>),
				key: pid + '_' + i, isLeaf: true,
			})),
		}));
	}

	// 三层叠盘信息（本命/行运/太阳弧）——让用户清楚每环是什么、对应何时。
	// 验收口径(2026-06-02):太阳弧 info 文案精简到只剩用户关心的弧度+年龄,避免左栏被截断。
	layerRows(){
		const f = this.props.fields || {};
		const fmtF = (k, p) => { const v = f[k] && f[k].value; return (v && v.format) ? v.format(p) : '—'; };
		const birthText = `${fmtF('date', 'YYYY-MM-DD')} ${fmtF('time', 'HH:mm')}`.trim();
		const now = new Date();
		const nowText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
		const transitText = this.state.transitTime ? this.state.transitTime.format('YYYY-MM-DD HH:mm') : `此刻 ${nowText}`;
		const saArc = this.state.saArcDirected || 0;
		const saAge = this.state.saAge || 0;
		const saKeyLabel = this.state.saKey === 'oneDeg' ? '1°/年' : 'Naibod';
		return [
			{ key: 'natal', label: '本命', dot: 'var(--horosa-text-soft)', info: `出生 ${birthText}`, locked: true, on: true },
			{ key: 'transit', label: '行运', dot: 'var(--horosa-jx-xiong)', info: transitText, on: this.state.showTransit, toggle: (v) => this.toggleTransit(v) },
			{ key: 'solararc', label: '太阳弧', dot: 'var(--horosa-jade)', info: `弧 ${saArc.toFixed(1)}° → 约 ${saAge.toFixed(1)} 岁（${saKeyLabel}）`, on: this.state.showSolarArc, toggle: (v) => this.toggleSolarArc(v) },
		];
	}

	// 当前流派的个人点集(随 state.school 派生:汉堡六点+白羊 / 宇宙生物学 Basic Five)。
	personalSet(){ return personalSetForSchool(this.state.school); }

	renderDial(size, rings){
		const common = {
			rings, base: this.state.dialBase, orb: this.state.orb,
			showTnp: this.state.showTnp, size, onCursorChange: this.onReadout, onSaArc: this.onSaArc,
			personal: this.personalSet(), onlyPersonal: this.state.onlyPersonal, orbPersonal: this.state.orbPersonal,
			showAntiscia: this.state.showAntiscia,
			crossPointer: this.state.crossPointer, showHouseFrames: this.state.showHouseFrames,
			// WP-5:和点/差距读数透传到指针 readout(默认 false → cursorReadout 不传 sum/arc，行为零回归)。
			showSumPoints: this.state.showSumPoints, showArcOpenings: this.state.showArcOpenings,
		};
		// 盘式三态互斥:宇宙图(cosmogram)=真位 360° + 内层折叠记号环;modulus=多环模数盘;其余=折叠盘。
		if (this.state.dialStyle === 'cosmogram') return <UranianCosmogram {...common} />;
		if (this.state.dialStyle === 'modulus') return <UranianModulusDial {...common} />;
		return <UranianDial {...common} />;
	}

	// 行运/SA 地点输入框（占位=本命的 lat/lon）。空=用本命；填数=覆盖。
	renderLocOverride(latKey, lonKey, onCommit){
		const natalLat = fv(this.props.fields, 'lat');
		const natalLon = fv(this.props.fields, 'lon');
		const set = (k) => (v) => { this.setState({ [k]: parseNum(v) }, () => { if (onCommit) onCommit(); }); };
		const cell = { display: 'inline-block', width: 'calc(50% - 4px)' };
		const headStyle = { fontSize: 11, color: 'var(--horosa-text-soft)', marginBottom: 3 };
		return (
			<div>
				<div style={headStyle}>地点（空=同本命）</div>
				<div style={{ display: 'flex', gap: 8 }}>
					<div style={cell}>
						<XQInputNumber size="small" placeholder={natalLat != null ? `${natalLat}` : '纬度'} value={this.state[latKey]}
							onChange={set(latKey)} step={0.001} style={{ width: '100%' }} controls={false} />
					</div>
					<div style={cell}>
						<XQInputNumber size="small" placeholder={natalLon != null ? `${natalLon}` : '经度'} value={this.state[lonKey]}
							onChange={set(lonKey)} step={0.001} style={{ width: '100%' }} controls={false} />
					</div>
				</div>
			</div>
		);
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const rings = this.buildRings();
		const natalPts = rings[0].points;
		// 中间盘 size:按实测「中间列」的内容框最大化——取列宽、列高(减盘下 24 padding)较小者,填满方框且永不超出被裁。
		// 列尺寸由 _measure(ResizeObserver)实测;未测得时用 viewport 估算兜底;vh-140 为防底部 Dock 的二级兜底。
		const vh = this.state.vh || 900;
		const fbColW = Math.round((typeof window !== 'undefined' ? window.innerWidth : 1280) * 0.56);
		const colW = this.state.colW || fbColW;
		const colH = this.state.colH || (vh - 240);
		const size = Math.max(420, Math.min(colW - 8, colH - 28, vh - 140));
		// 左右栏滚动 maxHeight:与盘同步,且至少 380(再小就让用户内部滚动);overflowY:auto 即可独立下滑,
		// 修「窗口过小时左/右栏被遮挡且无法下滑」(用户验收口径)。inner div 须 width:100% 否则收缩 h=0。
		const sideMaxH = Math.max(380, vh - 220);
		// 个人点集随流派派生(classic 汉堡六点+白羊 / cosmo Basic Five);TNP 过滤已在 natalPoints() 入口完成。
		// 全部派生项都从完整 state 计算:school/盘基/虚星/orb/orbPersonal 任一改变都全量重算重绘。
		const personalSet = this.personalSet();
		const treeOpts = { personal: personalSet, onlyPersonal: this.state.onlyPersonal, orbPersonal: this.state.orbPersonal };
		const tree = this.state.showPicture ? midpointTree(natalPts, this.state.dialBase, this.state.orb, treeOpts) : {};
		// 行星图(A+B−C=D)/中点列表/映点接触:都在本命点集上算(锚点=个人点∪TNP,排序同优先级)。
		const scanOpts = { personal: personalSet, uranian: URANIAN_SET, orbPersonal: this.state.orbPersonal };
		const pictures = this.state.showPlanetPicture ? planetaryPictures(natalPts, this.state.dialBase, this.state.orb, { ...scanOpts, limit: 40 }) : [];
		const mpList = this.state.showMidpointList ? midpointList(natalPts, this.state.dialBase, scanOpts) : [];
		const spiegel = this.state.showAntiscia ? spiegelContacts(natalPts, this.state.dialBase, this.state.orb, scanOpts) : [];
		// WP-3 差值表:本命点集的太阳弧到期(全/半/倍 + 单因子白羊档),按 saKey 换算到期年龄,命中目标年龄高亮。
		// maxAge=120 兜底(避免极大年龄行);targetAge 由 InputNumber 控制,win=1。
		const diffRows = this.state.showDiffList
			? solarArcDirections(natalPts, this.state.dialBase, { saKey: this.state.saKey, targetAge: this.state.diffTargetAge, win: 1, maxAge: 120 })
			: [];
		// 叠盘人统一文案/上色基底:id→唯一显示名(personLabelMap)+ 候选清单(当前盘∪命盘库)。
		const personLabelById = this.personLabelMap();
		const personList = buildPersonList(this.props.fieldsAry);
		const synContacts = [];
		(this.state.synastryPeople || []).slice(0, SYN_MAX).forEach((id, idx) => {
			const pts = this.state.synastryPersonPoints[id];
			if (Array.isArray(pts) && pts.length){
				const bPts = filterByTnp(pts, this.state.showTnp);
				const cs = crossContacts(natalPts, bPts, this.state.dialBase, this.state.orb);
				synContacts.push({ id, label: personLabelById[id] || id, tone: SYN_TONE[idx] || SYN_TONE[0], rows: cs });
			}
		});
		const natalAngleLon = (aid) => { const o = (natalPts || []).find((p) => p.id === aid); return o && Number.isFinite(Number(o.lon)) ? Number(o.lon) : null; };
		const natalMc = natalAngleLon(AstroConst.MC);
		const natalAsc = natalAngleLon(AstroConst.ASC);
		const birthMoment = (() => { const ms = birthEpochMs(this.props.fields && this.props.fields.date ? this.props.fields.date.value : null); return Number.isFinite(ms) ? moment(ms) : null; })();
		// 环色令牌化:本命=主文字色,行运=凶红,太阳弧=玉绿(全用 --horosa-* 语义令牌,暗黑/明亮自适应)。
		const ringTone = { 本命: 'var(--horosa-text)', 行运: 'var(--horosa-jx-xiong)', 太阳弧: 'var(--horosa-jade)' };
		// WP-9:合盘人环按其人名上色(与盘 RING_TONE syn0..3 同族);ringTone 按【显示名】键控
		//   (读数 tag [ring.label] 用同一文案查色),环标签即 personLabelById[id]。
		(this.state.synastryPeople || []).slice(0, SYN_MAX).forEach((id, idx) => { ringTone[personLabelById[id] || id] = SYN_TONE[idx] || SYN_TONE[0]; });
		// WP-9:叠盘层可选人 = 当前页盘 ∪ 命盘库(libraryChartParams 复用既有拉盘)。已达 SYN_MAX 上限时禁选未选项。
		//   下拉用分组(当前盘 / 命盘库),标注来源区分「当前盘」vs 库内盘名。
		const isAtMax = (this.state.synastryPeople || []).length >= SYN_MAX;
		const optOf = (p) => ({
			label: p.label, value: p.id,
			disabled: isAtMax && (this.state.synastryPeople || []).indexOf(p.id) < 0,
		});
		const curOpts = personList.filter((p) => p.source === 'current').map(optOf);
		const libOpts = personList.filter((p) => p.source === 'library').map(optOf);
		const personOptions = [
			curOpts.length ? { label: '当前盘', options: curOpts } : null,
			libOpts.length ? { label: '命盘库', options: libOpts } : null,
		].filter(Boolean);
		const personOptionCount = curOpts.length + libOpts.length;
		// 观象左栏 P2:左栏四节统一 XQSideSection(图标+可折叠,horosa-uranian-section 管节间距与行文字色)。
		const rowSty = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
		const layers = this.layerRows();

		const settings = (
			<div style={{ width: '100%' }}>
				{/* 流派软预设(WP-1):选派=套该派默认(虚星/盘基/容许度/十字指针/宫框/盘式),之下控件可逐项微调。 */}
				{/* 下拉栏(XQSelect=antd Select)更紧凑;onChange 直接给 value(非 e.target.value)。changeSchool 逻辑不变。 */}
				<XQSideSection iconName={sideSectionIcon('school')} title="流派" storageKey="germany.school" className="horosa-uranian-section horosa-side-input-section">
					<XQSelect value={this.state.school} options={SCHOOL_OPTIONS} onChange={(v) => this.changeSchool(v)} className="horosa-uranian-school" size="small" style={{ width: '100%' }} />
					<div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 6 }}>
						选派套该派默认；下方控件可逐项覆盖。
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('chartStyle')} title="盘式与盘基" storageKey="germany.dial" className="horosa-uranian-section horosa-side-input-section">
					{/* 盘式三态互斥:折叠盘 / 多环模数盘 / 宇宙图(XQSegmented onChange 同 Radio.Group:e.target.value)。 */}
					<div className="horosa-uranian-dialstyle">
						<XQSegmented size="small" value={this.state.dialStyle} onChange={(e) => this.saveDisp({ dialStyle: e.target.value, cosmogram: e.target.value === 'cosmogram' })}
							options={[{ value: 'folded', label: '折叠盘' }, { value: 'modulus', label: '模数盘' }, { value: 'cosmogram', label: '宇宙图' }]} />
					</div>
					<div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, marginBottom: 4 }}>盘基（模数）</div>
					<XQSelect value={this.state.dialBase} onChange={(v) => this.saveDisp({ dialBase: Number(v) })} style={{ width: '100%' }} size="small"
						options={URANIAN_DIAL_BASES.map((b) => ({ value: b, label: `${dialBaseLabel(b)} 盘` }))} />
					{/* 常用盘基快捷:90°(H4 默认)/45°(H8 宇宙生物学)/22.5°(H16)。 */}
					<div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
						{QUICK_BASES.map((b) => (
							<button key={b} type="button" onClick={() => this.saveDisp({ dialBase: b })}
								style={{ flex: 1, fontSize: 11, padding: '2px 0', cursor: 'pointer', borderRadius: 4,
									border: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.12))',
									background: this.state.dialBase === b ? 'var(--horosa-accent-soft, rgba(91,100,112,0.16))' : 'transparent',
									color: 'inherit', fontWeight: this.state.dialBase === b ? 600 : 400 }}>
								{dialBaseLabel(b)}
							</button>
						))}
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('planets')} title="叠盘层（除本命外可拖动）" storageKey="germany.layers" className="horosa-uranian-section horosa-side-input-section">
					{layers.map((L) => (
						<div key={L.key} style={{ ...rowSty, padding: '5px 0', borderBottom: L.key !== 'solararc' ? '1px solid var(--horosa-border-soft, rgba(0,0,0,0.04))' : 'none' }}>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div><span style={{ color: L.dot, marginRight: 5 }}>●</span><b>{L.label}</b>{L.locked ? <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}> · 锁定</span> : null}</div>
								{/* 不截断:换行而非省略号(用户验收口径)。 */}
								<div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginLeft: 16, wordBreak: 'break-word', whiteSpace: 'normal' }}>{L.info}</div>
							</div>
							{L.locked ? <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>内圈</span> : <XQSwitch size="small" checked={L.on} onChange={L.toggle} />}
						</div>
					))}
					{this.state.showTransit ? (
						<div style={{ marginTop: 8 }}>
							<div style={{ fontSize: 11, color: 'var(--horosa-text-soft)', marginBottom: 3 }}>行运时刻</div>
							<XQDatePicker size="small" showTime format="YYYY-MM-DD HH:mm" value={this.state.transitTime}
								placeholder="此刻" style={{ width: '100%' }}
								onChange={(v) => this.setState({ transitTime: v }, () => this.requestTransit())} />
							<div style={{ marginTop: 6 }}>{this.renderLocOverride('transitLat', 'transitLon', () => this.requestTransit())}</div>
						</div>
					) : null}
					{this.state.showSolarArc ? (
						<div style={{ marginTop: 10 }}>
							<div style={rowSty}>
								<span style={{ fontSize: 11, color: 'var(--horosa-text-soft)' }}>太阳弧换算</span>
								<XQSegmented size="small" value={this.state.saKey} onChange={(e) => { const k = e.target.value; this.saveDisp({ saKey: k }); const rate = k === 'oneDeg' ? 1.0 : 0.9856473354; this.setState({ saAge: (this.state.saArcDirected || 0) / rate }); }}
									options={[{ value: 'naibod', label: 'Naibod' }, { value: 'oneDeg', label: '1°/年' }]} />
							</div>
							<div style={{ marginTop: 6 }}>{this.renderLocOverride('saLat', 'saLon')}</div>
						</div>
					) : null}
					{/* WP-9 合盘叠盘:选当前页盘或命盘库盘叠加,最多 4 人;每人各成一环,接触表见右栏。 */}
					<div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.06))' }}>
						<div style={{ fontSize: 11, color: 'var(--horosa-text-soft)', marginBottom: 4 }}>合盘叠加（最多 {SYN_MAX} 人 · 当前盘/命盘库）</div>
						<XQSelect mode="multiple" size="small" allowClear style={{ width: '100%' }} optionFilterProp="label"
							className="horosa-uranian-syn-select"
							placeholder={personOptionCount ? '选择叠盘人（当前盘 / 命盘库）' : '无可叠加的盘'}
							value={this.state.synastryPeople} onChange={this.changeSynastryPeople}
							options={personOptions} maxTagCount={2} />
						{(this.state.synastryPeople || []).length > 0 ? (
							<div style={{ marginTop: 6 }}>
								{(this.state.synastryPeople || []).slice(0, SYN_MAX).map((id, idx) => (
									<span key={id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, marginRight: 10 }}>
										<span style={{ color: SYN_TONE[idx] || SYN_TONE[0], marginRight: 4 }}>●</span>
										<span style={{ color: 'var(--horosa-text-soft)' }}>{personLabelById[id] || id}{this.state.synastryPersonPoints[id] ? '' : ' …'}</span>
									</span>
								))}
							</div>
						) : null}
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('display')} title="显示与读数" storageKey="germany.display" className="horosa-uranian-section horosa-side-input-section">
					<div style={{ ...rowSty, marginBottom: 8 }}><span>TNP 虚星</span><XQSwitch size="small" checked={this.state.showTnp} onChange={(v) => this.saveDisp({ showTnp: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>中点树扫描</span><XQSwitch size="small" checked={this.state.showPicture} onChange={(v) => this.saveDisp({ showPicture: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>仅含个人点</span><XQSwitch size="small" checked={this.state.onlyPersonal} onChange={(v) => this.saveDisp({ onlyPersonal: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>行星图解算 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>A+B−C=D</span></span><XQSwitch size="small" checked={this.state.showPlanetPicture} onChange={(v) => this.saveDisp({ showPlanetPicture: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>中点列表</span><XQSwitch size="small" checked={this.state.showMidpointList} onChange={(v) => this.saveDisp({ showMidpointList: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>映点 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>Spiegelpunkt</span></span><XQSwitch size="small" checked={this.state.showAntiscia} onChange={(v) => this.saveDisp({ showAntiscia: v })} /></div>
					{/* WP-5:指针读数追加和点(A+B)/差距(A∠B)项;默认关→cursorReadout 行为零回归。 */}
					<div style={{ ...rowSty, marginBottom: 8 }}><span>和点读数 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>A+B</span></span><XQSwitch size="small" checked={this.state.showSumPoints} onChange={(v) => this.saveDisp({ showSumPoints: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>差距读数 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>A∠B</span></span><XQSwitch size="small" checked={this.state.showArcOpenings} onChange={(v) => this.saveDisp({ showArcOpenings: v })} /></div>
					{/* WP-3:差值表(太阳弧到期 全/半/倍 + 目标年龄高亮);开启时一并展开 diff 面板。 */}
					<div style={{ ...rowSty, marginBottom: 8 }}><span>差值表 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>太阳弧到期</span></span><XQSwitch size="small" checked={this.state.showDiffList} onChange={(v) => { const op = Array.isArray(this.state.openPanels) ? this.state.openPanels.slice() : []; if (v && op.indexOf('diff') < 0) op.push('diff'); this.saveDisp({ showDiffList: v, openPanels: op }); }} /></div>
					{/* 流派盘面附加(随流派默认,可逐项覆盖):十字指针 22.5° 四向辅助 / 六宫框。 */}
					<div style={{ ...rowSty, marginBottom: 8 }}><span>十字指针 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>22.5°</span></span><XQSwitch size="small" checked={this.state.crossPointer} onChange={(v) => this.saveDisp({ crossPointer: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 8 }}><span>六宫框</span><XQSwitch size="small" checked={this.state.showHouseFrames} onChange={(v) => this.saveDisp({ showHouseFrames: v })} /></div>
					<div style={{ ...rowSty, marginBottom: 10 }}><span>赤纬接触 <span style={{ color: 'var(--horosa-text-soft)', fontSize: 11 }}>平行/反平行</span></span><XQSwitch size="small" checked={this.state.showDeclination} onChange={(v) => { const op = Array.isArray(this.state.openPanels) ? this.state.openPanels.slice() : []; if (v && op.indexOf('parallel') < 0) op.push('parallel'); this.saveDisp({ showDeclination: v, openPanels: op }); if (v) { this.requestNatalTnp(); } }} /></div>
					<div style={{ marginBottom: 2, fontSize: 12 }}>容许度 <b>{this.state.orb}°</b></div>
					<Slider min={0.5} max={3} step={0.5} value={this.state.orb} onChange={(v) => this.saveDisp({ orb: v })} />
					{/* 个人点放宽容许度(Basic Five;下发后端 personalOrb,且前端读数/树/图同口径放宽)。 */}
					<div style={{ marginTop: 8, marginBottom: 2, fontSize: 12 }}>个人点容许度 <b>{this.state.orbPersonal}°</b></div>
					<Slider min={0.5} max={6} step={0.5} value={this.state.orbPersonal} onChange={(v) => this.saveDisp({ orbPersonal: v })} />
				</XQSideSection>
			</div>
		);

		// 指针读数:用短横线 '-' 标距(原希腊符像三角不友好);单行 nowrap 防换行;TNP 过滤已在源头完成(natalPoints/transit),此处直接信任。
		const readoutBody = this.state.readout.length === 0
			? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>拖动行运/太阳弧环或红指针，对齐处的星体/中点会列在这里。</div>
			: this.state.readout.slice(0, 60).map((h, i) => {
				// 中点='/'(近中点)、和点='+'(A+B)、差距='∠'(A∠B);body=单星;均按 sep 标距。
				const op = h.kind === 'sum' ? ' + ' : (h.kind === 'arc' ? ' ∠ ' : '/');
				// WP-6:命中来自十字指针副臂(±22.5/±67.5)时加 [十字] 前缀,与主臂直接对位区分。
				const crossTag = h.cross ? <span style={{ color: 'var(--horosa-accent, #c0392b)', fontSize: 11, fontWeight: 600 }}>[十字] </span> : null;
				// hover=造句义(增强):单星→基义;中点/和/差→标签对主题。
				const rowTip = h.kind === 'body' ? composeShort(h.id) : composeShort(h.a, h.b);
				return (
					<div key={i} title={rowTip} style={{ lineHeight: 2.0, fontSize: 13, whiteSpace: 'nowrap' }}>
						{rings.length > 1 ? <span style={{ color: ringTone[h.ring] || 'var(--horosa-text-soft)', fontSize: 11, fontWeight: 600 }}>[{h.ring}] </span> : null}
						{crossTag}
						{h.kind === 'body'
							? <span>轴 = <b>{glyphOf(h.id)}</b> <span style={{ color: 'var(--horosa-text-soft)' }}>- {h.sep.toFixed(2)}°</span></span>
							: <span>轴 = {glyphOf(h.a)}<span style={{ color: 'var(--horosa-text-soft)' }}>{op}</span>{glyphOf(h.b)} <span style={{ color: 'var(--horosa-text-soft)' }}>- {h.sep.toFixed(2)}°</span></span>}
					</div>
				);
			});

		const treeData = this.buildTreeData(tree);
		const treeBody = treeData.length === 0
			? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>容许度内暂无中点结构</div>
			: <Tree treeData={treeData} showLine={{ showLeafIcon: false }} blockNode selectable={false} defaultExpandedKeys={treeData.slice(0, 3).map((n) => n.key)} />;

		const rowLine = { lineHeight: 1.9, fontSize: 13, whiteSpace: 'nowrap' };
		const soft = { color: 'var(--horosa-text-soft)' };
		const empty = (t) => <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>{t}</div>;
		// 行星图 A+B−C=D:个人点/TNP 锚点,命中目标 D 高亮。
		const pictureBody = pictures.length === 0 ? empty('容许度内暂无行星图')
			: pictures.map((p, i) => (
				<div key={i} title={composeShort(p.a, p.b, p.d)} style={rowLine}>
					{glyphOf(p.a)}<span style={soft}> + </span>{glyphOf(p.b)}<span style={soft}> − </span>{glyphOf(p.c)}<span style={soft}> = </span><b>{glyphOf(p.d)}</b><span style={soft}> · {p.sep.toFixed(2)}°</span>
				</div>
			));
		// 中点扁平列表(含个人点 > TNP > 其他):显中点黄经位。
		const mpListBody = mpList.length === 0 ? empty('暂无中点')
			: mpList.slice(0, 150).map((m, i) => (
				<div key={i} title={composeShort(m.a, m.b)} style={rowLine}>
					{glyphOf(m.a)}<span style={soft}>/</span>{glyphOf(m.b)}<span style={soft}> · {m.lon.toFixed(2)}°</span>
				</div>
			));
		// 映点 Spiegelpunkt 接触对。
		const spiegelBody = spiegel.length === 0 ? empty('容许度内暂无映点接触')
			: spiegel.map((s, i) => (
				<div key={i} title={composeShort(s.a, s.b)} style={rowLine}>
					{glyphOf(s.a)}<span style={soft}> ⟷ </span>{glyphOf(s.b)}<span style={soft}> · {s.sep.toFixed(2)}°</span>
				</div>
			));
		// 右栏:可收放卡片(antd Collapse),头部左为标题/副标、右为数量徽标;展开项持久化 openPanels。
		const hdr = (title, sub, n) => (
			<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
				<span style={{ fontWeight: 600, fontSize: 13 }}>{title}{sub ? <span style={{ ...soft, fontSize: 11, fontWeight: 400, marginLeft: 5 }}>{sub}</span> : null}</span>
				{n != null ? <span className="horosa-panel-count">{n}</span> : null}
			</span>
		);
		// WP-3 差值表(太阳弧到期):目标年龄输入 + 可排序表格(A/B 字形、弧°、八度档、到期年龄、是否到期)。
		const OCT_LABEL = { full: '全', half: '半', double: '倍', aries: '白羊' };
		const curAge = this.currentAgeYears();
		const diffCols = [
			{ title: 'A', dataIndex: 'a', key: 'a', width: 38, render: (v) => glyphOf(v) },
			{ title: 'B', dataIndex: 'b', key: 'b', width: 38, render: (v) => (v == null ? <span style={soft}>—</span> : glyphOf(v)) },
			{ title: '弧°', dataIndex: 'arc', key: 'arc', width: 56, sorter: (x, y) => x.arc - y.arc, render: (v) => <span style={soft}>{v.toFixed(2)}</span> },
			{ title: '档', dataIndex: 'type', key: 'type', width: 50, render: (v, r) => <span>{OCT_LABEL[v] || v}{r.fold ? <span style={{ ...soft, fontSize: 10 }}> ′</span> : null}</span> },
			{ title: '到期(岁)', dataIndex: 'age', key: 'age', width: 72, defaultSortOrder: 'ascend', sorter: (x, y) => x.age - y.age, render: (v) => v.toFixed(1) },
			{ title: '到期', dataIndex: 'due', key: 'due', width: 44, render: (v) => (v ? <span style={{ color: 'var(--horosa-accent, #c0392b)', fontWeight: 600 }}>●</span> : <span style={soft}>·</span>) },
		];
		const diffBody = (
			<div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
					<span style={{ fontSize: 12 }}>目标年龄</span>
					<XQInputNumber size="small" min={0} max={120} step={1} value={this.state.diffTargetAge}
						onChange={(v) => this.saveDisp({ diffTargetAge: (v == null ? 0 : Number(v)) })} style={{ width: 78 }} />
					<button type="button" disabled={curAge == null}
						onClick={() => { if (curAge != null) this.saveDisp({ diffTargetAge: curAge }); }}
						style={{ fontSize: 11, padding: '2px 8px', cursor: curAge == null ? 'default' : 'pointer', borderRadius: 4,
							border: '1px solid var(--horosa-border-soft, rgba(0,0,0,0.12))', background: 'transparent', color: 'inherit', opacity: curAge == null ? 0.45 : 1 }}>
						按当前年龄填充{curAge != null ? `（${curAge}）` : ''}
					</button>
				</div>
				{diffRows.length === 0 ? empty('暂无太阳弧到期项') : (
					<Table className="horosa-uranian-difftable" size="small" rowKey={(r, i) => i} columns={diffCols} dataSource={diffRows}
						pagination={false} bordered={false}
						rowClassName={(r) => (r.due ? 'horosa-uranian-diff-due' : '')} />
				)}
			</div>
		);
		// WP-9 合盘接触表(参照 relative/MidpointInfo 风格):每位叠盘人一组,B 因子落 A 单点/中点轴。
		// 行式:glyph(a1)[/glyph(a2)] ← glyph(b) · sep°;落 日/月 中点轴最决定性(此处不另排序,纯按角距近者先)。
		const synCount = synContacts.reduce((n, g) => n + g.rows.length, 0);
		const isLuminaryAxis = (a1, a2) => a2 != null && ((a1 === AstroConst.SUN && a2 === AstroConst.MOON) || (a1 === AstroConst.MOON && a2 === AstroConst.SUN));
		const contactBody = rings.length < 2 ? empty('开启行运/太阳弧或叠加合盘人后，此处列接触')
			: (synContacts.length === 0 || synCount === 0) ? empty('容许度内暂无合盘接触')
			: synContacts.map((g) => (
				<div key={g.id} style={{ marginBottom: 8 }}>
					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
						<span style={{ color: g.tone, marginRight: 5 }}>●</span>{g.label}
						<span style={{ ...soft, fontSize: 11, fontWeight: 400, marginLeft: 5 }}>{g.rows.length} 接触</span>
					</div>
					{g.rows.length === 0 ? empty('—') : g.rows.slice(0, 60).map((c, i) => {
						const lum = isLuminaryAxis(c.a1, c.a2);
						return (
							<div key={i} title={c.a2 != null ? composeShort(c.a1, c.a2) : composeShort(c.a1)} style={{ ...rowLine, paddingLeft: 6 }}>
								{lum ? <span style={{ color: g.tone, fontWeight: 600, fontSize: 11 }}>[日月轴] </span> : null}
								{glyphOf(c.a1)}{c.a2 != null ? <span style={soft}>/{glyphOf(c.a2)}</span> : null}
								<span style={soft}> ← </span><b>{glyphOf(c.b)}</b>
								<span style={soft}> · {c.sep.toFixed(2)}°</span>
							</div>
						);
					})}
				</div>
			));
		// WP-10 校时工具(只读预览):独立组件,事件→弧→推进 MC/Asc 命中本命因子;不写回盘。
		const rectifyBody = (
			<UranianRectify
				events={this.state.rectifyEvents}
				onChange={this.onRectifyEventsChange}
				birth={birthMoment}
				natalPts={natalPts}
				mc={natalMc} asc={natalAsc}
				base={this.state.dialBase} orb={this.state.orb} saKey={this.state.saKey}
				glyphOf={glyphOf}
			/>
		);
		// WP-11 赤纬接触(平行/反平行):后端 declination 字段;平行≈合(同号)、反平行≈冲(异号)。
		//   后端缺该字段(关赤纬开关 / 老后端)→ 显「需后端赤纬数据」不崩。各点赤纬另列一览表。
		const decl = this.state.natalDecl;
		const declParCount = decl && Array.isArray(decl.parallel) ? decl.parallel.length : 0;
		const declCpCount = decl && Array.isArray(decl.contraParallel) ? decl.contraParallel.length : 0;
		const fmtDecl = (v) => (Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}°` : '—');
		const declRow = (p, op, i) => (
			<div key={i} title={composeShort(p.a, p.b)} style={rowLine}>
				{glyphOf(p.a)}<span style={soft}> {op} </span>{glyphOf(p.b)}
				<span style={soft}> · {fmtDecl(p.decA)} / {fmtDecl(p.decB)} · 差{Number.isFinite(Number(p.delta)) ? Number(p.delta).toFixed(2) : '—'}°</span>
			</div>
		);
		const declColsTbl = [
			{ title: '点', dataIndex: 'id', key: 'id', width: 60, render: (v) => glyphOf(v) },
			{ title: '赤纬', dataIndex: 'd', key: 'd', width: 76, sorter: (x, y) => x.d - y.d, render: (v) => <span style={soft}>{fmtDecl(v)}</span> },
		];
		const declTblRows = decl && decl.decls && typeof decl.decls === 'object'
			? Object.keys(decl.decls).map((id) => ({ id, d: Number(decl.decls[id]) })).filter((r) => Number.isFinite(r.d))
			: [];
		const parallelBody = !decl
			? empty('需后端赤纬数据（开启「赤纬接触」并重新排盘）')
			: (
				<div>
					<div style={{ fontSize: 12, fontWeight: 600, margin: '2px 0 3px' }}>
						平行 <span style={{ ...soft, fontSize: 11, fontWeight: 400 }}>≈合 · 同号</span>
						<span className="horosa-panel-count" style={{ marginLeft: 6 }}>{declParCount}</span>
					</div>
					{declParCount === 0 ? empty('容许度内暂无平行') : decl.parallel.map((p, i) => declRow(p, '∥', i))}
					<div style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 3px' }}>
						反平行 <span style={{ ...soft, fontSize: 11, fontWeight: 400 }}>≈冲 · 异号</span>
						<span className="horosa-panel-count" style={{ marginLeft: 6 }}>{declCpCount}</span>
					</div>
					{declCpCount === 0 ? empty('容许度内暂无反平行') : decl.contraParallel.map((p, i) => declRow(p, '⥮', i))}
					<div style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 3px' }}>各点赤纬</div>
					{declTblRows.length === 0 ? empty('暂无赤纬') : (
						<Table className="horosa-uranian-decltable" size="small" rowKey={(r) => r.id} columns={declColsTbl} dataSource={declTblRows}
							pagination={false} bordered={false} />
					)}
				</div>
			);
		// 右栏卡片定义(group=归属的分组 Tab)。受 showXXX/rings 控制的卡片仅在条件成立时入列。
		// 分组:reading 读数(指针读数+中点树) / midpoint 中点(中点列表+行星图+映点) /
		//       solararc 太阳弧(差值表) / contact 接触(合盘接触+赤纬接触) / rectify 校时(只读预览,独立成 Tab)。
		const panelDefs = [
			{ key: 'readout', group: 'reading', header: hdr('指针读数', null, this.state.readout.length || null), body: readoutBody, mh: 0.5 },
			{ key: 'tree', group: 'reading', header: hdr('中点树', null, treeData.length || null), body: treeBody, mh: 0.42 },
			this.state.showMidpointList && { key: 'list', group: 'midpoint', header: hdr('中点列表', null, mpList.length), body: mpListBody, mh: 0.4 },
			this.state.showPlanetPicture && { key: 'pic', group: 'midpoint', header: hdr('行星图', 'A+B−C=D', pictures.length), body: pictureBody, mh: 0.4 },
			this.state.showAntiscia && { key: 'spiegel', group: 'midpoint', header: hdr('映点', 'Spiegelpunkt', spiegel.length), body: spiegelBody, mh: 0.36 },
			this.state.showDiffList && { key: 'diff', group: 'solararc', header: hdr('差值表', '太阳弧到期', diffRows.length), body: diffBody, mh: 0.5 },
			rings.length >= 2 && { key: 'contact', group: 'contact', header: hdr('合盘接触', null, synCount || null), body: contactBody, mh: 0.5 },
			this.state.showDeclination && { key: 'parallel', group: 'contact', header: hdr('赤纬接触', '平行/反平行', decl ? (declParCount + declCpCount) || null : null), body: parallelBody, mh: 0.5 },
			// 校时(WP-10)独立成 group=rectify Tab:与「接触」语义分离(事件→生时反推工作流,非接触相位)。
			{ key: 'rectify', group: 'rectify', header: hdr('校时', '只读预览', (this.state.rectifyEvents || []).length || null), body: rectifyBody, mh: 0.6 },
		].filter(Boolean);
		const openKeys = Array.isArray(this.state.openPanels) ? this.state.openPanels : ['readout', 'tree', 'pic', 'list', 'spiegel', 'diff', 'contact', 'parallel', 'rectify'];
		// 分组 Tab 定义(顺序固定);某卡片受开关控制为空时,对应 Tab 显空提示而非报错。
		const RIGHT_TABS = [
			{ key: 'reading', label: '读数', hint: '指针读数与中点树' },
			{ key: 'midpoint', label: '中点', hint: '开启「中点列表 / 行星图 / 映点」开关后在此查看' },
			{ key: 'solararc', label: '太阳弧', hint: '开启「差值表」开关后在此查看太阳弧到期' },
			{ key: 'contact', label: '接触', hint: '开启行运/太阳弧/合盘叠加或「赤纬接触」后在此查看' },
			{ key: 'rectify', label: '校时', hint: '添加生平事件→反推生时(只读预览,不改盘)' },
		];
		// 分组内卡片仍用 Collapse(沿用既有 horosa-uranian-panels 暗黑样式 + 数量徽标),每卡可独立收放。
		const renderGroup = (groupKey) => {
			const cards = panelDefs.filter((p) => p.group === groupKey);
			const meta = RIGHT_TABS.find((t) => t.key === groupKey);
			if (cards.length === 0) return <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, padding: '12px 4px' }}>{meta ? meta.hint : '暂无内容'}</div>;
			return (
				<Collapse className="horosa-uranian-panels" activeKey={openKeys}
					onChange={(keys) => this.saveDisp({ openPanels: Array.isArray(keys) ? keys : [keys] })}>
					{cards.map((p) => (
						<Collapse.Panel key={p.key} header={p.header}>
							<div style={{ maxHeight: Math.round(size * p.mh), overflowY: 'auto', overflowX: 'auto' }}>{p.body}</div>
						</Collapse.Panel>
					))}
				</Collapse>
			);
		};
		// activeRightTab 持久化兼容:旧值仍取自 RIGHT_TABS 键集(校时拆出后多了 rectify);非法值回退读数。
		const RIGHT_TAB_KEYS = RIGHT_TABS.map((t) => t.key);
		const activeRightTab = (RIGHT_TAB_KEYS.indexOf(this.state.activeRightTab) >= 0) ? this.state.activeRightTab : 'reading';
		// 右栏分组 Tab:把原一长列 Collapse 归到 5 组,切换零回归(只换显示,不动任何计算)。
		const rightCol = (
			<XQTabs className="horosa-uranian-right-tabs" size="small" activeKey={activeRightTab}
				onChange={(k) => this.saveDisp({ activeRightTab: k })}>
				{RIGHT_TABS.map((t) => (
					<XQTabs.TabPane tab={t.label} key={t.key}>
						{renderGroup(t.key)}
					</XQTabs.TabPane>
				))}
			</XQTabs>
		);

		// 列宽:左 4 / 中 15 / 右 5 = 24(右栏从 4→5 再放宽;中栏 16→15 仍占主体)。
		// 放宽缘由:右栏赤纬接触行 Kr·+23.37°/+22.45°·差0.9 等 nowrap 单行(rowLine)在 span=4 时被裁,加一列防截断。
		// 左右两个 Col 用内层 div 套 maxHeight+overflowY:auto;盘 col 也加底部 paddingBottom 防 Dock 遮挡。
		const sideScroll = { width: '100%', maxHeight: sideMaxH, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 };
		return (
			<div className="horosa-midpoint-host" ref={(el) => { this._host = el; }}>
				<div className="horosa-midpoint-workbench">
					<Row className="horosa-midpoint-layout" gutter={10}>
						<Col span={4} className="horosa-midpoint-side-col"><div style={sideScroll}>{settings}</div></Col>
						<Col span={15} className="horosa-midpoint-chart-col">
							{natalPts.length === 0 ? (
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: size, color: 'var(--horosa-text-soft)', textAlign: 'center', padding: 24 }}>
									{this.state.dataNote || '请先排出本命盘后查看中点盘'}
								</div>
							) : (
								<div style={{ paddingBottom: 24 }}>
									{this.renderDial(size, rings)}
									{this.state.dataNote ? (
										<div style={{ textAlign: 'center', color: 'var(--horosa-text-soft)', fontSize: 12, marginTop: 6 }}>
											{this.state.dataNote}（TNP/行运/太阳弧 需完整出生信息）
										</div>
									) : null}
								</div>
							)}
						</Col>
						<Col span={5} className="horosa-midpoint-side-col"><div style={sideScroll}>{rightCol}</div></Col>
					</Row>
				</div>
			</div>
		);
	}
}
