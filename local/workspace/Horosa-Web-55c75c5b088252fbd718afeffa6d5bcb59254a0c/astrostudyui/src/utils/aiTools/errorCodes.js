// AI 助手·工具错误码单一真源。所有工具/运行时/外部桥回给模型的 `code` 只能取本表里的键;
// 用户可见文案(userText)也只在这里写一次——工具里再拼一遍就是第二真源,迟早分叉。
//
// 每码五问:
//   layer     出在哪一层。protocol=调用方(模型/外部客户端)把协议或参数用错;tool=工具自身没做成;
//             backend=本机计算服务/上游没给出结果;user=要用户补料或用户自己的选择。
//   retryable 「同参数机械重试有望成功」才置 true。**当前只有后端不可达一类满足**:
//             超时类同参重试多半复发(该缩小范围而不是再等一遍)、上游流错由运行时/用户决定重发、
//             缺料类必须先补料。宁可少标一个,也不让模型在必败路径上空转。
//   emit      谁产出这个码(排障时直接照这条去找现场)。
//   act       用户/模型下一步能做什么(比"失败了"有用)。
//   userText  固定文案,消费方原样用。
//   since     进表日期。
//
// 表与列表都冻结:改表=改合同,必须同步改 docs/AI_AGENT_RUNTIME.md 的错误码表
// (合同测试 aiToolsErrorCodes.contract.test.js 断言「源码扫描集 == 本表 == 文档表」三者相等)。

export const TOOL_ERROR_LAYERS = Object.freeze(['protocol', 'tool', 'backend', 'user']);

// cause 只允许这几个标量键:够定位,又不夹带请求体/响应头/令牌/完整 URL。
export const ERROR_CAUSE_KEYS = Object.freeze(['kind', 'status', 'code', 'name', 'at', 'path']);
const CAUSE_TEXT_MAX = 80;

const SINCE = '2026-09-04';
const SINCE_AGENT_V2 = '2026-09-05';
const SINCE_TASKS_V1 = '2026-09-05';   // 对标增强轮:审批三档/反问/资料检索
const SINCE_EXTERNAL_V1 = '2026-09-05';   // 出站①:接外部 MCP 服务器
const SINCE_STRESS_V2 = '2026-09-06';   // 压测二轮·稳健性债:账本写前预留
const SINCE_B2 = '2026-09-06';   // 批二·对标 Claude Code:hooks 否决
const SINCE_B3 = '2026-09-06';   // 批三·对标 Codex:网页读取
const SINCE_FENCE_ERR = '2026-09-15';   // [Q-288] 围栏降级协议:坏块 / 多块不再静默丢,回喂结构化错误

function def(layer, retryable, emit, act, userText, since){
	return Object.freeze({ layer, retryable, act, emit, userText, since: since || SINCE });
}

// [Q-294/M-109·AR-23] act 文案里的开关位置统一写「进阶 →「AI 助手行动能力」」(这些开关早已从设置页搬到进阶页);接口配置(E_HEADLESS_UNAVAILABLE)仍在设置页,不改
export const TOOL_ERROR_CODES = Object.freeze({
	E_ABORTED: def('user', false, '运行时(用户点停止)', '需要的话重新发起本轮请求', '本轮已被停止'),
	// [Q-288] 围栏降级协议的两枚协议错(此前这两种形态一律静默丢掉整轮调用,模型收不到任何反馈)
	E_ACTION_BLOCK_BAD_JSON: def('protocol', false, '围栏协议解析(动作块 JSON 不合法)', '按错误里给的位置改好 JSON 重发;参数里若含三连反引号请改写或转义', '动作块的 JSON 解析不过,本轮未执行任何调用', SINCE_FENCE_ERR),
	E_ACTION_BLOCK_MULTIPLE: def('protocol', false, '围栏协议解析(正文里不止一个动作块)', '合并成回复最末尾的唯一一个动作块后重发', '正文里出现了多个动作块,本轮未执行任何调用', SINCE_FENCE_ERR),
	E_ACTION_NOT_FOUND: def('tool', false, '账本 undoAction', '账本里已无该动作,改用档案管理手工处理', '账本里找不到该动作'),
	E_ARGS_INVALID: def('protocol', false, '注册表 Ajv 校验 / 运行时参数解析', '按工具 schema 修正参数后重发', '参数不合规'),
	E_BIRTH_TIME_MISSING: def('user', false, '出生文本归一', '补出生时辰(至少精确到小时)', '缺出生时辰'),
	E_BIRTH_UNPARSEABLE: def('user', false, '出生文本归一', '改用「1990-01-01 08:00」这类明确写法', '出生时间无法解析'),
	E_BRIDGE_UNAVAILABLE: def('tool', false, '工作区桥 / 设置面', '先打开对应页面让桥就绪,再重试', '工作区桥未就绪'),
	E_CASE_TYPE_UNKNOWN: def('user', false, '事盘类型归一', '从可用事盘类型里挑一个明确的', '事盘类型无法识别'),
	E_CAST_BACKEND_FAILED: def('backend', true, 'cast_technique(检出起盘请求未拿到结果)', '确认本机计算服务已启动,然后重试', '起盘请求没能从计算服务拿到结果'),
	E_CAST_FAILED: def('tool', false, 'cast_technique(构造器抛错或回 status=error)', '核对起盘参数,或换一个技法', '起盘计算失败'),
	E_FORBIDDEN_KEY: def('protocol', false, '只增不删守卫', '去掉删除/覆盖类禁用键后重发', '参数含禁用键(只增不删)'),
	E_HOOK_DENIED: def('user', false, '注册表(自动化规则在工具执行前否决,tool.before)', '用户用自动化规则禁了这类动作:说明被拒并改用其它方式,不要换参数重试', '被自动化规则拒绝执行', SINCE_B2),
	E_LEDGER_UNAVAILABLE: def('tool', false, '注册表(写前账本预留失败:本机存储配额满)', '请用户先清理本地存储(回收站/备份导出)再重试;写入未执行', '账本写不进去,已拒绝执行(可撤销承诺不打折)', SINCE_STRESS_V2),
	E_LIMIT: def('protocol', false, '运行时限额', '本轮改为直接作答,或让用户拆成多轮', '已达本轮工具调用限额'),
	E_LUNAR_UNSUPPORTED_RANGE: def('user', false, '出生文本归一(农历分支)', '改用公历,或换到可换算年段内的日期', '该农历日期不在可换算年段内'),
	E_NEEDS_MANUAL_CAST: def('user', false, 'create_case_record(随机起卦法)', '请用户在对应页面亲手起卦后再分析', '该技法须由用户亲手起卦'),
	E_PLACE_NOT_FOUND: def('user', false, '地名离线解析', '换更完整的地名,或直接给经纬度', '地名未找到或有歧义'),
	E_PROTOCOL_DUP_ID: def('protocol', false, '运行时(同一 id 前后不同工具名)', '每次调用用唯一 id 重发', '同一调用 id 对应了不同工具'),
	E_RECORD_NOT_FOUND: def('tool', false, 'cast_technique / load_record_into_workspace', '先用 list_records 取到有效的记录 id', '未找到该记录'),
	E_SETTING_FACET_UNKNOWN: def('protocol', false, '设置五面', 'facet 只能取 describe_settings 列出的那几面', '设置面名未知'),
	E_SETTING_KEY_NOT_ALLOWED: def('protocol', false, '设置五面白名单', '先 describe_settings 取可改键,整体未写入', '该设置键不在可改白名单'),
	E_SETTING_SNAPSHOT_FAILED: def('tool', false, '注册表(写前快照阶段)', '稍后重试;仍失败请用户在设置页手工改', '设置写前快照失败,已放弃写入'),
	E_SETTING_VALUE_INVALID: def('protocol', false, '设置五面校验', '按 describe_settings 给的值域改值重发,整体未写入', '设置取值不在允许范围'),
	E_SECTION_NOT_FOUND: def('user', false, 'cast_technique(sections 一段都没匹上)', '换用返回里 availableSections 列出的段名,或不传 sections 取全文', '快照里没有匹配的段'),
	E_SNAPSHOT_MISSING: def('tool', false, 'cast_technique(拿到空快照)', '换一个技法,或请用户在该技法页面确认能出内容', '该技法未产出内容'),
	E_STORE_NOT_PERSISTED: def('tool', false, '建档类工具(写库后校验未落盘)', '检查应用存储权限与磁盘空间后重试', '记录未能落盘'),
	E_STORE_QUOTA: def('tool', false, '建档类工具(配额)', '先清理回收站或导出备份,再建档', '本地存储配额已满'),
	E_STREAM_ERROR: def('backend', false, '运行时(吸收上游流式错误)', '重新发起对话;持续失败查接口/模型配置', '上游流式响应出错'),
	E_TECHNIQUE_NOT_ALLOWED: def('protocol', false, 'cast_technique(该源的可用技法集)', '从结果 data.allowed 里挑一个', '该源不支持这个技法'),
	E_TOOL_FAILED: def('tool', false, '注册表(run 抛错或返回形态不合法)', '换参数重试;持续复现请报告', '工具执行异常'),
	E_TOOL_NOT_FOUND: def('protocol', false, '注册表 / 只增不删守卫 / 运行时', '只调用工具列表里存在的工具名', '未知工具'),
	E_TOOL_THREW: def('tool', false, '运行时 / 外部桥(调用过程抛错)', '换参数重试', '工具调用抛出异常'),
	E_TOOL_TIMEOUT: def('tool', false, '外部桥 / 运行时超时包装', '缩小范围(如调低 maxChars)后重试,别原样再等一遍', '工具执行超时'),
	E_UNDO_NOT_APPLICABLE: def('tool', false, '账本 / 设置面', '该动作类型不支持撤销,请走档案管理', '该动作不支持撤销'),
	E_UNDO_RECORD_CHANGED: def('user', false, '设置面(恢复前比对当前值)', '当前值已被改过,请在设置页手工回改', '设置在动作之后被改过,未自动恢复'),
	E_UNDO_RECORD_EDITED: def('user', false, '账本(记录 updateTime 晚于动作时刻)', '记录已被手工编辑过,请走档案管理处理', '记录在动作之后被编辑过,未自动撤销'),
	E_USER_SKIPPED: def('user', false, '审批等待台(用户选了跳过)', '如仍需执行,请用户重新允许', '用户跳过了这次调用'),
	// ── 对标增强轮(审批三档 / 反问 / 资料检索 / 功能开关) ──
	E_APPROVAL_DENIED: def('user', false, '运行时审批判定(只读档或类别档=只读)', '请用户到 进阶 →「AI 助手行动能力」把审批档改为「全自动」或「每次确认」后再试', '当前审批档为只读,写入动作未执行', SINCE_AGENT_V2),
	E_TOOL_DISABLED: def('protocol', false, '注册表(工具的功能开关关闭)', '请用户到 进阶 →「AI 助手行动能力」打开对应功能开关,或改用其它工具', '该工具对应的功能未开启', SINCE_AGENT_V2),
	E_ELICIT_UNAVAILABLE: def('tool', false, 'ask_user(当前调用通道无反问能力)', '改为在回答里直接向用户提出问题', '当前通道无法向用户提问', SINCE_AGENT_V2),
	E_ELICIT_TIMEOUT: def('user', false, 'ask_user(用户未在限时内作答)', '在回答里说明缺什么,等用户下一条消息补充', '用户未在限时内作答', SINCE_AGENT_V2),
	E_ELICIT_DECLINED: def('user', false, 'ask_user(用户拒绝作答或已停止)', '不再追问同一问题,按已有信息作答或说明无法继续', '用户拒绝了这个问题', SINCE_AGENT_V2),
	E_MATERIAL_INDEX_EMPTY: def('tool', false, 'search_materials(资料库为空或未提取出文本)', '提示用户先上传资料并完成提取,或不依赖资料作答', '资料库里没有可检索的文本', SINCE_AGENT_V2),
	// [P1 任务中心] 任务实体状态机(taskStore):四码全部不可重试,只走用户按钮/界面
	E_TASK_NOT_FOUND: def('tool', false, 'taskStore(任务 id 不存在)', '任务可能已被清理;让用户在任务中心确认', '找不到这个任务', SINCE_TASKS_V1),
	E_TASK_TERMINAL: def('tool', false, 'taskStore.cancelTask(任务已处于终态 done/failed/cancelled)', '终态任务不能再取消;如需重跑请新建', '任务已经结束,不能再取消', SINCE_TASKS_V1),
	E_TASK_TRANSITION: def('protocol', false, 'taskStore.patchTask(非法状态迁移)', '按迁移表走:排队→运行→(暂停|等待|完成|失败);检查调用顺序', '任务状态切换不合法', SINCE_TASKS_V1),
	E_UNDO_TASK_STARTED: def('user', false, '账本撤销支 cancel-task(任务已开始跑,只有排队/已排期/暂停的才能撤销)', '改为在任务中心点「取消」', '任务已经开始,不能撤销;可在任务中心取消', SINCE_TASKS_V1),
	E_SCHEDULE_INVALID: def('user', false, 'schedule_task / 定时任务弹窗(排期无下次:类型或时间格式不合法、仅一次已过期)', '改成合法排期:daily/weekly/monthly 需 time=HH:mm(weekly 另需 weekday 0-6,monthly 另需 day 1-28);once 需未来时刻', '排期不合法或已过期', SINCE_TASKS_V1),
	// [P7 出站②] 联网检索:两码都不可重试(未配置要用户去设置;上游失败重试只会再打一次同一家)
	E_WEB_SEARCH_NOT_CONFIGURED: def('user', false, 'web_search(没有启用的检索档案 / 缺 Key 或地址)', '告诉用户到 进阶 →「AI 助手行动能力」→「联网检索」选引擎并填 Key,或不依赖联网作答', '联网检索未配置', SINCE_EXTERNAL_V1),
	E_WEB_SEARCH_FAILED: def('tool', false, 'web_search(检索服务不可达或返回非 2xx)', '把失败如实说明,改用本地资料或让用户稍后再试', '联网检索失败', SINCE_EXTERNAL_V1),
	E_WEB_FETCH_BLOCKED: def('user', false, 'web_fetch(出站守卫拒绝:本机/内网/元数据/非 http 地址,或重定向落到这类地址)', '换一个公开网址;本机与内网页面本来就不该交给模型', '网页地址不允许读取', SINCE_B3),
	E_WEB_FETCH_FAILED: def('tool', false, 'web_fetch(网页不可达、非 2xx、内容类型不支持、回体超 2MiB、跳数超限)', '把失败如实说明,改用检索摘要或让用户换链接', '网页读取失败', SINCE_B3),
	E_HEADLESS_UNAVAILABLE: def('user', false, 'run_analysis(没有可用的接口配置/模型)', '先在设置里配置至少一个可用的接口与模型再经外部程序调用', '无头分析不可用', SINCE_B3),
	// [P6 出站①] 外部 MCP 服务器:两码都不可重试(重试只会把同样的参数再发一次给同一台外部服务器)
	E_EXTERNAL_UNAVAILABLE: def('tool', false, '外部 MCP 服务器工具(桌面桥缺席 / 连不上 / 已断开)', '告诉用户这台外部服务器连不上,改用本机工具或让用户到 进阶 →「AI 助手行动能力」检查「外部服务器」', '外部服务器不可用', SINCE_EXTERNAL_V1),
	E_EXTERNAL_FAILED: def('tool', false, '外部 MCP 服务器工具(服务器回 isError 或协议错)', '把外部服务器的报错原样告诉用户(不要复述成你的判断),必要时换参数或改用本机工具', '外部工具执行失败', SINCE_EXTERNAL_V1),
});

export const TOOL_ERROR_CODE_LIST = Object.freeze(Object.keys(TOOL_ERROR_CODES).sort());

const UNKNOWN_META = Object.freeze({ layer: 'unknown', retryable: false, act: '', emit: '', userText: '', since: '' });

// 未知码不抛错:回喂链上一个没进表的码不该让整轮崩掉,只是拿不到元数据。
export function getErrorMeta(code){
	const key = typeof code === 'string' ? code : '';
	return TOOL_ERROR_CODES[key] || UNKNOWN_META;
}

export function isRetryable(code){
	return getErrorMeta(code).retryable === true;
}


// cause 白名单过滤:只留标量、只留白名单键、字符串封顶;一个都不剩就回 null(不塞空对象)。
export function sanitizeErrorCause(cause){
	if(!cause || typeof cause !== 'object' || Array.isArray(cause)){ return null; }
	const out = {};
	let n = 0;
	ERROR_CAUSE_KEYS.forEach((k)=>{
		if(!Object.prototype.hasOwnProperty.call(cause, k)){ return; }
		const v = cause[k];
		if(typeof v === 'string'){ out[k] = v.length > CAUSE_TEXT_MAX ? v.slice(0, CAUSE_TEXT_MAX) : v; n += 1; return; }
		if(typeof v === 'number' && Number.isFinite(v)){ out[k] = v; n += 1; return; }
		if(typeof v === 'boolean'){ out[k] = v; n += 1; }
	});
	return n ? out : null;
}
