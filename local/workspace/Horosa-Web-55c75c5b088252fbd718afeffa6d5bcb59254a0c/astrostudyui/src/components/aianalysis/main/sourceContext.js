// AI 分析主页 · 挂载源上下文状态:状态标签、上下文类型名、签名文本、浅比较、技法载入态合并、时点 / 本命源 id、经纬度与此刻格式化。
// 只被 components/aianalysis/AIAnalysisMain.js 引用。
import * as AstroHelper from '../../astro/AstroHelper';

// marked 全局配置/KaTeX 预渲染/富 markdown 渲染已抽至 utils/aiMarkdownRender(各渲染处共用单一来源;净化硬化同源)。

const CONTEXT_STATUS_META = {
	ready: { text: '已就绪', color: 'green' },
	regenerated: { text: '已按盘重算', color: 'blue' },
	missing: { text: '缺失', color: 'red' },
	// 覆盖重算失败独立态(aiAnalysisContext 闸5):无此映射会落 pending 显「待生成」,
	// 与展开后的「重算失败」emptyHint 自相矛盾且永不兑现。
	error: { text: '重算失败', color: 'volcano' },
	pending: { text: '待生成', color: 'default' },
	off: { text: '未发送', color: 'default' },   // 命主实况:这张命盘有内容但没开发送
};

export function getContextStatusMeta(status){
	return CONTEXT_STATUS_META[status] || CONTEXT_STATUS_META.pending;
}

// 挂载预览「类型」标签:内部 type 值(technique / system / 资料的 kind / 模版的 format)→ 用户认得的中文。
// 只管显示;item.type 本身仍是内部值(别处按 'technique' 判分支)。
export function getContextTypeLabel(item){
	const key = item && typeof item.key === 'string' ? item.key : '';
	if(key.indexOf('material:') === 0){ return '资料'; }
	if(key.indexOf('template:') === 0){ return '模版'; }
	const t = item ? item.type : '';
	if(t === 'technique'){ return '技法'; }
	if(t === 'system'){ return '系统'; }
	return t ? `${t}` : '';
}

// 从挂载层的 meta 里提取出生/起盘签名，方便核对「挂的是不是这张盘」。
export function buildContextSignatureText(meta){
	if(!meta || typeof meta !== 'object'){
		return '';
	}
	// 🔴 曾漏 meta.time:技法快照的 date/time 是两个字段 → 签名只到「日」,
	// 同一天不同时辰的两张盘签名一模一样(对时间确定式法尤其致命)。
	// 与 snapshotSourceMismatch 的 [date,time].join(' ') 口径一致。
	const whenPair = [meta.date, meta.time].filter(Boolean).join(' ').trim();
	// whenPair 必须最先:date+time 记录若先取 birth(常为同盘出生串)仍吃不到 time,病灶不修等于没修。
	const date = `${whenPair || meta.birth || meta.divTime || ''}`.trim();
	const zone = `${meta.zone || ''}`.trim();
	const parts = [];
	if(date){
		parts.push(date);
	}
	if(zone){
		parts.push(zone);
	}
	return parts.join(' · ');
}

function shallowEqualObject(a, b){
	if(a === b){
		return true;
	}
	const left = a && typeof a === 'object' ? a : {};
	const right = b && typeof b === 'object' ? b : {};
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if(leftKeys.length !== rightKeys.length){
		return false;
	}
	for(let i = 0; i < leftKeys.length; i += 1){
		const key = leftKeys[i];
		if(left[key] !== right[key]){
			return false;
		}
	}
	return true;
}

export function sameSourceContext(left, right){
	if(left === right){
		return true;
	}
	if(!left || !right){
		return false;
	}
	return left.content === right.content
		&& left.title === right.title
		&& left.module === right.module
		&& shallowEqualObject(left.meta, right.meta);
}

export function buildTechniqueLoadingState(keys, labelMap){
	return (keys || []).map((key)=>({
		key,
		title: labelMap.get(key) || key,
		module: key,
		content: '',
		available: false,
		status: 'loading',
		meta: {},
	}));
}

export function mergeTechniqueState(list, nextItem, keys, labelMap){
	const currentMap = new Map((list || []).map((item)=>[item.key, item]));
	if(nextItem && nextItem.key){
		currentMap.set(nextItem.key, nextItem);
	}
	return (keys || []).map((key)=>{
		if(currentMap.has(key)){
			return currentMap.get(key);
		}
		return {
			key,
			title: labelMap.get(key) || key,
			module: key,
			content: '',
			available: false,
			status: 'loading',
			meta: {},
		};
	});
}

// 「起课时间」入口：一个合成的 source（非持久化），让用户对任一时刻即时起所有时间确定式法。
export const TIMEPOINT_SOURCE_ID = 'timepoint:current';
export const NATAL_SOURCE_ID = 'natal:current';

// gps 十进制经纬 → 命盘录入用的 'NNeMM'/'NNwMM' 紧凑串(供「快速起盘」抽屉地图选点回填)。
// splitDegree 对负值只把 res[0](度)取负、res[1]/res[2](分/秒)仍是正绝对值;
// 故方向按原始符号判、度分一律取绝对值。此前手抄版把分数也取负 → 西经/南纬产出畸形串「121w0-44」
// → 后端 param error、技法挂载「缺失」(用户在美西 121°W 实测命中)。
export function gpsToLonLatStrings(gpsLat, gpsLng){
	function fmt(v, posDir, negDir){
		const d = AstroHelper.splitDegree(v);
		const deg = Math.abs(d[0] || 0);
		const min = Math.abs(d[1] || 0);
		const dir = (parseFloat(`${v}`) < 0) ? negDir : posDir;
		return `${deg}${dir}${min < 10 ? '0' + min : min}`;
	}
	return { lat: fmt(gpsLat, 'n', 's'), lon: fmt(gpsLng, 'e', 'w') };
}

export function formatTimepointNow(){
	const d = new Date();
	const p = (n)=>`${n}`.padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
