// 文本行级 diff 单源(LCS;纯函数零副作用)。消费方:写前审批预览 AgentDiffPreview、报告族对比视图。
// 行数各截 DIFF_MAX_LINES 防 O(n²) 失控;超出部分不参与对比(预览用途,不是补丁工具)。
export const DIFF_MAX_LINES = 1500;

export function diffLines(a, b){
	const aLines = `${a || ''}`.split('\n').slice(0, DIFF_MAX_LINES);
	const bLines = `${b || ''}`.split('\n').slice(0, DIFF_MAX_LINES);
	const m = aLines.length, n = bLines.length;
	const dp = Array.from({ length: m + 1 }, ()=>new Uint16Array(n + 1));
	for(let i = 1; i <= m; i++){
		for(let j = 1; j <= n; j++){
			dp[i][j] = aLines[i - 1] === bLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}
	const out = [];
	let i = m, j = n;
	while(i > 0 && j > 0){
		if(aLines[i - 1] === bLines[j - 1]){ out.push({ t: 'eq', a: aLines[i - 1] }); i--; j--; }
		else if(dp[i - 1][j] >= dp[i][j - 1]){ out.push({ t: 'del', a: aLines[i - 1] }); i--; }
		else { out.push({ t: 'add', a: bLines[j - 1] }); j--; }
	}
	while(i > 0){ out.push({ t: 'del', a: aLines[--i] }); }
	while(j > 0){ out.push({ t: 'add', a: bLines[--j] }); }
	return out.reverse();
}

// 只留变化行及其前后各 context 行(预览用):空 diff 回 []
export function diffHunks(a, b, context){
	const rows = diffLines(a, b);
	const keep = new Set();
	const c = Number.isFinite(context) ? Math.max(0, context) : 1;
	rows.forEach((r, idx)=>{ if(r.t !== 'eq'){ for(let k = Math.max(0, idx - c); k <= Math.min(rows.length - 1, idx + c); k++){ keep.add(k); } } });
	return rows.map((r, idx)=>({ ...r, idx })).filter((r)=>keep.has(r.idx));
}

export function diffSummary(a, b){
	const rows = diffLines(a, b);
	let add = 0, del = 0;
	rows.forEach((r)=>{ if(r.t === 'add'){ add += 1; } else if(r.t === 'del'){ del += 1; } });
	return { add, del, changed: add + del > 0 };
}
