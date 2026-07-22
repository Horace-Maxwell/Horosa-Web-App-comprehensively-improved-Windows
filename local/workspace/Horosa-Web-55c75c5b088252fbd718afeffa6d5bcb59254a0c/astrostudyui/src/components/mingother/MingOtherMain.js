import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import KinAstroMain from '../kinastro/KinAstroMain';

const MING_OTHER_TECHNIQUE_TABS = [
	{ key: 'cetian', label: '策天飞星' },
	{ key: 'xianqin', label: '演禽' },
	{ key: 'yizhangjing', label: '一掌经' },
];
const MING_OTHER_TECHNIQUE_KEYS = MING_OTHER_TECHNIQUE_TABS.map((t) => t.key);

export default class MingOtherMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.state = {
			technique: 'cetian',
		};
		this.onTechniqueChange = this.onTechniqueChange.bind(this);
	}

	onTechniqueChange(technique){
		this.setState({
			technique: MING_OTHER_TECHNIQUE_KEYS.indexOf(technique) >= 0 ? technique : 'cetian',
		});
	}

	render(){
		return (
			<KinAstroMain
				{...this.props}
				technique={this.state.technique}
				activeTechnique={this.state.technique}
				techniqueTabs={MING_OTHER_TECHNIQUE_TABS}
				onTechniqueChange={this.onTechniqueChange}
			/>
		);
	}
}
