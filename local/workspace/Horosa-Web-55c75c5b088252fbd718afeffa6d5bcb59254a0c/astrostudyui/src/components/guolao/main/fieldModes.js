// 七政四余页 · 字段口径:宫位推算(由黄经取宫、命宫序)、宫位全称、命宫口径与二十八宿口径的读取与名称。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';
import { SU28_MODE_LABEL } from '../guolaoData';
import { moiraLifeDegree as lifeDegree } from '../GuoLaoMoiraWheel';
import {
	GUOLAO_LIFE_MODE_COTRANS, GUOLAO_LIFE_MODE_YUMAO, getStoredGuolaoLifeMode, getStoredGuolaoSu28Mode,
	normalizeGuolaoLifeMode,
} from '../GuoLaoChartStyle';
import * as AstroText from '../../../constants/AstroText';
import * as SZConst from '../../suzhan/SZConst';
import { astroMsgPlainText as msg } from '../../astro/AstroHelper';

export function signFromLon(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return null;
	}
	let val = Number(lon) % 360;
	if(val < 0){
		val += 360;
	}
	const idx = Math.floor(val / 30) % 12;
	return AstroConst.LIST_SIGNS[idx];
}

export function guolaoLifeModeFromFields(fields){
	if(fields && fields.guolaoLifeMode && fields.guolaoLifeMode.value !== undefined && fields.guolaoLifeMode.value !== null){
		return normalizeGuolaoLifeMode(fields.guolaoLifeMode.value);
	}
	return getStoredGuolaoLifeMode();
}

// 七政宿度制(su28Mode 0-8)：优先 fields.doubingSu28（页面选/存盘值，数据丢失修复后保真），
// 缺省回退 getStoredGuolaoSu28Mode（AI 挂载抽屉「宿度制」/全局默认 0 = 荀爽距星）。与 命度/罗计 同口径。
export function guolaoSu28ModeFromFields(fields){
	if(fields && fields.doubingSu28 && fields.doubingSu28.value !== undefined && fields.doubingSu28.value !== null){
		const v = Number(fields.doubingSu28.value);
		// 值域单源 SU28_MODE_LABEL(含 8=赤道回归实时);此前手抄 [0..7] 漏 8 → 存 8 的盘回退全局档。
		if(Number.isFinite(v) && Object.prototype.hasOwnProperty.call(SU28_MODE_LABEL, v)){
			return v;
		}
	}
	return getStoredGuolaoSu28Mode();
}

export function guolaoLifeModeName(mode){
	const normalized = normalizeGuolaoLifeMode(mode);
	if(normalized === GUOLAO_LIFE_MODE_YUMAO){
		return '日出安命';
	}
	if(normalized === GUOLAO_LIFE_MODE_COTRANS){
		return '赤黄转换';
	}
	if(normalized === 'gumao'){
		return '遇卯安命(古法)';
	}
	if('子丑寅卯辰巳午未申酉戌亥'.indexOf(normalized) >= 0){
		return `自定命宫·${normalized}`;
	}
	return '占星上升';
}

// 「第 N 宫」以七政自身命宫为第 1 宫:命度 = lifeDegree(命主取法 asc/日出/赤黄/古法遇卯/自定,黄经,
// 与右栏「命身与限度」/ 大限表同源),不再读宿占页「人事十二宫起盘」键(八字公式/上升)——此前缺省盘该表第 1 宫≠
// 同一快照「命宫」,且改宿占起盘法七政快照宫序跟着变。无星体数据返回 -1(沿用后端宫名)。
export function computeAscSignIndex(result, chart, fields){
	const objects = chart && chart.objects ? chart.objects : [];
	if(!objects.length){
		return -1;
	}
	const life = Number(lifeDegree(chart, fields, true));
	if(!Number.isFinite(life)){
		return -1;
	}
	return Math.floor((((life % 360) + 360) % 360) / 30);
}

export function houseFullLabel(house, idx, ascSignIndex){
	let houseName = msg(house && house.id ? house.id : null) || `第${idx + 1}宫`;
	const sign = signFromLon(house ? house.lon : null);
	if(!sign){
		return houseName;
	}
	const signIdx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(signIdx >= 0 && ascSignIndex >= 0){
		const hnum = (signIdx - ascSignIndex + 12) % 12 + 1;
		houseName = `第${hnum}宫`;
	}
	const zi = SZConst.SignZi[sign] || '';
	const area = (SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2)
		? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
		: '';
	const signName = AstroText.AstroMsgCN[sign] || msg(sign);
	return `${zi}—${area}—${signName}座—${houseName}`;
}
