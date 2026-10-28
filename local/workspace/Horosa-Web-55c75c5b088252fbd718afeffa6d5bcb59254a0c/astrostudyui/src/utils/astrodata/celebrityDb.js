// 名人库查询层(「工具 · 数据库」页同一份离线库:Astro-Databank AA / A 级出生资料 + 维基百科简介):AI 工具与无头模式共用。
// 检索规则与数据库页同一套(关键词按中英文名 / 标题 / 出生地 / 简介包含匹配;分类多选取交集;缺省排序 = 有简介的在前、再按名字)。
// 加载:无头运行时注入 globalThis.__HOROSA_ASTRODATA_LOADER__(从磁盘读);页面里按相对地址取 astrodata/ 下的库与 sql.js(与数据库页同一份资产)。
// 首次加载约 150 MB 内存、1-3 秒,之后常驻;只在 AI 第一次用到名人库时才加载。
import { scriptQueryVariants, ensureScriptConverter } from '../scriptMode';

export const CELEBRITY_ATTRIBUTION = '出生资料来自 Astro-Databank(Astrodienst AG),仅供非商业占星研究,保留 Rodden 评级并附原页链接;简介来自维基百科(CC BY-SA 4.0),附原文链接。引用时请保留来源。';
const ASSET_BASE = 'astrodata/';
const SIGNS = ['ari', 'tau', 'gem', 'can', 'leo', 'vir', 'lib', 'sco', 'sag', 'cap', 'aqu', 'pis'];
const SIGN_ZH = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
const SIGN_EN = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// 检索词 + 它的其它写法(简体归一 / 繁体),不看界面简繁(AI / 无头不对着屏幕检索);转换器没加载到时只有原词
async function queryAlternates(kw){
	const raw = `${kw === undefined || kw === null ? '' : kw}`.trim();
	if(!raw){ return []; }
	await ensureScriptConverter();
	return [raw].concat(scriptQueryVariants(raw, { anyScript: true }));
}

let dbPromise = null;
let testDb = null;

export function __setCelebrityDbForTests(db){ testDb = db; dbPromise = null; }

const SCRIPT_TIMEOUT_MS = 30000;
function loadScript(src, globalName){
	return new Promise((resolve, reject)=>{
		if(typeof window !== 'undefined' && window[globalName]){ resolve(window[globalName]); return; }
		const s = document.createElement('script');
		const timer = setTimeout(()=>reject(new Error(`加载 ${src} 超时`)), SCRIPT_TIMEOUT_MS);
		s.src = src; s.async = true;
		s.onload = ()=>{ clearTimeout(timer); if(window[globalName]){ resolve(window[globalName]); }else{ reject(new Error(`${globalName} 没有加载出来`)); } };
		s.onerror = ()=>{ clearTimeout(timer); reject(new Error(`加载 ${src} 失败`)); };
		document.head.appendChild(s);
	});
}

// 不会执行外部脚本的模拟环境(jsdom):直接说清,不干等
function pageCanLoadScripts(){
	try{ return !(typeof navigator !== 'undefined' && /jsdom/i.test(`${navigator.userAgent || ''}`)) && typeof fetch === 'function'; }catch(e){ return false; }
}

async function loadInPage(){
	if(!pageCanLoadScripts()){ throw new Error('当前环境不能加载名人库(需要真浏览器 / 桌面 App,或无头运行时)'); }
	const [initSqlJs, fflate] = await Promise.all([loadScript(`${ASSET_BASE}vendor/sql-wasm.js`, 'initSqlJs'), loadScript(`${ASSET_BASE}vendor/fflate.min.js`, 'fflate')]);
	const resp = await fetch(`${ASSET_BASE}astrodata-aa.sqlite.gz`);
	if(!resp.ok){ throw new Error(`名人库文件读不到(HTTP ${resp.status})`); }
	let bytes = new Uint8Array(await resp.arrayBuffer());
	if(bytes[0] === 0x1f && bytes[1] === 0x8b){ bytes = fflate.gunzipSync(bytes); }
	const SQL = await initSqlJs({ locateFile: (f)=>`${ASSET_BASE}vendor/${f}` });
	return new SQL.Database(bytes);
}

export function getCelebrityDb(){
	if(testDb){ return Promise.resolve(testDb); }
	if(!dbPromise){
		const hook = typeof globalThis !== 'undefined' ? globalThis.__HOROSA_ASTRODATA_LOADER__ : null;
		dbPromise = (typeof hook === 'function' ? hook() : loadInPage()).catch((e)=>{ dbPromise = null; throw e; });
	}
	return dbPromise;
}

// sql.js 查询 → 对象数组(参数化;任何用户输入都只走绑定参数)
export function queryRows(db, sql, params){
	const stmt = db.prepare(sql);
	try{
		if(params && params.length){ stmt.bind(params); }
		const out = [];
		while(stmt.step()){ out.push(stmt.getAsObject()); }
		return out;
	}finally{ stmt.free(); }
}

// 星座:接受 ari / Aries / 白羊 / 白羊座 → ari;认不出 = null
export function normalizeSign(v){
	const t = `${v || ''}`.trim().toLowerCase();
	if(!t){ return null; }
	let i = SIGNS.indexOf(t.slice(0, 3));
	if(i >= 0 && (t.length === 3 || SIGN_EN[i] === t)){ return SIGNS[i]; }
	i = SIGN_EN.indexOf(t);
	if(i >= 0){ return SIGNS[i]; }
	i = SIGN_ZH.findIndex((z)=>z === t || z.slice(0, 2) === t);
	return i >= 0 ? SIGNS[i] : null;
}
export const signZh = (code)=>{ const i = SIGNS.indexOf(code); return i >= 0 ? SIGN_ZH[i] : (code || ''); };
const genderText = (g)=>(Number(g) === 1 ? '男' : Number(g) === 0 ? '女' : '未知');
const clip = (s, n)=>{ const a = Array.from(`${s || ''}`); return a.length <= n ? a.join('') : `${a.slice(0, n).join('')}…`; };
const parseJsonArray = (s)=>{ try{ const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } };

function brief(r){
	return {
		id: r.cid, name: r.name, nameZh: r.name_zh || '', born: r.born_zh || r.born_display || '', birth: r.birth_chart || '',
		pos: r.pos_zh || r.pos || '', gender: genderText(r.gender), rodden: r.rodden || '', hasTime: Number(r.has_time) === 1,
		sun: signZh(r.sun), moon: signZh(r.moon), asc: Number(r.has_time) === 1 ? signZh(r.asc) : '',
		summary: clip(r.summary_zh || r.wiki_summary || '', 120),
	};
}

const ORDER = {
	relevance: " ORDER BY (wiki_summary<>'') DESC, name COLLATE NOCASE",
	name: ' ORDER BY name COLLATE NOCASE',
	birth_asc: ' ORDER BY birth_year, name COLLATE NOCASE',
	birth_desc: ' ORDER BY birth_year DESC, name COLLATE NOCASE',
};

// 检索:{ query, scope, gender, birthYear, birthYearFrom, birthYearTo, rodden[], sun, moon, asc, categories[](交集), category(子串), hasTime, sort, limit, offset }
export async function searchCelebrities(q){
	const a = q || {};
	const db = await getCelebrityDb();
	const w = [];
	const p = [];
	const kw = `${a.query || ''}`.trim();
	// 检索词的其它写法(简体归一 / 繁体):库里简繁混存,AI 给的检索词也可能是任一写法 —— 任一写法命中即算(与数据库页同口径)
	const kwAlts = kw ? await queryAlternates(kw) : [];
	if(kw){
		const cols = { any: ['name_zh', 'name', 'title', 'pos_zh', 'pos', 'summary_zh', 'wiki_summary'], name: ['name_zh', 'name', 'title'], bio: ['summary_zh', 'wiki_summary'] }[a.scope || 'any'] || [];
		w.push(`(${kwAlts.map((alt)=>cols.map((c)=>{ p.push(`%${alt}%`); return `${c} LIKE ? COLLATE NOCASE`; }).join(' OR ')).join(' OR ')})`);
	}
	if(a.gender === 'male' || a.gender === 'female'){ w.push('gender=?'); p.push(a.gender === 'male' ? 1 : 0); }
	if(Number.isInteger(a.birthYear)){ w.push('birth_year=?'); p.push(a.birthYear); }
	if(Number.isInteger(a.birthYearFrom)){ w.push('birth_year>=?'); p.push(a.birthYearFrom); }
	if(Number.isInteger(a.birthYearTo)){ w.push('birth_year<=?'); p.push(a.birthYearTo); }
	if(Array.isArray(a.rodden) && a.rodden.length){ w.push(`rodden IN (${a.rodden.map(()=>'?').join(',')})`); a.rodden.forEach((x)=>p.push(`${x}`)); }
	for(const k of ['sun', 'moon', 'asc']){
		if(a[k] !== undefined && a[k] !== ''){
			const code = normalizeSign(a[k]);
			if(!code){ throw Object.assign(new Error(`认不出星座「${a[k]}」(写 白羊 / Aries / ari 均可)`), { code: 'E_ARGS_INVALID' }); }
			w.push(`${k}=?`); p.push(code);
			if(k === 'asc'){ w.push('has_time=1'); }
		}
	}
	if(a.hasTime === true){ w.push('has_time=1'); }
	const cats = Array.isArray(a.categories) ? a.categories.filter((c)=>typeof c === 'string' && c) : [];
	if(cats.length){
		w.push(`id IN (SELECT p2.id FROM person p2 JOIN category c ON c.person_title=p2.title WHERE c.category IN (${cats.map(()=>'?').join(',')}) GROUP BY p2.id HAVING COUNT(DISTINCT c.category)=${cats.length})`);
		cats.forEach((c)=>p.push(c));
	}
	if(a.category){
		const catAlts = await queryAlternates(`${a.category}`);
		w.push(`title IN (SELECT c.person_title FROM category c LEFT JOIN category_zh z ON z.en=c.category WHERE ${catAlts.map(()=>'c.category LIKE ? COLLATE NOCASE OR z.zh LIKE ?').join(' OR ')})`);
		catAlts.forEach((alt)=>p.push(`%${alt}%`, `%${alt}%`));
	}
	const where = w.length ? ` WHERE ${w.join(' AND ')}` : '';
	const limit = Math.max(1, Math.min(50, Number(a.limit) || 10));
	const offset = Math.max(0, Number(a.offset) || 0);
	const total = Number((queryRows(db, `SELECT COUNT(*) n FROM person${where}`, p)[0] || {}).n || 0);
	// 缺省排序:有关键词时姓名命中的排最前(简介里提到某人的排在本人之后),其余同数据库页
	const nameFirst = kw && (!a.sort || a.sort === 'relevance');
	const order = nameFirst ? ` ORDER BY CASE WHEN ${kwAlts.map(()=>'name_zh LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE OR title LIKE ? COLLATE NOCASE').join(' OR ')} THEN 0 ELSE 1 END, (wiki_summary<>'') DESC, name COLLATE NOCASE` : (ORDER[a.sort] || ORDER.relevance);
	const rowParams = nameFirst ? p.concat(...kwAlts.map((alt)=>[`%${alt}%`, `%${alt}%`, `%${alt}%`])) : p;
	const rows = queryRows(db, `SELECT cid,name,name_zh,title,born_display,born_zh,birth_chart,pos,pos_zh,gender,rodden,sun,moon,asc,has_time,wiki_summary,summary_zh FROM person${where}${order} LIMIT ${limit} OFFSET ${offset}`, rowParams);
	const next = offset + rows.length < total ? offset + rows.length : null;
	return { total, offset, limit, nextOffset: next, items: rows.map(brief) };
}

// 分类目录(按人数降序;关键词同时匹配英文分类名与中文译名)。库里的分类只有结构化几类:出生地 / 生日 / 出生年 / 日月升度数 —— 职业等要用检索的简介关键词
export async function listCelebrityCategories(q){
	const a = q || {};
	const db = await getCelebrityDb();
	const kw = `${a.query || ''}`.trim();
	const limit = Math.max(1, Math.min(100, Number(a.limit) || 30));
	const alts = kw ? await queryAlternates(kw) : [];
	const rows = kw
		? queryRows(db, `SELECT c.category category, z.zh zh, COUNT(*) cnt FROM category c LEFT JOIN category_zh z ON z.en=c.category WHERE ${alts.map(()=>'z.zh LIKE ? OR c.category LIKE ? COLLATE NOCASE').join(' OR ')} GROUP BY c.category ORDER BY cnt DESC LIMIT ${limit}`, [].concat(...alts.map((alt)=>[`%${alt}%`, `%${alt}%`])))
		: queryRows(db, `SELECT c.category category, z.zh zh, COUNT(*) cnt FROM category c LEFT JOIN category_zh z ON z.en=c.category GROUP BY c.category ORDER BY cnt DESC, c.category LIMIT ${limit}`, []);
	return { items: rows.map((r)=>({ category: r.category, zh: r.zh || '', count: Number(r.cnt) })) };
}

// 详情:id = 名人库编号(adb-…),或给 name(中英文名 / 标题精确匹配,不分大小写);同名多人 → 回候选
export async function getCelebrity(q){
	const a = q || {};
	const db = await getCelebrityDb();
	let rows = [];
	if(a.id){ rows = queryRows(db, 'SELECT * FROM person WHERE cid=?', [`${a.id}`]); }
	else if(a.name){ rows = queryRows(db, 'SELECT * FROM person WHERE name=? COLLATE NOCASE OR title=? COLLATE NOCASE OR name_zh=? OR name_zh LIKE ? LIMIT 6', [a.name, a.name, a.name, `${a.name} (%`]); }
	if(!rows.length){ return { found: false, candidates: [] }; }
	if(rows.length > 1){ return { found: false, candidates: rows.map(brief) }; }
	const r = rows[0];
	const maxChars = Math.max(200, Math.min(6000, Number(a.maxChars) || 1500));
	const cats = queryRows(db, 'SELECT c.category category, z.zh zh FROM category c LEFT JOIN category_zh z ON z.en=c.category WHERE c.person_title=? ORDER BY c.category', [r.title]);
	return {
		found: true,
		person: {
			...brief(r),
			title: r.title,
			birthData: { birth: r.birth_chart, zone: r.zone, tzAbbr: r.tz_abbr || '', timeType: r.time_type || '', lat: r.lat, lon: r.lon, gpsLat: r.gpsLat, gpsLon: r.gpsLon, pos: r.pos, hasTime: Number(r.has_time) === 1 },
			rodden: r.rodden || '', dataSource: r.data_source || '', collector: r.collector || '', timeAccuracy: r.time_accuracy || '',
			longitudes: { sun: r.sun_lon, moon: r.moon_lon, asc: Number(r.has_time) === 1 ? r.asc_lon : null },
			summary: clip(r.summary_zh || r.wiki_summary || '', maxChars),
			summaryEn: r.summary_zh ? clip(r.wiki_summary || '', Math.floor(maxChars / 2)) : '',
			summarySource: r.summary_src || (r.wiki_summary ? 'wiki' : ''),
			relations: parseJsonArray(r.rel_json).slice(0, 20),
			events: parseJsonArray(r.evt_json).slice(0, 20),
			categories: cats.slice(0, 60).map((c)=>(c.zh ? `${c.zh}(${c.category})` : c.category)),
			links: { astroDatabank: r.adb_url || '', wikipedia: r.wiki_url || '' },
		},
		attribution: CELEBRITY_ATTRIBUTION,
	};
}
