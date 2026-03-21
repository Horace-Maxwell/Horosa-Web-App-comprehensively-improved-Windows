import { Component } from 'react';
import { Row, Col, Divider, Tabs,Popover, } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import AspectInfo from '../relative/AspectInfo';
import MidpointInfo from '../relative/MidpointInfo';
import AntisciaInfo from '../relative/AntisciaInfo';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';
import { computeSquareChartHostHeight } from '../../utils/chartViewportLayout';

const TabPane = Tabs.TabPane;
const CHART_HOST_BOTTOM_GAP = 12;

class AstroCompare extends Component{

	constructor(props) {
		super(props);

		this.state = {
			result: this.props.value,
			chartHostHeight: null,
		}

		this.chartColumnHost = null;
		this.chartHost = null;
		this.chartResizeObserver = null;

		this.captureChartColumnHost = this.captureChartColumnHost.bind(this);
		this.captureChartHost = this.captureChartHost.bind(this);
		this.observeChartHostResize = this.observeChartHostResize.bind(this);
		this.disconnectChartHostResize = this.disconnectChartHostResize.bind(this);
		this.syncChartHostHeight = this.syncChartHostHeight.bind(this);

	}

	componentDidMount(){
		window.addEventListener('resize', this.syncChartHostHeight);
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	componentDidUpdate(prevProps){
		if(prevProps.height !== this.props.height || prevProps.fitChartToViewport !== this.props.fitChartToViewport){
			this.syncChartHostHeight();
		}
	}

	componentWillUnmount(){
		window.removeEventListener('resize', this.syncChartHostHeight);
		this.disconnectChartHostResize();
	}

	captureChartColumnHost(node){
		this.chartColumnHost = node || null;
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	captureChartHost(node){
		this.chartHost = node || null;
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	disconnectChartHostResize(){
		if(this.chartResizeObserver){
			this.chartResizeObserver.disconnect();
			this.chartResizeObserver = null;
		}
	}

	observeChartHostResize(){
		this.disconnectChartHostResize();
		if(typeof ResizeObserver === 'undefined'){
			return;
		}
		const targets = [this.chartColumnHost, this.chartHost].filter(Boolean);
		if(targets.length === 0){
			return;
		}
		this.chartResizeObserver = new ResizeObserver(()=>{
			this.syncChartHostHeight();
		});
		targets.forEach((node)=>{
			this.chartResizeObserver.observe(node);
		});
	}

	syncChartHostHeight(){
		if(!this.props.fitChartToViewport){
			if(this.state.chartHostHeight !== null){
				this.setState({ chartHostHeight: null });
			}
			return;
		}
		const host = this.chartHost || this.chartColumnHost;
		if(!host){
			return;
		}
		const containerWidth = host.clientWidth || 0;
		const containerHeight = this.chartColumnHost ? this.chartColumnHost.clientHeight : host.clientHeight || 0;
		const nextHeight = computeSquareChartHostHeight(containerWidth, containerHeight, {
			bottomGap: this.props.chartBottomGap !== undefined ? this.props.chartBottomGap : CHART_HOST_BOTTOM_GAP,
		});
		if(Math.abs((this.state.chartHostHeight || 0) - nextHeight) >= 2){
			this.setState({
				chartHostHeight: nextHeight,
			});
		}
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
		const fitChartToViewport = !!this.props.fitChartToViewport;
		const chartHostHeight = fitChartToViewport
			? (this.state.chartHostHeight || computeSquareChartHostHeight(0, height, {
				bottomGap: this.props.chartBottomGap !== undefined ? this.props.chartBottomGap : CHART_HOST_BOTTOM_GAP,
			}))
			: height;

		let showAntiscia = resobj.antiscias ? true : false;
		let showMidpoint = resobj.midpoints ? true : false;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div style={{ height, maxHeight: height, overflow: 'hidden' }}>
				<Row gutter={6} style={{ height: '100%' }}>
					<Col span={17} style={{ height: '100%', overflow: 'hidden', minHeight: 0 }}>
						<div ref={this.captureChartColumnHost} style={{ height: '100%', overflow: 'hidden' }}>
							<div
								ref={this.captureChartHost}
								style={{
									height: chartHostHeight,
									maxHeight: '100%',
									overflow: 'hidden',
								}}
							>
								<AstroDoubleChart value={chartObj} 
								height='100%'
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</div>
						</div>
					</Col>
					<Col span={7} style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
						<Tabs defaultActiveKey="1" tabPosition='top' className='horosaFillTabs' style={{ flex: '1 1 auto', minHeight: 0 }}>
							<TabPane tab="相位" key="1">
								<AspectInfo 
									value={this.props.value}
									chartSources={resobj}
									title={title}
									innerTitle={innerTitle}
									height={height-20}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
								/>
							</TabPane>
							{
								showAntiscia && (
									<TabPane tab="映点" key="2">
										<AntisciaInfo 
											value={resobj}
											chartSources={resobj}
											title={title}
											innerTitle={innerTitle}
											height={height-20}
											planetDisplay={this.props.planetDisplay}
											lotsDisplay={this.props.lotsDisplay}
										/>
									</TabPane>
								)
							}
							{
								showMidpoint && (
									<TabPane tab="中点" key="3">
										<MidpointInfo 
											value={resobj.midpoints}
											chartSources={resobj}
											title={title}
											innerTitle={innerTitle}
											height={height-20}
											planetDisplay={this.props.planetDisplay}
											lotsDisplay={this.props.lotsDisplay}
										/>
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
