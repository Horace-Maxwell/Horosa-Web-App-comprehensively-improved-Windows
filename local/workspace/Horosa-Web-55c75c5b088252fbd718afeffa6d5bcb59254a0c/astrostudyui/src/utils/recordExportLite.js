// [V5-UI尾款] 轻量导出件:记录列表 → CSV(研究统计/批量交付) / 单记录 → 文本摘要(外发)。
// CSV 规格:UTF-8 BOM(Excel 中文不乱码)+RFC4180 转义;列=通用核心面(两库同构字段)。
import { getCaseTypeLabel } from './localcases';

const GENDER_LABEL = { 1: '男', 0: '女', '-1': '' };

function csvCell(v){
	const s = v === undefined || v === null ? '' : `${v}`;
	if(/[",\n\r]/.test(s)){
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

function tagsOf(rec){
	try{
		const g = JSON.parse(rec.group || '[]');
		return g instanceof Array ? g.join('、') : '';
	}catch(_e){
		return '';
	}
}

// kind: 'chart' | 'case'。返回完整 CSV 文本(含表头)。
export function recordsToCsv(records, kind){
	const isChart = kind !== 'case';
	const head = isChart
		? ['姓名', '性别', '生辰', '时区', '纬度', '经度', '地点', '标签', '备注', '可信度', '资料出处']
		: ['事件', '类型', '起课时间', '时区', '纬度', '经度', '地点', '标签', '备注'];
	const lines = [head.map(csvCell).join(',')];
	(records || []).forEach((r)=>{
		if(!r){
			return;
		}
		const row = isChart
			? [r.name, GENDER_LABEL[`${r.gender}`] || '', r.birth, r.zone, r.lat, r.lon, r.pos, tagsOf(r), r.memo, r.rodden, r.sourceNote]
			: [r.event, getCaseTypeLabel(r.caseType), r.divTime, r.zone, r.lat, r.lon, r.pos, tagsOf(r), r.memo];
		lines.push(row.map(csvCell).join(','));
	});
	return `﻿${lines.join('\r\n')}`;
}

// 单记录人话摘要(剪贴板外发用)。
export function recordToTextSummary(rec, kind){
	if(!rec){
		return '';
	}
	const parts = [];
	if(kind === 'case'){
		parts.push(rec.event || '(未命名)');
		parts.push(getCaseTypeLabel(rec.caseType));
		parts.push(`${rec.divTime || ''}（${rec.zone || '+08:00'}）`);
	}else{
		parts.push(rec.name || '(未命名)');
		const g = GENDER_LABEL[`${rec.gender}`];
		if(g){
			parts.push(g);
		}
		parts.push(`${rec.birth || ''}（${rec.zone || '+08:00'}）`);
	}
	if(rec.pos){
		parts.push(rec.pos);
	}
	const tags = tagsOf(rec);
	if(tags){
		parts.push(`[${tags}]`);
	}
	if(rec.memo){
		parts.push(`备注：${rec.memo}`);
	}
	return parts.join(' · ');
}
