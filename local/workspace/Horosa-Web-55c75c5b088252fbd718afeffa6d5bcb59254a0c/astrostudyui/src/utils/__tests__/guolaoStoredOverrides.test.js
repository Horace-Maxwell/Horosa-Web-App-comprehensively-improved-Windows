// 七政 C 类覆盖重算:覆盖只活在进程内作用域,localStorage 全程不写;作用域退出即还原;源码不再临时写盘。
import fs from 'fs';
import path from 'path';
import { withGuolaoStoredOverrides, guolaoStoredOverridesScope, runInGuolaoStoredOverrides, getStoredGuolaoSu28Mode, getStoredGuolaoLifeMode, getStoredGuolaoNodeMode, __guolaoStoredOverridesForTests } from '../../components/guolao/GuoLaoChartStyle';
import { localStorageOverrideMap } from '../techniqueMountSettings';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

describe('七政覆盖作用域', () => {
	beforeEach(() => { window.localStorage.clear(); });

	test('作用域同步段内 getter 读到覆盖值(await 后经作用域重入);退出后还原;localStorage 全程零写入', async () => {
		window.localStorage.setItem('horosaGuolaoSu28Mode', '2');
		let inside = null;
		let afterAwait = null;
		const ret = await withGuolaoStoredOverrides({ horosaGuolaoSu28Mode: '5', horosaGuolaoLifeMode: 'yumao', horosaGuolaoNodeMode: 'northRahuSouthKetu' }, async () => {
			const scope = guolaoStoredOverridesScope();
			await Promise.resolve();
			afterAwait = getStoredGuolaoSu28Mode();
			inside = runInGuolaoStoredOverrides(scope, () => ({ su28: getStoredGuolaoSu28Mode(), life: getStoredGuolaoLifeMode(), node: getStoredGuolaoNodeMode() }));
			return 'built';
		});
		expect(ret).toBe('built');
		expect(afterAwait).toBe(2);                                                  // await 之后同窗口其它读者看到的是本机真值
		expect(inside.su28).toBe(5);
		expect(inside.life).toBe('yumao');
		expect(inside.node).toBe('northRahuSouthKetu');
		expect(getStoredGuolaoSu28Mode()).toBe(2);                                   // 退出即还原
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBe('2');       // 未被临时值改写
		expect(window.localStorage.getItem('horosaGuolaoLifeMode')).toBeNull();      // 从未落盘
		expect(__guolaoStoredOverridesForTests()).toBeNull();
	});

	test('builder 抛错也还原作用域(finally)', async () => {
		await expect(withGuolaoStoredOverrides({ horosaGuolaoSu28Mode: '7' }, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
		expect(__guolaoStoredOverridesForTests()).toBeNull();
		expect(getStoredGuolaoSu28Mode()).toBe(0);   // 全局未设 → 缺省荀爽距星
	});

	test('localStorageOverrideMap:非默认才进映射,键=storageKey,值=串', () => {
		expect(localStorageOverrideMap('guolao', { su28Mode: 5 })).toEqual({ horosaGuolaoSu28Mode: '5' });
		expect(localStorageOverrideMap('guolao', {})).toEqual({});
		expect(localStorageOverrideMap('bazi', { x: 1 })).toEqual({});
	});

	test('静态锚:AI 挂载 C 类重算走覆盖作用域,不再临时写 localStorage', () => {
		const src = readSource(path.join(__dirname, '../aiAnalysisContext.js'));
		expect(src).toContain('withGuolaoStoredOverrides(localStorageOverrideMap(');
		expect(src).not.toMatch(/applyLocalStorageSettings\(|restoreLocalStorageSettings\(|snapshotLocalStorageSettings\(/);
	});
});
