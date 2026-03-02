import { Component } from 'react';
import { Row, Col, Tabs, Tooltip } from 'antd';
import AstroChart13 from './AstroChart13';

const TabPane = Tabs.TabPane;

class HellenAstroMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: "Chart13",
			hook: {
				Chart13:{
					fun: null
				},	
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let fld = {
						...fields,
					}
					hook[this.state.currentTab].fun(fld)
				}
			};
		}

	}


	changeTab(key){		
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			if(this.state.hook[key] && this.state.hook[key].fun){
				this.state.hook[key].fun();
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

	onFieldsChange(values){
		if(this.props.onChange){
			let flds = this.props.onChange(values);
			let hook = this.state.hook[this.state.currentTab];
			if(hook.fun){
				hook.fun(flds);
			}
		}		
	}

	componentDidMount(){
		let hook = this.state.hook;
		if(hook[this.state.currentTab].fun){
			hook[this.state.currentTab].fun()
		}
	}

	render(){
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;


		return (
			<div >
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab='十三分盘' key="Chart13" >
						<AstroChart13
							onChange={this.onFieldsChange}
							fields={fields} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.Chart13}
						/>						
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default HellenAstroMain;

