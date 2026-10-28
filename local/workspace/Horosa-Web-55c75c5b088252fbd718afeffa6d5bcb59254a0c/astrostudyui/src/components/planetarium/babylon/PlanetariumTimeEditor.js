// 天文馆 · 时间编辑器隔离壳(只在钟面值变化时重渲)。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { memo } from 'react';
import DateTimeSelector from '../../comp/DateTimeSelector';

// 时间编辑器隔离壳:天文馆每秒上百次 metrics/FPS 重渲,会带着 DateTimeSelector 一起重渲;
// 而 DateTimeSelector 内部 Option 用 randomStr 每渲生成新 key → Select 下拉项被不断 remount → 下拉无法停留。
// memo + 自定义比较:只在 time(钟面值)真正变化时才重渲,彻底隔离高频重渲 → 下拉可正常展开停留。
export const PlanetariumTimeEditor = memo(function PlanetariumTimeEditor({ time, onChange }){
	return (
		<DateTimeSelector showTime={true} showAdjust={true} value={time} onChange={onChange} />
	);
}, (prev, next)=>{
	// onChange 引用稳定(构造器 bind);只比 time 的钟面值(同值即跳过重渲)。
	const a = prev.time, b = next.time;
	if(a === b){ return true; }
	if(!a || !b){ return a === b; }
	return a.ad === b.ad && a.year === b.year && a.month === b.month && a.date === b.date
		&& a.hour === b.hour && a.minute === b.minute && a.second === b.second && a.zone === b.zone;
});
