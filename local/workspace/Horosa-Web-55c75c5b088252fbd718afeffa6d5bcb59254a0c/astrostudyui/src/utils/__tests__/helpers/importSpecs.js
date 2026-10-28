// 「某文件从某处导入了某名 / 本文件自己又定义了一份」的判定(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 为什么要它:读源码的单源锁过去用整行正则写死一条 import 的原文(`import \{ a \} from '\.\/x'`),
// 同一条 import 里多导入一个名字、换个先后、换行排版,锁就红 —— 代码没错、锁误报;反过来名字写在注释里也能骗过正则。
// 这里改按 AST 读 import 声明:只认「来源 + 导入名 + 本地名」,与排版、同条里还有哪些名字无关。
//
// importBindings(源码[, { tolerant }]) —— [{ source, imported, local }];默认导入 imported='default',命名空间导入 imported='*'。
//   发布前自检的 pf_imports(preflight/lib.sh → preflight/import_specs.js)也用它。
// importsName(源码, { name, from, as }) —— 有没有一条 import 从 from 导入 name(as 给了就要求本地名 = as;不给 = 本地名同名)。
// definesLocal(源码, 名) —— 本文件有没有自己定义这个名字(函数声明 / 变量 / 类;import 进来的不算)。
// fileImportsName(文件绝对路径, { name, target, as }) —— 同 importsName,但来源按该文件所在目录解析成绝对路径再比
//   (target = 被导入模块的绝对路径,带不带 .js 都行);拆成子模块的门面按 sourceSetFiles 逐个文件问,引用路径层级不同也照认。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'optionalChaining',
		'nullishCoalescingOperator', 'objectRestSpread', 'exportDefaultFrom', 'decorators-legacy', 'numericSeparator',
		'logicalAssignment', 'topLevelAwait'],
};

// tolerant:解析出错也尽量读完(发布前自检读拼好的门面全集、判别力自证改过的副本用;测试里缺省严格)
function parseModule(src, { tolerant = false } = {}){
	return parser.parse(`${src}`, tolerant ? { ...PARSE_OPTS, errorRecovery: true } : PARSE_OPTS);
}

function importBindings(src, opts){
	const out = [];
	for(const node of parseModule(src, opts).program.body){
		if(node.type !== 'ImportDeclaration'){ continue; }
		const source = node.source.value;
		for(const sp of node.specifiers || []){
			if(sp.type === 'ImportDefaultSpecifier'){ out.push({ source, imported: 'default', local: sp.local.name }); }
			else if(sp.type === 'ImportNamespaceSpecifier'){ out.push({ source, imported: '*', local: sp.local.name }); }
			else{
				const imported = sp.imported.type === 'StringLiteral' ? sp.imported.value : sp.imported.name;
				out.push({ source, imported, local: sp.local.name });
			}
		}
	}
	return out;
}

function importsName(src, { name, from, as } = {}){
	const local = as || name;
	return importBindings(src).some((b)=>b.source === from && b.imported === name && b.local === local);
}

function definesLocal(src, name){
	let hit = false;
	const addPat = (node)=>{
		if(!node || hit){ return; }
		if(node.type === 'Identifier'){ if(node.name === name){ hit = true; } }
		else if(node.type === 'ObjectPattern'){ (node.properties || []).forEach((pr)=>addPat(pr.type === 'RestElement' ? pr.argument : pr.value)); }
		else if(node.type === 'ArrayPattern'){ (node.elements || []).forEach(addPat); }
		else if(node.type === 'AssignmentPattern'){ addPat(node.left); }
		else if(node.type === 'RestElement'){ addPat(node.argument); }
	};
	traverse(parseModule(src), {
		FunctionDeclaration(p){ if(p.node.id && p.node.id.name === name){ hit = true; } },
		ClassDeclaration(p){ if(p.node.id && p.node.id.name === name){ hit = true; } },
		VariableDeclarator(p){ addPat(p.node.id); },
	});
	return hit;
}

const noExt = (p)=>p.replace(/\.jsx?$/, '');

function fileImportsName(file, { name, target, as } = {}){
	const local = as || name;
	const dir = path.dirname(file);
	const want = noExt(path.resolve(target));
	return importBindings(fs.readFileSync(file, 'utf8')).some((b)=>(
		(b.source.startsWith('./') || b.source.startsWith('../'))
		&& noExt(path.resolve(dir, b.source)) === want && b.imported === name && b.local === local
	));
}

module.exports = { parseModule, importBindings, importsName, definesLocal, fileImportsName };
