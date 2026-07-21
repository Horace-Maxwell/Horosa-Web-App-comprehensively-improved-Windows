// components/astro/AstroDistributions.js
// 界推运（Distributions）：上升点经主限运动穿越各埃及界 → 分配星(界主)+参与星。后端 /predict/dist。
import { Component } from 'react';
import { Spin } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import * as AstroText from '../../constants/AstroText';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);

// AI 快照用中文名(astroSymbol 的字形在纯文本里不可读)。
function distName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}

// 界推运 AI 快照(无头):内部 fetch /predict/dist,与组件同口径。aiAnalysisContext 复算用。
export async function buildDistributionsSnapshotText(chartObj){
	if(!chartObj){ return ''; }
	let rows = [];
	try{
		// WP-C 极速化:无头快照复算也走 silent,不触发全局满屏 Spin 压暗(失败经外层 catch 回 '')。
		const data = await request(`${Constants.ServerRoot}/predict/dist`, {
			body: JSON.stringify({ ...chartParams(chartObj) }),
			timeoutMs: 60000,
			silent: silentTechniquePanelsEnabled(),
		});
		const r = unwrapResult(data) || {};
		rows = r.dist || [];
	}catch(e){
		return '';
	}
	if(!rows.length){ return ''; }  // 无界推运数据=该技法在本盘缺失,挂载显示「缺失」而非空表头。
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[界推运（分配法 / Distributions）]');
	lines.push('上升点经主限运动穿越各埃及界；分配星=界主星，参与星=该期间内上升点触及的行星。');
	lines.push('');
	lines.push('| 分配星 | 界(座) | 参与星 | 起 | 止 |');
	lines.push('| --- | --- | --- | --- | --- |');
	rows.forEach((row)=>{
		const participants = (row.participants && row.participants.length)
			? row.participants.map(distName).join('、')
			: '—';
		lines.push(`| ${distName(row.distributor)} | ${distName(row.sign)} | ${participants} | ${row.startDate || '-'} | ${row.endDate || '-'} |`);
	});
	// [YB] 尾部 [当前时点]+[方法说明];定位行=今日所在分配段(起止日期可解析且含今日才出,防后端日期格式变体误判)。
	const extraLines = [];
	const nowMs = Date.now();
	const curRow = rows.find((row)=>{
		const s = Date.parse(`${row.startDate || ''}`.replace(/\//g, '-'));
		const e = Date.parse(`${row.endDate || ''}`.replace(/\//g, '-'));
		return Number.isFinite(s) && Number.isFinite(e) && nowMs >= s && nowMs <= e;
	});
	if(curRow){
		extraLines.push(`当前分配星：${distName(curRow.distributor)}（${distName(curRow.sign)} 界，${curRow.startDate || '-'} ~ ${curRow.endDate || '-'}）`);
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('distributions')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

class AstroDistributions extends Component {
	constructor(props){
		super(props);
		this.state = { loading: false, result: null, requestKey: '' };
		this.load = this.load.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	// AI导出:在界推运 tab 导出时响应刷新事件,把快照(内部 fetch /predict/dist 后)写回 detail.snapshotText,export 轮询读取。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'distributions' || !this.props.value){ return; }
		buildDistributionsSnapshotText(this.props.value).then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidUpdate(){
		const k = chartRequestKey(this.props.value, 'dist');
		if(k && k !== this.state.requestKey && !this.state.loading){ this.load(); }
	}

	ensureLoaded(){
		const k = chartRequestKey(this.props.value, 'dist');
		if(k && k !== this.state.requestKey && !this.state.loading){ setTimeout(this.load, 0); }
	}

	async load(){
		if(!this.props.value){ return; }
		const k = chartRequestKey(this.props.value, 'dist');
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧表留存+「更新中…」角标,
		// 新表到达单次 setState 整体替换 —— 印占同款范式)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/predict/dist`, {
				body: JSON.stringify({ ...chartParams(this.props.value) }),
				timeoutMs: 60000,
				silent: silentTechniquePanelsEnabled(),
			});
			if(!this._mounted) return;
			// 空载荷守卫:request() 吞错 resolve undefined(网络层失败)——此前 `|| {}` 会把旧表冲成空表,
			// keep-stale 要求保留旧结果,此次不更新、重试即恢复。
			if(!data){
				this.setState({ loading: false, requestKey: k });
				return;
			}
			this.setState({ result: unwrapResult(data) || {}, loading: false, requestKey: k });
		}catch(e){
			if(!this._mounted) return;
			this.setState({ loading: false, requestKey: k });
		}
	}

	render(){
		this.ensureLoaded();
		const r = this.state.result || {};
		const rows = r.dist || [];
		const height = this.props.height ? this.props.height - 20 : 700;
		const sym = (id) => astroSymbol(id);
		return (
			// keep-stale:局部 Spin 只留给首次加载(无旧表可显);重取期间旧表原样可读,右上角「更新中…」角标提示。
			<Spin spinning={this.state.loading && !this.state.result}>
				<div style={{ position: 'relative' }}>
				{this.state.loading && this.state.result ? <UpdatingBadge /> : null}
				<div style={{ height, overflow: 'auto', paddingRight: 8 }}>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">界推运（分配法 / Distributions）</div>
						<SmallTable
							rowKey={(row, i) => i}
							rows={rows}
							columns={[
								{ key: 'distributor', title: '分配星', render: (v) => sym(v) },
								{ key: 'sign', title: '界(座)', render: (v) => sym(v) },
								{ key: 'participants', title: '参与星', render: (v) => ((v && v.length) ? v.map((p, i) => <span key={i} style={{ marginRight: 4 }}>{sym(p)}</span>) : '—') },
								{ key: 'startDate', title: '起', render: (v) => v || '-' },
								{ key: 'endDate', title: '止', render: (v) => v || '-' },
							]}
						/>
						<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>上升点经主限运动穿越各埃及界；分配星=界主星，参与星=该期间内上升点触及的行星。</div>
					</div>
				</div>
				</div>
			</Spin>
		);
	}
}

export default AstroDistributions;
