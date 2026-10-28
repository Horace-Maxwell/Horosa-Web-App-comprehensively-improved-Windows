// 按句末 / 分句标点切句,标点留在前一段末尾 —— 与 `text.split(/(?<=[标点])/)` 逐段相同,但不用正则后行断言。
//
// 为什么不直接写后行断言:系统内核 Safari 16.4 以前(桌面包下限 macOS 12.0 = Safari 15.0)解析到含 `(?<=` 的正则字面量
// 就报语法错,**整份脚本一行都不执行** —— 它若落在首屏共享分包里,主界面直接加载不出来。下限表与产物闸:scripts/legacy-engine-floor.js。
//
// 等价性(jest 逐串对拍):空串 → ['']、无标点 → [整串]、末尾无标点的残段单独成一段、连续标点各自成段、换行不切。

export const SENTENCE_END = '。!?！？';
export const CLAUSE_END = '。!?！？;；';

// 键 = 标点集;调用方传的都是上面这类常量,上限只防有人传进动态串
const CACHE_MAX = 16;
const cache = new Map();
function matcherOf(puncts){
	let re = cache.get(puncts);
	if(!re){
		const cls = `${puncts}`.replace(/[\]\\^-]/g, '\\$&');
		re = new RegExp(`[^${cls}]*[${cls}]|[^${cls}]+$`, 'g');
		if(cache.size >= CACHE_MAX){ cache.clear(); }
		cache.set(puncts, re);
	}
	re.lastIndex = 0;
	return re;
}

/** text 按 puncts 里任一字符切开,每段带着它末尾的那个标点。 */
export function splitAfterPunct(text, puncts = SENTENCE_END){
	const s = `${text == null ? '' : text}`;
	if(s === '' || !puncts){ return [s]; }
	return s.match(matcherOf(puncts)) || [s];
}

export default splitAfterPunct;
