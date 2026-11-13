// 以字符串口径存日期 / 时刻的地方(择日时间范围、用事人本命、病始日期、七政流时 / 择日起日、定时任务)
// 用的全站时间组件:外观与手感同左栏「时间与地点」(单击弹编辑器、双击键入数字),不再用系统原生日期框。
//   date:'YYYY-MM-DD'(空串 = 未填,显示 placeholder);time:'HH:MM'(showTime=false 时不用)。
//   onChange({ date, time }):与原生框同一口径的字符串;只选日期时 time 原样带回。编辑器不出时区与秒(这些字段只存到分,时区随所在页)。
import React from 'react';
import CompactTimeField from './CompactTimeField';
import DateTime from './DateTime';
import { parseDateParts } from '../../utils/dateStrSafe';   // 带符号 1–5 位年(公元前 / 五位年)

const pad = (n)=>`${n}`.padStart(2, '0');

export function isoPartsOf(dt){
	if(!dt){ return { date: '', time: '' }; }
	const y = `${Math.abs(dt.year)}`.padStart(4, '0');
	return { date: `${dt.ad < 0 ? '-' : ''}${y}-${pad(dt.month)}-${pad(dt.date)}`, time: `${pad(dt.hour)}:${pad(dt.minute)}` };
}

export function dateTimeFromIso(date, time){
	const dt = new DateTime();
	const d = parseDateParts(date);
	const t = /^(\d{1,2}):(\d{1,2})/.exec(`${time || ''}`.trim());
	if(d){
		dt.ad = d.year < 0 ? -1 : 1;
		dt.setDateTime(Math.abs(d.year), d.month, d.day, t ? Number(t[1]) : 0, t ? Number(t[2]) : 0, 0);
	}else if(t){
		dt.setDateTime(dt.year, dt.month, dt.date, Number(t[1]), Number(t[2]), 0);
	}
	return dt;
}

export default function IsoDateTimeField({ date, time, onChange, showTime = true, placeholder = '未设', className = '', style }){
	const dt = dateTimeFromIso(date, time);
	const filled = !!`${date || ''}`.trim();
	const text = filled ? (showTime ? `${isoPartsOf(dt).date} ${isoPartsOf(dt).time}` : isoPartsOf(dt).date) : placeholder;
	return (
		<span className={`horosa-iso-datetime ${className}`.trim()} style={style}>
			<CompactTimeField label="" hint="" noAdjust needZone={false} showZone={false} showSeconds={false} showTime={showTime} value={dt} timeText={text}
				onChange={(res)=>{
					const next = res && res.time;
					if(!next || !onChange){ return; }
					const p = isoPartsOf(next);
					onChange({ date: p.date, time: showTime ? p.time : (time || '') });
				}} />
		</span>
	);
}
