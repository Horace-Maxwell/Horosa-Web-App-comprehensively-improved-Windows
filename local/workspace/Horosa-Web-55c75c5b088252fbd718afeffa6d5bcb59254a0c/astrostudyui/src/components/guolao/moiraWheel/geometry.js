// 盘面几何:角度与坐标、扇环路径、黄赤道换算、径向 / 连接线、相位配对
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import React from 'react';   // 下面的 JSX 按旧式编译成 React.createElement(测试环境不自动补)
import { RING_POS, DEFAULT_SLOTS, ASPECTS_SLOTS, MOIRA_DEFAULT_ASPECTS, moiraHiddenIds, PLANET_DEFS, moiraObjSpeed, MOIRA_ASPECTS, R, BLACK } from './constants';

// 每次 render 起始处刷新;绘图 helper 众多且均为模块级函数,经模块变量取活动布局
// 可免把布局穿针引线传遍全部 helper(渲染单线程,安全)。
export let ACTIVE_RING_POS = RING_POS;

export let ACTIVE_SLOTS = DEFAULT_SLOTS;
// 活动布局唯一写入口:组件每次 render 起始处按显示开关设定一次(带界槽映射 + 13 环边界),其余绘图 helper 只读
export function setActiveLayout(moiraMode, ringPos){
	ACTIVE_SLOTS = moiraMode === 'aspects' ? ASPECTS_SLOTS : DEFAULT_SLOTS;
	ACTIVE_RING_POS = ringPos;
}
export function rs(name, side){
	const pair = ACTIVE_SLOTS[name] || [0, 0];
	return r(pair[side]);
}

export function computeMoiraAspectPairs(chart, opts){
	const o = opts || {};
	const set = o.aspectSet || MOIRA_DEFAULT_ASPECTS;
	if(!set || !set.length){ return []; }
	const objects = (chart && chart.objects) || [];
	const preferLon = isEclipticDisplayChart(chart);
	const hiddenIds = moiraHiddenIds(o.hiddenPlanets);
	const orbs = o.aspectOrbs || {};
	const items = PLANET_DEFS.map((def)=>{
		if(hiddenIds && hiddenIds.has(def.id)){ return null; }
		const obj = objects.find((x)=>x && x.id === def.id);
		const deg = objectRa(obj, preferLon);
		return (obj && deg !== null) ? { id: def.id, label: def.label, deg: norm(deg), speed: moiraObjSpeed(obj, preferLon) } : null;
	}).filter(Boolean);
	const sepOf = (a, b)=>{ let g = Math.abs(a - b) % 360; if(g > 180){ g = 360 - g; } return g; };
	const out = [];
	for(let i = 0; i < items.length; i++){
		for(let j = i + 1; j < items.length; j++){
			const gap = sepOf(items[i].deg, items[j].deg);
			let hit = null;
			let target = 0;
			for(let k = 0; k < MOIRA_ASPECTS.length; k++){
				const sp = MOIRA_ASPECTS[k];
				if(set.indexOf(sp.key) < 0){ continue; }
				const orb = Number.isFinite(Number(orbs[sp.key])) ? Number(orbs[sp.key]) : sp.orb;
				if(Math.abs(gap - sp.angle) <= orb){ hit = sp; target = sp.angle; break; }
				if(sp.alt !== undefined && Math.abs(gap - sp.alt) <= orb){ hit = sp; target = sp.alt; break; }
			}
			if(!hit){ continue; }
			const err = Math.abs(gap - target);
			let state = '—';
			if(items[i].speed !== null && items[j].speed !== null){
				const dt = 0.01;   // 天
				const next = Math.abs(sepOf(items[i].deg + items[i].speed * dt, items[j].deg + items[j].speed * dt) - target);
				state = err < 1e-6 ? '精确' : (next < err ? '入相' : '离相');
			}
			out.push({ a: items[i], b: items[j], aspect: hit, angle: target, gap, orb: err, state });
		}
	}
	return out;
}

export function r(idx){
	return ACTIVE_RING_POS[idx] * R;
}

export function norm(deg){
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

export function point(radius, thetaDeg){
	const rad = thetaDeg * Math.PI / 180;
	return {
		x: radius * Math.cos(rad),
		y: radius * Math.sin(rad),
	};
}

export function annularSectorPath(inner, outer, startTheta, endTheta){
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

export function moiraThetaFromDegree(degree){
	return 30 - Number(degree || 0);
}

// 黄赤交角(度)按纪元世纪数 T 取平黄赤交角(IAU 1980 主项;宿界悬浮显示够精,历史盘也随年份变)。
export function moiraObliquityDeg(chart){
	let year = 2000;
	const bz = chart && chart.nongli && chart.nongli.bazi;
	if(bz && bz.year && Number(bz.year.year)){ year = Number(bz.year.year); }
	const T = (year - 2000) / 100;
	return 23.4392911 - 0.0130042 * T - 0.00000016 * T * T + 0.0000005036 * T * T * T;
}
// 大圆上一点(定坐标纬度=0)另一坐标经度:atan2(cosε·sinθ, cosθ)。黄仪宿界(黄纬0):黄经→真赤经;赤仪宿界(赤纬0):赤经→真黄经。
export function eclEquConvertDeg(deg, epsDeg){
	const rad = Number(deg) * Math.PI / 180;
	const eps = Number(epsDeg) * Math.PI / 180;
	const out = Math.atan2(Math.cos(eps) * Math.sin(rad), Math.cos(rad)) * 180 / Math.PI;
	return ((out % 360) + 360) % 360;
}

export function sectorTheta(index){
	return -15 - 30 * index;
}

export function radialLine(theta, inner, outer, opt = {}){
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

export function connectorLine(markTheta, labelTheta, inner, outer, dir, opt = {}){
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
export function aspectsPlanetLeads(markTheta, labelTheta, bandInner, bandOuter, textRadius, halfText, opt = {}){
	const segs = [
		[point(bandOuter, markTheta), point(textRadius + halfText, labelTheta)],
		[point(bandInner, markTheta), point(textRadius - halfText, labelTheta)],
	];
	return segs.map(([a, b], i)=>(
		<line key={`asp-lead-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={opt.color || BLACK} strokeWidth={opt.width || 1.05} />
	));
}

export function objectRa(obj, preferLon = false){
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
export function isEclipticDisplayChart(chart){
	const coord = chart && chart.displayCoord;
	if(coord === 'ecliptic'){ return true; }
	if(coord === 'equatorial'){ return false; }
	return isZhengSiderealChart(chart);
}

export function tangentRotate(theta){
	let rotate = theta + 90;
	if(rotate > 90 || rotate < -90){
		rotate += 180;
	}
	return rotate;
}
