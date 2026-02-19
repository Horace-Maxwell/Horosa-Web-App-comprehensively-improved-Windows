export const STYLE_OPTIONS = [
	{ value: 3, label: '時計太乙' },
	{ value: 0, label: '年計太乙' },
	{ value: 1, label: '月計太乙' },
	{ value: 2, label: '日計太乙' },
	{ value: 4, label: '分計太乙' },
	{ value: 5, label: '太乙命法' },
];

export const ACCUM_OPTIONS = [
	{ value: 0, label: '太乙統宗' },
	{ value: 1, label: '太乙金鏡' },
	{ value: 2, label: '太乙淘金歌' },
	{ value: 3, label: '太乙局' },
];

export const TENCHING_OPTIONS = [
	{ value: 0, label: '無' },
	{ value: 1, label: '有' },
];

export const SEX_OPTIONS = [
	{ value: '男', label: '男' },
	{ value: '女', label: '女' },
];

export const ROTATION_OPTIONS = [
	{ value: '固定', label: '固定' },
	{ value: '轉動', label: '轉動' },
];

const DI_ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const JIEQI_ORDER = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
const PALACE_ORDER = ['巽', '巳', '午', '未', '坤', '申', '酉', '戌', '乾', '亥', '子', '丑', '艮', '寅', '卯', '辰'];

const TAIYI_PAI = '乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽乾乾乾午午午艮艮艮卯卯卯酉酉酉坤坤坤子子子巽巽巽'.split('');
const SF_LIST = '坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午坤戌亥丑寅辰巳坤酉乾丑寅辰午坤酉亥子艮辰巳未申戌亥艮卯巽未丑戌子艮卯巳午'.split('');
const SKYEYES_YANG = '申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤申酉戌乾乾亥子丑艮寅卯辰巽巳午未坤坤'.split('');
const SKYEYES_YIN = '寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮寅卯辰巽巽巳午未坤申酉戌乾亥子丑艮艮'.split('');

const YANG_CAL = [[7,13,13],[6,1,1],[1,40,32],[25,17,10],[25,14,1],[25,10,12],[8,25,9],[1,22,3],[3,15,33],[1,12,25],[4,4,13],[37,1,4],[18,19,19],[10,9,9],[9,7,6],[1,33,26],[7,27,16],[7,26,11],[8,32,14],[7,26,2],[2,17,33],[16,30,1],[16,23,32],[16,17,23],[39,40,40],[32,31,31],[31,28,31],[14,9,38],[13,39,26],[10,32,17],[33,10,34],[25,8,24],[24,3,15],[26,4,11],[25,28,1],[25,27,36],[1,7,7],[6,35,35],[35,34,26],[27,19,12],[27,16,3],[27,12,34],[8,17,1],[23,14,32],[32,7,25],[5,16,29],[4,8,17],[1,5,8],[24,25,25],[16,15,15],[15,13,6],[39,31,24],[38,25,14],[38,24,9],[16,3,22],[15,34,10],[10,25,10],[12,26,27],[12,19,28],[12,13,19],[33,34,34],[26,25,25],[25,22,18],[16,11,7],[15,1,28],[12,34,19],[25,2,26],[17,8,16],[16,32,7],[30,4,15],[29,32,5],[29,31,9]];
const YIN_CAL = [[5,29,7],[4,17,1],[1,16,30],[25,33,2],[25,30,1],[17,26,10],[2,3,3],[1,7,7],[7,33,27],[1,24,25],[6,26,19],[35,23,8],[12,37,12],[12,27,11],[11,25,4],[1,15,24],[3,9,16],[3,8,9],[14,16,16],[13,10,10],[10,1,39],[24,14,1],[24,7,40],[16,1,29],[31,16,32],[30,7,29],[29,4,26],[8,25,32],[7,15,26],[2,8,15],[27,28,28],[27,26,26],[26,18,15],[29,22,9],[25,10,1],[25,9,34],[1,25,3],[4,13,37],[37,12,26],[33,1,10],[33,38,9],[25,34,38],[2,1,1],[39,38,38],[38,31,25],[7,1,31],[6,32,25],[1,29,14],[16,1,17],[16,31,15],[15,29,4],[33,7,16],[32,1,8],[32,8,1],[16,18,18],[15,12,12],[12,3,1],[18,8,35],[18,1,34],[10,35,25],[27,22,28],[26,3,25],[25,4,12],[16,33,3],[15,23,34],[10,16,23],[25,26,26],[25,24,24],[24,16,13],[32,28,15],[31,16,7],[31,15,1]];

function normalizeNum(v, def = 0){
	const n = parseInt(v, 10);
	return Number.isNaN(n) ? def : n;
}

function rotateFrom(arr, startVal){
	const idx = arr.indexOf(startVal);
	if(idx < 0){
		return arr.slice(0);
	}
	return arr.slice(idx).concat(arr.slice(0, idx));
}

function toCnNum(num){
	const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
	if(num < 10){
		return d[num];
	}
	if(num < 20){
		return `十${d[num % 10] === '零' ? '' : d[num % 10]}`;
	}
	const ten = Math.floor(num / 10);
	const one = num % 10;
	return `${d[ten]}十${one === 0 ? '' : d[one]}`;
}

function safeSecondChar(gz){
	const t = `${gz || ''}`.trim();
	if(!t){
		return '';
	}
	if(t.length >= 2){
		return t.substr(1, 1);
	}
	return t.substr(0, 1);
}

function safeFirstChar(gz){
	const t = `${gz || ''}`.trim();
	if(!t){
		return '';
	}
	return t.substr(0, 1);
}

function parseDateTime(fields){
	if(!fields || !fields.date || !fields.time){
		return null;
	}
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = fields.time.value.format('HH:mm:ss');
	const dparts = dateStr.split('-');
	const tparts = timeStr.split(':');
	if(dparts.length < 3 || tparts.length < 2){
		return null;
	}
	const year = normalizeNum(dparts[0], 0);
	const month = normalizeNum(dparts[1], 1);
	const day = normalizeNum(dparts[2], 1);
	const hour = normalizeNum(tparts[0], 0);
	const minute = normalizeNum(tparts[1], 0);
	const second = normalizeNum(tparts[2], 0);
	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
		dateStr,
		timeStr,
	};
}

function extractCurrentJieqi(nongli){
	if(!nongli){
		return '';
	}
	const delta = `${nongli.jiedelta || ''}`;
	const idx = delta.indexOf('后第');
	if(idx > 0){
		return delta.substring(0, idx);
	}
	return `${nongli.jieqi || ''}`;
}

function guessLunarYear(dateParts, nongli){
	if(!dateParts){
		return 0;
	}
	let y = dateParts.year;
	if(nongli && typeof nongli.monthInt === 'number'){
		if(dateParts.month <= 2 && nongli.monthInt >= 11){
			y -= 1;
		}
	}
	return y;
}

function dayDiffUTC(dateParts, baseYear, baseMonth, baseDay){
	const dateUTC = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, dateParts.hour, dateParts.minute, 0);
	const baseUTC = Date.UTC(baseYear, baseMonth - 1, baseDay, 0, 0, 0);
	return Math.floor((dateUTC - baseUTC) / (24 * 3600 * 1000));
}

function getAccNum(style, tn, dateParts, nongli){
	const lunarYear = guessLunarYear(dateParts, nongli);
	const lunarMonth = nongli && nongli.monthInt ? normalizeNum(nongli.monthInt, dateParts.month) : dateParts.month;
	const lunarDay = nongli && nongli.dayInt ? normalizeNum(nongli.dayInt, dateParts.day) : dateParts.day;
	const tnDict = { 0: 10153917, 1: 1936557, 2: 10154193, 3: 10153917 };
	const tnc = tnDict[tn] !== undefined ? tnDict[tn] : tnDict[0];

	if(style === 0){
		return tnc + lunarYear + (lunarYear < 0 ? 1 : 0);
	}
	if(style === 1){
		const accyear = tnc + lunarYear - 1 + (lunarYear < 0 ? 2 : 0);
		return accyear * 12 + 2 + lunarMonth;
	}
	if(style === 2){
		const diff = dayDiffUTC(dateParts, 1900, 6, 19);
		const configNum = 708011105 - ({ 0: 0, 1: 185, 2: 10153917, 3: 0 }[tn] || 0);
		return configNum + diff;
	}
	if(style === 3){
		const diff = dayDiffUTC(dateParts, 1900, 12, 21);
		const configNum = 708011105 - ({ 0: 0, 1: 10153917, 2: 10153917, 3: 0 }[tn] || 0);
		const accday = configNum + diff;
		return ((accday - 1) * 12) + Math.floor((dateParts.hour + 1) / 2) + (tn !== 1 ? 1 : -11);
	}
	if(style === 4){
		const diff = dayDiffUTC(dateParts, 1900, 12, 21);
		const configNum = 708011105 - ({ 0: 0, 1: 10153917, 2: 10153917, 3: 0 }[tn] || 0);
		const accday = configNum + diff;
		return ((accday - 1) * 23) + (dateParts.hour * 10500) + (dateParts.minute + 1);
	}
	return lunarDay;
}

function getTaiSui(style, gz){
	const map = {
		0: gz.year,
		1: gz.month,
		2: gz.day,
		3: gz.time,
		4: gz.time,
		5: gz.year,
	};
	const target = map[style] || gz.year;
	return safeSecondChar(target);
}

function getYinYang(style, jieqi, dayGan, timeZhi){
	if(style === 0 || style === 1 || style === 2 || style === 5){
		return '陽';
	}
	const currentJieqi = `${jieqi || ''}`;
	const winterPart = rotateFrom(JIEQI_ORDER, '冬至').slice(0, 12);
	const summerPart = rotateFrom(JIEQI_ORDER, '夏至').slice(0, 12);
	let season = '冬至';
	if(summerPart.indexOf(currentJieqi) >= 0){
		season = '夏至';
	}else if(winterPart.indexOf(currentJieqi) >= 0){
		season = '冬至';
	}

	if(style === 3){
		return season === '夏至' ? '陰' : '陽';
	}

	const yangGan = '甲丙戊庚壬';
	const groupA = '申酉戌亥子丑';
	const inA = groupA.indexOf(timeZhi) >= 0;
	const dayIsYang = yangGan.indexOf(dayGan) >= 0;
	if(season === '冬至'){
		if(dayIsYang){
			return inA ? '陽' : '陰';
		}
		return inA ? '陰' : '陽';
	}
	if(dayIsYang){
		return inA ? '陰' : '陽';
	}
	return inA ? '陽' : '陰';
}

function getKook(accNum, yinYang){
	const k = ((accNum % 72) + 72) % 72 || 72;
	const years = ['理天', '理地', '理人'];
	return {
		num: k,
		yingyang: yinYang,
		text: `${yinYang}遁${toCnNum(k)}局`,
		year: years[(k - 1) % 3],
	};
}

function getTaiyiNum(yingyang, kookNum){
	const base = [];
	for(let i=0; i<10; i++){
		for(let j=0; j<3; j++){
			base.push(i);
		}
	}
	const reversed = base.slice(0).reverse();
	let seq = [];
	if(yingyang === '陽'){
		const one = base.slice(3, 15).concat(base.slice(18));
		seq = one.concat(one).concat(one);
	}else{
		const one = reversed.slice(0, 12).concat(reversed.slice(15, reversed.length - 3));
		seq = one.concat(one).concat(one);
	}
	return seq[kookNum - 1] || 0;
}

function getHeGodMap(){
	const rev = DI_ZHI.slice(0).reverse();
	const vals = rotateFrom(rev, '丑');
	const map = {};
	for(let i=0; i<DI_ZHI.length; i++){
		map[DI_ZHI[i]] = vals[i];
	}
	return map;
}

function getJiGodMap(yinYang){
	const map = {};
	if(yinYang === '陽'){
		const vals = rotateFrom(DI_ZHI.slice(0).reverse(), '寅');
		for(let i=0; i<DI_ZHI.length; i++){
			map[DI_ZHI[i]] = vals[i];
		}
	}else{
		const keys = DI_ZHI.slice(0).reverse();
		const vals = rotateFrom(DI_ZHI, '酉');
		for(let i=0; i<keys.length; i++){
			map[keys[i]] = vals[i];
		}
	}
	return map;
}

function findCal(yingyang, kookNum){
	const arr = yingyang === '陽' ? YANG_CAL : YIN_CAL;
	return arr[kookNum - 1] || [0, 0, 0];
}

function getPalaceMarks(pan){
	const marks = [
		{ label: '太乙', palace: pan.taiyiPalace },
		{ label: '文昌', palace: pan.skyeyes },
		{ label: '太歲', palace: pan.taishui },
		{ label: '合神', palace: pan.hegod },
		{ label: '計神', palace: pan.jigod },
		{ label: '始擊', palace: pan.sf },
	];
	const map = {};
	PALACE_ORDER.forEach((p)=>{
		map[p] = [];
	});
	marks.forEach((item)=>{
		if(item.palace && map[item.palace]){
			map[item.palace].push(item.label);
		}
	});
	return PALACE_ORDER.map((palace)=>({
		palace,
		items: map[palace],
	}));
}

function buildGanZhi(nongli){
	return {
		year: nongli ? (nongli.yearJieqi || nongli.year || '') : '',
		month: nongli ? (nongli.monthGanZi || '') : '',
		day: nongli ? (nongli.dayGanZi || '') : '',
		time: nongli ? (nongli.time || '') : '',
	};
}

export function calcTaiyi(fields, nongli, options){
	const dateParts = parseDateTime(fields);
	if(!dateParts){
		return null;
	}
	const style = options && options.style !== undefined ? options.style : 3;
	const tn = options && options.tn !== undefined ? options.tn : 0;
	const styleForPan = style === 5 ? 3 : style;
	const tnForPan = style === 5 ? 0 : tn;
	const gz = buildGanZhi(nongli || {});
	const currentJie = extractCurrentJieqi(nongli);
	const dayGan = safeFirstChar(gz.day);
	const timeZhi = safeSecondChar(gz.time);
	const yingyang = getYinYang(styleForPan, currentJie, dayGan, timeZhi);
	const accNum = getAccNum(styleForPan, tnForPan, dateParts, nongli || {});
	const kook = getKook(accNum, yingyang);

	const taishui = getTaiSui(styleForPan, gz);
	const hegodMap = getHeGodMap();
	const jigodMap = getJiGodMap(yingyang);
	const hegod = hegodMap[taishui] || '';
	const jigod = jigodMap[taishui] || '';
	const sf = SF_LIST[kook.num - 1] || '';
	const skyeyes = (yingyang === '陽' ? SKYEYES_YANG : SKYEYES_YIN)[kook.num - 1] || '';
	const taiyiNum = getTaiyiNum(yingyang, kook.num);
	const taiyiPalace = TAIYI_PAI[kook.num - 1] || '';
	const cal = findCal(yingyang, kook.num);
	const zhao = (options && options.sex) === '女' ? '坤造' : '乾造';

	const pan = {
		style,
		styleForPan,
		tn,
		tnForPan,
		tenching: options ? options.tenching : 0,
		sex: options ? options.sex : '男',
		rotation: options ? options.rotation : '固定',
		zhao,
		dateStr: dateParts.dateStr,
		timeStr: dateParts.timeStr,
		realSunTime: nongli ? (nongli.birth || '') : '',
		lunarText: nongli ? `${nongli.year || ''}年${nongli.leap ? '闰' : ''}${nongli.month || ''}${nongli.day || ''}` : '',
		jiedelta: nongli ? (nongli.jiedelta || '') : '',
		jieqi: currentJie,
		ganzhi: gz,
		accNum,
		kook,
		taishui,
		hegod,
		jigod,
		sf,
		skyeyes,
		taiyiNum,
		taiyiPalace,
		homeCal: cal[0],
		awayCal: cal[1],
		setCal: cal[2],
		options: {
			styleLabel: getStyleLabel(style),
			accumLabel: getAccumLabel(tnForPan),
			tenchingLabel: (options && options.tenching === 1) ? '有' : '无',
			sexLabel: options && options.sex ? options.sex : '男',
			rotationLabel: options && options.rotation ? options.rotation : '固定',
		},
	};

	pan.palaces = getPalaceMarks(pan);
	return pan;
}

export function buildTaiyiSnapshotText(pan){
	if(!pan){
		return '';
	}
	const lines = [];
	lines.push('[起盘信息]');
	lines.push(`日期：${pan.dateStr} ${pan.timeStr}`);
	if(pan.realSunTime){
		lines.push(`真太阳时：${pan.realSunTime}`);
	}
	if(pan.lunarText){
		lines.push(`农历：${pan.lunarText}`);
	}
	if(pan.jiedelta){
		lines.push(`${pan.jiedelta}`);
	}
	lines.push(`干支：年${pan.ganzhi.year || ''} 月${pan.ganzhi.month || ''} 日${pan.ganzhi.day || ''} 时${pan.ganzhi.time || ''}`);
	lines.push(`命式：${pan.zhao}`);
	lines.push(`起盘方式：${pan.options && pan.options.styleLabel ? pan.options.styleLabel : ''}`);
	lines.push(`积年方式：${pan.options && pan.options.accumLabel ? pan.options.accumLabel : ''}`);
	lines.push(`十精：${pan.options && pan.options.tenchingLabel ? pan.options.tenchingLabel : ''}`);
	lines.push(`命法：${pan.options && pan.options.sexLabel ? pan.options.sexLabel : ''}`);
	lines.push(`盘体：${pan.options && pan.options.rotationLabel ? pan.options.rotationLabel : ''}`);
	lines.push('');
	lines.push('[太乙盘]');
	lines.push(`局式：${pan.kook.text}（${pan.kook.year}）`);
	lines.push(`积数：${pan.accNum}`);
	lines.push(`太乙数：${pan.taiyiNum}`);
	lines.push(`太乙：${pan.taiyiPalace}宫`);
	lines.push(`文昌：${pan.skyeyes}`);
	lines.push(`始击：${pan.sf}`);
	lines.push(`太岁：${pan.taishui}`);
	lines.push(`合神：${pan.hegod}`);
	lines.push(`计神：${pan.jigod}`);
	lines.push(`主算：${pan.homeCal} 客算：${pan.awayCal} 定算：${pan.setCal}`);
	lines.push('');
	lines.push('[十六宫标记]');
	pan.palaces.forEach((p)=>{
		const txt = p.items && p.items.length > 0 ? p.items.join('、') : '—';
		lines.push(`${p.palace}：${txt}`);
	});
	return lines.join('\n');
}

export function getStyleLabel(value){
	const one = STYLE_OPTIONS.find((item)=>item.value === value);
	return one ? one.label : `${value}`;
}

export function getAccumLabel(value){
	const one = ACCUM_OPTIONS.find((item)=>item.value === value);
	return one ? one.label : `${value}`;
}
