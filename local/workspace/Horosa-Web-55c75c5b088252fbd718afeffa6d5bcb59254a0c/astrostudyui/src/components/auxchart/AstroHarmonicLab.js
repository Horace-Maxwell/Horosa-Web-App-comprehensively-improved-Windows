import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { Row, Col } from 'antd';
import AstroChart from '../astro/AstroChart';
import { XQButton as Button, XQInputNumber, XQState } from '../xq-ui';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, requestDerived } from '../astro/AstroExtraCommon';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';

import { clampHarmonic, harmonicSnapshotLines } from '../../utils/derivedAstroLabs';   // 夹取与 [调波盘] 专属段:页面与 AI 无头复算同一份
export { clampHarmonic };

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
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){
			return;
		}
		const harmonic = clampHarmonic(this.state.harmonic);   // 夹取整数 1-360
		const key = chartRequestKey(this.props.value, `harmonic|${harmonic}`);
		this.setState({loading: true});
		try{
			const data = await requestDerived(`${Constants.ServerRoot}/astroextra/harmonic`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					harmonic,
					orb: 2,
				}),
				timeoutMs: 30000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			clearLoadFailure(this);
			const res = unwrapResult(data) || {};
			// horosa_panel_ready_v1:调波盘中栏(调波整盘)+右栏(相位/位置表)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(与其余 10 个辅盘子盘同一技法键)。
			this.setState({result: res, resultSig, loading: false, requestKey: key}, ()=>{
				markPanelReady('auxchart');
			});
			// 出盘即存:整张调波盘 + [调波盘] 专属段(H数/位置表/同频)。
			saveDerivedAstroSnapshot('harmonic', res.chart, this.props.fields, ()=>harmonicSnapshotLines(res, this.state.harmonic), { derivedParams: { harmonic } });
		}catch(e){
			// 失败不把 key 记成已完成(否则同 key 不再自动重试);泊车该 key,窗口期后自动重试,「计算调波盘」钮可立即重试。
			parkLoadFailure(this, key);
			if(!this._mounted || seq !== this._loadSeq) return;
			this.setState({loading: false, loadError: (e && e.message) || '调波盘计算失败'});
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const result = this.shownResult() || {};
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
									<XQState layout="inline" subject="调波盘"
										status={this.state.loading ? 'loading' : (this.state.loadError ? 'error' : 'empty')}
										error={this.state.loadError ? `${this.state.loadError}（可点「计算调波盘」重试）` : ''}
										title={this.state.loading || this.state.loadError ? undefined : '暂无调波盘数据，请点「计算调波盘」'} />
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
									<label>调波数 <XQInputNumber size="small" min={1} max={360} step={1} precision={0} value={this.state.harmonic} onChange={(v)=>this.setState({harmonic: v === null ? '' : v})} onBlur={(e)=>this.setState({harmonic: clampHarmonic(e.target.value)})} style={{ width: 76 }} /></label>
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
