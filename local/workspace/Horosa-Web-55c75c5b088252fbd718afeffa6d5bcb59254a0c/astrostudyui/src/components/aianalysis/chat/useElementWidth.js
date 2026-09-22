// 量一个元素的内容宽(CSS px):ResizeObserver 驱动,返回 null 表示「没量到」(无 RO 的环境 / 元素在隐藏页签里宽 0)。
// 纪律:app.less 已因 Tahoe 浮层事故禁用 container-type,页面级「按容器宽换版式」只能这样量;阈值判断放在调用方。
// 隐藏页签(display:none)的孪生节点会回报 0 → 一律忽略,保留上一次有效读数(或 null 交 @media 兜底)。
import React from 'react';

export default function useElementWidth(ref){
	const [width, setWidth] = React.useState(null);
	React.useEffect(()=>{
		const el = ref && ref.current;
		if(!el || typeof ResizeObserver === 'undefined'){ return undefined; }
		let last = null;
		const ro = new ResizeObserver((entries)=>{
			const e = entries && entries[0];
			const w = e && e.contentRect ? e.contentRect.width : (el.clientWidth || 0);
			if(!(w >= 1)){ return; }
			const r = Math.round(w);
			if(r !== last){ last = r; setWidth(r); }
		});
		try{ ro.observe(el); }catch(e){ return undefined; }
		return ()=>{ try{ ro.disconnect(); }catch(e){ /* noop */ } };
	}, [ref]);
	return width;
}
