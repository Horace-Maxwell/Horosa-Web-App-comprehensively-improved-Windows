// AI 助手·工具中文标签单源(动作条 / 行动能力面板「按工具名放行·禁用」/ 任务中心 共用)。
// 合同(aiAgentToolLabels.test.js):每件注册进目录的内置工具都必须在这里有中文标签——动作条上出现裸英文名 = 漏登记。
// 外部工具(ext_ 前缀)不进表:按服务器/工具名即时拼「外部·xxx」。
export const AGENT_TOOL_LABELS = {
	resolve_place: '解析地名', list_records: '检索档案', get_current_context: '读取工作区', describe_settings: '读取设置项', get_settings: '读取设置',
	cast_technique: '无头起盘', create_chart_record: '新建命盘', create_case_record: '新建事盘', set_settings: '修改设置', load_record_into_workspace: '载入工作区',
	ask_user: '向你提问', list_actions: '查看动作账本', search_materials: '检索资料',
	create_goal_task: '建目标任务', schedule_task: '排定时任务', web_search: '联网检索', note_progress: '记录进度', web_fetch: '读取网页', run_analysis: '无头分析',
	navigate_to_technique: '切换技法页', compare_records: '合盘配对', star_record: '加星标', pin_record: '置顶', add_record_tag: '加标签',
	list_tasks: '查看后台任务', get_task: '读取任务详情', cast_relative: '无头合盘取数',
	list_election_conditions: '择日条件类', search_election: '择日搜索', explain_election: '择日判读',
	search_xuanshi: '检索玄学史', get_xuanshi_item: '读取玄学史条目', read_current_page: '读取当前页正文',
	list_conversations: '列出对话记录', get_conversation: '读取对话正文', get_record_detail: '读取档案详情',
	append_record_journal: '追加断事日志', link_records: '关联两张档案', set_chat_mount: '设置对话挂载',
	list_divination_casts: '起卦格式目录', cast_divination_case: '按起卦结果建事盘',
	propose_record_edit: '提议修改档案', propose_record_archive: '提议归档档案', list_proposals: '查看档案提案',
	list_zeri_conditions: '各派择日条件类', search_zeri: '各派择日搜索', explain_zeri: '各派择日判读',
	search_celebrities: '检索名人库', list_celebrity_categories: '名人库分类', get_celebrity: '读取名人资料', create_celebrity_chart: '名人存成命盘',
	list_techniques: '技法清单', check_new_version: '查新版本', scan_election_moments: '择日盘逐时择优', get_lunar_month: '农历月历', list_record_revisions: '查看历史版本', copy_record: '另存副本', find_duplicate_records: '查重复档案', list_zeri_schemes: '择日方案', browse_xuanshi: '浏览玄学史', search_rizi: '日子馆择日', cast_fengshui: '风水理气起局', get_diagnostics: '运行诊断', get_reference: '参考表', sky_at: '天象取数', cast_acg: '占星地图', rectify_india: '印占校时', propose_record_unlink: '提议解除关联', propose_record_recover: '提议恢复档案', control_task: '暂停 / 取消任务', add_material_note: '新建资料笔记', propose_memory: '提议记忆', list_memories: '查看记忆', propose_template: '提议新建模版', propose_skill_pack: '提议新建技能包', propose_persona_text: '提议改个人口径', save_document: '存成文件', cast_random_case: '软件代摇', list_models: '模型清单', chat_in_conversation: '在对话里续问',
};

export function toolLabel(name){
	const n = `${name || ''}`;
	if(Object.prototype.hasOwnProperty.call(AGENT_TOOL_LABELS, n)){ return AGENT_TOOL_LABELS[n]; }
	if(/^ext_/.test(n)){ return `外部·${n.replace(/^ext_/, '')}`; }
	return n;
}
