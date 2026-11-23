// 横轴两端刻度字越出图边时向内对齐;中间的刻度与量不到字宽时不动
import { clampEdgeTickLabels } from '../chartAxisLabels';

function axisWith(ticks){
	const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	ticks.forEach(([x, w])=>{
		const t = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		t.setAttribute('class', 'tick'); t.setAttribute('transform', `translate(${x},0)`);
		const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		label.setAttribute('dy', '0.71em');
		if(w !== null){ label.getComputedTextLength = ()=>w; }
		t.appendChild(label); g.appendChild(t);
	});
	return { node: g, selectAll: (sel)=>({ each: (fn)=>g.querySelectorAll(sel).forEach((n)=>fn.call(n)) }) };
}
const anchors = (a)=>[...a.node.querySelectorAll('text')].map((t)=>t.getAttribute('text-anchor') || 'middle');

it('右端越出 → end;左端越出 → start;中间不动', ()=>{
	const a = axisWith([[10, 60], [300, 60], [590, 60]]);
	clampEdgeTickLabels(a, 600);
	expect(anchors(a)).toEqual(['start', 'middle', 'end']);
});
it('放得下不动;量不到字宽不动', ()=>{
	const a = axisWith([[100, 60], [500, 60], [595, null]]);
	clampEdgeTickLabels(a, 600);
	expect(anchors(a)).toEqual(['middle', 'middle', 'middle']);
});
