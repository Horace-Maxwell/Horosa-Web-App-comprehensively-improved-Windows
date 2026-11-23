// 奇门页 · 左栏起盘设置面板
// 从 DunJiaMain.js 按职责拆出的 DunJiaMain 方法:this 仍是 DunJiaMain 实例,门面里 mixinMethods(DunJiaMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Modal } from 'antd';
import { XQButton as Button, XQSelect as Select, XQSideSection } from '../../xq-ui';
import DateTime from '../../comp/DateTime';
import { QimenOverlayFields, JianChuField } from '../QimenOverlayControls';
import SpaceTimePanel from '../../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import { SEX_OPTIONS, PAIPAN_OPTIONS, YUEJIA_QIJU_OPTIONS, ZHISHI_OPTIONS, qijuMethodOptionsFor, FEI_MEN_ZHONG_CAN_LABELS, MIX_LAYER_LABELS, mixLayerDefaultLabel, qijuMethodSelectValue, ZHIRUN_LEAP_OPTIONS, GODS_PRESET_OPTIONS, ANGAN_MODE_OPTIONS, JIGONG_MODE_OPTIONS, SHIFT_ZHIFU_OPTIONS, DAYJIA_JU_OPTIONS, YEARJIA_JU_OPTIONS, KEJIA_FENDUN_OPTIONS, JINHAN_MENPAI_OPTIONS, SCHOOL_OPTIONS, KONG_MODE_OPTIONS, MA_MODE_OPTIONS, TIME_ALG_OPTIONS, YIXING_OPTIONS, DAY_SWITCH_OPTIONS, CHART_CATEGORY_OPTIONS, qijuMethodUsesJieqiFa } from '../DunJiaCalc';
import { FENGJU_OPTIONS } from './options';
import { normalizeTimeAlg, savePatternInterpretationPreference } from './pageState';
const { Option } = Select;

export const inputPanelMethods = {
	renderInputPanel(){
		const opt = this.state.options;
		const showPatternInterpretation = this.state.showPatternInterpretation !== false;
		const fields = this.state.localFields || this.props.fields || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div className="horosa-dunjia-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">遁甲设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与起盘选项</div>
					</div>
				</div>
				{/* [择日宿主] 左栏插槽(主奇门页不传=零渲染);位置与六壬 / 太乙 / 三式一致:标题下、时间地点上 */}
				{typeof this.props.renderLeftExtra === 'function'
					? this.props.renderLeftExtra({ fields: this.state.localFields || this.props.fields, options: this.state.options })
					: null}
				{/* 遁甲左栏两段式:时间地点(不折叠)/起盘选项(折叠记忆);内容结构零变 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					onStepSelect={this.prefetchStepSelect}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="起盘选项" storageKey="dunjia.options" className="horosa-side-input-section">
				<div className="horosa-side-fields-inner">
					<div className="horosa-dunjia-select-grid">
						<label className="horosa-dunjia-select-field">
							<span>排盘</span>
							<Select size="small" value={opt.paiPanType} onChange={(v)=>this.onOptionChange('paiPanType', v)}>
								{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>起局</span>
							<Select
								size="small"
								value={qijuMethodSelectValue(opt.paiPanType, opt.qijuMethod)}
								onChange={(v)=>this.onOptionChange('qijuMethod', v)}
							>
								{qijuMethodOptionsFor(opt.paiPanType).map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>盘式</span>
							<Select size="small" value={opt.school || '转盘'} onChange={(v)=>this.onOptionChange('school', v)}>
								{SCHOOL_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.qijuMethod === 'shuzi' ? (
							<label className="horosa-dunjia-select-field is-wide">
								<span>报数</span>
								<input
									value={opt.shuziReportNumber || ''}
									onChange={(e)=>this.onOptionChange('shuziReportNumber', e.target.value)}
									placeholder="阴盘起局:输入报数(各位求和÷9定局,余0作9)"
									inputMode="numeric"
									style={{ flex: 1, minWidth: 120, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, #d9d9d9)', background: 'var(--horosa-surface-solid, #fff)', color: 'var(--horosa-text, #262626)' }}
								/>
							</label>
						) : null}
						<label className="horosa-dunjia-select-field">
							<span>盘类</span>
							<Select size="small" value={this.state.chartCategory} onChange={this.onChartCategoryChange}>
								{CHART_CATEGORY_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>月家起局</span>
							<Select size="small" value={opt.yueJiaQiJuType} optionLabelProp="label" disabled={opt.paiPanType !== 1} onChange={(v)=>this.onOptionChange('yueJiaQiJuType', v)}>
								{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={item.value} value={item.value} label={item.short || item.label}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.paiPanType === 0 ? (
							<label className="horosa-dunjia-select-field">
								<span>年家定局</span>
								<Select size="small" value={opt.yearJiaJu || 'sanyuan'} onChange={(v)=>this.onOptionChange('yearJiaJu', v)} dropdownMatchSelectWidth={false}>
									{YEARJIA_JU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{opt.paiPanType === 2 ? (
							<label className="horosa-dunjia-select-field">
								<span>日家定局</span>
								<Select size="small" value={opt.dayJiaJu || 'yiyuan'} onChange={(v)=>this.onOptionChange('dayJiaJu', v)} dropdownMatchSelectWidth={false}>
									{DAYJIA_JU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{opt.paiPanType === 4 ? (
							<>
								<label className="horosa-dunjia-select-field">
									<span>刻家分遁</span>
									<Select size="small" value={opt.keJiaFenDun || 'zihou'} onChange={(v)=>this.onOptionChange('keJiaFenDun', v)} dropdownMatchSelectWidth={false}>
										{KEJIA_FENDUN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-dunjia-select-field">
									<span>子正换时</span>
									<Select size="small" value={opt.keZiZhengHuanShi ? 1 : 0} onChange={(v)=>this.onOptionChange('keZiZhengHuanShi', v === 1)}>
										<Option value={0}>子时23点起(默认)</Option>
										<Option value={1}>子正0点换时</Option>
									</Select>
								</label>
							</>
						) : null}
						{opt.paiPanType === 6 ? (
							<label className="horosa-dunjia-select-field">
								<span>八门排法</span>
								<Select size="small" value={opt.jinhanMenPai || 'book'} onChange={(v)=>this.onOptionChange('jinhanMenPai', v)} dropdownMatchSelectWidth={false}>
									{JINHAN_MENPAI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						<label className="horosa-dunjia-select-field">
							<span>值使</span>
							{/* 飞盘/混合档值使门宫由飞宫定序直出(FEI_GATE_HOME),取法开关不进该链 → 置灰防死开关假象 */}
							<Select size="small" value={opt.zhiShiType} disabled={['飞盘', '混合'].indexOf(opt.school) >= 0}
								onChange={(v)=>this.onOptionChange('zhiShiType', v)}>
								{ZHISHI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>空亡</span>
							<Select size="small" value={opt.kongMode} onChange={(v)=>this.onOptionChange('kongMode', v)}>
								{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>空亡标注</span>
							<Select size="small" value={opt.kongMarkBoth ? 1 : 0} onChange={(v)=>this.onOptionChange('kongMarkBoth', v === 1)}>
								<Option value={0}>单一模式(默认)</Option>
								<Option value={1}>日空时空并标</Option>
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>四柱空亡</span>
							<Select size="small" value={opt.showAllKong ? 1 : 0} onChange={(v)=>this.onOptionChange('showAllKong', v === 1)}>
								<Option value={0}>不显示(默认)</Option>
								<Option value={1}>显示年月日时空</Option>
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>驿马</span>
							<Select size="small" value={opt.yimaMode} onChange={(v)=>this.onOptionChange('yimaMode', v)}>
								{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>性别</span>
							<Select size="small" value={opt.sex} onChange={this.onGenderChange}>
								{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>移星</span>
							<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.onOptionChange('shiftPalace', v)}>
								{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.shiftPalace ? (
							<label className="horosa-dunjia-select-field">
								<span>移星值符</span>
								<Select size="small" value={opt.shiftZhiFuMode || 'follow'} onChange={(v)=>this.onOptionChange('shiftZhiFuMode', v)} dropdownMatchSelectWidth={false}>
									{SHIFT_ZHIFU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						<label className="horosa-dunjia-select-field">
							<span>日界</span>
							<Select size="small" value={opt.after23NewDay} onChange={(v)=>this.onOptionChange('after23NewDay', v)}>
								{DAY_SWITCH_OPTIONS.map((item)=><Option key={`day_switch_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>时间算法</span>
							<Select size="small" value={normalizeTimeAlg(opt.timeAlg)} onChange={(v)=>this.onOptionChange('timeAlg', v)}>
								{TIME_ALG_OPTIONS.map((item)=><Option key={`time_alg_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>封局</span>
							<Select size="small" value={opt.fengJu ? 1 : 0} onChange={(v)=>this.onOptionChange('fengJu', v === 1)}>
								{FENGJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{/* 寄干 / 天禽 / 推演显示 / 推演用神宫:是显示方式不是传本口径 —— 放左栏,与三式合一页同位、同一组控件(QimenOverlayControls) */}
						<QimenOverlayFields opt={opt} onOptionChange={this.onOptionChange} fieldClass="horosa-dunjia-select-field" />
						<JianChuField opt={opt} onOptionChange={this.onOptionChange} fieldClass="horosa-dunjia-select-field" />
						<div className="horosa-dunjia-toggle-field">
							<span>格局释义</span>
							<Button
								type={showPatternInterpretation ? 'primary' : 'default'}
								onClick={()=>{
									const next = !showPatternInterpretation;
									this.setState({ showPatternInterpretation: next });
									savePatternInterpretationPreference(next);
								}}
							>
								{showPatternInterpretation ? '显示' : '隐藏'}
							</Button>
						</div>
						<div className="horosa-dunjia-toggle-field">
							<span>设置</span>
							<Button onClick={()=>this.setState({ showSettings: true })}>传本设置</Button>
						</div>
						<Modal
							title="奇门·传本设置(手动自定义)"
							open={!!this.state.showSettings}
							onOk={()=>this.setState({ showSettings: false })}
							onCancel={()=>this.setState({ showSettings: false })}
							okText="完成"
							cancelText="关闭"
							width={380}
							wrapClassName="horosa-dunjia-settings-modal"
						>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
								{/* 置闰天数只作用于「置闰」起局法下的时家 / 刻家(年 / 月 / 日家与金函系不走此链)→ 不适用时不显示(与三式同一判据) */}
								{opt.qijuMethod === 'zhirun' && qijuMethodUsesJieqiFa(opt.paiPanType === undefined || opt.paiPanType === null || opt.paiPanType === '' ? 3 : opt.paiPanType) ? (
								<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
									<span style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)' }}>置闰天数(超神接气置闰法·传本差异)</span>
									<Select size="small" value={opt.zhirunLeapDays || 9} optionLabelProp="label" onChange={(v)=>this.onOptionChange('zhirunLeapDays', v)}>
										{ZHIRUN_LEAP_OPTIONS.map((item)=><Option key={item.value} value={item.value} label={item.short || item.label}>{item.label}</Option>)}
									</Select>
								</label>
								) : null}
								{/* 八神取神/暗干族(传本口径) */}
								<label className="horosa-dunjia-select-field is-wide">
									<span>八神取神</span>
									<Select size="small" value={opt.godsPreset || 'baihu_xuanwu'} onChange={(v)=>this.onOptionChange('godsPreset', v)} dropdownMatchSelectWidth={false}>
										{GODS_PRESET_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-dunjia-select-field is-wide">
									<span>中宫寄宫</span>
									<Select size="small" value={opt.jiGongMode || 'kun'} onChange={(v)=>this.onOptionChange('jiGongMode', v)} dropdownMatchSelectWidth={false}>
										{JIGONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-dunjia-select-field is-wide">
									<span>暗干</span>
									<Select size="small" value={opt.anGanMode || 'off'} onChange={(v)=>this.onOptionChange('anGanMode', v)} dropdownMatchSelectWidth={false}>
										{ANGAN_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-dunjia-select-field is-wide">
									<span>暗支(随暗干)</span>
									<Select size="small" value={opt.showAnZhi ? 1 : 0} onChange={(v)=>this.onOptionChange('showAnZhi', v === 1)}>
										<Option value={0}>不显示</Option>
										<Option value={1}>显示</Option>
									</Select>
								</label>
								<label className="horosa-dunjia-select-field is-wide">
									<span>词条标题全名</span>
									<Select size="small" value={opt.fullNameTips ? 1 : 0} onChange={(v)=>this.onOptionChange('fullNameTips', v === 1)}>
										<Option value={0}>简称(默认)</Option>
										<Option value={1}>带星/门/神全名</Option>
									</Select>
								</label>
								{/* 飞盘细项(仅飞盘/混合盘式生效) */}
								{(opt.school === '飞盘' || opt.school === '混合') ? (
									<>
									<label className="horosa-dunjia-select-field is-wide">
										<span>九星飞法</span>
										<Select size="small" value={opt.feiXingShun ? 1 : 0} onChange={(v)=>this.onOptionChange('feiXingShun', v === 1)}>
											<Option value={0}>阳顺阴逆(默认)</Option>
											<Option value={1}>两遁皆顺飞</Option>
										</Select>
									</label>
									<label className="horosa-dunjia-select-field is-wide">
										<span>九门飞法</span>
										<Select size="small" value={opt.feiMenShun ? 1 : 0} onChange={(v)=>this.onOptionChange('feiMenShun', v === 1)}>
											<Option value={0}>阳顺阴逆(默认)</Option>
											<Option value={1}>两遁皆顺飞</Option>
										</Select>
									</label>
									<label className="horosa-dunjia-select-field is-wide">
										<span>九神飞法</span>
										<Select size="small" value={opt.feiShenShun ? 1 : 0} onChange={(v)=>this.onOptionChange('feiShenShun', v === 1)}>
											<Option value={0}>阳顺阴逆(默认)</Option>
											<Option value={1}>两遁皆顺飞</Option>
										</Select>
									</label>
									<label className="horosa-dunjia-select-field is-wide">
										<span>中门飞宫</span>
										<Select size="small" value={opt.feiMenZhongCan === false ? 1 : 0} onChange={(v)=>this.onOptionChange('feiMenZhongCan', v === 0)}>
											<Option value={0}>{FEI_MEN_ZHONG_CAN_LABELS.on}</Option>
											<Option value={1}>{FEI_MEN_ZHONG_CAN_LABELS.off}</Option>
										</Select>
									</label>
									{opt.feiMenZhongCan === false ? (
										<label className="horosa-dunjia-select-field is-wide">
											<span>中宫门位显示</span>
											<Select size="small" value={opt.feiMenZhongShow ? 1 : 0} onChange={(v)=>this.onOptionChange('feiMenZhongShow', v === 1)}>
												<Option value={0}>留空(默认)</Option>
												<Option value={1}>标「中」字样</Option>
											</Select>
										</label>
									) : null}
									</>
								) : null}
								{/* 混合盘四层自由装配 */}
								{opt.school === '混合' ? (
									<>
										{[['mixTian', '天盘层', 'zhuan'], ['mixXing', '九星层', 'zhuan'], ['mixMen', '八门层', 'fei'], ['mixShen', '九神层', 'fei']].map(([key, name, dft])=>(
											<label key={key} className="horosa-dunjia-select-field is-wide">
												<span>{name}</span>
												<Select size="small" value={opt[key] || ''} onChange={(v)=>this.onOptionChange(key, v)} dropdownMatchSelectWidth={false}>
													<Option value="">{mixLayerDefaultLabel(dft)}</Option>
													<Option value="zhuan">{MIX_LAYER_LABELS.zhuan}</Option>
													<Option value="fei">{MIX_LAYER_LABELS.fei}</Option>
												</Select>
											</label>
										))}
									</>
								) : null}
								<div style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)', lineHeight: 1.6 }}>{opt.qijuMethod === 'zhirun' && qijuMethodUsesJieqiFa(opt.paiPanType === undefined || opt.paiPanType === null || opt.paiPanType === '' ? 3 : opt.paiPanType) ? '本项（置闰天数）仅影响「置闰」起局法，其余设置项各按自身说明生效;默认口径=超神满 9 天(≥9)即闰。' : ''}改后中栏盘与右栏信息即时按所选重排。</div>
							</div>
						</Modal>
						<label className="horosa-dunjia-select-field is-wide">
							<span>相关人员</span>
							<Select
								size="small"
								mode="multiple"
								allowClear
								value={(this.state.faRelatedPeople || []).map((p)=>p.cid)}
								placeholder="从命盘库选择（可多人，护其生年干）"
								optionFilterProp="label"
								onChange={this.onRelatedPeopleChange}
							>
								{this.getRelatedPeopleOptions().map((item)=><Option key={item.value} value={item.value} label={item.label}>{item.label}</Option>)}
							</Select>
						</label>
					</div>
					<div className="horosa-dunjia-action-row">
						<Button type="primary" onClick={this.clickPlot} loading={this.state.loading} disabled={this.state.loading}>起盘</Button>
						<Button onClick={this.clickSaveCase}>保存</Button>
					</div>
				</div>
				</XQSideSection>
			</div>
		);
	},
};
