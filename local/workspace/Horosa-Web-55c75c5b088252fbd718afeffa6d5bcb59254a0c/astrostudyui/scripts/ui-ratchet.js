#!/usr/bin/env node
/*
 * ui-ratchet.js —— 前端可维护性棘轮(判据单源:jest uiEngineeringRatchet 与本命令行读同一份)。
 *
 * 逐文件数九项「以后不该再多」的写法,与基线比:任何文件的任何一项只许减少、不许增加(新文件按 0 起算)。
 * 存量不逼一次改完 —— 改到哪个文件顺手迁掉,跑一次 --write 基线自动往下收;要真加一处,必须在提交里显式改基线。
 *
 *   样式(.less)
 *     important     !important 次数(层叠靠权重与单源规则解决,不靠一层层加 !important)
 *     zIndexLiteral 写死的全站层级 ≥ 100(走 --horosa-z-* 命名档位;0–99 是组件内局部叠放,不计;脚本行内 zIndex 同算)
 *     fontLiteral   写死的字号(走 --horosa-fs-* 字号档位)
 *     colorLiteral  写死的颜色(走 --horosa-* 主题变量;变量定义行与 var(…) 里的兜底值不计)
 *   脚本(components / pages / layouts 下的 .js)
 *     rawAntd       直接从 antd 引入的基础控件(Switch / Checkbox / InputNumber / Radio / Slider / Spin / Empty;用 xq-ui 统一件)
 *     nativeInput   原生 <input type=number|checkbox|radio|range>(日期 / 时间框有意用原生 + 主题类,不计)
 *     inlineColor   行内样式写死的颜色(同一行带 var(--…) 的不计)
 *     inlineFont    行内样式写死的数字字号
 *     kbUnreachable 用 div / span / li / td … 做的可点元素没有键盘入口(用 utils/pressable 或改 button)
 *   全部源码
 *     lines         超过 LINE_LIMIT 行的文件:不许再长过基线 + LINE_SLACK(数据表目录与 .json 不计)
 *
 * 用法:
 *   node scripts/ui-ratchet.js                 汇总当前计数、与基线的差
 *   node scripts/ui-ratchet.js --write         把基线收到当前值(只接受下降;有上升时拒写并列出)
 *   node scripts/ui-ratchet.js --write --accept-increase   连上升一起写进基线(显式决策,提交里要说明原因)
 *   node scripts/ui-ratchet.js --check-tight   基线必须恰等于当前值(发布前自检用:改好了却没收基线 = 红)
 * 退出码:0 绿;1 有上升 / 基线不紧;2 用法错。
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(UI_ROOT, 'src');
const BASE_SHARED = path.join(__dirname, 'ui-ratchet.baseline.json');
// 附加基线:EXTRA_MARK 非空时,全文含这个字样的文件计入 BASE_EXTRA,不进上面那份(两项都空 = 只有一份基线)
let BASE_EXTRA = '';
let EXTRA_MARK = '';
// 主基线按 projectionOf(全文) 计数;全文比它多出来的那部分计入附加基线(缺省原样返回 = 没有这回事)
let projectionOf = (text)=>text;

const LINE_LIMIT = 1500;
const Z_GLOBAL_MIN = 100;   // 全站层级下限:以下是组件内局部叠放
const LINE_SLACK = 40;
const RAW_ANTD = ['Switch', 'Checkbox', 'InputNumber', 'Radio', 'Slider', 'Spin', 'Empty'];
const STYLE_METRICS = ['important', 'zIndexLiteral', 'fontLiteral', 'colorLiteral'];
const SCRIPT_METRICS = ['rawAntd', 'nativeInput', 'inlineColor', 'inlineFont', 'kbUnreachable'];
const METRICS = STYLE_METRICS.concat(SCRIPT_METRICS);
const METRIC_HINT = {
	important: '层叠冲突改权重 / 单源规则,别再加 !important',
	zIndexLiteral: '≥ 100 的全站层级用 var(--horosa-z-*) 档位(见 layouts/app/01-base.less)',
	fontLiteral: 'font-size 用 var(--horosa-fs-*) 档位',
	colorLiteral: '颜色用 var(--horosa-*) 主题变量(亮暗两套自动跟)',
	rawAntd: '基础控件从 components/xq-ui 引入(XQSwitch / XQCheckbox / XQInputNumber / XQRadio / XQSlider / XQSpin / XQEmpty)',
	nativeInput: '数字 / 复选 / 单选 / 滑块用 xq-ui 统一件(XQInputNumber / XQCheckbox / XQRadio / XQSlider)',
	inlineColor: '行内颜色用 var(--horosa-*) 变量',
	inlineFont: '行内字号用 var(--horosa-fs-*) 或挪进样式表',
	kbUnreachable: '可点的 div / span 用 {...pressable(handler)}(utils/pressable)或改成 <button>',
	lines: `文件超过 ${LINE_LIMIT} 行后不许再长:按职责拆子模块(登记 scripts/source-sets.json)`,
};

// ── 文件清单 ──
const SKIP_DIRS = new Set(['__tests__', '.umi', '.umi-production', '.umi-test', 'node_modules']);
function walk(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.isDirectory()){ if(!SKIP_DIRS.has(d.name)){ walk(path.join(dir, d.name), out); } return; }
		if(/\.(js|less)$/.test(d.name)){ out.push(path.join(dir, d.name)); }
	});
	return out;
}
const rel = (abs)=>path.relative(SRC, abs).split(path.sep).join('/');
const SCRIPT_SCOPE = /^(components|pages|layouts)\//;
const isDataFile = (r)=>/(^|\/)data\//.test(r);

// ── 公用文本处理 ──
function stripComments(text, isLess){
	let t = text.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' '));
	// 行注释:不在字符串 / url( 里的 //(保守:前一字符不是 : 才算,避开 http://)
	t = t.replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
	return t;
}
// 把 var(…) 整段(含嵌套括号)换成空格:兜底值里的颜色 / 字号不算写死
function blankVars(text){
	let out = '';
	let i = 0;
	while(i < text.length){
		if(text.startsWith('var(', i)){
			let depth = 0;
			let j = i + 3;
			for(; j < text.length; j += 1){
				if(text[j] === '('){ depth += 1; }
				else if(text[j] === ')'){ depth -= 1; if(depth === 0){ break; } }
			}
			out += ' '.repeat(j - i + 1);
			i = j + 1;
		}else{
			out += text[i];
			i += 1;
		}
	}
	return out;
}
const count = (s, re)=>(s.match(re) || []).length;

// ── 样式四项 ──
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
function measureLess(text){
	const t = stripComments(text, true);
	const out = { important: count(t, /!important/g), zIndexLiteral: 0, fontLiteral: 0, colorLiteral: 0 };
	// 声明:属性名(不以 -- / @ 开头)+ 值;选择器里的 a:hover { 之类没有颜色 / 层级 / 字号,误配无害
	const DECL = /(^|[;{\s])([a-z][a-z-]*)\s*:\s*([^;{}]+)/g;
	let m;
	while((m = DECL.exec(t)) !== null){
		const prop = m[2];
		const val = blankVars(m[3]);
		if(prop === 'z-index'){
			const n = /^\s*(-?\d+)/.exec(val);
			if(n && Math.abs(Number(n[1])) >= Z_GLOBAL_MIN){ out.zIndexLiteral += 1; }
		}else if(prop === 'font-size'){
			if(/\d(?:\.\d+)?(?:px|em|rem)\b/.test(val)){ out.fontLiteral += 1; }
		}
		if(prop !== 'z-index' && prop !== 'font-size'){ out.colorLiteral += count(val, COLOR_RE); }
	}
	return out;
}

// ── 脚本四项 ──
// 从 '<tag' 起扫到同层的 '>'(跳过 {…} 表达式与引号),回开始标签全文
function openingTag(text, start){
	let depth = 0;
	let q = null;
	for(let i = start + 1; i < text.length; i += 1){
		const c = text[i];
		if(q){ if(c === q && text[i - 1] !== '\\'){ q = null; } continue; }
		if(c === '"' || c === "'" || c === '`'){ q = c; continue; }
		if(c === '{'){ depth += 1; continue; }
		if(c === '}'){ depth -= 1; continue; }
		if(c === '>' && depth === 0){ return text.slice(start, i + 1); }
	}
	return text.slice(start, Math.min(text.length, start + 400));
}
const CLICKABLE_TAG = /<(div|span|li|td|tr|p|section|article|header|footer|i|em|strong|small|b|img)\b/g;
function measureJs(text, r){
	const t = stripComments(text, false);
	const out = { rawAntd: 0, nativeInput: 0, inlineColor: 0, inlineFont: 0, kbUnreachable: 0, zIndexLiteral: 0 };
	out.nativeInput = count(t, /<input\b[^>]*\btype\s*=\s*['"{]?['"]?(?:number|checkbox|radio|range)\b/g);
	(t.match(/\bzIndex\s*:\s*['"]?(-?\d+)/g) || []).forEach((z)=>{ if(Math.abs(Number(/(-?\d+)/.exec(z)[1])) >= Z_GLOBAL_MIN){ out.zIndexLiteral += 1; } });
	if(!/^components\/xq-ui\//.test(r)){
		const IMP = /import\s*\{([^}]*)\}\s*from\s*['"]antd['"]/g;
		let m;
		while((m = IMP.exec(t)) !== null){
			m[1].split(',').map((x)=>x.trim().split(/\s+as\s+/)[0]).forEach((n)=>{ if(RAW_ANTD.indexOf(n) >= 0){ out.rawAntd += 1; } });
		}
		const SUB = /from\s*['"]antd\/(?:lib|es)\/(switch|checkbox|input-number|radio|slider|spin|empty)['"]/g;
		out.rawAntd += count(t, SUB);
	}
	t.split('\n').forEach((line)=>{
		if(line.indexOf('var(--') >= 0){ return; }
		out.inlineColor += count(line, /\b(?:color|background(?:Color)?|border(?:Color|Top|Bottom|Left|Right)?|fill|stroke|outline(?:Color)?)\s*:\s*['"](?:#[0-9a-fA-F]{3,8}|rgba?\([^'"]*\)|white|black)['"]/g);
	});
	out.inlineFont = count(t, /\bfontSize\s*:\s*['"]?\d/g);
	let m;
	CLICKABLE_TAG.lastIndex = 0;
	while((m = CLICKABLE_TAG.exec(t)) !== null){
		const tag = openingTag(t, m.index);
		if(!/\bonClick\s*=/.test(tag)){ continue; }
		if(/\bonKey(?:Down|Up|Press)\s*=/.test(tag) || /\{\s*\.\.\.\s*pressable\(/.test(tag) || /\baria-hidden\s*=\s*(?:"true"|\{true\})/.test(tag) || /\brole\s*=\s*"(?:presentation|none)"/.test(tag)){ continue; }   // presentation = 不是操作(只拦冒泡 / 点遮罩关闭,键盘入口是 Esc)
		out.kbUnreachable += 1;
	}
	return out;
}

// ── 汇总 ──
function measureAll(srcRoot = SRC){
	const shared = { metrics: {}, lines: {} };
	const extra = { metrics: {}, lines: {} };
	METRICS.forEach((k)=>{ shared.metrics[k] = {}; extra.metrics[k] = {}; });
	walk(srcRoot).forEach((abs)=>{
		const r = path.relative(srcRoot, abs).split(path.sep).join('/');
		const text = fs.readFileSync(abs, 'utf8');
		const wholeExtra = !!EXTRA_MARK && text.indexOf(EXTRA_MARK) >= 0;
		const bucket = wholeExtra ? extra : shared;
		const body = wholeExtra ? text : projectionOf(text);
		const count = (src)=>(abs.endsWith('.less') ? measureLess(src) : (SCRIPT_SCOPE.test(r) ? measureJs(src, r) : {}));
		const vals = count(body);
		Object.keys(vals).forEach((k)=>{ if(vals[k] > 0){ bucket.metrics[k][r] = vals[k]; } });
		if(body !== text){
			const full = count(text);
			Object.keys(full).forEach((k)=>{ const more = full[k] - (vals[k] || 0); if(more > 0){ extra.metrics[k][r] = more; } });
		}
		if(!isDataFile(r)){
			const n = body.split('\n').length;
			if(n > LINE_LIMIT){ bucket.lines[r] = n; }
		}
	});
	return { shared, extra };
}

const core = require('./ratchet-core');
const loadBase = core.loadBase;

// 与基线比:回 { increases: [...], loose: [...] }(increases = 新增 / 上升;loose = 基线比当前宽)。九项走公共核,超长文件项本工具自比(带余量)
function compare(cur, base){
	const { increases, loose } = core.compareMetrics(cur, base, METRICS);
	Object.keys(cur.lines).forEach((f)=>{
		const b = base.lines[f];
		if(b === undefined){ increases.push({ metric: 'lines', file: f, base: LINE_LIMIT, cur: cur.lines[f] }); }
		else if(cur.lines[f] > b + LINE_SLACK){ increases.push({ metric: 'lines', file: f, base: b, cur: cur.lines[f] }); }
	});
	Object.keys(base.lines).forEach((f)=>{ if((cur.lines[f] || 0) < base.lines[f]){ loose.push({ metric: 'lines', file: f, base: base.lines[f], cur: cur.lines[f] || 0 }); } });
	return { increases, loose };
}

const totals = (side)=>({ ...core.sumMetrics(side, METRICS), ['lines(>' + LINE_LIMIT + ')']: Object.keys(side.lines).length });

function writeBase(file, side, isExtra){
	core.writeBaseFile(file, side, {
		metrics: METRICS, isExtra, marker: EXTRA_MARK, withLines: true,
		doc: '前端可维护性棘轮基线(scripts/ui-ratchet.js):逐文件计数只许减少。改好了跑 npm run ratchet:ui -- --write 收紧;真要增加须加 --accept-increase 并在提交里说明。',
	});
}

function main(argv){
	const known = ['--write', '--accept-increase', '--check-tight'];
	if(argv.some((a)=>known.indexOf(a) < 0)){ return core.runRatchetCli({ tag: 'ui-ratchet', argv, sides: [] }); }   // 用法错走公共核同一报错
	const { shared, extra } = measureAll();
	return core.runRatchetCli({
		tag: 'ui-ratchet', argv,
		sides: [['主', shared, BASE_SHARED, false]].concat(BASE_EXTRA ? [['附加', extra, BASE_EXTRA, true]] : []),
		compare, totals, writeBase, hint: (k)=>METRIC_HINT[k], fixCmd: 'npm run ratchet:ui -- --write',
	});
}

module.exports = { measureLess, measureJs, measureAll, compare, loadBase, METRICS, LINE_LIMIT, LINE_SLACK, RAW_ANTD, BASE_SHARED, BASE_EXTRA, EXTRA_MARK, projectionOf, METRIC_HINT };

if(require.main === module){ process.exit(main(process.argv.slice(2))); }
