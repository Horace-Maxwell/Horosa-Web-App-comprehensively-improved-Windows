// 塔罗页 · 显示常量与几何牌阵布局:花色色、星座键、右栏页签序、按牌真实尺寸算的不重叠布局
// 从 TarotMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

// 花色色:牌面字 / 牌框都用它,一律明暗成对的主题色(旧值 #e08a4b / #5aa6d6 / #9a8fd6 / #6fae74 只为暗底挑,宣纸底 2.3–2.6:1)
export const SUIT_COLOR = {
	major: 'var(--horosa-astro-gold, #d7ad69)',
	wands: 'var(--horosa-hue-orange)', cups: 'var(--horosa-info)', swords: 'var(--horosa-hue-purple)', pentacles: 'var(--horosa-jx-ji)',
};
export const SIGN_KEYS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const RIGHT_TABS = ['overview', 'positions', 'meanings', 'synthesis', 'verdict', 'birthcards', 'lenormand', 'ook', 'pairs', 'daily'];

// 几何牌阵「不重叠」布局:据牌真实尺寸(真实牌面更高)+ 各位置间距,
// 算统一缩放 s(保证任一非蓄意牌对至少一轴分开)+ 紧凑容器高 H。仅蓄意同点对(凯尔特交叉)允许叠放。
export function computeGeoLayout(positions, isImg){
	const W = 680, MAX_H = 1240, GAP = 1.07;
	const baseCw = isImg ? 98 : 110;                        // 卡外宽(px,基准)
	// 卡外高用纯比例(随 cw 线性缩放→保证容器高不超 MAX_H 时绝不重叠):真实牌面实测≈2.47×,符号牌≈1.45×
	const cardH = (cw) => cw * (isImg ? 2.5 : 1.5);
	// 横压牌(位置带 crossFixed)旋转 90°:认位置自己的标记,不认牌阵名 —— 凯尔特十字的缩简版 / 加权版同样有这张牌
	const rotated = (idx) => !!(positions[idx] && positions[idx].crossFixed);
	const wOf = (idx, cw) => (rotated(idx) ? cardH(cw) : cw);  // 旋转牌横向占其高
	const hOf = (idx, cw) => (rotated(idx) ? cw : cardH(cw));  // 旋转牌纵向占其宽
	const deliberate = (p, q) => Math.abs(p.x - q.x) < 0.02 && Math.abs(p.y - q.y) < 0.02;
	const pairs = [];
	for(let a = 0; a < positions.length; a++){
		for(let b = a + 1; b < positions.length; b++){
			if(!deliberate(positions[a], positions[b])){ pairs.push([a, b]); }
		}
	}
	// 1) 统一缩放 s:s=1 时估 eff 尺寸,解每对在 MAX_H 高度内至少一轴分开所需 s 上限
	let s = 1;
	pairs.forEach(([a, b]) => {
		const p = positions[a], q = positions[b];
		const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
		const avgW = (wOf(a, baseCw) + wOf(b, baseCw)) / 2;
		const avgH = (hOf(a, baseCw) + hOf(b, baseCw)) / 2;
		const sHoriz = (dx * W) / (avgW * GAP);             // 横向分开允许的 s
		const sVert = (dy * MAX_H) / (avgH * GAP);          // 纵向分开允许的 s
		const pairS = Math.max(sHoriz, sVert);
		if(pairS < s){ s = pairS; }
	});
	s = Math.max(0.42, Math.min(1, s));
	const cw = baseCw * s;
	// 2) 紧凑容器高 H:对横向重叠(|dx|*W<卡宽)的对,纵向须容下卡高
	let H = 340;
	pairs.forEach(([a, b]) => {
		const p = positions[a], q = positions[b];
		const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
		if(dy < 1e-4){ return; }
		const avgW = (wOf(a, cw) + wOf(b, cw)) / 2;
		const avgH = (hOf(a, cw) + hOf(b, cw)) / 2;
		if(dx * W < avgW){ H = Math.max(H, (avgH * GAP) / dy); }
	});
	const innerH = Math.min(MAX_H, Math.ceil(H));
	// 上下各留半张牌的内边距,使 y≈0/1 的牌(translate -50% 居中)不向上/下越界压到标题与署名;牌心映射进内区。
	const padY = Math.ceil(cardH(cw) / 2 + 6);
	const containerH = innerH + padY * 2;
	return { W, H: containerH, innerH, padY, slotW: Math.round(cw) };
}
