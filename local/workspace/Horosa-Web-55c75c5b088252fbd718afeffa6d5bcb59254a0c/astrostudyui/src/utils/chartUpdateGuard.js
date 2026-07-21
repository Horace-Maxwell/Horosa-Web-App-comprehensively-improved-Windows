// chartUpdateGuard.js —— 重组件 shouldComponentUpdate(sCU)的浅比较工具。
//
// 背景(根因 E/G):盘面叶子组件(AstroChart 的 d3 全量重建、印度盘的整 SVG 重渲、量化中点盘)在
// componentDidUpdate / render 里无条件做昂贵重绘。父级任意 setState(开关 drawer、tooltip、sibling
// 状态变更、120ms retry)都让这些叶子白跑一次「输入根本没变」的重绘 →「越用越卡」。
// sCU 的职责:输入(影响盘面输出的全部 props/state)逐项相等 → 返回 false 跳过这次冗余 re-render;
// 任一变化 → 返回 true 照常渲染。**只跳冗余渲染,绝不可能让组件变慢**(比较是 O(props) 廉价标量/引用)。
//
// 取向:**宁可多渲、绝不漏渲**。
//  - value / chartObj / 中点数据等「大对象」用引用相等:后端每次返回新对象,任何影响盘面的数据/参数变更
//    都会改其引用,引用比既完整(覆盖对象内任意字段)又廉价(不深比)。
//  - 仅「小的显示开关数组」(chartDisplay / planetDisplay / lotsDisplay / keyPlanets)用 sameDisplayList
//    做内容比:父级常每次 render 传新数组字面量(引用恒变),用引用比会让 sCU 形同虚设(恒 true)。

import { chartSCUEnabled } from './perfFlags';

// 显示开关列表比较:用于 chartDisplay / planetDisplay / lotsDisplay / keyPlanets。
//  - 同引用 → true(含都为同一对象 / 都 undefined / 都 null)。
//  - 都是数组 → 长度相等且逐元素 ===(浅比;元素是字符串/数字 id,严格相等即内容相等)。
//  - 其余(一边数组一边非数组、或非数组标量)→ 退化为 ===。
export function sameDisplayList(a, b){
	if(a === b){
		return true;
	}
	if(Array.isArray(a) && Array.isArray(b)){
		if(a.length !== b.length){
			return false;
		}
		for(let i = 0; i < a.length; i++){
			if(a[i] !== b[i]){
				return false;
			}
		}
		return true;
	}
	return a === b;
}

// 按指定 keys 浅比较两个 props/state 对象。
//  - 同引用 → true(快路)。
//  - 任一为 null/undefined → false(无法逐键比,保守判不等 → 照渲)。
//  - 逐 key:若 comparators[key] 提供则用之(如 sameDisplayList),否则 Object.is(覆盖 NaN / ±0 边角)。
// comparators 缺省 {} → 全部走 Object.is(纯引用/值比)。
export function shallowPropsEqual(a, b, keys, comparators){
	if(a === b){
		return true;
	}
	if(!a || !b){
		return false;
	}
	const cmp = comparators || {};
	for(let i = 0; i < keys.length; i++){
		const k = keys[i];
		const fn = cmp[k];
		if(fn){
			if(!fn(a[k], b[k])){
				return false;
			}
		}else if(!Object.is(a[k], b[k])){
			return false;
		}
	}
	return true;
}

/**
 * 重 wrapper 通用 sCU(WP-H-2):全部自有 props 机械浅比 —— 任一数据 prop 引用变即重渲;
 * 【函数型 props 视为恒等】(changeCond/changeTab 等是宿主每次 render 新建的闭包,
 * 引用永远在变,不排除则浅比恒 false、sCU 形同虚设。其行为由所捕获的数据 props 表达:
 * 数据变必触发重渲,重渲时自然拿到新闭包 —— 故跳过安全)。
 * 机械全覆盖,免手抄 keys 的漏渲风险(「宁可多渲、绝不漏渲」取向不变);state 由调用方另比。
 * kill-switch 同 chartSCU:关 = 恒重渲旧行为。
 */
export function wrapperPropsEqual(prev, next){
	if(!chartSCUEnabled()){
		return false;
	}
	const pk = Object.keys(prev);
	const nk = Object.keys(next);
	if(pk.length !== nk.length){
		return false;
	}
	for(let i = 0; i < nk.length; i += 1){
		const k = nk[i];
		const a = prev[k];
		const b = next[k];
		if(typeof a === 'function' && typeof b === 'function'){
			continue;
		}
		if(a !== b){
			return false;
		}
	}
	return true;
}
