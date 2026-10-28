// 画在网页之外的文字(系统通知横幅、原生窗口标题)随界面简繁:显示层的 DOM / canvas 转换够不着,
// 前端在交给壳之前经 scriptMode.toDisplayScript 转。
//   ① toDisplayScript 行为:简体档 / 转换器未到位原样,繁体档转繁体;
//   ② 交原生文字的壳命令登记表:Rust 里凡带文字型参数(title / body / message / label / text / name …)的 tauri 命令,
//      要么登记为「原生显示」(前端调用点对应字段必须经 toDisplayScript),要么登记为「不是显示」并写理由;新命令不登记即红;
//   ③ 前端调用点:登记为原生显示的命令,每个调用点的对应字段都以 toDisplayScript( 开头。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');
const SHELL_SRC = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/src');

// 原生显示:命令 → 由前端给出、画在网页之外的字段
const NATIVE_TEXT_COMMANDS = {
	show_desktop_notification_command: ['title', 'body'],
};
// 带文字型参数、但不是原生显示的命令(理由)
const NOT_DISPLAY_COMMANDS = {
	agent_tool_progress_command: '进度回给外部智能体(MCP 客户端),不画在本机界面上',
	copy_text_to_clipboard_command: '复制按钮给数据原文(数据层永远简体)',
	shadow_store_write_command: '存储正文',
	auto_backup_write_command: '备份文件名(导出 = 原文)',
	auto_backup_read_command: '读备份的文件名',
	auto_backup_prune_command: '清理备份的文件名列表',
};
const TEXT_PARAM = /title|body|message|label|caption|text|name|desc|prompt/;

function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const p = path.join(dir, n);
		if(fs.statSync(p).isDirectory()){ if(n !== '__tests__' && n !== 'node_modules' && !n.startsWith('.umi')){ walk(p, out); } }
		else if(/\.(js|jsx)$/.test(n)){ out.push(p); }
	});
	return out;
}

// Rust 源里带文字型参数的 tauri 命令(只看产品源,跳过测试件)
function shellTextCommands(){
	const out = {};
	fs.readdirSync(SHELL_SRC).filter((n)=>/\.rs$/.test(n) && !/tests\.rs$/.test(n)).forEach((n)=>{
		const src = fs.readFileSync(path.join(SHELL_SRC, n), 'utf8');
		const re = /#\[tauri::command[^\]]*\]\s*(?:pub(?:\(crate\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)/g;
		let m;
		while((m = re.exec(src))){
			const names = (m[2].match(/(\w+)\s*:/g) || []).map((x)=>x.replace(/\s*:$/, ''));
			const hit = names.filter((x)=>TEXT_PARAM.test(x));
			if(hit.length){ out[m[1]] = hit; }
		}
	});
	return out;
}

// 'cmd' 之后紧跟的对象字面量正文(花括号配平,跳过字符串 / 模板串)
function objectAfter(src, at){
	const open = src.indexOf('{', at);
	if(open < 0 || src.slice(at, open).replace(/[\s,]/g, '') !== ''){ return null; }
	let depth = 0;
	let q = null;
	for(let i = open; i < src.length; i += 1){
		const c = src[i];
		if(q){ if(c === '\\'){ i += 1; }else if(c === q){ q = null; } continue; }
		if(c === '\'' || c === '"' || c === '`'){ q = c; continue; }
		if(c === '{'){ depth += 1; }
		if(c === '}'){ depth -= 1; if(depth === 0){ return src.slice(open + 1, i); } }
	}
	return null;
}

// 对象正文里 field 的值是否以 toDisplayScript( 开头;没写这个字段 → null
function fieldWrapped(body, field){
	const m = new RegExp(`(?:^|[,{\\s])${field}\\s*:\\s*`).exec(body);
	if(!m){ return null; }
	return body.slice(m.index + m[0].length).startsWith('toDisplayScript(');
}

function nativeCallSites(files){
	const sites = [];
	files.forEach((f)=>{
		const src = fs.readFileSync(f, 'utf8');
		Object.keys(NATIVE_TEXT_COMMANDS).forEach((cmd)=>{
			const re = new RegExp(`['"\`]${cmd}['"\`]`, 'g');
			let m;
			while((m = re.exec(src))){
				sites.push({ file: path.relative(SRC, f), cmd, body: objectAfter(src, m.index + m[0].length) });
			}
		});
	});
	return sites;
}

function unwrapped(sites){
	const bad = [];
	sites.forEach(({ file, cmd, body })=>{
		if(body === null){ bad.push(`${file}: ${cmd} 的参数不是对象字面量(没法核字段)`); return; }
		NATIVE_TEXT_COMMANDS[cmd].forEach((field)=>{
			if(fieldWrapped(body, field) === false){ bad.push(`${file}: ${cmd}.${field} 没经 toDisplayScript`); }
		});
	});
	return bad;
}

describe('画在网页之外的文字随界面简繁', ()=>{
	beforeEach(()=>{ jest.resetModules(); });

	it('① toDisplayScript:简体档原样,繁体档转繁体;空值回空串', async ()=>{
		const sm = require('../scriptMode');
		sm.__resetScriptModeForTest();
		const hc = require('../scriptConvert/hantConverter');
		sm.__setConverterForTest(hc.toHant, hc.toMatchKey, hc);
		expect(sm.toDisplayScript('目标任务完成')).toBe('目标任务完成');
		await sm.applyScriptMode(sm.SCRIPT_HANT);
		expect(sm.toDisplayScript('目标任务完成')).toBe('目標任務完成');
		expect(sm.toDisplayScript('打印 · 只影响本页')).toBe('打印 · 只影響本頁');
		expect(sm.toDisplayScript(null)).toBe('');
		expect(sm.toDisplayScript(12)).toBe('12');
		await sm.applyScriptMode(sm.SCRIPT_HANS);
		expect(sm.toDisplayScript('目标任务完成')).toBe('目标任务完成');
		sm.__resetScriptModeForTest();
	});

	it('① 通知横幅:繁体档下交给壳的标题 / 正文是繁体', async ()=>{
		const calls = [];
		window.__TAURI_INTERNALS__ = { invoke: (cmd, args)=>{ calls.push([cmd, args]); return Promise.resolve({ shown: true }); } };
		try{
			const sm = require('../scriptMode');
			sm.__resetScriptModeForTest();
			const hc = require('../scriptConvert/hantConverter');
			sm.__setConverterForTest(hc.toHant, hc.toMatchKey, hc);
			await sm.applyScriptMode(sm.SCRIPT_HANT);
			const desk = require('../aiAnalysisDesktop');
			await desk.desktopShowNotification('定时任务失败', '报告已生成');
			const hit = calls.find(([c])=>c === 'show_desktop_notification_command');
			expect(hit && hit[1]).toEqual({ title: '定時任務失敗', body: '報告已生成' });
			sm.__resetScriptModeForTest();
		}finally{
			delete window.__TAURI_INTERNALS__;
		}
	});

	// horosa_win_shell_layout_v1(Windows 侧移植适配):② 扫 Rust 壳源里 tauri 命令的参数名;Windows 壳(Electron)的命令表没有带类型的参数签名,
	// 只在 Tauri 壳源缺席时跳过这一条(① ③ 照跑:前端交给壳的原生文字照样必须经 toDisplayScript;Electron 壳自己写的字走 shell-strings.json)。
	(fs.existsSync(SHELL_SRC) ? it : it.skip)('② 带文字型参数的壳命令都已登记(原生显示 / 不是显示),登记表不留死条目', ()=>{
		const cmds = shellTextCommands();
		expect(Object.keys(cmds).length).toBeGreaterThanOrEqual(3);   // 防扫描静默失效
		const unknown = Object.keys(cmds).filter((c)=>!NATIVE_TEXT_COMMANDS[c] && !NOT_DISPLAY_COMMANDS[c]).map((c)=>`${c}(${cmds[c].join(', ')})`);
		expect(unknown).toEqual([]);
		const stale = [...Object.keys(NATIVE_TEXT_COMMANDS), ...Object.keys(NOT_DISPLAY_COMMANDS)].filter((c)=>!cmds[c]);
		expect(stale).toEqual([]);
		Object.keys(NATIVE_TEXT_COMMANDS).forEach((c)=>{
			NATIVE_TEXT_COMMANDS[c].forEach((f)=>expect(cmds[c]).toContain(f));
		});
	});

	it('③ 原生显示命令的前端调用点,对应字段都经 toDisplayScript', ()=>{
		const sites = nativeCallSites(walk(SRC, []));
		expect(sites.filter((s)=>s.cmd === 'show_desktop_notification_command').length).toBeGreaterThanOrEqual(1);
		expect(unwrapped(sites)).toEqual([]);
		// 判别力:没包的、参数不是对象字面量的都认得出,包了的放过
		const probe = [
			{ file: 'x', cmd: 'show_desktop_notification_command', body: " title: `${title || ''}`, body: toDisplayScript(body) " },
			{ file: 'y', cmd: 'show_desktop_notification_command', body: null },
			{ file: 'z', cmd: 'show_desktop_notification_command', body: ' title: toDisplayScript(a), body: toDisplayScript(b) ' },
		];
		expect(unwrapped(probe)).toEqual(['x: show_desktop_notification_command.title 没经 toDisplayScript', 'y: show_desktop_notification_command 的参数不是对象字面量(没法核字段)']);
	});
});
