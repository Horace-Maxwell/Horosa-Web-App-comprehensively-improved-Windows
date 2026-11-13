// 天文馆星官层:分片懒建(不一口气占住主线程)+ 开着时跨全量刷新保留(不每来一份数据就拆掉重建)。
// 渲染器模块加载时要用引擎全局量建常量表(颜色等):测试里给一个「取什么都是空构造器」的替身,只测建造调度与清场逻辑。
let proto = null;
beforeAll(()=>{
	jest.resetModules();
	window.BABYLON = new Proxy({}, {
		get(target, key){
			if(!(key in target)){ target[key] = function Stub(){}; }
			return target[key];
		},
	});
	// eslint-disable-next-line global-require
	proto = require('../babylon/PlanetariumRenderer').PlanetariumRenderer.prototype;
});
afterAll(()=>{
	delete window.BABYLON;
	jest.resetModules();
});

function makeGroup(name){
	return {
		name,
		enabled: true,
		disposed: false,
		setEnabled(v){ this.enabled = !!v; },
		dispose(){ this.disposed = true; },
	};
}

// 只挂被测方法要用到的东西;建造本身用桩(每个星官计一次数)。
function fakeRenderer({ total = 40, costMs = 2 } = {}){
	const clock = { t: 1000 };
	const r = {
		disposed: false,
		scene: {},
		layers: { xingguan: true },
		groups: [],
		projectableMeshes: [],
		projectableLines: [],
		pickMeshes: [],
		bodyMeshes: {},
		followMeshes: [],
		lastData: { observer: {} },
		_asterismsBuilt: false,
		_asterismBuildToken: 0,
		_asterismBuildJob: null,
		built: 0,
		visibilityCalls: 0,
		reprojectCalls: 0,
		clock,
	};
	r.beginChineseAsterisms = ()=>{
		const group = makeGroup('asterism-xingguan-layer');
		r.groups.push(group);
		return { group, index: 0 };
	};
	r.buildChineseAsterismAt = (job)=>{
		job.index += 1;
		r.built += 1;
		clock.t += costMs;
		const mesh = { name: `asterism-xingguan-${job.index}`, parent: job.group };
		r.projectableMeshes.push({ mesh });
		r.projectableLines.push({ mesh });
		return job.index < total;
	};
	r.applyLayerVisibility = ()=>{
		r.visibilityCalls += 1;
		r.groups.forEach((g)=>{
			if(g.name.indexOf('asterism-xingguan-layer') === 0){ g.setEnabled(!!r.layers.xingguan && !r._asterismBuildJob); }
		});
	};
	r.reprojectStarsToDisplayTime = ()=>{ r.reprojectCalls += 1; };
	['ensureChineseAsterismsBuilt', 'cancelChineseAsterismBuild', 'clearDynamicData', 'clearData', 'detachSurfaceTextures'].forEach((k)=>{
		r[k] = proto[k].bind(r);
	});
	return r;
}

describe('天文馆星官层分片懒建', ()=>{
	let rafQueue;
	let realRaf;
	let realPerfNow;
	let active;

	beforeEach(()=>{
		rafQueue = [];
		realRaf = global.requestAnimationFrame;
		global.requestAnimationFrame = (fn)=>{ rafQueue.push(fn); return rafQueue.length; };
		realPerfNow = global.performance.now;
		global.performance.now = ()=>(active ? active.clock.t : 0);
	});
	afterEach(()=>{
		global.requestAnimationFrame = realRaf;
		global.performance.now = realPerfNow;
		active = null;
	});
	const flushFrame = ()=>{
		const q = rafQueue;
		rafQueue = [];
		q.forEach((fn)=>fn());
	};

	test('一帧只建几毫秒的量,没建完之前整组不显示', ()=>{
		const r = fakeRenderer({ total: 40, costMs: 2 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		expect(r._asterismsBuilt).toBe(true);
		expect(r.built).toBeGreaterThan(0);
		expect(r.built).toBeLessThan(10);          // 首片就占满了 6ms 预算,没有一口气建完
		expect(r._asterismBuildJob).not.toBeNull();
		expect(r.groups[0].enabled).toBe(false);
		expect(rafQueue.length).toBe(1);
		// 中途有人调显隐(图层开关 / 全量刷新末尾):仍然不露出半成品
		r.applyLayerVisibility();
		expect(r.groups[0].enabled).toBe(false);
	});

	test('建完:露出整组,并按当前显示时刻重投影一次', ()=>{
		const r = fakeRenderer({ total: 40, costMs: 2 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		let guard = 0;
		while(rafQueue.length && guard < 200){ flushFrame(); guard += 1; }
		expect(r.built).toBe(40);
		expect(r._asterismBuildJob).toBeNull();
		expect(r.groups[0].enabled).toBe(true);
		expect(r.reprojectCalls).toBe(1);
		expect(guard).toBeGreaterThan(5);           // 确实分了多帧
		// 再调不重建
		r.ensureChineseAsterismsBuilt();
		expect(r.built).toBe(40);
		expect(r.groups.length).toBe(1);
	});

	test('没有 requestAnimationFrame 的环境同步建完', ()=>{
		const r = fakeRenderer({ total: 12 });
		active = r;
		global.requestAnimationFrame = undefined;
		r.ensureChineseAsterismsBuilt();
		expect(r.built).toBe(12);
		expect(r._asterismBuildJob).toBeNull();
		expect(r.groups[0].enabled).toBe(true);
	});

	test('层开着:全量刷新保留星官组与它的投影项,在建的分片接着建', ()=>{
		const r = fakeRenderer({ total: 40, costMs: 2 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		const group = r.groups[0];
		const other = makeGroup('grid-layer');
		const stars = makeGroup('stars-layer');
		r.groups.push(other, stars);
		r.projectableMeshes.push({ mesh: { name: 'grid-label', parent: other } });
		r.projectableLines.push({ mesh: { name: 'grid-line', parent: other } });
		const builtBefore = r.built;
		r.clearDynamicData(false);
		expect(group.disposed).toBe(false);
		expect(other.disposed).toBe(true);
		expect(r.groups).toEqual([group, stars]);
		expect(r._asterismsBuilt).toBe(true);
		expect(r.projectableMeshes.length).toBe(builtBefore);
		expect(r.projectableLines.length).toBe(builtBefore);
		expect(r.projectableMeshes.every((it)=>it.mesh.parent === group)).toBe(true);
		let guard = 0;
		while(rafQueue.length && guard < 200){ flushFrame(); guard += 1; }
		expect(r.built).toBe(40);
		expect(group.enabled).toBe(true);
	});

	test('保留恒星的那条清场路径同样保留开着的星官组', ()=>{
		const r = fakeRenderer({ total: 6, costMs: 0 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		expect(r._asterismBuildJob).toBeNull();
		const group = r.groups[0];
		const bright = makeGroup('bright-stars-layer');
		const other = makeGroup('constellation-layer');
		r.groups.push(bright, other);
		r.projectableMeshes.push({ mesh: { name: 'bright-star-1', parent: bright } }, { mesh: { name: 'body-label', parent: other } });
		r.clearDynamicData(true);
		expect(group.disposed).toBe(false);
		expect(bright.disposed).toBe(false);
		expect(other.disposed).toBe(true);
		expect(r.projectableMeshes.length).toBe(7);
		expect(r.projectableLines.length).toBe(6);
		expect(r._asterismsBuilt).toBe(true);
	});

	test('层关着:全量刷新照旧拆掉,在途分片作废,下次打开重新建', ()=>{
		const r = fakeRenderer({ total: 40, costMs: 2 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		const group = r.groups[0];
		const builtBefore = r.built;
		r.layers = { xingguan: false };
		r.clearDynamicData(false);
		expect(group.disposed).toBe(true);
		expect(r.groups).toEqual([]);
		expect(r._asterismsBuilt).toBe(false);
		expect(r._asterismBuildJob).toBeNull();
		expect(r.projectableMeshes).toEqual([]);
		expect(r.projectableLines).toEqual([]);
		// 旧的续建回调自己退出,不往已拆掉的组里塞东西
		flushFrame();
		expect(r.built).toBe(builtBefore);
		expect(rafQueue.length).toBe(0);
		expect(r.reprojectCalls).toBe(0);
	});

	test('销毁后续建回调不再动场景', ()=>{
		const r = fakeRenderer({ total: 40, costMs: 2 });
		active = r;
		r.ensureChineseAsterismsBuilt();
		const builtBefore = r.built;
		r.disposed = true;
		flushFrame();
		expect(r.built).toBe(builtBefore);
		expect(rafQueue.length).toBe(0);
	});
});
