import { Component } from 'react';
import './planetarium.less';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

class PlanetariumMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			LoadedComponent: null,
			loadError: null,
			runtimeLoadMs: 0,
		};
		this.mounted = false;
	}

	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.mounted = true;
		if(this.props.active){
			this.ensureLoaded();
		}
	}

	componentDidUpdate(prevProps){
		if(!prevProps.active && this.props.active){
			this.ensureLoaded();
		}
		if(prevProps.active && !this.props.active){
			this.setState({
				LoadedComponent: null,
			});
		}
	}

	ensureLoaded(){
		if(this.state.LoadedComponent){
			return;
		}
		const started = Date.now();
		this.loadBabylonRuntime()
			.then(()=>import(/* webpackChunkName: "planetarium-babylon" */ './PlanetariumBabylon'))
			.then((mod)=>{
				if(!this.mounted || !this.props.active){
					return;
				}
				this.setState({
					LoadedComponent: mod.default,
					loadError: null,
					runtimeLoadMs: Date.now() - started,
				});
			})
			.catch((err)=>{
				if(!this.mounted){
					return;
				}
				console.log(err);
				this.setState({
					loadError: '天文馆渲染核心载入失败',
				});
			});
	}

	loadBabylonRuntime(){
		if(typeof window !== 'undefined' && window.BABYLON){
			return Promise.resolve();
		}
		return new Promise((resolve, reject)=>{
			const existing = document.querySelector('script[data-horosa-babylon="1"]');
			if(existing){
				existing.addEventListener('load', resolve, { once: true });
				existing.addEventListener('error', reject, { once: true });
				return;
			}
			const script = document.createElement('script');
			script.src = './vendor/babylon/babylon.js';
			script.async = true;
			script.defer = true;
			script.setAttribute('data-horosa-babylon', '1');
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	componentWillUnmount(){
		this.mounted = false;
	}

	render(){
		if(!this.props.active){
			return null;
		}
		const LoadedComponent = this.state.LoadedComponent;
		if(this.state.loadError){
			return (
				<div className="horosa-planetarium-page horosa-planetarium-loading">
					<div>{this.state.loadError}</div>
				</div>
			);
		}
		if(!LoadedComponent){
			return (
				<div className="horosa-planetarium-page horosa-planetarium-loading">
					<div>正在载入天文馆...</div>
				</div>
			);
		}
		return <LoadedComponent {...this.props} runtimeLoadMs={this.state.runtimeLoadMs} />;
	}
}

export default PlanetariumMain;
