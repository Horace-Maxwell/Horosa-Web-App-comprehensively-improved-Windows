// 天文馆日月行星表面贴图跨全量重建留用。
// 背景:开场六秒内三份回包(轻量 → 全量 → 补全恒星)各整场重建一次,十一张程序化贴图每次重画重传约 30ms,
// 是重建里最大的一块;贴图内容只跟「哪颗星」有关(月亮再加月相角),留用即可。
// 留用的前提是清场时不被 group.dispose(false, true) 连带释放 —— 所以清场前必须先从材质上摘下来。
import path from 'path';

const { readSource, fnBody } = require('../../../utils/__tests__/helpers/sourceSet');
const SRC = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));

let PlanetariumRenderer;
let created;
let painted;

beforeAll(()=>{
	jest.resetModules();
	created = [];
	painted = [];
	const stubs = new Proxy({}, { get(target, key){ if(!(key in target)){ target[key] = function Stub(){}; } return target[key]; } });
	stubs.DynamicTexture = function DynamicTexture(name){
		this.name = name;
		this.disposed = false;
		this.updates = 0;
		created.push(this);
	};
	stubs.DynamicTexture.prototype.getContext = function(){ return {}; };
	stubs.DynamicTexture.prototype.update = function(){ this.updates += 1; };
	stubs.DynamicTexture.prototype.dispose = function(){ this.disposed = true; };
	window.BABYLON = stubs;
	jest.doMock('../babylon/textures', ()=>({
		noise2: ()=>0,
		paintSkySurface: ()=>{},
		paintHorizonMistSurface: ()=>{},
		planetTextureSize: ()=>({ width: 8, height: 8 }),
		paintPlanetSurface: (ctx, id)=>{ painted.push(id); },
		paintMoonPhase: (ctx, phase)=>{ painted.push(`Moon@${phase && phase.phaseAngle}`); },
	}));
	PlanetariumRenderer = require('../babylon/PlanetariumRenderer').PlanetariumRenderer;
});

afterAll(()=>{
	jest.dontMock('../babylon/textures');
	delete window.BABYLON;
	jest.resetModules();
});

function host(phaseAngle){
	const h = Object.create(PlanetariumRenderer.prototype);
	h.scene = {};
	h._surfaceTextures = new Map();
	h._surfaceMats = [];
	h.currentMoonPhase = { phaseAngle };
	return h;
}

describe('表面贴图留用(行为)', ()=>{
	beforeEach(()=>{ created.length = 0; painted.length = 0; });

	test('同一颗星第二次要贴图:原样给回,不重画不重传', ()=>{
		const h = host(40);
		const a = h.createSurfaceTexture('Jupiter', null);
		const b = h.createSurfaceTexture('Jupiter', null);
		expect(b).toBe(a);
		expect(created.length).toBe(1);
		expect(painted).toEqual(['Jupiter']);
		expect(a.updates).toBe(1);
	});

	test('月亮本体与月相圆盘共用一张;月相不变不重画', ()=>{
		const h = host(40);
		const a = h.createSurfaceTexture('Moon', h.currentMoonPhase);
		const b = h.createSurfaceTexture('Moon', h.currentMoonPhase);
		const c = h.createSurfaceTexture('Moon', null);   // 不给月相 = 用当前月相
		expect(b).toBe(a);
		expect(c).toBe(a);
		expect(painted).toEqual(['Moon@40']);
	});

	test('月相变了:重画一张,旧月相那张释放,行星的不动', ()=>{
		const h = host(40);
		const jup = h.createSurfaceTexture('Jupiter', null);
		const old = h.createSurfaceTexture('Moon', h.currentMoonPhase);
		h.currentMoonPhase = { phaseAngle: 95.5 };
		const next = h.createSurfaceTexture('Moon', h.currentMoonPhase);
		expect(next).not.toBe(old);
		expect(old.disposed).toBe(true);
		expect(next.disposed).toBe(false);
		expect(jup.disposed).toBe(false);
		expect(h.createSurfaceTexture('Jupiter', null)).toBe(jup);
		expect(Array.from(h._surfaceTextures.keys()).filter((k)=>k.indexOf('Moon@') === 0)).toEqual(['Moon@95.50']);
	});

	test('清场前摘贴图:材质三个贴图槽都清空,留用的贴图没被释放', ()=>{
		const h = host(40);
		const tex = h.createSurfaceTexture('Mars', null);
		const mat = { diffuseTexture: tex, emissiveTexture: tex, opacityTexture: tex };
		h._surfaceMats.push(mat);
		h.detachSurfaceTextures();
		expect(mat.diffuseTexture).toBe(null);
		expect(mat.emissiveTexture).toBe(null);
		expect(mat.opacityTexture).toBe(null);
		expect(h._surfaceMats).toEqual([]);
		expect(tex.disposed).toBe(false);
		expect(h.createSurfaceTexture('Mars', null)).toBe(tex);
	});

	test('渲染端销毁:留用的贴图全部释放、表清空', ()=>{
		const h = host(40);
		const a = h.createSurfaceTexture('Mars', null);
		const b = h.createSurfaceTexture('Moon', h.currentMoonPhase);
		h.disposeSurfaceTextures();
		expect(a.disposed).toBe(true);
		expect(b.disposed).toBe(true);
		expect(h._surfaceTextures.size).toBe(0);
	});
});

describe('表面贴图留用(接线)', ()=>{
	test('两处建材质都登记了「挂着留用贴图」', ()=>{
		expect(fnBody(SRC, 'createBodyMaterial(body){')).toContain('this._surfaceMats.push(mat)');
		expect(fnBody(SRC, 'createMoonPhaseDisc(body, mesh, group){')).toContain('this._surfaceMats.push(mat)');
	});

	test('两条清场路径都先摘贴图、再释放组', ()=>{
		const dyn = fnBody(SRC, 'clearDynamicData(preserveStars = false){');
		expect(dyn).toContain('this.detachSurfaceTextures()');
		expect(dyn.indexOf('this.detachSurfaceTextures()')).toBeLessThan(dyn.indexOf('group.dispose(false, true)'));
		const all = fnBody(SRC, 'clearData(){');
		expect(all).toContain('this.detachSurfaceTextures()');
		expect(all.indexOf('this.detachSurfaceTextures()')).toBeLessThan(all.indexOf('dispose('));
	});

	test('销毁时先清场、再释放留用贴图、最后才释放场景', ()=>{
		const body = fnBody(SRC, '\tdispose(){');
		const clear = body.indexOf('this.clearData()');
		const tex = body.indexOf('this.disposeSurfaceTextures()');
		const scene = body.indexOf('this.scene.dispose()');
		expect(clear).toBeGreaterThan(-1);
		expect(tex).toBeGreaterThan(clear);
		expect(scene).toBeGreaterThan(tex);
	});

	test('不靠覆写贴图的 dispose 来保命(场景销毁会循环释放 textures[0],覆写成空操作会死循环)', ()=>{
		expect(SRC).not.toMatch(/texture\.dispose\s*=\s*/);
	});
});
