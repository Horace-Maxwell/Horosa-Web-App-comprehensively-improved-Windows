// 天文馆渲染器 · 坐标网与天球线:线段、坐标网与刻度圈、网格标签、叠加线、宫位标签、黄道分区、天极、银道与银河、垣、岁差圈、日行迹、网格细节层级与分组可见性
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { eclipticToEquatorial, equatorialToHorizontal, galacticToEquatorial, projectedEquatorialItem, meanObliquityDeg, sunEclipticLongitude } from '../planetariumProjection';
import SANYUAN_WALLS from '../../../data/sanyuanWalls.json';
import { BABYLON, LINE_RADIUS, GROUND_MAX_FOV } from './constants';
import { clamp, toSkyVector, observerFromData } from './skyMath';
import { circularMidpoint, houseDisplayName, preferredVisiblePoint } from './itemText';

export const rendererGridMethods = {
	createLine(name, points, color, alpha, parent, radius, projectable = false){
		if(!points || points.length < 2){
			return null;
		}
		const vectors = points.map((p)=>toSkyVector(p, radius || LINE_RADIUS));
		const line = BABYLON.MeshBuilder.CreateLines(name, { points: vectors, updatable: true }, this.scene);
		line.color = color;
		line.alpha = alpha === undefined ? 1 : alpha;
		line.parent = parent;
		line.isPickable = false;
		if(projectable){
			this.registerProjectableLine(line, points, radius || LINE_RADIUS);
		}
		return line;
	},

	createShortRadialLine(name, item, color, alpha, parent, outerRadius, innerRadius, projectable = false){
		if(!item){
			return null;
		}
		const p1 = toSkyVector(item, outerRadius);
		const p2 = toSkyVector(item, innerRadius);
		const line = BABYLON.MeshBuilder.CreateLines(name, { points: [p1, p2], updatable: true }, this.scene);
		line.color = color;
		line.alpha = alpha;
		line.parent = parent;
		line.isPickable = false;
		if(projectable){
			this.registerProjectableLine(line, [item], outerRadius, innerRadius);
		}
		return line;
	},

	// 通用坐标网格工厂(地平/赤道/黄道共用)。cfg.toAltAz(u,v,jd,obs,refr) 必须返回带
	// ra/decl 的点(地平网格 projectable:false 除外),否则时间推进时网格会冻结(§3.4)。
	createCoordinateGrid(cfg){
		const group = this.makeGroup(cfg.groupName);
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const density = cfg.density || 96;
		const baseAlpha = cfg.alpha;
		// P3①「极点淡出」:高纬纬圈(|v|≥50)在天极附近挤成结 → 仅按纬度递减其 alpha(只变淡、不改几何/密度),
		// 赤道(v=0)与中低纬一字不动 → 默认观感不变、极区更干净。opt-in,三网格默认开。
		const polarFade = (v)=>{
			if(!cfg.polarFade){ return 1; }
			const a = Math.abs(v);
			if(a <= 50){ return 1; }
			return Math.max(0.34, 1 - ((a - 50) / 50) * 0.6);
		};
		// 经圈(固定经度 u,沿纬度 v 扫):
		for(let u = 0; u < 360; u += cfg.meridianStep){
			const pts = [];
			const vs = (cfg.vRange[1] - cfg.vRange[0]) / density;
			for(let v = cfg.vRange[0]; v <= cfg.vRange[1] + 1e-9; v += vs){
				pts.push(cfg.toAltAz(u, v, jd, obs, refr));
			}
			const principal = (u % 90 === 0);
			// P3②「子午/分至圈强调」:过原点的经圈(本初子午 / 二分二至圈)略加亮(×1.15,封顶 1),命名 -colure 便于区分。
			const isColure = !!cfg.emphasizeColure && (u % 180 === 0);
			let mAlpha = principal ? baseAlpha : baseAlpha * 0.6;
			if(isColure){ mAlpha = Math.min(1, mAlpha * 1.15); }
			const line = this.createLine(`${cfg.groupName}-mer-${u}${isColure ? '-colure' : ''}`, pts, cfg.color, mAlpha, group, cfg.radius, cfg.projectable);
			// P2:非主经圈(不含 0/90/180/270 与分至圈)在缩小视场时可淡出;主圈/分至圈恒定。
			if(line){ line.metadata = { gridKey: cfg.layerKey, baseAlpha: mAlpha, lodFine: (!principal && !isColure) }; }
		}
		// 纬圈(固定纬度 v,沿经度扫;跳 ±90 退化点 + skipPrincipal 去与主圈重合的纬圈):
		for(let v = cfg.vRange[0] + cfg.parallelStep; v < cfg.vRange[1]; v += cfg.parallelStep){
			if(cfg.skipPrincipal !== undefined && Math.abs(v - cfg.skipPrincipal) < 1e-6){ continue; }
			const pts = [];
			const us = 360 / density;
			for(let u = 0; u <= 360 + 1e-9; u += us){
				pts.push(cfg.toAltAz(u % 360, v, jd, obs, refr));
			}
			const pAlpha = (v === 0 ? baseAlpha : baseAlpha * 0.55) * polarFade(v);
			const line = this.createLine(`${cfg.groupName}-par-${Math.round(v)}`, pts, cfg.color, pAlpha, group, cfg.radius, cfg.projectable);
			// P2 密度自适应:把最密的「细纬圈」(非赤道、非 ±30/±60 主纬)标记为可 LOD,记录基准 alpha。
			// 缩小视场(放大)= 维持原样;扩大视场(缩小)才把细纬圈淡出,避免过密。默认 FOV 不触碰(零回归)。
			if(line){
				const isFineParallel = (v !== 0) && (Math.abs(v % 30) > 1e-6);
				line.metadata = { gridKey: cfg.layerKey, baseAlpha: pAlpha, lodFine: isFineParallel };
			}
		}
		return group;
	},

	// 四主圈刻度工厂(赤道时标/黄道度标/方位刻度/子午高度刻度)。cfg.toAnchor(a,jd,obs,refr)
	// 返回带 ra/decl 的锚点(projectable 时);非 projectable 锚点只需 altitudeAppa/azimuth。
	// 主圈刻度(成熟星图样式):与该环同色的小格刻度(minor 短 / major 长)紧贴环线 +
	// 主刻度处读数。cfg.minorStep=小格间隔、cfg.step=主刻度/读数间隔、cfg.tickColor=环色。
	// 与黄道/赤道分别同色 + 紧贴 → 一眼区分,且明显有别于 30° 宫位扇区线。projectable 环随天转。
	createCircleScale(cfg){
		const group = this.makeGroup(cfg.groupName);
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const r0 = cfg.baseRadius;
		const minorStep = cfg.minorStep || cfg.step;
		const lo = cfg.range ? cfg.range[0] : 0;
		const hi = cfg.range ? cfg.range[1] : 360 - minorStep;
		const minorLen = 5;
		const majorLen = 12;
		const tickColor = cfg.tickColor || new BABYLON.Color3(0.6, 0.7, 0.95);
		// 小格刻度:从环线(r0)向外伸出,major 更长更亮;紧贴环线(内端 r0-1 略压线)。
		for(let a = lo; a <= hi + 1e-9; a += minorStep){
			const isMajor = Math.abs(((a % cfg.step) + cfg.step) % cfg.step) < 1e-6;
			const anchor = cfg.toAnchor(a, jd, obs, refr);
			if(!anchor){ continue; }
			this.createShortRadialLine(`${cfg.groupName}-tick-${Math.round(a * 10)}`, anchor, tickColor, isMajor ? 0.95 : 0.55, group, r0 + (isMajor ? majorLen : minorLen), r0 - 1, cfg.projectable);
		}
		// 读数:贴在小格之外,字号大 + 淡底板提升清晰度。
		const labelR = r0 + majorLen + 9;
		for(let a = lo; a <= hi + 1e-9; a += cfg.step){
			const text = cfg.labelFor ? cfg.labelFor(a) : null;
			if(!text){ continue; }
			const anchor = cfg.toAnchor(a, jd, obs, refr);
			if(!anchor){ continue; }
			const proj = cfg.projectable ? projectedEquatorialItem(anchor, jd, obs, refr) : anchor;
			const plane = this.createTextPlane(text, cfg.fontPx || 32, cfg.labelColor || '#cdd9f2', 'rgba(0,0,0,0)');
			plane.position = toSkyVector(proj, labelR);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'scaleNum' };
			if(cfg.projectable && Number.isFinite(Number(proj.ra))){ this.registerProjectableMesh(plane, { ra: proj.ra, decl: proj.decl }, labelR); }
		}
		return group;
	},

	// 坐标数字标尺:与赤道/黄道主圈刻度同一标准(小格每 10°、主刻度+读数、与网格同色、字号清晰)。
	// · 赤道/黄道:本初经圈(ra/lon=0)上的赤纬/黄纬刻度(projectable 随天转)。
	// · 地平(P1):沿地平圈每 30° 标方位度数,显示自正北顺时针(0=北 90=东 180=南 270=西;放置用计算层自南起的 az,标签文字换算成北起),固定不随天转;
	//   与既有 N/E/S/W 大字方位字互补(标度数,不重复字母)。三者同受 coordLabels 双 gate。
	createGridLabels(cfg){
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = cfg.radius;
		const isEq = cfg.kind === 'equatorial';
		const isEc = cfg.kind === 'ecliptic';
		const gateH = !!this.layers[cfg.gridKey] && !!this.layers.coordLabels;
		if(cfg.kind === 'horizontal'){
			// 地平网格度数标注(对标专业星图):每 30° 一枚方位度数,贴地平圈外缘、略抬出地平线防被地遮。
			const tickColorH = cfg.tickColor || new BABYLON.Color3(0.42, 0.78, 0.62);
			for(let az = 0; az < 360; az += 30){
				const anchorAlt = 2; // 略抬出地平线,贴地平圈
				const tk = this.createShortRadialLine(`${cfg.gridKey}-aztick-${az}`, { altitudeAppa: anchorAlt, azimuth: az }, tickColorH, (az % 90 === 0) ? 0.9 : 0.5, cfg.group, radius + ((az % 90 === 0) ? 12 : 6), radius - 1, false);
				if(tk){ tk.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey }; tk.setEnabled(gateH); }
				const plane = this.createTextPlane(`${(az + 180) % 360}°`, 30, cfg.color, 'rgba(0,0,0,0)');   // 标签北起(与详情 / 读数同口径)
				plane.position = toSkyVector({ altitudeAppa: anchorAlt, azimuth: az }, radius + 22);
				plane.parent = cfg.group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey };
				plane.setEnabled(gateH);
			}
			return;
		}
		if(!isEq && !isEc){ return; }
		const tickColor = cfg.tickColor || new BABYLON.Color3(0.6, 0.7, 0.95);
		const degTxt = (d)=> (d > 0 ? `+${d}` : `${d}`) + '°';
		const toEq = (lat)=>{ if(isEq){ return { ra: 0, decl: lat }; } const e = eclipticToEquatorial(0, lat, jd); return e ? { ra: e.ra, decl: e.decl } : null; };
		const majors = { '30': 1, '60': 1, '-30': 1, '-60': 1 };
		const gate = !!this.layers[cfg.gridKey] && !!this.layers.coordLabels;
		for(let lat = -80; lat <= 80 + 1e-9; lat += 10){
			if(Math.abs(lat) < 1e-6){ continue; } // 赤道/黄道本身(纬度 0)由主圈刻度负责
			const src = toEq(lat);
			if(!src){ continue; }
			const isMajor = !!majors[`${lat}`];
			const proj = projectedEquatorialItem(src, jd, obs, refr);
			const tk = this.createShortRadialLine(`${cfg.gridKey}-lattick-${lat}`, proj, tickColor, isMajor ? 0.9 : 0.5, cfg.group, radius + (isMajor ? 12 : 6), radius - 1, true);
			if(tk){ tk.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey }; tk.setEnabled(gate); }
			if(isMajor){
				const plane = this.createTextPlane(degTxt(lat), 32, cfg.color, 'rgba(0,0,0,0)');
				plane.position = toSkyVector(proj, radius + 21);
				plane.parent = cfg.group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey };
				plane.setEnabled(gate);
				this.registerProjectableMesh(plane, src, radius + 21);
			}
		}
	},

	createOverlayLines(overlays, observer){
		const normalizedObserver = observerFromData(observer);
		const group = this.makeGroup('overlay-layer');
		this.createLine('horizon', overlays.horizon && overlays.horizon.points, new BABYLON.Color3(0.48, 0.82, 0.96), 0.5, group, LINE_RADIUS);
		this.createLine('meridian', overlays.meridian && overlays.meridian.points, new BABYLON.Color3(0.48, 0.68, 0.88), 0.18, group, LINE_RADIUS - 2);
		this.createLine('equator', overlays.equator && overlays.equator.points, new BABYLON.Color3(0.42, 0.54, 0.92), 0.2, group, LINE_RADIUS - 4, true);
		this.createLine('ecliptic', overlays.ecliptic && overlays.ecliptic.points, new BABYLON.Color3(1.0, 0.7, 0.22), 0.82, group, LINE_RADIUS + 14, true);
		(overlays.houses || []).forEach((item)=>{
			this.createShortRadialLine(`house-${item.id}`, item, new BABYLON.Color3(0.48, 0.82, 0.68), 0.22, group, LINE_RADIUS + 20, LINE_RADIUS - 46, true);
		});
		this.createHouseLabels(overlays.houses || [], normalizedObserver, group);
		this.createZodiacSectors(overlays.zodiac || [], normalizedObserver);
	},

	createHouseLabels(houses, observer, parent){
		const list = (houses || []).filter((item)=>item && Number.isFinite(Number(item.lon)));
		if(list.length < 2){
			return;
		}
		const radius = LINE_RADIUS - 12;
		const jd = observer && observer.jd ? observer.jd : 2451545;
		list.forEach((item, idx)=>{
			const next = list[(idx + 1) % list.length];
			if(!next || !Number.isFinite(Number(next.lon))){
				return;
			}
			const label = houseDisplayName(item, idx);
			const labelLon = circularMidpoint(item.lon, next.lon);
			const eq = eclipticToEquatorial(labelLon, 0, jd) || { ra: labelLon, decl: 0 };
			const source = {
				id: `house-label-${idx + 1}`,
				name: label,
				lon: labelLon,
				lat: 0,
				ra: eq.ra,
				decl: eq.decl,
			};
			const projected = projectedEquatorialItem(source, jd, observer || { lat: 0, lon: 0 });
			const text = this.createTextPlane(label, 48, '#d7ffe4', 'rgba(0,0,0,0)');
			text.name = `house-label-${idx + 1}`;
			text.position = toSkyVector(projected, radius);
			text.parent = parent;
			text.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			text.metadata = { labelKind: 'houseSector' };
			text.setEnabled(this.viewMode === 'orbit' || Number(projected && projected.altitudeAppa) > 0);
			this.registerProjectableMesh(text, source, radius, {
				visibilityMode: 'sourceAbove',
				lastProjectedSource: projected,
			});
		});
	},

	createZodiacSectors(zodiacItems, observer){
		if(!zodiacItems || !zodiacItems.length){
			return;
		}
		const group = this.makeGroup('zodiac-sector-layer');
		const labelRadius = LINE_RADIUS + 30;
		zodiacItems.forEach((item, idx)=>{
			const points = item && item.points ? item.points : [];
			if(points.length < 2){
				return;
			}
			const label = item.label || `星座${idx + 1}`;
			const anchor = preferredVisiblePoint(points) || points[Math.floor(points.length / 2)];
			const anchorLon = Number(anchor && anchor.lon);
			const labelLon = Number.isFinite(anchorLon)
				? anchorLon
				: (Number.isFinite(Number(item.startLon)) && Number.isFinite(Number(item.endLon))
					? circularMidpoint(item.startLon, item.endLon)
					: 0);
			const labelLat = 2.2;
			const jd = observer && observer.jd ? observer.jd : 2451545;
			const eq = eclipticToEquatorial(labelLon, labelLat, jd) || { ra: labelLon, decl: 0 };
			const labelSource = {
				lon: labelLon,
				lat: labelLat,
				ra: eq.ra,
				decl: eq.decl,
				name: `${label}座`,
			};
			const text = this.createTextPlane(`${label}座`, 52, '#ffe9a8', 'rgba(0,0,0,0)');
			text.position = toSkyVector(projectedEquatorialItem(labelSource, jd, observer || { lat: 0, lon: 0 }), labelRadius);
			text.parent = group;
			text.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			text.metadata = { labelKind: 'zodiacSector' };
			this.registerProjectableMesh(text, labelSource, labelRadius);
		});
	},

	// 泛化的天极标记(天/黄/银极共用),由 createNorthCelestialPole 演化而来:逐字保留
	// marker/halo/十字/标签,仅参数化 id/name/坐标/颜色。十字仅在 |decl|≈90 时画(天极)。
	createPole(cfg){
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const group = cfg.group;
		const radius = cfg.radius || (LINE_RADIUS + 86);
		let ra = cfg.ra;
		let decl = cfg.decl;
		if((ra === undefined || decl === undefined) && cfg.lon !== undefined){
			const eq = eclipticToEquatorial(cfg.lon, cfg.lat || 0, jd);
			if(eq){ ra = eq.ra; decl = eq.decl; }
		}
		const source = { id: cfg.id, name: cfg.name, ra, decl };
		const projected = projectedEquatorialItem(source, jd, obs);
		const position = toSkyVector(projected, radius);
		const color = cfg.color || new BABYLON.Color3(0.7, 0.92, 1);
		const haloColor = cfg.haloColor || color;
		const labelColor = cfg.labelColor || '#dff7ff';

		const marker = BABYLON.MeshBuilder.CreateSphere(`${cfg.id}-marker`, { diameter: 18, segments: 24 }, this.scene);
		marker.position.copyFrom(position);
		marker.material = this.material(`${cfg.id}-marker-mat`, color, 0.96);
		marker.parent = group;
		marker.isPickable = false;
		marker.renderingGroupId = 2;
		marker.metadata = { poleId: cfg.id };
		this.registerProjectableMesh(marker, source, radius);

		const halo = BABYLON.MeshBuilder.CreateSphere(`${cfg.id}-halo`, { diameter: 46, segments: 24 }, this.scene);
		halo.position.copyFrom(position);
		halo.material = this.material(`${cfg.id}-halo-mat`, haloColor, 0.22);
		halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
		halo.parent = group;
		halo.isPickable = false;
		halo.renderingGroupId = 1;
		halo.metadata = { poleId: cfg.id };
		this.registerFollowerMesh(halo, `${cfg.id}-marker`, ()=>BABYLON.Vector3.Zero());
		this.bodyMeshes[`${cfg.id}-marker`] = marker;

		const drawCross = (cfg.drawCross !== undefined) ? cfg.drawCross : (Math.abs(decl) >= 89.5);
		if(drawCross){
			const crossColor = cfg.crossColor || new BABYLON.Color3(0.8, 0.96, 1);
			const crossDecl = decl - Math.sign(decl) * 1.6; // NCP 90→88.4;SCP −90→−88.4
			const mk = (ang)=>projectedEquatorialItem({ ra: ang, decl: crossDecl }, jd, obs);
			const horizontal = this.createLine(`${cfg.id}-cross-horizontal`, [mk(350), mk(10)], crossColor, 0.72, group, radius + 2, true);
			if(horizontal){ horizontal.renderingGroupId = 2; horizontal.metadata = { poleId: cfg.id }; }
			const vertical = this.createLine(`${cfg.id}-cross-vertical`, [mk(90), mk(270)], crossColor, 0.72, group, radius + 2, true);
			if(vertical){ vertical.renderingGroupId = 2; vertical.metadata = { poleId: cfg.id }; }
		}

		const label = this.createTextPlane(cfg.name, 40, labelColor, 'rgba(0,0,0,0)');
		label.position = position.add(new BABYLON.Vector3(0, 34, 0));
		label.parent = group;
		label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		label.metadata = { labelKind: 'pole', poleId: cfg.id };
		this.registerFollowerMesh(label, `${cfg.id}-marker`, ()=>new BABYLON.Vector3(0, 34, 0));
		return marker;
	},

	createPoles(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const g = this.makeGroup('pole-layer');
		const blue = new BABYLON.Color3(0.7, 0.92, 1);
		const gold = new BABYLON.Color3(0.95, 0.78, 0.4);
		const magenta = new BABYLON.Color3(0.78, 0.55, 0.95);
		this.createPole({ id: 'north-celestial-pole', name: '北天极', ra: 0, decl: 90, color: blue, group: g, observer });
		this.createPole({ id: 'south-celestial-pole', name: '南天极', ra: 0, decl: -90, color: blue, group: g, observer });
		const nep = eclipticToEquatorial(0, 90, jd);
		const sep = eclipticToEquatorial(0, -90, jd);
		if(nep){ this.createPole({ id: 'north-ecliptic-pole', name: '北黄极', ra: nep.ra, decl: nep.decl, color: gold, labelColor: '#ffe6a8', group: g, observer }); }
		if(sep){ this.createPole({ id: 'south-ecliptic-pole', name: '南黄极', ra: sep.ra, decl: sep.decl, color: gold, labelColor: '#ffe6a8', group: g, observer }); }
		this.createPole({ id: 'north-galactic-pole', name: '北银极', ra: 192.85948, decl: 27.12825, color: magenta, labelColor: '#f0d4ff', group: g, observer });
		this.createPole({ id: 'south-galactic-pole', name: '南银极', ra: 12.85948, decl: -27.12825, color: magenta, labelColor: '#f0d4ff', group: g, observer });
		return g;
	},

	createGalacticEquator(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const group = this.makeGroup('galactic-layer');
		const pts = [];
		for(let l = 0; l <= 360 + 1e-9; l += 3){
			const e = galacticToEquatorial(l % 360, 0);
			pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl, epoch: 'J2000' }, jd, obs)); // 银道极是 J2000 定义 → 同做岁差
		}
		this.createLine('galactic-equator', pts, new BABYLON.Color3(0.7, 0.78, 0.95), 0.45, group, LINE_RADIUS + 8, true);
		return group;
	},

	// 银河带(程序化,无需贴图):沿银道大圆两侧 ±~8° 叠多条等银纬平行淡线成「带」,
	// alpha 由带心(b=0)向边缘渐隐 → 柔和发光带。坐标全走 galacticToEquatorial→projectedEquatorialItem→toSkyVector
	// 与银道线同一真实赤道管线(纯天文:无 zodiacal/宿度/岁差污染),随时间/观测点重投影。默认关,零回归。
	createMilkyWay(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const group = this.makeGroup('milkyway-layer');
		const HALF_WIDTH_DEG = 8; // 带半宽(银纬),拢成 ~16° 宽的银河带
		const STEPS = 11; // 每侧 + 带心的等银纬线条数(奇数:含 b=0)
		const baseColor = new BABYLON.Color3(0.62, 0.7, 0.92);
		for(let s = 0; s < STEPS; s += 1){
			const frac = STEPS > 1 ? (s / (STEPS - 1)) : 0.5; // 0..1
			const b = (frac * 2 - 1) * HALF_WIDTH_DEG; // -HALF..+HALF 银纬
			// 越靠带心越亮、越靠边缘越淡(余弦渐隐 → 柔和无硬边)。带心 alpha 也压低保「柔和」。
			const edge = Math.abs(b) / HALF_WIDTH_DEG; // 0(心)..1(缘)
			const alpha = 0.16 * Math.pow(Math.cos(edge * Math.PI / 2), 1.4);
			if(alpha < 0.01){ continue; }
			const pts = [];
			for(let l = 0; l <= 360 + 1e-9; l += 3){
				const e = galacticToEquatorial(l % 360, b);
				pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl, epoch: 'J2000' }, jd, obs, refr));
			}
			this.createLine(`milkyway-band-${s}`, pts, baseColor, alpha, group, LINE_RADIUS + 6, true);
		}
		return group;
	},

	// 三垣垣墙(D2)。数据来自 src/data/sanyuanWalls.json(待权威底本);空坐标 = 图层留壳、不画。
	createEnclosures(observer){
		const group = this.makeGroup('sanyuan-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((SANYUAN_WALLS && SANYUAN_WALLS.walls) || []).forEach((wall)=>{
			const stars = (wall.stars || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
			if(stars.length < 2){ return; }
			const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl, epoch: 'J2000' }, jd, obs, refr));
			const line = this.createLine(`sanyuan-${wall.key}`, pts, new BABYLON.Color3(0.78, 0.6, 0.95), 0.6, group, LINE_RADIUS + 38, true);
			if(line){ line.metadata = { enclosure: wall.key }; }
			const label = this.createTextPlane(wall.name, 30, '#e6d4ff', 'rgba(0,0,0,0)');
			label.position = toSkyVector(pts[0], LINE_RADIUS + 44);
			label.parent = group;
			label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			label.metadata = { labelKind: 'enclosure' };
			this.registerProjectableMesh(label, { ra: stars[0].ra, decl: stars[0].decl, epoch: 'J2000' }, LINE_RADIUS + 44);
		});
		return group;
	},

	// 岁差圈(F1):北天极绕北黄极 26000 年画的圈 = 黄纬 (90−ε) 的纬圈;并标当前北天极在圈上的点。
	createPrecessionCircle(observer){
		const group = this.makeGroup('precession-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const beta = 90 - meanObliquityDeg(jd);
		const pts = [];
		for(let l = 0; l <= 360 + 1e-9; l += 4){
			const e = eclipticToEquatorial(l % 360, beta, jd);
			if(e){ pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs, refr)); }
		}
		this.createLine('precession-circle', pts, new BABYLON.Color3(0.66, 0.6, 0.86), 0.5, group, LINE_RADIUS + 12, true);
		const ncp = projectedEquatorialItem({ ra: 0, decl: 90 }, jd, obs, refr);
		const marker = BABYLON.MeshBuilder.CreateSphere('precession-ncp-mark', { diameter: 10, segments: 16 }, this.scene);
		marker.position = toSkyVector(ncp, LINE_RADIUS + 12);
		marker.material = this.material('precession-ncp-mark-mat', new BABYLON.Color3(0.82, 0.76, 0.96), 0.9);
		marker.parent = group;
		marker.isPickable = false;
		marker.renderingGroupId = 2;
		this.registerProjectableMesh(marker, { ra: 0, decl: 90 }, LINE_RADIUS + 12);
		return group;
	},

	// 日行迹(F2,近似):全年逐 ~15 天、固定当前时刻取太阳地平位置 → 观测者天空的八字形(observer-fixed)。
	createAnalemma(observer, jdOverride){
		const group = this.makeGroup('analemma-layer');
		const obs = observerFromData(observer);
		// jd0 优先用显式传入的当前显示时刻(播放/步进重建);否则取观测点时刻(初次构建时=显示时刻)。
		const jd0 = (typeof jdOverride === 'number' && Number.isFinite(jdOverride)) ? jdOverride : ((obs && obs.jd) || 2451545);
		const refr = this.refractionActive();
		const pts = [];
		for(let k = 0; k < 24; k += 1){
			const jdk = jd0 + Math.round(k * 365.2422 / 24); // 整天偏移 → 保持同一时刻(八字形成立)
			const lon = sunEclipticLongitude(jdk);
			const e = eclipticToEquatorial(lon, 0, jdk);
			if(!e){ continue; }
			const pos = equatorialToHorizontal(e.ra, e.decl, jdk, obs, refr);
			if(pos){ pts.push({ altitudeAppa: pos.altitudeAppa, azimuth: pos.azimuth }); }
		}
		if(pts.length > 1){ pts.push(pts[0]); } // 闭合八字
		this.createLine('analemma', pts, new BABYLON.Color3(1.0, 0.82, 0.4), 0.7, group, LINE_RADIUS + 4, false);
		return group;
	},

	// 日行迹按最新时刻/地点重算:弃旧 analemma 组 + 用当前 jd/观测点重建(否则停在构建时=本命时刻)。
	rebuildAnalemma(jd, observer){
		if(!this.groups){ return; }
		this.groups = this.groups.filter((g)=>{
			if(g.name && g.name.indexOf('analemma-layer') === 0){ g.dispose(false, true); return false; }
			return true;
		});
		this.createAnalemma(observer || ((this.lastData && this.lastData.observer) || {}), jd);
		this.applyLayerVisibility();
	},

	// P2 网格密度自适应(保守档·像素感知近似):按视场自适应调网格密度,但绝不重建几何 —
	// 只把最密的「细线」(非主经圈 / 细纬圈)按视场连续淡出。锚点:默认 FOV(地表 1.08)= 系数 1.0,
	// 与现状字节级一致;放大(FOV↓)同样保持 1.0;只有缩小(FOV↑ / orbit 拉远)时细线渐隐,避免过密。
	// 三网格全关(默认)→ 直接返回,零额外逐帧开销、零回归。系数变化 <0.02 不写,避免逐帧抖动。
	applyGridLod(){
		if(!this.camera || !this.scene){ return; }
		if(!this.layers || (!this.layers.horizontalGrid && !this.layers.equatorialGrid && !this.layers.eclipticGrid)){
			// 网格未开:若上次有淡出残留则一次性复位,然后停手。
			if(this._gridLodFactor !== undefined && this._gridLodFactor !== 1){ this._resetGridLod(); }
			return;
		}
		let factor = 1;
		if(this.viewMode === 'orbit'){
			// orbit:相机半径越大(越远)细线越淡。基准 1120,封顶在 ORBIT_MAX_RADIUS 附近。
			const r = this.camera.radius || 1120;
			factor = clamp(1 - (r - 1120) / 1600, 0.3, 1);
		}else{
			// ground:FOV 越大(越广角)细线越淡;默认 1.08 及以下 = 1.0。
			const fov = this.camera.fov || 1.08;
			factor = fov <= 1.08 ? 1 : clamp(1 - (fov - 1.08) / (GROUND_MAX_FOV - 1.08) * 0.7, 0.3, 1);
		}
		if(this._gridLodFactor !== undefined && Math.abs(this._gridLodFactor - factor) < 0.02){ return; }
		this._gridLodFactor = factor;
		this.scene.meshes.forEach((mesh)=>{
			const md = mesh.metadata;
			if(md && md.gridKey && md.lodFine && Number.isFinite(md.baseAlpha)){
				mesh.alpha = md.baseAlpha * factor;
			}
		});
	},

	_resetGridLod(){
		this._gridLodFactor = 1;
		this.scene.meshes.forEach((mesh)=>{
			const md = mesh.metadata;
			if(md && md.gridKey && md.lodFine && Number.isFinite(md.baseAlpha)){
				mesh.alpha = md.baseAlpha;
			}
		});
	},

	applyGridGroupVisibility(group, on){
		group.setEnabled(!!on);
		if(on){
			group.getChildMeshes().forEach((m)=>{
				if(m.metadata && m.metadata.labelKind === 'gridCoord'){ m.setEnabled(!!this.layers.coordLabels); }
			});
		}
	},
};
