import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
import { ZERI_SUBTABS } from '../../constants/SubTabRegistry';
import TianxingElectionMain from './TianxingElectionMain';

const TabPane = Tabs.TabPane;

// 「择日」主导航模块宿主。布局**逐字照抄辅盘**(horosa-auxchart-page/-layout/-tabs 三类
// 复用其整条高度链与栏位链,用户明令勿自创);差异仅两点,均锁 .horosa-zeri-host 作用域:
//   ① 无底部 QuickDock → layout 的 64px dock 行去掉(app.less zeri 覆盖条)
//   ② 右栏(征象搜索区)大屏加宽(app.less 6850 区 zeri 覆盖条)
// 新增择日技法在 ZERI_SUBTABS + 此处 TabPane 成对追加。
export default class ZeriMain extends Component{
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		const subtab = this.props.currentSubTab ? this.props.currentSubTab : 'tianxing';
		const tab = ZERI_SUBTABS.indexOf(subtab) >= 0 ? subtab : 'tianxing';
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
		};
		this.changeTab = this.changeTab.bind(this);
	}

	componentDidUpdate(prevProps){
		const next = this.props.currentSubTab;
		if(next && next !== prevProps.currentSubTab && ZERI_SUBTABS.indexOf(next) >= 0 && next !== this.state.currentTab){
			this.setState({ currentTab: next });
		}
	}

	changeTab(key){
		this.setState({ currentTab: key }, ()=>{
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/save', payload: { currentSubTab: key } });
			}
		});
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const childHeight = Math.max(height - 36, 560);
		return (
			<div id={this.state.divId} className="horosa-auxchart-page horosa-zeri-host">
				<div className="horosa-auxchart-layout">
					<Tabs
						defaultActiveKey={this.state.currentTab}
						activeKey={this.state.currentTab}
						tabPosition='right'
						onChange={this.changeTab}
						className="xq-tabs-rail horosa-auxchart-tabs"
						style={{ height: '100%' }}
					>
						<TabPane tab="天星择日" key="tianxing">
							<TianxingElectionMain
								fields={this.props.fields}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
								voidClassical={this.props.voidClassical}
								dispatch={this.props.dispatch}
							/>
						</TabPane>
					</Tabs>
				</div>
			</div>
		);
	}
}
