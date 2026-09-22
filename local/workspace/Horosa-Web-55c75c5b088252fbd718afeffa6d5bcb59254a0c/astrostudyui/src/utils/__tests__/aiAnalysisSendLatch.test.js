// [D53] 发送门闩源码级棘轮(AIAnalysisMain 在 jsdom 渲染不了):闸后整段 try/finally,早退不复位的形态不得回潮。
//   此前「空问题 / 需先挂载 / 未选模型 / 缺 Key」四条早退把 sendingRef 留在 true ⇒ 之后每次发送在入口被吞(按钮看着可用却永不发)。
const fs = require('fs');
const path = require('path');
const MAIN = path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'AIAnalysisMain.js');
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '');

// [Q-008/M-08] 重答 / 重试 / 编辑分支三个入口也加了同形门闩 ⇒ 置位与复位各四处;
//   判据随之改为「每一处置位后的下一非空行都是 try{;每一处复位都紧跟 }finally{」——形状不变,个数不再钉死。
it('🔴 每处 sendingRef 置位后紧跟 try{;每处复位都在 }finally{ 之后;「= false; return;」零;首发入口的早退全在 try{ 之后 setSending(true) 之前', ()=>{
	const src = strip(fs.readFileSync(MAIN, 'utf8'));
	const lines = src.split('\n');
	const ups = lines.map((l, i)=>(l.indexOf('sendingRef.current = true;') >= 0 ? i : -1)).filter((i)=>i >= 0);
	expect(ups.length).toBeGreaterThanOrEqual(1);
	// 置位与 try{ 之间只许「设状态 / 建控制器」这类无早退的行 —— 真语义是「置位后到 try 之间不得 return」。
	ups.forEach((i)=>{
		const rest = lines.slice(i + 1);
		const tryAt = rest.findIndex((l)=>l.trim() === 'try{');
		expect(tryAt).toBeGreaterThanOrEqual(0);
		expect(tryAt).toBeLessThanOrEqual(4);
		rest.slice(0, tryAt).filter((l)=>l.trim()).forEach((l)=>{
			expect(l.indexOf('return')).toBe(-1);
		});
	});
	const downs = lines.map((l, i)=>(l.indexOf('sendingRef.current = false') >= 0 ? i : -1)).filter((i)=>i >= 0);
	expect(downs.length).toBe(ups.length);
	downs.forEach((i)=>{
		const pv = lines.slice(0, i).reverse().find((l)=>l.trim());
		expect(pv.trim()).toBe('}finally{');
	});
	expect(src).not.toContain('sendingRef.current = false; return;');
	// 早退:try{ 之后、setSending(true) 之前至少四个 return;(空问题 / 需先挂载 / 未选模型 / 缺 Key)
	const start = ups[0] + 2;
	const end = lines.findIndex((l, i)=>i > start && l.indexOf('setSending(true);') >= 0);
	expect(end).toBeGreaterThan(start);
	const returns = lines.slice(start, end).filter((l)=>l.trim() === 'return;').length;
	expect(returns).toBeGreaterThanOrEqual(4);
});
