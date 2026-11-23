// 下拉 / 分段选项表、吉凶配色与缺省工作区状态
// 从 LiqiWorkspace.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { SHAN_ORDER, ZIBAI_STAR, POS_NAME, YUN_YEARS, TIXING_VARIANTS, SANHE_XIANGFA_LIST, XUANKONG_SCHOOLS, JIAN_BOUNDARY_OPTIONS, WUHUANG_SPLIT_OPTIONS, LUOPAN_LAYERS, LUOPAN_DEFAULT_LAYERS } from '../fengshuiData';

// 罗盘使用要求的行首标签。写成表而非在 JSX 里三元判 key —— 三元只认得一个 key,
// 新加一条规则就默认落到通用「要求」,读者看不出它讲的是哪一类(实测新增卫星地图取向那条即如此)。
export const LUOPAN_RULE_LABEL = { weixing: '🛰️ 现代取向', gangjin: '🔴 钢混结构', zhanli: '持盘要领', duCan: '读盘', paiCai: '各派用盘' };

export const LUOPAN_RULE_JX = { gangjin: 'bad', weixing: 'good' };

export const SHAN_OPTS = SHAN_ORDER.map((s)=>({ value: s, label: s }));
// 24 山对宫:坐 i → 向 (i+12) % 24
export function oppositeShan(s){ const i = SHAN_ORDER.indexOf(s); return i >= 0 ? SHAN_ORDER[(i + 12) % SHAN_ORDER.length] : s; }
export const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
export const GUA8_OPTS = GUA8.map((g)=>({ value: g, label: g }));
// 择日深化左栏用：六十甲子 / 九星 / 九宫（含中宫）。
export const GANZHI60 = (()=>{
	const G = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
	const Z = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const out = []; for (let i = 0; i < 60; i++) { out.push(G[i % 10] + Z[i % 12]); } return out;
})();
export const STAR09_OPTS = [{ value: '0', label: '（不选）' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n)=>({ value: String(n), label: `${n}${ZIBAI_STAR[n] || ''}` }))];
export const GONG9_OPTS = [{ value: '0', label: '（不选）' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n)=>({ value: String(n), label: n === 5 ? '中宫' : (POS_NAME[n] || String(n)) }))];
export const YUN_OPTS = Object.keys(YUN_YEARS).map((y)=>({ value: +y, label: `${y}运 ${YUN_YEARS[y][0]}–${YUN_YEARS[y][1]}` }));
export const TIVAR_OPTS = TIXING_VARIANTS.map((v)=>({ value: v.value, label: v.label }));
export const SK_OPTS = [
	{ value: '辛', label: '辛 · 火局' }, { value: '戌', label: '戌 · 火局(墓库)' }, { value: '乾', label: '乾 · 火局' },
	{ value: '癸', label: '癸 · 金局' }, { value: '丑', label: '丑 · 金局(墓库)' }, { value: '艮', label: '艮 · 金局' },
	{ value: '乙', label: '乙 · 水局' }, { value: '辰', label: '辰 · 水局(墓库)' }, { value: '巽', label: '巽 · 水局' },
	{ value: '丁', label: '丁 · 木局' }, { value: '未', label: '未 · 木局(墓库)' }, { value: '坤', label: '坤 · 木局' },
];
// 🔴 首项「按水势自动」(value '') 不可删：sanhe 引擎是「显式 xiangFaType 优先、否则由 waterFlow 定」，
//    若下拉无空值档、初值又给了具体向法，则 waterFlow 永远被覆盖 → 左栏「水势」变死开关（曾如此）。
export const XIANGFA_OPTS = [{ value: '', label: '（按水势自动）' }, ...SANHE_XIANGFA_LIST.map((t)=>({ value: t, label: t }))];
export const SAND_WATER = [{ value: 'sand', label: '砂' }, { value: 'water', label: '水' }, { value: 'flat', label: '平' }];
export const COME_GO = [{ value: 'come', label: '来水' }, { value: 'go', label: '去水' }, { value: '', label: '无' }];
export const ZHAI_TYPE_OPTS = [{ value: 'jing', label: '静宅(1进)' }, { value: 'dong', label: '动宅(2-5)' }, { value: 'bian', label: '变宅(6-10)' }, { value: 'hua', label: '化宅(11-15)' }];
export const QK_POS9 = [
	{ key: 'xianTian', label: '先天位(丁)' }, { key: 'houTian', label: '后天位(财)' }, { key: 'anJie', label: '案劫(向首)' },
	{ key: 'tianJie', label: '天劫(左前)' }, { key: 'diXing', label: '地刑(右前)' },
	{ key: 'bin', label: '宾位' }, { key: 'ke', label: '客位' }, { key: 'fu', label: '辅卦位' }, { key: 'zhengQiao', label: '正窍位' },
];
export const FROM_OPTS = [{ value: 'xiang', label: '向卦' }, { value: 'zuo', label: '坐卦' }, { value: 'shuikou', label: '水口对宫' }];
export const XK_SCHOOL_OPTS = XUANKONG_SCHOOLS.map((s)=>({ value: s.key, label: s.name }));
export const JIANB_OPTS = JIAN_BOUNDARY_OPTIONS.map((o)=>({ value: `${o.value}`, label: o.label }));
export const WUHUANG_OPTS = WUHUANG_SPLIT_OPTIONS.map((o)=>({ value: o.value, label: o.value === 'xiagua' ? '下卦运' : '两元八运' }));
// 金锁 24 山细式左栏分组（宫→三山，与 jinsuo.js 的 GUA_SHANS 同序）。
export const JINSUO_GUA_SHANS = [
	['坎', ['壬', '子', '癸']], ['坤', ['未', '坤', '申']], ['震', ['甲', '卯', '乙']], ['巽', ['辰', '巽', '巳']],
	['乾', ['戌', '乾', '亥']], ['兑', ['庚', '酉', '辛']], ['艮', ['丑', '艮', '寅']], ['离', ['丙', '午', '丁']],
];
export const BOSHA_OPTS = [{ value: 'shuangshan', label: '以向为我' }, { value: 'zuo', label: '以坐山为我' }, { value: 'laigong', label: '赖公(人盘中针)' }];
export const LUOPAN_LAYER_OPTS = LUOPAN_LAYERS.map((l)=>({ key: l.key, label: l.label }));
export const YINYANG_OPTS = [{ value: 'yang', label: '阳宅' }, { value: 'yin', label: '阴宅' }];
export const JX_CLASS = (jx)=>(jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-warn' : ''));
export const NUM_GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };

export const ON_OFF_USE = [{ value: 'off', label: '不用' }, { value: 'on', label: '启用' }];

// 页面左栏各派参数的初值(与下面各 useState 初值逐项相同;改一处要同改)
export function liqiDefaultState(){
	const y = new Date().getFullYear();
	return {
		xiangShan: '午', yun: 9, year: y, zuoGua: '坎', ming: { year: null, isMale: true }, shuiKou: '戌', waterFlow: 'leftToRight',
		sectors: {}, waters: {}, jian: false, tiVariant: 'shen', month: 0, zhaiMode: 'zhai',
		sanheDeep: { xiangFaType: '', zuoDeg: '', boshaVariant: 'shuangshan', zuoShanForBosha: '子', laiLong: '' }, sands: {},
		bazhaiDeep: { doorGua: '', mainGua: '', stoveGua: '', zhaiType: 'jing', faMai: 'zuoshan', lunMing: true },
		xkDeep: { deg: '', yinYangZhai: 'yang', school: 'shen', jianBoundary: 3, wuHuangSplit: 'xiagua', shousha: {} },
		zbDate: { m: '', d: '', hour: '' }, fx: { benGua: '坎', qiFrom: 'xiang' }, fxWaters: {}, jy: { long: '乾', xiang: '甲', water: '坤' },
		dg: { lower: '乾', upper: '乾', yunScheme: 'struct', xiangYun: '', zuoYun: '', deg: '', showDeep: false, longLower: '', longUpper: '', chouYao: 0 },
		xs: { longSheng: true, longStar: '', boHuan: false, guoXiaGood: false, xueType: '', dingXue: '', zhengXue: [], daoZhang: '', shaYouQing: null, guiSha: [], xiongSha: [],
			shuiCheng: '', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: false },
		zr: { year: y, zuoShan: '子', m: '', d: '', laiLong: '', zhuYear: '', zhuMale: true, showDeep: false, yongShi: '', hourGanZhi: '', zibaiA: 0, zibaiB: 0, chongFuStar: 0, chongFuGong: 0, dongCombo: '', yun: 9 },
		jsDeep: { yun: 9, year: y, gran: 'gong8' }, jsShans: {}, jsXings: {},
		lf: { yun: 9, zuoShan: '子', xiangShan: '午', year: y }, ml: { mingYear: null, isMale: true, zhaiZuoGua: '坎' },
		lp: { deg: 0, zuoShan: '子', xiangShan: '午', layers: LUOPAN_DEFAULT_LAYERS, panType: 'zonghe', jianShan: '', jianDeg: 0, jianSchool: 'xuankong',
			city: '', trueDeg: '', decSource: 'book', isDanyuan: false, hasWater: null, hasMingtang: null, mingtangDominant: null, fourSidesSimilar: null, innerOuterMatch: null, outerStrong: null },
		regStates: {},
	};
}
