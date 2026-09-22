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


// kill-switch:与 legacyWebkitCompat 同约定,用户端 devtools 一行即可全链退回原行为。
const KILL_KEY = 'horosa.compat.alignZoom';

function killed(){
	try{
		return window.localStorage.getItem(KILL_KEY) === '0';
	}catch(e){ return false; }
}

// 声明缩放 = 文档根上**此刻真实挂着**的 inline zoom;缺席(空串)= 1。这是运行期「现在几档」的唯一真值。
//
// 🔴 此前 inline 缺席时回落 shellZoom
// (URL query 优先)。但 query 只是壳的**启动传输层**:⌘± 运行时换档不改 URL;而壳换到 100% 时恰恰把
// inline zoom 清成空串 ⇒ 这里读回**启动旧档**(真机:0.8 档启动 → 调回 100%,declared 仍报 0.8)。
// 整个缩放域随之集体用旧档:
//   · getEffectiveScale 按旧声明值命中启动时的缓存 → dom-align 补偿除数 0.8、真实缩放 1
//     → 全站浮层错位 (1/0.8−1)·(D+999)(「四分钟」下拉预测 257/375px,实测 257/368px);
//   · measureLayoutViewport 缓存键含旧声明值 → 继续返回 0.8 档时量的更大视口 → 盘面按虚大视口定尺寸、被底栏裁;
//   · visualFloorPx / visualFloorRatio 按旧档折算。
// 启动值由 global.js 在包顶第一时间镜像到 inline(≠1 才写),壳的 __HOROSA_APPLY_SHELL_ZOOM 也只写 inline,
// 所以 inline 就是活真值;query / localStorage 永不参与运行期判定(见 shellZoom.js 头注)。
// 近 1 容差与 global.js / 壳同口径(老壳 f64 累加写下的 1.0000000000000002 按 1 对待)。
export function getDeclaredZoom(){
	try{
		const inline = Number(document.documentElement.style.zoom);
		if(inline > 0 && isFinite(inline)){
			return Math.abs(inline - 1) < 0.001 ? 1 : inline;
		}
	}catch(e){ /* ignore */ }
	return 1;
}

// ── 视觉像素底线 ─────────────────────────────────────────────────────────────
// 「盘面最小 560px / 面板最少 420px」这类底线表达的是**屏幕上的可读尺寸**(物理像素意图)。壳缩放 z 下每个
// CSS px 都被画成 z 倍——旧 WebKit 与标准化 zoom 引擎在这一点上一致——所以布局域里的底线应为 视觉底线 / z;
// z=1 时与原值恒等(任何引擎缺省档零改动)。不折算的后果(2026-09-17 真机 1.8 档实报):560 CSS px = 1008 物理 px,
// 比整个工作区还高 → 盘面被 overflow:hidden 的列裁掉下缘、或长出一条多余滚动条;0.7 档则底线过小、盘面填不满列。
export function visualFloorPx(px){
	const z = getDeclaredZoom();
	if(!(z > 0) || !isFinite(z) || z === 1){ return px; }
	return Math.round(px / z);
}

// 同一法则的比例版:盘面「缩放系数」下限(如遁甲 boardScale ≥ 0.58)也是按 CSS px 口径定的可读底线,
// 壳放大档要除以 z 才是同样的视觉大小;z ≤ 1 或读不到时原样返回(不取整)。
export function visualFloorRatio(ratio){
	const z = getDeclaredZoom();
	if(!(z > 1) || !isFinite(z)){ return ratio; }
	return ratio / z;
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
// 容器实测值的合理性下限:小于它(未布局/隐藏/过渡态)才不当真值,往下回落。
// 🔴 不是 660 那种「版面最小高度」地板——容器量到多少就是多少:缩放 1.5 档、窗高 1000 时容器只有 595,
// 套 660 地板会把页根顶得比容器高 65,底部被 overflow:hidden 裁掉(真 WebKit 与 Chromium 逐位相同,FL-20260906-30)。
export const CONTAINER_HEIGHT_SANITY_MIN = 200;

export function resolveWorkspaceHeight(opts){
	const o = opts || {};
	const min = (o.min > 0) ? o.min : 0;
	const reserved = (o.reserved > 0) ? o.reserved : 0;
	const sanity = (o.containerMin > 0) ? o.containerMin : CONTAINER_HEIGHT_SANITY_MIN;
	const pick = (raw, deduct)=>{
		const v = Number(raw);
		if(!isFinite(v) || v <= 0){ return null; }
		return Math.round(v) - (deduct ? reserved : 0);
	};
	// ① 容器实测:天生布局域,页头已含;只要过合理性下限就原样采用,**不套 min 地板**
	const c = pick(o.containerHeight, false);
	if(c !== null && c >= sanity){ return c; }
	// ② ③ 视口推导的回退路径才套 min 地板(推导值偏小时宁可版面略紧)
	const h = pick(o.layoutViewportHeight, true)
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

// dom-align 用 documentElement.clientWidth / innerHeight(物理域)当「可见视口」,再与 rect 域的触发器 / 浮层比。
//   · rect 反映缩放的引擎:视口 rect 域尺寸 = 物理尺寸 → 系数 1,一字不变。
//   · rect 不反映缩放的引擎(较旧的 macOS WebKit):rect 域 = 布局域,可见视口其实只有「物理 ÷ 缩放」—— 放大档下对齐库以为
//     下方还有大片空间,靠下的下拉不翻转、直接伸出窗口底边;缩小档反过来,明明放得下却被提前翻转 / 夹紧。
//   此前靠 getEffectiveScale()===1 提前返回 1,恰好把第二类引擎整个放过。改为**直接量**:position:fixed 铺满元素的 rect 宽 ÷ clientWidth,
//   不问引擎、不问缩放值;量不到回落旧的域判定。缓存键 = 物理视口尺寸 + 声明缩放。
// 量测探针的拆除一律走这里并放进 finally:量测中途抛错也不把探针留在 body 里(每换一档留一只 = 慢性泄漏)。
function removeProbe(node){
	try{ if(node && node.parentNode){ node.parentNode.removeChild(node); } }catch(e){ /* ignore */ }
}

let _vpKey = null;
let _vpVal = 1;

export function getViewportScale(){
	if(killed()){ return 1; }
	const declared = getDeclaredZoom();
	if(declared === 1){ return 1; }
	let key = null;
	try{ key = window.innerWidth + 'x' + window.innerHeight + '@' + declared; }catch(e){ /* ignore */ }
	if(key && _vpKey === key){ return _vpVal; }
	let out = 1;
	try{
		const cw = document.documentElement.clientWidth;
		if(!document.body || !cw){ return 1; }   // 未就绪:不写缓存,下次重测
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none;contain:strict';
		document.body.appendChild(probe);
		let w = 0;
		try{ w = probe.getBoundingClientRect().width; }finally{ removeProbe(probe); }
		if(w > 0){
			const ratio = w / cw;
			out = (isFinite(ratio) && Math.abs(ratio - 1) > 0.01) ? ratio : 1;
		}else{
			out = resolveViewportScale(cw, window.innerWidth, getEffectiveScale());
		}
	}catch(e){ out = 1; }
	if(key){ _vpKey = key; _vpVal = out; }
	return out;
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

// 手写 fixed 浮层的「同域工作台」(单源):把 client(rect / 鼠标事件)域的锚点换到 fixed 元素 style.left/top 所在的布局域,
// 连同布局视口尺寸一起给出 —— 调用方此后**只在这一个域里**做「放右边放不下就放左边 / 贴边夹取」,再原样写进 style。
// 🔴 这类浮层此前的通病:锚点取 rect / clientX(视觉域),视口取 window.innerWidth(物理域),浮层宽高是 CSS 尺寸(布局域),
//    三个域混着比,再把结果当 CSS px 写回 —— 缩放档下浮层离锚点差 z 倍。z=1 时三域重合,下面每一项都是恒等,行为逐值不变。
export function fixedPopupFrame(){
	const z = getFixedScale();
	const vp = measureLayoutViewport();
	let vw = 0;
	let vh = 0;
	try{
		vw = (vp && vp.width > 0) ? vp.width : (Math.round(window.innerWidth) || 0);
		vh = (vp && vp.height > 0) ? vp.height : (Math.round(window.innerHeight) || 0);
	}catch(e){ /* 非浏览器环境:0 */ }
	return {
		scale: z,
		viewportWidth: vw,
		viewportHeight: vh,
		// client 域坐标 / 长度 → 布局域
		toFixed(px){ return clientToFixedPx(px, z); },
		// 整个 rect 一次换域(只取四边与宽高)
		rect(r){
			if(!r){ return null; }
			return {
				left: clientToFixedPx(r.left, z), right: clientToFixedPx(r.right, z),
				top: clientToFixedPx(r.top, z), bottom: clientToFixedPx(r.bottom, z),
				width: clientToFixedPx(r.width, z), height: clientToFixedPx(r.height, z),
			};
		},
	};
}

// 鼠标 / 触点事件 → 元素**本地坐标**(布局域,CSS px),不问缩放值:
// 用「元素自身的布局宽高 ÷ 它的 rect 宽高」把视觉域位移折回布局域。rect 不反映缩放的引擎比值恒 1,标准化 zoom 引擎比值 = 1/z,
// 元素带 CSS scale 变换时同样成立 —— by construction,不需要认引擎。量不到(元素无布局盒)才回落实测缩放。
// 自绘画布 / 地图 / 时间轴把鼠标位置当本地 CSS 坐标用之前,一律过这里(此前直接 clientX − rect.left,缩放档下点位与鼠标差 z 倍)。
// offsetWidth 取整、rect 宽带小数 ⇒ 不缩放时比值也会是 0.998 / 1.003 之类;吸附到 1 让 100% 档(以及 rect 不反映缩放的引擎)逐值恒等。
// 缩放档位彼此至少差 10%,1% 的吸附带不会吞掉任何真实缩放。
function snapUnit(k){
	return (isFinite(k) && Math.abs(k - 1) < 0.01) ? 1 : k;
}

export function pointerLocalRatio(el, rect){
	let kx = 0;
	let ky = 0;
	try{
		// 比值取自「有布局盒的 HTML 元素」:<svg> 根没有 offsetWidth,且系统浏览器内核对它的 rect 返回「盒子 ∪ 溢出内容」(内容略出 viewBox 就虚宽),
		// 拿它算比值会偏小。比值是所在缩放 / 变换环境的属性,向上找最近的 HTML 祖先量即可(元素自身带变换的自绘盒都是 HTML 元素,不受影响)。
		let host = el;
		while(host && !(host.offsetWidth > 0 && host.offsetHeight > 0)){ host = host.parentElement; }
		if(host){
			const r = (host === el && rect) ? rect : host.getBoundingClientRect();
			if(r.width > 0){ kx = snapUnit(host.offsetWidth / r.width); }
			if(r.height > 0){ ky = snapUnit(host.offsetHeight / r.height); }
		}
	}catch(e){ /* 走回落 */ }
	if(!(kx > 0) || !(ky > 0)){
		const z = getEffectiveScale();
		const k = (z > 0 && isFinite(z)) ? 1 / z : 1;
		if(!(kx > 0)){ kx = k; }
		if(!(ky > 0)){ ky = k; }
	}
	return { kx, ky };
}

export function pointerToLocal(evt, el, rect){
	const r = rect || el.getBoundingClientRect();
	const k = pointerLocalRatio(el, r);
	return { x: (evt.clientX - r.left) * k.kx, y: (evt.clientY - r.top) * k.ky, kx: k.kx, ky: k.ky };
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
// ── SVG getScreenCTM 的缩放一致性垫片 ────────────────────────────────────────────
// 规范:getScreenCTM() 把用户坐标映到 **client 坐标**(与 clientX / getBoundingClientRect 同域)。
// WebKit 实测(CSS zoom 挂在根元素):矩阵不反映缩放(a/d/e/f 停在布局域),而 clientX / rect 在视觉域 ——
// 1.8 档下把盘面正中的鼠标点逆变换,得到的用户坐标落在 viewBox 之外。d3.pointer / d3.zoom / d3.drag 对 SVG 节点
// 走的正是这条 CTM 逆变换,于是图上悬停读数、点选、拖拽平移、滚轮缩放锚点在缩放档下整体错位(100% 档两域重合,看不出来)。
// 修法不认引擎只认实测:量「CTM 投影出的宽」与「rect 量到的宽」之比 k —— 一致的引擎 k=1(垫片等于没装),
// 不一致的引擎 k=缩放;k≠1 时返回 S(k)·M(根缩放以视口原点为中心,六个分量同乘 k),契约恢复成「映到 client 坐标」。
// 声明缩放=1 时直接返回原矩阵:不建 DOM、不量、零成本。
const CTM_KILL_KEY = 'horosa.compat.svgCtmZoom';
let _origScreenCTM = null;
let _ctmKey = null;
let _ctmVal = 1;

function ctmKilled(){
	try{ return window.localStorage.getItem(CTM_KILL_KEY) === '0'; }catch(e){ return false; }
}

export function getSvgCtmScale(){
	if(ctmKilled()){ return 1; }
	const declared = getDeclaredZoom();
	if(declared === 1){ return 1; }
	if(_ctmKey === declared){ return _ctmVal; }
	let k = 1;
	try{
		if(!document.body){ return 1; }   // body 未就绪:不写缓存,下次重测
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('width', '100');
		svg.setAttribute('height', '100');
		svg.setAttribute('aria-hidden', 'true');
		svg.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none';
		const rect = document.createElementNS(NS, 'rect');
		rect.setAttribute('width', '100');
		rect.setAttribute('height', '100');
		svg.appendChild(rect);
		document.body.appendChild(svg);
		let m = null;
		let w = 0;
		try{
			const read = _origScreenCTM || rect.getScreenCTM;
			m = read.call(rect);
			w = rect.getBoundingClientRect().width;
		}finally{ removeProbe(svg); }
		const projected = m ? 100 * Math.sqrt(m.a * m.a + m.b * m.b) : 0;
		if(projected > 0 && w > 0){
			const r = w / projected;
			if(isFinite(r) && Math.abs(r - 1) > 0.01){ k = r; }
		}
	}catch(e){ k = 1; }
	_ctmKey = declared;
	_ctmVal = k;
	return k;
}

export function installSvgCtmShim(){
	try{
		const SvgGraphics = (typeof window !== 'undefined') ? window.SVGGraphicsElement : null;
		if(!SvgGraphics){ return false; }
		const proto = SvgGraphics.prototype;
		if(proto.__horosaCtmShim){ return true; }
		const orig = proto.getScreenCTM;
		if(typeof orig !== 'function'){ return false; }
		_origScreenCTM = orig;
		proto.getScreenCTM = function(){
			const m = orig.call(this);
			try{
				if(!m){ return m; }
				const k = getSvgCtmScale();
				if(k === 1){ return m; }
				const owner = this.ownerSVGElement || this;
				if(!owner || typeof owner.createSVGMatrix !== 'function'){ return m; }
				return owner.createSVGMatrix().scale(k).multiply(m);
			}catch(e){ return m; }
		};
		proto.__horosaCtmShim = true;
		return true;
	}catch(e){ return false; }
}

// ── MouseEvent.offsetX / offsetY 的缩放一致性垫片 ──────────────────────────────────
// 规范:offsetX/Y = 事件点相对**目标元素内边距边**的坐标,单位是 CSS px(布局域)。系统浏览器内核实测(CSS zoom 挂根元素):
// 报的是视觉域(1.8 档、400×200 的盒子正中报 (360,180) 而不是 (200,100))。图表库(echarts/zrender)与 3D 引擎的惰性拾取都把它当
// 画布本地坐标用 ⇒ 缩放档下悬停读数 / 点选偏 z 倍。修法同 SVG 矩阵垫片:量「探针盒右下角的 offsetX ÷ 盒宽」得比值 k,
// 一致的内核 k=1(等于没装);k≠1 时读数 ÷ k。声明缩放 = 1 直接走原 getter:不量、不建 DOM。回退阀 horosa.compat.offsetXYZoom='0'。
const OFFSET_KILL_KEY = 'horosa.compat.offsetXYZoom';
let _origOffsetX = null;
let _origOffsetY = null;
let _offKey = null;
let _offVal = 1;

function offsetKilled(){
	try{ return window.localStorage.getItem(OFFSET_KILL_KEY) === '0'; }catch(e){ return false; }
}

export function getOffsetDomainScale(){
	if(offsetKilled() || !_origOffsetX){ return 1; }
	const declared = getDeclaredZoom();
	if(declared === 1){ return 1; }
	if(_offKey === declared){ return _offVal; }
	let k = 1;
	try{
		if(!document.body){ return 1; }   // body 未就绪:不写缓存,下次重测
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none;contain:strict';
		document.body.appendChild(probe);
		let ox = 0;
		try{
			const r = probe.getBoundingClientRect();
			// 自定义事件名:不触发任何业务监听(捕获阶段的 mousemove / click 全局监听不会被探针惊动)
			const ev = new MouseEvent('horosaoffsetprobe', { bubbles: false, cancelable: false, clientX: r.left + r.width, clientY: r.top + r.height, view: window });
			probe.dispatchEvent(ev);
			ox = Number(_origOffsetX.call(ev));
		}finally{ removeProbe(probe); }
		if(ox > 0){
			const ratio = ox / 100;
			if(isFinite(ratio) && Math.abs(ratio - 1) > 0.01){ k = ratio; }
		}
	}catch(e){ k = 1; }
	_offKey = declared;
	_offVal = k;
	return k;
}

export function installOffsetXYShim(){
	try{
		if(typeof window === 'undefined' || typeof MouseEvent === 'undefined'){ return false; }
		const proto = MouseEvent.prototype;
		if(proto.__horosaOffsetShim){ return true; }
		const dx = Object.getOwnPropertyDescriptor(proto, 'offsetX');
		const dy = Object.getOwnPropertyDescriptor(proto, 'offsetY');
		if(!dx || !dy || typeof dx.get !== 'function' || typeof dy.get !== 'function' || dx.configurable === false){ return false; }
		_origOffsetX = dx.get;
		_origOffsetY = dy.get;
		Object.defineProperty(proto, 'offsetX', { configurable: true, enumerable: dx.enumerable, get(){ const v = _origOffsetX.call(this); const k = getOffsetDomainScale(); return k === 1 ? v : v / k; } });
		Object.defineProperty(proto, 'offsetY', { configurable: true, enumerable: dy.enumerable, get(){ const v = _origOffsetY.call(this); const k = getOffsetDomainScale(); return k === 1 ? v : v / k; } });
		Object.defineProperty(proto, '__horosaOffsetShim', { configurable: true, enumerable: false, value: true });
		return true;
	}catch(e){ return false; }
}

export function installAlignHooks(){
	try{
		if(typeof window === 'undefined'){ return; }
		window.__HOROSA_ALIGN_SCALE__ = getEffectiveScale;
		window.__HOROSA_ALIGN_VIEWPORT_SCALE__ = getViewportScale;
		installSvgCtmShim();
		installOffsetXYShim();
		// 真机诊断:devtools 一行看全四个域的现值。
		window.__HOROSA_ALIGN_DIAG__ = function(){
			let cw = null; let iw = null; let ih = null;
			try{ cw = document.documentElement.clientWidth; }catch(e){ /* ignore */ }
			try{ iw = window.innerWidth; ih = window.innerHeight; }catch(e){ /* ignore */ }
			return {
				declared: getDeclaredZoom(),
				effectiveScale: getEffectiveScale(),
				viewportScale: getViewportScale(),
				svgCtmScale: getSvgCtmScale(),
				offsetXYScale: getOffsetDomainScale(),
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
	_lvKey = null;
	_lvVal = null;
	_ctmKey = null;
	_ctmVal = 1;
	_vpKey = null;
	_vpVal = 1;
	_offKey = null;
	_offVal = 1;
}

export const ALIGN_ZOOM_KILL_KEY = KILL_KEY;
