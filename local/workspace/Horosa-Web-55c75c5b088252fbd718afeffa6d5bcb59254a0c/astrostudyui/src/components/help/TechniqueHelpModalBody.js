// 帮助弹窗正文(各技法操作手册):页眉的「操作手册」弹窗打开时才懒加载本件 ——
// 手册注册表连带三十多本手册(数 MB 源码),放在页眉里静态引用会整包进首屏。
// 一页一本手册(HelpBook):左栏本页全部技法、右栏当前技法;书按当前子页签 / 当前技法停到对应章。
// 没有书形态的老手册与「本页暂无手册」的默认说明放在可滚的正文框里。
import React from 'react';
import { getTechniqueHelpDoc, currentHostTechnique } from './techniqueHelpRegistry';

export default function TechniqueHelpModalBody(props){
	const HelpDoc = getTechniqueHelpDoc(props.currentTab, props.currentSubTab, currentHostTechnique(props.currentTab));
	if(HelpDoc && HelpDoc.book){
		const ctx = { currentTab: props.currentTab, currentSubTab: props.currentSubTab, hostTechnique: currentHostTechnique(props.currentTab) };
		return <HelpDoc ctx={ctx} compact={!!props.compact} />;
	}
	return (
		<div className={props.bodyClassName} style={{ maxHeight: 'calc(74 * var(--horosa-lvh, 1vh))', overflowY: 'auto' }}>
			{HelpDoc ? <HelpDoc /> : (
				<>
					<p>左侧为排盘输入与显示设置，中间为盘面绘制，右侧分页查看信息、相位、行星与判读。</p>
					<p>底部快捷功能跳转到对应技法或抽屉；切换任一设置即时全组合重算。</p>
				</>
			)}
		</div>
	);
}
