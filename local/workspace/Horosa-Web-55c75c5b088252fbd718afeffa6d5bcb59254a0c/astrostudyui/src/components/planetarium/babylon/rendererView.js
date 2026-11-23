// 天文馆渲染器 · 图层与视角:图层 / 折射 / 地平下 / 星等开关、地面元素、相机位置与目标、视角切换动画、飞向与定位脉冲
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { findStarByName, starDisplayLabel } from '../planetariumStarSearch';
import { matchesUserQuery, scriptTextEquals } from '../../../utils/scriptMode';
import { BABYLON, STAR_RADIUS, LINE_RADIUS, OBSERVER_EYE_HEIGHT, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX } from './constants';
import { nowMs, clamp, starTemperatureColor, toSkyVector, cameraRotationForDirection, easeInOutCubic, lerpNumber } from './skyMath';

export const rendererViewMethods = {
	setLayers(layers){
		this.layers = {...this.layers, ...(layers || {})};
		this.applyLayerVisibility();
	},

	// 大气折射是否生效:仅地表观测(ground)且大气层(atmosphere)开启时加折射(地平附近抬升)。
	// 关大气层 → 真空几何,星体按真高度;天球外观(orbit)本就几何原貌,不折射。默认 atmosphere=true → 字节级零回归。
	refractionActive(){
		return this.viewMode === 'ground' && !!(this.layers && this.layers.atmosphere);
	},

	// 关「地面」(地表观测下)→ 显示地平线以下整个天球:宿区间等 mode-bound 元素不再按地平裁剪。
	showBelowHorizon(){
		return this.viewMode === 'ground' && !(this.layers && this.layers.ground);
	},

	// 星等是否在当前上限内可见。默认上限(STAR_MAG_LIMIT_MAX)= 不设限 → 任何星都过(字节级零回归,
	// 即使后端偶发送来 mag>6.5 的星也照旧显示);非默认上限才按 mag<=limit 过滤。
	magVisible(mag){
		if(this.magLimit >= STAR_MAG_LIMIT_MAX){ return true; }
		return Number(mag) <= this.magLimit;
	},

	// 星等过滤:仅改恒星粒子 alpha + 亮星球可见性,不重拉数据、不动坐标(纯天文,位置由真实赤道投影决定)。
	// 默认上限 STAR_MAG_LIMIT_MAX(6.5)时无星被隐藏 → 与现状字节一致(零回归)。
	setMagLimit(magLimit){
		const next = Number(magLimit);
		this.magLimit = Number.isFinite(next) ? clamp(next, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX) : STAR_MAG_LIMIT_MAX;
		// 升高到已建上限之上 → 重建补齐更暗的星(构建期只建了 ≤ 旧上限);降低/同级 → 走下方 alpha 隐藏即可(不重建,瞬时)。
		if(this.starFullCatalog && this.magLimit > (this.starBuiltMagLimit || 0) + 1e-6 && !this.starBuildPending){
			this.updateStars(this.starFullCatalog);
			return;
		}
		if(this.starPcs && this.starPcs.particles && this.starCatalog && this.starCatalog.length === this.starPcs.particles.length){
			this.starCatalog.forEach((star, idx)=>{
				const particle = this.starPcs.particles[idx];
				if(!particle){ return; }
				const mag = Number(star.mag || 5);
				const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
				const c = starTemperatureColor(star, b);
				const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
				particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
			});
			if(this.starPcs.setParticles){ this.starPcs.setParticles(); }
		}
		// 亮星球(mag≤1.5 的发光小球)同步按上限显隐。
		if(this.starCatalog && this.starCatalog.length){
			this.updateBrightStars(this.starCatalog);
		}
	},

	setGroundElementsEnabled(enabled){
		// 地面元素最终显隐 = 处于地表观测(enabled) 且 「地面」开关开。关地面 → 看到地平线以下整个天球。
		// 地面 = 照片全景(唯一样式);horizonMist 为地平柔光带。此前另建一枚从不启用的「程序化地面盘」(无键无入口),已删。
		const groundOn = enabled && !!(this.layers && this.layers.ground);
		if(this.groundOccluder){
			this.groundOccluder.setEnabled(false);
		}
		if(this.horizonPanorama){
			this.horizonPanorama.setEnabled(groundOn);
		}
		if(this.horizonMist){
			this.horizonMist.setEnabled(groundOn);
		}
		(this.landscapeMeshes || []).forEach((mesh)=>mesh.setEnabled(groundOn));
	},

	// 「地面」开关切换后:按当前模式重算地面显隐(viewMode 不变,只是 layers.ground 变了)。
	refreshGroundLayer(){
		this.setGroundElementsEnabled(this.viewMode === 'ground');
		this.applyModeBoundVisibility(); // 关地面立即让地平线以下的宿区间等显示(不等下一次重投影)
	},

	// 「大气层」开关切换后:用最近一帧 sky 数据重画天空(黑/恢复昼夜),不重取后端。
	refreshSky(){
		this.updateSky(this.lastData || {});
	},

	updateGroundScenePosition(){
		if(this.viewMode !== 'ground' || !this.camera){
			return;
		}
		const position = this.cameraPosition(this.camera);
		[this.horizonPanorama, this.horizonMist].forEach((mesh)=>{
			if(mesh){
				mesh.position.x = position.x;
				mesh.position.z = position.z;
			}
		});
	},

	cameraPosition(camera){
		if(!camera){
			return BABYLON.Vector3.Zero();
		}
		if(camera.globalPosition){
			return camera.globalPosition.clone();
		}
		return camera.position ? camera.position.clone() : BABYLON.Vector3.Zero();
	},

	cameraTarget(camera, fallbackDistance = LINE_RADIUS){
		if(!camera){
			return new BABYLON.Vector3(0, 80, LINE_RADIUS);
		}
		if(camera.target){
			return camera.target.clone();
		}
		const position = this.cameraPosition(camera);
		if(camera.getForwardRay){
			const ray = camera.getForwardRay(fallbackDistance);
			return position.add(ray.direction.scale(fallbackDistance));
		}
		return position.add(new BABYLON.Vector3(0, 0, fallbackDistance));
	},

	setFreeCameraView(camera, position, target, fov){
		camera.position.copyFrom(position);
		camera.setTarget(target);
		camera.fov = fov;
	},

	prepareOrbitDestination(){
		this.orbitCamera.target = BABYLON.Vector3.Zero();
		this.orbitCamera.radius = Math.max(1120, this.orbitCamera.radius || 1120);
		this.orbitCamera.beta = clamp(this.orbitCamera.beta || Math.PI * 0.42, 0.18, Math.PI * 0.82);
		return {
			position: this.cameraPosition(this.orbitCamera),
			target: this.orbitCamera.target.clone(),
			fov: this.orbitCamera.fov || 0.8,
		};
	},

	completeViewMode(nextMode, nextCamera){
		if(this.camera && this.camera.detachControl){
			this.camera.detachControl(this.canvas);
		}
		// 🆕 旧 camera 上的 lockedTarget 清掉(避免 stale 引用);若仍有 _followMesh,下面在新 camera 上重设
		if(this.camera){ this.camera.lockedTarget = null; }
		this.viewTransition = null;
		this.viewMode = nextMode;
		this.camera = nextCamera;
		if(this._followMesh && this.camera){
			this.camera.lockedTarget = this._followMesh;
		}
		this.scene.activeCamera = nextCamera;
		if(nextMode === 'ground'){
			this.groundCamera.position = new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0);
			this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
			this.groundCamera.fov = 1.08;
		}
		this.setGroundElementsEnabled(nextMode === 'ground');
		this.updateSky(this.lastData || {}); // orbit→暗背景 / ground→恢复昼夜天空
		nextCamera.attachControl(this.canvas, true);
		this.applyLabelVisibility();
		this.applyModeBoundVisibility();
	},

	animateViewTransition(nextMode, nextCamera){
		if(!this.transitionCamera || !this.scene){
			this.completeViewMode(nextMode, nextCamera);
			return;
		}
		if(this.viewTransition && this.viewTransition.cancel){
			this.viewTransition.cancel();
		}
		const startCamera = this.camera || this.scene.activeCamera || nextCamera;
		const oldMode = this.viewMode;
		if(startCamera && startCamera.detachControl){
			startCamera.detachControl(this.canvas);
		}
		const startPosition = this.cameraPosition(startCamera);
		const startTarget = this.cameraTarget(startCamera);
		const startFov = startCamera && startCamera.fov ? startCamera.fov : 0.92;
		const destination = nextMode === 'ground'
			? {
				position: new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
				target: new BABYLON.Vector3(0, 110, 760),
				fov: 1.08,
			}
			: this.prepareOrbitDestination();
		const transition = {
			cancelled: false,
			cancel(){
				this.cancelled = true;
			},
		};
		this.viewTransition = transition;
		this.viewMode = nextMode;
		this.camera = this.transitionCamera;
		this.scene.activeCamera = this.transitionCamera;
		this.updateSky(this.lastData || {}); // 切 orbit 立即暗化背景
		this.setGroundElementsEnabled(nextMode === 'ground' || oldMode === 'ground');
		this.setFreeCameraView(this.transitionCamera, startPosition, startTarget, startFov);
		const duration = 1450;
		const started = nowMs();
		const tick = ()=>{
			if(transition.cancelled || this.disposed || !this.scene){
				return;
			}
			const t = easeInOutCubic((nowMs() - started) / duration);
			const position = BABYLON.Vector3.Lerp(startPosition, destination.position, t);
			const target = BABYLON.Vector3.Lerp(startTarget, destination.target, t);
			const fov = lerpNumber(startFov, destination.fov, t);
			this.setFreeCameraView(this.transitionCamera, position, target, fov);
			if(nextMode === 'orbit' && t > 0.72){
				this.setGroundElementsEnabled(false);
			}
			if(t < 1){
				requestAnimationFrame(tick);
				return;
			}
			this.completeViewMode(nextMode, nextCamera);
		};
		requestAnimationFrame(tick);
	},

	setViewMode(mode, animate = true){
		const nextMode = mode === 'orbit' ? 'orbit' : 'ground';
		const nextCamera = nextMode === 'orbit' ? this.orbitCamera : this.groundCamera;
		if(!nextCamera){
			return;
		}
		if(this.camera && this.viewMode === nextMode && this.camera !== this.transitionCamera){
			this.setGroundElementsEnabled(nextMode === 'ground');
			if(this.scene && this.scene.activeCamera !== this.camera){
				this.scene.activeCamera = this.camera;
			}
			if(this.camera.attachControl){
				this.camera.attachControl(this.canvas, true);
			}
			return;
		}
		if(animate && this.camera && this.scene && this.scene.activeCamera){
			this.animateViewTransition(nextMode, nextCamera);
			return;
		}
		if(this.camera && this.camera.detachControl){
			this.camera.detachControl(this.canvas);
		}
		this.viewMode = nextMode;
		this.camera = nextCamera;
		this.scene.activeCamera = nextCamera;
		nextCamera.attachControl(this.canvas, true);
		if(nextMode === 'ground'){
			this.groundCamera.position = new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0);
			this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
			this.groundCamera.fov = 1.08;
		}
		this.setGroundElementsEnabled(nextMode === 'ground');
		this.applyLabelVisibility();
		this.applyModeBoundVisibility();
	},

	flyTo(itemOrKey){
		if(!itemOrKey || !this.camera){
			return false;
		}
		let mesh = null;
		let starHit = null;
		if(typeof itemOrKey === 'string'){
			const query = itemOrKey.trim();
			mesh = this.bodyMeshes[query];
			if(!mesh){
				// 名字比对经单源(界面繁体时照屏幕输入「太陽」也能找到「太阳」):先认整名,再认包含;简体模式与原先逐字节等价
				const names = Object.keys(this.bodyMeshes);
				const found = names.find((name)=>scriptTextEquals(name, query, { ci: false })) || names.find((name)=>matchesUserQuery(name, query));
				mesh = found ? this.bodyMeshes[found] : null;
			}
			if(!mesh && this.starIndex){
				starHit = findStarByName(this.starIndex, query); // 暗星按名搜索兜底
			}
		}else{
			mesh = this.bodyMeshes[itemOrKey.id] || this.bodyMeshes[itemOrKey.name] || this.bodyMeshes[itemOrKey.displayName];
		}
		if(!mesh && !starHit){
			return false;
		}
		const pos = mesh ? mesh.position : toSkyVector(starHit, STAR_RADIUS);
		if(this.viewMode === 'orbit'){
			// 天球外观:把目标精确居中。ArcRotateCamera 绕球心(target=0)旋转 → 相机移到目标方向的对侧、
			// 穿过球心看向目标即居中:beta=acos(-ny)、alpha=atan2(-nz,-nx)(n=目标单位向量);并归零 target。
			const n = pos.clone().normalize();
			const beta = clamp(Math.acos(clamp(-n.y, -1, 1)), 0.01, Math.PI - 0.01);
			let alpha = Math.atan2(-n.z, -n.x);
			// 取最短旋转路径(避免绕远)
			while(alpha - this.camera.alpha > Math.PI){ alpha -= 2 * Math.PI; }
			while(alpha - this.camera.alpha < -Math.PI){ alpha += 2 * Math.PI; }
			const radius = clamp(this.camera.radius * 0.85, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-x', this.camera, 'target.x', 60, 30, this.camera.target.x, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-y', this.camera, 'target.y', 60, 30, this.camera.target.y, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-z', this.camera, 'target.z', 60, 30, this.camera.target.z, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-alpha', this.camera, 'alpha', 60, 30, this.camera.alpha, alpha, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-beta', this.camera, 'beta', 60, 30, this.camera.beta, beta, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-radius', this.camera, 'radius', 60, 30, this.camera.radius, radius, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
		}else{
			// 地表观测:相机在观测点向外看,转向目标方向即居中(目标在地平线下则俯视到该方位)。
			const rot = cameraRotationForDirection(pos.subtract(this.camera.position));
			let ry = rot.y;
			while(ry - this.camera.rotation.y > Math.PI){ ry -= 2 * Math.PI; }
			while(ry - this.camera.rotation.y < -Math.PI){ ry += 2 * Math.PI; }
			BABYLON.Animation.CreateAndStartAnimation('planetarium-look-x', this.camera, 'rotation.x', 60, 30, this.camera.rotation.x, rot.x, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-look-y', this.camera, 'rotation.y', 60, 30, this.camera.rotation.y, ry, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-fov', this.camera, 'fov', 60, 26, this.camera.fov, 0.62, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
		}
		// 🆕 持续跟随(Stellarium 风格):mesh follow → 相机 lockedTarget 每帧自动跟随 mesh.position,
		// 即使月亮/行星在播放中移动也始终居中;用户拖动相机(pointerMoveHandler)即取消。
		// 暗星(SolidParticle 粒子云,无独立 mesh)通过隐藏 _followerMesh 中介:每帧 updateProjectedTime 末尾把 starHit 重投影到当前 jd
		// → mutate _followerMesh.position → camera.lockedTarget 跟随 _followerMesh = 跟随选中暗星(地球自转 + 岁差自动覆盖)。
		if(this.camera){
			if(mesh){
				this._followMesh = mesh;
				this._followStar = null;
				this.camera.lockedTarget = mesh;
			}else if(starHit && this._followerMesh){
				this._followStar = { ra: starHit.ra, decl: starHit.decl, name: starHit.name, hipId: starHit.hipId };
				this._followMesh = this._followerMesh;
				this._followerMesh.position.copyFrom(pos);
				this.camera.lockedTarget = this._followerMesh;
			}
		}
		// 高亮定位目标(短暂脉冲环),便于一眼看到中心的天体
		if(mesh){ this.pulseLocate(mesh); }
		if(mesh){
			return mesh.metadata && mesh.metadata.body ? mesh.metadata.body : true;
		}
		const starResult = { ...starHit, kind: 'catalogStar', layer: 'stars' };
		const starLabel = starDisplayLabel(starHit);
		if(starLabel){ starResult.displayName = starLabel; }
		return starResult;
	},

	// 定位高亮:在目标处放一个朝向相机的脉冲环,放大+淡出后自动销毁,便于一眼认出居中天体。
	pulseLocate(mesh){
		try{
			if(!mesh || !this.scene){ return; }
			if(this._locateRing){ try{ this._locateRing.dispose(); }catch(e){} this._locateRing = null; }
			const ring = BABYLON.MeshBuilder.CreateTorus('planetarium-locate-ring', { diameter: 26, thickness: 1.6, tessellation: 48 }, this.scene);
			ring.position.copyFrom(mesh.position);
			ring.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			ring.isPickable = false;
			ring.renderingGroupId = 3;
			const mat = new BABYLON.StandardMaterial('planetarium-locate-mat', this.scene);
			mat.emissiveColor = new BABYLON.Color3(0.85, 0.68, 0.36);
			mat.disableLighting = true;
			mat.alpha = 0.9;
			ring.material = mat;
			this._locateRing = ring;
			BABYLON.Animation.CreateAndStartAnimation('planetarium-locate-scale', ring, 'scaling', 60, 48, new BABYLON.Vector3(0.3, 0.3, 0.3), new BABYLON.Vector3(2.4, 2.4, 2.4), BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-locate-fade', mat, 'alpha', 60, 48, 0.9, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, undefined, ()=>{ try{ ring.dispose(); }catch(e){} if(this._locateRing === ring){ this._locateRing = null; } });
		}catch(e){ /* 高亮失败不影响定位 */ }
	},
};
