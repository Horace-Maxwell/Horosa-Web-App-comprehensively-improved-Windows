import * as LRConst from './LRConst';

const BIEZE_YIN_START_MAP = {
	子: '辰',
	丑: '巳',
	寅: '午',
	卯: '未',
	辰: '申',
	巳: '酉',
	午: '戌',
	未: '亥',
	申: '子',
	酉: '丑',
	戌: '寅',
	亥: '卯',
};

function normalizeGanZhi(dayGanZi){
	const text = `${dayGanZi || ''}`.trim();
	if(text.length < 2){
		return '';
	}
	return `${text.substring(0, 1)}${text.substring(1, 2)}`;
}

export function getLiuRengXunMeta(dayGanZi){
	const normalized = normalizeGanZhi(dayGanZi);
	const dayGan = normalized.substring(0, 1);
	const dayZhi = normalized.substring(1, 2);
	const ganIdx = LRConst.GanList.indexOf(dayGan);
	const zhiIdx = LRConst.ZiList.indexOf(dayZhi);
	if(ganIdx < 0 || zhiIdx < 0){
		return {
			dayGanZi: normalized,
			xunName: '',
			xunHead: '',
			xunTail: '',
			xunDing: '',
			xunKong: [],
			xunBranches: [],
			branchDunGanMap: {},
		};
	}
	const firstZiIdx = (zhiIdx - ganIdx + 12) % 12;
	const xunBranches = [];
	const branchDunGanMap = {};
	for(let i=0; i<10; i++){
		const branch = LRConst.ZiList[(firstZiIdx + i) % 12];
		xunBranches.push(branch);
		branchDunGanMap[branch] = LRConst.GanList[i];
	}
	const xunHead = LRConst.ZiList[firstZiIdx];
	const xunTail = xunBranches[9] || '';
	const xunDing = xunBranches[3] || '';
	const xunKong = LRConst.ZiList.filter((item)=>!Object.prototype.hasOwnProperty.call(branchDunGanMap, item));
	return {
		dayGanZi: normalized,
		xunName: xunHead ? `甲${xunHead}旬` : '',
		xunHead,
		xunTail,
		xunDing,
		xunKong,
		xunBranches,
		branchDunGanMap,
	};
}

export function getLiuRengBranchDunGan(dayGanZi, branch){
	const meta = getLiuRengXunMeta(dayGanZi);
	const key = `${branch || ''}`.trim();
	return Object.prototype.hasOwnProperty.call(meta.branchDunGanMap, key)
		? meta.branchDunGanMap[key]
		: '';
}

export function getLiuRengDisplayGanZhi(dayGanZi, branch){
	const key = `${branch || ''}`.trim();
	if(LRConst.ZiList.indexOf(key) < 0){
		return `${branch || ''}`;
	}
	const dunGan = getLiuRengBranchDunGan(dayGanZi, key);
	return dunGan ? `${dunGan}${key}` : `空${key}`;
}

function normalizeBranch(value){
	const txt = `${value || ''}`.trim();
	if(!txt){
		return '';
	}
	const tail = txt.substring(txt.length - 1);
	return LRConst.ZiList.indexOf(tail) >= 0 ? tail : '';
}

function normalizeKeRaw(keRaw){
	const list = Array.isArray(keRaw) ? keRaw : [];
	return list.map((ke, index)=>({
		index,
		top: normalizeBranch(ke && ke[1]),
		down: normalizeBranch(ke && ke[2]),
		signature: `${normalizeBranch(ke && ke[1])}|${normalizeBranch(ke && ke[2])}`,
		raw: ke,
	}));
}

function inferPanMode(upZi, downZi){
	const up = Array.isArray(upZi) ? upZi : [];
	const down = Array.isArray(downZi) ? downZi : [];
	if(!up.length || !down.length){
		return 'normal';
	}
	if(`${up[0]}` === `${down[0]}`){
		return 'fuyin';
	}
	return `${down[0]}` === `${LRConst.ZiCong[up[0]] || ''}` ? 'fanyin' : 'normal';
}

function hasAnyNearKe(keList){
	return keList.some((item)=>(
		item && item.top && item.down && (
			LRConst.isRestrain(item.down, item.top) || LRConst.isRestrain(item.top, item.down)
		)
	));
}

function buildUniqueCandidateBranches(keList, predicate){
	const branchMap = new Map();
	const seenSignature = new Set();
	keList.forEach((item)=>{
		if(!item || !item.top || !item.down){
			return;
		}
		if(!predicate(item)){
			return;
		}
		if(seenSignature.has(item.signature)){
			return;
		}
		seenSignature.add(item.signature);
		if(!branchMap.has(item.top)){
			branchMap.set(item.top, item);
		}
	});
	return Array.from(branchMap.keys());
}

function getSequenceFromStart(startBranch, upZi, downZi){
	const first = `${startBranch || ''}`.trim();
	if(!first){
		return [];
	}
	const firstIdx = Array.isArray(downZi) ? downZi.indexOf(first) : -1;
	if(firstIdx < 0 || !Array.isArray(upZi)){
		return [first];
	}
	const second = upZi[firstIdx] || '';
	const secondIdx = second ? downZi.indexOf(second) : -1;
	const third = secondIdx >= 0 ? (upZi[secondIdx] || '') : '';
	return [first, second, third].filter((item)=>!!item);
}

function chooseBySeHai(dayGan, candidates, upZi, downZi, fallbackBranches){
	if(!candidates.length){
		return null;
	}
	const countSeHai = (branch)=>{
		let count = 0;
		const upIdx = upZi.indexOf(branch);
		const downIdxBase = downZi.indexOf(branch);
		if(upIdx < 0 || downIdxBase < 0){
			return 0;
		}
		const downIdx = downIdxBase >= upIdx ? downIdxBase : downIdxBase + 12;
		for(let i=upIdx; i<downIdx; i++){
			const idx = i % 12;
			const di = downZi[idx];
			if(LRConst.isRestrain(di, branch)){
				count += 1;
			}
			const hidden = LRConst.ZiHanGan[di];
			if(hidden){
				hidden.split('').forEach((gan)=>{
					if(LRConst.isRestrain(gan, branch)){
						count += 1;
					}
				});
			}
		}
		return count;
	};

	let maxCount = -1;
	let winners = [];
	candidates.forEach((branch)=>{
		const count = countSeHai(branch);
		if(count > maxCount){
			maxCount = count;
			winners = [branch];
		}else if(count === maxCount){
			winners.push(branch);
		}
	});
	if(winners.length === 1){
		return {
			startBranch: winners[0],
			name: '涉害课',
		};
	}
	const meng = winners.filter((branch)=>{
		const idx = upZi.indexOf(branch);
		const down = idx >= 0 ? downZi[idx] : '';
		return LRConst.ZiMeng.indexOf(down) >= 0;
	});
	if(meng.length === 1){
		return {
			startBranch: meng[0],
			name: '见机课',
		};
	}
	const zhong = winners.filter((branch)=>{
		const idx = upZi.indexOf(branch);
		const down = idx >= 0 ? downZi[idx] : '';
		return LRConst.ZiZong.indexOf(down) >= 0;
	});
	if(zhong.length === 1){
		return {
			startBranch: zhong[0],
			name: '察微课',
		};
	}
	return {
		startBranch: LRConst.YangGan.indexOf(dayGan) >= 0
			? ((fallbackBranches && fallbackBranches[0]) || '')
			: ((fallbackBranches && fallbackBranches[1]) || ''),
		name: '缀瑕课',
	};
}

function chooseCandidateByParity(dayGan, candidates, upZi, downZi, multiName, fallbackBranches){
	if(!candidates.length){
		return null;
	}
	if(candidates.length === 1){
		return {
			startBranch: candidates[0],
			name: multiName.single,
		};
	}
	const parity = LRConst.sameYingYang(dayGan, candidates);
	if(parity.cnt === 1){
		return {
			startBranch: parity.data[0],
			name: multiName.multi,
		};
	}
	return chooseBySeHai(dayGan, parity.data || candidates, upZi, downZi, fallbackBranches);
}

function buildBranchResult(startBranch, upZi, downZi, name){
	return {
		name,
		rawBranches: getSequenceFromStart(startBranch, upZi, downZi),
	};
}

function resolveNearKe(dayGan, keList, upZi, downZi){
	const fallbackBranches = [
		keList[0] && keList[0].top ? keList[0].top : '',
		keList[2] && keList[2].top ? keList[2].top : '',
	];
	const lowerCandidates = buildUniqueCandidateBranches(
		keList,
		(item)=>LRConst.isRestrain(item.down, item.top)
	);
	if(lowerCandidates.length){
		const chosen = chooseCandidateByParity(dayGan, lowerCandidates, upZi, downZi, {
			single: '重审课',
			multi: '比用课',
		}, fallbackBranches);
		return chosen ? buildBranchResult(chosen.startBranch, upZi, downZi, chosen.name) : null;
	}
	const upperCandidates = buildUniqueCandidateBranches(
		keList,
		(item)=>LRConst.isRestrain(item.top, item.down)
	);
	if(!upperCandidates.length){
		return null;
	}
	const chosen = chooseCandidateByParity(dayGan, upperCandidates, upZi, downZi, {
		single: '元首课',
		multi: '知一课',
	}, fallbackBranches);
	return chosen ? buildBranchResult(chosen.startBranch, upZi, downZi, chosen.name) : null;
}

function resolveRemoteKe(dayGan, keList, upZi, downZi){
	const fallbackBranches = [
		keList[0] && keList[0].top ? keList[0].top : '',
		keList[2] && keList[2].top ? keList[2].top : '',
	];
	const remoteDown = buildUniqueCandidateBranches(
		keList.filter((item)=>item.index > 0),
		(item)=>LRConst.isRestrain(item.top, dayGan)
	);
	if(remoteDown.length){
		const chosen = chooseCandidateByParity(dayGan, remoteDown, upZi, downZi, {
			single: '蒿矢课',
			multi: '蒿矢课',
		}, fallbackBranches);
		return chosen ? buildBranchResult(chosen.startBranch, upZi, downZi, chosen.name) : null;
	}
	const remoteUp = buildUniqueCandidateBranches(
		keList.filter((item)=>item.index > 0),
		(item)=>LRConst.isRestrain(dayGan, item.top)
	);
	if(!remoteUp.length){
		return null;
	}
	const chosen = chooseCandidateByParity(dayGan, remoteUp, upZi, downZi, {
		single: '弹射课',
		multi: '弹射课',
	}, fallbackBranches);
	return chosen ? buildBranchResult(chosen.startBranch, upZi, downZi, chosen.name) : null;
}

function buildFuyinSequence(startBranch, backupBranch){
	const middle = LRConst.ZiXing[startBranch] === startBranch ? backupBranch : LRConst.ZiXing[startBranch];
	const end = LRConst.ZiXing[middle] === middle ? LRConst.ZiCong[middle] : LRConst.ZiXing[middle];
	return [startBranch, middle, end].filter((item)=>!!item);
}

function resolveFuyin(dayGan, keList){
	const hasNear = hasAnyNearKe(keList);
	const isYang = LRConst.YangGan.indexOf(dayGan) >= 0;
	const startBranch = hasNear || isYang
		? (keList[0] && keList[0].top)
		: (keList[2] && keList[2].top);
	const backupBranch = hasNear || isYang
		? (keList[2] && keList[2].top)
		: (keList[0] && keList[0].top);
	if(!startBranch){
		return null;
	}
	return {
		name: hasNear ? '不虞课' : (isYang ? '自任课' : '杜传课'),
		rawBranches: buildFuyinSequence(startBranch, backupBranch),
	};
}

function resolveFanyin(dayZhi, keList, upZi, downZi, dayGan){
	const near = resolveNearKe(dayGan, keList, upZi, downZi);
	if(near){
		return {
			...near,
			name: '无依课',
		};
	}
	return {
		name: '无亲课',
		rawBranches: [
			LRConst.ZiYiMa[dayZhi] || '',
			keList[2] && keList[2].top ? keList[2].top : '',
			keList[0] && keList[0].top ? keList[0].top : '',
		].filter((item)=>!!item),
	};
}

function hasExactDuplicateCourse(keList){
	const seen = new Set();
	for(let i=0; i<keList.length; i++){
		const item = keList[i];
		if(!item || !item.top){
			continue;
		}
		if(seen.has(item.top)){
			return true;
		}
		seen.add(item.top);
	}
	return false;
}

function isBaZhuanEligible(keList){
	if(keList.length < 3){
		return false;
	}
	return !!(
		keList[0]
		&& keList[2]
		&& keList[0].top
		&& keList[0].top === keList[2].top
	);
}

function resolveBaZhuan(dayGan, keList, upZi){
	if(!isBaZhuanEligible(keList)){
		return null;
	}
	const isYang = LRConst.YangGan.indexOf(dayGan) >= 0;
	const middle = keList[0] && keList[0].top ? keList[0].top : '';
	const seed = isYang
		? middle
		: (keList[3] && keList[3].top ? keList[3].top : '');
	if(!seed){
		return null;
	}
	const seedIdx = upZi.indexOf(seed);
	const start = seedIdx >= 0
		? upZi[(seedIdx + (isYang ? 2 : 10)) % 12]
		: '';
	return {
		name: '八专课',
		rawBranches: [start, middle, middle].filter((item)=>!!item),
	};
}

function resolveBieZe(dayGan, dayZhi, keList, upZi, downZi){
	if(!hasExactDuplicateCourse(keList) || isBaZhuanEligible(keList)){
		return null;
	}
	const isYang = LRConst.YangGan.indexOf(dayGan) >= 0;
	let start = '';
	if(isYang){
		const heGan = LRConst.GanHe[dayGan];
		const heZhi = LRConst.GanJiZi[heGan];
		const idx = downZi.indexOf(heZhi);
		start = idx >= 0 ? (upZi[idx] || '') : '';
	}else{
		start = BIEZE_YIN_START_MAP[dayZhi] || '';
	}
	const middle = keList[0] && keList[0].top ? keList[0].top : '';
	if(!start || !middle){
		return null;
	}
	return {
		name: '芜淫课',
		rawBranches: [start, middle, middle],
	};
}

function resolveMaoXing(dayGan, keList, upZi, downZi){
	const isYang = LRConst.YangGan.indexOf(dayGan) >= 0;
	const start = isYang
		? (upZi[downZi.indexOf('酉')] || '')
		: (downZi[upZi.indexOf('酉')] || '');
	const middle = isYang
		? (keList[2] && keList[2].top ? keList[2].top : '')
		: (keList[0] && keList[0].top ? keList[0].top : '');
	const end = isYang
		? (keList[0] && keList[0].top ? keList[0].top : '')
		: (keList[2] && keList[2].top ? keList[2].top : '');
	return {
		name: isYang ? '虎视课' : '掩目课',
		rawBranches: [start, middle, end].filter((item)=>!!item),
	};
}

function buildDisplayResult(result, dayGanZi, upZi, houseTianJiang){
	if(!result || !result.rawBranches || !result.rawBranches.length){
		return null;
	}
	const dayGan = normalizeGanZhi(dayGanZi).substring(0, 1);
	const rawBranches = result.rawBranches.map((item)=>normalizeBranch(item)).filter((item)=>!!item);
	return {
		...result,
		rawBranches,
		cuang: rawBranches.map((branch)=>getLiuRengDisplayGanZhi(dayGanZi, branch)),
		tianJiang: rawBranches.map((branch)=>{
			const idx = Array.isArray(upZi) ? upZi.indexOf(branch) : -1;
			return idx >= 0 && Array.isArray(houseTianJiang) ? (houseTianJiang[idx] || '') : '';
		}),
		liuQin: rawBranches.map((branch)=>{
			const qinMap = LRConst.ZiLiuQin[branch] || {};
			return qinMap[dayGan] || '';
		}),
	};
}

function inferRuleStage(result){
	const name = result && result.name ? `${result.name}` : '';
	if(!name){
		return '';
	}
	if(name === '重审课' || name === '元首课'){
		return '贼摄';
	}
	if(name === '比用课' || name === '知一课'){
		return '比用';
	}
	if(name === '涉害课' || name === '见机课' || name === '察微课' || name === '缀瑕课'){
		return '涉害';
	}
	if(name === '蒿矢课' || name === '弹射课'){
		return '遥克';
	}
	if(name === '虎视课' || name === '掩目课'){
		return '昴星';
	}
	if(name === '不虞课' || name === '自任课' || name === '杜传课'){
		return '伏吟';
	}
	if(name === '无依课' || name === '无亲课'){
		return '反吟';
	}
	if(name === '芜淫课'){
		return '别责';
	}
	if(name === '八专课'){
		return '八专';
	}
	return name;
}

function withRuleMeta(result, decisionPath){
	if(!result){
		return null;
	}
	return {
		...result,
		ruleStage: inferRuleStage(result),
		decisionPath: Array.isArray(decisionPath) ? decisionPath.filter((item)=>!!item) : [],
	};
}

export function solveLiuRengSanChuanDetailed(params = {}){
	const dayGanZi = normalizeGanZhi(params.dayGanZi);
	const dayGan = dayGanZi.substring(0, 1);
	const dayZhi = dayGanZi.substring(1, 2);
	const upZi = Array.isArray(params.upZi) ? params.upZi.slice() : [];
	const downZi = Array.isArray(params.downZi) ? params.downZi.slice() : [];
	const houseTianJiang = Array.isArray(params.houseTianJiang) ? params.houseTianJiang.slice() : [];
	const keList = normalizeKeRaw(params.keRaw);
	if(!dayGan || !dayZhi || upZi.length !== 12 || downZi.length !== 12 || keList.length !== 4){
		return null;
	}
	const mode = params.mode || inferPanMode(upZi, downZi);
	let result = null;
	let decisionPath = [];
	if(mode === 'fuyin'){
		decisionPath = ['伏吟'];
		result = withRuleMeta(resolveFuyin(dayGan, keList), decisionPath);
	}else if(mode === 'fanyin'){
		decisionPath = ['反吟'];
		result = withRuleMeta(resolveFanyin(dayZhi, keList, upZi, downZi, dayGan), decisionPath);
	}else{
		result = resolveNearKe(dayGan, keList, upZi, downZi);
		if(!result){
			decisionPath.push('无近克');
			result = resolveRemoteKe(dayGan, keList, upZi, downZi);
		}else{
			result = withRuleMeta(result, ['近克', inferRuleStage(result)]);
		}
		if(!result){
			decisionPath.push('无遥克');
			result = resolveBaZhuan(dayGan, keList, upZi);
			if(result){
				result = withRuleMeta(result, [...decisionPath, '八专']);
			}
		}
		if(!result){
			result = resolveBieZe(dayGan, dayZhi, keList, upZi, downZi);
			if(result){
				result = withRuleMeta(result, [...decisionPath, '别责']);
			}
		}
		if(!result){
			result = resolveMaoXing(dayGan, keList, upZi, downZi);
			if(result){
				result = withRuleMeta(result, [...decisionPath, '昴星']);
			}
		}
		if(result && !result.decisionPath){
			result = withRuleMeta(result, result.ruleStage ? [result.ruleStage] : []);
		}
	}
	return {
		dayGanZi,
		dayGan,
		dayZhi,
		upZi,
		downZi,
		houseTianJiang,
		keList,
		mode,
		result,
	};
}

export function buildLiuRengSanChuan(params = {}){
	const detailed = solveLiuRengSanChuanDetailed(params);
	if(!detailed){
		return null;
	}
	return buildDisplayResult(
		detailed.result,
		detailed.dayGanZi,
		detailed.upZi,
		detailed.houseTianJiang
	);
}
