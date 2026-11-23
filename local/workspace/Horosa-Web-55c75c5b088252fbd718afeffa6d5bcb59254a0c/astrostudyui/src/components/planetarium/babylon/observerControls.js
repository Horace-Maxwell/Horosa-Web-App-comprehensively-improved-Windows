// 天文馆页 · 观测者:有效时间地点、改地点 / 改时间 / 还原、时间编辑器开合
// 从 PlanetariumBabylon.js 按职责拆出的 PlanetariumBabylon 方法:this 仍是 PlanetariumBabylon 实例,门面里 mixinMethods(PlanetariumBabylon, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { convertLatToStr, convertLonToStr } from '../../astro/AstroHelper';
import { dstAwareZoneAt } from '../../../utils/timezone';
import { fixedPopupFrame } from '../../../utils/zoomDomain';
import { planetariumTimeEditDebounceEnabled } from '../../../utils/perfFlags';

export const observerControlMethods = {
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
	},

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
	},

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
	},

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
		this.playbackLastFrameTime = null;   // 换了时刻:上次播放 / 暂停那一帧作废(见 setupPlayback 暂停分支)
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
	},

	// 双击时间行键入 14 位数字 → 与编辑面板「确定」同路(confirmed=true:暂停播放 + 全量重取该时刻天象)。
	quickCommitObserverTime(dt){
		this.changeObserverTime({ value: dt, confirmed: true });
	},

	// 时间编辑面板:自控开合(不用 antd Popover,避免其受控 click-outside 与嵌套 Select 下拉互相抢闭)。
	toggleTimeEditor(){
		const next = !this.state.timeEditorOpen;
		// 面板挂在 body 下、position:fixed,坐标按时间显示元素实时算。
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
	},

	_closeTimeEditor(){
		this.setState({ timeEditorOpen: false });
		document.body.classList.remove('planetarium-time-editing');
		document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
	},

	_onTimeEditorDocMouseDown(e){
		const t = e.target;
		if(!t){ return; }
		const inEditor = this._timeEditorRef.current && this._timeEditorRef.current.contains(t);
		const onDisplay = this._timeDisplayRef.current && this._timeDisplayRef.current.contains(t);
		// 点在 antd 下拉(Select/DatePicker 弹层,渲染到 body 的门户)上 → 视为编辑器内交互,不关。
		const inAntdPopup = t.closest && t.closest('.ant-select-dropdown, .xq-select-popup, .ant-picker-dropdown, .rc-virtual-list');
		if(inEditor || onDisplay || inAntdPopup){ return; }
		this._closeTimeEditor();
	},
};
