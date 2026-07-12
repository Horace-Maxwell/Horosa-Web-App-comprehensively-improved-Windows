// components/mundane/MundaneMain.js
// 世俗盘 Mundane：类型选择器统辖多种世俗盘——
//   入宫盘（四正入宫，精确入宫时刻）/ 新月图 / 满月图 / 日食图 / 月食图 / 地区盘 / 行星周期（木土大合相纪元）。
// 入宫：/jieqi 精确节气种子 + /chart。新月满月/日月食：momentPipeline（/astroextra/ephemeris）扫描事件 → 选中按精确时刻排盘。
// 地区盘：预置/自定义历史建置时刻 + 12 世俗宫义。行星周期：/astroextra/greatconj 精算木土大合。
// 解读层：divination/mundane/describe（行星落世俗宫判词、食的元素/分度判词）。
import { Component, Fragment } from 'react';
import { InputNumber, Spin, Input } from 'antd';
import { XQSelect, XQButton, XQTabs } from '../xq-ui';
import DivinationChartShell from '../divination/DivinationChartShell';
import DateTime from '../comp/DateTime';
import { fetchPreciseJieqiSeed } from '../../utils/preciseCalcBridge';
import { SIGNS } from '../../divination/data/signs';
import { buildFacts } from '../../divination/engine/chartFacts';
import { buildAstroSnapshotContent } from '../../utils/astroAiSnapshot';
import { fetchMundaneEvents, momentToDateTime, ingressDurationMonths, ingressGovernance } from '../../divination/mundane/momentPipeline';
import { describeMundaneChart, describeEclipse, describeEclipseAfflictions, describeIngressSkeleton, describeMundaneVictor, describeMundaneWeather, describeMundaneSyzygy, buildMundaneStarPoints, mundaneFixedStarHits, mundaneConjunctionIndicator, MUNDANE_HOUSE_MEANINGS, PLANET_CN as MUN_PLANET_CN } from '../../divination/mundane/describe';
import { MUNDANE_RULESETS, rulesetConfig } from '../../divination/mundane/ruleset';
import { describeChorography, CHOROGRAPHY_DISCLAIMER } from '../../divination/mundane/chorography';
import { mundaneProfection, mundaneFirdaria } from '../../divination/mundane/progressions';
import { mundaneDistribution, mundanePatternMeaning } from '../../divination/mundane/patterns';
import { allRegions, saveUserRegion, MUNDANE_CAPITALS, regionCandidates } from '../../divination/data/regionCharts';
import { astroSymbol, chartParams, fmtDegree, chartRequestKey } from '../astro/AstroExtraCommon';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

const Option = XQSelect.Option;
const TabPane = XQTabs.TabPane;

const MUNDANE_TYPES = [
	{ key: 'ingress', label: '入宫盘' },
	{ key: 'newmoon', label: '新月图' },
	{ key: 'fullmoon', label: '满月图' },
	{ key: 'solecl', label: '日食图' },
	{ key: 'lunecl', label: '月食图' },
	{ key: 'region', label: '地区盘' },
	{ key: 'cycles', label: '行星周期' },
];

const INGRESSES = [
	{ term: '春分', label: '春分 · 白羊入宫（年盘）', signKey: 'aries' },
	{ term: '夏至', label: '夏至 · 巨蟹入宫', signKey: 'cancer' },
	{ term: '秋分', label: '秋分 · 天秤入宫', signKey: 'libra' },
	{ term: '冬至', label: '冬至 · 摩羯入宫', signKey: 'capricorn' },
];

const SIGN_KEYS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
const PLANET_CN = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' };
const PLANET_ZH = { sun: '日', moon: '月', mercury: '水', venus: '金', mars: '火', jupiter: '木', saturn: '土' };
const ELEMENT_COLOR = { fire: '#c0392b', earth: '#8a6d3b', air: '#2c7fb8', water: '#1a7f6b' };
const ELEMENT_BG = { fire: 'rgba(192,57,43,0.08)', earth: 'rgba(138,109,59,0.08)', air: 'rgba(44,127,184,0.08)', water: 'rgba(26,127,107,0.08)' };
const ELEMENT_CN = { fire: '火象', earth: '土象', air: '风象', water: '水象' };
const ELEMENT_SHORT = { fire: '火', earth: '土', air: '风', water: '水' };

const MODALITY_CN = { cardinal: '基本', fixed: '固定', mutable: '变动' };
const SEASON_INGRESS_CN = { aries: '春分·白羊', cancer: '夏至·巨蟹', libra: '秋分·天秤', capricorn: '冬至·摩羯' };

// 复用 App 自带的占星字体 glyph（AstroFont），不用 unicode 符号。
const PLANET_ASTRO_ID = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto' };
function pGlyph(k){ return astroSymbol(PLANET_ASTRO_ID[k] || k); }
function sGlyph(signKey){ const s = signKey ? SIGNS[signKey] : null; return (s && s.en) ? astroSymbol(s.en) : null; }

// 行星周期：可选慢星对 + 合/冲。木土合走既有「时代纪元」富视图；其余走 /astroextra/planetcycles 平铺时间轴。
const CYCLE_PAIRS = [
	{ key: 'jupiter-saturn', cn: '木 ✕ 土（时代纪元）' },
	{ key: 'saturn-uranus', cn: '土 ✕ 天王' },
	{ key: 'saturn-neptune', cn: '土 ✕ 海王' },
	{ key: 'saturn-pluto', cn: '土 ✕ 冥王' },
	{ key: 'uranus-neptune', cn: '天王 ✕ 海王' },
	{ key: 'uranus-pluto', cn: '天王 ✕ 冥王' },
	{ key: 'neptune-pluto', cn: '海王 ✕ 冥王' },
	{ key: 'jupiter-uranus', cn: '木 ✕ 天王' },
	{ key: 'jupiter-neptune', cn: '木 ✕ 海王' },
	{ key: 'jupiter-pluto', cn: '木 ✕ 冥王' },
	{ key: 'mars-saturn', cn: '火 ✕ 土' },
];
const CYCLE_ASPECTS = [{ v: 0, cn: '合相 0°' }, { v: 180, cn: '对分 180°' }];
// Barbault 行星周期指数(§9.3)可选慢星组合:对数 = C(n,2),满刻度 = 对数×180°。
const BARBAULT_SETS = [
	{ key: 'slow5', cn: '五慢星 ♃♄♅♆♇（默认）', planets: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] },
	{ key: 'outer3', cn: '仅外三星 ♅♆♇（最平滑）', planets: ['Uranus', 'Neptune', 'Pluto'] },
	{ key: 'slow4', cn: '土外四星 ♄♅♆♇', planets: ['Saturn', 'Uranus', 'Neptune', 'Pluto'] },
];

// 一组（约60年/3次）合相的大三合相态：纯X(全本象) / 摄Y(2本1邻) / 摄大Y(1本2邻)。
function triadPhase(triad, ageEl){
	const els = triad.map((c) => (SIGNS[SIGN_KEYS[c.sign]] || {}).element);
	const match = els.filter((e) => e === ageEl).length;
	const other = els.find((e) => e && e !== ageEl) || ageEl;
	if(match >= triad.length){ return { label: '纯' + ELEMENT_SHORT[ageEl], el: ageEl }; }
	if(match >= 2){ return { label: '摄' + ELEMENT_SHORT[other], el: other }; }
	return { label: '摄大' + ELEMENT_SHORT[other], el: other };
}

const AGE_EPOCHS = [
	{ y: -1199, s: 6 }, { y: -959, s: 7 },
	{ y: -720, s: 8 }, { y: -541, s: 9 }, { y: -302, s: 10 }, { y: -124, s: 11 },
	{ y: 114, s: 0 }, { y: 292, s: 1 }, { y: 411, s: 2 }, { y: 590, s: 3 },
	{ y: 769, s: 4 }, { y: 1007, s: 5 }, { y: 1186, s: 6 }, { y: 1305, s: 7 },
	{ y: 1603, s: 8 }, { y: 1842, s: 9 }, { y: 2020, s: 10 }, { y: 2259, s: 11 },
	{ y: 2497, s: 0 }, { y: 2676, s: 1 },
];

function currentYear(){
	try{ return new Date().getFullYear(); }catch(e){ return 2026; }
}

function clampYear(v, dflt){
	const n = Number(v);
	if(!Number.isFinite(n)){ return dflt; }
	return Math.max(-3000, Math.min(3000, Math.round(n)));
}

function yearLabel(y){
	return y <= 0 ? `前${1 - y}` : `${y}`;
}

// year → 'YYYY-MM-DD'（正年补零；负年加 -）。
function ymd(year, m, d){
	const y = year < 0 ? `-${String(-year).padStart(4, '0')}` : String(year).padStart(4, '0');
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function ageEpochFor(year){
	let ep = AGE_EPOCHS[0];
	for(let i = 0; i < AGE_EPOCHS.length; i++){
		if(AGE_EPOCHS[i].y <= year){ ep = AGE_EPOCHS[i]; } else { break; }
	}
	return ep;
}

function dignities(idx){
	const s = SIGNS[SIGN_KEYS[idx]] || {};
	const ruler = s.domicile;
	const exalt = (s.exaltation && SEVEN.indexOf(s.exaltation.planet) >= 0) ? s.exaltation.planet : null;
	const detr = (SIGNS[SIGN_KEYS[(idx + 6) % 12]] || {}).domicile;
	return { ruler, exalt, detr };
}

function dignityText(d){
	const z = (p) => PLANET_ZH[p] || p;
	const parts = [];
	if(d.ruler && d.exalt && d.ruler === d.exalt){ parts.push(z(d.ruler) + '主强'); }
	else { if(d.ruler){ parts.push(z(d.ruler) + '主'); } if(d.exalt){ parts.push(z(d.exalt) + '强'); } }
	if(d.detr){ parts.push(z(d.detr) + '落'); }
	return parts.join('·');
}

function computeAges(conjs){
	const ages = [];
	let cur = null;
	(conjs || []).forEach((c) => {
		const ep = ageEpochFor(c.year);
		if(!cur || cur.epochY !== ep.y){
			if(cur){ ages.push(cur); }
			const sign = SIGNS[SIGN_KEYS[ep.s]] || {};
			cur = {
				epochY: ep.y, leadingCn: sign.cn, leadingSignKey: SIGN_KEYS[ep.s],
				element: sign.element, dignities: dignities(ep.s), conjs: [],
			};
		}
		cur.conjs.push(c);
	});
	if(cur){ ages.push(cur); }
	return ages;
}

// 入宫盘上升座 → 域主星 = 年主星。
function ascRuler(chart){
	let key = null;
	let lon = null;
	try{
		const facts = buildFacts(chart);
		if(facts && facts.meta){
			if(facts.meta.ascSign){ key = facts.meta.ascSign; }
			else if(facts.meta.ascLon != null){ lon = facts.meta.ascLon; }
		}
		if(key == null && facts && facts.lons && facts.lons.asc != null){ lon = facts.lons.asc; }
	}catch(e){ /* noop */ }
	if(key == null && lon != null){ key = SIGN_KEYS[Math.floor((((lon % 360) + 360) % 360) / 30)]; }
	const sign = key ? SIGNS[key] : null;
	if(!sign){ return null; }
	return { signKey: key, signCn: sign.cn, modality: sign.modality, rulerKey: sign.domicile, rulerCn: PLANET_CN[sign.domicile] || sign.domicile };
}

// AI 快照段:世俗宫义/地理分野 逐行 → GFM 表(v1/v2 归一器直通、docx/PDF 渲染真表)。
// 单元格值表达式与旧逐字同源(planetCn/house/houseMeaning/signTemper/text · a.cn/countries),只改排版;
// 抽为模块级纯函数供 buildAiSnapshot 调用并可单测(数值不变证明)。宫号保「第N宫」原子 token。
export function formatMundaneHouseTable(rows){
	const out = ['| 星 | 宫 | 宫义 | 星座 | 判读 |', '| --- | --- | --- | --- | --- |'];
	(rows || []).forEach((r) => {
		const zodiac = r.signTemper ? `${r.sign || ''}·${r.signTemper.modeElement}` : '—';
		out.push(`| ${r.planetCn} | 第${r.house}宫 | ${r.houseMeaning} | ${zodiac} | ${r.text} |`);
	});
	return out.join('\n');
}
export function formatMundaneChorographyTable(axes){
	const out = ['| 星座 | 分野 |', '| --- | --- |'];
	(axes || []).forEach((a) => { out.push(`| ${a.cn} | ${a.regions.countries.slice(0, 4).join('、')} |`); });
	return out.join('\n');
}

const CARD = {
	border: '1px solid var(--horosa-border, rgba(128,128,128,0.16))',
	borderRadius: 12,
	padding: '14px 16px',
	marginBottom: 14,
	background: 'var(--horosa-card-bg, rgba(128,128,128,0.025))',
};
const CARD_TITLE = { fontSize: 13.5, fontWeight: 700, marginBottom: 12, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 8 };

class MundaneMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			casting: false, err: '',
			gcStart: 1300, gcEnd: 2200, gcLoading: false, gcResults: null, gcErr: '', gcPair: 'jupiter-saturn', gcAspect: 0, gcMode: 'ages',
			scanLoading: false, scanRows: null, scanErr: '', scanType: '', eclipseDetail: null,
			regionAddOpen: false, regionForm: { name: '', date: '', time: '12:00:00', zone: '+08:00', lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9 },
			bbStart: 1900, bbEnd: 2050, bbSet: 'slow5', bbLoading: false, bbErr: '', bbData: null,
			mundaneRightTab: 'overview',
			progFoundingYear: null, progTargetYear: null,
			srData: null, srLoading: false, srErr: '', srYear: null, srKey: null,
			patData: null, patLoading: false, patErr: '', patKey: null,
			secData: null, secLoading: false, secErr: '', secYear: null, secKey: null,
			relocData: null, relocLoading: false, relocErr: '', relocCity: null,
			seasonSeed: null, seasonSeedYear: null, seasonLoading: false, seasonErr: '',
		};
		this.computeMundaneReturn = this.computeMundaneReturn.bind(this);
		this.computeMundanePatterns = this.computeMundanePatterns.bind(this);
		this.computeMundaneSecondary = this.computeMundaneSecondary.bind(this);
		this.computeMundaneRelocation = this.computeMundaneRelocation.bind(this);
		this.castIngress = this.castIngress.bind(this);
		this.computeGreatConj = this.computeGreatConj.bind(this);
		this.computeBarbault = this.computeBarbault.bind(this);
		this.scanEvents = this.scanEvents.bind(this);
	}

	componentDidMount(){
		this.computeGreatConj();
	}

	geoFromFields(fields){
		return {
			zone: fields.zone ? fields.zone.value : '+08:00',
			lon: fields.lon ? fields.lon.value : '116e23',
			lat: fields.lat ? fields.lat.value : '23n26',
			gpsLat: fields.gpsLat ? fields.gpsLat.value : 23.43,
			gpsLon: fields.gpsLon ? fields.gpsLon.value : 116.38,
		};
	}

	async castIngress(extra, setExtra, fields, setTime){
		const term = extra.ingressTerm || '春分';
		const year = clampYear(extra.ingressYear, currentYear());
		const zone = fields.zone ? fields.zone.value : '+08:00';
		this.setState({ casting: true, err: '' });
		try{
			const params = {
				year: String(year),
				ad: fields.ad ? fields.ad.value : 1,
				zone,
				lon: fields.lon ? fields.lon.value : '116e23',
				lat: '23n26',
				gpsLat: 23.43,
				gpsLon: fields.gpsLon ? fields.gpsLon.value : (fields.lon ? fields.lon.value : 0),
				timeAlg: 0,
				jieqis: [term],
			};
			const seed = await fetchPreciseJieqiSeed(params);
			const hit = seed && seed[term];
			if(!hit || !hit.time){ throw new Error('未取到入宫时刻'); }
			const dt = new DateTime();
			dt.parse(hit.time, 'YYYY-MM-DD HH:mm:ss');
			dt.zone = zone;
			dt.calcJdn();
			setExtra({ mundaneType: 'ingress', ingressTerm: term, ingressYear: year, ingressMoment: hit.time });
			setTime(dt);
			this.setState({ casting: false });
		}catch(e){
			this.setState({ casting: false, err: (e && e.message) || '入宫盘排盘失败' });
		}
	}

	// WP-1 四季入境盘:一次取春分/夏至/秋分/冬至四枢轴精确入境时刻(年盘上升落基本座时主管缩首季,须并参)。
	async scanSeasonalIngresses(extra){
		const fields = this._fields;
		if(!fields){ return; }
		const year = clampYear(extra.ingressYear, currentYear());
		const zone = fields.zone ? fields.zone.value : '+08:00';
		this.setState({ seasonLoading: true, seasonErr: '' });
		try{
			const params = {
				year: String(year), ad: fields.ad ? fields.ad.value : 1, zone,
				lon: fields.lon ? fields.lon.value : '116e23', lat: '23n26', gpsLat: 23.43,
				gpsLon: fields.gpsLon ? fields.gpsLon.value : (fields.lon ? fields.lon.value : 0),
				timeAlg: 0, jieqis: ['春分', '夏至', '秋分', '冬至'],
			};
			const seed = await fetchPreciseJieqiSeed(params);
			if(!seed){ throw new Error('未取到入境时刻'); }
			this.setState({ seasonLoading: false, seasonSeed: seed, seasonSeedYear: year });
		}catch(e){ this.setState({ seasonLoading: false, seasonErr: '四季入境计算失败：请确认本地服务。' }); }
	}

	// 点四季某季 → 按其精确入境时刻起该季入宫盘(复用 ingress 壳)。
	castSeasonalIngress(term, moment, year){
		if(!this._setExtra || !this._setTime || !this._fields){ return; }
		const zone = this._fields.zone ? this._fields.zone.value : '+08:00';
		const dt = new DateTime();
		dt.parse(moment, 'YYYY-MM-DD HH:mm:ss');
		dt.zone = zone;
		if(dt.calcJdn){ dt.calcJdn(); }
		this._setExtra({ mundaneType: 'ingress', ingressTerm: term, ingressYear: year, ingressMoment: moment });
		this._setTime(dt);
	}

	async scanEvents(type, extra, fields){
		const year = clampYear(extra.scanYear, currentYear());
		const geo = this.geoFromFields(fields);
		const kinds = (type === 'solecl' || type === 'lunecl') ? ['eclipses'] : ['lunations'];
		this.setState({ scanLoading: true, scanErr: '', scanType: type, scanRows: null });
		const res = await fetchMundaneEvents({
			startDate: ymd(year, 1, 1), endDate: ymd(year, 12, 31),
			zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon,
			kinds,
		});
		if(res.err){ this.setState({ scanLoading: false, scanErr: '事件扫描失败：请确认本地服务运行。' }); return; }
		let rows = [];
		if(type === 'newmoon'){ rows = (res.lunations || []).filter((l) => l.phase === 'New Moon'); }
		else if(type === 'fullmoon'){ rows = (res.lunations || []).filter((l) => l.phase === 'Full Moon'); }
		else if(type === 'solecl'){ rows = (res.eclipses || []).filter((e) => e.kind === 'solar'); }
		else if(type === 'lunecl'){ rows = (res.eclipses || []).filter((e) => e.kind === 'lunar'); }
		this.setState({ scanLoading: false, scanRows: rows });
	}

	useMoment(row, type, setExtra, fields, setTime){
		const geo = this.geoFromFields(fields);
		const dt = momentToDateTime(row.localTime, geo.zone);
		if(!dt){ return; }
		const patch = { mundaneType: type, selectedMoment: row.localTime, selectedSign: row.sign };
		if(type === 'solecl' || type === 'lunecl'){
			patch.eclipseKind = row.kind; patch.eclipseTypeText = row.eclipseType;
			this.setState({ eclipseDetail: null });
			this.fetchEclipseDetail(row.localTime, row.kind, geo);
		}
		setExtra(patch);
		setTime(dt);
	}

	// 食时长定则：日食 N 小时→约 N 年、月食 N 小时→约 N 月（/astroextra/eclipsedetail，swisseph 接触时刻）。
	fetchEclipseDetail(moment, kind, geo){
		const parts = `${moment || ''}`.split(' ');
		request(`${Constants.ServerRoot}/astroextra/eclipsedetail`, {
			body: JSON.stringify({ date: parts[0], time: parts[1] || '00:00:00', zone: geo.zone, lat: geo.lat, lon: geo.lon, eclipseKind: kind }),
			timeoutMs: 60000,
		}).then((data) => {
			const r = (data && data.Result) ? data.Result : data;
			this.setState({ eclipseDetail: (r && !r.err) ? r : null });
		}).catch(() => { this.setState({ eclipseDetail: null }); });
	}

	applyRegion(key, setExtra, patchFields, candidate){
		const rec = allRegions()[key];
		if(!rec){ return; }
		const cands = regionCandidates(key);
		const cand = candidate || (cands ? cands[0] : null);   // 多候选盘:默认首候选(最通行者)
		const useTime = (cand && cand.time) ? cand.time : (rec.time || '12:00:00');
		const dt = new DateTime();
		if(dt.setZone){ dt.setZone(rec.zone || '+00:00'); }
		dt.parse(`${rec.date} ${useTime}`, 'YYYY-MM-DD HH:mm:ss');
		if(dt.calcJdn){ dt.calcJdn(); }
		setExtra({ mundaneType: 'region', regionKey: key, regionCn: rec.cn + (cand ? ` · ${cand.label}` : ''), regionFoundingYear: parseInt(String(rec.date || '').slice(0, 4), 10) || null });
		// 换地区盘:清掉手填建置/目标年(否则推运卡沿用上一盘的手填年),令新 regionFoundingYear 重新权威。
		this.setState({ regionCandKey: (cand && cand.key) || null, progFoundingYear: null, progTargetYear: null });
		patchFields({
			date: dt, time: dt.clone ? dt.clone() : dt, zone: dt.zone, ad: dt.ad,
			lon: rec.lon, lat: rec.lat, gpsLon: rec.gpsLon, gpsLat: rec.gpsLat, pos: rec.cn,
		});
	}

	// 成熟方案：把「当前盘」（上方「时间」+「地点」设定好的时刻与坐标）命名后存为地区盘。
	addRegion(setExtra, patchFields, fields){
		const f = this.state.regionForm;
		if(!f.name || !f.name.trim()){ this.setState({ scanErr: '请填地区/事件名称' }); return; }
		const dt = fields && fields.date && fields.date.value;
		const dateStr = dt && dt.format ? dt.format('YYYY-MM-DD') : '';
		const timeStr = dt && dt.format ? dt.format('HH:mm:ss') : '12:00:00';
		const zone = (fields && fields.zone && fields.zone.value) || (dt && dt.zone) || '+08:00';
		const lon = (fields && fields.lon && fields.lon.value) || '116e23';
		const lat = (fields && fields.lat && fields.lat.value) || '39n54';
		const gpsLon = (fields && fields.gpsLon && fields.gpsLon.value != null) ? fields.gpsLon.value : 0;
		const gpsLat = (fields && fields.gpsLat && fields.gpsLat.value != null) ? fields.gpsLat.value : 0;
		if(!dateStr){ this.setState({ scanErr: '请先用上方「时间」设定建置时刻' }); return; }
		const key = `user_${f.name.trim()}_${dateStr}`.replace(/\s+/g, '');
		const rec = { cn: f.name.trim(), date: dateStr, time: timeStr, zone, lon, lat, gpsLon: Number(gpsLon) || 0, gpsLat: Number(gpsLat) || 0, note: '用户自定义' };
		saveUserRegion(key, rec);
		this.setState({ regionAddOpen: false, scanErr: '', regionForm: { ...this.state.regionForm, name: '' } });
		this.applyRegion(key, setExtra, patchFields);
	}

	async computeGreatConj(){
		const startYear = clampYear(this.state.gcStart, 1300);
		const endYear = clampYear(this.state.gcEnd, 2200);
		if(endYear < startYear){ this.setState({ gcErr: '结束年须不小于起始年' }); return; }
		const pair = this.state.gcPair || 'jupiter-saturn';
		const aspect = this.state.gcAspect || 0;
		const richJuSa = (pair === 'jupiter-saturn' && aspect === 0);
		this.setState({ gcLoading: true, gcErr: '' });
		try{
			if(richJuSa){
				const data = await request(`${Constants.ServerRoot}/astroextra/greatconj`, {
					body: JSON.stringify({ startYear, endYear }),
					timeoutMs: 90000,
				});
				const r = (data && data.Result) ? data.Result : data;
				const list = (r && r.conjunctions) ? r.conjunctions : (Array.isArray(r) ? r : []);
				this.setState({ gcLoading: false, gcResults: list, gcMode: 'ages' });
			}else{
				const parts = pair.split('-');
				const data = await request(`${Constants.ServerRoot}/astroextra/planetcycles`, {
					body: JSON.stringify({ startYear, endYear, p1: PLANET_ASTRO_ID[parts[0]], p2: PLANET_ASTRO_ID[parts[1]], aspect }),
					timeoutMs: 90000,
				});
				const r = (data && data.Result) ? data.Result : data;
				const list = (r && r.events) ? r.events : [];
				this.setState({ gcLoading: false, gcResults: list, gcMode: 'flat' });
			}
		}catch(e){
			this.setState({ gcLoading: false, gcErr: '行星周期计算失败' });
		}
	}

	// Barbault 行星周期指数(§9.3):慢星两两角距和 → 「聚散」曲线,低谷=危机、高峰=扩张。
	async computeBarbault(){
		const startYear = clampYear(this.state.bbStart, 1900);
		const endYear = clampYear(this.state.bbEnd, 2050);
		if(endYear < startYear){ this.setState({ bbErr: '结束年须不小于起始年' }); return; }
		const set = BARBAULT_SETS.find((s) => s.key === this.state.bbSet) || BARBAULT_SETS[0];
		const span = endYear - startYear;
		const stepMonths = span > 160 ? 12 : (span > 80 ? 6 : 3);
		this.setState({ bbLoading: true, bbErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/barbault`, {
				body: JSON.stringify({ startYear, endYear, stepMonths, planets: set.planets }),
				timeoutMs: 90000,
			});
			const r = (data && data.Result) ? data.Result : data;
			this.setState({ bbLoading: false, bbData: (r && r.points) ? r : null, bbErr: (r && r.points) ? '' : 'Barbault 指数计算失败' });
		}catch(e){
			this.setState({ bbLoading: false, bbErr: 'Barbault 指数计算失败' });
		}
	}

	// WP-6 太阳返照(§11.2):复用 /astroextra/returns(getBaseParams 已白名单 startYear/count),以地区盘为命基排目标年年度图。
	async computeMundaneReturn(chart, year){
		if(!chart || !chart.params){ this.setState({ srErr: '需先排地区盘' }); return; }
		this.setState({ srLoading: true, srErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
				body: JSON.stringify({ ...chartParams(chart), startYear: year, count: 1 }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const rows = (r && r.rows) ? r.rows : [];
			this.setState({ srLoading: false, srData: rows[0] || null, srYear: year, srKey: chartRequestKey(chart), srErr: rows.length ? '' : '返照计算失败' });
		}catch(e){
			this.setState({ srLoading: false, srErr: '返照计算失败' });
		}
	}

	// WP-2 相位格局(§17.2):surfacing 后端 /astroextra/analysis 的 detect_patterns(已 Java 代理 /analysis)。
	async computeMundanePatterns(chart){
		if(!chart || !chart.params){ this.setState({ patErr: '需先排盘' }); return; }
		this.setState({ patLoading: true, patErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/analysis`, {
				body: JSON.stringify(chartParams(chart)),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const pats = (r && r.patterns) ? r.patterns : [];
			this.setState({ patLoading: false, patData: pats, patKey: chartRequestKey(chart) });
		}catch(e){
			this.setState({ patLoading: false, patErr: '格局计算失败' });
		}
	}

	// WP-6 次限/太阳弧(§11.2):surfacing 后端 /astroextra/progressions(secondary;太阳弧前端从次限进太阳派生)。
	async computeMundaneSecondary(chart, year){
		if(!chart || !chart.params){ this.setState({ secErr: '需先排盘' }); return; }
		this.setState({ secLoading: true, secErr: '' });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
				body: JSON.stringify({ ...chartParams(chart), targetDate: `${year}-01-01`, aspects: [0, 90, 180], orb: 1.5 }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const sec = (r && r.methods) ? r.methods.find((m) => m.method === 'secondary') : null;
			this.setState({ secLoading: false, secData: sec || null, secYear: year, secKey: chartRequestKey(chart), secErr: sec ? '' : '次限计算失败' });
		}catch(e){
			this.setState({ secLoading: false, secErr: '次限计算失败' });
		}
	}

	// WP-4 会合起盘(§9.1):点选会合→按其精确时刻(UT)起盘,作事件盘(复用 region 壳)进定局/判读。
	castConjunction(row){
		if(!this._setTime || !this._setExtra || !row || row.year == null){ return; }
		const hh = (row.hour != null) ? row.hour : 12;
		const h = Math.floor(hh); const mi = Math.floor((hh - h) * 60); const s = Math.max(0, Math.min(59, Math.floor((((hh - h) * 60) - mi) * 60)));
		const pad = (n) => String(n).padStart(2, '0');
		const str = `${row.year}-${pad(row.month)}-${pad(row.day)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
		const dt = new DateTime();
		if(dt.setZone){ dt.setZone('+00:00'); }   // 会合精确时刻为 UT
		dt.parse(str, 'YYYY-MM-DD HH:mm:ss');
		if(dt.calcJdn){ dt.calcJdn(); }
		this._setExtra({ mundaneType: 'region', regionKey: null, regionCn: `会合盘 ${row.year}`, regionFoundingYear: row.year });
		this.setState({ mundaneRightTab: 'judge', progFoundingYear: null, progTargetYear: null });
		this._setTime(dt);
	}

	// WP-7 重定位四轴(§12.4):复用后端 /astroextra/relocation(保黄经、换地点重算四轴/宫;已 Java 代理)。
	async computeMundaneRelocation(chart, city){
		if(!chart || !chart.params || !city){ this.setState({ relocErr: '需先排盘' }); return; }
		this.setState({ relocLoading: true, relocErr: '', relocCity: city.cn });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/relocation`, {
				body: JSON.stringify({ ...chartParams(chart), relocLat: city.lat, relocLon: city.lon }),
				timeoutMs: 45000,
			});
			const r = (data && data.Result) ? data.Result : data;
			const rc = (r && r.chart) ? r.chart : null;
			let meta = null;
			if(rc){ try{ meta = buildFacts(rc).meta; }catch(e){ meta = null; } }
			this.setState({ relocLoading: false, relocData: meta, relocErr: meta ? '' : '重定位计算失败' });
		}catch(e){
			this.setState({ relocLoading: false, relocErr: '重定位计算失败' });
		}
	}

	// WP-8 校正:把当前建置时刻平移 deltaMin 分钟并重排盘(看四轴随之移动)。
	nudgeFoundingTime(deltaMin){
		try{
			const fields = this._fields; const setTime = this._setTime;
			if(!fields || !fields.date || !fields.date.value || !setTime){ return; }
			const dtv = fields.date.value;
			const dateStr = dtv.format ? dtv.format('YYYY-MM-DD') : null;
			const timeStr = dtv.format ? dtv.format('HH:mm:ss') : null;
			if(!dateStr || !timeStr){ return; }
			const dp = dateStr.split('-').map(Number);
			const tp = timeStr.split(':').map(Number);
			const d = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1] + deltaMin, tp[2] || 0);
			const pad = (n) => String(n).padStart(2, '0');
			const newStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
			const zone = (fields.zone && fields.zone.value) || dtv.zone || '+08:00';
			const dt = new DateTime();
			dt.parse(newStr, 'YYYY-MM-DD HH:mm:ss');
			dt.zone = zone;
			if(dt.calcJdn){ dt.calcJdn(); }
			setTime(dt);
		}catch(e){ /* noop */ }
	}

	// WP-8 校正辅助卡:显当前四轴 + ±分钟微调建置时刻(重排即时看四轴移动)+ 事件检验指引。
	renderRectificationCard(chart){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts || !facts.meta){ return null; }
		const ACC = '#0e7490';
		const m = facts.meta;
		const signOf = (lon) => (typeof lon === 'number') ? SIGN_KEYS[Math.floor((((lon % 360) + 360) % 360) / 30)] : null;
		const ascKey = m.ascSign || signOf(m.ascLon);
		const mcKey = signOf(m.mcLon);
		const ascDeg = (m.ascDegree != null) ? m.ascDegree : (m.ascLon != null ? (((m.ascLon % 30) + 30) % 30) : null);
		const mcDeg = (m.mcLon != null) ? (((m.mcLon % 30) + 30) % 30) : null;
		const NB = (dm, label) => (<XQButton size="small" onClick={() => this.nudgeFoundingTime(dm)}>{label}</XQButton>);
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />时刻校正</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, lineHeight: '17px' }}>建置时刻不确定时,按已知事件微调时刻使四轴/推运吻合。四轴对时刻极敏感(上升约 4 分钟移 1°)。</div>
				<div style={{ fontSize: 13, lineHeight: '21px', marginBottom: 8 }}>
					<div>当前上升 {ascKey ? <b style={{ color: ACC }}>{sGlyph(ascKey)} {(SIGNS[ascKey] || {}).cn || ''}</b> : null} {ascDeg != null ? ascDeg.toFixed(2) + '°' : ''}</div>
					<div>当前天顶 {mcKey ? <b style={{ color: ACC }}>{sGlyph(mcKey)} {(SIGNS[mcKey] || {}).cn || ''}</b> : null} {mcDeg != null ? mcDeg.toFixed(2) + '°' : ''}</div>
				</div>
				<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
					{NB(-30, '−30分')}{NB(-5, '−5分')}{NB(-1, '−1分')}{NB(1, '+1分')}{NB(5, '+5分')}{NB(30, '+30分')}
				</div>
				<div style={{ fontSize: 11, opacity: 0.55, lineHeight: '17px' }}>点按钮平移建置时刻并重排,上方四轴随之变化。<b>检验法</b>:取已知历史事件年(政权更替/战乱/重大转折),看该年 太阳弧/次限/小限/返照 是否精确击中四轴或相关宫主——吻合者即较可信的校正时刻。</div>
				<div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
					<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>重定位四轴（换地点·同时刻）</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
						<XQSelect size="small" style={{ width: 144 }} placeholder="选首都重定位" value={this.state.relocCity || undefined} disabled={this.state.relocLoading}
							onChange={(v) => { const c = MUNDANE_CAPITALS.find((x) => x.cn === v); if(c){ this.computeMundaneRelocation(chart, c); } }}>
							{MUNDANE_CAPITALS.map((c) => (<Option key={c.cn} value={c.cn}>{c.cn}</Option>))}
						</XQSelect>
						{this.state.relocLoading ? <span style={{ fontSize: 11, opacity: 0.6 }}>计算中…</span> : null}
					</div>
					{this.state.relocErr ? <div style={{ fontSize: 11, color: '#c0392b' }}>{this.state.relocErr}</div> : null}
					{(this.state.relocData && !this.state.relocLoading) ? (() => {
						const rm = this.state.relocData;
						const rA = rm.ascSign || signOf(rm.ascLon);
						const rM = signOf(rm.mcLon);
						const rAd = (rm.ascDegree != null) ? rm.ascDegree : (rm.ascLon != null ? (((rm.ascLon % 30) + 30) % 30) : null);
						const rMd = (rm.mcLon != null) ? (((rm.mcLon % 30) + 30) % 30) : null;
						return (
							<div style={{ fontSize: 12.5, lineHeight: '20px' }}>
								<div>{this.state.relocCity} 上升 {rA ? <b style={{ color: ACC }}>{sGlyph(rA)} {(SIGNS[rA] || {}).cn || ''}</b> : null} {rAd != null ? rAd.toFixed(2) + '°' : ''}</div>
								<div>{this.state.relocCity} 天顶 {rM ? <b style={{ color: ACC }}>{sGlyph(rM)} {(SIGNS[rM] || {}).cn || ''}</b> : null} {rMd != null ? rMd.toFixed(2) + '°' : ''}</div>
								<div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 2 }}>保黄经星位不变,仅四轴/宫随地点重算;用于「同一时刻对某地的角度强调」。</div>
							</div>
						);
					})() : null}
				</div>
			</div>
		);
	}

	// §14.2 天气占星卡(best-effort)+ §14 其他子流派清单。入境(季)/朔望(旬)概览显示。
	renderWeatherCard(chart, extra){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts){ return null; }
		let w = null;
		try{ w = describeMundaneWeather(facts); }catch(e){ w = null; }
		const type = (extra || {}).mundaneType || 'ingress';
		const scope = (type === 'newmoon' || type === 'fullmoon') ? '本旬' : '本季';
		const ACC = '#2980b9';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />专门子流派 · 天气占星</div>
				{(w && w.factors.length) ? (
					<div>
						<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, lineHeight: '17px' }}>临角或合月行星定{scope}天气倾向(托勒密 astrometeorology):</div>
						{w.factors.map((f) => (
							<div key={f.key} style={{ fontSize: 12.5, padding: '2.5px 0', color: f.malefic ? '#c0392b' : 'inherit' }}>
								{pGlyph(f.key)} {f.cn} <span style={{ opacity: 0.5, fontSize: 11 }}>{[f.angular ? '临角' : '', f.nearMoon ? '合月' : ''].filter(Boolean).join('·')}</span> → {f.weather}
							</div>
						))}
					</div>
				) : <div style={{ fontSize: 12, opacity: 0.55, padding: '4px 0' }}>本盘无临角/合月行星主导,{scope}天气倾向不显著(合于时令)。</div>}
				<div style={{ fontSize: 10.5, opacity: 0.42, marginTop: 8, lineHeight: '15px' }}>其他专门子流派:金融/财经(首盘·Bradley 指数·周期宏观)见独立金融页;地震占星属研究性·统计未证实,仅备探索、不作预测断言。</div>
			</div>
		);
	}

	// ---------- 左栏 ----------
	renderLeftExtra({ extra, setExtra, fields, setTime, patchFields }){
		const type = extra.mundaneType || 'ingress';
		const ruleset = extra.mundaneRuleset || 'modern';
		this._setTime = setTime; this._fields = fields; this._setExtra = setExtra;   // 供右栏校正/会合起盘用
		return (
			<div className="horosa-field-block horosa-mundane-left">
				<div className="horosa-field-label">世运规则集</div>
				<XQSelect style={{ width: '100%' }} size="small" value={ruleset}
					onChange={(v) => setExtra({ mundaneRuleset: v })}>
					{MUNDANE_RULESETS.map((r) => (<Option key={r.key} value={r.key}>{r.label}</Option>))}
				</XQSelect>
				<div className="horosa-field-label" style={{ marginTop: 10 }}>世俗盘类型</div>
				<XQSelect style={{ width: '100%' }} size="small" value={type}
					onChange={(v) => setExtra({ mundaneType: v })}>
					{MUNDANE_TYPES.map((t) => (<Option key={t.key} value={t.key}>{t.label}</Option>))}
				</XQSelect>
				<div className="horosa-mundane-controls">
					{type === 'ingress' ? this.renderIngressLeft(extra, setExtra, fields, setTime) : null}
					{(type === 'newmoon' || type === 'fullmoon' || type === 'solecl' || type === 'lunecl') ? this.renderScanLeft(type, extra, setExtra, fields, setTime) : null}
					{type === 'region' ? this.renderRegionLeft(extra, setExtra, patchFields, fields) : null}
					{type === 'cycles' ? (<div className="horosa-mundane-hint">「行星周期」在右栏设定年段，计算木土大合相时代纪元。</div>) : null}
				</div>
			</div>
		);
	}

	renderIngressLeft(extra, setExtra, fields, setTime){
		const term = extra.ingressTerm || '春分';
		const year = extra.ingressYear != null ? extra.ingressYear : currentYear();
		return (
			<div>
				<div className="horosa-field-label sub">入宫节气</div>
				<XQSelect style={{ width: '100%' }} size="small" value={term}
					onChange={(v) => setExtra({ ingressTerm: v })}>
					{INGRESSES.map((it) => (<Option key={it.term} value={it.term}>{it.label}</Option>))}
				</XQSelect>
				<div className="horosa-field-label sub">年份</div>
				<InputNumber size="small" style={{ width: '100%' }} value={year} min={-3000} max={3000}
					onChange={(v) => setExtra({ ingressYear: clampYear(v, currentYear()) })} />
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} disabled={this.state.casting}
					onClick={() => this.castIngress(extra, setExtra, fields, setTime)}>{this.state.casting ? '排盘中…' : '排入宫盘'}</XQButton>
				{this.state.err ? (<div className="horosa-mundane-err">{this.state.err}</div>) : null}
			</div>
		);
	}

	renderScanLeft(type, extra, setExtra, fields, setTime){
		const year = extra.scanYear != null ? extra.scanYear : currentYear();
		const isEcl = (type === 'solecl' || type === 'lunecl');
		const rows = (this.state.scanType === type) ? this.state.scanRows : null;
		const evName = type === 'newmoon' ? '新月' : (type === 'fullmoon' ? '满月' : '食相');
		return (
			<div>
				<div className="horosa-field-label sub">年份</div>
				<InputNumber size="small" style={{ width: '100%' }} value={year} min={-3000} max={3000}
					onChange={(v) => setExtra({ scanYear: clampYear(v, currentYear()) })} />
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} disabled={this.state.scanLoading}
					onClick={() => this.scanEvents(type, extra, fields)}>{this.state.scanLoading ? '扫描中…' : `扫描当年${evName}`}</XQButton>
				{this.state.scanErr ? (<div className="horosa-mundane-err">{this.state.scanErr}</div>) : null}
				{rows ? (
					<div className="horosa-mundane-scanlist">
						{rows.length === 0 ? (<div className="empty">该年无{evName}。</div>) : rows.map((row, i) => {
							const sg = row.sign ? SIGNS[row.sign] : null;
							const active = extra.selectedMoment === row.localTime;
							return (
								<div key={i} className={'row' + (active ? ' active' : '')} onClick={() => this.useMoment(row, type, setExtra, fields, setTime)}>
									<span className="t">{row.localTime}</span>
									<span className="s">
										{sg ? <span style={{ color: ELEMENT_COLOR[sg.element] }}>{sGlyph(row.sign)} {sg.cn}</span> : ''}
										{isEcl && row.eclipseType ? <em>{row.eclipseType}</em> : null}
									</span>
								</div>
							);
						})}
					</div>
				) : (<div className="horosa-mundane-hint">点「扫描」列出该年事件，再点选某条按精确时刻起盘。</div>)}
			</div>
		);
	}

	renderRegionLeft(extra, setExtra, patchFields, fields){
		const regions = allRegions();
		const keys = Object.keys(regions);
		const f = this.state.regionForm;
		const setF = (k, v) => this.setState({ regionForm: { ...this.state.regionForm, [k]: v } });
		return (
			<div>
				<div className="horosa-field-label sub">选择地区盘</div>
				<XQSelect style={{ width: '100%' }} size="small" value={extra.regionKey || undefined} placeholder="选择地区盘"
					onChange={(v) => this.applyRegion(v, setExtra, patchFields)}>
					{keys.map((k) => (<Option key={k} value={k}>{regions[k].cn}</Option>))}
				</XQSelect>
				{(() => {
					const cands = extra.regionKey ? regionCandidates(extra.regionKey) : null;
					if(!cands || cands.length < 2){ return null; }
					const curKey = this.state.regionCandKey || cands[0].key;
					const curNote = (cands.find((c) => c.key === curKey) || cands[0]).note;
					return (
						<div style={{ marginTop: 10 }}>
							<div className="horosa-field-label sub">建置时刻候选 · 多盘对比</div>
							<XQSelect style={{ width: '100%' }} size="small" value={curKey}
								onChange={(v) => { const c = cands.find((x) => x.key === v); this.applyRegion(extra.regionKey, setExtra, patchFields, c); }}>
								{cands.map((c) => (<Option key={c.key} value={c.key}>{c.label}</Option>))}
							</XQSelect>
							<div style={{ fontSize: 11, opacity: 0.55, marginTop: 5, lineHeight: 1.5 }}>{curNote}　该盘例史上对确切时刻有不同主张，切换对比哪个更合事件走势。</div>
						</div>
					);
				})()}
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} onClick={() => this.setState({ regionAddOpen: !this.state.regionAddOpen })}>{this.state.regionAddOpen ? '收起' : '＋ 存当前盘为地区盘'}</XQButton>
				{this.state.regionAddOpen ? (
					<div className="horosa-mundane-regionform">
						<ol className="horosa-mundane-steps">
							<li>用上方「<b>时间</b>」设定历史建置日期时刻</li>
							<li>用上方「<b>地点</b>」选取坐标(可用下方首都速填)</li>
							<li>下方命名后保存</li>
						</ol>
						<div className="horosa-field-label sub">首都速填坐标（中性地理·选填）</div>
						<XQSelect style={{ width: '100%' }} size="small" placeholder="选首都自动填坐标" allowClear
							onChange={(v) => { const c = MUNDANE_CAPITALS.find((x) => x.cn === v); if(c){ patchFields({ lon: c.lon, lat: c.lat, gpsLon: c.gpsLon, gpsLat: c.gpsLat, pos: c.cn }); if(!f.name){ setF('name', c.cn); } } }}>
							{MUNDANE_CAPITALS.map((c) => (<Option key={c.cn} value={c.cn}>{c.cn}</Option>))}
						</XQSelect>
						<Input size="small" style={{ marginTop: 8 }} placeholder="地区 / 事件名称" value={f.name} onChange={(e) => setF('name', e.target.value)} onPressEnter={() => this.addRegion(setExtra, patchFields, fields)} />
						<XQButton size="small" style={{ width: '100%' }} onClick={() => this.addRegion(setExtra, patchFields, fields)}>保存当前盘为地区盘</XQButton>
						{this.state.scanErr ? (<div className="horosa-mundane-err">{this.state.scanErr}</div>) : null}
					</div>
				) : null}
			</div>
		);
	}

	// ---------- 右栏 ----------
	renderFixedStarCard(chart, extra){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts){ return null; }
		const year = (extra && extra.ingressYear) || currentYear();
		const hits = mundaneFixedStarHits(buildMundaneStarPoints(facts), year, 1.5);
		if(!hits.length){ return null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#1976d2', borderRadius: 2, display: 'inline-block' }} />世运恒星命中（{year} 年岁差校正 · orb 1.5°）</div>
				{hits.map((h, i) => (
					<div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600 }}>{h.pointCn} 合 {h.starCn}{h.royal ? <span style={{ color: '#b8860b' }}>（王星·{h.royal}）</span> : null} <span style={{ opacity: 0.55, fontWeight: 400 }}>{h.nature} · {h.orb}°</span></div>
						<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '17px', marginTop: 1 }}>{h.meaning}</div>
					</div>
				))}
				<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>恒星合四轴或日月时极具分量;王星(东毕宿五/北轩辕十四/西心宿二/南北落师门)尤重。</div>
			</div>
		);
	}

	// WP-7 地理分野(§12):本盘四轴落分野 + 托勒密四象限;中性数据·多源·免责。ACG 星图线=已有页,不做。
	renderChorographyCard(chart, extra){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts){ return null; }
		const dsKey = rulesetConfig((extra || {}).mundaneRuleset).chorographyDataset;
		let r = null;
		try{ r = describeChorography(facts, dsKey); }catch(e){ r = null; }
		if(!r){ return null; }
		const sCn = (k) => (SIGNS[k] || {}).cn || k;
		const ACC = '#16a085';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />地理分野 Chorography（{r.datasetMeta.label}）</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, lineHeight: '17px' }}>{r.datasetMeta.note}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '2px 0 2px' }}>本盘四轴落分野 · 本年地理强调</div>
				{r.axes.map((a, i) => (
					<div key={a.axis} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600 }}>
							<span style={{ opacity: 0.5, fontWeight: 400, marginRight: 6 }}>{a.cn}</span>
							<span style={{ color: ACC }}>{sGlyph(a.sign)}</span> {sCn(a.sign)}
						</div>
						<div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: '17px', marginTop: 1 }}>地域：{a.regions.countries.join('、')}</div>
						<div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 1 }}>城市：{a.regions.cities.join('、')}</div>
					</div>
				))}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '10px 0 4px' }}>托勒密四象限 · 三方主管</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
					{r.quadrants.map((q) => (
						<div key={q.key} style={{ flex: '1 1 46%', minWidth: 132, border: `1px solid ${ELEMENT_COLOR[q.element]}33`, borderLeft: `3px solid ${ELEMENT_COLOR[q.element]}`, borderRadius: 6, padding: '4px 8px' }}>
							<div style={{ fontSize: 12, fontWeight: 600, color: ELEMENT_COLOR[q.element], display: 'flex', alignItems: 'center', gap: 1 }}><span style={{ marginRight: 3 }}>{q.cn}</span>{q.signs.map((s, si) => (<span key={si} style={{ display: 'inline-flex', justifyContent: 'center', minWidth: '1.3em' }}>{sGlyph(s)}</span>))}</div>
							<div style={{ fontSize: 10.5, opacity: 0.62, lineHeight: '15px', marginTop: 1 }}>主星 {PLANET_CN[q.rulers.day]}/{PLANET_CN[q.rulers.night]} · {q.region}</div>
						</div>
					))}
				</div>
				<div style={{ fontSize: 10, opacity: 0.42, marginTop: 8, lineHeight: '15px' }}>⚠️ {CHOROGRAPHY_DISCLAIMER}</div>
			</div>
		);
	}

	// WP-6 地区盘推运(§11.2):小限 Profections + 法达 Firdaria(纯前端,以建置盘为基准)。
	renderProgressionCard(chart, extra){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts || !facts.meta || !facts.meta.ascSign){ return null; }
		const ACC = '#e67e22';
		const founding = (this.state.progFoundingYear != null) ? this.state.progFoundingYear : ((extra && extra.regionFoundingYear) || null);
		const target = (this.state.progTargetYear != null) ? this.state.progTargetYear : currentYear();
		const age = (founding != null) ? Math.max(0, target - founding) : null;
		const prof = (age != null) ? mundaneProfection(facts.meta.ascSign, age) : null;
		const fird = (age != null) ? mundaneFirdaria(facts.meta.sect, age) : null;
		const sCn = (k) => (SIGNS[k] || {}).cn || k;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />地区盘推运</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, lineHeight: '17px' }}>以地区建置/政权宣告盘为命基,小限·法达推目标年运势重心(盘龄 = 目标年 − 建置年)。</div>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
					<span style={{ fontSize: 11.5, opacity: 0.6 }}>建置年</span>
					<InputNumber size="small" style={{ width: 80 }} value={founding} min={-3000} max={3000} onChange={(v) => this.setState({ progFoundingYear: v })} />
					<span style={{ fontSize: 11.5, opacity: 0.6 }}>目标年</span>
					<InputNumber size="small" style={{ width: 80 }} value={target} min={-3000} max={3000} onChange={(v) => this.setState({ progTargetYear: clampYear(v, currentYear()) })} />
					{age != null ? <span style={{ fontSize: 11.5, opacity: 0.75, color: ACC }}>盘龄 {age} 年</span> : null}
				</div>
				{age == null ? <div style={{ fontSize: 12, opacity: 0.55, padding: '4px 0' }}>填「建置年」(或左栏选预置地区盘自动带入)后,显示小限与法达。</div> : null}
				{prof ? (
					<div style={{ marginBottom: fird ? 12 : 0, paddingBottom: fird ? 10 : 0, borderBottom: fird ? '1px solid rgba(128,128,128,0.08)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>小限 · 流年</div>
						<div style={{ fontSize: 13, lineHeight: '20px' }}>年小限 <b style={{ color: ACC }}>{sGlyph(prof.profectedSign)} {prof.profectedSignCn}</b> · 激活第 {prof.activatedHouse} 宫 <span style={{ opacity: 0.6 }}>（{prof.houseTheme}）</span></div>
						<div style={{ fontSize: 12.5, marginTop: 2 }}>年主 {pGlyph(prof.lord)} {prof.lordCn} <span style={{ opacity: 0.5, fontSize: 11 }}>· 其命盘状态定全年基调</span></div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 9px', marginTop: 6, fontSize: 10.5, opacity: 0.7 }}>
							{prof.months.map((m) => (<span key={m.month}>{m.month}月 {sGlyph(m.sign)}{sCn(m.sign)}</span>))}
						</div>
					</div>
				) : null}
				{fird ? (
					<div>
						<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>法达 · {fird.sectCn}时主</div>
						<div style={{ fontSize: 13, lineHeight: '20px' }}>大期 <b style={{ color: ACC }}>{pGlyph(fird.major.planet)} {fird.major.planetCn}</b> <span style={{ opacity: 0.6, fontSize: 11 }}>（盘龄 {fird.major.start}–{fird.major.end}）</span>{fird.sub ? <span> · 子期 {pGlyph(fird.sub.planet)} {fird.sub.planetCn}</span> : <span style={{ opacity: 0.6, fontSize: 11 }}> · 交点期不分子期</span>}</div>
						<div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 6, lineHeight: '16px' }}>序：{fird.sequence.map((x) => `${x.planetCn}${x.years}`).join(' · ')}（七政 70+南北交 5 = 75 年一轮）</div>
					</div>
				) : null}
				{age != null ? (
					<div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
							<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>太阳返照 · {target} 年度地区图</span>
							<XQButton size="small" disabled={this.state.srLoading} onClick={() => this.computeMundaneReturn(chart, target)}>{this.state.srLoading ? '计算中…' : '排返照盘'}</XQButton>
						</div>
						{this.state.srErr ? <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 4 }}>{this.state.srErr}</div> : null}
						{(this.state.srData && this.state.srYear === target && this.state.srKey === chartRequestKey(chart)) ? (
							<div style={{ fontSize: 12.5, lineHeight: '19px' }}>
								<div>返照时刻 <b>{this.state.srData.solarReturn ? this.state.srData.solarReturn.datetime : '-'}</b></div>
								<div>返照上升 {(this.state.srData.solarAsc && this.state.srData.solarAsc.sign) ? <span style={{ color: ACC }}>{sGlyph(String(this.state.srData.solarAsc.sign).toLowerCase())}</span> : null} {fmtDegree(this.state.srData.solarAsc)}</div>
								<div style={{ opacity: 0.55, fontSize: 11, marginTop: 2 }}>返照盘四轴与地区盘叠加判读{this.state.srData.lunarReturn ? '；首个月返照 ' + this.state.srData.lunarReturn.datetime : ''}。</div>
							</div>
						) : <div style={{ fontSize: 11, opacity: 0.5 }}>点「排返照盘」按目标年太阳回归本位起年度地区图(返照盘四轴叠加命盘判读)。</div>}
					</div>
				) : null}
				{age != null ? (
					<div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
							<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>次限 · 太阳弧 · {target} 年</span>
							<XQButton size="small" disabled={this.state.secLoading} onClick={() => this.computeMundaneSecondary(chart, target)}>{this.state.secLoading ? '计算中…' : '排次限'}</XQButton>
						</div>
						{this.state.secErr ? <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 4 }}>{this.state.secErr}</div> : null}
						{(this.state.secData && this.state.secYear === target && this.state.secKey === chartRequestKey(chart)) ? (() => {
							const sec = this.state.secData;
							const pos = sec.positions || [];
							const pSun = pos.find((p) => p.id === 'Sun');
							const pMoon = pos.find((p) => p.id === 'Moon');
							const natalSun = (facts.planets && facts.planets.sun) ? facts.planets.sun.lon : null;
							const arc = (pSun && natalSun != null) ? (((pSun.lon - natalSun) % 360 + 360) % 360) : null;
							const sCn = (s) => (SIGNS[String(s || '').toLowerCase()] || {}).cn || s;
							const ASP_CN = { 0: '合', 60: '六合', 90: '刑', 120: '三合', 180: '冲' };
							const pCn = (id) => MUN_PLANET_CN[String(id).toLowerCase()] || id;
							return (
								<div style={{ fontSize: 12.5, lineHeight: '19px' }}>
									{pSun ? <div>次限太阳 {pGlyph('sun')} {sCn(pSun.sign)} {pSun.signlon != null ? pSun.signlon.toFixed(1) + '°' : ''}</div> : null}
									{pMoon ? <div>次限月亮 {pGlyph('moon')} {sCn(pMoon.sign)} {pMoon.signlon != null ? pMoon.signlon.toFixed(1) + '°' : ''}</div> : null}
									{arc != null ? <div>太阳弧 <b style={{ color: ACC }}>{arc.toFixed(1)}°</b> <span style={{ opacity: 0.5, fontSize: 11 }}>(全盘整体推进此弧)</span></div> : null}
									{(sec.aspectsToNatal && sec.aspectsToNatal.length) ? <div style={{ marginTop: 4, opacity: 0.85 }}>应期(次限击本命):{sec.aspectsToNatal.slice(0, 6).map((a, i) => (<span key={i} style={{ marginRight: 8 }}>次限{pCn(a.a)}{ASP_CN[a.aspect] || a.aspect + '°'}本命{pCn(a.b)}({a.orb != null ? a.orb.toFixed(1) : '?'}°)</span>))}</div> : null}
								</div>
							);
						})() : <div style={{ fontSize: 11, opacity: 0.5 }}>点「排次限」按"一日一年"推目标年次限盘 + 太阳弧引动(进太阳击本命四轴/星)。</div>}
					</div>
				) : null}
			</div>
		);
	}

	// WP-6 主限四轴向运(§11.2):走专用主限推运引擎(精度已固定),独立成页,此处给精确指引,不另起脆弱耦合表。
	renderPrimaryDirectionNote(){
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#6a4c93', borderRadius: 2, display: 'inline-block' }} />主限四轴向运</div>
				<div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: '18px' }}>
					把本盘上升 / 天顶按主限弧推向各行星,标记国运重大转折年。此法走专用主限推运引擎(精度对齐独立校验),独立成页以保精度。
				</div>
				<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '18px', marginTop: 5 }}><b>排法:</b>记下本盘建置日期 · 时刻 · 坐标,于「占星 → 主限」载入该盘,即得逐年向运表(迫星 · 应星 · 应期年)。</div>
			</div>
		);
	}

	// WP-2 §17 盘型·格局:分布型(前端 Jones+元素/模式/半球)+ 相位格局(后端 analysis surfacing)。
	renderDistributionCard(chart, extra){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		if(!facts){ return null; }
		const cfg = rulesetConfig((extra || {}).mundaneRuleset);
		const dist = mundaneDistribution(facts, cfg.showOuterPlanets);   // 排盘判读真随流派:古典/中世纪只七曜
		const ACC = '#6a4c93';
		const OUTER = ['uranus', 'neptune', 'pluto'];
		const isOuter = (id) => OUTER.indexOf(String(id).toLowerCase()) >= 0;
		const allPats = (this.state.patKey === chartRequestKey(chart) && this.state.patData) ? this.state.patData : null;
		const pats = allPats ? (cfg.showOuterPlanets ? allPats : allPats.filter((p) => !(p.points || []).some(isOuter))) : null;
		const hemi = dist ? dist.hemispheres : null;
		const apexCn = (id) => MUN_PLANET_CN[String(id).toLowerCase()] || id;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />盘型 · 格局</div>
				{dist ? (
					<div style={{ marginBottom: 10 }}>
						{dist.jonesInfo ? <div style={{ fontSize: 13, lineHeight: '20px' }}>分布型 <b style={{ color: ACC }}>{dist.jonesInfo.cn}</b> <span style={{ opacity: 0.7, fontSize: 11.5 }}>{dist.jonesInfo.text}</span></div> : null}
						<div style={{ fontSize: 12.5, marginTop: 4 }}>元素偏盛 <b style={{ color: ACC }}>{dist.domElementCn}象</b>（火{dist.elements.fire}·土{dist.elements.earth}·风{dist.elements.air}·水{dist.elements.water}）<span style={{ opacity: 0.6, fontSize: 11 }}>{dist.domElementText}</span></div>
						<div style={{ fontSize: 12.5, marginTop: 2 }}>模式偏盛 <b style={{ color: ACC }}>{dist.domModeCn}</b>（基本{dist.modes.cardinal}·固定{dist.modes.fixed}·变动{dist.modes.mutable}）<span style={{ opacity: 0.6, fontSize: 11 }}>{dist.domModeText}</span></div>
						{hemi ? <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>半球 上{hemi.above}/下{hemi.below}（外显↔内政）· 东{hemi.east}/西{hemi.west}（自主↔关系）</div> : null}
						<div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 3 }}>分布基准：{dist.count} 体（{dist.classical ? '七曜·古典/中世纪规则集' : '含 ♅♆♇·现代/Barbault 规则集'}）</div>
					</div>
				) : null}
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, borderTop: '1px solid rgba(128,128,128,0.08)', paddingTop: 8 }}>
					<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>相位格局</span>
					<XQButton size="small" disabled={this.state.patLoading} onClick={() => this.computeMundanePatterns(chart)}>{this.state.patLoading ? '计算中…' : '查格局'}</XQButton>
				</div>
				{this.state.patErr ? <div style={{ fontSize: 11, color: '#c0392b' }}>{this.state.patErr}</div> : null}
				{pats ? (pats.length ? pats.map((p, i) => {
					const m = mundanePatternMeaning(p.type);
					return m ? (
						<div key={i} style={{ padding: '4px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
							<div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.cn}{p.apex ? <span style={{ opacity: 0.6, fontWeight: 400 }}>（顶点 {apexCn(p.apex)}）</span> : null}{p.sign ? <span style={{ opacity: 0.6, fontWeight: 400 }}>（{(SIGNS[String(p.sign).toLowerCase()] || {}).cn || p.sign}）</span> : null}</div>
							<div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: '17px' }}>{m.text}</div>
						</div>
					) : null;
				}) : <div style={{ fontSize: 11.5, opacity: 0.55 }}>本盘无显著相位格局。</div>) : <div style={{ fontSize: 11, opacity: 0.5 }}>点「查格局」检测 大三角/大十字/T三角/Yod/风筝/星群 等。</div>}
			</div>
		);
	}

	// §16.3 会合盘指示星(仅木土会合盘显示):木/土得力定吉凶,会合座元素定气候。
	renderConjunctionIndicator(chart){
		if(!chart){ return null; }
		let facts = null;
		try{ facts = buildFacts(chart); }catch(e){ facts = null; }
		const ind = facts ? mundaneConjunctionIndicator(facts) : null;
		if(!ind){ return null; }
		const toneColor = ind.tone === '吉' ? '#2e7d32' : (ind.tone === '凶' ? '#c0392b' : '#8a6d3b');
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: toneColor, borderRadius: 2, display: 'inline-block' }} />会合指示星</div>
				<div style={{ fontSize: 12.5, lineHeight: '20px' }}>木土会合于 <b style={{ color: toneColor }}>{ind.signCn}</b>（{ELEMENT_CN[ind.element] || ind.element} · 角距 {ind.sep}°）</div>
				<div style={{ fontSize: 12.5, marginTop: 3 }}>指示星 <b style={{ color: toneColor }}>{ind.strongerCn}</b> <span style={{ color: toneColor, fontWeight: 700 }}>（{ind.tone}）</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 3, lineHeight: '17px' }}>{ind.toneText}</div>
				<div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4, lineHeight: '17px' }}>气候 / 领域：{ind.climate}</div>
			</div>
		);
	}

	renderVictorCard(chart, extra){
		if(!chart){ return null; }
		let v = null;
		try{ v = describeMundaneVictor(buildFacts(chart), (extra || {}).mundaneRuleset); }catch(e){ v = null; }
		if(!v){ return null; }
		const top = v.scores.filter((x) => x.score > 0);
		const maxS = v.maxScore || 1;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#9c27b0', borderRadius: 2, display: 'inline-block' }} />定局 · 年主/盘主</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
					<span style={{ fontSize: 22, color: '#9c27b0' }}>{pGlyph(v.victor)}</span>
					<div>
						<div style={{ fontSize: 15, fontWeight: 700, color: '#9c27b0' }}>{v.victorCn} · 年主星</div>
						<div style={{ fontSize: 11, opacity: 0.7 }}>{v.victorMundane ? v.victorMundane.powerRole : ''}</div>
					</div>
					<span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>累分 {v.maxScore}</span>
				</div>
				<div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>取点：{v.points.join(' / ')}（各 5 重尊贵 + 宫位累加）</div>
				{top.map((x) => (
					<div key={x.planet} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '2px 0' }}>
						<span style={{ width: 42, flex: '0 0 42px' }}>{pGlyph(x.planet)} {x.cn}</span>
						<span style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.12)', borderRadius: 3, overflow: 'hidden' }}>
							<span style={{ display: 'block', height: '100%', width: `${Math.round(x.score / maxS * 100)}%`, background: x.planet === v.victor ? '#9c27b0' : 'rgba(156,39,176,0.4)' }} />
						</span>
						<span style={{ width: 22, textAlign: 'right', opacity: 0.7 }}>{x.score}</span>
					</div>
				))}
				<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>年主星主导该年/季世俗主题(政权人物/行业领域);福点·产前朔望点齐备后累分更全。</div>
			</div>
		);
	}
	renderJudgmentCards(chart){
		if(!chart){ return null; }
		let rows = [];
		try{ rows = describeMundaneChart(buildFacts(chart)); }catch(e){ rows = []; }
		if(!rows.length){ return null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#8a6d3b', borderRadius: 2, display: 'inline-block' }} />行星落世俗宫</div>
				{rows.map((r, i) => (
					<div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid rgba(128,128,128,0.07)' : 'none' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
							<span style={{ fontSize: 14 }}>{pGlyph(r.planet)}</span>{r.planetCn}
							<span style={{ opacity: 0.55, fontWeight: 400 }}>第{r.house}宫 · {r.houseMeaning}</span>
							{r.retro ? <span style={{ fontSize: 10, color: '#c0392b', opacity: 0.8 }}>逆</span> : null}
						</div>
						<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '17px', marginTop: 2 }}>{r.text}</div>
						{r.signTemper ? <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 1 }}>座气质 · {r.signTemper.modeElement}：{r.signTemper.temper}</div> : null}
					</div>
				))}
				<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>判词为概括之象，须结合相位、宫主星状态与时势综合论断。</div>
			</div>
		);
	}

	renderIngressSkeleton(chart){
		if(!chart){ return null; }
		let sk = null, syz = null;
		try{ const f = buildFacts(chart); sk = describeIngressSkeleton(f); syz = describeMundaneSyzygy(f); }catch(e){ sk = null; }
		if(!sk){ return null; }
		const hL = (h, m) => h ? `第${h}宫${m ? ' · ' + m : ''}` : '未定';
		const row = (label, content) => (
			<div style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(128,128,128,0.06)', fontSize: 12, lineHeight: '18px' }}>
				<span style={{ width: 50, flex: '0 0 50px', opacity: 0.5 }}>{label}</span>
				<span style={{ flex: 1 }}>{content}</span>
			</div>
		);
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#8a6d3b', borderRadius: 2, display: 'inline-block' }} />入境判读骨架</div>
				{row('上升', <span>{sGlyph(sk.ascSign)} {sk.ascSignCn}{sk.ascTemper ? <span style={{ opacity: 0.6 }}>（{sk.ascTemper.temper}）</span> : null}</span>)}
				{row('年主星', <span>{pGlyph(sk.ascRuler)} {sk.ascRulerCn} 落 {hL(sk.ascRulerHouse)}{sk.ascRulerAngular ? <b style={{ color: '#b8860b' }}> · 临轴</b> : null}{sk.ascRulerRetro ? ' · 逆' : ''}</span>)}
				{row('政权', <span>10宫主 {pGlyph(sk.tenthRuler)}{sk.tenthRulerCn} · 太阳 {hL(sk.sun && sk.sun.house, sk.sun && sk.sun.houseMeaning)}{sk.tenthPlanets.length ? <span style={{ opacity: 0.6 }}>（10宫内：{sk.tenthPlanets.map((x) => x.cn).join('、')}）</span> : null}</span>)}
				{row('民生', <span>月亮 {hL(sk.moon && sk.moon.house, sk.moon && sk.moon.houseMeaning)}</span>)}
				{syz ? row('产前朔望', <span>{sGlyph(syz.sign)} {syz.signCn} {syz.signlon != null ? syz.signlon.toFixed(1) + '°' : ''}{syz.kind ? <span style={{ opacity: 0.6 }}>（{syz.kind}）</span> : null}</span>) : null}
				{row('临四轴', sk.angular.length ? <span>{sk.angular.map((a) => (<span key={a.key} style={{ color: a.malefic ? '#c0392b' : 'inherit', marginRight: 7 }}>{a.cn}(第{a.house}宫){a.malefic ? '⚠' : ''}</span>))}<span style={{ opacity: 0.45 }}>凶星临轴主动荡</span></span> : <span style={{ opacity: 0.5 }}>无</span>)}
				{row('外行星', sk.outers.length ? <span>{sk.outers.map((o) => `${o.cn} ${o.houseMeaning}`).join('；')}</span> : <span style={{ opacity: 0.5 }}>—</span>)}
				<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>当年外行星落宫叠加时代背景。</div>
			</div>
		);
	}

	// WP-1 四季入境盘:四枢轴(春分白羊·夏至巨蟹·秋分天秤·冬至摩羯)一览,点击起该季盘。
	renderSeasonalCard(extra){
		const year = clampYear(extra.ingressYear, currentYear());
		const seed = (this.state.seasonSeedYear === year) ? this.state.seasonSeed : null;
		const ACC = '#2e7d32';
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />四季入境盘 · {year}</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, lineHeight: '17px' }}>春分(白羊·年盘)、夏至(巨蟹)、秋分(天秤)、冬至(摩羯)四枢轴入境。年盘上升落基本座时主管缩至首季,须并参四季盘。</div>
				<XQButton size="small" disabled={this.state.seasonLoading} onClick={() => this.scanSeasonalIngresses(extra)}>{this.state.seasonLoading ? '计算中…' : (seed ? '重算四季' : '起四季盘')}</XQButton>
				{this.state.seasonErr ? <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>{this.state.seasonErr}</div> : null}
				{seed ? (
					<div style={{ marginTop: 8 }}>
						{INGRESSES.map((ing) => {
							const hit = seed[ing.term];
							const cur = (extra.ingressTerm === ing.term);
							return (
								<div key={ing.term} onClick={() => { if(hit && hit.time){ this.castSeasonalIngress(ing.term, hit.time, year); } }} title="点击起该季入境盘"
									style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(128,128,128,0.06)', cursor: (hit && hit.time) ? 'pointer' : 'default', fontSize: 12.5, fontWeight: cur ? 700 : 400 }}>
									<span><span style={{ color: ELEMENT_COLOR[(SIGNS[ing.signKey] || {}).element], marginRight: 5 }}>{sGlyph(ing.signKey)}</span>{SEASON_INGRESS_CN[ing.signKey]}{cur ? <span style={{ color: ACC, marginLeft: 6, fontSize: 10 }}>· 当前</span> : null}</span>
									<span style={{ opacity: 0.7 }}>{(hit && hit.time) ? hit.time.slice(0, 16) : '—'}<span style={{ marginLeft: 6, opacity: 0.35 }}>›</span></span>
								</div>
							);
						})}
						<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 6 }}>swisseph 精算入境时刻(当地时区)。点任一季起该季入宫盘。</div>
					</div>
				) : null}
			</div>
		);
	}
	renderYearChart(chart, extra){
		const yl = chart ? ascRuler(chart) : null;
		const ing = INGRESSES.find((i) => i.term === (extra.ingressTerm || '春分'));
		const gov = yl ? ingressGovernance(yl.signKey, rulesetConfig(extra.mundaneRuleset).ingressRule) : null;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#b8860b', borderRadius: 2, display: 'inline-block' }} />年盘概要</div>
				{extra.ingressMoment ? (
					<div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
							<span style={{ fontSize: 16, fontWeight: 700 }}>{extra.ingressYear != null ? extra.ingressYear : currentYear()} 年</span>
							<span style={{ fontSize: 12, opacity: 0.7 }}>{ing ? ing.label.split('（')[0] : '春分入宫'}</span>
						</div>
						<div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 12 }}>入宫时刻 {extra.ingressMoment}</div>
						{yl ? (
							<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(184,134,11,0.10)', border: '1px solid rgba(184,134,11,0.18)' }}>
								<div style={{ textAlign: 'center' }}>
									<div style={{ fontSize: 10, opacity: 0.6 }}>上升</div>
									<div style={{ fontSize: 20, lineHeight: '24px' }}>{sGlyph(yl.signKey)}</div>
									<div style={{ fontSize: 12 }}>{yl.signCn}</div>
								</div>
								<span style={{ opacity: 0.4, fontSize: 18 }}>→</span>
								<div style={{ textAlign: 'center' }}>
									<div style={{ fontSize: 10, opacity: 0.6, color: '#b8860b' }}>年主星 · 命主</div>
									<div style={{ fontSize: 22, lineHeight: '26px', color: '#b8860b' }}>{pGlyph(yl.rulerKey)}</div>
									<div style={{ fontSize: 13, fontWeight: 700, color: '#b8860b' }}>{yl.rulerCn}</div>
								</div>
							</div>
						) : null}
						{yl && gov ? (
							<div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 8 }}>
								本盘上升 {MODALITY_CN[yl.modality] || ''}星座 · {rulesetConfig(extra.mundaneRuleset).label} → 主管约 <b>{gov.spanMonths}</b> 个月。
								{gov.needSeasonal && gov.needSeasonal.length ? (<div style={{ marginTop: 3 }}>季度递归 → 须再起 <b>{gov.needSeasonal.map((sk) => SEASON_INGRESS_CN[sk] || sk).join(' / ')}</b> 入境盘各管一季。</div>) : null}
								<div style={{ marginTop: 3, fontSize: 11, opacity: 0.6 }}>{gov.note}</div>
							</div>
						) : null}
						<div style={{ fontSize: 11, opacity: 0.5, marginTop: 10, lineHeight: '16px' }}>年主星即入宫盘上升座之域主星，主导该年/季世俗主题；再综合四轴、十宫（政权）、各宫主星状态论断。</div>
					</div>
				) : (
					<div style={{ fontSize: 12, opacity: 0.55 }}>左栏选年份与入宫节气，点「排入宫盘」按精确入宫时刻起盘。春分白羊入宫盘 = 该年年盘。</div>
				)}
			</div>
		);
	}

	renderLunationCard(chart, extra, type){
		const facts = chart ? (() => { try{ return buildFacts(chart); }catch(e){ return null; } })() : null;
		const moon = facts && facts.planets ? facts.planets.moon : null;
		const sg = moon && moon.sign ? SIGNS[moon.sign] : null;
		const title = type === 'newmoon' ? '新月图' : '满月图';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: type === 'newmoon' ? '#555' : '#b8860b', borderRadius: 2, display: 'inline-block' }} />{title}</div>
				{extra.selectedMoment ? (
					<div>
						<div style={{ fontSize: 12.5, marginBottom: 6 }}>时刻 <b>{extra.selectedMoment}</b></div>
						{sg ? <div style={{ fontSize: 12.5 }}>月亮 <span style={{ color: ELEMENT_COLOR[sg.element] }}>{sGlyph(moon.sign)} {sg.cn}</span>{moon.house ? ` · 第${moon.house}宫（${MUNDANE_HOUSE_MEANINGS[moon.house]}）` : ''}</div> : null}
						<div style={{ fontSize: 11, opacity: 0.55, marginTop: 8, lineHeight: '16px' }}>{type === 'newmoon' ? '新月（日月合相）影响约一个月，主新启与变动；' : '满月（日月对分）影响约一个月，主成熟与张力；'}与当季入宫盘对照（入宫为时针、朔望为分针）。</div>
					</div>
				) : (<div style={{ fontSize: 12, opacity: 0.55 }}>左栏扫描并选取一个{type === 'newmoon' ? '新月' : '满月'}时刻起盘。</div>)}
			</div>
		);
	}

	renderEclipseCard(chart, extra, type){
		const facts = chart ? (() => { try{ return buildFacts(chart); }catch(e){ return null; } })() : null;
		const kind = type === 'lunecl' ? 'lunar' : 'solar';
		const rcfg = rulesetConfig((extra || {}).mundaneRuleset);   // 规则集:orbScheme 定受冲容许度、eclipseTiming 定是否示食时长定则
		const ec = facts ? describeEclipse(facts, kind) : null;
		const aff = facts ? describeEclipseAfflictions(facts, kind, rcfg.orbScheme) : null;
		const sg = ec && ec.sign ? SIGNS[ec.sign] : null;
		const title = type === 'lunecl' ? '月食图' : '日食图';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#7a3b8a', borderRadius: 2, display: 'inline-block' }} />{title}</div>
				{extra.selectedMoment && ec ? (
					<div>
						<div style={{ fontSize: 12.5, marginBottom: 6 }}>时刻 <b>{extra.selectedMoment}</b>{extra.eclipseTypeText ? ` · ${extra.eclipseTypeText}` : ''}</div>
						<div style={{ fontSize: 12.5 }}>{ec.luminaryCn} <span style={{ color: sg ? ELEMENT_COLOR[sg.element] : undefined }}>{sg ? <>{sGlyph(ec.sign)} {sg.cn}</> : ec.sign}</span> · {ec.decanLabel}{ec.house ? ` · 第${ec.house}宫` : ''}</div>
						{ec.elementText ? <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 8, lineHeight: '17px' }}>元素：{ec.elementText}</div> : null}
						{ec.decanText ? <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 4, lineHeight: '17px' }}>分度：{ec.decanText}</div> : null}
						{aff && aff.afflictors.length ? (<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6, lineHeight: '17px' }}>受冲行星：{aff.afflictors.map((a) => (<span key={a.planet} style={{ color: a.malefic ? '#c0392b' : 'inherit', marginRight: 7 }}>{pGlyph(a.planet)}{a.cn}{a.aspect}({a.orb}°){a.malefic ? '⚠' : ''}</span>))}<span style={{ opacity: 0.5 }}>定受影响主题</span></div>) : null}
						{(() => {
							const lp = facts && facts.planets ? facts.planets[kind === 'lunar' ? 'moon' : 'sun'] : null;
							if(!lp || lp.lon == null){ return null; }
							const year = (extra && extra.scanYear) || currentYear();
							const hits = mundaneFixedStarHits([{ key: 'eclipse', cn: '食点', lon: lp.lon }], year, 1.5);
							return hits.length ? (<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6, lineHeight: '17px' }}>食点近恒星：{hits.map((h, i) => (<span key={i} style={{ color: /凶|失|暴|灾/.test(h.meaning || '') ? '#c0392b' : 'inherit', marginRight: 7 }}>{h.starCn}{h.royal ? `(王星·${h.royal})` : ''}（{h.nature} {h.orb}°）</span>))}<span style={{ opacity: 0.5 }}>恒星临食点增其象</span></div>) : null;
						})()}
						{rcfg.eclipseTiming !== 'none' && this.state.eclipseDetail && this.state.eclipseDetail.durationHours ? (
							<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8, lineHeight: '17px' }}>时长：约 <b>{this.state.eclipseDetail.durationHours}</b> 小时 → 影响约 <b>{this.state.eclipseDetail.influence}</b> {this.state.eclipseDetail.influenceUnit}（食时长定则）。</div>
						) : null}
						<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>食以可见地区最应；{rcfg.eclipseTiming !== 'none' ? '日食时长→影响年数、月食时长→影响月数。' : '本规则集（周期派）不采食时长定则,以周期相位为主。'}</div>
					</div>
				) : (<div style={{ fontSize: 12, opacity: 0.55 }}>左栏扫描并选取一个{title}时刻起盘。</div>)}
			</div>
		);
	}

	renderRegionCard(chart, extra){
		let facts = null;
		try{ facts = chart ? buildFacts(chart) : null; }catch(e){ facts = null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#2c7fb8', borderRadius: 2, display: 'inline-block' }} />地区盘 · 12 世俗宫{extra.regionCn ? ` · ${extra.regionCn}` : ''}</div>
				{facts && facts.houses ? (
					<div>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
							const hi = facts.houses[h];
							const occKeys = (hi && hi.planets || []).filter((k) => MUN_PLANET_CN[k]);
							const sg = hi && hi.sign ? SIGNS[hi.sign] : null;
							return (
								<div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderTop: h > 1 ? '1px solid rgba(128,128,128,0.06)' : 'none', fontSize: 11.5 }}>
									<span style={{ width: 22, opacity: 0.6, fontWeight: 700 }}>{h}</span>
									<span style={{ flex: 1 }}>{MUNDANE_HOUSE_MEANINGS[h]}</span>
									<span style={{ width: 74, textAlign: 'right', opacity: 0.85, display: 'inline-flex', gap: 3, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>{sg ? sGlyph(hi.sign) : null}{occKeys.map((k, ix) => <span key={ix}>{pGlyph(k)}</span>)}</span>
								</div>
							);
						})}
						<div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 8 }}>各宫义结合宫内行星与宫主星状态论该地区相关事务。</div>
					</div>
				) : (<div style={{ fontSize: 12, opacity: 0.55 }}>左栏选择或添加地区盘起盘。</div>)}
			</div>
		);
	}

	renderAge(age, i){
		const col = ELEMENT_COLOR[age.element] || '#888';
		const triads = [];
		for(let k = 0; k < age.conjs.length; k += 3){ triads.push(age.conjs.slice(k, k + 3)); }
		return (
			<div key={i} style={{ border: '1px solid rgba(128,128,128,0.14)', borderLeft: `3px solid ${col}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: ELEMENT_BG[age.element] }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<span style={{ fontSize: 17 }}>{sGlyph(age.leadingSignKey)}</span>
						<span style={{ fontSize: 14, fontWeight: 700 }}>{age.leadingCn}时代</span>
						<span style={{ fontSize: 11, color: col, border: `1px solid ${col}`, borderRadius: 4, padding: '0 5px', opacity: 0.9 }}>{ELEMENT_CN[age.element]}</span>
					</div>
					<span style={{ fontSize: 12, fontWeight: 600, color: col }}>{dignityText(age.dignities)}</span>
				</div>
				<div style={{ padding: '4px 12px 8px' }}>
					{triads.map((triad, ti) => {
						const ph = triadPhase(triad, age.element);
						const pcol = ELEMENT_COLOR[ph.el] || col;
						return (
							<div key={ti}>
								<div style={{ fontSize: 11, color: pcol, fontWeight: 600, margin: ti ? '8px 0 2px' : '4px 0 2px', letterSpacing: '0.05em' }}>{ph.label}</div>
								{triad.map((g, j) => {
									const sg = SIGNS[SIGN_KEYS[g.sign]] || {};
									const el = sg.element || 'earth';
									const transit = el !== age.element;
									const deg = g.lon != null ? `${(g.lon % 30).toFixed(1)}°` : '';
									return (
										<div key={j} onClick={() => this.castConjunction(g)} title="点击按此会合精确时刻起事件盘" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 0', fontSize: 12.5, borderTop: j ? '1px solid rgba(128,128,128,0.06)' : 'none', cursor: 'pointer' }}>
											<span style={{ width: 76, opacity: 0.65, whiteSpace: 'nowrap' }}>{yearLabel(g.year)}-{String(g.month).padStart(2, '0')}</span>
											<span style={{ flex: 1, whiteSpace: 'nowrap' }}>
												<span style={{ color: ELEMENT_COLOR[el], marginRight: 4 }}>{sGlyph(SIGN_KEYS[g.sign])}</span>{sg.cn}
												{transit ? <span style={{ fontSize: 10, opacity: 0.45, marginLeft: 6 }}>过渡</span> : null}
											</span>
											<span style={{ width: 46, textAlign: 'right', opacity: 0.65 }}>{deg}<span style={{ marginLeft: 5, opacity: 0.35 }}>›</span></span>
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	renderGreatConj(fill){
		const isFlat = this.state.gcMode === 'flat';
		const ages = (!isFlat && this.state.gcResults) ? computeAges(this.state.gcResults) : null;
		const flatList = isFlat ? (this.state.gcResults || []) : null;
		const total = this.state.gcResults ? this.state.gcResults.length : 0;
		const cardStyle = fill ? { ...CARD, marginBottom: 0, minHeight: '100%', boxSizing: 'border-box' } : CARD;
		const listStyle = fill ? { paddingRight: 4 } : { maxHeight: 460, overflowY: 'auto', paddingRight: 4 };
		const pairCn = (CYCLE_PAIRS.find((p) => p.key === this.state.gcPair) || {}).cn || '木土';
		const aspCn = this.state.gcAspect === 180 ? '对分' : '合相';
		return (
			<div style={cardStyle}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#2c7fb8', borderRadius: 2, display: 'inline-block' }} />行星周期 · {isFlat ? `${pairCn}` : '木土大合相·时代纪元'}</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10, lineHeight: '17px' }}>慢星周期标记时代脉动。木土合每约 20 年一会、约 200 年轮转一象（大三合）；其余慢星对的合/冲亦为重大历史节点（如土冥、天海循环）。</div>
				<div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
					<XQSelect size="small" style={{ width: 158 }} value={this.state.gcPair} onChange={(v) => this.setState({ gcPair: v })}>
						{CYCLE_PAIRS.map((p) => (<Option key={p.key} value={p.key}>{p.cn}</Option>))}
					</XQSelect>
					<XQSelect size="small" style={{ width: 104 }} value={this.state.gcAspect} onChange={(v) => this.setState({ gcAspect: v })}>
						{CYCLE_ASPECTS.map((a) => (<Option key={a.v} value={a.v}>{a.cn}</Option>))}
					</XQSelect>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
					<InputNumber size="small" style={{ width: 80 }} value={this.state.gcStart} min={-3000} max={3000}
						onChange={(v) => this.setState({ gcStart: clampYear(v, 1300) })} />
					<span style={{ fontSize: 12, opacity: 0.6 }}>至</span>
					<InputNumber size="small" style={{ width: 80 }} value={this.state.gcEnd} min={-3000} max={3000}
						onChange={(v) => this.setState({ gcEnd: clampYear(v, 2200) })} />
					<XQButton size="small" disabled={this.state.gcLoading} onClick={this.computeGreatConj}>{this.state.gcLoading ? '计算中…' : '计算'}</XQButton>
					<span style={{ fontSize: 11, opacity: 0.45 }}>前3000–3000</span>
				</div>
				{this.state.gcErr ? <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 8 }}>{this.state.gcErr}</div> : null}
				<Spin spinning={this.state.gcLoading}>
					{isFlat ? (
						flatList && flatList.length ? (
							<div style={listStyle}>
								{flatList.map((c, i) => {
									const sk = SIGN_KEYS[c.sign];
									const sg = SIGNS[sk] || {};
									return (
										<div key={i} onClick={() => this.castConjunction(c)} title="点击按此会合精确时刻起事件盘" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5, borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', cursor: 'pointer' }}>
											<span style={{ opacity: 0.65, width: 86, whiteSpace: 'nowrap' }}>{yearLabel(c.year)}-{String(c.month).padStart(2, '0')}</span>
											<span style={{ flex: 1, whiteSpace: 'nowrap' }}><span style={{ color: ELEMENT_COLOR[sg.element], marginRight: 4 }}>{sGlyph(sk)}</span>{sg.cn || ''}</span>
											<span style={{ width: 46, textAlign: 'right', opacity: 0.65 }}>{c.lon != null ? `${(c.lon % 30).toFixed(1)}°` : ''}<span style={{ marginLeft: 5, opacity: 0.35 }}>›</span></span>
										</div>
									);
								})}
								<div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{pairCn} · {total} 次{aspCn}（swisseph 精算）· 点击任一行按其精确时刻起会合事件盘。</div>
							</div>
						) : (<div style={{ fontSize: 12, opacity: 0.55, padding: '6px 0' }}>设定年段与星对、相位后点「计算」，列出该区间全部{aspCn}时刻。</div>)
					) : (
						ages && ages.length ? (
							<div style={listStyle}>
								{ages.map((a, i) => this.renderAge(a, i))}
								<div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{ages.length} 个时代 · {total} 次合相（swisseph 精算，含三重合相分列；「过渡」= 该次合相落入下一象，预示大转换）· 点击任一会合行起其事件盘。</div>
							</div>
						) : (
							<div style={{ fontSize: 12, opacity: 0.55, padding: '6px 0' }}>设定年段后点「计算」，按星历精算木土合相并归入各时代（座 / 度 / 象 / 主强落）。</div>
						)
					)}
				</Spin>
			</div>
		);
	}

	// Barbault 行星周期指数曲线(§9.3):折线图 + 极小/极大标注。古典/中世纪规则集无外行星 → 提示切换。
	renderBarbault(extra){
		const cfg = rulesetConfig((extra || {}).mundaneRuleset);
		const ACC = '#8e44ad';
		const head = (
			<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />Barbault 行星周期指数</div>
		);
		if(!cfg.showBarbault){
			return (
				<div style={{ ...CARD, marginTop: 10 }}>
					{head}
					<div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.7 }}>Barbault 指数依赖外行星（♅♆♇），当前「{cfg.label}」为古典体系（七曜，无外行星）。切换至「现代」或「Barbault 周期」规则集即可启用。</div>
				</div>
			);
		}
		const set = BARBAULT_SETS.find((s) => s.key === this.state.bbSet) || BARBAULT_SETS[0];
		const d = this.state.bbData;
		const pts = (d && Array.isArray(d.points)) ? d.points : [];
		const maxIndex = (d && d.maxIndex) || (set.planets.length * (set.planets.length - 1) / 2 * 180);
		const controls = (
			<div>
				<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10, lineHeight: '17px' }}>取慢星两两黄经角距之和成「聚散」曲线：<b style={{ color: '#c0392b' }}>低谷</b>（行星聚集，→0）多应危机、战乱；<b style={{ color: '#27ae60' }}>高峰</b>（行星四散，→{Math.round(maxIndex)}°）多应扩张、繁荣。史上 1914、1939–45 两次大战即与深谷吻合。</div>
				<div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
					<XQSelect size="small" style={{ width: 196 }} value={this.state.bbSet} onChange={(v) => this.setState({ bbSet: v })}>
						{BARBAULT_SETS.map((s) => (<Option key={s.key} value={s.key}>{s.cn}</Option>))}
					</XQSelect>
					<InputNumber size="small" style={{ width: 78 }} value={this.state.bbStart} min={-2000} max={3000}
						onChange={(v) => this.setState({ bbStart: clampYear(v, 1900) })} />
					<span style={{ fontSize: 12, opacity: 0.6 }}>至</span>
					<InputNumber size="small" style={{ width: 78 }} value={this.state.bbEnd} min={-2000} max={3000}
						onChange={(v) => this.setState({ bbEnd: clampYear(v, 2050) })} />
					<XQButton size="small" disabled={this.state.bbLoading} onClick={this.computeBarbault}>{this.state.bbLoading ? '计算中…' : '绘制'}</XQButton>
				</div>
				{this.state.bbErr ? <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 8 }}>{this.state.bbErr}</div> : null}
			</div>
		);
		let body;
		if(!pts.length){
			body = <div style={{ fontSize: 12, opacity: 0.55, padding: '6px 0' }}>设定慢星组合与年段后点「绘制」，生成行星聚散指数曲线（跨度 ≤160 年逐季、更长逐年；上限 300 年）。</div>;
		}else{
			const W = 640, H = 226, padL = 46, padR = 14, padT = 14, padB = 28;
			const plotW = W - padL - padR, plotH = H - padT - padB;
			const tVal = (p) => p.year + (p.month - 1) / 12;
			const t0 = tVal(pts[0]), t1 = tVal(pts[pts.length - 1]);
			const xAt = (p) => padL + (t1 > t0 ? (tVal(p) - t0) / (t1 - t0) : 0) * plotW;
			const yAt = (v) => padT + (1 - v / maxIndex) * plotH;
			const line = pts.map((p) => `${xAt(p).toFixed(1)},${yAt(p.index).toFixed(1)}`).join(' ');
			const area = `${padL},${(padT + plotH).toFixed(1)} ${line} ${(padL + plotW).toFixed(1)},${(padT + plotH).toFixed(1)}`;
			let gmin = pts[0], gmax = pts[0];
			pts.forEach((p) => { if(p.index < gmin.index) gmin = p; if(p.index > gmax.index) gmax = p; });
			const span = t1 - t0;
			const stepY = span > 200 ? 50 : (span > 100 ? 25 : (span > 40 ? 20 : 10));
			const yearTicks = [];
			for(let yr = Math.ceil(t0 / stepY) * stepY; yr <= t1 + 0.001; yr += stepY){ yearTicks.push(yr); }
			const yTicks = [0, maxIndex / 2, maxIndex];
			const gridC = 'rgba(128,128,128,0.18)', axC = 'rgba(128,128,128,0.5)';
			const tickLabel = (p) => `${p.year}-${String(p.month).padStart(2, '0')}（${Math.round(p.index)}°）`;
			body = (
				<div>
					<div style={{ width: '100%', overflow: 'hidden' }}>
						<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
							<defs>
								<linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={ACC} stopOpacity="0.26" />
									<stop offset="100%" stopColor={ACC} stopOpacity="0.02" />
								</linearGradient>
							</defs>
							{yTicks.map((v, i) => (
								<g key={`y${i}`}>
									<line x1={padL} y1={yAt(v)} x2={padL + plotW} y2={yAt(v)} stroke={gridC} strokeWidth="1" strokeDasharray={i === 0 ? '' : '3 3'} />
									<text x={padL - 6} y={yAt(v) + 3.5} textAnchor="end" fontSize="10" fill={axC}>{Math.round(v)}</text>
								</g>
							))}
							{yearTicks.map((yr, i) => (
								<g key={`x${i}`}>
									<line x1={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y1={padT + plotH} x2={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y2={padT + plotH + 4} stroke={axC} strokeWidth="1" />
									<text x={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y={padT + plotH + 16} textAnchor="middle" fontSize="10" fill={axC}>{yr}</text>
								</g>
							))}
							<polygon points={area} fill="url(#bbFill)" stroke="none" />
							<polyline points={line} fill="none" stroke={ACC} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
							<circle cx={xAt(gmin)} cy={yAt(gmin.index)} r="3.6" fill="#c0392b" stroke="#fff" strokeWidth="1" />
							<circle cx={xAt(gmax)} cy={yAt(gmax.index)} r="3.6" fill="#27ae60" stroke="#fff" strokeWidth="1" />
						</svg>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 11.5 }}>
						<span><span style={{ color: '#c0392b', fontWeight: 700 }}>最深谷</span> {tickLabel(gmin)} · 聚集</span>
						<span><span style={{ color: '#27ae60', fontWeight: 700 }}>最高峰</span> {tickLabel(gmax)} · 四散</span>
					</div>
					<div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{set.cn.replace(/（[^）]*）/g, '')} · {pts.length} 点 · 满刻度 {Math.round(maxIndex)}°（swisseph 精算，地心黄经）。</div>
				</div>
			);
		}
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				{head}
				{controls}
				<Spin spinning={this.state.bbLoading}>{body}</Spin>
			</div>
		);
	}

	// 右栏分页:按盘型给不同 tab,避免卡片堆叠拥挤。
	mundaneRightTabList(type){
		if(type === 'cycles'){
			return [{ value: 'cycles', label: '木土纪元' }, { value: 'barbault', label: 'Barbault' }];
		}
		const tabs = [{ value: 'overview', label: '概览' }, { value: 'judge', label: '判读' }, { value: 'stars', label: '恒星' }];
		if(type === 'ingress' || type === 'region'){ tabs.push({ value: 'choro', label: '分野' }); }
		if(type === 'region'){ tabs.push({ value: 'prog', label: '推运' }); }
		return tabs;
	}

	// 单个 tab 的内容(按盘型 + tab key 组卡)。
	mundaneTabContent(key, chart, extra, type){
		if(type === 'cycles'){
			return (key === 'barbault') ? this.renderBarbault(extra) : this.renderGreatConj(false);
		}
		if(key === 'overview'){
			return (
				<Fragment>
					{type === 'ingress' ? this.renderYearChart(chart, extra) : null}
					{type === 'ingress' ? this.renderIngressSkeleton(chart) : null}
					{type === 'ingress' ? this.renderSeasonalCard(extra) : null}
					{(type === 'newmoon' || type === 'fullmoon') ? this.renderLunationCard(chart, extra, type) : null}
					{(type === 'solecl' || type === 'lunecl') ? this.renderEclipseCard(chart, extra, type) : null}
					{type === 'region' ? this.renderRegionCard(chart, extra) : null}
					{type === 'region' ? this.renderRectificationCard(chart) : null}
					{(type === 'ingress' || type === 'newmoon' || type === 'fullmoon') ? this.renderWeatherCard(chart, extra) : null}
				</Fragment>
			);
		}
		if(key === 'judge'){ return (<Fragment>{this.renderConjunctionIndicator(chart)}{this.renderVictorCard(chart, extra)}{this.renderDistributionCard(chart, extra)}{this.renderJudgmentCards(chart)}</Fragment>); }
		if(key === 'choro'){ return this.renderChorographyCard(chart, extra); }
		if(key === 'prog'){ return (<Fragment>{this.renderProgressionCard(chart, extra)}{this.renderPrimaryDirectionNote()}</Fragment>); }
		return this.renderFixedStarCard(chart, extra); // stars
	}

	renderRight({ chart, extra }){
		const type = extra.mundaneType || 'ingress';
		const tabs = this.mundaneRightTabList(type);
		let active = this.state.mundaneRightTab || tabs[0].value;
		if(!tabs.some((t) => t.value === active)){ active = tabs[0].value; }
		return (
			<XQTabs activeKey={active} className="horosa-inspector-tabs horosa-content-tabs"
				onChange={(k) => this.setState({ mundaneRightTab: k })}>
				{tabs.map((t) => {
					const content = this.mundaneTabContent(t.value, chart, extra, type);
					return (
						<TabPane tab={t.label} key={t.value}>
							<div style={{ fontSize: 13 }}>{content || <div style={{ fontSize: 12, opacity: 0.5, padding: '8px 2px' }}>暂无内容,请先排盘。</div>}</div>
						</TabPane>
					);
				})}
			</XQTabs>
		);
	}

	buildAiSnapshot(chart, fields, extra){
		const ex = extra || {};
		const type = ex.mundaneType || 'ingress';
		const TITLE = { ingress: '世俗入宫', newmoon: '新月图', fullmoon: '满月图', solecl: '日食图', lunecl: '月食图', region: '地区盘', cycles: '行星周期' };
		const headLines = [`[${TITLE[type] || '世俗入宫'}]`, `规则集：${rulesetConfig(ex.mundaneRuleset).label}`];
		if(type === 'ingress'){ headLines.push(`入宫节气：${ex.ingressTerm || '-'}`, `年份：${ex.ingressYear || '-'}`); }
		else if(type === 'newmoon' || type === 'fullmoon'){ headLines.push(`时刻：${ex.selectedMoment || '-'}`); }
		else if(type === 'solecl' || type === 'lunecl'){ headLines.push(`时刻：${ex.selectedMoment || '-'}`, `类型：${ex.eclipseTypeText || '-'}`); }
		else if(type === 'region'){ headLines.push(`地区：${ex.regionCn || '-'}`); }
		// 世俗宫义判词段 + 定局/分野/骨架/推运 分析段(全部从 facts 派生,供 AI 报告)
		let judge = '';
		const extraSecs = [];
		try{
			const facts = buildFacts(chart);
			const rows = describeMundaneChart(facts);
			if(rows && rows.length){ judge = '[世俗宫义]\n' + formatMundaneHouseTable(rows); }
			const v = describeMundaneVictor(facts, ex.mundaneRuleset);
			if(v){ extraSecs.push(`[定局·年主/盘主]\n年主星：${v.victorCn}（累分 ${v.maxScore}）${v.victorMundane ? ' · ' + v.victorMundane.powerRole : ''}；取点 ${v.points.join(' / ')}`); }
			if(type === 'ingress'){
				const sk = describeIngressSkeleton(facts);
				if(sk){ extraSecs.push(`[入境骨架]\n上升 ${sk.ascSignCn} · 主星 ${sk.ascRulerCn} 落 ${sk.ascRulerHouse} 宫${sk.ascRulerAngular ? '(临轴)' : ''}；政权 10宫主 ${sk.tenthRulerCn} · 太阳 ${sk.sun ? sk.sun.house : '-'} 宫；民生 月亮 ${sk.moon ? sk.moon.house : '-'} 宫`); }
			}
			if(type === 'ingress' || type === 'region'){
				const ch = describeChorography(facts, rulesetConfig(ex.mundaneRuleset).chorographyDataset);
				if(ch && ch.axes.length){ extraSecs.push('[地理分野]\n数据集：' + ch.datasetMeta.label + '\n' + formatMundaneChorographyTable(ch.axes) + '\n（多源综合·传统占星学术参考,非现实地缘断言）'); }
			}
			if(type === 'region'){
				const founding = (this.state.progFoundingYear != null) ? this.state.progFoundingYear : (ex.regionFoundingYear || null);
				const target = (this.state.progTargetYear != null) ? this.state.progTargetYear : currentYear();
				if(founding != null && facts.meta && facts.meta.ascSign){
					const age = Math.max(0, target - founding);
					const prof = mundaneProfection(facts.meta.ascSign, age);
					const fird = mundaneFirdaria(facts.meta.sect, age);
					const lines = ['[地区盘推运]', `盘龄 ${age} 年（建置 ${founding} → 目标 ${target}）`];
					if(prof){ lines.push(`小限：年小限 ${prof.profectedSignCn} · 激活第 ${prof.activatedHouse} 宫(${prof.houseTheme}) · 年主 ${prof.lordCn}`); }
					if(fird){ lines.push(`法达(${fird.sectCn})：大期 ${fird.major.planetCn}${fird.sub ? ' · 子期 ' + fird.sub.planetCn : ''}`); }
					extraSecs.push(lines.join('\n'));
				}
			}
		}catch(e){ /* noop */ }
		const head = headLines.join('\n');
		const body = buildAstroSnapshotContent(chart, fields) || '';
		return [head, judge, ...extraSecs, body].filter(Boolean).join('\n\n');
	}

	render(){
		return (
			<DivinationChartShell
				title="世俗盘"
				kicker="世俗设置"
				pageClass="horosa-mundane-page"
				castNowLabel="此刻起盘"
				defaults={{ tradition: 1, zodiacal: 0, hsys: 0 }}
				initialExtra={{ mundaneRuleset: 'modern', mundaneType: 'ingress', ingressTerm: '春分', ingressYear: currentYear(), scanYear: currentYear() }}
				fields={this.props.fields}
				height={this.props.height}
				chartDisplay={this.props.chartDisplay}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
				dispatch={this.props.dispatch}
				saveModule="mundane"
				buildAiSnapshot={(chart, fields, extra) => this.buildAiSnapshot(chart, fields, extra)}
				renderLeftExtra={(args) => this.renderLeftExtra(args)}
				renderRight={(args) => this.renderRight(args)}
			/>
		);
	}
}

export default MundaneMain;
