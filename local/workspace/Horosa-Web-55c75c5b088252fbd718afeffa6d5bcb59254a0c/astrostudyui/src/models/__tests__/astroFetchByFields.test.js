// fetchByFields 快车道(fields 解耦 + epoch)—— 手摇 generator 金标。
//
// 🔴 病根(真机实测):此前 fields 的 save 排在 /chart 网络之后 → 纯本地技法也被迫
//    等一次网络(热态 229ms 占总延迟 70%);网络失败则 fields 根本不更新。
//    修法=当前 tab 的 hook 自述 chartFree 时,fields 立即提交(+doHook),/chart 回来
//    单独补 chartObj;旧 epoch 响应作废(latest-wins)。
//    本组直接手摇 effect generator —— 验的是【指令序】,与 dva 运行时无涉。
import model from '../astro';

const fetchByFields = model.effects.fetchByFields;

// fieldsToParams 消费的最小真形(date/time 是带 format/ad/zone 的类 moment)
function mkFields(){
	const dt = { ad: 1, zone: '+08:00', format: (f) => (f === 'YYYY/MM/DD' ? '2026/07/15' : '20:00:00'), clone(){ return this; } };
	const v = (x) => ({ value: x });
	return {
		cid: v(null), date: { value: dt }, time: { value: dt },
		lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31),
		hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false),
		doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false),
		virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'),
		name: v('测'), pos: v(''),
	};
}
function mkState({ chartFree } = {}){
	return {
		predictHook: { bazi: { fun: () => {}, ...(chartFree ? { chartFree: true } : {}) } },
		currentTab: 'bazi',
		currentSubTab: null,
		chartObj: { chartId: 'OLD', params: {} },
	};
}
const RSP = { Result: { params: {}, chart: { ok: 1 } } };

// 手摇:effect 的 yield 序列。select 喂 state、call 喂响应、put 收集。
// 本仓 redux-saga(dva3 内联版)的 effect 真形(node 实探):
//   select → { '@@redux-saga/IO': true, SELECT: { selector, args } }
//   call   → { '@@redux-saga/IO': true, CALL: { fn, args } }
//   put    → { '@@redux-saga/IO': true, PUT: { action } }
function crank(gen, { state, rsp }){
	const puts = [];
	let step = gen.next();
	while(!step.done){
		const eff = step.value || {};
		if(eff.SELECT){
			step = gen.next(eff.SELECT.selector({ astro: state }, ...(eff.SELECT.args || [])));
		}else if(eff.CALL){
			puts.push({ CALL: true });
			step = gen.next(rsp);
		}else if(eff.PUT){
			puts.push(eff.PUT.action);
			step = gen.next();
		}else{
			step = gen.next();
		}
	}
	return puts;
}
import { select, call, put } from 'redux-saga/effects';
test('自检:redux-saga effect 真形与 crank 假设一致(形变即此处先红,别处才可信)', () => {
	expect(typeof select((s) => s).SELECT.selector).toBe('function');
	expect(call(() => {}).CALL).toBeTruthy();
	expect(put({ type: 'x' }).PUT.action.type).toBe('x');
});

afterEach(() => { window.localStorage.removeItem('horosa.perf.fieldsFastCommit'); });

describe('🔴 快车道:chartFree 页 fields 先行,一次性整体出', () => {
	test('指令序 = save{fields} → doHook(旧chartObj) → CALL → save{chartObj 单独}', () => {
		const gen = fetchByFields({ payload: mkFields() }, { call, put, select });
		const puts = crank(gen, { state: mkState({ chartFree: true }), rsp: RSP });
		const kinds = puts.map((p) => (p.CALL ? 'CALL' : `${p.type}:${Object.keys(p.payload).sort().join(',')}`));
		expect(kinds).toEqual([
			'save:fields',            // ① fields 立即提交 —— 不等网络
			'doHook:chartObj,fields', // ② 本地技法立即重算(chartObj 是旧引用,chartFree 契约=不读它)
			'CALL',                   // ③ /chart 照发
			'save:chartObj',          // ④ 回来只补 chartObj,fields 不重放
		]);
		// doHook 喂的确实是【旧】chartObj(不臆造新的)
		const doHook = puts.find((p) => p.type === 'doHook');
		expect(doHook.payload.chartObj.chartId).toBe('OLD');
	});

	test('🔴 /chart 失败:fields 已前进(用户输入是真值源),chartObj 停旧盘', () => {
		const gen = fetchByFields({ payload: mkFields() }, { call, put, select });
		const puts = crank(gen, { state: mkState({ chartFree: true }), rsp: undefined });   // 失败=undefined(坑49 契约)
		const kinds = puts.map((p) => (p.CALL ? 'CALL' : `${p.type}:${Object.keys(p.payload).sort().join(',')}`));
		// fields 已 save;失败后无 chartObj save
		expect(kinds.slice(0, 2)).toEqual(['save:fields', 'doHook:chartObj,fields']);
		expect(kinds.filter((k) => k === 'save:chartObj')).toEqual([]);
	});
});

describe('非 chartFree 页:逐字节旧序(默认即现状)', () => {
	test('指令序 = CALL → save{chartObj+fields 原子} → doHook', () => {
		const gen = fetchByFields({ payload: mkFields() }, { call, put, select });
		const puts = crank(gen, { state: mkState({}), rsp: RSP });
		const kinds = puts.map((p) => (p.CALL ? 'CALL' : `${p.type}:${Object.keys(p.payload).sort().join(',')}`));
		expect(kinds).toEqual(['CALL', 'save:chartObj,fields', 'doHook:chartObj,fields']);
	});
});

describe('🔴 epoch:快速连拨时旧响应作废(latest-wins)', () => {
	test('旧代响应不 save 不弹错', () => {
		const st = mkState({ chartFree: true });
		// gen1 跑到 CALL 停住
		const gen1 = fetchByFields({ payload: mkFields() }, { call, put, select });
		let s1 = gen1.next();
		while(!s1.done){
			const e = s1.value || {};
			if(e.SELECT){ s1 = gen1.next(e.SELECT.selector({ astro: st })); continue; }
			if(e.CALL){ break; }
			s1 = gen1.next();
		}
		// gen2 整个跑完(epoch 已递增到新代)
		const gen2 = fetchByFields({ payload: mkFields() }, { call, put, select });
		crank(gen2, { state: st, rsp: RSP });
		// 恢复 gen1:喂它响应 —— 应立即 done,零后续 put
		const tail = [];
		let s = gen1.next(RSP);
		while(!s.done){
			if(s.value && s.value.PUT){ tail.push(s.value.PUT.action); }
			s = gen1.next();
		}
		expect(tail).toEqual([]);   // 旧代:不 save chartObj、不弹错
	});
});

describe('kill-switch:关 = 连 epoch 一起回到旧序', () => {
	test('flag=0 时 chartFree 声明被无视,序=旧', () => {
		window.localStorage.setItem('horosa.perf.fieldsFastCommit', '0');
		const gen = fetchByFields({ payload: mkFields() }, { call, put, select });
		const puts = crank(gen, { state: mkState({ chartFree: true }), rsp: RSP });
		const kinds = puts.map((p) => (p.CALL ? 'CALL' : `${p.type}:${Object.keys(p.payload).sort().join(',')}`));
		expect(kinds).toEqual(['CALL', 'save:chartObj,fields', 'doHook:chartObj,fields']);
	});
});
