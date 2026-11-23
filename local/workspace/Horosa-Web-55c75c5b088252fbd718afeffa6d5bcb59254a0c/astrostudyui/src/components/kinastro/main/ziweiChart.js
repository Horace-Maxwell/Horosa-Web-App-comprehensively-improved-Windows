// 策天 / 演禽盘 → 紫微式十二宫盘(星曜列表、四化归一、飞星落宫、中宫内容)
// 从 KinAstroMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';   // 中宫四柱兜底(策天/演禽后端不产 pillars)
import { datePartOf } from '../../../utils/dateStrSafe';
import { formatZoneLabel } from '../../../utils/zoneText';
import { formatLonDms, formatLatDms } from '../../astro/AstroHelper';
import { GANZHI_PATTERN, HUA_NORMALIZE, BRANCH_NAMES, XIANQIN_PALACE_STAR_MAP, SIHUA_KEYS, KIN_CENTER_CONTENT_KEY, STEM_NAMES, CETIAN_LIUNIAN_SHORT, BRANCH_INDEX } from './config';
import { fmtValue } from './snapshot';

export function normalizeGanzhiInput(value){
	const text = `${value || ''}`.trim();
	return GANZHI_PATTERN.test(text) ? text : '';
}

function toStarList(value){
	if(!value){
		return [];
	}
	const list = value instanceof Array ? value : [value];
	return list.map((item)=>{
		const name = typeof item === 'object' ? (item.name || item.label || item.title || '') : item;
		return `${name || ''}`.trim();
	}).filter(Boolean).map((name)=>({ name }));
}

function normalizeHuaLabel(value){
	const text = `${value || ''}`.trim();
	return HUA_NORMALIZE[text] || text;
}

function getCetianStarFlightTarget(starName, palace, cetian){
	const formatTarget = (target)=>{
		if(target === undefined || target === null || target === ''){
			return '';
		}
		let branchValue = target;
		if(typeof target === 'object'){
			branchValue = target.to_branch !== undefined && target.to_branch !== null ? target.to_branch
				: (target.branch !== undefined && target.branch !== null ? target.branch
					: (target.to_palace || target.palace || ''));
		}
		return BRANCH_NAMES[branchValue] || `${branchValue || ''}`.replace(/[宫宮]$/, '').slice(-1);
	};
	if(palace && palace.flying_stars && palace.flying_stars[starName]){
		return formatTarget(palace.flying_stars[starName]);
	}
	const flight = cetian && cetian.star_flight ? cetian.star_flight[starName] : null;
	if(!flight || flight.to_branch === undefined || flight.to_branch === null){
		return '';
	}
	return formatTarget(flight);
}

function toCetianStarList(value, sihua, palace = {}, cetian = {}){
	return toStarList(value).map((star)=>({
		...star,
		hua: normalizeHuaLabel((palace.sihua && palace.sihua[star.name]) || (sihua && sihua[star.name])),
		starlight: palace.brightness && palace.brightness[star.name] ? `${palace.brightness[star.name]}` : '',
		flyTo: getCetianStarFlightTarget(star.name, palace, cetian),
	}));
}

function toXianqinStarList(value){
	if(!value){
		return [];
	}
	const list = value instanceof Array ? value : [value];
	return list.map((item)=>{
		if(typeof item === 'object'){
			return {
				name: `${item.name || item.label || item.title || ''}`.trim(),
			};
		}
		const text = `${item || ''}`.trim();
		const parts = text.split(/[：:]/);
		if(parts.length >= 2){
			return {
				name: parts.slice(1).join('：').trim(),
			};
		}
		return { name: text };
	}).filter((item)=>item.name);
}

function normalizeXianqinPalaceName(value){
	return `${value || ''}`
		.replace(/[宫宮]/g, '')
		.replace(/財/g, '财')
		.replace(/僕/g, '仆')
		.replace(/遷/g, '迁')
		.replace(/祿/g, '禄')
		.replace(/妾/g, '妻');
}

function getXianqinPalaceStarEntry(chartData, palaceName){
	const stars = (chartData && chartData.stars) || {};
	const derived = stars.derived || {};
	const normalizedName = normalizeXianqinPalaceName(palaceName);
	const found = XIANQIN_PALACE_STAR_MAP.find((item)=>item.match.some((name)=>normalizedName.indexOf(normalizeXianqinPalaceName(name)) >= 0));
	if(!found){
		return '';
	}
	const qin = found.source ? stars[found.source] : (derived[found.key] || derived[normalizeXianqinPalaceName(found.key)]);
	return qin ? `${found.label}：${qin}` : '';
}

function getXianqinPalaceNameByBranch(chartData, branch){
	const twelve = ((chartData && chartData.palaces) || {}).twelve || {};
	const entry = Object.keys(twelve).find((key)=>twelve[key] === branch);
	return entry || '';
}

function emptyZiWeiHouse(branchIdx){
	const branch = BRANCH_NAMES[branchIdx] || '';
	return {
		name: branch,
		ganzi: `　${branch}`,
		starsMain: [],
		starsAssist: [],
		starsEvil: [],
		starsSmall: [],
		starsOthersGood: [],
		starsOthersBad: [],
		direction: [branchIdx * 10 + 1, branchIdx * 10 + 10],
		phase: '',
	};
}

export function buildZiWeiRulesForChart(chart){
	const ruleHouses = {};
	const huaInHouse = {};
	SIHUA_KEYS.forEach((key)=>{
		huaInHouse[key] = {};
	});
	(chart.houses || []).forEach((house)=>{
		const name = house && house.name ? house.name : '';
		if(name){
			ruleHouses[name] = [];
			SIHUA_KEYS.forEach((key)=>{
				huaInHouse[key][name] = [];
			});
		}
	});
	return {
		ZWRules: {
			RuleHouses: ruleHouses,
			RuleStars: {},
			RuleSihua: { 禄: [], 权: [], 科: [], 忌: [] },
		},
		ZWRuleSihua: {
			HuaInHouse: huaInHouse,
		},
	};
}

// 借用的紫微中宫要画四柱。
// 🔴 中宫此前四格恒画占位符「—」——演禽四格全空、策天只有年柱(上一轮补年干支时只补了年那一格),
// 用户实报「中间栏严重失真」。
// 数据源两级:①pan.pillars([{key,label,ganzhi}])——邵子/铁板/分经等子技法后端给;
// ②策天(webcetiansrv)与演禽(webxianqinsrv)后端压根不产 pillars,故按起盘时刻用前端本地
// 排盘补齐(与八字主盘同一个 buildLocalBaziResult,不新起一套干支实现)。
// 本地排盘不传口径参数 = 各档缺省,与紫微/择时/一掌经等既有「只要干支」的调用方同款。
function pillarsFromPan(pan){
	const list = (pan && pan.pillars) || [];
	const byKey = (k, i)=>{
		const hit = list.find((p)=>p && p.key === k);
		return (hit && hit.ganzhi) || (list[i] && list[i].ganzhi) || '';
	};
	const out = { year: byKey('year', 0), month: byKey('month', 1), day: byKey('day', 2), time: byKey('hour', 3) };
	if(out.year && out.month && out.day && out.time){ return out; }
	// 后端未给全 → 本地按起盘时刻补。失败(缺时间/引擎抛)一律回落占位符,绝不让中宫崩掉整盘。
	try{
		const dateStr = pan && pan.dateStr;
		const timeStr = pan && pan.timeStr;
		if(!dateStr || !timeStr){ return out; }
		const fc = ((buildLocalBaziResult({
			date: datePartOf(`${dateStr}`),
			time: `${timeStr}`.slice(0, 8),
			zone: pan.timezone,
			lon: pan.longitude,
			lat: pan.latitude,
		}) || {}).bazi || {}).fourColumns || {};
		const gz = (p)=>(p && (p.ganzi || p.ganZhi)) || '';
		return {
			year: out.year || gz(fc.year),
			month: out.month || gz(fc.month),
			day: out.day || gz(fc.day),
			time: out.time || gz(fc.time),
		};
	}catch(e){ return out; }
}

// 概览段的经纬度按专业记法显示(116°24′27″E / 39°54′15″N),不再把浮点原样铺开
// —— 后端 sections 直接给的是 double,十进制换算出来就是 119.31666666666666 这种一长串,
// 既难读又把二进制浮点误差摊在用户眼前(用户实报「不要变成一长串」)。
// 同段的「时区」行同一条纪律:后端给「UTC±HH:MM」,这里再过一遍单一来源(数值 / 旧写法也落成同一形)。
// 仅动**显示**:计算一律仍用 pan.longitude/latitude 原值,精度不受影响。
// 按 label 认而非按值认:值就是个 number,只有 label 能区分它是经度、纬度还是别的度数。
export function formatGeoRowValue(label, value){
	const key = `${label || ''}`;
	if(key === '时区' && value !== undefined && value !== null && value !== ''){
		return formatZoneLabel(value) || value;
	}
	if(value === undefined || value === null || value === '' || !Number.isFinite(Number(value))){
		return value;
	}
	if(key.indexOf('经度') >= 0){ return formatLonDms(value) || value; }
	if(key.indexOf('纬度') >= 0){ return formatLatDms(value) || value; }
	return value;
}

export function readKinCenterContent(serviceKey){
	const key = KIN_CENTER_CONTENT_KEY[serviceKey];
	if(!key){ return 'clean'; }
	let v = null;
	try{ v = localStorage.getItem(key); }catch(e){ /* 隐私模式/配额:回落默认 */ }
	return v === 'clean' || v === 'bazi' || v === 'full' ? v : 'bazi';
}

export function buildKinAstroZiWeiChart(pan, serviceKey){
	const dateStr = pan && pan.dateStr ? pan.dateStr : '2026-01-01';
	const timeStr = pan && pan.timeStr ? pan.timeStr : '00:00:00';
	const gzOf = pillarsFromPan(pan);
	const chart = {
		kinastroBorrowed: true,
		birth: dateStr,
		zone: formatZoneLabel(pan && pan.timezone) || fmtValue(pan && pan.timezone),   // 中宫全量档的时区:UTC±HH:MM(地方平时是无限小数,不原样拼)
		lon: fmtValue(pan && pan.longitude),
		lat: fmtValue(pan && pan.latitude),
		yearZi: '子',
		yearGan: '',
		yearPolar: 'Positive',
		gender: 'Male',
		wuxingJuText: serviceKey === 'cetian' ? '策天十八飞星' : '演禽盘',
		lifeMaster: serviceKey === 'cetian' ? fmtValue(pan && pan.mingGong) : '命星',
		bodyMaster: serviceKey === 'cetian' ? fmtValue(pan && pan.shenGong) : '身星',
		zidou: serviceKey === 'cetian' ? fmtValue(pan && pan.ziwei) : '—',
		doujun: serviceKey === 'cetian' ? fmtValue(pan && pan.hourBranch) : '—',
		// 中宫四项标签随技法改名 —— 借来的是紫微的**版式**,不是紫微的**术语**。
		// 策天填的是命宫/身宫/紫微所在宫与时辰;演禽填的是命星/身星/胎星与三元(见下方演禽分支)。
		centerMasterLabels: serviceKey === 'cetian'
			? ['命宫', '身宫', '紫微', '时辰']
			: ['命星', '身星', '胎星', '三元'],
		centerContentMode: readKinCenterContent(serviceKey),
		nongli: {
			year: pan && pan.lunar && pan.lunar.text ? pan.lunar.text : dateStr,
			month: '',
			day: '',
			time: ` ${timeStr}`,
			birth: `${dateStr} ${timeStr}`,
			leap: false,
		},
		bazi: {
			bazi: {
				year: { ganzi: gzOf.year || '—' },
				month: { ganzi: gzOf.month || '—' },
				day: { ganzi: gzOf.day || '—' },
				time: { ganzi: gzOf.time || '—' },
			},
			direct: { direction: [] },
		},
		houses: BRANCH_NAMES.map((_, idx)=>emptyZiWeiHouse(idx)),
	};

	if(serviceKey === 'cetian'){
		const palaces = (pan.cetian && pan.cetian.palaces) || [];
		const cetian = pan.cetian || {};
		const yiyu = pan.yiyu || {};
		const showFlags = pan.showFlags || {};
		// 中宫真值:年干支/阴阳/性别(修占位符 —— 曾恒写死 'Male'/'子'/'—')。
		if(cetian.lunar_year_stem !== undefined && STEM_NAMES[cetian.lunar_year_stem]){
			chart.yearGan = STEM_NAMES[cetian.lunar_year_stem];
		}
		if(cetian.lunar_year_branch !== undefined && BRANCH_NAMES[cetian.lunar_year_branch]){
			chart.yearZi = BRANCH_NAMES[cetian.lunar_year_branch];
			// 年柱以 pan.pillars 为准(与右栏「四柱」页签同源);仅在那边没给出时才用农历年干支兜底,
			// 否则同一张盘的中宫与四柱页签可能给出两个年柱。
			if(!chart.bazi.bazi.year.ganzi || chart.bazi.bazi.year.ganzi === '—'){
				chart.bazi.bazi.year.ganzi = `${chart.yearGan || ''}${chart.yearZi}`;
			}
		}
		chart.yearPolar = cetian.yin_yang === '陰' ? 'Negative' : 'Positive';
		chart.gender = cetian.gender === '女' ? 'Female' : 'Male';
		// 🔴 流年**不**再并进时辰格:该格标签是「时辰」,塞「未時(13-15)·流年2026」既与标签不符,
		// 又长到冲出中宫压住相邻宫的星名(中宫四项各只占 1/4 宽)。流年在左栏下拉与右栏运限区
		// 各有一处显示,不存在信息丢失。
		// 杂曜按支分组(showZaYao 关则不上盘;进 starsEvil 槽 —— 书法 patterns 恒空,原法保持格局占槽)。
		const zayaoByBranch = {};
		if(showFlags.zayao !== false && yiyu.zayao){
			Object.keys(yiyu.zayao).forEach((name)=>{
				const b = yiyu.zayao[name];
				if(b === undefined || b === null){ return; }
				(zayaoByBranch[b] = zayaoByBranch[b] || []).push(name);
			});
		}
		// 流年星单字短名按支分组(showLiunian 关则不画)。
		const liunianByBranch = {};
		const ln = yiyu.liunian;
		if(showFlags.liunian !== false && ln){
			const pushShort = (name, b)=>{
				const short = CETIAN_LIUNIAN_SHORT[name] || `${name}`.slice(-1);
				(liunianByBranch[b] = liunianByBranch[b] || []).push(short);
			};
			Object.keys(ln.zhuxu || {}).forEach((name)=>pushShort(name, ln.zhuxu[name]));
			Object.keys(ln.qisha || {}).forEach((name)=>pushShort(name, ln.qisha[name]));
			if(ln.feiku !== undefined){ pushShort('哭', ln.feiku); }
			if(ln.xiaoku !== undefined){ (liunianByBranch[ln.xiaoku] = liunianByBranch[ln.xiaoku] || []).push('小哭'); }
		}
		// 限名按支(运限段真值,direction 区显示「X限」替代宫名首字)。
		const xianByBranch = {};
		((yiyu.yunxian || {}).daxian || []).forEach((d)=>{
			if(d && d.branch !== undefined){ xianByBranch[d.branch] = d; }
		});
		palaces.forEach((palace, idx)=>{
			const branchIdx = palace.branch;
			if(branchIdx === undefined || branchIdx === null || !chart.houses[branchIdx]){
				return;
			}
			const branch = palace.branch_name || BRANCH_NAMES[branchIdx] || '';
			const mainStars = toCetianStarList(palace.stars, cetian.sihua, palace, cetian);
			const assistStars = toCetianStarList(palace.aux_stars, cetian.sihua, palace, cetian);
			const stemBranch = `${palace.stem_name || ''}${branch}`;
			// 大限真值:后端 da_xian_start(口径联动);缺失时回退旧伪值(防御,不应触发)。
			const dxStart = Number(palace.da_xian_start);
			const direction = Number.isFinite(dxStart) && dxStart > 0
				? [dxStart, dxStart + 9]
				: [idx * 10 + 1, idx * 10 + 10];
			const zaYaoStars = (zayaoByBranch[branchIdx] || []).map((name)=>({ name }));
			chart.houses[branchIdx] = {
				...emptyZiWeiHouse(branchIdx),
				name: `${palace.name || branch || ''}`.replace(/[宫宮]$/, '') || branch,
				ganzi: stemBranch || branch,
				starsMain: mainStars,
				starsAssist: assistStars,
				starsEvil: (palace.patterns && palace.patterns.length) ? toStarList(palace.patterns) : zaYaoStars,
				direction,
				kinastroLiunianRow: liunianByBranch[branchIdx] || null,
				kinastroXianName: (xianByBranch[branchIdx] || {}).xian_name || '',
			};
		});
		if(chart.houses[cetian.shen_gong_branch]){
			chart.houses[cetian.shen_gong_branch].kinastroCornerMark = '身';
			chart.houses[cetian.shen_gong_branch].isBody = true;
		}
		return chart;
	}

	if(serviceKey === 'xianqin'){
		const palaces = {};
		(pan.palaceCards || []).forEach((card)=>{
			const branchIdx = BRANCH_INDEX[card.branch];
			if(branchIdx !== undefined){
				palaces[branchIdx] = card;
			}
		});
		const chartData = pan.xianqin || {};
		BRANCH_NAMES.forEach((branch, idx)=>{
			const palace = palaces[idx] || {};
			const palaceName = palace.name || getXianqinPalaceNameByBranch(chartData, branch) || branch;
			const stars = (palace.stars && palace.stars.length)
				? palace.stars
				: [getXianqinPalaceStarEntry(chartData, palaceName)].filter(Boolean);
			chart.houses[idx] = {
				...emptyZiWeiHouse(idx),
				name: `${palaceName || branch || ''}`.replace(/[宫宮]$/, '') || branch,
				ganzi: `　${branch}`,
				starsMain: toXianqinStarList(stars.slice ? stars.slice(0, 1) : stars),
				starsAssist: toXianqinStarList(stars.slice ? stars.slice(1) : []),
				starsEvil: [],
				direction: [idx * 10 + 1, idx * 10 + 10],
			};
		});
		const stars = chartData.stars || {};
		const xianqinPalaces = chartData.palaces || {};
		[
			{ palace: xianqinPalaces.tai_gong, marker: '胎' },
			{ palace: xianqinPalaces.shen_gong, marker: '身' },
		].forEach((item)=>{
			const branchIdx = BRANCH_INDEX[item.palace && item.palace.branch];
			if(chart.houses[branchIdx]){
				chart.houses[branchIdx].kinastroCornerMark = item.marker;
			}
		});
		chart.lifeMaster = fmtValue(stars.ming_xing);
		chart.bodyMaster = fmtValue(stars.shen_xing);
		chart.zidou = fmtValue(stars.tai_xing);
		chart.doujun = fmtValue((chartData.basic_info || {}).san_yuan);
		return chart;
	}

	return chart;
}
