#!/usr/bin/env node
/*
 * check-chunk-dup.js —— chunk 近重复哨兵(WS-N1)。
 *
 * 病理(2026-07-16 定谳):splitChunks maxAsyncRequests 顶格时,webpack 对「已存在的共享
 * chunk 文件」引用不了,把内容【回灌】进各页面根 —— AI分析等页面根曾各揣一份
 * 同批模块(94 共有/重复 2.48MB),dist 白胖 ~3.5MB 且毫无报错。本哨兵在每次 build 后机械核:
 *   ① 任何两个 async chunk 的【共有模块 key】> 阈值(30) = 回灌复发,红;
 *   ② 任何入口的 Promise.all 请求数 == maxAsyncRequests 上限 = 再次顶格预警,红;
 * 用法: node scripts/check-chunk-dup.js [dist|dist-file]
 * 退出码: 0=绿;1=红(哨兵拦截)。
 */
const fs = require('fs');
const path = require('path');

const distName = process.argv[2] || 'dist';
const DIST = path.join(__dirname, '..', distName);
const MAX_SHARED_MODULES = 30;
// 与 .umirc.js 的 maxAsyncRequests 同步(env 覆写一致;2026-07-19 40→56 时此处曾漏改,
// 42<56 被拿去比旧 40 假红拦构建 —— 两处默认值必须 lockstep 同改)
const MAX_ASYNC_REQUESTS = Number(process.env.HOROSA_SPLIT_MAXREQ || 56);

if (!fs.existsSync(DIST)) {
	console.error(`check-chunk-dup: 产物目录不存在 ${DIST}`);
	process.exit(1);
}

const asyncFiles = fs.readdirSync(DIST).filter((f) => f.endsWith('.async.js'));
// webpack 模块表:  "key":function( 或 key:function( —— 两种压缩形都抓
const MODULE_RE = /["']?([A-Za-z0-9+/=_$-]{4,10})["']?:\s*function\s*\(/g;

function moduleKeys(file) {
	const src = fs.readFileSync(path.join(DIST, file), 'utf8');
	const keys = new Set();
	let m;
	MODULE_RE.lastIndex = 0;
	while ((m = MODULE_RE.exec(src)) !== null) {
		keys.add(m[1]);
	}
	return keys;
}

let bad = 0;

// ① 两两共有模块数(只对 >200KB 的大 chunk 做两两比对,小 chunk 的共享由 splitChunks 正常产生)
const bigFiles = asyncFiles.filter((f) => fs.statSync(path.join(DIST, f)).size > 200 * 1024);
const keysByFile = new Map(bigFiles.map((f) => [f, moduleKeys(f)]));
for (let i = 0; i < bigFiles.length; i += 1) {
	for (let j = i + 1; j < bigFiles.length; j += 1) {
		const a = keysByFile.get(bigFiles[i]);
		const b = keysByFile.get(bigFiles[j]);
		let shared = 0;
		for (const k of a) {
			if (b.has(k)) shared += 1;
		}
		if (shared > MAX_SHARED_MODULES) {
			console.error(`🔴 [check-chunk-dup] ${bigFiles[i]} 与 ${bigFiles[j]} 共有 ${shared} 个模块(>阈值 ${MAX_SHARED_MODULES})—— 回灌复发`);
			bad = 1;
		}
	}
}

// ② Promise.all 顶格预警(在所有 js 里找最长的 chunk 请求组)
let maxGroup = 0;
let maxGroupFile = '';
for (const f of fs.readdirSync(DIST).filter((x) => x.endsWith('.js'))) {
	const src = fs.readFileSync(path.join(DIST, f), 'utf8');
	const groups = src.match(/Promise\.all\(\[[^\]]*\]\)/g) || [];
	for (const g of groups) {
		const n = (g.match(/e\(/g) || []).length;
		if (n > maxGroup) {
			maxGroup = n;
			maxGroupFile = f;
		}
	}
}
if (maxGroup >= MAX_ASYNC_REQUESTS) {
	console.error(`🔴 [check-chunk-dup] ${maxGroupFile} 的 chunk 请求组达 ${maxGroup} == maxAsyncRequests(${MAX_ASYNC_REQUESTS})—— 再次顶格,回灌在即;调大上限或拆依赖`);
	bad = 1;
}

// ③ 重引擎不得与页面同 chunk(2026-08-01「进入星运台卡死」制度化,锁 C·产物层)
//    源码层的主锁在 src/utils/__tests__/heavyEngineImportGraph.test.js(AST 图遍历);
//    这里是产物层的复核 —— 万一 webpack 分包策略变了、或有人绕过 import 走别的引入方式,
//    只要引擎最终跟页面躺进同一个 chunk,这条就红。
//    判据用**强标记**:three 认 WebGLRenderer、echarts 认 zrender/ECharts。
//    ⚠ 绝不裸 grep `BABYLON` —— 巴比伦占星的 BABYLON_SCHEMES 会误报(实证踩过);
//      且 babylonjs 走 <script> 注入不进 webpack 图,产物层判据对它本就无效。
const ENGINE_MARKS = [
	{ name: 'three', re: /WebGLRenderer/ },
	{ name: 'echarts', re: /\bzrender\b|\bECharts\b/ },
];
// 页面标记:Suspense 兜底文案 / 页面级特征串都可能被 minify 改写,故认「懒边界 + 页面组件名」
// 这种编译后仍稳定的形态。中文在产物里会被转成 \uXXXX,故一律用 ASCII 标记。
const PAGE_MARKS = [/LazyBoundary/, /lazyPreloadable/];
let FIRST_PAINT_BATCH = '';
let ROOT_ROUTE_STEMS = null;   // R4-P1d:④ 解析出的首屏批次 stem 表,供 ⑤ preload 对拍复用
for (const f of fs.readdirSync(DIST).filter((x) => x.endsWith('.async.js'))) {
	const src = fs.readFileSync(path.join(DIST, f), 'utf8');
	const hitEngine = ENGINE_MARKS.find((m) => m.re.test(src));
	if (!hitEngine) { continue; }
	const isVendorChunk = /^vendors[-~]/.test(f);        // 引擎独占的 vendors chunk 本就该含它
	const hasPage = PAGE_MARKS.some((re) => re.test(src));
	if (!isVendorChunk && hasPage) {
		console.error(`🔴 [check-chunk-dup] ${f} 同时含 ${hitEngine.name} 引擎与页面懒边界 —— 引擎被拖进页面 chunk,进该页即须解析整个引擎;把重组件改 makeLazyBoundary(见 utils/lazyBoundary.js)`);
		bad = 1;
	}
}

// ④ 首屏批次不得含重引擎(2026-08-01 打包前实测抓出,③ 抓不到的**隐形通道**)
//    ③ 只查「引擎与页面同 chunk」。但引擎还能这样偷渡到首屏:它跟一个**基础设施库**
//    共处同一个 vendors chunk,而基础设施是首屏必需的 —— 于是首屏把整包一起拉走,
//    引擎虽然规规矩矩待在 vendors 里(③ 全绿),用户照样得为它买单。
//    实锤:原 cacheGroup 把 echarts 与 d3 编在一组(vendors-viz 1228KB)。d3 是星盘 SVG
//    绘制的基础设施(全仓 101 个文件在用)、首屏同步图里就要它 → echarts 被捎带着在首屏
//    下载,玄学史页改懒加载等于白做。拆成 vendors-d3(129KB,首屏)+ vendors-echarts
//    (1132KB,只随玄史两个子页)后首屏净省 1.1MB。
//    判据故意**不看 chunk 名、不看 cacheGroup 配置**,只认「首屏那一批文件里有没有引擎标记」——
//    谁把配置改回去、或换个名字重犯,这条照样红。
{
	const umi = fs.readdirSync(DIST).find((f) => /^umi\..*\.js$/.test(f));
	if (!umi) {
		console.error('🔴 [check-chunk-dup] 找不到 umi 运行时 chunk —— 首屏批次判据无法执行(拒绝虚绿)');
		bad = 1;
	} else {
		const rt = fs.readFileSync(path.join(DIST, umi), 'utf8');
		// webpack jsonpScriptSrc:return p+""+({id:"name",…}[id]||id)+"."+{id:"hash",…}[id]+".async.js"
		const srcFn = rt.match(/return\s+\w+\.p\+""\+\(\{(.*?)\}\[/s);
		const rootRoute = rt.match(/path:"\/",exact:!0,component:.*?loader:\(\)=>(?:Promise\.all\(\[([^\]]*?)\]\)|(\w+\.e\(\d+\)))/s);
		if (!srcFn || !rootRoute) {
			console.error('🔴 [check-chunk-dup] 解析 umi 运行时失败(chunk 名表或首屏路由取不到)—— 判据失效即红,不许静默放行');
			bad = 1;
		} else {
			const names = new Map();
			for (const m of srcFn[1].matchAll(/(\d+):"([\w~.\-]+)"/g)) { names.set(m[1], m[2]); }
			const ids = [...(rootRoute[1] || rootRoute[2] || '').matchAll(/\.e\((\d+)\)/g)].map((m) => m[1]);
			if (!ids.length) {
				console.error('🔴 [check-chunk-dup] 首屏路由批次为空 —— 正则错配,判据形同虚设');
				bad = 1;
			}
			const all = fs.readdirSync(DIST).filter((x) => x.endsWith('.async.js'));
			for (const id of ids) {
				const stem = names.get(id) || id;
				const file = all.find((x) => x.startsWith(stem + '.'));
				if (!file) { continue; }                       // 名表里有但文件没产出:不是本判据的事
				const src = fs.readFileSync(path.join(DIST, file), 'utf8');
				const hit = ENGINE_MARKS.find((m) => m.re.test(src));
				if (hit) {
					console.error(`🔴 [check-chunk-dup] 首屏(路由 "/")同批加载的 ${file} 含 ${hit.name} 引擎 —— 每个用户一进软件就要下载并解析它。若它是与基础设施库(如 d3)编在同一个 cacheGroup,请按用途宽窄拆组(见 .umirc.js 的 vendorsD3 / vendorsChart)`);
					bad = 1;
				}
			}
			if (!bad) { FIRST_PAINT_BATCH = ids.map((i) => names.get(i) || i).join(', '); }
			ROOT_ROUTE_STEMS = ids.map((i) => names.get(i) || i);
		}
	}
}

// ⑤ preload 清单 ↔ 首屏批次自动对拍(R4-P1d)。
//    病根:inject-preload 的 CRITICAL_PREFIXES 是手抄清单,首屏批次却由 splitChunks 实际
//    产出决定 —— 两者曾漂移(shared-technique 2.6MB 在批次里却不在 preload 里,最大件
//    照旧等 umi.js 执行后才被发现)。本段复用 ④ 解析的 root-route 批次做双向差:
//      · 批次文件 ∉ preload → 漏注(串行瀑布回潮)红;
//      · preload 文件 ∉ 批次∪layouts家族 → 游离预取(preload 漂移成无谓下载)红。
//    layouts__index/vendors~layouts__index 家族由 layout 包装路由载入,不在 root-route
//    批次里但确属首屏关键路径 —— 白名单豁免。HOROSA_NO_HTML_PRELOAD=1(kill-switch,
//    与注入器同 env)时整段跳过。
{
	if (process.env.HOROSA_NO_HTML_PRELOAD === '1') {
		console.log('· [check-chunk-dup ⑤] HOROSA_NO_HTML_PRELOAD=1,preload 对拍跳过(kill-switch)');
	} else if (!ROOT_ROUTE_STEMS) {
		console.error('🔴 [check-chunk-dup ⑤] 首屏批次不可得(④ 解析失败)—— preload 对拍无法执行(拒绝虚绿)');
		bad = 1;
	} else {
		const htmlPath = path.join(DIST, 'index.html');
		if (!fs.existsSync(htmlPath)) {
			console.error('🔴 [check-chunk-dup ⑤] index.html 缺失 —— preload 对拍无法执行');
			bad = 1;
		} else {
			const html = fs.readFileSync(htmlPath, 'utf8');
			const block = html.match(/<!-- horosa-preload -->([\s\S]*?)<!-- \/horosa-preload -->/);
			const preloadFiles = new Set();
			if (block) {
				for (const m of block[1].matchAll(/href="[^"]*?([^"/]+\.(?:async\.js|chunk\.css))"/g)) {
					preloadFiles.add(m[1]);
				}
			}
			if (!preloadFiles.size) {
				console.error('🔴 [check-chunk-dup ⑤] preload 块缺失或为空 —— inject-preload 未跑或被剥(构建链顺序被改?)');
				bad = 1;
			} else {
				const all = fs.readdirSync(DIST);
				const LAYOUT_FAMILY = /^(layouts__index|vendors~layouts__index)\./;
				// 批次每个 stem 的 js(+存在的 css)都必须在 preload 里
				const required = [];
				for (const stem of ROOT_ROUTE_STEMS) {
					const js = all.find((x) => x.startsWith(stem + '.') && x.endsWith('.async.js'));
					const css = all.find((x) => x.startsWith(stem + '.') && x.endsWith('.chunk.css'));
					if (js) { required.push(js); }
					if (css) { required.push(css); }
				}
				for (const f of required) {
					if (!preloadFiles.has(f)) {
						console.error(`🔴 [check-chunk-dup ⑤] 首屏批次文件「${f}」不在 preload 清单 —— 串行瀑布回潮;把其 stem 加进 inject-preload.js 的 CRITICAL_PREFIXES`);
						bad = 1;
					}
				}
				for (const f of preloadFiles) {
					const stem = f.replace(/\.[0-9a-f]+\.(async\.js|chunk\.css)$/, '');
					if (!ROOT_ROUTE_STEMS.includes(stem) && !LAYOUT_FAMILY.test(f)) {
						console.error(`🔴 [check-chunk-dup ⑤] preload 清单里的「${f}」既不在首屏批次也非 layouts 家族 —— 游离预取(每个用户白下载);从 CRITICAL_PREFIXES 移除或核对分包形态`);
						bad = 1;
					}
				}
				if (!bad) {
					console.log(`· [check-chunk-dup ⑤] preload↔首屏批次对拍恒等(${preloadFiles.size} 件,批次 ${ROOT_ROUTE_STEMS.length} stem+layouts 家族)`);
				}
			}
		}
	}
}

if (!bad) {
	console.log(`✓ check-chunk-dup 绿:${bigFiles.length} 个大 async chunk 两两共有模块 ≤${MAX_SHARED_MODULES};最大请求组 ${maxGroup}/${MAX_ASYNC_REQUESTS}(${maxGroupFile});重引擎未与页面同 chunk;首屏批次[${FIRST_PAINT_BATCH}]无引擎`);
}
process.exit(bad);
