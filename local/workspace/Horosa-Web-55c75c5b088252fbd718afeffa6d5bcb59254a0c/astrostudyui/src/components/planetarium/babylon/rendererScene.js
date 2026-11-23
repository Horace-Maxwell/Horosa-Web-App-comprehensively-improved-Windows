// 天文馆渲染器 · 场景搭建:引擎与场景初始化、清空数据、分组与材质、地面 / 地平全景 / 雾 / 地形带 / 地景、天体表面纹理与材质、光晕、土星环、月相盘、地球锚点
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { BABYLON, SKY_RADIUS, BODY_RADIUS, LINE_RADIUS, OBSERVER_EYE_HEIGHT, GROUND_MIN_FOV, GROUND_MAX_FOV, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS, HORIZON_PANORAMA_URL, BODY_COLORS, TEXTURED_BODY_IDS, BODY_VISUALS } from './constants';
import { degToRad, clamp, toSkyVector } from './skyMath';
import { bodyName } from './itemText';
import { noise2, paintSkySurface, paintHorizonMistSurface, planetTextureSize, paintPlanetSurface, paintMoonPhase } from './textures';

export const rendererSceneMethods = {
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
	},

	clearData(){
		this.detachSurfaceTextures();
		this._asterismsBuilt = false;
		this.cancelChineseAsterismBuild();
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
	},

	makeGroup(name){
		const group = new BABYLON.TransformNode(name, this.scene);
		this.groups.push(group);
		return group;
	},

	material(name, color, alpha = 1){
		const mat = new BABYLON.StandardMaterial(name, this.scene);
		mat.disableLighting = true;
		mat.emissiveColor = color;
		mat.diffuseColor = color;
		mat.alpha = alpha;
		return mat;
	},

	createGroundMaterial(){
		const mat = new BABYLON.StandardMaterial('ground-horizon-occluder-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.emissiveColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.alpha = 0;
		return mat;
	},

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
	},

	// 设地平裙边纹理:原照片全景地面(纹理灰阶由材质 diffuse/emissive 跟随昼夜 palette 染色)。
	applyHorizonTexture(mat){
		mat = mat || (this.horizonPanorama && this.horizonPanorama.material);
		if(!mat){ return; }
		if(mat.diffuseTexture){ mat.diffuseTexture.dispose(); }
		const tex = new BABYLON.Texture(HORIZON_PANORAMA_URL, this.scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
		tex.hasAlpha = true; tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE; tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
		mat.diffuseTexture = tex; mat.emissiveTexture = tex; mat.opacityTexture = tex;
	},

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
	},

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
	},

	createHorizonLandscape(){
		const ridge = this.createTerrainBand('distant-ridge-silhouette', LINE_RADIUS - 36, -14, 0.15, 1.25, new BABYLON.Color3(0.025, 0.052, 0.046));
		const nearRidge = this.createTerrainBand('near-field-silhouette', LINE_RADIUS - 62, -16, -0.8, 0.68, new BABYLON.Color3(0.018, 0.038, 0.03));
		return [ridge, nearRidge];
	},

	// 日月行星的表面贴图只跟「是哪颗星」有关(月亮再加月相角),和回包时刻 / 观测点无关。
	// 每来一份全量数据(开场补全两次、改时间、换地点、回命盘时刻…)整场重建时,原先十一张贴图逐张重画重传,
	// 占掉重建的三成多(一次约 30ms)。画过的留在渲染端复用:重建只换网格和材质,贴图原样接回去。
	surfaceTextureKey(id, phase){
		if(id !== 'Moon'){
			return `${id}`;
		}
		const angle = Number(phase && phase.phaseAngle) || 0;
		return `Moon@${angle.toFixed(2)}`;
	},

	createSurfaceTexture(id, phase){
		const moonPhase = id === 'Moon' ? (phase || this.currentMoonPhase) : null;
		const key = this.surfaceTextureKey(id, moonPhase);
		const cached = this._surfaceTextures.get(key);
		if(cached){
			return cached;
		}
		const size = planetTextureSize(id);
		const texture = new BABYLON.DynamicTexture(`surface-${id}-${Math.random()}`, size, this.scene, true);
		texture.hasAlpha = id === 'Moon';
		const ctx = texture.getContext();
		if(id === 'Moon'){
			paintMoonPhase(ctx, moonPhase, size.width);
		}else{
			paintPlanetSurface(ctx, id, size.width, size.height);
		}
		texture.update(true);
		if(id === 'Moon'){
			// 月相变了:旧月相的贴图不再有人用(用它的材质在上一次清场时已摘掉贴图并释放),只留当前这一张
			this._surfaceTextures.forEach((old, oldKey)=>{
				if(oldKey.indexOf('Moon@') === 0){
					old.dispose();
					this._surfaceTextures.delete(oldKey);
				}
			});
		}
		this._surfaceTextures.set(key, texture);
		return texture;
	},

	// 清场前把留用贴图从材质上摘下来:随后 group.dispose(false, true) 会连材质带贴图一起释放,不摘就把留用的贴图也释放了。
	detachSurfaceTextures(){
		(this._surfaceMats || []).forEach((mat)=>{
			mat.diffuseTexture = null;
			mat.emissiveTexture = null;
			mat.opacityTexture = null;
		});
		this._surfaceMats = [];
	},

	disposeSurfaceTextures(){
		this.detachSurfaceTextures();
		this._surfaceTextures.forEach((texture)=>texture.dispose());
		this._surfaceTextures.clear();
	},

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
		this._surfaceMats.push(mat);
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
	},

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
	},

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
	},

	createMoonPhaseDisc(body, mesh, group){
		const texture = this.createSurfaceTexture('Moon', this.currentMoonPhase);
		const mat = new BABYLON.StandardMaterial(`moon-phase-disc-mat-${Math.random()}`, this.scene);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		this._surfaceMats.push(mat);
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
	},

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
	},
};
