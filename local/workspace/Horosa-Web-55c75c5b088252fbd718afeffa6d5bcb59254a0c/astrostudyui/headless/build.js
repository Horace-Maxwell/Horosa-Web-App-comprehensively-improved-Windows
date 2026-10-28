#!/usr/bin/env node
// 无头运行时打包:esbuild 把 entry.js 连同它用到的前端工具层打成一个 Node 可直接 require 的单文件 dist/horosa-runtime.cjs。
// 与网页 / 桌面同一份源码,不另写;只在打包层做几处替身:
//   · umi / dva:只替 history 与 fetch(fetch 走 Node 自带的 fetch,不受浏览器跨域限制);
//   · three(3D 引擎,无头用不到)与样式表 / 图片:置空;
//   · 简繁词典(opencc-js)按文件路径直接解析到真文件(不替身);
//   · js-rsa:老式非严格脚本,源码当字符串嵌入、运行时用 new Function 执行(与 jest 垫片同法)。
// 用法:node headless/build.js [--quiet];产物与 build-info.json(源码最新改动时刻:前端 src + 打进去的无头侧文件)一起写进 headless/dist/。
'use strict';
const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'horosa-runtime.cjs');

function newestMtime(dir){
	let best = 0;
	const stack = [dir];
	while(stack.length){
		const d = stack.pop();
		let ents = [];
		try{ ents = fs.readdirSync(d, { withFileTypes: true }); }catch(e){ continue; }
		for(const e of ents){
			if(e.name === '__tests__' || e.name === '.umi' || e.name === '.umi-production' || e.name.startsWith('.')){ continue; }
			const p = path.join(d, e.name);
			if(e.isDirectory()){ stack.push(p); continue; }
			try{ const t = fs.statSync(p).mtimeMs; if(t > best){ best = t; } }catch(err){ /* 忽略 */ }
		}
	}
	return best;
}

// 打进运行时的无头侧文件(改了它们也要重打;前端 src 之外只有这几件)
const HEADLESS_BUNDLED = ['entry.js', 'aiProfiles.js', 'react-shim.js', 'build.js'];
function sourceNewest(){
	let best = newestMtime(path.join(UI, 'src'));
	for(const f of HEADLESS_BUNDLED){
		try{ const t = fs.statSync(path.join(__dirname, f)).mtimeMs; if(t > best){ best = t; } }catch(e){ /* 缺件:打包时自会报错 */ }
	}
	return best;
}

const shims = {
	name: 'horosa-headless-shims',
	setup(b){
		b.onResolve({ filter: /^three(\/.*)?$/ }, ()=>({ path: path.join(UI, 'test/threeJestStub.js') }));
		// 简繁转换器(检索词的简体归一 / 繁体写法:玄史 q_any、记录 / 名人库检索都靠它)照真打进来,不许替成空壳 ——
		// 空壳会让无头里 scriptQueryVariants / matchesUserQuery 全部空转(玄史搜「荧惑」漏掉库里两千多条「熒惑」原文)。
		// 前端源码按 dist/umd 文件路径引词典(webpack 4 / jest 不认 package exports);esbuild 认 exports、该路径未导出,
		// 所以这里把它直接解析到真文件(与网页 / 桌面同一份词典,体积约 +1 MB)。
		b.onResolve({ filter: /^opencc-js\/dist\/umd\/[a-z0-9]+\.js$/ }, (a)=>({ path: path.join(UI, 'node_modules', a.path) }));
		b.onResolve({ filter: /^js-rsa$/ }, ()=>({ path: 'js-rsa', namespace: 'horosa-jsrsa' }));
		b.onLoad({ filter: /.*/, namespace: 'horosa-jsrsa' }, ()=>{
			const src = fs.readFileSync(path.join(UI, 'node_modules/js-rsa/index.js'), 'utf8');
			return { contents: `const src = ${JSON.stringify(src)}; const m = { exports: {} }; new Function('exports', 'module', 'require', src)(m.exports, m, require); module.exports = m.exports;`, loader: 'js' };
		});
		b.onResolve({ filter: /^(umi|dva)$/ }, (a)=>({ path: a.path, namespace: 'horosa-shim' }));
		b.onLoad({ filter: /.*/, namespace: 'horosa-shim' }, (a)=>({
			contents: a.path === 'dva'
				? 'export const fetch = (...args)=>globalThis.fetch(...args); export default {};'
				: 'export const history = { push(){}, replace(){}, goBack(){}, location: { pathname: "/", search: "", hash: "" }, listen(){ return ()=>{}; } }; export const getDvaApp = ()=>null; export default {};',
			loader: 'js',
		}));
		b.onResolve({ filter: /\.(less|css|scss|sass)$/ }, (a)=>({ path: a.path, namespace: 'horosa-empty' }));
		b.onLoad({ filter: /.*/, namespace: 'horosa-empty' }, ()=>({ contents: 'export default new Proxy({}, { get: (t, k)=>String(k) });', loader: 'js' }));
		b.onResolve({ filter: /\.(png|jpe?g|gif|svg|webp|ico|bmp|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|glb|gltf|hdr|bin|wasm)$/i }, (a)=>({ path: a.path, namespace: 'horosa-asset' }));
		b.onLoad({ filter: /.*/, namespace: 'horosa-asset' }, (a)=>({ contents: `export default ${JSON.stringify(path.basename(a.path))};`, loader: 'js' }));
	},
};

async function build(opts){
	const quiet = !!(opts && opts.quiet) || process.argv.includes('--quiet');
	let esbuild;
	try{ esbuild = require(path.join(UI, 'node_modules/esbuild')); }catch(e){
		console.error('[horosa] 找不到 esbuild:先在 Horosa-Web/astrostudyui 里装依赖(npm ci),或运行 ./horosa setup');
		process.exit(2);
	}
	const t0 = Date.now();
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const srcNewest = sourceNewest();
	await esbuild.build({
		entryPoints: [path.join(__dirname, 'entry.js')],
		bundle: true, platform: 'node', format: 'cjs', target: 'node16',
		outfile: OUT, loader: { '.js': 'jsx' }, inject: [path.join(__dirname, 'react-shim.js')],
		define: { 'process.env.NODE_ENV': '"production"' }, plugins: [shims], logLevel: 'error',
		nodePaths: [path.join(UI, 'node_modules')], mainFields: ['main', 'module'],
	});
	fs.writeFileSync(path.join(OUT_DIR, 'build-info.json'), JSON.stringify({ builtAt: new Date().toISOString(), srcNewestMs: srcNewest }, null, 1));
	if(!quiet){ console.error(`[horosa] 无头运行时已打包:${path.relative(process.cwd(), OUT)}(${Date.now() - t0} ms)`); }
}

module.exports = { build, newestMtime, sourceNewest, HEADLESS_BUNDLED, OUT, OUT_DIR };
if(require.main === module){
	build().catch((e)=>{ console.error('[horosa] 打包失败:', (e && e.errors ? e.errors.slice(0, 10).map((x)=>`${x.text} @ ${x.location && x.location.file}:${x.location && x.location.line}`).join('\n') : e)); process.exit(1); });
}
