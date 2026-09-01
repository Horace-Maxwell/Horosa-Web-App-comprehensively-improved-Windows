// 缩放域单一真值源(2026-08-24 macOS Tahoe 全站浮层错位根治)。
//
// ── 病理 ────────────────────────────────────────────────────────────────
// 桌面壳的缩放走 `documentElement.style.zoom`(main.rs 注入 + global.js 镜像;原生
// pageZoom 被强制 1.0)。CSS zoom 下页面里同时存在两个坐标域:
//   · rect 域 —— getBoundingClientRect() 返回值,**已被 zoom 缩放**
//   · CSS 域 —— style.left/top 写入值,**未被缩放**
// antd 浮层定位库 dom-align@1.12.4 的 setLeftTop() 把 rect 域算出的位移量直接写进
// CSS 域(两处混域)。闭式解:
//     Δ = (z−1)·(D−C) + z·(preset − floor(preset·z)),  preset = −999
// 前项随距离线性放大,后项是来自库内 -999px 探针的常数项(floor 来自 getClientPosition
// 的 `x = Math.floor(box.left)`)。z=1 时两项**同时**归零 ⇒ 默认档与浏览器完全正常。
// 实测 z=0.8、目标 rect 480px 处 ⇒ Δ = −255.2px,与真机截图偏移量吻合。
// 补偿后仍余 floor 取整残差,恒 < 1 CSS px(亚像素,肉眼不可见)。
//
// ── 为何用「实测」而非「声明值」 ─────────────────────────────────────────
// 旧版 WKWebView 很可能压根不生效 html{zoom}(缩放功能形同虚设),macOS 26 起才真正
// 生效——"缩放突然可用"与"浮层突然错位"是同一件事。若按声明值补偿,在不生效的引擎上
// 会补出反向错位。这里改为往页面塞一个已知宽度的探针实测「引擎到底缩放了没有」:
// 不生效 → 实测 1 → 全链静默(老机器逐字节不变);生效 → 实测真值 → 精确补偿。
// 无需 UA 嗅探,无需考据 WebKit 版本。
//
// ⚠️ 域判定的既有结论(勿推翻):`documentElement.clientWidth` 与 `window.innerWidth`
// **与 rect 同域**(仓库真机结论见 models/app.js 与 shellZoom.js 注释)。所以
// dom-align 内 viewport 与 rect 的比较本就合法,getViewportScale() 默认返回 1;
// 该函数保留实测判定分支,仅为在引擎语义变化时自动兜住,不主动制造换算。

import { getShellZoom } from './shellZoom';

// kill-switch:与 legacyWebkitCompat 同约定,用户端 devtools 一行即可全链退回原行为。
const KILL_KEY = 'horosa.compat.alignZoom';

function killed(){
	try{
		return window.localStorage.getItem(KILL_KEY) === '0';
	}catch(e){ return false; }
}

// 声明缩放:优先读 documentElement 上真实挂着的 zoom(壳注入/global.js 镜像的结果),
// 缺席时回落 shellZoom 单源(query/localStorage)。
export function getDeclaredZoom(){
	try{
		const inline = Number(document.documentElement.style.zoom);
		if(inline && inline > 0 && isFinite(inline)){ return inline; }
	}catch(e){ /* ignore */ }
	try{
		const z = getShellZoom();
		return (z && z > 0 && isFinite(z)) ? z : 1;
	}catch(e){ return 1; }
}

// 实测缓存:键=声明值(声明值变了必须重测;同一档位全生命周期只测一次)。
let _cacheKey = null;
let _cacheVal = 1;

const PROBE_WIDTH = 1000;

// 有效缩放(实测)。默认档(声明=1)直接返回 1——**不建 DOM、不触发 reflow**,零成本。
export function getEffectiveScale(){
	if(killed()){ return 1; }
	const declared = getDeclaredZoom();
	if(declared === 1){ return 1; }
	if(_cacheKey === declared){ return _cacheVal; }
	let measured = declared;
	try{
		if(!document.body){
			// body 尚未就绪:回落声明值且**不写缓存**(下次调用重试实测)。
			return declared;
		}
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:absolute;left:0;top:0;width:' + PROBE_WIDTH
			+ 'px;height:0;visibility:hidden;pointer-events:none;contain:strict';
		document.body.appendChild(probe);
		const w = probe.getBoundingClientRect().width;
		document.body.removeChild(probe);
		const ratio = w / PROBE_WIDTH;
		if(ratio > 0 && isFinite(ratio)){ measured = ratio; }
	}catch(e){ measured = declared; }
	_cacheKey = declared;
	_cacheVal = measured;
	return measured;
}

// ── 布局视口直接量(版面尺寸的唯一正确来源)────────────────────────────────
// 🔴 2026-08-27 旧机(Sequoia)死带事故的根修。
//
// 教训:上面那个 getEffectiveScale() 测的是 **rect 缩放**(浮层定位要的量),
// 却被 models/app.js 当成 **布局缩放**(版面尺寸要的量)去除 clientHeight。
// 这两个量在 Chromium 与新 WebKit 上恰好相等,在 Sequoia 上分道扬镳:
// 那一代引擎画面缩放了、rect 却不反映 ⇒ 探针测得 1 ⇒ 没除 ⇒ 版面高度短 z 倍 ⇒ 底部死带。
// 与当初 Tahoe 浮层那个 bug 同类(域混淆),只是高了一层。
//
// 正解不是「认出是哪个引擎再分支」——那样永远漏掉下一个引擎。而是**根本不去问 z**:
// 一个 position:fixed;inset:0 的元素,其 offsetWidth/offsetHeight 就是「窗口到底给了
// 多少布局像素」,这在任何 zoom 语义下都直接成立,无需任何换算。
// 实测佐证(Chromium,物理视口 720):z=0.7/0.8/0.9/1.2/1.8 → 1029/900/800/600/400,
// 恰为 720/z;而同场景下 100vh 恒解析为 720(即只覆盖窗口的 z 倍 —— vh 在缩放下全域不可靠)。
//
// 缓存键 = 物理视口尺寸 + 声明缩放:两者任一变化都必须重测。
let _lvKey = null;
let _lvVal = null;

export function measureLayoutViewport(){
	let key = null;
	try{
		key = window.innerWidth + 'x' + window.innerHeight + '@' + getDeclaredZoom();
	}catch(e){ /* ignore */ }
	if(key && _lvKey === key && _lvVal){ return _lvVal; }
	let out = null;
	try{
		if(!document.body){ return null; }   // body 未就绪:不写缓存,下次重测
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;'
			+ 'visibility:hidden;pointer-events:none;contain:strict';
		document.body.appendChild(probe);
		const w = probe.offsetWidth;
		const h = probe.offsetHeight;
		document.body.removeChild(probe);
		// 量不到(未布局/被隐藏)时返回 null 交由调用方回落,绝不返回 0 当真值
		if(w > 0 && h > 0){ out = { width: w, height: h }; }
	}catch(e){ /* ignore */ }
	if(out && key){ _lvKey = key; _lvVal = out; }
	return out;
}

// 布局域尺寸的推荐读法:优先直接量目标容器(最准,且自动含掉页头等固定占位),
// 容器缺席时回落整窗布局视口。两条路径都不需要知道缩放值。
export function measureLayoutHeightOf(el){
	try{
		if(el && el.clientHeight > 0){ return el.clientHeight; }
	}catch(e){ /* ignore */ }
	const vp = measureLayoutViewport();
	return vp ? vp.height : null;
}

// 纯函数:工作区高度决策。抽出来是为了让「三引擎矩阵」能当真值表直接单测——
// 原先这段埋在 dva 订阅里,任何单测都碰不到,所以那类缺陷在 CI 里天然不可见。
//
// 优先级(越靠前越不依赖任何缩放假设):
//   ① 容器实测      —— 最准。它天生是布局域,且页头占位已含在内,无需减预留量。
//   ② 布局视口实测  —— 容器未挂载时用;需减页头预留量。
//   ③ 物理视口读数  —— 两种直接量法都不可用时的末级兜底。缩放≠1 时会偏小,
//                      但偏小只是版面略紧,好过拿错值铺出死带。
export function resolveWorkspaceHeight(opts){
	const o = opts || {};
	const min = (o.min > 0) ? o.min : 0;
	const reserved = (o.reserved > 0) ? o.reserved : 0;
	const pick = (raw, deduct)=>{
		const v = Number(raw);
		if(!isFinite(v) || v <= 0){ return null; }
		return Math.round(v) - (deduct ? reserved : 0);
	};
	const h = pick(o.containerHeight, false)
		|| pick(o.layoutViewportHeight, true)
		|| pick(o.physicalClientHeight, true);
	if(h === null || h === undefined){ return min; }
	return h < min ? min : h;
}

// 一次性诊断读数:闸门与「诊断中心」面板共用,真机取证一屏即可,不必再靠照片反推。
export function getZoomDiagnostics(){
	const vp = measureLayoutViewport();
	let cw = null; let ch = null; let iw = null; let ih = null;
	try{ cw = document.documentElement.clientWidth; ch = document.documentElement.clientHeight; }catch(e){ /* ignore */ }
	try{ iw = window.innerWidth; ih = window.innerHeight; }catch(e){ /* ignore */ }
	const declared = getDeclaredZoom();
	const rect = getEffectiveScale();
	// 语义自证:布局视口 ÷ 物理视口 应当 ≈ 1/declared。两者背离即说明该引擎的
	// zoom 语义与补偿式假设不符,调用方应退回不缩放而不是硬算。
	let layoutRatio = null;
	if(vp && ih){ layoutRatio = vp.height / ih; }
	const coherent = (declared === 1)
		|| (layoutRatio !== null && Math.abs(layoutRatio - 1 / declared) < 0.08);
	return {
		declared: declared,
		rectScale: rect,
		rectReflectsZoom: Math.abs(rect - declared) < 0.03,
		layoutViewport: vp,
		layoutRatio: layoutRatio,
		coherent: coherent,
		clientWidth: cw, clientHeight: ch, innerWidth: iw, innerHeight: ih,
		killed: killed(),
	};
}

// 纯函数:视口读数属哪个域。抽出来便于单测直断真值表。
//   两者同域(仓库既有结论)→ 返回 1,dom-align 的 viewport 乘 1 = 一字不变;
//   若某引擎把 clientWidth 报成布局域 → 返回 z 自动补偿。z=1 时恒为 1。
export function resolveViewportScale(clientWidth, innerWidth, scale){
	const z = (scale && scale > 0 && isFinite(scale)) ? scale : 1;
	if(z === 1){ return 1; }
	if(!clientWidth || !innerWidth){ return 1; }
	const asRect = Math.abs(clientWidth - innerWidth);
	const asLayout = Math.abs(clientWidth * z - innerWidth);
	return asRect <= asLayout ? 1 : z;
}

export function getViewportScale(){
	if(killed()){ return 1; }
	const z = getEffectiveScale();
	if(z === 1){ return 1; }
	try{
		return resolveViewportScale(document.documentElement.clientWidth, window.innerWidth, z);
	}catch(e){ return 1; }
}

// ── fixed 定位族 ──────────────────────────────────────────────────────────
// 手写浮层(d3 悬浮卡 / 状态徽标 / 各类图表提示层)清一色 `position: fixed`,把 rect 域数值
// (clientX/Y、getBoundingClientRect)直接写进 style.left/top —— 与 dom-align 同款劈叉。
//
// 这里**不复用尺寸探针的比值**,而是直测「写 style.left = N 会落到哪个 rect 位置」这个
// 映射本身:两点差分(N=0 与 N=1000),包含块原点常数自动消掉。理由:fixed 元素是否受
// root zoom 影响、以及它的包含块怎么算,WKWebView 与 Chromium 未必同语义——直测该映射
// 则对任何引擎都自证正确,不必考据。声明=1 时直接返回 1,不建 DOM。
let _fixedKey = null;
let _fixedVal = 1;

const FIXED_PROBE_OFFSET = 1000;

export function getFixedScale(){
	if(killed()){ return 1; }
	const declared = getDeclaredZoom();
	if(declared === 1){ return 1; }
	if(_fixedKey === declared){ return _fixedVal; }
	let measured = getEffectiveScale();      // 回落:尺寸实测值
	try{
		if(!document.body){ return measured; }   // body 未就绪:不写缓存,下次重测
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;'
			+ 'visibility:hidden;pointer-events:none;contain:strict';
		document.body.appendChild(probe);
		const x0 = probe.getBoundingClientRect().left;
		probe.style.left = FIXED_PROBE_OFFSET + 'px';
		const x1 = probe.getBoundingClientRect().left;
		document.body.removeChild(probe);
		const ratio = (x1 - x0) / FIXED_PROBE_OFFSET;
		if(ratio > 0 && isFinite(ratio)){ measured = ratio; }
	}catch(e){ /* 保持回落值 */ }
	_fixedKey = declared;
	_fixedVal = measured;
	return measured;
}

// 纯函数:rect 域坐标 → fixed 元素的 style.left/top 值。
export function clientToFixedPx(px, scale){
	const z = (scale && scale > 0 && isFinite(scale)) ? scale : 1;
	if(z === 1){ return px; }
	const v = Number(px);
	return isFinite(v) ? v / z : px;
}

// 手写 fixed 浮层写回时用这个(z=1 恒等,原值一字不变)。
export function clientToFixed(px){
	return clientToFixedPx(px, getFixedScale());
}

// 纯函数:client(rect)域长度 → 布局(CSS)域长度。供手写浮层写 style.left/top 时用。
export function clientToLayoutPx(px, scale){
	const z = (scale && scale > 0 && isFinite(scale)) ? scale : 1;
	if(z === 1){ return px; }
	const v = Number(px);
	return isFinite(v) ? v / z : px;
}

export function clientToLayout(px){
	return clientToLayoutPx(px, getEffectiveScale());
}

export function clientToLayoutPoint(x, y){
	const z = getEffectiveScale();
	return { x: clientToLayoutPx(x, z), y: clientToLayoutPx(y, z) };
}

// 装钩子:被打过补丁的 dom-align 在**每次对齐调用时**读这两个全局(不是模块初始化时读),
// 所以只要首个浮层打开前装好即可。钩子缺席/异常时补丁内部回落 1 = 与未打补丁完全一致。
export function installAlignHooks(){
	try{
		if(typeof window === 'undefined'){ return; }
		window.__HOROSA_ALIGN_SCALE__ = getEffectiveScale;
		window.__HOROSA_ALIGN_VIEWPORT_SCALE__ = getViewportScale;
		// 真机诊断:devtools 一行看全四个域的现值。
		window.__HOROSA_ALIGN_DIAG__ = function(){
			let cw = null; let iw = null; let ih = null;
			try{ cw = document.documentElement.clientWidth; }catch(e){ /* ignore */ }
			try{ iw = window.innerWidth; ih = window.innerHeight; }catch(e){ /* ignore */ }
			return {
				declared: getDeclaredZoom(),
				effectiveScale: getEffectiveScale(),
				viewportScale: getViewportScale(),
				clientWidth: cw, innerWidth: iw, innerHeight: ih,
				killed: killed(),
			};
		};
	}catch(e){ /* ignore */ }
}

// 测试用:清实测缓存。
export function __resetScaleCacheForTest(){
	_cacheKey = null;
	_cacheVal = 1;
	_fixedKey = null;
	_fixedVal = 1;
}

export const ALIGN_ZOOM_KILL_KEY = KILL_KEY;
