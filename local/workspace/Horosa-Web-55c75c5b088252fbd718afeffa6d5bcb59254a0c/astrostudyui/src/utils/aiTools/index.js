// AI 助手·内置工具注册入口(单源):应用内运行时与外部智能体桥启动时各调一次(幂等)。
import { registerTool, listTools } from './registry';
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
// [批五] 操控软件五件:导航 / 合盘配对(read+ui 类别,不落盘可回退)· 星标 / 置顶 / 加标签(additive+records,账本可撤销)
import navigateToTechnique from './tools/navigateToTechnique';
import compareRecords from './tools/compareRecords';
import starRecord from './tools/starRecord';
import pinRecord from './tools/pinRecord';
import addRecordTag from './tools/addRecordTag';

export const BUILTIN_TOOL_DEFS = [
	resolvePlace, listRecords, getCurrentContext, describeSettings, getSettingsTool,
	castTechnique, createChartRecord, createCaseRecord, setSettings, loadRecordIntoWorkspace,
	askUser, listActions, searchMaterials, createGoalTask, scheduleTask, webSearch, noteProgress, webFetch, runAnalysis,
	navigateToTechnique, compareRecords, starRecord, pinRecord, addRecordTag,
];

export function registerBuiltinTools(){
	BUILTIN_TOOL_DEFS.forEach((def)=>registerTool(def));
	return listTools();
}

export { registerTool, unregisterTool, runTool, listTools, getTool, exportToolManifest } from './registry';
export { registerWorkspaceBridge, getWorkspaceBridge, registerWorkspaceUi, getWorkspaceUi, waitForWorkspaceUi } from './workspaceBridge';
export { listActions as listLedgerActions, undoAction, getAction, subscribeLedger, registerUndoHandler } from './ledger';
