// 列表载入命盘:当前命盘与左栏字段在排盘成功后同一次提交;排盘失败两边都不变(不会出现「新当前命盘 + 旧字段」)。
import model from '../astro';
import userModel from '../user';

const dt = { ad: 1, zone: '+08:00', format: (f)=>(f === 'YYYY/MM/DD' ? '2026/07/15' : '20:00:00'), clone(){ return this; } };
const v = (x)=>({ value: x });
const FIELDS = { cid: v('old'), date: { value: dt }, time: { value: dt }, lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31), hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false), doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false), virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'), name: v('旧'), pos: v(''), memoAstro: v(''), memoBaZi: v(''), memoZiWei: v(''), memo74: v(''), memoGua: v(''), memoLiuReng: v(''), memoQiMeng: v(''), memoSuZhan: v('') };
const STATE = { predictHook: {}, currentTab: 'astrochart', currentSubTab: null, memoType: 0, chartObj: { chartId: 'OLD', params: {} }, fields: FIELDS, currentChart: { cid: v('old') } };

function crank(payload, rsp){
	const gen = model.effects.fetchByChartData({ payload }, { select: (fn)=>({ SELECT: fn }), call: (fn)=>({ CALL: fn }), put: (a)=>({ PUT: a }) });
	const puts = [];
	let step = gen.next();
	let guard = 0;
	while(!step.done && guard < 80){
		guard += 1;
		const e = step.value || {};
		if(e.SELECT){ step = gen.next(e.SELECT({ astro: STATE })); }
		else if(e.CALL){ step = gen.next(rsp); }
		else if(e.PUT){ puts.push(e.PUT); step = gen.next(); }
		else{ step = gen.next(); }
	}
	return puts;
}
const NEW_CHART = { cid: v('new'), name: v('新') };
const PAYLOAD = { cid: 'new', name: '新', birth: '1990-01-01 10:00:00', zone: '+08:00', lat: '26n04', lon: '119e19', nohook: true, __pendingCurrentChart: NEW_CHART };

test('🔴 排盘成功:当前命盘与字段同一次 save 提交,user 侧同步', ()=>{
	const puts = crank(PAYLOAD, { Result: { params: {}, chart: { ok: 1 } } });
	const save = puts.find((p)=>p.type === 'save' && p.payload && p.payload.chartObj);
	expect(save.payload.currentChart).toBe(NEW_CHART);
	expect(save.payload.fields.cid.value).toBe('new');
	expect(puts.some((p)=>p.type === 'user/save' && p.payload.currentChart === NEW_CHART)).toBe(true);
});

test('🔴 排盘失败:当前命盘与字段都不变', ()=>{
	const puts = crank(PAYLOAD, { Result: null });
	expect(puts.some((p)=>p.payload && p.payload.currentChart)).toBe(false);
	expect(puts.some((p)=>p.type === 'save' && p.payload && p.payload.fields)).toBe(false);
});

test('setCurrentChart 要排盘时不先换当前命盘;不排盘(编辑 / 只改名)照旧立刻落', ()=>{
	const run = (payload)=>{
		const gen = userModel.effects.setCurrentChart({ payload }, { put: (a)=>a, call: ()=>undefined, select: ()=>undefined });
		const puts = [];
		let st = gen.next();
		while(!st.done){ if(st.value && st.value.type){ puts.push(st.value); } st = gen.next(); }
		return puts;
	};
	const rec = { cid: 'new', name: '新', birth: '1990-01-01 10:00:00', zone: '+08:00', lat: '26n04', lon: '119e19', gender: 1, isPub: 0 };
	const a = run(rec);
	expect(a.map((p)=>p.type)).toEqual(['astro/fetchByChartData']);
	expect(a[0].payload.__pendingCurrentChart.cid.value).toBe('new');
	const b = run({ ...rec, skipFetchByChartData: true });
	expect(b.map((p)=>p.type)).toEqual(['save', 'astro/save']);
});
