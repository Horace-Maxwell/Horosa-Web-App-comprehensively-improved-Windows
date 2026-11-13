// 天文馆 · 空格键「暂停 / 恢复」的接管判定(只看 DOM,不碰场景)。
//
// 接管 = 这一下空格归天文馆;不接管 = 留给焦点所在的控件。
// 桌面壳里焦点的落点和直觉不一样:按钮点了不拿焦点;点页内任何不是画布的地方(栏目标题、速率钮、空白处),
// 焦点都落到外层页签面板(带 tabindex 的祖先)上,之后的键盘事件目标就是那个面板 —— 它是本页的容器,不是「页外的控件」。
// 所以判定不看「目标在不在页内」,只看三件事:
//   一、是不是在打字(可编辑的输入框 / 文本域 / 可编辑区);
//   二、是不是有弹窗 / 抽屉 / 下拉开着(那时键盘归弹层);
//   三、焦点是不是用 Tab 键走到某个可激活控件上的(是的话,空格是那个控件自己的激活键)。
// 鼠标点过之后留在控件上的焦点(下拉的只读输入框、顶栏页签、滑块)不算第三条:人是点完就按空格想暂停的。

const TEXT_INPUT_TYPES = ['', 'text', 'search', 'url', 'tel', 'email', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week'];

// 目标落在这些里面:键盘归它
export const PLAYBACK_HOTKEY_OVERLAYS = '.ant-modal, .ant-drawer, .ant-select-dropdown, .ant-picker-dropdown, .ant-popover, .ant-dropdown, .planetarium-time-editor, [role="dialog"], [role="listbox"], [role="menu"]';
// 这些开着(看得见)时,不管焦点在哪都不接管
export const PLAYBACK_HOTKEY_OPEN_OVERLAYS = '.ant-modal-wrap, .ant-drawer-open, .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden), .ant-dropdown:not(.ant-dropdown-hidden), .planetarium-time-editor';
// 时间输入面板里可能开着的下拉 / 日期弹层(Esc 先归它们,收完再收面板)
export const PLAYBACK_HOTKEY_OPEN_POPUPS = '.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden)';
// 空格是它们自己的激活键(只在焦点由键盘走到时让给它们)
export const PLAYBACK_HOTKEY_CONTROLS = 'button, a[href], input, select, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [role="combobox"]';

export function isSpaceKey(e){
	return !!e && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
}

function isShown(el){
	return !!(el && el.isConnected && typeof el.getClientRects === 'function' && el.getClientRects().length > 0);
}

// 正在打字的地方:空格是要输入的字符
export function isTextEntryTarget(t){
	if(!t || t.nodeType !== 1){ return false; }
	if(t.isContentEditable || (t.closest && t.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'))){ return true; }
	if(t.tagName === 'TEXTAREA'){ return !t.readOnly && !t.disabled; }
	if(t.tagName === 'INPUT'){
		const type = String(t.getAttribute('type') || '').toLowerCase();
		return TEXT_INPUT_TYPES.indexOf(type) >= 0 && !t.readOnly && !t.disabled;
	}
	return false;
}

// 目标是不是(或在)一个可激活控件里
export function playbackHotkeyControlOf(t){
	if(!t || t.nodeType !== 1 || !t.closest){ return null; }
	return t.closest(PLAYBACK_HOTKEY_CONTROLS);
}

function anyOverlayOpen(doc){
	if(!doc || !doc.querySelectorAll){ return false; }
	const list = doc.querySelectorAll(PLAYBACK_HOTKEY_OPEN_OVERLAYS);
	for(let i = 0; i < list.length; i += 1){
		if(isShown(list[i])){ return true; }
	}
	return false;
}

// e = 键盘事件;page = 天文馆页根节点;focusByKeyboard = 当前焦点是不是用 Tab 键走到的
export function spaceTogglesPlayback(e, page, focusByKeyboard){
	if(!e || e.defaultPrevented || e.isComposing){ return false; }
	if(!isSpaceKey(e)){ return false; }
	if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey){ return false; }
	if(!isShown(page)){ return false; }   // 页不在 / 被藏起(display:none)时不接管
	const t = e.target && e.target.nodeType === 1 ? e.target : null;
	if(t){
		if(isTextEntryTarget(t)){ return false; }
		if(t.closest && t.closest(PLAYBACK_HOTKEY_OVERLAYS)){ return false; }
	}
	if(anyOverlayOpen(page.ownerDocument)){ return false; }
	if(t && focusByKeyboard){
		const ctl = playbackHotkeyControlOf(t);
		if(ctl && !ctl.disabled){ return false; }
	}
	return true;
}
