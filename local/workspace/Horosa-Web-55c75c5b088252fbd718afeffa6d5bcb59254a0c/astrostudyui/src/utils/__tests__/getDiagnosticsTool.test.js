// get_diagnostics:与 /doctor 同一份自检 + 存储体检;只回状态与计数(后台失败只给条数,不回消息原文;不回模型配置)。
jest.mock('../aiAgent/bgSink', ()=>({ listBackgroundFailures: ()=>[{ tag: 'mount', message: '/Users/someone/secret 张三命盘 sk-abcdefghijklmnop' }] }));
import getDiagnostics, { DIAGNOSTIC_ROW_KEYS } from '../aiTools/tools/getDiagnostics';

describe('get_diagnostics', ()=>{
	test('只回登记的状态行;后台失败只给条数', async ()=>{
		const r = await getDiagnostics.run({});
		expect(r.ok).toBe(true);
		const keys = r.data.rows.map((x)=>x.key);
		keys.forEach((k)=>{ expect(DIAGNOSTIC_ROW_KEYS).toContain(k); });
		expect(keys).not.toContain('model');
		const bg = r.data.rows.find((x)=>x.key === 'bgFailures');
		expect(bg.value).toBe('1 条');
		expect(bg.level).toBe('warn');
		expect(JSON.stringify(r.data)).not.toMatch(/secret|张三|sk-/);
	});
	test('存储体检逐项带名称 / 是否通过 / 说明;总评取最差', async ()=>{
		const r = await getDiagnostics.run({});
		expect(r.data.storage.length).toBeGreaterThan(0);
		r.data.storage.forEach((s)=>{ expect(typeof s.name).toBe('string'); expect(typeof s.ok).toBe('boolean'); });
		expect(['ok', 'warn', 'bad']).toContain(r.data.worst);
		expect(r.data.worst).not.toBe('ok');   // 有一条后台失败 → 至少 warn
		expect(r.data.content).toMatch(/^星阙诊断/);
	});
});
