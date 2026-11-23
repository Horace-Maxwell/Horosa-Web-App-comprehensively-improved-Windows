// components/auxchart/AstroDraconicLab.js
// 龙盘（Draconic）：以月亮北交点归零为白羊 0°，各点黄经减北交点黄经。后端 /astroextra/draconic 出整盘，复用 AstroChart 绘制。
// 真 / 平交点随全局 westNodeType('true'=真交点;缺省 mean=平交点),页面与快照都注明。
import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { Row, Col } from 'antd';
import { XQSelect as Select, XQState } from '../xq-ui';
import AstroChart from '../astro/AstroChart';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, requestDerived } from '../astro/AstroExtraCommon';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';
import { definePageSettings } from '../../utils/pageSettingsStore';

// 宫位口径两家 / 标签 / [龙盘] 专属段:页面与 AI 无头复算同一份(utils/derivedAstroLabs)
import { DRACONIC_HOUSE_MODES, DRACONIC_HOUSE_LABELS, draconicNodeTypeLabel as nodeTypeLabel, draconicSnapshotLines } from '../../utils/derivedAstroLabs';
export { DRACONIC_HOUSE_MODES };
export const DRACONIC_PAGE_SETTINGS = definePageSettings('horosa.draconic.settings.v1', {
	houseMode: { label: '宫位口径', def: 'whole', oneOf: DRACONIC_HOUSE_MODES },
});

class AstroDraconicLab extends Component {
	constructor(props){
		super(props);
		this.state = { loading: false, result: null, requestKey: '', houseMode: DRACONIC_PAGE_SETTINGS.load().houseMode };
		this.load = this.load.bind(this);
		this.changeHouseMode = this.changeHouseMode.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }

	componentWillUnmount(){ this._mounted = false; }

	// 请求键带宫位口径:改口径即重取(宫位由后端按口径排)
	requestKey(){
		const base = chartRequestKey(this.props.value, 'draconic');
		return base ? `${base}|houses=${this.state.houseMode}` : base;
	}

	changeHouseMode(houseMode){
		DRACONIC_PAGE_SETTINGS.save({ houseMode });
		this.setState({ houseMode }, ()=>this.load());
	}

	componentDidUpdate(){
		const key = this.requestKey();
		if(key && key !== this.state.requestKey && !this.state.loading){ this.load(); }
	}

	ensureLoaded(){
		const key = this.requestKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ setTimeout(this.load, 0); }
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const key = this.requestKey();
		const houseMode = this.state.houseMode;
		this.setState({ loading: true });
		try{
			const data = await requestDerived(`${Constants.ServerRoot}/astroextra/draconic`, {
				body: JSON.stringify({ ...chartParams(this.props.value), orb: 2, draconicHouses: houseMode }),
				timeoutMs: 30000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			clearLoadFailure(this);
			const res = unwrapResult(data) || {};
			// horosa_panel_ready_v1:龙盘中栏(整盘)+右栏(位置/合相表)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(双 rAF 后记,近似本帧已绘)。
			this.setState({ result: res, resultSig, loading: false, requestKey: key, loadError: '' }, ()=>{
				markPanelReady('auxchart');
			});
			// 出盘即存:整张龙盘 + [龙盘] 专属段(龙首归零基准/位置/同频)。
			saveDerivedAstroSnapshot('draconic', res.chart, this.props.fields, ()=>draconicSnapshotLines(res, houseMode, this.props.value), { derivedParams: { draconicHouses: houseMode } });
		}catch(e){
			// 失败不记成已完成;泊车 key 窗口期后自动重试,并给「重试」钮(此前龙盘无任何重试入口)。
			parkLoadFailure(this, key);
			if(!this._mounted || seq !== this._loadSeq) return;
			this.setState({ loading: false, loadError: (e && e.message) || '龙盘计算失败' });
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
									<XQState layout="inline" subject="龙盘"
										status={this.state.loading ? 'loading' : (this.state.loadError ? 'error' : 'empty')}
										error={this.state.loadError} onRetry={()=>{ clearLoadFailure(this); this.load(); }} />
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{ ...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
									<span style={{ fontWeight: 600 }}>龙盘（Draconic）</span>
									<span style={{ fontSize: 12, opacity: 0.7 }}>北交点 {result.nodeLon != null ? `${fmtNum(result.nodeLon)}°` : '-'}（{nodeTypeLabel(this.props.value)}） → 归零白羊 0°</span>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', fontSize: 12 }}>
										{/* 标签不收缩、不折行;窄栏时由下拉收窄(此前放大档右栏变窄,标签被挤成逐字竖排) */}
										<span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>宫位口径</span>
										<Select size="small" style={{ flex: 1, minWidth: 0 }} value={this.state.houseMode} onChange={this.changeHouseMode} dropdownMatchSelectWidth={false}
											options={DRACONIC_HOUSE_MODES.map((v)=>({ value: v, label: DRACONIC_HOUSE_LABELS[v] }))} />
									</label>
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
