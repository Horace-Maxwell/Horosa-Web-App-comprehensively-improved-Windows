// 个人口径(A6)合同:键读写(缺省全关且键不存在;全部缺省即删键;订阅)· 口径层只在 enabled 且有文本时产、priority 102 居首(裁剪按 priority 降序,kept[0]=persona)·
// 缺省 extraLayers 空 → buildContextLayers 与不传逐字相同(零回归 oracle)· /init 草稿输入(最近 30 会话用户消息摘录 + 技法频次)。
import { PERSONA_KEY, readPersona, writePersona, clearPersona, subscribePersona, personaLayer, buildInitDraftInput, PERSONA_LAYER_PRIORITY, MEMORY_LAYER_PRIORITY, PERSONA_TEXT_MAX } from '../aiChat/persona';
import { memoryLayer } from '../aiChat/memory';
import { buildContextLayers, clipContextLayersDetailed } from '../aiAnalysisContext';

beforeEach(()=>{ window.localStorage.clear(); });

describe('persona 键', ()=>{
	it('缺省全关键不存在;写文本+启用落键;文本截 4000;全部缺省即删键;订阅收到归一化对象', ()=>{
		expect(readPersona()).toEqual({ text: '', enabled: false, memoryInject: false, memoryCapture: false, applyToReport: false });
		expect(window.localStorage.getItem(PERSONA_KEY)).toBe(null);
		const seen = []; const off = subscribePersona((p)=>seen.push(p));
		writePersona({ text: 'x'.repeat(5000), enabled: true });
		expect(readPersona().text.length).toBe(PERSONA_TEXT_MAX);
		expect(readPersona().enabled).toBe(true);
		writePersona({ text: '', enabled: false });
		expect(window.localStorage.getItem(PERSONA_KEY)).toBe(null);
		writePersona({ memoryCapture: true });
		expect(JSON.parse(window.localStorage.getItem(PERSONA_KEY)).memoryCapture).toBe(true);
		// [Q-294/M-109·AR-18] 清空只清文本与「启用注入」,记忆注入/自动沉淀/同时用于报告 三开关保留 → 键仍在;三开关也关才删键
		writePersona({ text: 'y', enabled: true, memoryInject: true });
		clearPersona();
		expect(readPersona()).toEqual({ text: '', enabled: false, memoryInject: true, memoryCapture: true, applyToReport: false });
		writePersona({ memoryCapture: false, memoryInject: false });
		expect(window.localStorage.getItem(PERSONA_KEY)).toBe(null);
		off();
		expect(seen.length).toBe(6);
	});
});

describe('persona/memory 层', ()=>{
	it('🔴 口径层:关或空文本 → null;开 → priority 102;与记忆层 101 一起在 system 100 之前(裁剪后 kept[0]=persona);缺省 extraLayers 与不传逐字相同', ()=>{
		expect(personaLayer({ text: 'x', enabled: false })).toBe(null);
		expect(personaLayer({ text: '  ', enabled: true })).toBe(null);
		const pl = personaLayer({ text: '八字用子平', enabled: true });
		expect(pl.priority).toBe(102);
		expect(PERSONA_LAYER_PRIORITY).toBe(102); expect(MEMORY_LAYER_PRIORITY).toBe(101);
		const ml = memoryLayer([{ id: 'aimem:1', subject: { type: 'user' }, text: '我妻子叫李四', status: 'confirmed', enabled: true, updatedAt: '2026-09-05' }]);
		const base = { sourceContext: null, techniqueContexts: [], materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [], systemPrompt: '规则' };
		const layers = buildContextLayers({ ...base, extraLayers: [pl, ml] });
		const clip = clipContextLayersDetailed(layers, { maxChars: 20000, fairShare: true });
		expect(clip.kept[0].key).toBe('persona');
		expect(clip.kept[1].key).toBe('memory');
		expect(clip.kept[2].key).toBe('system');
		expect(JSON.stringify(buildContextLayers({ ...base, extraLayers: [] }))).toBe(JSON.stringify(buildContextLayers(base)));
	});
	it('/init 草稿输入:最近 N 会话按 updatedAt 取、用户消息摘录每会话 ≤6 条、技法频次 top;封顶 12000', ()=>{
		const convs = [{ id: 'c1', updatedAt: '2026-09-05', techniqueKeys: ['bazi', 'ziwei'] }, { id: 'c2', updatedAt: '2026-09-04', techniqueKeys: ['bazi'] }, { id: 'c3', updatedAt: '2026-09-01', techniqueKeys: ['astrochart'] }];
		const msgs = { c1: Array.from({ length: 10 }, (_, i)=>({ role: 'user', content: `问题${i}` })).concat([{ role: 'assistant', content: 'a' }]), c2: [{ role: 'user', content: '事业' }], c3: [{ role: 'user', content: '旧' }] };
		const d = buildInitDraftInput({ conversations: convs, messagesByConversation: msgs, recent: 2 });
		expect(d.conversations).toBe(2);
		expect(d.excerpts).toBe(7);
		expect(d.topTechniques).toBe('bazi×2, ziwei×1');
		expect(d.text).toContain('- 事业');
		expect(d.text).not.toContain('- 旧');
		expect(d.text.length).toBeLessThanOrEqual(12000);
	});
});

describe('[复查 D5] 「清空全部口径」钮(clearPersona + clearPersonaLayers 接线)', ()=>{
	const React = require('react');
	const ReactDOM = require('react-dom');
	const { act } = require('react-dom/test-utils');
	const PersonaMemoryPanel = require('../../components/aianalysis/chat/PersonaMemoryPanel').default;
	const { writePersonaLayer, readPersonaLayers } = require('../aiChat/personaLayers');
	const flush = ()=>new Promise((r)=>setTimeout(r, 20));
	it('确认 ⇒ 全局与分层口径键都删;取消 ⇒ 键不动', async ()=>{
		writePersona({ enabled: true, text: '口径甲' });
		writePersonaLayer('subject', 'cid-1', '命主层乙');
		expect(readPersona().text).toBe('口径甲');
		expect(Object.keys(readPersonaLayers().bySubject || {}).length).toBe(1);
		const host = document.createElement('div'); document.body.appendChild(host);
		await act(async ()=>{ ReactDOM.render(React.createElement(PersonaMemoryPanel, { activeSource: null, activeConversation: { id: 'c1', title: 't' }, selectedTechniqueKeys: ['bazi'] }), host); await flush(); });
		const btn = host.querySelector('[data-persona-clear-all="1"]');
		expect(btn).not.toBe(null);
		// 取消
		await act(async ()=>{ btn.click(); await flush(); });
		let btns = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button'));
		expect(btns.length).toBe(2);
		await act(async ()=>{ btns.find((b)=>!b.classList.contains('ant-btn-dangerous')).click(); await flush(); await flush(); });
		expect(readPersona().text).toBe('口径甲');
		// 确认
		await act(async ()=>{ btn.click(); await flush(); });
		btns = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button'));
		await act(async ()=>{ btns.find((b)=>b.classList.contains('ant-btn-dangerous')).click(); await flush(); await flush(); });
		expect(window.localStorage.getItem(PERSONA_KEY)).toBe(null);
		expect(readPersona().text).toBe('');
		expect(Object.keys(readPersonaLayers().bySubject || {}).length).toBe(0);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove();
	});
});
