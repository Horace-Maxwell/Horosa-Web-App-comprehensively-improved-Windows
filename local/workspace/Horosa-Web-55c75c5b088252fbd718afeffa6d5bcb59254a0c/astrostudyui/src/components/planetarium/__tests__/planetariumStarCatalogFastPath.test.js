// 天文馆「后台补全完整星表」的回包只换星表、不整场重建。
// 背景:开场第三份回包(补全恒星)和场景里现有数据是同一片天,原先照样整场重建一遍(约 70ms,播放中就是一顿,
// 高倍速下还把日月行星拉回发请求那一刻再弹回)。只换星表的前提有三条,缺一条都得照旧整场重建:
// ① 这次请求问的那片天 = 场景现有数据那片天(请求指纹);② 时刻相同,或正在播放;③ 渲染端点云已就绪。
// 另有一条不降级:排着的「整场」重取不能被后来的「只补星表」顶掉。
import path from 'path';

const { readSource, fnBody } = require('../../../utils/__tests__/helpers/sourceSet');
const SRC = readSource(path.resolve(__dirname, '..', 'PlanetariumBabylon.js'));

let PlanetariumRenderer;
let sceneRequestSignature;
let isStarOnlyReason;
let buildRequestParams;

beforeAll(()=>{
	jest.resetModules();
	window.BABYLON = new Proxy({}, { get(target, key){ if(!(key in target)){ target[key] = function Stub(){}; } return target[key]; } });
	PlanetariumRenderer = require('../babylon/PlanetariumRenderer').PlanetariumRenderer;
	({ sceneRequestSignature, isStarOnlyReason, buildRequestParams } = require('../babylon/sceneParams')); // 该模块载入时要用全局 BABYLON
});

afterAll(()=>{
	delete window.BABYLON;
	jest.resetModules();
});

const star = (id, mag)=>({ id, name: id, ra: 10, decl: 5, mag });

describe('请求指纹', ()=>{
	const base = { date: '2026-11-11', time: '20:00:00', ad: 1, zone: '+08:00', lat: '31n14', lon: '121e28', starLimit: 800, includeRiseSet: 1 };

	test('星表条数不进指纹:亮集请求与完整星表请求是同一片天', ()=>{
		const a = sceneRequestSignature(base);
		const b = sceneRequestSignature({ ...base, starLimit: 9000 });
		expect(b).toEqual(a);
	});

	test('时刻单列:只差时刻 → scene 相同、time 不同', ()=>{
		const a = sceneRequestSignature(base);
		const b = sceneRequestSignature({ ...base, time: '21:00:00' });
		expect(b.scene).toBe(a.scene);
		expect(b.time).not.toBe(a.time);
	});

	test('观测点 / 时区 / 附带项任何一项不同 → scene 不同', ()=>{
		const a = sceneRequestSignature(base);
		[{ lat: '39n54' }, { lon: '116e23' }, { zone: '+09:00' }, { includeTrails: 1 }, { hsys: 3 }].forEach((delta)=>{
			expect(sceneRequestSignature({ ...base, ...delta }).scene).not.toBe(a.scene);
		});
	});

	test('与键的书写顺序无关', ()=>{
		const flipped = {};
		Object.keys(base).reverse().forEach((key)=>{ flipped[key] = base[key]; });
		expect(sceneRequestSignature(flipped)).toEqual(sceneRequestSignature(base));
	});

	test('真实请求参数:只改 starLimit 指纹不变', ()=>{
		const fields = { lat: { value: '31n14' }, lon: { value: '121e28' }, gpsLat: { value: 31.23 }, gpsLon: { value: 121.47 } };
		const time = { ad: 1, zone: '+08:00', format: (fmt)=>(fmt === 'YYYY/MM/DD' ? '2026/11/11' : '20:00:00') };
		const brightParams = buildRequestParams(fields, time, { starLimit: 800, includeRiseSet: 1 });
		const fullParams = buildRequestParams(fields, time, { starLimit: 9000, includeRiseSet: 1 });
		expect(brightParams.starLimit).toBe(800);
		expect(fullParams.starLimit).toBe(9000);
		const a = sceneRequestSignature(brightParams);
		expect(sceneRequestSignature(fullParams)).toEqual(a);
		expect(a.time).toBe('2026/11/11|20:00:00|1');
		expect(a.scene).toContain('"includeRiseSet":1');
		expect(a.scene).not.toContain('starLimit');
		// 开了行星轨迹层的请求是另一片天(多带一份轨迹)
		expect(sceneRequestSignature(buildRequestParams(fields, time, { starLimit: 9000, includeRiseSet: 1, includeTrails: 1 })).scene).not.toBe(a.scene);
	});

	test('只补星表的请求原因就这两个', ()=>{
		expect(isStarOnlyReason('star-complete')).toBe(true);
		expect(isStarOnlyReason('star-complete-cache')).toBe(true);
		['background-full', 'time-edit', 'step', 'planet-trails', 'initial-light', 'pending', undefined].forEach((reason)=>{
			expect(isStarOnlyReason(reason)).toBe(false);
		});
	});
});

describe('渲染端 applyStarCatalog(行为)', ()=>{
	function host(shown, magLimit){
		const h = Object.create(PlanetariumRenderer.prototype);
		h.scene = {};
		h.disposed = false;
		h.magLimit = magLimit;
		h.lastData = { stars: { catalog: shown, fixed: ['f'] }, planets: ['p'] };
		h.starCatalog = shown;
		h.starFullCatalog = shown;
		h.starPcs = { particles: shown.map(()=>({})) };
		h.starBuildPending = false;
		h._starUnitsCatalog = shown;
		h.updateStars = jest.fn();
		return h;
	}

	test('显示的那批星逐颗相同:点云不动,只换表,单位向量缓存作废', ()=>{
		const bright = [star('a', 1), star('b', 2), star('c', 3.9)];
		const full = [star('a', 1), star('b', 2), star('c', 3.9), star('d', 5), star('e', 6.2)];
		const h = host(bright, 4);
		const pcs = h.starPcs;
		const ms = h.applyStarCatalog({ stars: { catalog: full } });
		expect(ms).toBeGreaterThanOrEqual(0);
		expect(h.updateStars).not.toHaveBeenCalled();
		expect(h.starPcs).toBe(pcs);
		expect(h.starFullCatalog).toBe(full);
		expect(h.starCatalog.map((s)=>s.id)).toEqual(['a', 'b', 'c']);
		expect(h.starCatalog[0]).toBe(full[0]);
		expect(h._starUnitsCatalog).toBeNull();
		expect(h.lastData.stars.catalog).toBe(full);
		expect(h.lastData.stars.fixed).toEqual(['f']);
		expect(h.lastData.planets).toEqual(['p']);
	});

	test('显示的那批星不一样(多了一颗够亮的):只重建恒星', ()=>{
		const bright = [star('a', 1), star('b', 2)];
		const full = [star('a', 1), star('b', 2), star('x', 3.5), star('d', 5)];
		const h = host(bright, 4);
		const ms = h.applyStarCatalog({ stars: { catalog: full } });
		expect(ms).toBeGreaterThanOrEqual(0);
		expect(h.updateStars).toHaveBeenCalledTimes(1);
		expect(h.updateStars).toHaveBeenCalledWith(full);
	});

	test('同数量但换了一颗:不当成相同', ()=>{
		const h = host([star('a', 1), star('b', 2)], 4);
		h.applyStarCatalog({ stars: { catalog: [star('a', 1), star('z', 2), star('d', 5)] } });
		expect(h.updateStars).toHaveBeenCalledTimes(1);
	});

	test('点云还在建 / 场景没就绪 / 回包没带星表:返回 -1,交回整场重建', ()=>{
		const full = [star('a', 1)];
		const pending = host([star('a', 1)], 4);
		pending.starBuildPending = true;
		expect(pending.applyStarCatalog({ stars: { catalog: full } })).toBe(-1);
		const noScene = host([star('a', 1)], 4);
		noScene.scene = null;
		expect(noScene.applyStarCatalog({ stars: { catalog: full } })).toBe(-1);
		const noPcs = host([star('a', 1)], 4);
		noPcs.starPcs = null;
		expect(noPcs.applyStarCatalog({ stars: { catalog: full } })).toBe(-1);
		const noData = host([star('a', 1)], 4);
		noData.lastData = null;
		expect(noData.applyStarCatalog({ stars: { catalog: full } })).toBe(-1);
		const h = host([star('a', 1)], 4);
		expect(h.applyStarCatalog({ stars: {} })).toBe(-1);
		expect(h.applyStarCatalog({ stars: { catalog: [] } })).toBe(-1);
		expect(h.updateStars).not.toHaveBeenCalled();
	});
});

describe('渲染端 unregisterGroupMeshes(行为)', ()=>{
	test('只摘这一组的网格,别组的登记原样', ()=>{
		const h = Object.create(PlanetariumRenderer.prototype);
		const a = { n: 'a' };
		const b = { n: 'b' };
		const other = { n: 'other' };
		h.pickMeshes = [a, other, b];
		h.projectableMeshes = [{ mesh: a }, { mesh: other }];
		h.followMeshes = [{ mesh: b }, { mesh: other }];
		h.bodyMeshes = { Sun: other, Sirius: a };
		const n = h.unregisterGroupMeshes({ getChildMeshes: ()=>[a, b] });
		expect(n).toBe(2);
		expect(h.pickMeshes).toEqual([other]);
		expect(h.projectableMeshes).toEqual([{ mesh: other }]);
		expect(h.followMeshes).toEqual([{ mesh: other }]);
		expect(h.bodyMeshes).toEqual({ Sun: other });
	});

	test('空组 / 没有组:什么都不动', ()=>{
		const h = Object.create(PlanetariumRenderer.prototype);
		const keep = { n: 'keep' };
		h.pickMeshes = [keep];
		expect(h.unregisterGroupMeshes(null)).toBe(0);
		expect(h.unregisterGroupMeshes({ getChildMeshes: ()=>[] })).toBe(0);
		expect(h.pickMeshes).toEqual([keep]);
	});
});

describe('接线(读源码)', ()=>{
	test('重建亮星前先摘旧组的登记', ()=>{
		const body = fnBody(SRC, 'updateBrightStars(stars){');
		const at = body.indexOf('this.unregisterGroupMeshes(oldGroup)');
		expect(at).toBeGreaterThan(-1);
		expect(body.indexOf('oldGroup.dispose(', at)).toBeGreaterThan(at);
	});

	test('保留恒星的清场:亮星光晕的跟随登记留着', ()=>{
		const body = fnBody(SRC, 'clearDynamicData(preserveStars = false){');
		expect(body).toMatch(/this\.followMeshes = \(this\.followMeshes \|\| \[\]\)\.filter\(\(item\)=>isBrightStarMesh\(item && item\.mesh\)\)/);
	});

	test('回包带请求指纹;整场重建时记下场景指纹;缓存场景不认指纹', ()=>{
		expect(fnBody(SRC, 'async requestState(options = {}){')).toMatch(/sig: sceneRequestSignature\(params\)/);
		const finish = fnBody(SRC, 'finishStateData(payload){');
		const record = finish.indexOf('this._sceneDataSig = sig || null');
		expect(record).toBeGreaterThan(-1);
		expect(finish.indexOf('this.renderer.updateData(data, this.state.layers)', record)).toBeGreaterThan(record);
		expect(fnBody(SRC, 'renderCachedState(data){')).toMatch(/this\._sceneDataSig = null/);
	});

	test('只换星表的三条前提都在判定里,且换完走与整场重建同一条重投影', ()=>{
		const finish = fnBody(SRC, 'finishStateData(payload){');
		const at = finish.indexOf('let starsOnly = false');
		const end = finish.indexOf('if(trailsOnly || starsOnly){');
		expect(at).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(at);
		const block = finish.slice(at, end);
		expect(block).toMatch(/isStarOnlyReason\(reason\)/);
		expect(block).toMatch(/sig\.scene === this\._sceneDataSig\.scene/);
		expect(block).toMatch(/sig\.time === this\._sceneDataSig\.time \|\| Number\(this\.state\.speed \|\| 0\) !== 0/);
		expect(block).toMatch(/this\.renderer\.applyStarCatalog\(data\)/);
		expect(block).toMatch(/if\(ms >= 0\)/);
		expect(block).toMatch(/this\.renderer\.updateProjectedTime\(this\.sceneTime\(\), this\.getEffectiveFields\(\)/);
		// 合并后的数据:场景部分留旧,只换星表与星表计数
		expect(block).toMatch(/\.\.\.prevData,/);
		expect(block).toMatch(/catalog: data\.stars\.catalog/);
		expect(block).toMatch(/renderedCatalogCount: nextMeta\.renderedCatalogCount/);
	});

	test('排着的整场重取不被只补星表顶掉(两处排队都守)', ()=>{
		const sched = fnBody(SRC, 'scheduleBackgroundFull(options = {}){');
		expect(sched).toMatch(/const keepQueued = this\.pendingFullRequest && !isStarOnlyReason\(this\.pendingFullRequest\.reason\) && isStarOnlyReason\(options\.reason\)/);
		expect(sched).toMatch(/if\(!keepQueued\)\{/);
		const req = fnBody(SRC, 'async requestState(options = {}){');
		// 只补行星轨迹同律(planetariumPauseCacheQueue.test.js ③)
		expect(req).toMatch(/const narrow = \(r\)=>isStarOnlyReason\(r\) \|\| r === 'planet-trails';/);
		expect(req).toMatch(/if\(queued && !narrow\(queued\.reason\) && narrow\(opts\.reason\)\)\{\s*return;/);
	});
});
