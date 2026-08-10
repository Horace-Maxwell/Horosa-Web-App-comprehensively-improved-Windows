import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { randomStr } from '../../utils/helper';
import DiceMain from '../dice/DiceMain';

class OtherBuMain extends Component{
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

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: 'touzi',
			hook:{
				touzi:{
					fun: null
				},
			},
		};

		this.changeTab = this.changeTab.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(fields);
				}
			};
		}

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

		return (
			<div id={this.state.divId} className="horosa-aux-module-page xq-chart-renderer xq-chart-renderer-dice">
				<DiceMain
					wheelArt={this.props.wheelArt}
					height={height}
					fields={this.props.fields}
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
					showAstroMeaning={this.props.showAstroMeaning}
					hook={this.state.hook.touzi}
					dispatch={this.props.dispatch}
				/>
			</div>
		);
	}
}

export default OtherBuMain;
