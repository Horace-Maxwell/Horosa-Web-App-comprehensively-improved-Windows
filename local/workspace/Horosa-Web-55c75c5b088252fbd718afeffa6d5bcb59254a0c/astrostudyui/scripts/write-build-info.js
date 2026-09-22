#!/usr/bin/env node
/*
 * 构建指纹落盘（v3.3.3 发布事故根治：装机 dist 曾由「工作树含未提交中间态」构建，
 * 与任何 commit 都不对应 → 推运双盘/择日控件/奇门封局 App 内静默坏、preview 恒好、无从追溯）。
 * build/build:file 后自动写 build-info.json 进产物目录：记录构建时刻的 HEAD、工作树是否干净、
 * 脏文件数与构建时间。preflight [122] 据此把「dist 必须来自干净 HEAD」做成机器门。
 * 任何失败（无 git 等）恒不阻断构建——指纹缺失本身会被 preflight 咬。
 */
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd){
	try{
		return execSync(cmd, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	}catch(e){
		return '';
	}
}

// 前端源面清单单源:scripts/fe-source-paths.txt(构建时判脏 / 发布自检指纹门 / 打包产物冒烟 三处同读这一份)。
function readSourcePaths(){
	try{
		const raw = fs.readFileSync(path.join(__dirname, 'fe-source-paths.txt'), 'utf8');
		return raw.split('\n').map((s)=>s.trim()).filter((s)=>s && !s.startsWith('#'));
	}catch(e){
		return [];
	}
}

function main(){
	const distDir = process.argv[2] || (process.env.BUILD_FOR_FILE === '1' ? 'dist-file' : 'dist');
	const outDir = path.resolve(__dirname, '..', distDir);
	if(!fs.existsSync(outDir)){
		console.warn(`[build-info] 产物目录不存在，跳过: ${outDir}`);
		return;
	}
	const commit = sh('git rev-parse HEAD');
	// 只统计会改变产物字节的源面(清单见 fe-source-paths.txt:源码 / 静态资源 / 依赖清单与锁 / 构建配置 / 构建前后处理脚本)
	// ——docs 等不影响产物的脏文件不算。清单读不到 = 无法判脏 → 按脏处理(fail-closed,发布自检会拦)。
	const srcPaths = readSourcePaths();
	// horosa_buildinfo_shell_free_v1(Windows 侧移植适配;建议上游化 Mac):判脏命令原走 execSync 字符串 + 单引号
	// pathspec —— Windows 的 execSync 走 cmd.exe,单引号不是引号,git 收到的是字面 `'../src'`,一个都匹配不上 ⇒
	// 908 个未提交改动被判成 dirty=false(实测),发布自检的构建指纹门([#63])随之假绿:脏树产物照样发货。
	// 修 = execFileSync 数组参数(零 shell、零引号语义),且 git 失败改按脏处理(原 catch 吞成 '' = dirty=false 是
	// fail-open,与本文件头「无法判脏 → 按脏处理」的口径相反)。判别力由发布自检 `check_frontend_build_fingerprint`
	// 的探针自证(临时脏文件必须被判 dirty=true)。
	let dirtyRaw = '?? fe-source-paths.txt(清单缺失或为空)';
	if(srcPaths.length){
		try{
			dirtyRaw = execFileSync('git', ['status', '--porcelain', '--'].concat(srcPaths.map((p)=>`../${p}`)), { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
		}catch(e){
			dirtyRaw = '?? git status failed(无法判脏,按脏处理)';
		}
	}
	const dirtyFiles = dirtyRaw ? dirtyRaw.split('\n').filter(Boolean) : [];
	const info = {
		commit: commit || 'unknown',
		dirty: dirtyFiles.length > 0,
		dirtyCount: dirtyFiles.length,
		builtAt: new Date().toISOString(),
		dist: distDir,
		sourcePaths: srcPaths.length,
	};
	fs.writeFileSync(path.join(outDir, 'build-info.json'), `${JSON.stringify(info, null, '\t')}\n`);
	if(info.dirty){
		console.warn(`[build-info] ⚠️ 工作树含 ${info.dirtyCount} 个影响产物的未提交改动 —— 该产物无法对应任何 commit，禁止用于发布打包（preflight [122] 会拦）。`);
	}else{
		console.log(`[build-info] ${distDir} <- ${(commit || '').slice(0, 12)} (clean)`);
	}
}

main();
