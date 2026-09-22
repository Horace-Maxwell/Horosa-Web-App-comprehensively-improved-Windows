/**
 * 全站 vh/vw 静态复发闸 —— 2026-09-17 用户在新机 macOS Tahoe 的 APP 实报(天文馆底部大白边 /
 * 数据库页缩小右侧留白、放大被裁)定谳后的制度化:
 *
 *   标准化 zoom 引擎(Tahoe WebKit / Chromium)下,vh/vw 按**未缩放的物理视口**解析再被 zoom 一起缩放,
 *   缩放≠1 时与容器(布局视口 = 物理 / z)劈叉 ⇒ z<1 留白、z>1 溢出被裁;旧引擎反而正确。
 *   修法 = utils/layoutViewportVars 把实测布局视口发布成 --horosa-lvw / --horosa-lvh,样式一律
 *   calc(N * var(--horosa-lvh, 1vh))。本闸锁:
 *   ① src 下 less/css/js(测试除外)的代码(非注释)里不得再出现裸 Nvh / Nvw(var() 回落值除外);
 *   ② Less 里含该变量的 min()/max() 必须 ~"…" 转义(Less 3 会把未转义 min/max 当内置函数求值,
 *      带 calc/var 的参数被静默丢掉 —— 实测 `min(420px, calc(100vw - 32px))` 编成 `420px`);
 *   ③ global.js 真的安装了发布器;数据库内嵌页(iframe)走反缩放 + 内页自缩放接力;内页无裸 vw。
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(UI_ROOT, 'src');
const SKIP_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'dist-file', '.umi', '.umi-production']);
const TOKEN = /(?<![\w.\-])(\d+(?:\.\d+)?)(vh|vw)(?![\w-])/g;

function walk(dir, out){
	for(const name of fs.readdirSync(dir)){
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(!SKIP_DIRS.has(name)){ walk(p, out); }
		}else if(/\.(less|css|js)$/.test(name)){
			out.push(p);
		}
	}
	return out;
}

// 注释掩码:/* … */ 与 //(冒号紧邻的 // 视为 url 的一部分);字符串内不算注释。
function commentMask(text){
	const mask = new Uint8Array(text.length);
	let i = 0; let inStr = null;
	while(i < text.length){
		const c = text[i];
		if(inStr){
			if(c === '\\'){ i += 2; continue; }
			if(c === inStr){ inStr = null; }
			i += 1; continue;
		}
		if(c === '"' || c === "'" || c === '`'){ inStr = c; i += 1; continue; }
		if(text.startsWith('/*', i)){
			let j = text.indexOf('*/', i + 2); j = j < 0 ? text.length : j + 2;
			for(let k = i; k < j; k++){ mask[k] = 1; }
			i = j; continue;
		}
		if(text.startsWith('//', i)){
			if(i > 0 && text[i - 1] === ':'){ i += 2; continue; }
			let j = text.indexOf('\n', i); j = j < 0 ? text.length : j;
			for(let k = i; k < j; k++){ mask[k] = 1; }
			i = j; continue;
		}
		i += 1;
	}
	return mask;
}

function lineOf(text, idx){ return text.slice(0, idx).split('\n').length; }

function inEscapedString(text, pos){
	const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
	const seg = text.slice(lineStart, pos);
	const k = seg.lastIndexOf('~"');
	if(k < 0){ return false; }
	return (seg.slice(k + 2).split('"').length - 1) % 2 === 0;
}

const FILES = walk(SRC, []);

test('① src 代码里无裸 vh/vw(var(--horosa-lv?, 1v?) 回落值除外;注释不计)', () => {
	const offenders = [];
	for(const p of FILES){
		const text = fs.readFileSync(p, 'utf8');
		if(!/\d(vh|vw)\b/.test(text)){ continue; }
		const mask = commentMask(text);
		TOKEN.lastIndex = 0;
		let m;
		while((m = TOKEN.exec(text))){
			if(mask[m.index]){ continue; }
			const ctx = text.slice(Math.max(0, m.index - 24), m.index + m[0].length + 1);
			if(/var\(--horosa-lv[wh], 1v[wh]\)/.test(ctx)){ continue; }
			offenders.push(`${path.relative(UI_ROOT, p)}:${lineOf(text, m.index)}: ${m[0]}`);
		}
	}
	expect(offenders).toEqual([]);
});

test('② Less 里含布局视口变量的 min()/max() 必须 ~"…" 转义(否则 Less 静默丢参数)', () => {
	const offenders = [];
	for(const p of FILES){
		if(!/\.less$/.test(p)){ continue; }
		const text = fs.readFileSync(p, 'utf8');
		if(!text.includes('var(--horosa-lv')){ continue; }
		const mask = commentMask(text);
		const re = /(?<![\w-])(min|max)\(/g;
		let m;
		while((m = re.exec(text))){
			if(mask[m.index]){ continue; }
			// 找到匹配的右括号
			let depth = 0; let close = -1;
			for(let i = m.index + m[0].length - 1; i < text.length; i++){
				if(text[i] === '('){ depth++; }
				else if(text[i] === ')'){ depth--; if(depth === 0){ close = i; break; } }
			}
			if(close < 0){ continue; }
			const body = text.slice(m.index, close + 1);
			if(!body.includes('var(--horosa-lv')){ continue; }
			if(inEscapedString(text, m.index)){ continue; }
			offenders.push(`${path.relative(UI_ROOT, p)}:${lineOf(text, m.index)}: ${body.slice(0, 80)}`);
		}
	}
	expect(offenders).toEqual([]);
});

test('③ 发布器已安装(global.js);数据库 iframe 反缩放 + 内页接力;内页无裸 vw', () => {
	const globalJs = fs.readFileSync(path.join(SRC, 'global.js'), 'utf8');
	const gm = commentMask(globalJs);
	const gi = globalJs.indexOf('__installLayoutViewportVars();');
	expect(gi).toBeGreaterThan(-1);
	expect(gm[gi]).toBe(0);

	const page = fs.readFileSync(path.join(SRC, 'components', 'astrodata', 'AstrodataPage.js'), 'utf8');
	expect(page).toContain('frameCounterZoom(');
	expect(page).toContain("'astrodata:setZoom'");
	// 反缩放必须由实测决定(旧语义引擎零改动),不得按引擎/版本分支
	expect(page).toContain('needsCounterZoom(');
	expect(page).not.toMatch(/navigator\.userAgent|platform\.match|isTahoe|macOS\s*26/);

	const inner = fs.readFileSync(path.join(UI_ROOT, 'public', 'astrodata', 'index.html'), 'utf8');
	expect(inner).toContain("d.type==='astrodata:setZoom'");
	expect(inner).toContain("url.get('zoom')");
	expect(inner).toContain('var(--lvw, 1vw)');
	// 内页样式里不得再有裸 vw/vh(注释不计)
	const im = commentMask(inner);
	TOKEN.lastIndex = 0;
	const raw = [];
	let m;
	while((m = TOKEN.exec(inner))){
		if(im[m.index]){ continue; }
		const ctx = inner.slice(Math.max(0, m.index - 16), m.index + m[0].length + 1);
		if(/var\(--lv[wh], 1v[wh]\)/.test(ctx)){ continue; }
		raw.push(`${lineOf(inner, m.index)}: ${m[0]}`);
	}
	expect(raw).toEqual([]);
});
