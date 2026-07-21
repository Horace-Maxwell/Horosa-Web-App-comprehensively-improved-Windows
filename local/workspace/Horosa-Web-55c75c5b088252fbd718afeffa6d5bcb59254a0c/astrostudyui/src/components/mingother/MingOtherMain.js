import { Component } from 'react';
import KinAstroMain from '../kinastro/KinAstroMain';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

const MING_OTHER_TECHNIQUE_TABS = [
	{ key: 'cetian', label: '策天飞星' },
	{ key: 'xianqin', label: '演禽' },
	{ key: 'yizhangjing', label: '一掌经' },
];
const MING_OTHER_TECHNIQUE_KEYS = MING_OTHER_TECHNIQUE_TABS.map((t) => t.key);

export default class MingOtherMain extends Component{
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

	// [A7·性能] 重 wrapper sCU(照 ShuSuanMain/BaZi/ZiWeiMain 既有范式):全 props 机械浅比
	// (函数型视为恒等,开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲。
	// 收益:激活态下宿主无关 dispatch 不再穿透到本壳与其下的 KinAstroMain。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
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
