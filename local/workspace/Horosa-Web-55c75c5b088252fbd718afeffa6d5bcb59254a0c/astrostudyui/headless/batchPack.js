#!/usr/bin/env node
// 批量运行包:./horosa batch-pack [输出.tar.gz] —— 把批量验证要用的东西打成一个压缩包,拿到 Linux 服务器(x86_64 / arm64)上
// 只要 Node 18+、Python 3.11+(装好依赖)、(要 Java 的技法再加 JDK 17)就能跑,不用装前端依赖、不用 Maven、不用桌面 App。
// 包里:已打好的无头运行时(与本仓 ./horosa 同一份产物)+ 它运行时要的 jsdom 依赖 + 批量 / 运行时脚本 + Python 计算引擎源码与星历文件
//   + 后端 jar(--no-java 不带)+ 名人库(--no-celebrities 不带)+ 起停脚本 / Dockerfile / Python 依赖清单 + 使用说明。
// 目录结构与仓库同形(Horosa-Web/…),脚本里的相对路径不用改;包里没有前端源码,运行时据此不判「产物陈旧」、不尝试重打。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const UI = path.resolve(__dirname, '..');
const WEB = path.resolve(UI, '..');
const REPO = path.resolve(WEB, '..');
const EXIT = { OK: 0, USAGE: 2, FAILED: 5 };

// 包内只带这几件无头脚本(批量入口 + 运行时 + 端口单源 + 版本号读取链);其余(MCP / REST 服务、终端命令)批量用不到
const HEADLESS_FILES = ['batch.js', 'runtime.js', 'ports.js', 'build.js', 'server.js', 'protocol.js', 'rest.js', 'exit.js'];
const PY_EXCLUDE = /(^|\/)(__pycache__|\.pytest_cache|tests?)(\/|$)|\.py[co]$|(^|\/)\.DS_Store$/;

function parsePackArgs(argv){
	const o = { out: null, java: true, celebrities: true, help: false };
	for(const a of argv){
		if(a === '-h' || a === '--help'){ o.help = true; }
		else if(a === '--no-java'){ o.java = false; }
		else if(a === '--no-celebrities'){ o.celebrities = false; }
		else if(a.startsWith('-')){ throw Object.assign(new Error(`不认识的选项 ${a}`), { exitCode: EXIT.USAGE }); }
		else if(o.out){ throw Object.assign(new Error('只能给一个输出文件'), { exitCode: EXIT.USAGE }); }
		else{ o.out = a; }
	}
	return o;
}

// 递归拷目录(保留修改时刻;跳过排除项与符号链接之外的特殊文件)
function copyTree(src, dst, exclude, rel){
	const r = rel || '';
	fs.mkdirSync(dst, { recursive: true });
	for(const e of fs.readdirSync(src, { withFileTypes: true })){
		const sub = r ? `${r}/${e.name}` : e.name;
		if(exclude && exclude.test(sub)){ continue; }
		const s = path.join(src, e.name); const d = path.join(dst, e.name);
		if(e.isDirectory()){ copyTree(s, d, exclude, sub); continue; }
		if(e.isSymbolicLink()){ const real = fs.realpathSync(s); if(fs.statSync(real).isDirectory()){ copyTree(real, d, exclude, sub); }else{ copyFile(real, d); } continue; }
		if(e.isFile()){ copyFile(s, d); }
	}
}
function copyFile(s, d){
	fs.mkdirSync(path.dirname(d), { recursive: true });
	fs.copyFileSync(s, d);
	const st = fs.statSync(s);
	fs.chmodSync(d, st.mode & 0o777);
	fs.utimesSync(d, st.atime, st.mtime);
}

// jsdom 运行时依赖闭包:按 Node 的查找规则(自己目录下的 node_modules → 逐级往上)解析每个依赖,
// 原样保留它在 node_modules 里的相对位置(嵌套的不同版本也照原样),所以包里解析结果与本仓一致
function dependencyClosure(rootName){
	const NM = fs.realpathSync(path.join(UI, 'node_modules'));
	const seen = new Map();   // 绝对目录 → node_modules 下相对路径
	const resolveFrom = (dir, name)=>{
		let d = dir;
		for(;;){
			const cand = path.join(d, 'node_modules', name);
			if(fs.existsSync(path.join(cand, 'package.json'))){ return fs.realpathSync(cand); }
			if(path.resolve(d) === path.resolve(path.dirname(NM)) || path.dirname(d) === d){ break; }
			d = path.dirname(d);
		}
		const top = path.join(NM, name);
		return fs.existsSync(path.join(top, 'package.json')) ? fs.realpathSync(top) : null;
	};
	const missing = [];
	const walk = (dir)=>{
		if(seen.has(dir)){ return; }
		const rel = path.relative(NM, dir);
		if(rel.startsWith('..')){ throw new Error(`依赖解析到了 node_modules 之外:${dir}`); }
		seen.set(dir, rel);
		const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
		for(const dep of Object.keys(pj.dependencies || {})){
			const got = resolveFrom(dir, dep);
			if(got){ walk(got); }else if(!(pj.optionalDependencies && pj.optionalDependencies[dep])){ missing.push(`${pj.name} → ${dep}`); }
		}
	};
	const root = resolveFrom(path.dirname(NM), rootName);
	if(!root){ throw new Error(`本仓 node_modules 里没有 ${rootName}(先 ./horosa setup)`); }
	walk(root);
	return { NM, dirs: Array.from(seen.entries()), missing };
}

// 后端 jar:HOROSA_JAR(与起停脚本同一个变量)> 本仓构建产物 > runtime/<平台>/bundle 里的
function findJar(){
	const c = [process.env.HOROSA_JAR, path.join(WEB, 'astrostudysrv/astrostudyboot/target/astrostudyboot.jar')].filter(Boolean);
	try{ fs.readdirSync(path.join(REPO, 'runtime')).forEach((p)=>c.push(path.join(REPO, 'runtime', p, 'bundle/astrostudyboot.jar'))); }catch(e){ /* 没有 runtime/ */ }
	return c.find((f)=>fs.existsSync(f)) || null;
}

const LAUNCHER = `#!/usr/bin/env bash
# 星阙批量验证(运行包):./horosa-batch <命例文件> -t <技法,…> [选项];./horosa-batch --help 看全部
set -euo pipefail
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="\${HOROSA_NODE:-node}"
command -v "\${NODE_BIN}" >/dev/null 2>&1 || { echo "horosa-batch: 找不到 Node.js(要 18+;装好后再跑,或设 HOROSA_NODE=/绝对路径/node)" >&2; exit 3; }
major="$("\${NODE_BIN}" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "\${major}" -ge 18 ] 2>/dev/null || { echo "horosa-batch: Node.js 要 18+(现在是 $("\${NODE_BIN}" -v 2>/dev/null))" >&2; exit 3; }
exec "\${NODE_BIN}" "\${ROOT}/Horosa-Web/astrostudyui/headless/batch.js" "$@"
`;

async function main(argv, ioIn){
	const io = ioIn || { out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) };
	let o;
	try{ o = parsePackArgs(argv); }catch(e){ io.err(`horosa batch-pack: ${e.message}\n`); return e.exitCode || EXIT.USAGE; }
	if(o.help){
		io.out('用法: ./horosa batch-pack [输出.tar.gz] [--no-java] [--no-celebrities]\n  打一个批量运行包(Linux / macOS 通用):服务器上只要 Node 18+、Python 3.11+(+ JDK 17)即可 ./horosa-batch …\n  --no-java 不带后端 jar(只算不要 Java 的技法)· --no-celebrities 不带名人库(约 50 MB)\n');
		return EXIT.OK;
	}
	try{
		const { ensureBundle } = require('./runtime');
		const { appVersion } = require('./server');
		await ensureBundle({ quiet: true });
		const version = appVersion();
		const name = `horosa-batch-${version.replace(/[^0-9A-Za-z.+-]/g, '_')}`;
		const out = path.resolve(o.out || `${name}.tar.gz`);
		const jar = o.java ? findJar() : null;
		if(o.java && !jar){ throw Object.assign(new Error('找不到后端 jar(先 mvn -f Horosa-Web/astrostudysrv/pom.xml clean install -DskipTests);只要不需要 Java 的技法就加 --no-java'), { exitCode: EXIT.FAILED }); }
		const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-batch-pack-'));
		const root = path.join(stage, name);
		try{
			// 无头运行时 + 批量脚本
			const hl = path.join(root, 'Horosa-Web/astrostudyui/headless');
			HEADLESS_FILES.forEach((f)=>copyFile(path.join(__dirname, f), path.join(hl, f)));
			['horosa-runtime.cjs', 'build-info.json'].forEach((f)=>copyFile(path.join(__dirname, 'dist', f), path.join(hl, 'dist', f)));
			fs.writeFileSync(path.join(root, 'Horosa-Web/astrostudyui/package.json'), `${JSON.stringify({ name: 'horosa-batch-pack', version }, null, 1)}\n`);
			// jsdom 运行时依赖
			const dep = dependencyClosure('jsdom');
			if(dep.missing.length){ throw Object.assign(new Error(`jsdom 的依赖在本仓 node_modules 里缺:${dep.missing.slice(0, 5).join('、')}`), { exitCode: EXIT.FAILED }); }
			dep.dirs.forEach(([abs, rel])=>copyTree(abs, path.join(root, 'Horosa-Web/astrostudyui/node_modules', rel), /(^|\/)node_modules(\/|$)/));
			// 名人库
			if(o.celebrities){
				const ad = path.join(UI, 'public/astrodata');
				['astrodata-aa.sqlite.gz', 'astrodata-manifest.json'].forEach((f)=>copyFile(path.join(ad, f), path.join(root, 'Horosa-Web/astrostudyui/public/astrodata', f)));
				copyTree(path.join(ad, 'vendor'), path.join(root, 'Horosa-Web/astrostudyui/public/astrodata/vendor'));
			}
			// Python 计算引擎(源码 + 星历文件)
			['astropy', 'flatlib-ctrad2', 'vendor'].forEach((d)=>copyTree(path.join(WEB, d), path.join(root, 'Horosa-Web', d), PY_EXCLUDE));
			// 后端 jar(放在仓库里构建产物的同一位置,起停脚本照常找得到)
			if(jar){ copyFile(jar, path.join(root, 'Horosa-Web/astrostudysrv/astrostudyboot/target/astrostudyboot.jar')); }
			// 起停脚本 / Dockerfile / 依赖清单 / 说明 / 许可
			['scripts/linux/backends.sh', 'scripts/linux/Dockerfile', 'scripts/requirements/mac-python.txt', 'scripts/requirements/linux-python.txt'].forEach((f)=>copyFile(path.join(REPO, f), path.join(root, f)));
			['LICENSE', 'THIRD_PARTY_NOTICES.md'].forEach((f)=>{ if(fs.existsSync(path.join(REPO, f))){ copyFile(path.join(REPO, f), path.join(root, f)); } });
			copyFile(path.join(REPO, 'docs/HEADLESS.md'), path.join(root, 'HEADLESS.md'));
			fs.writeFileSync(path.join(root, 'horosa-batch'), LAUNCHER, { mode: 0o755 });
			fs.writeFileSync(path.join(root, 'pack-info.json'), `${JSON.stringify({ version, builtAt: new Date().toISOString(), java: !!jar, celebrities: o.celebrities, node: '>=18', python: '>=3.11', jdk: jar ? '17+' : null }, null, 1)}\n`);
			fs.mkdirSync(path.dirname(out), { recursive: true });
			const t = spawnSync('tar', ['-czf', out, '-C', stage, name], { stdio: ['ignore', 'inherit', 'inherit'] });
			if(t.status !== 0){ throw Object.assign(new Error(`tar 打包失败(退出码 ${t.status})`), { exitCode: EXIT.FAILED }); }
		}finally{
			try{ fs.rmSync(stage, { recursive: true, force: true }); }catch(e){ /* 临时目录 */ }
		}
		const mb = (fs.statSync(out).size / 1048576).toFixed(0);
		io.err(`[batch-pack] 已打包:${out}(${mb} MB;${jar ? '含后端 jar' : '不含后端 jar,只算不要 Java 的技法'}${o.celebrities ? ' · 含名人库' : ''})\n`
			+ '[batch-pack] 服务器上:tar -xzf 包 && cd 目录 && pip install -r scripts/requirements/linux-python.txt && bash scripts/linux/backends.sh start && ./horosa-batch --help(详见包里 HEADLESS.md「批量验证」)\n');
		return EXIT.OK;
	}catch(e){
		io.err(`horosa batch-pack: ${e && e.message ? e.message : e}\n`);
		return e && e.exitCode ? e.exitCode : EXIT.FAILED;
	}
}

module.exports = { main, dependencyClosure, parsePackArgs, HEADLESS_FILES };
if(require.main === module){
	main(process.argv.slice(2)).then((code)=>{ process.exitCode = code; });
}
