// 快照槽读序(单一来源):本窗口内存里的一份 vs 本机存储里的一份,取哪一份。
// 写槽落盘是延迟的(deferredStorage:空闲时段,最长约 0.8 秒;存储写满时只留内存、一直不落盘),
// 先读存储就会读回上一份,还拿它覆盖内存里的新一份。规则:
//   · 内存那份不比存储旧(createdAt 相同或更新)→ 用内存的;
//   · 存储那份更新(别的窗口刚写过)→ 以存储为准;
//   · 存储是没有时刻的纯文本旧存量 → 内存有值就用内存(本窗口写过的一定更新),否则把纯文本包成旧存量;
//   · 存储为空 / 坏档 → 用内存。
// 所有「自带内存态 + 延迟落盘」的快照槽(模块快照、星盘主快照)都经这一个函数决定读序,不各写一份。
// 本函数是纯函数:不读存储、不写内存,副作用(回写内存)由调用方按返回的 source 做。

import { parseDateTimeMs } from './dateTimeParse';
export function snapshotCreatedAtMs(payload){
	const t = parseDateTimeMs((payload && payload.createdAt) || '');
	return Number.isFinite(t) ? t : 0;
}

function hasContent(p){
	return !!(p && typeof p === 'object' && p.content);
}

// memory:本窗口内存态(对象或 null);raw:存储里的原串(或 null);
// opts.legacy(txt):纯文本旧存量 → 槽对象(缺省 null = 不认纯文本)。
// 返回 { payload, source: 'memory' | 'disk' | 'legacy' | null }。
export function pickFresherSnapshot(memory, raw, opts = {}){
	const mem = hasContent(memory) ? memory : null;
	if(raw === null || raw === undefined || raw === ''){
		return { payload: mem, source: mem ? 'memory' : null };
	}
	let data;
	try{
		data = JSON.parse(raw);
	}catch(parseErr){
		if(mem){
			return { payload: mem, source: 'memory' };
		}
		const txt = `${raw}`.trim();
		const legacy = txt && typeof opts.legacy === 'function' ? opts.legacy(txt) : null;
		return legacy ? { payload: legacy, source: 'legacy' } : { payload: null, source: null };
	}
	if(!hasContent(data)){
		return { payload: mem, source: mem ? 'memory' : null };
	}
	if(mem && snapshotCreatedAtMs(mem) >= snapshotCreatedAtMs(data)){
		return { payload: mem, source: 'memory' };
	}
	return { payload: data, source: 'disk' };
}
