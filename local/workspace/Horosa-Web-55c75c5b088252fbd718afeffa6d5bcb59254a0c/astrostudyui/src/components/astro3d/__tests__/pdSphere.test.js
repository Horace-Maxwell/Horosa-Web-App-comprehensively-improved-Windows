// 主限法 3D 天球(WS-3)金标:纯数学层(天顶/东点自检、arc→年龄、播放目标角、
// kind→渲染类型映射完整性)+ 三件套挂载契约 + fetchPd3D 服务(缓存/合流/剥壳)。
//
// ⚠️ jest 里 three 全族被 threeJestStub 顶替(见 test/threeJestStub.js 头注)——
// 本套件绝不实例化 three:凡需断言的几何全走 pdSphereMath 纯模块(零 three 依赖,
// 文末哨兵钉死),PDSphereEngine/AstroPDSphere 只做源码形态静态断言。
// 后端契约镜像:kind 枚举与 astropy/tests/test_pd3d_endpoint.py 的位置圈语义型
// 断言一一对应(后端新增 kind 而前端映射表未登 = 本套件红)。
import fs from 'fs';
import path from 'path';

jest.mock('../../../utils/request', ()=>jest.fn());

import request from '../../../utils/request';
import { fetchPd3D } from '../../../services/astroPd3d';
import { normalizePrimaryDirectionSubTabKey } from '../../../utils/primaryDirectionSync';
import {
	vDot, vLen, unitOf,
	zenithOf, eastPointOf, northPointOf, horizonSelfCheck,
	greatCircleThrough, eclipticPoleOf,
	isConverseRow, rowDateMs, rowAgeYears, nearestRowIndexByAge,
	playTargetAngleRad, playDurationMs, effectiveEq,
	CIRCLE_KIND_RENDER, FRAME_HIGHLIGHT_TARGET, VIRTUAL_POINT_KINDS,
} from '../pdSphereMath';

const DEG = Math.PI / 180;

describe('地平框架:天顶/东点自检公式', () => {
	// 覆盖常规纬度/赤道/极高纬/南纬/跨 0° armc
	const FRAMES = [
		{ armc: 47.5, phi: 40.0 },
		{ armc: 0, phi: 0 },
		{ armc: 300.0, phi: 65.0 },
		{ armc: 123.456, phi: -33.5 },
		{ armc: 359.9, phi: 89.0 },
	];

	test('天顶 = (ra=armc, decl=φ);东点 = (ra=armc+90, decl=0)', () => {
		const z = zenithOf({ armc: 47.5, phi: 40 });
		expect(z.ra).toBeCloseTo(47.5, 12);
		expect(z.decl).toBe(40);
		const e = eastPointOf({ armc: 47.5, phi: 40 });
		expect(e.ra).toBeCloseTo(137.5, 12);
		expect(e.decl).toBe(0);
		// 跨 0°:armc=300 → 东点 ra=30
		expect(eastPointOf({ armc: 300, phi: 65 }).ra).toBeCloseTo(30, 12);
	});

	test('🔴 交付自检:东点必在地平圈上(与天顶点积=0,容差 1e-6,全 frame 组)', () => {
		FRAMES.forEach((frame)=>{
			const chk = horizonSelfCheck(frame, 1e-6);
			expect(chk.ok).toBe(true);
			expect(Math.abs(chk.dot)).toBeLessThanOrEqual(1e-6);
		});
	});

	test('地平北点:单位长、⊥天顶、⊥东点;φ=0 时=天北极', () => {
		FRAMES.forEach((frame)=>{
			const n = northPointOf(frame);
			expect(n).not.toBeNull();
			expect(vLen(n)).toBeCloseTo(1, 12);
			const z = zenithOf(frame);
			const e = eastPointOf(frame);
			expect(Math.abs(vDot(n, unitOf(z.ra, z.decl)))).toBeLessThan(1e-9);
			expect(Math.abs(vDot(n, unitOf(e.ra, e.decl)))).toBeLessThan(1e-9);
		});
		const equatorNorth = northPointOf({ armc: 0, phi: 0 });
		expect(equatorNorth.y).toBeCloseTo(1, 12);   // 赤道上地平北点=天北极
	});

	test('大圆基:过两锚点、法向量与两点皆正交;共线退化返 null', () => {
		const p1 = unitOf(0, 0);
		const p2 = unitOf(90, 0);
		const basis = greatCircleThrough(p1, p2);
		expect(basis).not.toBeNull();
		// u=p1(t=0 即过 p1);w 与 p2 同向(t=90° 过 p2)
		expect(basis.u.x).toBeCloseTo(1, 12);
		expect(Math.abs(vDot(basis.n, p1))).toBeLessThan(1e-12);
		expect(Math.abs(vDot(basis.n, p2))).toBeLessThan(1e-12);
		// 对跖/重合 → 大圆不唯一 → null
		expect(greatCircleThrough(unitOf(0, 0), unitOf(180, 0))).toBeNull();
		expect(greatCircleThrough(unitOf(10, 5), unitOf(10, 5))).toBeNull();
	});

	test('位置圈几何(Regio/Campanus):过地平南北点与应星的大圆平面含两锚点', () => {
		const frame = { armc: 47.5, phi: 40 };
		const north = northPointOf(frame);
		const sig = unitOf(123.4, 5.6);
		const basis = greatCircleThrough(north, sig);
		expect(basis).not.toBeNull();
		expect(Math.abs(vDot(basis.n, north))).toBeLessThan(1e-12);
		expect(Math.abs(vDot(basis.n, sig))).toBeLessThan(1e-12);
	});

	test('黄道极(ecliptic-meridian 圈极点):ra=270, decl=90−ε', () => {
		const p = eclipticPoleOf(23.4372);
		expect(p.ra).toBe(270);
		expect(p.decl).toBeCloseTo(66.5628, 9);
	});
});

describe('表行换算:arc→年龄 / 顺逆判据', () => {
	const BIRTH_MS = rowDateMs('1990/03/15 12:30:00');

	test('出生时刻解析(快照链同口径:斜杠→连字符 Date.parse)', () => {
		expect(Number.isFinite(BIRTH_MS)).toBe(true);
		expect(Number.isNaN(rowDateMs(''))).toBe(true);
		expect(Number.isNaN(rowDateMs(null))).toBe(true);
	});

	test('日期可解析:年龄=应期−出生真历差(任何 pdTimeKey 下精确)', () => {
		const age = rowAgeYears({ arc: 99.9, date: '2020/03/15 12:30:00' }, BIRTH_MS);
		expect(age).toBeGreaterThan(29.9);
		expect(age).toBeLessThan(30.1);
		// 日期优先于 arc(99.9 是干扰值,不得被采用)
		expect(Math.abs(age - 30)).toBeLessThan(0.1);
	});

	test('日期缺失/坏值:回退 |arc|(Ptolemy 1°=1 年近似;converse 负弧取绝对值)', () => {
		expect(rowAgeYears({ arc: 42.25, date: '' }, BIRTH_MS)).toBe(42.25);
		expect(rowAgeYears({ arc: -25.5, date: 'not-a-date' }, BIRTH_MS)).toBe(25.5);
		expect(rowAgeYears({ arc: 18, date: '2008/03/15' }, NaN)).toBe(18);
	});

	test('顺逆判据:arc 正负号天然区分(后端顺逆同引擎产出约定)', () => {
		expect(isConverseRow({ arc: 30.5 })).toBe(false);
		expect(isConverseRow({ arc: -30.5 })).toBe(true);
		expect(isConverseRow({ arc: 0 })).toBe(false);
		expect(isConverseRow(null)).toBe(false);
	});

	test('时间轴反查:按年龄取最近表行;空表返 −1', () => {
		const rows = [
			{ arc: 10, date: '2000/03/15 12:30:00' },
			{ arc: 20, date: '2010/03/15 12:30:00' },
			{ arc: 30, date: '2020/03/15 12:30:00' },
		];
		expect(nearestRowIndexByAge(rows, 9.4, BIRTH_MS)).toBe(0);
		expect(nearestRowIndexByAge(rows, 19, BIRTH_MS)).toBe(1);
		expect(nearestRowIndexByAge(rows, 26.1, BIRTH_MS)).toBe(2);
		expect(nearestRowIndexByAge([], 10, BIRTH_MS)).toBe(-1);
		expect(nearestRowIndexByAge(rows, NaN, BIRTH_MS)).toBe(-1);
	});
});

describe('播放目标角([G3] dirGroup.rotation.y 补间终点;角公式与旧 skyGroup 承载完全同值)', () => {
	test('direct(正弧):0 → −arc·π/180', () => {
		expect(playTargetAngleRad(30)).toBeCloseTo(-30 * DEG, 12);
		expect(playTargetAngleRad(0.5)).toBeCloseTo(-0.5 * DEG, 12);
	});

	test('converse(负弧):符号天然反向(=+|arc|·π/180)', () => {
		expect(playTargetAngleRad(-30)).toBeCloseTo(30 * DEG, 12);
		expect(playTargetAngleRad(-30)).toBeCloseTo(-playTargetAngleRad(30), 12);
	});

	test('坏值兜底 0;时长档:|arc|≤60° → 2.5s,>60° → 4s', () => {
		expect(playTargetAngleRad('x')).toBe(0);
		expect(playTargetAngleRad(undefined)).toBe(0);
		expect(playDurationMs(30)).toBe(2500);
		expect(playDurationMs(60)).toBe(2500);
		expect(playDurationMs(60.1)).toBe(4000);
		expect(playDurationMs(-75)).toBe(4000);   // converse 长弧同档
	});
});

describe('有效坐标口径(In-Zodiaco 投影 vs In-Mundo 真位)', () => {
	const pt = { ra: 10.1, decl: 5.2, raZ: 12.3, declZ: 3.4 };

	test("cat='Z':用黄道投影 raZ/declZ(后端注明迫星周日圈用 declZ)", () => {
		expect(effectiveEq(pt, 'Z')).toEqual({ ra: 12.3, decl: 3.4 });
	});

	test("cat='M':用真位 ra/decl", () => {
		expect(effectiveEq(pt, 'M')).toEqual({ ra: 10.1, decl: 5.2 });
	});

	test('raZ/declZ 缺失回退真位;空点安全', () => {
		expect(effectiveEq({ ra: 7, decl: -2 }, 'Z')).toEqual({ ra: 7, decl: -2 });
		expect(effectiveEq(null, 'Z')).toEqual({ ra: 0, decl: 0 });
	});
});

describe('🔴 circles kind → 渲染类型映射完整性(与后端 test_pd3d_endpoint 枚举互为镜像)', () => {
	// perpredict.getPrimaryDirection3D 位置圈语义型全集(改后端枚举须同步此表)
	const BACKEND_CIRCLE_KINDS = [
		'horizon-east', 'meridian', 'prime-vertical',
		'sampled', 'position-circle', 'ecliptic-meridian', 'hour-circle',
	];

	test('映射表键集 = 后端 kind 枚举(不多不少)', () => {
		expect(Object.keys(CIRCLE_KIND_RENDER).sort()).toEqual([...BACKEND_CIRCLE_KINDS].sort());
	});

	test('渲染类型值域封闭:frame-highlight/great-circle/polyline/thin-arc', () => {
		const allowed = new Set(['frame-highlight', 'great-circle', 'polyline', 'thin-arc']);
		Object.values(CIRCLE_KIND_RENDER).forEach((v)=>{
			expect(allowed.has(v)).toBe(true);
		});
		// 语义锚点(与后端 test_circle_semantics 对齐)
		expect(CIRCLE_KIND_RENDER['horizon-east']).toBe('frame-highlight');   // ASC
		expect(CIRCLE_KIND_RENDER['meridian']).toBe('frame-highlight');       // MC
		expect(CIRCLE_KIND_RENDER['sampled']).toBe('polyline');               // Placidus 族
		expect(CIRCLE_KIND_RENDER['position-circle']).toBe('great-circle');   // Regio/Campanus
		expect(CIRCLE_KIND_RENDER['hour-circle']).toBe('thin-arc');           // 核族
		expect(CIRCLE_KIND_RENDER['ecliptic-meridian']).toBe('thin-arc');     // in_zodiaco_lon
	});

	test('frame-highlight 落点表:键=三个框架语义型,值=地平三圈', () => {
		expect(Object.keys(FRAME_HIGHLIGHT_TARGET).sort()).toEqual(['horizon-east', 'meridian', 'prime-vertical']);
		expect(new Set(Object.values(FRAME_HIGHLIGHT_TARGET)).size).toBe(3);
		Object.keys(FRAME_HIGHLIGHT_TARGET).forEach((k)=>{
			expect(CIRCLE_KIND_RENDER[k]).toBe('frame-highlight');
		});
	});

	test('虚点判据 = 后端 _pd3dKindOf 派生型枚举(term/antiscia/aspect)', () => {
		['term', 'antiscia', 'aspect'].forEach((k)=>expect(VIRTUAL_POINT_KINDS.has(k)).toBe(true));
		['planet', 'angle', 'node', 'lot', 'vertex', 'house'].forEach((k)=>expect(VIRTUAL_POINT_KINDS.has(k)).toBe(false));
	});
});

describe('🔴 三件套挂载契约(缺一即隐性坏)', () => {
	const SRC_DIR = path.join(__dirname, '..');
	const DIRECT_MAIN_SRC = fs.readFileSync(
		path.join(SRC_DIR, '..', 'direction', 'AstroDirectMain.js'), 'utf8');
	const MODEL_SRC = fs.readFileSync(
		path.join(SRC_DIR, '..', '..', 'models', 'astro.js'), 'utf8');

	test('① primaryDirectionSync:VALID_DIRECTION_SUB_TABS 含 primarydirsphere', () => {
		expect(normalizePrimaryDirectionSubTabKey('primarydirsphere')).toBe('primarydirsphere');
	});

	test('② models/astro:shouldIncludePrimaryDirection 认 primarydirsphere(载入携带 PD 数据)', () => {
		expect(MODEL_SRC).toMatch(/currentSubTab === 'primarydirsphere'/);
	});

	test('③ AstroDirectMain:TabPane 挂载 + hook 登记 + PD 表行判据 + 构参零复刻', () => {
		expect(DIRECT_MAIN_SRC).toContain('key="primarydirsphere"');
		expect(DIRECT_MAIN_SRC).toMatch(/primarydirsphere:\s*\{\s*fun: null/);
		expect(DIRECT_MAIN_SRC).toMatch(/key === 'primarydirsphere'/);   // isPrimaryDirectionTabKey
		// pd3d 构参 = buildPrimaryDirectionRequest 直传(与 /predict/pd 同一函数,别复制粘贴)
		expect(DIRECT_MAIN_SRC).toContain('buildRequest={this.buildPrimaryDirectionRequest}');
	});

	test('AI 快照零新增段(复用主限表既有段)注记在位', () => {
		expect(DIRECT_MAIN_SRC).toContain('零新增快照段');
	});

	test('引擎自检在位:setData 后 console.assert 东点在地平圈上', () => {
		const engineSrc = fs.readFileSync(path.join(SRC_DIR, 'PDSphereEngine.js'), 'utf8');
		expect(engineSrc).toContain('horizonSelfCheck');
		expect(engineSrc).toMatch(/console\.assert\(chk\.ok/);
	});

	test('🔴 纯数学模块零 three 依赖哨兵(jsdom 不实例化 three 的前提)', () => {
		const mathSrc = fs.readFileSync(path.join(SRC_DIR, 'pdSphereMath.js'), 'utf8');
		expect(mathSrc).not.toMatch(/from 'three'/);
		expect(mathSrc).not.toMatch(/require\(['"]three/);
	});
});

// [G3] 方向语义源码契约:旋转唯一承载者=dirGroup(应星固定于本命位不动)。
// 病史:旧版补间整 skyGroup(应星连黄道一起转走)+ selGroup 复制锚一物两标,
// 用户实读成「应星在动/方向搞反了」——本组契约钉死修后语义,回潮即红。
describe('🔴 [G3] 旋转承载者契约:唯 dirGroup 转,skyGroup 恒 0(应星不动)', () => {
	const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'PDSphereEngine.js'), 'utf8');

	test('播放/拖拽/复位三路补间全部经 _applyDirRotation 中枢(dirGroup+真位层同角,逐帧真位更新)', () => {
		// [C1] 改锁:旋转赋值收口到 _applyDirRotation —— 分散直写会漏真位层同步(复合运动断一半)。
		expect(engineSrc).toMatch(/this\._applyDirRotation\(target \* eased\)/);
		expect(engineSrc).toMatch(/this\._applyDirRotation\(from \+ \(target - from\)/);
		expect(engineSrc).toMatch(/this\._applyDirRotation\(from \* \(1 - easeInOutCubic/);
		// 中枢本体:dirGroup 与 trueGroup 同角;除中枢外不得再出现 dirGroup.rotation.y 直写(读比较不限)。
		expect(engineSrc).toMatch(/_applyDirRotation\(y\)\{[\s\S]{0,400}dirGroup\.rotation\.y = y;[\s\S]{0,200}trueGroup\.rotation\.y = y;/);
		const directWrites = (engineSrc.match(/this\.dirGroup\.rotation\.y = /g) || []).length;
		expect(directWrites).toBe(1);   // 唯中枢一处
	});

	test('skyGroup.rotation.y 只允许归零赋值(任何非 0 写入=应星又开始转,即刻红)', () => {
		const writes = engineSrc.match(/skyGroup\.rotation\.y\s*=\s*[^=;\n]+/g) || [];
		expect(writes.length).toBeGreaterThan(0);
		writes.forEach((w) => {
			expect(w.replace(/\s+/g, ' ').trim()).toMatch(/skyGroup\.rotation\.y = 0$/);
		});
	});

	test('应星复制锚已废(一物两标不得回潮);被引导点标挂 dirGroup 运动组', () => {
		expect(engineSrc).not.toContain('anchorDot');
		expect(engineSrc).toMatch(/this\.dirGroup\.add\(marker\)/);
	});

	test('[G1] 实体点=glyph 即本体(注释块+占星字形通道在位)', () => {
		expect(engineSrc).toMatch(/\[G1\] 实体点=glyph 即本体/);
		expect(engineSrc).toMatch(/fontFamily: 'ywastrochart'/);
	});

	test('[G2] 黄道刻度=ywastrochart 字形,emoji 清零', () => {
		expect(engineSrc).not.toMatch(/[♈♉♊♋♌♍♎♏♐♑♒♓]/);
	});
});

describe('fetchPd3D 服务(幂等缓存/在途合流/Java 剥壳)', () => {
	test('Java {Result:{...}} 外壳统一剥掉;同参二次调用命中缓存(零重复请求)', async () => {
		const values = { date: '1990/03/15', pdMethod: 'core_alchabitius', k: 'cache-1' };
		request.mockResolvedValueOnce({ Result: { frame: { armc: 47.5 }, rows: [], points: {}, circles: {} } });
		const first = await fetchPd3D(values);
		expect(first.frame.armc).toBe(47.5);
		const calls = request.mock.calls.length;
		const second = await fetchPd3D({ ...values });
		expect(request.mock.calls.length).toBe(calls);   // 缓存命中,无新请求
		expect(second.frame.armc).toBe(47.5);
		expect(second).not.toBe(first);   // 各消费方独立副本(引擎就地读数不共享引用)
	});

	test('在途合流:同参并发只发一次请求,两端都拿到结果', async () => {
		const values = { date: '1990/03/15', pdMethod: 'placidus', k: 'inflight-1' };
		let resolveFn = null;
		request.mockReturnValueOnce(new Promise((resolve)=>{ resolveFn = resolve; }));
		const before = request.mock.calls.length;
		const p1 = fetchPd3D(values);
		const p2 = fetchPd3D({ ...values });
		expect(request.mock.calls.length).toBe(before + 1);
		resolveFn({ frame: { armc: 1 }, rows: [] });
		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1.frame.armc).toBe(1);
		expect(r2.frame.armc).toBe(1);
	});

	test('错误形态 {err} 不入缓存(服务恢复后重试可得真数据)', async () => {
		const values = { date: '1990/03/15', pdMethod: 'campanus', k: 'err-1' };
		request.mockResolvedValueOnce({ err: 'param error' });
		const bad = await fetchPd3D(values);
		expect(bad.err).toBe('param error');
		request.mockResolvedValueOnce({ frame: { armc: 2 }, rows: [] });
		const good = await fetchPd3D({ ...values });
		expect(good.frame.armc).toBe(2);   // 第二次真发了请求(err 未被缓存)
	});
});

// ═══ [C1] 复合运动·真位层纯数学(自转×公转;弧=物理历时,诸曜沿黄道自行) ═══
describe('[C1] 复合运动真位层(elapsedDaysForArc/eclToEqTrue/properSpeedOfPoint/trueMotionDeltaLon)', () => {
	const M = require('../pdSphereMath');

	test('弧→历时:360.98564736629° = 1 平太阳日;90°≈5.98时;converse 负弧历时为负;NaN→0', () => {
		expect(M.elapsedDaysForArc(M.SIDEREAL_ROTATION_DEG_PER_DAY)).toBeCloseTo(1, 12);
		expect(M.elapsedDaysForArc(90) * 24).toBeCloseTo(5.9836, 3);
		expect(M.elapsedDaysForArc(-30)).toBeCloseTo(-30 / 360.98564736629, 12);
		expect(M.elapsedDaysForArc('x')).toBe(0);
	});

	test('eclToEqTrue 全式:β=0 时与 β=0 特例吻合(λ=90°→α=90°,δ=ε);λ=0,β=0→(0,0)', () => {
		const eps = 23.4367;
		const a = M.eclToEqTrue(90, 0, eps);
		expect(a.ra).toBeCloseTo(90, 9);
		expect(a.decl).toBeCloseTo(eps, 9);
		const b = M.eclToEqTrue(0, 0, eps);
		expect(b.ra).toBeCloseTo(0, 9);
		expect(b.decl).toBeCloseTo(0, 9);
		// 真 β:λ=0,β=60 → α=atan2(−tanβ·sinε,1), δ=asin(sinβ·cosε)(手算对拍)
		const c = M.eclToEqTrue(0, 60, eps);
		const D2R = Math.PI / 180;
		expect(c.ra).toBeCloseTo(((Math.atan2(-Math.tan(60 * D2R) * Math.sin(eps * D2R), 1) / D2R) + 360) % 360, 9);
		expect(c.decl).toBeCloseTo(Math.asin(Math.sin(60 * D2R) * Math.cos(eps * D2R)) / D2R, 9);
	});

	test('点位自行速分派:实体=瞬时速优先(含逆行负值),缺速回退平均表;相位点随本体;映点反号;界/恒星/轴点/宫头/朔望=0', () => {
		const speedOf = (id) => ({ Moon: 13.5, Venus: -0.61 }[id]);
		expect(M.properSpeedOfPoint('N_Moon_0', 'aspect', speedOf)).toBeCloseTo(13.5, 12);
		expect(M.properSpeedOfPoint('D_Venus_120', 'aspect', speedOf)).toBeCloseTo(-0.61, 12);  // 逆行相位点随本体反向
		expect(M.properSpeedOfPoint('A_Moon', 'antiscia', speedOf)).toBeCloseTo(-13.5, 12);     // 映点镜像反号
		expect(M.properSpeedOfPoint('Sun', '', () => undefined)).toBeCloseTo(M.MEAN_DAILY_MOTION.Sun, 12); // 平均表兜底
		expect(M.properSpeedOfPoint('T_Venus_12', 'term', speedOf)).toBe(0);
		expect(M.properSpeedOfPoint('Regulus', 'star', speedOf)).toBe(0);
		expect(M.properSpeedOfPoint('MC', '', speedOf)).toBe(0);
		expect(M.properSpeedOfPoint('Cusp11', '', speedOf)).toBe(0);
		expect(M.properSpeedOfPoint('Syzygy', '', speedOf)).toBe(0);
	});

	test('真位位移:月球 90° 弧全程 ≈ +3.285°(13.1764×90/360.9856);f 半程减半;f 越界钳 [0,1]', () => {
		const mu = M.MEAN_DAILY_MOTION.Moon;
		expect(M.trueMotionDeltaLon(mu, 90, 1)).toBeCloseTo(13.1764 * 90 / 360.98564736629, 6);
		expect(M.trueMotionDeltaLon(mu, 90, 0.5)).toBeCloseTo(M.trueMotionDeltaLon(mu, 90, 1) / 2, 12);
		expect(M.trueMotionDeltaLon(mu, 90, 2)).toBeCloseTo(M.trueMotionDeltaLon(mu, 90, 1), 12);
		expect(M.trueMotionDeltaLon(mu, -90, 1)).toBeCloseTo(-M.trueMotionDeltaLon(mu, 90, 1), 12); // converse 反演
	});

	test('平均日行表口径:月>日>火>木>土;交点为负(平均逆行);日=水=金(几何长期均值)', () => {
		const T = M.MEAN_DAILY_MOTION;
		expect(T.Moon).toBeGreaterThan(T.Sun);
		expect(T.Sun).toBeGreaterThan(T.Mars);
		expect(T.Mars).toBeGreaterThan(T.Jupiter);
		expect(T.Jupiter).toBeGreaterThan(T.Saturn);
		expect(T['North Node']).toBeLessThan(0);
		expect(T.Mercury).toBe(T.Sun);
		expect(T.Venus).toBe(T.Sun);
	});

	test('速表构建 bodySpeedMapOf:{objects}/{chart:{objects}} 双形兼容;angles 并入;缺 lonspeed 不入表', () => {
		const objs = [{ id: 'Moon', lonspeed: 13.2 }, { id: 'Venus', lonspeed: -0.6 }, { id: 'Sun' }];
		expect(M.bodySpeedMapOf({ objects: objs })).toEqual({ Moon: 13.2, Venus: -0.6 });
		expect(M.bodySpeedMapOf({ chart: { objects: objs, angles: [{ id: 'MC', lonspeed: 361 }] } })).toEqual({ Moon: 13.2, Venus: -0.6, MC: 361 });
		expect(M.bodySpeedMapOf(null)).toEqual({});
	});

	test('[C1] 真位层源契约:纯 glyph 无点无环 / 单一银白 / 静止收敛门 / 历时用带符号弧', () => {
		const src = fs.readFileSync(path.join(__dirname, '..', 'PDSphereEngine.js'), 'utf8');
		const layer = (src.match(/_buildTrueMotionLayer\(row, conv\)\{[\s\S]*?\n\t\}/) || [''])[0];
		expect(layer.length).toBeGreaterThan(200);
		// 用户三轮定案:①不用点(SphereGeometry 绝迹) ②不用环形徽记 ③真位统一银白单色
		expect(layer).not.toMatch(/SphereGeometry/);
		expect(layer).not.toMatch(/makeRingSprite/);
		expect(layer).toMatch(/#dbe7f5/);
		expect(layer).not.toMatch(/twin\.material\.color\.set\(dirCss\)/);
		// 🔴 一体一影:①层必按 basePointIdOf 去重(pd3d 本命星体多为 N_<body>_0 形,与裸形并存
		// 曾致同星双银白叠影);promAtBody 跳过必按 base 判(裸 pid 判恒不命中的旧病)。
		expect(layer).toMatch(/seenBase/);
		expect(layer).toMatch(/promAtBody && base === promBase/);
		expect(layer).not.toMatch(/promAtBody && pid === promBase/);
		// 静止收敛门:f≈0 整层隐藏(重合双像不叠亮);历时/位移取带符号 row.arc(converse 反演)
		const upd = (src.match(/_updateTrueMotion\(\)\{[\s\S]*?\n\t\}/) || [''])[0];
		expect(upd).toMatch(/trueGroup\.visible = this\.trueMotionOn && f > 1e-4/);
		expect(upd).toMatch(/trueMotionDeltaLon\(en\.mu, sel\.row\.arc, f\)/);
	});

	test('历时显示:5.98时→「≈5时59分」;1.5日→「≈1日12时」;负值前缀「前」(converse)', () => {
		expect(M.formatElapsedHM(M.elapsedDaysForArc(90))).toBe('≈5时59分');
		expect(M.formatElapsedHM(1.5)).toBe('≈1日12时');
		expect(M.formatElapsedHM(-0.25)).toBe('前≈6时0分');
	});
});
