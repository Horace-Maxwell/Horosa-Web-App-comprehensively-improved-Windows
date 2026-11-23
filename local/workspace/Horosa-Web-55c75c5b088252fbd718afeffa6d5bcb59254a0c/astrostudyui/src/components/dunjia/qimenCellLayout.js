// 奇门盘格子里附加字(暗干 / 寄干 / 天禽 / 推演标记)的落位与字号 —— 奇门页大盘与三式合一盘共用这一份(三式合一同步)。
//
// 写法 =「上挂下注」:每项附加字挂在它所属那个主字的正上方 / 正下方,哪一类永远在哪个位置 ——
//   奇门页大盘:暗干在门的正上方(暗干由值使门起,属人盘)、推演标记在门的正下方、天盘寄干在天盘干正上方、
//              地盘寄干在地盘干正下方、天禽在九星正下方;
//   三式盘:格子上下没有余地 —— 寄干紧跟所寄的天 / 地盘干同行小写,天禽在九星上方;暗干与推演标记移到「格旁空格」
//          (奇门环上每宫顺时针一侧那一格,本来空着,见 SANSHI_SIDE_UNITS)。
// 安全距离:每块空位先从主字 / 门 / 宫名 / 驿马 / 格边各退一圈 safe(奇门页大盘 6 设计 px),附加字只落在退过的空位里,
//   项与项之间也隔 safe —— 不贴字、不挤。
// 放得下用首选字号(minorFont / tagFont);放不下先换行、再缩字号,下限两档:先求视觉 ≥ MIN_VISUAL_PX,
//   整格都放不下才退到 HARD_MIN_VISUAL_PX(÷ 视觉缩放比换成 CSS px);再换简写,最后收起(进 title,右栏卡片仍有全文),
//   绝不靠「保底字号」硬塞。
// 几何全用 CSS px(格子坐标系),与盘怎么缩放无关;scale 只用来把视觉下限折成 CSS px。

export const MINOR_RATIO = 0.6;      // 没给首选字号时:附加字 ≤ 主字 × 0.6
export const MIN_VISUAL_PX = 9.5;    // 附加字在屏幕上的目标下限
export const HARD_MIN_VISUAL_PX = 8; // 实在放不下(最小窗口 / 小盘)时的绝对下限,再小就收起
export const LINE_HEIGHT = 1.12;
export const PRE_EM = 0.8;            // 前缀小字(「寄」「暗」)= 0.68em 字 + 0.12em 右缝
const TAG_PAD_EM = 0.4;               // 推演标记的小药丸左右内边距合计
const TAG_GAP_EM = 0.3;               // 同一行两个标记之间

const isWide = (ch)=>/[⺀-鿿豈-﫿　-〿＀-￯]/.test(ch);
// 字宽(em):汉字 / 全角 1,其余(数字 / 拉丁)0.62(略放宽,宁可小一号也不越界)
export function textEm(s){
	let w = 0;
	for(const ch of `${s || ''}`){ w += isWide(ch) ? 1 : 0.62; }
	return w;
}

// 推演标记的盘面写法(两盘同一份):上N / 下N / 用 照写;空转X → 转X;先天位 → 先天
export function displayTuiYanTag(t){
	const v = `${t || ''}`;
	if(v.indexOf('空转') === 0){ return `转${v.slice(2)}`; }
	if(v === '先天位'){ return '先天'; }
	return v;
}
// 推演标记的释义(悬停 title 与图例共用)
export function describeTuiYanTag(t){
	const v = `${t || ''}`;
	let m = /^上(\d)$/.exec(v);
	if(m){ return `上翻第 ${m[1]} 步（往过去）`; }
	m = /^下(\d)$/.exec(v);
	if(m){ return `下翻第 ${m[1]} 步（往将来）`; }
	if(v === '用'){ return '推演用神宫'; }
	if(v.indexOf('空转') === 0){ return `本宫空亡，信息转看对冲${v.slice(2)}宫`; }
	if(v === '先天位'){ return '大伏吟：用神宫转看的先天八卦位'; }
	return v;
}
// 盘下图例(按推演方式)
export function tuiYanLegend(view){
	if(view === 'fan'){ return '上N = 上翻第 N 步（往过去） · 下N = 下翻第 N 步（往将来） · 用 = 推演用神宫'; }
	if(view === 'zhuan'){ return '转X = 本宫空亡，转看对冲 X 宫 · 先天 = 大伏吟转看先天八卦位 · 用 = 推演用神宫'; }
	return '';
}

const rect = (x, y, r, b)=>({ x, y, w: Math.max(0, r - x), h: Math.max(0, b - y) });
const area = (s)=>s.w * s.h;
const intersects = (a, b)=>a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inflate = (r, d)=>({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

// 空位里挖掉要避开的块(宫名、驿马、已落下的字):取挖掉后剩下最大的那一边;空位自带的对齐 / 锚点随行
function carve(slot, avoid){
	let s = slot;
	(avoid || []).forEach((a)=>{
		if(!a || !intersects(s, a)){ return; }
		const cands = [
			rect(s.x, s.y, Math.min(s.x + s.w, a.x), s.y + s.h),                 // 左边
			rect(Math.max(s.x, a.x + a.w), s.y, s.x + s.w, s.y + s.h),           // 右边
			rect(s.x, s.y, s.x + s.w, Math.min(s.y + s.h, a.y)),                 // 上边
			rect(s.x, Math.max(s.y, a.y + a.h), s.x + s.w, s.y + s.h),           // 下边
		];
		const best = cands.reduce((b, c)=>(area(c) > area(b) ? c : b), cands[0]);
		s = { ...s, ...best };
	});
	return s;
}

// 一块盘的全部空位(格子坐标,CSS px):几何里写好的空位,挖掉避让块(各自外扩一圈安全距离)
export function qimenCellSlots(g){
	const safe = g.safe || 0;
	const avoid = (g.avoid || []).filter(Boolean).map((a)=>inflate(a, safe));
	const out = {};
	Object.keys(g.slots || {}).forEach((k)=>{ out[k] = carve(g.slots[k], avoid); });
	return out;
}

// 字号一律落在 0.1 px 格点上:结果向下取整,下限向上进位。
// 下限不进位的话,「正好被夹在下限上」的字号(下限比首选字号大时就是这种情况:盘小、视觉下限折成 CSS px 后超过首选字号)
// 向下取整后会比下限小不到 0.1 px,被误判成放不下 —— 附注在很多缩放比例下整项消失(是否消失只取决于除出来的数落不落在格点上)。
const gridUp = (v)=>Math.ceil(v * 10 - 1e-6) / 10;
const gridDown = (v)=>Math.floor(v * 10 + 1e-6) / 10;

// 一串「块」(字或标记)放进 w×h:试 1..n 行(按块均分),取字号最大的那种;放不下下限字号返回 null
//   tokens = [{ text, em }];sep = 同一行相邻两块之间的 em;rows = 只试这些行数(缺省 1..n)
//   maxFont = 首选字号(上限);minFont = 下限。下限比首选字号大时(盘小)字号取下限 —— 宁可比首选大也要读得清
export function fitTokens(tokens, slot, { maxFont, minFont, sep = 0, rows: allowed }){
	const n = tokens.length;
	if(!n || !(slot.w > 0) || !(slot.h > 0)){ return null; }
	const floor = gridUp(minFont);
	const cap = Math.max(maxFont, floor);
	let best = null;
	const tries = (allowed || Array.from({ length: n }, (_, i)=>i + 1)).filter((r)=>r >= 1 && r <= n);
	for(const rows of tries){
		const per = Math.ceil(n / rows);
		const lines = [];
		for(let i = 0; i < n; i += per){ lines.push(tokens.slice(i, i + per)); }
		const widest = Math.max(...lines.map((ln)=>ln.reduce((s, t)=>s + t.em, 0) + sep * (ln.length - 1)));
		const font = gridDown(Math.min(cap, slot.w / widest, slot.h / (lines.length * LINE_HEIGHT)));
		// 达不到下限的行数直接出局(不能让它占着「行数少优先」的位置,把后面放得下的行数挡掉);
		// 达标的里面行数少的优先,多一行要大出 0.25 px 才换
		if(font < floor - 1e-9){ continue; }
		if(!best || font > best.font + 0.25){ best = { font, lines }; }
	}
	return best;
}

// 一个词 = 一块(换行只在词与词之间);pre = 前缀小字
const word = (text, pre)=>({ text, em: pre ? PRE_EM * Array.from(text).length : textEm(text), pre: !!pre });

// 一项的行宽(em)
function lineEm(kind, ln){
	if(kind === 'tag'){ return ln.reduce((s, t)=>s + textEm(t.text) + TAG_PAD_EM, 0) + TAG_GAP_EM * (ln.length - 1); }
	return ln.reduce((s, t)=>s + t.em, 0);
}

// 一项附加字在空位里的实际字框:有锚点(ax)的以锚点为中心、夹在空位内;否则按 align;竖向按 valign
export function overlayTextBox(it){
	const w = Math.max(...it.lines.map((ln)=>lineEm(it.kind, ln))) * it.font;
	const h = it.lines.length * it.font * LINE_HEIGHT;
	const s = it.slot;
	let x;
	if(typeof s.ax === 'number'){ x = clamp(s.ax - w / 2, s.x, s.x + s.w - w); }
	else{ x = s.align === 'end' ? s.x + s.w - w : (s.align === 'center' ? s.x + (s.w - w) / 2 : s.x); }
	const y = s.valign === 'end' ? s.y + s.h - h : (s.valign === 'center' ? s.y + (s.h - h) / 2 : s.y);
	return { x, y, w, h };
}

// 各项的写法(长 → 短);按盘的写法风格出:ruby = 奇门页大盘(上挂下注,带前缀)/ inline = 三式盘格内(只写干)
function itemSpecs(c, g){
	const specs = [];
	const style = g.style || 'ruby';
	if(c.anGan){
		const title = `暗干 ${c.anGan}${c.anZhi ? ` · 暗支 ${c.anZhi}` : ''}`;
		const words = [word(c.anGan)].concat(c.anZhi ? [word(c.anZhi)] : []);
		const forms = [];
		if(g.anPrefix){ forms.push({ tokens: [word('暗', true)].concat(words) }); }
		forms.push({ tokens: words });
		// 暗支在目标字号放不下时先进 title(盘大一点就回来),暗干保持读得清
		if(c.anZhi){ forms.push({ tokens: [word(c.anGan)], short: true }); }
		specs.push({ key: 'anGan', kind: 'minor', forms, title });
	}
	const jiForms = (gan)=>(style === 'inline'
		? [{ tokens: [word(gan)] }]
		: [{ tokens: [word('寄', true), word(gan)] }, { tokens: [word(gan)], short: true }]);
	if(c.jiTianGan){
		specs.push({ key: 'jiTian', kind: 'minor', forms: jiForms(c.jiTianGan), title: `天盘寄干 ${c.jiTianGan}：中五宫天盘干随星寄此宫` });
	}
	if(c.jiDiGan){
		specs.push({ key: 'jiDi', kind: 'minor', forms: jiForms(c.jiDiGan), title: `地盘寄干 ${c.jiDiGan}：中五宫地盘干寄此宫` });
	}
	if(c.tianQin){
		const forms = style === 'inline' ? [{ tokens: [word('禽')] }] : [{ tokens: [word('天禽')] }, { tokens: [word('禽')], short: true }];
		specs.push({ key: 'tianQin', kind: 'minor', forms, title: '天禽：随寄宫之星落此宫' });
	}
	const tags = Array.isArray(c.tuiYanTags) ? c.tuiYanTags.filter(Boolean) : [];
	if(tags.length){
		const tok = (t)=>({ text: displayTuiYanTag(t), em: textEm(displayTuiYanTag(t)) + TAG_PAD_EM });
		// 推演标记要的是整条链:先保全部标记,放不下才只留第一个(其余进 title,图例与右栏卡仍有)
		const forms = [{ tokens: tags.map(tok), sep: TAG_GAP_EM }];
		if(tags.length > 1){ forms.push({ tokens: [tok(tags[0])], short: true }); }
		specs.push({ key: 'tuiYan', kind: 'tag', forms, formFirst: true, title: tags.map(describeTuiYanTag).join('；') });
	}
	return specs;
}

// 一格的附加字落位。cell = 盘格数据(anGan / anZhi / jiTianGan / jiDiGan / tianQin / tuiYanTags);
// g = 盘的几何(见下面三个 *Geometry):slots(空位)/ plan(每项依次试哪几块空位;不在 plan 里的项不归这块几何管)/
//     avoid / safe / minorFont / tagFont / mainFont / scale / style / anPrefix
// 每项按 plan 的次序落位:先求视觉目标下限 —— 首选空位里长写、简写都试过,才去备选空位;都不行再退到绝对下限重来一遍
// (推演标记例外:整条链在两档下限都试过才换简写,见 formFirst)。
// 落下的项占住自己的字框(外扩 safe),后面的项在剩下的地方里找。
// 返回 { items: [{ key, kind, lines, font, slot, box, title, short }], hidden: [{ key, title }], slots }
export function layoutQimenCell(cell, g){
	const c = cell || {};
	const slots = qimenCellSlots(g);
	const safe = g.safe || 0;
	const scale = (g.scale > 0 && isFinite(g.scale)) ? g.scale : 1;
	const prefMinor = g.minorFont || Math.max(1, Math.round((g.mainFont || 16) * MINOR_RATIO));
	const prefTag = g.tagFont || prefMinor;
	const mins = { soft: MIN_VISUAL_PX / scale, hard: HARD_MIN_VISUAL_PX / scale };
	const plan = g.plan || {};
	const items = [];
	const hidden = [];
	const taken = [];
	itemSpecs(c, g).forEach((sp)=>{
		const where = (plan[sp.key] || []).filter((at)=>slots[at]);
		if(!plan[sp.key]){ return; }
		const pref = sp.kind === 'tag' ? prefTag : prefMinor;
		// 尝试次序。一般项:目标下限一档里「首选空位的长写 → 简写 → 备选空位」都试过,才退到绝对下限重来(简写丢的是次要信息,先保字大);
		// formFirst(推演标记):长写(整条链)在两档下限、各块空位都试过,才换简写 —— 宁可字小一点也先保整条链
		const attempts = [];
		if(sp.formFirst){
			sp.forms.forEach((f)=>['soft', 'hard'].forEach((tier)=>where.forEach((at)=>attempts.push({ f, tier, at }))));
		}else{
			['soft', 'hard'].forEach((tier)=>where.forEach((at)=>sp.forms.forEach((f)=>attempts.push({ f, tier, at }))));
		}
		for(const { f, tier, at } of attempts){
			const slot = carve(slots[at], taken);
			const r = fitTokens(f.tokens, slot, { maxFont: pref, minFont: mins[tier], sep: f.sep || 0 });
			if(r){
				const it = { key: sp.key, kind: sp.kind, lines: r.lines, font: r.font, slot, title: sp.title, short: !!f.short };
				it.box = overlayTextBox(it);
				items.push(it);
				taken.push(inflate(it.box, safe));
				return;
			}
		}
		hidden.push({ key: sp.key, title: sp.title });
	});
	return { items, hidden, slots };
}

// ───────────── 两盘的格子几何 ─────────────

const len = (s)=>Math.max(1, Array.from(`${s || ''}`.trim()).length);
const right = (r)=>r.x + r.w;
const bottom = (r)=>r.y + r.h;
const cx = (r)=>r.x + r.w / 2;

// 三式盘外圈奇门格:四角主字贴格边(1px),门是居中的方块。格内只放寄干(紧跟所寄的干)与天禽(九星上方);
// 暗干与推演标记由 sanshiSideGeometry 放进格旁空格
export function sanshiCellGeometry({ cellPx, mainFont, doorSize, cell, scale }){
	const c = cell || {};
	const F = mainFont;
	const W = cellPx;
	const safe = Math.max(1, Math.round(F * 0.1 * 10) / 10);
	const tl = { x: 1, y: 1, w: F * len(c.tianGan), h: F };
	const tr = { x: W - 1 - F * len(c.god), y: 1, w: F * len(c.god), h: F };
	const bl = { x: 1, y: W - 1 - F, w: F * len(c.diGan), h: F };
	const br = { x: W - 1 - F * len(c.tianXing), y: W - 1 - F, w: F * len(c.tianXing), h: F };
	const door = { x: (W - doorSize) / 2, y: (W - doorSize) / 2, w: doorSize, h: doorSize };
	return {
		w: W, h: W, mainFont: F, scale, safe, style: 'inline',
		tl, tr, bl, br, door,
		slots: {
			// 天盘干同一行、紧跟其后(底边对齐天盘干)
			tianRow: { ...rect(right(tl) + safe, tl.y, tr.x - safe, Math.min(bottom(tl), door.y - safe)), align: 'start', valign: 'end' },
			// 地盘干同一行、紧跟其后
			diRow: { ...rect(right(bl) + safe, Math.max(bl.y, bottom(door) + safe), br.x - safe, bottom(bl)), align: 'start', valign: 'end' },
			// 天盘干两字(寄宫)把同一行挤没时:天盘干与地盘干之间、门以左
			leftMid: { ...rect(1, bottom(tl) + safe, door.x - safe, bl.y - safe), align: 'start', valign: 'center' },
			// 九星上方、门以右
			rightMid: { ...rect(right(door) + safe, bottom(tr) + safe, W - 1, br.y - safe), align: 'end', valign: 'end' },
		},
		plan: { jiTian: ['tianRow', 'leftMid'], jiDi: ['diRow', 'leftMid'], tianQin: ['rightMid'] },
		avoid: [],
	};
}

// 三式盘「格旁空格」:奇门环上每宫顺时针一侧那一格(九宫格单位,0–8;盘心 3–5 是六壬中宫,环上 1 / 7 两行两列是奇门环)
export const SANSHI_SIDE_UNITS = { 1: [2, 1], 2: [5, 1], 3: [7, 2], 6: [7, 5], 9: [6, 7], 8: [3, 7], 7: [1, 6], 4: [1, 3] };
// 格旁空格里放暗干(前缀小「暗」)与推演标记:两项都有时上下各占一半、居中;只有一项时整格居中
export function sanshiSideGeometry({ unitPx, scale, cell }){
	const c = cell || {};
	const U = unitPx;
	const pad = Math.max(2, Math.round(U * 0.07 * 10) / 10);
	const gap = Math.max(3, Math.round(U * 0.07 * 10) / 10);   // 暗干与推演签之间的缝(也是两项的安全距离)
	const minor = clamp(Math.round(U * 0.2 * 10) / 10, 8, 13);
	const both = !!c.anGan && Array.isArray(c.tuiYanTags) && c.tuiYanTags.filter(Boolean).length > 0;
	return {
		w: U, h: U, scale, safe: gap, style: 'ruby', anPrefix: true,
		minorFont: minor, tagFont: Math.max(8, Math.round(minor * 0.92 * 10) / 10),
		slots: both
			? {
				sideTop: { ...rect(pad, pad, U - pad, U / 2 - gap / 2), ax: U / 2, valign: 'end' },
				sideBottom: { ...rect(pad, U / 2 + gap / 2, U - pad, U - pad), ax: U / 2, valign: 'start' },
			}
			: { sideAll: { ...rect(pad, pad, U - pad, U - pad), ax: U / 2, valign: 'center' } },
		plan: both ? { anGan: ['sideTop'], tuiYan: ['sideBottom'] } : { anGan: ['sideAll'], tuiYan: ['sideAll'] },
		avoid: [],
	};
}

// 奇门页大盘格(设计尺寸 214 × 214,整盘按 boardScale 等比缩):四角主字内缩、门字居中,
// 宫名贴向中宫那一边、驿马在角上 —— 两者作为要避开的块;safe = 附加字与主字 / 门 / 宫名 / 驿马的安全距离,edge = 离格边。
// 主字内缩两档:常规(左右 52 / 上下 40,没有附注时的老样子,逐像素不变);留白(左右 46 / 上下 32)——
//   盘上任何一宫有附注时整盘九宫一起换,主字往四角让出门上 / 门下与四角外侧的空间,附注不贴主字、不挤
export const DUNJIA_CELL = { size: 214, font: 34, insetX: 52, insetY: 40, roomyInsetX: 46, roomyInsetY: 32, palaceFont: 15, yima: 20, safe: 8, edge: 5, minorFont: 14, tagFont: 13 };
export function dunjiaCellInsets(roomy){
	return roomy ? { x: DUNJIA_CELL.roomyInsetX, y: DUNJIA_CELL.roomyInsetY } : { x: DUNJIA_CELL.insetX, y: DUNJIA_CELL.insetY };
}
// 这一格有没有附注(暗干 / 寄干 / 天禽 / 推演标记):盘上任一格有 → 整盘换留白档
export function qimenCellHasOverlay(c){
	return !!(c && (c.anGan || c.jiTianGan || c.jiDiGan || c.tianQin || (Array.isArray(c.tuiYanTags) && c.tuiYanTags.some(Boolean))));
}
export function dunjiaPalaceLabelRect(palaceNum, name){
	const { size: S, palaceFont: P } = DUNJIA_CELL;
	const w = P * Math.max(1, Array.from(`${name || ''}`).length);
	const at = {
		1: [S - 12 - w, S - 8 - P], 2: [(S - w) / 2, S - 8 - P], 3: [12, S - 8 - P],
		4: [S - 12 - w, (S - P) / 2], 6: [12, (S - P) / 2],
		7: [S - 12 - w, 8], 8: [(S - w) / 2, 8], 9: [12, 8],
	}[palaceNum];
	return at ? { x: at[0], y: at[1], w, h: P } : null;
}
export function dunjiaYimaRect(palaceNum){
	const { size: S, yima: Y } = DUNJIA_CELL;
	return palaceNum === 7 ? { x: 10, y: S - 8 - Y, w: Y, h: Y } : { x: S - 10 - Y, y: 8, w: Y, h: Y };
}
export function dunjiaCellGeometry({ cell, scale, roomy = false }){
	const c = cell || {};
	const { size: S, font: F, safe: G, edge: E } = DUNJIA_CELL;
	const { x: X, y: Y } = dunjiaCellInsets(roomy);
	const doorW = F * len(c.door);
	const tl = { x: X, y: Y, w: F * len(c.tianGan), h: F };
	const tr = { x: S - X - F * len(c.god), y: Y, w: F * len(c.god), h: F };
	const bl = { x: X, y: S - Y - F, w: F * len(c.diGan), h: F };
	const br = { x: S - X - F * len(c.tianXing), y: S - Y - F, w: F * len(c.tianXing), h: F };
	const door = { x: (S - doorW) / 2, y: (S - F) / 2, w: doorW, h: F };
	return {
		w: S, h: S, mainFont: F, scale, safe: G, style: 'ruby',
		minorFont: DUNJIA_CELL.minorFont, tagFont: DUNJIA_CELL.tagFont,
		tl, tr, bl, br, door,
		slots: {
			// 门的正上方(天盘干与八神之间那一竖条):暗干,贴门底对齐
			aboveDoor: { ...rect(right(tl) + G, E, tr.x - G, door.y - G), ax: cx(door), valign: 'end' },
			// 门的正下方(地盘干与九星之间那一竖条):推演标记,贴门顶对齐
			belowDoor: { ...rect(right(bl) + G, bottom(door) + G, br.x - G, S - E), ax: cx(door), valign: 'start' },
			// 天盘干正上方:天盘寄干
			aboveTL: { ...rect(E, E, tr.x - G, tl.y - G), ax: cx(tl), valign: 'end' },
			// 地盘干正下方:地盘寄干
			belowBL: { ...rect(E, bottom(bl) + G, br.x - G, S - E), ax: cx(bl), valign: 'start' },
			// 九星正下方:天禽
			belowBR: { ...rect(right(bl) + G, bottom(br) + G, S - E, S - E), ax: cx(br), valign: 'start' },
			// 备选(两字八神 / 两字天盘干把门上的竖条挤没时):门的右边 / 左边
			rightOfDoor: { ...rect(right(door) + G, bottom(tr) + G, S - E, br.y - G), align: 'center', valign: 'center' },
			leftOfDoor: { ...rect(E, bottom(tl) + G, door.x - G, bl.y - G), align: 'center', valign: 'center' },
		},
		plan: {
			anGan: ['aboveDoor', 'rightOfDoor'],
			tuiYan: ['belowDoor', 'leftOfDoor'],
			jiTian: ['aboveTL'],
			jiDi: ['belowBL'],
			tianQin: ['belowBR'],
		},
		avoid: [dunjiaPalaceLabelRect(c.palaceNum, c.palaceName), c.isYiMa ? dunjiaYimaRect(c.palaceNum) : null].filter(Boolean),
	};
}

// 奇门页转盘的中宫格:只有天盘干与「五合X」两行大字(各 32 px、行距 4,整体居中),没有门、星、神。
// 暗干起法把暗干排入中五宫时(时干加值使·飞布 / 满盘旋转飞),在这两行下方隔开安全距离挂一行「暗 X」
// (前缀小「暗」—— 中宫没有门可挂,写明是暗干;字号、颜色、缩放规则与其余八宫的暗干同一套)。
// texts = 中宫那几行大字(盘上实际画的);推演标记若落到中宫同样排在下方。
export const DUNJIA_CENTER = { font: 32, gap: 4 };
export function dunjiaCenterGeometry({ texts, scale }){
	const { size: S, safe: G, edge: E } = DUNJIA_CELL;
	const rows = (Array.isArray(texts) ? texts : []).filter((t)=>`${t || ''}`.length > 0);
	const n = Math.max(1, rows.length);
	const H = n * DUNJIA_CENTER.font + (n - 1) * DUNJIA_CENTER.gap;
	const W = Math.max(1, ...rows.map((t)=>Array.from(`${t}`).length)) * DUNJIA_CENTER.font;
	const stack = { x: (S - W) / 2, y: (S - H) / 2, w: W, h: H };
	return {
		w: S, h: S, mainFont: DUNJIA_CENTER.font, scale, safe: G, style: 'ruby', anPrefix: true,
		minorFont: DUNJIA_CELL.minorFont, tagFont: DUNJIA_CELL.tagFont,
		stack,
		slots: { belowCenter: { ...rect(E, bottom(stack) + G, S - E, S - E), ax: S / 2, valign: 'start' } },
		plan: { anGan: ['belowCenter'], tuiYan: ['belowCenter'] },
		avoid: [],
	};
}

// ───────────── 十二建星外环(奇门页大盘)─────────────
// 九宫盘外加一圈,按方位排十二支与各自的建星:上 = 巳午未(巽离坤之外)、右 = 申酉戌、下 = 亥子丑(从右到左)、左 = 寅卯辰(从下到上)。
// 盘面整体仍占原来的边长(外环把九宫等比缩进去),盘头与图例不动。坐标 = 外环设计空间(边长 = 九宫 + 2 × margin)。
export const DUNJIA_RING = { margin: 40, font: 15 };
export function dunjiaJianChuRingSlots({ cellSize = DUNJIA_CELL.size, gap = 10, margin = DUNJIA_RING.margin } = {}){
	const W = cellSize * 3 + gap * 2;
	const col = (i)=>margin + i * (cellSize + gap) + cellSize / 2;
	const near = margin / 2;
	const far = margin + W + margin / 2;
	const at = {
		巳: [col(0), near, false], 午: [col(1), near, false], 未: [col(2), near, false],
		申: [far, col(0), true], 酉: [far, col(1), true], 戌: [far, col(2), true],
		亥: [col(2), far, false], 子: [col(1), far, false], 丑: [col(0), far, false],
		寅: [near, col(2), true], 卯: [near, col(1), true], 辰: [near, col(0), true],
	};
	return Object.keys(at).map((zhi)=>({ zhi, x: at[zhi][0], y: at[zhi][1], vertical: at[zhi][2] }));
}
// 外环把九宫等比缩进原边长的比例
export function dunjiaRingFit({ cellSize = DUNJIA_CELL.size, gap = 10, margin = DUNJIA_RING.margin } = {}){
	const W = cellSize * 3 + gap * 2;
	return { inner: W, outer: W + margin * 2, k: W / (W + margin * 2) };
}
