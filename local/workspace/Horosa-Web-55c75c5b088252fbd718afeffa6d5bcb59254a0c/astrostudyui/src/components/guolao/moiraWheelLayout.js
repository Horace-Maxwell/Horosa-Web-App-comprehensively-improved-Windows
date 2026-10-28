// 七政 Moira 轮动态环布局:隐藏某环时不留空带,剩余环按权重重新铺满(对照 Moira 的
// 「重新设计显示」观感——关掉流年神煞/限度环后空位由相邻环补上,而不是留一圈空白)。
// 纯函数,jest 直测;GuoLaoMoiraWheel 每次 render 按当前开关重算 13 个边界。
//
// 带序(内→外,与 GuoLaoMoiraWheel 的 r(idx) 边界索引 0..12 一一对应):
//   0 支主星带 · 1 入宿度数字带 · 2 宫名带 · 3 流年行星带 · 4 宿度刻上 · 5 宿名带
//   6 宿度刻下 · 7 本命行星带 · 8 本命神煞圈 · 9 流年神煞圈 · 10 限度带 · 11 外缘带
// 权重取自原静态 RING_POS 的带宽(0.10 起始轮毂不变),保证全开时布局与历史版本逐值一致。

export const MOIRA_HUB_POS = 0.10;
// 单盘(half,流年圈关)模式:轮毂与内圈按 Moira half_ring_pos 基准重排——
// 无流年行星带,地支/宫号/宫名各自加宽;本命神煞占 [0.62,0.92] 双带(0.77 为层分界)。
export const MOIRA_HUB_POS_HALF = 0.12;

export const MOIRA_RING_BANDS = [
	{ key: 'branchStars', width: 0.12 },
	{ key: 'numbers', width: 0.06 },
	{ key: 'houseNames', width: 0.06 },
	{ key: 'nowPlanets', width: 0.09 },
	{ key: 'stellarTickUp', width: 0.02 },
	{ key: 'stellarNames', width: 0.06 },
	{ key: 'stellarTickDown', width: 0.02 },
	{ key: 'birthPlanets', width: 0.09 },
	{ key: 'birthGods', width: 0.15 },
	{ key: 'transitGods', width: 0.15 },
	{ key: 'limitBand', width: 0.03, toggle: 'ageRing' },
	{ key: 'outerEdge', width: 0.05, toggle: 'ageRing' },
];

// half(单盘)带宽表:全开边界=0.12,0.30,0.36,0.44,0.44,0.44,0.50,0.53,0.62,0.77,0.92,0.95,1.0
// (即 Moira half_ring_pos 逐值,nowPlanets/stellarTickUp 折叠为零宽;transitGods 槽在此模式
// 作本命神煞上层带,跟随 birthGods 开关)。
export const MOIRA_RING_BANDS_HALF = [
	{ key: 'branchStars', width: 0.18 },
	{ key: 'numbers', width: 0.06 },
	{ key: 'houseNames', width: 0.08 },
	{ key: 'nowPlanets', width: 0 },
	{ key: 'stellarTickUp', width: 0 },
	{ key: 'stellarNames', width: 0.06 },
	{ key: 'stellarTickDown', width: 0.03 },
	{ key: 'birthPlanets', width: 0.09 },
	{ key: 'birthGods', width: 0.15 },
	{ key: 'transitGods', width: 0.15 },
	{ key: 'limitBand', width: 0.03, toggle: 'ageRing' },
	{ key: 'outerEdge', width: 0.05, toggle: 'ageRing' },
];

// Moira 官方 aspects_ring_pos=0.38,0.42,0.51,0.54,0.62,0.69,0.76,0.92,0.95,1.0(逐值照抄):
// 锚带[0.38,0.42]→行星带[0.42,0.51](圆1=0.51)→刻度带[0.51,0.54]→宿带[0.54,0.62](圆2=0.62)
// →人事宫[0.62,0.69](圆3)→八卦支曜[0.69,0.76](圆4)→神煞[0.76,0.92](圆5)→岁数[0.92,0.95](圆6)→年份区。
// idx10/11 钉 0.92/0.95 供岁数带 r(10)/r(11) 硬引用复用。
export const ASPECTS_RING_POS_13 = [0.38, 0.42, 0.51, 0.54, 0.62, 0.69, 0.76, 0.92, 0.95, 0.95, 0.92, 0.95, 1.0];

export function computeRingPositions(visibility, mode){
	if(mode === 'aspects'){
		return ASPECTS_RING_POS_13.slice();
	}
	const half = mode === 'half';
	const bands = half ? MOIRA_RING_BANDS_HALF : MOIRA_RING_BANDS;
	const hub = half ? MOIRA_HUB_POS_HALF : MOIRA_HUB_POS;
	const vis = visibility || {};
	const bandOn = (band)=>!band.toggle || vis[band.toggle] !== false;
	const total = bands.reduce((sum, band)=>sum + (bandOn(band) ? band.width : 0), 0);
	const scale = total > 0 ? (1 - hub) / total : 0;
	const pos = [hub];
	bands.forEach((band)=>{
		const width = bandOn(band) ? band.width * scale : 0;
		pos.push(Math.min(1, pos[pos.length - 1] + width));
	});
	return pos;
}

// 边界是否与前一边界重合(带被折叠)——渲染层据此跳过重复圆环/扇线。
export function ringCollapsed(pos, idx){
	return idx > 0 && (pos[idx] - pos[idx - 1]) < 0.0005;
}
