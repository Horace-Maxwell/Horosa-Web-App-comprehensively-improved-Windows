// 策天页 · 左栏起盘设置面板(中栏内容选择、四柱改写)
// 从 KinAstroMain.js 按职责拆出的 KinAstroMain 方法:this 仍是 KinAstroMain 实例,门面里 mixinMethods(KinAstroMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Input } from 'antd';
import { SCHOOL_LABEL as ZHENGCHUAN_SCHOOL_LABEL } from '../../shusuan/zhengchuanSchools';
import YanQinControls from '../../yanqin/YanQinControls';
import { tiebanKeOptions, clampTiebanKe } from '../../../utils/tiebanFrameworkLocal';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../../comp/SpaceTimePanel';
import { XQButton as Button, XQSelect as Select, XQSideSection, XQSwitch as Switch, XQCheckbox, XQInputNumber } from '../../xq-ui';
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { normBinaryGender } from '../../../utils/kinAstroFieldsSync';
import { BEIJI_KE_OPTIONS, NANJI_SECTION_OPTIONS, NANJI_JIANCHU_OPTIONS, NANJI_XIU_OPTIONS, NANJI_PASSWORD_OPTIONS, NANJI_CHART_OPTIONS, CHUNZI_KE_OPTIONS, CHUNZI_RESULT_LIMIT_OPTIONS, CHUNZI_MANSION_OPTIONS, SHAOZI_KE_OPTIONS, ZC_ITEMS, ZC_SOUNDS, ZC_KE, ZC_GONG, ZC_DAY_ZHI, zcEnvOptionsFor, zcEnvShown } from '../kinastroOptions';
import { CETIAN_LIUNIAN_YEARS, BRANCH_NAMES, NANJI_PALACE_OPTIONS, STEM_NAMES, KIN_CENTER_CONTENT_KEY } from './config';
import { readKinCenterContent } from './ziweiChart';
import { YZJ_PRESET_LABELS, YZJ_PRESET_ORDER, cetianDisplayToggles } from './settings';
const { Option } = Select;

export const inputPanelMethods = {
	// 中宫内容三档下拉(策天/演禽共用一段;档位各自持久化,见 KIN_CENTER_CONTENT_KEY)。
	// 纯显示层:只写 LS + setState 触发重渲染,不重新起盘(盘算与中宫画什么无关)。
	renderCenterContentSelect(){
		const key = KIN_CENTER_CONTENT_KEY[this.config.serviceKey];
		if(!key){ return null; }
		const val = readKinCenterContent(this.config.serviceKey);
		return (
			<label className="horosa-huangji-select-field is-wide">
				<span title="中宫(盘心)显示什么">中宫内容</span>
				<Select
					value={val}
					onChange={(v)=>{ safeLocalStorageSet(key, v); this.setState({ centerContentRev: (this.state.centerContentRev || 0) + 1 }); }}
				>
					<Option value="clean">简洁</Option>
					<Option value="bazi">四柱要素</Option>
					<Option value="full">全量信息</Option>
				</Select>
			</label>
		);
	},

	renderPillarOverrideFields(){
		if(!['shaozi', 'tieban'].includes(this.config.serviceKey) || this.state.pillarOverride !== '1'){
			return null;
		}
		const fields = [
			{ key: 'yearGz', label: '年柱', placeholder: '甲子' },
			{ key: 'monthGz', label: '月柱', placeholder: '丙寅' },
			{ key: 'dayGz', label: '日柱', placeholder: '戊辰' },
			{ key: 'hourGz', label: '时柱', placeholder: '庚午' },
		];
		return fields.map((item)=>(
			<label className="horosa-huangji-select-field" key={item.key}>
				<span>{item.label}</span>
				<Input
					value={this.state[item.key]}
					placeholder={item.placeholder}
					maxLength={2}
					onChange={(event)=>this.setUserOpt({ [item.key]: event.target.value })}
				/>
			</label>
		));
	},

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		return (
			<div className="horosa-huangji-input-stack horosa-kinastro-input-stack">
				<div>
					<div className="horosa-side-panel-title">{this.config.pageTitle}设置</div>
					<div className="horosa-side-panel-subtitle">时间、命盘与技法选项</div>
				</div>
				{/* KinAstro 母版分段:时间地点(不折叠)/技法选项(折叠记忆);内容结构零变 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={fields}
						value={datetm}
						timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
						onTimeChange={this.onTimeChanged}
						onStepSelect={this.prefetchStepSelect}
						onGeoChange={this.changeGeo}
						timeHook={this.timeHook}
						showLocation={this.config.serviceKey === 'cetian'}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title={`${this.config.techniqueLabel}选项`} storageKey={`kin.${this.config.serviceKey}.options`} className="horosa-side-input-section">
				<div className="horosa-side-fields-inner">
					<div className={`horosa-huangji-select-grid horosa-kinastro-select-grid horosa-kinastro-select-grid-${this.config.serviceKey}`}>
						{this.config.serviceKey !== 'xianqin' ? (
							<label className="horosa-huangji-select-field" title={this.config.serviceKey === 'fendjing' ? '鬼谷分定经的起卦与条文不分男女,性别只写进起盘信息一行' : undefined}>
								<span>性别{this.config.serviceKey === 'fendjing' ? '（仅标注）' : ''}</span>
								{/* 鬼谷 compute 无性别参数(只回显起盘行):标签注明,不误导为断法输入 */}
								<Select value={normBinaryGender(this.state.gender)} onChange={(value)=>this.setUserOpt({ gender: value })}>
									<Option value="1">男</Option>
									<Option value="0">女</Option>
								</Select>
							</label>
						) : null}
						{this.config.serviceKey === 'cetian' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>算法</span>
									<Select value={this.state.cetianMethod} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianMethod: value }, this.clickPlot)}>
										<Option value="book" label="书法">书法·策天本法</Option>
										<Option value="kentang" label="原法">原法·标准紫微</Option>
									</Select>
								</label>
								{this.state.cetianMethod === 'kentang' ? (
									<>
										<label className="horosa-huangji-select-field">
											<span>农历</span>
											<Select value={this.state.cetianLunarMode} onChange={(value)=>this.setUserOpt({ cetianLunarMode: value }, this.clickPlot)}>
												<Option value="sxtwl">天文历算(修正)</Option>
												<Option value="classic">原(闰月旧法)</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span>正曜</span>
											<Select value={this.state.cetianStarOrder} onChange={(value)=>this.setUserOpt({ cetianStarOrder: value }, this.clickPlot)}>
												<Option value="reverse">逆布(书)</Option>
												<Option value="forward">顺布(原)</Option>
											</Select>
										</label>
									</>
								) : (
									<>
										<label className="horosa-huangji-select-field">
											<span title="庙旺口径（两古籍分歧）">庙旺</span>
											<Select value={this.state.cetianBrightnessSchool} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianBrightnessSchool: value }, this.clickPlot)}>
												<Option value="yiyu" label="移语本">移语本·诸星格</Option>
												<Option value="quanji" label="全集本">全集本·诗诀</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span title="身宫取整口径">身宫</span>
											<Select value={this.state.cetianShenGongMode} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianShenGongMode: value }, this.clickPlot)}>
												<Option value="yizheng" label="引证图">引证图口径</Option>
												<Option value="literal" label="正文直读">正文直读</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span title="大限起宫口径">大限</span>
											<Select value={this.state.cetianDaxianMode} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianDaxianMode: value }, this.clickPlot)}>
												<Option value="yiyu" label="阳命阴身">阳年从命·阴年从身</Option>
												<Option value="legacy" label="旧口径">顺从命·逆从身(旧)</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span title="天罗地网起法">罗网</span>
											<Select value={this.state.cetianTianluoMode} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianTianluoMode: value }, this.clickPlot)}>
												<Option value="benshu" label="本书月日">本书·月日法</Option>
												<Option value="zhongtian" label="中天太极">中天太极·月时法</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span title="宫名体系">宫名</span>
											<Select value={this.state.cetianPalaceNameMode} optionLabelProp="label" onChange={(value)=>this.setUserOpt({ cetianPalaceNameMode: value }, this.clickPlot)}>
												<Option value="common" label="通行">通行十二宫</Option>
												<Option value="monk" label="僧道">僧道起法</Option>
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span>流年</span>
											<Select
												value={this.state.cetianLiunianYear}
												onChange={(value)=>this.setUserOpt({ cetianLiunianYear: value }, this.clickPlot)}
												showSearch
												optionFilterProp="children"
											>
												{CETIAN_LIUNIAN_YEARS.map((y)=><Option value={y} key={y}>{y}年</Option>)}
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span title="流年七煞起法">七煞</span>
											<Select value={this.state.cetianLiunianQishaMode} onChange={(value)=>this.setUserOpt({ cetianLiunianQishaMode: value }, this.clickPlot)}>
												<Option value="shengshi">生时法</Option>
												<Option value="suishu">岁数法</Option>
											</Select>
										</label>
									</>
								)}
																<div className="horosa-ziwei-option-card horosa-ziwei-display-card horosa-cetian-display-card">
									{cetianDisplayToggles(this.state.cetianMethod).map(([key, label, title])=>(
										<XQCheckbox key={key} checked={!!this.state[key]} onChange={(e)=>this.setUserOpt({ [key]: e.target.checked ? 1 : 0 }, this.clickPlot)} title={title}>{label}</XQCheckbox>
									))}
								</div>
{/* 原此处一段口径提要已按「左边栏永不放大段解释」铁律移入帮助文档「命·其他」手册的「策天飞星」章。 */}
								{this.renderCenterContentSelect()}
							</>
						) : null}
						{this.config.serviceKey === 'shaozi' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>刻数</span>
									<Select value={this.state.ke} onChange={(value)=>this.setUserOpt({ ke: value })}>
										{SHAOZI_KE_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>64钥匙细调</span>
									<Select value={this.state.useKey} onChange={(value)=>this.setUserOpt({ useKey: value })}>
										<Option value="1">启用</Option>
										<Option value="0">关闭</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>四柱覆写</span>
									<Select value={this.state.pillarOverride} onChange={(value)=>this.setUserOpt({ pillarOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动覆写</Option>
									</Select>
								</label>
								{this.renderPillarOverrideFields()}
							</>
						) : null}
						{this.config.serviceKey === 'canping' ? (
							<>
								<label className="horosa-huangji-select-field is-wide">
									<span>取法</span>
									<Select value={this.state.canpingMethod} onChange={(value)=>this.setUserOpt({ canpingMethod: value })}>
										<Option value="ming">明法（月支反向）</Option>
										<Option value="gu">古法（八字日支）</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>大运排法</span>
									<Select value={this.state.canpingDayun} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ canpingDayun: value })}>
										<Option value="mingGongQiyun">命宫顺行 · 生日推起运</Option>
										<Option value="mingGongOne">命宫顺行 · 恒一岁起</Option>
										<Option value="baziStyle">八字大运法（与八字盘同源）</Option>
									</Select>
								</label>
								{/* 大运排法三档的口径分歧详见帮助文档「数算」手册的「邵子参评数」章——「左边栏永不放大段解释」铁律。 */}
							</>
						) : null}
						{this.config.serviceKey === 'heluo' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>取数法</span>
										<Select value={this.state.heluoZiShu} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoZiShu: value })}>
											<Option value="pair">成对全取</Option>
											<Option value="single">每支取一</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>五寄中宫</span>
										<Select value={this.state.heluoJiGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoJiGong: value })}>
											<Option value="manualSanYuan">三元表</Option>
											<Option value="legacy">旧法·性别</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>取化工法</span>
										<Select value={this.state.heluoQuHuaGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoQuHuaGong: value })}>
											<Option value="tuWangKunGen">土王寄坤艮</Option>
											<Option value="siFangBoOnly">直取四方伯</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>纯乾坤落爻</span>
										<Select value={this.state.heluoPureGanKun} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoPureGanKun: value })}>
											<Option value="current">通行</Option>
											<Option value="alt">抄本异</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>流年次步</span>
										<Select value={this.state.heluoLiunianStep2} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoLiunianStep2: value })}>
											<Option value="ying">应爻法</Option>
											<Option value="sequential">顺行</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>流月起月</span>
										<Select value={this.state.heluoLiuYueMode} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ heluoLiuYueMode: value })}>
											<Option value="ying">应爻校准</Option>
											<Option value="legacy">现行序</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>三至尊卦</span>
										<Switch checked={this.state.heluoZhiZun} onChange={(v)=>this.setUserOpt({ heluoZhiZun: v })} />
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>流月列流日</span>
										<Switch checked={this.state.heluoShowLiuRi} onChange={(v)=>this.setUserOpt({ heluoShowLiuRi: v })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>纪年基准（黄帝纪元差，默认 2697）</span>
										<XQInputNumber min={0} max={16799} value={Number.isFinite(parseInt(this.state.heluoHuangdiOffset, 10)) ? parseInt(this.state.heluoHuangdiOffset, 10) : 2697} onChange={(v)=>this.setUserOpt({ heluoHuangdiOffset: `${(v === null || v === undefined || v === '') ? 2697 : v}` })} />   {/* 0 可达 */}
									</label>
									{/* 九项默认口径与各档差异详见帮助文档「数算」手册的「河洛理数」章——「左边栏永不放大段解释」铁律。 */}
								</>
							) : null}
							{this.config.serviceKey === 'zhengchuan' ? (
									<>
										<label className="horosa-huangji-select-field is-wide">
											<span>流派</span>
											<Select value={this.state.zhengchuanSchool} onChange={(value)=>this.setUserOpt({ zhengchuanSchool: value })}>
												{Object.keys(ZHENGCHUAN_SCHOOL_LABEL).map((k)=>(
													<Option key={k} value={k}>{ZHENGCHUAN_SCHOOL_LABEL[k]}</Option>
												))}
											</Select>
										</label>
										{this.state.zhengchuanSchool === 'tieban' ? (
											<label className="horosa-huangji-select-field is-wide">
												<span>求测时辰（干支，留空取本人时柱）</span>
												<Input value={this.state.zhengchuanAskGz} maxLength={2} placeholder="如 丙辰"
													onChange={(e)=>this.setUserOpt({ zhengchuanAskGz: e.target.value })} />
											</label>
										) : null}
										{this.state.zhengchuanSchool === 'shaozi' ? (
											<>
												<label className="horosa-huangji-select-field">
													<span>父生我时年龄</span>
													<XQInputNumber min={12} max={99} value={parseInt(this.state.zhengchuanFatherAge, 10) || 27}
														onChange={(v)=>this.setUserOpt({ zhengchuanFatherAge: `${v || 27}` })} />
												</label>
												<label className="horosa-huangji-select-field">
													<span>母生我时年龄</span>
													<XQInputNumber min={12} max={99} value={parseInt(this.state.zhengchuanMotherAge, 10) || 26}
														onChange={(v)=>this.setUserOpt({ zhengchuanMotherAge: `${v || 26}` })} />
												</label>
												<label className="horosa-huangji-select-field">
													<span>元运（先天命卦余五特例）</span>
													<Select value={this.state.zhengchuanYuan} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanYuan: value })}>
														<Option value="shang">上元</Option>
														<Option value="zhong">中元</Option>
														<Option value="xia">下元</Option>
													</Select>
												</label>
											</>
										) : null}
										{this.state.zhengchuanSchool === 'dading' ? this.renderDadingYearFields() : null}
										{this.state.zhengchuanSchool === 'liuqin' ? (
											<>
											<label className="horosa-huangji-select-field">
												<span>演算时辰（留空取本人时支）</span>
												<Select value={this.state.zhengchuanAskHourZhi} dropdownMatchSelectWidth={false}
													onChange={(value)=>this.setUserOpt({ zhengchuanAskHourZhi: value, zhengchuanEnv: '' })}>
													<Option value="">（取本人时支）</Option>
													{['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map((z)=>(
														<Option key={z} value={z}>{z}时{ZC_DAY_ZHI.indexOf(z) >= 0 ? '（白天·天四象）' : '（昼夜·地四象）'}</Option>
													))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>演算时天象</span>
												<Select value={zcEnvShown(this.zcEffectiveAskHourZhi(), this.state.zhengchuanEnv)} dropdownMatchSelectWidth={false}
													onChange={(value)=>this.setUserOpt({ zhengchuanEnv: value })}>
													<Option value="">（按时辰取首项）</Option>
													{zcEnvOptionsFor(this.zcEffectiveAskHourZhi())
														.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
												</Select>
											</label>
											</>
										) : null}
										{this.state.zhengchuanSchool === 'xinyi' ? (
											<>
											<label className="horosa-huangji-select-field">
												<span>查询项目</span>
												<Select value={this.state.zhengchuanItem} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanItem: value })}>
													{ZC_ITEMS.map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>声音</span>
												<Select value={this.state.zhengchuanSound} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanSound: value })}>
													{ZC_SOUNDS.map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>刻数</span>
												<Select value={this.state.zhengchuanKe} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanKe: value })}>
													{ZC_KE.map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>八宫</span>
												<Select value={this.state.zhengchuanGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanGong: value })}>
													{ZC_GONG.map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>性情项 · 地支</span>
												<Select value={this.state.zhengchuanXqZhi} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanXqZhi: value })}>
													{['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>性情项 · 余数</span>
												<Select value={this.state.zhengchuanXqYushu} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ zhengchuanXqYushu: value })}>
													{Array.from({ length: 12 }, (_, i)=>`${i + 1}`).map((x)=>(<Option key={x} value={x}>{x}</Option>))}
												</Select>
											</label>
											</>
										) : null}
										{/* 五派各自的性质、所缺之格与三支源流详见帮助文档「数算 · 本页直算三门 · 神数正传」诸卡
										    ——「左边栏永不放大段解释」铁律;该处逐派载明,比这里随流派切换的一段摘要更全。 */}
									</>
								) : null}
							{this.config.serviceKey === 'yizhangjing' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>流派预设</span>
										<Select value={this.yzjDeviationCount() > 0 ? 'custom' : this.state.yizhangjingPreset} dropdownMatchSelectWidth={false} onChange={(value)=>{ if(value !== 'custom') this.applyYzjPreset(value); }}>
											{YZJ_PRESET_ORDER.map((k)=><Option key={k} value={k}>{YZJ_PRESET_LABELS[k]}{k === 'michuan' ? '★' : ''}</Option>)}
											{this.yzjDeviationCount() > 0 ? <Option value="custom">自定义</Option> : null}
										</Select>
									</label>
									{this.yzjDeviationCount() > 0 ? (
										<div className="horosa-yizhangjing-devrow">
											<span className="horosa-yizhangjing-devbadge">已改 {this.yzjDeviationCount()} 项</span>
											<button type="button" className="horosa-yizhangjing-restorebtn" onClick={()=>this.applyYzjPreset(this.state.yizhangjingPreset)}>还原「{YZJ_PRESET_LABELS[this.state.yizhangjingPreset]}」</button>
										</div>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>顺逆规则</span>
										<Select value={this.state.yizhangjingShunni} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingShunni: value })}>
											<Option value="yangNanYinNv">阳男阴女</Option>
											<Option value="menShunNvNi">男顺女逆</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>命宫定法</span>
										<Select value={this.state.yizhangjingMingGong} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingMingGong: value })}>
											<Option value="shiShang">时上起命</Option>
											<Option value="shuZhiMao">数至卯</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>定月法</span>
										<Select value={this.state.yizhangjingDingYue} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingDingYue: value })}>
											<Option value="nongli">农历月</Option>
											<Option value="jieqi">节气月</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>闰月细则</span>
										<Select value={this.state.yizhangjingLeapRule} disabled={this.state.yizhangjingDingYue === 'jieqi'} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingLeapRule: value })}>
											<Option value="half">十五折半</Option>
											<Option value="midnight">夜半折半</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>星名系统</span>
										<Select value={this.state.yizhangjingStarNaming} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingStarNaming: value })}>
											<Option value="A">A·主流</Option>
											<Option value="B">B·异名</Option>
											<Option value="C">C·改名</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>六道术语</span>
										<Select value={this.state.yizhangjingDaoTerm} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingDaoTerm: value })}>
											<Option value="gui">鬼道·修罗道</Option>
											<Option value="edao">饿鬼道·阿修罗道</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>品级分类</span>
										<Select value={this.state.yizhangjingGradeSet} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingGradeSet: value })}>
											<Option value="standard">主流</Option>
											<Option value="variant">变体·天驿归凶</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>大限运长</span>
										<Select value={this.state.yizhangjingDayunLen} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingDayunLen: value })}>
											<Option value="7">一宫7年</Option>
											<Option value="10">一宫10年</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>大限起运</span>
										<Select value={this.state.yizhangjingStartAge} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingStartAge: value })}>
											<Option value="mi">秘传起运</Option>
											<Option value="age1">1岁连续</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>逐年法</span>
										<Select value={this.state.yizhangjingAnnual} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingAnnual: value })}>
											<Option value="xiaoxian">小限</Option>
											<Option value="liunian">流年十二神</Option>
										</Select>
									</label>
									{this.state.yizhangjingAnnual !== 'liunian' ? (
																		<label className="horosa-huangji-select-field">
																			<span>小限起宫</span>
																			<Select value={this.state.yizhangjingXiaoStart} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingXiaoStart: value })}>
																				<Option value="ri">日柱宫</Option>
																				<Option value="yue">月柱宫</Option>
																			</Select>
																		</label>
									) : null}
									{this.state.yizhangjingAnnual !== 'liunian' ? (
																		<label className="horosa-huangji-select-field">
																			<span>小限顺逆</span>
																			<Select value={this.state.yizhangjingXiaoDir} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingXiaoDir: value })}>
																				<Option value="chart">随盘向</Option>
																				<Option value="always">一律顺行</Option>
																			</Select>
																		</label>
									) : null}
									{this.state.yizhangjingAnnual !== 'xiaoxian' ? (
																		<label className="horosa-huangji-select-field">
																			<span>流年十二神</span>
																			<Select value={this.state.yizhangjingFlowSet} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingFlowSet: value })}>
																				<Option value="A">甲组·太阳系</Option>
																				<Option value="B">乙组·六合系</Option>
																				<Option value="C">丙组·岁破系</Option>
																			</Select>
																		</label>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>重犯口诀</span>
										<Select value={this.state.yizhangjingChongfan} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ yizhangjingChongfan: value })}>
											<Option value="alpha">常见组</Option>
											<Option value="beta">异传组</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>早子调宫</span>
										<Switch checked={this.state.yizhangjingZaoZi} onChange={(v)=>this.setUserOpt({ yizhangjingZaoZi: v })} />
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>童限</span>
										<Switch checked={this.state.yizhangjingTongxian} onChange={(v)=>this.setUserOpt({ yizhangjingTongxian: v })} />
									</label>
									<label className="horosa-huangji-select-field horosa-heluo-switch-field">
										<span>神煞合参</span>
										<Switch checked={this.state.yizhangjingShensha} onChange={(v)=>this.setUserOpt({ yizhangjingShensha: v })} />
									</label>
									<div className="horosa-yizhangjing-opthelp">各开关取值与差别详见右上「帮助」。</div>
								</>
							) : null}
							{this.config.serviceKey === 'tieban' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>算法</span>
									<Select value={this.state.tiebanMethod} onChange={(value)=>this.setUserOpt({ tiebanMethod: value })}>
										<Option value="kunji">扣入法</Option>
										<Option value="suanpan">算盘打数</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>起运年龄</span>
									<XQInputNumber min={0} max={120} value={this.state.tiebanStartAge} onChange={(value)=>this.setUserOpt({ tiebanStartAge: value || 0 })} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>大运步数</span>
									<XQInputNumber min={1} max={12} precision={0} value={this.state.tiebanDayunSteps} onChange={(value)=>this.setUserOpt({ tiebanDayunSteps: value || 8 })} />
								</label>
								<label className="horosa-huangji-select-field" title="流派只作口径说明(主算柱/卦数偏好/取数/条文存量四项写进框架卡与 AI 分析内容),不改框架推演本身">
									<span>流派（口径说明）</span>
									{/* 基本卦恒取太玄数、框架数序与流派无关;文案如实,不暗示改算 */}
									<Select value={this.state.tiebanSchool} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ tiebanSchool: value })}>
										<Option value="south">南派(岭南)</Option>
										<Option value="north">北派(中州)</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>刻制</span>
									<Select value={this.state.tiebanKeSystem} dropdownMatchSelectWidth={false} onChange={(value)=>{
										// 切刻制后刻位超出新上限(十二刻下的九至十二刻)→ 夹回初刻(引擎本就按初刻算,下拉别露原值)
										const ke = clampTiebanKe(this.state.tiebanKe, value);
										this.setUserOpt(ke !== this.state.tiebanKe ? { tiebanKeSystem: value, tiebanKe: ke } : { tiebanKeSystem: value });
									}}>
										<Option value="qing8">清八刻</Option>
										<Option value="ming100">明百刻</Option>
										<Option value="dou12">十二刻斗宫</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>考刻刻位</span>
									<Select value={clampTiebanKe(this.state.tiebanKe, this.state.tiebanKeSystem)} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ tiebanKe: value })}>
										{/* 刻位上限随刻制(十二刻·斗宫 1–12;清八刻 / 明百刻按八刻框架 1–8),与引擎 / 挂载齿轮同一份 */}
										{tiebanKeOptions(this.state.tiebanKeSystem).map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>双胞胎分</span>
									<Select value={this.state.tiebanTwinFen} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ tiebanTwinFen: value })}>
										<Option value="off">不分</Option>
										<Option value="shang">上分</Option>
										<Option value="zhong">中分</Option>
										<Option value="xia">下分</Option>
									</Select>
								</label>
								<label className="horosa-huangji-select-field horosa-heluo-switch-field">
									<span>过房/养子</span>
									<Switch checked={this.state.tiebanGuofang} onChange={(v)=>this.setUserOpt({ tiebanGuofang: v })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>四柱覆写</span>
									<Select value={this.state.pillarOverride} onChange={(value)=>this.setUserOpt({ pillarOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动覆写</Option>
									</Select>
								</label>
								{this.renderPillarOverrideFields()}
								{/* 父母生卒四格只在扣入法参与考刻(算盘打数分支只收四柱与性别):算盘打数下置灰并 title 注明,不再「可填但不生效」。 */}
								<label className="horosa-huangji-select-field" title={this.state.tiebanMethod === 'suanpan' ? '算盘打数不读父母生卒年;切「扣入法」才参与考刻' : '扣入法据父年天干调整「刻」'}>
									<span>父亲生年</span>
									<XQInputNumber min={1} max={16799} value={this.state.fatherBirthYear} disabled={this.state.tiebanMethod === 'suanpan'} onChange={(value)=>this.setUserOpt({ fatherBirthYear: value })} />
								</label>
								<label className="horosa-huangji-select-field" title={this.state.tiebanMethod === 'suanpan' ? '算盘打数不读父母生卒年;卒年在扣入法下也只记入考刻资料、不参与计算' : '记入考刻资料一并列出;扣入法目前只按父母生年天干调「刻 / 分」,不读卒年'}>
									<span>父亲卒年</span>
									<XQInputNumber min={1} max={16799} value={this.state.fatherDeathYear} disabled={this.state.tiebanMethod === 'suanpan'} onChange={(value)=>this.setUserOpt({ fatherDeathYear: value })} />
								</label>
								<label className="horosa-huangji-select-field" title={this.state.tiebanMethod === 'suanpan' ? '算盘打数不读父母生卒年;切「扣入法」才参与考刻' : '扣入法据母年天干调整「分」'}>
									<span>母亲生年</span>
									<XQInputNumber min={1} max={16799} value={this.state.motherBirthYear} disabled={this.state.tiebanMethod === 'suanpan'} onChange={(value)=>this.setUserOpt({ motherBirthYear: value })} />
								</label>
								<label className="horosa-huangji-select-field" title={this.state.tiebanMethod === 'suanpan' ? '算盘打数不读父母生卒年;卒年在扣入法下也只记入考刻资料、不参与计算' : '记入考刻资料一并列出;扣入法目前只按父母生年天干调「刻 / 分」,不读卒年'}>
									<span>母亲卒年</span>
									<XQInputNumber min={1} max={16799} value={this.state.motherDeathYear} disabled={this.state.tiebanMethod === 'suanpan'} onChange={(value)=>this.setUserOpt({ motherDeathYear: value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>兄弟信息</span>
									<Input value={this.state.siblingsInfo} placeholder="如：兄弟二人" onChange={(event)=>this.setUserOpt({ siblingsInfo: event.target.value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>婚姻状况</span>
									<Input value={this.state.maritalStatus} placeholder="如：已婚" onChange={(event)=>this.setUserOpt({ maritalStatus: event.target.value })} />
								</label>
								<label className="horosa-huangji-select-field is-wide">
									<span>子女信息</span>
									<Input value={this.state.childrenInfo} placeholder="如：二子一女" onChange={(event)=>this.setUserOpt({ childrenInfo: event.target.value })} />
								</label>
							</>
						) : null}
							{this.config.serviceKey === 'fendjing' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>两头钳</span>
									<Select value={this.state.fendjingStemOverride} onChange={(value)=>this.setUserOpt({ fendjingStemOverride: value })}>
										<Option value="0">自动换算</Option>
										<Option value="1">手动指定</Option>
									</Select>
								</label>
								{this.state.fendjingStemOverride === '1' ? (
									<>
										<label className="horosa-huangji-select-field">
											<span>年干</span>
											<Select value={this.state.fendjingYearStem} onChange={(value)=>this.setUserOpt({ fendjingYearStem: value })}>
												{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
											</Select>
										</label>
										<label className="horosa-huangji-select-field">
											<span>时干</span>
											<Select value={this.state.fendjingHourStem} onChange={(value)=>this.setUserOpt({ fendjingHourStem: value })}>
												{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
											</Select>
										</label>
									</>
									) : null}
								</>
							) : null}
							{this.config.serviceKey === 'beiji' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>刻法</span>
										<Select value={this.state.beijiKeMode} onChange={(value)=>this.setUserOpt({ beijiKeMode: value })}>
											<Option value="auto">自动换算</Option>
											<Option value="manual">手动指定</Option>
										</Select>
									</label>
									{this.state.beijiKeMode === 'manual' ? (
										<label className="horosa-huangji-select-field">
											<span>刻</span>
											<Select value={this.state.beijiKe} onChange={(value)=>this.setUserOpt({ beijiKe: value })}>
												{BEIJI_KE_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
											</Select>
										</label>
									) : null}
									<label className="horosa-huangji-select-field is-wide">
										<span>条文码</span>
										<Input
											value={this.state.beijiLookupCode}
											maxLength={4}
											placeholder="如：1111"
											onChange={(event)=>this.setUserOpt({ beijiLookupCode: event.target.value.replace(/\D/g, '').slice(0, 4) })}
										/>
									</label>
									<label className="horosa-huangji-select-field is-wide" title="至少两字才检索;单字不检索">
										<span>关键词{`${this.state.beijiKeyword || ''}`.trim().length === 1 ? '（须 ≥2 字）' : ''}</span>
										{/* 单字曾静默不检索、左栏无提示 */}
										<Input
											value={this.state.beijiKeyword}
											placeholder="如：属鼠、再婚(至少两字)"
											onChange={(event)=>this.setUserOpt({ beijiKeyword: event.target.value })}
										/>
									</label>
								</>
							) : null}
							{this.config.serviceKey === 'nanji' ? (
								<>
									<label className="horosa-huangji-select-field">
										<span>起盘方式</span>
										<Select value={this.state.nanjiMode} onChange={(value)=>this.setUserOpt({ nanjiMode: value })}>
											<Option value="solar">公历精算</Option>
											<Option value="manual">手动古法</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>宫部</span>
										<Select value={this.state.nanjiSection} onChange={(value)=>this.setUserOpt({ nanjiSection: value })}>
											<Option value="" key="_auto">按本命（自出）</Option>
											{NANJI_SECTION_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>建除</span>
										<Select value={this.state.nanjiJianchu} onChange={(value)=>this.setUserOpt({ nanjiJianchu: value })}>
											<Option value="" key="_auto">缺省（建）</Option>
											{NANJI_JIANCHU_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>二十八宿</span>
										<Select value={this.state.nanjiXiu} onChange={(value)=>this.setUserOpt({ nanjiXiu: value })}>
											<Option value="" key="_auto">缺省（角）</Option>
											{NANJI_XIU_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>密码</span>
										<Select value={this.state.nanjiPasswordCode} onChange={(value)=>this.setUserOpt({ nanjiPasswordCode: value })}>
											{NANJI_PASSWORD_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>星图</span>
										<Select value={this.state.nanjiChart} onChange={(value)=>this.setUserOpt({ nanjiChart: value })}>
											{NANJI_CHART_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>推演宫</span>
										<Select value={this.state.nanjiPalace} onChange={(value)=>this.setUserOpt({ nanjiPalace: value })}>
											{NANJI_PALACE_OPTIONS.map((item)=><Option value={item.value} key={item.value || 'auto'}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>宿度</span>
										<XQInputNumber min={0} max={30} step={0.5} value={this.state.nanjiDegree} onChange={(value)=>this.setUserOpt({ nanjiDegree: (value === null || value === undefined || value === '') ? 1 : value })} />   {/* 0 可达 */}
									</label>
									{this.state.nanjiMode === 'manual' ? (
										<>
											<label className="horosa-huangji-select-field">
												<span>历年</span>
												<XQInputNumber min={1} max={16799} value={this.state.nanjiLunarYear} onChange={(value)=>this.setUserOpt({ nanjiLunarYear: value || 2026 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>节月</span>
												<XQInputNumber min={1} max={12} value={this.state.nanjiSolarMonth} onChange={(value)=>this.setUserOpt({ nanjiSolarMonth: value || 1 })} />
											</label>
											{/* 「日」撤:内核只存不读(年柱/月柱/时柱由历年·节月·时支·日干推得),留着即死输入 */}
											<label className="horosa-huangji-select-field">
												<span>时支</span>
												<Select value={this.state.nanjiHourZhi} onChange={(value)=>this.setUserOpt({ nanjiHourZhi: value })}>
													{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
											<label className="horosa-huangji-select-field">
												<span>立春</span>
												<Select value={this.state.nanjiAfterLichun} onChange={(value)=>this.setUserOpt({ nanjiAfterLichun: value })}>
													<Option value="1">立春后</Option>
													<Option value="0">立春前</Option>
												</Select>
											</label>
											<label className="horosa-huangji-select-field" title="自出 = 按左栏出生时刻精算日柱">
												<span>日干</span>
												<Select value={this.state.nanjiDayGan} onChange={(value)=>this.setUserOpt({ nanjiDayGan: value })}>
													<Option value="">自出(按出生时刻)</Option>
													{STEM_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
											<label className="horosa-huangji-select-field" title="自出 = 取本命日支(与日干阴阳不合时不取,会在四柱一栏注明);单独指定日支亦生效(日干留空时取本命日干;与本命日干阴阳不合时不取,按本命日支)">
												<span>日支</span>
												<Select value={this.state.nanjiDayZhi} onChange={(value)=>this.setUserOpt({ nanjiDayZhi: value })}>
													<Option value="">自出(本命日支)</Option>
													{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
												</Select>
											</label>
										</>
									) : null}
								</>
							) : null}
							{this.config.serviceKey === 'chunzi' ? (
								<>
									<label className="horosa-huangji-select-field" title="刻数只显示在起盘信息的「刻法 / 刻」两行和栏位里;原书没有按刻区分的诗句,所以候选条文不随刻变化">
										<span>刻法（仅标注）</span>
										<Select value={this.state.chunziKeMode} onChange={(value)=>this.setUserOpt({ chunziKeMode: value })}>
											<Option value="auto">自动换算</Option>
											<Option value="manual">手动指定</Option>
											<Option value="none">不取刻数</Option>
										</Select>
									</label>
									{this.state.chunziKeMode === 'manual' ? (
										<label className="horosa-huangji-select-field">
											<span>刻数（仅标注）</span>
											<Select value={this.state.chunziKe} onChange={(value)=>this.setUserOpt({ chunziKe: value })}>
												{CHUNZI_KE_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
											</Select>
										</label>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>月日匹配</span>
										<Select value={this.state.chunziLunarMode} onChange={(value)=>this.setUserOpt({ chunziLunarMode: value })}>
											<Option value="auto">随当前日期</Option>
											<Option value="manual">手动月日</Option>
											<Option value="none">关闭</Option>
										</Select>
									</label>
									{this.state.chunziLunarMode === 'manual' ? (
										<>
											<label className="horosa-huangji-select-field">
												<span>农历月</span>
												<XQInputNumber min={1} max={12} value={this.state.chunziLunarMonth} onChange={(value)=>this.setUserOpt({ chunziLunarMonth: value || 1 })} />
											</label>
											<label className="horosa-huangji-select-field">
												<span>农历日</span>
												<XQInputNumber min={1} max={30} value={this.state.chunziLunarDay} onChange={(value)=>this.setUserOpt({ chunziLunarDay: value || 1 })} />
											</label>
										</>
									) : null}
									<label className="horosa-huangji-select-field">
										<span>宿名</span>
										<Select value={this.state.chunziMansion} onChange={(value)=>this.setUserOpt({ chunziMansion: value })}>
											<Option value="" key="_auto">缺省（室）</Option>
											{CHUNZI_MANSION_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>时辰</span>
										<Select value={this.state.chunziHourBranch} onChange={(value)=>this.setUserOpt({ chunziHourBranch: value })}>
											<Option value="" key="_auto">按本命时支</Option>
											{BRANCH_NAMES.map((item)=><Option value={item} key={item}>{item}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>显示数量</span>
										<Select value={this.state.chunziResultLimit} onChange={(value)=>this.setUserOpt({ chunziResultLimit: value })}>
											{CHUNZI_RESULT_LIMIT_OPTIONS.map((item)=><Option value={item.value} key={item.value}>{item.label}</Option>)}
										</Select>
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>条文代码</span>
										<Input value={this.state.chunziLookupCode} placeholder="可批量：毕龙6巳、室巨9未" onChange={(event)=>this.setUserOpt({ chunziLookupCode: event.target.value })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>关键词</span>
										<Input value={this.state.chunziKeyword} placeholder="如：先去父、妻宫" onChange={(event)=>this.setUserOpt({ chunziKeyword: event.target.value })} />
									</label>
									<label className="horosa-huangji-select-field is-wide">
										<span>多标签</span>
										<Input value={this.state.chunziTags} placeholder="逗号分隔，如：先去父,石皮" onChange={(event)=>this.setUserOpt({ chunziTags: event.target.value })} />
									</label>
								</>
							) : null}
							{this.config.serviceKey === 'xianqin' ? (
								<div className="horosa-kinastro-xianqin-options">
								<div className="horosa-kinastro-xianqin-option-row is-method">
									<label className="horosa-huangji-select-field">
										<span>性别</span>
										<Select value={normBinaryGender(this.state.gender)} dropdownMatchSelectWidth={false} onChange={(value)=>this.setUserOpt({ gender: value })}>
											<Option value="1">男</Option>
											<Option value="0">女</Option>
										</Select>
									</label>
									<label className="horosa-huangji-select-field">
										<span>入式历法</span>
										<Select value={this.state.calendarMode} onChange={(value)=>this.setUserOpt({ calendarMode: value })}>
											<Option value="autoLunar">自动换算农历</Option>
											<Option value="manualLunar">手动农历</Option>
											<Option value="solarAsLunar">公历数值入式</Option>
										</Select>
									</label>
								</div>
								<div className="horosa-kinastro-xianqin-option-row is-lunar">
									<label className="horosa-huangji-select-field">
										<span>农历年</span>
										<XQInputNumber min={1} max={16799} value={this.state.lunarYear} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setUserOpt({ lunarYear: value || 2026 })} />
									</label>
									<label className="horosa-huangji-select-field">
										<span>农历月</span>
										<XQInputNumber min={1} max={12} value={this.state.lunarMonth} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setUserOpt({ lunarMonth: value || 1 })} />
									</label>
									<label className="horosa-huangji-select-field">
										<span>农历日</span>
										<XQInputNumber min={1} max={30} value={this.state.lunarDay} disabled={this.state.calendarMode !== 'manualLunar'} onChange={(value)=>this.setUserOpt({ lunarDay: value || 1 })} />
									</label>
								</div>
								{this.renderCenterContentSelect()}
								<YanQinControls />
							</div>
						) : null}
					</div>
				</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
				</div>
			</div>
		);
	},
};
