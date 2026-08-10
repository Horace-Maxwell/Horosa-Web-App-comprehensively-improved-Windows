// components/auxchart/AstroDraconicLab.js
// 龙盘（Draconic）：以月亮北交点归零为白羊 0°，各点黄经减北交点黄经。后端 /astroextra/draconic 出整盘，复用 AstroChart 绘制。
import { Component } from 'react';
import { Row, Col } from 'antd';
import AstroChart from '../astro/AstroChart';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable } from '../astro/AstroExtraCommon';
import { markPanelReady } from '../../utils/perfMark';

class AstroDraconicLab extends Component {
	constructor(props){
		super(props);
		this.state = { loading: false, result: null, requestKey: '' };
		this.load = this.load.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }

	componentWillUnmount(){ this._mounted = false; }

	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, 'draconic');
		if(key && key !== this.state.requestKey && !this.state.loading){ this.load(); }
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, 'draconic');
		if(key && key !== this.state.requestKey && !this.state.loading){ setTimeout(this.load, 0); }
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, 'draconic');
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/draconic`, {
				body: JSON.stringify({ ...chartParams(this.props.value), orb: 2 }),
				timeoutMs: 30000,
			});
			if(!this._mounted) return;
			// horosa_panel_ready_v1:龙盘中栏(整盘)+右栏(位置/合相表)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(双 rAF 后记,近似本帧已绘)。
			this.setState({ result: unwrapResult(data) || {}, loading: false, requestKey: key }, ()=>{
				markPanelReady('auxchart');
			});
		}catch(e){
			if(!this._mounted) return;
			this.setState({ loading: false, requestKey: key });
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
										wheelArt={this.props.wheelArt}
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										height={height}
									/>
								) : (
									<div style={{ color: 'var(--horosa-text-soft, #999)', fontSize: 13 }}>
										{this.state.loading ? '龙盘计算中…' : '暂无龙盘数据'}
									</div>
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{ ...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
									<span style={{ fontWeight: 600 }}>龙盘（Draconic）</span>
									<span style={{ fontSize: 12, opacity: 0.7 }}>北交点 {result.nodeLon != null ? `${fmtNum(result.nodeLon)}°` : '-'} → 归零白羊 0°</span>
								</div>
								<div style={{ ...cardStyle, width: '100%' }}>
									<div className="horosa-info-card-title">龙盘位置</div>
									<SmallTable
										rows={result.positions || []}
										columns={[
											{ key: 'id', title: '点', render: (v) => astroSymbol(v) },
											{ key: 'natalLon', title: '本命黄经', render: (v) => `${fmtNum(v)}°` },
											{ key: 'sign', title: '龙盘位置', render: (_v, row) => fmtDegree(row) },
										]}
									/>
								</div>
								<div style={{ ...cardStyle, width: '100%' }}>
									<div className="horosa-info-card-title">龙盘合相/同频</div>
									<SmallTable
										rows={result.conjunctions || []}
										columns={[
											{ key: 'a', title: '点A', render: (v) => astroSymbol(v) },
											{ key: 'b', title: '点B', render: (v) => astroSymbol(v) },
											{ key: 'orb', title: '误差', render: (v) => fmtNum(v, 3) },
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

export default AstroDraconicLab;
