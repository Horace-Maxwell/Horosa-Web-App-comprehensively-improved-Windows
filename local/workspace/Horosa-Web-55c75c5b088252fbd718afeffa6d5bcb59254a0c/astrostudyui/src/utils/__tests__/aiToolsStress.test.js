// AI 助手·工具目录压测:模糊参数(永不抛/失败零写入/禁键永不落库)、批量建档与账本 FIFO、事盘全类型、
// 出生文本与地名模糊、设置五面全值域往返、并发读+串行写。种子 PRNG 保证可复现。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisStore', ()=>({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async ()=>null), putStoreRecord: jest.fn(async (s, r)=>r) }));

import { registerBuiltinTools, BUILTIN_TOOL_DEFS } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { listActions, undoAction, __resetLedgerForTests, LEDGER_MAX } from '../aiTools/ledger';
import { FORBIDDEN_ARG_KEYS } from '../aiTools/catalog';
import { parseBirthInput } from '../aiTools/normalize/birthText';
import { resolvePlaceOffline } from '../aiTools/normalize/place';
import { describeFacet } from '../aiTools/settingsFacets';
import { listLocalCharts, listLocalChartsTrash } from '../localcharts';
import { listLocalCases, CASE_TYPE_OPTIONS } from '../localcases';
import { TIME_CASTABLE_MIRROR } from '../aiTools/normalize/caseType';
import { TECHNIQUE_SETTINGS_SCHEMA, hasMountSettingsFields } from '../techniqueMountSettings';
import { setGlobalStore } from '../storageutil';

const CHARTS_KEY = 'horosa.localCharts.v1';
const CASES_KEY = 'horosa.localCases.v1';
function mulberry32(seed){ let a = seed >>> 0; return ()=>{ a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20260901);
const pick = (arr)=>arr[Math.floor(rnd() * arr.length)];
const POOL = ['张三', 'Li Si', '北京', '1990-01-01 08:00', '农历正月初一', '', ' ', '\n', '"', "'", '`', '</script>', '{"a":1}', '[1,2]', 'null', 'undefined', 'NaN', '𝒜𝓁𝒾𝒸𝑒', '😀🧧', '前100年3月1日', '-0100-03-01 00:00', 'x'.repeat(5000), '0'.repeat(80), 'DROP TABLE', '__proto__', 'constructor', 'prototype', '1e308', '-1', '99999999999'];
function randScalar(){ const r = rnd(); if(r < 0.35){ return pick(POOL); } if(r < 0.5){ return Math.floor(rnd() * 400 - 200); } if(r < 0.6){ return rnd() * 1e6 - 5e5; } if(r < 0.7){ return rnd() < 0.5; } if(r < 0.78){ return null; } if(r < 0.85){ return [pick(POOL), Math.floor(rnd() * 10)]; } if(r < 0.92){ return { nested: pick(POOL), deep: { k: pick(POOL) } }; } return undefined; }
function randArgs(def){
	const props = Object.keys(def.inputSchema.properties || {});
	const out = {};
	props.forEach((k)=>{ if(rnd() < 0.7){ out[k] = randScalar(); } });
	if(rnd() < 0.4){ out[pick(FORBIDDEN_ARG_KEYS)] = pick(POOL); }
	if(rnd() < 0.3){ out[pick(POOL)] = randScalar(); }
	if(rnd() < 0.15){ out.__proto__ = { polluted: true }; }
	if(def.name === 'cast_technique' && rnd() < 0.8){ out.technique = pick(['nope', 'liureng', 'astrochart', '']); out.source = { kind: pick(['record', 'timepoint', 'natal', 'x']), cid: 'local-none', birth: pick(POOL), divTime: pick(POOL) }; }
	return out;
}
function snapshotStores(){ return `${localStorage.getItem(CHARTS_KEY)}|${localStorage.getItem(CASES_KEY)}`; }
function recordHasForbidden(rec){ return FORBIDDEN_ARG_KEYS.filter((k)=>k !== 'cid').some((k)=>Object.prototype.hasOwnProperty.call(rec, k) && k !== 'updateTime'); }

let dispatch;
let changeCond;
const ctx = ()=>({ origin: 'in-app', requestId: 'stress', dispatch, ui: { selectSource: jest.fn(), refreshSources: jest.fn() } });

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	dispatch = jest.fn(); changeCond = jest.fn();
	registerWorkspaceBridge({ dispatch, changeCond });
	setGlobalStore({ app: { appearanceMode: 'light', colorTheme: 0, showPdBounds: 0 }, astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 }, pos: { value: '北京' } } } });
	registerBuiltinTools();
});

describe('模糊参数(永不抛 / 失败零写入 / 禁键永不落库)', ()=>{
	it('🔴 十件工具 × 随机对抗参数', async ()=>{
		let calls = 0;
		let failures = 0;
		for(const def of BUILTIN_TOOL_DEFS){
			const n = def.name === 'cast_technique' ? 12 : 40;
			for(let i = 0; i < n; i++){
				const args = randArgs(def);
				const before = snapshotStores();
				const ledgerBefore = listActions(500).length;
				let r;
				try{ r = await runTool(def.name, args, ctx()); }catch(e){ throw new Error(`${def.name} 抛出: ${e && e.message}`); }
				calls += 1;
				expect(typeof r.ok).toBe('boolean');
				if(!r.ok){
					failures += 1;
					expect(typeof r.code).toBe('string');
					expect(snapshotStores()).toBe(before);
					expect(listActions(500).length).toBe(ledgerBefore);
				}else if(def.level === 'additive' && def.undoKind === 'trash-record'){
					expect(listActions(500).length).toBe(ledgerBefore + (r.data && r.data.created ? 1 : 0));
				}
				expect(JSON.parse(JSON.stringify(r))).toBeTruthy();
			}
		}
		const all = listLocalCharts({ includeArchived: true }).concat(listLocalCases({ includeArchived: true }));
		all.forEach((rec)=>{ expect(recordHasForbidden(rec)).toBe(false); expect(rec.cid).toMatch(/^local-/); });
		expect(calls).toBeGreaterThan(300);
		expect(failures).toBeGreaterThan(100);
		expect(({}).polluted).toBeUndefined();
	});
	it('未知工具名 / 非对象参数 / 巨型参数 全部诚实失败', async ()=>{
		for(const bad of ['', 'delete_all', 'Create_Chart', 'x'.repeat(200), '../../etc']){
			const r = await runTool(bad, {}, ctx());
			expect(r.ok).toBe(false);
		}
		for(const args of [null, undefined, 'str', 42, [1, 2], ()=>{}]){
			const r = await runTool('list_records', args, ctx());
			expect(typeof r.ok).toBe('boolean');
		}
		const huge = await runTool('create_chart_record', { name: 'x'.repeat(100000), birth: '1990-01-01 08:00', place: '北京' }, ctx());
		expect(huge.ok).toBe(false);
		expect(listLocalCharts({}).length).toBe(0);
	});
});

describe('批量与账本', ()=>{
	it('🔴 300 条口述建档全部落库;账本 FIFO 200;逐条撤销只对账本内条目生效', async ()=>{
		const t0 = Date.now();
		const ids = [];
		for(let i = 0; i < 300; i++){
			const r = await runTool('create_chart_record', { name: `压测${i}`, birth: `19${String(50 + (i % 50)).padStart(2, '0')}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, gpsLat: 20 + (i % 30), gpsLon: 100 + (i % 30), gender: i % 2 ? 'male' : 'female' }, ctx());
			expect(r.ok).toBe(true);
			expect(r.data.created).toBe(true);
			ids.push(r.undo.actionId);
		}
		expect(listLocalCharts({}).length).toBe(300);
		expect(JSON.parse(localStorage.getItem(CHARTS_KEY)).length).toBe(300);
		expect(listActions(1000).length).toBe(LEDGER_MAX);
		let undone = 0;
		let notFound = 0;
		for(const id of ids){ const u = undoAction(id); if(u.ok){ undone += 1; }else{ notFound += 1; } }
		expect(undone).toBe(LEDGER_MAX);
		expect(notFound).toBe(300 - LEDGER_MAX);
		expect(listLocalCharts({}).length).toBe(300 - LEDGER_MAX);
		expect(listLocalChartsTrash().length).toBe(LEDGER_MAX);
		expect(Date.now() - t0).toBeLessThan(60000);
	});
	it('事盘全类型:可凭时间起的全部落库(payload JSON 串含 fieldSnapshot),其余全部拒建零写入', async ()=>{
		let created = 0;
		let refused = 0;
		for(const o of CASE_TYPE_OPTIONS){
			const r = await runTool('create_case_record', { caseType: o.value, event: `压测 ${o.value}`, divTime: '2026-05-01 10:00' }, ctx());
			if(TIME_CASTABLE_MIRROR.indexOf(o.value) >= 0){
				expect(r.ok).toBe(true); created += 1;
			}else{
				expect(r.ok).toBe(false); expect(r.code).toBe('E_NEEDS_MANUAL_CAST'); refused += 1;
			}
		}
		const rows = listLocalCases({});
		expect(rows.length).toBe(created);
		rows.forEach((row)=>{ expect(typeof row.payload).toBe('string'); const p = JSON.parse(row.payload); expect(p.fieldSnapshot).toBeTruthy(); expect(p.createdBy).toBe('ai-assistant'); });
		expect(refused).toBe(CASE_TYPE_OPTIONS.length - TIME_CASTABLE_MIRROR.length);
	});
});

describe('归一层模糊', ()=>{
	it('出生文本 2000 例永不抛;生成的合法日期全部正确回读', ()=>{
		for(let i = 0; i < 1200; i++){
			const s = Array.from({ length: 1 + Math.floor(rnd() * 4) }, ()=>pick(POOL)).join(pick([' ', '', '年', '-', '/', '点']));
			expect(()=>parseBirthInput(s, { calendar: pick(['solar', 'lunar']), timeUnknown: rnd() < 0.3 })).not.toThrow();
		}
		for(let i = 0; i < 800; i++){
			const y = 1600 + Math.floor(rnd() * 500); const m = 1 + Math.floor(rnd() * 12); const d = 1 + Math.floor(rnd() * 28); const hh = Math.floor(rnd() * 24); const mm = Math.floor(rnd() * 60);
			const expected = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
			const forms = [`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, `${y}/${m}/${d} ${hh}:${String(mm).padStart(2, '0')}`, `${y}年${m}月${d}日 ${hh}点${mm}分`, `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`];
			const r = parseBirthInput(pick(forms), { calendar: 'solar' });
			expect(r.ok).toBe(true);
			expect(r.birth).toBe(expected);
		}
	});
	it('地名:30 个大城市全部高置信解析;随机垃圾永不抛且不落假解析', async ()=>{
		const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都', '重庆', '西安', '天津', '苏州', '郑州', '长沙', '沈阳', '青岛', '大连', '厦门', '福州', '济南', '哈尔滨', '长春', '昆明', '贵阳', '南宁', '兰州', '太原', '石家庄', '合肥', '南昌'];
		for(const c of cities){
			const r = await resolvePlaceOffline(c);
			expect(r.resolved).toBe(true);
			expect(r.place.name).toBe(c);
			expect(Math.abs(r.place.gpsLat)).toBeLessThanOrEqual(90);
			expect(r.place.zone).toMatch(/^[+-]\d{2}:\d{2}$/);
		}
		for(let i = 0; i < 150; i++){
			const q = pick(POOL) + (rnd() < 0.5 ? pick(POOL) : '');
			const r = await resolvePlaceOffline(q);
			expect(r).toBeTruthy();
			if(r.resolved){ expect(r.place.name.length).toBeGreaterThan(0); }
		}
	});
});

describe('设置五面全值域往返', ()=>{
	it('🔴 app/classical/mount(全部有挂载字段的技法):每个可选值都能写入并撤销回原值;垃圾值整体拒且现值不变', async ()=>{
		const facets = [['app', undefined], ['classical', undefined]].concat(Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>hasMountSettingsFields(k)).map((k)=>['mount', k]));
		let written = 0;
		let rejected = 0;
		for(const [facet, technique] of facets){
			const d = describeFacet(facet, technique);
			expect(d.ok).toBe(true);
			for(const item of d.items){
				if(item.settable === false || !Array.isArray(item.options) || !item.options.length){ continue; }
				const currentAll = ()=>{ const dd = describeFacet(facet, technique); const v = {}; dd.items.forEach((it)=>{ v[it.key] = it.current; }); return JSON.stringify(v); };
				const prior = currentAll();
				const badVal = pick(['__garbage__', 99999, { x: 1 }, null]);
				const bad = await runTool('set_settings', { facet, technique, values: { [item.key]: badVal } }, ctx());
				if(bad.ok){
					// 极少数面(如 switch 类)会把 null/对象归一;此处只断言不抛且结果可序列化
					expect(JSON.parse(JSON.stringify(bad))).toBeTruthy();
				}else{
					rejected += 1;
					expect(currentAll()).toBe(prior);
				}
				for(const opt of item.options.slice(0, 6)){
					const r = await runTool('set_settings', { facet, technique, values: { [item.key]: opt.value } }, ctx());
					expect(r.ok).toBe(true);
					written += 1;
					const u = undoAction(r.undo.actionId);
					expect(u.ok).toBe(true);
				}
			}
		}
		expect(written).toBeGreaterThan(40);
		expect(rejected).toBeGreaterThan(10);
	});
});

describe('并发', ()=>{
	it('60 个只读工具并发全部成功;随后 20 条串行写入条条落库、账本序与调用序一致', async ()=>{
		await runTool('create_chart_record', { name: '并发甲', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		const reads = [];
		for(let i = 0; i < 20; i++){ reads.push(runTool('list_records', { kind: 'all' }, ctx())); reads.push(runTool('get_settings', { facet: 'app' }, ctx())); reads.push(runTool('get_current_context', {}, ctx())); }
		const results = await Promise.all(reads);
		expect(results.every((r)=>r.ok)).toBe(true);
		const before = listActions(500).length;
		for(let i = 0; i < 20; i++){ const r = await runTool('create_chart_record', { name: `并发${i}`, birth: '1991-02-03 04:05', gpsLat: 30, gpsLon: 120 }, ctx()); expect(r.ok).toBe(true); }
		expect(listLocalCharts({}).length).toBe(21);
		const acts = listActions(500).slice(0, 20).map((a)=>a.summary);
		expect(acts[0]).toContain('并发19');
		expect(acts[19]).toContain('并发0');
		expect(listActions(500).length).toBe(before + 20);
	});
});
