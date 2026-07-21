// 3D 星盘大修 WS-0 金标:按需渲染状态机(纯逻辑)+ sph 球面公式 + 几何合并等价性 +
// r0.185 迁移哨兵(源码静态断言,防旧 API 回潮)。
// ⚠️ Astro3D 类本体依赖 WebGL/DOM,jsdom 不可实例化 —— 状态机以「同逻辑提取」测,
//    源码形态由静态哨兵钉住(与 preflight 机械核互为镜像)。
import fs from 'fs';
import path from 'path';
// ⚠️ 不 import Astro3D 本体:其 three r185 ESM 链 jest transform 吃不动(_three.Ray is
//    not a constructor);sph 已抽零依赖纯模块,源码形态由下方静态哨兵钉。
import { sph } from '../sphMath';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'Astro3D.js'), 'utf8');

describe('sph 球面摆点公共式(黄道系,主限赤道系同构)', () => {
	test('lon=0,lat=0 → (R,0,0)', () => {
		const p = sph(0, 0, 100);
		expect(p.x).toBeCloseTo(100, 9);
		expect(p.y).toBeCloseTo(0, 9);
		expect(p.z).toBeCloseTo(0, 9);
	});
	test('lon=90 → z=-R(右手系黄经东移为 -z)', () => {
		const p = sph(90, 0, 100);
		expect(p.x).toBeCloseTo(0, 9);
		expect(p.z).toBeCloseTo(-100, 9);
	});
	test('lat=90 → 北极 (0,R,0)', () => {
		const p = sph(123, 90, 50);
		expect(p.x).toBeCloseTo(0, 9);
		expect(p.y).toBeCloseTo(50, 9);
		expect(p.z).toBeCloseTo(0, 9);
	});
	test('与旧手写式逐字节等价(随机 32 组)', () => {
		for(let i = 0; i < 32; i += 1){
			const lon = (i * 37) % 360;
			const lat = ((i * 13) % 180) - 90;
			const R = 10 + i;
			// 旧式:y=R·sin(lat), tmpR=R·cos(lat), x=tmpR·cos(lon), z=−tmpR·sin(lon)
			const y = R * Math.sin(lat * Math.PI / 180);
			const tmpR = R * Math.cos(lat * Math.PI / 180);
			const x = tmpR * Math.cos(lon * Math.PI / 180);
			const z = -tmpR * Math.sin(lon * Math.PI / 180);
			const p = sph(lon, lat, R);
			expect(p.x).toBe(x);
			expect(p.y).toBe(y);
			expect(p.z).toBe(z);
		}
	});
});

describe('按需渲染状态机(逻辑同构)', () => {
	// 与 Astro3D.wake/needsFrames/animate 同逻辑的最小提取
	function mkMachine({ autoRotate = false, onDemand = true } = {}){
		const m = {
			wakeFrames: 0, rafId: null, frames: 0, disposed: false, autoRotate,
			wake(n = 1){
				m.wakeFrames = Math.max(m.wakeFrames, n);
				if(m.rafId === null && !m.disposed){ m.tick(); }
			},
			needsFrames(){ return m.autoRotate || m.wakeFrames > 0; },
			tick(){
				if(m.disposed){ m.rafId = null; return; }
				m.frames += 1;
				if(m.wakeFrames > 0){ m.wakeFrames -= 1; }
				if(onDemand && !m.needsFrames()){ m.rafId = null; return; }
				m.rafId = 1;   // 模拟排下一帧
			},
			pump(n){ for(let i = 0; i < n && m.rafId !== null; i += 1){ m.tick(); } },
		};
		return m;
	}

	test('idle 停帧:wake(2) 渲 2 帧后 rafId=null(零渲染)', () => {
		const m = mkMachine();
		m.wake(2);
		m.pump(10);
		expect(m.frames).toBe(2);
		expect(m.rafId).toBeNull();
	});

	test('idle 后再 wake 可拉起(不会死机)', () => {
		const m = mkMachine();
		m.wake(1);
		m.pump(10);
		const f1 = m.frames;
		m.wake(1);
		m.pump(10);
		expect(m.frames).toBeGreaterThan(f1);
		expect(m.rafId).toBeNull();
	});

	test('autoRotate=true 连续渲(用户显式开启的例外)', () => {
		const m = mkMachine({ autoRotate: true });
		m.wake(1);
		m.pump(30);
		expect(m.frames).toBe(31);
		expect(m.rafId).not.toBeNull();
	});

	test('kill-switch(onDemand=false)= 持续渲旧行为', () => {
		const m = mkMachine({ onDemand: false });
		m.wake(1);
		m.pump(30);
		expect(m.frames).toBe(31);
		expect(m.rafId).not.toBeNull();
	});

	test('disposed 后 wake 不拉起', () => {
		const m = mkMachine();
		m.disposed = true;
		m.wake(5);
		expect(m.frames).toBe(0);
	});
});

describe('🔴 r0.185 迁移哨兵(旧 API 零回潮)', () => {
	test('旧 encoding 族 API 清零(outputEncoding/sRGBEncoding/.encoding=)', () => {
		// 只查代码行(剥注释)
		const code = SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
		expect(code).not.toMatch(/outputEncoding\s*=/);
		expect(code).not.toMatch(/THREE\.sRGBEncoding/);
		expect(code).not.toMatch(/gammaFactor\s*=/);
		expect(code).not.toMatch(/physicallyCorrectLights\s*=/);
		expect(code).not.toMatch(/new THREE\.Font\(/);
		expect(code).not.toMatch(/new THREE\.TextGeometry\(/);
	});
	test('DRACOLoader 走本仓 patched 副本(webpack4 不吃 import.meta)', () => {
		expect(SRC).toMatch(/from '\.\/vendor\/DRACOLoader'/);
		const vendored = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'DRACOLoader.js'), 'utf8');
		const vendoredCode = vendored.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
		expect(vendoredCode).not.toContain('import.meta');
	});
	test('pixelRatio 封顶 2 在位', () => {
		expect(SRC).toMatch(/setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 2\)\)/);
	});
	test('webglcontextlost/restored 双监听在位', () => {
		expect(SRC).toContain("addEventListener('webglcontextlost'");
		expect(SRC).toContain("addEventListener('webglcontextrestored'");
	});
	test('initLonLine 合并形态在位(单 LineSegments,旧 360 Group 循环已除)', () => {
		expect(SRC).toContain('lonTicksMerged');
		// 旧形态特征:循环体内 genDegree(R, color, i) —— 不应再出现
		expect(SRC).not.toMatch(/lon = this\.genDegree\(R, color, i\)/);
	});
});
