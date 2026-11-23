// 奇门择日·找局工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 条件本地求值;参数区 = 奇门参数里对盘面生效的子集(缺省收起只露胶囊摘要),地点行带「从主盘重载」;
// 结果表「局」列;概览浮窗 = 奇门迷你盘(宿主给出扫描时冻结的地点 / 参数 / 种子)。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import QimenMiniBoardPopup from './QimenMiniBoardPopup';
import {
	PAIPAN_OPTIONS, QIJU_METHOD_OPTIONS, SCHOOL_OPTIONS, ZHISHI_OPTIONS,
	KONG_MODE_OPTIONS, MA_MODE_OPTIONS, TIME_ALG_OPTIONS, DAY_SWITCH_OPTIONS,
	qijuMethodOptionsFor, qijuMethodSelectValue,
} from '../dunjia/DunJiaCalc';
import { QIMEN_ZHIRUN_LEAP_FIELD, QIMEN_YUEJIA_QIJU_FIELD, QIMEN_SHIFT_PALACE_FIELD } from './qimenWorkbenchFields';
import {
	QIMEN_CONDITION_TYPES, newQimenLeaf, newQimenGroup, qimenLeafSummary,
} from '../../divination/zeri/qimenConditionTypes';
import { qimenZeriSchemeStore } from '../../divination/zeri/schemeStore';

// 排盘体例缺省 = 时家;起局法档位 / 回显随它(与奇门页、三式合一页同一判据:非时家刻家只有「本家默认 / 阴盘」)
const paiPanOf = (o)=>(o.paiPanType === undefined || o.paiPanType === null || o.paiPanType === '' ? 3 : o.paiPanType);

// 晚子时时干开关(v2.2.1 语义;奇门页不设此控件,始终随全局,这里给择日扫描单独选)。
const LATE_ZI_OPTIONS = [
	{ value: 1, label: '晚子时·次日干起(默认)' },
	{ value: 0, label: '晚子时·当日干起' },
];

// 参数区描述表(值/标签全取 DunJiaCalc 官方常量,置灰联动复刻 DunJiaMain 左栏三条)。
// 死开关裁剪:性别/盘类/封局/相关人员与扫描判定无关,不入本区。
export const QIMEN_WORKBENCH_PARAM_FIELDS = [
	{ key: 'paiPanType', label: '排盘', options: PAIPAN_OPTIONS },
	{ key: 'qijuMethod', label: '起局', options: QIJU_METHOD_OPTIONS, optionsFor: (o)=>qijuMethodOptionsFor(paiPanOf(o)), selectValue: (o)=>qijuMethodSelectValue(paiPanOf(o), o.qijuMethod) },
	// 置闰天数 / 月家起局:与三式择日工作台同一份描述(qimenWorkbenchFields)
	QIMEN_ZHIRUN_LEAP_FIELD,
	{ key: 'shuziReportNumber', label: '报数', kind: 'input', when: (o)=>o.qijuMethod === 'shuzi' },
	{ key: 'school', label: '盘式', options: SCHOOL_OPTIONS },
	{ key: 'zhiShiType', label: '值使', options: ZHISHI_OPTIONS, disabled: (o)=>o.school !== '转盘' },
	QIMEN_YUEJIA_QIJU_FIELD,
	{ key: 'kongMode', label: '空亡', options: KONG_MODE_OPTIONS },
	{ key: 'yimaMode', label: '驿马', options: MA_MODE_OPTIONS },
	QIMEN_SHIFT_PALACE_FIELD,
	{ key: 'timeAlg', label: '时间算法', options: TIME_ALG_OPTIONS },
	{ key: 'after23NewDay', label: '日界', options: DAY_SWITCH_OPTIONS },
	{ key: 'lateZiHourUseNextDay', label: '晚子时时干', options: LATE_ZI_OPTIONS },
];

const QIMEN_SCHOOL = {
	name: '奇门择日',
	types: QIMEN_CONDITION_TYPES, newLeaf: newQimenLeaf, newGroup: newQimenGroup, leafSummary: qimenLeafSummary,
	categorySeed: ['格局', '盘面', '纲要', '四柱'],
	defaultDraftType: 'pattern_ji',
	store: qimenZeriSchemeStore,
	disclaimerSubject: '盘面条件',
	params: {
		layout: 'panel', fields: () => QIMEN_WORKBENCH_PARAM_FIELDS,
		chipKeys: ['paiPanType', 'qijuMethod', 'school', 'kongMode', 'yimaMode', 'timeAlg', 'after23NewDay'],
		chipPrefix: { kongMode: '空亡', yimaMode: '驿马' },
	},
	reloadFromBoard: true,	// 「从主盘重载」:用左栏「起盘选项」当前值覆盖本面板的地点与参数
	natal: null,
	badge: { header: '局', width: 118, text: (row) => row.juText },
	vocab: { action: '找局', staleWhat: '条件/参数/时间范围' },
	// 概览浮窗 = 奇门迷你盘(宿主给出扫描时冻结的地点 / 参数 / 种子)
	preview: ({ row, props, onClose }) => (props.previewCtx ? (
		<QimenMiniBoardPopup row={row} geoParams={props.previewCtx.geoParams} options={props.previewCtx.options} seeds={props.previewCtx.seeds} onClose={onClose} />
	) : null),
};

export default function QimenZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={QIMEN_SCHOOL} />;
}
