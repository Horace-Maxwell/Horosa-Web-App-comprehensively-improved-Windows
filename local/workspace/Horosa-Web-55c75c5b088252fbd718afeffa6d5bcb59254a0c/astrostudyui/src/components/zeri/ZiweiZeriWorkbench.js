// 紫微择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 参数只调性别 / 时间算法;其余排盘口径取自盘面左栏的紫微设置(扫描与点开的盘同一口径),参数行末尾只读显示;
// 用事人本命区(本命命宫支);结果表「命宫·局」列;结果过期时另注本结果的排盘口径与现在的紫微设置差在哪。
// 🔴 口径注:紫微设置全缺省时 = Java 兼容三键(主页默认态所见);紫微页拨了引擎键(立春界 / 全星集 / 人盘 …),扫描随之。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import {
	ZIWEI_CONDITION_TYPES, newZiweiLeaf, newZiweiGroup, ziweiLeafSummary,
} from '../../divination/zeri/ziweiZeriConditionTypes';
import { ziweiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { ZIWEI_ZERI_WORKBENCH_FIELDS, ziweiZeriCalibreItems } from '../ziwei/ziweiOptions';

// 工作台只调性别 / 时间算法;其余排盘口径取自盘面左栏的紫微设置(扫描与点开的盘同一口径),参数行末尾只读显示
function ziweiPageCalibre({ pageOptions }){
	const items = ziweiZeriCalibreItems(pageOptions);
	return (
		<span className="horosa-zeri-ziwei-page-calibre" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: 'var(--horosa-text-secondary)' }}>
			<span>排盘口径(取自紫微设置)</span>
			{items.map((x) => (<span key={x.key} style={{ padding: '0 6px', borderRadius: 8, border: '1px solid var(--horosa-border)' }}>{x.label}:{x.value}</span>))}
			{items.length ? null : <span>缺省</span>}
		</span>
	);
}

const ZIWEI_SCHOOL = {
	name: '紫微择日', tech: 'ziwei',
	types: ZIWEI_CONDITION_TYPES, newLeaf: newZiweiLeaf, newGroup: newZiweiGroup, leafSummary: ziweiLeafSummary,
	categorySeed: ['局式', '命身', '安星', '四化', '亮度', '主宰', '会照', '本命'],
	defaultDraftType: 'ming_zhu_xing',
	store: ziweiZeriSchemeStore,
	disclaimerSubject: '紫微盘面',
	params: { layout: 'inline', fields: () => ZIWEI_ZERI_WORKBENCH_FIELDS, extra: ziweiPageCalibre },
	natal: { label: '用事人本命(命宫)' },
	badge: { header: '命宫·局', width: 150, text: (row) => (row.juText ? `${row.mingText || '—'}·${row.juText}` : (row.mingText || '—')) },
};

export default function ZiweiZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={ZIWEI_SCHOOL} />;
}
