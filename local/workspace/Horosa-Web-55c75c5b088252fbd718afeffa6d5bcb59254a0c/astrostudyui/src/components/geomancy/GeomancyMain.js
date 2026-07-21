import QuickDockBar from '../common/QuickDockBar';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Component } from 'react';
import { Input, InputNumber, Spin, message } from 'antd';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { AstroFont } from '../../constants/AstroConst';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { getSignSymbol } from '../astro/IndiaSouthChart';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { subscribeRemoteNongli, paramsFromFields, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields } from '../../utils/divinationTimeDraft';
import './GeomancyMain.less';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// 英文星座名 → 1-12,取我方 ywastro 星座符(与印度盘同一套 glyph,设计语言统一)。
const SIGN_EN_TO_NUM = {
	Aries: 1, Taurus: 2, Gemini: 3, Cancer: 4, Leo: 5, Virgo: 6,
	Libra: 7, Scorpio: 8, Sagittarius: 9, Capricorn: 10, Aquarius: 11, Pisces: 12,
};
function signGlyph(signEn){
	const num = SIGN_EN_TO_NUM[signEn];
	return num ? getSignSymbol(num) : '';
}
// 行星 → 我方 ywastro 字形(与主星盘同套:A日 B月 C水 D金 E火 F木 G土 K北交 L南交)。
const PLANET_GLYPH_BY_ZH = {
	'太阳': 'A', '月亮': 'B', '水星': 'C', '金星': 'D', '火星': 'E', '木星': 'F', '土星': 'G',
	'天王星': 'H', '海王星': 'I', '冥王星': 'J',
	'龙头': 'K', '北交': 'K', '北交点': 'K', '罗睺': 'K',
	'龙尾': 'L', '南交': 'L', '南交点': 'L', '计都': 'L',
};
function planetGlyph(planetZh){
	return PLANET_GLYPH_BY_ZH[planetZh] || '';
}
// 十六图形格位标签(row-major:四母→四女→四甥→左右见证+判官+调和者),与引擎 figures_16 同序。
const FIGURE_SLOTS = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右见证', '左见证', '判官', '调和者'];
const FIGURE_GROUPS = [
	{ label: '四母', span: [0, 4] },
	{ label: '四女', span: [4, 8] },
	{ label: '四甥', span: [8, 12] },
	{ label: '见证·判官', span: [12, 16] },
];

const HISTORY_KEY = 'horosaGeomancyHistory';
const HISTORY_MAX = 30;

// 问题类型(11 类;简体)。后端 reading 也回传 questionTypes 可同步覆盖。
const QUESTION_TYPE_OPTIONS = [
	{ key: 'life', label: '🌟 生命与命运' },
	{ key: 'health', label: '⚕️ 健康与疾病' },
	{ key: 'wealth', label: '💰 财富与资源' },
	{ key: 'marriage', label: '💑 婚姻与感情' },
	{ key: 'career', label: '🏆 事业与名誉' },
	{ key: 'children', label: '👶 子女与生育' },
	{ key: 'journey', label: '✈️ 旅行与迁移' },
	{ key: 'religion', label: '🕌 宗教与灵性' },
	{ key: 'enemy', label: '⚔️ 敌人与诉讼' },
	{ key: 'death', label: '⚰️ 死亡与遗产' },
	{ key: 'custom', label: '💬 自订问题' },
];

const SEED_MODE_OPTIONS = [
	{ key: 'random', label: '随机起卦' },
	{ key: 'time_seed', label: '时间起卦' },
	{ key: 'manual', label: '手工指定种子' },
];

// 时间起卦确定性种子:取起卦时间(精确到分)的年月日时分拼成一个稳定 int(0..2147483647)。
// 同一分钟内重复起卦 → 同种子 → 同盘(可复现);不同时刻 → 不同种子。
// 喂给后端 timeSeed,后端按其取值优先级落定 effective_seed 并回传,避免退化真随机。
// [自由起盘] 传入左栏所选时间的 fields(date/time)则按其算种子;缺省回退当前系统时间。
function computeTimeSeed(fields){
	let y; let mo; let da; let h; let mi;
	const dv = fields && fields.date && fields.date.value;
	const tv = fields && fields.time && fields.time.value;
	if(dv && dv.format && tv && tv.format){
		y = parseInt(dv.format('YYYY'), 10);
		mo = parseInt(dv.format('MM'), 10);
		da = parseInt(dv.format('DD'), 10);
		h = parseInt(tv.format('HH'), 10);
		mi = parseInt(tv.format('mm'), 10);
	}else{
		const d = new Date();
		y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate(); h = d.getHours(); mi = d.getMinutes();
	}
	// (YYMMDDHHmm) 折叠进 32 位有符号正整数域;乘子混合各分量避免低位塌缩。
	const v = ((y % 100) * 100000000) + (mo * 1000000) + (da * 10000) + (h * 100) + mi;
	return v % 2147483647;
}

// 流派预设(中性命名;后端 reading 也回传 traditions 可同步覆盖)。默认古典定局派=现状零回归。
const TRADITION_OPTIONS = [
	{ key: 'european_classical', label: '古典定局派' },
	{ key: 'european_planetary', label: '行星共鸣派' },
	// [X1·P1-21] 现代综合派引擎口径与古典定局同(traditions 仅 id/label 异);label 如实标注,不臆造分歧。
	{ key: 'european_modern', label: '现代综合派(判读同古典口径)' },
	{ key: 'arabic_raml', label: '阿拉伯沙占派' },
	{ key: 'india_ramal', label: '印度骰占派' },
	{ key: 'sikidy', label: '异或表盘(Sikidy)' },
	{ key: 'hakata', label: '四片盘(Hakata)' },
];
const READING_SCOPE_OPTIONS = [
	{ key: 'L0', label: 'L0 仅判官' },
	{ key: 'L1', label: 'L1 三图(证·判)' },
	{ key: 'L2', label: 'L2 盾牌全局' },
	{ key: 'L3', label: 'L3 十二宫(默认)' },
	{ key: 'L4', label: 'L4 占星定局' },
];
const ZODIAC_SYSTEM_OPTIONS = [
	{ key: 'classical', label: '古典定局体系' },
	{ key: 'planetary', label: '行星归属体系' },
];

async function postGeomancy(path, payload){
	let rsp = null;
	try{
		const rawResponse = await fetch(buildKentangEndpoint('geomancy', path), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		});
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'geomancy.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await fetch(`${ServerRoot}/geomancy/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		});
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'geomancy.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

function figureLine(fig, role){
	if(!fig){ return ''; }
	const parts = [fig.nameZh || fig.nameEn].filter(Boolean);
	if(fig.planetZh){ parts.push(`行星${fig.planetZh}`); }
	if(fig.elementZh){ parts.push(fig.elementZh); }
	if(fig.keywordsZh){ parts.push(fig.keywordsZh); }
	return `${role}：${parts.join(' · ')}`;
}

// 地占快照文本:问题/类型/上升 + 传本 + 判定(判官/调和者/见证) + 解读技法 + 十二宫图形入宫断语 + 十六图形。
export function buildGeomancySnapshotText(result){
	if(!result){ return '暂无地占数据'; }
	const reading = result.reading || {};
	const lines = [];
	if(result.aiPrompt){
		lines.push(result.aiPrompt.trim());
		lines.push('');
	}else{
		lines.push(`问题：${reading.question || '—'}`);
		lines.push(`问类：${reading.questionTypeZh || reading.questionType || '—'}`);
		lines.push(`上升图形：${(reading.ascendantFigure || {}).nameZh || ''}（上升星座 ${reading.ascendantSignZh || ''}）`);
		lines.push('');
	}
	// 传本(非默认才注记,供 AI 知本盘传本口径)
	const TRAD = { european_classical: '古典定局派', european_planetary: '行星共鸣派', european_modern: '现代综合派(同古典口径)', arabic_raml: '阿拉伯沙占派', india_ramal: '印度骰占派', sikidy: '异或表盘', hakata: '四片盘' };
	const tb = [];
	if(reading.profileId && reading.profileId !== 'european_classical'){ tb.push(`流派=${TRAD[reading.profileId] || reading.profileId}`); }
	if(reading.zodiacSystem === 'planetary'){ tb.push('黄道=行星归属体系'); }
	if(reading.readingScope && reading.readingScope !== 'L3'){ tb.push(`范围=${reading.readingScope}`); }
	if(tb.length){ lines.push(`传本设置：${tb.join('、')}`); }
	lines.push('[判定]');
	// [X1·P1-22] 首母中止警示(约 1/8 盘触发,后端早已算出而前端/AI 双盲):传统口径此占应中止另占。
	if(reading.haltedOnFirstMother){ lines.push('⚠ 首母中止：首母落 Rubeus/Cauda 之属,依所选传本传统应中止本占、另择时再占(以下判读仅作参考)。'); }
	const j = figureLine(reading.judge, '判官');
	if(j){ lines.push(j); }
	const r = figureLine(reading.reconciler, '调和者');
	if(r){ lines.push(r); }
	if(reading.rightWitness){ lines.push(figureLine(reading.rightWitness, '右证(过去/问者)')); }
	if(reading.leftWitness){ lines.push(figureLine(reading.leftWitness, '左证(现在/所问)')); }
	if(reading.primaryHouse){ lines.push(`主宫：第 ${reading.primaryHouse} 宫`); }
	// [X1·P1-23] sikidy/hakata 流派中栏特有结论入快照(此前 AI 全盲):三道校验/红 Sikidy/诸侯列;四片开合/断语。
	if(reading.sikidy){
		const sk = reading.sikidy;
		lines.push(`异或表盘：三道校验${sk.valid ? '通过' : '未过'}${sk.red_sikidy ? '；红 Sikidy(大凶)' : ''}${Array.isArray(sk.princes) && sk.princes.length ? `；诸侯列:${sk.princes.join('、')}` : ''}`);
	}
	if(reading.hakata){
		const hk = reading.hakata;
		const tb = (hk.tablets || []).map((t)=>`${t.name || ''}${t.open ? '开' : '合'}`).join(' ');
		lines.push(`四片盘：${tb || '—'} → ${hk.figure_zh || hk.figure || '—'}${hk.reading ? `；${hk.reading}` : ''}${hk.orientation ? `；${hk.orientation}` : ''}`);
	}
	// 解读技法(可计算)
	const t = reading.technique;
	if(t){
		lines.push('');
		lines.push('[解读技法]');
		const PERF = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		lines.push(`完美：${t.perfection && t.perfection !== 'none' ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : '未成局')}`);
		lines.push(`相位：${ASP[t.aspect] || t.aspect}`);
		if(t.prohibition){ lines.push(`阻碍：第 ${t.prohibition} 宫强凶图阻断`); }
		if(t.points_parity){ lines.push(`点数是否：总 ${t.points_parity.total} 点·${t.points_parity.parity === 'even' ? '偶→是/稳' : '奇→否/动'}`); }
		if(t.timing){ lines.push(`应期：${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计`); }
		if(t.via_puncti){ lines.push(`点之路：${t.via_puncti.through ? '贯通' : '断于' + t.via_puncti.broken_at}`); }
		if(t.natural_cosignificator){ lines.push('自然共主：月亮'); }
	}
	// 十二宫:图形入宫 + 192 断语
	const houses = reading.houses || [];
	if(houses.length){
		lines.push('');
		lines.push('[十二宫·图形入宫]');
		lines.push('| 宫 | 宫名 | 角色 | 图形 | 断语 |');
		lines.push('| --- | --- | --- | --- | --- |');
		houses.forEach((h)=>{
			const fig = h.figure || {};
			const role = (h.roles || []).indexOf('quesited') >= 0 ? '【所问】' : ((h.roles || []).indexOf('querent') >= 0 ? '【问者】' : '');
			lines.push(`| 第${h.house}宫 | ${h.nameZh || '—'} | ${role || '—'} | ${fig.nameZh || fig.nameEn || '—'} | ${h.reading || '—'} |`);
		});
	}
	const figs = reading.figures16 || [];
	if(figs.length){
		lines.push('');
		lines.push('[十六图形]');
		const slot = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右证', '左证', '判官', '调和'];
		lines.push('| 位 | 图形 | 行星 | 元素 |');
		lines.push('| --- | --- | --- | --- |');
		figs.forEach((f, i)=>{
			lines.push(`| ${slot[i] || `图${i + 1}`} | ${f.nameZh || f.nameEn} | ${f.planetZh || '—'} | ${f.elementZh || '—'} |`);
		});
	}
	// [图形释义] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「十六图形」renderFigureCatalog 同源
	// result.figures(16 图形完整象意库,含逐域断语 meanings);象意原文零改写;无目录数据不产段。
	const catalog = Array.isArray(result.figures) ? result.figures : [];
	if(catalog.length){
		lines.push('');
		lines.push('[图形释义]');
		const TONE_ZH = { good: '吉', bad: '凶', neutral: '中' };
		catalog.forEach((f)=>{
			const tone = TONE_ZH[f.tone] || '';
			lines.push(`◆ ${f.nameZh || f.latin || f.nameEn}${tone ? `（${tone}）` : ''}${f.nameEn ? ` ${f.nameEn}` : ''}${f.points ? ` · ${f.points}点` : ''}`);
			const attrLine = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
			if(attrLine){ lines.push(attrLine); }
			const bodyLine = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
			if(bodyLine){ lines.push(bodyLine); }
			if(f.keywordsZh){ lines.push(`象意：${f.keywordsZh}`); }
			if(f.meanings){
				const domainText = Object.keys(f.meanings)
					.filter((k)=>k !== 'name_zh' && k !== 'tone')
					.map((k)=>`${k}：${f.meanings[k]}`)
					.join('；');
				if(domainText){ lines.push(domainText); }
			}
			const altLine = [f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : ''].filter(Boolean).join('　');
			if(altLine){ lines.push(altLine); }
		});
	}
	return lines.join('\n').trim();
}

// AI 挂载:地占为 case 型(无生时),按已保存 case 的问题/种子复算,得不到则空。
export async function buildGeomancySnapshotForFields(fields, opts){
	try{
		const o = opts || {};
		let question = o.question;
		let questionType = o.questionType;
		let seedMode = o.seedMode;
		let seed = o.seed;
		let tradition = o.tradition;
		let readingScope = o.readingScope;
		let zodiacSystem = o.zodiacSystem;
		if(question === undefined || question === null){
			const saved = getKentangSavedCasePayload('geomancy');
			const so = saved && saved.payload && saved.payload.options ? saved.payload.options : null;
			if(so){
				question = so.question; questionType = so.questionType;
				seedMode = so.seedMode; seed = so.seed;
				tradition = so.tradition; readingScope = so.readingScope; zodiacSystem = so.zodiacSystem;
			}
		}
		if(question === undefined || question === null){ return ''; }
		const payload = {
			question: question || '',
			questionType: questionType || 'custom',
			seedMode: (seedMode === 'manual' && (seed || seed === 0)) ? 'manual' : (seedMode || 'random'),
			tradition: tradition || 'european_classical',
			readingScope: readingScope || 'L3',
			zodiacSystem: zodiacSystem || 'classical',
		};
		if(payload.seedMode === 'manual'){ payload.seed = seed || 0; }
		const result = await postGeomancy('reading', payload);
		return buildGeomancySnapshotText(result);
	}catch(e){ return ''; }
}

class GeomancyMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			loading: false,
			result: null,
			question: '',
			questionType: 'custom',
			seedMode: 'random',
			manualSeed: 0,
			tradition: 'european_classical',   // 流派预设(默认古典定局派=现状零回归)
			readingScope: 'L3',
			zodiacSystem: 'classical',
			rightPanelTab: 'reading',
			centerView: 'square',
			history: [],
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选时间/经纬:时间起卦按此算种子,
			// 经纬/时间随事盘存储 + 透传后端占星盘)。
			localFields: null,
		};
		this.unmounted = false;
		this.requestSeq = 0;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickCast = this.clickCast.bind(this);
		this.clickReproduce = this.clickReproduce.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.setCenterView = this.setCenterView.bind(this);
		this.changeGeomancyOpt = this.changeGeomancyOpt.bind(this);
		this.traditionOptions = this.traditionOptions.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.applyHistory = this.applyHistory.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){ return; }
				this.restoreFromCurrentCase();
			};
		}
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.loadHistory();
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		this.restoreFromCurrentCase();
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	loadHistory(){
		try{
			const raw = window.localStorage.getItem(HISTORY_KEY);
			const arr = raw ? JSON.parse(raw) : [];
			this.setState({ history: Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [] });
		}catch(e){ /* ignore */ }
	}

	pushHistory(result){
		const reading = (result && result.reading) || {};
		const entry = {
			question: reading.question || '',
			questionType: reading.questionType || 'custom',
			questionTypeZh: reading.questionTypeZh || '',
			judge: (reading.judge || {}).nameZh || (reading.judge || {}).nameEn || '',
			ascendant: (reading.ascendantFigure || {}).nameZh || '',
			seed: reading.seed,
			tradition: this.state.tradition, readingScope: this.state.readingScope, zodiacSystem: this.state.zodiacSystem,
			ts: Date.now(),
		};
		let next = [entry];
		try{
			const raw = window.localStorage.getItem(HISTORY_KEY);
			const prev = raw ? JSON.parse(raw) : [];
			if(Array.isArray(prev)){ next = [entry, ...prev]; }
		}catch(e){ /* ignore */ }
		next = next.slice(0, HISTORY_MAX);
		try{ safeLocalStorageSet(HISTORY_KEY, JSON.stringify(next)); }catch(e){ /* ignore */ }
		this.setState({ history: next });
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'geomancy'){ return; }
		const result = this.state ? this.state.result : null;
		if(!result){ return; }
		let text = '';
		try{ text = `${buildGeomancySnapshotText(result) || ''}`.trim(); }catch(e){ text = ''; }
		if(text){
			saveModuleAISnapshot('geomancy', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('geomancy');
		if(!saved || !saved.payload){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return false; }
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this.setState({
			loading: false,
			result: payload.result || null,
			question: options.question !== undefined ? options.question : this.state.question,
			questionType: options.questionType || this.state.questionType,
			seedMode: options.seedMode || this.state.seedMode,
			manualSeed: options.seed !== undefined ? options.seed : this.state.manualSeed,
			tradition: options.tradition || this.state.tradition,
			readingScope: options.readingScope || this.state.readingScope,
			zodiacSystem: options.zodiacSystem || this.state.zodiacSystem,
		}, ()=>{
			const result = this.state.result;
			// [X1·P2-40] 快照带时地 meta:命盘挂载缓存路径可确凿命中,免每次挂载都复算。
			if(result){ saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
		});
		return true;
	}

	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch)。时间起卦即用此时刻算种子;占星盘用此时刻。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名);占星盘用此地点。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } });
	}
	async clickCast(pinnedSeed){
		const seq = ++this.requestSeq;
		const seedMode = this.state.seedMode;
		// pinnedSeed(有限数)= 用既有母图种子定盘重算:同护盾盘、赋义随流派/范围/黄道变,不重新揲卦。
		// (onClick 透传的是 event 对象,Number.isFinite 自然过滤掉,不会误当种子。)
		const pinned = Number.isFinite(pinnedSeed) ? Math.floor(pinnedSeed) : null;
		const af = this.activeFields();
		const payload = {
			question: this.state.question || '',
			questionType: this.state.questionType || 'custom',
			seedMode: pinned !== null ? 'manual' : seedMode,
			tradition: this.state.tradition || 'european_classical',
			readingScope: this.state.readingScope || 'L3',
			zodiacSystem: this.state.zodiacSystem || 'classical',
		};
		// [自由起盘] 透传所选时间地理:占星定局(L4)/十二宫(L3)的星盘按此时刻地点起(后端不识则忽略,无害)。
		const gp = paramsFromFields(af);
		if(gp){
			payload.date = gp.date; payload.time = gp.time; payload.zone = gp.zone;
			payload.lon = gp.lon; payload.lat = gp.lat;
		}
		if(pinned !== null){ payload.seed = pinned; }
		else if(seedMode === 'manual'){ payload.seed = this.state.manualSeed || 0; }
		// 时间起卦:由左栏所选时间(精确到分)算确定性种子塞 timeSeed,使同一时刻起卦可复现;
		// 不塞则后端走 secrets.randbelow 退化真随机,刷新即变盘(后端 webgeomancysrv.py 已就绪接收 timeSeed)。
		else if(seedMode === 'time_seed'){ payload.timeSeed = computeTimeSeed(af); }
		this.setState({ loading: true });
		try{
			const result = await postGeomancy('reading', payload);
			if(this.unmounted || seq !== this.requestSeq){ return; }
			this.setState({ loading: false, result }, ()=>{
				saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() }));
				this.pushHistory(result);
			});
		}catch(e){
			if(this.unmounted || seq !== this.requestSeq){ return; }
			this.setState({ loading: false });
			message.error('地占起盘失败，请稍后重试');
		}
	}

	clickReproduce(){
		// 把当前盘的种子锁定为手工种子,便于复现。
		const reading = this.state.result && this.state.result.reading;
		if(!reading || (reading.seed === undefined || reading.seed === null)){ return; }
		this.setState({ seedMode: 'manual', manualSeed: reading.seed });
		message.success(`已锁定种子 ${reading.seed}，再次起盘可复现此盘`);
	}

	clickSaveCase(){
		if(!this.state.result){
			message.info('请先起盘');
			return;
		}
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'geomancy',
			label: '天文地占',
			payload: {
				options: {
					question: this.state.question,
					questionType: this.state.questionType,
					seedMode: this.state.result.reading ? 'manual' : this.state.seedMode,
					seed: this.state.result.reading ? this.state.result.reading.seed : this.state.manualSeed,
					tradition: this.state.tradition,
					readingScope: this.state.readingScope,
					zodiacSystem: this.state.zodiacSystem,
				},
				result: this.state.result,
				snapshot: buildGeomancySnapshotText(this.state.result),
			},
		});
	}

	applyHistory(entry){
		if(!entry){ return; }
		this.setState({
			question: entry.question || '',
			questionType: entry.questionType || 'custom',
			seedMode: 'manual',
			manualSeed: entry.seed !== undefined ? entry.seed : 0,
			tradition: entry.tradition || this.state.tradition,
			readingScope: entry.readingScope || this.state.readingScope,
			zodiacSystem: entry.zodiacSystem || this.state.zodiacSystem,
		}, ()=>{ this.clickCast(); });
	}

	setRightPanelTab(key){ this.setState({ rightPanelTab: key }); }
	setCenterView(v){ this.setState({ centerView: v }); }

	// 流派/传本设置变更:写 state,已有盘则重算(左选→中右随动)。
	// 关键:用既有盘的实际种子定盘重算 → 同一母图(护盾盘不变),仅赋义随流派/范围/黄道变;
	// 否则随机/时间起卦下会重新揲卦得另一副盘,用户切流派对比时整盘跳变(原 bug)。
	changeGeomancyOpt(key, value){
		this.setState({ [key]: value }, ()=>{
			const reading = this.state.result && this.state.result.reading;
			if(!reading){ return; }
			const seed = reading.seed;
			if(seed === undefined || seed === null || !Number.isFinite(Number(seed))){ this.clickCast(); return; }
			this.clickCast(Number(seed));
		});
	}

	// 流派选项:优先后端回传 traditions(随内核),缺则静态。
	traditionOptions(){
		const t = this.state.result && this.state.result.traditions;
		if(Array.isArray(t) && t.length){ return t.map((x)=>({ key: x.id, label: x.label })); }
		return TRADITION_OPTIONS;
	}

	renderInputPanel(){
		const r = this.state.result && this.state.result.reading;
		return (
			<div className="horosa-huangji-input-stack horosa-geomancy-input-stack">
				<div>
					<div className="horosa-side-panel-title">天文地占</div>
					<div className="horosa-side-panel-subtitle">护盾盘 · 16 图形 · 判官</div>
				</div>
				{/* [自由起盘] 时间与地点:独立草稿。「时间起卦」按此时刻算种子;占星定局按此时刻地点起星盘(不写主命盘) */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={this.activeFields()}
						value={buildDateTimeFromFields(this.activeFields())}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				{/* [左栏统一] 三节收编 XQSideSection(原图标语义保留,卡片类透传) */}
				<XQSideSection iconName="note" title="问题" storageKey="geomancy.question" className="horosa-huangji-input-section">
					<TextArea
						value={this.state.question}
						onChange={(e)=>this.setState({ question: e.target.value })}
						placeholder="输入所问之事（可留空）"
						autoSize={{ minRows: 2, maxRows: 4 }}
						maxLength={200}
					/>
				</XQSideSection>
				<XQSideSection iconName="target" title="起卦选项" storageKey="geomancy.cast" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>问类</span>
							<Select value={this.state.questionType} onChange={(value)=>this.setState({ questionType: value })} dropdownMatchSelectWidth={false}>
								{QUESTION_TYPE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>起卦法</span>
							<Select value={this.state.seedMode} onChange={(value)=>this.setState({ seedMode: value })} dropdownMatchSelectWidth={false}>
								{SEED_MODE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key}>{o.label}</Option>))}
							</Select>
						</label>
						{this.state.seedMode === 'manual' ? (
							<label className="horosa-huangji-select-field is-wide">
								<span>手工种子</span>
								<InputNumber style={{ width: '100%' }} value={this.state.manualSeed} min={0} max={2147483647} onChange={(v)=>this.setState({ manualSeed: v || 0 })} />
							</label>
						) : null}
					</div>
				</XQSideSection>
				<XQSideSection iconName="target" title="流派 · 传本设置" storageKey="geomancy.school" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>流派预设</span>
							<Select value={this.state.tradition} onChange={(value)=>this.changeGeomancyOpt('tradition', value)} dropdownMatchSelectWidth={false}>
								{(this.traditionOptions()).map((o)=>(<Option value={o.key} key={o.key}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>读取范围</span>
							<Select value={this.state.readingScope} onChange={(value)=>this.changeGeomancyOpt('readingScope', value)} dropdownMatchSelectWidth={false}>
								{READING_SCOPE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>黄道体系</span>
							<Select value={this.state.zodiacSystem} onChange={(value)=>this.changeGeomancyOpt('zodiacSystem', value)} dropdownMatchSelectWidth={false}>
								{ZODIAC_SYSTEM_OPTIONS.map((o)=>(<Option value={o.key} key={o.key}>{o.label}</Option>))}
							</Select>
						</label>
					</div>
				</XQSideSection>
				{r ? (
					<div className="horosa-geomancy-seed-row">
						<span>本盘种子：<strong>{r.seed}</strong></span>
						<Button size="small" onClick={this.clickReproduce}>锁定复现</Button>
					</div>
				) : null}
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickCast}>起盘</Button>
				</div>
			</div>
		);
	}

	renderDots(dots){
		// 一个地占图形 = 4 行,每行单点(true)或双点(false)。
		const rows = Array.isArray(dots) && dots.length === 4 ? dots : [true, true, true, true];
		return (
			<div className="horosa-geomancy-fig-dots">
				{rows.map((single, i)=>(
					<div className="horosa-geomancy-fig-dotrow" key={i}>
						{single ? <span className="horosa-geomancy-fig-dot" /> : (<><span className="horosa-geomancy-fig-dot" /><span className="horosa-geomancy-fig-dot" /></>)}
					</div>
				))}
			</div>
		);
	}

	renderShield(reading){
		const figs = (reading && reading.figures16) || [];
		return (
			<div className="horosa-geomancy-shield">
				<div className="horosa-geomancy-shield-title">护盾方盘 · 十六图形</div>
				<div className="horosa-geomancy-shield-grid">
					{Array.from({ length: 16 }).map((_, i)=>{
						const f = figs[i] || {};
						const tone = (f.tone || '').toLowerCase();
						const qcls = tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '');
						return (
							<div className={`horosa-geomancy-shield-cell${qcls}`} key={i}>
								<span className="horosa-geomancy-shield-slot">{FIGURE_SLOTS[i]}</span>
								{this.renderDots(f.dots)}
								<div className="horosa-geomancy-shield-name">
									<strong>{f.nameZh || f.nameEn || '—'}</strong>
									<em>{f.nameEn || ''}</em>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	renderWheel(reading){
		const houses = (reading && reading.houses) || [];
		const SIZE = 600, C = SIZE / 2;
		// 三环:外环=黄道带(星座符),中环=宫位(宫号+行星),内圆=中心标签。
		const rOuter = 288, rZodiac = 234, rSign = 261, rNum = 214, rPlanetBand = 156, rInner = 96;
		const D2R = Math.PI / 180;
		// 宫1 在左(9 点钟,180°),逆时针递增——标准占星盘向。
		const houseCenterDeg = (houseIdx)=>180 + (houseIdx - 0.5) * 30;
		const polar = (r, deg)=>[C + r * Math.cos(deg * D2R), C - r * Math.sin(deg * D2R)];
		// 外环+宫环分隔线
		const outerSpokes = [];
		const houseSpokes = [];
		for(let i = 0; i < 12; i++){
			const deg = 180 + i * 30;
			const [ox1, oy1] = polar(rZodiac, deg);
			const [ox2, oy2] = polar(rOuter, deg);
			outerSpokes.push(<line key={`os${i}`} x1={ox1} y1={oy1} x2={ox2} y2={oy2} className="horosa-geomancy-wheel-spoke" />);
			const [hx1, hy1] = polar(rInner, deg);
			const [hx2, hy2] = polar(rZodiac, deg);
			houseSpokes.push(<line key={`hs${i}`} x1={hx1} y1={hy1} x2={hx2} y2={hy2} className="horosa-geomancy-wheel-spoke" />);
		}
		return (
			<div className="horosa-geomancy-wheel">
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="horosa-geomancy-wheel-svg" xmlns="http://www.w3.org/2000/svg">
					<circle cx={C} cy={C} r={rOuter} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rZodiac} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rInner} className="horosa-geomancy-wheel-ring is-gold" />
					{outerSpokes}
					{houseSpokes}
					{houses.map((h, i)=>{
						const deg = houseCenterDeg(i + 1);
						const [sx, sy] = polar(rSign, deg);
						const [nx, ny] = polar(rNum, deg);
						return (
							<g key={`h${i}`}>
								<text x={sx} y={sy} className="horosa-geomancy-wheel-sign" style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{signGlyph(h.sign)}</text>
								<text x={nx} y={ny} className="horosa-geomancy-wheel-num" textAnchor="middle" dominantBaseline="central">{h.house}</text>
							</g>
						);
					})}
					{houses.map((h, i)=>{
						// 图形入宫:每宫之图(名)落在宫位中环带(rPlanetBand);指示星宫(问者/所问)描金。
						const fig = h.figure || {};
						const nm = (fig.nameZh || fig.nameEn || '').slice(0, 2);
						if(!nm){ return null; }
						const [px, py] = polar(rPlanetBand, houseCenterDeg(i + 1));
						const sig = (h.roles || []).length > 0;
						return (
							<text key={`f${i}`} x={px} y={py} className={`horosa-geomancy-wheel-figure${sig ? ' is-significator' : ''}`} textAnchor="middle" dominantBaseline="central">{nm}</text>
						);
					})}
					<text x={C} y={C - 9} className="horosa-geomancy-wheel-center-title" textAnchor="middle">地占占星</text>
					<text x={C} y={C + 14} className="horosa-geomancy-wheel-center-sub" textAnchor="middle">{(reading && reading.ascendantSignZh) || ''}</text>
				</svg>
			</div>
		);
	}

	renderCenter(){
		const result = this.state.result;
		if(!result){
			return <div className="horosa-geomancy-empty">输入所问之事后点「起盘」,生成地占护盾方盘与十二宫盘</div>;
		}
		const reading = result.reading || {};
		const hasSikidy = !!reading.sikidy;
		const hasHakata = !!reading.hakata;
		// 当前视图若不可用(如切回非 sikidy 流派)→ 回落护盾方盘。
		let view = this.state.centerView;
		if(view === 'sikidy' && !hasSikidy){ view = 'square'; }
		if(view === 'hakata' && !hasHakata){ view = 'square'; }
		const stage = view === 'wheel' ? this.renderWheel(reading)
			: view === 'sikidy' ? this.renderSikidy(reading)
				: view === 'hakata' ? this.renderHakata(reading)
					: this.renderShield(reading);
		return (
			<div className="horosa-geomancy-board">
				<div className="horosa-geomancy-board-switch">
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'square' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('square')}>护盾方盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'wheel' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('wheel')}>十二宫盘</button>
					{hasSikidy ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'sikidy' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('sikidy')}>异或表盘</button> : null}
					{hasHakata ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'hakata' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('hakata')}>四片盘</button> : null}
				</div>
				<div className="horosa-geomancy-board-stage">{stage}</div>
			</div>
		);
	}

	// Sikidy 异或表盘:16 列 × 4 行点阵 + 列名/指代义 + 三道校验状态 + 诸侯/奴隶配色。
	renderSikidy(reading){
		const sk = reading.sikidy || {};
		const cols = sk.columns || {};
		const princes = new Set(sk.princes || []);
		return (
			<div className="horosa-geomancy-sikidy">
				<div className="horosa-geomancy-sikidy-status">
					三道校验：<strong className={sk.valid ? 'is-ok' : 'is-bad'}>{sk.valid ? '通过' : '未过'}</strong>
					{sk.red_sikidy ? <span className="horosa-geomancy-sikidy-red">红 Sikidy(大凶)</span> : null}
				</div>
				<div className="horosa-geomancy-sikidy-grid">
					{Array.from({ length: 16 }, (_, k)=>String(k + 1)).map((ci)=>{
						const c = cols[ci] || {};
						const rows = c.rows || [];
						return (
							<div className={`horosa-geomancy-sikidy-col${princes.has(Number(ci)) ? ' is-prince' : ' is-slave'}`} key={ci}>
								<div className="horosa-geomancy-sikidy-dots">
									{rows.map((v, ri)=>(
										<div className="horosa-geomancy-sikidy-dotrow" key={ri}>
											{v ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
										</div>
									))}
								</div>
								<div className="horosa-geomancy-sikidy-meta"><span>{ci}</span><em>{c.name}</em><small>{c.meaning}</small></div>
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	// Hakata 四片盘:4 片正反(开/合)→ 4bit → 局图。
	renderHakata(reading){
		const hk = reading.hakata || {};
		const tablets = hk.tablets || [];
		return (
			<div className="horosa-geomancy-hakata">
				<div className="horosa-geomancy-hakata-tablets">
					{tablets.map((t, i)=>(
						<div className={`horosa-geomancy-hakata-tablet${t.open ? ' is-open' : ' is-closed'}`} key={i}>
							<strong>{t.label}</strong>
							<span className="horosa-geomancy-hakata-state">{t.open ? '开（单）' : '合（双）'}</span>
						</div>
					))}
				</div>
				<div className="horosa-geomancy-hakata-result">
					<div className="horosa-geomancy-hakata-figure" data-tone={hk.tone || ''}>{hk.figure_zh || hk.figure}</div>
					<small>{hk.reading}</small>
					{hk.orientation ? <small className="horosa-geomancy-hakata-orient">{hk.orientation}</small> : null}
				</div>
			</div>
		);
	}

	renderFigureCard(fig, role){
		if(!fig){ return null; }
		const dots = Array.isArray(fig.dots) ? fig.dots : [];
		return (
			<div className="horosa-geomancy-figure-card" key={role}>
				<div className="horosa-geomancy-figure-dots">
					{dots.map((single, i)=>(
						<div className="horosa-geomancy-dot-row" key={i}>
							{single ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
						</div>
					))}
				</div>
				<div className="horosa-geomancy-figure-meta">
					<span className="horosa-geomancy-figure-role">{role}</span>
					<strong>{fig.nameZh || fig.nameEn}</strong>
					<em>{[fig.planetZh, fig.elementZh, fig.signZh].filter(Boolean).join(' · ')}</em>
					{fig.keywordsZh ? <small>{fig.keywordsZh}</small> : null}
				</div>
			</div>
		);
	}

	renderReading(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据</div>; }
		const r = result.reading || {};
		const houses = r.houses || [];
		// [X1·P1-20] 读取范围真门控:L0 仅判官 / L1 +解读技法 / L2 盾牌全局(中栏恒在,解读同 L1) /
		// L3 +十二宫(默认,字节不变) / L4 = L3 并标注占星定局体系(黄道体系选择器所出,不臆造新层)。
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		return (
			<div className="horosa-geomancy-reading">
				{/* [X1·P1-22] 首母中止警示:后端算出而此前前端零渲染(约 1/8 盘触发) */}
				{r.haltedOnFirstMother ? (
					<div className="horosa-geomancy-card" style={{ borderColor: 'var(--horosa-danger, #cf1322)' }}>
						<div className="horosa-geomancy-card-title" style={{ color: 'var(--horosa-danger, #cf1322)' }}>⚠ 首母中止</div>
						<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>首母落 Rubeus/Cauda 之属——依所选传本传统,此占应中止、另择时再占;以下判读仅作参考。</div>
					</div>
				) : null}
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">本占概要</div>
					<div className="horosa-geomancy-summary">
						<div className="horosa-geomancy-summary-row"><span>问题</span><strong>{r.question || '—'}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>问类</span><strong>{r.questionTypeZh || r.questionType || '—'}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>上升</span><strong>{(r.ascendantFigure || {}).nameZh || '—'} · {r.ascendantSignZh || ''}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>主宫</span><strong>第 {r.primaryHouse || '—'} 宫</strong></div>
					</div>
				</div>
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">判定图形</div>
					<div className="horosa-geomancy-figure-grid horosa-geomancy-key-figures">
						{this.renderFigureCard(r.judge, '判官')}
						{this.renderFigureCard(r.reconciler, '调和者')}
						{this.renderFigureCard(r.ascendantFigure, '命主')}
					</div>
				</div>
				{lvl >= 1 ? this.renderTechniqueCard(r) : null}
				{lvl >= 4 ? (
					<div className="horosa-geomancy-card">
						<div className="horosa-geomancy-card-title">占星定局(L4)</div>
						<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>本盘按「{this.state.zodiacSystem === 'planetary' ? '行星归属体系' : '古典定局体系'}」定十二宫星座(见下十二宫各行星座列);上升 {r.ascendantSignZh || '—'}。</div>
					</div>
				) : null}
				{lvl < 3 ? (
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.7 }}>读取范围 {this.state.readingScope}:更深层(解读技法/十二宫)已按档隐藏,切至 L3/L4 展开全部。</div>
					</div>
				) : null}
				{lvl >= 3 ? (
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">十二宫（图形入宫 · 断语）</div>
					<div className="horosa-geomancy-house-list">
						{houses.map((h)=>{
							const fig = h.figure || {};
							const roles = h.roles || [];
							return (
								<div className={`horosa-geomancy-house-row${roles.length ? ' is-significator' : ''}`} key={h.house}>
									<span className="horosa-geomancy-house-num">{h.house}</span>
									<span className="horosa-geomancy-house-sign"><span className="horosa-geomancy-sign-glyph" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span> {h.signZh}</span>
									<span className="horosa-geomancy-house-topic">
										<span className="horosa-geomancy-house-name">{h.nameZh || h.topicsZh}</span>
										<span className="horosa-geomancy-house-figure" data-tone={fig.tone || ''}>
											{fig.nameZh || fig.nameEn}{roles.indexOf('querent') >= 0 ? ' ·问者' : ''}{roles.indexOf('quesited') >= 0 ? ' ·所问' : ''}
										</span>
										{h.reading ? <small className="horosa-geomancy-house-reading">{h.reading}</small> : null}
									</span>
								</div>
							);
						})}
					</div>
				</div>
				) : null}
			</div>
		);
	}

	// 技法卡:完美/相位/阻碍/点数是否/应期/点之路/同伴(成对宫)。读 reading.technique(后端可计算解读)。
	renderTechniqueCard(r){
		const t = r && r.technique;
		if(!t){ return null; }
		const PERF = { occupation: '入主(同居一宫)', conjunction: '会合(邻宫)', mutation: '互变(他处相邻)', translation: '传递(第三图转介)', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		const COMP = { simple: '全同', demi_simple: '半同(同行星)', compound: '互反', capitular: '同首(火行)', none: '—' };
		const perfHit = t.perfection && t.perfection !== 'none';
		const rows = [];
		rows.push(['完美', perfHit ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : PERF.none)]);
		rows.push(['相位', ASP[t.aspect] || t.aspect]);
		if(t.prohibition){ rows.push(['阻碍', `第 ${t.prohibition} 宫强凶图阻断`]); }
		if(t.points_parity){ rows.push(['点数是否', `总 ${t.points_parity.total} 点·${t.points_parity.parity === 'even' ? '偶→是/稳' : '奇→否/动'}`]); }
		if(t.timing){ rows.push(['应期', `${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计·${{ fast: '角宫快', mid: '续宫中', slow: '果宫慢' }[t.timing.angularity] || ''}`]); }
		if(t.via_puncti){ rows.push(['点之路', t.via_puncti.through ? `贯通(${(t.via_puncti.path || []).join('→')})` : `断于${t.via_puncti.broken_at}`]); }
		if(t.natural_cosignificator){ rows.push(['自然共主', '月亮(判官属月亮系)']); }
		const comp = (t.company || []).filter((c)=>c.type && c.type !== 'none').map((c)=>`宫${c.pair[0]}/${c.pair[1]}:${COMP[c.type]}`);
		if(comp.length){ rows.push(['同伴', comp.join('；')]); }
		return (
			<div className="horosa-geomancy-card">
				<div className="horosa-geomancy-card-title">解读技法</div>
				<div className="horosa-geomancy-summary">
					{rows.map(([k, v], i)=>(
						<div className="horosa-geomancy-summary-row" key={i}><span>{k}</span><strong>{v}</strong></div>
					))}
				</div>
			</div>
		);
	}

	renderFigureCatalog(){
		const figures = (this.state.result && this.state.result.figures) || [];
		if(!figures.length){ return <div className="horosa-huangji-empty">起盘后显示 16 图形目录</div>; }
		return (
			<div className="horosa-geomancy-catalog-grid">
				{figures.map((f, i)=>{
					const tone = { good: '吉', bad: '凶', neutral: '中' }[f.tone] || '';
					const line2 = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
					const line3 = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
					return (
						<div className={`horosa-geomancy-catalog-card${f.tone ? ` is-tone-${f.tone}` : ''}`} key={f.nameEn || i}>
							<strong>{f.nameZh || f.latin || f.nameEn}{tone ? <span className="horosa-geomancy-catalog-tone">{tone}</span> : null}</strong>
							<em>{f.nameEn}{f.points ? ` · ${f.points}点` : ''}</em>
							{line2 ? <small>{line2}</small> : null}
							{line3 ? <small className="horosa-geomancy-catalog-astro">{line3}</small> : null}
							{f.keywordsZh ? <small>{f.keywordsZh}</small> : null}
							{f.meanings ? <small className="horosa-geomancy-catalog-mean">爱情{f.meanings['爱情']} · 财{f.meanings['财富']} · 业{f.meanings['事业']}</small> : null}
							{(f.nameArabic || f.nameGreek || f.nameHebrew) ? <small className="horosa-geomancy-catalog-alt">{[f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : ''].filter(Boolean).join('　')}</small> : null}
						</div>
					);
				})}
			</div>
		);
	}

	renderHistory(){
		const history = this.state.history || [];
		if(!history.length){ return <div className="horosa-huangji-empty">暂无历史记录</div>; }
		return (
			<div className="horosa-geomancy-history-list">
				{history.map((h, i)=>(
					<button type="button" className="horosa-geomancy-history-row" key={`${h.ts}_${i}`} onClick={()=>this.applyHistory(h)}>
						<span className="horosa-geomancy-history-q">{h.question || '（无问题）'}</span>
						<span className="horosa-geomancy-history-meta">{h.questionTypeZh || ''} · 判官{h.judge || '—'}</span>
					</button>
				))}
			</div>
		);
	}

	renderRightPanel(){
		return (
			<Tabs size="small" activeKey={this.state.rightPanelTab} onChange={this.setRightPanelTab} className="horosa-geomancy-aux horosa-cnx-aux">
				<TabPane tab="解读" key="reading">{this.renderReading()}</TabPane>
				<TabPane tab="十六图形" key="figures">{this.renderFigureCatalog()}</TabPane>
				<TabPane tab="历史" key="history">{this.renderHistory()}</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。护盾/宫盘切换中栏已有,不进栏。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.result,
			primary: { key: 'cast', label: '起盘', onClick: ()=>this.clickCast() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="geomancy"
				className="horosa-huangji-quick-dock horosa-geomancy-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height, minHeight: height, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}else if(height === '100%'){
			height = 760;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}else{
			height = height - 20;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}
		return (
			<TechniqueErrorBoundary label="天文地占">
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-geomancy-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
								<div className="horosa-huangji-board-host">{this.renderCenter()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">地占信息</div>
										<div className="horosa-side-panel-subtitle">判官、宫位与图形</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</Spin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
			</TechniqueErrorBoundary>
		);
	}
}

export default GeomancyMain;
