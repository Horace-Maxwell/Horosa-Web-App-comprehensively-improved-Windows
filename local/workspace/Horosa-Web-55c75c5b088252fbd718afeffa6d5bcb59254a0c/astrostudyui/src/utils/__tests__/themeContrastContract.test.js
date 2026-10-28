// 界面文字对比度 · 主题语义色合同(静态,按 WCAG 2.x 相对亮度公式现算)。
//
// 锁四件事:
//  ① 亮(宣纸 / 经典白)/ 暗每一个「文字语义色」在该主题的页面底色上达标(信息字 ≥ 4.5:1;品牌强调色 ≥ 3:1),
//     并且主题块里**每个**颜色变量都必须登记分档(新加的颜色变量不分档 = 红,逼着在加的那一刻想清楚它是不是字)。
//  ② 实底上的字:on-accent / on-solid / on-vermilion 在各自实底上 ≥ 4.5:1(白字压浅金这一族)。
//  ③ 叠乘透明度:日历非本月格整格透明度 × 格内任何一层透明度之后,信息字仍 ≥ 3:1。
//  ④ antd 文字三色(正文 / 标题 / 占位符)与链接三色(常态 / 悬停 / 按下)接到主题变量,
//     且 antd 源码里这些变量不进任何颜色函数(进了 var() 会编译失败)。
//  ⑤ 占星作用域(.horosa-astro-redesign)的字色 astro-text / astro-muted / astro-label 与作用域内的次级字色
//     在作用域底色(暗:black / panel / panel-2;亮:随主题页底)上 ≥ 4.5:1。
// 页面上真看到的颜色另由真 WebKit 扫荡复核:Horosa_Desktop_Installer/scripts/wkprobe/contrast_sweep.sh。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const BASE = read('layouts/app/01-base.less');

// ── WCAG ──
function parseColor(v){
	const s = `${v}`.trim();
	let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
	if(m){ return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }; }
	m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if(m){
		let h = m[1]; if(h.length === 3){ h = h.split('').map((c)=>c + c).join(''); }
		return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
	}
	return null;
}
const over = (fg, bg, alpha)=>{
	const a = alpha === undefined ? fg.a : alpha;
	return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
};
const lum = (c)=>{
	const f = (x)=>{ const v = x / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
	return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
function contrast(fg, bg, alpha){
	const f = over(fg, bg, alpha);
	const a = lum(f), b = lum(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── 主题块解析 ──
function blockVars(src, selectorLine){
	const i = src.indexOf(selectorLine);
	expect([selectorLine, i >= 0]).toEqual([selectorLine, true]);
	const j = src.indexOf('\n    }', i);
	const body = src.slice(i + selectorLine.length, j).replace(/\/\*[\s\S]*?\*\//g, '');
	const out = {};
	const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
	let m = re.exec(body);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(body); }
	return out;
}
const LIGHT = blockVars(BASE, '    :root {');
const CLASSIC = blockVars(BASE, "    :root[data-horosa-light-flavor='classic'] {");
const DARK = blockVars(BASE, "    :root[data-horosa-appearance='dark'] {");
// --horosa-astro-* 在根上也有一份(02-shell 的 portal 组同时挂 :root;暗色基线 + 亮色覆盖),主题块里有引用它的(如暗色 jx-muted)
const SHELL = read('layouts/app/02-shell.less');
const ASTRO_DARK = blockVars(SHELL, '    .ant-dropdown {');
const ASTRO_LIGHT = blockVars(SHELL, "    :root[data-horosa-appearance='light'] .ant-dropdown {");
const THEMES = {
	light: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT },
	classic: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT, ...CLASSIC },
	dark: { ...ASTRO_DARK, ...LIGHT, ...DARK },
};
function resolve(theme, value, depth = 0){
	const m = `${value}`.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
	if(!m){ return `${value}`.trim(); }
	expect(depth).toBeLessThan(8);
	const next = theme[m[1]] !== undefined ? theme[m[1]] : m[2];
	expect([value, next !== undefined]).toEqual([value, true]);
	return resolve(theme, next, depth + 1);
}
const colorOf = (themeName, name)=>{
	const t = THEMES[themeName];
	expect([themeName, name, t[name] !== undefined]).toEqual([themeName, name, true]);
	const c = parseColor(resolve(t, t[name]));
	expect([themeName, name, !!c]).toEqual([themeName, name, true]);
	return c;
};
// 各主题的页面底色:页底、实底面板、半透明软面板压在页底上(格子 / 卡片最常见的三种底)
function pageBackgrounds(themeName){
	const bg = colorOf(themeName, '--horosa-bg');
	const out = { bg, 'surface-solid': colorOf(themeName, '--horosa-surface-solid') };
	const soft = colorOf(themeName, '--horosa-panel-soft');
	if(soft.a >= 0.5){ out['panel-soft/bg'] = over(soft, bg); }
	return out;
}

// ── 分档登记(主题块里每个颜色变量都必须出现在下面某一档)──
const TEXT_AA = [   // 信息文字:≥ 4.5:1
	'--horosa-text', '--horosa-text-soft', '--horosa-muted', '--horosa-accent-strong',
	'--horosa-ant-text', '--horosa-ant-heading', '--horosa-placeholder',
	'--horosa-cinnabar', '--horosa-danger', '--horosa-jade',
	'--horosa-jx-ji', '--horosa-jx-xiong', '--horosa-jx-he', '--horosa-jx-other', '--horosa-jx-muted',
	'--horosa-jx-sheng', '--horosa-jx-ke', '--horosa-jx-chong',
	'--horosa-bazi-wood', '--horosa-bazi-fire', '--horosa-bazi-earth', '--horosa-bazi-metal', '--horosa-bazi-water',
	'--horosa-direction-level-1', '--horosa-direction-level-2', '--horosa-direction-level-3', '--horosa-direction-level-4',
	'--horosa-tab-active-text', '--horosa-tab-inactive-text', '--horosa-tab-hover-text',
	'--horosa-liureng-square-main',
	'--horosa-qimen-jixing', '--horosa-qimen-rumu', '--horosa-qimen-both', '--horosa-qimen-menpo',
	'--horosa-qimen-kongwang', '--horosa-qimen-geng', '--horosa-qimen-baihu',
	'--horosa-planet-sun', '--horosa-planet-moon', '--horosa-planet-mercury', '--horosa-planet-venus',
	'--horosa-planet-mars', '--horosa-planet-jupiter', '--horosa-planet-saturn',
	'--horosa-decl-oob',
	'--horosa-grade-excellent', '--horosa-grade-good', '--horosa-grade-fair', '--horosa-grade-poor', '--horosa-grade-bad',
	'--horosa-sev-medium', '--horosa-sev-low', '--horosa-sev-info',
	// 次级字色(淡化信息字用它,不用 opacity)/ 链接 / 提示 / 警示 / 紫微四化界面字
	'--horosa-text-secondary', '--horosa-link', '--horosa-info', '--horosa-warn',
	'--horosa-sihua-lu', '--horosa-sihua-quan', '--horosa-sihua-ke', '--horosa-sihua-ji',
	'--horosa-astro-blue',
	// 通用色相字(分节标题 / 分类强调 / 牌组花色;替代各处只为一种主题挑的写死色)
	'--horosa-hue-teal', '--horosa-hue-orange', '--horosa-hue-purple', '--horosa-hue-brown',
	// 西占四元素(界面表格里的星座符号字色)
	'--horosa-element-fire', '--horosa-element-earth', '--horosa-element-air', '--horosa-element-water',
];
const TEXT_LARGE = [   // 品牌强调 / 粗体 / 大字 / 交互高亮:≥ 3:1
	'--horosa-accent', '--horosa-gold', '--horosa-md-strong', '--horosa-tab-ink', '--horosa-liureng-square-accent',
	// 六壬五行:盘面地支 + 七政页签 21px 粗体地支(大字档;暗色取值 = 此前行内兜底色,不动)
	'--horosa-liureng-stem-wood', '--horosa-liureng-stem-fire', '--horosa-liureng-stem-earth',
	'--horosa-liureng-stem-metal', '--horosa-liureng-stem-water',
	// 链接悬停 / 按下(交互瞬态高亮)
	'--horosa-link-hover', '--horosa-link-active',
];
// 实底上的字:[字, 底…]
const ON_SOLID = [
	['--horosa-on-accent', ['--horosa-accent', '--horosa-gold']],
	['--horosa-on-solid', ['--horosa-accent', '--horosa-gold', '--horosa-jx-ji', '--horosa-jx-xiong', '--horosa-jx-he', '--horosa-jx-other', '--horosa-jade', '--horosa-danger',
		'--horosa-grade-excellent', '--horosa-grade-good', '--horosa-grade-fair', '--horosa-grade-poor', '--horosa-grade-bad',
		'--horosa-sev-medium', '--horosa-sev-low', '--horosa-sev-info',
		'--horosa-bazi-wood', '--horosa-bazi-fire', '--horosa-bazi-earth', '--horosa-bazi-metal', '--horosa-bazi-water',
		'--horosa-sihua-lu', '--horosa-sihua-quan', '--horosa-sihua-ke', '--horosa-sihua-ji',
		'--horosa-text-secondary', '--horosa-info', '--horosa-link']],
];
// 盘面绘制色(svg / canvas 里画的字与线;不在本合同,由盘面主题审计 audit_chart_theme.py 管)
// series-N = 多序列曲线分类色板(曲线与星名标签;≥ 3:1 与同套两两色差由 chartInkContrast 合同 ⑤ 管)
const CHART_PAINT = /^--horosa-(ziwei-(star|period|house|duigong|kinastro)|liureng-square-(muted|jiang|line)|series-\d+$)/;
// 非文字:底色 / 线 / 阴影 / 尺寸 / 动效 / 焦点环 / 实底上的字(上面成对算)
// `-rgb` = 某个颜色变量的 r, g, b 三元组(旧内核没有 color-mix 时拼 rgba 用),不是颜色本身;与原色同块同值由 legacyEngineFloor 合同核
const NON_TEXT = /^--horosa-(.*-rgb$|bg|surface|header-bg|nav-bg|panel-|border|shadow|small-shadow|radius|mono$|nav-width|toolbar-height|bottom-dock-height|scroll-safe-bottom|control-height|.*-soft$|.*-bg$|.*-fill$|sanshi-board-|liureng-square-(center-bg|active-bg)|table-row-alt|direction-node-highlight|bazi-interaction|cyan|on-accent|on-solid|tab-(seg-|glow|focus-ring|motion|ease|hover-bg|rail-active-bg|on-thumb)|ziwei-(chart-bg|sanhe-bg|duigong-bg|selected-bg))/;

describe('主题语义色 · 文字对比度合同', ()=>{
	it('主题块里每个颜色变量都已登记分档(信息字 / 强调字 / 实底字 / 盘面 / 非文字)', ()=>{
		const all = new Set([...Object.keys(LIGHT), ...Object.keys(DARK), ...Object.keys(CLASSIC)]);
		const unclassified = [...all].filter((k)=>!TEXT_AA.includes(k) && !TEXT_LARGE.includes(k)
			&& !CHART_PAINT.test(k) && !NON_TEXT.test(k));
		expect(unclassified).toEqual([]);
	});

	it('信息字 ≥ 4.5:1、强调字 ≥ 3:1(亮 · 宣纸 / 亮 · 经典白 / 暗,各自的页底 · 实底面板 · 软面板)', ()=>{
		const bad = [];
		Object.keys(THEMES).forEach((tn)=>{
			const bgs = pageBackgrounds(tn);
			[[TEXT_AA, 4.5], [TEXT_LARGE, 3]].forEach(([list, min])=>{
				list.forEach((name)=>{
					const fg = colorOf(tn, name);
					Object.keys(bgs).forEach((bn)=>{
						const cr = contrast(fg, bgs[bn]);
						if(cr < min){ bad.push(`${tn} ${name} on ${bn} = ${cr.toFixed(2)} < ${min}`); }
					});
				});
			});
		});
		expect(bad).toEqual([]);
	});

	it('亮 / 暗成对:新加的文字语义色两块都要有定义(暗色不许只靠继承亮色值)', ()=>{
		const missing = [...TEXT_AA, ...TEXT_LARGE].filter((k)=>LIGHT[k] === undefined || DARK[k] === undefined);
		expect(missing).toEqual([]);
	});

	it('实底上的字 ≥ 4.5:1(on-accent / on-solid,亮暗各算)', ()=>{
		const bad = [];
		Object.keys(THEMES).forEach((tn)=>{
			ON_SOLID.forEach(([ink, solids])=>{
				const fg = colorOf(tn, ink);
				solids.forEach((s)=>{
					const bg = colorOf(tn, s);
					const cr = contrast(fg, bg);
					if(cr < 4.5){ bad.push(`${tn} ${ink} on ${s} = ${cr.toFixed(2)}`); }
				});
			});
		});
		expect(bad).toEqual([]);
	});

	it('分段控件选中块:选中字在滑块上 ≥ 4.5:1(暗色滑块是半透明软底,先压到实底面板上)', ()=>{
		Object.keys(THEMES).forEach((tn)=>{
			const thumb = colorOf(tn, '--horosa-tab-seg-thumb');
			const base = colorOf(tn, '--horosa-surface-solid');
			const bg = thumb.a < 1 ? over(thumb, base) : thumb;
			expect([tn, contrast(colorOf(tn, '--horosa-tab-on-thumb'), bg) >= 4.5]).toEqual([tn, true]);
		});
	});

	it('奇门盘格底上:六害 / 门迫 / 空亡字 ≥ 4.5:1', ()=>{
		const bad = [];
		Object.keys(THEMES).forEach((tn)=>{
			const board = colorOf(tn, '--horosa-sanshi-board-qimen');
			Object.keys(THEMES[tn]).filter((k)=>k.startsWith('--horosa-qimen-') && !/-rgb$/.test(k)).forEach((k)=>{
				const cr = contrast(colorOf(tn, k), board);
				if(cr < 4.5){ bad.push(`${tn} ${k} = ${cr.toFixed(2)}`); }
			});
		});
		expect(bad).toEqual([]);
	});
});

describe('玄学史页 · 局部色板(.xuanshi-app 亮 / 暗两块)', ()=>{
	const XS = read('components/xuanshi/xuanshiTheme.less');
	const pick = (anchor)=>{
		const i = XS.indexOf(anchor); expect(i).toBeGreaterThanOrEqual(0);
		const j = XS.indexOf('}', i);
		const out = {}; const re = /(--[\w-]+)\s*:\s*([^;]+);/g; let m = re.exec(XS.slice(i, j));
		while(m){ out[m[1]] = parseColor(m[2].trim()); m = re.exec(XS.slice(i, j)); }
		return out;
	};
	const L = pick('\t.xuanshi-app {');
	const D = { ...L, ...pick(":root[data-horosa-appearance='dark'] .xuanshi-app {") };
	it('正文 / 次级 / 弱字在纸底三档上 ≥ 4.5:1;朱砂实底上的字 ≥ 4.5:1', ()=>{
		const bad = [];
		[['light', L], ['dark', D]].forEach(([tn, t])=>{
			['--ink', '--ink-soft', '--ink-muted'].forEach((ink)=>{
				['--paper', '--paper-soft', '--paper-card'].forEach((p)=>{
					const cr = contrast(t[ink], t[p]);
					if(cr < 4.5){ bad.push(`${tn} ${ink} on ${p} = ${cr.toFixed(2)}`); }
				});
			});
			const cr = contrast(t['--on-vermilion'], t['--vermilion']);
			if(cr < 4.5){ bad.push(`${tn} on-vermilion = ${cr.toFixed(2)}`); }
		});
		expect(bad).toEqual([]);
	});
});

describe('占星作用域 · 字色(作用域内 astro-* 一组与次级字色)', ()=>{
	const ASTRO = read('layouts/app/05-astro.less');
	const SCOPE_DARK = blockVars(ASTRO, '    .horosa-workspace-shell .horosa-astro-redesign {');
	const SCOPE_LIGHT = blockVars(ASTRO, "    :root[data-horosa-appearance='light'] .horosa-workspace-shell .horosa-astro-redesign {");
	const scoped = {
		light: { ...THEMES.light, ...SCOPE_DARK, ...SCOPE_LIGHT },
		classic: { ...THEMES.classic, ...SCOPE_DARK, ...SCOPE_LIGHT },
		dark: { ...THEMES.dark, ...SCOPE_DARK },
	};
	const col = (tn, name)=>{
		const t = scoped[tn];
		expect([tn, name, t[name] !== undefined]).toEqual([tn, name, true]);
		const c = parseColor(resolve(t, t[name]));
		expect([tn, name, !!c]).toEqual([tn, name, true]);
		return c;
	};
	it('次级字色在作用域里改指 astro-muted(随作用域换色相,不是另起一个值)', ()=>{
		expect(SCOPE_DARK['--horosa-text-secondary']).toBe('var(--horosa-astro-muted)');
	});
	it('astro-text / astro-muted / astro-label / 次级字色 ≥ 4.5:1(作用域底三档)', ()=>{
		const bad = [];
		Object.keys(scoped).forEach((tn)=>{
			const bgs = ['--horosa-astro-black', '--horosa-astro-panel', '--horosa-astro-panel-2'].map((b)=>{
				const c = col(tn, b);
				return [b, c.a < 1 ? over(c, colorOf(tn, '--horosa-bg')) : c];
			});
			['--horosa-astro-text', '--horosa-astro-muted', '--horosa-astro-label', '--horosa-text-secondary'].forEach((ink)=>{
				bgs.forEach(([bn, bg])=>{
					const cr = contrast(col(tn, ink), bg);
					if(cr < 4.5){ bad.push(`${tn} ${ink} on ${bn} = ${cr.toFixed(2)}`); }
				});
			});
		});
		expect(bad).toEqual([]);
	});
});

describe('紫微四化 · 界面字色与界面药丸', ()=>{
	// 盘面徽标底色(ZWConst.ZWColor 的 bg,禄 #c9912e)只为盘面挑:拿来当界面字色在宣纸底 2.7:1、白字压它 2.8:1。
	// 界面上一律走明暗成对的 --horosa-sihua-*(ZWConst.ZWHuaInk),药丸字 = on-solid。
	const ZW = read('constants/ZWConst.js');
	it('ZWHuaInk 四项都指 --horosa-sihua-*,SihuaColor(资料参考表字色)取自它而不是盘面底色', ()=>{
		['禄', '权', '科', '忌'].forEach((h, i)=>{
			const key = ['lu', 'quan', 'ke', 'ji'][i];
			expect([h, new RegExp(`'${h}':\\s*'var\\(--horosa-sihua-${key}\\)'`).test(ZW)]).toEqual([h, true]);
		});
		expect(ZW).toMatch(/SihuaColor\[0\] = \{color: ZWHuaInk\[/);
		expect(ZW).not.toMatch(/SihuaColor\[\d\] = \{color: ZWColor\[/);
	});
	it('界面药丸(三式紫微四化 / 紫微运限面板):底 = ZWHuaInk,字 = on-solid,不再叠透明度', ()=>{
		const sanshi = read('components/sanshi/SanShiZiWeiSihua.js');
		expect(sanshi).toMatch(/ZWConst\.ZWHuaInk\[r\.hua\]/);
		expect(sanshi).toMatch(/background: bg, color: 'var\(--horosa-on-solid\)'/);
		const luck = read('components/ziwei/ZWLuckPanel.js');
		expect(luck).toMatch(/className="hua" style=\{\{ background: ZWConst\.ZWHuaInk\[h\.hua\]/);
		const less = read('layouts/app/18-ziwei.less');
		const rule = less.match(/\.horosa-ziwei-luck-sihua \.hua \{([^}]*)\}/);
		expect(rule && /color:\s*var\(--horosa-on-solid\)/.test(rule[1])).toBe(true);
	});
});

describe('叠乘透明度 · 日历非本月格', ()=>{
	// 收集所有带 .is-other 的规则里的 opacity:整格那条 × 格内后代那条(若有)= 实际叠乘
	const files = ['layouts/app/04-calendar.less', 'layouts/app/02-shell.less'];
	const rules = [];
	files.forEach((f)=>{
		const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
		const re = /([^{}]*\.is-other[^{}]*)\{([^{}]*)\}/g;
		let m = re.exec(s);
		while(m){
			const op = m[2].match(/(?:^|[;\s])opacity\s*:\s*([\d.]+)/);
			if(op){ rules.push({ sel: m[1].trim(), op: +op[1] }); }
			m = re.exec(s);
		}
	});
	it('至少找到整格那条(判据没失明)', ()=>{
		expect(rules.filter((r)=>/\.is-other\s*$/.test(r.sel)).length).toBeGreaterThanOrEqual(1);
	});
	it('整格 × 格内后代叠乘之后,信息字在亮暗各页底上仍 ≥ 3:1', ()=>{
		const cards = rules.filter((r)=>/\.is-other\s*$/.test(r.sel)).map((r)=>r.op);
		const inner = rules.filter((r)=>/\.is-other\s+\S/.test(r.sel)).map((r)=>r.op);
		const worst = Math.min(...cards) * (inner.length ? Math.min(...inner) : 1);
		const bad = [];
		Object.keys(THEMES).forEach((tn)=>{
			const bgs = pageBackgrounds(tn);
			TEXT_AA.forEach((name)=>{
				Object.keys(bgs).forEach((bn)=>{
					const cr = contrast(colorOf(tn, name), bgs[bn], worst);
					if(cr < 3){ bad.push(`${tn} ${name} on ${bn} ×${worst.toFixed(2)} = ${cr.toFixed(2)}`); }
				});
			});
		});
		expect(bad).toEqual([]);
	});
});

describe('antd 文字三色 + 链接三色接主题变量', ()=>{
	const UMIRC = fs.readFileSync(path.resolve(SRC, '../.umirc.js'), 'utf8');
	const WIRES = {
		'@text-color': '--horosa-ant-text',
		'@heading-color': '--horosa-ant-heading',
		'@input-placeholder-color': '--horosa-placeholder',
		'@link-color': '--horosa-link',
		'@link-hover-color': '--horosa-link-hover',
		'@link-active-color': '--horosa-link-active',
	};
	it('.umirc.js 的 theme 把三色接到对应变量(兜底 = antd 原值)', ()=>{
		Object.keys(WIRES).forEach((lessVar)=>{
			const re = new RegExp(`'${lessVar}'\\s*:\\s*'var\\(${WIRES[lessVar]},\\s*[^']+\\)'`);
			expect([lessVar, re.test(UMIRC)]).toEqual([lessVar, true]);
		});
	});
	it('antd 源码里这些变量不进任何颜色函数(进了 var() 会让 less 编译失败)', ()=>{
		const root = path.resolve(SRC, '../node_modules/antd/lib');
		if(!fs.existsSync(root)){ return; }
		const hits = [];
		const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
			const p = path.join(d, e.name);
			if(e.isDirectory()){ walk(p); return; }
			if(!e.name.endsWith('.less')){ return; }
			const s = fs.readFileSync(p, 'utf8');
			const FN = '(?:fade|fadein|fadeout|tint|shade|darken|lighten|mix|spin|saturate|desaturate|contrast|luma|luminance|hue|saturation|lightness|alpha|red|green|blue|colorPalette|greyscale)';
			s.split('\n').forEach((line)=>{
				// 本身也被改接的变量,其 antd 缺省定义式(如 @link-hover-color: colorPalette('@{link-color}', 5))被覆盖、不再求值 —— 不算
				const def = line.match(/^\s*(@[\w-]+)\s*:/);
				if(def && WIRES[def[1]]){ return; }
				Object.keys(WIRES).forEach((v)=>{
					const name = v.slice(1);
					// 直接传参 fn(@v …) 与 字符串插值 fn('@{v}' …) 两种形态
					const re = new RegExp(`\\b${FN}\\(\\s*(?:${v}(?![\\w-])|['"]@\\{${name}\\}['"])`);
					if(re.test(line)){ hits.push(`${path.relative(root, p)}: ${v}: ${line.trim()}`); }
				});
			});
		});
		walk(root);
		expect(hits).toEqual([]);
	});
});
