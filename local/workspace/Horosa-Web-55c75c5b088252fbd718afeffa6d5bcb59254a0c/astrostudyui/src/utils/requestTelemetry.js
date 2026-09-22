// 请求失败留痕(页面生命周期内的内存环形缓冲):所有经 request / requestRaw / requestStream /
// chartFetch 的失败统一进账,供「复制信息」诊断文本与壳侧账本上报消费。
// 只记可诊断的骨架:去 query 的 url、分类 kind、是否静默、错误名、截断后的 message、status/code。
// 绝不存请求体 / 响应头 / 令牌;message 内嵌的带 query URL 同样剥 query。
// 调试开关:localStorage horosa.debug.requestTelemetry = '0' 时完全不记录。
import { safeLocalStorageGet } from './safeStorage';

const RING_MAX = 50;
const PATH_MAX = 30;
const MESSAGE_MAX = 200;
const NAME_MAX = 60;
const OTHER_PATH = 'other';
const KILL_SWITCH_KEY = 'horosa.debug.requestTelemetry';

let ring = [];
let total = 0;
let byKind = {};
let byPath = {};
let firstAt = null;
let lastAt = null;

function enabled(){
	return safeLocalStorageGet(KILL_SWITCH_KEY) !== '0';
}

// 去 query / hash;非字符串一律先字符串化。
export function stripUrlQuery(url){
	return `${url || ''}`.replace(/[?#].*$/, '');
}

// 取路径部分(已去 query):绝对 URL 剥 scheme://host[:port];相对路径原样。
export function pathOfUrl(urlNoQuery){
	const txt = `${urlNoQuery || ''}`;
	const m = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i.exec(txt);
	if(m){
		return m[1] || '/';
	}
	return txt;
}

function scrubMessage(msg){
	let txt = `${msg === undefined || msg === null ? '' : msg}`;
	txt = txt.replace(/(https?:\/\/[^\s?#'"<>]+)[?#][^\s'"<>]*/g, '$1');
	if(txt.length > MESSAGE_MAX){
		txt = txt.slice(0, MESSAGE_MAX);
	}
	return txt;
}

function bump(map, key){
	map[key] = (map[key] || 0) + 1;
}

export function recordRequestFailure(rec){
	try{
		if(!enabled()){
			return null;
		}
		const src = rec || {};
		const at = Date.now();
		const url = stripUrlQuery(src.url);
		const kind = `${src.kind || 'unknown'}`;
		const entry = {
			at,
			url,
			kind,
			silent: !!src.silent,
			name: src.name === undefined || src.name === null ? '' : `${src.name}`.slice(0, NAME_MAX),
			message: scrubMessage(src.message),
		};
		if(src.status !== undefined && src.status !== null){
			entry.status = src.status;
		}
		if(src.code !== undefined && src.code !== null){
			entry.code = typeof src.code === 'number' ? src.code : `${src.code}`.slice(0, NAME_MAX);
		}
		ring.push(entry);
		if(ring.length > RING_MAX){
			ring.splice(0, ring.length - RING_MAX);
		}
		total += 1;
		bump(byKind, kind);
		const p = pathOfUrl(url) || '/';
		const known = Object.prototype.hasOwnProperty.call(byPath, p);
		const distinct = Object.keys(byPath).filter((k)=>k !== OTHER_PATH).length;
		bump(byPath, known || distinct < PATH_MAX ? p : OTHER_PATH);
		if(firstAt === null){
			firstAt = at;
		}
		lastAt = at;
		return { ...entry };
	}catch(e){
		return null;
	}
}

// 深拷快照(消费方随意改动不串内部状态)。recent 按时间升序,最新在末。
export function snapshot(){
	return JSON.parse(JSON.stringify({
		total,
		firstAt,
		lastAt,
		counts: { byKind, byPath },
		recent: ring,
	}));
}

// 最近一条 url(去 query)或路径以 pathPrefix 开头的记录;无则 null。
export function lastFor(pathPrefix){
	const prefix = `${pathPrefix || ''}`;
	for(let i = ring.length - 1; i >= 0; i -= 1){
		const e = ring[i];
		if(!prefix || e.url.indexOf(prefix) === 0 || pathOfUrl(e.url).indexOf(prefix) === 0){
			return { ...e };
		}
	}
	return null;
}

export function formatClockTime(ts){
	if(ts === undefined || ts === null || !Number.isFinite(Number(ts))){
		return '--:--:--';
	}
	const d = new Date(Number(ts));
	const pad = (n)=>`${n}`.padStart(2, '0');
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 单条记录 → 「HH:mm:ss 路径 kind name」(不带 message,外发安全)。
export function formatRecentLine(entry){
	const e = entry || {};
	return `${formatClockTime(e.at)} ${pathOfUrl(e.url) || '-'} ${e.kind || 'unknown'} ${e.name || '-'}`;
}

export function formatCountsByKind(kindMap){
	const m = kindMap || {};
	return Object.keys(m).sort().map((k)=>`${k}: ${m[k]}`).join(', ');
}

export function formatForClipboard(){
	const lines = [`请求失败总数: ${total}`];
	if(total === 0){
		lines.push('最近无请求失败');
		return lines.join('\n');
	}
	lines.push(`首次: ${formatClockTime(firstAt)}  最近: ${formatClockTime(lastAt)}`);
	lines.push(`按类计数: ${formatCountsByKind(byKind)}`);
	lines.push('最近 5 条:');
	ring.slice(-5).reverse().forEach((e)=>{
		lines.push(`  ${formatRecentLine(e)}`);
	});
	return lines.join('\n');
}

export function __resetRequestTelemetryForTests(){
	ring = [];
	total = 0;
	byKind = {};
	byPath = {};
	firstAt = null;
	lastAt = null;
}
