/**
 * horosa_technique_open_smoke_v1 —— 全技法「打开就不能炸」首屏挂载冒烟(Windows-ahead;建议上游化 Mac)。
 *
 * ## 为什么必须有这个用例(gotcha #105,线上事故直接催生)
 *
 * v3.11.0 线上:大六壬一打开就整页报错(GitHub issue #83)——
 *   `TypeError: Cannot read properties of null (reading 'timeAlg')` at LiuRengInputPanel.render。
 * 根因是上游新落的「时间算法」控件 hunk 打进了我方渲染切片的**子组件**,却带着主类的
 * `value={this.state.timeAlg} onChange={this.onTimeAlgChange}` 形;子组件从不初始化 state,首屏 render 即炸。
 *
 * **全仓 924 套 / 12,991 例 umi 用例里,引用 LiuRengMain 的有 15 个文件,却没有一个 mount 过它** ——
 * 全部只 import 无头 builder。三式(#98)、六壬(#83)两次线上事故都是同一个洞:
 * **技法主面板没有任何「真的渲染一遍」的用例**,首屏 render 抛错对整个测试体系不可见。
 *
 * 本用例把洞整个堵上,而且**不逐页手写清单**:直接解析 `pages/index.js` 的顶层 `<TabPane key=…>` 面板表与
 * `lazyPreloadable(() => import(...))` / 静态 import 映射,得到「全部技法页 → 组件模块」,逐页在 jsdom 里
 * 用 ReactDOM 真挂载(含 React.lazy 子块、componentDidMount、首轮 setState),断言:
 *   ① 边界没接到任何 render/生命周期异常;② window 没有未捕获异常;③ 首屏树里没有技法错误边界的回退卡片。
 * 上游以后新增技法页会**自动进入覆盖面**(面板表是从 index.js 现读的),数量下限钉死防「解析失效=空集假绿」。
 *
 * 与静态门的分工(都留着,互补不重复):
 *   · `check-this-member-binding.cjs`(v2):类体内 this.x( / this.x 值引用 / this.state 解引用必须在本类可解 —— 静态、全树;
 *   · `check-no-undef.cjs`:自由标识符作用域;
 *   · 本用例:动态、只看首屏,但能抓「真正渲染一遍会不会炸」的任何形态(空值穿透 / 缺 import / 子块 lazy 解析空 …)。
 *
 * 台架说明:jsdom 缺的浏览器 API 在下面统一垫(matchMedia / ResizeObserver / canvas 2D / SVG 度量 / requestIdleCallback /
 * Worker / createObjectURL);网络一律不出门(request/fetch 永不落定);dispatch 回一个已落定的 Promise。
 * 这些都是「让页面能走到首屏」的最小环境,不是替身逻辑 —— 首屏若依赖后端数据,页面本来就应当在无数据态可渲染
 * (用户第一次打开就是这个状态)。
 */
// 47 个技法主组件只 `import { Component } from 'react'`(依赖自动 JSX 运行时);jest 侧按经典运行时展开 JSX,
// 组件模块作用域里没有 React ⇒ 渲染型用例按惯例补全局 React(与 sanshiRenderSmoke 同理;放在所有 import 之前)。
global.React = require('react');

// ───────── jsdom 环境垫片(只补缺失,不覆盖已有) ─────────
if(!window.matchMedia){
	window.matchMedia = (query) => ({
		matches: false, media: query, onchange: null,
		addListener: () => {}, removeListener: () => {},
		addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
	});
}
if(!window.ResizeObserver){
	window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
}
if(!window.IntersectionObserver){
	window.IntersectionObserver = class { constructor(){ this.root = null; } observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; } };
}
if(!window.requestIdleCallback){
	window.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
	window.cancelIdleCallback = (id) => clearTimeout(id);
}
if(!window.Worker){
	window.Worker = class { constructor(){ this.onmessage = null; } postMessage(){} terminate(){} addEventListener(){} removeEventListener(){} };
}
if(!window.URL.createObjectURL){ window.URL.createObjectURL = () => 'blob:jsdom'; }
if(!window.URL.revokeObjectURL){ window.URL.revokeObjectURL = () => {}; }
if(!window.scrollTo){ window.scrollTo = () => {}; }
if(!Element.prototype.scrollIntoView){ Element.prototype.scrollIntoView = () => {}; }
if(!Element.prototype.scrollTo){ Element.prototype.scrollTo = () => {}; }
if(typeof window.SVGElement !== 'undefined'){
	if(!window.SVGElement.prototype.getBBox){ window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }); }
	if(!window.SVGElement.prototype.getComputedTextLength){ window.SVGElement.prototype.getComputedTextLength = () => 0; }
	if(!window.SVGElement.prototype.getTotalLength){ window.SVGElement.prototype.getTotalLength = () => 0; }
	if(!window.SVGElement.prototype.getPointAtLength){ window.SVGElement.prototype.getPointAtLength = () => ({ x: 0, y: 0 }); }
}
// canvas 2D:jsdom 的 getContext 恒 null(并打 "Not implemented" 错误日志);给一个「什么都能调、什么都不画」的上下文。
(function stubCanvas2D(){
	const ctxStub = new Proxy({}, {
		get(_t, key){
			if(key === 'measureText') return () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
			if(key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
			if(key === 'createImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
			if(key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
			if(key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => ({ addColorStop(){} });
			if(key === 'canvas') return document.createElement('canvas');
			if(typeof key === 'symbol') return undefined;
			return () => undefined;
		},
		set(){ return true; },
	});
	window.HTMLCanvasElement.prototype.getContext = function(){ return ctxStub; };
	window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
	window.HTMLCanvasElement.prototype.toBlob = (cb) => { if(cb) cb(null); };
})();
// 网络一律不出门:首屏不依赖任何后端应答(用户第一次打开就是无数据态)。
global.fetch = jest.fn(() => new Promise(() => {}));
if(!window.WebSocket){ window.WebSocket = class { constructor(){ this.readyState = 0; } send(){} close(){} addEventListener(){} removeEventListener(){} }; }
jest.mock('../../utils/request', () => jest.fn(() => new Promise(() => {})));

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';

jest.setTimeout(120000);

// ───────── 从 index.js 现读「技法页 → 组件模块」表 ─────────
const INDEX_PATH = path.resolve(__dirname, '..', 'index.js');
const INDEX_SRC = fs.readFileSync(INDEX_PATH, 'utf8');

function readImportMap(src){
	const map = {};
	const lazyRe = /const\s+([A-Za-z0-9_]+)\s*=\s*lazyPreloadable\(\s*\(\)\s*=>\s*import\(\s*(?:\/\*[^*]*\*\/\s*)?'([^']+)'\s*\)/g;
	let m;
	while((m = lazyRe.exec(src))){ map[m[1]] = m[2]; }
	const staticRe = /^import\s+([A-Za-z0-9_]+)\s+from\s+'(\.\.\/components\/[^']+)';/gm;
	while((m = staticRe.exec(src))){ if(!map[m[1]]) map[m[1]] = m[2]; }
	return map;
}

const WRAPPERS = new Set(['FreezeInactive', 'TechniqueErrorBoundary', 'Suspense', 'React', 'Fragment', 'TabPane', 'div']);
function readPanes(src){
	const panes = [];
	const paneRe = /<TabPane\b[^>]*\bkey="([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/TabPane>/g;
	let m;
	while((m = paneRe.exec(src))){
		const key = m[1];
		const body = m[2];
		const tagRe = /<([A-Z][A-Za-z0-9_.]*)\b/g;
		let t;
		let comp = null;
		while((t = tagRe.exec(body))){ if(!WRAPPERS.has(t[1])){ comp = t[1]; break; } }
		if(comp) panes.push({ key, comp });
	}
	return panes;
}

const IMPORT_MAP = readImportMap(INDEX_SRC);
const PANES = readPanes(INDEX_SRC);
// v3.11.0 实测 30 个顶层技法页;下限钉死防「解析失效 ⇒ 空集 ⇒ 全绿」。上游新增只会更多。
const MIN_PANES = 30;

// ───────── 首屏 props:与 index.js 传给各面板的完全同源(dva 各模型初始态) ─────────
const astroModel = require('../../models/astro').default;
const appModel = require('../../models/app').default;
const userModel = require('../../models/user').default;
const { convertToArray } = require('../../utils/helper');

function noop(){}
function buildProps(key){
	const astro = astroModel.state;
	const app = appModel.state;
	const user = userModel.state;
	const fields = astro.fields;
	const chartObj = astro.chartObj; // 首次打开:null(用户第一次进页面就是这个状态)
	const dispatch = jest.fn(() => Promise.resolve());
	return {
		...app,
		...user,
		value: chartObj, chart: chartObj, chartObj,
		onChange: noop,
		fields, fieldsAry: convertToArray(fields),
		height: astro.height,
		hook: (astro.predictHook && astro.predictHook[key]) || { fun: null },
		predictHook: astro.predictHook,
		dispatch,
		currentTab: key,
		currentSubTab: null,
		active: true,
		baziCalibreOverride: astro.baziCalibreOverride,
	};
}

// ───────── 捕获:边界异常 + 未捕获异常 + 技法错误边界回退卡片 ─────────
class Catcher extends React.Component {
	constructor(props){ super(props); this.state = { err: null }; }
	static getDerivedStateFromError(err){ return { err }; }
	componentDidCatch(err, info){ this.props.onError(err, info); }
	render(){ return this.state.err ? React.createElement('div', { 'data-smoke': 'boundary-hit' }) : this.props.children; }
}

function describeError(err, info){
	const msg = err && (err.stack || err.message || String(err));
	const stack = info && info.componentStack ? `\n组件栈:${String(info.componentStack).split('\n').slice(0, 8).join('\n')}` : '';
	return `${msg}${stack}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mountTechnique(pane){
	const rel = IMPORT_MAP[pane.comp];
	if(!rel) throw new Error(`index.js 面板 ${pane.key} 的组件 ${pane.comp} 在 import 表里找不到(lazyPreloadable/静态 import 形变了?)`);
	// 与 index.js 同目录解析:'../components/x/Y' → 相对本测试目录再上一级
	const mod = require(path.posix.join('..', rel));
	const Comp = mod && (mod.default || mod);
	if(typeof Comp !== 'function' && !(Comp && typeof Comp === 'object')) throw new Error(`组件模块 ${rel} 没有可渲染的默认导出`);

	const errors = [];
	const onWindowError = (ev) => { errors.push('未捕获异常: ' + describeError(ev.error || ev.message)); };
	const onRejection = (ev) => { errors.push('未处理 rejection: ' + describeError(ev.reason)); };
	window.addEventListener('error', onWindowError);
	window.addEventListener('unhandledrejection', onRejection);

	const container = document.createElement('div');
	document.body.appendChild(container);
	const props = buildProps(pane.key);
	try{
		await act(async () => {
			ReactDOM.render(
				React.createElement(Catcher, { onError: (err, info) => errors.push('边界接到异常: ' + describeError(err, info)) },
					React.createElement(React.Suspense, { fallback: null }, React.createElement(Comp, props))),
				container,
			);
		});
		// 让 React.lazy 子块落地、componentDidMount 里的首轮 setState / 微任务跑完
		for(let i = 0; i < 6; i++){ await act(async () => { await sleep(40); }); }
		const html = container.innerHTML || '';
		if(container.querySelector('[data-smoke="boundary-hit"]') && !errors.length) errors.push('边界命中但无异常记录(不应发生)');
		if(/该面板.{0,40}加载出错/.test(container.textContent || '')) errors.push('首屏出现技法错误边界回退卡片(该面板…加载出错)');
		return { errors, htmlLength: html.length };
	}finally{
		try{ await act(async () => { ReactDOM.unmountComponentAtNode(container); }); }catch(e){ errors.push('卸载时异常: ' + describeError(e)); }
		container.remove();
		window.removeEventListener('error', onWindowError);
		window.removeEventListener('unhandledrejection', onRejection);
	}
}

describe('全技法首屏挂载冒烟(打开就不能炸;面板表从 pages/index.js 现读)', () => {
	test(`index.js 顶层技法页 ≥ ${MIN_PANES} 个且每页组件都能映射到模块(解析失效即红)`, () => {
		expect(PANES.length).toBeGreaterThanOrEqual(MIN_PANES);
		const unmapped = PANES.filter((p) => !IMPORT_MAP[p.comp]).map((p) => `${p.key}→${p.comp}`);
		expect(unmapped).toEqual([]);
		// 同一组件不得重复(重复=面板表解析串行了)
		const keys = PANES.map((p) => p.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	test.each(PANES.map((p) => [p.key, p.comp, p]))('技法页 %s(%s)首屏真挂载不抛、无回退卡片', async (_key, _comp, pane) => {
		const r = await mountTechnique(pane);
		expect(`${pane.key}: ${r.errors.join('\n---\n')}`).toBe(`${pane.key}: `);
		expect(r.htmlLength).toBeGreaterThan(0);
	});
});
