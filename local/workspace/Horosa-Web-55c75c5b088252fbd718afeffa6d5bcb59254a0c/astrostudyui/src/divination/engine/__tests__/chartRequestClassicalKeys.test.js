// chartRequestClassicalKeys.test.js —— 卜卦/择日盘构参的古典参数透传哨兵：
// 默认态请求体键集零变(零回归);非默认 fields 才逐键条件下发,与主盘 fieldsToParams 同口径。
import { buildChartParams } from '../chartRequest';

const w = (v) => ({ value: v, name: ['x'] });

function baseFields(){
	return {
		cid: w('c1'), lat: w('39n54'), lon: w('116e28'), gpsLat: w(39.9), gpsLon: w(116.47),
		hsys: w(2), zodiacal: w(0), tradition: w(1), pos: w('北京'),
	};
}

describe('buildChartParams 古典参数条件透传', () => {
	test('默认态：七键一律不出现在请求体(零回归锚)', () => {
		const p = buildChartParams({
			...baseFields(),
			termsVariant: w(0), geminiBoundEmended: w(0),
			westNodeType: w('mean'), sectBuffer: w('geo'),
			leoBoundFirst: w(0), triplicity: w('Dorothean'), lotReversal: w(1),
		});
		['termsVariant', 'geminiBoundEmended', 'westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal']
			.forEach((k) => expect(Object.prototype.hasOwnProperty.call(p, k)).toBe(false));
	});

	test('缺省 fields(键不存在)与显式默认同构 —— 键集完全一致', () => {
		const a = buildChartParams(baseFields());
		const b = buildChartParams({
			...baseFields(),
			termsVariant: w(0), westNodeType: w('mean'), sectBuffer: w('geo'),
			leoBoundFirst: w(0), triplicity: w('Dorothean'), lotReversal: w(1),
		});
		expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
	});

	test('非默认逐键下发：值与形态同主盘口径', () => {
		const p = buildChartParams({
			...baseFields(),
			termsVariant: w(2), geminiBoundEmended: w(1),
			westNodeType: w('true'), sectBuffer: w('ptolemy5'),
			leoBoundFirst: w(1), triplicity: w('Ptolemaic'), lotReversal: w(0),
		});
		expect(p.termsVariant).toBe(2);
		expect(p.geminiBoundEmended).toBe(1);
		expect(p.westNodeType).toBe('true');
		expect(p.sectBuffer).toBe('ptolemy5');
		expect(p.leoBoundFirst).toBe(1);
		expect(p.triplicity).toBe('Ptolemaic');
		expect(p.lotReversal).toBe(0);
	});

	test('字符串形态(「1」/「0」)同样命中(record 还原后的 string 值不漏)', () => {
		const p = buildChartParams({ ...baseFields(), leoBoundFirst: w('1'), lotReversal: w('0') });
		expect(p.leoBoundFirst).toBe(1);
		expect(p.lotReversal).toBe(0);
	});
});
