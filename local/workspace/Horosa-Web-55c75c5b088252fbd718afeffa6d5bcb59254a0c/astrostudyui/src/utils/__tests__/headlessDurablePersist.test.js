// 无头运行时的记录写入「是否真落盘」:文件存储同步落一次再答,落不进(磁盘满 / 权限 / 只读盘)→ 回报只写进了本次运行;
// 网页 / 桌面没有这个宿主钩子,判据照旧只看存储模式。
import path from 'path';
import { recordStorePersisted } from '../recordStoreNotice';

// eslint-disable-next-line global-require
const { createFileStorage } = require('../../../headless/runtime');

afterEach(()=>{ delete globalThis.__horosaDurableFlush; });

test('🔴 落不进盘:__flushNow 回 false,recordStorePersisted 如实回 false', ()=>{
	// 数据文件放系统临时目录;写临时文件那一步模拟磁盘满(不在源码树里落任何东西)
	const fs = require('fs');
	const os = require('os');
	const file = path.join(os.tmpdir(), `horosa-durable-${process.pid}-${Date.now()}`, 'localStorage.json');
	const bad = createFileStorage(file);
	bad.setItem('k', 'v');
	const spy = jest.spyOn(fs, 'openSync').mockImplementation(()=>{ const e = new Error('ENOSPC: no space left on device'); e.code = 'ENOSPC'; throw e; });
	const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(()=>true);
	expect(bad.__flushNow()).toBe(false);
	expect(bad.__health().dirty).toBe(true);
	globalThis.__horosaDurableFlush = ()=>bad.__flushNow();
	expect(recordStorePersisted('chart')).toBe(false);
	expect(recordStorePersisted('case')).toBe(false);
	spy.mockRestore();
	expect(bad.__flushNow()).toBe(true);   // 恢复后落得进
	stderr.mockRestore();
	try{ fs.unlinkSync(file); fs.rmdirSync(path.dirname(file)); }catch(e){ /* 临时目录,清不掉无害 */ }
});

test('落得进 / 没有待落盘:回 true;没有宿主钩子照旧按存储模式', ()=>{
	globalThis.__horosaDurableFlush = ()=>true;
	expect(recordStorePersisted('chart')).toBe(true);
	delete globalThis.__horosaDurableFlush;
	expect(recordStorePersisted('chart')).toBe(true);
});
