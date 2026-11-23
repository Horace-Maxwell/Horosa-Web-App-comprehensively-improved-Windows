// 天文馆渲染器 · 数据与投影:整批数据落地、离屏图层预建、播放校准、按显示时刻重投影(网格 / 线)、动态数据清理、可投影与跟随登记、天空纹理与天色
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { eclipticToEquatorial, equatorialToHorizontal, projectedEquatorialItem, precessionMatrixJ2000ToDate, applyPrecessionMatrixInto, isJ2000Item, createSkyFrame, buildSkyFrame, skySourceUnitInto, skyFrameDirection, skyFrameAltitudeDeg, skyFrameAzimuthDeg } from '../planetariumProjection';
import { BABYLON, STAR_RADIUS, DEFAULT_LAYERS } from './constants';
import { degToRad, nowMs, toSkyVector, toSkyVectorInto, shortestArcDeg, calibBlendFactor, LAT_EXTRAP_MAX_DAYS, normalizeDegrees, observerFromFields } from './skyMath';
import { shouldShowModeBoundItem, bodyName, zodiacInfoForLon, houseForLon } from './itemText';
import { paintSkySurface, paintHorizonMistSurface } from './textures';

export const rendererProjectionMethods = {
	updateData(data, layers){
		this.layers = {...DEFAULT_LAYERS, ...(layers || {})};
		if(!data){
			return;
		}
		this.lastData = data;
		this.currentMoonPhase = data.sky && data.sky.moonPhase ? data.sky.moonPhase : null;
		// 🔴 全量 / 场景回包的 bodies 是「该回包时刻」的真值:外推基线时刻必须一并复位(T-201)。
		// 旧写法只在「改时间」入口复位 _calibJd,换地 / 回命盘时地 / 行星轨迹重取后新真值仍乘 (显示时刻 − 陈旧 _calibJd) 外推一次
		// → 时间差算两遍(北京→伦敦全量回来后月亮差 4.8°)。置 null → 下一次 updateProjectedTime 以显示时刻为基线时刻(dtJd=0)。
		this._calibJd = null;
		const started = nowMs();
		const hasStarCatalog = !!(data.stars && data.stars.catalog && data.stars.catalog.length);
		this.updateSky(data);
		this.clearDynamicData(!hasStarCatalog && !!this.starPcs);
		this.createCardinals();
		this.updateStars(data.stars && data.stars.catalog ? data.stars.catalog : []);
		this.createOverlayLines(data.overlays || {}, data.observer || {});
		const observerArg = data.observer || {};
		this.createPoles(observerArg);
		// 🚀 默认关的贵图层(银道/河 · 三套坐标网格+名牌 · 四主圈刻度 · 二十八宿网格 · 星座线/界 · 三垣 · 岁差 · 日行迹)统一懒构建:
		// 开场默认全关 → 一个都不建(renderMs 大降、非降级零回归);某层在 saved 态或 toggle 开启时,_buildOffLayers 只建该层。
		this._buildOffLayers(true);
		this.createBodies(data.bodies || []);
		this.createSu28Sectors(data.traditions && data.traditions.su28 ? data.traditions.su28 : [], data.observer || {});
		this.createTraditionalLayer('su28', data.traditions && data.traditions.su28 ? data.traditions.su28 : [], new BABYLON.Color3(0.9, 0.68, 0.36), 4.8);
		this.createTraditionalLayer('beidou', data.traditions && data.traditions.beidou ? data.traditions.beidou : [], new BABYLON.Color3(0.52, 0.82, 1), 6.2);
		// 完整星官(312)+ 行星轨迹(后端 data.trails,仅开层重取后有):坐标全走真实赤道(纯天文铁律),默认层关 → 零回归。
		// 🚀 星官默认关 → 懒构建:仅该层已开时才建(开场省 1153 隐藏网格 + 312 名牌纹理 ≈ 半数场景网格,显著降卡顿;非降级零回归)。
		if(this.layers && this.layers.xingguan){ this.ensureChineseAsterismsBuilt(); }
		this.createPlanetTrails(data);
		this.applyLayerVisibility();
		return Math.round(nowMs() - started);
	},

	// 🚀 默认关贵图层懒构建:每层独立 _off[k] 守卫,只建「已开且本轮未建」者。
	// 开场全关 → 零建(renderMs 大降);saved 态 / toggle 开 → 只建该层(参数与原 updateData 急建块逐字一致,非降级零回归)。
	// 调用:updateData(skipApply=true,末尾统一 applyLayerVisibility)/ componentDidUpdate 图层变(skipApply=false,建完即显隐)。
	_buildOffLayers(skipApply){
		if(!this.lastData){ return false; }
		if(!this._off){ this._off = {}; }
		const data = this.lastData;
		const observerArg = data.observer || {};
		const L = this.layers || {};
		let built = false;
		const need = (k)=>{ if(L[k] && !this._off[k]){ this._off[k] = true; built = true; return true; } return false; };
		if(need('galacticEquator')){ this.createGalacticEquator(observerArg); }
		if(need('milkyWay')){ this.createMilkyWay(observerArg); }
		if(need('horizontalGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-horizontal-layer', layerKey: 'horizontalGrid', observer: observerArg,
				color: new BABYLON.Color3(0.30, 0.78, 0.62), alpha: 0.34, radius: 752, projectable: false,
				meridianStep: 30, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (az, alt)=>({ altitudeAppa: alt, azimuth: az }),
			});
			this.createGridLabels({ group: g, gridKey: 'horizontalGrid', kind: 'horizontal', observer: observerArg, color: '#c8ffe8', radius: 752 });
		}
		if(need('equatorialGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-equatorial-layer', layerKey: 'equatorialGrid', observer: observerArg,
				color: new BABYLON.Color3(0.42, 0.54, 0.92), alpha: 0.32, radius: 754, projectable: true,
				meridianStep: 15, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (ra, dec, jd, obs, refr)=>({ ...equatorialToHorizontal(ra, dec, jd, obs, refr), ra, decl: dec }),
			});
			this.createGridLabels({ group: g, gridKey: 'equatorialGrid', kind: 'equatorial', observer: observerArg, color: '#aac0ff', tickColor: new BABYLON.Color3(0.42, 0.54, 0.92), radius: 754 });
		}
		if(need('eclipticGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-ecliptic-layer', layerKey: 'eclipticGrid', observer: observerArg,
				color: new BABYLON.Color3(1.0, 0.7, 0.22), alpha: 0.32, radius: 770, projectable: true,
				meridianStep: 30, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (lon, lat, jd, obs, refr)=>{ const e = eclipticToEquatorial(lon, lat, jd); return { ...equatorialToHorizontal(e.ra, e.decl, jd, obs, refr), ra: e.ra, decl: e.decl }; },
			});
			this.createGridLabels({ group: g, gridKey: 'eclipticGrid', kind: 'ecliptic', observer: observerArg, color: '#ffe6a8', tickColor: new BABYLON.Color3(1.0, 0.7, 0.22), radius: 770 });
		}
		if(need('su28Grid')){ this.createSu28Grid(data.traditions && data.traditions.su28 ? data.traditions.su28 : [], observerArg); }
		if(need('raHourScale')){
			this.createCircleScale({
				groupName: 'scale-equator-layer', observer: observerArg, projectable: true,
				baseRadius: 756, minorStep: 15, step: 30,
				tickColor: new BABYLON.Color3(0.42, 0.54, 0.92), labelColor: '#aac0ff', labelFor: (a)=>`${Math.round(a / 15)}h`,
				toAnchor: (a, jd, obs, refr)=>projectedEquatorialItem({ ra: a, decl: 0 }, jd, obs, refr),
			});
		}
		if(need('eclipticDegreeScale')){
			this.createCircleScale({
				groupName: 'scale-ecliptic-layer', observer: observerArg, projectable: true,
				baseRadius: 774, minorStep: 10, step: 30,
				tickColor: new BABYLON.Color3(1.0, 0.7, 0.22), labelColor: '#ffe6a8', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a, jd, obs, refr)=>{ const e = eclipticToEquatorial(a, 0, jd); return e ? projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs, refr) : null; },
			});
		}
		if(need('azimuthScale')){
			this.createCircleScale({
				groupName: 'scale-horizon-layer', observer: observerArg, projectable: false,
				baseRadius: 760, minorStep: 15, step: 30,
				tickColor: new BABYLON.Color3(0.48, 0.82, 0.96), labelColor: '#c8ffe8', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a)=>({ altitudeAppa: 0, azimuth: a }),
			});
		}
		if(need('altitudeScale')){
			this.createCircleScale({
				groupName: 'scale-meridian-layer', observer: observerArg, projectable: false,
				baseRadius: 758, range: [0, 90], minorStep: 10, step: 30,
				tickColor: new BABYLON.Color3(0.48, 0.68, 0.88), labelColor: '#c0d2f0', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a)=>({ altitudeAppa: a, azimuth: 180 }),
			});
		}
		if(need('threeEnclosures')){ this.createEnclosures(observerArg); }
		if(need('constellationLines')){ this.createConstellationLines(observerArg); }
		if(need('constellationBounds')){ this.createConstellationBounds(observerArg); }
		if(need('starNames')){ this.createStarNames(data.stars && data.stars.catalog ? data.stars.catalog : [], observerArg); }
		if(need('precessionCircle')){ this.createPrecessionCircle(observerArg); }
		if(need('analemma')){ this.createAnalemma(observerArg); }
		if(built && !skipApply){ this.applyLayerVisibility(); }
		return built;
	},

	applyPlaybackCalibration(data, time, fields, skipReproject, displayTime){
		if(!data){
			return 0;
		}
		const started = nowMs();
		this.lastData = {
			...(this.lastData || {}),
			...data,
			stars: this.lastData && this.lastData.stars ? this.lastData.stars : data.stars,
			overlays: this.lastData && this.lastData.overlays ? this.lastData.overlays : data.overlays,
			traditions: this.lastData && this.lastData.traditions ? this.lastData.traditions : data.traditions,
		};
		this.currentMoonPhase = data.sky && data.sky.moonPhase ? data.sky.moonPhase : this.currentMoonPhase;
		this.updateSky(data);
		const bodiesById = {};
		(data.bodies || []).forEach((body)=>{
			if(body && body.id){
				bodiesById[body.id] = body;
			}
		});
		// 🆕 校准时位置无缝衔接(Stellarium 风格):
		// ① 不直接写 mesh.position(原代码 toSkyVector(body) 用 syncJd 位置覆盖 → 从 frame_jd 跳回 syncJd「弹跳」)
		// ② item.source = body **引用赋值**(关键!) → src 与 state.data.bodies[i] 共享同一对象 →
		//    帧循环 mutate src.lon/lat/ra/decl 直接被右栏 renderSelected 看到 → 右栏每 120ms 重渲拿到最新外推值
		// ③ 计算新 _baseLon/_baseLat = 「旧外推到本次 calibJd 时刻位置」+ 新 lonspeed/latspeed 从那时起继续外推
		//    → 视觉上从这一帧的「旧外推位置」直接延续,位置连续、速率精确
		const newCalibJd = (time && (time.jdn || (time.calcJdn && time.calcJdn()))) || null;
		const oldCalibJd = this._calibJd;
		this.projectableMeshes.forEach((item)=>{
			const body = item.source && item.source.id ? bodiesById[item.source.id] : null;
			if(body){
				const oldSrc = item.source;
				// 旧基线存在且本次校准有 jd → 算旧外推到 newCalibJd 时刻的 lon/lat(=当前 mesh 在帧循环里下一刻应在的位置)
				// 🔴 T-199 根修:新基线 = 校准回包的**真值**(body.lon/lat),不再用「旧基线按旧速度外推到校准时刻」当基线。
				// 无缝衔接改由残差淡出实现:记「本地外推到校准时刻的位置 − 真值」为 _blendLon/_blendLat,
				// 帧循环在 CALIB_BLEND_MS 内把残差线性淡到 0 → 视觉连续,位置收敛到精确星历;误差不再逐次校准累积。
				let prevExtrapLon = null;
				let prevExtrapLat = null;
				const calibDtJd = (Number.isFinite(oldCalibJd) && Number.isFinite(newCalibJd)) ? (newCalibJd - oldCalibJd) : null;
				const nowB = nowMs();
				const oldK = calibBlendFactor(oldSrc, nowB);
				if(calibDtJd !== null && Number.isFinite(oldSrc._baseLon) && Number.isFinite(oldSrc.lonspeed)){
					prevExtrapLon = normalizeDegrees(oldSrc._baseLon + oldSrc.lonspeed * calibDtJd + (Number(oldSrc._blendLon) || 0) * oldK);
				}
				if(calibDtJd !== null && Number.isFinite(oldSrc._baseLat)){
					const latDt = Math.max(-LAT_EXTRAP_MAX_DAYS, Math.min(LAT_EXTRAP_MAX_DAYS, calibDtJd));
					prevExtrapLat = oldSrc._baseLat + (Number.isFinite(oldSrc.latspeed) ? oldSrc.latspeed * latDt : 0) + (Number(oldSrc._blendLat) || 0) * oldK;
				}
				// 引用赋值:item.source = body → src 与 state.data.bodies[i] 共享同一对象。
				// 后续帧 mutate body.lon/lat/ra/decl → state.data.bodies 同步更新 → 右栏 renderSelected 实时拿到外推值(不再 2.5s 一跳)。
				item.source = body;
				body._baseLon = body.lon;
				body._baseLat = Number.isFinite(body.lat) ? body.lat : 0;
				// 只有播放中(skipReproject=true,帧循环在跑)才淡出残差;暂停 / 单步没有后续帧来淡,必须直接落真值(否则停在陈旧外推值)
				body._blendLon = (skipReproject && prevExtrapLon !== null && Number.isFinite(body.lon)) ? shortestArcDeg(prevExtrapLon - body.lon) : 0;
				body._blendLat = (skipReproject && prevExtrapLat !== null) ? (prevExtrapLat - body._baseLat) : 0;
				// 残差过大(> 5°,如时刻大跳后的首次校准)不淡出,直接落真值:淡出只为消 sub-degree 级的衔接跳变。
				if(Math.abs(body._blendLon) > 5 || Math.abs(body._blendLat) > 5){ body._blendLon = 0; body._blendLat = 0; }
				body._blendAt = (body._blendLon !== 0 || body._blendLat !== 0) ? nowB : undefined;
				// ⚠ skipReproject=false(单步)时立即设 mesh 位置;播放中(skipReproject=true)留给下一帧 RAF
				// updateProjectedTime 用 frame_jd 平滑外推,避免从 frame_jd 跳回 syncJd 位置
				if(!skipReproject){
					item.mesh.position = toSkyVector(body, item.radius);
				}
				if(item.mesh.metadata && item.mesh.metadata.body){
					item.mesh.metadata.body = { ...item.mesh.metadata.body, ...body, displayName: bodyName(body), layer: 'body' };
				}
			}
		});
		this.updateFollowers();
		// ⚠ 关键顺序:先把 _calibJd 更新到 newCalibJd,再调 updateProjectedTime。
		// 否则 updateProjectedTime 用旧 _calibJd 算 dtJd,但 _baseLon 已是基于 newCalibJd 的新基线 → 双重偏移,
		// extrap = newBaseLon + lonspeed × (displayJd - oldCalibJd) = oldBase + lonspeed × (newCalibJd - oldCalibJd + displayJd - oldCalibJd) 大幅偏移。
		this._calibJd = newCalibJd || this._calibJd || null;
		// 播放中帧循环每帧已重投影(8404 星 + setParticles GPU 上传)→ 跳过此处冗余,避免同帧二次上传致每 2.5s 卡顿;单步无帧循环 → 需重投影。
		// 🆕 重投影时用 displayTime(当前显示时刻 = React state.time,暂停时=pauseTime=A)而非 syncTime(=sync request 时 frame_jd,
		// 比当前显示时刻早 sync API delay ~150-400ms × prevSpeed = 几秒模拟时间)。否则暂停后在途 sync 回来会把整个 scene 跳回 B 位置(几秒前)
		// → 用户视觉感受「暂停瞬间整个 scene 回退到几秒前的状态」(A→B 跳变)。displayTime 兜底 time → 旧调用方零回归。
		if(!skipReproject){ this.updateProjectedTime(displayTime || time, fields); }
		// 日行迹随显示时刻/地点重算(否则停在构建时=本命时刻):该层开 + 时刻变 >30min 时按当前时刻重建。
		if(this.layers && this.layers.analemma){
			const ajd = (time && (time.jdn || (time.calcJdn && time.calcJdn()))) || 0;
			if(Math.abs(ajd - (this._analemmaJd || -1e9)) > (1 / 48)){
				this._analemmaJd = ajd;
				this.rebuildAnalemma(ajd, observerFromFields(fields, this.lastData));
			}
		}
		return Math.round(nowMs() - started);
	},

	updateProjectedTime(time, fields, applyRefractionOverride){
		if(!time || !this.lastData){
			return 0;
		}
		// 记住最近一次投影的显示时刻/观测点:星等上限上调走慢路径新建点云时,建完按此重投影,
		// 否则粒子停在后端上次全量时刻(播放/步进后暂停再拖滑块,整片星空跳回旧时刻)。
		this._lastProjectedTime = time;
		this._lastProjectedFields = fields;
		const started = nowMs();
		const jd = time.jdn || time.calcJdn();
		const observer = observerFromFields(fields, this.lastData);
		this.setReadoutContext(jd, observer); // 让「点击空白处读坐标」用当前时刻/观测点
		// ① 天文馆:仅地表观测(ground)加大气折射;天球外观(orbit)展示几何原貌。切模式时 React 侧传 override 立即生效(不等相机动画)。
		const applyRefraction = (typeof applyRefractionOverride === 'boolean') ? applyRefractionOverride : this.refractionActive();
		// 🔴 T-203:BSC5 星表是 J2000 赤道坐标,投影前先按当日历元做岁差(矩阵每帧算一次、半天内复用;逐星只 9 次乘加 + atan2/asin,
		// 写进复用的 eqScratch,热路径仍零分配)。否则恒星与当日历元的日月行星 / 二十八宿距星同屏两套历元(当代差 0.35°,公元 1000 年差十几度)。
		if(!this._precessionMatrix || !Number.isFinite(this._precessionMatrixJd) || Math.abs(jd - this._precessionMatrixJd) > 0.5){
			this._precessionMatrix = precessionMatrixJ2000ToDate(jd);
			this._precessionMatrixJd = jd;
		}
		const precessionMatrix = this._precessionMatrix;
		const eqScratch = this._eqScratch || (this._eqScratch = { ra: 0, decl: 0 });
		// 🚀 每帧只合成一次「历元坐标 → 场景方向」矩阵,星点与线条每点只剩九次乘加(与逐点公式等价,见 planetariumProjection)。
		const skyFrame = buildSkyFrame(this._skyFrame || (this._skyFrame = createSkyFrame()), jd, observer, applyRefraction, precessionMatrix);
		if(this.starPcs && this.starPcs.particles && this.starCatalog && this.starCatalog.length === this.starPcs.particles.length){
			if(skyFrame.ok){
				const catalog = this.starCatalog;
				const particles = this.starPcs.particles;
				const total = catalog.length;
				// 星表每颗星的 J2000 单位向量只算一次(星表换了才重算);播放时每星零三角函数、零分配。
				let units = this._starUnits;
				if(!units || this._starUnitsCatalog !== catalog || units.length !== total * 3){
					units = this._starUnits = new Float64Array(total * 3);
					this._starUnitsCatalog = catalog;
					for(let idx = 0; idx < total; idx += 1){
						const star = catalog[idx] || {};
						const ar = degToRad(star.ra);
						const br = degToRad(star.decl);
						const cb = Math.cos(br);
						units[idx * 3] = cb * Math.cos(ar);
						units[idx * 3 + 1] = cb * Math.sin(ar);
						units[idx * 3 + 2] = Math.sin(br);
					}
				}
				for(let idx = 0; idx < total; idx += 1){
					const particle = particles[idx];
					if(!particle){
						continue;
					}
					const o = idx * 3;
					skyFrameDirection(skyFrame, 2, units[o], units[o + 1], units[o + 2]);
					particle.position.set(skyFrame.x * STAR_RADIUS, skyFrame.y * STAR_RADIUS, skyFrame.z * STAR_RADIUS);
				}
			}else{
				this.starCatalog.forEach((star, idx)=>{
					const particle = this.starPcs.particles[idx];
					if(!particle){
						return;
					}
					// 🚀 热路径零分配:直接 equatorialToHorizontal(略过 projectedEquatorialItem 的 {...star} 整对象 spread)+ toSkyVectorInto 写入既有 particle.position
					// (略过 new Vector3)。两处每帧各省 8404 次堆分配 → 消除周期性 major GC(连续播放卡顿根因)。星表恒带 ra/decl,位置字节级一致。
					applyPrecessionMatrixInto(precessionMatrix, star.ra, star.decl, eqScratch);
					const pos = equatorialToHorizontal(eqScratch.ra, eqScratch.decl, jd, observer, applyRefraction);
					if(pos){ toSkyVectorInto(pos, STAR_RADIUS, particle.position); }
				});
			}
			this.starPcs.setParticles();
		}
		let sunAltAppa = null; // 太阳前端投影视高度(度):驱动天空昼夜即时同步,免随后端数据滞后
		// 🆕 行星本地外推时刻:懒初始化为当前帧 jd → 首帧 Δjd=0 不外推(=body.lon 校准时刻位置);
		// 之后每帧 Δjd = jd - calibJd,把月亮/行星等带 lonspeed 的 body 黄经线性外推,
		// 避免帧循环里行星位置停在 2.5s 前的校准值、每次校准跳一下(3600x 下月亮跳幅 1.35°)。
		// 校准回来时 applyPlaybackCalibration 会重设 _calibJd → 外推归零并与精确数据无缝衔接。
		if(this._calibJd === undefined || this._calibJd === null){ this._calibJd = jd; }
		const dtJd = jd - this._calibJd; // 单位:日(JD 计)
		const frameNow = nowMs();
		this.projectableMeshes.forEach((item)=>{
			const isSun = item && item.source && item.source.id === 'Sun';
			// 性能守卫:隐藏层(网格/极点等)只付 isEnabled 检查,跳过重投影。但太阳须始终投影(驱动天空昼夜),不受「星体」开关影响。
			if(!isSun && item && item.mesh && !this.layerAllowsMesh(item.mesh)){
				if(item.mesh.isEnabled()){ item.mesh.setEnabled(false); }
				return;
			}
			// 🆕 行星外推:有 lonspeed + dtJd ≠ 0 → 按线性外推 lon,转 ra/decl 后投影。
			// 走自己的小路径避免 projectedEquatorialItem 内部 {...item} 整对象 spread 跑两遍。
			//
			// ⚠ 累积 bug 防护:用 src._baseLon/_baseLat 作为外推**基线**(校准时刻精确 lon/lat),
			// 外推只读基线、不污染基线。若每帧 mutate src.lon = extrapLon 让下一帧再加 dtJd × lonspeed,
			// 因 dtJd 从 calibJd 起算累计增长(不归零),会让 src.lon 越走越快 → 月亮可达真实速度 200×。
			// 校准回来时 applyPlaybackCalibration 把 item.source 指向新 body 对象(清白,无 _baseLon)
			// → 下一帧首循环 lazy 设 _baseLon = 新 body.lon (校准时刻精确值) → 外推归零、无缝对齐。
			let projected = null;
			const src = item.source;
			// ⚠ 不能用 `dtJd !== 0` 跳过外推:calibration 刚到时 _calibJd ≈ frame_jd → dtJd ≈ 0,
			// 若跳过 → src.lon/lat 保留 body 原始 sync 时刻精确值(≈100ms calibration API delay 之前的位置),
			// 用户点暂停瞬间看到的就是 raw sync 值而非 seamless 衔接值 → 3600x 下月亮 lon 倒退 ~0.05°(A→B→A 弹跳源)。
			// 修法:dtJd=0 时 extrap = _baseLon(applyPlaybackCalibration 已设为 seamless 衔接值)→ src.lon 仍是无缝位置。
			if(src && Number.isFinite(src.lonspeed) && Number.isFinite(src.lon)){
				if(!Number.isFinite(src._baseLon)){
					// 新 body 对象首次进入循环:固定基线为校准时刻的精确 lon/lat。
					src._baseLon = src.lon;
					src._baseLat = Number.isFinite(src.lat) ? src.lat : 0;
				}
				// 校准衔接残差按墙钟淡出(见 calibBlendFactor);淡完后 = 纯真值基线 + 线性外推。
				const kBlend = calibBlendFactor(src, frameNow);
				const extrapLon = normalizeDegrees(src._baseLon + src.lonspeed * dtJd + (Number(src._blendLon) || 0) * kBlend);
				// 🆕 lat 也外推:有 latspeed 才推(行星 lat 速度可忽略时后端可能不给),无 latspeed 时用基线。
				// 月亮 latspeed ±5°/day,3600x 下 7s 模拟时间内 lat 变化 0.5°(=月亮直径),不外推就会每 calib 跳一下。
				// 但只在 ±LAT_EXTRAP_MAX_DAYS 内线性外推(黄纬是小幅正弦量,长窗线性外推会推出 125° 的假黄纬)并夹到 ±90°。
				const latDt = Math.max(-LAT_EXTRAP_MAX_DAYS, Math.min(LAT_EXTRAP_MAX_DAYS, dtJd));
				const extrapLatRaw = (Number.isFinite(src.latspeed) ? (src._baseLat + src.latspeed * latDt) : src._baseLat) + (Number(src._blendLat) || 0) * kBlend;
				const extrapLat = Math.max(-90, Math.min(90, extrapLatRaw));
				const eq = eclipticToEquatorial(extrapLon, extrapLat, jd);
				if(eq){
					const pos = equatorialToHorizontal(eq.ra, eq.decl, jd, observer, applyRefraction);
					if(pos){
						projected = {
							...src,
							lon: extrapLon,
							lat: extrapLat,
							ra: eq.ra,
							decl: eq.decl,
							altitudeAppa: pos.altitudeAppa,
							altitudeTrue: pos.altitudeTrue,
							azimuth: pos.azimuth,
							visible: pos.altitudeAppa > 0,
							horizonState: pos.altitudeAppa > 0 ? '可见' : '地平线下',
						};
						// 把外推后的展示字段(非基线)同步到 src,让右栏每 120ms setState 重渲拿到最新值。
						// 基线字段 _baseLon/_baseLat/lonspeed/latspeed 不动 → 不污染、不累积。
						src.lon = extrapLon;
						src.lat = extrapLat;
						src.ra = eq.ra;
						src.decl = eq.decl;
						src.altitudeAppa = pos.altitudeAppa;
						src.altitudeTrue = pos.altitudeTrue;
						src.azimuth = pos.azimuth;
						src.visible = projected.visible;
						src.horizonState = projected.horizonState;
						// 🆕 zodiac sign/degree 与 house 也按外推后 lon 重新算,免右栏「星盘位置」停在 calibration 旧值
						// (3600x 下月亮 7s 内可跨 0.04°,虽然小但累计跨座/跨宫时显示明显错位)。
						const zi = zodiacInfoForLon(extrapLon);
						src.zodiacSign = zi.zodiacSign;
						src.zodiacSignId = zi.zodiacSignId;
						src.zodiacDegree = zi.zodiacDegree;
						src.sign = zi.sign;
						src.signlon = zi.signlon;
						if(this.lastData && this.lastData.overlays && this.lastData.overlays.houses){
							const h = houseForLon(extrapLon, this.lastData.overlays.houses);
							if(h !== null){ src.house = h; }
						}
					}
				}
			}
			// 不走外推的静态源(标注 / 极点 / 亮星 / 深空天体):矩阵快路径直接写 mesh.position,不建临时对象;
			// 认不了的数据返回 false,照旧走下面的逐点路径。
			if(!projected && skyFrame.ok && item.mesh && this.projectMeshFast(item, skyFrame)){
				return;
			}
			if(!projected){
				projected = projectedEquatorialItem(src, jd, observer, applyRefraction);
			}
			if(!projected || !item.mesh){
				return;
			}
			if(isSun){ sunAltAppa = projected.altitudeAppa; }
			item.lastProjectedSource = projected;
			item.mesh.position = toSkyVector(projected, item.radius);
			if(item.visibilityMode === 'allAbove' && item.visibilitySources && item.visibilitySources.length){
				const projectedVisibility = item.visibilitySources.map((source)=>projectedEquatorialItem(source, jd, observer, applyRefraction));
				item.lastProjectedSources = projectedVisibility;
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}else if(item.visibilityMode === 'sourceAbove'){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
			if(item.mesh.metadata && item.mesh.metadata.body){
				item.mesh.metadata.body = {
					...item.mesh.metadata.body,
					altitudeAppa: projected.altitudeAppa,
					azimuth: projected.azimuth,
					visible: projected.visible,
					horizonState: projected.horizonState,
				};
			}
		});
		// 播放/拖时间:天空昼夜随太阳「当前前端视高度」即时切(否则只随后端数据更新→延后/严重对不上)。仅模式变化时重绘天空,省开销。
		if(sunAltAppa != null && this.viewMode !== 'orbit'){
			const skyMode = this.skyModeFromSunAlt(sunAltAppa);
			if(skyMode && skyMode !== this._lastSyncedSkyMode){
				if(!this.lastData){ this.lastData = {}; }
				if(!this.lastData.sky){ this.lastData.sky = {}; }
				this.lastData.sky.mode = skyMode;
				this.updateSky(this.lastData);
			}
		}
		this.projectableLines.forEach((item)=>{
			if(!item || !item.mesh || !item.sources || !item.sources.length){
				return;
			}
			// 性能守卫:隐藏层(网格/刻度/银道/极点十字等)跳过重投影+重建线。
			if(!this.layerAllowsMesh(item.mesh)){
				if(item.mesh.isEnabled()){ item.mesh.setEnabled(false); }
				return;
			}
			if(skyFrame.ok && this.projectLineFast(item, skyFrame)){
				return;
			}
			let vectors = null;
			if(item.innerRadius !== undefined && item.sources.length === 1){
				const projected = projectedEquatorialItem(item.sources[0], jd, observer, applyRefraction);
				vectors = [
					toSkyVector(projected, item.radius),
					toSkyVector(projected, item.innerRadius),
				];
			}else{
				const projectedSources = item.sources.map((source)=>projectedEquatorialItem(source, jd, observer, applyRefraction));
				if(item.visibilityMode === 'allAbove'){
					item.lastProjectedSources = projectedSources;
					item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
				}
				vectors = projectedSources.map((projected)=>toSkyVector(projected, item.radius));
			}
			BABYLON.MeshBuilder.CreateLines(item.mesh.name, {
				points: vectors,
				instance: item.mesh,
			});
		});
		this.updateFollowers();
		// 🆕 暗星跟随:选中暗星时 _followStar 含 ra/decl,每帧重投影到当前 jd → mutate _followerMesh.position
		// camera.lockedTarget 已挂 _followerMesh,自动跟着移动 = 相机持续居中暗星(随地球自转、岁差、播放时间移动均自动覆盖)。
		if(this._followStar && this._followerMesh){
			let fra = this._followStar.ra;
			let fdecl = this._followStar.decl;
			if(isJ2000Item(this._followStar)){
				applyPrecessionMatrixInto(precessionMatrix, Number.isFinite(Number(this._followStar.raJ2000)) ? this._followStar.raJ2000 : fra, Number.isFinite(Number(this._followStar.declJ2000)) ? this._followStar.declJ2000 : fdecl, eqScratch);
				fra = eqScratch.ra; fdecl = eqScratch.decl;
			}
			const fpos = equatorialToHorizontal(fra, fdecl, jd, observer, applyRefraction);
			if(fpos){ toSkyVectorInto(fpos, STAR_RADIUS, this._followerMesh.position); }
		}
		return Math.round(nowMs() - started);
	},

	// 单点 mesh 重投影快路径(与逐点路径同一套显隐 / 元数据语义):位置原地写、显隐判定用的高度对象复用。
	// 返回 false = 源数据快路径认不了,调用方走逐点路径。
	projectMeshFast(item, frame){
		const unit = item._unit || (item._unit = new Float64Array(6));
		const kind = skySourceUnitInto(item.source, unit, 0);
		if(!kind){
			return false;
		}
		const mesh = item.mesh;
		const radius = item.radius;
		const sinAlt = skyFrameDirection(frame, kind, unit[3], unit[4], unit[5]);
		const fx = frame.x;
		const fz = frame.z;
		const altitudeAppa = skyFrameAltitudeDeg(frame);
		// 方位要趁现在读:下面逐个参照点还会复用同一个 frame,frame.x / z 会被改写。
		const hasBody = !!(mesh.metadata && mesh.metadata.body);
		const azimuth = hasBody ? skyFrameAzimuthDeg(frame) : 0;
		const last = item._fastProjected || (item._fastProjected = { altitudeAppa: 0 });
		last.altitudeAppa = altitudeAppa;
		item.lastProjectedSource = last;
		if(!item._ownPosition){
			// 首次:给这个 mesh 一份独占的位置向量(建场景时可能与别的 mesh 共用同一个 Vector3),之后才原地写。
			mesh.position = new BABYLON.Vector3(0, 0, 0);
			item._ownPosition = true;
		}
		mesh.position.copyFromFloats(fx * radius, sinAlt * radius, fz * radius);
		if(item.visibilityMode === 'allAbove' && item.visibilitySources && item.visibilitySources.length){
			const vis = item.visibilitySources;
			const n = vis.length;
			let cache = item._fastVis;
			if(!cache || cache.alts.length !== n){
				cache = item._fastVis = { units: new Float64Array(n * 6), alts: vis.map(()=>({ altitudeAppa: 0 })) };
			}
			for(let i = 0; i < n; i += 1){
				const o = i * 6;
				const vKind = skySourceUnitInto(vis[i], cache.units, o);
				if(!vKind){
					// 显隐参照点认不了:这一项整体退回逐点路径(位置已写,逐点路径会按同式重写一遍,结果一致)。
					return false;
				}
				const vSin = skyFrameDirection(frame, vKind, cache.units[o + 3], cache.units[o + 4], cache.units[o + 5]);
				cache.alts[i].altitudeAppa = Math.asin(Math.max(-1, Math.min(1, vSin))) * 180 / Math.PI;
			}
			item.lastProjectedSources = cache.alts;
			mesh.setEnabled(this.layerAllowsMesh(mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
		}else if(item.visibilityMode === 'sourceAbove'){
			mesh.setEnabled(this.layerAllowsMesh(mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
		}
		if(hasBody){
			const visible = altitudeAppa > 0;
			mesh.metadata.body = {
				...mesh.metadata.body,
				altitudeAppa,
				azimuth,
				visible,
				horizonState: visible ? '可见' : '地平线下',
			};
		}
		return true;
	},

	// 线条重投影快路径:每点九次乘加算出场景坐标,直接写进预分配的顶点数组再整块上传(不建 Vector3、不走 CreateLines 的逐点回调)。
	// 返回 false = 这条线有快路径认不了的数据(或顶点数对不上),调用方照旧走逐点慢路径,行为不降级。
	projectLineFast(item, frame){
		let fast = item._fast;
		if(fast === false){
			return false;
		}
		const sources = item.sources;
		const n = sources.length;
		const radial = item.innerRadius !== undefined && n === 1;
		const count = radial ? 2 : n;
		if(!fast){
			if(!item.mesh.getTotalVertices || item.mesh.getTotalVertices() !== count){
				item._fast = false;
				return false;
			}
			fast = item._fast = {
				units: new Float64Array(n * 6),
				positions: new Float32Array(count * 3),
				alts: (!radial && item.visibilityMode === 'allAbove') ? sources.map(()=>({ altitudeAppa: 0 })) : null,
			};
		}
		const units = fast.units;
		const positions = fast.positions;
		const alts = fast.alts;
		const radius = item.radius;
		for(let i = 0; i < n; i += 1){
			const o = i * 6;
			const kind = skySourceUnitInto(sources[i], units, o);
			if(!kind){
				return false;
			}
			const sinAlt = skyFrameDirection(frame, kind, units[o + 3], units[o + 4], units[o + 5]);
			const p = i * 3;
			positions[p] = frame.x * radius;
			positions[p + 1] = frame.y * radius;
			positions[p + 2] = frame.z * radius;
			if(radial){
				positions[3] = frame.x * item.innerRadius;
				positions[4] = frame.y * item.innerRadius;
				positions[5] = frame.z * item.innerRadius;
			}
			if(alts){
				alts[i].altitudeAppa = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
			}
		}
		if(alts){
			item.lastProjectedSources = alts;
			item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
		}
		item.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
		return true;
	},

	clearDynamicData(preserveStars = false){
		// 🚀 懒构建守卫复位:本方法会 dispose 掉(除恒星外)所有动态组,故清空 _off / _asterismsBuilt,
		// 让 _buildOffLayers / ensureChineseAsterismsBuilt 在下次 updateData 按当前开关重建已开层(并修「全量刷新后开着的层消失」潜伏 bug)。
		this._off = {};
		this.detachSurfaceTextures();
		// 🚀 星官层只吃静态星表(J2000 赤道坐标 + 固定配色),位置每次重投影现算,和回包数据无关:层开着时跨全量刷新整组保留
		// (在建的分片任务也接着建),不必每来一份全量数据就把 312 个名牌纹理 + 1153 条线拆掉重建一遍。
		// 层关着就照旧释放(不白占显存),下次打开再懒建。调用方在 updateData 之后都会 updateProjectedTime,保留下来的组随之摆到新时刻 / 新观测点。
		const isAsterismGroup = (group)=>!!(group && group.name && group.name.indexOf('asterism-xingguan-layer') === 0);
		const keepAsterisms = !!this._asterismsBuilt && !!(this.layers && this.layers.xingguan) && this.groups.some(isAsterismGroup);
		const isAsterismMesh = (mesh)=>keepAsterisms && !!mesh && isAsterismGroup(mesh.parent);
		if(!keepAsterisms){
			this._asterismsBuilt = false;
			this.cancelChineseAsterismBuild();
		}
		if(preserveStars){
			const isBrightStarMesh = (mesh)=>mesh && mesh.name && mesh.name.indexOf('bright-star-') === 0;
			const retainedBodyMeshes = {};
			Object.keys(this.bodyMeshes || {}).forEach((key)=>{
				const mesh = this.bodyMeshes[key];
				if(isBrightStarMesh(mesh)){
					retainedBodyMeshes[key] = mesh;
				}
			});
			this.pickMeshes = (this.pickMeshes || []).filter(isBrightStarMesh);
			this.bodyMeshes = retainedBodyMeshes;
			this.projectableMeshes = (this.projectableMeshes || []).filter((item)=>isBrightStarMesh(item && item.mesh) || isAsterismMesh(item && item.mesh));
			this.projectableLines = (this.projectableLines || []).filter((item)=>isAsterismMesh(item && item.mesh));
			// 亮星组整组留用 → 亮星光晕的跟随登记也留着(清掉 = 光晕停在原地不跟星走,要等下一次全量回包才回位)
			this.followMeshes = (this.followMeshes || []).filter((item)=>isBrightStarMesh(item && item.mesh));
			const keep = [];
			this.groups.forEach((group)=>{
				if(group.name.indexOf('stars-layer') === 0 || group.name.indexOf('bright-stars-layer') === 0 || (keepAsterisms && isAsterismGroup(group))){
					keep.push(group);
				}else{
					group.dispose(false, true);
				}
			});
			this.groups = keep;
			return;
		}
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = (this.projectableMeshes || []).filter((item)=>isAsterismMesh(item && item.mesh));
		this.projectableLines = (this.projectableLines || []).filter((item)=>isAsterismMesh(item && item.mesh));
		this.followMeshes = [];
		const keep = [];
		this.groups.forEach((group)=>{
			if(group.name.indexOf('stars-layer') === 0 || (keepAsterisms && isAsterismGroup(group))){
				keep.push(group);
			}else{
				group.dispose(false, true);
			}
		});
		this.groups = keep;
	},

	registerProjectableMesh(mesh, source, radius, options = null){
		if(!mesh || !source){
			return;
		}
		this.projectableMeshes.push({ mesh, source, radius, ...(options || {}) });
	},

	registerProjectableLine(mesh, sources, radius, innerRadius, options = null){
		if(!mesh || !sources || !sources.length){
			return;
		}
		this.projectableLines.push({ mesh, sources, radius, innerRadius, ...(options || {}) });
	},

	registerFollowerMesh(mesh, targetId, offsetFactory){
		if(!mesh || !targetId){
			return;
		}
		this.followMeshes.push({ mesh, targetId, offsetFactory });
	},

	updateFollowers(){
		this.followMeshes.forEach((item)=>{
			const target = this.bodyMeshes[item.targetId];
			if(!target || !target.position || !item.mesh){
				return;
			}
			const offset = typeof item.offsetFactory === 'function' ? item.offsetFactory(target) : null;
			// 位置向量每个跟随者独占一份(首帧新建),之后原地写,不再每帧新建两个 Vector3。
			if(!item._ownPosition){
				item.mesh.position = new BABYLON.Vector3(0, 0, 0);
				item._ownPosition = true;
			}
			item.mesh.position.copyFrom(target.position);
			if(offset){ item.mesh.position.addInPlace(offset); }
		});
	},

	updateSkyTexture(p){
		if(!this.skyTexture){
			return;
		}
		paintSkySurface(this.skyTexture.getContext(), 1024, 512, p);
		this.skyTexture.update(false);
	},

	// 太阳(视)高度 → 天空昼夜模式:标准晨昏阈值 0/-6/-12/-18°(与后端 sky.mode 同口径;
	// 后端此前拿视高度比 -0.833° = 折射算两次,已统一到 0°,此注自此为真)
	skyModeFromSunAlt(alt){
		if(alt == null){ return null; }
		if(alt > 0){ return 'day'; }
		if(alt > -6){ return 'civilTwilight'; }
		if(alt > -12){ return 'nauticalTwilight'; }
		if(alt > -18){ return 'astronomicalTwilight'; }
		return 'night';
	},

	updateSky(data){
		const sky = data && data.sky ? data.sky : {};
		// 天球外观(orbit):强制暗色空背景,避免白天天空把网格/刻度/读数冲淡、看不清也不准。
		const mode = this.viewMode === 'orbit' ? 'night' : (sky.mode || 'night');
		this._lastSyncedSkyMode = mode; // 记录当前生效模式,供 updateProjectedTime 太阳高度同步去重(免重复重绘)
		// 🚀 天空外观去重:同(mode + 大气 + 视角)→ 天空/雾纹理不变,跳过昂贵重绘(updateSkyTexture + 1024×256 mist paint + GPU upload)。
		// 修「连续播放时 applyPlaybackCalibration 每 ~2.5s 无条件 updateSky → 重绘纹理致 3D 卡一下」;昼夜过渡 / 大气 / 视角切换仍重绘,零视觉回归。
		const _skySig = mode + '|' + ((this.layers && this.layers.atmosphere) ? '1' : '0') + '|' + this.viewMode;
		if(this._skyPaintSig === _skySig){ return; }
		this._skyPaintSig = _skySig;
		const palettes = {
			day: { clear: [0.26, 0.43, 0.68], zenith: [0.11, 0.27, 0.56], sky: [0.22, 0.42, 0.74], horizon: [0.4, 0.57, 0.78], glow: [0.56, 0.72, 0.9], glowAlpha: 0.28, skyGlowAlpha: 0.26, mistAlpha: 0.18, ground: [0.64, 0.61, 0.54], panorama: [0.7, 0.69, 0.65], land: [0.13, 0.115, 0.095] },
			civilTwilight: { clear: [0.11, 0.16, 0.32], zenith: [0.025, 0.04, 0.12], sky: [0.12, 0.15, 0.36], horizon: [0.34, 0.22, 0.2], glow: [0.86, 0.46, 0.22], glowAlpha: 0.24, skyGlowAlpha: 0.24, mistAlpha: 0.2, ground: [0.42, 0.37, 0.31], panorama: [0.58, 0.52, 0.46], land: [0.08, 0.068, 0.054] },
			nauticalTwilight: { clear: [0.035, 0.055, 0.13], zenith: [0.01, 0.018, 0.055], sky: [0.035, 0.055, 0.16], horizon: [0.08, 0.1, 0.22], glow: [0.35, 0.43, 0.72], glowAlpha: 0.18, skyGlowAlpha: 0.18, mistAlpha: 0.16, ground: [0.28, 0.27, 0.23], panorama: [0.42, 0.42, 0.39], land: [0.052, 0.05, 0.042] },
			astronomicalTwilight: { clear: [0.012, 0.02, 0.055], zenith: [0.004, 0.008, 0.028], sky: [0.01, 0.018, 0.052], horizon: [0.028, 0.04, 0.09], glow: [0.14, 0.24, 0.48], glowAlpha: 0.13, skyGlowAlpha: 0.13, mistAlpha: 0.11, ground: [0.2, 0.19, 0.16], panorama: [0.32, 0.32, 0.3], land: [0.036, 0.034, 0.03] },
			night: { clear: [0.004, 0.006, 0.014], zenith: [0.001, 0.003, 0.012], sky: [0.004, 0.007, 0.022], horizon: [0.012, 0.02, 0.045], glow: [0.04, 0.11, 0.22], glowAlpha: 0.08, skyGlowAlpha: 0.08, mistAlpha: 0.07, ground: [0.15, 0.145, 0.125], panorama: [0.24, 0.24, 0.23], land: [0.026, 0.024, 0.022] },
		};
		const base = palettes[mode] || palettes.night;
		// 大气层关:天空塌成纯真空黑(白天也黑)—— clear/天顶/天空/地平/辉光全归 0、无地平大气辉光与雾。
		// 仅覆盖天空相关字段;地面(ground/panorama/land)保留本 mode 取色,其显隐由「地面」开关独立控制。零回归:atmosphere 默认开 → 用 base 原值。
		const atmosphereOn = !!(this.layers && this.layers.atmosphere);
		const p = atmosphereOn ? base : {
			...base,
			clear: [0, 0, 0], zenith: [0, 0, 0], sky: [0, 0, 0], horizon: [0, 0, 0],
			glow: [0, 0, 0], glowAlpha: 0, skyGlowAlpha: 0, mistAlpha: 0,
		};
		this.scene.clearColor = new BABYLON.Color4(p.clear[0], p.clear[1], p.clear[2], 1);
		if(this.skyMat){
			this.skyMat.emissiveColor = BABYLON.Color3.White();
		}
		this.updateSkyTexture(p);
		if(this.horizonGlow && this.horizonGlow.material){
			this.horizonGlow.material.emissiveColor = new BABYLON.Color3(p.glow[0], p.glow[1], p.glow[2]);
			this.horizonGlow.material.alpha = p.glowAlpha;
		}
		if(this.groundMat){
			this.groundMat.diffuseColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
			this.groundMat.emissiveColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
		}
		if(this.horizonPanorama && this.horizonPanorama.material){
			this.horizonPanorama.material.diffuseColor = new BABYLON.Color3(p.panorama[0], p.panorama[1], p.panorama[2]);
			this.horizonPanorama.material.emissiveColor = new BABYLON.Color3(p.panorama[0], p.panorama[1], p.panorama[2]);
		}
		if(this.horizonMistTexture){
			paintHorizonMistSurface(this.horizonMistTexture.getContext(), 1024, 256, p);
			this.horizonMistTexture.update(false);
		}
		if(this.horizonMist && this.horizonMist.material){
			// 地平大气辉光雾:属大气现象,关大气层即全透明(无辉光)。
			this.horizonMist.material.alpha = atmosphereOn ? (mode === 'day' ? 0.62 : 0.86) : 0;
		}
		(this.landscapeMeshes || []).forEach((mesh, idx)=>{
			const mat = mesh && mesh.material;
			if(mat){
				const scale = idx === 0 ? 1 : (idx === 1 ? 0.72 : 0.86);
				mat.diffuseColor = new BABYLON.Color3(p.land[0] * scale, p.land[1] * scale, p.land[2] * scale);
				mat.emissiveColor = new BABYLON.Color3(p.land[0] * scale, p.land[1] * scale, p.land[2] * scale);
			}
		});
	},
};
