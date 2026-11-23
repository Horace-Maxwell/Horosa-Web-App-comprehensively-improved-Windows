// 系统提示条统一件(服务中断 / 多实例 / 本地存储等)。
// 整站只有一个宿主 SystemNoticeHost(layouts/app.js):几条提示在里面自上而下排成一列(有间距、绝不互叠),位置在页头下方;
// 宿主层级低于弹窗遮罩 —— 弹窗 / 抽屉打开时提示条让到遮罩下面,不压弹窗标题与关闭钮。
// 外观只吃主题变量(亮 / 暗 / 经典白自动跟);信息 / 警告两种语气只差左侧那根直的色条(信息 = 主题金,警告 = 警示色)。
import React from 'react';
import './SystemNotice.less';

// 自上而下的次序:服务中断 → 本地存储异常 → 多实例(layer 名沿用旧接口)
const ORDER = { notice: 1, over: 2, under: 3 };
const HostContext = React.createContext(false);

export function SystemNoticeHost({ children }){
	return (
		<div className="horosa-notice-host" role="region" aria-label="系统提示">
			<HostContext.Provider value>{children}</HostContext.Provider>
		</div>
	);
}

// layer:notice(服务中断)/ over(本地存储异常)/ under(多实例)—— 只决定在宿主里的上下次序;
// stack:多条消息竖排(每条一行 SystemNoticeRow)。不在宿主里(单独渲染,如测试)时自带一层固定定位的外壳
export function SystemNotice({ tone = 'info', layer = 'notice', stack = false, children }){
	const inHost = React.useContext(HostContext);
	const bar = (
		<div
			className={`horosa-notice-bar is-${tone === 'warn' ? 'warn' : 'info'}${stack ? ' is-stack' : ''}`}
			style={{ order: ORDER[layer] || 1 }}
			role={tone === 'warn' ? 'alert' : 'status'}
		>
			<span className="horosa-notice-mark" aria-hidden="true" />
			<div className="horosa-notice-body">{stack ? children : <div className="horosa-notice-row">{children}</div>}</div>
		</div>
	);
	return inHost ? bar : <div className="horosa-notice-host is-standalone">{bar}</div>;
}

// 提示条里的一行:正文在前占满剩余宽,按钮成组靠右(换行时整组落到下一行右侧,不会单个掉到左端)
export function SystemNoticeRow({ children }){
	return <div className="horosa-notice-row">{children}</div>;
}

// 正文段(可选包一层:旧调用直接写 <span>,样式里两种都认)
export function SystemNoticeText({ children }){
	return <span className="horosa-notice-text">{children}</span>;
}

export function SystemNoticeButton({ children, ...rest }){
	return <button type="button" className="horosa-notice-btn" {...rest}>{children}</button>;
}
