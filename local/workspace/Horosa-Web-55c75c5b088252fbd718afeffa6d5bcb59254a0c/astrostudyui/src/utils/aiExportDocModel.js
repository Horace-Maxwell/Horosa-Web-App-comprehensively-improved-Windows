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
		// [B2] fenced code:```lang … ```(闭栏缺失=吃到文末,langHint 供渲染端着色/等宽)
		const fence = trimmed.match(/^```([A-Za-z0-9_-]*)\s*$/);
		if(fence){
			pushPara(blocks, paraBuf);
			const codeLines = [];
			let j = i + 1;
			while(j < lines.length && !/^```\s*$/.test(`${lines[j] == null ? '' : lines[j]}`.trim())){
				codeLines.push(`${lines[j] == null ? '' : lines[j]}`);
				j++;
			}
			blocks.push({ type: 'code', lang: fence[1] || '', text: codeLines.join('\n') });
			i = j;   // 指向闭栏(或文末),循环 ++ 跳过
			continue;
		}
		// [B2] blockquote:连续 `> ` 行合一块(内层 > 保留为文本,不递归——报告引用块单层为主)
		if(/^>\s?/.test(trimmed)){
			pushPara(blocks, paraBuf);
			const quoteLines = [trimmed.replace(/^>\s?/, '')];
			let j = i + 1;
			while(j < lines.length){
				const qt = `${lines[j] == null ? '' : lines[j]}`.trim();
				if(!/^>\s?/.test(qt)) break;
				quoteLines.push(qt.replace(/^>\s?/, ''));
				j++;
			}
			blocks.push({ type: 'quote', text: quoteLines.join('\n') });
			i = j - 1;
			continue;
		}
		// [B2] 独行图片:![alt](url)(dataURL 命盘截图内嵌正文的载体;行内混排图不提级)
		const img = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
		if(img){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'image', alt: img[1] || '', src: img[2] });
			continue;
		}
		// [B2] 分隔线
		if(/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'hr' });
			continue;
		}
		// [B2] 有序/无序列表(含嵌套):连续列表行合一块,depth 按前导空格 /2(tab=2)。
		if(/^(\s*)([-*+]|\d{1,3}[.)])\s+/.test(line.replace(/\t/g, '  '))){
			pushPara(blocks, paraBuf);
			const items = [];
			let j = i;
			while(j < lines.length){
				const raw = `${lines[j] == null ? '' : lines[j]}`.replace(/\t/g, '  ');
				const m = raw.match(/^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/);
				if(!m) break;
				items.push({ depth: Math.min(4, Math.floor(m[1].length / 2)), ordered: /\d/.test(m[2]), marker: m[2], text: m[3] });
				j++;
			}
			blocks.push({ type: 'list', items });
			i = j - 1;
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
		// [B2] markdown 标题行(### 等)→ subhead(报告正文口径;级别信息渲染端暂齐平 Heading3)
		const mdHead = trimmed.match(/^(#{1,6})\s+(.+)$/);
		if(mdHead){
			pushPara(blocks, paraBuf);
			blocks.push({ type: 'subhead', text: mdHead[2].trim(), level: mdHead[1].length });
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

// [B1] 报告矢量链公共面:一段 markdown/导出文本 → IR 块数组(与 parseAiExportDocument 的
// 节内解析同一实现;报告导出按「模板节结构」自组文档,不必再从整份文本反推段头)。
export function parseMarkdownSectionBlocks(text){
	const src = `${text == null ? '' : text}`.replace(/\r\n/g, '\n');
	return parseBlocks(src.split('\n'));
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
			// [B2] 超高单块(整表/整图高于 canvas 安全高):不再 null 整份降级——该块独占一段,
			// 并标 split 让调用方对这一段内部再按 hardMax 虚切截取(段边界仍在块间,文字零裁)。
			if(acc > 0){ chunks.push({ start, end: i }); }
			chunks.push({ start: i, end: i + 1, split: Math.ceil(h / hardMax) });
			start = i + 1;
			acc = 0;
			continue;
		}
		if(acc > 0 && acc + h > chunkHeight){
			chunks.push({ start, end: i });
			start = i;
			acc = 0;
		}
		acc += h;
	}
	if(start < heights.length){ chunks.push({ start, end: heights.length }); }
	return chunks;
}

// [B4] 栅格分段截取计划(纯函数可测):把整页高按「块底边界」切成 ≤maxSegPx 的段,
// 供分段 html2canvas(单张全高截图超浏览器 canvas 单维上限 ~32767px 必空白/裁剪)。
// blockBottoms=各块底 y(升序,CSS px);无可用边界的超长盲区按 maxSegPx 硬切(保完整性优先)。
export function planCaptureSegments(blockBottoms, totalHeight, maxSegPx){
	const total = Math.max(0, Number(totalHeight) || 0);
	if(!total){ return []; }
	const cap = Math.max(1000, Number(maxSegPx) || 14000);
	const bottoms = (Array.isArray(blockBottoms) ? blockBottoms : [])
		.map((y)=>Number(y) || 0).filter((y)=>y > 0 && y < total).sort((a, b)=>a - b);
	const segs = [];
	let cursor = 0;
	let guard = 0;
	while(cursor < total && guard++ < 10000){
		const ideal = cursor + cap;
		if(ideal >= total){ segs.push({ start: cursor, end: total }); break; }
		let cut = -1;
		for(let i = bottoms.length - 1; i >= 0; i--){
			if(bottoms[i] <= ideal && bottoms[i] > cursor){ cut = bottoms[i]; break; }
		}
		if(cut <= cursor){ cut = ideal; }   // 盲区硬切兜底(块内切由页级空白行扫描善后)
		segs.push({ start: cursor, end: cut });
		cursor = cut;
	}
	return segs;
}
