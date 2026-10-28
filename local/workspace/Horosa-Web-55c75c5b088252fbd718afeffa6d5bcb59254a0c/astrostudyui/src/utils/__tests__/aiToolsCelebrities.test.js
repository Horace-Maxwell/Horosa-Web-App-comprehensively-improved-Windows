// 名人库四件工具合同(真离线库:public/astrodata/astrodata-aa.sqlite.gz + 同一份 sql.js):
// 检索(姓名命中排最前 / 星座与年份与评级筛选 / 简介关键词 / 分页)· 分类目录 · 详情(出生资料 / 链接 / 署名 / 同名回候选 / 查无此人)·
// 存成命盘(出生资料原样、来源备注、同名同生辰不重复、撤销移入回收站)· 库加载不了 → 说清。库文件缺席(精简检出)则整组跳过。
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled } from '../aiAgent/prefs';
import { getLocalChart } from '../localcharts';
import * as celebrityDb from '../astrodata/celebrityDb';
import { __setCelebrityDbForTests, normalizeSign, CELEBRITY_ATTRIBUTION } from '../astrodata/celebrityDb';
import Ajv from 'ajv';
import { listTools } from '../aiTools/registry';

const DIR = path.resolve(__dirname, '../../../public/astrodata');
const HAS_DB = fs.existsSync(path.join(DIR, 'astrodata-aa.sqlite.gz'));
// 库文件是入库资产:git 跟踪着它却不在 = 检出坏了,必须红,不许静默整组跳过(只有不在 git 里的源码包才按缺席跳过)
const DB_TRACKED = (()=>{
	try{
		return require('child_process').execFileSync('git', ['ls-files', '--error-unmatch', 'astrodata-aa.sqlite.gz'], { cwd: DIR, stdio: ['ignore', 'pipe', 'ignore'] }).length > 0;
	}catch(e){
		return false;
	}
})();
const maybe = HAS_DB ? describe : describe.skip;
it('名人库文件:git 跟踪着就必须在(检出坏了不许静默跳过整组)', ()=>{
	expect(`${DB_TRACKED && !HAS_DB ? '跟踪着却缺席' : 'ok'}`).toBe('ok');
});
const ctx = ()=>({ origin: 'mcp', requestId: `celeb:${Math.random()}`, dispatch: jest.fn() });

let realDb = null;
async function openReal(){
	if(realDb){ return realDb; }
	const initSqlJs = require(path.join(DIR, 'vendor', 'sql-wasm.js'));
	const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(path.join(DIR, 'vendor', 'sql-wasm.wasm')) });
	realDb = new SQL.Database(new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'astrodata-aa.sqlite.gz')))));
	return realDb;
}

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetWorkspaceBridgeForTests(); __resetLedgerForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true);
});

it('星座归一:代号 / 英文 / 中文全名与简称', ()=>{
	expect(['pis', 'Pisces', '双鱼座', '双鱼'].map(normalizeSign)).toEqual(['pis', 'pis', 'pis', 'pis']);
	expect(normalizeSign('xx')).toBe(null);
});

maybe('真离线库', ()=>{
	beforeAll(async ()=>{ __setCelebrityDbForTests(await openReal()); }, 60000);
	afterAll(()=>{ __setCelebrityDbForTests(null); });

	it('🔴 检索:姓名命中排最前;星座 / 年份段 / 评级 / 只要有出生时间;简介关键词;分页', async ()=>{
		const a = await runTool('search_celebrities', { query: '爱因斯坦', limit: 3 }, ctx());
		expect(a.ok).toBe(true);
		expect(a.data.attribution).toBe(CELEBRITY_ATTRIBUTION);
		expect(a.data.items[0].id).toBe('adb-2939');
		expect(a.data.items[0].sun).toBe('双鱼座');
		const b = await runTool('search_celebrities', { query: '物理学家', scope: 'bio', sun: '双鱼', birthYearFrom: 1870, birthYearTo: 1890, rodden: ['AA'], hasTime: true, limit: 5 }, ctx());
		expect(b.ok).toBe(true);
		expect(b.data.items.map((i)=>i.id)).toContain('adb-2939');
		b.data.items.forEach((i)=>{ expect(i.sun).toBe('双鱼座'); expect(i.rodden).toBe('AA'); expect(i.hasTime).toBe(true); });
		const p1 = await runTool('search_celebrities', { query: 'Paris', limit: 5 }, ctx());
		const p2 = await runTool('search_celebrities', { query: 'Paris', limit: 5, offset: 5 }, ctx());
		expect(p1.data.nextOffset).toBe(5);
		expect(p1.data.items.map((i)=>i.id)).not.toContain(p2.data.items[0].id);
		const bad = await runTool('search_celebrities', { sun: '猫座' }, ctx());
		expect(bad.code).toBe('E_ARGS_INVALID');
	});
	it('🔴 检索词繁简不论(AI 不对着屏幕检索,界面简体也一样):繁体姓名 / 繁体分类关键词与简体同结果', async ()=>{
		const simp = await runTool('search_celebrities', { query: '爱因斯坦', limit: 3 }, ctx());
		const trad = await runTool('search_celebrities', { query: '愛因斯坦', limit: 3 }, ctx());
		expect(trad.ok).toBe(true);
		expect(trad.data.items[0].id).toBe('adb-2939');
		expect(trad.data.total).toBe(simp.data.total);
		const ct = await runTool('list_celebrity_categories', { query: '烏爾姆', limit: 3 }, ctx());
		expect(ct.data.items.some((i)=>/Ulm, GER/.test(i.category))).toBe(true);
	});
	it('🔴 分类目录:中英文关键词;取到的分类全名可原样用于检索(交集)', async ()=>{
		const c = await runTool('list_celebrity_categories', { query: '乌尔姆', limit: 3 }, ctx());
		expect(c.ok).toBe(true);
		const ulm = c.data.items.find((i)=>/Ulm, GER/.test(i.category));
		expect(ulm).toBeTruthy();
		const s = await runTool('search_celebrities', { categories: [ulm.category, '1879 births'], limit: 5 }, ctx());
		expect(s.data.items.map((i)=>i.id)).toContain('adb-2939');
	});
	it('🔴 详情:出生资料 / 评级与来源 / 日月升经度 / 关系与事件 / 原文链接 / 署名;同名多人回候选;查无此人', async ()=>{
		const d = await runTool('get_celebrity', { id: 'adb-2939', maxChars: 300 }, ctx());
		expect(d.ok).toBe(true);
		expect(d.data.person.birthData).toEqual(expect.objectContaining({ birth: '1879-03-14 11:30:00', zone: '+00:40:00', gpsLat: 48.4, gpsLon: 10, hasTime: true }));
		expect(d.data.person.rodden).toBe('AA');
		expect(d.data.person.links.astroDatabank).toContain('astro-databank');
		expect(d.data.person.relations.length).toBeGreaterThan(0);
		expect(d.data.attribution).toContain('Astro-Databank');
		expect((await runTool('get_celebrity', { name: 'Albert Einstein' }, ctx())).data.person.id).toBe('adb-2939');
		expect((await runTool('get_celebrity', { id: 'adb-99999999' }, ctx())).code).toBe('E_CELEBRITY_NOT_FOUND');
		expect((await runTool('get_celebrity', {}, ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('🔴 存成命盘:出生资料原样 + 来源备注 + 分组;同名同生辰不重复;撤销 = 移入回收站;查无此人', async ()=>{
		const r = await runTool('create_celebrity_chart', { id: 'adb-2939', tags: ['物理'] }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.created).toBe(true);
		const rec = getLocalChart(r.data.cid);
		expect(rec).toEqual(expect.objectContaining({ name: 'Albert Einstein', birth: '1879-03-14 11:30:00', zone: '+00:40:00', pos: 'Ulm, Germany', gender: 1 }));
		expect(`${rec.memo}`).toContain('Astro-Databank');
		expect(`${rec.group}`).toContain('Astrodatabank');
		const again = await runTool('create_celebrity_chart', { id: 'adb-2939' }, ctx());
		expect(again.data).toEqual(expect.objectContaining({ created: false, duplicate: true, cid: r.data.cid }));
		const u = await undoAction(r.undo.actionId);
		expect(u.ok).toBe(true);
		expect(getLocalChart(r.data.cid)).toBeFalsy();
		expect((await runTool('create_celebrity_chart', { id: 'adb-99999999' }, ctx())).code).toBe('E_CELEBRITY_NOT_FOUND');
	});
	it('🔴 去重键与页面「加入命盘」同源:页面先导入(cid=adb-…,哪怕改过名)→ AI 不再建第二条;AI 先建 → 页面导入不再建第二条', async ()=>{
		const { upsertLocalChart, listLocalCharts } = require('../localcharts');
		// ① 页面先导入(用户后来改了名字):AI 按名人库编号认出同一人
		upsertLocalChart({ cid: 'adb-2939', name: '爱因斯坦(我改的名)', birth: '1879-03-14 11:30:00', zone: '+00:40:00', lat: '48n24', lon: '9e59', gender: 1 });
		const r1 = await runTool('create_celebrity_chart', { id: 'adb-2939' }, ctx());
		expect(r1.data).toEqual(expect.objectContaining({ created: false, duplicate: true, cid: 'adb-2939' }));
		expect(listLocalCharts({ includeArchived: true }).length).toBe(1);
		// ② AI 先建(随机 cid)→ 页面「加入命盘」消息到达:同名同生辰已在 → 不派发新建
		window.localStorage.clear();
		const r2 = await runTool('create_celebrity_chart', { id: 'adb-2939' }, ctx());
		expect(r2.data.created).toBe(true);
		const AstrodataPage = require('../../components/astrodata/AstrodataPage').default;
		const dispatched = [];
		const page = new AstrodataPage({ dispatch: (a)=>dispatched.push(a) });
		page.iframeRef = { current: null };
		page.onMsg({ data: { type: 'astrodata:importChart', chart: { cid: 'adb-2939', name: 'Albert Einstein', birth: '1879-03-14 11:30:00' } } });
		expect(dispatched).toEqual([]);
		// ③ 同编号已存在 → 原地刷新(派发刷新);全新的人 → 派发新建
		upsertLocalChart({ cid: 'adb-1', name: 'X', birth: '1900-01-01 12:00:00' });
		page.onMsg({ data: { type: 'astrodata:importChart', chart: { cid: 'adb-1', name: 'X', birth: '1900-01-01 12:00:00' } } });
		page.onMsg({ data: { type: 'astrodata:importChart', chart: { cid: 'adb-2', name: 'Y', birth: '1901-01-01 12:00:00' } } });
		expect(dispatched.map((a)=>[a.type, a.payload.cid])).toEqual([['user/refreshLocalChartQuiet', 'adb-1'], ['user/addLocalChartQuiet', 'adb-2']]);
	});
	it('🔴 AI 建档另记名人库编号:改了名字再让 AI 建 → 认得出;页面导入如实回报(已有 / 在归档 / 已更新 / 新加),同编号刷新保留你的名字与分组', async ()=>{
		const { upsertLocalChart, listLocalCharts, getLocalChart, flagLocalChart } = require('../localcharts');
		window.localStorage.clear();
		const r1 = await runTool('create_celebrity_chart', { id: 'adb-2939' }, ctx());
		expect(r1.data.created).toBe(true);
		expect(getLocalChart(r1.data.cid).celebrityId).toBe('adb-2939');
		// 用户把 AI 建的这条改了名 → 同名同生辰对不上了,仍按编号认出
		upsertLocalChart({ ...getLocalChart(r1.data.cid), name: '爱因斯坦(改名)' });
		const r2 = await runTool('create_celebrity_chart', { id: 'adb-2939' }, ctx());
		expect(r2.data).toEqual(expect.objectContaining({ created: false, duplicate: true, cid: r1.data.cid }));
		expect(listLocalCharts({ includeArchived: true }).length).toBe(1);
		const AstrodataPage = require('../../components/astrodata/AstrodataPage').default;
		const replies = [];
		const frameWin = { postMessage: (m)=>replies.push(m) };
		const dispatched = [];
		const page = new AstrodataPage({ dispatch: (a)=>{ dispatched.push(a); return Promise.resolve(true); } });
		page.iframeRef = { current: { contentWindow: frameWin } };
		const flush = ()=>new Promise((r)=>setTimeout(r, 0));
		// ① 页面导入同一人(cid = 编号)→ 已有(AI 建的那条)→ 不派发,回报 exists + 已有的名字
		page.onMsg({ source: frameWin, data: { type: 'astrodata:importChart', chart: { cid: 'adb-2939', celebrityId: 'adb-2939', name: 'Albert Einstein', birth: '1879-03-14 11:30:00' } } });
		await flush();
		expect(dispatched).toEqual([]);
		expect(replies.pop()).toEqual({ type: 'astrodata:importResult', status: 'exists', name: '爱因斯坦(改名)' });
		// ② 在归档里 → 不动,回报 archived
		flagLocalChart(r1.data.cid, 'archived', true);
		page.onMsg({ source: frameWin, data: { type: 'astrodata:importChart', chart: { cid: 'adb-2939', name: 'Albert Einstein', birth: '1879-03-14 11:30:00' } } });
		await flush();
		expect(dispatched).toEqual([]);
		expect(replies.pop()).toEqual(expect.objectContaining({ status: 'archived' }));
		// ③ 同编号已存在(页面导入过、用户改了名字 / 分组 / 性别 / 备注 / 宿度制)→ 只刷新出生时刻与地点,其余一律保留;
		//    走「刷新」effect(不经新建路径、不给旧档补代次标记)
		upsertLocalChart({ cid: 'adb-7', name: '我起的名', birth: '1900-01-01 12:00:00', group: ['我的分组'], gender: 0, memo: '我的备注', doubingSu28: 3 });
		page.onMsg({ source: frameWin, data: { type: 'astrodata:importChart', chart: { cid: 'adb-7', celebrityId: 'adb-7', name: 'Seven', birth: '1900-01-01 13:00:00', zone: '+01:00', pos: 'X', gender: 1, doubingSu28: 0, memo: '出生时辰未知', isPub: 0, creator: 'local', group: ['Astrodatabank', 'AA'] } } });
		await flush();
		expect(dispatched.length).toBe(1);
		expect(dispatched[0].type).toBe('user/refreshLocalChartQuiet');
		expect(dispatched[0].payload).toEqual({ cid: 'adb-7', celebrityId: 'adb-7', birth: '1900-01-01 13:00:00', zone: '+01:00', pos: 'X' });
		expect(replies.pop()).toEqual(expect.objectContaining({ status: 'refreshed', name: '我起的名' }));
		// 刷新 effect 真落库:出生数据换新,其余字段与代次标记原样
		const userModel = require('../../models/user').default;
		const gen = userModel.effects.refreshLocalChartQuiet.call(userModel, { payload: dispatched[0].payload }, { put: (a)=>a });
		let st = gen.next(); while(!st.done){ st = gen.next(); }
		expect(st.value).toBe('persisted');
		const after = getLocalChart('adb-7');
		expect(after).toEqual(expect.objectContaining({ name: '我起的名', birth: '1900-01-01 13:00:00', zone: '+01:00', gender: 0, memo: '我的备注', doubingSu28: 3 }));
		expect(require('../localRecordStore').parseGroupTags(after.group)).toEqual(['我的分组']);
		expect(after.fieldsCaptureGen).toBeUndefined();
		expect(after.ziweiSettingsGen).toBeUndefined();
		// ④ 全新的人 → 派发新建,回报 imported;存储失败(effect 回 false)→ 回报 failed
		page.onMsg({ source: frameWin, data: { type: 'astrodata:importChart', chart: { cid: 'adb-8', name: 'Eight', birth: '1901-01-01 12:00:00' } } });
		await flush();
		expect(replies.pop()).toEqual(expect.objectContaining({ status: 'imported', name: 'Eight' }));
		const failing = new AstrodataPage({ dispatch: ()=>Promise.resolve(false) });
		failing.iframeRef = { current: { contentWindow: frameWin } };
		failing.onMsg({ source: frameWin, data: { type: 'astrodata:importChart', chart: { cid: 'adb-9', name: 'Nine', birth: '1902-01-01 12:00:00' } } });
		await flush();
		expect(replies.pop()).toEqual(expect.objectContaining({ status: 'failed' }));
	});
	it('名人库页:导入带 celebrityId,按宿主回报提示(宿主不回话时按原样提示「已加入」)', ()=>{
		const html = require('fs').readFileSync(require('path').resolve(__dirname, '../../../public/astrodata/index.html'), 'utf8');
		expect(html).toContain('const chart={cid:r.cid,celebrityId:r.cid,');
		expect(html).toContain("d.type!=='astrodata:importResult'");
		expect(html).not.toContain("window.parent.postMessage({type:'astrodata:importChart',chart},'*');toast(T().imported);");
		for (const k of ['impExists', 'impArchived', 'impRefreshed', 'impFailed']) {
			expect(html.split(`${k}:`).length - 1).toBe(2);   // 中英两份
		}
	});
});

it('🔴 检索回包带署名(与详情同一份常量),且合自己声明的 outputSchema(attribution 必带)', async ()=>{
	const spy = jest.spyOn(celebrityDb, 'searchCelebrities').mockResolvedValue({ total: 1, offset: 0, limit: 10, nextOffset: null, items: [{ id: 'adb-1', name: 'Test Person', born: '1900-01-01 12:00', bio: '简介摘要' }] });
	try{
		const r = await runTool('search_celebrities', { query: 'test' }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.attribution).toBe(CELEBRITY_ATTRIBUTION);
		expect(r.data.attribution).toContain('Astro-Databank');
		const def = listTools().find((d)=>d.name === 'search_celebrities');
		expect(def.outputSchema.required).toContain('attribution');
		const v = new Ajv({ allErrors: true, strict: false }).compile(def.outputSchema);
		expect(v(r.data)).toBe(true);
		expect(v({ ...r.data, attribution: undefined })).toBe(false);
	}finally{ spy.mockRestore(); }
});

it('库加载不了 → E_CELEBRITY_DB_UNAVAILABLE(说清,不抛)', async ()=>{
	__setCelebrityDbForTests({ prepare(){ throw new Error('库坏了'); } });
	const r = await runTool('search_celebrities', { query: 'x' }, ctx());
	expect(r.code).toBe('E_CELEBRITY_DB_UNAVAILABLE');
	__setCelebrityDbForTests(null);
});
