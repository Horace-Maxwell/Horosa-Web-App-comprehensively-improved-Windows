// 挂载技法多选下拉「术数域」分组器(req#1)轻量断言。
// 覆盖:命名域正确归组 + 组序 + 空域不渲染 + 未归组键落「其他」恒置尾 + 零丢零增(全量守恒)。
import { groupMountTechniqueOptions } from '../../components/aianalysis/mountTechniqueGroups';

describe('groupMountTechniqueOptions 域分组', ()=>{
	it('跨域键按域归组、空域不渲染、未归组键落「其他」置尾', ()=>{
		const options = [
			{ value: 'astrochart', label: '占星本命盘' }, // 西方占星
			{ value: 'bazi', label: '八字' },             // 中式命理
			{ value: 'sixyao', label: '六爻' },           // 占卜术数
			{ value: '__mystery__', label: '未登记技法' }, // 无域 → 其他
		];
		const groups = groupMountTechniqueOptions(options);
		const titles = groups.map((g)=>g.title);

		// 组序沿用导出侧域序;「星运推运」无可挂键 → 整组不渲染;「其他」恒置尾。
		expect(titles).toEqual(['西方占星', '中式命理', '占卜术数', '其他']);
		expect(titles).not.toContain('星运推运');
		expect(titles[titles.length - 1]).toBe('其他');

		const byTitle = new Map(groups.map((g)=>[g.title, g.items.map((it)=>it.value)]));
		expect(byTitle.get('西方占星')).toContain('astrochart');
		expect(byTitle.get('中式命理')).toContain('bazi');
		expect(byTitle.get('占卜术数')).toContain('sixyao');
		expect(byTitle.get('其他')).toEqual(['__mystery__']);
	});

	it('零丢零增:分组后各项并集 == 输入(仅重排/归组,不改 value/label)', ()=>{
		const options = [
			{ value: 'ziwei', label: '紫微斗数' },
			{ value: 'qimen', label: '奇门遁甲' },
			{ value: 'astrochart', label: '占星' },
			{ value: '__x__', label: 'X' },
		];
		const groups = groupMountTechniqueOptions(options);
		const flat = groups.reduce((acc, g)=>acc.concat(g.items), []);
		expect(flat.length).toBe(options.length);
		// value 集合守恒
		expect(new Set(flat.map((it)=>it.value))).toEqual(new Set(options.map((o)=>o.value)));
		// label 透传不变
		flat.forEach((it)=>{
			const src = options.find((o)=>o.value === it.value);
			expect(it.label).toBe(src.label);
		});
	});

	it('空输入 → 空数组(不产生空「其他」组)', ()=>{
		expect(groupMountTechniqueOptions([])).toEqual([]);
		expect(groupMountTechniqueOptions(null)).toEqual([]);
		expect(groupMountTechniqueOptions(undefined)).toEqual([]);
	});

	it('全部键均无域 → 单一「其他」组', ()=>{
		const groups = groupMountTechniqueOptions([
			{ value: '__a__', label: 'A' },
			{ value: '__b__', label: 'B' },
		]);
		expect(groups.map((g)=>g.title)).toEqual(['其他']);
		expect(groups[0].items.map((it)=>it.value)).toEqual(['__a__', '__b__']);
	});
});
