// AI导出 [图例] 注册表 · per-technique 术语/符号速查（v2 底座,空表起步,随技法批次逐个填充）。
// 规则:每技法 ≤15 行;只用公开通行的术语名词,不引任何出处标注;
// 拼装层=payload 尾部(内容结束哨兵前),独立开关;**挂载默认不带**(省上下文预算)。
// 行格式:'符号/缩写 = 含义' 或 '术语：一句话'。

const LEGEND_BY_TECHNIQUE = {
	// 示例(紫微试点批次填充):
	// ziwei: [
	// 	'禄/权/科/忌 = 四化(生年四化标于星名后括注)',
	// ],
};

export function getAIExportLegendLines(techniqueKey){
	const list = LEGEND_BY_TECHNIQUE[`${techniqueKey || ''}`];
	return Array.isArray(list) ? list.slice(0, 15) : [];
}

export function buildAIExportLegendSection(techniqueKey){
	const lines = getAIExportLegendLines(techniqueKey);
	if(!lines.length){
		return '';
	}
	return `[图例]\n${lines.join('\n')}`;
}
