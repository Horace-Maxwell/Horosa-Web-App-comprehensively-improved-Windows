// AI 分析页 · 弹窗与抽屉:资料 / 模版 / 组合编辑、组合预览、文件夹管理、生效接口切换、接口配置、模版预览
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Input as AntdInput } from 'antd';
import { Collapse, Form, Space, Tag, Tooltip, Typography } from 'antd';
import styles from '../AIAnalysisMain.less';
import MonacoEditor, { JSON_TEXT_RULE } from '../MonacoField';
import { normalizeSkillPack } from '../../../utils/aiChat/skills';
import XQIcon from '../../xq-icons';
import { XQButton as Button, XQDrawer as Drawer, XQInput as Input, XQModal as Modal, XQSelect as Select, XQSwitch as Switch, XQEmpty, XQInputNumber } from '../../xq-ui';
import { listAnalysisTechniqueOptions, listAllAnalysisTechniqueOptions } from '../../../utils/aiAnalysisContext';
import { PROVIDER_OPTIONS, getProviderDisplayName, getProviderProtocolFamily, THINKING_LEVELS } from '../../../utils/aiAnalysisProviders';
import { RETRIEVAL_OPTIONS, retrievalModeLabel, thinkingLevelLabel, normalizeProfileModels } from './providerForm';
import { configureMonaco } from './templates';
import { pressable } from '../../../utils/pressable';
const { TextArea } = Input;
const { Title, Text } = Typography;

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderMaterialModal = ({
	editingMaterial, materialModalOpen, saveMaterialForm, setMaterialModalOpen, setEditingMaterial,
	materialForm, materialFolders,
})=>(
	<Modal
		title={editingMaterial ? '编辑资料' : '新建资料'}
		open={materialModalOpen}
		onOk={saveMaterialForm}
		onCancel={()=>{
			setMaterialModalOpen(false);
			setEditingMaterial(null);
		}}
	>
		<Form form={materialForm} layout="vertical">
			<Form.Item name="name" label="资料名称" rules={[{ required: true, message: '请输入资料名称' }]}>
				<Input />
			</Form.Item>
			{materialFolders.length ? (
				<Form.Item name="folderId" label="文件夹">
					<Select allowClear placeholder="不设文件夹">
						{materialFolders.map((item)=><Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
					</Select>
				</Form.Item>
			) : null}
			<Form.Item name="tags" label="标签">
				<Input placeholder="支持逗号分隔" />
			</Form.Item>
			<Form.Item name="schools" label="流派" extra="可多选/自由输入；用于按流派过滤资料并注入流派提示。">
				<Select
					mode="tags"
					placeholder="如 子平派 / 盲派 / 北派飞星 等（不填 = 视为通用资料）"
					style={{ width: '100%' }}
					options={[
						{ value: '子平派', label: '子平派' },
						{ value: '盲派', label: '盲派' },
						{ value: '新派（段建业）', label: '新派（段建业）' },
						{ value: '滴天髓派', label: '滴天髓派' },
						{ value: '神峰通考派', label: '神峰通考派' },
						{ value: '北派飞星', label: '北派飞星' },
						{ value: '中州派', label: '中州派' },
						{ value: '三合派', label: '三合派' },
						{ value: '钦天四化派', label: '钦天四化派' },
					]}
				/>
			</Form.Item>
			<Form.Item name="extractedText" label="资料内容" rules={[{ required: true, message: '请输入资料内容' }]}>
				<TextArea rows={10} />
			</Form.Item>
		</Form>
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderTemplateModal = ({
	editingTemplate, templateModalOpen, saveTemplateForm, setTemplateModalOpen, setEditingTemplate,
	templateForm,
})=>(
	<Modal
		title={editingTemplate ? '编辑模版' : '新建模版'}
		open={templateModalOpen}
		width={960}
		onOk={saveTemplateForm}
		onCancel={()=>{
			setTemplateModalOpen(false);
			setEditingTemplate(null);
		}}
	>
		<Form form={templateForm} layout="vertical">
			<Form.Item name="name" label="模版名称" rules={[{ required: true, message: '请输入模版名称' }]}>
				<Input />
			</Form.Item>
			<Form.Item name="format" label="模版格式" rules={[{ required: true, message: '请选择模版格式' }]}>
				<Select>
					<Select.Option value="text">文字</Select.Option>
					<Select.Option value="json">JSON</Select.Option>
				</Select>
			</Form.Item>
			<Form.Item shouldUpdate noStyle>
				{({ getFieldValue })=>{
					const format = getFieldValue('format');
					const body = `${getFieldValue('instructionText') || ''}\n${getFieldValue('jsonSchema') || ''}\n${getFieldValue('exampleInput') || ''}\n${getFieldValue('exampleOutput') || ''}`;
					const KNOWN_VARS = ['user_prompt', 'source_context', 'retrieved_context', 'conversation_history', 'system_prompt'];
					const usedVars = Array.from(new Set((body.match(/\{\{\s*([\w.]+)\s*\}\}/g) || []).map((m)=>m.replace(/[\{\}\s]/g, ''))));
					const unknownVars = usedVars.filter((v)=>KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0);
					let schemaErr = null;
					if(format === 'json'){
						const raw = `${getFieldValue('jsonSchema') || ''}`.trim();
						if(raw){
							try{ JSON.parse(raw); }catch(e){ schemaErr = e && e.message ? e.message : '无法解析 JSON Schema'; }
						}
					}
					return (
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16 }}>
							<div>
								{format === 'json' ? (
									<>
										<Form.Item name="instructionText" label="说明文字">
											<TextArea rows={3} placeholder="可选，用于说明模型应该如何输出 JSON" />
										</Form.Item>
										<Form.Item name="jsonSchema" label="JSON Schema" rules={[JSON_TEXT_RULE, { required: true, message: '请输入 JSON Schema' }]}>
											<MonacoEditor height="240px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
										<Form.Item name="exampleInput" label="示例输入" rules={[JSON_TEXT_RULE]}>
											<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
										<Form.Item name="exampleOutput" label="示例输出" rules={[JSON_TEXT_RULE]}>
											<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
									</>
								) : (
									<>
										<Form.Item name="instructionText" label="模版内容" rules={[{ required: true, message: '请输入模版内容' }]}>
											<TextArea rows={10} placeholder="支持 {{user_prompt}} / {{source_context}} / {{retrieved_context}} / {{conversation_history}} / {{system_prompt}}" />
										</Form.Item>
										<Form.Item name="exampleInput" label="示例输入" rules={[JSON_TEXT_RULE]}>
											<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
										<Form.Item name="exampleOutput" label="示例输出">
											<TextArea rows={6} />
										</Form.Item>
									</>
								)}
							</div>
							<div>
								<div style={{ fontSize: 12, color: 'var(--horosa-text-soft)', marginBottom: 6 }}>变量推断（已用 {usedVars.length} 个）</div>
								<div className={styles.templateVarSidebar}>
									{usedVars.length === 0 ? (
										<div style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>未检测到 {`{{变量}}`}。常用：<br />user_prompt · source_context · retrieved_context · conversation_history · system_prompt</div>
									) : usedVars.map((v)=>(
										<div key={v} className={styles.templateVarItem + ' ' + (KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0 ? styles.templateVarItemMissing : '')}>
											<span>{'{{'}{v}{'}}'}</span>
											{KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0 ? <Tooltip title="不在已知变量列表中——发送时可能解析不到"><span style={{ fontSize: 10 }}>?</span></Tooltip> : null}
										</div>
									))}
									{unknownVars.length ? <div style={{ marginTop: 8, fontSize: 11, color: 'var(--horosa-warn, #faad14)' }}>未知变量：{unknownVars.join(', ')}</div> : null}
								</div>
								{format === 'json' ? (
									<>
										<div style={{ marginTop: 12, fontSize: 12, color: 'var(--horosa-text-soft)' }}>JSON Schema 校验</div>
										<div className={styles.templateVarSidebar} style={{ marginTop: 6 }}>
											{schemaErr ? (
												<div style={{ color: 'var(--horosa-danger, #ff4d4f)' }}>❌ {schemaErr}</div>
											) : (
												<div style={{ color: 'var(--horosa-jx-ji, #52c41a)' }}>✓ Schema 解析通过</div>
											)}
										</div>
									</>
								) : null}
							</div>
						</div>
					);
				}}
			</Form.Item>
		</Form>
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderBundlePreviewModal = ({ bundlePreview, setBundlePreview, applyBundle, activeSource, materials })=>(
	<Modal
		title={bundlePreview ? `组合预览 · ${bundlePreview.name}` : ''}
		open={!!bundlePreview}
		width={560}
		footer={(
			<Space>
				<Button onClick={()=>setBundlePreview(null)}>关闭</Button>
				<Button type="primary" onClick={()=>{ applyBundle(bundlePreview); setBundlePreview(null); }}>立即应用</Button>
			</Space>
		)}
		onCancel={()=>setBundlePreview(null)}
	>
		{bundlePreview ? (()=>{
			const b = bundlePreview;
			const techs = Array.isArray(b.defaultTechniqueKeys) ? b.defaultTechniqueKeys : [];
			const mats = Array.isArray(b.defaultMaterialIds) && b.defaultMaterialIds.length ? b.defaultMaterialIds : (Array.isArray(b.materialIds) ? b.materialIds : []);
			const allowed = activeSource ? new Set(listAnalysisTechniqueOptions(activeSource).map((it)=>it.value)) : null;
			const fitTechs = allowed ? techs.filter((k)=>allowed.has(k)) : techs;
			const skipTechs = allowed ? techs.filter((k)=>!allowed.has(k)) : [];
			const matNames = mats.map((id)=>{
				const m = materials.find((x)=>x.id === id);
				return m ? m.name : `(已删除资料 ${id.slice(0,6)})`;
			});
			const techLabel = (k)=>(listAllAnalysisTechniqueOptions().find((it)=>it.value === k) || {}).label || k;
			return (
				<div>
					<p style={{ color: 'var(--horosa-text-soft)' }}>套用此组合后，将自动设置以下配置：</p>
					<ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
						<li><b>系统提示：</b>{b.defaultSystemPrompt ? <span>已设置（{(b.defaultSystemPrompt || '').slice(0, 50)}…）</span> : '不覆盖'}</li>
						<li><b>默认模型：</b>{b.defaultModel ? `${b.defaultProviderProfileId ? '指定接口·' : ''}${b.defaultModel}` : '不覆盖'}</li>
						<li><b>默认温度：</b>{b.defaultChatTemperature != null ? b.defaultChatTemperature : '不覆盖'}</li>
						<li><b>默认 top_p：</b>{b.defaultChatTopP != null ? b.defaultChatTopP : '不覆盖'}</li>
						{/* 显示中文标签,不再漏内部代码 */}
						<li><b>默认思考档：</b>{b.defaultThinkingLevel ? thinkingLevelLabel(b.defaultThinkingLevel) : '不覆盖'}</li>
						<li><b>默认检索策略：</b>{retrievalModeLabel(b.defaultRetrievalMode)}</li>
						<li><b>挂载资料 ({matNames.length})：</b>{matNames.length ? matNames.join('、') : '无'}</li>
						<li><b>挂载技法 ({techs.length})：</b>
							{techs.length === 0 ? '无' : (
								<div>
									<div style={{ marginTop: 4 }}>{fitTechs.length ? <span>当前案例可挂载 {fitTechs.length} 项：{fitTechs.map(techLabel).join('、')}</span> : <span style={{ color: 'var(--horosa-text-soft)' }}>当前案例下无可挂载（待你选定支持此组的案例）</span>}</div>
									{skipTechs.length ? <div style={{ marginTop: 4, color: 'var(--horosa-text-soft)' }}>跳过 {skipTechs.length} 项（不适用当前案例类型）：{skipTechs.map(techLabel).join('、')}</div> : null}
								</div>
							)}
						</li>
					</ul>
					<p style={{ marginTop: 12, color: 'var(--horosa-text-soft)', fontSize: 12 }}>
						{activeSource ? '已选案例：' + activeSource.title : '尚未选定案例——选定后会按交集自动挂载支持的技法。'}
					</p>
				</div>
			);
		})() : null}
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderFolderDrawer = ({
	folderDrawerOpen, setFolderDrawerOpen, folderDraftName, setFolderDraftName, handleCreateFolder,
	materialFolders, materials, handleRenameFolder, handleDeleteFolder,
})=>(
	<Drawer
		title="管理文件夹"
		open={folderDrawerOpen}
		onClose={()=>setFolderDrawerOpen(false)}
		width={420}
	>
		<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
			<Input value={folderDraftName} placeholder="新文件夹名称" onChange={(e)=>setFolderDraftName(e.target.value)} onPressEnter={handleCreateFolder} style={{ flex: 1 }} />
			<Button type="primary" onClick={handleCreateFolder} icon={<XQIcon name="plus" />}>新建</Button>
		</div>
		{materialFolders.length === 0 ? (
			<XQEmpty description="还没有文件夹" />
		) : (
			<div>
				{materialFolders.map((folder)=>{
					const cnt = materials.filter((m)=>m.folderId === folder.id).length;
					return (
						<div key={folder.id} className={styles.folderRow}>
							<XQIcon name="folder" />
							<span className={styles.folderRowName}>{folder.name}</span>
							<span style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>{cnt} 份</span>
							<Button size="small" type="link" onClick={()=>handleRenameFolder(folder)}>重命名</Button>
							<Button size="small" type="link" danger onClick={()=>handleDeleteFolder(folder)}>删除</Button>
						</div>
					);
				})}
			</div>
		)}
		<div style={{ marginTop: 14, fontSize: 12, color: 'var(--horosa-text-soft)' }}>
			资料的「移动到…」请在资料列表/卡片操作里点选。
		</div>
	</Drawer>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderBundleModal = ({
	editingBundle, bundleModalOpen, saveBundleForm, setBundleModalOpen, setEditingBundle, bundleForm,
	templates, materials, modelOptions,
})=>(
	<Modal
		title={editingBundle ? (normalizeSkillPack(editingBundle) ? '编辑组合（技能包）' : '编辑组合') : '新建组合'}
		open={bundleModalOpen}
		width={720}
		onOk={saveBundleForm}
		onCancel={()=>{
			setBundleModalOpen(false);
			setEditingBundle(null);
		}}
	>
		<Form form={bundleForm} layout="vertical">
			<Form.Item name="name" label="组合名称" rules={[{ required: true, message: '请输入组合名称' }]}>
				<Input />
			</Form.Item>
			<Form.Item name="templateId" label="绑定模版">
				<Select allowClear placeholder="可选">
					{templates.map((item)=>(
						<Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>
					))}
				</Select>
			</Form.Item>
			<Form.Item name="materialIds" label="默认资料">
				<Select mode="multiple" allowClear placeholder="可多选">
					{materials.map((item)=>(
						<Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>
					))}
				</Select>
			</Form.Item>
			<Form.Item name="defaultModelSelection" label="默认模型">
				<Select allowClear placeholder="可选">
					{modelOptions.map((item)=>(
						<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
					))}
				</Select>
			</Form.Item>
			<Form.Item name="defaultEmbeddingModel" label="默认 Embedding 模型">
				<Input placeholder="可留空" />
			</Form.Item>
			<Form.Item name="defaultSystemPrompt" label="默认系统提示词">
				<TextArea rows={5} />
			</Form.Item>
			<Form.Item name="defaultRetrievalMode" label="默认检索策略">
				<Select>
					{RETRIEVAL_OPTIONS.map((item)=><Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
				</Select>
			</Form.Item>
			<Form.Item name="defaultTechniqueKeys" label="默认挂载技法（套用后按所选案例自动挂载）"
				extra={(()=>{ const sk = normalizeSkillPack(editingBundle); return sk ? `此组合是技能包（/${sk.triggers[0] || '?'} · v${sk.version}）：保存时这里的技法同步写入技能（技能升版并留档）；触发词 / 模板等技能字段在 AI 助手「技能包」卡编辑。` : undefined; })()}
			>
				<Select mode="multiple" allowClear showSearch optionFilterProp="children" placeholder="可多选：套用组合并选定案例后自动挂载">
					{listAllAnalysisTechniqueOptions().map((item)=>(
						<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
					))}
				</Select>
			</Form.Item>
			<Form.Item label="默认生成参数（留空＝沿用当前设置、不覆盖）">
				<Space size={12} wrap>
					<span>温度</span>
					<Form.Item name="defaultChatTemperature" noStyle><XQInputNumber min={0} max={2} step={0.1} placeholder="不覆盖" style={{ width: 110 }} /></Form.Item>
					<span>top_p</span>
					<Form.Item name="defaultChatTopP" noStyle><XQInputNumber min={0} max={1} step={0.05} placeholder="不覆盖" style={{ width: 110 }} /></Form.Item>
					<span>思考档</span>
					<Form.Item name="defaultThinkingLevel" noStyle><Select allowClear placeholder="不覆盖" style={{ width: 130 }}>{THINKING_LEVELS.map((t)=><Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}</Select></Form.Item>
				</Space>
			</Form.Item>
		</Form>
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderProviderSwitchModal = ({
	providerSwitchModalOpen, setProviderSwitchModalOpen, providerProfiles, activeProviderProfile,
	setProviderAsCurrent, openProviderEditor,
})=>(
	<Modal
		title="生效 API"
		open={providerSwitchModalOpen}
		width={720}
		footer={null}
		bodyStyle={{ maxHeight: 'calc(100 * var(--horosa-lvh, 1vh) - 220px)', overflowY: 'auto' }}
		onCancel={()=>setProviderSwitchModalOpen(false)}
	>
		{providerProfiles.length ? (
			<div className={styles.providerSwitchList}>
				{providerProfiles.map((profile)=>{
					const models = normalizeProfileModels(profile);
					const isCurrent = activeProviderProfile && activeProviderProfile.id === profile.id;
					const displayName = profile.name || getProviderDisplayName(profile.providerType);
					return (
						<div
							key={profile.id}
							role="button"
							title={isCurrent ? '当前使用中' : (profile.enabled === false ? '该接口未启用,先在「编辑」里打开「启用」' : '点击设为当前')}
							style={{ cursor: (isCurrent || profile.enabled === false) ? 'default' : 'pointer' }}
							{...pressable(()=>{ if(!isCurrent && profile.enabled !== false){ setProviderAsCurrent(profile); } }, { role: false })}
							className={[
								styles.providerSwitchItem,
								isCurrent ? styles.providerSwitchItemActive : '',
							].filter(Boolean).join(' ')}
						>
							<div className={styles.providerSwitchMain}>
								<div className={styles.providerSwitchTitle}>
									<strong>{displayName}</strong>
									{isCurrent ? <Tag color="blue">当前</Tag> : null}
									{profile.enabled === false ? <Tag>未启用</Tag> : <Tag color="green">已启用</Tag>}
									{profile.apiKeyDecryptFailed ? <Tag color="orange" title="主密钥缺失,库内密文解不开;未重填前原密文保留">Key 请重填</Tag> : null}
									{profile.extraHeadersDecryptFailed ? <Tag color="orange" title="额外请求头里的令牌解不开;未重填前原密文保留">请求头令牌请重填</Tag> : null}
								</div>
								<div className={styles.providerSwitchMeta}>
									<span>类型：{getProviderDisplayName(profile.providerType)}</span>
									<span>协议族：{profile.protocolFamily || getProviderProtocolFamily(profile.providerType)}</span>
									<span>模型：{models[0] || '未配置'}</span>
								</div>
								{profile.baseUrl ? (
									<div className={styles.providerSwitchUrl}>{profile.baseUrl}</div>
								) : null}
							</div>
							<Space>
								<Button
									size="small"
									disabled={isCurrent || profile.enabled === false}
									title={profile.enabled === false ? '未启用的接口不能设为当前(先在「编辑」里打开「启用」)' : undefined}
									onClick={(e)=>{ e.stopPropagation(); setProviderAsCurrent(profile); }}
								>
									{isCurrent ? '当前' : '设为当前'}
								</Button>
								<Button
									type="primary"
									size="small"
									icon={<XQIcon name="edit" />}
									onClick={(e)=>{
										e.stopPropagation();
										setProviderSwitchModalOpen(false);
										openProviderEditor(profile);
									}}
								>
									编辑
								</Button>
							</Space>
						</div>
					);
				})}
			</div>
		) : (
			<XQEmpty description="暂无接口配置" />
		)}
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderProviderModal = ({
	editingProvider, providerModalOpen, saveProviderForm, setProviderModalOpen, setProviderAdvancedOpen,
	setEditingProvider, providerForm, applyProviderPresetToForm, providerAdvancedOpen,
})=>(
	<Modal
		title={editingProvider ? '编辑接口配置' : '新增接口配置'}
		open={providerModalOpen}
		width={720}
		bodyStyle={{ maxHeight: 'calc(100 * var(--horosa-lvh, 1vh) - 220px)', overflowY: 'auto' }}
		onOk={saveProviderForm}
		onCancel={()=>{
			setProviderModalOpen(false);
			setProviderAdvancedOpen(false);
			setEditingProvider(null);
		}}
	>
		<Form
			form={providerForm}
			layout="vertical"
			onValuesChange={(changedValues)=>{
				if(changedValues.providerType){
					applyProviderPresetToForm(changedValues.providerType);
				}
			}}
		>
			<Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}>
				<Input />
			</Form.Item>
			<Form.Item name="providerType" label="供应商预设" rules={[{ required: true, message: '请选择接口类型' }]}>
				<Select>
					{PROVIDER_OPTIONS.map((item)=>(
						<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
					))}
				</Select>
			</Form.Item>
			<Form.Item shouldUpdate={(prev, cur)=>prev.providerType !== cur.providerType} noStyle>
				{({ getFieldValue })=>{
					const pt = getFieldValue('providerType') || '';
					const ph = pt === 'anthropic' ? 'sk-ant-...' :
						(pt === 'openai' || pt === 'deepseek' || pt === 'openrouter' || pt === 'groq' || pt === 'siliconflow') ? 'sk-...' :
						pt === 'ollama' ? '可留空（本地服务）' : '留空表示不设置';
					return (
						<Form.Item name="apiKey" label="API Key" extra={editingProvider && editingProvider.apiKeyDecryptFailed ? '当前 Key 密文无法解密(主密钥缺失):留空保存则原密文原样保留,填入新 Key 则覆盖。' : 'Key 只存本机(桌面版静态加密,主密钥由系统钥匙串保管),不入库、不出站;只随你的请求发给所选接口。'}>
							<AntdInput.Password
								placeholder={ph}
								autoComplete="off"
								onChange={(e)=>{
									const v = `${e.target.value || ''}`;
									const cleaned = v.replace(/[\s\n\r]+$/, '').replace(/^\s+/, '');
									if(cleaned !== v){
										// 防被粘贴 .env 时拖入的换行/空白污染。
										providerForm.setFieldsValue({ apiKey: cleaned });
									}
								}}
							/>
						</Form.Item>
					);
				}}
			</Form.Item>
			<Form.Item name="baseUrl" label="Base URL">
				<Input />
			</Form.Item>
			<Form.Item shouldUpdate noStyle>
				{({ getFieldValue })=>(
					<div className={styles.cardMeta}>
						<div>协议族：{getProviderProtocolFamily(getFieldValue('providerType') || 'openai')}</div>
					</div>
				)}
			</Form.Item>
			<div className={styles.providerAdvancedToggle}>
				<Button
					className={styles.providerAdvancedButton}
					icon={<XQIcon name="sliders" />}
					onClick={()=>setProviderAdvancedOpen((prev)=>!prev)}
				>
					{providerAdvancedOpen ? '收起高级参数' : '展开高级参数'}
				</Button>
			</div>
			{providerAdvancedOpen ? (
				<div className={styles.providerAdvancedPanel}>
					<Collapse ghost defaultActiveKey={['models']}>
						<Collapse.Panel key="models" header="模型清单 / 请求调优" forceRender>
							<Form.Item name="manualModels" label="聊天模型列表">
								<TextArea rows={4} />
							</Form.Item>
							<Form.Item name="embeddingModels" label="Embedding 模型列表">
								<TextArea rows={3} />
							</Form.Item>
							<Form.Item name="requestTimeoutMs" label="请求超时（毫秒）" extra="作用于连接与首响应头、以及非流式请求（测试连接/拉模型/取材料）；流式对话正文不受此限。范围 1000–600000（1 秒–10 分钟），前后端同一个数">
								<Input />
							</Form.Item>
							<Form.Item name="streamStallMs" label="流式空闲上限（毫秒）" extra="连续无新内容多久判卡死，空=180000（3 分钟）；深思模型经中转网关频繁报「无新内容」可调大">
								<Input placeholder="180000" />
							</Form.Item>
							<Form.Item name="streamMaxStreamMs" label="流式总时长上限（毫秒）" extra="单次生成绝对上限，空=1800000（30 分钟）；防龟速流永不收尾">
								<Input placeholder="1800000" />
							</Form.Item>
						</Collapse.Panel>
						<Collapse.Panel key="auth" header="鉴权定制（自定义请求头）" forceRender>
							<Form.Item name="extraHeadersText" label="额外请求头（JSON 对象）" extra={editingProvider && editingProvider.extraHeadersDecryptFailed ? '有头值密文无法解密(主密钥缺失):值留空保存则原密文原样保留,填入新值则覆盖。' : '值与 API Key 同样只存本机并静态加密,不进备份。'} rules={[JSON_TEXT_RULE]}>
								<MonacoEditor height="140px" defaultLanguage="json" beforeMount={configureMonaco} />
							</Form.Item>
						</Collapse.Panel>
						{/* 标题改真话:这些键在后端**最先**放进请求体,与表单字段或分析页参数同名时会被后者覆盖 —— 是「补充」不是「覆盖」 */}
						<Collapse.Panel key="body" header="额外请求体字段（厂家私有参数；同名键以表单与页面参数为准）" forceRender>
							<Form.Item name="extraBodyText" label="额外请求体（JSON 对象）" rules={[JSON_TEXT_RULE]}>
								<MonacoEditor height="140px" defaultLanguage="json" beforeMount={configureMonaco} />
							</Form.Item>
							<Form.Item name="providerOptionsText" label="补充高级参数（JSON）" rules={[JSON_TEXT_RULE]}>
								<MonacoEditor height="160px" defaultLanguage="json" beforeMount={configureMonaco} />
							</Form.Item>
						</Collapse.Panel>
					</Collapse>
				</div>
			) : null}
			<Form.Item shouldUpdate noStyle>
				{({ getFieldValue })=>{
					const providerType = getFieldValue('providerType');
					if(providerType === 'anthropic'){
						return (
							<>
								<Form.Item name="anthropicApiVersion" label="Anthropic API Version" extra="这是固定的 API 版本号（不是「当前日期」）。普通用户保持默认 2023-06-01 即可，无需改动。">
									<Select
										placeholder="默认 2023-06-01"
										options={[
											{ value: '2023-06-01', label: '2023-06-01（推荐 · 默认）' },
											{ value: '2023-01-01', label: '2023-01-01（旧版）' },
										]}
									/>
								</Form.Item>
								<Form.Item name="anthropicMaxTokens" label="Anthropic max_tokens">
									<Input placeholder="如 2048" />
								</Form.Item>
								<Form.Item name="anthropicThinkingBudget" label="思考预算上限" extra="仅思考档开启时生效(预算型号 budget_tokens 与档位取小;自适应型号忽略);关闭档不发思考">
									<Input placeholder="如 8192" />
								</Form.Item>
								<Form.Item name="anthropicTopP" label="Anthropic top_p">
									<Input placeholder="如 0.9" />
								</Form.Item>
								<Form.Item name="anthropicTopK" label="Anthropic top_k">
									<Input placeholder="如 40" />
								</Form.Item>
							</>
						);
					}
					if(providerType === 'gemini'){
						return (
							<>
								<Form.Item name="geminiGenerationConfigText" label="Gemini generationConfig" rules={[JSON_TEXT_RULE]}>
									<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
								</Form.Item>
								<Form.Item name="geminiSafetySettingsText" label="Gemini safetySettings" rules={[JSON_TEXT_RULE]}>
									<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
								</Form.Item>
							</>
						);
					}
					if(providerType === 'ollama'){
						return (
							<>
								<Form.Item name="ollamaKeepAlive" label="Ollama keep_alive">
									<Input placeholder="如 5m" />
								</Form.Item>
								<Form.Item name="ollamaNumCtx" label="Ollama num_ctx">
									<Input placeholder="如 8192" />
								</Form.Item>
								<Form.Item name="ollamaNumPredict" label="Ollama num_predict">
									<Input placeholder="如 1024" />
								</Form.Item>
								<Form.Item name="ollamaTopK" label="Ollama top_k">
									<Input placeholder="如 40" />
								</Form.Item>
								<Form.Item name="ollamaTopP" label="Ollama top_p">
									<Input placeholder="如 0.9" />
								</Form.Item>
								<Form.Item name="ollamaRepeatPenalty" label="Ollama repeat_penalty">
									<Input placeholder="如 1.1" />
								</Form.Item>
							</>
						);
					}
					return null;
				}}
			</Form.Item>
			<Form.Item name="enabled" label="启用此配置" valuePropName="checked">
				<Switch />
			</Form.Item>
		</Form>
	</Modal>
);

// AIAnalysisMain 渲染树里的一段(门面原位置换成调用它的表达式,渲染出的元素树不变)
export const renderTemplatePreviewDrawer = ({
	previewTemplate, previewDrawerOpen, setPreviewDrawerOpen, setPreviewTemplate, previewResult,
	templateVersions,
})=>(
	<Drawer
		title={previewTemplate ? `模版预览 · ${previewTemplate.name}` : '模版预览'}
		open={previewDrawerOpen}
		width={520}
		onClose={()=>{
			setPreviewDrawerOpen(false);
			setPreviewTemplate(null);
		}}
	>
		{previewTemplate && previewResult ? (
			<div>
				<div className={styles.previewMeta}>
					<Tag>{previewTemplate.format}</Tag>
					<Tag>版本 {templateVersions.filter((item)=>item.templateId === previewTemplate.id).length}</Tag>
				</div>
				<pre className={styles.previewCode}>{previewResult.text}</pre>
				{previewResult.errors && previewResult.errors.length ? (
					<div className={styles.previewErrors}>
						<Title level={5}>Schema 校验</Title>
						{previewResult.errors.map((item, idx)=>(
							<div key={idx} className={styles.errorLine}>{item.message || JSON.stringify(item)}</div>
						))}
					</div>
				) : (
					<Text type="secondary">Schema 校验通过</Text>
				)}
			</div>
		) : null}
	</Drawer>
);
