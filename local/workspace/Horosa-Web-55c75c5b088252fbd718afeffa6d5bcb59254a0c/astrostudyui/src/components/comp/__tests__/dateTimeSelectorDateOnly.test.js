// 只显示日期的选择器(通书择日等):步长下拉只有 年 / 月 / 天,± 也只按这三档走(小时 / 四分钟改的是看不见的时刻)。
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'DateTimeSelector.js'), 'utf8');

describe('日期专用选择器的步长', () => {
	const DateTimeSelector = require('../DateTimeSelector').default;
	test('showTime=false:有效步长落在 年 / 月 / 天;其余宿主照旧', () => {
		const eff = (props, timeType) => DateTimeSelector.prototype.effectiveTimeType.call({ props, state: { timeType } });
		expect(eff({ showTime: false }, 'h')).toBe('d');
		expect(eff({ showTime: false }, 'm')).toBe('d');
		expect(eff({ showTime: false }, 'M')).toBe('M');
		expect(eff({ showTime: false }, 'y')).toBe('y');
		expect(eff({}, 'h')).toBe('h');
		expect(eff({ showTime: true }, 'm')).toBe('m');
	});
	test('± 两个方向都走有效步长;日期专用分支的下拉不列小时 / 四分钟', () => {
		expect(SRC.match(/let ctype = this\.effectiveTimeType\(\);/g).length).toBe(2);
		const at = SRC.indexOf("if(this.props.showTime === false && !this.props.onlyYear && !this.props.yearMonth){");
		expect(at).toBeGreaterThan(0);
		const blk = SRC.slice(at, at + 700);
		expect(blk).toContain("<Option value='d'>天</Option>");
		const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');
		const sel = jsxNodes(SRC, 'Select').filter((e) => e.start > at).sort((a, b) => a.start - b.start)[0];
		const options = jsxNodes(sel.source, 'Option').map((o) => `${o.attrs.value}:${o.children}`);
		expect(options).toEqual(['y:年', 'M:月', 'd:天']);
	});
	test('通书择日用的是日期专用选择器', () => {
		const ts = fs.readFileSync(path.join(__dirname, '..', '..', 'calendar', 'TongshuControls.js'), 'utf8');
		expect(ts).toContain("defaultTimeType='d' showTime={false}");
	});
});
