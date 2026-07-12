// 当前页面截图 · 共享单源（PDF/Word 导出文件头附图,三面共用:技法AI导出 / AI报告 / AI对话导出）。
//
// 语义 = 「用户此刻看到的技法三栏整页」:优先截**顶层导航 tabs 的激活面板**(左栏设置+中栏盘面+右栏明细),
// 兜底 #root。live 元素直截(非离屏重挂,无 visibility/getBBox 老坑;所见即所得,含暗色主题)。
//
// 铁律:**截图失败/降级恒返 null,绝不 throw、绝不阻断导出**——调用方对 null 一律「不附图继续导出」。
// 守卫(照抄 aiExport.exportPdf / reportChartCapture 实战经验,机制注释见各处):
//   ① 尺寸守卫:目标单边(CSS×pixelRatio)≤ MAX_EDGE(8000,远低于 canvas 32767 硬上限),超则自动降倍率;
//   ② WebGL 降级:html-to-image 拿不到 WebGL framebuffer(天文馆 babylonjs/3D 星盘 three.js 会截成黑/空),
//      检测到即整体放弃(返 null)——检测用 data-engine 属性 + getContext('2d') 探针(已有 webgl 上下文的
//      canvas 取 2d 恒返 null 且不改变其上下文;零上下文的裸 canvas 会被建 2d,无害);
//   ③ 墨迹守卫:全白/全空渲染不当成功(逻辑同 aiExport.canvasHasInk,因 aiExport 反向 import 本文件,
//      为避环此处持有轻量副本,阈值同款);
//   ④ 串行锁+超时:同刻只跑一张,30s 兜底放行(仿 reportChartCapture withCaptureLock 修正版语义)。

const MAX_EDGE = 8000;            // 设备px 目标单边上限(canvas 硬上限 32767,大图内存/耗时也要控)
const MIN_TARGET_SIZE = 160;      // 目标容器最小边(CSS px),小于视为没找到有效面板
const JPEG_QUALITY = 0.85;
const CAPTURE_TIMEOUT_MS = 30000;

let captureLock = Promise.resolve();

function withCaptureLock(fn){
	const run = captureLock.then(()=>fn());
	// 锁只用 timeout「放行队列」,不弃跑任务本身(reportChartCapture audit 4 修的同款语义)。
	captureLock = Promise.race([
		run.catch(()=>{}),
		new Promise((resolve)=>setTimeout(resolve, CAPTURE_TIMEOUT_MS)),
	]);
	return run;
}

// 顶层 .ant-tabs(不嵌套于另一 .ant-tabs 者)的激活面板 = 技法三栏整页容器。
function findActiveTechniquePane(){
	if(typeof document === 'undefined'){
		return null;
	}
	const allTabs = Array.from(document.querySelectorAll('.ant-tabs'));
	const topTabs = allTabs.filter((el)=>{
		const parent = el.parentElement;
		return !(parent && parent.closest && parent.closest('.ant-tabs'));
	});
	for(let i = 0; i < topTabs.length; i++){
		const pane = topTabs[i].querySelector('.ant-tabs-tabpane-active');
		if(pane && pane.offsetWidth >= MIN_TARGET_SIZE && pane.offsetHeight >= MIN_TARGET_SIZE){
			return pane;
		}
	}
	return null;
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
			const canvas = await toCanvas(target, {
				pixelRatio,
				backgroundColor: currentBackgroundColor(),
				cacheBust: true,
				skipFonts: true, // WKWebView @font-face 抓取老问题的既有规避(同 exportPdf)
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
	return { shot, note: '' };
}
