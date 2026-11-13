// 十个择日工作台的弹窗口径一致:点遮罩不关(maskClosable={false})、下拉挂进弹窗正文(不挂 body)。
// 十个工作台(天星「征象搜索」+ 八字 / 紫微 / 七政 / 印度 / 六壬 / 奇门 / 太乙 / 三式 / 黄历)同一口径;
// 共用的条件参数表单(ConditionParamsForm)的下拉也一直挂 body。
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');
const read = (f)=>fs.readFileSync(path.join(DIR, f), 'utf8');
const WORKBENCHES = ['ConditionBuilderModal.js', 'BaziZeriWorkbench.js', 'ZiweiZeriWorkbench.js', 'QizhengZeriWorkbench.js', 'IndiaZeriWorkbench.js',
	'LiurengZeriWorkbench.js', 'QimenZeriWorkbench.js', 'TaiyiZeriWorkbench.js', 'SanshiZeriWorkbench.js', 'HuangliZeriWorkbench.js'];

describe('择日工作台弹窗口径', ()=>{
	test('十个工作台都点遮罩不关', ()=>{
		WORKBENCHES.forEach((f)=>{ expect([f, /maskClosable=\{false\}/.test(read(f))]).toEqual([f, true]); });
	});
	test('天星工作台与共用参数表单的每个下拉都挂进弹窗正文', ()=>{
		['ConditionBuilderModal.js', 'ConditionParamsForm.js'].forEach((f)=>{
			const s = read(f);
			// 开标签里有箭头函数(=>),不能按「到第一个 > 为止」切;取每个 <XQSelect 到其后第一个 {选项 / 子元素} 之间的一段
			const starts = [];
			for(let i = s.indexOf('<XQSelect'); i >= 0; i = s.indexOf('<XQSelect', i + 1)){ starts.push(i); }
			expect(starts.length).toBeGreaterThan(0);
			starts.forEach((i)=>{
				const head = s.slice(i, i + 600).split(/\n\t*\{|<Option|<OptGroup|\{getHousesOption/)[0];
				expect([f, head.slice(0, 70), /getPopupContainer=/.test(head)]).toEqual([f, head.slice(0, 70), true]);
			});
		});
	});
});
