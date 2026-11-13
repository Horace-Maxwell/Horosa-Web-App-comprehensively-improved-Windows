// 世俗盘存案补周期表(存案时补算)。此前周期表只在页签打开且算完后才进 state,
// 没开过就存案 → 事盘快照缺「周期表」段,AI 挂载也就没有这一段。
import fs from 'fs';
import path from 'path';

const read = (rel)=>fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');

describe('世俗盘存案前补周期表', ()=>{
	test('壳在存案快照之前先等宿主的 beforeSaveCase', ()=>{
		const shell = read('divination/DivinationChartShell.js');
		const i = shell.indexOf('async saveCase(){');
		expect(i).toBeGreaterThan(0);
		const call = shell.indexOf('pending = this.props.beforeSaveCase(', i);
		const wait = shell.indexOf('await settleWithin(pending);', i);
		const snap = shell.indexOf('this.props.buildAiSnapshot(this.state.chart', i);
		expect(call).toBeGreaterThan(i);
		expect(wait).toBeGreaterThan(call);
		expect(snap).toBeGreaterThan(wait);
	});
	test('存案补算有上限、补算期间再点不重发、宿主卸载后不开抽屉', async ()=>{
		const { settleWithin } = require('../../../utils/moduleSnapshotRefresh');
		jest.useFakeTimers();
		const never = new Promise(()=>{});
		const p = settleWithin(never, 1000);
		jest.advanceTimersByTime(1000);
		await expect(p).resolves.toBe(false);
		jest.useRealTimers();
		await expect(settleWithin(Promise.reject(new Error('x')), 1000)).resolves.toBe(true);
		await expect(settleWithin(null)).resolves.toBe(true);
		const shell = read('divination/DivinationChartShell.js');
		const body = shell.slice(shell.indexOf('async saveCase(){'), shell.indexOf('componentDidMount(){', shell.indexOf('async saveCase(){')));
		expect(body).toContain('if(this._savingCase){');
		expect(body).toContain('if(!this._mounted || saveSeq !== this._saveCaseSeq){');
		expect(body).toMatch(/finally\{\s*if\(saveSeq === this\._saveCaseSeq\)\{ this\._savingCase = false; \}/);
	});
	test('世俗盘按周期表保存的设置补请求,写回 state 后快照照常带上', ()=>{
		const main = read('mundane/MundaneMain.js');
		expect(main).toContain('beforeSaveCase={(chart, fields, extra)=>this.ensureCycleTableText(chart, extra)}');
		expect(main).toContain("if(this.state.cycleTableText && this.state.cycleTableKey === chartRequestKey(chart)){ return; }");
		expect(main).toContain('mundaneCycleRequestFields(settings, { startYear: null, endYear: null })');
		expect(main).toContain('const text = buildMundaneCycleText(result, body);');
		// 快照里取的正是这两个 state 键
		expect(main).toContain('if(st.cycleTableText && st.cycleTableKey === chartRequestKey(chart)){ push(st.cycleTableText.split');
		// 与周期表页签同一套构参(targetDate / targetTime 取盘面)
		const tables = read('mundane/MundaneCycleTables.js');
		expect(tables).toContain('return { ...base, targetDate: base.date, targetTime: base.time || \'12:00:00\', ...fields };');
	});
});

// 导出前同样补算(与存案同一个宿主钩子),否则周期类世俗盘在周期表页签没打开过时,导出缺这一段、存的事盘却有。
describe('导出前补算(prepare 事件)', ()=>{
	const { prepareModuleSnapshot, MODULE_SNAPSHOT_PREPARE_EVENT } = require('../../../utils/moduleSnapshotRefresh');
	test('页面把补算 Promise 推进 pending,导出等它落地再取正文', async ()=>{
		let done = false;
		const handler = (evt)=>{ if(evt.detail.module === 'mundane'){ evt.detail.pending.push(new Promise((r)=>setTimeout(()=>{ done = true; r(); }, 30))); } };
		window.addEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, handler);
		await prepareModuleSnapshot('mundane');
		window.removeEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, handler);
		expect(done).toBe(true);
	});
	test('别的槽 / 没人监听 → 立即返回;补算失败不抛;超时不无限等', async ()=>{
		const handler = (evt)=>{ if(evt.detail.module === 'mundane'){ evt.detail.pending.push(Promise.reject(new Error('x'))); evt.detail.pending.push(new Promise(()=>{})); } };
		window.addEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, handler);
		await expect(prepareModuleSnapshot('qimen')).resolves.toBeUndefined();
		const t0 = Date.now();
		await expect(prepareModuleSnapshot('mundane', 60)).resolves.toBeUndefined();
		expect(Date.now() - t0).toBeLessThan(1000);
		window.removeEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, handler);
	});
	test('壳监听 prepare 事件并推入 beforeSaveCase;导出取正文前先 prepare', ()=>{
		const shell = read('divination/DivinationChartShell.js');
		expect(shell).toContain('window.addEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, this.handleSnapshotPrepareRequest);');
		expect(shell).toContain('window.removeEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, this.handleSnapshotPrepareRequest);');
		expect(shell).toContain('evt.detail.pending.push(this.props.beforeSaveCase(this.state.chart, this.state.fields, this.state.extra));');
		const ext = fs.readFileSync(path.resolve(__dirname, '../../../utils/aiExport/extractors.js'), 'utf8');
		const i = ext.indexOf('export async function extractSimpleModuleContent(');
		expect(ext.indexOf('await prepareModuleSnapshot(moduleName)', i)).toBeGreaterThan(i);
		expect(ext.indexOf('await prepareModuleSnapshot(moduleName)', i)).toBeLessThan(ext.indexOf('requestModuleSnapshotRefresh(moduleName)', i));
	});
});
