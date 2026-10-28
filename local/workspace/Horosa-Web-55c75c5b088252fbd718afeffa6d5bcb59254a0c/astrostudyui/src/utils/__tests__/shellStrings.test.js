// 桌面壳原生菜单栏 / 原生对话框文案表(Horosa_Desktop_Installer/src-tauri/shell_strings.json):
// 壳里不做简繁转换,繁体一栏由表给出 —— 必须与页面显示层转换器的结果逐字一致(界面「切换繁体」时壳菜单与页面同一写法)。
// 表里新增 / 改了简体时跑一次 UPDATE_SHELL_STRINGS=1 重写繁体一栏(要人看一眼),再提交。
// 另锁:页面在开机与切换简繁时把档位告诉壳(set_shell_script_command)。
import fs from 'fs';
import path from 'path';

const { toHant, isTradFormChar } = require('../scriptConvert/hantConverter');

// horosa_win_shell_const_v1(Windows 侧移植适配):Windows 壳是 Electron,同格式的壳层文案表住在
// desktop_installer_bundle/electron/shell-strings.json(id → { hans, hant });Tauri 表缺席时核它。判据零放宽:繁体栏仍须与转换器逐字一致。
const TAURI_TABLE = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/shell_strings.json');
const TABLE = fs.existsSync(TAURI_TABLE) ? TAURI_TABLE : path.resolve(__dirname, '../../../../../../../desktop_installer_bundle/electron/shell-strings.json');
const SRC = path.resolve(__dirname, '../..');

describe('壳层原生文案表', ()=>{
	it('🔴 每条的繁体 = 页面转换器对简体的转换结果(逐字一致)', ()=>{
		const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
		if(process.env.UPDATE_SHELL_STRINGS === '1'){
			Object.keys(table).forEach((k)=>{ if(!k.startsWith('_')){ table[k].hant = toHant(table[k].hans); } });
			fs.writeFileSync(TABLE, `${JSON.stringify(table, null, '\t')}\n`);
		}
		const ids = Object.keys(table).filter((k)=>!k.startsWith('_'));
		expect(ids.length).toBeGreaterThan(40);
		const bad = ids.filter((k)=>toHant(table[k].hans) !== table[k].hant).map((k)=>`${k}:${table[k].hant} ≠ ${toHant(table[k].hans)}`);
		expect(bad).toEqual([]);
		// 简体一栏不许混进繁体写法(繁体由转换得出,源头只写简体)
		expect(typeof isTradFormChar).toBe('function');
		expect(ids.filter((k)=>Array.from(table[k].hans).some((c)=>isTradFormChar(c)))).toEqual([]);
		expect(Array.from('檢查更新').some((c)=>isTradFormChar(c))).toBe(true);   // 判别力
	});

	it('🔴 页面把界面简繁档告诉壳:开机装一次同步,之后每次切换都报', ()=>{
		const app = fs.readFileSync(path.join(SRC, 'layouts/app.js'), 'utf8');
		expect((app.match(/\binstallShellScriptSync\(\)/g) || []).length).toBe(1);
		const bridge = fs.readFileSync(path.join(SRC, 'utils/shellScriptSync.js'), 'utf8');
		expect(bridge).toMatch(/subscribeScriptMode\(/);
		expect(bridge).toMatch(/desktopSetShellScript\(/);
		const desk = fs.readFileSync(path.join(SRC, 'utils/aiAnalysisDesktop.js'), 'utf8');
		expect(desk).toMatch(/'set_shell_script_command'/);
	});
});

describe('壳层简繁同步(行为)', ()=>{
	beforeEach(()=>{ jest.resetModules(); });
	it('桌面环境:装上即报当前档,切换后再报;同档不重复;非桌面环境零动作', async ()=>{
		const calls = [];
		jest.doMock('../aiAnalysisDesktop', ()=>({ hasTauriInvoke: ()=>true, desktopSetShellScript: (m)=>{ calls.push(m); return Promise.resolve({}); } }));
		const sm = require('../scriptMode');
		sm.__resetScriptModeForTest();
		const hc = require('../scriptConvert/hantConverter');
		sm.__setConverterForTest(hc.toHant, hc.toMatchKey, hc);
		const { installShellScriptSync } = require('../shellScriptSync');
		const off = installShellScriptSync();
		expect(installShellScriptSync()).toBe(off);   // 重复安装是空操作
		expect(calls).toEqual(['hans']);
		await sm.applyScriptMode(sm.SCRIPT_HANT);
		await new Promise((r)=>setTimeout(r, 40));
		expect(calls).toEqual(['hans', 'hant']);
		await sm.applyScriptMode(sm.SCRIPT_HANT);
		await new Promise((r)=>setTimeout(r, 40));
		expect(calls).toEqual(['hans', 'hant']);
		off();
		await sm.applyScriptMode(sm.SCRIPT_HANS);
		await new Promise((r)=>setTimeout(r, 40));
		expect(calls).toEqual(['hans', 'hant']);
		sm.__resetScriptModeForTest();
	});
	it('非桌面环境不装', ()=>{
		const calls = [];
		jest.doMock('../aiAnalysisDesktop', ()=>({ hasTauriInvoke: ()=>false, desktopSetShellScript: (m)=>{ calls.push(m); return Promise.resolve({}); } }));
		const { installShellScriptSync } = require('../shellScriptSync');
		installShellScriptSync()();
		expect(calls).toEqual([]);
	});
});
