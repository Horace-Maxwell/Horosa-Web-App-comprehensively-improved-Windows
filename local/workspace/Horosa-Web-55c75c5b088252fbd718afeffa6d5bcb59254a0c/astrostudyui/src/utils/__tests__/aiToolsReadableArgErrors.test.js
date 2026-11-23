// 参数校验报错转成一句中文(字段路径 + 原因);枚举写错时给「是不是要 …」——技法写成中文名按中文名对照,
// 拼写近似按编辑距离;原始报错仍在 data.errors(机器可读不变)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, enumSuggestions } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';
import { ensureNeutralMatcher } from '../scriptNeutralMatch';

const ctx = { origin: 'mcp', requestId: 'p212' };
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); });
afterEach(()=>setAgentEnabled(false));

test('技法写成中文名 → 是不是要 bazi(八字);原始报错仍在 data.errors', async ()=>{
	const r = await runTool('cast_technique', { technique: '八字', source: { kind: 'timepoint' } }, ctx);
	expect(r.code).toBe('E_ARGS_INVALID');
	expect(r.message).toContain('/technique 取值「八字」不在可选范围');
	expect(r.message).toContain('bazi(八字)');
	expect(r.data.errors.join(' ')).toContain('/technique');
	await ensureNeutralMatcher();   // 简繁转换器按需载入(应用里早已载入)
	const trad = await runTool('cast_technique', { technique: '紫微斗數', source: { kind: 'timepoint' } }, ctx);   // 繁体写法同样给中文名对照
	expect(trad.message).toContain('ziwei(');
});

test('拼写近似 → 按编辑距离给候选;缺必填 / 越界写成中文', async ()=>{
	expect(enumSuggestions('ziwie', ['ziwei', 'bazi', 'liureng'])).toEqual(['ziwei']);
	expect(enumSuggestions('ZIWEI', ['ziwei', 'bazi'])).toEqual(['ziwei']);
	expect(enumSuggestions('zzzzzzzz', ['ziwei', 'bazi'])).toEqual([]);
	const r = await runTool('cast_technique', { technique: 'ziwie', source: { kind: 'timepoint' } }, ctx);
	expect(r.message).toContain('是不是要 ziwei');
	const miss = await runTool('cast_technique', { source: { kind: 'timepoint' } }, ctx);
	expect(miss.message).toContain('缺少必填参数 technique');
	const big = await runTool('get_lunar_month', { month: '2026-11', maxChars: 1 }, ctx);
	expect(big.message).toMatch(/maxChars 应 >= 500/);
});
