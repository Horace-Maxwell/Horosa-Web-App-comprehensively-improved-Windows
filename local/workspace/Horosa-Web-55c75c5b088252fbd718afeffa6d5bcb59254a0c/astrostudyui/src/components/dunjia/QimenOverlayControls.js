// 奇门盘面附加层的左栏控件与右栏卡片 —— 奇门页与三式合一页共用这一份(三式合一同步:两页同名同义,一处改两处跟)。
// 控件:寄干 / 天禽(飞盘中宫自有星干,不出这两项)、推演显示、推演用神宫(开推演才出)、十二建星;卡片:推演结果、寄干 · 天禽、十二建星。
// 行的内容与 AI 快照同一份(DunJiaCalc.tuiYanRows / jiGanRows、utils/jianChu),这里只管怎么摆。
import React from 'react';
import { XQSelect as Select } from '../xq-ui';
import { TUIYAN_VIEW_OPTIONS, TUIYAN_GONG_OPTIONS, tuiYanRows, jiGanRows } from './DunJiaCalc';
import { jianChuOfChart, jianChuText } from '../../utils/jianChu';
import { tuiYanLegend } from './qimenCellLayout';

const { Option } = Select;

const onOff = (label, value, onChange, fieldClass)=>(
	<label className={fieldClass}>
		<span>{label}</span>
		<Select size="small" value={value ? 1 : 0} onChange={(v)=>onChange(v === 1)}>
			<Option value={0}>不显示</Option>
			<Option value={1}>显示</Option>
		</Select>
	</label>
);

// opt = 页面的奇门选项;onOptionChange(key, value) = 页面自己的改值入口;fieldClass = 页面左栏字段的类名
export function QimenOverlayFields({ opt, onOptionChange, fieldClass }){
	const o = opt || {};
	const view = o.tuiYanView || 'off';
	return (
		<>
			{o.school !== '飞盘' ? onOff('寄干', !!o.showJiGan, (v)=>onOptionChange('showJiGan', v), fieldClass) : null}
			{o.school !== '飞盘' && !(o.school === '混合' && o.mixXing === 'fei') ? onOff('天禽', !!o.showTianQin, (v)=>onOptionChange('showTianQin', v), fieldClass) : null}
			<label className={fieldClass}>
				<span>推演显示</span>
				<Select size="small" value={view} onChange={(v)=>onOptionChange('tuiYanView', v)} dropdownMatchSelectWidth={false}>
					{TUIYAN_VIEW_OPTIONS.map((item)=><Option key={`ty_${item.value}`} value={item.value}>{item.label}</Option>)}
				</Select>
			</label>
			{view !== 'off' ? (
				<label className={fieldClass}>
					<span>推演用神宫</span>
					<Select size="small" value={o.tuiYanGong || 'shigan'} onChange={(v)=>onOptionChange('tuiYanGong', v)} dropdownMatchSelectWidth={false}>
						{TUIYAN_GONG_OPTIONS.map((item)=><Option key={`tyg_${item.value}`} value={item.value}>{item.label}</Option>)}
					</Select>
				</label>
			) : null}
		</>
	);
}

// 「十二建星」开关(两页同一键 showJianChu):奇门页 = 盘外一圈十二支与建星,三式盘 = 外圈地支旁挂建星;两页右栏都多一张日值 / 时值卡。
// 奇门页盘下另有一个同键的快捷按钮(DunJiaBoard)
export function JianChuField({ opt, onOptionChange, fieldClass }){
	return (
		<label className={fieldClass}>
			<span>十二建星</span>
			<Select size="small" value={opt && opt.showJianChu ? 1 : 0} onChange={(v)=>onOptionChange('showJianChu', v === 1)}>
				<Option value={0}>不显示</Option>
				<Option value={1}>显示</Option>
			</Select>
		</label>
	);
}

// 推演 / 寄干两张卡(开关开才有);kvCard = 页面所用的键值卡函数,Note = 卡底注释组件
export function qimenOverlayCards(pan, kvCard, Note){
	if(!pan || pan.isJinhan){ return null; }
	const ty = tuiYanRows(pan.tuiYan);
	const jg = jiGanRows(pan.jiGan);
	if(!ty && !jg.length){ return null; }
	return (
		<>
			{ty ? kvCard(ty.title, ty.rows, (
				<>
					{/* 盘上标记的释义(两盘同一份图例;标记本身悬停也有释义) */}
					<Note soft>盘上标记：{tuiYanLegend(pan.tuiYan && pan.tuiYan.view)}</Note>
					{ty.note ? <Note soft>{ty.note}</Note> : null}
				</>
			)) : null}
			{jg.length ? kvCard('寄干 · 天禽', jg) : null}
		</>
	);
}

// 十二建星卡:日值 = 月建(节气月的月支)起建顺数日支(逢节重复);时值 = 以日支为建顺数时支 —— 与盘面外环、快照同一份(utils/jianChu)
export function jianChuCard(pan, kvCard, Note){
	const r = (pan && pan.jianChu) || jianChuOfChart(pan && pan.ganzhi, pan && pan.dateStr);
	return kvCard('十二建星', [
		['日值', jianChuText(r.day)],
		['时值', jianChuText(r.hour)],
	], (<Note soft>日值以节气月建起「建」顺数日支，交节当日按新月建（逢节重复，与黄历同）；时值以日支为建顺数时支。建除满平定执破危成收开闭，吉凶归类与黄历同一份。</Note>));
}
