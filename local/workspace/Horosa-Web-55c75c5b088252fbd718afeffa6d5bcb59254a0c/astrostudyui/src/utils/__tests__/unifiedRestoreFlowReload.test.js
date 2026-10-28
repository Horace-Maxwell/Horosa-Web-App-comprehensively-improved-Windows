// 全量恢复写完之后的刷新不取决于用户点哪个钮:
//   · 全部成功:结果存进 sessionStorage、立即刷新恰好一次;有失败项:先不刷新、当场逐条列出,「刷新页面」后刷新恰好一次;
//   · sessionStorage 存不进:先弹结果框,Esc / 点遮罩关不掉,点「知道了」关框后刷新恰好一次;
//   · 记录只进了内存:不刷新,全局设置落盘保持冻结(恢复写进去的设置重启后生效)。
// 此前失败框只挂 onOk:按 Esc / 点遮罩关掉就不刷新,恢复的全局设置随后被内存旧状态整份盖回。
jest.mock('../autoBackup', ()=>({ runAutoBackupOnce: jest.fn(()=>Promise.resolve({ ok: false })) }));
import { finishUnifiedRestore, showCarriedRestoreResult } from '../../components/user/unifiedRestoreFlow';
import { RESTORE_RESULT_CARRY_KEY, takeRestoreResult } from '../restoreResultCarry';
import { freezeGlobalSetupWrites, thawGlobalSetupWrites, globalSetupWritesFrozen } from '../globalSetupStore';

const wait = (ms)=>new Promise((r)=>setTimeout(r, ms));
const BAD = [{ key: 'raw.globalSetup', ok: false, label: '全局设置', detail: '这一部分在备份文件里已损坏（校验和不符），已跳过，本机数据不动' }, { key: 'charts', ok: true, detail: '导入 3 条' }];

async function cleanupModals(){
	const { Modal } = require('antd');
	Modal.destroyAll();
	await wait(50);
	document.body.innerHTML = '';
}

beforeEach(async ()=>{
	window.sessionStorage.clear();
	thawGlobalSetupWrites();
	await cleanupModals();
});
afterEach(()=>{
	jest.restoreAllMocks();
	thawGlobalSetupWrites();
});

describe('恢复后刷新恰好一次', ()=>{
	it('🔴 有失败项:先不刷新,当场逐条列出(中文名:说明);Esc 关不掉,点「刷新页面」后刷新恰好一次', async ()=>{
		const reload = jest.fn();
		const r = finishUnifiedRestore(null, BAD, { reload });
		expect(r).toMatchObject({ reloaded: false, carried: false });
		expect(reload).not.toHaveBeenCalled();
		await wait(80);
		expect(document.body.textContent).toContain('全局设置：');
		expect(document.body.textContent).toContain('校验和不符');
		const wrap = document.querySelector('.ant-modal-wrap');
		wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
		await wait(500);
		expect(reload).not.toHaveBeenCalled();
		const btn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
		expect(btn.textContent.replace(/\s/g, '')).toContain('刷新页面');
		btn.click();
		await wait(500);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(window.sessionStorage.getItem(RESTORE_RESULT_CARRY_KEY)).toBe(null);   // 已当场看过,刷新后不再弹
	});

	it('刷新之后:带过来的结果弹一次、不再弹(全部成功只提示一句)', async ()=>{
		window.sessionStorage.setItem(RESTORE_RESULT_CARRY_KEY, JSON.stringify({ bad: [{ key: 'x', label: '某项', detail: '没写进' }], at: Date.now() }));
		expect(showCarriedRestoreResult()).toBe(true);
		await wait(80);
		expect(document.body.textContent).toContain('某项');
		expect(showCarriedRestoreResult()).toBe(false);
	});

	it('全部成功:同样立即刷新一次', ()=>{
		const reload = jest.fn();
		finishUnifiedRestore(null, [{ key: 'charts', ok: true, detail: '导入 3 条' }], { reload });
		expect(reload).toHaveBeenCalledTimes(1);
		expect(takeRestoreResult()).toMatchObject({ bad: [] });
	});

	async function fallbackCase(closeSteps){
		// sessionStorage 写不进(隐私模式等)→ 先弹框、关框后刷新
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(this === window.sessionStorage){ throw new Error('blocked'); }
			return original.call(this, k, v);
		});
		const reload = jest.fn();
		const r = finishUnifiedRestore(null, BAD, { reload });
		expect(r).toMatchObject({ reloaded: false, carried: false });
		await wait(80);
		const wrap = document.querySelector('.ant-modal-wrap');
		expect(wrap).not.toBe(null);
		for(const step of closeSteps){
			if(step === 'esc'){
				wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
			}else if(step === 'mask'){
				wrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
				wrap.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
				wrap.click();
			}else if(step === 'ok'){
				const btn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
				expect(btn).not.toBe(null);
				btn.click();
			}
			// eslint-disable-next-line no-await-in-loop
			await wait(500);
		}
		return reload;
	}

	it('🔴 存不进 sessionStorage:按 Esc 关不掉、不刷新;点「知道了」后刷新恰好一次', async ()=>{
		const reload = await fallbackCase(['esc']);
		expect(reload).toHaveBeenCalledTimes(0);
		expect(document.querySelector('.ant-modal-confirm-btns .ant-btn-primary')).not.toBe(null);   // 框还在
		document.querySelector('.ant-modal-confirm-btns .ant-btn-primary').click();
		await wait(500);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('🔴 存不进 sessionStorage:点遮罩关不掉;Esc + 遮罩 + 「知道了」一通操作也只刷新一次', async ()=>{
		const reload = await fallbackCase(['mask', 'esc', 'ok']);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('🔴 存不进 sessionStorage:直接点「知道了」→ 刷新恰好一次', async ()=>{
		const reload = await fallbackCase(['ok']);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('🔴 记录只进了内存:不刷新,全局设置落盘保持冻结', async ()=>{
		freezeGlobalSetupWrites('unified-restore');
		const reload = jest.fn();
		const r = finishUnifiedRestore(null, [{ key: 'charts', ok: false, sessionOnly: true, detail: '导入 2 条（本机存储不可用，只在本次运行有效，请先导出）' }], { reload });
		expect(r).toMatchObject({ reloaded: false, sessionOnly: true });
		await wait(80);
		expect(reload).not.toHaveBeenCalled();
		expect(globalSetupWritesFrozen()).toBe(true);
		expect(document.body.textContent).toContain('重启软件后生效');
	});
});

describe('🔴 不刷新的路径:被恢复换掉的记录按记录号广播(当前载入的那条按库里新版重设)', ()=>{
	const { RECORDS_CHANGED_EVENT } = require('../recordStoreNotice');
	const listen = ()=>{ const got = []; const h = (e)=>got.push(e.detail); window.addEventListener(RECORDS_CHANGED_EVENT, h); return { got, off: ()=>window.removeEventListener(RECORDS_CHANGED_EVENT, h) }; };
	it('记录只进了内存:命盘 / 事盘两段各广播一次,带 cids 与 source:restore', ()=>{
		const l = listen();
		finishUnifiedRestore(null, [
			{ key: 'charts', ok: false, sessionOnly: true, detail: 'x', changedCids: ['c1'] },
			{ key: 'cases', ok: false, sessionOnly: true, detail: 'y', changedCids: ['k1', 'k2'] },
			{ key: 'raw', ok: true, detail: 'z' },
		], { reload: jest.fn() });
		l.off();
		expect(l.got).toEqual([{ store: 'chart', cids: ['c1'], source: 'restore' }, { store: 'case', cids: ['k1', 'k2'], source: 'restore' }]);
	});
	it('有失败项先列结果(不立刻刷新)同样广播;全部成功立即刷新不广播;没有换掉的不广播', ()=>{
		const l = listen();
		finishUnifiedRestore(null, [{ key: 'charts', ok: true, detail: 'a', changedCids: ['c9'] }, { key: 'horosa.x', ok: false, detail: 'b' }], { reload: jest.fn() });
		expect(l.got).toEqual([{ store: 'chart', cids: ['c9'], source: 'restore' }]);
		l.got.length = 0;
		finishUnifiedRestore(null, [{ key: 'charts', ok: true, detail: 'a', changedCids: ['c9'] }], { reload: jest.fn() });
		finishUnifiedRestore(null, [{ key: 'charts', ok: false, sessionOnly: true, detail: 'a', changedCids: [] }], { reload: jest.fn() });
		l.off();
		expect(l.got).toEqual([]);
	});
});

describe('源码合同', ()=>{
	const fs = require('fs');
	const path = require('path');
	const src = fs.readFileSync(path.join(__dirname, '../../components/user/unifiedRestoreFlow.js'), 'utf8');
	it('恢复执行前冻结全局设置落盘;刷新不挂在 onOk 上', ()=>{
		const okBody = src.slice(src.indexOf('onOk: async ()=>{'), src.indexOf('finishUnifiedRestore(ub, results, opts);'));
		expect(okBody.indexOf('freezeGlobalSetupWrites(')).toBeGreaterThan(-1);
		expect(okBody.indexOf('freezeGlobalSetupWrites(')).toBeLessThan(okBody.indexOf('restoreUnifiedBackup('));
		expect(src).not.toMatch(/onOk:\s*reload/);
		expect(src).toContain('afterClose: reload');
		expect(src).toContain('keyboard: false');
		expect(src).toContain('maskClosable: false');
	});
});
