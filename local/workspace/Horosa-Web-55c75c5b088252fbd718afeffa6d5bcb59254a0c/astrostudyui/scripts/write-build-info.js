#!/usr/bin/env node
/*
 * 构建指纹落盘（v3.3.3 发布事故根治：装机 dist 曾由「工作树含未提交中间态」构建，
 * 与任何 commit 都不对应 → 推运双盘/择日控件/奇门封局 App 内静默坏、preview 恒好、无从追溯）。
 * build/build:file 后自动写 build-info.json 进产物目录：记录构建时刻的 HEAD、工作树是否干净、
 * 脏文件数与构建时间。preflight [122] 据此把「dist 必须来自干净 HEAD」做成机器门。
 * 任何失败（无 git 等）恒不阻断构建——指纹缺失本身会被 preflight 咬。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd){
	try{
		return execSync(cmd, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	}catch(e){
		return '';
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
	// 只统计会进 dist 的源码面（前端 src/config/依赖清单）——docs/HANDOFF 等不影响产物的脏文件不算。
	const dirtyRaw = sh('git status --porcelain -- ../src ../package.json ../.umirc.js ../public');
	const dirtyFiles = dirtyRaw ? dirtyRaw.split('\n').filter(Boolean) : [];
	const info = {
		commit: commit || 'unknown',
		dirty: dirtyFiles.length > 0,
		dirtyCount: dirtyFiles.length,
		builtAt: new Date().toISOString(),
		dist: distDir,
	};
	fs.writeFileSync(path.join(outDir, 'build-info.json'), `${JSON.stringify(info, null, '\t')}\n`);
	if(info.dirty){
		console.warn(`[build-info] ⚠️ 工作树含 ${info.dirtyCount} 个影响产物的未提交改动 —— 该产物无法对应任何 commit，禁止用于发布打包（preflight [122] 会拦）。`);
	}else{
		console.log(`[build-info] ${distDir} <- ${(commit || '').slice(0, 12)} (clean)`);
	}
}

main();
