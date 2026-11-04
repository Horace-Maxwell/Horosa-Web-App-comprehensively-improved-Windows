import React, { Component } from 'react';
import { Spin } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, chartParams, chartRequestKey, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import ProgMethodPanel, { ProgPageSide } from './AstroProgChart';
import { ProgPageShell } from './progPageLayout';
import { buildTropicalProgSnapshotText, today, chartZone, methodTab } from './astroProgSnapshot';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';


// 推运（回归黄道）：二次/三次/小推运。每个子 tab → 左固定推运双盘 + 右可滚动行星位置/相位表（ProgMethodPanel）。
// 小推运月长算法用顶栏「月长算法」选择器（minorVariant），缺省 synodic=标准朔望月。
class AstroProgressions extends Component{
	constructor(props){
		super(props);
		this.state = {
			targetDate: today(chartZone(props.value)),   // 「今日」按本盘时区
			targetTime: '12:00:00',
			minorVariant: DIRECTION_PAGE_SETTINGS.load().minorVariant,   // 上次亲手设的月长算法(三个推运页共用;没存过 = synodic)
			loading: false,
			result: null,
			requestKey: '', progMethod: 'secondary',
		};
		this.load = this.load.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}
	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出刷新事件:此前本组件无监听 → 星运页导出「二次推运」经 extractSimpleModuleContent 读缓存槽
	// 'prog'(只由 AI 挂载无头重算写、任意盘)→ 导出到别人的推运;从未挂载则「无可导出文本」。按页面当前目标时刻/月长算法出。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'prog' || !this.props.value){ return; }
		buildTropicalProgSnapshotText(this.props.value, { targetDate: this.state.targetDate, targetTime: this.state.targetTime, minorVariant: this.state.minorVariant })
			.then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ setTimeout(this.load, 0); }
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					targetDate: this.state.targetDate,
					targetTime: this.state.targetTime,
					minorVariant: this.state.minorVariant,
					orb: 1.5,
				}),
				timeoutMs: 45000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			clearLoadFailure(this);
			// horosa_panel_ready_v1:推运 结果(中栏盘 + 右栏表同源于 result)落定的那一次 setState。
			this.setState({ result: unwrapResult(data) || {}, resultSig, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
		}catch(e){
			// 失败不把 key 记成已完成(改日期失败=永远没反应);泊车该 key,窗口期后自动重试。
			parkLoadFailure(this, key);
			if(!this._mounted || seq !== this._loadSeq) return;
			this.setState({ loading: false });
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const shown = this.shownResult();
		const result = shown || {};
		const methods = result.methods || [];
		const method = methods.find((m)=>m.method === this.state.progMethod) || methods[0] || null;
		const height = this.props.height ? this.props.height - 10 : 700;
		// 版式与主限法盘同一个:左边整列推运双盘,右栏标题 · 时间选择 · 设置 · 表(progPageLayout);改任何设置自动重算
		const side = (
			<ProgPageSide
				title="推运"
				desc="回归黄道推运:二次推运一日行一年、三次推运一日行一月、小推运一月行一年;目标时刻按所选推运法折算成出生后的某一时刻,外圈即那一刻的天象,内圈本命。"
				result={result}
				method={method}
				methodLabel={methodTab}
				targetDate={this.state.targetDate}
				targetTime={this.state.targetTime}
				zone={chartZone(this.props.value)}
				minorVariant={this.state.minorVariant}
				onTime={(targetDate, targetTime)=>this.setState({ targetDate, targetTime })}
				onMinor={(v)=>{ DIRECTION_PAGE_SETTINGS.save({ minorVariant: v }); this.setState({ minorVariant: v }); }}
				onMethod={(v)=>this.setState({ progMethod: v })}
			/>
		);
		return (
			<Spin spinning={this.state.loading && !methods.length}>
				<ProgPageShell height={height} updating={this.state.loading && methods.length > 0}>
					<ProgMethodPanel
						value={this.props.value}
						method={method}
						side={side}
						targetDate={this.state.targetDate}
						targetTime={this.state.targetTime}
						mode="tropical"
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						showAstroMeaning={this.props.showAstroMeaning}
					/>
				</ProgPageShell>
			</Spin>
		);
	}
}

export default AstroProgressions;
