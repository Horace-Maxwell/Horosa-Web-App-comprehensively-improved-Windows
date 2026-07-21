import { Component } from 'react';
import { Spin } from 'antd';
import { XQButton as Button } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtNum, paramsRequestKey, cardStyle, SmallTable } from '../astro/AstroExtraCommon';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';

class AstroRelativeScore extends Component{
	constructor(props){
		super(props);
		this.state = {
			loading: false,
			result: null,
			requestKey: '',
		};
		this.load = this.load.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
	}

	componentWillUnmount(){
		this._mounted = false;
	}

	componentDidUpdate(prevProps){
		const key = paramsRequestKey(this.props.params);
		if(key && key !== this.state.requestKey && !this.state.loading){
			this.load();
		}
	}

	ensureLoaded(){
		const key = paramsRequestKey(this.props.params);
		if(key && key !== this.state.requestKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.params){
			return;
		}
		const key = paramsRequestKey(this.props.params);
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧结果留存+「更新中…」角标,
		// 新结果到达单次 setState 整体替换)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({loading: true, updating: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/relative`, {
				body: JSON.stringify(this.props.params),
				timeoutMs: 45000,
				silent: silentTechniquePanelsEnabled(),
			});
			if(!this._mounted) return;
			// request 失败可能 resolve undefined —— 空回包保持旧结果不清空,只收角标(否则旧分数被 {} 冲掉)
			const result = unwrapResult(data);
			if(!result){
				this.setState({loading: false, updating: false, requestKey: key});
				return;
			}
			this.setState({result, loading: false, updating: false, requestKey: key});
			// 分数上抛父组件，供合盘被动快照/AI 导出带上「关系量化」段（否则分数只在本组件本地 state）。
			if(this.props.onResult){
				this.props.onResult(result);
			}
		}catch(e){
			// 失败保持旧结果不清空,只收角标
			if(!this._mounted) return;
			this.setState({loading: false, updating: false, requestKey: key});
		}
	}

	renderAspects(title, rows){
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">{title}</div>
				<SmallTable
					rows={rows || []}
					columns={[
						{key: 'a', title: 'A', render: (v)=>astroSymbol(v)},
						{key: 'aspect', title: '相位', render: (v)=>`${fmtNum(v, 0)}°`},
						{key: 'b', title: 'B', render: (v)=>astroSymbol(v)},
						{key: 'orb', title: '误差', render: (v)=>fmtNum(v, 3)},
						{key: 'impact', title: '权重', render: (v)=>fmtNum(v, 2)},
					]}
				/>
			</div>
		);
	}

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		return (
			// position:relative=角标定位上下文(放滚动容器外,角标不随内容滚走);
			// 局部 Spin 只留首载(无旧结果)占位,重取走角标不压暗
			<div style={{position: 'relative'}}>
				{this.state.updating && this.state.result ? <UpdatingBadge /> : null}
			<Spin spinning={this.state.loading && !this.state.result}>
				<div style={{height: this.props.height || 640, overflow: 'auto', paddingRight: 8}}>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">关系量化</div>
						<div style={{fontSize: 40, lineHeight: '48px', fontWeight: 700}}>{result.score !== undefined ? result.score : '-'}</div>
						<Button size="small" onClick={this.load}>重新计算</Button>
					</div>
					{this.renderAspects('顺畅连接', result.highlights)}
					{this.renderAspects('张力连接', result.challenges)}
					{this.renderAspects('全部权重相位', result.aspects)}
				</div>
			</Spin>
			</div>
		);
	}
}

export default AstroRelativeScore;
