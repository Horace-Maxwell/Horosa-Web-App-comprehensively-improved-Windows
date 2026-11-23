// 宫头映射、恒星关系、强弱提示、星体落点聚合与标签避让
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import React from 'react';   // 下面的 JSX 按旧式编译成 React.createElement(测试环境不自动补)
import * as AstroConst from '../../../constants/AstroConst';
import { resolveRingShifts } from '../electionCore';
import { isEclipticDisplayChart, norm, objectRa, point } from './geometry';
import { HALF_STELLAR, FULL_STELLAR, PLANET_DEFS, SIGN_NAMES, RED, GREEN, MAGENTA, DIGNITY_STRONG, DIGNITY_GOLD, DIGNITY_WEAK, DIGNITY_WEAK_COLOR } from './constants';
import { buildFixedStars } from './gods';
import { signIndexFromDegree, suNameOf, suOffsetText, dmsText } from './text';

function speedText(obj){
	const speed = planetSpeed(obj);
	const sign = speed >= 0 ? '+' : '-';
	return `${sign}${Math.abs(speed).toFixed(3)}`;
}

// 黄经 cusps→显示度(主盘/择日盘共用)。黄仪:直用真黄经(与全部环同口径,零变换)。
// 赤仪:各环画 ra(四轴 = 黄道上四个点的真赤经,天顶即 ARMC;行星 = 真赤经 —— 后端四轴赤经是真值,
// 不再是「赤道上升 ascmc[4]」与带假黄纬的投影;黄经无全局变换可同时钉住四轴),故四轴宫头(1/4/7/10)直接取 chart
// Asc/IC/Desc/MC 的 ra(与「升/顶」标同源严格同度),中间宫头按黄经比例在象限内插;
// 非象限制(等宫等)退化为整体平移钉 1 宫头。
export function mapCuspsToDisplay(cusps, chart){
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

export function listText(items, empty = '无'){
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
export function fullStellarByName(name){
	const i = HALF_STELLAR.indexOf(name);
	return i >= 0 ? FULL_STELLAR[i] : (name || '');
}
// 宿的度主(五行字):由真实宿名取全名后截尾一字。
export function starHostByName(name){
	const full = fullStellarByName(name);
	return full.length > 1 ? full.slice(1) : '';
}

export function stellarIndexForDegree(stars, degree){
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

export function buildStellarRelations(chart){
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

export function mergeStellarRelationRows(birthChart, transitChart){
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

export function weakSolidRowForZi(rules, zi){
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
export function zhiDegText(deg){
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

export function objectTooltip(item, kind, rules, suStars){
	const degree = norm(item.degree);
	const signIdx = signIndexFromDegree(degree);
	const inSign = degree - signIdx * 30;
	const su = suNameOf(degree, suStars) || (item.obj && item.obj.su28 ? item.obj.su28 : '');
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

export function signTooltip(zi, houseName, sameText, rules, gods){
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
export function weakSolidMarkers(row, theta, inner, outer){
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

export function findObject(chart, id){
	const objects = chart && chart.objects ? chart.objects : [];
	return objects.find((obj)=>obj.id === id);
}

function planetSpeed(obj){
	const speed = Number(obj && (obj.lonspeed !== undefined ? obj.lonspeed : obj.speed));
	return Number.isFinite(speed) ? speed : 0;
}

export function planetColor(obj, baseColor, dignity){
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

export function circularGap(a, b){
	const diff = Math.abs(norm(a) - norm(b));
	return Math.min(diff, 360 - diff);
}

export function planetPlacements(chart, inner, outer, dir, size, preferLon = false, defs = PLANET_DEFS, lockIds = null){
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
