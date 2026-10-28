// 天文馆 · Babylon 场景渲染器(整类)。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import {
	eclipticToEquatorial, equatorialToHorizontal, galacticToEquatorial, projectedEquatorialItem, meanObliquityDeg,
	sunEclipticLongitude, precessionMatrixJ2000ToDate, applyPrecessionMatrixInto, isJ2000Item,
} from '../planetariumProjection';
import { nearestPointToRay, buildStarIndex, findStarByName, starDisplayLabel } from '../planetariumStarSearch';
import { matchesUserQuery, scriptTextEquals } from '../../../utils/scriptMode';
import SANYUAN_WALLS from '../../../data/sanyuanWalls.json';
import CONSTELLATION_LINES from '../../../data/constellationLines.json';
import CONSTELLATION_BOUNDS from '../../../data/constellationBounds.json';
import CHINESE_ASTERISMS from '../../../data/chineseAsterisms.json';
import { pointerLocalRatio } from '../../../utils/zoomDomain';
import {
	BABYLON, SKY_RADIUS, BODY_RADIUS, STAR_RADIUS, LINE_RADIUS, OBSERVER_EYE_HEIGHT, GROUND_MIN_FOV,
	GROUND_MAX_FOV, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS, HORIZON_PANORAMA_URL, STAR_MAG_LIMIT_MIN,
	STAR_MAG_LIMIT_MAX, BODY_COLORS, TEXTURED_BODY_IDS, ALWAYS_LABELED_BODY_IDS, BODY_VISUALS, DEFAULT_LAYERS,
	SU28_PALACE_COLORS, su28SequenceIndex, asterismColor,
} from './constants';
import {
	degToRad, nowMs, clamp, starTemperatureColor, toSkyVector, toSkyVectorInto, shortestArcDeg, calibBlendFactor,
	LAT_EXTRAP_MAX_DAYS, normalizeDegrees, skyDirectionFromVector, horizontalToEquatorial, equatorialToEcliptic,
	angularSeparationDeg, observerFromFields, observerFromData, cameraRotationForDirection, easeInOutCubic,
	lerpNumber,
} from './skyMath';
import {
	formatDeg, formatRa, starProperName, circularMidpoint, su28DisplayName, houseDisplayName,
	preferredVisiblePoint, allAboveHorizon, shouldShowModeBoundItem, bodyName, zodiacInfoForLon, houseForLon,
} from './itemText';
import { noise2, paintSkySurface, paintHorizonMistSurface, planetTextureSize, paintPlanetSurface, paintMoonPhase } from './textures';

import { planetariumOnDemandRenderEnabled, planetariumMetricsThrottleEnabled } from '../../../utils/perfFlags';

// perf:planetariumRenderGating —— 天文馆渲染时机门控参数(只动时机不动内容):
//   IDLE_FRAME_MS:静止时降帧间隔(~10fps);静止画面在任何帧率下视觉一致,留出 CPU 给主线程消除卡顿。
//   SETTLE_MS:一次交互后维持满帧的时窗(拖动顺滑 + 覆盖惯性/收尾),之后回落到降帧。
const PLANETARIUM_IDLE_FRAME_MS = 100;
const PLANETARIUM_SETTLE_MS = 600;

export class PlanetariumRenderer {
	constructor(canvas, onPick, onMetrics, onInteraction){
		this.canvas = canvas;
		this.onPick = onPick;
		this.onMetrics = onMetrics;
		this.onInteraction = onInteraction;
		// perf:planetariumRenderGating —— 渲染循环时机门控状态(内容/语义一字不动)。
		this._loopRunning = false;
		this._onDemand = planetariumOnDemandRenderEnabled();
		this._metricsThrottle = planetariumMetricsThrottleEnabled();
		this._playing = false;
		this._renderRequested = false;
		this._settleUntil = 0;
		this._lastIdleRender = 0;
		this._lastMetricEmit = 0;
		this._boundRenderTick = null;
		this.engine = new BABYLON.Engine(canvas, true, {
			preserveDrawingBuffer: false,
			stencil: false,
			antialias: true,
			powerPreference: 'high-performance',
			adaptToDeviceRatio: true,
		});
		this.scene = new BABYLON.Scene(this.engine);
		// 引擎的指针坐标是「clientX − 画布 rect.left」(视觉域),而它自己的拾取(POINTERPICK 命中行星 / 亮星)与 createPickingRay 都按
		// 画布本地 CSS 坐标(布局域)解释 —— 壳缩放档下两者差 z 倍,点不中 / 点到别的天体(100% 档重合,看不出来)。
		// 在引擎更新指针位置之后立刻按「画布布局宽 ÷ rect 宽」折回;接口缺席(引擎升级改了内部结构)就退到 pickXY() 里只修本类自己的射线。
		this._pointerDomainPatched = false;
		try{
			const im = this.scene._inputManager;
			if(im && typeof im._updatePointerPosition === 'function'){
				const origUpdate = im._updatePointerPosition.bind(im);
				im._updatePointerPosition = (evt)=>{
					origUpdate(evt);
					const k = pointerLocalRatio(canvas);
					if(k.kx !== 1 || k.ky !== 1){
						im._pointerX *= k.kx;
						im._pointerY *= k.ky;
						im._unTranslatedPointerX = im._pointerX;
						im._unTranslatedPointerY = im._pointerY;
					}
				};
				this._pointerDomainPatched = true;
			}
		}catch(e){ this._pointerDomainPatched = false; }
		this.scene.clearColor = new BABYLON.Color4(0.008, 0.012, 0.026, 1);
		this.scene.ambientColor = new BABYLON.Color3(0.12, 0.16, 0.3);
		this.groups = [];
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		this.starPcs = null;
		this.starMesh = null;
		this.starCount = 0;
		this.starCatalog = [];
		this.starBuildPending = false;
		this.lastData = null;
		this.disposed = false;
		this.viewMode = 'ground';
		this.layers = {...DEFAULT_LAYERS};
		// 星等过滤上限(默认 = 全 BSC5 上限,等价不过滤 → 零回归)。mag > magLimit 的恒星粒子 alpha=0 隐藏。
		this.magLimit = STAR_MAG_LIMIT_MAX;
		// 角距测量(默认关 → 零回归):开关 + 已记起点(单位方向向量)+ 连线/标记 mesh。
		this.measureMode = false;
		this.measureFirst = null;
		this.measureMeshes = [];
		this.onMeasure = null;
		this.onSkyReadout = null;
		this.initScene();
	}

	initScene(){
		const CameraCtor = BABYLON.UniversalCamera || BABYLON.FreeCamera;
		this.groundCamera = new CameraCtor(
			'planetarium-ground-camera',
			new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
			this.scene,
		);
		this.groundCamera.minZ = 0.5;
		this.groundCamera.maxZ = SKY_RADIUS * 3;
		this.groundCamera.fov = 1.08;
		this.groundCamera.inertia = 0.45;
		this.groundCamera.angularSensibility = 1600;
		this.groundCamera.speed = 0;
		this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
		if(this.groundCamera.inputs && this.groundCamera.inputs.removeByType){
			this.groundCamera.inputs.removeByType('FreeCameraKeyboardMoveInput');
			this.groundCamera.inputs.removeByType('FreeCameraGamepadInput');
			this.groundCamera.inputs.removeByType('FreeCameraMouseInput');
			this.groundCamera.inputs.removeByType('FreeCameraTouchInput');
		}

		this.transitionCamera = new CameraCtor(
			'planetarium-transition-camera',
			new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
			this.scene,
		);
		this.transitionCamera.minZ = 0.5;
		this.transitionCamera.maxZ = SKY_RADIUS * 4;
		this.transitionCamera.fov = this.groundCamera.fov;
		this.transitionCamera.speed = 0;
		if(this.transitionCamera.inputs && this.transitionCamera.inputs.removeByType){
			this.transitionCamera.inputs.removeByType('FreeCameraKeyboardMoveInput');
			this.transitionCamera.inputs.removeByType('FreeCameraGamepadInput');
			this.transitionCamera.inputs.removeByType('FreeCameraMouseInput');
			this.transitionCamera.inputs.removeByType('FreeCameraTouchInput');
		}

		this.orbitCamera = new BABYLON.ArcRotateCamera(
			'planetarium-orbit-camera',
			Math.PI * 1.25,
			Math.PI * 0.42,
			1120,
			BABYLON.Vector3.Zero(),
			this.scene,
		);
		this.orbitCamera.lowerRadiusLimit = ORBIT_MIN_RADIUS;
		this.orbitCamera.upperRadiusLimit = ORBIT_MAX_RADIUS;
		this.orbitCamera.wheelPrecision = 32;
		this.orbitCamera.panningSensibility = 0;
		if(this.orbitCamera.inputs && this.orbitCamera.inputs.clear){
			this.orbitCamera.inputs.clear();
		}

		this.wheelHandler = (evt)=>{
			if(!this.camera){
				return;
			}
			evt.preventDefault();
			this.markCameraSettle();
			if(this.viewMode === 'orbit'){
				this.camera.radius = clamp(this.camera.radius + (evt.deltaY > 0 ? 64 : -64), ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS);
				return;
			}
			this.camera.fov = clamp(this.camera.fov + (evt.deltaY > 0 ? 0.075 : -0.075), GROUND_MIN_FOV, GROUND_MAX_FOV);
		};
		this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
		this.pointerDrag = null;
		this.pointerDownHandler = (evt)=>{
			if(!this.camera || this.viewTransition || evt.button !== 0){
				return;
			}
			if(this.onInteraction){
				this.onInteraction();
			}
			this.markCameraSettle();
			this.pointerDrag = {
				id: evt.pointerId,
				x: evt.clientX,
				y: evt.clientY,
			};
			// 🆕 按下即解除「锁定跟随」(双保险):此前只在 pointermove 里解除——WKWebView/WebView2 的
			// pointer 事件模型差异(pointerId 生命周期/合成事件)可能让 move 链失效,锁定就永远退不出
			// (用户实测:App 定位星体后鼠标拖动无效、无法取消居中;Chrome preview 正常)。
			// 按下(准备拖动)本身就是明确的「用户要接管视角」意图,Stellarium 同款语义。
			if(this._followMesh || this._followStar){
				this._followMesh = null;
				this._followStar = null;
				if(this.camera){ this.camera.lockedTarget = null; }
			}
			// setPointerCapture 必须防御:对无效 pointerId 抛 NotFoundError(合成事件/部分 WebView 实测会炸),
			// 裸抛会中断 handler;capture 失败只影响「指针移出 canvas 仍拖动」的体验,绝不该炸主链。
			if(this.canvas.setPointerCapture){
				try{ this.canvas.setPointerCapture(evt.pointerId); }catch(e){ /* capture 失败可拖动降级 */ }
			}
		};
		this.pointerMoveHandler = (evt)=>{
			if(!this.pointerDrag || this.pointerDrag.id !== evt.pointerId || !this.camera || this.viewTransition){
				return;
			}
			const dx = evt.clientX - this.pointerDrag.x;
			const dy = evt.clientY - this.pointerDrag.y;
			this.pointerDrag.x = evt.clientX;
			this.pointerDrag.y = evt.clientY;
			// 🆕 用户主动拖动相机(任意方向) → 取消「锁定跟随」(Stellarium 风格:点选锁定/拖动解除)
			if((dx !== 0 || dy !== 0) && (this._followMesh || this._followStar)){
				this._followMesh = null;
				this._followStar = null;
				if(this.camera){ this.camera.lockedTarget = null; }
			}
			evt.preventDefault();
			this.markCameraSettle();
			if(this.viewMode === 'orbit'){
				if(this.onInteraction){
					this.onInteraction();
				}
				this.orbitCamera.alpha -= dx * 0.006;
				this.orbitCamera.beta = clamp(this.orbitCamera.beta - dy * 0.0045, 0.04, Math.PI - 0.04);
				return;
			}
			if(this.onInteraction){
				this.onInteraction();
			}
			this.groundCamera.rotation.y += dx * 0.0042;
			this.groundCamera.rotation.x = clamp(this.groundCamera.rotation.x + dy * 0.0036, -Math.PI * 0.49, Math.PI * 0.49);
		};
		this.pointerUpHandler = (evt)=>{
			if(this.pointerDrag && this.pointerDrag.id === evt.pointerId){
				this.pointerDrag = null;
				if(this.canvas.releasePointerCapture){
					try{
						this.canvas.releasePointerCapture(evt.pointerId);
					}catch(err){
						// Pointer capture may already be released by the browser.
					}
				}
			}
		};
		this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
		this.canvas.addEventListener('pointermove', this.pointerMoveHandler, { passive: false });
		this.canvas.addEventListener('pointerup', this.pointerUpHandler);
		this.canvas.addEventListener('pointercancel', this.pointerUpHandler);

		const light = new BABYLON.HemisphericLight('planetarium-light', new BABYLON.Vector3(0, 1, 0), this.scene);
		light.intensity = 0.38;

		const sky = BABYLON.MeshBuilder.CreateSphere('sky-shell', { diameter: SKY_RADIUS * 2, segments: 96, sideOrientation: BABYLON.Mesh.BACKSIDE }, this.scene);
		sky.isPickable = false;
		sky.alwaysSelectAsActiveMesh = true;
		sky.infiniteDistance = true;
		const skyTexture = new BABYLON.DynamicTexture('planetarium-sky-gradient-texture', { width: 1024, height: 512 }, this.scene, true);
		skyTexture.hasAlpha = false;
		this.skyTexture = skyTexture;
		paintSkySurface(skyTexture.getContext(), 1024, 512, {
			zenith: [0.004, 0.007, 0.022],
			sky: [0.018, 0.04, 0.11],
			horizon: [0.04, 0.08, 0.18],
			glow: [0.04, 0.11, 0.22],
			skyGlowAlpha: 0.08,
		});
		skyTexture.update(false);
		const skyMat = new BABYLON.StandardMaterial('sky-material', this.scene);
		skyMat.disableLighting = true;
		skyMat.disableDepthWrite = true;
		skyMat.backFaceCulling = false;
		skyMat.diffuseTexture = skyTexture;
		skyMat.emissiveTexture = skyTexture;
		skyMat.diffuseColor = BABYLON.Color3.White();
		skyMat.emissiveColor = BABYLON.Color3.White();
		skyMat.alpha = 1;
		sky.material = skyMat;
		this.skyMat = skyMat;

		const horizonGlow = BABYLON.MeshBuilder.CreateTorus('horizon-glow', { diameter: LINE_RADIUS * 2, thickness: 10, tessellation: 192 }, this.scene);
		horizonGlow.rotation.x = Math.PI / 2;
		horizonGlow.isPickable = false;
		horizonGlow.material = this.material('horizon-glow-material', new BABYLON.Color3(0.08, 0.22, 0.38), 0.18);
		this.horizonGlow = horizonGlow;

		const groundOccluder = BABYLON.MeshBuilder.CreateGround('ground-horizon-occluder', {
			width: SKY_RADIUS * 4.8,
			height: SKY_RADIUS * 4.8,
			subdivisions: 1,
		}, this.scene);
		groundOccluder.position.y = -0.8;
		groundOccluder.isPickable = false;
		groundOccluder.alwaysSelectAsActiveMesh = true;
		const groundMat = this.createGroundMaterial();
		groundOccluder.material = groundMat;
		this.groundMat = groundMat;
		this.groundOccluder = groundOccluder;
		this.horizonPanorama = this.createHorizonPanorama();
		this.horizonMist = this.createHorizonMist();
		this.landscapeMeshes = [];

		this.setViewMode('ground', false);

		this.glow = null;
		this.sky = sky;

		// 🆕 隐藏 follower mesh:让暗星(SolidParticle 粒子,非独立 mesh,无法挂 camera.lockedTarget)也能持续跟随。
		// 选中暗星时:_followStar = starHit; updateProjectedTime 每帧重投影 starHit 到当前 jd → mutate followerMesh.position;
		// camera.lockedTarget = followerMesh → Babylon 自动让相机跟着 followerMesh 移动 = 相机持续跟随选中暗星。
		this._followerMesh = new BABYLON.Mesh('planetarium-star-follower', this.scene);
		this._followerMesh.isVisible = false;
		this._followerMesh.isPickable = false;
		this._followStar = null; // 选中暗星时记录 { ra, decl, ... };mesh-based body 选中时清为 null(直接挂 mesh 自己即可)

		this.scene.onPointerObservable.add((pointerInfo)=>{
			const ptype = pointerInfo.type;
			const pickInfo = pointerInfo.pickInfo;
			const hit = pickInfo && pickInfo.pickedMesh;
			const hitBody = hit && hit.metadata && hit.metadata.body ? hit.metadata.body : null;
			// 角距测量模式:所有点选(命中天体 / 空白天区)都进测量逻辑,接管详情/兜底,POINTERTAP 单次处理。
			if(this.measureMode){
				if(ptype === BABYLON.PointerEventTypes.POINTERTAP){
					this.handleMeasureTap(hit, hitBody);
				}
				return;
			}
			if(ptype === BABYLON.PointerEventTypes.POINTERPICK){
				if(hitBody && this.onPick){
					this.onPick(hitBody);
				}
				return;
			}
			if(ptype === BABYLON.PointerEventTypes.POINTERTAP){
				if(hitBody){
					return; // 已由 POINTERPICK 处理(行星/亮星等)
				}
				// 暗星兜底:点空处先选距射线最近的目录星;若无星命中 → 读出该方向天区坐标(任务 3)。
				const star = this.pickNearestStar();
				if(!star){
					this.emitSkyReadout();
				}
			}
		});

		// perf:planetariumRenderGating —— 循环体抽成具名 _renderTick(可停/起 + 静止降帧 + metrics 节流),内容不变。
		this._startRenderLoop();
		this.resizeHandler = ()=>{
			if(this.engine){
				// Keep the backing store at full device resolution; re-apply on resize so
				// moving the window between Retina / non-Retina monitors stays crisp.
				const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
				this.engine.setHardwareScalingLevel(1 / Math.max(1, dpr));
				this.engine.resize();
			}
		};
		window.addEventListener('resize', this.resizeHandler);
	}

	setLayers(layers){
		this.layers = {...this.layers, ...(layers || {})};
		this.applyLayerVisibility();
	}

	// 大气折射是否生效:仅地表观测(ground)且大气层(atmosphere)开启时加折射(地平附近抬升)。
	// 关大气层 → 真空几何,星体按真高度;天球外观(orbit)本就几何原貌,不折射。默认 atmosphere=true → 字节级零回归。
	refractionActive(){
		return this.viewMode === 'ground' && !!(this.layers && this.layers.atmosphere);
	}

	// 关「地面」(地表观测下)→ 显示地平线以下整个天球:宿区间等 mode-bound 元素不再按地平裁剪。
	showBelowHorizon(){
		return this.viewMode === 'ground' && !(this.layers && this.layers.ground);
	}

	// 星等是否在当前上限内可见。默认上限(STAR_MAG_LIMIT_MAX)= 不设限 → 任何星都过(字节级零回归,
	// 即使后端偶发送来 mag>6.5 的星也照旧显示);非默认上限才按 mag<=limit 过滤。
	magVisible(mag){
		if(this.magLimit >= STAR_MAG_LIMIT_MAX){ return true; }
		return Number(mag) <= this.magLimit;
	}

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
	}

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
	}

	// 「地面」开关切换后:按当前模式重算地面显隐(viewMode 不变,只是 layers.ground 变了)。
	refreshGroundLayer(){
		this.setGroundElementsEnabled(this.viewMode === 'ground');
		this.applyModeBoundVisibility(); // 关地面立即让地平线以下的宿区间等显示(不等下一次重投影)
	}

	// 「大气层」开关切换后:用最近一帧 sky 数据重画天空(黑/恢复昼夜),不重取后端。
	refreshSky(){
		this.updateSky(this.lastData || {});
	}

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
	}

	cameraPosition(camera){
		if(!camera){
			return BABYLON.Vector3.Zero();
		}
		if(camera.globalPosition){
			return camera.globalPosition.clone();
		}
		return camera.position ? camera.position.clone() : BABYLON.Vector3.Zero();
	}

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
	}

	setFreeCameraView(camera, position, target, fov){
		camera.position.copyFrom(position);
		camera.setTarget(target);
		camera.fov = fov;
	}

	prepareOrbitDestination(){
		this.orbitCamera.target = BABYLON.Vector3.Zero();
		this.orbitCamera.radius = Math.max(1120, this.orbitCamera.radius || 1120);
		this.orbitCamera.beta = clamp(this.orbitCamera.beta || Math.PI * 0.42, 0.18, Math.PI * 0.82);
		return {
			position: this.cameraPosition(this.orbitCamera),
			target: this.orbitCamera.target.clone(),
			fov: this.orbitCamera.fov || 0.8,
		};
	}

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
	}

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
	}

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
	}

	clearData(){
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		this.groups.forEach((group)=>{
			group.dispose(false, true);
		});
		this.groups = [];
		this.starPcs = null;
		this.starMesh = null;
		this.starCount = 0;
		this.starCatalog = [];
	}

	makeGroup(name){
		const group = new BABYLON.TransformNode(name, this.scene);
		this.groups.push(group);
		return group;
	}

	material(name, color, alpha = 1){
		const mat = new BABYLON.StandardMaterial(name, this.scene);
		mat.disableLighting = true;
		mat.emissiveColor = color;
		mat.diffuseColor = color;
		mat.alpha = alpha;
		return mat;
	}

	createGroundMaterial(){
		const mat = new BABYLON.StandardMaterial('ground-horizon-occluder-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.emissiveColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.alpha = 0;
		return mat;
	}

	createHorizonPanorama(){
		const radius = LINE_RADIUS - 18;
		const azSegments = 256;
		const altSegments = 56;
		const topAlt = 42;
		const bottomAlt = -72;
		const positions = [];
		const indices = [];
		const uvs = [];
		for(let y = 0; y <= altSegments; y += 1){
			const v = y / altSegments;
			const altitudeAppa = topAlt + (bottomAlt - topAlt) * v;
			for(let x = 0; x <= azSegments; x += 1){
				const u = x / azSegments;
				const position = toSkyVector({ azimuth: u * 360, altitudeAppa }, radius);
				positions.push(position.x, position.y, position.z);
				uvs.push(1 - u, v);
			}
		}
		for(let y = 0; y < altSegments; y += 1){
			for(let x = 0; x < azSegments; x += 1){
				const a = y * (azSegments + 1) + x;
				const b = a + 1;
				const c = a + azSegments + 1;
				const d = c + 1;
				indices.push(a, c, b, b, c, d);
			}
		}
		const mesh = new BABYLON.Mesh('horizon-panorama-layer', this.scene);
		const vertexData = new BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;
		vertexData.uvs = uvs;
		const normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, normals);
		vertexData.normals = normals;
		vertexData.applyToMesh(mesh, true);
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 1;

		// 程序化地表裙边纹理(替代旧照片全景):干净渐变地面 + 柔和地平线,天象馆质感、无照片。
		// 地平线所在 UV(v):由 topAlt/bottomAlt 推得,= topAlt/(topAlt-bottomAlt)。
		this._horizonTopAlt = topAlt;
		this._horizonBottomAlt = bottomAlt;
		const mat = new BABYLON.StandardMaterial('horizon-panorama-material', this.scene);
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		mat.diffuseColor = new BABYLON.Color3(0.52, 0.52, 0.5);
		mat.emissiveColor = new BABYLON.Color3(0.52, 0.52, 0.5);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
		mesh.material = mat;
		this.applyHorizonTexture(mat); // 原照片全景纹理
		return mesh;
	}

	// 设地平裙边纹理:原照片全景地面(纹理灰阶由材质 diffuse/emissive 跟随昼夜 palette 染色)。
	applyHorizonTexture(mat){
		mat = mat || (this.horizonPanorama && this.horizonPanorama.material);
		if(!mat){ return; }
		if(mat.diffuseTexture){ mat.diffuseTexture.dispose(); }
		const tex = new BABYLON.Texture(HORIZON_PANORAMA_URL, this.scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
		tex.hasAlpha = true; tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE; tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
		mat.diffuseTexture = tex; mat.emissiveTexture = tex; mat.opacityTexture = tex;
	}


	createHorizonMist(){
		const mesh = BABYLON.MeshBuilder.CreateCylinder('horizon-mist-layer', {
			diameter: LINE_RADIUS * 2.62,
			height: 260,
			tessellation: 192,
			subdivisions: 1,
			cap: BABYLON.Mesh.NO_CAP,
			sideOrientation: BABYLON.Mesh.BACKSIDE,
		}, this.scene);
		mesh.position.y = 18;
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 1;

		const texture = new BABYLON.DynamicTexture('horizon-mist-texture', { width: 1024, height: 256 }, this.scene, true);
		texture.hasAlpha = true;
		this.horizonMistTexture = texture;
		paintHorizonMistSurface(texture.getContext(), 1024, 256, {
			glow: [0.28, 0.38, 0.65],
			clear: [0.008, 0.012, 0.028],
			mistAlpha: 0.14,
		});
		texture.update(false);

		const mat = new BABYLON.StandardMaterial('horizon-mist-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.useAlphaFromDiffuseTexture = true;
		mat.diffuseColor = BABYLON.Color3.White();
		mat.emissiveColor = BABYLON.Color3.White();
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		mat.alpha = 0.82;
		mesh.material = mat;
		return mesh;
	}

	createTerrainBand(name, radius, bottomAlt, topBaseAlt, amplitude, color){
		const segments = 192;
		const positions = [];
		const indices = [];
		for(let i = 0; i <= segments; i += 1){
			const azimuth = (i / segments) * 360;
			const wave = Math.sin(degToRad(azimuth * 1.15)) * amplitude * 0.42
				+ Math.sin(degToRad(azimuth * 2.4 + 38)) * amplitude * 0.24
				+ Math.sin(degToRad(azimuth * 4.2 + 114)) * amplitude * 0.08;
			const softness = (noise2(Math.floor(i / 4), 21, radius) - 0.5) * amplitude * 0.18;
			const topAlt = clamp(topBaseAlt + wave + softness, topBaseAlt - amplitude * 0.45, topBaseAlt + amplitude * 0.58);
			const top = toSkyVector({ azimuth, altitudeAppa: topAlt }, radius);
			const bottom = toSkyVector({ azimuth, altitudeAppa: bottomAlt }, radius);
			positions.push(top.x, top.y, top.z, bottom.x, bottom.y, bottom.z);
			if(i < segments){
				const a = i * 2;
				indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
			}
		}
		const mesh = new BABYLON.Mesh(name, this.scene);
		const vertexData = new BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;
		const normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, normals);
		vertexData.normals = normals;
		vertexData.applyToMesh(mesh, true);
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 0;
		const mat = new BABYLON.StandardMaterial(`${name}-material`, this.scene);
		mat.disableLighting = true;
		mat.diffuseColor = color;
		mat.emissiveColor = color;
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mesh.material = mat;
		return mesh;
	}

	createHorizonLandscape(){
		const ridge = this.createTerrainBand('distant-ridge-silhouette', LINE_RADIUS - 36, -14, 0.15, 1.25, new BABYLON.Color3(0.025, 0.052, 0.046));
		const nearRidge = this.createTerrainBand('near-field-silhouette', LINE_RADIUS - 62, -16, -0.8, 0.68, new BABYLON.Color3(0.018, 0.038, 0.03));
		return [ridge, nearRidge];
	}

	createSurfaceTexture(id, phase){
		const size = planetTextureSize(id);
		const texture = new BABYLON.DynamicTexture(`surface-${id}-${Math.random()}`, size, this.scene, true);
		texture.hasAlpha = id === 'Moon';
		const ctx = texture.getContext();
		if(id === 'Moon'){
			paintMoonPhase(ctx, phase || this.currentMoonPhase, size.width);
		}else{
			paintPlanetSurface(ctx, id, size.width, size.height);
		}
		texture.update(true);
		return texture;
	}

	createBodyMaterial(body){
		const id = body.id;
		const color = BODY_COLORS[id] || new BABYLON.Color3(0.9, 0.9, 1);
		if(!TEXTURED_BODY_IDS.has(id)){
			return this.material(`body-mat-${id}`, color, 1);
		}
		const visual = BODY_VISUALS[id] || { emissive: 0.42 };
		const mat = new BABYLON.StandardMaterial(`body-surface-mat-${id}-${Math.random()}`, this.scene);
		const texture = this.createSurfaceTexture(id, id === 'Moon' ? this.currentMoonPhase : null);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.diffuseColor = color.scale(id === 'Sun' ? 1.18 : 1.08);
		mat.specularColor = id === 'Sun'
			? new BABYLON.Color3(1, 0.62, 0.24)
			: color.scale(0.22);
		mat.emissiveColor = id === 'Sun'
			? new BABYLON.Color3(1, 0.56, 0.16)
			: color.scale(visual.emissive);
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = id === 'Moon';
		return mat;
	}

	createBodyHalo(mesh, body, group){
		const id = body.id;
		const visual = BODY_VISUALS[id];
		if(!visual){
			return;
		}
		const color = BODY_COLORS[id] || new BABYLON.Color3(1, 1, 1);
		const scale = visual.haloScale || 1.55;
		const halo = BABYLON.MeshBuilder.CreateSphere(`body-halo-${id}`, { diameter: mesh.getBoundingInfo().boundingSphere.radius * 2 * scale, segments: 24 }, this.scene);
		halo.position.copyFrom(mesh.position);
		halo.material = this.material(`body-halo-mat-${id}`, color, visual.haloAlpha || 0.08);
		halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
		halo.renderingGroupId = 1;
		halo.parent = group;
		halo.isPickable = false;
		this.registerFollowerMesh(halo, id, ()=>BABYLON.Vector3.Zero());
	}

	createSaturnRing(mesh, group){
		const ring = BABYLON.MeshBuilder.CreateTorus('saturn-ring', { diameter: 28, thickness: 2.2, tessellation: 96 }, this.scene);
		ring.position.copyFrom(mesh.position);
		ring.rotation.x = Math.PI * 0.58;
		ring.rotation.z = Math.PI * 0.12;
		ring.scaling.y = 0.38;
		ring.material = this.material('saturn-ring-mat', new BABYLON.Color3(0.95, 0.82, 0.55), 0.72);
		ring.parent = group;
		ring.isPickable = false;
		this.registerFollowerMesh(ring, 'Saturn', ()=>BABYLON.Vector3.Zero());
	}

	createMoonPhaseDisc(body, mesh, group){
		const texture = this.createSurfaceTexture('Moon', this.currentMoonPhase);
		const mat = new BABYLON.StandardMaterial(`moon-phase-disc-mat-${Math.random()}`, this.scene);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		const disc = BABYLON.MeshBuilder.CreatePlane('moon-phase-disc', { width: 22, height: 22 }, this.scene);
		disc.position = mesh.position.add(mesh.position.clone().normalize().scale(2.5));
		disc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		disc.material = mat;
		disc.parent = group;
		disc.metadata = { body: { ...body, displayName: bodyName(body), layer: 'body' } };
		this.pickMeshes.push(disc);
		this.registerFollowerMesh(disc, 'Moon', (target)=>target.position.clone().normalize().scale(2.5));
	}

	createEarthAnchor(group){
		const body = {
			id: 'Earth',
			name: 'Earth',
			displayName: '地球',
			layer: 'body',
			type: '地球/观测点',
			altitudeAppa: -90,
			azimuth: 0,
			visible: false,
			horizonState: '脚下地球',
		};
		const mesh = BABYLON.MeshBuilder.CreateSphere('body-Earth', { diameter: 34, segments: 32 }, this.scene);
		mesh.position = new BABYLON.Vector3(0, -BODY_RADIUS + 74, 0);
		mesh.material = this.createBodyMaterial(body);
		mesh.parent = group;
		mesh.metadata = { body };
		this.pickMeshes.push(mesh);
		this.bodyMeshes.Earth = mesh;
		this.bodyMeshes['地球'] = mesh;
		const label = this.createTextPlane('地球', 40, '#d8ecff', 'rgba(0,0,0,0)');
		label.position = mesh.position.add(new BABYLON.Vector3(0, 26, 0));
		label.parent = group;
		label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		label.metadata = { labelKind: 'body' };
	}

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
	}

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
	}

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
	}

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
		if(this.starPcs && this.starPcs.particles && this.starCatalog && this.starCatalog.length === this.starPcs.particles.length){
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
	}

	clearDynamicData(preserveStars = false){
		// 🚀 懒构建守卫复位:本方法会 dispose 掉(除恒星外)所有动态组,故清空 _off / _asterismsBuilt,
		// 让 _buildOffLayers / ensureChineseAsterismsBuilt 在下次 updateData 按当前开关重建已开层(并修「全量刷新后开着的层消失」潜伏 bug)。
		this._off = {};
		this._asterismsBuilt = false;
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
			this.projectableMeshes = (this.projectableMeshes || []).filter((item)=>isBrightStarMesh(item && item.mesh));
			this.projectableLines = [];
			this.followMeshes = [];
			const keep = [];
			this.groups.forEach((group)=>{
				if(group.name.indexOf('stars-layer') === 0 || group.name.indexOf('bright-stars-layer') === 0){
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
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		const keep = [];
		this.groups.forEach((group)=>{
			if(group.name.indexOf('stars-layer') === 0){
				keep.push(group);
			}else{
				group.dispose(false, true);
			}
		});
		this.groups = keep;
	}

	registerProjectableMesh(mesh, source, radius, options = null){
		if(!mesh || !source){
			return;
		}
		this.projectableMeshes.push({ mesh, source, radius, ...(options || {}) });
	}

	registerProjectableLine(mesh, sources, radius, innerRadius, options = null){
		if(!mesh || !sources || !sources.length){
			return;
		}
		this.projectableLines.push({ mesh, sources, radius, innerRadius, ...(options || {}) });
	}

	registerFollowerMesh(mesh, targetId, offsetFactory){
		if(!mesh || !targetId){
			return;
		}
		this.followMeshes.push({ mesh, targetId, offsetFactory });
	}

	updateFollowers(){
		this.followMeshes.forEach((item)=>{
			const target = this.bodyMeshes[item.targetId];
			if(!target || !target.position || !item.mesh){
				return;
			}
			const offset = typeof item.offsetFactory === 'function' ? item.offsetFactory(target) : BABYLON.Vector3.Zero();
			item.mesh.position = target.position.add(offset || BABYLON.Vector3.Zero());
		});
	}

	updateSkyTexture(p){
		if(!this.skyTexture){
			return;
		}
		paintSkySurface(this.skyTexture.getContext(), 1024, 512, p);
		this.skyTexture.update(false);
	}

	// 太阳(视)高度 → 天空昼夜模式:标准晨昏阈值 0/-6/-12/-18°(与后端 sky.mode 同口径;
	// 后端此前拿视高度比 -0.833° = 折射算两次,已统一到 0°,此注自此为真)
	skyModeFromSunAlt(alt){
		if(alt == null){ return null; }
		if(alt > 0){ return 'day'; }
		if(alt > -6){ return 'civilTwilight'; }
		if(alt > -12){ return 'nauticalTwilight'; }
		if(alt > -18){ return 'astronomicalTwilight'; }
		return 'night';
	}

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
	}

	createCardinals(){
		const group = this.makeGroup('cardinals');
		[
			{ label: '南', azimuth: 0 },
			{ label: '西', azimuth: 90 },
			{ label: '北', azimuth: 180 },
			{ label: '东', azimuth: 270 },
		].forEach((item)=>{
			const plane = this.createTextPlane(item.label, 84, '#d7e9ff', 'rgba(8,16,34,0.1)');
			plane.position = toSkyVector({...item, altitudeAppa: 2}, LINE_RADIUS);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'cardinal' };
		});
	}

	// 界面简繁切换后重画全部文字标签纹理(canvas 上的字画好就不会自己变;宿主经 watchChartScript 调)
	repaintTextLabels(){
		(this._labelPainters || new Set()).forEach((fn)=>{ try{ fn(); }catch(e){ /* 单张失败不影响其余 */ } });
	}

	createTextPlane(text, size, color, bg){
		const fontPx = size || 48;
		// Super-sample the label texture for devicePixelRatio so text stays crisp on
		// Retina. The old fixed 256x128 canvas was drawn at CSS px then upscaled in 3D,
		// which is what made the labels look fuzzy. The plane size below is unchanged,
		// so the on-screen size of every label is identical to before — only sharper.
		const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
		const factor = clamp(Math.ceil(dpr * 2), 2, 4);
		const baseW = 256;
		const baseH = 128;
		const texW = baseW * factor;
		const texH = baseH * factor;
		const texture = new BABYLON.DynamicTexture(`label-${text}-${Math.random()}`, { width: texW, height: texH }, this.scene, true);
		texture.hasAlpha = true;
		const ctx = texture.getContext();
		// 文字用深色描边(halo)代替底板:任意背景都清晰、无方框(成熟星图做法)。
		const fpx = Math.round(fontPx * factor);
		const paint = ()=>{
			ctx.clearRect(0, 0, texW, texH);
			// 仅当显式给出不透明底板时才填(默认不填,避免难看黑框)。
			if(bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent'){
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, texW, texH);
			}
			ctx.font = `600 ${fpx}px sans-serif`;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
			const tw = ctx.measureText(text).width;
			const tx = Math.max(0, (texW - tw) / 2);
			const ty = Math.round(78 * factor);
			ctx.lineJoin = 'round';
			ctx.miterLimit = 2;
			ctx.lineWidth = clamp(Math.round(fpx * 0.13), 3, 9);
			ctx.strokeStyle = 'rgba(3,6,14,0.92)';
			ctx.strokeText(text, tx, ty);
			ctx.fillStyle = color || '#fff';
			ctx.fillText(text, tx, ty);
			texture.update(true);
		};
		paint();
		// 界面简繁切换后重画(repaintTextLabels;纹理释放时摘掉)
		if(!this._labelPainters){ this._labelPainters = new Set(); }
		this._labelPainters.add(paint);
		if(texture.onDisposeObservable && typeof texture.onDisposeObservable.add === 'function'){
			texture.onDisposeObservable.add(()=>{ if(this._labelPainters){ this._labelPainters.delete(paint); } });
		}
		texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
		texture.anisotropicFilteringLevel = 8;
		const mat = new BABYLON.StandardMaterial(`label-mat-${text}-${Math.random()}`, this.scene);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		const scale = Math.max(0.9, fontPx / 48);
		const plane = BABYLON.MeshBuilder.CreatePlane(`label-${text}`, { width: 58 * scale, height: 29 * scale }, this.scene);
		plane.material = mat;
		plane.isPickable = false;
		plane.renderingGroupId = 2;
		return plane;
	}

	updateStars(stars){
		if(!stars || !stars.length){
			return;
		}
		this.starFullCatalog = stars; // 全表(供搜索 + 升高星等上限时重建补齐)
		// 按名搜索索引(name/bayer/flamsteed/HR/constellation + 专名表)走全表,纯增量、不改渲染。
		this.starIndex = buildStarIndex(stars);
		// 🚀 构建期星等过滤:只建 mag ≤ 当前上限 的星(默认上限低 → 建星/纹理大减 → 开场更快;非降级,升高上限会重建补齐)。
		stars = this.magLimit >= STAR_MAG_LIMIT_MAX ? stars : stars.filter((s)=>Number(s.mag || 5) <= this.magLimit + 1e-6);
		this.starCatalog = stars;
		this.starBuiltMagLimit = this.magLimit;
		if(this.starPcs && this.starPcs.particles && this.starPcs.particles.length === stars.length && this.starPcs.setParticles){
			stars.forEach((star, idx)=>{
				const particle = this.starPcs.particles[idx];
				if(!particle){
					return;
				}
				const mag = Number(star.mag || 5);
				particle.position = toSkyVector(star, STAR_RADIUS);
				const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
				const c = starTemperatureColor(star, b);
				// 星等过滤:超过上限 → alpha=0 隐藏(默认上限 6.5 = 不设限,无星被隐藏,零回归)。
				const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
				particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
			});
			this.starPcs.setParticles();
			this.updateBrightStars(stars);
			this.reprojectStarsToDisplayTime();
			return;
		}
		if(this.starBuildPending){
			return;
		}
		const oldGroup = this.groups.find((group)=>group.name.indexOf('stars-layer') === 0);
		if(oldGroup){
			oldGroup.dispose(false, true);
			this.groups = this.groups.filter((group)=>group !== oldGroup);
		}
		const group = this.makeGroup('stars-layer');
		const pcs = new BABYLON.PointsCloudSystem('star-point-cloud', 1.22, this.scene);
		this.starBuildPending = true;
		pcs.addPoints(stars.length, (particle, idx)=>{
			const star = stars[idx];
			const mag = Number(star.mag || 5);
			particle.position = toSkyVector(star, STAR_RADIUS);
			const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
			const c = starTemperatureColor(star, b);
			// 星等过滤(默认上限 6.5 = 不设限 → 全亮,零回归)。
			const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
			particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
		});
		pcs.buildMeshAsync().then((mesh)=>{
			if(this.disposed || !this.scene){
				return;
			}
			mesh.parent = group;
			mesh.isPickable = false;
			mesh.hasVertexAlpha = true; // 🔴 启用顶点 alpha:否则 per-particle alpha=0(星等过滤)被 Babylon 忽略 → 星等上限滑块全程无效
			this.starPcs = pcs;
			this.starMesh = mesh;
			this.starCount = stars.length;
			this.starBuildPending = false;
			this.applyLayerVisibility();
			this.updateBrightStars(stars);
			// 慢路径重建:粒子初始位置取自星表(后端上次全量时刻),必须按当前显示时刻重投影。
			this.reprojectStarsToDisplayTime();
		}).catch(()=>{
			this.starBuildPending = false;
		});
	}

	// 星云(重)建成后按最近一次显示时刻/观测点重投影;无记录(尚未播放/步进)= 与后端全量时刻一致,免投影。
	reprojectStarsToDisplayTime(){
		if(!this._lastProjectedTime || this.disposed || !this.scene){
			return;
		}
		try{
			this.updateProjectedTime(this._lastProjectedTime, this._lastProjectedFields);
		}catch(e){ /* 投影失败不影响建云 */ }
	}

	updateBrightStars(stars){
		const oldGroup = this.groups.find((group)=>group.name.indexOf('bright-stars-layer') === 0);
		if(oldGroup){
			oldGroup.dispose(false, true);
			this.groups = this.groups.filter((group)=>group !== oldGroup);
		}
		const group = this.makeGroup('bright-stars-layer');
		(stars || []).filter((star)=>Number(star.mag) <= 1.5 && this.magVisible(Number(star.mag))).slice(0, 80).forEach((star)=>{
			const b = Math.max(0.35, Math.min(1.0, 1.18 - Number(star.mag || 0) / 6.5));
			const c = starTemperatureColor(star, b);
			const mesh = BABYLON.MeshBuilder.CreateSphere(`bright-star-${star.id}`, { diameter: 2.4 + b * 4.4, segments: 8 }, this.scene);
			mesh.position = toSkyVector(star, STAR_RADIUS + 2);
			mesh.material = this.material(`bright-star-mat-${star.id}`, new BABYLON.Color3(c.r, c.g, c.b), 0.88);
			mesh.parent = group;
			mesh.metadata = { body: { ...star, displayName: star.name || star.id, layer: 'stars' } };
			this.pickMeshes.push(mesh);
			this.registerProjectableMesh(mesh, star, STAR_RADIUS + 2);
			if(star.name){ this.bodyMeshes[star.name] = mesh; }
			if(star.id){ this.bodyMeshes[star.id] = mesh; }
			if(Number(star.mag) <= 1.1){
				const halo = BABYLON.MeshBuilder.CreateSphere(`bright-star-halo-${star.id}`, { diameter: 8 + b * 12, segments: 12 }, this.scene);
				halo.position.copyFrom(mesh.position);
				halo.material = this.material(`bright-star-halo-mat-${star.id}`, new BABYLON.Color3(c.r, c.g, c.b), 0.1 + b * 0.08);
				halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
				halo.parent = group;
				halo.isPickable = false;
				halo.renderingGroupId = 1;
				this.registerFollowerMesh(halo, star.id, ()=>BABYLON.Vector3.Zero());
			}
		});
		// 🔴 幽灵星修复:亮星组在 updateStars 慢路径(buildMeshAsync.then 于 applyLayerVisibility 之后)与
		//   快路径(setParticles 后、updateData 末尾 applyLayerVisibility 已跑完)皆建于门控之后 → 建完不再显隐,
		//   恒星层默认关时亮星仍可见(且位置停在旧投影=错位),首次交互才隐藏。此处建完即按当前开关门控,
		//   与 stars-layer 点云同受 layers.stars 控,根治「默认关却显示错位亮星 / 点任意键才消失」。
		group.setEnabled(!!(this.layers && this.layers.stars));
	}

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
	}

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
	}

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
	}

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
	}

	// 坐标数字标尺:与赤道/黄道主圈刻度同一标准(小格每 10°、主刻度+读数、与网格同色、字号清晰)。
	// · 赤道/黄道:本初经圈(ra/lon=0)上的赤纬/黄纬刻度(projectable 随天转)。
	// · 地平(P1):沿地平圈每 30° 标方位度数(0=N/90=E/180=S/270=W),固定不随天转;
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
				const plane = this.createTextPlane(`${az}°`, 30, cfg.color, 'rgba(0,0,0,0)');
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
	}

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
	}

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
	}

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
	}

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
	}

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
	}

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
	}

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
	}

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
	}

	// 完整星官(312,旗舰)。数据 src/data/chineseAsterisms.json:每条星官 stars[{ra,decl,mag}] + lines[[i,j]],
	// ra/decl = J2000 真赤道十进制度。🔴纯天文铁律:坐标全走真实 ra/decl → projectedEquatorialItem → toSkyVector
	// (projectable 随天转),无 zodiacal/宿度制/岁差污染。按 group/symbol 四象三垣配色;每星官在其最亮星(mag 最小)
	// 处贴名 billboard。line.metadata.layerKey='xingguan' 供 layerAllowsMesh 在重投影时门控(隐藏即跳过重建)。
	// 星官(312)懒构建:默认关不建(省开场近半网格);开层时建一次(_asterismsBuilt 守,非降级、默认零回归)。
	ensureChineseAsterismsBuilt(){
		if(this._asterismsBuilt){ return; }
		this._asterismsBuilt = true;
		this.createChineseAsterisms((this.lastData && this.lastData.observer) || {});
		this.applyLayerVisibility();
	}

	createChineseAsterisms(observer){
		const group = this.makeGroup('asterism-xingguan-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = LINE_RADIUS + 26; // 略内于三垣墙(+38),与西方星座连线(+18)分层
		const labelRadius = radius + 8;
		const asterisms = (CHINESE_ASTERISMS && CHINESE_ASTERISMS.asterisms) || [];
		asterisms.forEach((item, ai)=>{
			const stars = (item.stars || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
			if(!stars.length){ return; }
			const color = asterismColor(item);
			// 连线:逐 [i,j] 连成员星(用原始 stars 索引,过滤前的下标)。
			(item.lines || []).forEach((seg, si)=>{
				if(!Array.isArray(seg) || seg.length < 2){ return; }
				const a = (item.stars || [])[seg[0]];
				const b = (item.stars || [])[seg[1]];
				if(!a || !b || !Number.isFinite(Number(a.ra)) || !Number.isFinite(Number(a.decl)) || !Number.isFinite(Number(b.ra)) || !Number.isFinite(Number(b.decl))){ return; }
				const pts = [
					projectedEquatorialItem({ ra: a.ra, decl: a.decl, epoch: 'J2000' }, jd, obs, refr),
					projectedEquatorialItem({ ra: b.ra, decl: b.decl, epoch: 'J2000' }, jd, obs, refr),
				];
				const line = this.createLine(`asterism-xingguan-${ai}-${si}`, pts, color, 0.62, group, radius, true);
				if(line){ line.metadata = { layerKey: 'xingguan' }; }
			});
			// 名:贴在最亮星(mag 最小)处;无 mag 取首星。
			let anchor = stars[0];
			let minMag = Number(stars[0].mag);
			stars.forEach((s)=>{ const m = Number(s.mag); if(Number.isFinite(m) && (!Number.isFinite(minMag) || m < minMag)){ minMag = m; anchor = s; } });
			const name = item.name || item.pinyin || '';
			if(name){
				const labelSrc = { ra: anchor.ra, decl: anchor.decl, epoch: 'J2000' };
				const plane = this.createTextPlane(name, 24, '#dbe6f5', 'rgba(0,0,0,0)');
				plane.position = toSkyVector(projectedEquatorialItem(labelSrc, jd, obs, refr), labelRadius);
				plane.parent = group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'xingguan', layerKey: 'xingguan' };
				this.registerProjectableMesh(plane, labelSrc, labelRadius);
			}
		});
		return group;
	}

	// 行星视运动轨迹(planetTrails)。数据来自后端 data.trails([{id,name,points:[{offsetDays,ra,decl,...}]}],
	// 当日历元真赤道,与 bodies 同口径)。每星一条 polyline,按该 body 颜色;projectable 随天转。轨迹必过当前星位
	// (offset0 在点列)。line.metadata.layerKey='planetTrails' 供 layerAllowsMesh 门控。仅在 data.trails 存在时绘制
	// (= 仅开启该层并带 includeTrails 重取后);默认无 trails → 留壳零开销。
	createPlanetTrails(data){
		const group = this.makeGroup('asterism-trails-layer');
		const obs = observerFromData(data && data.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const trails = (data && Array.isArray(data.trails)) ? data.trails : [];
		trails.forEach((trail, ti)=>{
			const pointsRaw = (trail && Array.isArray(trail.points)) ? trail.points : [];
			const pts = pointsRaw
				.filter((p)=>p && Number.isFinite(Number(p.ra)) && Number.isFinite(Number(p.decl)))
				.map((p)=>projectedEquatorialItem({ ra: p.ra, decl: p.decl }, jd, obs, refr));
			if(pts.length < 2){ return; }
			const color = BODY_COLORS[trail.id] || new BABYLON.Color3(0.7, 0.78, 0.92);
			const line = this.createLine(`asterism-trail-${trail.id || ti}`, pts, color, 0.62, group, LINE_RADIUS + 6, true);
			if(line){ line.metadata = { layerKey: 'planetTrails', body: { displayName: trail.name || trail.id } }; }
		});
		return group;
	}

	// 西方 88 星座连线(E2)。数据来自 src/data/constellationLines.json(待权威开放数据集);空 = 留壳。
	createConstellationLines(observer){
		const group = this.makeGroup('constellation-line-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_LINES && CONSTELLATION_LINES.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl, epoch: 'J2000' }, jd, obs, refr));
				this.createLine(`constellation-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.5, 0.62, 0.85), 0.35, group, LINE_RADIUS + 18, true);
			});
		});
		return group;
	}

	// IAU 星座边界(E2,可选)。数据来自 src/data/constellationBounds.json;空 = 留壳。
	createConstellationBounds(observer){
		const group = this.makeGroup('constellation-bound-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_BOUNDS && CONSTELLATION_BOUNDS.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl, epoch: 'J2000' }, jd, obs, refr));
				this.createLine(`constellation-bound-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.45, 0.5, 0.6), 0.22, group, LINE_RADIUS + 16, true);
			});
		});
		return group;
	}

	// 亮星专名(E3)。坐标取自既有星表,名取自 STAR_PROPER_NAMES;仅标有专名的亮星(克制密度)。
	createStarNames(stars, observer){
		const group = this.makeGroup('starname-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		(stars || []).forEach((star)=>{
			if(!star || !Number.isFinite(Number(star.ra)) || !Number.isFinite(Number(star.decl))){ return; }
			if(Number(star.mag) > 2.6){ return; }
			const name = starProperName(star);
			if(!name){ return; }
			const proj = projectedEquatorialItem({ ra: star.ra, decl: star.decl, epoch: 'J2000' }, jd, obs, refr);
			const plane = this.createTextPlane(name, 26, '#cfe0ff', 'rgba(0,0,0,0)');
			plane.position = toSkyVector(proj, STAR_RADIUS + 8);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'starName' };
			this.registerProjectableMesh(plane, { ra: star.ra, decl: star.decl, epoch: 'J2000' }, STAR_RADIUS + 8);
		});
		return group;
	}

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
	}

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
	}

	// 日行迹按最新时刻/地点重算:弃旧 analemma 组 + 用当前 jd/观测点重建(否则停在构建时=本命时刻)。
	rebuildAnalemma(jd, observer){
		if(!this.groups){ return; }
		this.groups = this.groups.filter((g)=>{
			if(g.name && g.name.indexOf('analemma-layer') === 0){ g.dispose(false, true); return false; }
			return true;
		});
		this.createAnalemma(observer || ((this.lastData && this.lastData.observer) || {}), jd);
		this.applyLayerVisibility();
	}

	createSu28Sectors(items, observer){
		const normalizedObserver = observerFromData(observer);
		// The 28 宿 are EQUATORIAL (赤道宿度): the mansions are placed by their distance-stars'
		// right ascension, NOT the ecliptic. Order/split by ra. Sectors come from the 28
		// distance-STARS only — the su28 list also carries planet markers via fillPlanetSu28,
		// which must not split the intervals (now that A2 re-projects them they'd be visible).
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return;
		}
		const group = this.makeGroup('su28-sector-layer');
		const sectorRadius = BODY_RADIUS - 22;
		const labelRadius = BODY_RADIUS - 2;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const midDecl = clamp((Number(item.decl) + Number(next.decl)) / 2, -72, 78);
			const sectorLabel = su28DisplayName(item);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const segmentVisible = this.showBelowHorizon() || allAboveHorizon([item, next]);
			const segment = this.createLine(
				`su28-sector-${item.id || item.name || idx}`,
				[item, next],
				color,
				0.7,
				group,
				sectorRadius,
				true,
			);
			if(segment){
				segment.metadata = { layerKind: 'su28Sector', label: `${sectorLabel}区间` };
				segment.setEnabled(segmentVisible);
				const registered = this.projectableLines.find((lineItem)=>lineItem.mesh === segment);
				if(registered){
					registered.visibilityMode = 'allAbove';
					registered.lastProjectedSources = [item, next];
				}
			}
			const labelSource = {
				ra: midRa,
				decl: midDecl,
				name: `${sectorLabel}区间`,
				altitudeAppa: 0,
				azimuth: 0,
			};
			const label = this.createTextPlane(`${sectorLabel}区间`, 26, '#dceeff', 'rgba(0,0,0,0)');
			label.position = toSkyVector(projectedEquatorialItem(labelSource, normalizedObserver && normalizedObserver.jd ? normalizedObserver.jd : 2451545, normalizedObserver), labelRadius);
			label.parent = group;
			label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			label.metadata = { labelKind: 'su28Sector' };
			label.setEnabled(segmentVisible);
			this.registerProjectableMesh(label, labelSource, labelRadius, {
				visibilityMode: 'allAbove',
				visibilitySources: [item, next],
				lastProjectedSources: [item, next],
			});
		});
	}

	// 二十八宿赤道网格(纯天文·赤道制):28 距星的「真实赤经」即宿界 —— 每条经圈是过天极的赤道大圆,
	// 绝不走宿度制/黄道投影(纯天文铁律)。取数同 createSu28Sectors(只用 28 距星,planet markers 不分界),
	// 画法同 createCoordinateGrid 的经圈(decl 扫,equatorialToHorizontal 投影,projectable 随天转)。
	// 四象配色(每 7 宿一象);宿界经圈略强调,象内可选 10° 赤纬纬线;沿赤道标宿名。metadata.gridKey='su28Grid'。
	createSu28Grid(items, observer){
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return null;
		}
		const group = this.makeGroup('grid-su28-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = 756; // 贴赤道刻度盘外缘(赤道网格 754 / 赤道刻度 756),与赤道网格区分
		const density = 96;
		// 过极大圆 decl 采样到 ±90(含极点):与赤道网格 vRange[-90,90] 同口径 —— equatorialToHorizontal 在极点返
		// 有限值(方位任意但 toSkyVector 落到天极轴点),故 28 条线在天极干净收敛、无断口/无留洞(±89.5 会在极点留洞=线断)。
		const declLo = -90;
		const declHi = 90;
		const dvs = (declHi - declLo) / density;
		// ① 经圈:每距星赤经一条过极大圆。宿界(第一条/每象首宿)略强调。
		sectorStars.forEach((item, idx)=>{
			const ra = normalizeDegrees(item.ra);
			// 四象配色/象首按传统宿序(角起),而非赤经升序 idx(否则整体偏移一象);宿名不识别则退回 idx。
			const seq = su28SequenceIndex(item);
			const ord = seq >= 0 ? seq : idx;
			const color = SU28_PALACE_COLORS[Math.floor(ord / 7) % SU28_PALACE_COLORS.length];
			const isPalaceHead = (ord % 7 === 0); // 每象首宿(角/斗/奎/井)经圈略强调
			const pts = [];
			for(let d = declLo; d <= declHi + 1e-9; d += dvs){
				pts.push({ ...equatorialToHorizontal(ra, d, jd, obs, refr), ra, decl: d });
			}
			const line = this.createLine(`grid-su28-mer-${item.id || item.name || idx}`, pts, color, isPalaceHead ? 0.42 : 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		});
		// ② 仅赤道腰线(decl=0):二十八宿以赤道为腰,去掉同心纬圈(用户:同心圆使盘面模糊),只留赤道一条。
		const equatorColor = new BABYLON.Color3(0.86, 0.74, 0.46);
		const us = 360 / density;
		{
			const pts = [];
			for(let u = 0; u <= 360 + 1e-9; u += us){
				const ra = u % 360;
				pts.push({ ...equatorialToHorizontal(ra, 0, jd, obs, refr), ra, decl: 0 });
			}
			const line = this.createLine('grid-su28-par-0', pts, equatorColor, 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		}
		// ③ 沿赤道(decl=0)标宿名:每宿区间中点处一枚 billboard,字号适中、防极点拥挤(都在赤道附近)。
		const labelRadius = radius + 6;
		const gate = !!this.layers.su28Grid;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const labelColor = `#${color.toHexString().slice(1)}`;
			const sectorLabel = su28DisplayName(item);
			const labelSource = { ra: midRa, decl: 0, name: sectorLabel, altitudeAppa: 0, azimuth: 0 };
			const plane = this.createTextPlane(sectorLabel, 24, labelColor, 'rgba(0,0,0,0)');
			plane.position = toSkyVector(projectedEquatorialItem(labelSource, jd, obs, refr), labelRadius);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { gridKey: 'su28Grid', labelKind: 'su28GridName' };
			plane.setEnabled(gate);
			this.registerProjectableMesh(plane, labelSource, labelRadius);
		});
		return group;
	}

	createBodies(bodies){
		const group = this.makeGroup('body-layer');
		bodies.forEach((body)=>{
			const diameter = {
				Sun: 28,
				Moon: 20,
				Mercury: 13,
				Venus: 16,
				Mars: 15,
				Jupiter: 19,
				Saturn: 18,
				Uranus: 15,
				Neptune: 15,
				Pluto: 12,
			}[body.id] || 12;
			const mesh = BABYLON.MeshBuilder.CreateSphere(`body-${body.id}`, { diameter, segments: TEXTURED_BODY_IDS.has(body.id) ? 32 : 18 }, this.scene);
			mesh.position = toSkyVector(body, BODY_RADIUS);
			mesh.material = this.createBodyMaterial(body);
			mesh.parent = group;
			mesh.metadata = { body: { ...body, displayName: bodyName(body), layer: 'body' } };
			this.pickMeshes.push(mesh);
			this.bodyMeshes[body.id] = mesh;
			this.bodyMeshes[bodyName(body)] = mesh;
			this.registerProjectableMesh(mesh, body, BODY_RADIUS);
			this.createBodyHalo(mesh, body, group);
			if(body.id === 'Moon'){
				this.createMoonPhaseDisc(body, mesh, group);
			}
			if(body.id === 'Saturn'){
				this.createSaturnRing(mesh, group);
			}

			if(ALWAYS_LABELED_BODY_IDS.has(body.id)){
				const labelSize = body.id === 'Sun' || body.id === 'Moon' ? 58 : 50;
				const labelOffset = body.id === 'Sun' ? 38 : (body.id === 'Moon' ? 34 : 29);
				const labelColor = body.id === 'Sun' ? '#ffe5a8' : (body.id === 'Moon' ? '#e9f4ff' : '#f4f7ff');
				const label = this.createTextPlane(bodyName(body), labelSize, labelColor, 'rgba(0,0,0,0)');
				label.position = mesh.position.add(new BABYLON.Vector3(0, labelOffset, 0));
				label.parent = group;
				label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				label.metadata = { labelKind: 'body' };
				this.registerFollowerMesh(label, body.id, ()=>new BABYLON.Vector3(0, labelOffset, 0));
			}
		});
	}

	applyLabelVisibility(){
		if(!this.camera || !this.scene){
			return;
		}
		const showBody = this.viewMode === 'ground' ? true : this.camera.radius < 1040;
		this.scene.meshes.forEach((mesh)=>{
			const kind = mesh.metadata && mesh.metadata.labelKind;
			if(kind === 'body'){
				mesh.setEnabled(showBody);
			}
		});
	}

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
	}

	_resetGridLod(){
		this._gridLodFactor = 1;
		this.scene.meshes.forEach((mesh)=>{
			const md = mesh.metadata;
			if(md && md.gridKey && md.lodFine && Number.isFinite(md.baseAlpha)){
				mesh.alpha = md.baseAlpha;
			}
		});
	}

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
	}

	createTraditionalLayer(kind, items, color, diameter){
		const group = this.makeGroup(`${kind}-layer`);
		items.forEach((raw)=>{
			// 二十八宿星点按传统距星真实位置画(后端 trueStar:胃=35 Ari / 鬼=θ Cnc,当日历元 + 地平坐标);
			// 宿界/宿区间仍按 item.ra(REAL 口径含经验赤经修正)——两者此前同用修正后坐标,星点不落在任何真实星位上。
			const ts = kind === 'su28' && raw && raw.trueStar && Number.isFinite(Number(raw.trueStar.ra)) ? raw.trueStar : null;
			const item = ts ? { ...raw, ra: ts.ra, decl: ts.decl, azimuth: ts.azimuth, altitudeTrue: ts.altitudeTrue, altitudeAppa: ts.altitudeAppa, distanceStar: ts.name } : raw;
			const mesh = BABYLON.MeshBuilder.CreateSphere(`${kind}-${item.id || item.name}`, { diameter: diameter || 5, segments: 8 }, this.scene);
			mesh.position = toSkyVector(item, BODY_RADIUS - 28);
			mesh.material = this.material(`${kind}-mat-${item.id || item.name}`, color, 0.9);
			mesh.parent = group;
			mesh.metadata = { body: { ...item, displayName: item.name || item.id, layer: kind } };
			this.pickMeshes.push(mesh);
			this.registerProjectableMesh(mesh, item, BODY_RADIUS - 28);
			if(item.id){ this.bodyMeshes[item.id] = mesh; }
			if(item.name){ this.bodyMeshes[item.name] = mesh; }
		});
		if(kind === 'beidou' && items.length > 1){
			this.createLine('beidou-line', items, color, 0.72, group, BODY_RADIUS - 28, true);
		}
	}

	// 拾取射线要的是画布**本地 CSS 坐标**(布局域);引擎给的 scene.pointerX/Y = clientX − 画布 rect.left,是视觉域 ——
	// 壳缩放档下两者差 z 倍:点星 / 读天区坐标 / 角距测量的射线会偏到「离画布原点 z 倍远」的方向上(100% 档重合,看不出来)。
	// 按「画布布局宽 ÷ rect 宽」折回,不问缩放值。
	pickXY(){
		if(this._pointerDomainPatched){ return { x: this.scene.pointerX, y: this.scene.pointerY }; }   // 已在引擎入口折回,别折两次
		const k = this.canvas ? pointerLocalRatio(this.canvas) : { kx: 1, ky: 1 };
		return { x: this.scene.pointerX * k.kx, y: this.scene.pointerY * k.ky };
	}

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
	}

	// 角距测量开关(默认关 → 零回归)。关闭时清起点 + 清连线弧、并清空读数。
	setMeasureMode(on){
		this.measureMode = !!on;
		if(!this.measureMode){
			this.measureFirst = null;
			this.clearMeasureMeshes();
			if(this.onMeasure){ this.onMeasure(null); }
		}
	}

	clearMeasureMeshes(){
		(this.measureMeshes || []).forEach((m)=>{ try{ m.dispose(); }catch(e){} });
		this.measureMeshes = [];
	}

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
	}

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
	}

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
	}

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
	}

	// 空白天区读坐标(任务 3):算当前指针方向坐标,经 onSkyReadout 交 React 显示。
	emitSkyReadout(){
		if(!this.onSkyReadout){ return; }
		const readout = this.skyReadoutFromPointer();
		if(readout){ this.onSkyReadout(readout); }
	}

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
	}

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
	}

	// React 侧在重投影时把当前 jd / observer 喂进来,使空白处读坐标用当前时刻(否则回退 J2000/数据自带)。
	setReadoutContext(jd, observer){
		this._readoutJd = Number.isFinite(Number(jd)) ? Number(jd) : this._readoutJd;
		if(observer){ this._readoutObserver = observer; }
	}

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
	}

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
	}

	applyGridGroupVisibility(group, on){
		group.setEnabled(!!on);
		if(on){
			group.getChildMeshes().forEach((m)=>{
				if(m.metadata && m.metadata.labelKind === 'gridCoord'){ m.setEnabled(!!this.layers.coordLabels); }
			});
		}
	}

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
				group.setEnabled(!!this.layers.xingguan);
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
	}

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
	}

	// perf:planetariumRenderGating —— 每帧渲染体(原 runRenderLoop 闭包,内容一字不动;新增静止降帧 + metrics 节流)。
	_renderTick(){
		if(!this.scene){
			return;
		}
		const t = nowMs();
		// A2 静止降帧:可见+激活但「未播放 / 无补间动画 / 非刚交互(settle)/ 未被显式请求」时,
		// 渲染降到 ~10fps。静止画面在任何帧率下视觉完全一致,且把 CPU 让回主线程消除全局卡顿;
		// 任何变更最迟 ≤PLANETARIUM_IDLE_FRAME_MS 上屏(不漏帧、不陈旧),播放/拖动/动画期间仍满帧。
		if(this._onDemand){
			const live = this._renderRequested
				|| this._playing
				|| (this.scene.animatables && this.scene.animatables.length > 0)
				|| (t < this._settleUntil);
			if(!live){
				if(this._lastIdleRender && (t - this._lastIdleRender) < PLANETARIUM_IDLE_FRAME_MS){
					return;
				}
			}
			this._renderRequested = false;
			this._lastIdleRender = t;
		}
		this.updateGroundScenePosition();
		this.applyLabelVisibility();
		this.applyGridLod();
		this.scene.render();
		if(this.onMetrics){
			// B:FPS/网格调试读数节流到 ~2Hz(getFps 本就是滚动均值,2Hz 与 60Hz 读同一值类、零精度损失)。
			if(!this._metricsThrottle || !this._lastMetricEmit || (t - this._lastMetricEmit) >= 500){
				this._lastMetricEmit = t;
				const fps = Math.round(this.engine.getFps());
				this.onMetrics({
					fps: Number.isFinite(fps) ? Math.min(240, Math.max(0, fps)) : 0,
					meshes: this.scene.meshes.length,
				});
			}
		}
	}

	_startRenderLoop(){
		if(this._loopRunning || !this.engine){
			return;
		}
		if(!this._boundRenderTick){
			this._boundRenderTick = this._renderTick.bind(this);
		}
		this.engine.runRenderLoop(this._boundRenderTick);
		this._loopRunning = true;
	}

	startRenderLoop(){
		this._startRenderLoop();
	}

	// A1:隐藏/非激活时停渲染循环(只停「画」,scene/engine/state 全保留;恢复时 renderOnce 重绘实况)。
	stopRenderLoop(){
		if(!this.engine){
			this._loopRunning = false;
			return;
		}
		if(this._boundRenderTick){
			this.engine.stopRenderLoop(this._boundRenderTick);
		}else{
			this.engine.stopRenderLoop();
		}
		this._loopRunning = false;
	}

	// 单帧硬渲染:恢复显示时立即重绘当前实况帧(无陈旧、无 A→B 跳变)。
	renderOnce(){
		if(!this.scene || !this.engine){
			return;
		}
		this.updateGroundScenePosition();
		this.applyLabelVisibility();
		this.applyGridLod();
		this.scene.render();
		this._renderRequested = false;
		this._lastIdleRender = nowMs();
	}

	// 显式请求下一帧满帧(场景内容变更后调用 → ≤1 帧上屏;静止降帧下仍即时可见)。
	requestRender(){
		this._renderRequested = true;
	}

	// 一次用户交互/相机变更 → 短窗内维持满帧(拖动顺滑 + 覆盖惯性/收尾)。
	markCameraSettle(){
		this._settleUntil = nowMs() + PLANETARIUM_SETTLE_MS;
	}

	// React 侧 speed 变化时同步(播放中恒满帧)。
	setPlaying(playing){
		this._playing = !!playing;
		if(playing){
			this._renderRequested = true;
		}
	}

	dispose(){
		this.disposed = true;
		this._loopRunning = false;
		window.removeEventListener('resize', this.resizeHandler);
		if(this.wheelHandler){
			this.canvas.removeEventListener('wheel', this.wheelHandler);
		}
		if(this.pointerDownHandler){
			this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
			this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
			this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
			this.canvas.removeEventListener('pointercancel', this.pointerUpHandler);
		}
		this.clearMeasureMeshes();
		this.clearData();
		if(this.sky){
			this.sky.dispose(false, true);
		}
		if(this.skyTexture){
			this.skyTexture.dispose();
			this.skyTexture = null;
		}
		if(this.horizonGlow){
			this.horizonGlow.dispose(false, true);
		}
		if(this.groundOccluder){
			this.groundOccluder.dispose(false, true);
		}
		if(this.horizonPanorama){
			this.horizonPanorama.dispose(false, true);
		}
		if(this.horizonMist){
			this.horizonMist.dispose(false, true);
		}
		if(this.horizonMistTexture){
			this.horizonMistTexture.dispose();
			this.horizonMistTexture = null;
		}
		(this.landscapeMeshes || []).forEach((mesh)=>mesh.dispose(false, true));
		if(this.glow){
			this.glow.dispose();
		}
		if(this.scene){
			this.scene.dispose();
			this.scene = null;
		}
		if(this.engine){
			this.engine.stopRenderLoop();
			this.engine.dispose();
			this.engine = null;
		}
	}
}
