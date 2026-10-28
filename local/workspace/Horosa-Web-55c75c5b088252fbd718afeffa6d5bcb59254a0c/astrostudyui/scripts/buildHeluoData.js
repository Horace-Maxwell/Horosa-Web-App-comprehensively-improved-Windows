/* eslint-disable no-console */
// 河洛理数 条文 builder — parses the 5 Obsidian md sources into one JSON keyed by 卦名.
// Source dir (override with HELUO_SRC env). Read-only on the vault; writes src/utils/data/heluoTiaowen.json.
// All 5 files share King Wen order (64 卦); we JOIN BY INDEX (0-63) and cross-check 卦名.
const fs = require('fs');
const path = require('path');

const SRC = process.env.HELUO_SRC
	|| './heluo-source';
const OUT = path.join(__dirname, '..', 'src', 'utils', 'data', 'heluoTiaowen.json');

const FILES = {
	meaning: '六十四卦卦意.md',
	jue: '河洛理數六十四卦訣.md',
	detail: '河洛理數三百八十四爻辭詳解.md',
	simple: '簡便爻辭.md',
	mingtiao: '條文大全.md',
};

// Two 爻-naming conventions:
//  named-style (File 2/3): 初/二/三/四/五 + 上 for pos6; 九/六 are POLARITY, never position (六 ≠ pos6).
//  generic-style (File 4): 變初爻…變六爻 — here 六 DOES mean pos6.
const POS_NAMED = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6 };
const POS_GENERIC = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6, 六: 6 };
function scanPos(s, table) { for (const ch of (s || '')) { if (table[ch]) return table[ch]; } return 0; }
function yaoPosNamed(s) { return scanPos(s, POS_NAMED); }   // File 2/3
function yaoPos(s) { return scanPos(s, POS_GENERIC); }      // File 4

function read(file) {
	return fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r\n/g, '\n');
}
function stripStars(s) { return (s || '').replace(/\*+/g, '').trim(); }
function cleanName(s) { return stripStars(s).replace(/[。\s]/g, ''); }
function joinBody(lines) { return lines.map((l) => l.trim()).filter(Boolean).join('\n'); }

// Split a file body into [{head, lines:[]}] by a header predicate.
function sectionize(text, isHead) {
	const out = [];
	let cur = null;
	text.split('\n').forEach((line) => {
		const h = isHead(line);
		if (h !== false && h !== undefined && h !== null) {
			cur = { head: h, lines: [] };
			out.push(cur);
		} else if (cur) {
			cur.lines.push(line);
		}
	});
	return out;
}

// ── File 1: 六十四卦卦意  ### **卦名：吉凶** + prose ──
function parseMeaning() {
	const text = read(FILES.meaning);
	const secs = sectionize(text, (line) => {
		const m = line.match(/^###\s*(.+?)\s*$/);
		if (!m) return false;
		const inner = stripStars(m[1]).replace(/[。\s]/g, '');   // 兌為澤****。****吉 → 兌為澤吉
		const ci = inner.search(/[：:]/);
		let name = ci >= 0 ? inner.slice(0, ci) : inner;
		let verdict = ci >= 0 ? inner.slice(ci + 1) : '';
		const vm = name.match(/(中?[吉凶平])$/);              // verdict appended w/o colon
		if (vm && name.length - vm[1].length >= 2) { verdict = verdict || vm[1]; name = name.slice(0, -vm[1].length); }
		return { name, verdict: verdict.replace(/[。\s]/g, '') };
	});
	return secs.map((s) => {
		const body = s.lines.map((l) => l.trim()).filter(Boolean);
		return { name: s.head.name, verdict: s.head.verdict, gist: body[0] || '', meaning: body.join('\n') };
	});
}

// ── File 5: 條文大全  (skip ## intro)  ### 卦名 + 先天/后天/流年(值年) bullets ──
function parseMingtiao() {
	const text = read(FILES.mingtiao);
	const secs = sectionize(text, (line) => {
		const m = line.match(/^###\s+(.+?)\s*$/); // plain, no bold
		if (!m) return false;
		return { name: cleanName(m[1]) };
	});
	return secs.map((s) => {
		// split lines into slots by bullet headers
		const slots = [];
		let slot = null;
		s.lines.forEach((line) => {
			const b = line.match(/^-\s*\*\*(.+?)\*\*\s*$/);
			if (b) { slot = { label: stripStars(b[1]).replace(/[：:]/g, ''), lines: [] }; slots.push(slot); }
			else if (slot && !/^!\[/.test(line.trim())) slot.lines.push(line);
		});
		const pick = (i) => (slots[i] ? joinBody(slots[i].lines) : '');
		return { name: s.name, xiantian: pick(0), houtian: pick(1), liunian: pick(2) };
	});
}

// ── File 2: 六十四卦訣  (skip #### preface)  ### **X卦總訣：卦辞** + 6× - **N爻訣：爻辞** ──
function parseJue() {
	const text = read(FILES.jue);
	const secs = sectionize(text, (line) => {
		const m = line.match(/^###\s*\*\*(.+?)總訣[：:](.*)\*\*\s*$/);
		if (!m) return false;
		return { name: cleanName(m[1]).replace(/卦$/, ''), guaci: stripStars(m[2]) };
	});
	return secs.map((s) => {
		// before first "- **" bullet → 总诀诗; then 6 爻
		const yao = {};
		let zongLines = [];
		let cur = null;
		s.lines.forEach((line) => {
			const b = line.match(/^(?:-\s*)?\*\*(.+?)爻訣[：:](.*)\*\*\s*$/);
			if (b) { cur = { pos: yaoPosNamed(b[1]), yaoci: stripStars(b[2]), lines: [] }; if (cur.pos) yao[cur.pos] = cur; }
			else if (cur) cur.lines.push(line);
			else zongLines.push(line);
		});
		const yaoOut = {};
		Object.keys(yao).forEach((p) => { yaoOut[p] = { yaoci: yao[p].yaoci, shige: joinBody(yao[p].lines) }; });
		return { name: s.name, guaci: s.head.guaci, zongjue: joinBody(zongLines), yao: yaoOut };
	});
}

// ── File 3: 三百八十四爻辭詳解  ### **卦名** + 6× - **變…：** prose(摘要) ──
function parseDetail() {
	const text = read(FILES.detail);
	const secs = sectionize(text, (line) => {
		const m = line.match(/^###\s*\*\*(.+?)\*\*\s*$/);
		if (!m) return false;
		return { name: cleanName(m[1]) };
	});
	return secs.map((s) => {
		const yao = {};
		let cur = null;
		s.lines.forEach((line) => {
			const b = line.match(/^(?:-\s*)?\*\*變(.+?)\*\*\s*$/);
			if (b) { cur = { pos: yaoPosNamed(b[1]), lines: [] }; if (cur.pos) yao[cur.pos] = cur; }
			else if (cur) cur.lines.push(line);
		});
		const yaoOut = {};
		Object.keys(yao).forEach((p) => { yaoOut[p] = joinBody(yao[p].lines); });
		return { name: s.name, yao: yaoOut };
	});
}

// ── File 4: 簡便爻辭  ### **序、卦名** (or bullet for #47) + 6× - **變…：verdict** classical + • vernacular ──
function parseSimple() {
	const text = read(FILES.simple);
	const secs = sectionize(text, (line) => {
		// hexagram header: **序、卦名** (### or bullet), NOT a 變 entry
		const m = line.match(/^(?:###\s*|-\s*)\*\*([一二三四五六七八九十百]+)、(.+?)\*\*\s*$/);
		if (!m || /變/.test(line)) return false;
		return { name: cleanName(m[2]) };
	});
	return secs.map((s) => {
		const yao = {};
		let cur = null;
		s.lines.forEach((line) => {
			const b = line.match(/^(?:-\s*)?\*\*變(.+?)\*\*\s*$/);
			if (b) {
				const inner = stripStars(b[1]);
				const verdict = (inner.split(/：|:/)[1] || '').replace(/\s/g, '');
				cur = { pos: yaoPos(inner), verdict, cls: [], vern: [] };
				if (cur.pos) yao[cur.pos] = cur;
			} else if (cur) {
				const t = line.trim();
				if (/^[•·]/.test(t)) cur.vern.push(t.replace(/^[•·]\s*/, ''));
				else if (t) cur.cls.push(t);
			}
		});
		const yaoOut = {};
		Object.keys(yao).forEach((p) => {
			yaoOut[p] = { verdict: yao[p].verdict, simple: yao[p].cls.join('\n'), vernacular: yao[p].vern.join('\n') };
		});
		return { name: s.name, yao: yaoOut };
	});
}

// ── 易經人間道 逐爻推命（替换"简便"层）──
const NIHAIXIA = process.env.NIHAIXIA
	|| './nihaixia-yijing.md';
// 源文偶有简体卦名（如 天雷无妄），归一化到繁体再匹配
const S2T = { 无: '無', 随: '隨', 蛊: '蠱', 贲: '賁', 剥: '剝', 复: '復', 颐: '頤', 过: '過', 观: '觀', 济: '濟', 渐: '漸', 归: '歸', 丰: '豐', 涣: '渙', 节: '節', 兑: '兌', 离: '離', 为: '為', 风: '風', 泽: '澤', 师: '師', 谦: '謙', 临: '臨', 壮: '壯' };
function toTrad(s) { return [...(s || '')].map((c) => S2T[c] || c).join(''); }
function parseNihaixia(canonNames) {
	let text;
	try { text = fs.readFileSync(NIHAIXIA, 'utf8').replace(/\r\n/g, '\n'); } catch (e) { console.warn('!! 人間道 source missing:', NIHAIXIA); return {}; }
	const nameSet = new Set(canonNames);
	const result = {};
	let curGua = null;
	let inRen = false;
	let curYao = 0;
	let buf = [];
	const flush = () => {
		if (curGua && curYao && buf.length) {
			result[curGua] = result[curGua] || {};
			if (!result[curGua][curYao]) result[curGua][curYao] = joinBody(buf);
		}
		buf = [];
	};
	text.split('\n').forEach((line) => {
		const h1 = line.match(/^#\s+(.+?)\s*$/);
		if (h1) { flush(); const nm = toTrad(h1[1].trim()); curGua = nameSet.has(nm) ? nm : null; inRen = false; curYao = 0; return; }
		const h2 = line.match(/^##\s+(.+?)\s*$/);
		if (h2) { flush(); inRen = /人[間间]道/.test(h2[1]); curYao = 0; return; }
		if (!inRen || !curGua) return;
		const ym = line.match(/^(初[九六]|[九六][二三四五]|上[九六])[：:]/);
		if (ym) { flush(); curYao = yaoPosNamed(ym[1]); buf = [line.trim()]; return; }
		if (/^(用[九六]|彖曰|大象|象曰)[：:]/.test(line)) { flush(); curYao = 0; return; }
		if (curYao) buf.push(line);
	});
	flush();
	return result;
}

function main() {
	const meaning = parseMeaning();
	const mingtiao = parseMingtiao();
	const jue = parseJue();
	const detail = parseDetail();
	const simple = parseSimple();
	// 易经推命：用户 xlsx「易經推命資料」表(A1:D65)抽出的 先天/后天/流年 三栏(王弗序)，已落地 heluoNihaixiaRaw.json
	let nhxRaw = [];
	try { nhxRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'data', 'heluoNihaixiaRaw.json'), 'utf8')); } catch (e) { console.warn('!! heluoNihaixiaRaw.json missing — 易经推命回退到 條文大全'); }
	console.log('易经推命(xlsx) rows:', nhxRaw.length);

	const counts = {
		meaning: meaning.length, mingtiao: mingtiao.length, jue: jue.length,
		detail: detail.length, simple: simple.length,
	};
	console.log('section counts:', counts);
	Object.entries(counts).forEach(([k, v]) => { if (v !== 64) console.warn(`!! ${k} has ${v} sections (expected 64)`); });

	// canonical = File 1 order; join others by index
	const out = {};
	meaning.forEach((m, i) => {
		const name = m.name;
		const j = jue[i] || {};
		const d = detail[i] || {};
		const s = simple[i] || {};
		const mt = mingtiao[i] || {};
		// cross-check names (warn only)
		[['jue', j.name && j.name.slice(0, 1)], ['detail', d.name], ['simple', s.name], ['mingtiao', mt.name]]
			.forEach(([f, n]) => {
				if (f === 'jue') { if (n && !name.includes(n)) console.warn(`name xcheck jue[${i}] ${name} vs ${n}`); }
				else if (n && n !== name) console.warn(`name xcheck ${f}[${i}] ${name} vs ${n}`);
			});
		const yao = {};
		for (let p = 1; p <= 6; p += 1) {
			const jy = (j.yao || {})[p] || {};
			const sy = (s.yao || {})[p] || {};
			yao[p] = {
				yaoci: jy.yaoci || '',
				shige: jy.shige || '',
				detail: (d.yao || {})[p] || '',
				verdict: sy.verdict || '',
			};
		}
		// 易经推命(先天/后天/流年)优先用 xlsx 抽出数据，按王弗序对齐；缺则回退 條文大全
		const nx = nhxRaw[i] || {};
		out[name] = {
			index: i + 1,
			verdict: m.verdict,
			gist: m.gist,
			meaning: m.meaning,
			guaci: j.guaci || '',
			zongjue: j.zongjue || '',
			mingtiao: {
				xiantian: nx.xiantian || mt.xiantian || '',
				houtian: nx.houtian || mt.houtian || '',
				liunian: nx.liunian || mt.liunian || '',
			},
			yao,
		};
	});

	// 勘误:底本录入的错字(繁体原文里量词作「隻」;繁体原文在界面上照原样显示,显示层不会替它改)
	const ERRATA = [['嘹亮賓鴻一只飛', '嘹亮賓鴻一隻飛']];
	let json = JSON.stringify(out, null, '\t');
	ERRATA.forEach(([from, to])=>{ json = json.split(from).join(to); });
	fs.writeFileSync(OUT, json, 'utf8');
	const names = Object.keys(out);
	console.log(`wrote ${names.length} 卦 → ${OUT}`);
	console.log('first/last:', names[0], '...', names[names.length - 1]);
	// sample integrity
	const sample = out['乾為天'];
	if (sample) console.log('乾為天 verdict=', sample.verdict, '| yao1 has detail:', !!sample.yao[1].detail, '| yao1 verdict:', sample.yao[1].verdict);
}

main();
