// 桌面壳自带页面(启动器 / 偏好设置 / 诊断中心)的界面简繁。
// 这三页不在主应用里,由 Horosa_Desktop_Installer/web/shell_script.js 就地转繁体,字表 web/shell_hant_table.js 是生成物:
//   三页源码(html 正文与属性、js 字符串)+ 壳层源码字符串字面量里的每一段中文 → 主应用显示层转换器的结果。
// 文案改了 / 新增了跑一次 UPDATE_SHELL_PAGE_STRINGS=1 重写字表(要人看一眼 diff),再提交。
//   ① 字表 = 现有源码重新生成的结果(逐段一致;多了少了都红)
//   ② 三页都在 <head> 里先载字表、再载 shell_script.js
//   ③ 行为:繁体档就地转、观察者跟着转、切回简体放回原文、输入框的值与 keep 区不转
//   ④ 壳侧接线:建窗注入档位、切换时对已开的页调 setMode、页面确认档位的命令已注册
//   ⑤ 整句一致:源码里每条中文字面量,按段转的结果与主应用整句转的结果相同(例外逐条登记)
import fs from 'fs';
import path from 'path';

const { toHant } = require('../scriptConvert/hantConverter');

const INSTALLER = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer');
const WEB = path.join(INSTALLER, 'web');
const RUST = path.join(INSTALLER, 'src-tauri', 'src');
const TABLE_FILE = path.join(WEB, 'shell_hant_table.js');
const PAGES = ['index.html', 'settings.html', 'diagnostics.html'];

// horosa_win_shell_layout_v1(Windows 侧移植适配):这一组核的是 Tauri 壳自带三页(web/)与 Rust 壳源,Windows 壳(Electron)没有这些文件。
// Electron 侧同一套合同在 desktop_installer_bundle/electron/shell-text.test.js(① 文案表 / ③ 字表新鲜度 / ④ 两页先载 shell-script.js /
// ⑥ 页面就地转:正文属性转、keep 区与输入值不转、后写入跟着转、切回放回原文)+ 发布自检「shell script mode」门(gen-shell-hant-table.cjs --check)。
// 只在 Tauri 壳源缺席时跳过;壳源在场(macOS)逐字照跑。
const HAS_TAURI_WEB = fs.existsSync(path.join(WEB, 'shell_script.js'));
const shell = HAS_TAURI_WEB ? require(path.join(WEB, 'shell_script.js')) : null;
const RUN_RE = HAS_TAURI_WEB ? new RegExp(shell.RUN_SOURCE, 'g') : null;

// JS:去掉注释(认得出字符串 / 模板字符串里的 //)
function stripJsComments(src){
	let out = '';
	let i = 0;
	let q = null;
	while(i < src.length){
		const c = src[i];
		if(q){
			out += c;
			if(c === '\\'){ out += src[i + 1] || ''; i += 2; continue; }
			if(c === q){ q = null; }
			i += 1;
			continue;
		}
		if(c === '/' && src[i + 1] === '/'){ const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
		if(c === '/' && src[i + 1] === '*'){ const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
		if(c === '\'' || c === '"' || c === '`'){ q = c; }
		out += c;
		i += 1;
	}
	return out;
}

// Rust:只取字符串字面量(普通串与 r#"…"# 原始串;跳过注释与字符字面量)
function rustLiterals(src){
	const out = [];
	let i = 0;
	const n = src.length;
	while(i < n){
		const c = src[i];
		if(c === '/' && src[i + 1] === '/'){ const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
		if(c === '/' && src[i + 1] === '*'){
			let d = 1; i += 2;
			while(i < n && d > 0){
				if(src[i] === '/' && src[i + 1] === '*'){ d += 1; i += 2; }else if(src[i] === '*' && src[i + 1] === '/'){ d -= 1; i += 2; }else{ i += 1; }
			}
			continue;
		}
		if(c === 'r' && !/[A-Za-z0-9_]/.test(src[i - 1] || '')){
			const m = src.slice(i, i + 40).match(/^r(#*)"/);
			if(m){
				const close = `"${m[1]}`;
				const s = i + m[0].length;
				const e = src.indexOf(close, s);
				out.push(src.slice(s, e));
				i = e + close.length;
				continue;
			}
		}
		if(c === '"'){
			let j = i + 1;
			let b = '';
			while(j < n && src[j] !== '"'){
				if(src[j] === '\\'){ b += src[j] + src[j + 1]; j += 2; }else{ b += src[j]; j += 1; }
			}
			out.push(b);
			i = j + 1;
			continue;
		}
		if(c === '\''){
			const m = src.slice(i, i + 12).match(/^'(\\u\{[0-9a-fA-F]+\}|\\.|[^\\'])'/u);
			if(m){ i += m[0].length; continue; }
		}
		i += 1;
	}
	return out;
}

// 取字的源码视图(缺省 = 源码原样)
let publicProjection = (text)=>text;
const readPublic = (p)=>publicProjection(fs.readFileSync(p, 'utf8'));

function sourceTexts(){
	const texts = [];
	fs.readdirSync(WEB).sort().forEach((f)=>{
		const p = path.join(WEB, f);
		if(f.endsWith('.html')){ texts.push(readPublic(p).replace(/<!--[\s\S]*?-->/g, '')); }
		else if(f.endsWith('.js') && f !== 'shell_hant_table.js'){ texts.push(stripJsComments(readPublic(p))); }
	});
	fs.readdirSync(RUST).sort().forEach((f)=>{
		if(!f.endsWith('.rs') || /tests?\.rs$/.test(f)){ return; }
		rustLiterals(readPublic(path.join(RUST, f))).forEach((l)=>texts.push(l));
	});
	return texts;
}

function buildTable(){
	const runs = new Set();
	sourceTexts().forEach((t)=>{ (t.match(RUN_RE) || []).forEach((r)=>runs.add(r)); });
	const out = { runs: {}, chars: {} };
	const chars = new Set();
	[...runs].sort().forEach((r)=>{
		out.runs[r] = toHant(r);
		Array.from(r).forEach((c)=>{ if(/[㐀-鿿豈-﫿]/.test(c)){ chars.add(c); } });
	});
	[...chars].sort().forEach((c)=>{ out.chars[c] = toHant(c); });
	return out;
}

function renderTable(t){
	const runs = Object.keys(t.runs).map((k)=>`\t\t${JSON.stringify(k)}: ${JSON.stringify(t.runs[k])},`).join('\n');
	const chars = Object.keys(t.chars).map((k)=>`${JSON.stringify(k)}:${JSON.stringify(t.chars[k])}`).join(',');
	return '// 生成物,勿手改:壳自带三页的繁体字表(每段中文 → 主应用显示层转换器的结果)。\n'
		+ '// 由前端 jest shellPageScript.test.js 生成与比对;文案改了跑一次 UPDATE_SHELL_PAGE_STRINGS=1。\n'
		+ '(function (root) {\n'
		+ '\tconst table = {\n'
		+ `\t\truns: {\n${runs.replace(/^\t\t/gm, '\t\t\t')}\n\t\t},\n`
		+ `\t\tchars: {${chars}},\n`
		+ '\t};\n'
		+ '\tif (typeof module !== \'undefined\' && module.exports) module.exports = table;\n'
		+ '\tif (root) root.HorosaShellHantTable = table;\n'
		+ '})(typeof window !== \'undefined\' ? window : null);\n';
}

(HAS_TAURI_WEB ? describe : describe.skip)('壳自带页面 · 界面简繁', ()=>{
	it('① 字表 = 现有源码重新生成的结果', ()=>{
		const now = buildTable();
		if(process.env.UPDATE_SHELL_PAGE_STRINGS === '1'){ fs.writeFileSync(TABLE_FILE, renderTable(now)); }
		const text = fs.readFileSync(TABLE_FILE, 'utf8');
		expect(text).toBe(renderTable(now));
		expect(Object.keys(now.runs).length).toBeGreaterThan(1000);   // 防取段静默失效
		expect(now.runs['偏好设置']).toBe('偏好設置');
		expect(now.runs['正在后台启动']).toBe('正在後臺啟動');
	});

	it('② 三页都在 <head> 里先载字表、再载 shell_script.js', ()=>{
		PAGES.forEach((p)=>{
			const html = fs.readFileSync(path.join(WEB, p), 'utf8');
			const head = html.slice(0, html.indexOf('</head>'));
			const a = head.indexOf('<script src="./shell_hant_table.js"></script>');
			const b = head.indexOf('<script src="./shell_script.js"></script>');
			expect(`${p}:${a >= 0 && b > a}`).toBe(`${p}:true`);
		});
	});

	describe('③ 行为', ()=>{
		function boot(mode){
			document.documentElement.removeAttribute('lang');
			document.body.innerHTML = '<h1 title="检查更新">正在后台启动 星阙 Python / Java 服务…</h1>'
				+ '<input id="t" type="text" value="数据目录" placeholder="选择数据目录">'
				+ '<input id="b" type="button" value="重新检查">'
				+ '<p class="horosa-script-keep">原始信息：后台</p><textarea>后台</textarea><p id="d"></p>';
			window.__HOROSA_SHELL_SCRIPT = mode;
			delete window.HorosaShellScript;
			window.eval(fs.readFileSync(TABLE_FILE, 'utf8'));
			window.eval(fs.readFileSync(path.join(WEB, 'shell_script.js'), 'utf8'));
			return window.HorosaShellScript;
		}
		const flush = ()=>new Promise((r)=>setTimeout(r, 0));

		it('繁体档:正文与显示属性就地转;输入框的值、keep 区、textarea 不转;切回简体放回原文', async ()=>{
			const api = boot('hant');
			expect(api.getMode()).toBe('hant');
			const h1 = document.querySelector('h1');
			expect(h1.textContent).toBe('正在後臺啟動 星闕 Python / Java 服務…');
			expect(h1.getAttribute('title')).toBe('檢查更新');
			expect(document.getElementById('t').value).toBe('数据目录');
			expect(document.getElementById('t').getAttribute('placeholder')).toBe('選擇數據目錄');
			expect(document.getElementById('b').getAttribute('value')).toBe('重新檢查');
			expect(document.querySelector('.horosa-script-keep').textContent).toBe('原始信息：后台');
			expect(document.querySelector('textarea').textContent).toBe('后台');
			expect(document.documentElement.getAttribute('lang')).toBe('zh-Hant');
			// 页面脚本之后写进来的字(壳推来的状态句)跟着转
			document.getElementById('d').textContent = '检测到端口被占用，正在自动重选端口重试…';
			await flush();
			expect(document.getElementById('d').textContent).toBe(toHant('检测到端口被占用，正在自动重选端口重试…'));
			// 直接改文字节点(characterData)也跟着转
			const tn = document.getElementById('d').firstChild;
			tn.data = '重新检查';
			await flush();
			expect(tn.data).toBe('重新檢查');
			// 属性改写同样跟着转
			h1.setAttribute('title', '导出诊断包');
			await flush();
			expect(h1.getAttribute('title')).toBe(toHant('导出诊断包'));
			h1.setAttribute('title', '检查更新');
			await flush();
			api.setMode('hans');
			expect(h1.textContent).toBe('正在后台启动 星阙 Python / Java 服务…');
			expect(h1.getAttribute('title')).toBe('检查更新');
			expect(document.getElementById('d').textContent).toBe('重新检查');
			expect(document.documentElement.hasAttribute('lang')).toBe(false);
			api.setMode('hant');
			expect(h1.textContent).toBe('正在後臺啟動 星闕 Python / Java 服務…');
		});

		it('简体档:什么都不改;表外的段按最长段拼、逐字兜底', async ()=>{
			const api = boot('hans');
			expect(document.querySelector('h1').textContent).toBe('正在后台启动 星阙 Python / Java 服务…');
			expect(api.toHant('正在后台启动星阙')).toBe('正在後臺啟動星闕');
			expect(api.toHant('abc 123')).toBe('abc 123');
		});
	});

	it('④ 壳侧接线:建窗注入档位、切换时对已开的页调 setMode、确认档位的命令已注册', ()=>{
		const win = fs.readFileSync(path.join(RUST, 'ui_windows.rs'), 'utf8');
		const body = (head)=>{ const at = win.indexOf(head); return at < 0 ? '' : win.slice(at, win.indexOf('\n}\n', at)); };
		expect(body('pub(crate) fn build_main_window(')).toMatch(/\.initialization_script\(shell_script_init_script\(\)\)/);
		expect(body('fn create_secondary_window(')).toMatch(/\.initialization_script\(shell_script_init_script\(\)\)/);
		const text = fs.readFileSync(path.join(RUST, 'shell_text.rs'), 'utf8');
		const set = text.slice(text.indexOf('fn set_shell_script_command('));
		expect(set.slice(0, set.indexOf('\n}\n'))).toMatch(/push_shell_script_to_pages\(/);
		expect(text).toMatch(/HorosaShellScript\.setMode\(/);
		const main = fs.readFileSync(path.join(RUST, 'main.rs'), 'utf8');
		expect(main).toMatch(/\bget_shell_script_command,/);
		expect(fs.readFileSync(path.join(WEB, 'shell_script.js'), 'utf8')).toMatch(/invoke\('get_shell_script_command'\)/);
	});

	it('⑤ 源码里每条中文字面量:按段转 = 整句转(例外逐条登记)', ()=>{
		// 按段转只看段内语境;跨段(隔着数字 / 英文 / 空格)的语境差异在这里一览无余
		window.eval(fs.readFileSync(TABLE_FILE, 'utf8'));
		const KNOWN = [];
		const bad = new Set();
		let checked = 0;
		sourceTexts().forEach((t)=>{
			const lits = t.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>[^<]+</g) || [t];
			lits.forEach((l)=>{
				if(!RUN_RE.test(l)){ RUN_RE.lastIndex = 0; return; }
				RUN_RE.lastIndex = 0;
				checked += 1;
				if(shell.toHant(l) !== toHant(l) && KNOWN.indexOf(l) < 0){ bad.add(`${l} → ${shell.toHant(l)} ≠ ${toHant(l)}`); }
			});
		});
		expect([...bad].sort()).toEqual([]);
		expect(checked).toBeGreaterThan(1000);   // 防取字面量静默失效
	});
});
