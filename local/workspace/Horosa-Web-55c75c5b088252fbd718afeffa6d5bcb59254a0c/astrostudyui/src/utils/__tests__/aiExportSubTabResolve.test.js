// 「AI导出」按页签定位导出键:星运 / 辅盘 / 卜 · 其他三个带子页签的页,每个子页签都要解析到自己的导出键。
// 曾经的缺口:
//   · 星运「推运」页签 key 是 progressions,店内映射只登记了 prog → 回落主限法,推运页点导出拿到主限法正文;
//   · 卜 · 其他「小六壬」页签名含「六壬」→ 被页签名判定判成大六壬,小六壬页点导出拿到大六壬正文。
jest.mock('../storageutil', ()=>{
	const actual = jest.requireActual('../storageutil');
	return { ...actual, getStore: jest.fn() };
});

import { getStore } from '../storageutil';
import { resolveContextByAstroState, resolveActiveContext, withStoreContextFallback, resolveExportContextForPayload } from '../aiExport/contextResolve';
import { AI_EXPORT_TECHNIQUES } from '../aiExport/presets';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');
const tabKeys = (rel)=>[...fs.readFileSync(path.join(SRC, rel), 'utf8').matchAll(/<TabPane tab="([^"]+)" key="([a-zA-Z0-9_]+)"/g)].map((m)=>({ label: m[1], key: m[2] }));
const setTab = (top, sub)=>getStore.mockReturnValue({ astro: { currentTab: top, currentSubTab: sub } });
const KNOWN = new Set(AI_EXPORT_TECHNIQUES.map((t)=>t.key));

describe('AI导出 · 子页签 → 导出键', ()=>{
	const direction = tabKeys('components/direction/AstroDirectMain.js');
	const cnyibu = tabKeys('components/cnyibu/CnYiBuMain.js');
	const aux = tabKeys('components/auxchart/AuxChartMain.js').filter((t)=>!/^\d+$/.test(t.key));

	it('三张页签表都读得到', ()=>{
		expect(direction.length).toBeGreaterThanOrEqual(33);
		expect(cnyibu.length).toBeGreaterThanOrEqual(14);
		expect(aux.length).toBeGreaterThanOrEqual(14);
	});

	it('星运:除主限法 / 主限天球外,没有哪个子页签回落到主限法', ()=>{
		const fellBack = direction.filter((t)=>{
			setTab('direction', t.key);
			const ctx = resolveContextByAstroState();
			return ctx.key === 'primarydirect' && t.key !== 'primarydirect' && t.key !== 'primarydirsphere';
		}).map((t)=>t.key);
		expect(fellBack).toEqual([]);
		setTab('direction', 'progressions');
		expect(resolveContextByAstroState().key).toBe('prog');
	});

	it('辅盘:除量化盘外,没有哪个子页签回落到量化盘;卜 · 其他:每个子页签都有自己的键', ()=>{
		const auxFell = aux.filter((t)=>{ setTab('auxchart', t.key); return resolveContextByAstroState().key === 'germany' && t.key !== 'germanytech'; }).map((t)=>t.key);
		expect(auxFell).toEqual([]);
		const cnMissing = cnyibu.filter((t)=>{ setTab('cnyibu', t.key); const k = resolveContextByAstroState().key; return !k || k === 'cnyibu' || !KNOWN.has(k); }).map((t)=>t.key);
		expect(cnMissing).toEqual([]);
		setTab('cnyibu', 'xiaoliuren');
		expect(resolveContextByAstroState().key).toBe('xiaoliuren');
	});

	// 页面上的真实结构:主导航页签 + 页内子页签;按页签名判定那一路不能把一个子页签判给别的技法
	function mountTabs(topKey, topLabel, subs, activeSub){
		document.body.innerHTML = '';
		const main = document.createElement('div');
		main.id = 'mainContent';
		const mk = (cls, items, activeKey)=>{
			const tabs = document.createElement('div');
			tabs.className = `ant-tabs ${cls}`;
			const nav = document.createElement('div'); nav.className = 'ant-tabs-nav';
			const list = document.createElement('div'); list.className = 'ant-tabs-nav-list';
			items.forEach((it)=>{
				const tab = document.createElement('div');
				tab.className = `ant-tabs-tab${it.key === activeKey ? ' ant-tabs-tab-active' : ''}`;
				tab.setAttribute('data-node-key', it.key);
				tab.textContent = it.label;
				list.appendChild(tab);
			});
			nav.appendChild(list); tabs.appendChild(nav);
			const holder = document.createElement('div'); holder.className = 'ant-tabs-content-holder';
			const content = document.createElement('div'); content.className = 'ant-tabs-content';
			const pane = document.createElement('div'); pane.className = 'ant-tabs-tabpane ant-tabs-tabpane-active';
			content.appendChild(pane); holder.appendChild(content); tabs.appendChild(holder);
			return { tabs, pane };
		};
		const top = mk('mainRootTabs', [{ key: topKey, label: topLabel }], topKey);
		const sub = mk('', subs, activeSub);
		top.pane.appendChild(sub.tabs);
		main.appendChild(top.tabs);
		document.body.appendChild(main);
	}
	const resolveAll = ()=>resolveExportContextForPayload(withStoreContextFallback(resolveActiveContext()));

	it('整条判定链(页签名 + 店内回落):卜 · 其他每个子页签落到自己的键,小六壬不是大六壬', ()=>{
		const wrong = [];
		cnyibu.forEach((t)=>{
			mountTabs('cnyibu', '其他', cnyibu, t.key);
			setTab('cnyibu', t.key);
			setTab('cnyibu', t.key);
			const got = resolveAll().key;
			setTab('cnyibu', t.key);
			const want = resolveContextByAstroState().key;
			if(got !== want){ wrong.push(`${t.key}:${got}≠${want}`); }
		});
		expect(wrong).toEqual([]);
		mountTabs('cnyibu', '其他', cnyibu, 'xiaoliuren');
		setTab('cnyibu', 'xiaoliuren');
		expect(resolveAll().key).toBe('xiaoliuren');
	});

	it('整条判定链:星运每个子页签落到店内映射的同一个键,推运页是 prog', ()=>{
		const wrong = [];
		direction.forEach((t)=>{
			mountTabs('direction', '星运', direction, t.key);
			setTab('direction', t.key);
			const got = resolveAll().key;
			const want = resolveContextByAstroState().key;
			if(got !== want){ wrong.push(`${t.key}:${got}≠${want}`); }
		});
		expect(wrong).toEqual([]);
		mountTabs('direction', '星运', direction, 'progressions');
		setTab('direction', 'progressions');
		expect(resolveAll().key).toBe('prog');
	});

	// 辅助页三个速查子页(八卦类象 / 十二串宫 / 八字规则)都按辅助页处理;「八字规则」含「八字」二字,曾被判成八字盘
	it('整条判定链:辅助页三个子页签同为辅助页,八字规则不是八字', ()=>{
		const subs = tabKeys('components/cntradition/CnTraditionMain.js');
		expect(subs.map((t)=>t.key).sort()).toEqual(['cuangong12', 'guasym', 'pithy']);
		subs.forEach((t)=>{
			mountTabs('cntradition', '辅助', subs, t.key);
			setTab('cntradition', t.key);
			expect(resolveAll().key).toBe('cntradition');
		});
	});

	it('整条判定链:辅盘每个子页签落到店内映射的同一个键', ()=>{
		const wrong = [];
		aux.forEach((t)=>{
			mountTabs('auxchart', '辅盘', aux, t.key);
			setTab('auxchart', t.key);
			const got = resolveAll().key;
			const want = resolveContextByAstroState().key;
			if(got !== want){ wrong.push(`${t.key}:${got}≠${want}`); }
		});
		expect(wrong).toEqual([]);
	});
});
