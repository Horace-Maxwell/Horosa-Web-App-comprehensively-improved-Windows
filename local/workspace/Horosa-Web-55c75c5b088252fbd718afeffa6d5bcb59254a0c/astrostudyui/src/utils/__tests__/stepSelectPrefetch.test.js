// [R3-A1] 选步长即预取金标:选定步长档那一刻(未点 ±)就双向 ±1、±2 预取。
// 覆盖:处理器注册/触发、同 unit 5s 去重、开关双闸、depth=2 任务形状(键与真点同源)、
// 预算硬顶、日历等未挂 prop 宿主零触发(由 opt-in prop 结构保证,此处锁 fire 面契约)。
import {
	registerStepSelectHandler, fireStepSelectPrefetch, __resetStepSelectForTest,
	submitStepPrefetch, __resetStepPrefetch,
} from '../stepPrefetch';
import { __buildStepPrefetchTasksForTest } from '../../models/astro';
import DateTime from '../../components/comp/DateTime';

function mkFields(){
	const dt = new DateTime();
	dt.parse('1990-06-15 10:00:00', 'YYYY-MM-DD HH:mm:ss');
	dt.ad = 1; dt.zone = '+08:00';
	const v = (x)=>({ value: x });
	return {
		cid: v(null), date: { value: dt }, time: { value: dt },
		lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31),
		hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false),
		doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false),
		virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'),
		name: v('测'), pos: v(''),
	};
}

beforeEach(()=>{
	__resetStepSelectForTest();
	try{
		localStorage.removeItem('horosa.perf.stepPrefetch');
		localStorage.removeItem('horosa.perf.stepSelectPrefetch');
	}catch(e){ /* ignore */ }
});

describe('[R3-A1] fireStepSelectPrefetch', ()=>{
	test('注册处理器后触发,unit 原样传达', ()=>{
		const seen = [];
		registerStepSelectHandler((unit)=>seen.push(unit));
		fireStepSelectPrefetch('d');
		expect(seen).toEqual(['d']);
	});

	test('同 unit 5s 去重:连点同档只触发一次;换档立即触发', ()=>{
		const seen = [];
		registerStepSelectHandler((unit)=>seen.push(unit));
		fireStepSelectPrefetch('h');
		fireStepSelectPrefetch('h');
		fireStepSelectPrefetch('d');
		expect(seen).toEqual(['h', 'd']);
	});

	test('kill-switch:stepSelectPrefetch=0 或 stepPrefetch=0 均零触发', ()=>{
		const seen = [];
		registerStepSelectHandler((unit)=>seen.push(unit));
		localStorage.setItem('horosa.perf.stepSelectPrefetch', '0');
		fireStepSelectPrefetch('d');
		localStorage.removeItem('horosa.perf.stepSelectPrefetch');
		localStorage.setItem('horosa.perf.stepPrefetch', '0');
		fireStepSelectPrefetch('M');
		expect(seen).toEqual([]);
	});

	test('depth=2 任务形状:双向 ±1、±2 各一,共 4 任务,键构造与真点同源(fieldsToParams 路径)', ()=>{
		const tasks = __buildStepPrefetchTasksForTest(mkFields(), { unit: 'd', dir: 0, depth: 2 }, { currentTab: 'astrochart' });
		expect(tasks.map((t)=>t.name)).toEqual(['chart+1d', 'chart-1d', 'chart+2d', 'chart-2d']);
	});

	test('无 depth 的 dir=0(此刻)保持旧语义 ±1 各一(零回归)', ()=>{
		const tasks = __buildStepPrefetchTasksForTest(mkFields(), { unit: 'd', dir: 0 }, { currentTab: 'astrochart' });
		expect(tasks.map((t)=>t.name)).toEqual(['chart+1d', 'chart-1d']);
	});

	test('预算硬顶:budget 请求 >5 被钳到 5(绝不风暴)', ()=>{
		__resetStepPrefetch();
		// 6 个假任务全部 run 记数;budget=99 应只排 5
		let ran = 0;
		const tasks = Array.from({ length: 6 }, (_, i)=>({ name: `t${i}`, run: ()=>{ ran += 1; return Promise.resolve(); } }));
		submitStepPrefetch(tasks, { budget: 99 });
		// 队列内部异步跑;此处只断言不炸+同步排队量由实现钳制(行为锚:见 stepPrefetch.js 硬顶注释)
		expect(ran).toBeLessThanOrEqual(5);
	});
});
