// 自动规则「此版本不会触发」合同:单一判据 ruleWontFire 与引擎真实行为逐条一致(判它不会触发 ⇔ 引擎在任何事件上都不触发 / 不否决);
// 列表把这类规则排到最后、带原因;它们照旧计入存储上限,上限报错点名条数;面板标「此版本不会触发」+ 原因 + 计数提示;
// 任何列规则的工具 / 无头入口必须带出这一标记(源码扫描锁)。
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AUTOMATION_EVENTS, __resetAutomationEventsForTests } from '../aiAgent/automation/events';
import { AUTOMATION_ACTION_TYPES } from '../aiAgent/automation/actions';
import { listRules, saveRule, removeRule, ruleWontFire, orderRulesForDisplay, normalizeRule, RULES_MAX } from '../aiAgent/automation/ruleStore';
import { handleAutomationEvent, vetoDecision, refreshRulesCache, __resetAutomationEngineForTests } from '../aiAgent/automation/engine';
import { setAutomationEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore, putStoreRecord } from '../aiAnalysisStore';
import AutomationRulesPanel from '../../components/aianalysis/AutomationRulesPanel';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const putRaw = (rec)=>putStoreRecord(AI_ANALYSIS_STORES.automationRules, rec, 'rule');

// 结构矩阵:每条 = 一种存档形状;wont = 期望的判据结果(null = 会触发)
const MATRIX = [
	{ id: 'm-ok-saved', event: 'record.saved', actions: [{ type: 'select-source' }], wont: null },
	{ id: 'm-ok-disabled', event: 'record.saved', enabled: false, actions: [{ type: 'select-source' }], wont: null },   // 停用是用户自己停的,不算
	{ id: 'm-ok-deny', event: 'tool.before', actions: [{ type: 'deny' }], wont: null },
	{ id: 'm-ok-mixed', event: 'tool.after', actions: [{ type: 'no-such-action' }, { type: 'archive-idle-conversations', days: 3 }], wont: null },
	{ id: 'm-ok-notify', event: 'app.start', actions: [{ type: 'notify-script' }], wont: null },
	{ id: 'm-ev-unknown', event: 'no.such.event', actions: [{ type: 'select-source' }], wont: 'event-unknown' },
	{ id: 'm-ev-empty', event: '', actions: [{ type: 'select-source' }], wont: 'event-empty' },
	{ id: 'm-ev-missing', actions: [{ type: 'select-source' }], wont: 'event-empty' },
	{ id: 'm-no-actions', event: 'record.saved', actions: [], wont: 'no-actions' },
	{ id: 'm-act-unknown', event: 'record.saved', actions: [{ type: 'no-such-action' }], wont: 'actions-unknown' },
	{ id: 'm-before-nodeny', event: 'tool.before', actions: [{ type: 'select-source' }], wont: 'actions-mismatch' },
	{ id: 'm-deny-async', event: 'turn.end', actions: [{ type: 'deny' }], wont: 'actions-mismatch' },
	{ id: 'm-deny-unknown', event: 'task.done', actions: [{ type: 'deny' }, { type: 'no-such-action' }], wont: 'actions-mismatch' },
];
const rawOf = (m)=>{ const r = { id: m.id, name: m.id, enabled: m.enabled !== false, actions: m.actions, cooldownMs: 0 }; if('event' in m){ r.event = m.event; } return r; };

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetAutomationEventsForTests(); __resetAutomationEngineForTests();
	await clearStore(AI_ANALYSIS_STORES.automationRules);
	await clearStore(AI_ANALYSIS_STORES.agentNotices);
});

describe('判据', ()=>{
	test('🔴 结构矩阵逐条:code 与期望一致;原因只写中文说明、不露原始事件 / 动作名', async ()=>{
		for(const m of MATRIX){ await putRaw(rawOf(m)); }
		const rows = await listRules();
		expect(rows.length).toBe(MATRIX.length);
		for(const m of MATRIX){
			const r = rows.find((x)=>x.id === m.id);
			expect([m.id, r.wontFire ? r.wontFire.code : null]).toEqual([m.id, m.wont]);
			if(r.wontFire){
				expect(r.wontFire.reason).toMatch(/[一-龥]/);
				expect(r.wontFire.reason).not.toMatch(/no\.such|no-such|record\.saved|tool\.before|select-source/);
			}else{
				expect(Object.prototype.hasOwnProperty.call(r, 'wontFire')).toBe(false);   // 会触发的规则不多一个键
			}
		}
	});

	test('🔴 判据 ⇔ 引擎真实行为:判「不会触发」的规则在任何事件上都不触发、不否决;判会触发的(启用时)至少在一个事件上触发或否决', async ()=>{
		setAutomationEnabled(true);
		const ok = async ()=>({ ok: true });
		const deps = { selectSource: async ()=>{}, runBrief: async ()=>({}), archiveIdleConversations: async ()=>0, notifyScript: async ()=>({ ran: true, exit: 0 }), exportReportDocx: ok };
		let now = 1700000000000;
		for(const m of MATRIX){
			await clearStore(AI_ANALYSIS_STORES.automationRules);
			__resetAutomationEngineForTests();
			setAutomationEnabled(true);
			await putRaw({ ...rawOf(m), enabled: true });   // 判据不看启停:按启用跑引擎
			await refreshRulesCache();
			let fires = false;
			for(const ev of AUTOMATION_EVENTS.concat(['no.such.event', ''])){
				now += 5000;
				const detail = { event: ev, payload: { cid: 'local-1', instanceId: 'inst-1', toolName: 'create_chart_record' }, at: new Date(now).toISOString() };
				if(ev === 'tool.before'){
					if(vetoDecision(detail)){ fires = true; }
					continue;
				}
				const out = await handleAutomationEvent(detail, { deps, now });
				if(out.fired && out.fired.indexOf(m.id) >= 0){ fires = true; }
			}
			const { wontFire } = (await listRules())[0];
			expect([m.id, fires]).toEqual([m.id, !wontFire]);
		}
	});

	test('🔴 列表序:会触发的在前(保持库里原顺序),不会触发的排到最后(稳定分区)', async ()=>{
		// 键序:a-* 在前;不会触发的故意用排在前面的键
		await putRaw(rawOf({ id: 'a1-orphan', event: 'gone.event', actions: [{ type: 'select-source' }] }));
		await putRaw(rawOf({ id: 'a2-ok', event: 'record.saved', actions: [{ type: 'select-source' }] }));
		await putRaw(rawOf({ id: 'a3-unknown', event: 'record.saved', actions: [{ type: 'gone-action' }] }));
		await putRaw(rawOf({ id: 'a4-ok', event: 'app.start', actions: [{ type: 'notify-script' }] }));
		const ids = (await listRules()).map((r)=>r.id);
		expect(ids).toEqual(['a2-ok', 'a4-ok', 'a1-orphan', 'a3-unknown']);
		expect(orderRulesForDisplay([{ id: 'x', wontFire: { code: 'no-actions' } }, { id: 'y' }]).map((r)=>r.id)).toEqual(['y', 'x']);
		expect(ruleWontFire(normalizeRule({ event: 'record.saved', actions: [{ type: AUTOMATION_ACTION_TYPES[0] }] }))).toBe(null);
	});

	test('🔴 上限是存储上限:不会触发的规则照算;满额时报错点名其中几条不会触发', async ()=>{
		await putRaw(rawOf({ id: 'z-old1', event: 'gone.event', actions: [{ type: 'select-source' }] }));
		await putRaw(rawOf({ id: 'z-old2', event: 'record.saved', actions: [{ type: 'gone-action' }] }));
		for(let i = 0; i < RULES_MAX - 2; i++){ await saveRule({ id: `r${String(i).padStart(2, '0')}`, name: `规则${i}`, event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 0 }); }
		expect((await listRules()).length).toBe(RULES_MAX);
		await expect(saveRule({ id: 'r-over', name: '多一条', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }] })).rejects.toThrow(`规则数已达上限 ${RULES_MAX}(其中 2 条此版本不会触发,排在列表最后,可删掉腾出位置)`);
		await removeRule('z-old1');
		await expect(saveRule({ id: 'r-over', name: '多一条', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }] })).resolves.toBeTruthy();
		// 全是会触发的规则时报错不带括注
		await removeRule('z-old2');
		await saveRule({ id: 'r-fill', name: '补满', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }] });
		await expect(saveRule({ id: 'r-over2', name: '再多一条', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }] })).rejects.toThrow(new RegExp(`^规则数已达上限 ${RULES_MAX}$`));
	});
});

describe('面板', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

	test('🔴 不会触发的排最后、标「此版本不会触发」+ 原因;事件没有的只能删,动作坏的可编辑不可启停;计数提示;启用计数不算它们', async ()=>{
		await putRaw(rawOf({ id: 'p1-orphan', event: 'gone.event', actions: [{ type: 'select-source' }] }));
		await putRaw(rawOf({ id: 'p2-unknown', event: 'record.saved', actions: [{ type: 'gone-action' }] }));
		await putRaw(rawOf({ id: 'p3-ok', event: 'record.saved', actions: [{ type: 'select-source' }] }));
		const statuses = [];
		await act(async ()=>{ ReactDOM.render(<AutomationRulesPanel onStatus={(st)=>statuses.push(st)} />, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		const rows = Array.from(host.querySelectorAll('.ant-table-row'));
		expect(rows.map((r)=>r.getAttribute('data-rule-row'))).toEqual(['p3-ok', 'p1-orphan', 'p2-unknown']);
		expect(rows[0].querySelector('[data-rule-wontfire]')).toBe(null);
		expect(rows.slice(1).map((r)=>r.querySelector('[data-rule-wontfire]').textContent)).toEqual(['此版本不会触发', '此版本不会触发']);
		expect(rows.slice(1).map((r)=>r.querySelector('[data-rule-wontfire]').getAttribute('data-rule-wontfire'))).toEqual(['event-unknown', 'actions-unknown']);
		expect(rows.slice(1).map((r)=>r.querySelector('[data-rule-wontfire-reason="1"]').textContent)).toEqual(['触发事件此版本没有(旧版留下的规则)', '动作此版本没有(旧版留下的规则)']);
		expect([rows[1].querySelector('[data-rule-edit]').disabled, rows[1].querySelector('[data-rule-toggle]').disabled, rows[1].querySelector('[data-rule-delete]').disabled]).toEqual([true, true, false]);
		expect([rows[2].querySelector('[data-rule-edit]').disabled, rows[2].querySelector('[data-rule-toggle]').disabled, rows[2].querySelector('[data-rule-delete]').disabled]).toEqual([false, true, false]);
		const hint = host.querySelector('[data-rule-wontfire-hint="1"]');
		expect(hint && hint.textContent).toBe(`有 2 条此版本不会触发的规则(排在最后,原因见各行);它们仍占 ${RULES_MAX} 条上限里的名额,可删`);
		expect(statuses[statuses.length - 1].text).toBe('关 · 3 条待用');
		// 编辑动作坏的那条:动作初值落到该事件第一个可选动作,不把裸键塞进下拉
		act(()=>{ rows[2].querySelector('[data-rule-edit]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		await flush();
		const modal = document.querySelector('[data-rule-modal="1"]');
		expect(modal).toBeTruthy();
		expect(modal.textContent).not.toContain('gone-action');
		expect(modal.querySelector('[data-rule-action="1"]').textContent).toContain('把这个档设为当前分析源');
	});

	test('全是会触发的规则时不出计数提示', async ()=>{
		await putRaw(rawOf({ id: 'q-ok', event: 'record.saved', actions: [{ type: 'select-source' }] }));
		await act(async ()=>{ ReactDOM.render(<AutomationRulesPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		expect(host.querySelector('.ant-table-row')).toBeTruthy();
		expect(host.querySelector('[data-rule-wontfire-hint="1"]')).toBe(null);
	});
});

describe('源码锁', ()=>{
	const ROOT = path.resolve(__dirname, '..', '..', '..');
	function walk(dir, out){
		if(!fs.existsSync(dir)){ return out; }
		for(const n of fs.readdirSync(dir)){
			if(n === 'node_modules' || n === '__tests__' || n === 'test' || n === 'dist'){ continue; }
			const p = path.join(dir, n);
			const st = fs.statSync(p);
			if(st.isDirectory()){ walk(p, out); }else if(/\.js$/.test(n)){ out.push(p); }
		}
		return out;
	}
	test('🔴 工具 / 无头入口凡读规则列表的,必须带出 wontFire(新加「列规则」工具自动受约束)', ()=>{
		const files = walk(path.join(ROOT, 'src', 'utils', 'aiTools'), []).concat(walk(path.join(ROOT, 'headless'), []));
		expect(files.length).toBeGreaterThan(20);
		const readers = files.filter((f)=>/\blistRules\s*\(|automation\/ruleStore|AI_ANALYSIS_STORES\.automationRules/.test(fs.readFileSync(f, 'utf8')));
		const missing = readers.filter((f)=>fs.readFileSync(f, 'utf8').indexOf('wontFire') < 0).map((f)=>path.relative(ROOT, f));
		expect(missing).toEqual([]);
	});
	test('手册里的上限数字与存储常量同源', ()=>{
		const doc = fs.readFileSync(path.join(ROOT, 'src', 'components', 'help', 'AIAnalysisHelpDoc.js'), 'utf8');
		expect(doc).toContain(`最多存 ${RULES_MAX} 条`);
		expect(doc).toContain(`照样占 ${RULES_MAX} 条的名额`);
	});
});
