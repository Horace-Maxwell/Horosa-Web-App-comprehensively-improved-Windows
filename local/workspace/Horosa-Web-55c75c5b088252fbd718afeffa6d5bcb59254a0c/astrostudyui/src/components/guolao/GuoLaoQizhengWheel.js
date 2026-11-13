import React from 'react';
import { formatZoneLabel } from '../../utils/zoneText';
import './GuoLaoQizhengWheel.less';

const SIZE = 960;
const CX = SIZE / 2;
const CY = SIZE / 2;

const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGN_WESTERN_ABBR = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
const SIGN_SHORT = ['戌宫', '酉宫', '申宫', '未宫', '午宫', '巳宫', '辰宫', '卯宫', '寅宫', '丑宫', '子宫', '亥宫'];
const BRANCH_LORD = {
	0: '土星',
	1: '土星',
	2: '木星',
	3: '木星',
	4: '金星',
	5: '水星',
	6: '太阳',
	7: '太阴',
	8: '水星',
	9: '金星',
	10: '火星',
	11: '木星',
};
const FIVE_ELEMENTS = {
	太陽: '日',
	太阳: '日',
	太陰: '月',
	太阴: '月',
	水星: '水',
	金星: '金',
	火星: '火',
	木星: '木',
	土星: '土',
	羅睺: '罗',
	罗睺: '罗',
	計都: '计',
	计都: '计',
	月孛: '孛',
	紫氣: '炁',
	紫气: '炁',
};
const PLANET_COLORS = {
	太陽: 'var(--qz-planet-sun)',
	太阳: 'var(--qz-planet-sun)',
	太陰: 'var(--qz-planet-moon)',
	太阴: 'var(--qz-planet-moon)',
	水星: 'var(--qz-planet-mercury)',
	金星: 'var(--qz-planet-venus)',
	火星: 'var(--qz-planet-mars)',
	木星: 'var(--qz-planet-jupiter)',
	土星: 'var(--qz-planet-saturn)',
	羅睺: 'var(--qz-planet-rahu)',
	罗睺: 'var(--qz-planet-rahu)',
	計都: 'var(--qz-planet-ketu)',
	计都: 'var(--qz-planet-ketu)',
	月孛: 'var(--qz-planet-yuebei)',
	紫氣: 'var(--qz-planet-ziqi)',
	紫气: 'var(--qz-planet-ziqi)',
};
const ELEMENT_COLORS = {
	木: 'var(--qz-planet-jupiter)',
	金: 'var(--qz-planet-venus)',
	土: 'var(--qz-planet-saturn)',
	日: 'var(--qz-planet-sun)',
	月: 'var(--qz-planet-moon)',
	火: 'var(--qz-planet-mars)',
	水: 'var(--qz-planet-mercury)',
};
const GROUP_COLORS = {
	东方青龙: ['var(--qz-group-east-bg)', 'var(--qz-group-east-text)'],
	東方青龍: ['var(--qz-group-east-bg)', 'var(--qz-group-east-text)'],
	北方玄武: ['var(--qz-group-north-bg)', 'var(--qz-group-north-text)'],
	西方白虎: ['var(--qz-group-west-bg)', 'var(--qz-group-west-text)'],
	南方朱雀: ['var(--qz-group-south-bg)', 'var(--qz-group-south-text)'],
};
const MANSIONS = [
	{name: '角', element: '木', animal: '蛟', group: '东方青龙', start: 203.8375},
	{name: '亢', element: '金', animal: '龙', group: '东方青龙', start: 214.4899},
	{name: '氐', element: '土', animal: '貉', group: '东方青龙', start: 225.0216},
	{name: '房', element: '日', animal: '兔', group: '东方青龙', start: 242.9360},
	{name: '心', element: '月', animal: '狐', group: '东方青龙', start: 249.7584},
	{name: '尾', element: '火', animal: '虎', group: '东方青龙', start: 256.1517},
	{name: '箕', element: '水', animal: '豹', group: '东方青龙', start: 271.2576},
	{name: '斗', element: '木', animal: '獬', group: '北方玄武', start: 280.1775},
	{name: '牛', element: '金', animal: '牛', group: '北方玄武', start: 304.0435},
	{name: '女', element: '土', animal: '蝠', group: '北方玄武', start: 311.7193},
	{name: '虚', element: '日', animal: '鼠', group: '北方玄武', start: 323.3912},
	{name: '危', element: '月', animal: '燕', group: '北方玄武', start: 333.3486},
	{name: '室', element: '火', animal: '猪', group: '北方玄武', start: 353.49},
	{name: '壁', element: '水', animal: '貐', group: '北方玄武', start: 9.1522},
	{name: '奎', element: '木', animal: '狼', group: '西方白虎', start: 22.3721},
	{name: '娄', element: '金', animal: '狗', group: '西方白虎', start: 33.9661},
	{name: '胃', element: '土', animal: '雉', group: '西方白虎', start: 46.9312},
	{name: '昴', element: '日', animal: '鸡', group: '西方白虎', start: 59.4080},
	{name: '毕', element: '月', animal: '乌', group: '西方白虎', start: 68.4612},
	{name: '觜', element: '火', animal: '猴', group: '西方白虎', start: 83.7030},
	{name: '参', element: '水', animal: '猿', group: '西方白虎', start: 84.6775},
	{name: '井', element: '木', animal: '犴', group: '南方朱雀', start: 95.2980},
	{name: '鬼', element: '金', animal: '羊', group: '南方朱雀', start: 125.7246},
	{name: '柳', element: '土', animal: '獐', group: '南方朱雀', start: 130.3005},
	{name: '星', element: '日', animal: '马', group: '南方朱雀', start: 147.2753},
	{name: '张', element: '月', animal: '鹿', group: '南方朱雀', start: 155.6874},
	{name: '翼', element: '火', animal: '蛇', group: '南方朱雀', start: 173.6856},
	{name: '轸', element: '水', animal: '蚓', group: '南方朱雀', start: 190.7218},
];

const R = {
	dashaOut: 468,
	dashaIn: 435,
	shenshaOut: 435,
	shenshaIn: 395,
	mansionOut: 395,
	mansionIn: 355,
	signOut: 355,
	signIn: 320,
	palaceOut: 320,
	palaceIn: 285,
	degreeOut: 285,
	degreeIn: 275,
	planet: 240,
	center: 130,
};

function safeList(value){
	return Array.isArray(value) ? value : [];
}

function safeMap(value){
	return value && typeof value === 'object' ? value : {};
}

function num(value, fallback = 0){
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function norm(deg){
	let value = num(deg, 0) % 360;
	if(value < 0){
		value += 360;
	}
	return value;
}

function eclToChart(deg){
	return norm(45 - num(deg, 0));
}

function polar(radius, angleDeg){
	const rad = angleDeg * Math.PI / 180;
	return {
		x: CX + radius * Math.cos(rad),
		y: CY + radius * Math.sin(rad),
	};
}

function annularSectorPath(inner, outer, start, end){
	const span = Math.abs(end - start);
	const large = span > 180 ? 1 : 0;
	const a = polar(outer, start);
	const b = polar(outer, end);
	const c = polar(inner, end);
	const d = polar(inner, start);
	return [
		`M ${a.x.toFixed(1)} ${a.y.toFixed(1)}`,
		`A ${outer} ${outer} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
		`L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
		`A ${inner} ${inner} 0 ${large} 0 ${d.x.toFixed(1)} ${d.y.toFixed(1)}`,
		'Z',
	].join(' ');
}

function textRotation(angle){
	let rot = (angle + 90) % 360;
	if(rot > 90 && rot < 270){
		rot = (rot + 180) % 360;
	}
	return rot;
}

function mansionWidth(index){
	const start = MANSIONS[index].start;
	const end = MANSIONS[(index + 1) % MANSIONS.length].start;
	return norm(end - start);
}

function mansionChartStart(index){
	return eclToChart(MANSIONS[(index + 1) % MANSIONS.length].start);
}

function mansionIndexForLon(lon){
	const value = norm(lon);
	for(let i = 0; i < MANSIONS.length; i++){
		const start = norm(MANSIONS[i].start);
		const end = norm(MANSIONS[(i + 1) % MANSIONS.length].start);
		if(start < end){
			if(value >= start && value < end){
				return i;
			}
		}else if(value >= start || value < end){
			return i;
		}
	}
	return 0;
}

function shortChineseSign(text, index){
	const raw = `${text || SIGN_SHORT[index] || ''}`;
	return raw.split(/[（(]/)[0] || raw;
}

function planetColor(name){
	return PLANET_COLORS[name] || 'var(--qz-planet-default)';
}

function planetLabel(name){
	const elem = FIVE_ELEMENTS[name];
	return elem ? `${elem}·${name}` : name;
}

function groupByMansion(planets){
	const map = new Map();
	safeList(planets).forEach((planet)=>{
		const lon = num(planet.longitude, NaN);
		if(!Number.isFinite(lon)){
			return;
		}
		const idx = mansionIndexForLon(lon);
		if(!map.has(idx)){
			map.set(idx, []);
		}
		map.get(idx).push(planet);
	});
	return map;
}

function aspectPairs(planets){
	const aspects = [
		{name: '合', angle: 0, orb: 8, color: 'var(--qz-aspect-conj)'},
		{name: '冲', angle: 180, orb: 8, color: 'var(--qz-aspect-opp)'},
		{name: '刑', angle: 90, orb: 6, color: 'var(--qz-aspect-square)'},
		{name: '三合', angle: 120, orb: 6, color: 'var(--qz-aspect-trine)'},
		{name: '六合', angle: 60, orb: 4, color: 'var(--qz-aspect-sextile)'},
	];
	const list = safeList(planets);
	const result = [];
	for(let i = 0; i < list.length; i++){
		for(let j = i + 1; j < list.length; j++){
			const a = norm(num(list[i].longitude));
			const b = norm(num(list[j].longitude));
			const diff = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
			const found = aspects.find((item)=>Math.abs(diff - item.angle) <= item.orb);
			if(found){
				result.push({a: list[i], b: list[j], color: found.color, opacity: Math.abs(diff - found.angle) > 4 ? 0.42 : 0.62});
			}
		}
	}
	return result;
}

function sectorLabel(angle, radius, text, opt = {}){
	const p = polar(radius, angle);
	const rot = textRotation(angle);
	return (
		<text
			x={p.x}
			y={p.y}
			textAnchor="middle"
			dominantBaseline="central"
			fill={opt.fill || 'var(--qz-text)'}
			fontSize={opt.size || 10}
			fontWeight={opt.weight || 600}
			fontFamily={opt.family || 'serif'}
			opacity={opt.opacity === undefined ? 1 : opt.opacity}
			transform={`rotate(${rot.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
		>
			{text}
		</text>
	);
}

function radialLine(angle, inner, outer, opt = {}){
	const a = polar(inner, angle);
	const b = polar(outer, angle);
	return (
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			stroke={opt.stroke || 'var(--qz-line)'}
			strokeWidth={opt.width || 1}
			opacity={opt.opacity === undefined ? 1 : opt.opacity}
		/>
	);
}

function branchShensha(qz, branchIndex){
	const branch = EARTHLY_BRANCHES[branchIndex];
	const map = safeMap(safeMap(qz.shensha).branchMap);
	const fromMap = safeList(map[branch]);
	if(fromMap.length){
		return fromMap;
	}
	const house = safeList(qz.houses).find((item)=>Number(item.branch) === branchIndex || item.branchName === branch);
	return safeList(house && house.shensha);
}

function renderTextLines(x, y, lines, opt = {}){
	return lines.map((line, idx)=>(
		<text
			key={`${line}-${idx}`}
			x={x}
			y={y + idx * (opt.lineHeight || 16)}
			textAnchor={opt.anchor || 'middle'}
			fill={opt.fill || 'var(--qz-text)'}
			fontSize={opt.size || 11}
			fontWeight={opt.weight || 600}
			fontFamily={opt.family || 'serif'}
		>
			{line}
		</text>
	));
}

function GuoLaoQizhengWheel({pan}){
	const qz = safeMap(pan && pan.qizheng);
	const chart = safeMap(qz.chart);
	const bazi = safeMap(qz.bazi);
	const dasha = safeMap(qz.dasha);
	const houses = safeList(qz.houses);
	const planets = safeList(qz.planets);
	const periods = safeList(dasha.periods);
	const currentIndex = Number(dasha.currentIndex);
	const mingBranch = num(chart.mingGongBranch, -1);
	const branchToHouse = new Map(houses.map((house)=>[num(house.branch, -1), house]));
	const planetAngles = new Map();
	const planetGroups = groupByMansion(planets);
	const currentPeriod = safeMap(dasha.current);
	const pillars = [
		bazi.year_pillar || bazi.yearPillar,
		bazi.month_pillar || bazi.monthPillar,
		bazi.day_pillar || bazi.dayPillar,
		bazi.hour_pillar || bazi.hourPillar,
	].filter(Boolean);

	return (
		<div className="horosa-qizheng-kin-wheel">
			<svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="坚七政圆形星盘">
				<rect width={SIZE} height={SIZE} rx="14" className="qz-wheel-bg" />

				<g className="qz-wheel-dasha-ring">
					{periods.map((period, idx)=>{
						const branch = num(period.branch, idx);
						const signIdx = (10 - branch + 12) % 12;
						const start = eclToChart((signIdx + 1) * 30);
						const end = start + 30;
						const isCurrent = idx === currentIndex;
						const mid = start + 15;
						return (
							<g key={`dasha-${idx}`}>
								<path
									d={annularSectorPath(R.dashaIn, R.dashaOut, start, end)}
									fill={isCurrent ? 'var(--qz-current-sector)' : 'var(--qz-outer-sector)'}
									stroke={isCurrent ? 'var(--qz-accent)' : 'var(--qz-line-soft)'}
									strokeWidth={isCurrent ? 1.7 : 0.9}
								/>
								{sectorLabel(mid, (R.dashaIn + R.dashaOut) / 2, period.start_year || period.startYear || '', {
									fill: isCurrent ? 'var(--qz-accent)' : 'var(--qz-muted)',
									size: 10,
									weight: 700,
									family: 'sans-serif',
								})}
							</g>
						);
					})}
				</g>

				<g className="qz-wheel-shensha-ring">
					{Array.from({length: 12}).map((_, i)=>{
						const start = eclToChart((i + 1) * 30);
						const end = start + 30;
						const branchIndex = (10 - i + 12) % 12;
						const names = branchShensha(qz, branchIndex).slice(0, 6);
						const rows = [names.slice(0, 3).join(' '), names.slice(3, 6).join(' ')].filter(Boolean);
						const mid = start + 15;
						return (
							<g key={`shensha-${i}`}>
								<path d={annularSectorPath(R.shenshaIn, R.shenshaOut, start, end)} fill="var(--qz-outer-sector)" stroke="var(--qz-line-soft)" strokeWidth="0.85" />
								{rows.map((text, idx)=>(
									<g key={`shensha-text-${idx}`}>
										{sectorLabel(mid, (R.shenshaIn + R.shenshaOut) / 2 + (idx - (rows.length - 1) / 2) * 12, text, {
											fill: 'var(--qz-shensha-text)',
											size: 7.5,
											weight: 700,
											opacity: 1,
										})}
									</g>
								))}
							</g>
						);
					})}
				</g>

				<g className="qz-wheel-mansion-ring">
					{MANSIONS.map((mansion, idx)=>{
						const width = mansionWidth(idx);
						const start = mansionChartStart(idx);
						const end = start + width;
						const mid = start + width / 2;
						const colors = GROUP_COLORS[mansion.group] || ['var(--qz-ring-fill)', 'var(--qz-text)'];
						return (
							<g key={`${mansion.name}-${idx}`}>
								<path d={annularSectorPath(R.mansionIn, R.mansionOut, start, end)} fill={colors[0]} stroke="var(--qz-line)" strokeWidth="0.9" />
								{sectorLabel(mid, 379, mansion.name, {fill: colors[1], size: 13, weight: 800})}
								{sectorLabel(mid, 365, `${mansion.element}${mansion.animal}`, {fill: ELEMENT_COLORS[mansion.element] || 'var(--qz-text)', size: 8.5, weight: 760})}
								{radialLine(eclToChart(mansion.start), R.mansionIn, R.mansionOut, {stroke: 'var(--qz-line-strong)', width: 0.9})}
							</g>
						);
					})}
				</g>

				<g className="qz-wheel-sign-ring">
					{Array.from({length: 12}).map((_, i)=>{
						const start = eclToChart((i + 1) * 30);
						const end = start + 30;
						const mid = start + 15;
						return (
							<g key={`sign-${i}`}>
								<path d={annularSectorPath(R.signIn, R.signOut, start, end)} fill="var(--qz-ring-fill)" stroke="var(--qz-line-soft)" strokeWidth="0.85" />
								{sectorLabel(mid, 342, shortChineseSign(SIGN_SHORT[i], i), {fill: 'var(--qz-text-secondary)', size: 13, weight: 820})}
								{sectorLabel(mid, 328, SIGN_WESTERN_ABBR[i], {fill: 'var(--qz-muted)', size: 9, weight: 700, family: 'sans-serif'})}
							</g>
						);
					})}
				</g>

				<g className="qz-wheel-palace-ring">
					{Array.from({length: 12}).map((_, i)=>{
						const start = eclToChart((i + 1) * 30);
						const end = start + 30;
						const branchIndex = (10 - i + 12) % 12;
						const house = safeMap(branchToHouse.get(branchIndex));
						const isMing = branchIndex === mingBranch;
						const mid = start + 15;
						const palace = `${house.name || ''}`.replace(/[宮宫]/g, '');
						return (
							<g key={`palace-${i}`}>
								<path
									d={annularSectorPath(R.palaceIn, R.palaceOut, start, end)}
									fill={isMing ? 'var(--qz-current-sector)' : 'var(--qz-ring-fill)'}
									stroke={isMing ? 'var(--qz-accent)' : 'var(--qz-line-soft)'}
									strokeWidth={isMing ? 1.45 : 0.85}
								/>
								{sectorLabel(mid, 309, palace, {fill: isMing ? 'var(--qz-accent)' : 'var(--qz-warm)', size: 12, weight: 820})}
								{sectorLabel(mid, 294, `${EARTHLY_BRANCHES[branchIndex]}·${BRANCH_LORD[branchIndex] || ''}`, {fill: 'var(--qz-muted)', size: 8.5, weight: 700})}
							</g>
						);
					})}
				</g>

				<g className="qz-wheel-degree-ticks">
					{Array.from({length: 360}).map((_, degree)=>{
						if(degree % 5 !== 0){
							return null;
						}
						const angle = eclToChart(degree);
						const major = degree % 10 === 0;
						return <g key={`degree-${degree}`}>{radialLine(angle, major ? R.degreeIn - 2 : R.degreeIn, R.degreeOut, {stroke: major ? 'var(--qz-line-strong)' : 'var(--qz-line)', width: major ? 1.05 : 0.75})}</g>;
					})}
				</g>

				<g className="qz-wheel-division-lines">
					{Array.from({length: 12}).map((_, i)=>(
						<g key={`division-${i}`}>{radialLine(eclToChart(i * 30), R.center, R.dashaOut, {stroke: 'var(--qz-radial-line)', width: 1.15})}</g>
					))}
				</g>

				<circle cx={CX} cy={CY} r={R.center} className="qz-wheel-center-disc" />

				<g className="qz-wheel-aspects">
					{aspectPairs(planets).map((aspect, idx)=>{
						const a1 = eclToChart(aspect.a.longitude);
						const a2 = eclToChart(aspect.b.longitude);
						const p1 = polar(R.center + 6, a1);
						const p2 = polar(R.center + 6, a2);
						return <line key={`aspect-${idx}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={aspect.color} strokeWidth="1.05" opacity={aspect.opacity} />;
					})}
				</g>

				<g className="qz-wheel-planets">
					{Array.from(planetGroups.entries()).map(([mansionIndex, list])=>{
						const width = mansionWidth(mansionIndex);
						const base = mansionChartStart(mansionIndex) + width / 2;
						const span = width * 0.72;
						return list.map((planet, idx)=>{
							const lon = norm(planet.longitude);
							const angle = list.length === 1 ? eclToChart(lon) : base - span / 2 + (span * idx) / Math.max(1, list.length - 1);
							planetAngles.set(planet.name, angle);
							const color = planetColor(planet.name);
							const dot = polar(R.planet, angle);
							const namePos = polar(R.planet - 19, angle);
							const degreePos = polar(R.planet + 16, angle);
							const rot = textRotation(angle);
							return (
								<g key={`planet-${planet.name}-${idx}`}>
									<circle cx={dot.x} cy={dot.y} r="5.4" fill={color} stroke="var(--qz-planet-stroke)" strokeWidth="0.85" />
									<text x={namePos.x} y={namePos.y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="10" fontWeight="800" fontFamily="serif" transform={`rotate(${rot.toFixed(1)} ${namePos.x.toFixed(1)} ${namePos.y.toFixed(1)})`}>
										{planetLabel(planet.name)}{planet.retrograde ? '℞' : ''}
									</text>
									<text x={degreePos.x} y={degreePos.y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="8" fontWeight="700" fontFamily="sans-serif" opacity="0.94" transform={`rotate(${rot.toFixed(1)} ${degreePos.x.toFixed(1)} ${degreePos.y.toFixed(1)})`}>
										{num(planet.signDegree).toFixed(1)}°
									</text>
								</g>
							);
						});
					})}
				</g>

				<g className="qz-wheel-center-text">
					{renderTextLines(CX, CY - 55, [
						'坚七政',
						`${pan.dateStr || ''} ${pan.timeStr || ''}`.trim(),
						`${pan.location || ''}（${pan.gender || '命'}）`,
					], {size: 12, lineHeight: 20, fill: 'var(--qz-text-strong)', weight: 760})}
					<text x={CX} y={CY + 4} textAnchor="middle" fill="var(--qz-accent)" fontSize="11" fontWeight="800" fontFamily="serif">
						命宫 {chart.mingGongBranchName || (mingBranch >= 0 ? EARTHLY_BRANCHES[mingBranch] : '—')} · 立命 {chart.limingText || chart.ascendantText || '—'}
					</text>
					<text x={CX} y={CY + 24} textAnchor="middle" fill="var(--qz-warm)" fontSize="10" fontWeight="760" fontFamily="serif">
						中天 {chart.midheavenText || '—'} · {currentPeriod.palace_name || currentPeriod.palaceName || '行限'} {currentPeriod.start_age || currentPeriod.startAge || 0}-{currentPeriod.end_age || currentPeriod.endAge || '—'}岁
					</text>
					<text x={CX} y={CY + 43} textAnchor="middle" fill="var(--qz-cyan)" fontSize="10" fontWeight="700" fontFamily="serif">
						{formatZoneLabel(pan.timezone) || 'UTC'}
					</text>
				</g>

				<g className="qz-wheel-pillars">
					{pillars.map((pillar, idx)=>{
						const x = 16 + idx * 34;
						return (
							<g key={`pillar-${idx}`}>
								<text x={x} y="22" fill="var(--qz-text-strong)" fontSize="14" fontWeight="800" fontFamily="serif">{`${pillar}`.slice(0, 1)}</text>
								<text x={x} y="43" fill="var(--qz-warm)" fontSize="14" fontWeight="800" fontFamily="serif">{`${pillar}`.slice(1, 2)}</text>
							</g>
						);
					})}
					<text x={16 + pillars.length * 34} y="34" fill="var(--qz-accent)" fontSize="15" fontWeight="840" fontFamily="serif">{pan.gender === '女' ? '坤' : '乾'}</text>
				</g>

				<g className="qz-wheel-corner-note">
					<text x="16" y="896" fill="var(--qz-text-strong)" fontSize="13" fontWeight="800" fontFamily="serif">七政四余</text>
					<text x="16" y="916" fill="var(--qz-text-secondary)" fontSize="10" fontWeight="680" fontFamily="serif">十二宫 · 二十八宿 · 年限</text>
					<text x="812" y="906" fill="var(--qz-text-secondary)" fontSize="10" fontWeight="680" fontFamily="serif">立命顺逆与年限</text>
					<text x="812" y="924" fill="var(--qz-accent)" fontSize="11" fontWeight="800" fontFamily="serif">
						{pan.gender === '女' ? '坤命' : '乾命'} {currentPeriod.lord || ''}
					</text>
				</g>
			</svg>
		</div>
	);
}

export default GuoLaoQizhengWheel;
