// 紫微 AI 快照正文(宫位总览 / 运限分层 / 叠盘)与右栏起盘信息表
// 从 ZiWeiMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { ZWEngineOptions } from '../ziweiOptions';
import { starLightOf } from '../data/ziweiTables';
import * as ZiWeiHelper from '../ZiWeiHelper';
import { houseName as luckHouseName, houseIdxByBranch as luckHouseIdxByBranch, buildLiunianItems, buildDaxianItems, buildXiaoxianItems, buildLiuyueItems, buildLiuriItems, buildLiushiItems, emptyLuckSel } from '../ZWLuckPanel';
import { zhongxianOf, childLimits } from '../ziweiCore';   // 沈氏中限四段(与页面同源)
import * as ZWConst from '../../../constants/ZWConst';
import * as ZWText from '../../../constants/ZWText';
import { leapPrefix } from '../../../utils/lunarText';
import { isLaiyinPalace } from '../ziweiSchools';
import { qiShuWei, allBorrowedStars, taiSuiRuGua } from '../ziweiOverlays';
import { formatZoneLabel } from '../../../utils/zoneText';   // 时区一律 UTC±HH:MM

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

// dayGan:显示开关「日干四化徽」(缺省关)开启后盘面逐星加「日禄/日权…」徽,
// 而快照星曜括注只有 生年/命宫/自化 三类 → 开了也进不了 AI。开关开启时才传入,缺省态括注逐字不变。
function formatStarSiHua(starName, yearGan, lifeGan, palaceGan, dayGan){
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
	if(dayGan){
		const dayHua = ZiWeiHelper.getSiHua(starName, dayGan);
		if(dayHua){
			tags.push(`日干${dayHua}`);
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

// 单层运限 → 文本块（四化落宫 + 流曜 + 三方四正星情, 复用 ZiWeiHelper.getLayerSihua/getFlowStars/collectSanhePalaces,
// 与盘面交互卡同口径）。
// 用户增量(v1.9): 末尾追加"三方四正"四宫星曜列表,让 AI 看到该时段真实的三合宫位星情,提高流年判断准度。
function formatLuckLayerLines(chart, layer, levelLabel, subText){
	const lines = [];
	const mingIdx = layer.mingIndex;
	const oppIdx = ((mingIdx % 12) + 6) % 12;
	// 头行加 ◆ 子题标记:呈现层(docx/PDF)映射 Heading3;纯文本仍整行可读(substring 断言不受影响)。
	const head = `◆ ${levelLabel}：${layer.ganzi || ''}${subText ? `（${subText}）` : ''}`
		+ `，命宫【${luckHouseName(chart, mingIdx, true)}】·对宫【${luckHouseName(chart, oppIdx, true)}】`;
	lines.push(head);
	// 与面板同口径:消费期现算(effLayerSihuaGan),快照与 UI 恒同源
	const sihua = ZiWeiHelper.getLayerSihua(chart, ZiWeiHelper.effLayerSihuaGan(chart, layer)) || [];
	if(sihua.length > 0){
		const parts = sihua.map((h)=>`${h.star}化${h.hua}（${luckHouseName(chart, h.houseIndex, true)}）`);
		lines.push(`四化：${parts.join('、')}`);
	}
	// 流年神煞上盘开时:流年层追加 12 神落宫行(快照与盘面同源 getFlowJiangSui;默认关=基线字节稳)。
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

// [Windows #80] 无条件「运限概览」段。
//   病理:八字给 AI 的 [大运] / [流年行运概略] 是**无条件段**(不碰齿轮也有全大运 × 各 10 流年的公历年+干支);
//   紫微此前什么都不给 —— 除非用户在 40 项设置里翻到最末组、往一个叫「流年小限」的**文本框**里手打年份。
//   用户报障「紫微挂载设置里似乎没找着流年的勾选项」,AI 也如实答「有本命盘和大限,缺少完整流年、流月盘」。
//   照抄八字范式:每个大限一行,把该限 10 个流年「公历年-干支」打包进末列 —— 12 行给全 120 年的映射。
//   只用已有纯函数(ZWLuckPanel 的 build*Items,与盘面交互同源、零新算法);**不依赖「今天」**,同一盘快照恒定。
//   用户显式选了运限时,下面的 [运限] 段照旧另出(完整流曜与四化落宫),两者互不影响。
function buildZiweiPeriodOverviewLines(chart){
	if(!chart || !chart.houses){ return []; }
	const daxianItems = buildDaxianItems(chart);
	if(!daxianItems.length){ return []; }
	const lines = ['[运限概览]'];
	lines.push('全大限 × 流年一览(公历年与干支由代码算出,禁自行推算):');
	lines.push('| 虚岁 | 宫位 | 宫干支 | 该限流年（公历年-干支） |');
	lines.push('| --- | --- | --- | --- |');
	daxianItems.forEach((d)=>{
		const years = buildLiunianItems(chart, d).map((x)=>`${x.year}-${x.ganzi}`).join('、');
		lines.push(`| ${d.start}~${d.end} | ${luckHouseName(chart, d.mingIndex, true)} | ${d.ganzi} | ${years || '—'} |`);
	});
	lines.push('要某一年/某月的完整流曜与四化落宫,请在「挂载设置 → 运限」里选定年月(或直接说出年份)。');
	lines.push('');
	return lines;
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
			const seg = formatLuckLayerLines(chart, dx, ZW_PERIOD_LEVEL_LABEL.daxian, `${dx.start}~${dx.end}岁`);
			// 「沈氏三限」齿轮开着时,页面在所选大限下画出四段中限(各 2.5 年),
			// 而快照此前只在「传本设置」里多一行注记 —— AI 看不到分段。开关开启时把四段真列出来
			// (宫位沿该大限宫,与 ziweiCore.zhongxianOf 同源;缺省关=零增行)。
			if(ZWEngineOptions.zhongxian && Array.isArray(seg)){
				try{
					const zx = zhongxianOf(dx.start, dx.mingIndex) || [];
					if(zx.length){
						seg.push(`沈氏三限（大限内四分，各 2.5 年；宫位沿本大限宫）：${zx.map((z, i)=>`中限${i + 1} ${z.startAge}~${z.endAge}岁`).join('、')}`);
					}
				}catch(e){ /* 分段失败不影响主段 */ }
			}
			pushSeg(seg);
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

// luckSel → 快照 period(纯函数;页面刷新应答、取数完成的惰性存、口径改档后的重存同用)。
export function periodFromLuckSel(luckSel){
	const sel = luckSel || emptyLuckSel();
	const period = {};
	if(sel.daxian) period.daxian = [sel.daxian.mingIndex];
	if(sel.liunian && Number.isFinite(sel.liunian.year)) period.liunian = [sel.liunian.year];
	if(sel.liuyue && Number.isFinite(sel.liuyue.month)) period.liuyue = [sel.liuyue.month];
	if(sel.liuri && Number.isFinite(sel.liuri.day)) period.liuri = [sel.liuri.day];
	if(sel.liushi && Number.isFinite(sel.liushi.hourIdx)) period.liushi = [sel.liushi.hourIdx];
	return (period.daxian || period.liunian || period.liuyue || period.liuri || period.liushi) ? period : null;
}

// 快照槽的出生签名(对话挂载按它认命主):惰性存与刷新应答同一份。
export function ziweiSnapshotMeta(params){
	const p = params || {};
	return { date: p.date, time: p.time, zone: p.zone, lon: p.lon, lat: p.lat };
}

export function buildZiWeiSnapshotText(params, result){
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
	// 「未知」在紫微是按男排(引擎 male = gender !== 0):快照只写「未知」会与下一行「命局：阳男」自相矛盾。
	lines.push(`性别：${`${params.gender}` === '1' ? '男' : (`${params.gender}` === '0' ? '女' : '未知（按男排）')}`);
	lines.push(`时间算法：${params.timeAlg === 1 ? '直接时间' : '真太阳时'}`);
	// 换算后时刻(审计补缺:此前只写算法名、无换算结果):双时刻并列与八字快照同款,换算关系一眼可见;
	// 后端盘缺 clockTime/solarTime 双字段时回落单行 nongli.birth(盘心 ZWCenterHouse 同款取数),全缺不产行。
	const tmNl = chart.nongli || {};
	if(tmNl.clockTime && tmNl.solarTime){
		lines.push(`直接时间：${tmNl.clockTime}　真太阳时：${tmNl.solarTime}`);
	}else if(tmNl.birth){
		lines.push(`${params.timeAlg === 1 ? '直接时间：' : '真太阳时：'}${tmNl.birth}`);
	}
	const schoolLabel = ZWConst.zwSihuaSchoolLabel(ZWConst.ZWSchool.school);
	lines.push(`四化流派：${schoolLabel}`);
	// 传本/排盘开关(非默认才注记,供 AI 知悉本盘用了哪套传本)。
	const tbNotes = [];
	if(ZWEngineOptions.daxianSpan !== 10){ tbNotes.push('大限跨度=局数年(钦天)'); }
	if(ZWEngineOptions.tianmaBasis !== 'month'){ tbNotes.push('天马=年支三合马'); }
	if(ZWEngineOptions.starSet !== 'full'){ tbNotes.push('星集=精简18星(河洛)'); }
	if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ tbNotes.push(`观察盘=${ZWEngineOptions.sanPan === 'di' ? '地盘(身宫起)' : '人盘(福德起)'}`); }
	if(ZWEngineOptions.shangShi === 'yinyang'){ tbNotes.push('天伤天使=阴阳互换(中州)'); }
	const leapLabel = { next: '整月归下月', prev: '整月归上月', split_days: '前后半分割(按实际天数取中点)', split_star_month: '命身下月·月系上月(存疑)', solar_term: '按节气分界(过节归下月)' };
	if(ZWEngineOptions.leapMonth && ZWEngineOptions.leapMonth !== 'mid_split'){ tbNotes.push(`闰月=${leapLabel[ZWEngineOptions.leapMonth] || ZWEngineOptions.leapMonth}`); }
	const lateZiLabel = { zi_chu: '子初换日(强制)', midnight_split: '夜子折中', zi_zheng: '子正换日', dual: '双盘(当日/次日)' };
	if(ZWEngineOptions.lateZi && ZWEngineOptions.lateZi !== 'global'){ tbNotes.push(`晚子时=${lateZiLabel[ZWEngineOptions.lateZi] || ZWEngineOptions.lateZi}`); }
	if(ZWEngineOptions.yearBoundary === 'lichun'){ tbNotes.push('定年界线=立春(八字口径)'); }
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
	// 左栏「基本信息/四柱」卡内容并入起盘信息(审计:显示了但快照没有)。
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
		lines.push(`农历：${`${infoNl.year}年 ${leapPrefix(infoNl)}${infoNl.month || ''}${infoNl.day || ''}${infoNl.time ? ` ${`${infoNl.time}`.charAt(1)}时` : ''}`.trim()}`);
	}
	// 正月初一口径年柱 ≠ 立春口径年柱时,中宫会多画一行「初一口径年柱」,而快照两处
	// (「农历」行是数字年、「四柱」行是立春口径)都看不出这一年的分歧 —— 与页面同判据补一行。
	// 该字段只有走本地历算的盘才带(任一传本开关非缺省),缺省后端盘无此字段 → 零增行。
	const infoYearLunar = infoNl.yearGZByLunar;
	if(infoYearLunar && infoBz && infoBz.year && infoBz.year.ganzi && `${infoYearLunar}` !== `${infoBz.year.ganzi}`){
		lines.push(`初一口径年柱：${infoYearLunar}（四柱行的年柱按立春口径）`);
	}

	lines.push('');
	// 12 宫同构数据改 GFM 表(宫/干支/大限/星曜四列;值口径与旧键值行逐字同源:
	// name/ganzi/direction/formatStarSiHua 全复用)。表块经 v1/v2 归一器直通、docx/PDF 渲染真表。
	lines.push('[宫位总览]');
	// 日干四化徽:开关开启(缺省关)时才取日干,缺省态括注与旧快照逐字节相同。
	const daySihuaGan = ZiWeiHelper.zwShowDaySihua && ZiWeiHelper.zwShowDaySihua() ? (ZiWeiHelper.dayGanOf(chart) || '') : '';
	// 流年岁列 / 小限岁列(两开关缺省关)在宫底画岁数条,而 [宫位总览] 一个岁数都没有 →
	// 开了也进不了 AI。开关开启时才加一列(缺省关 = 表头四列、正文逐字节不变,preflight[121] 表头断言零触)。
	const showYearAges = !!(ZiWeiHelper.zwShowYearAges && ZiWeiHelper.zwShowYearAges());
	const showXiaoxianAges = !!(ZiWeiHelper.zwShowXiaoxianAges && ZiWeiHelper.zwShowXiaoxianAges());
	const withAgeCol = showYearAges || showXiaoxianAges;
	const ageCellOf = (house)=>{
		const gz = house && house.ganzi ? `${house.ganzi}` : '';
		const zhi = gz ? gz.charAt(1) : '';
		const parts = [];
		if(showYearAges && zhi && chart.yearZi){
			const ages = ZiWeiHelper.yearAgesOf(zhi, chart.yearZi);
			if(ages && ages.length){ parts.push(`流年 ${ZiWeiHelper.formatAgeStrip(ages)}`); }
		}
		if(showXiaoxianAges && zhi){
			const xx = ZiWeiHelper.xiaoxianAgesOf(chart, zhi)
				|| (Array.isArray(house && house.smallDirection) ? house.smallDirection : []);
			if(xx && xx.length){ parts.push(`小限 ${ZiWeiHelper.formatAgeStrip(xx)}`); }
		}
		return parts.join('；') || '无';
	};
	lines.push(`| 宫位 | 干支 | 大限 | 星曜（四化括注）${withAgeCol ? ' | 岁列（虚岁）' : ''} |`);
	lines.push(`| --- | --- | --- | ---${withAgeCol ? ' | ---' : ''} |`);
	houses.forEach((house, idx)=>{
		// 长生十二神内联宫位格(三合盘恒画的 house.phase,快照曾恒缺;不加表列,表头断言零触;缺省不产)。
		const name = `${house.name || house.id || `宫位${idx + 1}`}${house.phase ? `·${house.phase}` : ''}`;
		const ganzi = house.ganzi || '';
		const palaceGan = ganzi ? normalizeGan(ganzi) : '';
		const direction = house.direction && house.direction.length === 2 ? `${house.direction[0]}~${house.direction[1]}` : '';
		const collected = collectHouseStars(house);
		const stars = collected.list;
		// 星文本内联庙旺档「星名(四化)·档」—— AI 分析判读要求「依庙旺论强弱」,快照必须真给庙旺
		// (曾恒缺失=让模型臆造);不加表列,preflight[121] 表头断言零触。
		const starText = stars.length > 0
			? stars.map((starName)=>{
				const sl = collected.lightOf[starName];
				return `${formatStarSiHua(starName, yearGan, lifeGan, palaceGan, daySihuaGan)}${sl ? `·${sl}` : ''}`;
			}).join('、')
			: '无';
		lines.push(`| ${name} | ${ganzi || '无'} | ${direction || '无'} | ${starText}${withAgeCol ? ` | ${ageCellOf(house)}` : ''} |`);
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

	// [Windows #80] 运限概览:无条件段(与八字 [大运]/[流年行运概略] 对称)。可在「纳入内容」里取消勾选。
	const overviewLines = buildZiweiPeriodOverviewLines(chart);
	if(overviewLines.length){ lines.push(...overviewLines); }

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

function getFieldValue(fields, key, fallback = ''){
	const field = fields && fields[key] ? fields[key] : null;
	if(!field || field.value === undefined || field.value === null || field.value === ''){
		return fallback;
	}
	return field.value;
}

export function buildZiWeiInfoData(chart, fields){
	if(!chart || !chart.nongli){
		return { rows: [], bazi: [], directions: [] };
	}
	const nongli = chart.nongli || {};
	const timeAlg = chart.timeAlg !== undefined && chart.timeAlg !== null ? chart.timeAlg : getFieldValue(fields, 'timeAlg', 0);
	const birthPrefix = timeAlg === 1 ? '直接时间' : '真太阳时';
	const leap = leapPrefix(nongli);
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
		['时区', formatZoneLabel(chart.zone || getFieldValue(fields, 'zone', '')) || '—'],
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
