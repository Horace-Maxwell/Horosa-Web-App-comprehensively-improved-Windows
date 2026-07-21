// three r0.185 的 jest 万能 stub —— 'three' 主包与 examples/jsm 全族共用
//(仅 jest.config.js moduleNameMapper 消费,构建产物零涉及)。
//
// 为什么 stub(2026-07-16 三层实捕后的终局定谳):
//   ① three 的 exports.require 指 build/three.cjs —— umi-test transform 只认
//     js|jsx|ts|tsx,.cjs 被 file transformer 当【资产】,require('three') 得到
//     文件名字符串(keys=0..8)→ examples 转译产物 `_three.Ray` undefined;
//   ② 改钉 build/three.module.js(ESM,.js 可转译)→ 其内 three.core.js 用 ES2022
//     static class blocks,umi-test 捆绑 babel 预设不支持,SyntaxError;
//   ③ 全仓仅 astro3d import three,且 jsdom 里 Astro3D 永不实例化(无 WebGL)——
//     import 链能通即可。任意属性/构造/调用均返回新 stub,链式不炸。
// ⚠️ 若未来需要「真 three 数学」单测(Vector3 等),把所需类抽进零依赖纯模块
//   (照 sphMath.js 先例),别解除本映射(解除=直面 ①②)。
function makeUniversal(){
	const fn = function UniversalThreeStub(){ return fn; };
	return new Proxy(fn, {
		get(target, prop){
			if(prop === '__esModule'){ return true; }
			if(prop === Symbol.toPrimitive){ return ()=>'[three-jest-stub]'; }
			if(prop === 'prototype'){ return target.prototype; }
			return makeUniversal();
		},
		construct(){ return makeUniversal(); },
		apply(){ return makeUniversal(); },
	});
}

module.exports = makeUniversal();
