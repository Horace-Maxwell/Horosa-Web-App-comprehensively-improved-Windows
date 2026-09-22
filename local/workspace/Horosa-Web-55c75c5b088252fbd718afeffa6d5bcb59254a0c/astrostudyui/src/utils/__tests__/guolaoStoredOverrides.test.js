// [Q-407/M-152] 七政 C 类覆盖重算:覆盖只活在进程内作用域,localStorage 全程不写;作用域退出即还原;源码不再临时写盘。
import fs from 'fs';
import path from 'path';
import { withGuolaoStoredOverrides, getStoredGuolaoSu28Mode, getStoredGuolaoLifeMode, getStoredGuolaoNodeMode, __guolaoStoredOverridesForTests } from '../../components/guolao/GuoLaoChartStyle';
import { localStorageOverrideMap } from '../techniqueMountSettings';

describe('[Q-407] 七政覆盖作用域', () => {
	beforeEach(() => { window.localStorage.clear(); });

	test('作用域内 getter 读到覆盖值;退出后还原;localStorage 全程零写入', async () => {
		window.localStorage.setItem('horosaGuolaoSu28Mode', '2');
		let inside = null;
		const ret = await withGuolaoStoredOverrides({ horosaGuolaoSu28Mode: '5', horosaGuolaoLifeMode: 'yumao', horosaGuolaoNodeMode: 'northRahuSouthKetu' }, async () => {
			await Promise.resolve();
			inside = { su28: getStoredGuolaoSu28Mode(), life: getStoredGuolaoLifeMode(), node: getStoredGuolaoNodeMode() };
			return 'built';
		});
		expect(ret).toBe('built');
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
		expect(getStoredGuolaoSu28Mode()).toBe(2);
	});

	test('localStorageOverrideMap:非默认才进映射,键=storageKey,值=串', () => {
		expect(localStorageOverrideMap('guolao', { su28Mode: 5 })).toEqual({ horosaGuolaoSu28Mode: '5' });
		expect(localStorageOverrideMap('guolao', {})).toEqual({});
		expect(localStorageOverrideMap('bazi', { x: 1 })).toEqual({});
	});

	test('静态锚:AI 挂载 C 类重算走覆盖作用域,不再临时写 localStorage', () => {
		const src = fs.readFileSync(path.join(__dirname, '../aiAnalysisContext.js'), 'utf8');
		expect(src).toContain('withGuolaoStoredOverrides(localStorageOverrideMap(');
		expect(src).not.toMatch(/applyLocalStorageSettings\(|restoreLocalStorageSettings\(|snapshotLocalStorageSettings\(/);
	});
});
