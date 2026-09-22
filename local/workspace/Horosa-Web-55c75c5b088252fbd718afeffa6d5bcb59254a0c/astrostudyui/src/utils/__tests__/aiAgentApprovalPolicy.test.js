// AI 助手·审批判定纯函数合同:三档 × 六类 × 信任档案 表驱动;类别只能比总档更严;建档/改设置永不因信任放行。
import { resolveApprovalDecision, effectiveApprovalMode, isTrustedRecordCall, trustedRecordCid, APPROVAL_DECISIONS } from '../aiAgent/approvalPolicy';
import { AGENT_APPROVAL_MODES, AGENT_APPROVAL_CATEGORIES, AGENT_APPROVAL_CATEGORY_MODES } from '../aiAgent/prefs';

const RANK = { never: 0, 'on-request': 1, 'read-only': 2 };
const TRUST_OK = ['workspace', 'query'];
// 参考实现(独立于被测代码的第二写法):期望值由它算,不从被测函数抄
// [D12] 读级工具:总档永不作用;只有 query/external/interactive/ui 四个纯读类别的显式类别档起作用(on-request 问;read-only 三类拒、query 照常)
const PURE_READ = ['query', 'external', 'interactive', 'ui'];
const READ_DENY = ['external', 'interactive', 'ui'];
function oracle({ level, category, mode, catMode, trustedHit }){
	if(level !== 'additive'){
		if(PURE_READ.indexOf(category) < 0){ return 'auto'; }
		const c = catMode && RANK[catMode] !== undefined ? catMode : 'inherit';
		if(c === 'read-only'){ return READ_DENY.indexOf(category) >= 0 ? 'deny' : 'auto'; }
		if(c !== 'on-request'){ return 'auto'; }
		return trustedHit && TRUST_OK.indexOf(category) >= 0 ? 'auto' : 'ask';
	}
	let eff = mode;
	if(catMode && catMode !== 'inherit' && RANK[catMode] > RANK[mode]){ eff = catMode; }
	if(eff === 'read-only'){ return 'deny'; }
	if(eff === 'never'){ return 'auto'; }
	return trustedHit && TRUST_OK.indexOf(category) >= 0 ? 'auto' : 'ask';
}

describe('审批判定表驱动(3 档 × 4 类别档 × 目录全部类别 × 信任命中/未命中 × read/additive)', ()=>{
	it('全组合与参考实现逐格相等', ()=>{
		let n = 0;
		AGENT_APPROVAL_MODES.forEach((mode)=>{
			AGENT_APPROVAL_CATEGORY_MODES.forEach((catMode)=>{
				AGENT_APPROVAL_CATEGORIES.forEach((category)=>{
					[true, false].forEach((trustedHit)=>{
						['read', 'additive'].forEach((level)=>{
							const args = trustedHit ? { cid: 'local-abc' } : { cid: 'local-zzz' };
							const got = resolveApprovalDecision({ level, def: { category }, args, mode, categories: { [category]: catMode }, trustedRecords: ['local-abc'] });
							const want = oracle({ level, category, mode, catMode, trustedHit });
							expect(`${mode}/${catMode}/${category}/${trustedHit}/${level}=${got}`).toBe(`${mode}/${catMode}/${category}/${trustedHit}/${level}=${want}`);
							expect(APPROVAL_DECISIONS).toContain(got);
							n += 1;
						});
					});
				});
			});
		});
		expect(n).toBe(AGENT_APPROVAL_MODES.length * AGENT_APPROVAL_CATEGORY_MODES.length * AGENT_APPROVAL_CATEGORIES.length * 2 * 2);   // 类别单源=目录(含 interactive),不再写死 6
	});
	it('🔴 类别档只能收紧:总档 on-request + 类别 never → 仍 ask(不能放松);总档 read-only + 类别 never → 仍 deny', ()=>{
		expect(resolveApprovalDecision({ level: 'additive', def: { category: 'records' }, args: {}, mode: 'on-request', categories: { records: 'never' }, trustedRecords: [] })).toBe('ask');
		expect(resolveApprovalDecision({ level: 'additive', def: { category: 'records' }, args: {}, mode: 'read-only', categories: { records: 'never' }, trustedRecords: [] })).toBe('deny');
		expect(effectiveApprovalMode('on-request', { records: 'never' }, 'records')).toBe('on-request');
		expect(effectiveApprovalMode('never', { records: 'read-only' }, 'records')).toBe('read-only');
	});
	it('🔴 信任档案只放行 workspace/query:records/settings/tasks/external 即使命中信任也要问', ()=>{
		['records', 'settings', 'tasks', 'external'].forEach((category)=>{
			expect(resolveApprovalDecision({ level: 'additive', def: { category }, args: { cid: 'local-abc' }, mode: 'on-request', categories: {}, trustedRecords: ['local-abc'] })).toBe('ask');
		});
		expect(resolveApprovalDecision({ level: 'additive', def: { category: 'workspace' }, args: { cid: 'local-abc' }, mode: 'on-request', categories: {}, trustedRecords: ['local-abc'] })).toBe('auto');
		// source.cid 形态(cast_technique/载入类)同样识别;未命中照问
		expect(resolveApprovalDecision({ level: 'additive', def: { category: 'query' }, args: { source: { cid: 'local-abc' } }, mode: 'on-request', categories: {}, trustedRecords: ['local-abc'] })).toBe('auto');
		expect(resolveApprovalDecision({ level: 'additive', def: { category: 'workspace' }, args: { cid: 'local-other' }, mode: 'on-request', categories: {}, trustedRecords: ['local-abc'] })).toBe('ask');
	});
	it('缺省/畸形输入:未知 mode 视为 never;def 无 category 视为 query;read 永远 auto;trusted 非数组不命中', ()=>{
		expect(resolveApprovalDecision({ level: 'additive', def: {}, args: {}, mode: 'bogus', categories: null, trustedRecords: null })).toBe('auto');
		expect(resolveApprovalDecision({ level: 'additive', def: {}, args: { cid: 'local-abc' }, mode: 'on-request', categories: undefined, trustedRecords: 'local-abc' })).toBe('ask');
		expect(resolveApprovalDecision({ level: 'read', def: { category: 'records' }, args: {}, mode: 'read-only', categories: {}, trustedRecords: [] })).toBe('auto');
		expect(isTrustedRecordCall({ cid: 'a' }, ['a'])).toBe(true);
		expect(isTrustedRecordCall({ cid: '' }, [''])).toBe(false);
		expect(trustedRecordCid({ source: { cid: 'x' } })).toBe('x');
		expect(trustedRecordCid(null)).toBe(null);
	});
});

describe('[进阶复查 2026-09-08] D12 读级类别档语义 + P1 会话放行', ()=>{
	const r = (level, category, mode, categories, extra)=>resolveApprovalDecision({ level, def: { name: 't', category }, args: {}, mode, categories, trustedRecords: [], ...(extra || {}) });
	it('🔴 D12 显式 on-request ⇒ ask;显式 read-only ⇒ external/interactive/ui 拒、query 照常;inherit/总档任何值 ⇒ 读工具 auto(字节等价锚);混合类别读工具恒 auto', ()=>{
		// 当前代码为何红(修前):approvalPolicy.js:40 `if(level !== 'additive') return 'auto'` 在读类别档之前短路 → 面板四个下拉零消费方
		expect(r('read', 'external', 'never', { external: 'read-only' })).toBe('deny');
		expect(r('read', 'interactive', 'never', { interactive: 'read-only' })).toBe('deny');
		expect(r('read', 'ui', 'never', { ui: 'read-only' })).toBe('deny');
		expect(r('read', 'query', 'never', { query: 'read-only' })).toBe('auto');
		expect(r('read', 'query', 'never', { query: 'on-request' })).toBe('ask');
		expect(r('read', 'external', 'never', { external: 'on-request' })).toBe('ask');
		expect(r('read', 'ui', 'read-only', { ui: 'on-request' })).toBe('ask');   // 总档只读也不把读工具变拒;显式 on-request 只问
		// 零变化锚:inherit + 总档 on-request / read-only ⇒ 读工具仍 auto
		expect(r('read', 'external', 'on-request', {})).toBe('auto');
		expect(r('read', 'external', 'read-only', { external: 'inherit' })).toBe('auto');
		expect(r('read', 'ui', 'read-only', {})).toBe('auto');
		expect(r('read', 'interactive', 'on-request', null)).toBe('auto');
		// 混合类别的读工具:显式设置也不问不拒
		expect(r('read', 'settings', 'never', { settings: 'on-request' })).toBe('auto');
		expect(r('read', 'records', 'never', { records: 'read-only' })).toBe('auto');
		expect(r('read', 'workspace', 'never', { workspace: 'read-only' })).toBe('auto');
		// allow 名单 / 信任 cid 仍免问;deny 名单永远最先
		expect(r('read', 'query', 'never', { query: 'on-request' }, { toolPolicy: { allow: ['t'], deny: [] } })).toBe('auto');
		expect(resolveApprovalDecision({ level: 'read', def: { name: 't', category: 'query' }, args: { cid: 'local-abc' }, mode: 'never', categories: { query: 'on-request' }, trustedRecords: ['local-abc'] })).toBe('auto');
		expect(r('read', 'query', 'never', {}, { toolPolicy: { allow: [], deny: ['t'] } })).toBe('deny');
		expect(r('read', 'external', 'never', { external: 'on-request' }, { toolPolicy: { allow: [], deny: ['t'] } })).toBe('deny');
	});
	it('🔴 P1 会话放行只影响「询问」分支:ask → auto;deny / 只读档不受影响;判定函数抛错=未放行', ()=>{
		const sessionAllow = (n)=>n === 'probe_add';
		const add = (extra)=>resolveApprovalDecision({ level: 'additive', def: { name: 'probe_add', category: 'records' }, args: {}, mode: 'on-request', categories: {}, trustedRecords: [], ...(extra || {}) });
		expect(add({ sessionAllow })).toBe('auto');
		expect(resolveApprovalDecision({ level: 'additive', def: { name: 'other', category: 'records' }, args: {}, mode: 'on-request', categories: {}, trustedRecords: [], sessionAllow })).toBe('ask');
		expect(add({ mode: 'read-only', sessionAllow })).toBe('deny');
		expect(add({ toolPolicy: { allow: [], deny: ['probe_add'] }, sessionAllow })).toBe('deny');
		expect(add({ sessionAllow: ()=>{ throw new Error('x'); } })).toBe('ask');
		expect(add({})).toBe('ask');
		// 读级 on-request 类别档同样吃会话放行
		expect(resolveApprovalDecision({ level: 'read', def: { name: 'probe_add', category: 'external' }, args: {}, mode: 'never', categories: { external: 'on-request' }, trustedRecords: [], sessionAllow })).toBe('auto');
	});
});

describe('[复查 D24/D27] 读级「询问」在非对话来源自动放行(deny 保留)', ()=>{
	const { autoAllowReadLevel } = require('../aiAgent/approvalPolicy');
	it('来源 × 级别全表:只有 read × 非 in-app 为真', ()=>{
		const origins = ['in-app', 'mcp', 'goal', 'scheduled', 'automation', 'orchestrate', undefined, ''];
		origins.forEach((o)=>{
			const inApp = !o || o === 'in-app';
			expect(autoAllowReadLevel(o, 'read')).toBe(!inApp);
			expect(autoAllowReadLevel(o, 'additive')).toBe(false);
		});
	});
	it('deny 不受影响:external=read-only 下 web_search 在 goal 来源仍是 deny(运行时只把 ask 降 auto)', ()=>{
		const d = resolveApprovalDecision({ level: 'read', def: { name: 'web_search', category: 'external' }, args: {}, mode: 'never', categories: { external: 'read-only' }, trustedRecords: [], toolPolicy: { allow: [], deny: [] }, sessionAllow: ()=>false });
		expect(d).toBe('deny');
		const a = resolveApprovalDecision({ level: 'read', def: { name: 'web_search', category: 'external' }, args: {}, mode: 'never', categories: { external: 'on-request' }, trustedRecords: [], toolPolicy: { allow: [], deny: [] }, sessionAllow: ()=>false });
		expect(a).toBe('ask');
		expect(autoAllowReadLevel('goal', 'read')).toBe(true);
	});
});
