// 神数正传条文库:按派系归属管理。病史:切到大定(无条文库)时清库却不复位「已为哪派发起过」→ 铁板→大定→铁板
// 之后永远「条文库载入中」(v3.9.4 起);另有两处同源潜伏:晚到的旧派结果串到当前派、加载失败后永不再载。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import moment from 'moment';

jest.mock('../../../utils/zhengchuanTiebanLocal', () => {
	const actual = jest.requireActual('../../../utils/zhengchuanTiebanLocal');
	return { __esModule: true, ...actual, loadTiebanVerses: jest.fn() };
});
jest.mock('../../../utils/zhengchuanShaoziLocal', () => {
	const actual = jest.requireActual('../../../utils/zhengchuanShaoziLocal');
	return { __esModule: true, ...actual, loadShaoziVerses: jest.fn() };
});
// eslint-disable-next-line import/first
import * as tieban from '../../../utils/zhengchuanTiebanLocal';
// eslint-disable-next-line import/first
import * as shaozi from '../../../utils/zhengchuanShaoziLocal';
// eslint-disable-next-line import/first
import ZhengChuanMain from '../ZhengChuanMain';

const fields = {
	date: { value: moment('1953-06-24') },
	time: { value: moment('1953-06-24 10:00:00') },
	gender: { value: 1 },
	timeAlg: { value: 1 },
	lon: { value: '' },
};
const LOADING = '条文库载入中';
function deferred(){ let resolve; let reject; const p = new Promise((r, j) => { resolve = r; reject = j; }); return { p, resolve, reject }; }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
function versesProxy(tag){ return new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? `${tag}-${k}` : undefined) }); }

describe('神数正传条文库按派系归属', () => {
	let host; let inst;
	const mount = async (school) => { await act(async () => { ReactDOM.render(<ZhengChuanMain slot="center" fields={fields} opts={{ school }} ref={(r) => { inst = r; }} />, host); }); };
	beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); tieban.loadTiebanVerses.mockReset(); shaozi.loadShaoziVerses.mockReset(); });
	afterEach(() => { ReactDOM.unmountComponentAtNode(host); host.remove(); });

	test('铁板 → 大定 → 铁板:切回直接复用,不再卡「条文库载入中」', async () => {
		tieban.loadTiebanVerses.mockImplementation(() => Promise.resolve(versesProxy('T')));
		await mount('tieban'); await flush();
		expect(host.textContent).not.toContain(LOADING);
		await mount('dading'); await flush();
		expect(host.textContent).not.toContain(LOADING);
		await mount('tieban'); await flush();
		expect(host.textContent).not.toContain(LOADING);
		expect(inst.currentVerses()).toBeTruthy();
		expect(tieban.loadTiebanVerses).toHaveBeenCalledTimes(1);   // 库在手 → 不重载
	});

	test('铁板(慢)→ 邵子(快):晚到的铁板库不串到邵子', async () => {
		const t = deferred(); const s = deferred();
		tieban.loadTiebanVerses.mockImplementation(() => t.p);
		shaozi.loadShaoziVerses.mockImplementation(() => s.p);
		await mount('tieban');
		await mount('shaozi');
		s.resolve(versesProxy('S')); await flush();
		t.resolve(versesProxy('T')); await flush();
		expect(inst.state.versesFor).toBe('shaozi');
		expect(inst.currentVerses()['1']).toBe('S-1');
		expect(host.textContent).not.toContain(LOADING);
	});

	test('加载失败 → 仍显示载入中;opts 再变即重试并落地', async () => {
		const first = deferred();
		tieban.loadTiebanVerses.mockImplementationOnce(() => first.p).mockImplementation(() => Promise.resolve(versesProxy('T')));
		await mount('tieban');
		first.reject(new Error('chunk load failed')); await flush();
		expect(host.textContent).toContain(LOADING);
		await act(async () => { ReactDOM.render(<ZhengChuanMain slot="center" fields={fields} opts={{ school: 'tieban', ke: '2' }} ref={(r) => { inst = r; }} />, host); });
		await flush();
		expect(tieban.loadTiebanVerses).toHaveBeenCalledTimes(2);
		expect(host.textContent).not.toContain(LOADING);
	});

	test('大定无条文库:不触发任何加载、不显示载入中', async () => {
		await mount('dading'); await flush();
		expect(tieban.loadTiebanVerses).not.toHaveBeenCalled();
		expect(shaozi.loadShaoziVerses).not.toHaveBeenCalled();
		expect(host.textContent).not.toContain(LOADING);
	});
});
