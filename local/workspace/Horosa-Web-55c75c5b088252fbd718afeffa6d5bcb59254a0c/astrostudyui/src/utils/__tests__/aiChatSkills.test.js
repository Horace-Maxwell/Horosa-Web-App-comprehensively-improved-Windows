// 技能包(A3)合同:归一(触发词去 / 去重 ≤4;requires 回落 any;argsSpec 清洗)· 参数解析(位置参数,末参吃余文,缺省)· 模板渲染({{year}} 今年求值、{{source}}/{{other}},不执行表达式)·
// 口径/输出格式指令 · 导出不含资料正文 · 导入判定(坏 JSON/非技能包/无触发词/同名高版本 replace/不高 skip/无同名 create)· 内置三技能形状。
import { normalizeSkillPack, parseSkillArgs, renderSkillPrompt, buildSkillDirective, exportSkillPack, planSkillImport, bundleFromSkillPack, skillsOf, BUILTIN_SKILLS, SKILL_FILE_FORMAT, SKILL_MAX_SYSTEM_PROMPT, syncSkillTechniqueKeys } from '../aiChat/skills';
import { BUILTIN_COMMANDS, commandMatches, findCommand, listCommandItems, triggerConflicts } from '../aiChat/commands';

describe('normalize / args / render', ()=>{
	it('归一:无 skill → null;触发词去 / 去重截 4;requires 非法回落 any;argsSpec 清洗;版本 ≥1', ()=>{
		expect(normalizeSkillPack({ name: 'x' })).toBe(null);
		const sk = normalizeSkillPack({ skill: { triggers: ['/事业', '事业', ' 财运 ', 'a', 'b', 'c'], requires: 'nope', argsSpec: [{ name: 'ye ar!', label: '年份', default: 2027 }, null, { name: '' }], version: 0 } });
		expect(sk.triggers).toEqual(['事业', '财运', 'a', 'b']);
		expect(sk.requires).toBe('any');
		expect(sk.argsSpec).toEqual([{ name: 'year', label: '年份', default: '2027' }]);
		expect(sk.version).toBe(1);
	});
	it('[Q-329① 裁决 2026-09-18] sections 字段撤除:归一化丢弃(老包带键亦不保留);内置三技能无该键', () => {
		const sk = normalizeSkillPack({ skill: { triggers: ['x'], sections: ['a', 'b'] } });
		expect(Object.prototype.hasOwnProperty.call(sk, 'sections')).toBe(false);
		BUILTIN_SKILLS.forEach((b)=>{ expect(Object.prototype.hasOwnProperty.call(b.skill, 'sections')).toBe(false); });
	});
	it('参数:按顺序切,末参吃剩余全文,缺省兜底;无 argsSpec 时余文进 args', ()=>{
		const spec = [{ name: 'year', default: '今年' }, { name: 'topic', default: '' }];
		expect(parseSkillArgs(spec, '2027 事业 与 财运')).toEqual({ year: '2027', topic: '事业 与 财运' });
		expect(parseSkillArgs(spec, '')).toEqual({ year: '今年', topic: '' });
		expect(parseSkillArgs([], '随便 写')).toEqual({ args: '随便 写' });
	});
	it('🔴 渲染:{{year}} 缺省「今年」求值为当年;{{source}}/{{other}} 取命盘标题;未知占位留空;{{}} 内不执行表达式', ()=>{
		const y = new Date().getFullYear();
		const sk = { promptTemplate: '{{source}} {{year}} {{other}} [{{nope}}] {{1+1}}' };
		expect(renderSkillPrompt(sk, { year: '今年' }, { activeSource: { title: '张三' }, otherSource: { title: '李四' } })).toBe(`张三 ${y} 李四 [] {{1+1}}`);
		expect(renderSkillPrompt(sk, { year: '2027' }, {})).toBe('2027 []  {{1+1}}'.replace('2027 []  {{1+1}}', ' 2027  [] {{1+1}}').trim());
		expect(buildSkillDirective({ schoolNote: '用子平', outputFormat: '要点式' })).toBe('【口径】用子平\n【输出格式】要点式');
		expect(buildSkillDirective({})).toBe('');
	});
});

describe('export / import', ()=>{
	const bundle = { id: 'b1', name: '事业', defaultTechniqueKeys: ['bazi'], defaultSystemPrompt: 'sys', materialIds: ['m1'], skill: { version: 2, triggers: ['事业'], requires: 'chart', promptTemplate: '看{{source}}事业' } };
	it('导出:带格式头,资料只留名单不含正文;导入:坏 JSON/非技能包/缺触发词/缺名字 → 不 ok', ()=>{
		const out = exportSkillPack(bundle, { m1: { id: 'm1', name: '资料一', text: '正文正文' } });
		expect(out.format).toBe(SKILL_FILE_FORMAT);
		expect(out.pack.materials).toEqual([{ id: 'm1', name: '资料一' }]);
		expect(JSON.stringify(out)).not.toContain('正文正文');
		expect(out.pack.skill.version).toBe(2);
		expect(exportSkillPack({ name: 'x' })).toBe(null);
		expect(planSkillImport('{bad', []).ok).toBe(false);
		expect(planSkillImport(JSON.stringify({ format: 'other' }), []).ok).toBe(false);
		expect(planSkillImport(JSON.stringify({ format: SKILL_FILE_FORMAT, pack: { name: 'x', skill: { triggers: [] } } }), []).reason).toContain('触发词');
		expect(planSkillImport(JSON.stringify({ format: SKILL_FILE_FORMAT, pack: { name: '', skill: { triggers: ['a'] } } }), []).reason).toContain('名字');
	});
	it('🔴 导入判定:无同名 create;同名且导入版本更高 replace(带 existing);同名版本不高 skip 并说明;bundleFromSkillPack 生成组合记录', ()=>{
		const text = JSON.stringify(exportSkillPack(bundle, {}));
		expect(planSkillImport(text, []).action).toBe('create');
		const older = { ...bundle, skill: { ...bundle.skill, version: 1 } };
		const p = planSkillImport(text, [older]);
		expect(p.action).toBe('replace');
		expect(p.existing).toBe(older);
		const same = planSkillImport(text, [bundle]);
		expect(same.action).toBe('skip');
		expect(same.reason).toContain('未覆盖');
		const rec = bundleFromSkillPack(p.pack, { id: 'b1', defaultModel: 'm' });
		expect(rec.id).toBe('b1');
		expect(rec.name).toBe('事业');
		expect(rec.skill.version).toBe(2);
		expect(rec.defaultTechniqueKeys).toEqual(['bazi']);
		expect(rec.defaultSystemPrompt).toBe('sys');
		expect(skillsOf([bundle, { id: 'plain', name: '普通组合' }]).map((b)=>b.id)).toEqual(['b1']);
	});
});

describe('内置技能', ()=>{
	it('三件:流年/合盘/简报;触发词与内置命令同名(菜单内置优先);模板非空且含 {{source}};流年含 {{year}} 缺省今年;合盘需两盘', ()=>{
		expect(BUILTIN_SKILLS.map((b)=>b.id)).toEqual(['builtin:liunian', 'builtin:hepan', 'builtin:brief']);
		BUILTIN_SKILLS.forEach((b)=>{
			const sk = normalizeSkillPack(b);
			expect(sk.triggers.length).toBe(1);
			expect(BUILTIN_COMMANDS.some((c)=>commandMatches(c, sk.triggers[0]) && c.skill === b.id)).toBe(true);
			expect(sk.promptTemplate).toContain('{{source}}');
		});
		const ln = normalizeSkillPack(BUILTIN_SKILLS[0]);
		expect(ln.argsSpec[0]).toEqual({ name: 'year', label: '年份', default: '今年' });
		expect(ln.techniqueKeys).toEqual(['bazi', 'ziwei']);
		expect(normalizeSkillPack(BUILTIN_SKILLS[1]).requires).toBe('two-charts');
	});
});

// ---- [压测二轮·D4·J5] 技能包劫持 ----
// 技能包是可以从外部导入的文件:触发词能撞内置命令、defaultSystemPrompt 能塞一整本书、模板占位符能点到原型键。
describe('J5 技能包劫持面', ()=>{
	const packWith = (extra)=>JSON.stringify({ format: SKILL_FILE_FORMAT, version: 1, pack: { name: '外来包', skill: { version: 1, triggers: ['compact', '流年'], requires: 'any', promptTemplate: '看{{source}}' }, ...(extra || {}) } });

	it('🔴 J5a 触发词撞内置命令(compact / 流年)→ planSkillImport 必须回 conflicts 让 UI 拒,不能静默 create', ()=>{
		// 当前代码为何红:skills.js:104-121 的 planSkillImport 只判「同名组合 + 版本」,
		// 完全不看触发词是否撞内置命令 —— 冲突检测另有一份 commands.js:90-92 的 triggerConflicts,
		// 但只在「编辑器保存前」用,导入这条路径从来没接上。
		const p = planSkillImport(packWith(), []);
		expect(triggerConflicts(['compact', '流年'])).toEqual(['compact', '流年']);   // 判别力:检测能力本来就在,只是没接
		expect(Array.isArray(p.conflicts)).toBe(true);
		expect(p.conflicts).toEqual(expect.arrayContaining(['compact', '流年']));
		// 不撞的触发词照常放行且 conflicts 为空
		const clean = planSkillImport(JSON.stringify({ format: SKILL_FILE_FORMAT, version: 1, pack: { name: '干净包', skill: { version: 1, triggers: ['事业运'], promptTemplate: '看{{source}}' } } }), []);
		expect(clean.ok).toBe(true);
		expect(clean.action).toBe('create');
		expect(clean.conflicts || []).toEqual([]);
	});

	it('J5b 判别力:即便技能包硬塞同名触发词,命令解析与菜单仍是内置优先(劫持不成立)', ()=>{
		const sk = { id: 'b-evil', name: '外来包', skill: normalizeSkillPack({ skill: { version: 1, triggers: ['compact', '流年'], promptTemplate: 'x' } }) };
		expect(findCommand('compact', [sk]).kind).toBe('builtin');
		expect(findCommand('流年', [sk]).kind).toBe('builtin');
		expect(listCommandItems({ skills: [sk] }).filter((i)=>i.name === 'compact').length).toBe(1);
		expect(listCommandItems({ skills: [sk] }).filter((i)=>i.kind === 'skill').length).toBe(0);
	});

	it('🔴 J5c defaultSystemPrompt 1MB → 导入/导出都必须封顶 SKILL_MAX_SYSTEM_PROMPT(8000)', ()=>{
		// 当前代码为何红:skills.js 没有 SKILL_MAX_SYSTEM_PROMPT 这个上限常量;
		// bundleFromSkillPack(skills.js:129)`b.defaultSystemPrompt = ${pack.defaultSystemPrompt}` 无截断,
		// exportSkillPack(skills.js:99)同样原样带走 —— 一个技能包就能把每次请求的稳定层撑爆。
		expect(SKILL_MAX_SYSTEM_PROMPT).toBe(8000);
		const huge = '口'.repeat(1000000);
		const rec = bundleFromSkillPack(JSON.parse(packWith({ defaultSystemPrompt: huge })).pack, { id: 'b1' });
		expect(rec.defaultSystemPrompt.length).toBeLessThanOrEqual(SKILL_MAX_SYSTEM_PROMPT);
		const out = exportSkillPack({ id: 'b1', name: 'x', defaultSystemPrompt: huge, skill: { version: 1, triggers: ['a'], promptTemplate: 't' } }, {});
		expect(out.pack.defaultSystemPrompt.length).toBeLessThanOrEqual(SKILL_MAX_SYSTEM_PROMPT);
	});

	it('🔴 J5d 模板占位符不取原型键:{{__proto__}}/{{constructor}}/{{hasOwnProperty}} 一律留空', ()=>{
		// 当前代码为何红:skills.js:69 的替换回调 `vars[k] === undefined || vars[k] === null ? '' : ${vars[k]}`
		// —— vars 是普通对象字面量,vars['constructor'] 走到 Object.prototype 上拿到构造器函数(既非 undefined 也非 null),
		// 于是模板里被渲染成 "function Object() { [native code] }" 之类的原型内容,直接进请求体。
		const sk = { promptTemplate: '[{{__proto__}}][{{constructor}}][{{hasOwnProperty}}][{{toString}}]' };
		expect(renderSkillPrompt(sk, {}, {})).toBe('[][][][]');
		expect(renderSkillPrompt(sk, { year: '2027' }, { activeSource: { title: '张三' } })).toBe('[][][][]');
		// 判别力:真参数照常渲染
		expect(renderSkillPrompt({ promptTemplate: '[{{year}}]' }, { year: '2027' }, {})).toBe('[2027]');
	});
});

// [Q-416 裁决 2026-09-18] 组合弹窗改技法 → 技能包同步(纯)
describe('syncSkillTechniqueKeys [Q-416]', ()=>{
	const pack = { id: 'b1', name: '事业', skill: { version: 2, triggers: ['事业'], requires: 'chart', techniqueKeys: ['bazi'], promptTemplate: 'x' }, skillHistory: [{ at: 't0', skill: { version: 1 } }] };
	test('非技能包 → 零变化', ()=>{ expect(syncSkillTechniqueKeys({ id: 'b0', name: '普通组合' }, ['bazi'])).toEqual({}); });
	test('技法未变 → 零变化(不升版)', ()=>{ expect(syncSkillTechniqueKeys(pack, ['bazi'])).toEqual({}); });
	test('技法变了 → 升版 + 同步写 techniqueKeys + 旧版留档', ()=>{
		const r = syncSkillTechniqueKeys(pack, ['bazi', 'ziwei'], 't1');
		expect(r.skill.version).toBe(3);
		expect(r.skill.techniqueKeys).toEqual(['bazi', 'ziwei']);
		expect(r.skill.triggers).toEqual(['事业']);
		expect(r.skillHistory.length).toBe(2);
		expect(r.skillHistory[1].at).toBe('t1');
		expect(r.skillHistory[1].skill.version).toBe(2);
	});
	test('留档封顶 5', ()=>{
		const big = { ...pack, skillHistory: [1, 2, 3, 4, 5].map((i)=>({ at: `t${i}`, skill: { version: i } })) };
		expect(syncSkillTechniqueKeys(big, [], 'tz').skillHistory.length).toBe(5);
	});
});
