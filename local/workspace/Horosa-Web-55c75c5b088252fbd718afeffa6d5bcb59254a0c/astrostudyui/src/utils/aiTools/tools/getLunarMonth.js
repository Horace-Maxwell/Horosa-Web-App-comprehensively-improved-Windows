// AI 助手·农历月历:与农历页同一请求(/calendar/month)与同一正文构建(NongLiMain.buildNongliSnapshotText),
// 一次回一个公历月的逐日农历 / 日干支 / 节气朔望(此前只能逐日问老黄历)。只读。
import { GUIDE } from './_shared';

export default {
	name: 'get_lunar_month',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	cacheable: true,
	timeoutMs: 30000,
	description: `查一个公历月的农历月历:逐日公历 / 星期 / 农历 / 日干支 / 节气与朔望(与农历页同一份)。month 写 YYYY-MM;历算经度缺省 120°E(页面缺省),时区缺省 +08:00。${GUIDE}:用户问「这个月农历 / 哪天初一十五 / 哪天交节」时调用;某一天的宜忌用 cast_technique technique=huangli。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['month'], properties: {
		month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: '公历年月 YYYY-MM(月份 01–12)' },
		zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$', default: '+08:00' },
		lon: { type: 'string', maxLength: 12, default: '120e00', description: '历算经度(如 120e00 / 116e23)' },
		maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
	} },
	outputSchema: { type: 'object', required: ['month', 'content'], properties: { month: { type: 'string' }, content: { type: 'string' }, days: { type: 'integer' }, truncated: { type: 'boolean' } } },
	async run(args){
		const [{ default: request }, Constants, nl] = await Promise.all([import('../../request'), import('../../constants'), import('../../../components/calendar/NongLiMain')]);
		const month = `${args.month}`;
		const zone = args.zone || '+08:00';
		const lon = args.lon || '120e00';
		let data;
		try{
			data = await request(`${Constants.ServerRoot}/calendar/month`, { body: JSON.stringify({ date: `${month}-01`, ad: 1, zone, lon }) });
		}catch(e){ data = null; }
		const result = data && data[Constants.ResultKey];
		if(!result || !Array.isArray(result.days)){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '农历月历没取到(需本机计算服务在线)' }; }
		const text = `${nl.buildNongliSnapshotText({ days: result.days, prevDays: result.prevDays, date: { format: ()=>month, zone }, lon }) || ''}`.trim();
		if(!text){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: '这个月的月历是空的' }; }
		const max = args.maxChars || 12000;
		const days = result.days.filter((d)=>d && `${d.birth || ''}`.slice(0, month.length) === month).length;
		return { ok: true, data: { month, content: text.length > max ? text.slice(0, max) : text, days, ...(text.length > max ? { truncated: true } : {}) }, summary: `${month} 农历月历 ${days} 天` };
	},
};
