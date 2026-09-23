/**
 * horosa_liqi_schools_mount_smoke_v1 —— 风水理气工作区「每一派用缺省参数打开都不能炸」挂载冒烟(Windows-ahead;建议上游化 Mac)。
 *
 * ## 事故(GitHub issue #84,v3.11.1)
 * 各派 compute 在输入不足时返回 { available: false }(命理派命主年未填 / 八宅坐山不在表 / 水龙无排龙 / 玄空向首不合法 / 择日无年…共 11 处),
 * 而 LiqiWorkspace 的中栏 / 右栏渲染分支直接解引用 result.fangwei / palaces / items:命理派缺省(命主年为空,Q-226)一选即
 * `TypeError: Cannot read properties of undefined (reading 'map')`;流派选择又是持久化的 ⇒ 重开软件仍然报错,风水页永久打不开。
 * 与 #98 / #83 / #105 同一个洞的又一形:**「切换到某个子模式」这条路没有任何用例真的渲染过**。
 *
 * ## 本用例
 * 面板表现读 FengShuiMain 的 LIQI_SCHOOLS(新增流派自动进覆盖面),逐派用组件缺省 state 真挂载(ReactDOM + act),断言:
 *   ① 不抛、window 零未捕获;② 左栏参数列存在;③ 不可用态(命理派缺省)必须画出「参数不足」提示卡而不是崩;
 *   ④ 源码级负锚:LiqiWorkspace 顶层 render 必含 available===false 守卫。
 */
global.React = require('react');
if(!window.matchMedia){
	window.matchMedia = (query) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false });
}
if(!window.ResizeObserver){ window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }; }
if(typeof window.SVGElement !== 'undefined' && !window.SVGElement.prototype.getBBox){ window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }); }
window.HTMLCanvasElement.prototype.getContext = function(){ return new Proxy({}, { get(_t, k){ if(k === 'measureText') return () => ({ width: 0 }); if(typeof k === 'symbol') return undefined; return () => undefined; }, set(){ return true; } }); };
jest.mock('../../../utils/request', () => jest.fn(() => new Promise(() => {})));
jest.mock('../../../utils/moduleAiSnapshot', () => ({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(() => null) }));

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import { LIQI_SCHOOLS } from '../FengShuiMain';
import LiqiWorkspace from '../LiqiWorkspace';

jest.setTimeout(120000);
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'LiqiWorkspace.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mountSchool(school){
	const errors = [];
	const onErr = (ev) => errors.push(String((ev.error && ev.error.stack) || ev.message));
	window.addEventListener('error', onErr);
	const container = document.createElement('div');
	document.body.appendChild(container);
	try{
		await act(async () => { ReactDOM.render(<LiqiWorkspace school={school} active geo={null} />, container); });
		await act(async () => { await sleep(30); });
		return { errors, text: container.textContent || '', params: !!container.querySelector('.horosa-fengshui-liqi-params'), html: container.innerHTML.length };
	}finally{
		try{ await act(async () => { ReactDOM.unmountComponentAtNode(container); }); }catch(e){ errors.push('unmount: ' + e.message); }
		container.remove();
		window.removeEventListener('error', onErr);
	}
}

describe('风水理气工作区 · 逐派缺省挂载冒烟(面板表现读 LIQI_SCHOOLS)', () => {
	test(`LIQI_SCHOOLS 至少 15 派(v3.11.1 实为 ${LIQI_SCHOOLS.length};解析失效即红)`, () => {
		expect(Array.isArray(LIQI_SCHOOLS)).toBe(true);
		expect(LIQI_SCHOOLS.length).toBeGreaterThanOrEqual(15);
		expect(LIQI_SCHOOLS).toContain('mingli');
		expect(LIQI_SCHOOLS).toContain('sanhe');
		expect(LIQI_SCHOOLS).toContain('luopan');
	});

	test.each(LIQI_SCHOOLS.map((s) => [s]))('流派 %s 缺省参数真挂载不抛、左栏在', async (school) => {
		const r = await mountSchool(school);
		expect(`${school}: ${r.errors.join(' | ')}`).toBe(`${school}: `);
		expect(r.params).toBe(true);
		expect(r.html).toBeGreaterThan(0);
	});

	test('命理派缺省(命主年未填)= 不可用态:画「参数不足」提示卡,不崩(issue #84 直接回归)', async () => {
		const r = await mountSchool('mingli');
		expect(r.errors).toEqual([]);
		expect(r.text).toContain('参数不足');
		expect(r.text).toContain('命主年');
	});

	test('源码级:顶层 render 带 available===false 守卫(负锚防回潮)', () => {
		expect(SRC).toContain('horosa_liqi_unavailable_guard_v1');
		expect(SRC).toContain('if (result.available === false) {');
		expect(SRC).toContain('horosa_luopan_dial_viewport_cap_v1');
		expect(SRC).toContain('Math.min(chartBox.w, chartBox.h, viewportCap)');
	});
});
