// AI 助手·起卦输入键:决定「卦 / 课 / 兆 / 筮 / 牌面」本身、且不能由起课时间确定复算的输入(种子、报数、手输卦数、
// 随机或手动起例模式)。外部与页面内的助手一律不能经 cast_technique 的 options 覆盖、也不能经 set_settings(facet=mount / page)
// 写这些键的具体值 —— 写了 = 凭参数伪造一个用户没摇过的卦,或把已存事盘按另一组输入重起。判读口径 / 流派 / 显示类键不在此列。
//
// 两类来源(均读代码定):
//   · 挂载设置表里登记了的(techniqueMountSettings 的 TAIXUAN / JINGJUE / WUZHAO / SHENYISHU 字段、皇极心易组、
//     六壬起课组的选时支与演数、奇门阴盘报数、金口诀地分(求测者报出,定课本身)、印度盘问事的起卦时刻与问数)
//     —— 这些键过得了覆盖层的字段过滤,真会改到起卦结果;
//   · 只存在存档 payload 里、挂载表故意不登的(塔罗牌面与起牌方式 / 地占图形 / 灵棋棋数 / 六爻卦 / 小六壬课 / 小成图卦 / 飞宫局 /
//     轨策卦 / 统摄法四卦)—— 覆盖层本来就会剪掉,显式拒是为了给调用方一句明白话,而不是静默无效。
// 用户自己在挂载卡里设的同类默认不受影响(那是用户亲手的选择)。
// 只拦「写具体值」:删掉用户自己设的同类默认(挂载面传 null)、或写回「自动 / 留空」那一档(CAST_INPUT_NEUTRAL)不造任何卦象,照常放行。
// 技法页保存的设置(facet=page)同一张表:该页下次起卦的起例模式 / 牌阵 / 牌组等同样不经助手改。
import { INPUT_CASTABLE } from './divinationCast';

// 三式合一六壬层锁「正时正将」:选时支 / 演数不在其挂载表(重算也锁),只剩奇门阴盘报数
const SANSHI_CAST_KEYS = ['shuziReportNumber'];

export const CAST_INPUT_KEYS = Object.freeze({
	taixuan: Object.freeze(['seed']),
	jingjue: Object.freeze(['seed']),
	wuzhao: Object.freeze(['mode', 'shifaVariant', 'qianAuto', 'qianThrows', 'zhaoNums', 'number', 'manual', 'manualSplits', 'pan']),
	shenyishu: Object.freeze(['hourSource', 'manualHour', 'seasonSource', 'manualSeason']),
	huangji: Object.freeze(['xinyiMethod', 'upperNum', 'lowerNum', 'upperStrokes', 'lowerStrokes', 'objectGua', 'direction']),
	liureng: Object.freeze(['xuanShiZhi', 'yanShuNum']),
	qimen: Object.freeze(['shuziReportNumber']),
	jinkou: Object.freeze(['diFen']),
	indiachart: Object.freeze(['indiaPrashnaTime', 'indiaPrashnaNumber']),
	sanshiunited: Object.freeze(SANSHI_CAST_KEYS.slice()),
	tarot: Object.freeze(['seed', 'seedMode', 'deckId', 'spreadType', 'question']),
	geomancy: Object.freeze(['seed', 'seedMode', 'question', 'castNumbers']),
	lingqi: Object.freeze(['counts']),
	sixyao: Object.freeze(['gua']),
	xiaoliuren: Object.freeze(['nums']),
	xiaochengtu: Object.freeze(['qi', 'qiSource']),
	feigong: Object.freeze(['qiZhi', 'dayGan', 'dayZhi']),
	guice: Object.freeze(['gua']),
	tongshefa: Object.freeze(['selection']),
});

// 回到「自动 / 留空」的那一档:每个值都是该字段的挂载缺省,且缺省本身不定任何卦象数据(按时间派生 / 自动 / 留空 / 0 = 不用)。
// 助手可以写这一档(把用户自己设的同类默认改回自动,或起盘时不覆盖);写别的值照拒。
// 合同测试看守:每个值都在本技法的起卦输入键上,且等于该字段的挂载缺省(技法页同名键等于该页缺省)。
// 只有具体值、没有「自动」档的键(神易数手动时辰 / 季令、心易报数 / 笔画 / 物象 / 方位、印度问数、牌面 / 卦 / 棋数等)不在表里。
export const CAST_INPUT_NEUTRAL = Object.freeze({
	taixuan: Object.freeze({ seed: '' }),
	jingjue: Object.freeze({ seed: '' }),
	wuzhao: Object.freeze({ mode: 'ganzhi', shifaVariant: 'guayi', qianAuto: 1, qianThrows: '', zhaoNums: '', number: 0, manual: 0, manualSplits: '' }),
	shenyishu: Object.freeze({ hourSource: 'auto', seasonSource: 'auto' }),
	huangji: Object.freeze({ xinyiMethod: 'datetime' }),
	liureng: Object.freeze({ xuanShiZhi: '', yanShuNum: '' }),
	qimen: Object.freeze({ shuziReportNumber: '' }),
	sanshiunited: Object.freeze({ shuziReportNumber: '' }),
	jinkou: Object.freeze({ diFen: 'auto' }),
	indiachart: Object.freeze({ indiaPrashnaTime: '' }),
});

// 技法页保存的设置(facet=page)按哪一个技法的起卦输入表判:页键与技法键不同名的在这里对上
const PAGE_CAST_TECHNIQUE = Object.freeze({ dunjia: 'qimen', guazhan: 'sixyao' });
export function pageCastTechnique(page){
	const p = `${page || ''}`;
	return Object.prototype.hasOwnProperty.call(PAGE_CAST_TECHNIQUE, p) ? PAGE_CAST_TECHNIQUE[p] : p;
}

// 只能挂命盘、没有事盘的技法:起卦输入只来自用户在挂载卡 / 技法页亲手填的(没有「已存事盘」一说)
export const CAST_INPUT_CHART_TECHNIQUES = Object.freeze(['indiachart']);
// 能按用户报出的结果建事盘(cast_divination_case)的技法:起卦格式表的六爻键是 liuyao,技法键是 sixyao
function castableByInput(technique){
	const t = `${technique || ''}`;
	return INPUT_CASTABLE.indexOf(t === 'sixyao' ? 'liuyao' : t) >= 0;
}

export function castInputKeysOf(technique){
	const k = `${technique || ''}`;
	return Object.prototype.hasOwnProperty.call(CAST_INPUT_KEYS, k) ? CAST_INPUT_KEYS[k] : [];
}

export function isCastInputKey(technique, key){
	return castInputKeysOf(technique).indexOf(`${key}`) >= 0;
}

// 某起卦输入键「回到自动」的那一档:{ has, value }(没有这一档 = has:false)
export function castInputNeutralOf(technique, key){
	const t = `${technique || ''}`;
	const tab = Object.prototype.hasOwnProperty.call(CAST_INPUT_NEUTRAL, t) ? CAST_INPUT_NEUTRAL[t] : null;
	const k = `${key}`;
	return tab && Object.prototype.hasOwnProperty.call(tab, k) ? { has: true, value: tab[k] } : { has: false };
}

// 值就是「回到自动」那一档(按字面比:'1' 与 1 同,'' 与 null / 0 不同)
export function isCastInputNeutralValue(technique, key, value){
	const n = castInputNeutralOf(technique, key);
	if(!n.has || value === undefined || value === null || (typeof value === 'object')){ return false; }
	return `${value}` === `${n.value}`;
}

// 一组覆盖里撞到的起卦输入键(按出现顺序,去重);写的是「回到自动」那一档的不算(不覆盖 = 不造卦)
export function castInputKeysIn(technique, values){
	if(!values || typeof values !== 'object' || Array.isArray(values)){ return []; }
	const list = castInputKeysOf(technique);
	return Object.keys(values).filter((k)=>list.indexOf(k) >= 0 && !isCastInputNeutralValue(technique, k, values[k]));
}

// 拒绝话术(给模型看):按技法给对出路 —— 能按结果建事盘的才指 cast_divination_case;命盘类技法与其余事盘类技法指向用户亲手填 / 起课。
// opts.label 技法中文名;opts.facet:'mount'(挂载默认:可传 null 删掉)/ 'page'(技法页保存的设置)/ 缺省 = cast_technique 的覆盖
export function castInputRejectMessage(technique, keys, opts){
	const o = opts || {};
	const t = `${technique || ''}`;
	const name = o.label && `${o.label}` !== t ? `${o.label}(${t})` : t;
	const list = (Array.isArray(keys) ? keys : []).map((k)=>`${k}`);
	const head = `「${name}」的 ${list.join('、')} 属起卦输入(决定卦象 / 课 / 兆 / 牌面本身),助手不能经参数写具体值`;
	let way;
	if(o.facet === 'page'){
		way = ':这是该页下次起卦用的输入,请用户在技法页亲手选';
	}else if(castableByInput(t)){
		way = ':已存事盘只按存档结果读,临时时间点只按时间起;用户已报出的起卦结果请用 cast_divination_case 建事盘,或请用户在技法页亲手起卦';
	}else if(CAST_INPUT_CHART_TECHNIQUES.indexOf(t) >= 0){
		way = ':请用户在 AI 分析的挂载设置里亲手填,或在技法页亲手起卦';
	}else{
		way = ':已存事盘只按存档结果读,临时时间点只按时间起;请用户在技法页亲手起课 / 报数,或在 AI 分析的挂载设置里亲手改';
	}
	const backs = list.map((k)=>{ const n = castInputNeutralOf(t, k); return n.has ? `${k} 写 ${JSON.stringify(n.value)}` : ''; }).filter((x)=>x);
	let back = '';
	if(o.facet === 'mount'){ back = `;要回到自动:传 null 删掉同类默认里的这一项${backs.length ? `,或${backs.join('、')}` : ''}`; }
	else if(backs.length){ back = `;要回到自动:${backs.join('、')}`; }
	return `${head}${way}${back}`;
}
