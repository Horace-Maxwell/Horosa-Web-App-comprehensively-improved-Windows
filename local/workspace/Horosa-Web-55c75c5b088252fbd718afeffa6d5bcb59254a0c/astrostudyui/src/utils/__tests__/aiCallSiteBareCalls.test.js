// AI 分析 / 工具层调用点合同:下面这些被调函数自己保证不抛(函数体整体 try,或只做纯计算 / 纯读取),
// 调用点直接裸调,不再套一层永远走不到的 try/catch。
//   ① 被调方合同:坏存储 / 坏 JSON / 缺 DOM / 存储写不进时照样不抛、返回约定的缺省 —— 这是调用点可以裸调的前提;
//   ② 调用点源码:外壳不在(加回来即红),被调方的调用本身还在(删掉调用也红);
//   ③ 两处重复实现收成单源后的行为:工具名下拉选项、任务时刻短格式。
import fs from 'fs';
import path from 'path';
import { emitAutomationEvent, subscribeAutomationEvents } from '../aiAgent/automation/events';
import { loadModuleAISnapshot, saveModuleAISnapshot, clearModuleAISnapshot } from '../moduleAiSnapshot';
import { mountCalibreSignature } from '../mountCalibreSignature';
import { readContextPolicy, normalizeContextPolicy, CHAT_CONTEXT_POLICY_KEY } from '../aiChatHistory';
import { safeJsonStringifyToStorage } from '../safeStorage';
import { setPersistedThinkingLevel, getPersistedThinkingLevel } from '../aiAnalysisProviders';
import { listActions, LEDGER_KEY, __resetLedgerForTests } from '../aiTools/ledger';
import { loadUiPrefs, saveUiPrefs } from '../aiAnalysisStore';
import { snapshotModelSelection } from '../aiAgent/tasks/modelSnapshot';
import { readBestOfPrefs } from '../../components/aianalysis/chat/BestOfPanel';
import { getSectionGroupsForTechnique } from '../aiExport';
import { isDesktopSaveBridge } from '../aiAnalysisExport';
import { listAnalysisTechniqueOptions, analysisTechniqueLabelMap } from '../aiAnalysisContext';
import { reportBackgroundFailure, __resetBgSinkForTests } from '../aiAgent/bgSink';
import { registerTool, listTools, __resetToolsForTests } from '../aiTools/registry';
import { listToolNameOptions } from '../aiTools';
import { toolLabel } from '../aiTools/labels';
import { formatTaskTime } from '../aiAgent/tasks/scheduler';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = path.join(__dirname, '..', '..');
const read = (rel)=>readSource(path.join(SRC, rel));
const count = (text, re)=>(text.match(new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : `${re.flags}g`)) || []).length;
const occurrences = (text, s)=>text.split(s).length - 1;
// 本机界面偏好键(aiAnalysisStore 内部常量;键名变了这里跟着改)
const UI_PREF_KEY = 'horosa.ai.analysis.ui.v3';

function storageThrows(method){
	return jest.spyOn(Storage.prototype, method).mockImplementation(()=>{ throw new Error(`${method} 不可用`); });
}

beforeEach(()=>{
	jest.restoreAllMocks();
	window.localStorage.clear();
});
afterEach(()=>{ jest.restoreAllMocks(); });

describe('被调方不抛:调用点可以裸调的前提', ()=>{
	it('emitAutomationEvent:订阅者抛错、window 派发抛错都不外泄', ()=>{
		const off = subscribeAutomationEvents(()=>{ throw new Error('订阅者自己坏了'); });
		const spy = jest.spyOn(window, 'dispatchEvent').mockImplementation(()=>{ throw new Error('派发坏了'); });
		let r;
		expect(()=>{ r = emitAutomationEvent('tool.after', { toolName: 'x' }); }).not.toThrow();
		expect(r).toBe(true);
		expect(()=>emitAutomationEvent('turn.end', null)).not.toThrow();
		spy.mockRestore();
		off();
	});

	it('loadModuleAISnapshot:读存储抛错 → 回落内存;没有就是 null', ()=>{
		saveModuleAISnapshot('callsite_probe', '内存里的快照正文', { from: 'test' });
		storageThrows('getItem');
		let got;
		expect(()=>{ got = loadModuleAISnapshot('callsite_probe'); }).not.toThrow();
		expect(got && got.content).toBe('内存里的快照正文');
		expect(loadModuleAISnapshot('callsite_probe_absent')).toBe(null);
		expect(loadModuleAISnapshot('')).toBe(null);
		jest.restoreAllMocks();
		clearModuleAISnapshot('callsite_probe');
	});

	it('mountCalibreSignature:读存储抛错照样给出签名串', ()=>{
		storageThrows('getItem');
		let sig;
		expect(()=>{ sig = mountCalibreSignature(); }).not.toThrow();
		expect(sig).toMatch(/^v1:[0-9a-f]{8}$/);
	});

	it('readContextPolicy:坏 JSON / 数组 / 标量 / 读存储抛错 → 缺省策略', ()=>{
		const dflt = normalizeContextPolicy(null);
		['{坏', '[1,2]', '"str"', '5', 'null'].forEach((raw)=>{
			window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, raw);
			expect(readContextPolicy()).toEqual(dflt);
		});
		storageThrows('getItem');
		expect(readContextPolicy()).toEqual(dflt);
	});

	it('safeJsonStringifyToStorage:循环引用 / 未登记键 / 写存储抛错 → false,不抛', ()=>{
		const cyc = {}; cyc.self = cyc;
		expect(safeJsonStringifyToStorage(LEDGER_KEY, cyc)).toBe(false);
		expect(safeJsonStringifyToStorage('horosa.callsite.unregistered.key', { a: 1 })).toBe(false);
		storageThrows('setItem');
		expect(safeJsonStringifyToStorage(LEDGER_KEY, [])).toBe(false);
	});

	it('setPersistedThinkingLevel:写存储抛错不外泄;读存储抛错回 off', ()=>{
		setPersistedThinkingLevel('high');
		expect(getPersistedThinkingLevel()).toBe('high');
		storageThrows('setItem');
		expect(()=>setPersistedThinkingLevel('low')).not.toThrow();
		jest.restoreAllMocks();
		storageThrows('getItem');
		expect(getPersistedThinkingLevel()).toBe('off');
	});

	it('listActions:账本坏 JSON / 非数组 / 夹空条目与占位 → 只回可见条目', ()=>{
		__resetLedgerForTests();
		window.localStorage.setItem(LEDGER_KEY, '{坏');
		expect(listActions()).toEqual([]);
		window.localStorage.setItem(LEDGER_KEY, '{"a":1}');
		expect(listActions()).toEqual([]);
		window.localStorage.setItem(LEDGER_KEY, JSON.stringify([null, { id: 'p', pending: true }, { id: 'y' }]));
		expect(listActions()).toEqual([{ id: 'y' }]);
		storageThrows('getItem');
		expect(listActions()).toEqual([]);
	});

	it('loadUiPrefs / saveUiPrefs:读写存储抛错、循环引用都不外泄', ()=>{
		jest.spyOn(console, 'warn').mockImplementation(()=>{});
		window.localStorage.setItem(UI_PREF_KEY, '{坏');
		expect(loadUiPrefs()).toEqual({});
		const cyc = {}; cyc.self = cyc;
		expect(()=>saveUiPrefs({ loop: cyc })).not.toThrow();
		storageThrows('setItem');
		expect(()=>saveUiPrefs({ reportSpeedTier: 'fast' })).not.toThrow();
		jest.restoreAllMocks();
		jest.spyOn(console, 'warn').mockImplementation(()=>{});
		storageThrows('getItem');
		expect(loadUiPrefs()).toEqual({});
		expect(()=>saveUiPrefs({ reportPromptCache: true })).not.toThrow();
	});

	it('snapshotModelSelection:显式值优先;界面偏好坏 / 标量 / 读不出 → 空串', ()=>{
		expect(snapshotModelSelection('p::m')).toBe('p::m');
		window.localStorage.setItem(UI_PREF_KEY, JSON.stringify({ modelSelection: 'p1::m1' }));
		expect(snapshotModelSelection()).toBe('p1::m1');
		['5', 'null', '"abc"', '{坏'].forEach((raw)=>{
			window.localStorage.setItem(UI_PREF_KEY, raw);
			expect(snapshotModelSelection()).toBe('');
		});
		storageThrows('getItem');
		expect(snapshotModelSelection()).toBe('');
	});

	it('readBestOfPrefs:bestOf 为真值标量 / 字段不是数组 / 偏好坏 → 缺省形状', ()=>{
		const dflt = { mode: 'models', selections: [], angles: [] };
		[{ chatAssist: { bestOf: true } }, { chatAssist: { bestOf: 'x' } }, { chatAssist: 7 }, 9].forEach((v)=>{
			window.localStorage.setItem(UI_PREF_KEY, JSON.stringify(v));
			expect(readBestOfPrefs()).toEqual(dflt);
		});
		window.localStorage.setItem(UI_PREF_KEY, JSON.stringify({ chatAssist: { bestOf: { mode: 'angles', selections: 'no', angles: ['a', 'b'] } } }));
		expect(readBestOfPrefs()).toEqual({ mode: 'angles', selections: [], angles: ['a', 'b'] });
		storageThrows('getItem');
		expect(readBestOfPrefs()).toEqual(dflt);
	});

	it('listAnalysisTechniqueOptions / analysisTechniqueLabelMap:任意入参都回数组 / 对象', ()=>{
		[undefined, null, {}, { sourceType: 'case' }, { sourceType: 'timepoint' }].forEach((src)=>{
			const list = listAnalysisTechniqueOptions(src);
			expect(Array.isArray(list)).toBe(true);
			expect(list.length).toBeGreaterThan(0);
			list.forEach((o)=>{ expect(typeof o.value).toBe('string'); });
		});
		expect(analysisTechniqueLabelMap(undefined)).toEqual({});
		expect(analysisTechniqueLabelMap('bazi')).toEqual({});
		const m = analysisTechniqueLabelMap([null, 'bazi', 'bazi', '']);
		expect(Object.keys(m)).toEqual(['bazi']);
		expect(typeof m.bazi).toBe('string');
		expect(analysisTechniqueLabelMap(['no_such_key']).no_such_key).toBe('no_such_key');
	});

	it('getSectionGroupsForTechnique:厚技法按段名分组,段少 / 无规则 → null,非字符串段名按字符串比', ()=>{
		const sanshi = ['太乙局', '太乙十精', '奇门盘', '奇门格局', '大六壬', '四课', '三传', '神煞一览', '行年', '概览', '起盘信息', '十二长生', '旺衰', '旬日', '空亡真假', '某个别的段'];
		const groups = getSectionGroupsForTechnique('sanshiunited', sanshi);
		expect(groups.map((g)=>g.title)).toEqual(['太乙', '奇门', '六壬·断卦', '神煞·基础', '其他段']);
		expect(groups[groups.length - 1].items).toEqual(['某个别的段']);
		expect(getSectionGroupsForTechnique('sanshiunited', sanshi.slice(0, 15))).toBe(null);
		expect(getSectionGroupsForTechnique('bazi', sanshi)).toBe(null);
		expect(getSectionGroupsForTechnique('sanshiunited', null)).toBe(null);
		const withNumbers = sanshi.slice(0, 15).concat([12345]);
		const g2 = getSectionGroupsForTechnique('sanshiunited', withNumbers);
		expect(g2[g2.length - 1]).toEqual({ title: '其他段', items: [12345] });
		const india = ['Vimshottari 大运', 'Tajika 年运', 'Shadbala 六力', 'D9 分盘', 'KP 星', 'Raja Yoga 格局', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
		expect(getSectionGroupsForTechnique('indiachart', india).map((g)=>g.title)).toEqual(['大运与年运', '力量与吉凶', '分盘与点位', 'KP 与择时', '格局与其他', '其他段']);
	});

	it('isDesktopSaveBridge:只看壳桥在不在', ()=>{
		const saved = { a: window.__TAURI__, b: window.__TAURI_INTERNALS__ };
		delete window.__TAURI__; delete window.__TAURI_INTERNALS__;
		expect(isDesktopSaveBridge()).toBe(false);
		window.__TAURI_INTERNALS__ = { invoke: ()=>null };
		expect(isDesktopSaveBridge()).toBe(true);
		delete window.__TAURI_INTERNALS__;
		window.__TAURI__ = { core: { invoke: ()=>null } };
		expect(isDesktopSaveBridge()).toBe(true);
		window.__TAURI__ = { core: {} };
		expect(isDesktopSaveBridge()).toBe(false);
		if(saved.a === undefined){ delete window.__TAURI__; }else{ window.__TAURI__ = saved.a; }
		if(saved.b === undefined){ delete window.__TAURI_INTERNALS__; }else{ window.__TAURI_INTERNALS__ = saved.b; }
	});

	it('后台失败留痕与覆盖注册都照常打 warn', ()=>{
		const warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
		__resetBgSinkForTests();
		reportBackgroundFailure('callsite.tag', new Error('后台链坏了'));
		expect(warn.mock.calls.some((c)=>`${c[0]}` === '[horosa-ai:bg] callsite.tag: 后台链坏了')).toBe(true);
		__resetToolsForTests();
		const def = { name: 'callsite_probe_tool', level: 'read', inputSchema: { type: 'object', properties: {} }, run: async ()=>({ ok: true }) };
		registerTool(def);
		registerTool({ ...def });
		expect(warn.mock.calls.some((c)=>`${c[0]}`.indexOf('覆盖重复注册: callsite_probe_tool') >= 0)).toBe(true);
		__resetToolsForTests();
	});
});

describe('收成单源后的行为', ()=>{
	it('listToolNameOptions:每件已注册工具一项,标签 = 中文名(英文名)', ()=>{
		__resetToolsForTests();
		const opts = listToolNameOptions();
		const names = listTools().map((d)=>d.name);
		expect(opts.map((o)=>o.value)).toEqual(names);
		expect(names).toContain('resolve_place');
		opts.forEach((o)=>{ expect(o.label).toBe(`${toolLabel(o.value)}(${o.value})`); });
		expect(opts.find((o)=>o.value === 'resolve_place').label).toBe('解析地名(resolve_place)');
		expect(listToolNameOptions().length).toBe(opts.length);   // 再取一次不重复注册
		__resetToolsForTests();
	});

	it('formatTaskTime:「月-日 时:分」;空 / 读不出 → 空串', ()=>{
		expect(formatTaskTime(null)).toBe('');
		expect(formatTaskTime('')).toBe('');
		expect(formatTaskTime('不是时间')).toBe('');
		expect(formatTaskTime(new Date(2026, 0, 5, 3, 7).toISOString())).toBe('1-05 03:07');
		expect(formatTaskTime(new Date(2026, 10, 23, 14, 30).getTime())).toBe('11-23 14:30');
	});
});

describe('调用点源码:裸调,不套外壳', ()=>{
	it('自动化事件:工具写入后 / 一轮对话结束', ()=>{
		const reg = read('utils/aiTools/registry.js');
		expect(count(reg, /try\s*\{\s*emitAutomationEvent\(/)).toBe(0);
		expect(occurrences(reg, "emitAutomationEvent('tool.after', {")).toBe(1);
		const main = read('components/aianalysis/AIAnalysisMain.js');
		expect(count(main, /try\s*\{\s*emitAutomationEvent\(/)).toBe(0);
		expect(occurrences(main, "emitAutomationEvent('turn.end', {")).toBe(1);
	});

	it('日志行:不判 console 在不在、不套 try', ()=>{
		const reg = read('utils/aiTools/registry.js');
		expect(occurrences(reg, 'typeof console')).toBe(0);
		expect(count(reg, /try\s*\{\s*(if\s*\([^)]*\)\s*\{\s*)?console\.warn/)).toBe(0);
		expect(reg).toContain('console.warn(`[aiTools] 覆盖重复注册: ${name}`);');
		expect(reg).toContain('console.warn(`[aiTools] 账本提交失败,动作 ${actionId}(${def.name})不可撤销`);');
		const sink = read('utils/aiAgent/bgSink.js');
		expect(occurrences(sink, 'typeof console')).toBe(0);
		expect(count(sink, /try\s*\{[^}]*console\.warn/)).toBe(0);
		expect(sink).toContain('console.warn(`[horosa-ai:bg] ${key}: ${entry.message}`);');
		const ctx = read('utils/aiAnalysisContext.js');
		expect(count(ctx, /try\s*\{\s*console\.warn\('\[aiAnalysis\] (ziwei 快照构造为空|astrochart 有 Result 但快照构造为空|技法快照重算失败|技法上下文构造失败)/)).toBe(0);
		['ziwei 快照构造为空', 'astrochart 有 Result 但快照构造为空', '技法快照重算失败', '技法上下文构造失败'].forEach((t)=>{
			expect(occurrences(ctx, `console.warn('[aiAnalysis] ${t}`)).toBe(1);
		});
	});

	it('挂载链:模块快照读取 / 口径签名 / 扫描起点兜底', ()=>{
		const ctx = read('utils/aiAnalysisContext.js');
		expect(count(ctx, /try\s*\{\s*\w+\s*=\s*loadModuleAISnapshot\(/)).toBe(0);
		// 派生盘 / 合盘挂载与其它槽同一入口:先请页面按此刻所见重存再读槽(loadFreshModuleAISnapshot)
		expect(ctx).toContain('const m = loadFreshModuleAISnapshot(name);');
		expect(ctx).toContain('const m = loadFreshModuleAISnapshot(key);');
		expect(ctx).toContain("const mounted = loadFreshModuleAISnapshot('relative');");
		expect(count(ctx, /try\s*\{\s*\w+\s*=\s*mountCalibreSignature\(\)/)).toBe(0);
		expect(occurrences(ctx, 'const calibreSig = mountCalibreSignature();')).toBe(1);
		expect(occurrences(ctx, 'const calibre = mountCalibreSignature();')).toBe(2);
		expect(occurrences(ctx, 'return snapshot.calibreSig === mountCalibreSignature();')).toBe(1);
		expect(occurrences(ctx, 'typeof nowFallback')).toBe(0);
		expect(occurrences(ctx, 'start || nowFallback()')).toBe(4);
		const snap = read('utils/moduleAiSnapshot.js');
		expect(occurrences(snap, 'calibreSigSafe')).toBe(0);
		expect(occurrences(snap, 'calibreSig: mountCalibreSignature(),')).toBe(3);
	});

	it('存储写入:设置 / 路由 / 账本 / 思考档', ()=>{
		const rt = read('utils/aiAgent/runtime.js');
		expect(count(rt, /try\s*\{\s*policy\s*=\s*readContextPolicy\(/)).toBe(0);
		expect(rt).toContain('return normalizeAgentTracePolicy(readContextPolicy());');
		const routing = read('utils/aiModelRouting.js');
		expect(count(routing, /try\s*\{\s*safeJsonStringifyToStorage\(/)).toBe(0);
		expect(occurrences(routing, 'safeJsonStringifyToStorage(MODEL_ROUTES_KEY, compact);')).toBe(1);
		// 写不进时按存储里的实际值广播(storageWriteResultBroadcast):回值直接参与判断,不套 try
		expect(occurrences(routing, 'else if(safeJsonStringifyToStorage(ROUTE_OPTIONS_KEY, next) !== true){')).toBe(1);
		expect(occurrences(routing, 'else if(safeJsonStringifyToStorage(ROUTE_PROFILES_KEY, v) !== true){')).toBe(1);
		const prefs = read('utils/aiAgent/prefs.js');
		expect(count(prefs, /try\s*\{\s*safeJsonStringifyToStorage\(/)).toBe(0);
		['AGENT_APPROVAL_CATEGORIES_KEY, next', 'AGENT_TRUSTED_RECORDS_KEY, next', 'AGENT_EXTERNAL_POLICY_KEY, norm', 'AGENT_TOOL_POLICY_KEY, next'].forEach((a)=>{
			expect(occurrences(prefs, `\tsafeJsonStringifyToStorage(${a});`)).toBe(1);
		});
		const ledger = read('utils/aiTools/ledger.js');
		expect(count(ledger, /try\s*\{\s*ok\s*=\s*safeJsonStringifyToStorage\(/)).toBe(0);
		expect(ledger).toContain('const ok = safeJsonStringifyToStorage(LEDGER_KEY, cur) === true;');
		const prov = read('utils/aiAnalysisProviders.js');
		expect(count(prov, /try\s*\{\s*safeLocalStorageSet\(THINKING_LS_KEY/)).toBe(0);
		expect(prov).toContain("\tsafeLocalStorageSet(THINKING_LS_KEY, v || 'off');");
	});

	it('起盘工具 / 导出 / 保存桥', ()=>{
		const cast = read('utils/aiTools/tools/castTechnique.js');
		expect(count(cast, /try\s*\{\s*listAnalysisTechniqueOptions\(/)).toBe(0);
		expect(count(cast, /try\s*\{\s*label\s*=/)).toBe(0);
		expect(cast).toContain("\tlistAnalysisTechniqueOptions({ sourceType: 'timepoint' }).forEach((o)=>set.add(o.value));");
		expect(cast).toContain('const label = analysisTechniqueLabelMap([args.technique])[args.technique] || \'\';');
		const exp = read('utils/aiExport.js');
		expect(count(exp, /try\s*\{\s*return rule\.test\(/)).toBe(0);
		expect(exp).toContain('rules.findIndex((rule)=>rule.test(`${section}`))');
		expect(count(exp, /try\s*\{\s*const st = getStore\(\)/)).toBe(0);
		expect(exp).not.toContain('store 不可用=默认口径');
		expect(exp).toContain('const dayRuleFields = st && st.astro && st.astro.fields ? st.astro.fields : null;');
		expect(exp).toContain("const baziCalibreOv = (st && st.astro && st.astro.currentTab === 'bazi' && st.astro.baziCalibreOverride) ? st.astro.baziCalibreOverride : {};");
		const ex2 = read('utils/aiAnalysisExport.js');
		expect(count(ex2, /try\s*\{\s*return isDesktopBridgeAvailable\(\)/)).toBe(0);
		expect(ex2).toContain('\treturn isDesktopBridgeAvailable();');
	});

	it('进阶页面板与对话钩子', ()=>{
		const ability = read('components/aianalysis/AgentAbilityPanel.js');
		expect(count(ability, /try\s*\{\s*(return listActions|setLedgerCount)/)).toBe(0);
		expect(ability).toContain('React.useState(()=>listActions().length)');
		expect(ability).toContain('subscribeLedger(()=>setLedgerCount(listActions().length))');
		const chat = read('components/aianalysis/chat/useChatAssist.js');
		expect(count(chat, /try\s*\{\s*const ui = loadUiPrefs\(\)/)).toBe(0);
		expect(chat).toContain('const chatUiPrefs = loadUiPrefs();');
		const bestOf = read('components/aianalysis/chat/BestOfPanel.js');
		const readFn = bestOf.slice(bestOf.indexOf('export function readBestOfPrefs'), bestOf.indexOf('export function writeBestOfPrefs'));
		expect(readFn).toContain('loadUiPrefs()');
		expect(count(readFn, /\btry\s*\{/)).toBe(0);
		const snap = read('utils/aiAgent/tasks/modelSnapshot.js');
		expect(count(snap, /\btry\s*\{/)).toBe(0);
		expect(snap).toContain("return `${(loadUiPrefs() || {}).modelSelection || ''}`;");
	});
});

describe('死导出与重复实现', ()=>{
	it('高级控件登记:没人用的按 id 取控件已删', ()=>{
		expect(read('components/aianalysis/chat/advancedControls.js')).not.toContain('advancedControlById');
	});

	it('对话桶只导出 AI 分析页在用的几件', ()=>{
		const lines = read('components/aianalysis/chat/index.js').split('\n').filter((l)=>/^export /.test(l));
		expect(lines).toEqual([
			"export { useChatAssist } from './useChatAssist';",
			"export { default as ChatAssistOverlays } from './ChatAssistOverlays';",
			"export { useSubjectFacts, SubjectFactsCardExtra } from './useSubjectFacts';",
		]);
		// 每个转出的名字 AI 分析页都真在用
		const main = read('components/aianalysis/AIAnalysisMain.js');
		['useChatAssist(', 'ChatAssistOverlays', 'useSubjectFacts(', '<SubjectFactsCardExtra'].forEach((n)=>expect(main).toContain(n));
	});

	it('工具桶不再转出没人经桶取的七个名字', ()=>{
		const exportsFrom = read('utils/aiTools/index.js').split('\n').filter((l)=>/^export \{[^}]*\} from /.test(l)).join('\n');
		['unregisterTool', 'getWorkspaceBridge', 'registerWorkspaceUi', 'waitForWorkspaceUi', 'listLedgerActions', 'getAction', 'registerUndoHandler'].forEach((n)=>{
			expect(exportsFrom).not.toMatch(new RegExp(`\\b${n}\\b`));
		});
		['registerTool', 'runTool', 'listTools', 'getTool', 'exportToolManifest', 'registerWorkspaceBridge', 'getWorkspaceUi', 'undoAction', 'subscribeLedger'].forEach((n)=>{
			expect(exportsFrom).toMatch(new RegExp(`\\b${n}\\b`));
		});
	});

	it('工具名下拉选项 / 任务时刻格式各只有一份', ()=>{
		const ability = read('components/aianalysis/AgentAbilityPanel.js');
		const rules = read('components/aianalysis/AutomationRulesPanel.js');
		expect(ability).not.toMatch(/function toolOptions\(/);
		expect(rules).not.toMatch(/function toolNameOptions\(/);
		expect(ability).toContain("import { registerBuiltinTools, listTools, listToolNameOptions } from '../../utils/aiTools';");
		expect(rules).toContain("import { listToolNameOptions } from '../../utils/aiTools';");
		expect(ability).toContain('setToolOpts(listToolNameOptions())');
		expect(rules).toContain("[{ value: '', label: '任何工具' }].concat(listToolNameOptions())");
		const center = read('components/aianalysis/TaskCenterPanel.js');
		expect(center).not.toMatch(/function fmt\(/);
		expect(center).toContain("import { formatTaskTime as fmt } from '../../utils/aiAgent/tasks/scheduler';");
		const sched = read('utils/aiAgent/tasks/scheduler.js');
		expect(sched).not.toMatch(/function fmt\(/);
		expect(sched).not.toMatch(/\bfmt\(/);
		expect(occurrences(sched, 'formatTaskTime(')).toBe(4);   // 定义一处 + 任务日志三处
		expect(sched).toContain('export function formatTaskTime(at){');
	});
});
