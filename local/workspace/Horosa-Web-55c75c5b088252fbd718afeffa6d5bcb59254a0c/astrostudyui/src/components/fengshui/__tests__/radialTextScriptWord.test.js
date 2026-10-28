// 风水圆盘逐字竖排(RadialText:罗经各层 / 线法 / 六十四卦圆图)在繁体下按整词定字:
// 一简多繁的字逐字转会丢词境(「天后」逐字 → 天後),整词转才对;罗经现有全部多字标签逐字画 = 整词转。
import React from 'react';
import ReactDOM from 'react-dom';
import { RadialText } from '../charts/chartGeom';
import { toHant } from '../../../utils/scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../../../utils/scriptMode';
import * as FD from '../fengshuiData';

const flush = ()=>new Promise((r)=>setTimeout(r, 60));
function renderWords(words){
	const host = document.createElement('div');
	document.body.appendChild(host);
	ReactDOM.render(React.createElement('svg', null, words.map((w, i)=>React.createElement('g', { key: i, id: `w${i}` },
		React.createElement(RadialText, { cx: 100, cy: 100, rIn: 10, rOut: 90, deg: 0, text: w, fs: 10, fill: 'red' })))), host);
	return host;
}
const textOf = (host, i)=>Array.from(host.querySelectorAll(`#w${i} text`)).map((t)=>t.textContent).join('');

describe('RadialText × 繁体', ()=>{
	beforeEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(toHant); document.body.innerHTML = ''; });
	afterAll(()=>{ __resetScriptModeForTest(); });
	test('一简多繁的词:逐字画仍按整词转', async ()=>{
		const words = ['天后', '干支', '历法'];
		const host = renderWords(words);
		await applyScriptMode(SCRIPT_HANT);
		await flush();
		words.forEach((w, i)=>{ expect(textOf(host, i)).toBe(toHant(w)); });
	});
	test('罗经全部层与穿山 / 透地 / 分金的多字标签:逐字画 = 整词转', async ()=>{
		const labels = new Set();
		(FD.LUOPAN_LAYERS || []).forEach((l)=>(l.cells || []).forEach((c)=>{ if(c && c.label){ labels.add(`${c.label}`); } }));
		['CHUANSHAN_72', 'TOUDI_60', 'FENJIN_120'].forEach((k)=>(FD[k] || []).forEach((c)=>{ if(c && c.label){ labels.add(`${c.label}`); } }));
		const words = Array.from(labels).filter((s)=>s.length > 1);
		expect(words.length).toBeGreaterThan(50);
		const host = renderWords(words);
		await applyScriptMode(SCRIPT_HANT);
		await flush();
		const bad = words.filter((w, i)=>textOf(host, i) !== toHant(w));
		expect(bad).toEqual([]);
	});
});
