// 斜杠命令(A3)合同:只认首字符 / 且次字符非 /(// 与正文中间的 / 不是命令);命令名到首个空白,其余为参数原文;
// 菜单项=内置+技能(技能触发词撞内置=内置优先);前提判定(无源/事盘/两盘);标灰带原因;别名查找;触发词冲突检测。
// [2026-09-11] 分组(COMMAND_GROUPS)/开关门(gates)/菜单态 two-charts 旁路/新命令(命主·任务)/择日子技法别名表。
import { parseSlashInput, listCommandItems, findCommand, requirementState, triggerConflicts, BUILTIN_COMMANDS, COMMAND_GROUPS, COMMAND_REQUIRES, COMMAND_GATES, groupCommandItems, gateState, resolveZeriSubTab, ZERI_SUBTAB_ALIASES } from '../aiChat/commands';
import { ZERI_SUBTABS } from '../../constants/SubTabRegistry';

const chart = { id: 'local-1', sourceType: 'chart', title: '张三' };
const kase = { id: 'local-2', sourceType: 'case', title: '事盘' };

describe('parseSlashInput', ()=>{
	it('🔴 /流年 2027 → {name:流年,args:2027};// 不是命令;正文中间的 / 不是命令;/ 单独不是;名字带 / 不是', ()=>{
		expect(parseSlashInput('/流年 2027')).toEqual({ name: '流年', argsText: '2027', raw: '/流年 2027' });
		expect(parseSlashInput('/goal 把三个人建档 并起盘')).toEqual({ name: 'goal', argsText: '把三个人建档 并起盘', raw: '/goal 把三个人建档 并起盘' });
		expect(parseSlashInput('//not')).toBe(null);
		expect(parseSlashInput('看看 /流年')).toBe(null);
		expect(parseSlashInput('/')).toBe(null);
		expect(parseSlashInput('/a/b')).toBe(null);
		expect(parseSlashInput('')).toBe(null);
		expect(parseSlashInput(null)).toBe(null);
		expect(parseSlashInput('/简报').argsText).toBe('');
	});
});

describe('listCommandItems / findCommand / requirementState', ()=>{
	it('无源:流年/简报不可用并给出「先挂载命盘」;事盘:流年不可用(当前是事盘);命盘:可用;两盘需参数', ()=>{
		const none = listCommandItems({ ctx: { activeSource: null } });
		const ln = none.find((c)=>c.name === '流年');
		expect(ln.available).toBe(false);
		expect(ln.why).toContain('挂载');
		expect(listCommandItems({ ctx: { activeSource: kase } }).find((c)=>c.name === '流年').why).toContain('事盘');
		expect(listCommandItems({ ctx: { activeSource: chart } }).find((c)=>c.name === '流年').available).toBe(true);
		expect(requirementState('two-charts', { activeSource: chart, argsText: '' }).ok).toBe(false);
		expect(requirementState('two-charts', { activeSource: chart, argsText: '李四' }).ok).toBe(true);
		expect(requirementState('none', {}).ok).toBe(true);
	});
	it('内置命令已无 later 项;需命盘的命令无源时标灰带原因;前缀过滤按名字/别名/标签;findCommand 认别名', ()=>{
		const all = listCommandItems({ ctx: { activeSource: chart } });
		expect(all.every((c)=>c.kind !== 'later')).toBe(true);
		const orch = listCommandItems({ ctx: { activeSource: null } }).find((c)=>c.name === '编排');
		expect(orch.available).toBe(false);
		expect(`${orch.why || ''}`.length).toBeGreaterThan(0);
		expect(all.find((c)=>c.name === 'compact').available).toBe(true);
		expect(listCommandItems({ prefix: '流', ctx: { activeSource: chart } }).map((c)=>c.name)).toEqual(['流年']);
		expect(listCommandItems({ prefix: 'liu', ctx: { activeSource: chart } }).map((c)=>c.name)).toEqual(['流年']);
		// [2026-09-12] 有前缀时按命中质量排:名字前缀(resume)先于别名前缀(review/report),`/re` 回车不会执行别的
		const re = listCommandItems({ prefix: 're', ctx: { activeSource: chart } }).map((c)=>c.name);
		expect(re[0]).toBe('resume');
		expect(re).toContain('审阅');
		expect(listCommandItems({ prefix: 's', ctx: { activeSource: chart } }).map((c)=>c.name)[0]).toBe('side');
		expect(listCommandItems({ prefix: 'status', ctx: { activeSource: chart } }).map((c)=>c.name)[0]).toBe('status');
		expect(listCommandItems({ prefix: '任', ctx: { activeSource: chart } }).map((c)=>c.name)).toEqual(['任务']);
		expect(listCommandItems({ prefix: '命', ctx: { activeSource: chart } }).map((c)=>c.name)).toEqual(['命主']);
		expect(findCommand('任务中心').name).toBe('任务');
		expect(findCommand('工作区').name).toBe('命主');
		expect(findCommand('liunian').name).toBe('流年');
		expect(findCommand('目标').name).toBe('goal');
		expect(findCommand('nope')).toBe(null);
		expect(BUILTIN_COMMANDS.filter((c)=>c.kind === 'builtin').map((c)=>c.name)).toEqual([
			'流年', '合盘', '简报', '择日',
			'compact', 'fork', 'side', 'resume', 'status', 'init', '命主', '任务',
			'多模型', '审阅', '编排', 'profile', 'plan', 'goal', 'doctor',
		]);
	});
	it('🔴 分组:每条命令都有登记过的 group;菜单按 COMMAND_GROUPS 顺序分组且组内保持登记序;首项恒为 流年;技能单独一组排最后', ()=>{
		BUILTIN_COMMANDS.forEach((c)=>expect(COMMAND_GROUPS.indexOf(c.group)).toBeGreaterThanOrEqual(0));
		const skills = [{ id: 'b1', name: '事业', skill: { triggers: ['事业'], requires: 'chart' } }];
		const items = listCommandItems({ skills, ctx: { activeSource: chart } });
		expect(items[0].name).toBe('流年');
		const groups = groupCommandItems(items);
		expect(groups.map((g)=>g.group)).toEqual(['盘面与分析', '会话', '模型与协作', '技能']);
		expect(groups[3].items.map((c)=>c.name)).toEqual(['事业']);
		expect(groups[0].items.map((c)=>c.name)).toEqual(BUILTIN_COMMANDS.filter((c)=>c.group === '盘面与分析').map((c)=>c.name));
	});
	it('🔴 菜单态 two-charts 只要求已挂命盘(/合盘 不再恒灰);执行态仍要求参数;gates 缺席=不判,给了才把 goal/plan/编排 置灰并写明去哪开', ()=>{
		expect(listCommandItems({ ctx: { activeSource: chart, argsText: '', menu: true } }).find((c)=>c.name === '合盘').available).toBe(true);
		expect(listCommandItems({ ctx: { activeSource: chart, argsText: '' } }).find((c)=>c.name === '合盘').available).toBe(false);
		expect(listCommandItems({ ctx: { activeSource: null, menu: true } }).find((c)=>c.name === '合盘').available).toBe(false);
		const noGates = listCommandItems({ ctx: { activeSource: chart } });
		expect(noGates.find((c)=>c.name === 'goal').available).toBe(true);
		expect(noGates.find((c)=>c.name === '编排').available).toBe(true);
		const closed = listCommandItems({ ctx: { activeSource: chart, gates: { agent: false, goal: false, orchestrate: false } } });
		expect(closed.find((c)=>c.name === 'goal').available).toBe(false);
		expect(closed.find((c)=>c.name === 'goal').why).toContain('目标任务');
		expect(closed.find((c)=>c.name === 'plan').why).toContain('行动能力');
		expect(closed.find((c)=>c.name === '编排').why).toContain('多技法并行分析');
		expect(closed.find((c)=>c.name === '多模型').available).toBe(true);
		const half = listCommandItems({ ctx: { activeSource: chart, gates: { agent: true, goal: false, orchestrate: true } } });
		expect(half.find((c)=>c.name === 'plan').available).toBe(true);
		expect(half.find((c)=>c.name === 'goal').available).toBe(false);
		expect(half.find((c)=>c.name === '编排').available).toBe(true);
		// 编排门与执行门同口径(useChatOrchestrate.run 只认子开关):总开关关、子开关开 → 菜单可用
		expect(listCommandItems({ ctx: { activeSource: chart, gates: { agent: false, goal: false, orchestrate: true } } }).find((c)=>c.name === '编排').available).toBe(true);
		// requires / gate 取值都在枚举内(打错字不会变成「永远可用」)
		BUILTIN_COMMANDS.forEach((c)=>{ expect(COMMAND_REQUIRES).toContain(c.requires); if(c.gate){ expect(COMMAND_GATES).toContain(c.gate); } });
		expect(gateState('agent+goal', { agent: true, goal: true }).ok).toBe(true);
		expect(gateState(undefined, { agent: false }).ok).toBe(true);
		// 无源时 requires 先于 gate:编排的 why 说挂载不说开关
		expect(listCommandItems({ ctx: { activeSource: null, gates: { agent: false } } }).find((c)=>c.name === '编排').why).toContain('挂载');
	});
	it('🔴 新命令:命主(需案例)/ 任务(不需前提)在菜单;别名 subject / tasks 可查;/择日 参数 → 子页签键,别名表键集 ≡ ZERI_SUBTABS', ()=>{
		const items = listCommandItems({ ctx: { activeSource: null } });
		expect(items.find((c)=>c.name === '命主').available).toBe(false);
		expect(items.find((c)=>c.name === '任务').available).toBe(true);
		expect(listCommandItems({ ctx: { activeSource: chart } }).find((c)=>c.name === '命主').available).toBe(true);
		expect(findCommand('subject').name).toBe('命主');
		expect(findCommand('tasks').name).toBe('任务');
		expect(Object.keys(ZERI_SUBTAB_ALIASES).sort()).toEqual(ZERI_SUBTABS.slice().sort());
		expect(resolveZeriSubTab('奇门')).toBe('qimenzeri');
		expect(resolveZeriSubTab('天星择日')).toBe('tianxing');
		expect(resolveZeriSubTab('QIMEN')).toBe('qimenzeri');
		expect(resolveZeriSubTab('六壬 搬家')).toBe('liurengzeri');   // 「技法 + 用途」按前缀认技法
		expect(resolveZeriSubTab('')).toBe(null);
		expect(resolveZeriSubTab('开业')).toBe(null);
		expect(BUILTIN_COMMANDS.find((c)=>c.name === '择日').argsHint).toBe('[技法]');
	});
	it('🔴 技能触发词进菜单(kind skill、带 bundleId);与内置同名的技能触发词让位(内置优先);triggerConflicts 抓冲突', ()=>{
		const skills = [
			{ id: 'b1', name: '事业', skill: { triggers: ['事业', '流年'], requires: 'chart', argsSpec: [{ name: 'year', label: '年份' }], description: '看事业' } },
			{ id: 'b2', name: '无触发', skill: { triggers: [] } },
		];
		const items = listCommandItems({ skills, ctx: { activeSource: chart } });
		const sk = items.filter((c)=>c.kind === 'skill');
		expect(sk.map((c)=>c.name)).toEqual(['事业']);
		expect(sk[0].bundleId).toBe('b1');
		expect(sk[0].argsHint).toBe('[年份]');
		expect(items.filter((c)=>c.name === '流年').length).toBe(1);
		expect(findCommand('事业', skills)).toEqual(expect.objectContaining({ kind: 'skill', bundleId: 'b1' }));
		expect(triggerConflicts(['事业', '/流年', 'goal'])).toEqual(['流年', 'goal']);
	});
});

it('🔴 [2026-09-12 复查二] requires=chart 的提示按当前源类型说话:起课时间源不说「当前是事盘」', ()=>{
	expect(requirementState('chart', { activeSource: { sourceType: 'timepoint' } }).why).toContain('起课时间');
	expect(requirementState('chart', { activeSource: { sourceType: 'case' } }).why).toContain('事盘');
	expect(requirementState('chart', {}).why).toContain('挂载一张命盘');
});
