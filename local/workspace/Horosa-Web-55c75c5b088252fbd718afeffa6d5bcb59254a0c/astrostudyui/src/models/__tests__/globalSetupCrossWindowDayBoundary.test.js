// 别的窗口改了「日界 / 晚子时」:本窗口跟随时与本窗口自己改设置走同一通道 ——
// 设置菜单显示的口径、astro 共享口径(fields.after23NewDay / lateZiHourUseNextDay)、当前盘重算三者一致。
// 用真 dva 运行时挂 app 的跟随订阅 + astro 的两条事件订阅(fetchByFields 换成计数桩),从 storage 事件起跑整条链。
import fs from 'fs';
import path from 'path';
import { create } from 'dva-core';
import appModel from '../app';
import astroModel from '../astro';
import { thawGlobalSetupWrites, __resetGlobalSetupMirrorForTest } from '../../utils/globalSetupStore';
import {
	GLOBAL_SETUP_CHANNELS, announceGlobalSetupChanges, DAY_BOUNDARY_CHANGED_EVENT, LATE_ZI_HOUR_MODE_CHANGED_EVENT,
} from '../../utils/dayBoundary';
import { GLOBAL_SETUP_FIELDS } from '../../utils/globalSetupStore';

const KEY = 'globalSetup';
const SRC = path.resolve(__dirname, '../..');
const v = (x)=>({ value: x });

let app;
let recalc;
function boot({ pinned = false } = {}){
	recalc = 0;
	app = create();
	app.model({
		namespace: 'app',
		state: { ...appModel.state, dayBoundary: 'after23', lateZiHourMode: 'nextDay' },
		reducers: appModel.reducers,
		effects: { syncGlobalSetupFromStorage: appModel.effects.syncGlobalSetupFromStorage },
		subscriptions: { followGlobalSetupStorage: appModel.subscriptions.followGlobalSetupStorage },
	});
	app.model({
		namespace: 'astro',
		state: { _dayBoundaryRecordPinned: pinned, fields: { after23NewDay: v(1), lateZiHourUseNextDay: v(1), name: v('甲') } },
		reducers: {
			syncAfter23NewDay: astroModel.reducers.syncAfter23NewDay,
			syncLateZiHourMode: astroModel.reducers.syncLateZiHourMode,
		},
		effects: {
			syncAndRecalcFromDayBoundary: astroModel.effects.syncAndRecalcFromDayBoundary,
			*fetchByFields(){ recalc += 1; },
		},
		subscriptions: astroModel.subscriptions,
	});
	app.start();
	return app._store;
}
// 别的窗口写了全局设置:本机存储变 + 本窗口收到 storage 事件
function otherWindowWrites(obj){
	window.localStorage.setItem(KEY, JSON.stringify(obj));
	window.dispatchEvent(new window.StorageEvent('storage', { key: KEY }));
}
const flush = ()=>new Promise((r)=>setTimeout(r, 0));

afterEach(()=>{
	if(app){ app.unmodel('astro'); app.unmodel('app'); app = null; }
});
beforeEach(()=>{
	window.localStorage.clear();
	window.localStorage.setItem(KEY, JSON.stringify({ dayBoundary: 'after23', lateZiHourMode: 'nextDay' }));
	thawGlobalSetupWrites();
	__resetGlobalSetupMirrorForTest();
});

describe('跨窗口跟随 × 日界 / 晚子时同步通道', ()=>{
	it('🔴 别的窗口改成 24 点换日:菜单值、共享口径、当前盘重算一起跟上;不回写存储', async ()=>{
		const store = boot();
		const seen = [];
		const onEv = (e)=>seen.push(e.detail);
		window.addEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
		try{
			otherWindowWrites({ dayBoundary: 'after24', lateZiHourMode: 'nextDay' });
			await flush();
		}finally{
			window.removeEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
		}
		const st = store.getState();
		expect(st.app.dayBoundary).toBe('after24');
		expect(st.astro.fields.after23NewDay.value).toBe(0);
		expect(recalc).toBe(1);
		expect(seen).toEqual([{ dayBoundary: 'after24', after23NewDay: 0 }]);
		expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ dayBoundary: 'after24', lateZiHourMode: 'nextDay' });
	});

	it('🔴 晚子时同理:lateZiHourUseNextDay 跟到 0 并重算一次', async ()=>{
		const store = boot();
		otherWindowWrites({ dayBoundary: 'after23', lateZiHourMode: 'today' });
		await flush();
		const st = store.getState();
		expect(st.app.lateZiHourMode).toBe('today');
		expect(st.astro.fields.lateZiHourUseNextDay.value).toBe(0);
		expect(st.astro.fields.after23NewDay.value).toBe(1);
		expect(recalc).toBe(1);
	});

	it('载入的命盘自带口径(钉住)时共享口径不被跟随改动;菜单照样显示新值', async ()=>{
		const store = boot({ pinned: true });
		otherWindowWrites({ dayBoundary: 'after24', lateZiHourMode: 'nextDay' });
		await flush();
		const st = store.getState();
		expect(st.app.dayBoundary).toBe('after24');
		expect(st.astro.fields.after23NewDay.value).toBe(1);
	});

	it('与日界无关的全局字段变了:不派发日界 / 晚子时事件、不重算', async ()=>{
		const store = boot();
		let n = 0;
		const onEv = ()=>{ n += 1; };
		window.addEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
		window.addEventListener(LATE_ZI_HOUR_MODE_CHANGED_EVENT, onEv);
		try{
			otherWindowWrites({ dayBoundary: 'after23', lateZiHourMode: 'nextDay', showAstroMeaning: 1 });
			await flush();
		}finally{
			window.removeEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
			window.removeEventListener(LATE_ZI_HOUR_MODE_CHANGED_EVENT, onEv);
		}
		expect(store.getState().app.showAstroMeaning).toBe(1);
		expect(n).toBe(0);
		expect(recalc).toBe(0);
	});
});

describe('通道单源合同', ()=>{
	function walk(dir, out){
		fs.readdirSync(dir).forEach((f)=>{
			const p = path.join(dir, f);
			if(fs.statSync(p).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules' && !f.startsWith('.umi')){ walk(p, out); } }
			else if(/\.(js|jsx)$/.test(f) && !/\.test\./.test(f)){ out.push(p); }
		});
		return out;
	}
	const FILES = walk(SRC, []).map((p)=>({ rel: path.relative(SRC, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }));
	const EVENT_LITERAL = /['"`]horosa:(?:day-boundary-changed|late-zi-hour-mode-changed)['"`]/;

	it('🔴 两条事件只在单源里派发(别处手写 CustomEvent 即红;监听照常用字面量)', ()=>{
		const bad = [];
		FILES.forEach(({ rel, text })=>{
			if(rel === 'utils/dayBoundary.js'){ return; }
			text.split('\n').forEach((line, i)=>{
				if(EVENT_LITERAL.test(line) && /new\s+CustomEvent|dispatchEvent/.test(line)){ bad.push(`${rel}:${i + 1}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	it('🔴 跟随入口在应用之后经同一通道派发(syncGlobalSetupFromStorage 体内调 announceGlobalSetupChanges)', ()=>{
		const text = FILES.find((f)=>f.rel === 'models/app.js').text;
		const start = text.indexOf('*syncGlobalSetupFromStorage(');
		expect(start).toBeGreaterThan(0);
		const body = text.slice(start, text.indexOf('\n        },', start));
		const saveAt = body.indexOf("type: 'save'");
		const annAt = body.indexOf('announceGlobalSetupChanges(diff)');
		expect(saveAt).toBeGreaterThan(0);
		expect(annAt).toBeGreaterThan(saveAt);
	});

	it('通道登记表的键都是落盘的全局设置字段', ()=>{
		Object.keys(GLOBAL_SETUP_CHANNELS).forEach((k)=>expect(GLOBAL_SETUP_FIELDS).toContain(k));
	});

	it('判别力:登记表外的字段不派发;未定义值不派发', ()=>{
		let n = 0;
		const onEv = ()=>{ n += 1; };
		window.addEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
		try{
			announceGlobalSetupChanges({ showAstroMeaning: 1, dayBoundary: undefined });
			expect(n).toBe(0);
			announceGlobalSetupChanges({ dayBoundary: 'after24' });
			expect(n).toBe(1);
		}finally{
			window.removeEventListener(DAY_BOUNDARY_CHANGED_EVENT, onEv);
		}
	});

	it('判别力:合同正则认得手写派发', ()=>{
		const line = "window.dispatchEvent(new CustomEvent('horosa:day-boundary-changed', { detail }));";
		expect(EVENT_LITERAL.test(line) && /new\s+CustomEvent|dispatchEvent/.test(line)).toBe(true);
		const listen = "window.addEventListener('horosa:day-boundary-changed', handler);";
		expect(EVENT_LITERAL.test(listen) && /new\s+CustomEvent|dispatchEvent/.test(listen)).toBe(false);
	});
});
