// 奇门页 / 三式合一页:起局选阴盘(报数定局)照常用、只是不记 —— 报数是每一课的输入不记,只记阴盘会让重开后标签写阴盘、
// 报数是空的、实际按拆补起局(与六壬「离不开输入的起课法不进候选」同律)。
// 奇门页正在取数时的外部起盘(择日点结果行)排队、取数落地后补起最后一次,不再静默丢弃;排队之后又载入事盘 / 命盘、
// 或亲手起局,以后发生的为准,排着的作废。
// 三式「紫微四化」页的时间算法取三式页自己的,不取共享字段。
// 「传本设置」弹窗底部说明只讲改后即时重排。
import fs from 'fs';
import path from 'path';

const SAVED_DJ = 'horosa.dunjia.settings.v1';
const SAVED_SS = 'horosa.sanshi.settings.v1';

describe('阴盘不进跨会话保存值', ()=>{
	const { DUNJIA_PAGE_SETTINGS } = require('../DunJiaMain');
	const { SANSHI_PAGE_SETTINGS } = require('../../sanshi/SanShiUnitedMain');
	beforeEach(()=>{ localStorage.removeItem(SAVED_DJ); localStorage.removeItem(SAVED_SS); });
	test.each([['奇门页', DUNJIA_PAGE_SETTINGS], ['三式合一页', SANSHI_PAGE_SETTINGS]])('🔴 %s:选阴盘不写、库里留上一次的起局法;其它起局法照记', (_name, st)=>{
		expect(st.save({ qijuMethod: 'chaibu' })).toEqual(['qijuMethod']);
		expect(st.save({ qijuMethod: 'shuzi' })).toEqual([]);
		expect(st.loadSaved().qijuMethod).toBe('chaibu');
		expect(st.load().qijuMethod).toBe('chaibu');
		expect(st.save({ qijuMethod: 'maoshan' })).toEqual(['qijuMethod']);
		expect(st.loadSaved().qijuMethod).toBe('maoshan');
	});
	test.each([['奇门页', DUNJIA_PAGE_SETTINGS, SAVED_DJ], ['三式合一页', SANSHI_PAGE_SETTINGS, SAVED_SS]])('%s:早先存下的阴盘读回按没存过(回缺省起局法)', (_name, st, key)=>{
		localStorage.setItem(key, JSON.stringify({ v: 1, values: { qijuMethod: 'shuzi', school: '飞盘' } }));
		expect(st.loadSaved()).not.toHaveProperty('qijuMethod');
		expect(st.loadSaved().school).toBe('飞盘');
		expect(st.load().qijuMethod).toBe(st.defaults().qijuMethod);
	});
	test('事盘里存的阴盘照常还原(载入不经候选校验)', ()=>{
		expect(DUNJIA_PAGE_SETTINGS.fillMissing({ qijuMethod: 'shuzi' }).qijuMethod).toBe('shuzi');
		expect(SANSHI_PAGE_SETTINGS.fillMissing({ qijuMethod: 'shuzi' }).qijuMethod).toBe('shuzi');
	});
});

describe('奇门页取数时的外部起盘', ()=>{
	const DunJiaMain = require('../DunJiaMain').default;
	function ctx(loading){
		const c = Object.create(DunJiaMain.prototype);
		c.state = { loading, options: {} };
		c.props = { fields: null };
		c.restoreOptionsFromCurrentCase = ()=>{};
		c.restoreFromCurrentChart = ()=>{};
		c.syncSexFromFields = ()=>{};
		return c;
	}
	test('🔴 取数中点选:排队(后点的胜),取数落地后补起最后一次', ()=>{
		const c = ctx(true);
		const applied = [];
		const real = DunJiaMain.prototype.applyExternalPlot;
		c.applyExternalPlot = function(p){ if(!this.state.loading){ applied.push(p); this._queuedExternalPlot = null; return; } return real.call(this, p); };
		c.applyExternalPlot({ id: 1 });
		c.applyExternalPlot({ id: 2 });
		expect(c._queuedExternalPlot).toEqual({ id: 2 });
		c.componentDidUpdate({ fields: null });
		expect(applied).toEqual([]);   // 还在取数:不补
		c.state.loading = false;
		c.componentDidUpdate({ fields: null });
		expect(applied).toEqual([{ id: 2 }]);
		expect(c._queuedExternalPlot).toBe(null);
		c.componentDidUpdate({ fields: null });
		expect(applied.length).toBe(1);
	});
	test('不在取数:照常直接起盘(没有底盘 fields 时静默,与旧行为同)', ()=>{
		const c = ctx(false);
		expect(()=>c.applyExternalPlot({ id: 3 })).not.toThrow();
		expect(c._queuedExternalPlot).toBe(null);
	});
});

describe('奇门页取数时排下的外部起盘:之后发生的载入 / 亲手起盘为准', ()=>{
	const DunJiaMain = require('../DunJiaMain').default;
	const { setGlobalStore } = require('../../../utils/storageutil');
	afterEach(()=>{ setGlobalStore({}); });
	// applied:显式载入的那条(applyCase 写的 appliedCaseCid);缺省 = 就是这条
	const caseOf = (cid, seq, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? cid : applied, currentCase: {
		cid: { value: cid }, updateTime: { value: 't' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
		payload: { value: JSON.stringify({ module: 'qimenzeri', options: { qijuMethod: 'chaibu' } }) } } } });
	function mk(){
		const c = Object.create(DunJiaMain.prototype);
		c.scope = 'qimenzeri';
		c.state = { loading: true, options: {}, faRelatedPeople: [], hasPlotted: false, localFields: null };
		c.props = { fields: null };
		c.setState = function(p){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; };
		c.syncSexFromFields = ()=>{};
		c.applied = [];
		c.applyExternalPlot = function(p){ this.applied.push(p); this._queuedExternalPlot = null; };
		return c;
	}
	test('🔴 排队后载入了一条事盘:排着的点选作废,取数落地后不再补起', ()=>{
		setGlobalStore({ user: { caseApplySeq: 1, currentCase: null } });
		const c = mk();
		c._queuedExternalPlot = { id: 'pick' };
		setGlobalStore(caseOf('qz-1', 2));
		c.componentDidUpdate({ fields: null });   // 载入那一拍(还在取数)
		expect(c._queuedExternalPlot).toBe(null);
		c.state.loading = false;
		c.componentDidUpdate({ fields: null });
		expect(c.applied).toEqual([]);
	});
	test('刚「存为事盘」的那条不是载入:排着的点选照常补起', ()=>{
		setGlobalStore({ user: { caseApplySeq: 1, currentCase: null } });
		const c = mk();
		c._queuedExternalPlot = { id: 'pick' };
		// 存为事盘:当前事盘换成刚存的那条,载入代次与显式载入的 cid 都不变
		setGlobalStore(caseOf('qz-2', 1, null));
		c.componentDidUpdate({ fields: null });
		expect(c._queuedExternalPlot).toEqual({ id: 'pick' });
		c.state.loading = false;
		c.componentDidUpdate({ fields: null });
		expect(c.applied).toEqual([{ id: 'pick' }]);
	});
	test('排队后换了一张命盘:同样作废', ()=>{
		const c = mk();
		c.lastRestoredChartId = 'old|t0';
		c._queuedExternalPlot = { id: 'pick' };
		setGlobalStore({ user: { currentChart: { cid: { value: 'ch-1' }, updateTime: { value: 't1' }, payload: { value: '{}' } } } });
		c.restoreFromCurrentChart();
		expect(c._queuedExternalPlot).toBe(null);
	});
	test('亲手「起局」/「此刻起局」在后:排着的不再补起', ()=>{
		const c = mk();
		c.state.loading = false;
		c.getTimeFieldsFromSelector = ()=>null;
		c._queuedExternalPlot = { id: 'pick' };
		c.clickPlot();
		expect(c._queuedExternalPlot).toBe(null);
		c._queuedExternalPlot = { id: 'pick2' };
		c.clickPlotNow();
		expect(c._queuedExternalPlot).toBe(null);
	});
});

describe('三式紫微四化页的时间算法取本页的', ()=>{
	const SanShiUnitedMain = require('../../sanshi/SanShiUnitedMain').default;
	const mk = (timeAlg, fieldsTimeAlg)=>{
		const c = Object.create(SanShiUnitedMain.prototype);
		c.state = { options: { timeAlg }, localFields: null };
		c.props = { fields: { date: { value: 'd' }, time: { value: 't' }, timeAlg: { value: fieldsTimeAlg } } };
		return c;
	};
	test('🔴 本页直接时间、共享字段真太阳时:四化页按直接时间;反之亦然', ()=>{
		expect(mk(1, 0).getZiweiSihuaFields().timeAlg.value).toBe(1);
		expect(mk(0, 1).getZiweiSihuaFields().timeAlg.value).toBe(0);
		const f = mk(1, 0).getZiweiSihuaFields();
		expect([f.date.value, f.time.value]).toEqual(['d', 't']);
	});
	test('右栏四化页传的是它(源码锚)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../sanshi/SanShiUnitedMain.js'), 'utf8');
		expect(src).toContain('<SanShiZiWeiSihua fields={this.getZiweiSihuaFields()}');
	});
});

describe('奇门「传本设置」弹窗底部说明', ()=>{
	test('只说改后即时重排,不写用户无从对照的「与以往结果相同」', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../DunJiaMain.js'), 'utf8');
		expect(src).toContain("}改后中栏盘与右栏信息即时按所选重排。</div>");
		expect(src).not.toContain('与以往结果相同');
	});
});
