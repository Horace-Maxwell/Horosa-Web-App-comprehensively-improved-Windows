// AI 助手·占星地图(ACG)取数:命盘的行星线 / 交叉点 / 本地空间 / 地理等价…,可加某地落点分析。只读。
// 请求体、界面层状态与正文都与占星地图页同一份(acgRequestParams / acgSnapshotUiState / buildAcgTextFor);
// 地图设置(线集 / 口径 / 图层)取占星地图页保存的设置。地图类只给数据,不给图。
import request from '../../request';
import * as Constants from '../../constants';
import { buildFieldObject } from '../../aiAnalysisContext/recordFields';
import { resolvePlaceOffline } from '../normalize/place';
import { buildSourceFromArgs } from './castTechnique';
import { GUIDE, SOURCE_SCHEMA } from './_shared';

async function post(path, body){
	const data = await request(`${Constants.ServerRoot}${path}`, { body: JSON.stringify(body), silent: true });
	return data ? data[Constants.ResultKey] : undefined;
}

export const castAcgTool = {
	name: 'cast_acg',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	description: `占星地图(ACG):一张命盘在世界各地的行星线(上升 / 下降 / 中天 / 天底)、线交叉点、本地空间线等,可加某地的落点分析(哪些线经过、离多远)。线集与口径取占星地图页保存的设置;与占星地图页同一份计算与正文。${GUIDE}:用户问「搬到哪里 / 某城市对我怎样 / 我的行星线经过哪」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['source'],
		properties: {
			source: SOURCE_SCHEMA,
			point: { type: 'object', additionalProperties: false, description: '可选:落点分析的地点(place 或经纬度)', properties: {
				place: { type: 'string', maxLength: 80 },
				lat: { type: 'number', minimum: -90, maximum: 90 },
				lon: { type: 'number', minimum: -180, maximum: 180 },
			} },
			orb: { type: 'number', minimum: 0.5, maximum: 10, description: '落点分析容许度(度,缺省取占星地图页设置)' },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
		},
	},
	outputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, point: { type: 'object' } } },
	async run(args){
		const built = await buildSourceFromArgs(args.source);
		if(built.error){ return built.error; }
		const record = built.source && built.source.record;
		if(!record || built.source.sourceType === 'case'){ return { ok: false, code: 'E_ARGS_INVALID', message: '占星地图要一张命盘(record 命盘 cid 或 natal 出生资料),事盘 / 起课时间不适用' }; }
		const acg = await import('../../../components/acg/AstroAcg');
		const st = acg.acgInitialState(acg.ACG_PAGE_SETTINGS.load());
		const fields = buildFieldObject(record);
		const params = acg.acgRequestParams(st, fields);
		let data;
		try{ data = await post('/location/acg', params); }catch(e){ data = undefined; }
		if(!data || !data.planets){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '占星地图没算出来(需本机计算服务在线)', retryable: true }; }
		let pointReport = null;
		let point = null;
		if(args.point){
			let lat = args.point.lat; let lon = args.point.lon; let name = '';
			if(args.point.place){
				const r = await resolvePlaceOffline(args.point.place, {});
				if(!r.resolved){ return { ok: false, code: 'E_PLACE_NOT_FOUND', message: `地名「${args.point.place}」没找到或有歧义` }; }
				lat = Number(r.place.gpsLat); lon = Number(r.place.gpsLon); name = r.place.name;
			}
			if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))){ return { ok: false, code: 'E_ARGS_INVALID', message: 'point 要给 place 或 lat + lon' }; }
			try{ pointReport = await post('/location/acgpoint', { ...params, clickLat: Number(lat), clickLon: Number(lon), orb: args.orb || st.orb, hsys: st.hsys }); }catch(e){ pointReport = null; }
			if(!pointReport){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '落点分析没算出来(需本机计算服务在线)', retryable: true }; }
			point = { lat: Number(lat), lon: Number(lon), ...(name ? { name } : {}) };
		}
		const { buildAcgTextFor } = await import('../../acgSnapshot');
		let content = `${buildAcgTextFor({ data, uiState: acg.acgSnapshotUiState(st, pointReport) }) || ''}`.trim();
		const max = args.maxChars || 12000;
		if(content.length > max){ content = `${content.slice(0, max)}\n…(已截断,调大 maxChars 看全文)`; }
		return { ok: true, data: { content, ...(point ? { point } : {}) }, summary: `占星地图${point ? ` · 落点 ${point.name || `${point.lat},${point.lon}`}` : ''}` };
	},
};

export default castAcgTool;
