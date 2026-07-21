import { Component } from 'react';
import KinAstroMain from '../kinastro/KinAstroMain';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

export default class ShuSuanMain extends Component{
	constructor(props){
		super(props);
		this.state = { technique: 'shaozi' };
		this.setTechnique = this.setTechnique.bind(this);
	}

	setTechnique(technique){
		this.setState({ technique });
	}

	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	render(){
		return (
			<KinAstroMain
				{...this.props}
				technique={this.state.technique}
				onTechniqueChange={this.setTechnique}
			/>
		);
	}
}
