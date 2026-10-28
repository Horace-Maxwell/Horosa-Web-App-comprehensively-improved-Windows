// 简 → 繁转换器(界面显示用;按需异步加载,词典约 1MB,只有切到繁体时才下载)。
// 通用词典(大陆简体 → 台湾正体字形)+ 术数用字逐位校正(hantRules.js)。
// 只做显示层:存储、导出、发给 AI 的内容一律仍是简体原文(见 utils/scriptMode.js)。
// 另带一份繁 → 简(台湾 → 大陆)小词典,只作检索与判字用:判「这个字是繁体专用字」(逐位校正的「原文已是繁体则不改」)、
// 繁体折回简体写法(toMatchKey)、一简多繁 / 繁 → 简逐字对照(hantCandidatesOf / hansCandidatesOf)、
// 检索比对形态(matchFormsOf,给 scriptMatch.js 的逐位对齐比对用);不用来改任何显示或数据。
import * as OpenCCModule from 'opencc-js/dist/umd/cn2t.js';
import * as OpenCCBackModule from 'opencc-js/dist/umd/t2cn.js';
import { applyHantDomainRules } from './hantRules';
import { buildMatchForms } from './scriptMatch';

const pick = (m)=>((m && m.ConverterFactory) ? m : (m && m.default));
const OpenCC = pick(OpenCCModule);
const OpenCCBack = pick(OpenCCBackModule);

const base = OpenCC.ConverterFactory(...OpenCC.Locale.from.cn, ...OpenCC.Locale.to.tw);
const back = OpenCCBack.ConverterFactory(...OpenCCBack.Locale.from.tw, ...OpenCCBack.Locale.to.cn);

// 无中日韩统一表意字的串不进词典(数字 / 英文 / 符号占界面文字的大半)
const HAN_RE = /[㐀-鿿豈-﫿]/;

// 繁体专用字:繁 → 简会改它,而简 → 繁不改它(「么 → 幺」这类繁 → 简词典自身的怪映射因此不算)。
// 乾(乾卦)/ 著(显著)在简体原文里本来就常用,不算。
const TRAD_EXEMPT = new Set(['乾', '著']);
const tradCache = new Map();
export function isTradOnlyChar(ch){
	if(!ch || !HAN_RE.test(ch)){ return false; }
	const hit = tradCache.get(ch);
	if(hit !== undefined){ return hit; }
	const v = !TRAD_EXEMPT.has(ch) && back(ch) !== ch && base(ch) === ch;
	tradCache.set(ch, v);
	return v;
}

// 繁体写法字(检索用,比 isTradOnlyChar 宽):繁 → 简会改它的字,含台湾字形表会再改写的(裏 → 裡 的「裏」);
// 乾 / 著 同样不算。只给检索(比对时的逐位简体写法、远端多写法)用,不影响显示。
// 逐字缓存定额:正常使用只有几千个常用字,远到不了;到额整份清空重来(检索比对每位都查它,清空后按需重建,不做逐条 LRU 记账)
const CHAR_FORM_CACHE_LIMIT = 30000;
const formCache0 = new Map();
export function isTradFormChar(ch){
	if(!ch || !HAN_RE.test(ch)){ return false; }
	const hit = formCache0.get(ch);
	if(hit !== undefined){ return hit; }
	const v = !TRAD_EXEMPT.has(ch) && back(ch) !== ch;
	if(formCache0.size >= CHAR_FORM_CACHE_LIMIT){ formCache0.clear(); }
	formCache0.set(ch, v);
	return v;
}

// 繁体里通行的字 = 词典繁体一侧出现过的字(克 / 里 / 征 / 台 / 云 …;简体专用字如 简 / 发 / 历 / 钟 不在内)
let tradChars = null;
export function isTradChar(ch){
	if(!tradChars){
		tradChars = new Set();
		[...OpenCC.Locale.from.cn.flat(), ...OpenCC.Locale.to.tw.flat()].forEach((d)=>{
			if(typeof d !== 'string'){ return; }
			d.split('|').forEach((seg)=>{
				const sp = seg.indexOf(' ');
				if(sp >= 0){ Array.from(seg.slice(sp + 1)).forEach((c)=>tradChars.add(c)); }
			});
		});
	}
	return tradChars.has(ch);
}

const RULE_OPTS = { isTradOnly: isTradOnlyChar, isTradChar };

const CACHE_LIMIT = 20000;
let cache = new Map();

export function toHant(text){
	const s = `${text === undefined || text === null ? '' : text}`;
	if(!s || !HAN_RE.test(s)){ return s; }
	const hit = cache.get(s);
	if(hit !== undefined){ return hit; }
	const out = applyHantDomainRules(s, base(s), RULE_OPTS);
	if(cache.size >= CACHE_LIMIT){ cache = new Map(); }
	cache.set(s, out);
	return out;
}

// 一简多繁 / 繁 → 简 的逐字对照(由通用词典的词条按位对齐得出,惰性建一次):
//   hant:简体字 → 它在各词里的繁体写法(历 → 曆 / 歷,发 → 發 / 髮,钟 → 鐘 / 鍾,里 → 裏 / 裡)
//   hans:繁体字 → 它对应的简体字(鍾 → 钟 / 锺,後 → 后)
// 只给检索用(远端检索的多写法、比对时繁体原文的逐位简体写法),不改任何显示。
let charTables = null;
function tables(){
	if(charTables){ return charTables; }
	const tw = new Map();
	OpenCC.Locale.to.tw.flat().forEach((d)=>{
		if(typeof d !== 'string'){ return; }
		d.split('|').forEach((seg)=>{
			const sp = seg.indexOf(' ');
			const a = Array.from(seg.slice(0, sp));
			const b = Array.from(seg.slice(sp + 1));
			if(a.length === 1 && b.length === 1){ tw.set(a[0], b[0]); }
		});
	});
	const hant = new Map();
	const hans = new Map();
	const add = (m, k, v)=>{ let set = m.get(k); if(!set){ set = new Set(); m.set(k, set); } set.add(v); };
	OpenCC.Locale.from.cn.flat().forEach((d)=>{
		if(typeof d !== 'string'){ return; }
		d.split('|').forEach((seg)=>{
			const sp = seg.indexOf(' ');
			if(sp <= 0){ return; }
			const a = Array.from(seg.slice(0, sp));
			const b = Array.from(seg.slice(sp + 1));
			if(a.length !== b.length){ return; }
			for(let i = 0; i < a.length; i += 1){
				if(a[i] === b[i]){ continue; }
				[b[i], tw.get(b[i])].forEach((t)=>{
					if(t && t !== a[i]){ add(hant, a[i], t); add(hans, t, a[i]); }
				});
			}
		});
	});
	charTables = { hant, hans, hantList: new Map(), hansList: new Map() };
	return charTables;
}

// 简体字 ch 的繁体专用写法(不含 ch 自身;只含繁体专用字 —— 乾 / 著 这类简体里本来也用的字不算,
// 免得远端检索「干」时混进全部「乾卦」)
export function hantCandidatesOf(ch){
	if(!ch || !HAN_RE.test(ch)){ return []; }
	const t = tables();
	let hit = t.hantList.get(ch);
	if(!hit){
		hit = Array.from(t.hant.get(ch) || []).filter((c)=>isTradFormChar(c));
		t.hantList.set(ch, hit);
	}
	return hit;
}

// 繁体写法字 ch 的简体写法(isTradFormChar 为假的字回 [])
export function hansCandidatesOf(ch){
	if(!ch || !isTradFormChar(ch)){ return []; }
	const t = tables();
	let hit = t.hansList.get(ch);
	if(!hit){
		hit = Array.from(t.hans.get(ch) || []);
		const b = back(ch);
		if(b && b !== ch && hit.indexOf(b) < 0){ hit.push(b); }
		t.hansList.set(ch, hit);
	}
	return hit;
}

// 长文本(资料库全文一类的检索面)只进检索缓存、不再顺带占一份显示缓存(那份只为页面文字节点准备)
const LONG_TEXT = 4096;
const SHORT_KEY = 64;
const shownForMatch = (s)=>(s.length > LONG_TEXT ? applyHantDomainRules(s, base(s), RULE_OPTS) : toHant(s));

// 把繁体折回简体写法(用户照屏幕输入的繁体、繁体存的记录 / 史料原文 → 简体数据的写法)。
// 只改繁体写法字(isTradFormChar):简体原文原样返回;乾 / 著 / 覆 这类简体里本来也用的字照原文(不会把「乾」折成「干」)。
// 繁体专用字取带语境的整串折回结果;一繁对多简(鍾 → 钟 / 锺)时取显示规则转回去还是这个字的那一个(钟馗 ← 鍾馗)。
// 用于存下来的检索条件归一与按名查表;子串检索请用 scriptMatch.js 的逐位对齐比对(整串键在子串上不稳定)。
let keyCache = new Map();
export function toMatchKey(text){
	const s = `${text === undefined || text === null ? '' : text}`;
	if(!s || !HAN_RE.test(s)){ return s; }
	const hit = keyCache.get(s);
	if(hit !== undefined){ return hit; }
	const chars = Array.from(s);
	let out;
	if(!chars.some((c)=>isTradFormChar(c))){
		out = s;
	}else{
		const folded = Array.from(back(shownForMatch(s)));
		if(folded.length !== chars.length){
			out = folded.join('');
		}else{
			const k = chars.map((c, i)=>(isTradFormChar(c) ? folded[i] : c));
			if(chars.length <= SHORT_KEY){
				chars.forEach((c, i)=>{
					if(!isTradFormChar(c)){ return; }
					const hs = hansCandidatesOf(c);
					if(hs.length < 2 || hs[0] === k[i]){ return; }
					const trial = k.slice();
					trial[i] = hs[0];
					if(Array.from(toHant(trial.join('')))[i] === c){ k[i] = hs[0]; }
				});
			}
			out = k.join('');
		}
	}
	if(keyCache.size >= CACHE_LIMIT){ keyCache = new Map(); }
	keyCache.set(s, out);
	return out;
}

// 检索比对形态(scriptMatch.buildMatchForms 的带缓存版本)
const MATCH_CONV = { toHant: shownForMatch, isTradOnlyChar, isTradFormChar, hansCandidatesOf, toMatchKey };
let formCache = new Map();
export function matchFormsOf(text){
	const s = `${text === undefined || text === null ? '' : text}`;
	if(!s || !HAN_RE.test(s)){ return { text: s, shown: s, alts: null, key: null }; }
	const hit = formCache.get(s);
	if(hit !== undefined){ return hit; }
	const out = buildMatchForms(s, MATCH_CONV);
	if(formCache.size >= CACHE_LIMIT){ formCache = new Map(); }
	formCache.set(s, out);
	return out;
}

export default toHant;

// 测试用:带逐位依据跑一遍(见 hantRules.applyHantDomainRules 的 opts.trace)
export function __traceHant(text){
	const s = `${text === undefined || text === null ? '' : text}`;
	const trace = [];
	const out = applyHantDomainRules(s, base(s), { ...RULE_OPTS, trace });
	return { out, trace };
}
