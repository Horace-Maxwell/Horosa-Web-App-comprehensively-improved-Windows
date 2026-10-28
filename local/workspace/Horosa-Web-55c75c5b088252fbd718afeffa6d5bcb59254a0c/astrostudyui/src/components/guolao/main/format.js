// 七政四余页 · 取值与格式化:安全取表、数值 / 限度对象解析与格式化、kinastro 行文本与判读档、Moira 规则完整度与样式档、名单拼接、度数归一。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import { moiraFormatGodName as formatGodName } from '../GuoLaoMoiraWheel';

export function safeList(val){
	return Array.isArray(val) ? val : [];
}

export function safeMap(val){
	return val && typeof val === 'object' ? val : {};
}

function fmtValue(value){
	if(value === undefined || value === null || value === ''){
		return '—';
	}
	if(Array.isArray(value)){
		const text = value.map((item)=>fmtValue(item)).filter((item)=>item && item !== '—').join('、');
		return text || '—';
	}
	if(typeof value === 'object'){
		const text = Object.keys(value).map((key)=>{
			const val = fmtValue(value[key]);
			return val && val !== '—' ? `${key}：${val}` : '';
		}).filter(Boolean).join('；');
		return text || '—';
	}
	return `${value}`.replace(/None/g, '无');
}

function isQizhengLimitObject(value){
	return (value && typeof value === 'object' && !Array.isArray(value)
		&& (
			value.start_age !== undefined
			|| value.end_age !== undefined
			|| value.start_year !== undefined
			|| value.end_year !== undefined
			|| value.palace_name !== undefined
		))
		|| (typeof value === 'string' && /(?:palace_name|start_age|end_age|start_year|end_year)\s*[:：]/.test(value));
}

function parseQizhengLimitValue(value){
	if(value && typeof value === 'object' && !Array.isArray(value)){
		return safeMap(value);
	}
	if(typeof value !== 'string'){
		return {};
	}
	return value.split(/[;；]/).reduce((map, part)=>{
		const pair = `${part || ''}`.split(/[:：]/);
		if(pair.length < 2){
			return map;
		}
		const key = pair.shift().trim();
		const val = pair.join(':').trim();
		if(key){
			map[key] = val;
		}
		return map;
	}, {});
}

function fmtQizhengLimitObject(value){
	const item = parseQizhengLimitValue(value);
	const ageText = item.start_age !== undefined || item.end_age !== undefined
		? `${fmtValue(item.start_age)}-${fmtValue(item.end_age)}岁`
		: '';
	const yearText = item.start_year !== undefined || item.end_year !== undefined
		? `${fmtValue(item.start_year)}-${fmtValue(item.end_year)}年`
		: '';
	const parts = [
		item.palace_name,
		item.lord,
		item.branch_name || item.branch,
		ageText,
		yearText,
	].map((val)=>fmtValue(val)).filter((val)=>val && val !== '—');
	return parts.join(' | ') || '—';
}

export function fmtQizhengKinRowValue(row){
	const value = row ? row.value : null;
	if(isQizhengLimitObject(value)){
		return fmtQizhengLimitObject(value);
	}
	return fmtValue(value);
}

export function splitQizhengKinDisplayLines(value){
	const text = fmtValue(value);
	if(!/[;；]/.test(text)){
		return [text];
	}
	const lines = [];
	let current = '';
	text.split(/([;；])/).forEach((part)=>{
		if(!part){
			return;
		}
		current += part;
		if(part === ';' || part === '；'){
			const line = current.trim();
			if(line){
				lines.push(line);
			}
			current = '';
		}
	});
	const last = current.trim();
	if(last){
		lines.push(last);
	}
	return lines.length ? lines : [text];
}

export function qizhengKinReadingLevel(row){
	const title = row && row.label ? `${row.label}` : '';
	const value = fmtQizhengKinRowValue(row);
	const text = `${title} ${value}`;
	if(/忌格|忌|凶|破|败|失|刑|害|陷|空亡/.test(text)){
		return 'bad';
	}
	if(/喜格|吉|合格|贵|福|禄|旺|德|拱/.test(text)){
		return 'good';
	}
	return 'neutral';
}

export function qizhengKinReadingBadge(level){
	if(level === 'bad'){
		return '忌';
	}
	if(level === 'good'){
		return '吉';
	}
	return '断';
}

export function hasUnverifiedMoiraPatternSource(value){
	return value && (
		value.styleSource === 'moira-dsl-not-evaluated'
		|| value.engine === 'moira-rules-on-horosa-ephemeris'
		|| value.version === 'qizheng-moira-rules-v1'
	);
}

export function isIncompleteMoiraRules(value){
	if(!value){
		return true;
	}
	if(hasUnverifiedMoiraPatternSource(value)){
		return true;
	}
	const text = `${value.styleWarning || ''} ${value.summary || ''} ${value.message || ''}`;
	return (
		text.indexOf('仍在接入') >= 0
		|| text.indexOf('暂不输出') >= 0
		|| text.indexOf('暂不生成') >= 0
		|| text.indexOf('未返回完整') >= 0
		|| !Array.isArray(value.patterns)
	);
}

export function moiraStyleLevelMeta(rules, currentLevel){
	const min = Number(rules && rules.styleLevelMin) || 1;
	const max = Number(rules && rules.styleLevelMax) || 5;
	const def = Number(rules && rules.styleLevel) || 3;
	let level = currentLevel === undefined || currentLevel === null ? def : Number(currentLevel);
	if(!Number.isFinite(level)){
		level = def;
	}
	level = Math.max(min, Math.min(max, Math.round(level)));
	return {
		min,
		max,
		level,
		displayLevel: max - level,
		fillMax: Number(rules && rules.styleFillMax) || 6,
	};
}

export function applyMoiraStyleLevel(list, meta){
	const displayLevel = Number(meta && meta.displayLevel) || 0;
	const fillMax = Number(meta && meta.fillMax) || 6;
	const result = [];
	safeList(list).forEach((item)=>{
		const level = Number(item && item.moiraLevel);
		const rank = Number(item && item.moiraRank);
		const moiraLevel = Number.isFinite(level) ? level : 0;
		const moiraRank = Number.isFinite(rank) ? rank : 65536;
		if(moiraLevel < displayLevel){
			return;
		}
		if(moiraLevel === displayLevel && moiraRank < 65536 && result.length >= fillMax){
			return;
		}
		result.push(item);
	});
	return result;
}

export function joinNames(list){
	const arr = safeList(list).map(formatGodName).filter(Boolean);
	return arr.length ? arr.join('、') : '无';
}

export function joinMoiraYearItems(items){
	return safeList(items).map((item)=>{
		if(item && typeof item === 'object'){
			return [item.name, item.star ? `化${item.star}` : ''].filter(Boolean).join(' ');
		}
		return `${item || ''}`;
	}).filter(Boolean).join('、');
}

export function normDegree(val){
	let deg = Number(val);
	if(!Number.isFinite(deg)){
		return null;
	}
	deg %= 360;
	if(deg < 0){
		deg += 360;
	}
	return deg;
}
