// 演禽「演法」流派/互锁开关控件 —— 放在左输入栏(与全 app 技法选项一致,全宽 .is-wide)。
// 写 yanqinStore;右侧 YanQinBranchPanel 读同一 store 出结果。
import React, { Component } from 'react';
import { XQSelect as Select, XQSideSection } from '../xq-ui';
import { YANQIN_SCHOOL_OPTIONS, YANQIN_PRESETS, YANQIN_OPTION_META } from './yanqinSchools';
import { getYanqinSettings, setYanqinSchool, setYanqinSwitch, subscribeYanqin } from './yanqinStore';
import './yanqinPanel.less';

export default class YanQinControls extends Component {
	constructor(props) {
		super(props);
		this.state = { advOpen: false };
		this._onStore = () => this.forceUpdate();
	}
	componentDidMount() { this._unsub = subscribeYanqin(this._onStore); }
	componentWillUnmount() { if (this._unsub) { this._unsub(); } }

	render() {
		const s = getYanqinSettings();
		const { advOpen } = this.state;
		const schoolOptions = s.school === 'custom'
			? YANQIN_SCHOOL_OPTIONS.concat([{ value: 'custom', label: '自定义' }])
			: YANQIN_SCHOOL_OPTIONS;
		return (
			<div className="horosa-kinastro-xianqin-yanfa-controls">
				{/* [左栏统一] 收编 XQSideSection(可折叠;裸标题退役) */}
				<XQSideSection iconName="sliders" title="演法设置" storageKey="yanqin.yanfa">
				<label className="horosa-huangji-select-field is-wide">
					<span>流派</span>
					<Select value={s.school === 'custom' ? 'custom' : s.school} dropdownMatchSelectWidth={false}
						onChange={(v) => setYanqinSchool(v)} options={schoolOptions} />
				</label>
				<div className="horosa-kinastro-yanfa-school-note">{(YANQIN_PRESETS[s.school] || {}).note || '自定义开关组合(已偏离预设)'}</div>
				<button type="button" className="horosa-kinastro-yanfa-adv-toggle"
					onClick={() => this.setState({ advOpen: !advOpen })}>
					{advOpen ? '▾ 收起高级(互锁开关)' : '▸ 高级(我彼/位移/年月禽口诀…7 开关)'}
				</button>
				{advOpen ? (
					<div className="horosa-kinastro-yanfa-adv">
						{YANQIN_OPTION_META.map((opt) => (
							<label className="horosa-huangji-select-field is-wide" key={opt.key}>
								<span>{opt.label}</span>
								<Select value={s[opt.key]} dropdownMatchSelectWidth={false}
									onChange={(v) => setYanqinSwitch(opt.key, v)} options={opt.options} />
							</label>
						))}
					</div>
				) : null}
				</XQSideSection>
			</div>
		);
	}
}
