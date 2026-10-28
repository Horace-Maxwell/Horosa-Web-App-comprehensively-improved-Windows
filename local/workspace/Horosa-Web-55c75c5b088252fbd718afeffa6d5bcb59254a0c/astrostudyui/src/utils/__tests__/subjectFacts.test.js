// 命主实况合同:问卷口径(是 / 数值 / 年龄缺省 100)· 断事日志封顶 · 事盘 / 无 cid 为空 · 按命盘开关(缺省关)·
// 关 = 对话 / 无头上下文逐字节不变 · 开 = 独立稳定层排在案例前提之后 · 挂载预览卡 / 灰卡 · 命主工作区开关与编辑入口 ·
// 恢复备份取较严 · AI 导出「附命主实况」缺省关、只附在命主本人的导出上 · 外部读档案详情带同一段。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import { upsertLocalChart } from '../localcharts';
import { upsertLocalCase } from '../localcases';
import { buildDefaultFateEvents, saveLocalFateEvents, readLocalFateValues, FATE_EVENTS_CHANGED_EVENT, FATE_EVENT_GROUPS } from '../localdeeplearn';
import {
	buildSubjectFacts, subjectFactsLayer, subjectFactsPreview, subjectFactsCid, isSubjectFactsEnabled, setSubjectFactsEnabled, readSubjectFactsPrefs,
	subscribeSubjectFacts, clipText, SUBJECT_FACTS_KEY, SUBJECT_FACTS_LAYER_KEY, SUBJECT_FACTS_PRIORITY, SUBJECT_FACTS_INTRO, SUBJECT_FACTS_JOURNAL_MAX,
	SUBJECT_FACTS_JOURNAL_CHARS, SUBJECT_FACTS_TEXT_MAX,
} from '../subjectFacts';
import { buildContextLayers, clipContextLayersDetailed, VOLATILE_LAYER_KEYS } from '../aiAnalysisContext';
import { assembleSystemPrompt, PROMPT_CACHE_BREAKPOINT } from '../aiPromptAssembly';
import { classifyStorageKey } from '../storageKeyRegistry';
import { stricterSecurityValue, BACKUP_SECURITY_KEYS } from '../unifiedBackup';
import { subjectFactsContextItem, SubjectFactsCardExtra, SUBJECT_FACTS_OFF_KEY } from '../../components/aianalysis/chat/useSubjectFacts';
import SubjectWorkspaceDrawer, { openSubjectFactsEditor } from '../../components/aianalysis/chat/SubjectWorkspaceDrawer';
import { useChatAssist } from '../../components/aianalysis/chat/useChatAssist';
import { headlessLayerExtras } from '../aiAgent/goalRunner';
import { __aiExportTesting__, isAIExportSubjectFactsEnabled, subjectFactsExportAllowed, buildSubjectFactsExportSection } from '../aiExport';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

jest.mock('../storageutil', ()=>{
	let state = {};
	return { getStore: ()=>state, setGlobalStore: (s)=>{ state = s; } };
});
const storageutil = require('../storageutil');

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>readSource(path.join(SRC, rel));
const flush = ()=>new Promise((r)=>setTimeout(r, 10));
const newChart = (extra)=>upsertLocalChart({ name: '张三', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 1, ...(extra || {}) });
const sourceOf = (rec)=>({ id: rec.cid, sourceType: 'chart', title: rec.name, updatedAt: rec.updateTime, record: rec });
function answer(cid, patch){
	const d = buildDefaultFateEvents(cid);
	Object.keys(patch || {}).forEach((g)=>{ Object.assign(d[`Val${g}`], patch[g]); });
	saveLocalFateEvents(d);
}
function baseCtx(extraLayers){
	return buildContextLayers({
		sourceContext: { title: '张三', content: '[起盘信息]\n甲子年乙丑月丙寅日丁卯时', after23NewDay: 0, lateZiHourUseNextDay: 0 },
		techniqueContexts: [{ key: 'bazi', title: '八字', content: '[命局]\n八字正文' }],
		materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [], systemPrompt: '系统提示甲', extraLayers,
	});
}

let host;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); storageutil.setGlobalStore({}); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

describe('问卷口径与拼装', ()=>{
	it('🔴 全部缺省 / 没填 = 没有命主实况;只有已存命盘才有(事盘 / 即时起盘 / 无 cid / 非命盘源为空)', ()=>{
		const rec = newChart();
		expect(buildSubjectFacts(rec)).toEqual({ items: [], count: 0, text: '' });
		saveLocalFateEvents(buildDefaultFateEvents(rec.cid));   // 提交了一份全是缺省值的问卷
		expect(readLocalFateValues(rec.cid)).not.toBeNull();
		expect(buildSubjectFacts(rec).count).toBe(0);
		answer(rec.cid, { 10000: { 10003: 1 } });
		expect(buildSubjectFacts(rec).count).toBe(1);
		const kase = upsertLocalCase({ event: '问事', divTime: '2026-10-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', caseType: 'liureng' });
		answer(kase.cid, { 10000: { 10003: 1 } });
		expect(buildSubjectFacts(kase).count).toBe(0);
		expect(buildSubjectFacts({ id: kase.cid, sourceType: 'case', record: kase }).count).toBe(0);
		expect(buildSubjectFacts({ id: '__natal__', sourceType: 'chart', record: { birth: '1990-05-18 10:00:00' } }).count).toBe(0);
		expect(buildSubjectFacts({ id: rec.cid, sourceType: 'timepoint', record: rec }).count).toBe(0);
		expect(buildSubjectFacts({ name: '无档' }).count).toBe(0);
		expect(buildSubjectFacts(null).count).toBe(0);
		expect(subjectFactsCid(sourceOf(rec))).toBe(rec.cid);
		expect(subjectFactsCid({ id: 'x', sourceType: 'chart', record: { birth: '1990-05-18' } })).toBe('');
	});
	it('🔴 是 / 否题只发「是」;数值题只发 ≠ 缺省;年龄类缺省 100 = 未发生不发;四组按页签顺序;数值串照认', ()=>{
		const rec = newChart();
		answer(rec.cid, {
			10000: { 10001: 0, 10003: 1, 10005: 2, 10013: 0 },
			20000: { 20001: 45, 20002: 100, 20004: '3', 20009: 1 },
			40000: { 40006: 1 },
		});
		const f = buildSubjectFacts(rec);
		expect(f.items.map((g)=>g.title)).toEqual(['六亲', '富贵程度', '死亡方式']);
		expect(FATE_EVENT_GROUPS.map((g)=>g.title)).toEqual(['六亲', '富贵程度', '职业', '死亡方式']);
		expect(f.count).toBe(6);
		expect(f.text.split('\n')[0]).toBe(SUBJECT_FACTS_INTRO);
		expect(f.text).toContain('[命主实况·六亲]\n父亲寿元超七十：是\n配偶数量(同居超过半年就算配偶)：2');
		expect(f.text).toContain('命主残疾年龄(周岁，包括植物人)：45');
		expect(f.text).toContain('命主牢狱次数：3');
		expect(f.text).toContain('本科或硕士学历：是');
		expect(f.text).toContain('[命主实况·死亡方式]\n病死：是');
		expect(f.text).not.toContain('父亲寿元未满五十五');   // 答「否」不发
		expect(f.text).not.toContain('命主死亡年龄');           // 100 = 缺省 = 未发生
		expect(f.text).not.toContain('女儿数量');               // 0 = 缺省
		expect(f.text).not.toContain('[命主实况·职业]');        // 没答的组不出
	});
	it('🔴 断事日志新在前、条数与每条字数封顶(截断口径与外部读档案同一份);总长封顶', ()=>{
		const long = '验'.repeat(SUBJECT_FACTS_JOURNAL_CHARS + 50);
		const journal = Array.from({ length: SUBJECT_FACTS_JOURNAL_MAX + 5 }, (_, i)=>({ at: `2026-10-${String(30 - i).padStart(2, '0')} 10:00`, text: i === 0 ? long : `第 ${i} 条` }));
		const rec = newChart({ journal });
		const f = buildSubjectFacts(rec);
		expect(f.count).toBe(SUBJECT_FACTS_JOURNAL_MAX + 5);
		const g = f.items.find((x)=>x.kind === 'journal');
		expect(g.entries.length).toBe(SUBJECT_FACTS_JOURNAL_MAX);
		expect(f.text).toContain(`[命主实况·断事日志](共 ${SUBJECT_FACTS_JOURNAL_MAX + 5} 条,只列最近 ${SUBJECT_FACTS_JOURNAL_MAX} 条)(新在前)`);
		expect(f.text).toContain(`2026-10-30 10:00：${'验'.repeat(SUBJECT_FACTS_JOURNAL_CHARS)}…[截断,原 ${SUBJECT_FACTS_JOURNAL_CHARS + 50} 字]`);
		expect(f.text).not.toContain(`第 ${SUBJECT_FACTS_JOURNAL_MAX} 条`);
		expect(clipText('abcdef', 3)).toBe('abc…[截断,原 6 字]');
		expect(clipText('abc', 3)).toBe('abc');
		// 问卷与日志一起:问卷在前、日志在后;日志以库里那条为准(传进来的旧记录没有日志也照样读到)
		answer(rec.cid, { 10000: { 10003: 1 } });
		const f2 = buildSubjectFacts({ ...rec, journal: [] });
		expect(f2.items.map((x)=>x.kind)).toEqual(['questionnaire', 'journal']);
		expect(f2.text.indexOf('[命主实况·六亲]')).toBeLessThan(f2.text.indexOf('[命主实况·断事日志]'));
		// 总长封顶
		const huge = newChart({ journal: Array.from({ length: SUBJECT_FACTS_JOURNAL_MAX }, ()=>({ at: 't', text: '长'.repeat(SUBJECT_FACTS_JOURNAL_CHARS) })) });
		const many = {};
		Object.keys(FATE_EVENT_GROUPS[2].events).forEach((id)=>{ many[id] = 1; });
		answer(huge.cid, { 30000: many });
		const fh = buildSubjectFacts(huge);
		expect(fh.text.length).toBeLessThanOrEqual(SUBJECT_FACTS_TEXT_MAX + 30);
		expect(fh.text).toMatch(/…\[截断,原 \d+ 字\]$/);
	});
});

describe('按命盘的发送开关(缺省关)', ()=>{
	it('🔴 缺省一张都不发;开 / 关只动这张;全关删键;写入广播;坏值读回缺省;键已登记、随备份', ()=>{
		expect(readSubjectFactsPrefs()).toEqual({ bySubject: {} });
		expect(isSubjectFactsEnabled('local-a')).toBe(false);
		const seen = [];
		const off = subscribeSubjectFacts(()=>seen.push(1));
		setSubjectFactsEnabled('local-a', true);
		setSubjectFactsEnabled('local-b', true);
		expect(isSubjectFactsEnabled('local-a')).toBe(true);
		expect(JSON.parse(window.localStorage.getItem(SUBJECT_FACTS_KEY))).toEqual({ bySubject: { 'local-a': true, 'local-b': true } });
		setSubjectFactsEnabled('local-a', false);
		expect(isSubjectFactsEnabled('local-a')).toBe(false);
		expect(isSubjectFactsEnabled('local-b')).toBe(true);
		setSubjectFactsEnabled('local-b', false);
		expect(window.localStorage.getItem(SUBJECT_FACTS_KEY)).toBeNull();
		expect(seen.length).toBe(4);
		window.dispatchEvent(new CustomEvent(FATE_EVENTS_CHANGED_EVENT));   // 问卷保存也通知
		expect(seen.length).toBe(5);
		off();
		window.localStorage.setItem(SUBJECT_FACTS_KEY, '{"bySubject":{"x":"yes","y":true,"__proto__":true}}');
		expect(readSubjectFactsPrefs()).toEqual({ bySubject: { y: true } });
		window.localStorage.setItem(SUBJECT_FACTS_KEY, 'not json');
		expect(readSubjectFactsPrefs()).toEqual({ bySubject: {} });
		expect(classifyStorageKey(SUBJECT_FACTS_KEY)).toEqual(expect.objectContaining({ kind: 'settings', backup: true }));
		expect(classifyStorageKey('HorosaLocalDeepLearn').label).toBe('命主实况');
	});
	it('🔴 问卷「提交」后广播变更(挂载预览据此重读)', ()=>{
		const got = [];
		const h = (e)=>got.push(e.detail);
		window.addEventListener(FATE_EVENTS_CHANGED_EVENT, h);
		saveLocalFateEvents(buildDefaultFateEvents('local-z'));
		window.removeEventListener(FATE_EVENTS_CHANGED_EVENT, h);
		expect(got).toEqual([{ cid: 'local-z' }]);
	});
	it('🔴 恢复备份取较严一档:只留两边都开着的命盘;本机缺省不放宽;来源缺省(设置面完整)= 收回本机的;已在恢复的权限类开关里', ()=>{
		const K = SUBJECT_FACTS_KEY;
		expect(BACKUP_SECURITY_KEYS).toContain(K);
		const on = (...ids)=>JSON.stringify({ bySubject: Object.fromEntries(ids.map((i)=>[i, true])) });
		expect(stricterSecurityValue(K, null, on('a'))).toBeNull();                 // 本机缺省(一张不发)→ 备份里开着的不带回
		expect(stricterSecurityValue(K, on('a', 'b'), null)).toBeNull();            // 来源为缺省 → 本机的全收回(删键)
		expect(JSON.parse(stricterSecurityValue(K, on('a', 'b'), on('b', 'c')))).toEqual({ bySubject: { b: true } });
		const local = on('a');
		expect(stricterSecurityValue(K, local, on('a', 'c'))).toBe(local);          // 等严 → 原样本机串
		expect(read('../headless/runtime.js')).toContain(`'${K}'`);                  // 无头导入同一份清单
	});
});

describe('对话与无头:关 = 逐字节不变;开 = 独立稳定层排在案例前提之后', ()=>{
	it('🔴 关着(有内容也)不产层、连问卷都不读;上下文与拼好的系统提示逐字节同不挂时', ()=>{
		const rec = newChart({ journal: [{ at: '2026-10-01', text: '应期已验' }] });
		answer(rec.cid, { 10000: { 10003: 1 } });
		const src = sourceOf(rec);
		const spy = jest.spyOn(Storage.prototype, 'getItem');
		expect(subjectFactsLayer(src)).toBeNull();
		expect(spy.mock.calls.map((c)=>c[0])).not.toContain('HorosaLocalDeepLearn');
		spy.mockRestore();
		const base = baseCtx(undefined);
		const offLayers = baseCtx([subjectFactsLayer(src)].filter(Boolean));
		expect(JSON.stringify(offLayers)).toBe(JSON.stringify(base));
		const a = assembleSystemPrompt({ layers: base, maxChars: 20000, providerType: 'anthropic', breakpointWhenNoVolatile: true });
		const b = assembleSystemPrompt({ layers: offLayers, maxChars: 20000, providerType: 'anthropic', breakpointWhenNoVolatile: true });
		expect(b.systemPrompt).toBe(a.systemPrompt);
	});
	it('🔴 开着:层键 subject-facts、94.8、标题带命主名、正文开头说明;拼装后排在案例前提之后、排盘规则之前;属稳定层', ()=>{
		const rec = newChart();
		answer(rec.cid, { 20000: { 20015: 1 } });
		setSubjectFactsEnabled(rec.cid, true);
		const layer = subjectFactsLayer(sourceOf(rec));
		expect(layer).toEqual({ key: SUBJECT_FACTS_LAYER_KEY, title: '命主实况：张三', priority: SUBJECT_FACTS_PRIORITY, content: buildSubjectFacts(rec).text });
		expect(SUBJECT_FACTS_PRIORITY).toBeGreaterThan(94);
		expect(SUBJECT_FACTS_PRIORITY).toBeLessThan(95);
		const kept = clipContextLayersDetailed(baseCtx([layer]), { maxChars: 20000, fairShare: true }).kept.map((l)=>l.key);
		expect(kept.indexOf('subject-facts')).toBe(kept.indexOf('source') + 1);
		expect(kept.indexOf('dayBoundaryRule')).toBe(kept.indexOf('subject-facts') + 1);
		const asm = assembleSystemPrompt({ layers: baseCtx([layer]), maxChars: 20000, providerType: 'anthropic', breakpointWhenNoVolatile: true });
		expect(asm.meta.layerKeys).toContain('subject-facts');
		expect(asm.systemPrompt.indexOf('命主实况：张三')).toBeGreaterThan(asm.systemPrompt.indexOf('案例前提'));
		expect(asm.systemPrompt).toContain('老板：是');
		// 稳定层:在缓存断点之前(不随问题变,吃前缀缓存)
		expect(VOLATILE_LAYER_KEYS['subject-facts']).toBeUndefined();
		expect(asm.systemPrompt.indexOf(PROMPT_CACHE_BREAKPOINT)).toBeGreaterThan(asm.systemPrompt.indexOf('老板：是'));
		// 开着但没内容 → 不产层
		const empty = newChart({ name: '李四' });
		setSubjectFactsEnabled(empty.cid, true);
		expect(subjectFactsLayer(sourceOf(empty))).toBeNull();
	});
	it('🔴 对话页 promptLayerExtras:关 = 空;开 = 带层;没有当前源时按会话记录的源取', ()=>{
		const rec = newChart();
		answer(rec.cid, { 10000: { 10003: 1 } });
		const src = sourceOf(rec);
		let api = null;
		function Harness(props){ api = useChatAssist(props.deps); return null; }
		const deps = { prompt: '', setPrompt: jest.fn(), messages: [], bundles: [], sources: [src], activeSource: src, selectedTechniqueKeys: [], setSelectedTechniqueKeys: jest.fn(), handleSend: jest.fn(), applyBundle: jest.fn(), providerProfiles: [], modelSelection: '' };
		act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
		expect(api.promptLayerExtras()).toEqual([]);
		setSubjectFactsEnabled(rec.cid, true);
		expect(api.promptLayerExtras().map((l)=>l.key)).toEqual(['subject-facts']);
		const deps2 = { ...deps, activeSource: null, activeConversation: { id: 'c1', sourceRef: { id: rec.cid } } };
		act(()=>{ ReactDOM.render(<Harness deps={deps2} />, host); });
		expect(api.promptLayerExtras().map((l)=>l.key)).toEqual(['subject-facts']);
		setSubjectFactsEnabled(rec.cid, false);
		expect(api.promptLayerExtras()).toEqual([]);
	});
	it('🔴 无头轮(目标任务 / 定时 / 无头分析)同一开关同一层', async ()=>{
		const rec = newChart();
		answer(rec.cid, { 10000: { 10003: 1 } });
		const src = sourceOf(rec);
		expect((await headlessLayerExtras({ source: src, techniqueKeys: [], conversation: null })).map((l)=>l.key)).toEqual([]);
		setSubjectFactsEnabled(rec.cid, true);
		const on = await headlessLayerExtras({ source: src, techniqueKeys: [], conversation: null });
		expect(on).toEqual([subjectFactsLayer(src)]);
	});
});

describe('挂载预览卡与命主工作区', ()=>{
	it('🔴 开 = 照常出卡(键与层同、正文即发送全文);关但有内容 = 灰卡「此盘有命主实况 N 项,未发送」;没内容 = 不出卡', ()=>{
		const rec = newChart();
		expect(subjectFactsContextItem(subjectFactsPreview(sourceOf(rec)), '张三')).toBeNull();
		answer(rec.cid, { 10000: { 10003: 1, 10005: 2 } });
		const off = subjectFactsContextItem(subjectFactsPreview(sourceOf(rec)), '张三');
		expect(off).toEqual(expect.objectContaining({ key: SUBJECT_FACTS_OFF_KEY, title: '此盘有命主实况 2 项,未发送', status: 'off', muted: true, content: '' }));
		expect(off.subjectFacts).toEqual({ cid: rec.cid, enabled: false, count: 2 });
		setSubjectFactsEnabled(rec.cid, true);
		const on = subjectFactsContextItem(subjectFactsPreview(sourceOf(rec)), '张三');
		expect(on).toEqual(expect.objectContaining({ key: SUBJECT_FACTS_LAYER_KEY, title: '命主实况 · 张三', status: 'ready', content: subjectFactsLayer(sourceOf(rec)).content }));
		expect(on.muted).toBeUndefined();
		// 卡上「不发送 / 发送」只改这张盘
		act(()=>{ ReactDOM.render(<SubjectFactsCardExtra item={on} />, host); });
		const btn = host.querySelector('[data-subject-facts-toggle]');
		expect(btn.getAttribute('data-subject-facts-toggle')).toBe('on');
		expect(btn.textContent).toBe('不发送');
		act(()=>{ btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(isSubjectFactsEnabled(rec.cid)).toBe(false);
		act(()=>{ ReactDOM.render(<SubjectFactsCardExtra item={off} />, host); });
		expect(host.querySelector('[data-subject-facts-toggle]').textContent).toBe('发送');
		act(()=>{ host.querySelector('[data-subject-facts-toggle]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(isSubjectFactsEnabled(rec.cid)).toBe(true);
	});
	it('🔴 页面接线:预览卡进挂载面板、灰卡不计层数、卡片右侧按钮、未发送状态', ()=>{
		const main = read('components/aianalysis/AIAnalysisMain.js');
		expect(main).toContain('const subjectFacts = useSubjectFacts(activeSource, mountDrawerOpen);');
		expect(main).toContain('items.push(subjectFacts.card);');
		expect(main).toContain(': (item.subjectFacts ? <SubjectFactsCardExtra item={item} /> : null)}');
		expect(main).toContain('<Badge count={lockedContextItems.filter((item)=>!item.muted).length}');
		expect(main).toContain("off: { text: '未发送', color: 'default' }");
		expect(main.indexOf('items.push(subjectFacts.card);')).toBeGreaterThan(main.indexOf('key: `source:${activeSource.id}`'));
	});
	it('🔴 命主工作区:命主实况一节显示条数、开关即这张盘的发送开关、「编辑命主实况」打开同一份问卷;事盘只给说明', async ()=>{
		const rec = newChart();
		answer(rec.cid, { 10000: { 10003: 1 } });
		const dispatch = jest.fn();
		const onClose = jest.fn();
		await act(async ()=>{ ReactDOM.render(<SubjectWorkspaceDrawer open source={sourceOf(rec)} conversations={[]} materials={[]} onClose={onClose} dispatch={dispatch} />, host); await flush(); });
		const sec = document.querySelector('[data-subject-facts-section]');
		expect(sec.textContent).toContain('命主实况 1');
		expect(sec.textContent).toContain('1 项,未发送');
		const sw = document.querySelector('[data-subject-facts-switch]');
		expect(sw.getAttribute('data-subject-facts-switch')).toBe('off');
		await act(async ()=>{ sw.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); });
		expect(isSubjectFactsEnabled(rec.cid)).toBe(true);
		expect(document.querySelector('[data-subject-facts-switch]').getAttribute('data-subject-facts-switch')).toBe('on');
		expect(document.querySelector('[data-subject-facts-section]').textContent).toContain('发给 AI:1 项');
		await act(async ()=>{ document.querySelector('[data-subject-facts-edit]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); });
		expect(dispatch).toHaveBeenCalledWith({ type: 'astro/openDrawer', payload: { key: 'chartdeeplearn', record: expect.objectContaining({ cid: rec.cid, name: '张三' }) } });
		expect(onClose).toHaveBeenCalled();
		expect(openSubjectFactsEditor({ id: 'c', sourceType: 'case', record: { cid: 'c' } }, dispatch)).toBe(false);
		const kase = upsertLocalCase({ event: '问事', divTime: '2026-10-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', caseType: 'liureng' });
		await act(async ()=>{ ReactDOM.render(<SubjectWorkspaceDrawer open source={{ id: kase.cid, sourceType: 'case', title: '问事', record: kase }} conversations={[]} materials={[]} onClose={onClose} dispatch={dispatch} />, host); await flush(); });
		expect(document.querySelector('[data-subject-facts-switch]')).toBeNull();
		expect(document.querySelector('[data-subject-facts-section]').textContent).toContain('只有已存档的命盘有命主实况');
	});
});

describe('AI 导出「附命主实况」', ()=>{
	it('🔴 缺省关(规范化补 false;显式 true 才开);只附在命主本人的导出上(命理 / 推运 / 本命盘),卜类与择日不附', ()=>{
		const { normalizeAIExportPrefs } = __aiExportTesting__;
		expect(normalizeAIExportPrefs(null).subjectFacts).toBe(false);
		expect(normalizeAIExportPrefs({ subjectFacts: 'yes' }).subjectFacts).toBe(false);
		expect(normalizeAIExportPrefs({ subjectFacts: true }).subjectFacts).toBe(true);
		expect(isAIExportSubjectFactsEnabled({ prefs: { subjectFacts: true } })).toBe(true);
		expect(isAIExportSubjectFactsEnabled({ prefs: {} })).toBe(false);
		['bazi', 'ziwei', 'astrochart', 'primarydirect', 'firdaria', 'guolao'].forEach((k)=>expect(subjectFactsExportAllowed(k)).toBe(true));
		['liureng', 'qimen', 'sixyao', 'horary', 'election', 'mundane', 'relative', 'tarot', 'jieqi', 'huangli', ''].forEach((k)=>expect(subjectFactsExportAllowed(k)).toBe(false));
	});
	it('🔴 当前盘是已存命盘且有内容 → 「[命主实况]」整段;没 cid / 库里没有 / 不附的导出 → 空', ()=>{
		const rec = newChart();
		answer(rec.cid, { 10000: { 10003: 1 } });
		storageutil.setGlobalStore({ astro: { fields: { cid: { value: rec.cid } } } });
		const sec = buildSubjectFactsExportSection('bazi');
		expect(sec).toBe(`[命主实况]\n${buildSubjectFacts(rec).text}`);
		expect(buildSubjectFactsExportSection('liureng')).toBe('');
		storageutil.setGlobalStore({ astro: { fields: { cid: { value: 'local-nope' } } } });
		expect(buildSubjectFactsExportSection('bazi')).toBe('');
		storageutil.setGlobalStore({ astro: { fields: { cid: { value: null } } } });
		expect(buildSubjectFactsExportSection('bazi')).toBe('');
	});
	it('🔴 拼装点:段筛选与范围统计之后、图例之前;受开关门控;外部读「当前页正文」不附;设置面有勾选', ()=>{
		const src = read('utils/aiExport.js');
		const at = src.indexOf('const keptSectionCount = extractSectionTitles(content).length;');
		const sf = src.indexOf('if(content && !(opts && opts.omitSubjectFacts) && isAIExportSubjectFactsEnabled()){');
		const lg = src.indexOf("if(exportFormat === 'v2' && content && isAIExportLegendEnabled()){");
		expect(at).toBeGreaterThan(0);
		expect(sf).toBeGreaterThan(at);
		expect(lg).toBeGreaterThan(sf);
		expect(src).toContain('const p = await buildPayload({ omitSubjectFacts: true });');
		const hdr = read('components/homepage/PageHeader.js');
		expect(hdr).toContain('data-ai-export-subject-facts="1"');
		expect(hdr).toContain('onAISettingPrefChange({ subjectFacts: !(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.subjectFacts === true) })');
	});
});

describe('改名「命主实况」(界面文字;存储键与代码标识符不变)', ()=>{
	it('抽屉标题 / 列表图标提示 / 全量备份提示', ()=>{
		expect(read('pages/index.js')).toContain("title='命主实况'");
		const list = read('components/user/ChartList.js');
		expect(list).toContain('title="命主实况" style={primaryActionLinkStyle} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickDLFeature(record);});}}');
		expect(list).toContain('全量备份已导出（命盘/事盘/人生事件/命主实况/AI 设置）');
		expect(list).not.toContain('训练值');
		expect(read('utils/localdeeplearn.js')).toContain("const LocalDeepLearnKey = 'HorosaLocalDeepLearn';");
	});
});
