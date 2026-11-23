// 量化盘时间层 —— 行运接触段(与叠盘接触同一 crossContacts)只在挂载给了行运时刻时出;
// 差值表 / 太阳弧换算 / 盘基进挂载齿轮(此前只在显示偏好里)。
import { uranianTransitContactText } from '../AstroMidpoint';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';

test('行运接触段:落本命单点与中点轴各成行,按差距排序;无接触也出段并说明', ()=>{
	const natal = [{ id: 'Sun', lon: 10 }, { id: 'Moon', lon: 40 }];
	const transit = [{ id: 'Mars', lon: 100.4 }, { id: 'Jupiter', lon: 205 }];   // 100.4 在 90° 盘 = 10.4 → 本命太阳(差 0.4);205 → 25 = 日月中点 25
	const t = uranianTransitContactText(natal, transit, { base: 90, orb: 1, at: '2026-11-20 10:00' }).split('\n');
	expect(t[0]).toBe('[行运接触]');
	expect(t[1]).toContain('2026-11-20 10:00');
	const rows = t.slice(2);
	expect(rows.length).toBe(2);
	expect(rows[0]).toContain('中点');   // 差 0 的中点接触在前
	expect(rows[1]).toContain('差 0.40°');
	const none = uranianTransitContactText(natal, [{ id: 'Mars', lon: 30 }], { base: 90, orb: 1, at: 'x' });
	expect(none).toContain('容许度内无行运接触');
});

test('挂载 schema:时间层五项缺省空(随全局),盘基 / 太阳弧档与页面同档', ()=>{
	const f = (getTechniqueSettingsSchema('germany') || {}).fields || [];
	['transitAt', 'showDiffList', 'diffTargetAge', 'saKey', 'dialBase'].forEach((k)=>{
		const x = f.find((y)=>y.name === k);
		expect(`${k}:${!!x}`).toBe(`${k}:true`);
		expect(x.default).toBe('');
	});
	expect(f.find((x)=>x.name === 'dialBase').options.map((o)=>o.value)).toEqual(['', 90, 45, 22.5, 11.25]);
	expect(f.find((x)=>x.name === 'saKey').options.map((o)=>o.value)).toEqual(['', 'naibod', 'oneDeg', 'cardan']);
});
