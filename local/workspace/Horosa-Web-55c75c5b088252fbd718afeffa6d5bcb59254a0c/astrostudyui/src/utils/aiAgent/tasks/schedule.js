// AI 助手·定时任务的排期纯函数(P3):零 import,工具(schedule_task)/弹窗/调度器共用同一口径。
// 口径:一律本地钟面(new Date(y,m,d,hh,mm) 构造)——跨夏令时保持钟面不漂;月度日期只许 1..28(29-31 钳到 28,短月不存在的日子不做顺延猜测);
// once 已过期即 null(调用方据此判 E_SCHEDULE_INVALID / 任务 done)。四类任务的提示词模板也在此(纯字符串,无副作用)。
export const SCHEDULE_TYPES = ['daily', 'weekly', 'monthly', 'once'];
export const MONTH_DAY_MAX = 28;
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
export const SCHEDULED_KINDS = ['daily-brief', 'monthly-fortune', 'custom-prompt', 'zeri-reminder'];
export const SCHEDULED_KIND_LABELS = { 'daily-brief': '每日简报', 'monthly-fortune': '每月流年/月运', 'custom-prompt': '自定义提示词', 'zeri-reminder': '择日到期提醒' };

export const MISSED_POLICIES = ['skip', 'catch-up'];
export const DAYS_AHEAD_DEFAULT = 7;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toDate(v){
	if(v instanceof Date){ return Number.isNaN(v.getTime()) ? null : v; }
	if(typeof v === 'number' && Number.isFinite(v)){ return new Date(v); }
	if(typeof v === 'string' && v.trim()){ const d = new Date(v.trim()); return Number.isNaN(d.getTime()) ? null : d; }
	return null;
}
function parseTime(t){ const m = TIME_RE.exec(`${t || ''}`); return m ? { hh: Number(m[1]), mm: Number(m[2]) } : null; }
const pad = (n)=>(n < 10 ? '0' : '') + n;

// 归一:合法 → 只含必要键的新对象;任何不合法 → null(类型外/时间格式坏/weekday 越界/day 越界/once 不可解析)
export function normalizeSchedule(input){
	if(!input || typeof input !== 'object'){ return null; }
	const type = SCHEDULE_TYPES.indexOf(input.type) >= 0 ? input.type : null;
	if(!type){ return null; }
	if(type === 'once'){ const at = toDate(input.at); return at ? { type, at: at.toISOString() } : null; }
	const tm = parseTime(input.time);
	if(!tm){ return null; }
	const time = `${pad(tm.hh)}:${pad(tm.mm)}`;
	if(type === 'daily'){ return { type, time }; }
	if(type === 'weekly'){
		const wd = Number(input.weekday);
		if(!Number.isInteger(wd) || wd < 0 || wd > 6){ return null; }
		return { type, time, weekday: wd };
	}
	const day = Number(input.day);
	if(!Number.isInteger(day) || day < 1 || day > 31){ return null; }
	return { type, time, day: Math.min(day, MONTH_DAY_MAX) };
}

// 下次运行时刻(严格晚于 from,缺省 now);返回 ISO 字符串;无下次(once 已过/排期坏)→ null
export function computeNextRun(schedule, from){
	const s = normalizeSchedule(schedule);
	const base = toDate(from === undefined ? new Date() : from);
	if(!s || !base){ return null; }
	if(s.type === 'once'){ const at = toDate(s.at); return at && at.getTime() > base.getTime() ? at.toISOString() : null; }
	const tm = parseTime(s.time);
	const y = base.getFullYear(); const mo = base.getMonth(); const d = base.getDate();
	if(s.type === 'daily'){
		let c = new Date(y, mo, d, tm.hh, tm.mm, 0, 0);
		if(c.getTime() <= base.getTime()){ c = new Date(y, mo, d + 1, tm.hh, tm.mm, 0, 0); }
		return c.toISOString();
	}
	if(s.type === 'weekly'){
		for(let i = 0; i <= 7; i++){
			const c = new Date(y, mo, d + i, tm.hh, tm.mm, 0, 0);
			if(c.getDay() === s.weekday && c.getTime() > base.getTime()){ return c.toISOString(); }
		}
		return null;
	}
	let c = new Date(y, mo, s.day, tm.hh, tm.mm, 0, 0);
	if(c.getTime() <= base.getTime()){ c = new Date(y, mo + 1, s.day, tm.hh, tm.mm, 0, 0); }
	return c.toISOString();
}

// 到点判定:'wait'(未到)/ 'run'(到点;逾期在两个心跳容差内,或到点之后有过心跳=应用当时开着只是没轮到)
// / 'skip' | 'catch-up'(逾期超容差且期间无心跳=应用当时没开;按任务的 missedPolicy)
export function decideMissed({ nextRunAt, now, intervalMs, missedPolicy, lastTickAt }){
	const due = toDate(nextRunAt); const n = toDate(now === undefined ? new Date() : now);
	if(!due || !n || due.getTime() > n.getTime()){ return 'wait'; }
	const tol = 2 * (Number(intervalMs) > 0 ? Number(intervalMs) : 60000);
	const overdue = n.getTime() - due.getTime();
	const last = toDate(lastTickAt);
	const heartbeatCovered = !!(last && last.getTime() >= due.getTime());
	if(overdue <= tol || heartbeatCovered){ return 'run'; }
	return missedPolicy === 'catch-up' ? 'catch-up' : 'skip';
}

export function describeSchedule(schedule){
	const s = normalizeSchedule(schedule);
	if(!s){ return '排期无效'; }
	if(s.type === 'daily'){ return `每天 ${s.time}`; }
	if(s.type === 'weekly'){ return `每周${WEEKDAY_LABELS[s.weekday]} ${s.time}`; }
	if(s.type === 'monthly'){ return `每月 ${s.day} 日 ${s.time}`; }
	const d = toDate(s.at);
	return `仅一次 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateStamp(now){
	const d = toDate(now === undefined ? new Date() : now) || new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 四类任务的用户消息模板(纯函数;custom-prompt 用用户原文,空则兜底一句)
// [Q-400/M-145] opts.hasSource:到点时挂载源是否真在(sourceCid 空 / 指向已删档案 → false)。无挂载时改用「无命盘·通用天象」文案,
// 不再对着没有案例层的系统提示写「请基于挂载的命盘」(AI 会编一张盘)。缺省(不传)=按旧文案(零回归)。
export function buildScheduledPrompt(spec, now, opts){
	const s = spec && typeof spec === 'object' ? spec : {};
	const d = toDate(now === undefined ? new Date() : now) || new Date();
	const ymd = dateStamp(d);
	const noSource = !!(opts && opts.hasSource === false);
	if(s.kind === 'daily-brief'){
		if(noSource){ return `【每日简报 ${ymd}】本任务未挂载命盘(或所挂档案已删除):请只按今天(${ymd})的通用天象(行星动态、月相、宜与忌)给一页简报,3-6 条要点,每条一句话,不要假设任何个人命盘;末尾一行「以上仅供参考」。`; }
		return `【每日简报 ${ymd}】请基于挂载的命盘与所选技法,给出今天(${ymd})的一页简报:整体状态、宜与忌、需要留意的事,3-6 条要点,每条一句话;末尾一行「以上仅供参考」。`;
	}
	if(s.kind === 'monthly-fortune'){
		if(noSource){ return `【月运 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月】本任务未挂载命盘(或所挂档案已删除):请只按本月(${d.getFullYear()}-${pad(d.getMonth() + 1)})的通用天象走势(行星入座/逆行/朔望/食)分事业/财运/感情/健康各 1-2 条,不要假设任何个人命盘;末尾给出本月最需留意的一件事。`; }
		return `【月运 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月】请基于挂载的命盘与所选技法,分析本月(${d.getFullYear()}-${pad(d.getMonth() + 1)})的走势:事业/财运/感情/健康各 1-2 条并标注依据;末尾给出本月最需留意的一件事。`;
	}
	return `${s.prompt || ''}`.trim() || `【定时提示 ${ymd}】请结合挂载的命盘(若有)给出今天的一句提示。`;
}
