// 天文馆名牌纹理「画完隔两帧再上传」队列 + 行星轨迹只补轨迹(不整场重建)。
// 背景:WebKit 画布延迟栅格化,名牌画完当场上传 = 主线程原地等栅格化;一次开一层几十个名牌、
// 或整场重建两百多个名牌就是一个长帧。行星轨迹层首开曾整场重建(350–800ms,画轨迹本身只 5ms)。
import path from 'path';
import {
	LabelUploadQueue, LABEL_UPLOAD_MIN_AGE_FRAMES, LABEL_UPLOAD_SLICE_MS,
} from '../babylon/labelUploadQueue';

// 拆成子模块的大文件按「门面 + 子模块」全集读
const { readSource, fnBody, sourceSetFiles } = require('../../../utils/__tests__/helpers/sourceSet');
const { fileImportsName } = require('../../../utils/__tests__/helpers/importSpecs');   // 按 AST 认 import
const SRC = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));

describe('名牌上传队列(纯逻辑)', ()=>{
	test('渲染循环没转过:不收,调用方当场上传', ()=>{
		const q = new LabelUploadQueue();
		const up = jest.fn();
		expect(q.live).toBe(false);
		expect(q.push({}, up)).toBe(false);
		expect(q.size).toBe(0);
		expect(up).not.toHaveBeenCalled();
	});

	test('画完至少隔两帧才上传', ()=>{
		const q = new LabelUploadQueue(()=>0);
		q.tick();
		const up = jest.fn();
		expect(q.push({}, up)).toBe(true);
		for(let i = 1; i < LABEL_UPLOAD_MIN_AGE_FRAMES; i += 1){
			q.tick();
			expect(up).not.toHaveBeenCalled();
		}
		q.tick();
		expect(up).toHaveBeenCalledTimes(1);
		expect(q.size).toBe(0);
	});

	test('一帧的上传有时间预算,超了留到下一帧;但每帧至少传一张', ()=>{
		let t = 0;
		const q = new LabelUploadQueue(()=>t);
		q.tick();
		const order = [];
		for(let i = 0; i < 5; i += 1){
			const id = i;
			q.push({ id }, ()=>{ order.push(id); t += LABEL_UPLOAD_SLICE_MS; });   // 每张都吃满预算
		}
		q.tick();
		expect(order).toEqual([]);
		expect(q.tick()).toBe(1);
		expect(q.tick()).toBe(1);
		expect(order).toEqual([0, 1]);
		// 便宜的一帧里传完其余
		const cheap = new LabelUploadQueue(()=>0);
		cheap.tick();
		const done = [];
		for(let i = 0; i < 40; i += 1){ const id = i; cheap.push({ id }, ()=>done.push(id)); }
		cheap.tick();
		expect(cheap.tick()).toBe(40);
		expect(done[0]).toBe(0);
		expect(done[39]).toBe(39);
	});

	test('同一张重画:只传最后一次,重新计帧', ()=>{
		const q = new LabelUploadQueue(()=>0);
		q.tick();
		const tex = {};
		const first = jest.fn();
		const second = jest.fn();
		q.push(tex, first);
		q.tick();
		q.push(tex, second);
		expect(q.size).toBe(1);
		q.tick();
		expect(second).not.toHaveBeenCalled();
		q.tick();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	test('纹理释放后不再上传;clear 清空;force 不看帧龄全传', ()=>{
		const q = new LabelUploadQueue(()=>0);
		q.tick();
		const a = {}; const b = {}; const c = {};
		const ua = jest.fn(); const ub = jest.fn(); const uc = jest.fn();
		q.push(a, ua); q.push(b, ub);
		q.drop(a);
		expect(q.flush(true)).toBe(1);
		expect(ua).not.toHaveBeenCalled();
		expect(ub).toHaveBeenCalledTimes(1);
		q.push(c, uc);
		q.clear();
		q.tick(); q.tick(); q.tick();
		expect(uc).not.toHaveBeenCalled();
	});

	test('单张上传抛错不卡住队列', ()=>{
		const q = new LabelUploadQueue(()=>0);
		q.tick();
		const ok = jest.fn();
		q.push({}, ()=>{ throw new Error('lost context'); });
		q.push({}, ok);
		expect(q.flush(true)).toBe(2);
		expect(ok).toHaveBeenCalledTimes(1);
	});
});

describe('渲染端接线', ()=>{
	const src = SRC;

	test('名牌画完交队列,渲染循环每帧在画之前取', ()=>{
		// 建队列的那个文件(门面拆成子模块后逐个文件问)从 ./labelUploadQueue 导入它
		const fs = require('fs');
		const users = sourceSetFiles(path.resolve(__dirname, '..', 'PlanetariumBabylon.js')).filter((f)=>fs.readFileSync(f, 'utf8').indexOf('new LabelUploadQueue(') >= 0);
		expect(users.length).toBe(1);
		expect(fileImportsName(users[0], { name: 'LabelUploadQueue', target: path.resolve(__dirname, '..', 'babylon', 'labelUploadQueue.js') })).toBe(true);
		expect(src).toMatch(/this\._labelUploads = new LabelUploadQueue\(\);/);
		expect(src).toMatch(/this\._labelUploads\.tick\(\);\s*\n\s*this\.scene\.render\(\);/);
		// 名牌里不再有「画完无条件当场上传」
		const body = fnBody(src, 'createTextPlane(text, size, color, bg)');
		expect(body).toBeTruthy();
		expect(body).toMatch(/if\(rebound \|\| !uploads\.push\(painted, \(\)=>painted\.update\(true\)\)\)\{ painted\.update\(true\); \}/);
		expect((body.match(/\.update\(true\)/g) || []).length).toBe(2);
		// 纹理释放时从队列摘掉;渲染端销毁时清空
		expect(body).toMatch(/uploads\.drop\(mine\)/);
		expect(src).toMatch(/this\._labelUploads\.clear\(\);/);
	});
});

describe('行星轨迹只补轨迹', ()=>{
	let PlanetariumRenderer;
	beforeAll(()=>{
		jest.resetModules();
		window.BABYLON = new Proxy({}, {
			get(target, key){
				if(!(key in target)){ target[key] = function Stub(){}; }
				return target[key];
			},
		});
		// eslint-disable-next-line global-require
		PlanetariumRenderer = require('../babylon/PlanetariumRenderer').PlanetariumRenderer;
	});
	afterAll(()=>{
		delete window.BABYLON;
		jest.resetModules();
	});

	function bare(){
		const r = Object.create(PlanetariumRenderer.prototype);
		r.scene = {};
		r.layers = { planetTrails: true };
		r.applyLayerVisibility = jest.fn();
		r.updateData = jest.fn();
		return r;
	}

	test('场景还没有数据:返回 -1,交回整场重建', ()=>{
		const r = bare();
		r.lastData = null;
		r.createPlanetTrails = jest.fn();
		expect(r.applyPlanetTrails({ trails: [] })).toBe(-1);
		expect(r.createPlanetTrails).not.toHaveBeenCalled();
		r.lastData = { observer: {} };
		expect(r.applyPlanetTrails({})).toBe(-1);
		expect(r.applyPlanetTrails(null)).toBe(-1);
	});

	test('只拆旧轨迹组、只建轨迹;别的组、别的投影线、日月行星数据都不动', ()=>{
		const r = bare();
		const oldTrails = { name: 'asterism-trails-layer', dispose: jest.fn() };
		const stars = { name: 'star-layer', dispose: jest.fn() };
		const xingguan = { name: 'asterism-xingguan-layer', dispose: jest.fn() };
		r.groups = [stars, oldTrails, xingguan];
		const keepLine = { mesh: { parent: stars } };
		r.projectableLines = [keepLine, { mesh: { parent: oldTrails } }, { mesh: { parent: oldTrails } }];
		const bodies = [{ id: 'Sun' }];
		const observer = { lat: 30, lon: 120, jd: 2460000 };
		r.lastData = { observer, bodies, stars: [1, 2, 3] };
		r._calibJd = 2460001.5;
		r.createPlanetTrails = jest.fn();
		const trails = [{ id: 'Mars', points: [] }];
		const ms = r.applyPlanetTrails({ observer: { lat: 30, lon: 120, jd: 2460000 }, trails, bodies: [{ id: 'stale' }] });
		expect(ms).toBeGreaterThanOrEqual(0);
		expect(oldTrails.dispose).toHaveBeenCalledWith(false, true);
		expect(stars.dispose).not.toHaveBeenCalled();
		expect(xingguan.dispose).not.toHaveBeenCalled();
		expect(r.groups).toEqual([stars, xingguan]);
		expect(r.projectableLines).toEqual([keepLine]);
		expect(r.lastData.trails).toBe(trails);
		expect(r.lastData.bodies).toBe(bodies);          // 不换成回包里的日月行星
		expect(r.lastData.stars).toEqual([1, 2, 3]);
		expect(r._calibJd).toBe(2460001.5);              // 播放校准不动
		expect(r.createPlanetTrails).toHaveBeenCalledTimes(1);
		expect(r.createPlanetTrails.mock.calls[0][0].trails).toBe(trails);
		expect(r.applyLayerVisibility).toHaveBeenCalledTimes(1);
		expect(r.updateData).not.toHaveBeenCalled();
	});

	test('宿主:只有行星轨迹那次重取走快路径,补不了才整场重建', ()=>{
		const host = SRC;
		expect(host).toMatch(/reason: opts\.reason,/);
		const fin = fnBody(host, 'finishStateData(payload)');
		expect(fin).toBeTruthy();
		expect(fin).toMatch(/reason === 'planet-trails' && this\.renderer && this\.state\.data && Array\.isArray\(data\.trails\)/);
		expect(fin).toMatch(/const ms = this\.renderer\.applyPlanetTrails\(data\);\s*\n\s*if\(ms >= 0\)\{/);
		expect(fin).toMatch(/data = \{ \.\.\.this\.state\.data, trails: data\.trails \};/);
		// 走不了快路径(只补轨迹 / 只换星表)→ 整场重建,并记下这份数据的请求指纹
		expect(fin).toMatch(/if\(trailsOnly \|\| starsOnly\)\{[^}]*\}else if\(this\.renderer\)\{\s*\n\s*this\._sceneDataSig = sig \|\| null;[^\n]*\n\s*renderMs = this\.renderer\.updateData\(data, this\.state\.layers\)/);
		// 发起点带着原因
		expect(host).toMatch(/requestState\(\{ requestKind: 'full', reason: 'planet-trails'/);
	});
});
