// 全局设置的读与写同一单源(内存镜像):
//   ① 全量恢复冻结期间,界面上改的日界 / 晚子时 / 择日快照行数本次运行照样生效 —— 全站读日界的地方跟界面一致(此前冻结只拦写、
//      不管读:界面显示新值,八字 / 紫微 / 六壬 / 择日仍按存储里的旧值起盘);恢复直写进存储的值重启后才生效,本次运行读到的仍与界面一致;
//   ② 没冻结:别的窗口 / 外部直写了存储,读处跟着变;storage 事件让本窗口界面跟随(只应用、不回写);
//   ③ 源码合同:直读 globalSetup 存储只许在单源与启动读入两处;
//   ④ 同类整包回写的全局仓(古典参数 / 卜卦判读):写以存储现值为底,外部刚写的其它键 1 秒内再改一项也不被缓存整包盖掉。
import fs from 'fs';
import path from 'path';
import appModel, { globalSetupStorageSyncPayload } from '../../models/app';
import {
	freezeGlobalSetupWrites, thawGlobalSetupWrites, currentGlobalSetup, readGlobalSetupField, subscribeGlobalSetupStorage, __resetGlobalSetupMirrorForTest,
} from '../globalSetupStore';
import { defaultAfter23NewDay, readGlobalDayBoundary, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { readGlobalZeriSnapshotMaxRows } from '../zeriSnapshotPrefs';
import { setClassicalChartGlobal, getClassicalChartGlobals, CLASSICAL_GLOBALS_STORAGE_KEY, __resetClassicalGlobalsCacheForTest } from '../classicalChartGlobals';
import { setDivinationJudgeGlobal, getDivinationJudgeGlobals, DIVINATION_JUDGE_STORAGE_KEY, __resetDivinationJudgeCacheForTest } from '../divinationJudgeGlobals';

const KEY = 'globalSetup';
const SRC = path.resolve(__dirname, '../..');
const save = (state, payload)=>appModel.reducers.save(state, { payload });

beforeEach(()=>{
	window.localStorage.clear();
	thawGlobalSetupWrites();
	__resetGlobalSetupMirrorForTest();
});
afterAll(()=>thawGlobalSetupWrites());

describe('① 冻结期间读与界面一致', ()=>{
	it('🔴 冻结后界面改日界 / 晚子时 / 快照行数:全站读处跟随,存储不写', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23', lateZiHourMode: 'nextDay', zeriSnapshotMaxRows: 60 }));
		expect(defaultAfter23NewDay()).toBe(1);
		freezeGlobalSetupWrites('unified-restore');
		const st = save({ ...appModel.state, dayBoundary: 'after23' }, { dayBoundary: 'after24', lateZiHourMode: 'today', zeriSnapshotMaxRows: 30 });
		expect(st.dayBoundary).toBe('after24');
		expect(readGlobalDayBoundary()).toBe('after24');
		expect(defaultAfter23NewDay()).toBe(0);
		expect(defaultLateZiHourUseNextDay()).toBe(0);
		expect(readGlobalZeriSnapshotMaxRows()).toBe(30);
		expect(JSON.parse(window.localStorage.getItem(KEY)).dayBoundary).toBe('after23');
	});

	it('冻结期间恢复直写进存储的值:本次运行读到的仍是界面上的那份(重启后才生效)', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23' }));
		readGlobalDayBoundary();
		freezeGlobalSetupWrites('unified-restore');
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after24' }));   // 恢复的 raw 直写
		expect(readGlobalDayBoundary()).toBe('after23');
		thawGlobalSetupWrites();
		expect(readGlobalDayBoundary()).toBe('after24');   // 解冻(恢复失败回退等)后跟回存储
	});
});

describe('② 没冻结:跟随存储与别的窗口', ()=>{
	it('外部直写 / 别的窗口写了存储,读处跟着变;同串不重复解析(返回同一对象)', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23' }));
		const a = currentGlobalSetup();
		expect(currentGlobalSetup()).toBe(a);
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after24', showAstroMeaning: 1 }));
		expect(readGlobalDayBoundary()).toBe('after24');
		expect(readGlobalSetupField('showAstroMeaning')).toBe(1);
		window.localStorage.removeItem(KEY);
		expect(readGlobalDayBoundary()).toBe('after23');
	});

	it('写不进(存储不可用)时镜像仍是界面上的新值,不被旧串冲回', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23' }));
		const spy = jest.spyOn(Object.getPrototypeOf(window.localStorage), 'setItem').mockImplementation(()=>{ throw new Error('denied'); });
		try{
			save({ ...appModel.state }, { dayBoundary: 'after24' });
		}finally{
			spy.mockRestore();
		}
		expect(JSON.parse(window.localStorage.getItem(KEY)).dayBoundary).toBe('after23');
		expect(readGlobalDayBoundary()).toBe('after24');
	});

	it('storage 事件:key 为 globalSetup 或 null 时回调;冻结期间不跟;别的键不理', ()=>{
		const got = [];
		const off = subscribeGlobalSetupStorage((g)=>got.push(g.dayBoundary));
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after24' }));
		window.dispatchEvent(new window.StorageEvent('storage', { key: KEY }));
		window.dispatchEvent(new window.StorageEvent('storage', { key: 'other' }));
		freezeGlobalSetupWrites('x');
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23' }));
		window.dispatchEvent(new window.StorageEvent('storage', { key: null }));
		thawGlobalSetupWrites();
		window.dispatchEvent(new window.StorageEvent('storage', { key: null }));
		off();
		expect(got).toEqual(['after24', 'after23']);
	});

	it('界面跟随:只挑与本窗口不同的设置字段;save 带跟随标记时不回写存储', ()=>{
		const st = { ...appModel.state, dayBoundary: 'after23', appearanceMode: 'light' };
		expect(globalSetupStorageSyncPayload(st, { dayBoundary: 'after23', appearanceMode: 'light' })).toBe(null);
		const diff = globalSetupStorageSyncPayload(st, { dayBoundary: 'after24', appearanceMode: 'light' });
		expect(diff).toEqual({ dayBoundary: 'after24' });
		window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23', extra: 1 }));
		const before = window.localStorage.getItem(KEY);
		const next = save(st, { ...diff, __globalSetupFromStorage: true });
		expect(next.dayBoundary).toBe('after24');
		expect(next.__globalSetupFromStorage).toBeUndefined();
		expect(window.localStorage.getItem(KEY)).toBe(before);
	});
});

describe('③ 源码合同', ()=>{
	const ALLOWED = {
		'utils/globalSetupStore.js': '单源本身',
		'models/app.js': '启动读入(checkUser / checkOnlyUser)',
		'utils/newChartSeeds.js': '旧版同义存储一次性并入:读的是盘上的那份(恢复后再并入一次要读恢复回来的值)',
	};
	const PATS = [
		/getItem\(\s*(?:Constants\.GlobalSetupKey|'globalSetup'|"globalSetup"|GLOBAL_SETUP_(?:STORAGE_)?KEY)\s*\)/,
		/(?:safeLocalStorageGet|safeJsonParseFromStorage)\(\s*(?:Constants\.GlobalSetupKey|'globalSetup'|"globalSetup"|GLOBAL_SETUP_(?:STORAGE_)?KEY)\b/,
	];
	function walk(dir, out){
		fs.readdirSync(dir).forEach((f)=>{
			const p = path.join(dir, f);
			if(fs.statSync(p).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules' && !f.startsWith('.umi')){ walk(p, out); } }
			else if(/\.(js|jsx)$/.test(f) && !/\.test\./.test(f)){ out.push(p); }
		});
		return out;
	}
	it('🔴 直读 globalSetup 存储只在单源 / 启动读入 / 旧值并入三处;其余一律读镜像', ()=>{
		const bad = [];
		walk(SRC, []).forEach((p)=>{
			const rel = path.relative(SRC, p).split(path.sep).join('/');
			if(ALLOWED[rel]){ return; }
			fs.readFileSync(p, 'utf8').split('\n').forEach((line, i)=>{
				if(PATS.some((re)=>re.test(line))){ bad.push(`${rel}:${i + 1}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	it('判别力:直读写法被识别', ()=>{
		expect(PATS.some((re)=>re.test("const raw = localStorage.getItem('globalSetup');"))).toBe(true);
		expect(PATS.some((re)=>re.test('JSON.parse(window.localStorage.getItem(Constants.GlobalSetupKey) || "{}")'))).toBe(true);
		expect(PATS.some((re)=>re.test("readGlobalSetupField('dayBoundary')"))).toBe(false);
	});
});

describe('④ 同类整包回写的全局仓:写以存储现值为底', ()=>{
	it('🔴 古典参数:外部刚写了另一项,1 秒内再改一项不被缓存盖掉', ()=>{
		__resetClassicalGlobalsCacheForTest();
		getClassicalChartGlobals();   // 热缓存
		getClassicalChartGlobals();   // 第二次读起节流窗(刚比对过原串)
		const keys = Object.keys(getClassicalChartGlobals());
		const [k1, k2] = keys.filter((k)=>typeof getClassicalChartGlobals()[k] === 'string').slice(0, 2);
		const ext = { ...getClassicalChartGlobals(), [k1]: '__external__' };
		window.localStorage.setItem(CLASSICAL_GLOBALS_STORAGE_KEY, JSON.stringify(ext));
		setClassicalChartGlobal(k2, '__mine__');
		const stored = JSON.parse(window.localStorage.getItem(CLASSICAL_GLOBALS_STORAGE_KEY));
		expect(stored[k1]).toBe('__external__');
		expect(stored[k2]).toBe('__mine__');
	});
	it('🔴 卜卦判读:同上', ()=>{
		__resetDivinationJudgeCacheForTest();
		getDivinationJudgeGlobals();
		getDivinationJudgeGlobals();   // 第二次读起节流窗(刚比对过原串)
		window.localStorage.setItem(DIVINATION_JUDGE_STORAGE_KEY, JSON.stringify({ combustMitigateSameSign: true, antiscia: true }));
		setDivinationJudgeGlobal('antiscia', false);
		const stored = JSON.parse(window.localStorage.getItem(DIVINATION_JUDGE_STORAGE_KEY));
		expect(stored.combustMitigateSameSign).toBe(true);
		expect(stored.antiscia).toBe(false);
	});
});
