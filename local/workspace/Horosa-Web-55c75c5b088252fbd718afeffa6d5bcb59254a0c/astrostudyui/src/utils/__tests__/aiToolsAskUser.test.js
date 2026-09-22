// AI 助手·ask_user 工具合同:只读/interactive;无 elicit 通道 → E_ELICIT_UNAVAILABLE;答案/超时/拒绝三态;经注册表跑通。
import def from '../aiTools/tools/askUser';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { requestElicitation, resolveElicitation, listPendingElicitations, __resetElicitationsForTests } from '../aiAgent/elicitations';

beforeEach(()=>{ __resetToolsForTests(); __resetElicitationsForTests(); window.localStorage.clear(); });

describe('ask_user', ()=>{
	it('目录形状:read/interactive/none;schema 顶层封闭;question 必填', ()=>{
		expect(def.name).toBe('ask_user');
		expect(def.level).toBe('read');
		expect(def.category).toBe('interactive');
		expect(def.undoKind).toBe('none');
		expect(def.inputSchema.additionalProperties).toBe(false);
		expect(def.inputSchema.required).toEqual(['question']);
	});
	it('无 ctx.elicit → E_ELICIT_UNAVAILABLE;elicit 抛错 → E_ELICIT_UNAVAILABLE;choice 无 options → E_ARGS_INVALID', async ()=>{
		expect((await def.run({ question: 'q' }, { origin: 'in-app' })).code).toBe('E_ELICIT_UNAVAILABLE');
		expect((await def.run({ question: 'q' }, { elicit: async ()=>{ throw new Error('x'); } })).code).toBe('E_ELICIT_UNAVAILABLE');
		expect((await def.run({ question: 'q', inputType: 'choice' }, { elicit: async ()=>({ answer: 'a' }) })).code).toBe('E_ARGS_INVALID');
	});
	it('三态:作答 → data.answer/answeredBy=user;超时 → E_ELICIT_TIMEOUT;拒绝 → E_ELICIT_DECLINED(aborted 文案不同)', async ()=>{
		const ok = await def.run({ question: '时辰?', placeholder: 'HH:MM', timeoutSec: 60 }, { elicit: async (q)=>{ expect(q).toEqual(expect.objectContaining({ question: '时辰?', inputType: 'text', placeholder: 'HH:MM', timeoutMs: 60000 })); return { answer: '08:00' }; } });
		expect(ok.ok).toBe(true);
		expect(ok.data).toEqual(expect.objectContaining({ answer: '08:00', answeredBy: 'user' }));
		expect(ok.summary).toContain('08:00');
		expect((await def.run({ question: 'q' }, { elicit: async ()=>({ timeout: true }) })).code).toBe('E_ELICIT_TIMEOUT');
		expect((await def.run({ question: 'q' }, { elicit: async ()=>null })).code).toBe('E_ELICIT_TIMEOUT');
		const d = await def.run({ question: 'q' }, { elicit: async ()=>({ declined: true }) });
		expect(d.code).toBe('E_ELICIT_DECLINED');
		const a = await def.run({ question: 'q' }, { elicit: async ()=>({ declined: true, aborted: true }) });
		expect(a.code).toBe('E_ELICIT_DECLINED');
		expect(a.message).not.toBe(d.message);
	});
	it('choice/confirm:confirm 自动给「是/否」;choice 命中 options 时 data.choice 回填;答案截 2000', async ()=>{
		let seen = null;
		const c = await def.run({ question: '确认?', inputType: 'confirm' }, { elicit: async (q)=>{ seen = q; return { answer: '是' }; } });
		expect(seen.options).toEqual(['是', '否']);
		expect(c.data.choice).toBe('是');
		const ch = await def.run({ question: '口径?', inputType: 'choice', options: ['A', 'B'] }, { elicit: async ()=>({ answer: 'B' }) });
		expect(ch.data.choice).toBe('B');
		const long = await def.run({ question: 'q' }, { elicit: async ()=>({ answer: 'x'.repeat(3000) }) });
		expect(long.data.answer.length).toBe(2000);
	});
	it('经注册表 runTool 跑通:ctx.elicit 接到等待台,resolveElicitation 解开 → ok;不带通道 → 信封含 E_ELICIT_UNAVAILABLE', async ()=>{
		registerBuiltinTools();
		const p = runTool('ask_user', { question: '时辰?' }, { origin: 'in-app', elicit: (q)=>requestElicitation('msg-x', { ...q, callId: 'call-1', name: 'ask_user' }) });
		await new Promise((r)=>setTimeout(r, 0));
		expect(listPendingElicitations('msg-x').map((e)=>e.callId)).toEqual(['call-1']);
		resolveElicitation('call-1', { answer: '08:00' });
		const r = await p;
		expect(r.ok).toBe(true);
		expect(r.data.answer).toBe('08:00');
		const no = await runTool('ask_user', { question: 'q' }, { origin: 'in-app' });
		expect(no.ok).toBe(false);
		expect(no.code).toBe('E_ELICIT_UNAVAILABLE');
	});
});
