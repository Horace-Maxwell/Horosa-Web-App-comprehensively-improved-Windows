import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { CHART_DETAIL_SETTINGS, CHART_DETAIL_SETTINGS_EVENT, buildChartDetailsText, chartDetailRequestFields } from '../../utils/chartDetails';
import { buildClassicalAnalysisSection } from '../../utils/astroAiSnapshot';
import { fixedStarOrbParamsFor, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import { MODULE_SNAPSHOT_PREPARE_EVENT } from '../../utils/moduleSnapshotRefresh';
import { getStore } from '../../utils/storageutil';
import AstroChart from '../astro/AstroChart';
import AstroInfo from '../astro/AstroInfo';
import AstroAspect from '../astro/AstroAspect';
import AstroPlanet from '../astro/AstroPlanet';
import AstroLots from '../astro/AstroLots';
import AstroPredictPlanetSign from '../astro/AstroPredictPlanetSign';
import AstroAnalysisLab from '../astro/AstroAnalysisLab';
import GeoCoordModal from '../amap/GeoCoordModal';
import { XQTabs } from '../xq-ui';
import XQIcon from '../xq-icons';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import {
	convertLatToStr, convertLonToStr, convertLatStrToDegree, convertLonStrToDegree,
	formatLatDms, formatLonDms,
} from '../astro/AstroHelper';
import { unwrapResult, astroSymbol, signName, fmtNum, fmtDegree, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from '../astro/AstroExtraCommon';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = XQTabs.TabPane;

// 重置盘(异地 relocation):保留出生瞬间(date/time/zone 不变),仅以新经纬重算十二宫与四角(上升/中天)。
// 行星黄经由 UT 决定 → 与本命完全一致;宫位/角点随地点而变。默认地点 = 出生地(此时盘与本命盘逐字相同,零回归)。
// 选点直接复用成熟的「经纬度查找」地图选择器(GeoCoordModal):城市快搜 + 地图选点 + 手输经纬,仅取回经纬度。
// 右栏沿用标准星盘信息面板(信息/相位/行星/古典/可能性/格局),与十三/十二分盘等设计语言统一。
const ANGLE_IDS = [AstroConst.ASC, AstroConst.MC, AstroConst.DESC, AstroConst.IC];

function anglesOf(chartShaped){
	const objs = (chartShaped && chartShaped.chart && chartShaped.chart.objects) || [];
	const map = {};
	objs.forEach((o)=>{
		if(o && ANGLE_IDS.indexOf(o.id) >= 0){
			map[o.id] = o;
		}
	});
	return map;
}

function natalLatLonDecimal(chartObj){
	const params = chartParams(chartObj);
	return {
		lat: convertLatStrToDegree(params.lat),
		lon: convertLonStrToDegree(params.lon),
	};
}

// 「可能性」(星落星座的断语):重置只换地点、出生 UT 不变 → 各星所落星座与本命相同,断语就是本命那份。
// 后端重置盘不跑推断(predictive=false),此前页面「可能性」页签恒空、导出 / 挂载也没有这一段;借本命的星座断语补上
// (只借 PlanetSign,与宫位 / 地点有关的推断一概不借)。结果与本命同一命主才进来(shownResult / load 都按命主认领)。
function withNatalPlanetSign(relocChart, natal){
	if(!relocChart || typeof relocChart !== 'object'){ return relocChart; }
	const own = relocChart.predict && relocChart.predict.PlanetSign;
	const natalSigns = natal && natal.predict && natal.predict.PlanetSign;
	if(own || !natalSigns){ return relocChart; }
	return { ...relocChart, predict: { ...(relocChart.predict || {}), PlanetSign: natalSigns } };
}

// 古典格局请求体:与导出 / 挂载取古典格局同口径(缓存代次盐、恒星轨随盘 → 全局仓、空亡古典开关)
function relocClassicalBody(params){
	const body = { _v: 'cls1', ...params, ...fixedStarOrbParamsFor(params) };
	try{
		const app = (getStore() || {}).app;
		if(app && (app.voidClassical === 1 || app.voidClassical === '1' || app.voidClassical === true)){ body.voidClassical = true; }
	}catch(e){ /* 读不到按缺省 */ }
	return body;
}

class AstroRelocationLab extends Component{
	constructor(props){
		super(props);
		const init = natalLatLonDecimal(props.value);
		this.state = {
			relocLat: Number.isFinite(init.lat) ? Number(init.lat.toFixed(4)) : 0,
			relocLon: Number.isFinite(init.lon) ? Number(init.lon.toFixed(4)) : 0,
			isNatalPlace: true,
			loading: false,
			result: null,
			requestKey: '',
			// 右栏子页签改【受控】—— FreezeSubTab 需要 activeKey 才能判 active(原 defaultActiveKey="1")。
			sideTab: '1',
		};
		this.load = this.load.bind(this);
		this.handleGeoOk = this.handleGeoOk.bind(this);
		this.renderContentPanel = this.renderContentPanel.bind(this);
		this.handleSnapshotPrepareRequest = this.handleSnapshotPrepareRequest.bind(this);
		this.handleExtrasSettingsChanged = this.handleExtrasSettingsChanged.bind(this);
		this.changeSideTab = this.changeSideTab.bind(this);
	}

	changeSideTab(key){
		this.setState({ sideTab: key });
	}

	componentDidMount(){
		this._mounted = true;
		if(typeof window !== 'undefined'){
			window.addEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, this.handleSnapshotPrepareRequest);
			window.addEventListener(CHART_DETAIL_SETTINGS_EVENT, this.handleExtrasSettingsChanged);
			window.addEventListener(CLASSICAL_GLOBALS_EVENT, this.handleExtrasSettingsChanged);
		}
		this.load();
	}

	componentDidUpdate(prevProps){
		// 🔴 换命例时重置地点必须跟随新盘出生地:曾只在构造期初始化 →
		// 停在本页换人后仍用上一位的出生地当落点,标签却写「出生地(未重置)」。
		if(prevProps.value !== this.props.value && this.state.isNatalPlace){
			const init = natalLatLonDecimal(this.props.value);
			if(Number.isFinite(init.lat) && Number.isFinite(init.lon)){
				this.setState({
					relocLat: Number(init.lat.toFixed(4)),
					relocLon: Number(init.lon.toFixed(4)),
				});
			}
		}
		// 空亡古典义等宿主口径改了(经 props 进来):快照里的「古典格局」随之重取
		if(prevProps.voidClassical !== this.props.voidClassical){
			this.handleExtrasSettingsChanged();
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._extrasTimer);
		if(typeof window !== 'undefined'){
			window.removeEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, this.handleSnapshotPrepareRequest);
			window.removeEventListener(CHART_DETAIL_SETTINGS_EVENT, this.handleExtrasSettingsChanged);
			window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this.handleExtrasSettingsChanged);
		}
	}

	relocKey(){
		// 单源缓存键:chartRequestKey 已含 黄道/岁差/ad/orbs/古典口径全维
		// (曾手拼 6 字段 → 切恒星黄道/界系后 key 不变、重置盘不重取,与全 App 分叉)。
		return chartRequestKey(this.props.value, `reloc|${this.state.relocLat}|${this.state.relocLon}`);
	}

	ensureLoaded(){
		const key = this.relocKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			setTimeout(this.load, 0);
		}
	}

	handleGeoOk(rec){
		if(!rec){
			return;
		}
		const lat = Number(rec.gpsLat);
		const lon = Number(rec.gpsLng);
		if(!Number.isFinite(lat) || !Number.isFinite(lon)){
			return;
		}
		this.setState({
			relocLat: Number(lat.toFixed(4)),
			relocLon: Number(lon.toFixed(4)),
			isNatalPlace: false,
		}, this.load);
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){
			return;
		}
		const key = this.relocKey();
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/relocation`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					relocLat: convertLatToStr(this.state.relocLat),
					relocLon: convertLonToStr(this.state.relocLon),
				}),
				timeoutMs: 30000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			const res = unwrapResult(data) || {};
			clearLoadFailure(this);
			// horosa_panel_ready_v1:重置盘中栏(异地整盘)+右栏(信息/相位/行星…六页签)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(与其余 10 个辅盘子盘同一技法键)。
			this.setState({result: res, resultSig, loading: false, requestKey: key}, ()=>{
				markPanelReady('auxchart');
			});
			// 出盘即存(整张重置盘 + [重置盘] 专属段):这一刻起导出 / 挂载 / 存案读到的就是这张盘,不留上一张;
			// 按重置地点算的 [盘面细节] / [古典格局] 已按同一口径取过就一并写入,否则取回后补写(导出前会等它)。
			const relocParams = this.relocParams();
			const known = this.knownRelocExtras(relocParams);
			this.saveRelocSnapshot(res, known);
			if(known){ return; }
			const extras = await this.fetchRelocExtras(relocParams);
			if(!this._mounted || seq !== this._loadSeq) return;
			this.saveRelocSnapshot(res, extras);
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq) return;
			parkLoadFailure(this, key);   // 失败不记成已完成:窗口期后同一张盘自动重试
			this.setState({loading: false});
		}
	}

	// 重置后的起盘参数:出生时刻不变,只换经纬(宫位、地平高度、世俗位置、角宫 / 地平上下都随地点变)
	relocParams(){
		return { ...chartParams(this.props.value), lat: convertLatToStr(this.state.relocLat), lon: convertLonToStr(this.state.relocLon) };
	}

	// [盘面细节] / [古典格局] 两个请求体 = 口径签名:重置地点、盘面细节各项、恒星轨、空亡古典义任一项变了就得重取
	relocExtrasBodies(relocParams){
		const detailsBody = { ...relocParams, ...chartDetailRequestFields(CHART_DETAIL_SETTINGS.load()) };
		const classicalBody = relocClassicalBody(relocParams);
		return { detailsBody, classicalBody, key: JSON.stringify([detailsBody, classicalBody]) };
	}

	// 当前口径下已取到的两段;没取过 / 口径变了 → null
	knownRelocExtras(relocParams){
		const { key } = this.relocExtrasBodies(relocParams);
		return this._extras && this._extras.key === key && this._extras.value ? this._extras.value : null;
	}

	// 两个请求并发,同一口径只取一次(在途的复用);取不到只少那一段,两段都没取到不记账(下回再取)
	fetchRelocExtras(relocParams){
		const { detailsBody, classicalBody, key } = this.relocExtrasBodies(relocParams);
		if(this._extras && this._extras.key === key){
			return this._extras.value ? Promise.resolve(this._extras.value) : this._extras.promise;
		}
		const promise = Promise.all([
			request(`${Constants.ServerRoot}/astroextra/chartdetails`, { body: JSON.stringify(detailsBody), silent: true, timeoutMs: 20000 })
				.then((det)=>buildChartDetailsText(det && det.Result ? det.Result : det) || '').catch(()=>''),
			request(`${Constants.ServerRoot}/astroextra/analysis`, { body: JSON.stringify(classicalBody), silent: true, timeoutMs: 20000 })
				.then((an)=>buildClassicalAnalysisSection(an && an.Result ? an.Result : an) || '').catch(()=>''),
		]).then(([detailsText, classicalText])=>{
			const value = { detailsText, classicalText };
			// 只记最近一次口径的回包(口径在途又变了 = 这份已过时,不记)
			if(this._extrasKey === key && this._extras){
				if(detailsText || classicalText){ this._extras.value = value; }else{ this._extras = null; this._extrasKey = ''; }
			}
			return value;
		});
		this._extras = { key, promise, value: null };
		this._extrasKey = key;
		return promise;
	}

	// 页面上这张重置盘(出自当前命主、且就是当前地点那一张);没有 → null
	currentRelocResult(){
		const res = this.shownResult();
		return res && res.chart && this.state.requestKey === this.relocKey() ? res : null;
	}

	// 口径变了(盘面细节各项 / 恒星轨 / 空亡古典义):按新口径重取两段并重存快照,挂载与导出都不留旧口径
	handleExtrasSettingsChanged(){
		clearTimeout(this._extrasTimer);
		this._extrasTimer = setTimeout(()=>{ if(this._mounted){ this.refreshRelocExtras(); } }, 0);
	}

	refreshRelocExtras(){
		const res = this.currentRelocResult();
		if(!res){ return null; }
		const relocParams = this.relocParams();
		const known = this.knownRelocExtras(relocParams);
		if(known){
			this.saveRelocSnapshot(res, known);
			return null;
		}
		return this.fetchRelocExtras(relocParams).then((extras)=>{
			if(this._mounted && this.currentRelocResult() === res){ this.saveRelocSnapshot(res, extras); }
		});
	}

	// 导出前补算:正文要的两段按此刻口径取齐(导出侧最多等 30 秒)
	handleSnapshotPrepareRequest(evt){
		const detail = evt && evt.detail;
		if(!detail || detail.module !== 'relocation' || !Array.isArray(detail.pending)){ return; }
		const pending = this.refreshRelocExtras();
		if(pending){ detail.pending.push(pending); }
	}

	saveRelocSnapshot(res, extras){
		const { detailsText = '', classicalText = '' } = extras || {};
		saveDerivedAstroSnapshot('relocation', this.relocChartFor(res.chart), this.props.fields, ()=>{
			const out = ['[重置盘]'];
			out.push(`重置地点：纬 ${this.state.relocLat} / 经 ${this.state.relocLon}`);
			try{
				const natal = anglesOf(this.props.value);
				const reloc = anglesOf(res.chart);
				ANGLE_IDS.forEach((id)=>{
					const n = natal && natal[id]; const r = reloc && reloc[id];
					if(n || r){ out.push(`${id}：本命 ${n ? `${n.sign || ''}${n.signlon != null ? Number(n.signlon).toFixed(2) + '°' : ''}` : '—'} → 重置后 ${r ? `${r.sign || ''}${r.signlon != null ? Number(r.signlon).toFixed(2) + '°' : ''}` : '—'}`); }
				});
			}catch(e){ /* 角点缺省不产行 */ }
			const lines = out.length > 1 ? out : [];
			return [[lines.join('\n'), detailsText, classicalText].filter(Boolean).join('\n\n')];   // 段间空一行(行数组会滤掉空行)
		});
	}

	// 补上本命星座断语的重置盘:同一张回包 × 同一份本命断语只拼一次(盘面组件按引用判重画,每次渲染新拼一份 = 每次整盘重画)
	relocChartFor(chart){
		const natalSigns = this.props.value && this.props.value.predict ? this.props.value.predict.PlanetSign : undefined;
		const memo = this._signMemo;
		if(memo && memo.chart === chart && memo.natalSigns === natalSigns){ return memo.out; }
		const out = withNatalPlanetSign(chart, this.props.value);
		this._signMemo = { chart, natalSigns, out };
		return out;
	}

	renderAngleCompare(relocChart){
		const natal = anglesOf(this.props.value);
		const reloc = anglesOf(relocChart);
		const rows = ANGLE_IDS.map((id)=>({ id, natal: natal[id], reloc: reloc[id] })).filter((r)=>r.natal || r.reloc);
		return (
			<SmallTable
				rows={rows}
				columns={[
					{key: 'id', title: '角点', render: (v)=>astroSymbol(v)},
					{key: 'natal', title: '本命', render: (v)=>v ? fmtDegree(v) : '-'},
					{key: 'reloc', title: '重置后', render: (v)=>v ? fmtDegree(v) : '-'},
				]}
			/>
		);
	}

	renderHouses(relocChart){
		const houses = (relocChart && relocChart.chart && relocChart.chart.houses) || [];
		const sorted = houses.slice().sort((a, b)=>{
			const na = parseInt(`${a.id}`.replace(/[^0-9]/g, ''), 10) || 0;
			const nb = parseInt(`${b.id}`.replace(/[^0-9]/g, ''), 10) || 0;
			return na - nb;
		});
		return (
			<SmallTable
				rows={sorted}
				columns={[
					{key: 'id', title: '宫', render: (v)=>`${(`${v}`.replace(/[^0-9]/g, '')) || v}宫`},
					{key: 'sign', title: '落座', render: (v)=>signName(v)},
					{key: 'signlon', title: '宫头度', render: (_v, row)=>`${fmtNum(row.signlon !== undefined ? row.signlon : (Number(row.lon) % 30), 2)}°`},
				]}
			/>
		);
	}

	// 右栏标准信息面板:与 AstroChartMain.renderContentPanel 逐节一致(信息/相位/行星/古典/可能性/格局)。
	renderContentPanel(chartObj, fields, tabHeight){
		return (
			<div className="horosa-inspector-panel horosa-astro-content-panel">
				{/* horosa_freeze_subtabs_v1(PERF-R9 Ship 6 复核补齐):右栏六组面板此前全内联,
				    每次父重渲(改地点 / 改时间 / 主盘换)都把六个都 reconcile 一遍(AstroInfo 两份 +
				    相位表 + 行星/希腊点 + 可能性 + 格局)。受控化(activeKey→state.sideTab)后包 FreezeSubTab:
				    只渲当前组;切走冻结不卸载(滚动位置/展开态全留);切回拿最新 chartObj 立即重渲。 */}
				<XQTabs activeKey={this.state.sideTab} onChange={this.changeSideTab} tabPosition='top' className="horosa-inspector-tabs horosa-content-tabs">
					<TabPane tab="信息" key="1">
						<FreezeSubTab active={this.state.sideTab === '1'}>{()=>(
						<AstroInfo mode="summary" height={tabHeight}
							value={chartObj} fields={fields}
							planetDisplay={this.props.planetDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
						/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="相位" key="2">
						<FreezeSubTab active={this.state.sideTab === '2'}>{()=>(
						<AstroAspect
							value={chartObj} height={tabHeight}
							lotsDisplay={this.props.lotsDisplay}
							planetDisplay={this.props.planetDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
						/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="行星" key="3">
						<FreezeSubTab active={this.state.sideTab === '3'}>{()=>(
						<div className="horosa-planet-with-lots" style={{ height: tabHeight }}>
							<AstroPlanet
								value={chartObj}
								fill={true}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							<div className="horosa-lots-under-planets">
								<div className="horosa-info-card-title">希腊点</div>
								<AstroLots value={chartObj} fill={true} showAstroMeaning={this.props.showAstroMeaning}/>
							</div>
						</div>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="古典" key="4">
						<FreezeSubTab active={this.state.sideTab === '4'}>{()=>(
						<div style={{ height: tabHeight, overflowY: 'auto', overflowX: 'hidden' }}>
							<AstroInfo mode="classical" height={tabHeight}
								value={chartObj} fields={fields}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
							/>
						</div>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="可能性" key="5">
						<FreezeSubTab active={this.state.sideTab === '5'}>{()=>(
						<AstroPredictPlanetSign height={tabHeight}
							value={chartObj} fields={fields}
							planetDisplay={this.props.planetDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
						/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="格局" key="6">
						<FreezeSubTab active={this.state.sideTab === '6'}>{()=>(
						<AstroAnalysisLab
							value={chartObj}
							height={tabHeight}
							voidClassical={this.props.voidClassical}   /* 宿主链补传(格局页空亡古典义 / 仅本垣擢升互容) */
						/>
						)}</FreezeSubTab>
					</TabPane>
				</XQTabs>
			</div>
		);
	}

	renderInputPanel(relocChart){
		const natalDate = this.props.fields && this.props.fields.date ? this.props.fields.date.value : undefined;
		const latStr = convertLatToStr(this.state.relocLat);
		const lonStr = convertLonToStr(this.state.relocLon);
		const placeStrong = this.state.isNatalPlace ? '出生地(未重置)' : '重置地点';
		return (
			<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-reloc-input-panel">
				<div className="horosa-panel-head">
					<div>
						<div className="horosa-panel-kicker">重置盘 · Relocation</div>
						<div className="horosa-panel-title">异地重置</div>
					</div>
				</div>
				<div className="horosa-field-block">
					<div className="horosa-field-label">重置地点</div>
					<GeoCoordModal
						onOk={this.handleGeoOk}
						lat={this.state.relocLat} lng={this.state.relocLon}
						date={natalDate}
					>
						<button type="button" className="horosa-unified-field horosa-place-field">
							<XQIcon name="locastro" />
							<span>
								<strong>{placeStrong}</strong>
								<small>{formatLatDms(this.state.relocLat)} · {formatLonDms(this.state.relocLon)}</small>
							</span>
							<XQIcon name="globe" />
						</button>
					</GeoCoordModal>
					<div className="horosa-field-hint">{lonStr} / {latStr} · 点击地图选择</div>
				</div>
				<div className="horosa-reloc-note">
					行星黄经由出生瞬间决定,异地不变;仅十二宫与四角(上升/中天)随地点重算。
				</div>
				<div style={{...cardStyle, width: '100%'}}>
					<div className="horosa-info-card-title">四角对比(本命 → 重置)</div>
					{this.renderAngleCompare(relocChart)}
				</div>
				<div style={{...cardStyle, width: '100%'}}>
					<div className="horosa-info-card-title">重置宫位</div>
					{this.renderHouses(relocChart)}
				</div>
			</div>
		);
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const result = this.shownResult() || {};
		const relocChart = this.relocChartFor(result.chart || null);
		const fields = this.props.fields;
		const height = this.props.height ? this.props.height : 760;
		const tabHeight = Math.max(height - 60, 520);

		return (
			<div className="horosa-astro-page horosa-astro-redesign horosa-astro-no-bottom-dock horosa-reloc-page xq-chart-renderer xq-chart-renderer-hellen">
				<div className="horosa-astro-layout horosa-astro-redesign-layout">
					<div className="horosa-astro-redesign-grid">
						{this.renderInputPanel(relocChart)}
						<div className="horosa-chart-stage horosa-chart-stage-redesign">
							{relocChart ? (
								<AstroChart
									value={relocChart}
									chartDisplay={this.props.chartDisplay}
									chartStyle={this.props.chartStyle}
									wheelArt={this.props.wheelArt}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									showAstroMeaning={this.props.showAstroMeaning}
									height="100%"
								/>
							) : (
								<div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--horosa-text-soft, #999)', fontSize: 13}}>
									{this.state.loading ? '重置盘计算中…' : '请在左侧选择重置地点'}
								</div>
							)}
						</div>
						{this.renderContentPanel(relocChart, fields, tabHeight)}
					</div>
				</div>
			</div>
		);
	}
}

export default AstroRelocationLab;
