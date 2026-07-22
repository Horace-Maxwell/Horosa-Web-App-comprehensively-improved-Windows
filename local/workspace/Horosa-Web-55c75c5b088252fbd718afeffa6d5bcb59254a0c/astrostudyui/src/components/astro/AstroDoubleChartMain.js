import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, Divider, Popover } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import AstroDoubleChart from './AstroDoubleChart';
import AspectInfo from '../relative/AspectInfo';
import MidpointInfo from '../relative/MidpointInfo';
import AntisciaInfo from '../relative/AntisciaInfo';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import { FreezeSubTab } from '../comp/FreezeInactive';
import styles from '../../css/styles.less';

const TabPane = Tabs.TabPane;

class AstroCompare extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);

		// activeTab 受控:FreezeSubTab 需要知道哪个子面板在前台(原 defaultActiveKey 拿不到)。
		// 原 state.result 是构造期快照且全组件无人读(死字段),去掉后行为逐字节不变。
		this.state = {
			activeTab: '1',
		}

		this.changeTab = this.changeTab.bind(this);
	}

	changeTab(key){
		this.setState({ activeTab: key });
	}

	// 复核补丁:受控 activeKey 下,「映点/中点面板因数据变化而消失」必须把 state 一起改回 '1'。
	// 只在 render 里做局部回落是不够的 —— state 仍停在 '2'/'3',而屏幕上高亮的是「相位」:
	// 此时用户点「相位」页签,antd 判定 activeKey 已是 '1' 不触发 onChange,state 永远纠不回来;
	// 等数据再变回带映点/中点时,页签会自己跳到映点/中点(用户没点过)。gDSFP 在 sCU 之前跑,
	// 故回落对本轮 render 即时生效,render 内的局部回落保留为双保险(首帧同样正确)。
	static getDerivedStateFromProps(props, state){
		const resobj = props.value ? props.value : {};
		if((state.activeTab === '2' && !resobj.antiscias) || (state.activeTab === '3' && !resobj.midpoints)){
			return { activeTab: '1' };
		}
		return null;
	}


	render(){
		let resobj = this.props.value ? this.props.value : {};
		let chartObj = {
			natualChart: resobj.natual,
			dirChart: resobj.dir,
		};

		let title = this.props.title ? this.props.title : '外圈';
		let innerTitle = this.props.innerTitle ? this.props.innerTitle : '内圈';
		let height = this.props.height ? this.props.height : 760;

		let showAntiscia = resobj.antiscias ? true : false;
		let showMidpoint = resobj.midpoints ? true : false;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto',
			overflowX:'hidden',
		};

		// 防呆:映点/中点面板是条件渲染的,数据变化让当前激活的那个消失时回落到「相位」,
		// 否则 activeKey 指向已不存在的面板 = 空白右栏(受控 Tabs 才有的新失败模式)。
		let activeTab = this.state.activeTab;
		if((activeTab === '2' && !showAntiscia) || (activeTab === '3' && !showMidpoint)){
			activeTab = '1';
		}

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroDoubleChart value={chartObj} 
							height={height}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay}
							showAstroMeaning={this.props.showAstroMeaning}
						/>
					</Col>
					<Col span={7}>
						{/* horosa_freeze_subtabs_v1:相位/映点/中点三面板一律 keep-alive,
						    父重渲时看不见的两个也整表重算(AspectInfo/MidpointInfo 都是 planet×planet)。
						    受控 activeKey + FreezeSubTab 后只有前台面板参与重渲;冻结≠卸载,
						    切回时拿本轮最新 children 立即渲一帧,滚动位置/展开态原样保留。 */}
						<Tabs activeKey={activeTab} onChange={this.changeTab} tabPosition='top'>
							<TabPane tab="相位" key="1">
								<FreezeSubTab active={activeTab === '1'}>{()=>(
									<AspectInfo
										value={this.props.value}
										title={title}
										innerTitle={innerTitle}
										height={height-20}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										dirChart={resobj.dir}
										natualChart={resobj.natual}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
								)}</FreezeSubTab>
							</TabPane>
							{
								showAntiscia && (
									<TabPane tab="映点" key="2">
										<FreezeSubTab active={activeTab === '2'}>{()=>(
											<AntisciaInfo
												value={resobj}
												title={title}
												innerTitle={innerTitle}
												height={height-20}
												planetDisplay={this.props.planetDisplay}
												lotsDisplay={this.props.lotsDisplay}
												dirChart={resobj.dir}
												natualChart={resobj.natual}
												showPlanetHouseInfo={this.props.showPlanetHouseInfo}
												showAstroMeaning={this.props.showAstroMeaning}
											/>
										)}</FreezeSubTab>
									</TabPane>
								)
							}
							{
								showMidpoint && (
									<TabPane tab="中点" key="3">
										<FreezeSubTab active={activeTab === '3'}>{()=>(
											<MidpointInfo
												value={resobj.midpoints}
												title={title}
												innerTitle={innerTitle}
												height={height-20}
												planetDisplay={this.props.planetDisplay}
												lotsDisplay={this.props.lotsDisplay}
												dirChart={resobj.dir}
												natualChart={resobj.natual}
												showPlanetHouseInfo={this.props.showPlanetHouseInfo}
												showAstroMeaning={this.props.showAstroMeaning}
											/>
										)}</FreezeSubTab>
									</TabPane>
								)
							}
						</Tabs>
					</Col>
				</Row>
			</div>
		)
	}
}

export default AstroCompare;
