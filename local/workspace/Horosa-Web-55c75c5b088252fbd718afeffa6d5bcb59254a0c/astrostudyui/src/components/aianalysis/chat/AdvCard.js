// 「进阶」页的卡片外壳与行组件(单一视觉来源):所有高级能力设置卡共用同一套头部(图标格/标题/状态胶囊/说明/动作)
// 与正文节奏;卡片自身只放内容。data-* 与 style 等透传到根节点(测试与 自动化驱动器按 data-* 定位)。
// [批四] 新增:id(分区锚,导轨/胶囊跳转目标)· tone="danger"(危险区外观)· reset(头部统一「恢复默认」动作,缺省态隐藏)
//        · toolbar(头与正文之间的工具条)· AdvStatus tone=warn|danger · AdvSubHead(折叠面板头:标题/说明/状态/计数,自带分区锚)。
import React from 'react';
import { Switch, Button } from 'antd';
import XQIcon from '../../xq-icons';
import styles from './advanced.less';

// 分区锚 id(导轨、胶囊、折叠头共用;自动化/视觉脚本按 [id]/[data-adv-section] 定位)
export const ADV_SECTION_IDS = {
	context: 'adv-context',
	bestof: 'adv-bestof',
	routes: 'adv-routes',
	persona: 'adv-persona',
	skills: 'adv-skills',
	agent: 'adv-agent',
	agentMcp: 'adv-agent-mcp',
	agentServers: 'adv-agent-servers',
	agentWeb: 'adv-agent-web',
	agentRules: 'adv-agent-rules',
	agentLedger: 'adv-agent-ledger',
};

export function AdvStatus({ on, tone, children, ...rest }){
	const cls = [styles.status, on ? styles.statusOn : '', tone === 'good' ? styles.statusGood : '', tone === 'warn' ? styles.statusWarn : '', tone === 'danger' ? styles.statusDanger : ''].filter(Boolean).join(' ');
	return <span className={cls} {...rest}>{children}</span>;
}

export function AdvCard({ icon, title, status, desc, actions, span2, tone, id, reset, toolbar, className, headClassName, children, ...rest }){
	const cls = [styles.card, span2 ? styles.span2 : '', tone === 'danger' ? styles.cardDanger : '', className || ''].filter(Boolean).join(' ');
	const resetBtn = reset && reset.visible !== false
		? <Button size="small" type="text" className={styles.resetBtn} data-adv-reset="1" onClick={reset.onClick}>{reset.label || '恢复默认'}</Button>
		: null;
	return (
		<section className={cls} id={id || undefined} data-adv-section={id || undefined} {...rest}>
			<div className={[styles.cardHead, headClassName || ''].filter(Boolean).join(' ')}>
				{icon ? <div className={styles.iconTile}><XQIcon name={icon} /></div> : null}
				<div className={styles.headText}>
					<div className={styles.title}>{title}{status}</div>
					{desc ? <div className={styles.desc}>{desc}</div> : null}
				</div>
				{actions || resetBtn ? <div className={styles.headActions}>{actions}{resetBtn}</div> : null}
			</div>
			{toolbar ? <div className={styles.cardToolbar}>{toolbar}</div> : null}
			<div className={styles.body}>{children}</div>
		</section>
	);
}

// 标签 / 控件 / 说明 三段一行;说明另起一行贴在控件下方(窄屏不挤成一坨)。
export function AdvRow({ label, help, title, children }){
	return (
		<div className={styles.row}>
			<span className={styles.rowLabel} title={title || help || undefined}>{label}</span>
			<div className={styles.rowControl}>{children}</div>
			{help ? <div className={styles.rowHelp}>{help}</div> : null}
		</div>
	);
}

// 一个功能一行:标题 + 说明 + 右侧开关。开关元素由调用方以 control 传入(data-* 锚点字面留在调用方源码里,哨兵与驱动器按它定位);
// 不传 control 时退回内置开关(switchProps 透传)。children 落在说明之下(路径输入框、按钮组等)。
export function AdvSwitchRow({ title, desc, checked, onChange, switchProps, control, children }){
	return (
		<div className={[styles.switchRow, checked ? styles.switchRowOn : ''].filter(Boolean).join(' ')}>
			<div className={styles.switchText}>
				<div className={styles.switchTitle}>{title}</div>
				{desc ? <div className={styles.switchDesc}>{desc}</div> : null}
				{children}
			</div>
			{control || <Switch checked={!!checked} onChange={onChange} checkedChildren="开" unCheckedChildren="关" {...(switchProps || {})} />}
		</div>
	);
}

// 折叠面板头(行动能力卡的五个子面板):标题 + 一句说明 + 右侧状态胶囊/计数;自带分区锚(导轨滚动定位到头部而非正文)。
export function AdvSubHead({ id, title, desc, status, count }){
	return (
		<div className={styles.subHead} id={id || undefined} data-adv-section={id || undefined}>
			<div className={styles.subHeadText}>
				<span className={styles.subTitle}>{title}</span>
				{desc ? <span className={styles.subDesc}>{desc}</span> : null}
			</div>
			<span className={styles.subHeadMeta}>
				{count !== null && count !== undefined ? <span className={styles.subCount}>{count}</span> : null}
				{status || null}
			</span>
		</div>
	);
}

export { styles as advStyles };
