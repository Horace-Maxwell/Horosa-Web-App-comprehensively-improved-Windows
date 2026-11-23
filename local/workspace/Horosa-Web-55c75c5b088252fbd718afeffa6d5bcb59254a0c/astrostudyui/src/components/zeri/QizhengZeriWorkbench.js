// 七政择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套;远端按段扫描)。
// 参数三项(宿度制两档 / 罗计取法 / 月孛取法 —— 扫描判别力有金标;主页其余宿制为显示制,不入面);
// 结果为分钟级区间(远端扫描,单请求 93 天限)。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import {
	QIZHENG_CONDITION_TYPES, newQizhengLeaf, newQizhengGroup, qizhengLeafSummary,
} from '../../divination/zeri/qizhengZeriConditionTypes';
import { qizhengZeriSchemeStore } from '../../divination/zeri/schemeStore';

// 工作台参数表。渲染与宿主完整缺省(zeriOptionDefaults)同读这一份。
export function qizhengWorkbenchParamFields(){
	return [
		{ key: 'su28Mode', label: '宿度制', dv: 2, options: [{ value: 2, label: '回归今宿' }, { value: 3, label: '回归古制开禧' }] },
		{ key: 'nodeType', label: '罗计取法', dv: 'mean', options: [{ value: 'mean', label: '平交点' }, { value: 'true', label: '真交点' }] },
		{ key: 'lilithType', label: '月孛取法', dv: 'mean', options: [{ value: 'mean', label: '平远地点' }, { value: 'true', label: '真远地点' }] },
	];
}

const QIZHENG_SCHOOL = {
	name: '七政择日', tech: 'qizheng',
	types: QIZHENG_CONDITION_TYPES, newLeaf: newQizhengLeaf, newGroup: newQizhengGroup, leafSummary: qizhengLeafSummary,
	categorySeed: ['落宫', '落宿', '庙旺', '行度', '伏焦', '昼夜', '命宫', '会照', '化曜'],
	defaultDraftType: 'body_in_gong',
	store: qizhengZeriSchemeStore,
	disclaimerSubject: '七政盘面',
	params: { layout: 'inline', fields: qizhengWorkbenchParamFields },
	natal: null,
	badge: null,
	vocab: { progressUnit: '段' },	// 远端按段扫描
};

export default function QizhengZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={QIZHENG_SCHOOL} />;
}
