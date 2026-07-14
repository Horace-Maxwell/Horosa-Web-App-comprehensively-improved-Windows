// 通书择日左栏控件：流派 + 用事/坐山向/主事仙命 + 日期（按流派 needs 显隐）。
// 受控组件：props.settings + props.onChange(patch)；日期走 props.dateValue + props.onDateChange。
import React, { Component } from 'react';
import { XQSelect as Select } from '../xq-ui';
import DateTimeSelector from '../comp/DateTimeSelector';
import { TONGSHU_SCHOOLS, TONGSHU_SCHOOL_MAP, schoolNeeds, LIEXIU_USE_OPTIONS } from './tongshuSchools';
import { TONGSHU_TERMS, TONGSHU_TERM_CATEGORIES } from './tongshuData';
import { SHAN_ORDER, GANZHI_60 } from '../fengshui/fengshuiData';

const SCHOOL_OPTIONS = TONGSHU_SCHOOLS.map((s)=> ({ value: s.key, label: s.label }));
const SHAN_OPTIONS = SHAN_ORDER.map((s)=> ({ value: s, label: `${s}山` }));
const MING_OPTIONS = GANZHI_60.map((g)=> ({ value: g, label: g }));

export default class TongshuControls extends Component {
	render() {
		const { settings, onChange, dateValue, onDateChange } = this.props;
		const s = settings || {};
		const needs = schoolNeeds(s.school);
		const school = TONGSHU_SCHOOL_MAP[s.school] || {};

		return (
			<div className='horosa-tongshu-controls'>
				<div className='horosa-huangji-field-title'>通书择日</div>

				<label className='horosa-huangji-select-field is-wide'>
					<span>流派</span>
					<Select value={s.school} dropdownMatchSelectWidth={false}
						onChange={(v)=> onChange({ school: v })} options={SCHOOL_OPTIONS} />
				</label>
				<div className='horosa-tongshu-school-note'>{school.note || ''}</div>

				<div className='horosa-huangji-field-title' style={{ marginTop: 8 }}>用事日期</div>
				<div className='horosa-tongshu-date'>
					<DateTimeSelector value={dateValue} defaultTimeType='d' showTime={false} showAdjust={true} onChange={onDateChange} />
				</div>

				{needs.event ? (
					<label className='horosa-huangji-select-field is-wide'>
						<span>用事</span>
						<Select value={s.event} dropdownMatchSelectWidth={false} onChange={(v)=> onChange({ event: v })}>
							{TONGSHU_TERM_CATEGORIES.map((cat)=> (
								<Select.OptGroup key={cat} label={cat}>
									{(TONGSHU_TERMS[cat] || []).map((t)=> <Select.Option key={t.name} value={t.name}>{t.name}</Select.Option>)}
								</Select.OptGroup>
							))}
						</Select>
					</label>
				) : null}

				{needs.liexiuUse ? (
					<label className='horosa-huangji-select-field is-wide'>
						<span>用事类</span>
						<Select value={s.liexiuUse} dropdownMatchSelectWidth={false}
							onChange={(v)=> onChange({ liexiuUse: v })} options={LIEXIU_USE_OPTIONS} />
					</label>
				) : null}

				{needs.zuoShan ? (
					<label className='horosa-huangji-select-field is-wide'>
						<span>坐山向</span>
						<Select value={s.zuoShan} dropdownMatchSelectWidth={false}
							onChange={(v)=> onChange({ zuoShan: v })} options={SHAN_OPTIONS} showSearch />
					</label>
				) : null}

				{needs.mingYear ? (
					<label className='horosa-huangji-select-field is-wide'>
						<span>主事仙命年</span>
						<Select value={s.mingYear} dropdownMatchSelectWidth={false}
							onChange={(v)=> onChange({ mingYear: v })} options={MING_OPTIONS} showSearch />
					</label>
				) : null}
			</div>
		);
	}
}
