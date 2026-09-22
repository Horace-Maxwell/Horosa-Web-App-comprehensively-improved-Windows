// 「复制信息」诊断文本:基线行 / 失败计数 / 最近条目 / 桥字段 / 构建指纹;空账文案;敏感字段零泄漏。
import { buildBackendDiagText } from '../backendDiagText';

const T0 = new Date(2026, 8, 3, 10, 20, 30).getTime();

function telemetryFixture(){
	return {
		total: 3,
		firstAt: T0,
		lastAt: T0 + 5000,
		counts: { byKind: { unreachable: 2, http5xx: 1 }, byPath: { '/chart': 2, '/predict/pd': 1 } },
		recent: [
			{ at: T0, url: 'http://127.0.0.1:9999/chart', kind: 'unreachable', silent: true, name: 'TypeError', message: 'Failed to fetch Token=SECRET1' },
			{ at: T0 + 2000, url: 'http://127.0.0.1:9999/predict/pd', kind: 'http5xx', silent: false, name: 'Error', message: 'apiKey=SECRET2', status: 502 },
			{ at: T0 + 5000, url: 'http://127.0.0.1:9999/chart', kind: 'unreachable', silent: true, name: 'TypeError', message: 'x' },
		],
	};
}

describe('buildBackendDiagText', ()=>{
	it('基线行 + 失败计数行 + 最近条目(最新在前)+ 桥字段 + 构建指纹', ()=>{
		const txt = buildBackendDiagText({
			online: true,
			latencyMs: 12.4,
			serverRoot: 'http://127.0.0.1:9999',
			serverRootMode: 'verified',
			telemetry: telemetryFixture(),
			bridge: { tauriGlobal: 'undefined', tauriInternals: 'object', eventListenAcl: 'denied:x', userAgent: 'UA' },
			build: { appVersion: '3.10.0', runtimeVersion: '3.10.0-r2', clientVer: '1.0' },
		});
		[
			'== Horosa 后端状态 ==', '状态: 在线', '后端地址: http://127.0.0.1:9999', '地址模式: verified', '延迟: 12 ms',
			'== 请求失败 ==', '失败总数: 3', '首次: 10:20:30', '最近: 10:20:35', 'unreachable: 2', 'http5xx: 1',
			'/chart: 2', '/predict/pd: 1',
			'最近 5 条:', '10:20:35 /chart unreachable TypeError', '10:20:32 /predict/pd http5xx Error',
			'== 桥诊断 ==', 'tauriGlobal: undefined', 'tauriInternals: object', 'eventListenAcl: denied:x', 'userAgent: UA',
			'== 构建指纹 ==', 'appVersion: 3.10.0', 'runtimeVersion: 3.10.0-r2', 'clientVer: 1.0',
		].forEach((s)=>{
			expect(txt).toContain(s);
		});
		const lines = txt.split('\n');
		const idx = lines.findIndex((l)=>l === '最近 5 条:');
		expect(lines[idx + 1]).toBe('  10:20:35 /chart unreachable TypeError');
		expect(lines[idx + 2]).toBe('  10:20:32 /predict/pd http5xx Error');
		expect(lines[idx + 3]).toBe('  10:20:30 /chart unreachable TypeError');
	});

	it('telemetry 空 / null / total 0 → 「最近无请求失败」;离线 / 无延迟 / 无桥 / 无构建各有兜底文案', ()=>{
		[null, undefined, {}, { total: 0, counts: { byKind: {} }, recent: [] }].forEach((t)=>{
			const txt = buildBackendDiagText({ online: false, latencyMs: null, serverRoot: '', serverRootMode: '', telemetry: t, bridge: null, build: null });
			expect(txt).toContain('最近无请求失败');
			expect(txt).toContain('状态: 离线');
			expect(txt).toContain('后端地址: 未配置');
			expect(txt).toContain('地址模式: 未知');
			expect(txt).toContain('延迟: N/A');
			expect(txt).toContain('不可用(非桌面环境或未采集)');
			expect(txt).toContain('== 构建指纹 ==\n  未知');
			expect(txt).not.toContain('失败总数');
		});
		expect(buildBackendDiagText()).toContain('最近无请求失败');
		expect(buildBackendDiagText({ build: 'sha-abc123' })).toContain('== 构建指纹 ==\n  sha-abc123');
	});

	it('绝不出现 Token / apiKey:失败条目不打印 message;桥与构建里的敏感字段名整行丢弃', ()=>{
		const txt = buildBackendDiagText({
			online: true,
			telemetry: telemetryFixture(),
			bridge: { tauriGlobal: 'object', apiKey: 'sk-SECRET3', Token: 't-SECRET4', authorization: 'Bearer SECRET5', userAgent: 'UA' },
			build: { appVersion: '3.10.0', signingKey: 'SECRET6' },
		});
		expect(txt).not.toMatch(/Token|apiKey/);
		['SECRET1', 'SECRET2', 'SECRET3', 'SECRET4', 'SECRET5', 'SECRET6', 'Bearer', 'signingKey', 'Failed to fetch'].forEach((s)=>{
			expect(txt).not.toContain(s);
		});
		expect(txt).toContain('tauriGlobal: object');
		expect(txt).toContain('userAgent: UA');
		expect(txt).toContain('appVersion: 3.10.0');
	});
});
