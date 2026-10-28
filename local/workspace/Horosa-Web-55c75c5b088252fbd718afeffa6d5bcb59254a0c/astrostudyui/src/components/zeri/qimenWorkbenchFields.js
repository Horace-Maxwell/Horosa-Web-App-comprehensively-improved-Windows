// 奇门家的定局子参数(置闰天数 / 月家起局)与移星在择日工作台上的选项描述 —— 奇门择日与三式择日两个工作台同一份。
// 值域 / 标签取奇门页的官方常量(DunJiaCalc),显隐 / 置灰判据与奇门页、三式合一页同一条件。
// 缺了它们,用户在页面改过子参数后,择日扫描按引擎缺省扫,与页面不同口径。
import { ZHIRUN_LEAP_OPTIONS, YUEJIA_QIJU_OPTIONS, YIXING_OPTIONS, qijuMethodUsesJieqiFa } from '../dunjia/DunJiaCalc';

// 排盘体例缺省 = 时家;起局法缺省 = 置闰(引擎 calcDunJia 缺省)
const paiPanOf = (o)=>(o.paiPanType === undefined || o.paiPanType === null || o.paiPanType === '' ? 3 : o.paiPanType);
const qijuOf = (o)=>(o.qijuMethod === undefined || o.qijuMethod === null || o.qijuMethod === '' ? 'zhirun' : o.qijuMethod);

// 置闰阈值只作用于「置闰」起局法 × 时家 / 刻家
export const QIMEN_ZHIRUN_LEAP_FIELD = Object.freeze({
	key: 'zhirunLeapDays', label: '置闰天数', dv: 9, options: ZHIRUN_LEAP_OPTIONS,
	when: (o)=>qijuOf(o || {}) === 'zhirun' && qijuMethodUsesJieqiFa(paiPanOf(o || {})),
});
// 月家起局只在月家排盘下起作用(其余体例置灰)
export const QIMEN_YUEJIA_QIJU_FIELD = Object.freeze({
	key: 'yueJiaQiJuType', label: '月家起局', dv: 0, options: YUEJIA_QIJU_OPTIONS,
	disabled: (o)=>Number(paiPanOf(o || {})) !== 1,
});
// 移星(原宫 / 顺转 N 宫)
export const QIMEN_SHIFT_PALACE_FIELD = Object.freeze({
	key: 'shiftPalace', label: '移星', dv: 0, options: YIXING_OPTIONS,
});
