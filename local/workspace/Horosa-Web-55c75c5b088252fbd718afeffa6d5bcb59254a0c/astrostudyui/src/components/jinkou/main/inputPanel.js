// 金口诀页 · 左栏起课设置面板与底部快捷栏
// 从 JinKouMain.js 按职责拆出的 JinKouMain 方法:this 仍是 JinKouMain 实例,门面里 mixinMethods(JinKouMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import * as LRConst from '../../liureng/LRConst';
import LiuRengInput from '../../lrzhan/LiuRengInput';
import LiuRengBirthInput from '../../lrzhan/LiuRengBirthInput';
import QuickDockBar from '../../common/QuickDockBar';
import { resolveDiFenBySource, JINKOU_HEZHAN_FOCUS, JINKOU_HEZHAN_TIME } from '../JinKouCalc';
import { XQButton as Button, XQSelect as Select, XQInput, XQSideSection } from '../../xq-ui';
const { Option } = Select;

export const inputPanelMethods = {
	genWuXingDoms(){
		// 首项「自动」= 页面真实缺省(随日干五行);此前手选后无路可回自动档,
		// 且挂载 schema 与无头兜底都写死「土」→ 日干非土时「起课时间」挂载与页面两张表。
		return [
			<Option key="wx_auto" value="auto">自动（随日干五行）</Option>,
		].concat(LRConst.WuXing.map((item, idx)=>(
			<Option key={idx} value={item.elem}>{item.elem}·{item.ganzi}</Option>
		)));
	},

	renderInputPanel(wxdoms){
		// 「时间基准」两条出课路径都生效:/liureng/gods 随它取时间算法,本地引擎吃的正是这份农历(此前不带 → 本地引擎恒真太阳时,
		// 流派项非默认时只好置灰),故不再置灰。
		return (
			<div className="horosa-jinkou-input-stack">
				<div>
					<div className="horosa-side-panel-title">金口诀设置</div>
					<div className="horosa-side-panel-subtitle">起课时间、地分与问测人</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="起课时间与地点" collapsible={false}>
					<div className="horosa-jinkou-input-embed">
						<LiuRengInput
							fields={this.props.fields}
							onFieldsChange={this.onFieldsChange}
							onStepSelect={this.prefetchStepSelect}
							hideExtras
						/>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="流派 / 盘法" storageKey="jinkou.s1" className="horosa-jinkou-input-section">
					{/* 流派四维：一行两个的下拉单选（窄栏省高度；选项短、无需滑块占位）。 */}
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>月将换将</span>
							<Select value={this.state.schoolYueJiang} onChange={(v)=>this.onSchoolChange('schoolYueJiang', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="zhongqi">中气换将</Option>
								<Option value="jiaojie">交节即换</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>贵人昼夜表</span>
							<Select value={this.state.schoolGuiTable} onChange={(v)=>this.onSchoolChange('schoolGuiTable', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="shiwu">实务派</Option>
								<Option value="liuren">六壬古法</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>起贵神盘</span>
							<Select value={this.state.schoolGuiPan} onChange={(v)=>this.onSchoolChange('schoolGuiPan', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="di">地盘法</Option>
								<Option value="tian">天盘法</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>盘式</span>
							<Select value={this.state.panShi} onChange={(v)=>this.onSchoolChange('panShi', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="yang">传统阳盘</Option>
								<Option value="yin">阴盘·旺衰</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>土长生</span>
							<Select value={this.state.soilChangSheng} onChange={(v)=>this.onSchoolChange('soilChangSheng', v)} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="shen">水土同宫·申</Option>
								<Option value="yin">火土同宫·寅</Option>
							</Select>
						</label>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="地分与课式" storageKey="jinkou.s2" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>地分</span>
							{/* 首项「自动」= 页面真实缺省(随占时支);帮助此前写「默认子」并不实,
							    且手选后无路可回自动档。 */}
							<Select value={this.state.diFenAuto === false ? this.state.diFen : 'auto'} onChange={this.onDiFenChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="auto">自动（按占时支）</Option>
								{LRConst.ZiList.map((zi)=>(<Option key={`difen_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>月将</span>
							<Select value={this.state.yueJiang} onChange={this.onYueJiangChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="auto">自动</Option>
								{LRConst.ZiList.map((zi)=>(<Option key={`yuejiang_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>占时</span>
							<Select value={this.state.zhanShi} onChange={this.onZhanShiChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="auto">自动</Option>
								{LRConst.ZiList.map((zi)=>(<Option key={`zhanshi_${zi}`} value={zi}>{zi}</Option>))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>时间基准</span>
							<Select value={this.state.timeBasis} onChange={this.onTimeBasisChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="direct">直接时间</Option>
								<Option value="trueSolar">真太阳时</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>十二长生五行</span>
							<Select value={this.state.wuxingAuto === false ? this.state.wuxing : 'auto'} onChange={this.onWuXingChange} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								{wxdoms}
							</Select>
						</label>
						{/* 定地分辅助取法：按数/笔画/颜色/属相/翻书求支，算出即回填地分（不改下游算法）。 */}
						<label className="horosa-jinkou-select-field">
							<span>地分取法</span>
							<Select value={this.state.diFenSource} onChange={(v)=>this.setState({ diFenSource: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="zhi">直接选支</Option>
								<Option value="number">报数</Option>
								<Option value="stroke">笔画</Option>
								<Option value="color">颜色</Option>
								<Option value="shengxiao">属相</Option>
								<Option value="book">翻书页数</Option>
							</Select>
						</label>
						{this.state.diFenSource !== 'zhi' ? (
							<label className="horosa-jinkou-select-field">
								<span>取法输入</span>
								<XQInput
									size="small"
									value={this.state.diFenSourceInput}
									placeholder={this.state.diFenSource === 'color' ? '如 青/红/白' : (this.state.diFenSource === 'shengxiao' ? '如 兔' : '如 27')}
									onChange={(e)=>{
										const val = e.target.value;
										const zi = resolveDiFenBySource(this.state.diFenSource, val);
										this.setState({ diFenSourceInput: val });
										if(zi){ this.onDiFenChange(zi); }
									}}
								/>
							</label>
						) : null}
					</div>
				</XQSideSection>

				{/* 专题起式（定局法）：选定专题即在右栏「专题」页产出派生课与断诀，主课不受影响。 */}
				<XQSideSection iconName={sideSectionIcon('switches')} title="专题起式" storageKey="jinkou.s4" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-field-grid2">
						<label className="horosa-jinkou-select-field">
							<span>专题</span>
							<Select value={this.state.topicKey} onChange={(v)=>this.setState({ topicKey: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">不用</Option>
								<Option value="yunyu">测孕育</Option>
								<Option value="xuntiangang">寻天罡·失物</Option>
								<Option value="jiazhai">测家宅</Option>
								<Option value="guijian">测贵贱</Option>
								<Option value="banzhi">测瘢痣</Option>
								<Option value="dajing">测打井</Option>
								<Option value="fujiashi">复加时·十二方位</Option>
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>所问类别</span>
							<Select value={this.state.askKey} onChange={(v)=>this.setState({ askKey: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">未限定</Option>
								{Object.keys(JINKOU_HEZHAN_FOCUS).map((k)=>(
									<Option key={`ask_${k}`} value={k}>{JINKOU_HEZHAN_FOCUS[k].label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>问事时段</span>
							<Select value={this.state.timeScope} onChange={(v)=>this.setState({ timeScope: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								{Object.keys(JINKOU_HEZHAN_TIME).map((k)=>(
									<Option key={`ts_${k}`} value={k}>{JINKOU_HEZHAN_TIME[k].label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-jinkou-select-field">
							<span>测年月日</span>
							<Select value={this.state.shiJianKind} onChange={(v)=>this.setState({ shiJianKind: v })} dropdownMatchSelectWidth={false} dropdownClassName="horosa-jinkou-field-dropdown">
								<Option value="">不用</Option>
								<Option value="year">测一年</Option>
								<Option value="month">测一月</Option>
								<Option value="day">测一日</Option>
							</Select>
						</label>
					</div>
					{/* 属相与虚岁不再手填：由下方「问测人出生时间」自动派生(属相=生年支、虚岁=卜卦年−生年+1)，
					    免去同一事实两处输入互相打架。派生值在右栏「专题」页与概览回显，可核对。 */}
					<div className="horosa-jinkou-topic-note">{this.renderBenMingHint()}</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="问测人出生时间" storageKey="jinkou.s3" className="horosa-jinkou-input-section">
					<div className="horosa-jinkou-input-embed">
						<LiuRengBirthInput
							fields={this.state.birth}
							onFieldsChange={this.onBirthChange}
							requireConfirm={true}
						/>
					</div>
				</XQSideSection>

				<div className="horosa-jinkou-action-row">
					<Button type="primary" onClick={()=>this.clickStartCast()}>起课</Button>
					<Button onClick={this.clickSaveCase}>保存</Button>
				</div>
			</div>
		);
	},

	// 快捷栏契约:右栏 tab 镜像与跨页目录撤除,只放本页没有的动词。
	// cnyibu 容器经此声明透传渲染(勿在此放页面上已有的控件)。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.liureng,
			primary: { key: 'plot', label: '起课', onClick: ()=>this.clickStartCast() },
			extras: [
				{ key: 'nowPlot', label: '此刻起课', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickPlotNow() },
			],
			save: ()=>this.clickSaveCase(),
		};
	},

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="jinkou"
				className="horosa-jinkou-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	},
};
