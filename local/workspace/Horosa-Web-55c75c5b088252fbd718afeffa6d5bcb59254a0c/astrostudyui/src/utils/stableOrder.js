// 并列稳定:排序键 / 边界判断用到浮点量时的统一写法(零依赖,纯函数)。
//
// 同一张盘在不同机器上算出来的黄经,末位会差一点(数学库、处理器不同)。数学上本该相等的两个量 ——
// 南北交点成对的相位、和差式 A+B−C=D 与 A+B−D=C、正对两点的两个中点 —— 末位各差各的:
// 直接按数值排,谁先谁后由末位决定;直接取整 / 比大小,落在边界这边还是那边也由末位决定。
// 这里把差不到 TIE_EPS 的两个值当作相等:并列的按后面的键、最后按原来的先后排;恰在边界上的按约定的那一边算。
// TIE_EPS 远大于末位误差(1e-13 量级)、远小于任何显示精度,真有先后的两项不会被并到一起。
export const TIE_EPS = 1e-9;

const isNum = (v)=>typeof v === 'number';
const cmpRaw = (a, b)=>{
	if(isNum(a) && isNum(b)){
		const na = Number.isNaN(a); const nb = Number.isNaN(b);
		if(na || nb){ return na === nb ? 0 : (na ? 1 : -1); }   // 无效值排最后
		return a < b ? -1 : (a > b ? 1 : 0);
	}
	const sa = `${a}`; const sb = `${b}`;
	return sa < sb ? -1 : (sa > sb ? 1 : 0);
};

// 两个值是否「相等」:数值差不到 eps 即算;其余按全等
export function sameValue(a, b, eps){
	if(isNum(a) && isNum(b)){
		if(Number.isNaN(a) || Number.isNaN(b)){ return Number.isNaN(a) && Number.isNaN(b); }
		return Math.abs(a - b) <= (eps === undefined ? TIE_EPS : eps);
	}
	return a === b;
}

// 按若干个键依次排序(返回新数组,不动原数组)。每个键是「取值函数」或 { of, desc, eps }:
// 取出的是数值时,相邻两项差不到 eps 算并列(一串挨着的都并列);并列的再按下一个键排;键用完了按原来的先后。
// 例:tieSort(rows, (r)=>rank(r), (r)=>r.sep)  ← 先按档次、再按误差,误差相等的保持生成时的先后
export function tieSort(list, ...keys){
	const items = Array.from(list || []).map((item, index)=>({ item, index }));
	const byIndex = (a, b)=>a.index - b.index;
	const walk = (arr, level)=>{
		if(arr.length < 2){ return arr; }
		if(level >= keys.length){ return arr.slice().sort(byIndex); }
		const spec = typeof keys[level] === 'function' ? { of: keys[level] } : (keys[level] || {});
		const sign = spec.desc ? -1 : 1;
		const dec = arr.map((x)=>({ x, v: spec.of(x.item) }));
		dec.sort((a, b)=>(cmpRaw(a.v, b.v) * sign) || byIndex(a.x, b.x));
		const out = [];
		let run = [];
		const flush = ()=>{ if(run.length){ walk(run, level + 1).forEach((x)=>out.push(x)); run = []; } };
		dec.forEach((d, i)=>{
			if(i > 0 && !sameValue(dec[i - 1].v, d.v, spec.eps)){ flush(); }
			run.push(d.x);
		});
		flush();
		return out;
	};
	return walk(items, 0).map((x)=>x.item);
}

// 取整到下面那一格,但恰在整数上(差不到 eps)的算到那个整数:29.999999999999996 → 30,而不是 29
export function floorStable(x, eps){
	const e = eps === undefined ? TIE_EPS : eps;
	const r = Math.round(x) + 0;   // +0:把 −0 归成 0
	return Math.abs(x - r) <= e ? r : Math.floor(x);
}

// 把恰在整数上(差不到 eps)的值吸到那个整数,其余原样:用在取模 / 分段之前
export function snapInteger(x, eps){
	const e = eps === undefined ? TIE_EPS : eps;
	const r = Math.round(x) + 0;
	return Math.abs(x - r) <= e ? r : x;
}

// a ≤ b,恰相等(差不到 eps)算「是」:阈值判断用(误差正好等于容许度的,各台机器判同一边)
export function lteStable(a, b, eps){
	return a <= b || sameValue(a, b, eps);
}
// a < b,恰相等(差不到 eps)算「否」
export function ltStable(a, b, eps){
	return a < b && !sameValue(a, b, eps);
}
