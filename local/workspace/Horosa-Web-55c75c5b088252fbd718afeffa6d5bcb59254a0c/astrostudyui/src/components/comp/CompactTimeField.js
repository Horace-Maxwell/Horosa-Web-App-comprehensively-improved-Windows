// 紧凑时间块(单源):左栏「时间与地点」与星运各页右上角共用同一个样子与手感 ——
//   时间字段:单击弹出完整时间编辑器(编辑器里年 / 月 / 日 / 时 / 分 / 秒按住上下拖动可连续调,见 DateTimeSelector);
//            双击直接键入 14 位数字(年月日时分秒),输满或回车即生效;
//   下面一行:步长 ± / 此刻 / 确定(PlusMinusTime adjustOnly)。
// onChange(res) 收到与 PlusMinusTime 同形的 { time: DateTime, ad, confirmed, step? };value 可以是 DateTime,也可以是带 .time / .value 的包装。
import React from 'react';
import TimeFieldTrigger from './QuickTimeField';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from './DateTime';

export function dateTimeOf(v){
	if(v instanceof DateTime){ return v; }
	if(v && v.time instanceof DateTime){ return v.time; }
	if(v && v.value instanceof DateTime){ return v.value; }
	if(v && v.time && v.time.time instanceof DateTime){ return v.time.time; }
	return null;
}

function defaultText(dt, onlyYear, yearMonth){
	if(!dt){ return '---- -- -- --:--:--'; }
	if(onlyYear){ return `${dt.format('YYYY')} 年`; }
	if(yearMonth){ return dt.format('YYYY-MM'); }
	return dt.format('YYYY-MM-DD HH:mm:ss');
}

export default function CompactTimeField(props){
	const {
		label = '时间', hint = '当地时间', value, timeText, onChange, needZone, timeHook,
		onlyYear, yearMonth, startTime, showZone, showSeconds, onStepSelect, confirmOnAdjust, inline,
	} = props;
	const dt = dateTimeOf(value) || new DateTime();
	const pass = { needZone, onlyYear, yearMonth, startTime, showZone, showSeconds, onStepSelect };
	const emit = (res)=>{ if(onChange && res){ onChange(res); } };
	const editor = (
		<div className="horosa-time-popover">
			<PlusMinusTime value={dt} onChange={emit} {...pass} />
		</div>
	);
	const trigger = (
		<TimeFieldTrigger value={dt} timeText={timeText || defaultText(dt, onlyYear, yearMonth)} popoverContent={editor}
			onQuickCommit={(next)=>emit({ time: next, ad: next.ad, confirmed: true })} />
	);
	const adjust = (
		<div className="horosa-time-adjust-inline">
			<PlusMinusTime value={dt} onChange={emit} hook={timeHook} adjustOnly confirmOnAdjust={confirmOnAdjust !== false} {...pass} />
		</div>
	);
	if(inline){
		// 右栏用:时间字段与步进行同一行(放不下自动折成两行);标签 / 提示由宿主放进分节标题
		return (
			<div className="horosa-field-block horosa-compact-time horosa-compact-time-inline">
				<div className="horosa-compact-time-field">{trigger}</div>
				{adjust}
			</div>
		);
	}
	return (
		<div className="horosa-field-block horosa-compact-time">
			{label ? <div className="horosa-field-label">{label}</div> : null}
			{trigger}
			{hint ? <div className="horosa-field-hint">{hint}</div> : null}
			{adjust}
		</div>
	);
}
