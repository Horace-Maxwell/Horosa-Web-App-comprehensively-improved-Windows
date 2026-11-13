// 择日十个工作台左列的两块公用版式(单一源头)。
// 左列是定高竖排:参数区 → 「构造条件」标题 → 条件正文 → 连接门 → 动作排。
// 参数区内容多(展开全部下拉)时由它自己滚,条件正文始终留得出一行类型 + 一行参数,
// 底部动作排不会被挤出框外(矮窗 / 放大档下实测:此前参数区不让步,动作排溢出 3px、正文只剩一条缝)。
export const ZERI_WB_TOP_STYLE = {
	padding: 10,
	borderBottom: '1px solid var(--horosa-border)',
	flex: '0 1 auto',
	minHeight: 0,
	overflowY: 'auto',
};

export const ZERI_WB_COND_BODY_STYLE = {
	flex: '1 1 0',
	minHeight: 132,
	overflowY: 'auto',
	padding: 10,
};
