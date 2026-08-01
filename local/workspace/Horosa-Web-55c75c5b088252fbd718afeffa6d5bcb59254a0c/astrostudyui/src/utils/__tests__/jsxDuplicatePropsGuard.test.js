// 全仓「同一 JSX 元素上重复传同名属性」护栏。
//
// 🔴 病理:JSX 里同名属性后者胜、前者被静默丢弃 —— 编译不报错、运行不抛异常,
//    只是某个属性凭空消失。本仓实测三处:
//    · 挂载设置面板的「纳入内容」段传了两个 className → 基础类
//      horosa-side-input-section 被丢掉,与同一面板里的「排盘参数」段外观不一致;
//    · CalendarMain 的 Tabs 传了两个 className → 右侧竖排轨样式 xq-tabs-rail 被丢掉;
//    · IndiaChart 对渲染件重复传 overlayPoints(同值,故无行为差,但属同类笔误)。
//
// eslint 有 react/jsx-no-duplicate-props 能管这个,但本项目的构建**不设 lint 闸**
// (见工程约定:构建不跑 ESLint,未用变量都不会失败),所以靠它拦不住 —— 用测试锁。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
const SRC_ROOT = path.join(__dirname, '..', '..');
const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};

function walk(dir, acc = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

/** 该文件里所有「同一开标签上重复出现的属性名」。展开运算符({...props})不参与判定。 */
function duplicateProps(filePath){
	let ast;
	try{ ast = parser.parse(fs.readFileSync(filePath, 'utf8'), PARSE_OPTS); }
	catch(e){ return []; }	// 解析不了的跳过(非本护栏职责)
	const out = [];
	traverse(ast, {
		JSXOpeningElement(p){
			const seen = new Map();
			(p.node.attributes || []).forEach((at)=>{
				if(at.type !== 'JSXAttribute' || !at.name || !at.name.name){ return; }
				const n = at.name.name;
				if(seen.has(n)){
					const tag = (p.node.name && (p.node.name.name || p.node.name.property?.name)) || '?';
					out.push(`${path.relative(SRC_ROOT, filePath)}:${at.loc.start.line} <${tag}> 重复属性 ${n}(首次在 ${seen.get(n)} 行)`);
				}else{
					seen.set(n, at.loc.start.line);
				}
			});
		},
	});
	return out;
}

describe('🔴 JSX 重复属性护栏(后者胜 → 前者被静默丢弃)', ()=>{
	const files = walk(SRC_ROOT);

	it('扫描面可信(src 下 jsx/js 文件数量级正常)', ()=>{
		expect(files.length).toBeGreaterThan(500);
	});

	it('全仓零「同一元素重复传同名属性」', ()=>{
		const bad = [];
		files.forEach((f)=>{ bad.push(...duplicateProps(f)); });
		expect(bad).toEqual([]);
	});

	it('检测器自证:能抓到重复、且不误判展开运算符与不同名属性', ()=>{
		const tmp = path.join(SRC_ROOT, 'utils', '__tests__', '_dupProbe.tmp.jsx');
		fs.writeFileSync(tmp, [
			'const A = ()=>(<div className="a" className="b" id="x" {...rest} {...more}>t</div>);',
			'const B = ()=>(<span className="ok" style={{}} id="y">t</span>);',
		].join('\n'), 'utf8');
		try{
			const hits = duplicateProps(tmp);
			expect(hits.length).toBe(1);					// 只有 className 那一处
			expect(hits[0]).toContain('重复属性 className');
			expect(hits.join()).not.toContain('id');		// 不同元素上的同名属性不算
		}finally{
			fs.unlinkSync(tmp);
		}
	});
});
