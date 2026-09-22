// 差分证据强度判别(纯函数,无 fs / React 依赖)。
// 「拨值后正文变了」有两种:算法结果变了(强证据),或只有设置回显行里的取值字样变了(弱证据:值被写进快照,不代表被消费)。
// 判别法:把 ov 独有行里的「候选值字样」换回「基线值字样」,若换后恰为基线里的一行(反向同理),该行即回显行;
// 全部差异行都能这样解释 → label-only。只做整词替换,取值字样来自选项标签 / 原值 / 布尔通用词对。

const BOOL_WORD_PAIRS = [
	['是', '否'], ['开', '关'], ['开启', '关闭'], ['启用', '停用'], ['启用', '关闭'], ['显示', '隐藏'],
	['有', '无'], ['✓', '✗'], ['true', 'false'], ['1', '0'],
];

function optValueOf(o){
	if(o && typeof o === 'object' && !Array.isArray(o)){ return o.value; }
	return Array.isArray(o) ? o[0] : o;
}
function optLabelOf(o){
	if(o && typeof o === 'object' && !Array.isArray(o)){ return o.label; }
	return Array.isArray(o) ? o[1] : undefined;
}
function sameValue(a, b){ return a === b || `${a}` === `${b}`; }
function isBoolish(field, v){
	return (field && field.type === 'switch') || typeof v === 'boolean';
}

// 快照回显与选项标签的书写差异:全角/半角括号与标点、空白、「默认」注记 —— 比较前统一归一
export function normalizeEcho(text){
	return `${text == null ? '' : text}`
		.replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';')
		.replace(/\s+/g, '');
}
function labelVariants(label){
	const out = new Set();
	const n = normalizeEcho(label);
	if(!n){ return out; }
	out.add(n);
	const noDefault = n.replace(/[,;]?默认(=[^)]*)?/g, '').replace(/\(\)/g, '');
	if(noDefault){ out.add(noDefault); }
	const bare = n.replace(/\([^)]*\)/g, '');
	if(bare){ out.add(bare); }
	return out;
}

// 某取值在快照里可能出现的字样(归一后;按长度降序,长的先替换,避免「开启」被「开」截断)
export function echoTokensOf(field, v){
	const out = new Set();
	if(v === undefined || v === null){ return []; }
	if(Array.isArray(v)){ return []; }
	const raw = normalizeEcho(v);
	if(raw && raw.length <= 40){ out.add(raw); }
	const opts = field && Array.isArray(field.options) ? field.options : [];
	const hit = opts.find((o)=>sameValue(optValueOf(o), v));
	const label = hit ? optLabelOf(hit) : undefined;
	if(typeof label === 'string'){ labelVariants(label).forEach((t)=>out.add(t)); }
	return [...out].sort((a, b)=>b.length - a.length);
}
// 同一齿轮其它选项的字样(基线取值为「随全局」等解析值时,回显的是另一个选项的标签)
function otherOptionTokens(field, v){
	const opts = field && Array.isArray(field.options) ? field.options : [];
	const out = new Set();
	opts.forEach((o)=>{ if(!sameValue(optValueOf(o), v)){ echoTokensOf(field, optValueOf(o)).forEach((t)=>out.add(t)); } });
	return [...out];
}

// 整词替换:token 两侧不得紧贴「同类字符」(数字贴数字、ASCII 字母贴字母),中文标签按子串替换
function replaceWhole(line, from, to){
	if(!from || line.indexOf(from) < 0){ return null; }
	const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const ascii = /^[A-Za-z0-9_.\-+]+$/.test(from);
	const re = ascii ? new RegExp(`(^|[^A-Za-z0-9_.])${esc}(?![A-Za-z0-9_])`, 'g') : new RegExp(esc, 'g');
	if(!re.test(line)){ return null; }
	re.lastIndex = 0;
	return ascii ? line.replace(re, (m, p1)=>`${p1}${to}`) : line.replace(re, to);
}

function tokenPairs(field, cand, base){
	const pairs = [];
	const ct = echoTokensOf(field, cand);
	const bt = new Set(echoTokensOf(field, base).concat(otherOptionTokens(field, cand)));
	ct.forEach((c)=>bt.forEach((b)=>{ if(c !== b && c.indexOf(b) < 0 && b.indexOf(c) < 0){ pairs.push([c, b]); } }));
	if(isBoolish(field, cand) || isBoolish(field, base)){
		const cOn = !!(cand === true || cand === 1 || cand === '1');
		const bOn = !!(base === true || base === 1 || base === '1');
		if(cOn !== bOn){
			BOOL_WORD_PAIRS.forEach(([on, off])=>{ pairs.push(cOn ? [on, off] : [off, on]); });
		}
	}
	return pairs;
}

/**
 * @param {object} p { ovLines: string[], baseLines: string[], noise: Set<string>, field, cand, base }
 * @returns {{ labelOnly: boolean, deltaN: number, sample: string[] }}
 */
export function classifyContentDelta(p){
	const noise = new Set([...(p.noise || [])].map(normalizeEcho));
	const ovLines = p.ovLines.map(normalizeEcho);
	const baseLines = p.baseLines.map(normalizeEcho);
	const ovSet = new Set(ovLines);
	const baseSet = new Set(baseLines);
	const ovOnly = ovLines.filter((l)=>!baseSet.has(l) && !noise.has(l));
	const baseOnly = baseLines.filter((l)=>!ovSet.has(l) && !noise.has(l));
	const deltaN = ovOnly.length + baseOnly.length;
	const sample = ovOnly.slice(0, 3).map((l)=>`+${l.slice(0, 100)}`).concat(baseOnly.slice(0, 2).map((l)=>`-${l.slice(0, 100)}`));
	if(!deltaN){ return { labelOnly: false, deltaN, sample }; }
	const pairs = tokenPairs(p.field, p.cand, p.base);
	if(!pairs.length){ return { labelOnly: false, deltaN, sample }; }
	const explained = (line, fromIdx, target)=>pairs.some((pr)=>{
		const swapped = replaceWhole(line, pr[fromIdx], pr[1 - fromIdx]);
		return swapped !== null && target.has(swapped);
	});
	const allOv = ovOnly.every((l)=>explained(l, 0, baseSet));
	const allBase = baseOnly.every((l)=>explained(l, 1, ovSet));
	return { labelOnly: allOv && allBase, deltaN, sample };
}

/**
 * 差分证据强度(单源;差分闸与其单测共用)。
 * 强 = 正文算法行变(且不是只有设置回显行)/ 只换行序;引擎入参变**只在正文不可观测时**算强 ——
 * 正文可观测却逐字不变 = 引擎入参到了、结果没写进正文,记弱证据,由调用方继续换候选 / 盘变体 / 上下文找正文差分。
 * @param {{ contentDiff: boolean, labelOnly: boolean, orderDiff: boolean, argsDiff: boolean, contentObservable: boolean }} d
 */
export function evidenceIsStrong(d){
	const x = d || {};
	return !!((x.contentDiff && !x.labelOnly) || x.orderDiff || (x.argsDiff && !x.contentObservable));
}
