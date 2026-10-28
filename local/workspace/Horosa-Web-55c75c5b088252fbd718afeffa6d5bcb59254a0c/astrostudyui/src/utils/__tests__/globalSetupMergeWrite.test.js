// 全局设置落盘单源:app 模型的 save 只写 payload 里真带了的设置字段、以存储现值为底合并;全量恢复期间冻结。
// 看守的三种坏法:
//   ① 与设置无关的 save(refresh / loading / 系统明暗)把内存态整份写回 —— 恢复写进去的全局设置在刷新前被盖回旧值;
//   ② 带一个设置字段的 save 用内存态填其余字段 —— 同一本机存储的另一个窗口刚写的设置被盖掉;
//   ③ models 里的 reducer 绕开单源 helper 直接写存储。
import fs from 'fs';
import path from 'path';
import appModel from '../../models/app';
import {
	GLOBAL_SETUP_FIELDS, mergeGlobalSetupWrite, freezeGlobalSetupWrites, thawGlobalSetupWrites, globalSetupWritesFrozen,
} from '../globalSetupStore';

const KEY = 'globalSetup';
const save = (state, payload)=>appModel.reducers.save(state, { payload });
const stored = ()=>window.localStorage.getItem(KEY);

beforeEach(()=>{
	window.localStorage.clear();
	thawGlobalSetupWrites();
});
afterAll(()=>thawGlobalSetupWrites());

describe('app/save 只落设置字段、以存储为底合并', ()=>{
	it('🔴 payload 里没有设置字段:存储逐字节不变(含不存在时仍不存在)', ()=>{
		const restored = JSON.stringify({ appearanceMode: 'dark', dayBoundary: 'after24', extraFromNewerVersion: 1 });
		window.localStorage.setItem(KEY, restored);
		const stale = { ...appModel.state, appearanceMode: 'light', dayBoundary: 'after23' };
		save(stale, { refresh: false, loading: false });
		save(stale, { resolvedAppearance: 'dark' });
		save(stale, { loadingText: '排盘中' });
		expect(stored()).toBe(restored);
		window.localStorage.removeItem(KEY);
		save(stale, { refresh: true });
		expect(stored()).toBe(null);
	});

	it('🔴 带一个设置字段:只改这一项,其余保留存储原值(不用内存态的值)', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ appearanceMode: 'dark', dayBoundary: 'after24', wheelArt: 'ink' }));
		const stale = { ...appModel.state, appearanceMode: 'light', dayBoundary: 'after23' };
		const st = save(stale, { lateZiHourMode: appModel.state.lateZiHourMode });
		const after = JSON.parse(stored());
		expect(after.appearanceMode).toBe('dark');
		expect(after.dayBoundary).toBe('after24');
		expect(after.wheelArt).toBe('ink');
		expect(after.lateZiHourMode).toBe(appModel.state.lateZiHourMode);
		// 内存态照常更新(界面用的是它)
		expect(st.appearanceMode).toBe('light');
	});

	it('🔴 两个窗口:A 改外观、B 随后改日界 —— A 的改动留着', ()=>{
		const base = { ...appModel.state };
		window.localStorage.setItem(KEY, JSON.stringify({ appearanceMode: 'system', dayBoundary: 'after23' }));
		// 窗口 A
		save(base, { appearanceMode: 'dark' });
		// 窗口 B(内存里还是旧外观)
		save({ ...base, appearanceMode: 'system' }, { dayBoundary: 'after24' });
		const after = JSON.parse(stored());
		expect(after.appearanceMode).toBe('dark');
		expect(after.dayBoundary).toBe('after24');
	});

	it('落盘的值是归一化后的(外观 / 空亡古典义 1·0)', ()=>{
		save({ ...appModel.state }, { appearanceMode: 'weird', voidClassical: true });
		const after = JSON.parse(stored());
		expect(after.appearanceMode).toBe('system');
		expect(after.voidClassical).toBe(1);
	});

	it('🔴 显示清单带缺省值版本(没有版本号的清单下次启动会被再迁移一遍,把亲手开的项关掉)', ()=>{
		save({ ...appModel.state }, { chartDisplay: [1, 2, 3] });
		const after = JSON.parse(stored());
		expect(after.chartDisplay).toEqual([1, 2, 3]);
		expect(after.chartDisplayDefaultsVersion).toBe(appModel.state.chartDisplayDefaultsVersion);
		expect(after.planetDisplayDefaultsVersion).toBeUndefined();   // 没改行星清单:不替它盖版本章
	});

	it('🔴 冻结期间(全量恢复中 / 恢复的记录只在内存)一律不写,内存态照常更新', ()=>{
		const restored = JSON.stringify({ appearanceMode: 'dark' });
		window.localStorage.setItem(KEY, restored);
		freezeGlobalSetupWrites('test');
		expect(globalSetupWritesFrozen()).toBe(true);
		const st = save({ ...appModel.state }, { appearanceMode: 'light', dayBoundary: 'after24' });
		expect(stored()).toBe(restored);
		expect(st.appearanceMode).toBe('light');
		expect(mergeGlobalSetupWrite({ appearanceMode: 'light' })).toEqual({ written: false, skipped: 'frozen' });
		thawGlobalSetupWrites();
		expect(mergeGlobalSetupWrite({ appearanceMode: 'light' })).toMatchObject({ written: true, ok: true });
	});

	it('落盘字段表 ≡ 模型 state 里的同名字段(新增全局设置字段忘了登记 = 重启就丢)', ()=>{
		GLOBAL_SETUP_FIELDS.forEach((f)=>expect(Object.prototype.hasOwnProperty.call(appModel.state, f)).toBe(true));
		// 启动时读回的那组字段都在落盘表里(读回却不落盘 = 改了重启就丢)
		['appearanceMode', 'dayBoundary', 'lateZiHourMode', 'wheelArt', 'chartStyle', 'zeriSnapshotMaxRows', 'voidClassical', 'tripSystem', 'schoolPreset']
			.forEach((f)=>expect(GLOBAL_SETUP_FIELDS).toContain(f));
	});
});

describe('源码合同:全局设置只经单源 helper 落盘', ()=>{
	const SRC = path.join(__dirname, '..', '..');
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	function listJs(dir, out){
		fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(dir, e.name);
			if(e.isDirectory()){ if(['__tests__', 'node_modules', 'test', '.umi', '.umi-production'].indexOf(e.name) < 0){ listJs(f, out); } return; }
			if(/\.(js|jsx|ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)){ out.push(f); }
		});
		return out;
	}

	it('🔴 models/*.js 的 reducers 里不直接写存储(落设置必须经 utils/globalSetupStore)', ()=>{
		const dir = path.join(SRC, 'models');
		const offenders = [];
		fs.readdirSync(dir).filter((n)=>/\.js$/.test(n)).forEach((n)=>{
			const text = fs.readFileSync(path.join(dir, n), 'utf8');
			const i = text.indexOf('reducers:');
			if(i < 0){ return; }
			const j = text.indexOf('effects:', i);
			const block = text.slice(i, j > i ? j : undefined);
			if(/safeLocalStorageSet\(|safeJsonStringifyToStorage\(|localStorage\.setItem\(|scheduleStorageWrite\(/.test(block)){ offenders.push(n); }
		});
		expect(offenders).toEqual([]);
		const app = read('models/app.js');
		const saveBlock = app.slice(app.indexOf('reducers:'), app.indexOf('effects:'));
		expect(saveBlock).toContain('mergeGlobalSetupWrite(');
		expect(saveBlock).toContain('pickGlobalSetupPatch(');
	});

	it('🔴 全仓写 globalSetup 只有单源 helper 一处', ()=>{
		const offenders = [];
		listJs(SRC, []).forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			if(rel === 'utils/globalSetupStore.js'){ return; }
			const t = fs.readFileSync(f, 'utf8');
			if(/(?:safeLocalStorageSet|safeJsonStringifyToStorage|localStorage\.setItem|scheduleStorageWrite)\(\s*(?:Constants\.GlobalSetupKey|GlobalSetupKey|GLOBAL_SETUP_KEY|['"]globalSetup['"])/.test(t)){ offenders.push(rel); }
		});
		expect(offenders).toEqual([]);
	});
});
