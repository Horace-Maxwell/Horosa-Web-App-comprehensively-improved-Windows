// 三式合一页:盘面悬停释义(奇门宫 / 外圈宫位 / 地支 / 星)。
// 从 SanShiUnitedMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { safe } from '../../dunjia/qimenPageShared';
import * as AstroConst from '../../../constants/AstroConst';
import { buildMeaningTipByCategory } from '../../astro/AstroMeaningData';
import { BRANCH_ZODIAC_MAP, BRANCH_SIGN_ID_MAP } from './options';

export function toQimenMeaningTip(tipObj){
	if(!tipObj){
		return null;
	}
	const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
	const tips = [];
	blocks.forEach((block)=>{
		if(!block){
			return;
		}
		if(block.type === 'blank'){
			tips.push('');
			return;
		}
		if(block.type === 'divider'){
			tips.push('==');
			return;
		}
		if(block.type === 'subTitle'){
			tips.push(`### ${safe(block.text, '')}`);
			return;
		}
		const raw = safe(block.text, '');
		const plain = raw.replace(/<[^>]+>/g, '');
		tips.push(plain);
	});
	return {
		title: safe(tipObj.title, ''),
		tips,
	};
}

function normalizeMeaningTip(tip){
	if(!tip){
		return null;
	}
	if(typeof tip === 'string'){
		return {
			title: '',
			tips: [`${tip}`],
		};
	}
	if(Array.isArray(tip)){
		return {
			title: '',
			tips: tip.map((item)=>safe(item, '')),
		};
	}
	if(typeof tip === 'object'){
		return {
			title: safe(tip.title, ''),
			tips: Array.isArray(tip.tips)
				? tip.tips.map((item)=>safe(item, ''))
				: (tip.tips ? [safe(tip.tips, '')] : []),
		};
	}
	return null;
}

function mergeMeaningTips(title, parts){
	const tips = [];
	(parts || []).forEach((part, idx)=>{
		const one = normalizeMeaningTip(part);
		if(!one){
			return;
		}
		if(one.title){
			tips.push(`### ${one.title}`);
		}
		(one.tips || []).forEach((line)=>{
			tips.push(safe(line, ''));
		});
		if(idx < (parts.length - 1)){
			tips.push('==');
		}
	});
	while(tips.length && (tips[tips.length - 1] === '==' || tips[tips.length - 1] === '')){
		tips.pop();
	}
	return {
		title: safe(title, ''),
		tips,
	};
}

export function buildOuterHouseMeaningTip(houses){
	const entries = (houses || []).map((txt)=>{
		const num = parseInt(`${txt}`, 10);
		if(Number.isNaN(num) || num < 1 || num > 12){
			return null;
		}
		const houseId = AstroConst[`HOUSE${num}`];
		const tip = houseId ? buildMeaningTipByCategory('house', houseId) : null;
		if(!tip){
			return null;
		}
		return {
			num,
			tip,
		};
	}).filter(Boolean);
	if(!entries.length){
		return null;
	}
	return mergeMeaningTips(
		entries.length === 1 ? `${entries[0].num}宫` : entries.map((one)=>`${one.num}宫`).join('/'),
		entries.map((one)=>({
			// 宫名保留在 tooltip 顶部 title，正文不重复显示同名标题。
			title: '',
			tips: normalizeMeaningTip(one.tip) ? normalizeMeaningTip(one.tip).tips : [],
		}))
	);
}

export function buildOuterBranchMeaningTip(branch){
	const signName = safe(BRANCH_ZODIAC_MAP[branch], '未知星座');
	const signId = BRANCH_SIGN_ID_MAP[branch];
	const signMeaning = signId ? buildMeaningTipByCategory('sign', signId) : null;
	if(!signMeaning){
		return null;
	}
	const normalized = normalizeMeaningTip(signMeaning);
	if(!normalized){
		return null;
	}
	return {
		title: `「${branch}-${signName}」`,
		tips: normalized.title
			? [normalized.title, ...(normalized.tips || [])]
			: (normalized.tips || []),
	};
}

export function buildOuterStarMeaningTip(star){
	const base = safe(star && star.fullTxt, safe(star && star.shortTxt, ''));
	const ptip = star && star.objId ? buildMeaningTipByCategory('planet', star.objId) : null;
	if(!ptip){
		return base || '';
	}
	return mergeMeaningTips(base, [ptip]);
}
