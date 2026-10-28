// 外链单一出口(判据 + 全局兜底)。
// 桌面 webview 不处理新窗口请求:<a target="_blank"> 与 window.open 都被吞(点了没反应);不带 target 的外链更糟 —— 主窗口本身
// 被导航到外部网站,应用界面整个被换掉。所以外链一律交 openExternalUrl(桌面壳在系统浏览器打开,只放行 http(s);网页版回落新标签页)。
//   · 组件里写的外链用 components/common/ExternalLink;
//   · 渲染出来的 HTML(AI 回答的 Markdown、帮助页等)里的外链,由 installExternalLinkDelegate 在文档级兜住。
import { openExternalUrl } from './aiAnalysisDesktop';

// 判据按 URL 解析做(不按字面前缀):协议相对地址「//host/…」、大小写「HTTPS://」、前导空白都认得;
// base = 解析相对地址的基准(缺省 = 当前页地址;没有页面地址或页面不是 http(s) 时按 https 解析协议相对地址)。
// 回解析后的绝对 http(s) 地址;不是 http(s)(相对路径 / 锚点 / javascript: / mailto: …)回 null。
export function resolveHttpUrl(url, base){
	const raw = `${url == null ? '' : url}`.trim();
	if(!raw){ return null; }
	let b = base;
	if(b === undefined){
		try{ b = typeof window !== 'undefined' && window.location ? window.location.href : undefined; }catch(e){ b = undefined; }
	}
	const httpBase = typeof b === 'string' && /^https?:/i.test(b) ? b : 'https://localhost/';
	// 协议相对地址:基准页不是 http(s)(file: / tauri:)时按 https 补协议
	const target = /^\/\//.test(raw) && !/^https?:/i.test(`${b || ''}`) ? `https:${raw}` : raw;
	// 只认「本身带 http(s) 协议」或「协议相对」两种;相对路径(page.html / /x / #a)不算外链地址
	if(!/^https?:\/\//i.test(target) && !/^\/\//.test(target)){ return null; }
	try{
		const u = new URL(target, httpBase);
		return (u.protocol === 'http:' || u.protocol === 'https:') && u.host ? u.href : null;
	}catch(e){
		return null;
	}
}

export function isExternalHttpUrl(url, base){
	return resolveHttpUrl(url, base) !== null;
}

// 同源的 http(s) 链接(开发服务器 / 本机静态页自己的地址)不算外链,照常处理。
function isSameOrigin(href, loc){
	try{
		if(!loc || !loc.origin || loc.origin === 'null'){ return false; }
		return new URL(href, loc.href).origin === loc.origin;
	}catch(e){
		return false;
	}
}

// 某个地址是不是「要交系统浏览器的外链」:http(s)(含协议相对)且与当前页不同源。回要打开的绝对地址或 null
export function externalTargetOf(href, loc){
	const abs = resolveHttpUrl(href, loc && loc.href);
	if(!abs){ return null; }
	return isSameOrigin(abs, loc) ? null : abs;
}

// 文档级点击兜底:点到 <a href="http(s)://…">(非同源、没带 download、没被别的处理器 preventDefault)→ 拦下默认跳转,交系统浏览器。
// 冒泡阶段挂在 document 上:React 17 的事件挂在根容器,ExternalLink 等组件自己处理过的点击先 preventDefault,这里看到就跳过。
export function installExternalLinkDelegate(doc){
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if(!d || typeof d.addEventListener !== 'function' || d.__horosaExternalLinkDelegate){
		return false;
	}
	const handler = (evt)=>{
		if(!evt || evt.defaultPrevented){ return; }
		if(typeof evt.button === 'number' && evt.button !== 0){ return; }
		const t = evt.target;
		const a = t && typeof t.closest === 'function' ? t.closest('a[href]') : null;
		if(!a || a.hasAttribute('download')){ return; }
		const href = `${a.getAttribute('href') || ''}`.trim();
		const view = d.defaultView || (typeof window !== 'undefined' ? window : null);
		const abs = externalTargetOf(href, view && view.location);
		if(!abs){ return; }
		evt.preventDefault();
		openExternalUrl(abs);
	};
	d.addEventListener('click', handler, false);
	d.__horosaExternalLinkDelegate = handler;
	return true;
}
