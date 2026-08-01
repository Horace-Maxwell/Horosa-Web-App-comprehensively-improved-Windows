// 演禽右栏「演法」面板 SSR 冒烟:4 子页签各渲染不抛(捕获 JSX/import/引擎运行时错误)。
// 时间复用左栏 → 传 mock fields(moment)。
import React from 'react';
import moment from 'moment';
import { renderToStaticMarkup } from 'react-dom/server';
import YanQinBranchPanel from '../YanQinBranchPanel';

const fields = {
	date: { value: moment('2008-01-01') },
	time: { value: moment('2008-01-01 12:30:00') },
	gender: { value: 1 },
};

describe('演禽 演法面板 SSR 冒烟', () => {
	[
		{ sub: 'qiqin', expect: '起禽推导' },
		{ sub: 'zeri', expect: '值日吉凶歌' },
		{ sub: 'zhanbu', expect: '三传四课' },
		{ sub: 'toutai', expect: '投胎度数' },
	].forEach(({ sub, expect: needle }) => {
		test(`子页签 ${sub} 渲染不抛且含「${needle}」`, () => {
			let html = '';
			expect(() => { html = renderToStaticMarkup(<YanQinBranchPanel initialSub={sub} fields={fields} />); }).not.toThrow();
			expect(html).toContain(needle);
		});
	});
	test('无 fields 时不抛、提示取左栏时间', () => {
		let html = '';
		expect(() => { html = renderToStaticMarkup(<YanQinBranchPanel initialSub="zeri" />); }).not.toThrow();
		expect(html).toContain('左栏');
	});
});

// 回归守卫:性别 → 投胎「男/女命」标签(修两症:①props.gender 半死开关——系统A 性别拨到女、
// 演法投胎仍男命;②真值误判——string '0'/'Female'/'女' 皆 truthy 被当男)。resolveMaleFlag 规范化 1/0。
describe('演禽 投胎 男/女命 = 性别(props.gender 优先 + 规范化,防半死开关/真值误判)', () => {
	const toutaiHtml = (props) => renderToStaticMarkup(<YanQinBranchPanel initialSub="toutai" fields={fields} {...props} />);
	test('props.gender=1(男)→ 男命', () => { expect(toutaiHtml({ gender: 1 })).toContain('男命'); });
	test('props.gender=0(女·数字)→ 女命,非男命', () => { const h = toutaiHtml({ gender: 0 }); expect(h).toContain('女命'); expect(h).not.toContain('男命'); });
	test("props.gender='0'(女·字符串,旧 truthy 会误判男)→ 女命", () => { const h = toutaiHtml({ gender: '0' }); expect(h).toContain('女命'); expect(h).not.toContain('男命'); });
	test("props.gender='Female'/'F'/'女'→ 女命", () => {
		['Female', 'F', '女'].forEach((g) => { const h = toutaiHtml({ gender: g }); expect(h).toContain('女命'); expect(h).not.toContain('男命'); });
	});
	test('props.gender 优先于 fields.gender(半死开关:命盘 fields=男、拨女 → 女命)', () => {
		const maleFields = { ...fields, gender: { value: 1 } };
		const h = renderToStaticMarkup(<YanQinBranchPanel initialSub="toutai" fields={maleFields} gender={0} />);
		expect(h).toContain('女命'); expect(h).not.toContain('男命');
	});
	test('无 props.gender → 回退 fields.gender(value=0 → 女命)', () => {
		const femaleFields = { ...fields, gender: { value: 0 } };
		const h = renderToStaticMarkup(<YanQinBranchPanel initialSub="toutai" fields={femaleFields} />);
		expect(h).toContain('女命'); expect(h).not.toContain('男命');
	});
});
