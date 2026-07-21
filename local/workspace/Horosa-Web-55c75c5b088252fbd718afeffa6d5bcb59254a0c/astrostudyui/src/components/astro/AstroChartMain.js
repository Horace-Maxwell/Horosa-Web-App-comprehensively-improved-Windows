import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { Row, Col, Popover, Tooltip } from 'antd';
import AstroChart from './AstroChart';
import AstroInfo from './AstroInfo';
import AstroThemaMundi from './AstroThemaMundi';
import AstroDerivedHouses from './AstroDerivedHouses';
import AstroEminence from './AstroEminence';
import AstroKlimata from './AstroKlimata';
import AstroAspect from './AstroAspect';
import AstroPlanet from './AstroPlanet';
import AstroLots from './AstroLots';
import AstroPredictPlanetSign from './AstroPredictPlanetSign';
import AstroAnalysisLab from './AstroAnalysisLab';
import AstroEgypt from './AstroEgypt';
import AspSelector from './AspSelector';
import ChartDisplaySelector from './ChartDisplaySelector';
import PlanetSelector from './PlanetSelector';
import PlusMinusTime from './PlusMinusTime';
import DateTime from '../comp/DateTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr} from './AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { preloadNavByKey } from '../../utils/navPreload';
import { geoNameRawPatch } from '../../utils/geoName';
import { getHousesOption } from '../comp/CompHelper'
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { SCHOOL_PRESETS, SCHOOL_PRESET_OPTIONS, SCHOOL_PRESET_DEFAULT, SCHOOL_PRESET_CUSTOM, normalizeSchoolPreset, presetOf } from './schoolPresets';
import { XQButton, XQIconButton, XQSectionTitle, XQSegmented, XQSelect, XQTabs, XQToggle, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1] 图标语义映射单源
import XQIcon from '../xq-icons';

const TabPane = XQTabs.TabPane;
const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

function fieldValue(fields, key, fallback = ''){
	if(!fields || !fields[key]){
		return fallback;
	}
	return fields[key].value !== undefined && fields[key].value !== null ? fields[key].value : fallback;
}

function formatFieldTime(fields){
	const date = fieldValue(fields, 'date', null);
	const time = fieldValue(fields, 'time', null);
	const dateText = date && date.format ? date.format('YYYY-MM-DD') : '';
	const timeText = time && time.format ? time.format('HH:mm:ss') : '';
	return `${dateText}${timeText ? ` ${timeText}` : ''}`.trim();
}

function formatTrueSolarTime(value){
	if(!value){
		return '';
	}
	return `${value}`.replace(' ', '，');
}

// ─────────────────────────────────────────────────────────────────────────────
// horosa_freeze_subtabs_v1(占星本命右栏)+ 子页签 state 下沉。
//
// 病灶(普查):右栏 7 个 TabPane(信息/相位/行星/古典/可能性/格局/埃及)全部直接内联 children,
// antd Tabs 是 keep-alive —— 任一面板被激活过之后就永久挂在 React 树里,此后 AstroChartMain
// 每重渲一次(切时间 → chartObj 换引用),这 7 个面板【包括用户看不见的 6 个】全部 reconcile +
// render 一遍(AstroInfo 古典分节、AstroAspect 的 planet×planet 表都不便宜),吃掉本该属于
// 可见内容的预算。
//
// 两处修法:
//  ① Tabs 改【受控】(activeKey + onChange)并给每个面板包 FreezeSubTab:非激活面板 sCU 返 false
//     跳过重渲。冻结 ≠ 卸载 —— DOM/组件实例/滚动位置/展开态全部保留,切回时拿本轮父组件构造的
//     【最新】children 立即渲一帧(不重新挂载、不重发请求、不闪烁、无陈旧)。children 传函数,
//     从未激活过的面板连 React 元素都不创建。
//  ② activeTab 的 state 下沉到本组件(而不是留在 AstroChartMain):切右栏子页签只重渲右栏,
//     不再连带把左栏输入面板与中栏盘面容器整树重渲一遍。
// props 侧 sCU 与 AstroChartMain 同款(wrapperPropsEqual 机械全覆盖浅比,函数型 props 跳过),
// 取向仍是「宁可多渲、绝不漏渲」:任一数据 prop 引用变(chartObj/fields/显示开关)即照常重渲。
class AstroContentPanel extends Component{

	constructor(props){
		super(props);
		this.state = {
			activeTab: '1',
		};
		this.changeTab = this.changeTab.bind(this);
	}

	changeTab(key){
		this.setState({ activeTab: key });
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	render(){
		const chartObj = this.props.value;
		const fields = this.props.fields;
		const tabHeight = this.props.tabHeight;
		const showlots = this.props.showlots;
		const activeTab = this.state.activeTab;
		return (
			<div className="horosa-inspector-panel horosa-astro-content-panel">
				<XQTabs activeKey={activeTab} onChange={this.changeTab} tabPosition='top' className="horosa-inspector-tabs horosa-content-tabs">
					<TabPane tab="信息" key="1">
						<FreezeSubTab active={activeTab === '1'}>{()=>(
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
						<FreezeSubTab active={activeTab === '2'}>{()=>(
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
						<FreezeSubTab active={activeTab === '3'}>{()=>(
							<div className="horosa-planet-with-lots" style={{ height: tabHeight }}>
								<AstroPlanet
									value={chartObj}
									fill={true}
									showPlanetHouseInfo={this.props.showPlanetHouseInfo}
									showAstroMeaning={this.props.showAstroMeaning}
								/>
								{showlots ? (
									<div className="horosa-lots-under-planets">
										<div className="horosa-info-card-title">希腊点</div>
										<AstroLots value={chartObj} fill={true} showAstroMeaning={this.props.showAstroMeaning}/>
									</div>
								) : null}
							</div>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="古典" key="4">
						<FreezeSubTab active={activeTab === '4'}>{()=>(
							<div style={{ height: tabHeight, overflowY: 'auto', overflowX: 'hidden' }}>
								<AstroInfo mode="classical" height={tabHeight}
									value={chartObj} fields={fields}
									planetDisplay={this.props.planetDisplay}
									showPlanetHouseInfo={this.props.showPlanetHouseInfo}
									showAstroMeaning={this.props.showAstroMeaning}
									showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
								/>
								{/* 寿命/十二分度/主宰星链 已并入 AstroInfo 古典分节(状态/度数/格局补充/寿命),此处不再单列 */}
								{/* 衍化分节:与 AstroInfo 古典分节同一卡片语汇(分节头 + 双语卡标题),排版统一 */}
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
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="可能性" key="5">
						<FreezeSubTab active={activeTab === '5'}>{()=>(
							<AstroPredictPlanetSign height={tabHeight}
								value={chartObj} fields={fields}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="格局" key="6">
						<FreezeSubTab active={activeTab === '6'}>{()=>(
							<AstroAnalysisLab
								value={chartObj}
								height={tabHeight}
								voidClassical={this.props.voidClassical}
							/>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="埃及" key="egypt">
						<FreezeSubTab active={activeTab === 'egypt'}>{()=>(
							<AstroEgypt value={chartObj} height={tabHeight} />
						)}</FreezeSubTab>
					</TabPane>
				</XQTabs>
			</div>
		);
	}
}

class AstroChartMain extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

        this.tmHook = {
            getValue: null,
        }

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeSchoolPreset = this.changeSchoolPreset.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);
		this.openDrawer = this.openDrawer.bind(this);
		this.newChart = this.newChart.bind(this);
		this.changeChartStyle = this.changeChartStyle.bind(this);
		this.changeIndiaChartStyle = this.changeIndiaChartStyle.bind(this);
		this.toggleChartDisplayOption = this.toggleChartDisplayOption.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.navigateDirectionTool = this.navigateDirectionTool.bind(this);
		this.renderInputOptionPopovers = this.renderInputOptionPopovers.bind(this);
		this.renderInputPanel = this.renderInputPanel.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				return;
			};
		}

	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
				confirmed: tm.confirmed,
				...(tm.step ? { step: tm.step } : {}),   // 步进方向提示(WP-P1 预取)原样透传
			});
		}
	}

	changeZodiacal(val){
		// val 为复合值 'tropical' | 'sidereal:<ayanamsaKey>' → 拆成 zodiacal(0/1) + siderealAyanamsa
		const parsed = AstroConst.parseZodiacSelectValue(val);
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					zodiacal: parsed.zodiacal,
					siderealAyanamsa: parsed.siderealAyanamsa,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});
			}else{
				this.props.onChange({
					zodiacal: parsed.zodiacal,
					siderealAyanamsa: parsed.siderealAyanamsa,
				});
			}

		}
	}

	changeHsys(val){
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					hsys: val,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});
			}else{
				this.props.onChange({
					hsys: val,
				});
			}
		}
	}

	// 当前流派预设：由实时四维(黄道/宫制/界/三分)反查命中的档；任一单项被单独改 → 'custom'。
	// 三分体系不是 fields，取自 app.tripSystem(默认 Dorothean)。
	currentSchoolPreset(){
		const f = this.props.fields || {};
		const zodiac = AstroConst.zodiacSelectValue(
			f.zodiacal ? f.zodiacal.value : 0,
			f.siderealAyanamsa ? f.siderealAyanamsa.value : '',
		);
		const hsys = f.hsys ? f.hsys.value : '';
		const termsVariant = f.termsVariant ? f.termsVariant.value : 0;
		const tripSystem = this.props.tripSystem || 'Dorothean';
		return presetOf({ zodiac, hsys, termsVariant, tripSystem });
	}

	// 选流派预设：展开该档 → 一次性写入黄道/宫制/界/三分。
	//   ① 持久化 app.schoolPreset(UI 记忆) + app.tripSystem(三分体系，供三分主星页读取)。
	//   ② 经既有 onChange(=index.changeCond)一次写 zodiacal/siderealAyanamsa/hsys/termsVariant → 单次重算。
	// 选到「自定」不做动作(它是单项覆盖后的派生显示态，无对应取值)。
	changeSchoolPreset(e){
		const val = e && e.target ? e.target.value : e;
		if(val === SCHOOL_PRESET_CUSTOM){ return; }
		const preset = SCHOOL_PRESETS[normalizeSchoolPreset(val)];
		if(!preset){ return; }
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload: { schoolPreset: normalizeSchoolPreset(val), tripSystem: preset.tripSystem },
			});
		}
		if(!this.props.onChange){ return; }
		const parsed = AstroConst.parseZodiacSelectValue(preset.zodiac);
		const change = {
			zodiacal: parsed.zodiacal,
			siderealAyanamsa: parsed.siderealAyanamsa,
			hsys: preset.hsys,
			termsVariant: preset.termsVariant,
			triplicity: preset.tripSystem,   // G20-P2:预设三分集 → fields.triplicity → 后端尊贵换表
		};
		if(this.tmHook.getValue){
			const tm = this.tmHook.getValue().value;
			change.tm = tm;
			change.ad = tm.ad;
			change.zone = tm.zone;
		}
		this.props.onChange(change);
	}

	changeSouthChart(val){
		if(this.props.fields.lat === undefined || this.props.fields.lat === null){
			return;
		}
		let lat = this.props.fields.lat.value;
		if(lat.toLowerCase().indexOf('n') >= 0){
			return;
		}

		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					southchart: val,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});
			}else{
				this.props.onChange({
					southchart: val,
				});
			}
		}
	}

	changeGeo(rec){
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时),与 atlas 预览/命盘事盘录入一致。
				// setZone 仅改时区标签、保留出生钟面时刻(见 DateTime.setZone),不移位时间。
				if(tm && tm.setZone){
					try{
						if(rec.zone){
							tm.setZone(rec.zone);
						}else{
							const ds = tm.format ? tm.format('YYYY-MM-DD') : null;
							const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
							if(z && z.offset){ tm.setZone(z.offset); }
						}
					}catch(e){ /* 推断失败保留原时区 */ }
				}
				this.props.onChange({
					lon: convertLonToStr(rec.lng),
					lat: convertLatToStr(rec.lat),
					gpsLon: rec.gpsLng,
					gpsLat: rec.gpsLat,
					...geoNameRawPatch(rec),
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});
			}else{
				this.props.onChange({
					lon: convertLonToStr(rec.lng),
					lat: convertLatToStr(rec.lat),
					gpsLon: rec.gpsLng,
					gpsLat: rec.gpsLat,
					...geoNameRawPatch(rec)
				});
			}
		}
	}

	openDrawer(key){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key,
				},
			});
		}
	}

	newChart(){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/nowChart',
				payload: {},
			});
		}
	}

	changeChartStyle(e){
		const chartStyle = e && e.target ? e.target.value : e;
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload: {
					chartStyle,
				},
			});
		}
	}

	changeIndiaChartStyle(e){
		const indiaChartStyle = e && e.target ? e.target.value : e;
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload: {
					indiaChartStyle,
				},
			});
		}
	}

	toggleChartDisplayOption(opt){
		if(!this.props.dispatch){
			return;
		}
		const current = Array.isArray(this.props.chartDisplay) ? this.props.chartDisplay.slice(0) : [];
		const idx = current.indexOf(opt);
		if(idx >= 0){
			current.splice(idx, 1);
		}else{
			current.push(opt);
		}
		this.props.dispatch({
			type: 'app/save',
			payload: {
				chartDisplay: current,
			},
		});
	}

	navigateFeature(key){
		if(this.props.onNavigate){
			this.props.onNavigate(key);
			return;
		}
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload: {
					currentTab: key,
				},
			});
		}
	}

	navigateDirectionTool(subTab){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload: {
					currentTab: 'direction',
					currentSubTab: subTab,
				},
			});
			return;
		}
		this.navigateFeature('direction');
	}

	getChartMeta(chartObj, fields){
		const chart = chartObj && chartObj.chart ? chartObj.chart : {};
		const params = chartObj && chartObj.params ? chartObj.params : {};
		const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${fieldValue(fields, 'zodiacal', 0)}`];
		const hsysRaw = chart.hsys || AstroConst.HouseSys[`${fieldValue(fields, 'hsys', '')}`];
		const birth = params.birth || formatFieldTime(fields) || '未排盘';
		const location = fieldValue(fields, 'pos', '') || params.pos || '未命名地点';
		const lon = fieldValue(fields, 'lon', params.lon || '--');
		const lat = fieldValue(fields, 'lat', params.lat || '--');
		const zone = params.zone || fieldValue(fields, 'zone', '--');
		const ayanKey = fieldValue(fields, 'siderealAyanamsa', '') || params.siderealAyanamsa || (chart && chart.siderealAyanamsa) || '';
		const zodiacal = zodiacalRaw ? AstroConst.zodiacalDisplayText(zodiacalRaw, ayanKey) : '--';
		const hsys = AstroText.AstroMsg[hsysRaw] || hsysRaw || '--';
		const sect = chart.isDiurnal === undefined || chart.isDiurnal === null ? '昼夜未定' : (chart.isDiurnal ? '日生盘' : '夜生盘');
		const dayofweek = chart.dayofweek || '';
		const trueSolarTime = chart.nongli && chart.nongli.birth ? chart.nongli.birth : '';
		const dayerStar = chart.dayerStar ? (AstroText.AstroMsgCN[chart.dayerStar] || chart.dayerStar) : '';
		const timerStar = chart.timerStar ? (AstroText.AstroMsgCN[chart.timerStar] || chart.timerStar) : '';
		return {
			// 标题优先取当前 fields.name(玄学史等联动跳转会即时写入,排盘前也能立刻显示),
			// 再退回已排盘结果 params.name,最后默认「本命盘」。正常本命盘 fields.name 为 null → 零回归。
			title: fieldValue(fields, 'name', '') || params.name || '本命盘',
			birth: `${birth}${dayofweek ? ` ${dayofweek}` : ''}`,
			location,
			lon,
			lat,
			zone,
			zodiacal,
			hsys,
			sect,
			trueSolarTime,
			dayerStar,
			timerStar,
		};
	}

	renderInputPanel(meta, dt, options){
		const isIndiaChart = !!this.props.indiahsys;
		const chartStyle = AstroConst.normalizeChartStyle(this.props.chartStyle);
		const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(this.props.indiaChartStyle);
		const currentDisplay = Array.isArray(this.props.chartDisplay) ? this.props.chartDisplay : [];
		const {
			showdateselector,
			showzodical,
			showhsys,
			indiahsys,
		} = options;
		const quickToggles = [
			{ label: '相位线', opt: AstroConst.CHART_ASP_LINES },
			{ label: '四角', opt: AstroConst.CHART_ANGLELINE },
			{ label: '度数', opt: AstroConst.CHART_TXTPLANET },
			{ label: '界限', opt: AstroConst.CHART_TERM },
		];
		const timeEditor = (
			<div className="horosa-time-popover">
				<PlusMinusTime value={dt} onChange={this.changeTime} />
			</div>
		);
		return (
			<div className="horosa-astro-context-panel horosa-astro-input-panel">
				<div className="horosa-panel-head">
					<div>
						<div className="horosa-panel-kicker">命盘设置</div>
						<div className="horosa-panel-title">{meta.title}</div>
					</div>
				</div>
				<div className="horosa-chart-mode-switch">
					<button type="button" className="is-active">单盘</button>
					<button type="button" onClick={()=>this.navigateFeature('relativechart')}>多盘</button>
				</div>
				{/* [观象P1] InputPanel 五段式:时间地点(核心不折叠)/盘制流派/样式/显示/重算 */}
				{showdateselector ? (
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<div className="horosa-field-block">
						<div className="horosa-field-label">时间</div>
						<Popover content={timeEditor} trigger="click" placement="rightTop" overlayClassName="horosa-time-adjust-popover">
							<button type="button" className="horosa-unified-field">
								<XQIcon name="clock" />
								<span>{formatFieldTime(this.props.fields) || meta.birth}</span>
							</button>
						</Popover>
						<div className="horosa-field-hint">当地时间</div>
						<div className="horosa-time-adjust-inline">
							<PlusMinusTime value={dt} onChange={this.changeTime} hook={this.tmHook} adjustOnly />
						</div>
					</div>
					<div className="horosa-field-block">
						<div className="horosa-field-label">地点</div>
						<GeoCoordModal
							onOk={this.changeGeo}
							lat={this.props.fields.gpsLat.value} lng={this.props.fields.gpsLon.value}
							date={this.props.fields.date ? this.props.fields.date.value : undefined}
						>
							<button type="button" className="horosa-unified-field horosa-place-field">
								<XQIcon name="locastro" />
								<span>
									<strong>{meta.location}</strong>
									<small>{this.props.fields.lon.value} · {this.props.fields.lat.value}</small>
								</span>
								<XQIcon name="globe" />
							</button>
						</GeoCoordModal>
					</div>
				</XQSideSection>
				) : null}
				<XQSideSection iconName={sideSectionIcon('school')} title="盘制与流派" storageKey="astro.input.system" className="horosa-side-input-section">
				{(showzodical || showhsys) && !indiahsys ? (
					<div className="horosa-field-block horosa-school-preset-block">
						<div className="horosa-field-label">流派预设</div>
						<XQSelect
							style={{width: '100%'}}
							onChange={this.changeSchoolPreset}
							dropdownMatchSelectWidth={false}
							value={this.currentSchoolPreset()}
							size='small'>
							{SCHOOL_PRESET_OPTIONS.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
						</XQSelect>
						<div className="horosa-field-hint">一档联动黄道 · 宫制 · 界 · 三分；改单项转「自定」</div>
					</div>
				) : null}
				<div className="horosa-field-grid">
					{showzodical ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">黄道</div>
							<XQSelect
								style={{width: '100%'}}
								onChange={this.changeZodiacal}
								dropdownMatchSelectWidth={false}
								value={AstroConst.zodiacSelectValue(this.props.fields.zodiacal.value, this.props.fields.siderealAyanamsa && this.props.fields.siderealAyanamsa.value)} size='small'>
								{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
									<OptGroup label={grp.group} key={grp.group}>
										{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
									</OptGroup>
								))}
							</XQSelect>
						</div>
					) : null}
					{showhsys ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">宫制</div>
							<XQSelect style={{width: '100%'}}
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size='small'>
								{ getHousesOption(true) }
							</XQSelect>
						</div>
					) : null}
					{indiahsys ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">印度宫制</div>
							<XQSelect style={{width:'100%'}}
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size='small'>
								<Option value={0}>整宫制</Option>
								<Option value={5}>Vehlow Equal</Option>
							</XQSelect>
						</div>
					) : null}
				</div>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('chartStyle')} title="星盘样式" storageKey="astro.style" className="horosa-side-input-section">
					<div className={`horosa-chart-style-block${isIndiaChart ? ' horosa-india-style-block' : ''}`}>
						{isIndiaChart ? (
							<XQSegmented
								value={indiaChartStyle}
								onChange={this.changeIndiaChartStyle}
								options={AstroConst.INDIA_CHART_STYLE_OPTIONS}
							/>
						) : (
							<XQSegmented
								value={chartStyle}
								onChange={this.changeChartStyle}
								options={AstroConst.CHART_STYLE_OPTIONS}
							/>
						)}
					</div>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('display')} title="显示" storageKey="astro.quick" className="horosa-side-input-section">
					{this.renderInputOptionPopovers(options, quickToggles, currentDisplay)}
					<div className="horosa-inline-toggle-row">
						{quickToggles.map((item)=>{
							const active = currentDisplay.includes(item.opt);
							return (
								<XQToggle
									key={item.opt}
									size="small"
									active={active}
									onClick={()=>this.toggleChartDisplayOption(item.opt)}
								>
									{item.label}
								</XQToggle>
							);
						})}
					</div>
				</XQSideSection>
				<XQButton className="horosa-recalculate-button" size="small" iconName="refresh" onClick={this.newChart}>
					重算星盘
				</XQButton>
			</div>
		);
	}

	renderInterpretationPanel(meta){
		const memo = this.props.memo ? this.props.memo : '';
		const summary = [
			`${meta.zodiacal}，${meta.hsys}，${meta.sect}`,
			`${meta.birth}，${meta.location}`,
			`经度 ${meta.lon}，纬度 ${meta.lat}，时区 ${meta.zone}`,
		];
		return (
			<div className="horosa-interpretation-panel">
						<XQTabs defaultActiveKey="interpret" tabPosition="top" className="horosa-interpretation-tabs">
					<TabPane tab="解读" key="interpret">
						<div className="horosa-reading-lines">
							{summary.map((line)=><p key={line}>{line}</p>)}
						</div>
					</TabPane>
					<TabPane tab="笔记" key="note">
						<div className="horosa-reading-lines">
							<p>{memo || '暂无笔记'}</p>
						</div>
					</TabPane>
					<TabPane tab="批注" key="memo">
						<div className="horosa-reading-lines">
							<p>{memo || '暂无批注'}</p>
						</div>
					</TabPane>
				</XQTabs>
			</div>
		);
	}

	renderInputOptionPopovers(options, quickToggles, currentDisplay){
		const isIndiaChart = !!this.props.indiahsys;
		const chartStyle = AstroConst.normalizeChartStyle(this.props.chartStyle);
		const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(this.props.indiaChartStyle);
		const {
			showzodical,
			showhsys,
			indiahsys,
		} = options;
		const overlayClassName = "horosa-settings-popover";
		const popoverProps = {
			trigger: "click",
			placement: "rightTop",
			overlayClassName,
			destroyTooltipOnHide: true,
		};
		const planetsContent = (
			<div className="horosa-settings-popover-panel horosa-settings-popover-panel-large">
				<div className="horosa-settings-popover-title">显示星体</div>
				<PlanetSelector
					value={this.props.planetDisplay}
					lots={this.props.lotsDisplay}
					dispatch={this.props.dispatch}
				/>
			</div>
		);
		const zodiacContent = (
			<div className="horosa-settings-popover-panel">
				<div className="horosa-settings-popover-title">宫位制与黄道</div>
				<div className="horosa-settings-form-grid">
					{showzodical ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">黄道</div>
							<XQSelect
								style={{width: '100%'}}
								onChange={this.changeZodiacal}
								dropdownMatchSelectWidth={false}
								value={AstroConst.zodiacSelectValue(this.props.fields.zodiacal.value, this.props.fields.siderealAyanamsa && this.props.fields.siderealAyanamsa.value)}
								size="small"
							>
								{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
									<OptGroup label={grp.group} key={grp.group}>
										{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
									</OptGroup>
								))}
							</XQSelect>
						</div>
					) : null}
					{showhsys ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">宫制</div>
							<XQSelect
								style={{width: '100%'}}
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size="small"
							>
								{ getHousesOption(true) }
							</XQSelect>
						</div>
					) : null}
					{indiahsys ? (
						<div className="horosa-field-block">
							<div className="horosa-field-label">印度宫制</div>
							<XQSelect
								style={{width: '100%'}}
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size="small"
							>
								<Option value={0}>整宫制</Option>
								<Option value={5}>Vehlow Equal</Option>
							</XQSelect>
						</div>
					) : null}
				</div>
			</div>
		);
		const displayContent = (
			<div className="horosa-settings-popover-panel horosa-settings-popover-panel-large">
				<div className="horosa-settings-popover-title">显示与样式</div>
				<div className={`horosa-chart-style-block${isIndiaChart ? ' horosa-india-style-block' : ''}`}>
					<div className="horosa-side-section-title">星盘样式</div>
					{isIndiaChart ? (
						<XQSegmented
							value={indiaChartStyle}
							onChange={this.changeIndiaChartStyle}
							options={AstroConst.INDIA_CHART_STYLE_OPTIONS}
						/>
					) : (
						<XQSegmented
							value={chartStyle}
							onChange={this.changeChartStyle}
							options={AstroConst.CHART_STYLE_OPTIONS}
						/>
					)}
				</div>
				<ChartDisplaySelector
					value={this.props.chartDisplay}
					showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : this.props.showPdBounds}
					showPlanetHouseInfo={this.props.showPlanetHouseInfo}
					showAstroMeaning={this.props.showAstroMeaning}
					showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
					fields={this.props.fields}
					dispatch={this.props.dispatch}
				/>
			</div>
		);
		const switchContent = (
			<div className="horosa-settings-popover-panel horosa-settings-popover-panel-large">
				<div className="horosa-settings-popover-title">快捷切换</div>
				<XQSectionTitle>快捷显示</XQSectionTitle>
				<div className="horosa-chart-toggle-grid horosa-settings-toggle-grid">
					{quickToggles.map((item)=>{
						const active = currentDisplay.includes(item.opt);
						return (
							<XQToggle
								key={item.opt}
								size="small"
								active={active}
								onClick={()=>this.toggleChartDisplayOption(item.opt)}
							>
								{item.label}
							</XQToggle>
						);
					})}
				</div>
				<XQSectionTitle>相位选择</XQSectionTitle>
				<AspSelector
					value={this.props.aspects}
					dispatch={this.props.dispatch}
				/>
			</div>
		);

		return (
			<div className="horosa-input-nav-stack">
				<Popover {...popoverProps} content={planetsContent}>
					<XQButton size="small" iconName="sidePlanets">显示星体</XQButton>
				</Popover>
				<Popover {...popoverProps} content={zodiacContent}>
					<XQButton size="small" iconName="sideHouses">宫位制与黄道</XQButton>
				</Popover>
				<Popover {...popoverProps} content={displayContent}>
					<XQButton size="small" iconName="sideStyle">显示与样式</XQButton>
				</Popover>
				<Popover {...popoverProps} content={switchContent}>
					<XQButton size="small" iconName="sideSwitch">快捷切换</XQButton>
				</Popover>
			</div>
		);
	}

	renderQuickActions(){
		if(this.props.showQuickActions !== true){
			return null;
		}
		const actions = [
			{ label: '主限法', icon: <XQIcon name="qimen" />, key: 'primarydirect' },
			{ label: '法达星限', icon: <XQIcon name="solstice" />, key: 'firdaria' },
			{ label: '黄道星释', icon: <XQIcon name="astro" />, key: 'zodialrelease' },
			{ label: '小限法', icon: <XQIcon name="newChart" />, key: 'profection' },
			{ label: '太阳返照', icon: <XQIcon name="direction" />, key: 'solarreturn' },
		];
		return (
			<div className="horosa-side-quick-actions">
				<div className="horosa-side-section-title">高频功能</div>
				<div className="horosa-quick-action-grid">
					{actions.map((item)=>(
						<XQButton key={item.key} size="small" onClick={()=>this.navigateDirectionTool(item.key)}>
							<span className="horosa-quick-action-icon">{item.icon}</span>
							<span className="horosa-quick-action-label">{item.label}</span>
						</XQButton>
					))}
				</div>
			</div>
		);
	}

	renderBottomQuickDock(){
		if(this.props.showQuickActions !== true){
			return null;
		}
		const actions = [
			{ label: '主限', icon: 'quickPrimary', onClick: ()=>this.navigateDirectionTool('primarydirect') },
			{ label: '法达', icon: 'quickFirdaria', onClick: ()=>this.navigateDirectionTool('firdaria') },
			{ label: '小限', icon: 'quickProfection', onClick: ()=>this.navigateDirectionTool('profection') },
			{ label: '产前朔望', icon: 'quickReturn', onClick: ()=>this.navigateDirectionTool('prenatalsyzygy') },
			{ label: '返照', icon: 'quickReturn', onClick: ()=>this.navigateDirectionTool('solarreturn') },
			{ label: '合盘', icon: 'quickComposite', onClick: ()=>this.navigateFeature('relativechart') },
			{ label: '星运', icon: 'quickTransit', onClick: ()=>this.navigateFeature('direction') },
			{ label: '笔记', icon: 'quickNote', onClick: ()=>this.openDrawer('memo') },
			{ label: 'AI助手', icon: 'quickAi', onClick: ()=>this.navigateFeature('aianalysis') },
		];
		return (
			<div className="horosa-bottom-quick-dock">
				<div className="horosa-bottom-quick-title">快捷功能 <XQIcon name="ai" /></div>
				<div className="horosa-bottom-quick-actions">
					{actions.map((item)=>(
						<button type="button" key={item.label} className="horosa-bottom-quick-button" onClick={item.onClick}>
							<span className="horosa-bottom-quick-icon"><XQIcon name={item.icon} /></span>
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</div>
		);
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	// horosa_panel_ready_v1(占星本命):交互终点埋点。
	// 本族是全仓唯一的「零请求、零 pan-state」技法 —— 中栏(AstroChart)与右栏(AstroInfo/
	// AstroAspect/…)全部是 props.value(chartObj)的纯派生,组件内没有任何「面板数据落定的
	// setState」可挂。等价落点就是 chartObj 换引用后的这次 componentDidUpdate:此刻 React 已
	// 提交本轮 DOM,markPanelReady 内部再压两层 rAF 逼近「本帧已绘」,与 pages/index.js 的
	// render-complete 口径一致。
	// 三条约束:
	//  · 只在 chartObj 真换引用时打(props 其它变化 = 显示开关,不是一次排盘落定);
	//  · 只由【主命盘那一个实例】打 —— AstroChartMain 被合盘/节气/十三星座等多处复用,
	//    showQuickActions===true 是 pages/index.js 占星页签独有的标识(全仓仅此一处传),
	//    否则别的页签的交互会被记到 'astrochart' 名下;
	//  · technique 固定 'astrochart' = 顶层页签 key,与 markInteractionStart(currentTab) 配对。
	// markPanelReady 自身按 generation 去重且 kill-switch 同 horosa.perf.interactionMarks;
	// 与 models/astro.js 的 markChartRefreshEnd 不重复计数(那条只打 performance.mark/measure,
	// 不进 perfSummary 的聚合表)。
	componentDidUpdate(prevProps){
		if(this.props.showQuickActions !== true){
			return;
		}
		if(prevProps.value === this.props.value || !this.props.value){
			return;
		}
		markPanelReady('astrochart');
	}

	render(){
		let chartObj = this.props.value;
		let fields = this.props.fields;
		let dt = new DateTime();
		if(chartObj){
			dt.setZone(chartObj.params.zone);
		}else{
			dt.setZone(fields.zone.value);
		}
		let dtstr = chartObj ? chartObj.params.birth : null;
		if(dtstr){
			if(dtstr.length > 11){
				dt.parse(dtstr, 'YYYY-MM-DD HH:mm:ss');
			}else{
				dt.parse(dtstr, 'YYYY-MM-DD');
			}
		}

		let height = this.props.height ? this.props.height : 760;
		let tabHeight = height - 100;
		const showQuickActions = this.props.showQuickActions === true;
		const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height;
		let chartHeight = Math.max(560, Math.min(height - 150, viewportHeight - 204));

		let showzodical = true;
		let showhsys = true;
		let showdateselector = true;
		let showlots = true;
		let indiahsys = false;
		if(this.props.hidezodiacal){
			showzodical = false
		}
		if(this.props.hidehsys){
			showhsys = false;
		}
		if(this.props.hidedateselector){
			showdateselector = false;
			tabHeight = tabHeight + 100;
		}
		if(this.props.hidelots){
			showlots = false;
		}
		if(this.props.indiahsys){
			indiahsys = true;
			showhsys = false;
		}
		const meta = this.getChartMeta(chartObj, fields);

		const rootClassName = `horosa-astro-page horosa-astro-redesign${showQuickActions ? '' : ' horosa-astro-no-bottom-dock'}`;

		return (
			<div className={rootClassName}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout">
					<div className="horosa-astro-redesign-grid">
						{this.renderInputPanel(meta, dt, {
							showdateselector,
							showzodical,
							showhsys,
							indiahsys,
						})}
						<div className="horosa-chart-stage horosa-chart-stage-redesign">
							<div className="horosa-chart-floating-tools">
								<XQIconButton size="small" iconName="settings" tooltip="星盘组件" onClick={()=>this.openDrawer('selectchartdisplay')} />
								<XQIconButton size="small" iconName="sliders" tooltip="相位设置" onClick={()=>this.openDrawer('selectasp')} />
							</div>
								{
									this.props.chartRenderer ? (
										this.props.chartRenderer({
											chartObj,
											height: chartHeight,
											chartStyle: this.props.chartStyle,
										})
									) : (
										<AstroChart value={chartObj}
											chartDisplay={this.props.chartDisplay}
											chartStyle={this.props.chartStyle}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										aspects={this.props.aspects}
										showAstroMeaning={this.props.showAstroMeaning}
										height="100%"
									/>
									)
								}
						</div>
						<AstroContentPanel
							value={chartObj}
							fields={fields}
							tabHeight={tabHeight}
							showlots={showlots}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
							voidClassical={this.props.voidClassical}
						/>
					</div>
					{this.renderBottomQuickDock()}
				</div>

			</div>
		);
	}

}

export default AstroChartMain;
