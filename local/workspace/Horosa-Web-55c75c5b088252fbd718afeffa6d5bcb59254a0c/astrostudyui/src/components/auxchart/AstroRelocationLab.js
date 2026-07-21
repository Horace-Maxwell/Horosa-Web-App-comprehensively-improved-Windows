import { Component } from 'react';
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
import { unwrapResult, astroSymbol, signName, fmtNum, fmtDegree, chartParams, cardStyle, SmallTable } from '../astro/AstroExtraCommon';
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
		this.changeSideTab = this.changeSideTab.bind(this);
	}

	changeSideTab(key){
		this.setState({ sideTab: key });
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
	}

	componentWillUnmount(){
		this._mounted = false;
	}

	relocKey(){
		const params = chartParams(this.props.value);
		return [
			params.date, params.time, params.zone, params.lat, params.lon, params.hsys,
			`reloc|${this.state.relocLat}|${this.state.relocLon}`,
		].join('|');
	}

	ensureLoaded(){
		const key = this.relocKey();
		if(key && key !== this.state.requestKey && !this.state.loading){
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
			if(!this._mounted) return;
			// horosa_panel_ready_v1:重置盘中栏(异地整盘)+右栏(信息/相位/行星…六页签)全由 result 派生,
			// 这一次 setState 即「面板数据落定」→ 在其回调里盖章(与其余 10 个辅盘子盘同一技法键)。
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key}, ()=>{
				markPanelReady('auxchart');
			});
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, requestKey: key});
		}
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

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		const relocChart = result.chart || null;
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
