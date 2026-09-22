// [挂载自检 F-36·拍板落地] 黄历/八字/紫微/七政/印度五择日宿主加「存为事盘」:ZeriMain 传 dispatch;宿主 saveCase →
// openKentangCaseDrawer(module=本 scope,payload.snapshot=宿主槽快照);事盘源层按 payload.module 认领 payload.snapshot。
import fs from 'fs';
import path from 'path';
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
const store = { map: {} };
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn((name) => store.map[name] || null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
jest.mock('../astroAiSnapshot', () => ({ buildAstroSnapshotContent: jest.fn(() => ''), loadAstroAISnapshot: jest.fn(() => null) }));
jest.mock('../aiAnalysisStore', () => ({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async () => null), putStoreRecord: jest.fn(async (s, r) => r) }));
import { getAnalysisTechniqueContexts } from '../aiAnalysisContext';
import DateTime from '../../components/comp/DateTime';

const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');
const FIVE = { HuangliZeriMain: 'huanglizeri', BaziZeriMain: 'bazizeri', ZiweiZeriMain: 'ziweizeri', QizhengZeriMain: 'qizhengzeri', IndiaZeriMain: 'indiazeri' };

it('🔴 ZeriMain 把 dispatch 传给全部八宿主(此前五宿主不传=存档链根本不存在)', ()=>{
	const zm = read('components/zeri/ZeriMain.js');
	['HuangliZeriMain', 'BaziZeriMain', 'TaiyiZeriMain', 'ZiweiZeriMain', 'LiurengZeriMain', 'SanshiZeriMain', 'QizhengZeriMain', 'IndiaZeriMain'].forEach((h)=>{
		expect(zm).toContain(`<${h} height={childHeight} dispatch={this.props.dispatch} />`);
	});
});

it('🔴 五宿主各有 saveCase:module/caseType=本 scope,快照取本 scope 槽;入口条 onSave 只在有 dispatch 时挂', ()=>{
	Object.keys(FIVE).forEach((h)=>{
		const src = read(`components/zeri/${h}.js`);
		expect(src).toContain('saveCase(){');
		expect(src).toContain("openKentangCaseDrawer({");
		if(h === 'HuangliZeriMain'){
			expect(src).toContain("module: 'huanglizeri',");
			expect(src).toContain("loadModuleAISnapshot('huanglizeri')");
			expect(src).toContain('{this.props.dispatch ? <XQButton onClick={this.saveCase} data-zeri-save="1">存为事盘</XQButton> : null}');
		}else{
			expect(src).toContain(`const ZERI_SCOPE = '${FIVE[h]}';`);
			expect(src).toContain('loadModuleAISnapshot(ZERI_SCOPE)');
			expect(src).toContain('onSave={this.props.dispatch ? this.saveCase : undefined}');
		}
	});
	const entry = read('components/zeri/ZeriHostEntry.js');
	expect(entry).toContain("{typeof onSave === 'function' ? (");
	expect(entry).toContain("{saveLabel || '存为事盘'}");
});

it('🔴 saveCase 实跑(八字宿主原型):dispatch 收到 caseadd 抽屉,record.caseType=bazizeri,payload.module/snapshot=宿主槽内容', ()=>{
	const { default: BaziZeriMain } = require('../../components/zeri/BaziZeriMain');
	store.map.bazizeri = { module: 'bazizeri', content: '[八字]\n甲子…\n\n[择时搜索配置]\n…' };
	const dispatch = jest.fn();
	const dt = new DateTime();
	const t = dt.parse ? dt.parse('2026-05-15 10:00:00', 'YYYY-MM-DD HH:mm:ss') : dt;
	const ctx = {
		props: { dispatch },
		state: { cfg: { a: 1 }, tree: { children: [] }, results: [{ start: '2026-05-15 10:00' }], truncated: false },
		_scanCfg: null, _scanUiTree: null,
		buildFields: ()=>({ date: { value: t }, time: { value: t }, zone: { value: '+08:00' }, lon: { value: '120e00' }, lat: { value: '30n00' }, gender: { value: 1 } }),
		composeAiSnapshot: ()=>'三段',
	};
	BaziZeriMain.prototype.saveCase.call(ctx);
	expect(dispatch).toHaveBeenCalledTimes(1);
	const action = dispatch.mock.calls[0][0];
	expect(action.type).toBe('astro/openDrawer');
	expect(action.payload.key).toBe('caseadd');
	expect(action.payload.record).toMatchObject({ caseType: 'bazizeri', sourceModule: 'bazizeri', divTime: '2026-05-15 10:00:00', zone: '+08:00' });
	expect(action.payload.record.payload).toMatchObject({ module: 'bazizeri', snapshot: store.map.bazizeri.content, zeri: { cfg: { a: 1 }, truncated: false } });
	// 无 dispatch → 静默不动(入口条也不渲染钮)
	BaziZeriMain.prototype.saveCase.call({ ...ctx, props: {} });
	expect(dispatch).toHaveBeenCalledTimes(1);
});

it('🔴 事盘源层:payload.module=bazizeri 的事盘,挂载「八字择日」正文=payload.snapshot(此前无实例可挂)', async ()=>{
	const record = { cid: 'case-bz', caseType: 'bazizeri', divTime: '2026-05-15 10:00:00', zone: '+08:00', lon: '120e00', lat: '30n00', event: '八字择日占断',
		payload: JSON.stringify({ module: 'bazizeri', version: 1, snapshot: '[八字]\n甲子日主\n\n[择时搜索配置]\n时间范围:…' }) };
	const [ctx] = await getAnalysisTechniqueContexts({ id: 'case-bz', sourceType: 'case', record }, ['bazizeri']);
	expect(ctx.status).toBe('ready');
	expect(ctx.content).toContain('甲子日主');
	expect(ctx.content).toContain('[择时搜索配置]');
});
