// AI 助手·名人库(「工具 · 数据库」页同一份离线库:Astro-Databank AA / A 级出生资料 5.9 万人 + 维基百科简介):
// 检索 / 分类目录 / 详情 三件只读;按名人出生资料存成命盘一件(只增、可撤销 = 移入回收站;同一名人不重复建:名人库编号或同名同生辰)。
// 存成命盘后即可用 cast_technique 等全部技法工具起盘。引用资料时保留来源(检索与详情回包都带同一份署名)。
import { upsertLocalChart } from '../../localcharts';
import { recordStorePersisted, STORE_SESSION_ONLY_ASSUMPTION } from '../../recordStoreNotice';
import { guardAdditive } from '../guardAdditive';
import { findCelebrityChart, buildCelebrityChartValues } from '../../astrodata/celebrityDedupe';
import { ctxDispatch, GUIDE, aiOriginOf } from './_shared';
import { searchCelebrities, listCelebrityCategories, getCelebrity, CELEBRITY_ATTRIBUTION } from '../../astrodata/celebrityDb';

const RODDEN = ['AA', 'A', 'B', 'C', 'DD', 'X', 'XX'];
const SIGN_ARG = { type: 'string', maxLength: 12, description: '星座:白羊 / Aries / ari 均可' };
const ID_SCHEMA = { type: 'string', pattern: '^adb-\\d+$', maxLength: 20, description: '名人库编号(search_celebrities 回的 id,如 adb-2939)' };

const unavailable = (e)=>({ ok: false, code: 'E_CELEBRITY_DB_UNAVAILABLE', message: `名人库加载不了:${e && e.message ? e.message : e}` });
const argsInvalid = (e)=>(e && e.code === 'E_ARGS_INVALID' ? { ok: false, code: 'E_ARGS_INVALID', message: e.message } : null);

export const searchCelebritiesTool = {
	name: 'search_celebrities',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: {
		type: 'object', required: ['total', 'items', 'attribution'],
		properties: { total: { type: 'integer' }, offset: { type: 'integer' }, limit: { type: 'integer' }, nextOffset: { type: ['integer', 'null'] }, items: { type: 'array', items: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } } } }, attribution: { type: 'string' } },
	},
	description: `检索名人库(Astro-Databank AA / A 级出生资料约 5.9 万人,多数带维基简介):按姓名 / 出生地 / 简介关键词(职业、身份等写进 query 并配 scope=bio,如「物理学家」「演员」)、性别、出生年(段)、Rodden 评级、日月升星座、分类(出生地 / 生日 / 出生年 / 日月升度数,用 list_celebrity_categories 查分类名)筛选,分页返回摘要(编号 / 中英文名 / 出生时间与地点 / 日月升 / 简介摘要)。要出生资料全文用 get_celebrity;要起盘先 create_celebrity_chart 存成命盘。回包带署名,引用时保留来源。首次调用会加载库(1-3 秒)。${GUIDE}:用户问某位名人的星盘、或要找某类名人的样本时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			query: { type: 'string', maxLength: 60, description: '关键词(中英文名 / 出生地 / 简介,包含匹配)' },
			scope: { type: 'string', enum: ['any', 'name', 'bio'], default: 'any', description: 'any=全部字段 / name=只姓名 / bio=只简介' },
			gender: { type: 'string', enum: ['male', 'female'] },
			birthYear: { type: 'integer', minimum: -3000, maximum: 2100 },
			birthYearFrom: { type: 'integer', minimum: -3000, maximum: 2100 },
			birthYearTo: { type: 'integer', minimum: -3000, maximum: 2100 },
			rodden: { type: 'array', maxItems: 7, items: { type: 'string', enum: RODDEN }, description: 'Rodden 评级(AA / A 最可靠)' },
			sun: SIGN_ARG, moon: SIGN_ARG, asc: SIGN_ARG,
			categories: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 120 }, description: '分类全名(取交集;用 list_celebrity_categories 查),如 Birthplace Paris, FR / Sun 23 Pisces / 1879 births' },
			category: { type: 'string', maxLength: 60, description: '分类关键词(中英文子串,命中任一分类即可),如 巴黎 / 3月14日 / Pisces' },
			hasTime: { type: 'boolean', description: 'true = 只要出生时间已知的(才有上升与宫位)' },
			sort: { type: 'string', enum: ['relevance', 'name', 'birth_asc', 'birth_desc'], default: 'relevance' },
			limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
			offset: { type: 'integer', minimum: 0, default: 0 },
		},
	},
	async run(args){
		try{
			const r = await searchCelebrities(args);
			// 署名与详情同一份常量:摘要里已有出生资料与简介片段,同样要带来源
			return { ok: true, data: { ...r, attribution: CELEBRITY_ATTRIBUTION }, message: `名人库命中 ${r.total} 人,本页 ${r.items.length} 人`, summary: `名人库检索 ${r.total} 人` };
		}catch(e){ return argsInvalid(e) || unavailable(e); }
	},
};

export const listCelebrityCategoriesTool = {
	name: 'list_celebrity_categories',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['category', 'count'], properties: { category: { type: 'string' }, zh: { type: 'string' }, count: { type: 'integer' } } } } } },
	description: `名人库的分类目录(出生地 / 生日 / 出生年 / 日月升度数,按人数降序;关键词同时匹配英文分类名与中文译名)。把回包里的 category 原样填进 search_celebrities 的 categories。职业等身份不在分类里,用 search_celebrities 的简介关键词找。${GUIDE}:要按出生地、生日或某个度数找名人样本时先调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: { query: { type: 'string', maxLength: 60, description: '如 巴黎 / Paris / 3月14日 / Pisces 23' }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
	},
	async run(args){
		try{
			const r = await listCelebrityCategories(args);
			return { ok: true, data: r, message: `分类 ${r.items.length} 个`, summary: `名人库分类 ${r.items.length} 个` };
		}catch(e){ return unavailable(e); }
	},
};

export const getCelebrityTool = {
	name: 'get_celebrity',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: { type: 'object', required: ['person', 'attribution'], properties: { person: { type: 'object' }, attribution: { type: 'string' } } },
	description: `读名人库里一个人的全部资料:出生时间 / 时区 / 经纬度 / 出生地 / Rodden 评级与资料来源、日月升位置、中英文简介、亲属与关联人物、生平事件、分类,以及 Astro-Databank 与维基原文链接。给 id(search_celebrities 回的编号),或给 name(中英文名精确匹配;同名多人时回候选)。回包带署名,引用时保留来源。${GUIDE}:用户要看某位名人的出生资料或生平时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: { id: ID_SCHEMA, name: { type: 'string', maxLength: 80, description: '中英文名(精确匹配,不分大小写)' }, maxChars: { type: 'integer', minimum: 200, maximum: 6000, default: 1500, description: '简介截断长度' } },
	},
	async run(args){
		if(!args.id && !args.name){ return { ok: false, code: 'E_ARGS_INVALID', message: '要给 id 或 name 之一' }; }
		let r;
		try{ r = await getCelebrity(args); }catch(e){ return unavailable(e); }
		if(!r.found){
			if(r.candidates.length){ return { ok: false, code: 'E_ARGS_INVALID', message: `同名有 ${r.candidates.length} 人,请用 id 指定`, data: { candidates: r.candidates } }; }
			return { ok: false, code: 'E_CELEBRITY_NOT_FOUND', message: `名人库里没有「${args.id || args.name}」;先用 search_celebrities 查编号` };
		}
		return { ok: true, data: r, message: `${r.person.nameZh || r.person.name}:${r.person.born} ${r.person.pos}(Rodden ${r.person.rodden})`, summary: `名人资料 ${r.person.name}` };
	},
};

export const createCelebrityChartTool = {
	name: 'create_celebrity_chart',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: {
		type: 'object', required: ['cid', 'created', 'duplicate'],
		properties: { cid: { type: 'string' }, created: { type: 'boolean' }, duplicate: { type: 'boolean' }, persisted: { type: 'boolean' }, archived: { type: 'boolean' }, record: { type: 'object' } },
	},
	description: `按名人库里的出生资料(时间 / 时区 / 经纬度 / 出生地 / 性别,原样不改)新建一条命盘档案,分组记「Astrodatabank / Rodden 评级」,备注写明来源;出生时间未知的按正午建档并在备注注明。存好后用回包里的 cid 调 cast_technique 等起盘。同一名人的档案已存在(名人库编号相同,或同名同生辰)→ 直接回已有 cid,不重复建。${GUIDE}:用户要看 / 分析某位名人的盘时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['id'],
		properties: { id: ID_SCHEMA, tags: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 20 }, description: '额外分组标签' } },
	},
	async run(args, ctx){
		let r;
		try{ r = await getCelebrity({ id: args.id, maxChars: 200 }); }catch(e){ return unavailable(e); }
		if(!r.found){ return { ok: false, code: 'E_CELEBRITY_NOT_FOUND', message: `名人库里没有「${args.id}」;先用 search_celebrities 查编号` }; }
		const p = r.person;
		const bd = p.birthData;
		const name = `${p.name}`.trim();
		const dup = findCelebrityChart({ id: p.id || args.id, name, birth: bd.birth });   // 与页面「加入命盘」同一去重键
		if(dup){
			// 已有的那条在归档里:如实说(此前只说「已存在」,用户在默认列表里找不到)
			const archived = dup.archived === true;
			return { ok: true, data: { cid: dup.cid, created: false, duplicate: true, persisted: recordStorePersisted('chart'), ...(archived ? { archived: true } : {}), record: { name: dup.name, birth: dup.birth, zone: dup.zone, pos: dup.pos } }, message: archived ? `该名人的档案「${dup.name}」已存在,在归档里(星盘列表切到「已归档」视图可见),未重复新建` : `已存在该名人的档案「${dup.name}」,未重复新建`, summary: `已有档案 ${dup.name}` };
		}
		// 与名人库页「加入命盘」同一构造(备注来源行 / 分组 / 时辰未知说明 / 新盘缺省设置 + 代次标记)
		const base = {
			name, celebrityId: `${p.id || args.id}`, birth: bd.birth, zone: bd.zone, lat: bd.lat, lon: bd.lon, gpsLat: bd.gpsLat, gpsLon: bd.gpsLon, pos: bd.pos,
			gender: p.gender === '男' ? 1 : p.gender === '女' ? 0 : -1,
			group: ['Astrodatabank', p.rodden || ''].concat(Array.isArray(args.tags) ? args.tags : []).filter(Boolean),
			aiOrigin: aiOriginOf(ctx, 'create_celebrity_chart'),
		};
		const g = guardAdditive('create_celebrity_chart', base);
		if(!g.ok){ return { ok: false, code: g.code, message: '内部守卫拒绝(禁键)' }; }
		const values = buildCelebrityChartValues(base, { rodden: p.rodden, sourceUrl: p.links.astroDatabank, hasTime: bd.hasTime });
		let saved;
		try{ saved = upsertLocalChart(values); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,建档失败' }; }
		const persisted = recordStorePersisted('chart');
		const dispatch = ctxDispatch(ctx);
		try{ if(dispatch){ dispatch({ type: 'user/fetchCharts', payload: {} }); } }catch(e){ /* noop */ }
		return {
			ok: true,
			data: { cid: saved.cid, created: true, duplicate: false, persisted, record: { name: saved.name, birth: saved.birth, zone: saved.zone, pos: saved.pos, gender: saved.gender } },
			message: `已按名人库资料新建命盘「${saved.name}」${saved.birth} ${saved.pos || ''}`,
			summary: `名人建档 ${saved.name}`,
			assumptions: [...(bd.hasTime ? [] : ['出生时辰未知,按正午 12:00 建档']), ...(persisted ? [] : [STORE_SESSION_ONLY_ASSUMPTION])],
			undo: { kind: 'trash-record', payload: { store: 'chart', cid: saved.cid } },
		};
	},
};
