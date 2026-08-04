// 「一个主 tab 下的合法子页签集合」单一真值源。
//
// 为什么要有这个文件:导航层(pages/index.js)在切走再切回某主 tab 时,要判断上次停留的
// 子页签是否仍合法 —— 不合法就回落到首档。这份合法集从前在导航层与各技法 Main 里
// 各写一份,于是每次新增子技法只改了 Main、忘了导航层,表现为:
//   停在新技法上切走再切回来 → 被静默打回该组第一个技法(用户以为"页面自己跳了")。
// 实测漂移量:卜·其他 14 vs 8(漏 geomancy/tarot/guice/xiaoliuren/xiaochengtu/feigong)、
// 辅盘 12 vs 8(漏 dwadasamsa/relocation/draconic/mundane)。
//
// 本文件必须保持「零组件依赖的纯常量」:各技法 Main 是懒加载的,导航层若为拿这份清单
// 去静态 import 那些 Main,会把整个技法 chunk 拉进主包,直接毁掉懒挂载。
//
// 新增子技法时:改这里 + 该组 Main 的 TabPane,两处即可(导航层自动跟随)。

// 辅盘(命·辅助盘)。首档 = 数组第一项。私有子技法键用独占行 marker 块尾附
// (strip 后 public 集合与其 TabPane 集恒自洽,键名也不外泄)。
export const AUX_SUBTABS = [
	'germanytech', 'hellenastro', 'dwadasamsa', 'locastro', 'relocation', 'harmonic', 'draconic', 'otherbu', 'horary', 'election', 'mundane',
	'babylon',
];

// 卜·其他。
export const CNYIBU_SUBTABS = ['suzhan', 'jinkou', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'geomancy', 'tarot', 'guice', 'xiaoliuren', 'xiaochengtu', 'feigong'];

// 择日(工具组主导航模块;首档=数组第一项,新增择日技法尾部追加 + ZeriMain TabPane 成对)。
export const ZERI_SUBTABS = ['tianxing', 'qimenzeri'];

// 命·传统(参考类)。
export const CNTRADITION_SUBTABS = ['guasym', 'cuangong12', 'pithy'];

/** 取某组的首档(导航层回落用),空集时返回 ''。 */
export function firstSubTab(list){
	return (Array.isArray(list) && list.length) ? list[0] : '';
}

/** 合法则原样返回,否则回落首档。 */
export function resolveSubTab(list, current){
	return (Array.isArray(list) && list.indexOf(current) >= 0) ? current : firstSubTab(list);
}
