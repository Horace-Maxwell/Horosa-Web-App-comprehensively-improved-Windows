// AI 助手·工具中文标签单源(动作条 / 行动能力面板「按工具名放行·禁用」/ 任务中心 共用)。
// 合同(aiAgentToolLabels.test.js):每件注册进目录的内置工具都必须在这里有中文标签——动作条上出现裸英文名 = 漏登记。
// 外部工具(ext_ 前缀)不进表:按服务器/工具名即时拼「外部·xxx」。
export const AGENT_TOOL_LABELS = {
	resolve_place: '解析地名', list_records: '检索档案', get_current_context: '读取工作区', describe_settings: '读取设置项', get_settings: '读取设置',
	cast_technique: '无头起盘', create_chart_record: '新建命盘', create_case_record: '新建事盘', set_settings: '修改设置', load_record_into_workspace: '载入工作区',
	ask_user: '向你提问', list_actions: '查看动作账本', search_materials: '检索资料',
	create_goal_task: '建目标任务', schedule_task: '排定时任务', web_search: '联网检索', note_progress: '记录进度', web_fetch: '读取网页', run_analysis: '无头分析',
	navigate_to_technique: '切换技法页', compare_records: '合盘配对', star_record: '加星标', pin_record: '置顶', add_record_tag: '加标签',
};

export function toolLabel(name){
	const n = `${name || ''}`;
	if(Object.prototype.hasOwnProperty.call(AGENT_TOOL_LABELS, n)){ return AGENT_TOOL_LABELS[n]; }
	if(/^ext_/.test(n)){ return `外部·${n.replace(/^ext_/, '')}`; }
	return n;
}
