import { Component, createRef,  } from 'react';
import { createPortal } from 'react-dom';
import '../comp/DateTime';
import '../comp/DateTimeSelector';
import { planetariumRenderGatingEnabled, planetariumTimeEditDebounceEnabled } from '../../utils/perfFlags';
import { markPanelReady } from '../../utils/perfMark';
import GeoCoordModal from '../amap/GeoCoordModal';
import XQIcon from '../xq-icons';
import { QuickTimeText } from '../comp/QuickTimeField';
import { meanObliquityDeg, localSiderealDeg } from './planetariumProjection';
import './planetariumStarSearch';
import './planetariumStarNames';
import '../../data/sanyuanWalls.json';
import '../../data/constellationLines.json';
import '../../data/constellationBounds.json';
import '../../data/chineseAsterisms.json';
import '../../utils/pageSettingsStore';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)与组件方法(stateFlow · observerControls · playbackControl · viewControls;类后 mixinMethods 挂回原型)按职责拆在 ./babylon/ 下;
// 构造、生命周期、render 与对外导出面仍在本文件。
import { PlanetariumTimeEditor } from './babylon/PlanetariumTimeEditor';
import { STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX, DEFAULT_LAYERS, PLANETARIUM_PAGE_SETTINGS, LAYER_GROUPS, asterismColor } from './babylon/constants';
import { nowMs, inverseRefractionDeg, skyDirectionFromVector, horizontalToEquatorial, equatorialToEcliptic, angularSeparationDeg, observerFromFields } from './babylon/skyMath';
import { formatDeg, formatRa, moonPhaseGlyph } from './babylon/itemText';
import { buildObservationTime, buildRequestParams } from './babylon/sceneParams';
import { PlanetariumRenderer } from './babylon/PlanetariumRenderer';
import { watchChartScript } from '../../utils/chartDrawGuard';
import { XQSlider } from '../xq-ui';
import { mixinMethods } from '../../utils/mixinMethods';
import { stateFlowMethods } from './babylon/stateFlow';
import { observerControlMethods } from './babylon/observerControls';
import { playbackControlMethods } from './babylon/playbackControl';
import { viewControlMethods } from './babylon/viewControls';
// 对外导出面不变:搬进子模块的导出原样重导出
export { PLANETARIUM_PAGE_SETTINGS } from './babylon/constants';

// 右栏「天空」五档中文名(与帮助「昼夜天色」同名);后端/前端 sky.mode 枚举不变。
const SKY_MODE_CN = { day: '白昼', civilTwilight: '民用晨昏', nauticalTwilight: '航海晨昏', astronomicalTwilight: '天文晨昏', night: '夜' };

class PlanetariumBabylon extends Component{
	constructor(props){
		super(props);
		const time = buildObservationTime(props.fields);
		this.state = {
			time,
			data: null,
			selected: null,
			searchQuery: '',
			searchMessage: '',
			leftCollapsed: false,
			immersive: false,
			observerOverride: null,
			loading: false,
			syncing: false,
			syncLabel: '',
			error: null,
			speed: 0,
			viewMode: 'ground',
			layers: {...DEFAULT_LAYERS},
			// 🔴 视角与图层**不在这里**恢复保存值:渲染端按出厂值初始化,天空 / 地面 / 懒建层 / 星官 / 行星轨迹 / 视角切换
			// 这些副作用只挂在 componentDidUpdate 的「变化」分支上。保存值改在挂载末尾用一次 setState 补上(见 componentDidMount),
			// 走与用户亲手点图层同一条路,副作用一个不落;直接塞进初始 state 会出现「按钮显示天球外观、画面仍是地表观测」。
			magLimit: PLANETARIUM_PAGE_SETTINGS.load().magLimit, // 上次亲手设的星等上限(渲染端初始化时即按它建星;没存过 = 4)
			// 默认上限 4(只建/显 mag≤4 的较亮星,开场更快、星空更清爽;可拖到 6.5 看全 8404 星)
			measureMode: false, // 角距测量(默认关)
			measureInfo: null, // 测量结果 { stage, startLabel, endLabel, separation }
			skyReadout: null, // 点击空白天区的坐标读数
			collapsedGroups: new Set(['scales', 'poles']),
			metrics: {
				fps: 0,
				meshes: 0,
				loadMs: 0,
				apiMs: 0,
				renderMs: 0,
				runtimeLoadMs: props.runtimeLoadMs || 0,
				firstReadyMs: 0,
				releaseOk: '--',
				catalogCount: 0,
			},
			perfLog: [],
		};
		this.canvasRef = createRef();
		this.renderer = null;
		this.reqSeq = 0;
		this.requestInFlight = false;
		this.playbackSyncInFlight = false;
		this.sceneSyncInFlight = false;
		this.pendingRequestOptions = null;
		this.playTimer = null;
		this.playbackAnchorMs = 0;
		this.playbackAnchorTime = null;
		this.playbackLastFrameMs = 0;
		this.playbackLastStateMs = 0;
		this.playbackLastMetricMs = 0;
		this.backgroundFullTimer = null;
		this.pendingFullRequest = null;
		this.pendingFullRender = null;
		this.lastInteractionAt = 0;
		this.lastPlaybackSyncAt = 0;
		this.metricTimer = null;
		this.mountedAt = nowMs();
		this.firstReadyLogged = false;
		this.requestState = this.requestState.bind(this);
		this.bootstrapState = this.bootstrapState.bind(this);
		this.markInteraction = this.markInteraction.bind(this);
		this.scheduleBackgroundFull = this.scheduleBackgroundFull.bind(this);
		this.toggleLayer = this.toggleLayer.bind(this);
		this.changeMagLimit = this.changeMagLimit.bind(this);
		this.toggleMeasureMode = this.toggleMeasureMode.bind(this);
		this.changeSpeed = this.changeSpeed.bind(this);
		this._onPlaybackKeyDown = this._onPlaybackKeyDown.bind(this);
		this._onPlaybackKeyUp = this._onPlaybackKeyUp.bind(this);
		this._onPlaybackPointerDown = this._onPlaybackPointerDown.bind(this);
		this._focusByKeyboard = false;
		this._pageRef = createRef();
		this.lastPlaySpeed = 0;   // 空格键恢复播放用:最近一次非零速率(从没播过 = 0 → 按 1x 起)
		this.jumpNow = this.jumpNow.bind(this);
		this.toggleImmersive = this.toggleImmersive.bind(this);
		this.searchTarget = this.searchTarget.bind(this);
		this.setSearchQuery = this.setSearchQuery.bind(this);
		this.stepTime = this.stepTime.bind(this);
		this.toggleLeftPanel = this.toggleLeftPanel.bind(this);
		this.changeViewMode = this.changeViewMode.bind(this);
		this.changeObserverGeo = this.changeObserverGeo.bind(this);
		this.clearObserverOverride = this.clearObserverOverride.bind(this);
		this.changeObserverTime = this.changeObserverTime.bind(this);
		this.toggleTimeEditor = this.toggleTimeEditor.bind(this);
		this.quickCommitObserverTime = this.quickCommitObserverTime.bind(this);
		this._onTimeEditorDocMouseDown = this._onTimeEditorDocMouseDown.bind(this);
		this._timeEditorRef = createRef();
		this._timeDisplayRef = createRef();
	}

	componentDidMount(){
		this._isUnmounted = false;
		// 进/出全屏后浏览器改了视口尺寸，但 Babylon 引擎不会自动重算 canvas → 画面不铺满（即「全屏按钮失效」真因）。
		// 监听 fullscreenchange，进/出全屏都触发 engine.resize()（延后一帧等布局稳定）。
		this._onFullscreenChange = ()=>{
			setTimeout(()=>{
				if(this.renderer && this.renderer.engine){
					this.renderer.engine.resize();
				}
			}, 60);
		};
		document.addEventListener('fullscreenchange', this._onFullscreenChange);
		document.addEventListener('keydown', this._onPlaybackKeyDown, true);
		document.addEventListener('keyup', this._onPlaybackKeyUp, true);
		document.addEventListener('pointerdown', this._onPlaybackPointerDown, true);
		document.addEventListener('mousedown', this._onPlaybackPointerDown, true);
		this.renderer = new PlanetariumRenderer(
			this.canvasRef.current,
			(selected)=>{ if(this._isUnmounted){ return; } this.setState({ selected, skyReadout: null }); },
			(metrics)=>{
				if(!this.metricTimer){
					this.metricTimer = setTimeout(()=>{
						this.metricTimer = null;
						if(this._isUnmounted){ return; }
						this.setState((prev)=>({
							metrics: {
								...prev.metrics,
								...metrics,
							},
						}));
					}, 500);
				}
			},
			this.markInteraction,
		);
		// 界面简繁切换:标签字画在纹理上,重画全部标签(场景逐帧渲染)
		this._detachScript = watchChartScript(()=>{ if(this.renderer && typeof this.renderer.repaintTextLabels === 'function'){ this.renderer.repaintTextLabels(); } });
		// 角距测量结果 + 空白天区读坐标 回调(纯前端派生,不触后端)。
		this.renderer.onMeasure = (info)=>{ if(this._isUnmounted){ return; } this.setState({ measureInfo: info }); };
		this.renderer.onSkyReadout = (readout)=>{ if(this._isUnmounted){ return; } this.setState({ skyReadout: readout, selected: null }); };
		this.renderer.setMagLimit(this.state.magLimit);
		// 恢复上次亲手设的图层 / 视角:与出厂值不同才补一次 setState → 走 componentDidUpdate 的既有「变化」分支(渲染端副作用齐全)。
		// 这不是用户操作,不经 toggleLayer / changeViewMode,所以不会反过来再落盘。
		const savedView = PLANETARIUM_PAGE_SETTINGS.load();
		const restore = {};
		if(Object.keys(DEFAULT_LAYERS).some((k)=>savedView.layers[k] !== DEFAULT_LAYERS[k])){ restore.layers = { ...DEFAULT_LAYERS, ...savedView.layers }; }
		if(savedView.viewMode !== this.state.viewMode){ restore.viewMode = savedView.viewMode; }
		if(Object.keys(restore).length){ this.setState(restore); }
		// perf:planetariumRenderGating —— 窗口隐藏/最小化时暂停 Babylon 渲染循环(可见时一字不动);恢复即重绘实况帧。
		this._onVisibility = ()=>{ this._applyRenderActivity(); };
		document.addEventListener('visibilitychange', this._onVisibility);
		this.bootstrapState();
		this._applyRenderActivity();
	}

	componentDidUpdate(prevProps, prevState){
		if(prevState.layers !== this.state.layers && this.renderer){
			this.renderer.setLayers(this.state.layers);
			// 大气层开关切换:重画天空(关→纯黑真空/白天也黑、无地平辉光;开→恢复昼夜天空)+ 重投影(关折射后星体回真高度)。
			if(prevState.layers.atmosphere !== this.state.layers.atmosphere){
				this.renderer.refreshSky();
			}
			// 地面开关切换:按当前模式重算地面显隐(关→地表观测下可见地平线以下整个天球)。
			if(prevState.layers.ground !== this.state.layers.ground){
				this.renderer.refreshGroundLayer();
			}
			// 🚀 默认关贵图层:某层刚开 → 懒建该层(内部只建已开未建者;随后 4112 重投影定位、applyLayerVisibility 显隐)。
			this.renderer._buildOffLayers(false);
			// 星官(312)层刚打开且尚未建 → 懒构建一次(默认关不建省开场;此处补建,随后重投影定位、applyLayerVisibility 显隐)。
			// 数据还没到(刚挂载、从保存值恢复出「星官开」)时不在这里建:观测者是空的,建出来的 312 组会在首份数据到达时
			// 被 clearDynamicData 整个拆掉重建,开场白建一遍;首份数据的 updateData 本来就会按当前开关建。
			if(this.state.layers.xingguan && !prevState.layers.xingguan && this.renderer.lastData){
				this.renderer.ensureChineseAsterismsBuilt();
			}
			// 🔴 切换图层后必须立即按当前时刻重投影:性能守卫会跳过隐藏层的重投影,使其停在旧时刻位置;
			// 重新打开时若不重算,就会与一直可见的图层错位(如二十八宿点 vs 宿区间)。一次重算消除所有此类错位。
			this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields(), this.refractionActiveState());
			// 行星轨迹层刚打开且当前数据无 trails → 触发一次带 includeTrails 的全量重取(默认关、不开不取 → 零额外请求)。
			if(this.state.layers.planetTrails && !prevState.layers.planetTrails && !(this.state.data && Array.isArray(this.state.data.trails) && this.state.data.trails.length)){
				this.requestState({ requestKind: 'full', reason: 'planet-trails', syncLabel: '计算行星轨迹...' });
			}
		}
		if(prevState.speed !== this.state.speed){
			this.setupPlayback();
			// perf:planetariumRenderGating —— 播放中恒满帧;停播时回落到静止降帧。
			if(this.renderer){ this.renderer.setPlaying(this.state.speed !== 0); }
		}
		if(prevState.viewMode !== this.state.viewMode && this.renderer){
			this.renderer.setViewMode(this.state.viewMode);
			// ① 切换地表观测/天球外观后立即重投影:天球外观去大气折射(几何原貌),地表观测带折射。显式传 override,不等相机动画。
			this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields(), this.refractionActiveState());
		}
		if(prevProps.fields !== this.props.fields){
			const time = buildObservationTime(this.props.fields);
			this.playbackLastFrameTime = null;   // 换了时刻:上次播放 / 暂停那一帧作废(见 setupPlayback 暂停分支)
			this.setState({
				time,
				selected: null,
				speed: 0,
			}, ()=>this.applyFastSceneChange('fields'));
		}
	}

	componentWillUnmount(){
		this._isUnmounted = true;
		if(this._detachScript){ this._detachScript(); this._detachScript = null; }
		document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		document.body.classList.remove('planetarium-time-editing');
		document.removeEventListener('keydown', this._onPlaybackKeyDown, true);
		document.removeEventListener('keyup', this._onPlaybackKeyUp, true);
		document.removeEventListener('pointerdown', this._onPlaybackPointerDown, true);
		document.removeEventListener('mousedown', this._onPlaybackPointerDown, true);
		if(this._onFullscreenChange){
			document.removeEventListener('fullscreenchange', this._onFullscreenChange);
			this._onFullscreenChange = null;
		}
		if(this._onVisibility){
			document.removeEventListener('visibilitychange', this._onVisibility);
			this._onVisibility = null;
		}
		if(this._timeEditDebounce){
			clearTimeout(this._timeEditDebounce);
			this._timeEditDebounce = null;
		}
		this.pushPerfLog('release', { canvasReleased: true });
		if(this.playTimer){
			cancelAnimationFrame(this.playTimer);
			this.playTimer = null;
		}
		if(this.metricTimer){
			clearTimeout(this.metricTimer);
			this.metricTimer = null;
		}
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		if(this.renderer){
			this.renderer.dispose();
			this.renderer = null;
		}
	}

	render(){
		const { metrics, data } = this.state;
		const sky = data && data.sky ? data.sky : {};
		const moonPhase = sky.moonPhase;
		const effectiveFields = this.getEffectiveFields();
		const observerName = this.state.observerOverride
			? this.state.observerOverride.label
			: (data && data.observer ? data.observer.locationName : '未命名地点');
		const observerLon = effectiveFields && effectiveFields.lon ? effectiveFields.lon.value : '--';
		const observerLat = effectiveFields && effectiveFields.lat ? effectiveFields.lat.value : '--';
		const observerGpsLon = effectiveFields && effectiveFields.gpsLon ? effectiveFields.gpsLon.value : null;
		const observerGpsLat = effectiveFields && effectiveFields.gpsLat ? effectiveFields.gpsLat.value : null;
		const sceneJd = this.state.time.jdn || this.state.time.calcJdn();
		const sceneObs = observerFromFields(effectiveFields, data);
		const sceneLst = formatRa(localSiderealDeg(sceneJd, sceneObs.lon));
		const sceneEps = formatDeg(meanObliquityDeg(sceneJd));
		return (
			<div ref={this._pageRef} className={`horosa-planetarium-page ${this.state.leftCollapsed ? 'is-left-collapsed' : ''} ${this.state.immersive ? 'is-immersive' : ''}`}>
				<aside className="planetarium-side planetarium-left">
					<div className="planetarium-title">
						<small>地表观测天空</small>
						<h2>天文馆</h2>
						<button type="button" className="planetarium-collapse" onClick={this.toggleLeftPanel} aria-label={this.state.leftCollapsed ? '展开' : '收合'}>
							<XQIcon name="prev" />
						</button>
					</div>
					<div className="planetarium-time" style={{ position: 'relative' }}>
						<QuickTimeText innerRef={this._timeDisplayRef} className={`planetarium-time-display${this.state.timeEditorOpen ? ' is-editing' : ''}`} role="button" title="点击修改时间；双击可直接键入 14 位数字（年月日时分秒）" onClick={this.toggleTimeEditor} value={this.state.time} onQuickCommit={this.quickCommitObserverTime}>{this.state.time.format('YYYY-MM-DD HH:mm:ss')}</QuickTimeText>
						{/* 面板挂到 body:留在左栏里会被左栏的滚动合成层按栏宽裁掉(WebKit 实机;重绘式截图看不出来,要看真合成)。 */}
						{this.state.timeEditorOpen && typeof document !== 'undefined' && document.body ? createPortal(
							<div ref={this._timeEditorRef} className="planetarium-time-editor" style={this.state.timeEditorPos ? { top: this.state.timeEditorPos.top, left: this.state.timeEditorPos.left } : undefined}>
								<PlanetariumTimeEditor time={this.state.time} onChange={this.changeObserverTime} />
							</div>,
							document.body
						) : null}
						<small>{this.state.time.zone} · {observerName}</small>
						<div className="planetarium-observer-line">
							<span>{observerLon} · {observerLat}</span>
							{observerGpsLon !== null && observerGpsLat !== null ? <em>GPS {Number(observerGpsLon).toFixed(4)}, {Number(observerGpsLat).toFixed(4)}</em> : null}
						</div>
						<div className="planetarium-observer-actions">
							<GeoCoordModal
								onOk={this.changeObserverGeo}
								lat={observerGpsLat}
								lng={observerGpsLon}
							>
								<button type="button">经纬度选择</button>
							</GeoCoordModal>
							<button type="button" onClick={this.clearObserverOverride} disabled={!this.state.observerOverride}>回命盘地点</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">定位</div>
						<div className="planetarium-search">
							<input value={this.state.searchQuery} onChange={this.setSearchQuery} onKeyDown={(e)=>{ if(e.key === 'Enter'){ this.searchTarget(); } }} placeholder="月亮、木星、北斗、角宿..." />
							<button type="button" onClick={this.searchTarget}>定位</button>
						</div>
						{this.state.searchMessage ? <div className="planetarium-hint">{this.state.searchMessage}</div> : null}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">观察模式</div>
						<div className="planetarium-view-grid">
							<button type="button" className={this.state.viewMode === 'ground' ? 'is-active' : ''} onClick={()=>this.changeViewMode('ground')}>地表观测</button>
							<button type="button" className={this.state.viewMode === 'orbit' ? 'is-active' : ''} onClick={()=>this.changeViewMode('orbit')}>天球外观</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">显示</div>
						<div className="planetarium-mag-filter">
							<div className="planetarium-mag-head">
								<span>星等上限</span>
								<b>{Number(this.state.magLimit).toFixed(1)}</b>
							</div>
							{/* 滑块只管恒星层(缺省关):关着时拖动画面不变 → 置灰并给一键开恒星,不再让人以为滑块是坏的 */}
							<div title={this.state.layers.stars ? undefined : '恒星层未开:开启恒星后生效'} data-mag-limit-disabled={this.state.layers.stars ? '0' : '1'}>
								<XQSlider
									className="planetarium-mag-slider"
									min={STAR_MAG_LIMIT_MIN}
									max={STAR_MAG_LIMIT_MAX}
									step={0.1}
									value={this.state.magLimit}
									onChange={this.changeMagLimit}
									disabled={!this.state.layers.stars}
									ariaLabelForHandle="星等上限"
								/>
							</div>
							<div className="planetarium-mag-scale"><span>亮 {STAR_MAG_LIMIT_MIN.toFixed(1)}</span><span>暗 {STAR_MAG_LIMIT_MAX.toFixed(1)}</span></div>
							{!this.state.layers.stars ? (
								<div className="planetarium-hint" data-mag-limit-hint="1">恒星层未开,星等上限暂不生效 · <button type="button" className="planetarium-inline-link" onClick={()=>this.toggleLayer('stars')}>开启恒星</button></div>
							) : null}
						</div>
						<div className="planetarium-view-grid">
							<button type="button" className={this.state.measureMode ? 'is-active' : ''} onClick={this.toggleMeasureMode}>{this.state.measureMode ? '角距测量·开' : '角距测量'}</button>
							<button type="button" onClick={this.toggleImmersive}>{this.state.immersive ? '退出沉浸' : '全屏'}</button>
						</div>
						{this.state.measureMode ? <div className="planetarium-hint">依次点选两点(天体或天区方向)即得球面角距，再点重置</div> : null}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">时间播放</div>
						<div className="planetarium-speed-grid">
							<button type="button" className={this.state.speed === 1 ? 'is-active' : ''} onClick={()=>this.changeSpeed(1)}>1x</button>
							<button type="button" className={this.state.speed === 60 ? 'is-active' : ''} onClick={()=>this.changeSpeed(60)}>60x</button>
							<button type="button" className={this.state.speed === 360 ? 'is-active' : ''} onClick={()=>this.changeSpeed(360)}>360x</button>
							<button type="button" className={this.state.speed === 1000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(1000)}>1000x</button>
							<button type="button" className={this.state.speed === 3600 ? 'is-active' : ''} onClick={()=>this.changeSpeed(3600)}>3600x</button>
							<button type="button" className={this.state.speed === 10000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(10000)}>10000x</button>
							<button type="button" className={this.state.speed === 86400 ? 'is-active' : ''} onClick={()=>this.changeSpeed(86400)}>日进</button>
							<button type="button" className={this.state.speed === 2592000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(2592000)}>月进</button>
							<button type="button" className={this.state.speed === 31536000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(31536000)}>年进</button>
						</div>
						<div className="planetarium-speed-grid planetarium-speed-grid-rev">
							<button type="button" className={this.state.speed === -1 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-1)}>-1x</button>
							<button type="button" className={this.state.speed === -60 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-60)}>-60x</button>
							<button type="button" className={this.state.speed === -360 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-360)}>-360x</button>
							<button type="button" className={this.state.speed === -1000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-1000)}>-1000x</button>
							<button type="button" className={this.state.speed === -3600 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-3600)}>-3600x</button>
							<button type="button" className={this.state.speed === -10000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-10000)}>-10000x</button>
							<button type="button" className={this.state.speed === -86400 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-86400)}>日退</button>
							<button type="button" className={this.state.speed === -2592000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-2592000)}>月退</button>
							<button type="button" className={this.state.speed === -31536000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-31536000)}>年退</button>
						</div>
						<div className="planetarium-actions">
							<button type="button" onClick={this.jumpNow}>回到命盘时间</button>
							<button type="button" className={this.state.speed === 0 ? 'is-active' : ''} title="空格键：暂停 / 回到刚才的速率" onClick={()=>this.changeSpeed(0)}>暂停</button>
						</div>
						<div className="planetarium-step-grid">
							<button type="button" onClick={()=>this.stepTime(-1, 'h')}>-1时</button>
							<button type="button" onClick={()=>this.stepTime(1, 'h')}>+1时</button>
							<button type="button" onClick={()=>this.stepTime(-1, 'd')}>-1日</button>
							<button type="button" onClick={()=>this.stepTime(1, 'd')}>+1日</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title planetarium-layer-head">
							<span>图层</span>
							<span className="planetarium-layer-actions">
								<button type="button" onClick={()=>this.applyPreset()}>对标专业星图</button>
								<button type="button" onClick={()=>this.resetLayers()}>重置</button>
							</span>
						</div>
						{LAYER_GROUPS.map((g)=>{
							const collapsed = this.state.collapsedGroups.has(g.id);
							return (
								<div key={g.id} className={`planetarium-subgroup ${collapsed ? 'is-collapsed' : ''}`}>
									<button
										type="button"
										className="planetarium-subgroup-header"
										onClick={()=>this.toggleGroup(g.id)}
										aria-expanded={!collapsed}
									>
										<span>{g.title}</span>
										<span className="chevron" aria-hidden="true">▾</span>
									</button>
									<div className="planetarium-layer-grid">
										{g.chips.map(([k, l])=>this.renderLayerButton(k, l, g.legend && g.legend[k]))}
									</div>
								</div>
							);
						})}
					</div>
				</aside>
				<main className="planetarium-stage">
					<canvas ref={this.canvasRef} className="planetarium-canvas" />
					<div className="planetarium-scene-readout">
						<span>JD<b>{Number(sceneJd).toFixed(3)}</b></span>
						<span>LST<b>{sceneLst}</b></span>
						<span>ε<b>{sceneEps}</b></span>
					</div>
					<div className="planetarium-scene-readout planetarium-scene-readout-tr">
						<span>FPS<b>{metrics.fps}</b></span>
						<span>网格<b>{metrics.meshes}</b></span>
						<span>载入<b>{metrics.loadMs}ms</b></span>
						<span>接口<b>{metrics.apiMs}ms</b></span>
						<span>渲染<b>{metrics.renderMs}ms</b></span>
						<span>首次<b>{metrics.firstReadyMs}ms</b></span>
						<span>Babylon<b>{metrics.runtimeLoadMs}ms</b></span>
					</div>
					{this.state.immersive ? (
						<button type="button" className="planetarium-immersive-exit" onClick={this.toggleImmersive} aria-label="退出沉浸">
							<XQIcon name="prev" /><span>退出沉浸</span>
						</button>
					) : null}
					{this.state.syncing ? <div className="planetarium-status is-syncing">{this.state.syncLabel || '更新天空...'}</div> : null}
					{this.state.error ? <div className="planetarium-status is-error">{this.state.error}</div> : null}
				</main>
				<aside className="planetarium-side planetarium-right">
					<div className="planetarium-section">
						<div className="planetarium-section-title">观测状态</div>
						<div className="planetarium-metrics">
							<div><span>恒星</span><strong>{metrics.catalogCount}</strong></div>
							{/* 右栏此前直接显示 day / civilTwilight 等英文枚举;译为中文五档(与帮助「昼夜天色」同名)。 */}
							<div><span>天空</span><strong>{SKY_MODE_CN[sky.mode] || sky.mode || '--'}</strong></div>
							<div><span>太阳高度</span><strong>{formatDeg(sky.sunAltitude)}</strong></div>
							<div><span>月相</span><strong>{moonPhase ? `${moonPhaseGlyph(moonPhase)} ${moonPhase.phaseName}` : '--'}</strong></div>
							<div><span>黄赤交角</span><strong>{sceneEps}</strong></div>
							<div><span>本地恒星时</span><strong>{sceneLst}</strong></div>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">天体详情</div>
						{this.renderMeasure()}
						{this.renderSkyReadout()}
						{this.renderSelected()}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">性能日志</div>
						<div className="planetarium-perf-log">
							{(this.state.perfLog || []).map((item, idx)=>(
								<div key={`${item.event}-${idx}`}>
									<span>{item.event}</span>
									<strong>{item.totalMs || item.apiMs || item.renderMs || 0} ms</strong>
								</div>
							))}
						</div>
					</div>
				</aside>
			</div>
		);
	}
}
mixinMethods(PlanetariumBabylon, stateFlowMethods, observerControlMethods, playbackControlMethods, viewControlMethods);   // 方法按职责拆在 ./babylon/ 下(见各文件头),挂回原型

// 纯天文坐标反算辅助(无 BABYLON/DOM 依赖)导出,供单元测试钉死正向/逆向往返一致性。
// 另导出星官配色器 + 升落/轨迹参数构造器,钉死配色方案与「默认零回归」(不传 include* 时请求体字节不变)。
export {
	inverseRefractionDeg,
	horizontalToEquatorial,
	equatorialToEcliptic,
	skyDirectionFromVector,
	angularSeparationDeg,
	STAR_MAG_LIMIT_MIN,
	STAR_MAG_LIMIT_MAX,
	asterismColor,
	buildRequestParams,
};

export default PlanetariumBabylon;
