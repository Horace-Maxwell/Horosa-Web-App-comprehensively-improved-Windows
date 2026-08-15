import React from 'react';
import { getLocalChartsStoreHealth } from '../../utils/localcharts';
import { getLocalCasesStoreHealth } from '../../utils/localcases';

// [S6] 本地储存降级横幅:localRecordStore 写路径发现储存根坏(非 quota 异常/句柄不可得)时
// 降级为内存模式 —— 会话内数据仍可用,但**重启即丢**。此前该状态只有一行 console.warn,
// 用户完全无感(「保存假成功」事故面的 UI 侧)。
//
// 触发:内核每实例每会话至多一次的 'horosa.localRecordStore.degraded' CustomEvent;
// 挂载时补查两店健康态(事件可能早于本组件挂载,ServiceStatusBanner 的 pending 事件同思路)。
// quota(空间不足)不走本横幅 —— 那条路在保存动作上抛错,由既有「保存失败」Modal 就地提示。
// 形制与 ServiceStatusBanner 一致:fixed 顶部居中、wrap 穿透点击、琥珀告警色、可手动关闭。
export default function LocalStoreHealthBanner(){
	const [visible, setVisible] = React.useState(false);

	React.useEffect(()=>{
		if(typeof window === 'undefined'){ return undefined; }
		const handle = ()=>setVisible(true);
		window.addEventListener('horosa.localRecordStore.degraded', handle);
		// 挂载补查:事件先于挂载时不丢状态
		try{
			const a = getLocalChartsStoreHealth();
			const b = getLocalCasesStoreHealth();
			if((a && a.mode === 'memory') || (b && b.mode === 'memory')){
				setVisible(true);
			}
		}catch(e){ /* 健康态查询失败不阻断渲染 */ }
		return ()=>{
			window.removeEventListener('horosa.localRecordStore.degraded', handle);
		};
	}, []);

	if(!visible){ return null; }

	const wrapStyle = {
		position: 'fixed', top: 0, left: 0, right: 0,
		zIndex: 2001,
		display: 'flex', justifyContent: 'center',
		pointerEvents: 'none',
	};
	const barStyle = {
		marginTop: 44,
		maxWidth: '96%',
		padding: '8px 14px',
		borderRadius: 8,
		fontSize: 13,
		lineHeight: 1.4,
		color: '#7a4f01',
		background: 'rgba(255, 244, 222, 0.97)',
		border: '1px solid rgba(214, 158, 46, 0.55)',
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
		border: '1px solid rgba(214, 158, 46, 0.7)',
		background: 'rgba(255, 255, 255, 0.7)',
		color: '#7a4f01',
	};

	return (
		<div style={wrapStyle} aria-live="polite">
			<div style={barStyle}>
				<span>💾⚠️ 本地储存暂不可用：最新保存的命盘/事盘仅暂存于内存，<b>重启后将丢失</b>。请立即在「星盘列表 / 起课列表」导出 JSON 备份。</span>
				<button type="button" onClick={()=>setVisible(false)} style={btnStyle}>知道了</button>
			</div>
		</div>
	);
}
