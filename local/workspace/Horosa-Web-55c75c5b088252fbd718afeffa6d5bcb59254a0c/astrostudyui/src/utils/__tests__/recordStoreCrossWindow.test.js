// 别的窗口删了 / 改了本窗口当前那条命盘 / 事盘:当前那条跟着走(命盘脱离记录、事盘清掉;内容换了按库里新版重设),
// 否则回本窗口一「保存」就把回收站里那条在库里重新建出来、或把别的窗口的改动盖回去。
import { recordStoreStoragePlan, bindRecordStoreCrossWindowSync } from '../recordStoreCrossWindow';
import { RECORDS_CHANGED_EVENT } from '../recordStoreNotice';
const userModel = require('../../models/user').default;

const CH = 'horosa.localCharts.v1';
const CA = 'horosa.localCases.v1';
const list = (...rs)=>JSON.stringify(rs);

function runEffect(name, payload, state){
	const puts = [];
	const fx = { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }), call: (fn, ...args)=>({ __call: [fn, args] }) };
	const it = userModel.effects[name]({ payload }, fx);
	let res = it.next();
	let guard = 0;
	while(!res.done && guard++ < 50){
		const y = res.value;
		if(y && y.__put){ puts.push(y.__put); res = it.next(); }
		else if(y && y.__select){ res = it.next(y.__select(state)); }
		else{ res = it.next(); }
	}
	return puts;
}

describe('storage 事件 → 计划', ()=>{
	it('消失的 cid 与内容换了的 cid 分开;不是记录库的键不管', ()=>{
		const p = recordStoreStoragePlan({ key: CH, oldValue: list({ cid: 'x', updateTime: '1' }, { cid: 'y', updateTime: '1' }, { cid: 'z', updateTime: '1' }), newValue: list({ cid: 'y', updateTime: '2' }, { cid: 'z', updateTime: '1' }) });
		expect(p).toEqual({ store: 'chart', removed: ['x'], changed: ['y'], fieldsByCid: { y: ['updateTime'] } });
		expect(recordStoreStoragePlan({ key: 'globalSetup', oldValue: '{}', newValue: '{}' })).toBe(null);
		expect(recordStoreStoragePlan({ key: null })).toBe(null);
		expect(recordStoreStoragePlan({ key: CA, oldValue: list({ cid: 'k' }), newValue: list() })).toEqual({ store: 'case', removed: ['k'], changed: [], fieldsByCid: {} });
	});
	it('新值是坏串:不据此判「全删了」', ()=>{
		expect(recordStoreStoragePlan({ key: CH, oldValue: list({ cid: 'x' }), newValue: '{broken' })).toBe(null);
	});
});

describe('🔴 接线:别的窗口删了当前命盘 → 本窗口当前命盘脱离记录;事盘 → 清掉;改了 → 广播重设', ()=>{
	it('派发与本窗口删除同一出口,并按记录号广播', ()=>{
		const sent = [];
		const got = [];
		const h = (e)=>got.push(e.detail);
		window.addEventListener(RECORDS_CHANGED_EVENT, h);
		const off = bindRecordStoreCrossWindowSync((a)=>sent.push(a));
		window.dispatchEvent(new window.StorageEvent('storage', { key: CH, oldValue: list({ cid: 'x', updateTime: '1' }, { cid: 'y', updateTime: '1' }), newValue: list({ cid: 'y', updateTime: '2' }) }));
		window.dispatchEvent(new window.StorageEvent('storage', { key: CA, oldValue: list({ cid: 'k' }), newValue: list() }));
		off();
		window.removeEventListener(RECORDS_CHANGED_EVENT, h);
		expect(sent).toEqual([
			{ type: 'user/detachCurrentChartIfRemoved', payload: { cids: ['x'] } },
			{ type: 'user/clearCurrentCaseIfRemoved', payload: { cids: ['k'] } },
		]);
		expect(got).toEqual([{ store: 'chart', cids: ['y'], fieldsByCid: { y: ['updateTime'] }, source: 'cross-window' }, { store: 'case', cids: [], fieldsByCid: {}, source: 'cross-window' }]);
	});
	it('落到 user 模型:当前命盘 cid 清空(之后保存不会在库里重新建出回收站里那条)', ()=>{
		const cur = { cid: { value: 'x' }, name: { value: '甲' } };
		const puts = runEffect('detachCurrentChartIfRemoved', { cids: ['x'] }, { user: { currentChart: cur }, astro: { fields: { cid: { value: 'x' } } } });
		const save = puts.find((p)=>p.type === 'save');
		expect(save.payload.currentChart.cid.value).toBe(null);
		expect(puts.find((p)=>p.type === 'astro/save' && p.payload.fields).payload.fields.cid.value).toBe(null);
	});
	it('源码:layouts 接了这条同步', ()=>{
		const fs = require('fs');
		const path = require('path');
		expect(fs.readFileSync(path.join(__dirname, '../../layouts/app.js'), 'utf8')).toMatch(/bindRecordStoreCrossWindowSync\(dispatch\)/);
	});
});

describe('别的窗口改了当前命盘:逐键判要不要重排', ()=>{
	it('计划逐条给出改了哪些键(两版键集并集、值按文本比)', ()=>{
		const p = recordStoreStoragePlan({ key: CH, oldValue: list({ cid: 'a', name: '甲', pinTier: 0 }, { cid: 'b', name: '乙' }), newValue: list({ cid: 'a', name: '甲', pinTier: 1, pinAt: 't' }, { cid: 'b', name: '乙' }) });
		expect(p.changed).toEqual(['a']);
		expect(p.fieldsByCid).toEqual({ a: ['pinAt', 'pinTier'] });
	});
	const base = { cid: 'C1', name: '甲', birth: '1990-01-01 10:00:00', updateTime: '2026-10-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', hsys: 1, gender: 1 };
	it.each([
		['星标', { starred: true }, true],
		['置顶', { pinTier: 1, pinAt: '2026-10-24 09:00:00' }, true],
		['上移下移', { orderKey: -9 }, true],
		['归档', { archived: true }, true],
		['改备注(连带更新时间)', { memo: '新备注', updateTime: '2026-10-24 10:00:00' }, true],
		['改名', { name: '甲改' }, true],
		['加标签', { group: JSON.stringify(['新']) }, true],
		['断事日志', { journal: [{ at: 'x', text: 'y' }] }, true],
		['关联', { relations: [{ cid: 'C2' }] }, true],
		['改生辰', { birth: '1990-01-01 11:00:00' }, false],
		['改时区', { zone: '+09:00' }, false],
		['改纬度', { lat: '40n00' }, false],
		['改宫制', { hsys: 3 }, false],
		['改性别', { gender: 0 }, false],
		['改分技法批注', { memoAstro: 'x' }, false],
		['不认识的新键', { someFutureKey: 1 }, false],
	])('%s → 只重设记录态(不重排)= %s', (label, patch, skip)=>{
		const next = { ...base, ...patch };
		localStorage.setItem(CH, JSON.stringify([next]));
		const plan = recordStoreStoragePlan({ key: CH, oldValue: JSON.stringify([base]), newValue: JSON.stringify([next]) });
		const state = { user: { currentChart: { cid: { value: 'C1' }, updateTime: { value: base.updateTime } } } };
		const puts = runEffect('syncRecordFromStore', { store: 'chart', cids: plan.changed, fieldsByCid: plan.fieldsByCid, source: 'cross-window' }, state);
		const sc = puts.find((p)=>p.type === 'setCurrentChart');
		expect(sc.payload.cid).toBe('C1');
		expect(sc.payload.skipFetchByChartData).toBe(skip);
		// 不重排的分支:展示字段补丁跟着派;要重排的(排盘时整组换字段)不派
		expect(puts.some((p)=>p.type === 'astro/patchRecordDisplayFields')).toBe(skip);
		localStorage.removeItem(CH);
	});
	it('🔴 只改名 / 改地名:左栏字段与盘面参数里的名字 / 地名跟上,其余不动、不重新请求', ()=>{
		const astroModel = require('../../models/astro').default;
		const fields = { cid: { value: 'C1' }, name: { value: '甲' }, pos: { value: '北京' }, lat: { value: '39n54' } };
		const chartObj = { chartId: 'k1', params: { name: '甲', pos: '北京', birth: 'x' }, objects: [] };
		const state = { astro: { fields, chartObj } };
		const puts = [];
		const fx = { put: (a)=>({ __put: a }), select: (fn)=>({ __select: fn }) };
		const it2 = astroModel.effects.patchRecordDisplayFields({ payload: { ...base, name: '甲改', pos: '上海' } }, fx);
		let r = it2.next();
		while(!r.done){ const y = r.value; if(y && y.__put){ puts.push(y.__put); r = it2.next(); } else if(y && y.__select){ r = it2.next(y.__select(state)); } else { r = it2.next(); } }
		expect(puts.length).toBe(1);
		const save = puts[0].payload;
		expect(save.fields.name.value).toBe('甲改');
		expect(save.fields.pos.value).toBe('上海');
		expect(save.fields.lat).toBe(fields.lat);
		expect(save.chartObj.params).toMatchObject({ name: '甲改', pos: '上海', birth: 'x' });
		expect(save.chartObj.chartId).toBe('k1');
		expect(Object.keys(save).sort()).toEqual(['chartObj', 'fields']);   // 不推进代次
		// 字段不属于这条记录:不动
		const other = { astro: { fields: { ...fields, cid: { value: 'C9' } }, chartObj } };
		const it3 = astroModel.effects.patchRecordDisplayFields({ payload: { ...base, name: '甲改' } }, fx);
		let r3 = it3.next(); const puts3 = [];
		while(!r3.done){ const y = r3.value; if(y && y.__put){ puts3.push(y.__put); r3 = it3.next(); } else if(y && y.__select){ r3 = it3.next(y.__select(other)); } else { r3 = it3.next(); } }
		expect(puts3).toEqual([]);
	});
	it('判别力:不带 fieldsByCid(整条替换来源)→ 一律重排', ()=>{
		const next = { ...base, starred: true };
		localStorage.setItem(CH, JSON.stringify([next]));
		const state = { user: { currentChart: { cid: { value: 'C1' }, updateTime: { value: base.updateTime } } } };
		const puts = runEffect('syncRecordFromStore', { store: 'chart', cids: ['C1'], source: 'import' }, state);
		expect(puts.find((p)=>p.type === 'setCurrentChart').payload.skipFetchByChartData).toBe(false);
		localStorage.removeItem(CH);
	});
});
