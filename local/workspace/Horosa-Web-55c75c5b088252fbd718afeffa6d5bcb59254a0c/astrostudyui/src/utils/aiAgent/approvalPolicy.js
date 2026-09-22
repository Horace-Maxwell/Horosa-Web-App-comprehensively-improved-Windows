// AI 助手·审批判定(纯函数,零 IO):写入动作在「总档 × 类别档 × 信任档案」下该 自动放行 / 询问用户 / 直接拒绝。
//  · read 级:总档永不作用;只有 query/external/interactive/ui 四个纯读类别的显式类别档起作用(见 D12 注释);
//  · 类别档只能比总档更严(never < on-request < read-only),永远不能把总档放松;
//  · read-only → deny;never → auto;on-request → 命中信任档案且类别∈{workspace,query} 才 auto,否则 ask;
//  · 建档(records)/改设置(settings)/任务(tasks)/外部(external)永远不因信任档案放行。
export const APPROVAL_DECISIONS = ['auto', 'ask', 'deny'];
const MODE_RANK = { never: 0, 'on-request': 1, 'read-only': 2 };
const TRUST_CATEGORIES = ['workspace', 'query'];

export function effectiveApprovalMode(mode, categories, category){
	const base = MODE_RANK[mode] !== undefined ? mode : 'never';
	const c = categories && typeof categories === 'object' ? categories[category] : undefined;
	if(!c || c === 'inherit' || MODE_RANK[c] === undefined){ return base; }
	return MODE_RANK[c] > MODE_RANK[base] ? c : base;
}

export function trustedRecordCid(args){
	if(!args || typeof args !== 'object'){ return null; }
	if(typeof args.cid === 'string' && args.cid){ return args.cid; }
	if(args.source && typeof args.source === 'object' && typeof args.source.cid === 'string' && args.source.cid){ return args.source.cid; }
	return null;
}

export function isTrustedRecordCall(args, trustedRecords){
	const cid = trustedRecordCid(args);
	return !!cid && Array.isArray(trustedRecords) && trustedRecords.indexOf(cid) >= 0;
}

// [批二②] 按工具名策略(toolPolicy={allow,deny}):优先级 deny > read-only(总档/类别档)> allow > 信任档案 > ask。
//   deny 对任何级别生效(只读工具也拒);allow 只把写入类从「询问」变「自动」,永远越不过只读档。
export function isToolDenied(name, toolPolicy){
	return !!(toolPolicy && Array.isArray(toolPolicy.deny) && toolPolicy.deny.indexOf(`${name || ''}`) >= 0);
}
export function isToolAllowed(name, toolPolicy){
	return !!(toolPolicy && Array.isArray(toolPolicy.allow) && toolPolicy.allow.indexOf(`${name || ''}`) >= 0);
}
// [进阶复查 D12·2026-09-08] 读级工具的类别档语义(此前 `level!=='additive'` 直接 auto,面板上 query/external/interactive/ui 四个下拉无消费方):
//   · 总档(never/on-request/read-only)对读级工具永不作用 —— inherit 与总档任何值下读工具全 auto = 此前字节等价;
//   · 只有四个纯读类别的**显式**类别档起作用:on-request ⇒ 每次调用先问(allow 名单 / 会话放行 / 信任 cid 仍免问);
//     read-only ⇒ external(不出网)/ interactive(不反问不报进度)/ ui(不动界面)直拒,query 纯查询无可收之处仍 auto;
//   · 混合类别(records/settings/workspace/tasks)的读工具(describe/get_settings/get_current_context)恒 auto,
//     否则 records:on-request 会让「读工作区」也弹窗、破坏既有矩阵 oracle。桥路径(外部客户端)不认类别档(设计边界)。
export const PURE_READ_CATEGORIES = ['query', 'external', 'interactive', 'ui'];
export const READ_DENY_CATEGORIES = ['external', 'interactive', 'ui'];
export function explicitCategoryMode(categories, category){
	const c = categories && typeof categories === 'object' ? categories[category] : undefined;
	return MODE_RANK[c] !== undefined ? c : 'inherit';
}
// sessionAllow:[P1] 会话内放行判定函数(name → bool),只在「询问」分支生效,永远越不过 deny / 只读档
export function resolveApprovalDecision({ level, def, args, mode, categories, trustedRecords, toolPolicy, sessionAllow }){
	const name = def && def.name ? `${def.name}` : '';
	if(name && isToolDenied(name, toolPolicy)){ return 'deny'; }
	const category = def && def.category ? `${def.category}` : 'query';
	let eff;
	if(level === 'additive'){
		eff = effectiveApprovalMode(mode, categories, category);
	}else{
		if(PURE_READ_CATEGORIES.indexOf(category) < 0){ return 'auto'; }
		const c = explicitCategoryMode(categories, category);
		if(c === 'read-only'){ return READ_DENY_CATEGORIES.indexOf(category) >= 0 ? 'deny' : 'auto'; }
		if(c !== 'on-request'){ return 'auto'; }
		eff = 'on-request';
	}
	if(eff === 'read-only'){ return 'deny'; }
	if(eff === 'never'){ return 'auto'; }
	if(name && isToolAllowed(name, toolPolicy)){ return 'auto'; }
	if(name && typeof sessionAllow === 'function'){ let ok = false; try{ ok = !!sessionAllow(name); }catch(e){ ok = false; } if(ok){ return 'auto'; } }
	if(TRUST_CATEGORIES.indexOf(category) >= 0 && isTrustedRecordCall(args, trustedRecords)){ return 'auto'; }
	return 'ask';
}

// [D24/D27] 读级「询问」在非对话来源(无头 mcp / 目标 / 定时 / 自动规则 / 编排子任务)一律自动放行:这些来源没有人在
// 键盘前(通道缺席或恒 false),此前显式「查询=每次确认」会让无头运行全部读工具 E_APPROVAL_DENIED 而回空心答案、后台任务
// 挂 waiting 直到超时自拒;显式「只读」的 deny(外部不出网/界面不动/反问不弹)对这些来源仍保留。写入类不变。
export function autoAllowReadLevel(origin, level){
	return level === 'read' && `${origin || 'in-app'}` !== 'in-app';
}
