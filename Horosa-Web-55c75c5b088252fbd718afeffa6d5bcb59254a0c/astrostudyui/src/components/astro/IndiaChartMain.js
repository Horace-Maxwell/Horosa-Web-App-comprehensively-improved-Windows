import { Component } from 'react';
import { Row, Col, Tabs, Tooltip } from 'antd';
import IndiaChart from './IndiaChart';


const TabPane = Tabs.TabPane;

class IndiaChartMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: "Natal",
			currentFractal: 1,
			hook: {
				Natal:{
					txt:'命盘',
					fractal: 1,
					fun: null
				},
				Hora:{
					txt:'财产',
					fractal: 2,
					fun: null
				},
				Drekkana:{
					txt:'兄妹',
					fractal: 3,
					fun: null
				},
				Chaturthamsa:{
					txt:'资质',
					fractal: 4,
					fun: null
				},
				Panchamsa:{
					txt:'世俗',
					fractal: 5,
					fun: null
				},
				Shashthamsa:{
					txt:'疾病',
					fractal: 6,
					fun: null
				},
				Saptamsa:{
					txt:'子嗣',
					fractal: 7,
					fun: null
				},
				Ashthamsa:{
					txt:'困难',
					fractal: 8,
					fun: null
				},
				Navamsa:{
					txt:'合作',
					fractal: 9,
					fun: null
				},
				Dasamsa:{
					txt:'事业',
					fractal: 10,
					fun: null
				},
				Rudramsa:{
					txt:'增长',
					fractal: 11,
					fun: null
				},
				Dwadasamsa:{
					txt:'父辈',
					fractal: 12,
					fun: null
				},
				Shodasamsa:{
					txt:'座驾',
					fractal: 16,
					fun: null
				},
				Vimsamsa:{
					txt:'灵魂',
					fractal: 20,
					fun: null
				},
				Chaturvimsamsa:{
					txt:'教育',
					fractal: 24,
					fun: null
				},
				Nakshatramsa:{
					txt:'生命',
					fractal: 27,
					fun: null
				},
				Trimsamsa:{
					txt: null,
					fractal: 30,
					fun: null
				},
				Khavedamsa:{
					txt:'母系',
					fractal: 40,
					fun: null
				},
				Akshavedamsa:{
					txt:'父系',
					fractal: 45,
					fun: null
				},
				Shashtyamsa:{
					txt: null,
					fractal: 60,
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
						chartnum: {
							value: this.state.currentFractal
						}
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
			currentFractal: hook[key].fractal
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
			flds.chartnum = {};
			flds.chartnum.value = this.state.currentFractal;
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

		let panes = [];
		for(let key in this.state.hook){
			let hook = this.state.hook[key];
			if(hook.fractal === 1 || hook.fractal === 5 ||
				hook.fractal === 6 || hook.fractal === 8 ||
				hook.fractal === 11 || hook.fractal === 30 || hook.fractal === 60){
				continue;
			}
			let pane = (
				<TabPane 
					tab={(
							<Tooltip title={hook.txt}>
								<span>{hook.fractal}律盘</span>
							</Tooltip>					
						)} 
					key={key}
				>
					<IndiaChart 
						chartnum={hook.fractal} 
						onChange={this.onFieldsChange}
						fields={fields} 
						height={height} 
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						hook={hook}
					/>						
				</TabPane>
			);
			panes.push(pane);
		}

		return (
			<div >
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane 
						tab={this.state.hook.Natal.txt} 
						key="Natal"
					>
						<IndiaChart 
							chartnum={this.state.hook.Natal.fractal} 
							onChange={this.onFieldsChange}
							fields={fields} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.Natal}
						/>						
					</TabPane>

					{panes}
				</Tabs>
			</div>
		);
	}
}

export default IndiaChartMain;

