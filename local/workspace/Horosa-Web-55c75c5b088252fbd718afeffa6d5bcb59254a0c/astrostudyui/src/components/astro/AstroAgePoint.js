// components/astro/AstroAgePoint.js
// 年龄推进点（Age Point）：年龄点自上升点起沿 Koch 宫顺行，每宫 6 年、72 年一周。
// 报每岁落座/落宫，并高亮与本命星合相的关键岁数。后端 /predict/agepoint。
import { Component } from 'react';
import { Spin } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import * as AstroText from '../../constants/AstroText';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);

// AI 快照用中文名(astroSymbol 字形在纯文本里不可读)。
function apName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}

// 年龄推进点 AI 快照(无头):内部 fetch /predict/agepoint,与组件同口径。aiAnalysisContext 复算用。
export async function buildAgePointSnapshotText(chartObj){
	if(!chartObj){ return ''; }
	let points = [];
	try{
		const data = await request(`${Constants.ServerRoot}/predict/agepoint`, {
			body: JSON.stringify({ ...chartParams(chartObj) }),
			timeoutMs: 60000,
		});
		const r = unwrapResult(data) || {};
		points = (r.agepoint && r.agepoint.points) ? r.agepoint.points : [];
	}catch(e){
		return '';
	}
	if(!points.length){ return ''; }  // 无年龄推进点数据=该技法在本盘缺失,挂载显示「缺失」而非空表头。
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[年龄推进点（Age Point / Huber）]');
	lines.push('年龄点自上升点起，沿 Koch 宫顺行，每宫 6 年、72 年回归上升；落于本命星处（合相）为人生关键节点。');
	const keyAges = points.filter((p) => p.aspectTo);
	if(keyAges.length){
		lines.push('');
		lines.push('关键岁数（合本命）：' + keyAges.map((p) => `${p.age}岁合${apName(p.aspectTo)}`).join('；'));
	}
	lines.push('');
	lines.push('| 年龄 | 落座 | 宫 | 合本命 |');
	lines.push('| --- | --- | --- | --- |');
	points.forEach((p)=>{
		const sign = `${apName(p.sign)}${(p.signlon !== undefined && p.signlon !== null) ? ' ' + p.signlon + '°' : ''}`;
		lines.push(`| ${p.age}岁 | ${sign} | ${p.house}宫 | ${p.aspectTo ? apName(p.aspectTo) : '—'} |`);
	});
	// [YB] 尾部 [当前时点]+[方法说明];定位行=当前年龄对应的年龄点行(取 age≤当前年龄的最大行)。
	const extraLines = [];
	const birthRaw = (chartObj && chartObj.params && chartObj.params.birth) ? `${chartObj.params.birth}`.trim() : '';
	const birthMs = birthRaw ? Date.parse(birthRaw.replace(/\//g, '-').replace(' ', 'T')) : NaN;
	if(Number.isFinite(birthMs)){
		const curAge = (Date.now() - birthMs) / (365.2425 * 24 * 3600 * 1000);
		let curPoint = null;
		points.forEach((p)=>{
			if(Number(p.age) <= curAge && (!curPoint || Number(p.age) > Number(curPoint.age))){ curPoint = p; }
		});
		if(curPoint){
			const curSign = `${apName(curPoint.sign)}${(curPoint.signlon !== undefined && curPoint.signlon !== null) ? ' ' + curPoint.signlon + '°' : ''}`;
			extraLines.push(`当前年龄点：${curPoint.age}岁 落${curSign}，第${curPoint.house}宫${curPoint.aspectTo ? `，合本命${apName(curPoint.aspectTo)}` : ''}`);
		}
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('agepoint')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

class AstroAgePoint extends Component {
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

	// AI导出:在年龄推进点 tab 导出时响应刷新事件,把快照(内部 fetch /predict/agepoint 后)写回 detail.snapshotText,export 轮询读取。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'agepoint' || !this.props.value){ return; }
		buildAgePointSnapshotText(this.props.value).then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidUpdate(){
		const k = chartRequestKey(this.props.value, 'agepoint');
		if(k && k !== this.state.requestKey && !this.state.loading){ this.load(); }
	}

	ensureLoaded(){
		const k = chartRequestKey(this.props.value, 'agepoint');
		if(k && k !== this.state.requestKey && !this.state.loading){ setTimeout(this.load, 0); }
	}

	async load(){
		if(!this.props.value){ return; }
		const k = chartRequestKey(this.props.value, 'agepoint');
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/predict/agepoint`, {
				body: JSON.stringify({ ...chartParams(this.props.value) }),
				timeoutMs: 60000,
			});
			if(!this._mounted) return;
			this.setState({ result: unwrapResult(data) || {}, loading: false, requestKey: k });
		}catch(e){
			if(!this._mounted) return;
			this.setState({ loading: false, requestKey: k });
		}
	}

	render(){
		this.ensureLoaded();
		const r = this.state.result || {};
		const ap = r.agepoint || {};
		const points = ap.points || [];
		const keyAges = points.filter((p) => p.aspectTo);
		const height = this.props.height ? this.props.height - 20 : 700;
		const sym = (id) => astroSymbol(id);
		return (
			<Spin spinning={this.state.loading}>
				<div style={{ height, overflow: 'auto', paddingRight: 8 }}>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">年龄推进点（Age Point / Huber）</div>
						{keyAges.length > 0 && (
							<div style={{ marginBottom: 10, fontSize: 13, lineHeight: '22px' }}>
								<span style={{ opacity: 0.7, marginRight: 6 }}>关键岁数（合本命）：</span>
								{keyAges.map((p, i) => (
									<span key={i} style={{ display: 'inline-block', marginRight: 10, whiteSpace: 'nowrap' }}>
										<b>{p.age}</b> 岁 合 <span style={{ fontFamily: 'AstroFont' }}>{sym(p.aspectTo)}</span>
									</span>
								))}
							</div>
						)}
						<SmallTable
							rowKey={(row) => row.age}
							rows={points}
							columns={[
								{ key: 'age', title: '年龄', render: (v) => `${v} 岁` },
								{ key: 'sign', title: '落座', render: (v, row) => <span><span style={{ fontFamily: 'AstroFont', marginRight: 4 }}>{sym(v)}</span>{row.signlon}°</span> },
								{ key: 'house', title: '宫', render: (v) => `${v} 宫` },
								{ key: 'aspectTo', title: '合本命', render: (v) => (v ? <span style={{ fontFamily: 'AstroFont', color: '#c0392b' }}>{sym(v)}</span> : '—') },
							]}
						/>
						<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>年龄点自上升点起，沿 Koch 宫顺行，每宫 6 年、72 年回归上升；落于本命星处（合相）为人生关键节点。</div>
					</div>
				</div>
			</Spin>
		);
	}
}

export default AstroAgePoint;
