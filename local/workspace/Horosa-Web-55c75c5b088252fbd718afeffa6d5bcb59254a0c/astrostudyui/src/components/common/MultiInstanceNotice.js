import React from 'react';

// [R3] 多实例数据独立提示。
// 桌面壳端口防漂移阶梯(首选口..首选口+8)给第二/第三实例稳定分配后继端口,而
// localStorage/IndexedDB 按 origin(含端口)分域 → 每个实例是独立数据库。用户多开后
// 「命盘不见了」是架构预期而非数据丢失,但此前无任何 UI 告知,极易误判成丢档。
// 检测本窗口端口落在阶梯的非首选位即提示一次(可关);不做单实例锁 —— 壳侧端口阶梯
// 注释实证项目刻意支持多实例。
const PREFERRED_PORT = 38991;
const LADDER_SPAN = 8;

export function isSecondaryInstancePort(port){
	const p = parseInt(port, 10);
	if(!Number.isFinite(p)){
		return false;
	}
	return p > PREFERRED_PORT && p <= PREFERRED_PORT + LADDER_SPAN;
}

export default function MultiInstanceNotice(props){
	const [dismissed, setDismissed] = React.useState(false);
	const port = props.port !== undefined ? props.port : (typeof window !== 'undefined' && window.location ? window.location.port : '');
	if(dismissed || !isSecondaryInstancePort(port)){
		return null;
	}
	const wrapStyle = {
		position: 'fixed', top: 0, left: 0, right: 0,
		zIndex: 1999,
		display: 'flex', justifyContent: 'center',
		pointerEvents: 'none',
	};
	const barStyle = {
		marginTop: 80,
		maxWidth: '96%',
		padding: '8px 14px',
		borderRadius: 8,
		fontSize: 13,
		lineHeight: 1.4,
		color: '#1d4e78',
		background: 'rgba(230, 242, 252, 0.97)',
		border: '1px solid rgba(84, 141, 191, 0.55)',
		boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
		pointerEvents: 'auto',
		display: 'flex',
		gap: 12,
		alignItems: 'center',
		flexWrap: 'wrap',
		cursor: 'default',
	};
	const btnStyle = {
		padding: '3px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
		border: '1px solid rgba(84, 141, 191, 0.7)',
		background: 'rgba(255, 255, 255, 0.7)',
		color: '#1d4e78',
	};
	return (
		<div style={wrapStyle} aria-live="polite">
			<div style={barStyle}>
				<span>ℹ️ 当前窗口运行在独立实例上：本窗口的命盘/事盘等本地数据与主窗口<b>相互独立、互不可见</b>。如需共用数据，请在主窗口操作，或用「全量备份/恢复」搬运。</span>
				<button type="button" onClick={()=>setDismissed(true)} style={btnStyle}>知道了</button>
			</div>
		</div>
	);
}
