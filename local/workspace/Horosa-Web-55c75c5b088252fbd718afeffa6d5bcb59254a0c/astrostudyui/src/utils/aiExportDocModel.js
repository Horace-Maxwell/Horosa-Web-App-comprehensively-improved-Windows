// AI导出文档模型 · 约定式 IR 解析器（v2 呈现层底座,纯函数零依赖重件,jest 安全）。
//
// 输入 = 既有 AI 导出纯文本(builder 产出+payload 头尾),输出 = 结构化文档模型,
// 供 真 docx 渲染 / 样式化 PDF 渲染 派生视图使用。**纯文本仍是四同步的单一真值**,
// 本模型只做只读解析,绝不反向改写文本。
//
// 解析约定(与全链既有契约一致,勿单方面扩义):
//   段头   = 整行 `[X]` 或 `【X】`(同 aiExport.parseSectionTitleLine 的识别面;此处保留原题不做
//            normalizeSectionTitle 折叠——呈现层要显示原题,归一化只属过滤层)。
//   表     = GFM:表头行 + 分隔行(|---|:--:|)前瞻 + 连续含竖线行(mdTableParse 单源)。
//   子题   = 行首 `◆ `(v2 新约定;呈现层映射 Heading3,beautify 白名单直通)。
//   说明   = 行首 `注：`/`说明：` 或整行 `（说明：…）`(呈现层灰字)。
//   键值   = `键：值`(全角冒号,键 ≤24 字不含空格起头)——仅作呈现提示,不改语义。
//   其余   = 普通段落行 p;空行折叠为块间隔。
// v1 文本天然可解析(全落 p/kv);解析失败恒不 throw,退化为单段纯 p。

import { isDocxTableSep, splitDocxTableRow, parseTableAligns, isTableBodyLine } from './mdTableParse';

const SECTION_LINE_RE = /^\s*(?:\[(.+?)\]|【(.+?)】)\s*$/;
const SUBHEAD_RE = /^◆\s+(.+)$/;
const NOTE_RE = /^(?:注：|说明：|（说明：.*）$|\(说明：.*\)$)/;
const KV_RE = /^([^\s：:，,、。;；]{1,24})：(.*)$/;

export function parseExportSectionTitle(line){
	const m = `${line == null ? '' : line}`.match(SECTION_LINE_RE);
	if(!m){
		return '';
	}
	return `${m[1] || m[2] || ''}`.trim();
}

function pushPara(blocks, buf){
	if(!buf.length){
		return;
	}
	const text = buf.join('\n');
	buf.length = 0;
	blocks.push({ type: 'p', text });
}

function parseBlocks(lines){
	const blocks = [];
	const paraBuf = [];
	for(let i = 0; i < lines.length; i++){
		const line = `${lines[i] == null ? '' : lines[i]}`;
		const trimmed = line.trim();
		if(!trimmed){
			pushPara(blocks, paraBuf);
			continue;
		}
		// GFM 表:当前行含竖线且下一行是分隔行。
		if(isTableBodyLine(line) && isDocxTableSep(lines[i + 1])){
			pushPara(blocks, paraBuf);
			const headers = splitDocxTableRow(line);
			const aligns = parseTableAligns(lines[i + 1]);
			const rows = [];
			let j = i + 2;
			while(j < lines.length && isTableBodyLine(lines[j])){
				rows.push(splitDocxTableRow(lines[j]));
				j++;
			}
			blocks.push({ type: 'table', headers, aligns, rows });
			i = j - 1;
			continue;
		}
		const sub = trimmed.match(SUBHEAD_RE);
		if(sub){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'subhead', text: sub[1].trim() });
			continue;
		}
		if(NOTE_RE.test(trimmed)){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'note', text: trimmed });
			continue;
		}
		const kv = trimmed.match(KV_RE);
		if(kv){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'kv', key: kv[1], value: kv[2].trim() });
			continue;
		}
		paraBuf.push(trimmed);
	}
	pushPara(blocks, paraBuf);
	return blocks;
}

// 主入口:整份导出文本 → { preamble, sections, postamble }。
// preamble = 首个段头之前的头部行(技术/导出时间/规则/内容开始哨兵);
// postamble = `========== 内容结束 ==========` 及其后(若在段内出现则归到该段外)。
export function parseAiExportDocument(text){
	const src = `${text == null ? '' : text}`.replace(/\r\n/g, '\n');
	const lines = src.split('\n');
	const preambleLines = [];
	const postambleLines = [];
	const sections = [];
	let current = null;
	let seenSection = false;
	let inPostamble = false;
	for(let i = 0; i < lines.length; i++){
		const line = lines[i];
		const trimmed = `${line || ''}`.trim();
		if(!inPostamble && /^=+\s*内容结束\s*=+$/.test(trimmed)){
			inPostamble = true;
		}
		if(inPostamble){
			postambleLines.push(line);
			continue;
		}
		const title = parseExportSectionTitle(line);
		if(title){
			seenSection = true;
			current = { title, lines: [] };
			sections.push(current);
			continue;
		}
		if(!seenSection){
			preambleLines.push(line);
			continue;
		}
		current.lines.push(line);
	}
	return {
		preamble: preambleLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
		sections: sections.map((s)=>({
			title: s.title,
			blocks: parseBlocks(s.lines),
		})),
		postamble: postambleLines.join('\n').trim(),
	};
}

// —— PDF 分块装箱(纯函数,可测) ——
// 输入 = 每块实测高度(CSS px)数组 + 目标块高;输出 = [{start,end}](end 不含)索引区间。
// 规则:整块为最小单位顺序装箱;单块自身超 maxBlockHeight(调用方给,通常=canvas 安全高)时
// 返回 null 示意「本文档不适合按块装箱」→ 调用方回退整份纯文本栅格路径(防线④)。
export function packBlocksIntoChunks(blockHeights, chunkHeight, maxBlockHeight){
	const heights = Array.isArray(blockHeights) ? blockHeights : [];
	if(!heights.length || !(chunkHeight > 0)){
		return [{ start: 0, end: heights.length }];
	}
	const hardMax = maxBlockHeight > 0 ? maxBlockHeight : chunkHeight * 2;
	const chunks = [];
	let start = 0;
	let acc = 0;
	for(let i = 0; i < heights.length; i++){
		const h = Math.max(0, Number(heights[i]) || 0);
		if(h > hardMax){
			return null;
		}
		if(acc > 0 && acc + h > chunkHeight){
			chunks.push({ start, end: i });
			start = i;
			acc = 0;
		}
		acc += h;
	}
	chunks.push({ start, end: heights.length });
	return chunks;
}
