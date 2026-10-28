import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

// 取某座某度的界主 glyph,按所选界系表(termsTable,含迦勒底昼/夜);缺省=埃及(零回归)。
export function whichTerm(sign, deg, termsTable){
	let ary = (termsTable || AstroConst.EGYPTIAN_TERMS)[sign];
	if(!ary){ return '未知'; }
	for(let i=0; i<ary.length; i++){
		let term = ary[i];
		if(term[1] <= deg && term[2] > deg){
			let itm = term[0];
			return AstroText.AstroMsg[itm];
		}
	}
	return '未知';
}

export function splitDegree(degree){
	let res = [];
	let degstr = degree + '';
	degstr = degstr.toLowerCase();
	let parts = degstr.split('e');
	let deg = parseFloat(degree + '');
	res[0] = parseInt(degree + '');
	let neg = false;
	if(deg < 0){
		neg = true;
		deg = Math.abs(deg);
		res[0] = Math.abs(res[0]);
	}

	if(parts.length === 2 && parseInt(parts[1]) < 0){
		res[0] = 0;
		deg = 0;
	}
	let minute = (deg - res[0]) * 60;
	res[1] = parseInt(Math.floor(minute) + '');
	let sec = (minute - res[1]) * 60;
	res[2] = parseInt(Math.round(sec) + '');
	if(res[2] === 60){
		res[1] = res[1] + 1;
		res[2] = 0;
	}
	if(res[1] === 60){
		res[0] = res[0] + 1;
		res[1] = 0;
	}
	if(neg){
		res[0] = 0 - res[0];
		res[3] = ['-'];
	}
	return res;
}

export function convertLatToStr(degree){
	// 方向按【原始值符号】判:|值|<1 时 splitDegree 的度部分=0、负号会丢(-0 === 0),
	// 若用 deg[0]>=0 判向会把 -0.12° 误判成北/东。度分一律取绝对值,补两位。
	const v = parseFloat(degree + '');
	const dir = (Number.isFinite(v) && v < 0) ? 's' : 'n';
	const deg = splitDegree(Math.abs(Number.isFinite(v) ? v : 0));
	const min = Math.abs(deg[1] || 0);
	return (Math.abs(deg[0] || 0)) + dir + (min >= 10 ? min : '0' + min);
}

export function convertLonToStr(degree){
	const v = parseFloat(degree + '');
	const dir = (Number.isFinite(v) && v < 0) ? 'w' : 'e';
	const deg = splitDegree(Math.abs(Number.isFinite(v) ? v : 0));
	const min = Math.abs(deg[1] || 0);
	return (Math.abs(deg[0] || 0)) + dir + (min >= 10 ? min : '0' + min);
}

// 十进制经度 → 度分秒展示字符串(如 116°24′27″E),按原始符号判东西。
export function formatLonDms(lng){
	const v = parseFloat(lng + '');
	if(!Number.isFinite(v)){
		return '';
	}
	const dir = v < 0 ? 'W' : 'E';
	const dms = splitDegree(Math.abs(v));
	return `${dms[0]}°${dms[1]}′${dms[2]}″${dir}`;
}

// 十进制纬度 → 度分秒展示字符串(如 39°54′15″N),按原始符号判南北。
export function formatLatDms(lat){
	const v = parseFloat(lat + '');
	if(!Number.isFinite(v)){
		return '';
	}
	const dir = v < 0 ? 'S' : 'N';
	const dms = splitDegree(Math.abs(v));
	return `${dms[0]}°${dms[1]}′${dms[2]}″${dir}`;
}

// 'NNnMM' / 'NNsMM' 串 → 十进制纬度。原实现 `deg + 1.0/min`(应为 min/60)+ else 分支 `*10` 均错,
// 致手输经纬度时算出的 gpsLat 偏(116e24→116.04 而非 116.4),进而地图点位/时区推断偏。重写为标准 deg+min/60。
export function convertLatStrToDegree(lat){
	if(lat === undefined || lat === null){
		return null;
	}
	const str = `${lat}`.toLowerCase().trim();
	let positive = 1;
	let parts = str.split('n');
	if(parts.length === 1){
		parts = str.split('s');
		positive = -1;
	}
	const deg = parseInt(parts[0], 10) || 0;
	const min = parts.length > 1 ? (parseInt(parts[1], 10) || 0) : 0;
	return (deg + min / 60.0) * positive;
}

export function convertLonStrToDegree(lon){
	if(lon === undefined || lon === null){
		return null;
	}
	const str = `${lon}`.toLowerCase().trim();
	let positive = 1;
	let parts = str.split('e');
	if(parts.length === 1){
		parts = str.split('w');
		positive = -1;
	}
	const deg = parseInt(parts[0], 10) || 0;
	const min = parts.length > 1 ? (parseInt(parts[1], 10) || 0) : 0;
	return (deg + min / 60.0) * positive;
}

export function getDignityText(ary){
	if(ary === undefined || ary === null){
		return null;
	}
	let res = ary.map((item)=>{
		return AstroText.AstroMsg[item];
	});
	return res.length === 0 ? '游走' : res.join('，');
}

export function getObjectsText(ary){
	if(ary === undefined || ary === null || ary.length === 0){
		return null;
	}
	let res = ary.map((item)=>{
		return AstroText.AstroMsg[item];
	});
	return res.join(' , ')
}

export function getStars(chartObj, objid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.starMap){
		return chartObj.starMap[objid];
	}
	chartObj.starMap = {};
	for(let i = 0; i<chartObj.chart.stars.length; i++){
		let star = chartObj.chart.stars[i];
		chartObj.starMap[star.id] = star.stars
	}
	return chartObj.starMap[objid];
}

export function getObject(chartObj, objid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.objectMap){
		return chartObj.objectMap[objid];
	}
	chartObj.objectMap = {};
	for(let i=0; i<chartObj.chart.objects.length; i++ ){
		let obj = chartObj.chart.objects[i];
		chartObj.objectMap[obj.id] = obj;
	}
	if(chartObj.lots){
		for(let i=0; i<chartObj.lots.length; i++ ){
			let obj = chartObj.lots[i];
			chartObj.objectMap[obj.id] = obj;
		}	
	}
	return chartObj.objectMap[objid];
}

// 座内度分:黄经(可负,先补 360)→ [座内整度, 整分](均向下取整);非数 → [0, 0]。
// 与上面的 splitDegree(把度数拆成度 / 分 / 秒)不是一回事。
export function signDegMin(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

// 星体 / 星座 id → 显示名:AstroTxtMsg 优先,其次 AstroMsg,都没有就原样输出;null / undefined → ''。
export function astroMsgText(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

// 字形字体的单字符码 → 中文名(AstroMsg 取到的是字形码时用,免得字形码混进纯文本)。
const SIMPLE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	p: '福点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	Y: '月亮平均远地点',
	$: '月亮平均近地点',
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
	0: '上升',
	1: '天顶',
	2: '天底',
	3: '下降',
	4: '谷神星',
	5: '智神星',
	6: '婚神星',
	7: '灶神星',
	8: '人龙星',
};

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

// 同 astroMsgText,但 AstroMsg 取到单字符字形码时改出中文名(字形码表里没有就原样输出 id)。
export function astroMsgPlainText(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(!isEncodedToken(val)){
			return `${val}`;
		}
	}
	const one = `${id}`.trim();
	if(one.length === 1 && SIMPLE_TOKEN_MAP[one]){
		return SIMPLE_TOKEN_MAP[one];
	}
	return `${id}`;
}
