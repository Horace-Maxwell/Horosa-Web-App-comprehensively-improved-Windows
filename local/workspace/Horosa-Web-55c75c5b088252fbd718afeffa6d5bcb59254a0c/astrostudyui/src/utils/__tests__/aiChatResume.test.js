// [批二⑪] resume 合同:缺省不记(uiPrefs 不多字段);开关开才写 lastConversationId;关=删两字段;近 5 排序去归档;pickResume 只认上次 id 且未归档;/resume 浮层打开不写键、拨开关才写。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { readResumePrefs, setResumeLast, rememberLastConversation, recentConversations, pickResumeConversation, RESUME_RECENT_MAX } from '../aiChat/resume';
import { loadUiPrefs, saveUiPrefs } from '../aiAnalysisStore';
import { BUILTIN_COMMANDS } from '../aiChat/commands';
import ChatAssistOverlays from '../../components/aianalysis/chat/ChatAssistOverlays';

beforeEach(()=>{ window.localStorage.clear(); });
const convs = [
	{ id: 'c1', title: '一', updatedAt: '2026-09-01T00:00:00Z' },
	{ id: 'c2', title: '二', updatedAt: '2026-09-05T00:00:00Z', archived: true },
	{ id: 'c3', title: '三', updatedAt: '2026-09-04T00:00:00Z' },
	{ id: 'c4', title: '四', createdAt: '2026-09-03T00:00:00Z' },
	{ id: 'c5', title: '五', updatedAt: '2026-09-02T00:00:00Z' },
	{ id: 'c6', title: '六', updatedAt: '2026-08-01T00:00:00Z' },
	{ id: 'c7', title: '七', updatedAt: '2026-09-06T00:00:00Z' },
];

it('缺省:不记、uiPrefs 零新字段;开关开才记;关=删两字段且不碰同级', ()=>{
	saveUiPrefs({ chatAssist: { statusBar: false } });
	expect(readResumePrefs()).toEqual({ resumeLast: false, lastConversationId: '' });
	expect(rememberLastConversation('c1')).toBe(false);
	expect(loadUiPrefs().chatAssist).toEqual({ statusBar: false });
	setResumeLast(true);
	expect(rememberLastConversation('c1')).toBe(true);
	expect(readResumePrefs()).toEqual({ resumeLast: true, lastConversationId: 'c1' });
	expect(rememberLastConversation('')).toBe(false);
	setResumeLast(false);
	expect(loadUiPrefs().chatAssist).toEqual({ statusBar: false });
	expect(BUILTIN_COMMANDS.find((c)=>c.name === 'resume').aliases).toEqual(['继续']);
});

it('近 5:按 updatedAt/createdAt 降序、去归档、封顶;pickResume 只认上次 id 且未归档', ()=>{
	expect(recentConversations(convs).map((c)=>c.id)).toEqual(['c7', 'c3', 'c4', 'c5', 'c1']);
	expect(recentConversations(convs).length).toBe(RESUME_RECENT_MAX);
	expect(recentConversations(convs, 2).map((c)=>c.id)).toEqual(['c7', 'c3']);
	expect(pickResumeConversation(convs, 'c3').id).toBe('c3');
	expect(pickResumeConversation(convs, 'c2')).toBe(null);   // 已归档
	expect(pickResumeConversation(convs, 'zz')).toBe(null);
	expect(pickResumeConversation(convs, '')).toBe(null);
	expect(pickResumeConversation(null, 'c1')).toBe(null);
});

describe('浮层', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
	it('打开列近 5 且不写键;点条目回调;拨开关回调', ()=>{
		const calls = [];
		act(()=>{ ReactDOM.render(<ChatAssistOverlays resume={{ open: true, items: recentConversations(convs), activeId: 'c3', pref: false, onOpen: (c)=>calls.push(`open:${c.id}`), onTogglePref: (v)=>calls.push(`pref:${v}`), onClose: ()=>calls.push('close') }} />, host); });
		const items = Array.from(document.querySelectorAll('[data-resume-item]'));
		expect(items.map((el)=>el.getAttribute('data-resume-item'))).toEqual(['c7', 'c3', 'c4', 'c5', 'c1']);
		expect(document.querySelector('[data-resume-item="c3"]').getAttribute('data-active')).toBe('1');
		expect(window.localStorage.getItem('horosa.ai.analysis.ui.v3')).toBe(null);
		act(()=>{ document.querySelector('[data-resume-item="c7"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		act(()=>{ document.querySelector('[data-resume-pref="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(calls).toEqual(['open:c7', 'pref:true']);
	});
});
