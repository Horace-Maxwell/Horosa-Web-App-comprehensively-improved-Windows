// AI 分析主页 · 助手消息的 Markdown 渲染小组件。
// 只被 components/aianalysis/AIAnalysisMain.js 引用。
import React from 'react';
import { closeStreamingInlineMd } from '../../../utils/reportMarkdownNormalize';
import { stripActionBlockForDisplay } from '../../../utils/aiAgent/textProtocol';
import { renderRichMarkdownToHtml as renderMarkdownToHtml } from '../../../utils/aiMarkdownRender';

// [流式渲染合帧·B] 单条助手正文的 markdown 渲染按 (content, streaming, hasTrace) 记忆化:消息列表任一状态变化
// (某条气泡流式中/审批 tick/trace 更新)不再让全部历史气泡逐条重解析 markdown——长会话下这是主线程被打满的乘数项。
export const AssistantMarkdown = React.memo(function AssistantMarkdown({ content, streaming, hasTrace, className }){
	const html = React.useMemo(
		()=>renderMarkdownToHtml(streaming ? closeStreamingInlineMd(content) : (hasTrace ? stripActionBlockForDisplay(content) : content)),
		[content, streaming, hasTrace],
	);
	return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
