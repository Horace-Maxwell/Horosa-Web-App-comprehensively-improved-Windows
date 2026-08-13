// 日课引擎(TP8,轻量拍板版):确定性今日牌 + 本地日志纯函数 + 统计。存储 IO 在组件层(localStorage 单键)。
// 今日牌种子 = `daily|日期|生辰种子|牌组`——同日同人同牌组恒同一张,可复现;跨日自然轮转。
import { CORE78 } from '../decks/core78.js';
import { isTrumpArcana } from './arcana.js'; // [QA-9] 王牌判据单一真值源(零依赖叶子)
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../../utils/safeStorage';

export const DAILY_LOG_KEY = 'horosa.tarot.dailyLog';
export const DAILY_LOG_CAP = 730; // 两年滚动

export function buildDailySeed(dateStr, baseSeed, deckId){
	return `daily|${dateStr}|${baseSeed || 'anon'}|${deckId || 'rws'}`;
}

// 追加/覆盖一条日志(同日同牌组覆盖;超上限裁最旧)。entry={d:'YYYY-MM-DD', deck, sid, rev}
export function appendDailyLog(list, entry, cap){
	const c = cap || DAILY_LOG_CAP;
	const rest = (Array.isArray(list) ? list : []).filter((x) => !(x && x.d === entry.d && x.deck === entry.deck));
	rest.push(entry);
	rest.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
	return rest.length > c ? rest.slice(rest.length - c) : rest;
}

// 统计:元素/花色分布、大牌占比 vs 理论基线(22/78≈28.2%)、最高频三张、正逆比。
export function dailyStats(list){
	const bySid = {};
	CORE78.forEach((c) => { bySid[c.sid] = c; });
	const rows = (Array.isArray(list) ? list : []).filter((x) => x && bySid[x.sid]);
	const total = rows.length;
	const suitCount = { major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0 };
	const freq = {};
	let rev = 0;
	rows.forEach((x) => {
		const c = bySid[x.sid];
		if(isTrumpArcana(c.arcana)){ suitCount.major += 1; } // [QA-9] 认 *_trump:否则该两副的大牌占比恒 0
		else if(suitCount[c.suit] !== undefined){ suitCount[c.suit] += 1; }
		freq[x.sid] = (freq[x.sid] || 0) + 1;
		if(x.rev){ rev += 1; }
	});
	const majorPct = total ? Math.round(1000 * suitCount.major / total) / 10 : 0;
	const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 3)
		.map((sid) => ({ sid, name: bySid[sid].name_cn, count: freq[sid] }));
	return { total, suitCount, majorPct, baselinePct: 28.2, top, reversed: rev };
}

// 读/写 localStorage(单键 JSON;失败静默——日课是增益功能,绝不因存储阻断占牌)。
// 一律走 safeStorage:配额满自愈重试 + 坏档静默清除;绕开它直写 storage 是 [125] 红线。
export function loadDailyLog(){
	const arr = safeJsonParseFromStorage(DAILY_LOG_KEY);
	return Array.isArray(arr) ? arr : [];
}
export function saveDailyLog(list){
	// 失败只回 false 不抛(调用方据此决定是否提示「已记入」,绝不中断占牌)
	return safeJsonStringifyToStorage(DAILY_LOG_KEY, list || []);
}
