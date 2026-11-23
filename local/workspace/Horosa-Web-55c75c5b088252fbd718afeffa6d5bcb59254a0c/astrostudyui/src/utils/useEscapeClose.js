// 自绘弹层(点遮罩关闭的那种 / 择日概览浮窗)的键盘关闭:按 Esc 关「最上面那一层」。
// 层栈:每个开着的自绘弹层登记一层,后开的在栈顶;Esc 在捕获阶段(window,先于 React 与 antd 的监听)只交给栈顶那层,
// 交出去就 stopPropagation —— 包着它的 antd Modal(如择日工作台)不会跟着整台关掉(此前冒泡阶段监听、不拦截,
// 按 Esc 想关日卡 / 概览浮窗,工作台一起关了)。栈空时不拦,Esc 照常给 antd 弹窗。输入法组字中的 Esc 不算(那是取消组字)。
import { useEffect, useRef } from 'react';

const layers = [];
let installed = false;

function onKeyDown(e){
	// 组字中:isComposing;系统内核在结束组字的那一下按键上 isComposing 已是 false、keyCode 是 229,两条一起判
	if(e.key !== 'Escape' || e.isComposing || e.keyCode === 229 || e.defaultPrevented){ return; }
	const top = layers[layers.length - 1];
	if(!top || typeof top.ref.current !== 'function'){ return; }
	e.preventDefault();
	e.stopPropagation();
	if(typeof e.stopImmediatePropagation === 'function'){ e.stopImmediatePropagation(); }
	top.ref.current(e);
}

export function useEscapeClose(onClose, active = true){
	const ref = useRef(onClose);
	ref.current = onClose;
	useEffect(()=>{
		if(!active || typeof window === 'undefined'){ return undefined; }
		if(!installed){ window.addEventListener('keydown', onKeyDown, true); installed = true; }
		const entry = { ref };
		layers.push(entry);
		return ()=>{
			const i = layers.indexOf(entry);
			if(i >= 0){ layers.splice(i, 1); }
		};
	}, [active]);
}

// 测试用:当前登记的层数
export function __escapeLayerCountForTests(){ return layers.length; }
