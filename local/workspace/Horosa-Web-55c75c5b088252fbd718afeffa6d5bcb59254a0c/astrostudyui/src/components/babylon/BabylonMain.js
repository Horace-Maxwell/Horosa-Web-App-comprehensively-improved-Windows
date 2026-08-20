// components/babylon/BabylonMain.js —— 巴比伦占星容器:文类子 Tab(轴1)+ 派系设置(轴2)。
// 数据基座:一次 /chart(恒星黄道·毕宿锚)请求供各产品共用(LRU + inflight 去重 + 240ms prefetch)。
import { Component } from 'react';
import { XQTabs as Tabs, XQSelect } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import {
	babylonChartParams, chartToLons, babylonBirthJdn, buildBabylonSnapshotText,
	fetchBabylonEphemeris, digestBabylonEphemeris, computeNaKur,
} from '../../utils/babylonAiSnapshot';
import { PRODUCTS, SCHEME_ORDER, BABYLON_SCHEMES, schemeOf, judgeOpts, BABYLON_PARAM_SPEC } from '../../divination/babylon/babylonSchools';
import { buildHoroscope } from '../../divination/babylon/horoscope';
import BabylonHoroscope from './BabylonHoroscope';
import BabylonEphemeris from './BabylonEphemeris';
import BabylonMulApin from './BabylonMulApin';
import BabylonMicrozodiac from './BabylonMicrozodiac';
import BabylonMelothesia from './BabylonMelothesia';
import BabylonEae from './BabylonEae';
import BabylonAlmanac from './BabylonAlmanac';
import BabylonHemerology from './BabylonHemerology';
import './babylon.less';

const TabPane = Tabs.TabPane;

const CACHE_MAX = 32;
const mem = new Map();
const inflight = new Map();
function cacheKey(params){ try{ return JSON.stringify(params); }catch(e){ return ''; } }
async function fetchSiderealChart(params){
	const key = cacheKey(params);
	if(key && mem.has(key)){ return mem.get(key); }
	if(key && inflight.has(key)){ return inflight.get(key); }
	const req = request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify(params), silent: true })
		.then((data) => {
			const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			if(key && result){
				if(mem.has(key)){ mem.delete(key); }
				mem.set(key, result);
				if(mem.size > CACHE_MAX){ const f = mem.keys().next().value; if(f){ mem.delete(f); } }
			}
			return result;
		})
		.finally(() => { if(key){ inflight.delete(key); } });
	if(key){ inflight.set(key, req); }
	return req;
}

class BabylonMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			currentTab: 'horoscope',
			schemeId: 'swissA10',
			overrides: {},
			chartObj: null,
		};
		this.unmounted = false;
		this.reqSeq = 0;
		this.prefetchTimer = null;
		this.changeTab = this.changeTab.bind(this);
		this.changeScheme = this.changeScheme.bind(this);
		this.changeOverride = this.changeOverride.bind(this);
		this.refresh = this.refresh.bind(this);
		if(this.props.hook){
			this.props.hook.fun = () => { this.refresh(); };
		}
	}

	componentDidMount(){
		this.unmounted = false;
		this.refresh();
	}
	componentWillUnmount(){
		this.unmounted = true;
		if(this.prefetchTimer){ clearTimeout(this.prefetchTimer); this.prefetchTimer = null; }
	}
	componentDidUpdate(prevProps){
		if(prevProps.fields !== this.props.fields){
			if(this.prefetchTimer){ clearTimeout(this.prefetchTimer); }
			this.prefetchTimer = setTimeout(() => {
				if(!this.unmounted){ this.refresh(); }
			}, 240);
		}
	}

	async refresh(){
		const params = babylonChartParams(this.props.fields);
		if(!params){ return; }
		const seq = ++this.reqSeq;
		const jdn = babylonBirthJdn(this.props.fields);
		// 星盘与实算历象(朔望/邻近食)并行;历象失败→null(图式行照常,零阻塞)
		const [result, ephem] = await Promise.all([
			fetchSiderealChart(params).catch(() => null),
			fetchBabylonEphemeris(this.props.fields, jdn).catch(() => null),
		]);
		if(this.unmounted || seq !== this.reqSeq){ return; }
		let ephemDigest = digestBabylonEphemeris(ephem, jdn);
		this.setState({ chartObj: result, ephemDigest });
		// NA/KUR 观测量(满月日/残月晨的日月升落)二段轻请求;回填不阻塞首屏。
		// [issue#74 同类] 回填落地后必须补拍快照:旧实现只 setState,而下方快照在本同步块
		// 已用「无 na/kur 的裸 digest」产出并冻结(本文件无 refresh-event 监听,导出直吃缓存)
		// → 页面显示 NA/KUR 而 AI 挂载恒缺两子句。补拍与 render 同构,回包即自愈。
		if(ephemDigest){
			computeNaKur(this.props.fields, ephemDigest).then((full) => {
				if(!this.unmounted && seq === this.reqSeq){
					this.setState({ ephemDigest: full }, () => this.saveBabylonSnapshot(result, params, jdn, full));
				}
				return full;
			}).catch(() => null);
		}
		this.saveBabylonSnapshot(result, params, jdn, ephemDigest);
	}

	// 页面侧存模块 AI 快照(AI 导出当前页/挂载候选;meta=生辰签名防串盘)。
	// 抽成方法供两处调用:首拍(裸 digest,即时可用)+ NA/KUR 回填补拍(终值)。
	saveBabylonSnapshot(result, params, jdn, ephemDigest){
		try{
			const lons = chartToLons(result);
			if(jdn && lons.sun !== undefined){
				const bab = buildHoroscope(lons, jdn, this.effectiveOpts());
				const sc = schemeOf(this.state.schemeId);
				const text = buildBabylonSnapshotText(bab, { ...this.effectiveOpts(), schemeCn: sc.cn, ephemDigest });
				if(text){
					saveModuleAISnapshot('babylon', text, {
						date: params.date, time: params.time, zone: params.zone,
						lon: params.lon, lat: params.lat,
					});
				}
			}
		}catch(e){ /* 快照失败不阻塞盘面 */ }
	}

	changeTab(key){ this.setState({ currentTab: key }); }
	changeScheme(id){ this.setState({ schemeId: id, overrides: {} }); }
	changeOverride(key, value){
		this.setState({ overrides: { ...this.state.overrides, [key]: value } });
	}

	// 当前有效派系参数(scheme 默认 ∪ 用户覆盖)
	effectiveOpts(){
		const sc = schemeOf(this.state.schemeId);
		return {
			...judgeOpts(this.state.schemeId, this.state.overrides),
			ephemerisSource: this.state.overrides.ephemerisSource || sc.backend.ephemerisSource,
			solstice: this.state.overrides.solstice || sc.backend.solstice,
		};
	}

	// 派系面板(右栏顶部紧凑卡;派系=下拉单选,参数竖排)
	renderSchemePanel(tab){
		const opts = this.effectiveOpts();
		const specVisible = BABYLON_PARAM_SPEC.filter((p) => p.appliesTo.indexOf(tab) >= 0 && p.key !== 'ephemerisSource');
		return (
			<div className="horosa-babylon-card horosa-babylon-scheme-card">
				<div className="horosa-babylon-card-title">派系</div>
				<XQSelect
					size="small"
					style={{ width: '100%' }}
					value={this.state.schemeId}
					options={SCHEME_ORDER.map((id) => ({ value: id, label: BABYLON_SCHEMES[id].cn }))}
					onChange={(v) => this.changeScheme(v)}
				/>
				{specVisible.map((p) => (
					<div key={p.key} className="horosa-babylon-scheme-row">
						<span className="lbl">{p.label}</span>
						<XQSelect
							size="small"
							style={{ flex: 1, minWidth: 0 }}
							value={opts[p.key]}
							options={p.options}
							onChange={(v) => this.changeOverride(p.key, v)}
						/>
					</div>
				))}
				<div className="horosa-babylon-caveat" style={{ marginTop: 6 }}>{schemeOf(this.state.schemeId).desc}</div>
			</div>
		);
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const childHeight = Math.max(360, height - 44);
		const opts = this.effectiveOpts();
		const lons = chartToLons(this.state.chartObj);
		const jdn = babylonBirthJdn(this.props.fields);
		const bab = (jdn && lons.sun !== undefined)
			? buildHoroscope(lons, jdn, opts)
			: (jdn ? buildHoroscope({}, jdn, opts) : null);
		const common = { height: childHeight, bab, lons, opts, fields: this.props.fields, ephemDigest: this.state.ephemDigest };

		return (
			<div className="horosa-aux-module-page xq-chart-renderer xq-chart-renderer-babylon">
				<Tabs activeKey={this.state.currentTab} onChange={this.changeTab} className="horosa-content-tabs horosa-babylon-subtabs">
					{PRODUCTS.map((p) => (
						<TabPane tab={p.cn} key={p.key}>
							{this.state.currentTab === p.key ? (
								<div style={{ height: childHeight, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
									{null /* 派系面板已移入各产品右栏顶部(schemePanel) */}
									{p.key === 'horoscope' ? <BabylonHoroscope {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'ephemeris' ? <BabylonEphemeris {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'mulapin' ? <BabylonMulApin {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'microzodiac' ? <BabylonMicrozodiac {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'melothesia' ? <BabylonMelothesia {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'eae' ? <BabylonEae {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'almanac' ? <BabylonAlmanac {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
									{p.key === 'hemerology' ? <BabylonHemerology {...common} schemePanel={this.renderSchemePanel(p.key)} /> : null}
								</div>
							) : null}
						</TabPane>
					))}
				</Tabs>
			</div>
		);
	}
}

export default BabylonMain;
