// 盘面最小字视觉下限(单源):盘面 svg 里的字在屏幕上不得小于 9 px —— 放大档是为了看清,盘面字不能反而变小。
//
// 病理:三栏工作台左右栏是固定 CSS px 宽,放大 z 倍后屏幕上也宽 z 倍,中栏的屏幕宽反而缩;按设计尺寸画、
// 再用 viewBox 等比缩小的盘(utils/svgDesignBox 的设计盒、自带固定 viewBox 的盘)跟着缩,字号同比变小
// (紫微小星 1 档 ≥ 14 px → 1.8 档 1.6 px,七政 Moira 外圈 3.6 px)。
//
// 修法(只在需要时生效,放得下时一字不变):
//   ① 每个被缩小的盘(等比 viewBox 比例 s < 1)按自己画出来的最小字号 f(外层 svg 坐标)反推最小渲染尺寸:
//      视觉字号 = f × s × z,要 ≥ 9 ⇒ s ≥ 9 / (f·z);s 不超过 1(设计尺寸以上字号不再随宽变)
//      ⇒ 最小渲染宽 / 高 = 设计下限 × min(1, 9 / (f·z))(designBoxMinRenderSize,纯函数;设计下限 = 设计盒的下限,或固定 viewBox 的尺寸)。
//   ② 中栏比它窄时,先由各页栅格把左右栏收到各自下限(侧栏宽 clamp(下限, N·视口宽, 上限),放大档本就落在下限上),
//      还差的部分由工作区横向加宽、外层横向滚动 —— 与工作区宽下限 960 同一机制(13-layout-module.less 的
//      .workspaceInner min-width 加上本模块发布的 --horosa-chart-floor-extra);等比盘在高度上不够时同理加高(--horosa-chart-floor-extra-h,
//      并经事件让工作区高度派发跟上,按 props.height 排版的页一起长高)。
//   ③ 加了量盘却没跟着变大的(装在定宽 / 定高卡里)那条轴记下来不再参与 —— 加量有上限,不会失控。
// 真内核判据 wkprobe 的 TINYTEXT 看守同一口径(盘被缩小、或放大档时,svg 字视觉 < 9 px 记红);组件标注的纯装饰刻度
// [data-tinytext-decor] 两边都不算。
import { getDeclaredZoom } from './zoomDomain';

export const CHART_TEXT_FLOOR_PX = 9;
export const CHART_TEXT_FLOOR_TOLERANCE = 0.1;   // 亚像素取整容差:视觉 8.9 以上算够(1 档七政外圈 8.92 不为 0.08 px 去动版面)
export const CHART_FLOOR_EXTRA_VAR = '--horosa-chart-floor-extra';
export const CHART_FLOOR_EXTRA_H_VAR = '--horosa-chart-floor-extra-h';
export const CHART_FLOOR_EVENT = 'horosa:chart-floor';
// HTML 字层的盘按设计宽等比缩小时(components/xq-ui/XQDesignScaleBox)外框挂的标记:值 'scaled' = 正在缩、'fit' = 放得下(不生成盒子)
export const HTML_DESIGN_BOX_ATTR = 'data-horosa-html-design-box';
// 参与「HTML 字层格盘」反推的盘:严格盘面(格里的字按格等比缩)+ 正在按设计宽等比缩的 HTML 盘
export const HTML_FLOOR_BOARD_SELECTOR = `[data-clip-strict-text],[${HTML_DESIGN_BOX_ATTR}="scaled"]`;
const EXTRA_CAP = 2400;          // 加宽 / 加高上限(布局 px):再大也不追
const MAX_TEXTS = 1500;          // 每张盘最多量这么多段字

// 纯函数:设计下限 (minW, minH)(设计盒的下限,或固定 viewBox 的尺寸)、最小字号 f(外层 svg 坐标)、档位 z
// → 盘至少要多宽 / 多高(布局 px)。等比(meet)缩放的比例 s = min(宽 / minW, 高 / minH),视觉字号 = f × s × z ≥ 地板 ⇒ s ≥ 地板 / (f·z);
// s 不超过 1:到设计尺寸以上字号不再随宽变(按设计尺寸画、不再等比缩小)。
// 只在放大档(z > 1)生效:放大是为了看清,盘面字不许因此变小;1 档及缩小档按各盘自己的设计排(版面一字不变)。
// 产品侧按整 9 px 反推(真内核判据按 9 − 容差判):迭代收敛差不到 1 px 时字号也不会落到判据线以下。
export function designBoxMinRenderSize(minW, minH, minFont, z, floorPx = CHART_TEXT_FLOOR_PX){
	const w = Number(minW);
	const h = Number(minH);
	const f = Number(minFont);
	const zz = (Number(z) > 0) ? Number(z) : 1;
	if(!(w > 0) || !(h > 0) || !(f > 0) || !(zz > 1.001)){ return { width: 0, height: 0, scale: 0 }; }
	const sReq = Math.min(1, floorPx / (f * zz));
	return { width: Math.ceil(w * sReq), height: Math.ceil(h * sReq), scale: sReq };
}

// 纯函数:不动点迭代一步(单轴)。charts = [{ need, size }…](size = 当前布局尺寸),extra = 当前已加量 → 新的加量。
// 中栏 / 盘区吃掉加量的比例 α ≤ 1 时同一公式迭代收敛到 (need − 原尺寸) / α。
export function nextFloorExtra(charts, extra){
	const e0 = Math.max(0, Number(extra) || 0);
	let e = 0;
	(charts || []).forEach((c)=>{
		if(!c || !(c.need > 0) || !(c.size > 0)){ return; }
		e = Math.max(e, c.need - (c.size - e0));
	});
	return Math.min(EXTRA_CAP, Math.max(0, Math.ceil(e)));
}

function hasDom(){
	return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement;
}

const hiddenish = (el)=>{
	try{
		const cs = getComputedStyle(el);
		if(cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0'){ return true; }
		return !!(el.closest && el.closest('[aria-hidden="true"],.ant-tabs-tabpane-hidden,details:not([open])'));
	}catch(e){ return true; }
};

// svg 字号读数换算(按档位缓存):系统浏览器内核在文档 CSS zoom 下把 svg <text> 的计算字号报成「设计字号 ÷ z」
// (font-size="20" 在 1.8 档读成 11.11px;HTML 字不受影响)—— 拿它直接算会把盘面字号低估 z 倍。
// 不认引擎只认实测:在 body 上放一段 font-size="100" 的探针字读回计算值,比例即换算系数(正常引擎恒为 1)。
let _qKey = null;
let _qVal = 1;
export function svgFontReadScale(){
	if(!hasDom() || !document.body){ return 1; }
	const key = String(document.documentElement.style.zoom || '');
	if(_qKey === key){ return _qVal; }
	let v = 1;
	try{
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('width', '10');
		svg.setAttribute('height', '10');
		svg.setAttribute('aria-hidden', 'true');
		svg.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none';
		const t = document.createElementNS(ns, 'text');
		t.setAttribute('font-size', '100');
		t.textContent = 'x';
		svg.appendChild(t);
		document.body.appendChild(svg);
		const cs = parseFloat(getComputedStyle(t).fontSize) || 100;
		document.body.removeChild(svg);
		v = (cs > 0) ? 100 / cs : 1;
		if(!(v > 0) || !isFinite(v)){ v = 1; }
	}catch(e){ v = 1; }
	_qKey = key;
	_qVal = v;
	return v;
}

// 量一张外层 svg:设计下限(设计盒写的 data-horosa-design-min,或固定 viewBox)、布局尺寸、外层坐标里的最小字号。
// 没有 viewBox / 没有字 / 非等比铺满 → null。
export function measureChartTextFloor(svg){
	if(!svg || typeof svg.getAttribute !== 'function'){ return null; }
	const vb = svg.viewBox && svg.viewBox.baseVal;
	const L = svg.clientWidth || 0;
	const H = svg.clientHeight || 0;
	if(!(vb && vb.width > 0 && vb.height > 0) || !(L > 0 && H > 0)){ return null; }
	const par = svg.getAttribute('preserveAspectRatio') || '';
	if(/none|slice/.test(par)){ return null; }   // 非等比 / 裁切铺满:字号比例不随宽单调,不参与
	const s = Math.min(L / vb.width, H / vb.height);
	let minW = vb.width;
	let minH = vb.height;
	const dm = String(svg.getAttribute('data-horosa-design-min') || '').split(',').map(Number);
	if(svg.getAttribute('data-horosa-design-box') === '1' && dm.length === 2 && dm[0] > 0 && dm[1] > 0){ minW = dm[0]; minH = dm[1]; }
	let ms = null;
	try{ ms = svg.getScreenCTM(); }catch(e){ ms = null; }
	if(!ms){ return null; }
	let msi = null;
	try{ msi = ms.inverse(); }catch(e){ return null; }
	const q = svgFontReadScale();
	let minFont = 0;
	let n = 0;
	const texts = svg.querySelectorAll('text');
	for(let i = 0; i < texts.length && n < MAX_TEXTS; i += 1){
		const t = texts[i];
		if(!(t.textContent || '').trim()){ continue; }
		if(t.closest('[data-tinytext-decor]')){ continue; }
		const r = t.getBoundingClientRect();
		if(!(r.width > 0.3 && r.height > 0.3)){ continue; }
		if(hiddenish(t)){ continue; }
		const fs = (parseFloat(getComputedStyle(t).fontSize) || 0) * q;
		if(!(fs > 0)){ continue; }
		let mt = null;
		try{ mt = t.getScreenCTM(); }catch(e){ mt = null; }
		if(!mt){ continue; }
		const rel = msi.multiply(mt);
		const k = Math.sqrt(Math.abs(rel.a * rel.d - rel.b * rel.c)) || 1;
		const f = fs * k;
		n += 1;
		if(!minFont || f < minFont){ minFont = f; }
	}
	if(!n){ return null; }
	return { minW, minH, layoutW: L, layoutH: H, scale: s, minFont };
}

// 祖先链上 transform 的等比缩放积(到 stop 为止,不含 stop):按矩阵行列式开方 ——
// 不用「屏幕宽 ÷ 布局宽」(窄字形的 offsetWidth 取整成 1,比值是噪声)
export function transformScaleUpTo(el, stop){
	let k = 1;
	for(let a = el; a && a !== stop && a !== document.documentElement; a = a.parentElement){
		let tf = 'none';
		try{ tf = getComputedStyle(a).transform; }catch(e){ tf = 'none'; }
		if(!tf || tf === 'none'){ continue; }
		const m = tf.match(/matrix(3d)?\(([^)]+)\)/);
		if(!m){ continue; }
		const v = m[2].split(',').map(Number);
		const d = m[1] ? Math.abs(v[0] * v[5] - v[1] * v[4]) : Math.abs(v[0] * v[3] - v[1] * v[2]);
		if(d > 0){ k *= Math.sqrt(d); }
	}
	return k;
}

// HTML 格盘:格里自带文字的元素,视觉字号 = 计算字号 × 祖先 transform 比例(屏幕宽 / 布局宽 / z)× z;只看被缩过的(比例 < 0.98)。
// 字已够大(≥ 地板)也照常返回读数:调用方要靠它「托住」已加的量 —— 此前够大就返回空,加量一撤盘又缩回去,
// 下一拍又要加,每 120ms 来回翻一次(盘面一闪一闪)。
export function measureHtmlBoardTextFloor(board, z){
	const zz = (Number(z) > 0) ? Number(z) : 1;
	const L = board.clientWidth || 0;
	const H = board.clientHeight || 0;
	if(!(L > 0 && H > 0)){ return null; }
	let minVis = 0;
	let scale = 1;
	let n = 0;
	const els = board.querySelectorAll('*');
	for(let i = 0; i < els.length && n < MAX_TEXTS; i += 1){
		const e = els[i];
		if(e.closest('svg,[data-tinytext-decor]')){ continue; }
		let own = '';
		for(let c = e.firstChild; c; c = c.nextSibling){ if(c.nodeType === 3){ own += c.nodeValue; } }
		if(!own.trim()){ continue; }
		const r = e.getBoundingClientRect();
		if(!(r.width > 0)){ continue; }
		const sc = transformScaleUpTo(e, board.parentElement);
		if(!(sc < 0.98)){ continue; }
		if(hiddenish(e)){ continue; }
		const fs = parseFloat(getComputedStyle(e).fontSize) || 0;
		if(!(fs > 0)){ continue; }
		n += 1;
		const vis = fs * sc * zz;
		if(!minVis || vis < minVis){ minVis = vis; scale = sc; }
	}
	if(!n || !(minVis > 0)){ return null; }
	return { layoutW: L, layoutH: H, minVis, scale };
}

let installed = false;
let extraW = 0;
let extraH = 0;
let timer = null;
let lastRun = 0;
// 加量改动后版面跟上要时间:加高经事件 → 工作区高度派发 → 页面重渲染 → 盘的观察器重量,常常跨过一个扫描间隔(120ms)。
// 改动后不到 SETTLE_MS 就判「加了量盘没跟着长 = 定死」会误判(择日内嵌的紫微盘:加高一拍还没传到盘就被判定死、加高撤回,字停在 6px)——
// 改动后先等版面跟上:非同步扫描推迟到改动后 SETTLE_MS 再算;同步扫描(换档当帧)照算但不判定死。
const SETTLE_MS = 400;
let lastApplyAt = 0;
let mo = null;
let track = new WeakMap();   // svg → { w, h, ew, eh, stuckW, stuckH }:加量后它没跟着变大(装在定宽 / 定高卡里)的那条轴不再参与

export function getChartFloorExtra(){
	return { width: extraW, height: extraH };
}

function innerHost(){
	try{ return document.querySelector('[data-horosa-workspace-inner]'); }catch(e){ return null; }
}

function applyExtra(ew, eh){
	const host = innerHost();
	if(!host){ return; }
	const hChanged = eh !== extraH;
	if(ew !== extraW || hChanged){ lastApplyAt = Date.now(); }
	extraW = ew;
	extraH = eh;
	try{
		if(ew > 0){ host.style.setProperty(CHART_FLOOR_EXTRA_VAR, ew + 'px'); }
		else{ host.style.removeProperty(CHART_FLOOR_EXTRA_VAR); }
		if(eh > 0){ host.style.setProperty(CHART_FLOOR_EXTRA_H_VAR, eh + 'px'); }
		else{ host.style.removeProperty(CHART_FLOOR_EXTRA_H_VAR); }
	}catch(err){ /* ignore */ }
	// 加高要让按 props.height 排版的页跟上:工作区高度派发(models/app.js)监听本事件重派
	if(hChanged){ try{ window.dispatchEvent(new CustomEvent(CHART_FLOOR_EVENT, { detail: { width: ew, height: eh } })); }catch(err){ /* ignore */ } }
}

// 定死判定的锚点:这张盘第一次「要加量」时的尺寸与加量;加量回落到锚点以下(换档 / 别的盘撤了量)就重新锚
function stuckAnchor(tr, w, h, ew, eh, need){
	const a = tr.anchor;
	const wants = (need.width > w + 0.5) || (need.height > h + 0.5);
	if(!a || ew < a.ew || eh < a.eh || !wants){ return { w, h, ew, eh }; }
	return a;
}

// 「定死」的现场:档位 + 宿主(父盒)尺寸。换档、或宿主尺寸变了 ≥ 16px(拖窗、侧栏收起)= 当初把它定死的盒子可能已经放开 →
// 撤掉定死标记、重新参与(只在现场真变了时撤:加量本身撑不动定死的宿主,不会因撤标记来回抖)
function stuckSiteOf(el, z){
	const p = el && el.parentElement;
	return { z, pw: (p && p.clientWidth) || 0, ph: (p && p.clientHeight) || 0 };
}
function unstickIfMoved(tr, el, z){
	if(!(tr.stuckW || tr.stuckH) || !tr.stuckAt){ return tr; }
	const now = stuckSiteOf(el, z);
	const a = tr.stuckAt;
	if(Math.abs(now.z - a.z) > 0.001 || Math.abs(now.pw - a.pw) >= 16 || Math.abs(now.ph - a.ph) >= 16){
		return { ...tr, stuckW: false, stuckH: false, stuckAt: null, anchor: null };
	}
	return tr;
}

// 扫一遍工作区里可见的盘,算出需要的加宽 / 加高量并发布。返回 { width, height }(测试用)。
export function runChartTextFloor(){
	if(!hasDom()){ return { width: 0, height: 0 }; }
	const main = document.getElementById('mainContent');
	if(!main){ return { width: 0, height: 0 }; }
	const z = getDeclaredZoom();
	// 1 档与缩小档:反推公式恒给 0(designBoxMinRenderSize 只在 z > 1 生效、HTML 格盘分支只在 z > 1 跑)——
	// 不再逐段量字(每次盘面重画都强制一遍样式 / 版面计算,纯属白耗);从放大档调回来时把残留的加量清零一次。
	if(!(z > 1.001)){
		const changed = extraW !== 0 || extraH !== 0;
		if(changed){ applyExtra(0, 0); }
		return { width: 0, height: 0, changed };
	}
	const sinceApply = Date.now() - lastApplyAt;
	if(!syncMode && sinceApply < SETTLE_MS){ deferRun(SETTLE_MS - sinceApply); return { width: extraW, height: extraH, changed: false }; }
	const canJudgeStuck = sinceApply >= SETTLE_MS;
	const ws = [];
	const hs = [];
	const svgs = main.querySelectorAll('svg');
	for(let i = 0; i < svgs.length; i += 1){
		const svg = svgs[i];
		if(svg.parentElement && svg.parentElement.closest('svg')){ continue; }
		if(!svg.getClientRects().length || hiddenish(svg)){ continue; }
		if(svg.closest('[data-tinytext-decor]')){ continue; }
		const tr = unstickIfMoved(track.get(svg) || { stuckW: false, stuckH: false }, svg, z);
		const m = measureChartTextFloor(svg);
		let need = null;
		let L = 0;
		let H = 0;
		if(m){
			need = designBoxMinRenderSize(m.minW, m.minH, m.minFont, z);
			L = m.layoutW;
			H = m.layoutH;
		}else if(tr.need && tr.z === z && svg.getAttribute('data-horosa-design-box') !== '1' && !(svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0)){
			// 设计盒放得下时会撤掉 viewBox(按像素画)—— 正是加量把它撑到了设计尺寸;此时量不到比例,沿用同一档位上次的需求,
			// 否则加量一撤、盘又缩回设计尺寸以下,来回抖
			need = tr.need;
			L = svg.clientWidth || 0;
			H = svg.clientHeight || 0;
		}
		if(!need || !(L > 0) || !(H > 0)){ continue; }
		// 从「开始要加量」那一刻(锚点)算起加了 ≥ 16px,它却几乎没跟着变大(< 累计加量的 10%)= 被别的盒子定死了:那条轴不再参与,免得越加越多。
		// 按累计、近乎不动判:栅格侧栏按百分比分走一部分加量时中栏只吃到四五成,逐步小量加再遇上取整,单步长得少于三成也正常(曾误判定死、加量撤回)
		const anchor = stuckAnchor(tr, L, H, extraW, extraH, need);
		if(canJudgeStuck && extraW >= anchor.ew + 16 && L < anchor.w + Math.max(1, 0.1 * (extraW - anchor.ew)) && need.width > L + 0.5 && !(need.height > H + 0.5)){ tr.stuckW = true; tr.stuckAt = stuckSiteOf(svg, z); }
		if(canJudgeStuck && extraH >= anchor.eh + 16 && H < anchor.h + Math.max(1, 0.1 * (extraH - anchor.eh)) && need.height > H + 0.5 && !(need.width > L + 0.5)){ tr.stuckH = true; tr.stuckAt = stuckSiteOf(svg, z); }
		track.set(svg, { ...tr, anchor, w: L, h: H, ew: extraW, eh: extraH, need, z });
		// 只给「说了算」的那条轴提需求:等比盘的比例取两轴较小者,哪条轴更紧由盘的宿主盒定(方盘自身恒正方,看不出来)——
		// 方盘被宽卡住时,加宽让它连带变高,不能再把这截高度算成「加高的功劳」去托住加高量(否则白加一截纵向滚动)。
		// 不说了算的那条轴按当前尺寸登记:保住已有的加量(另一轴放开后它可能变成说了算的),不新增。
		const par = svg.parentElement;
		const pw = (par && par.clientWidth) || L;
		const ph = (par && par.clientHeight) || H;
		const mw = m ? m.minW : (need.width || 1);
		const mh = m ? m.minH : (need.height || 1);
		const widthBinds = (pw / mw) <= (ph / mh);
		if(!tr.stuckW){ ws.push({ need: widthBinds ? need.width : Math.min(need.width, L), size: L }); }
		if(!tr.stuckH){ hs.push({ need: widthBinds ? Math.min(need.height, H) : need.height, size: H }); }
	}
	// HTML 字层的格盘(北印 / 东印 / 印占方盘这类「字挤在格里」的盘,挂 data-clip-strict-text):格里的行星块按格等比缩(transform),
	// 盘越大缩得越少 —— 同一口径按最小视觉字号反推盘要多大(缩放比例到 1 为止)
	{
		const boards = main.querySelectorAll(HTML_FLOOR_BOARD_SELECTOR);
		for(let i = 0; i < boards.length; i += 1){
			const b = boards[i];
			if(!b.getClientRects().length || hiddenish(b)){ continue; }
			const m = measureHtmlBoardTextFloor(b, z);
			if(!m){ continue; }
			const tr = unstickIfMoved(track.get(b) || { stuckW: false, stuckH: false }, b, z);
			// f ≤ 1(字已够大):需求 ≤ 当前尺寸 —— 只托住已加的量(多出来的慢慢退到字恰好 9 px 处),不新增
			const f = Math.min(CHART_TEXT_FLOOR_PX / m.minVis, 1 / m.scale);
			const need = { width: Math.ceil(m.layoutW * f), height: Math.ceil(m.layoutH * f) };
			const anchor = stuckAnchor(tr, m.layoutW, m.layoutH, extraW, extraH, need);
			if(canJudgeStuck && extraW >= anchor.ew + 16 && m.layoutW < anchor.w + Math.max(1, 0.1 * (extraW - anchor.ew))){ tr.stuckW = true; tr.stuckAt = stuckSiteOf(b, z); }
			if(canJudgeStuck && extraH >= anchor.eh + 16 && m.layoutH < anchor.h + Math.max(1, 0.1 * (extraH - anchor.eh))){ tr.stuckH = true; tr.stuckAt = stuckSiteOf(b, z); }
			track.set(b, { ...tr, anchor, w: m.layoutW, h: m.layoutH, ew: extraW, eh: extraH });
			// 同上:只给说了算的那条轴提需求(宿主盒相对盘的宽高比更紧的那条)
			// 按设计宽等比缩的 HTML 盘:比例只由栏宽定(高随宽走、向下越出由外层滚动接住)—— 恒为宽说了算
			const bp = b.parentElement;
			const widthBinds = b.getAttribute(HTML_DESIGN_BOX_ATTR) === 'scaled' || ((bp && bp.clientWidth) || m.layoutW) / m.layoutW <= ((bp && bp.clientHeight) || m.layoutH) / m.layoutH;
			if(!tr.stuckW){ ws.push({ need: widthBinds ? need.width : m.layoutW, size: m.layoutW }); }
			if(!tr.stuckH){ hs.push({ need: widthBinds ? m.layoutH : need.height, size: m.layoutH }); }
		}
	}
	const ew = nextFloorExtra(ws, extraW);
	const eh = nextFloorExtra(hs, extraH);
	const changed = Math.abs(ew - extraW) >= 1 || Math.abs(eh - extraH) >= 1;
	if(changed){ applyExtra(ew, eh); if(!syncMode){ schedule(); } }
	return { width: ew, height: eh, changed };
}

// 换档帧里同步扫一遍(工作区观察器调用):换档后第一帧加宽 / 加高量即按新档位就位,不等合帧扫描。返回加量是否变了(调用方据此再补跑观察器)
let syncMode = false;
export function runChartTextFloorNow(){
	if(timer){ clearTimeout(timer); timer = null; }
	syncMode = true;
	try{ return !!runChartTextFloor().changed; }catch(e){ return false; }finally{ syncMode = false; lastRun = Date.now(); }
}

function deferRun(ms){
	if(timer){ return; }
	timer = setTimeout(()=>{ timer = null; lastRun = Date.now(); try{ runChartTextFloor(); }catch(e){ /* 扫描失败不影响页面 */ } }, Math.max(16, ms));
}

function schedule(){
	if(timer){ return; }
	const wait = Math.max(0, 120 - (Date.now() - lastRun));
	timer = setTimeout(()=>{ timer = null; lastRun = Date.now(); try{ runChartTextFloor(); }catch(e){ /* 扫描失败不影响页面 */ } }, wait);
}

export function scheduleChartTextFloor(){
	if(hasDom()){ schedule(); }
}

// 幂等安装:盘面 svg 有变化(重画 / 写 viewBox)、窗口尺寸 / 档位变化时合帧重扫(最多每 120ms 一次)。
// 换页时被卸下的盘自然不在扫描里 → 加宽量回到 0。
export function installChartTextFloor(){
	if(!hasDom() || installed){ return ()=>{}; }
	installed = true;
	const onResize = ()=>schedule();
	window.addEventListener('resize', onResize);
	const attach = ()=>{
		const main = document.getElementById('mainContent');
		if(!main || mo || typeof MutationObserver !== 'function'){ return !!mo; }
		// 只认与盘面有关的变化:svg 里的增删改、写 viewBox、增删的节点里带 svg 或 HTML 格盘(换页 / 换页签 / 换盘式挂上新盘)、
		// HTML 盘按设计宽缩放的状态翻转(放得下 ↔ 缩放)。普通 DOM 更新不触发扫描。
		const BOARD_SEL = `svg,${HTML_FLOOR_BOARD_SELECTOR},[${HTML_DESIGN_BOX_ATTR}]`;
		const touchesSvg = (n)=>!!(n && n.nodeType === 1 && (n.nodeName === 'svg' || (n.closest && n.closest('svg')) || (n.matches && n.matches(BOARD_SEL)) || (n.querySelector && n.querySelector(BOARD_SEL))));
		mo = new MutationObserver((records)=>{
			for(let i = 0; i < records.length; i += 1){
				const r = records[i];
				const t = r.target;
				if(r.type === 'attributes' && r.attributeName === HTML_DESIGN_BOX_ATTR){ schedule(); return; }
				if(r.type === 'attributes' && r.attributeName === 'class'){
					// 只认页签面板显隐(切子页签把另一张盘露出来);其它元素的 class 变化(悬停态等)不扫
					if(t && t.classList && t.classList.contains('ant-tabs-tabpane')){ schedule(); return; }
					continue;
				}
				if(t && t.nodeType === 1 && (t.nodeName === 'svg' || (t.closest && t.closest('svg')))){ schedule(); return; }
				const added = r.addedNodes || [];
				const removed = r.removedNodes || [];
				for(let j = 0; j < added.length; j += 1){ if(touchesSvg(added[j])){ schedule(); return; } }
				for(let j = 0; j < removed.length; j += 1){ if(removed[j] && removed[j].nodeType === 1 && (removed[j].nodeName === 'svg' || (removed[j].matches && removed[j].matches(BOARD_SEL)) || (removed[j].querySelector && removed[j].querySelector(BOARD_SEL)))){ schedule(); return; } }
			}
		});
		mo.observe(main, { subtree: true, childList: true, attributes: true, attributeFilter: ['viewBox', 'class', HTML_DESIGN_BOX_ATTR] });
		schedule();
		return true;
	};
	if(!attach()){
		let tries = 0;
		const iv = setInterval(()=>{ tries += 1; if(attach() || tries > 60){ clearInterval(iv); } }, 200);
	}
	return ()=>{
		installed = false;
		window.removeEventListener('resize', onResize);
		if(mo){ try{ mo.disconnect(); }catch(e){ /* ignore */ } mo = null; }
		if(timer){ clearTimeout(timer); timer = null; }
	};
}

export function __resetChartTextFloorForTests(){
	installed = false;
	extraW = 0;
	extraH = 0;
	lastApplyAt = 0;
	_qKey = null;
	if(timer){ clearTimeout(timer); timer = null; }
	if(mo){ try{ mo.disconnect(); }catch(e){ /* ignore */ } mo = null; }
	track = new WeakMap();
}
