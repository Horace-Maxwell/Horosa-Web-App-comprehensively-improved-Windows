import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import * as AstroConst from '../../constants/AstroConst';
import { GUOLAO_LIFE_MODE_ASC, GUOLAO_LIFE_MODE_COTRANS, GUOLAO_LIFE_MODE_YUMAO, getStoredGuolaoLifeMode, normalizeGuolaoLifeMode, } from './GuoLaoChartStyle';
import { computeRingPositions, ringCollapsed } from './moiraWheelLayout';
import { cornerTextBlock, apparentSolarText, lunarText, riseSetLines, su28ModeCaption, computationMethodCaption, geoCaption } from './GuoLaoWheelCaptions';
import { guolaoShenShaTip } from './GuoLaoShenShaDoc';
import { longLifeMapForYear, smallLimitBranch, flyLimitBranches, childLimitBranch, childAgeLimitYears, childYearsSpan } from './guolaoMoiraTables';
import { resolveRingShifts } from './electionCore';
import './GuoLaoMoiraWheel.less';

const R = 560;
// 视窗收紧(1220→1180):Moira 圆盘与天星择日盘直径同步放大约 3.4%;
// 最外缘=年份/度数向心文字(外沿≈574),VIEW/2=590 仍留 ≥16px 安全边距。
const VIEW = 1180;
// 全开时的历史布局(基准);运行时实际边界 = ACTIVE_RING_POS,由 moiraWheelLayout 按
// 显示开关重算——隐藏的环折叠为零宽、其余环按权重铺满(Moira 式重排,无空带)。
const RING_POS = [0.10, 0.22, 0.28, 0.34, 0.43, 0.45, 0.51, 0.53, 0.62, 0.77, 0.92, 0.95, 1.0];
const RING_DRAW_TYPE = [1, 0, 0, 0, 1, -10, -10, 1, 1, 0, 0, 1, -10];
// 每次 render 起始处刷新;绘图 helper 众多且均为模块级函数,经模块变量取活动布局
// 可免把布局穿针引线传遍全部 helper(渲染单线程,安全)。
let ACTIVE_RING_POS = RING_POS;

// 槽语义映射(带名→[内界槽,外界槽]):full/half 用恒等 DEFAULT;aspects 模式按 Moira aspects_* 键位
// 重指(行星贴相位网、宿环在行星外、地支/宫号/宫名依次外推、神煞单带)。渲染函数经 rs() 取带界。
const DEFAULT_SLOTS = {
	anchor: [0, 0],
	branchStars: [0, 1],
	numbers: [1, 2],
	houseNames: [2, 3],
	nowPlanets: [3, 4],
	stellarTickUp: [4, 5],
	stellarNames: [5, 6],
	stellarTickDown: [6, 7],
	birthPlanets: [7, 8],
	godsInner: [8, 9],
	godsOuter: [9, 10],
};
// aspects 六圆槽表(与 ASPECTS_RING_POS_13 的六圆规格 lockstep):
// 星体带 [0,1]=0.415-0.51(圆1 内);锚点=圆1 上;宿三段 [1,4];人事宫 [4,5];
// 八卦支曜 [5,6];本命神煞 [6,7];numbers/nowPlanets/godsOuter 折叠(本布局无此内容)。
const ASPECTS_SLOTS = {
	anchor: [0, 1],
	birthPlanets: [1, 2],
	stellarTickUp: [2, 3],
	stellarNames: [3, 4],
	stellarTickDown: [3, 4],
	houseNames: [4, 5],
	branchStars: [5, 6],
	numbers: [6, 6],
	nowPlanets: [6, 6],
	godsInner: [6, 7],
	godsOuter: [7, 7],
};
let ACTIVE_SLOTS = DEFAULT_SLOTS;
function rs(name, side){
	const pair = ACTIVE_SLOTS[name] || [0, 0];
	return r(pair[side]);
}
const LIMIT_SEQ = [11.0, 10.0, 11.0, 15.0, 8.0, 7.0, 11.0, 4.5, 4.5, 4.5, 5.0, 5.0];

const MOIRA_BG = 'var(--moira-bg, #ffffff)';
const BLACK = 'var(--moira-ink, #000000)';
const GREEN = 'var(--moira-green, #008000)';
const BLUE = 'var(--moira-blue, #000080)';
const RED = 'var(--moira-red, #ff0000)';
const MAGENTA = 'var(--moira-magenta, #ff00ff)';
const NOW_MARK = 'var(--moira-now-mark, #804040)';
const PALE = 'var(--moira-pale, #b5d8c7)';
const MUTED_PLANET = 'var(--moira-muted-planet, #8a8a8a)';
const STELLAR_TICK_INNER = 5;
const STELLAR_TICK_OUTER = 6;
const GOD_RING_INNER = 8;
const GOD_RING_OUTER = 10;

const TWELVE_SIGNS = ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'];
// 八卦方位(支→卦,四正卦领四正支、四隅卦跨两支;aspects 六圆规格的「八卦+支+主宰曜」带用)。
const GUA_OF_ZHI = { 子: '坎', 丑: '艮', 寅: '艮', 卯: '震', 辰: '巽', 巳: '巽', 午: '离', 未: '坤', 申: '坤', 酉: '兑', 戌: '乾', 亥: '乾' };
// aspects 八卦+支+主宰曜三字(照 Moira full_twelve_signs_alt 官方表,乾用正字;与 RING1/TWELVE_SIGNS 同序=酉起)。
const TWELVE_SIGNS_ALT = ['兑酉金', '坤申水', '坤未月', '离午日', '巽巳水', '巽辰金', '震卯火', '艮寅木', '艮丑土', '坎子土', '乾亥木', '乾戌火'];

// 多字沿圆弧分开排布(各字正立,择日盘 arcUprightText 同款):字距按半径换算弧角,
// 下半圆字序翻转保证恒从左到右顺读——每字落在扇形中线附近,不越扇界。
function arcUprightTextMoira(text, radius, centerTheta, opt = {}){
	const chars = String(text || '').split('');
	const n = chars.length;
	if(!n){ return null; }
	const size = opt.size || 20;
	const stepDeg = (size * (opt.spacing || 1.12)) / Math.max(1, radius) * 180 / Math.PI;
	const dir = Math.sin(centerTheta * Math.PI / 180) > 0 ? -1 : 1;
	return chars.map((ch, k)=>{
		const t = centerTheta + dir * (k - (n - 1) / 2) * stepDeg;
		const pt = point(radius, t);
		return (
			<text key={`amt-${k}`} x={pt.x} y={pt.y} fill={opt.color || BLACK} fontSize={size} fontWeight={opt.weight || 600} textAnchor="middle" dominantBaseline="central">{ch}</text>
		);
	});
}
const RING1 = ['金酉', '水申', '月未', '日午', '水巳', '金辰', '火卯', '木寅', '土丑', '土子', '木亥', '火戌'];
const HOUSE_BRANCH = ['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '夫妻', '疾厄', '迁移', '官禄', '福德', '相貌'];
const SIGN_NAMES = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const HALF_STELLAR = ['娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸', '角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎'];
const FULL_STELLAR = ['娄金', '胃土', '昴日', '毕月', '觜火', '参水', '井木', '鬼金', '柳土', '星日', '张月', '翼火', '轸水', '角木', '亢金', '氐土', '房日', '心月', '尾火', '箕水', '斗木', '牛金', '女土', '虚日', '危月', '室火', '壁水', '奎木'];

// 入宿度的中文数字(对齐 Moira 中心「六度」写法,0~30)。
function cnDegree(n){
	const v = Math.max(0, Math.min(30, Math.floor(Number(n) || 0)));
	const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
	if(v <= 10) return d[v];
	if(v < 20) return '十' + d[v - 10];
	if(v === 20) return '二十';
	if(v < 30) return '二十' + d[v - 20];
	return '三十';
}
const STEM_BRANCHES = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
const BIRTH_GOD_ORDER = ['劫杀', '文昌', '禄勋', '大耗', '月杀', '咸池', '唐符', '天厨', '伏尸', '三刑', '勾神', '蓦越', '黄幡', '的杀', '孤辰', '天喜', '注受', '剑锋', '飞廉', '病符', '紫微', '华盖', '天贵', '六害', '孤虚', '游奕', '年符', '死符', '地雌', '卷舌', '绞杀', '天德', '贯索', '亡神', '国印', '岁殿', '卦气', '空亡', '豹尾', '擎天', '天空', '大杀', '天厄', '月廉', '天雄', '天哭', '天狗', '地耗', '月符', '披头', '红鸾', '岁驾', '小耗', '寡宿', '飞刃', '天耗', '斗杓', '驿马', '阳刃', '阑干', '玉贵', '血刃', '浮沉', '解神'];
const TRANSIT_GOD_ORDER = ['岁驾', '天空', '地雌', '贯索', '五鬼', '死符', '大耗', '天厄', '天雄', '大杀', '卷舌', '天德', '天狗', '蓦越', '亡神', '天喜', '披头', '血刃', '解神', '天哭', '地解', '劫杀', '的杀', '红鸾', '驿马', '游奕', '擎天', '黄幡', '豹尾', '天厨', '三刑', '六害', '咸池', '阳刃', '禄勋', '天贵'];
const PLANET_DEFS = [
	{id: AstroConst.SUN, label: '日'},
	{id: AstroConst.MOON, label: '月'},
	{id: AstroConst.VENUS, label: '金'},
	{id: AstroConst.JUPITER, label: '木'},
	{id: AstroConst.MERCURY, label: '水'},
	{id: AstroConst.MARS, label: '火'},
	{id: AstroConst.SATURN, label: '土'},
	{id: AstroConst.SOUTH_NODE, label: '计'},
	{id: AstroConst.NORTH_NODE, label: '罗'},
	{id: AstroConst.PURPLE_CLOUDS, label: '炁'},
	{id: AstroConst.DARKMOON, label: '孛'},
	// 天海冥(天王/海王/冥王):后端 chart.objects 本就返回,加入可显示星曜(星曜选择器可开关、进星曜带/表/相位/AI);
	// 七政四余传统无此三星,但用户钦定加入;色按顺逆留+庙旺派生(planetColor),无需专属色。
	{id: AstroConst.URANUS, label: '天'},
	{id: AstroConst.NEPTUNE, label: '海'},
	{id: AstroConst.PLUTO, label: '冥'},
	// 升(Asc)/顶(MC):本命与流年行星带均画,进星曜选择器可开关,并与 Moira 同款参与相位。
	{id: AstroConst.ASC, label: '升'},
	{id: AstroConst.MC, label: '顶'},
];

// 七政四余 行星主管（黄道十二宫 → 主星），用于中宫「命主/身主」
const SIGN_RULERS_CN = {
	Aries: '火', Taurus: '金', Gemini: '水', Cancer: '月', Leo: '日', Virgo: '水',
	Libra: '金', Scorpio: '火', Sagittarius: '木', Capricorn: '土', Aquarius: '土', Pisces: '木',
};
// 庙旺落陷着色（庙旺=吉金、陷失=弱色），与顺逆留色互不冲突（顺逆留优先）
const DIGNITY_STRONG = ['庙', '旺', '入垣', '得地', '入庙', '升殿'];
const DIGNITY_WEAK = ['陷', '失', '落', '失垣', '落陷'];
const DIGNITY_GOLD = 'var(--moira-dignity-strong, #c9912e)';
const DIGNITY_WEAK_COLOR = 'var(--moira-dignity-weak, #b06a5e)';
// 庙旺标注徽标取单字：入庙/庙→庙、入垣→垣、得地→得，旺/陷/失/落 原样。
// （原 dignity.slice(0,1) 把「入庙/入垣」一律截成「入」，致庙旺星显示成「入」。）
const DIGNITY_BADGE_CHAR = {
	'入庙': '庙', '庙': '庙', '入垣': '垣', '垣': '垣',
	'旺': '旺', '得地': '得', '得': '得', '升殿': '殿',
	'陷': '陷', '失': '失', '落': '落', '失垣': '失', '落陷': '陷', '平': '平', '不': '不',
};
function dignityBadgeChar(dignity){
	const key = `${dignity || ''}`.trim();
	return DIGNITY_BADGE_CHAR[key] || key.slice(0, 1);
}
// 相位（會衝刑合半合半刑四合）：度 / 容许度 / 色 / 线型，照 Moira aspects 表
const MOIRA_ASPECTS = [
	{key: '會', angle: 0, orb: 12, color: '#00b35a', dash: '5 3'},
	{key: '衝', angle: 180, orb: 6, color: '#8a4bff', dash: '8 3 2 3'},
	{key: '刑', angle: 90, orb: 3, color: '#e07a18', dash: ''},
	{key: '合', angle: 120, orb: 4, color: '#d23b3b', dash: '10 4'},
	{key: '半合', angle: 60, orb: 2, color: '#c79a1e', dash: '2 3'},
	{key: '半刑', angle: 45, alt: 135, orb: 1.5, color: '#c64fb8', dash: '2 3'},
	{key: '四合', angle: 30, alt: 150, orb: 1, color: '#8a8a3a', dash: '2 3'},
];
const MOIRA_DEFAULT_ASPECTS = ['會', '衝', '刑', '合', '半合'];

function r(idx){
	return ACTIVE_RING_POS[idx] * R;
}

function norm(deg){
	let val = Number(deg);
	if(!Number.isFinite(val)){
		return 0;
	}
	val %= 360;
	if(val < 0){
		val += 360;
	}
	return val;
}

function point(radius, thetaDeg){
	const rad = thetaDeg * Math.PI / 180;
	return {
		x: radius * Math.cos(rad),
		y: radius * Math.sin(rad),
	};
}

function annularSectorPath(inner, outer, startTheta, endTheta){
	const startOuter = point(outer, startTheta);
	const endOuter = point(outer, endTheta);
	const endInner = point(inner, endTheta);
	const startInner = point(inner, startTheta);
	const span = Math.abs(endTheta - startTheta);
	const largeArc = span > 180 ? 1 : 0;
	const sweep = endTheta > startTheta ? 1 : 0;
	const innerSweep = sweep ? 0 : 1;
	return [
		`M ${startOuter.x} ${startOuter.y}`,
		`A ${outer} ${outer} 0 ${largeArc} ${sweep} ${endOuter.x} ${endOuter.y}`,
		`L ${endInner.x} ${endInner.y}`,
		`A ${inner} ${inner} 0 ${largeArc} ${innerSweep} ${startInner.x} ${startInner.y}`,
		'Z',
	].join(' ');
}

function moiraThetaFromDegree(degree){
	return 30 - Number(degree || 0);
}

// 黄赤交角(度)按纪元世纪数 T 取平黄赤交角(IAU 1980 主项;宿界悬浮显示够精,历史盘也随年份变)。
function moiraObliquityDeg(chart){
	let year = 2000;
	const bz = chart && chart.nongli && chart.nongli.bazi;
	if(bz && bz.year && Number(bz.year.year)){ year = Number(bz.year.year); }
	const T = (year - 2000) / 100;
	return 23.4392911 - 0.0130042 * T - 0.00000016 * T * T + 0.0000005036 * T * T * T;
}
// 大圆上一点(定坐标纬度=0)另一坐标经度:atan2(cosε·sinθ, cosθ)。黄仪宿界(黄纬0):黄经→真赤经;赤仪宿界(赤纬0):赤经→真黄经。
function eclEquConvertDeg(deg, epsDeg){
	const rad = Number(deg) * Math.PI / 180;
	const eps = Number(epsDeg) * Math.PI / 180;
	const out = Math.atan2(Math.cos(eps) * Math.sin(rad), Math.cos(rad)) * 180 / Math.PI;
	return ((out % 360) + 360) % 360;
}

function sectorTheta(index){
	return -15 - 30 * index;
}

function radialLine(theta, inner, outer, opt = {}){
	const a = point(inner, theta);
	const b = point(outer, theta);
	return (
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			stroke={opt.color || BLACK}
			strokeWidth={opt.width || 1}
			opacity={opt.opacity === undefined ? 1 : opt.opacity}
			strokeDasharray={opt.dash || undefined}
		/>
	);
}

function connectorLine(markTheta, labelTheta, inner, outer, dir, opt = {}){
	const band = Math.max(1, outer - inner);
	const length = Math.max(7, Math.min(14, opt.length || band * 0.22));
	const startRadius = dir >= 0 ? outer : inner;
	const endRadius = dir >= 0 ? outer - length : inner + length;
	const a = point(startRadius, markTheta);
	const b = point(endRadius, labelTheta);
	return (
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			stroke={opt.color || BLACK}
			strokeWidth={opt.width || 1}
			opacity={opt.opacity === undefined ? 1 : opt.opacity}
		/>
	);
}

// Moira aspects 双引线(ChartData 行星段 drawLine 同款几何;aspects_birth_sign_ring_dir=0=双线):
// 上线=带外界@真实度数 → 字外端@标签(指向外侧度数刻度);下线=带内界@真实度数 → 字内端@标签
// (视觉指向锚点圆)。标签被推挤(shift)时两线自动变斜指回真实度数 —— 星体密集时的自适应。
function aspectsPlanetLeads(markTheta, labelTheta, bandInner, bandOuter, textRadius, halfText, opt = {}){
	const segs = [
		[point(bandOuter, markTheta), point(textRadius + halfText, labelTheta)],
		[point(bandInner, markTheta), point(textRadius - halfText, labelTheta)],
	];
	return segs.map(([a, b], i)=>(
		<line key={`asp-lead-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={opt.color || BLACK} strokeWidth={opt.width || 1.05} />
	));
}

function cleanText(text){
	return `${text || ''}`.replace(/\s+/g, '');
}

function formatGodName(name){
	let val = cleanText(name);
	if(!val){
		return '';
	}
	val = val.split(/[\/／]/)[0];
	const aliases = {
		天乙贵人: '天贵',
		玉堂贵人: '玉贵',
	};
	return aliases[val] || val;
}

function splitColumns(text, maxPerCol){
	const raw = cleanText(text);
	if(!raw){
		return [];
	}
	if(raw.indexOf('|') >= 0){
		return raw.split('|').filter(Boolean);
	}
	const cols = [];
	for(let i = 0; i < raw.length; i += maxPerCol){
		cols.push(raw.slice(i, i + maxPerCol));
	}
	return cols;
}

function verticalText(text, x, y, opt = {}){
	const size = opt.size || 22;
	const gap = opt.gap || size * 1.02;
	const maxPerCol = opt.maxPerCol || 5;
	const cols = splitColumns(text, maxPerCol);
	const colGap = opt.colGap || size * 0.92;
	const fill = opt.color || BLACK;
	const weight = opt.weight || 400;
	const opacity = opt.opacity === undefined ? 1 : opt.opacity;
	const nodes = [];
	cols.forEach((col, colIdx)=>{
		const chars = Array.from(col);
		const startY = y - (chars.length - 1) * gap / 2;
		const colX = x + (cols.length - 1) * colGap / 2 - colIdx * colGap;
		chars.forEach((ch, i)=>{
			const textProps = {
				x: colX,
				y: startY + i * gap,
				fontSize: size,
				fontWeight: weight,
				textAnchor: 'middle',
				dominantBaseline: 'central',
				opacity,
			};
			nodes.push(
				<text
					key={`${text}-${colIdx}-${i}-${x}-${y}`}
					{...textProps}
					fill={fill}
				>
					{ch}
				</text>
			);
		});
	});
	return nodes;
}

function horizontalRingText(text, radius, theta, opt = {}){
	const p = point(radius, theta);
	const rotate = tangentRotate(theta);
	return (
		<text
			x={p.x}
			y={p.y}
			fill={opt.color || BLACK}
			fontSize={opt.size || 22}
			fontWeight={opt.weight || 400}
			fontFamily={opt.family || undefined}
			textAnchor="middle"
			dominantBaseline="central"
			transform={opt.upright ? undefined : `rotate(${rotate} ${p.x} ${p.y})`}
		>
			{text}
		</text>
	);
}

function pairedRadialText(text, theta, inner, outer, opt = {}){
	const chars = Array.from(cleanText(text));
	if(!chars.length){
		return null;
	}
	const band = Math.max(1, outer - inner);
	const branch = chars.slice(1).join('');
	const items = [
		{key: 'outer', value: chars[0], radius: inner + band * 0.68},
		{key: 'inner', value: branch || chars[1] || '', radius: inner + band * 0.34},
	].filter((item)=>item.value);
	return (
		<g className="moira-paired-radial-text">
			{items.map((item)=>{
				const p = point(item.radius, theta);
				return (
					<text
						key={`${text}-${item.key}-${theta}`}
						x={p.x}
						y={p.y}
						fill={item.key === 'outer' ? (opt.primaryColor || opt.color || BLACK) : (opt.secondaryColor || opt.color || BLACK)}
						fontSize={opt.size || 22}
						fontWeight={opt.weight || 600}
						textAnchor="middle"
						dominantBaseline="central"
					>
						{item.value}
					</text>
				);
			})}
		</g>
	);
}

function radialStackText(text, theta, inner, outer, opt = {}){
	const chars = Array.from(cleanText(text));
	if(!chars.length){
		return [];
	}
	const size = opt.size || 24;
	const step = opt.step || size * 1.04;
	const usableOuter = outer - size * 0.5;
	const usableInner = inner + size * 0.5;
	const stackHeight = (chars.length - 1) * step;
	const start = Math.min(usableOuter, (usableInner + usableOuter + stackHeight) / 2);
	const fill = opt.color || GREEN;
	const weight = opt.weight || 600;
	const opacity = opt.opacity === undefined ? 1 : opt.opacity;
	return chars.map((ch, idx)=>{
		const p = point(start - idx * step, theta);
		return (
			<text
				key={`${text}-${theta}-${idx}`}
				x={p.x}
				y={p.y}
				fill={fill}
				fontSize={size}
				fontWeight={weight}
				textAnchor="middle"
				dominantBaseline="central"
				opacity={opacity}
			>
				{ch}
			</text>
		);
	});
}

function radialColumns(items, centerTheta, inner, outer, opt = {}){
	const list = (items || []).filter(Boolean);
	if(!list.length){
		return [];
	}
	const arc = opt.arc || 24;
	const maxStep = opt.maxStep || 5.2;
	const minStep = opt.minStep || 2.8;
	const rawStep = list.length <= 1 ? 0 : arc / (list.length - 1);
	const step = list.length <= 1 ? 0 : (
		opt.fitArc ? Math.min(maxStep, rawStep) : Math.max(minStep, Math.min(maxStep, rawStep))
	);
	const start = centerTheta + step * (list.length - 1) / 2;
	const nodes = [];
	list.forEach((item, idx)=>{
		const theta = start - idx * step;
		nodes.push(...radialStackText(item, theta, inner, outer, opt));
	});
	return nodes;
}

function godTextSize(count){
	if(count > 22){
		return 11;
	}
	if(count > 18){
		return 13;
	}
	if(count > 14){
		return 15;
	}
	if(count > 10){
		return 17;
	}
	if(count > 6){
		return 19;
	}
	return 21;
}

function godColumnStep(count){
	if(count > 22){
		return {minStep: 0.9, maxStep: 1.25, arc: 27};
	}
	if(count > 18){
		return {minStep: 1.1, maxStep: 1.55, arc: 27};
	}
	if(count > 14){
		return {minStep: 1.35, maxStep: 1.9, arc: 27};
	}
	if(count > 10){
		return {minStep: 1.8, maxStep: 2.7, arc: 27};
	}
	return {minStep: 2.7, maxStep: 5.1, arc: 25};
}

function objectRa(obj, preferLon = false){
	const num = Number(obj && (preferLon && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon)));
	return Number.isFinite(num) ? num : null;
}

function isZhengSiderealChart(chart){
	const params = chart && chart.params ? chart.params : {};
	return Number(params.doubingSu28) === 4 || Number(params.guolaoZhengSidereal) === 1;
}

// 黄仪/赤仪显示口径(单一真值源=chart.displayCoord,python 按宿度制 byLon/byRA 分派宣告):
// 黄仪(回归今宿/开禧/恒星制/授时历古法)→全黄经显示;赤仪(荀爽/斗柄/赤道恒星/赤道回归)→全赤经。
// 旧 chart 无该字段时回退旧判据(仅恒星制郑式=黄经),平滑兼容。
function isEclipticDisplayChart(chart){
	const coord = chart && chart.displayCoord;
	if(coord === 'ecliptic'){ return true; }
	if(coord === 'equatorial'){ return false; }
	return isZhengSiderealChart(chart);
}

function signIndexFromDegree(degree){
	return Math.floor(norm(degree) / 30) % 12;
}

function dmsText(value){
	let val = Number(value);
	if(!Number.isFinite(val)){
		return '';
	}
	val = ((val % 30) + 30) % 30;
	let deg = Math.floor(val);
	const minFloat = (val - deg) * 60;
	let min = Math.floor(minFloat);
	let sec = Math.round((minFloat - min) * 60);
	if(sec >= 60){
		sec = 0;
		min += 1;
	}
	if(min >= 60){
		min = 0;
		deg += 1;
	}
	return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″`;
}

// 宿内度专用度分秒(不做 %30 折叠——宿距可超 30°,如井宿 33°)。
function suDmsText(value){
	let val = Number(value);
	if(!Number.isFinite(val)){
		return '';
	}
	val = ((val % 360) + 360) % 360;
	let deg = Math.floor(val);
	const minFloat = (val - deg) * 60;
	let min = Math.floor(minFloat);
	let sec = Math.round((minFloat - min) * 60);
	if(sec >= 60){ sec = 0; min += 1; }
	if(min >= 60){ min = 0; deg += 1; }
	return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″`;
}

// 宿内度:显示度 − 所落宿的界起点(宿界表与显示度同口径,displayCoord 保证同体系)。
// 无宿界表回退 null(调用方退回旧行为)。
function suOffsetText(degree, stars){
	if(!stars || !stars.length){
		return null;
	}
	const d = norm(degree);
	let bound = null;
	for(let i = 0; i < stars.length; i++){
		const r = Number(stars[i].ra);
		if(!Number.isFinite(r)){ continue; }
		if(r <= d && (bound === null || r > bound)){ bound = r; }
	}
	if(bound === null){
		let maxR = null;
		stars.forEach((s)=>{ const r = Number(s.ra); if(Number.isFinite(r) && (maxR === null || r > maxR)){ maxR = r; } });
		if(maxR === null){ return null; }
		bound = maxR - 360;
	}
	return suDmsText(d - bound);
}

function speedText(obj){
	const speed = planetSpeed(obj);
	const sign = speed >= 0 ? '+' : '-';
	return `${sign}${Math.abs(speed).toFixed(4)}`;
}

// 黄经 cusps→显示度(主盘/择日盘共用)。黄仪:直用真黄经(与全部环同口径,零变换)。
// 赤仪:各环画 ra(升=赤道上升 ascmc[4]、顶/降/底=带上升黄纬的投影、行星=真赤经——
// 三种变换并存,黄经无全局变换可同时钉住四轴),故四轴宫头(1/4/7/10)直接取 chart
// Asc/IC/Desc/MC 的 ra(与「升/顶」标同源严格同度),中间宫头按黄经比例在象限内插;
// 非象限制(等宫等)退化为整体平移钉 1 宫头。
function mapCuspsToDisplay(cusps, chart){
	if(isEclipticDisplayChart(chart)){
		return cusps;
	}
	const axes = [AstroConst.ASC, AstroConst.IC, AstroConst.DESC, AstroConst.MC].map((id)=>findObject(chart, id));
	if(!axes.every((a)=>a && Number.isFinite(Number(a.lon)) && Number.isFinite(Number(a.ra)))){
		return cusps;
	}
	const axLon = axes.map((a)=>norm(Number(a.lon)));
	const axRa = axes.map((a)=>norm(Number(a.ra)));
	const near = (a, b)=>Math.abs(((a - b + 540) % 360) - 180) < 0.02;
	if(!near(cusps[0], axLon[0]) || !near(cusps[9], axLon[3])){
		const shift = axRa[0] - cusps[0];
		return cusps.map((c)=>norm(c + shift));
	}
	const AXIS_OF_CUSP = [0, -1, -1, 1, -1, -1, 2, -1, -1, 3, -1, -1];
	return cusps.map((c, k)=>{
		const axisIdx = AXIS_OF_CUSP[k];
		if(axisIdx >= 0){
			return axRa[axisIdx];
		}
		const q = Math.floor(k / 3);
		const lonA = axLon[q];
		const raA = axRa[q];
		const raB = axRa[(q + 1) % 4];
		const lonSpan = ((axLon[(q + 1) % 4] - lonA) % 360 + 360) % 360 || 360;
		const raSpan = ((raB - raA) % 360 + 360) % 360 || 360;
		const ratio = (((c - lonA) % 360 + 360) % 360) / lonSpan;
		return norm(raA + ratio * raSpan);
	});
}

function listText(items, empty = '无'){
	const list = (items || []).filter(Boolean);
	return list.length ? list.join('、') : empty;
}

function uniquePush(list, val){
	if(!val || list.indexOf(val) >= 0){
		return;
	}
	list.push(val);
}

// 宿短名(角/心/氐…)→ 宿+五行 全名(角木/心月/氐土…)。FULL_STELLAR 为固定 28 宿序(娄起),
// 而 chart.fixedStarSu28 按升度排序(起点随宿度制漂),二者位序不通用 —— 必须按名映射,不可拿位序直切。
function fullStellarByName(name){
	const i = HALF_STELLAR.indexOf(name);
	return i >= 0 ? FULL_STELLAR[i] : (name || '');
}
// 宿的度主(五行字):由真实宿名取全名后截尾一字。
function starHostByName(name){
	const full = fullStellarByName(name);
	return full.length > 1 ? full.slice(1) : '';
}

function stellarIndexForDegree(stars, degree){
	const value = norm(degree);
	let found = -1;
	for(let i = 0; i < stars.length; i++){
		const start = norm(stars[i].ra);
		const end = norm(stars[(i + 1) % stars.length].ra);
		if(start <= end){
			if(value >= start && value < end){
				found = i;
				break;
			}
		}else if(value >= start || value < end){
			found = i;
			break;
		}
	}
	return found;
}

function buildStellarRelations(chart){
	const stars = buildFixedStars(chart);
	const rows = stars.map((star, idx)=>({
		index: idx,
		name: star.name || HALF_STELLAR[idx] || '',
		label: star.label || FULL_STELLAR[idx] || star.name || '',
		// 度主(五行)按真实宿名取,不能拿 fixedStarSu28 位序直切 FULL_STELLAR(会错宿)。
		host: starHostByName(star.name || HALF_STELLAR[idx] || ''),
		main: [],
		same: [],
	}));
	const objects = chart && chart.objects ? chart.objects : [];
	const preferLon = isEclipticDisplayChart(chart);
	PLANET_DEFS.forEach((def)=>{
		const obj = objects.find((one)=>one.id === def.id);
		const degree = objectRa(obj, preferLon);
		if(!obj || degree === null){
			return;
		}
		const idx = stellarIndexForDegree(stars, degree);
		if(idx < 0 || !rows[idx]){
			return;
		}
		uniquePush(rows[idx].main, def.label);
		const host = rows[idx].host;
		if(!host){
			return;
		}
		rows.forEach((row, rowIdx)=>{
			if(rowIdx !== idx && row.host === host){
				uniquePush(row.same, def.label);
			}
		});
	});
	return rows;
}

function mergeStellarRelationRows(birthChart, transitChart){
	const birth = buildStellarRelations(birthChart);
	const transit = transitChart ? buildStellarRelations(transitChart) : [];
	return birth.map((row, idx)=>({
		...row,
		transitMain: transit[idx] ? transit[idx].main : [],
		transitSame: transit[idx] ? transit[idx].same : [],
	}));
}

function findRulePlanet(rules, item){
	const label = item && item.label;
	const id = item && item.id;
	return (rules && rules.planets ? rules.planets : []).find((row)=>row && (row.id === id || row.name === label)) || null;
}

function findYearPlanetRow(rules, item, kind){
	const yearStars = rules && rules.yearStars ? rules.yearStars : {};
	const key = kind === 'birth' ? 'birth' : 'transit';
	const bucket = yearStars[key] || {};
	const rows = bucket.planetRows || [];
	const label = item && item.label;
	return rows.find((row)=>row && row.star === label) || null;
}

function yearSignRowsForPlanet(rules, item, kind){
	const rows = kind === 'birth'
		? (rules && rules.natalYearStars ? rules.natalYearStars : [])
		: (rules && rules.transitYearStars ? rules.transitYearStars : []);
	const label = item && item.label;
	return rows.filter((row)=>row && row.star === label);
}

function yearSignRowForZi(rules, zi, kind){
	const rows = kind === 'birth'
		? (rules && rules.natalYearStars ? rules.natalYearStars : [])
		: (rules && rules.transitYearStars ? rules.transitYearStars : []);
	return rows.find((row)=>row && row.zi === zi) || null;
}

function weakSolidRowForZi(rules, zi){
	const weakSolid = rules && rules.weakSolid ? rules.weakSolid : {};
	const rows = weakSolid.houses || [];
	return rows.find((row)=>row && row.zi === zi) || null;
}

function weakSolidText(row){
	if(!row){
		return '';
	}
	if(row.label){
		return row.label;
	}
	const parts = [];
	if(row.weak){
		parts.push(`虚${listText(row.weakPillars, '')}`);
	}
	if(row.solid){
		parts.push(`实${listText(row.solidPillars, '')}`);
	}
	return parts.join('、');
}

// 黄经/赤经的十二宫制读数(悬浮行专用):宫内整度+地支(七政镜像 白羊=戌)+分,
// 括号内 360° 十进制;格式「12子08（312.14）」。
const ZHI_SEQ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function zhiDegText(deg){
	const d = norm(Number(deg));
	if(!Number.isFinite(d)){
		return '—';
	}
	const signIdx = Math.floor(d / 30) % 12;
	const zhi = ZHI_SEQ[(10 - signIdx + 12) % 12];
	const inSign = d - signIdx * 30;
	let whole = Math.floor(inSign);
	let mins = Math.round((inSign - whole) * 60);
	if(mins === 60){ whole += 1; mins = 0; }
	return `${whole}${zhi}${String(mins).padStart(2, '0')}（${d.toFixed(2)}）`;
}

function objectTooltip(item, kind, rules, suStars){
	const degree = norm(item.degree);
	const signIdx = signIndexFromDegree(degree);
	const inSign = degree - signIdx * 30;
	const su = item.obj && item.obj.su28 ? item.obj.su28 : '';
	// 宿内度=显示度−宿界起点(suStars=当前宿度制宿界,与显示度同口径);无表回退星座内度(旧行为)。
	const suDeg = suOffsetText(degree, suStars);
	const label = item.label || item.name || item.id;
	const layer = kind === 'birth' ? '本命' : '流年';
	const rulePlanet = kind === 'birth' ? findRulePlanet(rules, item) : null;
	const yearPlanet = findYearPlanetRow(rules, item, kind);
	const yearSignRows = yearSignRowsForPlanet(rules, item, kind);
	const lines = [
		`${label}（${layer}）：${su ? `${su} ${suDeg || dmsText(inSign)}` : ''}；${SIGN_NAMES[signIdx]} ${dmsText(inSign)}`,
		`黄经：${zhiDegText(item.obj && item.obj.lon)}；赤经：${zhiDegText(item.obj && item.obj.ra)}`,
		`速度：${speedText(item.obj)}`,
	];
	if(yearPlanet){
		const change = yearPlanet.changeTo || '';
		const items = listText(yearPlanet.items, '');
		lines.push(`化曜：${change || '—'}${items ? `（${items}）` : ''}`);
	}
	if(yearSignRows.length){
		lines.push(`所临命曜：${yearSignRows.map((row)=>`${row.name}${row.shortName ? `·${row.shortName}` : ''}`).join('、')}`);
	}
	if(rulePlanet){
		lines.push(`宫位：${[rulePlanet.moiraHouse, rulePlanet.zi, rulePlanet.area || rulePlanet.signName].filter(Boolean).join(' · ')}`);
		if(rulePlanet.dignity){
			lines.push(`虚实：${rulePlanet.dignity}`);
		}
	}
	return lines.filter(Boolean).join('\n');
}

function signTooltip(zi, houseName, sameText, rules, gods){
	const row = yearSignRowForZi(rules, zi, 'birth');
	const weakSolid = weakSolidRowForZi(rules, zi);
	const lines = [
		`${zi}：${houseName}；同经：${sameText}`,
		row ? `命曜：${row.star || '—'} ${row.shortName || ''}${row.quality ? `；${row.quality}` : ''}` : '',
		weakSolid ? `虚实：${weakSolidText(weakSolid) || '无'}` : '',
		gods && gods.length ? `神煞：${listText(gods)}` : '',
	];
	return lines.filter(Boolean).join('\n');
}

// 虚实标记(与择日盘同款方案):放支扇形外侧两个角落(贴带外界内缩 13)——
// 虚宫「−」红在扇区顺时针端角(中心 −10.5°=端边 +4.5°)、实宫「+」绿在另一端角(+10.5°)。
function weakSolidMarkers(row, theta, inner, outer){
	if(!row || (!row.weak && !row.solid)){
		return null;
	}
	const radius = outer - 13;
	const nodes = [];
	if(row.weak){
		const p = point(radius, theta - 10.5);
		nodes.push(
			<text key={`ws-weak-${theta}`} x={p.x} y={p.y} fill={RED} fontSize={16} fontWeight={700} textAnchor="middle" dominantBaseline="central">−</text>
		);
	}
	if(row.solid){
		const p = point(radius, theta + 10.5);
		nodes.push(
			<text key={`ws-solid-${theta}`} x={p.x} y={p.y} fill={GREEN} fontSize={16} fontWeight={700} textAnchor="middle" dominantBaseline="central">+</text>
		);
	}
	return <g className="moira-weak-solid-markers" pointerEvents="none">{nodes}</g>;
}

function objectsNearDegree(chart, degree, tolerance = 1.2){
	const objects = chart && chart.objects ? chart.objects : [];
	return PLANET_DEFS.map((def)=>{
		const obj = objects.find((item)=>item.id === def.id);
		const ra = objectRa(obj);
		if(!obj || ra === null || circularGap(ra, degree) > tolerance){
			return null;
		}
		return def.label;
	}).filter(Boolean);
}

function findObject(chart, id){
	const objects = chart && chart.objects ? chart.objects : [];
	return objects.find((obj)=>obj.id === id);
}

function planetSpeed(obj){
	const speed = Number(obj && (obj.lonspeed !== undefined ? obj.lonspeed : obj.speed));
	return Number.isFinite(speed) ? speed : 0;
}

function planetColor(obj, baseColor, dignity){
	const speed = planetSpeed(obj);
	if(speed < -0.000001){
		return RED;
	}
	if(Math.abs(speed) < 0.002){
		return MAGENTA;
	}
	if(dignity){
		if(DIGNITY_STRONG.indexOf(dignity) >= 0){
			return DIGNITY_GOLD;
		}
		if(DIGNITY_WEAK.indexOf(dignity) >= 0){
			return DIGNITY_WEAK_COLOR;
		}
	}
	return baseColor;
}

function circularGap(a, b){
	const diff = Math.abs(norm(a) - norm(b));
	return Math.min(diff, 360 - diff);
}

function clusterPlanetItems(items, threshold){
	if(items.length <= 1){
		return items.length ? [items] : [];
	}
	const groups = [];
	let current = [items[0]];
	for(let i = 1; i < items.length; i++){
		if(items[i].degree - items[i - 1].degree <= threshold){
			current.push(items[i]);
		}else{
			groups.push(current);
			current = [items[i]];
		}
	}
	groups.push(current);
	if(groups.length > 1){
		const first = groups[0];
		const last = groups[groups.length - 1];
		if(circularGap(first[0].degree, last[last.length - 1].degree) <= threshold){
			groups[0] = last.concat(first);
			groups.pop();
		}
	}
	return groups;
}

function resolveLabelDegrees(group, minGap){
	if(group.length <= 1){
		return group.map((item)=>({
			...item,
			labelDegree: item.degree,
		}));
	}
	const desired = [];
	let prev = null;
	group.forEach((item)=>{
		let degree = item.degree;
		if(prev !== null){
			while(degree < prev){
				degree += 360;
			}
		}
		desired.push(degree);
		prev = degree;
	});
	const labels = desired.slice();
	for(let i = 1; i < labels.length; i++){
		if(labels[i] - labels[i - 1] < minGap){
			labels[i] = labels[i - 1] + minGap;
		}
	}
	const desiredCenter = desired.reduce((sum, val)=>sum + val, 0) / desired.length;
	const labelCenter = labels.reduce((sum, val)=>sum + val, 0) / labels.length;
	const shift = desiredCenter - labelCenter;
	return group.map((item, idx)=>({
		...item,
		labelDegree: norm(labels[idx] + shift),
	}));
}

function planetPlacements(chart, inner, outer, dir, size, preferLon = false, defs = PLANET_DEFS, lockIds = null){
	const objects = chart && chart.objects ? chart.objects : [];
	const items = defs.map((def, order)=>{
		const obj = objects.find((item)=>item.id === def.id);
		const degree = objectRa(obj, preferLon);
		if(!obj || degree === null){
			return null;
		}
		return {
			...def,
			order,
			obj,
			degree: norm(degree),
		};
	}).filter(Boolean).sort((a, b)=>a.degree - b.degree || a.order - b.order);
	const center = (inner + outer) / 2;
	const band = Math.max(1, outer - inner);
	const pad = Math.min(18, Math.max(4, band / 3));
	const preferredRadius = center + dir * Math.min(4, band / 8);
	const safeRadius = Math.max(inner + pad, Math.min(outer - pad, preferredRadius));
	const minGap = Math.max(5.6, Math.min(12.5, (size || 30) / Math.max(180, safeRadius) * 180 / Math.PI * 1.35));
	// 防重叠 + 居中:星体落两环线几何中心半径;切向错位用【全局保序推挤】(resolveRingShifts,
	// 与动盘同一算法):任意两星的盘面顺序严格等于真实度数顺序——旧分簇法簇间平移会交错,
	// 导致部分宫位内行星顺序颠倒(每宫方向不一),已废弃。真实度数由 connectorLine 径向指回。
	// lockIds(按曜 id)→ 推挤锁定下标(Moira sign_lock:aspects 模式升/顶钉原位,其余星绕行)。
	const lockedIdx = lockIds ? new Set(items.map((item, idx)=>(lockIds.has(item.id) ? idx : -1)).filter((v)=>v >= 0)) : null;
	const shifted = resolveRingShifts(items.map((item)=>item.degree), minGap, lockedIdx);
	return items.map((item, idx)=>({
		...item,
		labelDegree: shifted[idx],
		radius: center,
	})).sort((a, b)=>a.degree - b.degree || a.order - b.order);
}

function lifeModeFromFields(fields){
	if(fields && fields.guolaoLifeMode && fields.guolaoLifeMode.value !== undefined && fields.guolaoLifeMode.value !== null){
		return normalizeGuolaoLifeMode(fields.guolaoLifeMode.value);
	}
	return getStoredGuolaoLifeMode();
}

function lifeDegree(chart, fields, forceLon){
	const life = findObject(chart, AstroConst.LIFEMASTERDEG74);
	const asc = findObject(chart, AstroConst.ASC);
	const sun = findObject(chart, AstroConst.SUN);
	const lifeMode = lifeModeFromFields(fields);
	// R: 除「占星上升」外(asc 直接用上升点),日出/赤黄/古法遇卯/自定命宫(地支)均以 BaZi 算出的 LifeMasterDeg74 为命度起宫。
	const useLifeMaster = lifeMode !== GUOLAO_LIFE_MODE_ASC;
	// forceLon=true:恒取黄经命度(供 12 宫/地支/小限飞限用,宫位系黄道划分,不随宿度制显示坐标变)。
	const preferLon = forceLon === true ? true : isEclipticDisplayChart(chart);
	const primary = useLifeMaster ? objectRa(life, preferLon) : objectRa(asc, preferLon);
	const secondary = useLifeMaster ? objectRa(asc, preferLon) : objectRa(life, preferLon);
	const val = primary !== null ? primary : (secondary !== null ? secondary : objectRa(sun, preferLon));
	return val === null ? 0 : val;
}
// 黄经命度(命宫/地支/小限飞限专用,永远黄道)。
function lifeLonDegree(chart, fields){
	return lifeDegree(chart, fields, true);
}

function sectorIndexFromSignIndex(signIndex){
	return ((Number(signIndex || 0) - 1) % 12 + 12) % 12;
}

function houseIndexForSector(sectorIdx, life){
	const signIndex = Math.floor(norm(life) / 30);
	const lifeSector = sectorIndexFromSignIndex(signIndex);
	return (sectorIdx - lifeSector + 12) % 12;
}

// 童限年数(限度度数推进用·不四舍)= childYearsSpan(guolaoMoiraTables 单一真值源,与飞限/童限四舍边界勿混)。

// 🔴 百六大限锚点(照 Moira getLimitDegree 第 3921 行:degree_offset = floor(life_sign_pos/30)*30 + 30)。
// = 命宫「整宫界」(30° 对齐)的高边界,而非精确命度 —— Moira 的 1 岁起于此宫界,非命度!
// 旧版误锚在精确命度,故整盘偏 (30 − 命度宫内度) 度(用户实测发现)。
function limitAnchor(life){
	return norm(Math.floor(norm(Number(life || 0)) / 30) * 30 + 30);
}

// 限度逐宫年数:首宫=童限(不四舍,base 由定童限 9/10),其余=limit_seq[1..11](照 Moira addChildYearToBirthDate / limit_seq[i])。
function limitSegments(life, childBase){
	return [childYearsSpan(life, childBase)].concat(LIMIT_SEQ.slice(1));
}

// 🔴 出生日在其「年界」内已历的年分数 birthFrac(照 Moira getLimitDegree 第 3901 行 val=age-1-birthFrac)。
// Moira 年界硬编码=公历元旦(calendar/work_cal 均 GregorianCalendar,非节气);frac=(出生Ms − 当年1/1Ms)/一年。
// mode:'gregorian'(公历元旦,Moira 默认)/'lichun'(立春)/'dongzhi'(冬至);后二者用 chart.nongli 节气日,缺则回退元旦。
function birthYearFraction(chart, fields, mode){
	let Y; let Mo; let D; let h = 0; let mi = 0; let s = 0;
	const pd = chart && chart.params && chart.params.date;
	const pt = chart && chart.params && chart.params.time;
	if(pd){ const m = `${pd}`.match(/(-?\d+)\D+(\d+)\D+(\d+)/); if(m){ Y = +m[1]; Mo = +m[2]; D = +m[3]; } }
	if(pt){ const m = `${pt}`.match(/(\d+):(\d+)(?::(\d+))?/); if(m){ h = +m[1]; mi = +m[2]; s = +(m[3] || 0); } }
	if(!Number.isFinite(Y) && fields && fields.date && fields.date.value && typeof fields.date.value.year === 'function'){
		const dv = fields.date.value;
		Y = dv.year(); Mo = dv.month() + 1; D = dv.date();
		const tv = fields.time && fields.time.value;
		if(tv && typeof tv.hour === 'function'){ h = tv.hour(); mi = tv.minute(); s = tv.second(); }
	}
	// 🔴 第三来源(最可靠·后端排盘产出):chart.date = {jd, date:{jdn}, time:{value}, utcoffset:{value}}。
	// wheel 收到的 chart 常无 params(root.params 缺→graft 落空)、fields.date.value 也非 moment,
	// 前两路都取不到出生日 → birthFrac 静默算成 0 → 百六大限整体差 1 岁(寅卯宫界/环最大岁数)。
	// jd 为 UT 儒略日,+utcoffset 得当地墙钟毫秒(以 UTC 读取即当地历字段),照 Moira work_cal(当地时区)。
	if(!Number.isFinite(Y) && chart && chart.date && Number.isFinite(Number(chart.date.jd))){
		const jd = Number(chart.date.jd);
		const off = chart.date.utcoffset && Number.isFinite(Number(chart.date.utcoffset.value)) ? Number(chart.date.utcoffset.value) : 0;
		const localMs = (jd - 2440587.5) * 86400000 + off * 3600000;
		if(Number.isFinite(localMs)){
			const d = new Date(localMs);
			Y = d.getUTCFullYear(); Mo = d.getUTCMonth() + 1; D = d.getUTCDate();
			h = d.getUTCHours(); mi = d.getUTCMinutes(); s = d.getUTCSeconds();
		}
	}
	if(!Number.isFinite(Y) || !Number.isFinite(Mo) || !Number.isFinite(D)){ return 0; }
	const MS_YEAR = 365.25 * 24 * 60 * 60 * 1000;
	const birthMs = Date.UTC(Y, Mo - 1, D, h, mi, s);
	// 年界起点(默认公历元旦;立春/冬至由 solarTermBoundaryMs 提供,缺则元旦)。
	let boundaryMs = Date.UTC(Y, 0, 1, 0, 0, 0);
	if(mode === 'lichun' || mode === 'dongzhi'){
		const b = solarTermBoundaryMs(chart, Y, birthMs, mode);
		if(Number.isFinite(b)){ boundaryMs = b; }
	}
	let frac = (birthMs - boundaryMs) / MS_YEAR;
	if(!Number.isFinite(frac)){ return 0; }
	// 归一到 [0,1)(立春/冬至基准时出生可能落在年界前)。
	frac = ((frac % 1) + 1) % 1;
	return frac;
}

// 立春/冬至 年界毫秒(增强项;取 chart.nongli 提供的节气日,缺则返回 NaN 让调用方回退公历元旦)。
function solarTermBoundaryMs(chart, year, birthMs, mode){
	const jq = chart && chart.nongli && (chart.nongli.jieqi || chart.nongli.solarTerms);
	if(!jq){ return NaN; }
	// 约定:jq.lichun / jq.dongzhi 为 'YYYY/MM/DD HH:mm' 或毫秒;取「出生日所属的年界」(≤出生Ms 的最近一次)。
	const parse = (v)=>{
		if(v == null){ return NaN; }
		if(typeof v === 'number'){ return v; }
		const m = `${v}`.match(/(-?\d+)\D+(\d+)\D+(\d+)(?:\D+(\d+)\D+(\d+))?/);
		return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
	};
	const key = mode === 'dongzhi' ? 'dongzhi' : 'lichun';
	let ms = parse(jq[key]);
	if(!Number.isFinite(ms)){ return NaN; }
	// 冬至属上一年年末:若节气日在出生之后,回退一年(近似,精确值仍由 chart 提供为准)。
	if(ms > birthMs){ ms -= 365.25 * 24 * 60 * 60 * 1000; }
	return ms;
}

// 自锚点起累计的度偏移 s(照 Moira getLimitDegree:val = age − 1 − birthFrac,逐宫消耗 segment 年数,宫内 30° 线性)。
// birthFrac 缺省 0 → 与旧版零回归;childBase 缺省 9(定童限 九年起)。
function limitAgeOffset(life, age, birthFrac, childBase){
	const segments = limitSegments(life, childBase);
	let rest = Number(age || 1) - 1 - (Number(birthFrac) || 0);
	let offset = 0;
	for(let i = 0; i < segments.length; i++){
		const span = Math.max(0.1, segments[i]);
		if(rest < span){  // 照 Moira nowYearPosition 严格 <(ChartData.java:3906);= 时归下一宫界,元旦 00:00 出生盘不错位
			return offset + 30 * rest / span;
		}
		offset += 30;
		rest -= span;
	}
	return offset;  // 累计满 360(超百六大限总年数)
}

// 逆:度偏移 → 虚岁(含 birthFrac 回加,与 limitAgeOffset 对称,供宫界年份标签)。
function limitAgeAtOffset(life, offset, birthFrac, childBase){
	const segments = limitSegments(life, childBase);
	let rest = Math.max(0, Number(offset || 0));
	let years = 0;
	for(let i = 0; i < segments.length; i++){
		const span = Math.max(0.1, segments[i]);
		if(rest <= 30){
			years += rest / 30 * span;
			break;
		}
		years += span;
		rest -= 30;
	}
	return 1 + years + (Number(birthFrac) || 0);
}

// 限度黄经(度)= 锚点 − 累计偏移(Moira 反向排限:度数随岁增而减,pos = normalize(degree_offset − s))。
function limitDegreeForAge(life, age, birthFrac, childBase){
	return norm(limitAnchor(life) - limitAgeOffset(life, age, birthFrac, childBase));
}

// 度 → 自锚点的偏移(供年份标签逆算,与 limitDegreeForAge 同锚,保证宫界年份与刻度一致)。
function limitOffsetFromLife(life, degree){
	return norm(limitAnchor(life) - Number(degree || 0));
}

function limitYearForDegree(birthYear, life, degree, birthFrac, childBase){
	return birthYear + Math.floor(limitAgeAtOffset(life, limitOffsetFromLife(life, degree), birthFrac, childBase) - 1);
}

// 大限表（古度限度法，与年龄环同一套 limitSegments → 二者必然一致）：
// 自命宫起逐宫一段，每段年数取 limitSegments(life)，首段=命度入宫度推算。
function buildGuolaoLimitTable(life, birthYear, childBase){
	const segs = limitSegments(life, childBase);
	const rows = [];
	let age = 1;
	for(let k = 0; k < 12; k++){
		const span = Math.max(0.5, segs[k] || 0);
		const fromAge = Math.round(age);
		const toAge = Math.round(age + span) - 1;
		rows.push({
			index: k + 1,
			palace: HOUSE_BRANCH[k],
			years: Math.round(span * 10) / 10,
			fromAge,
			toAge,
			fromYear: birthYear + fromAge - 1,
			toYear: birthYear + toAge - 1,
		});
		age += span;
	}
	return rows;
}

function currentLimitIndex(rows, age){
	if(!Array.isArray(rows) || !Number.isFinite(age)){
		return -1;
	}
	for(let i = 0; i < rows.length; i++){
		if(age >= rows[i].fromAge && age <= rows[i].toAge){
			return i;
		}
	}
	return -1;
}

function tangentRotate(theta){
	let rotate = theta + 90;
	if(rotate > 90 || rotate < -90){
		rotate += 180;
	}
	return rotate;
}

function birthYearFrom(root, chart, fields){
	const fromParam = root && root.params && root.params.date;
	const fromField = fields && fields.date && fields.date.value && fields.date.value.format
		? fields.date.value.format('YYYY') : '';
	const raw = fromParam || fromField || '';
	const match = `${raw}`.match(/-?\d{3,4}/);
	if(match){
		return parseInt(match[0], 10);
	}
	const bazi = (root && root.nongli && root.nongli.bazi) || (chart && chart.nongli && chart.nongli.bazi);
	if(bazi && bazi.year && bazi.year.year){
		return Number(bazi.year.year);
	}
	return new Date().getFullYear();
}

function stemBranchForYear(year){
	const idx = ((Number(year) - 1984) % 60 + 60) % 60;
	return STEM_BRANCHES[idx] || '';
}

function getZiGods(root, chart){
	const rootGods = root && root.nongli && root.nongli.bazi && root.nongli.bazi.guolaoGods
		? root.nongli.bazi.guolaoGods.ziGods : null;
	const chartGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	return chartGods || rootGods || {};
}

function collectGods(ziGods, zi){
	const one = ziGods && ziGods[zi] ? ziGods[zi] : {};
	const raw = []
		.concat(one.goodGods || [])
		.concat(one.neutralGods || [])
		.concat(one.badGods || [])
		.concat(one.taisuiGods || []);
	const seen = new Set();
	const names = [];
	raw.forEach((item)=>{
		const val = formatGodName(item);
		if(!val || seen.has(val)){
			return;
		}
		seen.add(val);
		names.push(val);
	});
	return names;
}

// 神煞数据源=rules 引擎(godHits/transitGodHits,Moira prop 规则本尊,与筛选清单一一对应);
// 返回 null 表示 rules 未到(调用方回退历法 ziGods,渐进不空盘)。
function godsFromRuleHits(rules, zi, kind){
	const hits = rules ? (kind === 'transit' ? rules.transitGodHits : rules.godHits) : null;
	if(!hits || !hits.length){
		return null;
	}
	const one = hits.find((h)=>h && h.zi === zi) || {};
	const raw = [].concat(one.gods || [], one.goodGods || [], one.neutralGods || [], one.badGods || [], one.taisuiGods || []);
	const seen = new Set();
	const names = [];
	raw.forEach((item)=>{
		const val = formatGodName(item);
		if(val && !seen.has(val)){
			seen.add(val);
			names.push(val);
		}
	});
	return names;
}

// 十二长生字(照 Moira getStarSigns:本命/流年各按自家年柱纳音起)。
function longLifeCharFor(rules, zi, kind){
	const ys = (rules && rules.yearStars) || {};
	const ctx = kind === 'transit' ? ys.transit : ys.birth;
	const map = longLifeMapForYear(ctx && ctx.yearPole);
	return map ? (map[zi] || '') : '';
}

function orderedGods(items, orderList){
	const list = (items || []).map(formatGodName).filter(Boolean);
	if(!orderList || !orderList.length){
		return list;
	}
	const rank = new Map(orderList.map((name, idx)=>[name, idx]));
	return list.slice().sort((a, b)=>{
		const ar = rank.has(a) ? rank.get(a) : 999;
		const br = rank.has(b) ? rank.get(b) : 999;
		return ar - br || a.localeCompare(b, 'zh-Hans-CN');
	});
}

function buildFixedStars(chart){
	const src = chart && chart.fixedStarSu28 && chart.fixedStarSu28.length ? chart.fixedStarSu28 : null;
	if(src){
		return src.map((item, idx)=>{
			const ra = Number(item.ra);
			const lonRaw = Number(item.lon);
			return {
				name: item.name || HALF_STELLAR[idx] || '',
				label: item.name || FULL_STELLAR[idx] || HALF_STELLAR[idx] || '',
				ra,
				// 黄经:赤仪宿度制时与 ra(赤经)真值不同;黄仪时源侧 ra=lon(宿界沿黄道置),二者同值。
				lon: Number.isFinite(lonRaw) ? lonRaw : ra,
			};
		}).filter((item)=>Number.isFinite(item.ra));
	}
	return HALF_STELLAR.map((name, idx)=>({
		name,
		label: FULL_STELLAR[idx] || name,
		ra: idx * 360 / HALF_STELLAR.length,
		lon: idx * 360 / HALF_STELLAR.length,
	}));
}

class GuoLaoMoiraWheel extends Component{
	constructor(props){
		super(props);
		this.state = {
			tooltip: null,
			containerSide: 0,
		};
		this.containerRef = React.createRef();
		this.resizeObserver = null;
		this.measureContainer = this.measureContainer.bind(this);
		this.showTooltip = this.showTooltip.bind(this);
		this.moveTooltip = this.moveTooltip.bind(this);
		this.hideTooltip = this.hideTooltip.bind(this);
	}

	componentDidMount(){
		this.measureContainer();
		if(typeof ResizeObserver !== 'undefined' && this.containerRef.current){
			this.resizeObserver = new ResizeObserver(this.measureContainer);
			this.resizeObserver.observe(this.containerRef.current);
		}
		if(typeof window !== 'undefined'){
			window.addEventListener('resize', this.measureContainer);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.height !== this.props.height){
			this.measureContainer();
		}
	}

	componentWillUnmount(){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('resize', this.measureContainer);
		}
	}

	measureContainer(){
		const node = this.containerRef.current;
		if(!node){
			return;
		}
		const rect = node.getBoundingClientRect();
		const fallbackHeight = Number(this.props.height) || 740;
		const availableWidth = rect.width || node.clientWidth || fallbackHeight;
		const availableHeight = rect.height || node.clientHeight || fallbackHeight;
		const nextSide = Math.max(280, Math.floor(Math.min(availableWidth, availableHeight)));
		if(Number.isFinite(nextSide) && nextSide !== this.state.containerSide){
			this.setState({containerSide: nextSide});
		}
	}

	tooltipPoint(evt){
		const maxX = typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 440) : evt.clientX + 14;
		const maxY = typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 220) : evt.clientY + 16;
		return {
			x: Math.min(evt.clientX + 14, maxX),
			y: Math.min(evt.clientY + 16, maxY),
		};
	}

	showTooltip(text, evt){
		if(!text){
			return;
		}
		this.setState({
			tooltip: {
				...this.tooltipPoint(evt),
				text,
			},
		});
	}

	moveTooltip(evt){
		if(!this.state.tooltip){
			return;
		}
		this.setState({
			tooltip: {
				...this.state.tooltip,
				...this.tooltipPoint(evt),
			},
		});
	}

	hideTooltip(){
		if(this.state.tooltip){
			this.setState({
				tooltip: null,
			});
		}
	}

	tooltipHandlers(text){
		return {
			onMouseEnter: (evt)=>this.showTooltip(text, evt),
			onMouseOver: (evt)=>this.showTooltip(text, evt),
			onMouseMove: this.moveTooltip,
			onMouseLeave: this.hideTooltip,
			onMouseOut: this.hideTooltip,
			onPointerEnter: (evt)=>this.showTooltip(text, evt),
			onPointerMove: this.moveTooltip,
			onPointerLeave: this.hideTooltip,
			onClick: (evt)=>this.showTooltip(text, evt),
		};
	}

	renderRings(){
		const outermostDrawn = ACTIVE_RING_POS.reduce((acc, pos, idx)=>(RING_DRAW_TYPE[idx] <= -10 ? acc : idx), 0);
		// 七政+相位(aspects)六圆规格:仅画 idx {2,4,5,6,7,8}(0.51/0.62/0.69/0.76/0.92/0.95);
		// 仅 aspects 生效,full/half 常规 Moira 圆盘零变化。
		const aspectsMode = this.props.showAspectsMode === true;
		const ASPECTS_CIRCLES = [2, 4, 5, 6, 7, 8];
		return (
			<g className="moira-rings">
				{ACTIVE_RING_POS.map((pos, idx)=>{
					if(aspectsMode){
						// 六圆白名单直接画,不受 full 的 drawType/折叠规则约束。
						if(ASPECTS_CIRCLES.indexOf(idx) < 0){
							return null;
						}
					} else {
						if(RING_DRAW_TYPE[idx] <= -10){
							return null;
						}
						if(ringCollapsed(ACTIVE_RING_POS, idx)){
							return null; // 折叠环:与前一边界重合,不重复画圆
						}
					}
					const major = RING_DRAW_TYPE[idx] === 1 || idx === 0 || idx === 11 || (idx === outermostDrawn && pos >= 0.999);
					return (
						<circle
							key={`ring-${idx}`}
							r={pos * R}
							className={major ? 'moira-ring-major' : 'moira-ring-minor'}
						/>
					);
				})}
			</g>
		);
	}

	// 西占不等宫 cusps(真黄经;择日端点 staticHousesBySystem,本盘时刻同源)。
	// 分宫制=左栏所选(election.hsys);无数据返回 null(数字环回退整宫)。
	westernCusps(){
		const data = this.props.electionData || {};
		const ele = this.props.election || {};
		const pool = data.staticHousesBySystem || data.housesBySystem;
		const cusps = pool ? (pool[ele.hsys] || pool.P || pool.A) : null;
		return (cusps && cusps.length >= 12) ? cusps.map(Number) : null;
	}

	mapCuspsToWheel(cusps, chart){
		return mapCuspsToDisplay(cusps, chart);
	}

	// 西占不等宫宫位格(与择日盘同款做法):上升=1宫头,逆时针按所选分宫制切分,
	// 数字带(圆2-3)每格宽=真实宫宽,数字向心置界间中点;宫界以虚线透传
	// 流年行星带(圆4-5)与本命行星带(圆6-7)。
	renderWesternHouseGrid(){
		// aspects 六圆规格无数字宫位环(用户钦定),整格不画。
		if(this.props.showAspectsMode === true){
			return null;
		}
		const cuspsLon = this.westernCusps();
		if(!cuspsLon){
			return null;
		}
		const root = this.props.rootValue || {};
		const chart = this.props.value || root.chart || {};
		const cusps = this.mapCuspsToWheel(cuspsLon, chart);
		const dashOf = (a, b)=>{
			const len = Math.max(0, b - a);
			return len > 2 ? `${len / 17} ${len / 17}` : null;
		};
		const bands = [
			['nowPlanets', rs('nowPlanets', 0), rs('nowPlanets', 1)],
			['birthPlanets', rs('birthPlanets', 0), rs('birthPlanets', 1)],
		];
		const nodes = [];
		for(let k = 0; k < 12; k++){
			const cur = cusps[k];
			let next = cusps[(k + 1) % 12];
			if(next <= cur){ next += 360; }
			const bTheta = moiraThetaFromDegree(cur);
			const mTheta = moiraThetaFromDegree(cur + (next - cur) / 2);
			const p = point((rs('numbers', 0) + rs('numbers', 1)) / 2, mTheta);
			const whTip = [`第 ${k + 1} 宫`, `${zhiDegText(cur)} ~ ${zhiDegText(next % 360)}`, `宫宽 ${(next - cur).toFixed(1)}°`].join('\n');
			nodes.push(
				<g key={`mwh-${k}`} {...this.tooltipHandlers(whTip)}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(rs('numbers', 0), rs('numbers', 1), moiraThetaFromDegree(next), bTheta)}
					>
					</path>
					{radialLine(bTheta, rs('numbers', 0), rs('numbers', 1), {color: BLACK, width: 1.35})}
					{bands.map(([name, a, b])=>{
						const dash = dashOf(a, b);
						return dash ? <g key={`mwh-${k}-${name}`}>{radialLine(bTheta, a, b, {color: BLACK, width: 0.8, dash})}</g> : null;
					})}
					<text x={p.x} y={p.y} fill={GREEN} fontSize={19} fontWeight={700} textAnchor="middle" dominantBaseline="central" transform={`rotate(${mTheta + 90} ${p.x} ${p.y})`}>{k + 1}</text>
				</g>
			);
		}
		return <g className="moira-western-house-grid">{nodes}</g>;
	}

	renderSectorLines(){
		const nodes = [];
		// 有西占宫位格时,数字带(numbers 槽)的整宫支线让位给不等宫界线(择日盘同款)。
		const skipNumbersRing = this.westernCusps() ? ACTIVE_SLOTS.numbers[1] : -1;
		// 七政+相位(aspects)六圆规格:十二宫扇线只画 人事宫带(ringIdx5)/八卦支曜带(6)/神煞带(7);
		// 星体腔与宿带零扇线。仅 aspects 生效,full/half 常规 Moira 圆盘零变化。
		const aspectsMode = this.props.showAspectsMode === true;
		if(aspectsMode){
			// 六圆规格:仅 人事宫带(idx4-5)/八卦支曜带(5-6)/神煞带(6-7) 画十二宫扇线,直画不看 drawType。
			[5, 6, 7].forEach((ringIdx)=>{
				for(let i = 0; i < 12; i++){
					nodes.push(
						<g key={`sector-${ringIdx}-${i}`}>
							{radialLine(-30 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			});
			return <g>{nodes}</g>;
		}
		for(let ringIdx = 1; ringIdx < RING_DRAW_TYPE.length; ringIdx++){
			if(ringCollapsed(ACTIVE_RING_POS, ringIdx)){
				continue; // 折叠带无宽度,扇线免画
			}
			const drawType = RING_DRAW_TYPE[ringIdx];
			if(drawType <= 0 && drawType > -10 && ringIdx !== skipNumbersRing){
				for(let i = 0; i < 12; i++){
					nodes.push(
						<g key={`sector-${ringIdx}-${i}`}>
							{radialLine(-30 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			}
			if(drawType === 2 || drawType === -11){
				for(let i = 0; i < 24; i++){
					nodes.push(
						<g key={`sector24-${ringIdx}-${i}`}>
							{radialLine(-7.5 - 15 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			}
		}
		return <g>{nodes}</g>;
	}

	renderDegreeMarkBand(inner, outer, keyPrefix, thetaForDegree = moiraThetaFromDegree, opt = {}){
		const nodes = [];
		const delta = (outer - inner) / 3;
		for(let degree = 0; degree < 360; degree++){
			const theta = thetaForDegree(degree);
			const major = degree % 30 === 0;
			const mid = degree % 5 === 0;
			const anchorInner = opt.anchor === 'inner';
			const start = anchorInner ? inner : (major ? inner : (mid ? inner + delta : inner + 2 * delta));
			const end = anchorInner ? (major ? outer : (mid ? inner + 2 * delta : inner + delta)) : outer;
			const color = opt.mutedMajor ? BLACK : (major ? RED : BLACK);
			nodes.push(
				<g key={`${keyPrefix}-${degree}`}>
					{radialLine(theta, start, end, {
						color,
						// 黑色刻度统一外圈粗细+纯黑不透明(用户钦定「刻度是黑色不是灰色」);
						// 红色整宫刻度线除外保持原宽。
						width: color === RED ? (opt.majorWidth || 0.82) : 1.35,
						opacity: 1,
					})}
				</g>
			);
		}
		return nodes;
	}

	renderDegreeTicks(chart, fields){
		const nodes = [];
		const life = lifeDegree(chart, fields);
		const lifeTheta = moiraThetaFromDegree(life);
		// 🔴 birthFrac(公历元旦基准,照 Moira val=age-1-birthFrac)+ 定童限 base(9/10)。类B 显示项,缺省=元旦/9 → 旧版零回归。
		const limitChildBase = Number(this.props.limitChildBase) === 10 ? 10 : 9;
		const limitBirthFrac = birthYearFraction(chart, fields, this.props.limitYearBoundary || 'gregorian');
			if(this.props.showAspectsMode === true){
				// 六圆规格:宿带只在圆1 外侧一条刻度(贴圆1 向外);无下刻度带。
				nodes.push(...this.renderDegreeMarkBand(rs('stellarTickUp', 0), rs('stellarTickUp', 1), 'aspects-stellar-up', moiraThetaFromDegree, {mutedMajor: true, anchor: 'inner'}));
			} else {
				nodes.push(...this.renderDegreeMarkBand(r(4), r(5), 'full-stellar-up', moiraThetaFromDegree, {mutedMajor: true, anchor: 'inner'}));
				nodes.push(...this.renderDegreeMarkBand(r(6), r(7), 'full-stellar-down', moiraThetaFromDegree, {mutedMajor: true}));
			}
		if(this.props.showAgeRing !== false){
			// 每岁数字 = 悬浮触发点(用户钦定,非分割线)+ 始终向心(rotate theta+90,与宫号/度数/年份同姿态)。
			// 限度按当前宿度制的宿界(buildFixedStars 取当前 chart.fixedStarSu28)换算,随宿度制变化而变。
			// 小限/飞限/童限:照 Moira ChartData(getSmallLimit/getFlyLimit/getChildLimit)——以黄经命宫(12 宫地支)推,永远黄道。
			const ageBirthYear = birthYearFrom(null, chart, fields);
			const ageStars = buildFixedStars(chart);
			const ageDisplayEcl = isEclipticDisplayChart(chart); // 黄仪:限度落点=黄经;赤仪:=赤经
			const ageEps = moiraObliquityDeg(chart);
			// 小限/飞限/童限=12 宫地支划分,以黄经命度为准(与地支盘/命宫同口径,不随宿度制黄赤仪变)。
			// 算法单一真值源=guolaoMoiraTables(照 Moira ChartData;flyLimitBranches 的 cur_age 为 0 基)。
			const ageLifeLon = lifeLonDegree(chart, fields);
			const ageLifeSignPos = Math.floor(norm(ageLifeLon) / 30) * 30;
			const ageChildLimit = childAgeLimitYears(ageLifeLon, limitChildBase);
			const ageSuDeg = (deg)=>{
				const idx = stellarIndexForDegree(ageStars, deg);
				// idx 是 fixedStarSu28 位序(壁奎娄…随宿度制变),不能直接切 FULL_STELLAR(娄胃昴…固定序,否则错宿)。
				// 取该位真实宿名 → 按名映射 宿+五行 全名(与中心立命 lifeXiuFull 同法)。
				const suName = idx >= 0 ? (ageStars[idx] && ageStars[idx].name) || '' : '';
				const suFull = fullStellarByName(suName);
				const off = suOffsetText(deg, ageStars);
				return suFull ? `${suFull} ${off || ''}`.trim() : (off || `${norm(deg).toFixed(2)}°`);
			};
			for(let age = 1; age <= 130; age++){
				// 🔴 cell = [起界 startOff, 止界 endOff](自锚点累计角偏移,offset 封顶 360=锚点/出生线)。
				// 1 岁起界=锚点(0,命宫整宫界);末岁 endOff 封顶 360 → 末段 partial cell 一直画到出生线闭合环
				// (照 Moira 12 宫填满 360°:首/末两格都是被出生线一侧截断的窄格)。break 用**起界**越锚点即止,
				// 故末段窄格(中心已过 359.9 但起界未到)仍会画——修「末岁结束少画一节」。
				const startOff = age === 1 ? 0 : limitAgeOffset(life, age, limitBirthFrac, limitChildBase);
				const endOff = limitAgeOffset(life, age + 1, limitBirthFrac, limitChildBase);
				// break 用 **止界**(该岁 END tick=下一元旦)越锚点即止 → 末**数字**=97(同 Moira,不多标 98);
				// 分割线循环则用起界 break(多画一格=末岁 END tick/闭合刻度),故线比数字多一格=闭合环(照 Moira)。
				if(endOff >= 359.9){ break; }
				// 数字落 cell **角度中心**(照 Moira 0.5*(angle+last_angle));首/末 partial 窄格亦按此中心不偏。
				const degree = norm(limitAnchor(life) - (startOff + endOff) / 2);
				const theta = moiraThetaFromDegree(degree);
				// 岁数**贴外圈**(用户钦定:靠最外侧圆圈看着更整齐),留安全距离:数字中心置外圈内侧 6.5px,
				// cap≈10px 居中 → 外缘距外圈约 1.5px 不压线,内侧空出给分割线。
				const p = point(r(11) - 6.5, theta);
				const limitDeg = limitDegreeForAge(life, age, limitBirthFrac, limitChildBase);
				// 限度落点在当前宿度制显示坐标(黄仪=黄经/赤仪=赤经);另一坐标由黄赤交角变换求真值。
				const ageHuang = ageDisplayEcl ? norm(limitDeg) : eclEquConvertDeg(limitDeg, ageEps);
				const ageChi = ageDisplayEcl ? eclEquConvertDeg(limitDeg, ageEps) : norm(limitDeg);
				const smallZhi = smallLimitBranch(ageLifeSignPos, age);
				// flyLimitBranches cur_age=0 基(age-1);childAgeLimit 传真值(勿用默认 5);半年段拼「甲乙各半年」。
				const flyObj = flyLimitBranches(ageLifeSignPos, age - 1, ageChildLimit);
				const flyZhi = flyObj && flyObj.branches.length
					? (flyObj.halfYear ? `${flyObj.branches.join('')}各半年` : flyObj.branches[0])
					: '';
				const inChild = age <= ageChildLimit;
				const childZhi = inChild ? childLimitBranch(ageLifeSignPos, age) : '';
				const limitLine = [
					`小限 ${smallZhi}`,
					flyZhi ? `飞限 ${flyZhi}` : '',
					childZhi ? `童限 ${childZhi}` : '',
				].filter(Boolean).join(' · ');
				const ageTip = [
					`${age} 岁 · ${ageBirthYear + age - 1} 年 ${stemBranchForYear(ageBirthYear + age - 1)}`,
					`限度 ${ageSuDeg(limitDeg)}`,
					`黄经 ${ageHuang.toFixed(2)}° · 赤经 ${ageChi.toFixed(2)}°`,
					limitLine,
				].filter(Boolean).join('\n');
				nodes.push(
					<g
						key={`limit-age-${age}`}
						{...this.tooltipHandlers(ageTip)}
						onClick={this.props.onAgeClick ? (()=>this.props.onAgeClick(ageBirthYear + age - 1)) : undefined}
						style={this.props.onAgeClick ? { cursor: 'pointer' } : undefined}
					>
						{/* 点击该岁格 → 流年跳该岁对应年 7/1 12:00(用户钦定);hover-zone 兼作点击热区。 */}
						<circle className="moira-hover-zone" cx={p.x} cy={p.y} r={9} />
						{/* 岁数数字放到最大(用户钦定「看清楚」):字号 14 —— 数字径向朝心,占满岁数带高(r10→r11)
						    又不压到内外圆环线条。cap height≈0.7·14≈9.8px < 带宽 ~17px。 */}
						<text x={p.x} y={p.y} fill={GREEN} fontSize="14" fontWeight="600" textAnchor="middle" dominantBaseline="central" transform={`rotate(${theta + 90} ${p.x} ${p.y})`}>
							{age}
						</text>
					</g>
				);
			}
		}
		nodes.push(
			<g key="life-degree-marker" className="moira-life-degree-marker">
				{/* 命度(立命)标记:照 Moira mark_up_ring/mark_down_ring —— 上/下刻度带各一段
				    整带高粗红线(chart_life_master_mk_color=0xff0000),中间宿名带断开不相连;
				    aspects 仅上刻度带(aspects_mark_up_ring0=3,圆1 外侧),其 tickDown 槽与宿名带
				    重合故必须跳过;half 上刻度带折叠 → 自动只余下段。岁数带 year_mark 短线恒画。 */}
				{(rs('stellarTickUp', 1) - rs('stellarTickUp', 0)) > 0.5
					? radialLine(lifeTheta, rs('stellarTickUp', 0), rs('stellarTickUp', 1), {color: RED, width: 4.5})
					: null}
				{this.props.showAspectsMode !== true && (rs('stellarTickDown', 1) - rs('stellarTickDown', 0)) > 0.5
					? radialLine(lifeTheta, rs('stellarTickDown', 0), rs('stellarTickDown', 1), {color: RED, width: 4.5})
					: null}
				{radialLine(lifeTheta, r(10), r(11), {color: RED, width: 4.5})}
			</g>
		);
		return <g className="moira-degree-ticks">{nodes}</g>;
	}

	renderStellarTicks(){
		return null;
	}

	renderStaticTwelve(root, chart, fields){
		const nodes = [];
		const life = lifeDegree(chart, fields);
		const ziGods = getZiGods(root, chart);
		const aspectsMode = this.props.showAspectsMode === true;
		for(let i = 0; i < 12; i++){
			const theta = sectorTheta(i);
			const startTheta = -30 * i;
			const endTheta = -30 * (i + 1);
			const pNumber = point((rs('numbers', 0) + rs('numbers', 1)) / 2, theta);
			const houseNameRadius = (rs('houseNames', 0) + rs('houseNames', 1)) / 2;
			const houseIndex = houseIndexForSector(i, life);
			const houseName = HOUSE_BRANCH[houseIndex];
			const houseNumber = `${houseIndex + 1}`;
			const gods = orderedGods(collectGods(ziGods, TWELVE_SIGNS[i]), BIRTH_GOD_ORDER);
			const weakSolid = weakSolidRowForZi(this.props.moiraRules, TWELVE_SIGNS[i]);
			const tip = signTooltip(TWELVE_SIGNS[i], houseName, RING1[i], this.props.moiraRules, gods);
			nodes.push(
				<g key={`static-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(Math.min(rs('branchStars', 0), rs('houseNames', 0)), Math.max(rs('branchStars', 1), rs('houseNames', 1)), endTheta, startTheta)}
						{...this.tooltipHandlers(tip)}
					>
					</path>
					{aspectsMode
						? arcUprightTextMoira(TWELVE_SIGNS_ALT[i], (rs('branchStars', 0) + rs('branchStars', 1)) / 2, theta, {size: 20, color: BLACK, weight: 600})
						: pairedRadialText(RING1[i], theta, rs('branchStars', 0), rs('branchStars', 1), {size: 22, primaryColor: MUTED_PLANET, secondaryColor: BLACK, weight: 600})}
					{aspectsMode ? null : weakSolidMarkers(weakSolid, theta, rs('branchStars', 0), rs('branchStars', 1))}
					{horizontalRingText(houseName, houseNameRadius, theta, {size: 20, color: GREEN, weight: 700})}
					{(this.westernCusps() || aspectsMode) ? null : (
						<text
							x={pNumber.x}
							y={pNumber.y}
							fill={GREEN}
							fontSize="20"
							fontWeight="600"
							textAnchor="middle"
							dominantBaseline="central"
							transform={`rotate(${theta + 90} ${pNumber.x} ${pNumber.y})`}
						>
							{houseNumber}
						</text>
					)}
				</g>
			);
		}
		// 中心立命标注（对齐 Moira「心月 / 六度 / 立命」做法）：显示命度所在宿+七曜、入宿度、立命。
		// 旧版为硬编码「七政/立命/度木」（度木为写死占位、不随盘变），现按真实命度计算。
		const lifeStars = buildFixedStars(chart);
		const lifeXi = stellarIndexForDegree(lifeStars, life);
		const lifeXiuName = lifeXi >= 0 ? (lifeStars[lifeXi].name || '') : '';
		const lifeXiuFull = lifeXiuName ? fullStellarByName(lifeXiuName) : '立命';
		const lifeDegInto = lifeXi >= 0 ? norm(life - norm(lifeStars[lifeXi].ra)) : 0;
		const lifeDegStr = cnDegree(lifeDegInto) + '度';
		return (
			<g className="moira-static-twelve">
				{nodes}
				{this.renderWesternHouseGrid()}
				{/* aspects:中心腔缘圆透明不描边(用户钦定)——相位线端锚仍在 r(0),锚点圆独立可见。 */}
				<circle r={r(0)} fill={MOIRA_BG} stroke={this.props.showAspectsMode === true ? 'none' : BLACK} strokeWidth="1.35" />
				{this.renderAspects(chart)}
				{this.props.showAspectsMode === true ? null : (
					<g {...this.tooltipHandlers([`立命 ${zhiDegText(life)}`, `命度宿 ${lifeXiuFull} ${cnDegree(lifeDegInto)}度`].join('\n'))}>
						<circle className="moira-hover-zone" cx={0} cy={8} r={54} />
						<text x="0" y="-24" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">{lifeXiuFull}</text>
						<text x="0" y="8" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">{lifeDegStr}</text>
						<text x="0" y="40" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">立命</text>
					</g>
				)}
			</g>
		);
	}

	renderStellarRing(chart){
		const stars = buildFixedStars(chart);
		const birthRelations = buildStellarRelations(chart);
		const transitRoot = this.props.transitValue || {};
		const transitChart = transitRoot.chart ? (transitRoot.params ? {...transitRoot.chart, params: transitRoot.params} : transitRoot.chart) : null;
		const transitRelations = transitChart ? buildStellarRelations(transitChart) : [];
		const nodes = [];
		stars.forEach((cur, idx)=>{
			const nxt = stars[(idx + 1) % stars.length];
			let span = Number(nxt.ra) - Number(cur.ra);
			if(span <= 0){
				span += 360;
			}
			const edgeTheta = moiraThetaFromDegree(cur.ra);
			const centerTheta = moiraThetaFromDegree(Number(cur.ra) + span / 2);
			const p = point((rs('stellarNames', 0) + rs('stellarNames', 1)) / 2, centerTheta);
			const endRa = norm(Number(cur.ra) + span);
			const birth = birthRelations[idx] || {};
			const transit = transitRelations[idx] || {};
			// 宿界黄经跨度(可能与赤经跨度不同:赤仪宿度制下二者真值分离)。
			let lonSpan = Number(nxt.lon) - Number(cur.lon);
			if(lonSpan <= 0){ lonSpan += 360; }
			const lonEnd = norm(Number(cur.lon) + lonSpan);
			// 真实黄经/赤经:黄仪宿界置黄道(源侧赤经=lon 占位)→ 按黄赤交角算真赤经,黄经≠赤经;赤仪宿界置赤道→ ra/lon 已是真值。
			const stellarEps = moiraObliquityDeg(chart);
			const isEclSu = Math.abs(Number(cur.ra) - Number(cur.lon)) < 0.01;
			const raStartReal = isEclSu ? eclEquConvertDeg(cur.lon, stellarEps) : norm(Number(cur.ra));
			const raEndReal = isEclSu ? eclEquConvertDeg(lonEnd, stellarEps) : endRa;
			const tip = [
				`${cur.label || cur.name}宿`,
				`黄经 ${norm(cur.lon).toFixed(2)}° ~ ${lonEnd.toFixed(2)}°`,
				`赤经 ${raStartReal.toFixed(2)}° ~ ${raEndReal.toFixed(2)}°`,
				`宿宽 ${dmsText(span)}`,
				`本命落入：${listText(birth.main)}`,
				`本命同经：${listText(birth.same)}`,
				transitChart ? `流年落入：${listText(transit.main)}` : '',
				transitChart ? `流年同经：${listText(transit.same)}` : '',
			].filter(Boolean).join('\n');
			nodes.push(
				<g key={`stellar-${idx}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(rs('stellarNames', 0), rs('stellarNames', 1), moiraThetaFromDegree(Number(cur.ra) + span), edgeTheta)}
						{...this.tooltipHandlers(tip)}
					>
					</path>
					{this.props.showAspectsMode === true
						? radialLine(edgeTheta, rs('stellarNames', 1) - (rs('stellarNames', 1) - rs('stellarTickUp', 0)) * 3 / 5, rs('stellarNames', 1) - 1, {color: RED, width: 1})
						: radialLine(edgeTheta, rs('stellarNames', 0) + 1, rs('stellarNames', 1) - 1, {color: RED, width: 1})}
					{verticalText(cur.name || cur.label, p.x, p.y, {
						size: 23,
						maxPerCol: 1,
						color: BLACK,
						weight: 600,
					})}
				</g>
			);
		});
		return <g className="moira-stellar-layer">{nodes}</g>;
	}

	renderPlanetRing(chart, opt){
		const nodes = [];
		const hiddenIds = this.hiddenPlanetIds();
		const aspectsBirth = this.props.showAspectsMode === true && opt.kind === 'birth';
		// Moira aspects:sign_lock[ASC]=sign_lock[MC]=true —— 升/顶钉真实度数不参与推挤。
		const lockIds = aspectsBirth ? new Set([AstroConst.ASC, AstroConst.MC]) : null;
		const placements = planetPlacements(chart, opt.inner, opt.outer, opt.dir, opt.size, opt.preferLon, PLANET_DEFS, lockIds)
			.filter((item)=>!(hiddenIds && hiddenIds.has(item.id)));
		const showDignity = opt.kind === 'birth' && this.props.showDignity !== false;
		const dignityById = {};
		if(showDignity){
			const rp = (this.props.moiraRules && this.props.moiraRules.planets) || [];
			rp.forEach((row)=>{ if(row && row.id != null){ dignityById[row.id] = row.dignity; } });
		}
		placements.forEach((item, idx)=>{
			const markTheta = moiraThetaFromDegree(item.degree);
			const labelTheta = moiraThetaFromDegree(item.labelDegree);
			const p = point(item.radius, labelTheta);
			const dignity = showDignity ? dignityById[item.id] : null;
			const color = planetColor(item.obj, opt.color, dignity);
			const showBadge = !!dignity && (DIGNITY_STRONG.indexOf(dignity) >= 0 || DIGNITY_WEAK.indexOf(dignity) >= 0);
			const tip = objectTooltip(item, opt.kind, this.props.moiraRules, buildFixedStars(chart));
			nodes.push(
				<g key={`${opt.kind}-planet-${item.id}-${idx}`}>
					<circle
						className="moira-hover-zone"
						cx={p.x}
						cy={p.y}
						r={Math.max(20, opt.size * 0.82)}
						{...this.tooltipHandlers(tip)}
					>
					</circle>
						{aspectsBirth
							? aspectsPlanetLeads(markTheta, labelTheta, rs('birthPlanets', 0), rs('birthPlanets', 1), item.radius, (opt.size || 28) / 2, {color: opt.markColor})
							: connectorLine(markTheta, labelTheta, opt.markInner, opt.markOuter, opt.lineDir || 1, {color: opt.markColor, width: 1.05})}
					{verticalText(item.label, p.x, p.y, {
						size: opt.size,
						maxPerCol: 1,
						color,
						weight: 600,
					})}
					{showBadge ? (
						<text x={p.x + opt.size * 0.6} y={p.y - opt.size * 0.5} fill={color} fontSize={opt.size * 0.44} fontWeight="700" textAnchor="middle" dominantBaseline="central">{dignityBadgeChar(dignity)}</text>
					) : null}
				</g>
			);
		});
		return <g className={`moira-planet-layer moira-planet-layer-${opt.kind}`}>{nodes}</g>;
	}

	// 星曜可见性/相位容许度 均为类B显示偏好(对照 Moira PlanetDialog/AspectDialog):
	// hiddenPlanets=按曜名隐藏(隐藏的曜连带不参与连线);aspectOrbs=每相位 orb 覆盖默认。
	hiddenPlanetIds(){
		const hidden = this.props.hiddenPlanets || [];
		if(!hidden.length){
			return null;
		}
		const ids = new Set();
		PLANET_DEFS.forEach((def)=>{ if(hidden.indexOf(def.label) >= 0){ ids.add(def.id); } });
		return ids;
	}

	renderAspects(chart){
		// 照 Moira show_aspects 语义:仅「显示相位」(aspects 布局)时画中心相位网;
		// full/half 常规模式中心圆内零相位线(用户钦定,与 Moira 一致)。
		if(this.props.showAspectsMode !== true){
			return null;
		}
		const set = this.props.aspectSet || MOIRA_DEFAULT_ASPECTS;
		if(!set || !set.length){
			return null;
		}
		const objects = (chart && chart.objects) || [];
		const preferLon = isEclipticDisplayChart(chart);
		const hiddenIds = this.hiddenPlanetIds();
		const orbs = this.props.aspectOrbs || {};
		const items = PLANET_DEFS.map((def)=>{
			if(hiddenIds && hiddenIds.has(def.id)){ return null; }
			const obj = objects.find((o)=>o && o.id === def.id);
			const deg = objectRa(obj, preferLon);
			return (obj && deg !== null) ? {id: def.id, deg: norm(deg)} : null;
		}).filter(Boolean);
		const aspectsMode = this.props.showAspectsMode === true;
		// aspects 模式:相位网画满中心腔,锚点小实心圆列在腔缘(Moira circle_offset 观感),
		// 行星向锚点引点线;常规模式保持原内圈细线(开关关闭时零变化)。
		// aspects:连线端锚在腔缘 r(0)(=aspects_ring 0.38),锚点圆在锚点带([0.38,0.42))中点 0.40(Moira circle_offset)。
		// Moira 原样:相位连线端锚在腔缘 r(0)(=0.38),锚点圆在锚带([0.38,0.42))中点 0.40(circle_offset)。
		const R0 = aspectsMode ? r(0) : r(0) * 0.92;
		const anchorR = aspectsMode ? (rs('anchor', 0) + rs('anchor', 1)) / 2 : R0;
		const lines = [];
		if(aspectsMode){
			// 星体带纯净化(用户钦定「星体圈只有星体」):锚点引点线不再伸入行星带,仅留锚点圆。
			items.forEach((it)=>{
				const p = point(anchorR, moiraThetaFromDegree(it.deg));
				lines.push(<circle key={`asp-dot-${it.id}`} cx={p.x} cy={p.y} r="4.6" fill={BLACK} />);
			});
		}
		for(let i = 0; i < items.length; i++){
			for(let j = i + 1; j < items.length; j++){
				let gap = Math.abs(items[i].deg - items[j].deg);
				if(gap > 180){ gap = 360 - gap; }
				let hit = null;
				for(let k = 0; k < MOIRA_ASPECTS.length; k++){
					const sp = MOIRA_ASPECTS[k];
					if(set.indexOf(sp.key) < 0){ continue; }
					const orb = Number.isFinite(Number(orbs[sp.key])) ? Number(orbs[sp.key]) : sp.orb;
					if(Math.abs(gap - sp.angle) <= orb || (sp.alt !== undefined && Math.abs(gap - sp.alt) <= orb)){
						hit = sp;
						break;
					}
				}
				if(!hit){ continue; }
				const a = point(R0, moiraThetaFromDegree(items[i].deg));
				const b = point(R0, moiraThetaFromDegree(items[j].deg));
				lines.push(
					<line key={`asp-${items[i].id}-${items[j].id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hit.color} strokeWidth="1.05" strokeDasharray={hit.dash || undefined} opacity="0.8" />
				);
			}
		}
		return <g className="moira-aspect-layer">{lines}</g>;
	}

	renderPlanetLayers(birthChart, transitChart){
		const birthPreferLon = isEclipticDisplayChart(birthChart);
		const transitPreferLon = isEclipticDisplayChart(transitChart || birthChart);
		return (
			<g>
					{this.props.showMoiraTransitGods !== false && this.props.showAspectsMode !== true ? this.renderPlanetRing(transitChart || birthChart, {
						kind: 'now',
						inner: rs('nowPlanets', 0) + 6,
						outer: rs('nowPlanets', 1) - 6,
						dir: 1,
						size: 27,
						color: BLUE,
							markColor: NOW_MARK,
							markInner: rs('nowPlanets', 0),
							markOuter: rs('nowPlanets', 1),
							lineDir: 1,
							preferLon: transitPreferLon,
						}) : null}
					{this.renderPlanetRing(birthChart, {
						kind: 'birth',
						inner: rs('birthPlanets', 0) + 7,
						outer: rs('birthPlanets', 1) - 8,
						dir: -1,
						size: 28,
						color: GREEN,
							markColor: BLACK,
							markInner: rs('birthPlanets', 0),
							markOuter: r(8),
							lineDir: -1,
							preferLon: birthPreferLon,
						})}
				</g>
			);
	}

	renderGodRing(root, chart, opt){
		const ziGods = getZiGods(root, chart);
		const nodes = [];
		const kindLabel = opt.kind === 'transit' ? '流年' : '本命';
		// 本命/流年独立隐藏名单(按环性质分流,互不影响)
		const hiddenSrc = opt.kind === 'transit' ? this.props.hiddenGodsTransit : this.props.hiddenGodsBirth;
		const hiddenGods = hiddenSrc && hiddenSrc.length ? new Set(hiddenSrc) : null;
		for(let i = 0; i < 12; i++){
			const theta = sectorTheta(i);
			const fromRules = godsFromRuleHits(this.props.moiraRules, TWELVE_SIGNS[i], opt.kind);
			const base = fromRules !== null ? fromRules : collectGods(ziGods, TWELVE_SIGNS[i]);
			// 长生字恒置首位(Moira getStarSigns head 首插),固定画不受筛选。
			const longLife = longLifeCharFor(this.props.moiraRules, TWELVE_SIGNS[i], opt.kind);
			const gods = (longLife ? [longLife] : []).concat(
				orderedGods(base, opt.order).filter((god)=>!(hiddenGods && hiddenGods.has(god)))
			);
			const godSize = opt.size || godTextSize(gods.length);
			const godSteps = godColumnStep(gods.length);
			const startTheta = -30 * i;
			const endTheta = -30 * (i + 1);
			const palaceTip = `${TWELVE_SIGNS[i]} · ${kindLabel}神煞\n${gods.length ? gods.join('，') : '无'}`;
			// 复刻 radialColumns 的列定位，给每个神煞单独的悬浮热区 + 判语。
			const rawStep = gods.length <= 1 ? 0 : godSteps.arc / (gods.length - 1);
			const step = gods.length <= 1 ? 0 : Math.min(godSteps.maxStep, rawStep);
			const start = theta + step * (gods.length - 1) / 2;
			const half = step > 0 ? step / 2 : 3;
			// half(单盘)双带:照 Moira use_lower——神煞分上下两层(层分界=带中点,half 表的 0.77),
			// 奇偶交替上/下层;非双带模式恒用整带(零变化)。
			const bandMid = (opt.inner + opt.outer) / 2;
			// 双层条件:仅 half 单盘显式双带(Moira use_lower)。字多不再自动分层——
			// 神煞恒落同一同心圆沿弧排(用户钦定),密度由字号/步长表自适应收紧。
			const dual = opt.singleBand ? false : !!opt.dualBand;
			const bandFor = (idx)=>{
				if(!dual){ return [opt.inner, opt.outer]; }
				return idx % 2 === 0 ? [bandMid + 4, opt.outer] : [opt.inner, bandMid - 4];
			};
			nodes.push(
				<g key={`${opt.kind}-god-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(opt.inner, opt.outer, endTheta, startTheta)}
						{...this.tooltipHandlers(palaceTip)}
					>
					</path>
					{gods.map((god, idx)=>{
						const gtheta = gods.length <= 1 ? theta : (start - idx * step);
						return (
							<g key={`${opt.kind}-god-${i}-${idx}`}>
								<path
									className="moira-hover-zone"
									d={annularSectorPath(bandFor(idx)[0], bandFor(idx)[1], gtheta - half, gtheta + half)}
									{...this.tooltipHandlers(`${kindLabel}·${guolaoShenShaTip(god)}`)}
								>
								</path>
								{radialStackText(god, gtheta, bandFor(idx)[0], bandFor(idx)[1], {
									size: godSize,
									color: opt.color || GREEN,
									weight: opt.weight || 600,
									opacity: opt.opacity,
								})}
							</g>
						);
					})}
				</g>
			);
		}
		return <g className={`moira-star-table-layer moira-star-table-layer-${opt.kind}`}>{nodes}</g>;
	}

	renderStarTables(root, chart, transitRoot, transitChart){
		const showBirth = this.props.showBirthGods !== false;
		const showTransit = this.props.showMoiraTransitGods !== false && this.props.showAspectsMode !== true;
		// Moira 口径(full_ring_pos 键位):本命神煞=外圈 [r9,r10],流年神煞=内圈 [r8,r9];
		// 单盘(half)时流年圈关闭,本命神煞占 [r8,r10] 双带(half 表 0.62-0.92,0.77 为层分界)。
		return (
			<g>
				{showTransit ? <circle className="moira-transit-god-split" r={rs('godsInner', 1)} fill="none" stroke={BLACK} strokeWidth="1.35" /> : null}
				{(!showTransit && this.props.showAspectsMode !== true) ? <circle className="moira-birth-god-split" r={(rs('godsInner', 0) + 14 + rs('godsOuter', 1) - 12) / 2} fill="none" stroke={BLACK} strokeWidth="0.6" strokeDasharray="3 4" opacity="0.5" /> : null}
				{showBirth ? this.renderGodRing(root, chart, {
					kind: 'birth',
					inner: (showTransit ? rs('godsOuter', 0) + 10 : rs('godsInner', 0) + 14),
					outer: rs('godsOuter', 1) - 12,
					order: BIRTH_GOD_ORDER,
					dualBand: !showTransit && this.props.showAspectsMode !== true,
					// aspects 六圆规格:神煞全部落同一同心圆,不分内外层(用户钦定)。
					singleBand: this.props.showAspectsMode === true,
				}) : null}
				{showTransit ? this.renderGodRing(transitRoot || root, transitChart || chart, {
					kind: 'transit',
					inner: rs('godsInner', 0) + 14,
					outer: rs('godsInner', 1) - 8,
					order: TRANSIT_GOD_ORDER,
					color: BLUE,
					opacity: transitChart ? 1 : 0.72,
				}) : null}
			</g>
		);
	}

	renderLimitRing(root, chart, fields){
		const birthYear = birthYearFrom(root, chart, fields);
		const life = lifeDegree(chart, fields);
		const nodes = [];
		// birthFrac(公历元旦基准)+ 定童限 base(9/10)——与 renderDegreeTicks 同口径,保证刻度/年份/当前岁一致。
		const limitChildBase = Number(this.props.limitChildBase) === 10 ? 10 : 9;
		const limitBirthFrac = birthYearFraction(chart, fields, this.props.limitYearBoundary || 'gregorian');
		// 立命年份大字标(旧 key:'birth',fontSize 24)已撤:它压在立命位,与岁数带(…105/106/1/2…环绕)+ 命度红线
		// 三者堆叠成一坨(用户点名「乱糟糟」)。立命位已由命度红线明示,不再另标高亮当年年份;仅保留各宫界年份小字标。
		const yearMarks = [];
		for(let sign = 0; sign < 12; sign++){
			const degree = sign * 30;
			const offset = limitOffsetFromLife(life, degree);
			// offset≈0 = 命宫整宫界(出生线/1岁起) → 该处年份=出生年(如 2006),用户钦定必须显示,勿跳;
				// 仅跳 offset>357(紧贴出生线另一侧的末宫界,年份已超可见岁数,避免与出生年标重叠)。
				if(offset > 357){
				continue;
			}
			yearMarks.push({
				degree,
				year: limitYearForDegree(birthYear, life, degree, limitBirthFrac, limitChildBase),
				key: `boundary-${sign}`,
			});
		}
		yearMarks.sort((a, b)=>limitOffsetFromLife(life, a.degree) - limitOffsetFromLife(life, b.degree));
			// 年份标注:圆10 以外只留年份文字(先天宫位分割线在圆9 以外一律不画,用户钦定);
			// 文字贴紧圆10 外侧、向心显示(与最外度数同姿态)。
			yearMarks.forEach((mark)=>{
				const degree = norm(mark.degree);
				const theta = moiraThetaFromDegree(degree);
				const pYear = point(r(11) + 16, theta);
				nodes.push(
					<g key={`year-${mark.key}`} {...this.tooltipHandlers(mark.key === 'birth' ? `立命年份：${mark.year}（1 岁起）` : `宫界年份：${mark.year} 岁次入宫`)}>
						<text
							x={pYear.x}
							y={pYear.y}
							fill={BLACK}
							fontSize={mark.key === 'birth' ? 24 : 21}
							fontWeight={mark.key === 'birth' ? 600 : 400}
							textAnchor="middle"
							dominantBaseline="central"
							transform={`rotate(${theta + 90} ${pYear.x} ${pYear.y})`}
						>
							{mark.year}
						</text>
					</g>
				);
			});
			// 🔴 照 Moira:大限环只画 出生线(命度) + 宿界红线 + 岁数短刻度 + 当前岁数红线;
			// **不画 12 整宫界线**(用户点名:除宿度红线/命度/当前岁数红线外不得有其它十二宫位分割线)。上一轮误加的宫界线已移除。
			// 28 宿界红线(当前宿度制同源=盘面宿环同一套 stars):画满岁数带整带高。
			// full 画 r10-r11;aspects 同带(r10/r11 已钉 0.92/0.95,用户点名加回)。
			buildFixedStars(chart).forEach((star, idx)=>{
				const theta = moiraThetaFromDegree(star.ra);
				nodes.push(
					<g key={`limit-xiu-${idx}`}>
						{radialLine(theta, r(10), r(11), {color: RED, width: 1})}
					</g>
				);
			});
			if(this.props.showAgeRing !== false){
				// 岁数分割线:与最外侧圆圈同粗(1.35)的不透明黑线,画在每岁 cell 起界
				// (=limitDegreeForAge(age),即 age-1-birthFrac 的度)。用户钦定:**不贯穿、不挨内圆**——
				// 内侧空一节(照 Moira drawLine(year_mid → year_upper) 半带口径),只在岁数带外侧约 6 成成线。
				// break 口径与岁数字循环(renderDegreeTicks 用 age+0.5)**统一**——否则线比数字多画一格(末格有线无字)。
				const ageLineInner = r(10) + (r(11) - r(10)) * 0.4;
				for(let age = 1; age <= 130; age++){
					// cell 起界 offset(与数字循环同口径):1 岁=锚点(0,命宫整宫界=一条十二宫分割线),
					// ≥2 岁=该岁 cell 起界。break 用**起界**越锚点即止(与数字循环一致)→ 分割线与数字逐格对齐,
					// 且末段窄格的起界线也画出、由出生线闭合(修「末岁少画一节」)。
					const startOff = age === 1 ? 0 : limitAgeOffset(life, age, limitBirthFrac, limitChildBase);
					if(startOff >= 359.9){ break; }
					const major = age % 10 === 0;
					// 🔴 1 岁头=出生线:落在命宫整宫界(anchor),贯满整带(照 Moira drawLine(i==0) year_pos→year_upper);
					// 逐岁刻度 year_mid→year_upper(内缩半带)。起界线位置 = norm(anchor − startOff)。
					const isBirthLine = age === 1;
					const theta = moiraThetaFromDegree(norm(limitAnchor(life) - startOff));
					nodes.push(
						<g key={`limit-age-line-${age}`}>
							{radialLine(theta, isBirthLine ? r(10) : ageLineInner, r(11), {
								color: BLACK,
								width: (major || isBirthLine) ? 1.7 : 1.35,
								opacity: 1,
							})}
						</g>
					);
				}
			}
const curAge = (this.props.transitParams && this.props.transitParams.date ? birthYearFrom({params: this.props.transitParams}, null, null) : birthYear) - birthYear + 1;
			if(this.props.showAgeRing !== false && this.props.showAspectsMode !== true && curAge >= 1 && curAge <= 130){
				// 🔴 流年岁数标记(用户钦定):不再用红色径向线(会和命度红线混淆),改成
				// **占该岁 cell 内侧(下侧)整条弧**的蓝色弧带——从 cell 起界到止界、贴岁数带内圈。
				const curStartDeg = curAge === 1
					? limitAnchor(life)
					: limitDegreeForAge(life, curAge, limitBirthFrac, limitChildBase);
				const curEndDeg = limitDegreeForAge(life, curAge + 1, limitBirthFrac, limitChildBase);
				const curThStart = moiraThetaFromDegree(curStartDeg);
				// 🔴 归一到**最短弧**:cell 恒窄,但 moiraThetaFromDegree(30−deg) 不归一,cell 若跨 0°/360°
				// 边界时 curThEnd−curThStart 会 >180 → annularSectorPath 的 largeArc 画成整圈补集
				// (「一圈都是黑条只有选中的不是」的病根,刚好画反)。归一差值到 (−180,180] 即修。
				const curThEndRaw = moiraThetaFromDegree(curEndDeg);
				const curThEnd = curThStart + ((((curThEndRaw - curThStart) % 360) + 540) % 360 - 180);
				const curP = point((r(10) + r(11)) / 2, (curThStart + curThEnd) / 2);
				nodes.push(
					<g key="limit-cur-age" {...this.tooltipHandlers(`流年 ${curAge} 岁（流年时刻推算）`)}>
						<circle className="moira-hover-zone" cx={curP.x} cy={curP.y} r={14} />
						{/* 流年黑条(蓝弧)细一点(用户钦定):贴内圈画约 2px 薄弧,不再是粗带。 */}
						<path d={annularSectorPath(r(10) + 1, r(10) + 3, curThStart, curThEnd)} fill={BLUE} stroke="none" />
					</g>
				);
			}
			return <g className="moira-limit-layer">{nodes}</g>;
		}

	// 四角标注(对照 Moira 桌面版):左下=时刻/真太阳/阴历/经纬/四柱/流年;右下=制式/算法/日月出没。
	// 取数与右栏「概览」tab 同源(GuoLaoWheelCaptions 同键),空行自动上提不留档。
	renderSideText(root, chart, fields){
		const birthYear = birthYearFrom(root, chart, fields);
		const transitYear = this.props.transitParams && this.props.transitParams.date
			? birthYearFrom({params: this.props.transitParams}, null, null) : birthYear;
		const params = root && root.params ? root.params : {};
		const transitParams = this.props.transitParams || {};
		const bazi = (root && root.nongli && root.nongli.bazi) || (chart && chart.nongli && chart.nongli.bazi) || {};
		// 四柱结构为 {stem:{cell},branch:{cell}}（非 .text）——与右栏 baziText 同源；逐柱拼干支。
		const pillar = (col)=>{
			if(!col){ return ''; }
			if(col.text){ return col.text; }
			const stem = col.stem && col.stem.cell ? col.stem.cell : '';
			const branch = col.branch && col.branch.cell ? col.branch.cell : '';
			return `${stem}${branch}`;
		};
		const y = pillar(bazi.year) || stemBranchForYear(birthYear);
		const m = pillar(bazi.month);
		const d = pillar(bazi.day);
		const h = pillar(bazi.time);
		const apparent = apparentSolarText(root, chart);
		const lunar = lunarText(root, chart);
		const su28Label = su28ModeCaption(params, fields);
		// 公历行:params 缺失时退回左栏 fields(DateTime),与盘面输入恒一致
		const fmtField = (key, fmt)=>(fields && fields[key] && fields[key].value && fields[key].value.format ? fields[key].value.format(fmt) : '');
		const dateLine = (params.date || params.time)
			? `${params.date || ''} ${params.time || ''}`.trim()
			: `${fmtField('date', 'YYYY/MM/DD')} ${fmtField('time', 'HH:mm:ss')}`.trim();
		const leftLines = [
			dateLine,
			apparent ? `真太阳时：${apparent}` : '',
			lunar ? `阴历：${lunar}` : '',
			geoCaption(params),
			`四柱：${[y, m, d, h].filter(Boolean).join(' ')}`,
			`流年：${transitYear} ${stemBranchForYear(transitYear)}`,
			transitParams.date ? `流年时间：${transitParams.date} ${transitParams.time || ''}` : '',
		];
		const rightLines = [
			su28Label ? `静盘：${su28Label}` : '',
			computationMethodCaption(),
			...riseSetLines(root),
			'七政四余 · Moira 风',
		];
		return (
			<g className="moira-side-text" opacity="0.96">
				{cornerTextBlock({ x: -(VIEW / 2 - 20), y: VIEW / 2 - 152, anchor: 'start', lines: leftLines, size: 17, gap: 22, color: BLACK })}
				{cornerTextBlock({ x: VIEW / 2 - 20, y: VIEW / 2 - 130, anchor: 'end', lines: rightLines, size: 17, gap: 22, color: BLACK })}
			</g>
		);
	}

	renderTooltip(){
		const tooltip = this.state.tooltip;
		if(!tooltip){
			return null;
		}
		// portal 挂 body(照 IndiaChartMain renderDashaFloatingPopover):中栏容器的 container-type/overflow
		// 会把 position:fixed 的包含块重锚进中栏并新建 stacking context → 被右栏压层+裁剪;
		// 单抬 z-index 无效,必须让浮层脱离该容器。坐标本就是 clientX/clientY 视口系,portal 后口径不变。
		if(typeof document === 'undefined' || !document.body){
			return null;
		}
		return createPortal(
			<div
				className="horosa-guolao-moira-tooltip"
				style={{
					left: tooltip.x,
					top: tooltip.y,
				}}
			>
				{tooltip.text}
			</div>,
			document.body
		);
	}

	render(){
		const root = this.props.rootValue || {};
		const rawChart = this.props.value || root.chart || {};
		const chart = root.params ? {...rawChart, params: root.params} : rawChart;
		const transitRoot = this.props.transitValue || {};
		const transitChart = transitRoot.chart ? (transitRoot.params ? {...transitRoot.chart, params: transitRoot.params} : transitRoot.chart) : null;
		const height = this.props.height || 740;
		const side = this.state.containerSide || Math.min(height, 740);
		// 动态环布局:按当前显示开关重算 13 边界(隐藏环折叠、余环铺满);r(idx) 全程读此布局
		// Moira 三基准(照其 prefix 切表):显示相位=aspects(中心 0.38R 相位网腔),
		// 流年圈开=full_ring_pos(双盘),关=half_ring_pos(单盘,内圈重排+神煞双带)。
		const moiraMode = this.props.showAspectsMode === true ? 'aspects' : (this.props.showMoiraTransitGods !== false ? 'full' : 'half');
		ACTIVE_SLOTS = moiraMode === 'aspects' ? ASPECTS_SLOTS : DEFAULT_SLOTS;
		ACTIVE_RING_POS = computeRingPositions({
			birthGods: this.props.showBirthGods !== false,
			transitGods: this.props.showMoiraTransitGods !== false,
			ageRing: this.props.showAgeRing !== false,
		}, moiraMode);
		return (
			<div className="horosa-guolao-moira-wheel" style={{height}} ref={this.containerRef}>
				<svg
					style={{width: side, height: side}}
					viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
					role="img"
					aria-label="Moira风格七政星盘"
				>
					<rect x={-VIEW / 2} y={-VIEW / 2} width={VIEW} height={VIEW} fill={MOIRA_BG} />
					<g className="moira-pale-guides">
						{Array.from({length: 24}).map((_, idx)=>(
							<g key={`guide-${idx}`}>{radialLine(-15 * idx, r(GOD_RING_INNER), r(GOD_RING_OUTER), {color: PALE, width: 0.55, opacity: 0.18})}</g>
						))}
					</g>
					{this.renderRings()}
					{this.renderSectorLines()}
					{this.renderDegreeTicks(chart, this.props.fields)}
					{this.renderStellarTicks()}
					{this.renderStaticTwelve(root, chart, this.props.fields)}
					{this.renderStellarRing(chart)}
					{this.renderPlanetLayers(chart, transitChart)}
					{this.renderStarTables(root, chart, transitRoot, transitChart)}
					{this.props.showAgeRing !== false ? this.renderLimitRing(root, chart, this.props.fields) : null}
					{this.renderSideText(root, chart, this.props.fields)}
				</svg>
				{this.renderTooltip()}
			</div>
		);
	}
}

export {
	R as MOIRA_WHEEL_R,
	VIEW as MOIRA_WHEEL_VIEW,
	MOIRA_BG as MOIRA_BACKGROUND,
	BLACK as MOIRA_BLACK,
	GREEN as MOIRA_GREEN,
	BLUE as MOIRA_BLUE,
	RED as MOIRA_RED,
	MAGENTA as MOIRA_MAGENTA,
	PALE as MOIRA_PALE,
	HALF_STELLAR as MOIRA_HALF_STELLAR,
	FULL_STELLAR as MOIRA_FULL_STELLAR,
	PLANET_DEFS as MOIRA_PLANET_DEFS,
	zhiDegText as moiraZhiDegText,
	isEclipticDisplayChart as moiraIsEclipticDisplayChart,
	mapCuspsToDisplay as moiraMapCuspsToDisplay,
	suOffsetText as moiraSuOffsetText,
	MOIRA_ASPECTS as MOIRA_ASPECT_DEFS,
	norm as moiraNormDegree,
	point as moiraPoint,
	annularSectorPath as moiraAnnularSectorPath,
	radialLine as moiraRadialLine,
	connectorLine as moiraConnectorLine,
	formatGodName as moiraFormatGodName,
	verticalText as moiraVerticalText,
	horizontalRingText as moiraHorizontalRingText,
	pairedRadialText as moiraPairedRadialText,
	radialStackText as moiraRadialStackText,
	radialColumns as moiraRadialColumns,
	godTextSize as moiraGodTextSize,
	godColumnStep as moiraGodColumnStep,
	objectRa as moiraObjectRa,
	dmsText as moiraDmsText,
	objectTooltip as moiraObjectTooltip,
	planetColor as moiraPlanetColor,
	circularGap as moiraCircularGap,
	planetPlacements as moiraPlanetPlacements,
	buildStellarRelations as moiraBuildStellarRelations,
	mergeStellarRelationRows as moiraMergeStellarRelationRows,
	getZiGods as moiraGetZiGods,
	collectGods as moiraCollectGods,
	godsFromRuleHits as moiraGodsFromRuleHits,
	longLifeCharFor as moiraLongLifeCharFor,
	weakSolidRowForZi as moiraWeakSolidRowForZi,
	weakSolidMarkers as moiraWeakSolidMarkers,
	orderedGods as moiraOrderedGods,
	buildFixedStars as moiraBuildFixedStars,
	fullStellarByName as moiraFullStellarByName,
	starHostByName as moiraStarHostByName,
	moiraObliquityDeg,
	eclEquConvertDeg as moiraEclEquConvertDeg,
	buildGuolaoLimitTable as moiraBuildLimitTable,
	limitAnchor as moiraLimitAnchor,
	limitAgeOffset as moiraLimitAgeOffset,
	limitDegreeForAge as moiraLimitDegreeForAge,
	currentLimitIndex as moiraCurrentLimitIndex,
	lifeDegree as moiraLifeDegree,
	birthYearFraction as moiraBirthYearFraction,
	BIRTH_GOD_ORDER as MOIRA_BIRTH_GOD_ORDER,
	TRANSIT_GOD_ORDER as MOIRA_TRANSIT_GOD_ORDER,
};

export default GuoLaoMoiraWheel;
