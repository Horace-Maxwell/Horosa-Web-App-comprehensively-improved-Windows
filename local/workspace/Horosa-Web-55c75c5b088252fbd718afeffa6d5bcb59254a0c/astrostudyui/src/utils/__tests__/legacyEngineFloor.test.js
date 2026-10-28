/**
 * 旧系统内核特性下限(桌面包下限 macOS 12.0 = Safari 15.0)合同。下限表与判据的单一出处:scripts/legacy-engine-floor.js。
 *   ① 下限表跟着桌面壳的最低系统版本走(改了最低版本必须重核每张表)
 *   ② 判据自证:每条判据一红一绿(含 :has 的三个变异:同名新用点无回退规则 / 兼容层不打回退类 / :has 与回退类合进同一列表)
 *   ③ 源码:脚本里没有目标内核解析不了的语法;每个 .less 现编后的样式过三层判据(选择器 / 声明值 / at 规则)
 *   ④ :has 回退类由兼容层维护:在真认 :has 的 DOM 上逐条规则对拍「:has 选中的」≡「回退类选中的」
 *   ⑤ 兼容层补的脚本 API:逐个删掉原生后补得回来
 *   ⑥ 行内样式的 color-mix 回退(tint):认它的内核拿原串,不认的拿 rgba(三元组变量)
 *   ⑦ 三元组变量与原色同块同值(亮 / 暗 / 各作用域),用到三元组的色,每个定义它的块都要配三元组
 * 产物(dist / dist-file)由构建脚本收尾与发布前自检 [93] 跑同一套判据。
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(UI_ROOT, 'src');
const floor = require(path.join(UI_ROOT, 'scripts', 'legacy-engine-floor.js'));
const { applyHasFallbackNow, installPolyfills } = require('../legacyWebkitCompat');
const harm = require('../../components/dunjia/qimenHarmColors');

const postcss = require('postcss');

function listLess(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name.startsWith('.umi')){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listLess(p, out); return; }
		if(/\.less$/.test(d.name)){ out.push(p); }
	});
	return out;
}
const FACADES = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(UI_ROOT, 'scripts', 'source-sets.json'), 'utf8')).sets).filter((k)=>/\.less$/.test(k)));
const LESS_FILES = listLess(SRC).filter((f)=>!FACADES.has(path.relative(SRC, f).split(path.sep).join('/')));
let compiled = null;
async function compiledAll(){
	if(!compiled){
		compiled = [];
		for(const f of LESS_FILES){ compiled.push({ file: path.relative(SRC, f), css: await floor.compileLessFile(f) }); }
	}
	return compiled;
}

describe('下限表', ()=>{
	// horosa_win_shell_layout_v1(Windows 侧移植适配):这条把下限表钉在 macOS 包的最低系统版本(原装 WebKit = Safari 15)上;
	// Windows 包的渲染内核是 Electron 自带的 Chromium,不随系统走。只在 Tauri 配置缺席时跳过这一条,其余判据照跑(产物仍过同一套下限)。
	(fs.existsSync(path.join(UI_ROOT, '..', '..', floor.FLOOR.configFile)) ? test : test.skip)('跟桌面壳最低系统版本一致', ()=>{
		const conf = JSON.parse(fs.readFileSync(path.join(UI_ROOT, '..', '..', floor.FLOOR.configFile), 'utf8'));
		const min = conf.bundle && conf.bundle.macOS && conf.bundle.macOS.minimumSystemVersion;
		expect(min).toBe(floor.FLOOR.macos);
	});
	test('每条都写了首个支持版本 / 处置;无害丢弃的写了理由', ()=>{
		[...floor.JS_SYNTAX, ...floor.CSS_SELECTORS, ...floor.CSS_VALUES, ...floor.CSS_AT_RULES].forEach((e)=>{
			expect(`${e.firstSafari || ''}`).not.toBe('');
		});
		floor.CSS_VALUES.filter((e)=>e.policy === 'degrade-ok').forEach((e)=>expect(`${e.reason || ''}`.length).toBeGreaterThan(4));
		floor.CSS_VALUES.filter((e)=>e.policy === 'fallback').forEach((e)=>expect(e.probe).toBeInstanceOf(RegExp));
	});
});

describe('判据自证', ()=>{
	test.each(floor.SELF_TEST_VECTORS.map((v)=>[v[0], v]))('%s', (_name, v)=>{
		expect(floor.runVector(v)).toEqual([...v[3]].sort());
	});
	test('跨分包:第三方混列由另一份样式里只给旧内核看的单独成条规则兜住', ()=>{
		const vendor = { file: 'vendor.css', css: '.t a:focus-visible,.t a:hover{color:red}' };
		const ours = { file: 'app.css', css: 'html.horosa-legacy-no-focus-visible .t a:hover{color:red}' };
		expect(floor.scanCssMany([vendor, ours]).map((h)=>h.id)).toEqual([]);
		expect(floor.scanCssMany([vendor]).map((h)=>h.id)).toEqual(['selector-list-mixed']);
		// 兜底那条的声明与第三方那条不同 = 没兜住
		const wrong = { file: 'app.css', css: 'html.horosa-legacy-no-focus-visible .t a:hover{color:blue}' };
		expect(floor.scanCssMany([vendor, wrong]).map((h)=>h.id)).toEqual(['selector-list-mixed']);
	});
	test(':has 回退规则只在同一份样式里认', ()=>{
		const a = { file: 'a.css', css: '.s .t:has(.horosa-main-tab-hidden){display:none}' };
		const b = { file: 'b.css', css: '.s .t.horosa-main-tab-hidden-parent{display:none}' };
		expect(floor.scanCssMany([a, b]).map((h)=>h.id)).toEqual(['has-no-fallback-rule']);
	});
});

describe('源码过下限', ()=>{
	test('脚本 + 每个 .less 现编后的样式:零违规', async ()=>{
		const res = await floor.scanSource(UI_ROOT);
		expect(res.stats.js).toBeGreaterThan(500);
		expect(res.stats.less).toBeGreaterThan(30);
		expect(res.violations.map(floor.fmt)).toEqual([]);
	}, 180000);
});

describe(':has 回退类由兼容层维护(真 :has 对拍)', ()=>{
	const FIXTURE = `
		<div class="horosa-workspace-shell">
		  <div class="mainRootTabs ant-tabs-left">
		    <div class="ant-tabs-nav">
		      <div class="ant-tabs-tab" id="tab-hidden"><span class="horosa-main-tab-hidden"></span></div>
		      <div class="ant-tabs-tab" id="tab-shown"><span class="horosa-main-tab-label"></span></div>
		    </div>
		  </div>
		  <section id="dock-host"><div class="horosa-bottom-quick-dock"></div></section>
		  <div id="deep"><div id="deep-host"><span class="horosa-bottom-quick-dock"></span></div></div>
		  <ul id="list-host"><li class="horosa-bottom-quick-dock"></li></ul>
		  <div class="horosa-zeri-host"><main id="zeri-dock-host"><div class="horosa-bottom-quick-dock"></div></main></div>
		</div>
		<div id="outside"><div class="horosa-bottom-quick-dock"></div></div>`;
	const ids = (sel)=>[...document.querySelectorAll(sel)].map((e)=>e.id || e.className).sort();

	test('每条 :has 规则:回退类选中的元素 ≡ :has 选中的元素(且夹具选得中)', async ()=>{
		const rules = [];
		(await compiledAll()).forEach(({ file, css })=>{
			postcss.parse(css).walkRules((r)=>{
				floor.splitSelectorList(r.selector).forEach((it)=>{
					if(it.indexOf(':has(') < 0){ return; }
					const itN = floor.normSel(it.replace(/:global\s*/g, ''));
					const reg = floor.HAS_FALLBACKS.find((e)=>itN.indexOf(floor.normSel(e.has)) >= 0);
					rules.push({ file, has: itN, twin: reg ? itN.split(floor.normSel(reg.has)).join(floor.normSel(reg.fallback)) : null });
				});
			});
		});
		expect(rules.length).toBeGreaterThanOrEqual(floor.HAS_FALLBACKS.length);
		document.body.innerHTML = FIXTURE;
		applyHasFallbackNow();
		rules.forEach((r)=>{
			expect(r.twin).not.toBeNull();
			const viaHas = ids(r.has);
			expect({ rule: r.has, matched: viaHas.length > 0 }).toEqual({ rule: r.has, matched: true });
			expect({ rule: r.has, viaFallback: ids(r.twin) }).toEqual({ rule: r.has, viaFallback: viaHas });
		});
	}, 120000);

	test('结构变了回退类跟着撤(对拍仍成立)', async ()=>{
		document.body.innerHTML = FIXTURE;
		applyHasFallbackNow();
		document.getElementById('tab-hidden').innerHTML = '<span class="horosa-main-tab-label"></span>';
		document.getElementById('dock-host').innerHTML = '';
		applyHasFallbackNow();
		floor.HAS_FALLBACKS.forEach((e)=>{
			const cls = e.fallback.replace(/^\./, '');
			const marked = [...document.querySelectorAll(`.${cls}`)].map((x)=>x.id).sort();
			const sel = e.has.indexOf(':is(') === 0 ? `.horosa-workspace-shell ${e.has}` : `.horosa-workspace-shell .mainRootTabs.ant-tabs-left > .ant-tabs-nav .ant-tabs-tab${e.has}`;
			expect(marked).toEqual(ids(sel));
		});
	});
});

describe('不认的选择器 → 文档根标记类', ()=>{
	const compat = require('../legacyWebkitCompat');
	test('兼容层的登记与下限表逐条相同', ()=>{
		expect(compat.LEGACY_SELECTOR_ROOT_FLAGS).toEqual(floor.SELECTOR_ROOT_FLAGS);
	});
	test('不认时打类、认了撤类', ()=>{
		const saved = global.CSS;
		try{
			global.CSS = { supports: ()=>false };
			compat.applyLegacySelectorRootFlags();
			floor.SELECTOR_ROOT_FLAGS.forEach((f)=>expect(document.documentElement.classList.contains(f.rootClass)).toBe(true));
			global.CSS = { supports: (q)=>/^selector\(/.test(q) };
			compat.applyLegacySelectorRootFlags();
			floor.SELECTOR_ROOT_FLAGS.forEach((f)=>expect(document.documentElement.classList.contains(f.rootClass)).toBe(false));
		}finally{
			global.CSS = saved;
		}
	});
});

describe('兼容层补的脚本 API', ()=>{
	const holder = (name)=>(name === 'window' ? window : name === 'Object' ? Object : name === 'Array.prototype' ? Array.prototype : String.prototype);
	test.each(floor.JS_POLYFILLED.map(([o, k])=>[`${o}.${k}`, o, k]))('%s 删掉原生后补得回来', (_n, o, k)=>{
		const target = holder(o);
		const saved = Object.getOwnPropertyDescriptor(target, k);
		try{
			delete target[k];
			if(o === 'window' && k === 'cancelIdleCallback'){ delete window.requestIdleCallback; }
			expect(typeof target[k]).not.toBe('function');
			installPolyfills();
			expect(typeof target[k]).toBe('function');
		}finally{
			if(saved){ Object.defineProperty(target, k, saved); }
		}
	});
});

describe('行内样式的 color-mix 回退(tint)', ()=>{
	test('不认 color-mix 时:rgba(三元组变量, 透明度),与 color-mix(… p%, transparent) 同色', ()=>{
		expect(harm.tintFallback('var(--horosa-qimen-menpo, #fa8c16)', 12)).toBe('rgba(var(--horosa-qimen-menpo-rgb, 250, 140, 22), 0.12)');
		expect(harm.tintFallback('var(--x)', 9)).toBe('rgba(var(--x-rgb), 0.09)');
		expect(harm.tintFallback('#2f54eb', 10)).toBe('rgba(47, 84, 235, 0.1)');
		Object.values(harm.QIMEN_HARM_COLOR).forEach((c)=>expect(harm.tintFallback(c, 10)).toMatch(/^rgba\(var\(--horosa-qimen-[a-z]+-rgb, \d+, \d+, \d+\), 0\.1\)$/));
	});
	test('认 color-mix 时原串不变', ()=>{
		jest.resetModules();
		const saved = global.CSS;
		global.CSS = { supports: (p, v)=>p === 'color' && /^color-mix\(/.test(v) };
		try{
			const fresh = require('../../components/dunjia/qimenHarmColors');
			expect(fresh.tint('var(--a, #fff)', 12)).toBe('color-mix(in srgb, var(--a, #fff) 12%, transparent)');
		}finally{
			global.CSS = saved;
		}
	});
	test('jsdom 不认 color-mix → 走回退', ()=>{
		expect(harm.tint('var(--horosa-qimen-kongwang, #2f54eb)', 10)).toBe('rgba(var(--horosa-qimen-kongwang-rgb, 47, 84, 235), 0.1)');
	});
});

// ⑦ 三元组变量的同块同值
function hexTriplet(v){
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(`${v}`.trim());
	if(!m){ return null; }
	const h = m[1].length === 3 ? m[1].split('').map((c)=>c + c).join('') : m[1];
	return [0, 2, 4].map((i)=>parseInt(h.slice(i, i + 2), 16)).join(',');
}
function rgbTokenProblems(sheets, usedRgb){
	const out = [];
	sheets.forEach(({ file, css })=>{
		postcss.parse(css).walkRules((r)=>{
			const defs = {};
			(r.nodes || []).forEach((d)=>{ if(d.type === 'decl' && /^--/.test(d.prop)){ defs[d.prop] = `${d.value}`.trim(); } });
			const where = `${file} ${r.selector.replace(/\s+/g, ' ').slice(0, 80)}`;
			Object.keys(defs).forEach((k)=>{
				const m = /^(--.+)-rgb$/.exec(k);
				if(m){
					const base = defs[m[1]];
					if(base == null){ out.push(`${where}: ${k} 所在块没有定义 ${m[1]}`); return; }
					const want = hexTriplet(base);
					const got = defs[k].replace(/\s+/g, '');
					if(want != null){ if(got !== want){ out.push(`${where}: ${k}=${defs[k]} 与 ${m[1]}=${base} 不同色`); } return; }
					const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(base);
					if(ref){ if(got !== `var(${ref[1]}-rgb)`){ out.push(`${where}: ${m[1]}=${base},${k} 应为 var(${ref[1]}-rgb)`); } return; }
					out.push(`${where}: ${m[1]}=${base} 不是十六进制或 var(),${k} 无从核对`);
					return;
				}
				if(usedRgb.has(k) && defs[`${k}-rgb`] == null){ out.push(`${where}: 定义了 ${k} 却没配 ${k}-rgb(别处用到了它的三元组)`); }
			});
		});
	});
	return out;
}
function usedRgbNames(){
	const used = new Set();
	const walk = (dir)=>fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name.startsWith('.umi') || d.name === '__tests__'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ walk(p); return; }
		if(!/\.(less|css|js|jsx)$/.test(d.name)){ return; }
		const t = fs.readFileSync(p, 'utf8');
		let m;
		const re = /var\(\s*(--[\w-]+?)-rgb\b/g;
		while((m = re.exec(t))){ used.add(m[1]); }
		// 脚本里按色名现拼的(tint 回退):登记的语义色表
	});
	walk(SRC);
	Object.values(harm.QIMEN_HARM_COLOR).forEach((c)=>{ const m = /var\((--[\w-]+)/.exec(c); if(m){ used.add(m[1]); } });
	return used;
}

describe('三元组变量与原色同块同值', ()=>{
	test('判别:不同色 / 缺原色 / 缺三元组 都红', ()=>{
		const used = new Set(['--c']);
		expect(rgbTokenProblems([{ file: 'x', css: ':root{--c:#102030;--c-rgb:16, 32, 48}' }], used)).toEqual([]);
		expect(rgbTokenProblems([{ file: 'x', css: ':root{--c:#102030;--c-rgb:16, 32, 49}' }], used).length).toBe(1);
		expect(rgbTokenProblems([{ file: 'x', css: ':root{--c-rgb:16, 32, 48}' }], used).length).toBe(1);
		expect(rgbTokenProblems([{ file: 'x', css: '.dark{--c:#ffffff}' }], used).length).toBe(1);
		expect(rgbTokenProblems([{ file: 'x', css: '.a{--c:var(--d);--c-rgb:var(--d-rgb)}' }], used)).toEqual([]);
		expect(rgbTokenProblems([{ file: 'x', css: '.a{--c:var(--d);--c-rgb:var(--e-rgb)}' }], used).length).toBe(1);
	});
	test('全部样式', async ()=>{
		const used = usedRgbNames();
		expect(used.has('--horosa-accent')).toBe(true);
		expect(used.has('--horosa-qimen-menpo')).toBe(true);
		expect(rgbTokenProblems(await compiledAll(), used)).toEqual([]);
	}, 120000);
});
