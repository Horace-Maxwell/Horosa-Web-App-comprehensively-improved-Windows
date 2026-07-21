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

if (!bad) {
	console.log(`✓ check-chunk-dup 绿:${bigFiles.length} 个大 async chunk 两两共有模块 ≤${MAX_SHARED_MODULES};最大请求组 ${maxGroup}/${MAX_ASYNC_REQUESTS}(${maxGroupFile})`);
}
process.exit(bad);
