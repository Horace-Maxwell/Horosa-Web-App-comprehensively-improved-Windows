// AI 分析页 · 资料库:编辑 / 保存 / 导入资料、文件夹增删改、批量摄入、桌面选文件与文件夹、删除 / 替换 / 去重
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Modal as AntdModal } from 'antd';
import { message } from 'antd';
import { AI_ANALYSIS_SCHEMA_VERSION, AI_ANALYSIS_STORES, buildMaterialSearchText, deleteStoreRecord, deleteWhere, putStoreRecord } from '../../../utils/aiAnalysisStore';
import { parseMaterialFile, isSupportedMaterialFile, MATERIAL_IMPORT_EXTENSIONS, MATERIAL_BACKEND_MAX_BYTES, oversizeForBackend, describeExtractTruncation } from '../../../utils/aiAnalysisMaterial';
import { pickDesktopFiles, pickDesktopFolder } from '../../../utils/aiAnalysisDesktop';
import { normalizeTags, sortByUpdatedDesc, compareByName } from './providerForm';
import { asyncInput, asyncConfirm } from './chatHelpers';

export function openMaterialEditor({ setEditingMaterial, materialForm, setMaterialModalOpen }, material){
	setEditingMaterial(material || null);
	materialForm.setFieldsValue({
		name: material ? material.name : '',
		tags: material ? (material.tags || []).join(', ') : '',
		folderId: material ? material.folderId : undefined,
		schools: material && Array.isArray(material.schools) ? material.schools : [],
		extractedText: material ? material.extractedText : '',
	});
	setMaterialModalOpen(true);
}

export async function saveMaterialForm({ materialForm, editingMaterial, setMaterials, setMaterialModalOpen, setEditingMaterial }){
	const values = await materialForm.validateFields();
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
		...(editingMaterial || {}),
		updatedAt: new Date().toISOString(),   // 编辑即刷新更新时间
		name: values.name,
		fileName: editingMaterial && editingMaterial.fileName ? editingMaterial.fileName : values.name,
		kind: editingMaterial && editingMaterial.kind ? editingMaterial.kind : 'note',
		folderId: values.folderId || null,
		tags: normalizeTags(values.tags),
		// 资料可按流派标记后过滤
		schools: Array.isArray(values.schools) ? values.schools.filter((s)=>`${s||''}`.trim()) : [],
		extractedText: `${values.extractedText || ''}`.trim(),
		searchText: buildMaterialSearchText({
			...(editingMaterial || {}),
			name: values.name,
			tags: normalizeTags(values.tags),
			extractedText: `${values.extractedText || ''}`.trim(),
		}),
	}, 'material');
	// 正文变了就删旧切块与向量(与「替换文件」同式):切块入口只要库里有旧切块即返回 → 检索路径继续用旧文本。
	const prevText = `${(editingMaterial && editingMaterial.extractedText) || ''}`.trim();
	if(editingMaterial && editingMaterial.id && prevText !== `${values.extractedText || ''}`.trim()){
		await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === editingMaterial.id, { index: 'materialId', value: editingMaterial.id });
		await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === editingMaterial.id, { index: 'materialId', value: editingMaterial.id });
	}
	setMaterials((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
	setMaterialModalOpen(false);
	setEditingMaterial(null);
	message.success('资料已保存');
}

export async function saveImportedMaterial({ setMaterials }, parsed, extra = {}){
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
		name: parsed.name,
		fileName: parsed.fileName || parsed.name,
		fileExt: parsed.fileExt || '',
		kind: parsed.kind,
		size: parsed.size || 0,
		mimeType: parsed.mimeType || '',
		fileHash: parsed.fileHash || '',
		textHash: parsed.textHash || '',
		originBlob: parsed.originBlob || '',
		tags: normalizeTags(extra.tags),
		folderId: extra.folderId || null,
		extractedText: parsed.extractedText || '',
		extractMeta: parsed.extractMeta || {},
		searchText: buildMaterialSearchText({
			...parsed,
			tags: normalizeTags(extra.tags),
		}),
		schemaVersion: AI_ANALYSIS_SCHEMA_VERSION,
	}, 'material');
	setMaterials((prev)=>sortByUpdatedDesc([saved].concat(prev.filter((item)=>item.id !== saved.id))));
	return saved;
}

export async function handleImportFileLike({ materials, loadWorkspace, saveImportedMaterial }, fileLike, batch){
	const parsed = await parseMaterialFile(fileLike);
	const batchHit = (batch && parsed.fileHash) ? (batch.seen.get(parsed.fileHash) || null) : null;
	const duplicate = batchHit || materials.find((item)=>item.fileHash && parsed.fileHash && item.fileHash === parsed.fileHash);
	if(duplicate){
		const action = await asyncInput({
			title: '发现重复资料',
			defaultValue: 'skip',
			placeholder: '输入 keep / overwrite / skip',
			multiline: false,
		});
		if(action === 'overwrite'){
			const overwritten = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
				...duplicate,
				...parsed,
				id: duplicate.id,
				name: parsed.name,
				searchText: buildMaterialSearchText(parsed),
				/* 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
			}, 'material');
			await loadWorkspace({ keepConversation: true });
			if(batch && parsed.fileHash){ batch.seen.set(parsed.fileHash, overwritten || { ...duplicate, ...parsed, id: duplicate.id }); }
			message.success(`已覆盖资料：${duplicate.name}`);
			return 'overwritten';
		}
		if(action !== 'keep'){
			message.info('已跳过重复资料');
			return 'skipped';
		}
	}
	const saved = await saveImportedMaterial(parsed);
	if(batch && parsed.fileHash){ batch.seen.set(parsed.fileHash, saved); }
	message.success(`资料已导入：${parsed.name}`);
	return 'imported';
}

export async function importFileLikeList({ newImportBatch, handleImportFileLike }, fileList, options = {}){
	const all = Array.from(fileList || []).filter(Boolean);
	// 与 ingestFiles 同一张白名单:浏览器目录选择忽略 accept(整目录所有文件,含 .DS_Store、图片)
	const list = all.filter((f)=>isSupportedMaterialFile(f));
	const rejected = all.length - list.length;
	if(rejected > 0){ message.warning(`已跳过 ${rejected} 个不支持的文件(只收 ${MATERIAL_IMPORT_EXTENSIONS.join(' / ')})`); }
	let count = 0;
	const batch = newImportBatch();   // 批内去重台账
	for(let i=0; i<list.length; i++){
		const result = await handleImportFileLike(list[i], batch);
		if(result === 'imported' || result === 'overwritten'){
			count += 1;
		}
	}
	if(count && options.successMessage){
		message.success(options.successMessage(count));
	}
	return count;
}

export async function handleUploadMaterial({ handleImportFileLike }, file){
	try{
		await handleImportFileLike(file);
		return false;
	}catch(e){
		console.error(e);
		message.error('资料导入失败');
		return false;
	}
}

// 资料 folder CRUD（落 store + 局部刷状态，避免整 workspace 重载）。
export async function handleCreateFolder({ folderDraftName, setMaterialFolders, setFolderDraftName }){
	const name = `${folderDraftName || ''}`.trim();
	if(!name){ message.warning('请填写文件夹名称'); return; }
	try{
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.materialFolders, { name }, 'mfolder');
		setMaterialFolders((prev)=>compareByName(prev.concat(saved)));
		setFolderDraftName('');
		message.success(`已新建文件夹「${saved.name}」`);
	}catch(e){ console.error(e); message.error('新建失败'); }
}

export async function handleRenameFolder({ setMaterialFolders }, folder){
	const nextName = await asyncInput({ title: '重命名文件夹', defaultValue: folder.name || '', placeholder: '输入新文件夹名称', maxLength: 40 });
	if(nextName === null) return;
	const name = `${nextName || ''}`.trim();
	if(!name){ message.warning('名称不能为空'); return; }
	try{
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.materialFolders, { ...folder, name, updatedAt: new Date().toISOString(), }, 'mfolder');
		setMaterialFolders((prev)=>compareByName(prev.map((it)=>it.id === saved.id ? saved : it)));
		message.success('已重命名');
	}catch(e){ console.error(e); message.error('重命名失败'); }
}

export async function handleDeleteFolder({ materials, setMaterialFolders, loadWorkspace, selectedFolderId, setSelectedFolderId }, folder){
	const inside = materials.filter((m)=>m.folderId === folder.id);
	const ok = await asyncConfirm({
		title: `删除文件夹「${folder.name}」？`,
		content: `内含 ${inside.length} 份资料将自动移到「未分类」。`,
		okText: '删除',
		cancelText: '取消',
		danger: true,
	});
	if(!ok) return;
	try{
		// 先把资料移出，避免外键悬空。
		for(const m of inside){
			await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...m, folderId: null, updatedAt: new Date().toISOString(), }, 'material');
		}
		await deleteStoreRecord(AI_ANALYSIS_STORES.materialFolders, folder.id);
		setMaterialFolders((prev)=>prev.filter((it)=>it.id !== folder.id));
		if(inside.length){ await loadWorkspace({ keepConversation: true }); }
		if(selectedFolderId === folder.id) setSelectedFolderId('');
		message.success('已删除');
	}catch(e){ console.error(e); message.error('删除失败'); }
}

// 非阻塞批量导入：用队列驱动进度条 + 对重复文件「全部跳过/全部覆盖/逐条」一次决策（不再 window.prompt 反复弹）。
export async function ingestFiles({ isMountedRef, setMaterialIngestQueue, materials, saveImportedMaterial, loadWorkspace }, fileList, options = {}){
	const all = Array.from(fileList || []).filter((f)=>f && f.name);
	// 按同一张扩展名白名单过滤(与桌面壳层逐字同集)。此前拖拽 / 浏览器目录选择不受 accept
	// 约束,guessKind 把一切未知后缀当 txt、readAsText 直接读二进制 —— 拖一张 PNG 进来就是一份乱码资料。
	const files = all.filter((f)=>isSupportedMaterialFile(f));
	const rejected = all.filter((f)=>!isSupportedMaterialFile(f));
	if(rejected.length){
		// 不静默丢:在队列里留「类型不支持」的痕迹,2 秒后随队列一起清
		const skipQ = rejected.map((f)=>({ id: `${f.name}-skip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, size: f.size || 0, status: 'skip', err: '类型不支持' }));
		if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.concat(skipQ)); }
		message.warning(`已跳过 ${rejected.length} 个不支持的文件(只收 ${MATERIAL_IMPORT_EXTENSIONS.join(' / ')})`);
		// 只清本批自己的行(此前整条队列清空 → 并发的另一批进度/报错行一起消失)
		const skipIds = new Set(skipQ.map((q)=>q.id));
		if(!files.length){ setTimeout(()=>{ if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.filter((q)=>!skipIds.has(q.id))); } }, 2400); }
	}
	if(!files.length) return;
	// 走后端抽取的 pdf/doc/docx 直接按后端 30MB 硬上限拦截:此前只有一个 50MB「仍要上传」软提示,
	// 35MB 的 PDF 一路送到后端才被 580103 拒,用户看到的是一句无解释的失败(而且整批就此中断)。
	const overBackend = files.filter((f)=>oversizeForBackend(f));
	if(overBackend.length){
		const names = overBackend.map((f)=>`${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join('、');
		message.warning(`以下文件超过 ${MATERIAL_BACKEND_MAX_BYTES / 1024 / 1024} MB 抽取上限,已跳过:${names}`);
	}
	const sized = files.filter((f)=>!oversizeForBackend(f));
	if(!sized.length){ return; }
	// v1.16-BB5: 大文件 OOM 守门 — > 50MB 警告(parseMaterialFile 内部用 base64,大文件可能爆内存/UI 卡死)
	const HUGE = 50 * 1024 * 1024;
	const hugeFiles = sized.filter((f)=>f.size > HUGE);
	if(hugeFiles.length){
		const list = hugeFiles.map((f)=>`${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`).join('\n');
		const proceed = await new Promise((resolve)=>{
			// 用 antd 原件的静态方法(统一件 XQModal 没有 confirm:此前这里抛 TypeError,超大文件那一批导入静默中断)
			AntdModal.confirm({
				title: '检测到超大文件 (> 50MB)',
				content: <div>以下文件可能解析慢或导致 UI 卡顿:<pre style={{maxHeight:120,overflow:'auto',background:'rgba(127,127,127,0.14)',padding:8,fontSize:12}}>{list}</pre>建议先拆分或转 .txt 后再上传。仍要继续吗?</div>,
				okText: '仍要上传',
				cancelText: '取消',
				onOk: ()=>resolve(true),
				onCancel: ()=>resolve(false),
			});
		});
		if(!proceed) return;
	}
	// 初始化队列；统一过 safeSetQ 守门，组件 unmount 后绝不 setState。
	const safeSetQ = (updater)=>{ if(isMountedRef.current){ setMaterialIngestQueue(updater); } };
	const queue = sized.map((f)=>({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: f.name, size: f.size || 0, status: 'parsing' }));
	safeSetQ((prev)=>prev.concat(queue));
	const dupePolicy = options.dupePolicy || 'ask'; // 'ask' | 'skip' | 'overwrite' | 'keep'
	const batchSeen = new Map();   // 批内已入库的 fileHash → 记录(materials 在本循环里不回灌)
	let askedAll = null; // 设置后剩余所有重复都按此处理
	let ok = 0;
	for(let i = 0; i < sized.length; i++){
		if(!isMountedRef.current){ break; } // unmount 后立刻退出循环。
		const f = sized[i];
		const qid = queue[i].id;
		try{
			safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'parsing' } : q));
			const parsed = await parseMaterialFile(f);
			if(!isMountedRef.current){ break; }
			const duplicate = (parsed.fileHash ? batchSeen.get(parsed.fileHash) : null)
				|| materials.find((m)=>m.fileHash && parsed.fileHash && m.fileHash === parsed.fileHash);   // 先查批内台账
			let action = askedAll || (duplicate ? (dupePolicy === 'ask' ? null : dupePolicy) : 'import');
			if(duplicate && !action){
				// 异步弹层：覆盖 / 跳过 / 全部覆盖 / 全部跳过（用 asyncConfirm 不行——需要多按钮，改用自定义 Modal）。
				const decision = await new Promise((resolve)=>{
					let resolved = false;
					let modalRef = null;
					const finish = (v)=>{ if(resolved) return; resolved = true; try{ if(modalRef) modalRef.destroy(); }catch(_){} resolve(v); };
					modalRef = AntdModal.confirm({
						title: `发现重复资料「${(duplicate && duplicate.name) || '未命名'}」`,
						icon: null,
						content: '后续操作：',
						centered: true,
						width: 460,
						okText: '覆盖',
						cancelText: '跳过',
						onOk: ()=>finish('overwrite'),
						onCancel: ()=>finish('skip'),
						footer: ()=>(
							<div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
								<button onClick={()=>finish('skip')} className="ant-btn ant-btn-default">跳过</button>
								<button onClick={()=>{ askedAll = 'skip'; finish('skip'); }} className="ant-btn ant-btn-default">全部跳过</button>
								<button onClick={()=>finish('overwrite')} className="ant-btn ant-btn-primary">覆盖</button>
								<button onClick={()=>{ askedAll = 'overwrite'; finish('overwrite'); }} className="ant-btn ant-btn-primary">全部覆盖</button>
							</div>
						),
					});
				});
				if(!isMountedRef.current){ break; }
				action = decision;
			}
			safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'importing' } : q));
			if(action === 'overwrite' && duplicate){
				const overwritten = await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...duplicate, ...parsed, id: duplicate.id, name: parsed.name, searchText: buildMaterialSearchText(parsed), updatedAt: new Date().toISOString(), }, 'material');
				if(parsed.fileHash){ batchSeen.set(parsed.fileHash, overwritten || { ...duplicate, ...parsed, id: duplicate.id }); }
				ok++;
			}else if(action === 'skip' && duplicate){
				safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'skip' } : q));
				continue;
			}else{
				const savedMat = await saveImportedMaterial(parsed);
				if(parsed.fileHash){ batchSeen.set(parsed.fileHash, savedMat); }
				ok++;
			}
			const truncNote = describeExtractTruncation(parsed.extractMeta);
			safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'done', truncated: truncNote || '' } : q));
		}catch(e){
			console.error(e);
			safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'error', err: (e && e.message) || '导入失败' } : q));
		}
	}
	if(ok && isMountedRef.current){ try{ await loadWorkspace({ keepConversation: true }); message.success(`已导入 ${ok} 份资料`); }catch(_){} }
	// 2 秒后清队列 —— 只清本批的行:两批并发时先完成的一批曾把整条队列清空,另一批进行中的进度与报错行消失。
	const batchIds = new Set(queue.map((q)=>q.id));
	setTimeout(()=>{ if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.filter((q)=>!batchIds.has(q.id))); } }, 2400);
}

export async function handleDesktopFilePick({
	clearFileInput, desktopFileInputRef, openFallbackFilePicker, formatImportError, ingestFiles,
	desktopItemsToFiles,
}){
	let picked = null;
	try{
		// 只有**桥调用本身**失败才回退浏览器选择。此前整段(含逐个导入)裹在一个 try 里:
		// 任一文件解析失败(例如超 30MB 的 PDF 被后端拒)就提示「桌面选文件暂时不可用」并弹出第二个选择框,
		// 余下文件全不导入,真实错误只进控制台。
		picked = await pickDesktopFiles();
	}catch(e){
		console.error(e);
		clearFileInput(desktopFileInputRef);
		if(openFallbackFilePicker(desktopFileInputRef)){
			message.warning('桌面选文件暂时不可用，已切换为浏览器文件选择');
			return;
		}
		message.error(formatImportError('桌面导入失败', e));
		return;
	}
	await ingestFiles(desktopItemsToFiles(picked));
}

export async function handleDesktopFolderImport({
	clearFileInput, desktopFolderInputRef, openFallbackFilePicker, formatImportError, ingestFiles,
	desktopItemsToFiles,
}){
	let picked = null;
	try{
		picked = await pickDesktopFolder();   // 同上:catch 只管桥调用本身
	}catch(e){
		console.error(e);
		clearFileInput(desktopFolderInputRef);
		if(openFallbackFilePicker(desktopFolderInputRef)){
			message.warning('目录导入暂时不可用，已切换为浏览器目录选择');
			return;
		}
		message.error(formatImportError('目录导入失败', e));
		return;
	}
	// 成功条数由 ingestFiles 按**真正入库的**数量报(此前按选中文件数报,把跳过的重复也算成功)
	await ingestFiles(desktopItemsToFiles(picked));
}

export async function handleDesktopFileInputChange({ importFileLikeList, formatImportError, clearFileInput, desktopFileInputRef }, e){
	try{
		await importFileLikeList(e && e.target ? e.target.files : [], {
			successMessage: (count)=>`已导入 ${count} 份资料`,
		});
	}catch(error){
		console.error(error);
		message.error(formatImportError('资料导入失败', error));
	}finally{
		clearFileInput(desktopFileInputRef);
	}
}

export async function handleDesktopFolderInputChange({ importFileLikeList, formatImportError, clearFileInput, desktopFolderInputRef }, e){
	try{
		const count = await importFileLikeList(e && e.target ? e.target.files : [], {
			successMessage: (total)=>`已从目录导入 ${total} 份资料`,
		});
		if(!count){
			message.info('当前目录中没有可导入的资料文件');
		}
	}catch(error){
		console.error(error);
		message.error(formatImportError('目录导入失败', error));
	}finally{
		clearFileInput(desktopFolderInputRef);
	}
}

// silent:批量路径(去重 / 批删)逐条调用时不逐条弹 toast —— N 份重复就弹 N+1 条,
// 后面的把前面的挤掉,用户只看见一串闪动。单条删除(缺省)照旧弹。
export async function deleteMaterial({ setMaterials, setReferenceIds, pruneConversationRefs, pruneBundleRefs }, materialId, options){
	await deleteStoreRecord(AI_ANALYSIS_STORES.materials, materialId);
	await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === materialId, { index: 'materialId', value: materialId });
	await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === materialId, { index: 'materialId', value: materialId });
	setMaterials((prev)=>prev.filter((item)=>item.id !== materialId));
	setReferenceIds((prev)=>prev.filter((item)=>item !== `material:${materialId}`));
	await pruneConversationRefs(`material:${materialId}`);   // 会话记录里的残留引用同清
	const cleaned = await pruneBundleRefs({ materialId });
	if(!(options && options.silent)){ message.success(cleaned ? `资料已删除（同时从 ${cleaned} 个组合里移除）` : '资料已删除'); }
}

export async function handleReplaceMaterial({ setMaterials }, material, file){
	try{
		const parsed = await parseMaterialFile(file);
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
			...material,
			...parsed,
			updatedAt: new Date().toISOString(),
			id: material.id,
			name: material.name || parsed.name,
			folderId: material.folderId || null,
			tags: material.tags || [],
			searchText: buildMaterialSearchText({
				...material,
				...parsed,
			}),
		}, 'material');
		setMaterials((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
		await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === material.id, { index: 'materialId', value: material.id });
		await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === material.id, { index: 'materialId', value: material.id });
		message.success(`已替换文件：${material.name}`);
	}catch(e){
		console.error(e);
		message.error('替换文件失败');
	}
	return false;
}

export async function dedupeMaterials({ materials, deleteMaterial }){
	const grouped = new Map();
	const duplicates = [];
	materials.forEach((item)=>{
		const key = item.fileHash || item.textHash;
		if(!key){
			return;
		}
		if(grouped.has(key)){
			duplicates.push(item);
			return;
		}
		grouped.set(key, item);
	});
	if(!duplicates.length){
		message.success('未发现重复资料');
		return;
	}
	const ok = await asyncConfirm({
		title: `检测到 ${duplicates.length} 份重复资料`,
		// 文案改真话:列表按 updatedAt 倒序,「首份」其实就是**最新**保存的那份
		content: '是否删除重复项？（保留最新一份，删除更早的重复）',
		okText: '删除重复项',
		cancelText: '取消',
		danger: true,
	});
	if(!ok){
		return;
	}
	for(let i=0; i<duplicates.length; i++){
		await deleteMaterial(duplicates[i].id, { silent: true });   // 只弹下面这条汇总
	}
	message.success(`已删除 ${duplicates.length} 份重复资料`);
}
