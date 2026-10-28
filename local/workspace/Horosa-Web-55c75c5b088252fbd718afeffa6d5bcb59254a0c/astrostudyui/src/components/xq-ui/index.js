import React from 'react';
import { Button, Card, DatePicker, TimePicker, Drawer, Input, InputNumber, Modal, Pagination, Radio, Select, Switch, Table, Tabs, Tooltip, message } from 'antd';
import moment from 'moment';
import XQIcon from '../xq-icons';
import { scriptFilterBy } from '../../utils/scriptMode';
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

// 分段控件放不下时折行:各项是等宽列(grid-auto-columns: 1fr),所以按「最宽一项 × 项数」判(此前按各项之和判,
// 总宽放得下、长的那项在它分到的等分里放不下 → 文字溢出按钮,如印占年盘口径两项)。返回 0 = 一行放得下 /
// 2 = 两列多行 / 1 = 连半宽都放不下,一项一行。环境不支持时恒 0 = 现状。
// 折行档位(纯函数,便于单测;全部是 CSS 布局 px):sum = 各项「文字宽 + 内衬 + 2」之和;maxTw = 最宽一项的文字宽;
// padX = 每项左右内衬之和(未折行档);avail = 容器内宽。两条取或:① 各项之和超出;② 等宽列下最宽一项连同内衬放不进它分到的列宽
// ——标签是 white-space: normal,字一进内衬就换行(三字标签「时区图」100% 档折成「时区 / 图」),所以内衬必须算进去。
// 宽度随内容伸缩的分段列宽本就不小于最宽一项连内衬,不会被误折。
// 折行后内衬是 0 6px(见 22-tail-fixes 的 is-wrapped 规则):两列各分到一半放得下就两列,否则一项一行。
// 中间档「收内衬」(3 = SEGMENTED_LEVEL_COMPACT,挂 .is-compact):原样一行放不下、但内衬收到折行档的 0 6px 一行就放得下
// (差不到一两像素的常见情形,如三项「甲乙 | 丙丁 | 时区图」100% 档差 0.67px)—— 只收内衬、不改排布、保留滑块,
// 不必整组折成两列两行;仍放不下才折。原样一行放得下的逐像素不变。
export const SEGMENTED_LEVEL_COMPACT = 3;
export const SEGMENTED_COMPACT_PAD_X = 12;
export function segmentedWrapLevel({ sum, maxTw, count, avail, padX = SEGMENTED_UNWRAPPED_PAD_X }){
	if(!(avail > 0) || !(count > 0)){ return 0; }
	if(!(sum > avail || (maxTw + padX + 2) * count > avail)){ return 0; }
	if(padX > SEGMENTED_COMPACT_PAD_X){
		const sumCompact = sum - count * (padX - SEGMENTED_COMPACT_PAD_X);
		if(!(sumCompact > avail || (maxTw + SEGMENTED_COMPACT_PAD_X + 2) * count > avail)){ return SEGMENTED_LEVEL_COMPACT; }
	}
	return (maxTw + 12 + 2) * 2 <= avail ? 2 : 1;
}
// 判据的内衬一律按「未折行」那一档(样式表缺省 0 10px,左右合 20;页面覆盖了未折行内衬的,以未折行时实测为准),与当前折没折无关:
// 折行后内衬变成 0 6px,若按当前态量,判据的输入就被它自己的输出改了 —— 未折行按 10px 量判「折」,折了按 6px 量又判「不折」,
// 容器内宽落在 [Σ文字宽 + 14n, Σ文字宽 + 22n) 这一段里时每次 ResizeObserver 回调都翻一次,一行两行来回闪。
export const SEGMENTED_UNWRAPPED_PAD_X = 20;
// tws = 各项文字宽;padX = 每项左右内衬之和(未折行档)
export function segmentedWrapLevelFor({ tws, padX = SEGMENTED_UNWRAPPED_PAD_X, avail }){
	const list = Array.isArray(tws) ? tws : [];
	const sum = list.reduce((acc, tw)=>acc + tw + padX + 2, 0);
	const maxTw = list.reduce((m, tw)=>(tw > m ? tw : m), 0);
	return segmentedWrapLevel({ sum, maxTw, count: list.length, avail, padX });
}
// 从实测量换到同一个域再判:文字宽(Range 客户矩形)与容器 getBoundingClientRect 是视觉域(随 CSS zoom 缩放),
// 内衬(getComputedStyle)与判据里的常数是 CSS 布局 px —— 混着加减,缩放 ≠ 1 时判错(1.8 档该折不折、0.7 档放得下却折)。
// z 取同一元素的「视觉宽 / 布局宽」(任何引擎下都成立;不缩放的旧引擎 z = 1、零改动),视觉量一律 ÷ z 换回布局域。
// twRects = 各项文字的视觉宽;groupRectWidth / groupLayoutWidth = 容器的视觉宽 / 布局宽(offsetWidth)
export function segmentedZoomOf(groupRectWidth, groupLayoutWidth){
	const z = groupLayoutWidth > 0 && groupRectWidth > 0 ? groupRectWidth / groupLayoutWidth : 1;
	return Math.abs(z - 1) > 0.005 ? z : 1;   // 布局宽是整数 px,差不到半个像素的当作没缩放(100% 档逐值与原先一致)
}
export function segmentedWrapLevelFromRects({ twRects, padX = SEGMENTED_UNWRAPPED_PAD_X, groupRectWidth, groupLayoutWidth }){
	const z = segmentedZoomOf(groupRectWidth, groupLayoutWidth);
	const tws = (Array.isArray(twRects) ? twRects : []).map((w)=>w / z);
	return segmentedWrapLevelFor({ tws, padX, avail: groupRectWidth / z - 8 });
}
// ── 真实排版下试排(有排版引擎时的主判据)────────────────────────────────────────────
// 算术判据(上面几个纯函数)要知道「可用宽」:拿控件自己的宽当可用宽,在「随内容定宽」的容器里(抽屉的行内控件、
// inline-flex 包一层)就是自指 —— 未折行时自身宽恰等于所需宽,判据的估算余量一多就判「折」;一折,控件缩成两列 / 一列,
// 父容器跟着缩,可用宽更小,永远回不来(星盘设置抽屉 27 个分段 26 个被锁成一项一行;换档后锁存)。
// 所以有排版时不再估算:把折行类临时摘掉(同步、不出帧),让浏览器按真实约束把「一行」排出来,直接看有没有字放不下
// (按钮里的字折成多行 / 按钮内容溢出 / 各项越出控件框);放不下再试两列;都在同一帧内复原类名。
// 结论只取决于外部约束、与当前折没折无关(无自锁、无闪烁),也与缩放档无关(行数按矩形上下是否重叠数,溢出看同一元素自己的两个布局量)。
function segmentedLabelOf(b){
	return Array.prototype.find.call(b.children, (c)=>c.tagName === 'SPAN' && !c.classList.contains('ant-radio-button')) || b;
}
// 一段文字排成了几行:Range 的客户矩形按上沿归行 —— 同一行里中英文字体的上沿可以差一两像素(不算换行);
// 分段按钮是 line-height: 1,相邻两行的字形矩形会上下重叠几像素,所以不能按「是否重叠」判,按上沿差是否超过字高的四成判。
export function segmentedLineCount(rects){
	const list = Array.prototype.filter.call(rects || [], (r)=>r && r.width > 0 && r.height > 0)
		.sort((a, b)=>a.top - b.top);
	let lines = 0;
	let lineTop = -Infinity;
	list.forEach((r)=>{
		if(r.top - lineTop > Math.max(2, r.height * 0.4)){ lines += 1; lineTop = r.top; }
	});
	return lines;
}
// 当前排版下有没有字放不下
export function segmentedOverflows(el){
	const btns = el.querySelectorAll('.ant-radio-button-wrapper');
	const box = el.getBoundingClientRect();
	for(let i = 0; i < btns.length; i += 1){
		const b = btns[i];
		if(b.scrollWidth > b.clientWidth + 1){ return true; }
		const br = b.getBoundingClientRect();
		if(br.right > box.right + 0.5 || br.left < box.left - 0.5){ return true; }
		try{
			const range = document.createRange();
			range.selectNodeContents(segmentedLabelOf(b));
			if(segmentedLineCount(range.getClientRects()) > 1){ return true; }
		}catch(e){ /* 量不到行数就只看溢出 */ }
	}
	return false;
}
// 试排出折行档位:0 原样一行放得下 / 3 收内衬后一行放得下 / 2 两列放得下 / 1 一项一行。调用前后类名一字不变。
export function segmentedTrialLevel(el){
	const cl = el.classList;
	const had = cl.contains('is-wrapped');
	const hadSingle = cl.contains('is-wrapped-single');
	const hadCompact = cl.contains('is-compact');
	try{
		cl.remove('is-wrapped', 'is-wrapped-single', 'is-compact');
		if(!segmentedOverflows(el)){ return 0; }
		cl.add('is-compact');
		if(!segmentedOverflows(el)){ return SEGMENTED_LEVEL_COMPACT; }
		cl.remove('is-compact');
		cl.add('is-wrapped');
		return segmentedOverflows(el) ? 1 : 2;
	}finally{
		cl.toggle('is-wrapped', had);
		cl.toggle('is-wrapped-single', hadSingle);
		cl.toggle('is-compact', hadCompact);
	}
}
// 档位 → 类名(组件与测试共用):收内衬档只挂 is-compact;折行两档挂 is-wrapped(一项一行再加 is-wrapped-single)
export function segmentedLevelClass(level){
	if(level === SEGMENTED_LEVEL_COMPACT){ return 'is-compact'; }
	if(level === 1){ return 'is-wrapped is-wrapped-single'; }
	if(level === 2){ return 'is-wrapped'; }
	return '';
}

export function useSegmentedWrap(containerRef, deps = []){
	const [wrapped, setWrapped] = React.useState(0);
	const unwrappedPadRef = React.useRef(null);   // 最近一次未折行时实测的每项内衬(左右之和)
	React.useEffect(()=>{
		const el = containerRef.current;
		if(!el || typeof ResizeObserver === 'undefined' || typeof document.createRange !== 'function'){ return undefined; }
		const measure = ()=>{
			const btns = el.querySelectorAll('.ant-radio-button-wrapper');
			if(!btns.length){ return; }
			// 有排版引擎(控件真有布局宽):试排定档
			if(el.clientWidth > 0){
				const next = segmentedTrialLevel(el);
				setWrapped((w)=>(w === next ? w : next));
				return;
			}
			// 没有排版(jsdom 一类)时退回算术判据:各量换到同一个域再判(收内衬档的内衬也不是「未折行」档)
			const isWrappedNow = el.classList.contains('is-wrapped') || el.classList.contains('is-compact');
			const groupRectWidth = el.getBoundingClientRect().width;
			const zoomNow = segmentedZoomOf(groupRectWidth, el.offsetWidth);
			const tws = [];
			let padTotal = 0;
			btns.forEach((b)=>{
				// 只量可见文字那个直接子 span:整个 label 的 Range 会把 antd 撑满按钮的隐藏
				// radio input(width:100%)与文字 span 的元素盒一起算进去(实测每项 129+28+28),三项 597 > 258 恒判折行,
				// 印占「盘式」/ 巴比伦六曜等一行放得下的分段全被摊成两列。Range 按行累加 = 单行自然宽,与折没折无关。
				const label = segmentedLabelOf(b);
				let tw = 0;
				try{
					const range = document.createRange();
					range.selectNodeContents(label);
					const rects = range.getClientRects();
					for(let i = 0; i < rects.length; i++){ tw += rects[i].width; }
				}catch(e){ tw = label.scrollWidth * zoomNow; }   // scrollWidth 是布局域,先乘回视觉域(下面统一 ÷ z)
				tws.push(tw);
				if(!isWrappedNow){
					const bcs = getComputedStyle(b);
					padTotal += (parseFloat(bcs.paddingLeft) || 0) + (parseFloat(bcs.paddingRight) || 0);
				}
			});
			if(!isWrappedNow){ unwrappedPadRef.current = padTotal / btns.length; }
			const padX = unwrappedPadRef.current !== null ? unwrappedPadRef.current : SEGMENTED_UNWRAPPED_PAD_X;
			const next = segmentedWrapLevelFromRects({ twRects: tws, padX, groupRectWidth, groupLayoutWidth: el.offsetWidth });
			setWrapped((w)=>(w === next ? w : next));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		// 随内容定宽的容器里,外面变宽时控件自己(已折行、按内容定宽)尺寸不变,只看自己就永远等不到「放得下了」:
		// 连同往上三层祖先一起看;换缩放档时壳会派发 resize。
		for(let a = el.parentElement, k = 0; a && k < 3 && a !== document.body; a = a.parentElement, k += 1){ ro.observe(a); }
		const onResize = ()=>measure();
		window.addEventListener('resize', onResize);
		return ()=>{ ro.disconnect(); window.removeEventListener('resize', onResize); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [containerRef, ...deps]);
	return wrapped;
}

export function XQSegmented({value, options, onChange, className = '', size = 'small'}){
	// 星阙金 W1:内部滑块 —— Radio.Group DOM 与 {value,options,onChange(e.target.value)} API 零变,
	// 仅组内新增绝对定位 thumb(aria-hidden);测量不可用时无 -sliding 类,CSS 落回选中项实底。
	const groupRef = React.useRef(null);
	const optionCount = (options || []).length;
	const wrapped = useSegmentedWrap(groupRef, [optionCount, (options || []).map((o)=>String(o && o.label)).join('|')]);
	// 档位变了(收内衬会挪动各项)滑块重量一次
	const thumb = useSlidingIndicator(groupRef, '.ant-radio-button-wrapper-checked', [value, optionCount, wrapped]);
	const folded = wrapped === 1 || wrapped === 2;
	const sliding = thumb.ready && !folded;
	return (
		<Radio.Group
			ref={groupRef}
			size={size}
			buttonStyle="solid"
			value={value}
			onChange={onChange}
			className={`xq-segmented ${sliding ? 'xq-segmented-sliding' : ''} ${segmentedLevelClass(wrapped)} ${className}`.trim().replace(/\s+/g, ' ')}
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
			// 搜索比对缺省走单源(界面繁体时照屏幕输入的繁体也能搜到;简体与组件缺省同口径)。显式传入的仍优先。
			filterOption={scriptFilterBy(rest.optionFilterProp)}
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

// 快捷数字键入无效时的统一提示(日期框快输与 QuickTimeField 共用)。
export function pickerInvalid(text){
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
					{/* 窄栏 / 大缩放下标题会被截断(缩放档省略号判定有引擎缺陷时退成直接截断):纯文字标题挂悬停全文 */}
					<span className="xq-side-section-title" title={typeof title === 'string' ? title : undefined}>{title}</span>
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

// 按设计宽排版、栏宽不够时整体等比缩的 HTML 盘外框(放得下时 display:contents,逐像素不变)
export { XQDesignScaleBox, designScaleOf, contentWidthOf, HTML_DESIGN_BOX_ATTR } from './XQDesignScaleBox';
