// 印占「问事」与风险区开关的样式必须写在 :global{} 里。
// app.less 走 CSS Modules:落在 :global 之外的类会被哈希成 .horosa-india-prashna-schools___xxxx,
// 与 IndiaChartMain 里的裸类名永不命中 —— 写了等于没写。
// 判据按括号配平算出的真实嵌套(不看缩进),单行规则 `.a { … }` 也算在内。
import fs from 'fs';
import path from 'path';
const { readSource } = require('../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = readSource(path.join(__dirname, '..', 'app.less'));

/** 逐字符扫描:收集每条规则的选择器与祖先栈;跳过块注释、行注释(括号外)与字符串。 */
function scanRules(src){
	const rules = [];
	const stack = [];
	let buf = '';
	let inBlock = false;
	let inStr = null;
	let paren = 0;
	for(let i = 0; i < src.length; i += 1){
		const c = src[i];
		const n = src[i + 1];
		if(inBlock){
			if(c === '*' && n === '/'){ inBlock = false; i += 1; }
			continue;
		}
		if(inStr){
			buf += c;
			if(c === '\\'){ buf += n; i += 1; continue; }
			if(c === inStr){ inStr = null; }
			continue;
		}
		if(c === '/' && n === '*'){ inBlock = true; i += 1; continue; }
		if(c === '/' && n === '/' && paren === 0){
			while(i < src.length && src[i] !== '\n'){ i += 1; }
			continue;
		}
		if(c === '"' || c === "'"){ inStr = c; buf += c; continue; }
		if(c === '('){ paren += 1; }
		if(c === ')'){ paren -= 1; }
		if(c === '{'){
			const sel = buf.trim();
			rules.push({ sel, stack: stack.slice() });
			stack.push(sel);
			buf = '';
			continue;
		}
		if(c === '}'){ stack.pop(); buf = ''; continue; }
		if(c === ';'){ buf = ''; continue; }
		buf += c;
	}
	return { rules, openAtEnd: stack.length };
}

const { rules: RULES, openAtEnd } = scanRules(SRC);
const inGlobal = (r)=>r.sel.startsWith(':global') || r.stack.some((s)=>s.startsWith(':global'));

// 印占问事页(IndiaChartMain)用到的裸类名对应的 8 条规则
const PRASHNA_RULES = [
	'.horosa-india-prashna-schools',
	'.horosa-india-prashna-school',
	'.horosa-india-prashna-actions',
	'.horosa-india-prashna-verdict',
	'.horosa-india-prashna-verdict.is-ji',
	'.horosa-india-prashna-verdict.is-xiong',
	'.horosa-india-prashna-csl .horosa-india-data-row',
	'.horosa-india-risk-toggle',
];

describe('app.less · 印占问事样式作用域', ()=>{
	test('扫描器自检:括号配平、规则数量级正常', ()=>{
		expect(openAtEnd).toBe(0);
		expect(RULES.length).toBeGreaterThan(2000);
		expect(RULES.some((r)=>r.sel === ':global')).toBe(true);
	});

	test('8 条问事 / 风险区开关规则都在,且都在 :global 内', ()=>{
		const report = PRASHNA_RULES.map((sel)=>{
			const hits = RULES.filter((r)=>r.sel === sel);
			if(!hits.length){ return `${sel}: 缺失`; }
			const outside = hits.filter((r)=>!inGlobal(r));
			return outside.length ? `${sel}: ${outside.length} 处在 :global 外` : `${sel}: ok`;
		});
		expect(report).toEqual(PRASHNA_RULES.map((sel)=>`${sel}: ok`));
	});

	test('全文件凡含 horosa-india-prashna- / horosa-india-risk- 的规则一律在 :global 内', ()=>{
		const outside = RULES
			.filter((r)=>/horosa-india-(prashna|risk)-/.test(r.sel))
			.filter((r)=>!inGlobal(r))
			.map((r)=>r.sel.slice(0, 80));
		expect(outside).toEqual([]);
	});

	test('这 8 条的字色只用主题令牌(随亮 / 暗主题切换),不写死白底', ()=>{
		PRASHNA_RULES.forEach((sel)=>{
			const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const m = SRC.match(new RegExp(`^${esc}\\s*\\{([^}]*)\\}`, 'm'));
			expect(m).toBeTruthy();
			const body = m[1];
			expect(body).not.toMatch(/background\s*:\s*(#fff\b|#ffffff\b|white\b)/i);
			const color = body.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
			if(color){
				expect(`${sel} → ${color[1].trim()}`).toMatch(/→ var\(--horosa-/);
			}
		});
	});

	test('判色令牌在亮、暗两套外观里都有定义', ()=>{
		['--horosa-jx-ji', '--horosa-jx-xiong'].forEach((tok)=>{
			const defs = SRC.match(new RegExp(`${tok}\\s*:`, 'g')) || [];
			expect(`${tok}:${defs.length >= 2}`).toBe(`${tok}:true`);
		});
	});
});
