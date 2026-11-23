// AI 助手·风水理气起局:与风水页理气工作台同一份计算(computeLiqi)与快照正文(buildSnapshot)。只读、不写记录。
// params 与页面左栏状态同形(缺的取页面初值);嵌套对象(xkDeep / sanheDeep / zr …)按键合并,只给要改的键即可。
// 户型图几何自动检测要页面上画好的户型图,工具不带(阳宅判断其余各项照算)。
import { GUIDE } from './_shared';

export const FENGSHUI_SCHOOLS = ['bazhai', 'xuankong', 'sanhe', 'jinsuo', 'qiankun', 'zibai', 'fuxing', 'jingyin', 'dagua', 'xingshi', 'zeri',
	'liufa', 'mingli', 'luopan', 'daxuankong', 'shuilong', 'huasha', 'zhaiduan'];

// 各派实际读的页面状态键(与 computeLiqi 各分支逐项对应;登记在册的新派直接用自己的 defaults)
export const LIQI_SCHOOL_KEYS = {
	xuankong: ['yun', 'xiangShan', 'year', 'month', 'jian', 'tiVariant', 'xkDeep'],
	sanhe: ['shuiKou', 'waterFlow', 'sanheDeep', 'sands'],
	zibai: ['year', 'month', 'zbDate'],
	qiankun: ['zuoGua', 'waters'],
	bazhai: ['zuoGua', 'ming', 'zhaiMode', 'bazhaiDeep', 'yun'],
	jinsuo: ['sectors', 'jsDeep', 'jsShans', 'jsXings'],
	fuxing: ['fx', 'fxWaters'],
	jingyin: ['jy'],
	dagua: ['dg', 'yun', 'year'],
	xingshi: ['xs'],
	zeri: ['zr'],
	liufa: ['lf'],
	mingli: ['ml'],
	luopan: ['lp'],
};

const isPlain = (v)=>!!v && typeof v === 'object' && !Array.isArray(v);

// 页面初值 + 调用方参数:顶层逐键覆盖,两边都是对象的再按键合并一层。返回未知键供提示。
export function mergeLiqiState(defaults, params){
	const S = { ...defaults };
	const unknown = [];
	Object.keys(params || {}).forEach((k)=>{
		if(!(k in defaults)){ unknown.push(k); return; }
		const v = params[k];
		S[k] = isPlain(defaults[k]) && isPlain(v) && Object.keys(defaults[k]).length ? { ...defaults[k], ...v } : v;
	});
	return { state: S, unknown };
}

export const castFengshuiTool = {
	name: 'cast_fengshui',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 30000,
	description: `风水理气起局:按流派(玄空飞星 / 八宅 / 三合水法 / 紫白 / 金锁玉关 / 玄空大卦 / 综合罗经 / 阳宅判断 …共 18 派)排一局,返回与风水页理气工作台同一份正文。`
		+ `params 与页面左栏同形,缺的取页面初值;不给 params 时先用 showDefaults:true 看该派全部参数与初值。${GUIDE}:用户要看某宅某派的理气格局时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['school'],
		properties: {
			school: { type: 'string', enum: FENGSHUI_SCHOOLS, description: 'bazhai 八宅 / xuankong 玄空飞星 / sanhe 三合水法 / jinsuo 金锁玉关 / qiankun 乾坤国宝 / zibai 紫白飞星 / fuxing 辅星水法 / jingyin 净阴净阳 / dagua 玄空大卦 / xingshi 形势峦头 / zeri 择日 / liufa 玄空六法 / mingli 命理派 / luopan 综合罗经 / daxuankong 大玄空 / shuilong 水龙平洋 / huasha 改造化煞 / zhaiduan 阳宅判断' },
			params: { type: 'object', description: "该派参数(与页面左栏同形)。如玄空 { yun:9, xiangShan:'午', year:2026 };八宅 { zuoGua:'坎', ming:{ year:1990, isMale:true } };大玄空 / 水龙 / 化煞 / 阳宅判断 直接给该派自己的键" },
			showDefaults: { type: 'boolean', default: false, description: '只返回该派可填的参数与初值,不起局' },
			maxChars: { type: 'integer', minimum: 200, maximum: 60000 },
		},
	},
	outputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, school: { type: 'string' }, available: { type: 'boolean' }, defaults: { type: 'object' }, ignoredParams: { type: 'array', items: { type: 'string' } } } },
	async run(args){
		const school = args.school;
		const W = await import('../../../components/fengshui/LiqiWorkspace');
		const { implOf } = await import('../../../components/fengshui/liqi/registry');
		const impl = implOf(school);
		const base = W.liqiDefaultState();
		const label = (W.SCHOOL_CN && W.SCHOOL_CN[school]) || school;
		const params = isPlain(args.params) ? args.params : {};
		if(args.showDefaults){
			const defaults = impl ? { ...impl.defaults } : (LIQI_SCHOOL_KEYS[school] || []).reduce((o, k)=>{ o[k] = base[k]; return o; }, {});
			return { ok: true, data: { school, content: `【风水·${label}】可填参数(值为页面初值):\n${JSON.stringify(defaults, null, 1)}`, defaults }, summary: `${label} 参数清单` };
		}
		let state; let unknown = [];
		if(impl){
			const m = mergeLiqiState({ ...impl.defaults }, params);
			unknown = m.unknown;
			state = { ...base, regStates: { [school]: m.state } };
		}else{
			const keys = LIQI_SCHOOL_KEYS[school] || [];
			const m = mergeLiqiState(base, params);
			unknown = m.unknown.concat(Object.keys(params).filter((k)=>(k in base) && keys.indexOf(k) < 0));
			state = m.state;
		}
		let r;
		try{ r = W.computeLiqi(school, state, { geo: null }); }catch(e){
			return { ok: false, code: 'E_ARGS_INVALID', message: `${label}起局失败:${e && e.message ? e.message : e}。先用 showDefaults:true 看参数形状` };
		}
		if(!r || r.available === false){
			const hint = (W.LIQI_UNAVAILABLE_HINT && (W.LIQI_UNAVAILABLE_HINT[school] || W.LIQI_UNAVAILABLE_HINT.default)) || '参数不全';
			return { ok: false, code: 'E_ARGS_INVALID', message: `${label}参数不全:${hint.replace(/在左栏/g, '在 params 里')}`, data: { school, available: false } };
		}
		let content = `${W.buildSnapshot(school, r) || ''}`.trim();
		if(args.maxChars && content.length > args.maxChars){ content = `${content.slice(0, args.maxChars)}\n…(已截断,调大 maxChars 看全文)`; }
		const data = { school, available: true, content };
		if(unknown.length){ data.ignoredParams = unknown; }
		return { ok: true, data, summary: `风水·${label} 起局` };
	},
};

export default castFengshuiTool;
