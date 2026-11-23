// 三式择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 参数区三段(六壬 / 奇门 / 太乙 + 共享日界与时基,平铺后经 splitSanshiOptions 单源拆三家),缺省收起只露胶囊摘要;
// 条件跨式混排(lr_ / qm_ / ty_ 前缀,按「家名·类别」分组);用事人本命区(六壬家条件用);结果表「三家」列(课名·奇门局·太乙局)。
import ZeriWorkbenchShell, { workbenchParamValue, workbenchParamLabel } from './ZeriWorkbenchShell';
import {
	PAIPAN_OPTIONS, SCHOOL_OPTIONS, ZHISHI_OPTIONS,
	KONG_MODE_OPTIONS, MA_MODE_OPTIONS, TIME_ALG_OPTIONS, DAY_SWITCH_OPTIONS,
	qijuMethodOptionsFor, qijuMethodSelectValue,
} from '../dunjia/DunJiaCalc';
import { QIMEN_ZHIRUN_LEAP_FIELD, QIMEN_YUEJIA_QIJU_FIELD, QIMEN_SHIFT_PALACE_FIELD } from './qimenWorkbenchFields';
import {
	SANSHI_CONDITION_TYPES, newSanshiLeaf, newSanshiGroup, sanshiLeafSummary,
} from '../../divination/zeri/sanshiZeriConditionTypes';
import { sanshiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { TAIYI_ACCUM_OPTIONS } from '../taiyi/core/TaiYiCore';

// 排盘体例缺省 = 时家;起局法档位 / 回显随它(与奇门页、三式合一页同一判据)
const paiPanOf = (o)=>(o.paiPanType === undefined || o.paiPanType === null || o.paiPanType === '' ? 3 : o.paiPanType);

// 三段参数区的描述表(merged 平铺,splitSanshiOptions 单源拆三家;各键判别力由各家金标证)。渲染时现取(日界缺省 = 全局现值)。
// 奇门家的定局子参数 / 移星与奇门择日工作台同一份描述(qimenWorkbenchFields);扫描消费而宿主不从内嵌页播种的奇门键都必须在这里(合同测试)
export function sanshiWorkbenchParamFields(){
	return [
		{ key: 'yueMode', label: '六壬·换将', dv: 'zhongqi', options: [{ value: 'zhongqi', label: '中气过宫' }, { value: 'jieqi', label: '节气换将' }] },   // 档名与六壬页同(「太阳过宫·日躔」是页面另一档,扫描不支持)
		{ key: 'guirengType', label: '六壬·贵人体系', dv: 2, options: [{ value: 0, label: '六壬法贵人' }, { value: 1, label: '遁甲法贵人' }, { value: 2, label: '星占法贵人' }, { value: 3, label: '甲戊兼牛羊' }, { value: 4, label: '干合阳阴贵' }] },
		// 昼夜阳阴归属只在六壬法贵人下起作用(与六壬页 / 三式合一页同条件置灰)
		{ key: 'yinyangSystem', label: '六壬·昼夜阳阴归属', dv: 'danmu', options: [{ value: 'danmu', label: '旦暮系(默认)' }, { value: 'yinyang', label: '星历阳阴系' }], disabled: (o) => Number(o.guirengType !== undefined ? o.guirengType : 2) !== 0 },
		// dv = 引擎缺省(计算面 calcDunJia:paiPanType 3 时家 / qijuMethod zhirun 置闰 / kongMode·yimaMode 'day'),
		// 此前显示年家·拆补·0 ≠ 实际扫描口径,且 0 不在空亡/驿马值域内显示为空
		{ key: 'paiPanType', label: '奇门·排盘', dv: 3, options: PAIPAN_OPTIONS },
		{ key: 'qijuMethod', label: '奇门·起局', dv: 'zhirun', optionsFor: (o) => qijuMethodOptionsFor(paiPanOf(o)), selectValue: (o) => qijuMethodSelectValue(paiPanOf(o), o.qijuMethod !== undefined ? o.qijuMethod : 'zhirun') },
		// 置闰天数(置闰起局 × 时家 / 刻家才显示):与奇门择日工作台同一份描述
		{ ...QIMEN_ZHIRUN_LEAP_FIELD, label: `奇门·${QIMEN_ZHIRUN_LEAP_FIELD.label}` },
		// 阴盘起局靠报数定局(引擎已收报数;此前没有输入框,选了阴盘实际扫的是缺省局)
		{ key: 'shuziReportNumber', label: '奇门·报数', kind: 'input', when: (o) => o.qijuMethod === 'shuzi' },
		{ key: 'school', label: '奇门·盘式', dv: '转盘', options: SCHOOL_OPTIONS },
		// 值使取法只在转盘起作用(飞盘 / 混合置灰,与奇门页同)
		{ key: 'zhiShiType', label: '奇门·值使', dv: 0, options: ZHISHI_OPTIONS, disabled: (o) => (o.school || '转盘') !== '转盘' },
		// 月家起局(月家排盘才可选):与奇门择日工作台同一份描述
		{ ...QIMEN_YUEJIA_QIJU_FIELD, label: `奇门·${QIMEN_YUEJIA_QIJU_FIELD.label}` },
		{ key: 'kongMode', label: '奇门·空亡', dv: 'day', options: KONG_MODE_OPTIONS },
		{ key: 'yimaMode', label: '奇门·驿马', dv: 'day', options: MA_MODE_OPTIONS },
		{ ...QIMEN_SHIFT_PALACE_FIELD, label: `奇门·${QIMEN_SHIFT_PALACE_FIELD.label}` },
		{ key: 'taiyiAccum', label: '太乙·古法公式', dv: 0, options: TAIYI_ACCUM_OPTIONS.map((o)=>({ value: o.value, label: o.label })) },   // 档名复用主太乙页
		// 奇门家的时间算法(与三式合一页同:六壬家用奇门的时柱,扫描里六壬家随之同取);太乙家恒按钟表时(扫描引擎钉死口径),标签写明,免得当成三家共用
		{ key: 'timeAlg', label: '时间算法(奇门)', dv: 0, options: TIME_ALG_OPTIONS },
		{ key: 'after23NewDay', label: '日界', dv: defaultAfter23NewDay(), options: DAY_SWITCH_OPTIONS },	// dv=全局现值(复审 F8 同族)
		{ key: 'lateZiHourUseNextDay', label: '晚子时干', dv: defaultLateZiHourUseNextDay(), options: [{ value: 1, label: '次日干' }, { value: 0, label: '当日干' }] },
	];
}

// 参数字段的当前取值 / 当前档名:与九家共用的同一出口(下拉与收起时的胶囊摘要)
export const sanshiParamValue = workbenchParamValue;
export const sanshiParamLabel = workbenchParamLabel;
// 收起时摘要里露出的键(三家各取最要紧的口径;其余展开看)
const SANSHI_CHIP_KEYS = ['yueMode', 'guirengType', 'paiPanType', 'qijuMethod', 'school', 'taiyiAccum', 'timeAlg', 'after23NewDay'];

const SANSHI_SCHOOL = {
	name: '三式择日', tech: 'sanshi',
	types: SANSHI_CONDITION_TYPES, newLeaf: newSanshiLeaf, newGroup: newSanshiGroup, leafSummary: sanshiLeafSummary,
	categorySeed: [],	// 类别 = 「家名·类别」,按注册表次序
	defaultDraftType: 'lr_ke_name',	// 合并注册表键(lr_ 前缀)
	store: sanshiZeriSchemeStore,
	disclaimerSubject: '三式盘面',
	params: { layout: 'panel', fields: sanshiWorkbenchParamFields, chipKeys: SANSHI_CHIP_KEYS },
	natal: {
		label: '用事人本命(六壬家条件用)',
		// 三式盘没有卜卦人出生:点开的盘上六壬家「年命」按起盘年支显示,与这里的本命不是同一项(只注明,不改盘)
		note: () => (<span className="horosa-zeri-natal-calibre-note" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>本命组条件按此本命判;点开的三式盘上「年命」是起盘年支</span>),
	},
	badge: { header: '三家(课·局·局)', width: 150, text: (row) => row.sanshiText },
};

export default function SanshiZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={SANSHI_SCHOOL} />;
}
