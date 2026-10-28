// 全量恢复:预览与执行同一个计划(planUnifiedRestore)——手改包矩阵下预览行与实际写入一一对应;
// 校验结果「来自更新版本」与「有部分损坏」可同时提示;回收站合并按字符串比 cid;
// 当前命盘被删 / 合并进回收站 → 盘留在屏幕上、脱离记录(四个入口同一函数);事盘编辑抽屉没带 record 时什么都不做。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import fs from 'fs';
import path from 'path';
import {
	buildUnifiedBackupManifest, validateUnifiedBackup, previewUnifiedRestore, restoreUnifiedBackup, planUnifiedRestore, UNIFIED_BACKUP_VERSION,
} from '../unifiedBackup';
import { upsertLocalChart, listLocalCharts, listLocalChartsTrash } from '../localcharts';
import { buildManifestChecksums } from '../backupChecksum';
import { restoreCheckNotes } from '../../components/user/unifiedRestoreFlow';

const SRC = path.resolve(__dirname, '../..');
const row = (rows, k)=>rows.find((r)=>r.key === k);

beforeEach(()=>{ window.localStorage.clear(); });

function seedAndBuild(){
	upsertLocalChart({ cid: 'p-1', name: '甲', birth: '1990-01-01 08:00:00', zone: '+08:00' });
	window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
	const m = buildUnifiedBackupManifest();
	m.checksums = buildManifestChecksums(m);   // 与导出 / 自动备份同一份校验和
	return m;
}

describe('预览 ≡ 执行', ()=>{
	it('🔴 校验和不符的命盘段:预览写「将跳过」(不列新增条数),执行同样整段跳过', async ()=>{
		const m = seedAndBuild();
		m.charts = { ...m.charts, charts: [...m.charts.charts, { cid: 'evil', name: '手改', birth: '2000-01-01 00:00:00' }] };   // 改了内容、校验和没跟着改
		window.localStorage.clear();
		const plan = planUnifiedRestore(m, {});
		expect(plan.badSet.has('charts')).toBe(true);
		expect(plan.effective.charts).toBe(null);
		const rows = previewUnifiedRestore(m);
		expect(row(rows, 'charts').detail).toContain('将跳过');
		expect(row(rows, 'charts').detail).not.toContain('新增');
		expect(rows.filter((r)=>r.key === 'charts').length).toBe(1);   // 不再另列一行「新增 N 条」
		const res = await restoreUnifiedBackup(m);
		expect(row(res, 'charts')).toMatchObject({ ok: false });
		expect(listLocalCharts().length).toBe(0);
		// 预览列了的段 / 键,结果里都有对应的一行
		const sectionKeys = rows.map((r)=>r.key).filter((k)=>k === 'charts' || k === 'cases' || `${k}`.indexOf('raw.') === 0 || `${k}`.indexOf('trash') === 0);
		sectionKeys.forEach((k)=>expect(row(res, k)).toBeTruthy());
	});

	it('校验和不符的单把设置键:预览与执行都跳过这一键', async ()=>{
		const m = seedAndBuild();
		m.raw = { ...m.raw, 'horosa.liuyao.settings.v1': '{"a":2}' };
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
		const rows = previewUnifiedRestore(m);
		expect(row(rows, 'raw.horosa.liuyao.settings.v1').detail).toContain('将跳过');
		expect(row(rows, 'horosa.liuyao.settings.v1')).toBeUndefined();
		await restoreUnifiedBackup(m);
		expect(window.localStorage.getItem('horosa.liuyao.settings.v1')).toBe('{"a":1}');
	});
});

describe('校验结果两条可同时成立', ()=>{
	it('🔴 更新版本写的包同时有坏段:reasons 两条都在,界面两条都提示', ()=>{
		const m = seedAndBuild();
		m.version = UNIFIED_BACKUP_VERSION + 1;
		m.charts = { ...m.charts, charts: [] };
		const v = validateUnifiedBackup(m);
		expect(v.ok).toBe(true);
		expect(v.reasons).toEqual(['newer-version', 'checksum-bad']);
		expect(v.reason).toBe('newer-version');
		expect(v.badSections).toContain('charts');
		const notes = restoreCheckNotes(v);
		expect(notes.length).toBe(2);
		expect(notes[1]).toContain('校验和不符');
	});
	it('正常包 reasons 为空', ()=>{
		const v = validateUnifiedBackup(seedAndBuild());
		expect(v.reasons).toEqual([]);
		expect(v.reason).toBe(null);
	});
});

describe('回收站合并按字符串比 cid', ()=>{
	it('本机回收站里 12(数字)与包里 "12" 是同一条,只留一份', async ()=>{
		const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
		window.localStorage.setItem('horosa.localCharts.trash.v1', JSON.stringify([{ cid: 12, name: '本机', birth: '1990-01-01 00:00:00', deletedAt: now }]));
		const m = { format: 'horosa-unified-backup', version: 2, trash: { charts: JSON.stringify([{ cid: '12', name: '包里', birth: '1990-01-01 00:00:00', deletedAt: now }]) } };
		m.format = buildUnifiedBackupManifest().format;
		await restoreUnifiedBackup(m);
		const t = listLocalChartsTrash().filter((r)=>`${r.cid}` === '12');
		expect(t.length).toBe(1);
		expect(t[0].name).toBe('本机');
	});
});

describe('当前命盘被删 / 被合并 → 脱离记录', ()=>{
	const userModel = require('../../models/user').default;
	const drive = (gen, state)=>{ const puts = []; let st = gen.next(); while(!st.done){ const v = st.value; if(v && v.type){ puts.push(v); } st = gen.next(v && typeof v === 'function' ? undefined : (v && v.__select ? v.__select(state) : undefined)); } return puts; };
	function run(effect, payload, state){
		const gen = userModel.effects[effect].call(userModel, { payload }, {
			put: (a)=>a,
			select: (fn)=>({ __select: fn }),
			call: (fn, ...args)=>fn(...args),
		});
		const puts = [];
		let st = gen.next();
		while(!st.done){
			const v = st.value;
			let feed;
			if(v && v.__select){ feed = v.__select(state); }else if(v && v.type){ puts.push(v); }
			st = gen.next(feed);
		}
		return puts;
	}
	void drive;
	it('🔴 删掉当前命盘:currentChart 与 fields 的 cid 清空,其余字段不动', ()=>{
		upsertLocalChart({ cid: 'cur-1', name: '当前', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		const state = { user: { currentChart: { cid: { value: 'cur-1' }, name: { value: '当前' } } }, astro: { fields: { cid: { value: 'cur-1' }, name: { value: '当前' } } } };
		const puts = run('deleteChart', { cid: 'cur-1' }, state);
		const userSave = puts.find((p)=>p.type === 'save' && p.payload.currentChart);
		expect(userSave.payload.currentChart.cid.value).toBe(null);
		expect(userSave.payload.currentChart.name.value).toBe('当前');
		const astroFields = puts.find((p)=>p.type === 'astro/save' && p.payload.fields);
		expect(astroFields.payload.fields.cid.value).toBe(null);
		expect(astroFields.payload.fields.name.value).toBe('当前');
	});
	it('批量删除 / 合并重复 / 账本撤销同一入口;删的不是当前那条不动', ()=>{
		const state = { user: { currentChart: { cid: { value: 'a' } } }, astro: { fields: { cid: { value: 'a' } } } };
		expect(run('detachCurrentChartIfRemoved', { cids: ['b'] }, state)).toEqual([]);
		expect(run('detachCurrentChartIfRemoved', { cids: ['a'] }, state).length).toBe(3);
		const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
		expect(read('components/user/ChartList.js')).toMatch(/clickBatchRemove[\s\S]{0,1200}user\/detachCurrentChartIfRemoved/);
		expect(read('components/user/ChartList.js')).toMatch(/onRemoved=\{\(cids\)=>\{ this\.props\.dispatch\(\{ type: 'user\/detachCurrentChartIfRemoved'/);
		expect(read('components/common/RecordToolsModals.js')).toMatch(/onRemoved\(\[rest\[i\]\.cid\]\)/);
		expect(read('utils/aiTools/ledger.js')).toMatch(/user\/detachCurrentChartIfRemoved/);
	});
	it('温启快照关联的那条已进回收站:照旧重放、脱离记录', ()=>{
		const { reconcileBootSnapshotWithLibrary } = require('../bootChartRestore');
		const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
		window.localStorage.setItem('horosa.localCharts.trash.v1', JSON.stringify([{ cid: 'gone-1', name: '删了', birth: '1990-01-01 00:00:00', deletedAt: now }]));
		const snap = { at: Date.now(), currentTab: 'astro', record: { cid: 'gone-1', name: '删了', birth: '1990-01-01 00:00:00' }, pinned: false };
		expect(reconcileBootSnapshotWithLibrary(snap).record.cid).toBe(null);
	});
});

describe('事盘编辑抽屉', ()=>{
	it('没带 record 时什么都不做(不再按表单字段拼一份缺键的记录)', ()=>{
		const astroModel = require('../../models/astro').default;
		const warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
		const gen = astroModel.effects.openDrawer.call(astroModel, { payload: { key: 'caseedit' } }, { put: (a)=>a, select: ()=>({ currentCase: { cid: { value: 'x' } } }), call: ()=>undefined });
		const puts = [];
		let st = gen.next();
		let guard = 0;
		while(!st.done && guard < 50){ if(st.value && st.value.type){ puts.push(st.value); } st = gen.next(st.value && st.value.type ? undefined : { drawerVisible: {} }); guard += 1; }
		warn.mockRestore();
		expect(puts.some((p)=>p.type === 'user/setCurrentCase')).toBe(false);
	});
});

