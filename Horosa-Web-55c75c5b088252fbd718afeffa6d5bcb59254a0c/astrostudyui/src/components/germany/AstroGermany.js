import { Component } from 'react';
import { Row, Col, Tabs, Input, Button, } from 'antd';
import AstroMidpoint from './AstroMidpoint'
import * as Constants from '../../utils/constants';
import request from '../../utils/request';

const TabPane = Tabs.TabPane;

class AstroGermany extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: 'Midpoint',
			currentTech: 0,
			hook: {
				Midpoint:{
					txt:'行星中点',
					tech: 0,
					fun: null
				},

			},
		}

		this.changeTab = this.changeTab.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.callCurrentTabHook = this.callCurrentTabHook.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun();
				}
			};
		}

	}

	callCurrentTabHook(){
		let hook = this.state.hook;
		if(hook[this.state.currentTab].fun){
			hook[this.state.currentTab].fun()
		}	
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
			currentTech: hook[key].tech
		}, ()=>{
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
		height = height - 50

		let hook = this.state.hook;

		return (
			<div>
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="行星中点" key="Midpoint">
						<AstroMidpoint 
							onChange={this.onFieldsChange}
							height={height}
							fields={this.props.fields}
							chart={this.props.chart}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}	
							hook={hook.Midpoint}	
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default AstroGermany;