// AI 快照的分段工具与大运段(扩展大运 / 子运表)
// 从 IndiaChart.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { civilInstantMsOfStr, formatSignedDate } from '../../../utils/dateStrSafe';
import { civilYmdOfLocalDate } from '../../../utils/civilCalendar';
import { charaAntarYears } from '../indiaMain/dasha';
import * as AstroConst from '../../../constants/AstroConst';
import { parseDateTimeMs } from '../../../utils/dateTimeParse';

export function splitSections(text){
	const lines = `${text || ''}`.split('\n');
	const map = {};
	let current = '';
	lines.forEach((line)=>{
		const trimmed = `${line || ''}`.trim();
		const matched = trimmed.match(/^\[(.+)\]$/);
		if(matched && matched[1]){
			current = matched[1].trim();
			if(!map[current]){
				map[current] = [];
			}
			return;
		}
		if(!current){
			return;
		}
		map[current].push(line);
	});
	return map;
}

export function ensureSection(lines, title, body){
	// 段内保留单个空行(两张表 / 表与正文之间的分隔),首尾空行与连续空行收掉
	const clean = (body || []).map((line)=>`${line || ''}`.trimEnd())
		.filter((line, i, arr)=>line.trim() || (i > 0 && arr[i - 1].trim()));
	while(clean.length && !clean[0].trim()){ clean.shift(); }
	while(clean.length && !clean[clean.length - 1].trim()){ clean.pop(); }
	lines.push(`[${title}]`);
	if(clean.length){
		lines.push(...clean);
	}else{
		lines.push('无数据');
	}
	lines.push('');
}

// Vimshottari 大运（120 年周期）：后端 jyotish.dasha.vimshottari 已算好，挂载快照一并输出。
// 字段形态与命盘 Dasha 面板(buildVimshottariDasha)一致;无数据则返回空(快照跳过该段)。
const DASHA_SYSTEM_SNAPSHOT_LABEL = {
	vimshottari: 'Vimshottari（120 年周期）',
	yogini: 'Yogini（36 年 · 8 女神）',
	ashtottari: 'Ashtottari（108 年 · Ardradi）',
	tribhagi: 'Tribhāgī（Vimśottarī÷3 · 3 遍×40=120 年）',
	shodashottari: 'Shodashottari（116 年 · 条件）',
	dvadashottari: 'Dvadashottari（112 年 · 条件）',
	panchottari: 'Panchottari（105 年 · 条件）',
	shatabdika: 'Shatabdika（100 年 · 条件）',
	chaturashitiSama: 'Chaturashiti-sama（84 年 · 条件）',
	dwisaptatiSama: 'Dwisaptati-sama（72 年 · 条件）',
	shashtihayani: 'Shashtihayani（60 年 · 条件）',
	shattrimshaSama: 'Shattrimsha-sama（36 年 · 条件）',
	chara: 'Chara 耆那星座大运（Jaimini · 按座推）',
	taraDasha: 'Tāra 大运（kendra 强度序 · Vimshottari 年表）',
	akkg: 'AKKG（Karaka Kendradi Graha · AK 播种）',
};

// 出生时刻(本地钟表时)轻量解析:仅供扩展大运快照推日期;BC(ad=0)或缺字段 → null(段退化为无日期序列)。
function snapshotBirthDate(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){ return null; }
	if(fields.ad && fields.ad.value !== undefined && Number(fields.ad.value) === 0){ return null; }
	const d = fields.date.value, t = fields.time.value;
	if(!d.format || !t.format){ return null; }
	// 真实时刻(民用历:1582 以前儒略历、公元前历史纪年;现代与 parseDateTimeMs 逐值相同),与右栏大运树的出生时刻同一天
	const dt = new Date(civilInstantMsOfStr(`${d.format('YYYY-MM-DD')}T${t.format('HH:mm:ss')}`));
	return Number.isFinite(dt.getTime()) ? dt : null;
}

// Chara/8 条件宿系大运的快照段:后端只给年数序列(extendedDashas),日期与右栏组树同口径
// (条件系 start = birth − firstElapsedYears;chara 自出生起逐段累加;年长同 vimshottari.yearLengthDays)。
function buildExtendedDashaSnapshotLines(chartObj, sys, fields){
	const j = chartObj && chartObj.jyotish;
	const ed = j && j.extendedDashas;
	if(!ed){ return []; }
	const yearDays = (j.dasha && j.dasha.vimshottari && Number(j.dasha.vimshottari.yearLengthDays)) || 365.25;
	const birth = snapshotBirthDate(fields);
	const dayMs = 86400000;
	// 本地切日(与解析同时区自洽,亦与右栏 moment 组树同口径);toISOString 的 UTC 切日会偏一天。
	const fmt = (ms)=>{
		const q = civilYmdOfLocalDate(new Date(ms));   // 本地那一天的民用历标签(与右栏 flatlibCalendarFields 同口径)
		return formatSignedDate(q.year, q.month, q.day);
	};
	const nowMs = Date.now();
	const out = [];
	const pushSeq = (rows)=>{
		out.push('大运序列：');
		out.push('| 主 | 年数 | 起 | 讫 |');
		out.push('| --- | --- | --- | --- |');
		rows.forEach((r)=>out.push(`| ${r.name}${r.active ? '（当前）' : ''} | ${r.years} | ${r.start} | ${r.end} |`));
	};
	if(sys === 'chara'){
		const c = ed.chara;
		if(!c || !Array.isArray(c.mahadashas) || !c.mahadashas.length){ return []; }
		out.push(`系统：${DASHA_SYSTEM_SNAPSHOT_LABEL.chara}`);
		out.push(`起座：${c.seedLabel || c.seed || '—'}（${c.direction === 'reverse' ? '逆推' : '顺推'}）`);
		let cur = birth ? birth.getTime() : null;
		const antarMahas = [];
		pushSeq(c.mahadashas.map((m)=>{
			const years = m.years || 0;
			let startS = '—', endS = '—', active = false;
			const mStart = cur;
			if(cur !== null){
				const end = cur + years * yearDays * dayMs;
				active = nowMs >= cur && nowMs < end;
				startS = fmt(cur); endS = fmt(end);
				cur = end;
			}
			// 中运:座序取引擎(中运首座开关),各段年数与页面大运树同一份切分(中运分割开关)。
			const durs = charaAntarYears(m, fields);
			let ac = mStart;
			antarMahas.push({ lord: { label: m.rasiLabel || m.rasi }, active, antardashas: (m.antardashas || []).map((a, ai)=>{
				const dy = durs[ai] || 0;
				let s0 = null, e0 = null;
				if(ac !== null){ s0 = fmt(ac); ac += dy * yearDays * dayMs; e0 = fmt(ac); }
				return { lord: { label: a.rasiLabel || a.rasi }, start: s0, end: e0, years: dy };
			}) });
			return { name: m.rasiLabel || m.rasi, years: `${years}`, start: startS, end: endS, active };
		}));
		out.push(...buildAntardashaTableLines(antarMahas, {
			nameOf: (l)=>(l && l.label) || '—',
			fmtDate: (d)=>(d || '—'),
			n1: (x)=>(Number.isFinite(+x) ? (+x) : 0),
		}));
		return out;
	}
	const c = ed.conditional && ed.conditional[sys];
	if(!c || !Array.isArray(c.mahadashas) || !c.mahadashas.length){ return []; }
	out.push(`系统：${DASHA_SYSTEM_SNAPSHOT_LABEL[sys] || c.label || sys}`);
	const nameOfLord = (lord)=>(lord && (lord.label || lord.key)) || '—';
	out.push(`首运：${nameOfLord(c.firstLord)}（已历 ${(+c.firstElapsedYears || 0).toFixed(1)} 年、余 ${(+c.firstBalanceYears || 0).toFixed(1)} 年）`);
	let cur = birth ? (birth.getTime() - (+c.firstElapsedYears || 0) * yearDays * dayMs) : null;
	pushSeq(c.mahadashas.map((m, i)=>{
		// 起点是 cycle_start(出生−已历),故每段(含首段)一律满期年;首段取余额会令整轴前移。
		const years = (m.fullYears != null ? m.fullYears : m.years) || 0;
		let startS = '—', endS = '—', active = false;
		if(cur !== null){
			const end = cur + years * yearDays * dayMs;
			active = nowMs >= cur && nowMs < end;
			startS = fmt(cur); endS = fmt(end);
			cur = end;
		}
		const yearsS = (i === 0 && m.balance) ? `${years}（含出生前已历 ${(+c.firstElapsedYears || 0).toFixed(1)} 年）` : `${years}`;
		return { name: nameOfLord(m.lord), years: yearsS, start: startS, end: endS, active };
	}));
	return out;
}

// [Windows #80] 小运(Antardasha)全展:此前只在「当前大运」里挑出当下这一支,其余八个大运的小运
// 后端本就随每个 mahadasha 一并返回(IndiaChartMain 逐条渲染在用),快照却整片不出 ——
// AI 因此答「没有完整的 Dasha 表」。9×9=81 行 ≈4 千字,在挂载预算内;超上限则截断并明说截了。
export const DASHA_ANTAR_ROW_MAX = 120;
export function buildAntardashaTableLines(mahadashas, helpers){
	const list = Array.isArray(mahadashas) ? mahadashas : [];
	const { nameOf, fmtDate, n1 } = helpers || {};
	if(!list.length || typeof nameOf !== 'function'){
		return [];
	}
	const now = Date.now();
	const rows = [];
	let truncated = false;
	list.forEach((m)=>{
		if(!m || !Array.isArray(m.antardashas) || !m.antardashas.length){ return; }
		m.antardashas.forEach((a)=>{
			if(!a){ return; }
			if(rows.length >= DASHA_ANTAR_ROW_MAX){ truncated = true; return; }
			// 段界日期标签是民用历(1582 以前儒略历),换成真实时刻再与此刻比
			const st = a.start ? civilInstantMsOfStr(`${a.start}`) : NaN;
			const en = a.end ? civilInstantMsOfStr(`${a.end}`) : NaN;
			const live = Number.isFinite(st) && Number.isFinite(en) && st <= now && now < en;
			rows.push(`| ${live ? '▶' : (m.active ? '·' : '')} | ${nameOf(m.lord)} | ${nameOf(a.lord)} | ${fmtDate(a.start)} | ${fmtDate(a.end)} | ${n1(a.years).toFixed(1)} 年 |`);
		});
	});
	if(!rows.length){
		return [];
	}
	const out = ['小运序列(Antardasha,全大运展开;▶=当下、·=当前大运内):',
		'| 标记 | 大运主星 | 小运主星 | 起 | 止 | 年数 |',
		'| --- | --- | --- | --- | --- | --- |',
		...rows];
	if(truncated){
		out.push(`（小运行数超过 ${DASHA_ANTAR_ROW_MAX} 已截断;未列出的不代表不存在,勿臆补。）`);
	}
	return out;
}

export function buildDashaSnapshotLines(chartObj, system, fields){
	const sys = AstroConst.normalizeIndiaDashaSystem(system);
	const j = chartObj && chartObj.jyotish;
	const ed = j && j.extendedDashas;
	// chara/条件系:树在 extendedDashas(引擎 4 树以外),快照与右栏所见同体系(账实一致)。
	if(sys === 'chara' || (ed && ed.conditional && ed.conditional[sys])){
		const extLines = buildExtendedDashaSnapshotLines(chartObj, sys, fields);
		if(extLines.length){ return extLines; }
	}
	const dashaRoot = chartObj && chartObj.jyotish && chartObj.jyotish.dasha;
	// AKKG:平铺形状(planetCN/years/cycle/start/end,无 lord 树)→ 专段(勿走 4 树表,否则全 '—')。
	if(sys === 'akkg'){
		const a = dashaRoot && dashaRoot.akkg;
		if(a && a.available && Array.isArray(a.mahadashas) && a.mahadashas.length){
			const out = [];
			out.push(`系统：${DASHA_SYSTEM_SNAPSHOT_LABEL.akkg}`);
			out.push(`Ātmakāraka：${a.atmakaraka || '—'}（座 ${a.seedSign || '—'}）`);
			out.push('大运序列：');
			out.push('| 主 | 轮 | 年数 | 起 | 讫 |');
			out.push('| --- | --- | --- | --- | --- |');
			a.mahadashas.forEach((m)=>{
				out.push(`| ${m.planetCN || m.planet} | ${m.cycle} | ${m.years} | ${m.start || '—'} | ${m.end || '—'} |`);
			});
			return out;
		}
		return [];
	}
	const v = dashaRoot && (dashaRoot[sys] || dashaRoot.vimshottari);
	if(!v || !v.available || !Array.isArray(v.mahadashas) || !v.mahadashas.length){
		return [];
	}
	const nameOf = (lord)=>(lord && (lord.label || lord.key)) || '—';
	const fmtDate = (d)=>{ const s = `${d || ''}`; const m = s.match(/^(-?\d{4,6}-\d{2}-\d{2})/); return m ? m[1] : (s || '—'); };   // 年带符号(公元前 / 五位年)
	const n1 = (x)=>(Number.isFinite(+x) ? (+x) : 0);
	const out = [];
	const nak = v.moonNakshatra || {};
	out.push(`系统：${DASHA_SYSTEM_SNAPSHOT_LABEL[sys] || DASHA_SYSTEM_SNAPSHOT_LABEL.vimshottari}`);
	const nakName = (nak.label && nak.name) ? `${nak.name}（${nak.label}宿）` : (nak.label || nak.name || nak.key || '—');
	out.push(`月宿：${nakName}（宿主星 ${nameOf(v.firstLord)}）`);
	out.push(`首运：已历 ${n1(v.firstElapsedYears).toFixed(1)} 年、余 ${n1(v.firstBalanceYears).toFixed(1)} 年`);
	const active = v.mahadashas.find((m)=>m && m.active);
	if(active){
		out.push(`当前大运（Mahadasha）：${nameOf(active.lord)}（${fmtDate(active.start)} → ${fmtDate(active.end)}，${n1(active.startAge).toFixed(0)}–${n1(active.endAge).toFixed(0)} 岁）`);
		if(Array.isArray(active.antardashas) && active.antardashas.length){
			// 段界取精确 ISO(当地时刻);只有日期的旧串按当地 0 点解析(new Date('YYYY-MM-DD') 是 UTC 0 点,边界日差一天)。
			const now = Date.now();
			const at = (iso, d)=>{
				// 精确 ISO 是计算服务给的真实时刻(外推格里历);只有日期标签时按民用历换成当地 0 点的真实时刻
				const t = iso ? parseDateTimeMs(iso) : (d ? civilInstantMsOfStr(`${d}T00:00:00`) : NaN);
				return Number.isFinite(t) ? t : NaN;
			};
			const sub = active.antardashas.find((s)=>{
				if(!s || !s.start || !s.end){ return false; }
				const st = at(s.startIso, s.start); const en = at(s.endIso, s.end);
				return st <= now && now < en;
			});
			if(sub){
				out.push(`当前小运（Antardasha）：${nameOf(sub.lord)}（${fmtDate(sub.start)} → ${fmtDate(sub.end)}）`);
			}
		}
	}
	out.push('大运序列：');
	// 平铺大运时间表改 GFM 表(经归一器直通、docx/PDF 渲染真表)。
	// 单元格值表达式逐字同源:nameOf/fmtDate/n1;标记列 ▶=当前、·=出生余量(原行首标记原义)。
	out.push('| 标记 | 主星 | 起 | 止 | 年数 | 年龄段 |');
	out.push('| --- | --- | --- | --- | --- | --- |');
	v.mahadashas.forEach((m)=>{
		const mark = m.active ? '▶' : (m.birthBalance ? '·' : '');
		out.push(`| ${mark} | ${nameOf(m.lord)} | ${fmtDate(m.start)} | ${fmtDate(m.end)} | ${n1(m.years).toFixed(1)} 年 | ${n1(m.startAge).toFixed(0)}–${n1(m.endAge).toFixed(0)} 岁 |`);
	});
	out.push(...buildAntardashaTableLines(v.mahadashas, { nameOf, fmtDate, n1 }));
	return out;
}

// GFM 表助手：表头词组 + 行单元格数组 → GFM 表行(表头/分隔/数据)；单元格值逐字同源仅以 | 分隔。
// 置于函数前(模块层)：不占函数体内字符偏移，护段头 22k 源切片哨兵；散文行由调用方 spread 混排。
export const gfmTable = (heads, rows)=>{
	const bar = (cells)=>`| ${cells.join(' | ')} |`;
	return [bar(heads), bar(heads.map(()=>'---')), ...rows.map(bar)];
};
