// AI 分析主页 · 页内常量与小助手:保存结果提示、页内页签表(含给对话桥的键名表)、一键挂载排除集
// 从 AIAnalysisMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { describeSaveResult } from '../../../utils/aiAnalysisExport';
import { message } from 'antd';
import React from 'react';
import XQIcon from '../../xq-icons';

// 保存结果统一提示(取消 info / 失败 error / 成功 success 带路径)
export function notifySaveResult(r, okText){ const d = describeSaveResult(r, okText); (message[d.type] || message.info)(d.text); }

export const SECONDARY_TABS = [
	{ key: 'analysis', label: '分析', icon: <XQIcon name="ai" /> },
	{ key: 'history', label: '历史', icon: <XQIcon name="calendar" /> },
	{ key: 'materials', label: '资料', icon: <XQIcon name="book" /> },
	{ key: 'templates', label: '模版', icon: <XQIcon name="note" /> },
	{ key: 'settings', label: '设置', icon: <XQIcon name="aiSettings" /> },
	{ key: 'advanced', label: '进阶', icon: <XQIcon name="sliders" /> },
];
// 页内页签表(只取键与名,不带图标):交给对话桥,AI 工具切页签只认这张表
export const SECONDARY_TAB_ITEMS = SECONDARY_TABS.map((t)=>({ key: t.key, label: t.label }));


// 前缀缓存断点标记:单源在 utils/aiPromptAssembly.js(PROMPT_CACHE_BREAKPOINT,与后端 AI 代理内同名常量逐字节一致);
// 本页经 assembleSystemPrompt 拼装,不再自带一份。

// 「一键挂载全部式法」的排除集。奇门遁甲=用户考量(不随一键带入,需手动勾选);
// 黄历/通书=历注而非式法,一键带入只会稀释上下文。抽成常量而非写死在 filter 链里:
// 逐项之间不再靠 && 串联,增删一项不必改表达式,且各构建可按自身式法集裁剪本表。
export const QUICK_MOUNT_EXCLUDED_KEYS = ['qimen', 'huangli', 'tongshu'];
