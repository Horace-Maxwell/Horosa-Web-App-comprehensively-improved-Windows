// AI 助手·印占校时扫描:在出生时刻前后窗口内逐步采样,按 RP / Pranapada / 边界判据打分,列 Lagna 子主区段与 Top 候选。
// 与印占页「出生时间校正器」同一后端接口(/india/rectify)与同一组参数;只读:结果只供参考,绝不回写档案(采用要用户在页面上亲手点)。
import request from '../../request';
import * as Constants from '../../constants';
import { buildFieldObject } from '../../aiAnalysisContext/recordFields';
import { buildSourceFromArgs } from './castTechnique';
import { GUIDE, SOURCE_SCHEMA } from './_shared';

const v = (x)=>(x === undefined || x === null ? '' : x);
const LORD_FULL = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都' };

// 与印占页校时抽屉同一组条目:步长诊断 / Lagna 子主区段 / Top 候选(总分、RP、Pranapada)/ 星期主提示 / 免责说明
export function rectifyResultText(res, args){
	const L = [`■ 校时扫描(窗口 ±${args.windowMinutes} 分,步长 ${args.stepSeconds} 秒,RP 取法 ${args.rpSource})`];
	const diag = res.resolution;
	if(diag){ L.push(`步长诊断:单步 Lagna 最大位移 ${diag.maxLagnaDeltaDeg}° / KP 最窄 Sub ${diag.narrowestSubDeg}°${diag.adequate ? ' · 充分' : ` · 会整段跳过子主,建议步长 ≤${diag.suggestedStepSeconds}s`}`); }
	const runs = ((res.runs || {}).lagnaSubLord) || [];
	L.push('', `■ Lagna 子主区段(${runs.length} 段)`);
	runs.forEach((r)=>{ L.push(`- ${LORD_FULL[r.value] || r.value || '—'}:${r.fromTime} ~ ${r.toTime}(${r.count} 采样)`); });
	const top = res.top || [];
	L.push('', `■ Top ${top.length} 候选(按判据总分排序)`, '| 名次 | 时刻 | 总分 | RP | Pranapada |', '| --- | --- | --- | --- | --- |');
	top.forEach((t, i)=>{ L.push(`| ${i + 1} | ${t.time || ''} | ${v((t.score || {}).total)} | ${v((t.rp || {}).score)} | ${(t.pranapada || {}).overall || '—'} |`); });
	if(res.vara && res.vara.note){ L.push('', res.vara.note); }
	if(res.disclaimer){ L.push('', res.disclaimer); }
	L.push('', '只读参考:要改出生时间请用户在印占页校时器里亲手「采用」。');
	return L.join('\n');
}

export const rectifyIndiaTool = {
	name: 'rectify_india',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	description: `印占校时扫描:在命盘出生时刻前后窗口内逐步采样,按 RP / Pranapada / 边界判据打分,回 Lagna 子主区段与 Top 候选时刻。与印占页「出生时间校正器」同一计算;只读,不改档案。${GUIDE}:用户怀疑出生时间不准、要校时参考时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['source'],
		properties: {
			source: SOURCE_SCHEMA,
			windowMinutes: { type: 'integer', minimum: 1, maximum: 240, default: 30, description: '出生时刻前后各扫多少分钟' },
			stepSeconds: { type: 'integer', minimum: 1, maximum: 600, default: 60 },
			rpSource: { type: 'string', enum: ['anchor', 'candidate'], default: 'anchor', description: 'anchor = 原始钟表时刻(无自指,缺省)/ candidate = 字面读法' },
		},
	},
	outputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, candidates: { type: 'array', items: { type: 'object' } } } },
	async run(args){
		const built = await buildSourceFromArgs(args.source);
		if(built.error){ return built.error; }
		const record = built.source && built.source.record;
		if(!record || built.source.sourceType === 'case'){ return { ok: false, code: 'E_ARGS_INVALID', message: '校时要一张命盘(record 命盘 cid 或 natal 出生资料)' }; }
		const { resolveIndiaHeadlessParams } = await import('../../../components/astro/IndiaChart');
		const a = { windowMinutes: args.windowMinutes || 30, stepSeconds: args.stepSeconds || 60, rpSource: args.rpSource || 'anchor' };
		const params = resolveIndiaHeadlessParams(buildFieldObject(record), 1);
		let res = null;
		try{
			const data = await request(`${Constants.ServerRoot}/india/rectify`, { body: JSON.stringify({ ...params, rectifyWindowMinutes: a.windowMinutes, rectifyStepSeconds: a.stepSeconds, rectifyRpSource: a.rpSource }), silent: true });
			res = data ? data[Constants.ResultKey] : null;
		}catch(e){ res = null; }
		if(!res || !res.available){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '校时扫描没算出来(需本机计算服务在线)', retryable: true }; }
		const candidates = (res.top || []).map((t)=>({ time: t.time, total: (t.score || {}).total, rp: (t.rp || {}).score, pranapada: (t.pranapada || {}).overall, offsetSeconds: t.offsetSeconds }));
		return { ok: true, data: { content: rectifyResultText(res, a), candidates }, summary: `校时扫描 Top ${candidates.length}` };
	},
};

export default rectifyIndiaTool;
