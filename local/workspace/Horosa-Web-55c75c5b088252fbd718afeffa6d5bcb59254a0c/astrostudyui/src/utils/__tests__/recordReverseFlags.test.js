// 反向旗标星标 / 置顶 / 标签直接双向(可撤销);解除关联 / 取消归档 / 回收站恢复走提案(采纳才落库、冲突不落库、可撤销采纳)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests, undoAction } from '../aiTools/ledger';
import { getLocalChart, upsertLocalChart, removeLocalChart, listLocalChartsTrash } from '../localcharts';
import { acceptProposal, revertProposal, getProposal } from '../aiAgent/proposals';
import { setAgentEnabled } from '../aiAgent/prefs';

const ctx = ()=>({ origin: 'in-app', requestId: 'rev', dispatch: jest.fn(), ui: { selectSource: jest.fn(), refreshSources: jest.fn() } });
const mk = (name)=>upsertLocalChart({ name, birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 1 }).cid;

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
});

describe('直接双向', ()=>{
	it('星标:加 → 取消;取消可撤销;本来没有星标时取消 = 无变化', async ()=>{
		const cid = mk('甲');
		expect((await runTool('star_record', { recordId: cid }, ctx())).ok).toBe(true);
		expect(getLocalChart(cid).starred).toBe(true);
		const off = await runTool('star_record', { recordId: cid, cancel: true }, ctx());
		expect(off.data.changed).toBe(true);
		expect(!!getLocalChart(cid).starred).toBe(false);
		expect((await runTool('star_record', { recordId: cid, cancel: true }, ctx())).data.changed).toBe(false);
		expect((await undoAction(off.undo.actionId)).ok).toBe(true);
		expect(getLocalChart(cid).starred).toBe(true);
	});
	it('置顶:none 取消置顶', async ()=>{
		const cid = mk('乙');
		await runTool('pin_record', { recordId: cid }, ctx());
		expect(getLocalChart(cid).pinTier).toBe(1);
		const r = await runTool('pin_record', { recordId: cid, position: 'none' }, ctx());
		expect(r.ok).toBe(true);
		expect(getLocalChart(cid).pinTier || 0).toBe(0);
	});
	it('标签:remove 只摘这一个,其余不动;没有这个标签 = 无变化', async ()=>{
		const cid = mk('丙');
		await runTool('add_record_tag', { recordId: cid, tag: '客户' }, ctx());
		await runTool('add_record_tag', { recordId: cid, tag: '家人' }, ctx());
		const r = await runTool('add_record_tag', { recordId: cid, tag: '客户', remove: true }, ctx());
		expect(r.data.tags).toEqual(['家人']);
		expect((await runTool('add_record_tag', { recordId: cid, tag: '客户', remove: true }, ctx())).data.changed).toBe(false);
	});
});

describe('走提案', ()=>{
	it('取消归档:提案前不动档案;采纳才取消;撤销采纳回到已归档', async ()=>{
		const cid = mk('丁');
		upsertLocalChart({ cid, archived: true });
		const { flagLocalChart } = require('../localcharts');
		flagLocalChart(cid, 'archived', true);
		const r = await runTool('propose_record_archive', { recordId: cid, cancel: true }, ctx());
		expect(r.data.status).toBe('pending');
		expect(getLocalChart(cid).archived).toBe(true);
		expect(acceptProposal(r.data.proposalId).ok).toBe(true);
		expect(!!getLocalChart(cid).archived).toBe(false);
		expect(revertProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).archived).toBe(true);
	});
	it('解除关联:两边的关系边一起摘;采纳前对方又被改过 = 冲突', async ()=>{
		const a = mk('戊'); const b = mk('己');
		expect((await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'friend' }, ctx())).ok).toBe(true);
		const r = await runTool('propose_record_unlink', { recordId: a, otherRecordId: b }, ctx());
		expect(r.data.status).toBe('pending');
		expect((getLocalChart(a).relations || []).length).toBe(1);
		expect(acceptProposal(r.data.proposalId).ok).toBe(true);
		expect((getLocalChart(a).relations || []).length).toBe(0);
		expect((getLocalChart(b).relations || []).length).toBe(0);
		expect(revertProposal(r.data.proposalId).ok).toBe(true);
		expect((getLocalChart(b).relations || []).length).toBe(1);
		// 没关联时提议 = 无变化
		const c = mk('庚');
		expect((await runTool('propose_record_unlink', { recordId: a, otherRecordId: c }, ctx())).data.status).toBe('unchanged');
	});
	it('回收站恢复:list_records inTrash 列得到;采纳才恢复;撤销采纳放回回收站', async ()=>{
		const cid = mk('辛');
		removeLocalChart(cid);
		expect(getLocalChart(cid)).toBeFalsy();
		const ls = await runTool('list_records', { inTrash: true }, ctx());
		expect(ls.data.items.map((x)=>x.cid)).toContain(cid);
		// 回收站也能翻页:一页装不下时 nextOffset 指向下一页,后面的列得到(拿得到编号才能提「恢复」)
		const more = ['壬', '癸', '子'].map((n)=>{ const id = mk(n); removeLocalChart(id); return id; });
		const all = (await runTool('list_records', { inTrash: true, limit: 50 }, ctx())).data;
		expect(all.items.length).toBeGreaterThanOrEqual(4);
		const p1 = (await runTool('list_records', { inTrash: true, limit: 2 }, ctx())).data;
		expect([p1.items.length, p1.offset, p1.nextOffset, p1.truncated, p1.total]).toEqual([2, 0, 2, true, all.total]);
		const p2 = (await runTool('list_records', { inTrash: true, limit: 2, offset: 2 }, ctx())).data;
		expect(p2.offset).toBe(2);
		expect(p2.items.map((x)=>x.cid)).toEqual(all.items.slice(2, 4).map((x)=>x.cid));
		const last = (await runTool('list_records', { inTrash: true, limit: 2, offset: all.total - 1 }, ctx())).data;
		expect([last.items.length, last.nextOffset, last.truncated]).toEqual([1, null, false]);
		expect(more.every((id)=>all.items.some((x)=>x.cid === id))).toBe(true);
		const r = await runTool('propose_record_recover', { recordId: cid }, ctx());
		expect(r.data.status).toBe('pending');
		expect(getLocalChart(cid)).toBeFalsy();
		expect(acceptProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid)).toBeTruthy();
		expect(getProposal(r.data.proposalId).status).toBe('accepted');
		expect(revertProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid)).toBeFalsy();
		expect(listLocalChartsTrash().some((x)=>x.cid === cid)).toBe(true);
	});
});
