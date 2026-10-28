// 天文馆 · 天体条目文字:度数 / 赤经 / 星等格式化、天体与星名、黄道宫与宫位、位置 / 光谱 / 月相文字、详情行。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { STAR_PROPER_NAMES } from '../planetariumStarNames';
import { BODY_LABELS, BODY_ENGLISH_LABELS } from './constants';
import { normalizeDegrees } from './skyMath';

export function formatDeg(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '--';
	}
	return `${Math.round(Number(val) * 1000) / 1000}°`;
}

function formatNumber(val, digits = 3, suffix = ''){
	if(val === undefined || val === null || val === '' || Number.isNaN(Number(val))){
		return '--';
	}
	const factor = Math.pow(10, digits);
	return `${Math.round(Number(val) * factor) / factor}${suffix}`;
}

function formatMag(val){
	if(val === undefined || val === null || val === '' || Number.isNaN(Number(val))){
		return '--';
	}
	return `${Math.round(Number(val) * 100) / 100}`;
}

export function formatRa(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '--';
	}
	const total = Math.round(((((Number(val) / 15) % 24) + 24) % 24) * 3600) % (24 * 3600);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${h}h ${`${m}`.padStart(2, '0')}m ${`${s}`.padStart(2, '0')}s`;
}

export function formatHourAngle(deg){
	if(deg === undefined || deg === null || Number.isNaN(Number(deg))){
		return '--';
	}
	let d = ((Number(deg) % 360) + 360) % 360;
	if(d > 180){ d -= 360; } // [-180,180]:时角 = 本地恒星时 − 赤经,已过中天(在西)为正、未到中天(在东)为负
	const hours = d / 15;
	const sign = hours < 0 ? '-' : '+';
	const abs = Math.abs(hours);
	const h = Math.floor(abs);
	const m = Math.round((abs - h) * 60);
	const mm = m === 60 ? 0 : m;
	const hh = m === 60 ? h + 1 : h;
	return `${sign}${hh}h${`${mm}`.padStart(2, '0')}m`;
}

// 取亮星公认专名(中文优先),仅用于 starNames 标注。键由 STAR_PROPER_NAMES(HR 号)查得,
// 无专名返回 null → 只标famous 亮星,天然克制密度。坐标仍来自既有星表,不臆造。
export function starProperName(star){
	if(!star){ return null; }
	const id = star.id;
	let hr = star.hr;
	// id 形如 "bsc5-2491" → 取结尾的 HR 号(2491),不要前缀里的 "5"。
	if((hr === undefined || hr === null) && typeof id === 'string'){ const m = id.match(/(\d+)\s*$/); if(m){ hr = m[1]; } }
	const e = (id && STAR_PROPER_NAMES[id])
		|| ((hr !== undefined && hr !== null) && STAR_PROPER_NAMES[`HR${hr}`])
		|| ((hr !== undefined && hr !== null) && STAR_PROPER_NAMES[`${hr}`]);
	return e ? (e.zh || e.proper) : null;
}

export function valuePresent(value){
	return !(value === undefined || value === null || value === '' || value === '--');
}

function joinParts(parts, sep = ' · '){
	return (parts || []).filter(valuePresent).join(sep);
}

function angularDistance(start, end){
	return normalizeDegrees(Number(end) - Number(start));
}

export function circularMidpoint(start, end){
	return normalizeDegrees(Number(start) + angularDistance(start, end) / 2);
}

export function su28DisplayName(item){
	const name = item && (item.name || item.id);
	if(!name){
		return '宿';
	}
	return `${name}`.indexOf('宿') >= 0 ? `${name}` : `${name}宿`;
}

export function houseDisplayName(item, idx){
	const raw = item && (item.id || item.name || item.label);
	const match = raw !== undefined && raw !== null ? `${raw}`.match(/\d+/) : null;
	const num = match ? Number(match[0]) : idx + 1;
	return `${Number.isFinite(num) && num > 0 ? num : idx + 1}宫`;
}

export function preferredVisiblePoint(points){
	const visible = (points || []).filter((point)=>Number(point && point.altitudeAppa) > 0);
	const pool = visible.length ? visible : (points || []);
	if(!pool.length){
		return null;
	}
	return pool[Math.floor(pool.length / 2)];
}

export function allAboveHorizon(items){
	return (items || []).every((item)=>Number(item && item.altitudeAppa) > 0);
}

export function shouldShowModeBoundItem(item, viewMode, showBelowHorizon){
	if(!item || !item.visibilityMode){
		return true;
	}
	if(showBelowHorizon){
		return true; // 关「地面」:看地平线以下整个天球 —— 宿区间/区间等 mode-bound 元素不再按地平裁
	}
	if(item.visibilityMode === 'allAbove'){
		return viewMode === 'orbit' || allAboveHorizon(item.lastProjectedSources || item.visibilitySources);
	}
	if(item.visibilityMode === 'sourceAbove'){
		const source = item.lastProjectedSource || item.lastProjected || item.source;
		return viewMode === 'orbit' || Number(source && source.altitudeAppa) > 0;
	}
	return true;
}

export function bodyName(item){
	if(!item){
		return '天体';
	}
	return BODY_LABELS[item.id] || item.displayName || item.name || item.properName || item.bayer || item.id || '天体';
}

export function bodyEnglishName(item){
	if(!item){
		return '--';
	}
	if(BODY_ENGLISH_LABELS[item.id]){
		return BODY_ENGLISH_LABELS[item.id];
	}
	return joinParts([item.name && item.name !== item.displayName ? item.name : null, item.id], ' / ') || '--';
}

function objectType(item){
	if(!item){
		return '--';
	}
	if(item.kind === 'catalogStar'){
		return '裸眼恒星';
	}
	if(item.layer === 'su28'){
		return '二十八宿星点';
	}
	if(item.layer === 'beidou'){
		return '北斗星点';
	}
	if(item.layer === 'body'){
		if(item.id === 'Earth'){
			return '地球/观测点';
		}
		if(item.id === 'Sun'){
			return '太阳';
		}
		if(item.id === 'Moon'){
			return '月亮';
		}
		if(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].indexOf(item.id) >= 0){
			return '七政行星';
		}
		if(['Uranus', 'Neptune', 'Pluto'].indexOf(item.id) >= 0){
			return '现代外行星';
		}
		if(item.id === 'North Node' || item.id === 'South Node'){
			return '月交点';
		}
		return item.type || '天体';
	}
	return item.type || item.kind || item.layer || '--';
}

function layerLabel(item){
	const layer = item && item.layer;
	return {
		body: '太阳系天体',
		stars: '裸眼恒星',
		su28: '二十八宿',
		beidou: '北斗',
	}[layer] || layer || '--';
}

export function catalogIdText(item){
	if(!item){
		return '--';
	}
	const parts = [];
	if(item.id){ parts.push(item.id); }
	if(item.bayer){ parts.push(`拜耳 ${item.bayer}`); }
	if(item.flamsteed){ parts.push(`弗兰斯蒂德 ${item.flamsteed}`); }
	if(item.constellation){ parts.push(`星座 ${item.constellation}`); }
	return parts.join(' / ') || '--';
}

// 🆕 镜像后端 webplanetariumsrv.py 的 ZODIAC_LABELS/ZODIAC_IDS。外推后用 lon 重新算 zodiac sign + degree → mutate src 字段 → 右栏拿到外推值。
const ZODIAC_LABELS_CN = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
const ZODIAC_LABELS_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

export function zodiacInfoForLon(lon){
	const norm = ((Number(lon) % 360) + 360) % 360;
	const idx = Math.floor(norm / 30) % 12;
	return {
		zodiacSign: ZODIAC_LABELS_CN[idx],
		zodiacSignId: ZODIAC_LABELS_EN[idx],
		zodiacDegree: norm - idx * 30,
		sign: ZODIAC_LABELS_EN[idx],
		signlon: norm - idx * 30,
	};
}

// 🆕 用 cusps 数组(state.data.overlays.houses,12 项含 lon 字段)按 lon 重新算 house 编号(1..12 数字)。
// houses[i] 是第 i+1 宫起点 cusp:第 1 宫 = [houses[0].lon, houses[1].lon),...,第 12 宫 = [houses[11].lon, houses[0].lon+360)(跨 360 处理)。
export function houseForLon(lon, houses){
	if(!houses || houses.length < 12) return null;
	const norm = ((Number(lon) % 360) + 360) % 360;
	for(let i = 0; i < 12; i++){
		const start = ((Number(houses[i].lon) % 360) + 360) % 360;
		const end = ((Number(houses[(i+1) % 12].lon) % 360) + 360) % 360;
		if(start <= end){
			if(norm >= start && norm < end) return i + 1;
		}else{
			if(norm >= start || norm < end) return i + 1;
		}
	}
	return null;
}

function zodiacPositionText(item){
	if(!item){
		return '--';
	}
	if(valuePresent(item.zodiacSign) || valuePresent(item.zodiacDegree)){
		return `${item.zodiacSign || ''} ${formatDeg(item.zodiacDegree)}`.trim();
	}
	if(valuePresent(item.sign) || valuePresent(item.signlon)){
		return `${item.sign || ''} ${formatDeg(item.signlon)}`.trim();
	}
	return '--';
}

function skyPositionText(item){
	return joinParts([
		`高度 ${formatDeg(item && item.altitudeAppa)}`,
		`方位 ${formatDeg(item && item.azimuth)}`,
	]);
}

function equatorialText(item){
	return joinParts([
		`赤经 ${formatRa(item && item.ra)}`,
		`赤纬 ${formatDeg(item && item.decl)}`,
	]);
}

function eclipticText(item){
	return joinParts([
		`黄经 ${formatDeg(item && item.lon)}`,
		`黄纬 ${formatDeg(item && item.lat)}`,
	]);
}

function spectralText(item){
	return joinParts([
		item && item.spectralClass ? `光谱 ${item.spectralClass}` : null,
		item && valuePresent(item.colorTemperature) ? `色温 ${Math.round(Number(item.colorTemperature))}K` : null,
		item && valuePresent(item.colorIndex) ? `B-V ${formatNumber(item.colorIndex, 2)}` : null,
	]);
}

function moonPhaseText(phase){
	if(!phase){
		return '--';
	}
	return joinParts([
		phase.phaseName || phase.name,
		valuePresent(phase.illumination) ? `照明 ${Math.round(Number(phase.illumination) * 100)}%` : null,
		valuePresent(phase.ageDays) ? `月龄 ${formatNumber(phase.ageDays, 1)}天` : null,
		valuePresent(phase.phaseAngle) ? `相位角 ${formatDeg(phase.phaseAngle)}` : null,
	]);
}

function objectDescription(item){
	if(!item){
		return '';
	}
	if(item.kind === 'catalogStar'){
		return '裸眼恒星星表中的恒星，位置按当前时间与观测地投影到地平坐标。';
	}
	if(item.layer === 'su28'){
		return '二十八宿图层星点，随当前时间与观测地投影到真实可见天空。';
	}
	if(item.layer === 'beidou'){
		return '北斗图层星点，连线与星点共同随天球旋转更新。';
	}
	if(item.layer === 'body'){
		if(item.id === 'Sun' || item.id === 'Moon' || ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].indexOf(item.id) >= 0){
			return `${bodyName(item)}的位置来自瑞士星历，并结合当前经纬度换算为地平坐标。`;
		}
		if(item.id === 'North Node' || item.id === 'South Node'){
			return `${bodyName(item)}为月球轨道与黄道的交点，按当前星盘时间显示其黄道位置。`;
		}
	}
	return '';
}

export function detailRowsForItem(item, moonPhase){
	if(!item){
		return [];
	}
	const isBody = item.layer === 'body';
	const isStar = item.kind === 'catalogStar' || item.layer === 'stars';
	const isTraditional = item.layer === 'su28' || item.layer === 'beidou';
	// 🆕 item.house 后端给 "House5" 字符串(flatlib 风格),外推后我们设纯数字 5 — 兼容两者,提取纯数字显示「第5宫」。
	const houseRaw = item.house;
	const houseNum = (typeof houseRaw === 'number') ? houseRaw
		: (typeof houseRaw === 'string' ? (houseRaw.match(/\d+/) || [null])[0] : null);
	const chartPosition = joinParts([
		zodiacPositionText(item),
		valuePresent(houseNum) ? `第${houseNum}宫` : null,
		valuePresent(item.su28) ? `${item.su28}` : null,
	]);
	const rows = [
		['具体名称', bodyName(item)],
		['类型', objectType(item)],
		['图层', layerLabel(item)],
		['编号/别名', isStar ? catalogIdText(item) : bodyEnglishName(item)],
		['可见性', visibilityText(item)],
		['地平坐标', skyPositionText(item)],
		['赤道坐标', equatorialText(item)],
		['黄道坐标', eclipticText(item)],
		['星盘位置', chartPosition],
		['星等', formatMag(item.mag)],
		['光谱/色温', spectralText(item)],
		['黄经速度', valuePresent(item.lonspeed) ? `${formatNumber(item.lonspeed, 4)}°/日` : '--'],
	];
	if(item.id === 'Moon'){
		rows.push(['月相', moonPhaseText(moonPhase)]);
	}
	if(isTraditional && valuePresent(item.su28)){
		rows.push(['所属宿', item.su28]);
		if(item.distanceStar){ rows.push(['距星', item.distanceStar]); }   // 胃=35 Ari / 鬼=θ Cnc(真实星位)
	}
	if(isBody && valuePresent(item.sign)){
		rows.push(['占星星座', joinParts([item.sign, valuePresent(item.signlon) ? formatDeg(item.signlon) : null], ' ')]);
	}
	rows.push(['说明', objectDescription(item)]);
	return rows.filter((row)=>{
		const value = row[1];
		return valuePresent(value) && value !== '高度 -- · 方位 --' && value !== '赤经 -- · 赤纬 --' && value !== '黄经 -- · 黄纬 --';
	});
}

function visibilityText(item){
	if(!item){
		return '--';
	}
	const state = item.horizonState || (Number(item.altitudeAppa || 0) > 0 ? '可见' : '不可见');
	return item.visible === false ? `${state} · 条件不佳` : state;
}

export function moonPhaseGlyph(phase){
	if(!phase){
		return '○';
	}
	const angle = Number(phase.phaseAngle || 0);
	if(angle < 22.5 || angle >= 337.5){ return '●'; }
	if(angle < 67.5){ return '☽'; }
	if(angle < 112.5){ return '◐'; }
	if(angle < 157.5){ return '◑'; }
	if(angle < 202.5){ return '○'; }
	if(angle < 247.5){ return '◐'; }
	if(angle < 292.5){ return '◑'; }
	return '☾';
}
