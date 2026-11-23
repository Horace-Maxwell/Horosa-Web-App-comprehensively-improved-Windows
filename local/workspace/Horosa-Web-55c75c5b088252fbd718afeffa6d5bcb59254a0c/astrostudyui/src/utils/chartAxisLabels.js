// d3 坐标轴刻度字的边缘收拢(盘面 / 曲线共用)。
// 横轴刻度字居中放在刻度上,两端的刻度离图边不到半个字宽时会越出 svg(右边距 18px,「2027-03-16」约 60px 宽):
// 伸出去的那一端改成向内对齐(右端 end、左端 start),其余刻度不动。量不到字宽(无布局环境)不动
export function clampEdgeTickLabels(axisG, width){
	if(!axisG || typeof axisG.selectAll !== 'function'){ return; }
	axisG.selectAll('.tick').each(function(){
		const tick = this;
		const label = tick.querySelector ? tick.querySelector('text') : null;
		if(!label || typeof label.getComputedTextLength !== 'function'){ return; }
		let w = 0;
		try{ w = label.getComputedTextLength(); }catch(e){ return; }
		const m = /translate\(\s*([-\d.e]+)/.exec(tick.getAttribute('transform') || '');
		const x = m ? parseFloat(m[1]) : NaN;
		if(!(w > 0) || !Number.isFinite(x)){ return; }
		if(x + w / 2 > width - 1){ label.setAttribute('text-anchor', 'end'); label.setAttribute('dx', '0'); }
		else if(x - w / 2 < 1){ label.setAttribute('text-anchor', 'start'); label.setAttribute('dx', '0'); }
	});
}
