import { resolvePlaceOffline } from '../normalize/place';
import { GUIDE } from './_shared';

export default {
	name: 'resolve_place',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	cacheable: true,
	description: `把用户说的地名解析为经纬度与时区(离线,不联网)。${GUIDE}:仅在用户已明确给出地点、且你准备建档/起盘时调用;返回多个候选时不要自行挑选,把候选列给用户确认。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['query'],
		properties: {
			query: { type: 'string', minLength: 1, maxLength: 80, description: '地名:中文/繁体/拼音/英文,可带省份前缀消歧,如「辽宁朝阳」' },
			dateStr: { type: 'string', pattern: '^-?\\d{1,5}-\\d{2}-\\d{2}$', description: '夏令时判定日期(出生/起课日),缺省今天' },
			limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
		},
	},
	async run(args){
		const r = await resolvePlaceOffline(args.query, { dateStr: args.dateStr, limit: args.limit });
		if(r.code === 'E_PLACE_NOT_FOUND'){
			return { ok: false, code: r.code, message: `未找到地名「${args.query}」;可补国家/省份前缀、改用英文名或拼音,或直接给经纬度(离线库以中国城市与各国主要城市为主)`, data: { candidates: [] } };
		}
		if(!r.resolved){
			return { ok: true, data: { resolved: false, candidates: r.candidates }, message: `「${args.query}」有 ${r.candidates.length} 个候选,请向用户确认是哪一个`, summary: `地名歧义 ${r.candidates.length} 候选` };
		}
		return { ok: true, data: { resolved: true, confidence: r.confidence, place: r.place, candidates: r.candidates }, message: r.confidence === 'medium' ? `按最接近的「${r.place.name}」解析,请向用户复述确认` : `已解析 ${r.place.name}(${r.place.region})`, summary: `地名 ${r.place.name}` };
	},
};
