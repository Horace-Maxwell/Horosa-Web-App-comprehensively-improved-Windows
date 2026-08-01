// 罗经/线法环/圆图 · 文字不重叠几何断言（用户实测反馈：满层时 64 卦名与干支糊成一片）。
//
// 🔴 判据不是「看着不挤」，而是从真实渲染出的 SVG 逐字量：
//   ① 径向：同一格内相邻字的间距必须 ≥ 真实排版盒高
//   ② 切向：字号（=全角盒宽）必须 ≤ 该格在**最内圈**的弧宽（中径够宽不代表内缘够宽）
// 字号公式此前只夹了 width*0.5（未除字数）与中径弧宽 → 两条同时踩空。
//
// 🔴 BOX_H 取自实机 getBBox 实测：盒高/字号 ∈ [1.147, 1.183]，盒宽/字号 = 1.00（全角）。
//    判据必须用这个比值，不能用 1.0——按字号算「不重叠」而真实盒仍相压，正是用户实测反馈的那一幕。
//    另注：审计真实页面时须在**局部旋转系**里比，旋转元素的轴对齐包围盒会假报重叠。
const BOX_H = 1.183;
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LuopanDial from '../charts/LuopanDial';
import XianfaRing from '../charts/XianfaRing';
import SixtyFourGuaCircle from '../charts/SixtyFourGuaCircle';
import { LUOPAN_LAYERS } from '../fengshuiData';

const SIZE = 760;
const R = SIZE / 2 - 6;

// 从 rotate(deg cx cy) 分组里量出：该组每个 <text> 的字号与半径。
function glyphsOf(html) {
	const out = [];
	const gRe = /<g transform="rotate\(([-\d.]+) [\d.]+ [\d.]+\)">([\s\S]*?)<\/g>/g;
	let m;
	while ((m = gRe.exec(html))) {
		const deg = parseFloat(m[1]);
		const inner = m[2];
		const tRe = /<text[^>]*y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
		let t; const chars = [];
		while ((t = tRe.exec(inner))) { chars.push({ y: parseFloat(t[1]), fs: parseFloat(t[2]), ch: t[3] }); }
		if (chars.length) { out.push({ deg, chars }); }
	}
	return out;
}

describe('综合罗经 · 满层无重叠', ()=>{
	const html = renderToStaticMarkup(
		<LuopanDial deg={0} zuoShan="子" xiangShan="午" layers={LUOPAN_LAYERS.map((l)=>l.key)} size={SIZE} />,
	);
	const groups = glyphsOf(html);

	it('渲染出足量文字组（层表全开）', ()=>{
		const cells = LUOPAN_LAYERS.reduce((a, l)=>a + (l.cells || []).length, 0);
		expect(groups.length).toBeGreaterThanOrEqual(cells * 0.9);
	});

	it('🔴 同格内相邻字的间距 ≥ 字号（径向不叠字）', ()=>{
		const bad = [];
		groups.forEach((g)=>{
			for (let i = 1; i < g.chars.length; i++) {
				const gap = Math.abs(g.chars[i].y - g.chars[i - 1].y);
				const fs = Math.max(g.chars[i].fs, g.chars[i - 1].fs);
				if (gap < fs * BOX_H) { bad.push({ deg: g.deg, gap: +gap.toFixed(2), need: +(fs * BOX_H).toFixed(2), fs, txt: g.chars.map((c)=>c.ch).join('') }); }
			}
		});
		expect(bad.slice(0, 6)).toEqual([]);
	});

	it('🔴 每层文字整体不越出本层带宽（不压进相邻环）', ()=>{
		const cy = SIZE / 2;
		const bands = LUOPAN_LAYERS.map((l)=>({ key: l.key, rIn: l.r0 * R, rOut: l.r1 * R }));
		const bad = [];
		groups.forEach((g)=>{
			const rs = g.chars.map((c)=>cy - c.y);
			const fs = Math.max(...g.chars.map((c)=>c.fs));
			const lo = Math.min(...rs) - fs / 2; const hi = Math.max(...rs) + fs / 2;
			const band = bands.find((b)=>lo >= b.rIn - 0.6 && hi <= b.rOut + 0.6);
			if (!band) { bad.push({ txt: g.chars.map((c)=>c.ch).join(''), lo: +lo.toFixed(1), hi: +hi.toFixed(1), fs }); }
		});
		expect(bad.slice(0, 6)).toEqual([]);
	});

	it('🔴 字号 ≤ 该格最内圈弧宽（切向不与邻格相撞）', ()=>{
		const cy = SIZE / 2;
		const bad = [];
		LUOPAN_LAYERS.forEach((l)=>{
			const n = (l.cells || []).length;
			if (!n) { return; }
			const rIn = l.r0 * R; const rOut = l.r1 * R;
			const arcIn = (2 * Math.PI * rIn) / n;
			groups.forEach((g)=>{
				const rs = g.chars.map((c)=>cy - c.y);
				if (Math.min(...rs) < rIn || Math.max(...rs) > rOut) { return; }
				const fs = Math.max(...g.chars.map((c)=>c.fs));
				if (fs > arcIn) { bad.push({ layer: l.key, fs, arcIn: +arcIn.toFixed(2), txt: g.chars.map((c)=>c.ch).join('') }); }
			});
		});
		expect(bad.slice(0, 6)).toEqual([]);
	});

	it('可读性下限：最小字号仍 ≥ 5px', ()=>{
		const minFs = Math.min(...groups.flatMap((g)=>g.chars.map((c)=>c.fs)));
		expect(minFs).toBeGreaterThanOrEqual(5);
	});
});

describe('线法环 / 六十四卦圆图 · 无重叠', ()=>{
	it('线法三环：径向不叠字', ()=>{
		const groups = glyphsOf(renderToStaticMarkup(<XianfaRing deg={345.5} size={560} />));
		expect(groups.length).toBeGreaterThan(200);
		const bad = [];
		groups.forEach((g)=>{
			for (let i = 1; i < g.chars.length; i++) {
				const gap = Math.abs(g.chars[i].y - g.chars[i - 1].y);
				const fs = Math.max(g.chars[i].fs, g.chars[i - 1].fs);
				if (gap < fs * BOX_H) { bad.push({ txt: g.chars.map((c)=>c.ch).join(''), gap: +gap.toFixed(2), need: +(fs * BOX_H).toFixed(2), fs }); }
			}
		});
		expect(bad.slice(0, 6)).toEqual([]);
	});
	it('六十四卦圆图：四字卦名（如雷泽归妹）也不叠字', ()=>{
		const groups = glyphsOf(renderToStaticMarkup(<SixtyFourGuaCircle deg={199.7} size={620} />));
		const four = groups.filter((g)=>g.chars.length === 4);
		expect(four.length).toBeGreaterThan(0);
		const bad = [];
		groups.forEach((g)=>{
			for (let i = 1; i < g.chars.length; i++) {
				const gap = Math.abs(g.chars[i].y - g.chars[i - 1].y);
				const fs = Math.max(g.chars[i].fs, g.chars[i - 1].fs);
				if (gap < fs * BOX_H) { bad.push({ txt: g.chars.map((c)=>c.ch).join(''), gap: +gap.toFixed(2), need: +(fs * BOX_H).toFixed(2), fs }); }
			}
		});
		expect(bad.slice(0, 6)).toEqual([]);
	});
});
