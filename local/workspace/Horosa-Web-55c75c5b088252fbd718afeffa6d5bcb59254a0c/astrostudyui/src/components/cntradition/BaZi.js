import { Component, memo } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { markPanelReady } from '../../utils/perfMark';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { XQTabs as Tabs } from '../xq-ui';
import CnTraditionInput from './CnTraditionInput';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import PaiBaZi, { BAZI_CHART_STYLE_KEY } from './PaiBaZi';
import Gods from './Gods';
import GanHeCong from './GanHeCong';
import ZiHeCong from './ZiHeCong';
import BaZiZhangSheng from './BaZiZhangSheng';
import FourZhuGuaDesc from './FourZhuGuaDesc';
import BaZiLuckFlowPanel from './BaZiLuckFlowPanel';
import BaZiAppInfoPanel from './BaZiAppInfoPanel';
import { BaZiLegacyMain, BaZiLegacyInfoPanel } from './BaZiLegacyView';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { Solar } from 'lunar-javascript';
import { buildLocalBaziResult, buildFlowDays, buildFlowHours, buildFlowMonthsByYear, getSelfZuo } from '../../utils/baziLunarLocal';
import { filterShenShaByGroups } from '../../utils/baziShenShaLocal';
import { parseDateParts } from '../../utils/dateStrSafe';

const TabPane = Tabs.TabPane;

// horosa_bazi_child_memo_v1（PERF-R9 Ship 6·八字族）：左栏输入面板与行运面板【不消费】flowSelection，
// 但它们是本页最重的两块 DOM(行运面板 = 大运×流年×流月×流日 四轴网格)。点一次大运格 → 顶层
// setState({flowSelection}) → 整树重渲 → 这两块白跑。memo 默认浅比:props 引用全同才跳过,
// 任一 props 变(fields/baziOpt/directResult/loading/error/jieqiParams…)照常重渲 → 零陈旧、零降级。
// 前提(已满足):传给它们的回调都是构造函数里 bind 的稳定引用;jieqiParams 由 memoBaziParams 稳定化。
const MemoCnTraditionInput = memo(CnTraditionInput);
const MemoBaZiLuckFlowPanel = memo(BaZiLuckFlowPanel);
// render 期的稳定空对象：原先每次 render 写字面量 {} 会让下游 memo/sCU 的引用比恒不等。
const EMPTY_BAZI = {};
const EMPTY_PARAMS = {};

const BaZiOptKey = 'baziopt';
const BAZI_CORE_ENDPOINT = '/bazi/birth';
const BAZI_DIRECT_ENDPOINT = '/bazi/direct';

function gzText(zhu){
	if(!zhu){
		return '';
	}
	const gan = zhu.stem && zhu.stem.cell ? zhu.stem.cell : '';
	const zhi = zhu.branch && zhu.branch.cell ? zhu.branch.cell : '';
	const relGan = zhu.stem && zhu.stem.relative ? `，干十神:${zhu.stem.relative}` : '';
	const relZhi = zhu.branch && zhu.branch.relative ? `，支十神:${zhu.branch.relative}` : '';
	return `${gan}${zhi}${relGan}${relZhi}`;
}

// 四柱与三元段·每柱补充明细（段内纯增）：藏干/纳音/星运/自坐/空亡，与中栏四柱板（BaZiFineChart）同源——
// 藏干=zhu.stemInBranch（hiddenStemText 同式「干+十神」）、纳音=zhu.naying、星运=getSelfZuo(日干,本柱支)、
// 自坐=getSelfZuo(本柱干,本柱支)（BaZiFineChart 星运/自坐行同式）、空亡=zhu.xunEmpty（Zhu 旬空同字段）。
// 子项缺数据即省略；全空返回 ''（不产占位）。仅四柱行调用（gzText 本体不动，流年/大运等其它调用处输出零变化）。
function gzDetailText(zhu, dayGan, phaseType){
	if(!zhu){
		return '';
	}
	const parts = [];
	const hidden = Array.isArray(zhu.stemInBranch)
		? zhu.stemInBranch.map((item)=>`${(item && item.cell) || ''}${(item && item.relative) || ''}`).filter(Boolean)
		: [];
	if(hidden.length){
		parts.push(`藏干：${hidden.join('、')}`);
	}
	if(zhu.naying){
		parts.push(`纳音：${zhu.naying}`);
	}
	const stemCell = zhu.stem && zhu.stem.cell ? zhu.stem.cell : '';
	const branchCell = zhu.branch && zhu.branch.cell ? zhu.branch.cell : '';
	const xingYun = getSelfZuo(dayGan, branchCell, phaseType);
	if(xingYun){
		parts.push(`星运：${xingYun}`);
	}
	const ziZuo = getSelfZuo(stemCell, branchCell, phaseType);
	if(ziZuo){
		parts.push(`自坐：${ziZuo}`);
	}
	if(zhu.xunEmpty){
		parts.push(`空亡：${zhu.xunEmpty}`);
	}
	return parts.length ? `（${parts.join('；')}）` : '';
}

// [四柱与三元]4 主柱 GFM 表化用:把 gzText/gzDetailText 的同源值逐字拆成单元格(干支/藏干/十神/纳音/星运/自坐/空亡)。
// 值表达式与 gzText/gzDetailText 逐字同源(stem.cell/branch.cell/relative、stemInBranch、naying、getSelfZuo、xunEmpty)。
function gzCells(zhu, dayGan, phaseType){
	const gan = zhu && zhu.stem && zhu.stem.cell ? zhu.stem.cell : '';
	const zhi = zhu && zhu.branch && zhu.branch.cell ? zhu.branch.cell : '';
	const stemRel = zhu && zhu.stem && zhu.stem.relative ? zhu.stem.relative : '';
	const branchRel = zhu && zhu.branch && zhu.branch.relative ? zhu.branch.relative : '';
	const hidden = zhu && Array.isArray(zhu.stemInBranch)
		? zhu.stemInBranch.map((item)=>`${(item && item.cell) || ''}${(item && item.relative) || ''}`).filter(Boolean)
		: [];
	return {
		ganzhi: `${gan}${zhi}` || '—',
		cang: hidden.length ? hidden.join('、') : '—',
		shishen: [stemRel, branchRel].filter(Boolean).join('·') || '—',
		naying: (zhu && zhu.naying) || '—',
		xingYun: getSelfZuo(dayGan, zhi, phaseType) || '—',
		ziZuo: getSelfZuo(gan, zhi, phaseType) || '—',
		kong: (zhu && zhu.xunEmpty) || '—',
	};
}

// 多运限段数封顶（批A）：流年/流月/流日/流时合计封顶，防快照爆；超限截断 + 提示行。
const BAZI_PERIOD_MAX_SEGMENTS = 50;
const SHICHEN_LABEL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 节气月号 1–12 → 该月起始「节」名（立春=1…小寒=12；万年不变常量，镜像 BaZiLuckFlowPanel.FLOW_JIEQI_TERMS）。
// 用于按节气月号匹配 flowMonths（生年的 flowMonths 会过滤掉出生前的早月、数组<12 项，不能用数组下标 ord-1 索引）。
const FLOW_MONTH_TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
// 按节气月号 ord(1–12) 在某流年的 flowMonths 中找对应项（按 term 匹配，非数组下标）。找不到 → null（生年早月被过滤）。
function findFlowMonthByOrd(months, ord){
	const term = FLOW_MONTH_TERMS[ord - 1];
	if(!term || !Array.isArray(months)){
		return null;
	}
	return months.find((m)=>m && m.term === term) || null;
}

// 在全部 direction 板块的 subDirect 中找某公历年的流年项（含其 ganzi/flowMonths）。
function findBaziLiunian(bazi, year){
	const blocks = (bazi && Array.isArray(bazi.direction)) ? bazi.direction : [];
	for(let i = 0; i < blocks.length; i++){
		const subs = (blocks[i] && Array.isArray(blocks[i].subDirect)) ? blocks[i].subDirect : [];
		const hit = subs.find((s)=>Number(s.year) === year);
		if(hit){
			return hit;
		}
	}
	return null;
}

// 多运限段（批A）：流年/流月读现成 subDirect[].flowMonths；流日/流时调 buildFlowDays/Hours（与四柱同口径）。
// period={liunian:[year...], liuyue:[月序1–12...], liuri:[公历日...], liushi:[时辰序0–11...]}。
// 语义：流年/流月对所选每项各一段（流年×流月笛卡尔）；流日/流时锚定到所选的第一个上层。总段数封顶。
function buildBaziPeriodLines(bazi, period, params){
	if(!bazi || !period){
		return [];
	}
	const arr = (v)=>(Array.isArray(v) ? v : []);
	const liunianSel = arr(period.liunian);
	const liuyueSel = arr(period.liuyue);
	const liuriSel = arr(period.liuri);
	const liushiSel = arr(period.liushi);

	const four = bazi.fourColumns || {};
	const dayGz = gzText(four.day);
	const dayGan = (four.day && (four.day.ganzi || four.day.ganZhi) ? `${four.day.ganzi || four.day.ganZhi}` : `${dayGz}`).charAt(0);
	// perf 惰性化：非「当前公历年所在大运」的流年 flowMonths=null（buildLocalBaziResult 只 eager 算当前大运）。
	// 多运限读到 null 时按公历年 on-demand 补算（buildFlowMonthsByYear，与 eager 逐字等价）。birthSolar 仅用于
	// 生年早月过滤（大运流年几乎非生年，不影响），由 params.date 重建。
	let birthSolar = null;
	try{
		if(params && params.date){
			const _bp = parseDateParts(`${params.date}`) || {};
			const by = _bp.year, bm = _bp.month, bd = _bp.day;
			if(Number.isFinite(by) && Number.isFinite(bm) && Number.isFinite(bd)){
				birthSolar = Solar.fromYmd(by, bm, bd);
			}
		}
	}catch(e){ birthSolar = null; }
	const flowMonthsOf = (ln)=>{
		if(ln && Array.isArray(ln.flowMonths)){
			return ln.flowMonths;
		}
		if(ln && ln.flowMonths === null && Number.isFinite(Number(ln.year))){
			return buildFlowMonthsByYear(Number(ln.year), birthSolar, dayGan);
		}
		return [];
	};

	const body = [];
	let truncated = false;
	const pushLine = (line)=>{
		if(truncated){ return; }
		if(body.length >= BAZI_PERIOD_MAX_SEGMENTS){ truncated = true; return; }
		body.push(line);
	};
	const flowText = (item)=>gzText(item) || `${(item && (item.ganzi || item.ganZhi)) || ''}`;

	// 1) 流年：每个所选公历年各一段。
	liunianSel.forEach((year)=>{
		const ln = findBaziLiunian(bazi, year);
		if(ln){
			pushLine(`流年：${year}年 ${flowText(ln)}`);
		}else{
			pushLine(`流年：${year}年（超出大运范围，未列流年）`);
		}
	});

	// 流月/流日/流时所需的基准年集合：所选流年；若未选流年，则用大运数据里最早的流年兜底（绝不抛）。
	const firstAvailYear = (()=>{
		const blocks = Array.isArray(bazi.direction) ? bazi.direction : [];
		for(let i = 0; i < blocks.length; i++){
			const subs = (blocks[i] && Array.isArray(blocks[i].subDirect)) ? blocks[i].subDirect : [];
			if(subs.length && Number.isFinite(Number(subs[0].year))){
				return Number(subs[0].year);
			}
		}
		return null;
	})();
	const baseYears = liunianSel.length ? liunianSel : (firstAvailYear !== null ? [firstAvailYear] : []);

	// 2) 流月：流年 × 流月（节气月序1–12）笛卡尔。
	// 坑修：按节气月号(term)匹配 flowMonths，而非数组下标 ord-1。生年的 flowMonths 从「出生月之节气」起过滤
	// （数组<12 项），用 months[ord-1] 会整体错位、且选「第1月」可能取到非立春月或落空被静默丢。改 term 匹配后
	// 非生年逐字不变（全 12 项时 term 顺序 === ord 顺序），生年缺的早月 → 打印提示行而非静默丢。
	if(liuyueSel.length){
		baseYears.forEach((year)=>{
			const ln = findBaziLiunian(bazi, year);
			const months = flowMonthsOf(ln);
			liuyueSel.forEach((ord)=>{
				const fm = findFlowMonthByOrd(months, ord);
				if(fm){
					// 第12月(小寒)是命理年最后一个节气月,其公历日期落在「次年」年初(spillover,见 baziLunarLocal buildFlowMonths
					// year+1 分支)。故 date 显次年-01-… 属正常,加「(跨次年初)」注明,免与行首 ${year}年 看似错位。
					const crossYearNote = ord === 12 ? '（跨次年初）' : '';
					pushLine(`流月：${year}年 第${ord}月（${fm.term || ''}，${fm.date || ''}${crossYearNote}）${flowText(fm)}`);
				}else{
					pushLine(`流月：${year}年 第${ord}月（${FLOW_MONTH_TERMS[ord - 1] || ''}）（生年此月在出生前/无）`);
				}
			});
		});
	}

	// 锚定上层：流日 → 第一个 (流年, 流月)；流时 → 第一个 (流年, 流月, 流日)。
	const anchorYear = baseYears.length ? baseYears[0] : null;
	const anchorLn = anchorYear !== null ? findBaziLiunian(bazi, anchorYear) : null;
	const anchorMonths = flowMonthsOf(anchorLn);
	// 锚定流月对象（取所选首月序，否则首个 flowMonth）→ 其公历 (year, month) 供枚举流日。
	// 按节气月号匹配（与流月段同口径）；生年所选首月若被过滤则回退首个可用 flowMonth，避免流日/流时锚定落空。
	const anchorFm = liuyueSel.length
		? (findFlowMonthByOrd(anchorMonths, liuyueSel[0]) || anchorMonths[0])
		: anchorMonths[0];

	// 3) 流日：buildFlowDays(锚定流月的公历 year, month)；对每个所选日各一段。
	if(liuriSel.length && anchorFm && Number.isFinite(anchorFm.year) && Number.isFinite(anchorFm.month)){
		const days = buildFlowDays(anchorFm.year, anchorFm.month, dayGan);
		liuriSel.forEach((d)=>{
			const fd = days.find((x)=>x.day === d);
			if(fd){
				pushLine(`流日：${fd.date || `${anchorFm.year}-${anchorFm.month}-${d}`} ${flowText(fd)}`);
			}
		});
	}

	// 4) 流时：buildFlowHours(锚定流月公历 year, month, 首个所选流日)；对每个所选时辰各一段。
	if(liushiSel.length && anchorFm && Number.isFinite(anchorFm.year) && Number.isFinite(anchorFm.month)){
		const anchorDay = liuriSel.length ? liuriSel[0] : 1;
		const hours = buildFlowHours(anchorFm.year, anchorFm.month, anchorDay, dayGan);
		liushiSel.forEach((h)=>{
			const fh = hours.find((x)=>x.hourIdx === h);
			if(fh){
				pushLine(`流时：${anchorFm.year}-${anchorFm.month}-${anchorDay} ${SHICHEN_LABEL[h] || h}时 ${flowText(fh)}`);
			}
		});
	}

	if(body.length === 0){
		return [];
	}
	const lines = ['', '[多运限·指定时段]'];
	body.forEach((l)=>lines.push(l));
	if(truncated){
		lines.push(`（多运限段已达上限 ${BAZI_PERIOD_MAX_SEGMENTS} 段，余下所选组合已省略）`);
	}
	return lines;
}

function buildBaziSnapshotText(params, result){
	const bazi = result && result.bazi ? result.bazi : {};
	const four = bazi.fourColumns || {};
	const lines = [];
	const labelMap = {
		gender: {
			'-1': '未知',
			'0': '女',
			'1': '男',
		},
		timeAlg: {
			'0': '真太阳时',
			'1': '直接时间',
			'2': '春分定卯时',
		},
		adjustJieqi: {
			'0': '不调整节气',
			'1': '节气按纬度调整',
		},
	};
	const getGz = (item)=>{
		if(!item){
			return '';
		}
		return item.ganzhi || item.ganzi || item.ganZhi || '';
	};
	const formatLabel = (dictName, value)=>{
		const dict = labelMap[dictName] || {};
		const key = `${value}`;
		if(dict[key] !== undefined){
			return dict[key];
		}
		return value;
	};
	const getNongliLine = (nongli)=>{
		if(!nongli){
			return '';
		}
		const leap = nongli.leap ? '闰' : '';
		return `${nongli.year || ''}年${leap}${nongli.month || ''}${nongli.day || ''}`;
	};
	const appendIf = (label, value)=>{
		if(value === undefined || value === null || value === ''){
			return;
		}
		lines.push(`${label}：${value}`);
	};
	const collectGodNames = (node)=>{
		if(!node){
			return [];
		}
		const all = [];
		if(Array.isArray(node.goodGods)){
			all.push(...node.goodGods);
		}
		if(Array.isArray(node.neutralGods)){
			all.push(...node.neutralGods);
		}
		if(Array.isArray(node.badGods)){
			all.push(...node.badGods);
		}
		// 神煞分组过滤(所见即所得:快照与面板同一 groups;默认全开=原样零回归)。
		return filterShenShaByGroups(all.filter(Boolean), params && params.shenshaGroups);
	};
	const gzGodText = (zhu)=>{
		if(!zhu){
			return '无';
		}
		const whole = collectGodNames(zhu);
		const stem = collectGodNames(zhu.stem);
		const branch = collectGodNames(zhu.branch);
		const taiSui = zhu.branch && Array.isArray(zhu.branch.taisuiGods) ? zhu.branch.taisuiGods.filter(Boolean) : [];
		const wholeTxt = whole.length ? whole.join('、') : '无';
		const stemTxt = stem.length ? stem.join('、') : '无';
		const branchTxt = branch.length ? branch.join('、') : '无';
		const taiSuiTxt = taiSui.length ? taiSui.join('、') : '无';
		return `整柱=${wholeTxt}；天干=${stemTxt}；地支=${branchTxt}；太岁=${taiSuiTxt}`;
	};
	let baziGender = bazi && bazi.gender === 'Female' ? '坤造' : (bazi && bazi.gender === 'Male' ? '乾造' : '');
	if(!baziGender){
		if(Number(params.gender) === 0){
			baziGender = '坤造';
		}else if(Number(params.gender) === 1){
			baziGender = '乾造';
		}
	}

	lines.push('[起盘信息]');
	appendIf('日期', `${params.date} ${params.time}`);
	appendIf('时区', params.zone);
	appendIf('经纬度', `${params.lon} ${params.lat}`);
	appendIf('性别', formatLabel('gender', params.gender));
	appendIf('时间算法', formatLabel('timeAlg', params.timeAlg));
	appendIf('节气修正', formatLabel('adjustJieqi', params.adjustJieqi));
	appendIf('命造', baziGender);
	const nongli = bazi && bazi.nongli ? bazi.nongli : {};
	const nltxt = getNongliLine(nongli);
	const clockTm = nongli.clockTime || `${params.date} ${params.time}`;
	const solarTm = nongli.solarTime || nongli.birth || `${params.date} ${params.time}`;
	lines.push(`农历：${nltxt || '未知'}`);
	lines.push(`直接时间：${clockTm || '未知'}　真太阳时：${solarTm || '未知'}`);
	const jiedelta = nongli.jiedelta || '';
	const chef = nongli.chef || '';
	const tiaohou = Array.isArray(bazi.tiaohou) ? bazi.tiaohou.join('，') : '';
	const fixedLine = [jiedelta, chef].filter(Boolean).join('，');
	const fixedBase = (fixedLine || '立春后信息：无').replace(/[；，\s]+$/g, '');
	lines.push(`${fixedBase}； 调候：${tiaohou || '无'}`);

	lines.push('');
	lines.push('[四柱与三元]');
	// 每柱行尾补明细括注（藏干/纳音/星运/自坐/空亡，中栏四柱板同源）；行首「干支+干支十神」前缀逐字不动（段内纯增）。
	const dayGanCell = four.day && four.day.stem ? four.day.stem.cell : '';
	lines.push('| 柱 | 干支 | 藏干 | 十神 | 纳音 | 星运 | 自坐 | 空亡 |');
	lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
	[['年柱', four.year], ['月柱', four.month], ['日柱', four.day], ['时柱', four.time]].forEach(([label, zhu])=>{
		const c = gzCells(zhu, dayGanCell, params && params.phaseType);
		lines.push(`| ${label} | ${c.ganzhi} | ${c.cang} | ${c.shishen} | ${c.naying} | ${c.xingYun} | ${c.ziZuo} | ${c.kong} |`);
	});
	lines.push(`胎元：${gzText(four.tai)}`);
	lines.push(`命宫：${gzText(four.ming)}（起法：${(params && params.minggongMethod === 'shufa') ? '子平数法' : '通行版'}）`);
	lines.push(`身宫：${gzText(four.shen)}`);

	lines.push('');
	lines.push('[神煞（四柱与三元）]');
	lines.push(`年柱：${gzGodText(four.year)}`);
	lines.push(`月柱：${gzGodText(four.month)}`);
	lines.push(`日柱：${gzGodText(four.day)}`);
	lines.push(`时柱：${gzGodText(four.time)}`);
	lines.push(`胎元：${gzGodText(four.tai)}`);
	lines.push(`命宫：${gzGodText(four.ming)}`);
	lines.push(`身宫：${gzGodText(four.shen)}`);

	if(bazi.wuxingStat && Array.isArray(bazi.wuxingStat.scores) && bazi.wuxingStat.scores.length){
		const st = bazi.wuxingStat;
		lines.push('');
		lines.push('[五行力量]');
		lines.push(st.cangVersion === 'fenye'
			? '（分野加权：天干100/本气100/中气60/余气30；月柱仅当令司令吃月令×1.5，余月支藏干不加月乘）'
			: '（通行示例权重：天干100/本气100/中气60/余气30/月令×1.5）');
		lines.push('| 五行 | 占比 |');
		lines.push('| --- | --- |');
		st.scores.forEach((s)=>{ lines.push(`| ${s.label} | ${s.percent}% |`); });
		lines.push(`最旺：${st.dominant}　最弱：${st.weakest}`);
		if(st.dayMaster){
			lines.push(`日主${st.dayMaster.element}：${st.dayMaster.verdict}（同党印比 ${st.dayMaster.samePercent}% · 异党 ${Math.round((100 - st.dayMaster.samePercent) * 10) / 10}%）`);
		}
		if(st.dimensions){
			const d = st.dimensions;
			lines.push(`三维分列：${d.summary}`);
			if(d.deLing){ lines.push(`· 得令：月令${d.deLing.state}（${d.deLing.score > 0 ? '+' : ''}${d.deLing.score}）`); }
			if(d.deDi && d.deDi.roots && d.deDi.roots.length){
				lines.push(`· 得地：${d.deDi.roots.map((r)=>`${r.pillar}${r.branch}(${r.type})`).join('、')}（+${d.deDi.score}）`);
			}else{
				lines.push('· 得地：四支无根（虚浮）');
			}
			if(d.deShi && d.deShi.count){
				lines.push(`· 得势：${d.deShi.stems.map((s)=>`${s.pillar}${s.gan}(${s.rel})`).join('、')}（+${d.deShi.score}）`);
			}else{
				lines.push('· 得势：印比不透干');
			}
		}
	}

	if(bazi.gejuYongShen && (bazi.gejuYongShen.geju || bazi.gejuYongShen.yongshen)){
		const gy = bazi.gejuYongShen;
		const SCHOOL_LABEL = { zonghe: '传统综合', fuyi: '扶抑派', geju: '格局派', tiaohou: '调候派', bingyao: '病药派', mangpai: '盲派', nayin: '纳音古法' };
		lines.push('');
		lines.push('[格局·用神]');
		lines.push(`当前主用流派：${SCHOOL_LABEL[(params && params.school)] || '传统综合'}（各派取用可异，下列多派对照）`);
		if(gy.geju){
			lines.push(`格局：${gy.geju.name}（月令${gy.geju.tenGod || '—'}·${gy.geju.via}）`);
		}
		if(gy.chengBai){
			lines.push(`成败：${gy.chengBai.verdict}——${gy.chengBai.reason}（${gy.chengBai.note}）`);
		}
		if(Array.isArray(gy.schools) && gy.schools.length){
			lines.push('多派用神对照：');
			lines.push('| 流派 | 喜用 | 忌 | 备注 |');
			lines.push('| --- | --- | --- | --- |');
			gy.schools.forEach((s)=>{
				lines.push(`| ${s.school}${s.verdict ? `·${s.verdict}` : ''} | ${(s.xi && s.xi.join('·')) || '—'} | ${(s.ji && s.ji.length ? s.ji.join('·') : '—')} | ${s.note} |`);
			});
		}else if(gy.yongshen){
			const yo = gy.yongshen;
			lines.push(`用神（${yo.school}·${yo.verdict}）：喜用 ${yo.xi.join('·') || '—'}　忌 ${yo.ji.join('·') || '—'}`);
			lines.push(`说明：${yo.note}`);
		}
		if(Array.isArray(gy.bianGe) && gy.bianGe.length){
			lines.push('疑似变格（需复核）：');
			gy.bianGe.forEach((b)=>{
				lines.push(`· ${b.type}·${b.name}（${b.cond}）→ 若成立用${b.yong}、忌${b.bei}；${b.note}`);
			});
		}
		if(Array.isArray(gy.zaGe) && gy.zaGe.length){
			lines.push('杂格（正格优先，需复核填实刑冲；虚邀暗冲类附真/假判定）：');
			gy.zaGe.forEach((b)=>{
				const tag = b.quality ? `【${b.quality}${b.broken && b.broken.length ? `·${b.broken.join('、')}` : ''}】` : '';
				lines.push(`· ${b.name}${tag}（${b.cond}）：${b.note}`);
			});
		}
	}

	if(bazi.mangpai && Array.isArray(bazi.mangpai.cells)){
		const mp = bazi.mangpai;
		lines.push('');
		lines.push('[盲派结构]');
		lines.push('（象法·参考，与扶抑/格局体系不同）');
		lines.push(`宾主：${mp.cells.map((c)=>`${c.label}${c.role}(${c.gan}${c.zhi})`).join(' ')}`);
		if(mp.zuogong && mp.zuogong.length){
			lines.push('做功路线：');
			mp.zuogong.forEach((z)=>lines.push(`· ${z.text}`));
		}else{
			lines.push('做功：主位之体未直接取宾位之用（多看刑冲合害引动）。');
		}
		if(mp.feishen && mp.feishen.length){ lines.push(`废神：${mp.feishen.join('、')}`); }
	}

	if(bazi.fenYe && bazi.fenYe.ruler){
		const fy = bazi.fenYe;
		lines.push('');
		lines.push('[月令司令（分野）]');
		lines.push(`版本：${fy.versionLabel}`);
		lines.push(`节后 ${fy.daysAfterJie} 日，当令：${fy.ruler.gan}（${fy.ruler.pos}）`);
		lines.push(`轮值：${fy.segments.map((s)=>`${s.gan}${s.pos}${s.days}日`).join(' → ')}`);
	}

	if(bazi.mainDirection && bazi.mainDirection.length){
		lines.push('');
		lines.push('[大运]');
		// [v2 排版批量·表化] 同构逐条行改 GFM 表（紫微宫位总览范式）：段头/值表达式零变更
		// （第N步/item.year/getGz 逐字复用），仅排版骨架换表头+分隔行+数据行；归一器/docx/PDF 表块直通。
		lines.push('| 步序 | 起运年 | 干支 |');
		lines.push('| --- | --- | --- |');
		bazi.mainDirection.forEach((item, idx)=>{
			const y = item.year !== undefined ? `${item.year}` : '';
			const gz = getGz(item);
			lines.push(`| 第${idx + 1}步 | ${y} | ${gz} |`);
		});
	}

	if(bazi.direction && bazi.direction.length){
		lines.push('');
		lines.push('[流年行运概略]');
		// [v2 排版批量·表化] 每板块「概略+流年」两行并为一表行：值表达式逐字复用
		// （startYear/startAge/dayunGz/yearGzs 组装式不动），旧行标签词（起始年/起始年龄/大运/流年）上移表头。
		lines.push('| 板块 | 起始年 | 起始年龄 | 大运 | 流年 |');
		lines.push('| --- | --- | --- | --- | --- |');
		bazi.direction.forEach((block, idx)=>{
			const startYear = block && block.startYear !== undefined ? `${block.startYear}` : '';
			const startAge = block && block.age !== undefined ? `${block.age}` : '';
			const dayunGz = getGz(block ? block.mainDirect : null);
			const startYearNum = block && block.startYear !== undefined ? Number(block.startYear) : null;
			const yearGzs = (block && block.subDirect && block.subDirect.length ? block.subDirect : [])
				.map((sub, subIdx)=>{
					const gz = getGz(sub);
					if(!gz){
						return '';
					}
					const yearNum = Number.isFinite(startYearNum) ? startYearNum + subIdx : null;
					if(Number.isFinite(yearNum)){
						return `${yearNum}-${gz}`;
					}
					return gz;
				})
				.filter(Boolean);
			lines.push(`| 板块${idx + 1} | ${startYear} | ${startAge}岁 | ${dayunGz} | ${yearGzs.join(' ')} |`);
		});
	}

	// 多运限（批A）：仅挂载「每技法设置」显式选了流年/流月/流日/流时时追加；缺省不追加 → 快照与现状逐字一致。
	if(params && params.period){
		const periodLines = buildBaziPeriodLines(bazi, params.period, params);
		if(periodLines.length > 0){
			lines.push(...periodLines);
		}
	}
	return lines.join('\n');
}

// 供 AI 分析无头复算：按出生参数取数并生成八字快照文本（不依赖组件挂载）。
export async function buildBaziSnapshotForParams(params){
	if(!params){
		return '';
	}
	const rawResult = await fetchBaziDirectCached(params, { silent: true });
	const result = normalizeBaziResult(rawResult, params);
	if(!result){
		return '';
	}
	return buildBaziSnapshotText(params, result);
}

const BAZI_CACHE_MAX = 96;
const baziMem = new Map();
const baziInflight = new Map();
const baziDirectMem = new Map();
const baziDirectInflight = new Map();

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

function pushCache(map, key, val, max = BAZI_CACHE_MAX){
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

function normalizeBaziGender(gender){
	if(gender === 'Male' || gender === 'Female'){
		return gender;
	}
	if(gender === false || `${gender}` === '0'){
		return 'Female';
	}
	if(gender === true || `${gender}` === '1'){
		return 'Male';
	}
	return '';
}

function normalizeBaziResult(result, params){
	if(!result){
		return result;
	}
	const next = {
		...result,
	};
	const bazi = {
		...(next.bazi || {}),
	};
	if(!bazi.gender){
		bazi.gender = next.gender || normalizeBaziGender(params ? params.gender : null);
	}
	next.bazi = bazi;
	next.coreOnly = !Array.isArray(bazi.direction) || bazi.direction.length === 0;
	return next;
}

// 🔴 全年份域·细盘大运/流年列补源(真机症:极端年份「大运/流年」两列空)。
// 根因:BC/lunar-js 不可靠域,前端 buildLocalBaziResult 抛错回退 Java /bazi/birth,其 core 无 direction;
// 细盘 getCurrentDirection(rec.direction) 拿不到大运块 → 两列空。此时把独立 /bazi/direct(directBazi,
// 流年面板 componentDidMount 即自动拉取并成功消费)的 direction/directTime/smallDirection 合入喂细盘的 rec。
// 可靠年 core 自带 direction(buildLocalBaziResult) → coreHasDirection 真 → 返回原 core 引用,字节零回归。
export function resolveChartBazi(coreBazi, directBazi){
	const core = coreBazi || {};
	const coreHasDirection = Array.isArray(core.direction) && core.direction.length > 0;
	if(coreHasDirection || !directBazi || !Array.isArray(directBazi.direction) || !directBazi.direction.length){
		return core;
	}
	return {
		...core,
		direction: directBazi.direction,
		directTime: directBazi.directTime,
		smallDirection: directBazi.smallDirection,
	};
}

function buildBaziKey(params){
	try{
		return JSON.stringify(params || {});
	}catch(e){
		return '';
	}
}

async function fetchBaziCached(params, options){
	const opt = options || {};
	const disableCache = opt.cache === false;
	const key = disableCache ? '' : buildBaziKey(params);
	if(key && baziMem.has(key)){
		return clonePlain(baziMem.get(key));
	}
	if(key && baziInflight.has(key)){
		const inflight = await baziInflight.get(key);
		return clonePlain(inflight);
	}
	try{
		const localResult = buildLocalBaziResult(params);
		if(key && localResult){
			pushCache(baziMem, key, clonePlain(localResult));
		}
		return clonePlain(localResult);
	}catch(e){
		// Fall through to the legacy service when the local Lunar calculator cannot parse old edge cases.
	}
	const req = request(`${Constants.ServerRoot}${BAZI_CORE_ENDPOINT}`, {
		body: JSON.stringify(params),
		silent: opt.silent !== false,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(key && result){
			pushCache(baziMem, key, clonePlain(result));
		}
		return result;
	}).finally(()=>{
		if(key){
			baziInflight.delete(key);
		}
	});
	if(key){
		baziInflight.set(key, req);
	}
	const result = await req;
	return clonePlain(result);
}

async function fetchBaziDirectCached(params, options){
	const opt = options || {};
	const disableCache = opt.cache === false;
	const key = disableCache ? '' : buildBaziKey(params);
	if(key && baziDirectMem.has(key)){
		return clonePlain(baziDirectMem.get(key));
	}
	if(key && baziDirectInflight.has(key)){
		const inflight = await baziDirectInflight.get(key);
		return clonePlain(inflight);
	}
	try{
		const localResult = buildLocalBaziResult(params);
		if(key && localResult){
			pushCache(baziDirectMem, key, clonePlain(localResult));
		}
		return clonePlain(localResult);
	}catch(e){
		// Fall through to the legacy service when the local Lunar calculator cannot parse old edge cases.
	}
	const req = request(`${Constants.ServerRoot}${BAZI_DIRECT_ENDPOINT}`, {
		body: JSON.stringify(params),
		silent: opt.silent !== false,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(key && result){
			pushCache(baziDirectMem, key, clonePlain(result));
		}
		return result;
	}).finally(()=>{
		if(key){
			baziDirectInflight.delete(key);
		}
	});
	if(key){
		baziDirectInflight.set(key, req);
	}
	const result = await req;
	return clonePlain(result);
}

class BaZi extends Component{
	constructor(props) {
		super(props);

		let bzopt = localStorage.getItem(BaZiOptKey);
		if(bzopt){
			// 本地值损坏不能让构造函数抛错白屏 → 回默认选项
			try{ bzopt = JSON.parse(bzopt); }catch(e){ bzopt = null; }
		}
		if(!bzopt){
			bzopt = {
				onlyZiGanShen: true,
			};
		}

		this.state = {
			result: null,
			baziOpt: bzopt,
			chartStyle: ['fine', 'ancient'].indexOf(localStorage.getItem(BAZI_CHART_STYLE_KEY)) >= 0 ? localStorage.getItem(BAZI_CHART_STYLE_KEY) : 'simple',
			currentBaziKey: '',
			directResult: null,
			directKey: '',
			directLoading: false,
			directError: null,
			flowSelection: null,
		};

		this.unmounted = false;
		this.baziReqSeq = 0;
		this.prefetchTimer = null;

		this.requestBazi = this.requestBazi.bind(this);
		this.requestBaziDirect = this.requestBaziDirect.bind(this);
		this.prefetchBazi = this.prefetchBazi.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBaziOptChange = this.onBaziOptChange.bind(this);
		this.onInfoTabChange = this.onInfoTabChange.bind(this);
		this.changeBaziChartStyle = this.changeBaziChartStyle.bind(this);
		this.onFlowSelectionChange = this.onFlowSelectionChange.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestBazi(fields);
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
			const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
			const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
			if(hasConfirmedFlag){
				delete patch.__confirmed;
			}
			// v2.2.1: 左栏改过 after23NewDay / lateZiHourUseNextDay 后,全局事件不再覆盖(共享 dva fields 路径)。
			if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
			if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
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
			if(!confirmed){
				if(this.prefetchTimer){
					clearTimeout(this.prefetchTimer);
				}
				this.prefetchTimer = setTimeout(()=>{
					this.prefetchTimer = null;
					if(this.unmounted){
						return;
					}
					this.prefetchBazi(flds.fields).catch(()=>{
						return null;
					});
				}, 240);
				return;
			}
			if(this.prefetchTimer){
				clearTimeout(this.prefetchTimer);
				this.prefetchTimer = null;
			}
			this.requestBazi(flds.fields, {
				silent: true,
			});
		}
	}
	
	onBaziOptChange(opt){
		const prev = this.state.baziOpt || {};
		// 命宫起法影响后端命宫/身宫 → 改后需带参重取;藏干版本(分野加权)影响五行力量打分 → 也需重取;
		// 其余(界面样式/刑冲破害/流派等纯显示)不重取——school 切换=纯重绘瞬时,绝不进 needRefetch。
		const needRefetch = (prev.minggongMethod || 'tongxing') !== (opt.minggongMethod || 'tongxing')
				|| (prev.fenyeVersion || 'common') !== (opt.fenyeVersion || 'common')
				|| (prev.cangVersion || 'common') !== (opt.cangVersion || 'common')
				|| (prev.dayunPrecision || 'precise') !== (opt.dayunPrecision || 'precise');
		const patch = { baziOpt: opt };
		// 纳音古法派 → 自动配古法盘(临时视图,不落 localStorage);离开纳音恢复原样式。
		// 用户本会话手动点过样式按钮(userStyleTouched)即视为覆盖,不再自动切。
		const prevSchool = prev.school || 'zonghe';
		const nextSchool = opt.school || 'zonghe';
		if(prevSchool !== nextSchool && !this.userStyleTouched){
			if(nextSchool === 'nayin' && this.state.chartStyle !== 'ancient'){
				this.autoStyleFrom = this.state.chartStyle;
				patch.chartStyle = 'ancient';
			}else if(prevSchool === 'nayin' && this.autoStyleFrom){
				patch.chartStyle = this.autoStyleFrom;
				this.autoStyleFrom = null;
			}
		}
		this.setState(patch, ()=>{
			safeLocalStorageSet(BaZiOptKey, JSON.stringify(opt));
			if(needRefetch){
				this.requestBazi(this.props.fields);
			}
		});
	}

	changeBaziChartStyle(chartStyle){
		this.userStyleTouched = true;
		this.setState({
			chartStyle,
		}, ()=>{
			safeLocalStorageSet(BAZI_CHART_STYLE_KEY, chartStyle);
		});
	}

	// horosa_panel_ready_v1(复核补接):行运条点格 = 中栏细盘高亮 + 右栏神煞两块同帧改写。
	// 起点由 BaZiLuckFlowPanel.renderAxis 的点击处打(markInteractionStart('bazi')),终点即本次
	// setState 落定 —— 这一次 setState 之后,PaiBaZi/BaZiFineChart 与 BaZiFlowGodsSection 都已拿到
	// 新 flowSelection。userInitiated 为假(= resetSelection 在数据到位后自发的那次 emit)时不打点,
	// 否则会抢走 requestBazi 那条真样本、把「改时间→出盘」量成一个偏小的假数。
	onFlowSelectionChange(flowSelection, userInitiated){
		this.setState({
			flowSelection,
		}, ()=>{
			if(userInitiated){
				markPanelReady('bazi');
			}
		});
	}

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			// 公元前显式传 ad(date 串负号之外的双保险;后端各历法端点吃 ad 键)
			ad: (flds.ad && flds.ad.value !== undefined) ? flds.ad.value : (flds.date.value.ad || 1),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			timeAlg: flds.timeAlg.value,
			phaseType: flds.phaseType.value,
			godKeyPos: flds.godKeyPos.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : 1,
			adjustJieqi: flds.adjustJieqi.value,
			minggongMethod: (this.state.baziOpt && this.state.baziOpt.minggongMethod) || 'tongxing',
			fenyeVersion: (this.state.baziOpt && this.state.baziOpt.fenyeVersion) || 'common',
			// 藏干版本（分野加权 fenye / 通行版 common）：影响五行力量打分（月柱当令司令加权）→ 进 params 让缓存键随之失效并重算。
			cangVersion: (this.state.baziOpt && this.state.baziOpt.cangVersion) || 'common',
			dayunPrecision: (this.state.baziOpt && this.state.baziOpt.dayunPrecision) || 'precise',
		}
		return params;
	}

	// horosa_bazi_param_memo_v1：render 期的 genParams 结果稳定化。
	// genParams 的全部输入 = fields（引用）+ this.state.baziOpt（引用）；两者同引用 ⇒ 输出逐字段相同，
	// 直接复用旧对象。旧码每次 render 新建对象 → 作为 jieqiParams 传下去会让行运面板的 memo 恒失效。
	memoBaziParams(fields){
		const opt = this.state.baziOpt;
		const cache = this._paramsCache;
		if(cache && cache.fields === fields && cache.opt === opt){
			return cache.out;
		}
		const out = this.genParams(fields);
		this._paramsCache = { fields, opt, out };
		return out;
	}

	// horosa_bazi_chartbazi_memo_v1：resolveChartBazi 在「core 无 direction」分支返回新对象字面量，
	// 每次 render 都换引用 → 下游任何以 value 引用比的 sCU/memo 恒失效。输入两引用不变即复用旧输出。
	memoChartBazi(coreBazi, directBazi){
		const cache = this._chartBaziCache;
		if(cache && cache.core === coreBazi && cache.direct === directBazi){
			return cache.out;
		}
		const out = resolveChartBazi(coreBazi, directBazi);
		this._chartBaziCache = { core: coreBazi, direct: directBazi, out };
		return out;
	}

	async prefetchBazi(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);
		await fetchBaziCached(params, {
			silent: true,
		});
	}

	async requestBazi(fields, options){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);
		const currentBaziKey = buildBaziKey(params);
		const opt = options || {};
		const seq = ++this.baziReqSeq;
		const rawResult = await fetchBaziCached(params, {
			silent: opt.silent !== false,
		});
		const result = normalizeBaziResult(rawResult, params);
		if(!result || this.unmounted || seq !== this.baziReqSeq){
			return;
		}

		const st = {
			result: result,
			currentBaziKey,
			directResult: result && result.local ? result : (this.state.currentBaziKey === currentBaziKey ? this.state.directResult : null),
			directKey: result && result.local ? currentBaziKey : (this.state.currentBaziKey === currentBaziKey ? this.state.directKey : ''),
			directLoading: this.state.currentBaziKey === currentBaziKey ? this.state.directLoading : false,
			directError: this.state.currentBaziKey === currentBaziKey ? this.state.directError : null,
			flowSelection: this.state.currentBaziKey === currentBaziKey ? this.state.flowSelection : null,
		};

		// horosa_panel_ready_v1：这一次 setState 就是「中栏(细盘+行运)+右栏(信息面板)」的数据落定点
		// ——result 一到位，PaiBaZi / BaZiLuckFlowPanel / BaZiAppInfoPanel 三者同一帧全部拿到新数据。
		// markPanelReady 内部按 generation 去重 + 双 rAF 逼近「本帧已绘」。
		// 「改时间/改选项 → 出盘」这条路径的终点唯此一处；另一条独立路径(行运条点格)的终点在
		// onFlowSelectionChange，两者各自配自己的 markInteractionStart，互不抢样本。
		this.setState(st, ()=>{
			markPanelReady('bazi');
		});
		// 惰性构建:快照文本拼装挪出排盘关键路径(params/result 为局部量,闭包安全)。
		// 须带 school（断命流派）→ 否则不触发 refresh 的场景 AI 快照恒标「传统综合」(与 handleSnapshotRefreshRequest 同口径)。
		const snapshotParams = { ...params, school: (this.state.baziOpt || {}).school, shenshaGroups: (this.state.baziOpt || {}).shenshaGroups };
		saveModuleAISnapshotLazy('bazi', ()=>buildBaziSnapshotText(snapshotParams, result), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}

	async requestBaziDirect(){
		if(!this.props.fields){
			return;
		}
		const params = this.genParams(this.props.fields);
		const key = buildBaziKey(params);
		if(this.state.directResult && this.state.directKey === key){
			return;
		}
		if(this.state.directLoading && this.state.directKey === key){
			return;
		}
		this.setState({
			directLoading: true,
			directError: null,
			directKey: key,
		});
		try{
			const rawResult = await fetchBaziDirectCached(params, {
				silent: true,
			});
			const result = normalizeBaziResult(rawResult, params);
			if(this.unmounted || buildBaziKey(this.genParams(this.props.fields)) !== key){
				return;
			}
			this.setState({
				directResult: result,
				directKey: key,
				directLoading: false,
				directError: null,
			});
		}catch(e){
			if(this.unmounted){
				return;
			}
			this.setState({
				directLoading: false,
				directError: '行运数据加载失败',
			});
		}
	}

	onInfoTabChange(key){
		if(`${key}` === '0'){
			this.requestBaziDirect();
		}
	}


	// 实时刷新:AI 导出/分析前广播 horosa:refresh-module-snapshot 时,用「当前显示盘」同步重建快照,
	// 修复 reload/rehydrate 后惰性缓存为空、导出报「当前页面没有可导出文本」。入参与 requestBazi 落快照处(同口径):
	// params=this.genParams(this.props.fields)(当前左栏参数)、result=this.state.result(当前渲染的盘)。只补监听,不动显示/计算。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'bazi'){
			return;
		}
		let text = '';
		try{
			if(this.props.fields && this.state.result){
				const params = { ...this.genParams(this.props.fields), school: (this.state.baziOpt || {}).school, shenshaGroups: (this.state.baziOpt || {}).shenshaGroups };
				text = `${buildBaziSnapshotText(params, this.state.result) || ''}`.trim();
			}
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('bazi', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
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
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(this.props.fields){
			this.requestBazi(this.props.fields, {
				silent: true,
			});
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(this.prefetchTimer){
			clearTimeout(this.prefetchTimer);
			this.prefetchTimer = null;
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = '100%'
		}else{
			height = Math.max(320, height - 8);
		}
		let tabHeight = height - 20;

		let bazi = this.state.result ? this.state.result.bazi : EMPTY_BAZI;
		const directBazi = this.state.directResult && this.state.directResult.bazi ? this.state.directResult.bazi : null;
		// 细盘大运/流年列补源(BC/域外年 core 无 direction 时合入 /bazi/direct 结果);可靠年零回归。详见 resolveChartBazi。
		const chartBazi = this.memoChartBazi(bazi, directBazi);
		const baziParams = this.props.fields ? this.memoBaziParams(this.props.fields) : EMPTY_PARAMS;
		const isFineChart = this.state.chartStyle === 'fine' || this.state.chartStyle === 'ancient';
		const isLegacyUi = this.state.baziOpt && this.state.baziOpt.uiMode === 'legacy';
		const chartHeight = typeof height === 'number' ? Math.max(360, Math.round(height * 0.62)) : height;
		const flowHeight = typeof height === 'number' ? Math.max(220, height - chartHeight - 18) : 240;

		return (
			<div className={`horosa-bazi-page horosa-astro-redesign horosa-bazi-redesign ${isLegacyUi ? 'horosa-bazi-legacy-ui' : ''}`}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-bazi-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-bazi-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-bazi-input-panel">
							<MemoCnTraditionInput
								fields={this.props.fields}
								baziOpt={this.state.baziOpt}
								onFieldsChange={this.onFieldsChange}
								onBaziOptChange={this.onBaziOptChange}
							/>
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-bazi-chart-panel xq-chart-renderer xq-chart-renderer-bazi">
							{isLegacyUi ? (
								<BaZiLegacyMain value={bazi} fields={this.props.fields} baziOpt={this.state.baziOpt} />
							) : (
								<div className={`horosa-bazi-main-stack ${isFineChart ? 'horosa-bazi-main-stack-fine' : ''}`}>
									<div className="horosa-bazi-main-chart-slot" data-capture-chart-only>
										<PaiBaZi
											value={chartBazi}
											height={isFineChart ? 'auto' : chartHeight}
											fields={this.props.fields}
											baziOpt={this.state.baziOpt}
											chartStyle={this.state.chartStyle}
											onChartStyleChange={this.changeBaziChartStyle}
											showStyleSwitch={false}
											flowSelection={this.state.flowSelection}
										/>
									</div>
									<div className="horosa-bazi-main-flow-slot">
										<MemoBaZiLuckFlowPanel
											coreValue={bazi}
											fullValue={directBazi}
											height={flowHeight}
											loading={this.state.directLoading}
											error={this.state.directError}
											jieqiParams={baziParams}
											onLoad={this.requestBaziDirect}
											onSelectionChange={this.onFlowSelectionChange}
											showXiaoyun={!(this.state.baziOpt && this.state.baziOpt.showXiaoyun === false)}
											ageStyle={(this.state.baziOpt && this.state.baziOpt.ageStyle) || 'nominal'}
											compact
										/>
									</div>
								</div>
							)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-bazi-info-panel">
							{isLegacyUi ? (
								<BaZiLegacyInfoPanel value={bazi} fields={this.props.fields} height={tabHeight} />
							) : (
								<BaZiAppInfoPanel value={bazi} fields={this.props.fields} height={tabHeight} showShenSha={!(this.state.baziOpt && this.state.baziOpt.showShenSha === false)} shenshaGroups={this.state.baziOpt && this.state.baziOpt.shenshaGroups} zodiacBoundary={(this.state.baziOpt && this.state.baziOpt.zodiacBoundary) || 'lichun'} school={(this.state.baziOpt && this.state.baziOpt.school) || 'zonghe'} flowSelection={this.state.flowSelection} />
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

}

export default BaZi;
