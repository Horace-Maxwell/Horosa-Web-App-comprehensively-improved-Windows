import React, { Component, Suspense } from 'react';   // React/Suspense:神数正传组件级 lazy 所需
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { Collapse, Input, InputNumber, Modal, Spin, Switch } from 'antd';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import CanPingMain from '../shusuan/CanPingMain';
import HeLuoMain from '../shusuan/HeLuoMain';
// 神数正传:组件级 lazy —— 引擎与秘数表(~250KB)随组件走独立 chunk,不点这条 rail 即零成本。
// 条文库(465KB+598KB)另在引擎内动态 import,条文号先出、正文到达后填(见 zhengchuan*Local)。
const ZhengChuanMain = React.lazy(() => import(/* webpackChunkName: "zhengchuan-main" */ '../shusuan/ZhengChuanMain'));
// 🔴 流派名表须自【独立常量文件】引 —— 直引那个 lazy 组件会成循环依赖:
//    宿主 → ZhengChuanMain → …，其时该导出解析为 undefined，整页当场崩
//    「Element type is invalid … got: undefined」(实测栽过);且会把其引擎拖回本 chunk。
import { SCHOOL_LABEL as ZHENGCHUAN_SCHOOL_LABEL } from '../shusuan/zhengchuanSchools';
import YiZhangJingMain from '../yizhangjing/YiZhangJingMain';
import YanQinBranchPanel from '../yanqin/YanQinBranchPanel';
import YanQinControls from '../yanqin/YanQinControls';
import { buildYanqinYanfaSnapshot } from '../yanqin/yanqinSnapshot';
import { deriveLocalNongliAsync } from '../../utils/divinationTimeDraft';
import { buildTiebanFramework, buildTiebanFrameworkSnapshot, TIEBAN_SCHOOLS, TIEBAN_KE_SYSTEMS } from '../../utils/tiebanFrameworkLocal';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import ZiWeiChart from '../ziwei/ZiWeiChart';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { formatHumanValue } from '../../utils/humanReadableFields';
import { normBinaryGender, parseFieldsDateTime, computeKinFieldsResync } from '../../utils/kinAstroFieldsSync';
import UpdatingBadge from '../common/UpdatingBadge';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { silentTechniquePanelsEnabled, stepPrefetchEnabled, kentangCacheEnabled, chartSCUEnabled } from '../../utils/perfFlags';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';

const { TabPane } = Tabs;
const { Option } = Select;

// horosa_kinastro_center_memo_v1(PERF-R9 Ship 6)—— 中栏盘面 memo 槽。
//
// 病灶:本类被数算九家 + 演禽 + 策天 + 一掌经共壳复用,左栏塞了上百个受控控件
// (铁板六项、南极十余项、蠢子十项、神数正传十八项…)。任一控件 onChange → setState →
// 恒真 sCU → **整棵树重渲**:中栏盘面(策天/演禽还要重跑 buildKinAstroZiWeiChart +
// buildZiWeiRulesForChart 造整张紫微盘)、右栏全部子页签、底部快捷栏,一并白跑一遍。
// 而这些控件里有大半(zhengchuan* / yizhangjing* / heluo* / canpingMethod 等 native 子技法项)
// 压根不进 buildPayload,盘面【逐字节不变】。
// ⚠️ 反例订正:cetian* 诸项(cetianMethod/LunarMode/StarOrder/show*)**是**进 buildPayload 的
//    (见 buildPayload 内 serviceKey==='cetian' 分支),且其 onChange 带 clickPlot 回调 → 重排 →
//    新 pan(引用必变)→ 本 memo 照常失效重渲。列它当「不进 payload」的例子是错的,已删。
//
// 修法:把中栏包进本 memo 槽,比较函数只在「盘 + fields 引用 + 影响盘面的选项签名」三者
// 全同时跳过。三项任一不同 → 返 false 照常重渲(拿的是父组件本轮最新的 render 闭包,
// 零陈旧)。sig 由 kinSig() 单点给出,漏一项就等于「改了不刷新」——故那里只许多写不许少写。
// kill-switch:与全站重组件 sCU 同闸(horosa.perf.chartSCU 置 '0' → 比较函数恒返 false =
// 逐字回到「中栏每次都重渲」的旧行为)。全站每一处渲染守卫都必须可一键回退,本处不例外。
const MemoSlot = React.memo(function KinAstroMemoSlot(props){
	return props.render();
}, function kinAstroSlotEqual(prev, next){
	if(!chartSCUEnabled()){
		return false;
	}
	return prev.pan === next.pan && prev.fields === next.fields && prev.sig === next.sig;
});

const TECHNIQUE_CONFIG = {
	shaozi: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '邵子、铁板、鬼谷与条文',
		serviceKey: 'shaozi',
		moduleKey: 'shusuan',
		techniqueLabel: '邵子神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'digits', label: '起数' },
			{ key: 'text', label: '条文' },
		],
	},
	tieban: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '铁板神数、扣入法与算盘打数',
		serviceKey: 'tieban',
		moduleKey: 'shusuan',
		techniqueLabel: '铁板神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'core', label: '核心' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'verses', label: '条文' },
			{ key: 'dayun', label: '大运' },
			{ key: 'framework', label: '框架' },
		],
	},
	fendjing: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '鬼谷分定经、两头钳与古文断语',
		serviceKey: 'fendjing',
		moduleKey: 'shusuan',
		techniqueLabel: '鬼谷分定经',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'twoGan', label: '两头钳' },
			{ key: 'fate', label: '命格' },
			{ key: 'verses', label: '断语' },
		],
	},
	beiji: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '北极神数、刻分与条文',
		serviceKey: 'beiji',
		moduleKey: 'shusuan',
		techniqueLabel: '北极神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'yearHour', label: '年时' },
			{ key: 'queries', label: '条文' },
			{ key: 'search', label: '检索' },
			{ key: 'family', label: '家亲' },
			{ key: 'fortune', label: '财官' },
			{ key: 'dayun', label: '大运' },
		],
	},
	nanji: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '南极神数、宫部与条文',
		serviceKey: 'nanji',
		moduleKey: 'shusuan',
		techniqueLabel: '南极神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'palaceText', label: '宫部' },
			{ key: 'queryText', label: '查询' },
			{ key: 'dayun', label: '大运' },
			{ key: 'password', label: '密码' },
			{ key: 'divine', label: '星图' },
		],
	},
	chunzi: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '蠢子数、宿度与诗词候选',
		serviceKey: 'chunzi',
		moduleKey: 'shusuan',
		techniqueLabel: '蠢子数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'codes', label: '代码' },
			{ key: 'analysis', label: '解析' },
			{ key: 'candidates', label: '候选' },
			{ key: 'lookup', label: '查询' },
			{ key: 'search', label: '检索' },
		],
	},
	canping: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '邵子参评数、金锁银匙与条文',
		serviceKey: 'canping',
		moduleKey: 'shusuan',
		techniqueLabel: '邵子参评数',
		native: true,
		showRail: true,
		tabs: [],
	},
	heluo: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '河洛理数、先后天卦与爻辞',
		serviceKey: 'heluo',
		moduleKey: 'shusuan',
		techniqueLabel: '河洛理数',
		native: true,
		showRail: true,
		tabs: [],
	},
	zhengchuan: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '神数正传、铁板邵子大定与条文',
		serviceKey: 'zhengchuan',
		moduleKey: 'shusuan',
		techniqueLabel: '神数正传',
		native: true,
		showRail: true,
		tabs: [],
	},
	xianqin: {
		pageTitle: '演禽',
		infoTitle: '演禽信息',
		infoSubTitle: '三宫、星禽与吞啖',
		serviceKey: 'xianqin',
		moduleKey: 'yanqin',
		techniqueLabel: '万化仙禽',
		showRail: false,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'stars', label: '星禽' },
			{ key: 'swallow', label: '吞啖' },
			{ key: 'yanfa', label: '演法' },
		],
	},
	cetian: {
		pageTitle: '其他',
		infoTitle: '其他信息',
		infoSubTitle: '策天十八飞星（书法/原法可切）',
		serviceKey: 'cetian',
		moduleKey: 'mingother',
		techniqueLabel: '策天飞星',
		showRail: true,
		// 飞星/格局 tab 仅原法(kentang)有内容时由 visibleTabs 过滤自动出现;书法无该数据则自动隐藏。
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'flying', label: '飞星' },
			{ key: 'patterns', label: '格局' },
		],
	},
	yizhangjing: {
		pageTitle: '其他',
		infoTitle: '其他信息',
		infoSubTitle: '一掌经·十二星宫与流年十二神',
		serviceKey: 'yizhangjing',
		moduleKey: 'mingother',
		techniqueLabel: '一掌经',
		native: true,
		showRail: true,
		tabs: [],
	},
};

// normBinaryGender / parseFieldsDateTime / computeKinFieldsResync 移至 utils/kinAstroFieldsSync
// （fields→state 同步层，纯函数可测；载入命例时 didUpdate 据此重同步性别/农历锚点，修透传断链）。

// horosa_kentang_result_cache_v1 —— 数算六家(邵子/铁板/鬼谷分定/北极/南极/蠢子)+ 演禽 + 策天飞星
// 共用的 /{serviceKey}/pan 直连不经 utils/request(拿不到 requestDedupe/chartMem):切技法/切页再回来
// 原样重付整趟往返。这里按 services/qizheng.js 同款做「同参复用 + 在途合并」LRU(48 条)。
// 确定性论证:payload 全部来自 parseFieldsDateTime(fields)——'YYYY-MM-DD'/'HH:mm:ss' 格式化字串 +
// 整数 + 性别/流派开关,无 Date 对象、无随机、无「现在时刻」依赖、后端无写库副作用 → 同 payload 必同盘。
// 命中返回深拷贝(与直连逐值等价、只更快);关 horosa.perf.techniqueResultCache 即逐字回到下面的直连原函数。
async function postKinAstroRaw(serviceKey, payload){
	let rsp = null;
	try{
		const rawResponse = await cachedKentangFetch(buildKentangEndpoint(serviceKey, 'pan'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'kinastro.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/${serviceKey}/pan`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'kinastro.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

function postKinAstro(serviceKey, payload){
	// v3.5.1 收敛:结果级缓存退役 —— Raw 内部已走上游 utils/kentangCache(键=去端口路径+body,
	// serviceKey 已在 URL 路径里 ⇒ 天然分键;三层+在途去重)。
	return postKinAstroRaw(serviceKey, payload);
}

function fmtValue(value){
	return formatHumanValue(value);
}

function textValue(value){
	if(value === undefined || value === null || value === ''){
		return '—';
	}
	if(typeof value === 'object'){
		return fmtValue(value.text || value.verse || value.content || value.raw_key || value);
	}
	return fmtValue(value);
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无 kinastro 数据';
	}
	if(pan.snapshot){
		return pan.snapshot;
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

// 演禽(xianqin)/ 策天飞星(cetian) AI 快照(无头):按出生 fields 经 ken 后端起盘 → buildSnapshotText。
// aiAnalysisContext 复算用;无 pan 或后端不可达即返 '' → 挂载显示「缺失」而非占位语。
export async function buildKinAstroSnapshotForFields(fields, serviceKey){
	if(!serviceKey){
		return '';
	}
	const payload = parseFieldsDateTime(fields);
	if(!payload){
		return '';
	}
	let text = '';
	try{
		const pan = await postKinAstro(serviceKey, payload);
		if(pan){
			const t = buildSnapshotText(pan);
			text = (t && t !== '暂无 kinastro 数据') ? t : '';
		}
	}catch(e){
		text = '';
	}
	// 演禽:追加右栏「演法」内容(起禽四禽/择日/占卜/投胎 + 当前流派),纯前端,后端不可达也出。
	if(serviceKey === 'xianqin'){
		try{
			// 全年份域:BC/域外农历月(月禽/投胎)lunar-js 静默错 → 经远程桥取权威 monthInt 注入快照 payload。
			const yanfaPayload = { ...payload };
			try{
				const nl = await deriveLocalNongliAsync(fields);
				if(nl && nl.monthInt){ yanfaPayload.lunarMonth = nl.monthInt; }
			}catch(e){ /* 桥失败 → snapshot 内域内 lunar-js/公历月兜底 */ }
			const yanfa = buildYanqinYanfaSnapshot(yanfaPayload);
			if(yanfa){ text = text ? (text + '\n\n' + yanfa) : yanfa; }
		}catch(e){ /* 演法失败不影响命盘快照 */ }
	}
	return text;
}

function kinAstroSnapshotKey(serviceKey){
	return `kinastro-${serviceKey || 'unknown'}`;
}

function setRuntimeKinAstroTechnique(moduleKey, serviceKey){
	try{
		if(typeof window === 'undefined'){
			return;
		}
		if(!window.__horosaKinAstroCurrent || typeof window.__horosaKinAstroCurrent !== 'object'){
			window.__horosaKinAstroCurrent = {};
		}
		if(moduleKey){
			window.__horosaKinAstroCurrent[moduleKey] = serviceKey;
		}
		window.__horosaKinAstroCurrent.technique = serviceKey;
		window.__horosaKinAstroTechnique = serviceKey;
	}catch(e){
		// runtime hint only
	}
}

function saveKinAstroAISnapshots(config, pan, extraSnapshot){
	if(!config || !pan){
		return;
	}
	const base = buildSnapshotText(pan);
	const content = extraSnapshot ? `${base}\n\n${extraSnapshot}` : base;
	const meta = {
		source: 'kentang2017/kinastro',
		serviceKey: config.serviceKey,
		technique: config.techniqueLabel,
		moduleKey: config.moduleKey,
		sections: (pan.sections || []).map((section)=>section.title).filter(Boolean),
	};
	saveModuleAISnapshot(kinAstroSnapshotKey(config.serviceKey), content, meta);
	saveModuleAISnapshot(config.moduleKey, content, meta);
}

function sectionByTitle(sections, names){
	const wanted = new Set(names);
	return (sections || []).filter((section)=>wanted.has(section.title));
}

const BRANCH_INDEX = {
	子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
	午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};

const TWELVE_PALACE_LAYOUT = [
	{ row: 1, col: 1, branch: 5 }, { row: 1, col: 2, branch: 6 }, { row: 1, col: 3, branch: 7 }, { row: 1, col: 4, branch: 8 },
	{ row: 2, col: 1, branch: 4 }, { row: 2, col: 4, branch: 9 },
	{ row: 3, col: 1, branch: 3 }, { row: 3, col: 4, branch: 10 },
	{ row: 4, col: 1, branch: 2 }, { row: 4, col: 2, branch: 1 }, { row: 4, col: 3, branch: 0 }, { row: 4, col: 4, branch: 11 },
];

const BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEM_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const SIHUA_KEYS = ['禄', '权', '科', '忌'];
const BEIJI_KE_OPTIONS = [
	{ value: '1', label: '初一刻' },
	{ value: '2', label: '初二刻' },
	{ value: '3', label: '初三刻' },
	{ value: '4', label: '初四刻' },
	{ value: '5', label: '正一刻' },
	{ value: '6', label: '正二刻' },
	{ value: '7', label: '正三刻' },
	{ value: '8', label: '正四刻' },
];
const NANJI_SECTION_OPTIONS = BRANCH_NAMES.map((item)=>({ value: `${item}部`, label: `${item}部` }));
const NANJI_JIANCHU_OPTIONS = [
	{ value: '建', label: '建' },
	{ value: '除', label: '除' },
	{ value: '滿', label: '满' },
	{ value: '平', label: '平' },
	{ value: '定', label: '定' },
	{ value: '執', label: '执' },
	{ value: '破', label: '破' },
	{ value: '危', label: '危' },
	{ value: '成', label: '成' },
	{ value: '收', label: '收' },
	{ value: '開', label: '开' },
	{ value: '閉', label: '闭' },
];
const NANJI_XIU_OPTIONS = [
	'角', '亢', '氏', '房', '心', '尾', '箕',
	'斗', '牛', '女', '虛', '危', '室', '壁',
	'奎', '婁', '胃', '昴', '畢', '觜', '參',
	'井', '鬼', '柳', '星', '張', '翼', '軫',
].map((item)=>({
	value: item,
	label: item.replace('虛', '虚').replace('婁', '娄').replace('畢', '毕').replace('參', '参').replace('張', '张').replace('軫', '轸'),
}));
const NANJI_PASSWORD_OPTIONS = [
	'海異山同', '山異海同', '將脫這際', '除柳', '蕉局', '財勝局',
	'原比', '花牌同乾', '跳重', '重肘', '則要荊茨', '天地局', '陰盛',
].map((item)=>({
	value: item,
	label: item
		.replace('異', '异')
		.replace('將脫這際', '将脱这际')
		.replace('財勝局', '财胜局')
		.replace('則要荊茨', '则要荆茨')
		.replace('陰盛', '阴盛'),
}));
const NANJI_CHART_OPTIONS = Array.from({ length: 18 }).map((_, index)=>({
	value: index + 1,
	label: `第${index + 1}图`,
}));
const CHUNZI_KE_OPTIONS = Array.from({ length: 10 }).map((_, index)=>({
	value: `${index + 1}`,
	label: `${index + 1}刻`,
}));
const CHUNZI_RESULT_LIMIT_OPTIONS = [10, 20, 30, 50].map((item)=>({
	value: `${item}`,
	label: `${item}条`,
}));
const CHUNZI_MANSION_OPTIONS = [
	'角', '亢', '氐', '房', '心', '尾', '箕',
	'斗', '牛', '女', '虛', '危', '室', '壁',
	'奎', '婁', '胃', '昴', '畢', '觜', '參',
	'井', '鬼', '柳', '星', '張', '翼', '軫',
].map((item)=>({
	value: item,
	label: item.replace('虛', '虚').replace('婁', '娄').replace('畢', '毕').replace('參', '参').replace('張', '张').replace('軫', '轸'),
}));
const HUA_NORMALIZE = {
	祿: '禄',
	權: '权',
	科: '科',
	忌: '忌',
};
const GANZHI_PATTERN = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
const INTERNAL_SECTION_TITLES = new Set([
	'十二宫顺序',
	'三元起宿',
	'合宿表',
	'科名月宿',
	'四季得时',
	'情性赋全表',
	'二十八宿正像',
	'吞啖合战规则',
	'贵贱赋摘要',
	'星曜属性',
	'正曜副曜',
	'宫干四化表',
	'飞化规则',
	'古法格局规则',
	'三合组',
]);

function normalizeGanzhiInput(value){
	const text = `${value || ''}`.trim();
	return GANZHI_PATTERN.test(text) ? text : '';
}

function toStarList(value){
	if(!value){
		return [];
	}
	const list = value instanceof Array ? value : [value];
	return list.map((item)=>{
		const name = typeof item === 'object' ? (item.name || item.label || item.title || '') : item;
		return `${name || ''}`.trim();
	}).filter(Boolean).map((name)=>({ name }));
}

function normalizeHuaLabel(value){
	const text = `${value || ''}`.trim();
	return HUA_NORMALIZE[text] || text;
}

function getCetianStarFlightTarget(starName, palace, cetian){
	const formatTarget = (target)=>{
		if(target === undefined || target === null || target === ''){
			return '';
		}
		let branchValue = target;
		if(typeof target === 'object'){
			branchValue = target.to_branch !== undefined && target.to_branch !== null ? target.to_branch
				: (target.branch !== undefined && target.branch !== null ? target.branch
					: (target.to_palace || target.palace || ''));
		}
		return BRANCH_NAMES[branchValue] || `${branchValue || ''}`.replace(/[宫宮]$/, '').slice(-1);
	};
	if(palace && palace.flying_stars && palace.flying_stars[starName]){
		return formatTarget(palace.flying_stars[starName]);
	}
	const flight = cetian && cetian.star_flight ? cetian.star_flight[starName] : null;
	if(!flight || flight.to_branch === undefined || flight.to_branch === null){
		return '';
	}
	return formatTarget(flight);
}

function toCetianStarList(value, sihua, palace = {}, cetian = {}){
	return toStarList(value).map((star)=>({
		...star,
		hua: normalizeHuaLabel((palace.sihua && palace.sihua[star.name]) || (sihua && sihua[star.name])),
		starlight: palace.brightness && palace.brightness[star.name] ? `${palace.brightness[star.name]}` : '',
		flyTo: getCetianStarFlightTarget(star.name, palace, cetian),
	}));
}

function toXianqinStarList(value){
	if(!value){
		return [];
	}
	const list = value instanceof Array ? value : [value];
	return list.map((item)=>{
		if(typeof item === 'object'){
			return {
				name: `${item.name || item.label || item.title || ''}`.trim(),
			};
		}
		const text = `${item || ''}`.trim();
		const parts = text.split(/[：:]/);
		if(parts.length >= 2){
			return {
				name: parts.slice(1).join('：').trim(),
			};
		}
		return { name: text };
	}).filter((item)=>item.name);
}

const XIANQIN_PALACE_STAR_MAP = [
	{ match: ['命'], label: '命星', source: 'ming_xing' },
	{ match: ['财帛', '財帛'], label: '财帛星', key: '財帛星' },
	{ match: ['兄弟'], label: '兄弟星', key: '兄弟星' },
	{ match: ['田宅'], label: '田宅星', key: '田宅星' },
	{ match: ['子女', '子息'], label: '子息星', key: '子息星' },
	{ match: ['奴仆', '奴僕'], label: '奴仆星', key: '奴僕星' },
	{ match: ['夫妻', '妻妾'], label: '妻妾星', key: '妻妾星' },
	{ match: ['疾厄'], label: '疾厄星', key: '疾厄星' },
	{ match: ['迁移', '遷移'], label: '迁移星', key: '遷移星' },
	{ match: ['官禄', '官祿'], label: '官禄星', key: '官祿星' },
	{ match: ['福德'], label: '福德星', key: '福德星' },
	{ match: ['相貌'], label: '相貌星', key: '相貌星' },
];

function normalizeXianqinPalaceName(value){
	return `${value || ''}`
		.replace(/[宫宮]/g, '')
		.replace(/財/g, '财')
		.replace(/僕/g, '仆')
		.replace(/遷/g, '迁')
		.replace(/祿/g, '禄')
		.replace(/妾/g, '妻');
}

function getXianqinPalaceStarEntry(chartData, palaceName){
	const stars = (chartData && chartData.stars) || {};
	const derived = stars.derived || {};
	const normalizedName = normalizeXianqinPalaceName(palaceName);
	const found = XIANQIN_PALACE_STAR_MAP.find((item)=>item.match.some((name)=>normalizedName.indexOf(normalizeXianqinPalaceName(name)) >= 0));
	if(!found){
		return '';
	}
	const qin = found.source ? stars[found.source] : (derived[found.key] || derived[normalizeXianqinPalaceName(found.key)]);
	return qin ? `${found.label}：${qin}` : '';
}

function getXianqinPalaceNameByBranch(chartData, branch){
	const twelve = ((chartData && chartData.palaces) || {}).twelve || {};
	const entry = Object.keys(twelve).find((key)=>twelve[key] === branch);
	return entry || '';
}

function emptyZiWeiHouse(branchIdx){
	const branch = BRANCH_NAMES[branchIdx] || '';
	return {
		name: branch,
		ganzi: `　${branch}`,
		starsMain: [],
		starsAssist: [],
		starsEvil: [],
		starsSmall: [],
		starsOthersGood: [],
		starsOthersBad: [],
		direction: [branchIdx * 10 + 1, branchIdx * 10 + 10],
		phase: '',
	};
}

function buildZiWeiRulesForChart(chart){
	const ruleHouses = {};
	const huaInHouse = {};
	SIHUA_KEYS.forEach((key)=>{
		huaInHouse[key] = {};
	});
	(chart.houses || []).forEach((house)=>{
		const name = house && house.name ? house.name : '';
		if(name){
			ruleHouses[name] = [];
			SIHUA_KEYS.forEach((key)=>{
				huaInHouse[key][name] = [];
			});
		}
	});
	return {
		ZWRules: {
			RuleHouses: ruleHouses,
			RuleStars: {},
			RuleSihua: { 禄: [], 权: [], 科: [], 忌: [] },
		},
		ZWRuleSihua: {
			HuaInHouse: huaInHouse,
		},
	};
}

function addPalaceMarker(house, marker){
	if(!house || !marker){
		return;
	}
	const exists = (house.starsAssist || []).some((star)=>star.name === marker);
	if(!exists){
		house.starsAssist = [{ name: marker }].concat(house.starsAssist || []);
	}
}

function buildKinAstroZiWeiChart(pan, serviceKey){
	const dateStr = pan && pan.dateStr ? pan.dateStr : '2026-01-01';
	const timeStr = pan && pan.timeStr ? pan.timeStr : '00:00:00';
	const chart = {
		kinastroBorrowed: true,
		birth: dateStr,
		zone: fmtValue(pan && pan.timezone),
		lon: fmtValue(pan && pan.longitude),
		lat: fmtValue(pan && pan.latitude),
		yearZi: '子',
		yearGan: '',
		yearPolar: 'Positive',
		gender: 'Male',
		wuxingJuText: serviceKey === 'cetian' ? '策天十八飞星' : '演禽盘',
		lifeMaster: serviceKey === 'cetian' ? fmtValue(pan && pan.mingGong) : '命星',
		bodyMaster: serviceKey === 'cetian' ? fmtValue(pan && pan.shenGong) : '身星',
		zidou: serviceKey === 'cetian' ? fmtValue(pan && pan.ziwei) : '—',
		doujun: serviceKey === 'cetian' ? fmtValue(pan && pan.hourBranch) : '—',
		nongli: {
			year: pan && pan.lunar && pan.lunar.text ? pan.lunar.text : dateStr,
			month: '',
			day: '',
			time: ` ${timeStr}`,
			birth: `${dateStr} ${timeStr}`,
			leap: false,
		},
		bazi: {
			bazi: {
				year: { ganzi: '—' },
				month: { ganzi: '—' },
				day: { ganzi: '—' },
				time: { ganzi: '—' },
			},
			direct: { direction: [] },
		},
		houses: BRANCH_NAMES.map((_, idx)=>emptyZiWeiHouse(idx)),
	};

	if(serviceKey === 'cetian'){
		const palaces = (pan.cetian && pan.cetian.palaces) || [];
		const cetian = pan.cetian || {};
		palaces.forEach((palace, idx)=>{
			const branchIdx = palace.branch;
			if(branchIdx === undefined || branchIdx === null || !chart.houses[branchIdx]){
				return;
			}
			const branch = palace.branch_name || BRANCH_NAMES[branchIdx] || '';
			const mainStars = toCetianStarList(palace.stars, cetian.sihua, palace, cetian);
			const assistStars = toCetianStarList(palace.aux_stars, cetian.sihua, palace, cetian);
			const stemBranch = `${palace.stem_name || ''}${branch}`;
			chart.houses[branchIdx] = {
				...emptyZiWeiHouse(branchIdx),
				name: `${palace.name || branch || ''}`.replace(/[宫宮]$/, '') || branch,
				ganzi: stemBranch || branch,
				starsMain: mainStars,
				starsAssist: assistStars,
				starsEvil: toStarList(palace.patterns),
				direction: [idx * 10 + 1, idx * 10 + 10],
			};
		});
		if(chart.houses[cetian.shen_gong_branch]){
			chart.houses[cetian.shen_gong_branch].kinastroCornerMark = '身';
			chart.houses[cetian.shen_gong_branch].isBody = true;
		}
		return chart;
	}

	if(serviceKey === 'xianqin'){
		const palaces = {};
		(pan.palaceCards || []).forEach((card)=>{
			const branchIdx = BRANCH_INDEX[card.branch];
			if(branchIdx !== undefined){
				palaces[branchIdx] = card;
			}
		});
		const chartData = pan.xianqin || {};
		BRANCH_NAMES.forEach((branch, idx)=>{
			const palace = palaces[idx] || {};
			const palaceName = palace.name || getXianqinPalaceNameByBranch(chartData, branch) || branch;
			const stars = (palace.stars && palace.stars.length)
				? palace.stars
				: [getXianqinPalaceStarEntry(chartData, palaceName)].filter(Boolean);
			chart.houses[idx] = {
				...emptyZiWeiHouse(idx),
				name: `${palaceName || branch || ''}`.replace(/[宫宮]$/, '') || branch,
				ganzi: `　${branch}`,
				starsMain: toXianqinStarList(stars.slice ? stars.slice(0, 1) : stars),
				starsAssist: toXianqinStarList(stars.slice ? stars.slice(1) : []),
				starsEvil: [],
				direction: [idx * 10 + 1, idx * 10 + 10],
			};
		});
		const stars = chartData.stars || {};
		const xianqinPalaces = chartData.palaces || {};
		[
			{ palace: xianqinPalaces.tai_gong, marker: '胎' },
			{ palace: xianqinPalaces.shen_gong, marker: '身' },
		].forEach((item)=>{
			const branchIdx = BRANCH_INDEX[item.palace && item.palace.branch];
			if(chart.houses[branchIdx]){
				chart.houses[branchIdx].kinastroCornerMark = item.marker;
			}
		});
		chart.lifeMaster = fmtValue(stars.ming_xing);
		chart.bodyMaster = fmtValue(stars.shen_xing);
		chart.zidou = fmtValue(stars.tai_xing);
		chart.doujun = fmtValue((chartData.basic_info || {}).san_yuan);
		return chart;
	}

	return chart;
}

class KinAstroMain extends Component{
	constructor(props){
		super(props);
		const technique = props.technique || 'shaozi';
		this.config = TECHNIQUE_CONFIG[technique] || TECHNIQUE_CONFIG.shaozi;
		this.state = {
			loading: false,
			pan: null,
			rightPanelTab: 'overview',
			centerInfoVisible: false,
			gender: '1',
			// fields→state 上次同步来源标记（computeKinFieldsResync 用）；不进 optionKeys 观察器。
			fieldsSyncSrc: null,
			// 策天飞星双法:算法(书法/原法) + 原法子选项(农历/正曜)
			cetianMethod: 'book',
			cetianLunarMode: 'sxtwl',
			cetianStarOrder: 'reverse',
			// 策天 5 显示开关(默认 1=显示=现状,仅过滤输出不改算法)
			cetianShowWuXingJu: 1,
			cetianShowSihua: 1,
			cetianShowFlying: 1,
			cetianShowBrightness: 1,
			cetianShowSolarTerm: 1,
			ke: '初刻',
			useKey: '1',
			pillarOverride: '0',
			yearGz: '',
			monthGz: '',
			dayGz: '',
			hourGz: '',
			calendarMode: 'autoLunar',
			lunarYear: 2026,
			lunarMonth: 1,
			lunarDay: 1,
			tiebanMethod: 'kunji',
			tiebanStartAge: 0,
			tiebanDayunSteps: 8,
			tiebanSchool: 'south',      // 流派 §3.1:south 南派(默认·港台主流) / north 北派(中州)
			tiebanKeSystem: 'qing8',    // 刻制 §11.4:qing8 清八刻(默认) / ming100 明百刻 / dou12 十二刻斗宫
			tiebanKe: 1,                // 考刻刻位 1-8(框架层示意;精确刻分走后端考刻)
			tiebanTwinFen: 'off',       // 双胞胎三分 §11.6:off / shang上 / zhong中 / xia下
			tiebanGuofang: false,       // 过房/养子 对条标注 §11.6
			fatherBirthYear: null,
			fatherDeathYear: null,
			motherBirthYear: null,
			motherDeathYear: null,
			siblingsInfo: '',
			maritalStatus: '',
			childrenInfo: '',
				fendjingStemOverride: '0',
				fendjingYearStem: '甲',
				fendjingHourStem: '甲',
				beijiKeMode: 'auto',
				beijiKe: '1',
				beijiLookupCode: '',
				beijiKeyword: '',
				nanjiMode: 'solar',
				nanjiAfterLichun: '1',
				nanjiLunarYear: 2026,
				nanjiSolarMonth: 1,
				nanjiDay: 1,
				nanjiHourZhi: '子',
				nanjiDayGan: '',
				nanjiDayZhi: '',
				nanjiSection: '子部',
				nanjiJianchu: '建',
				nanjiXiu: '張',
				nanjiPasswordCode: '海異山同',
				nanjiChart: 1,
				nanjiPalace: '子',
				nanjiDegree: 1,
				chunziKeMode: 'auto',
				chunziKe: '3',
				chunziLunarMode: 'auto',
				chunziLunarMonth: 1,
				chunziLunarDay: 1,
				chunziLookupCode: '',
				chunziKeyword: '',
				chunziTags: '',
				chunziMansion: '室',
				chunziHourBranch: '子',
				chunziResultLimit: '20',
				canpingMethod: 'ming',
				canpingLiunian: null,
				heluoQuHuaGong: 'tuWangKunGen',
				heluoZiShu: 'pair',            // 取数法【分歧B】pair 成对全取★ / single 每支阴阳取一
				heluoJiGong: 'manualSanYuan',  // 五寄中宫【分歧D】manualSanYuan 三元表★ / legacy 旧代码
				heluoZhiZun: true,             // 三至尊卦【分歧E】坎屯蹇 实现★ / 忽略
				heluoPureGanKun: 'current',    // 纯乾坤落爻【分歧F】current★ / alt 抄本异
				heluoLiunianStep2: 'ying',     // 流年第二步【分歧H】ying 应爻法★ / sequential 顺行
				heluoHuangdiOffset: '2697',    // 纪年基准【分歧J】黄帝纪元差,公历+此=黄帝年(默认 2697)
				heluoShowLiuRi: true,          // 流日显示(展开流月后是否列 30 日)
				zhengchuanSchool: 'tieban',    // 流派:铁板神数★ / 邵子神数 / 大定神数
				zhengchuanAskGz: '',           // 求测时辰干支(铁板必需;留空则取本人时柱)
				zhengchuanFatherAge: '27',     // 父生我时年龄(邵子必需)
				zhengchuanMotherAge: '26',     // 母生我时年龄(邵子必需)
				zhengchuanYuan: 'zhong',       // 元运(邵子先天命卦余5特例):上元/中元★/下元
				zhengchuanDadingYear: '',      // 所推之流年(大定;主控 —— 虚岁/大运/小运/岁君尽由此派生)
				zhengchuanAge: '',             // 虚岁(大定;留空由流年派生。手填者优先,留作古法特例)
				                               // 🔴 默认须【空】:留 '40' 则「手订」恒真、且恒压过流年派生 —— 那还是老样子
				zhengchuanDayun: '',           // 大运干支(大定;留空取月柱)
				zhengchuanXiaoyun: '',         // 小运干支(大定;留空取时柱)
				zhengchuanSuijun: '',          // 岁君干支(大定;留空取年柱)
				zhengchuanAskHourZhi: '',      // 演算时辰支(六亲·玄机卦;留空取本人时支)
				zhengchuanEnv: '',             // 演算时天象(六亲·玄机卦;留空按时辰取天/地四象首项)
				zhengchuanItem: '父母',        // 查询项目(心易)★
				zhengchuanSound: '日',         // 声音(心易)★
				zhengchuanKe: '一刻',          // 刻数(心易·八刻分命)★
				zhengchuanGong: '乾',          // 八宫(心易·八刻分命)★
				zhengchuanXqZhi: '子',         // 性情项地支(心易)★
				zhengchuanXqYushu: '1',        // 性情项余数 1..12(心易)★
				yizhangjingShunni: 'yangNanYinNv',  // 顺逆规则:阳男阴女★ / 男顺女逆
				yizhangjingMingGong: 'shiShang',    // 命宫定法:时上起命★ / 数至卯
				yizhangjingDayunLen: '7',           // 大限运长:7年★ / 10年
				yizhangjingStartAge: 'mi',          // 大限起运岁:秘传★ / 1岁连续
				yizhangjingXiaoStart: 'ri',         // 小限起宫:日柱宫★ / 月柱宫
				yizhangjingFlowSet: 'A',            // 流年十二神:甲组★ / 乙 / 丙
				yizhangjingChongfan: 'alpha',       // 重犯口诀:常见组★ / 异传组
				yizhangjingDingYue: 'nongli',       // 定月法:农历月★ / 节气月
				yizhangjingShensha: false,          // 神煞合参层(默认关)
			};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		// 网络层去重:同一(serviceKey+payload)的请求若已在途,后到的等价触发跳过(不重打后端)。
		// 起盘/改设置/切技法经 dispatch→save(props 变)+doHook(hook 回调)两路+各入口会对同一输入
		// 重复触发 fetchPan;requestSeq 只挡「结果应用」,这里挡「重复网络请求」。输入变 → 签名变 → 不跳过。
		this._inFlightSig = null;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.openCenterInfo = this.openCenterInfo.bind(this);
		this.closeCenterInfo = this.closeCenterInfo.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.fetchPan(fields || this.props.fields);
			};
			// 🔴 chartFree 契约(极速化快车道):本页中右栏【零】消费共享 chartObj(全部由 fields
			// 驱动本组件自算/自取)。声明后 fetchByFields 对本页走快车道:fields 立即提交、
			// 不等 /chart 网络 —— 本页从「等一次网络(~230ms)」变「点击即出(<100ms)」。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
		}
	}

	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	// horosa_prefetch_registry_v1(PERF-R10 P6):数算/其他/演禽 的步进预取登记。
	// 「已步进 fields」走与真点完全相同的 buildPayload+postKinAstro 路径(缓存键
	// serviceKey|payload 逐字节同键);native 技法(参评/河洛/正传/一掌经,本地引擎)
	// 与构参失败一律返回 [](零网络)。登记键 = 页签 moduleKey;换轨跨模块键
	// (mingother↔yanqin)时必须迁移登记,否则新键查不到预取器。
	_syncStepPrefetcher(){
		const key = this.config.moduleKey;
		if(this._stepPrefetchKey === key && this._stepPrefetcher){
			return;
		}
		if(this._stepPrefetchKey && this._stepPrefetcher){
			unregisterStepPrefetcher(this._stepPrefetchKey, this._stepPrefetcher);
		}
		this._stepPrefetcher = (steppedFields)=>{
			try{
				if(this.config.native){ return []; }
				const payload = this.buildPayload(steppedFields);
				if(!payload){ return []; }
				const sk = this.config.serviceKey;
				return [{
					name: sk,
					path: `/${sk}/pan`,
					run: ()=> postKinAstro(sk, payload).catch(()=>{ /* 预取失败静默 */ }),
				}];
			}catch(e){
				return [];
			}
		};
		this._stepPrefetchKey = key;
		registerStepPrefetcher(key, this._stepPrefetcher);
	}

	componentDidMount(){
		this.unmounted = false;
		setRuntimeKinAstroTechnique(this.config.moduleKey, this.config.serviceKey);
		this._syncStepPrefetcher();
		// fields→state 首次同步（性别+农历锚点）；此后 didUpdate 用同一 helper 做标记式重同步，
		// 载入命例（fields 变）时性别/锚点必随记录刷新（修透传断链），手动切换不被无关变化冲掉。
		const nextState = computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc) || {};
		// 全局日界点 / 晚子时·时柱起干 切换 → 重新 fetchPan (因为 buildPayload 用 defaultAfter23NewDay/defaultLateZiHourUseNextDay() 实时读 localStorage)
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.fetchPan(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.fetchPan(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.setState(nextState, ()=>this.fetchPan(this.props.fields));
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.technique !== this.props.technique){
			this.config = TECHNIQUE_CONFIG[this.props.technique || 'shaozi'] || TECHNIQUE_CONFIG.shaozi;
			setRuntimeKinAstroTechnique(this.config.moduleKey, this.config.serviceKey);
			this._syncStepPrefetcher();
			this.requestSeq += 1;
			this.setState({
				pan: null,
				rightPanelTab: 'overview',
				centerInfoVisible: false,
				loading: false,
				// fields 与技法同帧变化的角落：早退前也要重同步，否则本分支吞掉载入命例的性别/锚点变化。
				...(computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc) || {}),
			}, ()=>this.fetchPan(this.props.fields));
			return;
		}
		setRuntimeKinAstroTechnique(this.config.moduleKey, this.config.serviceKey);
		if(prevProps.fields !== this.props.fields && this.props.fields){
			// 🔴 载入命例（fields 变化）必须重同步 fields→state 拷贝（性别/农历锚点），否则 buildPayload
			// 与下传技法的 gender 停留旧值（透传断链 L2）。标记式检测：手动切换不被无关变化冲掉。
			// 重同步 setState 后 optionKeys 观察器会补发同参 fetchPan，由 fetchPan 的 _inFlightSig 去重。
			const resync = computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc);
			if(resync){
				this.setState(resync, ()=>this.fetchPan(this.props.fields));
			}else{
				this.fetchPan(this.props.fields);
			}
		}
		const optionKeys = [
			'gender', 'ke', 'useKey', 'pillarOverride', 'yearGz', 'monthGz', 'dayGz', 'hourGz',
			'calendarMode', 'lunarYear', 'lunarMonth', 'lunarDay',
			'tiebanMethod', 'tiebanStartAge', 'tiebanDayunSteps',
			'fatherBirthYear', 'fatherDeathYear', 'motherBirthYear', 'motherDeathYear',
				'siblingsInfo', 'maritalStatus', 'childrenInfo',
				'fendjingStemOverride', 'fendjingYearStem', 'fendjingHourStem',
				'beijiKeMode', 'beijiKe', 'beijiLookupCode', 'beijiKeyword',
				'nanjiMode', 'nanjiAfterLichun', 'nanjiLunarYear', 'nanjiSolarMonth', 'nanjiDay',
				'nanjiHourZhi', 'nanjiDayGan', 'nanjiDayZhi', 'nanjiSection', 'nanjiJianchu',
				'nanjiXiu', 'nanjiPasswordCode', 'nanjiChart', 'nanjiPalace', 'nanjiDegree',
				'chunziKeMode', 'chunziKe', 'chunziLunarMode', 'chunziLunarMonth', 'chunziLunarDay',
				'chunziLookupCode', 'chunziKeyword', 'chunziTags', 'chunziMansion', 'chunziHourBranch',
				'chunziResultLimit',
			];
		if(optionKeys.some((key)=>prevState[key] !== this.state[key])){
			this.fetchPan(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._stepPrefetchKey && this._stepPrefetcher){
			unregisterStepPrefetcher(this._stepPrefetchKey, this._stepPrefetcher);
			this._stepPrefetchKey = null;
			this._stepPrefetcher = null;
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
	// 缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	// 本组件渲染整个铁板神数家族,每实例按 this.config 对应一个技法;
	// 导出侧对 kinastro 走 kinastro-{serviceKey},故 kinKey 与 moduleKey 两个键都响应。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		const cfg = this.config || {};
		const kinKey = `kinastro-${cfg.serviceKey || 'unknown'}`;
		if(moduleName !== kinKey && moduleName !== cfg.moduleKey){
			return;
		}
		const pan = this.state ? this.state.pan : null;
		if(!pan){
			return;
		}
		let text = '';
		try{
			const suffix = this.tiebanFrameworkSuffix(pan);
			text = `${buildSnapshotText(pan) || ''}${suffix ? `\n\n${suffix}` : ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text && text !== '暂无 kinastro 数据'){
			saveModuleAISnapshot(moduleName, text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			const flds = { ...(this.props.fields || {}), ...field };
			this.props.dispatch({ type: 'astro/fetchByFields', payload: flds });
		}
	}

	changeGeo(rec){
		// 策天飞星(cetian)选地点 → 坐标 + 时区自动校正 → onFieldsChange → fetchByFields 实时重排
		const f = this.props.fields || {};
		const dDt = f.date && f.date.value;
		const tDt = f.time && f.time.value;
		const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
		const z = resolveGeoZone(rec, ds);
		const payload = {
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		};
		if(z){
			payload.zone = { value: z };
			// 重锚 date/time 到新时区(保留钟面时刻、瞬时随之偏移),否则排盘仍用旧时区算瞬时
			if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); payload.date = { value: nd }; payload.ad = { value: nd.ad }; }
			if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); payload.time = { value: nt }; }
		}
		Object.assign(payload, geoNameFieldPatch(rec));
		this.onFieldsChange(payload);
	}

	onTimeChanged(value){
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
			// [R3-A2] 步进方向提示:驱动 astro model settle 后 /chart ±步预取(消费后即剥离)
			...(value.step ? { __stepHint: value.step } : {}),
		});
		this.prefetchNextStepPan(dt, value.step);
	}

	// [R3-A4] 顺向 +1 步 pan 预取:当前步 T 由正式请求(hook 联动)落 kentangCache,此处
	// 静默备下 T+1 —— 连点下一下即命中。payload 走 buildPayload 单源 → 键逐字节等。
	// native 子技法(本地引擎)零网络,直接跳过;失败静默;开关关=零行为。
	prefetchNextStepPan(dt, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(this.config.native){ return; }
			if(!stepHint || !stepHint.dir || !dt || typeof dt.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				try{
					const dt2 = dt.clone();
					const unit = stepHint.unit || 'm';
					if(unit === 'y'){ dt2.addYear(stepHint.dir); }
					else if(unit === 'M'){ dt2.addMonth(stepHint.dir); }
					else if(unit === 'd'){ dt2.addDate(stepHint.dir); }
					else if(unit === 'h'){ dt2.addHour(stepHint.dir); }
					else { dt2.addMinute(4 * stepHint.dir); }
					const flds2 = {
						...(this.props.fields || {}),
						date: { value: dt2.clone() },
						time: { value: dt2.clone() },
						ad: { value: dt2.ad },
						zone: { value: dt2.zone },
					};
					const payload = this.buildPayload(flds2);
					if(!payload){ return; }
					postKinAstro(this.config.serviceKey, payload).catch(()=>null);
				}catch(e){ /* 预取失败无害 */ }
			}, 150);
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
		return { ...(baseFields || {}), ...patch };
	}

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(nextFields && nextFields.date && nextFields.time && nextFields.zone){
			// 单路触发:派发 fields → astro/fetchByFields → save(props 变→didUpdate)+doHook(hook 回调)
			// 经 fetchPan 重排;此处不再显式 fetchPan(否则同一起盘打 2~3 次后端,fetchPan 去重虽能收敛,
			// 但从源头单路更干净)。若可派发(date/time/zone 齐),交由 dispatch 驱动。
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
			return;
		}
		// 兜底:fields 不全(无法走 dispatch 重锚)时,仍直接起盘,避免按钮无反应。
		this.fetchPan(nextFields);
	}

	buildPayload(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return null;
		}
		const payload = {
			...dt,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
			gender: normBinaryGender(this.state.gender),
			ke: this.state.ke,
			useKey: this.state.useKey === '1',
			method: this.state.tiebanMethod,
			startAge: this.state.tiebanStartAge,
			dayunSteps: this.state.tiebanDayunSteps,
			fatherBirthYear: this.state.fatherBirthYear,
			fatherDeathYear: this.state.fatherDeathYear,
			motherBirthYear: this.state.motherBirthYear,
			motherDeathYear: this.state.motherDeathYear,
			siblingsInfo: this.state.siblingsInfo,
			maritalStatus: this.state.maritalStatus,
			childrenInfo: this.state.childrenInfo,
			calendarMode: this.state.calendarMode,
			lunarYear: this.state.lunarYear,
			lunarMonth: this.state.lunarMonth,
			lunarDay: this.state.lunarDay,
				stemOverride: this.state.fendjingStemOverride === '1',
				yearStem: this.state.fendjingYearStem,
				hourStem: this.state.fendjingHourStem,
				keMode: this.state.beijiKeMode,
				beijiKeMode: this.state.beijiKeMode,
				beijiKe: this.state.beijiKe,
				beijiLookupCode: this.state.beijiLookupCode,
				beijiKeyword: this.state.beijiKeyword,
				useKe: this.state.beijiKeMode === 'manual',
				nanjiMode: this.state.nanjiMode,
				nanjiAfterLichun: this.state.nanjiAfterLichun,
				nanjiLunarYear: this.state.nanjiLunarYear,
				nanjiSolarMonth: this.state.nanjiSolarMonth,
				nanjiDay: this.state.nanjiDay,
				nanjiHourZhi: this.state.nanjiHourZhi,
				nanjiDayGan: this.state.nanjiDayGan,
				nanjiDayZhi: this.state.nanjiDayZhi,
				nanjiSection: this.state.nanjiSection,
				nanjiJianchu: this.state.nanjiJianchu,
				nanjiXiu: this.state.nanjiXiu,
				nanjiPasswordCode: this.state.nanjiPasswordCode,
				nanjiChart: this.state.nanjiChart,
				nanjiPalace: this.state.nanjiPalace,
				nanjiDegree: this.state.nanjiDegree,
				chunziKeMode: this.state.chunziKeMode,
				chunziKe: this.state.chunziKe,
				chunziLunarMode: this.state.chunziLunarMode,
				chunziLunarMonth: this.state.chunziLunarMonth,
				chunziLunarDay: this.state.chunziLunarDay,
				chunziLookupCode: this.state.chunziLookupCode,
				chunziKeyword: this.state.chunziKeyword,
				chunziTags: this.state.chunziTags,
				chunziMansion: this.state.chunziMansion,
				chunziHourBranch: this.state.chunziHourBranch,
				chunziResultLimit: this.state.chunziResultLimit,
			};
		if(this.config.serviceKey === 'cetian'){
			// 策天双法:覆盖 method(避免与铁板 tiebanMethod 混用)+ 原法子选项
			payload.method = this.state.cetianMethod || 'book';
			payload.lunarMode = this.state.cetianLunarMode || 'sxtwl';
			payload.starOrder = this.state.cetianStarOrder || 'reverse';
			// 5 显示开关随盘请求下发(后端按 show_* 过滤输出段/行;默认 1=现状)
			payload.showWuXingJu = this.state.cetianShowWuXingJu;
			payload.showSihua = this.state.cetianShowSihua;
			payload.showFlying = this.state.cetianShowFlying;
			payload.showBrightness = this.state.cetianShowBrightness;
			payload.showSolarTerm = this.state.cetianShowSolarTerm;
		}
		if(this.state.pillarOverride === '1'){
			const yearGz = normalizeGanzhiInput(this.state.yearGz);
			const monthGz = normalizeGanzhiInput(this.state.monthGz);
			const dayGz = normalizeGanzhiInput(this.state.dayGz);
			const hourGz = normalizeGanzhiInput(this.state.hourGz);
			if(yearGz){
				payload.yearGz = yearGz;
			}
			if(monthGz){
				payload.monthGz = monthGz;
			}
			if(dayGz){
				payload.dayGz = dayGz;
			}
			if(hourGz){
				payload.hourGz = hourGz;
			}
		}
		return payload;
	}

	async fetchPan(fields){
		if(this.config.native){
			this.requestSeq += 1;
			// horosa_panel_ready_v1:原生技法(参评/河洛/正传/一掌经)不打后端,中右栏由子组件
			// 就着 props.fields 同步自算 —— 本次 setState 提交时子组件已随新 fields 渲完,
			// 故就在它的回调里盖章(markPanelReady 内部再双 rAF 逼近「本帧已绘」)。
			// horosa_panel_ready_attribution_key_v1:参数必须是页签归属键(moduleKey ==
			// currentTab:shusuan/mingother/yanqin),不是 serviceKey('shaozi' 等)——
			// perfMark 的归属校验按 currentTab 配对,键不一致时样本被静默丢弃(验收恒零样本)。
			this.setState({ loading: false, pan: null }, ()=>{
				markPanelReady(this.config.moduleKey);
			});
			return;
		}
		const payload = this.buildPayload(fields);
		if(!payload){
			return;
		}
		// 同输入去重:若一模一样的请求(serviceKey+payload)已在途,跳过(在途那次的结果会落到当前盘)。
		// 起盘一次会经 clickPlot→onFieldsChange→dispatch→save(props 变 didUpdate)+doHook(hook 回调)两路
		// 对同一 payload 重复触发;此处把真正的网络请求收敛为 1 次。输入任何变化 → sig 变 → 照常重排。
		const sig = `${this.config.serviceKey}|${JSON.stringify(payload)}`;
		if(this._inFlightSig === sig){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this._inFlightSig = sig;
		this.setState({ loading: true });
		try{
			const pan = await postKinAstro(this.config.serviceKey, payload);
			if(this._inFlightSig === sig){
				this._inFlightSig = null;
			}
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:这一次 setState 才是「盘落定」——中栏盘面与右栏各段
				// 都由 pan 派生,故本回调即「点击 → 中右栏画完」的终点。必须是首行:放在
				// saveKinAstroAISnapshots 之后会把快照序列化的耗时算进交互预算里。
				// 键契约同上(horosa_panel_ready_attribution_key_v1):moduleKey 而非 serviceKey。
				markPanelReady(this.config.moduleKey);
				saveKinAstroAISnapshots(this.config, pan, this.tiebanFrameworkSuffix(pan));
				// horosa_step_prefetch_arm_v1(b′):换轨/改选项后的 settle 也按当前技法武装 ±N
				//(fetchByFields settle 只覆盖时间派发路径;/chart 不在本页步进路径上)。
				try{ armStepPrefetch('local-settle', { fieldsOverride: fields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
			});
		}catch(e){
			if(this._inFlightSig === sig){
				this._inFlightSig = null;
			}
			console.warn('kinastro backend failed', this.config.serviceKey, e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	}

	openCenterInfo(){
		this.setState({ centerInfoVisible: true });
	}

	closeCenterInfo(){
		this.setState({ centerInfoVisible: false });
	}

	// ── horosa_kinastro_render_memo_v1(PERF-R9 Ship 6)──────────────────────────
	// 「影响盘面/快照产出」的选项签名。中栏 memo 槽、快照缓存、可见页签缓存三处共用它。
	// 🔴 只许多写不许少写:少一项 = 那项改了而中栏不刷新(功能降级),多一项只是少省一点。
	//    收录判据 = 被 renderCenter/renderTiebanFramework/tiebanFrameworkOf 读到的 state。
	//    (pan 自身与 props.fields 不进 sig,由 memo 槽按【引用】另行比较。)
	kinSig(){
		return [
			this.config.serviceKey,
			this.state.gender,
			this.state.tiebanSchool, this.state.tiebanKeSystem, this.state.tiebanKe,
			this.state.tiebanTwinFen, this.state.tiebanGuofang,
		].join('|');
	}

	// 快照文本:此前 renderRightPanel 与 renderBottomQuickDock 各算一遍(每次重渲两趟
	// buildSnapshotText 全段拼接 + tiebanFrameworkSuffix→buildTiebanFramework 整套框架推演)。
	// 按 (pan 引用, kinSig) 缓存;二者任一变即重算,产出逐字节同前。
	snapshotText(){
		const pan = this.state.pan;
		const sig = this.kinSig();
		if(this._snapCache && this._snapCache.pan === pan && this._snapCache.sig === sig){
			return this._snapCache.text;
		}
		const base = buildSnapshotText(pan);
		const suffix = this.tiebanFrameworkSuffix(pan);
		const text = suffix ? `${base}\n\n${suffix}` : base;
		this._snapCache = { pan, sig, text };
		return text;
	}

	// 可见子页签:同上,原先右栏与底部快捷栏各跑一遍(每个候选页签都要 getTabSections 过滤全段)。
	visibleTabsOf(snapshot){
		const pan = this.state.pan;
		const sig = this.kinSig();
		if(this._tabsCache && this._tabsCache.pan === pan && this._tabsCache.sig === sig
			&& this._tabsCache.snapshot === snapshot){
			return this._tabsCache.tabs;
		}
		const tabs = this.config.tabs.filter((item)=>{
			if(item.key === 'yanfa'){
				return this.config.serviceKey === 'xianqin';
			}
			if(!pan){
				return item.key === 'overview' || item.key === 'snapshot';
			}
			if(item.key === 'snapshot'){
				return !!snapshot;
			}
			if(item.key === 'classics'){
				const classics = pan && pan.classics;
				return !!(classics && classics.sections && classics.sections.length);
			}
			if(item.key === 'settings'){
				return this.config.serviceKey === 'cetian';
			}
			if(item.key === 'framework'){
				return this.config.serviceKey === 'tieban' && !!pan;
			}
			return this.getTabSections(item.key).length > 0;
		});
		this._tabsCache = { pan, sig, snapshot, tabs };
		return tabs;
	}

	// 下传给 native 子技法的 opts:此前每次 render 都新造对象 → 子组件 props 引用必变 →
	// 子组件那边任何 props 浅比 sCU 都恒失效。此处按 JSON 签名固定引用:值不变 = 引用不变。
	// (值一变即换新对象 → 子组件照常重渲;不缓存计算结果,只稳定引用。)
	memoOpts(name, obj){
		const sig = JSON.stringify(obj);
		const store = this._optsMemo || (this._optsMemo = {});
		const cur = store[name];
		if(cur && cur.sig === sig){
			return cur.value;
		}
		store[name] = { sig, value: obj };
		return obj;
	}

	// 中栏槽:后端盘技法走 memo(左栏改与盘无关的选项时不再重造整张盘);
	// native 技法中栏是子组件、由其自身 sCU 把关,此处透传不加层。
	renderCenterSlot(){
		if(this.config.native){
			return this.renderCenter();
		}
		return (
			<MemoSlot
				pan={this.state.pan}
				fields={this.props.fields}
				sig={this.kinSig()}
				render={()=>this.renderCenter()}
			/>
		);
	}

	renderPillarOverrideFields(){
		if(!['shaozi', 'tieban'].includes(this.config.serviceKey) || this.state.pillarOverride !== '1'){
			return null;
		}
		const fields = [
			{ key: 'yearGz', label: '年柱', placeholder: '甲子' },
			{ key: 'monthGz', label: '月柱', placeholder: '丙寅' },
			{ key: 'dayGz', label: '日柱', placeholder: '戊辰' },
			{ key: 'hourGz', label: '时柱', placeholder: '庚午' },
		];
		return fields.map((item)=>(
			<label className="horosa-huangji-select-field" key={item.key}>
				<span>{item.label}</span>
				<Input
					value={this.state[item.key]}
					placeholder={item.placeholder}
					maxLength={2}
					onChange={(event)=>this.setState({ [item.key]: event.target.value })}
				/>
			</label>
		));
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		return (
			<div className="horosa-huangji-input-stack horosa-kinastro-input-stack">
				<div>
					<div className="horosa-side-panel-title">{this.config.pageTitle}设置</div>
					<div className="horosa-side-panel-subtitle">时间、命盘与技法选项</div>
				</div>
				{/* [观象P1] KinAstro 母版分段:时间地点(不折叠)/技法选项(折叠记忆);内容结构零变 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={fields}
						value={datetm}
						timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
						timeHook={this.timeHook}
						showLocation={this.config.serviceKey === 'cetian'}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title={`${this.config.techniqueLabel}选项`} storageKey={`kin.${this.config.serviceKey}.options`} className="horosa-side-input-section">
				<div className="horosa-side-fields-inner">
					<div className={`horosa-huangji-select-grid horosa-kinastro-select-grid horosa-kinastro-select-grid-${this.config.serviceKey}`}>
						{this.config.serviceKey !== 'xianqin' ? (
							<label className="horosa-huangji-select-field">
								<span>性别</span>
								<Select value={normBinaryGender(this.state.gender)} onChange={(value)=>this.setState({ gender: value })}>
									<Option value="1">男</Option>
									<Option value="0">女</Option>
								</Select>
							</label>
						) : null}
						{this.config.serviceKey === 'cetian' ? (
							<>
								<label className="horosa-huangji-select-field is-wide">
									<span>算法</span>
									<Select value={this.state.cetianMethod} onChange={(value)=>this.setState({ cetianMethod: value }, this.clickPlot)}>
										<Option value="book">书法·策天本法</Option>
										<Option value="kentang">原法·标准紫微</Option>
									</Select>
								</label>
								{this.state.cetianMethod === 'kentang' ? (
									<>
										<label className="horosa-huangji-select-field">
											<span>农历</span>
											<Select value={this.state.cetianLunarMode} onChange={(value)=>this.setState({ cetianLunarMode: value }, this.clickPlot)}>
												<Option value="sxtwl">sxtwl(修正)</Option>
												<Option value="classic">原(闰月旧法)</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span>正曜</span>
											<Select value={this.state.cetianStarOrder} onChange={(value)=>this.setState({ cetianStarOrder: value }, this.clickPlot)}>
												<Option value="reverse">逆布(书)</Option>
												<Option value="forward">顺布(原)</Option>
											</Select>
										</label>
									</>
								) : null}
								<label className="horosa-huangji-select-field horosa-heluo-switch-field">
									<span>显示亮度（庙旺乐）</span>
									<Switch checked={!!this.state.cetianShowBrightness} onChange={(v)=>this.setState({ cetianShowBrightness: v ? 1 : 0 }, this.clickPlot)} />
								</label>
								{this.state.cetianMethod === 'kentang' ? (
									<>
										<label className="horosa-huangji-select-field horosa-heluo-switch-field">
											<span>显示五行局</span>
											<Switch checked={!!this.state.cetianShowWuXingJu} onChange={(v)=>this.setState({ cetianShowWuXingJu: v ? 1 : 0 }, this.clickPlot)} />
										</label>
										<label className="horosa-huangji-select-field horosa-heluo-switch-field">
											<span>显示四化（禄权科忌）</span>
											<Switch checked={!!this.state.cetianShowSihua} onChange={(v)=>this.setState({ cetianShowSihua: v ? 1 : 0 }, this.clickPlot)} />
										</label>
										<label className="horosa-huangji-select-field horosa-heluo-switch-field">
											<span>显示飞星与格局</span>
											<Switch checked={!!this.state.cetianShowFlying} onChange={(v)=>this.setState({ cetianShowFlying: v ? 1 : 0 }, this.clickPlot)} />
										</label>
										<label className="horosa-huangji-select-field horosa-heluo-switch-field">
											<span>显示节气影响</span>
											<Switch checked={!!this.state.cetianShowSolarTerm} onChange={(v)=>this.setState({ cetianShowSolarTerm: v ? 1 : 0 }, this.clickPlot)} />
										</label>
									</>
								) : null}
								<div className="horosa-cetian-settings-hint">算法/农历/正曜为排盘设置；显示开关默认全显，切「原法」后另有五行局/四化/飞星/节气可调。</div>
							</>
						) : null}
						{this.config.serviceKey === 'shaozi' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>刻数</span>
									<Select value={this.state.ke} onChange={(value)=>this.setState({ ke: value })}>
										{['初刻', '二刻', '三刻', '四刻', '五刻', '六刻', '七刻', '八刻'].map((item)=><Option value={item} key={item}>{item}</Option>)}
									</Select>
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>64钥匙细调</span>
									<Select value={this.state.useKey} onChange={(value)=>this.setState({ useKey: value })}>
										<Option value="1">启用</Option>
										<Option value="0">关闭</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>四柱覆写</span>
									<Select value={this.state.pillarOverride} onChange={(value)=>this.setState({ pillarOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动覆写</Option>
									</Select>
								</label>
								{this.renderPillarOverrideFields()}
							</>
						) : null}
						{this.config.serviceKey === 'canping' ? (
							<label className="horosa-huangji-select-field is-wide">
								<span>取法</span>
								<Select value={this.state.canpingMethod} onChange={(value)=>this.setState({ canpingMethod: value })}>
									<Option value="ming">明法（月支反向）</Option>
									<Option value="gu">古法（八字日支）</Option>
								</Select>
							</label>
						) : null}
						{this.config.serviceKey === 'heluo' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>取数法</span>
										<Select value={this.state.heluoZiShu} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ heluoZiShu: value })}>
											<Option value="pair">成对全取</Option>
											<Option value="single">每支取一</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>五寄中宫</span>
										<Select value={this.state.heluoJiGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ heluoJiGong: value })}>
											<Option value="manualSanYuan">三元表</Option>
											<Option value="legacy">旧法·性别</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>取化工法</span>
										<Select value={this.state.heluoQuHuaGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ heluoQuHuaGong: value })}>
											<Option value="tuWangKunGen">土王寄坤艮</Option>
											<Option value="siFangBoOnly">直取四方伯</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>纯乾坤落爻</span>
										<Select value={this.state.heluoPureGanKun} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ heluoPureGanKun: value })}>
											<Option value="current">通行</Option>
											<Option value="alt">抄本异</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>流年次步</span>
										<Select value={this.state.heluoLiunianStep2} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ heluoLiunianStep2: value })}>
											<Option value="ying">应爻法</Option>
											<Option value="sequential">顺行</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>三至尊卦</span>
										<Switch checked={this.state.heluoZhiZun} onChange={(v)=>this.setState({ heluoZhiZun: v })} />
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>流月列流日</span>
										<Switch checked={this.state.heluoShowLiuRi} onChange={(v)=>this.setState({ heluoShowLiuRi: v })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>纪年基准（黄帝纪元差，默认 2697）</span>
										<InputNumber min={0} max={16799} value={parseInt(this.state.heluoHuangdiOffset, 10) || 2697} onChange={(v)=>this.setState({ heluoHuangdiOffset: `${v || 2697}` })} />
									</label>
									<div className="horosa-cetian-settings-hint horosa-heluo-diverge-hint">诸法分歧：默认取「成对全取 · 三元表」（古本/经典主流）。改设置即时重排先后天卦、元堂图、旺相休囚死、十吉与纪年。占事卦/日课本轮未开，命卦为唯一用途。</div>
								</>
							) : null}
							{this.config.serviceKey === 'zhengchuan' ? (
									<>
										<label className="horosa-huangji-select-field is-wide">
											<span>流派</span>
											<Select value={this.state.zhengchuanSchool} onChange={(value)=>this.setState({ zhengchuanSchool: value })}>
												{Object.keys(ZHENGCHUAN_SCHOOL_LABEL).map((k)=>(
													<Option key={k} value={k}>{ZHENGCHUAN_SCHOOL_LABEL[k]}</Option>
												))}
											</Select>
										</label>
										{this.state.zhengchuanSchool === 'tieban' ? (
											<label className="horosa-huangji-select-field is-wide">
												<span>求测时辰（干支，留空取本人时柱）</span>
												<Input value={this.state.zhengchuanAskGz} maxLength={2} placeholder="如 丙辰"
													onChange={(e)=>this.setState({ zhengchuanAskGz: e.target.value })} />
											</label>
										) : null}
										{this.state.zhengchuanSchool === 'shaozi' ? (
											<>
												<label className="horosa-huangji-select-field">
													<span>父生我时年龄</span>
													<InputNumber min={12} max={99} value={parseInt(this.state.zhengchuanFatherAge, 10) || 27}
														onChange={(v)=>this.setState({ zhengchuanFatherAge: `${v || 27}` })} />
												</label>
												<label className="horosa-huangji-select-field">
													<span>母生我时年龄</span>
													<InputNumber min={12} max={99} value={parseInt(this.state.zhengchuanMotherAge, 10) || 26}
														onChange={(v)=>this.setState({ zhengchuanMotherAge: `${v || 26}` })} />
												</label>
												<label className="horosa-huangji-select-field">
													<span>元运（先天命卦余五特例）</span>
													<Select value={this.state.zhengchuanYuan} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanYuan: value })}>
														<Option value="shang">上元</Option>
														<Option value="zhong">中元</Option>
														<Option value="xia">下元</Option>
													</Select>
												</label>
											</>
										) : null}
										{this.state.zhengchuanSchool === 'dading' ? this.renderDadingYearFields() : null}
										{this.state.zhengchuanSchool === 'liuqin' ? (
											<>
											<label className="horosa-huangji-select-field">
												<span>演算时辰（留空取本人时支）</span>
												<Select value={this.state.zhengchuanAskHourZhi} dropdownMatchSelectWidth={false}
													onChange={(value)=>this.setState({ zhengchuanAskHourZhi: value, zhengchuanEnv: '' })}>
													<Option value="">（取本人时支）</Option>
													{['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map((z)=>(
														<Option key={z} value={z}>{z}时{'卯辰巳午未申'.indexOf(z) >= 0 ? '（白天·天四象）' : '（昼夜·地四象）'}</Option>
													))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>演算时天象</span>
												<Select value={this.state.zhengchuanEnv} dropdownMatchSelectWidth={false}
													onChange={(value)=>this.setState({ zhengchuanEnv: value })}>
													<Option value="">（按时辰取首项）</Option>
													{('卯辰巳午未申'.indexOf(this.state.zhengchuanAskHourZhi) >= 0
														? [['晴','晴'],['陰','阴'],['雨','雨'],['雪','雪']]
														: [['明','明（见月光）'],['晦','晦（无月光）'],['雨','雨'],['雪','雪']]
													).map(([v, t])=>(<Option key={v} value={v}>{t}</Option>))}
												</Select>
											</label>
											</>
										) : null}
										{this.state.zhengchuanSchool === 'xinyi' ? (
											<>
											<label className="horosa-huangji-select-field">
												<span>查询项目</span>
												<Select value={this.state.zhengchuanItem} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanItem: value })}>
													{['父母','兄弟','姻緣','子孫','官祿','疾病'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>声音</span>
												<Select value={this.state.zhengchuanSound} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanSound: value })}>
													{['日','月','星','辰','水','火','土','石','平','上','去','入','開','發','收','閉'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>刻数</span>
												<Select value={this.state.zhengchuanKe} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanKe: value })}>
													{['一刻','二刻','三刻','四刻','五刻','六刻','七刻','八刻'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>八宫</span>
												<Select value={this.state.zhengchuanGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanGong: value })}>
													{['乾','兌','離','震','巽','坎','艮','坤'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>性情项 · 地支</span>
												<Select value={this.state.zhengchuanXqZhi} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanXqZhi: value })}>
													{['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>性情项 · 余数</span>
												<Select value={this.state.zhengchuanXqYushu} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ zhengchuanXqYushu: value })}>
													{Array.from({ length: 12 }, (_, i)=>`${i + 1}`).map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											</>
										) : null}
										<div className="horosa-cetian-settings-hint horosa-heluo-diverge-hint">
											{this.state.zhengchuanSchool === 'xinyi'
												? '本支古籍只出部分口诀与部分图表，未出起数入口（由生辰求声音／卦气／余数之法全未载），故据实作查询层：自择项目与声音即出条文号，不作自动推算。其条文正文亦未载，只出号。'
												: (this.state.zhengchuanSchool === 'liuqin'
													? '本支配十二宫与遁甲盘演六亲属相、妻室姓氏。改设置即时重排中右栏与 AI 快照。古籍未载之格（心法上卦须秘咒／成数序须卦谱／动爻落阴支之遁法）显式标缺，不臆补。'
													: '三支同出一系：大定数为条文类神数之底层，铁板与邵子各据其上另立条文体系。改设置即时重排中右栏与 AI 快照。古籍原缺之格显式标「原缺」，不外推。')}
										</div>
									</>
								) : null}
							{this.config.serviceKey === 'yizhangjing' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>顺逆规则</span>
										<Select value={this.state.yizhangjingShunni} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingShunni: value })}>
											<Option value="yangNanYinNv">阳男阴女</Option>
											<Option value="menShunNvNi">男顺女逆</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>命宫定法</span>
										<Select value={this.state.yizhangjingMingGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingMingGong: value })}>
											<Option value="shiShang">时上起命</Option>
											<Option value="shuZhiMao">数至卯</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>大限运长</span>
										<Select value={this.state.yizhangjingDayunLen} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingDayunLen: value })}>
											<Option value="7">一宫7年</Option>
											<Option value="10">一宫10年</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>大限起运</span>
										<Select value={this.state.yizhangjingStartAge} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingStartAge: value })}>
											<Option value="mi">秘传起运</Option>
											<Option value="age1">1岁连续</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>小限起宫</span>
										<Select value={this.state.yizhangjingXiaoStart} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingXiaoStart: value })}>
											<Option value="ri">日柱宫</Option>
											<Option value="yue">月柱宫</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>流年十二神</span>
										<Select value={this.state.yizhangjingFlowSet} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingFlowSet: value })}>
											<Option value="A">甲组·太阳系</Option>
											<Option value="B">乙组·六合系</Option>
											<Option value="C">丙组·岁破系</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>重犯口诀</span>
										<Select value={this.state.yizhangjingChongfan} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingChongfan: value })}>
											<Option value="alpha">常见组</Option>
											<Option value="beta">异传组</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>定月法</span>
										<Select value={this.state.yizhangjingDingYue} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ yizhangjingDingYue: value })}>
											<Option value="nongli">农历月</Option>
											<Option value="jieqi">节气月</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>神煞合参层</span>
										<Switch checked={this.state.yizhangjingShensha} onChange={(v)=>this.setState({ yizhangjingShensha: v })} />
									</label>
									<div className="horosa-cetian-settings-hint">默认「秘传」（阳男阴女·大限7年·秘传起运·时上起命·日柱小限·甲组流年）。改任一开关即时重排四柱四宫、命宫、大限、流年与断语。神煞为合参层（非原生），默认关。</div>
								</>
							) : null}
							{this.config.serviceKey === 'tieban' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>算法</span>
									<Select value={this.state.tiebanMethod} onChange={(value)=>this.setState({ tiebanMethod: value })}>
										<Option value="kunji">扣入法</Option>
										<Option value="suanpan">算盘打数</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>起运年龄</span>
									<InputNumber min={0} max={120} value={this.state.tiebanStartAge} onChange={(value)=>this.setState({ tiebanStartAge: value || 0 })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>大运步数</span>
									<InputNumber min={1} max={12} value={this.state.tiebanDayunSteps} onChange={(value)=>this.setState({ tiebanDayunSteps: value || 8 })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>流派</span>
									<Select value={this.state.tiebanSchool} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ tiebanSchool: value })}>
										<Option value="south">南派(岭南)</Option>
										<Option value="north">北派(中州)</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>刻制</span>
									<Select value={this.state.tiebanKeSystem} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ tiebanKeSystem: value })}>
										<Option value="qing8">清八刻</Option>
										<Option value="ming100">明百刻</Option>
										<Option value="dou12">十二刻斗宫</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>考刻刻位</span>
									<Select value={this.state.tiebanKe} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ tiebanKe: value })}>
										{[1, 2, 3, 4, 5, 6, 7, 8].map((k)=>(<Option key={k} value={k}>{['初', '二', '三', '四', '五', '六', '七', '八'][k - 1]}刻</Option>))}
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>双胞胎分</span>
									<Select value={this.state.tiebanTwinFen} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ tiebanTwinFen: value })}>
										<Option value="off">不分</Option>
										<Option value="shang">上分</Option>
										<Option value="zhong">中分</Option>
										<Option value="xia">下分</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field horosa-heluo-switch-field">
									<span>过房/养子</span>
									<Switch checked={this.state.tiebanGuofang} onChange={(v)=>this.setState({ tiebanGuofang: v })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>四柱覆写</span>
									<Select value={this.state.pillarOverride} onChange={(value)=>this.setState({ pillarOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动覆写</Option>
									</Select>
								</label>
								{this.renderPillarOverrideFields()}
								<label className="horosa-huangji-select-field">
									<span>父亲生年</span>
									<InputNumber min={1} max={16799} value={this.state.fatherBirthYear} onChange={(value)=>this.setState({ fatherBirthYear: value })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>父亲卒年</span>
									<InputNumber min={1} max={16799} value={this.state.fatherDeathYear} onChange={(value)=>this.setState({ fatherDeathYear: value })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>母亲生年</span>
									<InputNumber min={1} max={16799} value={this.state.motherBirthYear} onChange={(value)=>this.setState({ motherBirthYear: value })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>母亲卒年</span>
									<InputNumber min={1} max={16799} value={this.state.motherDeathYear} onChange={(value)=>this.setState({ motherDeathYear: value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>兄弟信息</span>
									<Input value={this.state.siblingsInfo} placeholder="如：兄弟二人" onChange={(event)=>this.setState({ siblingsInfo: event.target.value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>婚姻状况</span>
									<Input value={this.state.maritalStatus} placeholder="如：已婚" onChange={(event)=>this.setState({ maritalStatus: event.target.value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>子女信息</span>
									<Input value={this.state.childrenInfo} placeholder="如：二子一女" onChange={(event)=>this.setState({ childrenInfo: event.target.value })} />
								</label>
							</>
						) : null}
							{this.config.serviceKey === 'fendjing' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>两头钳</span>
									<Select value={this.state.fendjingStemOverride} onChange={(value)=>this.setState({ fendjingStemOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动指定</Option>
									</Select>
								</label>
								{this.state.fendjingStemOverride === '1' ? (
									<>
										<label className="horosa-huangji-select-field">
											<span>年干</span>
											<Select value={this.state.fendjingYearStem} onChange={(value)=>this.setState({ fendjingYearStem: value })}>
												{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span>时干</span>
											<Select value={this.state.fendjingHourStem} onChange={(value)=>this.setState({ fendjingHourStem: value })}>
												{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
											</Select>
										</label>
									</>
									) : null}
								</>
							) : null}
							{this.config.serviceKey === 'beiji' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>刻法</span>
										<Select value={this.state.beijiKeMode} onChange={(value)=>this.setState({ beijiKeMode: value })}>
											<Option value="auto">自动换算</Option>
											<Option value="manual">手动指定</Option>
										</Select>
									</label>
									{this.state.beijiKeMode === 'manual' ? (
										<label className="horosa-huangji-select-field">
											<span>刻</span>
											<Select value={this.state.beijiKe} onChange={(value)=>this.setState({ beijiKe: value })}>
												{BEIJI_KE_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
											</Select>
										</label>
									) : null}
									<label className="horosa-huangji-select-field is-wide">
										<span>条文码</span>
										<Input
											value={this.state.beijiLookupCode}
											maxLength={4}
											placeholder="如：1111"
											onChange={(event)=>this.setState({ beijiLookupCode: event.target.value.replace(/\D/g, '').slice(0, 4) })}
										/>
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>关键词</span>
										<Input
											value={this.state.beijiKeyword}
											placeholder="如：属鼠、再婚"
											onChange={(event)=>this.setState({ beijiKeyword: event.target.value })}
										/>
									</label>
								</>
							) : null}
							{this.config.serviceKey === 'nanji' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>起盘方式</span>
										<Select value={this.state.nanjiMode} onChange={(value)=>this.setState({ nanjiMode: value })}>
											<Option value="solar">公历精算</Option>
											<Option value="manual">手动古法</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>宫部</span>
										<Select value={this.state.nanjiSection} onChange={(value)=>this.setState({ nanjiSection: value })}>
											{NANJI_SECTION_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>建除</span>
										<Select value={this.state.nanjiJianchu} onChange={(value)=>this.setState({ nanjiJianchu: value })}>
											{NANJI_JIANCHU_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>二十八宿</span>
										<Select value={this.state.nanjiXiu} onChange={(value)=>this.setState({ nanjiXiu: value })}>
											{NANJI_XIU_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>密码</span>
										<Select value={this.state.nanjiPasswordCode} onChange={(value)=>this.setState({ nanjiPasswordCode: value })}>
											{NANJI_PASSWORD_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>星图</span>
										<Select value={this.state.nanjiChart} onChange={(value)=>this.setState({ nanjiChart: value })}>
											{NANJI_CHART_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>推演宫</span>
										<Select value={this.state.nanjiPalace} onChange={(value)=>this.setState({ nanjiPalace: value })}>
											{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>宿度</span>
										<InputNumber min={0} max={30} step={0.5} value={this.state.nanjiDegree} onChange={(value)=>this.setState({ nanjiDegree: value || 1 })} />
									</label>
									{this.state.nanjiMode === 'manual' ? (
										<>
											<label className="horosa-huangji-select-field">
												<span>历年</span>
												<InputNumber min={1} max={16799} value={this.state.nanjiLunarYear} onChange={(value)=>this.setState({ nanjiLunarYear: value || 2026 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>节月</span>
												<InputNumber min={1} max={12} value={this.state.nanjiSolarMonth} onChange={(value)=>this.setState({ nanjiSolarMonth: value || 1 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>日</span>
												<InputNumber min={1} max={31} value={this.state.nanjiDay} onChange={(value)=>this.setState({ nanjiDay: value || 1 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>时支</span>
												<Select value={this.state.nanjiHourZhi} onChange={(value)=>this.setState({ nanjiHourZhi: value })}>
													{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>立春</span>
												<Select value={this.state.nanjiAfterLichun} onChange={(value)=>this.setState({ nanjiAfterLichun: value })}>
													<Option value="1">立春后</Option>
													<Option value="0">立春前</Option>
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>日干</span>
												<Select value={this.state.nanjiDayGan} onChange={(value)=>this.setState({ nanjiDayGan: value })}>
													<Option value="">自动</Option>
													{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>日支</span>
												<Select value={this.state.nanjiDayZhi} onChange={(value)=>this.setState({ nanjiDayZhi: value })}>
													<Option value="">自动</Option>
													{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
										</>
									) : null}
								</>
							) : null}
							{this.config.serviceKey === 'chunzi' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>刻法</span>
										<Select value={this.state.chunziKeMode} onChange={(value)=>this.setState({ chunziKeMode: value })}>
											<Option value="auto">自动换算</Option>
											<Option value="manual">手动指定</Option>
											<Option value="none">不取刻数</Option>
										</Select>
									</label>
									{this.state.chunziKeMode === 'manual' ? (
										<label className="horosa-huangji-select-field">
											<span>刻数</span>
											<Select value={this.state.chunziKe} onChange={(value)=>this.setState({ chunziKe: value })}>
												{CHUNZI_KE_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
											</Select>
										</label>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>月日匹配</span>
										<Select value={this.state.chunziLunarMode} onChange={(value)=>this.setState({ chunziLunarMode: value })}>
											<Option value="auto">随当前日期</Option>
											<Option value="manual">手动月日</Option>
											<Option value="none">关闭</Option>
										</Select>
									</label>
									{this.state.chunziLunarMode === 'manual' ? (
										<>
											<label className="horosa-huangji-select-field">
												<span>农历月</span>
												<InputNumber min={1} max={12} value={this.state.chunziLunarMonth} onChange={(value)=>this.setState({ chunziLunarMonth: value || 1 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>农历日</span>
												<InputNumber min={1} max={30} value={this.state.chunziLunarDay} onChange={(value)=>this.setState({ chunziLunarDay: value || 1 })} />
											</label>
										</>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>宿名</span>
										<Select value={this.state.chunziMansion} onChange={(value)=>this.setState({ chunziMansion: value })}>
											{CHUNZI_MANSION_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>时辰</span>
										<Select value={this.state.chunziHourBranch} onChange={(value)=>this.setState({ chunziHourBranch: value })}>
											{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>显示数量</span>
										<Select value={this.state.chunziResultLimit} onChange={(value)=>this.setState({ chunziResultLimit: value })}>
											{CHUNZI_RESULT_LIMIT_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>条文代码</span>
										<Input value={this.state.chunziLookupCode} placeholder="可批量：毕龙6巳、室巨9未" onChange={(event)=>this.setState({ chunziLookupCode: event.target.value })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>关键词</span>
										<Input value={this.state.chunziKeyword} placeholder="如：先去父、妻宫" onChange={(event)=>this.setState({ chunziKeyword: event.target.value })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>多标签</span>
										<Input value={this.state.chunziTags} placeholder="逗号分隔，如：先去父,石皮" onChange={(event)=>this.setState({ chunziTags: event.target.value })} />
									</label>
								</>
							) : null}
							{this.config.serviceKey === 'xianqin' ? (
								<div className="horosa-kinastro-xianqin-options">
								<div className="horosa-kinastro-xianqin-option-row is-method">
									<label className="horosa-huangji-select-field">
										<span>性别</span>
										<Select value={normBinaryGender(this.state.gender)} dropdownMatchSelectWidth={false} onChange={(value)=>this.setState({ gender: value })}>
											<Option value="1">男</Option>
											<Option value="0">女</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>入式历法</span>
										<Select value={this.state.calendarMode} onChange={(value)=>this.setState({ calendarMode: value })}>
											<Option value="autoLunar">自动换算农历</Option>
											<Option value="manualLunar">手动农历</Option>
											<Option value="solarAsLunar">公历数值入式</Option>
										</Select>
									</label>
								</div>
								<div className="horosa-kinastro-xianqin-option-row is-lunar">
									<label className="horosa-huangji-select-field">
										<span>农历年</span>
										<InputNumber min={1} max={16799} value={this.state.lunarYear} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setState({ lunarYear: value || 2026 })} />
									</label>
									<label className="horosa-huangji-select-field">
										<span>农历月</span>
										<InputNumber min={1} max={12} value={this.state.lunarMonth} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setState({ lunarMonth: value || 1 })} />
									</label>
									<label className="horosa-huangji-select-field">
										<span>农历日</span>
										<InputNumber min={1} max={30} value={this.state.lunarDay} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setState({ lunarDay: value || 1 })} />
									</label>
								</div>
								<YanQinControls />
							</div>
						) : null}
					</div>
				</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
				</div>
			</div>
		);
	}

	renderMetaGrid(items){
		return (
			<div className="horosa-huangji-meta-grid horosa-kinastro-meta-grid">
				{items.map((item)=>(
					<div key={item.label}>
						<span>{item.label}</span>
						<strong>{fmtValue(item.value)}</strong>
					</div>
				))}
			</div>
		);
	}

	renderShaoziCenter(pan){
		const sz = pan.shaozi || {};
		const full = pan.full || {};
		const key = full.key || {};
		const pillars = pan.pillars || [];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-shaozi-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">邵子神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '条文号', value: sz.tiaowenId },
					{ label: '集', value: sz.collection },
					{ label: '卦名', value: sz.guaName || full.gua },
					{ label: '基础数', value: full.base_number },
					{ label: '钥匙', value: key['名稱'] },
					{ label: '刻数', value: pan.ke },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>四位起数</span>
						<strong>{fmtValue(sz.yearDigit)} / {fmtValue(sz.monthDigit)} / {fmtValue(sz.dayDigit)} / {fmtValue(sz.hourDigit)}</strong>
						<p>{fmtValue(sz.note)}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>条文</span>
						<strong>{fmtValue(sz.tiaowenText)}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>64钥匙</span>
						<strong>{fmtValue(key['說明'])}</strong>
						<p>{fmtValue(key['特殊事項'])}</p>
					</div>
				</div>
			</div>
		);
	}

	renderTiebanCenter(pan){
		const tieban = pan.tieban || {};
		const kunji = tieban.kunji || {};
		const suanpan = tieban.suanpan || {};
		const isSuanpan = tieban.method === 'suanpan';
		const pillars = pan.pillars || [];
		const primaryText = isSuanpan ? textValue(suanpan.tiaowen) : textValue(kunji.tiaowen_data || kunji.verse);
		const palaceRows = Object.keys(kunji.palace_verses || {}).slice(0, 6).map((name)=>{
			const item = kunji.palace_verses[name] || {};
			return {
				name: name.replace(/[宮宫]$/, ''),
				branch: item.branch,
				number: item.number,
				verse: item.verse,
			};
		});
		const dayun = tieban.dayun || [];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-tieban-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">铁板神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '算法', value: tieban.methodLabel },
					{ label: isSuanpan ? '算盘总数' : '铁板号码', value: isSuanpan ? suanpan.total_number : kunji.tieban_number },
					{ label: isSuanpan ? '条文编号' : '坤集条文号', value: isSuanpan ? suanpan.tiaowen_key : kunji.tiaowen_number },
					{ label: isSuanpan ? '五部' : '命宫', value: isSuanpan ? suanpan.department : kunji.ming_palace },
					{ label: isSuanpan ? '纳音' : '身宫', value: isSuanpan ? suanpan.nayin : kunji.shen_palace },
					{ label: isSuanpan ? '岁君加数' : '刻分', value: isSuanpan ? suanpan.suijun_add : `${fmtValue(kunji.ke_label)} / ${fmtValue(kunji.fen)}` },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid horosa-kinastro-tieban-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>{isSuanpan ? '算盘结构' : '命身刻分'}</span>
						<strong>{isSuanpan ? `${fmtValue(suanpan.stem_sum)} + ${fmtValue(suanpan.branch_sum)} + ${fmtValue(suanpan.suijun_add)}` : `${fmtValue(kunji.ming_palace)} / ${fmtValue(kunji.shen_palace)} / ${fmtValue(kunji.wuxing_ju)}`}</strong>
						<p>{isSuanpan ? fmtValue(suanpan.note) : `河洛数 ${fmtValue(kunji.he_luo_number)}，扣入 ${fmtValue(kunji.kunji_tiangan)}`}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card is-large">
						<span>条文</span>
						<strong>{primaryText}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>大运</span>
						<strong>{dayun.slice(0, 3).map((item)=>fmtValue(item.age || item.dayun_number)).filter((item)=>item !== '—').join(' / ') || '—'}</strong>
						<p>{dayun.length ? textValue(dayun[0].tiaowen) : '—'}</p>
					</div>
				</div>
				{palaceRows.length ? (
					<div className="horosa-kinastro-tieban-palace-strip">
						{palaceRows.map((item)=>(
							<div key={`${item.name}_${item.branch}`}>
								<span>{item.name} {fmtValue(item.branch)}</span>
								<strong>{fmtValue(item.number)}</strong>
								<p>{fmtValue(item.verse)}</p>
							</div>
						))}
					</div>
				) : null}
				{this.renderTiebanFramework(pan)}
			</div>
		);
	}

	tiebanFrameworkSuffix(pan){
		if(this.config.serviceKey !== 'tieban' || !pan){ return ''; }
		try{ return buildTiebanFrameworkSnapshot(this.tiebanFrameworkOf(pan)) || ''; }catch(e){ return ''; }
	}

	renderTiebanFramework(pan){
		const fw = this.tiebanFrameworkOf(pan);
		if(!fw){ return null; }
		const keLabel = ['初', '二', '三', '四', '五', '六', '七', '八'];
		const twinLabel = { off: '', shang: '·上分', zhong: '·中分', xia: '·下分' }[this.state.tiebanTwinFen] || '';
		return (
			<div className="horosa-kinastro-tieban-framework">
				<div className="horosa-kinastro-tieban-fw-head">
					<h3>框架推演</h3>
					<span className="horosa-kinastro-tieban-fw-tags">{fw.schoolInfo.label} · {fw.keSystemInfo.label} · {fw.sanyuanLabel}{twinLabel}{this.state.tiebanGuofang ? ' · 过房对条' : ''}</span>
				</div>
				<div className="horosa-kinastro-tieban-fw-grid">
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">考刻六亲（年父母·月兄弟·日夫妻·时子女）</div>
						{fw.liuQin.map((q)=>(
							<div className="horosa-huangji-info-row" key={q.pillar}><span>{q.label}·{q.liuqin}</span><strong>{fmtValue(q.ganzhi)}{q.shengxiao ? `（属${q.shengxiao}）` : ''} · 太玄 {fmtValue(q.taixuanGan)}/{fmtValue(q.taixuanZhi)}</strong></div>
						))}
						<div className="horosa-huangji-info-row"><span>八刻天干</span><strong className="horosa-kinastro-tieban-keline">{fw.eightKe.map((k)=>(<em key={k.ke} className={k.active ? 'is-active' : ''}>{keLabel[k.ke - 1]}{k.gan}</em>))}</strong></div>
						{fw.ju ? <div className="horosa-huangji-info-row"><span>九十六局</span><strong>{fw.ju.label} · {fw.keSystemInfo.juStruct}</strong></div> : null}
					</div>
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">八卦滚（{fw.baseGua.name}起 · {fw.roll.seq.length}卦{fw.roll.verseCount}条结构）</div>
						<div className="horosa-kinastro-tieban-bagua-strip">
							{fw.roll.seq.map((g)=>(
								<div className="horosa-kinastro-tieban-bagua-item" key={g.idx}>{this.renderTiebanGua(g.lines)}<span>{g.name}</span></div>
							))}
						</div>
						<div className="horosa-huangji-info-row"><span>三元取数</span><strong>{fw.sanyuanLabel} 权重{fw.roll.weight} · 变爻 {fw.roll.bianYao9.pos}·{fw.roll.bianYao9.ying}／{fw.roll.bianYao6.pos}爻</strong></div>
						<div className="horosa-kinastro-tieban-fw-note">精确条文号由坤集密码表定（秘传），框架层只推卦象。</div>
					</div>
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">批断顺序</div>
						<div className="horosa-kinastro-tieban-piduan">
							{fw.piduan.map((pp, i)=>(<span className="horosa-kinastro-tieban-piduan-step" key={pp.key}>{i + 1}.{pp.name}<em>{pp.pillar}</em></span>))}
						</div>
					</div>
				</div>
			</div>
		);
	}

	tiebanFrameworkOf(pan){
		const pillars = pan.pillars || [];
		const gz = (k, i)=>{ const byKey = pillars.find((pp)=>pp.key === k); return (byKey && byKey.ganzhi) || (pillars[i] && pillars[i].ganzhi) || ''; };
		const fourPillars = { year: gz('year', 0), month: gz('month', 1), day: gz('day', 2), hour: gz('hour', 3) };
		const birthYear = parseYearFromDateStr(`${pan.dateStr || ''}`) || 0;
		return buildTiebanFramework(fourPillars, { school: this.state.tiebanSchool, keSystem: this.state.tiebanKeSystem, ke: this.state.tiebanKe, gender: this.state.gender, birthYear });
	}

	renderTiebanGua(lines){
		const rows = [];
		for(let p = 6; p >= 1; p -= 1){
			const yang = lines[p - 1] === 1;
			rows.push(<span className="horosa-kinastro-tieban-yao" key={p}>{yang ? <i className="is-yang" /> : <i className="is-yin"><b /><b /></i>}</span>);
		}
		return <div className="horosa-kinastro-tieban-gua">{rows}</div>;
	}

	renderTiebanFrameworkTab(){
		const pan = this.state.pan;
		const fw = pan ? this.tiebanFrameworkOf(pan) : null;
		if(!fw){ return <div className="horosa-huangji-empty">起盘后显示框架参考</div>; }
		const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		return (
			<>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">流派 · 刻制</div>
					<div className="horosa-huangji-info-row"><span>流派</span><strong>{fw.schoolInfo.label}</strong></div>
					<div className="horosa-huangji-info-row"><span>主算柱</span><strong>{fw.schoolInfo.zhuGan}</strong></div>
					<div className="horosa-huangji-info-row"><span>卦数偏好</span><strong>{fw.schoolInfo.guaPref} · 取数 {fw.schoolInfo.quShu}</strong></div>
					<div className="horosa-huangji-info-row"><span>条文</span><strong>{fw.schoolInfo.tiaowen}（{fw.schoolInfo.note}）</strong></div>
					<div className="horosa-huangji-info-row"><span>刻制</span><strong>{fw.keSystemInfo.label} · {fw.keSystemInfo.note}</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">太玄配数表（相合干支同数）</div>
					<div className="horosa-huangji-info-row"><span>天干</span><strong>{GAN.map((g)=>`${g}${fw.taixuanTable.gan[g]}`).join(' ')}</strong></div>
					<div className="horosa-huangji-info-row"><span>地支</span><strong>{ZHI.map((z)=>`${z}${fw.taixuanTable.zhi[z]}`).join(' ')}</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">九十六局（12时辰×8刻）</div>
					{fw.ju ? <div className="horosa-huangji-info-row"><span>本命</span><strong>{fw.ju.label}</strong></div> : null}
					<div className="horosa-huangji-info-row"><span>刻制定局</span><strong>{fw.keSystemInfo.juStruct}</strong></div>
					<div className="horosa-huangji-info-row"><span>结构</span><strong>96局给大运流年粗分类（好/坏/起伏），六亲精细到384爻</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">借用子系统（杂用诸法之零件）</div>
					{fw.subsystems.map((sub)=>(
						<div className="horosa-huangji-info-row" key={sub.key}><span>{sub.name}</span><strong>{sub.struct}<em style={{ display: 'block', fontStyle: 'normal', opacity: 0.6, fontSize: '11px', marginTop: '2px' }}>源 {sub.source} · {sub.use}</em></strong></div>
					))}
				</div>
			</>
		);
	}

	renderFendjingCenter(pan){
		const fendjing = pan.fendjing || {};
		const pillars = pan.pillars || [];
		const sections = fendjing.sections || {};
		const sectionCards = [
			{ key: 'foundation', title: '基业', value: sections.foundation },
			{ key: 'siblings', title: '兄弟', value: sections.siblings },
			{ key: 'conduct', title: '行藏', value: sections.conduct },
			{ key: 'marriage', title: '婚姻', value: sections.marriage },
			{ key: 'children', title: '子息', value: sections.children },
			{ key: 'harvest', title: '收成', value: sections.harvest },
		];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-fendjing-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">鬼谷分定经</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '两头钳', value: fendjing.twoGanKey },
					{ label: '年干', value: fendjing.yearStem },
					{ label: '时干', value: fendjing.hourStem },
					{ label: '命格', value: fendjing.minggeName },
					{ label: '来源', value: fendjing.stemOverride ? '手动指定' : '自动换算' },
					{ label: '组合库', value: fendjing.dataSize },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid horosa-kinastro-fendjing-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>判断</span>
						<strong>{fmtValue(fendjing.judgment)}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card is-large">
						<span>命格</span>
						<strong>{fmtValue(fendjing.minggeName)}</strong>
						<p>{fmtValue(fendjing.minggeText)}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>两头取象</span>
						<strong>{fmtValue(fendjing.twoGanKey)}</strong>
						<p>{fmtValue(fendjing.yearStem)}年干 · {fmtValue(fendjing.hourStem)}时干</p>
					</div>
				</div>
				<div className="horosa-kinastro-fendjing-verse-grid">
					{sectionCards.map((item)=>(
						<div key={item.key}>
							<span>{item.title}</span>
							<p>{fmtValue(item.value)}</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderBeijiCenter(pan){
		const beiji = pan.beiji || {};
		const queries = beiji.queries || [];
		const dayun = beiji.dayun || [];
		const family = (beiji.queryGroups && beiji.queryGroups.family) || queries.filter((item)=>['parents', 'siblings', 'first_wife_surname', 'remarriage_wife_surname', 'children'].includes(item.type));
		const fortune = (beiji.queryGroups && beiji.queryGroups.fortune) || queries.filter((item)=>['character', 'wealth', 'career', 'health'].includes(item.type));
		const queryCard = (item)=>(
			<div key={`${item.type}_${item.code}`}>
				<span>{fmtValue(item.label)}</span>
				<strong>{fmtValue(item.code)} · {fmtValue(item.palaceName)}宫{item.surname ? ` · 姓${fmtValue(item.surname)}` : ''}</strong>
				<p>{fmtValue(item.verse)}</p>
			</div>
		);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-beiji-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">北极神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '年干支', value: `${fmtValue(beiji.yearStem)}${fmtValue(beiji.yearBranch)}` },
					{ label: '生肖', value: beiji.yearShengxiao },
					{ label: '时辰', value: `${fmtValue(beiji.hourBranch)}时` },
					{ label: '刻', value: `${fmtValue(beiji.keValue)} · ${fmtValue(beiji.keLabel)}` },
					{ label: '刻法', value: beiji.keModeLabel },
					{ label: '条文库', value: beiji.verseCount },
					...(beiji.keMode === 'manual' ? [{ label: '自动刻', value: `${fmtValue(beiji.autoKeValue)} · ${fmtValue(beiji.autoKeLabel)}` }] : []),
				])}
				<div className="horosa-kinastro-beiji-core">
					<div className="horosa-shenyishu-pillar-card">
						<span>年干</span>
						<strong>{fmtValue(beiji.yearStem)}</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>年支</span>
						<strong>{fmtValue(beiji.yearBranch)}</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>时辰</span>
						<strong>{fmtValue(beiji.hourBranch)}时</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>刻分</span>
						<strong>{fmtValue(beiji.keLabel)}</strong>
					</div>
				</div>
				<div className="horosa-kinastro-beiji-query-grid">
					{family.slice(0, 4).map(queryCard)}
					{fortune.slice(0, 4).map(queryCard)}
				</div>
				<div className="horosa-kinastro-beiji-dayun-grid">
					{dayun.map((item)=>(
						<div key={`${item.index}_${item.code}`}>
							<span>{fmtValue(item.startAge)}-{fmtValue(item.endAge)}岁</span>
							<strong>{fmtValue(item.stemBranch)}</strong>
							<p>{fmtValue(item.code)} · {fmtValue(item.direction)}行</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderNanjiCenter(pan){
		const nanji = pan.nanji || {};
		const fp = nanji.fourPillars || {};
		const query = nanji.query || {};
		const palaceEntries = nanji.palaceEntries || [];
		const queryEntries = query.entries || [];
		const dayun = nanji.daYun || [];
		const primaryEntries = queryEntries.length ? queryEntries : palaceEntries.slice(0, 6);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-nanji-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">南极神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '宫部', value: nanji.palaceSection },
					{ label: '起盘方式', value: nanji.modeLabel },
					{ label: '年干阴阳', value: fp.yearYinyang },
					{ label: '条文库', value: nanji.verseCount },
					{ label: '查询密码', value: query.code },
					{ label: '命中数', value: query.count },
					{ label: '星图', value: nanji.divine && nanji.divine.chart },
					{ label: '推演宫', value: nanji.divine && nanji.divine.palace },
					{ label: '宿度', value: nanji.divine && nanji.divine.degree },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{[
						{ label: '年柱', value: fp.year },
						{ label: '月柱', value: fp.month },
						{ label: '日柱', value: fp.day },
						{ label: '时柱', value: fp.hour },
					].map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.label}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.value)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-nanji-entry-grid">
					{primaryEntries.slice(0, 6).map((item, idx)=>(
						<div key={`${item.rawSection || item.section}_${item.rawCode || item.code}_${idx}`}>
							<span>{fmtValue(item.section)} · {fmtValue(item.code)}</span>
							<strong>{fmtValue(item.verse)}</strong>
							<p>{fmtValue(item.comment)}</p>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-beiji-dayun-grid horosa-kinastro-nanji-dayun-grid">
					{dayun.map((item)=>(
						<div key={`${item.index}_${item.ganzhi}`}>
							<span>{fmtValue(item.startAge)}-{fmtValue(item.endAge)}岁</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
							<p>第{fmtValue(item.index)}运</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderChunziCenter(pan){
		const chunzi = pan.chunzi || {};
		const analysis = chunzi.analysis || {};
		const parents = analysis.parents || {};
		const spouse = analysis.spouse || {};
		const children = analysis.children || {};
		const verses = chunzi.verses || [];
		const renderVerse = (item, idx)=>(
			<div key={`${item.rawCode || item.code}_${idx}`}>
				<span>{fmtValue(item.code)} · {fmtValue(item.category)}宿</span>
				<strong>{[item.star, item.degree ? `${item.degree}度` : '', item.branch].map(fmtValue).filter((text)=>text && text !== '—').join(' · ') || '—'}</strong>
				<p>{fmtValue(item.verse)}</p>
			</div>
		);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-chunzi-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">蠢子数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '命造', value: chunzi.genderLabel },
					{ label: '刻法', value: chunzi.keModeLabel },
					{ label: '刻数', value: chunzi.keValueLabel },
					{ label: '月日匹配', value: chunzi.lunarModeLabel },
					{ label: '农历月日', value: chunzi.lunarText },
					{ label: '候选代码', value: (chunzi.codes || []).length },
					{ label: '显示数量', value: chunzi.resultLimit ? `${chunzi.resultLimit}条` : '' },
					{ label: '条文库', value: chunzi.verseCount },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{(chunzi.pillars || []).map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key || item.label}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-chunzi-analysis-grid">
					<div>
						<span>父母</span>
						<strong>{fmtValue({
							父属: parents.father,
							母属: parents.mother,
							父先亡: parents.father_first,
							母先亡: parents.mother_first,
						})}</strong>
					</div>
					<div>
						<span>妻宫</span>
						<strong>{fmtValue({
							属相: spouse.zodiac,
							侧室: spouse.concubine,
							再娶: spouse.remarriage,
						})}</strong>
					</div>
					<div>
						<span>子息</span>
						<strong>{fmtValue({
							数量: children.count,
							带石皮: children.stone_skin,
						})}</strong>
					</div>
					<div>
						<span>事业 / 特记</span>
						<strong>{fmtValue([analysis.career, analysis.conflicts, analysis.flags, analysis.longevity ? `寿元${analysis.longevity}岁` : ''])}</strong>
					</div>
				</div>
				<div className="horosa-kinastro-nanji-entry-grid horosa-kinastro-chunzi-verse-grid">
					{verses.length ? verses.slice(0, 6).map(renderVerse) : (
						<div>
							<span>候选条文</span>
							<strong>未命中</strong>
							<p>可改用手动代码、宿名或关键词检索补查。</p>
						</div>
					)}
				</div>
			</div>
		);
	}

	renderXianqinCenter(pan){
		const chart = pan.xianqin || {};
		const basic = chart.basic_info || {};
		const stars = chart.stars || {};
		const pattern = chart.pattern || {};
		const palaces = chart.palaces || {};
		const branchToPalace = {};
		(pan.palaceCards || []).forEach((card)=>{
			const branchIdx = BRANCH_INDEX[card.branch];
			if(branchIdx !== undefined){
				branchToPalace[branchIdx] = card;
			}
		});
		const renderCell = (item)=>{
			const palace = branchToPalace[item.branch] || {};
			const branch = palace.branch || Object.keys(BRANCH_INDEX).find((key)=>BRANCH_INDEX[key] === item.branch) || '—';
			const palaceName = palace.name || getXianqinPalaceNameByBranch(chart, branch) || branch;
			const palaceStars = (palace.stars && palace.stars.length)
				? palace.stars
				: [getXianqinPalaceStarEntry(chart, palaceName)].filter(Boolean);
			const isTai = (palaces.tai_gong || {}).branch === branch;
			const isMing = (palaces.ming_gong || {}).branch === branch;
			const isShen = (palaces.shen_gong || {}).branch === branch;
			const marks = [
				isTai ? '胎' : '',
				isMing ? '命' : '',
				isShen ? '身' : '',
			].filter(Boolean);
			return (
				<div
					className={`horosa-kinastro-cetian-cell horosa-kinastro-xianqin-cell${isTai ? ' is-tai' : ''}${isMing ? ' is-ming' : ''}${isShen ? ' is-shen' : ''}`}
					key={`${palace.name || branch}_${item.branch}`}
					style={{ gridRow: item.row, gridColumn: item.col }}
				>
					<div className="horosa-kinastro-cetian-cell-top">
						<span>{branch}</span>
						<em>{marks.join(' / ')}</em>
					</div>
					<strong>{fmtValue(palaceName || '—')}</strong>
					<div className="horosa-kinastro-cetian-starline is-main">{fmtValue(palaceStars[0])}</div>
					<div className="horosa-kinastro-cetian-starline is-aux">{fmtValue(palaceStars.slice(1))}</div>
				</div>
			);
		};
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-xianqin-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">万化仙禽</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				<div className="horosa-kinastro-cetian-grid horosa-kinastro-xianqin-grid">
					{TWELVE_PALACE_LAYOUT.map(renderCell)}
					<div className="horosa-kinastro-cetian-center horosa-kinastro-xianqin-center">
						<h3>万化仙禽</h3>
						<p>{fmtValue(pan.calendarModeLabel)} · {fmtValue(basic.year)}年{fmtValue(basic.month)}月{fmtValue(basic.day)}日</p>
						<div className="horosa-kinastro-cetian-center-grid">
							<span>三元<strong>{fmtValue(basic.san_yuan)}</strong></span>
							<span>昼夜<strong>{fmtValue(basic.day_night)}</strong></span>
							<span>胎星<strong>{fmtValue(stars.tai_xing)}</strong></span>
							<span>命星<strong>{fmtValue(stars.ming_xing)}</strong></span>
						</div>
						<div className="horosa-kinastro-cetian-sihua">
							<span>身星 {fmtValue(stars.shen_xing)}</span>
							<span>{fmtValue(pattern.grade)}</span>
						</div>
						<small>{fmtValue(pattern.reason)}</small>
					</div>
				</div>
			</div>
		);
	}

	renderCetianCenter(pan){
		const chart = pan.cetian || {};
		const branchToPalace = {};
		(chart.palaces || []).forEach((palace)=>{
			branchToPalace[palace.branch] = palace;
		});
		const renderCell = (item)=>{
			const palace = branchToPalace[item.branch] || {};
			const isMing = palace.branch === chart.ming_gong_branch;
			const isShen = palace.branch === chart.shen_gong_branch;
			return (
				<div
					className={`horosa-kinastro-cetian-cell${isMing ? ' is-ming' : ''}${isShen ? ' is-shen' : ''}`}
					key={`${palace.name}_${item.branch}`}
					style={{ gridRow: item.row, gridColumn: item.col }}
				>
					<div className="horosa-kinastro-cetian-cell-top">
						<span>{fmtValue(palace.branch_name)}</span>
						<em>{fmtValue(palace.da_xian)}</em>
					</div>
					<strong>{fmtValue(palace.name)}</strong>
					<div className="horosa-kinastro-cetian-starline is-main">{fmtValue(palace.stars)}</div>
					<div className="horosa-kinastro-cetian-starline is-aux">{fmtValue(palace.aux_stars)}</div>
					<small className="horosa-kinastro-cetian-brightness">{Object.keys(palace.brightness || {}).map((s)=>`${s}${palace.brightness[s]}`).join(' ')}</small>
				</div>
			);
		};
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-cetian-board">
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">策天飞星</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				<div className="horosa-kinastro-cetian-grid">
					{TWELVE_PALACE_LAYOUT.map(renderCell)}
					<div className="horosa-kinastro-cetian-center">
						<h3>策天十八飞星</h3>
						<p>{fmtValue(pan.lunar && pan.lunar.text)}</p>
						<div className="horosa-kinastro-cetian-center-grid">
							<span>命宫<strong>{fmtValue(pan.mingGong)}</strong></span>
							<span>身宫<strong>{fmtValue(pan.shenGong)}</strong></span>
							{pan.wuXingJu ? <span>五行局<strong>{fmtValue(pan.wuXingJu)}</strong></span> : null}
							<span>紫微<strong>{fmtValue(pan.ziwei)}</strong></span>
						</div>
						{chart.sihua && Object.keys(chart.sihua).length ? (
							<div className="horosa-kinastro-cetian-sihua">
								{Object.keys(chart.sihua).map((star)=>(<span key={star}>{star}化{chart.sihua[star]}</span>))}
							</div>
						) : null}
						<small>{fmtValue(chart.solar_term_influence)}</small>
					</div>
				</div>
			</div>
		);
	}

	renderZiWeiCopiedCenter(pan){
		const chart = buildKinAstroZiWeiChart(pan, this.config.serviceKey);
		const rules = buildZiWeiRulesForChart(chart);
		return (
			<div className="horosa-kinastro-ziwei-copy-board">
				<div className="horosa-ziwei-chart-viewport horosa-kinastro-ziwei-viewport">
					<ZiWeiChart
						value={chart}
						height="100%"
						fields={this.props.fields}
						rules={rules}
						onCenterInfoClick={this.openCenterInfo}
					/>
				</div>
				<button
					type="button"
					className="horosa-kinastro-center-info-overlay"
					onClick={this.openCenterInfo}
					aria-label="打开命盘信息"
				>
					命盘信息
				</button>
			</div>
		);
	}

	renderCenterInfoModal(){
		if(this.config.serviceKey !== 'xianqin' && this.config.serviceKey !== 'cetian'){
			return null;
		}
		const sections = this.getCenterInfoSections();
		return (
			<Modal
				open={this.state.centerInfoVisible}
				title="命盘信息"
				footer={null}
				onCancel={this.closeCenterInfo}
				width={640}
				className="horosa-ziwei-center-info-modal horosa-kinastro-center-info-modal"
			>
				{this.renderCenterInfoPanel(sections)}
			</Modal>
		);
	}

	getCenterInfoSections(){
		const sections = this.state.pan ? (this.state.pan.sections || []).filter((section)=>!INTERNAL_SECTION_TITLES.has(section.title)) : [];
		const titles = this.config.serviceKey === 'cetian'
			? ['起盘', '农历与命身', '三宫', '四化']
			: ['起盘', '农历与命身', '三宫', '三星', '二十八宿禽'];
		const matched = titles
			.map((title)=>sections.find((section)=>section.title === title))
			.filter((section)=>section && section.rows && section.rows.length);
		return matched.length ? matched : sections.slice(0, 4).filter((section)=>section.rows && section.rows.length);
	}

	renderCenterInfoPanel(sections){
		const list = sections || [];
		if(!list.length){
			return <div className="horosa-empty-hint">起盘后显示命盘信息</div>;
		}
		return (
			<div className="horosa-ziwei-meta-scroll horosa-astro-content-scroll horosa-kinastro-center-info-scroll">
				{list.map((section)=>{
					const rows = section.rows || [];
					const isPillar = section.title === '四柱' || rows.every((row)=>/[年月日時时]柱$/.test(row.label || ''));
					return (
						<div className="horosa-info-card" key={section.title}>
							<div className="horosa-info-card-title">{section.title}</div>
							{isPillar ? (
								<div className="horosa-ziwei-bazi-grid">
									{rows.map((row, idx)=>(
										<div className="horosa-ziwei-bazi-cell" key={`${section.title}_${row.label}_${idx}`}>
											<span>{row.label}</span>
											<strong>{fmtValue(row.value)}</strong>
										</div>
									))}
								</div>
							) : rows.map((row, idx)=>(
								<div className="horosa-info-row" key={`${section.title}_${row.label}_${idx}`}>
									<span>{row.label}</span>
									<strong>{fmtValue(row.value)}</strong>
								</div>
							))}
						</div>
					);
				})}
			</div>
		);
	}

	buildHeluoOpts(){
		return this.memoOpts('heluo', {
			ziShuMode: this.state.heluoZiShu,
			jiGongMode: this.state.heluoJiGong,
			zhiZunEnabled: this.state.heluoZhiZun,
			pureGanKunVariant: this.state.heluoPureGanKun,
			liunianStep2: this.state.heluoLiunianStep2,
			huangdiOffset: parseInt(this.state.heluoHuangdiOffset, 10) || 2697,
			showLiuRi: this.state.heluoShowLiuRi,
		});
	}

	/**
	 * 大定推命之「所推流年」—— 主控一项，余者尽自其派生。
	 *
	 * 🔴 从前此处要用户手填【虚岁 + 大运/小运/岁君三个干支】,而这四者本可自生辰与流年推得:
	 *    用户得自己算虚岁、自己排大运、自己查太岁,方能推一年 —— 换一年又得重来一遍。
	 *    今只取一年,余者由 ZhengChuanMain 自八字既有之推运表派生(与八字盘同出一源,不另造)。
	 *    手填诸格仍在,收于「手订七位」之下:古法偶有特例(如虚岁按他说、大运另取),留其路。
	 */
	renderDadingYearFields(){
		const f = this.props.fields || {};
		const dv = f.date && f.date.value;
		// 🔴 此处 date.value 是【朴素对象】{year,month,date,...},不是 moment ——
		//    而同一字段到了 ZhengChuanMain 那边却是 moment(其调 dv.format())。
		//    两处形状不同,照抄邻居即取空(实测:一度恒报「先定生辰」)。故两种皆吃。
		const birthYear = (() => {
			if (!dv) return null;
			if (typeof dv.year === 'function') return dv.year();       // moment
			return Number.isFinite(Number(dv.year)) ? Number(dv.year) : null;   // 朴素对象
		})();
		const nowYear = new Date().getFullYear();
		const cur = parseInt(this.state.zhengchuanDadingYear, 10);
		const manual = [this.state.zhengchuanAge, this.state.zhengchuanDayun,
			this.state.zhengchuanXiaoyun, this.state.zhengchuanSuijun].filter((x)=>`${x || ''}`.trim()).length;
		return (
			<>
				<label className="horosa-huangji-select-field is-wide">
					<span>所推流年（余者自出）</span>
					<InputNumber
						min={birthYear || 1} max={(birthYear || nowYear) + 120}
						value={Number.isFinite(cur) ? cur : undefined}
						placeholder={`${nowYear}`}
						onChange={(v)=>this.setState({ zhengchuanDadingYear: v ? `${v}` : '' })} />
				</label>
				<div className="horosa-cetian-settings-hint horosa-heluo-diverge-hint">
					{birthYear ? '择一年，其虚岁·大运·小运·岁君即自本命推运表出（与八字盘同源）；留空则三运取本命月/时/年柱。' : '先定生辰，方可推年。'}
				</div>
				<Collapse ghost className="horosa-huangji-sub-collapse horosa-heluo-diverge-hint">
					<Collapse.Panel key="manual" header={`手订七位${manual ? `（已订 ${manual} 项）` : ''}`}>
						<label className="horosa-huangji-select-field">
							<span>虚岁（留空自出）</span>
							<InputNumber min={1} max={120} value={parseInt(this.state.zhengchuanAge, 10) || undefined}
								placeholder="自流年出"
								onChange={(v)=>this.setState({ zhengchuanAge: v ? `${v}` : '' })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>大运（干支）</span>
							<Input value={this.state.zhengchuanDayun} maxLength={2} placeholder="自流年出，未起运取月柱"
								onChange={(e)=>this.setState({ zhengchuanDayun: e.target.value })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>小运（干支）</span>
							<Input value={this.state.zhengchuanXiaoyun} maxLength={2} placeholder="自流年出"
								onChange={(e)=>this.setState({ zhengchuanXiaoyun: e.target.value })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>岁君（干支）</span>
							<Input value={this.state.zhengchuanSuijun} maxLength={2} placeholder="自流年出，即当年太岁"
								onChange={(e)=>this.setState({ zhengchuanSuijun: e.target.value })} />
						</label>
					</Collapse.Panel>
				</Collapse>
			</>
		);
	}

	buildZhengChuanOpts(){
		// 汇总全部开关 → 单一 opts 下传;任一变则中/右栏重算 + AI 快照刷新(禁止只监听单项)。
		// memoOpts 只稳定【引用】:任一项值变 → 新对象 → 子组件照常重算,契约逐字不变。
		return this.memoOpts('zhengchuan', {
			school: this.state.zhengchuanSchool,
			askGz: this.state.zhengchuanAskGz,
			fatherAge: this.state.zhengchuanFatherAge,
			motherAge: this.state.zhengchuanMotherAge,
			yuan: this.state.zhengchuanYuan,
			dadingYear: this.state.zhengchuanDadingYear,
			age: this.state.zhengchuanAge,
			dayun: this.state.zhengchuanDayun,
			xiaoyun: this.state.zhengchuanXiaoyun,
			suijun: this.state.zhengchuanSuijun,
			askHourZhi: this.state.zhengchuanAskHourZhi,
			env: this.state.zhengchuanEnv,
			item: this.state.zhengchuanItem,
			sound: this.state.zhengchuanSound,
			ke: this.state.zhengchuanKe,
			gong: this.state.zhengchuanGong,
			xqZhi: this.state.zhengchuanXqZhi,
			xqYushu: this.state.zhengchuanXqYushu,
		});
	}

	buildYizhangjingOpts(){
		return this.memoOpts('yizhangjing', {
			shunniRule: this.state.yizhangjingShunni,
			mingGongMethod: this.state.yizhangjingMingGong,
			dayunLength: parseInt(this.state.yizhangjingDayunLen, 10) || 7,
			dayunStartAge: this.state.yizhangjingStartAge,
			xiaoxianStart: this.state.yizhangjingXiaoStart,
			flowShenSet: this.state.yizhangjingFlowSet,
			chongfanKou: this.state.yizhangjingChongfan,
			dingYue: this.state.yizhangjingDingYue,
			shenshaLayer: this.state.yizhangjingShensha,
		});
	}

	renderCenter(){
		if(this.config.serviceKey === 'canping'){
			return <CanPingMain slot="center" fields={this.props.fields} method={this.state.canpingMethod} />;
		}
		if(this.config.serviceKey === 'heluo'){
			return <HeLuoMain slot="center" fields={this.props.fields} gender={this.state.gender} quHuaGong={this.state.heluoQuHuaGong} opts={this.buildHeluoOpts()} />;
		}
		if(this.config.serviceKey === 'zhengchuan'){
			return <Suspense fallback={<div className="horosa-zhengchuan-loading"><Spin size="small" /> 载入中</div>}>
					<ZhengChuanMain slot="center" fields={this.props.fields} opts={this.buildZhengChuanOpts()} />
				</Suspense>;
		}
		if(this.config.serviceKey === 'yizhangjing'){
			return <YiZhangJingMain slot="center" fields={this.props.fields} gender={this.state.gender} opts={this.buildYizhangjingOpts()} />;
		}
		const pan = this.state.pan;
		if(!pan){
			return <div className="horosa-huangji-empty">暂无{this.config.techniqueLabel}数据</div>;
		}
		if(this.config.serviceKey === 'xianqin'){
			return this.renderZiWeiCopiedCenter(pan);
		}
		if(this.config.serviceKey === 'cetian'){
			return this.renderZiWeiCopiedCenter(pan);
		}
		if(this.config.serviceKey === 'tieban'){
			return this.renderTiebanCenter(pan);
		}
		if(this.config.serviceKey === 'fendjing'){
			return this.renderFendjingCenter(pan);
		}
		if(this.config.serviceKey === 'beiji'){
			return this.renderBeijiCenter(pan);
		}
		if(this.config.serviceKey === 'nanji'){
			return this.renderNanjiCenter(pan);
		}
		if(this.config.serviceKey === 'chunzi'){
			return this.renderChunziCenter(pan);
		}
		return this.renderShaoziCenter(pan);
	}

	renderRows(sections){
		const list = sections || [];
		if(!list.length){
			return <div className="horosa-huangji-empty">暂无数据</div>;
		}
		return list.map((section)=>(
			<div className="horosa-huangji-info-card" key={section.title}>
				<div className="horosa-huangji-info-heading">{section.title}</div>
				{(section.rows || []).map((item, idx)=>(
					<div className="horosa-huangji-info-row" key={`${section.title}_${item.label}_${idx}`}>
						<span>{item.label}</span>
						<strong>{fmtValue(item.value)}</strong>
					</div>
				))}
			</div>
		));
	}

	renderClassics(){
		const classics = this.state.pan && this.state.pan.classics ? this.state.pan.classics : null;
		if(!classics || !classics.sections || !classics.sections.length){
			return <div className="horosa-huangji-empty">暂无来源说明</div>;
		}
		return (
			<div className="horosa-huangji-classics">
				{(classics.meta || []).map((item)=>(
					<div className="horosa-huangji-info-card" key={item.key}>
						<div className="horosa-huangji-info-heading">{item.title}</div>
						<div className="horosa-huangji-info-row"><span>作者</span><strong>{item.author}</strong></div>
						<div className="horosa-huangji-info-row"><span>说明</span><strong>{item.description}</strong></div>
					</div>
				))}
				<div className="horosa-huangji-classic-list">
					{classics.sections.map((section)=>(
						<div className="horosa-huangji-classic-section" key={section.title}>
							<strong>{section.title}</strong>
							<p>{section.content}</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	getTabSections(tabKey){
		const sections = this.state.pan ? (this.state.pan.sections || []).filter((section)=>!INTERNAL_SECTION_TITLES.has(section.title)) : [];
		if(tabKey === 'overview'){
			return sections.slice(0, 4);
		}
		if(tabKey === 'pillars'){
			return sectionByTitle(sections, ['四柱']);
		}
		if(tabKey === 'digits'){
			return sectionByTitle(sections, ['四位起数', '河洛纳音', '完整结构', '64钥匙']);
		}
		if(tabKey === 'core'){
			return sectionByTitle(sections, ['命身刻分', '神数号码', '算盘定部', '计算摘要']);
		}
		if(tabKey === 'twoGan'){
			return sectionByTitle(sections, ['两头钳']);
		}
		if(tabKey === 'fate'){
			return sectionByTitle(sections, ['命格']);
		}
		if(tabKey === 'yearHour'){
			return sectionByTitle(sections, ['起盘', '年时', '条文索引']);
		}
		if(tabKey === 'queries'){
			return sectionByTitle(sections, ['完整条文']);
		}
		if(tabKey === 'search'){
			return sectionByTitle(sections, ['条文检索', '代码查询', '批量代码查询', '关键词检索', '多标签检索', '宿名检索', '时辰检索']);
		}
		if(tabKey === 'palaceText'){
			return sectionByTitle(sections, ['宫部条文']);
		}
		if(tabKey === 'queryText'){
			return sectionByTitle(sections, ['条文查询']);
		}
		if(tabKey === 'family'){
			return sectionByTitle(sections, ['家亲']);
		}
		if(tabKey === 'fortune'){
			return sectionByTitle(sections, ['财官性情']);
		}
		if(tabKey === 'text'){
			return sectionByTitle(sections, ['条文', '64钥匙', '元会运世']);
		}
		if(tabKey === 'palaces'){
			return sectionByTitle(sections, ['三宫', '十二宫', '十二宫条文'].concat((sections || []).map((s)=>s.title).filter((title)=>/[宫宮]$/.test(title))));
		}
		if(tabKey === 'verses'){
			return sectionByTitle(sections, ['条文', '十二宫条文', '条文库', '判断', '六段断语']);
		}
		if(tabKey === 'dayun'){
			return sectionByTitle(sections, ['大运']);
		}
		if(tabKey === 'password'){
			return sectionByTitle(sections, ['密码']);
		}
		if(tabKey === 'divine'){
			return sectionByTitle(sections, ['星图推演']);
		}
		if(tabKey === 'codes'){
			return sectionByTitle(sections, ['代码来源']);
		}
		if(tabKey === 'analysis'){
			return sectionByTitle(sections, ['结构解析']);
		}
		if(tabKey === 'candidates'){
			return sectionByTitle(sections, ['候选条文']);
		}
		if(tabKey === 'lookup'){
			return sectionByTitle(sections, ['代码查询', '批量代码查询']);
		}
		if(tabKey === 'stars'){
			return sectionByTitle(sections, ['三星', '衍生星', '二十八宿禽']);
		}
		if(tabKey === 'swallow'){
			return sectionByTitle(sections, ['吞啖合战', '情性与格局']);
		}
		if(tabKey === 'flying'){
			return sectionByTitle(sections, ['飞星']);
		}
		if(tabKey === 'patterns'){
			return sectionByTitle(sections, ['格局']);
		}
		if(tabKey === 'full'){
			return sections;
		}
		return sections.slice(0, 4);
	}

	renderCetianSettings(){
		// 策天「设置」tab:5 显示开关(默认全显=现状)。算法/农历/正曜在左栏选;此处仅输出显示开关。
		// 切开关 → setState + clickPlot 重新起盘 → 后端按 show_* 过滤段/行 → 右栏即时增删(铁律3)。
		const isKentang = this.state.cetianMethod === 'kentang';
		const toggle = (key, label)=>(
			<label className="horosa-cetian-toggle">
				<Switch size="small" checked={!!this.state[key]} onChange={(v)=>this.setState({ [key]: v ? 1 : 0 }, this.clickPlot)} />
				<span>{label}</span>
			</label>
		);
		return (
			<div className="horosa-cetian-settings-panel">
				<div className="horosa-info-card-title">显示选项</div>
				<div className="horosa-cetian-toggle-list">
					{toggle('cetianShowBrightness', '亮度（庙旺乐）')}
					{isKentang ? (
						<>
							{toggle('cetianShowWuXingJu', '五行局')}
							{toggle('cetianShowSihua', '四化（禄权科忌）')}
							{toggle('cetianShowFlying', '飞星与格局')}
							{toggle('cetianShowSolarTerm', '节气影响')}
						</>
					) : (
						<div className="horosa-cetian-settings-hint">书法仅「亮度」可调；切到「原法」（左栏算法）后另有五行局/四化/飞星/节气开关。</div>
					)}
				</div>
				<div className="horosa-cetian-settings-hint">排盘算法（书法/原法）、农历、正曜布法在左栏选择；此处为输出显示开关，默认全显＝现状。</div>
			</div>
		);
	}

	renderRightPanel(){
		if(this.config.serviceKey === 'canping'){
			return <div className="horosa-huangji-section-list"><CanPingMain slot="aux" fields={this.props.fields} method={this.state.canpingMethod} /></div>;
		}
		if(this.config.serviceKey === 'heluo'){
			return <div className="horosa-huangji-section-list"><HeLuoMain slot="aux" fields={this.props.fields} gender={this.state.gender} quHuaGong={this.state.heluoQuHuaGong} opts={this.buildHeluoOpts()} /></div>;
		}
		if(this.config.serviceKey === 'zhengchuan'){
			return <div className="horosa-huangji-section-list">
					<Suspense fallback={<div className="horosa-zhengchuan-loading"><Spin size="small" /> 载入中</div>}>
						<ZhengChuanMain slot="aux" fields={this.props.fields} opts={this.buildZhengChuanOpts()} />
					</Suspense>
				</div>;
		}
		if(this.config.serviceKey === 'yizhangjing'){
			return <div className="horosa-huangji-section-list"><YiZhangJingMain slot="aux" fields={this.props.fields} gender={this.state.gender} opts={this.buildYizhangjingOpts()} /></div>;
		}
		const snapshot = this.snapshotText();
		const visibleTabs = this.visibleTabsOf(snapshot);
		const activeKey = visibleTabs.some((item)=>item.key === this.state.rightPanelTab)
			? this.state.rightPanelTab
			: (visibleTabs[0] ? visibleTabs[0].key : 'overview');
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs horosa-kinastro-tabs">
				{visibleTabs.map((item)=>(
					<TabPane tab={item.label} key={item.key}>
						{/* horosa_freeze_subtabs_v1:右栏子页签冻结。此前每个 TabPane 的内容都在
						    本方法里【当场求值】(getTabSections 过滤全段 + renderRows 造出全部行,
						    铁板 7 目、南极 7 目、蠢子 7 目一次全造),而用户只看得见一目。
						    改函数式:未激活的目连元素都不创建;已看过的目保持挂载(DOM/滚动位置/
						    展开态全在),只是父组件重渲时不再穿透;切回去时拿本轮最新 children
						    立刻渲一帧 —— 不重新挂载、不重取、不闪烁、零陈旧。 */}
						<FreezeSubTab active={activeKey === item.key}>
							{()=>(
								item.key === 'snapshot' ? (
									<pre className="horosa-huangji-snapshot">{snapshot}</pre>
								) : item.key === 'classics' ? (
									<div className="horosa-huangji-section-list">{this.renderClassics()}</div>
								) : item.key === 'settings' ? (
									<div className="horosa-huangji-section-list">{this.renderCetianSettings()}</div>
								) : item.key === 'yanfa' ? (
									<div className="horosa-huangji-section-list"><YanQinBranchPanel fields={this.props.fields} /></div>
								) : item.key === 'framework' ? (
									<div className="horosa-huangji-section-list">{this.renderTiebanFrameworkTab()}</div>
								) : (
									<div className="horosa-huangji-section-list">{this.renderRows(this.getTabSections(item.key))}</div>
								)
							)}
						</FreezeSubTab>
					</TabPane>
				))}
			</Tabs>
		);
	}

	renderBottomQuickDock(){
		// 与右栏同源(snapshotText/visibleTabsOf 带缓存):此前这里把快照拼接与页签过滤
		// 又整整算了第二遍,同一次重渲白付两倍。
		const snapshot = this.snapshotText();
		const visibleTabs = this.visibleTabsOf(snapshot);
		const actions = [
			{ label: '起盘', icon: 'quickPrimary', onClick: this.clickPlot },
			...visibleTabs.map((item)=>({
				label: item.label,
				icon: item.key === 'snapshot' ? 'quickAi' : (item.key === 'classics' ? 'book' : 'quickNote'),
				active: this.state.rightPanelTab === item.key,
				onClick: ()=>this.setRightPanelTab(item.key),
			})),
		];
		return (
			<div className="horosa-bottom-quick-dock horosa-huangji-quick-dock horosa-kinastro-quick-dock">
				<div className="horosa-bottom-quick-title">快捷功能 <XQIcon name="ai" /></div>
				<div className="horosa-bottom-quick-actions horosa-huangji-quick-actions horosa-kinastro-quick-actions">
					{actions.map((item)=>(
						<button
							type="button"
							key={`${item.label}_${item.icon}`}
							className={`horosa-bottom-quick-button horosa-huangji-quick-button${item.active ? ' is-active' : ''}`}
							onClick={item.onClick}
						>
							<span className="horosa-bottom-quick-icon"><XQIcon name={item.icon} /></span>
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</div>
		);
	}

	renderTechniqueRail(){
		const propTechniqueTabs = Array.isArray(this.props.techniqueTabs) ? this.props.techniqueTabs : [];
		if(propTechniqueTabs.length > 1){
			const activeTechnique = this.props.activeTechnique || this.props.technique || this.config.serviceKey;
			return (
				<div className="horosa-kinastro-technique-rail">
					{propTechniqueTabs.map((item)=>(
						<button
							type="button"
							key={item.key}
							className={activeTechnique === item.key ? 'is-active' : ''}
							onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}
						>
							{item.label}
						</button>
					))}
				</div>
			);
		}
		if(!this.config.showRail){
			return null;
		}
		const techniques = this.config.moduleKey === 'shusuan'
			? [
					{ key: 'shaozi', label: '邵子神数' },
					{ key: 'tieban', label: '铁板神数' },
					{ key: 'fendjing', label: '鬼谷分定经' },
					{ key: 'beiji', label: '北极神数' },
					{ key: 'nanji', label: '南极神数' },
					{ key: 'chunzi', label: '蠢子数' },
					{ key: 'canping', label: '邵子参评数' },
					{ key: 'heluo', label: '河洛理数' },
					{ key: 'zhengchuan', label: '神数正传' },
				]
			: [{ key: this.props.technique || this.config.serviceKey, label: this.config.techniqueLabel }];
		return (
			<div className="horosa-kinastro-technique-rail">
				{techniques.map((item)=>(
					<button
						type="button"
						key={item.key}
						className={(this.props.technique || this.config.serviceKey) === item.key ? 'is-active' : ''}
						onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}
					>
						{item.label}
					</button>
				))}
			</div>
		);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		const chartRendererClass = this.config.serviceKey === 'xianqin' || this.config.serviceKey === 'cetian' ? ' xq-chart-renderer-ziwei' : '';
		const showTechniqueRail = this.config.showRail || (Array.isArray(this.props.techniqueTabs) && this.props.techniqueTabs.length > 1);
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}
		return (
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-kinastro-redesign horosa-kinastro-module-${this.config.moduleKey} horosa-kinastro-${this.config.serviceKey}-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					{/* WP-C keep-stale:重取时【有旧盘】就不压暗(Spin 只在首载兜底),角标代之 ——
					    旧盘全程可读可操作,新盘到达单次 setState 整体替换(印占同款)。开关关=旧局部 Spin。 */}
					<Spin spinning={this.state.loading && (!silentTechniquePanelsEnabled() || !this.state.pan)}>
						<div className={`horosa-astro-redesign-grid horosa-huangji-redesign-grid horosa-kinastro-grid${showTechniqueRail ? ' has-technique-rail' : ''}`} style={{ position: 'relative' }}>
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer${chartRendererClass}`} style={{ position: 'relative' }}>
								{this.state.loading && this.state.pan && silentTechniquePanelsEnabled() ? <UpdatingBadge /> : null}
								<div className="horosa-huangji-board-host horosa-kinastro-board-host">{this.renderCenterSlot()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">{this.config.infoTitle}</div>
										<div className="horosa-side-panel-subtitle">{this.config.infoSubTitle}</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
							{this.renderTechniqueRail()}
						</div>
					</Spin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
					{this.renderCenterInfoModal()}
				</div>
			</div>
		);
	}
}

export default KinAstroMain;
