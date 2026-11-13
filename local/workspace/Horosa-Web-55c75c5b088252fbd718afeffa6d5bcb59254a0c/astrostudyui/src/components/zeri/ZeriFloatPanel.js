// 择日各概览浮窗(盘概览 / 奇门速览 / 天星条件预览)共用的外壳:可拖的题头 + 右下角缩放把手 + 关闭钮。
// 外观只此一处(样式类 horosa-zeri-float*,亮暗两套随主题变量走);各浮窗只管自己的默认尺寸、题头文字与盘面。
// 原地渲染在工作台弹窗里,不挂到 body:工作台开着切走子页时这棵树会被冻结,挂出去的浮层收不到关闭。
import React, { useState } from 'react';
import { clientToFixed } from '../../utils/zoomDomain';
import { getLayoutViewportWidth, getLayoutViewportHeight } from '../../utils/shellZoom';
import XQIcon from '../xq-icons';

export function ZeriFloatClose({ onClose }){
	return (
		<button type="button" className="horosa-zeri-float-close" aria-label="关闭" title="关闭"
			onMouseDown={(e)=>e.stopPropagation()} onClick={onClose}>
			<XQIcon name="close" />
		</button>
	);
}

// 默认框夹进当前布局视口:小窗 / 放大档下默认尺寸会比窗口还高,底边与缩放把手落到窗外够不着。
// 夹屏只在这一处做(各浮窗给的是「理想尺寸」);夹完仍不小于各自的最小尺寸时才算数,否则保最小尺寸、贴左上。
export function fitFloatBox(raw, minW, minH, vw, vh){
	const b = raw || {};
	const pad = 12;
	const okW = Number.isFinite(vw) && vw > 0;
	const okH = Number.isFinite(vh) && vh > 0;
	const w = okW ? Math.max(minW, Math.min(Number(b.w) || minW, vw - pad * 2)) : (Number(b.w) || minW);
	const h = okH ? Math.max(minH, Math.min(Number(b.h) || minH, vh - pad * 2)) : (Number(b.h) || minH);
	const x = okW ? Math.max(0, Math.min(Number(b.x) || 0, vw - pad - w)) : (Number(b.x) || 0);
	const y = okH ? Math.max(0, Math.min(Number(b.y) || 0, vh - pad - h)) : (Number(b.y) || 0);
	return { x, y, w, h };
}

export default function ZeriFloatPanel({ title, sub, initialBox, minW = 380, minH = 320, onClose, bodyClassName = '', bodyStyle, children }){
	const [box, setBox] = useState(()=>{
		const raw = typeof initialBox === 'function' ? initialBox() : initialBox;
		const hasWin = typeof window !== 'undefined';
		return fitFloatBox(raw, minW, minH, hasWin ? getLayoutViewportWidth() : 0, hasWin ? getLayoutViewportHeight() : 0);
	});
	const dragFrom = (e, mode)=>{
		e.preventDefault();
		e.stopPropagation();
		const start = { mx: e.clientX, my: e.clientY, ...box };
		const move = (ev)=>{
			// 鼠标位移是视觉域,窗体 x/y/w/h 是 CSS(布局域):换域后窗体才与鼠标同步(缩放档下否则窗体比鼠标快 / 慢 z 倍);z=1 恒等。
			const dx = clientToFixed(ev.clientX - start.mx);
			const dy = clientToFixed(ev.clientY - start.my);
			if(mode === 'drag'){
				setBox((b)=>({ ...b, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) }));
			}else{
				setBox((b)=>({ ...b, w: Math.max(minW, start.w + dx), h: Math.max(minH, start.h + dy) }));
			}
		};
		const up = ()=>{
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	};
	return (
		<div className="horosa-zeri-float" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
			<div className="horosa-zeri-float-head is-draggable" onMouseDown={(e)=>dragFrom(e, 'drag')}>
				<span className="horosa-zeri-float-title">{title}</span>
				{sub ? <span className="horosa-zeri-float-sub">{sub}</span> : null}
				<span className="horosa-zeri-float-gap" />
				<ZeriFloatClose onClose={onClose} />
			</div>
			<div className={`horosa-zeri-float-body ${bodyClassName}`.trim()} style={bodyStyle}>
				{typeof children === 'function' ? children(box) : children}
			</div>
			<div className="horosa-zeri-float-grip" onMouseDown={(e)=>dragFrom(e, 'resize')} />
		</div>
	);
}
