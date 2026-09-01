// [择日八技法] 结果行「概览」浮窗:交互逐字对齐奇门 QimenMiniBoardPopup(可拖拽/可缩放/
// fixed 视口/不关结果表)。设计定案(2026-08-30):**直接用中间栏的渲染**——手绘缩微卡全废,
// 每技法嵌中栏真组件本体:
//   八字=PaiBaZi(buildLocalBaziResult) | 紫微=ZiWeiChart(calcZiwei+ziweirulesCached)
//   六壬=LiuRengChart(/chart+/liureng/gods 主页同源双响应+castOverride 同源构造)
//   太乙=TaiyiBoardSvg(computeTaiyiScanPan——概览盘=扫描判定同一张盘)
//   三式=SanshiUnitedBoard 三式合一盘本体(与主页中栏同一渲染;数据装配全同源函数)
//   七政=GuoLaoMoiraWheel | 印度=IndiaSouthChart(均 fetchChart,与 pick 主盘同源)
// techOptions=工作台参数透传(贵人体系/月将/局法/日界…):概览口径=扫描口径。
import React, { useEffect, useMemo, useState } from 'react';
import GuoLaoMoiraWheel from '../guolao/GuoLaoMoiraWheel';
import IndiaSouthChart from '../astro/IndiaSouthChart';
// [概览=中栏渲染 2026-08-30 用户三令]:本地技法不再手绘缩微卡,直接嵌**中栏真组件**,
// 数据走主页面同源本地引擎(八字 buildLocalBaziResult / 紫微 calcZiwei 全量),
// 与七政/印度 RemoteChartCard(真组件+fetchChart)同一形制。
import PaiBaZi from '../cntradition/PaiBaZi';
import ZiWeiChart from '../ziwei/ZiWeiChart';
import { buildLocalBaziResult } from '../../utils/baziLunarLocal';
import { calcZiwei } from '../ziwei/ZiweiCalc';
import { ziweirulesCached } from '../../services/rules';
import LiuRengChart from '../lrzhan/LiuRengChart';
import request from '../../utils/request';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { GanZiWuXing } from '../liureng/LRConst';
import { buildLiuRengCastOverride } from '../lrzhan/LiuRengMain';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import { fetchChart } from '../../services/astro';
import TaiyiBoardSvg from '../taiyi/TaiyiBoardSvg';
import { computeTaiyiScanPan } from '../../divination/zeri/taiyiZeriScanEngine';
import { splitSanshiOptions } from '../../divination/zeri/sanshiOptionSplit';
import SanshiUnitedBoard from '../sanshi/SanshiUnitedBoard';
import {
	buildLiuRengLayout as sanshiBuildLrLayout, buildKeData as sanshiBuildKeData, buildSanChuan as sanshiBuildSanChuan,
	buildSanshiLiuRengCastOverride, buildLrNongli, extractIsDiurnalFromChartWrap, QIMEN_OPTIONS as SANSHI_QIMEN_OPTIONS,
} from '../sanshi/SanShiUnitedMain';
import { fetchQimenPan, normalizeKinqimenData, calcDunJia, isKinqimenMode } from '../dunjia/DunJiaCalc';



// ── 远端真盘(七政 Moira 轮/印度南印盘):该时刻 fetchChart,与 pick 主盘同源 ──
function RemoteChartCard({ tech, row, geo }){
	const [chartObj, setChartObj] = useState(null);
	const [err, setErr] = useState('');
	const t = `${(row && (row.pick || row.start)) || ''}`;
	useEffect(()=>{
		let dead = false;
		setChartObj(null);
		setErr('');
		const m = /^(-?\d{1,5}-\d{2}-\d{2})[ ](\d{2}:\d{2})/.exec(t);
		if(!m){ setErr('时刻无效'); return undefined; }
		const g = geo || {};
		fetchChart({
			date: m[1].replace(/-/g, '/'), time: `${m[2]}:00`, ad: 1,
			zone: g.zone !== undefined ? g.zone : '+08:00',
			lon: g.lon, lat: g.lat, gpsLon: g.gpsLon, gpsLat: g.gpsLat,
			pos: g.pos || '', gender: 1, name: '概览', cid: null,
		}, { cache: true }).then((rsp)=>{
			const chart = (rsp && rsp.Result) ? rsp.Result : rsp;
			if(!dead){ setChartObj(chart); }
		}).catch((e)=>{ if(!dead){ setErr((e && e.message) || '排盘失败'); } });
		return ()=>{ dead = true; };
	}, [t]);
	if(err){ return <div style={{ color: '#e5484d', fontSize: 12, padding: 16 }}>{err}</div>; }
	if(!chartObj){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘中…</div>; }
	if(tech === 'qizheng'){
		return (
			<div style={{ position: 'absolute', inset: 0 }}>
				<GuoLaoMoiraWheel rootValue={chartObj} value={chartObj.chart} height={640} />
			</div>
		);
	}
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 8 }}>
			<IndiaSouthChart value={chartObj} chartnum={1} height={560} planetDisplay={AstroConst.DEFAULT_OBJECTS} lotsDisplay={[]} />
		</div>
	);
}

// ── 真组件卡:八字(中栏 PaiBaZi 同源同渲染) ──
function timePartsOfRow(row){
	const text = `${(row && (row.pick || row.start)) || ''}`;
	const m = /^(-?\d{1,5}-\d{2}-\d{2})[ ](\d{2}:\d{2})/.exec(text);
	return m ? { date: m[1], time: `${m[2]}:00` } : null;
}
function BaziRealCard({ row, geo }){
	const tp = timePartsOfRow(row);
	const rec = useMemo(()=>{
		if(!tp){ return null; }
		try{
			const r = buildLocalBaziResult({
				...(geo || {}),
				date: tp.date, time: tp.time,
				gender: 1, timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1,
			});
			return r && r.bazi ? r.bazi : null;
		}catch(e){ return null; }
	}, [tp && tp.date, tp && tp.time]);
	if(!rec){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘失败</div>; }
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
			<PaiBaZi value={rec} fields={{}} height="auto" showStyleSwitch={false} />
		</div>
	);
}

// ── 真组件卡:紫微(中栏 ZiWeiChart;数据=主页本地引擎 calcZiwei 全量,与本地双路同源) ──
function ZiweiRealCard({ row, geo }){
	const tp = timePartsOfRow(row);
	const chart = useMemo(()=>{
		if(!tp){ return null; }
		try{
			return calcZiwei({
				date: tp.date, time: tp.time,
				zone: (geo && geo.zone) || '+08:00',
				lon: geo && (geo.lon !== undefined ? geo.lon : geo.gpsLon),
				lat: geo && (geo.lat !== undefined ? geo.lat : geo.gpsLat),
				gpsLon: geo && geo.gpsLon, gpsLat: geo && geo.gpsLat,
				ad: 1, gender: 1,
			}, { timeAlg: 1, lateZi: 'zi_chu' });
		}catch(e){ return null; }
	}, [tp && tp.date, tp && tp.time]);
	// rules(格局判语库)= ZWHouse 硬依赖(缺 → drawSihuaTitle 读 RuleHouses 直接崩,真机红屏实抓);
	// 与主页同源:ziweirulesCached 会话缓存,启动已 prime,通常零 RTT。
	const [rules, setRules] = useState(null);
	useEffect(()=>{
		let dead = false;
		ziweirulesCached({}).then((rsp)=>{
			if(!dead){ setRules((rsp && rsp.Result) ? rsp.Result : null); }
		}).catch(()=>{ if(!dead){ setRules(null); } });
		return ()=>{ dead = true; };
	}, []);
	if(!chart){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘失败</div>; }
	if(!rules){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘中…</div>; }
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
			<ZiWeiChart value={chart} height="100%" fields={{}} rules={rules} />
		</div>
	);
}

// ── 真组件卡:太乙(中栏 TaiyiBoardSvg;盘=computeTaiyiScanPan——与扫描判定恰同一张盘,零网络) ──
function TaiyiRealCard({ row, geo, techOptions }){
	const tp = timePartsOfRow(row);
	const pan = useMemo(()=>{
		if(!tp){ return null; }
		try{
			return computeTaiyiScanPan(geo || {}, techOptions || {}, tp.date, tp.time);
		}catch(e){
			return null;
		}
	}, [tp && tp.date, tp && tp.time, geo, techOptions]);
	if(!pan){ return <div style={{ color: '#e5484d', fontSize: 12, padding: 16 }}>排盘失败</div>; }
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
			<TaiyiBoardSvg pan={pan} showBoardMark selectedPalace={null} onSelectPalace={null} />
		</div>
	);
}

// ── 真组件卡:六壬(中栏 LiuRengChart;数据=主页同源两响应:/chart + /liureng/gods) ──
// 数据逻辑独立成 hook:六壬卡与三式卡六壬段共用同一条取数路(勿手抄第二份)。
function useLiurengRealData(tp, geo, opt){
	const [data, setData] = useState(null);
	const [err, setErr] = useState('');
	useEffect(()=>{
		let dead = false;
		setData(null); setErr('');
		if(!tp){ setErr('时刻无效'); return undefined; }
		const g = geo || {};
		const base = {
			date: tp.date.replace(/-/g, '/'), time: tp.time, ad: 1,
			zone: g.zone !== undefined ? g.zone : '+08:00',
			lon: g.lon, lat: g.lat, gpsLon: g.gpsLon, gpsLat: g.gpsLat,
			pos: g.pos || '', gender: 1, name: '概览', cid: null,
		};
		Promise.all([
			fetchChart(base, { cache: true }),
			request(`${Constants.ServerRoot}/liureng/gods`, {
				// 参数集与 aiAnalysisContext 的 gods 调用完全同形(缺 after23NewDay/lateZiHourUseNextDay
				// 的裸集曾被后端拒——真机 500 no.register.app 实抓)
				body: JSON.stringify({
					ad: 1, date: tp.date, time: tp.time.slice(0, 5), zone: base.zone,
					lon: g.lon, lat: g.lat, gpsLon: g.gpsLon, gpsLat: g.gpsLat,
					after23NewDay: opt.after23NewDay !== undefined ? opt.after23NewDay : defaultAfter23NewDay(),
					lateZiHourUseNextDay: opt.lateZiHourUseNextDay !== undefined ? opt.lateZiHourUseNextDay : defaultLateZiHourUseNextDay(),
				}),
				silent: true,
				timeoutMs: 45000,
			}),
		]).then(([crsp, grsp])=>{
			if(dead){ return; }
			// LiuRengChart 的 value 消费面 = Result.chart 层(主页 4898 行同口径;传 Result 整包
			// → objects 不是数组 → RengChart 静默空盘,真机 fiber 实抓)
			const r0 = (crsp && crsp.Result) ? crsp.Result : crsp;
			const chart = r0 && r0.chart ? r0.chart : r0;
			// /liureng/gods 的消费面 = Result.liureng 子对象(主页 state.liureng = result.liureng 同口径;
			// 传整包 → RengChart 读 .length 直接 draw failed,真机实抓)
			const g0 = (grsp && grsp.Result) ? grsp.Result : grsp;
			const gods = g0 && typeof g0 === 'object' && g0.liureng ? g0.liureng : null;
			if(!gods){ setErr('六壬神将计算失败'); return; }
			setData({ chart, gods });
		}).catch((e)=>{ if(!dead){ setErr((e && e.message) || '排盘失败'); } });
		return ()=>{ dead = true; };
	}, [tp && tp.date, tp && tp.time, opt.after23NewDay, opt.lateZiHourUseNextDay]);
	return { data, err };
}

// 主页同源 props 组装:贵人体系/长生五行(日干实算)/月将换法+阴阳系(castOverride)——缺 guireng 曾致
// GuiRengs[undefined].day 中途炸、盘只剩标题行(真机实抓)
function liurengChartProps(data, opt){
	const guirengType = opt.guirengType !== undefined ? Number(opt.guirengType) : 0;
	const dayGan = data.gods && data.gods.nongli && data.gods.nongli.dayGanZi ? `${data.gods.nongli.dayGanZi}`.charAt(0) : '';
	const wuxing = GanZiWuXing[dayGan] || '土';
	const castOverride = buildLiuRengCastOverride(data.chart, {
		yueJiangMethod: opt.yueMode || 'zhongqi',
		yinyangSystem: opt.yinyangSystem || 'danmu',
	});
	return { guireng: guirengType, zhangshengElem: wuxing, castOverride };
}

function LiurengRealCard({ row, geo, techOptions }){
	const tp = timePartsOfRow(row);
	const opt = techOptions || {};
	const { data, err } = useLiurengRealData(tp, geo, opt);
	if(err){ return <div style={{ color: '#e5484d', fontSize: 12, padding: 16 }}>{err}</div>; }
	if(!data){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘中…</div>; }
	const lp = liurengChartProps(data, opt);
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
			<LiuRengChart value={data.chart} liureng={data.gods} height={620} fields={{}} gender={-1} chartType={1}
				guireng={lp.guireng} zhangshengElem={lp.zhangshengElem} castOverride={lp.castOverride} panStyleName="" />
		</div>
	);
}

// ── 真组件卡:三式(中栏「三式合一盘」本体 SanshiUnitedBoard——概览显示合一盘而非三张独立盘;
//    数据装配全同源函数:fetchChart + fetchQimenPan/calcDunJia+normalizeKinqimenData(与主页 getKinqimenDunJia
//    同路由判据)+ buildLiuRengLayout/buildKeData/buildSanChuan/buildSanshiLiuRengCastOverride,零平行实现) ──
function SanshiRealCard({ row, geo, techOptions }){
	const tp = timePartsOfRow(row);
	const merged = techOptions || {};
	const split = useMemo(()=>splitSanshiOptions(merged), [techOptions]);
	const [data, setData] = useState(null);
	const [err, setErr] = useState('');
	useEffect(()=>{
		let dead = false;
		setData(null); setErr('');
		if(!tp){ setErr('时刻无效'); return undefined; }
		const g = geo || {};
		const zone = g.zone !== undefined ? g.zone : '+08:00';
		fetchChart({
			date: tp.date.replace(/-/g, '/'), time: tp.time, ad: 1, zone,
			lon: g.lon, lat: g.lat, gpsLon: g.gpsLon, gpsLat: g.gpsLat,
			pos: g.pos || '', gender: 1, name: '概览', cid: null,
			after23NewDay: split.qimen.after23NewDay !== undefined ? split.qimen.after23NewDay : 1,
			lateZiHourUseNextDay: split.qimen.lateZiHourUseNextDay !== undefined ? split.qimen.lateZiHourUseNextDay : 1,
		}, { cache: true }).then(async (crsp)=>{
			const chartWrap = (crsp && crsp.Result) ? crsp.Result : crsp;
			const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
			if(!astroChart){ throw new Error('排盘失败'); }
			const nongli = astroChart.nongli || null;
			// fields shim:fetchQimenPan/parseDateTime 只吃 format()/zone(taiyiZeriScanEngine 同款)
			const fields = {
				date: { value: { format: (f)=>(f === 'YYYY' ? tp.date.slice(0, tp.date.indexOf('-')) : tp.date), zone } },
				time: { value: { format: ()=>tp.time } },
			};
			const qimenOptions = { ...SANSHI_QIMEN_OPTIONS, ...split.qimen, sex: '男' };
			const year = parseInt(tp.date, 10);
			const isDiurnal = extractIsDiurnalFromChartWrap(chartWrap);
			// 与主页 getKinqimenDunJia 同一路由判据:本地家/飞盘/混合/报数=本地 calcDunJia;其余=后端+normalize
			const localOnly = !isKinqimenMode(qimenOptions.paiPanType) || qimenOptions.school === '飞盘'
				|| qimenOptions.school === '混合' || qimenOptions.qijuMethod === 'shuzi';
			let localPan = null;
			try{
				localPan = calcDunJia(fields, nongli, qimenOptions, { year, isDiurnal });
			}catch(e2){ localPan = null; }
			let dunjia = localPan;
			if(!localOnly){
				try{
					const backendPan = await fetchQimenPan(fields, nongli, qimenOptions, { year, isDiurnal });
					const norm = normalizeKinqimenData(backendPan, localPan, qimenOptions, nongli);
					if(norm && norm.source === 'kinqimen'){ dunjia = norm; }
				}catch(e3){ /* 后端失败回落本地盘 */ }
			}
			if(!dunjia){ throw new Error('奇门排盘失败'); }
			// 六壬三件套(主页 3515 行同源装配)
			const lrNongli = buildLrNongli(nongli, dunjia);
			const chartForLr = { ...astroChart, nongli: lrNongli };
			const lrCastOverride = buildSanshiLiuRengCastOverride({ ...astroChart, nongli }, merged);
			const guirengType = split.liureng.guirengType !== undefined ? Number(split.liureng.guirengType) : 0;
			const lrLayout = sanshiBuildLrLayout(chartForLr, guirengType, lrCastOverride);
			const keData = sanshiBuildKeData(lrLayout, chartForLr);
			const sanChuan = sanshiBuildSanChuan(lrLayout, keData.raw, chartForLr, lrCastOverride);
			const nianMing = (lrNongli && lrNongli.runyear) || ((dunjia.ganzhi && dunjia.ganzhi.year) ? dunjia.ganzhi.year.substring(1, 2) : '');
			const liureng = {
				nongli: lrNongli, nianMing,
				yue: lrLayout ? lrLayout.yue : '', timezi: lrLayout ? lrLayout.timezi : '', guizi: lrLayout ? lrLayout.guizi : '',
				fourColumns: {
					year: dunjia.ganzhi ? (dunjia.ganzhi.year || '') : '', month: dunjia.ganzhi ? (dunjia.ganzhi.month || '') : '',
					day: dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '', time: dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '',
				},
			};
			if(!dead){ setData({ chartWrap, dunjia, lrLayout, keData, sanChuan, nongli, liureng, fields }); }
		}).catch((e)=>{ if(!dead){ setErr((e && e.message) || '排盘失败'); } });
		return ()=>{ dead = true; };
	}, [tp && tp.date, tp && tp.time]);
	if(err){ return <div style={{ color: '#e5484d', fontSize: 12, padding: 16 }}>{err}</div>; }
	if(!data){ return <div style={{ opacity: 0.6, fontSize: 12, padding: 16 }}>排盘中…</div>; }
	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 8 }}>
			<SanshiUnitedBoard
				fitContent
				boardSize={640}
				chartWrap={data.chartWrap}
				dunjia={data.dunjia}
				lrLayout={data.lrLayout}
				keData={data.keData}
				sanChuan={data.sanChuan}
				nongli={data.nongli}
				liureng={data.liureng}
				fields={data.fields}
				displaySolarTime={null}
				outerCoord={merged.outerCoord || 'ecliptic'}
				showWeakSolid
				showAstroMeaning={false}
			/>
		</div>
	);
}

const REAL_CARD_BY_TECH = {
	bazi: BaziRealCard,
	ziwei: ZiweiRealCard,
	liureng: LiurengRealCard,
	taiyi: TaiyiRealCard,
	sanshi: SanshiRealCard,
};

export default function ZeriMiniPanPopup({ tech, row, computePan, geo, onClose, subtitle, techOptions }){
	const isRemote = tech === 'qizheng' || tech === 'india';
	// 默认尺寸=完整容盘零裁剪(2026-08-30 定案):三式一体化盘 stack≈770(表头+640盘+底条)
	// +体 padding16+题头 34 → 需 ~830;其余技法沿用旧默认(已真机验完整)。夹屏高防超窗。
	const [box, setBox] = useState(()=>{
		const dflt = tech === 'sanshi' ? { w: 720, h: 972 } : { w: isRemote ? 720 : 700, h: isRemote ? 700 : 680 };	// 972=真机量值:fitContent 后 stack 918+padding16+题头34+边框——盘+底条两行完整零滚动
		const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 900;
		const h = Math.min(dflt.h, vh - 44);
		return { x: 90, y: Math.max(12, Math.min(36, vh - h - 24)), w: dflt.w, h };
	});
	const pan = useMemo(()=>{
		if(!computePan){ return null; }
		try{
			const text = `${row && row.pick ? row.pick : (row && row.start) || ''}`;
			const m = /^(-?\d{1,5}-\d{2}-\d{2})[ ](\d{2}:\d{2})/.exec(text);
			if(!m){ return null; }
			return computePan(m[1], `${m[2]}:00`);
		}catch(e){
			return null;
		}
	}, [row && row.pick, row && row.start]);
	const dragFrom = (e, mode)=>{
		e.preventDefault();
		e.stopPropagation();
		const start = { mx: e.clientX, my: e.clientY, ...box };
		const move = (ev)=>{
			const dx = ev.clientX - start.mx;
			const dy = ev.clientY - start.my;
			if(mode === 'drag'){
				setBox((b)=>({ ...b, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) }));
			}else{
				setBox((b)=>({ ...b, w: Math.max(380, start.w + dx), h: Math.max(320, start.h + dy) }));
			}
		};
		const up = ()=>{
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	};
	const RealCard = REAL_CARD_BY_TECH[tech] || null;
	return (
		<div style={{
			position: 'fixed', left: box.x, top: box.y, width: box.w, height: box.h,
			zIndex: 2100, background: 'var(--horosa-astro-panel, #fff)', borderRadius: 10,
			border: '1px solid rgba(148,163,184,.45)', boxShadow: '0 12px 40px rgba(0,0,0,.28)',
			display: 'flex', flexDirection: 'column', overflow: 'hidden',
		}}>
			<div onMouseDown={(e)=>dragFrom(e, 'drag')}
				style={{ cursor: 'move', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(148,163,184,.25)', userSelect: 'none' }}>
				<span style={{ fontWeight: 600, fontSize: 13 }}>概览 · {row ? (row.pick || row.start) : ''}{row && row.pick && row.pick !== row.start ? <span style={{ opacity: 0.6, fontWeight: 400 }}>(时段 {row.start} 起)</span> : null}</span>
				<span style={{ fontSize: 11, opacity: 0.55 }}>{subtitle || (isRemote ? '该时刻盘(与主盘同源)' : '速览(与扫描同源)')}</span>
				<span style={{ flex: 1 }} />
				<span onMouseDown={(e)=>e.stopPropagation()} onClick={onClose}
					style={{ cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.65, padding: '0 4px' }}>×</span>
			</div>
			<div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: (isRemote || RealCard) ? 0 : 12, position: 'relative' }}>
				{isRemote ? <RemoteChartCard tech={tech} row={row} geo={geo} />
					: (RealCard ? <RealCard row={row} geo={geo} techOptions={techOptions} pan={pan} />
						: <div style={{ opacity: 0.6, fontSize: 12 }}>—</div>)}
			</div>
			<div onMouseDown={(e)=>dragFrom(e, 'resize')}
				style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize',
					background: 'linear-gradient(135deg, transparent 50%, rgba(148,163,184,.6) 50%)' }} />
		</div>
	);
}
