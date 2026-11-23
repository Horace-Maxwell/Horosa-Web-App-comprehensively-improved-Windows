// 天文馆页 · 取天象:交互标记、后台全量重绘调度、状态落地 / 引导 / 缓存回显、性能日志、请求与合流、场景时刻与折射
// 从 PlanetariumBabylon.js 按职责拆出的 PlanetariumBabylon 方法:this 仍是 PlanetariumBabylon 实例,门面里 mixinMethods(PlanetariumBabylon, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { fetchPlanetariumState } from '../../../services/planetarium';
import { PLANETARIUM_PERF_KEY } from './constants';
import { nowMs } from './skyMath';
import { starLimitForMag, buildRequestParams, buildInitialSceneParams, cachePlanetariumState, getCachedPlanetariumState, cachedStateMatches, sceneRequestSignature, isStarOnlyReason } from './sceneParams';
import { markPanelReady } from '../../../utils/perfMark';
import { planetariumRenderGatingEnabled } from '../../../utils/perfFlags';

export const stateFlowMethods = {
	markInteraction(){
		this.lastInteractionAt = nowMs();
	},

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
	},

	scheduleBackgroundFull(options = {}){
		if(this._isUnmounted){
			return;
		}
		// 已经排着一次「整场」全量(天空补全 / 改设置后的重取)时,后来的「只补星表」不顶掉它:
		// 只补星表的回包不重建场景,顶掉 = 那次整场刷新就丢了。留下的那次全量自带完整星表(_starsWantFull 已置)。
		const keepQueued = this.pendingFullRequest && !isStarOnlyReason(this.pendingFullRequest.reason) && isStarOnlyReason(options.reason);
		if(!keepQueued){
			this.pendingFullRequest = {
				showLoading: false,
				requestKind: 'full',
				reason: options.reason || 'background-full',
				syncLabel: options.syncLabel || '补全天空...',
			};
		}
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
	},

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
	},

	finishStateData(payload){
		const { requestKind, started, apiMs, followupFull, reason, sig } = payload || {};
		let data = payload ? payload.data : null;
		if(!data || this._isUnmounted){
			this.requestInFlight = false;
			return;
		}
		let renderMs = 0;
		// 行星轨迹层刚打开的那次重取:只把轨迹补进现有场景(别的都没变),不整场重建。
		// 场景里的日月行星可能已被播放校准推到更新的时刻,留用现有数据、只并入 trails,比整场换成「发请求那一刻」的回包更准。
		let trailsOnly = false;
		if(reason === 'planet-trails' && this.renderer && this.state.data && Array.isArray(data.trails)){
			const ms = this.renderer.applyPlanetTrails(data);
			if(ms >= 0){
				trailsOnly = true;
				data = { ...this.state.data, trails: data.trails };
				renderMs = ms + (this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields(), this.refractionActiveState()) || 0);
			}
		}
		// 后台补全完整星表的那次回包:它问的那片天(观测点 / 设置 / 附带项)和场景里现有数据是同一片,
		// 且时刻也相同(或正在播放——播放中场景早被帧循环推到更新的时刻)→ 只换星表,日月行星 / 线网 / 名牌一样不动。
		// 整场换成这份回包 = 白重建一遍;播放中还会把日月行星拉回「发请求那一刻」再弹回来。
		let starsOnly = false;
		if(!trailsOnly && isStarOnlyReason(reason) && this.renderer && this.state.data && sig && this._sceneDataSig
			&& sig.scene === this._sceneDataSig.scene
			&& (sig.time === this._sceneDataSig.time || Number(this.state.speed || 0) !== 0)
			&& data.stars && Array.isArray(data.stars.catalog)){
			const ms = this.renderer.applyStarCatalog(data);
			if(ms >= 0){
				starsOnly = true;
				const prevData = this.state.data;
				const nextMeta = data.meta || {};
				data = {
					...prevData,
					stars: { ...(prevData.stars || {}), catalog: data.stars.catalog },
					meta: {
						...(prevData.meta || {}),
						catalogCount: nextMeta.catalogCount,
						bsc5CatalogCount: nextMeta.bsc5CatalogCount,
						swissFixedStarCount: nextMeta.swissFixedStarCount,
						renderedCatalogCount: nextMeta.renderedCatalogCount,
					},
				};
				renderMs = ms + (this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields(), this.refractionActiveState()) || 0);
			}
		}
		if(trailsOnly || starsOnly){
			// 场景已就位
		}else if(this.renderer){
			this._sceneDataSig = sig || null; // 场景里现有数据是哪次请求的(没带指纹的来源 = 不认,之后照旧整场重建)
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			// Re-project immediately through the SAME frontend pipeline that playback
			// and calibration use, so the paused frame == the first animated frame.
			// Previously the initial draw kept backend (swisseph) alt/az while playback
			// recomputed alt/az on the frontend, so labels sat off their lines and every
			// line/star snapped on the first play frame. (renderCachedState already does this.)
			renderMs += this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields()) || 0;
		}
		if(requestKind === 'full'){
			// 只补轨迹 / 只换星表时,data 是拼出来的:日月行星与天空可能已被播放 / 单步校准原地推到别的时刻,observer.jd 却还是最初那次。
			// 缓存要自洽(再进页按 observer.jd 判命中、不再校准)→ 这两种情况存这次请求的原始回包,不存拼接结果。
			cachePlanetariumState(trailsOnly || starsOnly ? payload.data : data);
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
	},

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
	},

	renderCachedState(data){
		const started = nowMs();
		let renderMs = 0;
		if(this.renderer){
			this._sceneDataSig = null; // 缓存里的场景不带请求指纹 → 之后的补星表回包照旧整场重建
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			renderMs += this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields()) || 0;
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
	},

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
	},

	async requestState(options = {}){
		const opts = options || {};
		if(this.requestInFlight){
			// 同 scheduleBackgroundFull:排着的「整场」重取不被后来的「只补星表」/「只补行星轨迹」顶掉 ——
			// 这两种回包只并入星表 / 轨迹(快路径),顶掉后改时间等要求的整场重取就丢了,日月行星停在旧时刻。
			// 排着的整场请求发出时按当时的图层带上轨迹,不缺那一份。
			const narrow = (r)=>isStarOnlyReason(r) || r === 'planet-trails';
			const queued = this.pendingRequestOptions;
			if(queued && !narrow(queued.reason) && narrow(opts.reason)){
				return;
			}
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
			reason: opts.reason,
			sig: sceneRequestSignature(params),
		};
		if(requestKind === 'full' && nowMs() - this.lastInteractionAt < 700){
			this.pendingFullRender = payload;
			this.requestInFlight = false;
			this.schedulePendingFullRender();
			return;
		}
		this.finishStateData(payload);
	},

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
	},

	// 场景此刻该投影到的时刻:播放中 = 帧循环最新一帧的时刻(state.time 每 120ms 才跟一次,落后 ≤120ms×速率;
	// 播放中拿它重投影 = 整个天球先退回旧位置、下一帧再弹回,就是「改选项时往回跳一下」);暂停 / 单步 = state.time。
	sceneTime(){
		if(Number(this.state.speed || 0) !== 0 && this.playbackLastFrameTime){
			return this.playbackLastFrameTime;
		}
		return this.state.time;
	},

	// React 侧大气折射判据(与渲染端 refractionActive 同义):地表观测 + 大气层开。
	// 用于显式传 applyRefractionOverride、详情面板视位置计算 —— 关大气层即真空几何(不抬升)。
	refractionActiveState(){
		return this.state.viewMode === 'ground' && !!(this.state.layers && this.state.layers.atmosphere);
	},
};
