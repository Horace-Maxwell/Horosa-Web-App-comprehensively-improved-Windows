// 问类高亮把正文拆成多个文字节点后,界面繁体的转换仍与「整段一个节点」逐字相同(高亮不改变转换结果):
// 每段都挂「整段 + 起始位次」,按整段转再取这一截。全部卦辞 / 注文 × 全部问类逐条比。
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LingQiMain from '../LingQiMain';
import { LINGQI_GUA } from '../data/lingqiJing';
import { lingqiToSimp } from '../data/lingqiT2S';
import { LINGQI_CATEGORY_KEYWORDS } from '../lingqiSnapshot';
import { toHant } from '../../../utils/scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../../../utils/scriptMode';

function allTexts(){
	const out = [];
	const walk = (v)=>{
		if(typeof v === 'string'){ if(v.length > 1){ out.push(v); } return; }
		if(Array.isArray(v)){ v.forEach(walk); return; }
		if(v && typeof v === 'object'){ Object.values(v).forEach(walk); }
	};
	walk(LINGQI_GUA);
	return out;
}

describe('灵棋问类高亮 × 界面繁体', ()=>{
	beforeEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(toHant); document.body.innerHTML = ''; });
	afterAll(()=>{ __resetScriptModeForTest(); });

	test('高亮拆出的每段按整段转换:与不高亮时逐字相同', async ()=>{
		const inst = Object.create(LingQiMain.prototype);
		const cases = [];
		Object.keys(LINGQI_CATEGORY_KEYWORDS).filter((c)=>LINGQI_CATEGORY_KEYWORDS[c].length).forEach((category)=>{
			inst.state = { display: 'simp', category };
			allTexts().forEach((t)=>{
				const out = inst.renderRich(t, 'x');
				if(!Array.isArray(out)){ return; }
				const div = document.createElement('div');
				div.innerHTML = ReactDOMServer.renderToStaticMarkup(<p>{out}</p>);
				document.body.appendChild(div);
				cases.push([div, lingqiToSimp(t), category]);
			});
		});
		expect(cases.length).toBeGreaterThan(300);
		await applyScriptMode(SCRIPT_HANT);
		const bad = cases.filter(([div, body])=>div.textContent !== toHant(body)).map(([, body, c])=>`${c}:${body.slice(0, 24)}`);
		expect(bad).toEqual([]);
		// 判别力:真有「拆开后各转会不同」的段落在用例里(囚系 → 囚繫)
		expect(cases.some(([, body])=>/囚系/.test(body))).toBe(true);
	});

	test('高亮仍在:命中的词包在 mark 里,正文与原文逐字相同', ()=>{
		const inst = Object.create(LingQiMain.prototype);
		inst.state = { display: 'simp', category: 'lawsuit' };
		const html = ReactDOMServer.renderToStaticMarkup(<p>{inst.renderRich('官事囚系难出', 'x')}</p>);
		const div = document.createElement('div');
		div.innerHTML = html;
		expect(div.textContent).toBe('官事囚系难出');
		expect(Array.from(div.querySelectorAll('mark')).map((m)=>m.textContent)).toEqual(['官事', '囚']);
	});
});
