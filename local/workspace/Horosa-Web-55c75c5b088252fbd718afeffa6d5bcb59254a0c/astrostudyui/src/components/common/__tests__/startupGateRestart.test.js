import { runStartupRestart, describeStartupRestartOutcome } from '../StartupGate';

// 启动等待页「重启后端」:与横幅 / 状态灯 / 排盘失败弹窗走同一个入口(先轻量重启),
// 启动流程还在进行时如实提示「还在启动,稍候」,不再点了没有任何反应。
const BUSY = '启动/修复/更新流程正在进行,请稍候片刻再试';

describe('启动等待页「重启后端」', () => {
	test('先走轻量重启命令,不直接调全量修复', async () => {
		const calls = [];
		const api = { invoke: jest.fn((cmd) => { calls.push(cmd); return Promise.resolve(); }) };
		const msgs = [];
		const mode = await runStartupRestart(api, (m) => msgs.push(m));
		expect(mode).toBe('light');
		expect(calls).toEqual(['restart_local_services_command']);
		expect(msgs[msgs.length - 1]).toMatch(/已重启本地服务/);
	});

	test('启动流程进行中两条命令都被拒:给出「仍在启动」的明确反馈,不抛', async () => {
		const calls = [];
		const api = { invoke: jest.fn((cmd) => { calls.push(cmd); return Promise.reject(BUSY); }) };
		const msgs = [];
		const mode = await runStartupRestart(api, (m) => msgs.push(m));
		expect(mode).toBeNull();
		expect(calls[0]).toBe('restart_local_services_command');
		expect(msgs).toHaveLength(1);
		expect(msgs[0]).toMatch(/仍在启动中/);
	});

	test('老版本壳没有轻量命令:回退修复并说明', async () => {
		const api = {
			invoke: jest.fn((cmd) => (cmd === 'restart_local_services_command'
				? Promise.reject(new Error('command not found'))
				: Promise.resolve())),
		};
		const msgs = [];
		expect(await runStartupRestart(api, (m) => msgs.push(m))).toBe('full');
		expect(msgs[0]).toMatch(/修复本地组件/);
	});

	test('没有桌面桥 / 其它错误:如实写出原因', async () => {
		const msgs = [];
		expect(await runStartupRestart(null, (m) => msgs.push(m))).toBeNull();
		expect(msgs[0]).toMatch(/重启没有成功/);
		expect(describeStartupRestartOutcome(null, { message: '磁盘已满' })).toMatch(/磁盘已满/);
		// 英文 / 系统原文不进界面
		const raw = describeStartupRestartOutcome(null, { message: 'No such file or directory (os error 2)' });
		expect(raw).not.toMatch(/No such file/);
		expect(raw).toMatch(/原始错误在诊断信息里/);
		expect(describeStartupRestartOutcome(null, '本地服务会话尚未建立(应用可能仍在启动中)')).toMatch(/仍在启动中/);
	});
});
