// [V5-D16/D17] 互换格式层:外部格式导入解析(CSV 模板/QuickChart/AAF) + 双轨导出
// (NDJSON 机器格式/Markdown 人类格式)。
//
// 导入纪律:解析只产「候选记录数组」,一律走 既有导入信封+三闸+去重四闸 入库(本层零写库);
// 解析失败的行进 errors 如实上报,绝不静默丢行。QCK/AAF 是西占界行式文本互换格式,
// 方言变体多 —— 解析尽力而为+预览确认(用户先看到解析结果再决定入库),测试锁自造夹具。
// 导出纪律:NDJSON=一行一条完整 JSON(大库流式友好/单行坏不殃及全文件,可回导);
// Markdown=人类可读档案(App 消亡也能读自己的数据),明确标注不可回导。

// ── 通用 CSV 模板导入(自家规格自家定,最可靠通道) ────────────────────────────────
// 模板列:姓名,性别(男/女/空),生辰(YYYY-MM-DD HH:mm[:ss]),时区(+08:00 可空),纬度,经度,地点
export function parseCsvCharts(text){
	const records = [];
	const errors = [];
	const lines = `${text || ''}`.replace(/^﻿/, '').split(/\r?\n/).filter((l)=>l.trim());
	if(!lines.length){
		return { records, errors: ['文件为空'] };
	}
	const startIdx = /姓名|name/i.test(lines[0]) ? 1 : 0;   // 兼容带/不带表头
	for(let i = startIdx; i < lines.length; i++){
		const cells = splitCsvLine(lines[i]);
		const [name, gender, birth, zone, lat, lon, pos] = cells;
		if(!name || !birth){
			errors.push(`第 ${i + 1} 行:缺姓名或生辰,跳过`);
			continue;
		}
		if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(birth.trim())){
			errors.push(`第 ${i + 1} 行:生辰格式应为 YYYY-MM-DD HH:mm,跳过`);
			continue;
		}
		records.push({
			name: name.trim(),
			gender: gender === '男' ? 1 : (gender === '女' ? 0 : -1),
			birth: birth.trim().replace('T', ' ').length === 16 ? `${birth.trim().replace('T', ' ')}:00` : birth.trim().replace('T', ' '),
			zone: (zone || '').trim() || '+08:00',
			lat: (lat || '').trim() || undefined,
			lon: (lon || '').trim() || undefined,
			pos: (pos || '').trim() || '',
		});
	}
	return { records, errors };
}

function splitCsvLine(line){
	const out = [];
	let cur = '';
	let quoted = false;
	for(let i = 0; i < line.length; i++){
		const c = line[i];
		if(quoted){
			if(c === '"' && line[i + 1] === '"'){
				cur += '"';
				i++;
			}else if(c === '"'){
				quoted = false;
			}else{
				cur += c;
			}
		}else if(c === '"'){
			quoted = true;
		}else if(c === ','){
			out.push(cur);
			cur = '';
		}else{
			cur += c;
		}
	}
	out.push(cur);
	return out;
}

// ── Quick*Chart(.qck)导入:行式文本,常见形态「name;date;time;zone;place;lat;lon」──────
// 方言多(分号/逗号/定宽都有流传),按分隔符探测尽力解析;解析不出的行如实报。
export function parseQckCharts(text){
	const records = [];
	const errors = [];
	const lines = `${text || ''}`.split(/\r?\n/).filter((l)=>l.trim() && !l.startsWith('#'));
	lines.forEach((line, i)=>{
		const sep = line.indexOf(';') >= 0 ? ';' : ',';
		const cells = line.split(sep).map((s)=>s.trim());
		if(cells.length < 3){
			errors.push(`第 ${i + 1} 行:字段不足,跳过`);
			return;
		}
		const [name, date, time, zone, place, lat, lon] = cells;
		const birth = normalizeDate(date, time);
		if(!name || !birth){
			errors.push(`第 ${i + 1} 行:姓名/日期无法解析,跳过`);
			return;
		}
		records.push({
			name, birth,
			zone: normalizeZone(zone) || '+08:00',
			pos: place || '',
			lat: lat || undefined,
			lon: lon || undefined,
			gender: -1,
		});
	});
	return { records, errors };
}

// ── AAF 导入:德语区行式互换格式,记录行形态「#A93:name,first,date,time,zone,place,lat,lon」──
export function parseAafCharts(text){
	const records = [];
	const errors = [];
	const lines = `${text || ''}`.split(/\r?\n/).filter((l)=>l.trim());
	lines.forEach((line, i)=>{
		if(!/^#A9[0-9]+:/.test(line)){
			return;   // 非记录行(头/注释)静默跳过
		}
		const body = line.slice(line.indexOf(':') + 1);
		const cells = body.split(',').map((s)=>s.trim());
		if(cells.length < 4){
			errors.push(`第 ${i + 1} 行:AAF 记录字段不足,跳过`);
			return;
		}
		const [last, first, date, time, zone, place, lat, lon] = cells;
		const name = [last, first].filter(Boolean).join(' ');
		const birth = normalizeDate(date, time);
		if(!name || !birth){
			errors.push(`第 ${i + 1} 行:姓名/日期无法解析,跳过`);
			return;
		}
		records.push({
			name, birth,
			zone: normalizeZone(zone) || '+00:00',
			pos: place || '',
			lat: lat || undefined,
			lon: lon || undefined,
			gender: -1,
		});
	});
	return { records, errors };
}

// 日期宽容解析:支持 YYYY-MM-DD / DD.MM.YYYY / MM/DD/YYYY;时间 HH:mm[:ss] 缺省 12:00。
function normalizeDate(date, time){
	const d = `${date || ''}`.trim();
	let y = null;
	let m = null;
	let day = null;
	let mm = null;
	if((mm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d))){
		[, y, m, day] = mm;
	}else if((mm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(d))){
		[, day, m, y] = mm;
	}else if((mm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d))){
		[, m, day, y] = mm;
	}else{
		return null;
	}
	const t = /^(\d{1,2}):(\d{2})(:(\d{2}))?/.exec(`${time || ''}`.trim()) || [null, '12', '00'];
	const p = (n)=>`${n}`.padStart(2, '0');
	return `${y}-${p(m)}-${p(day)} ${p(t[1])}:${p(t[2])}:${p(t[4] || '00')}`;
}

function normalizeZone(zone){
	const z = `${zone || ''}`.trim();
	if(/^[+-]\d{2}:\d{2}$/.test(z)){
		return z;
	}
	let m = null;
	if((m = /^(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(z))){
		return `${m[1]}${`${m[2]}`.padStart(2, '0')}:${m[3] || '00'}`;
	}
	return null;
}

// ── [D17] 双轨导出 ────────────────────────────────────────────────────────────────
// NDJSON:一行一条完整记录 JSON(可回导:每行本身就是合法记录对象)。
export function recordsToNdjson(records){
	return (records || []).filter(Boolean).map((r)=>JSON.stringify(r)).join('\n');
}

// Markdown 人类档案(标注不可回导;App 消亡也能读的数据主权格式)。
export function recordsToMarkdown(records, kind){
	const isChart = kind !== 'case';
	const out = [`# ${isChart ? '命盘档案' : '事盘档案'}`, '', `> 共 ${(records || []).length} 条 · 本文件为人类可读存档,不可回导;数据迁移请用全量备份(zip)或 NDJSON。`, ''];
	(records || []).filter(Boolean).forEach((r)=>{
		out.push(`## ${r.name || r.event || '(未命名)'}`);
		out.push('');
		if(isChart){
			out.push(`- 生辰：${r.birth || ''}（${r.zone || ''}）${r.gender === 1 ? ' · 男' : (r.gender === 0 ? ' · 女' : '')}`);
		}else{
			out.push(`- 起课：${r.divTime || ''}（${r.zone || ''}）`);
		}
		if(r.pos){
			out.push(`- 地点：${r.pos}${r.lat ? `（${r.lat}, ${r.lon}）` : ''}`);
		}
		try{
			const tags = JSON.parse(r.group || '[]');
			if(tags instanceof Array && tags.length){
				out.push(`- 标签：${tags.join('、')}`);
			}
		}catch(_e){ /* 标签坏不阻断 */ }
		if(r.rodden){
			out.push(`- 生辰可信度：${r.rodden}${r.sourceNote ? `（出处：${r.sourceNote}）` : ''}`);
		}
		if(r.memo){
			out.push('', `> ${`${r.memo}`.split('\n').join('\n> ')}`);
		}
		if(Array.isArray(r.journal) && r.journal.length){
			out.push('', '**断事日志**', '');
			r.journal.forEach((j)=>out.push(`- ${j.at}：${j.text}`));
		}
		out.push('');
	});
	return out.join('\n');
}
