// 坚七政行星标签沿圈避让:名字 / 度数标签相邻间距不小于字宽(单源 utils/circleSpread);星点角度不变
import { qizhengPlanetSlots, qizhengLabelAngles } from '../GuoLaoQizhengWheel';

const gap = (a, b)=>{ const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

test('三颗同宿 / 相邻宿的星:标签两两间距 ≥ 字宽角距;星点角度与此前摊开法相同', ()=>{
	const planets = [
		{ name: '火星', longitude: 176.3, signDegree: 26.3 },
		{ name: '木星', longitude: 176.0, signDegree: 26.0 },
		{ name: '罗睺', longitude: 175.2, signDegree: 25.2 },
		{ name: '土星', longitude: 8.4, signDegree: 8.4 },
	];
	const groups = new Map();
	// 分组形状与组件相同(宿序号 → 该宿内的星)
	planets.forEach((p, i)=>{ const k = i < 3 ? 1 : 2; if(!groups.has(k)){ groups.set(k, []); } groups.get(k).push(p); });
	const slots = qizhengPlanetSlots(groups);
	expect(slots).toHaveLength(4);
	const labels = qizhengLabelAngles(slots);
	const names = labels.slice(0, 3).map((x)=>x.name);
	const degrees = labels.slice(0, 3).map((x)=>x.degree);
	for(let i = 0; i < 3; i++){
		for(let j = i + 1; j < 3; j++){
			expect(gap(names[i], names[j])).toBeGreaterThan(10);   // 「火·火星」四字 10px @ 221 半径 ≈ 10.4°
			expect(gap(degrees[i], degrees[j])).toBeGreaterThan(5);
		}
	}
	// 远处的单星不被推动
	expect(gap(labels[3].name, slots[3].angle)).toBeLessThan(1e-6);
	expect(qizhengLabelAngles([])).toEqual([]);
});
