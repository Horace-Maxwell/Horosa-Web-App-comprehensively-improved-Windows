import { Component } from 'react';
import { Empty, Spin } from 'antd';
import { XQSelect as Select } from '../xq-ui';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { getLayerSihua } from '../ziwei/ZiWeiHelper';
import { buildDaxianItems, buildLiunianItems, houseName } from '../ziwei/ZWLuckPanel';
import * as ZWConst from '../../constants/ZWConst';

const { Option } = Select;

// 紫微四化做进「三式合一」右栏:为三式起课时间取一张紫微盘,展示 生年 + 大运/流年 四化×落宫。
// 纯展示——复用紫微既有算法(getLayerSihua / ZWLuckPanel builders / ZWColor),不改紫微页、不触 AI 注册表。

function fv(fields, key, fb){
	return (fields && fields[key] && fields[key].value !== undefined && fields[key].value !== null) ? fields[key].value : fb;
}

function buildZiweiParams(fields){
	if(!fields || !fields.date || !fields.date.value || !fields.time || !fields.time.value){
		return null;
	}
	const timeAlg = fv(fields, 'timeAlg', 0);
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fv(fields, 'zone', ''),
		lon: fv(fields, 'lon', ''),
		lat: fv(fields, 'lat', ''),
		gpsLat: fv(fields, 'gpsLat', ''),
		gpsLon: fv(fields, 'gpsLon', ''),
		gender: fv(fields, 'gender', 1),
		timeAlg: timeAlg === 1 ? 1 : 0,
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	};
}

// 生年天干:盘 yearGan 优先,否则取年柱干支首字(天干无繁简问题)。
function pickYearGan(chart){
	if(!chart){ return ''; }
	if(chart.yearGan){ return `${chart.yearGan}`.charAt(0); }
	if(chart.nongli && chart.nongli.yearGanZi){ return `${chart.nongli.yearGanZi}`.charAt(0); }
	return '';
}

// [YA v42] AI 快照取数(供三式合一 buildSanShiUnitedSnapshotText 复用):与本 tab 完全同一套计算
// (pickYearGan/getLayerSihua/buildDaxianItems/buildLiunianItems/houseName),给定盘与当前大运/流年
// 选中下标,产出 生年/大运/流年 四化文本行;无盘或无四化返 [](调用方不产段,零回归)。纯函数,组件行为不变。
export function buildSanShiZiweiSihuaSnapshotLines(chart, daxianIdx, liunianIdx){
	if(!chart){
		return [];
	}
	// 单层四化行文案:与 renderHuaChips 芯片同构(化名+星名+·落宫短名)。
	const fmtRows = (gan)=>{
		const rows = gan ? (getLayerSihua(chart, gan) || []) : [];
		if(!rows.length){
			return '';
		}
		return rows.map((r)=>{
			const palace = r.houseIndex >= 0 ? houseName(chart, r.houseIndex, true) : '—';
			return `${r.hua}${r.star}·${palace}`;
		}).join('；');
	};
	const lines = [];
	const yearGan = pickYearGan(chart);
	const birthText = fmtRows(yearGan);
	if(birthText){
		lines.push(`◆ 生年四化（${yearGan}）：${birthText}`);
	}
	const daxianItems = buildDaxianItems(chart) || [];
	// 下标钳制与 render 同口径(选中项越界回退末项)。
	const dxIdx = Math.min(Math.max(0, daxianIdx || 0), Math.max(0, daxianItems.length - 1));
	const dx = daxianItems.length ? daxianItems[dxIdx] : null;
	if(dx){
		const dxText = fmtRows(dx.gan);
		if(dxText){
			lines.push(`◆ 大运四化（${dx.top}　${dx.ganzi}限）：${dxText}`);
		}
		const liunianItems = buildLiunianItems(chart, dx) || [];
		const lnIdx = Math.min(Math.max(0, liunianIdx || 0), Math.max(0, liunianItems.length - 1));
		const ln = liunianItems.length ? liunianItems[lnIdx] : null;
		if(ln){
			const lnText = fmtRows(ln.gan);
			if(lnText){
				lines.push(`◆ 流年四化（${ln.top}　${ln.ganzi}）：${lnText}`);
			}
		}
	}
	if(lines.length){
		lines.push(`四化随当前紫微流派（${ZWConst.ZWSchool ? ZWConst.ZWSchool.school : 'beipai'}）取表；按起课时间排盘。`);
	}
	return lines;
}

export default class SanShiZiWeiSihua extends Component {
	constructor(props){
		super(props);
		this.state = { chart: null, loading: false, err: '', daxianIdx: 0, liunianIdx: 0 };
		this._reqKey = '';
		this._seq = 0;
	}

	componentDidMount(){ this.maybeFetch(); this.notifySnapshotState(); }
	componentDidUpdate(){ this.maybeFetch(); this.notifySnapshotState(); }
	componentWillUnmount(){ this._seq++; }

	// [YA v42] 把当前盘与大运/流年选中态上报父级(可选 props.onSnapshotState)——供三式合一快照
	// builder 产 [紫微四化] 段。不传该 prop 时 no-op,行为与旧版完全一致;同值去重防冗余回调。
	notifySnapshotState(){
		if(typeof this.props.onSnapshotState !== 'function'){
			return;
		}
		const payload = {
			chart: this.state.chart,
			daxianIdx: this.state.daxianIdx,
			liunianIdx: this.state.liunianIdx,
		};
		const last = this._lastSnapshotState || {};
		if(last.chart === payload.chart && last.daxianIdx === payload.daxianIdx && last.liunianIdx === payload.liunianIdx){
			return;
		}
		this._lastSnapshotState = payload;
		this.props.onSnapshotState(payload);
	}

	maybeFetch(){
		const params = buildZiweiParams(this.props.fields);
		if(!params){ return; }
		const key = JSON.stringify(params);
		if(key === this._reqKey){ return; } // 同时刻只拉一次(签名缓存)
		this._reqKey = key;
		const seq = ++this._seq;
		this.setState({ loading: true, err: '' });
		request(`${Constants.ServerRoot}/ziwei/birth`, { body: JSON.stringify(params), silent: true })
			.then((data)=>{
				if(seq !== this._seq){ return; }
				const result = data && data[Constants.ResultKey];
				const chart = result && result.chart ? result.chart : null;
				this.setState({ chart, loading: false, err: chart ? '' : '紫微盘获取失败', daxianIdx: 0, liunianIdx: 0 });
			})
			.catch(()=>{ if(seq === this._seq){ this.setState({ loading: false, err: '紫微盘获取失败' }); } });
	}

	renderHuaChips(gan){
		const chart = this.state.chart;
		const rows = gan ? (getLayerSihua(chart, gan) || []) : [];
		if(!rows.length){
			return <span style={{ color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 12 }}>—</span>;
		}
		return (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
				{rows.map((r)=>{
					const col = ZWConst.ZWColor[r.hua] || { bg: '#888', color: '#fff' };
					const palace = r.houseIndex >= 0 ? houseName(chart, r.houseIndex, true) : '—';
					return (
						<span
							key={r.hua}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4, background: col.bg, color: col.color, fontSize: 12, lineHeight: '18px' }}
						>
							<b>{r.hua}</b>{r.star}<i style={{ opacity: 0.85, fontStyle: 'normal' }}>·{palace}</i>
						</span>
					);
				})}
			</div>
		);
	}

	renderSection(title, body){
		return (
			<div style={{ marginBottom: 14 }}>
				<div style={{ fontSize: 13, fontWeight: 600, color: 'var(--horosa-text, #d0d3da)', marginBottom: 6 }}>{title}</div>
				{body}
			</div>
		);
	}

	render(){
		const { chart, loading, err } = this.state;
		if(loading){
			return <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>;
		}
		if(!chart){
			return <div style={{ padding: 24 }}><Empty description={err || '请先在左侧起盘'} /></div>;
		}
		const yearGan = pickYearGan(chart);
		const daxianItems = buildDaxianItems(chart) || [];
		const dxIdx = Math.min(this.state.daxianIdx, Math.max(0, daxianItems.length - 1));
		const dx = daxianItems[dxIdx] || null;
		const liunianItems = dx ? (buildLiunianItems(chart, dx) || []) : [];
		const lnIdx = Math.min(this.state.liunianIdx, Math.max(0, liunianItems.length - 1));
		const ln = liunianItems[lnIdx] || null;
		return (
			<div className="horosa-sanshi-ziwei-sihua" style={{ padding: '8px 10px', overflowY: 'auto', height: '100%' }}>
				{this.renderSection(`生年四化（${yearGan || '—'}）`, this.renderHuaChips(yearGan))}
				{this.renderSection('大运四化', (
					<div>
						<Select size="small" value={dxIdx} onChange={(v)=>this.setState({ daxianIdx: v, liunianIdx: 0 })} style={{ width: '100%', marginBottom: 6 }}>
							{daxianItems.map((d, i)=>(<Option key={d.id || i} value={i}>{`${d.top}　${d.ganzi}限`}</Option>))}
						</Select>
						{dx ? this.renderHuaChips(dx.gan) : <span style={{ color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 12 }}>—</span>}
					</div>
				))}
				{this.renderSection('流年四化', (
					<div>
						<Select size="small" value={lnIdx} onChange={(v)=>this.setState({ liunianIdx: v })} style={{ width: '100%', marginBottom: 6 }} disabled={!liunianItems.length}>
							{liunianItems.map((y, i)=>(<Option key={y.id || i} value={i}>{`${y.top}　${y.ganzi}`}</Option>))}
						</Select>
						{ln ? this.renderHuaChips(ln.gan) : <span style={{ color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 12 }}>—</span>}
					</div>
				))}
				<div style={{ fontSize: 11, color: 'var(--horosa-text-soft, #8a8f99)', marginTop: 4, lineHeight: 1.6 }}>
					四化随当前紫微流派（{ZWConst.ZWSchool ? ZWConst.ZWSchool.school : 'beipai'}）取表；按起课时间排盘。
				</div>
			</div>
		);
	}
}
