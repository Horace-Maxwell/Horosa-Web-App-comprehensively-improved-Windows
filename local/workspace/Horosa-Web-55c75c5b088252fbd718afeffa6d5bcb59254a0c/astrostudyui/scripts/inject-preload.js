#!/usr/bin/env node
/*
 * inject-preload.js —— 首屏 chunk preload 注入(WS-N2)。
 *
 * 病理:umi 产物 index.html 只引 umi.css + umi.js(2MB);首屏三个路由 async chunk
 * (layouts__index / vendors~p__index / p__index,合 ~2.9MB js + ~0.85MB css)要等 umi.js
 * 下载+解析+执行后才被 webpack runtime「发现」→ 串行瀑布。文件名带 hash,umi 3 构建期
 * 模板(document.ejs)表达不了 → 唯一正确挂点 = 构建后按产物实名注入 <link rel=preload>,
 * 浏览器 preload scanner 解析 head 即并行开拉,首屏网络段趋近 max() 而非两段和。
 *
 * 形态:幂等标记块(重复构建先删旧块);注入后回读自校验,缺一即 exit 1(fail-loud 即哨兵)。
 * 桌面档(tauri://localhost, WKWebView)对自定义 scheme 的 preload 支持不保证 —— 失效时
 * preload 是惰性 link,零回归,保留不撤。
 * kill-switch: HOROSA_NO_HTML_PRELOAD=1 → 跳过注入(html 回零 preload 原态)。
 * 用法: node scripts/inject-preload.js [dist|dist-file](build/build:file 链自动调)
 */
const fs = require('fs');
const path = require('path');

const MARK_BEGIN = '<!-- horosa-preload -->';
const MARK_END = '<!-- /horosa-preload -->';
// 首屏关键路径 chunk(基名前缀):umi.js 已是 <script> 无需 preload;这四个是 umi.js 执行后
// 才被发现的首屏 async 家族(vendors~layouts__index 小但同属关键路径,有则带上)。
const CRITICAL_PREFIXES = ['layouts__index', 'vendors~layouts__index', 'vendors~p__index', 'p__index'];

function main(){
	const distName = process.argv[2] || (process.env.BUILD_FOR_FILE === '1' ? 'dist-file' : 'dist');
	const outDir = path.resolve(__dirname, '..', distName);
	const htmlPath = path.join(outDir, 'index.html');
	if(!fs.existsSync(htmlPath)){
		console.warn(`[inject-preload] index.html 不存在,跳过: ${htmlPath}`);
		return;
	}
	let html = fs.readFileSync(htmlPath, 'utf8');
	// 幂等:先剥掉旧标记块(hash 更名后旧 preload 残留 = 404 预取,必剥)
	const blockRe = new RegExp(`\\n?[\\t ]*${MARK_BEGIN}[\\s\\S]*?${MARK_END}`, 'g');
	html = html.replace(blockRe, '');

	if(process.env.HOROSA_NO_HTML_PRELOAD === '1'){
		fs.writeFileSync(htmlPath, html);
		console.log('[inject-preload] HOROSA_NO_HTML_PRELOAD=1,已确保零注入(kill-switch)');
		return;
	}

	// publicPath 取自既有 <script src> 前缀(web=/static/,desktop=./)——与 umi 产物自洽,不猜配置
	const srcMatch = html.match(/<script src="([^"]*?)umi\.[0-9a-f]+\.js"/);
	if(!srcMatch){
		console.error('[inject-preload] 解析不出 umi.js 的 publicPath —— 产物形态变了,判据失效比漏注更险');
		process.exit(1);
	}
	const publicPath = srcMatch[1];

	const files = fs.readdirSync(outDir);
	const links = [];
	for(const prefix of CRITICAL_PREFIXES){
		// 转义 ~(regex 字面),匹配 prefix.<hash>.async.js / prefix.<hash>.chunk.css
		const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const js = files.find((f)=>new RegExp(`^${esc}\\.[0-9a-f]+\\.async\\.js$`).test(f));
		const css = files.find((f)=>new RegExp(`^${esc}\\.[0-9a-f]+\\.chunk\\.css$`).test(f));
		if(js){
			links.push(`<link rel="preload" as="script" href="${publicPath}${js}">`);
		}
		if(css){
			links.push(`<link rel="preload" as="style" href="${publicPath}${css}">`);
		}
	}
	// 核心三件(layouts/vendors~p/p__index 的 js)必须齐 —— vendors~layouts 可有可无
	const mustHave = ['layouts__index', 'vendors~p__index', 'p__index'];
	for(const prefix of mustHave){
		if(!links.some((l)=>l.includes(`${publicPath}${prefix}.`))){
			console.error(`[inject-preload] 首屏关键 chunk「${prefix}」在产物中找不到 js —— 分包形态变了,先修 CRITICAL_PREFIXES 再构建`);
			process.exit(1);
		}
	}

	const block = `\t${MARK_BEGIN}\n\t${links.join('\n\t')}\n\t${MARK_END}\n`;
	if(!html.includes('</head>')){
		console.error('[inject-preload] html 缺 </head>,无处注入');
		process.exit(1);
	}
	html = html.replace('</head>', `${block}</head>`);
	fs.writeFileSync(htmlPath, html);

	// 回读自校验(fail-loud 哨兵):标记块在 + 每条 link 在
	const check = fs.readFileSync(htmlPath, 'utf8');
	if(!check.includes(MARK_BEGIN) || !links.every((l)=>check.includes(l))){
		console.error('[inject-preload] 回读校验失败 —— 注入不完整');
		process.exit(1);
	}
	console.log(`[inject-preload] ✓ 注入 ${links.length} 条 preload(${distName};publicPath=${publicPath})`);
}

main();
