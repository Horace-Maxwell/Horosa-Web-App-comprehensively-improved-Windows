// 五个择日宿主(黄历 / 八字 / 紫微 / 七政 / 印度)存为事盘时取快照:先请内嵌页按此刻所见重存再取本 scope 槽,没有再现场合成;
// 印度 / 七政 判读树预取完重存本槽快照(内嵌页不应答时写宿主三段)。取 / 存快照的单源自带兜底永不抛,
// 宿主 composeAiSnapshot 整体在 try 里、异常回退基底 —— 这几处直调。
jest.mock('../../../utils/moduleAiSnapshot', ()=>{
	const store = {};
	return {
		__store: store,
		loadModuleAISnapshot: jest.fn((name)=>store[name] || null),
		saveModuleAISnapshot: jest.fn(),
		saveModuleAISnapshotLazy: jest.fn(),
	};
});
jest.mock('../../../utils/kentangCaseSave', ()=>({ openKentangCaseDrawer: jest.fn() }));
jest.mock('../zeriCaseRestore', ()=>({
	...jest.requireActual('../zeriCaseRestore'),
	buildZeriCasePayload: jest.fn(()=>({ cfg: {} })),
	plottedFieldsOf: jest.fn(()=>({ date: { value: null } })),
}));

import fs from 'fs';
import path from 'path';
import BaziZeriMain from '../BaziZeriMain';
import IndiaZeriMain from '../IndiaZeriMain';
import ZiweiZeriMain from '../ZiweiZeriMain';
import HuangliZeriMain from '../HuangliZeriMain';
import QizhengZeriMain from '../QizhengZeriMain';

const snap = require('../../../utils/moduleAiSnapshot');
const { openKentangCaseDrawer } = require('../../../utils/kentangCaseSave');

const HOSTS = [
	['bazizeri', BaziZeriMain, 'BaziZeriMain.js'],
	['indiazeri', IndiaZeriMain, 'IndiaZeriMain.js'],
	['ziweizeri', ZiweiZeriMain, 'ZiweiZeriMain.js'],
	['huanglizeri', HuangliZeriMain, 'HuangliZeriMain.js'],
	['qizhengzeri', QizhengZeriMain, 'QizhengZeriMain.js'],
];

function mkHost(Host, composed){
	const h = Object.create(Host.prototype);
	h.props = { dispatch: jest.fn() };
	h.state = {};
	h.huangliRef = null;
	h.buildFields = ()=>({});
	h.composeAiSnapshot = jest.fn(()=>composed);
	return h;
}

describe('择日宿主存为事盘取快照', ()=>{
	beforeEach(()=>{
		jest.clearAllMocks();
		Object.keys(snap.__store).forEach((k)=>{ delete snap.__store[k]; });
	});

	test.each(HOSTS)('%s:槽里有内容 → 直接用槽里的,不再现场合成', (scope, Host)=>{
		snap.__store[scope] = { content: `[${scope}] 槽内容` };
		const h = mkHost(Host, '不该用到');
		h.saveCase();
		expect(snap.loadModuleAISnapshot).toHaveBeenCalledWith(scope);
		expect(h.composeAiSnapshot).not.toHaveBeenCalled();
		expect(openKentangCaseDrawer).toHaveBeenCalledTimes(1);
		const arg = openKentangCaseDrawer.mock.calls[0][0];
		expect(arg.module).toBe(scope);
		expect(arg.payload.snapshot).toBe(`[${scope}] 槽内容`);
	});

	test.each(HOSTS)('%s:槽空 → 现场合成;合成也空 → 空串', (scope, Host)=>{
		const h = mkHost(Host, '三段合成');
		h.saveCase();
		expect(h.composeAiSnapshot).toHaveBeenCalledWith('');
		expect(openKentangCaseDrawer.mock.calls[0][0].payload.snapshot).toBe('三段合成');
		const h2 = mkHost(Host, undefined);
		h2.saveCase();
		expect(openKentangCaseDrawer.mock.calls[1][0].payload.snapshot).toBe('');
	});

	test.each(HOSTS)('%s:没有 dispatch 不存', (scope, Host)=>{
		const h = mkHost(Host, 'x');
		h.props = {};
		h.saveCase();
		expect(openKentangCaseDrawer).not.toHaveBeenCalled();
	});

	test('载入存案后重存本槽快照:凡能合成三段的宿主同一调用(内嵌页不应答时写宿主三段)', ()=>{
		const { refreshZeriSlot } = jest.requireActual('../zeriCaseRestore');
		HOSTS.forEach(([scope, Host])=>{
			const h = mkHost(Host, `${scope}三段`);
			refreshZeriSlot(h, scope);
			expect(snap.saveModuleAISnapshot).toHaveBeenCalledWith(scope, `${scope}三段`);
		});
		const src = fs.readFileSync(path.join(__dirname, '../zeriCaseRestore.js'), 'utf8');
		expect(src).toContain("if(typeof host.composeAiSnapshot === 'function'){\n\t\t\ttry{ refreshZeriSlot(host, scope); }");
		expect(src).not.toContain('resaveZeriSnapshot');
	});

	test.each([['indiazeri', IndiaZeriMain], ['qizhengzeri', QizhengZeriMain]])('%s:判读树预取完成后重存本槽快照', async (scope, Host)=>{
		const h = mkHost(Host, '带判读树的三段');
		h.explainRow = jest.fn(async (r)=>({ row: r }));
		h.prefetchSnapshotExplains([{ start: '2026-01-01 10:00' }]);
		await new Promise((r)=>setTimeout(r, 0));
		expect(h._snapshotExplains).toEqual([{ row: { start: '2026-01-01 10:00' } }]);
		expect(snap.saveModuleAISnapshot).toHaveBeenCalledWith(scope, '带判读树的三段');
	});

	test('源码:取快照 / 重存快照不再外包 try', ()=>{
		HOSTS.forEach(([scope, , file])=>{
			const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
			expect(src).not.toMatch(/try\{\s*const m = loadModuleAISnapshot/);
			expect(src).not.toMatch(/try\{\s*snapshot = this\.composeAiSnapshot/);
			expect(src).not.toMatch(/try\{\s*saveModuleAISnapshot\(/);
			expect(src).toMatch(/const snapshot = zeriCaseSnapshotText\(this, /);
		});
	});
});
