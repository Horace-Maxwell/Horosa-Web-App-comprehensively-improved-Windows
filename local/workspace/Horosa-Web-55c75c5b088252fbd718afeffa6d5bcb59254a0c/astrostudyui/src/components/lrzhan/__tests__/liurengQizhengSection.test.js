// [v44 硬缺修] 六壬 [七政] 段数据源 buildQiZhengItems(纯函数):七政临宫/五行/度/逆/月将,
// 与七政 tab 网格同源。无星历(objects 缺) → 空数组=builder 不产段(零字节变化)。
import { buildQiZhengItems } from '../LiuRengMain';
import * as AstroConst from '../../../constants/AstroConst';

describe('六壬 [七政] 段数据源 buildQiZhengItems', ()=>{
	it('无 chartObj/无 objects → 空数组不抛', ()=>{
		expect(buildQiZhengItems(null)).toEqual([]);
		expect(buildQiZhengItems({})).toEqual([]);
	});

	it('日月五星临支/五行/度/逆行/月将 全字段', ()=>{
		const chartObj = { objects: [
			// 太阳 Gemini(申宫) 15.5°,顺行 → 月将=申
			{ id: AstroConst.SUN, sign: 'Gemini', lon: 75.5, lonspeed: 0.95 },
			// 水星 Gemini(申) 27.2°,逆行 → 与日同支=月将标记也亮(isYue 按支同判)
			{ id: AstroConst.MERCURY, sign: 'Gemini', lon: 87.2, lonspeed: -0.6 },
			// 月亮 Taurus(酉) 12.0°
			{ id: AstroConst.MOON, sign: 'Taurus', lon: 42.0, lonspeed: 13.1 },
		] };
		const items = buildQiZhengItems(chartObj);
		expect(items.length).toBe(3);
		const sun = items.find((x)=>x.name === '日');
		expect(sun).toBeTruthy();
		expect(sun.branch).toBe('申');
		expect(sun.deg).toBeCloseTo(15.5, 5);
		expect(sun.retro).toBe(false);
		expect(sun.isYue).toBe(true);
		const mercury = items.find((x)=>x.name === '水');
		expect(mercury.retro).toBe(true);
		const moon = items.find((x)=>x.name === '月');
		expect(moon.branch).toBe('酉');
		expect(moon.isYue).toBe(false);
		// 五行随支(申=金/酉=金)
		expect(sun.wx).toBe('金');
		expect(moon.wx).toBe('金');
	});
});
