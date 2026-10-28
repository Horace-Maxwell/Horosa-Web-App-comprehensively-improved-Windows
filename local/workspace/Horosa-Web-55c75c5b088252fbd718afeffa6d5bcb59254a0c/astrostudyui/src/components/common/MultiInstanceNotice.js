import React from 'react';
import { isDesktopBridgeAvailable } from '../../utils/aiAnalysisDesktop';

// 多实例数据独立提示。
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

// 主实例只认首选口:阶梯外的随机兜底口(阶梯全被占 / 绑定竞态)同样是独立实例 —— 影子副本、自动备份只归主实例,
// 否则随机口实例会把自己的数据镜像进主实例的影子文件
export function isPrimaryInstancePort(port){
	const p = parseInt(port, 10);
	return Number.isFinite(p) && p === PREFERRED_PORT;
}

// 提示判据:阶梯后继口一律提示;桌面版里阶梯外的随机口也提示(浏览器开发端口不在桌面里,不提示)
export function isIndependentInstance(port, desktop){
	if(isSecondaryInstancePort(port)){ return true; }
	return !!desktop && `${port || ''}` !== '' && !isPrimaryInstancePort(port);
}

// 壳层告诉页面的实例身份(初始化脚本写 window.__HOROSA_INSTANCE_ROLE__ = 'primary' | 'independent'):
// 有它就以它为准 —— 首选口被别的程序长期占着时,唯一开着的那个实例落在后继口,按端口推断会被当成独立实例,
// 影子副本与自动备份全停、还提示一个并不存在的「主窗口」。没有它(旧版壳 / 浏览器)才按端口推断。
export function shellInstanceRole(){
	try{
		const v = typeof window !== 'undefined' ? window.__HOROSA_INSTANCE_ROLE__ : undefined;
		if(v === 'primary'){ return 'primary'; }
		if(v === 'independent' || v === 'secondary'){ return 'independent'; }
	}catch(e){ /* 读不到:按端口推断 */ }
	return null;
}

// 本窗口是不是独立实例(影子副本、自动备份、本提示共用一个判据)。port 缺省取本窗口的端口
export function currentWindowIsIndependent(desktop, port){
	const role = shellInstanceRole();
	if(role){ return role === 'independent'; }
	const p = port !== undefined ? port : (typeof window !== 'undefined' && window.location ? window.location.port : '');
	return isIndependentInstance(p, desktop);
}

export default function MultiInstanceNotice(props){
	const [dismissed, setDismissed] = React.useState(false);
	const desktop = props.desktop !== undefined ? props.desktop : isDesktopBridgeAvailable();
	const independent = props.port !== undefined ? isIndependentInstance(props.port, desktop) : currentWindowIsIndependent(desktop);
	if(dismissed || !independent){
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
				<span>ℹ️ 当前窗口运行在独立实例上：本窗口的命盘/事盘等本地数据与主窗口<b>相互独立、互不可见</b>。如需共用数据，请在主窗口操作，或用「全量备份/恢复」搬运。本窗口不做自动备份，也不写影子副本，在这里存的数据请记得手动导出。</span>
				<button type="button" onClick={()=>setDismissed(true)} style={btnStyle}>知道了</button>
			</div>
		</div>
	);
}
