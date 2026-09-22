import React from 'react';
// components/astro/AstroDispositor.js
// 主宰星链（dispositor chains）+ 宫主两表。纯前端派生，嵌于本命「古典」tab。
// [#79] 宫主派生走 utils/wholeSignRulers 单源(与 AI 快照 [主宰星链]/[分宫制宫神星表] 同一组函数,本组件不再自带查表):
//   上表 = 整宫制宫主表(宫主/主宰口径:自上升星座起算,与行星「nR」宫主标记同源);
//   下表 = 当前分宫制宫神星表(行星力量/实际落宫口径,非主宰依据);上升整宫制盘两表相同 → 下表折叠为一行说明。
import { Component } from 'react';
import { astroSymbol, cardStyle, SmallTable } from './AstroExtraCommon';
import { SIGNS } from '../../divination/data/signs';
import { computeDispositors, chartIdOfKey } from '../../utils/dispositorChain';
import { buildWholeSignRulerRows, buildHouseSystemRulerRows, resolveHouseSystem } from '../../utils/wholeSignRulers';
import * as AstroText from '../../constants/AstroText';

const sn = (s) => { const k = s ? String(s).toLowerCase() : ''; return (SIGNS[k] && SIGNS[k].cn) || s || '-'; };
const symKey = (k) => astroSymbol(chartIdOfKey(k) || k);
const TRAD = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
// 宫制标签:后端 echo 'Whole Sign' 之类走 AstroMsg 译('整宫制');已是中文/英文名则原样。
const hsysLabel = (label) => { if(!label) return ''; const t = AstroText.AstroMsg[label]; return (t && !/^[A-Za-z0-9${}]$/.test(t)) ? t : label; };
const subTitle = { fontSize: 12, fontWeight: 600, marginBottom: 4 };
const subNote = { fontSize: 11, opacity: 0.75, marginBottom: 4 };
const hint = { fontSize: 12, opacity: 0.8, padding: '4px 0' };
const rulerCols = (signTitle, houseTitle) => ([
	{ key: 'house', title: '宫', render: (v) => `${v}宫` },
	{ key: 'sign', title: signTitle, render: (v) => sn(v) },
	{ key: 'ruler', title: '宫主', render: (v) => (v ? symKey(v) : '-') },
	{ key: 'rulerHouseNum', title: houseTitle, render: (v, r) => (r.rulerFound && v ? `${v}宫` : '-') },
	{ key: 'rulerSign', title: '宫主落座', render: (_v, r) => (r.rulerFound && r.rulerSign ? sn(r.rulerSign) : '-') },
]);

class AstroDispositor extends Component {
	render(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart) return null;
		// 主宰链/终极主宰/互容环 —— 复用共享 computeDispositors（与格局速览/格局 tab 同源）。
		const { chains, finals, loops: uniqLoops } = computeDispositors(chartObj.chart.objects);
		const wsRows = buildWholeSignRulerRows(chartObj);
		const hsRows = buildHouseSystemRulerRows(chartObj);
		const hs = resolveHouseSystem(chartObj, this.props.fields);
		const label = hsysLabel(hs.label);
		const collapsed = hs.isAscWholeSign && wsRows.length > 0;
		return (
			<div style={cardStyle}>
				<div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>主宰星链 与 宫主两表</div>
				<div style={{ fontSize: 12, lineHeight: 2 }}>
					{TRAD.filter((k) => chains[k] && chains[k].length).map((k) => (
						<div key={k}>{chains[k].map((x, i) => <span key={i}>{i > 0 ? <span style={{ margin: '0 4px' }}>→</span> : null}{symKey(x)}</span>)}</div>
					))}
				</div>
				<div style={{ fontSize: 12, marginTop: 8 }}>最终主宰：{finals.size ? [...finals].map((k, i) => <span key={i} style={{ marginRight: 6 }}>{symKey(k)}</span>) : '无（全部成环）'}</div>
				{uniqLoops.length ? <div style={{ fontSize: 12, marginTop: 4 }}>互容环：{uniqLoops.map((c, i) => <span key={i} style={{ marginRight: 10 }}>{c.map((x, j) => <span key={j}>{j > 0 ? ' ↔ ' : ''}{symKey(x)}</span>)}</span>)}</div> : null}
				<div style={{ marginTop: 10 }}>
					<div style={subTitle}>整宫制宫主表(wholeSignRulers)</div>
					<div style={subNote}>宫主 / 主宰口径：自上升星座起算，与行星标签「nR」宫主标记同源。</div>
					{wsRows.length
						? <SmallTable rowKey={(r) => r.house} rows={wsRows} columns={rulerCols('整宫星座', '宫主落宫(整宫)')} />
						: <div style={hint}>无法定出上升星座，整宫制宫主表暂缺。</div>}
				</div>
				<div style={{ marginTop: 10 }}>
					<div style={subTitle}>当前分宫制{label ? `(${label})` : ''}宫神星表(houseRows)</div>
					<div style={subNote}>行星力量 / 角续果 / 实际落宫口径，不是主宰依据。</div>
					{collapsed
						? <div style={hint}>当前分宫制即整宫制：与上表逐行相同，不再重复列出。</div>
						: (hsRows.length
							? <SmallTable rowKey={(r) => r.house} rows={hsRows} columns={rulerCols('宫头座', '宫主落宫')} />
							: <div style={hint}>本盘无宫头数据。</div>)}
				</div>
			</div>
		);
	}
}

export default AstroDispositor;
