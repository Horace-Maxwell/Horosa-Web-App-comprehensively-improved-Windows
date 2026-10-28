// 表格 / 窄栏里「标签类」短文本的折行口径(单源):
//   ≤ 4 字的纯文本(「10宫」「正位」「8 宫」「世/应」)整段不折行 —— 表被压窄(放大档右栏、窄表列)时此前逐字竖排;
//   5–12 字、且按空格 / 括号 / 斜杠 / 间隔号切开后每段 ≤ 4 字的标签(「昼(日出起)」「宫主落宫(整宫)」)只在这些断点处换行,
//   不在汉字之间断(keep-all),最坏两行、不竖排;其余长文本照常折行。
// 放得下时三档都是单行,与不加样式逐像素相同。
export const SHORT_LABEL_MAX = 4;
const LABEL_MAX = 12;
const SEG_SPLIT = /[\s/／·・、,，;；:：()（）[\]【】<>《》]+/;

const charLen = (s)=>Array.from(s).length;

export function labelCellStyle(content){
	if(typeof content !== 'string' && typeof content !== 'number'){
		return null;
	}
	const t = `${content}`.trim();
	if(!t){
		return null;
	}
	const n = charLen(t);
	if(n <= SHORT_LABEL_MAX){
		return { whiteSpace: 'nowrap' };
	}
	if(n <= LABEL_MAX && t.split(SEG_SPLIT).every((seg)=>charLen(seg) <= SHORT_LABEL_MAX)){
		return { wordBreak: 'keep-all' };
	}
	return null;
}

// 与已有内联样式合并(没有命中时原样返回,保持引用不变)
export function withLabelCell(style, content){
	const extra = labelCellStyle(content);
	return extra ? { ...(style || {}), ...extra } : style;
}
