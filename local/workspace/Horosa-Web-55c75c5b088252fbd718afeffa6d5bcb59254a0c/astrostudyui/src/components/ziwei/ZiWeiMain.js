import { Component } from 'react';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled, stepPrefetchEnabled, techniqueResultCacheEnabled, chartSCUEnabled } from '../../utils/perfFlags';
import { cachedPost } from '../../services/_requestCache';
// R4-B2(horosa_prefetch_registry_v1):/ziwei/birth 步进预取登记 + 本地漏斗 settle 武装。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { markPanelReady, markInteractionStart } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
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
	rederiveLuckSel,
} from './ZWLuckPanel';
import QuickDockBar from '../common/QuickDockBar';
import ZWPatternPanel from './ZWPatternPanel';
import TipsBoard from '../comp/TipsBoard';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as ZWText from '../../constants/ZWText';
import * as ZWConst from '../../constants/ZWConst';
import { isLaiyinPalace } from './ziweiSchools';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ziweirulesCached } from '../../services/rules';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { calcZiwei, deriveSanPan, applyLifeMasterOption } from './ZiweiCalc';
import { detectPatterns } from './ziweiPatterns';
import { ZWEngineOptions, ziweiNeedsLocalEngine, collectEngineOpts } from './ziweiOptions';
import { starLightOf, normalizeBrightnessCustomTable, ZWBrightnessCustom } from './data/ziweiTables';
import { childLimits } from './ziweiCore';
import { qiShuWei, allBorrowedStars, taiSuiRuGua } from './ziweiOverlays';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';

const TabPane = Tabs.TabPane;

// 稳定空值(避免每次 render 新建字面量 → 下游 sCU/绘制守卫的引用比恒不等)。
// 三个消费者(ZiWeiChart.drawChart / ZWLuckPanel.render / buildZiWeiInfoData)在
// houses/nongli 缺省时都提前 return,不会写入这两个对象,故共享安全。
const ZW_EMPTY_CHART = {};
const ZW_EMPTY_PATTERNS = [];

// horosa_ziwei_state_slice_v1:本组件 render 实际消费的 state 键。
// indicator(仅 ZWChart 指示器句柄回传,render 从不读)与 cnt(历史遗留,零读取)变化时,
// 旧的「nextState !== this.state 即返 true」会把 12 宫 SVG + 右栏四页签全部重渲一遍。
// 取向仍是「宁可多渲、绝不漏渲」:只有**确认 render 不读**的键才判无关,其余任何键(含未知新增键)一律判「变了」。
const ZW_RENDER_IRRELEVANT_STATE_KEYS = { indicator: true, cnt: true };
function ziweiStateAffectsRender(prev, next){
	if(prev === next){
		return false;
	}
	if(!prev || !next){
		return true;
	}
	const prevKeys = Object.keys(prev);
	const nextKeys = Object.keys(next);
	if(prevKeys.length !== nextKeys.length){
		return true;   // 键集合变了 → 保守判「变了」
	}
	for(let i = 0; i < nextKeys.length; i += 1){
		const k = nextKeys[i];
		if(prev[k] === next[k]){
			continue;
		}
		if(ZW_RENDER_IRRELEVANT_STATE_KEYS[k]){
			continue;
		}
		return true;
	}
	return false;
}

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
	// 星曜亮度传导:星名→庙旺档(盘数据基础值+非默认亮度源经 starLightOf 覆盖,与渲染层
	// effStarLight 同口径)。字符串星(旧夹具/降级形状)无亮度=不出档,快照照旧(零回归)。
	const lightOf = {};
	const houseZhi = (((house && house.ganzi) || '') + '').charAt(1);
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
			let sl = (item && typeof item === 'object' && item.starlight) ? `${item.starlight}` : '';
			const src = ZWEngineOptions.brightnessSource;
			if(src && src !== 'zi_jian' && houseZhi){
				const base = name.charAt(0) === '副' ? name.slice(1) : name;
				const v = starLightOf(base, houseZhi, src);
				if(v != null){ sl = v; }
			}
			if(sl){ lightOf[name] = sl; }
		});
	});
	return { list: out, lightOf };
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
	// [B10-fix] 与面板同口径:消费期现算(effLayerSihuaGan),快照与 UI 恒同源
	const sihua = ZiWeiHelper.getLayerSihua(chart, ZiWeiHelper.effLayerSihuaGan(chart, layer)) || [];
	if(sihua.length > 0){
		const parts = sihua.map((h)=>`${h.star}化${h.hua}（${luckHouseName(chart, h.houseIndex, true)}）`);
		lines.push(`四化：${parts.join('、')}`);
	}
	// [D3] 流年神煞上盘开时:流年层追加 12 神落宫行(快照与盘面同源 getFlowJiangSui;默认关=基线字节稳)。
	if(ZWEngineOptions.flowShenshaOnChart && layer.zhi && levelLabel === ZW_PERIOD_LEVEL_LABEL.liunian){
		const fss = ZiWeiHelper.getFlowJiangSui(layer.zhi) || [];
		if(fss.length){
			const fmt = (g)=>fss.filter((x)=>x.group === g).map((x)=>`${x.name}(${x.zhi})`).join('、');
			lines.push(`流年神煞·将前：${fmt('jiang')}`);
			lines.push(`流年神煞·岁前：${fmt('sui')}`);
		}
	}
	const flowStars = ZiWeiHelper.getFlowStars(layer.gan, layer.zhi, ZiWeiHelper.hourZhiOf(chart)) || [];
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
	// 换算后时刻(审计补缺:此前只写算法名、无换算结果):双时刻并列与八字快照同款,换算关系一眼可见;
	// 后端盘缺 clockTime/solarTime 双字段时回落单行 nongli.birth(盘心 ZWCenterHouse 同款取数),全缺不产行。
	const tmNl = chart.nongli || {};
	if(tmNl.clockTime && tmNl.solarTime){
		lines.push(`直接时间：${tmNl.clockTime}　真太阳时：${tmNl.solarTime}`);
	}else if(tmNl.birth){
		lines.push(`${params.timeAlg === 1 ? '直接时间：' : '真太阳时：'}${tmNl.birth}`);
	}
	const schoolLabel = { beipai: '通用·飞星', zhongzhou: '中州派', quanshu: '全书系', beixiang: '北派(天相忌)', custom: '自定义' }[ZWConst.ZWSchool.school] || '通用·飞星';
	lines.push(`四化流派：${schoolLabel}`);
	// 传本/排盘开关(非默认才注记,供 AI 知悉本盘用了哪套传本)。
	const tbNotes = [];
	if(ZWEngineOptions.daxianSpan !== 10){ tbNotes.push('大限跨度=局数年(钦天)'); }
	if(ZWEngineOptions.tianmaBasis !== 'month'){ tbNotes.push('天马=年支三合马'); }
	if(ZWEngineOptions.starSet !== 'full'){ tbNotes.push('星集=精简18星(河洛)'); }
	if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ tbNotes.push(`观察盘=${ZWEngineOptions.sanPan === 'di' ? '地盘(身宫起)' : '人盘(福德起)'}`); }
	if(ZWEngineOptions.shangShi === 'yinyang'){ tbNotes.push('天伤天使=阴阳互换(中州)'); }
	const leapLabel = { next: '整月归下月', prev: '整月归上月', split_days: '前后半分割(按实际天数取中点)', split_star_month: '命身下月·月系上月', solar_term: '按节气分界(过节归下月)' };
	if(ZWEngineOptions.leapMonth && ZWEngineOptions.leapMonth !== 'mid_split'){ tbNotes.push(`闰月=${leapLabel[ZWEngineOptions.leapMonth] || ZWEngineOptions.leapMonth}`); }
	const lateZiLabel = { zi_chu: '子初换日(强制)', midnight_split: '夜子折中', zi_zheng: '子正换日', dual: '双盘(当日/次日)' };
	if(ZWEngineOptions.lateZi && ZWEngineOptions.lateZi !== 'global'){ tbNotes.push(`晚子时=${lateZiLabel[ZWEngineOptions.lateZi] || ZWEngineOptions.lateZi}`); }
	if(ZWEngineOptions.yearBoundary === 'lunar_1_1'){ tbNotes.push('定年界线=正月初一'); }
	if(ZWEngineOptions.huoling === 'nanpai'){ tbNotes.push('火铃=南派(忽略生时)'); }
	if(ZWEngineOptions.kongNaming === 'book'){ tbNotes.push('空劫=天空/地劫(古本)'); }
	if(ZWEngineOptions.lifeMasterBy === 'ming_branch'){ tbNotes.push('命主取法=命宫支(经典法)'); }
	if(ZWEngineOptions.changshengStart === 'huo_tu'){ tbNotes.push('长生十二神=火土同宫(土五起寅)'); }
	if(ZWEngineOptions.changshengDirection === 'always_forward'){ tbNotes.push('长生十二神=一律顺行(不分阴阳)'); }
	if(ZWEngineOptions.kongwangStyle === 'single'){ tbNotes.push('截空旬空=只安正空(单星)'); }
	const kuiYueLabel = { geng_ma_hu: '庚辛逢马虎(庚年魁午钺寅)', liu_xin_hu_ma: '六辛逢虎马(辛年魁寅钺午)', geng_xin_hu_ma: '庚辛逢虎马(庚辛年魁寅钺午)' };
	if(ZWEngineOptions.kuiYue && ZWEngineOptions.kuiYue !== 'jia_wu_geng'){ tbNotes.push(`魁钺歌诀=${kuiYueLabel[ZWEngineOptions.kuiYue] || ZWEngineOptions.kuiYue}`); }
	if(ZWEngineOptions.liuYueBasis === 'taisui'){ tbNotes.push('流月=太岁宫起正月'); }
	if(ZWEngineOptions.liunianSihuaGan === 'ming_gong_gan'){ tbNotes.push('流年四化=依流年命宫天干'); }
	if(ZWEngineOptions.flowLuanXi){ tbNotes.push('流曜含流鸾/流喜'); }
	if(ZWEngineOptions.flowHuoLing){ tbNotes.push('流曜含流火/流铃'); }
	if(ZWEngineOptions.flowShenshaOnChart){ tbNotes.push('流年神煞上盘(将前/岁前随流年)'); }
	if(ZWEngineOptions.brightnessSource === 'quanshu'){ tbNotes.push('星曜亮度=《全书》版(擎羊子酉旺/铃星独立表/亥卯未火星得)'); }
	else if(ZWEngineOptions.brightnessSource === 'quanshu_full'){ tbNotes.push('星曜亮度=《全书》七档全表(庙旺得利平不陷;未载之曜按默认表)'); }
	if(ZWEngineOptions.childLimit){ tbNotes.push('童限(上大限前逐岁本命宫)'); }
	if(ZWEngineOptions.zhongxian){ tbNotes.push('沈氏三限(大限细分2.5年中限)'); }
	if(ZWEngineOptions.huoPan){ tbNotes.push('活盘(太极点可转移重排宫名)'); }
	if(ZWEngineOptions.qishuWei){ tbNotes.push('河洛气数位(官禄宫干四化回照)'); }
	if(ZWEngineOptions.borrowPalace){ tbNotes.push('中州借宫(空宫借对宫正曜)'); }
	if(ZWEngineOptions.taiSuiRuGua){ tbNotes.push('紫云太岁入卦(关系人生肖落宫)'); }
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
		// 长生十二神内联宫位格(三合盘恒画的 house.phase,快照曾恒缺;不加表列,表头断言零触;缺省不产)。
		const name = `${house.name || house.id || `宫位${idx + 1}`}${house.phase ? `·${house.phase}` : ''}`;
		const ganzi = house.ganzi || '';
		const palaceGan = ganzi ? normalizeGan(ganzi) : '';
		const direction = house.direction && house.direction.length === 2 ? `${house.direction[0]}~${house.direction[1]}` : '';
		const collected = collectHouseStars(house);
		const stars = collected.list;
		// 星文本内联庙旺档「星名(四化)·档」—— AI 报告要义要求「依庙旺论强弱」,快照必须真给庙旺
		// (曾恒缺失=让模型臆造);不加表列,preflight[121] 表头断言零触。
		const starText = stars.length > 0
			? stars.map((starName)=>{
				const sl = collected.lightOf[starName];
				return `${formatStarSiHua(starName, yearGan, lifeGan, palaceGan)}${sl ? `·${sl}` : ''}`;
			}).join('、')
			: '无';
		lines.push(`| ${name} | ${ganzi || '无'} | ${direction || '无'} | ${starText} |`);
	});
	lines.push('');

	// 身宫判据钉死引擎输出 house.isBody(与盘面 ZWHouse/ZWHouseSangHe 身宫标记同源;本地/后端两引擎皆保证,
	// bodyHouseIndex 仅本地引擎有故禁走该旁路)。找不到整段不产(best-effort,与来因宫同范式)。
	const bodyHouse = houses.find((house)=> house && house.isBody);
	if(bodyHouse && bodyHouse.name){
		lines.push('[身宫]');
		lines.push(`身宫落${bodyHouse.name}${bodyHouse.ganzi ? `（${bodyHouse.ganzi}）` : ''}`);
		lines.push('');
	}

	if(yearGan){
		// 来因宫判据走 isLaiyinPalace 单源(排除子丑借干宫;与盘面 drawLaiYing 同口径)
		const laiyin = houses.filter((house)=> isLaiyinPalace(house.ganzi, yearGan))
			.map((house)=> `${house.name || ''}（${house.ganzi}）`);
		if(laiyin.length > 0){
			lines.push('[来因宫]');
			lines.push(laiyin.join('、'));
			lines.push('');
		}
	}

	// [八字大运] 盘心十列(起运虚岁+大运干支+起始年,ZWCenterHouse 恒画)快照曾恒缺;
	// 数据与盘心/info 面板同源 chart.bazi.direct.direction,缺省(本地引擎无 direct)整段不产。
	const bzDirect = chart.bazi && chart.bazi.direct && Array.isArray(chart.bazi.direct.direction)
		? chart.bazi.direct.direction : [];
	if(bzDirect.length){
		lines.push('[八字大运]');
		lines.push('| 起运虚岁 | 起始年份 | 大运干支 |');
		lines.push('| --- | --- | --- |');
		bzDirect.forEach((item)=>{
			const gz = item && item.mainDirect && item.mainDirect.ganzi ? item.mainDirect.ganzi : '';
			if(!gz){ return; }
			lines.push(`| ${(item.age || 0) + 1} | ${item.startYear || '无'} | ${gz} |`);
		});
		lines.push('');
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

	// 流派叠层 ground-truth（代码计算·禁 AI 编造；仅开关开时注入 → 全关时快照逐字不变）。
	const overlayLines = buildZiweiOverlayLines(chart);
	if(overlayLines.length){ lines.push(...overlayLines); }

	return lines.join('\n');
}

// 河洛气数位/中州借宫/紫云太岁/童限的可读 ground-truth 行(仅对应开关开时产出)。
// 统一收敛到单一 AI 导出段 [流派叠层]:子技法用「·标题」内联小标题(非方括号/全角段头,不触发段过滤器),
// 故 AI 导出设置只多一个可勾段(与「运限」条件分析层同范式),而非 4 个常驻空勾框;登记见 aiExport ziwei preset。
function buildZiweiOverlayLines(chart){
	if(!chart || !chart.houses){ return []; }
	const hn = (idx)=>((chart.houses[idx] || {}).name || `#${idx}`);
	const blocks = [];   // [子标题, [行...]];仅开关开且有数据时入
	if(ZWEngineOptions.childLimit){
		const cl = childLimits(chart.wuxingJu, chart.lifeHouseIndex);
		if(cl.length){ blocks.push(['童限', [cl.map((x)=>`${x.age}岁·${hn(x.houseIndex)}`).join('、')]]); }
	}
	if(ZWEngineOptions.qishuWei){
		const q = qiShuWei(chart);
		if(q){
			blocks.push(['河洛气数位', [
				`气数位=官禄宫(${hn(q.qiShuIdx)})，宫干${q.stem || '?'}`,
				`四化落宫：${['禄', '权', '科', '忌'].map((h)=>`${h}${(q.huaLanding[h] && q.huaLanding[h].star) || ''}→${q.huaLanding[h] && q.huaLanding[h].houseIndex >= 0 ? hn(q.huaLanding[h].houseIndex) : '未上盘'}${q.huaLanding[h] && q.huaLanding[h].backToLife ? '(回照本宫)' : ''}`).join('；')}`,
				`一六共宗：命↔疾厄(${hn(q.yiLiuGongZong['疾厄(6)'])})、命↔官禄气数位(${hn(q.qiShuIdx)})`,
			]]);
		}
	}
	if(ZWEngineOptions.borrowPalace){
		const all = allBorrowedStars(chart);
		const rows = [];
		for(let i = 0; i < 12; i++){ if(all[i]){ rows.push(`${hn(i)}(空)借对宫：${all[i].map((s)=>`${s.name}${s.starlight ? `·${s.starlight}` : ''}`).join('、')}`); } }
		if(rows.length){ blocks.push(['中州借宫安星', rows]); }
	}
	if(ZWEngineOptions.taiSuiRuGua && Array.isArray(ZWEngineOptions.taiSuiRelatives) && ZWEngineOptions.taiSuiRelatives.length){
		const t = taiSuiRuGua(chart, ZWEngineOptions.taiSuiRelatives);
		if(t.length){ blocks.push(['紫云太岁入卦', [t.map((r)=>`生肖${r.branch}${r.role ? `(${r.role})` : ''}→${r.houseIndex >= 0 ? hn(r.houseIndex) : '?'}·${r.dou}`).join('、')]]); }
	}
	if(!blocks.length){ return []; }
	const out = ['[流派叠层]'];
	blocks.forEach(([title, rows])=>{
		out.push(`· ${title}`);
		rows.forEach((r)=>out.push(`  ${r}`));
	});
	out.push('');
	return out;
}

// —— R4-B3:/ziwei/birth 构参的模块级纯函数(组件方法 genParams 纯委托于此)。
//    抽出来的唯一目的:预热/预取要在【组件之外】构出与首点逐字节同键的 body。
//    语义与抽出前逐字节一致(含「非默认流派才附 sihua」这条零回归约定)。
export function buildZiweiBirthParams(flds){
	if(!flds){
		return null;
	}
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

// PERF-R9 Ship 7(数据层空闲预热):紫微本盘 /ziwei/birth —— 首点概率最高的技法之一,
// 却一直不在排盘后的预热组里(本轮补上)。走与 requestZiWei 完全同一入口(同 url、同 body、
// 同缓存层)⇒ 用户首点即命中。silent、丢结果、绝不 dispatch/setState;失败静默。
export async function warmZiweiBirth(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){
			return null;
		}
		const params = buildZiweiBirthParams(fields);
		if(!params){
			return null;
		}
		const opts = { silent: true, retry: { retries: 0 } };
		if(techniqueResultCacheEnabled()){
			return await cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, opts, { ns: 'ziwei/birth' });
		}
		return await request(`${Constants.ServerRoot}/ziwei/birth`, {
			body: JSON.stringify(params),
			...opts,
		});
	}catch(e){
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}

// 供 AI 分析无头复算：按出生参数取盘并生成紫微快照文本（不依赖组件挂载）。
export async function buildZiweiSnapshotForParams(params){
	if(!params){
		return '';
	}
	// 挂载侧 taiSuiRelatives 可能以文本"午 子"直达(text 字段未经 schema normalize 的路径)→ 就地归一成 [{branch}] 数组,
	// 与 live UI 同结构;否则 buildZiweiOverlayLines/taiSuiRuGua 的 Array.isArray 判死,挂载/导出的太岁入卦段静默丢失(双保险)。
	if(typeof params.taiSuiRelatives === 'string' && params.taiSuiRelatives.trim()){
		params = { ...params, taiSuiRelatives: params.taiSuiRelatives.trim().split(/[,，\s]+/).map((x)=>x.trim()).filter(Boolean).map((b)=>({ branch: b })) };
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
	// [A4] 随盘自定义四化表:归一合法才注入单例(临时,finally 清;绝不写 LS——崩溃残留不污染本机偏好)。
	// 仅 custom 档会消费(getActiveSiHuaGan 先查单例);其余档注入无害但为省缓存失效仍按档判。
	const customSihua = (ZWConst.ZWSchool.school === 'custom' && params.sihuaCustomTable)
		? ZWConst.normalizeSihuaCustomTable(params.sihuaCustomTable) : null;
	if(customSihua){
		ZWConst.ZWSihuaCustom.override = customSihua;
		ZWConst.refreshActiveSiHua();
		ZiWeiHelper.resetHuaMap();
	}
	// [B14] 随盘自定义亮度表:同 A4 机制。亮度纯显示层无缓存链,注入/清除即时生效。
	const customBrightness = params.brightnessCustomTable
		? normalizeBrightnessCustomTable(params.brightnessCustomTable) : null;
	if(customBrightness){ ZWBrightnessCustom.override = customBrightness; }
	// 传本/排盘开关(挂载侧 record 显式覆盖时透传):临时切可变单例 ZWEngineOptions(builder 自读它),用毕还原,
	// 避免污染用户全局现状(与 sihuaSchool 同范式)。缺省不覆盖 → 读全局单例 = 现状字节级一致。
	const ZW_ENGINE_SWITCH_KEYS = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
		// 手册补齐:亮度源 + 6 显示 overlay + 紫云关系人(挂载侧 per-技法 record 显式覆盖时透传)。
		'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua', 'taiSuiRelatives', 'xiaoxianMode'];
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
		delete p.sihuaCustomTable;
		delete p.brightnessCustomTable;
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
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, ...collectEngineOpts(ZWEngineOptions), lifeMasterBy: ZWEngineOptions.lifeMasterBy || 'year_branch' };
				// ⚠️ lifeMasterBy 显式选项(默认 'year_branch'=Java 同源;fallback 字面量保留防单例缺位)。
				//    历史上此处钉死生年支防「翻拨开关误改命主」——现由显式选项+ziweiCalc 哨兵金标接防
				//    (默认零回归;ming_branch=用户主动选,命主按天盘命宫支且不随观察盘移)。
				let localChart = calcZiwei(birth, opts);
				if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ localChart = deriveSanPan(localChart, ZWEngineOptions.sanPan); }
				if(localChart && Array.isArray(localChart.houses) && localChart.houses.length === 12){
					result.chart = { ...result.chart, ...localChart };
					try{ const lp = detectPatterns(result.chart); if(Array.isArray(lp)){ result.patterns = lp; } }catch(e3){ /* 保留 Java patterns */ }
				}
			}catch(e4){ /* 本地异常 → 保留 Java 盘 */ }
		}
		// [P2a] 命主取法后处理:仅 Java 盘路径(本地引擎盘已按 ctx 算好且防观察盘错基,见函数头注)
		if(!ziweiNeedsLocalEngine()){ applyLifeMasterOption(result.chart, ZWEngineOptions.lifeMasterBy); }
		return buildZiWeiSnapshotText(params, result);
	}finally{
		if(customBrightness){ ZWBrightnessCustom.override = null; }
		if(customSihua){
			ZWConst.ZWSihuaCustom.override = null;
			ZWConst.refreshActiveSiHua();
			ZiWeiHelper.resetHuaMap();
		}
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
			dualView: 'day',   // 晚子双盘(WP-8):day=当日盘(默认) / next=次日盘;仅 chart.dualAlt 在时显切换
			tonglianHi: null,  // 童限/中限(WP-1/2)点选高亮的本命宫 index(独立于 luckSel;金框机制);选大限则清
			// 运限单一真值源（需求1）：命盘九宫格与运限 tab(ZWLuckPanel) 共读写；默认空＝无运限(本命四化+自化)。
			// dirIndex / luckMingIndex / 各宫运限标签 / 四化滑窗 全由 luckSel 派生(见 render)。
			luckSel: emptyLuckSel(),
			// horosa_freeze_subtabs_v1:右栏四页签改【受控】(原 defaultActiveKey 非受控 → 无从冻结)。
			// 初值 'info' 与原 defaultActiveKey 逐字一致 = 首屏所见零变化。
			rightTab: 'info',
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
		this.onTonglianHighlight = this.onTonglianHighlight.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		// 稳定回调:原先是 render 内联箭头(每次 render 新引用)→ 下游 sCU 的 props 比恒不等,memo 形同虚设。
		this.onRightTabChange = this.onRightTabChange.bind(this);
		this.openAiAnalysis = this.openAiAnalysis.bind(this);

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
			// R4-B2(horosa_prefetch_registry_v1):/ziwei/birth 是确定性纯计算(同 生辰+流派 恒同盘;
			// 无随机、不依赖「现在」)→ 登记步进预取。
			// 🔴 登记必须在组件内:genParams 吃组件态的流派设置(ZWConst.ZWSchool),
			//    模块级登记构不出与真点同键的 body。闸:horosa.perf.stepPrefetch(关=零登记)。
			if(stepPrefetchEnabled()){
				this._ziweiStepPrefetcher = (steppedFields)=>{
					if(this.unmounted){
						return [];
					}
					let params = null;
					try{
						params = this.genParams(steppedFields);
					}catch(e){
						return [];
					}
					if(!params){
						return [];
					}
					// 与 requestZiWei 完全同一入口(同 url、同 body、同缓存层)—— 差一字节即白预取。
					// silent + retry:0:后端重启窗口绝不退避风暴。
					const opts = { silent: true, retry: { retries: 0 } };
					return [{
						name: 'ziwei:birth',
						path: '/ziwei/birth',
						run: ()=> (techniqueResultCacheEnabled()
							? cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, opts, { ns: 'ziwei/birth' })
							: request(`${Constants.ServerRoot}/ziwei/birth`, {
								body: JSON.stringify(params),
								...opts,
							})),
					}];
				};
				registerStepPrefetcher('ziwei', this._ziweiStepPrefetcher);
			}
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
			// [R3-A2] 紫微不走 fetchByFields(save+requestZiWei 自链),步进提示在此捕获后剥净:
			// 防其进入 astro/save 与 requestZiWei 请求体(save reducer 另有中央网兜底);
			// 捕获值驱动本组件专属的顺向 +1 步预取(A4 紫微版)。
			const stepHint = patch.__stepHint || null;
			if(Object.prototype.hasOwnProperty.call(patch, '__stepHint')){
				delete patch.__stepHint;
			}
			// horosa_panel_ready_v1 配对起点:紫微【左栏】(ZiWeiInput:改时间/流派/传本开关/杂曜显示…)
			// 全部走本方法 → dispatch('astro/save') + 直调 requestZiWei,**不经** pages/index.js 的
			// changeCond,故那里的 markInteractionStart 覆盖不到它 → 起点缺失时 markPanelReady 因
			// stepT0===0 静默丢弃,左栏这条最高频路径将永远量不到一条样本。与 calendar 族
			// (NongLiMain/TongshuMain「本页时间条不经 pages/index.js」)同一处置。
			// 判据与下方真正触发重排的分支逐字同源,故不会为「只落 fields、不重排」的调用留悬空起点。
			if(confirmed || !Object.prototype.hasOwnProperty.call(field || {}, '__confirmed')){
				markInteractionStart('ziwei');
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
				this.prefetchNextStepZiwei(flds.fields, stepHint);
			}
		}
	}

	// [R3-A4 紫微版] 顺向 +1 步预取:/ziwei/birth 经 genParams 同源构参 → 键逐字节等,
	// 结果落 requestDedupe(L1/L2/L3);rules 与盘无关恒缓存。连点下一步 ≈ 瞬间。
	// 失败静默;开关关=零行为。
	prefetchNextStepZiwei(baseFields, stepHint){
		try{
			if(!stepPrefetchEnabled()){ return; }
			if(!stepHint || !stepHint.dir){ return; }
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				try{
					const dt2 = dt0.clone();
					const unit = stepHint.unit || 'm';
					if(unit === 'y'){ dt2.addYear(stepHint.dir); }
					else if(unit === 'M'){ dt2.addMonth(stepHint.dir); }
					else if(unit === 'd'){ dt2.addDate(stepHint.dir); }
					else if(unit === 'h'){ dt2.addHour(stepHint.dir); }
					else { dt2.addMinute(4 * stepHint.dir); }
					const flds2 = {
						...baseFields,
						date: { value: dt2.clone() },
						time: { value: dt2.clone() },
						ad: { value: dt2.ad },
						zone: { value: dt2.zone },
					};
					const params = this.genParams(flds2);
					if(!params){ return; }
					request(`${Constants.ServerRoot}/ziwei/birth`, {
						body: JSON.stringify(params),
						silent: true,
					}).catch(()=>null);
				}catch(e){ /* 预取失败无害 */ }
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
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
		// horosa_panel_ready_v1 配对起点:点大限是【纯本地】setState(不发请求、不经 pages/index.js
		// changeCond),此前起点/终点两头皆无 → 这条路径在验收台架里是**零样本**(既非通过也非失败,
		// 而是根本没量)。起点紧贴真正会落数的 setState 之前打,早退分支不留悬空起点。
		if(isSame && noDeeper){
			markInteractionStart('ziwei');
			this.setState({ luckSel: emptyLuckSel() }, ()=>{ markPanelReady('ziwei'); });
			return;
		}
		const item = buildDaxianItems(chart).find((d)=> d.mingIndex === value) || null;
		markInteractionStart('ziwei');
		this.setState({ luckSel: luckSelectDaxian(chart, item, sel) }, ()=>{ markPanelReady('ziwei'); });
	}

	genParams(fields){
		// R4-B3:构造原样抽为模块级纯函数(预热/预取复用同一路径 ⇒ key/body 逐字节一致);
		// 本方法保持既有签名与 props 兜底语义,纯委托零行为变化。
		return buildZiweiBirthParams(fields ? fields : this.props.fields);
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
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, ...collectEngineOpts(ZWEngineOptions), lifeMasterBy: ZWEngineOptions.lifeMasterBy || 'year_branch' };
				// ⚠️ lifeMasterBy 显式选项(默认 'year_branch'=Java 同源;fallback 字面量保留防单例缺位)。
				//    历史上此处钉死生年支防「翻拨开关误改命主」——现由显式选项+ziweiCalc 哨兵金标接防
				//    (默认零回归;ming_branch=用户主动选,命主按天盘命宫支且不随观察盘移)。
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
		// [P2a] 命主取法后处理:仅 Java 盘路径(本地盘已按 ctx.lifeMasterBy 以天盘命宫算好)
		if(result && result.chart && !ziweiNeedsLocalEngine()){ applyLifeMasterOption(result.chart, ZWEngineOptions.lifeMasterBy); }

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


		// horosa_panel_ready_v1:本次交互的**唯一**落数点 —— 中栏(12 宫 SVG,读 result/luckSel)与
		// 右栏(命盘/运限/格局,读 result/rules/luckSel)同吃这一次 setState,故接在它的回调上即
		// 「中栏+右栏都拿到最终数据」。上面本地引擎段(calcZiwei+deriveSanPan+detectPatterns,50-200ms)
		// 是本次 setState **之前**的同步开销,因而被完整计入本段。markPanelReady 内部再用双 rAF
		// 逼近「本帧已绘」。技法 key 用顶层页签的 'ziwei'(与 pages/index.js markInteractionStart 同源)。
		this.setState(st, ()=>{
			markPanelReady('ziwei');
			// R4-B2(b′):紫微步进走本地漏斗(onFieldsChange→astro/save+直调本方法,不经
			// fetchByFields)⇒ settle 武装必须在这里自己做,否则登记的 /ziwei/birth 预取器
			// 在本页步进路径上永不触发。skipChart:/chart 不在本页步进路径上(chartFree)。
			try{ armStepPrefetch('local-settle', { fieldsOverride: fields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
		});
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

	// horosa_freeze_subtabs_v1:右栏页签受控切换。仅记 rightTab,不触发任何请求/重排。
	onRightTabChange(key){
		if(key === this.state.rightTab){
			return;
		}
		// horosa_panel_ready_v1 配对起点:owner 验收口径含「换页签」,而右栏换页签是纯本地 setState,
		// 不经 changeCond → 不打起点就永远量不到。首次激活某页签时 FreezeSubTab 会在这一帧真正
		// 首渲该面板(运限轴/格局全表),正是该被计入的那段开销。
		markInteractionStart('ziwei');
		this.setState({ rightTab: key }, ()=>{ markPanelReady('ziwei'); });
	}

	// 稳定引用的「AI解读」跳转(原为 ZWLuckPanel 的内联 onAi 箭头)。
	openAiAnalysis(){
		this.navigateFeature('aianalysis');
	}

	// 运限 tab(ZWLuckPanel) 受控上报：直接落 luckSel 单一真值源（与九宫格同源）。选运限层即清童限高亮(互斥)。
	onLuckSelChange(next){
		// horosa_panel_ready_v1 配对起点:运限页签点 大限/流年/流月/流日/流时 chip 的落点(纯本地)。
		markInteractionStart('ziwei');
		this.setState({ luckSel: next || emptyLuckSel(), tonglianHi: null }, ()=>{ markPanelReady('ziwei'); });
	}

	// 童限/中限点选:高亮对应本命宫(金框);再点同宫取消。与 luckSel 互斥(设童限即以其为高亮源)。
	onTonglianHighlight(idx){
		this.setState((s)=>({ tonglianHi: (s.tonglianHi === idx ? null : idx) }));
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
		// horosa_panel_ready_v1 配对起点:快捷栏「运限对齐今天」(纯本地,同 onChangeDirection 口径)。
		markInteractionStart('ziwei');
		this.setState({ luckSel: sel }, ()=>{ markPanelReady('ziwei'); });
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
					{ key: 'luckClear', label: '清除运限', icon: 'quickReturn', disabled: !hasChart || !hasLuck, onClick: ()=>{ markInteractionStart('ziwei'); this.setState({ luckSel: emptyLuckSel() }, ()=>{ markPanelReady('ziwei'); }); } },
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
	// horosa_ziwei_state_slice_v1:state 由「引用比」细化为「按键浅比 + 白名单剔无关键」。
	// 变化点仅一个:只有 indicator / cnt 变(render 不读它们)时不再整树重渲;其余任何 state 变化
	// (result/rules/luckSel/updating/tips/centerInfoVisible/rightTab/未知新键)行为与之前逐字一致。
	// kill-switch 同 chartSCU:关掉 → 回到「state 引用一变即重渲」的旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			if(!chartSCUEnabled()){
				return true;
			}
			if(ziweiStateAffectsRender(this.state, nextState)){
				return true;
			}
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
			// 纯显示层开关(杂曜/十二神)不进请求体,重新请求必被 requestDedupe 挡住;
			// 只递增一枚版本号并透传给 ZiWeiChart —— 唯一能让盘面真正重绘的通道。
			this._zwDisplayListener = (ev) => {
				if(this.unmounted){ return; }
				// [P2a] 命主取法运行时切换:Java 盘(非本地引擎)就地重派生 —— chart 引用不变不改签名,
				// 恰由本次 rev 递增强制重绘中宫;本地引擎盘在下次重排时按 opts 取,不在此就地改
				// (观察盘 lifeHouseIndex 是移过的,就地重算会错基)。
				try{
					const d = ev && ev.detail;
					if(d && d.key === 'lifeMasterBy' && this.state.result && this.state.result.chart && !ziweiNeedsLocalEngine()){
						const c = this.state.result.chart;
						if(d.value === 'ming_branch'){ applyLifeMasterOption(c, 'ming_branch'); }
						else if(c.yearZi){
							// 切回生年支:交互路径显式恢复(applyLifeMasterOption 默认恒 no-op 保基线)
							const { LIFE_MASTER } = require('./data/ziweiTables');
							if(LIFE_MASTER[c.yearZi]){ c.lifeMaster = LIFE_MASTER[c.yearZi]; }
						}
					}
				}catch(e){ /* 派生失败不阻断重绘 */ }
				this.setState((s) => {
					const st = { zwDisplayRev: (s.zwDisplayRev || 0) + 1 };
					// [B15b] 运限口径改档(小限顺逆/流年四化取干/流月起法/preset 批量套…)→ 已选运限快照
					// 整链重派生:luckSel 存的是点击时刻的 build 快照,口径变了不重派生就与按钮列表自相矛盾
					// (实测:改小限顺逆后芯片已按新口径,详情卡/叠宫层/金框/AI period 仍旧口径)。
					// rederiveLuckSel 幂等(口径未变时逐层值等)→ 全键触发不设白名单,新增口径键零登记成本。
					try{
						let c = this.state.result && this.state.result.chart;
						if(c && c.dualAlt && s.dualView === 'next'){ c = c.dualAlt; }
						if(c && s.luckSel){ st.luckSel = rederiveLuckSel(c, s.luckSel); }
					}catch(e2){ /* 重派生失败保留原选择,不阻断重绘 */ }
					return st;
				});
			};
			window.addEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, this._zwDisplayListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.props.fields){
			this.requestZiWei(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._ziweiStepPrefetcher){
			try{ unregisterStepPrefetcher('ziwei', this._ziweiStepPrefetcher); }catch(e){ /* ignore */ }
			this._ziweiStepPrefetcher = null;
		}
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined' && this._zwDisplayListener){
			window.removeEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, this._zwDisplayListener);
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
			// [B10-fix] 流年层四化干消费期现算:盘面星徽与面板/快照三处恒同源(切档即追新)
			sihuaGan: ZiWeiHelper.effLayerSihuaGan(chart, l),
			periodColor: isHuaColored(l.key) ? null : ZWConst.ZWPeriodColor[l.key],
		}));
		// [D3] 小限叠宫层:开关开才插「限」标签层(默认关=零回归;快照/挂载链不经此,恒不含)。
		const labelLayers = ZiWeiHelper.luckLabelLayers(sel, ZiWeiHelper.zwShowXiaoxianLayer()).map((l)=>({
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
			// [D1] 自化常显:开关开=无视滑窗勾选恒显自化(默认关=原勾选行为)
			showZihua: win.showZihua || ZiWeiHelper.zwZihuaAlways(),
			labelLayers,
			// [D3] 流年神煞上盘用:选中流年的地支(绘制期替换判据;未选=null=恒不替换)。
			flowZhi: (sel.liunian && sel.liunian.zhi) || null,
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

		// 无盘时用模块级稳定空对象(原为每次 render 新建 {} → 下游引用比恒不等 → 白重绘)。
		let chart = this.state.result ? this.state.result.chart : ZW_EMPTY_CHART;
		// 晚子双盘(WP-8):当日盘为 primary、次日盘挂 chart.dualAlt;选「次日盘」则下游全用 dualAlt(luck/info/盘面一致)。
		const dualAlt = chart && chart.dualAlt ? chart.dualAlt : null;
		if(dualAlt && this.state.dualView === 'next'){ chart = dualAlt; }
		const luckRender = this.buildLuckRender(chart);
		let doms = this.genDirectionDom(chart);
		let infoData = buildZiWeiInfoData(chart, this.props.fields);

		let tipheight = 270;
		let docwid = document.documentElement.clientWidth;
		if(docwid <= 1440){
			tipheight = 120;
		}

		// 童限/中限点选高亮:覆盖 luckMingIndex(金框),并入重绘 key(否则守卫认为盘未变不重画)。
		const effMingIndex = this.state.tonglianHi != null ? this.state.tonglianHi : luckRender.luckMingIndex;
		const effLuckKey = `${luckRender.key}|tl${this.state.tonglianHi == null ? '' : this.state.tonglianHi}`;

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
							{dualAlt ? (
								<div className="horosa-ziwei-dual-toggle" style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0' }}>
									{[['day', '当日盘'], ['next', '次日盘']].map(([k, lab])=>(
										<button key={k} type="button"
											onClick={()=>this.setState({ dualView: k, luckSel: emptyLuckSel(), tonglianHi: null })} /* 双盘宫位必错位(differ 判据),旧 luckSel 的 mingIndex 会把运限金框/运X/AI period 标到错宫 */
											style={{ padding: '3px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
												border: '1px solid var(--horosa-gold, #dab16f)',
												background: this.state.dualView === k ? 'var(--horosa-gold, #dab16f)' : 'transparent',
												color: this.state.dualView === k ? '#1a1a1a' : 'var(--horosa-gold, #dab16f)' }}>
											{lab}
										</button>
									))}
								</div>
							) : null}
							<div className="horosa-ziwei-chart-viewport" data-capture-chart-only>
								<ZiWeiChart
									value={chart}
									height="100%"
									zwDisplayRev={this.state.zwDisplayRev || 0}
									fields={this.props.fields}
									dirIndex={luckRender.dirIndex}
									luckMingIndex={effMingIndex}
									luckSihuaLayers={luckRender.sihuaLayers}
									luckShowZihua={luckRender.showZihua}
									luckLabelLayers={luckRender.labelLayers}
									luckFlowZhi={luckRender.flowZhi}
									luckKey={effLuckKey}
									indicate={this.indicate}
									rules={this.state.rules}
									onTipClick={this.onTipClick}
									onCenterInfoClick={this.openCenterInfo}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-ziwei-info-panel">
							{/* 星阙金 W1 试点:XQTabs 自带 xq-tabs 基线(金 ink-bar 2px+三态字色);W2 全量收编 content-tabs 族 */}
						{/* horosa_freeze_subtabs_v1:受控 Tabs + 每面板 FreezeSubTab。
						    非激活面板在父组件重渲(切时间/改选项/点大限)时跳过 re-render;
						    冻结≠卸载 —— 已渲染过的面板保留 DOM/实例/滚动位置与展开态,切回即拿最新 children 渲一帧。*/}
						<Tabs activeKey={this.state.rightTab} onChange={this.onRightTabChange} tabPosition='top' className="horosa-content-tabs horosa-ziwei-tabs">
								<TabPane tab="命盘" key="info">
									<FreezeSubTab active={this.state.rightTab === 'info'}>
										{()=>this.renderZiWeiInfoPanel(infoData, doms, tipheight)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="运限" key="luck">
									<FreezeSubTab active={this.state.rightTab === 'luck'}>
										{()=>(
											<ZWLuckPanel
												chart={chart}
												value={this.state.luckSel}
												onChange={this.onLuckSelChange}
												tonglianHi={this.state.tonglianHi}
												onTonglianHighlight={this.onTonglianHighlight}
												onAi={this.openAiAnalysis}
											/>
										)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="格局" key="patterns">
									<FreezeSubTab active={this.state.rightTab === 'patterns'}>
										{()=>(
											<ZWPatternPanel patterns={this.state.result ? this.state.result.patterns : ZW_EMPTY_PATTERNS} />
										)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="资料参考" key="2">
									<FreezeSubTab active={this.state.rightTab === '2'}>
										{()=>(
											<ZWRuleMain height={height} rules={this.state.rules} />
										)}
									</FreezeSubTab>
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
