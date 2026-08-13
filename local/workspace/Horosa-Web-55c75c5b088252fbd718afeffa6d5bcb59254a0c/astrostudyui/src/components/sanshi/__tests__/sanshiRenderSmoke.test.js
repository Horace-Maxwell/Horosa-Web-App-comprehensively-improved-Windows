/**
 * horosa_sanshi_render_smoke_v1 —— 三式页「打开就不能炸」渲染冒烟(Windows-ahead;建议上游化 Mac)。
 *
 * ## 为什么必须有这个用例(gotcha #98,线上事故直接催生)
 *
 * v3.8.0 起线上三式页一打开就白屏:`ReferenceError: opt is not defined`
 * (GitHub issue #65 / #68)。根因是主类 `render()` 里有 32 处 `opt.` 而该作用域没有 `opt` ——
 * 我方 S1 渲染切片把左栏整栏收编进 `SanShiInputPanel` 后,v3.8.0 上游新增的 24 个控件
 * 在同步时落进了**主类 render()** 这个错误宿主,声明却留在子组件里。
 *
 * **本目录当时已有 6 个测试文件,却没有一个 mount 过这个组件** —— 所以连发两版都没人发现。
 * 这个用例补的正是那个洞:**只要 render 会抛,它就红**。
 *
 * 与 `check-no-undef.cjs`(作用域分析门)是**互补而非重复**:
 *   · 门是静态的、覆盖全部 1500+ 文件,能抓「任何未声明标识符」——但抓不到「渲染时才炸的其它错」;
 *   · 本用例是动态的、只覆盖三式一页,但能抓「真正渲染一遍会不会炸」。
 * 两者都留着。
 *
 * ## 第二条断言的用意(防「改成能跑但控件丢了」)
 *
 * 修这个 bug 有一种看起来更省事的做法:把那段 JSX 直接删掉 —— 报错确实没了,
 * **但 24 个 v3.8.0 新档(年家/日家/刻家定局、八神取神、中宫寄宫、暗干暗支、飞法三层…)
 * 会一起消失,而且没有任何测试会红**。所以这里逐个点名断言它们在渲染产物里可见。
 */
// 台架前置:本仓 66 个技法主组件里有 47 个(含 SanShiUnitedMain)只 `import { Component } from 'react'`,
// 依赖**自动 JSX 运行时** —— 产品构建(umi)如此编译完全正确。但 jest 侧这条链按**经典运行时**
// 展开 JSX(产出 `React.createElement`),于是组件自身模块作用域里没有 `React`。
// 这是台架与构建的转换差异,**不是产品缺陷**;渲染型用例按惯例补一个全局 React 即可。
// (放在所有 import 之前:jest 会把 jest.mock 提升,但 global 赋值要早于组件模块求值。)
global.React = require('react');

jest.mock('../../astro/AstroHelper', ()=>({
	splitDegree: jest.fn(()=>[0, 0]),
	convertLatToStr: (value)=>`${value}`,
	convertLonToStr: (value)=>`${value}`,
}));
// 这三个替身必须是**合法组件**(不能像其它 sanshi 用例那样返回 null):本用例真的会渲染
// 左栏,渲染到 null 类型会抛 "Element type is invalid" —— 那是替身的问题,不是产品的问题,
// 会把真信号淹掉。给一个最小占位组件即可。
jest.mock('../../liureng/ChuangChart', ()=>({ __esModule: true, default: ()=>null }));
jest.mock('../../amap/GeoCoordModal', ()=>({ __esModule: true, default: ()=>null }));
jest.mock('../../astro/PlusMinusTime', ()=>({ __esModule: true, default: ()=>null }));
jest.mock('../../../utils/request', ()=>jest.fn());
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(),
	saveModuleAISnapshotLazy: jest.fn(),
}));
jest.mock('../../../utils/preciseCalcBridge', ()=>({
	fetchPreciseNongli: jest.fn(),
	fetchPreciseJieqiSeed: jest.fn(),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SanShiUnitedMain from '../SanShiUnitedMain';
import DateTime from '../../comp/DateTime';
// 注:SanShiInputPanel 未从模块导出(同文件内部类),故经 renderInputPanel() 返回元素的
// `.type` 拿到它 —— 这样也顺带证明了「主类确实把左栏委托给了它」这条接线。

function buildFields(){
	const dt = new DateTime();
	dt.parse('1990-06-15 10:30:00', 'YYYY-MM-DD HH:mm:ss');
	dt.setZone('+08:00');
	return {
		cid: { value: 'smoke' },
		name: { value: '冒烟' },
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		ad: { value: dt.ad },
		zone: { value: '+08:00' },
		lon: { value: 116.4 },
		lat: { value: 39.9 },
		gpsLon: { value: 116.4 },
		gpsLat: { value: 39.9 },
		zodiacal: { value: 0 },
		hsys: { value: 0 },
		timeAlg: { value: 0 },
		gender: { value: 1 },
	};
}

describe('三式页渲染冒烟(打开就不能炸)', ()=>{
	test('主类 render() 不抛 —— issue #65/#68 的直接回归守卫', ()=>{
		const inst = new SanShiUnitedMain({ fields: buildFields(), height: 900 });
		inst.props = { fields: buildFields(), height: 900 };
		// 不经 React 生命周期直接取渲染树:render 里任何未声明标识符会在此刻抛 ReferenceError。
		expect(()=>inst.render()).not.toThrow();
	});

	// 这 24 档全是**条件渲染**(年家定局只在 paiPanType===0 出，飞法三层只在 ===1 出，
	// 天盘层/九星层… 只在 school==='混合' 出)。所以不能拿单一默认态去断言 —— 那样必然假红。
	// 按各自条件铺一张最小组合矩阵,渲染取并集:**每一档都必须在至少一种组合下真的画出来**。
	// 这样既证明「不抛」,也证明「控件确实可达」,堵死「把 JSX 删掉让报错消失」的假修复。
	const MATRIX = [
		{ paiPanType: 0 },
		{ paiPanType: 1 },
		{ paiPanType: 2 },
		{ paiPanType: 4 },
		{ paiPanType: 6 },
		{ school: '混合' },
	];

	function renderPanelHtml(options){
		const host = new SanShiUnitedMain({ fields: buildFields(), height: 900 });
		host.props = { fields: buildFields(), height: 900 };
		host.state = { ...host.state, options: { ...(host.state.options || {}), ...options } };
		const el = host.renderInputPanel();
		const Panel = el.type;
		const inner = new Panel(el.props);
		inner.props = el.props;
		return renderToStaticMarkup(<div>{inner.render()}</div>);
	}

	test('左栏输入面板在全部组合下渲染不抛', ()=>{
		MATRIX.forEach((options)=>{
			expect(()=>renderPanelHtml(options)).not.toThrow();
		});
	});

	test('v3.8.0 新增的 24 档全部真的可达(防「删掉就不报错」式假修复)', ()=>{
		const union = MATRIX.map(renderPanelHtml).join('\n');
		const missing = [
			'年家定局', '日家定局', '刻家分遁', '子正换时', '八门排法', '月家起局',
			'八神取神', '中宫寄宫', '暗干', '暗支', '空亡标注', '四柱空亡',
			'移星值符', '九星飞法', '九门飞法', '九神飞法', '中门飞宫', '中宫门位显示',
			'天盘层', '九星层', '八门层', '九神层', '盘类', '相关人员',
		].filter((label)=>!union.includes(label));
		expect(missing).toEqual([]);
	});
});
