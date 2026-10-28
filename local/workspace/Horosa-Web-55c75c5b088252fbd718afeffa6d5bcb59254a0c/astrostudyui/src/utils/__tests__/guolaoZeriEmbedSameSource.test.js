// 七政择日里内嵌的七政盘:左栏显示什么、盘就按什么算,AI 内容与页面同源,改动不写七政页的本机记忆。
// · 恒星岁差:内嵌盘空档即郑式(不回落七政页记住的岁差),亲手选回「郑式(默认)」能生效;七政页照旧回落本机记忆,左栏显示同一判据。
// · 命主取法 / 行运法 / 童限 / 定童限 / 年界:页面快照按本页显示偏好写;无头复算照旧以本机记忆为底、记录有值者覆盖。
// · 分宫制 / 天星择日各项 / 立命时刻:内嵌盘只改本页;七政页照旧记住。
// · 天星择日双轮数据的罗计 / 月孛取法与本页起盘同源(七政页与择日里内嵌的盘都跟盘:盘上有值按盘上,缺才回落本机值)。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../services/qizheng', () => ({
	fetchKinastroQizheng: jest.fn(), fetchQizhengElection: jest.fn(async () => ({})),
	fetchMoiraQizhengRules: jest.fn(async () => { throw new Error('offline'); }),
}));
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
global.React = React;   // 组件文件按构建期自动注入 React 写 JSX
import request from '../request';
import { fetchQizhengElection } from '../../services/qizheng';
import * as Style from '../../components/guolao/GuoLaoChartStyle';
import { GL_DIGNITY_RESULT } from '../../components/guolao/__tests__/fixtures/guolaoSnapshotInputs';

const GL = require('../../components/guolao/GuoLaoChartMain');
const GuoLaoChartMain = GL.default;
const GuoLaoInput = require('../../components/guolao/GuoLaoInput').default;
const QizhengZeriMain = require('../../components/zeri/QizhengZeriMain').default;
const DateTime = require('../../components/comp/DateTime').default;
const { mergeEmbedPatch } = require('../scopedFieldsSink');

// 七政择日宿主的字段(恒星宿度制 = 4),embedPatch 为内嵌左栏亲手改过的覆盖层
function hostFields(embedPatch){
	const ctx = {
		state: {
			pickText: '2024-03-01 12:00:00',
			geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, pos: '北京' },
			options: { su28Mode: 4, nodeType: 'mean', lilithType: 'mean' },
			embedPatch: embedPatch || {},
		},
	};
	return QizhengZeriMain.prototype.buildFields.call(ctx, false);
}

// 左栏亲手改恒星岁差:内嵌实例(persistPrefs=false)把字段改动交给宿主,宿主并进覆盖层
function pickAyanamsaEmbedded(prevPatch, val){
	const calls = [];
	const inst = Object.create(GuoLaoInput.prototype);
	const dt = { ad: 1, zone: '+08:00', clone(){ return this; } };
	inst.props = { onFieldsChange: (p)=>calls.push(p), persistPrefs: false };
	inst.tmHook = { getValue: ()=>({ value: dt }) };
	inst.onAyanamsaChange(val);
	return mergeEmbedPatch(prevPatch, { guolaoAyanamsa: calls[0].guolaoAyanamsa });
}

// 左栏「恒星岁差」下拉实际显示的那一档(静态渲染取选中项标题)
function shownAyanamsaLabel(fields){
	const orig = console.error;
	console.error = ()=>{};   // 服务端渲染对 useLayoutEffect 的告警与本用例无关
	let html = '';
	try{
		html = renderToStaticMarkup(React.createElement(GuoLaoInput, {
			fields, persistPrefs: false, chartStyle: Style.GUOLAO_CHART_STYLE_MOIRA, engineMode: 'horosa',
			guolaoDisplay: Style.getStoredGuolaoDisplay(), electionOptions: Style.getStoredGuolaoElection(), kinastroOptions: {},
		}));
	}finally{ console.error = orig; }
	const at = html.indexOf('恒星岁差');
	expect(at).toBeGreaterThan(-1);
	const m = html.slice(at).match(/ant-select-selection-item"[^>]*title="([^"]*)"/);
	return m ? m[1] : null;
}

beforeEach(()=>{ window.localStorage.clear(); request.mockReset(); fetchQizhengElection.mockClear(); });

describe('七政择日内嵌盘的恒星岁差只认本页', ()=>{
	test('七政页记住了 Lahiri:内嵌盘初始显示郑式、也按郑式起盘', ()=>{
		Style.setStoredGuolaoAyanamsa('lahiri');
		const f = hostFields();
		expect(Style.resolveGuolaoAyanamsa(f)).toBe('');
		expect(GL.__guolaoFieldsToParamsForTest(f).siderealAyanamsa).toBeUndefined();
		expect(shownAyanamsaLabel(f)).toBe('郑式(默认)');
	});

	test('内嵌盘亲手选 Raman 再选回「郑式(默认)」:盘跟着回郑式,七政页记忆不动', ()=>{
		Style.setStoredGuolaoAyanamsa('lahiri');
		let patch = pickAyanamsaEmbedded({}, 'raman');
		expect(GL.__guolaoFieldsToParamsForTest(hostFields(patch)).siderealAyanamsa).toBe('raman');
		expect(shownAyanamsaLabel(hostFields(patch))).toBe('Raman');
		patch = pickAyanamsaEmbedded(patch, '');
		const f = hostFields(patch);
		expect(GL.__guolaoFieldsToParamsForTest(f).siderealAyanamsa).toBeUndefined();
		expect(shownAyanamsaLabel(f)).toBe('郑式(默认)');
		expect(Style.getStoredGuolaoAyanamsa()).toBe('lahiri');
	});

	test('七政页(字段不带只认本页标记):盘上没选照旧按本机记住的岁差算,左栏显示的就是这一档', ()=>{
		Style.setStoredGuolaoAyanamsa('lahiri');
		const f = { ...hostFields() };
		delete f[Style.GUOLAO_AYANAMSA_PAGE_ONLY_KEY];
		expect(GL.__guolaoFieldsToParamsForTest(f).siderealAyanamsa).toBe('lahiri');
		expect(Style.resolveGuolaoAyanamsa(f)).toBe('lahiri');
		expect(shownAyanamsaLabel(f)).toBe('随本机（Lahiri / Chitrapaksha）');	// 盘上空档时左栏标明「随本机」并带出档名
		// 盘上选过的按盘上的
		expect(GL.__guolaoFieldsToParamsForTest({ ...f, guolaoAyanamsa: { value: 'raman' } }).siderealAyanamsa).toBe('raman');
		// 本机没记过:郑式(零回归)
		Style.setStoredGuolaoAyanamsa('');
		expect(GL.__guolaoFieldsToParamsForTest(f).siderealAyanamsa).toBeUndefined();
		expect(shownAyanamsaLabel(f)).toBe('郑式(默认)');
	});
});

describe('七政择日的 AI 内容与页面同源(命主取法 / 行运法 / 童限 / 年界)', ()=>{
	function pageSnapshot(display){
		const f = hostFields();
		const inst = Object.create(GuoLaoChartMain.prototype);
		inst.props = { techniqueScope: 'qizhengzeri', fields: f, planetDisplay: null };
		inst.state = { chartObj: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)), moiraRules: null, guolaoDisplay: display };
		const evt = { detail: { module: 'qizhengzeri' } };
		inst.handleSnapshotRefreshRequest(evt);
		return evt.detail.snapshotText || '';
	}

	test('本页左栏改成度主 / 洞微大限(不写七政页记忆):快照按本页写', ()=>{
		Style.setStoredGuolaoDisplay({ ...Style.getStoredGuolaoDisplay(), lifeMasterMode: 'gong', minorLimitType: '' });
		const pageDisplay = Style.setStoredGuolaoDisplay({ ...Style.getStoredGuolaoDisplay(), lifeMasterMode: 'du', minorLimitType: 'dongwei' }, { persist: false });
		const text = pageSnapshot(pageDisplay);
		expect(text).toContain('命主取法：度主；行运法：洞微大限');
	});

	test('本页没改:与页面缺省一致(古度限度法),不再写死成小限', ()=>{
		const text = pageSnapshot(Style.getStoredGuolaoDisplay());
		expect(text).toContain('命主取法：宫主；行运法：古度限度法');
	});

	test('无头复算(挂载按记录):照旧以本机记忆为底、记录有值者覆盖', async ()=>{
		request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)) }));
		Style.setStoredGuolaoDisplay({ ...Style.getStoredGuolaoDisplay(), lifeMasterMode: 'du', minorLimitType: 'month' });
		const base = { ...hostFields() };
		let text = await GL.buildGuolaoSnapshotForFields(base);
		expect(text).toContain('命主取法：度主；行运法：月限');
		text = await GL.buildGuolaoSnapshotForFields({ ...base, guolaoMinorLimitType: { value: 'gudu' } });
		expect(text).toContain('命主取法：度主；行运法：古度限度法');
	});
});

describe('分宫制 / 天星择日各项 / 立命时刻:择日内嵌实例只改本页', ()=>{
	function mkMain(scope){
		const inst = Object.create(GuoLaoChartMain.prototype);
		inst.props = scope ? { techniqueScope: scope } : {};
		inst.state = { electionOptions: Style.getStoredGuolaoElection(), eleLifeMode: Style.getStoredGuolaoEleLifeMode() };
		inst.setState = function(p){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; };
		return inst;
	}
	function stored(){
		return { ele: window.localStorage.getItem(Style.GUOLAO_ELECTION_KEY), life: window.localStorage.getItem(Style.GUOLAO_ELE_LIFE_MODE_KEY) };
	}

	test('内嵌:本页状态照改,七政页记忆不动;合并以本页现值为底', ()=>{
		Style.setStoredGuolaoElection({ hsys: 'R', plate: 'tian' });
		const before = stored();
		const inst = mkMain('qizhengzeri');
		inst.state.electionOptions = { ...inst.state.electionOptions, plate: 'ren' };   // 本页先前改过的
		inst.onGuolaoElectionChange({ hsys: 'K' });
		inst.onGuolaoElectionChange({ dynMode: 'quick', zuoShanDeg: 30 });
		inst.onEleLifeModeChange('noon');
		expect(stored()).toEqual(before);
		expect(inst.state.electionOptions.hsys).toBe('K');
		expect(inst.state.electionOptions.plate).toBe('ren');
		expect(inst.state.electionOptions.dynMode).toBe('quick');
		expect(inst.state.electionOptions.zuoShanDeg).toBe(30);
		expect(inst.state.eleLifeMode).toBe('noon');
		expect(Style.getStoredGuolaoElection().hsys).toBe('R');
		expect(Style.getStoredGuolaoEleLifeMode()).toBe('sunrise');
	});

	test('七政页:照旧写记忆', ()=>{
		const inst = mkMain();
		inst.onGuolaoElectionChange({ hsys: 'K' });
		inst.onEleLifeModeChange('sunset');
		expect(Style.getStoredGuolaoElection().hsys).toBe('K');
		expect(Style.getStoredGuolaoEleLifeMode()).toBe('sunset');
	});
});

describe('择日里内嵌的盘:天星择日双轮数据的罗计 / 月孛取法与本页起盘同源', ()=>{
	test('七政页记住平交点,内嵌盘按工作台用真交点 / 真远地点:取数按本页', ()=>{
		Style.setStoredGuolaoNodeType('mean');
		Style.setStoredGuolaoLilithType('mean');
		const ctx = { state: { pickText: '2024-03-01 12:00:00', geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9 }, options: { su28Mode: 2, nodeType: 'true', lilithType: 'true' } } };
		const f = QizhengZeriMain.prototype.buildFields.call(ctx, false);
		const tm = new DateTime(); tm.parse('2024/03/02 08:00:00', 'YYYY-MM-DD HH:mm:ss');
		const inst = Object.create(GuoLaoChartMain.prototype);
		inst.props = { techniqueScope: 'qizhengzeri', fields: f };
		inst.state = { chartStyle: Style.GUOLAO_CHART_STYLE_PICK, moiraTransitTime: tm, moiraTransitChartObj: null, eleLifeMode: 'sunrise' };
		inst.electionReqSeq = 0;
		inst.setState = function(p){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; };
		inst.requestElectionData();
		expect(fetchQizhengElection).toHaveBeenCalledTimes(1);
		const values = fetchQizhengElection.mock.calls[0][0];
		expect(values.nodeType).toBe('true');
		expect(values.lilithType).toBe('true');
		// 七政页同样跟盘:盘上是真交点 / 真远地点、本机记的是平 → 择时盘也按盘上的(与主盘、流年盘同一来源)
		fetchQizhengElection.mockClear();
		inst.props = { fields: f };
		inst.requestElectionData();
		const mainValues = fetchQizhengElection.mock.calls[0][0];
		expect(mainValues.nodeType).toBe('true');
		expect(mainValues.lilithType).toBe('true');
	});

	test('七政页三处请求(主盘 / 流年 / 择时)罗计、月孛取同一来源:盘上有值按盘上,盘上缺才回落本机值', ()=>{
		const tm = new DateTime(); tm.parse('2024/03/02 08:00:00', 'YYYY-MM-DD HH:mm:ss');
		const ctx = (o)=>({ state: { pickText: '2024-03-01 12:00:00', geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9 }, options: { su28Mode: 2, ...o } } });
		const elect = (fields)=>{
			fetchQizhengElection.mockClear();
			const inst = Object.create(GuoLaoChartMain.prototype);
			inst.props = { fields };
			inst.state = { chartStyle: Style.GUOLAO_CHART_STYLE_PICK, moiraTransitTime: tm, moiraTransitChartObj: null, eleLifeMode: 'sunrise' };
			inst.electionReqSeq = 0;
			inst.setState = function(p){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; };
			inst.requestElectionData();
			return fetchQizhengElection.mock.calls[0][0];
		};
		const flag = (v)=>(v === 'true' ? 'true' : 'mean');
		const cases = [
			// [本机值, 盘上 nodeType / lilithType(undefined = 盘上缺这一项)]
			['mean', 'true'], ['true', 'mean'], ['true', undefined], ['mean', undefined],
		];
		cases.forEach(([stored, onChart])=>{
			Style.setStoredGuolaoNodeType(stored);
			Style.setStoredGuolaoLilithType(stored);
			const f = QizhengZeriMain.prototype.buildFields.call(ctx({ nodeType: onChart || 'mean', lilithType: onChart || 'mean' }), false);
			if(onChart === undefined){ delete f.guolaoNodeType; delete f.guolaoLilithType; }
			const main = GL.__guolaoFieldsToParamsForTest(f);
			const v = elect(f);
			const expectWant = onChart === undefined ? stored : onChart;
			expect([flag(main.guolaoNodeType), flag(main.guolaoLilithType)]).toEqual([expectWant, expectWant]);
			expect([v.nodeType, v.lilithType]).toEqual([expectWant, expectWant]);
		});
	});
});
