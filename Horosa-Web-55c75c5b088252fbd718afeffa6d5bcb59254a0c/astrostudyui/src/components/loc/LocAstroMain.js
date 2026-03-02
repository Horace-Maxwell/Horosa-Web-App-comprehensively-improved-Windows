import { Component } from 'react';
import { Row, Col, Tabs, Tooltip } from 'antd';
import AstroAcg from '../acg/AstroAcg';

const TabPane = Tabs.TabPane;

class LocAstroMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: "Acg",
			hook: {
				Acg:{
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
					<TabPane tab='行星地图' key="Acg" >
						<AstroAcg 
							height={height} 
							fields={fields} 
							hook={this.state.hook.Acg}
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default LocAstroMain;

