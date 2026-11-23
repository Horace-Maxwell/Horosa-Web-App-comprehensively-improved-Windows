// 天文馆页 · 播放:本地逐帧、与后端校准合流、快速换景、空格 / 指针 / 键盘热键、速度、回到现在与步进
// 从 PlanetariumBabylon.js 按职责拆出的 PlanetariumBabylon 方法:this 仍是 PlanetariumBabylon 实例,门面里 mixinMethods(PlanetariumBabylon, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { fetchPlanetariumState } from '../../../services/planetarium';
import { nowMs, CALIB_SIM_GAP_DAYS, CALIB_MIN_WALL_MS } from './skyMath';
import { buildObservationTime, buildPlaybackSyncParams, buildSceneSyncParams, cachePlanetariumState } from './sceneParams';
import { playbackAnchorAfterHitch } from './playbackClock';
import { spaceTogglesPlayback, playbackHotkeyControlOf, isSpaceKey, PLAYBACK_HOTKEY_OPEN_POPUPS } from './playbackHotkey';

export const playbackControlMethods = {
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
			// 暂停瞬间的真实时刻取 playbackLastFrameTime(state.time 落后 0-120ms × prevSpeed);下面把 state.time 对齐到它之后即清掉 ——
			// 下次开播按 state.time(= 暂停瞬间,或用户之后改到的时刻)起锚,既不跳回落后的 B 位置,也不丢暂停后的调整。
			// 单步 / 改时间 / 回到命盘 / 换盘在 setState 前先清它:播放中触发这些操作时,这里取到的就是用户要的新时刻,不会被盖回最后一帧。
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
			// state.time 已对齐到暂停那一帧,不再留着它:暂停后单步 / 改时间 / 回到命盘 / 换盘只改 state.time,
			// 留着旧帧会让「空格继续」从旧的暂停瞬间开播,前面的调整全丢。下一次开播按 state.time 起锚即可。
			this.playbackLastFrameTime = null;
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
			// 卡顿造成的长帧折成一帧(加速档):不让模拟时间照墙钟一次补齐、天球往前一跳。口径见 babylon/playbackClock.js。
			this.playbackAnchorMs = playbackAnchorAfterHitch(this.playbackAnchorMs, this.playbackLastFrameMs, frameMs, speed);
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
	},

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
	},

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
	},

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
	},

	flushPendingCalib(){
		const pc = this._pendingCalib;
		if(pc){ this._pendingCalib = null; this.setState((prev)=>this._mergeCalib(prev, pc)); }
	},

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
	},

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
		const renderMs = this.renderer.updateProjectedTime(this.sceneTime(), this.getEffectiveFields());
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
	},

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
	},

	// 空格键 = 暂停 / 回到上一次选的速率。接管判定在 babylon/playbackHotkey.js(页可见、不在打字、没有弹层开着、焦点不是用 Tab 走到的控件)。
	// 在捕获阶段接键:抢在控件自己的键盘处理之前(鼠标点过的下拉会把焦点留在它的输入框上,那里按空格本来会再弹开下拉)。
	_spaceTogglesPlayback(e){
		return spaceTogglesPlayback(e, this._pageRef.current, this._focusByKeyboard === true);
	},

	_onPlaybackPointerDown(){
		this._focusByKeyboard = false;
	},

	_onPlaybackKeyDown(e){
		if(e && e.key === 'Tab'){ this._focusByKeyboard = true; return; }
		// Esc 收起时间输入面板(面板里的下拉 / 日期弹层还开着时先让它们自己收)
		if(e && e.key === 'Escape' && this.state.timeEditorOpen && !e.defaultPrevented && !e.isComposing){
			if(!document.querySelector(PLAYBACK_HOTKEY_OPEN_POPUPS)){ this._closeTimeEditor(); }
			return;
		}
		if(!this._spaceTogglesPlayback(e)){ return; }
		e.preventDefault();   // 不滚页;也不让聚焦着的速率钮被空格再点一次
		// 焦点留在某个控件上时,连同它自己的键盘处理一起拦下(否则下拉会被这一下空格弹开)
		this._spaceKeyOnControl = !!playbackHotkeyControlOf(e.target);
		if(this._spaceKeyOnControl){ e.stopPropagation(); }
		this._spaceKeyHeld = true;
		if(e.repeat){ return; }
		this.changeSpeed(this.state.speed !== 0 ? 0 : (this.lastPlaySpeed || 1));
	},

	_onPlaybackKeyUp(e){
		// 按钮的空格激活发生在 keyup:按下那一下是本页接管的,抬起也一并吞掉。
		if(!this._spaceKeyHeld || !isSpaceKey(e)){ return; }
		this._spaceKeyHeld = false;
		e.preventDefault();
		if(this._spaceKeyOnControl){ e.stopPropagation(); }
		this._spaceKeyOnControl = false;
	},

	changeSpeed(speed){
		if(speed){ this.lastPlaySpeed = speed; }
		this.lastPlaybackSyncAt = nowMs();
		// 🆕 暂停时 setupPlayback(componentDidUpdate 触发) 已完整处理:用 playbackLastFrameTime mutate src/mesh 到 pauseTime=A 位置 + setState({time:pauseTime}) 对齐 React state。
		// 原来这里的 snap 逻辑(applyLocalPlaybackFrame(0) + requestPlaybackCalibration(state.time))会引入双跳:applyLocalPlaybackFrame 用落后 120ms 的 state.time 重投影 → 整个 scene 被拉回 B(几秒前)。删除即修。
		// 右栏轨道量:setupPlayback 已 mutate src.lon/lat/ra/decl/zodiacSign/zodiacDegree/house 到 pauseTime 外推值,state.data.bodies[i] === item.source 同引用 → 右栏直接拿到外推值。
		this.setState({ speed });
	},

	jumpNow(){
		this.playbackLastFrameTime = null;   // 换了时刻:上次播放 / 暂停那一帧作废(见 setupPlayback 暂停分支)
		this.setState({
			time: buildObservationTime(this.props.fields),
			speed: 0,
		}, ()=>this.applyFastSceneChange('jump'));
	},

	stepTime(amount, unit){
		this.playbackLastFrameTime = null;   // 换了时刻:上次播放 / 暂停那一帧作废(见 setupPlayback 暂停分支)
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
	},
};
