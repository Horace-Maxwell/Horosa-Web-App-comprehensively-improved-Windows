// 3D 星盘 · 参数与重建 / 形变:行星表、选项初值、是否重建、设参、整图重建、形变判定 / 计划 / 逐帧 / 起止、天纬与相位重建、组释放
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import * as AstroConst from '../../../constants/AstroConst';
import { astro3dMorphEnabled } from '../../../utils/perfFlags';
import { sph } from '../sphMath';
import { norm360, shortestArcDelta, easeInOutCubic } from '../morphMath';
import * as AstroHelper from '../../astro/AstroHelper';
import { getPosOffset } from './bodyScale';
import { Y_AXIS } from './sceneConst';

export const paramsMorphMethods = {
	getPlanetsAry(){
		// WS-2:非地心模式只拾取覆盖组天体(本命组隐藏但 Raycaster 不查 visible,
		// 必须整路换源,否则悬浮命中的是看不见的本命行星);地心路径逐字不变
		if(this.chartMode !== 'geo' && this.pctrMode){
			return this.pctrMode.getPickables();
		}
		let ary = [];
		this.planetMap.forEach((item)=>{
			ary.push(item);
		});
		if(!this.chartOpt['隐藏地球附近星体']){
			this.planetEarthMap.forEach((item)=>{
				ary.push(item);
			});
		}
		this.starMap.forEach((item)=>{
			ary.push(item);
		});
		this.beidouMap.forEach((item)=>{
			ary.push(item);
		});
		this.beijiMap.forEach((item)=>{
			ary.push(item);
		});

		if(this.chartOpt['使用虚拟28宿']){
			this.su28VirMap.forEach((item)=>{
				ary.push(item);
			});
		}else{
			this.su28Map.forEach((item)=>{
				ary.push(item);
			});
		}

		return ary;
	},

	initOption(option){
		this.hide = false;
		this.width = option.width;
		this.height = option.height;

		this.radius = this.height / 2 - this.radiusOffset;
		if(this.width < this.height){
			this.radius = this.width / 2 - this.radiusOffset;
		}
		this.earthRadius = this.radius / 2;

		this.chartId = option.chartId;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		this.chartDisp = option.chartDisp ? option.chartDisp : [];
		this.planetDisp = option.planetDisp;
		this.keyPlanets = option.keyPlanets;
		this.chartDispNum = 0;
		for(let i=0; i<this.chartDisp.length; i++){
			let n = this.chartDisp[i];
			this.chartDispNum = this.chartDispNum + n
		}
		if((this.chartDispNum & AstroConst.CHART_3D_EARTH_RADIUS_SAMESKY) === AstroConst.CHART_3D_EARTH_RADIUS_SAMESKY){
			this.earthRadius = this.radius;
		}
	},

	needRecreate(option){
		if(option.chartObj && this.chartObj != option.chartObj){
			return true;
		}

		if(option.chartDisp){
			let num = 0;
			for(let i=0; i<option.chartDisp.length; i++){
				num = num + option.chartDisp[i];
			}
			if(num !== this.chartDispNum){
				return true;
			}
		}
		if(option.planetDisp){
			for(let key of option.planetDisp){
				if(!this.planetDisp.has(key)){
					return true;
				}
			}
			for(let key of this.planetDisp){
				if(!option.planetDisp.has(key)){
					return true;
				}
			}
		}

		return false;
	},

	setParams(option){
		this.hide = false;
		this.wake(2);   // 唤醒源②:参数变化(含 hide→show,按需渲染下 idle 已停帧)
		let flag = this.needRecreate(option);
		if(!flag){
			// 父组件经常会生成新的 fields 对象引用，这里只同步参数，避免无意义重建 3D 场景。
			if(option.fields){
				this.fields = option.fields;
			}
			if(option.chartObj){
				this.chartObj = option.chartObj;
			}
			this.disposed = false;
			return;
		}

		// WS-1b 改时间滑移补间:仅 chartObj 变化(坐标语义/显示集合未变)时不全量重建,
		// 行星沿最短弧 tween 滑到新位。kill-switch horosa.perf.astro3dMorph=0 → 旧全量重建。
		if(astro3dMorphEnabled() && this.canMorph(option) && this.updateFromChart(option.chartObj, option.fields)){
			this.disposed = false;
			return;
		}

		this._morphToken = (this._morphToken || 0) + 1;   // 全量重建接管:取消在途补间
		this._tweenActive = false;
		this.disposeMesh();
		this.initOption(option);
		this.chartOpt.maxEarthRadius = this.radius - 20;
		this.rebuildSceneGraph();
		this.disposed = false;
	},

	// 场景骨架重建(setParams 全量路径与补间交账兜底共用;逐字保留旧 setParams 建组顺序)
	rebuildSceneGraph(){
		this.skyGroup = new THREE.Group();
		this.earthGroup = new THREE.Group();
		this.lightGroup = new THREE.Group();
		this.group = new THREE.Group();
		this.group.add(this.skyGroup);
		this.group.add(this.earthGroup);
		this.group.add(this.lightGroup);

		this.starGroup = new THREE.Group();
		this.beidouGroup = new THREE.Group();
		this.beijiGroup = new THREE.Group();
		this.su28Group = new THREE.Group();
		this.su28VirGroup = new THREE.Group();
		this.doubingGroup = new THREE.Group();

		this.group.add(this.starGroup);
		this.group.add(this.beidouGroup);
		this.group.add(this.beijiGroup);
		this.group.add(this.su28Group);
		this.group.add(this.su28VirGroup);
		this.group.add(this.doubingGroup);

		this.scene.add(this.group);

		this.initLight();
		this.initMesh();

		// WS-2:非地心模式下的全量重建(改显示集合等)不得把本命组重新亮出来;
		// 地心模式(默认)此判恒假,零行为变化
		if(this.chartMode !== 'geo'){
			this.group.visible = false;
		}
	},

	/** 坐标语义字段读值(fields 形态 {key:{value}};缺省视为 undefined) */
	morphFieldVal(fields, key){
		if(!fields || !fields[key]){
			return undefined;
		}
		return fields[key].value;
	},

	/** 是否允许补间:仅「同一张盘换时间/地点」型 chartObj 变化;语义/显示集合变化一律全量重建 */
	canMorph(option){
		if(!this.scene || !this.group || !this.skyGroup || this._contextLost){
			return false;
		}
		if(!option.chartObj || !this.chartObj || option.chartObj === this.chartObj){
			return false;
		}
		if(option.width !== this.width || option.height !== this.height){
			return false;   // 尺寸变化牵动 radius,全量重建
		}
		if(option.chartDisp){
			let num = 0;
			for(let i = 0; i < option.chartDisp.length; i++){
				num = num + option.chartDisp[i];
			}
			if(num !== this.chartDispNum){
				return false;
			}
		}
		if(option.planetDisp){
			if(!this.planetDisp || option.planetDisp.size !== this.planetDisp.size){
				return false;
			}
			for(let key of option.planetDisp){
				if(!this.planetDisp.has(key)){
					return false;
				}
			}
		}
		// 黄道制/宫位制/南北盘 = 坐标语义,任一变化必须全量重建
		const semanticKeys = ['zodiacal', 'hsys', 'southchart'];
		for(let i = 0; i < semanticKeys.length; i++){
			const key = semanticKeys[i];
			if(this.morphFieldVal(this.fields, key) !== this.morphFieldVal(option.fields, key)){
				return false;
			}
		}
		return true;
	},

	/**
	 * 补间主入口:构建补间计划(旧盘当前视觉态 → 新盘目标态)→ 提交新盘参数 → 启动 tween。
	 * 返回 false = 本次不可补间(缺对象/异常),调用方回落全量重建路径。
	 */
	updateFromChart(newChartObj, newFields){
		let plan = null;
		try{
			plan = this.buildMorphPlan(this.chartObj, newChartObj, newFields);
		}catch(e){
			plan = null;
		}
		if(!plan){
			return false;
		}
		if(newFields){
			this.fields = newFields;
		}
		this.chartObj = newChartObj;
		// 悬浮提示数据即时切新盘(补间过程中查看的是目标盘数据,避免「看着新盘读旧数」)
		plan.planets.forEach((item)=>{
			item.mesh.planet = item.planet;
		});
		this.startMorph(plan);
		return true;
	},

	/** 构建补间计划;任何必需对象缺失返回 null(回落全量重建) */
	buildMorphPlan(oldChart, newChart, newFields){
		if(!oldChart || !oldChart.chart || !newChart || !newChart.chart){
			return null;
		}
		const ascOld = AstroHelper.getObject(oldChart, AstroConst.ASC);
		const ascNew = AstroHelper.getObject(newChart, AstroConst.ASC);
		const sunOld = AstroHelper.getObject(oldChart, AstroConst.SUN);
		const sunNew = AstroHelper.getObject(newChart, AstroConst.SUN);
		if(!ascOld || !ascNew || ascNew.lon === undefined || !sunOld || !sunNew || sunNew.lon === undefined){
			return null;
		}

		// 行星(天球圈 planetMap + 地球圈 planetEarthMap 同法):起点取当前视觉态
		// (userData._vLon/_vLat,补间中途被新补间接管时从中间态续跑),终点取新盘。
		// 姿态基准四元数惰性反解一次:现姿态 = 基准 ∘ rotY(vLon+90) → 基准 = 现姿态 ∘ rotY(−(vLon+90))。
		const planets = [];
		let complete = true;
		const collect = (map)=>{
			map.forEach((mesh, id)=>{
				if(!complete){
					return;
				}
				const target = AstroHelper.getObject(newChart, id);
				if(!target || target.lon === undefined || target.lat === undefined){
					complete = false;
					return;
				}
				const ud = mesh.userData || (mesh.userData = {});
				const fromLon = ud._vLon !== undefined ? ud._vLon : (mesh.planet ? mesh.planet.lon : target.lon);
				const fromLat = ud._vLat !== undefined ? ud._vLat : (mesh.planet ? mesh.planet.lat : target.lat);
				if(!ud._baseQuat){
					const unspin = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -(fromLon + 90) * Math.PI / 180);
					ud._baseQuat = mesh.quaternion.clone().multiply(unspin);
				}
				planets.push({
					mesh: mesh,
					planet: target,
					fromLon: fromLon,
					fromLat: fromLat,
					dLon: shortestArcDelta(fromLon, target.lon),
					toLat: target.lat,
					r: mesh.position.length(),
				});
			});
		};
		collect(this.planetMap);
		collect(this.planetEarthMap);
		if(!complete){
			return null;
		}

		// 宫轴组:按宫 id 配对同旋(组建盘时子对象已含 _builtLon 旋转,补间只旋差值)
		let houses = null;
		if(this.houseGroup && newChart.chart.houses){
			const lonById = new Map();
			newChart.chart.houses.forEach((h)=>{
				lonById.set(h.id, h.lon);
			});
			houses = [];
			for(let i = 0; i < this.houseGroup.children.length; i++){
				const grp = this.houseGroup.children[i];
				const ud = grp.userData || {};
				if(ud._houseId === undefined || ud._builtLon === undefined || !lonById.has(ud._houseId)){
					houses = null;   // 新旧宫集不齐 = 异常盘,宫轴留待终帧精确重建
					break;
				}
				const from = ud._vLon !== undefined ? ud._vLon : ud._builtLon;
				houses.push({
					grp: grp,
					from: from,
					builtLon: ud._builtLon,
					dLon: shortestArcDelta(from, lonById.get(ud._houseId)),
				});
			}
		}

		// ASC 整组旋转(恒星/28宿/网格全体随之;与全量重建的 group.rotateY(270−asc) 同口径)
		const gud = this.group.userData || (this.group.userData = {});
		const ascFrom = gud._vAscLon !== undefined ? gud._vAscLon : ascOld.lon;

		// 太阳光方向跟随(位置公式与 initLight 逐字同构)
		let sun = null;
		if(this.sunDirectLight){
			const lud = this.sunDirectLight.userData || (this.sunDirectLight.userData = {});
			const fromLon = lud._vLon !== undefined ? lud._vLon : sunOld.lon;
			const fromLat = lud._vLat !== undefined ? lud._vLat : sunOld.lat;
			sun = {
				fromLon: fromLon,
				fromLat: fromLat,
				dLon: shortestArcDelta(fromLon, sunNew.lon),
				toLat: sunNew.lat,
			};
		}

		// 地球自转跟随(建盘转角 = MC黄经 − 出生地经度,genEarth 已记 _mcDelta)
		let earth = null;
		if(this.earthMesh && this.earthMesh.userData && this.earthMesh.userData._mcDelta !== undefined){
			const mcNew = AstroHelper.getObject(newChart, AstroConst.MC);
			let gpslon = newChart.params ? newChart.params.gpsLon : undefined;
			if((gpslon === undefined || gpslon === null) && newFields && newFields.gpsLon){
				gpslon = newFields.gpsLon.value;
			}
			if(mcNew && mcNew.lon !== undefined && gpslon !== undefined && gpslon !== null){
				const ud = this.earthMesh.userData;
				const fromDelta = ud._vDelta !== undefined ? ud._vDelta : ud._mcDelta;
				if(!ud._baseQuat){
					const unspin = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -fromDelta * Math.PI / 180);
					ud._baseQuat = this.earthMesh.quaternion.clone().multiply(unspin);
				}
				earth = {
					fromDelta: fromDelta,
					dDelta: shortestArcDelta(fromDelta, mcNew.lon - gpslon),
				};
			}
		}

		return {
			planets: planets,
			houses: houses,
			ascFrom: ascFrom,
			ascDelta: shortestArcDelta(ascFrom, ascNew.lon),
			sun: sun,
			earth: earth,
		};
	},

	/** 按缓动进度 e∈[0,1] 落一帧补间(e=1 即新盘精确终值) */
	applyMorphFrame(plan, e){
		const DEG = Math.PI / 180;
		const spin = this._morphSpinQuat || (this._morphSpinQuat = new THREE.Quaternion());
		plan.planets.forEach((item)=>{
			const lon = norm360(item.fromLon + item.dLon * e);
			const lat = item.fromLat + (item.toLat - item.fromLat) * e;
			const p = sph(lon, lat, item.r);
			item.mesh.position.set(p.x, p.y, p.z);
			if(item.mesh.userData._baseQuat){
				spin.setFromAxisAngle(Y_AXIS, (lon + 90) * DEG);
				item.mesh.quaternion.copy(item.mesh.userData._baseQuat).multiply(spin);
			}
			item.mesh.userData._vLon = lon;
			item.mesh.userData._vLat = lat;
		});
		if(plan.houses){
			plan.houses.forEach((h)=>{
				const lon = h.from + h.dLon * e;
				h.grp.rotation.y = (lon - h.builtLon) * DEG;
				h.grp.userData._vLon = norm360(lon);
			});
		}
		const asc = plan.ascFrom + plan.ascDelta * e;
		const prevRotY = this.group.rotation.y;
		this.group.rotation.y = (270 - asc) * DEG;
		this.group.userData._vAscLon = norm360(asc);
		this.rotateCameraWithGroup((this.group.rotation.y - prevRotY) * 180 / Math.PI);   // 相机随盘面同框架
		if(plan.sun && this.sunDirectLight){
			const lon = norm360(plan.sun.fromLon + plan.sun.dLon * e);
			const lat = plan.sun.fromLat + (plan.sun.toLat - plan.sun.fromLat) * e;
			const p = sph(lon, lat, this.radius + getPosOffset(AstroConst.SUN));
			this.sunDirectLight.position.set(p.x, p.y, p.z);
			this.sunDirectLight.userData._vLon = lon;
			this.sunDirectLight.userData._vLat = lat;
		}
		if(plan.earth && this.earthMesh && this.earthMesh.userData._baseQuat){
			const delta = plan.earth.fromDelta + plan.earth.dDelta * e;
			spin.setFromAxisAngle(Y_AXIS, delta * DEG);
			this.earthMesh.quaternion.copy(this.earthMesh.userData._baseQuat).multiply(spin);
			this.earthMesh.userData._vDelta = delta;
		}
	},

	/** 启动 ~600ms 补间(手写 rAF,同 flyToPreset 范式不引 gsap;token 支持连续拨时间中途接管) */
	startMorph(plan){
		this._morphToken = (this._morphToken || 0) + 1;
		const token = this._morphToken;
		// 起步即撤旧相位线:端点在动,旧连线悬空(终帧按新盘重建+淡入)
		this.clearAspects();
		const t0 = performance.now();
		const dur = 600;
		this._tweenActive = true;   // 挂按需渲染:needsFrames() 持续为真,rAF 渲染循环不停
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._morphToken){
				return;   // 新补间/全量重建已接管(不碰 _tweenActive,由接管方主导)
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			this.applyMorphFrame(plan, easeInOutCubic(t));
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this.finishMorph(plan, token);
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	/** 终帧交账:补间只负责过程,落点按新盘走与全量重建同一批生成函数精确重建 */
	finishMorph(plan, token){
		if(this.disposed || token !== this._morphToken){
			return;
		}
		try{
			this.applyMorphFrame(plan, 1);
			this.initHouses(this.radius, AstroConst.Astro3DColor.SkyLine);
			this.initAxesLines();
			this.rebuildSkyLat();
			this.initEarth();
			if(this.chartOpt['隐藏地球附近星体']){
				this.hideEarthPlanets();
			}
			this.rebuildAspectsWithFade();
		}catch(e){
			// 交账失败兜底:整场全量重建,保证最终画面以新盘为准
			this._morphToken = (this._morphToken || 0) + 1;
			this._tweenActive = false;
			this.disposeMesh();
			this.rebuildSceneGraph();
			this.disposed = false;
		}
		this.wake(2);
	},

	/** 终帧交账:天球纬圈组(含 ASC/MC 黄纬特征圈)按新盘重建 */
	rebuildSkyLat(){
		if(this.skyLatGroup && this.skyLatGroup.parent){
			this.skyLatGroup.parent.remove(this.skyLatGroup);
			this.disposeGroupDeep(this.skyLatGroup);
		}
		this.skyLatGroup = this.initLatLine(this.radius, AstroConst.Astro3DColor.SkyLine, true);
		this.skyGroup.add(this.skyLatGroup);
	},

	/** 撤下全部相位线(补间起步用;组保留在 skyGroup 挂点上) */
	clearAspects(){
		if(this.aspectGroup){
			this.disposeGroupDeep(this.aspectGroup);
			this.aspectGroup.children = [];
		}
	},

	/** 终帧按新盘重建相位线并 240ms 淡入(材质临时开 transparent,完成后还原) */
	rebuildAspectsWithFade(){
		this.initAspects();
		if(!this.aspectGroup || !this.aspectGroup.children.length){
			return;
		}
		const mats = [];
		this.aspectGroup.traverse((node)=>{
			if(node.material){
				node.material.transparent = true;
				node.material.opacity = 0;
				mats.push(node.material);
			}
		});
		const token = this._morphToken;
		const t0 = performance.now();
		const dur = 240;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed || token !== this._morphToken){
				return;   // 已被新补间/重建接管:材质随组销毁,不再触碰
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			mats.forEach((m)=>{
				m.opacity = t;
			});
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				mats.forEach((m)=>{
					m.opacity = 1;
					m.transparent = false;
					m.needsUpdate = true;
				});
				this._tweenActive = false;
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	// 深清组:Line/Sprite 也释放(既有 disposeGroup 只认 Mesh —— 补间热路径反复重建
	// 相位线/宫轴/纬圈,沿用其口径会漏线材质;sprite 贴图为每标签独享 canvas 纹理,一并释放。
	// 对已清过的对象重复 dispose 幂等,安全)
	disposeGroupDeep(grp){
		if(!grp){
			return;
		}
		grp.traverse((node)=>{
			if(node.geometry){
				node.geometry.dispose();
			}
			if(node.material){
				if(node.material.map && node.material.map.dispose){
					node.material.map.dispose();
				}
				node.material.dispose();
			}
		});
	},
};
