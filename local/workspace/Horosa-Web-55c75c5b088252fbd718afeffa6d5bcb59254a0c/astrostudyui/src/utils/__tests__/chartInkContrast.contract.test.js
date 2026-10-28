// 盘面字对比度 · 合同(svg / canvas / 3D 文字精灵里画出来的字与符号,在当前主题的盘面底上看得清)。
//
// 为什么:盘面颜色不经样式表,是绘制那一刻从盘面调色板 AstroConst.AstroColor、主题变量或写死的色值烘焙进节点的。
// 只为一种底挑的色(亮盘上的浅青相位符 1.9:1、暗盘格里的深墨字、徽标白字压浅金 2.8:1、四化 / 五行 / 吉凶写死色)
// 界面文字合同(themeContrastContract / fixedInkContrastGuard)看不见,真 WebKit 扫荡才量得到。
// 本合同把能静态算的部分锁死(按 WCAG 2.x 相对亮度公式现算,阈值 3:1 = 盘面信息字 / 符号底线):
//   ① 盘面调色板:界面明暗自动映射的两套(亮 = DefaultColorTheme,暗 = 主题暗夜 8 号)里每个「画字的键」在它实际落的底
//      (盘面底 / 星座环填色 / 宫环填色 / 宿关系扇区…按绘制时的填充透明度压上去)以及该主题的页底上 ≥ 3:1;
//      其余七套(旧「配色主题」,今天不被任何路径选中,见 ④)在它自己设计的那种底上同样 ≥ 3:1;
//      调色板里每个键都必须登记角色(字 / 填色 / 线),新加键不登记 = 红;九套键集合一致。
//   ② 盘面主题变量(紫微 --horosa-ziwei-* / 六壬方盘 --horosa-liureng-square-*):画字的在亮 · 宣纸 / 亮 · 经典白 / 暗
//      三套盘面底上 ≥ 3:1;线 / 底色登记为非字。紫微四化徽标(ZWConst.ZWColor 的 bg / color)字压徽标底 ≥ 4.5:1。
//   ③ 写死的盘面字色:svg <text>/<tspan> 的 fill、d3 文字选择集的 .attr / .style('fill')、canvas fillText 前最近一次
//      fillStyle —— 能静态求出的每个取值(主题变量按各主题解析;isDark ? a : b 按分支)在亮 / 暗盘面底上都 ≥ 3:1;
//      画在定色底上的(3D 夜空、徽标实底、定色面板)登记 FIXED_BG(按登记的底算,仍须 ≥ 3:1),纯装饰 / 静态推不出的登记 ALLOW;
//      登记了却不再命中 = 红(过期登记)。
//      另:d3 文字链只写 stroke 不写 fill = 缺省填色黑(暗盘上黑字压暗底)—— 链尾必须 .call(fillTextFromStroke)
//      (或整盘画完经 solidifyText 统一成填色)。
//   ④ 明暗映射:亮 → DefaultColorTheme(0)、暗 → 8;全仓只有 utils/appearance.js 调 setColorTheme(。
// 页面上真画出来的颜色(组件里现算、静态求不出的那部分)另由真浏览器内核逐页量测复核。
import fs from 'fs';
import path from 'path';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWConst from '../../constants/ZWConst';
import { chartColorThemeFor, DARK_CHART_COLOR_THEME } from '../appearance';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const MIN = 3;

// ── 颜色 ──
const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080',
	orange: '#ffa500', yellow: '#ffff00', purple: '#800080', gold: '#ffd700', silver: '#c0c0c0', navy: '#000080', teal: '#008080' };
function parseColor(v){
	const s = `${v}`.trim().toLowerCase();
	if(NAMED[s]){ return parseColor(NAMED[s]); }
	let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
	if(m){ return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }; }
	m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
	if(m){
		let h = m[1]; if(h.length <= 4){ h = h.split('').map((c)=>c + c).join(''); }
		return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
	}
	return null;
}
const over = (fg, bg, alpha)=>{ const a = alpha === undefined ? fg.a : alpha; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; };
const lum = (c)=>{ const f = (x)=>{ const v = x / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
function contrast(fg, bg){ const f = over(fg, bg); const a = lum(f), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
const fmt = (c)=>`#${[c.r, c.g, c.b].map((x)=>Math.round(x).toString(16).padStart(2, '0')).join('')}`;
const isTransparent = (v)=>!v || /^(transparent|none)$/i.test(`${v}`.trim()) || (parseColor(v) && parseColor(v).a === 0);

// ── 主题块(01-base 亮 / 经典白 / 暗 + 02-shell 挂在根上的占星组)──
const BASE = read('layouts/app/01-base.less');
const SHELL = read('layouts/app/02-shell.less');
function blockVars(src, selectorLine){
	const i = src.indexOf(selectorLine);
	if(i < 0){ throw new Error(`主题块没找到:${selectorLine}`); }
	const j = src.indexOf('\n    }', i);
	const body = src.slice(i + selectorLine.length, j).replace(/\/\*[\s\S]*?\*\//g, '');
	const out = {}; const re = /(--[\w-]+)\s*:\s*([^;]+);/g; let m = re.exec(body);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(body); }
	return out;
}
const LIGHT = blockVars(BASE, '    :root {');
const CLASSIC = blockVars(BASE, "    :root[data-horosa-light-flavor='classic'] {");
const DARK = blockVars(BASE, "    :root[data-horosa-appearance='dark'] {");
const ASTRO_DARK = blockVars(SHELL, '    .ant-dropdown {');
const ASTRO_LIGHT = blockVars(SHELL, "    :root[data-horosa-appearance='light'] .ant-dropdown {");
const THEMES = {
	light: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT },
	classic: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT, ...CLASSIC },
	dark: { ...ASTRO_DARK, ...LIGHT, ...DARK },
};
const ALL_THEMES = ['light', 'classic', 'dark'];
function resolveVars(theme, value, depth = 0){
	let v = `${value}`; let guard = 0;
	const re = /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*(?:\([^()]*\)[^()]*)*\))*))?\)/;
	while(re.test(v) && guard++ < 20){
		v = v.replace(re, (m, name, fb)=>{
			const t = THEMES[theme][name];
			if(t !== undefined && depth < 8){ return resolveVars(theme, t, depth + 1) || ''; }
			return fb !== undefined ? fb.trim() : '\u0000';
		});
	}
	return v.indexOf('\u0000') >= 0 ? null : v.trim();
}
const themeColor = (theme, name)=>parseColor(resolveVars(theme, `var(${name})`));
// 盘面底:页底 / 实底面板 / 软面板压页底 + 紫微盘面底(盘面宿主最常见的四种底)
function chartBackgrounds(theme){
	const bg = themeColor(theme, '--horosa-bg');
	const out = [bg, themeColor(theme, '--horosa-surface-solid'), themeColor(theme, '--horosa-ziwei-chart-bg')];
	const soft = themeColor(theme, '--horosa-panel-soft');
	if(soft && soft.a >= 0.5){ out.push(over(soft, bg)); }
	return out.filter(Boolean);
}
const CHART_BG = { light: chartBackgrounds('light'), classic: chartBackgrounds('classic'), dark: chartBackgrounds('dark') };
const worst = (ink, bgs)=>Math.min(...bgs.map((b)=>contrast(ink, b)));

// ════════════════ ① 盘面调色板 ════════════════
const PALETTES = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i)=>require(`../../constants/AstroColor${i}`).AstroColor);
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron',
	'North Node', 'South Node', 'Dark Moon', 'Purple Clouds', 'Syzygy', 'Asc', 'Desc', 'MC', 'IC'];
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const ASPECTS = ['Asp0', 'Asp60', 'Asp90', 'Asp120', 'Asp180'];
const SU_RELATIONS = ['命', '业', '胎', '意', '事', '克', '聚', '同'];
const HOUSES = Array.from({ length: 12 }, (x, i)=>`House${i + 1}`);
// 角色登记:字 = 画成 svg / canvas 文字或符号的颜色;填色 = 扇区 / 环 / 底的填充;线 = 只描线
const ROLE = {};
PLANETS.forEach((k)=>{ ROLE[k] = 'text'; });          // 行星符号 / 度数(行星环,底 = 盘面底 + PlanetZoneFill)
SIGNS.forEach((k)=>{ ROLE[k] = 'text'; });            // 星座符号(星座环,底 = SignFill;宫头度数 / 界标签也用它,底 = 盘面底)
ASPECTS.forEach((k)=>{ ROLE[k] = 'text'; });          // 相位线 + 线中点的相位符号(内圈,底 = 盘面底)
ROLE.Stroke = 'text';                                  // 通用墨:宫号(宫环 HouseFill 上)、宿关系 / 六合扇区字(宿扇区填色上)、刻度
ROLE.TextStroke = 'text';                              // 卦 / 金口诀等格子字(Fill 格底上)
['StationS', 'StationD', 'Retrograde', 'MinuteText', 'RoyalStar'].forEach((k)=>{ ROLE[k] = 'text'; });   // 行星环的留 / 顺 / 逆标与分数字、卜卦叠层王星标
['Backgroud', 'ChartBackgroud', 'Fill', 'NoColor', 'SignFill', 'HouseFill', 'PlanetZoneFill', 'HouseMask', 'SixHouses', ...SU_RELATIONS]
	.forEach((k)=>{ ROLE[k] = 'fill'; });
HOUSES.forEach((k)=>{ ROLE[k] = 'line'; });            // 宫环描边色
['Relation1', 'Relation2', 'Relation3'].forEach((k)=>{ ROLE[k] = 'line'; });   // 关系线色(当前无绘制站点读它)

// 绘制时的填充透明度:暗盘(盘面底亮度 < 80/255)星座环 / 宫环填色按 AstroChartCircle 的常量压淡
const CIRCLE_SRC = read('components/astro/AstroChartCircle.js');
const DARK_SIGN_FILL_OPACITY = +((CIRCLE_SRC.match(/const DARK_SIGN_FILL_OPACITY = ([\d.]+);/) || [])[1]);
const DARK_HOUSE_FILL_OPACITY = +((CIRCLE_SRC.match(/const DARK_HOUSE_FILL_OPACITY = ([\d.]+);/) || [])[1]);
const isDarkPalette = (P)=>{ const c = parseColor(P.ChartBackgroud); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 80; };
// 该调色板画字时实际可能落的底(每种底先压在盘面底上;自动映射的两套另压在该主题的盘面页底上)
function paletteBases(idx){
	const P = PALETTES[idx];
	const bases = [parseColor(P.ChartBackgroud)];
	if(idx === AstroConst.DefaultColorTheme){ bases.push(...CHART_BG.light, ...CHART_BG.classic); }
	if(idx === DARK_CHART_COLOR_THEME){ bases.push(...CHART_BG.dark); }
	return bases;
}
function layered(fill, opacity, bases){
	if(isTransparent(fill)){ return bases; }
	const c = parseColor(fill);
	return bases.map((b)=>over(c, b, c.a * opacity));
}
function textBackgrounds(idx, key){
	const P = PALETTES[idx];
	const dark = isDarkPalette(P);
	const bases = paletteBases(idx);
	if(PLANETS.includes(key)){ return [...bases, ...HOUSES.flatMap((h)=>layered(P.PlanetZoneFill[h], 1, bases))]; }
	if(SIGNS.includes(key)){ return [...bases, ...layered(P.SignFill[key], dark ? DARK_SIGN_FILL_OPACITY : 1, bases)]; }
	if(key === 'Stroke'){
		return [...bases,
			...HOUSES.flatMap((h)=>layered(P.HouseFill[h], dark ? DARK_HOUSE_FILL_OPACITY : 1, bases)),
			...SU_RELATIONS.flatMap((s)=>layered(P[s], 1, bases)),
			...layered(P.SixHouses, 1, bases)];
	}
	if(key === 'TextStroke'){ return [...bases, ...layered(P.Fill, 1, bases)]; }
	return bases;
}

describe('① 盘面调色板', ()=>{
	it('九套调色板键集合一致,且每个键都登记了角色(字 / 填色 / 线)', ()=>{
		const keysOf = (P)=>Object.keys(P).sort();
		const k0 = keysOf(PALETTES[0]);
		PALETTES.forEach((P, i)=>expect({ i, keys: keysOf(P) }).toEqual({ i, keys: k0 }));
		expect(k0.filter((k)=>!ROLE[k])).toEqual([]);
		expect(Object.keys(ROLE).filter((k)=>!k0.includes(k))).toEqual([]);   // 登记表里没有的键 = 过期登记
	});
	it('暗盘判据与填充透明度常量取得到(与 AstroChartCircle 同源)', ()=>{
		expect(DARK_SIGN_FILL_OPACITY).toBeGreaterThan(0);
		expect(DARK_HOUSE_FILL_OPACITY).toBeGreaterThan(0);
		expect(isDarkPalette(PALETTES[DARK_CHART_COLOR_THEME])).toBe(true);
		expect(isDarkPalette(PALETTES[AstroConst.DefaultColorTheme])).toBe(false);
	});
	it('🔴 每套调色板里画字的键在它实际落的底上 ≥ 3:1(自动映射的亮 / 暗两套另含该主题的盘面页底)', ()=>{
		const bad = [];
		PALETTES.forEach((P, idx)=>{
			Object.keys(P).filter((k)=>ROLE[k] === 'text').forEach((k)=>{
				const ink = parseColor(P[k]);
				expect([idx, k, P[k], !!ink]).toEqual([idx, k, P[k], true]);
				textBackgrounds(idx, k).forEach((b)=>{
					const cr = contrast(ink, b);
					if(cr < MIN){ bad.push(`#${idx} ${k}=${P[k]} on ${fmt(b)} = ${cr.toFixed(2)}`); }
				});
			});
		});
		expect([...new Set(bad)]).toEqual([]);
	});
});

// ════════════════ ② 盘面主题变量 / 紫微四化徽标 ════════════════
// 画字的盘面变量(线 / 底色在 NON_TEXT 里登记;两张表必须覆盖主题块里全部 --horosa-ziwei-* / --horosa-liureng-square-*)
const CHART_VAR_TEXT = [
	'--horosa-ziwei-star-main', '--horosa-ziwei-star-assist', '--horosa-ziwei-star-evil', '--horosa-ziwei-star-others-good',
	'--horosa-ziwei-star-others-bad', '--horosa-ziwei-star-sixevil',
	'--horosa-ziwei-period-xiaoxian', '--horosa-ziwei-period-year', '--horosa-ziwei-period-month', '--horosa-ziwei-period-day', '--horosa-ziwei-period-hour',
	'--horosa-ziwei-house-name', '--horosa-ziwei-house-branch', '--horosa-ziwei-house-meta', '--horosa-ziwei-house-muted', '--horosa-ziwei-house-age',
	'--horosa-ziwei-kinastro-liunian',
	'--horosa-liureng-square-main', '--horosa-liureng-square-muted', '--horosa-liureng-square-jiang', '--horosa-liureng-square-accent',
];
const CHART_VAR_NON_TEXT = /^--horosa-(ziwei-(duigong-line|house-line|chart-bg|sanhe-bg|duigong-bg|selected-bg)|liureng-square-(line|center-bg|active-bg))$/;
describe('② 盘面主题变量 · 紫微四化徽标', ()=>{
	it('主题块里每个盘面变量都登记了(画字 / 非字)', ()=>{
		const all = new Set([...Object.keys(LIGHT), ...Object.keys(DARK), ...Object.keys(CLASSIC)].filter((k)=>/^--horosa-(ziwei-|liureng-square-)/.test(k)));
		expect([...all].filter((k)=>!CHART_VAR_TEXT.includes(k) && !CHART_VAR_NON_TEXT.test(k))).toEqual([]);
		CHART_VAR_TEXT.forEach((k)=>expect([k, all.has(k)]).toEqual([k, true]));
	});
	it('🔴 画字的盘面变量在亮 · 宣纸 / 亮 · 经典白 / 暗三套盘面底上 ≥ 3:1', ()=>{
		const bad = [];
		ALL_THEMES.forEach((t)=>CHART_VAR_TEXT.forEach((k)=>{
			const ink = themeColor(t, k);
			expect([t, k, !!ink]).toEqual([t, k, true]);
			const w = worst(ink, CHART_BG[t]);
			if(w < MIN){ bad.push(`${t} ${k}=${fmt(ink)} ${w.toFixed(2)}`); }
		}));
		expect(bad).toEqual([]);
	});
	it('🔴 紫微四化徽标:字压徽标底 ≥ 4.5:1(小字实底)', ()=>{
		const bad = [];
		['禄', '权', '科', '忌'].forEach((h)=>{
			const o = ZWConst.ZWColor[h];
			ALL_THEMES.forEach((t)=>{
				const bg = parseColor(resolveVars(t, o.bg)); const fg = parseColor(resolveVars(t, o.color));
				expect([h, t, !!bg, !!fg]).toEqual([h, t, true, true]);
				const cr = contrast(fg, bg);
				if(cr < 4.5){ bad.push(`${h} ${t} ${fmt(fg)} on ${fmt(bg)} = ${cr.toFixed(2)}`); }
			});
		});
		expect(bad).toEqual([]);
	});
});

// ════════════════ ③ 写死的盘面字色(静态扫描)════════════════
// 定色底:[文件, 命中行里的一段原文, 底色, 理由] —— 字按登记的底算,仍须 ≥ 3:1
const FIXED_BG = [
	['components/astro3d/AstroPDSphere.js', '', '#141720', '主限天球 3D 场景与它的时间轴 / 图例 / 浮层是定色暗夜底(#05080f / #070b14,按钮 rgba(255,255,255,.07) 压上去 ≈ #141720),不随界面主题;按最亮的那层算'],
	['components/planetarium/babylon/PlanetariumRenderer.js', "ctx.fillStyle = color || '#fff'", '#1e2e4f', '天文馆网格 / 星名标签画进纹理,贴在定色夜空里(最亮的片 ≈ #1e2e4f),不随界面主题'],
];
// 其余:[文件, 命中行里的一段原文, 理由]
const ALLOW = [
	['components/fengshui/fengshuiEngine.js', '', '风水画布只在用户户型图 / 罗盘皮肤之上作画、导出卡是定色卡底(深色题头 + 浅色正文卡),墨色按照片 / 卡底成对定,不随界面主题(盘面随主题合同的风水豁免同一理由)'],
	['components/ziwei/ZWHouse.js', "starsvg.selectAll('text').attr('fill', coloropt.color)", '飞化星名徽:字压在 ZWConst.ZWColor 的徽标实底上(同一调用的 drawTextV 已把它当底画出,那一处由绘制助手成对算),字 × 徽标底由 ② 成对算 ≥ 4.5:1'],
	['components/ziwei/ZWHouseSangHe.js', "starsvg.selectAll('text').attr('fill', coloropt.color)", '飞化星名徽:字压在 ZWConst.ZWColor 的徽标实底上(同一调用的 drawTextV 已把它当底画出,那一处由绘制助手成对算),字 × 徽标底由 ② 成对算 ≥ 4.5:1'],
	['components/ziwei/ZWCommHouse.js', "huasvg.selectAll('text')", '运限 / 自化四化徽标字压在 ZWConst.ZWColor 的徽标实底上(不是盘面底),字 × 徽标底由 ② 逐个成对算 ≥ 4.5:1'],
];
const PARSE_OPTS = { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom', 'decorators-legacy'] };
const DARK_TEST = /(?:^|[^\w])(?:is)?dark(?:mode|theme|chart)?(?:[^\w]|$)|appearance\s*={2,3}\s*['"]dark['"]|['"]dark['"]\s*={2,3}/i;
const LIGHT_TEST = /(?:^|[^\w])(?:is)?light(?:mode|theme)?(?:[^\w]|$)|appearance\s*={2,3}\s*['"]light['"]|['"]light['"]\s*={2,3}/i;
const keyName = (p)=>p && p.key && (p.key.name || p.key.value);
function topLevelInit(ast, name){
	for(const st of ast.program.body){
		const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
		if(decl && decl.type === 'VariableDeclaration'){
			for(const d of decl.declarations){ if(d.id.type === 'Identifier' && d.id.name === name && d.init){ return d.init; } }
		}
	}
	return null;
}
function resolveImport(fromFile, spec){
	if(!/^\./.test(spec)){ return null; }
	const base = path.resolve(path.dirname(fromFile), spec);
	return [base, `${base}.js`, path.join(base, 'index.js')].find((c)=>fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}
const MOD = new Map();
function moduleCtx(abs, srcOverride){
	if(MOD.has(abs)){ return MOD.get(abs); }
	let ctx = null;
	try{
		const src = srcOverride !== undefined ? srcOverride : fs.readFileSync(abs, 'utf8');
		const ast = parser.parse(src, PARSE_OPTS);
		ctx = { ast, src, file: abs, imports: {} };
		ast.program.body.forEach((st)=>{
			if(st.type !== 'ImportDeclaration'){ return; }
			const file = resolveImport(abs, st.source.value);
			if(!file){ return; }
			st.specifiers.forEach((s)=>{
				if(s.type === 'ImportSpecifier'){ ctx.imports[s.local.name] = { kind: 'named', file, name: s.imported.name || s.imported.value }; }
				else{ ctx.imports[s.local.name] = { kind: 'ns', file }; }
			});
		});
	}catch(e){ ctx = { parseError: `${e.message}` }; }
	MOD.set(abs, ctx);
	return ctx;
}
// 求值:返回 [{ v, themes }];只收能静态拿到的字符串
function evalInk(node, ctx, scope, themes = ALL_THEMES, depth = 0){
	if(!node || depth > 7){ return []; }
	switch(node.type){
	case 'StringLiteral': return [{ v: node.value, themes }];
	case 'TemplateLiteral': return node.expressions.length ? [] : [{ v: node.quasis[0].value.cooked, themes }];
	case 'ConditionalExpression': {
		const t = ctx.src.slice(node.test.start, node.test.end);
		let a = themes; let b = themes;
		if(DARK_TEST.test(t) && !LIGHT_TEST.test(t)){ a = themes.filter((x)=>x === 'dark'); b = themes.filter((x)=>x !== 'dark'); }
		else if(LIGHT_TEST.test(t) && !DARK_TEST.test(t)){ a = themes.filter((x)=>x !== 'dark'); b = themes.filter((x)=>x === 'dark'); }
		return [...evalInk(node.consequent, ctx, scope, a, depth + 1), ...evalInk(node.alternate, ctx, scope, b, depth + 1)];
	}
	case 'LogicalExpression': return [...evalInk(node.left, ctx, scope, themes, depth + 1), ...evalInk(node.right, ctx, scope, themes, depth + 1)];
	case 'ArrowFunctionExpression':
	case 'FunctionExpression': {
		if(node.body.type !== 'BlockStatement'){ return evalInk(node.body, ctx, scope, themes, depth + 1); }
		const out = [];
		const visit = (n)=>{
			if(!n || typeof n !== 'object'){ return; }
			if(n.type === 'ReturnStatement'){ out.push(...evalInk(n.argument, ctx, scope, themes, depth + 1)); return; }
			if(/Function/.test(n.type)){ return; }
			Object.keys(n).forEach((k)=>{ if(k === 'loc' || k === 'start' || k === 'end'){ return; } const v = n[k]; if(Array.isArray(v)){ v.forEach(visit); }else if(v && typeof v.type === 'string'){ visit(v); } });
		};
		visit(node.body);
		return out;
	}
	case 'Identifier':
	case 'MemberExpression':
	case 'OptionalMemberExpression':
		return evalObj(node, ctx, scope, depth + 1).flatMap((o)=>(o.str !== undefined ? [{ v: o.str, themes }] : (o.expr ? evalInk(o.expr, o.ctx, o.scope, themes, depth + 1) : [])));
	default: return [];
	}
}
const isPaletteModule = (abs)=>/[\\/]constants[\\/]AstroConst\.js$/.test(abs);
function evalObj(node, ctx, scope, depth){
	if(!node || depth > 7){ return []; }
	if(node.type === 'StringLiteral'){ return [{ str: node.value }]; }
	if(node.type === 'TemplateLiteral' && !node.expressions.length){ return [{ str: node.quasis[0].value.cooked }]; }
	if(node.type === 'ObjectExpression' || node.type === 'ArrayExpression'){ return [{ node, ctx }]; }
	if(node.type === 'ConditionalExpression' || node.type === 'LogicalExpression'){ return [{ expr: node, ctx, scope }]; }
	if(node.type === 'Identifier'){
		const b = scope && scope.getBinding(node.name);
		// 局部常量,以及从不再赋值的 let / var(babel 的 binding.constant)
		const fixedLocal = b && (b.kind === 'const' || ((b.kind === 'let' || b.kind === 'var') && b.constant));
		if(fixedLocal && b.path.isVariableDeclarator() && b.path.node.id.type === 'Identifier' && b.path.node.init && b.scope.path.type !== 'Program'){
			return evalObj(b.path.node.init, ctx, b.path.scope, depth + 1);
		}
		if(b && b.kind !== 'const' && b.kind !== 'module' && !(b.constant && b.scope.path.type === 'Program')){ return []; }
		const init = topLevelInit(ctx.ast, node.name);
		if(init){ return evalObj(init, ctx, null, depth + 1); }
		const imp = ctx.imports[node.name];
		if(imp && imp.kind === 'named' && isPaletteModule(imp.file) && imp.name === 'AstroColor'){ return []; }
		if(imp && imp.kind === 'named'){ const m = moduleCtx(imp.file); const i2 = m && m.ast && topLevelInit(m.ast, imp.name); return i2 ? evalObj(i2, m, null, depth + 1) : []; }
		if(imp && imp.kind === 'ns'){ return [{ ns: imp.file }]; }
		return [];
	}
	// 实例字段 this.<名>:同文件里所有 `this.<名> = 值` 的赋值,加上同名 getter 的返回值(构造期写死色存进实例字段、再在画字时读出 —— 不求它就静默放过)
	if((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && node.object.type === 'ThisExpression' && !node.computed && node.property.type === 'Identifier'){
		return thisFieldValues(ctx, node.property.name).map((n)=>({ expr: n, ctx, scope: null }));
	}
	if(node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression'){
		const out = [];
		evalObj(node.object, ctx, scope, depth + 1).forEach((b)=>{
			if(b.ns){
				if(node.computed){ return; }
				if(isPaletteModule(b.ns) && node.property.name === 'AstroColor'){ return; }   // 盘面调色板:按主题整套切换,由 ① 逐套算
				const m = moduleCtx(b.ns); const i2 = m && m.ast && topLevelInit(m.ast, node.property.name);
				if(i2){ out.push(...evalObj(i2, m, null, depth + 1)); }
				return;
			}
			if(!b.node){ return; }
			if(b.node.type === 'ObjectExpression'){
				const key = node.computed ? (node.property.type === 'StringLiteral' ? node.property.value : null) : node.property.name;
				b.node.properties.forEach((p)=>{ if(p.type === 'ObjectProperty' && (key === null || keyName(p) === key)){ out.push(...evalObj(p.value, b.ctx, b.ctx === ctx ? scope : null, depth + 1)); } });
			}else if(b.node.type === 'ArrayExpression' && node.computed){
				b.node.elements.forEach((e)=>out.push(...evalObj(e, b.ctx, b.ctx === ctx ? scope : null, depth + 1)));
			}
		});
		return out;
	}
	return [];
}
const THIS_FIELDS = new WeakMap();
function thisFieldValues(ctx, name){
	if(!THIS_FIELDS.has(ctx)){
		const m = {};
		const add = (k, n)=>{ (m[k] = m[k] || []).push(n); };
		traverse(ctx.ast, {
			AssignmentExpression(p){
				const l = p.node.left;
				if(p.node.operator === '=' && l.type === 'MemberExpression' && !l.computed && l.object.type === 'ThisExpression' && l.property.type === 'Identifier'){ add(l.property.name, p.node.right); }
			},
			ClassMethod(p){
				if(p.node.kind !== 'get' || p.node.computed || p.node.key.type !== 'Identifier'){ return; }
				p.traverse({ Function(q){ q.skip(); }, ReturnStatement(q){ if(q.node.argument){ add(p.node.key.name, q.node.argument); } } });
			},
		});
		THIS_FIELDS.set(ctx, m);
	}
	return THIS_FIELDS.get(ctx)[name] || [];
}
// d3 链里是不是文字选择集(append / insert / select / selectAll 'text' | 'tspan',或变量初值是这样的链)
function isTextChain(node, scope, depth = 0){
	if(!node || depth > 12){ return false; }
	if(node.type === 'CallExpression' && node.callee.type === 'MemberExpression'){
		const p = node.callee.property && node.callee.property.name;
		const a0 = node.arguments[0];
		if(/^(append|insert|select|selectAll)$/.test(p || '') && a0 && a0.type === 'StringLiteral' && /^(text|tspan)\b/.test(a0.value)){ return true; }
		return isTextChain(node.callee.object, scope, depth + 1);
	}
	if(node.type === 'Identifier' && scope){
		const b = scope.getBinding(node.name);
		if(b && b.path.isVariableDeclarator() && b.path.node.init){ return isTextChain(b.path.node.init, b.path.scope, depth + 1); }
	}
	return false;
}
function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const f = path.join(dir, n);
		if(n === '__tests__' || n === 'node_modules'){ return; }
		if(fs.statSync(f).isDirectory()){ walk(f, out); } else if(/\.js$/.test(n) && !/\.test\.js$/.test(n)){ out.push(f); }
	});
	return out;
}
// 求出的一个字色在某主题的盘面底上最差对比度;主题变量按该主题解析,解析不到返回 null(由变量定义守卫管)
// 作用域局部变量(只在某个盘面 / 页面的样式作用域里定义、根主题块没有的,如风水 --fs-*)静态解析不了它在作用域里的取值 → 不判,归真机扫荡
const scopedVar = (theme, v)=>[...`${v}`.matchAll(/var\(\s*(--[\w-]+)/g)].some((m)=>THEMES[theme][m[1]] === undefined);
// 实底配字(--horosa-on-accent / -on-solid):与它压着的语义实底成对,由 themeContrastContract 的 ON_SOLID 逐条算
const ON_SOLID_INK = /^\s*var\(\s*--horosa-on-(accent|solid)\s*[,)]/;
function inkWorst(v, theme, bgs){
	if(ON_SOLID_INK.test(v) || scopedVar(theme, v)){ return null; }
	const s = resolveVars(theme, v);
	if(s === null || isTransparent(s) || /^(currentcolor|inherit|url\()/i.test(s)){ return null; }
	const c = parseColor(s);
	if(!c || c.a < 0.15){ return null; }
	return { w: worst(c, bgs), c };
}
function scanFile(abs, srcOverride){
	const rel = path.relative(SRC, abs).split(path.sep).join('/');
	const src = srcOverride !== undefined ? srcOverride : fs.readFileSync(abs, 'utf8');
	if(!/<text\b|<tspan\b|['"]text['"]|['"]tspan['"]|fillText\(|drawText[HV]\(/.test(src)){ return []; }
	const ctx = moduleCtx(abs, srcOverride);
	if(!ctx || ctx.parseError){ return [`${rel}: 解析失败 ${ctx ? ctx.parseError : ''}`]; }
	const lines = src.split('\n');
	const sites = [];
	const strokeOnly = [];
	// 盘面绘制助手 GraphHelper.drawTextH / drawTextV(svg, data, x, y, w, h, margin, 字色, 字重, 底色 …):第 8 个参数是字色;
	// 给了底色(第 10 个)就是「字压实底」,字 × 底成对算(两者都能静态求出时)
	const drawTextSite = (p)=>{
		const a = p.node.arguments;
		if(!a[7] || (a[7].type === 'Identifier' && a[7].name === 'undefined')){ return; }
		const bgArg = a[9] && !(a[9].type === 'Identifier' && a[9].name === 'undefined') && a[9].type !== 'NullLiteral' ? a[9] : null;
		sites.push({ node: a[7], scope: p.scope, line: lineOf(p.node), kind: 'drawText', bg: bgArg });
	};
	const lineOf = (node)=>lines[node.loc.start.line - 1] || '';
	traverse(ctx.ast, {
		JSXOpeningElement(p){
			const n = p.node.name;
			if(n.type !== 'JSXIdentifier' || !/^(text|tspan|textPath)$/.test(n.name)){ return; }
			p.node.attributes.forEach((a)=>{
				if(a.type !== 'JSXAttribute' || !a.value){ return; }
				const an = a.name.name;
				let expr = null;
				if(an === 'fill'){ expr = a.value.type === 'JSXExpressionContainer' ? a.value.expression : a.value; }
				if(an === 'style' && a.value.type === 'JSXExpressionContainer' && a.value.expression.type === 'ObjectExpression'){
					const fp = a.value.expression.properties.find((q)=>q.type === 'ObjectProperty' && keyName(q) === 'fill');
					expr = fp ? fp.value : null;
				}
				if(expr){ sites.push({ node: expr, scope: p.scope, line: lineOf(a), kind: 'svg' }); }
			});
		},
		CallExpression(p){
			const c = p.node.callee;
			if(c.type === 'Identifier' && (c.name === 'drawTextH' || c.name === 'drawTextV')){ drawTextSite(p); return; }
			if(c.type !== 'MemberExpression' || c.computed){ return; }
			const name = c.property.name;
			// 链的最外层调用:只写 stroke 不写 fill 的文字链(缺省填色黑)
			const outer = !(p.parentPath.isMemberExpression() && p.parentPath.node.object === p.node && p.parentPath.parentPath.isCallExpression());
			if(outer){
				const attrs = []; let n = p.node; let text = false; let filled = false;
				while(n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression'){
					const nm = n.callee.property.name; const a0 = n.arguments[0];
					if((nm === 'attr' || nm === 'style') && a0 && a0.type === 'StringLiteral'){ attrs.push(a0.value); }
					if(/^(append|insert)$/.test(nm) && a0 && a0.type === 'StringLiteral' && /^(text|tspan)$/.test(a0.value)){ text = true; }
					if(nm === 'call' && a0 && a0.type === 'Identifier' && a0.name === 'fillTextFromStroke'){ filled = true; }
					n = n.callee.object;
				}
				if(text && attrs.includes('stroke') && !attrs.includes('fill') && !filled && !/solidifyText\(/.test(src)){
					strokeOnly.push(`${rel}:${p.node.loc.start.line} 文字链只写 stroke 不写 fill(缺省填色黑)—— 链尾 .call(fillTextFromStroke)`);
				}
			}
			if((name === 'attr' || name === 'style') && p.node.arguments[0] && p.node.arguments[0].type === 'StringLiteral' && p.node.arguments[0].value === 'fill' && p.node.arguments[1]){
				if(isTextChain(c.object, p.scope)){ sites.push({ node: p.node.arguments[1], scope: p.scope, line: lineOf(p.node), kind: 'd3' }); }
			}
			if(name === 'drawTextH' || name === 'drawTextV'){ drawTextSite(p); }
			if(name === 'fillText' || name === 'strokeText'){
				// canvas:同一函数体内、这次落笔之前最近一次给同一上下文的 fillStyle / strokeStyle 赋值
				const fn = p.getFunctionParent();
				const prop = name === 'fillText' ? 'fillStyle' : 'strokeStyle';
				const ctxName = ctx.src.slice(c.object.start, c.object.end);
				const argSrc = p.node.arguments[0] ? ctx.src.slice(p.node.arguments[0].start, p.node.arguments[0].end) : '';
				let last = null;
				let haloOf = false;   // strokeText 之后同一函数里又 fillText 同一段字 = 先描光晕后填字,描边色是光晕不是字色
				(fn || p.scope.getProgramParent().path).traverse({
					Function(q){ if(q !== fn){ q.skip(); } },
					CallExpression(q){
						const qc = q.node.callee;
						if(name === 'strokeText' && qc.type === 'MemberExpression' && !qc.computed && qc.property.name === 'fillText' && q.node.start > p.node.end
							&& q.node.arguments[0] && ctx.src.slice(q.node.arguments[0].start, q.node.arguments[0].end) === argSrc){ haloOf = true; }
					},
					AssignmentExpression(q){
						const l = q.node.left;
						if(l.type === 'MemberExpression' && !l.computed && l.property.name === prop && ctx.src.slice(l.object.start, l.object.end) === ctxName && q.node.end <= p.node.start){
							if(!last || q.node.start > last.node.start){ last = q; }
						}
					},
				});
				if(last && !haloOf){ sites.push({ node: last.node.right, scope: last.scope, line: lineOf(last.node), kind: 'canvas' }); }
			}
		},
	});
	const hits = [...strokeOnly];
	const seen = new Set();
	sites.forEach((s)=>{
		const sig = `${s.node.start}`;
		if(seen.has(sig)){ return; }
		seen.add(sig);
		const fixed = FIXED_BG.find(([f, needle])=>f === rel && s.line.indexOf(needle) >= 0);
		const allow = ALLOW.find(([f, needle])=>f === rel && s.line.indexOf(needle) >= 0);
		const solidBg = s.bg ? evalInk(s.bg, ctx, s.scope) : null;
		if(s.bg && !solidBg.length){ return; }   // 字压实底、底求不出:归真机判据
		evalInk(s.node, ctx, s.scope).forEach(({ v, themes })=>{
			themes.forEach((t)=>{
				let bgs = fixed ? [parseColor(fixed[2])] : CHART_BG[t];
				if(solidBg){
					const sb = solidBg.filter((b)=>b.themes.includes(t)).map((b)=>resolveVars(t, b.v)).filter((x)=>x && !isTransparent(x)).map(parseColor).filter(Boolean);
					if(!sb.length){ return; }
					bgs = sb.map((b)=>(b.a >= 0.999 ? b : over(b, CHART_BG[t][0])));
				}
				const r = inkWorst(v, t, bgs);
				if(!r || r.w >= MIN){ return; }
				if(allow){ allow.used = true; return; }
				hits.push(`${rel}:${s.line.trim().slice(0, 90)} [${s.kind}] ${t} ${v} → ${fmt(r.c)} ${r.w.toFixed(2)}`);
			});
			if(fixed){ fixed.used = true; }
		});
	});
	return hits;
}

// ════════════════ ②′ 组件自带的盘面调色板(样式里的根块 = 浅色、:root[暗色] 根块 = 暗色)════════════════
// 盘面字的颜色走组件局部变量时,两套取值都要在本盘的底上 ≥ 3:1;每个局部变量都登记了「画字 / 非字」(新加的变量不登记 = 红)。
// 取值是 var(--horosa-*, 回退) 时按回退值判(主题变量另由 ① ② 判);底取本块的底变量回退值与盘面页底两者里更不利的那个。
const LOCAL_PALETTES = [
	{ file: 'components/guolao/GuoLaoMoiraWheel.less', root: '.horosa-guolao-moira-wheel', prefix: '--moira-', bg: '--moira-bg',
		nonText: /^--moira-(bg|line|tooltip-bg|tooltip-border|pale)$/, pairs: { '--moira-tooltip-text': '--moira-tooltip-bg' },
		pageBg: { light: '#fdfbf6', dark: '#090b0e' } },
];
describe('②′ 组件自带的盘面调色板', ()=>{
	const blockOf = (t, sel)=>{ const i = t.indexOf(`${sel} {`); if(i < 0){ return null; } const j = t.indexOf('}', i); const out = {}; t.slice(t.indexOf('{', i) + 1, j).replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (m, k, v)=>{ out[k] = v.trim(); return m; }); return out; };
	const resolve = (v)=>{ const m = `${v || ''}`.match(/^var\(--[\w-]+,\s*(.+)\)$/); return parseColor(m ? m[1].trim() : v); };
	LOCAL_PALETTES.forEach((P)=>{
		it(`${P.file}:画字变量两套都 ≥ 3:1、每个变量都登记`, ()=>{
			const t = read(P.file).replace(/\/\*[\s\S]*?\*\//g, '');
			const light = blockOf(t, P.root);
			const dark = blockOf(t, `:root[data-horosa-appearance='dark'] ${P.root}`);
			expect(!!light && !!dark).toBe(true);
			const bad = [];
			[['light', light], ['dark', dark]].forEach(([theme, B])=>{
				Object.keys(B).filter((k)=>k.startsWith(P.prefix) && !P.nonText.test(k)).forEach((k)=>{
					const ink = resolve(B[k] || light[k]);
					if(!ink){ bad.push(`${theme} ${k}=${B[k]} 读不出颜色`); return; }
					const bgs = P.pairs[k] ? [resolve(B[P.pairs[k]] || light[P.pairs[k]])] : [resolve(B[P.bg] || light[P.bg]), parseColor(P.pageBg[theme])];
					bgs.filter(Boolean).forEach((b)=>{ const cr = contrast(ink, b); if(cr < MIN){ bad.push(`${theme} ${k}=${B[k]} on ${fmt(b)} = ${cr.toFixed(2)}`); } });
				});
			});
			expect(bad).toEqual([]);
			// 暗色块里出现的每个变量,浅色块都有(否则浅色主题落到 var 回退或继承)
			expect(Object.keys(dark).filter((k)=>k.startsWith(P.prefix) && !(k in light))).toEqual([]);
		});
	});
});

describe('③ 写死的盘面字色', ()=>{
	const files = walk(path.join(SRC, 'components'), []).concat(walk(path.join(SRC, 'utils'), []));
	let hits = null;
	const scanAll = ()=>{ if(!hits){ hits = files.flatMap((f)=>scanFile(f)); } if(process.env.CHART_INK_DUMP){ fs.writeFileSync(process.env.CHART_INK_DUMP, [...new Set(hits)].join('\n')); } return hits; };
	it('🔴 svg 文字 fill / d3 文字选择集 fill / canvas fillText 前的 fillStyle:能静态求出的取值在亮 / 暗盘面底上 ≥ 3:1', ()=>{
		expect([...new Set(scanAll())]).toEqual([]);
	});
	it('登记表每条都写了理由,且仍命中(过期登记 = 红)', ()=>{
		scanAll();
		const exists = (f)=>fs.existsSync(path.join(SRC, f));
		FIXED_BG.forEach(([f, needle, bg, why])=>{
			expect([f, !!parseColor(bg), `${why}`.length > 8]).toEqual([f, true, true]);
			if(exists(f)){ expect([f, needle, !!FIXED_BG.find((x)=>x[0] === f && x[1] === needle).used]).toEqual([f, needle, true]); }
		});
		ALLOW.forEach((a)=>{
			const [f, needle, why] = a;
			expect([f, `${why}`.length > 8]).toEqual([f, true]);
			if(exists(f)){ expect([f, needle, !!a.used]).toEqual([f, needle, true]); }
		});
	});
	it('判别力自证:暗底挑的浅字 / 亮底挑的深字 / isDark 分支 / canvas fillStyle 都抓得到,主题变量与合规色放行', ()=>{
		const tmp = path.join(SRC, 'components', '__chart_ink_probe__.js');   // 虚拟路径:源码直接喂给扫描器,不落盘
		const probe = [
			"const INK = { a: '#cccc00', b: '#3b3b3b' };",
			"export function A(){ return <svg><text fill=\"#33CCC3\">x</text><text fill={INK.a}>y</text><text fill=\"var(--horosa-text)\">ok</text></svg>; }",
			"export function B(g, isDark){ g.append('text').attr('fill', isDark ? '#3b3b3b' : '#e7d2a5'); g.append('text').attr('fill', isDark ? '#e7d2a5' : '#3b3b3b'); }",
			"export function C(ctx){ ctx.fillStyle = '#081622'; ctx.fillRect(0, 0, 9, 9); ctx.fillStyle = '#fdfeff'; ctx.fillText('z', 1, 1); }",
			"export function E(g){ g.append('text').attr('stroke', 'var(--horosa-text)').text('q'); g.append('text').attr('stroke', 'var(--horosa-text)').text('r').call(fillTextFromStroke); }",
			"import { drawTextH } from '../graph/GraphHelper'; export function F(g){ drawTextH(g, ['x'], 0, 0, 9, 9, 1, '#e7d2a5'); drawTextH(g, ['y'], 0, 0, 9, 9, 1, '#ffffff', 500, '#2868d8'); drawTextH(g, ['z'], 0, 0, 9, 9, 1, '#ffffff', 500, '#cccc00'); }",
			"export function D(ctx, t){ ctx.strokeStyle = '#03060e'; ctx.strokeText(t, 1, 1); ctx.fillStyle = 'var(--horosa-text)'; ctx.fillText(t, 1, 1); }",
			"export class G{ constructor(o){ this.inkA = '#800081'; if(o.c){ this.inkA = o.c; } } get inkB(){ return this._b !== undefined ? this._b : 'var(--horosa-text)'; } draw(g){ const c = this.on ? this.inkA : this.inkB; drawTextH(g, ['w'], 0, 0, 9, 9, 1, c); } }",
		].join('\n');
		try{
			MOD.delete(tmp);
			const h = scanFile(tmp, probe);
			const at = (re)=>h.some((x)=>re.test(x.slice(x.lastIndexOf(' ['))));   // 只看「[类型] 主题 取值」那一段
			expect(h.filter((x)=>/只写 stroke 不写 fill/.test(x)).length).toBe(1);   // 没补填色的那条红,补了的放行
			expect(at(/\[drawText\] light #e7d2a5 /)).toBe(true);                    // 绘制助手的字色参数
			expect(h.filter((x)=>/\[drawText\] \w+ #ffffff /.test(x.slice(x.lastIndexOf(' [')))).length).toBe(3);   // 白字压 #cccc00 实底(三套主题各一条)红,压 #2868d8 放行
			expect(at(/\] light #33CCC3 /)).toBe(true);
			expect(at(/\] light #cccc00 /)).toBe(true);
			expect(at(/\[d3\] dark #3b3b3b /)).toBe(true);
			expect(at(/\[d3\] light #e7d2a5 /)).toBe(true);
			expect(at(/\[canvas\] light #fdfeff /)).toBe(true);
			expect(at(/\[drawText\] dark #800081 /)).toBe(true);                     // 实例字段里写死的字色(构造期赋值、画字时经局部变量读出)
			expect(at(/var\(--horosa-text\)/)).toBe(false);
			expect(at(/\] light #3b3b3b |\] dark #e7d2a5 |#081622|#03060e/)).toBe(false);   // 光晕描边不算字色
		}finally{ MOD.delete(tmp); }
	});
});

// ════════════════ ④ 明暗 → 调色板映射 ════════════════
describe('④ 明暗映射', ()=>{
	it('亮 → DefaultColorTheme、暗 → 主题暗夜(8);这是界面上唯一会被选中的两套', ()=>{
		expect(chartColorThemeFor('light')).toBe(AstroConst.DefaultColorTheme);
		expect(chartColorThemeFor('dark')).toBe(8);
		expect(AstroConst.colorThemes[8]).toBe('主题暗夜');
	});
});

// ════════════════ ⑤ 多序列曲线分类色板 ════════════════
// 曲线交叉处只能靠颜色辨星:同一张图里的序列色两两要分得开(CIEDE2000 ≥ 12),每色在本主题盘面底上 ≥ 3:1。
// 借语义色(日借 planet-sun / 土借 planet-saturn / 月借 info / 海借 link)会撞色(同族,两两只差 6–7),
// 所以多序列图一律经 constants/seriesPalette(--horosa-series-1..12,亮暗成对)取色。
function toLab(c){
	const f = (x)=>{ const v = x / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
	const r = f(c.r); const g = f(c.g); const b = f(c.b);
	const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
	const t = (v)=>(v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
	return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
function deltaE00(c1, c2){
	const [L1, a1, b1] = toLab(c1); const [L2, a2, b2] = toLab(c2);
	const rad = Math.PI / 180; const C1 = Math.hypot(a1, b1); const C2 = Math.hypot(a2, b2); const Cb = (C1 + C2) / 2;
	const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
	const a1p = (1 + G) * a1; const a2p = (1 + G) * a2; const C1p = Math.hypot(a1p, b1); const C2p = Math.hypot(a2p, b2);
	const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360; const h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
	const dLp = L2 - L1; const dCp = C2p - C1p;
	let dhp = 0;
	if(C1p * C2p !== 0){ dhp = Math.abs(h2p - h1p) <= 180 ? h2p - h1p : (h2p > h1p ? h2p - h1p - 360 : h2p - h1p + 360); }
	const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
	const Lbp = (L1 + L2) / 2; const Cbp = (C1p + C2p) / 2;
	let hbp = h1p + h2p;
	if(C1p * C2p !== 0){ hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : ((h1p + h2p < 360) ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2); }
	const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
	const dth = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2)); const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
	const SL = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)); const SC = 1 + 0.045 * Cbp; const SH = 1 + 0.015 * Cbp * T;
	const RT = -Math.sin(2 * dth * rad) * RC;
	return Math.sqrt(Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH));
}
const MIN_DE = 12;
function closePairs(named){
	const out = [];
	const ks = Object.keys(named);
	for(let i = 0; i < ks.length; i++){
		for(let j = i + 1; j < ks.length; j++){
			const d = deltaE00(named[ks[i]], named[ks[j]]);
			if(d < MIN_DE){ out.push(`${ks[i]}~${ks[j]} ΔE00 ${d.toFixed(1)}`); }
		}
	}
	return out;
}
const SERIES_N = 12;
const seriesSet = (theme)=>{
	const o = {};
	for(let n = 1; n <= SERIES_N; n++){ o[`series-${n}`] = themeColor(theme, `--horosa-series-${n}`); }
	return o;
};
// 用了这套色板的多序列图:[文件, 色表变量名];色表必须由 seriesPalette 的函数给,不许出现字面色值
const SERIES_CONSUMERS = [
];
// 星名为键的十六进制色表(兜底扫描)里豁免的:[文件, 变量名, 理由]
const PLANET_MAP_ALLOW = [
	['components/fengshui/fengshuiData.js', 'WUXING_HEX', '风水五行色画在用户户型图 / 罗盘皮肤与定色导出卡上,不随界面主题(③ 的风水豁免同一理由)'],
];
const PLANET_KEYS = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
	'SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO', '日', '月', '水', '金', '火', '木', '土']);
function listJs(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(f !== '__tests__'){ listJs(p, out); } }else if(/\.js$/.test(f)){ out.push(p); }
	});
	return out;
}
function propKey(p){
	if(p.computed){ return p.key && p.key.type === 'MemberExpression' && p.key.property ? p.key.property.name : null; }
	return p.key && (p.key.name || p.key.value);
}
// 收集星名为键、值是十六进制字面量的对象字面量 → [{ rel, line, owner, theme, colors }]
function scanPlanetHexMaps(rel, src){
	let ast;
	try{ ast = parser.parse(src, PARSE_OPTS); }catch(e){ return []; }
	const found = [];
	traverse(ast, {
		ObjectExpression(p){
			const props = p.node.properties.filter((x)=>x.type === 'ObjectProperty');
			if(props.filter((x)=>PLANET_KEYS.has(propKey(x))).length < 3){ return; }
			const colors = {};
			props.forEach((x)=>{ if(x.value.type === 'StringLiteral' && /^#[0-9a-f]{3,8}$/i.test(x.value.value)){ colors[propKey(x) || '?'] = x.value.value; } });
			if(Object.keys(colors).length < 3){ return; }
			let owner = ''; let theme = null; let q = p.parentPath;
			while(q){
				if(q.node.type === 'ObjectProperty'){ const k = `${propKey(q.node) || ''}`; if(!theme && /^(light|dark)$/i.test(k)){ theme = k.toLowerCase(); } }
				if(q.node.type === 'VariableDeclarator' && q.node.id.type === 'Identifier'){ owner = q.node.id.name; break; }
				q = q.parentPath;
			}
			if(!theme && /LIGHT/i.test(owner)){ theme = 'light'; }
			if(!theme && /DARK/i.test(owner)){ theme = 'dark'; }
			found.push({ rel, line: p.node.loc.start.line, owner, theme, colors });
		},
	});
	return found;
}

describe('⑤ 多序列曲线分类色板', ()=>{
	it('亮 / 暗两个根主题块都定义了 --horosa-series-1..12', ()=>{
		const miss = [];
		for(let n = 1; n <= SERIES_N; n++){
			if(!parseColor(LIGHT[`--horosa-series-${n}`] || '')){ miss.push(`light --horosa-series-${n}`); }
			if(!parseColor(DARK[`--horosa-series-${n}`] || '')){ miss.push(`dark --horosa-series-${n}`); }
		}
		expect(miss).toEqual([]);
	});
	it('每色在本主题全部盘面底上 ≥ 3:1(标签压 0.9 不透明度后仍 ≥ 3:1)', ()=>{
		const bad = [];
		ALL_THEMES.forEach((theme)=>{
			Object.entries(seriesSet(theme)).forEach(([k, c])=>{
				const w = Math.min(worst(c, CHART_BG[theme]), ...CHART_BG[theme].map((b)=>contrast(over(c, b, 0.9), b)));
				if(!(w >= MIN)){ bad.push(`${theme} ${k} ${fmt(c)} ${w.toFixed(2)}:1`); }
			});
		});
		expect(bad).toEqual([]);
	});
	it('同套两两 CIEDE2000 ≥ 12(亮 · 宣纸 / 亮 · 经典白 / 暗)', ()=>{
		const bad = [];
		ALL_THEMES.forEach((theme)=>{ closePairs(seriesSet(theme)).forEach((x)=>bad.push(`${theme} ${x}`)); });
		expect(bad).toEqual([]);
	});
	// 色觉缺陷(Machado 2009 全强度:绿色弱 / 红色弱 / 蓝色弱)下,同图两两要么模拟色差够(≥ CVD_MIN_DE),要么线型不同。
	// 线型分配在 constants/seriesPalette 的 SERIES_DASH_BY_SLOT;CVD_MIN_DE 只许升不许降。
	it('色觉缺陷模拟下同图两两:色差 ≥ 8,否则线型必须不同', ()=>{
		const { seriesDashVar } = require('../../constants/seriesPalette');
		const CVD_MIN_DE = 8;
		const MACHADO = {
			deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
			protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
			tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
		};
		const lin = (v)=>{ const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
		const enc = (v)=>{ const x = Math.min(1, Math.max(0, v)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
		const sim = (c, m)=>{ const l = [lin(c.r), lin(c.g), lin(c.b)]; const o = m.map((row)=>enc(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])); return { r: o[0], g: o[1], b: o[2] }; };
		const bad = [];
		let minSameDash = Infinity;
		ALL_THEMES.forEach((theme)=>{
			const set = seriesSet(theme);
			Object.entries(MACHADO).forEach(([kind, m])=>{
				for(let i = 1; i <= SERIES_N; i++){
					for(let j = i + 1; j <= SERIES_N; j++){
						const d = deltaE00(sim(set[`series-${i}`], m), sim(set[`series-${j}`], m));
						if(seriesDashVar(i) === seriesDashVar(j)){
							minSameDash = Math.min(minSameDash, d);
							if(d < CVD_MIN_DE){ bad.push(`${theme} ${kind} series-${i}~series-${j} ΔE00 ${d.toFixed(1)} 且线型相同`); }
						}
					}
				}
			});
		});
		expect(bad).toEqual([]);
		expect(minSameDash).toBeGreaterThanOrEqual(CVD_MIN_DE);
		// 判据自检:把线型全改实线 → 亮色月 ~ 木(绿色弱 2.0)必报
		const lightSet = seriesSet(ALL_THEMES[0]);
		expect(deltaE00(sim(lightSet['series-2'], MACHADO.deuteranopia), sim(lightSet['series-6'], MACHADO.deuteranopia))).toBeLessThan(CVD_MIN_DE);
	});
	it('多序列图的曲线都带线型(经 seriesDashOf / seriesDashVar)', ()=>{
		const users = [
			['components/germany/UranianGraphicEphemeris.js', /strokeDasharray=\{s\.dash\}/, /dash: seriesDashOf\(/],
		];
		const bad = [];
		users.forEach(([f, a, b])=>{
			const abs = path.join(SRC, f);
			if(!fs.existsSync(abs)){ return; }
			const src = fs.readFileSync(abs, 'utf8');
			if(!a.test(src) || !b.test(src)){ bad.push(`${f} 的曲线没有接线型冗余编码`); }
		});
		expect(bad).toEqual([]);
	});
	it('星 → 序号映射:十颗行星各占一号,两交点同号、四轴同号', ()=>{
		const { SERIES_SLOT_BY_PLANET, seriesColorOf } = require('../../constants/seriesPalette');
		const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
		expect(new Set(planets.map((p)=>SERIES_SLOT_BY_PLANET[p])).size).toBe(10);
		expect(SERIES_SLOT_BY_PLANET[AstroConst.NORTH_NODE]).toBe(SERIES_SLOT_BY_PLANET[AstroConst.SOUTH_NODE]);
		expect(SERIES_SLOT_BY_PLANET[AstroConst.ASC]).toBe(SERIES_SLOT_BY_PLANET[AstroConst.MC]);
		expect(seriesColorOf('Sun')).toBe('var(--horosa-series-1)');
		expect(seriesColorOf('Ceres')).toBeUndefined();
	});
	it('多序列图的星色只经 seriesPalette 取(色表里不出现字面色值 / 语义色)', ()=>{
		const bad = [];
		SERIES_CONSUMERS.forEach(([f, name])=>{
			const abs = path.join(SRC, f);
			if(!fs.existsSync(abs)){ return; }
			const src = fs.readFileSync(abs, 'utf8');
			if(!/from '[./]+constants\/seriesPalette'/.test(src)){ bad.push(`${f} 没有从 constants/seriesPalette 取色`); }
			const ast = parser.parse(src, PARSE_OPTS);
			let seen = false;
			traverse(ast, {
				VariableDeclarator(p){
					if(p.node.id.type !== 'Identifier' || p.node.id.name !== name || !p.node.init){ return; }
					seen = true;
					p.traverse({ StringLiteral(q){
						if(/^\s*(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|var\()/i.test(q.node.value) || NAMED[q.node.value.trim().toLowerCase()]){
							bad.push(`${f}:${q.node.loc.start.line} ${name} 里写了字面色值 '${q.node.value}'(改用 seriesVar / seriesToneMap)`);
						}
					} });
				},
			});
			if(!seen){ bad.push(`${f} 找不到色表 ${name}(改名请同步本登记)`); }
		});
		// 星色经助手函数进曲线与字形的图(量化盘图形星历 toneOf 等)
		const viaHelper = [
			['components/germany/UranianGraphicEphemeris.js', /function toneOf\([^)]*\)\{ return seriesColorOf\(id\)/],
		];
		viaHelper.forEach(([f, re])=>{
			const abs = path.join(SRC, f);
			if(fs.existsSync(abs) && !re.test(fs.readFileSync(abs, 'utf8'))){ bad.push(`${f} 的星色不再经 seriesColorOf`); }
		});
		expect(bad).toEqual([]);
	});
	it('占星地图两套行星色:同套两两 ≥ 12,标签片 / 陆地 / 海洋底上 ≥ 3:1', ()=>{
		const f = 'components/acg/AcgD3Map.js';
		const ast = parser.parse(read(f), PARSE_OPTS);
		const themes = {};
		traverse(ast, {
			VariableDeclarator(p){
				if(p.node.id.name !== 'THEMES'){ return; }
				p.node.init.properties.forEach((tp)=>{
					const o = {};
					tp.value.properties.forEach((x)=>{ if(x.value.type === 'StringLiteral'){ o[propKey(x)] = x.value.value; } if(propKey(x) === 'colors'){ o.colors = {}; x.value.properties.forEach((c)=>{ o.colors[propKey(c)] = c.value.value; }); } });
					themes[propKey(tp)] = o;
				});
			},
		});
		const bad = [];
		['light', 'dark'].forEach((t)=>{
			const th = themes[t];
			expect(th && th.colors && Object.keys(th.colors).length >= 10).toBe(true);
			const named = {}; Object.entries(th.colors).forEach(([k, v])=>{ named[k] = parseColor(v); });
			closePairs(named).forEach((x)=>bad.push(`${t} ${x}`));
			const bgs = [th.chipBg, th.land, th.ocean].map(parseColor);
			Object.entries(named).forEach(([k, c])=>{ const w = worst(c, bgs); if(!(w >= MIN)){ bad.push(`${t} ${k} ${fmt(c)} ${w.toFixed(2)}:1`); } });
		});
		expect(bad).toEqual([]);
	});
	it('兜底扫描:components 下星名为键的十六进制色表,在它所属主题(没写明就亮暗都算)的盘面底上 ≥ 3:1', ()=>{
		const bad = []; const used = new Set();
		listJs(path.join(SRC, 'components'), []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			scanPlanetHexMaps(rel, fs.readFileSync(abs, 'utf8')).forEach((m)=>{
				const allow = PLANET_MAP_ALLOW.find(([af, an])=>af === rel && an === m.owner);
				if(allow){ used.add(`${rel}|${m.owner}`); return; }
				const themes = m.theme === 'dark' ? ['dark'] : (m.theme === 'light' ? ['light', 'classic'] : ALL_THEMES);
				themes.forEach((t)=>{
					Object.entries(m.colors).forEach(([k, v])=>{
						const w = worst(parseColor(v), CHART_BG[t]);
						if(!(w >= MIN)){ bad.push(`${rel}:${m.line} ${m.owner}.${k} ${v} ${t} ${w.toFixed(2)}:1`); }
					});
				});
			});
		});
		expect(bad).toEqual([]);
		PLANET_MAP_ALLOW.forEach(([f, name, why])=>{
			expect([f, `${why}`.length > 8]).toEqual([f, true]);
			if(fs.existsSync(path.join(SRC, f))){ expect([f, name, used.has(`${f}|${name}`)]).toEqual([f, name, true]); }
		});
	});
	it('判别力自证:撞色 / 单主题色表 / 色表写字面量都抓得到', ()=>{
		// 改色前的撞色对(日 ~ 土、月 ~ 海、地图日 ~ 婚神)
		expect(closePairs({ a: parseColor('#8f6400'), b: parseColor('#80602a') }).length).toBe(1);
		expect(closePairs({ a: parseColor('#2f62a8'), b: parseColor('#0958d9') }).length).toBe(1);
		expect(closePairs({ a: parseColor('#B7760F'), b: parseColor('#B37825') }).length).toBe(1);
		expect(closePairs({ a: parseColor('#b3392f'), b: parseColor('#1f7a44') }).length).toBe(0);
		// 只为暗底挑的固定色表(量化盘图形星历旧色)在亮底上被抓
		const probe = "const T = { Sun: '#e0a52e', Moon: '#6f8fd0', Mars: '#d24b46' }; const T_DARK = { Sun: '#e0a52e', Moon: '#6f8fd0', Mars: '#d24b46' };";
		const ms = scanPlanetHexMaps('components/__probe__.js', probe);
		expect(ms.map((m)=>[m.owner, m.theme])).toEqual([['T', null], ['T_DARK', 'dark']]);
		expect(worst(parseColor('#e0a52e'), CHART_BG.light) < MIN).toBe(true);
		expect(worst(parseColor('#e0a52e'), CHART_BG.dark) >= MIN).toBe(true);
	});
});
