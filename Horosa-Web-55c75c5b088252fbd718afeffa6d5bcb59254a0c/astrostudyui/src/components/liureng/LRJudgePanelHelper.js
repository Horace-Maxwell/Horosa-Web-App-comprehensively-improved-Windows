import {
	LIURENG_REF_OVERVIEW_TEXT,
	LIURENG_REF_DAGE_TEXT,
	LIURENG_REF_XIAOJU_TEXT,
} from '../../constants/LiuRengReferenceTexts';
import * as LRConst from './LRConst';

function safeText(v){
	return `${v === undefined || v === null ? '' : v}`.trim();
}

function joinVal(v){
	if(v === undefined || v === null || v === ''){
		return '—';
	}
	if(v instanceof Array){
		return v.length ? v.join('、') : '—';
	}
	if(typeof v === 'object'){
		return '—';
	}
	return `${v}`;
}

function uniqueRows(rows){
	const out = [];
	const seen = new Set();
	(rows || []).forEach((row)=>{
		if(!row || !row.name){
			return;
		}
		const key = `${row.name}`;
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		out.push(row);
	});
	return out;
}

function sliceSection(src, startMark, endMarks){
	const source = safeText(src);
	if(!source || !startMark){
		return '';
	}
	const start = source.indexOf(startMark);
	if(start < 0){
		return '';
	}
	let end = source.length;
	(endMarks || []).forEach((mark)=>{
		if(!mark){
			return;
		}
		const idx = source.indexOf(mark, start + startMark.length);
		if(idx >= 0 && idx < end){
			end = idx;
		}
	});
	return source.substring(start, end).trim();
}

function stripAnySectionHeading(txt){
	const source = safeText(txt);
	if(!source){
		return '';
	}
	return source.replace(/^#{1,6}\s+(?:\*\*.*?\*\*|.+?)\s*$/m, '').trim();
}

function stripHeadingAndBoldMarkers(txt){
	const source = safeText(txt).replace(/\r\n/g, '\n');
	if(!source){
		return '';
	}
	return source
		.replace(/^\s*#{1,6}\s*/gm, '')
		.replace(/\*\*/g, '')
		.trim();
}

function normalizeHeadingName(name){
	return safeText(name).replace(/[：:]/g, '').replace(/\s+/g, '');
}

function extractBranch(token){
	const txt = `${token === undefined || token === null ? '' : token}`;
	for(let i=txt.length - 1; i>=0; i--){
		const ch = txt.substring(i, i + 1);
		if('子丑寅卯辰巳午未申酉戌亥'.indexOf(ch) >= 0){
			return ch;
		}
	}
	return '';
}

function extractGan(token){
	const txt = `${token === undefined || token === null ? '' : token}`.trim();
	if(!txt){
		return '';
	}
	const c = txt.substring(0, 1);
	return LRConst.GanList.indexOf(c) >= 0 ? c : '';
}

function normalizeJiangName(raw){
	const txt = safeText(raw);
	if(!txt){
		return '';
	}
	if(txt === '贵人' || txt === '天乙'){
		return '天乙';
	}
	if(txt === '螣蛇' || txt === '腾蛇'){
		return '螣蛇';
	}
	if(txt === '玄武' || txt === '元武'){
		return '元武';
	}
	return txt;
}

function buildJiangBranchMap(lrLayout){
	const out = {};
	if(!lrLayout || !Array.isArray(lrLayout.downZi) || !Array.isArray(lrLayout.houseTianJiang)){
		return out;
	}
	for(let i=0; i<lrLayout.downZi.length; i++){
		const branch = safeText(lrLayout.downZi[i]);
		const jiang = normalizeJiangName(lrLayout.houseTianJiang[i]);
		if(branch && jiang){
			out[jiang] = branch;
		}
	}
	return out;
}

function buildJiangPositionMap(lrLayout){
	const out = {};
	if(
		!lrLayout
		|| !Array.isArray(lrLayout.downZi)
		|| !Array.isArray(lrLayout.upZi)
		|| !Array.isArray(lrLayout.houseTianJiang)
	){
		return out;
	}
	for(let i=0; i<lrLayout.downZi.length; i++){
		const jiang = normalizeJiangName(lrLayout.houseTianJiang[i]);
		const down = safeText(lrLayout.downZi[i]);
		const up = safeText(lrLayout.upZi[i]);
		if(jiang && down && up){
			out[jiang] = { down, up };
		}
	}
	return out;
}

function getMonthBranch(liureng){
	const nongli = liureng && liureng.nongli ? liureng.nongli : {};
	const monthGanZi = safeText(
		nongli.monthGanZi
		|| (liureng && liureng.fourColumns && liureng.fourColumns.month && liureng.fourColumns.month.ganzi)
		|| (liureng && liureng.fourColumns && liureng.fourColumns.month)
	);
	return extractBranch(monthGanZi);
}

function splitPlainLines(text){
	return `${text || ''}`
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line)=>line.trim())
		.filter((line)=>!!line);
}

function parseFayongRules(sectionText){
	const source = `${sectionText || ''}`.replace(/\r\n/g, '\n');
	if(!source){
		return [];
	}
	const reg = /^#####\s+(?:\*\*(.+?)\*\*|(.+?))\s*$/gm;
	const marks = [];
	let m = reg.exec(source);
	while(m){
		marks.push({
			title: safeText(m[1] || m[2]),
			start: m.index,
			bodyStart: reg.lastIndex,
		});
		m = reg.exec(source);
	}
	const rules = [];
	for(let i=0; i<marks.length; i++){
		const cur = marks[i];
		const nextStart = i + 1 < marks.length ? marks[i + 1].start : source.length;
		const body = source.substring(cur.bodyStart, nextStart).trim();
		const bodyLines = splitPlainLines(body).filter((line)=>line !== '荀注：');
		if(!bodyLines.length){
			continue;
		}
		rules.push({
			title: cur.title,
			firstLine: bodyLines[0],
			text: stripHeadingAndBoldMarkers(`${cur.title}\n${bodyLines.join('\n')}`),
		});
	}
	return rules;
}

function parseZaZhuRules(sectionText){
	const lines = splitPlainLines(sectionText);
	const ruleHeads = [
		'螣蛇大战，毒气相凌。',
		'螣蛇当路，鬼怪殃藏。',
		'六合不合，阴私相坏。',
		'太常被剥，官事消铄。',
		'朱雀开口，发主喧斗。',
		'青龙开眼，万事无灾。',
		'青龙卧病，财散人灾。',
		'天空落泪，哀声聒耳。',
		'天乙归狱，诸事不治。',
		'勾陈拔剑，病患相伤。',
		'勾陈相会，连绵祸深。',
		'天后阴私，申阳酉阴。',
		'朱雀衔物，婚姻和合。',
		'太阴拔剑，阴谋相害。',
		'元武横截，盗贼兵发。',
		'白虎遭擒，已免灾咎。',
		'白虎仰视，凶恶之甚。',
	];
	const markList = [];
	ruleHeads.forEach((head)=>{
		const idx = lines.findIndex((line)=>line === head);
		if(idx >= 0){
			markList.push({ head, idx });
		}
	});
	if(!markList.length){
		return [];
	}
	markList.sort((a, b)=>a.idx - b.idx);
	const out = [];
	for(let i=0; i<markList.length; i++){
		const cur = markList[i];
		const end = i + 1 < markList.length ? markList[i + 1].idx : lines.length;
		const bodyLines = lines.slice(cur.idx, end).filter((line)=>!!line && line !== '荀注：');
		if(!bodyLines.length){
			continue;
		}
		out.push({
			firstLine: bodyLines[0],
			text: stripHeadingAndBoldMarkers(bodyLines.join('\n')),
		});
	}
	return out;
}

function isIn(branch, list){
	return !!branch && list.indexOf(branch) >= 0;
}

const ZHUQUE_KAIKOU_BY_MONTH = {
	寅: '巳',
	卯: '辰',
	辰: '午',
	巳: '未',
	午: '卯',
	未: '寅',
	申: '申',
	酉: '酉',
	戌: '丑',
	亥: '子',
	子: '戌',
	丑: '亥',
};
const ZHUQUE_XIANWU_BY_MONTH = {
	寅: '酉',
	卯: '巳',
	辰: '丑',
	巳: '子',
	午: '申',
	未: '辰',
	申: '卯',
	酉: '亥',
	戌: '未',
	亥: '午',
	子: '寅',
	丑: '戌',
};
const GOUCHEN_BAJIAN_BY_MONTH = {
	寅: '巳',
	卯: '辰',
	辰: '卯',
	巳: '寅',
	午: '丑',
	未: '子',
	申: '亥',
	酉: '戌',
	戌: '酉',
	亥: '申',
	子: '未',
	丑: '午',
};
const DAY_LU_BY_GAN = {
	甲: '寅',
	乙: '卯',
	丙: '巳',
	丁: '午',
	戊: '巳',
	己: '午',
	庚: '申',
	辛: '酉',
	壬: '亥',
	癸: '子',
};

function buildOverviewMatchContext(params){
	const liureng = params && params.liureng ? params.liureng : null;
	const lrLayout = params && params.lrLayout ? params.lrLayout : null;
	const sanChuan = params && params.sanChuan ? params.sanChuan : null;
	const keRaw = params && Array.isArray(params.keRaw) ? params.keRaw : [];
	const jiangBranchMap = buildJiangBranchMap(lrLayout);
	const jiangPositionMap = buildJiangPositionMap(lrLayout);
	const firstBranch = extractBranch(sanChuan && sanChuan.cuang && sanChuan.cuang[0]);
	const firstJiang = normalizeJiangName(sanChuan && sanChuan.tianJiang && sanChuan.tianJiang[0]);
	const dayTopBranch = extractBranch(keRaw && keRaw[0] ? keRaw[0][1] : '');
	const dayGanZi = safeText(
		(liureng && liureng.nongli && liureng.nongli.dayGanZi)
		|| (liureng && liureng.fourColumns && liureng.fourColumns.day && liureng.fourColumns.day.ganzi)
		|| (liureng && liureng.fourColumns && liureng.fourColumns.day)
	);
	const dayGan = extractGan(dayGanZi);
	const dayZhi = extractBranch(dayGanZi);
	const dayHeGan = dayGan ? safeText(LRConst.GanHe[dayGan]) : '';
	const dayHeBranch = dayHeGan ? safeText(LRConst.GanJiZi[dayHeGan]) : '';
	const dayLuBranch = dayGan ? safeText(DAY_LU_BY_GAN[dayGan]) : '';
	const dayYiMaBranch = dayZhi ? safeText(LRConst.ZiYiMa[dayZhi]) : '';
	const monthBranch = getMonthBranch(liureng);
	return {
		firstBranch,
		firstJiang,
		dayTopBranch,
		dayGan,
		dayZhi,
		dayHeBranch,
		dayLuBranch,
		dayYiMaBranch,
		monthBranch,
		jiangBranchMap,
		jiangPositionMap,
	};
}

function matchFayongRule(rule, ctx){
	const line = safeText(rule && rule.firstLine);
	const jb = ctx && ctx.firstBranch ? ctx.firstBranch : '';
	const jj = ctx && ctx.firstJiang ? ctx.firstJiang : '';
	const dayHeBranch = ctx && ctx.dayHeBranch ? ctx.dayHeBranch : '';
	const dayLuBranch = ctx && ctx.dayLuBranch ? ctx.dayLuBranch : '';
	const dayYiMaBranch = ctx && ctx.dayYiMaBranch ? ctx.dayYiMaBranch : '';
	const dayTop = ctx && ctx.dayTopBranch ? ctx.dayTopBranch : '';
	if(!line){
		return false;
	}
	if(line.indexOf('贵人丑未下') === 0){
		return jj === '天乙' && isIn(jb, ['丑', '未']);
	}
	if(line.indexOf('六合加禄马') === 0){
		return jj === '六合' && isIn(jb, [dayLuBranch, dayYiMaBranch]);
	}
	if(line.indexOf('螣蛇巳午卯') === 0){
		return jj === '螣蛇' && isIn(jb, ['巳', '午', '卯']);
	}
	if(line.indexOf('朱雀信息来') === 0){
		return jj === '朱雀';
	}
	if(line.indexOf('六合乘卯酉') === 0){
		return jj === '六合' && isIn(jb, ['卯', '酉']);
	}
	if(line.indexOf('勾陈春二八') === 0){
		return jj === '勾陈' && isIn(jb, ['寅', '卯', '酉']);
	}
	if(line.indexOf('青龙当干合') === 0){
		return jj === '青龙' && !!dayHeBranch && jb === dayHeBranch;
	}
	if(line.indexOf('天空有失亡') === 0){
		return jj === '天空';
	}
	if(line.indexOf('白虎临门叹') === 0){
		return jj === '白虎';
	}
	if(line.indexOf('太常旺今朝') === 0){
		return jj === '太常';
	}
	if(line.indexOf('元武亥子辰') === 0){
		return jj === '元武' && isIn(jb, ['亥', '子', '辰']);
	}
	if(line.indexOf('太阴巳午焚') === 0){
		return jj === '太阴' && isIn(jb, ['巳', '午']);
	}
	if(line.indexOf('天后因女子') === 0){
		return jj === '天后' && (isIn(jb, ['午', '未']) || isIn(dayTop, ['午', '未']));
	}
	return false;
}

function matchZaZhuRule(rule, ctx){
	const line = safeText(rule && rule.firstLine);
	const map = ctx && ctx.jiangBranchMap ? ctx.jiangBranchMap : {};
	const posMap = ctx && ctx.jiangPositionMap ? ctx.jiangPositionMap : {};
	const monthBranch = ctx && ctx.monthBranch ? ctx.monthBranch : '';
	const she = safeText(map['螣蛇']);
	const liu = safeText(map['六合']);
	const chang = safeText(map['太常']);
	const zhu = safeText(map['朱雀']);
	const long = safeText(map['青龙']);
	const tianyi = safeText(map['天乙']);
	const gou = safeText(map['勾陈']);
	const hou = safeText(map['天后']);
	const yin = safeText(map['太阴']);
	const xuan = safeText(map['元武']);
	const bai = safeText(map['白虎']);
	const kong = safeText(map['天空']);
	if(!line){
		return false;
	}
	if(line.indexOf('螣蛇大战') === 0){
		const shePos = posMap['螣蛇'];
		if(!shePos || !shePos.up || !shePos.down){
			return false;
		}
		return LRConst.isRestrain(shePos.up, shePos.down) || LRConst.isRestrain(shePos.down, shePos.up);
	}
	if(line.indexOf('螣蛇当路') === 0){
		return isIn(she, ['子', '午', '卯', '酉']);
	}
	if(line.indexOf('六合不合') === 0){
		return isIn(liu, ['酉', '卯', '午']);
	}
	if(line.indexOf('太常被剥') === 0){
		return isIn(chang, ['辰', '卯', '酉', '巳']);
	}
	if(line.indexOf('朱雀开口') === 0){
		return !!monthBranch && zhu && ZHUQUE_KAIKOU_BY_MONTH[monthBranch] === zhu;
	}
	if(line.indexOf('青龙开眼') === 0){
		return isIn(long, ['寅', '酉', '戌']);
	}
	if(line.indexOf('青龙卧病') === 0){
		return long === '巳';
	}
	if(line.indexOf('天空落泪') === 0){
		return kong === '子' || kong === '亥';
	}
	if(line.indexOf('天乙归狱') === 0){
		return isIn(tianyi, ['辰', '戌']);
	}
	if(line.indexOf('勾陈拔剑') === 0){
		return !!monthBranch && gou && GOUCHEN_BAJIAN_BY_MONTH[monthBranch] === gou;
	}
	if(line.indexOf('勾陈相会') === 0){
		return isIn(gou, ['辰', '戌', '丑', '未']);
	}
	if(line.indexOf('天后阴私') === 0){
		return isIn(hou, ['申', '酉']);
	}
	if(line.indexOf('朱雀衔物') === 0){
		return !!monthBranch && zhu && ZHUQUE_XIANWU_BY_MONTH[monthBranch] === zhu;
	}
	if(line.indexOf('太阴拔剑') === 0){
		return isIn(yin, ['申', '酉']);
	}
	if(line.indexOf('元武横截') === 0){
		return isIn(xuan, ['辰', '戌', '丑', '未']);
	}
	if(line.indexOf('白虎遭擒') === 0){
		return isIn(bai, ['巳', '午']);
	}
	if(line.indexOf('白虎仰视') === 0){
		return isIn(bai, ['辰', '戌', '丑', '未']);
	}
	return false;
}

function buildHeadingSectionMap(src){
	const source = `${safeText(src)}`.replace(/\r\n/g, '\n');
	if(!source){
		return {};
	}
	const reg = /^###\s+(?:\*\*(.+?)\*\*|(.+?))\s*$/gm;
	const marks = [];
	let m = reg.exec(source);
	while(m){
		marks.push({
			name: safeText(m[1] || m[2]),
			start: m.index,
			bodyStart: reg.lastIndex,
		});
		m = reg.exec(source);
	}
	const map = {};
	for(let i=0; i<marks.length; i++){
		const cur = marks[i];
		const nextStart = i + 1 < marks.length ? marks[i + 1].start : source.length;
		const key = normalizeHeadingName(cur.name);
		const section = stripHeadingAndBoldMarkers(source.substring(cur.bodyStart, nextStart));
		if(key && section){
			map[key] = section;
		}
	}
	return map;
}

const LIURENG_PATTERN_SECTION_MAP = {
	...buildHeadingSectionMap(LIURENG_REF_OVERVIEW_TEXT),
	...buildHeadingSectionMap(LIURENG_REF_DAGE_TEXT),
	...buildHeadingSectionMap(LIURENG_REF_XIAOJU_TEXT),
};

const LIURENG_TIANHE_OVERVIEW = stripAnySectionHeading(
	sliceSection(
		LIURENG_REF_OVERVIEW_TEXT,
		'## **天合局**',
		['## **宫时局**']
	)
);
const LIURENG_FAYONG_SECTION_TEXT = sliceSection(
	LIURENG_REF_OVERVIEW_TEXT,
	'### **天将发用来意诀**',
	['### **天将杂主吉凶**']
);
const LIURENG_ZAZHU_SECTION_TEXT = sliceSection(
	LIURENG_REF_OVERVIEW_TEXT,
	'### **天将杂主吉凶**',
	['【释课元微']
);
const LIURENG_FAYONG_RULES = parseFayongRules(LIURENG_FAYONG_SECTION_TEXT);
const LIURENG_ZAZHU_RULES = parseZaZhuRules(LIURENG_ZAZHU_SECTION_TEXT);
const LIURENG_REFERENCE_ONLY_HIT_NAMES = new Set(['刑德', '物气', '新故', '迍福', '始终']);
const LIURENG_PATTERN_NAME_ALIASES = {
	[normalizeHeadingName('元首')]: [normalizeHeadingName('贼摄')],
	[normalizeHeadingName('重审')]: [normalizeHeadingName('贼摄')],
	[normalizeHeadingName('知一')]: [normalizeHeadingName('比用')],
	[normalizeHeadingName('见机')]: [normalizeHeadingName('涉害')],
	[normalizeHeadingName('矢射')]: [normalizeHeadingName('遥克')],
	[normalizeHeadingName('虎视')]: [normalizeHeadingName('昴星')],
	[normalizeHeadingName('芜淫')]: [normalizeHeadingName('别责')],
	[normalizeHeadingName('帷簿')]: [normalizeHeadingName('八专')],
	[normalizeHeadingName('信任')]: [normalizeHeadingName('伏吟')],
	[normalizeHeadingName('无依')]: [normalizeHeadingName('返吟'), normalizeHeadingName('反吟')],
	[normalizeHeadingName('返吟')]: [normalizeHeadingName('反吟')],
	[normalizeHeadingName('反吟')]: [normalizeHeadingName('返吟')],
};

function isReferenceOnlyHitName(name){
	return LIURENG_REFERENCE_ONLY_HIT_NAMES.has(safeText(name));
}

function resolveLiuRengPatternSectionByName(name){
	const norm = normalizeHeadingName(name);
	if(!norm){
		return '';
	}
	const keys = [norm];
	const aliases = LIURENG_PATTERN_NAME_ALIASES[norm];
	if(Array.isArray(aliases) && aliases.length){
		aliases.forEach((k)=>{
			if(k && keys.indexOf(k) < 0){
				keys.push(k);
			}
		});
	}
	const sections = [];
	keys.forEach((k)=>{
		const text = safeText(LIURENG_PATTERN_SECTION_MAP[k]);
		if(text && sections.indexOf(text) < 0){
			sections.push(text);
		}
	});
	return sections.length ? sections.join('\n\n') : '';
}

export function getLiuRengPatternFullText(name){
	const norm = normalizeHeadingName(name);
	if(!norm){
		return '';
	}
	const sectionText = resolveLiuRengPatternSectionByName(norm);
	if(sectionText){
		return sectionText;
	}
	if(norm === '天合局'){
		return stripHeadingAndBoldMarkers(LIURENG_TIANHE_OVERVIEW);
	}
	if(norm === '三奇连珠'){
		const parts = [
			LIURENG_PATTERN_SECTION_MAP[normalizeHeadingName('三奇')],
			LIURENG_PATTERN_SECTION_MAP[normalizeHeadingName('连珠')],
		].filter((txt)=>!!safeText(txt));
		return parts.length ? parts.join('\n\n') : '';
	}
	if(norm === '后合' || norm === '狡童'){
		return LIURENG_PATTERN_SECTION_MAP[normalizeHeadingName('泆女')] || '';
	}
	return '';
}

export function buildLiuRengPatternDisplayRows(hits){
	if(!hits || !(hits instanceof Array) || !hits.length){
		return [];
	}
	return hits.map((item)=>{
		const hit = item && typeof item === 'object' ? item : {};
		const name = safeText(hit.name) || '未命名格局';
		const logic = safeText(hit.logic || hit.basis) || '命中';
		const detail = safeText(hit.detail);
		const fullText = safeText(hit.fullText) || getLiuRengPatternFullText(name);
		return {
			...hit,
			name,
			logic,
			basis: logic,
			detail,
			fullText,
		};
	});
}

export function splitLiuRengPatternHitsForPanels(lrJudge){
	const source = lrJudge && typeof lrJudge === 'object' ? lrJudge : {};
	const dageHits = Array.isArray(source.dageHits) ? source.dageHits : [];
	const xiaojuAll = Array.isArray(source.xiaojuHits) ? source.xiaojuHits : [];
	const xiaojuHits = [];
	const referenceHits = [];
	xiaojuAll.forEach((item)=>{
		if(isReferenceOnlyHitName(item && item.name)){
			referenceHits.push(item);
			return;
		}
		xiaojuHits.push(item);
	});
	return {
		dageHits,
		xiaojuHits,
		referenceHits,
	};
}

export function buildLiuRengReferenceRows(params){
	const liureng = params && params.liureng ? params.liureng : null;
	const runyear = params && params.runyear ? params.runyear : null;
	const lrLayout = params && params.lrLayout ? params.lrLayout : null;
	const split = splitLiuRengPatternHitsForPanels(params && params.lrJudge ? params.lrJudge : null);
	const dayGanZi = safeText(liureng && liureng.nongli ? liureng.nongli.dayGanZi : '');
	const dayGan = dayGanZi ? dayGanZi.substring(0, 1) : '—';
	const dayZhi = dayGanZi ? dayGanZi.substring(dayGanZi.length - 1) : '—';
	const yuejiang = safeText(liureng && liureng.yue) || safeText(lrLayout && lrLayout.yue) || '—';
	const runYearGanZi = joinVal((runyear && (runyear.year || runyear.ganzhi)) || (liureng && liureng.runyear && (liureng.runyear.year || liureng.runyear.ganzhi)));
	const runAge = runyear && runyear.age !== undefined && runyear.age !== null ? `${runyear.age}岁` : '—';

	const rows = [
		{
			kind: '速断',
			name: '贵人旦暮（不看左盘输入）',
			logic: '按日干与昼夜定真贵/幕贵，先定主导权与主客态势。',
			detail: `日干：${dayGan}；日支：${dayZhi}。`,
		},
		{
			kind: '速断',
			name: '天将顺逆（不看左盘输入）',
			logic: '真贵落东北顺行、落西南逆行，可先判断吉将凶将落位趋势。',
			detail: `月将：${yuejiang}。`,
		},
		{
			kind: '速断',
			name: '年命行年（不看左盘输入）',
			logic: '年命与行年可先判运势背景，再叠加课传细断。',
			detail: `行年：${runYearGanZi}；年龄：${runAge}。`,
		},
	];
	const referenceRows = buildLiuRengPatternDisplayRows(split.referenceHits).map((item)=>({
		kind: '参考',
		name: item.name,
		logic: item.logic || item.basis || '命中',
		detail: item.detail || '',
		fullText: item.fullText || '',
	}));
	return uniqueRows(rows.concat(referenceRows));
}

export function buildLiuRengOverviewSections(params){
	const ctx = buildOverviewMatchContext(params || {});
	const fayongHits = LIURENG_FAYONG_RULES.filter((rule)=>matchFayongRule(rule, ctx));
	const zazhuHits = LIURENG_ZAZHU_RULES.filter((rule)=>matchZaZhuRule(rule, ctx));
	const sections = [];
	if(fayongHits.length){
		sections.push({
			key: 'fayong_hits',
			title: '天将发用来意诀（命中条文）',
			content: fayongHits.map((item)=>item.text).join('\n\n'),
		});
	}
	if(zazhuHits.length){
		sections.push({
			key: 'zazhu_hits',
			title: '天将杂主吉凶（命中条文）',
			content: zazhuHits.map((item)=>item.text).join('\n\n'),
		});
	}
	if(!sections.length){
		return [
			{
				key: 'hit_empty',
				title: '命中概览',
				content: '当前盘面暂无命中《天将发用来意诀》/《天将杂主吉凶》条文。',
			},
		];
	}
	return sections;
}
