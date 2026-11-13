// GFM 表格识别 · 纯函数单源（零依赖,jest 安全）。
// 供 aiExportDocModel(导出 IR 解析) / docxCommon(真 Word 表) 等 md→docx 链共用,
// 三处此前各自持有或即将持有同款正则——集中一处防口径漂移。
// 契约与历史内联实现逐字一致(v2 底座抽取,行为零变化)。

export function isDocxTableSep(s){ return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(s || ''); }

export function splitDocxTableRow(s){ return `${s || ''}`.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c)=>c.trim()); }

// 分隔行 → 每列对齐('left'|'center'|'right'),与历史 makeDocxParagraphsFromMarkdown 内联逻辑同款。
export function parseTableAligns(sepLine){
	return splitDocxTableRow(sepLine).map((a)=>{
		const l = `${a || ''}`.startsWith(':');
		const r = `${a || ''}`.endsWith(':');
		return (l && r) ? 'center' : (r ? 'right' : 'left');
	});
}

// 行是否"看起来在表内"(含竖线且非空)——供逐行扫描聚表体。
export function isTableBodyLine(s){
	const t = `${s || ''}`;
	return t.includes('|') && !!t.trim();
}

// 表体扫描时判「这一行是不是下一张表的表头」:下一行是严格分隔行(每格至少三个连字符)且列数相同。
// 两张表紧挨着(中间没空行)时,不判就会把第二张的表头和分隔行吞成第一张的两行正文;
// 「|---|」三连字符以上才算(表体里的「| - | - |」占位行不当分隔行)。各条 md→docx 链共用。
const STRICT_TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
export function isNextTableStart(line, next){
	if(!next || !STRICT_TABLE_SEP.test(next)){ return false; }
	return splitDocxTableRow(line).length === splitDocxTableRow(next).length;
}
