// AI 对话·回答审阅(C6;借鉴 Codex / Claude Code /review):优先用**另一家**模型,对照当前挂载的排盘数据检查一条回答,列出批注(错误/夸大/漏项/无据),
// 「按批注重写」生成新回答(原回答保留并标「重写自」)。本文件纯函数:审阅 schema(strict)/ 提示词 / 审阅模型挑选(跨家族优先)/ 解析 / 重写指令。
// 🔴 不得 import 任何生成管线/事实核对模块——确定性问题由调用方注入(deterministicIssues),本模块只负责把它们交给判官与解析结果。
import { getProviderProtocolFamily, parseModelSelection } from './aiAnalysisProviders';

export const REVIEW_MARKER = '【回答审阅】';
export const REVIEW_KINDS = ['error', 'exaggeration', 'omission', 'ungrounded'];
export const REVIEW_KIND_LABELS = { error: '错误', exaggeration: '夸大', omission: '漏项', ungrounded: '无据' };
export const REVIEW_MAX_ISSUES = 12;
export const REVIEW_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['verdict', 'issues', 'summary'],
	properties: {
		verdict: { type: 'string', enum: ['ok', 'issues'] },
		issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'quote', 'reason', 'severity'], properties: {
			kind: { type: 'string', enum: REVIEW_KINDS }, quote: { type: 'string' }, reason: { type: 'string' }, severity: { type: 'integer' },
		} } },
		summary: { type: 'string' },
	},
};

// 审阅 system:挂载数据(复用页面同一 resolved system,**放最前**与对话请求同前缀吃缓存)+ 审阅标记 + 规则 + 程序核对已发现的问题(调用方注入;缺省空)
// [Q-290/M-105·PP-19] 此前规则与「本条回答的确定性问题」在前、挂载数据在后 → 与对话请求不共享前缀,断点前的块每审一条不同回答写一次缓存几乎读不回。
export function buildReviewSystemPrompt({ snapshotSystem, deterministicIssues, hasData }){
	const sys = `${snapshotSystem || ''}`.trim();
	const lines = [];
	if(sys){ lines.push(sys, '', '【以上为排盘数据与规则(与生成时相同);以下为审阅任务】', ''); }
	lines.push(REVIEW_MARKER, '你是命理分析回答的审阅者。对照上面给出的排盘数据审阅一条回答,只指出**实质问题**:',
		'error=与排盘数据矛盾或术数常识错误;exaggeration=结论超出依据(绝对化/宿命化);omission=题目要求但明显漏答的要点;ungrounded=没有依据却当事实说的判断。',
		'每条批注带原句片段(quote,原文逐字 ≤ 60 字)与理由;severity 1-3(3=必须改)。措辞风格、详略不同不算问题。没有问题时 verdict=ok、issues=[]。',
		`只输出一个 JSON:{"verdict":"ok|issues","issues":[{"kind":"error|exaggeration|omission|ungrounded","quote":"…","reason":"…","severity":1-3}],"summary":"一句话总评"}。issues 不超过 ${REVIEW_MAX_ISSUES} 条。`);
	if(!hasData){ lines.push('注意:当前**未挂载排盘数据**,无法对拍事实;只审自洽、夸大与无据,并在 summary 里明写「未对拍数据」。'); }
	const det = Array.isArray(deterministicIssues) ? deterministicIssues.filter(Boolean).slice(0, 20) : [];
	if(det.length){ lines.push('', '【程序核对已发现的问题(必须逐条核实并纳入批注)】', ...det.map((d, i)=>`${i + 1}. ${typeof d === 'string' ? d : (d.text || d.message || JSON.stringify(d))}`)); }
	return lines.join('\n');
}

export function buildReviewUserPrompt({ question, answer }){
	return `【问题】\n${`${question || ''}`.slice(0, 2000)}\n\n【待审阅的回答】\n${`${answer || ''}`.slice(0, 12000)}\n\n请按规则输出 JSON。`;
}

// 审阅模型:路由 review 槽 > 另一家族的档案(优先 anthropic↔openai 互换)> 当前模型
export function pickReviewModel({ routes, providerProfiles, profile, model, chatModelsOf }){
	const r = routes && routes.review ? parseModelSelection(routes.review) : null;
	if(r && r.model){ const p = (providerProfiles || []).find((x)=>x && x.id === r.profileId); if(p){ return { profile: p, model: r.model, crossFamily: getProviderProtocolFamily(p.providerType) !== getProviderProtocolFamily(profile && profile.providerType), via: 'route' }; } }
	const fam = getProviderProtocolFamily(profile && profile.providerType);
	const models = typeof chatModelsOf === 'function' ? chatModelsOf : (p)=>(p.chatModelIds || p.manualModels || []);
	const other = (providerProfiles || []).find((p)=>p && p.enabled !== false && p.id !== (profile && profile.id) && getProviderProtocolFamily(p.providerType) !== fam && (models(p) || []).length);
	if(other){ return { profile: other, model: (models(other) || [])[0], crossFamily: true, via: 'cross-family' }; }
	return { profile, model, crossFamily: false, via: 'same' };
}

export function parseReview(text){
	const s = `${text == null ? '' : text}`.replace(/```(?:json)?/gi, '').trim();
	let obj = null;
	try{ obj = JSON.parse(s); }catch(e){ const i = s.indexOf('{'); const j = s.lastIndexOf('}'); if(i >= 0 && j > i){ try{ obj = JSON.parse(s.slice(i, j + 1)); }catch(e2){ obj = null; } } }
	if(!obj || typeof obj !== 'object'){ return null; }
	const issues = (Array.isArray(obj.issues) ? obj.issues : []).map((it)=>{
		if(!it || typeof it !== 'object'){ return null; }
		const kind = REVIEW_KINDS.indexOf(it.kind) >= 0 ? it.kind : 'ungrounded';
		const sev = Math.max(1, Math.min(3, Math.round(Number(it.severity) || 1)));
		const quote = `${it.quote || ''}`.trim().slice(0, 120); const reason = `${it.reason || ''}`.trim().slice(0, 300);
		return reason ? { kind, quote, reason, severity: sev } : null;
	}).filter(Boolean).slice(0, REVIEW_MAX_ISSUES);
	const verdict = obj.verdict === 'ok' && !issues.length ? 'ok' : (issues.length ? 'issues' : (obj.verdict === 'issues' ? 'issues' : 'ok'));
	return { verdict, issues, summary: `${obj.summary || ''}`.trim().slice(0, 400) };
}

// 重写指令(进 extraSystemContext):逐条批注 + 保持结构;无批注 → ''
export function buildRewriteDirective(review){
	const issues = review && Array.isArray(review.issues) ? review.issues : [];
	if(!issues.length){ return ''; }
	const lines = ['【按审阅重写】保留原回答的结构与语气,但必须改正以下批注(改正后不要提及审阅过程):'];
	issues.forEach((it, i)=>{ lines.push(`${i + 1}. [${REVIEW_KIND_LABELS[it.kind] || it.kind}${it.severity ? `·${it.severity}` : ''}]${it.quote ? `「${it.quote}」` : ''}:${it.reason}`); });
	return lines.join('\n');
}

export function reviewSummaryLine(review){
	if(!review){ return ''; }
	if(review.verdict === 'ok' || !review.issues.length){ return `审阅通过${review.summary ? `:${review.summary}` : ''}`; }
	const counts = {};
	review.issues.forEach((it)=>{ counts[it.kind] = (counts[it.kind] || 0) + 1; });
	return `审阅:${Object.keys(counts).map((k)=>`${REVIEW_KIND_LABELS[k] || k} ${counts[k]}`).join(' · ')}${review.summary ? ` · ${review.summary}` : ''}`;
}
