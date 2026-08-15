// 编译冒烟锁:ChartList/CaseList/ChartData/CaseData 是公私共用、高频批量改动的管理面组件,
// 多数只被 pages/index.js 引用 —— 单跑 utils 套件时 JSX/import 断裂不会现形,这里补一道
// 「import 即编译」的最低闸(组件面批量改纪律:收口必须编译零 error)。
import ChartList, { isEditableChartRecord } from '../../components/user/ChartList';
import CaseList from '../../components/user/CaseList';
import ChartData from '../../components/user/ChartData';
import CaseData from '../../components/user/CaseData';
import ChartAddFormComp from '../../components/user/ChartAddFormComp';
import CaseAddFormComp from '../../components/user/CaseAddFormComp';

it('user management components import cleanly (compile canary)', ()=>{
	[ChartList, CaseList, ChartData, CaseData, ChartAddFormComp, CaseAddFormComp].forEach((c)=>{
		expect(typeof c).toBe('function');
	});
	expect(typeof isEditableChartRecord).toBe('function');
});
