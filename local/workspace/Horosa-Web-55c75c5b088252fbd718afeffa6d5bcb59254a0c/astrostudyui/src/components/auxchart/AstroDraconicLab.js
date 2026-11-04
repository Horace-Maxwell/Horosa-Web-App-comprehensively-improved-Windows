// components/auxchart/AstroDraconicLab.js
// 龙盘（Draconic）：以月亮北交点归零为白羊 0°，各点黄经减北交点黄经。后端 /astroextra/draconic 出整盘，复用 AstroChart 绘制。
// 真 / 平交点随全局 westNodeType('true'=真交点;缺省 mean=平交点),页面与快照都注明。
function nodeTypeLabel(chartObj){
	const v = chartObj && chartObj.params ? chartObj.params.westNodeType : undefined;
	return v === 'true' || v === true ? '真交点' : '平交点';
}
import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { Row, Col } from 'antd';
import { XQButton as Button, XQSelect as Select } from '../xq-ui';
import AstroChart from '../astro/AstroChart';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from '../astro/AstroExtraCommon';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';
import { definePageSettings } from '../../utils/pageSettingsStore';

// 宫位口径(两家):whole = 按龙盘上升所在整座等分(与调波 / 十二分 / 十三分盘同法,缺省);
// shift = 本命宫头(按所选分宫制)一并减去北交点黄经 —— 整盘平移,每颗星的落宫与本命一致,只换星座。
export const DRACONIC_HOUSE_MODES = ['whole', 'shift'];
const DRACONIC_HOUSE_LABELS = { whole: '整宫(随龙盘上升)', shift: '本命宫头平移(保留分宫制)' };
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
			const data = await request(`${Constants.ServerRoot}/astroextra/draconic`, {
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
			saveDerivedAstroSnapshot('draconic', res.chart, this.props.fields, ()=>{
				const out = ['[龙盘]'];
				if(res.nodeLon != null){ out.push(`北交点 ${Number(res.nodeLon).toFixed(2)}°（${nodeTypeLabel(this.props.value)}） → 归零白羊 0°（龙盘基准）`); }   // 注明真 / 平交点
				out.push(`宫位口径：${DRACONIC_HOUSE_LABELS[houseMode] || DRACONIC_HOUSE_LABELS.whole}${houseMode === 'shift' ? '，各星落宫与本命一致' : ''}`);
				(res.positions || []).forEach((row)=>{
					if(row && row.id){ out.push(`${row.id}：本命黄经 ${row.natalLon != null ? Number(row.natalLon).toFixed(2) : '—'}° → 龙盘 ${row.sign || ''}${row.signlon != null ? Number(row.signlon).toFixed(2) + '°' : ''}`); }
				});
				(res.conjunctions || []).forEach((c)=>{
					if(c && c.a && c.b){ out.push(`同频：${c.a} 合 ${c.b}（误差 ${c.orb != null ? Number(c.orb).toFixed(3) : '—'}）`); }
				});
				return out.length > 1 ? out : [];
			});
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
									<div style={{ color: 'var(--horosa-text-soft, #999)', fontSize: 13 }}>
										{this.state.loading ? '龙盘计算中…' : (this.state.loadError ? `龙盘计算失败：${this.state.loadError}` : '暂无龙盘数据')}
										{!this.state.loading && this.state.loadError ? (
											<Button size="small" style={{ marginLeft: 8 }} onClick={()=>{ clearLoadFailure(this); this.load(); }}>重试</Button>
										) : null}
									</div>
								)}
							</Col>
							<Col span={6} className="horosa-midpoint-side-col">
								<div style={{ ...cardStyle, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
									<span style={{ fontWeight: 600 }}>龙盘（Draconic）</span>
									<span style={{ fontSize: 12, opacity: 0.7 }}>北交点 {result.nodeLon != null ? `${fmtNum(result.nodeLon)}°` : '-'}（{nodeTypeLabel(this.props.value)}） → 归零白羊 0°</span>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', fontSize: 12 }}>
										<span>宫位口径</span>
										<Select size="small" style={{ flex: 1 }} value={this.state.houseMode} onChange={this.changeHouseMode} dropdownMatchSelectWidth={false}
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
