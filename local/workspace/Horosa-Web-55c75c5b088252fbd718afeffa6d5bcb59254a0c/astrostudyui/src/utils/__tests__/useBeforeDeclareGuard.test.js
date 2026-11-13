// 全仓:同一函数里 const / let 先用后声明 —— 打包转译成 var 后是 undefined(「xx is not a function」),jest 里是 TDZ 报错。
// 引用所在的嵌套函数只有「当场执行」(数组同步迭代回调 / 立即调用)才算在声明前运行;事件回调、异步回调等晚调用不算。
// 咬过一次:印占快照的三旗盘段用了函数后部才声明的星座短名助手,一开三旗盘整份印占快照抛错(页面导出 / 挂载 / 存案全空)。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
const SKIP_DIRS = new Set(['node_modules', '.umi', '.umi-production', '.umi-test', '__tests__']);
const SYNC = new Set(['forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex', 'sort', 'flatMap', 'replace', 'from']);

function listFiles(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(!SKIP_DIRS.has(f)){ listFiles(p, out); } }
		else if(/\.jsx?$/.test(f)){ out.push(p); }
	});
	return out;
}

function scan(file, code){
	const hits = [];
	const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom'] });
	traverse(ast, {
		enter(p){
			if(!p.scope || p.scope.block !== p.node){ return; }
			Object.keys(p.scope.bindings).forEach((name)=>{
				const b = p.scope.bindings[name];
				if(b.kind !== 'const' && b.kind !== 'let'){ return; }
				const declStart = b.path.node.start;
				const decl = b.path.parentPath;
				const stmt = decl && decl.parentPath && decl.parentPath.isExportNamedDeclaration() ? decl.parentPath : decl;
				const declFn = b.path.getFunctionParent();
				b.referencePaths.forEach((r)=>{
					if(r.node.start >= declStart || (stmt && r.node.start >= stmt.node.start)){ return; }
					if(r.parentPath && r.parentPath.isExportSpecifier()){ return; }
					let f = r.getFunctionParent();
					while(f && f.node !== (declFn && declFn.node)){
						const par = f.parentPath;
						const isArg = par && par.isCallExpression() && par.node.arguments.includes(f.node);
						const callee = isArg ? par.node.callee : null;
						const syncCb = !!(callee && callee.type === 'MemberExpression' && callee.property && SYNC.has(callee.property.name));
						const iife = par && par.isCallExpression() && par.node.callee === f.node;
						if(!syncCb && !iife){ return; }
						f = f.getFunctionParent();
					}
					hits.push(`${path.relative(SRC, file)}:${r.node.loc.start.line} ${name}(声明在第 ${b.path.node.loc.start.line} 行)`);
				});
			});
		},
	});
	return hits;
}

describe('同一函数里 const / let 不许先用后声明', ()=>{
	it('判别力:能抓住「同步回调里先用、函数后部才声明」', ()=>{
		const bad = "function f(xs){ const out = []; xs.forEach((x)=>{ out.push(short(x)); }); const short = (s)=>s; return out; }";
		const lateOk = "function g(btn){ btn.onclick = ()=>helper(); const helper = ()=>1; }";
		expect(scan('bad.js', bad).length).toBe(1);
		expect(scan('late.js', lateOk)).toEqual([]);
	});
	it('全仓零命中', ()=>{
		const hits = [];
		listFiles(SRC, []).forEach((file)=>{ hits.push(...scan(file, fs.readFileSync(file, 'utf8'))); });
		expect(hits).toEqual([]);
	});
});
