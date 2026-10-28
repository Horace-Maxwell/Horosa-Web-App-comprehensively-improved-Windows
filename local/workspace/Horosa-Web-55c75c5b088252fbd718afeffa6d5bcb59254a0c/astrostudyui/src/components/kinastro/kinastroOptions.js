// 北极 / 南极 / 蠢子 / 邵子诸法的页面选项表(值与标签):技法页与 AI 挂载齿轮同一份(此前齿轮各自手写成文本框或简写值,
// 值域与标签都和页面不一致)。纯数据,不引组件。
const BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const SHAOZI_KE_OPTIONS = ['初刻', '二刻', '三刻', '四刻', '五刻', '六刻', '七刻', '八刻'].map((item)=>({ value: item, label: item }));
export const BEIJI_KE_OPTIONS = [
	{ value: '1', label: '初一刻' },
	{ value: '2', label: '初二刻' },
	{ value: '3', label: '初三刻' },
	{ value: '4', label: '初四刻' },
	{ value: '5', label: '正一刻' },
	{ value: '6', label: '正二刻' },
	{ value: '7', label: '正三刻' },
	{ value: '8', label: '正四刻' },
];
export const NANJI_SECTION_OPTIONS = BRANCH_NAMES.map((item)=>({ value: `${item}部`, label: `${item}部` }));
export const NANJI_JIANCHU_OPTIONS = [
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
export const NANJI_XIU_OPTIONS = [
	'角', '亢', '氏', '房', '心', '尾', '箕',
	'斗', '牛', '女', '虛', '危', '室', '壁',
	'奎', '婁', '胃', '昴', '畢', '觜', '參',
	'井', '鬼', '柳', '星', '張', '翼', '軫',
].map((item)=>({
	value: item,
	// 值保留后端认的「氏」(后端「氏 / 氐」两写都认),显示按二十八宿正字「氐」
	label: item.replace('氏', '氐').replace('虛', '虚').replace('婁', '娄').replace('畢', '毕').replace('參', '参').replace('張', '张').replace('軫', '轸'),
}));
export const NANJI_PASSWORD_OPTIONS = [
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
export const NANJI_CHART_OPTIONS = Array.from({ length: 18 }).map((_, index)=>({
	value: index + 1,
	label: `第${index + 1}图`,
}));
export const CHUNZI_KE_OPTIONS = Array.from({ length: 10 }).map((_, index)=>({
	value: `${index + 1}`,
	label: `${index + 1}刻`,
}));
export const CHUNZI_RESULT_LIMIT_OPTIONS = [10, 20, 30, 50].map((item)=>({
	value: `${item}`,
	label: `${item}条`,
}));
export const CHUNZI_MANSION_OPTIONS = [
	'角', '亢', '氐', '房', '心', '尾', '箕',
	'斗', '牛', '女', '虛', '危', '室', '壁',
	'奎', '婁', '胃', '昴', '畢', '觜', '參',
	'井', '鬼', '柳', '星', '張', '翼', '軫',
].map((item)=>({
	value: item,
	label: item.replace('虛', '虚').replace('婁', '娄').replace('畢', '毕').replace('參', '参').replace('張', '张').replace('軫', '轸'),
}));
// 神数正传·六亲 / 心易各下拉档(神数页与 AI 挂载齿轮同一份;值是后端认的写法,含繁体字)
export const ZC_ITEMS = ['父母', '兄弟', '姻緣', '子孫', '官祿', '疾病'];
export const ZC_SOUNDS = ['日', '月', '星', '辰', '水', '火', '土', '石', '平', '上', '去', '入', '開', '發', '收', '閉'];
export const ZC_KE = ['一刻', '二刻', '三刻', '四刻', '五刻', '六刻', '七刻', '八刻'];
export const ZC_GONG = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'];
// 演算时辰在卯—申为白天(天四象),其余为昼夜(地四象);天象档随之换
export const ZC_DAY_ZHI = '卯辰巳午未申';
export const ZC_ENV_DAY = [{ value: '晴', label: '晴' }, { value: '陰', label: '阴' }, { value: '雨', label: '雨' }, { value: '雪', label: '雪' }];
export const ZC_ENV_NIGHT = [{ value: '明', label: '明（见月光）' }, { value: '晦', label: '晦（无月光）' }, { value: '雨', label: '雨' }, { value: '雪', label: '雪' }];
// 演算时天象档(页面与挂载齿轮同一份):给了时辰 → 该时辰那一套;留空(取本人时支,此处不知昼夜)→ 两套都列,
// 由本人时支定哪套生效(选了另一套的档,引擎按该套首项)
export function zcEnvOptionsFor(askHourZhi){
	if(askHourZhi){ return ZC_DAY_ZHI.indexOf(askHourZhi) >= 0 ? ZC_ENV_DAY : ZC_ENV_NIGHT; }
	return [
		{ value: '晴', label: '晴（白天）' }, { value: '陰', label: '阴（白天）' },
		{ value: '明', label: '明（夜间·见月光）' }, { value: '晦', label: '晦（夜间·无月光）' },
		{ value: '雨', label: '雨' }, { value: '雪', label: '雪' },
	];
}
// 下拉回显:给了时辰而天象不属那一套 → 显示「按时辰取首项」(引擎正是按首项算)
export function zcEnvShown(askHourZhi, env){
	if(!env){ return ''; }
	return zcEnvOptionsFor(askHourZhi).some((o)=>o.value === env) ? env : '';
}
