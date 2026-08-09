// [A7] 活盘单击双义金标:huoPan 开=点宫同时落太极点+飞化宫(单 draw);同宫再点=双清;
// huoPan 关=taijiIdx 恒不动、飞化 toggle 照旧(零回归)。
import ZWChart from '../ZWChart';
import { ZWEngineOptions } from '../ziweiOptions';

function bareChart(){
	const c = Object.create(ZWChart.prototype);
	c.taijiIdx = null;
	c.flyHouse = null;
	c.chartObj = { zidou: '子' };
	c.draw = jest.fn();
	return c;
}
function mkHouse(idx, ganzi){
	return { ganzi, houseChart: { houseIndex: idx, yearText: '' } };
}

afterEach(()=>{ ZWEngineOptions.huoPan = false; });

describe('[A7] clickHouse 状态机', ()=>{
	test('🔴 huoPan 开:单击双义(太极点+飞化同落);draw 恰一次', ()=>{
		ZWEngineOptions.huoPan = true;
		const c = bareChart();
		const hA = mkHouse(3, '丙辰');
		c.clickHouse(hA);
		expect(c.taijiIdx).toBe(3);
		expect(c.flyHouse).toBe(hA);
		expect(c.draw).toHaveBeenCalledTimes(1);
	});
	test('🔴 同宫再点=双清(太极点 null + 飞化 null)', ()=>{
		ZWEngineOptions.huoPan = true;
		const c = bareChart();
		const hA = mkHouse(3, '丙辰');
		c.clickHouse(hA);
		c.clickHouse(hA);
		expect(c.taijiIdx).toBe(null);
		expect(c.flyHouse).toBe(null);
	});
	test('换宫:太极点跟移,飞化换宫', ()=>{
		ZWEngineOptions.huoPan = true;
		const c = bareChart();
		const hA = mkHouse(3, '丙辰');
		const hB = mkHouse(7, '庚申');
		c.clickHouse(hA);
		c.clickHouse(hB);
		expect(c.taijiIdx).toBe(7);
		expect(c.flyHouse).toBe(hB);
	});
	test('huoPan 关:taijiIdx 恒 null,飞化 toggle 照旧(零回归)', ()=>{
		const c = bareChart();
		const hA = mkHouse(3, '丙辰');
		c.clickHouse(hA);
		expect(c.taijiIdx).toBe(null);
		expect(c.flyHouse).toBe(hA);
		c.clickHouse(hA);
		expect(c.flyHouse).toBe(null);
		expect(c.draw).toHaveBeenCalledTimes(2);
	});
});
