// 占星符号字体(ywastro / ywastrochart)字形度量守卫。
// 背景:原字体里狮子座(e)进距只有 56/2048、侧距 −842 而外框 xMin 743 —— 渲染时整个字形以原点为中心、几乎零宽,
// 凡在 HTML 行内与别的字并排(地占方盘格头「1♌Vita」、表格、右栏)都压在邻字上;150° 相位(V)墨迹整个落在原点左侧、
// 凯龙(y)向右越出进距半个字宽。以前只在几处用定宽槽绕开(styles.less 星座列 / Midpoint / AstroAnalysisLab)。
// 现在在字体里根治:侧距 = 外框 xMin、进距 = 墨宽 + 两侧 5 单位。本测试直接读字体二进制,任何一处字形再出现
// 「侧距与外框不符」或「墨迹比进距宽一倍以上」即红;woff / woff2 与 ttf 的进距逐字形一致(三种格式同一份度量)。
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ASSETS = path.resolve(__dirname, '..', '..', 'assets');
const FAMILIES = ['ywastro', 'ywastrochart'];

function sfntTables(buf){
	const n = buf.readUInt16BE(4);
	const out = {};
	for(let i = 0; i < n; i += 1){
		const p = 12 + i * 16;
		const tag = buf.toString('latin1', p, p + 4);
		const off = buf.readUInt32BE(p + 8);
		const len = buf.readUInt32BE(p + 12);
		out[tag] = buf.subarray(off, off + len);
	}
	return out;
}

function woffTables(buf){
	const n = buf.readUInt16BE(12);
	const out = {};
	for(let i = 0; i < n; i += 1){
		const p = 44 + i * 20;
		const tag = buf.toString('latin1', p, p + 4);
		const off = buf.readUInt32BE(p + 4);
		const comp = buf.readUInt32BE(p + 8);
		const orig = buf.readUInt32BE(p + 12);
		const raw = buf.subarray(off, off + comp);
		out[tag] = comp < orig ? zlib.inflateSync(raw) : raw;
	}
	return out;
}

const WOFF2_KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
// woff2:只取未变换的表(glyf / loca 是变换形态,不读;hmtx 未变换时原样可读)
function woff2Tables(buf){
	const n = buf.readUInt16BE(12);
	let p = 48;
	const base128 = ()=>{ let v = 0; for(let i = 0; i < 5; i += 1){ const b = buf[p]; p += 1; v = (v * 128) + (b & 0x7f); if(!(b & 0x80)){ return v; } } throw new Error('bad base128'); };
	const dir = [];
	for(let i = 0; i < n; i += 1){
		const flags = buf[p]; p += 1;
		let tag;
		if((flags & 0x3f) === 0x3f){ tag = buf.toString('latin1', p, p + 4); p += 4; }else{ tag = WOFF2_KNOWN[flags & 0x3f]; }
		const ver = flags >> 6;
		const orig = base128();
		const transformed = (tag === 'glyf' || tag === 'loca') ? ver === 0 : ver !== 0;
		const len = transformed ? base128() : orig;
		dir.push({ tag, len, transformed });
	}
	const total = buf.readUInt32BE(20);
	const data = zlib.brotliDecompressSync(buf.subarray(p, p + total));
	const out = {};
	let off = 0;
	dir.forEach((d)=>{ if(!d.transformed){ out[d.tag] = data.subarray(off, off + d.len); } off += d.len; });
	return out;
}

function hmtxOf(t){
	const numGlyphs = t.maxp.readUInt16BE(4);
	const nH = t.hhea.readUInt16BE(34);
	const res = [];
	let adv = 0;
	for(let i = 0; i < numGlyphs; i += 1){
		if(i < nH){ adv = t.hmtx.readUInt16BE(i * 4); res.push([adv, t.hmtx.readInt16BE(i * 4 + 2)]); }else{ res.push([adv, t.hmtx.readInt16BE(nH * 4 + (i - nH) * 2)]); }
	}
	return res;
}

function glyphBoxes(t){
	const numGlyphs = t.maxp.readUInt16BE(4);
	const longLoca = t.head.readInt16BE(50) === 1;
	const loca = (i)=>(longLoca ? t.loca.readUInt32BE(i * 4) : t.loca.readUInt16BE(i * 2) * 2);
	const res = [];
	for(let i = 0; i < numGlyphs; i += 1){
		const a = loca(i); const b = loca(i + 1);
		if(b <= a){ res.push(null); continue; }
		const g = t.glyf.subarray(a, b);
		res.push({ contours: g.readInt16BE(0), xMin: g.readInt16BE(2), xMax: g.readInt16BE(6) });
	}
	return res;
}

// cmap 格式 4(3,1):字符 → 字形号
function glyphIndexOf(t, code){
	const c = t.cmap;
	const n = c.readUInt16BE(2);
	for(let i = 0; i < n; i += 1){
		const pid = c.readUInt16BE(4 + i * 8); const eid = c.readUInt16BE(6 + i * 8); const off = c.readUInt32BE(8 + i * 8);
		if(pid !== 3 || eid !== 1 || c.readUInt16BE(off) !== 4){ continue; }
		const segX2 = c.readUInt16BE(off + 6);
		const ends = off + 14; const starts = ends + segX2 + 2; const deltas = starts + segX2; const ranges = deltas + segX2;
		for(let s = 0; s < segX2 / 2; s += 1){
			const end = c.readUInt16BE(ends + s * 2); const start = c.readUInt16BE(starts + s * 2);
			if(code < start || code > end){ continue; }
			const delta = c.readInt16BE(deltas + s * 2); const ro = c.readUInt16BE(ranges + s * 2);
			if(!ro){ return (code + delta) & 0xffff; }
			const gi = c.readUInt16BE(ranges + s * 2 + ro + (code - start) * 2);
			return gi ? (gi + delta) & 0xffff : 0;
		}
	}
	return 0;
}

const read = (f)=>fs.readFileSync(path.join(ASSETS, f));

describe('占星符号字体:字形度量自洽(无零宽 / 墨迹越出进距的字形)', ()=>{
	FAMILIES.forEach((fam)=>{
		const ttf = sfntTables(read(`${fam}.ttf`));
		const hm = hmtxOf(ttf);
		const boxes = glyphBoxes(ttf);
		// U+2215 分数斜线按设计就是窄进距斜笔(与后字叠排),不算
		const fractionGid = glyphIndexOf(ttf, 0x2215);

		test(`${fam}.ttf:每个字形侧距 = 外框 xMin,墨宽不超过进距两倍`, ()=>{
			const bad = [];
			boxes.forEach((b, gi)=>{
				if(!b || b.contours <= 0){ return; }
				const [adv, lsb] = hm[gi];
				if(Math.abs(lsb - b.xMin) > 2){ bad.push(`#${gi} lsb ${lsb} ≠ xMin ${b.xMin}`); }
				if(gi !== fractionGid && adv < (b.xMax - b.xMin) * 0.5){ bad.push(`#${gi} adv ${adv} < 墨宽 ${b.xMax - b.xMin} 的一半`); }
			});
			expect(bad).toEqual([]);
		});

		test(`${fam}.ttf:十二星座 + 150° 相位 + 凯龙 进距与墨宽相称(坏度量的样子:狮子 56、150° 墨迹全在原点左、凯龙越出进距)`, ()=>{
			'abcdefghijklVy'.split('').forEach((ch)=>{
				const gi = glyphIndexOf(ttf, ch.charCodeAt(0));
				expect([ch, gi > 0]).toEqual([ch, true]);
				const b = boxes[gi]; const [adv, lsb] = hm[gi];
				// 原设计里有 ±20 单位内的微小侧距 / 越出(金牛 −2、射手越出 7),不算;坏度量的偏差都是几百上千单位
				expect([ch, lsb >= -20 && lsb <= 20]).toEqual([ch, true]);
				expect([ch, adv >= b.xMax - 20 && adv - (b.xMax - b.xMin) <= 40]).toEqual([ch, true]);
			});
		});

		test(`${fam}.woff / .woff2 与 .ttf 逐字形同一份度量`, ()=>{
			const woff = woffTables(read(`${fam}.woff`));
			expect(hmtxOf(woff)).toEqual(hm);
			expect(glyphBoxes(woff)).toEqual(boxes);
			const w2 = woff2Tables(read(`${fam}.woff2`));
			expect(w2.hmtx).toBeTruthy();
			expect(hmtxOf(w2)).toEqual(hm);
		});
	});
});
