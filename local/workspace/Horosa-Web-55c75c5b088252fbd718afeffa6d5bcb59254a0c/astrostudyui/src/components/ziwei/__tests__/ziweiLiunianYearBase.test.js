// [Issue#53 同族] 紫微运限流年公历年基准 = 干支年(不是出生公历年)。
// 病理:换年界(立春/正月初一)前出生者,公历年已跨、干支年未跨——直接拿生日公历年当 base,
// 运限首条流年整体错一位,与盘面生年干支自相矛盾;该函数同供 AI 挂载复算=错会进快照。
// 修法:从引擎已产的生年干支(chart.yearGan/yearZi)反推(utils/ganzhiYearBase 同口径)。
import { buildLiunianItems, buildDaxianItems } from '../ZWLuckPanel';

const mkChart = (birth, yearGan, yearZi)=>({
	birth,
	yearGan,
	yearZi,
	houses: Array.from({ length: 12 }, (_, i)=>({
		name: `第${i + 1}宫`,
		ganzi: ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥'][i],
		direction: i === 0 ? [1, 10] : null,
	})),
});

describe('紫微流年公历年基准 ≡ 干支年', ()=>{
	it('换年界前出生(1990-01-20,生年干支己巳=1989):流年首条应为 1989 己巳', ()=>{
		const chart = mkChart('1990-01-20 12:00:00', '己', '巳');
		const dx = buildDaxianItems(chart)[0];
		const items = buildLiunianItems(chart, dx);
		expect(items.length).toBeGreaterThan(0);
		expect(items[0].year).toBe(1989);
		expect(items[0].ganzi).toBe('己巳');
	});
	it('界后出生(1990-06-01,生年干支庚午=1990):首条 1990 庚午(零回归锚)', ()=>{
		const chart = mkChart('1990-06-01 12:00:00', '庚', '午');
		const dx = buildDaxianItems(chart)[0];
		const items = buildLiunianItems(chart, dx);
		expect(items[0].year).toBe(1990);
		expect(items[0].ganzi).toBe('庚午');
	});
	it('缺生年干支字段时退回旧行为(不抛)', ()=>{
		const chart = mkChart('1990-01-20 12:00:00', '', '');
		const dx = buildDaxianItems(chart)[0];
		const items = buildLiunianItems(chart, dx);
		expect(items[0].year).toBe(1990);
	});
});
