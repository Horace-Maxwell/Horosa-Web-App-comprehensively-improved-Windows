// 静态锁:刷新应答写槽与平时写槽同一份 meta(全站,不按技法集合、不按 meta 内容猜)。
// 病形:平时写槽带起课时地 / 页面口径 meta,刷新应答(导出 / 挂载 / 报告请页面按此刻所见重存)只传两个参数 ——
//   刷新一次之后槽的 meta 变成 {},报告「当前挂载的盘」的记录、对话挂载认命主都失了据。
// 规则:同一模块(写槽第一参)只要有一处平时写槽带第三参,刷新应答里的写槽也必须带,而且是同一个调用表达式
//   (源码逐字相同)或调同一个函数(各页抽 xxxSnapshotMeta / this.snapshotMeta 共用)。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '../../components');
function walk(d, out){
	fs.readdirSync(d).forEach((n)=>{
		const p = path.join(d, n);
		if(fs.statSync(p).isDirectory()){ if(n !== '__tests__'){ walk(p, out); } }
		else if(/\.js$/.test(n)){ out.push(p); }
	});
	return out;
}
const isSave = (c)=>{
	const n = c.type === 'Identifier' ? c.name : (c.property && c.property.name);
	return n === 'saveModuleAISnapshot' || n === 'saveModuleAISnapshotLazy';
};
const calleeName = (a)=>{
	if(!a || a.type !== 'CallExpression'){ return ''; }
	const c = a.callee;
	return c.type === 'Identifier' ? c.name : (c.property && c.property.name) || '';
};
const norm = (t)=>t.replace(/\s+/g, '');

function scan(){
	const offenders = [];
	let guarded = 0;
	walk(ROOT, []).forEach((f)=>{
		const src = fs.readFileSync(f, 'utf8');
		if(src.indexOf('saveModuleAISnapshot') < 0){ return; }
		const r = scanSource(src, path.relative(ROOT, f));
		offenders.push(...r.offenders);
		guarded += r.guarded;
	});
	return { offenders, guarded };
}
function scanSource(src, label){
	const offenders = [];
	let guarded = 0;
	{
		let ast;
		try{ ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'] }); }catch(e){ return { offenders, guarded }; }
		const saves = [];
		traverse(ast, { CallExpression(p){
			if(!isSave(p.node.callee)){ return; }
			const names = [];
			let fn = p.getFunctionParent();
			while(fn){
				const nd = fn.node;
				const nm = (nd.id && nd.id.name) || (nd.key && nd.key.name) || (fn.parentPath && fn.parentPath.node && fn.parentPath.node.key && fn.parentPath.node.key.name) || '';
				names.push(nm);
				fn = fn.parentPath && fn.parentPath.getFunctionParent();
			}
			const a0 = p.node.arguments[0];
			const mod = a0 ? norm(src.slice(a0.start, a0.end)) : '';
			saves.push({ node: p.node, mod, refresh: names.some((x)=>/^handleSnapshotRefreshRequest$|[Rr]efresh(Request)?$|^_?onSnap(shot)?Refresh/.test(x)) });
		} });
		// 按语义分组:第一参是字面量 / 固定表达式 = 按源码文本分组;第一参是变量(刷新应答按事件给的槽名写,如 moduleName)=
		//   槽名在运行时才定,能写到本文件任何一个槽 —— 归入「本文件全部带 meta 的平时写槽」那一组(此前按文本分组,动态槽名整组逃过)
		const isDynamic = (s)=>{ const a0 = s.node.arguments[0]; return !!a0 && a0.type === 'Identifier'; };
		const byMod = {};
		saves.forEach((s)=>{ if(!(s.refresh && isDynamic(s))){ (byMod[s.mod] = byMod[s.mod] || []).push(s); } });
		const dyn = saves.filter((s)=>s.refresh && isDynamic(s));
		if(dyn.length){ byMod['*dynamic*'] = saves.filter((s)=>!s.refresh).concat(dyn); }
		Object.keys(byMod).forEach((mod)=>{
			const list = byMod[mod];
			const normal = list.filter((s)=>!s.refresh && s.node.arguments.length >= 3);
			if(!normal.length){ return; }
			const texts = new Set(normal.map((s)=>norm(src.slice(s.node.arguments[2].start, s.node.arguments[2].end))));
			// 平时写槽的 meta 是变量(const meta = xxxSnapshotMeta(...))时,认它赋值的那个函数
			const viaVar = (a)=>{ if(!a || a.type !== 'Identifier'){ return ''; } const m = new RegExp(`\\b(?:const|let|var)\\s+${a.name}\\s*=\\s*([A-Za-z_$][\\w$.]*)\\(`).exec(src); return m ? m[1].split('.').pop() : ''; };
			const fns = new Set(normal.map((s)=>calleeName(s.node.arguments[2]) || viaVar(s.node.arguments[2])).filter(Boolean));
			list.filter((s)=>s.refresh).forEach((s)=>{
				guarded += 1;
				const a = s.node.arguments[2];
				const ok = !!a && (texts.has(norm(src.slice(a.start, a.end))) || (calleeName(a) && fns.has(calleeName(a))) || (a.type === 'Identifier' && [...fns].some((fn)=>new RegExp(`\\b${a.name}\\s*=\\s*${fn}\\(`).test(src))));   // 变量 = 同一个 meta 函数的结果
				if(!ok){ offenders.push(`${label || 'src'}:${s.node.loc.start.line} (${mod})`); }
			});
		});
	}
	return { offenders, guarded };
}

describe('刷新应答写槽与平时写槽同一份 meta(全站)', ()=>{
	test('🔴 判别力:刷新应答按事件给的槽名(变量)写、只传两个参数 → 判红(此前按第一参文本分组漏判)', ()=>{
		const src = `function save(config, pan){ const meta = kinMeta(config, pan); saveModuleAISnapshot(kinKey(config), 'x', kinMeta(config, pan)); }
class A { handleSnapshotRefreshRequest(evt){ const moduleName = evt.detail.module; if(moduleName !== 'a' && moduleName !== 'b'){ return; } saveModuleAISnapshot(moduleName, 'x'); } }`;
		expect(scanSource(src).offenders.length).toBe(1);
		expect(scanSource(src.replace("saveModuleAISnapshot(moduleName, 'x');", "saveModuleAISnapshot(moduleName, 'x', kinMeta(this.config, this.pan));")).offenders.length).toBe(0);
	});
	test('凡平时写槽带 meta 的模块,刷新应答里的写槽带同一份', ()=>{
		const { offenders, guarded } = scan();
		expect(guarded).toBeGreaterThanOrEqual(13);   // 卜类 3 页 + 推运 7 页 + 八字 / 紫微 / 七政 等都在锁内
		expect(offenders).toEqual([]);
	});
});
