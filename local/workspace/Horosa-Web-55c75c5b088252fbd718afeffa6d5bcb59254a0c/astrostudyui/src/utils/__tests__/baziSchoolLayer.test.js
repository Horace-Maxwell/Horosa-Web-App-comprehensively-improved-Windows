/**
 * 流派实时标记层（P0）golden：buildSchoolMark / schoolMarkClass 纯方法直测。
 * zonghe/nayin 无口径不标；fuyi/geju/tiaohou/bingyao 取 schools 对应行喜忌；
 * mangpai 取宾主；showSchoolMarks=false 全关（层不渲染=零回归）。
 */
import React from 'react';
import BaZiFineChart from '../../components/cntradition/BaZiFineChart';

function inst(props){
	return new BaZiFineChart(props);
}

const GY = {
	schools: [
		{ school: '扶抑派', verdict: '身强', xi: ['土', '金', '水'], ji: ['木', '火'], note: 'n1' },
		{ school: '格局派', xi: ['火', '土'], ji: [], note: 'n2' },
		{ school: '调候派', xi: ['水'], ji: [], note: 'n3' },
		{ school: '病药派', xi: ['金'], ji: ['木'], note: 'n4' },
	],
};
const MP = { cells: [
	{ label: '年', role: '宾', gan: '丙', zhi: '午' },
	{ label: '月', role: '宾', gan: '甲', zhi: '午' },
	{ label: '日', role: '主', gan: '丁', zhi: '卯' },
	{ label: '时', role: '主', gan: '己', zhi: '酉' },
] };

describe('buildSchoolMark', () => {
	test('扶抑派：取对应行喜忌集合与身强判语', () => {
		const m = inst({ school: 'fuyi', value: { gejuYongShen: GY } }).buildSchoolMark();
		expect(m.label).toBe('扶抑派');
		expect(m.verdict).toBe('身强');
		expect(Array.from(m.xi)).toEqual(['土', '金', '水']);
		expect(Array.from(m.ji)).toEqual(['木', '火']);
	});
	test('盲派：宾主按柱归位', () => {
		const m = inst({ school: 'mangpai', value: { mangpai: MP } }).buildSchoolMark();
		expect(m.label).toBe('盲派');
		expect(m.roleByPillar).toEqual({ 年: '宾', 月: '宾', 日: '主', 时: '主' });
		expect(m.bar).toContain('主位 日·时');
		expect(m.bar).toContain('宾位 年·月');
	});
	test('zonghe/nayin 无单一口径 → null；开关关 → null；数据缺 → null', () => {
		expect(inst({ school: 'zonghe', value: { gejuYongShen: GY } }).buildSchoolMark()).toBeNull();
		expect(inst({ school: 'nayin', value: { gejuYongShen: GY } }).buildSchoolMark()).toBeNull();
		expect(inst({ school: 'geju', value: { gejuYongShen: GY }, showSchoolMarks: false }).buildSchoolMark()).toBeNull();
		expect(inst({ school: 'geju', value: {} }).buildSchoolMark()).toBeNull();
		expect(inst({ school: 'mangpai', value: {} }).buildSchoolMark()).toBeNull();
	});
});

describe('schoolMarkClass', () => {
	const c = inst({ school: 'fuyi', value: { gejuYongShen: GY } });
	const mark = c.buildSchoolMark();
	test('喜用五行 → is-yong；忌 → is-ji；中性 → 空', () => {
		expect(c.schoolMarkClass(mark, { cell: '戊', element: 'Earth' })).toBe(' is-yong');
		expect(c.schoolMarkClass(mark, { cell: '庚', element: 'Metal' })).toBe(' is-yong');
		expect(c.schoolMarkClass(mark, { cell: '甲', element: 'Wood' })).toBe(' is-ji');
		expect(c.schoolMarkClass(mark, { cell: '丁', element: 'Fire' })).toBe(' is-ji');
	});
	test('element 缺失时按干/支本气表回退（子=水=喜、午=火=忌）', () => {
		expect(c.schoolMarkClass(mark, { cell: '子' })).toBe(' is-yong');
		expect(c.schoolMarkClass(mark, { cell: '午' })).toBe(' is-ji');
		expect(c.schoolMarkClass(mark, '壬')).toBe(' is-yong');
	});
	test('mark=null（层关）恒空串 → 既有 className 字节不变', () => {
		expect(c.schoolMarkClass(null, { cell: '甲', element: 'Wood' })).toBe('');
	});
	test('调候派干字口径：xi=天干（癸·丙）→ 干格按字命中、支不标', () => {
		const t = inst({ school: 'tiaohou', value: { gejuYongShen: GY } });
		const mark = t.buildSchoolMark();
		expect(Array.from(mark.xi)).toEqual(['水']); // GY 调候行是五行口径
		// 干字口径直接构造 mark 验证匹配序：cell 命中优先于五行
		const ganMark = { xi: new Set(['癸', '丙']), ji: new Set() };
		expect(t.schoolMarkClass(ganMark, { cell: '丙', element: 'Fire' })).toBe(' is-yong');
		expect(t.schoolMarkClass(ganMark, { cell: '癸', element: 'Water' })).toBe(' is-yong');
		expect(t.schoolMarkClass(ganMark, { cell: '午', element: 'Fire' })).toBe(''); // 支不因五行火而误标
	});
});
