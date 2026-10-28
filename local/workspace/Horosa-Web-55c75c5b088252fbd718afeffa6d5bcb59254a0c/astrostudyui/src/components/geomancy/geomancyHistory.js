// 地占起卦历史(单一出处,零依赖叶子):「同一副卦」的口径 + 追加规则。GeomancyMain 写历史、存储键注册表的全量恢复并集规格同引用这一份。
// 一次起卦只占一条:钉盘重算(改时地 / 流派 / 传本 / 所问宫…)出的还是同一副卦,种子与起卦源相同即原地替换首条(该条随之反映当前设置)。
// 判据须含起卦源:报数盘的默认种子恒为 0,只比种子会把两组不同的十六数误当同一盘。
export const GEOMANCY_HISTORY_MAX = 30;
export const GEOMANCY_HISTORY_CAST_FIELDS = ['seed', 'castMethod', 'castNumbers'];

export function geomancyHistoryCastKey(e){
	return [e && e.seed, (e && e.castMethod) || '', JSON.stringify((e && e.castNumbers) || null)].join('|');
}

// prev(旧列表,可为坏值)+ entry → 新列表(已按上限截)
export function pushGeomancyHistory(prev, entry){
	let next = [entry];
	if(Array.isArray(prev)){
		const same = prev.length && prev[0] && Number.isFinite(Number(entry && entry.seed))
			&& geomancyHistoryCastKey(prev[0]) === geomancyHistoryCastKey(entry);
		next = same ? [entry, ...prev.slice(1)] : [entry, ...prev];
	}
	return next.slice(0, GEOMANCY_HISTORY_MAX);
}

// 全量恢复按条目并集:同一时刻,或同一副卦(重算换了时刻)都算同一条 —— 只按时刻认,恢复后同一副卦出两条
export const GEOMANCY_HISTORY_RESTORE_MERGE = Object.freeze({ shape: 'array', id: [['ts'], GEOMANCY_HISTORY_CAST_FIELDS], time: 'ts', order: 'newest-first', cap: GEOMANCY_HISTORY_MAX });
