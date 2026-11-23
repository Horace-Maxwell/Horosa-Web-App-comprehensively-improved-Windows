// AI 分析页 · 分析主栏:落地页示例与引导、输入区上下文行、输入区、分析主栏整体
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Alert, Badge, Collapse, Dropdown, Popover, Space, Tag, Tooltip, Typography, message } from 'antd';
import { copyTextSmart } from '../../../utils/clipboardText';
import styles from '../AIAnalysisMain.less';
import XQIcon from '../../xq-icons';
import { XQButton as Button, XQInput as Input, XQSelect as Select, XQSwitch as Switch, XQInputNumber, XQSlider } from '../../xq-ui';
import AgentActionBar from '../AgentActionBar';
import ComposerAssist from '../chat/ComposerAssist';
import { landingTitle, landingHint } from '../../../utils/aiChat/landingGreeting';
import { buildTimestampLabel, saveConversationMessage, saveUiPrefs } from '../../../utils/aiAnalysisStore';
import { listAnalysisSources } from '../../../utils/aiAnalysisContext';
import { EMBEDDING_TARGET_NONE } from '../../../utils/aiAnalysisRag';
import { getProviderProtocolFamily, THINKING_LEVELS, estimateUsageCost, parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { TIMEPOINT_SOURCE_ID, NATAL_SOURCE_ID, formatTimepointNow } from './sourceContext';
import { AssistantMarkdown } from './AssistantMarkdown';
import { matchesUserQuery } from '../../../utils/scriptMode';
import { pressable } from '../../../utils/pressable';
const { TextArea } = Input;
const { Text } = Typography;

// 落地页示例提问 chip：按 source 类型动态。点击只填入 prompt，不自动发送。
export function renderLandingExamples({
	activeSource, modelSelection, activeProviderProfile, aiExamplePromptsBySource, handleExampleClick,
	aiExamplesLoading,
}){
	const sourceKey = activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none';
	const sel = parseModelSelection(modelSelection || '');
	const fetchKey = `${sourceKey}::${activeProviderProfile ? `${activeProviderProfile.id || ''}-${sel.model || ''}` : ''}`;
	const ai = aiExamplePromptsBySource[fetchKey];
	// 起课时间与事盘同属「问事」:此前起课时间落到命盘那组示例(「分析这张命盘的财运」)
	const staticExamples = activeSource && (activeSource.sourceType === 'case' || activeSource.sourceType === 'timepoint')
		? ['这张事盘的吉凶判断', '应期与方位提示', '用神/格局分析']
		: activeSource
			? ['分析这张命盘的财运', '解读流年运势走向', '婚恋与配偶宫剖析']
			: ['先帮我说明这套AI分析的用法', '介绍一下星阙都支持哪些术数', '我想分析命盘，下一步该怎么做'];
	const examples = (ai && ai.length) ? ai : staticExamples;
	return (
		<div className={styles.landingExamples}>
			{examples.map((txt)=>(
				<Tag key={txt} className={styles.landingExampleChip} onClick={()=>handleExampleClick(txt)}>{txt}</Tag>
			))}
			{aiExamplesLoading && !ai ? (
				<span className={styles.landingExamplesHint}>AI 生成示例中…</span>
			) : (ai ? (
				<span className={styles.landingExamplesHint}>· AI 根据案例生成</span>
			) : null)}
		</div>
	);
}

// 主流 Chat 式气泡输入：空态居中、活动态停靠底部，两处共用同一气泡。
// 空态三步引导:只在还没有可用接口时出现(接好模型即消失);每张卡点一下就去补那一步
export function renderLandingSetup({
	activeProviderProfile, activeTechniqueKeys, openProviderEditor, activeSource, focusSourceSelect,
	setMountDrawerOpen,
}){
	if(activeProviderProfile){ return null; }
	const tCnt = activeTechniqueKeys ? activeTechniqueKeys.length : 0;
	return (
		<div className={styles.landingSetup} data-landing-setup="1">
			<div className={styles.landingSetupCard}>
				<div className={styles.landingSetupStep}>1 / 3</div>
				<div className={styles.landingSetupTitle}>接入模型</div>
				<div className={styles.landingSetupDesc}>还没有可用的接口</div>
				<button type="button" className={styles.landingSetupGo} onClick={()=>openProviderEditor(null)}>去配置</button>
			</div>
			<div className={styles.landingSetupCard}>
				<div className={styles.landingSetupStep}>2 / 3</div>
				<div className={styles.landingSetupTitle}>选择案例</div>
				<div className={styles.landingSetupDesc}>{activeSource ? `已选：${activeSource.title}` : '命盘、事盘，或按此刻起课'}</div>
				<button type="button" className={styles.landingSetupGo} onClick={focusSourceSelect}>{activeSource ? '换一个' : '选择案例'}</button>
			</div>
			<div className={styles.landingSetupCard}>
				<div className={styles.landingSetupStep}>3 / 3</div>
				<div className={styles.landingSetupTitle}>挂载技法</div>
				<div className={styles.landingSetupDesc}>{tCnt > 0 ? `已挂 ${tCnt} 项技法` : '想让 AI 看哪些盘面内容'}</div>
				<button type="button" className={styles.landingSetupGo} onClick={()=>setMountDrawerOpen(true)}>打开挂载</button>
			</div>
		</div>
	);
}

// 空态输入框顶行:案例 / 模型 / 挂载三个入口 + 「状态」展开钮。有消息后不出现(那时上方是「当前挂载」条与常驻状态胶囊)
export function renderComposerContextRow({
	modelSelection, activeProviderProfile, activeTechniqueKeys, referenceIds, partnerSource,
	activeSource, focusSourceSelect, modelOptions, openProviderEditor, setModelSelectOpen,
	setMountDrawerOpen, chatAssist, landingStatusOpen, setLandingStatusOpen,
}){
	const sel = parseModelSelection(modelSelection || '');
	const modelText = !activeProviderProfile ? '未配置' : (sel.model || '未选择');
	const modelUnset = !activeProviderProfile || !sel.model;
	const tCnt = activeTechniqueKeys ? activeTechniqueKeys.length : 0;
	const refCnt = referenceIds ? referenceIds.length : 0;
	const mountText = [`${tCnt} 技法`, refCnt > 0 ? `${refCnt} 资料/组合` : '', partnerSource ? `对方 ${partnerSource.title}` : ''].filter(Boolean).join(' · ');
	const pick = (unset)=>[styles.composerPick, unset ? styles.composerPickUnset : ''].filter(Boolean).join(' ');
	return (
		<div className={styles.composerContextRow} data-composer-context="1">
			<button
				type="button"
				className={pick(!activeSource)}
				data-pick="source"
				title="选择或更换案例(事盘挂载的是保存那一刻的盘面)"
				onClick={focusSourceSelect}
			>
				<span className={styles.composerPickLabel}>案例</span>
				<span className={styles.composerPickValue}>{activeSource ? activeSource.title : '未选择'}</span>
				<XQIcon name="chevronDown" />
			</button>
			<button
				type="button"
				className={pick(modelUnset)}
				data-pick="model"
				title="选择模型(还没有接口时去配置)"
				onClick={()=>{
					if(!activeProviderProfile || !modelOptions.length){ openProviderEditor(activeProviderProfile || null); return; }
					setModelSelectOpen(true);
				}}
			>
				<span className={styles.composerPickLabel}>模型</span>
				<span className={styles.composerPickValue}>{modelText}</span>
				<XQIcon name="chevronDown" />
			</button>
			{activeSource ? (
				<button type="button" className={styles.composerPick} data-pick="mount" title="本轮会带上的技法与资料;点击打开挂载设置" onClick={()=>setMountDrawerOpen(true)}>
					<span className={styles.composerPickLabel}>挂载</span>
					<span className={styles.composerPickValue}>{mountText}</span>
				</button>
			) : null}
			{chatAssist.statusBarNode ? (
				<button type="button" className={styles.composerStatusToggle} aria-expanded={landingStatusOpen} title="模型 / 行动能力 / 挂载字数 / 费用 / 缓存 / 上下文 / 策略" onClick={()=>setLandingStatusOpen((v)=>!v)}>
					状态<XQIcon name="chevronDown" />
				</button>
			) : null}
		</div>
	);
}

// landing = 空态(还没有消息):顶行换成案例 / 模型入口,状态胶囊收起,工具按钮带文字、次要动作进「更多」;有消息后的停靠态不变
export function renderComposer({
	sending, prompt, pendingImages, activeConversation, resetConversationDraft,
	handleRegenerateLastReply, handleEditLastUserAndBranch, setSources, setComposerDragOver,
	handlePickImages, composerDragOver, renderComposerContextRow, landingStatusOpen, chatAssist,
	setPrompt, handleSend, setPendingImages, imageInputRef, setMountDrawerOpen, setInnerTab,
	handleStopStreaming,
}, landing){
	const canSend = !sending && (!!`${prompt || ''}`.trim() || pendingImages.length > 0);
	const inputPlaceholder = landing ? '输入你的问题，也可以把图片拖进来' : '输入你的分析问题…会自动带上案例、资料、组合与模版约束（可拖拽/粘贴图片）';
	const moreMenu = {
		items: [
			{ key: 'new', label: '新对话' },
			{ key: 'regen', label: '重新生成', disabled: !activeConversation || sending },
			{ key: 'edit', label: '编辑上一条并分支', disabled: !activeConversation || sending },
			{ key: 'refresh', label: '刷新案例列表' },
		],
		onClick: ({ key })=>{
			if(key === 'new'){ resetConversationDraft(); }
			else if(key === 'regen'){ handleRegenerateLastReply(); }
			else if(key === 'edit'){ handleEditLastUserAndBranch(); }
			else if(key === 'refresh'){ setSources(listAnalysisSources({ force: true })); }
		},
	};
	const onDragOver = (e)=>{
		if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
			e.preventDefault();
			setComposerDragOver(true);
		}
	};
	const onDragLeave = (e)=>{
		if(e.target === e.currentTarget){ setComposerDragOver(false); }
	};
	const onDrop = (e)=>{
		e.preventDefault();
		setComposerDragOver(false);
		const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f)=>/^image\//.test(f.type || ''));
		if(files.length){ handlePickImages(files); }
	};
	const onPaste = (e)=>{
		const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
		const files = items.filter((it)=>it.kind === 'file' && /^image\//.test(it.type)).map((it)=>it.getAsFile()).filter(Boolean);
		if(files.length){ handlePickImages(files); /* 不阻止默认：让文本粘贴照常 */ }
	};
	return (
		<div
			className={[styles.composerBubble, landing ? styles.composerBubbleLanding : '', composerDragOver ? styles.composerBubbleDragOver : ''].filter(Boolean).join(' ')}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onPaste={onPaste}
		>
			{landing ? renderComposerContextRow() : null}
			{/* 状态胶囊常驻 DOM(data-* 供机读);空态下缺省只是收起不显示 */}
			<div className={landing && !landingStatusOpen ? styles.composerStatusCollapsed : undefined}>{chatAssist.statusBarNode}</div>
			<ComposerAssist {...chatAssist.composer} />
			<TextArea
				value={prompt}
				autoSize={{ minRows: landing ? 2 : 1, maxRows: 8 }}
				bordered={false}
				className={styles.composerInput}
				placeholder={inputPlaceholder}
				onChange={(e)=>setPrompt(e.target.value)}
				onPressEnter={(e)=>{
					if(!e.shiftKey){
						e.preventDefault();
						if(!sending){
							handleSend();
						}else if(chatAssist.canSteer){
							chatAssist.steer();   // 生成中回车 = 插话
						}
					}
				}}
			/>
			{pendingImages.length ? (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 4px' }}>
					{pendingImages.map((img, idx)=>(
						<div key={idx} style={{ position: 'relative' }}>
							<img src={img.url} alt={img.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--horosa-border, #d9d9d9)' }} />
							<span {...pressable(()=>setPendingImages((prev)=>prev.filter((_, i)=>i !== idx)))} style={{ position: 'absolute', top: -6, right: -6, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: 16, height: 16, lineHeight: '16px', textAlign: 'center', fontSize: 11 }}>×</span>
						</div>
					))}
				</div>
			) : null}
			<div className={styles.composerBar}>
				<Space size={2} className={[styles.composerTools, landing ? styles.composerToolsLanding : ''].filter(Boolean).join(' ')}>
					{!landing ? (
						<React.Fragment>
							<Tooltip title="新对话"><Button size="small" type="text" icon={<XQIcon name="plus" />} onClick={resetConversationDraft} /></Tooltip>
							<Tooltip title="重新生成"><Button size="small" type="text" icon={<XQIcon name="sync" />} onClick={handleRegenerateLastReply} disabled={!activeConversation || sending} /></Tooltip>
							<Tooltip title="编辑上一条并分支"><Button size="small" type="text" icon={<XQIcon name="edit" />} onClick={handleEditLastUserAndBranch} disabled={!activeConversation || sending} /></Tooltip>
							<Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{'刷新案例列表\n挂载内容取自案例存档(保存时刻的盘面)。在技法页改动信息/重新起课后,请先在技法页重新保存案例,再点此刷新。'}</span>}><Button size="small" type="text" icon={<XQIcon name="refresh" />} onClick={()=>setSources(listAnalysisSources({ force: true }))} /></Tooltip>
						</React.Fragment>
					) : null}
					<Tooltip title="添加图片（多媒体输入，仅视觉模型有效）"><Button size="small" type="text" icon={<XQIcon name="import" />} onClick={()=>{ if(imageInputRef.current){ imageInputRef.current.click(); } }} disabled={sending} /></Tooltip>
					<input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e)=>{ handlePickImages(e.target.files); e.target.value = ''; }} />
					{landing ? <Tooltip title="本轮带哪些技法与资料"><Button size="small" type="text" icon={<XQIcon name="tool" />} onClick={()=>setMountDrawerOpen(true)}>挂载</Button></Tooltip> : null}
					{landing ? <Tooltip title="提示词模版"><Button size="small" type="text" onClick={()=>setInnerTab('templates')}>模版</Button></Tooltip> : null}
					{landing ? <Dropdown trigger={['click']} placement="topLeft" menu={moreMenu}><Button size="small" type="text" icon={<XQIcon name="more" />} aria-label="更多" title="更多：新对话 / 重新生成 / 编辑上一条 / 刷新案例列表" /></Dropdown> : null}
					{sending ? <Tooltip title="停止生成"><Button size="small" type="text" danger icon={<XQIcon name="stop" />} onClick={handleStopStreaming} /></Tooltip> : null}
				</Space>
				<div className={styles.composerSend}>
					<Text type="secondary" className={styles.composerHint}>Enter 发送 · Shift+Enter 换行</Text>
					<Button type="primary" shape="circle" icon={<XQIcon name="send" />} loading={sending} disabled={!canSend} onClick={()=>handleSend()} />
				</div>
			</div>
		</div>
	);
}

export function renderAnalysisPane({
	modelSelection, modelSelectOpen, setModelSelectOpen, setModelSelection, modelOptions,
	activeProviderProfile, openProviderEditor, fetchModelsAndEmbeddings, setProviderSwitchModalOpen,
	setInnerTab, embeddingSelection, setEmbeddingSelection, embeddingOptions, thinkingLevel,
	setThinkingLevel, paramPopover, chatTemperature, setChatTemperature, chatTopP, setChatTopP,
	stopSequences, setStopSequences, frequencyPenalty, setFrequencyPenalty, presencePenalty,
	setPresencePenalty, jsonMode, setJsonMode, renderConnChip, sourceSelectOpen, selectedSourceId,
	setSourceSelectOpen, setSources, sourceOptions, setTimepointDraft, setNatalDraft,
	setSelectedSourceId, activeSource, activeTechniqueKeys, setSelectedTechniqueKeys,
	groupedTechniqueOptions, partnerSource, setPartnerSourceId, lockedContextItems, setMountDrawerOpen,
	visibleMessages, renderLandingSetup, renderComposer, renderLandingExamples, autoFollow, chatLogRef,
	setAutoFollow, setChatLogEl, activeConversation, exportConversation, handleEditMessageAndBranch,
	sending, chatAssist, handleBranchFromMessage, setMessages, handleRegenerateMessage,
	handleCopyMessage, renderContextBanner,
}){
	return (
		<div className={styles.paneShell}>
			<div className={styles.paneHeader}>
				<div className={styles.topBar}>
					<div className={styles.topGroup}>
						<Select
							showSearch
							value={modelSelection || undefined}
							placeholder="选择模型"
							className={styles.modelSelect}
							optionFilterProp="children"
							open={modelSelectOpen}
							onDropdownVisibleChange={(open)=>setModelSelectOpen(open)}
							onChange={(val)=>setModelSelection(val || '')}
						>
							{modelOptions.map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
						<Dropdown
							trigger={['click']}
							placement="bottomLeft"
							menu={{
								items: [
									{ key: 'edit', label: '配置当前接口' },
									{ key: 'fetch', label: '拉取模型', disabled: !activeProviderProfile },
									{ key: 'switch', label: '切换生效接口' },
									{ type: 'divider' },
									{ key: 'manage', label: '管理全部接口…' },
								],
								onClick: ({ key })=>{
									if(key === 'edit'){ openProviderEditor(activeProviderProfile || null); }
									else if(key === 'fetch'){ if(activeProviderProfile){ fetchModelsAndEmbeddings(activeProviderProfile); } }
									else if(key === 'switch'){ setProviderSwitchModalOpen(true); }
									else if(key === 'manage'){ setInnerTab('settings'); }
								},
							}}
						>
							<Button size="small" className={styles.topBtn} icon={<XQIcon name="setting" />}>配置</Button>
						</Dropdown>
						<Select
							showSearch
							allowClear
							value={embeddingSelection || undefined}
							placeholder="嵌入/向量模型（资料库检索·可选）"
							className={styles.modelSelect}
							optionFilterProp="children"
							onChange={(val)=>{ setEmbeddingSelection(val || ''); saveUiPrefs({ embeddingSelection: val || '' }); }}
						>
							{/* 显式「不用向量」:清空只是「没显式选」,仍会回落接口自带的嵌入模型 */}
							<Select.Option key={EMBEDDING_TARGET_NONE} value={EMBEDDING_TARGET_NONE}>不用向量（只按关键词检索）</Select.Option>
							{embeddingOptions.map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
						<Popover
							trigger="click"
							placement="bottomLeft"
							title="聊天高级参数"
							content={(
								<div style={{ width: 240 }}>
									<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>思考档</span></div>
									<Select size="small" style={{ width: '100%', marginBottom: 12 }} value={thinkingLevel}
										onChange={(v)=>{ setThinkingLevel(v); saveUiPrefs({ thinkingLevel: v }); }}>
										{/* 对当前模型无差异的档置灰并写明等同哪一档(判定由 applyThinkingLevel 自证) */}
										{paramPopover.thinkingLevels.map((t)=>(
											<Select.Option key={t.value} value={t.value} disabled={!!t.sameAs && t.value !== thinkingLevel}>
												<span title={t.sameAs ? `该模型上与「${(THINKING_LEVELS.find((x)=>x.value === t.sameAs) || {}).label || t.sameAs}」无差别` : undefined}>
													{t.label}{t.sameAs ? `（同「${(THINKING_LEVELS.find((x)=>x.value === t.sameAs) || {}).label || t.sameAs}」）` : ''}
												</span>
											</Select.Option>
										))}
									</Select>
									{paramPopover.anthropicAdaptive
										? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, marginBottom: 8 }}>该 Anthropic 型号不接受采样参数(温度 / top_p / top_k 由出口剥离,用官方缺省)</div>
										: null}
									{paramPopover.reasoning
										? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, marginBottom: 8 }}>推理模型自带思考，已隐藏 temperature</div>
										: (<div style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>温度 temperature</span><span>{chatTemperature == null ? '默认' : <span>{chatTemperature} <a data-chat-temp-reset="1" onClick={()=>{ setChatTemperature(null); saveUiPrefs({ chatTemperature: null }); }}>恢复默认</a></span>}</span></div>
											{/* 拨过后可回「默认」(置 null 并写偏好;默认=不下发,由接口家族缺省) */}
											{/* 上限随家族:Anthropic 0..1,其余 0..2 */}
											<XQSlider disabled={paramPopover.anthropicAdaptive} min={0} max={paramPopover.tempMax} step={0.1} value={chatTemperature == null ? Math.min(0.7, paramPopover.tempMax) : Math.min(chatTemperature, paramPopover.tempMax)}
												onChange={(v)=>{ setChatTemperature(v); saveUiPrefs({ chatTemperature: v }); }} />
										</div>)}
									<div>
										<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>top_p</span><span>{chatTopP == null ? '默认' : <span>{chatTopP} <a data-chat-topp-reset="1" onClick={()=>{ setChatTopP(null); saveUiPrefs({ chatTopP: null }); }}>恢复默认</a></span>}</span></div>
										{/* 推理型号 / Anthropic 自适应族的 top_p 在出口被剥,拨了不进请求体 → 置灰而不是假装可拨 */}
										<XQSlider disabled={paramPopover.samplingDead} min={0} max={1} step={0.05} value={chatTopP == null ? 1 : chatTopP}
											onChange={(v)=>{ setChatTopP(v); saveUiPrefs({ chatTopP: v }); }} />
										{paramPopover.samplingDead ? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 2 }}>该型号不接受 top_p(出口已剥离)</div> : null}
										{paramPopover.kimiNote ? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 2 }}>{paramPopover.kimiNote}</div> : null}   {/* kimi-k 系前后端分治明说 */}
									</div>
									<div style={{ marginTop: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>停止序列</span></div>
										<Input size="small" placeholder="逗号/换行分隔，可留空" value={stopSequences} onChange={(e)=>{ setStopSequences(e.target.value); saveUiPrefs({ stopSequences: e.target.value }); }} />
									</div>
									<div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
										{/* 两惩罚只在「OpenAI 兼容 且 非推理型号」时进请求体,其余一律置灰 */}
										<div style={{ flex: 1 }}><div>频率惩罚</div><XQInputNumber disabled={paramPopover.penaltyDead} size="small" min={-2} max={2} step={0.1} placeholder="默认" style={{ width: '100%' }} value={frequencyPenalty} onChange={(v)=>{ setFrequencyPenalty(v); saveUiPrefs({ frequencyPenalty: v }); }} /></div>
										<div style={{ flex: 1 }}><div>存在惩罚</div><XQInputNumber disabled={paramPopover.penaltyDead} size="small" min={-2} max={2} step={0.1} placeholder="默认" style={{ width: '100%' }} value={presencePenalty} onChange={(v)=>{ setPresencePenalty(v); saveUiPrefs({ presencePenalty: v }); }} /></div>
									</div>
									<div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>JSON 输出模式</span><Switch size="small" checked={!!jsonMode} onChange={(v)=>{ setJsonMode(v); saveUiPrefs({ jsonMode: v }); }} /></div>
									{/* 文案改真话:此前称三项都只对 OpenAI 兼容生效,与代码互斥 */}
									<div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 6 }}>停止序列四家通用（Anthropic / Gemini / Ollama 由出口自动映射）；频率/存在惩罚仅 OpenAI 兼容接口；JSON 输出模式对 OpenAI 兼容与 Gemini 生效，Ollama 不支持（已自动忽略）。</div>
								</div>
							)}
						>
							<Button size="small" className={styles.topBtn} icon={<XQIcon name="setting" />}>参数</Button>
						</Popover>
					</div>
					<span className={styles.topDivider} />
					{renderConnChip()}
					<span className={styles.topDivider} />
					<div className={styles.topGroup}>
						<Select
							showSearch
							allowClear
							open={sourceSelectOpen}
							value={selectedSourceId || undefined}
							placeholder="选择案例（命盘 / 事盘）"
							onDropdownVisibleChange={(open)=>{ setSourceSelectOpen(open); if(open){ setSources(listAnalysisSources()); } }}
							className={styles.sourceSelect}
							filterOption={(input, option)=>{
								const source = sourceOptions.find((item)=>item.value === option.value);
								return source ? matchesUserQuery(source.searchText, `${input || ''}`.trim()) : false;
							}}
							onChange={(val)=>{
								const next = val || '';
								// 选中「起课时间/命盘时间」时刷新为当前时刻(此刻)——修 Win#17:之前默认用 mount(打开软件)时间而非点击时间。
								if(next === TIMEPOINT_SOURCE_ID){
									setTimepointDraft((prev)=>({ ...prev, divTime: formatTimepointNow() }));
								}else if(next === NATAL_SOURCE_ID){
									setNatalDraft((prev)=>({ ...prev, birth: formatTimepointNow() }));
								}
								setSelectedSourceId(next);
							}}
						>
							{sourceOptions.map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
						{activeSource ? (
							<Select
								mode="multiple"
								allowClear
								maxTagCount="responsive"
								value={activeTechniqueKeys}
								placeholder={`选择${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}技法`}
								className={styles.sourceSelect}
								onChange={(vals)=>setSelectedTechniqueKeys(vals || [])}
							>
								{groupedTechniqueOptions.map((group)=>(
									<Select.OptGroup key={group.title} label={group.title}>
										{group.items.map((item)=>(
											<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
										))}
									</Select.OptGroup>
								))}
							</Select>
						) : null}
						{partnerSource ? (
							<Tooltip title="合盘对方:所选技法同时挂两人的盘面。点 × 取消,或在「挂载」里换人。">
								<Tag closable color="geekblue" data-pair-chip="1" onClose={(e)=>{ e.preventDefault(); setPartnerSourceId(''); }}>合盘 · {partnerSource.title}</Tag>
							</Tooltip>
						) : null}
						<Badge count={lockedContextItems.filter((item)=>!item.muted).length} size="small" offset={[-2, 2]}>
							<Button size="small" className={styles.topBtn} icon={<XQIcon name="tool" />} onClick={()=>setMountDrawerOpen(true)}>挂载</Button>
						</Badge>
					</div>
				</div>
			</div>
			<div className={styles.paneBody}>
				<div className={styles.chatStage}>
					{visibleMessages.length === 0 ? (
						<div className={styles.chatLanding}>
							<div className={styles.chatLandingInner}>
								<div className={styles.chatLandingTitle}>{landingTitle({ hour: new Date().getHours(), hasSource: !!activeSource })}</div>
								<div className={styles.chatLandingHint}>{landingHint({ hasModel: !!activeProviderProfile, sourceTitle: activeSource ? activeSource.title : '' })}</div>
								{renderLandingSetup()}
								{renderComposer(true)}
								{renderLandingExamples()}
							</div>
						</div>
					) : (
						<React.Fragment>
							<div className={styles.chatLogShell}>
							{!autoFollow && visibleMessages.length ? (
								<Button
									className={styles.scrollToLatestBtn}
									size="small"
									shape="round"
									icon={<XQIcon name="chevronDown" />}
									onClick={()=>{
										const el = chatLogRef.current;
										if(el){ el.scrollTop = el.scrollHeight; }
										setAutoFollow(true);
									}}
								>跳到最新</Button>
							) : null}
							<div className={styles.chatLog} ref={setChatLogEl}>
								<div className={styles.chatThread}>
									{activeConversation ? (
										<div className={styles.chatThreadHead}>
											<span className={styles.chatThreadTitle}>{activeConversation.title}</span>
											{activeConversation.updatedAt ? <Text type="secondary">{buildTimestampLabel(activeConversation.updatedAt)}</Text> : null}
											<Dropdown
												trigger={['click']}
												menu={{
													items: [
														{ key: 'md', label: 'Markdown' },
														{ key: 'json', label: 'JSON' },
														{ key: 'docx', label: 'Word' },
													],
													onClick: ({ key })=>exportConversation(activeConversation, key),
												}}
											>
												<Button size="small" type="text" className={styles.chatThreadExportBtn} icon={<XQIcon name="download" />}>导出 ▾</Button>
											</Dropdown>
										</div>
									) : null}
									{visibleMessages.map((item)=>(
										<div
											key={item.id}
											className={[
												styles.messageBubble,
												item.role === 'user' ? styles.messageUser : styles.messageAssistant,
											].join(' ')}
										>
											<div className={styles.messageMetaRow}>
												<div className={styles.messageMeta}>
													{item.role === 'user' ? '你' : 'AI'}
													{item.createdAt ? ` · ${buildTimestampLabel(item.createdAt)}` : ''}
													{item.streamStatus === 'streaming' ? ' · 生成中' : ''}
													{item.streamStatus === 'aborted' ? ' · 已停止' : ''}
												</div>
												<Space size={4}>
													{item.role === 'user' ? (<Tooltip title="编辑该消息并基于此分支"><Button size="small" type="link" onClick={()=>handleEditMessageAndBranch(item)} disabled={sending}>编辑</Button></Tooltip>) : null}
													{item.role === 'user' ? (<Tooltip title="回退到此:先撤销之后 AI 做的写入,再删掉这条及之后的消息,恢复当时的挂载/技法/模型"><Button size="small" type="link" onClick={()=>chatAssist.openRewind(item)} disabled={sending} data-rewind-to={item.id}>回退</Button></Tooltip>) : null}
													<Tooltip title={sending ? '正在生成回复,先停止或等本轮结束再分支' : '从这一轮分支'}>
														{/* 生成中禁用:分支会切会话,此前点了静默掐断正在写的回复 */}
														<Button size="small" type="link" onClick={()=>handleBranchFromMessage(item)} disabled={sending}>分支</Button>
													</Tooltip>
												</Space>
											</div>
											{item.role === 'assistant' && item.reasoning ? (
												<Collapse
													ghost
													className={styles.reasoningCollapse}
													// 流式期间且尚无正文 → 开（让用户看到「思考中…」）；其余状态 → 默认折叠（包含「流完后」自动折）。
													// 给 key 加 streamStatus，确保从 streaming→done 切换时重挂载，触发新的 defaultActiveKey 规则。
													key={`${item.id}-${item.streamStatus || 'done'}`}
													defaultActiveKey={(item.streamStatus === 'streaming' && !item.content) ? ['r'] : []}
												>
													<Collapse.Panel
														key="r"
														header={(item.streamStatus === 'streaming' && !item.content) ? '思考中…' : '思考过程'}
														extra={(
															<Tooltip title="复制思考">
																<Button
																	size="small"
																	type="text"
																	icon={<XQIcon name="copy" />}
																	onClick={(e)=>{
																		e.stopPropagation();
																		copyTextSmart(item.reasoning || '').then((ok)=>{
																			if(ok){ message.success('已复制思考', 1); }
																			else{ message.error('复制失败', 1.5); }
																		});
																	}}
																/>
															</Tooltip>
														)}
													>
														<div style={{ whiteSpace: 'pre-wrap', color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 12, lineHeight: 1.7 }}>{item.reasoning}</div>
													</Collapse.Panel>
												</Collapse>
											) : null}
											{item.role === 'user'
												? <div className={styles.messageText}>{chatAssist.userTurnContent(item)}{Array.isArray(item.images) && item.images.length ? (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: item.content ? 6 : 0 }}>{item.images.map((u, i)=>(<img key={i} src={u} alt="" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 4, border: "1px solid var(--horosa-border, #d9d9d9)" }} />))}</div>) : null}</div>
												: <AssistantMarkdown className={styles.markdownBody} content={item.content} streaming={item.streamStatus === 'streaming'} hasTrace={!!item.agentTrace} />}
											{chatAssist.bestOfCards(item)}
											{chatAssist.reviewNotes(item)}
											{chatAssist.orchestrationPanel(item)}
											{item.role === 'assistant' && item.agentTrace ? (
												<AgentActionBar trace={item.agentTrace} messageId={item.id} streaming={item.streamStatus === 'streaming'} onUndone={()=>setSources(listAnalysisSources())} onTraceChange={async (trace)=>{ const next = { ...item, agentTrace: trace }; setMessages((prev)=>prev.map((m)=>m.id === item.id ? next : m)); try{ await saveConversationMessage(next); }catch(e){ /* 落库失败不阻断 UI */ } }} />
											) : null}
											{item.role === 'assistant' && item.errorInfo ? (
												<Alert
													type={item.errorInfo.category === 'auth' || item.errorInfo.category === 'model' ? 'warning' : 'error'}
													showIcon
													className={styles.messageErrorAlert}
													message={<span>{item.errorInfo.hint}</span>}
													description={<div style={{ fontSize: 11, color: 'var(--horosa-text-soft)', wordBreak: 'break-word' }}>{item.errorInfo.message}</div>}
													action={item.errorInfo.retriable ? (
														<Button size="small" onClick={()=>handleRegenerateMessage(item)} disabled={sending}>重试</Button>
													) : null}
												/>
											) : null}
											{item.role === 'assistant' && item.streamStatus !== 'streaming' && item.content ? (
												<div className={styles.messageActions}>
													<Tooltip title="复制全文">
														<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="copy" />} onClick={()=>handleCopyMessage(item)} />
													</Tooltip>
													<Tooltip title="重新生成">
														<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="sync" />} onClick={()=>handleRegenerateMessage(item)} disabled={sending} />
													</Tooltip>
													<Tooltip title="审阅:优先用另一家模型对照挂载的排盘数据检查这条回答,列出错误/夸大/漏项/无据;批注可一键重写">
														<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="search" />} onClick={()=>chatAssist.review.run(item)} disabled={sending || !!chatAssist.review.busy} />
													</Tooltip>
													{item.usage && (item.usage.input_tokens || item.usage.output_tokens) ? (()=>{
														const u = item.usage;
														// 缓存计量入价:按接口家族分式(anthropic 的 input 不含缓存段、openai 家族已含);无缓存计量=旧公式。
														// 命中占比分母=整个提示词(anthropic 为 input+读+写,openai 家族 input 已含),两家口径同义、不会超过 100%。
														const cacheRead = Number(u.cache_read_input_tokens) || 0;
														const cacheWrite = Number(u.cache_creation_input_tokens) || 0;
														const usageFamily = getProviderProtocolFamily(u.providerType);
														const cost = estimateUsageCost(u.model, u.input_tokens, u.output_tokens, { cacheRead, cacheWrite, family: usageFamily });
														const promptTotal = (Number(u.input_tokens) || 0) + (usageFamily === 'anthropic' ? cacheRead + cacheWrite : 0);
														const cachePct = cacheRead > 0 && promptTotal > 0 ? Math.min(100, Math.round((cacheRead / promptTotal) * 100)) : 0;
														const usageNote = `${cacheRead > 0 ? ` · 缓存 ${cacheRead}(${cachePct}%)` : ''}${Number(u.rounds) > 1 ? ` · ${u.rounds} 轮` : ''}`;
														return (
															<Tooltip title={`输入 ${u.input_tokens || 0} · 输出 ${u.output_tokens || 0}${usageNote}${cost ? ` · 估算 $${cost.cost.toFixed(4)}（价目会漂移）` : ''}`}>
																<span className={styles.messageUsage}>↑ {u.input_tokens || 0} ↓ {u.output_tokens || 0}{cost ? ` · $${cost.cost.toFixed(4)}` : ''}</span>
															</Tooltip>
														);
													})() : null}
												</div>
											) : null}
										</div>
									))}
								</div>
							</div>
							</div>
							<div className={styles.composerDock}>
								<div className={styles.chatThread}>
									{renderContextBanner()}
									{renderComposer()}
								</div>
							</div>
						</React.Fragment>
					)}
				</div>
			</div>
		</div>
	);
}
