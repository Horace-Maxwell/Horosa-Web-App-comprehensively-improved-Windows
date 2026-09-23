// 盘面随主题重画 · 合同(FL-20260922-1:切明暗后宿盘 / 七政 / 六壬 / 卦…停在旧色)。三条机械锁 + 行为断言:
//   ① 凡「宿主组件」(挂着 svg / canvas 并命令式 draw 的类组件)必挂 watchChartAppearance(…)(单源订阅),豁免只许带理由且理由仍成立;
//   ② 组件里不许再各自 new MutationObserver 观察 data-horosa-appearance(单源在 utils/appearance.js);
//   ③ 盘面调色板 setColorTheme( 只在 utils/appearance.js 切(app.js / index.js 只调 syncChartPalette);
//   行为:applyAppearanceToDocument 先换调色板再改根属性再广播;订阅合帧、去重、卸载后不回调;light ↔ dark 映射到 主题古老 / 主题暗夜。
const fs = require('fs');
const path = require('path');
import * as AstroConst from '../../constants/AstroConst';
import { applyAppearanceToDocument, subscribeAppearance, syncChartPalette, chartColorThemeFor, currentAppearance, APPEARANCE_APPLIED_EVENT, DARK_CHART_COLOR_THEME, APPEARANCE_DARK, APPEARANCE_LIGHT } from '../appearance';
import { watchChartAppearance } from '../chartDrawGuard';

const SRC = path.resolve(__dirname, '..', '..');
const COMPONENTS = path.join(SRC, 'components');
// 豁免(理由必须仍成立:本测试会验证豁免文件确实不含 watchChartAppearance,且理由里点名的特征仍在)
const ALLOW = {
	'components/lrzhan/LiuRengMain.js': { why: 'new ChuangChart 只用来算三传(owner:null,不 draw 到 svg);页面 DOM 走 CSS 变量', needle: 'owner: null' },
	'components/sanshi/SanShiUnitedMain.js': { why: 'new ChuangChart 只用来算三传(owner:null,不 draw 到 svg);页面 DOM 走 CSS 变量', needle: 'owner: null' },
	'components/xuanshi/XuanShiPersons.js': { why: 'd3 力导图颜色全走 var(--horosa-*)(SVG 属性随 CSS 变量即时变色,无烘焙)', needle: 'var(--horosa' },
	'components/fengshui/FengShuiMain.js': { why: '风水画布只在用户户型图之上作画(引擎 drawAll 无图即返回),墨色按照片对比度定、不随界面主题;画布宿主底色走 CSS 变量', needle: 'new FengShuiEngine(canvas' },
};
const HOST_RE = /AstroColor\.|d3\.select\(|getContext\('2d'\)|new [A-Z]\w*Chart\(|new FengShuiEngine\(/;

function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const f = path.join(dir, n);
		if(n === '__tests__' || n === 'node_modules'){ return; }
		if(fs.statSync(f).isDirectory()){ walk(f, out); } else if(/\.js$/.test(n) && !/\.test\.js$/.test(n)){ out.push(f); }
	});
	return out;
}
function census(){
	return walk(COMPONENTS, []).filter((f)=>{
		const s = fs.readFileSync(f, 'utf8');
		return /componentDidMount|useEffect\(/.test(s) && HOST_RE.test(s);
	}).map((f)=>path.relative(SRC, f).split(path.sep).join('/'));
}
const flush = ()=>new Promise((r)=>setTimeout(r, 40));

describe('源码级三锁', ()=>{
	it('🔴 ① 每个宿主组件都挂 watchChartAppearance(;豁免带理由且理由仍成立', ()=>{
		const hosts = census();
		expect(hosts.length).toBeGreaterThanOrEqual(20);
		const missing = [];
		hosts.forEach((rel)=>{
			const s = fs.readFileSync(path.join(SRC, rel), 'utf8');
			const wired = s.indexOf('watchChartAppearance(') >= 0;
			const allow = ALLOW[rel];
			if(allow){
				expect({ rel, wired, why: allow.why }).toEqual({ rel, wired: false, why: allow.why });   // 豁免文件不该也挂(挂了就把豁免删掉)
				expect({ rel, needle: allow.needle, present: s.indexOf(allow.needle) >= 0 }).toEqual({ rel, needle: allow.needle, present: true });
				return;
			}
			if(!wired){ missing.push(rel); }
		});
		expect(missing).toEqual([]);
		// 豁免表里的文件必须真在普查集里(否则是过期豁免)
		Object.keys(ALLOW).forEach((rel)=>expect({ rel, inCensus: hosts.indexOf(rel) >= 0 }).toEqual({ rel, inCensus: true }));
	});
	it('🔴 ② 组件里零私自观察 data-horosa-appearance;③ setColorTheme( 只在 utils/appearance.js', ()=>{
		const offenders = walk(COMPONENTS, []).filter((f)=>/attributeFilter:\s*\[[^\]]*data-horosa-appearance/.test(fs.readFileSync(f, 'utf8'))).map((f)=>path.relative(SRC, f));
		expect(offenders).toEqual([]);
		const callers = walk(SRC, []).filter((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			if(rel === 'constants/AstroConst.js' || rel === 'utils/appearance.js'){ return false; }
			return /setColorTheme\(/.test(fs.readFileSync(f, 'utf8'));
		}).map((f)=>path.relative(SRC, f));
		expect(callers).toEqual([]);
		['layouts/app.js', 'pages/index.js'].forEach((rel)=>expect({ rel, sync: /syncChartPalette\(resolvedAppearance\)/.test(fs.readFileSync(path.join(SRC, rel), 'utf8')) }).toEqual({ rel, sync: true }));
	});
	it('主题按钮带审计锚(真机审计按真实路径点)', ()=>{
		expect(fs.readFileSync(path.join(COMPONENTS, 'homepage', 'PageHeader.js'), 'utf8')).toContain('data-appearance-toggle="1"');
	});
});

describe('行为', ()=>{
	beforeEach(()=>{ document.documentElement.removeAttribute('data-horosa-appearance'); syncChartPalette(APPEARANCE_LIGHT); });
	it('映射:light → 缺省主题;dark → 主题暗夜(AstroColor8,盘底 #081622)', ()=>{
		expect(chartColorThemeFor(APPEARANCE_LIGHT)).toBe(AstroConst.DefaultColorTheme);
		expect(chartColorThemeFor(APPEARANCE_DARK)).toBe(DARK_CHART_COLOR_THEME);
		expect(AstroConst.colorThemes[DARK_CHART_COLOR_THEME]).toBe('主题暗夜');
		expect(syncChartPalette(APPEARANCE_DARK).ChartBackgroud).toBe('#081622');
		expect(syncChartPalette(APPEARANCE_LIGHT).ChartBackgroud).toBe('#FFFFFF');
	});
	it('🔴 applyAppearanceToDocument:调色板先到位 → 根属性 → 广播(监听方收到时两者都已就绪)', ()=>{
		const seen = [];
		const h = ()=>{ seen.push({ attr: document.documentElement.getAttribute('data-horosa-appearance'), bg: AstroConst.AstroColor.ChartBackgroud }); };
		window.addEventListener(APPEARANCE_APPLIED_EVENT, h);
		applyAppearanceToDocument('dark', 'dark');
		window.removeEventListener(APPEARANCE_APPLIED_EVENT, h);
		expect(seen).toEqual([{ attr: 'dark', bg: '#081622' }]);
		expect(document.body.getAttribute('data-horosa-appearance')).toBe('dark');
		expect(document.documentElement.getAttribute('data-horosa-appearance-mode')).toBe('dark');
		expect(currentAppearance()).toBe('dark');
		applyAppearanceToDocument('system', 'light');
		expect(AstroConst.AstroColor.ChartBackgroud).toBe('#FFFFFF');
		expect(currentAppearance()).toBe('light');
	});
	it('🔴 订阅:同帧多信号合并一次;同值重放不回调;卸载后不回调;直改根属性(无广播)也能兜底', async ()=>{
		applyAppearanceToDocument('light', 'light');
		await flush();
		const calls = [];
		const off = subscribeAppearance((a)=>calls.push(a));
		applyAppearanceToDocument('dark', 'dark');          // 广播 + 属性变(两信号)
		await flush();
		expect(calls).toEqual(['dark']);
		applyAppearanceToDocument('dark', 'dark');          // 同值重放
		await flush();
		expect(calls).toEqual(['dark']);
		document.documentElement.setAttribute('data-horosa-appearance', 'light');   // 无广播,只改属性(测试 / 别的窗口)
		await flush();
		expect(calls).toEqual(['dark', 'light']);
		off();
		applyAppearanceToDocument('dark', 'dark');
		await flush();
		expect(calls).toEqual(['dark', 'light']);
	});
	it('🔴 watchChartAppearance:重画回调在调色板切换之后;回调抛错不外泄;detach 生效', async ()=>{
		applyAppearanceToDocument('light', 'light');
		await flush();
		const seen = [];
		const off = watchChartAppearance(()=>{ seen.push(AstroConst.AstroColor.ChartBackgroud); throw new Error('draw boom'); });
		expect(typeof off).toBe('function');
		applyAppearanceToDocument('dark', 'dark');
		await flush();
		expect(seen).toEqual(['#081622']);
		off();
		applyAppearanceToDocument('light', 'light');
		await flush();
		expect(seen).toEqual(['#081622']);
		expect(typeof watchChartAppearance(null)).toBe('function');
	});
});

// ── AST 三锁(FL-20260922-3/4):调色板只能在「绘制那一刻」读 ─────────────────────────────────────────────
// 模块初始化期(常量表)/ 实例字段(constructor 或任何方法里 this.x = …AstroColor…)读到的都是当时主题的色,切明暗后重画也换不掉;
// 宿主 render() 里读调色板(如 <svg style.backgroundColor>)的,主题回调只重画不重渲染同样停旧 → 必须 forceUpdate / setState。
describe('源码级 AST 锁(调色板只许绘制时读)', ()=>{
	const parser = require('@babel/parser');
	const PLUGINS = ['jsx', 'classProperties', 'classPrivateProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'decorators-legacy'];
	const SKIP_KEYS = new Set(['loc', 'start', 'end', 'extra', 'comments', 'leadingComments', 'trailingComments']);
	const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod']);
	const isPalette = (n)=>{ if(!n || n.type !== 'MemberExpression'){ return false; } const o = n.object; return (o.type === 'Identifier' && o.name === 'AstroColor') || (o.type === 'MemberExpression' && !!o.property && o.property.name === 'AstroColor'); };
	const children = (n)=>{ const out = []; Object.keys(n).forEach((k)=>{ if(SKIP_KEYS.has(k)){ return; } const v = n[k]; if(Array.isArray(v)){ v.forEach((c)=>{ if(c && typeof c.type === 'string'){ out.push(c); } }); }else if(v && typeof v.type === 'string'){ out.push(v); } }); return out; };
	const hasPalette = (node)=>{ let found = false; (function v(n){ if(found || !n){ return; } if(isPalette(n)){ found = true; return; } if(n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression'){ return; } children(n).forEach(v); })(node); return found; };
	const paletteFiles = walk(COMPONENTS, []).filter((f)=>/AstroColor\./.test(fs.readFileSync(f, 'utf8')));
	const parse = (f)=>parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: PLUGINS });
	it('🔴 ④ 组件树零模块级调色板烘焙(任何函数体之外不许读 AstroColor.*)', ()=>{
		const offenders = [];
		paletteFiles.forEach((f)=>{
			(function visit(n, inFn){ if(!n){ return; } if(isPalette(n) && !inFn){ offenders.push(`${path.relative(SRC, f)}:L${n.loc.start.line}`); return; } children(n).forEach((c)=>visit(c, inFn || FN_TYPES.has(n.type))); })(parse(f).program, false);
		});
		expect(offenders).toEqual([]);
	});
	it('🔴 ⑥ 零实例字段调色板烘焙(任何方法里不许 this.x = …AstroColor…;要活值写 getter)', ()=>{
		const offenders = [];
		paletteFiles.forEach((f)=>{
			(function visit(n){ if(!n){ return; } if(n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.type === 'ThisExpression' && hasPalette(n.right)){ offenders.push(`${path.relative(SRC, f)}:L${n.loc.start.line} this.${n.left.property.name || '?'}`); } if(n.type === 'ClassProperty' && n.value && hasPalette(n.value)){ offenders.push(`${path.relative(SRC, f)}:L${n.loc.start.line} class-prop`); } children(n).forEach(visit); })(parse(f).program);
		});
		expect(offenders).toEqual([]);
	});
	it('🔴 ⑤ render 期读调色板的宿主,主题回调必须重渲染(forceUpdate / setState),只重画不够', ()=>{
		const bad = [];
		walk(COMPONENTS, []).filter((f)=>/watchChartAppearance\(/.test(fs.readFileSync(f, 'utf8'))).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			let renderReads = 0;
			(function visit(n, inRender){ if(!n){ return; } if(isPalette(n) && inRender){ renderReads += 1; return; } children(n).forEach((c)=>visit(c, inRender || (n.type === 'ClassMethod' && !!n.key && n.key.name === 'render'))); })(parse(f).program, false);
			if(!renderReads){ return; }
			// 回调源码 = 真正的调用点(`= watchChartAppearance(`;注释里提到的不算)之后到配对右括号
			const callAt = src.search(/=\s*watchChartAppearance\(/);
			expect({ file: path.relative(SRC, f), hasCall: callAt >= 0 }).toEqual({ file: path.relative(SRC, f), hasCall: true });
			let i = src.indexOf('watchChartAppearance(', callAt) + 'watchChartAppearance('.length; let depth = 1; const s0 = i;
			while(i < src.length && depth > 0){ if(src[i] === '('){ depth += 1; } else if(src[i] === ')'){ depth -= 1; } i += 1; }
			const cb = src.slice(s0, i - 1);
			if(!/forceUpdate\(|setState\(/.test(cb)){ bad.push(`${path.relative(SRC, f)} render 读调色板 ${renderReads} 处,回调只重画:${cb.replace(/\s+/g, ' ').slice(0, 80)}`); }
		});
		expect(bad).toEqual([]);
	});
});
