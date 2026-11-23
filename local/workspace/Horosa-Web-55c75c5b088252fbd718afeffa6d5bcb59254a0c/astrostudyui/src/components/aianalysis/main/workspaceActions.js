// AI 分析页 · 工作区操作:导出工作区备份、删资料时清理组合引用、拉取模型与嵌入清单
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { AI_ANALYSIS_SCHEMA_VERSION, AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, listStoreRecords, putStoreRecord } from '../../../utils/aiAnalysisStore';
import { isSecretStore, redactSecretRecord } from '../../../utils/aiSecretStores';
import { fetchProviderModels } from '../../../services/aianalysis';
import { exportWorkspaceBackupBlob, saveBlobToBrowser } from '../../../utils/aiAnalysisExport';
import { getProviderProtocolFamily } from '../../../utils/aiAnalysisProviders';
import { uniqueTextList, ensureServiceResponse, normalizeProviderResultModels, sortByUpdatedDesc } from './providerForm';
import { notifySaveResult } from './pageConst';

export async function exportWorkspaceBackupInner(){
	const workspace = {
		snapshotVersion: AI_ANALYSIS_SCHEMA_VERSION,
		exportedAt: new Date().toISOString(),
		stores: {},
	};
	// 派生缓存(context_cache)不入包:体积大,且恢复后按 sourceUpdatedAt 立刻失效、按需重建。
	const storeKeys = Object.values(AI_ANALYSIS_STORES).filter((name)=>AI_BACKUP_EXCLUDED_STORES.indexOf(name) < 0);
	for(let i=0; i<storeKeys.length; i++){
		workspace.stores[storeKeys[i]] = await listStoreRecords(storeKeys[i]);
	}
	// 🔴 listStoreRecords(providerProfiles) 读端自动解密——原样入包=备份文件
	// 泄明文 API 密钥(放网盘/转发即外泄)。导出一律剥密置空;恢复端读到空 key 走既有
	// 「提示重填」语义,零额外处理。
	// 剥密走单源 aiSecretStores(穷举带密钥的店:接口档案 + 联网检索等集成档案),此前只剥 provider_profiles,
	// integration_profiles 的第三方 Key 以明文进 zip。
	Object.keys(workspace.stores).forEach((name)=>{
		if(isSecretStore(name) && Array.isArray(workspace.stores[name])){
			workspace.stores[name] = workspace.stores[name].map((rec)=>redactSecretRecord(rec));
		}
	});
	const blob = await exportWorkspaceBackupBlob(workspace);
	// 此前桌面桥失败(含用户取消)回落浏览器下载再报「备份已导出」= 取消也报成功;现单源保存如实报。
	notifySaveResult(await saveBlobToBrowser('horosa-ai-analysis-backup.zip', blob), '备份已导出');
}

// 删掉资料 / 模版 / 接口后,组合里指向它的 id 是**悬空引用**:组合编辑器的下拉显示裸 id,
// 「一键应用」指向已删接口时模型选择被 effect 静默回落到别的接口却仍提示「已应用组合」。删除即就地清理。
export async function pruneBundleRefs({ bundles, setBundles }, { materialId, templateId, providerProfileId }){
	const hit = (bundles || []).filter((b)=>{
		if(!b){ return false; }
		if(materialId && ((b.materialIds || []).indexOf(materialId) >= 0 || (b.defaultMaterialIds || []).indexOf(materialId) >= 0)){ return true; }
		if(templateId && b.templateId === templateId){ return true; }
		if(providerProfileId && b.defaultProviderProfileId === providerProfileId){ return true; }
		return false;
	});
	if(!hit.length){ return 0; }
	const saved = [];
	for(let i = 0; i < hit.length; i++){
		const b = hit[i];
		const next = { ...b, updatedAt: new Date().toISOString() };
		if(materialId){
			next.materialIds = (b.materialIds || []).filter((id)=>id !== materialId);
			next.defaultMaterialIds = (b.defaultMaterialIds || []).filter((id)=>id !== materialId);
		}
		if(templateId && b.templateId === templateId){ next.templateId = null; }
		if(providerProfileId && b.defaultProviderProfileId === providerProfileId){
			next.defaultProviderProfileId = null;
			next.defaultModel = null;   // 接口没了,钉在它上面的模型名也没意义
		}
		// eslint-disable-next-line no-await-in-loop
		saved.push(await putStoreRecord(AI_ANALYSIS_STORES.bundles, next, 'bundle'));
	}
	const byId = new Map(saved.map((x)=>[x.id, x]));
	setBundles((prev)=>prev.map((x)=>byId.get(x.id) || x));
	return saved.length;
}

export async function fetchModelsAndEmbeddings({ setProviderProfiles }, profile){
	try{
		const rsp = ensureServiceResponse(await fetchProviderModels({
			providerType: profile.providerType,
			apiKey: profile.apiKey,
			baseUrl: profile.baseUrl,
			providerOptions: profile.providerOptions || {},
		}), '拉取模型列表失败');
		const result = rsp && rsp.Result ? rsp.Result : {};
		const normalized = normalizeProviderResultModels(result, profile.providerType, false);
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
			...profile,
			updatedAt: new Date().toISOString(),
			protocolFamily: getProviderProtocolFamily(profile.providerType),
			availableModels: normalized.models,
			chatModelIds: uniqueTextList((profile.chatModelIds || []).concat(normalized.chatModels)),
			embeddingModelIds: uniqueTextList((profile.embeddingModelIds || []).concat(normalized.embeddingModels)),
		}, 'provider');
		setProviderProfiles((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
		message.success(`已拉取 ${normalized.chatModels.length} 个聊天模型${normalized.embeddingModels.length ? `，${normalized.embeddingModels.length} 个 Embedding 模型` : ''}`);
	}catch(e){
		message.error(e && e.message ? `拉取模型列表失败：${e.message}` : '拉取模型列表失败');
	}
}
