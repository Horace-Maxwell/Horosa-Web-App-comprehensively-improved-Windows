// 圆周上的字形避让(星盘行星字形、轮盘标签共用):按黄经排序后,相邻间距不足 minSep 的两两推开,迭代到稳定;
// 只动显示角,引线 / 刻度仍指向真实黄经。返回值与输入同序(未取模,调用方需要时自己归一)。
// 不能对相邻间距取模:推开时相邻两点会暂时换位,取模后间距变成「将近一整圈」被当成够远,两颗星就叠在一起不动了
// (双黄道日月同度叠字即此)。排序后的展开值直接相减,换位算出负数照样继续推;只有末首那一对跨 360。
export function spreadAngles(lons, minSep){
	const n = lons.length;
	const order = lons.map((lon, idx) => ({ idx, lon: ((lon % 360) + 360) % 360 })).sort((a, b) => a.lon - b.lon);
	const pos = order.map((o) => o.lon);
	if(n < 2){ return lons.slice(); }
	for(let round = 0; round < 200; round++){
		let moved = false;
		for(let i = 0; i < n; i++){
			const j = (i + 1) % n;
			const gap = i === n - 1 ? pos[0] + 360 - pos[i] : pos[j] - pos[i];
			if(gap < minSep - 1e-6){
				const push = (minSep - gap) / 2;
				pos[i] -= push;
				pos[j] += push;
				moved = true;
			}
		}
		if(!moved){ break; }
	}
	const out = new Array(n);
	order.forEach((o, i) => { out[o.idx] = pos[i]; });
	return out;
}
