// AI 助手·择日方案与最近择时:读各择日页「保存方案 / 载入方案▾ / 最近择时」同一份存储(schemeStore 各流派实例),只读。
// 方案里的条件树可直接作 search_election(天星)/ search_zeri(各流派)的 conditions 复用;保存 / 改名 / 删除留在页面里由用户做。
import { GUIDE } from './_shared';

export const ZERI_SCHEME_SCHOOLS = ['tianxing', 'huangli', 'bazi', 'ziwei', 'liureng', 'taiyi', 'qimen', 'qizheng', 'india', 'sanshi'];
async function storeOf(school){
	const m = await import('../../../divination/zeri/schemeStore');
	if(school === 'tianxing'){ return { listSchemes: m.listSchemes, listHistory: m.listHistory }; }
	return m[`${school}ZeriSchemeStore`] || null;
}
const brief = (cfg)=>{
	const c = cfg && typeof cfg === 'object' ? cfg : {};
	const inner = c.cfg && typeof c.cfg === 'object' ? c.cfg : c;
	const out = {};
	['start', 'end', 'startDate', 'endDate', 'place', 'pos', 'zone', 'gpsLat', 'gpsLon', 'hsys', 'zodiacal', 'siderealAyanamsa'].forEach((k)=>{ if(inner[k] !== undefined && inner[k] !== null && inner[k] !== ''){ out[k] = inner[k]; } });
	return out;
};

export default {
	name: 'list_zeri_schemes',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `列某个择日页用户保存的方案与最近择时(与择日页「载入方案▾ / 最近择时」同一份):方案名、保存时间、条件树、起止与地点等口径摘要。条件树可直接作 search_election(school=tianxing)/ search_zeri 的 conditions 复用;保存 / 改名 / 删除方案请用户在择日页里做。${GUIDE}:用户说「按我上次那个方案再搜一遍」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['school'], properties: {
		school: { type: 'string', enum: ZERI_SCHEME_SCHOOLS, description: 'tianxing = 天星择日;其余 = 各流派择日页' },
		history: { type: 'boolean', default: true, description: '同时列最近择时(搜索历史)' },
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
	} },
	outputSchema: { type: 'object', required: ['schemes'], properties: { schemes: { type: 'array', items: { type: 'object', required: ['id', 'name'] } }, history: { type: 'array' }, school: { type: 'string' } } },
	async run(args){
		const st = await storeOf(args.school);
		if(!st){ return { ok: false, code: 'E_ARGS_INVALID', message: `没有这个择日页的方案存储:${args.school}` }; }
		const limit = args.limit || 20;
		const schemes = (st.listSchemes() || []).slice(0, limit).map((s)=>({ id: s.id, name: s.name, savedAt: s.savedAt, conditions: s.tree || null, calibre: brief(s.config) }));
		const history = args.history === false ? undefined : (st.listHistory() || []).slice(0, limit).map((h)=>({ at: h.at, conditions: h.tree || null, calibre: brief(h.config) }));
		return { ok: true, data: { school: args.school, schemes, ...(history ? { history } : {}) }, summary: `方案 ${schemes.length} 个${history ? ` · 最近择时 ${history.length} 次` : ''}` };
	},
};
