// 七政相位单源:盘上的相位连线 / 右栏「相位」页 / AI 快照 [相位] 段同一 computeMoiraAspectPairs ——
// 七政相位名(會 / 衝 / 刑 / 合=120° / 半合 / 半刑 / 四合)、只列已勾选的相位药丸、按容许度设置、隐藏的曜不列。
// 曾:右栏与快照按通用占星相位表列(合 = 0°、容许度按星体通用值),与盘上连线名称、容许度都不同。
import * as AstroConst from '../../../constants/AstroConst';
import { computeMoiraAspectPairs } from '../GuoLaoMoiraWheel';
import { buildGuolaoAspectRows } from '../main/aspectsNodeMode';
import { buildGuolaoAspectSection } from '../main/snapshot';

const obj = (id, lon, lonspeed)=>({ id, lon, ra: lon, lonspeed });
function chart(objects){ return { displayCoord: 'ecliptic', objects }; }
const C = chart([
	obj(AstroConst.SUN, 0, 1),
	obj(AstroConst.MOON, 121, 13),      // 日月 121° → 合(120°,误差 1,容许 4)
	obj(AstroConst.MARS, 92.5, 0.5),    // 日火 92.5° → 刑(90°,误差 2.5 > 内置 3? 否 → 命中)
	obj(AstroConst.SATURN, 181, 0.05),  // 日土 181° → 衝
]);
const keyOf = (p)=>`${p.a.id}-${p.b.id}-${p.aspect.key}`;

describe('七政相位单源', ()=>{
	test('出厂勾选(會衝刑合半合)与内置容许度', ()=>{
		const ks = computeMoiraAspectPairs(C, {}).map(keyOf);
		expect(ks).toContain(`${AstroConst.SUN}-${AstroConst.MOON}-合`);
		expect(ks).toContain(`${AstroConst.SUN}-${AstroConst.MARS}-刑`);
		expect(ks).toContain(`${AstroConst.SUN}-${AstroConst.SATURN}-衝`);
	});
	test('右栏行用七政名 + 实际角度;「合」是 120°', ()=>{
		const rows = buildGuolaoAspectRows(C, {});
		const sm = rows.find((r)=>r.key === `${AstroConst.SUN}-${AstroConst.MOON}-合`);
		expect(sm.aspect).toBe('合 120°');
		expect(sm.orb).toBe('1');
	});
	test('容许度跟设置:刑容许度收到 2° → 日火(误差 2.5)不列', ()=>{
		const rows = buildGuolaoAspectRows(C, { aspectOrbs: { 刑: 2 } });
		expect(rows.some((r)=>r.key === `${AstroConst.SUN}-${AstroConst.MARS}-刑`)).toBe(false);
		expect(rows.some((r)=>r.key === `${AstroConst.MARS}-${AstroConst.SATURN}-刑`)).toBe(true);   // 火土 88.5°(误差 1.5)仍在 2° 内
	});
	test('药丸跟勾选:不勾「合」→ 日月不列', ()=>{
		const rows = buildGuolaoAspectRows(C, { aspects: ['會', '衝', '刑'] });
		expect(rows.some((r)=>r.aspect.indexOf('合') === 0)).toBe(false);
		expect(rows.some((r)=>r.aspect.indexOf('衝') === 0)).toBe(true);
	});
	test('隐藏的曜不列', ()=>{
		const rows = buildGuolaoAspectRows(C, { hiddenPlanets: ['月'] });
		expect(rows.some((r)=>r.key.indexOf(AstroConst.MOON) >= 0)).toBe(false);
	});
	test('入相 / 离相按黄经日速:月快于日、误差在缩小 → 入相', ()=>{
		// 日 0°、月 119°(速 13):间距 119 → 趋近 120 → 入相
		const c2 = chart([obj(AstroConst.SUN, 0, 1), obj(AstroConst.MOON, 119, 13)]);
		expect(buildGuolaoAspectRows(c2, {})[0].state).toBe('入相');
		const c3 = chart([obj(AstroConst.SUN, 0, 1), obj(AstroConst.MOON, 121, 13)]);
		expect(buildGuolaoAspectRows(c3, {})[0].state).toBe('离相');
	});
	test('AI 快照 [相位] 段与右栏同表', ()=>{
		const prefs = { aspects: ['會', '衝', '刑', '合', '半合'], aspectOrbs: { 刑: 3 } };
		const rows = buildGuolaoAspectRows(C, prefs);
		const out = buildGuolaoAspectSection({ chart: C }, prefs);
		expect(out.split('\n').length).toBe(2 + rows.length);
		rows.forEach((r)=>expect(out).toContain(`| ${r.from} | ${r.aspect} | ${r.to} |`));
	});
});

// 入相 / 离相的日速与位置同口径:赤仪(位置取赤经)用赤经日速 raspeed,黄仪用黄经日速。
// 曾:赤仪也拿黄经日速推赤经位置,两种日速差得多的对子(近合、慢星)会判反。
describe('七政相位状态的日速口径', ()=>{
	// 日 ra 0 / 月 ra 119 → 合(120°)误差 1。赤经日速:日 1.0 > 月 0.95 → 距角收窄 → 离相;
	// 黄经日速故意给反(日 0.9 < 月 1.0 → 距角张开 → 入相),用来区分取的是哪一个。
	const eq = (displayCoord)=>({ displayCoord, objects: [
		{ id: AstroConst.SUN, lon: 0, ra: 0, lonspeed: 0.9, raspeed: 1.0 },
		{ id: AstroConst.MOON, lon: 119, ra: 119, lonspeed: 1.0, raspeed: 0.95 },
	] });
	const sunMoon = (c)=>computeMoiraAspectPairs(c, {}).find((p)=>p.aspect.key === '合');
	test('赤仪取赤经日速', ()=>{ expect(sunMoon(eq('equatorial')).state).toBe('离相'); });
	test('黄仪取黄经日速', ()=>{ expect(sunMoon(eq('ecliptic')).state).toBe('入相'); });
	test('合成点 raspeed 恒 0 时退回黄经日速;两者都缺给「—」', ()=>{
		const c = { displayCoord: 'equatorial', objects: [
			{ id: AstroConst.SUN, lon: 0, ra: 0, lonspeed: 0.9, raspeed: 0 },
			{ id: AstroConst.MOON, lon: 119, ra: 119, lonspeed: 1.0, raspeed: 0.95 },
		] };
		expect(sunMoon(c).state).toBe('入相');   // 日退回 0.9、月 0.95 → 距角 119 向 120 张开 → 入相
		const none = { displayCoord: 'equatorial', objects: [
			{ id: AstroConst.SUN, lon: 0, ra: 0 },
			{ id: AstroConst.MOON, lon: 119, ra: 119, raspeed: 0.95 },
		] };
		expect(sunMoon(none).state).toBe('—');
	});
});
