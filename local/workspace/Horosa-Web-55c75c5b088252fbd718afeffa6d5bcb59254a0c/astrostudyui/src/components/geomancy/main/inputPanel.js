// 地占页 · 左栏起卦设置面板与底部快捷栏
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import QuickDockBar from '../../common/QuickDockBar';
import React from 'react';
import { Input } from 'antd';
import { XQButton as Button, XQSelect as Select, XQSideSection, XQCheckbox } from '../../xq-ui';
import SpaceTimePanel, { buildDateTimeFromFields } from '../../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import { QUESITED_HOUSE_OPTIONS, PCHART_ZODIAC_OPTIONS } from '../geomancyOptions';
import { GRANULAR_FIELDS, QUESTION_TYPE_OPTIONS, QUESTION_TYPE_HOUSE, SEED_MODE_OPTIONS, READING_SCOPE_OPTIONS, ZODIAC_SYSTEM_OPTIONS, GEOMANCY_PAGE_SETTINGS } from './tables';
import { parseManualSeedInput, seedDisplayText } from '../../../utils/trueRandom';
const { Option } = Select;
const { TextArea } = Input;

export const inputPanelMethods = {
	renderInputPanel(){
		const r = this.state.result && this.state.result.reading;
		return (
			<div className="horosa-huangji-input-stack horosa-geomancy-input-stack">
				<div>
					<div className="horosa-side-panel-title">天文地占</div>
					<div className="horosa-side-panel-subtitle">护盾盘 · 16 图形 · 判官</div>
				</div>
				{/* [自由起盘] 时间与地点:独立草稿,不写主命盘。此三处用得着它:
			    ①「时间起卦」按此时刻算确定性种子;
			    ② 上升取法选「据所选时地起真实上升」时,按此时地起真实星历盘(唯此式带度数,象限宫制方不退化);
			    ③ 落星法选「真实星历」时,各体按其真实黄经落宫。
			    其余档位一概不用时地(传本盘式之上升取自图形),详见帮助手册「时间与地点」一章。 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={this.activeFields()}
						value={buildDateTimeFromFields(this.activeFields())}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				{/* [左栏统一] 三节收编 XQSideSection(原图标语义保留,卡片类透传) */}
				<XQSideSection iconName="note" title="问题" storageKey="geomancy.question" className="horosa-huangji-input-section">
					<TextArea
						value={this.state.question}
						onChange={(e)=>this.setState({ question: e.target.value })}
						// 所问之事进中栏摘要与 AI 快照(取的是盘上那份 reading.question),改了不重排就一直是旧的。
						// 但逐字重算等于每敲一下打一次后端 → 落在失焦,且只在「真跟盘上那份不一样」时才发。
						onBlur={this.commitQuestion}
						placeholder="输入所问之事（可留空）"
						autoSize={{ minRows: 2, maxRows: 4 }}
						maxLength={200}
					/>
				</XQSideSection>
				<XQSideSection iconName="target" title="起卦选项" storageKey="geomancy.cast" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>问类</span>
							<Select
								value={this.state.questionType}
								onChange={this.changeQuestionType}
								dropdownMatchSelectWidth={false}
								optionLabelProp="label"
							>
								{QUESTION_TYPE_OPTIONS.map((o)=>(
									<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>所问宫</span>
							<Select
								value={Number(this.state.quesitedHouse) || (QUESTION_TYPE_HOUSE[this.state.questionType] || 1)}
								onChange={this.changeQuesitedHouse}
								dropdownMatchSelectWidth={false}
									optionLabelProp="label"
							>
								{QUESITED_HOUSE_OPTIONS.map((o)=>(
									<Option value={o.v} key={o.v} label={`第${o.v}宫`}>{`第 ${o.v} 宫 · ${o.label}`}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>起卦法</span>
							<Select value={this.state.seedMode} onChange={(value)=>{ GEOMANCY_PAGE_SETTINGS.save({ seedMode: value }); this.setState({ seedMode: value }); }} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{SEED_MODE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						{(this.state.seedMode === 'manual' || this.state.seedMode === 'numbers') ? (
							<label className="horosa-huangji-select-field horosa-geomancy-half-field">
								<span>手工种子</span>
								{/* 文本框:锁定复现带来的种子可能是真随机记录(tr1-…),数字框装不下;手填只收数字(0–2147483647) */}
								<Input style={{ width: '100%' }} value={`${this.state.manualSeed === undefined || this.state.manualSeed === null ? '' : this.state.manualSeed}`}
									onChange={(e)=>this.setState({ manualSeed: parseManualSeedInput(e.target.value, 2147483647) })} />
							</label>
						) : null}
						{/* [报数起卦] 十六数,奇为单点、偶为双点;序=母一至母四之火风水土(详解见帮助手册) */}
						{this.state.seedMode === 'numbers' ? (
							<label className="horosa-huangji-select-field horosa-geomancy-granular-field">
								<span>报数（十六个）</span>
								<TextArea
									value={this.state.castNumbersText}
									onChange={(e)=>this.setState({ castNumbersText: e.target.value })}
									placeholder="奇数为单点、偶数为双点，如 7 4 3 6 2 9 5 8 1 4 7 2 6 3 8 5"
									autoSize={{ minRows: 2, maxRows: 3 }}
									maxLength={80}
								/>
							</label>
						) : null}
					</div>
				</XQSideSection>
				<XQSideSection iconName="target" title="流派 · 传本设置" storageKey="geomancy.school" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>流派预设</span>
							<Select value={this.state.tradition} onChange={(value)=>this.changeGeomancyOpt('tradition', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{(this.traditionOptions()).map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>读取范围</span>
							<Select value={this.state.readingScope} onChange={(value)=>this.changeGeomancyOpt('readingScope', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{READING_SCOPE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>黄道体系</span>
							<Select value={this.state.zodiacSystem} onChange={(value)=>this.changeGeomancyOpt('zodiacSystem', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{ZODIAC_SYSTEM_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
					</div>
				</XQSideSection>
				{/* [高级传本] 预设作快捷入口,此处逐项改写;每项「跟随预设」= 不发该参 → 后端回落流派默认。
				    改任一项都走锁种子重算:护盾盘(母图)不变,只有判读随设置变。 */}
				<XQSideSection iconName="target" title="高级传本" storageKey="geomancy.granular" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						{GRANULAR_FIELDS.map((f)=>(
							<label className="horosa-huangji-select-field horosa-geomancy-granular-field" key={f.key}>
								<span>{f.label}</span>
								<Select
									value={this.granularValue(f.key, f.backendKey)}
									onChange={(value)=>this.changeGranular(f.key, value === '__profile__' ? null : (f.bool ? value === 'true' : value))}
									dropdownMatchSelectWidth={false}
									optionLabelProp="label"
								>
									{/* 闭合态显短名(免被省略号吃掉)、下拉列表显全称 */}
									<Option
										value="__profile__"
										key="__profile__"
										label={this.effShort(f) ? `随·${this.effShort(f)}` : '跟随预设'}
									>
										{this.effLabel(f) ? `跟随预设（现为：${this.effLabel(f)}）` : '跟随预设'}
									</Option>
									{f.options.map((o)=>(
										<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
									))}
								</Select>
							</label>
						))}
					</div>
					<XQCheckbox className="horosa-geomancy-uni-toggle"
						checked={!!this.state.showUnicodeGlyph}
						onChange={(e)=>{ GEOMANCY_PAGE_SETTINGS.save({ showUnicodeGlyph: e.target.checked }); this.setState({ showUnicodeGlyph: e.target.checked }); }}>并显 Unicode 字形(需系统装有对应字体,缺字会显方框)</XQCheckbox>
					<div className="horosa-geomancy-granular-hint">
						未改动的项跟随所选流派预设;换预设即清空全部改写。改动只影响判读,不重新揲卦。
					</div>
				</XQSideSection>
				{/* [行星地占盘] 自成一盘:以首图定上升、七政各以报数落宫。与盾牌落星正交并存(详解见帮助手册) */}
				<XQSideSection iconName="target" title="行星地占盘" storageKey="geomancy.pchart" className="horosa-huangji-input-section">
					<XQCheckbox className="horosa-geomancy-uni-toggle"
						checked={!!this.state.planetaryChart}
						onChange={(e)=>this.changePlanetaryOpt('planetaryChart', e.target.checked)}>另起行星地占盘</XQCheckbox>
					{this.state.planetaryChart ? (
						<>
							<div className="horosa-huangji-select-grid">
								<label className="horosa-huangji-select-field horosa-geomancy-granular-field">
									<span>星座对应表</span>
									<Select
										value={this.state.planetaryChartZodiac}
										onChange={(value)=>this.changePlanetaryOpt('planetaryChartZodiac', value)}
										dropdownMatchSelectWidth={false}
									optionLabelProp="label"
									>
										{PCHART_ZODIAC_OPTIONS.map((o)=>(
										<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
									))}
									</Select>
								</label>
							</div>
							<XQCheckbox className="horosa-geomancy-uni-toggle"
								checked={!!this.state.planetaryChartNodes}
								onChange={(e)=>this.changePlanetaryOpt('planetaryChartNodes', e.target.checked)}>加北交·南交(南交取对宫)</XQCheckbox>
							<XQCheckbox className="horosa-geomancy-uni-toggle"
								checked={!!this.state.planetaryChartExtras}
								onChange={(e)=>this.changePlanetaryOpt('planetaryChartExtras', e.target.checked)}>加月孛·三王星</XQCheckbox>
						</>
					) : null}
				</XQSideSection>
				{r ? (
					<div className="horosa-geomancy-seed-row">
						<span title={`${r.seed === undefined || r.seed === null ? '' : r.seed}`}>本盘种子：<strong>{seedDisplayText(r.seed)}</strong></span>
						<Button size="small" onClick={this.clickReproduce}>锁定复现</Button>
					</div>
				) : null}
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickCast}>起盘</Button>
				</div>
			</div>
		);
	},

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。护盾/宫盘切换中栏已有,不进栏。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.result,
			primary: { key: 'cast', label: '起盘', onClick: ()=>this.clickCast() },
			save: ()=>this.clickSaveCase(),
		};
	},

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="geomancy"
				className="horosa-huangji-quick-dock horosa-geomancy-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	},
};
