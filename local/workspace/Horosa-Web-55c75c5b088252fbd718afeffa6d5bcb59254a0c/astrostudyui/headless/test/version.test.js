// 无头版本号合同(node --test,纯函数,不起服务):源码检出里 HEAD 不在 v<版本号> 标签上 → 「+unreleased」;
// 不在 git 检出里 / git 探测失败 → 按发版算(不误报);终端 --version 的文字随之说明「未发版」。
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const { appVersion } = require('../server');

const fakeGit = (stdout, status = 0)=>()=>({ status, stdout });

describe('版本号带不带「未发版」', ()=>{
	it('HEAD 在 v<版本号> 标签上 → 原样', ()=>{
		assert.strictEqual(appVersion({ base: '3.11.3', spawnSync: fakeGit('v3.11.2\nv3.11.3\n') }), '3.11.3');
	});
	it('HEAD 不在该标签上(没有标签 / 是别的标签)→ +unreleased', ()=>{
		assert.strictEqual(appVersion({ base: '3.11.3', spawnSync: fakeGit('') }), '3.11.3+unreleased');
		assert.strictEqual(appVersion({ base: '3.11.3', spawnSync: fakeGit('v3.11.30\nv3.11.2\n') }), '3.11.3+unreleased');
	});
	it('不在 git 检出里 / git 失败 / 抛错 → 按发版算', ()=>{
		assert.strictEqual(appVersion({ base: '3.11.3', root: os.tmpdir() + '/horosa-no-such-checkout' }), '3.11.3');
		assert.strictEqual(appVersion({ base: '3.11.3', spawnSync: fakeGit('', 128) }), '3.11.3');
		assert.strictEqual(appVersion({ base: '3.11.3', spawnSync: ()=>{ throw new Error('no git'); } }), '3.11.3');
	});
	it('读不到版本号 → dev(不再拼标记)', ()=>{
		assert.strictEqual(appVersion({ base: 'dev', spawnSync: fakeGit('') }), 'dev');
	});
});
