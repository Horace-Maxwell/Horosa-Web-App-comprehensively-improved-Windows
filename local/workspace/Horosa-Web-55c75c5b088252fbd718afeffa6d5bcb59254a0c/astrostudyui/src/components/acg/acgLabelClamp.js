// 占星地图标签收边(单源):标签芯片 / 星名按投影点居中放,投影点贴画布边(MC / IC 线落在 ±180° 附近、纬度 ±83)时
// 芯片一半落到画布外,被 svg 裁掉 3–4px。量完字的外框后把平移量收进 [0, w] × [0, h](留 1px),放得下时原样不动。
//   x, y   投影点(画布坐标);bb 字在本组内的外框 {x, y, width, height};pad = {x, y} 芯片内衬;w, h 画布尺寸
//   返回收边后的平移量 {x, y}(画布太小、芯片比画布还宽时按左 / 上对齐)
export function clampChipTranslate(x, y, bb, pad, w, h){
	const px = (pad && pad.x) || 0;
	const py = (pad && pad.y) || 0;
	const box = bb || { x: 0, y: 0, width: 0, height: 0 };
	const clamp = (v, lo, hi)=>(hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
	if(!(w > 0) || !(h > 0)){ return { x, y }; }
	const lx = -(box.x - px) + 1;
	const hx = w - (box.x + box.width + px) - 1;
	const ly = -(box.y - py) + 1;
	const hy = h - (box.y + box.height + py) - 1;
	return { x: clamp(x, lx, hx), y: clamp(y, ly, hy) };
}

// 芯片组按收边后的平移量就位(d3 选择集或任何带 attr(k, v) 的对象);放得下时不改写 transform。返回实际平移量。
export function placeChip(g, xy, bb, pad, size){
	const c = clampChipTranslate(xy[0], xy[1], bb, pad, size && size.w, size && size.h);
	if(c.x !== xy[0] || c.y !== xy[1]){ g.attr('transform', `translate(${c.x.toFixed(1)},${c.y.toFixed(1)})`); }
	return c;
}
