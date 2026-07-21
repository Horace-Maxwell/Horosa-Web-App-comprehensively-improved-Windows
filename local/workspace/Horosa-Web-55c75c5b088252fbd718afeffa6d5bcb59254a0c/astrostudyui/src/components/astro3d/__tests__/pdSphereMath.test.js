
// —— [WP-2] 相遇端点几何:等赤纬圈 ∩ 位置圈 真交点 ——
describe('declCircleGreatIntersect(等赤纬∩大圆解析交点)', ()=>{
	const { declCircleGreatIntersect, declCirclePolylineHit } = require('../pdSphereMath');
	const RAD = Math.PI / 180;
	test('①时圈(过天极大圆):交点恰在该圈经面上且 y=sinδ', ()=>{
		// 时圈 basis:u=赤道面内某向,w=极轴(u⊥w):P(t)=u cosT + w sinT
		const u = { x: 1, y: 0, z: 0 };
		const w = { x: 0, y: 1, z: 0 };
		const hits = declCircleGreatIntersect(30, { u, w });
		expect(hits).toHaveLength(2);
		hits.forEach((h)=>{
			expect(h.y).toBeCloseTo(Math.sin(30 * RAD), 9);
			expect(Math.hypot(h.x, h.y, h.z)).toBeCloseTo(1, 9); // 单位球面上
			expect(Math.abs(h.z)).toBeLessThan(1e-9);            // 该时圈经面 z=0
		});
	});
	test('②斜大圆:交点 y 恒=sinδ 且在圆上(参数化回代)', ()=>{
		// 斜圈:u=(1,0,0), w=(0, cos40°, sin40°)(单位正交)
		const c = Math.cos(40 * RAD); const s = Math.sin(40 * RAD);
		const u = { x: 1, y: 0, z: 0 };
		const w = { x: 0, y: c, z: s };
		const hits = declCircleGreatIntersect(20, { u, w });
		expect(hits).toHaveLength(2);
		hits.forEach((h)=>{
			expect(h.y).toBeCloseTo(Math.sin(20 * RAD), 9);
			expect(Math.hypot(h.x, h.y, h.z)).toBeCloseTo(1, 9);
		});
	});
	test('③无交(圈最大纬 40°<δ=60°)→null;赤道面族大圆(y 恒 0)→null', ()=>{
		const c = Math.cos(40 * Math.PI / 180); const s = Math.sin(40 * Math.PI / 180);
		expect(declCircleGreatIntersect(60, { u: { x: 1, y: 0, z: 0 }, w: { x: 0, y: c, z: s } })).toBe(null);
		expect(declCircleGreatIntersect(10, { u: { x: 1, y: 0, z: 0 }, w: { x: 0, y: 0, z: 1 } })).toBe(null);
		expect(declCircleGreatIntersect(10, null)).toBe(null);
	});
	test('④折线命中:取 |decl−δ| 最近采样点;空安全', ()=>{
		const segs = [[{ ra: 10, decl: 5 }, { ra: 12, decl: 18 }], [{ ra: 40, decl: 21 }]];
		expect(declCirclePolylineHit(20, segs)).toEqual({ ra: 40, decl: 21 });
		expect(declCirclePolylineHit(20, [])).toBe(null);
		expect(declCirclePolylineHit(20, null)).toBe(null);
	});
});

// —— [WP-E] 周日方向物理语义(推导级→测试级):armc=0 场景把「−arc=向西=东升中天」
// 钉成世界坐标断言,而不只 playTargetAngleRad 的符号。坐标约定(pdSphereMath 头注):
// x=cosδ·cosα, y=sinδ(Y=天北极), z=−cosδ·sinα;skyGroup 绕 Y 转 θ 后 x'=x·cosθ+z·sinθ。
describe('[WP-E] 周日方向物理语义(armc=0:中天=+X,东点星 ra=90)', ()=>{
	const { unitOf, playTargetAngleRad } = require('../pdSphereMath');
	const rotY = (p, th)=>({ x: p.x * Math.cos(th) + p.z * Math.sin(th), y: p.y, z: -p.x * Math.sin(th) + p.z * Math.cos(th) });
	test('①direct 小弧:东点星向中天(+X)移动=东升中天,西落方向为负', ()=>{
		const east = unitOf(90, 0);                 // armc=0 时东点方向星:(0,0,−1)
		expect(east.x).toBeCloseTo(0, 12);
		expect(east.z).toBeCloseTo(-1, 12);
		const th = playTargetAngleRad(10);          // direct +10°
		expect(th).toBeLessThan(0);                 // −arc 符号锚(既有)
		const moved = rotY(east, th);
		expect(moved.x).toBeGreaterThan(0.15);      // 向 +X=中天升起(物理语义核心断言)
		expect(moved.y).toBeCloseTo(0, 12);         // 赤纬不变(绕天极轴旋转)
	});
	test('②反向弧对称:−arc 使东点星背离中天(x<0)', ()=>{
		const east = unitOf(90, 0);
		const moved = rotY(east, playTargetAngleRad(-10));
		expect(moved.x).toBeLessThan(-0.15);
	});
	test('③已过中天的星(ra=−20)继续向西沉(x 减小):方向全程一致', ()=>{
		const west = unitOf(-20, 0);
		const moved = rotY(west, playTargetAngleRad(10));
		expect(moved.x).toBeLessThan(west.x);       // 过中天后 x 持续减小=向西落
	});
});

// —— [D1] 方向语义四族号序(法律条文级契约;fixture=shipped 内核产物,670/670 全量) ——
// 三重互证:推演文档 MATH_FLOW §8 / perpredict.getPrimaryDirectionByZCoreKernel docstring /
// 本组数值断言。任何一族号序回潮(动方画反)即整组红。
describe('🔴 [D1] 方向语义分派:四族号序 fixture 全量实证', ()=>{
	const fs = require('fs');
	const path = require('path');
	const { moverOfRow, promRotationRad, sigBaseIdOf, sigEqOf, effectiveEq } = require('../pdSphereMath');
	const DEG_ = Math.PI / 180;
	const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'pd3d.alcabitius.json'), 'utf8'));
	const n180 = (x)=>((x % 360) + 540) % 360 - 180;
	const D2R = Math.PI / 180;
	const AD = (declDeg, poleRad)=>{
		const t = Math.tan(poleRad) * Math.tan(declDeg * D2R);
		return Math.abs(t) <= 1 ? Math.asin(t) / D2R : (t > 0 ? 90 : -90);
	};

	test('[D2] moverOfRow 全族恒 prom(应星固定、迫星动);sigBaseIdOf 解析', ()=>{
		// D2 正统:promissor directed to significator —— 无论应星是轴还是行星,均迫星动、应星固定。
		expect(moverOfRow({ sig: 'N_MC_0', cat: 'Z' })).toBe('prom');
		expect(moverOfRow({ sig: 'N_Venus_0', cat: 'Z' })).toBe('prom');   // 行星族亦迫星动(D1 曾误作 sig)
		expect(moverOfRow({ sig: 'N_North Node_0', cat: 'Z' })).toBe('prom');
		expect(moverOfRow({ sig: 'N_Venus_0', cat: 'M' })).toBe('prom');
		expect(moverOfRow()).toBe('prom');
		expect(sigBaseIdOf('N_North Node_0')).toBe('North Node');
		expect(sigBaseIdOf('N_MC_0')).toBe('MC');
	});

	test('[D2] promRotationRad 族定号序:行星/北交/福点=+arc、轴/M/T=−arc', ()=>{
		// 行星/北交/福点(arc=RA(sig)−RA(prom)):迫星 +arc 落到应星赤经圈
		expect(promRotationRad({ sig: 'N_Venus_0', cat: 'Z', arc: 30 })).toBeCloseTo(30 * DEG_, 12);
		expect(promRotationRad({ sig: 'N_North Node_0', cat: 'Z', arc: -12 })).toBeCloseTo(-12 * DEG_, 12);
		// 轴类/M/T(arc=RA(prom)−RA(sig)):迫星 −arc 落到应星轴圈/位置圈
		expect(promRotationRad({ sig: 'N_MC_0', cat: 'Z', arc: 30 })).toBeCloseTo(-30 * DEG_, 12);
		expect(promRotationRad({ sig: 'N_Asc_0', cat: 'Z', arc: 20 })).toBeCloseTo(-20 * DEG_, 12);
		expect(promRotationRad({ sig: 'N_Venus_0', cat: 'M', arc: 15 })).toBeCloseTo(-15 * DEG_, 12);
		expect(promRotationRad({ sig: 'N_Venus_0', cat: 'Z', arc: 'x' })).toBe(0);
		// 🔴 行星族 D2(+arc)与 D1 旧应星动(−arc)整号翻转 = 用户所指「direct/converse 方向反过来」。
		expect(promRotationRad({ sig: 'N_Venus_0', cat: 'Z', arc: 30 })).toBeCloseTo(30 * DEG_, 12);
	});

	test('🔴 670/670 全量:引擎弧公式号序不变(行星 RA(sig,真纬)−RA(promZ)/MC/Asc/Vertex)+ [D2] 迫星旋转落到应星成相位圈', ()=>{
		const pts = FX.points;
		const phi = FX.frame.phi * D2R;
		const co = Math.PI / 2 - phi;
		// [D2] 全族迫星动:族计数改名 planet(不再叫 sigMove);数值不变(506/52/56/56)。
		const counts = { planet: 0, mc: 0, asc: 0, vertex: 0 };
		FX.rows.forEach((r)=>{
			const P = pts[r.prom];
			const S = pts[r.sig];
			expect(P && S).toBeTruthy();
			const pz = effectiveEq(P, 'Z');           // 迫星恒零纬投影
			const st = sigEqOf(S);                    // 应星恒真纬
			const sz = effectiveEq(S, 'Z');           // 轴类公式两侧 zero-lat
			// [D2] moverOfRow 恒 prom;族分类改用 base(引擎弧公式号序仍按应星类型分族,是不变的事实)。
			expect(moverOfRow(r)).toBe('prom');
			const base = sigBaseIdOf(r.sig);
			const spin = promRotationRad(r) / D2R;    // [D2] 迫星旋转角(度):+arc(planet)/−arc(轴)
			let err;
			if(/^MC$/i.test(base)){
				err = Math.abs(n180((pz.ra - sz.ra) - r.arc));
				expect(spin).toBeCloseTo(-r.arc, 9);   // 迫星 −arc 落子午圈
				expect(err).toBeLessThan(0.02);
				counts.mc += 1;
			}else if(/^Asc$/i.test(base)){
				err = Math.abs(n180(((pz.ra - AD(pz.decl, phi)) - (sz.ra - AD(sz.decl, phi))) - r.arc));
				expect(spin).toBeCloseTo(-r.arc, 9);
				expect(err).toBeLessThan(0.05);
				counts.asc += 1;
			}else if(/^Vertex$/i.test(base)){
				err = Math.abs(n180(((pz.ra - AD(pz.decl, co)) - (sz.ra - AD(sz.decl, co))) - r.arc));
				expect(spin).toBeCloseTo(-r.arc, 9);
				expect(err).toBeLessThan(0.05);
				counts.vertex += 1;
			}else{
				// 行星/北交/福点:arc = RA(sig,真纬) − RA(promZ)(引擎号序不变);
				// [D2] 迫星转 +arc → RA(promZ)+arc = RA(sig) → 迫星相位点落到应星赤经圈(命中)。
				err = Math.abs(n180((st.ra - pz.ra) - r.arc));
				expect(spin).toBeCloseTo(r.arc, 9);
				expect(err).toBeLessThan(0.02);
				counts.planet += 1;
			}
		});
		// 族计数钉死(fixture 结构变了要来这里对账,不许静默漂移)
		expect(counts).toEqual({ planet: 506, mc: 52, asc: 56, vertex: 56 });
		expect(counts.planet + counts.mc + counts.asc + counts.vertex).toBe(FX.rows.length);
	});
});
