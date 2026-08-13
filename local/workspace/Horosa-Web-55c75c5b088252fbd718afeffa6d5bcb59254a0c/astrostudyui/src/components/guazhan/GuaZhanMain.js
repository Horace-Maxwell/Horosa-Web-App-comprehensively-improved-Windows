import { Component } from 'react';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { createSignatureMemo } from '../../utils/memoBySignature';
import { Checkbox, message, Modal } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select, XQTabs as Tabs, XQSideSection, XQModal  } from '../xq-ui';
import QuickDockBar from '../common/QuickDockBar';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import GuaZhanInput from './GuaZhanInput';
import GuaZhanChart from './GuaZhanChart';
import GuaDesc from './GuaDesc';
import { getGua64, Gua64, Gua8, randYao, ZiList, HourZi, SixGods, getXunEmpty, LiuQi } from '../gua/GuaConst';
import { yarrowYao } from '../gua/LiuYaoConst';
import { analyzeLiuyao } from '../gua/liuyaoFacade';
import { normalizeLiuyaoSettings, applyPreset, setOption, LIUYAO_SCHOOL_OPTIONS, LIUYAO_PRESETS, loadPersistedLiuyaoSettings, persistLiuyaoSettings } from '../gua/liuyaoSchools';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/safeStorage';
import { SHENSHA_EX, yueLingNames } from '../gua/liuyaoShenShaEx';
import LiuYaoDuanJueView from './LiuYaoDuanJueView';
import LiuYaoZhanLeiView from './LiuYaoZhanLeiView';
import LiuYaoCastPad from './LiuYaoCastPad';
import { duanJueLines, zhanleiLines, buildSnapshotAnalysis } from './liuyaoSnapshotEx';
import { YONGSHEN_CATEGORIES } from '../gua/liuyaoYongShen';
import { CHISHI_JUE, FADONG_JUE, LIUSHEN_FADONG, YAOWEI_XIANG, ZHANLEI_GANGYAO } from '../gua/liuyaoReference';
import { SHENSHA_META, DEFAULT_SHENSHA_SET } from '../gua/liuyaoShenSha';
import { LiuYaoZhuangTable, LiuYaoYongShenView, LiuYaoDongBianView, LiuYaoRelatedCards, LiuYaoShenShaView, LiuYaoReference, LiuYaoXunKong, LiuYaoManualCards, LiuYaoRiYueView, LiuYaoShenShaExView, LiuYaoYueLiuShenView, LiuYaoTianshiView } from './LiuYaoBoard';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { getStore } from '../../utils/storageutil';
import { caseApplySeqSuffix, caseFieldSnapshot } from '../../utils/kentangCaseSave';
import { fetchPreciseNongli } from '../../utils/preciseCalcBridge';
import { setNongliLocalCache } from '../../utils/localCalcCache';
import XQIcon from '../xq-icons';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const {Option} = Select;
const { TabPane } = Tabs;

function guaText(gua){
	if(!gua){
		return '';
	}
	const ord = gua.ord !== undefined ? `第${gua.ord}卦` : '';
	const house = gua.house ? `${gua.house.name || ''}宫${gua.house.elem || ''}` : '';
	return `${ord} ${gua.name || ''} ${gua.desc || ''} ${house}`.trim();
}

function lineText(line){
	if(line === undefined || line === null){
		return '';
	}
	return `${line}`.trim();
}

// 从六爻线值(0阴/1阳,初爻→上爻)算任一卦对象。自给自足:AI挂载经 regenerateSixyaoSnapshot→buildTimeGua 时
// gua 无 guaDesc(故旧版只剩本卦),但 yao 六爻线值始终在 → 据此稳定算出 之/互/错/综卦,挂载与导出都全面。
function guaFromYaoValues(values){
	if(!values || values.length !== 6 || values.some((v)=>v !== 0 && v !== 1)){
		return null;
	}
	const g = getGua64(littleEndian(values));
	const idx = g ? g.index : null;
	return (idx !== null && idx !== undefined && Gua64[idx]) ? Gua64[idx] : null;
}

// 时间起卦（梅花/时间确定式法）——纯函数，供 AI 挂载「起课时间」无头复用（与 genTimeGua 同口径）。
export function buildTimeGua(nongli){
	if(!nongli || !nongli.year || !nongli.time || nongli.monthInt === undefined || nongli.dayInt === undefined){
		return null;
	}
	const y = ZiList.indexOf(('' + nongli.year).substr(1)) + 1;
	const m = nongli.monthInt;
	const d = nongli.dayInt;
	const t = ZiList.indexOf(('' + nongli.time).substr(1)) + 1;
	let up = (y + m + d) % 8 - 1; up = up < 0 ? 7 : up;
	let down = (y + m + d + t) % 8 - 1; down = down < 0 ? 7 : down;
	let cyao = (y + m + d + t) % 6 - 1; cyao = cyao < 0 ? 5 : cyao;
	const upGua = Gua8[up];
	const downGua = Gua8[down];
	if(!upGua || !downGua){ return null; }
	const yao = [0, 0, 0, 0, 0, 0].map(() => ({ value: -1, change: false, color: AstroConst.AstroColor.Stroke, name: null }));
	for(let i = 0; i < downGua.value.length; i++){ yao[i].value = downGua.value[i]; }
	for(let i = 0; i < upGua.value.length; i++){ yao[i + 3].value = upGua.value[i]; }
	yao[cyao].change = true;
	const gua = getGua64(littleEndian(yao.map((x) => x.value)));
	const guaidx = gua ? gua.index : null;
	if(guaidx !== null && Gua64[guaidx]){
		for(let i = 0; i < yao.length; i++){ yao[i].name = Gua64[guaidx].yaoname[i]; }
	}
	return { yao, currentGua: guaidx, nongli };
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

// 六爻断卦结构段(流派/用神/旺衰/飞伏/卦身/动变/神煞/六神),供 AI 挂载/导出/储存复用(单一真值源=analyzeLiuyao)。
// st 缺 liuyaoSettings 时用默认设置(默认全显,零回归既有行只追加)。
export function liuyaoStructLines(st){
	try{
		const nowGua = st && st.currentGua !== null && st.currentGua !== undefined && Gua64[st.currentGua] ? Gua64[st.currentGua] : null;
		const yao = st && st.yao ? st.yao : [];
		if(!nowGua || !(yao && yao.length === 6 && yao.every((y)=>y && (y.value === 0 || y.value === 1)))){ return []; }
		const nongli = (st && st.nongli) || {};
		const settings = normalizeLiuyaoSettings(st && st.liuyaoSettings);
		// [X1] 与 liuyaoSnapshotEx.buildSnapshotAnalysis 同口径(三处同口径铁律):
		// 年界线吃 settings.yearBoundary(正月初一派取 yearGZByLunar);ctx 补 hourZhi/jieqiName
		// (缺则时辰类神煞/节气派生在本段空转,与断诀段结论可不一致)。
		const yearGz = lineText((settings.yearBoundary === 'lunar'
			? (nongli.yearGZByLunar || nongli.yearGanZi || nongli.yearJieqi)
			: (nongli.yearJieqi || nongli.yearGanZi || nongli.yearGZByLunar)) || nongli.year);
		const monthGz = lineText(nongli.monthGanZi);
		const dayGz = lineText(nongli.dayGanZi);
		const hourGz = lineText(nongli.timeGanZi || nongli.hourGanZi);
		const ctx = {
			dayGan: dayGz.length >= 2 ? dayGz[0] : null, dayZhi: dayGz.length >= 2 ? dayGz[1] : null,
			monthGan: monthGz.length >= 2 ? monthGz[0] : null, monthZhi: monthGz.length >= 2 ? monthGz[1] : null,
			monthNum: (['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'].indexOf(monthGz.length >= 2 ? monthGz[1] : '') + 1) || null,
			yearGan: yearGz.length >= 2 ? yearGz[0] : null, yearZhi: yearGz.length >= 2 ? yearGz[1] : null,
			hourZhi: hourGz.length >= 2 ? hourGz[1] : null,
			jieqiName: lineText(nongli.jieqi || nongli.jieqiName) || null,
		};
		const moving = [];
		yao.forEach((y, i)=>{ if(y.change){ moving.push(i + 1); } });
		const a = analyzeLiuyao(nowGua, moving, ctx, settings);
		if(!a){ return []; }
		const lines = [];
		const presetLabel = (LIUYAO_PRESETS[settings.school] && LIUYAO_PRESETS[settings.school].label) || (settings.school === 'custom' ? '自定义' : settings.school);
		lines.push('');
		lines.push('[断卦结构]');
		lines.push(`流派：${presetLabel}`);
		if(a.palaceType){ lines.push(`卦序：${a.palaceType.palace}宫·${a.palaceType.type}(世${a.palaceType.shi}应${a.palaceType.ying})`); }
		if(a.guaXing && a.guaXing.ben){ lines.push(`卦象：${a.guaXing.ben}${a.guaXing.bian ? '→' + a.guaXing.bian + '(卦变)' : ''}`); }
		if(a.heHui && a.heHui.length){ lines.push(`成局：${a.heHui.map((h)=>`${h.type}${h.zhis}${h.wuxing}${h.hasMoving ? '(有动)' : ''}`).join('、')}`); }
		if(a.yongShen){
			const ys = a.yongShen;
			const loc = (l)=>{ if(!l || !l.candidates || !l.candidates.length){ return '不上卦'; } return l.candidates.map((c)=>`${c.pos}爻`).join('/'); };
			lines.push(`占测：${ys.label}　用神：${ys.yong}(${loc(ys.located.yong)})`);
			if(ys.roles){ lines.push(`原神：${ys.roles.yuan}(${loc(ys.located.yuan)})　忌神：${ys.roles.ji}(${loc(ys.located.ji)})　仇神：${ys.roles.chou}(${loc(ys.located.chou)})`); }
		}
		if(a.guaShen){ lines.push(`卦身：${a.guaShen.body}${a.guaShen.onChart ? '(上卦)' : '(不上卦)'}`); }
		// 逐爻结构(初→上)→ GFM 表:爻/六神/地支/五行/六亲/世应/旺衰/状态/伏神/神煞(空 cell —);旧「逐爻(初→上)：六神│…」图例行由表头承接。
		const yaoRows = a.yaos.map((y, i)=>{
			const liu = a.liuShen && a.liuShen[i] ? a.liuShen[i].liushen : '';
			const fu = (a.fushenAll && a.fushenAll[i]) || y.fushen;
			const fuTxt = fu && fu.liuqin ? `伏${fu.liuqin}${fu.zhi}${fu.wuxing}` : '';
			const sha = a.shenSha && a.shenSha.perYao && a.shenSha.perYao[i] ? (a.shenSha.perYao[i].shensha || []).join(',') : '';
			const stat = [y.yuePo ? '月破' : '', y.xunKong ? (y.voidKind || '旬空') : '', y.ruMu ? '入墓' : '', y.changsheng === '长生' || y.changsheng === '帝旺' || y.changsheng === '绝' ? y.changsheng : ''].filter(Boolean).join(',');
			return [`第${y.pos}爻`, liu, y.zhi, y.wuxing, y.liuqin, y.shiYing, y.wangShuai, stat, fuTxt, sha];
		});
		pushMdRows(lines, ['爻', '六神', '地支', '五行', '六亲', '世应', '旺衰', '状态', '伏神', '神煞'], yaoRows);
		// 动变 → GFM 表:爻/本卦/变卦/标记(空 cell —)
		if(a.dongBian && a.dongBian.movingCount > 0){
			lines.push(`变卦：${a.dongBian.bianGua ? a.dongBian.bianGua.name : ''}${a.dongBian.guaFuYin ? '(卦伏吟)' : ''}${a.dongBian.guaFanYin ? '(卦反吟)' : ''}`);
			const moveRows = a.dongBian.moves.map((m)=>{
				const tags = [m.jinShen ? '进神' : '', m.tuiShen ? '退神' : '', m.fanYin ? '反吟' : '', m.fuYin ? '伏吟' : '', m.huiTou.sheng ? '回头生' : '', m.huiTou.ke ? '回头克' : '', m.huiTou.chong ? '回头冲' : '', m.huiTou.he ? '回头合' : '', m.huaKong ? '化空' : '', m.huaPo ? '化破' : '', m.huaMu ? '化墓' : '', m.huaJue ? '化绝' : ''].filter(Boolean).join('·');
				return [`第${m.pos}爻`, `${m.ben.liuqin}${m.ben.zhi}${m.ben.wuxing}`, `${m.bian.liuqin}${m.bian.zhi}${m.bian.wuxing}`, tags];
			});
			pushMdRows(lines, ['爻', '本卦', '变卦', '标记'], moveRows);
		}
		return lines;
	}catch(e){
		return [];
	}
}

export function buildGuaSnapshotText(fields, st){
	const lines = [];
	const nowGua = st && st.currentGua !== null && Gua64[st.currentGua] ? Gua64[st.currentGua] : null;
	const yao = st && st.yao ? st.yao : [];
	const nongli = st && st.nongli ? st.nongli : {};
	const guaDesc = st && st.guaDesc ? st.guaDesc : {};
	const fieldTime = (fields && fields.date && fields.time)
		? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
		: '';
	const startTime = lineText(nongli.birth) || fieldTime;
	const yearGz = lineText(nongli.yearJieqi || nongli.year || nongli.yearGanZi);
	const monthGz = lineText(nongli.monthGanZi);
	const dayGz = lineText(nongli.dayGanZi);
	const timeGz = lineText(nongli.time || nongli.timeGanZi);
	const monthXunEmpty = monthGz.length >= 2 ? getXunEmpty(monthGz.substr(0, 1), monthGz.substr(1, 1)) : '';
	const dayXunEmpty = dayGz.length >= 2 ? getXunEmpty(dayGz.substr(0, 1), dayGz.substr(1, 1)) : '';

	lines.push('[起盘信息]');
	if(fieldTime){
		lines.push(`日期：${fieldTime}`);
	}
	if(fields && fields.zone){
		lines.push(`时区：${fields.zone.value}`);
	}
	if(fields && fields.lon && fields.lat){
		lines.push(`经纬度：${fields.lon.value} ${fields.lat.value}`);
	}
	// 求测人性别(Win issue #29):性别影响取用神(如占婚男取妻财、女取官鬼)→ 必须随挂载/导出给 AI。
	if(fields && fields.gender && (fields.gender.value === 0 || fields.gender.value === 1)){
		lines.push(`求测人性别：${fields.gender.value === 1 ? '男' : '女'}`);
	}
	if(startTime){
		lines.push(`起卦时间：${startTime}${timeGz ? ` ${timeGz}时` : ''}`);
	}
	if(yearGz || monthGz || dayGz || timeGz){
		lines.push(`干支：年${yearGz || '无'} 月${monthGz || '无'} 日${dayGz || '无'} 时${timeGz || '无'}`);
	}
	if(monthXunEmpty || dayXunEmpty){
		lines.push(`旬空：月空${monthXunEmpty || '无'} 日空${dayXunEmpty || '无'}`);
	}

	lines.push('');
	// 之卦/互卦/错卦/综卦：从六爻线值直接计算(不依赖 guaDesc) → 挂载经 buildTimeGua(无 guaDesc)时也能全面输出,
	// 修「AI分析挂载六爻只有本卦」。yao 缺失时回落 guaDesc。
	// 提升到函数作用域，供下方[六爻与动爻]给之卦/互卦逐爻装卦复用。
	const yaoVals = (yao && yao.length === 6 && yao.every((y)=>y && (y.value === 0 || y.value === 1))) ? yao.map((y)=>y.value) : null;
	const hasMoving = !!(yao && yao.some((y)=>y.change));
	let huGua = null;
	let bianGua = null;
	let cuoGua = null;
	let zongGua = null;
	if(yaoVals){
		huGua = guaFromYaoValues([yaoVals[1], yaoVals[2], yaoVals[3], yaoVals[2], yaoVals[3], yaoVals[4]]);
		bianGua = guaFromYaoValues(yao.map((y)=>y.change ? (y.value === 1 ? 0 : 1) : y.value));
		cuoGua = guaFromYaoValues(yaoVals.map((v)=>(v === 1 ? 0 : 1)));
		zongGua = guaFromYaoValues([...yaoVals].reverse());
	}
	lines.push('[卦象]');
	if(nowGua){
		lines.push(`本卦：${guaText(nowGua)}`);
	}else{
		lines.push('本卦：未生成');
	}
	if(yaoVals){
		if(huGua){ lines.push(`互卦：${guaText(huGua)}`); }
		else if(guaDesc.guaMiddle){ lines.push(`互卦：${guaText(guaDesc.guaMiddle)}`); }
		if(hasMoving){
			if(bianGua){ lines.push(`之卦(变卦)：${guaText(bianGua)}`); }
			else if(guaDesc.guaRes){ lines.push(`之卦(变卦)：${guaText(guaDesc.guaRes)}`); }
		}else{
			lines.push('之卦(变卦)：无动爻,卦不变');
		}
		if(cuoGua){ lines.push(`错卦(阴阳全变)：${guaText(cuoGua)}`); }
		if(zongGua){ lines.push(`综卦(上下颠倒)：${guaText(zongGua)}`); }
	}else{
		if(guaDesc.guaMiddle){ lines.push(`互卦：${guaText(guaDesc.guaMiddle)}`); }
		if(guaDesc.guaRes){ lines.push(`之卦：${guaText(guaDesc.guaRes)}`); }
	}

	lines.push('');
	lines.push('[六爻与动爻]');
	if(!yao || yao.length === 0){
		lines.push('暂无爻线数据');
	}else{
		// 本卦逐爻（保持原样）：阴阳/动静 + 六神(六兽) + 爻名(纳甲=地支/五行/六亲/世应)。
		yao.forEach((item, idx)=>{
			const yaoType = item.value === 1 ? '阳爻' : (item.value === 0 ? '阴爻' : '未定');
			const moving = item.change ? '（动）' : '（静）';
			const god = item.god ? `，六神:${item.god}` : '';
			const name = item.name ? `，爻名:${item.name}` : '';
			lines.push(`第${idx + 1}爻：${yaoType}${moving}${god}${name}`);
		});
		// 之卦(变卦)/互卦逐爻装卦：地支/五行/世应取自该卦 yaoname;但【六亲必须以「本卦之宫」五行论】——
		// 京房纳甲:用神系统锚定本卦,之卦/互卦的六亲不按其自身宫五行(否则与中间栏显示错位,Win issue #30:
		// 之卦酉金应为妻财[本卦离宫火克金],却被算成兄弟[变卦乾宫金比和])。六神沿用本卦同位(按日干起、各卦同序)。
		const godAt = (i)=>(yao[i] && yao[i].god ? `，六神:${yao[i].god}` : '');
		const benGongElem = (nowGua && nowGua.house && nowGua.house.elem) || null;
		// 把「该卦自身宫论出的六亲」(yaoname 第3-4字)改成「按本卦宫论」;保留地支五行(前2字)与世应(第5字起)。
		const fixLiuqinToBenGong = (nm)=>{
			if(!benGongElem || typeof nm !== 'string' || nm.length < 4){ return nm; }
			const branchElem = nm[1]; // 爻地支五行(金/木/水/火/土)
			const lq = LiuQi[benGongElem] && LiuQi[benGongElem][branchElem];
			return lq ? (nm.slice(0, 2) + lq + nm.slice(4)) : nm;
		};
		const pushGuaYao = (label, gua)=>{
			if(!gua || !Array.isArray(gua.yaoname)){ return; }
			lines.push(`${label}逐爻（初→上）：`);
			gua.yaoname.forEach((nm0, idx)=>{
				const nm = fixLiuqinToBenGong(nm0); // 六亲改按本卦宫(与显示一致),地支五行/世应不变
				// 阴阳爻取该卦线值 gua.value[idx]（1=阳/0=阴），与本卦逐爻一致。
				const v = Array.isArray(gua.value) ? gua.value[idx] : undefined;
				const yinYang = v === 1 ? '阳爻' : (v === 0 ? '阴爻' : '');
				lines.push(`第${idx + 1}爻：${yinYang ? `${yinYang}，` : ''}爻名:${nm}${godAt(idx)}`);
			});
		};
		if(hasMoving && bianGua){ pushGuaYao('之卦(变卦)', bianGua); }
		if(huGua){ pushGuaYao('互卦', huGua); }
	}

	// 断卦结构(流派/用神/旺衰/飞伏/卦身/动变/神煞/六神)——追加于既有段之后,既有行字节不变(零回归)。
	const structLines = liuyaoStructLines(st);
	if(structLines && structLines.length){ structLines.forEach((l)=>lines.push(l)); }

	lines.push('');
	lines.push('[卦辞与断语]');
	['guaOrg', 'guaMiddle', 'guaRes'].forEach((key)=>{
		const one = guaDesc[key];
		if(!one){
			return;
		}
		const label = key === 'guaOrg' ? '本卦' : (key === 'guaMiddle' ? '互卦' : '之卦');
		lines.push(`${label}：${guaText(one)}`);
		if(one['卦辞']){
			lines.push(`卦辞：${one['卦辞']}`);
		}
		if(one['彖']){
			lines.push(`彖曰：${one['彖']}`);
		}
		if(one['象']){
			lines.push(`象曰：${one['象']}`);
		}
		const yaoci = one['爻辞'] || [];
		const yaox = one['爻象'] || [];
		yaoci.forEach((text, idx)=>{
			const xiang = yaox[idx] ? `；象曰：${yaox[idx]}` : '';
			lines.push(`第${idx + 1}爻辞：${text}${xiang}`);
		});
		lines.push('');
	});

	// [判语库·参考诀表] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「参考」页 LiuYaoReference 同源,
	// 五表原文引自 liuyaoReference 常量(诸爻持世诀/六亲发动诀/六神发动歌/爻位象/常见占类断法纲要),判语零改写。
	const refLiuqinList = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
	const refLiushenList = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
	lines.push('[判语库·参考诀表]');
	lines.push('◆ 诸爻持世诀');
	refLiuqinList.forEach((lq)=>lines.push(`${lq}持世：${CHISHI_JUE[lq]}`));
	lines.push('◆ 六亲发动诀(发动必生一克一)');
	refLiuqinList.forEach((lq)=>lines.push(`${lq}动：${FADONG_JUE[lq].ke}　${FADONG_JUE[lq].sheng}`));
	lines.push('◆ 六神发动歌');
	refLiushenList.forEach((sn)=>lines.push(`${sn}动：${LIUSHEN_FADONG[sn]}`));
	lines.push('◆ 爻位象(身/宅/人事)');
	YAOWEI_XIANG.forEach((y)=>lines.push(`${['初', '二', '三', '四', '五', '上'][y.pos - 1]}爻：${y.body}｜${y.home}｜${y.person}`));
	lines.push('◆ 常见占类断法纲要');
	ZHANLEI_GANGYAO.forEach((z)=>lines.push(`${z.name}：用神${z.yong}；吉：${z.ji}；凶：${z.xiong}`));

	// [断诀命中]/[占类断语](六爻补齐 A8:builder 恒产,导出层按设置控;既有段字节不变)
	const _snapA = buildSnapshotAnalysis(st);
	if(_snapA){
		lines.push('');
		duanJueLines(_snapA).forEach((l)=>lines.push(l));
		lines.push('');
		zhanleiLines(_snapA, _snapA.gua && _snapA.gua.name).forEach((l)=>lines.push(l));
	}

	return lines.join('\n');
}

class GuaZhanMain extends Component{
	constructor(props) {
		super(props);

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.genYao = this.genYao.bind(this);
		this.randomYao = this.randomYao.bind(this);
		this.randomGua = this.randomGua.bind(this);
		this.genGua = this.genGua.bind(this);
		this.genGua64OptDom = this.genGua64OptDom.bind(this);
		this.changeGua = this.changeGua.bind(this);
		this.filterGua = this.filterGua.bind(this);
		this.getCurrentGua = this.getCurrentGua.bind(this);
		this.setupYao = this.setupYao.bind(this);
		this.emptyYao = this.emptyYao.bind(this);
		this.getYaoColor = this.getYaoColor.bind(this);
		this.genParams = this.genParams.bind(this);
		this.genTimeGua = this.genTimeGua.bind(this);
		this.clickTimeGua = this.clickTimeGua.bind(this);
		this.genGua8Doms = this.genGua8Doms.bind(this);
		this.upGuaIdxChanged = this.upGuaIdxChanged.bind(this);
		this.downGuaIdxChanged = this.downGuaIdxChanged.bind(this);
		this.custGuaDongYaoChanged = this.custGuaDongYaoChanged.bind(this);
		this.numGuaDongYaoChanged = this.numGuaDongYaoChanged.bind(this);
		this.numberChanged = this.numberChanged.bind(this);
		this.clickCustGua = this.clickCustGua.bind(this);
		this.clickNumGua = this.clickNumGua.bind(this);
		this.clickYarrowGua = this.clickYarrowGua.bind(this);
		this.genFields = this.genFields.bind(this);
		this.dongyaoChanged = this.dongyaoChanged.bind(this);
		this.getDongYaos = this.getDongYaos.bind(this);
		this.fillYaoGods = this.fillYaoGods.bind(this);
		this.getGuasId = this.getGuasId.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.requestGuaDescReturn = this.requestGuaDescReturn.bind(this);
		this.requestGuaDesc = this.requestGuaDesc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.getLiuyaoAnalysis = this.getLiuyaoAnalysis.bind(this);
		this.changeLiuyaoPreset = this.changeLiuyaoPreset.bind(this);
		this.changeLiuyaoOption = this.changeLiuyaoOption.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		this.state = {
			yao: this.emptyYao(),
			btnDisabled: [false, false, false, false, false, false],
			btnName: [
				'随机一爻', '随机二爻', '随机三爻', '随机四爻', '随机五爻', '随机六爻'
			],
			btnGenGua: '整卦随机',
			currentGua: null,
			// 起卦来源:'time'=时间卦(随时间派生,改时间应重起);其余=一次性成卦(手摇/蓍草/报数/自定义/直选/随机),
			// 改时间/地点/日界只应刷新干支(日辰月建旬空神煞),绝不可重摇 —— 「起出即冻结」。
			guaOrigin: 'time',
			nongli: null,
			custGuaDongYao: -1,
			numGuaDongYao: -1,
			upGuaIdx: null,
			downGuaIdx:null,
			number: null,
			guaDesc: null,
			rightPanelTab: 'overview',
			shenshaModalOpen: false,
			liuyaoSettings: loadPersistedLiuyaoSettings() || normalizeLiuyaoSettings(null),
		};
		this._liuyaoMemo = createSignatureMemo(4);

		this.unmounted = false;
		this.lastRestoredCaseId = null;
		this.timeHook = {};
		this.genColor = [
			AstroConst.AstroColor.Stroke,
			AstroConst.AstroColor.Mars || '#a01306',
			AstroConst.AstroColor.MC || '#948e33',
			AstroConst.AstroColor['Purple Clouds'] || '#7b5cbc',
			AstroConst.AstroColor.Jupiter || '#0b0e66',
		];
		this.colorIndex = 0;
		this.periodTask = null;
		this.guaPeriodTask = null;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreFromCurrentCase();
			};
		}
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		// 载入代次后缀走共用件(kentangCaseSave.caseApplySeqSuffix):不带它则同一条记录第二次载入
		// 会被下面那道去重守卫拦掉,屏幕上仍是用户后来新起的卦。禁另抄一份。
		const caseVersion = `${cid}|${updateTime}${caseApplySeqSuffix(userState)}`;
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'guazhan' && caseType !== 'liuyao'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const rawState = payload.gua && typeof payload.gua === 'object'
			? payload.gua
			: (payload.state && typeof payload.state === 'object' ? payload.state : null);
		if(!rawState){
			return;
		}
		const empty = this.emptyYao();
		const rawYao = rawState.yao instanceof Array ? rawState.yao : [];
		const yao = empty.map((item, idx)=>{
			const one = rawYao[idx] || {};
			const value = one.value === 0 || one.value === 1 ? one.value : item.value;
			return {
				...item,
				value: value,
				change: !!one.change,
				name: one.name !== undefined ? one.name : item.name,
				god: one.god !== undefined ? one.god : item.god,
				color: one.color || item.color,
			};
		});
		const nextState = {
			yao: yao,
			currentGua: rawState.currentGua !== undefined ? rawState.currentGua : null,
			// 旧档(v2 之前)无此键:一律按「一次性成卦」还原,宁可少重算也绝不重摇覆盖存档卦象。
			guaOrigin: rawState.guaOrigin === 'time' ? 'time' : (rawState.guaOrigin || 'restored'),
			nongli: rawState.nongli && typeof rawState.nongli === 'object' ? rawState.nongli : null,
			guaDesc: rawState.guaDesc && typeof rawState.guaDesc === 'object' ? rawState.guaDesc : null,
			custGuaDongYao: rawState.custGuaDongYao !== undefined ? rawState.custGuaDongYao : -1,
			numGuaDongYao: rawState.numGuaDongYao !== undefined ? rawState.numGuaDongYao : -1,
			upGuaIdx: rawState.upGuaIdx !== undefined ? rawState.upGuaIdx : null,
			downGuaIdx: rawState.downGuaIdx !== undefined ? rawState.downGuaIdx : null,
			number: rawState.number !== undefined ? rawState.number : null,
			liuyaoSettings: normalizeLiuyaoSettings(rawState.liuyaoSettings),
		};
		this.lastRestoredCaseId = caseVersion;
		this.setState(nextState, ()=>{
			if(!this.state.guaDesc && this.state.currentGua !== null){
				this.requestGuaDesc();
			}
		});
	}

	setRightPanelTab(key){
		this.setState({
			rightPanelTab: key,
		});
	}

	// 断卦分析(单一真值源):currentGua + 动爻 + nongli干支 + 流派设置 → analyzeLiuyao。按 key 记忆,避免每帧重算。
	getLiuyaoAnalysis(){
		const st = this.state;
		const nowGua = st.currentGua !== null && st.currentGua !== undefined && Gua64[st.currentGua] ? Gua64[st.currentGua] : null;
		const yao = st.yao || [];
		const ok = nowGua && yao.length === 6 && yao.every((y)=>y && (y.value === 0 || y.value === 1));
		if(!ok){ return null; }
		const nongli = st.nongli || {};
		const settings = normalizeLiuyaoSettings(st.liuyaoSettings);
		// [六爻补齐 A4] 定年界线口径:立春换岁(yearJieqi/节气系)/正月初一(yearGZByLunar/农历系);
		// 缺该口径字段时回落另一系(旧数据兼容),再回落 year。
		const yearGz = `${(settings.yearBoundary === 'lunar'
			? (nongli.yearGZByLunar || nongli.yearGanZi || nongli.yearJieqi)
			: (nongli.yearJieqi || nongli.yearGanZi || nongli.yearGZByLunar)) || nongli.year || ''}`.trim();
		const monthGz = `${nongli.monthGanZi || ''}`.trim();
		const dayGz = `${nongli.dayGanZi || ''}`.trim();
		const hourGz = `${nongli.timeGanZi || nongli.hourGanZi || ''}`.trim();
		const jieqiName = `${nongli.jieqi || nongli.jieqiName || ''}`.trim();
		const moving = [];
		yao.forEach((y, i)=>{ if(y.change){ moving.push(i + 1); } });
		const key = [st.currentGua, moving.join('-'), dayGz, monthGz, yearGz, hourGz, jieqiName, JSON.stringify(settings)].join('|');
		// 单槽升 4 槽 LRU:切流派/切卦往返(A→B→A)免重算 analyzeLiuyao
		const hit = this._liuyaoMemo.get(key);
		if(hit !== undefined){ return hit; }
		const ctx = {
			dayGan: dayGz.length >= 2 ? dayGz[0] : null, dayZhi: dayGz.length >= 2 ? dayGz[1] : null,
			monthGan: monthGz.length >= 2 ? monthGz[0] : null, monthZhi: monthGz.length >= 2 ? monthGz[1] : null,
			// 🔴 月建索引(寅=正月=1):月令75神煞 + 月建六神 依此起例。此前缺 monthNum → yueLiuShenAnn 恒 null、月令神煞子集空转(死控)。
			monthNum: (['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'].indexOf(monthGz.length >= 2 ? monthGz[1] : '') + 1) || null,
			yearGan: yearGz.length >= 2 ? yearGz[0] : null, yearZhi: yearGz.length >= 2 ? yearGz[1] : null,
			hourZhi: hourGz.length >= 2 ? hourGz[1] : null,
			jieqiName: jieqiName || null,
		};
		const analysis = analyzeLiuyao(nowGua, moving, ctx, settings);
		this._liuyaoMemo.set(key, analysis);
		return analysis;
	}

	changeLiuyaoPreset(presetKey){
		this.setState({ liuyaoSettings: applyPreset(presetKey) });
	}

	changeLiuyaoOption(optKey, value){
		this.setState((prev)=>({ liuyaoSettings: setOption(prev.liuyaoSettings, optKey, value) }));
	}

	navigateFeature(tabKey, subTab){
		if(this.props.dispatch){
			const payload = {
				currentTab: tabKey,
			};
			if(subTab){
				payload.currentSubTab = subTab;
			}
			this.props.dispatch({
				type: 'astro/save',
				payload,
			});
		}
	}

	clickTimeGua(fields){
		const flds = this.genFields(fields);
		if(!flds){
			return;
		}
		if(!fields){
			const patch = this.getTimeFieldsFromSelector();
			if(patch){
				this.onFieldsChange(patch);
			}
		}
		this.requestNongli(flds);
	}

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		}
		return params;
	}

	getTimeFieldsFromSelector(){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		return {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	genFields(baseFields){
		const flds = {
			...(baseFields || this.props.fields || {}),
		};
		const patch = this.getTimeFieldsFromSelector();
		if(patch){
			return {
				...flds,
				...patch,
			};
		}
		return flds;
	}

	getGuasId(){
		let guaIdx = this.state.currentGua;
		if(guaIdx === null){
			return null;
		}
		let gua = Gua64[guaIdx];
		if(gua === undefined || gua === null){
			return null;
		}
		let yaos = gua.value.slice(0);
		let orgId = yaos.join('');

		let dongs = this.getDongYaos();
		for(let i=0; i<dongs.length; i++){
			let idx = dongs[i];
			yaos[idx] = yaos[idx] ? 0 : 1;
		}
		let resId = yaos.join('');

		yaos = [];
		yaos[0] = gua.value[1];
		yaos[1] = gua.value[2];
		yaos[2] = gua.value[3];
		yaos[3] = gua.value[2];
		yaos[4] = gua.value[3];
		yaos[5] = gua.value[4];
		let middleId = yaos.join('');

		let obj = {
			guaOrg: orgId,
			guaRes: resId,
			guaMiddle: middleId,
		};

		return obj;
	}

	async requestGuaDescReturn(){
		let desc = null;
		let guaids = this.getGuasId();
		if(guaids){
			let params = {
				name: [guaids.guaOrg, guaids.guaRes, guaids.guaMiddle],
			};
			
			const descdata = await request(`${Constants.ServerRoot}/gua/desc`, {
				body: JSON.stringify(params),
			});
	
			// [六爻补齐 E] 卦辞离线兜底:成功即缓存;网络层失败读同 key 缓存(离线/后端未起仍有卦辞)。
			const _descCacheKey = 'horosa.guadesc.cache.' + params.name.join('|');
			if(!descdata){
				try{
					const cached = safeLocalStorageGet(_descCacheKey);
					if(cached){ return JSON.parse(cached); }
				}catch(e){ /* 缓存不可用即维持旧行为 */ }
				return;   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
			}
			const descresult = descdata[Constants.ResultKey];
	
			desc = {
				guaOrg: descresult[guaids.guaOrg],
				guaRes: descresult[guaids.guaRes],
				guaMiddle: descresult[guaids.guaMiddle],
			};
			safeLocalStorageSet(_descCacheKey, JSON.stringify(desc)); // 配额满由 safeStorage 自愈
		}

		return desc;
	}

	async requestGuaDesc(){
		let desc = await this.requestGuaDescReturn();
		this.setState({
			guaDesc: desc,
		}, ()=>{
			// horosa_panel_ready_v1:六爻的落定点。任何一次交互(改时间→requestNongli→genTimeGua、
			// 点爻、起卦)最终都收束到「取卦辞回来」这一次 setState —— 中栏卦象(yao/currentGua)
			// 在更早一次 setState 已落,右栏断卦(getLiuyaoAnalysis 由 yao+nongli 同步派生)与卦辞
			// 面板在本次落完。故这里是本族最后一次绘制提交。
			markPanelReady('guazhan');
		});
	}

	// 🔴 时间/地点/日界变动的唯一入口(左栏改字段 + 两个全局设置事件都走这里)。
	// 时间卦本就随时间派生 → 重起;而手摇/蓍草/报数/自定义/直选/随机/载回的卦是一次性成卦,
	// 只能刷新干支(日辰月建随之变,旺衰·旬空·神煞由渲染层按新 nongli 现算),卦象与动爻原样保留。
	// 从前这里无条件 clickTimeGua,用户摇完卦一改时间就被时间卦静默顶掉 —— 与「起出即冻结」直接冲突。
	onTimeGeoChanged(fields){
		if((this.state.guaOrigin || 'time') === 'time'){
			this.clickTimeGua(fields);
		}else{
			this.requestNongli(fields, ()=>{ this.requestGuaDesc(); });
		}
	}

	async requestNongli(fields, completeHandle){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);
		const result = await fetchPreciseNongli(params);
		if(!result){
			return;
		}
		setNongliLocalCache(params, result);

		const st = {
			nongli: result,
		};

		this.setState(st, ()=>{
			if(completeHandle){
				completeHandle()
			}else{
				this.genTimeGua();
			}
		});
	}

	genTimeGua(){
		let nl = this.state.nongli;
		if(nl === undefined || nl === null){
			return;
		}

		let y = ZiList.indexOf(nl.year.substr(1)) + 1;
		let m = nl.monthInt;
		let d = nl.dayInt;
		let t = ZiList.indexOf(nl.time.substr(1)) + 1;
		let up = (y+m+d) % 8 - 1;
		let down = (y+m+d+t) % 8 - 1;
		up = up < 0 ? 7 : up;
		down = down < 0 ? 7 : down;
		let cyao = (y+m+d+t) % 6 - 1;
		cyao = cyao < 0 ? 5 : cyao;

		let upGua = Gua8[up];
		let downGua = Gua8[down];
		let yao = this.emptyYao();

		for(let i=0; i<downGua.value.length; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<upGua.value.length; i++){
			yao[i+3].value = upGua.value[i];
		}
		yao[cyao].change = true;
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		this.setState({
			yao: yao,
			currentGua: guaidx,
			guaOrigin: 'time',
		}, ()=>{
			this.requestGuaDesc();
		});						

	}

	clickNumGua(){
		if(this.state.number === undefined || this.state.number === null 
			|| this.state.number === '' || this.state.number < 0){
			return;
		}

		let nstr = this.state.number + '';
		let pos = Math.floor(nstr.length / 2);
		let upcnt = 0;
		let downcnt = 0;
		for(let i=0; i<pos; i++){
			let n = nstr.charAt(i);
			let v = new Number(n);
			upcnt = upcnt + v;
		}
		let up = upcnt % 8 - 1;
		up = up < 0 ? 7 : up;

		for(let i=pos; i<nstr.length; i++){
			let n = nstr.charAt(i);
			let v = new Number(n);
			downcnt = downcnt + v;
		}
		let down = downcnt % 8 - 1;
		down = down < 0 ? 7 : down;

		let dong = upcnt + downcnt;

		let upGua = Gua8[up];
		let downGua = Gua8[down];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = upGua.value[i];
		}

		let idx = dong % 6 - 1;
		idx = idx < 0 ? 5 : idx;
		let dyOpt = this.state.numGuaDongYao;
		if(dyOpt === -1){
			// [X1·P2-41] 附加时辰动爻按【左栏所选起卦时间】之时辰,非系统此刻——
			// 复现历史卦(改过左栏时间)时,盘面干支随所选时间而动爻曾随此刻漂移,同卦不同断。
			const tv = this.props.fields && this.props.fields.time && this.props.fields.time.value;
			let h = tv && tv.format ? parseInt(tv.format('HH'), 10) : new Date().getHours();
			let zi = HourZi[h];
			let ziidx = ZiList.indexOf(zi) + 1;
			idx = (dong + ziidx) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -2){
			idx = (dong + randomNum()) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -3){
			idx = dong % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else{
			idx = dyOpt;
		}
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			}, ()=>{
				this.requestGuaDesc();
			});							
		});
	}

	// [六爻补齐 A5] 手动/尾包起卦入口(LiuYaoCastPad 归一产物):lines=[0/1]×6(初爻在前),
	// moving=动爻位(1-6);装配流程与 clickYarrowGua 逐行同(仅爻源不同)。
	onManualCast = ({ lines, moving })=>{
		let yao = this.emptyYao();
		for(let i = 0; i < 6; i++){
			yao[i].value = lines[i];
			yao[i].change = (moving || []).indexOf(i + 1) >= 0;
		}
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);
		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({ yao: yao, currentGua: guaidx, guaOrigin: 'cast' }, ()=>{ this.requestGuaDesc(); });
		});
	};

	// 大衍蓍草起卦(WP-I):每爻按蓍草概率(老阳3/少阳5/少阴7/老阴1)生成,老阳老阴为动爻;余流程同自定义起卦。
	clickYarrowGua(){
		let yao = this.emptyYao();
		for(let i = 0; i < 6; i++){
			const yy = yarrowYao();
			yao[i].value = yy.value;
			yao[i].change = yy.change;
		}
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);
		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({ yao: yao, currentGua: guaidx, guaOrigin: 'cast' }, ()=>{ this.requestGuaDesc(); });
		});
	}

	clickCustGua(){
		if(this.state.upGuaIdx === undefined || this.state.upGuaIdx === null || this.state.upGuaIdx === '' ||
			this.state.downGuaIdx === undefined || this.state.downGuaIdx === null || this.state.downGuaIdx === ''){
			return;
		}

		let up = Gua8[this.state.upGuaIdx];
		let down = Gua8[this.state.downGuaIdx];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = down.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = up.value[i];
		}

		let idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
		idx = idx < 0 ? 5 : idx;
		let dyOpt = this.state.custGuaDongYao;
		if(dyOpt === -1){
			// [X1·P2-41] 附加时辰动爻按【左栏所选起卦时间】之时辰,非系统此刻——
			// 复现历史卦(改过左栏时间)时,盘面干支随所选时间而动爻曾随此刻漂移,同卦不同断。
			const tv = this.props.fields && this.props.fields.time && this.props.fields.time.value;
			let h = tv && tv.format ? parseInt(tv.format('HH'), 10) : new Date().getHours();
			let zi = HourZi[h];
			let ziidx = ZiList.indexOf(zi) + 1;
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + ziidx) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -2){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + randomNum()) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -3){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else{
			idx = dyOpt;
		}
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			}, ()=>{
				this.requestGuaDesc();
			});							
		});
	}

	// 六爻是否都已成形(emptyYao 出来的是六个 value=-1 的占位,长度同样是 6 —— 不能用长度判)。
	isGuaComplete(){
		const yao = this.state.yao;
		return !!(yao && yao.length === 6 && yao.every((y)=>y && y.value >= 0));
	}

	emptyYao(){
		let yao = [{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		}];
		return yao;
	}

	getYaoColor(){
		return AstroConst.AstroColor.Stroke;
	}

	filterGua(value, option){
		const item = option.props.rec;
		let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
		if(txt.indexOf(value) >= 0){
			return true;
		}
		return false;
	}

	changeGua(value, option){
		let gua = Gua64[value];
		if(gua === undefined || gua === null){
			this.setState({
				yao: this.emptyYao(),
				currentGua: null,
				guaOrigin: 'time',
				upGuaIdx: null,
				downGuaIdx: null,
				number: null,
				nongli: null,
				guaDesc: null,
			});
			return;
		}
		let yao = [];
		for(let i=0; i<gua.value.length; i++){
			yao[i] = {
				value: gua.value[i],
				name: gua.yaoname[i],
				color: this.getYaoColor()
			};
		}
		this.setState({
			yao: yao,
			currentGua: value,
			guaOrigin: 'cast',
		}, ()=>{
			this.requestGuaDesc();
			// 直选卦时若本次还没取过干支,补取一次 —— 否则日辰月建全空,
			// 旺衰/六神/旬空/神煞会静默缺失(界面上看不出缺,只是全部算不出)。
			if(!this.state.nongli){
				this.requestNongli(this.genFields(), ()=>{});
			}
		});
	}

	getCurrentGua(yaos){
		let bits = [];
		for(let i=0; i<yaos.length; i++){
			let yao = yaos[i];
			bits[i] = yao.value;
		}
		let key = littleEndian(bits);
		let gua = getGua64(key);
		if(gua){
			return gua.index;
		}
		return null;
	}

	// [G2] 随机起卦概率源分派:coins=三钱(randYao,老阳老阴各1/8) / yarrow=大衍蓍草(3/16·1/16)。
	// 整卦随机/逐爻随机共用;「蓍草起卦」独立按钮恒蓍草不受此档影响。
	rollYao(){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		return s.randomAlgo === 'yarrow' ? yarrowYao() : randYao();
	}

	setupYao(yaos, guaidx){
		if(guaidx === undefined || guaidx === null){
			return;
		}
		let gua = Gua64[guaidx];
		if(gua === undefined || gua === null){
			return;
		}
		for(let i=0; i<yaos.length; i++){
			yaos[i].name = gua.yaoname[i];
		}
	}

	genGua64OptDom(){
		let doms = Gua64.map((item, idx)=>{
			let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
			return (
				<Option value={idx} key={idx} rec={item}>{txt}</Option>
			);
		});

		return doms;
	}

	randomGua(stopAct){
		if(stopAct){
			if(this.guaPeriodTask !== null){
				clearInterval(this.guaPeriodTask);
				this.guaPeriodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 10;
			while(cnt > 0){
				for(let i=0; i<yao.length; i++){
					let ryao = this.rollYao();
					yao[i].value = ryao.value;
					yao[i].change = ryao.change;
					yao[i].color = this.getYaoColor();
				}
				cnt = cnt - 1;
			}
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);

			let flds = this.genFields();
			this.requestNongli(flds, ()=>{
				this.setState({
					yao: yao,
					currentGua: guaidx,
					guaOrigin: 'cast',
				}, ()=>{
					this.requestGuaDesc();
				});							
			});
		}else{
			if(this.guaPeriodTask === null){
				this.guaPeriodTask = setInterval(()=>{
					let yao = this.state.yao;
					for(let i=0; i<yao.length; i++){
						let ryao = this.rollYao();
						yao[i].value = ryao.value;
						yao[i].change = ryao.change;
						yao[i].color = this.getYaoColor();
					}
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);	
					this.setState({
						yao: yao,
						currentGua: guaidx,
						guaOrigin: 'cast',
					});						
				}, 200);
			}
		}
	}

	randomYao(idx, stopAct){
		if(stopAct){
			if(this.periodTask !== null){
				clearInterval(this.periodTask);
				this.periodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 50;
			let ryao = this.rollYao();
			while(cnt > 0){
				ryao = this.rollYao();
				cnt = cnt - 1;
			}
			yao[idx].value = ryao.value;
			yao[idx].change = ryao.change;
			yao[idx].color = this.getYaoColor();
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);
			this.setState({
				yao: yao,
				currentGua: guaidx,
				guaOrigin: 'cast',
			});	

			let completGua = true;
			for(let i=0; i<yao.length; i++){
				if(yao[i].value < 0){
					completGua = false;
					break;
				}
			}			
			if(completGua){
				let flds = this.genFields();
				this.requestNongli(flds, ()=>{
					this.setState({
						yao: yao,
						currentGua: guaidx,
						guaOrigin: 'cast',
					}, ()=>{
						this.requestGuaDesc();
					});							
				});	
			}			
		}else{
			if(this.periodTask === null){
				this.periodTask = setInterval(() => {
					let yao = this.state.yao;
					let ryao = this.rollYao();
					yao[idx].value = ryao.value;
					yao[idx].change = ryao.change;
					this.colorIndex = this.colorIndex + 1;
					let coloridx = this.colorIndex % this.genColor.length;
					yao[idx].color = this.genColor[coloridx];
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);
					this.setState({
						yao: yao,
						currentGua: guaidx,
						guaOrigin: 'cast',
					});						
				}, 100);	
			}
		}
	}

	// [G3] 随机前确认:开启且当前卦为手动来源(摇卦/自定义/直选)时,启动随机先弹确认防误覆盖;
	// 时间卦/空盘直滚(时间卦本就随时可重起,无「心血覆盖」问题);「停止」动作永不拦。
	confirmRandomThen(run){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const origin = this.state.guaOrigin;
		if(!s.randomConfirm || !origin || origin === 'time'){ run(); return; }
		Modal.confirm({
			title: '覆盖当前卦象?',
			content: '当前卦为手动所起,随机起卦将覆盖它。',
			okText: '覆盖并随机', cancelText: '取消',
			onOk: run,
		});
	}

	genGua(){
		let btnName = this.state.btnGenGua;
		let stopAct = false;
		let act = btnName.substr(0, 2);
		if(act === '停止'){
			stopAct = true;
			btnName = '整卦随机';
		}else{
			btnName = '停止随机';
		}
		if(!stopAct){
			this.confirmRandomThen(()=>{
				this.setState({ btnGenGua: btnName }, ()=>{ this.randomGua(false); });
			});
			return;
		}

		this.setState({
			btnGenGua: btnName,
		}, ()=>{
			this.randomGua(stopAct);
		});

	}

	genYao(idx){
		let btnDisabled = this.state.btnDisabled;
		let btnName = this.state.btnName;
		let sz = btnDisabled.length;
		let stopAct = false;
		for(let i=0; i<sz; i++){
			let act = btnName[i].substr(0, 2);
			if(act === '停止'){
				stopAct = true;
				break;
			}
		}
		if(!stopAct){
			// [G3] 与整卦随机同守卫(启动侧才拦;停止恒放行)
			this.confirmRandomThen(()=>{ this.genYaoRun(idx); });
			return;
		}
		this.genYaoRun(idx);
	}

	genYaoRun(idx){
		let btnDisabled = this.state.btnDisabled;
		let btnName = this.state.btnName;
		let sz = btnDisabled.length;
		let stopAct = false;
		for(let i=0; i<sz; i++){
			let act = btnName[i].substr(0, 2);
			if(act === '停止'){
				stopAct = true;
				break;
			}
		}

		let str = btnName[idx].substr(2);
		if(stopAct){
			btnName[idx] = '随机' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = false;
			}
		}else{
			btnName[idx] = '停止' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = true;
			}
			btnDisabled[idx] = false;
		}

		this.setState({
			btnDisabled: btnDisabled,
			btnName: btnName,
		}, ()=>{
			this.randomYao(idx, stopAct);
		});
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
				this._after23BoundaryUserOverrode = true;
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
			// v2.2.1: 时柱开关同款局部覆盖 — 同时设本地 flag 和 dva 中央 flag
			if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
				this._lateZiHourUserOverrode = true;
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
			let flds = {
				fields: {
					...this.props.fields,
					...field,
				}
			};

			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds.fields
			});

			// [R3-A2] __stepHint 只供 fetchByFields 消费;时间卦派生走净化副本(防瞬态键入卦链)
			let nextFields = flds.fields;
			if(Object.prototype.hasOwnProperty.call(nextFields, '__stepHint')){
				const { __stepHint, ...cleanFields } = nextFields;
				nextFields = cleanFields;
			}
			this.onTimeGeoChanged(nextFields);
		}
	}

	genGua8Doms(){
		let doms = Gua8.map((item, idx)=>{
			return (
				<Option key={idx} value={idx}>{item.name+item.elem}</Option>
			);
		});
		return doms;
	}

	getDongYaos(){
		let values = [];
		for(let i=0; i<this.state.yao.length; i++){
			let obj = this.state.yao[i];
			if(obj.change){
				values.push(i);
			}
		}
		return values;
	}

	downGuaIdxChanged(val){
		this.setState({
			downGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});
	}

	upGuaIdxChanged(val){
		this.setState({
			upGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});		
	}

	custGuaDongYaoChanged(val){
		this.setState({
			custGuaDongYao: val,
		}, ()=>{
			this.clickCustGua();
		});		
	}

	numGuaDongYaoChanged(val){
		this.setState({
			numGuaDongYao: val,
		}, ()=>{
			this.clickNumGua();
		});		
	}

	numberChanged(val){
		this.setState({
			number: val,
		});
	}

	dongyaoChanged(checkedValues){
		let completGua = true;
		let yao = this.state.yao;
		for(let i=0; i<yao.length; i++){
			let obj = yao[i];
			if(obj.value < 0){
				completGua = false;
				break;
			}
		}
		if(completGua){
			for(let i=0; i<yao.length; i++){
				yao[i].change = false;
			}
			for(let i=0; i<checkedValues.length; i++){
				let val = checkedValues[i];
				yao[val].change = true;
			}
			this.setState({
				yao: yao,
			}, ()=>{
				this.requestGuaDesc();
			});
		}
	}

	fillYaoGods(yao){
		let nongli = this.state.nongli;
		if(nongli === undefined || nongli === null){
			return yao;
		}
		let daygan = nongli.dayGanZi.substr(0, 1);
		let gods = SixGods[daygan];
		let len = gods.length;
		for(let i=0; i<len; i++){
			yao[i].god = gods[i];
		}
		return yao;
	}


	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 详 wrapperPropsEqual;开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲
	// (setState 恒换引用)。收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}
	// [G10] 改爻快捷键:数字 1-6 翻对应爻动/静(走既有 dongyaoChanged 链)。
	// 守卫:开关开+无修饰键+焦点不在输入类控件(input/textarea/select/富文本)。
	handleYaoHotkey = (e) => {
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		if(!s.yaoHotkeys){ return; }
		if(e.ctrlKey || e.metaKey || e.altKey){ return; }
		const t = e.target;
		const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
		if(tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)){ return; }
		const n = parseInt(e.key, 10);
		if(!(n >= 1 && n <= 6)){ return; }
		const idx = n - 1;
		const cur = [];
		(this.state.yao || []).forEach((y, i)=>{ if(y && y.change){ cur.push(i); } });
		const next = cur.indexOf(idx) >= 0 ? cur.filter((i)=>i !== idx) : cur.concat([idx]);
		this.dongyaoChanged(next);
	};

	componentDidMount(){
		window.addEventListener('keydown', this.handleYaoHotkey);
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新计算
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		this.restoreFromCurrentCase(true);
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				if(this._after23BoundaryUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.onTimeGeoChanged(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(this._lateZiHourUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.onTimeGeoChanged(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 主题(亮↔暗)切换:爻的 .color 存的是取盘时的 AstroColor.Stroke(随主题的墨色)。切主题后不刷 → 爻线用旧墨色
		// (如暗色墨落在亮底上看不清,且与六亲名的新墨色对不上,用户实测「爻颜色切换后不对」)。观察属性,变则刷成当前墨色。
		if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement){
			this._themeObs = new MutationObserver(() => {
				if(this.unmounted){ return; }
				this.setState((prev) => ({ yao: (prev.yao || []).map((y) => (y && y.value >= 0 ? { ...y, color: this.getYaoColor() } : y)) }));
			});
			this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		}
		// WP-6:预热《断易天机》断语库(异步 chunk),使 AI 快照同步路径(zhanleiLines 有界摘要)能取到缓存。
		import('../gua/data/liuyaoDoctrineCache').then((m) => { if(m && m.loadDoctrine){ m.loadDoctrine(); } }).catch(() => {});
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的卦即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'guazhan'){
			return;
		}
		let text = '';
		try{
			text = `${buildGuaSnapshotText(this.props.fields, this.state) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('guazhan', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	componentDidUpdate(prevProps, prevState){
		this.restoreFromCurrentCase();
		if(prevProps.fields !== this.props.fields
			|| prevState.currentGua !== this.state.currentGua
			|| prevState.yao !== this.state.yao
			|| prevState.nongli !== this.state.nongli
			|| prevState.guaDesc !== this.state.guaDesc
			|| prevState.liuyaoSettings !== this.state.liuyaoSettings){
			const fields = this.props.fields;
		const state = this.state;
		saveModuleAISnapshotLazy('guazhan', ()=>buildGuaSnapshotText(fields, state));
		// [D1-sidecar] 结构化真值随载示例:analyzeLiuyao 产物即引擎真值(断诀/应期/环境三层),
		// 供 GT builder/事实核对优先消费(缺则回落文本解析,零回归)。
		try{
			const _sgt = buildSnapshotAnalysis(state);
			// [D1-sidecar] 结构化真值侧车:读端=loadModuleStructuredGT('guazhan-gt')(GT/事实核对渐进增强预留,
			// 契约见 moduleAiSnapshot.js;键在技法别名域外,绝不会被当正文挂载)。
			if(_sgt){ saveModuleAISnapshot('guazhan-gt', JSON.stringify({ ok: 1 }), { structuredGT: { keyFactors: { env: _sgt.env || null, shiShen: _sgt.shiShen || null } } }); }
		}catch(_){ /* sidecar 失败不影响主快照 */ }
		if(prevState.liuyaoSettings !== this.state.liuyaoSettings){ persistLiuyaoSettings(this.state.liuyaoSettings); }
		}
	}

	componentWillUnmount(){
		window.removeEventListener('keydown', this.handleYaoHotkey);
		this.unmounted = true;
		// 摇卦/周期动画 interval:用户在动画态直接切走技法时这里是唯一的清理出口,
		// 不清则 interval 持续 setState 打已卸载组件(告警刷屏+闭包持组件泄漏)。
		if(this.guaPeriodTask !== null){
			clearInterval(this.guaPeriodTask);
			this.guaPeriodTask = null;
		}
		if(this.periodTask !== null){
			clearInterval(this.periodTask);
			this.periodTask = null;
		}
		if(this._themeObs){ this._themeObs.disconnect(); this._themeObs = null; }
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

	async clickSaveCase(){
		if(this.state.currentGua === null){
			message.warning('请先完成起卦后再保存');
			return;
		}
		const flds = this.props.fields;
		if(!flds){
			return;
		}
		// [断语确定性] 保存前 await 断语库加载并即时重建快照:mount 预热是 fire-and-forget,
		// 快操作(起卦即存)时同步 getDoctrine() 会取到空缓存 → [占类断语] 掉断语。此处确保就绪后再取。
		try{ const _m = await import('../gua/data/liuyaoDoctrineCache'); if(_m && _m.loadDoctrine){ await _m.loadDoctrine(); } }catch(_){ /* 断语加载失败不阻断保存 */ }
		if(this.unmounted){ return; }
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		let snapshot;
		try{ snapshot = buildGuaSnapshotText(flds, this.state); saveModuleAISnapshot('guazhan', snapshot); }
		catch(_){ snapshot = loadModuleAISnapshot('guazhan'); }
		const guaState = {
			currentGua: this.state.currentGua,
			yao: this.state.yao,
			nongli: this.state.nongli,
			guaDesc: this.state.guaDesc,
			custGuaDongYao: this.state.custGuaDongYao,
			numGuaDongYao: this.state.numGuaDongYao,
			upGuaIdx: this.state.upGuaIdx,
			downGuaIdx: this.state.downGuaIdx,
			number: this.state.number,
			guaOrigin: this.state.guaOrigin || 'time',
			liuyaoSettings: normalizeLiuyaoSettings(this.state.liuyaoSettings),
		};
		const payload = {
			module: 'guazhan',
			version: 2,
			savedAt: new Date().toISOString(),
			snapshot: snapshot,
			gua: guaState,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `六爻占断 ${divTime}`,
						caseType: 'liuyao',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						// [X1] 性别影响取用神(占婚男取妻财/女取官鬼),快照头已随之 —— record 不存则载入回落全局值致用神错位。
						gender: flds.gender && (flds.gender.value === 0 || flds.gender.value === 1) ? flds.gender.value : null,
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: 'guazhan',
					},
				},
			});
		}
	}

	renderInputPanel(opts, upopts, downopts, dyvalues){
		return (
			<div className="horosa-guazhan-input-stack">
				<div>
					<div className="horosa-side-panel-title">六爻设置</div>
					<div className="horosa-side-panel-subtitle">时间、地点与起卦方式</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<div className="horosa-guazhan-time-control">
						<GuaZhanInput
							fields={this.props.fields}
							hook={this.timeHook}
							onFieldsChange={this.onFieldsChange}
						/>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="卦象与动爻" storageKey="guazhan.s1" className="horosa-guazhan-input-section">
					<Select
						allowClear={true}
						showSearch={true}
						showArrow={true}
						placeholder='64卦'
						filterOption={this.filterGua}
						value={this.state.currentGua}
						onChange={this.changeGua}
					>
						{opts}
					</Select>
					<Checkbox.Group className="horosa-guazhan-yao-checks" onChange={this.dongyaoChanged} value={dyvalues}>
						<Checkbox value={0}>初爻动</Checkbox>
						<Checkbox value={1}>二爻动</Checkbox>
						<Checkbox value={2}>三爻动</Checkbox>
						<Checkbox value={3}>四爻动</Checkbox>
						<Checkbox value={4}>五爻动</Checkbox>
						<Checkbox value={5}>上爻动</Checkbox>
					</Checkbox.Group>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="快捷起卦" storageKey="guazhan.s2" className="horosa-guazhan-input-section">
					<div className="horosa-guazhan-action-grid">
						<Button onClick={()=>{this.clickTimeGua()}}>时间起卦</Button>
						<Button onClick={this.genGua}>{this.state.btnGenGua}</Button>
						<Button onClick={this.clickYarrowGua}>蓍草起卦</Button>
						{this.state.btnName.map((name, idx)=>(
							<Button key={idx} disabled={this.state.btnDisabled[idx]} onClick={()=>{this.genYao(idx);}}>{name}</Button>
						))}
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="自定义起卦" storageKey="guazhan.s4" className="horosa-guazhan-input-section">
					<div className="horosa-guazhan-select-grid">
						<label className="horosa-guazhan-select-field">
							<span>上卦</span>
							<Select dropdownMatchSelectWidth={false} allowClear={true} value={this.state.upGuaIdx} onChange={this.upGuaIdxChanged}>
								{upopts}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>下卦</span>
							<Select dropdownMatchSelectWidth={false} allowClear={true} value={this.state.downGuaIdx} onChange={this.downGuaIdxChanged}>
								{downopts}
							</Select>
						</label>
					</div>
					<Select dropdownMatchSelectWidth={false} onChange={this.custGuaDongYaoChanged} value={this.state.custGuaDongYao}>
						<Option value={-3}>先天卦数直接决定动爻</Option>
						<Option value={-2}>附加一个随机数决定动爻</Option>
						<Option value={-1}>附加时辰决定动爻</Option>
						<Option value={0}>第一动爻</Option>
						<Option value={1}>第二动爻</Option>
						<Option value={2}>第三动爻</Option>
						<Option value={3}>第四动爻</Option>
						<Option value={4}>第五动爻</Option>
						<Option value={5}>第六动爻</Option>
					</Select>
					<Button onClick={this.clickCustGua}>自定义起卦</Button>
				</XQSideSection>

				<LiuYaoCastPad coinFace={normalizeLiuyaoSettings(this.state.liuyaoSettings).coinFace} defaultYaoState={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState} key={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState} onCast={this.onManualCast}
					numGuaSlot={(<>
						<div className="horosa-guazhan-inline-row">
							<InputNumber value={this.state.number} onChange={this.numberChanged} min={0} />
							<Button onClick={this.clickNumGua}>数字起卦</Button>
						</div>
						<Select dropdownMatchSelectWidth={false} onChange={this.numGuaDongYaoChanged} value={this.state.numGuaDongYao}>
							<Option value={-3}>数字直接决定动爻</Option>
							<Option value={-2}>附加一个随机数决定动爻</Option>
							<Option value={-1}>附加时辰决定动爻</Option>
							<Option value={0}>第一动爻</Option>
							<Option value={1}>第二动爻</Option>
							<Option value={2}>第三动爻</Option>
							<Option value={3}>第四动爻</Option>
							<Option value={4}>第五动爻</Option>
							<Option value={5}>第六动爻</Option>
						</Select>
					</>)}
				/>
				{this.renderLiuyaoSettings()}

				<div className="horosa-guazhan-action-row">
					<Button onClick={this.clickSaveCase}>保存</Button>
				</div>
			</div>
		);
	}

	renderLiuyaoSettings(){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const schoolVal = s.school;
		const schoolOpts = LIUYAO_SCHOOL_OPTIONS.slice();
		if(schoolVal === 'custom'){ schoolOpts.push({ value: 'custom', label: '自定义' }); }
		const sel = (label, key, opts, extra) => (
			<label className="horosa-guazhan-select-field" key={key} title={extra && extra.title ? extra.title : undefined}>
				<span>{label}</span>
				<Select dropdownMatchSelectWidth={false} value={s[key]} onChange={(v)=>this.changeLiuyaoOption(key, v)} disabled={!!(extra && extra.disabled)}>
					{opts.map((o)=>(<Option key={String(o.v)} value={o.v}>{o.l}</Option>))}
				</Select>
			</label>
		);
		// [L·断卦设置重排] 三分组:①流派与用神 ②显示项(九勾选,神煞归入独立弹窗按钮)③流派取法(细则下拉)。
		const shenshaOn = !!(s.shensha && s.shensha.on);
		const shenshaExOn = !!(s.shenshaEx && s.shenshaEx.on);
		const shenshaCnt = shenshaOn ? (s.shensha.set || []).length : 0;
		return (
			<>
			<XQSideSection iconName={sideSectionIcon('school')} title="断卦设置(流派)" storageKey="guazhan.s5" className="horosa-guazhan-input-section">
				<div className="horosa-guazhan-set-group">
					<div className="horosa-guazhan-set-subhead">流派取法</div>
					<div className="horosa-guazhan-select-grid">
						<label className="horosa-guazhan-select-field">
							<span>流派</span>
							<Select dropdownMatchSelectWidth={false} value={schoolVal} onChange={(v)=>this.changeLiuyaoPreset(v === 'custom' ? s.school : v)}>
								{schoolOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>占测事项</span>
							<Select dropdownMatchSelectWidth={false} value={s.askType} onChange={(v)=>this.changeLiuyaoOption('askType', v)} showSearch optionFilterProp="children">
								{YONGSHEN_CATEGORIES.map((c)=>(<Option key={c.key} value={c.key}>{c.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>用神(手选)</span>
							<Select dropdownMatchSelectWidth={false} value={s.yongOverride || ''} onChange={(v)=>this.changeLiuyaoOption('yongOverride', v)}>
								<Option value="">自动(跟占测事项)</Option>
								{['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].map((k)=>(<Option key={k} value={k}>{k}</Option>))}
							</Select>
						</label>
						{sel('土长生', 'tuChangsheng', [{ v: 'water', l: '水土同宫' }, { v: 'fire', l: '火土同宫' }, { v: 'off', l: '不标长生' }])}
						{sel('变爻范围', 'bianyaoScope', [{ v: 'traditional', l: '传统(回头本位)' }, { v: 'blind', l: '盲派(作用他爻)' }])}
						{sel('飞伏', 'fushen', [{ v: 'missing', l: '仅缺用神取' }, { v: 'all', l: '逐爻全标' }])}
						{sel('月破', 'yuepoMode', [{ v: 'inMonth', l: '当月有效' }, { v: 'always', l: '不论出月' }])}
						{sel('世身', 'shishen', [{ v: 'off', l: '不用' }, { v: 'standard', l: '子午持世身居初' }, { v: 'lichunfeng', l: '亥子持世身居初' }])}
						{sel('贵人歌诀', 'guirenFa', [{ v: 'standard', l: '甲戊庚牛羊(庚丑未)' }, { v: 'geng_ma_hu', l: '庚辛逢马虎(庚寅午)' }])}
						{/* [审计 2026-08-08] 结构性空载置灰:64 卦×全部动爻组合(含多爻齐动)枚举,纳甲动变不存在
						    戌↔丑 本变对 → 两口径输出恒同(金标 liuyaoOptionMatrixAudit 锁事实;若未来体系引入该
						    载荷,金标红了再解除置灰)。照 PlanetSelector/八字流派标记「置灰+说明」先例。 */}
						{sel('进退神土路', 'jinTuiTu', [{ v: 'chain', l: '丑辰未戌连环' }, { v: 'break', l: '戌丑断开' }],
							{ disabled: true, title: '考据声明项:纳甲动变结构中不存在戌↔丑的本变对,两口径在一切实卦中输出恒同,故置灰。详见帮助。' })}
						{sel('长生用法', 'changshengUse', [{ v: 'full12', l: '十二宫全用' }, { v: 'four', l: '只取生旺墓绝' }])}
						{sel('天时占法', 'tianshiSchool', [{ v: 'fumu', l: '通行(父母雨子孙晴)' }, { v: 'ancient', l: '古法多套(五家分列)' }])}
						{sel('生旺墓阴阳', 'changshengYinYang', [{ v: 'ziping', l: '分阴阳' }, { v: 'classic', l: '古法不分' }])}
						{sel('字背口径', 'coinFace', [{ v: 'standard', l: '背为阳(火珠林系)' }, { v: 'alt', l: '字为阳(卜筮正宗系)' }])}
						{sel('随机概率源', 'randomAlgo', [{ v: 'coins', l: '三钱(动爻各1/8)' }, { v: 'yarrow', l: '大衍蓍草(3/16·1/16)' }])}
						{sel('录入默认爻', 'defaultYaoState', [{ v: 'shaoyang', l: '少阳' }, { v: 'shaoyin', l: '少阴' }])}
						{sel('变卦装法', 'biangua', [{ v: 'movingOnly', l: '仅装变爻' }, { v: 'full', l: '全装变卦' }])}
						{sel('定年界线', 'yearBoundary', [{ v: 'lichun', l: '立春换岁' }, { v: 'lunar', l: '正月初一' }])}
						{sel('书写方向', 'writeDir', [{ v: 'bottomUp', l: '上爻在上' }, { v: 'topDown', l: '初爻在上' }])}
						{sel('盘顶信息对齐', 'titleAlign', [{ v: 'center', l: '居中' }, { v: 'right', l: '靠右' }])}
						{sel('本命(年支)', 'benming', [{ v: '', l: '不用' }].concat(ZiList.map((z)=>({ v: z, l: z }))))}
					</div>
				</div>

				<div className="horosa-guazhan-set-group">
					<div className="horosa-guazhan-set-subhead">显示项</div>
					<div className="horosa-guazhan-toggle-grid">
						<Checkbox checked={s.guashen} onChange={(e)=>this.changeLiuyaoOption('guashen', e.target.checked)}>卦身</Checkbox>
						<Checkbox checked={s.sixGods} onChange={(e)=>this.changeLiuyaoOption('sixGods', e.target.checked)}>六神</Checkbox>
						<Checkbox checked={s.yuqi} onChange={(e)=>this.changeLiuyaoOption('yuqi', e.target.checked)}>余气</Checkbox>
						<Checkbox checked={s.doctrine} onChange={(e)=>this.changeLiuyaoOption('doctrine', e.target.checked)}>断诀</Checkbox>
						<Checkbox checked={s.yingqi} onChange={(e)=>this.changeLiuyaoOption('yingqi', e.target.checked)}>应期</Checkbox>
					</div>
					<div className="horosa-guazhan-toggle-grid horosa-guazhan-toggle-grid-2">
						<Checkbox checked={s.yueLiushen} onChange={(e)=>this.changeLiuyaoOption('yueLiushen', e.target.checked)}>月建六神</Checkbox>
						<Checkbox checked={s.gufa} onChange={(e)=>this.changeLiuyaoOption('gufa', e.target.checked)}>古法进阶</Checkbox>
						<Checkbox checked={s.randomConfirm} onChange={(e)=>this.changeLiuyaoOption('randomConfirm', e.target.checked)}>随机前确认</Checkbox>
						<Checkbox checked={s.wangShuaiCol !== false} onChange={(e)=>this.changeLiuyaoOption('wangShuaiCol', e.target.checked)}>旺衰列</Checkbox>
						<Checkbox checked={s.showTips !== false} onChange={(e)=>this.changeLiuyaoOption('showTips', e.target.checked)}>悬停提示</Checkbox>
						<Checkbox checked={s.bianguaSimplify} onChange={(e)=>this.changeLiuyaoOption('bianguaSimplify', e.target.checked)}>之卦简显</Checkbox>
						<Checkbox checked={s.yaoHotkeys} onChange={(e)=>this.changeLiuyaoOption('yaoHotkeys', e.target.checked)}>改爻快捷键(1-6)</Checkbox>
					</div>
					<div className="horosa-guazhan-set-subhead" style={{ marginTop: 8 }}>关联卦显示</div>
					<div className="horosa-guazhan-toggle-grid">
						{[['bian', '之卦'], ['hu', '互卦'], ['fu', '伏神'], ['zong', '综卦'], ['cuo', '错卦']].map(([k, l])=>{
							const selArr = Array.isArray(s.relatedCards) ? s.relatedCards : null;
							const on = !selArr || selArr.indexOf(k) >= 0;
							return (
								<Checkbox key={k} checked={on} onChange={(e)=>{
									const all = ['bian', 'hu', 'fu', 'zong', 'cuo'];
									const cur = selArr || all.slice();
									const next = e.target.checked ? Array.from(new Set(cur.concat([k]))) : cur.filter((x)=>x !== k);
									// 全选=回 null(默认态,preset 比对不受扰)
									this.changeLiuyaoOption('relatedCards', next.length === all.length ? null : next);
								}}>{l}</Checkbox>
							);
						})}
					</div>
					<div className="horosa-guazhan-shensha-entry">
						<Button size="small" className="horosa-guazhan-shensha-btn" onClick={()=>this.setState({ shenshaModalOpen: true })}>
							<i className="xq-icon">✦</i> 神煞选项…
						</Button>
						<span className="horosa-guazhan-shensha-summary">
							{shenshaOn ? `基础神煞 · 已选 ${shenshaCnt}` : '基础神煞 · 关'}
							<em>／</em>
							{shenshaExOn ? '扩展 · 开' : '扩展 · 关'}
						</span>
					</div>
				</div>

				{LIUYAO_PRESETS[schoolVal] && LIUYAO_PRESETS[schoolVal].note ? (
					<div className="horosa-guazhan-set-note">{LIUYAO_PRESETS[schoolVal].note}</div>
				) : null}
				{/* [G9] 一键恢复出厂断卦设置(含全部新旧键;本命年支一并清空);确认后套「通用」预设并持久化 */}
				<div style={{ marginTop: 8 }}>
					<Button size="small" onClick={()=>{
						Modal.confirm({
							title: '恢复默认断卦设置?',
							content: '全部断卦设置(流派/取法/显示/神煞)将重置为出厂默认。',
							okText: '恢复默认', cancelText: '取消',
							onOk: ()=>{ this.changeLiuyaoPreset('default'); },
						});
					}}>恢复默认设置</Button>
				</div>
			</XQSideSection>
			{this.renderShenshaModal()}
			</>
		);
	}

	// [L·神煞独立弹窗] 基础神煞(SHENSHA_META)+ 扩展神煞(SHENSHA_EX∪月令) 全部集中于一个弹窗;每组配 全选/清空/恢复默认。
	renderShenshaModal(){
		if(!this.state.shenshaModalOpen){ return null; }
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const exAll = Array.from(new Set(SHENSHA_EX.map((m)=>m.name).concat(yueLingNames()))); // 起例集与月令表同名四例去重
		const baseAll = SHENSHA_META.map((m)=>m.name);
		const baseOn = !!(s.shensha && s.shensha.on);
		const exOn = !!(s.shenshaEx && s.shenshaEx.on);
		const setBase = (set)=>this.changeLiuyaoOption('shensha', { set });
		const setEx = (set)=>this.changeLiuyaoOption('shenshaEx', { set });
		const tool = (fn, label, disabled)=>(
			<span className={`horosa-guazhan-shensha-tool${disabled ? ' is-disabled' : ''}`}
				onClick={disabled ? undefined : fn}>{label}</span>
		);
		return (
			<XQModal visible title="神煞选项" width={640} footer={null} className="horosa-guazhan-shensha-modal"
				bodyStyle={{ maxHeight: '68vh', overflowY: 'auto' }}
				onCancel={()=>this.setState({ shenshaModalOpen: false })}>
				<div className="horosa-guazhan-shensha-block">
					<div className="horosa-guazhan-shensha-head">
						<Checkbox checked={baseOn} onChange={(e)=>this.changeLiuyaoOption('shensha', { on: e.target.checked })}><strong>基础神煞</strong></Checkbox>
						<span className="horosa-guazhan-shensha-tools">
							{tool(()=>setBase(baseAll.slice()), '全选', !baseOn)}
							{tool(()=>setBase([]), '清空', !baseOn)}
							{tool(()=>setBase(DEFAULT_SHENSHA_SET.slice()), '恢复默认', !baseOn)}
						</span>
					</div>
					<Checkbox.Group value={s.shensha.set} disabled={!baseOn}
						options={SHENSHA_META.map((m)=>({ label: m.name, value: m.name }))}
						onChange={setBase} className="horosa-guazhan-yao-checks" />
					<label className="horosa-guazhan-select-field horosa-guazhan-shensha-base">
						<span>神煞起例</span>
						<Select dropdownMatchSelectWidth={false} disabled={!baseOn} value={s.shensha.base} onChange={(v)=>this.changeLiuyaoOption('shensha', { base: v })}>
							<Option value="day">以日干支起</Option>
							<Option value="year">以年干支起</Option>
						</Select>
					</label>
				</div>
				<div className="horosa-guazhan-shensha-block">
					<div className="horosa-guazhan-shensha-head">
						<Checkbox checked={exOn} onChange={(e)=>this.changeLiuyaoOption('shenshaEx', { on: e.target.checked })}><strong>扩展神煞</strong></Checkbox>
						<span className="horosa-guazhan-shensha-tools">
							{tool(()=>setEx(exAll.slice()), '全选', !exOn)}
							{tool(()=>setEx([]), '清空', !exOn)}
							{tool(()=>setEx(null), '恢复默认', !exOn)}
						</span>
					</div>
					<div className="horosa-guazhan-shensha-hint">默认全选;取消勾选即剔除。</div>
					<Checkbox.Group value={s.shenshaEx.set || exAll} disabled={!exOn}
						options={exAll.map((n)=>({ label: n, value: n }))}
						onChange={setEx} className="horosa-guazhan-yao-checks" />
				</div>
			</XQModal>
		);
	}

	renderInfoRows(){
		const fields = this.props.fields || {};
		const nongli = this.state.nongli || {};
		const gua = this.state.currentGua !== null && Gua64[this.state.currentGua] ? Gua64[this.state.currentGua] : null;
		const dyvalues = this.getDongYaos();
		const fieldTime = fields.date && fields.time
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
			: '—';
		const geo = fields.lon && fields.lat ? `${fields.lon.value} ${fields.lat.value}` : '—';
		const gz = [nongli.yearJieqi || nongli.year || nongli.yearGanZi, nongli.monthGanZi, nongli.dayGanZi, nongli.time || nongli.timeGanZi]
			.filter(Boolean)
			.join(' / ');

		return [
			['起卦时间', fieldTime],
			['地点', geo],
			['干支', gz || '—'],
			['当前本卦', gua ? guaText(gua) : '未生成'],
			['动爻', dyvalues.length ? dyvalues.map(idx=>`第${idx + 1}爻`).join('、') : '无'],
			['数字', this.state.number !== null && this.state.number !== undefined && this.state.number !== '' ? this.state.number : '—'],
		].map(([label, value])=>(
			<div className="horosa-guazhan-info-row" key={label}>
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
		));
	}

	getDuanJueCtx(){
		const n = this.state.nongli || {};
		const d = `${n.dayGanZi || ''}`;
		return { dayGan: d[0] || '', dayZhi: d[1] || '' };
	}

	renderRightPanel(height, guadesc){
		const infoHeight = Math.max(420, height - 170);
		const allowed = ['overview', 'zhuang', 'duanjue', 'zhanlei', 'ref', 'gua'];
		const activeKey = allowed.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		const analysis = this.getLiuyaoAnalysis();
		const movingSet = new Set();
		(this.state.yao || []).forEach((y, i)=>{ if(y && y.change){ movingSet.add(i + 1); } });
		const scrollStyle = { maxHeight: infoHeight, overflowY: 'auto', paddingRight: 4 };
		const muted = { color: 'var(--horosa-astro-muted, #928b82)', fontSize: 13 };
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-guazhan-tabs">
				{/* horosa_freeze_subtabs_v1:右栏 6 个子面板此前全内联 —— 首次激活后永久挂载,
				    之后每次改时间/点爻/切流派都把另外 5 个看不见的面板(装卦大表、断诀、占类、
				    参考典籍)一并 reconcile。函数式 children:未激活过的面板连元素都不建;
				    已激活过的切回时拿本轮最新 analysis 立即渲一帧,不卸载、不重取、不丢滚动位置。 */}
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? <LiuYaoXunKong analysis={analysis} /> : null}
						{this.renderInfoRows()}
						{analysis ? (
							<div style={{ marginTop: 12 }}>
								<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '4px 0 6px' }}>用神 · 原忌仇</div>
								<LiuYaoYongShenView analysis={analysis} />
								{/* [典籍补齐] 世应关系/卦变吉凶/动态四态/间爻 提到概览显要位置 */}
								<div style={{ marginTop: 12 }}><LiuYaoManualCards analysis={analysis} /></div>
								<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '12px 0 6px' }}>动变</div>
								<LiuYaoDongBianView analysis={analysis} />
								{/* [F1] 日辰月建引动/扩展神煞/月建六神 概览与断诀同源(受各自开关 gating) */}
								<div style={{ marginTop: 12 }}>
									<LiuYaoRiYueView analysis={analysis} />
									<LiuYaoShenShaExView analysis={analysis} />
									<LiuYaoYueLiuShenView analysis={analysis} />
								</div>
								{analysis.shenSha ? (
									<div>
										<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '12px 0 6px' }}>神煞</div>
										<LiuYaoShenShaView analysis={analysis} />
									</div>
								) : null}
							</div>
						) : null}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="装卦" key="zhuang">
					<FreezeSubTab active={activeKey === 'zhuang'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? (<div><LiuYaoZhuangTable analysis={analysis} movingSet={movingSet} hideXunKong /><LiuYaoRelatedCards analysis={analysis} /></div>) : <div style={muted}>请先起卦。</div>}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="断诀" key="duanjue">
					<FreezeSubTab active={activeKey === 'duanjue'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? <LiuYaoDuanJueView analysis={analysis} ctx={this.getDuanJueCtx()} /> : <div style={muted}>请先起卦。</div>}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="占类" key="zhanlei">
					<FreezeSubTab active={activeKey === 'zhanlei'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						<LiuYaoZhanLeiView analysis={analysis} currentGuaName={this.state.currentGua !== null && Gua64[this.state.currentGua] ? Gua64[this.state.currentGua].name : ''} castLines={(this.state.yao || []).map((y)=>y && y.value)} />
						{/* 天时(晴雨)本就是一个占类 —— 「天时占法」设为古法档时在此列出各家判据;
						    通行档(父母主雨/子孙晴)时 analysis.tianshi 为 null,该卡自身返回 null 不占位。 */}
						<LiuYaoTianshiView analysis={analysis} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="参考" key="ref">
					<FreezeSubTab active={activeKey === 'ref'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						<LiuYaoReference analysis={analysis} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="卦辞" key="gua">
					<FreezeSubTab active={activeKey === 'gua'}>{()=>(
					<div className="horosa-guazhan-desc-panel">
						<GuaDesc height={infoHeight} value={guadesc} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:起卦动词=本页主键群(主键豁免——左栏长表单下会滚出视野);概览/卦辞=右栏
	// tab 镜像,撤。蓍草为第五种起卦收进 extras;「再摇一卦」语义比「随机卦」更贴复摇场景。
	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="guazhan"
				className="horosa-guazhan-quick-dock"
				hasResult={this.isGuaComplete()}
				primary={[
					{ key: 'timeGua', label: '时间卦', onClick: ()=>this.clickTimeGua() },
					{ key: 'redoGua', label: '再摇一卦', icon: 'quickFirdaria', onClick: this.genGua },
					{ key: 'numGua', label: '数字卦', icon: 'quickProfection', onClick: this.clickNumGua },
					{ key: 'custGua', label: '自定义', icon: 'quickReturn', onClick: this.clickCustGua },
				]}
				extras={[
					{ key: 'yarrowGua', label: '蓍草起卦', icon: 'quickTransit', needsResult: false, onClick: this.clickYarrowGua },
				]}
				save={this.clickSaveCase}
				dispatch={this.props.dispatch}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760
		}else{
			height = height - 20
		}

		let chartObj = this.props.value;
		let chart = chartObj ? chartObj.chart : {};

		// 中栏 d3 的六神随「六神」开关:关则剥离 god → 中盘不画六神(令中盘也随设置变)
		const _liuSet = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		let chartYao = this.fillYaoGods(this.state.yao);
		if(!_liuSet.sixGods && Array.isArray(chartYao)){ chartYao = chartYao.map((y)=>({ ...y, god: null })); }

		let opts = this.genGua64OptDom();

		let upopts = this.genGua8Doms();
		let downopts = this.genGua8Doms();

		let dyvalues = this.getDongYaos();
		let yao = this.fillYaoGods(this.state.yao);

		let guadesc = this.state.guaDesc;

		return (
			<div className="horosa-guazhan-page horosa-astro-redesign horosa-guazhan-redesign" style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-guazhan-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-guazhan-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-guazhan-input-panel">
							{this.renderInputPanel(opts, upopts, downopts, dyvalues)}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-guazhan-chart-panel xq-chart-renderer xq-chart-renderer-liuyao">
							{/* 流派/卦序/用神/卦身 已并入中栏盘内标题(GZChart.drawTitle),移除左侧冗余浮层 */}
							<div className="horosa-guazhan-board-host">
						<GuaZhanChart
							value={chart} 
									height={Math.max(560, height - 22)}
							fields={this.props.fields}  
							nongli={this.state.nongli}
							yao={chartYao} analysis={this.getLiuyaoAnalysis()}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
						/>
						</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-guazhan-info-panel">
							<div className="horosa-side-panel-heading horosa-guazhan-info-heading">
								<div>
									<div className="horosa-side-panel-title">六爻信息</div>
									<div className="horosa-side-panel-subtitle">概览与卦辞</div>
								</div>
							</div>
							{this.renderRightPanel(height, guadesc)}
						</div>
					</div>
					{this.renderBottomQuickDock()}
				</div>
			</div>

		);
	}
}

export default GuaZhanMain;
