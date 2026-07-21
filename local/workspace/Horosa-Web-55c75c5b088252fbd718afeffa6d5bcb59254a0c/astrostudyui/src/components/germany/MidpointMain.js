import { Component } from 'react';
import { Row, Col, } from 'antd';
import AstroChart from '../astro/AstroChart';
import Midpoint from './Midpoint';
import AspectToMidpoint from './AspectToMidpoint';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import { getHousesOption } from '../comp/CompHelper'
import { XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import * as AstroConst from '../../constants/AstroConst';
import { sameDisplayList, shallowPropsEqual } from '../../utils/chartUpdateGuard';
import { chartSCUEnabled } from '../../utils/perfFlags';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;

// 量化(德/汉堡 90°中点)盘 sCU(根因 E):MidpointMain 是中点盘渲染主体(内含重组件 AstroChart + 中点/相位列表)。
// 逐项核 render 消费 props(grep this.props.* 全集 = 12,无 state):
//   value          → 内为 {midpoints, chartObj};父 AstroMidpoint.render 每帧重建字面量(外层引用恒变),
//                     故按其两个内部引用比(midpoints / chartObj 数据变才换引用)→ 既不漏渲又能真短路。
//   chartDisplay   → 透传给 AstroChart 的显示项(数组,内容比)
//   planetDisplay  → AstroChart + Midpoint + AspectToMidpoint(数组,内容比)
//   lotsDisplay    → AstroChart(数组,内容比)
//   showAstroMeaning / height → 透传(标量,Object.is)
//   onChange       → 子控件回调(函数,Object.is)
//   fields         → 日期/黄道/宫制等受控值来源(对象引用比:dva/父 state 稳定)
//   hidezodiacal / hidehsys / hidedateselector / indiahsys → 控制侧栏控件显隐(标量,Object.is)
// 子组件(AstroChart 各有 sCU / Midpoint·AspectToMidpoint 为纯列表)随本组件渲染而渲染,本 sCU 拦住冗余整树重渲。
function sameMidpointValue(a, b){
	if(a === b){
		return true;
	}
	if(!a || !b){
		return false;
	}
	return a.midpoints === b.midpoints && a.chartObj === b.chartObj;
}
const MIDPOINTMAIN_SCU_KEYS = [
	'value', 'chartDisplay', 'planetDisplay', 'lotsDisplay', 'showAstroMeaning', 'height',
	'onChange', 'fields', 'hidezodiacal', 'hidehsys', 'hidedateselector', 'indiahsys',
];
const MIDPOINTMAIN_SCU_COMPARATORS = {
	value: sameMidpointValue,
	chartDisplay: sameDisplayList,
	planetDisplay: sameDisplayList,
	lotsDisplay: sameDisplayList,
};
const Option = Select.Option;
const OptGroup = Select.OptGroup;

class MidpointMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			// 右栏子页签(中点 / 相位)改【受控】—— FreezeSubTab 需要 activeKey 才能判 active。
			sideTab: '1',
		}

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);
		this.changeSideTab = this.changeSideTab.bind(this);
	}

	shouldComponentUpdate(nextProps, nextState){
		if(!chartSCUEnabled()){
			return true; // kill-switch
		}
		if(nextState !== this.state){
			return true; // ★ 本组件现在有 state(sideTab):state 变化一律照渲,否则切子页签会不动
		}
		return !shallowPropsEqual(this.props, nextProps, MIDPOINTMAIN_SCU_KEYS, MIDPOINTMAIN_SCU_COMPARATORS);
	}

	changeSideTab(key){
		this.setState({ sideTab: key });
	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
			});
		}
	}

	changeZodiacal(val){
		if(this.props.onChange){
			const parsed = AstroConst.parseZodiacSelectValue(val);
			this.props.onChange({
				zodiacal: parsed.zodiacal,
				siderealAyanamsa: parsed.siderealAyanamsa,
			});
		}
	}

	changeHsys(val){
		if(this.props.onChange){
			this.props.onChange({
				hsys: val,
			});
		}
	}

	changeSouthChart(val){
		if(this.props.fields.gpsLat === undefined || this.props.fields.gpsLat === null || this.props.fields.gpsLat.value >= 0){
			return;
		}
		if(this.props.onChange){
			this.props.onChange({
				southchart: val,
			});
		}
	}

	render(){
		let chartObj = null;
		if(this.props.value){
			chartObj = this.props.value.chartObj
		}

		let midpoints = null;
		let aspects = null;
		if(this.props.value && this.props.value.midpoints){
			midpoints = this.props.value.midpoints.midpoints;
			aspects = this.props.value.midpoints.aspects;
		}

		let fields = this.props.fields;
		let dtstr = chartObj ? chartObj.params.birth : null;
		let dt = new DateTime();
		if(dtstr){
			if(dtstr.length > 11){
				dt = dt.parse(dtstr, 'YYYY-MM-DD HH:mm');
			}else{
				dt = dt.parse(dtstr, 'YYYY-MM-DD');
			}
		}

		let height = this.props.height ? this.props.height : 760;
		let showzodical = true;
		let showhsys = true;
		let showdateselector = true;
		let indiahsys = false;
		if(this.props.hidezodiacal){
			showzodical = false
		}
		if(this.props.hidehsys){
			showhsys = false;
		}
		if(this.props.hidedateselector){
			showdateselector = false;
		}
		if(this.props.indiahsys){
			indiahsys = true;
			showhsys = false;
		}

		return (
			<div className="horosa-midpoint-workbench">
				<Row gutter={6} className="horosa-midpoint-layout">
					<Col span={18} className="horosa-midpoint-chart-col">
							<AstroChart value={chartObj} 
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								height={height}
							/>
					</Col>
					<Col span={6} className="horosa-midpoint-side-col">
						{/* 观象左栏 P2:时间/盘设常用控制区收编 XQSideSection(常展开不折叠);控制格既有布局类保形态。 */}
						<XQSideSection iconName={sideSectionIcon('time')} title="时间与盘设" collapsible={false} className="horosa-midpoint-controls">
						<Row className="horosa-midpoint-control-grid">
							{
								showdateselector && (
									<Col span={24}>
										<PlusMinusTime value={dt} onChange={this.changeTime} />
									</Col>	
								)
							}
							{
								showzodical && (
									<Col span={12}>
										<Select style={{width:'100%'}}
											onChange={this.changeZodiacal}
											value={AstroConst.zodiacSelectValue(this.props.fields.zodiacal.value, this.props.fields.siderealAyanamsa && this.props.fields.siderealAyanamsa.value)}
											dropdownMatchSelectWidth={false}
											size='small'>
											{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
												<OptGroup label={grp.group} key={grp.group}>
													{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
												</OptGroup>
											))}
										</Select>
									</Col>
	
								)
							}
							{
								showhsys && (
									<Col span={12}>
										<Select style={{width: '100%'}}
											onChange={this.changeSouthChart}
											value={this.props.fields.southchart.value} 
											size='small'>
											<Option value={0}>天文星座</Option>
											<Option value={1}>涵义星座</Option>
										</Select>
									</Col>	
								)
							}
							{
								showhsys && (
									<Col span={24} >
										<Select style={{width:'100%'}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											{ getHousesOption() }
										</Select>
									</Col>	
								)
							}
							{
								indiahsys && (
									<Col span={24}>
										<Select style={{width:196}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											<Option value={0}>整宫制</Option>
											<Option value={5}>Vehlow Equal</Option>
										</Select>
									</Col>	
								)
							}
						</Row>
						</XQSideSection>
						{/* horosa_freeze_subtabs_v1:中点/相位两个列表面板互为隐藏,隐藏者不再随本组件重渲。
						    受控化(activeKey + onChange 落 state.sideTab)是 FreezeSubTab 的前提。 */}
						<Tabs activeKey={this.state.sideTab} onChange={this.changeSideTab} tabPosition='top' className="horosa-midpoint-side-tabs">
							<TabPane tab="中点" key="1">
									<FreezeSubTab active={this.state.sideTab === '1'}>{()=>(
									<Midpoint height={height}
										value={midpoints} fields={fields}
										planetDisplay={this.props.planetDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
									)}</FreezeSubTab>
								</TabPane>
								<TabPane tab="相位" key="2">
									<FreezeSubTab active={this.state.sideTab === '2'}>{()=>(
									<AspectToMidpoint
										value={aspects} height={height}
										planetDisplay={this.props.planetDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
									)}</FreezeSubTab>
								</TabPane>
						</Tabs>
					</Col>
				</Row>

			</div>
		);
	}

}

export default MidpointMain;
