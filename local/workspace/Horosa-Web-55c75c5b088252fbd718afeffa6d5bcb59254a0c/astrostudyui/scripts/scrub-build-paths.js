#!/usr/bin/env node
/**
 * 构建产物路径脱敏 —— 把 umi 写进 bundle 的**构建机绝对路径**换成中性标识。
 *
 * 病灶(2026-08-01 v3.6.1 保密复查抓到,属存量):umi 的插件注册会把运行时文件的绝对路径
 * 原样写进 bundle,形如
 *     register({ apply: a, path: "/Users/<用户名>/Desktop/<仓目录名>/.../plugin-dva/runtime.tsx" })
 * 于是发布产物里同时躺着两样不该有的东西:
 *   ① 构建机用户名(PII);
 *   ② 本地仓目录名(会暴露开发环境的组织方式)。
 * 这个 path 只是插件注册的调试标识,运行期不做文件系统解析,换成中性串不影响功能。
 *
 * 判据:替换后产物内 `/Users/` 出现次数必须为 0(脚本自校验,非 0 即退出码 1)。
 * 用法:node scripts/scrub-build-paths.js <dist 目录>
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
	console.error('[scrub-build-paths] 用法: node scripts/scrub-build-paths.js <dist目录>');
	process.exit(1);
}
const root = path.resolve(process.cwd(), dir);
if (!fs.existsSync(root)) {
	console.error(`[scrub-build-paths] 目录不存在: ${root}`);
	process.exit(1);
}

// 绝对路径前缀 → 中性标识。保留末段(插件名/文件名)以便调试时仍能认出是哪个注册项。
const ABS_RE = /\/(?:Users|home)\/[^"'`\s,)\]}]*?\/(?:src|app)\//g;
const WIN_RE = /[A-Za-z]:\\\\?(?:Users|home)\\\\?[^"'`\s,)\]}]*?\\\\?src\\\\?/g;

let scanned = 0;
let touched = 0;
let replaced = 0;

function walk(p) {
	for (const name of fs.readdirSync(p)) {
		const full = path.join(p, name);
		const st = fs.statSync(full);
		if (st.isDirectory()) { walk(full); continue; }
		if (!/\.(js|css|html|map)$/.test(name)) { continue; }
		scanned++;
		const before = fs.readFileSync(full, 'utf8');
		let after = before.replace(ABS_RE, '@build/').replace(WIN_RE, '@build/');
		if (after !== before) {
			const n = (before.match(ABS_RE) || []).length + (before.match(WIN_RE) || []).length;
			fs.writeFileSync(full, after);
			touched++; replaced += n;
		}
	}
}
walk(root);

// 自校验:替换后不允许再出现构建机路径。光看「跑过了」不算数。
let leaked = [];
function verify(p) {
	for (const name of fs.readdirSync(p)) {
		const full = path.join(p, name);
		const st = fs.statSync(full);
		if (st.isDirectory()) { verify(full); continue; }
		if (!/\.(js|css|html|map)$/.test(name)) { continue; }
		const s = fs.readFileSync(full, 'utf8');
		if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(s)) { leaked.push(path.relative(root, full)); }
	}
}
verify(root);

if (leaked.length) {
	console.error(`[scrub-build-paths] ❌ 仍有构建机路径残留(${leaked.length} 个文件): ${leaked.slice(0, 5).join(', ')}`);
	process.exit(1);
}
console.log(`[scrub-build-paths] ✓ ${dir}: 扫 ${scanned} 个产物文件, 改写 ${touched} 个, 脱敏 ${replaced} 处, 残留 0`);
