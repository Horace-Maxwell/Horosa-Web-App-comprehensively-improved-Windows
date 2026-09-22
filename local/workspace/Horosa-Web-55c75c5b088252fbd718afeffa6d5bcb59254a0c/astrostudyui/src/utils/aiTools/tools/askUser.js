// AI 助手·向用户提问(elicitation):缺出生时辰/地名歧义/事盘类型不明时,不空转不瞎编,把问题弹到界面让用户亲自作答。
// 只读工具(不落任何数据);答案由运行时/桥提供的 ctx.elicit 通道取得,缺通道即 E_ELICIT_UNAVAILABLE。
import { GUIDE } from './_shared';

export const ASK_USER_TIMEOUT_MS = 900000;

export default {
	name: 'ask_user',
	level: 'read',
	category: 'interactive',
	undoKind: 'none',
	timeoutMs: ASK_USER_TIMEOUT_MS,
	description: `向用户提一个明确的问题并等待作答(缺出生时辰/地名歧义/事盘类型不明时用;一次只问一个问题;inputType=choice 时给 options 让用户选)。返回 data.answer 为用户亲自作答,视同用户最近消息的补充。${GUIDE}或信息不全必须补料时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['question'],
		properties: {
			question: { type: 'string', minLength: 1, maxLength: 500, description: '要问用户的问题(一句话,说清缺什么)' },
			inputType: { type: 'string', enum: ['text', 'choice', 'confirm'], default: 'text', description: 'text=自由输入 / choice=从 options 里选 / confirm=是否确认' },
			options: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 60 }, description: 'inputType=choice 时的候选项' },
			placeholder: { type: 'string', maxLength: 80, description: '输入框提示(如「08:00」)' },
			timeoutSec: { type: 'integer', minimum: 30, maximum: 900, default: 300, description: '等待用户作答的秒数,超时视为未答' },
		},
	},
	async run(args, ctx){
		if(!ctx || typeof ctx.elicit !== 'function'){
			return { ok: false, code: 'E_ELICIT_UNAVAILABLE', message: '当前调用通道不支持向用户提问' };
		}
		const inputType = args.inputType || 'text';
		const options = Array.isArray(args.options) ? args.options : [];
		if(inputType === 'choice' && !options.length){
			return { ok: false, code: 'E_ARGS_INVALID', message: 'inputType=choice 时必须给 options' };
		}
		const shown = inputType === 'confirm' ? ['是', '否'] : options;
		let r = null;
		try{
			// [Q-294/M-109·AR-22] 透传调用中止信号:通道被中止(桥超时 / 用户停止)时反问待办立即落定,不再挂到自己的超时
			r = await ctx.elicit({ question: args.question, inputType, options: shown, placeholder: args.placeholder || '', timeoutMs: (args.timeoutSec || 300) * 1000, ...(ctx.signal ? { signal: ctx.signal } : {}) });
		}catch(e){
			return { ok: false, code: 'E_ELICIT_UNAVAILABLE', message: e && e.message ? e.message : '提问通道异常' };
		}
		if(!r || r.timeout){ return { ok: false, code: 'E_ELICIT_TIMEOUT', message: '用户未在限时内作答' }; }
		if(r.declined){ return { ok: false, code: 'E_ELICIT_DECLINED', message: r.aborted ? '用户已停止本轮' : '用户拒绝作答' }; }
		const answer = `${r.answer === undefined || r.answer === null ? '' : r.answer}`.slice(0, 2000);
		const choice = r.choice !== undefined ? `${r.choice}` : (inputType !== 'text' && shown.indexOf(answer) >= 0 ? answer : undefined);
		return { ok: true, data: { answer, choice, answeredBy: 'user', answeredAt: new Date().toISOString() }, summary: `用户作答:${answer.slice(0, 60)}` };
	},
};
