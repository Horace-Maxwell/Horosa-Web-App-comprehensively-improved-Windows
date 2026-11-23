// 八字择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 参数五项(时间算法 / 换日 / 晚子时干 / 神煞查法 / 长生口径,与主八字页同枚举同默认,扫描与点开起盘同一口径);
// 用事人本命区(选填,解锁「本命」组条件);结果表「四柱」列;概览浮窗 = 八字迷你盘。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import {
	BAZI_CONDITION_TYPES, newBaziLeaf, newBaziGroup, baziLeafSummary,
} from '../../divination/zeri/baziZeriConditionTypes';
import { baziZeriSchemeStore } from '../../divination/zeri/schemeStore';

// 工作台五参数(与主八字页同枚举同默认;扫描与 pick 起盘口径严格一致)。出厂值住在宿主缺省对象(baziZeriDefaultOptions)。
// 渲染与宿主完整缺省(zeriOptionDefaults)同读这一份。
export function baziWorkbenchParamFields(){
	return [
		{ key: 'timeAlg', label: '时间算法', options: [{ value: 0, label: '真太阳时' }, { value: 3, label: '平太阳时' }, { value: 1, label: '直接时间' }] },   // 与八字页同档(平太阳时 = 只按经度差、不加均时差)
		{ key: 'after23NewDay', label: '换日', options: [{ value: 1, label: '23点算第二天' }, { value: 0, label: '24点算第二天' }] },   // 档名与全局「日界点」同
		{ key: 'lateZiHourUseNextDay', label: '晚子时干', options: [{ value: 1, label: '次日干' }, { value: 0, label: '当日干' }] },
		// W0 死开关根修:曾发数值 0/1/2 而 allowedBases 只认 '年'/'日'/'年日'——三档全落默认,零判别
		{ key: 'godKeyPos', label: '神煞查法', options: [{ value: '年日', label: '年柱日柱都查' }, { value: '年', label: '按年柱查' }, { value: '日', label: '按日柱查' }] },
		// 档名与主八字页 CnTraditionInput 同(0 火土同 / 1 水土同 / 2 阳顺阴逆;前两档阴阳同序)
		{ key: 'phaseType', label: '长生', options: [{ value: 0, label: '长生火土同（阴阳同序）' }, { value: 1, label: '长生水土同（阴阳同序）' }, { value: 2, label: '长生阳顺阴逆' }] },
	];
}

const BAZI_SCHOOL = {
	name: '八字择日', tech: 'bazi',
	types: BAZI_CONDITION_TYPES, newLeaf: newBaziLeaf, newGroup: newBaziGroup, leafSummary: baziLeafSummary,
	categorySeed: ['四柱', '神煞', '纳音长生', '五行', '历法', '本命'],
	defaultDraftType: 'shensha_has',
	store: baziZeriSchemeStore,
	disclaimerSubject: '四柱盘面',
	params: { layout: 'inline', fields: baziWorkbenchParamFields },
	natal: { label: '用事人本命' },
	badge: { header: '四柱', width: 150, text: (row) => row.pillarText },	// 日柱X日X时
};

export default function BaziZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={BAZI_SCHOOL} />;
}
