// 卜类目录(读源码的守卫共用,非 .test.js:测试公因子,照 helpers/ 惯例)。
// divinationDirs() —— 主导航「卜」组每个入口页所在目录 + 入口页懒加载的子技法页(…Main.js)所在目录,由 pages/index.js 机械导出;
//   新增卜类入口 / 子技法页自动进扫描面,不靠手写目录表。
// DIVINATION_ALSO_DIRS —— 择日宿主内嵌卜类整页,与卜类同等对待。
const fs = require('fs');
const path = require('path');
const { readSource, isSourceSetPart } = require('./sourceSet');

const SRC = path.resolve(__dirname, '../../..');
const COMPONENTS = path.join(SRC, 'components');
const DIVINATION_ALSO_DIRS = ['zeri'];

function divinationDirs(){
	const idxFile = path.join(SRC, 'pages', 'index.js');
	const idx = fs.readFileSync(idxFile, 'utf8');
	const keys = [...idx.matchAll(/\{\s*label:\s*'[^']*',\s*key:\s*'([a-z0-9]+)'[^}\n]*group:\s*'卜'/g)].map((m)=>m[1]);
	const DYN = /import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?'([^']+)'\s*\)/;
	const imports = {};
	for(const m of idx.matchAll(/^import\s+(\w+)\b[^;]*?from\s+'([^']+)'/gm)){ imports[m[1]] = m[2]; }
	for(const m of idx.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*\\w+\\(\\s*\\(\\)\\s*=>\\s*${DYN.source}`, 'g'))){ imports[m[1]] = m[2]; }
	const resolve = (from, spec)=>{
		const b = path.resolve(path.dirname(from), spec);
		return [b, `${b}.js`, path.join(b, 'index.js')].find((c)=>fs.existsSync(c) && fs.statSync(c).isFile()) || null;
	};
	const compDir = (f)=>path.relative(COMPONENTS, f).split(path.sep)[0];
	const dirs = new Set();
	keys.forEach((k)=>{
		const i = idx.indexOf(`key="${k}"`);
		const blk = i >= 0 ? idx.slice(i, idx.indexOf('</TabPane>', i)) : '';
		[...blk.matchAll(/<([A-Z]\w+)/g)].map((m)=>m[1]).filter((t)=>imports[t] && /Main$/.test(t)).forEach((t)=>{
			const f = resolve(idxFile, imports[t]);
			if(!f || !f.startsWith(COMPONENTS)){ return; }
			dirs.add(compDir(f));
			const txt = readSource(f);   // 门面按全集读(子模块里的懒加载同样算)
			for(const m of txt.matchAll(new RegExp(DYN.source, 'g'))){
				const g = resolve(f, m[1]);
				if(g && g.startsWith(COMPONENTS) && /Main\.js$/.test(g) && !isSourceSetPart(g)){ dirs.add(compDir(g)); }
			}
		});
	});
	return { keys, dirs: [...dirs].sort() };
}

module.exports = { divinationDirs, DIVINATION_ALSO_DIRS };
