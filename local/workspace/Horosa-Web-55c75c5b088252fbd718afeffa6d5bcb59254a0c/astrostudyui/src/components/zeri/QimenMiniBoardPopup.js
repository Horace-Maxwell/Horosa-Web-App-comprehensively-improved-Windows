// [奇门择日] 结果行「概览」浮窗:可拖拽(标题栏)/可缩放(右下角),fixed 于视口,不关结果表——
// 交互逐字对齐天星 MiniChartPopup(ConditionBuilderModal.js:69)。内容 = DunJiaBoard 迷你盘,
// 盘面用与扫描同源的本地引擎速览(角标注明);pick 起盘后的主盘才走 DunJiaMain 标准显示路由。
import { useState, useMemo } from 'react';
import DunJiaBoard from '../dunjia/DunJiaBoard';
import { computeQimenScanPan } from '../../divination/zeri/qimenScanEngine';

const BOARD_BASE_W = 662;
const BOARD_BASE_H = 870;

export default function QimenMiniBoardPopup({ row, geoParams, options, seeds, onClose }){
	const [box, setBox] = useState({ x: 110, y: 40, w: 720, h: 780 });
	const pan = useMemo(()=>{
		try{
			const text = `${row && row.pick ? row.pick : ''}`;
			const m = /^(\d{1,4}-\d{2}-\d{2})[ ](\d{2}:\d{2})/.exec(text);
			if(!m){
				return null;
			}
			return computeQimenScanPan(geoParams, options, seeds || {}, m[1], `${m[2]}:00`);
		}catch(e){
			return null;
		}
	}, [row && row.pick, JSON.stringify(options || {})]);
	const dragFrom = (e, mode)=>{
		e.preventDefault();
		e.stopPropagation();
		const start = { mx: e.clientX, my: e.clientY, ...box };
		const move = (ev)=>{
			const dx = ev.clientX - start.mx;
			const dy = ev.clientY - start.my;
			if(mode === 'drag'){
				setBox((b)=>({ ...b, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) }));
			}else{
				setBox((b)=>({ ...b, w: Math.max(380, start.w + dx), h: Math.max(420, start.h + dy) }));
			}
		};
		const up = ()=>{
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	};
	// 缩放:随浮窗尺寸取宽高最小适配,夹在 DunJiaBoard 官方档位(0.58~1.18,基线 662×870)。
	const boardScale = Math.max(0.58, Math.min(1.18, Math.min((box.w - 24) / BOARD_BASE_W, (box.h - 64) / BOARD_BASE_H)));
	return (
		<div style={{
			position: 'fixed', left: box.x, top: box.y, width: box.w, height: box.h,
			zIndex: 2100, background: 'var(--horosa-astro-panel, #fff)', borderRadius: 10,
			border: '1px solid rgba(148,163,184,.45)', boxShadow: '0 12px 40px rgba(0,0,0,.28)',
			display: 'flex', flexDirection: 'column', overflow: 'hidden',
		}}>
			<div onMouseDown={(e)=>dragFrom(e, 'drag')}
				style={{ cursor: 'move', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(148,163,184,.25)', userSelect: 'none' }}>
				<span style={{ fontWeight: 600, fontSize: 13 }}>概览 · {row ? row.start : ''}</span>
				<span style={{ fontSize: 11, opacity: 0.55 }}>{pan ? pan.juText : ''} · 速览(本地排盘,与扫描同源)</span>
				<span style={{ flex: 1 }} />
				<span onMouseDown={(e)=>e.stopPropagation()} onClick={onClose}
					style={{ cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.65, padding: '0 4px' }}>×</span>
			</div>
			{/* 浮窗挂 body 门户,壳作用域样式(图例胶囊等)靠本类补挂——app.less 图例规则并列含此作用域 */}
			<div className="horosa-qimen-mini-board" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
				{pan ? (
					<DunJiaBoard pan={pan} boardScale={boardScale} />
				) : (
					<div style={{ padding: 20, opacity: 0.6, fontSize: 12 }}>排盘失败</div>
				)}
			</div>
			<div onMouseDown={(e)=>dragFrom(e, 'resize')}
				style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize',
					background: 'linear-gradient(135deg, transparent 50%, rgba(148,163,184,.6) 50%)' }} />
		</div>
	);
}
