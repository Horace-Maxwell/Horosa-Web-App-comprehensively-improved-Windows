// labelCrop.js —— 天文馆名牌纹理的裁剪版面(纯函数,不碰 Babylon / DOM)。
// 名牌原先每张都建整幅纹理(256x128 逻辑像素 × 超采样倍数;Retina 下 1024x512、带 mip 约 2.7MB 显存),
// 字只占中间一小块:三百多个星官名首次打开要同步建近一秒、显存近 1GB。这里按字的墨迹外框算出
// 「整幅纹理里真正要留的那一块」,牌面取原牌面的同一块子矩形 —— 屏上位置 / 大小 / 像素密度逐一不变。

const ALIGN = 16;   // 裁剪原点对齐 16 像素:mip 0–4 的采样网格与整幅纹理一致(名牌常被缩小到 mip 2–3 显示)

function pow2Ceil(n){
	let v = 1;
	while(v < n){ v *= 2; }
	return v;
}

// 一维:在 [0, full] 里找对齐到 ALIGN 的原点 + 2 的幂长度,盖住 [lo, hi];盖不住或不省就整幅。
function cropAxis(lo, hi, full){
	const a = Math.max(0, Math.min(full, lo));
	const b = Math.max(0, Math.min(full, hi));
	if(!(b > a)){ return { start: 0, size: full }; }
	let size = pow2Ceil(b - a);
	if(size >= full){ return { start: 0, size: full }; }
	let start = Math.floor(a / ALIGN) * ALIGN;
	while(start + size < b){
		size *= 2;
		if(size >= full){ return { start: 0, size: full }; }
	}
	if(start + size > full){ start = full - size; }
	return { start, size };
}

// metrics = { width, asc, desc, left, right }(measureText 的宽与 actualBoundingBox*);
// tx / ty = 整幅纹理坐标里的落笔点(左对齐、alphabetic 基线);lineWidth = 描边粗细。
// 返回 { rect:{x,y,w,h}, need:{x0,y0,x1,y1} };量不到墨迹外框 → null(调用方走整幅 = 旧行为)。
export function labelCropRect({ texW, texH, tx, ty, metrics, lineWidth }){
	const m = metrics || {};
	const nums = [m.width, m.asc, m.desc, m.left, m.right, tx, ty, texW, texH];
	if(!nums.every((v)=>Number.isFinite(v))){ return null; }
	if(!(texW > 0) || !(texH > 0)){ return null; }
	const stroke = Math.ceil((Number.isFinite(lineWidth) ? lineWidth : 0) / 2) + 1;   // 描边向外伸半个线宽 + 抗锯齿 1 像素
	const need = {
		x0: tx - Math.max(0, m.left) - stroke,
		x1: tx + Math.max(m.width, m.right) + stroke,
		y0: ty - Math.max(0, m.asc) - stroke,
		y1: ty + Math.max(0, m.desc) + stroke,
	};
	const slack = 6;   // 余量:简繁换字后墨迹外框差一两个像素不必重建纹理
	const ax = cropAxis(need.x0 - slack, need.x1 + slack, texW);
	const ay = cropAxis(need.y0 - slack, need.y1 + slack, texH);
	return { rect: { x: ax.start, y: ay.start, w: ax.size, h: ay.size }, need };
}

// 当前裁剪块是否还盖得住这次要画的墨迹外框(盖不住 = 换字后变宽,要重建纹理)。
// 外框伸出整幅纹理的部分本来就画不出来(旧行为同样被纹理边界裁掉),按整幅夹住再比。
export function labelRectCovers(rect, need, texW, texH){
	if(!rect || !need){ return false; }
	const x0 = Math.max(0, need.x0);
	const y0 = Math.max(0, need.y0);
	const x1 = Math.min(texW, need.x1);
	const y1 = Math.min(texH, need.y1);
	return rect.x <= x0 && rect.y <= y0 && rect.x + rect.w >= x1 && rect.y + rect.h >= y1;
}

// 牌面顶点改到裁剪块对应的子矩形:positions 是整幅牌面(宽 planeW、高 planeH、以原点为中心)的顶点数组,
// 按各顶点所在的角改写 —— 不依赖顶点顺序。画布 y 向下、牌面 y 向上。
export function labelPlanePositions(basePositions, rect, texW, texH, planeW, planeH){
	const xl = (rect.x / texW - 0.5) * planeW;
	const xr = ((rect.x + rect.w) / texW - 0.5) * planeW;
	const yt = (0.5 - rect.y / texH) * planeH;
	const yb = (0.5 - (rect.y + rect.h) / texH) * planeH;
	const out = new Array(basePositions.length);
	for(let i = 0; i < basePositions.length; i += 3){
		out[i] = basePositions[i] < 0 ? xl : xr;
		out[i + 1] = basePositions[i + 1] < 0 ? yb : yt;
		out[i + 2] = basePositions[i + 2];
	}
	return out;
}

export function isFullLabelRect(rect, texW, texH){
	return !!rect && rect.x === 0 && rect.y === 0 && rect.w === texW && rect.h === texH;
}
