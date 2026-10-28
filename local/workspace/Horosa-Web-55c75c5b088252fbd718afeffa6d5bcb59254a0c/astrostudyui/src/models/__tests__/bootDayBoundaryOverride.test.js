// 温启 × 左栏亲手改过的日界 / 晚子时:没钉住的盘上亲手改的那一键随快照走、重启后照样不被全局冲掉(左栏最高权限);
// 时间算法仍按不钉住走。
import model from '../astro';
import { buildBootChartRecord } from '../../utils/bootChartRestore';
import DateTime from '../../components/comp/DateTime';

function fields(){
	const dt = new DateTime();
	dt.parse('1990-05-06 23:30:00', 'YYYY-MM-DD HH:mm:ss');
	dt.ad = 1; dt.zone = '+08:00';
	const v = (x)=>({ value: x });
	return { cid: v(null), date: { value: dt }, time: { value: dt }, lat: v('26n04'), lon: v('119e19'), name: v('甲'), pos: v(''), after23NewDay: v(0), lateZiHourUseNextDay: v(0), timeAlg: v(1),
		hsys: v(1), zodiacal: v(0), memoAstro: v(''), memoBaZi: v(''), memoZiWei: v(''), memo74: v(''), memoGua: v(''), memoLiuReng: v(''), memoQiMeng: v(''), memoSuZhan: v('') };
}

test('🔴 没钉住 + 左栏改过日界:快照带日界那一键与「亲手改过」标记,不带晚子时 / 时间算法(时间算法另记)', ()=>{
	const snap = buildBootChartRecord(fields(), 'ziwei', null, { dayBoundaryPinned: false, dayBoundaryUserOverride: { after23: true, lateZi: false } });
	expect(snap.pinned).toBe(false);
	expect(snap.record.after23NewDay).toBe(0);
	expect(snap.record.lateZiHourUseNextDay).toBeUndefined();
	expect(snap.record.timeAlg).toBeUndefined();
	expect(snap.unpinnedTimeAlg).toBe(1);
	expect(snap.dayBoundaryUserOverride).toEqual({ after23: true, lateZi: false });
});

test('没改过:照旧三键都不带、没有标记;钉住时照旧三键都带', ()=>{
	const a = buildBootChartRecord(fields(), 'ziwei', null, { dayBoundaryPinned: false, dayBoundaryUserOverride: { after23: false, lateZi: false } });
	expect(a.record.after23NewDay).toBeUndefined();
	expect(a.dayBoundaryUserOverride).toBeUndefined();
	const b = buildBootChartRecord(fields(), 'ziwei', null, { dayBoundaryPinned: true, dayBoundaryUserOverride: { after23: true } });
	expect(b.record.after23NewDay).toBe(0);
	expect(b.record.timeAlg).toBe(1);
	expect(b.dayBoundaryUserOverride).toBeUndefined();
});

// 与 astroBootChartRestore.test 同一份模型层字段桩(fieldsToParams 要的键齐全)
function modelFields(){
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
		after23NewDay: v(1), lateZiHourUseNextDay: v(1),
	};
}

test('🔴 温启还原:不钉住共享层、恢复「亲手改过」标志(之后全局事件不冲掉这一键)', ()=>{
	const gen = model.effects.fetchByChartData({ payload: { birth: '1990-05-06 23:30:00', ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', after23NewDay: 0, bootRestore: true, bootDayBoundaryUserOverride: { after23: true, lateZi: false }, nohook: true } }, {
		select: (fn)=>({ SELECT: fn }), call: (fn, ...args)=>({ CALL: [fn, args] }), put: (a)=>({ PUT: a }),
	});
	const st = { predictHook: {}, currentTab: 'astrochart', currentSubTab: null, memoType: 0, chartObj: { chartId: 'OLD', params: {} }, fields: modelFields(), bootChartRestore: null, bootFieldsApplied: false };
	let step = gen.next();
	const puts = [];
	let guard = 0;
	while(!step.done && guard < 80){
		guard += 1;
		const e = step.value || {};
		if(e.SELECT){ step = gen.next(e.SELECT({ astro: st })); }
		else if(e.CALL){ step = gen.next({ Result: { params: {}, chart: { ok: 1 } } }); }
		else if(e.PUT){ puts.push(e.PUT); step = gen.next(); }
		else{ step = gen.next(); }
	}
	const save = puts.find((p)=>p.type === 'save' && p.payload && p.payload.bootChartRestore === 'done');
	expect(save).toBeTruthy();
	expect(save.payload._dayBoundaryRecordPinned).toBe(false);
	expect(save.payload._after23BoundaryUserOverrode).toBe(true);
	expect(save.payload._lateZiHourUserOverrode).toBe(false);
	const next = model.reducers.syncAfter23NewDay({ ...st, ...save.payload }, { payload: { after23NewDay: 1 } });
	expect(next.fields.after23NewDay.value).toBe(0);
});

// ── 锁只属于改的那张盘:换盘一律复位,快照不再把锁带到无关的盘上 ──
function drive(effect, payload, st){
	const gen = model.effects[effect]({ payload }, { select: (fn)=>({ SELECT: fn }), call: (fn, ...args)=>({ CALL: [fn, args] }), put: (a)=>({ PUT: a }) });
	let step = gen.next();
	const puts = [];
	let guard = 0;
	while(!step.done && guard < 120){
		guard += 1;
		const e = step.value || {};
		if(e.SELECT){ step = gen.next(e.SELECT({ astro: st, user: {} })); }
		else if(e.CALL){ step = gen.next({ Result: { params: {}, chart: { ok: 1 } } }); }
		else if(e.PUT){ puts.push(e.PUT); step = gen.next(); }
		else{ step = gen.next(); }
	}
	return puts;
}
const lockedState = ()=>({ ...model.state, predictHook: new Proxy({}, { get: ()=>({ fun: null }) }), currentTab: 'liureng', currentSubTab: null, memoType: 0, chartObj: { chartId: 'OLD', params: {} }, fields: modelFields(), _after23BoundaryUserOverrode: true, _lateZiHourUserOverrode: true, chartEpoch: 4 });

describe('🔴 「亲手改过」的锁不跨盘', ()=>{
	test('载入另一条不钉住的记录(非温启):两把锁复位、换盘代次 +1;之后全局日界照常同步', ()=>{
		const st = lockedState();
		const puts = drive('fetchByChartData', { birth: '1990-05-06 23:30:00', ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', nohook: true }, st);
		const save = puts.find((p)=>p.type === 'save' && p.payload && p.payload.byChartData);
		expect(save.payload).toMatchObject({ _after23BoundaryUserOverrode: false, _lateZiHourUserOverrode: false, chartEpoch: 5, _dayBoundaryRecordPinned: false });
		const next = model.reducers.syncAfter23NewDay({ ...st, ...save.payload }, { payload: { after23NewDay: 0 } });
		expect(next.fields.after23NewDay.value).toBe(0);
	});
	test('「此刻」/ 新命盘:两把锁复位、换盘代次 +1;快照里没有 override', ()=>{
		const st = lockedState();
		const puts = drive('nowChart', { fields: modelFields() }, st);
		const save = puts.find((p)=>p.type === 'save' && p.payload && p.payload.chartObj);
		expect(save.payload).toMatchObject({ _after23BoundaryUserOverrode: false, _lateZiHourUserOverrode: false, chartEpoch: 5 });
		const after = { ...st, ...save.payload };
		const snap = buildBootChartRecord(fields(), 'liureng', null, { dayBoundaryPinned: false, dayBoundaryUserOverride: { after23: !!after._after23BoundaryUserOverrode, lateZi: !!after._lateZiHourUserOverrode } });
		expect(snap.dayBoundaryUserOverride).toBeUndefined();
	});
	test('技法页组件实例上的锁:同一张盘 / 同一课照锁;换盘代次或载入另一课就不算数', ()=>{
		const storageutil = require('../../utils/storageutil');
		const { lockDayBoundary, dayBoundaryLockHeld } = require('../../utils/dayBoundaryLock');
		storageutil.setGlobalStore({ astro: { chartEpoch: 2 }, user: { appliedCaseCid: 'k1', caseApplySeq: 3 } });
		const inst = { _after23BoundaryUserOverrode: false };
		lockDayBoundary(inst, 'after23');
		expect(dayBoundaryLockHeld(inst, 'after23')).toBe(true);
		expect(dayBoundaryLockHeld(inst, 'lateZi')).toBe(false);
		storageutil.setGlobalStore({ astro: { chartEpoch: 2 }, user: { appliedCaseCid: 'k1', caseApplySeq: 4 } });
		expect(dayBoundaryLockHeld(inst, 'after23')).toBe(false);
		lockDayBoundary(inst, 'after23');
		storageutil.setGlobalStore({ astro: { chartEpoch: 3 }, user: { appliedCaseCid: 'k1', caseApplySeq: 4 } });
		expect(dayBoundaryLockHeld(inst, 'after23')).toBe(false);
		storageutil.setGlobalStore({});
	});
	test('源码合同:astro 模型每个换盘入口(save 里写 _dayBoundaryRecordPinned 的)同一次复位两把锁并推进 chartEpoch;组件不直接读写锁', ()=>{
		const fs = require('fs');
		const path = require('path');
		const SRC = path.resolve(__dirname, '../..');
		const astro = fs.readFileSync(path.join(SRC, 'models/astro.js'), 'utf8');
		const effects = astro.split(/\n\t\t\*(?=[a-zA-Z]+\()/).slice(1);
		const switching = effects.filter((e)=>/_dayBoundaryRecordPinned:/.test(e));
		expect(switching.map((e)=>e.slice(0, e.indexOf('('))).sort()).toEqual(['fetchByChartData', 'nowChart']);
		switching.forEach((e)=>{
			expect([e.slice(0, 20), /_after23BoundaryUserOverrode:/.test(e), /_lateZiHourUserOverrode:/.test(e), /chartEpoch: chartEpochNext/.test(e)]).toEqual([e.slice(0, 20), true, true, true]);
		});
		const comps = ['components/ziwei/ZiWeiMain.js', 'components/dunjia/DunJiaMain.js', 'components/jinkou/JinKouMain.js', 'components/lrzhan/LiuRengMain.js', 'components/taiyi/TaiYiMain.js', 'components/guazhan/GuaZhanMain.js', 'components/sanshi/SanShiUnitedMain.js'];
		comps.forEach((f)=>{
			const lines = fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').map((l)=>l.replace(/\/\/.*$/, ''));
			const raw = lines.filter((l)=>/this\._(?:after23BoundaryUserOverrode|lateZiHourUserOverrode)\b/.test(l) && !/=\s*false\s*;/.test(l));
			expect([f, raw]).toEqual([f, []]);
		});
	});
});

// ── 换事盘同样算换盘:模型层两把锁与实例锁同一归属(盘身份 = chartEpoch | 载入的事盘 | 载入代次)──
describe('🔴 模型层日界锁 × 换事盘', ()=>{
	const userModel = require('../user').default;
	// 手驱 user effect:user/save 走 user reducer,astro/* 走 astro reducer(save / syncAfter23NewDay…),astro effect 不跑(只看锁)
	function runUser(name, payload, st){
		const fx = { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }), call: (fn, ...args)=>({ __call: [fn, args] }) };
		const it = userModel.effects[name]({ payload }, fx);
		let res = it.next();
		let g = 0;
		while(!res.done && g++ < 80){
			const y = res.value;
			if(y && y.__put){
				const a = y.__put;
				if(a.type === 'save'){ st.user = userModel.reducers.save(st.user, a); }
				else if(a.type.indexOf('astro/') === 0 && model.reducers[a.type.slice(6)]){ st.astro = model.reducers[a.type.slice(6)](st.astro, { payload: a.payload }); }
				else if(userModel.effects[a.type]){ runUser(a.type, a.payload, st); }
				res = it.next();
			}else if(y && y.__select){ res = it.next(y.__select(st)); }
			else if(y && y.__call){ res = it.next(); }
			else{ res = it.next(); }
		}
		return st;
	}
	const caseRec = (cid, extra)=>({ cid, caseType: 'liureng', sourceModule: 'liureng', event: cid, divTime: '2020-03-04 05:06:07', zone: '+08:00', lon: '116e23', lat: '39n54', pos: '北京', updateTime: `t-${cid}`, payload: '{}', ...(extra || {}) });
	const lockedAstro = ()=>({ ...model.state, fields: modelFields(), _after23BoundaryUserOverrode: true, _lateZiHourUserOverrode: true, _dayBoundaryRecordPinned: false, chartEpoch: 3 });
	test('六壬左栏置锁 → 载入另一条(不带日界口径)→ 两把锁复位,「设置 → 日界」改全局照常同步到共享 fields', ()=>{
		const st = runUser('applyCase', caseRec('case-b'), { user: { ...userModel.state, caseApplySeq: 1, appliedCaseCid: 'case-a' }, astro: lockedAstro() });
		expect(st.astro._after23BoundaryUserOverrode).toBe(false);
		expect(st.astro._lateZiHourUserOverrode).toBe(false);
		expect(st.astro._dayBoundaryRecordPinned).toBe(false);
		const next = model.reducers.syncAfter23NewDay(st.astro, { payload: { after23NewDay: 0 } });
		expect(next.fields.after23NewDay.value).toBe(0);
		const next2 = model.reducers.syncLateZiHourMode(st.astro, { payload: { lateZiHourUseNextDay: 0 } });
		expect(next2.fields.lateZiHourUseNextDay.value).toBe(0);
	});
	test('删掉载入的那条 / 界面外改动推进载入代次 → 锁复位;改的不是载入那条 → 锁照旧', ()=>{
		const a = runUser('clearCurrentCaseIfRemoved', { cids: ['case-a'] }, { user: { ...userModel.state, appliedCaseCid: 'case-a', caseApplySeq: 2, currentCase: null }, astro: lockedAstro() });
		expect(a.astro._after23BoundaryUserOverrode).toBe(false);
		const b = runUser('clearCurrentCaseIfRemoved', { cids: ['case-z'] }, { user: { ...userModel.state, appliedCaseCid: 'case-a', caseApplySeq: 2, currentCase: null }, astro: lockedAstro() });
		expect(b.astro._after23BoundaryUserOverrode).toBe(true);
		localStorage.setItem('horosa.localCases.v1', JSON.stringify([caseRec('case-a', { divTime: '2021-01-01 01:01:01' })]));
		const cur = { cid: { value: 'case-a' } };
		const c = runUser('syncRecordFromStore', { store: 'case', cid: 'case-a', fields: ['divTime'] }, { user: { ...userModel.state, appliedCaseCid: 'case-a', caseApplySeq: 2, currentCase: cur }, astro: lockedAstro() });
		expect([c.user.caseApplySeq, c.astro._after23BoundaryUserOverrode]).toEqual([3, false]);
		const d = runUser('syncRecordFromStore', { store: 'case', cid: 'case-a', fields: ['memo'] }, { user: { ...userModel.state, appliedCaseCid: 'case-a', caseApplySeq: 2, currentCase: cur }, astro: lockedAstro() });
		expect([d.user.caseApplySeq, d.astro._after23BoundaryUserOverrode]).toEqual([2, true]);
		localStorage.removeItem('horosa.localCases.v1');
	});
	test('源码合同:user 模型里写载入代次 / 载入的事盘的每个函数都同一处复位模型层两把锁(单一出处 DAY_BOUNDARY_LOCKS_RELEASED)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '../user.js'), 'utf8');
		const chunks = src.split(/\n(?=function\s*\*?\s*[A-Za-z]|\t\t\*[A-Za-z]+\(|export default)/).filter((c)=>!/^export default/.test(c));
		const writers = chunks.filter((c)=>/\b(?:caseApplySeq|appliedCaseCid)\s*(?::|=(?!=))/.test(c.replace(/\/\/.*$/gm, '')));
		const name = (c)=>(c.match(/^(?:function\s*\*?\s*|\t\t\*)([A-Za-z]+)/) || [])[1];
		expect(writers.map(name).sort()).toEqual(['applyCase', 'clearCurrentCaseIn', 'reloadCurrentCaseFromStore']);
		writers.forEach((c)=>{ expect([name(c), /\.\.\.DAY_BOUNDARY_LOCKS_RELEASED/.test(c)]).toEqual([name(c), true]); });
		const { DAY_BOUNDARY_LOCKS_RELEASED } = require('../../utils/dayBoundaryLock');
		expect(DAY_BOUNDARY_LOCKS_RELEASED).toEqual({ _after23BoundaryUserOverrode: false, _lateZiHourUserOverrode: false });
	});
});
