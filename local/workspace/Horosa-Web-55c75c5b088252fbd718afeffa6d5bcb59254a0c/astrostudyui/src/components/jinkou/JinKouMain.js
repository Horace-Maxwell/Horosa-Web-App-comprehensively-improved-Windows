import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { message, Modal } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as LRConst from '../liureng/LRConst';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import LiuRengInput from '../lrzhan/LiuRengInput';
import LiuRengBirthInput from '../lrzhan/LiuRengBirthInput';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import JinKouChart from './JinKouChart';
import JinKouRelationMini from './JinKouRelationMini';
import { buildJinKouData, fetchJinKouPan, normalizeKinjinkouData, resolveDiFenBySource, JINKOU_HEZHAN_FOCUS, JINKOU_HEZHAN_TIME } from './JinKouCalc';
import {
	JINKOU_BASHE_DOC,
	JINKOU_SIXIANG_SHU_COLS,
	JINKOU_SIXIANG_SHU_NOTES,
	JINKOU_SIXIANG_WUXING_COLS,
	JINKOU_SIXIANG_WUXING_NOTES,
} from './JinKouDoc';
import { JINKOU_FUWEN, JINKOU_FUWEN_NOTE } from './JinKouFuwen';
import { resolveJinKouDiFen } from './JinKouState';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { getKentangSavedCasePayload, openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import {
	XQButton as Button,
	XQSelect as Select,
	XQInput,
	XQTabs as Tabs, XQSideSection
} from '../xq-ui';
import {
	getBirthGanzhiLocalCache,
	getLiurengRunyearLocalCache,
	setBirthGanzhiLocalCache,
	setLiurengRunyearLocalCache,
} from '../../utils/localCalcCache';
import XQIcon from '../xq-icons';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { chartDrawGuardEnabled, stepPrefetchEnabled, kentangCacheEnabled, stepSelectPrefetchEnabled, techniqueResultCacheEnabled } from '../../utils/perfFlags';

const { Option } = Select;
const TabPane = Tabs.TabPane;

// 签名数组逐元素严格相等(引用/值);用于装配缓存命中判定(只多算、绝不少算)。
function sameSigArr(a, b){
	if(!a || !b || a.length !== b.length){
		return false;
	}
	for(let i = 0; i < a.length; i++){
		if(a[i] !== b[i]){
			return false;
		}
	}
	return true;
}

function cloneDateTimeSafe(val, fallback){
	if(val && val instanceof DateTime){
		return val.clone();
	}
	if(fallback && fallback instanceof DateTime){
		return fallback.clone();
	}
	return new DateTime();
}

function buildBirthFields(source, fallbackNow){
	const now = fallbackNow && fallbackNow instanceof DateTime ? fallbackNow : new DateTime();
	const src = source || {};
	const dateVal = src.date && src.date.value ? cloneDateTimeSafe(src.date.value, now.startOf('date')) : now.startOf('date');
	const timeVal = src.time && src.time.value ? cloneDateTimeSafe(src.time.value, now) : now.clone();
	return {
		date: { value: dateVal },
		time: { value: timeVal },
		ad: { value: src.ad && src.ad.value !== undefined ? src.ad.value : now.ad },
		zone: { value: src.zone && src.zone.value ? src.zone.value : now.zone },
		lat: { value: src.lat && src.lat.value ? src.lat.value : Constants.DefLat },
		lon: { value: src.lon && src.lon.value ? src.lon.value : Constants.DefLon },
		gpsLat: { value: src.gpsLat && src.gpsLat.value !== undefined ? src.gpsLat.value : Constants.DefGpsLat },
		gpsLon: { value: src.gpsLon && src.gpsLon.value !== undefined ? src.gpsLon.value : Constants.DefGpsLon },
		gender: { value: src.gender && src.gender.value !== undefined ? src.gender.value : 1 },
		after23NewDay: { value: src.after23NewDay && src.after23NewDay.value !== undefined ? src.after23NewDay.value : defaultAfter23NewDay() },
		lateZiHourUseNextDay: { value: src.lateZiHourUseNextDay && src.lateZiHourUseNextDay.value !== undefined ? src.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay() },
	};
}

function fmtValue(value){
	if(value === undefined || value === null || value === ''){
		return '无';
	}
	if(value instanceof Array){
		return value.join('、') || '无';
	}
	return `${value}`;
}

// GFM 表化同构数据行(空 cell → —),供 AI 导出/挂载可读化;数据层零变化——表行可逆变换逐字复原旧格式行。
const MD_DASH = '—';
function pushMdRows(lines, header, rows){
	lines.push(`| ${header.join(' | ')} |`);
	lines.push(`| ${header.map(()=>'---').join(' | ')} |`);
	rows.forEach((cells)=>{
		lines.push(`| ${cells.map((c)=>(c === undefined || c === null || c === '' ? MD_DASH : `${c}`)).join(' | ')} |`);
	});
}

function cleanKey(key){
	const txt = `${key || ''}`;
	const idx = txt.indexOf('(');
	if(idx >= 0){
		return txt.substring(0, idx);
	}
	return txt;
}

function appendMapSection(lines, title, obj){
	lines.push(`[${title}]`);
	if(!obj || typeof obj !== 'object'){
		lines.push('无');
		lines.push('');
		return;
	}
	const keys = Object.keys(obj);
	if(keys.length === 0){
		lines.push('无');
		lines.push('');
		return;
	}
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		lines.push(`${cleanKey(key)}：${fmtValue(obj[key])}`);
	}
	lines.push('');
}

function extractGanZi(text){
	const raw = `${text || ''}`.trim();
	if(raw.length < 2){
		return '';
	}
	if(LRConst.GanList.indexOf(raw.substr(0, 1)) >= 0 && LRConst.ZiList.indexOf(raw.substr(1, 1)) >= 0){
		return raw.substr(0, 2);
	}
	for(let i=0; i<raw.length - 1; i++){
		const gan = raw.substr(i, 1);
		const zi = raw.substr(i + 1, 1);
		if(LRConst.GanList.indexOf(gan) >= 0 && LRConst.ZiList.indexOf(zi) >= 0){
			return gan + zi;
		}
	}
	return '';
}

function resolveGuaYearGanZi(liureng){
	if(!liureng){
		return '';
	}
	const fourYear = liureng.fourColumns ? liureng.fourColumns.year : null;
	if(fourYear){
		if(typeof fourYear === 'string'){
			const got = extractGanZi(fourYear);
			if(got){
				return got;
			}
		}else if(fourYear.ganzi){
			const got = extractGanZi(fourYear.ganzi);
			if(got){
				return got;
			}
		}
	}
	const nongli = liureng.nongli ? liureng.nongli : {};
	const fallback = [
		nongli.yearGanZi,
		nongli.yearJieqi,
		nongli.year,
	];
	for(let i=0; i<fallback.length; i++){
		const got = extractGanZi(fallback[i]);
		if(got){
			return got;
		}
	}
	return '';
}

const JiaZiList = (()=>{
	const list = [];
	for(let i=0; i<60; i++){
		list.push(`${LRConst.GanList[i % 10]}${LRConst.ZiList[i % 12]}`);
	}
	return list;
})();

function buildRunYearList(startGanZi, delta){
	const list = [];
	let idx = JiaZiList.indexOf(startGanZi);
	if(idx < 0){
		return list;
	}
	for(let i=0; i<60; i++){
		list.push(JiaZiList[idx]);
		idx = (idx + delta + 60) % 60;
	}
	return list;
}

const MaleRunYearList = buildRunYearList('丙寅', 1);
const FemaleRunYearList = buildRunYearList('壬申', -1);

function resolveCycleYear(ganzi, approxYear){
	const idx = JiaZiList.indexOf(ganzi);
	if(idx < 0){
		return approxYear;
	}
	const base = 1984 + idx; // 1984 = 甲子
	const k = Math.floor((approxYear - base) / 60);
	const c1 = base + k * 60;
	const c2 = c1 + 60;
	return Math.abs(c2 - approxYear) < Math.abs(c1 - approxYear) ? c2 : c1;
}

function calcRunYearLocal(birthGanZi, guaGanZi, gender, birthYear, guaYear){
	const bIdx = JiaZiList.indexOf(extractGanZi(birthGanZi));
	const gIdx = JiaZiList.indexOf(extractGanZi(guaGanZi));
	if(bIdx < 0 || gIdx < 0){
		return null;
	}
	const ageCycle = (gIdx - bIdx + 60) % 60;
	let age = ageCycle;
	if(Number.isFinite(birthYear) && Number.isFinite(guaYear)){
		const bSolar = resolveCycleYear(JiaZiList[bIdx], birthYear);
		const gSolar = resolveCycleYear(JiaZiList[gIdx], guaYear);
		const diff = gSolar - bSolar;
		if(diff >= 0){
			age = diff;
		}
	}
	const male = `${gender}` !== '0';
	const yearList = male ? MaleRunYearList : FemaleRunYearList;
	return {
		age,
		ageCycle,
		year: yearList[ageCycle] || '',
	};
}

function getSolarYearFromField(field){
	if(!field || !field.value){
		return NaN;
	}
	const dt = field.value;
	const y = Number(dt.year);
	if(!Number.isFinite(y)){
		return NaN;
	}
	const ad = Number(dt.ad || 1);
	return ad >= 0 ? y : -y;
}

function buildFallbackRunYearByYearDiff(birth, guaFields){
	const birthYear = getSolarYearFromField(birth && birth.date ? birth.date : null);
	const guaYear = getSolarYearFromField(guaFields && guaFields.date ? guaFields.date : null);
	if(!Number.isFinite(birthYear) || !Number.isFinite(guaYear) || guaYear < birthYear){
		return null;
	}
	const genderVal = birth && birth.gender ? birth.gender.value : 1;
	const age = guaYear - birthYear;
	const ageCycle = ((age % 60) + 60) % 60;
	const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
	return {
		age: age,
		ageCycle: ageCycle,
		year: yearList[ageCycle] || '',
	};
}

function resolveDisplayRunYear(runyear, birth, guaFields){
	const fallback = buildFallbackRunYearByYearDiff(birth, guaFields);
	if(!fallback){
		return runyear;
	}
	const currAge = runyear && runyear.age !== undefined && runyear.age !== null ? Number(runyear.age) : NaN;
	const currAgeCycle = runyear && runyear.ageCycle !== undefined && runyear.ageCycle !== null ? Number(runyear.ageCycle) : NaN;
	const currYear = runyear && runyear.year ? `${runyear.year}` : '';
	const ageDelta = Number.isFinite(currAge) ? Math.abs(currAge - fallback.age) : NaN;
	const cycleDelta = Number.isFinite(currAgeCycle)
		? Math.min(Math.abs(currAgeCycle - fallback.ageCycle), 60 - Math.abs(currAgeCycle - fallback.ageCycle))
		: NaN;
	const hardMismatch = (Number.isFinite(ageDelta) && ageDelta >= 2)
		|| (Number.isFinite(cycleDelta) && cycleDelta >= 2);
	const sameAgeYearMismatch = Number.isFinite(currAge)
		&& currAge === fallback.age
		&& currYear !== ''
		&& fallback.year !== ''
		&& currYear !== fallback.year;
	const useFallback = !runyear
		|| !Number.isFinite(currAge)
		|| (currAge === 0 && fallback.age > 0)
		|| currYear === ''
		|| (currYear === '丙寅' && fallback.age > 0)
		|| hardMismatch
		|| sameAgeYearMismatch;
	if(!useFallback){
		return runyear;
	}
	// 走 fallback 时每次都新建对象 → 该引用进了中栏重绘签名（JinKouChart 的 runyear 项），
	// sameChartDrawSig 恒判「变了」，切右栏 tab 都会触发整棵 d3 重建，重绘守卫在这条路上形同虚设。
	// 按内容做一层记忆：内容不变则返回同一引用。
	const merged = { ...(runyear || {}), ...fallback };
	const key = JSON.stringify(merged);
	if(resolveDisplayRunYear._key === key && resolveDisplayRunYear._val){
		return resolveDisplayRunYear._val;
	}
	resolveDisplayRunYear._key = key;
	resolveDisplayRunYear._val = merged;
	return merged;
}

export function buildJinKouSnapshotText(params, liureng, runyear, jinkouData, wuxing, guirengType, gender){
	const lines = [];
	const nongli = liureng && liureng.nongli ? liureng.nongli : {};
	const xingbie = `${gender}` === '1' ? '男' : '女';
	const guirenType = jinkouData && jinkouData.source === 'kinjinkou' ? 'kinjinkou 贵人歌诀' : (guirengType === 0 ? '六壬法贵人' : (guirengType === 1 ? '遁甲法贵人' : '星占法贵人'));
	const briefKong = (txt)=>{
		const val = `${txt || ''}`;
		const hasEmpty = val.indexOf('空亡') >= 0;
		const hasSiKong = val.indexOf('四大空亡') >= 0;
		if(hasEmpty && hasSiKong){
			return '空&四空';
		}
		if(hasEmpty){
			return '空';
		}
		if(hasSiKong){
			return '四空';
		}
		return '';
	};
	const findRow = (name)=>{
		if(!jinkouData || !jinkouData.rows){
			return null;
		}
		for(let i=0; i<jinkouData.rows.length; i++){
			const row = jinkouData.rows[i];
			if(row && row.label === name){
				return row;
			}
		}
		return null;
	};
	const appendBriefRow = (name, withShenjiang)=>{
		const row = findRow(name);
		if(!row){
			lines.push(`${name}：无`);
			return;
		}
		const main = fmtValue(row.content);
		const shenjiang = withShenjiang && row.shenjiang && row.shenjiang !== '-' ? `（${row.shenjiang}）` : '';
		const power = row.power && row.power !== '—' ? row.power : '无';
		const kong = briefKong(row.kong);
		let line = `${name}：${main}${shenjiang}；（${power}）`;
		if(kong){
			line = `${line}；${kong}`;
		}
		lines.push(line);
	};

	lines.push('[起盘信息]');
	if(params){
		// 逐字段 fmtValue —— 原先整体判 params 非空后就裸插值，任一字段缺失即把字面量
		// 「undefined」写进快照、直送 AI 提示词。与本函数其余各行同律用 fmtValue（缺 → 无）。
		lines.push(`日期：${fmtValue(params.date)} ${fmtValue(params.time)}`);
		lines.push(`时区：${fmtValue(params.zone)}`);
		lines.push(`经纬度：${fmtValue(params.lon)} ${fmtValue(params.lat)}`);
	}
	if(nongli && nongli.birth){
		lines.push(`真太阳时：${nongli.birth}`);
	}
	if(liureng && liureng.fourColumns){
		const cols = liureng.fourColumns;
		lines.push(`四柱：${fmtValue(cols.year && cols.year.ganzi)}年 ${fmtValue(cols.month && cols.month.ganzi)}月 ${fmtValue(cols.day && cols.day.ganzi)}日 ${fmtValue(cols.time && cols.time.ganzi)}时`);
	}
	lines.push(`贵人体系：${guirenType}`);
	// 土之长生随流派(申/寅);默认「水土同宫·申」时不写此括注 → 既有快照逐字零回归。
	const soilNote = wuxing === '土' && jinkouData && jinkouData.schools && jinkouData.schools.soilChangSheng === 'yin'
		? '（火土同宫·寅）' : '';
	lines.push(`十二长生五行：${fmtValue(wuxing)}${soilNote}`);
	// 昼夜依「真实地平」时才写口径行(有盘可依);无盘回落时支粗判,不写 → 既有快照零回归。
	if(jinkouData && jinkouData.dayBasis === 'horizon'){
		lines.push(`昼夜：${jinkouData.isDay ? '昼占' : '夜占'}（${fmtValue(jinkouData.dayBasisText)}）`);
	}
	lines.push(`问测人性别：${xingbie}`);
	lines.push('');

	lines.push('[金口诀速览]');
	if(jinkouData && jinkouData.ready){
		lines.push(`地分：${fmtValue(jinkouData.topInfo.diFen)}`);
		// [X1·P2-14] 月将/占时与中栏顶行同源入快照(此前 AI 看不到这两个排盘参数)。
		if(jinkouData.topInfo.yuejiang){ lines.push(`月将：${fmtValue(jinkouData.topInfo.yuejiang)}`); }
		if(jinkouData.topInfo.zhanshi){ lines.push(`占时：${fmtValue(jinkouData.topInfo.zhanshi)}`); }
		lines.push(`空亡：${fmtValue(jinkouData.topInfo.xunKong)}`);
		lines.push(`四大空亡：${fmtValue(jinkouData.topInfo.siDaKong)}`);
		if(jinkouData.yongYao && jinkouData.yongYao.label){
			lines.push(`用爻：${jinkouData.yongYao.label}${jinkouData.yongYao.sign ? `(${jinkouData.yongYao.sign})` : ''}`);
		}
		appendBriefRow('人元', false);
		appendBriefRow('贵神', true);
		appendBriefRow('将神', true);
		appendBriefRow('地分', false);
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[金口诀四位]');
	if(jinkouData && jinkouData.ready){
		lines.push(`地分：${fmtValue(jinkouData.topInfo.diFen)}`);
		// [X1·P2-14] 月将/占时与中栏顶行同源入快照(此前 AI 看不到这两个排盘参数)。
		if(jinkouData.topInfo.yuejiang){ lines.push(`月将：${fmtValue(jinkouData.topInfo.yuejiang)}`); }
		if(jinkouData.topInfo.zhanshi){ lines.push(`占时：${fmtValue(jinkouData.topInfo.zhanshi)}`); }
		lines.push(`空亡：${fmtValue(jinkouData.topInfo.xunKong)}`);
		lines.push(`四大空亡：${fmtValue(jinkouData.topInfo.siDaKong)}`);
		if(jinkouData.yongYao && jinkouData.yongYao.label){
			lines.push(`用爻判定：${jinkouData.yongYao.reason || ''}；取${jinkouData.yongYao.label}${jinkouData.yongYao.sign ? `(${jinkouData.yongYao.sign})` : ''}`);
		}
		// 四位(人元/贵神/将神/地分)→ GFM 表:位/天干/内容/神将/状态/空亡/纳音(纳音缺 → —)。
		const siWeiRows = jinkouData.rows.map((row)=>[
			row.label, fmtValue(row.gan), fmtValue(row.content), fmtValue(row.shenjiang), fmtValue(row.power), fmtValue(row.kong), row.nayin ? fmtValue(row.nayin) : '',
		]);
		pushMdRows(lines, ['位', '天干', '内容', '神将', '状态', '空亡', '纳音'], siWeiRows);
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[金口诀三盘]');
	if(jinkouData && jinkouData.ready && jinkouData.plates && jinkouData.plates.length){
		// 三盘逐地分 → GFM 表:地分/天盘/将神/神盘/贵神。
		const plateRows = jinkouData.plates.map((row)=>[
			fmtValue(row.di), fmtValue(row.tian), fmtValue(row.jiang), fmtValue(row.shen), fmtValue(row.gui),
		]);
		pushMdRows(lines, ['地分', '天盘', '将神', '神盘', '贵神'], plateRows);
	}else{
		lines.push((jinkouData && jinkouData.platesNote) || '无');
	}
	lines.push('');

	lines.push('[四位神煞]');
	if(jinkouData && jinkouData.shenshaRows && jinkouData.shenshaRows.length){
		for(let i=0; i<jinkouData.shenshaRows.length; i++){
			const row = jinkouData.shenshaRows[i];
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[用神强弱]');
	lines.push(jinkouData && jinkouData.yongStrength ? jinkouData.yongStrength.text : '无');
	lines.push('');

	lines.push('[发用·五动三动]');
	const jkDongSnap = jinkouData && jinkouData.dong ? jinkouData.dong : { wu: [], san: [] };
	const jkAllDong = [].concat(jkDongSnap.wu || [], jkDongSnap.san || []);
	if(jkAllDong.length){
		// 五动/三动 → GFM 表:动象/起→落/逢空/断语(逢空缺、断语缺 → —)。
		const dongRows = jkAllDong.map((d)=>[`${d.type}动`, `${d.from}→${d.to}`, d.kong ? '逢空' : '', d.text || '']);
		pushMdRows(lines, ['动象', '起→落', '逢空', '断语'], dongRows);
	}else{
		lines.push('四位无显著动象');
	}
	lines.push('');

	lines.push('[格局]');
	if(jinkouData && jinkouData.geju && jinkouData.geju.length){
		for(let i=0; i<jinkouData.geju.length; i++){
			lines.push(`${jinkouData.geju[i].name}：${jinkouData.geju[i].text || ''}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[四位生克]');
	if(jinkouData && jinkouData.relations && jinkouData.relations.length){
		// 四位生克 → GFM 表:主/关系/宾/断语(断语缺 → —)。
		const relRows = jinkouData.relations.map((r)=>[r.from, r.rel, r.to, r.text || '']);
		pushMdRows(lines, ['主', '关系', '宾', '断语'], relRows);
	}else{
		lines.push('无');
	}
	if(jinkouData && jinkouData.bihe && jinkouData.bihe.length){
		for(let i=0; i<jinkouData.bihe.length; i++){
			lines.push(jinkouData.bihe[i].text);
		}
	}
	lines.push('');

	lines.push('[应期]');
	if(jinkouData && jinkouData.yingQi){
		lines.push(`${jinkouData.yingQi.scope}：${jinkouData.yingQi.text}`);
		const yqm = jinkouData.yingQi.methods || [];
		for(let i=0; i<yqm.length; i++){
			lines.push(`${yqm[i].fa}（${yqm[i].when}）：${yqm[i].text}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[太岁月建]');
	if(jinkouData && jinkouData.nianYueRi && jinkouData.nianYueRi.length){
		// 太岁月建 → GFM 表:名/地支/入课/断语(未入课 → —)。
		const nyrRows = jinkouData.nianYueRi.map((it)=>[it.name, it.zhi, it.hit ? '入课' : '', it.text]);
		pushMdRows(lines, ['名', '地支', '入课', '断语'], nyrRows);
	}else{
		lines.push('无');
	}
	if(jinkouData && jinkouData.jishi && jinkouData.jishi.hit){
		lines.push(`忌时：${jinkouData.jishi.text}`);
	}
	lines.push('');

	lines.push('[地支关系]');
	if(jinkouData && jinkouData.branchRelations && jinkouData.branchRelations.length){
		for(let i=0; i<jinkouData.branchRelations.length; i++){
			const b = jinkouData.branchRelations[i];
			lines.push(`${b.aLabel}${b.a} ${b.type} ${b.bLabel}${b.b}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[相关神煞]');
	if(jinkouData && jinkouData.relevantShensha && jinkouData.relevantShensha.length){
		for(let i=0; i<jinkouData.relevantShensha.length; i++){
			const it = jinkouData.relevantShensha[i];
			lines.push(`${it.position}·${it.name}：${it.desc || ''}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	// 阴盘三层（仅盘式=阴盘时附段；阳盘不产此段 → 既有快照逐字零回归）。
	if(jinkouData && jinkouData.yinPan && jinkouData.yinPan.wangScore && jinkouData.yinPan.wangScore.length){
		const yp = jinkouData.yinPan;
		const qinBy = {};
		(yp.liuqin || []).forEach((it)=>{ qinBy[it.wei] = it.qin; });
		const shenBy = {};
		(yp.liushen || []).forEach((it)=>{ shenBy[it.wei] = it.name; });
		lines.push('[阴盘·六亲六神旺衰]');
		lines.push(`以日干 ${fmtValue(yp.self)}（${fmtValue(yp.selfElem)}）为我；${yp.scoreNote}`);
		lines.push('| 位 | 五行 | 六亲 | 六神 | 旺衰 | 分值 | 依据 |');
		lines.push('| --- | --- | --- | --- | --- | --- | --- |');
		yp.wangScore.forEach((s)=>{
			lines.push(`| ${s.wei} | ${fmtValue(s.elem)} | ${fmtValue(qinBy[s.wei])} | ${fmtValue(shenBy[s.wei])} | ${fmtValue(s.level)} | ${s.score > 0 ? `+${s.score}` : s.score} | ${s.detail.length ? s.detail.join('、') : '—'} |`);
		});
		lines.push('');
	}

	// 专题起式（仅左栏选定专题/测年月日/行年时附段；未选则整段不产 → 既有快照逐字零回归）。
	if(jinkouData && (jinkouData.topic || jinkouData.shiJian || jinkouData.xingNian)){
		lines.push('[专题起式]');
		const tp = jinkouData.topic;
		if(tp){
			lines.push(`专题：${fmtValue(tp.title)}——${fmtValue(tp.note)}`);
			if(tp.ready === false){
				lines.push(`待补：${fmtValue(tp.needText)}`);
			}else{
				if(tp.result){ lines.push(`结论：${tp.result}`); }
				if(tp.rows && tp.rows.length){
					lines.push('| 方位 | 将神 | 将名 | 将干 |');
					lines.push('| --- | --- | --- | --- |');
					tp.rows.forEach((r)=>{
						lines.push(`| ${r.fang} | ${fmtValue(r.jiangZi)} | ${fmtValue(r.jiangName)} | ${fmtValue(r.gan)} |`);
					});
				}
			}
		}
		const jue = jinkouData.topicJue;
		if(jue && jue.items && jue.items.length){
			lines.push(`断诀（${jue.kind}）：`);
			jue.items.forEach((it)=>{
				lines.push(`- ${it.wei}${it.zhi ? `·${it.zhi}` : ''}：${fmtValue(it.xiang)}`);
			});
			(jue.notes || []).forEach((n)=>{ lines.push(`- ${n}`); });
		}
		const sj = jinkouData.shiJian;
		if(sj){
			lines.push(`${sj.title}：月将加于 ${fmtValue(sj.addAt)}，数至 ${fmtValue(sj.diFen)}，得将神 ${fmtValue(sj.jiangZi)}（${fmtValue(sj.jiangName)}）；${sj.note}`);
		}
		const xn = jinkouData.xingNian;
		if(xn){
			lines.push(`金口诀行年（旬法）：${xn.gender}·${xn.age}岁 → 行年 ${xn.ganZhi}（${xn.zhi}）；生年 ${xn.birthGanZi} 属 ${xn.xunHead} 旬，一岁起 ${xn.startGanZi}。`);
			if(xn.ge){ lines.push(`- 灾福歌：${xn.ge}`); }
		}
		lines.push('');
	}

	// 四象所属图 / 四象五行图（右栏「用神」页有、快照此前全缺 → AI 看不到用户看的取象表）。
	if(jinkouData && jinkouData.sixiangShu && jinkouData.sixiangShu.length){
		lines.push('[四象所属]');
		lines.push(`| 位 | 干支 | ${JINKOU_SIXIANG_SHU_COLS.map((c)=>c.label).join(' | ')} |`);
		lines.push(`| --- | --- | ${JINKOU_SIXIANG_SHU_COLS.map(()=>'---').join(' | ')} |`);
		jinkouData.sixiangShu.forEach((r)=>{
			lines.push(`| ${r.label} | ${fmtValue(r.ganzhi)} | ${JINKOU_SIXIANG_SHU_COLS.map((c)=>fmtValue(r[c.key])).join(' | ')} |`);
		});
		lines.push('');
	}
	if(jinkouData && jinkouData.sixiangWuxing && jinkouData.sixiangWuxing.rows && jinkouData.sixiangWuxing.rows.length){
		const sw = jinkouData.sixiangWuxing;
		lines.push('[四象五行]');
		if(sw.mainElem){ lines.push(`主象：${fmtValue(sw.mainElem)}${sw.tianqiText ? `　${sw.tianqiText}` : ''}`); }
		lines.push(`| 位 | 五行 | ${JINKOU_SIXIANG_WUXING_COLS.map((c)=>c.label).join(' | ')} |`);
		lines.push(`| --- | --- | ${JINKOU_SIXIANG_WUXING_COLS.map(()=>'---').join(' | ')} |`);
		sw.rows.forEach((r)=>{
			lines.push(`| ${r.label}${r.kong ? '·空' : ''} | ${fmtValue(r.elem)} | ${JINKOU_SIXIANG_WUXING_COLS.map((c)=>fmtValue(r[c.key])).join(' | ')} |`);
		});
		lines.push('');
	}
	// 方位神煞（飞天五鬼 / 喜神）：右栏「神煞」页有。
	if(jinkouData && jinkouData.fangWeiShensha && jinkouData.fangWeiShensha.length){
		lines.push('[方位神煞]');
		jinkouData.fangWeiShensha.forEach((it)=>{
			lines.push(`${fmtValue(it.name)}：${fmtValue(it.fang)}${it.desc ? `——${it.desc}` : ''}`);
		});
		lines.push('');
	}
	// 合占扣题 + 课分内外：右栏「用神」页有。
	if(jinkouData && (jinkouData.hezhan || jinkouData.neiwai)){
		lines.push('[合占扣题与内外]');
		const hz = jinkouData.hezhan;
		if(hz){
			lines.push(`取用：${fmtValue(hz.usePosition)}　时段：${fmtValue(hz.timeLabel)}${hz.askLabel ? `　所问：${hz.askLabel}` : ''}`);
			// chain 是纯字符串数组（每条自带「取事：/时段：/取用：」前缀），不是对象。
			(hz.chain || []).forEach((c)=>{ if(`${c || ''}`.trim()){ lines.push(`- ${c}`); } });
		}
		const nw = jinkouData.neiwai;
		if(nw && nw.rows && nw.rows.length){
			lines.push(`课分内外：${nw.rows.map((r)=>`${r.side}·${r.label}${r.yong ? '(用)' : ''}=${fmtValue(r.content)}`).join('　')}`);
		}
		lines.push('');
	}
	// 二遁人元 / 次客法 / 移星换将：右栏「专题」页恒产出，AI 此前全看不到。
	if(jinkouData && (jinkouData.erDun || (jinkouData.cike && jinkouData.cike.length) || jinkouData.yiXing)){
		lines.push('[二遁与次客]');
		const ed = jinkouData.erDun;
		if(ed){
			lines.push(`二遁人元：原人元 ${fmtValue(ed.yuan)} → 二遁 ${fmtValue(ed.gan)}、三遁 ${fmtValue(ed.thirdGan)}；衣色 ${fmtValue(ed.se)}、住宅物象 ${fmtValue(ed.xiang)}。`);
		}
		(jinkouData.cike || []).forEach((c)=>{
			const extra = [
				c.guiName ? `次课贵神＝${c.guiName}` : '',
				c.altTimeZi ? `代时之支＝${c.altTimeZi.filter(Boolean).join('、')}` : '',
				c.altDayGan ? `换日干＝${c.altDayGan.filter(Boolean).join('、')}` : '',
				c.altDiFen ? `新地分＝${c.altDiFen}` : '',
				c.jiangZi ? `将神＝${c.jiangZi}` : '',
			].filter(Boolean).join('；');
			lines.push(`- ${fmtValue(c.method)}：${fmtValue(c.note)}${extra ? `（${extra}）` : ''}`);
		});
		const yx = jinkouData.yiXing;
		if(yx){ lines.push(`- 移星换将：${fmtValue(yx.note)}（前日干 ${fmtValue(yx.prevDayGan)}、后日干 ${fmtValue(yx.nextDayGan)}）`); }
		lines.push('');
	}

	lines.push('[贵神月将象意]');
	if(jinkouData && jinkouData.xiangyi){
		const gs = jinkouData.xiangyi.guishen;
		const yj = jinkouData.xiangyi.yuejiang;
		if(gs){ lines.push(`贵神·${gs.name}（${gs.shiti || ''}）：${gs.desc || ''}`); }
		if(yj){ lines.push(`将神·${yj.name}：${yj.desc || ''}`); }
		if(!gs && !yj){ lines.push('无'); }
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[分类用神]');
	if(jinkouData && jinkouData.categoryRules){
		const qc = jinkouData.categoryRules.filter((c)=>c.texts && c.texts.length);
		if(qc.length){
			for(let i=0; i<qc.length; i++){
				lines.push(`${qc[i].name}（用神：${qc[i].yongHint || ''}）`);
				for(let j=0; j<qc[i].texts.length; j++){
					lines.push(`- ${qc[i].texts[j]}`);
				}
			}
		}else{
			lines.push('细则完善中');
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[行年]');
	if(runyear){
		lines.push(`行年干支：${fmtValue(runyear.year)}`);
		lines.push(`年龄：${fmtValue(runyear.age)}岁`);
		lines.push(`性别：${xingbie}`);
	}else{
		lines.push('无');
	}
	lines.push('');

	appendMapSection(lines, '旬日', liureng ? liureng.xun : null);
	appendMapSection(lines, '旺衰', liureng ? liureng.season : null);
	appendMapSection(lines, '基础神煞', liureng ? liureng.gods : null);
	appendMapSection(lines, '干煞', liureng ? liureng.godsGan : null);
	appendMapSection(lines, '月煞', liureng ? liureng.godsMonth : null);
	appendMapSection(lines, '支煞', liureng ? liureng.godsZi : null);
	appendMapSection(lines, '岁煞', liureng && liureng.godsYear ? liureng.godsYear.taisui1 : null);

	lines.push('[十二长生]');
	if(wuxing){
		// 十二长生 → GFM 表:阶段/地支。土之长生随流派(申/寅),故优先取引擎 phaseTable,
		// 缺省回落共用 wxphase(=默认水土同宫,既有快照逐字零回归)。
		const zsPhase = jinkouData && jinkouData.phaseTable ? jinkouData.phaseTable : null;
		const zsRows = ZSList.map((item)=>[item, fmtValue((zsPhase && zsPhase[item]) || ZhangSheng.wxphase[`${wuxing}_${item}`])]);
		pushMdRows(lines, ['阶段', '地支'], zsRows);
	}else{
		lines.push('无');
	}

	// [YA v42] A 类硬缺:分析 tab「数理 · 太玄数」(renderTaixuan)显示了却不入快照。
	// 取数与 UI 同源(jinkouData.taixuan,行文案同 renderTaixuan 的 value 拼法);无数据不产段。
	const jkTaixuan = jinkouData && jinkouData.taixuan && jinkouData.taixuan.length ? jinkouData.taixuan : [];
	if(jkTaixuan.length){
		lines.push('');
		lines.push('[数理]');
		for(let i=0; i<jkTaixuan.length; i++){
			const t = jkTaixuan[i];
			lines.push(`${t.label}：${t.tokens || '—'}　太玄数 ${t.num}`);
		}
	}
	return lines.join('\n').trim();
}

function mapObjToRows(obj){
	if(!obj || typeof obj !== 'object'){
		return [];
	}
	const keys = Object.keys(obj);
	const rows = [];
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		let value = obj[key];
		if(value instanceof Array){
			value = value.join('、');
		}
		rows.push({
			key: cleanKey(key),
			value: value === undefined || value === null || value === '' ? '—' : `${value}`,
		});
	}
	return rows;
}

function normalizeZiFromText(text){
	const txt = `${text || ''}`;
	for(let i=0; i<txt.length; i++){
		const one = txt.substr(i, 1);
		if(LRConst.ZiList.indexOf(one) >= 0){
			return one;
		}
	}
	return '';
}

function resolveChartIsDiurnal(chartObj){
	if(chartObj === undefined || chartObj === null){
		return null;
	}
	const chart = chartObj.chart ? chartObj.chart : chartObj;
	if(chart && typeof chart.isDiurnal === 'boolean'){
		return chart.isDiurnal;
	}
	return null;
}

// 本命属相 / 行年虚岁：单一真值源 = 问测人出生时间（不再手填，免两处输入打架）。
//   属相 = 生年干支之地支（runyear.birthGanZi 由 requestBirthYearGanZi 取回并留档）；
//   虚岁 = 卜卦年 − 生年 + 1（runyear.age 是年份差，0 即出生当年 → 虚岁 1）。
// 生年干支未取回时属相为空，专题引擎按「需填属相」提示而非乱算（缺参不臆造）。
export function deriveBenMingFromRunYear(runyear){
	const gz = runyear && runyear.birthGanZi ? `${runyear.birthGanZi}` : '';
	const zhi = gz.length >= 2 ? gz.charAt(1) : '';
	return LRConst.ZiList.indexOf(zhi) >= 0 ? zhi : '';
}
export function deriveXuSuiFromRunYear(runyear){
	const age = runyear && runyear.age !== undefined && runyear.age !== null ? Number(runyear.age) : NaN;
	return Number.isFinite(age) && age >= 0 ? age + 1 : '';
}

function getAppliedBirth(state){
	if(state && state.calcBirth){
		return state.calcBirth;
	}
	return state ? state.birth : null;
}

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function buildCacheKey(obj){
	try{
		return JSON.stringify(obj || {});
	}catch(e){
		return '';
	}
}

function pushCache(map, key, val, max = 96){
	if(!map || !key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > max){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

// horosa_kentang_result_cache_v1 —— /liureng/gods + /liureng/runyear(金口诀复用六壬两端点)
// 与出生年干支的结果缓存**提升到模块级**。原为 per-instance:切走金口页 → 组件卸载 → 缓存与在途
// Promise 一起蒸发,切回来整趟往返重付。三者均为确定性纯计算(key = genGodsParams/genRunYearParams/
// 出生 params 的 JSON,即请求体本身:'YYYY-MM-DD'/'HH:mm' 格式化字串 + 经纬/时区/性别/日界开关,
// 无 Date 对象、无随机、无「现在时刻」依赖),跨实例复用与直连逐值等价。
// ns 显式写死在常量名里(**不**由 URL 派生:ServerRoot 端口每次后端启动随机)。
// 上限沿用原调用点传给 pushCache 的 72 / 96(未改);出生年干支表另有 localStorage 冷启层,见下。
// 关 horosa.perf.techniqueResultCache → 构造函数回到 new Map()/{}(=今日 per-instance 行为,逐字一致)。
const JINKOU_BIRTH_GANZI_MEM = {};
const JINKOU_BIRTH_GANZI_MAX = 96;

// 出生年干支表提到模块级后必须有界(原 per-instance 明文无上限,靠卸载「自然清零」);
// 值只是两字干支串,96 条即够整轮命例来回,插入序淘汰最早一条。
function rememberBirthGanZi(map, key, val){
	if(!map || !key || !val){
		return;
	}
	map[key] = val;
	const keys = Object.keys(map);
	if(keys.length > JINKOU_BIRTH_GANZI_MAX){
		delete map[keys[0]];
	}
}
const JINKOU_GODS_MEM = new Map();
const JINKOU_GODS_INFLIGHT = new Map();
const JINKOU_RUNYEAR_MEM = new Map();
const JINKOU_RUNYEAR_INFLIGHT = new Map();

class JinKouMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);
		const now = new DateTime();
		const birth = buildBirthFields(this.props.fields, now);

		this.state = {
			birth: birth,
			calcBirth: birth,
			liureng: null,
			runyear: null,
			wuxing: '土',
			// [B6·P2] 贵神体系恒 0（六壬法）：左栏无此控件，参考典籍亦无「遁甲法/星占法贵人」之目。
			// 流派差异走「贵人昼夜表」(schoolGuiTable)。此键只为兼容旧事盘档与 AI 挂载设置而留。
			guireng: 0,
			// 专题起式（定局法）：未选＝主课不受影响。
			// 本命属相与行年虚岁不入 state —— 由「问测人出生时间」经 deriveBenMing/deriveXuSui 现算，
			// 单一真值源，避免手填值与出生档不一致时谁说了算的问题。
			topicKey: '',
			shiJianKind: '',
			// 合占扣题（G6/E1-3）：引擎早已支持七类扣题与三档时段，此前无 UI 入口，
			// 右栏「所问」恒「未限定」、「时段」恒「常规」，七个分类分支页面永不可达。
			askKey: '',
			timeScope: 'default',
			// 十二长生五行默认跟随日干；用户一旦手选即置 false，此后重排不再覆写。
			wuxingAuto: true,
			diFenSource: 'zhi',
			diFenSourceInput: '',
			// 参考页赋文折叠态（纯展示，不入装配签名、不随档）
			fuwenOpen: {},
			// 金口诀行年（旬法）虚岁；与既有干支流年并存，空则不产出。
			diFen: '子',
			diFenAuto: true,
			yueJiang: 'auto',
			zhanShi: 'auto',
			// 排盘流派(P0-1)：默认中气换将/实务派贵人/地盘起贵神/阳盘 → 与现有后端盘零回归。
			schoolYueJiang: 'zhongqi',
			schoolGuiTable: 'shiwu',
			schoolGuiPan: 'di',
			panShi: 'yang',
			soilChangSheng: 'shen',
			timeBasis: 'direct',
			jinkouPan: null,
			jinkouError: '',
			rightPanelTab: 'overview',
			calcFields: null,
			calcIsDiurnal: null,
		};

		this.unmounted = false;
		// horosa_kentang_result_cache_v1:命中模块级 LRU(切页往返 0 请求);关闸=每实例独立(旧行为)。
		const jkShareCache = techniqueResultCacheEnabled();
		this.birthYearGanZiCache = jkShareCache ? JINKOU_BIRTH_GANZI_MEM : {};
		// 金口数据装配缓存(单槽 last-result):render() 每次都调 assembleJinKouData→buildJinKouData(引擎)。
		// 切右栏 tab(rightTab/rightPanelTab/analysisTab/auxTab)只改无关 state,却让引擎整盘重跑。
		// 按「装配实际消费的全部输入(liureng/backendPan 引用 + 各流派/地分/贵神/月将/盘式开关)」做签名,
		// 签名全等 → 复用上次实例(byte-perfect:同输入必同输出);任一变 → 真重算。kill-switch 复用 chartDrawGuard 闸。
		this._jinkouDataCache = null;
		this.godsCache = jkShareCache ? JINKOU_GODS_MEM : new Map();
		this.godsInflight = jkShareCache ? JINKOU_GODS_INFLIGHT : new Map();
		this.runYearServerCache = jkShareCache ? JINKOU_RUNYEAR_MEM : new Map();
		this.runYearServerInflight = jkShareCache ? JINKOU_RUNYEAR_INFLIGHT : new Map();

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onDiFenChange = this.onDiFenChange.bind(this);
		this.onYueJiangChange = this.onYueJiangChange.bind(this);
		this.onZhanShiChange = this.onZhanShiChange.bind(this);
		this.onSchoolChange = this.onSchoolChange.bind(this);
		this.assembleJinKouData = this.assembleJinKouData.bind(this);
		this.onTimeBasisChange = this.onTimeBasisChange.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.genWuXingDoms = this.genWuXingDoms.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.requestBirthYearGanZi = this.requestBirthYearGanZi.bind(this);
		this.saveJinKouSnapshot = this.saveJinKouSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.renderInfoTable = this.renderInfoTable.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.requestGods(fields || this.props.fields, chartObj || this.props.value);
			};
		}
	}

	onFieldsChange(field){
		const patch = {
			...(field || {}),
		};
		const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
		const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
		if(hasConfirmedFlag && !confirmed){
			return;
		}
		if(hasConfirmedFlag){
			delete patch.__confirmed;
		}
		// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
		if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
			this._after23BoundaryUserOverrode = true;
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
		}
		// v2.2.1: 时柱开关同款局部覆盖 — 同时设本地 flag 和 dva 中央 flag
		if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
			this._lateZiHourUserOverrode = true;
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
		}
		if(this.props.dispatch && this.props.fields){
			const flds = {
				...this.props.fields,
				...patch,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds,
					__requestOptions: {
						silent: true,
					},
					nohook: !confirmed,
				},
			});
			// [R3-A4] 步进时静默备下 T+1 的 gods+pan(链与 requestGods 完全同源)
			if(confirmed && patch.__stepHint){
				this.prefetchNextStepJinkou(flds, patch.__stepHint);
			}
		}
	}

	// [R3-A4] 顺向 +1 步预取:genGodsParams→/liureng/gods(requestDedupe 缓存)→
	// resolveJinKouDiFen(同款选项解析)→fetchJinKouPan(kentangCache)——与 requestGods
	// 消费链逐环同源 → 键逐字节等。失败静默;开关关=零行为。
	prefetchNextStepJinkou(baseFields, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(!stepHint || !stepHint.dir){ return; }
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				this._prefetchJinkouAtStep(baseFields, stepHint.unit || 'm', stepHint.dir);
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	}

	// 取数内核:以 baseFields 时间为基走 1 步×dir,同源链(genGodsParams→/liureng/gods→
	// fetchJinKouPan)预取该时刻课盘。settle 链(+1 同向)与选步长(±1 双向)共用。
	_prefetchJinkouAtStep(baseFields, unit, dir){
		try{
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			const dt2 = dt0.clone();
			if(unit === 'y'){ dt2.addYear(dir); }
			else if(unit === 'M'){ dt2.addMonth(dir); }
			else if(unit === 'd'){ dt2.addDate(dir); }
			else if(unit === 'h'){ dt2.addHour(dir); }
			else { dt2.addMinute(4 * dir); }
			const flds2 = {
				...baseFields,
				date: { value: dt2.clone() },
				time: { value: dt2.clone() },
				ad: { value: dt2.ad },
				zone: { value: dt2.zone },
			};
			const params = this.genGodsParams(flds2);
			if(!params){ return; }
			request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			}).then((data)=>{
				const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
				if(!result || !result.liureng || this.unmounted){ return null; }
				const timeZi = normalizeZiFromText(result.liureng.nongli.time);
				const diFen = resolveJinKouDiFen(
					this.state.diFen,
					this.state.diFenAuto === true,
					timeZi,
					!!this.state.liureng
				);
				return fetchJinKouPan(flds2, result.liureng.nongli, {
					diFen: diFen,
					yueJiang: this.state.yueJiang,
					zhanShi: this.state.zhanShi,
					timeBasis: this.state.timeBasis,
				});
			}).catch(()=>null);
		}catch(e){ /* 预取失败无害 */ }
	}

	// [R3-A1 下放] 选步长即预取:金口诀 gods→pan 双段链是本页主耗时,全局 handler 只罩 /chart ——
	// 以当前时间 ±1 双向预热课盘,选完步长第一下步进即命中。同 unit 5s 去重。
	prefetchStepSelect(unit){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled() || !stepSelectPrefetchEnabled() || !unit){ return; }
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			const flds = this.props.fields || {};
			this._prefetchJinkouAtStep(flds, unit, 1);
			this._prefetchJinkouAtStep(flds, unit, -1);
		}catch(e){ /* 预取失败无害 */ }
	}

	onBirthChange(field){
		const patch = {
			...(field || {}),
		};
		if(Object.prototype.hasOwnProperty.call(patch, '__confirmed')){
			delete patch.__confirmed;
		}
		const flds = {
			...this.state.birth,
			...patch,
		};
		const next = { birth: flds };
		// 性别与日期时间不同：不需要「确认」语义，改了就该立刻生效（右栏性别、行年男顺女逆、
		// 中栏性别格、xingNian.gender 全看 calcBirth）。原先只写 birth，要等下次起课才更新，
		// 用户在左栏把性别改成女、右栏却一直显示男。此处把性别单独同步进 calcBirth。
		const prevGender = this.state.calcBirth && this.state.calcBirth.gender ? this.state.calcBirth.gender.value : undefined;
		const nextGender = flds.gender ? flds.gender.value : undefined;
		if(this.state.calcBirth && nextGender !== undefined && nextGender !== prevGender){
			next.calcBirth = { ...this.state.calcBirth, gender: { ...(this.state.calcBirth.gender || {}), value: nextGender } };
		}
		this.setState(next, ()=>{
			// 行年男顺女逆随性别翻转 → 重取行年并重存挂载快照（与流派 setter 同律）。
			if(next.calcBirth && this.state.liureng){
				this.requestRunYear();
			}
		});
	}

	onWuXingChange(val){
		// wuxingAuto=false 起，requestGods 不再拿日干五行覆写用户的手选值
		// （原先改一下地分/月将/占时/时间基准就把用户选的「木」静默打回日干的「金」）。
		this.setState({
			wuxing: val,
			wuxingAuto: false,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng, this.state.diFen);
		});
	}


	onDiFenChange(val){
		this.setState({
			diFen: val,
			diFenAuto: false,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields, this.props.value);
			}else{
				this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, val);
			}
		});
	}

	onYueJiangChange(val){
		this.setState({
			yueJiang: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields, this.props.value);
			}
		});
	}

	onZhanShiChange(val){
		this.setState({
			zhanShi: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields, this.props.value);
			}
		});
	}

	// 排盘流派切换(月将换将/贵人昼夜表/起贵神盘/盘式)：纯前端确定性重算，只触发重渲染(无需后端)。
	onSchoolChange(key, val){
		this.setState({ [key]: val }, ()=>{
			// [X1·P1-6] 与五行/贵人/地分 setter 同律:流派改后重存挂载快照,否则 AI 挂载读旧流派盘文
			// (导出有 refresh 事件自愈,挂载路径读缓存无自愈)。
			if(this.state.liureng){
				this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, this.state.diFen, this.state.jinkouPan);
			}
		});
	}

	// 组装显示用金口诀数据：流派非默认时以本地确定性重算为准(后端不解流派)；默认时走后端盘(零回归)。
	assembleJinKouData(liureng, backendPan){
		// 签名 = 装配实际消费的全部输入(liureng/backendPan 引用 + 地分/贵神/昼夜/月将/占时/三流派/盘式)。
		// 全等 → 复用上次结果(同输入必同输出,引用稳定);任一变 → 真重算。切右栏 tab 不动这些 → 跳过引擎重跑。
		const guardOn = chartDrawGuardEnabled();
		const sigArr = [
			liureng, backendPan,
			this.state.diFen, this.state.guireng, this.state.calcIsDiurnal,
			this.state.yueJiang, this.state.zhanShi,
			this.state.schoolYueJiang, this.state.schoolGuiTable, this.state.schoolGuiPan,
			this.state.panShi, this.state.soilChangSheng,
			// wuxing 决定 phaseTable(十二长生表)：漏进签名 → 切五行时右栏长生表被缓存钉死在旧五行。
			this.state.wuxing,
			// 专题起式与行年（新增消费输入，须进签名否则切专题不重算）
			this.state.topicKey, this.state.shiJianKind, this.state.askKey, this.state.timeScope,
			// 行年旬法只吃这两个派生值(非整个 runyear 对象),避免每轮取回都判失效
			this.state.runyear ? this.state.runyear.birthGanZi : '',
			this.state.runyear ? this.state.runyear.age : '',
		];
		if(guardOn && this._jinkouDataCache && sameSigArr(this._jinkouDataCache.sig, sigArr)){
			return this._jinkouDataCache.data;
		}

		let result;
		if(!liureng){
			result = normalizeKinjinkouData(backendPan, null);
		}else{
			const appliedBirthForCalc = getAppliedBirth(this.state);
			const local = buildJinKouData(liureng, {
				diFen: this.state.diFen,
				guirengType: this.state.guireng,
				isDiurnal: this.state.calcIsDiurnal,
				yueJiang: this.state.yueJiang,
				zhanShi: this.state.zhanShi,
				schoolYueJiang: this.state.schoolYueJiang,
				schoolGuiTable: this.state.schoolGuiTable,
				schoolGuiPan: this.state.schoolGuiPan,
				panShi: this.state.panShi,
				soilChangSheng: this.state.soilChangSheng,
				wuxing: this.state.wuxing,
				// 专题起式（未选则引擎侧为 null，零额外开销）
				topicKey: this.state.topicKey,
				shiJianKind: this.state.shiJianKind,
				askKey: this.state.askKey,
				timeScope: this.state.timeScope,
				benMing: deriveBenMingFromRunYear(this.state.runyear),
				// 金口诀行年（旬法）：生年干支取自问测人档（runyear 留档），虚岁优先取左栏输入，
				// 未填则回落既有干支流年之岁数；与既有干支流年两法并存互不覆盖。
				birthGanZi: this.state.runyear ? this.state.runyear.birthGanZi : '',
				gender: appliedBirthForCalc && appliedBirthForCalc.gender ? appliedBirthForCalc.gender.value : 1,
				age: deriveXuSuiFromRunYear(this.state.runyear),
			});
			const isDefault = (this.state.schoolYueJiang || 'zhongqi') === 'zhongqi'
				&& (this.state.schoolGuiTable || 'shiwu') === 'shiwu'
				&& (this.state.schoolGuiPan || 'di') === 'di'
				&& (this.state.panShi || 'yang') === 'yang'
				&& (this.state.soilChangSheng || 'shen') === 'shen';
			// [BUG-1] 日柱两源分叉闸：/liureng/gods 不接 timeBasis(后端恒按真太阳时定日柱)，
			// 而 /jinkou/pan 接 —— 跨日界(晚子时)且选「直接时间」时两者日柱会差一天。
			// 此时若照用 pan，就成了「盘面按 pan 的日干起人元、右栏一切解读按 liureng 的日干」，
			// 一张课两个日干。判不齐即退回本地引擎(全程只吃 liureng 日干，自洽)。
			const panDay = backendPan && backendPan.ganzhi ? backendPan.ganzhi.day : '';
			const lrDay = liureng && liureng.nongli ? liureng.nongli.dayGanZi : '';
			const dayAligned = !panDay || !lrDay || `${panDay}` === `${lrDay}`;
			result = (isDefault && dayAligned) ? normalizeKinjinkouData(backendPan, local) : local;
			if(isDefault && !dayAligned){
				result.daySourceNote = `课时跨日界：后端盘按「${panDay}」日、历法按「${lrDay}」日，已统一取「${lrDay}」日推算（改「时间基准」为真太阳时可使两者一致）。`;
			}
			// [G21] 三盘环已由本地引擎按当前流派现算（buildJinKouPlates），不再有「待续」占位。
			// 仅当本地未能产出（月将/占时缺失）时才回落后端环，两者都没有才说明。
			if(!isDefault && (!result.plates || !result.plates.length)){
				if(backendPan && Array.isArray(backendPan.plates) && backendPan.plates.length){
					result.plates = backendPan.plates;
				}else{
					result.platesNote = '月将或占时未定，三盘环待起课后产出 —— 先以上方四位盘为准';
				}
			}
		}

		if(guardOn){
			this._jinkouDataCache = { sig: sigArr, data: result };
		}
		return result;
	}

	onTimeBasisChange(val){
		this.setState({
			timeBasis: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields, this.props.value);
			}
		});
	}

	setRightPanelTab(key){
		this.setState({
			rightPanelTab: key,
		});
	}

	genRunYearParams(){
		const flds = getAppliedBirth(this.state);
		const calcFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const guaDate = calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.format('YYYY-MM-DD') : '';
		const guaTime = calcFields && calcFields.time && calcFields.time.value ? calcFields.time.value.format('HH:mm') : '';
		const guaAd = calcFields && calcFields.ad && calcFields.ad.value !== undefined
			? calcFields.ad.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.ad : 1);
		const guaZone = calcFields && calcFields.zone && calcFields.zone.value
			? calcFields.zone.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.zone : '');
		const guaLon = calcFields && calcFields.lon ? calcFields.lon.value : '';
		const guaLat = calcFields && calcFields.lat ? calcFields.lat.value : '';
		const guaAfter23 = calcFields && calcFields.after23NewDay && calcFields.after23NewDay.value !== undefined
			? calcFields.after23NewDay.value
			: 0;
		const lateZiVal = flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined
			? flds.lateZiHourUseNextDay.value
			: defaultLateZiHourUseNextDay();
		return {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gender: flds.gender.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: lateZiVal,
			guaYearGanZi: resolveGuaYearGanZi(this.state.liureng),
			guaDate: guaDate,
			guaTime: guaTime,
			guaAd: guaAd,
			guaZone: guaZone,
			guaLon: guaLon,
			guaLat: guaLat,
			guaAfter23NewDay: guaAfter23,
		};
	}

	genGodsParams(fields){
		let params = null;
		const flds = fields ? fields : this.props.fields;
		const after23 = flds.after23NewDay && flds.after23NewDay.value !== undefined ? flds.after23NewDay.value : defaultAfter23NewDay();
		const lateZi = flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay();
		if(flds.params){
			const dtparts = flds.params.birth.split(' ');
			params = {
				...flds.params,
				date: dtparts[0],
				time: dtparts[1],
				after23NewDay: flds.params.after23NewDay !== undefined ? flds.params.after23NewDay : after23,
				lateZiHourUseNextDay: flds.params.lateZiHourUseNextDay !== undefined ? flds.params.lateZiHourUseNextDay : lateZi,
			};
		}else{
			params = {
				date: flds.date.value.format('YYYY-MM-DD'),
				time: flds.time.value.format('HH:mm'),
				zone: flds.date.value.zone,
				ad: flds.date.value.ad,
				lon: flds.lon.value,
				lat: flds.lat.value,
				after23NewDay: after23,
				lateZiHourUseNextDay: lateZi,
			};
		}
		return params;
	}

	async requestBirthYearGanZi(){
		const flds = getAppliedBirth(this.state);
		if(!flds || !flds.date || !flds.time){
			return '';
		}
		const key = [
			flds.date.value.format('YYYY-MM-DD'),
			flds.time.value.format('HH:mm'),
			flds.date.value.ad,
			flds.date.value.zone,
			flds.lon.value,
			flds.lat.value,
			flds.after23NewDay.value,
		].join('|');
		if(this.birthYearGanZiCache[key]){
			return this.birthYearGanZiCache[key];
		}
		const localHit = getBirthGanzhiLocalCache(key);
		if(localHit){
			rememberBirthGanZi(this.birthYearGanZiCache, key, localHit);
			return localHit;
		}
		const params = {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		};
		try{
			const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			});
			const lr = data && data[Constants.ResultKey] ? data[Constants.ResultKey].liureng : null;
			const ganzi = extractGanZi(
				lr && lr.fourColumns && lr.fourColumns.year ? lr.fourColumns.year.ganzi : ''
			) || extractGanZi(lr && lr.nongli ? (lr.nongli.yearGanZi || lr.nongli.yearJieqi || lr.nongli.year) : '');
			if(ganzi){
				rememberBirthGanZi(this.birthYearGanZiCache, key, ganzi);
				setBirthGanzhiLocalCache(key, ganzi);
			}
			return ganzi;
		}catch(e){
			return '';
		}
	}

	saveJinKouSnapshot(params, liureng, runyear, wuxing, guirengType, diFen, jinkouPan){
		if(!liureng){
			return;
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return;
		}
		const finalZone = baseParams.zone !== undefined ? baseParams.zone : (flds && flds.zone ? flds.zone.value : '');
		const finalLon = baseParams.lon !== undefined ? baseParams.lon : (flds && flds.lon ? flds.lon.value : '');
		const finalLat = baseParams.lat !== undefined ? baseParams.lat : (flds && flds.lat ? flds.lat.value : '');
		const saveParams = {
			...baseParams,
			zone: finalZone,
			lon: finalLon,
			lat: finalLat,
		};
		const jinkouData = this.assembleJinKouData(liureng, jinkouPan || this.state.jinkouPan);
		const appliedBirth = getAppliedBirth(this.state);
		saveModuleAISnapshotLazy('jinkou', ()=>buildJinKouSnapshotText(
			saveParams,
			liureng,
			runyear,
			jinkouData,
			wuxing,
			guirengType,
			appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1
		), {
			date: saveParams.date,
			time: saveParams.time,
			zone: saveParams.zone,
			lon: saveParams.lon,
			lat: saveParams.lat,
			diFen: jinkouData && jinkouData.topInfo ? jinkouData.topInfo.diFen : '',
		});
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。数据源与 render() 完全一致(均取 this.state)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'jinkou'){
			return;
		}
		const liureng = this.state ? this.state.liureng : null;
		if(!liureng){
			return;
		}
		let snapshotText = '';
		try{
			const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
			const params = flds ? this.genGodsParams(flds) : null;
			const appliedBirth = getAppliedBirth(this.state);
			const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, flds);
			const jinkouData = this.assembleJinKouData(liureng, this.state.jinkouPan);
			snapshotText = `${buildJinKouSnapshotText(
				params,
				liureng,
				displayRunYear,
				jinkouData,
				this.state.wuxing,
				this.state.guireng,
				appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1
			) || ''}`.trim();
		}catch(e){
			snapshotText = '';
		}
		if(snapshotText){
			saveModuleAISnapshot('jinkou', snapshotText);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = snapshotText;
			}
		}
	}

	async requestGods(fields, chartObj){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genGodsParams(fields);
		const godsKey = buildCacheKey(params);
		let result = null;
		if(godsKey && this.godsCache.has(godsKey)){
			result = clonePlain(this.godsCache.get(godsKey));
		}else if(godsKey && this.godsInflight.has(godsKey)){
			result = clonePlain(await this.godsInflight.get(godsKey));
		}else{
			const req = request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			}).then((data)=>{
				return data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			}).finally(()=>{
				if(godsKey){
					this.godsInflight.delete(godsKey);
				}
			});
			if(godsKey){
				this.godsInflight.set(godsKey, req);
			}
			result = await req;
			if(godsKey && result){
				pushCache(this.godsCache, godsKey, clonePlain(result), 72);
			}
		}
		if(!result || !result.liureng){
			return;
		}

		const dayGanZi = result.liureng.nongli.dayGanZi;
		const dayGan = dayGanZi.substr(0, 1);
		const wx = LRConst.GanZiWuXing[dayGan];
		const timeZi = normalizeZiFromText(result.liureng.nongli.time);
		const diFen = resolveJinKouDiFen(
			this.state.diFen,
			this.state.diFenAuto === true,
			timeZi,
			!!this.state.liureng
		);
		const calcIsDiurnal = resolveChartIsDiurnal(chartObj === undefined ? this.props.value : chartObj);
		const appliedBirth = buildBirthFields(this.state.birth, new DateTime());
		let jinkouPan = null;
		let jinkouError = '';
		try{
			jinkouPan = await fetchJinKouPan(fields, result.liureng.nongli, {
				diFen: diFen,
				yueJiang: this.state.yueJiang,
				zhanShi: this.state.zhanShi,
				timeBasis: this.state.timeBasis,
			});
		}catch(e){
			jinkouError = e && e.message ? e.message : '金口诀本地排盘服务尚未就绪';
			console.warn('kinjinkou backend failed, falling back to local JinKouCalc', e);
		}
		const st = {
			liureng: result.liureng,
			calcBirth: appliedBirth,
			diFen: diFen,
			jinkouPan: jinkouPan,
			jinkouError: jinkouError,
			calcFields: fields,
			calcIsDiurnal: calcIsDiurnal,
		};
		// 自动档才跟随日干；用户手选过就保留其选择（见 onWuXingChange）。
		if(this.state.wuxingAuto !== false){
			st.wuxing = wx;
		}

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:金口诀「画完」= 中栏四位盘(本次 st)+ 右栏「流年」段(requestRunYear
			// 的二段 setState)都落定。requestRunYear 有多条早退分支(缺出生/年份校验 Modal),挂在它
			// 返回的 promise 上两态都能收口;markPanelReady 自带 generation 去重,重复调用为空操作。
			// tabKey 用顶层页签 key 'cnyibu'(金口诀是「其他」页内的子页面),与 markInteractionStart 同名。
			const markReady = ()=>{ markPanelReady('cnyibu'); };
			Promise.resolve(this.requestRunYear()).then(markReady, markReady);
			// 快照的五行须与页面实际所用一致（手选档下不能再写日干的 wx，否则快照与右栏两张表）。
			this.saveJinKouSnapshot(params, result.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, diFen, jinkouPan);
		});
	}

	async requestRunYear(){
		if(this.state.liureng === null){
			return;
		}
		const fields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!fields || !fields.date || !fields.date.value){
			return;
		}
		const birthFields = getAppliedBirth(this.state);
		if(!birthFields || !birthFields.date || !birthFields.date.value){
			return;
		}
		const params = this.genRunYearParams();
		const birthSolarYear = getSolarYearFromField(birthFields.date);
		const guaSolarYear = getSolarYearFromField(fields.date);
		// 带符号天文年比较(公元前 3044 早于公元前 3040):绝不能用 abs 年,BC 侧会反向误判
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && birthSolarYear > guaSolarYear){
			Modal.error({
				title: '出生年份必须小于卜卦年份',
			});
			return;
		}
		const genderVal = birthFields && birthFields.gender ? birthFields.gender.value : 1;
		let fallbackRunYear = null;
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && guaSolarYear >= birthSolarYear){
			const age = guaSolarYear - birthSolarYear;
			const ageCycle = ((age % 60) + 60) % 60;
			const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
			fallbackRunYear = {
				age: age,
				ageCycle: ageCycle,
				year: yearList[ageCycle] || '',
			};
		}
		if(!params.guaYearGanZi && !fallbackRunYear){
			Modal.error({
				title: '无法识别卜卦年份干支，请先排盘后再试',
			});
			return;
		}

		let result = fallbackRunYear ? { ...fallbackRunYear } : {};
		const runyearKey = buildCacheKey(params);
		try{
			let serverRes = {};
			const localRunyearHit = runyearKey ? getLiurengRunyearLocalCache(runyearKey) : null;
			if(runyearKey && this.runYearServerCache.has(runyearKey)){
				serverRes = clonePlain(this.runYearServerCache.get(runyearKey)) || {};
			}else if(runyearKey && this.runYearServerInflight.has(runyearKey)){
				serverRes = clonePlain(await this.runYearServerInflight.get(runyearKey)) || {};
			}else if(localRunyearHit){
				serverRes = clonePlain(localRunyearHit) || {};
				pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
			}else{
				const req = request(`${Constants.ServerRoot}/liureng/runyear`, {
					body: JSON.stringify(params),
					silent: true,
				}).then((data)=>{
					return data && data[Constants.ResultKey] ? { ...data[Constants.ResultKey] } : {};
				}).finally(()=>{
					if(runyearKey){
						this.runYearServerInflight.delete(runyearKey);
					}
				});
				if(runyearKey){
					this.runYearServerInflight.set(runyearKey, req);
				}
				serverRes = await req;
				if(runyearKey){
					pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
					setLiurengRunyearLocalCache(runyearKey, clonePlain(serverRes));
				}
			}
			result = {
				...serverRes,
				...result,
			};
			const guaGanZi = extractGanZi(params.guaYearGanZi) || resolveGuaYearGanZi(this.state.liureng);
			const birthGanZi = await this.requestBirthYearGanZi();
			// 生年干支留档：金口诀行年（旬法）要以生年所在旬起一岁，与干支流年并存两法。
			result.birthGanZi = extractGanZi(birthGanZi) || '';
			let localRunYear = calcRunYearLocal(
				birthGanZi,
				guaGanZi,
				genderVal,
				birthSolarYear,
				guaSolarYear
			);
			if(!localRunYear && fallbackRunYear){
				localRunYear = fallbackRunYear;
			}
			if(!localRunYear && serverRes.age !== undefined && serverRes.age !== null){
				const age = Number(serverRes.age);
				if(Number.isFinite(age)){
					const ageCycle = ((age % 60) + 60) % 60;
					const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
					localRunYear = {
						age: age,
						ageCycle: ageCycle,
						year: yearList[ageCycle] || serverRes.year || '',
					};
				}
			}
			if(localRunYear){
				result.year = localRunYear.year;
				result.age = localRunYear.age;
				result.ageCycle = localRunYear.ageCycle;
			}
		}catch(e){
			if(fallbackRunYear){
				result = {
					...result,
					...fallbackRunYear,
				};
			}
		}
		if(fallbackRunYear){
			if(result.year === undefined || result.year === null || result.year === ''){
				result.year = fallbackRunYear.year;
			}
			if(result.age === undefined || result.age === null || Number.isNaN(Number(result.age))){
				result.age = fallbackRunYear.age;
			}
			if(result.ageCycle === undefined || result.ageCycle === null || Number.isNaN(Number(result.ageCycle))){
				result.ageCycle = fallbackRunYear.ageCycle;
			}
		}
		this.setState({
			runyear: result,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, result, this.state.wuxing, this.state.guireng, this.state.diFen, this.state.jinkouPan);
		});
	}


	// 事盘回放(2026-07-05 储存审计补):打开已存金口诀事盘时把课盘数据+全部流派/盘式/
	// 地分/月将占时设置整体回放(与 太乙/奇门/卦占 同范式);cid|updateTime 去重;快照原样回写。
	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('jinkou');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const p = saved.payload;
		this.lastRestoredCaseId = saved.caseVersion;
		const optionKeys = ['wuxing', 'wuxingAuto', 'guireng', 'diFen', 'diFenAuto', 'yueJiang', 'zhanShi', 'schoolYueJiang', 'schoolGuiTable', 'schoolGuiPan', 'panShi', 'soilChangSheng', 'timeBasis',
			// 专题起式一组:与流派同档回放,否则存了专题课再开右栏「专题」页整页空
			'topicKey', 'shiJianKind', 'askKey', 'timeScope', 'diFenSource', 'diFenSourceInput'];
		const next = {};
		optionKeys.forEach((key)=>{
			if(p[key] !== undefined && p[key] !== null){
				next[key] = p[key];
			}
		});
		if(p.liureng){
			next.liureng = p.liureng;
		}
		if(p.jinkouPan){
			next.jinkouPan = p.jinkouPan;
		}
		if(p.runyear !== undefined && p.runyear !== null){
			next.runyear = p.runyear;
		}
		// [X1·P1-7] 回放问测人出生(行年真源),免还原后一经重算行年被缺省 birth 打回默认。
		if(p.birthSaved && p.birthSaved.date){
			try{
				const bt = new DateTime();
				if(p.birthSaved.zone){ bt.setZone(p.birthSaved.zone); }
				const parsed = bt.parse(`${p.birthSaved.date} ${p.birthSaved.time || '00:00:00'}`, 'YYYY-MM-DD HH:mm:ss');
				const bf = buildBirthFields({
					date: { value: parsed }, time: { value: parsed },
					zone: { value: p.birthSaved.zone }, gender: { value: p.birthSaved.gender },
				}, parsed);
				next.birth = bf;
				next.calcBirth = bf;
			}catch(e){ /* 坏档忽略,保现状 */ }
		}
		if(!Object.keys(next).length){
			return false;
		}
		this.setState(next, ()=>{
			if(p.snapshot){
				saveModuleAISnapshot('jinkou', p.snapshot);
			}
		});
		return true;
	}

	clickSaveCase(){
		if(!this.state.liureng){
			message.warning('请先完成起课后再保存');
			return;
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!flds){
			return;
		}
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, getAppliedBirth(this.state), flds);
		const snapshot = loadModuleAISnapshot('jinkou');
		const payload = {
			module: 'jinkou',
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: displayRunYear,
			wuxing: this.state.wuxing,
			// 「是否手选」也随档：否则回放一张手选五行/钉死地分的档，下次重排即被自动档打回
			wuxingAuto: this.state.wuxingAuto,
			guireng: this.state.guireng,
			diFen: this.state.diFen,
			diFenAuto: this.state.diFenAuto,
			// 月将/占时覆盖(2026-07-05 储存审计补:此前漏存,回放后变默认)
			yueJiang: this.state.yueJiang,
			zhanShi: this.state.zhanShi,
			jinkouPan: this.state.jinkouPan,
			// 流派/盘式(命盘事盘储存:还原时连同流派一并恢复,避免存了课再开变回默认派)
			schoolYueJiang: this.state.schoolYueJiang,
			schoolGuiTable: this.state.schoolGuiTable,
			schoolGuiPan: this.state.schoolGuiPan,
			panShi: this.state.panShi,
			soilChangSheng: this.state.soilChangSheng,
			timeBasis: this.state.timeBasis,
			// 专题起式/定地分取法/行年虚岁(命盘事盘储存:专题课与断诀是右栏一整页,不随档则回放后整页空)
			topicKey: this.state.topicKey,
			shiJianKind: this.state.shiJianKind,
			askKey: this.state.askKey,
			timeScope: this.state.timeScope,
			diFenSource: this.state.diFenSource,
			diFenSourceInput: this.state.diFenSourceInput,
			// [X1·P1-7] 问测人出生(行年真源)随档:此前只存 displayRunYear 值,还原后一经重算
			// (换字段/改流派触发)行年即被缺省 birth 打回默认。DateTime 不可直接 JSON,降维成串。
			birthSaved: this.state.birth && this.state.birth.date && this.state.birth.date.value && this.state.birth.date.value.format ? {
				date: this.state.birth.date.value.format('YYYY-MM-DD'),
				time: this.state.birth.time && this.state.birth.time.value && this.state.birth.time.value.format ? this.state.birth.time.value.format('HH:mm:ss') : '00:00:00',
				zone: this.state.birth.zone ? this.state.birth.zone.value : undefined,
				gender: this.state.birth.gender ? this.state.birth.gender.value : 1,
			} : null,
		};
		// 🔴 改走共用件 openKentangCaseDrawer:此前这里手写 record,漏了两样东西 ——
		//   ① payload.fieldSnapshot(日界点 after23NewDay / 晚子时 lateZiHourUseNextDay /
		//      卦日界 guaAfter23NewDay / 时间算法 timeAlg);② 顶层 gender。
		// applyCase 载档时正是从这两处回灌口径(user.js pickCaseField),取不到就跳过、
		// 沿用全局当前值 —— 于是存档时若把日界点设成非默认,再载回来日柱/时柱直接算错。
		// 共用件产出的 record 与原手写完全等价(event/caseType/divTime/zone/lat/lon/gps/pos 逐项同),
		// 只是额外补齐上面两样,故此处零行为变更、纯补账。
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: flds,
			module: 'jinkou',
			label: '金口诀',
			payload,
		});
	}

	genWuXingDoms(){
		return LRConst.WuXing.map((item, idx)=>{
			return (
				<Option key={idx} value={item.elem}>{item.elem}·{item.ganzi}</Option>
			);
		});
	}


	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新起课
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		if(typeof window !== 'undefined'){
			// v2.2.1: setTimeout 0 延迟到下一 macrotask,让 dva 的 syncFromGlobal subscription 先把
			// fields.{after23NewDay,lateZiHourUseNextDay}.value 更新到 store + React 把新 props 透给本组件,再 fetch。
			// 否则 this.props.fields 在 listener 同步触发时仍是旧 snapshot,fetch 用的还是旧值,全局开关切了不生效。
			this._dayBoundaryListener = (ev) => {
				if(this._after23BoundaryUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					setTimeout(() => {
						if(this.unmounted) return;
						this.requestGods(this.props.fields, this.props.value);
					}, 0);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(this._lateZiHourUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					setTimeout(() => {
						if(this.unmounted) return;
						this.requestGods(this.props.fields, this.props.value);
					}, 0);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.restoreFromCurrentCase(true)){
			return;
		}
		if(this.props.fields){
			this.requestGods(this.props.fields, this.props.value);
		}
	}

	componentDidUpdate(){
		this.restoreFromCurrentCase();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	renderEmpty(text){
		return (
			<div className="horosa-jinkou-empty">
				<XQIcon name="inbox" />
				<span>{text}</span>
			</div>
		);
	}

	jxTone(jx){
		return jx === 'ji' || jx === 'xiong' ? jx : 'muted';
	}

	renderInfoTable(title, rows){
		const list = rows || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				{list.length ? list.map((row, idx)=>{
					const tone = row.color === 'var(--horosa-jx-ji, #1f8a4c)' ? 'ji' : (row.color === 'var(--horosa-jx-xiong, #c0392b)' ? 'xiong' : null);
					return (
						<div className="horosa-jinkou-info-row" key={`${title}_${idx}`}>
							<span>{row.key}</span>
							<strong className={tone ? `is-${tone}` : undefined}>{fmtValue(row.value)}</strong>
						</div>
					);
				}) : this.renderEmpty('无')}
			</section>
		);
	}

	renderShenshaGrid(title, rows){
		const list = rows || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				{list.length ? (
					<div className="horosa-jinkou-shensha-grid">
						{list.map((row, idx)=>(
							<div className="horosa-jinkou-shensha-cell" key={`${title}_${idx}`}>
								<span className="horosa-jinkou-shensha-cell__name">{row.key}</span>
								<strong className="horosa-jinkou-shensha-cell__val">{fmtValue(row.value)}</strong>
							</div>
						))}
					</div>
				) : this.renderEmpty('无')}
			</section>
		);
	}

	renderInputPanel(wxdoms){
		return (
			<div className="horosa-jinkou-input-stack">
				<div>
					<div className="horosa-side-panel-title">金口诀设置</div>
					<div className="horosa-side-panel-subtitle">起课时间、地分与问测人</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="起课时间与地点" collapsible={false}>
					<div className="horosa-jinkou-input-embed">
						<LiuRengInput
							fields={this.props.fields}
							onFieldsChange={this.onFieldsChange}
							onStepSelect={this.prefetchStepSelect}
							hideExtras
						/>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="流派 / 盘法" storageKey="jinkou.s1" className="horosa-jinkou-input-section">
					{/* 流派四维：一行两个的下拉单选（窄栏省高度；选项短、无需滑块占位）。 */}
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>月将换将</span>
							<Select value={this.state.schoolYueJiang} onChange={(v)=>this.onSchoolChange('schoolYueJiang', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="zhongqi">中气换将</Option>
								<Option value="jiaojie">交节即换</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>贵人昼夜表</span>
							<Select value={this.state.schoolGuiTable} onChange={(v)=>this.onSchoolChange('schoolGuiTable', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="shiwu">实务派</Option>
								<Option value="liuren">六壬古法</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>起贵神盘</span>
							<Select value={this.state.schoolGuiPan} onChange={(v)=>this.onSchoolChange('schoolGuiPan', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="di">地盘法</Option>
								<Option value="tian">天盘法</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>盘式</span>
							<Select value={this.state.panShi} onChange={(v)=>this.onSchoolChange('panShi', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="yang">传统阳盘</Option>
								<Option value="yin">阴盘·旺衰</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>土长生</span>
							<Select value={this.state.soilChangSheng} onChange={(v)=>this.onSchoolChange('soilChangSheng', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="shen">水土同宫·申</Option>
								<Option value="yin">火土同宫·寅</Option>
							</Select>
						</label>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="地分与课式" storageKey="jinkou.s2" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>地分</span>
							<Select value={this.state.diFen} onChange={this.onDiFenChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								{LRConst.ZiList.map((zi)=>(<Option key={`difen_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>月将</span>
							<Select value={this.state.yueJiang} onChange={this.onYueJiangChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="auto">自动</Option>
								{LRConst.ZiList.map((zi)=>(<Option key={`yuejiang_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>占时</span>
							<Select value={this.state.zhanShi} onChange={this.onZhanShiChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="auto">自动</Option>
								{LRConst.ZiList.map((zi)=>(<Option key={`zhanshi_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>时间基准</span>
							<Select value={this.state.timeBasis} onChange={this.onTimeBasisChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="direct">直接时间</Option>
								<Option value="trueSolar">真太阳时</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>十二长生五行</span>
							<Select value={this.state.wuxing} onChange={this.onWuXingChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								{wxdoms}
							</Select>
						</label>
						{/* 定地分辅助取法：按数/笔画/颜色/属相/翻书求支，算出即回填地分（不改下游算法）。 */}
						<label className="horosa-jinkou-select-field">
							<span>地分取法</span>
							<Select value={this.state.diFenSource} onChange={(v)=>this.setState({ diFenSource: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="zhi">直接选支</Option>
								<Option value="number">报数</Option>
								<Option value="stroke">笔画</Option>
								<Option value="color">颜色</Option>
								<Option value="shengxiao">属相</Option>
								<Option value="book">翻书页数</Option>
							</Select>
						</label>
						{this.state.diFenSource !== 'zhi' ? (
							<label className="horosa-jinkou-select-field">
								<span>取法输入</span>
								<XQInput
									size="small"
									value={this.state.diFenSourceInput}
									placeholder={this.state.diFenSource === 'color' ? '如 青/红/白' : (this.state.diFenSource === 'shengxiao' ? '如 兔' : '如 27')}
									onChange={(e)=>{
										const val = e.target.value;
										const zi = resolveDiFenBySource(this.state.diFenSource, val);
										this.setState({ diFenSourceInput: val });
										if(zi){ this.onDiFenChange(zi); }
									}}
								/>
							</label>
						) : null}
					</div>
				</XQSideSection>

				{/* 专题起式（定局法）：选定专题即在右栏「专题」页产出派生课与断诀，主课不受影响。 */}
				<XQSideSection iconName={sideSectionIcon('switches')} title="专题起式" storageKey="jinkou.s4" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>专题</span>
							<Select value={this.state.topicKey} onChange={(v)=>this.setState({ topicKey: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">不用</Option>
								<Option value="yunyu">测孕育</Option>
								<Option value="xuntiangang">寻天罡·失物</Option>
								<Option value="jiazhai">测家宅</Option>
								<Option value="guijian">测贵贱</Option>
								<Option value="banzhi">测瘢痣</Option>
								<Option value="dajing">测打井</Option>
								<Option value="fujiashi">复加时·十二方位</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>所问类别</span>
							<Select value={this.state.askKey} onChange={(v)=>this.setState({ askKey: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">未限定</Option>
								{Object.keys(JINKOU_HEZHAN_FOCUS).map((k)=>(
									<Option key={`ask_${k}`} value={k}>{JINKOU_HEZHAN_FOCUS[k].label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>问事时段</span>
							<Select value={this.state.timeScope} onChange={(v)=>this.setState({ timeScope: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								{Object.keys(JINKOU_HEZHAN_TIME).map((k)=>(
									<Option key={`ts_${k}`} value={k}>{JINKOU_HEZHAN_TIME[k].label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>测年月日</span>
							<Select value={this.state.shiJianKind} onChange={(v)=>this.setState({ shiJianKind: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">不用</Option>
								<Option value="year">测一年</Option>
								<Option value="month">测一月</Option>
								<Option value="day">测一日</Option>
							</Select>
						</label>
					</div>
					{/* 属相与虚岁不再手填：由下方「问测人出生时间」自动派生(属相=生年支、虚岁=卜卦年−生年+1)，
					    免去同一事实两处输入互相打架。派生值在右栏「专题」页与概览回显，可核对。 */}
					<div className="horosa-jinkou-topic-note">{this.renderBenMingHint()}</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="问测人出生时间" storageKey="jinkou.s3" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-input-embed">
						<LiuRengBirthInput
							fields={this.state.birth}
							onFieldsChange={this.onBirthChange}
							requireConfirm={true}
						/>
					</div>
				</XQSideSection>

				<div className="horosa-jinkou-action-row">
					<Button type="primary" onClick={()=>this.requestGods(this.props.fields, this.props.value)}>起课</Button>
					<Button onClick={this.clickSaveCase}>保存</Button>
				</div>
			</div>
		);
	}

	// 课情：合并起课全部信息(原「概览」顶卡与「课情」重复 → 并为一张;四位已在中间盘，不重复)。
	renderStartRows(jinkouData, chartFields, displayRunYear, appliedBirth){
		if(!jinkouData || !jinkouData.ready){
			return this.renderEmpty('暂无起课数据');
		}
		const params = chartFields ? this.genGodsParams(chartFields) : null;
		const backend = jinkouData.backend || {};
		// jinkouError 此前只写不读：后端排盘服务挂了就静默退回本地引擎，用户看不出盘换了源。
		// 这里如实说明——本地引擎算得出四位，但三盘环等后端专有面会缺，不该让人蒙在鼓里。
		const top = jinkouData.topInfo || {};
		// [BUG-2] 四柱/月将/占时此前只认后端 pan 的字段；流派偏离默认时走本地引擎、没有 backend，
		// 概览就整排显示「无 无 无 无」。本地路径回落 liureng 四柱与引擎自算的月将/占时（同源自洽）。
		const lrCols = this.state.liureng && this.state.liureng.fourColumns ? this.state.liureng.fourColumns : {};
		const colGz = (c)=>(c && c.ganzi ? c.ganzi : '');
		const ganzhi = (backend.ganzhi && backend.ganzhi.day) ? backend.ganzhi : {
			year: colGz(lrCols.year), month: colGz(lrCols.month), day: colGz(lrCols.day), time: colGz(lrCols.time),
		};
		const gender = appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1;
		const rows = [
			['日期', backend.dateStr || (params ? params.date : '')],
			['时间', backend.timeStr || (params ? params.time : '')],
			['真太阳时', backend.realSunTime || (this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli.birth : '')],
			['时间基准', this.state.timeBasis === 'trueSolar' ? '真太阳时' : '直接时间'],
			['节气', backend.jiedelta || (this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli.jiedelta : '')],
			['四柱', `${fmtValue(ganzhi.year)} ${fmtValue(ganzhi.month)} ${fmtValue(ganzhi.day)} ${fmtValue(ganzhi.time)}`],
			['地分/月将/占时', `${fmtValue(backend.difen || top.diFen)} / ${fmtValue(backend.yuejiang || jinkouData.yuejiang)} / ${fmtValue(backend.zhanshi || jinkouData.timeZi)}`],
			['空亡/四大空亡', `${fmtValue(top.xunKong)} / ${fmtValue(backend.siDaKong || top.siDaKong)}`],
			['用爻', jinkouData.yongYao ? `${jinkouData.yongYao.label || '—'}${jinkouData.yongYao.sign ? `(${jinkouData.yongYao.sign})` : ''}` : '—'],
			// 跨日界两源不齐时明示所取日柱（否则用户看四柱是一天、看断法是另一天，无从察觉）。
			...(jinkouData.daySourceNote ? [['日柱口径', jinkouData.daySourceNote]] : []),
			...(this.state.jinkouError ? [['排盘来源', `后端排盘未就绪（${this.state.jinkouError}），已用本地引擎起课；四位与断法照常，三盘环等后端专有内容可能缺失。`]] : []),
			// 昼夜是贵神起例的分水岭,而两法(真实地平/时支粗判)在日出日落前后常打架 → 明写所依口径。
			['昼夜', `${jinkouData.isDay ? '昼占' : '夜占'}（${fmtValue(jinkouData.dayBasisText)}）`],
			['十二长生', `${this.state.wuxing}${this.state.wuxing === '土' ? `（${this.state.soilChangSheng === 'yin' ? '火土同宫·寅' : '水土同宫·申'}）` : ''}`],
			// 专题起式所用的属相/虚岁是派生值,写在此处便于核对(错了就是出生档填错)
			['本命属相/虚岁', `${deriveBenMingFromRunYear(this.state.runyear) || '—'} / ${deriveXuSuiFromRunYear(this.state.runyear) === '' ? '—' : `${deriveXuSuiFromRunYear(this.state.runyear)}岁`}`],
			// age 为 0（出生当年起课）是合法值,不能用 || 兜底——否则真 0 岁被显示成「—岁」。
			['行年', displayRunYear
				? `${displayRunYear.year || '—'} / ${Number.isFinite(Number(displayRunYear.age)) ? `${Number(displayRunYear.age)}岁` : '—'}`
				: '—'],
			['性别', `${gender}` === '0' ? '女' : (`${gender}` === '1' ? '男' : '未知')],
		];
		return rows.map(([label, value])=>(
			<div className="horosa-jinkou-info-row" key={`start_${label}`}>
				<span>{label}</span>
				<strong>{fmtValue(value || '—')}</strong>
			</div>
		));
	}

	renderXiangyi(jinkouData){
		const xy = jinkouData && jinkouData.xiangyi ? jinkouData.xiangyi : null;
		const gs = xy && xy.guishen ? xy.guishen : null;
		const yj = xy && xy.yuejiang ? xy.yuejiang : null;
		if(!gs && !yj){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">贵神 · 月将象意</div>
				{gs ? (
					<div className={`horosa-jinkou-note-row is-${this.jxTone(gs.jx)}`}>
						<span className="horosa-jinkou-note-head">
							<strong>贵神 · {gs.name}</strong>
							{gs.shiti ? <em className="horosa-jinkou-note-tag">{gs.shiti}</em> : null}
						</span>
						<span className="horosa-jinkou-note-desc">{gs.renwu ? `人物：${gs.renwu}。` : ''}{gs.desc}</span>
					</div>
				) : null}
				{yj ? (
					<div className="horosa-jinkou-note-row is-muted">
						<span className="horosa-jinkou-note-head"><strong>将神 · {yj.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{yj.desc}</span>
					</div>
				) : null}
			</section>
		);
	}

	// 断课忌时：作「概览」页首独立卡片（不再通栏占位，避免挤压右栏全部页签）。
	renderJishi(jinkouData){
		const js = jinkouData && jinkouData.jishi ? jinkouData.jishi : null;
		if(!js || !js.hit){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-jishi-card">
				<div className="horosa-jinkou-section-card__title">断课忌时</div>
				<div className="horosa-jinkou-warn-banner">
					<strong>忌时</strong>
					<span>{js.text}</span>
				</div>
			</section>
		);
	}

	renderNianYueRi(jinkouData){
		const items = jinkouData && jinkouData.nianYueRi ? jinkouData.nianYueRi : [];
		if(!items.length){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">年月日入课 · 太岁月建</div>
				{items.map((it, idx)=>(
					<div className={`horosa-jinkou-note-row ${it.hit ? 'is-xiong' : 'is-muted'}`} key={`nyr_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<strong>{it.name}</strong>
							<em className="horosa-jinkou-note-tag">{it.zhi}{it.hit ? ' · 入课' : ''}</em>
						</span>
						<span className="horosa-jinkou-note-desc">{it.text}</span>
					</div>
				))}
			</section>
		);
	}

	renderBaShe(){
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">绿色解断 · 标准八步</div>
				{JINKOU_BASHE_DOC.map((s)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`bashe_${s.step}`}>
						<span className="horosa-jinkou-note-head"><strong>{s.step}. {s.title}</strong></span>
						<span className="horosa-jinkou-note-desc">{s.detail}</span>
					</div>
				))}
			</section>
		);
	}

	// 经典赋文：古籍原文转录，长文按篇折叠（默认全收，避免一进「参考」页就是数千字）。
	toggleFuwen(key){
		const open = { ...(this.state.fuwenOpen || {}) };
		open[key] = !open[key];
		this.setState({ fuwenOpen: open });
	}

	renderFuwen(){
		const open = this.state.fuwenOpen || {};
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">经典赋文 · 古籍原文</div>
				<div className="horosa-jinkou-topic-note">{JINKOU_FUWEN_NOTE}</div>
				<div className="horosa-jinkou-fuwen-list">
					{JINKOU_FUWEN.map((p)=>(
						<div className={`horosa-jinkou-fuwen-item${open[p.key] ? ' is-open' : ''}`} key={`fw_${p.key}`}>
							<button type="button" className="horosa-jinkou-fuwen-head" onClick={()=>this.toggleFuwen(p.key)}>
								<span className="horosa-jinkou-fuwen-caret">{open[p.key] ? '▾' : '▸'}</span>
								<strong className="horosa-jinkou-fuwen-title">{p.title}</strong>
								<em className="horosa-jinkou-fuwen-vol">{p.volume}</em>
							</button>
							<div className="horosa-jinkou-fuwen-use">{p.use}</div>
							{open[p.key] ? (
								<div className="horosa-jinkou-fuwen-body">
									{p.lines.map((ln, i)=>(<p key={`fw_${p.key}_${i}`}>{ln}</p>))}
								</div>
							) : null}
						</div>
					))}
				</div>
			</section>
		);
	}

	renderShenshaRows(jinkouData){
		const docRows = jinkouData && jinkouData.shenshaDocRows ? jinkouData.shenshaDocRows : [];
		if(!docRows.length){
			return this.renderEmpty('暂无四位神煞');
		}
		return docRows.map((row)=>(
			<div key={row.label} className="horosa-jinkou-shensha-group">
				<div className="horosa-jinkou-subhead">{row.position}</div>
				{row.items && row.items.length ? row.items.map((it, idx)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(it.jx)}`} key={`${row.label}_${idx}`}>
						<span className="horosa-jinkou-note-head"><strong>{it.name}</strong></span>
						{it.desc ? <span className="horosa-jinkou-note-desc">{it.desc}</span> : null}
					</div>
				)) : <span className="horosa-jinkou-note-desc">无</span>}
			</div>
		));
	}

	renderTextBlock(title, text){
		if(!text){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				<p className="horosa-jinkou-prose">{text}</p>
			</section>
		);
	}

	renderAnalysisBasic(jinkouData){
		if(!jinkouData || !jinkouData.ready){
			return this.renderEmpty('暂无分析');
		}
		return (
			<div className="horosa-jinkou-overview-stack">
				{this.renderDong(jinkouData)}
				{this.renderGeju(jinkouData)}
				{this.renderTextBlock('用神强弱', jinkouData.yongStrength ? jinkouData.yongStrength.text : '')}
				{this.renderYingQi(jinkouData)}
			</div>
		);
	}

	renderYingQi(jinkouData){
		const yq = jinkouData && jinkouData.yingQi ? jinkouData.yingQi : null;
		if(!yq || !yq.text){ return null; }
		const methods = yq.methods || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">应期 · 合德六法</div>
				<p className="horosa-jinkou-prose">{yq.text}</p>
				{methods.map((m, idx)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`yq_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<strong>{m.fa}</strong>
							{m.when ? <em className="horosa-jinkou-note-tag">{m.when}</em> : null}
						</span>
						<span className="horosa-jinkou-note-desc">{m.text}</span>
					</div>
				))}
			</section>
		);
	}

	renderDong(jinkouData){
		const dong = jinkouData && jinkouData.dong ? jinkouData.dong : { wu: [], san: [] };
		const all = [].concat(
			(dong.wu || []).map((d)=>({ ...d, group: '五动' })),
			(dong.san || []).map((d)=>({ ...d, group: '三动' }))
		);
		if(!all.length){
			return (
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
					<div className="horosa-jinkou-section-card__title">发用 · 五动三动</div>
					{this.renderEmpty('四位无显著动象（无克无生同气）')}
				</section>
			);
		}
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
				<div className="horosa-jinkou-section-card__title">发用 · 五动三动</div>
				{all.map((d, i)=>(
					<div className={`horosa-jinkou-dong-row ${d.yong ? 'is-yong' : ''}`} key={`dong_${i}`}>
						<div className="horosa-jinkou-dong-head">
							<span className="horosa-jinkou-dong-name">{d.type}动{d.kong ? ' · 逢空' : ''}</span>
							<em className="horosa-jinkou-dong-path">{d.group}　{d.from}→{d.to}</em>
						</div>
						<div className="horosa-jinkou-dong-text">{d.text}{d.kong ? '（逢空则力减、应迟或事不成）' : ''}</div>
					</div>
				))}
			</section>
		);
	}

	renderGeju(jinkouData){
		const geju = jinkouData && jinkouData.geju ? jinkouData.geju : [];
		if(!geju.length){
			return null;
		}
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
				<div className="horosa-jinkou-section-card__title">格局</div>
				{geju.map((g, i)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(g.jx)}`} key={`geju_${i}`}>
						<span className="horosa-jinkou-note-head"><strong>{g.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{g.text}</span>
					</div>
				))}
			</section>
		);
	}

	renderRelations(jinkouData){
		const rels = jinkouData && jinkouData.relations ? jinkouData.relations : [];
		const bihe = jinkouData && jinkouData.bihe ? jinkouData.bihe : [];
		if(!rels.length && !bihe.length){
			return this.renderEmpty('四位无显著生克');
		}
		const relTone = (rel)=>(rel === '生' || rel === '被生' ? 'sheng' : (rel === '克' || rel === '被克' ? 'ke' : (rel === '合' ? 'he' : 'muted')));
		return (
			<div>
				{rels.map((r, idx)=>(
					<div className={`horosa-jinkou-note-row is-${relTone(r.rel)}`} key={`rel_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<em className="horosa-jinkou-note-tag">{r.from}{r.rel}{r.to}</em>
						</span>
						{r.text ? <span className="horosa-jinkou-note-desc">{r.text}</span> : null}
					</div>
				))}
				{bihe.map((b, idx)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`bihe_${idx}`}>
						<span className="horosa-jinkou-note-head"><strong>{b.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{b.text}</span>
					</div>
				))}
			</div>
		);
	}

	renderCategory(jinkouData){
		const cats = jinkouData && jinkouData.categoryRules ? jinkouData.categoryRules : [];
		const ready = cats.filter((c)=>c.texts && c.texts.length);
		if(!ready.length){
			return this.renderEmpty('分类用神细则完善中');
		}
		return (
			<div className="horosa-jinkou-overview-stack">
				{ready.map((c)=>(
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card" key={c.key}>
						<div className="horosa-jinkou-section-card__title">
							{c.name}
							{c.yongHint ? <em className="horosa-jinkou-card-hint">用神：{c.yongHint}</em> : null}
						</div>
						{c.texts.map((t, idx)=>(
							<div className="horosa-jinkou-note-row is-muted" key={`cat_${idx}`}>
								<span className="horosa-jinkou-note-desc">{t}</span>
							</div>
						))}
					</section>
				))}
			</div>
		);
	}

	renderBranchRelation(jinkouData){
		const brs = jinkouData && jinkouData.branchRelations ? jinkouData.branchRelations : [];
		const typeTone = (t)=>(t === '合' || t === '三合' ? 'he' : (t === '冲' ? 'chong' : 'xing'));
		return (
			<div>
				<JinKouRelationMini relations={brs} rows={jinkouData ? jinkouData.rows : []} />
				{brs.length ? (
					<div style={{ marginTop: 8 }}>
						{brs.map((b, idx)=>(
							<div className={`horosa-jinkou-note-row is-${typeTone(b.type)}`} key={`br_${idx}`}>
								<span className="horosa-jinkou-note-head"><strong>{b.aLabel}{b.a} {b.type} {b.bLabel}{b.b}</strong></span>
								{b.desc ? <span className="horosa-jinkou-note-desc">{b.desc}</span> : null}
							</div>
						))}
					</div>
				) : this.renderEmpty('四位与日辰无刑冲合害破')}
			</div>
		);
	}

	renderTaixuan(jinkouData){
		const tx = jinkouData && jinkouData.taixuan ? jinkouData.taixuan : [];
		if(!tx.length){
			return this.renderEmpty('暂无数理');
		}
		const rows = tx.map((t)=>({ key: t.label, value: `${t.tokens || '—'}　太玄数 ${t.num}` }));
		return this.renderInfoTable('数理 · 太玄数', rows);
	}

	renderPlateRows(jinkouData){
		if(!jinkouData || !jinkouData.plates || !jinkouData.plates.length){
			return this.renderEmpty((jinkouData && jinkouData.platesNote) || '暂无三盘数据');
		}
		return jinkouData.plates.map((row)=>(
			<div className="horosa-jinkou-info-row" key={`plate_${row.index || row.di}`}>
					<span>{row.di}</span>
				<strong>{`天${fmtValue(row.tian)} · 将${fmtValue(row.jiang)} · 神${fmtValue(row.shen)} · 贵${fmtValue(row.gui)}`}</strong>
			</div>
		));
	}

	// 左栏「专题起式」段脚注：把自动派生的属相/虚岁写出来，用户一眼能核对派生对不对；
	// 出生档未填时明说「先填出生时间」，而不是让专题页干瞪眼说「需填属相」。
	renderBenMingHint(){
		const benMing = deriveBenMingFromRunYear(this.state.runyear);
		const xuSui = deriveXuSuiFromRunYear(this.state.runyear);
		if(!benMing && xuSui === ''){
			return '本命属相与行年虚岁自「问测人出生时间」自动取；尚未取到生年干支，请先在下方填写出生时间并确认。';
		}
		const gz = this.state.runyear && this.state.runyear.birthGanZi ? this.state.runyear.birthGanZi : '';
		return `本命属相 ${benMing || '—'}${gz ? `（生年 ${gz}）` : ''}、行年虚岁 ${xuSui === '' ? '—' : `${xuSui}`}`;
	}

	// 专题起式页：专题派生课 + 专题断诀 + 测年月日三式 + 二遁人元 + 次客/移星换将 + 行年旬法。
	renderTopicPanel(jinkouData){
		if(!jinkouData){ return this.renderEmpty('暂无课式'); }
		const topic = jinkouData.topic;
		const jue = jinkouData.topicJue;
		const shiJian = jinkouData.shiJian;
		const erDun = jinkouData.erDun;
		const cike = jinkouData.cike || [];
		const yiXing = jinkouData.yiXing;
		const xn = jinkouData.xingNian;
		return (
			<div className="horosa-jinkou-overview-stack">
				{!topic && !shiJian && !xn ? (
					<div className="horosa-jinkou-warn-banner is-hint">
						<strong>未选专题</strong>
						<span>在左栏「专题起式」选定专题、测年月日或填行年虚岁，此处即出派生课与断诀；下方二遁与次客法恒随主课产出。</span>
					</div>
				) : null}
				{topic ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{`专题起式 · ${topic.title}`}</div>
						<div className="horosa-jinkou-topic-note">{topic.note}</div>
						{topic.ready === false ? (
							<div className="horosa-jinkou-warn-banner"><strong>待补</strong><span>{topic.needText}</span></div>
						) : (
							<div className="horosa-jinkou-topic-result">
								{topic.result ? <p>{topic.result}</p> : null}
								{topic.rows ? (
									<div className="horosa-jinkou-sixiang-table is-cols3">
										<div className="horosa-jinkou-sixiang-row is-head"><span>方位</span><span>将神</span><span>将名</span><span>将干</span></div>
										{topic.rows.map((r)=>(
											<div className="horosa-jinkou-sixiang-row" key={`tp_${r.fang}`}>
												<span className="horosa-jinkou-sixiang-pos">{r.fang}</span>
												<span>{fmtValue(r.jiangZi)}</span>
												<span>{fmtValue(r.jiangName)}</span>
												<span>{fmtValue(r.gan)}</span>
											</div>
										))}
									</div>
								) : null}
							</div>
						)}
					</section>
				) : null}
				{jue && jue.items && jue.items.length ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{`专题断诀 · ${jue.kind}`}</div>
						{jue.items.map((it, i)=>(
							<div className="horosa-jinkou-info-row" key={`jue_${i}`}>
								<span>{`${it.wei}${it.zhi ? `·${it.zhi}` : ''}`}</span>
								<strong>{fmtValue(it.xiang)}</strong>
							</div>
						))}
						<ul className="horosa-jinkou-sixiang-notes">
							{(jue.notes || []).map((n, i)=>(<li key={`juen_${i}`}>{n}</li>))}
						</ul>
					</section>
				) : null}
				{shiJian ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{shiJian.title}</div>
						<div className="horosa-jinkou-info-row"><span>月将加于</span><strong>{fmtValue(shiJian.addAt)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>数至（地分）</span><strong>{fmtValue(shiJian.diFen)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>得将神</span><strong>{`${fmtValue(shiJian.jiangZi)}（${fmtValue(shiJian.jiangName)}）`}</strong></div>
						<div className="horosa-jinkou-topic-note">{shiJian.note}</div>
					</section>
				) : null}
				{erDun ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">二遁人元</div>
						<div className="horosa-jinkou-info-row"><span>{`原人元 ${fmtValue(erDun.yuan)}`}</span><strong>{`二遁＝${fmtValue(erDun.gan)}　三遁＝${fmtValue(erDun.thirdGan)}`}</strong></div>
						<div className="horosa-jinkou-info-row"><span>衣物之色</span><strong>{fmtValue(erDun.se)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>住宅物象</span><strong>{fmtValue(erDun.xiang)}</strong></div>
						<div className="horosa-jinkou-topic-note">{erDun.note}</div>
					</section>
				) : null}
				{cike.length ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">次客法 · 参考式</div>
						{cike.map((c, i)=>(
							<div className="horosa-jinkou-note-row is-muted" key={`ck_${i}`}>
								<span className="horosa-jinkou-note-name">{c.method}</span>
								<span className="horosa-jinkou-note-desc">
									{c.note}
									{c.guiName ? `　→ 次课贵神＝${c.guiName}` : ''}
									{c.altTimeZi ? `　→ 代时之支＝${c.altTimeZi.filter(Boolean).join('、')}` : ''}
									{c.altDayGan ? `　→ 换日干＝${c.altDayGan.filter(Boolean).join('、')}` : ''}
									{c.altDiFen ? `　→ 新地分＝${c.altDiFen}` : ''}
									{c.jiangZi ? `　→ 将神＝${c.jiangZi}` : ''}
								</span>
							</div>
						))}
						{yiXing ? (
							<div className="horosa-jinkou-note-row is-muted">
								<span className="horosa-jinkou-note-name">移星换将</span>
								<span className="horosa-jinkou-note-desc">{`${yiXing.note}　→ 前日干 ${yiXing.prevDayGan}、后日干 ${yiXing.nextDayGan}`}</span>
							</div>
						) : null}
					</section>
				) : null}
				{xn ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">金口诀行年 · 旬法</div>
						<div className="horosa-jinkou-info-row"><span>{`${xn.gender}·${xn.age}岁`}</span><strong>{`行年 ${xn.ganZhi}（${xn.zhi}）`}</strong></div>
						<div className="horosa-jinkou-info-row"><span>{`生年 ${xn.birthGanZi}·${xn.xunHead}旬`}</span><strong>{`一岁起 ${xn.startGanZi}`}</strong></div>
						{xn.ge ? <div className="horosa-jinkou-note-row is-muted"><span className="horosa-jinkou-note-name">灾福歌</span><span className="horosa-jinkou-note-desc">{xn.ge}</span></div> : null}
						<div className="horosa-jinkou-topic-note">{xn.note}</div>
					</section>
				) : null}
			</div>
		);
	}

	// 阴盘（旺衰派）三层：六亲 / 六神 / 旺衰分。仅盘式=阴盘时产出，故此处 null 即整组不渲染。
	renderYinPan(jinkouData){
		const yp = jinkouData && jinkouData.yinPan;
		if(!yp || !yp.wangScore || !yp.wangScore.length){ return null; }
		const qinBy = {};
		(yp.liuqin || []).forEach((it)=>{ qinBy[it.wei] = it; });
		const shenBy = {};
		(yp.liushen || []).forEach((it)=>{ shenBy[it.wei] = it; });
		const maxAbs = Math.max(1, ...yp.wangScore.map((s)=>Math.abs(s.score)));
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">阴盘 · 六亲 / 六神 / 旺衰分</div>
				<div className="horosa-jinkou-yinpan-head">
					<span className="horosa-jinkou-hezhan-tag is-use">{`以日干 ${fmtValue(yp.self)}（${fmtValue(yp.selfElem)}）为我`}</span>
					<span className="horosa-jinkou-hezhan-tag">公共框架 · 自定分值</span>
				</div>
				<div className="horosa-jinkou-yinpan-table">
					<div className="horosa-jinkou-yinpan-row is-head">
						<span>位</span><span>六亲</span><span>六神</span><span>旺衰</span><span>分值</span>
					</div>
					{yp.wangScore.map((s)=>{
						const qin = qinBy[s.wei] || {};
						const shen = shenBy[s.wei] || {};
						const pct = Math.round((Math.abs(s.score) / maxAbs) * 100);
						return (
							<div className="horosa-jinkou-yinpan-row" key={`yp_${s.wei}`} title={s.detail.join('　')}>
								<span className="horosa-jinkou-yinpan-pos">{s.wei}<em>{s.elem}</em></span>
								<span title={qin.zhu || ''}>{qin.qin || '—'}</span>
								<span title={shen.desc || ''}>{shen.name || '—'}</span>
								<span className={`horosa-jinkou-yinpan-level is-${s.score >= 2 ? 'strong' : (s.score <= -2 ? 'weak' : 'mid')}`}>{s.level}</span>
								<span className="horosa-jinkou-yinpan-score">
									<em>{s.score > 0 ? `+${s.score}` : s.score}</em>
									<i className={s.score >= 0 ? 'is-plus' : 'is-minus'} style={{ width: `${pct}%` }} />
								</span>
							</div>
						);
					})}
				</div>
				<div className="horosa-jinkou-yinpan-note">{yp.scoreNote}</div>
			</section>
		);
	}

	// 合占·扣题直断：所问事项 → 取用位 → 时段 → 动象/神煞 → 结论链；末附课分内外小图。
	renderHezhan(jinkouData){
		const hz = jinkouData && jinkouData.hezhan;
		if(!hz || !hz.chain || !hz.chain.length){ return null; }
		const nw = jinkouData.neiwai;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">合占 · 扣题直断</div>
				<div className="horosa-jinkou-hezhan-head">
					<span className="horosa-jinkou-hezhan-tag">{hz.askLabel ? `所问：${hz.askLabel}` : '所问：未限定'}</span>
					<span className="horosa-jinkou-hezhan-tag is-use">{`取用：${fmtValue(hz.usePosition)}`}</span>
					<span className="horosa-jinkou-hezhan-tag">{`时段：${fmtValue(hz.timeLabel)}`}</span>
				</div>
				<ol className="horosa-jinkou-hezhan-chain">
					{hz.chain.map((line, i)=>(<li key={`hz_${i}`}>{line}</li>))}
				</ol>
				{nw && nw.rows && nw.rows.length ? (
					<div className="horosa-jinkou-neiwai">
						<div className="horosa-jinkou-neiwai-title">课分内外</div>
						<div className="horosa-jinkou-neiwai-cols">
							{nw.rows.map((r)=>(
								<div key={`nw_${r.label}`} className={`horosa-jinkou-neiwai-item is-${r.side === '内' ? 'inner' : 'outer'} ${r.yong ? 'is-yong' : ''}`}>
									<span className="horosa-jinkou-neiwai-side">{r.side}</span>
									<span className="horosa-jinkou-neiwai-label">{r.label}</span>
									<span className="horosa-jinkou-neiwai-val">{fmtValue(r.content)}</span>
								</div>
							))}
						</div>
					</div>
				) : null}
			</section>
		);
	}

	// 四象所属图：四位 × 亲属/君臣主客/天地/官禄财/内外/身体，与当前四位干支并排。
	renderSixiangShu(jinkouData){
		const rows = jinkouData && jinkouData.sixiangShu;
		if(!rows || !rows.length){ return null; }
		const cols = JINKOU_SIXIANG_SHU_COLS;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">四象所属 · 定位取用</div>
				<div className="horosa-jinkou-sixiang-table">
					<div className="horosa-jinkou-sixiang-row is-head">
						<span>位</span>
						{cols.map((c)=>(<span key={`sxh_${c.key}`}>{c.label}</span>))}
					</div>
					{rows.map((r)=>(
						<div className="horosa-jinkou-sixiang-row" key={`sx_${r.label}`}>
							<span className="horosa-jinkou-sixiang-pos">
								{r.label}
								{r.ganzhi ? <em>{r.ganzhi}</em> : null}
							</span>
							{cols.map((c)=>(<span key={`sx_${r.label}_${c.key}`}>{r[c.key]}</span>))}
						</div>
					))}
				</div>
				<ul className="horosa-jinkou-sixiang-notes">
					{JINKOU_SIXIANG_SHU_NOTES.map((n, i)=>(<li key={`sxn_${i}`}>{n}</li>))}
				</ul>
			</section>
		);
	}

	// 四象五行取象：四位五行各主天时/地理/人事/病源，并标出课中旺之五行为主象。
	renderSixiangWuxing(jinkouData){
		const sw = jinkouData && jinkouData.sixiangWuxing;
		if(!sw || !sw.rows || !sw.rows.length){ return null; }
		const cols = JINKOU_SIXIANG_WUXING_COLS;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">四象五行 · 取象</div>
				{sw.mainElem ? (
					<div className="horosa-jinkou-wuxiang-main">
						<span className="horosa-jinkou-hezhan-tag is-use">{`主象：${sw.mainElem}`}</span>
						{sw.tianqiText ? <span className="horosa-jinkou-wuxiang-text">{sw.tianqiText}</span> : null}
					</div>
				) : null}
				<div className="horosa-jinkou-sixiang-table is-cols4">
					<div className="horosa-jinkou-sixiang-row is-head">
						<span>位·五行</span>
						{cols.map((c)=>(<span key={`swh_${c.key}`}>{c.label}</span>))}
					</div>
					{sw.rows.map((r)=>(
						<div className={`horosa-jinkou-sixiang-row ${r.elem === sw.mainElem ? 'is-main' : ''}`} key={`sw_${r.label}`}>
							<span className="horosa-jinkou-sixiang-pos">
								{r.label}
								<em>{r.elem || '—'}{r.kong ? '·空' : ''}</em>
							</span>
							{cols.map((c)=>(<span key={`sw_${r.label}_${c.key}`}>{r[c.key]}</span>))}
						</div>
					))}
				</div>
				<ul className="horosa-jinkou-sixiang-notes">
					{JINKOU_SIXIANG_WUXING_NOTES.map((n, i)=>(<li key={`swn_${i}`}>{n}</li>))}
				</ul>
			</section>
		);
	}

	// 方位神煞（飞天五鬼 / 喜神）：按日干取八卦之位，出行趋避用；不入四位行故单列。
	renderFangWei(jinkouData){
		const list = jinkouData && jinkouData.fangWeiShensha;
		if(!list || !list.length){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">方位神煞</div>
				{list.map((it)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(it.jx)}`} key={`fw_${it.name}`}>
						<span className="horosa-jinkou-note-name">{`${it.name} · ${it.gua}（${it.fang}）`}</span>
						<span className="horosa-jinkou-note-desc">{it.text}</span>
					</div>
				))}
			</section>
		);
	}

	renderOverviewAll(jinkouData, displayRunYear, appliedBirth, chartFields){
		return (
			<div className="horosa-jinkou-overview-stack">
				{this.renderJishi(jinkouData)}
				{/* 阴盘模式断法重心前移：六亲/六神/旺衰分置于课情之上；阳盘恒不渲染。 */}
				{this.renderYinPan(jinkouData)}
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
					<div className="horosa-jinkou-section-card__title">课情</div>
					{this.renderStartRows(jinkouData, chartFields, displayRunYear, appliedBirth)}
				</section>
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
					<div className="horosa-jinkou-section-card__title">三盘 · 天将</div>
					{this.renderPlateRows(jinkouData)}
				</section>
				{this.renderXiangyi(jinkouData)}
			</div>
		);
	}

	renderRightPanel(jinkouData, displayRunYear, appliedBirth, chartFields, godsZiRows, godsYearRows, zsRows, roleRefRows){
		const validPanelTabs = ['overview', 'gods', 'analysis', 'aux', 'topic', 'ref'];
		const activeKey = validPanelTabs.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<div className="horosa-jinkou-rightpanel-wrap">
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-jinkou-tabs">
				{/* horosa_freeze_subtabs_v1:右栏 5 面板 keep-alive,原先每次父重渲都把
				    概览/神煞/分析/用神/参考 全跑一遍。函数式:非激活不求值、不 reconcile;
				    切回拿本轮最新 children 立刻渲一帧(不卸载、不重取、不闪烁)。 */}
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{()=>(
						this.renderOverviewAll(jinkouData, displayRunYear, appliedBirth, chartFields)
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞" key="gods">
					<FreezeSubTab active={activeKey === 'gods'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位神煞</div>
							{this.renderShenshaRows(jinkouData)}
						</section>
						{this.renderShenshaGrid('支煞', godsZiRows)}
						{this.renderShenshaGrid('年煞', godsYearRows)}
						{this.renderFangWei(jinkouData)}
						{this.renderShenshaGrid(`${this.state.wuxing}十二长生`, zsRows)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="分析" key="analysis">
					<FreezeSubTab active={activeKey === 'analysis'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位关系图</div>
							{this.renderBranchRelation(jinkouData)}
						</section>
						{this.renderAnalysisBasic(jinkouData)}
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位生克</div>
							{this.renderRelations(jinkouData)}
						</section>
						{this.renderNianYueRi(jinkouData)}
						{this.renderTaixuan(jinkouData)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="用神" key="aux">
					<FreezeSubTab active={activeKey === 'aux'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						{this.renderHezhan(jinkouData)}
						{this.renderSixiangShu(jinkouData)}
						{this.renderSixiangWuxing(jinkouData)}
						{this.renderInfoTable('四位类象', roleRefRows)}
						{this.renderCategory(jinkouData)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="专题" key="topic">
					{this.renderTopicPanel(jinkouData)}
				</TabPane>
				<TabPane tab="参考" key="ref">
					<FreezeSubTab active={activeKey === 'ref'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						{this.renderBaShe()}
						{this.renderFuwen()}
					</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
			</div>
		);
	}

	// 快捷栏契约:「此刻起课」:课时=当下,走全局 fields 受控回流(hook 链随新盘自动 requestGods)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动。
	clickPlotNow(){
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		const now = new DateTime();
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: {
				...this.props.fields,
				date: { value: now.clone() },
				time: { value: now.clone() },
				ad: { value: now.ad },
			},
		});
	}

	// 快捷栏契约:右栏 tab 镜像与跨页目录撤除,只放本页没有的动词。
	// cnyibu 容器经此声明透传渲染(勿在此放页面上已有的控件)。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.liureng,
			primary: { key: 'plot', label: '起课', onClick: ()=>this.requestGods(this.state.calcFields || this.props.fields, this.props.value) },
			extras: [
				{ key: 'nowPlot', label: '此刻起课', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickPlotNow() },
			],
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="jinkou"
				className="horosa-jinkou-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760;
		}else{
			height = height - 20;
		}

		let chartHeight = height;
		if(typeof chartHeight !== 'number'){
			chartHeight = 760;
		}

		const chartObj = this.props.value;
		const chart = chartObj ? chartObj.chart : {};
		const chartFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const appliedBirth = getAppliedBirth(this.state);
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, chartFields);
		const jinkouData = this.assembleJinKouData(this.state.liureng, this.state.jinkouPan);
		const wxdoms = this.genWuXingDoms();

		const godsZiRows = this.state.liureng ? mapObjToRows(this.state.liureng.godsZi) : [];
		const godsYearRows = this.state.liureng && this.state.liureng.godsYear ? mapObjToRows(this.state.liureng.godsYear.taisui1) : [];
		// 十二长生：优先取引擎产出的 phaseTable（土之长生随「土长生」流派：申/寅），
		// 引擎未就绪时回落共用 wxphase（＝默认水土同宫，与改造前逐字一致）。
		const phaseTable = jinkouData && jinkouData.phaseTable ? jinkouData.phaseTable : null;
		const zsRows = ZSList.map((name)=>{
			const fromEngine = phaseTable ? phaseTable[name] : '';
			const fallback = ZhangSheng.wxphase[`${this.state.wuxing}_${name}`];
			return {
				key: name,
				value: fromEngine || fallback || '—',
			};
		});
		const roleRefRows = [{
			key: '四、人元',
			value: '尊、客、天、君、祖、外',
		}, {
			key: '三、贵神',
			value: '上、主、宰相、臣、父、官禄',
		}, {
			key: '二、月将',
			value: '中、己身、妻财、亲戚、内',
		}, {
			key: '一、地分',
			value: '下、田宅、子孙、奴仆、鞍马、六畜',
		}];

		return (
				<div className={`horosa-jinkou-page horosa-astro-redesign horosa-jinkou-redesign${this.props.hideQuickDock ? ' horosa-jinkou-embedded' : ''}`} style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-jinkou-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-jinkou-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-jinkou-input-panel">
							{this.renderInputPanel(wxdoms)}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-jinkou-chart-panel xq-chart-renderer xq-chart-renderer-jinkou">
							<div className="horosa-jinkou-board-host">
								<JinKouChart
									value={chart}
									liureng={this.state.liureng}
									runyear={displayRunYear}
									gender={appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1}
									zhangshengElem={this.state.wuxing}
									guireng={this.state.guireng}
									jinkouData={jinkouData}
									height={Math.max(560, chartHeight - 22)}
									fields={this.props.fields}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-jinkou-info-panel">
							<div className="horosa-side-panel-heading horosa-jinkou-info-heading">
								<div>
									<div className="horosa-side-panel-title">金口诀信息</div>
									<div className="horosa-side-panel-subtitle">概览、四位与神煞</div>
								</div>
							</div>
							{this.renderRightPanel(jinkouData, displayRunYear, appliedBirth, chartFields, godsZiRows, godsYearRows, zsRows, roleRefRows)}
						</div>
					</div>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}

export default JinKouMain;
