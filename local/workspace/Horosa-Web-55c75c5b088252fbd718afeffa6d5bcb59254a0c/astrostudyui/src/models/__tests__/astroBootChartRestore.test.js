// [R5 S7] 温启直接显示上次的盘 —— 模型层指令序金标(手摇 generator,与 dva 运行时无涉;形变自检见 astroFetchByFields.test)。
//   ① fetchByChartData(bootRestore):用户未动手 + 响应合法 → save 原子含 bootChartRestore:'done';
//   ② 用户已先动手(chartObj 换代)→ 只标 dropped,不落盘、不弹错;
//   ③ 服务异常 → 标 failed;checkUser 已落过 fields 时由恢复方回落 nowChart,否则不重复(checkUser 自己走「此刻」);
//   ④ checkUser 已换 fields(预测设置 / 用户档)→ 用最新 fields 重建,record 键仍覆盖;
//   ⑤ 非 bootRestore 载入指令序不变(CALL → save 原子 → doHook)。
//   ⑥ bootChartOrNow:pending/done → 只落 fields + bootFieldsApplied;null/failed/dropped → nowChart。
import { select, call, put } from 'redux-saga/effects';
import model from '../astro';
import { bootChartOrNow } from '../app';

const fetchByChartData = model.effects.fetchByChartData;

function mkFields(){
	const dt = { ad: 1, zone: '+08:00', format: (f) => (f === 'YYYY/MM/DD' ? '2026/07/15' : '20:00:00'), clone(){ return this; } };
	const v = (x) => ({ value: x });
	return {
		cid: v(null), date: { value: dt }, time: { value: dt },
		lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31),
		hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false),
		doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false),
		virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'),
		name: v('测'), pos: v(''), memoAstro: v(''), memoBaZi: v(''), memoZiWei: v(''), memo74: v(''),
		memoGua: v(''), memoLiuReng: v(''), memoQiMeng: v(''), memoSuZhan: v(''),
	};
}
function mkState(over){
	return {
		predictHook: {}, currentTab: 'astrochart', currentSubTab: null, memoType: 0,
		chartObj: { chartId: 'OLD', params: {} }, fields: mkFields(), bootChartRestore: null, bootFieldsApplied: false,
		...(over || {}),
	};
}
const RECORD = { cid: null, birth: '2026-07-21 08:30:00', ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', name: '测', pos: '福州', hsys: 1, nohook: true };
const RSP = { Result: { params: {}, chart: { ok: 1 } } };

// states:按 SELECT 次序依次喂(最后一个之后一直喂末项)
function crank(gen, { states, rsp }){
	const puts = []; let si = 0;
	let step = gen.next();
	while(!step.done){
		const eff = step.value || {};
		if(eff.SELECT){
			const st = states[Math.min(si, states.length - 1)]; si += 1;
			step = gen.next(eff.SELECT.selector({ astro: st }, ...(eff.SELECT.args || [])));
		}else if(eff.CALL){
			puts.push({ CALL: true, fn: eff.CALL.fn && eff.CALL.fn.name }); step = gen.next(rsp);
		}else if(eff.PUT){
			puts.push(eff.PUT.action); step = gen.next();
		}else{
			step = gen.next();
		}
	}
	return puts;
}
const kindsOf = (puts) => puts.map((p) => (p.CALL ? 'CALL' : `${p.type}`));

describe('fetchByChartData · bootRestore', () => {
	test('① 未动手 + 响应合法 → save 原子含 bootChartRestore:done,fields 按 record 覆盖', () => {
		const st = mkState();
		const puts = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st], rsp: RSP });
		expect(kindsOf(puts)).toEqual(['CALL', 'save']);
		const save = puts[1];
		expect(save.payload.bootChartRestore).toBe('done');
		expect(save.payload.chartObj.chartId).toBeTruthy();
		expect(save.payload.fields.lat.value).toBe('26n04');
		expect(save.payload.fields.pos.value).toBe('福州');
	});
	test('② 用户已先动手(chartObj 换代)→ 只标 dropped', () => {
		const st = mkState();
		const later = { ...st, chartObj: { chartId: 'USER', params: {} } };
		const puts = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st, later], rsp: RSP });
		expect(kindsOf(puts)).toEqual(['CALL', 'save']);
		expect(puts[1].payload).toEqual({ bootChartRestore: 'dropped' });
	});
	test('③ 服务异常 → failed;checkUser 已落 fields 时回落 nowChart,否则不重复', () => {
		const st = mkState();
		const applied = { ...st, bootFieldsApplied: true };
		const p1 = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st, applied], rsp: undefined });
		expect(kindsOf(p1)).toEqual(['CALL', 'save', 'nowChart']);
		expect(p1[1].payload).toEqual({ bootChartRestore: 'failed' });
		expect(p1[2].payload.fields).toBe(applied.fields);
		const p2 = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st], rsp: undefined });
		expect(kindsOf(p2)).toEqual(['CALL', 'save']);
		expect(p2[1].payload).toEqual({ bootChartRestore: 'failed' });
	});
	test('④ checkUser 已换 fields → 用最新 fields 重建,record 键仍覆盖;影响请求参数的选项变了 → 按新参数重取一次', () => {
		const st = mkState();
		const newer = { ...st, fields: { ...mkFields(), predictive: { value: false }, hsys: { value: 7 } } };
		const puts = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st, newer], rsp: RSP });
		expect(kindsOf(puts)).toEqual(['CALL', 'CALL', 'save']);   // predictive 进 /chart 参数:盘按最终选项重算
		const save = puts[2];
		expect(save.payload.bootChartRestore).toBe('done');
		expect(save.payload.fields.predictive.value).toBe(false);   // checkUser 的补充保留
		expect(save.payload.fields.hsys.value).toBe(1);             // record 键覆盖(盘与选项一致)
	});
	test('④b checkUser 换了 fields 对象但请求参数不变 → 不重取', () => {
		const st = mkState();
		const newer = { ...st, fields: mkFields() };
		const puts = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st, newer], rsp: RSP });
		expect(kindsOf(puts)).toEqual(['CALL', 'save']);
		expect(puts[1].payload.bootChartRestore).toBe('done');
	});
	test('④c 重取期间用户先动手 → dropped;重取失败 → failed(checkUser 已落 fields 时回落「此刻」)', () => {
		const st = mkState();
		const newer = { ...st, fields: { ...mkFields(), predictive: { value: false } }, bootFieldsApplied: true };
		const acted = { ...newer, chartObj: { chartId: 'USER', params: {} } };
		// SELECT 次序:入口 state → 预测主限开关 → 首取后 now → 重取后 again
		const p1 = crank(fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select }), { states: [st, st, newer, acted], rsp: RSP });
		expect(kindsOf(p1)).toEqual(['CALL', 'CALL', 'save']);
		expect(p1[2].payload).toEqual({ bootChartRestore: 'dropped' });
		// 首取合法、重取失败:crank 每次 CALL 回同一个 rsp,这里用首取即失败无法区分 —— 手摇两步
		const gen = fetchByChartData({ payload: { ...RECORD, bootRestore: true } }, { call, put, select });
		let step = gen.next();                         // SELECT 入口 state
		step = gen.next(st);                           // SELECT astroState(预测主限开关)
		step = gen.next(st);                           // CALL fetchChart(首取)
		step = gen.next(RSP);                          // SELECT now
		step = gen.next(newer);                        // CALL fetchChart(重取)
		expect(step.value.CALL).toBeTruthy();
		step = gen.next(undefined);                    // 重取失败 → SELECT again
		step = gen.next(newer);                        // PUT failed
		expect(step.value.PUT.action.payload).toEqual({ bootChartRestore: 'failed' });
		step = gen.next();                             // PUT nowChart
		expect(step.value.PUT.action.type).toBe('nowChart');
	});
	test('⑤ 非 bootRestore 载入:指令序不变 CALL → save 原子(无 bootChartRestore 键)', () => {
		const st = mkState();
		const puts = crank(fetchByChartData({ payload: { ...RECORD } }, { call, put, select }), { states: [st], rsp: RSP });
		expect(kindsOf(puts)).toEqual(['CALL', 'save']);
		expect(puts[1].payload).not.toHaveProperty('bootChartRestore');
	});
});

describe('checkUser · bootChartOrNow', () => {
	const fld = { a: { value: 1 } };
	test('⑥ done → 只落 fields + bootFieldsApplied,不起「此刻」,不等待', () => {
		const puts = crank(bootChartOrNow(fld, select, put, call), { states: [{ bootChartRestore: 'done' }] });
		expect(puts).toEqual([{ type: 'astro/save', payload: { fields: fld, bootFieldsApplied: true } }]);
	});
	test('⑥ pending → 落 fields 后等待;超时仍 pending 且无盘 → 标 failed + 回「此刻」;已有盘 / 已换态 → 不动', () => {
		const stuck = crank(bootChartOrNow(fld, select, put, call), { states: [{ bootChartRestore: 'pending' }, { bootChartRestore: 'pending', chartObj: null, fields: fld }] });
		expect(stuck.map((p) => (p.CALL ? `CALL:${p.fn}` : p.type))).toEqual(['astro/save', 'CALL:bootRestoreWait', 'astro/save', 'astro/nowChart']);
		expect(stuck[2].payload).toEqual({ bootChartRestore: 'failed' });
		const restored = crank(bootChartOrNow(fld, select, put, call), { states: [{ bootChartRestore: 'pending' }, { bootChartRestore: 'done', chartObj: { chartId: 'X' } }] });
		expect(restored.map((p) => (p.CALL ? 'CALL' : p.type))).toEqual(['astro/save', 'CALL']);
		const userActed = crank(bootChartOrNow(fld, select, put, call), { states: [{ bootChartRestore: 'pending' }, { bootChartRestore: 'pending', chartObj: { chartId: 'USER' } }] });
		expect(userActed.map((p) => (p.CALL ? 'CALL' : p.type))).toEqual(['astro/save', 'CALL']);
	});
	test.each([[null], ['failed'], ['dropped']])('⑥ %s → 今日路径 nowChart', (flag) => {
		const puts = crank(bootChartOrNow(fld, select, put, call), { states: [{ bootChartRestore: flag }] });
		expect(puts).toEqual([{ type: 'astro/nowChart', payload: { fields: fld } }]);
	});
});
