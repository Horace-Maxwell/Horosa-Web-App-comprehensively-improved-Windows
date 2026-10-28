import { Component, createRef,  } from 'react';
import '../comp/DateTime';
import '../comp/DateTimeSelector';
import { planetariumRenderGatingEnabled, planetariumTimeEditDebounceEnabled } from '../../utils/perfFlags';
import { markPanelReady } from '../../utils/perfMark';
import { fetchPlanetariumState } from '../../services/planetarium';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import XQIcon from '../xq-icons';
import { QuickTimeText } from '../comp/QuickTimeField';
import { projectedEquatorialItem, meanObliquityDeg, localSiderealDeg, hourAngleDeg, riseTransitSet,  } from './planetariumProjection';
import './planetariumStarSearch';
import './planetariumStarNames';
import '../../data/sanyuanWalls.json';
import '../../data/constellationLines.json';
import '../../data/constellationBounds.json';
import '../../data/chineseAsterisms.json';
import { fixedPopupFrame,  } from '../../utils/zoomDomain';
import '../../utils/pageSettingsStore';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)按职责拆在 ./babylon/ 下;组件本体与对外导出面仍在本文件。
import { PlanetariumTimeEditor } from './babylon/PlanetariumTimeEditor';
import {
	PLANETARIUM_PERF_KEY, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX, DEFAULT_LAYERS, PLANETARIUM_PAGE_SETTINGS,
	LAYER_GROUPS, PROFESSIONAL_LAYERS, asterismColor,
} from './babylon/constants';
import {
	nowMs, clamp, CALIB_SIM_GAP_DAYS, CALIB_MIN_WALL_MS, inverseRefractionDeg, skyDirectionFromVector,
	horizontalToEquatorial, equatorialToEcliptic, angularSeparationDeg, observerFromFields,
} from './babylon/skyMath';
import {
	formatDeg, formatRa, formatHourAngle, valuePresent, bodyName, bodyEnglishName, catalogIdText,
	detailRowsForItem, moonPhaseGlyph,
} from './babylon/itemText';
import {
	buildObservationTime, starLimitForMag, buildRequestParams, buildInitialSceneParams, buildPlaybackSyncParams,
	buildSceneSyncParams, cachePlanetariumState, getCachedPlanetariumState, cachedStateMatches,
} from './babylon/sceneParams';
import { PlanetariumRenderer } from './babylon/PlanetariumRenderer';
import { watchChartScript } from '../../utils/chartDrawGuard';
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
			this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields(), this.refractionActiveState());
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
			this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields(), this.refractionActiveState());
		}
		if(prevProps.fields !== this.props.fields){
			const time = buildObservationTime(this.props.fields);
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

	markInteraction(){
		this.lastInteractionAt = nowMs();
	}

	// perf:planetariumRenderGating —— 依「可见 + 激活」决定渲染循环停/起。
	// 本组件仅在天文馆为激活 tab 时挂载(切走即卸载释放),故此处实质门控的是窗口隐藏/最小化;
	// 可见+激活时:照常满帧/降帧渲染,行为一字不动。
	_applyRenderActivity(){
		if(!this.renderer){
			return;
		}
		const gate = planetariumRenderGatingEnabled();
		const hidden = (typeof document !== 'undefined') && document.hidden;
		const shouldRun = gate ? ((this.props.active !== false) && !hidden) : true;
		if(shouldRun){
			this.renderer.startRenderLoop();
			this.renderer.renderOnce();
		}else{
			this.renderer.stopRenderLoop();
		}
	}

	scheduleBackgroundFull(options = {}){
		if(this._isUnmounted){
			return;
		}
		this.pendingFullRequest = {
			showLoading: false,
			requestKind: 'full',
			reason: options.reason || 'background-full',
			syncLabel: options.syncLabel || '补全天空...',
		};
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		const waitMs = Math.max(1800, 3200 - (nowMs() - this.lastInteractionAt));
		this.backgroundFullTimer = setTimeout(()=>{
			this.backgroundFullTimer = null;
			if(this._isUnmounted || !this.pendingFullRequest){
				return;
			}
			if(nowMs() - this.lastInteractionAt < 1400){
				this.scheduleBackgroundFull(this.pendingFullRequest);
				return;
			}
			const request = this.pendingFullRequest;
			this.pendingFullRequest = null;
			this.requestState(request);
		}, waitMs);
	}

	schedulePendingFullRender(){
		if(this._isUnmounted || !this.pendingFullRender){
			return;
		}
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		const waitMs = Math.max(1200, 2200 - (nowMs() - this.lastInteractionAt));
		this.backgroundFullTimer = setTimeout(()=>{
			this.backgroundFullTimer = null;
			if(this._isUnmounted || !this.pendingFullRender){
				return;
			}
			if(nowMs() - this.lastInteractionAt < 1200){
				this.schedulePendingFullRender();
				return;
			}
			const pending = this.pendingFullRender;
			this.pendingFullRender = null;
			this.finishStateData(pending);
		}, waitMs);
	}

	finishStateData(payload){
		const { data, requestKind, started, apiMs, followupFull } = payload || {};
		if(!data || this._isUnmounted){
			this.requestInFlight = false;
			return;
		}
		let renderMs = 0;
		if(this.renderer){
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			// Re-project immediately through the SAME frontend pipeline that playback
			// and calibration use, so the paused frame == the first animated frame.
			// Previously the initial draw kept backend (swisseph) alt/az while playback
			// recomputed alt/az on the frontend, so labels sat off their lines and every
			// line/star snapped on the first play frame. (renderCachedState already does this.)
			renderMs += this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields()) || 0;
		}
		if(requestKind === 'full'){
			cachePlanetariumState(data);
		}
		const firstReadyMs = this.firstReadyLogged ? this.state.metrics.firstReadyMs : Math.round(nowMs() - this.mountedAt);
		this.firstReadyLogged = true;
		this.pushPerfLog(requestKind === 'light' ? 'light-ready' : 'state-ready', {
			apiMs,
			renderMs,
			totalMs: Math.round(nowMs() - started),
			stars: data.meta ? data.meta.renderedCatalogCount : 0,
			skyMode: data.sky ? data.sky.mode : undefined,
		});
		this.setState((prev)=>({
			data,
			loading: false,
			syncing: !!followupFull,
			syncLabel: followupFull ? '补全天空...' : '',
			error: null,
			metrics: {
				...prev.metrics,
				loadMs: Math.round(nowMs() - started),
				apiMs,
				renderMs,
				firstReadyMs,
				catalogCount: data.meta ? data.meta.renderedCatalogCount : 0,
			},
		}), ()=>{
			// horosa_panel_ready_v1:数据已应用到 3D 场景与右栏,本次提交即「点击→画完」终点。
			// 播放帧的 setState({time}) 不经此路,不会刷样本;归属键=页签键 'planetarium'。
			markPanelReady('planetarium');
			this.requestInFlight = false;
			this.flushPendingRequest();
			if(followupFull && !this._isUnmounted){
				this.scheduleBackgroundFull({
					reason: 'background-full',
					syncLabel: '补全天空...',
				});
			}
			// 第三阶段·后台补全完整星表:本次取的是亮集(starLimitForMag<9000)时,亮集已渲染(默认星等显示已完整),
			// 置 _starsWantFull → 后续 full 皆取完整,并后台补拉一次完整 8404 供搜索/拖滑块;_starsWantFull 守卫不重复触发。
			if(requestKind === 'full' && !this._starsWantFull && starLimitForMag(this.state.magLimit) < 9000 && !this._isUnmounted){
				this._starsWantFull = true;
				this.scheduleBackgroundFull({ reason: 'star-complete', syncLabel: '补全恒星…' });
			}
		});
	}

	bootstrapState(){
		const cached = getCachedPlanetariumState();
		if(cached && this.renderer){
			this.renderCachedState(cached);
			// 缓存时刻 / 观测点与当前不符 → 星表照用,天象(日月行星 / 天空 / 事件 / 宫位)立即按当前时刻地点重取(T-202)。
			if(!cachedStateMatches(cached, this.state.time, this.getEffectiveFields())){
				this.requestSceneCalibration(this.state.time, 'cache-stale');
			}
			return;
		}
		if(this.renderer){
			this.renderer.createCardinals();
		}
		this.requestState({
			requestKind: 'light',
			reason: 'initial-light',
			syncLabel: '准备基础天空...',
			followupFull: true,
		});
	}

	renderCachedState(data){
		const started = nowMs();
		let renderMs = 0;
		if(this.renderer){
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			renderMs += this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields()) || 0;
		}
		const firstReadyMs = this.firstReadyLogged ? this.state.metrics.firstReadyMs : Math.round(nowMs() - this.mountedAt);
		this.firstReadyLogged = true;
		this.pushPerfLog('cache-ready', {
			renderMs,
			totalMs: Math.round(nowMs() - started),
			stars: data.meta ? data.meta.renderedCatalogCount : 0,
		});
		this.setState((prev)=>({
			data,
			loading: false,
			syncing: false,
			syncLabel: '',
			error: null,
			metrics: {
				...prev.metrics,
				loadMs: Math.round(nowMs() - started),
				renderMs,
				firstReadyMs,
				catalogCount: data.meta ? data.meta.renderedCatalogCount : 0,
			},
		}));
		// 缓存可能是上次中途离开留下的亮集:若不完整(渲染星数明显少于完整 8404),后台补全完整星表供搜索/拖滑块。
		if(!this._starsWantFull && data && data.meta && Number(data.meta.renderedCatalogCount) > 0
			&& Number(data.meta.renderedCatalogCount) < 5000 && !this._isUnmounted){
			this._starsWantFull = true;
			this.scheduleBackgroundFull({ reason: 'star-complete-cache', syncLabel: '补全恒星…' });
		}
	}

	pushPerfLog(event, extra = {}){
		const row = {
			event,
			at: new Date().toISOString(),
			...extra,
		};
		if(typeof window !== 'undefined'){
			window[PLANETARIUM_PERF_KEY] = window[PLANETARIUM_PERF_KEY] || [];
			window[PLANETARIUM_PERF_KEY].push(row);
		}
		if(this._isUnmounted){
			return;
		}
		this.setState((prev)=>({
			perfLog: [row].concat(prev.perfLog || []).slice(0, 8),
		}));
	}

	getEffectiveFields(){
		const fields = this.props.fields || {};
		const observerOverride = this.state.observerOverride;
		if(!observerOverride){
			return fields;
		}
		return {
			...fields,
			lat: {
				...(fields.lat || { name: ['lat'] }),
				value: observerOverride.lat,
			},
			lon: {
				...(fields.lon || { name: ['lon'] }),
				value: observerOverride.lon,
			},
			gpsLat: {
				...(fields.gpsLat || { name: ['gpsLat'] }),
				value: observerOverride.gpsLat,
			},
			gpsLon: {
				...(fields.gpsLon || { name: ['gpsLon'] }),
				value: observerOverride.gpsLon,
			},
			pos: {
				...(fields.pos || { name: ['pos'] }),
				value: observerOverride.label,
			},
		};
	}

	changeObserverGeo(rec){
		if(!rec){
			return;
		}
		const gpsLat = rec.gpsLat !== undefined && rec.gpsLat !== null ? rec.gpsLat : rec.lat;
		const gpsLon = rec.gpsLng !== undefined && rec.gpsLng !== null ? rec.gpsLng : rec.lng;
		// 选新观测点 → 按新坐标自动校正时区（GeoCoordModal 未手改时区时只传坐标、由上层推断，
		// 与全 App 地点→时区口径一致：ZiWeiInput/NongLi/CnTradition）。rec.zone(手改)优先。
		// setZone 仅改时区标签、保留钟面时刻(绝对时刻随时区差移动);applyFastSceneChange 会按新 time 重算天象。
		// 记住进入时的时区:「回命盘地点」要连时区一起还原(此前只清地点,时区仍是刚选的城市 → 天空比命盘时刻偏 N 小时而时间大字与命盘一模一样)
		const prevZone = this.state.observerOverride && this.state.observerOverride.prevZone ? this.state.observerOverride.prevZone : (this.state.time && this.state.time.zone) || '';
		const time = this.state.time && this.state.time.clone ? this.state.time.clone() : this.state.time;
		if(time && time.setZone){
			try{
				if(rec.zone){
					time.setZone(rec.zone);
				}else{
					const ds = time.format ? time.format('YYYY-MM-DD') : null;
					const z = dstAwareZoneAt(gpsLat, gpsLon, ds);
					if(z && z.offset){ time.setZone(z.offset); }
				}
			}catch(e){ /* 推断失败保留原时区 */ }
		}
		this.setState({
			time,
			observerOverride: {
				lat: convertLatToStr(rec.lat),
				lon: convertLonToStr(rec.lng),
				gpsLat,
				gpsLon,
				// 观测点地名:经纬度查找带回则用其名(城市/区县),否则回退通用「自选观测点」。
				label: (rec && rec.name) ? `${rec.name}` : '自选观测点',
				prevZone,
			},
			selected: null,
			speed: 0,
		}, ()=>this.applyFastSceneChange('observer'));
	}

	clearObserverOverride(){
		if(!this.state.observerOverride){
			return;
		}
		// 连时区一起还原到进入「经纬度选择」前(钟面时刻不动 → 绝对时刻回到命盘时刻)
		const prevZone = this.state.observerOverride.prevZone;
		let time = this.state.time;
		if(prevZone && time && time.setZone && time.zone !== prevZone){
			time = time.clone ? time.clone() : time;
			try{ time.setZone(prevZone); }catch(e){ /* 保留现时区 */ }
		}
		this.setState({
			time,
			observerOverride: null,
			selected: null,
			speed: 0,
		}, ()=>this.applyFastSceneChange('observer-reset'));
	}

	// 🆕 手动改时间(点开 DateTimeSelector 弹框 → 确定后跳到该时刻重算天象)。
	// 先 speed:0 暂停(走 setupPlayback 既有暂停路径,避免改时间后跳变)+ selected:null,
	// 再 applyFastSceneChange('time') 离散重算整盘+右栏(与 changeObserverGeo 同路径)。
	changeObserverTime(res){
		const dt = (res && res.value && res.value.clone) ? res.value.clone() : (res && res.value) || null;
		if(!dt){ return; }
		if(typeof dt.calcJdn === 'function'){ try{ dt.calcJdn(); }catch(e){ /* 保留现值 */ } }
		// 🔴 改时间=「离散大跳」(可达上千年)。两件事都必须做,否则星体被外推到乱位(太阳脱离黄道):
		//  ① 重置外推基线:`updateProjectedTime` 永远按 `_baseLon + speed×(jd − _calibJd)` 外推;_calibJd 仍停在
		//     旧时刻 → 大跳后 dtJd 达数十万天 → 即便重取真实 _baseLon 也被巨 dtJd 乘乱。置 _calibJd=null(下次
		//     渲染重设为新 jd → dtJd=0=零外推)+ 清各 body _baseLon/_baseLat(重锚到新真实位置)。
		//  ② requestState 全量重取后端真实位置(buildRequestParams 用 this.state.time=dt),而非 applyFastSceneChange 外推。
		if(this.renderer){
			this.renderer._calibJd = null;
			const meshes = this.renderer.projectableMeshes || [];
			meshes.forEach((item)=>{ if(item && item.source){ item.source._baseLon = undefined; item.source._baseLat = undefined; } });
		}
		// speed:0 暂停 + selected:null;面板只在「确定」时关。requestState 内置 in-flight 合并,连改字段也安全。
		if(res && res.confirmed){
			document.body.classList.remove('planetarium-time-editing');
			document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		}
		const confirmed = !!(res && res.confirmed);
		const fireRequest = ()=>{
			if(this._isUnmounted){ return; }
			this.requestState({ requestKind: 'full', reason: 'time-edit', syncLabel: '重算此时天空...' });
		};
		this.setState({
			time: dt,
			selected: null,
			speed: 0,
			...(confirmed ? { timeEditorOpen: false } : {}),
		}, ()=>{
			// C 去抖:显示与外推基线已同步更新(即时实时);只把「后端整盘重算」合并 —— 连续 +/- 期间不重复打后端,
			//   「确定」或关总开关 → 立即重算。requestState 触发时读当下 this.state.time(=最后一次 setState 的值)→
			//   最终结果精确无误,只是省掉中间多余的来回与 syncing 闪烁(不改任何计算内容)。
			if(this._timeEditDebounce){ clearTimeout(this._timeEditDebounce); this._timeEditDebounce = null; }
			if(confirmed || !planetariumTimeEditDebounceEnabled()){
				fireRequest();
			}else{
				this._timeEditDebounce = setTimeout(()=>{ this._timeEditDebounce = null; fireRequest(); }, 220);
			}
		});
	}

	// 双击时间行键入 14 位数字 → 与编辑面板「确定」同路(confirmed=true:暂停播放 + 全量重取该时刻天象)。
	quickCommitObserverTime(dt){
		this.changeObserverTime({ value: dt, confirmed: true });
	}

	// 时间编辑面板:自控开合(不用 antd Popover,避免其受控 click-outside 与嵌套 Select 下拉互相抢闭)。
	toggleTimeEditor(){
		const next = !this.state.timeEditorOpen;
		// 面板用 position:fixed(逃出左栏 overflow:auto 的裁切),坐标按时间显示元素实时算。
		let pos = this.state.timeEditorPos || null;
		if(next && this._timeDisplayRef.current){
			// rect(视觉域)先换到 fixed 面板 style 所在的布局域,再与布局视口 / 面板宽(CSS 尺寸)同域比较;z=1 时逐值不变。
			const frame = fixedPopupFrame();
			const r = frame.rect(this._timeDisplayRef.current.getBoundingClientRect());
			const W = 360;
			let left = r.left;
			if(left + W > frame.viewportWidth - 8){ left = Math.max(8, frame.viewportWidth - 8 - W); }
			pos = { top: Math.round(r.bottom + 6), left: Math.round(left) };
		}
		this.setState({ timeEditorOpen: next, timeEditorPos: pos });
		document.body.classList.toggle('planetarium-time-editing', next);
		if(next){
			// 用 capture + setTimeout 错开本次点击,避免立即触发自己的 outside 判定。
			setTimeout(()=>{ document.addEventListener('mousedown', this._onTimeEditorDocMouseDown, true); }, 0);
		}else{
			document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		}
	}

	_closeTimeEditor(){
		this.setState({ timeEditorOpen: false });
		document.body.classList.remove('planetarium-time-editing');
		document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
	}

	_onTimeEditorDocMouseDown(e){
		const t = e.target;
		if(!t){ return; }
		const inEditor = this._timeEditorRef.current && this._timeEditorRef.current.contains(t);
		const onDisplay = this._timeDisplayRef.current && this._timeDisplayRef.current.contains(t);
		// 点在 antd 下拉(Select/DatePicker 弹层,渲染到 body 的门户)上 → 视为编辑器内交互,不关。
		const inAntdPopup = t.closest && t.closest('.ant-select-dropdown, .xq-select-popup, .ant-picker-dropdown, .rc-virtual-list');
		if(inEditor || onDisplay || inAntdPopup){ return; }
		this._closeTimeEditor();
	}

	setupPlayback(){
		if(this.playTimer){
			cancelAnimationFrame(this.playTimer);
			this.playTimer = null;
		}
		const speed = Number(this.state.speed || 0);
		if(!speed){
			// 🆕 暂停时优先用「真实最后一帧 frame_jd」(playbackLastFrameTime,frame() 每帧记的精确播放时刻)
			// 而非 state.time(落后 0-120ms × prevSpeed,3600x 下可达 432s 模拟 = 月亮 0.06° 跳)。
			// 把 state.time 与 src 字段都对齐到 pauseTime → mesh.position 与右栏数字与用户视觉位置三处完全一致,无瞬移。
			const pauseTime = this.playbackLastFrameTime || this.state.time;
			this.playbackAnchorTime = null;
			this.playbackAnchorMs = 0;
			this.playbackLastFrameMs = 0;
			this.playbackLastStateMs = 0;
			this.playbackLastMetricMs = 0;
			// ⚠ 不清 playbackLastFrameTime!保留它作「暂停瞬间真实时刻」给下次开始播放做 anchor。
			// 之前清掉后,开始播放分支 fallback 用 state.time(落后 0-120ms × prevSpeed,3600x 下 ≈100s 模拟),
			// 帧循环第一帧 next = anchor + 0 = state.time = B 位置 → mesh 瞬间跳到 B → 快速追上 A → 用户看到「先跳到 B 闪一下再回 A」。
			// 改为保留 → 下次播放 anchor = pauseTime(真实瞬间) → 从 A 平滑开始,无任何跳变。
			if(this.renderer && this.state.data){
				this.renderer.updateProjectedTime(pauseTime, this.getEffectiveFields());
			}
			// 🆕 暂停时只 forceUpdate 不 setState({time}) — 因 setState 会触发 React commit → componentDidUpdate → re-render → renderSelected 重算 alt/az → 一连串 setState 链让 state.time 在暂停后被多次改写 → mesh 跳动。
			// state.time 保持 frame() 最后一次 setState({time:next}) 的值(落后 0-120ms),right panel 受这点影响微小(alt/az 偏几度方位角),
			// 但 mesh.position 已 mutate 到 pauseTime 时刻、整个 scene 静止 → 用户视觉上「暂停=完全凝固」是最重要的体验。
			// 同时清掉 _pendingCalib:它含暂停前最后一次 sync 的旧 body 数据,若被后续 flushPendingCalib 合并到 state.data 会让右栏跳回 sync 时刻数据。
			this._pendingCalib = null;
			if(!this._isUnmounted){
				// 🔴 暂停时把 state.time 对齐到真实暂停帧(此前只 forceUpdate,state.time 落后 ≤120ms×速率:月进档 = 3.6 天 →
				// 底栏 JD / 右栏时刻 与场景相差三天,单步、校准都从两套时刻出发)。stepTime 本就 setState({time}),这里同律。
				this.setState({ time: pauseTime && pauseTime.clone ? pauseTime.clone() : pauseTime });
			}
			// 🔴 暂停帧必须是精确帧(T-199/T-200):高速档下最后一次校准可能已陈旧数天(月进档实抓:暂停时月龄差 6.6 天、黄纬差 2°),
			// 暂停后没有帧循环再修正 → 以暂停时刻强制校准一次落地(force:不受「暂停丢在途回包」守卫影响;暂停态不做残差淡出,直接落真值)。
			if(this.renderer && this.state.data){
				this.requestPlaybackCalibration(pauseTime, { force: true, displayTime: pauseTime });
			}
			return;
		}
		this.playbackAnchorMs = nowMs();
		// 🆕 优先用 playbackLastFrameTime(上次暂停瞬间真实时刻)做 anchor — state.time 暂停后落后 0-120ms × prevSpeed,
		// 第一帧推到落后位置 B → 用户看到「点播放瞬间跳回 B 然后跳回 A 继续」。用真实时刻 anchor 无跳变。
		// 首次启动播放(没暂停过): playbackLastFrameTime 不存在,fallback state.time(初次也无差异)。
		const anchorBase = this.playbackLastFrameTime || this.state.time;
		this.playbackAnchorTime = anchorBase.clone ? anchorBase.clone() : anchorBase;
		this.playbackLastFrameTime = null; // 用过即清,下次暂停帧循环重新记录
		this.playbackLastFrameMs = this.playbackAnchorMs;
		this.playbackLastStateMs = this.playbackAnchorMs;
		this.playbackLastMetricMs = this.playbackAnchorMs;
		const frame = ()=>{
			if(this._isUnmounted || Number(this.state.speed || 0) !== speed){
				this.playTimer = null;
				return;
			}
			const frameMs = nowMs();
			const elapsedSeconds = Math.max(0, (frameMs - this.playbackAnchorMs) / 1000);
			const next = this.playbackAnchorTime.clone();
			next.addSecond(speed * elapsedSeconds);
			this.playbackLastFrameTime = next; // 🆕 每帧记真实最新播放时刻(暂停时用这个对齐 mesh+右栏,而非落后 120ms 的 state.time)
			this.applyLocalPlaybackFrame(speed, next, frameMs);
			this.maybeSyncPlayback(speed, next);
			if(frameMs - this.playbackLastStateMs >= 120){
				this.playbackLastStateMs = frameMs;
				// 🚀 有待并校准数据则搭这次 setState({time}) 便车一起更新右栏(无额外重渲);否则只更新时间。
				const pc = this._pendingCalib;
				if(pc){
					this._pendingCalib = null;
					this.setState((prev)=>({ time: next, ...this._mergeCalib(prev, pc) }));
				}else{
					this.setState({ time: next });
				}
			}
			this.playbackLastFrameMs = frameMs;
			this.playTimer = requestAnimationFrame(frame);
		};
		this.playTimer = requestAnimationFrame(frame);
	}

	applyLocalPlaybackFrame(speed, frameTime, frameMs){
		if(!this.renderer || !this.state.data){
			return;
		}
		const renderMs = this.renderer.updateProjectedTime(frameTime || this.state.time, this.getEffectiveFields());
		const metricMs = frameMs || nowMs();
		if(metricMs - this.playbackLastMetricMs >= 500){
			this.playbackLastMetricMs = metricMs;
			this.setState((prev)=>({
				metrics: {
					...prev.metrics,
					renderMs,
					loadMs: 0,
				},
			}));
		}
	}

	maybeSyncPlayback(speed, frameTime){
		const now = nowMs();
		const aspeed = Math.abs(speed); // 反向播放(负速度)也按速率定重取节奏;原 speed<=60 对负值恒真→反向永远落到 15s 慢档
		let syncEvery = aspeed <= 60 ? 15000 : (aspeed <= 86400 ? 7000 : 5000);
		if(this.state.selected && this.state.selected.layer === 'body'){ syncEvery = Math.min(syncEvery, 800); } // 选中体:右栏轨道量随播放更跟手 + 把 calib 间隔(3600x≈50min 模拟)二阶外推误差降到 <0.001°(肉眼绝对不可见)
		// 🔴 T-199:校准节奏加「模拟时间」触发 —— 两次校准间模拟时间 ≥ CALIB_SIM_GAP_DAYS 就再校(受 CALIB_MIN_WALL_MS 与在途守卫约束),
		// 墙钟间隔只作上限。否则日进 / 月进档 15 s 墙钟 = 15 天 / 15 个月模拟时间的线性外推,月亮黄纬能推到 125°。
		const frameJd = frameTime ? (frameTime.jdn || (frameTime.calcJdn && frameTime.calcJdn())) : null;
		const calibJd = this.renderer ? this.renderer._calibJd : null;
		const simGap = (Number.isFinite(frameJd) && Number.isFinite(calibJd)) ? Math.abs(frameJd - calibJd) : 0;
		const simDue = simGap >= CALIB_SIM_GAP_DAYS && (now - this.lastPlaybackSyncAt) >= CALIB_MIN_WALL_MS;
		if(!simDue && now - this.lastPlaybackSyncAt < syncEvery){
			return;
		}
		this.lastPlaybackSyncAt = now;
		this.requestPlaybackCalibration(frameTime);
	}

	// 播放校准数据并入 state 的统一合并器(单步直接 setState / 播放搭 120ms 便车 / 停播放 flush 共用)。
	_mergeCalib(prev, pc){
		return {
			data: {
				...prev.data,
				bodies: pc.bodies || prev.data.bodies,
				sky: pc.sky || prev.data.sky,
				events: pc.events || prev.data.events,
				meta: { ...(prev.data.meta || {}), ...(pc.meta || {}), renderedCatalogCount: prev.data.meta ? prev.data.meta.renderedCatalogCount : 0 },
			},
			metrics: { ...prev.metrics, apiMs: pc.apiMs, renderMs: pc.renderMs },
		};
	}

	flushPendingCalib(){
		const pc = this._pendingCalib;
		if(pc){ this._pendingCalib = null; this.setState((prev)=>this._mergeCalib(prev, pc)); }
	}

	async requestPlaybackCalibration(syncTimeArg, opts){
		if(!this.state.data){
			return;
		}
		// force(单步 ±1 时 / ±1 日 / 暂停帧):暂停态也要把回包落地(T-200)—— 旧写法回包因 !playing 直接丢弃,单步永远只是旧基线线性外推,
		// 右栏黄道坐标 / 宫随外推值、天空 / 太阳高度 / 月相 / 升落全不刷新(连按 +1 日 10 次月亮黄纬 +12.5° vs 真 −0.8°)。
		const force = !!(opts && opts.force);
		if(this.playbackSyncInFlight){
			// 在途的是播放校准(暂停后会被守卫丢弃):把强制请求记下,在途结束后立即补发,否则暂停帧 / 单步帧永远停在陈旧外推值
			if(force){ this._pendingForceCalib = { time: syncTimeArg, opts }; }
			return;
		}
		this.playbackSyncInFlight = true;
		const syncTime = syncTimeArg && syncTimeArg.clone ? syncTimeArg.clone() : this.state.time.clone();
		const apiStarted = nowMs();
		try{
			const rsp = await fetchPlanetariumState(buildPlaybackSyncParams(this.getEffectiveFields(), syncTime, this.planetariumExtras()));
			const data = rsp && rsp.Result ? rsp.Result : rsp;
			if(!data || data.err || this._isUnmounted || !this.renderer){
				return;
			}
			const apiMs = Math.round(nowMs() - apiStarted);
			// 🚀 播放中:apply 跳过冗余重投影(帧循环每帧已做)。单步无帧循环 → 需重投影。
			const playing = Number(this.state.speed || 0) !== 0;
			// 🆕 暂停期间收到 in-flight calibration 响应:完全 abort 不做任何 mutate/setState。
			// 否则 calibration 会重设 _baseLon/_calibJd + updateProjectedTime → src.lon 跳变(用户描述的 A→B 第二次跳)。
			// 暂停时 scene 应该完全锁定:setupPlayback 已 mutate src 到 pauseTime 时刻位置,显示完全正确,不需要后续 sync 数据。
			// 下次开始播放时新 calibration 自然会基于当前 pauseTime 计算 → seamless 衔接,零回归。
			if(!playing && !force){
				return;
			}
			// 🆕 displayTime = 当前 React state.time(单步=stepTime):重投影到当前显示时刻而非 syncTime;暂停帧显式传 pauseTime(state.time 落后 ≤120ms×速率)
			const displayTime = (opts && opts.displayTime && opts.displayTime.clone) ? opts.displayTime.clone() : (this.state.time && this.state.time.clone ? this.state.time.clone() : syncTime);
			const renderMs = this.renderer.applyPlaybackCalibration(data, syncTime, this.getEffectiveFields(), playing, displayTime);
			const pc = { bodies: data.bodies, sky: data.sky, events: data.events, meta: data.meta, apiMs, renderMs };
			if(playing){
				// 🚀 校准已 imperative 修正 3D;右栏数据存为待并项,搭下一次 120ms setState({time}) 便车更新 → 消除每 2.5s 的额外整组件重渲尖峰(实测每次校准帧从 25ms 降到基线)。
				this._pendingCalib = pc;
			}else{
				this.setState((prev)=>this._mergeCalib(prev, pc));
			}
		}finally{
			this.playbackSyncInFlight = false;
			const pf = this._pendingForceCalib;
			this._pendingForceCalib = null;
			if(pf && !this._isUnmounted){ this.requestPlaybackCalibration(pf.time, pf.opts); }
		}
	}

	applyFastSceneChange(reason){
		if(!this.renderer || !this.state.data){
			this.requestState({
				showLoading: false,
				reason,
				requestKind: 'light',
				followupFull: true,
				syncLabel: '更新基础天空...',
			});
			return;
		}
		const renderMs = this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields());
		this.setState((prev)=>({
			syncing: true,
			syncLabel: '后台校准天空...',
			metrics: {
				...prev.metrics,
				renderMs,
				loadMs: 0,
			},
		}));
		this.scheduleBackgroundFull({
			reason,
			syncLabel: '后台校准天空...',
		});
	}

	async requestSceneCalibration(syncTimeArg, reason){
		if(this.sceneSyncInFlight || !this.state.data){
			return;
		}
		this.sceneSyncInFlight = true;
		const syncTime = syncTimeArg && syncTimeArg.clone ? syncTimeArg.clone() : this.state.time.clone();
		const fields = this.getEffectiveFields();
		const apiStarted = nowMs();
		try{
			const rsp = await fetchPlanetariumState(buildSceneSyncParams(fields, syncTime, this.planetariumExtras()));
			const data = rsp && rsp.Result ? rsp.Result : rsp;
			if(!data || data.err || this._isUnmounted || !this.renderer){
				return;
			}
			const apiMs = Math.round(nowMs() - apiStarted);
			let renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			renderMs += this.renderer.updateProjectedTime(syncTime, fields) || 0;
			this.pushPerfLog('scene-sync', {
				reason,
				apiMs,
				renderMs,
				stars: data.meta ? data.meta.renderedCatalogCount : 0,
			});
			this.setState((prev)=>{
				const merged = {
					...prev.data,
					...data,
					stars: prev.data && prev.data.stars ? prev.data.stars : data.stars,
					meta: {
						...(prev.data && prev.data.meta ? prev.data.meta : {}),
						...(data.meta || {}),
						renderedCatalogCount: prev.data && prev.data.meta ? prev.data.meta.renderedCatalogCount : 0,
					},
				};
				return {
					data: merged,
					syncing: false,
					syncLabel: '',
					loading: false,
					metrics: {
						...prev.metrics,
						apiMs,
						renderMs,
					},
				};
			}, ()=>{ cachePlanetariumState(this.state.data); });
		}finally{
			this.sceneSyncInFlight = false;
		}
	}

	async requestState(options = {}){
		const opts = options || {};
		if(this.requestInFlight){
			this.pendingRequestOptions = {
				showLoading: false,
				reason: opts.reason || 'pending',
				requestKind: opts.requestKind || 'full',
				syncLabel: opts.syncLabel,
				followupFull: opts.followupFull,
			};
			return;
		}
		this.requestInFlight = true;
		const seq = ++this.reqSeq;
		const started = nowMs();
		const requestKind = opts.requestKind === 'light' ? 'light' : 'full';
		const showLoading = false;
		const syncLabel = opts.syncLabel || (requestKind === 'light' ? '准备基础天空...' : '补全天空...');
		this.setState({
			loading: showLoading,
			syncing: true,
			syncLabel,
			error: null,
		});
		const extras = this.planetariumExtras();
		const params = requestKind === 'light'
			? buildInitialSceneParams(this.getEffectiveFields(), this.state.time, extras)
			: buildRequestParams(this.getEffectiveFields(), this.state.time, extras);
		const apiStarted = nowMs();
		let rsp = null;
		try{
			rsp = await fetchPlanetariumState(params);
		}catch(err){
			rsp = { err: err && err.message ? err.message : '天文馆数据载入失败' };
		}
		const apiMs = Math.round(nowMs() - apiStarted);
		if(seq !== this.reqSeq){
			this.requestInFlight = false;
			this.flushPendingRequest();
			return;
		}
		const data = rsp && rsp.Result ? rsp.Result : rsp;
		if(this._isUnmounted){
			this.requestInFlight = false;
			return;
		}
		if(!data || data.err){
			this.pushPerfLog('request-error', { apiMs, err: data && data.err ? data.err : 'empty' });
			this.setState({
				loading: false,
				syncing: false,
				syncLabel: '',
				error: data && data.err ? data.err : '天文馆数据载入失败',
			}, ()=>{
				// 错误横幅画出同样终结本次交互(失败终态盖章,与七政各失败终态先例同)。
				markPanelReady('planetarium');
			});
			this.requestInFlight = false;
			this.flushPendingRequest();
			return;
		}
		const payload = {
			data,
			requestKind,
			started,
			apiMs,
			followupFull: opts.followupFull,
		};
		if(requestKind === 'full' && nowMs() - this.lastInteractionAt < 700){
			this.pendingFullRender = payload;
			this.requestInFlight = false;
			this.schedulePendingFullRender();
			return;
		}
		this.finishStateData(payload);
	}

	flushPendingRequest(){
		if(!this.pendingRequestOptions || this._isUnmounted){
			return;
		}
		const opts = this.pendingRequestOptions;
		this.pendingRequestOptions = null;
		setTimeout(()=>this.requestState({
			...opts,
			showLoading: false,
		}), 0);
	}

	// React 侧大气折射判据(与渲染端 refractionActive 同义):地表观测 + 大气层开。
	// 用于显式传 applyRefractionOverride、详情面板视位置计算 —— 关大气层即真空几何(不抬升)。
	refractionActiveState(){
		return this.state.viewMode === 'ground' && !!(this.state.layers && this.state.layers.atmosphere);
	}

	toggleLayer(key){
		this.setState((prev)=>({
			layers: {
				...prev.layers,
				[key]: !prev.layers[key],
			},
		}), ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));   // 用户亲手点的图层 → 整张表落盘
	}

	// 升落/轨迹门控:仅当对应开关开启才注入 include* → 后端默认零开销、零字节回归(buildRequestParams 默认 extras={})。
	// 行星轨迹默认 ±45 天(后端默认),这里只在开时显式带 includeTrails;升落同理。
	planetariumExtras(){
		const extras = {};
		if(this.state.layers && this.state.layers.planetTrails){ extras.includeTrails = 1; }
		extras.includeRiseSet = 1; // 升落时刻默认开:每次请求都带 → 详情区始终显各星精确升/中天/落(用户:不该是开关、应默认精确)
		// 星等匹配取数:默认只取当前星等上限所需的最亮星(payload ~10x 小 → 首次显星快);
		// 后台补全完成后(_starsWantFull)所有 full 请求改取完整 8404 → 搜索/拖滑块全程不缺星。
		extras.starLimit = this._starsWantFull ? 9000 : starLimitForMag(this.state.magLimit);
		return extras;
	}

	toggleGroup(id){
		this.setState((prev)=>{
			const next = new Set(prev.collapsedGroups);
			if(next.has(id)){ next.delete(id); }else{ next.add(id); }
			return { collapsedGroups: next };
		});
	}

	// 星等过滤滑块:仅改恒星显隐(重应用 alpha),不重拉数据。默认 6.5 = 全显(零回归)。
	changeMagLimit(e){
		const raw = e && e.target ? e.target.value : e;
		const next = Number(raw);
		const magLimit = Number.isFinite(next) ? clamp(next, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX) : STAR_MAG_LIMIT_MAX;
		PLANETARIUM_PAGE_SETTINGS.save({ magLimit });
		this.setState({ magLimit });
		if(this.renderer){ this.renderer.setMagLimit(magLimit); }
	}

	// 角距测量开关。关闭时渲染端会清起点+连线+读数。
	toggleMeasureMode(){
		this.setState((prev)=>({ measureMode: !prev.measureMode, measureInfo: null }), ()=>{
			if(this.renderer){ this.renderer.setMeasureMode(this.state.measureMode); }
		});
	}

	applyPreset(){
		this.setState((prev)=>({ layers: {...prev.layers, ...PROFESSIONAL_LAYERS}, collapsedGroups: new Set() }), ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));
	}

	resetLayers(){
		this.setState({ layers: {...DEFAULT_LAYERS}, collapsedGroups: new Set(['scales', 'poles']) }, ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));
	}

	changeSpeed(speed){
		this.lastPlaybackSyncAt = nowMs();
		// 🆕 暂停时 setupPlayback(componentDidUpdate 触发) 已完整处理:用 playbackLastFrameTime mutate src/mesh 到 pauseTime=A 位置 + setState({time:pauseTime}) 对齐 React state。
		// 原来这里的 snap 逻辑(applyLocalPlaybackFrame(0) + requestPlaybackCalibration(state.time))会引入双跳:applyLocalPlaybackFrame 用落后 120ms 的 state.time 重投影 → 整个 scene 被拉回 B(几秒前)。删除即修。
		// 右栏轨道量:setupPlayback 已 mutate src.lon/lat/ra/decl/zodiacSign/zodiacDegree/house 到 pauseTime 外推值,state.data.bodies[i] === item.source 同引用 → 右栏直接拿到外推值。
		this.setState({ speed });
	}

	changeViewMode(viewMode){
		PLANETARIUM_PAGE_SETTINGS.save({ viewMode });
		this.setState({ viewMode });
	}

	jumpNow(){
		this.setState({
			time: buildObservationTime(this.props.fields),
			speed: 0,
		}, ()=>this.applyFastSceneChange('jump'));
	}

	stepTime(amount, unit){
		this.setState((prev)=>{
			const next = prev.time.clone();
			next.add(amount, unit);
			return {
				time: next,
				speed: 0,
			};
		}, ()=>{
			if(this.renderer && this.state.data){
				// 先按本地外推给即时反馈,再强制校准落地(force:暂停态也收回包;回包真值经淡出衔接,右栏 / 天空 / 月相 / 升落随之刷新)
				this.applyLocalPlaybackFrame(0);
				this.requestPlaybackCalibration(this.state.time, { force: true });
			}else{
				this.requestState({ showLoading: false, reason: 'step' });
			}
		});
	}

	setSearchQuery(e){
		this.setState({
			searchQuery: e && e.target ? e.target.value : '',
			searchMessage: '',
		});
	}

	searchTarget(){
		const query = `${this.state.searchQuery || ''}`.trim();
		if(!query){
			this.setState({ searchMessage: '输入天体、宿名或北斗星名' });
			return;
		}
		if(!this.renderer){
			return;
		}
		const picked = this.renderer.flyTo(query);
		if(picked && picked !== true){
			this.setState({
				selected: picked,
				searchMessage: `已定位：${bodyName(picked)}`,
			});
			return;
		}
		this.setState({ searchMessage: '没有找到匹配天体' });
	}

	toggleLeftPanel(){
		this.setState((prev)=>({
			leftCollapsed: !prev.leftCollapsed,
		}), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 120);
			}
		});
	}

	toggleImmersive(){
		this.setState((prev)=>({ immersive: !prev.immersive }), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 320); // 等 .28s CSS 过渡结束后再 resize，避免按中间尺寸算
			}
		});
	}

	renderLayerButton(key, label, legendDot){
		return (
			<button
				key={key}
				type="button"
				className={`planetarium-chip ${this.state.layers[key] ? 'is-on' : ''} ${legendDot ? 'has-legend' : ''}`}
				onClick={()=>this.toggleLayer(key)}
			>
				{legendDot ? <span className={`planetarium-legend-dot ${legendDot}`} /> : null}
				{label}
			</button>
		);
	}

	jdToClock(jd){
		const t = this.state.time;
		if(!t || !Number.isFinite(Number(jd))){ return '--'; }
		let zoneJdn = 0;
		try { zoneJdn = (typeof t.getZoneJdn === 'function') ? t.getZoneJdn() : 0; } catch(e){ zoneJdn = 0; }
		const locjdn = Number(jd) + zoneJdn + 0.5; // 与 DateTime 本地时推导一致
		let frac = locjdn - Math.floor(locjdn);
		if(frac < 0){ frac += 1; }
		let mins = ((Math.round(frac * 1440) % 1440) + 1440) % 1440;
		const hh = Math.floor(mins / 60);
		const mm = mins % 60;
		return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
	}

	// 角距测量读数(任务 4):测量模式开时显示进度/结果。
	renderMeasure(){
		if(!this.state.measureMode){ return null; }
		const info = this.state.measureInfo;
		if(!info){
			return <div className="planetarium-measure"><h4>角距测量</h4><p>点选第一点…</p></div>;
		}
		if(info.stage === 'first'){
			return (
				<div className="planetarium-measure">
					<h4>角距测量</h4>
					<div><span>起点</span><strong>{info.startLabel || '—'}</strong></div>
					<p>再点选第二点…</p>
				</div>
			);
		}
		return (
			<div className="planetarium-measure">
				<h4>角距测量</h4>
				<div><span>起点</span><strong>{info.startLabel || '—'}</strong></div>
				<div><span>终点</span><strong>{info.endLabel || '—'}</strong></div>
				<div className="planetarium-measure-result"><span>角距</span><strong>{formatDeg(info.separation)}</strong></div>
				<p>再点选可重置并重新测量</p>
			</div>
		);
	}

	// 点击空白天区的坐标读数(任务 3):赤经赤纬 / 黄经黄纬 / 方位高度。
	renderSkyReadout(){
		const r = this.state.skyReadout;
		if(!r || this.state.measureMode){ return null; } // 测量模式下不并显,避免干扰
		return (
			<div className="planetarium-sky-readout">
				<h4>天区方向</h4>
				<div><span>赤经 / 赤纬</span><strong>{formatRa(r.ra)} / {formatDeg(r.decl)}</strong></div>
				<div><span>黄经 / 黄纬</span><strong>{formatDeg(r.eclLon)} / {formatDeg(r.eclLat)}</strong></div>
				<div><span>方位 / 高度</span><strong>{formatDeg(r.azimuth)} / {formatDeg(r.altitudeAppa)}</strong></div>
			</div>
		);
	}

	renderSelected(){
		const selected = this.state.selected;
		if(!selected){
			if(this.state.skyReadout || this.state.measureMode){ return null; } // 已有读数/测量时不再显空提示
			return <div className="planetarium-empty">点击太阳、月亮、行星、二十八宿或北斗星点查看详情</div>;
		}
		// 选中体随播放/改日期/改经纬度实时刷新:this.state.selected 只是点击那一刻的快照,其轨道星历(赤经赤纬/黄经/距离/相位…)不会自更新。
		// 从最新 state.data.bodies(播放每次重取都合并)按 id 取实时体覆盖之;alt/az 等观测量下方每帧重投影、升落走 rsEvents,均已实时。星(stars)位置恒定→不覆盖。
		let item = selected;
		if(selected.layer === 'body' && this.state.data && Array.isArray(this.state.data.bodies)){
			const fresh = this.state.data.bodies.find((b)=>b && (b.id === selected.id || b.name === selected.name));
			if(fresh){ item = { ...selected, ...fresh }; }
		}
		const jd = this.state.time.jdn || this.state.time.calcJdn();
		const obs = observerFromFields(this.getEffectiveFields(), this.state.data);
		// 地平坐标/可见性须按「当前时刻」实时重投影覆盖:state.data.bodies 里的 alt/az 是后端上次重取时刻的值,
		// 播放/改时后会与下方实时「真/视高度」差几十度自相矛盾;统一用当前 jd 重算(赤经赤纬等轨道量仍用重取值)。
		const proj = (valuePresent(item.ra) && valuePresent(item.decl)) ? projectedEquatorialItem(item, jd, obs, this.refractionActiveState()) : null;
		if(proj){ item = { ...item, altitudeAppa: proj.altitudeAppa, azimuth: proj.azimuth, visible: proj.visible, horizonState: proj.horizonState }; }
		const baseRows = detailRowsForItem(item, this.state.data && this.state.data.sky ? this.state.data.sky.moonPhase : null);
		const extra = [];
		if(proj){
			const ra = Number.isFinite(Number(proj.ra)) ? proj.ra : item.ra;
			const decl = Number.isFinite(Number(proj.decl)) ? proj.decl : item.decl;
			extra.push(['时角', formatHourAngle(hourAngleDeg(jd, obs.lon, ra))]);
			extra.push(['本地恒星时', formatRa(localSiderealDeg(jd, obs.lon))]);
			extra.push(['真/视高度', `${formatDeg(proj.altitudeTrue)} / ${formatDeg(proj.altitudeAppa)}`]);
			// 升落时刻:每次请求都带 includeRiseSet(无开关),显后端权威值(swe.rise_trans,当日历元真赤道、与 bodies 同口径);
			// 有权威值时**不再**显本地简化估算行,避免同一面板两组(月亮可差几分钟)互不一致打架;后端未回才显估算行。
			const rsEvents = this.state.data && this.state.data.events && this.state.data.events.riseSet;
			const rs = (rsEvents && (rsEvents[item.id] || rsEvents[item.name])) || (item.riseSet); // 优先 state.data 实时升落(播放/改日期/改经纬度后刷新);item.riseSet 是点击时快照仅作兜底
			if(rs){
				extra.push(['升', rs.rise && rs.rise.time ? rs.rise.time : '不升']);
				extra.push(['中天', rs.transit && rs.transit.time ? rs.transit.time : '—']);
				extra.push(['落', rs.set && rs.set.time ? rs.set.time : '不落']);
			}else{
				const rts = riseTransitSet(ra, decl, jd, obs);
				extra.push(['升/中天/落(估算)', rts.circumpolar ? '恒显' : (rts.neverRises ? '恒隐' : `${this.jdToClock(rts.riseJd)} / ${this.jdToClock(rts.transitJd)} / ${this.jdToClock(rts.setJd)}`)]);
			}
		}
		const rows = baseRows.concat(extra.filter((r)=>valuePresent(r[1])));
		const subtitle = item.kind === 'catalogStar' || item.layer === 'stars'
			? catalogIdText(item)
			: bodyEnglishName(item);
		return (
			<div className="planetarium-detail">
				<h3>{bodyName(item)}</h3>
				{valuePresent(subtitle) ? <p>{subtitle}</p> : null}
				{rows.map((row)=>(
					<div key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></div>
				))}
			</div>
		);
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
			<div className={`horosa-planetarium-page ${this.state.leftCollapsed ? 'is-left-collapsed' : ''} ${this.state.immersive ? 'is-immersive' : ''}`}>
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
						{this.state.timeEditorOpen ? (
							<div ref={this._timeEditorRef} className="planetarium-time-editor" style={this.state.timeEditorPos ? { top: this.state.timeEditorPos.top, left: this.state.timeEditorPos.left } : undefined}>
								<PlanetariumTimeEditor time={this.state.time} onChange={this.changeObserverTime} />
							</div>
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
							<input
								type="range"
								className="planetarium-mag-slider"
								min={STAR_MAG_LIMIT_MIN}
								max={STAR_MAG_LIMIT_MAX}
								step={0.1}
								value={this.state.magLimit}
								onChange={this.changeMagLimit}
								disabled={!this.state.layers.stars}
								title={this.state.layers.stars ? undefined : '恒星层未开:开启恒星后生效'}
								aria-label="星等上限"
								data-mag-limit-disabled={this.state.layers.stars ? '0' : '1'}
							/>
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
							<button type="button" className={this.state.speed === 0 ? 'is-active' : ''} onClick={()=>this.changeSpeed(0)}>暂停</button>
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
