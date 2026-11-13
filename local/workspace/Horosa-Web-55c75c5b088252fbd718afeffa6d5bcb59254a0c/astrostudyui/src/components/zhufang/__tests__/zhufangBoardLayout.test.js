// 人类图体图:同一对中心之间几条通道对称排开、门号标签互不重叠、不压中心名;线头收在中心外沿。
// 曾经 7-31 与 13-33 两条 G 到喉的通道只错开 5 个单位,标签叠成「713433」,通道线压在中心名上。
import { layoutHdChannels, centerLabelBox, boxHitsCenter } from '../ZhufangBoard';

const ALL = [[1, 8, 'g', 'throat'], [2, 14, 'g', 'sacral'], [3, 60, 'sacral', 'root'], [4, 63, 'ajna', 'head'], [5, 15, 'sacral', 'g'], [6, 59, 'solar', 'sacral'],
	[7, 31, 'g', 'throat'], [9, 52, 'sacral', 'root'], [10, 20, 'g', 'throat'], [10, 34, 'g', 'sacral'], [10, 57, 'g', 'spleen'], [11, 56, 'ajna', 'throat'],
	[12, 22, 'throat', 'solar'], [13, 33, 'g', 'throat'], [16, 48, 'throat', 'spleen'], [17, 62, 'ajna', 'throat'], [18, 58, 'spleen', 'root'], [19, 49, 'root', 'solar'],
	[20, 34, 'throat', 'sacral'], [20, 57, 'throat', 'spleen'], [21, 45, 'heart', 'throat'], [23, 43, 'throat', 'ajna'], [24, 61, 'ajna', 'head'], [25, 51, 'g', 'heart'],
	[26, 44, 'heart', 'spleen'], [27, 50, 'sacral', 'spleen'], [28, 38, 'spleen', 'root'], [29, 46, 'sacral', 'g'], [30, 41, 'solar', 'root'], [32, 54, 'spleen', 'root'],
	[34, 57, 'sacral', 'spleen'], [35, 36, 'throat', 'solar'], [37, 40, 'solar', 'heart'], [39, 55, 'root', 'solar'], [42, 53, 'sacral', 'root'], [47, 64, 'ajna', 'head']]
	.map(([a, b, ca, cb])=>({ gates: [a, b], centers: [ca, cb] }));
const CENTERS = ['head', 'ajna', 'throat', 'g', 'heart', 'spleen', 'sacral', 'solar', 'root'];
const hit = (a, b)=>a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// 线段与矩形是否相交(取样足够密)
const segHitsBox = (L, box)=>{
	for(let t = 0; t <= 1; t += 0.02){
		const x = L.x1 + (L.x2 - L.x1) * t;
		const y = L.y1 + (L.y2 - L.y1) * t;
		if(x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h){ return true; }
	}
	return false;
};

function check(channels){
	const geo = layoutHdChannels(channels);
	const labels = geo.map((g)=>g.label.box);
	for(let i = 0; i < labels.length; i += 1){
		for(let j = i + 1; j < labels.length; j += 1){
			expect([channels[i].gates.join('-'), channels[j].gates.join('-'), hit(labels[i], labels[j])]).toEqual([channels[i].gates.join('-'), channels[j].gates.join('-'), false]);
		}
		CENTERS.forEach((c)=>expect([channels[i].gates.join('-'), c, hit(labels[i], centerLabelBox(c))]).toEqual([channels[i].gates.join('-'), c, false]));
		// 门号标签不压任何中心的实形(曾经头顶—脑的 24-61 标签压在脑三角的右上角上)
		CENTERS.forEach((c)=>expect([channels[i].gates.join('-'), c, boxHitsCenter(labels[i], c)]).toEqual([channels[i].gates.join('-'), c, false]));
		// 通道线不进两端中心(线头收在外沿,压不到中心名)
		channels[i].centers.forEach((c)=>expect(segHitsBox(geo[i], centerLabelBox(c))).toBe(false));
	}
	return geo;
}

describe('人类图体图通道布局', ()=>{
	test('样例(7-31 / 13-33 / 17-62 / 30-41):标签互不重叠,不压中心名', ()=>{
		const sample = ALL.filter((c)=>['7-31', '13-33', '17-62', '30-41'].indexOf(c.gates.join('-')) >= 0);
		const geo = check(sample);
		// 同一对中心(G—喉)的两条线左右对称排开,间距 12
		const a = geo[0];
		const b = geo[1];
		expect(Math.abs(Math.abs(a.x1 - b.x1) - 12)).toBeLessThan(0.01);
	});
	test('G 到喉四条通道同时有(1-8 / 7-31 / 10-20 / 13-33)', ()=>{
		check(ALL.filter((c)=>[1, 7, 10, 13].indexOf(c.gates[0]) >= 0 && c.centers.indexOf('throat') >= 0));
	});
	test('极端:36 条通道全有,标签仍互不重叠', ()=>{
		check(ALL);
	});
});

test('头顶—脑单独一条 24-61:标签放在两三角之外,不压脑三角', ()=>{
	const geo = layoutHdChannels([{ gates: [24, 61], centers: ['ajna', 'head'] }]);
	expect(boxHitsCenter(geo[0].label.box, 'ajna')).toBe(false);
	expect(boxHitsCenter(geo[0].label.box, 'head')).toBe(false);
});
