import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import KinAstroMain from '../kinastro/KinAstroMain';
import EastAsiaMain from '../dongya/EastAsiaMain';
import ZhufangMain from '../zhufang/ZhufangMain';

const MING_OTHER_TECHNIQUE_TABS = [
	{ key: 'cetian', label: '策天飞星' },
	{ key: 'xianqin', label: '演禽' },
	{ key: 'yizhangjing', label: '一掌经' },
	{ key: 'dongya', label: '东亚' },
	{ key: 'zhufang', label: '诸方' },
];
const MING_OTHER_TECHNIQUE_KEYS = MING_OTHER_TECHNIQUE_TABS.map((t) => t.key);

export default class MingOtherMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
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
		if(this.state.technique === 'zhufang'){
			// 诸方杂术:玛雅历 / 十三月亮历前端算,人类图 / 灵名字母走 /astroextra/zhufang
			return (
				<ZhufangMain
					{...this.props}
					activeTechnique={this.state.technique}
					techniqueTabs={MING_OTHER_TECHNIQUE_TABS}
					onTechniqueChange={this.onTechniqueChange}
				/>
			);
		}
		if(this.state.technique === 'dongya'){
			// 东亚诸术是前端本地计算的独立页面,不走 KinAstro 的后端管道;技法切换条同一份
			return (
				<EastAsiaMain
					{...this.props}
					activeTechnique={this.state.technique}
					techniqueTabs={MING_OTHER_TECHNIQUE_TABS}
					onTechniqueChange={this.onTechniqueChange}
				/>
			);
		}
		return (
			<KinAstroMain
				{...this.props}
				hostModuleKey="mingother"
				technique={this.state.technique}
				activeTechnique={this.state.technique}
				techniqueTabs={MING_OTHER_TECHNIQUE_TABS}
				onTechniqueChange={this.onTechniqueChange}
			/>
		);
	}
}
