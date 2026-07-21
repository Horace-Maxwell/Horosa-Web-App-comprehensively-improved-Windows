import React from 'react';
import { Button, Card, DatePicker, Drawer, Input, InputNumber, Modal, Pagination, Radio, Select, Switch, Table, Tabs, Tooltip } from 'antd';
import XQIcon from '../xq-icons';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';

export function XQButton({children, iconName, className = '', variant = 'default', ...rest}){
	const icon = iconName ? <XQIcon name={iconName} /> : rest.icon;
	const visualVariant = variant === 'default' && rest.type === 'primary' ? 'primary' : variant;
	return (
		<Button
			{...rest}
			icon={icon}
			className={`xq-button xq-button-${visualVariant} ${className}`.trim()}
		>
			{children}
		</Button>
	);
}

export function XQIconButton({label, iconName, tooltip, className = '', ...rest}){
	const btn = (
		<Button
			{...rest}
			className={`xq-icon-button ${className}`.trim()}
			icon={<XQIcon name={iconName} />}
			aria-label={label || tooltip || iconName}
		>
			{label ? <span className="xq-icon-button-label">{label}</span> : null}
		</Button>
	);
	return tooltip ? <Tooltip title={tooltip}>{btn}</Tooltip> : btn;
}

export function XQToggle({active, children, iconName, className = '', ...rest}){
	return (
		<XQButton
			{...rest}
			iconName={iconName}
			className={`xq-toggle ${active ? 'xq-toggle-active' : ''} ${className}`.trim()}
			aria-pressed={active}
		>
			{children}
		</XQButton>
	);
}

export function XQSwitch({className = '', ...rest}){
	return (
		<Switch
			{...rest}
			className={`xq-switch ${className}`.trim()}
		/>
	);
}

// 星阙金 W1:滑动指示器通用 hook(角色③滑块/W3 自绘 rail 复用)。
// 测量 container 内匹配 activeSelector 的元素几何(offsetLeft/offsetWidth 相对 container),
// ResizeObserver 跟随布局变化;环境不支持(jsdom/老 WebView)时 ready 恒 false,
// 调用方按 ready 降级(CSS 兜底样式),交互零损。
export function useSlidingIndicator(containerRef, activeSelector, deps = []){
	const [box, setBox] = React.useState({ left: 0, width: 0, ready: false });
	React.useEffect(()=>{
		const el = containerRef.current;
		if(!el || typeof ResizeObserver === 'undefined'){
			setBox((b)=>(b.ready ? { left: 0, width: 0, ready: false } : b));
			return undefined;
		}
		const measure = ()=>{
			const active = el.querySelector(activeSelector);
			if(!active || !active.offsetWidth){
				setBox((b)=>(b.ready ? { ...b, ready: false } : b));
				return;
			}
			const next = { left: active.offsetLeft, width: active.offsetWidth, ready: true };
			setBox((b)=>(b.left === next.left && b.width === next.width && b.ready ? b : next));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return ()=>ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [containerRef, activeSelector, ...deps]);
	return box;
}

export function XQSegmented({value, options, onChange, className = '', size = 'small'}){
	// 星阙金 W1:内部滑块 —— Radio.Group DOM 与 {value,options,onChange(e.target.value)} API 零变,
	// 仅组内新增绝对定位 thumb(aria-hidden);测量不可用时无 -sliding 类,CSS 落回选中项实底。
	const groupRef = React.useRef(null);
	const optionCount = (options || []).length;
	const thumb = useSlidingIndicator(groupRef, '.ant-radio-button-wrapper-checked', [value, optionCount]);
	return (
		<Radio.Group
			ref={groupRef}
			size={size}
			buttonStyle="solid"
			value={value}
			onChange={onChange}
			className={`xq-segmented ${thumb.ready ? 'xq-segmented-sliding' : ''} ${className}`.trim()}
		>
			{thumb.ready ? (
				<span
					className="xq-segmented-thumb"
					aria-hidden="true"
					style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }}
				/>
			) : null}
			{(options || []).map((item)=>(
				<Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>
			))}
		</Radio.Group>
	);
}

export function XQPanel({children, className = '', tone = 'default', ...rest}){
	return (
		<div {...rest} className={`xq-panel xq-panel-${tone} ${className}`.trim()}>
			{children}
		</div>
	);
}

export function XQCard({children, className = '', ...rest}){
	return (
		<Card
			{...rest}
			className={`xq-card ${className}`.trim()}
		>
			{children}
		</Card>
	);
}

export function XQTable({className = '', ...rest}){
	return (
		<Table
			{...rest}
			className={`xq-table ${className}`.trim()}
		/>
	);
}

export function XQPagination({className = '', ...rest}){
	return (
		<Pagination
			{...rest}
			className={`xq-pagination ${className}`.trim()}
		/>
	);
}

export function XQToolbar({children, className = '', compact = false, ...rest}){
	return (
		<div {...rest} className={`xq-toolbar ${compact ? 'xq-toolbar-compact' : ''} ${className}`.trim()}>
			{children}
		</div>
	);
}

export function XQSectionTitle({children, className = '', ...rest}){
	return (
		<div {...rest} className={`xq-section-title ${className}`.trim()}>
			{children}
		</div>
	);
}

export function XQCheckItem({checked, children, className = '', compact = false, marker, disabled = false, ...rest}){
	return (
		<button
			type="button"
			{...rest}
			disabled={disabled}
			className={`xq-check-item ${checked ? 'xq-check-item-checked' : ''} ${compact ? 'xq-check-item-compact' : ''} ${disabled ? 'xq-check-item-disabled' : ''} ${className}`.trim()}
			aria-pressed={checked}
			aria-disabled={disabled || undefined}
		>
			<span className="xq-check-box" aria-hidden="true">
				{checked ? '✓' : ''}
			</span>
			<span className="xq-check-content">{children}</span>
			{marker ? <span className="xq-check-marker">{marker}</span> : null}
		</button>
	);
}

export function XQCheckList({children, className = '', columns = 1, ...rest}){
	return (
		<div
			{...rest}
			className={`xq-check-list xq-check-list-${columns} ${className}`.trim()}
		>
			{children}
		</div>
	);
}

export function XQSelect({className = '', popupClassName = '', dropdownClassName = '', ...rest}){
	return (
		<Select
			// 🔴 下拉面板默认按内容宽(不与窄选框等宽)→ 长选项文字在展开时完整可见(用户:选框可截断,
			//    但下拉栏展开必须显示完整)。放在 {...rest} 前=仍可被单点显式覆盖。
			dropdownMatchSelectWidth={false}
			{...rest}
			className={`xq-select ${className}`.trim()}
			popupClassName={`xq-select-popup ${popupClassName || dropdownClassName}`.trim()}
		/>
	);
}

XQSelect.Option = Select.Option;
XQSelect.OptGroup = Select.OptGroup;

export const XQInput = React.forwardRef(function XQInput({className = '', ...rest}, ref){
	return (
		<Input
			{...rest}
			ref={ref}
			className={`xq-input ${className}`.trim()}
		/>
	);
});

export function XQTextArea({className = '', ...rest}){
	return (
		<Input.TextArea
			{...rest}
			className={`xq-input xq-textarea ${className}`.trim()}
		/>
	);
}

export function XQSearch({className = '', ...rest}){
	return (
		<Input.Search
			{...rest}
			className={`xq-input xq-search ${className}`.trim()}
		/>
	);
}

XQInput.TextArea = XQTextArea;
XQInput.Search = XQSearch;

export function XQInputNumber({className = '', ...rest}){
	return (
		<InputNumber
			{...rest}
			className={`xq-input-number ${className}`.trim()}
		/>
	);
}

export function XQDatePicker({className = '', popupClassName = '', ...rest}){
	return (
		<DatePicker
			{...rest}
			className={`xq-date-picker ${className}`.trim()}
			popupClassName={`xq-date-picker-popup ${popupClassName}`.trim()}
		/>
	);
}

XQDatePicker.RangePicker = function XQRangePicker({className = '', popupClassName = '', ...rest}){
	const RangePicker = DatePicker.RangePicker;
	return (
		<RangePicker
			{...rest}
			className={`xq-date-picker xq-range-picker ${className}`.trim()}
			popupClassName={`xq-date-picker-popup ${popupClassName}`.trim()}
		/>
	);
};

export function XQTabs({className = '', ...rest}){
	return (
		<Tabs
			{...rest}
			className={`xq-tabs ${className}`.trim()}
		/>
	);
}

XQTabs.TabPane = Tabs.TabPane;

export function XQModal({className = '', children, ...rest}){
	return (
		<Modal
			{...rest}
			className={`xq-modal ${className}`.trim()}
		>
			{children}
		</Modal>
	);
}

export function XQDrawer({className = '', children, ...rest}){
	return (
		<Drawer
			{...rest}
			className={`xq-drawer ${className}`.trim()}
		>
			{children}
		</Drawer>
	);
}

// —— 观象左栏设计语言 ——————————————————————————————————————————
// 全 App 左栏小节折叠状态合并存单个 key 的一张 map(读改写整 map),
// 绝不逐小节开 localStorage key —— localStorage 配额事故(FL-4)教训。
export const SIDE_COLLAPSE_STORE_KEY = 'horosa.sidebar.collapse.v1';

function readSideCollapseMap(){
	const map = safeJsonParseFromStorage(SIDE_COLLAPSE_STORE_KEY);
	return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

// 左栏小节容器:标题行(语义图标+标题+extra+折叠箭头)+ 可折叠内容区。
// 🔴 折叠只做 CSS 高度过渡(grid 0fr/1fr)+ aria-expanded,children 永不卸载——
//    防折叠丢表单状态 / 防重挂载触发重算。
// 持久化:仅当传入 storageKey 时写入(走 safeStorage,配额满静默降级);
//         无 storageKey 时退化为组件内 state,零存储副作用。
export function XQSideSection({iconName, title, extra, collapsible = true, defaultOpen = true, storageKey, children, className = ''}){
	const [open, setOpen] = React.useState(()=>{
		if(!collapsible){ return true; }
		if(storageKey){
			const stored = readSideCollapseMap()[storageKey];
			if(typeof stored === 'boolean'){ return stored; }
		}
		return defaultOpen;
	});
	const expanded = collapsible ? open : true;
	const toggle = ()=>{
		if(!collapsible){ return; }
		const next = !expanded;
		setOpen(next);
		if(storageKey){
			const map = readSideCollapseMap();
			map[storageKey] = next;
			safeJsonStringifyToStorage(SIDE_COLLAPSE_STORE_KEY, map);
		}
	};
	return (
		<section className={`xq-side-section ${expanded ? '' : 'xq-side-section-collapsed'} ${className}`.trim()}>
			{/* 整行可点(含箭头);extra 内是独立控件,stopPropagation 防误触折叠 */}
			<div
				className={`xq-side-section-header ${collapsible ? 'xq-side-section-header-collapsible' : ''}`.trim()}
				onClick={collapsible ? toggle : undefined}
			>
				<button
					type="button"
					className="xq-side-section-toggle"
					aria-expanded={collapsible ? expanded : undefined}
				>
					{iconName ? <XQIcon name={iconName} className="xq-side-section-icon" /> : null}
					<span className="xq-side-section-title">{title}</span>
				</button>
				{extra ? (
					<span className="xq-side-section-extra" onClick={(e)=>e.stopPropagation()}>{extra}</span>
				) : null}
				{collapsible ? <XQIcon name="chevronDown" className="xq-side-section-arrow" /> : null}
			</div>
			<div className="xq-side-section-body" aria-hidden={expanded ? undefined : true}>
				<div className="xq-side-section-body-inner">{children}</div>
			</div>
		</section>
	);
}

// 面板头:kicker 小题 + 金 hairline 右渐隐装饰线(CSS 伪元素,order 插在 kicker 与 extra 之间)。
export function XQPanelHeader({kicker, extra, className = '', ...rest}){
	return (
		<div {...rest} className={`xq-panel-header ${className}`.trim()}>
			<span className="xq-panel-header-kicker">{kicker}</span>
			{extra ? <span className="xq-panel-header-extra">{extra}</span> : null}
		</div>
	);
}

export function XQNavItem({item, active, onClick}){
	return (
		<button
			type="button"
			className={`xq-nav-item ${active ? 'xq-nav-item-active' : ''}`}
			onClick={onClick}
			title={item.label}
		>
			<span className="xq-nav-item-icon">
				<XQIcon name={item.icon || 'astro'} />
			</span>
			<span className="xq-nav-item-copy">
				{item.group ? <span className="xq-nav-item-group">{item.group}</span> : null}
				<span className="xq-nav-item-label">{item.label}</span>
			</span>
		</button>
	);
}
