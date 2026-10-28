// 新增 / 编辑事盘保存后,当前事盘取库里的完整记录(与命盘同口径):表单没交的顶层口径键不缺席。
import userModel from '../../models/user';
import '../../models/astro';
import { upsertLocalCase, getLocalCase } from '../localcases';

function runEffect(name, payload){
	const puts = [];
	const io = { select: (sel)=>({ __SELECT__: sel }), put: (a)=>{ puts.push(a); return { __PUT__: a }; }, call: ()=>({ __CALL__: true }) };
	const gen = userModel.effects[name].call(userModel, { payload }, io);
	for(let g = 0; g < 20; g += 1){ const st = gen.next(); if(st.done){ break; } }
	return puts;
}

describe('事盘保存后的当前事盘', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('编辑保存:记录顶层的日界 / 时间算法等口径键随当前事盘一起回来', ()=>{
		upsertLocalCase({ cid: 'case-ed', event: '旧事', caseType: 'liureng', divTime: '2024-03-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23' });
		const raw = JSON.parse(window.localStorage.getItem('horosa.localCases.v1') || 'null');
		expect(Array.isArray(raw)).toBe(true);
		raw[0] = { ...raw[0], after23NewDay: 0, timeAlg: 1 };
		window.localStorage.setItem('horosa.localCases.v1', JSON.stringify(raw));
		expect(getLocalCase('case-ed').timeAlg).toBe(1);
		const puts = runEffect('updateCase', { cid: 'case-ed', event: '新事', caseType: 'liureng', lat: '39n54', lon: '116e23' });
		const cur = puts.find((a)=>a.type === 'setCurrentCase');
		expect(cur.payload).toEqual(expect.objectContaining({ cid: 'case-ed', event: '新事', after23NewDay: 0, timeAlg: 1 }));
	});
});
