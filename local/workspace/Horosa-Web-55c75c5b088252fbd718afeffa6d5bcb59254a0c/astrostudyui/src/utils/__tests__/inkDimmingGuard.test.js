// 信息文字淡化静态检查(全 src 的 .js / .less / .css):淡化信息字一律用次级字色变量,不许用透明度。
//
// 为什么:opacity(以及 rgba / #rrggbbaa 字色里的 alpha)把字和背景按比例混在一起 —— 宣纸底上次级灰字 ×0.5 只剩 2.2:1,
// 主文字 ×0.45 只剩 2.6:1;整行 / 整格透明度还会和外层透明度叠乘。次级字色 --horosa-text-secondary(明暗各有取值,
// 占星作用域里随 astro-muted)由主题合同保证 ≥ 4.5:1(utils/__tests__/themeContrastContract.test.js)。
//
// 判红:
//  ① JSX 行内样式 / 带字体属性的样式对象里写 opacity < 0.7(字面量),且元素承载文字;HTML 字符串里的 style="opacity:…" 同理;
//  ② .less / .css 规则里 opacity < 0.7;
//  ③ 字色本身带透明度:color 取 rgba / hsla / #rrggbbaa 且 alpha < 0.7。
// 不算(范围精确):禁用 / 关闭 / 忙碌等非活动态(WCAG 对非活动控件不设要求)、svg / canvas 绘制(fill / stroke、svg 元素)、
// 动画与过渡(@keyframes、同一规则 / 对象里有 opacity 过渡或动画)、遮罩 / 水印(pointer-events: none)、
// 不承载文字的元素(无子节点、只有图标 / 图片子节点)、opacity 取值不是字面量(按状态算出的,如 disabled ? .4 : 1)、opacity 0(隐藏)。
// 确属纯装饰、又不在上面几类里的,登记进下方 ALLOW(文件 + 命中行里的一段原文 + 理由);登记了却不再命中 = 红(过期登记)。
// 页面上真看到的颜色另由真 WebKit 扫荡复核:Horosa_Desktop_Installer/scripts/wkprobe/contrast_sweep.sh(缺省阈值 3.0)。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
const MIN_OPACITY = 0.7;

// 纯装饰 / 有意淡化且不承载信息的登记表:[文件(相对 src), 命中行里的一段原文, 理由]
const ALLOW = [
	['components/xuanshi/xuanshiTheme.less', '.xuanshi-evrow-dot', '事件行前的 6px 圆点(无字,纯装饰色块)'],
	['components/guolao/GuoLaoMoiraPanel.less', '.horosa-guolao-search-empty-icon', '搜索空态的大号装饰图标(旁边另有空态说明字)'],
	['layouts/app/21-lingqi.less', '.horosa-lingqi-chip.is-ghost .horosa-lingqi-chip-inner', '未起卦时的幽灵棋子(空态示意图形,棋面纹样不是信息字;旁边另有空态说明字)'],
	['layouts/app/21-lingqi.less', '.horosa-lingqi-chip.is-ghost .horosa-lingqi-chip-face.is-front', '同上:幽灵棋子棋面纹样(亮 / 暗两条)'],
];

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name === '__tests__' || e.name === 'node_modules' || e.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(less|css|js)$/.test(e.name)){
			out.push(p);
		}
	});
	return out;
}

// ── 公共 ──
const lowNum = (v)=>Number.isFinite(v) && v > 0 && v < MIN_OPACITY;
// 字色里的 alpha:rgba(…, a) / hsla(…, a) / rgb(… / a) / #rrggbbaa / #rgba
function colorAlpha(value){
	const v = `${value}`;
	let m = v.match(/\b(?:rgba?|hsla?)\(\s*[^()]*?(?:,|\/)\s*([\d.]+)(%?)\s*\)/i);
	if(m){
		const parts = v.match(/\b(?:rgba?|hsla?)\(([^()]*)\)/i)[1].split(/[,/]/);
		if(parts.length < 4){ return 1; }
		return m[2] ? +m[1] / 100 : +m[1];
	}
	m = v.match(/#([0-9a-f]{8}|[0-9a-f]{4})\b/i);
	if(m){
		const h = m[1];
		return h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : parseInt(h[3] + h[3], 16) / 255;
	}
	return 1;
}
// 只看 var(--x, 兜底) 之外的部分(变量解析得到时用不上兜底)
const outsideFallback = (value)=>{
	let v = `${value}`; let prev;
	do{ prev = v; v = v.replace(/var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, ''); }while(v !== prev);
	return v;
};

// 非活动态(禁用 / 关闭 / 忙碌 / 拖拽)选择器
const INACTIVE_SEL = /:disabled|\[disabled\]|disabled|[-.]is-(?:off|busy|loading|dragging)(?![\w-])/i;

// ════════════════ ① JS ════════════════
const SVG_TAGS = new Set('svg g text tspan textPath line path circle rect ellipse polygon polyline defs marker use image foreignObject clipPath mask pattern linearGradient radialGradient stop symbol'.split(' '));
const TEXT_PROPS = /^(fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|whiteSpace|textAlign|fontStyle|textOverflow|wordBreak|fontVariantNumeric)$/;
const MEDIA_TAG = /^(img|svg|canvas|video|Image|Avatar)$|(?:Outlined|Filled|TwoTone|Icon)$/;
const keyName = (p)=>p && p.key && (p.key.name || p.key.value);
const numOf = (n)=>{
	if(!n){ return NaN; }
	if(n.type === 'NumericLiteral'){ return n.value; }
	if(n.type === 'StringLiteral' && /^\s*\d*\.?\d+\s*$/.test(n.value)){ return parseFloat(n.value); }
	return NaN;
};
const tagName = (opening)=>{
	const n = opening.name;
	if(n.type === 'JSXIdentifier'){ return n.name; }
	if(n.type === 'JSXMemberExpression'){ return n.property.name; }
	return '';
};
const strProp = (obj, key)=>{
	const p = obj.properties.find((x)=>x.type === 'ObjectProperty' && keyName(x) === key);
	if(!p){ return null; }
	if(p.value.type === 'StringLiteral'){ return p.value.value; }
	if(p.value.type === 'TemplateLiteral'){ return p.value.quasis.map((q)=>q.value.cooked).join('${}'); }
	return '';
};
function elementCarriesText(el){
	const ch = (el.node.children || []).filter((c)=>!(c.type === 'JSXText' && !c.value.trim()));
	if(!ch.length){ return false; }
	return ch.some((c)=>{
		if(c.type === 'JSXText'){ return true; }
		if(c.type === 'JSXExpressionContainer'){ return c.expression.type !== 'JSXEmptyExpression'; }
		if(c.type === 'JSXElement'){ return !MEDIA_TAG.test(tagName(c.openingElement)); }
		return true;
	});
}
function insideSvg(el){
	for(let q = el.parentPath; q; q = q.parentPath){
		if(q.node.type === 'JSXElement' && SVG_TAGS.has(tagName(q.node.openingElement))){ return true; }
	}
	return false;
}

function scanJs(file, src){
	const hits = [];
	let ast;
	try{
		ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom', 'decorators-legacy'] });
	}catch(e){
		return [`${file}: 解析失败 ${e.message}`];
	}
	const lines = src.split('\n');
	const at = (node, what)=>`${file}:${node.loc.start.line} ${what} | ${lines[node.loc.start.line - 1].trim().slice(0, 140)}`;
	traverse(ast, {
		ObjectProperty(p){
			const key = keyName(p.node);
			const obj = p.parentPath.node;
			if(obj.type !== 'ObjectExpression'){ return; }
			if(key === 'color'){
				// ③ 字色带透明度
				const v = p.node.value.type === 'StringLiteral' ? p.node.value.value
					: (p.node.value.type === 'TemplateLiteral' ? p.node.value.quasis.map((q)=>q.value.cooked).join('') : null);
				if(v !== null && colorAlpha(outsideFallback(v)) < MIN_OPACITY){
					if(`${strProp(obj, 'pointerEvents')}` === 'none'){ return; }
					hits.push(at(p.node, `字色带透明度 ${v}`));
				}
				return;
			}
			if(key !== 'opacity'){ return; }
			const v = numOf(p.node.value);
			if(!lowNum(v)){ return; }   // 非字面量(按状态算出)/ ≥ 0.7 / 0(隐藏)
			const props = obj.properties.filter((x)=>x.type === 'ObjectProperty').map(keyName);
			if(props.includes('transition') || props.includes('animation')){ return; }   // 动画 / 过渡
			if(strProp(obj, 'pointerEvents') === 'none'){ return; }                        // 遮罩 / 水印
			if(strProp(obj, 'cursor') === 'not-allowed'){ return; }                        // 禁用态
			const holder = p.parentPath.parentPath;
			const attr = holder && holder.parentPath;
			const direct = holder && holder.node.type === 'JSXExpressionContainer' && attr && attr.node.type === 'JSXAttribute' && attr.node.name.name === 'style';
			if(direct){
				const opening = attr.parentPath.node;
				const el = attr.parentPath.parentPath;
				if(SVG_TAGS.has(tagName(opening)) || insideSvg(el)){ return; }
				if(opening.attributes.some((a)=>a.type === 'JSXAttribute' && a.name.name === 'disabled')){ return; }
				if(!elementCarriesText(el)){ return; }
				hits.push(at(p.node, `opacity ${v}`));
				return;
			}
			// 不直接挂在元素上的样式对象:带字体属性的才算文字样式(three.js 材质 / PDF 绘制参数之类不算)
			if(props.some((k)=>TEXT_PROPS.test(k))){ hits.push(at(p.node, `opacity ${v}`)); }
		},
		'StringLiteral|TemplateElement'(p){
			const raw = p.node.type === 'StringLiteral' ? p.node.value : p.node.value.cooked;
			if(!raw || raw.indexOf('style=') < 0){ return; }
			const re = /style=\\?["']([^"']*)\\?["']/g;
			let m = re.exec(raw);
			while(m){
				const st = m[1];
				if(!/pointer-events\s*:\s*none/.test(st) && !/transition\s*:[^;]*opacity/.test(st)){
					const op = st.match(/(?:^|;)\s*opacity\s*:\s*([\d.]+)/);
					if(op && lowNum(+op[1])){ hits.push(at(p.node, `HTML 字符串 opacity ${op[1]}`)); }
					const col = st.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
					if(col && colorAlpha(outsideFallback(col[1])) < MIN_OPACITY){ hits.push(at(p.node, `HTML 字符串字色带透明度 ${col[1]}`)); }
				}
				m = re.exec(raw);
			}
		},
	});
	return hits;
}

// ════════════════ ② ③ LESS / CSS ════════════════
function stripLessComments(s){
	let t = s.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' '));
	t = t.replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, p1)=>p1 + ' '.repeat(m.length - p1.length));
	return t;
}
// 规则树:每条规则 = { chain: [外层选择器…, 本层选择器], decls: [{ prop, value, line }] }(只含直属声明)
function lessRules(src){
	const s = stripLessComments(src);
	const rules = [];
	const stack = [{ chain: [], decls: [] }];
	let buf = ''; let bufLine = 1; let line = 1; let depthParen = 0;
	const flushDecl = ()=>{
		const t = buf.trim();
		if(t){
			const m = t.match(/^([a-zA-Z-]+)\s*:\s*([\s\S]+)$/);
			if(m){ stack[stack.length - 1].decls.push({ prop: m[1].toLowerCase(), value: m[2].trim(), line: bufLine }); }
		}
		buf = '';
	};
	for(let i = 0; i < s.length; i++){
		const c = s[i];
		if(c === '\n'){ line++; }
		if(c === '(' ){ depthParen++; }
		if(c === ')' ){ depthParen = Math.max(0, depthParen - 1); }
		if(depthParen === 0 && c === '{'){
			const sel = buf.trim().replace(/\s+/g, ' ');
			const parent = stack[stack.length - 1];
			const rule = { chain: [...parent.chain, sel], decls: [], line: bufLine };
			rules.push(rule); stack.push(rule); buf = ''; continue;
		}
		if(depthParen === 0 && c === ';'){ flushDecl(); continue; }
		if(depthParen === 0 && c === '}'){ flushDecl(); if(stack.length > 1){ stack.pop(); } continue; }
		if(!buf.trim()){ bufLine = line; }
		buf += c;
	}
	return rules;
}

function scanLess(file, src){
	const hits = [];
	lessRules(src).forEach((r)=>{
		const chain = r.chain.join(' ');
		if(/@keyframes/.test(chain)){ return; }
		const paint = r.decls.some((d)=>/^(?:fill|stroke)(?:-|$)/.test(d.prop));   // svg 绘制(含只写 stroke-width 的)
		const moving = r.decls.some((d)=>(d.prop === 'transition' && /opacity|all/.test(d.value)) || d.prop === 'animation' || d.prop === 'animation-name');
		const overlay = r.decls.some((d)=>d.prop === 'pointer-events' && /none/.test(d.value));
		const inactive = INACTIVE_SEL.test(chain);
		const sel = r.chain[r.chain.length - 1];
		r.decls.forEach((d)=>{
			if(d.prop === 'opacity'){
				const v = parseFloat(d.value);
				if(!lowNum(v) || inactive || paint || moving || overlay){ return; }
				hits.push(`${file}:${d.line} opacity ${v} | ${sel.slice(0, 140)}`);
			}else if(d.prop === 'color'){
				if(inactive){ return; }
				if(colorAlpha(outsideFallback(d.value)) < MIN_OPACITY){
					hits.push(`${file}:${d.line} 字色带透明度 ${d.value} | ${sel.slice(0, 140)}`);
				}
			}
		});
	});
	return hits;
}

// ════════════════ 汇总 ════════════════
const FILES = walk(SRC, []);
function allHits(){
	const out = [];
	FILES.forEach((f)=>{
		// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):`path.relative` 在 Windows 返回反斜杠分隔
		// (`components\guolao\GuoLaoMoiraPanel.less`),而 ALLOW 登记表按 POSIX 写法前缀匹配 ⇒ 合法登记全查不中、
		// 被报成违规,登记表反被判「过期」(macOS 恒绿)。命中串的文件名归一到 POSIX;判据零放宽。
		const rel = path.relative(SRC, f).split(path.sep).join('/');
		const src = fs.readFileSync(f, 'utf8');
		if(rel.endsWith('.js')){
			if(!/opacity|color/.test(src)){ return; }
			out.push(...scanJs(rel, src));
		}else{
			out.push(...scanLess(rel, src));
		}
	});
	return out;
}
const allowed = (hit)=>ALLOW.find(([f, needle])=>hit.startsWith(`${f}:`) && hit.indexOf(needle) >= 0);

describe('信息文字不许用透明度淡化(用次级字色变量)', ()=>{
	it('判据自证:构造的坏样本必须被抓到、好样本放过', ()=>{
		const js = (code)=>scanJs('t.js', code);
		// ① 坏样本
		expect(js('const a = <span style={{ fontSize: 11, opacity: 0.6 }}>说明</span>;')).toHaveLength(1);
		expect(js('const a = <div style={{ opacity: .5 }}>{x}</div>;')).toHaveLength(1);
		expect(js("const a = <tr style={{ opacity: '0.65' }}><th>座</th></tr>;")).toHaveLength(1);
		expect(js('const hint = { fontSize: 11, opacity: 0.55 };')).toHaveLength(1);
		expect(js("const h = '<div style=\"opacity:.65\">更多</div>';")).toHaveLength(1);
		expect(js("const a = <i style={{ color: 'rgba(255,255,255,0.45)' }}>说明</i>;")).toHaveLength(1);
		// ① 好样本
		expect(js("const a = <span style={{ color: 'var(--horosa-text-secondary)' }}>说明</span>;")).toHaveLength(0);
		expect(js('const a = <span style={{ opacity: 0.7 }}>说明</span>;')).toHaveLength(0);
		expect(js('const a = <span style={{ opacity: disabled ? 0.4 : 1 }}>说明</span>;')).toHaveLength(0);
		expect(js("const a = <span style={{ opacity: 0.4, transition: 'opacity .2s' }}>说明</span>;")).toHaveLength(0);
		expect(js("const a = <div style={{ opacity: 0.2, pointerEvents: 'none' }}>印</div>;")).toHaveLength(0);
		expect(js("const a = <span style={{ opacity: 0.4, cursor: 'not-allowed' }}>说明</span>;")).toHaveLength(0);
		expect(js('const a = <button disabled style={{ opacity: 0.4 }}>确定</button>;')).toHaveLength(0);
		expect(js('const a = <svg><text style={{ opacity: 0.5 }}>子</text></svg>;')).toHaveLength(0);
		expect(js('const a = <line style={{ opacity: 0.5 }} />;')).toHaveLength(0);
		expect(js('const a = <div style={{ opacity: 0.22 }}><img src={x} /></div>;')).toHaveLength(0);
		expect(js('const a = <span style={{ opacity: 0.5 }}><CloseOutlined /></span>;')).toHaveLength(0);
		expect(js('const m = new LineMaterial({ color, transparent: true, opacity: 0.5 });')).toHaveLength(0);
		expect(js('const a = <div style={{ opacity: 0 }}>{x}</div>;')).toHaveLength(0);
		expect(js("const a = <i style={{ color: 'var(--horosa-x, rgba(0,0,0,.3))' }}>说明</i>;")).toHaveLength(0);
		// ② ③ less
		const less = (code)=>scanLess('t.less', code);
		expect(less('.a { font-size: 12px; opacity: .6; }')).toHaveLength(1);
		expect(less(':global { .a { &.is-kong { opacity: 0.62; } } }')).toHaveLength(1);
		expect(less('.a { color: rgba(74, 63, 48, 0.55); }')).toHaveLength(1);
		expect(less('.a { color: #2b262080; }')).toHaveLength(1);
		expect(less('.a::placeholder { color: rgba(239, 228, 210, 0.42); }')).toHaveLength(1);
		expect(less('.a { color: var(--horosa-text-secondary); }')).toHaveLength(0);
		expect(less('.a { background: rgba(0,0,0,.2); border-color: rgba(1,2,3,.3); opacity: 0.8; }')).toHaveLength(0);
		expect(less('.a:disabled { opacity: .45; } .b[disabled] { opacity: .4; } .c.is-off { opacity: .45; } .d-disabled { opacity: .5; }')).toHaveLength(0);
		expect(less('@keyframes p { 0% { opacity: .3; } 100% { opacity: 1; } }')).toHaveLength(0);
		expect(less('.a { stroke: var(--x); opacity: .5; } .b { fill: red; opacity: .2; } .c { stroke-width: 1; opacity: .5; }')).toHaveLength(0);
		expect(less('.a { opacity: 0.5; transition: opacity .15s ease; }')).toHaveLength(0);
		expect(less('/* .a { opacity: .3 } */ // .b { opacity: .2 }\n.c { color: var(--x, rgba(0,0,0,.3)); }')).toHaveLength(0);
		expect(less('.a { color: rgba(239, 228, 210, 0.8); }')).toHaveLength(0);
	});

	it('判据没失明:扫到的文件数像样', ()=>{
		expect(FILES.filter((f)=>f.endsWith('.less')).length).toBeGreaterThan(30);
		expect(FILES.filter((f)=>f.endsWith('.js')).length).toBeGreaterThan(500);
	});

	it('全仓:信息文字没有用 opacity < 0.7 / 低 alpha 字色淡化(登记表之外)', ()=>{
		const bad = allHits().filter((h)=>!allowed(h));
		expect(bad).toEqual([]);
	});

	it('真机扫荡的缺省阈值 = 3.0(信息字底线;扫荡脚本不在的检出里跳过)', ()=>{
		const dir = path.resolve(SRC, '../../../Horosa_Desktop_Installer/scripts/wkprobe');
		const sh = path.join(dir, 'contrast_sweep.sh');
		if(!fs.existsSync(sh)){ return; }
		expect(fs.readFileSync(sh, 'utf8')).toMatch(/MIN=\$\{5:-3\.0\}/);
		expect(fs.readFileSync(path.join(dir, 'contrast_sweep.tpl.js'), 'utf8')).toMatch(/Number\('__MIN__'\) \|\| 3\.0/);
	});

	it('登记表:每条都写了理由,且仍命中(不再命中 = 过期登记,删掉;文件本身不在的不算)', ()=>{
		ALLOW.forEach(([f, needle, why])=>{ expect([f, needle, `${why || ''}`.trim().length > 4]).toEqual([f, needle, true]); });
		const hits = allHits();
		const stale = ALLOW.filter(([f, needle])=>fs.existsSync(path.join(SRC, f)) && !hits.some((h)=>h.startsWith(`${f}:`) && h.indexOf(needle) >= 0)).map(([f, n])=>`${f} ${n}`);
		expect(stale).toEqual([]);
	});
});
