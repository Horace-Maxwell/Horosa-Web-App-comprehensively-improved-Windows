// [D70] 源码合同:组件层每一次落定审批台 / 反问台的调用都必须带消息键(第三参 = 本气泡 messageId 或条目自带的 *.messageKey);
//   trace 条目(x)没有 messageKey 字段,`x.messageKey` 在动作条里必须为 0 次(此前哨兵锚住这个不存在的字段名而假绿)。
//   同时锁 listPendingApprovals 条目带 level(任务中心「请求执行 / 请求写入」文案的依据)。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..');
const FILES = [
	path.join(SRC, 'components', 'aianalysis', 'AgentActionBar.js'),
	path.join(SRC, 'components', 'aianalysis', 'TaskCenterPanel.js'),
];
const FNS = { resolveApproval: 3, resolveApprovalsByName: 3, resolveElicitation: 3, declineElicitation: 2 };

// 取 fn( 之后到配对 ) 之间的实参文本,按顶层逗号切分
function callArgs(src, fnName){
	const out = [];
	let from = 0;
	for(;;){
		const at = src.indexOf(`${fnName}(`, from);
		if(at < 0){ break; }
		const before = src[at - 1] || ' ';
		from = at + fnName.length + 1;
		if(/[A-Za-z0-9_$.]/.test(before)){ continue; }   // import 列表 / 成员访问不算调用点
		let depth = 1; let i = from; let cur = ''; const args = [];
		for(; i < src.length && depth > 0; i++){
			const ch = src[i];
			if(ch === '(' || ch === '[' || ch === '{'){ depth += 1; }
			if(ch === ')' || ch === ']' || ch === '}'){ depth -= 1; if(depth === 0){ break; } }
			if(ch === ',' && depth === 1){ args.push(cur.trim()); cur = ''; continue; }
			cur += ch;
		}
		if(cur.trim()){ args.push(cur.trim()); }
		out.push({ at, args });
	}
	return out;
}
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

it('🔴 组件层每个落定调用都带消息键(messageId 或 *.messageKey);动作条零 x.messageKey', ()=>{
	const problems = [];
	FILES.forEach((f)=>{
		const src = strip(fs.readFileSync(f, 'utf8'));
		Object.keys(FNS).forEach((fn)=>{
			const sites = callArgs(src, fn);
			if(fn === 'resolveApproval' && f.indexOf('AgentActionBar') >= 0){ expect(sites.length).toBeGreaterThanOrEqual(2); }
			sites.forEach((s)=>{
				const keyArg = s.args[FNS[fn] - 1] || '';
				const ok = keyArg === 'messageId' || /\.messageKey$/.test(keyArg);
				if(!ok){ problems.push(`${path.basename(f)}: ${fn}(${s.args.join(', ')}) 第 ${FNS[fn]} 参 = ${JSON.stringify(keyArg)}`); }
			});
		});
	});
	expect(problems).toEqual([]);
	const bar = strip(fs.readFileSync(FILES[0], 'utf8'));
	expect((bar.match(/x\.messageKey/g) || []).length).toBe(0);
	expect((bar.match(/resolveApprovalsByName\(x\.name, true, messageId\)/g) || []).length).toBe(2);
});

it('listPendingApprovals 条目带 level;approvals / elicitations 条目键不重复', ()=>{
	const ap = fs.readFileSync(path.join(SRC, 'utils', 'aiAgent', 'approvals.js'), 'utf8');
	expect(ap).toContain('level: p.call.level');
	const dupKey = /\{[^}]*\bmessageKey:[^}]*\bmessageKey:[^}]*\}/;
	expect(dupKey.test(ap)).toBe(false);
	expect(dupKey.test(fs.readFileSync(path.join(SRC, 'utils', 'aiAgent', 'elicitations.js'), 'utf8'))).toBe(false);
});
