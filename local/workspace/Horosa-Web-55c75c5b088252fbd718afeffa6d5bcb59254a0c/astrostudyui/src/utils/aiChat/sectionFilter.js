// @技法段(A4):把「按段挑选」套到技法上下文正文上——复用导出/挂载主链同一段切分器(filterContentByWantedSections),
// 段名经同一归一化;过滤后为空 → 原样返回(绝不挂载空白);names 为空 → 原样引用返回(零变化)。纯函数。
import { filterContentByWantedSections } from '../aiExport';

export function filterContentSections(content, names){
	const text = `${content == null ? '' : content}`;
	const list = Array.isArray(names) ? names.map((n)=>`${n == null ? '' : n}`.trim()).filter(Boolean) : [];
	if(!text.trim() || !list.length){ return content; }
	const filtered = filterContentByWantedSections(text, new Set(list));
	if(!`${filtered || ''}`.trim()){ return content; }
	return filtered;
}
