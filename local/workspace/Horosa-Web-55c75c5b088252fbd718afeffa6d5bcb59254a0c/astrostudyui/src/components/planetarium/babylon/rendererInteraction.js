// 天文馆渲染器 · 拾取、测量、天空读数、模式绑定与图层可见性
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { nearestPointToRay, starDisplayLabel } from '../planetariumStarSearch';
import { pointerLocalRatio } from '../../../utils/zoomDomain';
import { BABYLON, STAR_RADIUS, LINE_RADIUS } from './constants';
import { clamp, toSkyVector, skyDirectionFromVector, horizontalToEquatorial, equatorialToEcliptic, angularSeparationDeg, observerFromData } from './skyMath';
import { formatDeg, formatRa, shouldShowModeBoundItem, bodyName } from './itemText';

export const rendererInteractionMethods = {
	// 拾取射线要的是画布**本地 CSS 坐标**(布局域);引擎给的 scene.pointerX/Y = clientX − 画布 rect.left,是视觉域 ——
	// 壳缩放档下两者差 z 倍:点星 / 读天区坐标 / 角距测量的射线会偏到「离画布原点 z 倍远」的方向上(100% 档重合,看不出来)。
	// 按「画布布局宽 ÷ rect 宽」折回,不问缩放值。
	pickXY(){
		if(this._pointerDomainPatched){ return { x: this.scene.pointerX, y: this.scene.pointerY }; }   // 已在引擎入口折回,别折两次
		const k = this.canvas ? pointerLocalRatio(this.canvas) : { kx: 1, ky: 1 };
		return { x: this.scene.pointerX * k.kx, y: this.scene.pointerY * k.ky };
	},

	pickNearestStar(){
		if(!this.camera || !this.scene || !this.starCatalog || !this.starCatalog.length || !this.onPick){
			return null;
		}
		if(this.layers && this.layers.stars === false){
			return null; // 恒星层关闭时不拾取
		}
		let ray = null;
		try{
			const pxy = this.pickXY();
			ray = this.scene.createPickingRay(pxy.x, pxy.y, BABYLON.Matrix.Identity(), this.camera);
		}catch(e){
			ray = null;
		}
		if(!ray){
			return null;
		}
		const particles = this.starPcs && this.starPcs.particles ? this.starPcs.particles : null;
		const wm = this.starMesh ? this.starMesh.getWorldMatrix() : null;
		const pts = [];
		for(let i = 0; i < this.starCatalog.length; i += 1){
			const star = this.starCatalog[i];
			let p;
			if(particles && particles[i] && particles[i].position){
				p = wm ? BABYLON.Vector3.TransformCoordinates(particles[i].position, wm) : particles[i].position;
			}else{
				p = toSkyVector(star, STAR_RADIUS);
			}
			pts.push({ x: p.x, y: p.y, z: p.z, star });
		}
		const hit = nearestPointToRay(ray.origin, ray.direction, pts, 1.8);
		if(hit && hit.star){
			const enriched = { ...hit.star, kind: 'catalogStar', layer: 'stars' };
			const label = starDisplayLabel(hit.star);
			if(label){ enriched.displayName = label; } // 显示专名/中文名(织女一 Vega…),无则回退星表名
			this.onPick(enriched);
			return enriched;
		}
		return null;
	},

	// 角距测量开关(默认关 → 零回归)。关闭时清起点 + 清连线弧、并清空读数。
	setMeasureMode(on){
		this.measureMode = !!on;
		if(!this.measureMode){
			this.measureFirst = null;
			this.clearMeasureMeshes();
			if(this.onMeasure){ this.onMeasure(null); }
		}
	},

	clearMeasureMeshes(){
		(this.measureMeshes || []).forEach((m)=>{ try{ m.dispose(); }catch(e){} });
		this.measureMeshes = [];
	},

	// 取一次点选的「方向 + 标签」:命中天体用其位置向量+名;空白天区用拾取射线方向+坐标标签。
	measurePointFromTap(hitMesh, hitBody){
		if(hitBody && hitMesh && hitMesh.position){
			const v = hitMesh.position.clone();
			return { vector: v.normalize(), label: bodyName(hitBody) };
		}
		const readout = this.skyReadoutFromPointer();
		if(!readout){ return null; }
		const v = new BABYLON.Vector3(readout.vector.x, readout.vector.y, readout.vector.z);
		const label = `赤经 ${formatRa(readout.ra)} 赤纬 ${formatDeg(readout.decl)}`;
		return { vector: v, label, readout };
	},

	handleMeasureTap(hitMesh, hitBody){
		const point = this.measurePointFromTap(hitMesh, hitBody);
		if(!point || !point.vector){ return; }
		// 第三次点选(已有完整一对)→ 先重置再记新起点。
		if(this.measureFirst && this.measureFirst.done){
			this.measureFirst = null;
			this.clearMeasureMeshes();
			if(this.onMeasure){ this.onMeasure(null); }
		}
		if(!this.measureFirst){
			this.measureFirst = { vector: point.vector, label: point.label, done: false };
			this.clearMeasureMeshes();
			this.drawMeasureMarker(point.vector);
			if(this.onMeasure){
				this.onMeasure({ stage: 'first', startLabel: point.label });
			}
			return;
		}
		// 第二次点选 → 算球面角距 + 画大圆短弧。
		const sep = angularSeparationDeg(this.measureFirst.vector, point.vector);
		this.measureFirst.done = true;
		this.drawMeasureMarker(point.vector);
		this.drawMeasureArc(this.measureFirst.vector, point.vector);
		if(this.onMeasure){
			this.onMeasure({
				stage: 'done',
				startLabel: this.measureFirst.label,
				endLabel: point.label,
				separation: sep,
			});
		}
	},

	drawMeasureMarker(unitVec){
		try{
			const ring = BABYLON.MeshBuilder.CreateTorus(`planetarium-measure-mark-${this.measureMeshes.length}`, { diameter: 18, thickness: 1.3, tessellation: 40 }, this.scene);
			ring.position = unitVec.scale(LINE_RADIUS + 4);
			ring.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			ring.isPickable = false;
			ring.renderingGroupId = 3;
			const mat = new BABYLON.StandardMaterial(`planetarium-measure-mark-mat-${this.measureMeshes.length}`, this.scene);
			mat.emissiveColor = new BABYLON.Color3(0.4, 0.92, 0.78);
			mat.disableLighting = true;
			mat.alpha = 0.95;
			ring.material = mat;
			this.measureMeshes.push(ring);
		}catch(e){ /* 标记失败不影响测量数值 */ }
	},

	// 两方向间的大圆短弧:在单位球上按夹角等分球面插值(slerp),投到 LINE_RADIUS 半径成弧线。
	drawMeasureArc(a, b){
		try{
			const na = a.clone().normalize();
			const nb = b.clone().normalize();
			let dot = clamp(na.x * nb.x + na.y * nb.y + na.z * nb.z, -1, 1);
			const omega = Math.acos(dot);
			const pts = [];
			const SEG = 64;
			if(omega < 1e-4){
				pts.push(na.scale(LINE_RADIUS + 4));
				pts.push(nb.scale(LINE_RADIUS + 4));
			}else{
				const sinOmega = Math.sin(omega);
				for(let i = 0; i <= SEG; i += 1){
					const t = i / SEG;
					const w1 = Math.sin((1 - t) * omega) / sinOmega;
					const w2 = Math.sin(t * omega) / sinOmega;
					const v = new BABYLON.Vector3(
						na.x * w1 + nb.x * w2,
						na.y * w1 + nb.y * w2,
						na.z * w1 + nb.z * w2,
					).normalize();
					pts.push(v.scale(LINE_RADIUS + 4));
				}
			}
			const arc = BABYLON.MeshBuilder.CreateLines('planetarium-measure-arc', { points: pts }, this.scene);
			arc.color = new BABYLON.Color3(0.4, 0.92, 0.78);
			arc.alpha = 0.9;
			arc.isPickable = false;
			arc.renderingGroupId = 3;
			this.measureMeshes.push(arc);
		}catch(e){ /* 画弧失败不影响测量数值 */ }
	},

	// 空白天区读坐标(任务 3):算当前指针方向坐标,经 onSkyReadout 交 React 显示。
	emitSkyReadout(){
		if(!this.onSkyReadout){ return; }
		const readout = this.skyReadoutFromPointer();
		if(readout){ this.onSkyReadout(readout); }
	},

	// 当前指针方向 → 天区坐标(点击空白处读坐标 / 角距测量共用)。
	// 取拾取射线方向(过点击像素的视线单位向量)= 该方向天球坐标;再反算 ra/decl、黄经黄纬、方位高度。
	// 纯天文:真实赤道/黄道(无 zodiacal/宿度/岁差污染)。ground 加大气折射、orbit 几何原貌(与正向一致)。
	skyReadoutFromPointer(){
		if(!this.camera || !this.scene){ return null; }
		let ray = null;
		try{
			const pxy = this.pickXY();
			ray = this.scene.createPickingRay(pxy.x, pxy.y, BABYLON.Matrix.Identity(), this.camera);
		}catch(e){ ray = null; }
		if(!ray || !ray.direction){ return null; }
		return this.skyReadoutFromVector(ray.direction);
	},

	// 由场景方向向量装配整套坐标读数(供指针/已记测量点复用)。
	skyReadoutFromVector(vec){
		if(!vec){ return null; }
		const dir = vec.clone ? vec.clone() : vec;
		const unit = (dir.normalize ? dir.normalize() : dir);
		const horiz = skyDirectionFromVector(unit);
		if(!horiz){ return null; }
		const jd = (this._readoutJd !== undefined && this._readoutJd !== null) ? this._readoutJd : ((this.lastData && this.lastData.observer && this.lastData.observer.jd) || 2451545);
		const observer = this._readoutObserver || observerFromData(this.lastData && this.lastData.observer);
		const applyRefraction = this.refractionActive();
		const eq = horizontalToEquatorial(horiz.altitudeAppa, horiz.azimuth, jd, observer, applyRefraction);
		const ecl = eq ? equatorialToEcliptic(eq.ra, eq.decl, jd) : null;
		return {
			vector: { x: unit.x, y: unit.y, z: unit.z },
			altitudeAppa: horiz.altitudeAppa,
			azimuth: horiz.azimuth,
			ra: eq ? eq.ra : null,
			decl: eq ? eq.decl : null,
			eclLon: ecl ? ecl.lon : null,
			eclLat: ecl ? ecl.lat : null,
		};
	},

	// React 侧在重投影时把当前 jd / observer 喂进来,使空白处读坐标用当前时刻(否则回退 J2000/数据自带)。
	setReadoutContext(jd, observer){
		this._readoutJd = Number.isFinite(Number(jd)) ? Number(jd) : this._readoutJd;
		if(observer){ this._readoutObserver = observer; }
	},

	applyModeBoundVisibility(){
		(this.projectableLines || []).forEach((item)=>{
			if(item && item.mesh && item.visibilityMode){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
		});
		(this.projectableMeshes || []).forEach((item)=>{
			if(item && item.mesh && item.visibilityMode){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
		});
	},

	applyLayerVisibility(){
		this.groups.forEach((group)=>{
			if(group.name.indexOf('stars-layer') === 0){
				group.setEnabled(!!this.layers.stars);
			}else if(group.name.indexOf('bright-stars-layer') === 0){
				group.setEnabled(!!this.layers.stars);
			}else if(group.name.indexOf('body-layer') === 0){
				group.setEnabled(!!this.layers.bodies);
			}else if(group.name.indexOf('overlay-layer') === 0){
				group.setEnabled(true);
				group.getChildMeshes().forEach((mesh)=>{
					if(mesh.name.indexOf('horizon') >= 0){ mesh.setEnabled(!!this.layers.horizon); }
					else if(mesh.name.indexOf('meridian') >= 0){ mesh.setEnabled(!!this.layers.horizon); }
					else if(mesh.name.indexOf('equator') >= 0){ mesh.setEnabled(!!this.layers.equator); }
					else if(mesh.name.indexOf('ecliptic') >= 0){ mesh.setEnabled(!!this.layers.ecliptic); }
					else if(mesh.name.indexOf('house') >= 0){ mesh.setEnabled(!!this.layers.houses); }
				});
			}else if(group.name.indexOf('su28-layer') === 0){
				group.setEnabled(!!this.layers.su28);
			}else if(group.name.indexOf('su28-sector-layer') === 0){
				group.setEnabled(!!this.layers.su28Sectors);
			}else if(group.name.indexOf('zodiac-sector-layer') === 0){
				group.setEnabled(!!this.layers.zodiacSectors);
			}else if(group.name.indexOf('beidou-layer') === 0){
				group.setEnabled(!!this.layers.beidou);
			}else if(group.name.indexOf('grid-horizontal-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.horizontalGrid);
			}else if(group.name.indexOf('grid-equatorial-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.equatorialGrid);
			}else if(group.name.indexOf('grid-ecliptic-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.eclipticGrid);
			}else if(group.name.indexOf('grid-su28-layer') === 0){
				group.setEnabled(!!this.layers.su28Grid);
			}else if(group.name.indexOf('scale-equator-layer') === 0){
				group.setEnabled(!!this.layers.raHourScale);
			}else if(group.name.indexOf('scale-ecliptic-layer') === 0){
				group.setEnabled(!!this.layers.eclipticDegreeScale);
			}else if(group.name.indexOf('scale-horizon-layer') === 0){
				group.setEnabled(!!this.layers.azimuthScale);
			}else if(group.name.indexOf('scale-meridian-layer') === 0){
				group.setEnabled(!!this.layers.altitudeScale);
			}else if(group.name.indexOf('galactic-layer') === 0){
				group.setEnabled(!!this.layers.galacticEquator);
			}else if(group.name.indexOf('precession-layer') === 0){
				group.setEnabled(!!this.layers.precessionCircle);
			}else if(group.name.indexOf('analemma-layer') === 0){
				group.setEnabled(!!this.layers.analemma);
			}else if(group.name.indexOf('sanyuan-layer') === 0){
				group.setEnabled(!!this.layers.threeEnclosures);
			}else if(group.name.indexOf('constellation-line-layer') === 0){
				group.setEnabled(!!this.layers.constellationLines);
			}else if(group.name.indexOf('constellation-bound-layer') === 0){
				group.setEnabled(!!this.layers.constellationBounds);
			}else if(group.name.indexOf('milkyway-layer') === 0){
				group.setEnabled(!!this.layers.milkyWay);
			}else if(group.name.indexOf('starname-layer') === 0){
				group.setEnabled(!!this.layers.starNames);
			}else if(group.name.indexOf('asterism-xingguan-layer') === 0){
				// 分片建造没完之前整组不露(见 ensureChineseAsterismsBuilt);建完由它再调一次本方法露出。
				group.setEnabled(!!this.layers.xingguan && !this._asterismBuildJob);
			}else if(group.name.indexOf('asterism-trails-layer') === 0){
				group.setEnabled(!!this.layers.planetTrails);
			}else if(group.name.indexOf('pole-layer') === 0){
				group.setEnabled(true);
				group.getChildMeshes().forEach((m)=>{
					const tag = (m.metadata && m.metadata.poleId) || m.name || '';
					const on = tag.indexOf('ecliptic-pole') >= 0 ? this.layers.eclipticPoles : (tag.indexOf('galactic-pole') >= 0 ? this.layers.galacticPoles : this.layers.celestialPoles);
					m.setEnabled(!!on);
				});
			}
		});
		this.applyModeBoundVisibility();
	},

	layerAllowsMesh(mesh){
		if(!mesh){
			return true;
		}
		const name = mesh.name || '';
		const parentName = mesh.parent && mesh.parent.name ? mesh.parent.name : '';
		if(parentName.indexOf('overlay-layer') === 0){
			if(name.indexOf('horizon') >= 0 || name.indexOf('meridian') >= 0){ return !!this.layers.horizon; }
			if(name.indexOf('equator') >= 0){ return !!this.layers.equator; }
			if(name.indexOf('ecliptic') >= 0){ return !!this.layers.ecliptic; }
			if(name.indexOf('house') >= 0){ return !!this.layers.houses; }
		}
		if(parentName.indexOf('su28-sector-layer') === 0){
			return !!this.layers.su28Sectors;
		}
		if(parentName.indexOf('zodiac-sector-layer') === 0){
			return !!this.layers.zodiacSectors;
		}
		const md = mesh.metadata || {};
		if(md.gridKey){
			if(md.labelKind === 'gridCoord'){ return !!this.layers[md.gridKey] && !!this.layers.coordLabels; }
			return !!this.layers[md.gridKey];
		}
		if(parentName.indexOf('scale-equator-layer') === 0){ return !!this.layers.raHourScale; }
		if(parentName.indexOf('scale-ecliptic-layer') === 0){ return !!this.layers.eclipticDegreeScale; }
		if(parentName.indexOf('scale-horizon-layer') === 0){ return !!this.layers.azimuthScale; }
		if(parentName.indexOf('scale-meridian-layer') === 0){ return !!this.layers.altitudeScale; }
		if(parentName.indexOf('galactic-layer') === 0){ return !!this.layers.galacticEquator; }
		if(parentName.indexOf('milkyway-layer') === 0){ return !!this.layers.milkyWay; }
		if(parentName.indexOf('precession-layer') === 0){ return !!this.layers.precessionCircle; }
		if(parentName.indexOf('analemma-layer') === 0){ return !!this.layers.analemma; }
		if(parentName.indexOf('sanyuan-layer') === 0){ return !!this.layers.threeEnclosures; }
		if(parentName.indexOf('constellation-line-layer') === 0){ return !!this.layers.constellationLines; }
		if(parentName.indexOf('constellation-bound-layer') === 0){ return !!this.layers.constellationBounds; }
		if(parentName.indexOf('starname-layer') === 0){ return !!this.layers.starNames; }
		if(parentName.indexOf('asterism-xingguan-layer') === 0){ return !!this.layers.xingguan; }
		if(parentName.indexOf('asterism-trails-layer') === 0){ return !!this.layers.planetTrails; }
		if(parentName.indexOf('pole-layer') === 0){
			const tag = md.poleId || name || '';
			if(tag.indexOf('ecliptic-pole') >= 0){ return !!this.layers.eclipticPoles; }
			if(tag.indexOf('galactic-pole') >= 0){ return !!this.layers.galacticPoles; }
			return !!this.layers.celestialPoles;
		}
		return true;
	},
};
