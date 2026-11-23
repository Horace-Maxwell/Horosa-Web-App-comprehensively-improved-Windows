// 神煞环与恒星环的取数
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { longLifeMapForYear } from '../guolaoMoiraTables';
import { STEM_BRANCHES, HALF_STELLAR, FULL_STELLAR } from './constants';
import { formatGodName } from './text';

export function stemBranchForYear(year){
	const idx = ((Number(year) - 1984) % 60 + 60) % 60;
	return STEM_BRANCHES[idx] || '';
}

export function getZiGods(root, chart){
	const rootGods = root && root.nongli && root.nongli.bazi && root.nongli.bazi.guolaoGods
		? root.nongli.bazi.guolaoGods.ziGods : null;
	const chartGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	return chartGods || rootGods || {};
}

export function collectGods(ziGods, zi){
	const one = ziGods && ziGods[zi] ? ziGods[zi] : {};
	const raw = []
		.concat(one.goodGods || [])
		.concat(one.neutralGods || [])
		.concat(one.badGods || [])
		.concat(one.taisuiGods || []);
	const seen = new Set();
	const names = [];
	raw.forEach((item)=>{
		const val = formatGodName(item);
		if(!val || seen.has(val)){
			return;
		}
		seen.add(val);
		names.push(val);
	});
	return names;
}

// 神煞数据源=rules 引擎(godHits/transitGodHits,Moira prop 规则本尊,与筛选清单一一对应);
// 返回 null 表示 rules 未到(调用方回退历法 ziGods,渐进不空盘)。
export function godsFromRuleHits(rules, zi, kind){
	const hits = rules ? (kind === 'transit' ? rules.transitGodHits : rules.godHits) : null;
	if(!hits || !hits.length){
		return null;
	}
	const one = hits.find((h)=>h && h.zi === zi) || {};
	const raw = [].concat(one.gods || [], one.goodGods || [], one.neutralGods || [], one.badGods || [], one.taisuiGods || []);
	const seen = new Set();
	const names = [];
	raw.forEach((item)=>{
		const val = formatGodName(item);
		if(val && !seen.has(val)){
			seen.add(val);
			names.push(val);
		}
	});
	return names;
}

// 十二长生字(照 Moira getStarSigns:本命/流年各按自家年柱纳音起)。
export function longLifeCharFor(rules, zi, kind){
	const ys = (rules && rules.yearStars) || {};
	const ctx = kind === 'transit' ? ys.transit : ys.birth;
	const map = longLifeMapForYear(ctx && ctx.yearPole);
	return map ? (map[zi] || '') : '';
}

export function orderedGods(items, orderList){
	const list = (items || []).map(formatGodName).filter(Boolean);
	if(!orderList || !orderList.length){
		return list;
	}
	const rank = new Map(orderList.map((name, idx)=>[name, idx]));
	return list.slice().sort((a, b)=>{
		const ar = rank.has(a) ? rank.get(a) : 999;
		const br = rank.has(b) ? rank.get(b) : 999;
		return ar - br || a.localeCompare(b, 'zh-Hans-CN');
	});
}

export function buildFixedStars(chart){
	const src = chart && chart.fixedStarSu28 && chart.fixedStarSu28.length ? chart.fixedStarSu28 : null;
	if(src){
		return src.map((item, idx)=>{
			const ra = Number(item.ra);
			const lonRaw = Number(item.lon);
			return {
				name: item.name || HALF_STELLAR[idx] || '',
				label: item.name || FULL_STELLAR[idx] || HALF_STELLAR[idx] || '',
				ra,
				// 黄经:赤仪宿度制时与 ra(赤经)真值不同;黄仪时源侧 ra=lon(宿界沿黄道置),二者同值。
				lon: Number.isFinite(lonRaw) ? lonRaw : ra,
			};
		}).filter((item)=>Number.isFinite(item.ra));
	}
	return HALF_STELLAR.map((name, idx)=>({
		name,
		label: FULL_STELLAR[idx] || name,
		ra: idx * 360 / HALF_STELLAR.length,
		lon: idx * 360 / HALF_STELLAR.length,
	}));
}
