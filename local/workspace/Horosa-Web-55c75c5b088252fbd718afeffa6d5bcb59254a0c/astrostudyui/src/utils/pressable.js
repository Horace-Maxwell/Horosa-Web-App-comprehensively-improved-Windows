// 让 div / span / li … 这类非按钮元素也能用键盘操作:Tab 聚焦、回车 / 空格触发,读屏念「按钮」。
// 用法:<div className="x" {...pressable(onPick)}>…</div>(代替只挂 onClick;可维护性棘轮 kbUnreachable 看守)。
//
// 三条行为约定:
//   ① 鼠标点完不留焦点 —— 与 WebKit 原生按钮一致(macOS 上点按钮不会把焦点留在按钮上)。否则点过它之后按空格会
//      再触发它一次,页面自己的空格 / 方向键快捷键(天文馆播放等)就被它截走。键盘触发的(回车 / 空格)保留焦点。
//   ② 按键只认焦点在它自己身上的:里面嵌的输入框、下拉打字照常,不会被当成「按下了这个块」。
//   ③ 没有处理函数(条件挂载 onClick={cond ? fn : undefined})就什么都不加:块保持不可聚焦,不平白多一个 Tab 停靠点。
//
// opts:role(缺省 'button';元素自己写了 role 时传 false,别覆盖它)· tabIndex(传 false 不加,元素自己管)· disabled
export function pressable(handler, opts = {}){
	if(typeof handler !== 'function'){ return {}; }
	const role = opts.role === undefined ? 'button' : opts.role;
	const disabled = !!opts.disabled;
	const props = {
		onClick: (e)=>{
			if(disabled){ return undefined; }
			// detail > 0 = 鼠标 / 触控点出来的;键盘触发的 click detail 为 0
			const el = e && e.currentTarget;
			if(e && e.detail > 0 && el && typeof el.blur === 'function' && typeof document !== 'undefined' && document.activeElement === el){ el.blur(); }
			return handler(e);
		},
		onKeyDown: (e)=>{
			if(disabled || !e || e.target !== e.currentTarget){ return; }
			if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
				e.preventDefault();   // 空格别把外层滚动容器往下翻
				handler(e);
			}
		},
	};
	if(role){ props.role = role; }
	if(opts.tabIndex !== false){ props.tabIndex = disabled ? -1 : 0; }
	if(disabled){ props['aria-disabled'] = true; }
	return props;
}
