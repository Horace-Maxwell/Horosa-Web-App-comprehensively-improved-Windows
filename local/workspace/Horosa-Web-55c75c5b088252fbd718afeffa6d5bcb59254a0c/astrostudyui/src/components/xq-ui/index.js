import React from 'react';
import { Button, Card, DatePicker, TimePicker, Drawer, Input, InputNumber, Modal, Pagination, Radio, Select, Switch, Table, Tabs, Tooltip, message } from 'antd';
import moment from 'moment';
import XQIcon from '../xq-icons';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';
import { parseQuickDigitsForFormat, pickerDigitsLength, QUICK_DIGITS_ERROR_PREFIX } from '../../utils/quickDateTimeDigits';

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

// [窄布局 2026-09-17] 分段控件放不下(各项文字总宽+内衬 > 容器)时挂 is-wrapped:两列多行、关闭滑块;文字宽用 Range 逐行累加,
// 与容器同在视觉域比较,不依赖当前是否已折行(无振荡)。环境不支持时恒 false = 现状。
export function useSegmentedWrap(containerRef, deps = []){
	const [wrapped, setWrapped] = React.useState(false);
	React.useEffect(()=>{
		const el = containerRef.current;
		if(!el || typeof ResizeObserver === 'undefined' || typeof document.createRange !== 'function'){ return undefined; }
		const measure = ()=>{
			const btns = el.querySelectorAll('.ant-radio-button-wrapper');
			if(!btns.length){ return; }
			let need = 0;
			btns.forEach((b)=>{
				// [2026-09-18 假折行根修] 只量可见文字那个直接子 span:整个 label 的 Range 会把 antd 撑满按钮的隐藏
				// radio input(width:100%)与文字 span 的元素盒一起算进去(实测每项 129+28+28),三项 597 > 258 恒判折行,
				// 印占「盘式」/ 巴比伦六曜等一行放得下的分段全被摊成两列。Range 仍按行累加 = 单行自然宽,已折行也不振荡。
				const label = Array.prototype.find.call(b.children, (c)=>c.tagName === 'SPAN' && !c.classList.contains('ant-radio-button')) || b;
				let tw = 0;
				try{
					const range = document.createRange();
					range.selectNodeContents(label);
					const rects = range.getClientRects();
					for(let i = 0; i < rects.length; i++){ tw += rects[i].width; }
				}catch(e){ tw = label.scrollWidth; }
				const cs = getComputedStyle(b);
				need += tw + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2;
			});
			const avail = el.getBoundingClientRect().width - 8;
			const next = avail > 0 && need > avail;
			setWrapped((w)=>(w === next ? w : next));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return ()=>ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [containerRef, ...deps]);
	return wrapped;
}

export function XQSegmented({value, options, onChange, className = '', size = 'small'}){
	// 星阙金 W1:内部滑块 —— Radio.Group DOM 与 {value,options,onChange(e.target.value)} API 零变,
	// 仅组内新增绝对定位 thumb(aria-hidden);测量不可用时无 -sliding 类,CSS 落回选中项实底。
	const groupRef = React.useRef(null);
	const optionCount = (options || []).length;
	const thumb = useSlidingIndicator(groupRef, '.ant-radio-button-wrapper-checked', [value, optionCount]);
	const wrapped = useSegmentedWrap(groupRef, [optionCount, (options || []).map((o)=>String(o && o.label)).join('|')]);
	const sliding = thumb.ready && !wrapped;
	return (
		<Radio.Group
			ref={groupRef}
			size={size}
			buttonStyle="solid"
			value={value}
			onChange={onChange}
			className={`xq-segmented ${sliding ? 'xq-segmented-sliding' : ''} ${wrapped ? 'is-wrapped' : ''} ${className}`.trim()}
		>
			{sliding ? (
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

// ===== 日期/时间选择框「数字快输」宿主 =====
// 用户在选择框里连续键入数字(不带分隔符),按选择框的 format 切成年月日时分秒:输满即换算、回车/失焦亦换算;
// 不足位补 0(月日 00→01)、多余位丢弃、越界报错保留旧值。挂在 capture 阶段:回车先于 rc-picker 自己的键处理,
// 换算成功即阻止其继续(否则 rc-picker 把纯数字当无效文本回退)。区间选择框按被键入的那个输入框改对应端。
function resolvePickerFormat({ format, picker, showTime }){
	const f = Array.isArray(format) ? format[0] : format;
	if(typeof f === 'string'){ return f; }
	if(typeof f === 'function'){ return null; }
	if(picker === 'time'){ return 'HH:mm:ss'; }
	if(picker === 'month'){ return 'YYYY-MM'; }
	if(picker === 'year'){ return 'YYYY'; }
	if(picker === 'week' || picker === 'quarter'){ return null; }
	if(showTime){
		const tf = showTime && typeof showTime === 'object' && typeof showTime.format === 'string' ? showTime.format : 'HH:mm:ss';
		return `YYYY-MM-DD ${tf}`;
	}
	return 'YYYY-MM-DD';
}

function momentFromDigitParts(parts, base){
	if(parts.year !== null){
		return moment({ year: parts.year, month: parts.month - 1, date: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second, millisecond: 0 });
	}
	const b = base && moment.isMoment(base) && base.isValid() ? base.clone() : moment();
	return b.hour(parts.hour).minute(parts.minute).second(parts.second).millisecond(0);
}

function pickerDigitsOnly(text){
	return /^[\s0-9０-９]+$/.test(text || '') && /[0-9０-９]/.test(text || '');
}

function pickerInvalid(text){
	try{ message.error(text, 3); }catch(e){ /* 无 antd 上下文时静默 */ }
}

export function QuickDigitsHost({ format, picker, showTime, value, onChange, onInvalid, range, children }){
	const fmt = resolvePickerFormat({ format, picker, showTime });
	const total = fmt ? pickerDigitsLength(fmt) : 0;
	const rootRef = React.useRef(null);
	const lockRef = React.useRef(false);
	const isPickerInput = (t)=>!!(fmt && t && t.tagName === 'INPUT' && t.closest && t.closest('.ant-picker'));
	const inputIndex = (el)=>{
		const root = rootRef.current;
		if(!root){ return 0; }
		const i = Array.prototype.indexOf.call(root.querySelectorAll('.ant-picker input'), el);
		return i < 0 ? 0 : i;
	};
	const commit = (el, text)=>{
		if(!fmt || lockRef.current){ return false; }
		const res = parseQuickDigitsForFormat(text, fmt);
		if(res.errorCode === 'empty' || res.errorCode === 'format'){ return false; }
		if(!res.ok){
			(onInvalid || pickerInvalid)(res.error, res);
			return false;
		}
		const idx = range ? inputIndex(el) : 0;
		const base = range ? (Array.isArray(value) ? value[idx] : null) : value;
		const m = momentFromDigitParts(res.parts, base);
		if(!m.isValid()){
			(onInvalid || pickerInvalid)(`${QUICK_DIGITS_ERROR_PREFIX}无法构造时间`, res);
			return false;
		}
		lockRef.current = true;
		try{
			try{ el.blur(); }catch(e){ /* noop */ }   // 先失焦:rc-picker 收起面板并按新值回填文本
			if(typeof onChange === 'function'){
				if(range){
					const cur = Array.isArray(value) ? value.slice(0, 2) : [];
					while(cur.length < 2){ cur.push(null); }
					cur[idx] = m;
					// 另一端还空着:用同一时刻补齐成合法区间(消费者多半丢弃半区间,输入会「像没生效」);再键另一端即覆盖
					const other = idx === 0 ? 1 : 0;
					if(!(cur[other] && cur[other].isValid && cur[other].isValid())){ cur[other] = m.clone(); }
					onChange(cur, cur.map((x)=>(x && x.isValid && x.isValid() ? x.format(fmt) : '')));
				}else{
					onChange(m, m.format(fmt));
				}
			}
		}finally{
			lockRef.current = false;
		}
		return true;
	};
	const onKeyDownCapture = (e)=>{
		const t = e.target;
		if(!isPickerInput(t)){ return; }
		if((e.key === 'Enter' || e.keyCode === 13) && pickerDigitsOnly(t.value)){
			if(commit(t, t.value)){ e.preventDefault(); e.stopPropagation(); }
		}
	};
	const onInputCapture = (e)=>{
		const t = e.target;
		if(!isPickerInput(t)){ return; }
		const v = t.value;
		if(pickerDigitsOnly(v) && parseQuickDigitsForFormat(v, fmt).digits.length >= total){
			commit(t, v);
		}
	};
	const onBlurCapture = (e)=>{
		const t = e.target;
		if(!isPickerInput(t)){ return; }
		if(pickerDigitsOnly(t.value)){ commit(t, t.value); }
	};
	return (
		<span ref={rootRef} className="xq-quick-digits-host" style={{ display: 'contents' }} data-quick-digits-host={fmt ? '1' : '0'}
			onKeyDownCapture={onKeyDownCapture} onInputCapture={onInputCapture} onBlurCapture={onBlurCapture}>
			{children}
		</span>
	);
}

export function XQDatePicker({className = '', popupClassName = '', ...rest}){
	return (
		<QuickDigitsHost format={rest.format} picker={rest.picker} showTime={rest.showTime} value={rest.value} onChange={rest.onChange}>
			<DatePicker
				{...rest}
				className={`xq-date-picker ${className}`.trim()}
				popupClassName={`xq-date-picker-popup ${popupClassName}`.trim()}
			/>
		</QuickDigitsHost>
	);
}

XQDatePicker.RangePicker = function XQRangePicker({className = '', popupClassName = '', ...rest}){
	const RangePicker = DatePicker.RangePicker;
	return (
		<QuickDigitsHost range format={rest.format} picker={rest.picker} showTime={rest.showTime} value={rest.value} onChange={rest.onChange}>
			<RangePicker
				{...rest}
				className={`xq-date-picker xq-range-picker ${className}`.trim()}
				popupClassName={`xq-date-picker-popup ${popupClassName}`.trim()}
			/>
		</QuickDigitsHost>
	);
};

export function XQTimePicker({className = '', popupClassName = '', ...rest}){
	return (
		<QuickDigitsHost picker="time" format={rest.format} value={rest.value} onChange={rest.onChange}>
			<TimePicker
				{...rest}
				className={`xq-date-picker xq-time-picker ${className}`.trim()}
				popupClassName={`xq-date-picker-popup ${popupClassName}`.trim()}
			/>
		</QuickDigitsHost>
	);
}

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
