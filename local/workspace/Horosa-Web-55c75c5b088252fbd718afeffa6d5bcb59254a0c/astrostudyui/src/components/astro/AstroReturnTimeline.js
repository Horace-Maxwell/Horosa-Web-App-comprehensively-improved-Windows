import { Component } from 'react';
import { Spin } from 'antd';
import { XQButton as Button } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, fmtDegree, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import { markPanelReady } from '../../utils/perfMark';

class AstroReturnTimeline extends Component{
	constructor(props){
		super(props);
		const now = new Date();
		this.state = {
			startYear: now.getFullYear(),
			count: 12,
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
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			this.load();
		}
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){
			return;
		}
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					startYear: this.state.startYear,
					count: this.state.count,
				}),
				timeoutMs: 45000,
			});
			if(!this._mounted) return;
			// horosa_panel_ready_v1:回归轴表(本技法唯一可见内容)落定的那一次 setState。
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key}, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, requestKey: key});
		}
	}

	render(){
		this.ensureLoaded();
		const rows = this.state.result && this.state.result.rows ? this.state.result.rows : [];
		return (
			<Spin spinning={this.state.loading}>
				<div style={{height: this.props.height || 700, overflow: 'auto', paddingRight: 8}}>
					<div style={{...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
						<label>起始年 <input type="number" value={this.state.startYear} onChange={(e)=>this.setState({startYear: e.target.value})} /></label>
						<label>年数 <input type="number" min="1" max="40" value={this.state.count} onChange={(e)=>this.setState({count: e.target.value})} /></label>
						<Button size="small" onClick={this.load}>生成时间轴</Button>
					</div>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">太阳/月亮返照时间轴</div>
						<SmallTable
							rows={rows}
							columns={[
								{key: 'year', title: '年份'},
								{key: 'solarReturn', title: '太阳返照', render: (v)=>v && v.datetime ? v.datetime : '-'},
								{key: 'lunarReturn', title: '首个月亮返照', render: (v)=>v && v.datetime ? v.datetime : '-'},
								{key: 'solarAsc', title: '太阳返照上升', render: (v)=>v ? fmtDegree(v) : '-'},
								{key: 'lunarAsc', title: '月亮返照上升', render: (v)=>v ? fmtDegree(v) : '-'},
							]}
						/>
					</div>
				</div>
			</Spin>
		);
	}
}

export default AstroReturnTimeline;
