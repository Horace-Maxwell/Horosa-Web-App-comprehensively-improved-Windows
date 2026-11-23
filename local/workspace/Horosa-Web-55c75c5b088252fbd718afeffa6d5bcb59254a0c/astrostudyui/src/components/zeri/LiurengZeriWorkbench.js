// 六壬择日·择时工作台(派描述;交互与版式在共用壳 ZeriWorkbenchShell,九家同一套)。
// 参数五项(换将 / 贵人体系 / 昼夜阳阴归属 / 换日 / 晚子时干;昼夜按日出方程自动判,不是档位);用事人本命区(本命支 + 行年支);
// 结果表「课·三传」列。
// 🔴 供数差异窗(帮助分册同述):月将换将时刻分钟级 / 昼夜界折射 2–3 分钟 —— 窗内判定以扫描详情为准,点开后主页盘(后端星历)为最终显示。
import ZeriWorkbenchShell from './ZeriWorkbenchShell';
import {
	LIURENG_CONDITION_TYPES, newLiurengLeaf, newLiurengGroup, liurengLeafSummary,
} from '../../divination/zeri/liurengZeriConditionTypes';
import { liurengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';

// 工作台参数表(与主六壬页同枚举同默认;逐键判别力金标证;昼夜=日出方程自动判;时基恒真太阳=主页 gods 固有口径)。
// 渲染与宿主完整缺省(zeriOptionDefaults)同读这一份;渲染时现取(日界缺省 = 全局现值)。
export function liurengWorkbenchParamFields(){
	return [
		{ key: 'yueMode', label: '换将', dv: 'zhongqi', options: [{ value: 'zhongqi', label: '中气过宫' }, { value: 'jieqi', label: '节气换将' }] },   // 档名与六壬页同(「太阳过宫·日躔」是页面另一档,扫描不支持)
		{ key: 'guirengType', label: '贵人体系', dv: 2, options: [{ value: 0, label: '六壬法贵人' }, { value: 1, label: '遁甲法贵人' }, { value: 2, label: '星占法贵人' }, { value: 3, label: '甲戊兼牛羊' }, { value: 4, label: '干合阳阴贵' }] },
		// 昼夜阳阴归属只在六壬法贵人下起作用(与六壬页同条件置灰)
		{ key: 'yinyangSystem', label: '昼夜阳阴归属', dv: 'danmu', options: [{ value: 'danmu', label: '旦暮系(默认)' }, { value: 'yinyang', label: '星历阳阴系' }], disabled: (o) => Number(o.guirengType !== undefined ? o.guirengType : 2) !== 0 },
		{ key: 'after23NewDay', label: '换日', dv: defaultAfter23NewDay(), options: [{ value: 0, label: '24点算第二天' }, { value: 1, label: '23点算第二天' }] },	// dv=全局日界**现值**(主六壬页同源;曾写死与改过全局的用户分叉——复审 F8)
		{ key: 'lateZiHourUseNextDay', label: '晚子时干', dv: defaultLateZiHourUseNextDay(), options: [{ value: 1, label: '次日干' }, { value: 0, label: '当日干' }] },
	];
}

const LIURENG_SCHOOL = {
	name: '六壬择日', tech: 'liureng',
	types: LIURENG_CONDITION_TYPES, newLeaf: newLiurengLeaf, newGroup: newLiurengGroup, leafSummary: liurengLeafSummary,
	categorySeed: ['课体', '三传', '发用', '盘式', '四课', '日时', '神煞', '本命'],
	defaultDraftType: 'ke_name',
	store: liurengZeriSchemeStore,
	disclaimerSubject: '六壬盘面',
	params: { layout: 'inline', fields: liurengWorkbenchParamFields },
	natal: { label: '用事人本命(本命·行年)' },
	badge: { header: '课·三传', width: 150, text: (row) => (row.chuanText ? `${row.keText || '—'}·${row.chuanText}` : (row.keText || '—')) },
};

export default function LiurengZeriWorkbench(props){
	return <ZeriWorkbenchShell {...props} school={LIURENG_SCHOOL} />;
}
