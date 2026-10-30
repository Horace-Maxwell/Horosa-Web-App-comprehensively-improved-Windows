// 量化盘「公式求解」:手输敏感点公式,求出敏感点黄经,再列出盘上(按盘基折叠)落在该点容许度内的因子与中点。
// 只是把用户写的式子算出来:和差用黄经代数和、「/」用近轴中点(uranianDial.midpoint,与后端同口径),
// 落点判定用 dialSeparation —— 不另立任何天文算法。
//
// 写法:
//   因子      中文名(太阳 / 日、月亮 / 月、上升、天顶、北交、白羊点、丘比特 …)、英文 id(Sun / Cupido …)或两字母缩写(Su Mo AS MC NN Cu …)
//   度数      15、15.5、15°、15°30′、15°30'(按黄经度)
//   运算      A+B−C(和差)、A/B(中点,优先于加减)、括号
// 例:日+月−火、日/月、上升+天顶−太阳、(火/土)+15°
import * as AstroConst from '../constants/AstroConst';
import { factorLabel } from '../data/uranianMeanings';
import { midpoint, dialSeparation } from './uranianDial';
import { scriptMatchKey } from './scriptMode';

const norm360 = (x)=>((x % 360) + 360) % 360;

// 常用简称 / 缩写 → 因子 id(全名由 factorLabel 自动收)
const ALIASES = {
	日: AstroConst.SUN, 月: AstroConst.MOON, 水: AstroConst.MERCURY, 金: AstroConst.VENUS, 火: AstroConst.MARS,
	木: AstroConst.JUPITER, 土: AstroConst.SATURN, 天王: AstroConst.URANUS, 海王: AstroConst.NEPTUNE, 冥王: AstroConst.PLUTO,
	冥: AstroConst.PLUTO, 升: AstroConst.ASC, 顶: AstroConst.MC, 交: AstroConst.NORTH_NODE, 白羊: AstroConst.ARIES_POINT,
	su: AstroConst.SUN, mo: AstroConst.MOON, me: AstroConst.MERCURY, ve: AstroConst.VENUS, ma: AstroConst.MARS,
	ju: AstroConst.JUPITER, sa: AstroConst.SATURN, ur: AstroConst.URANUS, ne: AstroConst.NEPTUNE, pl: AstroConst.PLUTO,
	as: AstroConst.ASC, asc: AstroConst.ASC, mc: AstroConst.MC, nn: AstroConst.NORTH_NODE, ar: AstroConst.ARIES_POINT,
	cu: AstroConst.CUPIDO, ha: AstroConst.HADES, ze: AstroConst.ZEUS, kr: AstroConst.KRONOS,
	ap: AstroConst.APOLLON, ad: AstroConst.ADMETOS, vu: AstroConst.VULCANUS, po: AstroConst.POSEIDON,
};

// 认得的全部因子(盘上没有的也认,求值时再报「盘上没有」,而不是笼统的「认不出」)
const KNOWN_IDS = [...new Set(Object.values(ALIASES).concat(AstroConst.LIST_URANIAN,
	[AstroConst.EAST_POINT, AstroConst.VERTEX, AstroConst.SOUTH_NODE].filter(Boolean)))];

/** 「名字 → id」表(全名、英文 id、简称;拉丁字母不分大小写),含当前点集里的其余点。 */
export function formulaNameTable(points){
	const ids = new Set(KNOWN_IDS.concat((points || []).map((p)=>p.id)));
	const table = {};
	ids.forEach((id)=>{
		table[`${id}`.toLowerCase()] = id;
		const lb = factorLabel(id);
		if(lb){ table[lb] = id; }
	});
	Object.keys(ALIASES).forEach((k)=>{ table[k] = ALIASES[k]; });
	return table;
}

function tokenize(src, names){
	const keys = Object.keys(names).sort((a, b)=>b.length - a.length);
	const out = [];
	let i = 0;
	const s = `${src || ''}`;
	while(i < s.length){
		const ch = s[i];
		if(/\s/.test(ch)){ i += 1; continue; }
		if('+-−–/()'.indexOf(ch) >= 0){
			out.push({ t: ch === '−' || ch === '–' ? '-' : ch });
			i += 1;
			continue;
		}
		const num = /^(\d+(?:\.\d+)?)\s*(?:°\s*(?:(\d+(?:\.\d+)?)\s*[′'])?)?/.exec(s.slice(i));
		if(num && num[0]){
			const deg = Number(num[1]) + (num[2] ? Number(num[2]) / 60 : 0);
			out.push({ t: 'num', v: deg });
			i += num[0].length;
			continue;
		}
		const rest = s.slice(i);
		const restLow = rest.toLowerCase();
		const hit = keys.find((k)=>(/^[a-z]/.test(k) ? restLow.startsWith(k) && !/^[a-z]/i.test(rest.slice(k.length, k.length + 1)) : rest.startsWith(k)));
		if(!hit){ throw new Error(`认不出「${rest.slice(0, 6)}」`); }
		out.push({ t: 'id', v: names[hit] });
		i += hit.length;
	}
	return out;
}

/**
 * 解析并求值。返回 { ok, lon, used:[id], error }。
 * @param formula 公式文本(繁体界面照屏幕输入的「太陽+月亮」先折回简体写法再认名;opts.fold 可替换折回函数)
 * @param points [{ id, lon }](盘上的本命点集)
 */
export function evaluateFormula(formula, points, opts){
	const fold = opts && typeof opts.fold === 'function' ? opts.fold : scriptMatchKey;
	const src = fold(`${formula || ''}`).trim();
	if(!src){ return { ok: false, error: '' }; }
	const lonOf = {};
	(points || []).forEach((p)=>{ if(Number.isFinite(Number(p.lon))){ lonOf[p.id] = Number(p.lon); } });
	let toks;
	try{ toks = tokenize(src, formulaNameTable(points)); }catch(e){ return { ok: false, error: e.message }; }
	let pos = 0;
	const used = [];
	const peek = ()=>toks[pos];
	const atom = ()=>{
		const tk = toks[pos];
		if(!tk){ throw new Error('式子不完整'); }
		pos += 1;
		if(tk.t === 'num'){ return tk.v; }
		if(tk.t === 'id'){
			if(lonOf[tk.v] === undefined){ throw new Error(`盘上没有「${factorLabel(tk.v)}」`); }
			used.push(tk.v);
			return lonOf[tk.v];
		}
		if(tk.t === '('){
			const v = expr();
			if(!peek() || peek().t !== ')'){ throw new Error('括号没有配对'); }
			pos += 1;
			return v;
		}
		throw new Error(`「${tk.t}」位置不对`);
	};
	const term = ()=>{
		let v = atom();
		while(peek() && peek().t === '/'){ pos += 1; v = midpoint(v, atom()); }
		return v;
	};
	const expr = ()=>{
		let sign = 1;
		if(peek() && (peek().t === '-' || peek().t === '+')){ sign = peek().t === '-' ? -1 : 1; pos += 1; }
		let v = sign * term();
		while(peek() && (peek().t === '+' || peek().t === '-')){
			const s = peek().t === '-' ? -1 : 1;
			pos += 1;
			v += s * term();
		}
		return v;
	};
	try{
		const v = expr();
		if(pos !== toks.length){ throw new Error(`「${toks[pos].t === 'id' ? factorLabel(toks[pos].v) : toks[pos].t}」位置不对`); }
		return { ok: true, lon: norm360(v), used };
	}catch(e){
		return { ok: false, error: e.message };
	}
}

/**
 * 公式求解:敏感点 + 盘上落在其容许度内的因子 / 中点(按盘基折叠比较),按距离排序。
 * opts.focus(可选因子 id):只留含该因子的命中;opts.limit 默认 30。
 */
export function solveFormula(formula, points, base, orb, opts){
	const r = evaluateFormula(formula, points, opts);
	if(!r.ok){ return { ...r, hits: [] }; }
	const pts = (points || []).filter((p)=>Number.isFinite(Number(p.lon)));
	const focus = opts && opts.focus ? opts.focus : null;
	const limit = (opts && opts.limit) || 30;
	const hits = [];
	pts.forEach((p)=>{
		const sep = dialSeparation(r.lon, Number(p.lon), base);
		if(sep <= orb){ hits.push({ kind: 'body', a: p.id, sep }); }
	});
	for(let i = 0; i < pts.length; i++){
		for(let j = i + 1; j < pts.length; j++){
			const m = midpoint(Number(pts[i].lon), Number(pts[j].lon));
			const sep = dialSeparation(r.lon, m, base);
			if(sep <= orb){ hits.push({ kind: 'mid', a: pts[i].id, b: pts[j].id, sep }); }
		}
	}
	const kept = focus ? hits.filter((h)=>h.a === focus || h.b === focus) : hits;
	kept.sort((x, y)=>x.sep - y.sep);
	return { ...r, hits: kept.slice(0, limit) };
}

/** 命中行文案(盘面 / AI 共用):「火星 0.32°」「日/月 0.15°」。 */
export function formulaHitText(h){
	const sep = `${Number(h.sep).toFixed(2)}°`;
	return h.kind === 'mid' ? `${factorLabel(h.a)}/${factorLabel(h.b)} ${sep}` : `${factorLabel(h.a)} ${sep}`;
}
