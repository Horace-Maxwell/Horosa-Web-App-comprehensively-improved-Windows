// AI 助手·斜杠命令(A3;借鉴 Claude Code / Codex 的 / 命令面板):纯声明 + 纯解析,零副作用、零 import。
// 规则:只有输入框**第一个字符**是 `/` 且第二个字符不是 `/` 才算命令(`//` 与正文中间的 `/` 都不是);命令名到第一个空白为止,其余为参数原文。
// 执行住 components/aianalysis/chat/useChatAssist(runCommand),本文件只回答「有哪些命令、这条输入是不是命令、它需要什么前提、菜单怎么分组」。
// [2026-09-11 补完] 菜单按 group 分组渲染;requires 只表达「挂载前提」,gate 表达「开关前提」(菜单态由调用方传 gates 才判,缺席=不判);
// two-charts 在菜单态(ctx.menu)只要求已挂命盘(此前菜单把 argsText 写死为空 → /合盘 恒置灰);/择日 的参数=择日子技法(见 ZERI_SUBTAB_ALIASES)。
export const COMMAND_REQUIRES = ['chart', 'timepoint', 'two-charts', 'any', 'none'];
export const COMMAND_GATES = ['agent', 'agent+goal', 'orchestrate'];
// 菜单分组顺序(内置三组 + 用户技能一组)
export const COMMAND_GROUPS = ['盘面与分析', '会话', '模型与协作', '技能'];

// kind: builtin(内置,可执行)| skill(技能包,来自组合)——所有内置命令都已实装,不再有「标灰待实装」一类
export const BUILTIN_COMMANDS = [
	// —— 盘面与分析 ——
	{ name: '流年', aliases: ['liunian'], label: '流年', help: '用八字 + 紫微看指定年份(默认今年)', argsHint: '[年份]', requires: 'chart', kind: 'builtin', skill: 'builtin:liunian', group: '盘面与分析' },
	{ name: '合盘', aliases: ['hepan', 'synastry'], label: '合盘', help: '两张命盘合看(写对方名字,或 @ 引用对方命盘)', argsHint: '<对方名字>', requires: 'two-charts', kind: 'builtin', skill: 'builtin:hepan', group: '盘面与分析' },
	{ name: '简报', aliases: ['brief'], label: '简报', help: '当前命盘一页简报', argsHint: '', requires: 'chart', kind: 'builtin', skill: 'builtin:brief', group: '盘面与分析' },
	{ name: '择日', aliases: ['zeri'], label: '择日', help: '转到择日页(可带技法:天星 / 奇门 / 黄历 / 八字 / 太乙 / 紫微 / 六壬 / 三式 / 七政 / 印度)', argsHint: '[技法]', requires: 'none', kind: 'builtin', group: '盘面与分析' },
	// —— 会话 ——
	{ name: 'compact', aliases: ['压缩'], label: '压缩对话', help: '把前面的对话压成一段摘要(可带附加要求)', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: 'fork', aliases: ['分叉'], label: '分叉', help: '从这里分叉一条新会话', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: 'side', aliases: ['旁问'], label: '旁问', help: '临时问一句,不进主线', argsHint: '<问题>', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: 'resume', aliases: ['继续'], label: '继续上次对话', help: '列出最近 5 个对话点一下继续;可开「启动时自动继续上次」', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: 'status', aliases: ['状态'], label: '状态', help: '展开本会话状态(模型/费用/缓存/上下文/压缩摘要)', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: 'init', aliases: ['口径'], label: '生成个人口径', help: '按最近对话生成个人口径草稿', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	{ name: '命主', aliases: ['subject', '工作区'], label: '命主工作区', help: '打开当前命主 / 案例的工作区(对话、记忆、动作、资料)', argsHint: '', requires: 'any', kind: 'builtin', group: '会话' },
	{ name: '任务', aliases: ['tasks', '任务中心'], label: '任务中心', help: '打开任务中心(进行中 / 待办 / 通知;新建目标与定时需开行动能力)', argsHint: '', requires: 'none', kind: 'builtin', group: '会话' },
	// —— 模型与协作 ——
	{ name: '多模型', aliases: ['bestof'], label: '多模型对比', help: '这一问同时发给多个模型', argsHint: '<问题>', requires: 'none', kind: 'builtin', group: '模型与协作' },
	{ name: '审阅', aliases: ['review'], label: '审阅上一条', help: '优先用另一家模型对拍挂载数据审阅上一条回答', argsHint: '', requires: 'none', kind: 'builtin', group: '模型与协作' },
	{ name: '编排', aliases: ['orchestrate'], label: '多技法分工', help: '拆给多个技法并行分析,再综合并标注分歧', argsHint: '<问题>', requires: 'chart', gate: 'orchestrate', kind: 'builtin', group: '模型与协作' },
	{ name: 'profile', aliases: ['方案'], label: '模型方案', help: '切换「按任务用模型」的具名方案(/profile 名字;不带名字=列出;/profile 现状=回到现状)', argsHint: '[名字]', requires: 'none', kind: 'builtin', group: '模型与协作' },
	{ name: 'plan', aliases: ['计划'], label: '先计划再执行', help: '先让 AI 只看工具目录列出行动计划(不执行),你批准后才执行', argsHint: '<目标>', requires: 'none', gate: 'agent', kind: 'builtin', group: '模型与协作' },
	{ name: 'goal', aliases: ['目标'], label: '目标任务', help: '把这句话建成目标任务,由 AI 自己一轮轮做完', argsHint: '<目标>', requires: 'none', gate: 'agent+goal', kind: 'builtin', group: '模型与协作' },
	{ name: 'doctor', aliases: ['诊断'], label: '诊断', help: '一屏看清后端/桌面桥/开关/能力位/MCP/心跳/后台失败(可复制,已脱敏)', argsHint: '', requires: 'none', kind: 'builtin', group: '模型与协作' },
];

// /择日 参数 → 择日子页签键(与 constants/SubTabRegistry.ZERI_SUBTABS 同键集,合同测试锁全等;本模块保持零 import 故手抄)
export const ZERI_SUBTAB_ALIASES = {
	tianxing: ['天星', '天星择日', '西洋', 'tianxing', 'election'],
	qimenzeri: ['奇门', '奇门择日', 'qimen', 'qimenzeri'],
	huanglizeri: ['黄历', '黄历择日', '通书', 'huangli', 'huanglizeri'],
	bazizeri: ['八字', '八字择日', 'bazi', 'bazizeri'],
	taiyizeri: ['太乙', '太乙择日', 'taiyi', 'taiyizeri'],
	ziweizeri: ['紫微', '紫微择日', '紫微斗数', 'ziwei', 'ziweizeri'],
	liurengzeri: ['六壬', '六壬择日', '大六壬', 'liureng', 'liurengzeri'],
	sanshizeri: ['三式', '三式择日', '三式合一', 'sanshi', 'sanshizeri'],
	qizhengzeri: ['七政', '七政择日', '七政四余', 'qizheng', 'qizhengzeri'],
	indiazeri: ['印度', '印度择日', '印占', 'india', 'indiazeri'],
};
export function resolveZeriSubTab(argsText){
	const q = `${argsText || ''}`.trim().toLowerCase();
	if(!q){ return null; }
	const keys = Object.keys(ZERI_SUBTAB_ALIASES);
	for(const k of keys){ if(ZERI_SUBTAB_ALIASES[k].some((a)=>`${a}`.toLowerCase() === q)){ return k; } }
	for(const k of keys){ if(ZERI_SUBTAB_ALIASES[k].some((a)=>q.indexOf(`${a}`.toLowerCase()) === 0)){ return k; } }
	return null;
}

// 解析:{ name, argsText, raw } | null
export function parseSlashInput(text){
	const s = `${text == null ? '' : text}`;
	if(s.length < 2 || s[0] !== '/' || s[1] === '/'){ return null; }
	const body = s.slice(1);
	const m = /^(\S+)([\s\S]*)$/.exec(body);
	if(!m){ return null; }
	const name = m[1].trim();
	if(!name || /[/\\]/.test(name)){ return null; }
	return { name, argsText: `${m[2] || ''}`.trim(), raw: s };
}

export function commandMatches(cmd, name){
	const n = `${name || ''}`.trim().toLowerCase();
	if(!n){ return false; }
	return `${cmd.name}`.toLowerCase() === n || (cmd.aliases || []).some((a)=>`${a}`.toLowerCase() === n);
}

// 前提判定(纯):chart=需一张命盘/事盘;two-charts=当前盘 + 参数里的对方(菜单态 ctx.menu 只要求已挂命盘);timepoint=需时间点(暂按 any);any=有源即可;none=不需要
export function requirementState(requires, ctx){
	const c = ctx || {};
	const hasSource = !!c.activeSource;
	const isChart = !!(c.activeSource && c.activeSource.sourceType === 'chart');
	switch(requires){
	case 'chart': return isChart ? { ok: true } : { ok: false, why: hasSource ? `这条命令需要挂载一张命盘(当前是${c.activeSource.sourceType === 'timepoint' ? '起课时间' : '事盘'})` : '先在顶栏「选择案例」挂载一张命盘' };
	case 'two-charts':
		if(!isChart){ return { ok: false, why: '先挂载第一张命盘,再写对方名字' }; }
		if(c.menu){ return { ok: true }; }
		return c.argsText ? { ok: true } : { ok: false, why: '写上对方的名字,例:/合盘 李四' };
	case 'any': return hasSource ? { ok: true } : { ok: false, why: '先挂载一个案例' };
	case 'timepoint': return { ok: true };
	default: return { ok: true };
	}
}

// 开关前提(纯):gates 缺席=不判(执行侧各自再判);给了才按 gate 表达式判,未开 → 菜单置灰并写明去哪开
// 编排只读不写,执行侧(useChatOrchestrate.run)只认「多技法并行分析」子开关,菜单门与之同口径;子开关在总开关打开后才显示,故提示里带路径
const GATE_WHY = {
	agent: '需先在进阶页打开「AI 助手行动能力」总开关',
	'agent+goal': '需先在进阶页打开「AI 助手行动能力」总开关与「目标任务」子开关',
	orchestrate: '需先在进阶页「行动能力」卡打开「多技法并行分析」子开关(子开关在总开关打开后显示;开好后总开关可关)',
};
export function gateState(gate, gates){
	if(!gate || !gates){ return { ok: true }; }
	const g = gates || {};
	const need = `${gate}`.split('+');
	const ok = need.every((k)=>!!g[k]);
	return ok ? { ok: true } : { ok: false, why: GATE_WHY[gate] || '需先打开对应开关' };
}

// 菜单项:内置 + 技能(技能触发词与内置同名时技能让位=内置优先,避免劫持);按前缀过滤;附可用性;按 COMMAND_GROUPS 分组排序(组内保持登记序)
export function listCommandItems({ prefix, skills, ctx } = {}){
	const p = `${prefix || ''}`.trim().toLowerCase();
	const c = ctx || {};
	const builtinNames = new Set();
	BUILTIN_COMMANDS.forEach((cmd)=>{ builtinNames.add(`${cmd.name}`.toLowerCase()); (cmd.aliases || []).forEach((a)=>builtinNames.add(`${a}`.toLowerCase())); });
	const items = BUILTIN_COMMANDS.map((cmd)=>{
		const st = requirementState(cmd.requires, c);
		const gs = st.ok ? gateState(cmd.gate, c.gates) : { ok: true };
		const ok = st.ok && gs.ok;
		return { ...cmd, group: cmd.group || COMMAND_GROUPS[0], available: ok, why: ok ? '' : (st.ok ? gs.why : st.why) };
	});
	(skills || []).forEach((sk)=>{
		if(!sk || !sk.skill || !Array.isArray(sk.skill.triggers)){ return; }
		sk.skill.triggers.forEach((t)=>{
			const name = `${t || ''}`.replace(/^\//, '').trim();
			if(!name || builtinNames.has(name.toLowerCase())){ return; }
			const st = requirementState(sk.skill.requires || 'any', c);
			items.push({ name, aliases: [], label: sk.name || name, help: sk.skill.description || sk.skill.schoolNote || '技能包', argsHint: (sk.skill.argsSpec || []).map((a)=>`[${a.label || a.name}]`).join(' '), requires: sk.skill.requires || 'any', kind: 'skill', bundleId: sk.id, group: '技能', available: st.ok, why: st.ok ? '' : st.why });
		});
	});
	const rank = (g)=>{ const i = COMMAND_GROUPS.indexOf(g); return i < 0 ? COMMAND_GROUPS.length : i; };
	const ordered = items.map((it, i)=>({ it, i })).sort((a, b)=>(rank(a.it.group) - rank(b.it.group)) || (a.i - b.i)).map((x)=>x.it);
	if(!p){ return ordered; }
	// 有前缀时按命中质量排(名字全等 < 名字前缀 < 别名前缀 < 标签前缀),同质保持组序:此前只按组序,`/re` 回车会执行排在第一组的
	// 别名命中项(report)而不是名字命中的 resume;菜单有前缀时按此扁平序渲染(不分组),键盘 ↑↓ 与视觉一致
	const quality = (it)=>{
		const n = `${it.name}`.toLowerCase();
		if(n === p){ return 0; }
		if(n.indexOf(p) === 0){ return 1; }
		if((it.aliases || []).some((a)=>`${a}`.toLowerCase() === p)){ return 2; }
		if((it.aliases || []).some((a)=>`${a}`.toLowerCase().indexOf(p) === 0)){ return 3; }
		if(`${it.label}`.toLowerCase().indexOf(p) === 0){ return 4; }
		return -1;
	};
	return ordered.map((it, i)=>({ it, i, q: quality(it) })).filter((x)=>x.q >= 0).sort((a, b)=>(a.q - b.q) || (a.i - b.i)).map((x)=>x.it);
}

// 菜单分组视图:[{ group, items }](只含非空组,顺序=COMMAND_GROUPS)
export function groupCommandItems(items){
	const by = new Map();
	(items || []).forEach((it)=>{ const g = it.group || COMMAND_GROUPS[0]; if(!by.has(g)){ by.set(g, []); } by.get(g).push(it); });
	const order = COMMAND_GROUPS.concat(Array.from(by.keys()).filter((g)=>COMMAND_GROUPS.indexOf(g) < 0));
	return order.filter((g)=>by.has(g)).map((g)=>({ group: g, items: by.get(g) }));
}

export function findCommand(name, skills){
	const b = BUILTIN_COMMANDS.find((c)=>commandMatches(c, name));
	if(b){ return { ...b }; }
	const n = `${name || ''}`.trim().toLowerCase();
	for(const sk of (skills || [])){
		if(sk && sk.skill && Array.isArray(sk.skill.triggers) && sk.skill.triggers.some((t)=>`${t || ''}`.replace(/^\//, '').trim().toLowerCase() === n)){
			return { name: n, label: sk.name || n, requires: sk.skill.requires || 'any', kind: 'skill', bundleId: sk.id };
		}
	}
	return null;
}

// 技能触发词与内置命令冲突检测(编辑器保存前用)
export function triggerConflicts(triggers){
	return (triggers || []).map((t)=>`${t || ''}`.replace(/^\//, '').trim()).filter(Boolean).filter((n)=>BUILTIN_COMMANDS.some((c)=>commandMatches(c, n)));
}
