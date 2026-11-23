// 写入类里同参重复调用状态不再变的(星标 / 置顶 / 加标签 / 关联)对外注解报 idempotentHint:true;其余写入类仍是 false。
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); });
afterEach(()=>setAgentEnabled(false));

test('星标 / 置顶 / 加标签 / 关联报幂等;建档仍不幂等;读类恒幂等', ()=>{
	const man = exportToolManifest({ includeDisabled: true });
	const hint = (n)=>{ const t = man.find((x)=>x.name === n); return t && t.annotations ? t.annotations.idempotentHint : undefined; };
	['star_record', 'pin_record', 'add_record_tag', 'link_records'].forEach((n)=>expect(`${n}:${hint(n)}`).toBe(`${n}:true`));
	expect(hint('create_chart_record')).toBe(false);
	expect(hint('list_records')).toBe(true);
});
