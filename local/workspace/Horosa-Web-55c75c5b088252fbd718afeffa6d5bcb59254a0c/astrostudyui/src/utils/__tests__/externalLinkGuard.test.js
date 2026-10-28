// 外链一律交系统浏览器:桌面 webview 吞新窗口请求(<a target="_blank"> / window.open 点了没反应),
// 不带 target 的外链会把主窗口本身导航到外部网站。
//   · 静态:源码里不许再写 target="_blank";window.open 只许 openExternalUrl 里那一处网页版回落;app.js 装文档级兜底恰一次。
//   · 行为:ExternalLink 组件、文档级兜底、隐藏 iframe 打印各自的判别用例。
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

jest.mock('../aiAnalysisDesktop', ()=>({ openExternalUrl: jest.fn(()=>Promise.resolve(true)) }));
const { openExternalUrl } = require('../aiAnalysisDesktop');
const { installExternalLinkDelegate, isExternalHttpUrl, resolveHttpUrl, externalTargetOf } = require('../externalLink');
const ExternalLink = require('../../components/common/ExternalLink').default;
const { printHtmlDocument } = require('../printHtmlDocument');

const SRC = path.resolve(__dirname, '../..');
function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(['__tests__', 'test', 'node_modules'].includes(e.name) || e.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(e.name)){
			out.push(p);
		}
	});
	return out;
}
// 去注释(行注释不吃 URL 里的 ://)
const code = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((ln)=>ln.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
const BLANK_RE = /target\s*=\s*\{?\s*['"`]_blank/;
const OPEN_RE = /\bwindow\.open\s*\(/;
const OPEN_ALLOWED = new Set(['utils/aiAnalysisDesktop.js']);   // openExternalUrl 的网页版回落

describe('外链静态守卫', ()=>{
	const files = walk(SRC, []).map((f)=>({ rel: path.relative(SRC, f).split(path.sep).join('/'), body: code(fs.readFileSync(f, 'utf8')) }));

	it('源码里零 target="_blank"(组件外链用 ExternalLink,渲染出的 HTML 由文档级兜底接住)', ()=>{
		expect(files.filter((f)=>BLANK_RE.test(f.body)).map((f)=>f.rel)).toEqual([]);
	});
	it('window.open 只在 openExternalUrl 的网页版回落里(打印走 printHtmlDocument 的隐藏 iframe)', ()=>{
		expect(files.filter((f)=>OPEN_RE.test(f.body) && !OPEN_ALLOWED.has(f.rel)).map((f)=>f.rel)).toEqual([]);
		OPEN_ALLOWED.forEach((rel)=>expect(OPEN_RE.test(code(fs.readFileSync(path.join(SRC, rel), 'utf8')))).toBe(true));
	});
	it('app.js 装文档级外链兜底恰一次', ()=>{
		const app = code(fs.readFileSync(path.join(SRC, 'app.js'), 'utf8'));
		expect((app.match(/\binstallExternalLinkDelegate\(\)/g) || []).length).toBe(1);
	});
	it('判别:各种写法都抓得到,注释与 URL 里的 // 不误伤', ()=>{
		["<a href={u} target='_blank'>", '<a target="_blank" href={u}>', "<a target={'_blank'} href={u}>", 'html += `<a target="_blank">`'].forEach((s)=>expect(BLANK_RE.test(code(s))).toBe(true));
		expect(BLANK_RE.test(code("// <a target='_blank'> 旧写法"))).toBe(false);
		expect(OPEN_RE.test(code("const w = window.open('', '_blank');"))).toBe(true);
		expect(OPEN_RE.test(code("const u = 'https://example.com/window.open';"))).toBe(false);
	});
});

describe('ExternalLink 组件', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); openExternalUrl.mockClear(); });
	afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });

	it('http(s) 链接:点了交 openExternalUrl,默认跳转被拦下,不带 target', ()=>{
		act(()=>{ ReactDOM.render(<ExternalLink href=' https://example.org/x ' target='_blank'>卦</ExternalLink>, host); });
		const a = host.querySelector('a');
		expect(a.getAttribute('target')).toBe(null);
		expect(a.getAttribute('rel')).toBe('noopener noreferrer');
		const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
		act(()=>{ a.dispatchEvent(evt); });
		expect(evt.defaultPrevented).toBe(true);
		expect(openExternalUrl).toHaveBeenCalledWith('https://example.org/x');
	});
	it('不是 http(s) 的(空 / 相对路径 / javascript:)只显示文字,不渲染成链接', ()=>{
		['', null, undefined, 'gua/1.html', 'javascript:alert(1)'].forEach((href)=>{
			act(()=>{ ReactDOM.render(<ExternalLink href={href}>字</ExternalLink>, host); });
			expect(host.querySelector('a')).toBe(null);
			expect(host.textContent).toBe('字');
		});
		expect(isExternalHttpUrl('HTTPS://a.b')).toBe(true);
		expect(isExternalHttpUrl('ftp://a.b')).toBe(false);
	});
	it('协议相对地址的组件外链:渲染成解析后的绝对地址,点了交 openExternalUrl', ()=>{
		openExternalUrl.mockClear();
		act(()=>{ ReactDOM.render(<ExternalLink href='//example.org/p'>链</ExternalLink>, host); });
		const a = host.querySelector('a');
		expect(a.getAttribute('href')).toBe('http://example.org/p');
		act(()=>{ a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
		expect(openExternalUrl).toHaveBeenCalledWith('http://example.org/p');
	});
});

describe('文档级外链兜底', ()=>{
	let doc;
	beforeAll(()=>{ doc = document.implementation.createHTMLDocument('t'); installExternalLinkDelegate(doc); });
	beforeEach(()=>openExternalUrl.mockClear());
	const clickOn = (html)=>{
		doc.body.innerHTML = html;
		const el = doc.body.querySelector('[data-hit]') || doc.body.firstElementChild;
		const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
		el.dispatchEvent(evt);
		return evt;
	};

	it('渲染出的 HTML 里的外链(含点到链接里的子元素)交系统浏览器', ()=>{
		const evt = clickOn('<p><a href="https://example.com/a"><b data-hit>回答里的链接</b></a></p>');
		expect(evt.defaultPrevented).toBe(true);
		expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/a');
	});
	it('页内锚点 / 相对路径 / 带 download / 已被组件处理过的点击不动', ()=>{
		[
			'<a href="#sec-1" data-hit>段</a>',
			'<a href="relative/page.html" data-hit>相对</a>',
			'<a href="https://example.com/f.png" download data-hit>下载</a>',
		].forEach((h)=>{ expect(clickOn(h).defaultPrevented).toBe(false); });
		doc.body.innerHTML = '<a href="https://example.com/b" data-hit>x</a>';
		const a = doc.body.querySelector('a');
		a.addEventListener('click', (e)=>e.preventDefault());
		a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(openExternalUrl).not.toHaveBeenCalled();
	});
	it('🔴 协议相对地址(//host/…)、大写协议、前导空白也是外链:交系统浏览器(打开的是解析后的绝对地址)', ()=>{
		const cases = [
			['<a href="//example.com/x" data-hit>协议相对</a>', 'http://example.com/x'],    // 本页是 http,协议随本页
			['<a href="  HTTPS://a.b/c" data-hit>大写</a>', 'https://a.b/c'],
		];
		cases.forEach(([h, want])=>{
			openExternalUrl.mockClear();
			const evt = clickOn(h);
			expect([h, evt.defaultPrevented]).toEqual([h, true]);
			expect(openExternalUrl).toHaveBeenCalledWith(want);
		});
	});
	it('同源地址(相对 /x、协议相对指向本页主机)照常处理,不拦', ()=>{
		openExternalUrl.mockClear();
		['<a href="/x" data-hit>根相对</a>', `<a href="//${window.location.host}/y" data-hit>本机</a>`].forEach((h)=>{
			expect([h, clickOn(h).defaultPrevented]).toEqual([h, false]);
		});
		expect(openExternalUrl).not.toHaveBeenCalled();
	});
	it('判据:按 URL 解析,不按字面前缀', ()=>{
		expect(resolveHttpUrl('//example.com/a', 'tauri://localhost/index.html')).toBe('https://example.com/a');   // 本页不是 http(s):按 https 补协议
		expect(resolveHttpUrl('//example.com/a', 'http://127.0.0.1:5000/index.html')).toBe('http://example.com/a');
		expect(resolveHttpUrl(' HTTP://A.b ')).toBe('http://a.b/');
		['', '/x', 'page.html', '#a', 'javascript:alert(1)', 'mailto:a@b.c', 'ftp://a.b', 'http://'].forEach((u)=>expect([u, resolveHttpUrl(u, 'http://127.0.0.1:5000/')]).toEqual([u, null]));
		expect(resolveHttpUrl('///x', 'http://127.0.0.1:5000/')).toBe('http://x/');   // 浏览器同样把多余的斜杠当协议相对:真会导航到外站
		expect(externalTargetOf('//127.0.0.1:5000/z', { href: 'http://127.0.0.1:5000/index.html', origin: 'http://127.0.0.1:5000' })).toBe(null);
		expect(externalTargetOf('//127.0.0.1:5001/z', { href: 'http://127.0.0.1:5000/index.html', origin: 'http://127.0.0.1:5000' })).toBe('http://127.0.0.1:5001/z');
		expect(isExternalHttpUrl('//example.com')).toBe(true);
	});
	it('重复安装是空操作', ()=>{
		expect(installExternalLinkDelegate(doc)).toBe(false);
	});
});

describe('隐藏 iframe 打印', ()=>{
	function fakeDoc({ printThrows } = {}){
		const print = jest.fn(()=>{ if(printThrows){ throw new Error('no print'); } });
		const idoc = { open: jest.fn(), write: jest.fn(), close: jest.fn(), readyState: 'complete', images: [] };
		const iframe = { setAttribute: jest.fn(), style: {}, contentWindow: { document: idoc, print, focus: jest.fn() }, parentNode: null };
		const body = { appendChild: jest.fn((n)=>{ n.parentNode = { removeChild: jest.fn() }; }) };
		return { doc: { body, createElement: jest.fn(()=>iframe) }, iframe, idoc, print };
	}
	it('写入整份 HTML 后在 iframe 里打印,不开新窗口', async ()=>{
		const f = fakeDoc();
		const spy = jest.spyOn(window, 'open');
		const ok = await printHtmlDocument('<!doctype html><html><body>x</body></html>', { doc: f.doc, settleMs: 0, capMs: 5, cleanupMs: 10 });
		expect(ok).toBe(true);
		expect(f.idoc.write).toHaveBeenCalledWith('<!doctype html><html><body>x</body></html>');
		expect(f.print).toHaveBeenCalledTimes(1);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
	it('打印抛错 / 没有文档 → 如实返回 false', async ()=>{
		expect(await printHtmlDocument('<p/>', { doc: fakeDoc({ printThrows: true }).doc, settleMs: 0, capMs: 5 })).toBe(false);
		expect(await printHtmlDocument('', { doc: fakeDoc().doc })).toBe(false);
	});
});
