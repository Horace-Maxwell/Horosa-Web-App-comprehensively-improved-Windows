// 观象左栏设计语言 · 全局图标语义映射表
// 语义键(小节含义)→ xq-icons 真实图标名(src/components/xq-icons/index.js 的 iconMap 键)。
// 🔴 值必须是 iconMap 里真实存在的名字 —— XQIcon 对未知名静默回退 'astro',
//    写错名不会报错只会悄悄变成星盘图标;单测以「渲染结果 ≠ astro 回退」守住这条。
// 各技法左栏一律经此表取图标,同一语义全 App 同一图标,不各自硬编。

export const SIDE_SECTION_ICONS = {
	// —— 核心七语义 ——
	time: 'clock',          // 时间(日期时刻/时间微调)
	place: 'locastro',      // 地点(经纬度/城市选择)
	school: 'fengshui',     // 流派(罗盘形,取「定向/宗派」义)
	chartStyle: 'sideStyle',// 盘式(盘面样式/风格)
	switches: 'sliders',    // 开关组(选项开关集合)
	input: 'edit',          // 输入(文本/数值录入)
	advanced: 'settings',   // 高级(进阶设置)
	// —— 常用扩展 ——
	planets: 'sidePlanets', // 星曜/行星
	houses: 'sideHouses',   // 宫位
	display: 'sideSwitch',  // 显示切换
	date: 'calendar',       // 历法/日期选择
	direction: 'direction', // 推运/走势
	target: 'target',       // 定盘/目标
	global: 'globe',        // 全局/时区
	search: 'search',       // 检索
	save: 'save',           // 保存
	archive: 'folder',      // 案例/档案
	notes: 'note',          // 备注
	list: 'list',           // 列表/条目
	ai: 'ai',               // AI 分析
	help: 'help',           // 帮助
	threeD: 'sphere3d',     // 3D/天球
};

// 语义 → 图标名;未知语义回退通用开关组图标(绝不落到 astro 兜底以免误导)。
export function sideSectionIcon(semantic){
	return SIDE_SECTION_ICONS[semantic] || SIDE_SECTION_ICONS.switches;
}
