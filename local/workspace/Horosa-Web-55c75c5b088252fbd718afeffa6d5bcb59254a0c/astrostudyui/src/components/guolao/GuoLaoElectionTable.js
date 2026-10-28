import React, { useState, useRef } from 'react';
import { InputNumber, message } from 'antd';
import { XQSelect as Select, XQButton as Button } from '../xq-ui';
import { MOIRA_PLANET_DEFS } from './GuoLaoMoiraWheel';
import { mountainPosition, applyDeclination, quickWheelAz } from './electionCore';
import { fetchQizhengEclipses, fetchQizhengAzimuthSearch } from '../../services/qizheng';

const { Option } = Select;

// 择日双列表(对照 Moira 右下行星表「日: 13未月23 | 08辛山21+」):
// 静盘列=黄道宫内度(取流年 chartObj 同源);动盘列=山分度+高度号;殿旺喜庙取 moiraRules。
const SIGN_CN = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];

// 星曜→五行→色(与盘面同源五行观念;择日表用于星曜字符着色)。取明暗成对的主题色:
// 旧的单套写死色只为暗底挑(日 #e0a340 在宣纸底 2.0:1、金 2.0:1、月 2.4:1)。
const PLANET_ELEMENT = { 日: '日', 月: '月', 金: '金', 木: '木', 水: '水', 火: '火', 土: '土', 罗: '火', 计: '土', 炁: '木', 孛: '水' };
const ELEMENT_COLOR = { 日: 'var(--horosa-planet-sun)', 月: 'var(--horosa-planet-moon)', 木: 'var(--horosa-bazi-wood)', 火: 'var(--horosa-bazi-fire)', 土: 'var(--horosa-bazi-earth)', 金: 'var(--horosa-bazi-metal)', 水: 'var(--horosa-bazi-water)' };
function glyphColor(label){ return ELEMENT_COLOR[PLANET_ELEMENT[label]] || 'var(--horosa-astro-gold, #e7bd75)'; }
// 庙旺殿喜=good(得地) / 失垣落陷=weak(失力) / 平·顺=plain(平和)。先判失力再判得力(「失垣」含「垣」防误命中)。
function dignityTone(text){
	const t = `${text || ''}`;
	if(/失垣|落陷|陷|落|弱|难/.test(t)){ return 'weak'; }
	if(/入垣|升殿|庙|旺|得地|喜/.test(t)){ return 'good'; }
	return 'plain';
}
// 黄道星座序 0=白羊 → 地支镜像(白羊=戌…与盘面 DIGNITY 同源)
function eclToBranchText(lon){
	const v = ((Number(lon) % 360) + 360) % 360;
	const sign = Math.floor(v / 30);
	const inDeg = v - sign * 30;
	const deg = Math.floor(inDeg);
	const minute = Math.floor((inDeg - deg) * 60);
	return `${String(deg).padStart(2, '0')}${SIGN_CN[sign]}${String(minute).padStart(2, '0')}`;
}

export function GuoLaoElectionTable({ electionData, transitChartObj, moiraRules, election, declination }){
	const data = electionData || {};
	const planets = Array.isArray(data.planets) ? data.planets : [];
	if(!planets.length){
		return <div className="horosa-guolao-moira-empty">择日双轮数据载入后显示(需本地计算服务)。</div>;
	}
	const ele = election || {};
	const quick = ele.dynMode === 'quick';
	const cusps = quick && data.housesBySystem ? (data.housesBySystem[ele.hsys] || data.housesBySystem.A) : null;
	const dignityById = {};
	((moiraRules && moiraRules.planets) || []).forEach((row)=>{ if(row && row.id != null){ dignityById[row.id] = row.dignity; } });
	const chartObjects = (transitChartObj && transitChartObj.chart && transitChartObj.chart.objects) || [];
	const labelToAstroId = {};
	MOIRA_PLANET_DEFS.forEach((def)=>{ labelToAstroId[def.label] = def.id; });
	return (
		<div className="horosa-guolao-election">
			<div className="horosa-guolao-election-table">
				<div className="horosa-guolao-election-row horosa-guolao-election-head">
					<span>星</span><span>黄道静盘</span><span>动盘</span><span>态</span>
				</div>
				{planets.map((pl)=>{
					const dynAzRaw = quick ? quickWheelAz(pl.lonTropical, cusps || []) : pl.azimuth;
					const dynAz = applyDeclination(dynAzRaw, ele.ziZheng === 'magnetic' ? 'magnetic' : 'true', Number(declination) || 0);
					const mp = mountainPosition(dynAz, ele.plate || 'di');
					const aboveHorizon = Number(pl.altitudeTrue) >= 0;
					const astroId = labelToAstroId[pl.label];
					const chartObj = chartObjects.find((o)=>o && o.id === astroId);
					const staticLon = chartObj && Number.isFinite(Number(chartObj.lon)) ? Number(chartObj.lon) : pl.lonTropical;
					const dignity = astroId !== undefined ? dignityById[astroId] : null;
					return (
						<div className="horosa-guolao-election-row" key={`ele-${pl.id}`}>
							<span className="horosa-guolao-election-glyph" style={{ color: glyphColor(pl.label) }}>{pl.label}</span>
							<span className="horosa-guolao-election-deg">{eclToBranchText(staticLon)}</span>
							<span className="horosa-guolao-election-deg">
								{mp.text}
								<i className={`horosa-guolao-election-alt ${aboveHorizon ? 'is-up' : 'is-down'}`} title={aboveHorizon ? '地平以上' : '地平以下'}>{aboveHorizon ? '+' : '−'}</i>
							</span>
							<span className="horosa-guolao-election-state">
								{dignity ? <em className={`horosa-guolao-election-tag tone-${dignityTone(dignity)}`}>{dignity}</em> : null}
								{pl.retrograde ? <em className="horosa-guolao-election-tag tone-retro">逆</em> : null}
								{!dignity && !pl.retrograde ? <em className="horosa-guolao-election-tag tone-plain">平</em> : null}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// 搜索三件套(对照 Moira 搜索菜单):方位搜索 / 日食 / 月食。结果行可一键设为择日时刻。
export function GuoLaoElectionSearch({ fields, transitParams, onPickMoment }){
	const [body, setBody] = useState('日');
	const [targetAz, setTargetAz] = useState(0);
	const [days, setDays] = useState(3);
	const [busy, setBusy] = useState(false);
	const [rows, setRows] = useState([]);
	const [title, setTitle] = useState('');
	const tp = transitParams || {};
	// 方位搜索与日月食搜索共用一张结果表:只认最后点的那一次,先点的晚回不许盖掉后点的
	const runSeq = useRef(0);
	const runAzimuth = async ()=>{
		if(!tp.date){ message.info('请先起盘'); return; }
		const seq = ++runSeq.current;
		setBusy(true);
		try{
			const res = await fetchQizhengAzimuthSearch({
				date: tp.date, time: tp.time || '00:00:00', zone: tp.zone || '8:00',
				gpsLat: tp.gpsLat, gpsLon: tp.gpsLon,
				body, targetAz: Number(targetAz) || 0, days: Number(days) || 3,
			});
			if(seq !== runSeq.current){ return; }
			setRows(Array.isArray(res) ? res : []);
			setTitle(`${body} 到达 ${Number(targetAz).toFixed(1)}°(未来 ${days} 天)`);
		}catch(e){
			if(seq === runSeq.current){ message.warning('方位搜索失败(需本地计算服务)'); }
		}finally{
			if(seq === runSeq.current){ setBusy(false); }
		}
	};
	const runEclipse = async (kind)=>{
		if(!tp.date){ message.info('请先起盘'); return; }
		const seq = ++runSeq.current;
		setBusy(true);
		try{
			const res = await fetchQizhengEclipses({ date: tp.date, zone: tp.zone || '8:00', kind, count: 8 });
			if(seq !== runSeq.current){ return; }
			setRows(Array.isArray(res) ? res : []);
			setTitle(kind === 'solar' ? '未来日食' : '未来月食');
		}catch(e){
			if(seq === runSeq.current){ message.warning('日月食搜索失败(需本地计算服务)'); }
		}finally{
			if(seq === runSeq.current){ setBusy(false); }
		}
	};
	const isEclipse = rows.length > 0 && rows[0] && rows[0].azimuth === undefined;
	return (
		<div className="horosa-guolao-election-search">
			<div className="horosa-guolao-search-bar">
				<div className="horosa-guolao-search-field">
					<label>星曜</label>
					<Select value={body} onChange={setBody} size="small" dropdownMatchSelectWidth={false} style={{width: 62}}>
						{MOIRA_PLANET_DEFS.slice(0, 7).map((d)=>(<Option key={d.label} value={d.label}>{d.label}</Option>))}
					</Select>
				</div>
				<div className="horosa-guolao-search-field">
					<label>目标方位°</label>
					<InputNumber size="small" min={0} max={359.9} value={targetAz} onChange={(v)=>setTargetAz(v || 0)} style={{width: 88}} />
				</div>
				<div className="horosa-guolao-search-field">
					<label>未来天数</label>
					<InputNumber size="small" min={1} max={30} value={days} onChange={(v)=>setDays(v || 3)} style={{width: 68}} />
				</div>
				<div className="horosa-guolao-search-actions">
					<Button size="small" type="primary" loading={busy} onClick={runAzimuth}>方位搜索</Button>
					<Button size="small" loading={busy} onClick={()=>runEclipse('solar')}>日食</Button>
					<Button size="small" loading={busy} onClick={()=>runEclipse('lunar')}>月食</Button>
				</div>
			</div>
			{title ? <div className="horosa-guolao-search-title">{title}</div> : null}
			<div className="horosa-guolao-search-results">
				{rows.map((row, idx)=>(
					<div className="horosa-guolao-search-row" key={`s-${idx}`}>
						<span className="horosa-guolao-search-date">{row.date}</span>
						<span className="horosa-guolao-search-time">{row.time}</span>
						<span className="horosa-guolao-search-az">{row.azimuth !== undefined ? `${Number(row.azimuth).toFixed(1)}°` : (isEclipse ? '食' : '')}</span>
						<button type="button" className="horosa-guolao-search-pick" onClick={()=>{ if(onPickMoment){ onPickMoment(row); } }}>设为择时</button>
					</div>
				))}
				{!rows.length && !busy ? (
					<div className="horosa-guolao-search-empty">
						<span className="horosa-guolao-search-empty-icon">✦</span>
						<span>选星与目标方位后「方位搜索」,或直接查未来日/月食。</span>
						<span className="horosa-guolao-search-empty-sub">结果可一键设为择日时刻。</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
