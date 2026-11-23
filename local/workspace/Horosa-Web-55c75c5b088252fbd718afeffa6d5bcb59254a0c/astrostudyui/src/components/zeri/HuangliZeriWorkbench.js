// 黄历择日·择吉工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 日粒度:时间范围只到日、预设按月年;黄历日课与地点 / 时刻无关,无地点区与参数区;逐日判定,连续吉日并为一段;
// 结果表「日课」列(建除·宿·黄黑道);概览 = 黄历日卡浮窗。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import HuangliDayPopup from './HuangliDayPopup';
import {
	HUANGLI_CONDITION_TYPES, newHuangliLeaf, newHuangliGroup, huangliLeafSummary,
} from '../../divination/zeri/huangliZeriConditionTypes';
import { huangliZeriSchemeStore } from '../../divination/zeri/schemeStore';

const HUANGLI_SCHOOL = {
	name: '黄历择日',
	types: HUANGLI_CONDITION_TYPES, newLeaf: newHuangliLeaf, newGroup: newHuangliGroup, leafSummary: huangliLeafSummary,
	categorySeed: ['用事', '神煞', '历法', '时辰'],
	defaultDraftType: 'yi_has',
	store: huangliZeriSchemeStore,
	disclaimerSubject: '通书条目',
	dayGrain: true,	// 日粒度:无时刻 / 无地点·参数区(黄历零参数,「从主盘重载」无意义故无)
	rangeNote: '黄历日课与地点/时刻无关;逐日判定,连续吉日自动并为一段。',
	params: null,
	natal: null,
	badge: { header: '日课(起日)', width: 150, text: (row) => row.badge },	// 建除·宿·黄黑道
	vocab: {
		action: '择吉',
		rangeTitle: '时间范围(日粒度)',
		presets: [['本月', 30], ['三月', 91], ['半年', 183], ['一年', 365]],
		progressUnit: '日',
		countUnit: '个日段',
		pickHint: '点击行即跳该日日课',
		startHeader: '起日(点击=跳该日)',
		endHeader: '止日(点击=跳该日)',
		startTitle: '跳到该日(黄历页选中)',
		endTitle: '跳到该日(黄历页选中)',
		emptyResult: '时间范围内无满足条件的日子。',
		explainCaption: '以起日逐条判读(设定 vs 实际;判定与扫描引擎同源)',
		previewHeader: '日卡',
		previewButton: '卡',
	},
	preview: ({ row, onClose }) => (<HuangliDayPopup row={row} onClose={onClose} />),
};

export default function HuangliZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={HUANGLI_SCHOOL} />;
}
