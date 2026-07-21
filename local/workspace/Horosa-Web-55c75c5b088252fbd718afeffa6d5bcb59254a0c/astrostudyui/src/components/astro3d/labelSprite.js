// 3D 星盘标签 sprite 系统(WS-1 标签换代)。
//
// 旧路径 TextGeometry:每个标签几百~几千三角形 + typeface JSON 字形解析,数百标签
// =主要几何/内存税;且固定朝向,背面视角文字镜像不可读。
// 新路径 canvas sprite:每标签 1 个 quad(SpriteMaterial),billboard 恒面向相机、
// 遮挡关系正确;占星字形直接用 ywastrochart 网页字体画进 canvas(与 2D 盘同源字形,
// App 已有 @font-face,此处再经 FontFace API 显式确保 3D 首绘前就绪)。
// kill-switch:horosa.perf.astro3dSpriteLabels=0 → 回旧 TextGeometry 观感。
import * as THREE from 'three';
import astroFontUrl from '../../assets/ywastrochart.woff2';

let fontReadyPromise = null;

/** 确保占星字形字体在 document.fonts 就绪(幂等;失败静默=系统字体兜底,不挡渲染) */
export function ensureAstroFont(){
	if(fontReadyPromise){
		return fontReadyPromise;
	}
	try{
		if(typeof FontFace === 'undefined' || !document.fonts){
			fontReadyPromise = Promise.resolve();
			return fontReadyPromise;
		}
		const face = new FontFace('ywastrochart', `url(${astroFontUrl})`);
		fontReadyPromise = face.load().then((loaded)=>{
			document.fonts.add(loaded);
		}).catch(()=>{ /* 字体加载失败:canvas 落系统字体,字形显示为码点兜底 */ });
	}catch(e){
		fontReadyPromise = Promise.resolve();
	}
	return fontReadyPromise;
}

// 模块副作用:chunk 加载即开始载字体(用户从导航到出盘有数秒窗口,届时基本就绪;
// init() 内还会再保险调一次并在就绪后补帧)
ensureAstroFont();

// 深色行星色(海王深蓝/冥王暗紫等)在黑底不可读——HSL 亮度抬升到下限,色相不变。
// [G1] export:主限天球实体点改「白字烘焙+material 乘性染色」后,染色端也要同一套抬亮(纯加法导出)。
export function liftLuma(hexColor, minLuma){
	if(!minLuma || minLuma <= 0){
		return hexColor;
	}
	const n = parseInt(hexColor.slice(1), 16);
	let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
	let hDeg = 0, s = 0, l = (mx + mn) / 2;
	if(mx !== mn){
		const d = mx - mn;
		s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
		if(mx === r){ hDeg = ((g - b) / d + (g < b ? 6 : 0)); }
		else if(mx === g){ hDeg = (b - r) / d + 2; }
		else { hDeg = (r - g) / d + 4; }
		hDeg /= 6;
	}
	if(l >= minLuma){
		return hexColor;
	}
	l = minLuma;
	const hue2rgb = (p, q, t)=>{
		if(t < 0) t += 1;
		if(t > 1) t -= 1;
		if(t < 1 / 6) return p + (q - p) * 6 * t;
		if(t < 1 / 2) return q;
		if(t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	r = Math.round(hue2rgb(p, q, hDeg + 1 / 3) * 255);
	g = Math.round(hue2rgb(p, q, hDeg) * 255);
	b = Math.round(hue2rgb(p, q, hDeg - 1 / 3) * 255);
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * 生成文本 sprite。
 * @param {string} text
 * @param {object} opt { worldSize:世界高度(对齐旧 TextGeometry 的 size 观感),
 *                       color:'#rrggbb'|number, fontFamily, weight,
 *                       minLuma:0-1 亮度下限(深色符号黑底可读;0/缺省=原色零回归),
 *                       glow:true=同色柔光晕两遍绘制(自发光观感,黑底醒目) }
 */
export function makeTextSprite(text, opt = {}){
	const worldSize = opt.worldSize || 5;
	const fontFamily = opt.fontFamily || "-apple-system, 'PingFang SC', sans-serif";
	const weight = opt.weight || 'normal';
	let color = opt.color !== undefined ? opt.color : '#ffffff';
	if(typeof color === 'number'){
		color = `#${color.toString(16).padStart(6, '0')}`;
	}
	color = liftLuma(color, opt.minLuma);

	// 高分辨率画布(×8 过采样,远景缩小后仍锐利;上限防超大文本爆显存)
	let px = 128; // 64 时大 worldSize 拉伸发糊(用户实测反馈)
	let pad = opt.glow ? Math.ceil(px * 0.24) : 4; // 光晕要出血位,防裁边
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	ctx.font = `${weight} ${px}px ${fontFamily}`;
	let metrics = ctx.measureText(text);
	// 🔴 画布宽须兜住【实际墨迹包围盒】,而非 advance width——ywastrochart 部分字形(如 'e'=狮子)
	//   advance≈0 却墨迹居中很宽(overflow 数十 px),只按 metrics.width 定宽会把字形裁成一条竖线
	//   (用户实测「狮子座 glyph 被挤掉」)。取 advance 与 (inkL+inkR) 较大者兜住全部墨迹。
	const inkOf = (m)=>{
		const l = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
		const r = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : (m.width || 0);
		return { l, r, w: Math.max(m.width || 0, l + r) };
	};
	let ink = inkOf(metrics);
	// fit-to-width:长文本超画布上限曾被硬裁(播放大字卡尾巴被截,用户实测)——
	// 按比例缩字号重测,保证整句完整;sprite 世界尺寸由 worldSize 控制,观感不变。
	if(Math.ceil(ink.w) + pad * 2 > 2048){
		px = Math.max(32, Math.floor(px * (2048 - pad * 2) / ink.w));
		pad = opt.glow ? Math.ceil(px * 0.24) : 4;
		ctx.font = `${weight} ${px}px ${fontFamily}`;
		metrics = ctx.measureText(text);
		ink = inkOf(metrics);
	}
	// 绘制原点右移:令最左墨迹(−inkL)恰落在 pad 处,右侧墨迹亦在画布内 → 居中/溢出型字形完整不裁。
	const drawX = pad + Math.max(0, ink.l);
	const w = Math.min(2048, Math.ceil(ink.w) + pad * 2);
	const h = Math.ceil(px * 1.3) + (opt.glow ? pad : 0);
	canvas.width = w;
	canvas.height = h;
	// 尺寸设置会重置 ctx 状态,重设字体
	const ctx2 = canvas.getContext('2d');
	ctx2.font = `${weight} ${px}px ${fontFamily}`;
	ctx2.textBaseline = 'top';
	ctx2.fillStyle = color;
	if(opt.glow){
		// 一遍收敛光晕打底 + 双遍无阴影锐利本体收笔:发光但不糊(用户实测调优)
		ctx2.shadowColor = color;
		ctx2.shadowBlur = px * 0.18;
		ctx2.fillText(text, drawX, px * 0.1 + pad * 0.4);
		ctx2.shadowBlur = 0;
		ctx2.fillText(text, drawX, px * 0.1 + pad * 0.4);
		ctx2.fillText(text, drawX, px * 0.1 + pad * 0.4);
	}else{
		ctx2.fillText(text, drawX, px * 0.1);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
	material.mtype = 'TextSpriteMesh';   // disposeMesh 的 traverse 按 mtype 归类清理
	const sprite = new THREE.Sprite(material);
	// 世界尺寸:高=worldSize,宽按画布纵横比;对齐旧 TextGeometry size 的观感
	sprite.scale.set(worldSize * (w / h), worldSize, 1);
	return sprite;
}

// 光点纹理缓存(同色同参共享一张 canvas 纹理,数百恒星零重复分配)
const glowTexCache = new Map();

function getGlowTexture(colorHex, coreRatio){
	const key = `${colorHex}|${coreRatio}`;
	if(glowTexCache.has(key)){
		return glowTexCache.get(key);
	}
	const sz = 128;
	const canvas = document.createElement('canvas');
	canvas.width = sz;
	canvas.height = sz;
	const ctx = canvas.getContext('2d');
	const g = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
	// 中心近白热核 → 主色 → 全透明边缘(加色混合下=发光观感)
	g.addColorStop(0, '#ffffff');
	g.addColorStop(Math.min(0.9, Math.max(0.05, coreRatio)), colorHex);
	g.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, sz, sz);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	glowTexCache.set(key, texture);
	return texture;
}

/**
 * 圈选环 sprite(透明中心+发光色环,billboard 恒面向相机)——主限天球迫星/本体星
 * 的「圈住」标记(圈而不遮,星体本身仍可见)。
 */
export function makeRingSprite(color, worldSize = 9, thickness = 0.14){
	let colorHex = color !== undefined && color !== null ? color : '#ffffff';
	if(typeof colorHex === 'number'){
		colorHex = `#${colorHex.toString(16).padStart(6, '0')}`;
	}
	const sz = 128;
	const canvas = document.createElement('canvas');
	canvas.width = sz;
	canvas.height = sz;
	const ctx = canvas.getContext('2d');
	ctx.strokeStyle = colorHex;
	ctx.lineWidth = sz * thickness;
	ctx.shadowColor = colorHex;
	ctx.shadowBlur = sz * 0.09;
	ctx.beginPath();
	ctx.arc(sz / 2, sz / 2, sz * (0.5 - thickness) - 2, 0, Math.PI * 2);
	ctx.stroke();
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
	material.mtype = 'TextSpriteMesh';
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(worldSize, worldSize, 1);
	return sprite;
}

/**
 * 程序化「恒星光点/光晕」sprite(radial 渐变+加色混合=发光观感)。
 * 替代 3D 模型缺失时的 TextGeometry 文字回退(远端模型源已下线、包内无 glb 的常态下,
 * 恒星曾满天渲染成黄色立体字——WS-1 星空美化的核心置换件)。
 * @param {string|number} color 主色
 * @param {number} worldSize   sprite 世界直径
 * @param {number} coreRatio   热核占比(0-1,小=锐利星点,大=柔光晕)
 */
export function makeStarSprite(color, worldSize = 4, coreRatio = 0.25){
	let colorHex = color !== undefined && color !== null ? color : '#fff4d8';
	if(typeof colorHex === 'number'){
		colorHex = `#${colorHex.toString(16).padStart(6, '0')}`;
	}
	const material = new THREE.SpriteMaterial({
		map: getGlowTexture(colorHex, coreRatio),
		transparent: true,
		depthWrite: false,               // 光晕不写深度,防加色片互相裁切
		blending: THREE.AdditiveBlending,
	});
	material.mtype = 'StarSpriteMesh';   // 星点/光晕类(与文字 sprite 分型:运行时改「文本颜色」只染文字)
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(worldSize, worldSize, 1);
	return sprite;
}
