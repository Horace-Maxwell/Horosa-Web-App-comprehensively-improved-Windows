// 窄栏下拉「收起态短名」单一真值源。
//
// 病灶:卜卦/择日/世俗左栏的下拉两两成对(半宽 ~132px),而选项 label 惯例带括号补充
// (「启发式（现行）」「传统（4父/10母）」「按度差（古典近似）」),收起态必被 ellipsis 截成
// 「启发式（现…」——用户看不出当前选的是什么。
//
// 解法:收起态只显示第一个括号之前的主名,展开面板仍是完整 label(XQSelect 组件层已全局
// dropdownMatchSelectWidth={false},面板按内容宽,长文完整可见)。剥的是**补充说明**,不是信息。
//
// ⚠ 前提:同一组 options 剥括号后必须彼此不重名,否则收起态产生歧义。
//   该前提由 src/utils/__tests__/shortOptionLabel.test.js 对全部参数表逐组断言看守。
export function shortOptionLabel(label){
	const s = String(label == null ? '' : label).trim();
	if(!s){ return s; }
	// 全角（ 与半角 ( 都算;只剥「括号起到末尾」的尾巴,中间带括号的专名(如 GMT(UT))不误伤——
	// 因为那种 label 括号后仍有正文,剥了会丢主体,故仅在括号后无实质内容时才剥。
	const m = s.match(/^(.*?)[（(][^）)]*[）)]\s*$/);
	const head = m && m[1] ? m[1].trim() : '';
	return head || s;
}

// 一组 options 的短名是否彼此唯一(供测试与哨兵复用,避免两处各写一份判据)。
export function shortLabelsUnique(labels){
	const shorts = (labels || []).map(shortOptionLabel);
	return new Set(shorts).size === shorts.length;
}

export default shortOptionLabel;
