// [#82] 玄学史加载序号:同一组件里「不同的加载函数」不得共用同一个序号字段。
// 病史:XuanShiStories 的 load() 与 loadDynastyOptions() 共用 _loadSeq —— 挂载时先 load(序号 1、置 loading)
// 再 loadDynastyOptions(序号 2),列表响应回来 1 !== 2 被当过期丢弃且无人清 loading → 故事专题首开永远「载入…」
// (v3.11.0 起已发布)。XuanShiCelestial 的 load() / loadMicro() 同模式潜伏。
// 本文件:① 故事专题挂载后两请求任意先后返回,列表必落地、加载态必清;② 源码级:同一序号字段只许一个方法自增。
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

jest.mock('../../../services/xuanshi', () => {
	const actual = jest.requireActual('../../../services/xuanshi');
	return { __esModule: true, ...actual, fetchStories: jest.fn(), fetchStory: jest.fn() };
});
// eslint-disable-next-line import/first
import * as svc from '../../../services/xuanshi';
// eslint-disable-next-line import/first
import XuanShiStories from '../XuanShiStories';

const STORIES = [
	{ id: 1, slug: 's-1', title: '周西伯出猎卜兆遇吕尚', dynasty: '西周', summary: 'a' },
	{ id: 2, slug: 's-2', title: '管辂筮术', dynasty: '三国', summary: 'b' },
];
function deferred(){ let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

describe('[#82] 故事专题挂载:列表必落地、加载态必清(两请求任意先后)', () => {
	let host;
	beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); svc.fetchStories.mockReset(); });
	afterEach(() => { ReactDOM.unmountComponentAtNode(host); host.remove(); });

	for (const order of ['列表先回', '朝代选项先回']) {
		test(order, async () => {
			const calls = [];
			svc.fetchStories.mockImplementation(() => { const d = deferred(); calls.push(d); return d.p; });
			await act(async () => { ReactDOM.render(<XuanShiStories ui={{}} />, host); });
			expect(calls.length).toBe(2);                       // load() + loadDynastyOptions()
			expect(host.textContent).toContain('载入');
			const [list, dyn] = calls;
			if (order === '列表先回') { list.resolve(STORIES); await flush(); dyn.resolve(STORIES); }
			else { dyn.resolve(STORIES); await flush(); list.resolve(STORIES); }
			await flush();
			expect(host.textContent).not.toContain('载入…');
			expect(host.textContent).toContain('周西伯出猎卜兆遇吕尚');
			expect(host.textContent).toContain('2 篇专题');
		});
	}

	test('筛选连改:只让最后一次的列表落地(序号守卫本意仍在)', async () => {
		const calls = [];
		svc.fetchStories.mockImplementation(() => { const d = deferred(); calls.push(d); return d.p; });
		let inst = null;
		await act(async () => { ReactDOM.render(<XuanShiStories ui={{}} ref={(r) => { inst = r; }} />, host); });
		calls[1].resolve(STORIES);                             // 朝代选项
		await act(async () => { inst.setFilter({ dynasty: '西周' }); });
		await act(async () => { inst.setFilter({ dynasty: '三国' }); });
		// calls: [0]=首载 [1]=朝代 [2]=西周 [3]=三国;三国先回、西周与首载晚回 → 只显示三国
		calls[3].resolve([STORIES[1]]); await flush();
		calls[2].resolve([STORIES[0]]); await flush();
		calls[0].resolve(STORIES); await flush();
		expect(host.textContent).toContain('管辂筮术');
		expect(host.textContent).not.toContain('周西伯出猎卜兆遇吕尚');
		expect(host.textContent).not.toContain('载入…');
	});
});

// 源码级机械闸:请求序号守卫写法 `const __seq = (this.X = (this.X || 0) + 1)`(响应回来 `__seq !== this.X` 即早退、
// 早退不清加载态)—— 同一文件里一个序号字段只许一个方法自增,否则另一方法的自增会把它的响应判成过期、加载态永远不清。
// (「谁后来谁赢」的跨方法作废令牌 —— 如 3D 星盘补间 / 取中心 —— 是有意为之、不用本写法,不在此列。)
function methodOf(lines, idx){
	for (let i = idx; i >= 0; i -= 1) {
		const m = lines[i].match(/^\t(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
		if (m) { return m[1]; }
	}
	return '?';
}
function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) { if (e.name !== '__tests__') { walk(p, out); } } else if (/\.jsx?$/.test(e.name)) { out.push(p); }
	});
	return out;
}
test('[#82] 源码:任一序号字段只被一个方法自增(不同加载函数不得共用序号)', () => {
	const root = path.join(__dirname, '..', '..');
	const offenders = [];
	let seen = 0;
	walk(root, []).forEach((file) => {
		const lines = fs.readFileSync(file, 'utf8').split('\n');
		const byField = {};
		lines.forEach((line, i) => {
			const re = /const\s+__seq\s*=\s*\(this\.([A-Za-z_$][\w$]*)\s*=\s*\(this\.\1\s*\|\|\s*0\)\s*\+\s*1\)/g;
			let m;
			while ((m = re.exec(line))) {
				seen += 1;
				(byField[m[1]] = byField[m[1]] || new Set()).add(methodOf(lines, i));
			}
		});
		Object.keys(byField).forEach((f) => {
			if (byField[f].size > 1) { offenders.push(`${path.relative(root, file)} · ${f} ← ${[...byField[f]].join(' / ')}`); }
		});
	});
	expect(seen).toBeGreaterThanOrEqual(11);   // 解析器自检:玄学史一族至少 11 处
	expect(offenders).toEqual([]);
});
