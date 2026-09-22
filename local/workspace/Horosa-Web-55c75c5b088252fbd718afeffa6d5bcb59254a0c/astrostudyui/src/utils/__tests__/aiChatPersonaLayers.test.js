// [批二⑨] 分层口径合同:键读写(缺省不存在;空文本删条;全空删键;原型键剔除;订阅)· 合成顺序 全局→命主→技法→会话 与封顶 6000 · personaLayer 不带 ctx 逐字同批前、enabled=false 四层全不注入 · 面板四页签打开不写键。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { PERSONA_LAYERS_KEY, readPersonaLayers, writePersonaLayer, clearPersonaLayers, subscribePersonaLayers, normalizePersonaLayers, composePersonaText, PERSONA_COMPOSED_MAX, PERSONA_LAYER_TEXT_MAX, PERSONA_SESSION_TEXT_MAX } from '../aiChat/personaLayers';
import { personaLayer, PERSONA_KEY } from '../aiChat/persona';
import PersonaMemoryPanel from '../../components/aianalysis/chat/PersonaMemoryPanel';

beforeEach(()=>{ window.localStorage.clear(); });

it('键:缺省不存在且读出两空表;写一层落键;空文本删条;两表全空删键;原型键/超长被归一;订阅收到归一对象', ()=>{
	expect(readPersonaLayers()).toEqual({ bySubject: {}, byTechnique: {} });
	expect(window.localStorage.getItem(PERSONA_LAYERS_KEY)).toBe(null);
	const seen = []; const off = subscribePersonaLayers((l)=>seen.push(l));
	writePersonaLayer('subject', 'c1', ' 此人是我父亲 ');
	expect(readPersonaLayers().bySubject).toEqual({ c1: '此人是我父亲' });
	writePersonaLayer('technique', 'bazi', 'x'.repeat(PERSONA_LAYER_TEXT_MAX + 10));
	expect(readPersonaLayers().byTechnique.bazi.length).toBe(PERSONA_LAYER_TEXT_MAX);
	writePersonaLayer('bogus', 'c1', 'no');   // 非法 scope 不写
	expect(readPersonaLayers().bySubject).toEqual({ c1: '此人是我父亲' });
	writePersonaLayer('subject', 'c1', '');
	expect(readPersonaLayers().bySubject).toEqual({});
	writePersonaLayer('technique', 'bazi', '');
	expect(window.localStorage.getItem(PERSONA_LAYERS_KEY)).toBe(null);
	off();
	expect(seen.length).toBe(4);
	expect(normalizePersonaLayers({ bySubject: { __proto__: 'x', constructor: 'y', ok: 'z' }, byTechnique: 'nope' })).toEqual({ bySubject: { ok: 'z' }, byTechnique: {} });
	writePersonaLayer('subject', 'c9', 'q'); clearPersonaLayers();
	expect(window.localStorage.getItem(PERSONA_LAYERS_KEY)).toBe(null);
});

it('合成:全局→命主→技法(按已选顺序、同键去重、无口径的技法不出段)→会话;会话截 1000;总封顶 6000;全空=空串', ()=>{
	const layers = { bySubject: { c1: '命主口径丙' }, byTechnique: { bazi: '技法口径乙', ziwei: '紫微口径' } };
	const t = composePersonaText('全局口径甲', layers, { subjectCid: 'c1', subjectTitle: '张三', techniqueKeys: ['bazi', 'astrochart', 'bazi'], techniqueLabels: { bazi: '八字' }, sessionText: '会话口径丁' });
	expect(t).toBe('全局口径甲\n\n## 命主口径(张三)\n命主口径丙\n\n## 技法口径·八字\n技法口径乙\n\n## 本会话口径\n会话口径丁');
	expect(composePersonaText('', layers, { subjectCid: 'nobody', techniqueKeys: [] })).toBe('');
	expect(composePersonaText('', layers, { subjectCid: 'c1' })).toBe('## 命主口径\n命主口径丙');
	const long = composePersonaText('g'.repeat(4000), { bySubject: { c1: 's'.repeat(2000) }, byTechnique: {} }, { subjectCid: 'c1', sessionText: 'x'.repeat(3000) });
	expect(long.length).toBe(PERSONA_COMPOSED_MAX);
	expect(long.startsWith('g'.repeat(4000))).toBe(true);
	expect(composePersonaText('', {}, { sessionText: 'y'.repeat(3000) }).length).toBe('## 本会话口径\n'.length + PERSONA_SESSION_TEXT_MAX);
});

it('personaLayer:不带 ctx 与批前逐字相同;enabled=false 四层全不注入;enabled 且全局空但命主有 → 只注命主层', ()=>{
	expect(personaLayer({ text: '八字用子平', enabled: true }).content).toBe('八字用子平');
	expect(personaLayer({ text: 'x', enabled: true }, undefined).content).toBe('x');
	const layers = { bySubject: { c1: '命主口径丙' }, byTechnique: {} };
	expect(personaLayer({ text: 'x', enabled: false }, { layers, subjectCid: 'c1' })).toBe(null);
	expect(personaLayer({ text: '', enabled: true }, { layers, subjectCid: 'zz' })).toBe(null);
	const pl = personaLayer({ text: '', enabled: true }, { layers, subjectCid: 'c1' });
	expect(pl.priority).toBe(102);
	expect(pl.content).toBe('## 命主口径\n命主口径丙');
});

describe('面板', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
	it('四页签在位;打开不写两把键;命主页签在有命主时出编辑器,保存才写键', ()=>{
		act(()=>{ ReactDOM.render(<PersonaMemoryPanel activeSource={{ id: 'c1', sourceType: 'chart', title: '张三' }} activeConversation={null} selectedTechniqueKeys={['bazi']} />, host); });
		expect(host.querySelector('[data-persona-tabs="1"]')).toBeTruthy();
		const tabs = Array.from(host.querySelectorAll('.ant-tabs-tab')).map((el)=>el.textContent.trim());
		expect(tabs).toEqual(['全局', '命主', '技法', '会话']);
		expect(window.localStorage.getItem(PERSONA_KEY)).toBe(null);
		expect(window.localStorage.getItem(PERSONA_LAYERS_KEY)).toBe(null);
		act(()=>{ Array.from(host.querySelectorAll('.ant-tabs-tab'))[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		const ed = host.querySelector('[data-persona-layer="subject"]');
		expect(ed && ed.getAttribute('data-persona-layer-id')).toBe('c1');
		const ta = ed.querySelector('textarea');
		act(()=>{ const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(ta, '此人是我父亲'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
		expect(window.localStorage.getItem(PERSONA_LAYERS_KEY)).toBe(null);
		act(()=>{ host.querySelector('[data-persona-layer-save="subject"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(readPersonaLayers().bySubject).toEqual({ c1: '此人是我父亲' });
	});
});
