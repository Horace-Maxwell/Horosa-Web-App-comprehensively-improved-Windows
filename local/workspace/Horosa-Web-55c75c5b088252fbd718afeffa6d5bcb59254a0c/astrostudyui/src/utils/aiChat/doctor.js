// [批二⑫] /doctor 诊断(借鉴 Claude Code /doctor):把「后端根 / 桌面桥 / 行动能力门控 / 模型能力位 / 本机 MCP 服务 / 调度心跳 / IndexedDB 计数 / 后台失败(bgSink)」
// 拼成一屏可复制的诊断。纯函数:调用方喂 inputs,这里只归一 + 定级 + 脱敏(密钥/令牌形状一律 ***;baseUrl 只留 origin)。
export const DOCTOR_LEVELS = ['ok', 'warn', 'bad', 'info'];
export const DOCTOR_HEARTBEAT_STALE_MS = 10 * 60 * 1000;
const SECRET_RE = /(sk-[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]{8,}|AIza[0-9A-Za-z_-]{20,}|[A-Za-z0-9_-]{32,})/g;

export function redactSecrets(text){
	return `${text == null ? '' : text}`.replace(SECRET_RE, (m)=>(/^[0-9a-f-]{32,}$/i.test(m) ? m : '***'));
}
export function originOnly(url){
	const s = `${url || ''}`.trim();
	if(!s){ return ''; }
	const m = /^(https?:\/\/[^/?#]+)/i.exec(s);
	return m ? m[1] : redactSecrets(s.split(/[?#]/)[0]).slice(0, 80);
}
function fmtAge(iso, now){
	const t = typeof iso === 'number' ? iso : Date.parse(iso || '');
	if(!Number.isFinite(t) || !t){ return ''; }
	const ms = Math.max(0, (now || Date.now()) - t);
	if(ms < 60000){ return `${Math.round(ms / 1000)} 秒前`; }
	if(ms < 3600000){ return `${Math.round(ms / 60000)} 分钟前`; }
	if(ms < 86400000){ return `${Math.round(ms / 3600000)} 小时前`; }
	return `${Math.round(ms / 86400000)} 天前`;
}
const APPROVAL_TEXT = { never: '全自动(可撤销)', 'on-request': '每次确认', 'read-only': '只读' };

// inputs 全部可缺:缺哪块就出「未知」行,绝不抛
export function buildDoctorReport(inputs){
	const i = inputs || {};
	const now = Number(i.nowMs) > 0 ? Number(i.nowMs) : Date.now();
	const rows = [];
	const push = (key, label, value, level)=>rows.push({ key, label, value: redactSecrets(value), level: DOCTOR_LEVELS.indexOf(level) >= 0 ? level : 'info' });
	// 后端
	const be = i.backend || {};
	push('backend', '后端根', originOnly(be.root) || '未知', be.lastError ? 'bad' : (be.root ? 'ok' : 'warn'));
	if(be.lastError){ push('backendError', '最近一次上游错误', `${be.lastError}`.slice(0, 200), 'bad'); }
	// 桌面桥
	const dk = i.desktop || {};
	push('desktop', '桌面桥', dk.bridge ? '可用(桌面版)' : '不可用(浏览器/预览)', 'info');
	// 模型
	const md = i.model || null;
	push('model', '当前模型', md ? `${md.profileName || '未命名配置'} · ${md.providerType || '?'} · ${md.model || '?'}${md.baseUrl ? ` · ${originOnly(md.baseUrl)}` : ''}` : '未选择', md ? 'ok' : 'bad');
	const caps = i.caps || {};
	push('caps', '工具调用能力位', caps.native === 'native' ? '原生工具调用' : (caps.native === 'text' ? '围栏文本模式(模型不支持原生 tools)' : '未探测'), caps.native === 'text' ? 'warn' : 'info');
	// 行动能力门控
	const ag = i.agent || {};
	push('agent', '行动能力', ag.enabled ? `开 · 审批 ${APPROVAL_TEXT[ag.approval] || ag.approval || '?'}` : '关(只对话不动数据)', ag.enabled && ag.approval === 'never' ? 'warn' : 'info');
	const subs = [['目标任务', ag.goal], ['定时任务', ag.scheduler], ['自动化规则', ag.automation], ['外部工具', ag.external], ['联网检索', ag.webSearch]].filter((x)=>x[1]).map((x)=>x[0]);
	push('subswitches', '子开关(开着的)', subs.length ? subs.join(' · ') : '全关(现状)', 'info');
	const tp = ag.toolPolicy || {};
	if((tp.deny && tp.deny.length) || (tp.allow && tp.allow.length)){ push('toolPolicy', '按工具名策略', `禁用 ${(tp.deny || []).length} · 放行 ${(tp.allow || []).length}`, 'info'); }
	// [P1·2026-09-08] 会话内免问的工具(动作条「本会话不再问」;刷新即清):调用方喂 agent.sessionAllow(数组),这里只归一展示
	const sa = Array.isArray(ag.sessionAllow) ? ag.sessionAllow.filter(Boolean) : [];
	if(sa.length){ push('sessionAllow', '本会话免问的工具', sa.join(' · '), 'info'); }
	// MCP
	const mcp = i.mcp || {};
	push('mcp', '本机 MCP 服务', !mcp.available ? '仅桌面版' : (mcp.running ? `运行中 · ${originOnly(mcp.url) || `端口 ${mcp.port || '?'}`}` : (mcp.enabled ? '已开启但未运行' : '未开启')), mcp.available && mcp.enabled && !mcp.running ? 'warn' : 'info');
	// 心跳
	const hb = i.heartbeat || {};
	const hbT = Number(hb.lastTickAt) > 0 ? Number(hb.lastTickAt) : Date.parse(hb.lastTickAt || '') || 0;
	const stale = hb.schedulerEnabled && (!hbT || now - hbT > DOCTOR_HEARTBEAT_STALE_MS);
	push('heartbeat', '调度心跳', hbT ? fmtAge(hbT, now) : '从未', stale ? 'warn' : 'info');
	// IDB
	const idb = i.idb || {};
	const st = idb.stats || {};
	const statParts = Object.keys(st).filter((k)=>Number.isFinite(st[k])).slice(0, 8).map((k)=>`${k}=${st[k]}`);
	push('idb', 'IndexedDB', `${idb.name ? `${idb.name} · ` : ''}${statParts.length ? statParts.join(' ') : '无计数'}`, 'info');
	// 会话/口径/路由/策略
	const cv = i.conversations || {};
	push('conversations', '对话', `${Number(cv.count) || 0} 个${cv.activeId ? ' · 当前已打开' : ''}`, 'info');
	const ps = i.persona || {};
	const layerN = ps.layers ? (Object.keys(ps.layers.bySubject || {}).length + Object.keys(ps.layers.byTechnique || {}).length) : 0;
	push('persona', '个人口径', ps.enabled ? `注入中${layerN ? ` · 分层 ${layerN} 条` : ''}` : '未注入', 'info');
	const rt = i.routes || {};
	push('routes', '按任务用模型', rt.hasRoutes || rt.hasRouteOptions ? `${rt.hasRoutes ? '已设模型路由' : ''}${rt.hasRoutes && rt.hasRouteOptions ? ' · ' : ''}${rt.hasRouteOptions ? '已设槽思考档' : ''}` : '跟随当前模型', 'info');
	push('contextPolicy', '上下文策略', `${i.contextPolicy || 'legacy'}`, 'info');
	// 后台失败
	const bg = Array.isArray(i.bgFailures) ? i.bgFailures : [];
	push('bgFailures', '后台链失败', bg.length ? `${bg.length} 条;最近:${`${bg[0].tag || ''} ${bg[0].message || ''}`.trim().slice(0, 120)}` : '0 条', bg.length ? 'warn' : 'ok');
	const worst = rows.some((r)=>r.level === 'bad') ? 'bad' : (rows.some((r)=>r.level === 'warn') ? 'warn' : 'ok');
	const text = [`星阙 AI 助手诊断 · ${new Date(now).toISOString()}`].concat(rows.map((r)=>`[${r.level}] ${r.label}:${r.value}`)).join('\n');
	return { rows, worst, text };
}
