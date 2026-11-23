// AI 分析页 · 其余页签:模板版本对比、历史、资料库、模板、进阶、设置
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Dropdown, Popconfirm, Space, Table, Tag, Tooltip, Typography, Upload } from 'antd';
import styles from '../AIAnalysisMain.less';
import { normalizeSkillPack } from '../../../utils/aiChat/skills';
import XQIcon from '../../xq-icons';
import { XQButton as Button, XQCard as Card, XQInput as Input, XQSelect as Select, XQEmpty } from '../../xq-ui';
import AgentAbilityPanel from '../AgentAbilityPanel';
import AdvancedPane from '../chat/AdvancedPane';
import { buildTimestampLabel, saveUiPrefs } from '../../../utils/aiAnalysisStore';
import { MATERIAL_ACCEPT_ATTR, describeExtractTruncation } from '../../../utils/aiAnalysisMaterial';
import { getProviderDisplayName, getProviderProtocolFamily } from '../../../utils/aiAnalysisProviders';
import { providerHealthLabel, uniqueTextList, normalizeProfileChatModels, normalizeEmbeddingModels } from './providerForm';
const { Search } = Input;
const { Text } = Typography;

// 模板版本 diff：line-level Myers/LCS（小快简单实现，超过 1500 行截断）。
export function diffLines(a, b){
	const aLines = (a || '').split('\n').slice(0, 1500);
	const bLines = (b || '').split('\n').slice(0, 1500);
	const m = aLines.length, n = bLines.length;
	const dp = Array.from({ length: m + 1 }, ()=>new Uint16Array(n + 1));
	for(let i = 1; i <= m; i++){
		for(let j = 1; j <= n; j++){
			dp[i][j] = aLines[i - 1] === bLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}
	const out = [];
	let i = m, j = n;
	while(i > 0 && j > 0){
		if(aLines[i - 1] === bLines[j - 1]){ out.push({ t: 'eq', a: aLines[i - 1] }); i--; j--; }
		else if(dp[i - 1][j] >= dp[i][j - 1]){ out.push({ t: 'del', a: aLines[i - 1] }); i--; }
		else { out.push({ t: 'add', a: bLines[j - 1] }); j--; }
	}
	while(i > 0){ out.push({ t: 'del', a: aLines[--i] }); }
	while(j > 0){ out.push({ t: 'add', a: bLines[--j] }); }
	return out.reverse();
}

export function renderTemplateVersionDiff({ versionDiffState, setVersionDiffState, templateVersions, diffLines }){
	if(!versionDiffState) return null;
	const { template, leftId, rightId } = versionDiffState;
	if(!template) return <XQEmpty description="模板已不存在" />;
	const allVs = templateVersions.filter((v)=>v.templateId === template.id).sort((a,b)=>(b.versionNumber||0)-(a.versionNumber||0));
	if(allVs.length < 2) return <XQEmpty description="该模板版本不足两个，无法对比" />;
	const left = allVs.find((v)=>v.id === leftId) || allVs[1];
	const right = allVs.find((v)=>v.id === rightId) || allVs[0];
	const snapText = (v)=>{
		if(!v) return '';
		const s = v.snapshot || {};
		return JSON.stringify({
			format: s.format, instructionText: s.instructionText, jsonSchema: s.jsonSchema,
			exampleInput: s.exampleInput, exampleOutput: s.exampleOutput,
		}, null, 2);
	};
	const leftText = snapText(left);
	const rightText = snapText(right);
	const diff = diffLines(leftText, rightText);
	return (
		<div>
			<div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
				<span>选版本：</span>
				<Select size="small" value={leftId} style={{ width: 120 }} onChange={(v)=>setVersionDiffState((s)=>({ ...s, leftId: v }))}>
					{allVs.map((v)=><Select.Option key={v.id} value={v.id}>V{v.versionNumber}</Select.Option>)}
				</Select>
				<span style={{ color: 'var(--horosa-text-soft)' }}>→</span>
				<Select size="small" value={rightId} style={{ width: 120 }} onChange={(v)=>setVersionDiffState((s)=>({ ...s, rightId: v }))}>
					{allVs.map((v)=><Select.Option key={v.id} value={v.id}>V{v.versionNumber}</Select.Option>)}
				</Select>
				<span style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>共 {diff.length} 行变更，增 {diff.filter((d)=>d.t==='add').length} / 删 {diff.filter((d)=>d.t==='del').length} / 同 {diff.filter((d)=>d.t==='eq').length}</span>
			</div>
			<div className={styles.templateDiffWrap}>
				<div className={styles.templateDiffCol}>
					<h4>V{(left && left.versionNumber) || '?'}</h4>
					<div className={styles.templateDiffBox}>
						{diff.filter((d)=>d.t !== 'add').map((d, i)=>(
							<div key={i} className={d.t === 'del' ? styles.templateDiffDel : ''}>{d.a || ' '}</div>
						))}
					</div>
				</div>
				<div className={styles.templateDiffCol}>
					<h4>V{(right && right.versionNumber) || '?'}</h4>
					<div className={styles.templateDiffBox}>
						{diff.filter((d)=>d.t !== 'del').map((d, i)=>(
							<div key={i} className={d.t === 'add' ? styles.templateDiffAdd : ''}>{d.a || ' '}</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export function renderHistoryPane({
	conversations, historyKeyword, setHistoryKeyword, historyFilter, setHistoryFilter,
	resetConversationDraft, exportSelectedConversations, selectedHistoryIds, handleArchiveSelected,
	handleFavoriteSelected, handleBatchDeleteConversations, filteredConversations, setSelectedHistoryIds,
	height, openConversation, handleRenameConversation, handleDuplicateConversation,
	handleToggleConversationFlag, exportConversation, handleDeleteConversation,
}){
	const providerOptions = uniqueTextList(conversations.map((item)=>item.providerName || item.providerType).filter(Boolean));
	const modelOptionsList = uniqueTextList(conversations.map((item)=>item.model).filter(Boolean));
	return (
		<div className={styles.paneShell}>
			<div className={styles.paneHeader}>
				<div className={styles.historyTop}>
					<Search
						allowClear
						placeholder="搜索历史对话、案例名、模型"
						style={{ maxWidth: 320 }}
						value={historyKeyword}
						onChange={(e)=>setHistoryKeyword(e.target.value)}
					/>
					<Select value={historyFilter.provider || undefined} allowClear placeholder="接口" style={{ width: 150 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, provider: val || '' }))}>
						{providerOptions.map((item)=><Select.Option key={item} value={item}>{item}</Select.Option>)}
					</Select>
					<Select value={historyFilter.model || undefined} allowClear placeholder="模型" style={{ width: 160 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, model: val || '' }))}>
						{modelOptionsList.map((item)=><Select.Option key={item} value={item}>{item}</Select.Option>)}
					</Select>
					<Select value={historyFilter.sourceType} style={{ width: 130 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, sourceType: val || '' }))}>
						<Select.Option value="">全部案例</Select.Option>
						<Select.Option value="chart">命盘</Select.Option>
						<Select.Option value="case">事盘</Select.Option>
						<Select.Option value="timepoint">起课时间</Select.Option>
						<Select.Option value="__none__">未挂案例</Select.Option>
					</Select>
					<Select value={historyFilter.favorite} style={{ width: 120 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, favorite: val }))}>
						<Select.Option value="all">全部收藏</Select.Option>
						<Select.Option value="favorite">仅收藏</Select.Option>
						<Select.Option value="normal">未收藏</Select.Option>
					</Select>
					<Select value={historyFilter.archived} style={{ width: 120 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, archived: val }))}>
						<Select.Option value="active">未归档</Select.Option>
						<Select.Option value="archived">已归档</Select.Option>
						<Select.Option value="all">全部</Select.Option>
					</Select>
				</div>
				<div className={styles.historyBatchBar}>
					<Space wrap>
						<Button onClick={resetConversationDraft}>新建对话</Button>
						<Button icon={<XQIcon name="export" />} onClick={exportSelectedConversations} disabled={!selectedHistoryIds.length}>批量导出</Button>
						<Button onClick={()=>handleArchiveSelected(true)} disabled={!selectedHistoryIds.length}>批量归档</Button>
						<Button onClick={()=>handleArchiveSelected(false)} disabled={!selectedHistoryIds.length}>取消归档</Button>
						<Button onClick={()=>handleFavoriteSelected(true)} disabled={!selectedHistoryIds.length}>批量收藏</Button>
						<Button onClick={()=>handleFavoriteSelected(false)} disabled={!selectedHistoryIds.length}>取消收藏</Button>
						<Popconfirm title="确定删除所选历史吗？" onConfirm={handleBatchDeleteConversations}>
							<Button danger icon={<XQIcon name="delete" />} disabled={!selectedHistoryIds.length}>批量删除</Button>
						</Popconfirm>
					</Space>
				</div>
			</div>
			<div className={styles.paneBody}>
				<div className={styles.historyTableWrap}>
					{filteredConversations.length === 0 ? (
						<div className={styles.historyEmpty}>
							<XQEmpty description="暂无历史对话" />
						</div>
					) : (
					<Table
						rowKey="id"
						size="small"
						className={styles.historyTable}
						tableLayout="fixed"
						rowSelection={{
							selectedRowKeys: selectedHistoryIds,
							onChange: (keys)=>setSelectedHistoryIds(keys),
							columnWidth: 44,
						}}
						dataSource={filteredConversations}
						scroll={{ y: Math.max(height - 220, 320) }}
						/* pageSize 写死 = 受控值,「条/页」切换器点了永远弹回 15(死控件)。改 defaultPageSize 交给 antd 自管。 */
						pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['10','15','30','50'], size: 'small' }}
						columns={[
							{
								title: '标题',
								dataIndex: 'title',
								ellipsis: { showTitle: true },
								render: (value, record)=>(
									<div className={styles.tableTitleCell}>
										<span className={styles.tableTitleText} title={value || '未命名对话'}>{value || '未命名对话'}</span>
										{record.favorite ? <Tag color="gold">收藏</Tag> : null}
										{record.archived ? <Tag>归档</Tag> : null}
									</div>
								),
							},
							{
								title: '案例',
								width: 180,
								ellipsis: { showTitle: true },
								render: (_, record)=>record.sourceRef && record.sourceRef.title
									? `${record.sourceRef.title}${record.partnerRef && record.partnerRef.title ? ` × ${record.partnerRef.title}` : ''}`   // [双盘挂载]
									: '未绑定',
							},
							{
								title: '接口 / 模型',
								width: 200,
								ellipsis: { showTitle: true },
								render: (_, record)=>record.providerName ? `${record.providerName} / ${record.model || ''}` : (record.model || '未设置'),
							},
							{
								title: '更新时间',
								width: 150,
								render: (_, record)=>buildTimestampLabel(record.updatedAt),
							},
							{
								title: '操作',
								width: 380,
								render: (_, record)=>(
									<Space size={4} wrap>
										<Button size="small" type="primary" onClick={()=>openConversation(record)}>打开</Button>
										<Button size="small" onClick={()=>handleRenameConversation(record)}>重命名</Button>
										<Button size="small" onClick={()=>handleDuplicateConversation(record)}>复制</Button>
										<Tooltip title={record.favorite ? '取消收藏' : '收藏'}><Button size="small" onClick={()=>handleToggleConversationFlag(record, 'favorite')} icon={<XQIcon name="star" />} /></Tooltip>
										<Button size="small" onClick={()=>handleToggleConversationFlag(record, 'archived')}>{record.archived ? '取消归档' : '归档'}</Button>
										<Dropdown
											trigger={['click']}
											menu={{
												items: [
													{ key: 'md', label: 'Markdown' },
													{ key: 'json', label: 'JSON' },
													{ key: 'docx', label: 'Word' },
												],
												onClick: ({ key })=>exportConversation(record, key, { withScreenshot: false }),   // 历史页不附列表截图
											}}
										>
											<Button size="small">导出 ▾</Button>
										</Dropdown>
										<Popconfirm title="确定删除这段历史吗？" onConfirm={()=>handleDeleteConversation(record.id)}>
											<Button size="small" danger icon={<XQIcon name="delete" />} />
										</Popconfirm>
									</Space>
								),
							},
						]}
					/>
					)}
				</div>
			</div>
		</div>
	);
}

export function renderMaterialsPane({
	materialDragCounterRef, setMaterialPaneDragOver, ingestFiles, materialKeyword, setMaterialKeyword,
	materialFolders, selectedFolderId, setSelectedFolderId, materialSort, setMaterialSort, materialView,
	setMaterialView, openMaterialEditor, setFolderDrawerOpen, dedupeMaterials, desktopBridge,
	handleDesktopFilePick, handleDesktopFolderImport, materialIngestQueue, tagGroups, filteredMaterials,
	setReferenceIds, handleMoveMaterial, exportMaterialOriginal, exportMaterialText,
	handleReplaceMaterial, deleteMaterial, materialPaneDragOver,
}){
	// 全 pane 拖拽：用 React ref 计数，避免 dragLeave 误闪。组件内 ref，热重载/多实例下不会乱串。
	const onDragEnter = (e)=>{
		if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
			materialDragCounterRef.current++;
			setMaterialPaneDragOver(true);
		}
	};
	const onDragOver = (e)=>{
		if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
		}
	};
	const onDragLeave = ()=>{
		materialDragCounterRef.current = Math.max(0, materialDragCounterRef.current - 1);
		if(materialDragCounterRef.current === 0){ setMaterialPaneDragOver(false); }
	};
	const onDrop = (e)=>{
		e.preventDefault();
		materialDragCounterRef.current = 0;
		setMaterialPaneDragOver(false);
		const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
		if(files.length){ ingestFiles(files); }
	};
	return (
		<div className={styles.paneShell} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
			<div className={styles.paneHeader}>
				<div className={styles.materialTop}>
					<Search
						allowClear
						placeholder="搜索资料标题、标签、全文"
						style={{ maxWidth: 360 }}
						value={materialKeyword}
						onChange={(e)=>setMaterialKeyword(e.target.value)}
					/>
					{materialFolders.length ? (
						<Select value={selectedFolderId || undefined} placeholder="全部文件夹" style={{ width: 180 }} onChange={(val)=>setSelectedFolderId(val || '')}>
							<Select.Option value="">全部文件夹</Select.Option>
							{materialFolders.map((item)=><Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
						</Select>
					) : null}
					<Select value={materialSort} style={{ width: 150 }} onChange={setMaterialSort}>
						<Select.Option value="updated">按更新时间</Select.Option>
						<Select.Option value="name">按名称</Select.Option>
						<Select.Option value="size">按大小</Select.Option>
					</Select>
					<Select value={materialView} style={{ width: 110 }} onChange={(v)=>{ setMaterialView(v); saveUiPrefs({ materialView: v }); }}>
						<Select.Option value="grid">卡片视图</Select.Option>
						<Select.Option value="list">列表视图</Select.Option>
					</Select>
					<Space wrap>
						<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openMaterialEditor(null)}>新建资料</Button>
						<Upload showUploadList={false} multiple beforeUpload={(file, fileList)=>{ /* 一次性接收整批 */ if(fileList[0] === file){ ingestFiles(fileList); } return false; }} accept={MATERIAL_ACCEPT_ATTR}>
							<Button icon={<XQIcon name="import" />}>选文件上传</Button>
						</Upload>
						<Button icon={<XQIcon name="folder" />} onClick={()=>setFolderDrawerOpen(true)}>管理文件夹</Button>
						<Button icon={<XQIcon name="sync" />} onClick={dedupeMaterials}>去重</Button>
						{desktopBridge ? <Button onClick={handleDesktopFilePick}>桌面选文件</Button> : null}
						{desktopBridge ? <Button onClick={handleDesktopFolderImport}>导入目录</Button> : null}
					</Space>
				</div>
				<div className={styles.materialHint}>
					<XQIcon name="folder" /> 把文件直接拖到本面即上传（也可点「选文件上传」）。支持 TXT / Markdown / DOC / DOCX / PDF。
				</div>
				{materialIngestQueue.length ? (
					<div className={styles.materialIngestBar}>
						{materialIngestQueue.map((q)=>(
							<Tag key={q.id} color={q.status === 'done' ? (q.truncated ? 'orange' : 'green') : q.status === 'error' ? 'red' : q.status === 'skip' ? 'default' : 'blue'}>
								{q.name} · {q.status === 'parsing' ? '解析中…' : q.status === 'importing' ? '导入中…' : q.status === 'done' ? (q.truncated ? `完成(${q.truncated})` : '完成') : q.status === 'skip' ? `已跳过${q.err ? '：' + q.err : ''}` : `失败${q.err ? '：' + q.err : ''}`}
							</Tag>
						))}
					</div>
				) : null}
			</div>
			<div className={styles.paneBody}>
				<div className={styles.materialScroll}>
					{tagGroups.length ? (
						<Card size="small" bordered={false} className={styles.tagGroupCard} title="标签组">
							<Space wrap>
								{tagGroups.map((group)=>(
									<Tag key={group.id}>{group.name}：{(group.tags || []).join('、') || '空'}</Tag>
								))}
							</Space>
						</Card>
					) : null}
					{filteredMaterials.length === 0 ? (
						<div className={styles.materialEmpty}>
							<XQEmpty description="暂无资料" />
						</div>
					) : materialView === 'list' ? (
						<Table
							rowKey="id"
							size="small"
							tableLayout="fixed"
							dataSource={filteredMaterials}
							/* 同上:写死 pageSize 让「条/页」切换器变死控件 */
							pagination={{ defaultPageSize: 20, size: 'small', showSizeChanger: true, pageSizeOptions: ['10','20','50','100'] }}
							columns={[
								{ title: '名称', dataIndex: 'name', ellipsis: { showTitle: true }, render: (v)=>v || '未命名' },
								{ title: '类型', width: 90, render: (_, it)=>it.kind || 'note' },
								{ title: '文件夹', width: 140, ellipsis: true, render: (_, it)=>(it.folderId ? (materialFolders.find((folder)=>folder.id === it.folderId)?.name || '未知') : '未分类') },
								{ title: '标签', width: 160, ellipsis: true, render: (_, it)=>(it.tags || []).join('、') || '无' },
								{ title: '流派', width: 160, render: (_, it)=>(it.schools || []).length ? (it.schools || []).map((s, i)=>(<Tag key={i} color="cyan" style={{marginBottom:2}}>{s}</Tag>)) : <span style={{color:'var(--horosa-text-secondary)'}}>通用</span> },
								{ title: '更新时间', width: 150, render: (_, it)=>buildTimestampLabel(it.updatedAt) },
								{ title: '操作', width: 380, render: (_, it)=>(
									<Space size={4} wrap>
										<Button size="small" onClick={()=>openMaterialEditor(it)} icon={<XQIcon name="edit" />} />
										<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`material:${it.id}`)))}>加参考</Button>
										<Dropdown trigger={['click']} menu={{
											items: [
												{ key: '', label: '未分类' },
												...materialFolders.map((f)=>({ key: f.id, label: f.name })),
											],
											onClick: ({ key })=>handleMoveMaterial(it, key),
										}}>
											<Button size="small">移动 ▾</Button>
										</Dropdown>
										<Dropdown trigger={['click']} menu={{
											items: [
												{ key: 'orig', label: '原文件' },
												{ key: 'text', label: '提取文本' },
											],
											onClick: ({ key })=>{ if(key === 'orig') exportMaterialOriginal(it); else exportMaterialText(it); },
										}}>
											<Button size="small">导出 ▾</Button>
										</Dropdown>
										<Upload showUploadList={false} accept={MATERIAL_ACCEPT_ATTR} beforeUpload={(file)=>handleReplaceMaterial(it, file)}>
											<Button size="small">替换</Button>
										</Upload>
										<Popconfirm title="确定删除这份资料吗？" onConfirm={()=>deleteMaterial(it.id)}>
											<Button size="small" danger icon={<XQIcon name="delete" />} />
										</Popconfirm>
									</Space>
								) },
							]}
						/>
					) : (
						<div className={styles.materialGrid}>
							{filteredMaterials.map((item)=>(
							<Card key={item.id} size="small" title={item.name} bordered={false}>
								<div className={styles.cardMeta}>
									<div>类型：{item.kind || 'note'}</div>
									<div>文件夹：{item.folderId ? (materialFolders.find((folder)=>folder.id === item.folderId)?.name || '未知') : '未分类'}</div>
									<div>标签：{(item.tags || []).length ? (item.tags || []).join('、') : '无'}</div>
									<div>流派：{(item.schools || []).length ? (item.schools || []).map((s, i)=>(<Tag key={i} color="cyan" style={{marginRight:4}}>{s}</Tag>)) : '通用'}</div>
									<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
									{/* 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
									{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
								</div>
								<div className={styles.summaryBlock}>
									{(item.extractedText || '').slice(0, 300)}
									{(item.extractedText || '').length > 300 ? '...' : ''}
								</div>
								<div className={styles.cardActions}>
									<Button size="small" onClick={()=>openMaterialEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
									<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`material:${item.id}`)))}>加入参考</Button>
									<Dropdown trigger={['click']} menu={{
										items: [
											{ key: '', label: '未分类' },
											...materialFolders.map((f)=>({ key: f.id, label: f.name })),
										],
										onClick: ({ key })=>handleMoveMaterial(item, key),
									}}>
										<Button size="small">移动到 ▾</Button>
									</Dropdown>
									<Button size="small" icon={<XQIcon name="download" />} onClick={()=>exportMaterialOriginal(item)}>原文件</Button>
									<Button size="small" onClick={()=>exportMaterialText(item)}>提取文本</Button>
									<Upload showUploadList={false} accept={MATERIAL_ACCEPT_ATTR} beforeUpload={(file)=>handleReplaceMaterial(item, file)}>
										<Button size="small">替换文件</Button>
									</Upload>
									<Popconfirm title="确定删除这份资料吗？" onConfirm={()=>deleteMaterial(item.id)}>
										<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
									</Popconfirm>
								</div>
							</Card>
							))}
						</div>
					)}
				</div>
			</div>
		{materialPaneDragOver ? (
			<div className={styles.materialDropOverlay}>
				<div className={styles.materialDropOverlayInner}>
					<div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
					<div style={{ fontSize: 16, fontWeight: 600 }}>放下即上传</div>
					<div className={styles.materialDropOverlayHint}>支持 TXT / Markdown / DOC / DOCX / PDF</div>
				</div>
			</div>
		) : null}
		</div>
	);
}

export function renderTemplatesPane({
	templateKeyword, setTemplateKeyword, openTemplateEditor, openBundleEditor, filteredTemplates,
	templateVersions, setPreviewTemplate, setPreviewDrawerOpen, setVersionDiffState, deleteTemplate,
	rollbackTemplateVersion, applyBundle, setBundlePreview, setReferenceIds, deleteBundle,
}){
	return (
		<div className={styles.paneShell}>
			<div className={styles.paneHeader}>
				<div className={styles.templateTop}>
					<Search
						allowClear
						placeholder="搜索模版与组合"
						style={{ maxWidth: 360 }}
						value={templateKeyword}
						onChange={(e)=>setTemplateKeyword(e.target.value)}
					/>
					<Space>
						<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openTemplateEditor(null)}>新建模版</Button>
						<Button icon={<XQIcon name="plus" />} onClick={()=>openBundleEditor(null)}>新建组合</Button>
					</Space>
				</div>
			</div>
			<div className={styles.paneBody}>
				<div className={styles.paneScroll}>
					<div className={filteredTemplates.length === 0 ? styles.materialEmpty : styles.templateGrid}>
						{filteredTemplates.length === 0 ? <XQEmpty description="暂无模版或组合" /> : filteredTemplates.map((item)=>(
					<Card
						key={`${item.cardType}-${item.id}`}
						size="small"
						title={`${item.cardType === 'template' ? '模版' : '组合'} · ${item.name}`}
						bordered={false}
					>
						{item.cardType === 'template' ? (
							<>
								<div className={styles.cardMeta}>
									<div>格式：{item.format || 'text'}</div>
									<div>版本数：{templateVersions.filter((one)=>one.templateId === item.id).length}</div>
									<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
									{/* 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
									{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
								</div>
								<div className={styles.summaryBlock}>
									{(item.instructionText || item.jsonSchema || item.content || '').slice(0, 260)}
									{(item.instructionText || item.jsonSchema || item.content || '').length > 260 ? '...' : ''}
								</div>
								<div className={styles.cardActions}>
									<Button size="small" onClick={()=>openTemplateEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
									<Button size="small" onClick={()=>{
										setPreviewTemplate(item);
										setPreviewDrawerOpen(true);
									}}>预览</Button>
									{templateVersions.filter((v)=>v.templateId === item.id).length >= 2 ? (
										<Button size="small" onClick={()=>{
											const vs = templateVersions.filter((v)=>v.templateId === item.id).sort((a,b)=>(b.versionNumber||0)-(a.versionNumber||0));
											setVersionDiffState({ template: item, leftId: vs[1].id, rightId: vs[0].id });
										}}>版本对比</Button>
									) : null}
									<Popconfirm title="确定删除这个模版吗？" onConfirm={()=>deleteTemplate(item.id)}>
										<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
									</Popconfirm>
								</div>
								<div className={styles.versionList}>
									{/* 标出「当前版」并显示回滚留痕;当前版没有「回滚」按钮(回滚到自己没有意义) */}
									{templateVersions.filter((one)=>one.templateId === item.id).slice(0, 5).map((version)=>(
										<div key={version.id} className={styles.versionItem}>
											<span>V{version.versionNumber}{item.activeVersionId === version.id ? <Tag color="blue" style={{ marginLeft: 6 }}>当前版</Tag> : null}</span>
											<Text type="secondary">{buildTimestampLabel(version.updatedAt)}{version.note ? ` · ${version.note}` : ''}</Text>
											{item.activeVersionId === version.id ? null : <Button size="small" type="link" onClick={()=>rollbackTemplateVersion(item, version)}>回滚</Button>}
										</div>
									))}
								</div>
							</>
						) : (
							<>
								<div className={styles.cardMeta}>
									<div>绑定资料：{Array.isArray(item.defaultMaterialIds) ? item.defaultMaterialIds.length : 0} 份</div>
									<div>默认模型：{item.defaultModel || '未设置'}</div>
									<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
									{/* 标技能身份:带 skill 字段的组合同时是 AI 助手的技能包(触发词 / 版本) */}
									{(()=>{ const sk = normalizeSkillPack(item); return sk ? <div><Tag color="purple">技能包 · /{sk.triggers[0] || '?'} · v{sk.version}</Tag></div> : null; })()}
									{/* 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
									{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
								</div>
								<div className={styles.summaryBlock}>
									{item.defaultSystemPrompt || '未设置默认系统提示'}
								</div>
								<div className={styles.cardActions}>
									<Button size="small" onClick={()=>openBundleEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
									<Button size="small" onClick={()=>applyBundle(item)}>一键应用</Button>
									<Button size="small" onClick={()=>setBundlePreview(item)}>预览</Button>
									<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`bundle:${item.id}`)))}>加入参考</Button>
									<Popconfirm title="确定删除这个组合吗？" onConfirm={()=>deleteBundle(item.id)}>
										<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
									</Popconfirm>
								</div>
							</>
						)}
					</Card>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}


// 「进阶」页:高级能力总控。两个插座字面从设置页整体移来——设置页只剩接口配置与备份。
export function renderAdvancedPane({ chatAssist }){
	return (
		<div className={styles.paneShell}>
			<div className={styles.paneBody}>
				<div className={styles.paneScroll}>
					<AdvancedPane personaInjecting={chatAssist.personaInjecting}>
						{chatAssist.settingsPanels}
						<AgentAbilityPanel />
					</AdvancedPane>
				</div>
			</div>
		</div>
	);
}

export function renderSettingsPane({
	providerProfiles, settingKeyword, setSettingKeyword, openProviderEditor, providerListDense,
	setProviderListDense, handleExportWorkspaceBackup, handleRestoreWorkspaceBackup,
	handleClearContextCache, setInnerTab, filteredProfiles, fetchModelsAndEmbeddings, testProfileChat,
	runProviderDiagnostics, deleteProvider,
}){
	const healthSummary = providerProfiles.reduce((acc, item)=>{
		const key = item.healthStatus === 'healthy' ? 'healthy' : item.healthStatus === 'error' ? 'error' : 'unknown';
		acc[key] += 1;
		return acc;
	}, { healthy: 0, error: 0, unknown: 0 });
	return (
		<div className={styles.paneShell}>
			<div className={styles.paneHeader}>
				<div className={styles.settingsTop}>
					<Search
						allowClear
						placeholder="搜索接口、模型、Base URL"
						style={{ maxWidth: 360 }}
						value={settingKeyword}
						onChange={(e)=>setSettingKeyword(e.target.value)}
					/>
					<Space>
						<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openProviderEditor(null)}>新增接口配置</Button>
						<Select size="middle" value={providerListDense ? 'dense' : 'card'} style={{ width: 110 }} onChange={(v)=>{ const d = v === 'dense'; setProviderListDense(d); saveUiPrefs({ providerListDense: d }); }}>
							<Select.Option value="card">卡片视图</Select.Option>
							<Select.Option value="dense">紧凑列表</Select.Option>
						</Select>
						<Button icon={<XQIcon name="export" />} onClick={handleExportWorkspaceBackup}>导出备份</Button>
						<Button icon={<XQIcon name="import" />} onClick={handleRestoreWorkspaceBackup}>恢复备份</Button>
						<Tooltip title="清空挂载上下文的派生缓存(不影响命盘/事盘存档与对话);下次挂载按当前存档重建。">
							<Button icon={<XQIcon name="delete" />} onClick={handleClearContextCache}>清理上下文缓存</Button>
						</Tooltip>
					</Space>
				</div>
				<div className={styles.summaryBlock}>
					健康概览：健康 {healthSummary.healthy} / 异常 {healthSummary.error} / 未检测 {healthSummary.unknown}
					<span style={{ marginLeft: 12, color: 'var(--horosa-text-soft)' }}>上下文策略 · 模型路由 · 口径与记忆 · 技能包 · 行动能力 已移到</span>
					<Button type="link" size="small" style={{ padding: '0 4px' }} onClick={()=>setInnerTab('advanced')}>「进阶」页</Button>
				</div>
			</div>
			<div className={styles.paneBody}>
				<div className={styles.paneScroll}>
					{providerListDense ? (
						<Table
							rowKey="id"
							size="small"
							tableLayout="fixed"
							className={styles.providerDenseTable}
							dataSource={filteredProfiles}
							pagination={false}
							columns={[
								{ title: '配置名称', dataIndex: 'name', ellipsis: true, render: (v)=>v || '未命名配置' },
								{ title: '类型', width: 110, render: (_, it)=>getProviderDisplayName(it.providerType) },
								{ title: 'Base URL', width: 220, ellipsis: { showTitle: true }, render: (_, it)=>it.baseUrl || '默认' },
								{ title: '模型数', width: 80, render: (_, it)=>normalizeProfileChatModels(it).length },
								{ title: '状态', width: 100, render: (_, it)=><Tag color={it.healthStatus === 'healthy' ? 'green' : it.healthStatus === 'error' ? 'red' : 'default'}>{providerHealthLabel(it.healthStatus)}</Tag> },
								{ title: '操作', width: 280, render: (_, it)=>(
									<Space size={4} wrap>
										<Button size="small" type="link" onClick={()=>openProviderEditor(it)}>编辑</Button>
										<Button size="small" type="link" onClick={()=>fetchModelsAndEmbeddings(it)}>拉模型</Button>
										<Button size="small" type="link" onClick={()=>testProfileChat(it)}>测试</Button>
										<Button size="small" type="link" onClick={()=>runProviderDiagnostics(it)}>诊断</Button>
										<Popconfirm title="确定删除这条接口配置吗？" onConfirm={()=>deleteProvider(it.id)}>
											<Button size="small" type="link" danger>删除</Button>
										</Popconfirm>
									</Space>
								) },
							]}
						/>
					) : (
					<div className={filteredProfiles.length === 0 ? styles.materialEmpty : styles.settingsGrid}>
						{filteredProfiles.length === 0 ? <XQEmpty description="暂无接口配置" /> : filteredProfiles.map((item)=>(
					<Card key={item.id} size="small" title={item.name || '未命名配置'} bordered={false}>
						<div className={styles.cardMeta}>
							{item.apiKeyDecryptFailed || item.extraHeadersDecryptFailed ? (
								<div><Tag color="orange">{[item.apiKeyDecryptFailed ? 'API Key' : '', item.extraHeadersDecryptFailed ? '鉴权请求头令牌' : ''].filter(Boolean).join('与')}无法解密,请重填(未重填前原密文保留)</Tag></div>
							) : null}
							<div>类型：{getProviderDisplayName(item.providerType)}</div>
							<div>协议族：{item.protocolFamily || getProviderProtocolFamily(item.providerType)}</div>
							<div>Base URL：{item.baseUrl || '默认'}</div>
							<div>聊天模型：{normalizeProfileChatModels(item).length ? normalizeProfileChatModels(item).join('、') : '未配置'}</div>
							<div>Embedding：{normalizeEmbeddingModels(item).length ? normalizeEmbeddingModels(item).join('、') : '未配置'}</div>
							<div>健康状态：<Tag color={item.healthStatus === 'healthy' ? 'green' : item.healthStatus === 'error' ? 'red' : 'default'}>{providerHealthLabel(item.healthStatus)}</Tag></div>{ }
						</div>
						{item.lastDiagnostics ? (
							<div className={styles.summaryBlock}>
								<div>DNS：{item.lastDiagnostics.dns && item.lastDiagnostics.dns.ok ? `OK / ${item.lastDiagnostics.dns.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.dns && item.lastDiagnostics.dns.message ? item.lastDiagnostics.dns.message : ''}`}</div>
								<div>TCP：{item.lastDiagnostics.tcp && item.lastDiagnostics.tcp.ok ? `OK / ${item.lastDiagnostics.tcp.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.tcp && item.lastDiagnostics.tcp.message ? item.lastDiagnostics.tcp.message : ''}`}</div>
								<div>HTTP：{item.lastDiagnostics.http && item.lastDiagnostics.http.ok ? `OK / ${item.lastDiagnostics.http.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.http && item.lastDiagnostics.http.message ? item.lastDiagnostics.http.message : ''}`}</div>
								<div>失败分类：{item.lastDiagnostics.failureReason || '无'}</div>
								<div>建议：{item.lastDiagnostics.recommendation || '无'}</div>
								<div>错误详情：{item.lastDiagnostics.errorDetail || '无'}</div>
							</div>
						) : null}
						<div className={styles.cardActions}>
							<Button size="small" onClick={()=>openProviderEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
							<Button size="small" onClick={()=>fetchModelsAndEmbeddings(item)} icon={<XQIcon name="refresh" />}>拉取模型</Button>
							<Button size="small" onClick={()=>testProfileChat(item)}>测试连接</Button>
							<Button size="small" onClick={()=>runProviderDiagnostics(item)} icon={<XQIcon name="search" />}>连通性诊断</Button>
							<Popconfirm title="确定删除这条接口配置吗？" onConfirm={()=>deleteProvider(item.id)}>
								<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
							</Popconfirm>
						</div>
					</Card>
						))}
					</div>
					)}
				</div>
			</div>
		</div>
	);
}
