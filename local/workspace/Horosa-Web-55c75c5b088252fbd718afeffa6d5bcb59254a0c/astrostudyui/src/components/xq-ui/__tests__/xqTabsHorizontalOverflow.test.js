// 横排页签条放不下时的溢出口径:不出「···」更多菜单,滚轮横滚 + 边缘渐隐(与竖排页签条同一套手感)。
import fs from 'fs';
import path from 'path';

const LESS = fs.readFileSync(path.resolve(__dirname, '..', 'styles.less'), 'utf8');
const block = (sel)=>{
	const at = LESS.indexOf(sel);
	expect({ sel, found: at >= 0 }).toEqual({ sel, found: true });
	return LESS.slice(at, LESS.indexOf('}', at));
};

describe('横排页签条溢出', ()=>{
	test('更多菜单按钮不显示(上 / 下两种横排都管)', ()=>{
		const b = block('.xq-tabs.ant-tabs-top > .ant-tabs-nav .ant-tabs-nav-operations,');
		expect(b).toMatch(/\.xq-tabs\.ant-tabs-bottom > \.ant-tabs-nav \.ant-tabs-nav-operations \{/);
		expect(b).toMatch(/display: none;/);
	});

	test('哪一端还有内容哪一端渐隐;两端都有时两端都渐隐', ()=>{
		expect(block('.xq-tabs.ant-tabs-top > .ant-tabs-nav .ant-tabs-nav-wrap.ant-tabs-nav-wrap-ping-left,')).toMatch(/mask-image: linear-gradient\(to right, transparent 0, #000 26px\);/);
		expect(block('.xq-tabs.ant-tabs-top > .ant-tabs-nav .ant-tabs-nav-wrap.ant-tabs-nav-wrap-ping-right,')).toMatch(/mask-image: linear-gradient\(to left, transparent 0, #000 26px\);/);
		const both = block('.xq-tabs.ant-tabs-top > .ant-tabs-nav .ant-tabs-nav-wrap.ant-tabs-nav-wrap-ping-left.ant-tabs-nav-wrap-ping-right,');
		expect(both).toMatch(/transparent 0, #000 26px, #000 ~"calc\(100% - 26px\)", transparent 100%/);
		// 「两端都有」的规则必须写在单端规则之后(同权重,后写的生效)
		expect(LESS.indexOf('.ant-tabs-nav-wrap-ping-left.ant-tabs-nav-wrap-ping-right,')).toBeGreaterThan(LESS.indexOf('.ant-tabs-nav-wrap.ant-tabs-nav-wrap-ping-right,'));
	});

	test('页签库自带的边缘投影不再叠在渐隐上', ()=>{
		expect(block('.xq-tabs.ant-tabs-top > .ant-tabs-nav .ant-tabs-nav-wrap::before,')).toMatch(/box-shadow: none;/);
	});

	test('只作用于直接子页签条(嵌套页签各管各的),不动竖排页签条与主导航', ()=>{
		const rules = LESS.match(/^\s*\.xq-tabs\.ant-tabs-(top|bottom)[^\n]*ant-tabs-nav-(operations|wrap)[^\n]*$/gm) || [];
		expect(rules.length).toBeGreaterThanOrEqual(10);
		rules.forEach((r)=>expect(r).toMatch(/^\s*\.xq-tabs\.ant-tabs-(top|bottom) > \.ant-tabs-nav /));
	});
});
