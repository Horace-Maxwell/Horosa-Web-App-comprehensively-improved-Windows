// 只读已存结果的技法(合盘等):清单只标已存档案来源;用临时出生资料起直接说该改用哪件工具;外部信封的 hint 用工具给的那一句
import { externalEnvelope } from '../aiAgent/mcpBridge';
import { pageOnlyTechniqueNote, buildTechniqueRows } from '../aiTools/tools/listTechniques';

it('合盘:清单来源只有 record,备注指向 cast_relative', ()=>{
	const row = buildTechniqueRows().find((r)=>r.key === 'relative');
	expect(row.sources).toEqual(['record']);
	expect(pageOnlyTechniqueNote('relative')).toMatch(/cast_relative/);
	expect(pageOnlyTechniqueNote('astrochart')).toBe('');
});

it('外部信封:工具给了 hint 用工具的,没给回落错误码表的「下一步」', ()=>{
	expect(externalEnvelope({ ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: 'x', hint: '改用 cast_relative' }).hint).toBe('改用 cast_relative');
	const fallback = externalEnvelope({ ok: false, code: 'E_SNAPSHOT_MISSING', message: 'x' }).hint;
	expect(typeof fallback).toBe('string');
	expect(fallback.length).toBeGreaterThan(0);
	expect(externalEnvelope({ ok: true, hint: '不该出现' }).hint).toBeUndefined();
});
