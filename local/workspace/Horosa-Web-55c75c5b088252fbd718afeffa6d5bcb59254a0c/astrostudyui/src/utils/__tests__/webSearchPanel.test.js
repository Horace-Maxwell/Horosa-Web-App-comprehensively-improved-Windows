// [D8/W1] 联网检索面板·换引擎不得沿用旧引擎的 Key(先红)。合同/判别向量:
//   已配置 tavily(库里存着 tavily 的 Key)→ 用户在面板里把引擎改成 brave、密钥框留空 → 点「保存」。
//   判据:落库的那条档案里,brave 绝不能带着 tavily 的 Key(也不能顶着 tavily 的档案 id)。
//   现在红:WebSearchPanel.js:36-40 的 save() 用 `form.apiKey.trim() || profile.apiKey` 兜底、
//   `id: profile ? profile.id : undefined` 复用旧 id → 换了引擎却把上一家的密钥原样发给新一家
//   (计划批一 #4:抽纯函数 mergeSearchProfileForm,换引擎清 Key/baseUrl、id 随引擎)。
// 渲染范式照 aiChatPolicyPanel.test.js(react-dom + act);integrations/webSearch 的存取整层替身,零出站。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { setWebSearchEnabled } from '../aiAgent/prefs';
import WebSearchPanel from '../../components/aianalysis/WebSearchPanel';
import * as webSearch from '../../integrations/webSearch';

jest.mock('../../integrations/webSearch', ()=>{
	const actual = jest.requireActual('../../integrations/webSearch');
	return {
		__esModule: true,
		...actual,
		getActiveSearchProfile: jest.fn(async ()=>null),
		saveSearchProfile: jest.fn(async (p)=>p),
		removeSearchProfile: jest.fn(async ()=>true),
		runWebSearch: jest.fn(async ()=>({ ok: true, data: { engine: 'tavily', query: 'q', results: [] } })),
	};
});

const OLD_KEY = 'tvly-OLD-KEY-DO-NOT-LEAK';
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };

describe('W1 · 联网检索面板换引擎', ()=>{
	let host;
	beforeEach(()=>{
		window.localStorage.clear();
		webSearch.getActiveSearchProfile.mockReset();
		webSearch.saveSearchProfile.mockReset();
		webSearch.getActiveSearchProfile.mockImplementation(async ()=>({ id: 'websearch-tavily', kind: 'websearch', engine: 'tavily', baseUrl: '', apiKey: OLD_KEY, enabled: true, name: 'Tavily' }));
		webSearch.saveSearchProfile.mockImplementation(async (p)=>p);
		setWebSearchEnabled(true);
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

	it('🔴 W1 tavily → brave 且密钥留空:落库的 brave 档案不得带 tavily 的 Key / 旧档案 id', async ()=>{
		// 当前红:WebSearchPanel.js:40 的 save() 里
		//   apiKey: `${form.apiKey || ''}`.trim() || (profile ? profile.apiKey : '')
		//   id: profile ? profile.id : undefined
		// 密钥框留空时一律回退到「上一条档案」的 Key/id,而档案是**换引擎前**那一家的。
		await act(async ()=>{ ReactDOM.render(<WebSearchPanel />, host); });
		await flush();
		expect(host.querySelector('[data-web-search]')).toBeTruthy();
		// 面板已读到已配置的 tavily 档案
		expect(host.textContent).toContain('已配置');

		// 换引擎:antd Select → 点开选择器,选「Brave Search」
		const selector = host.querySelector('.ant-select-selector');
		expect(selector).toBeTruthy();
		await act(async ()=>{ selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
		await flush();
		const options = Array.from(document.querySelectorAll('.ant-select-item-option'));
		const brave = options.find((o)=>`${o.textContent}`.indexOf('Brave') >= 0);
		expect(brave).toBeTruthy();
		await act(async ()=>{ brave.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		await flush();

		// 密钥框留空,直接保存
		// antd 会在两个汉字之间插空格(autoInsertSpaceInButton),按文本找按钮要先去空白
		const save = Array.from(host.querySelectorAll('button')).find((b)=>`${b.textContent}`.replace(/\s+/g, '') === '保存');
		expect(save).toBeTruthy();
		await act(async ()=>{ save.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		await flush();

		const saved = webSearch.saveSearchProfile.mock.calls.map((c)=>c[0] || {});
		// 允许的形态有两种:要么根本不保存(提示补密钥),要么保存一条**不带旧 Key** 的 brave 档案。
		const leaked = saved.filter((a)=>`${a.apiKey || ''}` === OLD_KEY);
		expect(leaked).toEqual([]);
		saved.filter((a)=>a.engine === 'brave').forEach((a)=>{
			expect(`${a.apiKey || ''}`).toBe('');
			expect(a.id).not.toBe('websearch-tavily');
		});
	});
});
