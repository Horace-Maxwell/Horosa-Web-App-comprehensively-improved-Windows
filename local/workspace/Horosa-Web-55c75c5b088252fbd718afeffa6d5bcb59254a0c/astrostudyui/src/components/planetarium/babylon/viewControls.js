// 天文馆页 · 图层 / 星等 / 测量 / 预设 / 视角 / 搜索 / 面板开关,图层按钮、测量与天空读数、选中天体卡
// 从 PlanetariumBabylon.js 按职责拆出的 PlanetariumBabylon 方法:this 仍是 PlanetariumBabylon 实例,门面里 mixinMethods(PlanetariumBabylon, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { projectedEquatorialItem, localSiderealDeg, hourAngleDeg, riseTransitSet } from '../planetariumProjection';
import { STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX, DEFAULT_LAYERS, PLANETARIUM_PAGE_SETTINGS, PROFESSIONAL_LAYERS } from './constants';
import { clamp, observerFromFields } from './skyMath';
import { formatDeg, formatAzimuth, formatRa, formatHourAngle, valuePresent, bodyName, bodyEnglishName, catalogIdText, detailRowsForItem } from './itemText';
import { starLimitForMag } from './sceneParams';

export const viewControlMethods = {
	toggleLayer(key){
		this.setState((prev)=>({
			layers: {
				...prev.layers,
				[key]: !prev.layers[key],
			},
		}), ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));   // 用户亲手点的图层 → 整张表落盘
	},

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
	},

	toggleGroup(id){
		this.setState((prev)=>{
			const next = new Set(prev.collapsedGroups);
			if(next.has(id)){ next.delete(id); }else{ next.add(id); }
			return { collapsedGroups: next };
		});
	},

	// 星等过滤滑块:仅改恒星显隐(重应用 alpha),不重拉数据。默认 6.5 = 全显(零回归)。
	changeMagLimit(e){
		const raw = e && e.target ? e.target.value : e;
		const next = Number(raw);
		const magLimit = Number.isFinite(next) ? clamp(next, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX) : STAR_MAG_LIMIT_MAX;
		PLANETARIUM_PAGE_SETTINGS.save({ magLimit });
		this.setState({ magLimit });
		if(this.renderer){ this.renderer.setMagLimit(magLimit); }
	},

	// 角距测量开关。关闭时渲染端会清起点+连线+读数。
	toggleMeasureMode(){
		this.setState((prev)=>({ measureMode: !prev.measureMode, measureInfo: null }), ()=>{
			if(this.renderer){ this.renderer.setMeasureMode(this.state.measureMode); }
		});
	},

	applyPreset(){
		this.setState((prev)=>({ layers: {...prev.layers, ...PROFESSIONAL_LAYERS}, collapsedGroups: new Set() }), ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));
	},

	resetLayers(){
		this.setState({ layers: {...DEFAULT_LAYERS}, collapsedGroups: new Set(['scales', 'poles']) }, ()=>PLANETARIUM_PAGE_SETTINGS.save({ layers: this.state.layers }));
	},

	changeViewMode(viewMode){
		PLANETARIUM_PAGE_SETTINGS.save({ viewMode });
		this.setState({ viewMode });
	},

	setSearchQuery(e){
		this.setState({
			searchQuery: e && e.target ? e.target.value : '',
			searchMessage: '',
		});
	},

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
	},

	toggleLeftPanel(){
		this.setState((prev)=>({
			leftCollapsed: !prev.leftCollapsed,
		}), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 120);
			}
		});
	},

	toggleImmersive(){
		this.setState((prev)=>({ immersive: !prev.immersive }), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 320); // 等 .28s CSS 过渡结束后再 resize，避免按中间尺寸算
			}
		});
	},

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
	},

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
	},

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
	},

	// 点击空白天区的坐标读数(任务 3):赤经赤纬 / 黄经黄纬 / 方位高度。
	renderSkyReadout(){
		const r = this.state.skyReadout;
		if(!r || this.state.measureMode){ return null; } // 测量模式下不并显,避免干扰
		return (
			<div className="planetarium-sky-readout">
				<h4>天区方向</h4>
				<div><span>赤经 / 赤纬</span><strong>{formatRa(r.ra)} / {formatDeg(r.decl)}</strong></div>
				<div><span>黄经 / 黄纬</span><strong>{formatDeg(r.eclLon)} / {formatDeg(r.eclLat)}</strong></div>
				<div><span>方位 / 高度</span><strong>{formatAzimuth(r.azimuth)} / {formatDeg(r.altitudeAppa)}</strong></div>
			</div>
		);
	},

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
	},
};
