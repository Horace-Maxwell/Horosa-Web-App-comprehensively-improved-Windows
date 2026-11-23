// 太乙择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 参数一项(古法公式,档名复用主太乙页);无本命区(太乙候选时刻盘无本命关系语义);结果表「局·太乙」列。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import {
	TAIYI_CONDITION_TYPES, newTaiyiLeaf, newTaiyiGroup, taiyiLeafSummary,
} from '../../divination/zeri/taiyiZeriConditionTypes';
import { taiyiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { TAIYI_ACCUM_OPTIONS } from '../taiyi/core/TaiYiCore';

// 工作台参数(与太乙页同枚举同默认;档名复用主太乙页 TAIYI_ACCUM_OPTIONS)。出厂值住在宿主缺省对象(taiyiZeriDefaultOptions)。
// 渲染与宿主完整缺省(zeriOptionDefaults)同读这一份。
export function taiyiWorkbenchParamFields(){
	return [
		{ key: 'tn', label: '古法公式', options: TAIYI_ACCUM_OPTIONS.map((o)=>({ value: o.value, label: o.label })) },
	];
}

const TAIYI_SCHOOL = {
	name: '太乙择日', tech: 'taiyi',
	types: TAIYI_CONDITION_TYPES, newLeaf: newTaiyiLeaf, newGroup: newTaiyiGroup, leafSummary: taiyiLeafSummary,
	categorySeed: ['局式', '落宫', '格局', '算数', '大将', '十六宫', '门户'],
	defaultDraftType: 'geju_kind',
	store: taiyiZeriSchemeStore,
	disclaimerSubject: '太乙盘面',
	params: { layout: 'inline', fields: taiyiWorkbenchParamFields },
	natal: null,	// 太乙候选时刻盘无本命关系语义
	badge: { header: '局·太乙', width: 170, text: (row) => (row.juText ? `${row.juText}·${row.taiyiText || ''}` : '') },
};

export default function TaiyiZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={TAIYI_SCHOOL} />;
}
