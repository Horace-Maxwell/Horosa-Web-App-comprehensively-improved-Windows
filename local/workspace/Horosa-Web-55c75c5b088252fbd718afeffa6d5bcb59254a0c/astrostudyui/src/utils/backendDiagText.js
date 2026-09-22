// 「复制信息」诊断文本(纯函数):后端状态基线 + 请求失败计数 + 桌面桥诊断 + 构建指纹。
// 只输出可安全外发的内容:令牌 / 密钥类字段名一律过滤;失败条目只打印 时间 / 路径 / 类别 / 错误名,
// 不打印 message(其中可能夹带后端原文)。telemetry 为空 → 「最近无请求失败」。
import { formatClockTime, formatRecentLine, formatCountsByKind } from './requestTelemetry';

const SENSITIVE_FIELD_RE = /token|key|secret|passw|authorization|cookie|credential/i;
const VALUE_MAX = 200;
const TOP_PATHS = 5;

function fmtLatency(ms){
	if(ms === undefined || ms === null || ms === ''){
		return 'N/A';
	}
	const n = Number(ms);
	return Number.isFinite(n) ? `${Math.round(n)} ms` : 'N/A';
}

function fmtValue(v){
	if(v === undefined || v === null){
		return '';
	}
	let txt = '';
	if(typeof v === 'object'){
		try{
			txt = JSON.stringify(v);
		}catch(e){
			txt = '[object]';
		}
	}else{
		txt = `${v}`;
	}
	return txt.length > VALUE_MAX ? `${txt.slice(0, VALUE_MAX)}…` : txt;
}

// 对象 → 「  key: value」行;敏感字段名整行丢弃。
function kvLines(obj){
	if(!obj || typeof obj !== 'object'){
		return [];
	}
	return Object.keys(obj)
		.filter((k)=>!SENSITIVE_FIELD_RE.test(k))
		.map((k)=>`  ${k}: ${fmtValue(obj[k])}`);
}

function topPaths(byPath){
	const m = byPath || {};
	return Object.keys(m)
		.sort((a, b)=>(m[b] - m[a]) || (a < b ? -1 : 1))
		.slice(0, TOP_PATHS)
		.map((k)=>`${k}: ${m[k]}`)
		.join(', ');
}

export function buildBackendDiagText(input){
	const p = input || {};
	const lines = [];
	lines.push('== Horosa 后端状态 ==');
	lines.push(`时间: ${new Date().toLocaleString()}`);
	lines.push(`状态: ${p.online ? '在线' : '离线'}`);
	lines.push(`后端地址: ${p.serverRoot || '未配置'}`);
	lines.push(`地址模式: ${p.serverRootMode || '未知'}`);
	lines.push(`延迟: ${fmtLatency(p.latencyMs)}`);
	lines.push('');
	lines.push('== 请求失败 ==');
	const t = p.telemetry;
	const total = t && Number.isFinite(Number(t.total)) ? Number(t.total) : 0;
	if(!t || total <= 0){
		lines.push('最近无请求失败');
	}else{
		lines.push(`失败总数: ${total}`);
		lines.push(`首次: ${formatClockTime(t.firstAt)}  最近: ${formatClockTime(t.lastAt)}`);
		const counts = t.counts || {};
		lines.push(`按类计数: ${formatCountsByKind(counts.byKind) || '-'}`);
		const paths = topPaths(counts.byPath);
		if(paths){
			lines.push(`按路径(前 ${TOP_PATHS}): ${paths}`);
		}
		const recent = Array.isArray(t.recent) ? t.recent.slice(-5).reverse() : [];
		if(recent.length){
			lines.push('最近 5 条:');
			recent.forEach((e)=>{
				lines.push(`  ${formatRecentLine(e)}`);
			});
		}
	}
	lines.push('');
	lines.push('== 桥诊断 ==');
	const bridge = kvLines(p.bridge);
	if(bridge.length){
		bridge.forEach((l)=>lines.push(l));
	}else{
		lines.push('  不可用(非桌面环境或未采集)');
	}
	lines.push('');
	lines.push('== 构建指纹 ==');
	if(typeof p.build === 'string'){
		lines.push(`  ${p.build || '未知'}`);
	}else{
		const build = kvLines(p.build);
		if(build.length){
			build.forEach((l)=>lines.push(l));
		}else{
			lines.push('  未知');
		}
	}
	return lines.join('\n');
}
