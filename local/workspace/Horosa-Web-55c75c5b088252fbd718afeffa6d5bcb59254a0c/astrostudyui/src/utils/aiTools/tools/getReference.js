// AI 助手·辅助页参考表(八卦类象 / 十二串宫 / 八字规则):与辅助页三个页签同一组后端接口,只读。
// 八卦类象按一卦查(本卦与互、错、综等十六卦的类象,与页面同一组卦名);十二串宫给总表,另给干或支时加查该字;八字规则出全部口诀。
import request from '../../request';
import * as Constants from '../../constants';
import { GUIDE } from './_shared';

export const REFERENCE_TABLES = ['guasym', 'cuangong12', 'pithy'];
export const GONG12_CHARS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

async function post(path, body){
	const data = await request(`${Constants.ServerRoot}${path}`, { body: JSON.stringify(body || {}), silent: true });
	return data ? data[Constants.ResultKey] : undefined;
}

// 与 DoubleMeiyiGuaSym 同一组派生卦(yao:初爻 → 上爻,1 阳 0 阴)
export function derivedGuaNames(yao){
	const d = yao.slice(0, 3); const u = yao.slice(3, 6);
	const join = (a)=>a.join('');
	return {
		本卦: join(yao),
		互卦: join([d[1], d[2], u[0], d[2], u[0], u[1]]),
		上一爻互: join([d[2], u[0], u[1], u[0], u[1], u[2]]),
		上二爻互: join([d[1], d[2], u[0], u[0], u[1], u[2]]),
		下一爻互: join([d[0], d[1], d[2], d[2], u[0], u[1]]),
		下二爻互: join([d[0], d[1], d[2], d[1], d[2], u[0]]),
		错卦: join(yao.map((x)=>(x === 1 ? 0 : 1))),
		综卦: join([u[2], u[1], u[0], d[2], d[1], d[0]]),
	};
}

const pretty = (v)=>JSON.stringify(v);   // 紧凑:参考表体量大,缩进只占字数

export const getReferenceTool = {
	name: 'get_reference',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 30000,
	description: `辅助页参考表:guasym 八卦类象(按一卦查本卦与互卦、错卦、综卦等的类象;yao 六位 0/1,初爻在前,1 为阳)/ cuangong12 十二串宫(十二宫神总表;给 char 干或支时加查该字)/ pithy 八字规则(全部口诀)。与辅助页三个页签同一组数据。${GUIDE}:用户问卦象类象、串宫、八字口诀等参考资料时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['table'],
		properties: {
			table: { type: 'string', enum: REFERENCE_TABLES },
			yao: { type: 'string', pattern: '^[01]{6}$', description: 'table=guasym 必填:六位 0/1,初爻 → 上爻,1 阳 0 阴(如乾 111111、泰 111000)' },
			char: { type: 'string', enum: GONG12_CHARS, description: 'table=cuangong12 可选:加查这一个干或支' },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
		},
	},
	outputSchema: { type: 'object', required: ['table', 'content'], properties: { table: { type: 'string' }, content: { type: 'string' } } },
	async run(args){
		const t = args.table;
		let data;
		try{
			if(t === 'guasym'){
				if(!args.yao){ return { ok: false, code: 'E_ARGS_INVALID', message: 'table=guasym 要给 yao(六位 0/1,初爻在前)' }; }
				const names = derivedGuaNames(args.yao.split('').map(Number));
				const res = await post('/gua/desc', { name: Object.values(names) });
				if(!res){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '八卦类象没取到(需本机计算服务在线)', retryable: true }; }
				data = {};
				Object.keys(names).forEach((k)=>{ data[k] = res[names[k]] === undefined ? null : res[names[k]]; });
			}else if(t === 'cuangong12'){
				const gods = await post('/common/gong12gods', {});
				if(!gods){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '十二串宫没取到(需本机计算服务在线)', retryable: true }; }
				data = { 宫神: gods.stars, 宫神释义: gods.starSu, 宫类释义: gods.starTypeSu };
				if(args.char){
					const one = await post('/common/gong12', { '干支': args.char });
					data[`查「${args.char}」`] = one && one.gong12 ? one.gong12 : null;
				}
			}else{
				const res = await post('/common/pithy', {});
				if(!res){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '八字规则没取到(需本机计算服务在线)', retryable: true }; }
				data = { 口诀: res.pithy };
			}
		}catch(e){
			return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: '参考表没取到(需本机计算服务在线)', retryable: true };
		}
		const max = args.maxChars || 12000;
		let content = pretty(data);
		if(content.length > max){ content = `${content.slice(0, max)}\n…(已截断,调大 maxChars 看全文)`; }
		return { ok: true, data: { table: t, content }, summary: `参考表 ${t}` };
	},
};

export default getReferenceTool;
