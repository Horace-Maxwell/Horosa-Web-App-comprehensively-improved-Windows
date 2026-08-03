import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQButton, XQSideSection, XQTabs } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import DivinationChartShell from '../divination/DivinationChartShell';
import DateTime from '../comp/DateTime';
import { convertLonToStr, convertLatToStr } from '../astro/AstroHelper';
import { classicalGlobalValue } from '../../utils/classicalChartGlobals';
import AstroInfo from '../astro/AstroInfo';
import AstroAspect from '../astro/AstroAspect';
import AstroPlanet from '../astro/AstroPlanet';
import AstroLots from '../astro/AstroLots';
import AstroThemaMundi from '../astro/AstroThemaMundi';
import AstroDerivedHouses from '../astro/AstroDerivedHouses';
import AstroEminence from '../astro/AstroEminence';
import AstroKlimata from '../astro/AstroKlimata';
import AstroPredictPlanetSign from '../astro/AstroPredictPlanetSign';
import AstroAnalysisLab from '../astro/AstroAnalysisLab';
import AstroEgypt from '../astro/AstroEgypt';
import { markPanelReady } from '../../utils/perfMark';
import { newLeaf, newGroup, compileTree } from '../../divination/zeri/conditionTypes';
import { runScan } from '../../divination/zeri/scanOrchestrator';
import { pushHistory } from '../../divination/zeri/schemeStore';
import { buildTianxingSnapshot } from '../../divination/zeri/tianxingSnapshot';
import ConditionBuilderModal from './ConditionBuilderModal';

const TabPane = XQTabs.TabPane;

// 天星择日(征象搜索侧):中栏=西占单轮盘(DivinationChartShell 默认 /chart 链,与辅盘·择日盘同款);
// 征象工作台=四区大弹窗(构造征象/动作/时间地点盘面/已选列表),结果区间表也在弹窗内,
// 点击结果行 → 以区间起始时刻+搜索地点起盘并关闭弹窗;右栏只放当前条件摘要(只读)+入口。
// 四本账已全接(独立技法键 tianxing):储存 localcases/导出 aiExport/导出设置 migration keys/
// AI 挂载 aiAnalysisContext(sectionsOnly 直读 payload.aiSnapshot);buildAiSnapshot 段头与
// AI_EXPORT_PRESET_SECTIONS.tianxing 逐字成对;独立 module 与辅盘 ElectionMain 零竞写。

function fmtDateInput(d){
	const y = d.getFullYear();
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const day = `${d.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function initialTree(){
	return { ...newGroup('all'), children: [newLeaf('aspect')] };
}

export default class TianxingElectionMain extends Component{
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		const today = new Date();
		const monthLater = new Date(today.getTime() + 30 * 86400000);
		this.state = {
			searchOpen: false,
			cfgSeeded: false,
			cfg: {
				startDate: fmtDateInput(today),
				startTime: '00:00',
				endDate: fmtDateInput(monthLater),
				endTime: '23:59',
				gpsLat: undefined,
				gpsLon: undefined,
				pos: '',
				zone: '+08:00',
				hsys: 0,
				zodiacal: 0,
				siderealAyanamsa: '',
			},
			tree: initialTree(),
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
		};
		this._abort = null;
		this._scanGeo = null;
		this._scanZone = null;
	}

	componentWillUnmount(){
		if(this._abort){
			this._abort.abort();
		}
	}

	// 打开工作台:首开以左栏当前 fields 播种 地点/时区/盘面(之后以弹窗内设置为准,不再回灌)。
	openSearch(fields){
		const fv = (k) => (fields && fields[k] ? fields[k].value : undefined);
		this.setState((s) => {
			if(s.cfgSeeded){
				return { searchOpen: true };
			}
			return {
				searchOpen: true,
				cfgSeeded: true,
				cfg: {
					...s.cfg,
					gpsLat: fv('gpsLat'),
					gpsLon: fv('gpsLon'),
					pos: fv('pos') || '',
					zone: fv('zone') || '+08:00',
					hsys: Number(fv('hsys') || 0),
					zodiacal: Number(fv('zodiacal') || 0),
					siderealAyanamsa: fv('siderealAyanamsa') || '',
				},
			};
		});
	}

	buildScanBase(){
		const cfg = this.state.cfg;
		return {
			startDate: cfg.startDate.replace(/-/g, '/'),
			startTime: `${cfg.startTime || '00:00'}:00`,
			endDate: cfg.endDate.replace(/-/g, '/'),
			endTime: `${cfg.endTime || '23:59'}:59`,
			zone: cfg.zone || '+08:00',
			gpsLat: cfg.gpsLat,
			gpsLon: cfg.gpsLon,
			hsys: Number(cfg.hsys || 0),
			zodiacal: Number(cfg.zodiacal || 0),
			siderealAyanamsa: cfg.siderealAyanamsa || undefined,
			// 落宫宫头前移随全局设置透传(0/1/3/5;引擎缺省 5=主排盘同律,整宫制引擎侧豁免)——
			// 宫位类判定与页面「行星落宫」显示一致(用户实抓 Placidus 下 5° 窗内不一致)。
			houseCuspAdvance: classicalGlobalValue('houseCuspAdvance'),
			ad: 1,
			precision: 'minute',
		};
	}

	async runSearch(){
		let tree = null;
		try{
			if(!this.state.tree.children.length){
				throw new Error('请先添加至少一条征象条件');
			}
			tree = compileTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: e.message || '条件无效' });
			return;
		}
		const base = this.buildScanBase();
		if(!(base.gpsLat !== undefined && base.gpsLon !== undefined)){
			this.setState({ scanErr: '请先在工作台选择地点(经纬度)' });
			return;
		}
		// 快照本轮扫描地点/时区:结果行跳盘用「搜索时的设置」,不受之后改动影响。
		this._scanGeo = {
			gpsLon: base.gpsLon,
			gpsLat: base.gpsLat,
			pos: this.state.cfg.pos || '',
		};
		this._scanZone = base.zone;
		this._scanChart = { hsys: base.hsys, zodiacal: base.zodiacal, siderealAyanamsa: base.siderealAyanamsa };
		this._scanBase = base;
		this._scanTree = tree;
		// 代际+UI 树指纹:详情缓存按代际隔离(旧搜索的判读绝不复用到新结果);
		// 树被改而未重搜时结果页亮黄条(结果↔条件失配防呆,用户实抓旧判读串行)。
		this._scanEpoch = (this._scanEpoch || 0) + 1;
		this._scanUiTreeJson = JSON.stringify(this.state.tree);
		pushHistory(this.state.cfg, this.state.tree);
		this._abort = new AbortController();
		this.setState({ scanning: true, scanErr: '', progress: null, results: null, truncated: false });
		try{
			const out = await runScan({
				base,
				tree,
				signal: this._abort.signal,
				onProgress: (p) => {
					// 流式:部分区间边扫边上屏(重叶多段扫描时结果区不再空白)
					const patch = { progress: p };
					if(p && p.partial){ patch.results = p.partial; }
					this.setState(patch);
				},
			});
			this.setState({ scanning: false, results: out.intervals, truncated: out.truncated, progress: null });
		}catch(e){
			if(e && e.name === 'AbortError'){
				this.setState({ scanning: false, progress: null });
				return;
			}
			this.setState({ scanning: false, progress: null, scanErr: e.message || '扫描失败' });
		}
	}

	cancelScan(){
		if(this._abort){
			this._abort.abort();
		}
	}

	// 点击结果行:以区间起始时刻+扫描时的地点/盘面起盘(单次 patchFields),并关闭工作台看盘。
	useInterval(row, patchFields, which){
		if(typeof patchFields !== 'function'){
			return;
		}
		const zone = this._scanZone || '+08:00';
		const dt = new DateTime();
		dt.setZone(zone);
		// 起盘用安全时刻 pick/pickEnd(端点向内 ε 秒级,引擎产出)——区间端点恰是征象
		// 翻转瞬间,分钟截断的显示串回填必落边界错侧(真机实抓:月 29°59′「未入庙」)。
		const raw = (which === 'end' ? (row.pickEnd || row.end) : (row.pick || row.start)) || row.start;
		const text = raw.length === 16 ? `${raw}:00` : raw;
		const parsed = dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : null;
		if(!parsed){
			return;
		}
		const patch = {
			date: parsed,
			time: parsed.clone ? parsed.clone() : parsed,
			ad: parsed.ad,
			zone,
		};
		const geo = this._scanGeo;
		if(geo && geo.gpsLon !== undefined){
			patch.gpsLon = geo.gpsLon;
			patch.gpsLat = geo.gpsLat;
			patch.lon = convertLonToStr(geo.gpsLon);
			patch.lat = convertLatToStr(geo.gpsLat);
			if(geo.pos){ patch.pos = geo.pos; }
		}
		if(this._scanChart){
			patch.hsys = this._scanChart.hsys;
			patch.zodiacal = this._scanChart.zodiacal;
			if(this._scanChart.siderealAyanamsa){ patch.siderealAyanamsa = this._scanChart.siderealAyanamsa; }
		}
		patchFields(patch);
		this.setState({ searchOpen: false });
	}

	renderLeftExtra({ fields }){
		return (
			<XQSideSection iconName={sideSectionIcon('search')} title="征象搜索" collapsible={false}>
				<div style={{ padding: '4px 0' }}>
					<XQButton type="primary" style={{ width: '100%' }} onClick={() => this.openSearch(fields)}>
						征象搜索…
					</XQButton>
					<div className="horosa-divi-note" style={{ marginTop: 6 }}>
						工作台内选时间段/地点/盘面与征象条件(支持嵌套逻辑组),搜索结果点击即起盘。
					</div>
				</div>
			</XQSideSection>
		);
	}

	// 右栏=占星主页同款判读七页签(信息/相位/行星/古典/可能性/格局/埃及,组件全吃 props 零 store 依赖,
	// 逐字照抄 AstroChartMain.renderContentPanel);征象搜索入口在左栏,结果表在工作台弹窗内。
	renderRight({ chart, fields, patchFields }){
		this._patchFields = patchFields;
		const chartObj = chart;
		// horosa_panel_ready_v1:天星择日中栏(壳画的盘)+右栏(判读)同源于 chart,本组件不发主盘请求。
		// 征象搜索(runScan/explain)是用户显式点按钮触发的后台批量求值,不是「点击→画完」路径,
		// 不在其 setState 上打点(照 ElectionMain 择优扫描先例,否则秒级扫描会配到上次交互起点污染 p95)。
		if(chartObj && chartObj !== this._readyChart){
			this._readyChart = chartObj;
			markPanelReady('zeri');
		}
		// 实测校准:面板内容视口 = props.height − 15(tabs bar+padding 已被 shell 满高 CSS 吸收;
		// 主页的 −100 与辅盘的 −56 折扣都是各自 chrome 的遗产,照抄会在页签底部留等高空白带——用户圈报)。
		const tabHeight = (this.props.height || 760) - 15;
		if(!chartObj){
			return <div style={{ padding: 16, opacity: 0.6 }}>排盘中…</div>;
		}
		return (
			<XQTabs defaultActiveKey="1" tabPosition='top' className="horosa-inspector-tabs horosa-content-tabs">
				<TabPane tab="信息" key="1">
					<AstroInfo mode="summary" height={tabHeight}
						value={chartObj} fields={fields}
						planetDisplay={this.props.planetDisplay}
						showPlanetHouseInfo={this.props.showPlanetHouseInfo}
						showAstroMeaning={this.props.showAstroMeaning}
						showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
					/>
				</TabPane>
				<TabPane tab="相位" key="2">
					<AstroAspect
						value={chartObj} height={tabHeight}
						lotsDisplay={this.props.lotsDisplay}
						planetDisplay={this.props.planetDisplay}
						showPlanetHouseInfo={this.props.showPlanetHouseInfo}
						showAstroMeaning={this.props.showAstroMeaning}
					/>
				</TabPane>
				<TabPane tab="行星" key="3">
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
				</TabPane>
				<TabPane tab="古典" key="4">
					<div style={{ height: tabHeight, overflowY: 'auto', overflowX: 'auto' }}>
						<AstroInfo mode="classical" height={tabHeight}
							value={chartObj} fields={fields}
							planetDisplay={this.props.planetDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
						/>
						<div className="horosa-classical-scroll">
							<div className="horosa-classical-section">
								<span className="horosa-classical-section-zh">衍化</span>
								<span className="horosa-classical-section-en">Derivations</span>
							</div>
							<AstroThemaMundi />
							<AstroDerivedHouses value={chartObj} />
							<AstroEminence value={chartObj} />
							<AstroKlimata value={chartObj} fields={fields} />
						</div>
					</div>
				</TabPane>
				<TabPane tab="可能性" key="5">
					<AstroPredictPlanetSign height={tabHeight}
						value={chartObj} fields={fields}
						planetDisplay={this.props.planetDisplay}
						showPlanetHouseInfo={this.props.showPlanetHouseInfo}
					/>
				</TabPane>
				<TabPane tab="格局" key="6">
					<AstroAnalysisLab
						value={chartObj}
						height={tabHeight}
						voidClassical={this.props.voidClassical}
					/>
				</TabPane>
				<TabPane tab="埃及" key="egypt">
					<AstroEgypt value={chartObj} height={tabHeight} />
				</TabPane>
			</XQTabs>
		);
	}

	explainInterval = async (row) => {
		const { fetchElectionExplain } = require('../../services/electionScan');
		const base = this._scanBase || this.buildScanBase();
		const t = String(row.pick || `${row.start}:00`).replace(/-/g, '/');
		return fetchElectionExplain({ ...base, conditions: this._scanTree, t });
	};

	previewChartParams = (row, which) => {
		const geo = this._scanGeo || {};
		const chart = this._scanChart || {};
		const raw = (which === 'end' ? (row.pickEnd || row.end) : (row.pick || row.start)) || row.start;
		const text = raw.length === 16 ? `${raw}:00` : raw;
		return {
			ad: 1,
			date: text.slice(0, 10).replace(/-/g, '/'),
			time: text.slice(11),
			zone: this._scanZone || '+08:00',
			gpsLat: geo.gpsLat, gpsLon: geo.gpsLon,
			lat: geo.gpsLat !== undefined ? convertLatToStr(geo.gpsLat) : null,
			lon: geo.gpsLon !== undefined ? convertLonToStr(geo.gpsLon) : null,
			pos: geo.pos || '',
			hsys: chart.hsys || 0,
			zodiacal: chart.zodiacal || 0,
			siderealAyanamsa: chart.siderealAyanamsa || '',
			tradition: 1, southchart: 0, doubingSu28: 0, strongRecption: 0,
			simpleAsp: 0, virtualPointReceiveAsp: 1, predictive: 0,
			pdaspects: [0, 60, 90, 120, 180], after23NewDay: 1,
		};
	};

	render(){
		return (
			<div style={{ height: '100%', flex: '1 1 auto', minWidth: 0, width: '100%' }}>
				<DivinationChartShell
					title="天星择日"
					kicker="择日搜索"
					pageClass="horosa-zeri-page"
					defaults={{ tradition: 1, zodiacal: 0, hsys: 0 }}
					fields={this.props.fields}
					height={this.props.height}
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
					showAstroMeaning={this.props.showAstroMeaning}
					dispatch={this.props.dispatch}
					saveModule="tianxing"
					buildAiSnapshot={(chart, fields, extra) => buildTianxingSnapshot(chart, fields, extra, {
						cfg: this.state.cfg,
						tree: this.state.tree,
						results: this.state.results,
						truncated: this.state.truncated,
					})}
					renderLeftExtra={(args) => this.renderLeftExtra(args)}
					renderRight={(args) => this.renderRight(args)}
				/>
				<ConditionBuilderModal
					open={this.state.searchOpen}
					onClose={() => this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg) => this.setState({ cfg })}
					tree={this.state.tree}
					onTreeChange={(tree) => this.setState({ tree })}
					onRun={() => this.runSearch()}
					onCancelScan={() => this.cancelScan()}
					onPickInterval={(row, which) => this.useInterval(row, this._patchFields, which)}
					onExplain={this.explainInterval}
					onPreviewParams={this.previewChartParams}
					scanEpoch={this._scanEpoch || 0}
					resultsStale={!!(this.state.results && this._scanUiTreeJson
						&& JSON.stringify(this.state.tree) !== this._scanUiTreeJson)}
					previewDisplay={{
						chartDisplay: this.props.chartDisplay,
						planetDisplay: this.props.planetDisplay,
						lotsDisplay: this.props.lotsDisplay,
						showAstroMeaning: this.props.showAstroMeaning,
					}}
					scanning={this.state.scanning}
					progress={this.state.progress}
					results={this.state.results}
					truncated={this.state.truncated}
					scanErr={this.state.scanErr}
				/>
			</div>
		);
	}
}
