// 印度择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套;远端 Muhurta 按段扫描)。
// 参数:岁差制 / 交点 / 本命月宿 · 月座(0 = 未设;设后 Tara / Chandra 本命组条件生效)。结果为分钟级区间(单请求 93 天限)。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import { INDIA_AYANAMSA_OPTIONS } from '../../constants/AstroConst';
import {
	INDIA_CONDITION_TYPES, newIndiaLeaf, newIndiaGroup, indiaLeafSummary, IN_NAK27, IN_SIGNS,
} from '../../divination/zeri/indiaZeriConditionTypes';
import { indiaZeriSchemeStore } from '../../divination/zeri/schemeStore';

// 工作台参数表。渲染与宿主完整缺省(zeriOptionDefaults)同读这一份。
export function indiaWorkbenchParamFields(){
	return [
		// 岁差制与印度页同一份表(扫描后端同源 47 制);自定义历元槽位只存在本机印度页,扫描端不认,不列
		{ key: 'ayanamsa', label: '岁差制', dv: 'lahiri', options: INDIA_AYANAMSA_OPTIONS.filter((o) => o.value !== 'user').map((o) => ({ value: o.value, label: o.value === 'lahiri' ? `${o.label}（默认）` : o.label })) },
		{ key: 'nodeType', label: '交点', dv: 'mean', options: [{ value: 'mean', label: '平交点' }, { value: 'true', label: '真交点' }] },
		{ key: 'natalMoonNak', label: '本命月宿', dv: 0, options: [{ value: 0, label: '未设' }, ...IN_NAK27.map((n, i) => ({ value: i + 1, label: `${i + 1}.${n}` }))] },
		{ key: 'natalMoonSign', label: '本命月座', dv: 0, options: [{ value: 0, label: '未设' }, ...IN_SIGNS.map((n, i) => ({ value: i + 1, label: n }))] },
	];
}

const INDIA_SCHOOL = {
	name: '印度择日', tech: 'india',
	types: INDIA_CONDITION_TYPES, newLeaf: newIndiaLeaf, newGroup: newIndiaGroup, leafSummary: indiaLeafSummary,
	categorySeed: ['五肢', '上升', '曜位', '日段', '本命'],
	defaultDraftType: 'tithi',
	store: indiaZeriSchemeStore,
	disclaimerSubject: '印度盘面',
	params: { layout: 'inline', fields: indiaWorkbenchParamFields },
	natal: null,	// 本命月宿 / 月座在参数行(0 = 未设)
	badge: null,
	vocab: { progressUnit: '段' },	// 远端按段扫描
};

export default function IndiaZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={INDIA_SCHOOL} />;
}
