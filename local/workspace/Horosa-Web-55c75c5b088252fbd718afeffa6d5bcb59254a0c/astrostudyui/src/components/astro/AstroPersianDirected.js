import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import moment from 'moment';
import AstroDoubleChart from './AstroDoubleChart';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
import { SmallTable, symbolWithMeaning } from './AstroExtraCommon';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import PlusMinusTime from './PlusMinusTime';
import { XQSelect as Select } from '../xq-ui';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
const RATE = { persian: 1.0, prophected: 30.0, naibod: 0.9856473 };
export const RATE_LABEL = { persian: '波斯 1°/年', prophected: 'Prophected 30°/年', naibod: 'Naibod 59′08″/年' };
// AI 挂载「波斯向运」可调项默认（=组件初始 state / 无头默认：波斯速率 + 顺向）。不调任何项 → 输出逐字不变。
const PERSIAN_DEFAULT_OPTS = { rateKey: 'persian', direction: 'direct' };
const MOVERS = [AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN];
const ASPECTS = [0, 60, 90, 120, 180];

function norm360(v){ let n = Number(v) % 360; if(n < 0){ n += 360; } return n; }

function lonOf(obj){
	if(!obj){ return null; }
	if(obj.lon !== undefined && obj.lon !== null){ return Number(obj.lon); }
	const i = AstroConst.LIST_SIGNS.indexOf(obj.sign);
	if(i >= 0 && obj.signlon !== undefined && obj.signlon !== null){ return i * 30 + Number(obj.signlon); }
	return null;
}

function natalParams(chartObj){
	const q = chartObj ? (chartObj.params || {}) : {};
	const params = { ...q };
	if(q.birth){ const parts = q.birth.split(' '); params.date = parts[0]; params.time = parts[1]; }
	return {
		date: params.date, time: params.time, ad: params.ad ? params.ad : 1,
		zone: params.zone, dirZone: params.zone, lon: params.lon, lat: params.lat,
		gpsLat: params.gpsLat, gpsLon: params.gpsLon, hsys: params.hsys,
		zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa, tradition: params.tradition,
	};
}

// 应期 hit-list（纯前端算术）：direct: directed_lon=natalLon+age*rate；converse: -age*rate（反向）。
export function buildPersianHits(chartObj, rateKey, maxAge, direction){
	const chart = (chartObj && chartObj.chart) ? chartObj.chart : {};
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	const rate = RATE[rateKey] || 1.0;
	const cap = maxAge || 90;
	const converse = direction === 'converse';
	const byId = {};
	objects.forEach((o) => { const l = lonOf(o); if(l !== null){ byId[o.id] = l; } });
	const targets = [];
	Object.keys(byId).forEach((id) => targets.push({ id, lon: byId[id] }));
	(Array.isArray(chart.houses) ? chart.houses : []).forEach((h, i) => {
		const l = lonOf(h); if(l !== null){ targets.push({ id: `${i + 1}宫头`, lon: l }); }
	});
	const birth = (chartObj && chartObj.params && chartObj.params.birth)
		? moment(`${chartObj.params.birth}`.replace(/\//g, '-'), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'])
		: null;
	const hits = [];
	MOVERS.forEach((p) => {
		const pl = byId[p];
		if(pl === undefined){ return; }
		targets.forEach((t) => {
			if(t.id === p){ return; }
			ASPECTS.forEach((a) => {
				[1, -1].forEach((s) => {
					if((a === 0 || a === 180) && s === -1){ return; }
					const target = norm360(t.lon + s * a);
					const arc = converse ? norm360(pl - target) : norm360(target - pl);
					const age = arc / rate;
					if(age > 0 && age <= cap){
						const date = (birth && birth.isValid()) ? birth.clone().add(age * 365.2421904, 'days').format('YYYY-MM-DD') : '';
						hits.push({ age: Math.round(age * 100) / 100, promittor: p, aspect: a, significator: t.id, date });
					}
				});
			});
		});
	});
	hits.sort((x, y) => x.age - y.age);
	return hits;
}

// opts（AI 挂载「每技法设置」）：rateKey(波斯/Prophected/Naibod) + direction(direct/converse)。
// 缺省/坏值经 PERSIAN_DEFAULT_OPTS 回退 → 与现状逐字一致(守「默认即现状」)。
export function buildPersianDirectedSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = { ...PERSIAN_DEFAULT_OPTS, ...(opts && typeof opts === 'object' ? opts : {}) };
	const rateKey = RATE[o.rateKey] !== undefined ? o.rateKey : 'persian';
	const direction = o.direction === 'converse' ? 'converse' : 'direct';
	const maxYears = (Number(o.maxYears) > 0 ? Number(o.maxYears) : 90);
	const hits = buildPersianHits(chartObj, rateKey, maxYears, direction);
	if(!hits.length){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const asp = (deg) => (AstroText.AstroTxtMsg['Asp' + deg] || `${deg}°`);
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[波斯向运（Persian Directed）]');
	lines.push('黄经象征向运(1°/年)：所有行星/点每年 +1°,本命宫头不动；下表为向运星触及本命的应期。');
	lines.push('');
	lines.push('| 年龄 | 日期 | 向运星 | 相位 | 本命对象 |');
	lines.push('| --- | --- | --- | --- | --- |');
	hits.slice(0, Math.max(200, maxYears * 4)).forEach((h) => {
		lines.push(`| ${h.age} | ${h.date || '-'} | ${sym(h.promittor)} | ${asp(h.aspect)} | ${sym(h.significator)} |`);
	});
	// 当前向运年龄:组件传入的推运时间优先(与页面「当前推运 X 岁」同口径 directedAgeYears);
	// 无头挂载(opts 无 datetime)按导出时刻距出生推算。无生时 → null,不聚焦(同 UI)。
	const birthStr = (chartObj && chartObj.params) ? chartObj.params.birth : '';
	const dtRaw = o.datetime;
	const dtStr = (dtRaw && dtRaw.format) ? dtRaw.format('YYYY-MM-DD HH:mm:ss') : (dtRaw ? `${dtRaw}` : '');
	let currentAge = dtStr ? directedAgeYears(birthStr, dtStr) : null;
	let ageBasis = `按推运时间 ${dtStr}`;
	if(currentAge === null){
		currentAge = directedAgeYears(birthStr, moment().format('YYYY-MM-DD HH:mm:ss'));
		ageBasis = '按导出时刻';
	}
	// bug 修:UI「邻近应期（距今最近）」表此前未导出 → 复用 selectNearbyPersianHits(同 UI limit 12),
	// 行格式同主表,并入本段尾 ◆ 子块。
	const nearHits = selectNearbyPersianHits(hits, currentAge, 12);
	if(nearHits.length){
		lines.push('');
		lines.push('◆ 近期命中（距今最近）');
		lines.push('| 年龄 | 日期 | 向运星 | 相位 | 本命对象 |');
		lines.push('| --- | --- | --- | --- | --- |');
		nearHits.forEach((h) => {
			lines.push(`| ${h.age} | ${h.date || '-'} | ${sym(h.promittor)} | ${asp(h.aspect)} | ${sym(h.significator)} |`);
		});
	}
	// [YB] 尾部 [当前时点]+[方法说明];定位行=当前向运年龄(directedAgeYears 推出)。
	const extraLines = [];
	if(currentAge !== null && Number.isFinite(currentAge)){
		extraLines.push(`当前向运年龄：${Math.round(currentAge * 100) / 100} 岁（${ageBasis}）`);
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('persiandirected')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

// 当前推运年龄（向运盘时刻相对出生的年数）。与 buildPersianHits 的 hit.age 同单位(年)，
// 黄经象征向运下「推运时间」对应的弹性年龄即 (datetime − birth)，对所有速率/顺逆都成立。
// birthStr/datetimeStr 任一无效返回 null（守「无生时不强标年龄」）。
export function directedAgeYears(birthStr, datetimeStr){
	if(!birthStr || !datetimeStr){ return null; }
	const fmts = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'];
	const b = moment(`${birthStr}`.replace(/\//g, '-'), fmts);
	const d = moment(`${datetimeStr}`.replace(/\//g, '-'), fmts);
	if(!b.isValid() || !d.isValid()){ return null; }
	return d.diff(b, 'days', true) / 365.2421904;
}

// 距当前推运时刻最近的应期：先按 |age−currentAge| 取最近 limit 条，再按 age 重排为时间线，
// 每条加 fromNow=age−currentAge（负=已过、正=将来）。currentAge 非有限数 → []（无生时即不聚焦）。
export function selectNearbyPersianHits(hits, currentAge, limit = 12){
	// 显式挡 null/undefined/''：Number(null)===0 会被误当「年龄 0」→ 无生时仍聚焦(错)。
	if(currentAge === null || currentAge === undefined || currentAge === '' || !Array.isArray(hits) || !hits.length){ return []; }
	const ca = Number(currentAge);
	if(!Number.isFinite(ca)){ return []; }
	const withNow = hits.map((h) => ({ ...h, fromNow: Math.round((h.age - ca) * 100) / 100 }));
	withNow.sort((a, b) => Math.abs(a.age - ca) - Math.abs(b.age - ca));
	const near = withNow.slice(0, limit);
	near.sort((a, b) => a.age - b.age);
	return near;
}

class AstroPersianDirected extends Component{
	constructor(props){
		super(props);
		const np = natalParams(props.value);
		const dt = new DateTime();
		dt.addDate(1);
		this.state = { params: { ...np, datetime: dt, asporb: 1, nodeRetrograde: false, rateKey: 'persian', direction: 'direct', maxYears: 90 }, dirChart: null };
		// 终生应期长表的滚动定位：fullListRef=滚动盒、anchorRowNode=当前向运年龄锚点行、lastScrolledAge=去抖。
		this.fullListRef = null;
		this.anchorRowNode = null;
		this.anchorIdx = -1;
		this.lastScrolledAge = null;
		this.requestDirection = this.requestDirection.bind(this);
		this.changeMaxYears = this.changeMaxYears.bind(this);
		this.requestData = this.requestData.bind(this);
		this.changeRate = this.changeRate.bind(this);
		this.changeDirection = this.changeDirection.bind(this);
		this.handleTimeChanged = this.handleTimeChanged.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.getCurrentAge = this.getCurrentAge.bind(this);
		this.scrollToCurrentAge = this.scrollToCurrentAge.bind(this);
		this.captureAnchorRow = this.captureAnchorRow.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.requestData();
		this.saveSnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 首屏即把终生应期长表定位到当前向运年龄（锚点行在首次 render 已捕获）。
		this.lastScrolledAge = this.getCurrentAge();
		this.scrollToCurrentAge();
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			this.requestData();
			this.saveSnapshot();
		}
		// 推运时间（或换盘）改变当前向运年龄 → 重新定位长表；用 lastScrolledAge 去抖，
		// 不在 dirChart 异步到达等无关重渲染时抢滚（避免打断用户阅读）。
		const age = this.getCurrentAge();
		if(age != null && (this.lastScrolledAge == null || Math.abs(age - this.lastScrolledAge) > 0.001)){
			this.lastScrolledAge = age;
			this.scrollToCurrentAge();
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 当前向运年龄 = (推运时间 − 出生)。供「邻近应期」聚焦与长表定位，二者同口径。
	getCurrentAge(){
		const birthStr = this.props.value && this.props.value.params ? this.props.value.params.birth : '';
		const curDt = this.state.params.datetime;
		const curStr = (curDt && curDt.format) ? curDt.format('YYYY-MM-DD HH:mm:ss') : `${curDt || ''}`;
		return directedAgeYears(birthStr, curStr);
	}

	// render 时按行回传 DOM 节点；只留住「当前向运年龄锚点行」(anchorIdx) 供 scrollToCurrentAge 用。
	// 仅在 node 非空(attach)时记录：忽略内联 ref 每次重渲染的 detach(null) 调用，避免清空锚点。
	captureAnchorRow(node, row, idx){
		if(node && idx === this.anchorIdx){ this.anchorRowNode = node; }
	}

	// 把终生应期长表滚动盒定位到锚点行居中。用 getBoundingClientRect 算盒内偏移，
	// 不依赖 offsetParent（table 行 offsetParent 有跨浏览器差异），稳健。
	scrollToCurrentAge(){
		const box = this.fullListRef;
		const row = this.anchorRowNode;
		if(box && row && row.getBoundingClientRect && box.getBoundingClientRect){
			const offsetWithin = (row.getBoundingClientRect().top - box.getBoundingClientRect().top) + box.scrollTop;
			box.scrollTop = Math.max(0, offsetWithin - (box.clientHeight / 2));
		}
	}

	saveSnapshot(){
		const txt = buildPersianDirectedSnapshotText(this.props.value, this.state.params);
		saveModuleAISnapshot('persiandirected', txt, { tab: 'persiandirected' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'persiandirected'){ return; }
		const txt = this.saveSnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	requestData(){
		// 每次请求都从当前 props.value 重算本命参数(date/time/lat/lon/zone…)。
		// 否则组件构造时绑定的旧盘会把内圈本命冻结成错误日期：换盘后 componentDidUpdate
		// 只重新请求、不重算 natalParams，内圈本命会被后端按旧 date 起盘(实测对不上选择的盘)。
		const np = natalParams(this.props.value);
		const params = { ...this.state.params, ...np };
		params.datetime = params.datetime.format ? params.datetime.format('YYYY-MM-DD HH:mm') : params.datetime;
		if(this.props.value){ this.requestDirection(params); }
	}

	async requestDirection(params){
		try{
			const data = await request(`${Constants.ServerRoot}/predict/persianchart`, { body: JSON.stringify(params) });
			if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
			const result = data[Constants.ResultKey];
			const tm = new DateTime();
			const dt = tm.parse(params.datetime, 'YYYY-MM-DD HH:mm:ss');
			if(params.dirZone){ dt.setZone(params.dirZone); }
			if(!this._mounted) return;
			// horosa_panel_ready_v1:波斯向运盘(中栏盘 + 右栏表同源于 dirChart)落定的那一次 setState。
			this.setState({ dirChart: result, params: { ...params, datetime: dt } }, ()=>{ markPanelReady('direction'); });
		}catch(e){ /* ignore */ }
	}

	changeRate(v){
		const params = { ...this.state.params, rateKey: v };
		this.setState({ params }, () => {
			const p = { ...params, datetime: params.datetime.format ? params.datetime.format('YYYY-MM-DD HH:mm') : params.datetime };
			if(this.props.value){ this.requestDirection(p); }
			// persiandirected 是「简单模块」，AI 导出读已存模块快照 → 改速率须重存，否则导出取旧快照。
			this.saveSnapshot();
		});
	}

	changeDirection(v){
		const params = { ...this.state.params, direction: v };
		this.setState({ params }, () => {
			const p = { ...params, datetime: params.datetime.format ? params.datetime.format('YYYY-MM-DD HH:mm') : params.datetime };
			if(this.props.value){ this.requestDirection(p); }
			this.saveSnapshot();
		});
	}

	// 应期表计算年数(右侧长表不再固定 90 年):仅影响 hits 计算与快照,无需重算左盘。
	// 同步重存模块快照 → AI 导出按所选年数输出（挂载另由 record.maxYears 经 aiAnalysisContext 透传）。
	changeMaxYears(v){
		this.setState({ params: { ...this.state.params, maxYears: v } }, () => { this.saveSnapshot(); });
	}

	handleTimeChanged(val){
		if(!val || !val.time){ return; }
		const next = val.time instanceof DateTime ? val.time : val.time.time;
		if(!next){ return; }
		const params = { ...this.state.params, datetime: next.clone ? next.clone() : next };
		this.setState({ params }, () => {
			const p = { ...params, datetime: params.datetime.format ? params.datetime.format('YYYY-MM-DD HH:mm') : params.datetime };
			if(this.props.value){ this.requestDirection(p); }
		});
	}

	render(){
		const chartObj = { natualChart: this.props.value, dirChart: this.state.dirChart };
		const rateKey = this.state.params.rateKey;
		const direction = this.state.params.direction || 'direct';
		const maxYears = (Number(this.state.params.maxYears) > 0 ? Number(this.state.params.maxYears) : 90);
		const hits = buildPersianHits(this.props.value, rateKey, maxYears, direction);
		let birthDt = null;
		try{
			const b = this.props.value && this.props.value.params ? this.props.value.params.birth : '';
			if(b){ const d = new DateTime(); d.parse(`${b}`, 'YYYY-MM-DD HH:mm:ss'); birthDt = d; }
		}catch(e){ birthDt = null; }
		const curDt = this.state.params.datetime;
		const asp = (deg) => (AstroText.AstroTxtMsg['Asp' + deg] || `${deg}°`);
		// 当前向运年龄 → 「邻近应期」聚焦 + 长表锚点定位（随推运时间重算）。
		const currentAge = this.getCurrentAge();
		const nearbyHits = selectNearbyPersianHits(hits, currentAge, 12);
		// 长表上限 800：应期已被「应期年数」maxYears 约束；persian 速率即便 200 年也不到 800，
		// 故年数对长表「真生效」；仅退化速率(prophected 全挤 12 年内)才触发上限并提示。
		const fullHits = hits.length > 800 ? hits.slice(0, 800) : hits;
		let anchorIdx = -1;
		if(currentAge != null && fullHits.length){
			anchorIdx = fullHits.findIndex((h) => h.age >= currentAge);
			if(anchorIdx < 0){ anchorIdx = fullHits.length - 1; }
		}
		this.anchorIdx = anchorIdx;
		const proRender = (v) => symbolWithMeaning(v, this.props.showAstroMeaning);
		const sigRender = (v) => (AstroConst.LIST_SIGNS.indexOf(v) >= 0 ? v : symbolWithMeaning(v, this.props.showAstroMeaning));
		const fullColumns = [
			{ key: 'age', title: '年龄', render: (v) => v },
			{ key: 'date', title: '日期', render: (v) => v || '-' },
			{ key: 'promittor', title: '向运', render: proRender },
			{ key: 'aspect', title: '相位', render: asp },
			{ key: 'significator', title: '本命', render: sigRender },
		];
		const nearbyColumns = [
			{ key: 'age', title: '年龄', render: (v) => v },
			{ key: 'fromNow', title: '距今', render: (v) => (v > 0 ? `+${v}` : `${v}`) },
			{ key: 'promittor', title: '向运', render: proRender },
			{ key: 'aspect', title: '相位', render: asp },
			{ key: 'significator', title: '本命', render: sigRender },
		];
		// 当前向运年龄 ±1 年内的应期行加中性高亮（非术数语义色，明暗双主题安全）。
		const fullRowStyle = (row) => ((currentAge != null && Math.abs(row.age - currentAge) <= 1) ? { background: 'rgba(251,191,36,.16)' } : undefined);
		const height = this.props.height ? this.props.height : 760;
		const style = { height: (height - 20) + 'px', overflowY: 'auto', overflowX: 'hidden' };
		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroDoubleChart value={chartObj} height={height}
							planetDisplay={this.props.planetDisplay} lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay} showAstroMeaning={this.props.showAstroMeaning} />
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Row gutter={8} style={{ marginBottom: 8 }}>
								<Col span={12}>
									<div style={{ marginBottom: 4 }}>向运速率</div>
									<Select value={rateKey} onChange={this.changeRate} style={{ width: '100%' }}>
										{Object.keys(RATE).map((k) => <Option value={k} key={k}>{RATE_LABEL[k]}</Option>)}
									</Select>
								</Col>
								<Col span={12}>
									<div style={{ marginBottom: 4 }}>向运方向</div>
									<Select value={direction} onChange={this.changeDirection} style={{ width: '100%' }}>
										<Option value="direct">Direct（逆时针）</Option>
										<Option value="converse">Converse（顺时针）</Option>
									</Select>
								</Col>
							</Row>
							<Row gutter={8} style={{ marginBottom: 8 }}>
								<Col span={12}>
									<div style={{ marginBottom: 4 }}>应期年数</div>
									<Select value={maxYears} onChange={this.changeMaxYears} style={{ width: '100%' }}>
										{[50, 90, 120, 150, 200].map((y) => <Option value={y} key={y}>{y} 年</Option>)}
									</Select>
								</Col>
							</Row>
							<div style={{ marginBottom: 8 }}>
								<div style={{ marginBottom: 4 }}>推运时间（驱动左盘）</div>
								<PlusMinusTime
									value={curDt}
									startTime={birthDt || undefined}
									needZone={false}
									showAdjust={true}
									onAfterChanged={this.handleTimeChanged}
									onStepSelect={()=>{ /* R4-B4 错轴止血:本页时间轴=波斯向运时刻,全局选步长
										handler 预取的是 natal /chart(与本轴无关=纯空烧);函数型 prop 屏蔽全局。
										正轴(/predict/persian 族)预取待实测价值后补。 */ }}
								/>
							</div>
							<div style={{ fontSize: 12, color: 'var(--horosa-muted, #666)', marginBottom: 6 }}>
								左侧双盘：内圈本命、外圈向运（宫头固定本命）。调上方时间即推运左盘。
								{currentAge != null ? <span style={{ marginLeft: 6 }}>当前推运 <b>{currentAge.toFixed(1)}</b> 岁。</span> : null}
							</div>
							<Divider orientation="left">邻近应期（距此刻最近）</Divider>
							{nearbyHits.length ? (
								<SmallTable rowKey={(r, i) => `n${i}`} rows={nearbyHits} columns={nearbyColumns} />
							) : (
								<div style={{ fontSize: 12, color: 'var(--horosa-muted, #666)', marginBottom: 6 }}>（调上方「推运时间」即可定位到此刻邻近的向运应期；无生时则不聚焦。）</div>
							)}
							<Divider orientation="left">终生应期（向运 → 本命）</Divider>
							<div ref={(node) => { this.fullListRef = node; }}
								style={{ position: 'relative', maxHeight: 320, overflowY: 'auto', overflowX: 'hidden', border: '1px solid rgba(148,163,184,.18)', borderRadius: 4 }}>
								<SmallTable
									rowKey={(r, i) => i}
									rows={fullHits}
									rowStyle={fullRowStyle}
									rowRef={this.captureAnchorRow}
									columns={fullColumns}
								/>
							</div>
							{hits.length > fullHits.length ? (
								<div style={{ fontSize: 12, color: 'var(--horosa-muted, #666)', marginTop: 4 }}>应期过多，已显示前 {fullHits.length} 条（调小「应期年数」以聚焦）。</div>
							) : null}
						</div>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroPersianDirected;
