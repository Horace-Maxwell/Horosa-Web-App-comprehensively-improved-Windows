// 日子馆左栏：事项 + 时间范围 + 多命主八字输入（本人/配偶/家人），受控组件。
import React, { Component } from 'react';
import { XQSelect as Select, XQButton, XQSegmented, XQSideSection, XQInput as Input } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import DateTimeSelector from '../comp/DateTimeSelector';
import { EVENT_CATEGORIES } from './tongshuData';

const EVENT_OPTIONS = EVENT_CATEGORIES.map((c)=> ({ value: c.key, label: c.label }));
const GENDER_OPTIONS = [{ value: 1, label: '男' }, { value: 0, label: '女' }];
const ROLE_LABEL = { self: '本人', spouse: '配偶', family: '家人' };

export default class RiziControls extends Component {
	render() {
		const { event, year, yearOptions, persons, onChange, onPersonChange, onAddPerson, onRemovePerson } = this.props;
		const hasSpouse = (persons || []).some((p)=> p.role === 'spouse');
		return (
			<div className='horosa-rizi-controls'>
				{/* 观象左栏 P2:field-title 双节收编 XQSideSection;加人按钮走节头 extra(自带 stopPropagation 防误折叠)。 */}
				<XQSideSection iconName={sideSectionIcon('target')} title="日子馆 · 个性化择日" collapsible={false}>
				<label className='horosa-huangji-select-field is-wide'>
					<span>事项</span>
					<Select value={event} dropdownMatchSelectWidth={false} onChange={(v)=> onChange({ event: v })} options={EVENT_OPTIONS} />
				</label>
				<label className='horosa-huangji-select-field is-wide'>
					<span>年份</span>
					<Select value={year} dropdownMatchSelectWidth={false} onChange={(v)=> onChange({ year: v })} options={yearOptions} />
				</label>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('input')} title="当事人 · 多命主取交集" storageKey="rizi.persons" className="horosa-side-input-section"
					extra={(
						<div className='horosa-rizi-addbtns'>
							{!hasSpouse ? <XQButton onClick={()=> onAddPerson('spouse')}>+ 配偶</XQButton> : null}
							<XQButton onClick={()=> onAddPerson('family')}>+ 家人</XQButton>
						</div>
					)}>

				{(persons || []).map((p)=> (
					<div key={p.id} className='horosa-rizi-person'>
						<div className='horosa-rizi-person-head'>
							<span className='horosa-rizi-person-role'>{ROLE_LABEL[p.role] || p.role}</span>
							<Input size='small' placeholder='姓名(可选)' value={p.name} className='horosa-rizi-person-name'
								onChange={(e)=> onPersonChange(p.id, { name: e.target.value })} />
							<XQSegmented value={p.gender} options={GENDER_OPTIONS} onChange={(e)=> onPersonChange(p.id, { gender: e.target.value })} />
							{p.role !== 'self' ? (
								<XQButton variant='ghost' onClick={()=> onRemovePerson(p.id)}>删除</XQButton>
							) : null}
						</div>
						<DateTimeSelector value={p.date} showTime={true} showAdjust={true}
							onChange={(dt)=> onPersonChange(p.id, { date: dt.value })} />
					</div>
				))}
				</XQSideSection>
			</div>
		);
	}
}
