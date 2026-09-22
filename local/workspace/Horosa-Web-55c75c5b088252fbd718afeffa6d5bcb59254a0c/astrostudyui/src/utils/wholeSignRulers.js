// utils/wholeSignRulers.js
// 西占「宫主」派生单源(纯函数,零 React、零存储):AI 快照 [主宰星链]/[分宫制宫神星表] 与主页
// AstroDispositor 面板共用,两处不得各写一份查表(此前两份实现=口径漂移温床,Windows #79)。
//
// 口径铁律(古典教程:整宫制定宫位主宰,四分仪制衡量行星力量):
//   · 宫主/主宰 一律按 **整宫制自上升星座起算** —— 与后端 perchart.py 给每颗行星打的 ruleHouses
//     (快照 [起盘信息] 行星后的 nR 标记)同源:后端同样从 Asc 星座序号起数 12 宫取 ESSENTIAL_DIGNITIES[..].ruler。
//   · 「当前分宫制」的宫头星座宫主表(houseRows)只用于行星力量/角续果/实际落宫,**不是**主宰依据。
//   · 福点整宫制(hsys 24)从福点起算,≠ 上升整宫制:isAscWholeSign 只认 hsys 0 / 'Whole Sign'。
import * as AstroConst from '../constants/AstroConst';
import { getObjectsMapPure } from './fortuneChartPrimitives';

export const WHOLE_SIGN_RULERS_HEADERS = ['宫', '整宫星座', '宫主', '宫主落宫(整宫)', '宫主落座'];
export const HOUSE_SYSTEM_RULERS_HEADERS = ['宫', '宫头座', '宫主', '宫主落宫', '宫主落座'];

function norm360(x){
	const n = Number(x);
	if(!Number.isFinite(n)){
		return null;
	}
	return ((n % 360) + 360) % 360;
}

function signIndex(sign){
	if(sign === undefined || sign === null){
		return -1;
	}
	return AstroConst.LIST_SIGNS.indexOf(`${sign}`);
}

// 黄经 → AstroConst 星座名('Aries'…);非数 → null。
export function signOfLon(lon){
	const n = norm360(lon);
	if(n === null){
		return null;
	}
	return AstroConst.LIST_SIGNS[Math.floor(n / 30) % 12];
}

// 'House7' / 'House 7' → 7;非宫 id → null。
export function houseNumOfId(id){
	const m = /House\s*(\d+)/.exec(`${id || ''}`);
	if(!m){
		return null;
	}
	const n = parseInt(m[1], 10);
	return n >= 1 && n <= 12 ? n : null;
}

// 星座的传统庙主(与后端 ESSENTIAL_DIGNITIES[sign]['ruler'] 同表:天蝎=火、宝瓶=土、双鱼=木)。
export function rulerOfSign(sign){
	const prop = sign ? AstroConst.SignsProp[`${sign}`] : null;
	return prop && prop.Ruler ? prop.Ruler : null;
}

function objectSign(obj){
	if(!obj){
		return null;
	}
	if(obj.sign && signIndex(obj.sign) >= 0){
		return `${obj.sign}`;
	}
	if(obj.lon !== undefined && obj.lon !== null){
		return signOfLon(obj.lon);
	}
	return null;
}

function houseById(chartObj, id){
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	const houses = chart && Array.isArray(chart.houses) ? chart.houses : [];
	for(let i=0; i<houses.length; i++){
		if(houses[i] && houses[i].id === id){
			return houses[i];
		}
	}
	return null;
}

// 上升星座:Asc.sign → House1.sign → Asc.lon 换算 → House1.lon 换算 → null。
export function resolveAscSign(chartObj){
	const objectMap = getObjectsMapPure(chartObj);
	const asc = objectMap[AstroConst.ASC];
	if(asc && asc.sign && signIndex(asc.sign) >= 0){
		return `${asc.sign}`;
	}
	const house1 = houseById(chartObj, AstroConst.HOUSE1);
	if(house1 && house1.sign && signIndex(house1.sign) >= 0){
		return `${house1.sign}`;
	}
	if(asc && asc.lon !== undefined && asc.lon !== null){
		const s = signOfLon(asc.lon);
		if(s){
			return s;
		}
	}
	if(house1 && house1.lon !== undefined && house1.lon !== null){
		return signOfLon(house1.lon);
	}
	return null;
}

// 整宫制宫号:自上升星座起算(上升座=1 宫)。任一星座无效 → null。
export function wholeSignHouseOf(sign, ascSign){
	const si = signIndex(sign);
	const ai = signIndex(ascSign);
	if(si < 0 || ai < 0){
		return null;
	}
	return ((si - ai + 12) % 12) + 1;
}

// 数字宫制 → 是否「上升整宫制」。只认 0;福点整宫制(24)从福点起算,恒 false。
function numIsAscWholeSign(num){
	return `${num}` === '0';
}

// 后端 echo 文本 → 数字宫制('0'…'24');认不出 → null。'Whole Sign'/'整宫制' → '0';'Alcabitius'(后端拼写)→ '1'。
function houseSystemNumOfText(text){
	if(text === undefined || text === null || text === ''){
		return null;
	}
	const t = `${text}`.trim();
	if(t === AstroConst.HSYS_Whole_Sign || t === '整宫制'){
		return '0';
	}
	if(t === 'Alcabitius' || t === AstroConst.HSYS_Alcabitus){
		return '1';
	}
	const keys = Object.keys(AstroConst.HouseSys);
	for(let i=0; i<keys.length; i++){
		if(AstroConst.HouseSys[keys[i]] === t){
			return keys[i];
		}
	}
	// flatlib 内部拼写(极区回退标记/盘级回显用它):显式别名,不走宽泛翻译表(未知文本保持 null=不折叠的安全方向)
	const alias = FLATLIB_HSYS_ALIAS[t];
	if(alias){
		for(let i=0; i<keys.length; i++){
			if(AstroConst.HouseSys[keys[i]] === alias){
				return keys[i];
			}
		}
	}
	return null;
}
const FLATLIB_HSYS_ALIAS = { Porphyrius: 'Porphyry', Azimuthal: 'Horizontal' };

function fieldValue(fields, key){
	if(!fields){
		return null;
	}
	const f = fields[key];
	if(f && typeof f === 'object' && f.value !== undefined){
		return f.value;
	}
	return f !== undefined ? f : null;
}

// 当前分宫制:{ num, label, isAscWholeSign }。
// 取值序与 [起盘信息] 同:fields.hsys(请求入参)→ params.hsys(请求 echo)→ 反查 chart.hsys 文本。
// 数字位命中即为权威(fields 就是发出去的排盘入参);仅当数字位缺失才信后端文本。
// [Q-148/T-55] 派生盘(调波/龙盘/十三分/十二分)的宫位被后端强制为「变换后上升整宫」、每宫 30°,
// 与请求里的分宫制无关;此前标注仍照 params.hsys 报用户分宫制(如 Alcabitus)= 标注与数值分叉。
// 后端在每宫打 houses[].hsysDerived='wholeFromAsc'(手法同极区回退的 hsysFallback),此处据此改标注,
// 数值一概不动(龙盘宫头是否改刚性旋转另议,那会改产物)。
export const DERIVED_WHOLE_SIGN_LABEL = '整宫(变换后上升)';
export function derivedWholeSignLabelOf(chart){
	const houses = chart && Array.isArray(chart.houses) ? chart.houses : [];
	for(let i=0; i<houses.length; i++){
		if(houses[i] && houses[i].hsysDerived === 'wholeFromAsc'){
			return DERIVED_WHOLE_SIGN_LABEL;
		}
	}
	return '';
}

export function resolveHouseSystem(chartObj, fields){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	let num = null;
	const candidates = [fieldValue(fields, 'hsys'), params.hsys];
	for(let i=0; i<candidates.length && num === null; i++){
		const raw = candidates[i];
		if(raw === undefined || raw === null || raw === ''){
			continue;
		}
		if(AstroConst.HouseSys[`${raw}`] !== undefined){
			num = `${raw}`;
		}
	}
	const echoText = chart.hsys !== undefined && chart.hsys !== null ? `${chart.hsys}` : '';
	if(num === null){
		num = disambiguateEchoNum(chartObj, houseSystemNumOfText(echoText));
	}
	const baseLabel = (num !== null ? AstroConst.HouseSys[num] : '') || echoText || '';
	// 极区回退:象限制在极圈内无解时后端兜底 Porphyry,响应仍标请求宫制、逐宫带 hsysFallback
	// (flatlib swe.py)。表头必须说真话——宫头是按回退制算的,否则「当前分宫制(Placidus)」是假话。
	const fallback = houseSystemFallbackOf(chart);
	const derivedLabel = derivedWholeSignLabelOf(chart);   // [Q-148] 派生盘:标注只认宫位实算口径
	const label = derivedLabel || (fallback ? `${baseLabel}→回退${fallback}` : baseLabel);
	const isAscWholeSign = num !== null
		? numIsAscWholeSign(num)
		: (echoText === AstroConst.HSYS_Whole_Sign || echoText === '整宫制');
	// 形状保持 { num, label, isAscWholeSign };仅极区回退时附 fallback(既有精确断言零变)
	return fallback ? { num, label, isAscWholeSign, fallback } : { num, label, isAscWholeSign };
}

// 极区回退标记:houses[].hsysFallback(后端回退制名,如 'Porphyry');译成选项表标签,认不出原样返回。
export function houseSystemFallbackOf(chart){
	const houses = chart && Array.isArray(chart.houses) ? chart.houses : [];
	for(let i=0; i<houses.length; i++){
		const fb = houses[i] && houses[i].hsysFallback;
		if(fb){
			const num = houseSystemNumOfText(fb);
			return (num !== null ? AstroConst.HouseSys[num] : '') || `${fb}`;
		}
	}
	return '';
}

// 文本兜底的撞名消歧(仅数字位缺失时才走到这里):后端 perchart 把 hsys 24(福点整宫制)的盘级回显写成
// 'Whole Sign'、hsys 8(天顶为10宫中点等宫制)写成 'Alcabitus',与 0/1 撞名。用盘面数据自证:
//  ·'Whole Sign' 但 House1 星座≠上升星座 → 宫头不是从上升起算 → 24(否则误折叠成上升整宫制);
//  ·'Alcabitus' 但 12 宫宫头 size 全≈30° → 等宫族而非象限制 → 8。
function disambiguateEchoNum(chartObj, num){
	if(num !== '0' && num !== '1'){
		return num;
	}
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const houses = Array.isArray(chart.houses) ? chart.houses : [];
	if(num === '0'){
		const ascSign = resolveAscSign(chartObj);
		const house1 = houseById(chartObj, AstroConst.HOUSE1);
		const h1Sign = house1 ? objectSign(house1) : null;
		if(ascSign && h1Sign && h1Sign !== ascSign){
			return '24';
		}
		return num;
	}
	const sizes = houses.map((h)=>(h && Number.isFinite(Number(h.size)) ? Number(h.size) : null));
	if(sizes.length === 12 && sizes.every((s)=>s !== null && Math.abs(s - 30) < 0.01)){
		return '8';
	}
	return num;
}

function rulerRow(house, sign, objectMap, rulerHouseNumOf){
	const ruler = rulerOfSign(sign);
	if(!ruler){
		return null;
	}
	const rulerObj = objectMap[ruler];
	if(!rulerObj){
		return { house, sign, ruler, rulerFound: false, rulerHouseNum: null, rulerHouseId: null, rulerSign: null };
	}
	const rulerSign = objectSign(rulerObj);
	const rulerHouseNum = rulerHouseNumOf(rulerObj, rulerSign);
	return {
		house,
		sign,
		ruler,
		rulerFound: true,
		rulerHouseNum,
		rulerHouseId: rulerHouseNum ? `House${rulerHouseNum}` : null,
		rulerSign: rulerSign || null,
	};
}

// 整宫制宫主表:12 行(1..12 宫),星座自上升座顺数;宫主落宫按整宫制(宫主所在星座相对上升座)。
// 无法定出上升座 → [](调用方据此省略整段/口径行)。
export function buildWholeSignRulerRows(chartObj){
	const ascSign = resolveAscSign(chartObj);
	const ai = signIndex(ascSign);
	if(ai < 0){
		return [];
	}
	const objectMap = getObjectsMapPure(chartObj);
	const rows = [];
	for(let h=1; h<=12; h++){
		const sign = AstroConst.LIST_SIGNS[(ai + h - 1) % 12];
		const row = rulerRow(h, sign, objectMap, (_obj, rulerSign)=>wholeSignHouseOf(rulerSign, ascSign));
		if(row){
			rows.push(row);
		}
	}
	return rows;
}

// 当前分宫制宫神星表:按 chart.houses 各宫头星座取宫主;宫主落宫=后端给的实际落宫(obj.house,当前分宫制)。
// houses 数组按黄经序返回(House8/9/10…),必须从 h.id 取真宫号再按 1..12 排(CRASH-1 教训)。
export function buildHouseSystemRulerRows(chartObj){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const houses = Array.isArray(chart.houses) ? chart.houses : [];
	if(!houses.length){
		return [];
	}
	const objectMap = getObjectsMapPure(chartObj);
	const seeds = [];
	houses.forEach((h)=>{
		if(!h || !h.id){
			return;
		}
		const houseNum = houseNumOfId(h.id);
		if(!houseNum){
			return;
		}
		const sign = objectSign(h);
		if(!sign){
			return;
		}
		seeds.push({ houseNum, sign });
	});
	seeds.sort((a, b)=>a.houseNum - b.houseNum);
	const rows = [];
	seeds.forEach(({ houseNum, sign })=>{
		const row = rulerRow(houseNum, sign, objectMap, (obj)=>houseNumOfId(obj.house));
		if(row){
			rows.push(row);
		}
	});
	return rows;
}
