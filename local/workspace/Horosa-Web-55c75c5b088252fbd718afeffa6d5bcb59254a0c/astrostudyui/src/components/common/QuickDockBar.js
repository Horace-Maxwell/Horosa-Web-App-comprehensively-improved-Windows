import React from 'react';
import { Dropdown } from 'antd';
import XQIcon from '../xq-icons';
import { preloadNavByKey } from '../../utils/navPreload';

// 快捷功能栏(全站共享)。动词栏纪律:
// · 页面上已可见的控件(页头的 AI 导出/帮助/新建与命例保存、左/中栏既有开关)一律
//   不得进栏——本栏只放「本页别处没有」的高价值动作;
// · 本栏只放动词不放信息:速查/明细类内容必须常驻右栏 tab(信息不得仅在快捷栏可见),
//   故本组件不提供信息弹层能力,「更多」仅收纳溢出的动词;
// · 恒序肌肉记忆:主键(可组)→ 专属动词(≤4,超出自动折入「更多」)→ 保存(仅卜类
//   事例;命例保存页头已有)→ AI 分析;渲染总数 ≤8;
// · 无盘态(hasResult=false)专属/保存禁用,主键与 AI 恒可用;active 高亮沿用既有类名;
// · 契约由 quickDockContract.test 守护(键数上限/必含 ai/禁复现清单),改动请连测试一起改。
const MAX_INLINE_EXTRAS = 4;

function DockButton({ item }){
	return (
		<button
			type="button"
			key={item.key}
			className={`horosa-bottom-quick-button${item.active ? ' is-active' : ''}`}
			onClick={item.onClick}
			// [R3-D1] 跨页动词通用悬停预载:声明 navKey 的项悬停即预载目标 chunk(显式 onHover 优先)
			onMouseEnter={item.onHover || (item.navKey ? ()=>preloadNavByKey(item.navKey) : undefined)}
			disabled={!!item.disabled}
			title={item.title || item.label}
		>
			<span className="horosa-bottom-quick-icon"><XQIcon name={item.icon} /></span>
			<span>{item.label}</span>
		</button>
	);
}

export default function QuickDockBar(props){
	const {
		page,
		className = '',
		title = '快捷功能',
		hasResult = true,
		primary,
		extras = [],
		save,
		ai = true,
		dispatch,
	} = props;

	const primaries = (Array.isArray(primary) ? primary : (primary ? [primary] : []))
		.map((p, idx)=>({ icon: 'quickPrimary', key: p.key || `primary_${idx}`, ...p }));
	const extraItems = extras
		.filter(Boolean)
		.map((x, idx)=>({
			icon: 'quickNote',
			key: x.key || `extra_${idx}`,
			...x,
			disabled: x.disabled !== undefined ? x.disabled : (x.needsResult === false ? false : !hasResult),
		}));
	// 溢出语义:≤4 全部行内;>4 时「更多」占用第 4 槽(行内收 3),总渲染数恒 ≤8
	const inlineCount = extraItems.length > MAX_INLINE_EXTRAS ? MAX_INLINE_EXTRAS - 1 : MAX_INLINE_EXTRAS;
	const inlineExtras = extraItems.slice(0, inlineCount);
	const overflowExtras = extraItems.slice(inlineCount);

	const tail = [];
	if(save){
		tail.push({ key: 'save', label: '保存', icon: 'quickNote', onClick: save, disabled: !hasResult });
	}
	if(ai){
		const onAi = typeof ai === 'function'
			? ai
			: ()=>{ if(dispatch){ dispatch({ type: 'astro/save', payload: { currentTab: 'aianalysis' } }); } };
		// WS-N3:悬停即预载 AI 分析 chunk(点击跳转时模块已就绪,零 Spin)
		tail.push({ key: 'ai', label: 'AI助手', icon: 'quickAi', onClick: onAi, onHover: ()=>preloadNavByKey('aianalysis') });
	}

	const renderDropdown = (key, label, icon, menuItems, disabled)=>(
		<Dropdown
			key={key}
			disabled={!!disabled}
			trigger={['click']}
			menu={{
				items: menuItems.map((it, idx)=>({ key: it.key || `${key}_${idx}`, label: it.label, disabled: !!it.disabled })),
				onClick: ({ key: k })=>{
					const hit = menuItems.find((it, idx)=>(it.key || `${key}_${idx}`) === k);
					if(hit && hit.onClick && !hit.disabled){ hit.onClick(); }
				},
			}}
		>
			<button type="button" className="horosa-bottom-quick-button" disabled={!!disabled}>
				<span className="horosa-bottom-quick-icon"><XQIcon name={icon} /></span>
				<span>{label}</span>
			</button>
		</Dropdown>
	);

	return (
		<div className={`horosa-bottom-quick-dock ${className}`} data-quickdock-page={page}>
			<div className="horosa-bottom-quick-title">{title} <XQIcon name="ai" /></div>
			<div className="horosa-bottom-quick-actions">
				{primaries.map((item)=><DockButton key={item.key} item={item} />)}
				{inlineExtras.map((item)=><DockButton key={item.key} item={item} />)}
				{overflowExtras.length > 0 && renderDropdown('more', '更多', 'quickNote', overflowExtras, overflowExtras.every((it)=>it.disabled))}
				{tail.map((item)=><DockButton key={item.key} item={item} />)}
			</div>
		</div>
	);
}
