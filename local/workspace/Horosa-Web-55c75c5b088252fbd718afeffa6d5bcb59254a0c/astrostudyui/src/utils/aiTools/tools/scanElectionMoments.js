// AI 助手·择日盘逐时 / 逐日择优:与择日盘页「本日逐时择优(6–22 点)/ 未来 14 日同时刻」同一候选生成与排名(workflow.rankResults / buildScanRecommendation),
// 每个候选时刻按挂载重算同一个核(runElectionForRecord:宫制 / 流派 / 口径 / 本命合参 / 危象日都与 cast_technique 同口径)起盘判读。只读,不建档。
import { GUIDE, SOURCE_SCHEMA } from './_shared';
import { civilJdnOfDateStr, civilDateStrOfJdn } from '../../dateStrSafe';

export const ELECTION_SCAN_CONCURRENCY = 4;
const pad = (n)=>`${n}`.padStart(2, '0');

// 候选时刻(字符串,与 workflow.generateCandidates 同两种窗):hours = 同日 6..22 整点;days = 起点起 14 日同一时刻
export function electionScanCandidates(baseStr, mode){
	const m = `${baseStr || ''}`.match(/^(-?\d{4,5})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
	if(!m){ return []; }
	const [, y, mo, d, hh, mi, ss] = m;
	const out = [];
	if(mode === 'days'){
		// 民用历加天(全仓护栏:不许交给 JS Date;1582 以前按儒略历、公元前同样成立)
		const jdn0 = civilJdnOfDateStr(`${y}-${mo}-${d}`);
		if(!Number.isFinite(jdn0)){ return []; }
		for(let i = 0; i < 14; i += 1){
			const ds = civilDateStrOfJdn(jdn0 + i);
			const md = ds.slice(-5).replace('-', '/');
			out.push({ time: `${ds} ${hh}:${mi}:${ss || '00'}`, label: `${md} ${hh}:${mi}`, idx: i });
		}
	}else{
		for(let h = 6, i = 0; h <= 22; h += 1, i += 1){ out.push({ time: `${y}-${mo}-${d} ${pad(h)}:00:00`, label: `${pad(h)}:00`, idx: i }); }
	}
	return out;
}

export default {
	name: 'scan_election_moments',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 180000,
	description: `择日盘(西洋择时判读)在一个窗口里逐个候选时刻打分排名:mode=hours = 当日 6–22 点逐时,days = 起点起 14 日同一时刻(与择日盘页两个按钮同口径)。options 与 cast_technique technique=election 同(用事类型 / 流派 / 口径 / 本命合参 natalRecordId / 危象日 crisisDate …)。只读不建档;要看某一刻的完整判读再用 cast_technique。${GUIDE}:用户问「今天几点最好 / 这两周哪天好」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['source'], properties: {
		source: { ...SOURCE_SCHEMA, description: '起点:record = 已存择日事盘(按它的存档口径)/ timepoint = 起课时间与地点(与 cast_technique 同)' },
		mode: { type: 'string', enum: ['hours', 'days'], default: 'hours' },
		options: { type: 'object', additionalProperties: true, description: '与 cast_technique technique=election 的 options 同(describe_settings facet=mount technique=election 看全表)' },
		limit: { type: 'integer', minimum: 1, maximum: 17, default: 5, description: '回前几名' },
	} },
	outputSchema: { type: 'object', required: ['ranked', 'total'], properties: {
		ranked: { type: 'array', items: { type: 'object', required: ['time', 'score'] } }, total: { type: 'integer' }, failed: { type: 'integer' }, recommendation: { type: 'string' }, mode: { type: 'string' },
	} },
	async run(args, ctx){
		const [{ buildSourceFromArgs }, mount, regen, wf] = await Promise.all([import('./castTechnique'), import('../../techniqueMountSettings'), import('../../aiAnalysisContext/regenHoraryElection'), import('../../../divination/election/workflow')]);
		const built = await buildSourceFromArgs(args.source || {});
		if(built.error){ return built.error; }
		const record = (built.source && built.source.record) || {};
		const baseStr = record.divTime || record.birth || '';
		const cands = electionScanCandidates(baseStr, args.mode || 'hours');
		if(!cands.length){ return { ok: false, code: 'E_ARGS_INVALID', message: '起点时刻没取到(record 要有起课时间,或 timepoint 给 divTime)' }; }
		let stored = {};
		try{ const p = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload; stored = p && typeof p === 'object' ? p : {}; }catch(e){ stored = {}; }
		const opts = { ...stored, ...mount.sanitizeOptionsToSchema('election', args.options || {}) };
		const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
		const rows = new Array(cands.length).fill(null);
		let next = 0; let done = 0;
		const worker = async ()=>{
			while(next < cands.length){
				if(ctx && ctx.signal && ctx.signal.aborted){ return; }
				const i = next; next += 1;
				const c = cands[i];
				try{
					const r = await regen.runElectionForRecord({ ...record, birth: c.time, divTime: c.time }, opts);   // eslint-disable-line no-await-in-loop
					const rep = r && r.report;
					if(rep && rep.overall){
						const flags = Array.isArray(rep.hard_flags) ? rep.hard_flags : [];
						rows[i] = { time: c.time, label: c.label, idx: c.idx, score: rep.overall.score, grade: rep.overall.gradeCn,
							crit: flags.filter((x)=>x.severity === 'critical').length, high: flags.filter((x)=>x.severity === 'high').length };
					}
				}catch(e){ rows[i] = null; }
				done += 1;
				if(report){ try{ report(done, cands.length, `已评 ${done}/${cands.length} 个时刻`); }catch(e){ /* noop */ } }
			}
		};
		await Promise.all(Array.from({ length: Math.min(ELECTION_SCAN_CONCURRENCY, cands.length) }, worker));
		if(ctx && ctx.signal && ctx.signal.aborted){ return { ok: false, code: 'E_ABORTED', message: '本次择优扫描已被停止' }; }
		const ranked = wf.rankResults(rows);
		if(!ranked.length){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '候选时刻一个也没排出来(需本机计算服务在线)' }; }
		const limit = args.limit || 5;
		return { ok: true, data: {
			mode: args.mode || 'hours', total: ranked.length, failed: cands.length - ranked.length,
			ranked: ranked.slice(0, limit).map(({ time, score, grade, crit, high })=>({ time, score, grade, crit, high })),
			recommendation: wf.buildScanRecommendation(ranked),
		}, summary: `${args.mode === 'days' ? '14 日' : '当日逐时'}择优:${ranked.length} 个时刻已评,最高 ${ranked[0].score} 分(${ranked[0].time})`,
		...(built.assumptions && built.assumptions.length ? { assumptions: built.assumptions } : {}) };
	},
};
