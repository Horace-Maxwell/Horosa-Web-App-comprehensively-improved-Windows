import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { Row, Col } from 'antd';
import AstroChart from '../astro/AstroChart';
import { XQButton as Button } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from '../astro/AstroExtraCommon';
import { markPanelReady } from '../../utils/perfMark';

// [Q-151/AX-20] 调波数夹取整数 1-360:此前空串/小数原样下发,后端 int('') / int('2.5') 抛错回 {'err':'param error'}。
export function clampHarmonic(raw, fallback = 9){
	const n = Number.parseInt(`${raw === undefined || raw === null ? '' : raw}`.trim(), 10);
	if(!Number.isFinite(n)){ return fallback; }
	return Math.min(360, Math.max(1, n));
}

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
		const key = chartRequestKey(this.props.value, `harmonic|${clampHarmonic(this.state.harmonic)}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			this.load();
		}
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `harmonic|${clampHarmonic(this.state.harmonic)}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){
			return;
		}
		const harmonic = clampHarmonic(this.state.harmonic);   // [Q-151/AX-20] 夹取整数 1-360
		const key = chartRequestKey(this.props.value, `harmonic|${harmonic}`);
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/harmonic`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					harmonic,
					orb: 2,
				}),
				timeoutMs: 30000,
			});
			if(!this._mounted) return;
			clearLoadFailure(this);
			const res = unwrapResult(data) || {};
			// horosa_panel_ready_v1:调波盘中栏(调波整盘)+右栏(相位/位置表)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(与其余 10 个辅盘子盘同一技法键)。
			this.setState({result: res, loading: false, requestKey: key}, ()=>{
				markPanelReady('auxchart');
			});
			// [审计修·派生盘快照重定源] 出盘即存:整张调波盘 + [调波盘] 专属段(H数/位置表/同频)。
			saveDerivedAstroSnapshot('harmonic', res.chart, this.props.fields, ()=>{
				const out = ['[调波盘]'];
				out.push(`调波数：H${res.harmonic || this.state.harmonic || ''}`);
				(res.positions || []).forEach((row)=>{
					if(row && row.id){ out.push(`${row.id}：本命黄经 ${row.natalLon != null ? Number(row.natalLon).toFixed(2) : '—'}° → 调波 ${row.sign || ''}${row.signlon != null ? Number(row.signlon).toFixed(2) + '°' : ''}`); }
				});
				(res.conjunctions || []).forEach((c)=>{
					if(c && c.a && c.b){ out.push(`同频：${c.a} 合 ${c.b}（误差 ${c.orb != null ? Number(c.orb).toFixed(3) : '—'}）`); }
				});
				return out.length > 1 ? out : [];
			});
		}catch(e){
			// [Q-151/AX-20] 失败不把 key 记成已完成(否则同 key 不再自动重试);泊车该 key,窗口期后自动重试,「计算调波盘」钮可立即重试。
			parkLoadFailure(this, key);
			if(!this._mounted) return;
			this.setState({loading: false, loadError: (e && e.message) || '调波盘计算失败'});
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
									<div style={{color: 'var(--horosa-text-soft, #999)', fontSize: 13}}>
										{this.state.loading ? '调波盘计算中…' : (this.state.loadError ? `调波盘计算失败：${this.state.loadError}（可点「计算调波盘」重试）` : '暂无调波盘数据，请点「计算调波盘」')}
									</div>
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
									<label>调波数 <input type="number" min="1" max="360" step="1" value={this.state.harmonic} onChange={(e)=>this.setState({harmonic: e.target.value})} onBlur={(e)=>this.setState({harmonic: clampHarmonic(e.target.value)})} /></label>
									<Button size="small" loading={this.state.loading} onClick={()=>{ clearLoadFailure(this); this.load(); }}>计算调波盘</Button>
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
