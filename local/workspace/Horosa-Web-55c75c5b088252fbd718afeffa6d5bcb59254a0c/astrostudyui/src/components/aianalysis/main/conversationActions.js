// AI 分析页 · 会话管理:删除 / 复制 / 改名 / 导出会话、工作区备份恢复、清理会话里失效的资料引用
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, bulkPutStoreRecords, deleteStoreRecord, clearStore, deleteWhere, listConversationMessages, listStoreRecords, putStoreRecord, replaceConversationMessages, AI_STORE_UNAVAILABLE_ERROR, AI_STORE_UNAVAILABLE_MESSAGE, assertAiStoreDurable } from '../../../utils/aiAnalysisStore';
import { planWorkspaceRestore, restoreWorkspaceStores, AI_BACKUP_MAX_ZIP_BYTES } from '../../../utils/aiWorkspaceRestore';
import { base64ToBlob, exportConversationByFormat, parseWorkspaceBackupBlob, saveBlobToBrowser } from '../../../utils/aiAnalysisExport';
import { openDesktopBackup } from '../../../utils/aiAnalysisDesktop';
import { sortByUpdatedDesc } from './providerForm';
import { asyncInput, asyncConfirm } from './chatHelpers';
import { notifySaveResult } from './pageConst';

// silent 同义:批量删除逐条调用时只由调用方弹一条汇总
export async function handleDeleteConversation({
	activeConversationId, abortRef, setConversations, setSelectedHistoryIds, resetConversationDraft,
}, conversationId, options){
	if(activeConversationId === conversationId && abortRef.current){
		abortRef.current.abort();
	}
	await deleteStoreRecord(AI_ANALYSIS_STORES.conversations, conversationId);
	await deleteWhere(AI_ANALYSIS_STORES.messages, (item)=>item.conversationId === conversationId, { index: 'conversationId', value: conversationId });
	setConversations((prev)=>prev.filter((item)=>item.id !== conversationId));
	setSelectedHistoryIds((prev)=>prev.filter((id)=>id !== conversationId));
	if(activeConversationId === conversationId){
		// 在历史页删掉「当前打开的那条」会话时不要把用户拽回分析页(批量删除更糟:循环中途就切页)
		await resetConversationDraft({ switchTab: false });
	}
	if(!(options && options.silent)){ message.success('对话已删除'); }
}

export async function handleDuplicateConversation({ setConversations }, conversation){
	const copied = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
		...conversation,
		id: null,
		title: `${conversation.title || '未命名对话'}（副本）`,
		parentConversationId: conversation.id,
		branchRootId: conversation.branchRootId || conversation.id,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	}, 'conv');
	const oldMessages = await listConversationMessages(conversation.id);
	await replaceConversationMessages(copied.id, oldMessages.map((item)=>({
		...item,
		id: null,
		conversationId: copied.id,
		branchConversationId: copied.id,
	})));
	setConversations((prev)=>sortByUpdatedDesc([copied].concat(prev)));
	message.success('对话已复制');
}

export async function handleRenameConversation({ updateConversationMeta }, conversation){
	const nextTitle = await asyncInput({ title: '重命名对话', defaultValue: conversation.title || '', placeholder: '输入新的对话标题', maxLength: 60 });
	if(nextTitle === null){
		return;
	}
	const title = `${nextTitle || ''}`.trim();
	if(!title){
		message.warning('标题不能为空');
		return;
	}
	await updateConversationMeta(conversation, { title, titleManuallyEdited: true });
	message.success('标题已更新');
}

// withScreenshot=false:从**历史页**导出时不附页面截图 —— 截图抓的是「当前可见页」,
// 在历史页就是那张会话列表(可能把别人的会话标题与案例名一并印进文档),与导出的这一条会话无关。
// 分析页导出(可见的就是这条会话的消息区)照旧附图。
export async function exportConversation(conversation, format, options){
	const withScreenshot = !(options && options.withScreenshot === false);
	const msgList = await listConversationMessages(conversation.id);
	// docx 形态按「AI导出设置·附页面截图」抓当前页(AI分析页)截图入文档头;失败恒 null 不阻断。
	let pageShotOpts;
	if(format === 'docx' && withScreenshot){
		try{
			const { isAIExportScreenshotEnabled } = await import('../../../utils/aiExport');
			if(isAIExportScreenshotEnabled()){
				const { capturePageScreenshotForExport } = await import('../../../utils/pageScreenshot');
				const { shot } = await capturePageScreenshotForExport();
				if(shot){ pageShotOpts = { pageScreenshot: shot }; }
			}
		}catch(_){ /* 截图失败绝不阻断导出 */ }
	}
	const exported = await exportConversationByFormat(conversation, msgList, format, pageShotOpts);
	// 单源保存:桌面壳保存桥(取消不回落浏览器、不报成功);失败如实提示。
	notifySaveResult(await saveBlobToBrowser(exported.fileName, exported.blob), '已导出对话');
}

export async function restoreWorkspaceBackup({ loadWorkspace, resetConversationDraft }, blob){
	// 🔴 破坏性操作三闸(曾裸奔:无确认、无校验、先删后写、异常静默):
	// ① 内容校验先行 —— manifest 能解析但没有 stores 时,旧实现会把全部 store 清空后
	//    一条不还原(全量数据丢失);② 二次确认;③ 逐 store 校验通过后才动库。
	// 只替换包内存在的数据集(缺席的一律不动)+ 恢复前快照与中途回滚 + 未来版拒 + 体积上限:此前对每个已知店 clear+bulkPut(缺则 []),
	//   一个只含单店的包能把其余二十多个店清空,且无事务无回滚。
	let payload = null;
	try{
		payload = await parseWorkspaceBackupBlob(blob, { maxBytes: AI_BACKUP_MAX_ZIP_BYTES });
	}catch(e){
		message.error(`${e && e.message}` === 'backup.too.large' ? '备份文件超过 200 MB 上限,已取消恢复 —— 现有数据未改动' : '备份内容无效(不是有效的备份包),已取消恢复 —— 现有数据未改动');
		return;
	}
	// 恢复同样跳过派生缓存:旧包里的 context_cache 不覆盖本机缓存。
	const storeKeys = Object.values(AI_ANALYSIS_STORES).filter((name)=>AI_BACKUP_EXCLUDED_STORES.indexOf(name) < 0);
	const plan = planWorkspaceRestore(payload, storeKeys);
	if(!plan.ok){
		// 全量包无 AI 工作区段 → 指路命盘列表的全量恢复;含 aiWorkspace 段的全量包已由 plan 自动取段。
		message.error(plan.error === 'backup.version.future' ? '这份备份由更新版本创建,当前版本无法恢复 —— 现有数据未改动'
			: plan.error === 'backup.unified.no.ai' ? '这是「全量备份」包但不含 AI 工作区段:命盘 / 事盘请到「命盘列表 → 恢复全量备份」恢复;AI 工作区请用 AI 分析页导出的备份 —— 现有数据未改动'
			: '备份内容无效(缺少工作区数据),已取消恢复 —— 现有数据未改动');
		return;
	}
	const ok = await asyncConfirm({
		title: '恢复备份将替换包内的数据集',
		content: `${plan.unified ? '(识别为全量备份包,只恢复其中的 AI 工作区段;命盘 / 事盘请到「命盘列表 → 恢复全量备份」)' : ''}只替换备份包里带的 ${plan.present.length} 个数据集(共 ${plan.total} 条记录),包里没有的 ${plan.absent.length} 个数据集不动。接口档案与集成档案的密钥按 id 保留本机现值(备份包里是脱敏占位,不会清空本机 Key)。替换前会先做内存快照,中途出错自动回滚;建议先导出一份当前备份。确定继续?`,
		okText: '确认恢复',
		cancelText: '取消',
	});
	if(!ok){
		return;
	}
	try{
		await restoreWorkspaceStores(plan, { clearStore, bulkPutStoreRecords, listStoreRecords, putStoreRecord, metaStore: AI_ANALYSIS_STORES.workspaceMeta, assertDurable: assertAiStoreDurable });
	}catch(e){
		console.error(e);
		if(e && e.code === AI_STORE_UNAVAILABLE_ERROR){ message.error(AI_STORE_UNAVAILABLE_MESSAGE); return; }
		message.error('恢复中途出错,已按快照回滚,现有数据未改动');
		await loadWorkspace();
		return;
	}
	// 恢复后当前会话可能已被替换 / 不存在:包内带会话或消息店 → 重置当前会话(避免界面仍显示旧消息);否则保留当前会话并重载其消息。
	const touchesConv = plan.present.indexOf(AI_ANALYSIS_STORES.conversations) >= 0 || plan.present.indexOf(AI_ANALYSIS_STORES.messages) >= 0;
	if(touchesConv){
		await resetConversationDraft({ switchTab: false });
		await loadWorkspace();
	}else{
		await loadWorkspace({ keepConversation: true });
	}
	message.success(`备份已恢复(${plan.present.length} 个数据集)`);
}

export async function handleRestoreWorkspaceBackup({ desktopBridge, restoreWorkspaceBackup, backupRestoreInputRef }){
	if(desktopBridge){
		let payload;
		try{
			payload = await openDesktopBackup();
		}catch(e){
			// 只有**桥调用抛错**才回退浏览器 input
			console.warn(e);
			payload = undefined;
		}
		if(payload !== undefined){
			// 原生对话框点「取消」时壳回 Ok(None) → 这里是 null,是**用户取消**,不是失败。
			// 此前 null 直接落到隐藏 input 的 click(),于是取消完又弹出第二个选择框(统一备份入口早就按取消 return)。
			if(!payload || !payload.base64Data){ return; }
			await restoreWorkspaceBackup(base64ToBlob(payload.base64Data, payload.mimeType || 'application/zip'));
			return;
		}
	}
	if(backupRestoreInputRef.current){
		backupRestoreInputRef.current.value = '';
		backupRestoreInputRef.current.click();
	}
}

export async function handleBackupRestoreInputChange({ restoreWorkspaceBackup, backupRestoreInputRef }, e){
	const file = e && e.target && e.target.files ? e.target.files[0] : null;
	try{
		if(file){
			await restoreWorkspaceBackup(file);
		}
	}catch(err){
		// 🔴 曾无 try/catch:非 Horosa zip 抛 backup.manifest.missing → 未捕获 rejection、
		// 无任何提示,且 value 复位被跳过导致同一文件再选不触发 change(看起来「点了没反应」)。
		message.error(`恢复失败:${(err && err.message) || '备份文件无法解析'}`);
	}finally{
		if(backupRestoreInputRef.current){
			backupRestoreInputRef.current.value = '';
		}
	}
}

// 删组合/资料/模版后,已存会话记录里的 `<kind>:<id>` 引用同批清掉:此前只过滤当前 state 的
//   referenceIds,重开旧会话原样灌回,挂载横幅按数组长度计数「📚 N 资料 / 组合」而解析时静默丢弃。
export async function pruneConversationRefs({ setConversations }, refId){
	try{
		const list = await listStoreRecords(AI_ANALYSIS_STORES.conversations);
		const hit = (list || []).filter((c)=>c && Array.isArray(c.referenceIds) && c.referenceIds.indexOf(refId) >= 0);
		if(!hit.length){ return 0; }
		const next = hit.map((c)=>({ ...c, referenceIds: c.referenceIds.filter((x)=>x !== refId) }));
		await bulkPutStoreRecords(AI_ANALYSIS_STORES.conversations, next, 'conv');
		const byId = new Map(next.map((c)=>[c.id, c]));
		setConversations((prev)=>prev.map((c)=>byId.get(c.id) || c));
		return hit.length;
	}catch(e){
		console.error(e);
		return 0;
	}
}
