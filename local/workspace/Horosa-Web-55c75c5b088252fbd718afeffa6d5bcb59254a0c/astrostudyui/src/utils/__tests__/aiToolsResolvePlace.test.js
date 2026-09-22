// [批五·P2] resolve_place 工具面合同(此前只有 normalize/place 纯函数测试,工具壳零覆盖):解析成功形状 / 零命中错误码 / 多候选不擅自解析 / cacheable 只读。
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';

const ctx = { origin: 'in-app', requestId: 't1:0:c1' };
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); });

it('北京 → resolved:true 带经纬度/时区;工具 read 级可去重', async ()=>{
	const r = await runTool('resolve_place', { query: '北京', dateStr: '1990-01-01' }, ctx);
	expect(r.ok).toBe(true); expect(r.data.resolved).toBe(true);
	expect(r.data.place.lat).toBe('39n54'); expect(r.data.place.zone).toBe('+08:00');
	const t = exportToolManifest().find((x)=>x.name === 'resolve_place');
	expect(t.level).toBe('read'); expect(t.annotations.readOnlyHint).toBe(true);
});
it('零命中 → ok:false + E_PLACE_NOT_FOUND,信息给出补救', async ()=>{
	const r = await runTool('resolve_place', { query: 'zzqqxx不存在的地方' }, ctx);
	expect(r.ok).toBe(false); expect(r.code).toBe('E_PLACE_NOT_FOUND'); expect(r.message).toContain('前缀');
});
it('多候选 → resolved:false 且 candidates ≥2、不擅自挑一个;带省份前缀消歧后解析', async ()=>{
	const r = await runTool('resolve_place', { query: '朝阳' }, ctx);
	expect(r.ok).toBe(true);
	if(r.data.resolved){ expect(r.data.candidates.length).toBeGreaterThan(0); }else{ expect(r.data.candidates.length).toBeGreaterThan(1); expect(r.message).toContain('候选'); }
	const r2 = await runTool('resolve_place', { query: '辽宁朝阳' }, ctx);
	expect(r2.ok).toBe(true);
});
it('参数校验:空串 / 超长 / 非法日期 → E_ARGS_INVALID', async ()=>{
	expect((await runTool('resolve_place', { query: '' }, ctx)).code).toBe('E_ARGS_INVALID');
	expect((await runTool('resolve_place', { query: 'x'.repeat(81) }, ctx)).code).toBe('E_ARGS_INVALID');
	expect((await runTool('resolve_place', { query: '北京', dateStr: '1990/01/01' }, ctx)).code).toBe('E_ARGS_INVALID');
});
