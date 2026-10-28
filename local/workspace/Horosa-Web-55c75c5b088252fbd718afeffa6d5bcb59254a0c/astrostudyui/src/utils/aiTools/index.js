// AI 助手·内置工具注册入口(单源):应用内运行时与外部智能体桥启动时各调一次(幂等)。
import { registerTool, listTools } from './registry';
import { toolLabel } from './labels';
import resolvePlace from './tools/resolvePlace';
import listRecords from './tools/listRecords';
import getCurrentContext from './tools/getCurrentContext';
import describeSettings, { getSettingsTool } from './tools/describeSettings';
import castTechnique from './tools/castTechnique';
import createChartRecord from './tools/createChartRecord';
import createCaseRecord from './tools/createCaseRecord';
import setSettings from './tools/setSettings';
import loadRecordIntoWorkspace from './tools/loadRecordIntoWorkspace';
import askUser from './tools/askUser';
import listActions from './tools/listActions';
import searchMaterials from './tools/searchMaterials';
import createGoalTask from './tools/createGoalTask';
import scheduleTask from './tools/scheduleTask';
import webSearch from './tools/webSearch';
import noteProgress from './tools/noteProgress';
import webFetch from './tools/webFetch';
import runAnalysis from './tools/runAnalysis';
// 操控软件五件:导航 / 合盘配对(read+ui 类别,不落盘可回退)· 星标 / 置顶 / 加标签(additive+records,账本可撤销)
import navigateToTechnique from './tools/navigateToTechnique';
import compareRecords from './tools/compareRecords';
import starRecord from './tools/starRecord';
import pinRecord from './tools/pinRecord';
import addRecordTag from './tools/addRecordTag';
// 只读能力:后台任务 / 无头合盘取数 / 天星择日三件 / 玄学史两件 / 当前页正文 / 私人内容三件(子开关缺省关,只经 MCP)
import { listTasksTool, getTaskTool } from './tools/listTasks';
import castRelative from './tools/castRelative';
import { listElectionConditionsTool, searchElectionTool, explainElectionTool } from './tools/searchElection';
import { searchXuanshiTool, getXuanshiItemTool } from './tools/searchXuanshi';
import readCurrentPage from './tools/readCurrentPage';
import { listConversationsTool, getConversationTool, getRecordDetailTool } from './tools/privateRead';
// 只增写入:断事日志追加 / 档案关系边;界面动作:对话挂载
import { appendRecordJournalTool, linkRecordsTool } from './tools/recordJournal';
import setChatMount from './tools/setChatMount';
// 按用户起卦结果建事盘 + 输入格式目录
import { listDivinationCastsTool, castDivinationCaseTool } from './tools/castDivinationCase';
// 档案提案:提议修改 / 提议归档 / 查提案(采纳与否只由用户在任务中心决定)
import { proposeRecordEditTool, proposeRecordArchiveTool, listProposalsTool } from './tools/proposeRecord';
// 各流派择日搜索(黄历 / 八字 / 紫微 / 六壬 / 太乙 / 奇门 / 七政 / 印度)
import { listZeriConditionsTool, searchZeriTool, explainZeriTool } from './tools/searchZeri';
// 名人库(离线 Astro-Databank 出生资料 + 维基简介):检索 / 分类 / 详情 / 存成命盘
import { searchCelebritiesTool, listCelebrityCategoriesTool, getCelebrityTool, createCelebrityChartTool } from './tools/celebrities';

export const BUILTIN_TOOL_DEFS = [
	resolvePlace, listRecords, getCurrentContext, describeSettings, getSettingsTool,
	castTechnique, createChartRecord, createCaseRecord, setSettings, loadRecordIntoWorkspace,
	askUser, listActions, searchMaterials, createGoalTask, scheduleTask, webSearch, noteProgress, webFetch, runAnalysis,
	navigateToTechnique, compareRecords, starRecord, pinRecord, addRecordTag,
	listTasksTool, getTaskTool, castRelative, listElectionConditionsTool, searchElectionTool, explainElectionTool,
	searchXuanshiTool, getXuanshiItemTool, readCurrentPage, listConversationsTool, getConversationTool, getRecordDetailTool,
	appendRecordJournalTool, linkRecordsTool, setChatMount,
	listDivinationCastsTool, castDivinationCaseTool,
	proposeRecordEditTool, proposeRecordArchiveTool, listProposalsTool,
	listZeriConditionsTool, searchZeriTool, explainZeriTool,
	searchCelebritiesTool, listCelebrityCategoriesTool, getCelebrityTool, createCelebrityChartTool,
];

export function registerBuiltinTools(){
	BUILTIN_TOOL_DEFS.forEach((def)=>registerTool(def));
	return listTools();
}

// 「按工具名」下拉的选项(行动能力卡的放行 / 禁用、自动规则的「只对工具」):内置目录(注册后读)+ 已接入的外部工具;标签走单源
export function listToolNameOptions(){
	try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
	return listTools().map((d)=>({ value: d.name, label: `${toolLabel(d.name)}(${d.name})` }));
}

export { registerTool, runTool, listTools, getTool, exportToolManifest } from './registry';
export { registerWorkspaceBridge, getWorkspaceUi } from './workspaceBridge';
export { undoAction, subscribeLedger } from './ledger';
