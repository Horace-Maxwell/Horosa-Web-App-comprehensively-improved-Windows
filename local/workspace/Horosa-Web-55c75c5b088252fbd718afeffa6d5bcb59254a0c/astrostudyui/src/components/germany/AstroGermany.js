import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import AstroMidpoint from './AstroMidpoint';
import UranianDialMain from './UranianDialMain';
import UranianGraphicEphemeris from './UranianGraphicEphemeris';
import UranianHouseFrames from './UranianHouseFrames';
import { getStoredUranianDisplay } from './UranianDialStyle';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;

class AstroGermany extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: 'Midpoint',
			hook: {
				Midpoint: { fun: null },
				Dial: { fun: null },
				GraphicEphem: { fun: null },
				HouseFrames: { fun: null },
			},
		}

		this.changeTab = this.changeTab.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.callCurrentTabHook = this.callCurrentTabHook.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				this.callCurrentTabHook();
			};
		}
	}

	callCurrentTabHook(){
		let hook = this.state.hook;
		if(hook[this.state.currentTab] && hook[this.state.currentTab].fun){
			hook[this.state.currentTab].fun();
		}
	}

	changeTab(key){
		this.setState({ currentTab: key }, ()=>{
			this.callCurrentTabHook();
		});
	}

	onFieldsChange(values){
		if(this.props.onChange){
			this.props.onChange(values);
		}
	}

	componentDidMount(){
		this.callCurrentTabHook();
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		// 子 tab nav 占约 44px，扣掉以免子页底部被挤掉。
		let childHeight = Math.max(360, height - 44);
		let hook = this.state.hook;
		// 六宫框 Tab 受 WP-1「showHouseFrames」开关控制(汉堡/美国对称默认开;纯净派/宇宙生物学关)。
		// 关时直接隐藏该 Tab,避免与流派语义冲突;开关存于 90°中点盘的持久化偏好,实时读取。
		let showFrames = true;
		try { showFrames = getStoredUranianDisplay().showHouseFrames !== false; } catch (e) { showFrames = true; }
		// 当前 Tab 落在被隐藏的「六宫框」上时回退到「行星中点」,防止白屏。
		let activeKey = (!showFrames && this.state.currentTab === 'HouseFrames') ? 'Midpoint' : this.state.currentTab;

		return (
			<div className="horosa-aux-module-page xq-chart-renderer xq-chart-renderer-germany">
				{/* horosa_freeze_subtabs_v1(PERF-R9 Ship 6 复核补齐):量化盘四个子页各包一层 FreezeSubTab。
				    本 Tabs 早已受控(activeKey),但 children 全内联 —— 只要在「行星中点」页动一下设置,
				    隐藏着的 90°中点盘(千行 render + 盘 SVG)/图形星历/六宫框也会整棵 reconcile 一遍。
				    函数式 children:未激活过的子页连元素都不建;激活过后切走只冻结不卸载(state/DOM 全留),
				    切回时拿本轮最新 props 立刻渲一帧。kill-switch: horosa.perf.freezeSubTabs。 */}
				<Tabs activeKey={activeKey} onChange={this.changeTab} className="horosa-content-tabs horosa-germany-subtabs">
					<TabPane tab="行星中点" key="Midpoint">
						<FreezeSubTab active={activeKey === 'Midpoint'}>{()=>(
						<AstroMidpoint
							onChange={this.onFieldsChange}
							height={childHeight}
							fields={this.props.fields}
							chart={this.props.chart}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showAstroMeaning={this.props.showAstroMeaning}
							hook={hook.Midpoint}
						/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="90°中点盘" key="Dial">
						<FreezeSubTab active={activeKey === 'Dial'}>{()=>(
						<UranianDialMain
							height={childHeight}
							fields={this.props.fields}
							fieldsAry={this.props.fieldsAry}
							chart={this.props.chart}
							planetDisplay={this.props.planetDisplay}
							hook={hook.Dial}
						/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="图形星历" key="GraphicEphem">
						<FreezeSubTab active={activeKey === 'GraphicEphem'}>{()=>(
						<UranianGraphicEphemeris
							height={childHeight}
							fields={this.props.fields}
							chart={this.props.chart}
							hook={hook.GraphicEphem}
						/>
						)}</FreezeSubTab>
					</TabPane>
					{showFrames ? (
						<TabPane tab="六宫框" key="HouseFrames">
							<FreezeSubTab active={activeKey === 'HouseFrames'}>{()=>(
							<UranianHouseFrames
								height={childHeight}
								fields={this.props.fields}
								chart={this.props.chart}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={hook.HouseFrames}
							/>
							)}</FreezeSubTab>
						</TabPane>
					) : null}
				</Tabs>
			</div>
		);
	}
}

export default AstroGermany;
