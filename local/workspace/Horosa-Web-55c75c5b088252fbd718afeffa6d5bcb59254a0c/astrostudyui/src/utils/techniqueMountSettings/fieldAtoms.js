// 挂载设置共用小件:开关 / 时间算法 / 日界 / 区间扫描等多门技法共用的选项与字段组
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { TRANSFORM_PAGE_SETTINGS, transformKindDef } from '../transformCharts';   // 变换盘 / 黄道制选项(与辅盘页同源)
import { GUICE_OPTION_META } from '../../components/guice/guiceSchools';
import * as AstroConst from '../../constants/AstroConst';
import { SUPPORTED_PD_METHODS, PD_METHOD_LABELS, SUPPORTED_PD_TIME_KEYS, PD_TIME_KEY_LABELS } from '../primaryDirectionSync';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';

export const transformPageSetting = (k)=>{ try{ return TRANSFORM_PAGE_SETTINGS.load()[k]; }catch(e){ return undefined; } };

// 这种变换用不用得到某个选项(与辅盘页显隐同一判据);没指定变换 = 按辅盘页保存的那种判
export const transformKindUses = (kind, opt)=>{ const def = transformKindDef(kind || transformPageSetting('kind')); return !!(def && Array.isArray(def.options) && def.options.indexOf(opt) >= 0); };

// 页面保存过的设置值(东亚 / 诸方齿轮缺省跟页面走);没存过或值不在候选里返回 undefined
export function storedPageSetting(storageKey, field, allowed){
	try{
		if(typeof localStorage === 'undefined'){ return undefined; }
		const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
		const vals = raw && raw.values && typeof raw.values === 'object' ? raw.values : {};   // 页面设置存成 { values: {...} }
		const v = vals[field];
		return allowed.indexOf(v) >= 0 ? v : undefined;
	}catch(e){ return undefined; }
}

// 记录的出生纬度是不是北纬(南半球读法只在南纬生效):'31n38' 一类度分串认 n / s;数值纬度认正负;认不出 = false(不置灰)
export function recordIsNorthern(record){
	if(!record || typeof record !== 'object'){ return false; }
	const g = Number(record.gpsLat);
	if(record.gpsLat !== undefined && record.gpsLat !== null && record.gpsLat !== '' && Number.isFinite(g)){ return g > 0; }
	const t = `${record.lat || ''}`.trim().toLowerCase();
	if(/^\d+(\.\d+)?n\d*/.test(t)){ return true; }
	if(/^\d+(\.\d+)?s\d*/.test(t)){ return false; }
	const n = Number(t);
	return t !== '' && Number.isFinite(n) ? n > 0 : false;
}

export const ON_OFF = [{ value: 0, label: '关' }, { value: 1, label: '开' }];

// 页面档名里没写缺省的,齿轮在缺省档后补「（默认）」(页面自己写了的不重复补)
export const markDefaultOption = (options, dft)=>(options || []).map((o)=>(o.value === dft && !/默认/.test(o.label) ? { ...o, label: `${o.label}（默认）` } : { value: o.value, label: o.label }));

const guiceMeta = (key)=>GUICE_OPTION_META.find((m)=>m.key === key) || {};

export const guiceMetaLabel = (key)=>guiceMeta(key).label || key;

export const guiceMetaOptions = (key, dft)=>markDefaultOption(guiceMeta(key).options, dft);

// 与奇门/太乙/三式页面同文:时间算法 1 档页面叫「直接时间」;日界 0 档不是「不换日」而是 24 点换日。
export const TIME_ALG_OPTIONS = [{ value: 0, label: '真太阳时' }, { value: 1, label: '直接时间' }];

export const ZODIACAL_OPTIONS = [{ value: 0, label: '回归黄道' }, { value: 1, label: '恒星黄道' }];   // 与星盘页黄道下拉同(恒星档的岁差制另一项选)

const DAY_BOUNDARY_OPTIONS = [{ value: 0, label: '24点算第二天' }, { value: 1, label: '23点算第二天' }];

export const HSYS_OPTIONS = AstroConst.HOUSE_SYSTEM_OPTIONS.map((item)=>({ value: item.value, label: item.label }));

export const PD_METHOD_OPTIONS = SUPPORTED_PD_METHODS.map((value)=>({ value, label: PD_METHOD_LABELS[value] || value }));

export const PD_TIME_KEY_OPTIONS = SUPPORTED_PD_TIME_KEYS.map((value)=>({ value, label: PD_TIME_KEY_LABELS[value] || value }));

// 日界 + 晚子时（八字/紫微/太乙等共用；从 TIME_FIELDS 抽出以便单独复用）。默认 === 各 builder 现状。
// default 是模块载入期求值的一次性快照,builder 却实时读全局——会话内改
// 全局日界后基线冻在旧值,齿轮拨回旧档被 prune 剪空(9 技法共用字段)。globalCurrent 实时求值根治。
export const DAY_BOUNDARY_FIELDS = [
	{ name: 'after23NewDay', label: '日界（日柱换日）', type: 'select', options: DAY_BOUNDARY_OPTIONS, default: defaultAfter23NewDay(), globalCurrent: ()=>defaultAfter23NewDay(), group: '时间换算' },
	{ name: 'lateZiHourUseNextDay', label: '晚子时·时柱进次日', type: 'switch', options: ON_OFF, default: defaultLateZiHourUseNextDay(), globalCurrent: ()=>defaultLateZiHourUseNextDay(), group: '时间换算' },
];

// 有本页日界控件的技法,齿轮用页面上的叫法(奇门页 / 三式合一页叫「日界」,太乙页叫「换日」);其余技法沿用共用名
export const dayBoundaryLabelled = (label)=>(f)=>(f.name === 'after23NewDay' ? { ...f, label } : f);

// 起课时间换算共用组（紫微/数算/神数等 2 档 timeAlg 技法），默认全部 === buildFieldObject 现状。
export const TIME_FIELDS = [
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS,
];

// 构造器认平太阳时(3)的技法(神数正传 / 参评 / 河洛 / 一掌经):盘的时间算法来自全局「新命盘缺省」,可以是平太阳时 —— 齿轮也要能选回它
const TIME_ALG_WITH_MEAN_OPTIONS = [{ value: 0, label: '真太阳时' }, { value: 3, label: '平太阳时' }, { value: 1, label: '直接时间' }];

export const TIME_FIELDS_WITH_MEAN = TIME_FIELDS.map((f)=>(f.name === 'timeAlg' ? { ...f, options: TIME_ALG_WITH_MEAN_OPTIONS, normalize: (v)=>Number(v) } : f));

// 紫微只认真太阳时 / 直接时间(构造器把平太阳时当真太阳时算):存了 3 的盘显示为真太阳时 = 实际所用口径
// 日界 / 晚子时两键只在紫微「晚子时 = 跟随全局」时起作用(具体方案自带这两项,双盘两张各自钉死;ZiweiCalc 同判)
export const ZIWEI_TIME_FIELDS = TIME_FIELDS.map((f)=>{
	if(f.name === 'timeAlg'){ return { ...f, normalize: (v)=>(Number(v) === 1 ? 1 : 0) }; }
	return { ...f, showWhen: (d)=>!d || !d.lateZi || d.lateZi === 'global' };
});

// 紫微九个叠层开关:记录里存的是布尔(ziweiRecordSettings 写回),齿轮是 0/1 —— 不归一则抽屉显空、拨关再拨开被记成「已修改」并白算一次
export const ZW_SWITCH01 = (v)=>((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0);

// 八字专属 timeAlg 4 档（源 CnTraditionInput：真太阳时/平太阳时/直接时间/春分定卯时；西占/紫微的 2 档不含「春分定卯时/平太阳时」）。
// 平太阳时(3)=仅经度差、去均时差,与真太阳时(0)算法不同(baziLunarLocal timeAlg=3),挂载须可选。
export const BAZI_TIME_ALG_OPTIONS = [
	{ value: 0, label: '真太阳时' },
	{ value: 3, label: '平太阳时' },
	{ value: 1, label: '直接时间' },
	{ value: 2, label: '春分定卯时(暂按直接时间)' },
];

// 十二地支（金口诀地分等；万年不变常量，内联零漂移）。
export const DIZHI_12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 多选运限选项生成器（紫微/八字共用）：数值范围 → [{value,label}]。
const numRangeOptions = (from, to, labelFn)=>{
	const out = [];
	for(let i = from; i <= to; i++){
		out.push({ value: i, label: labelFn ? labelFn(i) : `${i}` });
	}
	return out;
};

// 大限命盘宫位序 0–11；流月农历 1–12；流日农历 1–31（含大月 31）；流时时辰序 0–11（子起）。
export const ZIWEI_DAXIAN_OPTIONS = numRangeOptions(0, 11, (i)=>`宫位序 ${i}`);

export const LUNAR_MONTH_OPTIONS = numRangeOptions(1, 12, (i)=>`${i}月`);

export const LUNAR_DAY_OPTIONS = numRangeOptions(1, 31, (i)=>`${i}日`);

const SHICHEN_LABELS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const SHICHEN_OPTIONS = numRangeOptions(0, 11, (i)=>`${SHICHEN_LABELS[i]}时(${i})`);

// P4 区间扫描（推运 datetime 型技法共用）：可选 datetimeEnd + scanStep。
//  - 默认全空（datetimeEnd '' / scanStep ''）→ prune 后丢弃 → builder 走单点（=现状，字节级一致）。
//  - 仅当 datetimeEnd 非空且 scanStep 有值时，builder 才循环 from(datetime|此刻)→to 按 step 产多段（段数上限~30）。
// scanStep 默认空串（'' 表示「不扫描」）；选 y/m/d 才启用区间循环。
const SCAN_STEP_OPTIONS = [
	{ value: '', label: '关闭（单点）' },
	{ value: 'y', label: '逐年扫描' },
	{ value: 'm', label: '逐月扫描' },
	{ value: 'd', label: '逐日扫描' },
];

// datetime 型（含时分）区间字段：end 用 datetime picker。
export const scanRangeDatetimeFields = (group)=>[
	{ name: 'datetimeEnd', label: '区间终点(留空=单点)', type: 'datetime', default: '', group },
	{ name: 'scanStep', label: '区间步进', type: 'select', options: SCAN_STEP_OPTIONS, default: '', group },
];

// date 型（仅日）区间字段：end 用 date picker（vedic/jaynes 的 targetDate 是纯日期）。
export const scanRangeDateFields = (group)=>[
	{ name: 'datetimeEnd', label: '区间终点日期(留空=单点)', type: 'date', default: '', group },
	{ name: 'scanStep', label: '区间步进', type: 'select', options: SCAN_STEP_OPTIONS, default: '', group },
];
