// 换主盘的四个入口(fetch / fetchByChartData / nowChart / fetchByFields)「只认最后发起的那一次」。
//
// 病根:列表里连着载入 A、B,A 的 /chart 晚到 —— 界面先显示 B,随后 A 回来把盘面、左栏字段、当前命盘全部盖回 A;
// 换盘代次 chartEpoch 取的是发请求前读到的值,A、B 两次提交是同一代次(左栏日界锁按它认盘,分不开两张盘)。
// 修法:模块级主盘提交代次,每个入口在第一个 yield 之前同步取号,/chart 回来后不是最新就静默作废;
// chartEpoch 在提交那一刻按最新 state 加一。本组手摇真 effect 生成器,把两次请求交错着喂响应。
import model from '../astro';
import userModel from '../user';

const dt = { ad: 1, zone: '+08:00', format: (f)=>(f === 'YYYY/MM/DD' ? '2026/07/15' : '20:00:00'), clone(){ return this; } };
const v = (x)=>({ value: x });
const FIELDS = { cid: v('old'), date: { value: dt }, time: { value: dt }, lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31), hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false), doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false), virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'), name: v('旧'), pos: v(''), memoAstro: v(''), memoBaZi: v(''), memoZiWei: v(''), memo74: v(''), memoGua: v(''), memoLiuReng: v(''), memoQiMeng: v(''), memoSuZhan: v('') };

let STATE;
const freshState = ()=>({ predictHook: {}, currentTab: 'astrochart', currentSubTab: null, memoType: 0, chartObj: { chartId: 'OLD', params: {} }, fields: FIELDS, currentChart: { cid: v('old') }, chartEpoch: 5, drawerVisible: {} });
const IO = { select: (fn)=>({ SELECT: fn }), call: (fn, ...args)=>({ CALL: [fn, args] }), put: (a)=>({ PUT: a }) };
function apply(a){ if(a && a.type === 'save' && a.payload){ STATE = { ...STATE, ...a.payload }; } }
function start(effect, payload){ return model.effects[effect]({ payload }, IO); }
// 推进到网络调用(CALL)为止
function toCall(gen){
	let step = gen.next();
	for(let g = 0; !step.done && g < 120; g += 1){
		const e = step.value || {};
		if(e.SELECT){ step = gen.next(e.SELECT({ astro: STATE, user: {} })); continue; }
		if(e.CALL){ return gen; }
		if(e.PUT){ apply(e.PUT); step = gen.next(); continue; }
		step = gen.next();
	}
	throw new Error('没有走到网络调用');
}
// 喂响应跑完;返回期间的 put
function finish(gen, rsp){
	const puts = [];
	let step = gen.next(rsp);
	for(let g = 0; !step.done && g < 120; g += 1){
		const e = step.value || {};
		if(e.SELECT){ step = gen.next(e.SELECT({ astro: STATE, user: {} })); continue; }
		if(e.CALL){ step = gen.next(rsp); continue; }
		if(e.PUT){ puts.push(e.PUT); apply(e.PUT); step = gen.next(); continue; }
		step = gen.next();
	}
	return puts;
}
const rsp = (who)=>({ Result: { params: {}, chart: { who } } });
const rec = (cid)=>({ cid, name: cid, birth: '1990-01-01 10:00:00', zone: '+08:00', lat: '26n04', lon: '119e19', nohook: true, __pendingCurrentChart: { cid: v(cid), name: v(cid) } });
const shown = ()=>({ cid: STATE.fields.cid.value, cur: STATE.currentChart && STATE.currentChart.cid ? STATE.currentChart.cid.value : null, chart: STATE.chartObj.chart ? STATE.chartObj.chart.who : null });
const formFields = (name)=>({ ...FIELDS, cid: v(null), name: v(name) });

beforeEach(()=>{ STATE = freshState(); });

describe('🔴 连着载入两张命盘:只落最后点的那张', ()=>{
	test('A 慢 B 快:B 先回、A 晚到 → 停在 B', ()=>{
		const gA = toCall(start('fetchByChartData', rec('A')));
		const gB = toCall(start('fetchByChartData', rec('B')));
		finish(gB, rsp('B'));
		expect(shown()).toEqual({ cid: 'B', cur: 'B', chart: 'B' });
		const late = finish(gA, rsp('A'));
		expect(shown()).toEqual({ cid: 'B', cur: 'B', chart: 'B' });
		expect(late.filter((p)=>p.type === 'save' || p.type === 'user/save' || p.type === 'doHook')).toEqual([]);   // 旧响应:不落库、不弹错、不派发
	});
	test('A 先回、B 后回 → 也只落 B(A 回来时已不是最新)', ()=>{
		const gA = toCall(start('fetchByChartData', rec('A')));
		const gB = toCall(start('fetchByChartData', rec('B')));
		finish(gA, rsp('A'));
		expect(shown()).toEqual({ cid: 'old', cur: 'old', chart: null });
		finish(gB, rsp('B'));
		expect(shown()).toEqual({ cid: 'B', cur: 'B', chart: 'B' });
	});
	test('旧响应失败也不弹错(新请求自有其成败路径)', ()=>{
		const gA = toCall(start('fetchByChartData', rec('A')));
		toCall(start('fetchByChartData', rec('B')));
		const late = finish(gA, { Result: null });
		expect(late).toEqual([]);
	});
});

describe('🔴 跨入口:后发起的赢', ()=>{
	test('「此刻」在途时载入 B → 落 B', ()=>{
		const gN = toCall(start('nowChart', { fields: formFields('此刻') }));
		const gB = toCall(start('fetchByChartData', rec('B')));
		finish(gB, rsp('B'));
		finish(gN, rsp('NOW'));
		expect(shown()).toEqual({ cid: 'B', cur: 'B', chart: 'B' });
	});
	test('载入 A 在途时步进时间(fetchByFields)→ 落步进那次,A 晚到作废', ()=>{
		const gA = toCall(start('fetchByChartData', rec('A')));
		const gF = toCall(start('fetchByFields', { ...formFields('步进'), nohook: true }));
		finish(gF, rsp('F'));
		finish(gA, rsp('A'));
		expect(shown().chart).toBe('F');
		expect(STATE.fields.name.value).toBe('步进');
	});
	test('步进在途时载入 B → 落 B,步进那次晚到作废', ()=>{
		const gF = toCall(start('fetchByFields', { ...formFields('步进'), nohook: true }));
		const gB = toCall(start('fetchByChartData', rec('B')));
		finish(gB, rsp('B'));
		finish(gF, rsp('F'));
		expect(shown()).toEqual({ cid: 'B', cur: 'B', chart: 'B' });
	});
	test('表单起盘(fetch)在途时点此刻 → 落此刻', ()=>{
		const gX = toCall(start('fetch', { date: dt, name: '表单', pos: '', nohook: true }));
		const gN = toCall(start('nowChart', { fields: formFields('此刻') }));
		finish(gN, rsp('NOW'));
		finish(gX, rsp('FORM'));
		expect(shown().chart).toBe('NOW');
	});
});

describe('🔴 换盘代次在提交时按最新 state 加一', ()=>{
	test('两次真提交严格递增(请求在途时代次已被别的提交推进过)', ()=>{
		const gA = toCall(start('fetchByChartData', rec('A')));
		STATE = { ...STATE, chartEpoch: 9 };   // 在途期间别的入口提交过一次
		finish(gA, rsp('A'));
		expect(STATE.chartEpoch).toBe(10);
		const gN = toCall(start('nowChart', { fields: formFields('此刻') }));
		STATE = { ...STATE, chartEpoch: 12 };
		finish(gN, rsp('NOW'));
		expect(STATE.chartEpoch).toBe(13);
	});
});

describe('编辑保存命盘只排一次盘', ()=>{
	test('updateChart:当前命盘立刻换成库里那版、排盘只派发一次', ()=>{
		const { upsertLocalChart } = require('../../utils/localcharts');
		upsertLocalChart({ cid: 'local-up', name: '旧名', birth: '1990-05-05 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1 });
		const puts = [];
		const run = (name, payload)=>{
			const it = userModel.effects[name]({ payload }, { select: (fn)=>({ S: fn }), put: (a)=>({ P: a }), call: ()=>({}) });
			let st = it.next();
			for(let g = 0; !st.done && g < 60; g += 1){
				if(st.value && st.value.P){ puts.push(st.value.P); if(userModel.effects[st.value.P.type]){ run(st.value.P.type, st.value.P.payload); } }
				st = it.next(st.value && st.value.S ? st.value.S({ user: {}, astro: {} }) : undefined);
			}
		};
		run('updateChart', { cid: 'local-up', name: '新名', lat: '39n54', lon: '116e23', gender: 1 });
		expect(puts.filter((p)=>p.type === 'astro/fetchByChartData').length).toBe(1);
		const sc = puts.find((p)=>p.type === 'setCurrentChart');
		expect(sc.payload.skipFetchByChartData).toBe(true);
		expect(puts.find((p)=>p.type === 'save' && p.payload.currentChart).payload.currentChart.name.value).toBe('新名');
	});
});

// ── 源码合同(AST):换主盘的 effect 一律「第一个 yield 之前取号、网络回来与落库之间比代次、换盘代次提交时取最新」──
describe('源码合同:astro 模型换主盘的 effect', ()=>{
	const fs = require('fs');
	const path = require('path');
	const { parseModule } = require('../../utils/__tests__/helpers/importSpecs');
	const traverse = require('@babel/traverse').default;
	const SRC = fs.readFileSync(path.resolve(__dirname, '../astro.js'), 'utf8');
	function effectsOf(src){
		const ast = parseModule(src);
		const out = [];
		traverse(ast, {
			ObjectProperty(p){
				if(p.node.key && p.node.key.name === 'effects' && p.node.value.type === 'ObjectExpression'){
					p.node.value.properties.forEach((m)=>{ if(m.type === 'ObjectMethod' && m.generator){ out.push(m); } });
				}
			},
		});
		return { ast, out };
	}
	// 一个 effect 里:各 yield 的位置与种类
	function scan(src, method){
		const yields = [];
		const calls = [];
		let epochDecl = null;
		traverse(parseModule(src), {
			ObjectMethod(p){
				if(p.node.start !== method.start){ return; }
				p.traverse({
					YieldExpression(y){
						const a = y.node.argument;
						const code = src.slice(a ? a.start : y.node.start, a ? a.end : y.node.end);
						let kind = 'other';
						if(/^call\(\s*service\.fetchChart\b/.test(code)){ kind = 'fetchChart'; }
						else if(/^put\(/.test(code) && /type:\s*'save'/.test(code) && /\bchartObj\b/.test(code)){ kind = 'saveChart'; }
						yields.push({ kind, start: y.node.start });
					},
					CallExpression(c){
						if(c.node.callee.type === 'Identifier'){ calls.push({ name: c.node.callee.name, start: c.node.start }); }
					},
					VariableDeclarator(d){
						if(d.node.id.name === 'chartEpochNext'){ epochDecl = { start: d.node.start, code: src.slice(d.node.init.start, d.node.init.end) }; }
					},
				});
			},
		}, null);
		return { yields, calls, epochDecl };
	}
	function violations(src){
		const { out } = effectsOf(src);
		const bad = [];
		const subjects = [];
		out.forEach((m)=>{
			const name = m.key.name;
			const { yields, calls, epochDecl } = scan(src, m);
			const fetches = yields.filter((y)=>y.kind === 'fetchChart');
			const saves = yields.filter((y)=>y.kind === 'saveChart');
			if(!fetches.length || !saves.length){ return; }
			subjects.push(name);
			const take = calls.find((c)=>c.name === 'takeChartCommitTicket');
			if(!take || take.start > yields[0].start){ bad.push(`${name}: 没在第一个 yield 之前取主盘提交代次`); }
			saves.forEach((sv)=>{
				const lastFetch = fetches.filter((f)=>f.start < sv.start).pop();
				if(!lastFetch){ return; }
				if(!calls.some((c)=>c.name === 'chartCommitTicketLive' && c.start > lastFetch.start && c.start < sv.start)){
					bad.push(`${name}: 网络回来到落库之间没比主盘提交代次`);
				}
			});
			const body = src.slice(m.start, m.end);
			if(/chartEpoch:/.test(body)){
				const lastFetch = fetches[fetches.length - 1];
				if(!epochDecl || epochDecl.start < lastFetch.start || !/yield select/.test(epochDecl.code)){
					bad.push(`${name}: 换盘代次不是在网络回来之后按最新 state 取的`);
				}
			}
		});
		return { bad, subjects };
	}
	test('四个入口都受管;每个都取号、比号;换盘代次提交时取最新', ()=>{
		const { bad, subjects } = violations(SRC);
		expect(subjects.sort()).toEqual(['fetch', 'fetchByChartData', 'fetchByFields', 'nowChart']);
		expect(bad).toEqual([]);
	});
	test('判别力:拿掉一处比号 / 取号挪到 yield 之后 / 代次沿用请求前的 state → 各自红', ()=>{
		const noCheck = SRC.replace("if(!chartCommitTicketLive(commitTicket)){ return; }   // 之后又换过主盘:旧响应作废(也不用回紫微种子)", '');
		expect(violations(noCheck).bad).toEqual(['nowChart: 网络回来到落库之间没比主盘提交代次']);
		const late = SRC.replace(/(\*fetch\(\{ payload: values \}, \{ call, put, select \}\)\{\n)\t\t\tconst commitTicket = takeChartCommitTicket\(\);[^\n]*\n/, "$1\t\t\tconst __x = yield select((s)=>s.astro);\n\t\t\tconst commitTicket = takeChartCommitTicket();\n");
		expect(late).not.toBe(SRC);
		expect(violations(late).bad).toEqual(['fetch: 没在第一个 yield 之前取主盘提交代次']);
		const stale = SRC.replace("const chartEpochNext = (((yield select((s)=>s.astro)) || {}).chartEpoch || 0) + 1;\n            yield put({", "const chartEpochNext = ((astroState && astroState.chartEpoch) || 0) + 1;\n            yield put({");
		expect(stale).not.toBe(SRC);
		expect(violations(stale).bad).toEqual(['nowChart: 换盘代次不是在网络回来之后按最新 state 取的']);
	});
});
