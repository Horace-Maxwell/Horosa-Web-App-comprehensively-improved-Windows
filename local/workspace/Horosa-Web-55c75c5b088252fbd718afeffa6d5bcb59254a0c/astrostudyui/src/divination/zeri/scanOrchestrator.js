// 扫描编排器:把 [起,止] 按自然月切段顺序请求后端,段界区间无缝拼接。
// 顺序而非并发:后端逐段本就要满算,并发只会挤占本地 CPU;顺序还天然给出进度与可取消点。
import { fetchElectionScan } from '../../services/electionScan';
import { splitByMonth, stitchIntervals } from './intervalOps';

export const MAX_TOTAL_HITS = 1000;
export const MAX_SPAN_DAYS_TOTAL = 1830; // 前端总范围 ≤5 年(后端每段另有 93 天硬限)

function spanDays(startDate, endDate){
	const p = (d)=>{
		const seg = String(d).replace(/-/g, '/').split('/');
		return Date.UTC(Number(seg[0]), Number(seg[1]) - 1, Number(seg[2]));
	};
	return (p(endDate) - p(startDate)) / 86400000;
}

/**
 * runScan({ base, tree, onProgress, signal })
 *  base = { startDate,startTime,endDate,endTime,zone,gpsLat,gpsLon,lat,lon,hsys,zodiacal,ad,precision,口径覆盖... }
 *  tree = compileTree 产物(后端条件树)
 * 返回 { intervals, truncated, stats:{segments, evalPoints} };取消抛 AbortError。
 */
export async function runScan({ base, tree, onProgress, signal }){
	const total = spanDays(base.startDate, base.endDate);
	if(!(total >= 0)){
		throw new Error('时间段无效:结束需晚于开始');
	}
	if(total > MAX_SPAN_DAYS_TOTAL){
		throw new Error(`时间段过长(${Math.round(total)} 天):最长支持 ${MAX_SPAN_DAYS_TOTAL} 天(约 5 年),请缩小范围`);
	}
	const segs = splitByMonth(base.startDate, base.startTime, base.endDate, base.endTime);
	const lists = [];
	let truncated = false;
	let evalPoints = 0;
	let hits = 0;
	for(let i = 0; i < segs.length; i++){
		if(signal && signal.aborted){
			const err = new Error('scan aborted');
			err.name = 'AbortError';
			throw err;
		}
		// _v=响应协议版本盐:区间行结构变更(如 pick/pickEnd 字段)时 bump,
		// 使 kentangCache 旧版响应键失配自然失效(真机实抓:旧缓存行无 pick→起盘/判读
		// 回退到分钟截断 start,恰落征象边界外 0.001°)。
		const body = { ...base, ...segs[i], conditions: tree, _v: 2 };
		delete body.onProgress;
		const rsp = await fetchElectionScan(body, { signal });
		lists.push(rsp.intervals || []);
		hits += (rsp.intervals || []).length;
		evalPoints += (rsp.stats && rsp.stats.evalPoints) || 0;
		if(rsp.truncated){ truncated = true; }
		if(typeof onProgress === 'function'){
			// 流式:每段完成即回传已拼接的部分区间(真机实抓:重叶多段扫描时结果区恒空白,
			// 用户等不到全段完成就判定「搜不出来」——命中必须边扫边上屏)。
			onProgress({ done: i + 1, total: segs.length, hits, partial: stitchIntervals(lists) });
		}
		if(hits >= MAX_TOTAL_HITS){
			truncated = true;
			break;
		}
	}
	return {
		intervals: stitchIntervals(lists),
		truncated,
		stats: { segments: segs.length, evalPoints },
	};
}
