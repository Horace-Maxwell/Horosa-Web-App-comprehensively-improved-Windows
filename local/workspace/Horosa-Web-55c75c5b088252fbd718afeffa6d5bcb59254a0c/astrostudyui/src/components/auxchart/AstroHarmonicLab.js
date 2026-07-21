import { Component } from 'react';
import { Row, Col } from 'antd';
import AstroChart from '../astro/AstroChart';
import { XQButton as Button } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable } from '../astro/AstroExtraCommon';
import { markPanelReady } from '../../utils/perfMark';

class AstroHarmonicLab extends Component{
	constructor(props){
		super(props);
		this.state = {
			harmonic: 9,
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
		const key = chartRequestKey(this.props.value, `harmonic|${this.state.harmonic}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			this.load();
		}
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `harmonic|${this.state.harmonic}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){
			return;
		}
		const key = chartRequestKey(this.props.value, `harmonic|${this.state.harmonic}`);
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/harmonic`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					harmonic: this.state.harmonic,
					orb: 2,
				}),
				timeoutMs: 30000,
			});
			if(!this._mounted) return;
			// horosa_panel_ready_v1:调波盘中栏(调波整盘)+右栏(相位/位置表)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(与其余 10 个辅盘子盘同一技法键)。
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key}, ()=>{
				markPanelReady('auxchart');
			});
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, requestKey: key});
		}
	}

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		const chartObj = result.chart || null;
		const height = this.props.height ? this.props.height : 760;
		return (
			<div className="horosa-aux-module-page xq-chart-renderer xq-chart-renderer-germany">
				<div className="horosa-midpoint-host">
					<div className="horosa-midpoint-workbench">
						<Row gutter={6} className="horosa-midpoint-layout">
							<Col span={18} className="horosa-midpoint-chart-col">
								{chartObj ? (
									<AstroChart
										value={chartObj}
										chartStyle={this.props.chartStyle}
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										height={height}
									/>
								) : (
									<div style={{color: 'var(--horosa-text-soft, #999)', fontSize: 13}}>
										{this.state.loading ? '调波盘计算中…' : '暂无调波盘数据，请点「计算调波盘」'}
									</div>
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
									<label>调波数 <input type="number" min="1" max="360" value={this.state.harmonic} onChange={(e)=>this.setState({harmonic: e.target.value})} /></label>
									<Button size="small" loading={this.state.loading} onClick={this.load}>计算调波盘</Button>
									<span>当前：H{result.harmonic || this.state.harmonic}</span>
								</div>
								<div style={{...cardStyle, width: '100%'}}>
									<div className="horosa-info-card-title">调波位置</div>
									<SmallTable
										rows={result.positions || []}
										columns={[
											{key: 'id', title: '点', render: (v)=>astroSymbol(v)},
											{key: 'natalLon', title: '本命黄经', render: (v)=>`${fmtNum(v)}°`},
											{key: 'sign', title: '调波位置', render: (_v, row)=>fmtDegree(row)},
										]}
									/>
								</div>
								<div style={{...cardStyle, width: '100%'}}>
									<div className="horosa-info-card-title">调波合相/同频</div>
									<SmallTable
										rows={result.conjunctions || []}
										columns={[
											{key: 'a', title: '点A', render: (v)=>astroSymbol(v)},
											{key: 'b', title: '点B', render: (v)=>astroSymbol(v)},
											{key: 'orb', title: '误差', render: (v)=>fmtNum(v, 3)},
										]}
									/>
								</div>
							</Col>
						</Row>
					</div>
				</div>
			</div>
		);
	}
}

export default AstroHarmonicLab;
