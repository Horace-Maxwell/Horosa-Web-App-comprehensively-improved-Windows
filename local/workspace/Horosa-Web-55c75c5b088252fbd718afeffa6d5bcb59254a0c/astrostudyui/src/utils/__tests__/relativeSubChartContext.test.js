// 合盘页:清空「星盘A」不报错;子页(组合 / 影响 / 时空中点 / 马克斯)左栏标题与「重算」对着当前合盘,而不是本命盘。
import fs from 'fs';
import path from 'path';

const R = (f) => fs.readFileSync(path.resolve(__dirname, '../../', f), 'utf8');
const { jsxNodes } = require('./helpers/jsxProps');
const AstroRelative = require('../../components/astro/AstroRelative').default;

describe('合盘子页上下文', () => {
	test('清空星盘A(rec 为空)不抛错,chartA 置空', () => {
		const states = [];
		const self = { props: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 } } }, state: { chartA: { txt: 'x' }, chartB: null },
			setState: (s) => states.push(s), doChart: () => {} };
		expect(() => AstroRelative.prototype.selectChartA.call(self, null)).not.toThrow();
		expect(states[states.length - 1]).toEqual({ chartA: null, updating: false });   // 清空同时作废在途请求、收起更新角标
		// 有记录时仍带上当前宫制 / 黄道
		const rec = { name: '甲', birth: '1990-01-01 10:00:00' };
		AstroRelative.prototype.selectChartA.call(self, rec);
		expect(rec.hsys).toBe(1);
		expect(rec.zodiacal).toBe(0);
	});
	test('标题 = 子盘名 · A × B;同标题复用同一对象;「重算」= 重排当前合盘', () => {
		let redo = 0;
		const self = { state: { chartA: { record: { name: '甲' } }, chartB: { record: { name: '乙' } } }, clickDoChart: () => { redo += 1; } };
		const ctx = AstroRelative.prototype.relativeContextFor.call(self, 'Composite');
		expect(ctx.title).toBe('组合盘 · 甲 × 乙');
		expect(AstroRelative.prototype.relativeContextFor.call(self, 'Composite')).toBe(ctx);
		ctx.onRecalc();
		expect(redo).toBe(1);
		expect(AstroRelative.prototype.relativeContextFor.call(self, 'Marks').title).toBe('马克斯盘 · 甲 × 乙');
		self.state.chartB = { record: { name: '丙' } };
		expect(AstroRelative.prototype.relativeContextFor.call(self, 'Composite').title).toBe('组合盘 · 甲 × 丙');
	});
	test('四个子页都把合盘上下文传给内嵌盘;内嵌盘左栏按它显示「合盘设置」与「重算合盘」', () => {
		const rel = R('components/astro/AstroRelative.js');
		['Composite', 'Synastry', 'TimeSpace', 'Marks'].forEach((k) => { expect(rel).toContain(`relativeContext={this.relativeContextFor('${k}')}`); });
		[['relative/AstroComposite.js', 1], ['relative/AstroTimeSpace.js', 1], ['relative/AstroSynastry.js', 2], ['relative/AstroMarks.js', 2]].forEach(([f, n]) => {
			const subs = jsxNodes(R(`components/${f}`), 'AstroChartMain').filter((e) => e.attrs.embeddedSubChart === true && e.attrs.relativeContext === 'this.props.relativeContext');
			expect([f, subs.length]).toEqual([f, n]);
		});
		const main = R('components/astro/AstroChartMain.js');
		expect(main).toContain("{relCtx ? '合盘设置' : '命盘设置'}");
		expect(main).toContain('onClick={relCtx && relCtx.onRecalc ? relCtx.onRecalc : this.newChart}');
		expect(main).toContain("{relCtx && relCtx.onRecalc ? '重算合盘' : '重算星盘'}");
	});
});
