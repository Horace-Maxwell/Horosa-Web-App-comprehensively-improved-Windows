import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import BaZi from './BaZi';
import ZiWeiMain from '../ziwei/ZiWeiMain';
import GuaSymDesc from '../gua/GuaSymDesc';
import CuanGong12 from '../commtools/CuanGong12';
import BaziPithy from '../commtools/BaziPithy';

const TabPane = Tabs.TabPane;

class CnTraditionMain extends Component{

	constructor(props) {
		super(props);

		let tab = this.props.currentSubTab ? this.props.currentSubTab : 'bazi';
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
				bazi:{
					fun: null
				},
				ziwei:{
					fun: null
				},
				guasym:{
					fun: null
				},
				cuangong12: {
					fun: null
				},
				pithy: {
					fun: null
				},
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.findTab = this.findTab.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				let subtab = this.findTab();
				if(hook[subtab].fun){
					hook[subtab].fun(fields);
				}
				setTimeout(()=>{
					if(this.props.dispatch){
						this.props.dispatch({
							type: 'astro/save',
							payload: {
								currentSubTab: subtab,
							}
						});
					}			
				}, 500);
			};
		}

	}

	findTab(){
		let subtab = this.state.currentTab ? this.state.currentTab : 'bazi';
		for(let key in this.state.hook){
			if(key === subtab){
				return key;
			}
		}
		let key = 'bazi';
		return key;
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			if(hook[key].fun){
				hook[key].fun(this.props.fields);
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}	
		});
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		let tab = this.findTab();

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={tab} tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="八字" key="bazi">
						<BaZi 
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.bazi}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="紫微斗数" key="ziwei">
						<ZiWeiMain 
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.ziwei}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="八卦类象" key="guasym">
						<GuaSymDesc />
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12">
						<CuanGong12 />
					</TabPane>

					<TabPane tab="八字规则" key="pithy">
						<BaziPithy />
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CnTraditionMain;
