// 重引擎静态 import 图护栏（主锁）—— 2026-08-01 用户实报「进入星运台卡死」后制度化。
//
// 病灶:页面组件**静态** import 了重可视化组件,webpack 遂把整个引擎变成该页 chunk 的
// **同步依赖**。用户只要进这个页,模块求值期就得先解析完整个引擎 —— 哪怕他从不打开那个
// 3D 子页签。实报那次:星运页静态引 AstroPDSphere → PDSphereEngine → three(vendors-gl
// 862KB + 引擎 90KB),而该页默认停在「主限法」表格、二十多个子页签里只有一个用得着 3D;
// 配置一般的机器上足以让主线程长时间无响应。同族当时共三处(星运/节气/玄史)。
//
// 为什么必须是「AST 图遍历」而不是「维护一份页面清单」:
//   清单永远追不上新增功能。本护栏从 pages/index.js 自动抽出全部 lazy 页面(当前 32 个),
//   对每个页面沿静态 import 边做图遍历、遇 import() 剪枝,断言图中不出现任何重引擎。
//   **以后任何人新写一个页面/组件,只要静态引了 three/echarts,这里当场红** —— 不需要
//   有人记得来更新清单,这才叫制度化。
//
// 判据边界(为什么剪枝在 import() 上):
//   `import('x')` 是动态边界,webpack 会为它另开 chunk —— 那正是我们想要的形态,故遍历到
//   动态调用即停。只有 ImportDeclaration(以及 re-export)才构成同步依赖,才继续往下走。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
const SRC = path.resolve(__dirname, '..', '..');

const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};

// —— 重引擎清单 ——
// 判据是「模块说明符」,不是产物大小。新引入一个**窄用途**重库时把它加进来即可。
//
// 🔴 清单的边界在「窄用途」而不是「体积大」—— 这条界线是本护栏初版踩出来的:
//    初版把 d3 也列进来,结果 25 个页面全红。查明后:d3 是**星盘 SVG 绘制的基础设施**
//    (AstroHelper 用 d3.arc() 画盘,全仓 101 个文件在用),几乎每个星盘页都要它,
//    同步依赖本就合理 —— 把它懒化只会给每张盘凭空加一次等待。
//    而 three(3D)与 echarts(图表)是另一回事:各自只服务少数几个子页签
//    (three 在 20+ 子页签里只 1 个用、echarts 全仓仅 3 个文件),让所有人为它们买单才是 bug。
//    所以判据是「这个库是否只有少数子页面用得着」,不是「这个库大不大」。
//
// 注:babylonjs 不在此列 —— 它走 public/vendor/babylon/babylon.js + <script> 注入 + window.BABYLON,
//    webpack 图里根本看不见它(见 PlanetariumMain 的 loadBabylonRuntime),故 import 图护栏对它无效。
const HEAVY_ENGINES = [
	/^three$/, /^three\//,
	/^echarts$/, /^echarts\//, /^zrender$/,
	/^@antv\//,
];

function isHeavy(spec){ return HEAVY_ENGINES.some((re) => re.test(spec)); }

// 只有这些「引擎宿主」允许把引擎放在自己的同步图里 —— 用户点进它们就是为了看那张图,
// 引擎与页面同 chunk 是合理的。每条必须写明理由(空理由即红,见下方测试)。
// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):
// `path.relative` 在 Windows 返回反斜杠分隔(`components\astro3d\AstroChartMain3D.js`),
// 而下面 ENGINE_HOSTS 的键是 POSIX 写法 ⇒ 键查不中 ⇒ **合法的引擎宿主豁免失效**,
// 3D 星盘页被误报成违规(macOS 上恒绿,只在 Windows 假红)。统一归一为 POSIX 再查。
// 仓内同类先例:chartFreeContract / quickDockContract 两个契约测试同 marker。
const relPosix = (from, to) => path.relative(from, to).split(path.sep).join('/');

const ENGINE_HOSTS = {
	'components/astro3d/AstroChartMain3D.js': '3D 星盘页本体——用户点进来就是为了看 3D,引擎与页面同 chunk 合理',
	'components/planetarium/PlanetariumMain.js': '天文馆本体;且其 babylon 走 <script> 注入不进 webpack 图',
};

function resolveModule(fromFile, spec){
	if(!spec.startsWith('.')){ return null; }               // 裸模块名:非本仓文件,不再深入
	const base = path.resolve(path.dirname(fromFile), spec);
	const cands = [base, base + '.js', base + '.jsx', path.join(base, 'index.js')];
	for(const c of cands){
		try{ if(fs.statSync(c).isFile()){ return c; } }catch(e){ /* 试下一个 */ }
	}
	return null;
}

/**
 * 从 entry 出发做静态 import 图遍历。
 * @returns {{hits: Array<{spec:string, chain:string[]}>}} 命中的重引擎及其引用链(便于定位)
 */
function walkStaticGraph(entry){
	const hits = [];
	const seen = new Set();
	const stack = [{ file: entry, chain: [relPosix(SRC, entry)] }];

	while(stack.length){
		const { file, chain } = stack.pop();
		if(seen.has(file)){ continue; }
		seen.add(file);

		// 🔴 这里**绝不能**因为「file 在 ENGINE_HOSTS 里」就剪枝 —— 那正是本护栏初版的虚绿:
		//    豁免的语义是「AstroChartMain3D 作为 lazy 页面**入口**时,自带引擎合理」,
		//    而不是「任何人静态 import 它都没事」。恰恰相反:别的页面静态引它,引擎就会进
		//    **那个页面**的 chunk —— 这正是节气页的原始 bug。入口级豁免在调用方做(见下方 offenders 循环),
		//    遍历过程中一律照常深入。反向验证实测:加了这行剪枝,把节气页改回静态 import 也照样全绿。
		let ast;
		try{ ast = parser.parse(fs.readFileSync(file, 'utf8'), PARSE_OPTS); }
		catch(e){ continue; }   // 解析不了的(非 JS 资产等)跳过,不误报

		traverse(ast, {
			// 只沿**静态** import 走;import() 是动态边界,天然剪枝(不在本 visitor 内)
			ImportDeclaration(p){
				const spec = p.node.source.value;
				if(isHeavy(spec)){ hits.push({ spec, chain: chain.concat(spec) }); return; }
				const next = resolveModule(file, spec);
				if(next){ stack.push({ file: next, chain: chain.concat(relPosix(SRC, next)) }); }
			},
			// re-export 同样构成同步依赖
			ExportNamedDeclaration(p){
				if(!p.node.source){ return; }
				const spec = p.node.source.value;
				if(isHeavy(spec)){ hits.push({ spec, chain: chain.concat(spec) }); return; }
				const next = resolveModule(file, spec);
				if(next){ stack.push({ file: next, chain: chain.concat(relPosix(SRC, next)) }); }
			},
			ExportAllDeclaration(p){
				const spec = p.node.source.value;
				if(isHeavy(spec)){ hits.push({ spec, chain: chain.concat(spec) }); return; }
				const next = resolveModule(file, spec);
				if(next){ stack.push({ file: next, chain: chain.concat(relPosix(SRC, next)) }); }
			},
		});
	}
	return { hits };
}

// 从 pages/index.js 抽全部 lazy 页面目标(复用 lazyTargetsSmoke 的现成正则)
function lazyPageTargets(){
	const src = fs.readFileSync(path.join(SRC, 'pages', 'index.js'), 'utf8');
	const re = /lazyPreloadable\(\s*\(\)\s*=>\s*import\(\s*['"](\.\.\/[^'"]+)['"]\s*\)/g;
	const out = [];
	let m;
	while((m = re.exec(src))){
		const f = resolveModule(path.join(SRC, 'pages', 'index.js'), m[1]);
		if(f){ out.push(f); }
	}
	return out;
}

describe('重引擎不得进入页面的静态 import 图', () => {
	const targets = lazyPageTargets();

	test('能从 pages/index.js 抽到全部 lazy 页面(抽不到=护栏空转)', () => {
		expect(targets.length).toBeGreaterThanOrEqual(20);
	});

	test('🔴 每个 lazy 页面的静态依赖图里不得出现重引擎', () => {
		const offenders = [];
		targets.forEach((entry) => {
			const rel = relPosix(SRC, entry);
			if(ENGINE_HOSTS[rel]){ return; }              // 引擎宿主豁免(理由见 ENGINE_HOSTS)
			const { hits } = walkStaticGraph(entry);
			if(hits.length){
				// 链路打出来,红了能直接看出是哪一跳把引擎拖进来的
				offenders.push(`${rel} ← ${hits[0].chain.slice(-3).join(' ← ')}`);
			}
		});
		expect(offenders).toEqual([]);
	});

	test('🔴 首屏面(pages/index.js 自身静态图)不得出现重引擎', () => {
		const { hits } = walkStaticGraph(path.join(SRC, 'pages', 'index.js'));
		expect(hits.map((h) => h.chain.slice(-2).join(' ← '))).toEqual([]);
	});

	test('豁免表每条都必须写明理由(空理由=偷偷放行)', () => {
		Object.keys(ENGINE_HOSTS).forEach((k) => {
			expect(String(ENGINE_HOSTS[k] || '').length).toBeGreaterThan(10);
			// 豁免的文件必须真实存在,防清单腐化成幽灵条目
			expect(fs.existsSync(path.join(SRC, k))).toBe(true);
		});
	});

	// 自证:护栏本身必须真的能抓到重引擎,否则上面全绿毫无意义(本仓三次虚绿的教训)
	test('🔴 自证:对一个确实静态引 three 的文件,遍历必须报命中', () => {
		const known = path.join(SRC, 'components', 'astro3d', 'PDSphereEngine.js');
		expect(fs.existsSync(known)).toBe(true);
		const { hits } = walkStaticGraph(known);
		expect(hits.length).toBeGreaterThan(0);
		expect(hits.some((h) => h.spec === 'three')).toBe(true);
	});

	test('🔴 自证:遍历必须在 import() 处剪枝(否则懒加载等于没做)', () => {
		// 星运页现在用 import() 引天球:若剪枝失效,这里会命中 three
		const direct = path.join(SRC, 'components', 'direction', 'AstroDirectMain.js');
		const { hits } = walkStaticGraph(direct);
		expect(hits).toEqual([]);
		// 且该文件确实存在动态 import(证明测的是「剪枝」而非「本来就没引」)
		expect(fs.readFileSync(direct, 'utf8')).toMatch(/import\(\s*\/\*\s*webpackChunkName/);
	});
});
