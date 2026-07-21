import { Component } from 'react';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, message } from 'antd';
import { XQButton as Button, XQModal as Modal, XQTabs as Tabs } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { createSignatureMemo, stableSignature } from '../../utils/memoBySignature';
import {randomStr,} from '../../utils/helper';
import ZiWeiInput from './ZiWeiInput';
import ZiWeiChart from './ZiWeiChart';
import ZWRuleMain from '../ruleziwei/ZWRuleMain';
import ZWLuckPanel, {
	buildDaxianItems,
	buildLiunianItems,
	buildXiaoxianItems,
	buildLiuyueItems,
	buildLiuriItems,
	buildLiushiItems,
	houseName as luckHouseName,
	houseIdxByBranch as luckHouseIdxByBranch,
	emptyLuckSel,
	luckSelectDaxian,
	luckSelectLiunian,
} from './ZWLuckPanel';
import QuickDockBar from '../common/QuickDockBar';
import ZWPatternPanel from './ZWPatternPanel';
import TipsBoard from '../comp/TipsBoard';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as ZWText from '../../constants/ZWText';
import * as ZWConst from '../../constants/ZWConst';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ziweirulesCached } from '../../services/rules';
import { cachedPost } from '../../services/_requestCache';
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { calcZiwei, deriveSanPan } from './ZiweiCalc';
import { detectPatterns } from './ziweiPatterns';
import { ZWEngineOptions, ziweiNeedsLocalEngine } from './ziweiOptions';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';

const TabPane = Tabs.TabPane;

function normalizeGan(value){
	if(!value){
		return '';
	}
	return `${value}`.trim().charAt(0);
}

function pickYearGan(chart){
	if(!chart){
		return '';
	}
	if(chart.yearGan){
		return normalizeGan(chart.yearGan);
	}
	if(chart.nongli && chart.nongli.yearGanZi){
		return normalizeGan(chart.nongli.yearGanZi);
	}
	if(chart.nongli && chart.nongli.year){
		return normalizeGan(chart.nongli.year);
	}
	return '';
}

function collectHouseStars(house){
	const groups = [
		'starsMain',
		'starsAssist',
		'starsEvil',
		'starsOthersGood',
		'starsOthersBad',
		'starsSmall',
		'stars',
	];
	const out = [];
	const seen = new Set();
	groups.forEach((key)=>{
		const arr = house && house[key] ? house[key] : [];
		arr.forEach((item)=>{
			let name = '';
			if(typeof item === 'string'){
				name = item;
			}else{
				name = item && (item.name || item.id) ? (item.name || item.id) : '';
			}
			name = `${name || ''}`.trim();
			if(!name || seen.has(name)){
				return;
			}
			seen.add(name);
			out.push(name);
		});
	});
	return out;
}

function formatStarSiHua(starName, yearGan, lifeGan, palaceGan){
	const tags = [];
	if(yearGan){
		const yearHua = ZiWeiHelper.getSiHua(starName, yearGan);
		if(yearHua){
			tags.push(`生年${yearHua}`);
		}
	}
	if(lifeGan){
		const lifeHua = ZiWeiHelper.getSiHua(starName, lifeGan);
		if(lifeHua){
			tags.push(`命宫${lifeHua}`);
		}
	}
	// 宫干自化（飞星紫微核心，Mac issue #11：用户反馈挂载缺自化信息）：星曜被「所落宫位本身天干」
	// 引动的四化。用所落宫干复算，getSiHua 自动按当前流派四化表取值（与生年/命宫四化同口径）。
	if(palaceGan){
		const selfHua = ZiWeiHelper.getSiHua(starName, palaceGan);
		if(selfHua){
			tags.push(`自化${selfHua}`);
		}
	}
	if(tags.length === 0){
		return starName;
	}
	return `${starName}（${tags.join('，')}）`;
}

function getLifeHouse(chart, houses){
	if(!chart || !houses || houses.length === 0){
		return null;
	}
	if(chart.lifeHouseIndex !== undefined && chart.lifeHouseIndex !== null){
		const idx = Number(chart.lifeHouseIndex);
		if(!Number.isNaN(idx) && houses[idx]){
			return houses[idx];
		}
	}
	return houses.find((house)=>`${house.name || ''}`.includes('命')) || null;
}

const ZW_PERIOD_LEVEL_LABEL = { daxian: '大限', liunian: '流年小限', liuyue: '流月', liuri: '流日', liushi: '流时' };

// 单层运限 → 文本块（四化落宫 + 流曜 + 三方四正星情, 复用 ZiWeiHelper.getLayerSihua/getFlowStars/collectFourPalaceStars,
// 与盘面交互卡同口径）。
// 用户增量(v1.9): 末尾追加"三方四正"四宫星曜列表,让 AI 看到该时段真实的三合宫位星情,提高流年判断准度。
function formatLuckLayerLines(chart, layer, levelLabel, subText){
	const lines = [];
	const mingIdx = layer.mingIndex;
	const oppIdx = ((mingIdx % 12) + 6) % 12;
	// [v2 试点] 头行加 ◆ 子题标记:呈现层(docx/PDF)映射 Heading3;纯文本仍整行可读(substring 断言不受影响)。
	const head = `◆ ${levelLabel}：${layer.ganzi || ''}${subText ? `（${subText}）` : ''}`
		+ `，命宫【${luckHouseName(chart, mingIdx, true)}】·对宫【${luckHouseName(chart, oppIdx, true)}】`;
	lines.push(head);
	const sihua = ZiWeiHelper.getLayerSihua(chart, layer.gan) || [];
	if(sihua.length > 0){
		const parts = sihua.map((h)=>`${h.star}化${h.hua}（${luckHouseName(chart, h.houseIndex, true)}）`);
		lines.push(`四化：${parts.join('、')}`);
	}
	const flowStars = ZiWeiHelper.getFlowStars(layer.gan, layer.zhi) || [];
	if(flowStars.length > 0){
		const parts = flowStars.map((s)=>`${s.name}（${luckHouseName(chart, luckHouseIdxByBranch(chart, s.zhi), true)}）`);
		lines.push(`流曜：${parts.join('、')}`);
	}
	// 运限三合(用户修正): 仅追加运财帛宫 + 运官禄宫(本宫和对宫已在 head 行).
	// label 用"运财帛宫【原命盘宫名·干支】" 让 AI 明确"这是该段时间的财帛宫,落在原命盘 X 宫位置"
	try {
		const sanhe = ZiWeiHelper.collectSanhePalaces(chart, mingIdx);
		if(sanhe && sanhe.length === 2){
			lines.push('运限三合：');
			sanhe.forEach((p)=>{
				const starsText = (p.stars && p.stars.length) ? p.stars.join('、') : '(无主辅星)';
				const gz = p.ganZhi ? `·${p.ganZhi}` : '';
				lines.push(`  ${p.runName}【${p.palaceName}${gz}】：${starsText}`);
			});
		}
	} catch(_) { /* defensive: 缺数据时不阻塞快照 */ }
	return lines;
}

// 多选运限上限：所有层级合计段数封顶，防快照爆（超限截断 + 追加提示行）。
const ZW_PERIOD_MAX_SEGMENTS = 50;

// 找某公历年所属的大限：逐大限构造 10 流年，命中该年即返回（复用 buildLiunianItems，零新算法）。
function findDaxianForYear(chart, daxianItems, year){
	for(let i = 0; i < daxianItems.length; i++){
		const items = buildLiunianItems(chart, daxianItems[i]);
		if(items.some((x)=>x.year === year)){
			return { daxian: daxianItems[i], liunianItems: items, liunian: items.find((x)=>x.year === year) || null };
		}
	}
	return null;
}

// 按挂载所选运限层（多选）产出 [运限] 段。
// period={daxian:[mingIndex...], liunian:[year...], liuyue:[month...], liuri:[day...], liushi:[hourIdx...]}。
// 语义（用户拍板）：大限/流年/流月对所选每项各产一段（流年×流月笛卡尔）；流日/流时锚定到所选的第一个上层。
// 总段数封顶 ZW_PERIOD_MAX_SEGMENTS，超限截断并追加提示行。全空 → 不产段（上游已用 null 守现状）。
function buildZiweiPeriodLines(chart, period){
	if(!chart || !chart.houses || !period){
		return [];
	}
	const daxianItems = buildDaxianItems(chart);
	if(daxianItems.length === 0){
		return [];
	}
	const arr = (v)=>(Array.isArray(v) ? v : []);
	const daxianSel = arr(period.daxian);
	const liunianSel = arr(period.liunian);
	const liuyueSel = arr(period.liuyue);
	const liuriSel = arr(period.liuri);
	const liushiSel = arr(period.liushi);

	const body = [];
	let truncated = false;
	// 推入一段（已含层文本）；到达上限即停止后续推入并标记截断。
	const pushSeg = (segLines)=>{
		if(truncated){ return; }
		if(body.length >= ZW_PERIOD_MAX_SEGMENTS){
			truncated = true;
			return;
		}
		body.push(segLines);
	};

	// 1) 大限：每个所选宫位序各一段。
	daxianSel.forEach((mingIndex)=>{
		const dx = daxianItems.find((d)=>d.mingIndex === mingIndex);
		if(dx){
			pushSeg(formatLuckLayerLines(chart, dx, ZW_PERIOD_LEVEL_LABEL.daxian, `${dx.start}~${dx.end}岁`));
		}
	});

	// 2) 流年：每个所选公历年各一段（解析其所属大限）。
	// 坑修：所选流年超出全部大限范围 → 补提示行而非静默跳过（与八字「超出大运范围」口径对齐）。
	const inRangeYears = [];
	liunianSel.forEach((year)=>{
		const ctx = findDaxianForYear(chart, daxianItems, year);
		if(ctx && ctx.liunian){
			inRangeYears.push(year);
			{
				const seg = formatLuckLayerLines(chart, ctx.liunian, ZW_PERIOD_LEVEL_LABEL.liunian, `${ctx.liunian.year}年`);
				// 小限并入「流年小限」段(需求6B)：同年小限按虚岁对齐，作附带信息列在 head 之后。
				const xx = buildXiaoxianItems(chart, ctx.daxian).find((x)=> x.age === ctx.liunian.age);
				if(xx){
					seg.splice(1, 0, `小限：${xx.ganzi}（${xx.age}虚岁），命宫【${luckHouseName(chart, xx.mingIndex, true)}】`);
				}
				pushSeg(seg);
			}
		}else{
			pushSeg([`◆ 流年：${year}年（超出大限范围，未列流年）`]);
		}
	});

	// 流月/流日/流时所需的基准年集合：所选流年中「在大限范围内」的年（避免流年不列、流月却列的语义错位）；
	// 若未选流年，则用首个大限的首年兜底（绝不抛）。
	const baseYears = liunianSel.length
		? inRangeYears
		: [(buildLiunianItems(chart, daxianItems[0])[0] || {}).year].filter((y)=>Number.isFinite(y));

	// 3) 流月：流年 × 流月 笛卡尔——每个 (year, month) 各一段。
	if(liuyueSel.length){
		baseYears.forEach((year)=>{
			const liuyueItems = buildLiuyueItems(chart, year);
			liuyueSel.forEach((month)=>{
				const ly = liuyueItems.find((x)=>x.month === month);
				if(ly){
					pushSeg(formatLuckLayerLines(chart, ly, ZW_PERIOD_LEVEL_LABEL.liuyue, `${year}年${ly.month}月`));
				}
			});
		});
	}

	// 锚定上层：流日 → 第一个 (year, month)；流时 → 第一个 (year, month, day)。
	const anchorYear = Number.isFinite(baseYears[0]) ? baseYears[0] : null;
	const anchorMonth = liuyueSel.length ? liuyueSel[0] : null;

	// 4) 流日：锚定 (anchorYear, anchorMonth)；anchorMonth 缺省取该年首月（正月）。
	if(liuriSel.length && anchorYear !== null){
		const liuyueItems = buildLiuyueItems(chart, anchorYear);
		const anchorLiuyue = anchorMonth !== null
			? (liuyueItems.find((x)=>x.month === anchorMonth) || liuyueItems[0])
			: liuyueItems[0];
		if(anchorLiuyue){
			const liuriItems = buildLiuriItems(chart, anchorYear, anchorLiuyue);
			liuriSel.forEach((day)=>{
				const lr = liuriItems.find((x)=>x.day === day);
				if(lr){
					pushSeg(formatLuckLayerLines(chart, lr, ZW_PERIOD_LEVEL_LABEL.liuri, `${anchorYear}年${anchorLiuyue.month}月${lr.day}日`));
				}
			});
		}
	}

	// 5) 流时：锚定 (anchorYear, anchorMonth, 首个所选流日/否则初一)。
	if(liushiSel.length && anchorYear !== null){
		const liuyueItems = buildLiuyueItems(chart, anchorYear);
		const anchorLiuyue = anchorMonth !== null
			? (liuyueItems.find((x)=>x.month === anchorMonth) || liuyueItems[0])
			: liuyueItems[0];
		if(anchorLiuyue){
			const liuriItems = buildLiuriItems(chart, anchorYear, anchorLiuyue);
			const anchorDay = liuriSel.length ? liuriSel[0] : null;
			const anchorLiuri = anchorDay !== null
				? (liuriItems.find((x)=>x.day === anchorDay) || liuriItems[0])
				: liuriItems[0];
			if(anchorLiuri){
				const liushiItems = buildLiushiItems(chart, anchorLiuri);
				liushiSel.forEach((hourIdx)=>{
					const ls = liushiItems[hourIdx];
					if(ls){
						pushSeg(formatLuckLayerLines(chart, ls, ZW_PERIOD_LEVEL_LABEL.liushi,
							`${anchorYear}年${anchorLiuyue.month}月${anchorLiuri.day}日`));
					}
				});
			}
		}
	}

	if(body.length === 0){
		return [];
	}
	const lines = ['[运限]'];
	body.forEach((segLines)=>{ lines.push(...segLines); });
	if(truncated){
		lines.push(`（运限段已达上限 ${ZW_PERIOD_MAX_SEGMENTS} 段，余下所选组合已省略）`);
	}
	lines.push('');
	return lines;
}

function buildZiWeiSnapshotText(params, result){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart.houses || [];
	const yearGan = pickYearGan(chart);
	const lifeHouse = getLifeHouse(chart, houses);
	const lifeGan = lifeHouse && lifeHouse.ganzi ? normalizeGan(lifeHouse.ganzi) : '';
	const lines = [];

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(`性别：${`${params.gender}` === '1' ? '男' : (`${params.gender}` === '0' ? '女' : '未知')}`);
	lines.push(`时间算法：${params.timeAlg === 1 ? '直接时间' : '真太阳时'}`);
	const schoolLabel = { beipai: '通用·飞星', zhongzhou: '中州派', quanshu: '全书系', beixiang: '北派(天相忌)', custom: '自定义' }[ZWConst.ZWSchool.school] || '通用·飞星';
	lines.push(`四化流派：${schoolLabel}`);
	// 传本/排盘开关(非默认才注记,供 AI 知悉本盘用了哪套传本)。
	const tbNotes = [];
	if(ZWEngineOptions.daxianSpan !== 10){ tbNotes.push('大限跨度=局数年(钦天)'); }
	if(ZWEngineOptions.tianmaBasis !== 'month'){ tbNotes.push('天马=年支三合马'); }
	if(ZWEngineOptions.starSet !== 'full'){ tbNotes.push('星集=精简18星(河洛)'); }
	if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ tbNotes.push(`观察盘=${ZWEngineOptions.sanPan === 'di' ? '地盘(身宫起)' : '人盘(福德起)'}`); }
	if(ZWEngineOptions.shangShi === 'yinyang'){ tbNotes.push('天伤天使=阴阳互换(中州)'); }
	if(ZWEngineOptions.leapMonth && ZWEngineOptions.leapMonth !== 'mid_split'){ tbNotes.push(`闰月=${ZWEngineOptions.leapMonth === 'next' ? '整月归下月' : '整月归上月'}`); }
	if(ZWEngineOptions.lateZi && ZWEngineOptions.lateZi !== 'zi_chu'){ tbNotes.push(`晚子时=${ZWEngineOptions.lateZi === 'midnight_split' ? '夜子折中' : '子正换日'}`); }
	if(ZWEngineOptions.yearBoundary === 'lunar_1_1'){ tbNotes.push('定年界线=正月初一'); }
	if(ZWEngineOptions.huoling === 'nanpai'){ tbNotes.push('火铃=南派(忽略生时)'); }
	if(ZWEngineOptions.kongNaming === 'book'){ tbNotes.push('空劫=天空/地劫(古本)'); }
	if(tbNotes.length){ lines.push(`传本设置：${tbNotes.join('、')}`); }
	if(yearGan){
		lines.push(`生年天干：${yearGan}`);
	}
	if(lifeHouse && lifeHouse.name){
		lines.push(`命宫：${lifeHouse.name}${lifeHouse.ganzi ? `（${lifeHouse.ganzi}）` : ''}`);
	}
	if(lifeGan){
		lines.push(`命宫天干：${lifeGan}`);
	}
	// [v2 试点·补硬缺] 左栏「基本信息/四柱」卡内容并入起盘信息(审计:显示了但快照没有)。
	// 全部 best-effort 纯增行(数据缺省不产行 → 既有夹具/挂载字节不变);同 buildZiWeiInfoData 取数口径。
	const infoBz = chart.bazi && chart.bazi.bazi ? chart.bazi.bazi : null;
	if(infoBz){
		const pillars = ['year', 'month', 'day', 'time']
			.map((k)=>(infoBz[k] && infoBz[k].ganzi ? infoBz[k].ganzi : ''))
			.filter(Boolean);
		if(pillars.length === 4){
			lines.push(`四柱：${pillars.join(' ')}`);
		}
	}
	if(chart.lifeMaster){ lines.push(`命主：${chart.lifeMaster}`); }
	if(chart.bodyMaster){ lines.push(`身主：${chart.bodyMaster}`); }
	if(chart.zidou){ lines.push(`子斗：${chart.zidou}`); }
	if(chart.doujun){ lines.push(`斗君：${chart.doujun}`); }
	const infoJu = `${ZWText.ZWMsg[chart.yearPolar] || ''}${ZWText.ZWMsg[chart.gender] || ''} ${chart.wuxingJuText || ''}`.trim();
	if(infoJu){ lines.push(`命局：${infoJu}`); }
	const infoNl = chart.nongli || {};
	if(infoNl.year){
		lines.push(`农历：${`${infoNl.year}年 ${infoNl.leap ? '闰' : ''}${infoNl.month || ''}${infoNl.day || ''}${infoNl.time ? ` ${`${infoNl.time}`.charAt(1)}时` : ''}`.trim()}`);
	}

	lines.push('');
	// [v2 试点·表化] 12 宫同构数据改 GFM 表(宫/干支/大限/星曜四列;值口径与旧键值行逐字同源:
	// name/ganzi/direction/formatStarSiHua 全复用)。表块经 v1/v2 归一器直通、docx/PDF 渲染真表。
	lines.push('[宫位总览]');
	lines.push('| 宫位 | 干支 | 大限 | 星曜（四化括注） |');
	lines.push('| --- | --- | --- | --- |');
	houses.forEach((house, idx)=>{
		const name = house.name || house.id || `宫位${idx + 1}`;
		const ganzi = house.ganzi || '';
		const palaceGan = ganzi ? normalizeGan(ganzi) : '';
		const direction = house.direction && house.direction.length === 2 ? `${house.direction[0]}~${house.direction[1]}` : '';
		const stars = collectHouseStars(house);
		const starText = stars.length > 0
			? stars.map((starName)=>formatStarSiHua(starName, yearGan, lifeGan, palaceGan)).join('、')
			: '无';
		lines.push(`| ${name} | ${ganzi || '无'} | ${direction || '无'} | ${starText} |`);
	});
	lines.push('');

	if(yearGan){
		const laiyin = houses.filter((house)=> house.ganzi && house.ganzi.charAt(0) === yearGan)
			.map((house)=> `${house.name || ''}（${house.ganzi}）`);
		if(laiyin.length > 0){
			lines.push('[来因宫]');
			lines.push(laiyin.join('、'));
			lines.push('');
		}
	}

	const patterns = result && result.patterns ? result.patterns : [];
	if(patterns.length > 0){
		lines.push('[命中格局]');
		patterns.forEach((p)=>{
			lines.push(`${p.name}（${p.category || ''}${p.broken ? '·破' : ''}）：${p.duanyi || ''}`);
		});
		lines.push('');
	}

	// 运限层（仅挂载「每技法设置」显式选了运限时追加；缺省不追加 → 快照与现状逐字一致）。
	if(params && params.period){
		const periodLines = buildZiweiPeriodLines(chart, params.period);
		if(periodLines.length > 0){
			lines.push(...periodLines);
		}
	}

	return lines.join('\n');
}

// 供 AI 分析无头复算：按出生参数取盘并生成紫微快照文本（不依赖组件挂载）。
export async function buildZiweiSnapshotForParams(params){
	if(!params){
		return '';
	}
	// 挂载「每技法设置」可指定四化流派(params.sihuaSchool)。流派由可变单例 ZWSchool.school + getActiveSiHuaGan
	// 驱动(snapshot/格局判定都读它),故须临时切换 + 用毕还原,避免污染全局现状(与 ZiWeiInput 切流派同口径)。
	const overrideSchool = params.sihuaSchool && `${params.sihuaSchool}` !== '' ? `${params.sihuaSchool}` : null;
	const prevSchool = ZWConst.ZWSchool.school;
	if(overrideSchool && overrideSchool !== prevSchool){
		ZWConst.ZWSchool.school = overrideSchool;
		ZWConst.refreshActiveSiHua();
		// P1-A 不变量:切流派必须同时失效四化缓存(getSiHua 懒初始化,不清不会按新表重建),
		// 否则快照里星曜级四化仍是旧流派、与 p.sihua 自相矛盾(ZiWeiInput.applySihuaSchool 同口径)。
		ZiWeiHelper.resetHuaMap();
	}
	// 传本/排盘开关(挂载侧 record 显式覆盖时透传):临时切可变单例 ZWEngineOptions(builder 自读它),用毕还原,
	// 避免污染用户全局现状(与 sihuaSchool 同范式)。缺省不覆盖 → 读全局单例 = 现状字节级一致。
	const ZW_ENGINE_SWITCH_KEYS = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming'];
	const prevEngine = {};
	let hasEngineOverride = false;
	ZW_ENGINE_SWITCH_KEYS.forEach((k)=>{
		if(params[k] !== undefined && params[k] !== null && `${params[k]}` !== ''){
			prevEngine[k] = ZWEngineOptions[k];
			ZWEngineOptions[k] = params[k];
			hasEngineOverride = true;
		}
	});
	try{
		const p = { ...params };
		// 这些键只供前端本地消费,不发后端(后端按白名单忽略,但避免无谓体积/缓存键扰动一并删掉)。
		delete p.sihuaSchool;
		delete p.period;
		ZW_ENGINE_SWITCH_KEYS.forEach((k)=>{ delete p[k]; });
		const school = ZWConst.ZWSchool.school;
		if(school && school !== 'beipai'){
			p.sihua = ZWConst.getActiveSiHuaGan();
		}
		const data = await request(`${Constants.ServerRoot}/ziwei/birth`, {
			body: JSON.stringify(p),
			silent: true,
		});
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(!result || !result.chart){
			return '';
		}
		// WP-F:挂载/导出快照与 live 同口径——传本开关非默认时,用本地引擎重排盘+重算格局,
		// 使快照「传本设置」注记与实际盘数据一致(否则注记说局数年、盘却是 Java 默认 10 年)。失败回退 Java。
		if(ziweiNeedsLocalEngine()){
			try{
				const birth = { date: params.date, time: params.time, zone: params.zone, lon: params.lon, lat: params.lat, gpsLon: params.gpsLon, gpsLat: params.gpsLat, ad: 1, gender: params.gender };
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, daxianSpan: ZWEngineOptions.daxianSpan, tianmaBasis: ZWEngineOptions.tianmaBasis, starSet: ZWEngineOptions.starSet, shangShi: ZWEngineOptions.shangShi, leapMonth: ZWEngineOptions.leapMonth, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, huoling: ZWEngineOptions.huoling, kongNaming: ZWEngineOptions.kongNaming };
				let localChart = calcZiwei(birth, opts);
				if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ localChart = deriveSanPan(localChart, ZWEngineOptions.sanPan); }
				if(localChart && Array.isArray(localChart.houses) && localChart.houses.length === 12){
					result.chart = { ...result.chart, ...localChart };
					try{ const lp = detectPatterns(result.chart); if(Array.isArray(lp)){ result.patterns = lp; } }catch(e3){ /* 保留 Java patterns */ }
				}
			}catch(e4){ /* 本地异常 → 保留 Java 盘 */ }
		}
		return buildZiWeiSnapshotText(params, result);
	}finally{
		if(overrideSchool && overrideSchool !== prevSchool){
			ZWConst.ZWSchool.school = prevSchool;
			ZWConst.refreshActiveSiHua();
			ZiWeiHelper.resetHuaMap();
		}
		if(hasEngineOverride){
			Object.keys(prevEngine).forEach((k)=>{ ZWEngineOptions[k] = prevEngine[k]; });
		}
	}
}

function getFieldValue(fields, key, fallback = ''){
	const field = fields && fields[key] ? fields[key] : null;
	if(!field || field.value === undefined || field.value === null || field.value === ''){
		return fallback;
	}
	return field.value;
}

function buildZiWeiInfoData(chart, fields){
	if(!chart || !chart.nongli){
		return { rows: [], bazi: [], directions: [] };
	}
	const nongli = chart.nongli || {};
	const timeAlg = chart.timeAlg !== undefined && chart.timeAlg !== null ? chart.timeAlg : getFieldValue(fields, 'timeAlg', 0);
	const birthPrefix = timeAlg === 1 ? '直接时间' : '真太阳时';
	const leap = nongli.leap ? '闰' : '';
	const ju = `${ZWText.ZWMsg[chart.yearPolar] || ''}${ZWText.ZWMsg[chart.gender] || ''} ${chart.wuxingJuText || ''}`.trim();
	const rows = [
		['姓名', getFieldValue(fields, 'name', '匿名')],
		['命主', chart.lifeMaster || '—'],
		['身主', chart.bodyMaster || '—'],
		['子斗', chart.zidou || '—'],
		['斗君', chart.doujun || '—'],
		['命局', ju || '—'],
		[birthPrefix, nongli.birth || '—'],
		['农历', `${nongli.year || ''}年 ${leap}${nongli.month || ''}${nongli.day || ''} ${nongli.time ? nongli.time.charAt(1) : ''}时`.trim()],
		['时区', chart.zone || getFieldValue(fields, 'zone', '—')],
		['经纬度', `${chart.lon || getFieldValue(fields, 'lon', '—')}，${chart.lat || getFieldValue(fields, 'lat', '—')}`],
	];
	const bz = chart.bazi && chart.bazi.bazi ? chart.bazi.bazi : {};
	const bazi = [
		{ label: '年', value: bz.year && bz.year.ganzi ? bz.year.ganzi : '—' },
		{ label: '月', value: bz.month && bz.month.ganzi ? bz.month.ganzi : '—' },
		{ label: '日', value: bz.day && bz.day.ganzi ? bz.day.ganzi : '—' },
		{ label: '时', value: bz.time && bz.time.ganzi ? bz.time.ganzi : '—' },
	];
	const directions = chart.bazi && chart.bazi.direct && chart.bazi.direct.direction
		? chart.bazi.direct.direction.map((item, idx)=>{
			const age = item.age + 1;
			return {
				age: age < 10 ? `0${age}` : `${age}`,
				gz: item.mainDirect && item.mainDirect.ganzi ? item.mainDirect.ganzi : '—',
				startYear: item.startYear,
				key: `${idx}-${item.startYear || ''}`,
			};
		})
		: [];
	return { rows, bazi, directions };
}

class ZiWeiMain extends Component{
	constructor(props) {
		super(props);
		// 本地引擎签名记忆(生辰+开关往返切换免重算);kill-switch horosa.perf.localEngineMemo
		this._localEngineMemo = createSignatureMemo(4);
		this.state = {
			result: null,
			rules: null,
			indicator: null,
			cnt: 0,
			tips: null,
			centerInfoVisible: false,
			// 运限单一真值源（需求1）：命盘九宫格与运限 tab(ZWLuckPanel) 共读写；默认空＝无运限(本命四化+自化)。
			// dirIndex / luckMingIndex / 各宫运限标签 / 四化滑窗 全由 luckSel 派生(见 render)。
			luckSel: emptyLuckSel(),
		};

		this.unmounted = false;

		this.requestZiWei = this.requestZiWei.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onChangeDirection = this.onChangeDirection.bind(this);
		this.getNowDirectionIdx = this.getNowDirectionIdx.bind(this);
		this.genDirectionDom = this.genDirectionDom.bind(this);
		this.indicate = this.indicate.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.openCenterInfo = this.openCenterInfo.bind(this);
		this.closeCenterInfo = this.closeCenterInfo.bind(this);
		this.openDrawer = this.openDrawer.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);
		this.onLuckSelChange = this.onLuckSelChange.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestZiWei(fields);
			};
			// 🔴 chartFree 契约(极速化快车道):本页中右栏【零】消费共享 chartObj(全部由 fields
			// 驱动本组件自算/自取)。声明后 fetchByFields 对本页走快车道:fields 立即提交、
			// 不等 /chart 网络 —— 本页从「等一次网络(~230ms)」变「点击即出(<100ms)」。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
		}
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const patch = {
				...field,
			};
			const confirmed = !!patch.__confirmed;
			if(Object.prototype.hasOwnProperty.call(patch, '__confirmed')){
				delete patch.__confirmed;
			}
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
				this._after23BoundaryUserOverrode = true;
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
				}
			};
			this.props.dispatch({
				type: 'astro/save',
				payload: flds
			});
			if(confirmed || !Object.prototype.hasOwnProperty.call(field || {}, '__confirmed')){
				this.requestZiWei(flds.fields);
			}
		}
	}

	// 命盘九宫格点大限(需求1)：写统一 luckSel(等价 ZWLuckPanel.pickDaxian)，立即驱动 运X/金框/大限四化叠层。
	// 再点同一已选大限且无更深层 → 取消(回本命四化+自化的经典盘)，给用户「无运限」可达路径。
	onChangeDirection(value){
		const chart = this.state.result ? this.state.result.chart : null;
		if(!chart){
			return;
		}
		const sel = this.state.luckSel || emptyLuckSel();
		const isSame = sel.daxian && sel.daxian.mingIndex === value;
		const noDeeper = !sel.liunian && !sel.liuyue && !sel.liuri && !sel.liushi;
		if(isSame && noDeeper){
			this.setState({ luckSel: emptyLuckSel() });
			return;
		}
		const item = buildDaxianItems(chart).find((d)=> d.mingIndex === value) || null;
		this.setState({ luckSel: luckSelectDaxian(chart, item, sel) });
	}

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const timeAlg = (flds.timeAlg && flds.timeAlg.value !== undefined && flds.timeAlg.value !== null)
			? flds.timeAlg.value
			: 0;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			ad: (flds.ad && flds.ad.value !== undefined) ? flds.ad.value : (flds.date.value.ad || 1),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			timeAlg: timeAlg === 1 ? 1 : 0,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		}
		// P2-1：非默认流派时附四化表，使后端格局判定随流派；beipai(现状)不附＝缓存键不变＝零回归。
		const school = ZWConst.ZWSchool.school;
		if(school && school !== 'beipai'){
			params.sihua = ZWConst.getActiveSiHuaGan();
		}
		return params;
	}

	async requestZiWei(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);

		// 并行 + rules 会话缓存:rules 与本盘无关(body 恒 {}),原串行瀑布白付一次 RTT;
		// 启动已 prime 缓存(models/app.js dispatch rules/ziwei),此处通常零成本命中。
		// 任一失败整体 throw、不 setState,与原「串行中途失败不 setState」口径一致。
		// WP-C/D 极速化:silent=不触发全局满屏 Spin(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		const [data, rules] = await Promise.all([
			techniqueResultCacheEnabled()
				? cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, { silent: silentTechniquePanelsEnabled() }, { ns: 'ziwei/birth' })
				: request(`${Constants.ServerRoot}/ziwei/birth`, {
					body: JSON.stringify(params),
					silent: silentTechniquePanelsEnabled(),
				}),
			ziweirulesCached({}),
		]);
		// 🔴 空载荷守卫:request() 网络层失败会吞错 resolve undefined(非 reject)。
		// 缺守卫时 data[ResultKey]/rules[ResultKey] 直接崩(Unhandled Rejection)→ 生产白屏/选项永无反应。
		// 口径与「失败不 setState」一致:人话提示 + return,后端就绪后用户重试即恢复。
		if(!data || !rules){
			this.setState({ updating: false });
			message.error('后端服务尚未就绪,请稍后重试');
			return;
		}
		const result = data[Constants.ResultKey]

		// 本地引擎双路(传本开关):任一开关非默认 → 用本地 ZiweiCalc 重排中盘(Java 不支持大限跨度/天马/星集/三盘等);
		// 全默认 → 保留 Java 盘(逐宫零回归)。本地失败一律 try/catch 兜底回退 Java,默认/异常都不破坏现有盘。
		if(result && result.chart && ziweiNeedsLocalEngine()){
			try {
				const birth = { date: params.date, time: params.time, zone: params.zone, lon: params.lon, lat: params.lat, gpsLon: params.gpsLon, gpsLat: params.gpsLat, ad: 1, gender: params.gender };
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, daxianSpan: ZWEngineOptions.daxianSpan, tianmaBasis: ZWEngineOptions.tianmaBasis, starSet: ZWEngineOptions.starSet, shangShi: ZWEngineOptions.shangShi, leapMonth: ZWEngineOptions.leapMonth, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, huoling: ZWEngineOptions.huoling, kongNaming: ZWEngineOptions.kongNaming };
				// 签名记忆:同 生辰+引擎开关+三盘 往返切换(A→B→A)免重算本地引擎全套
				// (calcZiwei+deriveSanPan+detectPatterns ≈50-200ms)。缓存值冻结存放,
				// 使用时浅拷贝再 spread 进 result.chart,防调用侧改写污染缓存。
				const memoKey = stableSignature(birth, opts, ZWEngineOptions.sanPan || 'tian');
				let memoVal = this._localEngineMemo.get(memoKey);
				if(!memoVal){
					let localChart = calcZiwei(birth, opts);
					if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ localChart = deriveSanPan(localChart, ZWEngineOptions.sanPan); }
					let localPatterns = null;
					if(localChart && Array.isArray(localChart.houses) && localChart.houses.length === 12){
						// WP-G:格局随本地盘重算(切开关后主星可移位/四化变,Java 默认盘 patterns 会失配)。失败回退 Java。
						try{ const lp = detectPatterns({ ...result.chart, ...localChart }); if(Array.isArray(lp)){ localPatterns = lp; } }catch(e2){ /* 保留 Java patterns */ }
					}
					memoVal = this._localEngineMemo.set(memoKey, { localChart, localPatterns });
				}
				if(memoVal.localChart && Array.isArray(memoVal.localChart.houses) && memoVal.localChart.houses.length === 12){
					result.chart = { ...result.chart, ...memoVal.localChart };   // 保留 Java 顶层兼容字段、仅换排盘核心
					if(Array.isArray(memoVal.localPatterns)){ result.patterns = memoVal.localPatterns; }
				}
			} catch(e){ /* 本地异常 → 保留 Java 盘(零回归兜底) */ }
		}

		// 运限选择：仅当盘「身份」(生辰+性别+生年干+命宫)变 → 重置(新盘=本命四化+自化的经典盘)；
		// 盘式(三合/四化)、流派等纯视图重排(同盘) → 保留 luckSel(其 mingIndex/gan 仍对当前盘有效)，避免误清用户所选运限。
		const prevChart = (this.state.result && this.state.result.chart) ? this.state.result.chart : null;
		const chartIdentity = (c)=> c ? `${c.birth}|${c.gender}|${c.yearGan}|${c.lifeHouseIndex}` : '';
		const sameChart = !!prevChart && chartIdentity(prevChart) === chartIdentity(result.chart);
		const st = {
			result: result,
			rules: rules[Constants.ResultKey],
			luckSel: sameChart ? (this.state.luckSel || emptyLuckSel()) : emptyLuckSel(),
			updating: false,
		};


		this.setState(st);
		// 惰性构建:12 宫×星曜×四化遍历挪出排盘关键路径(params/result 为本函数局部量,闭包安全;
		// builder 读的全局流派 ZWConst.ZWSchool 若在 idle 前被切换,切换路径必经 requestZiWei
		// 重排 → 新 save 覆盖本 pending,latest-wins 兜底)。
		saveModuleAISnapshotLazy('ziwei', ()=>buildZiWeiSnapshotText(params, result), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}

	getNowDirectionIdx(chartobj){
		if(chartobj.birth === undefined || chartobj.birth === null){
			return null;
		}
		let now = new DateTime();
		let y = now.format('YYYY');
		let year = parseInt(y);
		let birth = parseYearFromDateStr(chartobj.birth);
		let age = year - birth + 1;
		for(let i = 0; i<12; i++){
			let house = chartobj.houses[i];
			if(house.direction[0]<= age && age<=house.direction[1]){
				return i;
			}
		}
		return null;
	}

	genDirectionDom(chart){
		if(chart.houses === undefined || chart.houses === null){
			return null;
		}
		let startidx = chart.lifeHouseIndex;

		let dom = [];
		for(let i=0; i<12; i++){
			let idx = 0;
			if(ZiWeiHelper.isDirCloseWise(chart)){
				idx = (startidx + i) % 12;
			}else{
				idx = (startidx - i + 12) % 12;
			}
			let house = chart.houses[idx];
			let txt1 = house.direction[0] + '~' + house.direction[1];
			let txt2 = house.ganzi + '限';
			let lbl = (
				<Row>
					<Col span={24} style={{textAlign: 'center'}}>{txt1}</Col>
					<Col span={24} style={{textAlign: 'center'}}>{txt2}</Col>
				</Row>
			);
			let btntype = null;
			const selDx = this.state.luckSel && this.state.luckSel.daxian;
			if(selDx && selDx.mingIndex === idx){
				btntype = 'primary';
			}
			let rad = (
				<Col span={8} key={idx}>
					<Button 
						className="horosa-ziwei-direction-button"
						type={btntype}
						onClick={()=>{this.onChangeDirection(idx);}} 
						style={{width: '100%', height: 50}}
					>
						{lbl}
					</Button>
				</Col>
			);
			dom.push(rad);
		}
		return dom;
	}

	indicate(zwIndicator){
		this.setState({
			indicator: zwIndicator,
		});
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	openCenterInfo(){
		this.setState({
			centerInfoVisible: true,
		});
	}

	closeCenterInfo(){
		this.setState({
			centerInfoVisible: false,
		});
	}

	// 运限 tab(ZWLuckPanel) 受控上报：直接落 luckSel 单一真值源（与九宫格同源）。
	onLuckSelChange(next){
		this.setState({ luckSel: next || emptyLuckSel() });
	}

	openDrawer(key){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key,
				},
			});
		}
	}

	navigateFeature(key){
		if(this.props.onNavigate){
			this.props.onNavigate(key);
			return;
		}
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload: {
					currentTab: key,
				},
			});
		}
	}

	// 快捷栏契约:「运限对齐今天」:一键选中今天所在大限+今年流年(小限随流年自动合并),
	// 免去九宫格逐层点找;与九宫格/运限 tab 同走 luckSel 单一真值源,幂等无副作用。
	alignLuckToToday(){
		const chart = this.state.result ? this.state.result.chart : null;
		if(!chart || !chart.houses){
			return;
		}
		const idx = this.getNowDirectionIdx(chart);
		if(idx === null){
			message.info('今天不在任何大限范围内');
			return;
		}
		const dx = buildDaxianItems(chart).find((d)=>d.mingIndex === idx) || null;
		if(!dx){
			return;
		}
		let sel = luckSelectDaxian(chart, dx, this.state.luckSel);
		const year = parseInt(new DateTime().format('YYYY'), 10);
		const ln = buildLiunianItems(chart, dx).find((l)=>l.year === year) || null;
		if(ln){
			sel = luckSelectLiunian(chart, ln, sel);
		}
		this.setState({ luckSel: sel });
	}

	// 快捷栏契约:原 6 个占星推运跨页键(主限/法达/小限/返照/合盘/星运)=跨页导航滥用,全撤;
	// 换成本页真动词(运限对齐/清运限)。笔记保留=本页唯一入口(页头无)。
	renderBottomQuickDock(){
		const hasChart = !!(this.state.result && this.state.result.chart);
		const hasLuck = (()=>{
			const sel = this.state.luckSel;
			return !!(sel && (sel.daxian || sel.liunian || sel.liuyue || sel.liuri || sel.liushi));
		})();
		return (
			<QuickDockBar
				page="ziwei"
				className="horosa-ziwei-quick-dock"
				hasResult={hasChart}
				extras={[
					{ key: 'luckToday', label: '运限对齐今天', icon: 'quickTransit', onClick: ()=>this.alignLuckToToday() },
					{ key: 'luckClear', label: '清除运限', icon: 'quickReturn', disabled: !hasChart || !hasLuck, onClick: ()=>this.setState({ luckSel: emptyLuckSel() }) },
					{ key: 'memo', label: '笔记', icon: 'quickNote', needsResult: false, onClick: ()=>this.openDrawer('memo') },
				]}
				dispatch={this.props.dispatch}
			/>
		);
	}

	renderZiWeiInfoPanel(infoData, directionDoms, tipheight){
		if(!infoData || infoData.rows.length === 0){
			return <div className="horosa-empty-hint">起盘后显示命盘信息</div>;
		}
		return (
			<div className="horosa-ziwei-meta-scroll horosa-astro-content-scroll">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">基本信息</div>
					{infoData.rows.map((row)=>(
						<div className="horosa-info-row" key={row[0]}>
							<span>{row[0]}</span>
							<strong>{row[1]}</strong>
						</div>
					))}
				</div>
				<div className="horosa-info-card horosa-ziwei-bazi-card">
					<div className="horosa-info-card-title">四柱</div>
					<div className="horosa-ziwei-bazi-grid">
						{infoData.bazi.map((item)=>(
							<div className="horosa-ziwei-bazi-cell" key={item.label}>
								<span>{item.label}</span>
								<strong>{item.value}</strong>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card horosa-ziwei-direction-card">
					<div className="horosa-info-card-title">行运大限</div>
					<div className="horosa-ziwei-direction-list">
						<Row>
							{directionDoms}
						</Row>
					</div>
				</div>
				<TipsBoard
					height={tipheight}
					value={this.state.tips}
					/>
			</div>
		);
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新起盘
		this._lateZiHourUserOverrode = false; // v2.2.1: 同上 — 左栏改过 lateZiHourUseNextDay 后,全局事件不再触发重新起盘
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				if(this._after23BoundaryUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.requestZiWei(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(this._lateZiHourUserOverrode) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.requestZiWei(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.props.fields){
			this.requestZiWei(this.props.fields);
		}
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

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	// 数据源与 requestZiWei 里 saveModuleAISnapshotLazy 同口径:result=this.state.result(盘渲染读的同一份),
	// params=genParams(this.props.fields)+period=buildPeriodFromLuckSel()(盘面当前所选运限,故 period 段随盘面保真)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'ziwei'){
			return;
		}
		const result = this.state ? this.state.result : null;
		if(!result || !result.chart){
			return;
		}
		let text = '';
		try{
			const params = this.genParams(this.props.fields);
			// 注入盘面当前所选运限(需求6A)：使「显示什么就导出什么」对运限也成立(此前实时导出不含 [运限])。
			params.period = this.buildPeriodFromLuckSel();
			text = `${buildZiWeiSnapshotText(params, result) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('ziwei', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	// 由 luckSel 单一真值源派生盘面渲染所需（需求1/3/5）：大限索引(运X)、最深运命宫(金框高亮)、
	// 四化滑窗层(末3层+自化开关)、长生左侧标签层(年/月/日/时)。本命/大限按 hua 本色(periodColor=null)，
	// 流年小限/流月/流日/流时按各层期色。
	buildLuckRender(chart){
		const sel = this.state.luckSel || emptyLuckSel();
		const yearGan = chart && chart.yearGan ? chart.yearGan : '';
		const win = ZiWeiHelper.luckSihuaWindow(sel, yearGan);
		const isHuaColored = (key)=> key === 'benming' || key === 'daxian';
		const sihuaLayers = win.layers.map((l)=>({
			key: l.key,
			gan: l.gan,
			periodColor: isHuaColored(l.key) ? null : ZWConst.ZWPeriodColor[l.key],
		}));
		const labelLayers = ZiWeiHelper.luckLabelLayers(sel).map((l)=>({
			prefix: l.prefix,
			mingIndex: l.mingIndex,
			color: ZWConst.ZWPeriodColor[l.key],
		}));
		// 稳定签名 key：派生数组每次 render 新建引用，重绘守卫不能用其做引用比较 → 用本 key（仅选择变才变）。
		const key = [
			sel.daxian ? sel.daxian.id : '',
			sel.liunian ? sel.liunian.id : '',
			sel.liuyue ? sel.liuyue.id : '',
			sel.liuri ? sel.liuri.id : '',
			sel.liushi ? sel.liushi.id : '',
		].join('|');
		return {
			dirIndex: sel.daxian ? sel.daxian.mingIndex : null,
			luckMingIndex: ZiWeiHelper.luckDeepestMingIndex(sel),
			sihuaLayers,
			showZihua: win.showZihua,
			labelLayers,
			key,
		};
	}

	// luckSel → AI 快照 period（与挂载 record→period 同结构，经同一 buildZiweiPeriodLines 出文；需求6A，
	// 使「显示什么就导出什么」对运限也成立）。全空→null（不产 [运限] 段，与现状逐字一致）。
	buildPeriodFromLuckSel(){
		const sel = this.state.luckSel || emptyLuckSel();
		const period = {};
		if(sel.daxian) period.daxian = [sel.daxian.mingIndex];
		if(sel.liunian && Number.isFinite(sel.liunian.year)) period.liunian = [sel.liunian.year];
		if(sel.liuyue && Number.isFinite(sel.liuyue.month)) period.liuyue = [sel.liuyue.month];
		if(sel.liuri && Number.isFinite(sel.liuri.day)) period.liuri = [sel.liuri.day];
		if(sel.liushi && Number.isFinite(sel.liushi.hourIdx)) period.liushi = [sel.liushi.hourIdx];
		return (period.daxian || period.liunian || period.liuyue || period.liuri || period.liushi) ? period : null;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 40
		}

		let chart = this.state.result ? this.state.result.chart : {};
		const luckRender = this.buildLuckRender(chart);
		let doms = this.genDirectionDom(chart);
		let infoData = buildZiWeiInfoData(chart, this.props.fields);

		let tipheight = 270;
		let docwid = document.documentElement.clientWidth;
		if(docwid <= 1440){
			tipheight = 120;
		}

		return (
			<div className="horosa-ziwei-page horosa-astro-redesign horosa-ziwei-redesign">
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-ziwei-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-ziwei-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-ziwei-input-panel">
							<ZiWeiInput
								fields={this.props.fields}
								onFieldsChange={this.onFieldsChange}
							/>
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-ziwei-chart-panel xq-chart-renderer xq-chart-renderer-ziwei" style={{ position: 'relative' }}>
							{this.state.updating && this.state.result ? <UpdatingBadge /> : null}
							<div className="horosa-ziwei-chart-viewport" data-capture-chart-only>
								<ZiWeiChart
									value={chart}
									height="100%"
									fields={this.props.fields}
									dirIndex={luckRender.dirIndex}
									luckMingIndex={luckRender.luckMingIndex}
									luckSihuaLayers={luckRender.sihuaLayers}
									luckShowZihua={luckRender.showZihua}
									luckLabelLayers={luckRender.labelLayers}
									luckKey={luckRender.key}
									indicate={this.indicate}
									rules={this.state.rules}
									onTipClick={this.onTipClick}
									onCenterInfoClick={this.openCenterInfo}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-ziwei-info-panel">
							{/* 星阙金 W1 试点:XQTabs 自带 xq-tabs 基线(金 ink-bar 2px+三态字色);W2 全量收编 content-tabs 族 */}
						<Tabs defaultActiveKey="info" tabPosition='top' className="horosa-content-tabs horosa-ziwei-tabs">
								<TabPane tab="命盘" key="info">
									{this.renderZiWeiInfoPanel(infoData, doms, tipheight)}
								</TabPane>
								<TabPane tab="运限" key="luck">
									<ZWLuckPanel
										chart={chart}
										value={this.state.luckSel}
										onChange={this.onLuckSelChange}
										onAi={()=>this.navigateFeature('aianalysis')}
									/>
								</TabPane>
								<TabPane tab="格局" key="patterns">
									<ZWPatternPanel patterns={this.state.result ? this.state.result.patterns : []} />
								</TabPane>
								<TabPane tab="资料参考" key="2">
									<ZWRuleMain height={height} rules={this.state.rules} />
								</TabPane>
							</Tabs>
						</div>
						</div>
						{this.renderBottomQuickDock()}
						<Modal
							open={this.state.centerInfoVisible}
							title="命盘信息"
							footer={null}
							onCancel={this.closeCenterInfo}
							width={640}
							className="horosa-ziwei-center-info-modal"
						>
							{this.renderZiWeiInfoPanel(infoData, doms, tipheight)}
						</Modal>
					</div>
				</div>
		);
	}
}

export default ZiWeiMain;
