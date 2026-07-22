// 当前页面截图 · 共享单源(PDF/Word 导出文件头附图,各 AI 导出链共用)。
//
// 语义 = 「用户此刻看到的技法三栏整页」:优先截**顶层导航 tabs 的激活面板**(左栏设置+中栏盘面+右栏明细),
// 兜底 #root。live 元素直截(非离屏重挂,无 visibility/getBBox 老坑;所见即所得,含暗色主题)。
//
// 铁律:**截图失败/降级恒返 null,绝不 throw、绝不阻断导出**——调用方对 null 一律「不附图继续导出」。
// 守卫(照抄 aiExport.exportPdf 与命盘图捕获实战经验,机制注释见各处):
//   ① 尺寸守卫:目标单边(CSS×pixelRatio)≤ MAX_EDGE(8000,远低于 canvas 32767 硬上限),超则自动降倍率;
//   ② WebGL 降级:html-to-image 拿不到 WebGL framebuffer(天文馆 babylonjs/3D 星盘 three.js 会截成黑/空),
//      检测到即整体放弃(返 null)——检测用 data-engine 属性 + getContext('2d') 探针(已有 webgl 上下文的
//      canvas 取 2d 恒返 null 且不改变其上下文;零上下文的裸 canvas 会被建 2d,无害);
//   ③ 墨迹守卫:全白/全空渲染不当成功(逻辑同 aiExport.canvasHasInk,因 aiExport 反向 import 本文件,
//      为避环此处持有轻量副本,阈值同款);
//   ④ 串行锁+超时:同刻只跑一张,30s 兜底放行(仿命盘图捕获 withCaptureLock 修正版语义)。

const MAX_EDGE = 8000;            // 设备px 目标单边上限(canvas 硬上限 32767,大图内存/耗时也要控)
const MIN_TARGET_SIZE = 160;      // 目标容器最小边(CSS px),小于视为没找到有效面板
const JPEG_QUALITY = 0.85;
const CAPTURE_TIMEOUT_MS = 30000;

let captureLock = Promise.resolve();

// 截图字形字体内嵌:星盘里的行星/星座符号是「字母→glyph」映射字体(A→日符…),截图不嵌该字体则
// canvas 回退裸字母(A/B/C/D…不成符号)。做法 = 只把**同源、可 fetch、体积小**的 @font-face 字体
// 预取 + base64 内联成 fontEmbedCSS 传给 html-to-image:既避开「全量扫所有样式表 @font-face」的 WKWebView
// 老坑(故不嵌 CJK 等大字体,中文/拉丁走系统字体渲染),又把符号字体嵌进截图。名不写死(从 @font-face 规则
// 动态取 family),对新增符号字体天然生效。模块级缓存(字体不变)。任何失败返 ''(退回 skipFonts,不阻断)。
const MAX_EMBED_FONT_BYTES = 300 * 1024;    // 单字体上限:符号字体皆很小(<50KB);挡意外大字体(CJK ~2.7MB)
const MAX_TOTAL_EMBED_BYTES = 768 * 1024;   // 总量封顶(符号+KaTeX 数字体够用;挡病态几十上百字体撑爆 SVG)
let _screenshotFontCssPromise = null;

function arrayBufferToBase64(buf){
	const bytes = new Uint8Array(buf);
	let binary = '';
	const chunk = 0x8000;
	for(let i = 0; i < bytes.length; i += chunk){
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
	}
	return (typeof btoa === 'function') ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

// 收全部同源 @font-face(带真实字体文件 URL、非 data: 的),fetch+校验+base64 内联。导出便于单测。
export async function buildScreenshotFontEmbedCSS(){
	if(_screenshotFontCssPromise){ return _screenshotFontCssPromise; }
	_screenshotFontCssPromise = (async ()=>{
		if(typeof document === 'undefined'){ return ''; }
		const faces = [];
		const seen = new Set();
		const sheets = Array.from(document.styleSheets || []);
		for(let s = 0; s < sheets.length; s++){
			let rules;
			try{ rules = sheets[s].cssRules || sheets[s].rules; }catch(e){ continue; } // 跨域样式表读 cssRules 会抛
			if(!rules){ continue; }
			for(let r = 0; r < rules.length; r++){
				const rule = rules[r];
				if(!rule || !rule.style || rule.type !== 5){ continue; } // 5 = CSSRule.FONT_FACE_RULE
				const fam = (rule.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim();
				if(!fam || seen.has(fam)){ continue; }
				const src = rule.style.getPropertyValue('src') || '';
				const m = src.match(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/i)
					|| src.match(/url\(\s*["']?([^"')]+\.woff)["']?\s*\)/i)
					|| src.match(/url\(\s*["']?([^"')]+\.ttf)["']?\s*\)/i);
				if(!m){ continue; } // data: URI(浏览器已内联)或无文件 URL → 跳过
				// 🔴 CSS url() 相对**样式表**解析,非相对页面。umi 产物 src='./static/x.woff2'、样式表在
				// /static/umi.css → 真 URL=/static/static/x.woff2;相对页面 fetch 会拿到 SPA 兜底 index.html
				// (200 但 HTML)→ 字体损坏。new URL(raw, sheet.href) 与浏览器 @font-face 同解。
				let resolved = m[1];
				try{ resolved = new URL(m[1], sheets[s].href || document.baseURI).href; }catch(e){ /* 保底用原值 */ }
				seen.add(fam);
				faces.push({ fam, url: resolved });
			}
		}
		const parts = [];
		let total = 0;
		for(let i = 0; i < faces.length; i++){
			const fam = faces[i].fam;
			const url = faces[i].url;
			try{
				const res = await fetch(url);
				if(!res || !res.ok){ continue; }
				const buf = await res.arrayBuffer();
				if(!buf || buf.byteLength === 0 || buf.byteLength > MAX_EMBED_FONT_BYTES){ continue; } // 挡空/大字体
				if(total + buf.byteLength > MAX_TOTAL_EMBED_BYTES){ continue; } // 总量封顶(防病态多字体撑爆 SVG)
				// 只收真字体:woff2='wOF2'、woff='wOFF'、ttf=0x00010000/'true'、otf='OTTO'。
				// 关键副作用防线:SPA 兜底 index.html 首字节 '<'(0x3C)在此被挡,绝不把 HTML 当字体内嵌。
				const h = new Uint8Array(buf);
				const magic = String.fromCharCode(h[0], h[1], h[2], h[3]);
				const isFont = magic === 'wOF2' || magic === 'wOFF' || magic === 'true' || magic === 'OTTO'
					|| (h[0] === 0x00 && h[1] === 0x01 && h[2] === 0x00 && h[3] === 0x00);
				if(!isFont){ continue; }
				const b64 = arrayBufferToBase64(buf);
				const fmt = /\.woff2$/i.test(url) ? 'woff2' : (/\.woff$/i.test(url) ? 'woff' : 'truetype');
				const mime = fmt === 'truetype' ? 'font/ttf' : ('font/' + fmt);
				parts.push(`@font-face{font-family:'${fam}';src:url(data:${mime};base64,${b64}) format('${fmt}');font-weight:normal;font-style:normal;}`);
				total += buf.byteLength;
			}catch(e){ /* 单个字体失败:跳过,不阻断其它 */ }
		}
		return parts.join('\n');
	})();
	return _screenshotFontCssPromise;
}

function withCaptureLock(fn){
	const run = captureLock.then(()=>fn());
	// 锁只用 timeout「放行队列」,不弃跑任务本身(命盘图捕获 audit 修的同款语义)。
	captureLock = Promise.race([
		run.catch(()=>{}),
		new Promise((resolve)=>setTimeout(resolve, CAPTURE_TIMEOUT_MS)),
	]);
	return run;
}

// 当前技法三栏 = 「可见且面积最大」的激活面板。
// 🔴 旧实现取顶层 tabs 的**首个**激活面板 → 病根:模块路由切换后,旧模块面板常仍带
// `ant-tabs-tabpane-active` 类却塌成 0×0(隐藏未卸载),querySelector 先命中它 → 尺寸守卫失败
// → 整体回退 #root(整页含顶部导航条)→ 用户所见「很多技法只截到顶部菜单栏、不是技法本身」。
// 改:在**全部**激活面板中挑真正可见(≥MIN_TARGET_SIZE)且面积最大者——自然是当前模块三栏,
// 天然排除 0 尺寸的陈旧/隐藏面板与更小的嵌套子面板。导出为纯函数便于单测。
export function findActiveTechniquePane(){
	if(typeof document === 'undefined'){
		return null;
	}
	const panes = Array.from(document.querySelectorAll('.ant-tabs-tabpane-active'));
	let best = null;
	let bestArea = 0;
	for(let i = 0; i < panes.length; i++){
		const pane = panes[i];
		const w = pane.offsetWidth || 0;
		const h = pane.offsetHeight || 0;
		if(w >= MIN_TARGET_SIZE && h >= MIN_TARGET_SIZE){
			const area = w * h;
			if(area > bestArea){ bestArea = area; best = pane; }
		}
	}
	return best;
}

export function resolveCaptureTarget(){
	const pane = findActiveTechniquePane();
	if(pane){
		return pane;
	}
	if(typeof document === 'undefined'){
		return null;
	}
	const root = document.getElementById('root') || document.body;
	if(root && root.offsetWidth >= MIN_TARGET_SIZE && root.offsetHeight >= MIN_TARGET_SIZE){
		return root;
	}
	return null;
}

// [WP-5.4] WebGL 引擎自渲染帧通道:html-to-image 永远拿不到 WebGL framebuffer(守卫②),
// 但引擎自己「render 后同步 toDataURL」是可靠的。3D 组件挂载时注册 provider(返回
// { dataUrl(PNG), width, height } 或 null),截图命中 WebGL 守卫时先问 provider,全空才降级放弃。
// 栈式多实例:后挂载者优先(尾→头取第一个非空);反注册用返回的函数,unmount 必调防僵尸。
const webglFrameProviders = [];
export function registerWebglFrameProvider(fn){
	if(typeof fn !== 'function'){
		return ()=>{};
	}
	webglFrameProviders.push(fn);
	return ()=>{
		const i = webglFrameProviders.indexOf(fn);
		if(i >= 0){ webglFrameProviders.splice(i, 1); }
	};
}
export function captureWebglEngineFrame(){
	for(let i = webglFrameProviders.length - 1; i >= 0; i -= 1){
		try{
			const frame = webglFrameProviders[i]();
			if(frame && frame.dataUrl && `${frame.dataUrl}`.length >= 2000){
				return frame;
			}
		}catch(e){ /* 单 provider 失败不拖累其余 */ }
	}
	return null;
}

// WebGL 探测(守卫②)。导出为纯函数便于单测。
export function containsWebglCanvas(target){
	if(!target || typeof target.querySelectorAll !== 'function'){
		return false;
	}
	const canvases = Array.from(target.querySelectorAll('canvas'));
	return canvases.some((c)=>{
		try{
			if(c.getAttribute && (c.getAttribute('data-engine') || '').toLowerCase().includes('three')){
				return true;
			}
			if(!(c.width > 0 && c.height > 0)){
				return false;
			}
			// 已持 webgl/webgl2 上下文的 canvas,取 '2d' 恒返 null(规范行为,不改其上下文)。
			return c.getContext('2d') == null;
		}catch(e){
			return true; // 探测异常按最保守处理(视为不可截)
		}
	});
}

// 墨迹守卫轻量副本(阈值/扫描步长同 aiExport.canvasHasInk;因 import 方向为 aiExport→本文件,不能反向引)。
export function screenshotCanvasHasInk(canvas){
	try{
		if(!canvas || !canvas.width || !canvas.height){ return false; }
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if(!ctx){ return false; }
		const step = 64;
		const maxScan = Math.min(canvas.height, 4000);
		for(let y = 0; y < maxScan; y += step){
			const h = Math.min(step, maxScan - y);
			const data = ctx.getImageData(0, y, canvas.width, h).data;
			for(let i = 0; i < data.length; i += 4){
				if(data[i + 3] > 8 && (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244)){
					return true;
				}
			}
		}
		return false;
	}catch(e){
		return false;
	}
}

// 尺寸守卫①:按目标 CSS 尺寸挑像素倍率,保证 max(w,h)×ratio ≤ MAX_EDGE;超大页自动掉到 1 乃至更低。
export function pickPixelRatio(cssWidth, cssHeight, maxEdge = MAX_EDGE){
	const longEdge = Math.max(Number(cssWidth) || 0, Number(cssHeight) || 0);
	if(!(longEdge > 0)){
		return 1;
	}
	if(longEdge * 2 <= maxEdge){
		return 2;
	}
	if(longEdge <= maxEdge){
		return 1;
	}
	// 页面本身超过上限:进一步降采样(仍出图,清晰度换完整性)。
	return Math.max(0.25, maxEdge / longEdge);
}

function currentBackgroundColor(){
	try{
		const bg = window.getComputedStyle(document.body).backgroundColor;
		if(bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'){
			return bg;
		}
	}catch(e){ /* fallthrough */ }
	return '#ffffff';
}

// 主入口:成功 → { dataUrl(JPEG), width, height(设备px) };任何失败/降级 → null(带 reason 便于 toast)。
// options.target 可显式传容器(测试/特殊面);默认 resolveCaptureTarget()。
export async function capturePageScreenshot(options = {}){
	if(typeof window === 'undefined' || typeof document === 'undefined'){
		return null;
	}
	return withCaptureLock(async ()=>{
		try{
			const target = options.target || resolveCaptureTarget();
			if(!target){
				return null;
			}
			if(containsWebglCanvas(target)){
				// [WP-5.4] 先问引擎帧 provider(3D 组件在场即注册);拿到=真帧,拿不到才降级放弃。
				const engineFrame = captureWebglEngineFrame();
				if(engineFrame){
					return { dataUrl: engineFrame.dataUrl, width: engineFrame.width || 0, height: engineFrame.height || 0, engineFrame: true };
				}
				return { degraded: true, reason: 'webgl', dataUrl: '' };
			}
			const htiMod = await import('html-to-image');
			const toCanvas = htiMod.toCanvas || (htiMod.default && htiMod.default.toCanvas);
			if(!toCanvas){
				return null;
			}
			const cssW = target.offsetWidth || 0;
			const cssH = target.offsetHeight || 0;
			if(cssW < MIN_TARGET_SIZE || cssH < MIN_TARGET_SIZE){
				return null;
			}
			const pixelRatio = pickPixelRatio(cssW, cssH);
			// 符号字体内嵌:预置只含同源小字体的 fontEmbedCSS(base64 内联)。既避开 html-to-image
			// 「全量扫所有样式表 @font-face」的 WKWebView 老坑(故不嵌 CJK 大字体,中文/拉丁走系统字体渲染),
			// 又让符号字体的「字母→glyph」在截图里成真符号(否则回退裸字母 A/B/C/D…)。
			// 取不到(异常/无匹配)→ 退回 skipFonts:true(不 hang,退化为裸字母但绝不阻断导出)。
			let embedFontCss = '';
			try{ embedFontCss = await buildScreenshotFontEmbedCSS(); }catch(e){ embedFontCss = ''; }
			const fontOpts = embedFontCss ? { fontEmbedCSS: embedFontCss } : { skipFonts: true };
			const canvas = await toCanvas(target, {
				pixelRatio,
				backgroundColor: currentBackgroundColor(),
				cacheBust: true,
				...fontOpts,
			});
			if(!canvas || !canvas.width || !canvas.height){
				return null;
			}
			if(!screenshotCanvasHasInk(canvas)){
				return null;
			}
			const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
			if(!dataUrl || dataUrl.length < 2000){
				return null;
			}
			return { dataUrl, width: canvas.width, height: canvas.height };
		}catch(e){
			try{ console.warn('[pageScreenshot] 截图失败(导出继续,不附图):', e && e.message); }catch(_){ /* noop */ }
			return null;
		}
	});
}

// 导出侧便捷封装:开关关/降级/失败一律返 null;degraded 时返 null 但把原因回给调用方 toast。
export async function capturePageScreenshotForExport(options = {}){
	const shot = await capturePageScreenshot(options);
	if(!shot){
		return { shot: null, note: '' };
	}
	if(shot.degraded){
		return { shot: null, note: shot.reason === 'webgl' ? '当前页面含 3D 实时画面,截图不支持,已略过附图。' : '' };
	}
	if(shot.engineFrame){
		return { shot, note: '已附 3D 视图当前帧(文字面板不含在内)。' };
	}
	return { shot, note: '' };
}
