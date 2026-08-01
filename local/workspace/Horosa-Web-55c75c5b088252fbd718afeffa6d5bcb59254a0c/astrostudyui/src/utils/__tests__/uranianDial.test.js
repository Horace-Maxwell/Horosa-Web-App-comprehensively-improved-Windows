import { projectToDial, midpoint, dialSeparation, cursorReadout, midpointTree, spreadDialAngles, antiscion, contraAntiscion, planetaryPictures, midpointList, spiegelContacts, equalHouseFramework, planetHouse, sumPoint, arcOpening, sumList, differenceList, solarArcDirections, SA_RATE, crossContacts, rectificationHits, compositeChart, midpointHubs } from '../uranianDial';

test('90°盘投影 = lon mod 90 映 0..360', () => {
	expect(projectToDial(207.958, 90)).toBeCloseTo(27.958 / 90 * 360, 2); // Cupido fixture ≈111.832
	expect(projectToDial(100, 90)).toBeCloseTo(40, 6);
});

test('近轴中点对称', () => {
	expect(midpoint(10, 50)).toBeCloseTo(30, 6);
	expect(midpoint(350, 10)).toBeCloseTo(0, 6);
});

test('90°盘同轴 readout', () => {
	expect(dialSeparation(73.4221, 13.0843, 90)).toBeCloseTo(29.662, 2); // 日月 90°盘最短角距
	const hits = cursorReadout([{ id: 'Sun', lon: 73.4221 }, { id: 'Moon', lon: 13.0843 }], 73.4221, 90, 1);
	expect(hits.some((h) => h.kind === 'body' && h.id === 'Sun')).toBe(true); // 指针=Sun 命中 Sun
	expect(hits.some((h) => h.id === 'Moon')).toBe(false); // orb1 内不命中 Moon
});

test('行星图 A+B=C+D 由同轴自然涌现', () => {
	// mid(0,80)=40, mid(30,50)=40 → 指针落 40° 同时命中两半和 = 一张 planetary picture
	const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 80 }, { id: 'c', lon: 30 }, { id: 'd', lon: 50 }];
	expect(cursorReadout(P, 40, 90, 1).filter((x) => x.kind === 'mid').length).toBeGreaterThanOrEqual(2);
});

test('中点树给出 P 完成的半和', () => {
	const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 80 }, { id: 'p', lon: 40 }];
	const tree = midpointTree(P, 90, 1);
	expect(tree.p && tree.p.length).toBeGreaterThanOrEqual(1); // p=40 命中 a/b 中点
});

test('spreadDialAngles 不重叠时保留真位、重叠时按 minGap 推进', () => {
	// 三星挤在 30° 附近,minGap=5 → 应被推开 0/5/10。
	const out = spreadDialAngles([
		{ p: { id: 'A' }, displayAngle: 30 },
		{ p: { id: 'B' }, displayAngle: 31 },
		{ p: { id: 'C' }, displayAngle: 33 },
	], 5);
	expect(out.length).toBe(3);
	expect(out[0].displayAngle).toBe(30);        // 真位不变
	expect(out[0].glyphAngle).toBeCloseTo(30, 6);
	expect(out[1].glyphAngle).toBeCloseTo(35, 6); // 被顶到 30+5
	expect(out[2].glyphAngle).toBeCloseTo(40, 6); // 再 +5
});

test('spreadDialAngles 不挤时 glyph=display(零位移)', () => {
	const out = spreadDialAngles([
		{ p: { id: 'A' }, displayAngle: 10 },
		{ p: { id: 'B' }, displayAngle: 50 },
		{ p: { id: 'C' }, displayAngle: 200 },
	], 5);
	out.forEach((o) => { expect(o.glyphAngle).toBeCloseTo(o.displayAngle, 6); });
});

test('谐波盘(非 90°)折叠 + readout 自洽', () => {
	// H8(45°盘): lon=0 与 lon=45 同轴,lon=22.5 与 lon=67.5 同轴
	expect(dialSeparation(0, 45, 45)).toBeCloseTo(0, 6);
	expect(dialSeparation(22.5, 67.5, 45)).toBeCloseTo(0, 6);
	// 指针在 22.5°,lon=67.5 必命中(22.5°盘上 67.5 折叠到 22.5)。
	const hits = cursorReadout([{ id: 'X', lon: 67.5 }], 22.5, 45, 0.5);
	expect(hits.some((h) => h.kind === 'body' && h.id === 'X')).toBe(true);
});

test('模数盘 360°基:cursorLon 取真实位、与折叠盘等价', () => {
	// 模数盘传 cursorLon=真实角(0..360),折叠盘传 cursorLon=折叠位 — dialSeparation 内部都按 mod base 处理,
	// 故 base=360 时两口径等价。
	expect(dialSeparation(120, 120, 360)).toBeCloseTo(0, 6);
	expect(dialSeparation(0, 180, 360)).toBeCloseTo(180, 6);
	expect(dialSeparation(0, 359, 360)).toBeCloseTo(1, 6); // 邻 360-1=1
});

test('cursorReadout: onlyPersonal 仅返回含个人点的图', () => {
	const personal = new Set(['Sun']);
	const P = [{ id: 'Sun', lon: 73.42 }, { id: 'X', lon: 73.42 }, { id: 'Y', lon: 13 }];
	const hits = cursorReadout(P, 73.42, 90, 1, { personal, onlyPersonal: true });
	// body 命中:仅 Sun(personal),X 被过滤。
	expect(hits.some((h) => h.kind === 'body' && h.id === 'Sun')).toBe(true);
	expect(hits.some((h) => h.kind === 'body' && h.id === 'X')).toBe(false);
});

test('规格 §11.2 1975盘 90°折叠位 金标对拍 + 硬相位聚类自检', () => {
	// 黄经(由星座+度算)与规格书的「90°折叠位」对拍——验证折叠层(lon mod 90)正确。
	const cases = [
		{ id: 'Sun', lon: 73.4167, fold: 73.42 },     // 13°♊25'
		{ id: 'Moon', lon: 13.0833, fold: 13.08 },    // 13°♈05'
		{ id: 'Jupiter', lon: 17.4167, fold: 17.42 }, // 17°♈25'
		{ id: 'Saturn', lon: 107.3833, fold: 17.39 }, // 17°♋23'(90+17.38)
		{ id: 'Venus', lon: 118.15, fold: 28.16 },    // 28°♋09'
		{ id: 'Uranus', lon: 208.80, fold: 28.80 },   // 28°♎48'
	];
	cases.forEach((c) => { expect(((c.lon % 90) + 90) % 90).toBeCloseTo(c.fold, 1); });
	// 规格自检点①：木 17.42 ≈ 土 17.39 → 90°盘上几乎重合（木土硬相位）。
	expect(dialSeparation(17.4167, 107.3833, 90)).toBeLessThan(0.1);
	// 规格自检点②：金 28.16 ≈ 天 28.80 → 金天硬相位（规格图左下 ♀⛢ 相邻）。
	expect(dialSeparation(118.15, 208.80, 90)).toBeLessThan(0.7);
});

test('映点 Spiegelpunkte 公式(日至轴/分至轴镜像)', () => {
	expect(antiscion(15)).toBeCloseTo(165, 6);        // 15°♈ → 回照 15°♍
	expect(contraAntiscion(15)).toBeCloseTo(345, 6);  // 15°♈ → 对映 15°♓
	expect(antiscion(90)).toBeCloseTo(90, 6);         // 0°♋ 在日至轴上 = 自身
	expect(contraAntiscion(0)).toBeCloseTo(0, 6);     // 0°♈ 在分至轴上 = 自身
	expect(antiscion(0)).toBeCloseTo(180, 6);         // 0°♈ → 0°♎(=30°♍ 边界)
});

test('近中点取短弧(两点相隔 > 90°)', () => {
	// A=350,B=130:平均 240,|240−350|=110>90 → +180 → 60(近 350 的短弧中点)。
	expect(midpoint(350, 130)).toBeCloseTo(60, 6);
});

test('行星图 A+B−C=D 解算(锚点剪枝 + 命中)', () => {
	const personal = new Set(['a']);
	const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 80 }, { id: 'c', lon: 30 }, { id: 'd', lon: 50 }];
	const pics = planetaryPictures(P, 90, 1, { personal });
	expect(pics.length).toBeGreaterThanOrEqual(1);
	// 0+80−30=50 命中 d
	expect(pics.some((p) => p.d === 'd' && Math.round(p.lon) === 50 && p.sep < 1)).toBe(true);
	// 锚点剪枝:每张图必含锚点 a(a 永远是 A 或 B)
	expect(pics.every((p) => [p.a, p.b, p.c, p.d].includes('a'))).toBe(true);
});

test('中点列表:含个人点排前 + 近中点正确', () => {
	const personal = new Set(['Sun']);
	const P = [{ id: 'Sun', lon: 10 }, { id: 'Moon', lon: 50 }, { id: 'X', lon: 100 }, { id: 'Y', lon: 200 }];
	const list = midpointList(P, 90, { personal });
	expect(list.length).toBe(6); // C(4,2)=6 对
	expect(list[0].a === 'Sun' || list[0].b === 'Sun').toBe(true); // 含个人点的对在最前
	const sm = list.find((m) => (m.a === 'Sun' && m.b === 'Moon') || (m.a === 'Moon' && m.b === 'Sun'));
	expect(sm.lon).toBeCloseTo(30, 6); // Sun/Moon 近中点 = 30
});

test('映点接触 Spiegelpunkt(回照折叠)', () => {
	// A=30,antiscion(30)=150 → B=150 与 A 互成回照接触(30+150=180)。
	expect(spiegelContacts([{ id: 'A', lon: 30 }, { id: 'B', lon: 150 }], 90, 1, {}).length).toBe(1);
	// 90°盘上回照与对映折叠重合:B=330(=对映 360−30) 也判接触(330 与 150 在 90°盘同折叠位 60)。
	expect(spiegelContacts([{ id: 'A', lon: 30 }, { id: 'B', lon: 330 }], 90, 1, {}).length).toBe(1);
	// 无接触:A=30、B=200(折叠位 20,远离 60)→ 空。
	expect(spiegelContacts([{ id: 'A', lon: 30 }, { id: 'B', lon: 200 }], 90, 1, {}).length).toBe(0);
});

test('六宫框 equalHouseFramework:12 宫头、每宫 30°、跨 0° 归一', () => {
	const c = equalHouseFramework(10);
	expect(c.length).toBe(12);
	expect(c[0]).toBeCloseTo(10, 6);
	expect(c[1]).toBeCloseTo(40, 6);
	// 1 宫头=350 → 360-1 跨 0° 归一:c[1]=20、c[11]=320。
	const w = equalHouseFramework(350);
	expect(w[0]).toBeCloseTo(350, 6);
	expect(w[1]).toBeCloseTo(20, 6);
	expect(w[11]).toBeCloseTo(320, 6);
	// 每宫恒 30°(模 360)。
	for (let i = 0; i < 12; i++){ expect(((c[(i + 1) % 12] - c[i]) % 360 + 360) % 360).toBeCloseTo(30, 6); }
});

test('六宫框 planetHouse:落宫(含跨 0° 与不等距 cusps)', () => {
	const c = equalHouseFramework(0); // 宫头 0,30,60,...
	expect(planetHouse(0, c)).toBe(1);
	expect(planetHouse(29.9, c)).toBe(1);
	expect(planetHouse(30, c)).toBe(2);
	expect(planetHouse(359.9, c)).toBe(12);
	// 跨 0°:1 宫头=350,lon=5 落 1 宫、lon=355 落 1 宫、lon=25 落 2 宫、lon=349 落 12 宫。
	const w = equalHouseFramework(350);
	expect(planetHouse(5, w)).toBe(1);
	expect(planetHouse(355, w)).toBe(1);
	expect(planetHouse(25, w)).toBe(2);
	expect(planetHouse(349, w)).toBe(12);
	// 不等距 cusps(模拟子午局后端给):[0,40,70,...] → lon=35 落 1、lon=50 落 2。
	const ne = [0, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340];
	expect(planetHouse(35, ne)).toBe(1);
	expect(planetHouse(50, ne)).toBe(2);
	expect(planetHouse(345, ne)).toBe(12);
});

// ───────────────────────── WP-5 和点/差点读数(additive opts) ─────────────────────────

test('WP-5 sumPoint / arcOpening 公式', () => {
	expect(sumPoint(10, 50)).toBeCloseTo(60, 6);       // A+B=60
	expect(sumPoint(350, 30)).toBeCloseTo(20, 6);      // 380→20(折回 0..360)
	expect(arcOpening(10, 50)).toBeCloseTo(40, 6);     // 最短差距 40
	expect(arcOpening(0, 200)).toBeCloseTo(160, 6);    // 360-200=160(取短弧)
});

test('WP-5 cursorReadout(opts.sum) 追加和点项命中', () => {
	// A=10,B=50 → 和点 60；指针落 60° → 应出现一条 kind:sum 的 A+B。
	const P = [{ id: 'A', lon: 10 }, { id: 'B', lon: 50 }];
	const hits = cursorReadout(P, 60, 90, 1, { sum: true });
	expect(hits.some((h) => h.kind === 'sum' && ((h.a === 'A' && h.b === 'B') || (h.a === 'B' && h.b === 'A')))).toBe(true);
});

test('WP-5 cursorReadout(opts.arc) 追加差距项命中', () => {
	// A=10,B=50 → 差距 40；指针落 40° → 应出现一条 kind:arc。
	const P = [{ id: 'A', lon: 10 }, { id: 'B', lon: 50 }];
	const hits = cursorReadout(P, 40, 90, 1, { arc: true });
	expect(hits.some((h) => h.kind === 'arc')).toBe(true);
	// 不开 arc 时同指针位无 arc 项(防默认泄漏)。
	expect(cursorReadout(P, 40, 90, 1).some((h) => h.kind === 'arc')).toBe(false);
});

test('WP-5 回归硬证:不传 opts 时 cursorReadout 仅产出 body/mid 两类(逐位不变)', () => {
	// 任何不带 sum/arc 的调用,结果集只含历史的 body/mid——和上面 18 例的口径完全一致。
	const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 80 }, { id: 'c', lon: 30 }, { id: 'd', lon: 50 }];
	const baseline = cursorReadout(P, 40, 90, 1);
	expect(baseline.every((h) => h.kind === 'body' || h.kind === 'mid')).toBe(true);
	// 与显式 {sum:false, arc:false} 完全等价(JSON 逐位)。
	expect(JSON.stringify(cursorReadout(P, 40, 90, 1, { sum: false, arc: false }))).toBe(JSON.stringify(baseline));
});

test('WP-5 sumList / differenceList 扁平表', () => {
	const personal = new Set(['Sun']);
	const P = [{ id: 'Sun', lon: 10 }, { id: 'Moon', lon: 50 }, { id: 'X', lon: 200 }];
	const sl = sumList(P, 90, { personal });
	expect(sl.length).toBe(3); // C(3,2)
	const sm = sl.find((m) => (m.a === 'Sun' && m.b === 'Moon') || (m.a === 'Moon' && m.b === 'Sun'));
	expect(sm.lon).toBeCloseTo(60, 6); // Sun+Moon 和点 = 60
	expect(sl[0].a === 'Sun' || sl[0].b === 'Sun').toBe(true); // 含个人点排前
	const dl = differenceList(P, 90, { personal });
	const dm = dl.find((m) => (m.a === 'Sun' && m.b === 'Moon') || (m.a === 'Moon' && m.b === 'Sun'));
	expect(dm.arc).toBeCloseTo(40, 6); // 差距 40
	expect(dl[0].arc <= dl[dl.length - 1].arc).toBe(true); // 按差距升序
});

test('WP-5 midpointList(includeSum) 追加和点字段、不动既有', () => {
	const P = [{ id: 'A', lon: 10 }, { id: 'B', lon: 50 }];
	const withSum = midpointList(P, 90, { includeSum: true });
	expect(withSum[0].lon).toBeCloseTo(30, 6);       // 既有中点字段不变
	expect(withSum[0].sumLon).toBeCloseTo(60, 6);    // 追加和点黄经
	// 默认不带 includeSum 时无 sumLon(零回归)。
	expect(midpointList(P, 90, {})[0].sumLon).toBeUndefined();
});

// ───────────────────────── WP-3 太阳弧到期 差值表 ─────────────────────────

test('WP-3 SA_RATE 常量', () => {
	expect(SA_RATE.naibod).toBeCloseTo(0.9856473, 7);
	expect(SA_RATE.oneDeg).toBe(1.0);
});

test('WP-3 solarArcDirections:30° 对的全/半/倍到期年龄(naibod)', () => {
	const P = [{ id: 'A', lon: 0 }, { id: 'B', lon: 30 }]; // arc=30
	const rows = solarArcDirections(P, 90, {});
	const prim = (t) => rows.find((r) => r.b === 'B' && r.type === t && r.fold === undefined);
	expect(prim('full').age).toBeCloseTo(30.44, 1);   // 30/0.9856473
	expect(prim('half').age).toBeCloseTo(15.22, 1);   // 15/rate
	expect(prim('double').age).toBeCloseTo(60.87, 1); // 60/rate
	// {90−a} 折叠项存在。
	expect(rows.some((r) => r.b === 'B' && r.fold === '90-a')).toBe(true);
	// 按 age 升序。
	expect(rows.every((r, i) => i === 0 || rows[i - 1].age <= r.age)).toBe(true);
});

test('WP-3 solarArcDirections:targetAge 命中 due + maxAge 截断', () => {
	const P = [{ id: 'A', lon: 0 }, { id: 'B', lon: 30 }];
	// targetAge=30、win=1 → full 主接触(30.44)落 due。
	expect(solarArcDirections(P, 90, { targetAge: 30, win: 1 }).some((r) => r.due)).toBe(true);
	// 远离目标则无 due(target=5,win=1 时 30.44/15.22/… 均不命中)。
	expect(solarArcDirections(P, 90, { targetAge: 5, win: 1 }).some((r) => r.due)).toBe(false);
	// maxAge=20 截断:所有 age<=20。
	const cut = solarArcDirections(P, 90, { maxAge: 20 });
	expect(cut.length).toBeGreaterThan(0);
	expect(cut.every((r) => r.age <= 20)).toBe(true);
});

test('WP-3 solarArcDirections:oneDeg 换算 + aries 单因子档', () => {
	const P = [{ id: 'A', lon: 0 }, { id: 'B', lon: 30 }];
	// 1°/年:30° 对的 full 主接触 age=30。
	const rows = solarArcDirections(P, 90, { saKey: 'oneDeg' });
	const full = rows.find((r) => r.b === 'B' && r.type === 'full' && r.fold === undefined);
	expect(full.age).toBeCloseTo(30, 6);
	// aries 单因子:B(lon=30) 定向到 0° 轴 age=30(oneDeg)。
	expect(rows.some((r) => r.type === 'aries' && r.a === 'B' && r.b === null && Math.abs(r.age - 30) < 1e-6)).toBe(true);
});

// ───────────────────────── WP-9 合盘接触法 crossContacts ─────────────────────────

test('WP-9 crossContacts:B 落 A 单点 + 落 A 中点轴', () => {
	// A 有日月:Sun=0、Moon=60 → 中点轴 30。
	const A = [{ id: 'Sun', lon: 0 }, { id: 'Moon', lon: 60 }];
	// B1 落 A 的日月中点(30),B2 落 A 单点 Sun(0)。
	const B = [{ id: 'bMars', lon: 30 }, { id: 'bVenus', lon: 0 }];
	const cs = crossContacts(A, B, 90, 1);
	// ① 中点轴命中:bMars 落 Sun/Moon 中点(a2 非空,两端=Moon/Sun)。
	const mid = cs.find((c) => c.b === 'bMars' && c.a2 != null);
	expect(mid).toBeTruthy();
	expect([mid.a1, mid.a2].sort().join(',')).toBe(['Moon', 'Sun'].sort().join(','));
	expect(mid.sep).toBeCloseTo(0, 6);
	// ② 单点命中:bVenus 落 A 的 Sun(a2=null)。
	expect(cs.some((c) => c.b === 'bVenus' && c.a1 === 'Sun' && c.a2 === null && c.sep < 1e-6)).toBe(true);
	// 按 sep 升序。
	expect(cs.every((c, i) => i === 0 || cs[i - 1].sep <= c.sep)).toBe(true);
});

test('WP-9 crossContacts:容许度外不命中 + 空盘安全', () => {
	const A = [{ id: 'Sun', lon: 0 }, { id: 'Moon', lon: 60 }];
	// B 落 45(远离单点 0/60 与中点 30,90°盘最近距 15)→ orb1 内无命中。
	expect(crossContacts(A, [{ id: 'bX', lon: 45 }], 90, 1).length).toBe(0);
	// 空盘/缺参不抛错。
	expect(crossContacts(null, null, 90, 1)).toEqual([]);
	expect(crossContacts(A, [{ id: 'bBad', lon: NaN }], 90, 1)).toEqual([]);
});

// ───────────────────────── WP-10 校时命中 rectificationHits ─────────────────────────

test('WP-10 rectificationHits:事件年→弧→命中本命因子', () => {
	// 本命 MC=0;事件 30 岁 → 弧=30°(oneDeg) → MC 推进到 30° → 命中本命 lon=30 的因子。
	const natal = [{ id: 'Saturn', lon: 30 }, { id: 'Mars', lon: 200 }];
	const res = rectificationHits([{ label: '婚', years: 30 }], { mc: 0 }, natal, 90, 1, SA_RATE.oneDeg);
	expect(res.length).toBe(1);
	expect(res[0].event).toBe('婚');
	expect(res[0].arc).toBeCloseTo(30, 6);
	expect(res[0].hits.some((h) => h.factor === 'Saturn' && h.angle === 'MC' && h.sep < 1e-6)).toBe(true);
	// 远离的本命因子(Mars=200)不命中。
	expect(res[0].hits.some((h) => h.factor === 'Mars')).toBe(false);
});

test('WP-10 rectificationHits:Asc 轴 + Naibod 换算 + 多事件保序', () => {
	// Asc=10;事件 20 弧年,Naibod rate≈0.9856 → 弧≈19.71° → Asc 推进到≈29.71° → 命中本命 lon≈29.71。
	const arc = 20 * SA_RATE.naibod;
	const natal = [{ id: 'Venus', lon: 10 + arc }];
	const res = rectificationHits(
		[{ years: 0 }, { label: '迁', years: 20 }],
		{ asc: 10 }, natal, 90, 0.5, SA_RATE.naibod,
	);
	// 两事件保序(索引串 '0' 在前,'迁' 在后)。
	expect(res.map((r) => r.event)).toEqual(['0', '迁']);
	expect(res[1].arc).toBeCloseTo(arc, 6);
	expect(res[1].hits.some((h) => h.factor === 'Venus' && h.angle === 'Asc')).toBe(true);
	// 默认 rate(不传)= oneDeg。
	const def = rectificationHits([{ years: 30 }], { mc: 0 }, [{ id: 'X', lon: 30 }], 90, 1);
	expect(def[0].arc).toBeCloseTo(30, 6);
	// 非有限 years → 空 hits、arc=NaN,不抛错。
	const bad = rectificationHits([{ years: NaN }], { mc: 0 }, natal, 90, 1, 1);
	expect(bad[0].hits).toEqual([]);
	expect(Number.isNaN(bad[0].arc)).toBe(true);
});

// ──────── 真位盘(模数/宇宙图)十字指针副臂几何 1:1 ────────
// 模数/宇宙图盘是真位盘:cursorReadout 收【真实黄经】内部按 base 折叠。折叠盘视觉 ±22.5°/±67.5° 副臂
// 在真位盘等价于真实 cursor 偏移 δ = off·base/360(base=90 → ±5.625°/±16.875°)。下证该偏移读到的因子族正确,
// 且 crossPointer 关(仅主臂[0])时读数与单臂逐项等价(零回归)。
const norm360t = (x) => ((x % 360) + 360) % 360;

test('真位盘副臂 δ=off·base/360:主臂漏的折叠侧位由副臂读到', () => {
	const base = 90;
	const cursorLon = 10;                 // 真实黄经指针位 → 折叠位 10°
	// 因子 c1 落折叠位 10(主臂命中);c2 落折叠位 10+5.625=15.625(主臂漏、δ=5.625 副臂命中);
	// c3 落折叠位 10+16.875=26.875(δ=16.875 副臂命中)。
	const P = [{ id: 'c1', lon: 10 }, { id: 'c2', lon: 15.625 }, { id: 'c3', lon: 26.875 }];
	const main = cursorReadout(P, norm360t(cursorLon), base, 0.5);
	expect(main.some((h) => h.id === 'c1')).toBe(true);
	expect(main.some((h) => h.id === 'c2')).toBe(false);  // 主臂 orb0.5 内漏
	expect(main.some((h) => h.id === 'c3')).toBe(false);
	// 副臂偏移(视觉 22.5/67.5 → 真位 5.625/16.875)。
	const arm225 = cursorReadout(P, norm360t(cursorLon + 22.5 * base / 360), base, 0.5);
	const arm675 = cursorReadout(P, norm360t(cursorLon + 67.5 * base / 360), base, 0.5);
	expect(arm225.some((h) => h.id === 'c2')).toBe(true);  // 5.625 副臂命中 c2
	expect(arm675.some((h) => h.id === 'c3')).toBe(true);  // 16.875 副臂命中 c3
});

test('真位盘副臂折叠周期性:δ 落同一折叠位则主/副读同因子族(base 周期内一致)', () => {
	const base = 90;
	// 折叠位相同(differ by base)的两真位:100 与 10 折叠都=10。副臂偏移对二者读到同一折叠因子。
	const P = [{ id: 'x', lon: 15.625 }];
	const a = cursorReadout(P, norm360t(10 + 22.5 * base / 360), base, 0.3);
	const b = cursorReadout(P, norm360t(100 + 22.5 * base / 360), base, 0.3);
	expect(a.some((h) => h.id === 'x')).toBe(true);
	expect(b.some((h) => h.id === 'x')).toBe(true);
});

test('真位盘 crossPointer 关(仅主臂[0])= 单臂读数逐项等价(零回归)', () => {
	const base = 90;
	const P = [{ id: 'c1', lon: 10 }, { id: 'c2', lon: 15.625 }, { id: 'c3', lon: 73.4221 }];
	const cursorLon = 10;
	// 组件关时 armOffsets=[0]→ 等价直接单臂 cursorReadout(无合并去重)。
	const single = cursorReadout(P, norm360t(cursorLon), base, 1);
	const armOff0 = [0].map((o) => o * base / 360);
	const raw = [];
	armOff0.forEach((off) => cursorReadout(P, norm360t(cursorLon + off), base, 1).forEach((h) => raw.push(h)));
	expect(raw).toEqual(single);
});

// ── A4 组合中点盘 compositeChart ─────────────────────────────────
describe('compositeChart 组合盘(逐因子近中点)', () => {
	test('共有因子取近中点;单侧缺席跳过;非数值跳过', () => {
		const A = [{ id: 'Sun', lon: 10 }, { id: 'Moon', lon: 350 }, { id: 'Asc', lon: 100 }, { id: 'Bad', lon: 'x' }];
		const B = [{ id: 'Sun', lon: 30 }, { id: 'Moon', lon: 10 }, { id: 'MC', lon: 200 }, { id: 'Bad', lon: 5 }];
		const c = compositeChart(A, B);
		const byId = {}; c.forEach((p) => { byId[p.id] = p.lon; });
		expect(byId.Sun).toBe(20);                    // 直接中点
		expect(byId.Moon).toBe(0);                    // 跨 0°:350/10 → 近中点 0(非远中点 180)
		expect(byId.Asc).toBeUndefined();             // B 缺 Asc → 跳过
		expect(byId.MC).toBeUndefined();              // A 缺 MC → 跳过
		expect(byId.Bad).toBeUndefined();             // 非数值黄经 → 跳过
	});
	test('与 midpoint() 同口径(近弧);输出可直接喂既有扫描器', () => {
		const A = [{ id: 'Sun', lon: 40 }, { id: 'Mars', lon: 80 }];
		const B = [{ id: 'Sun', lon: 60 }, { id: 'Mars', lon: 100 }];
		const c = compositeChart(A, B);
		expect(c).toEqual([{ id: 'Sun', lon: midpoint(40, 60) }, { id: 'Mars', lon: midpoint(80, 100) }]);
		const tree = midpointTree(c.concat([{ id: 'X', lon: 70 }]), 90, 1);
		expect(tree.X && tree.X.length).toBe(1);      // X=70 恰为 Sun(50)/Mars(90) 中点
	});
	test('空输入安全', () => {
		expect(compositeChart(null, null)).toEqual([]);
		expect(compositeChart([], [{ id: 'Sun', lon: 1 }])).toEqual([]);
	});
});

// ── B5-algo 中点枢纽统计 midpointHubs ────────────────────────────
describe('midpointHubs 枢纽统计(分支越多越重要)', () => {
	test('count=该因子占据的中点数,按降序;personalCount 随 opts.personal', () => {
		// hub=45 恰为 (10,80)/(20,70)/(30,60) 三对之中点;other=10 只占据 (0,20) 一对。
		const P = [
			{ id: 'p10', lon: 10 }, { id: 'p80', lon: 80 }, { id: 'p20', lon: 20 }, { id: 'p70', lon: 70 },
			{ id: 'p30', lon: 30 }, { id: 'p60', lon: 60 }, { id: 'hub', lon: 45 }, { id: 'p0', lon: 0 },
		];
		const hubs = midpointHubs(P, 360, 0.5, { personal: new Set(['p10']) });
		expect(hubs[0].id).toBe('hub');
		const hub = hubs.find((h) => h.id === 'hub');
		expect(hub.count).toBeGreaterThanOrEqual(3);
		expect(hub.personalCount).toBeGreaterThanOrEqual(1); // (p10,p80) 枝含个人点 p10
		const order = hubs.map((h) => h.count);
		expect([...order].sort((x, y) => y - x)).toEqual(order); // 降序
	});
	test('统计面为全因子(不受 onlyPersonal 剪枝影响)', () => {
		const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 90 }, { id: 'c', lon: 45 }];
		const hubs = midpointHubs(P, 360, 0.5, { onlyPersonal: true, personal: new Set(['zz']) });
		expect(hubs.find((h) => h.id === 'c')).toBeTruthy(); // c 占据 a/b 中点,即便不在个人点集
	});
});

// ── B8 扩展映点轴 extendedAxes ───────────────────────────────────
describe('spiegelContacts 扩展 15° 固定星座镜轴', () => {
	// 15°金牛(45°)镜像口径:mirror=(2×45−lon) mod 360 = 90−lon。
	const P = [{ id: 'A', lon: 20 }, { id: 'B', lon: 70 }];   // 90−20=70 → B 恰中扩展轴
	test('缺省(false)=逐位零回归:不出扩展行,行对象无 axis 字段', () => {
		const base360 = spiegelContacts(P, 360, 1);
		expect(base360.length).toBe(0);                        // 基本轴 180−20=160 ≠ 70
		const withOpts = spiegelContacts(P, 360, 1, { personal: new Set() });
		expect(JSON.stringify(withOpts)).toBe(JSON.stringify(base360));
	});
	test('开启后 360° 模数盘追加 fixed15 行;90° 折叠盘与基本轴重合(同 sep 双行)', () => {
		const ext360 = spiegelContacts(P, 360, 1, { extendedAxes: true });
		expect(ext360.length).toBe(1);
		expect(ext360[0].axis).toBe('fixed15');
		expect(ext360[0].sep).toBe(0);
		// 90° 盘:基本轴 160 与 70 折叠同位(160 mod 90=70)→ 基本行也命中,扩展行与之同 sep。
		const ext90 = spiegelContacts(P, 90, 1, { extendedAxes: true });
		expect(ext90.length).toBe(2);
		expect(ext90.filter((r) => r.axis === 'fixed15').length).toBe(1);
		expect(ext90[0].sep).toBe(ext90[1].sep);
	});
});

// ── B9 Cardan 太阳弧速率键 ──────────────────────────────────────
describe('SA_RATE 三选一(naibod/oneDeg/cardan)', () => {
	test('cardan=0.9866667(0°59′12″/年);未知键回退 naibod(零回归)', () => {
		expect(SA_RATE.cardan).toBeCloseTo(0.9866667, 7);
		const P = [{ id: 'a', lon: 0 }, { id: 'b', lon: 59.2 }];
		const naibod = solarArcDirections(P, 90, { saKey: 'naibod' });
		const fallback = solarArcDirections(P, 90, { saKey: 'nonsense' });
		expect(JSON.stringify(fallback)).toBe(JSON.stringify(naibod));
		const cardan = solarArcDirections(P, 90, { saKey: 'cardan' });
		const full = (rows) => rows.find((r) => r.type === 'full' && !r.fold);
		expect(full(cardan).age).toBeCloseTo(59.2 / 0.9866667, 6);
		expect(full(naibod).age).toBeCloseTo(59.2 / 0.9856473, 6);
	});
});
