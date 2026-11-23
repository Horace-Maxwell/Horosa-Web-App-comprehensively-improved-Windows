// 天文馆渲染器 · 星与标签:方位字、文字面板与重绘、恒星与亮星、星表应用、星名、天体、标签可见性
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { projectedEquatorialItem } from '../planetariumProjection';
import { buildStarIndex } from '../planetariumStarSearch';
import { BABYLON, BODY_RADIUS, STAR_RADIUS, LINE_RADIUS, STAR_MAG_LIMIT_MAX, TEXTURED_BODY_IDS, ALWAYS_LABELED_BODY_IDS } from './constants';
import { nowMs, clamp, starTemperatureColor, toSkyVector, observerFromData } from './skyMath';
import { starProperName, bodyName } from './itemText';
import { labelCropRect, labelRectCovers, labelPlanePositions, isFullLabelRect } from './labelCrop';

export const rendererStarMethods = {
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
	},

	// 界面简繁切换后重画全部文字标签纹理(canvas 上的字画好就不会自己变;宿主经 watchChartScript 调)
	repaintTextLabels(){
		(this._labelPainters || new Set()).forEach((fn)=>{ try{ fn(); }catch(e){ /* 单张失败不影响其余 */ } });
	},

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
		const FULL = { x: 0, y: 0, w: texW, h: texH };
		const hasBg = !!(bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent');
		// 文字用深色描边(halo)代替底板:任意背景都清晰、无方框(成熟星图做法)。
		const fpx = Math.round(fontPx * factor);
		const lineWidth = clamp(Math.round(fpx * 0.13), 3, 9);
		const ty = Math.round(78 * factor);
		const scale = Math.max(0.9, fontPx / 48);
		const planeW = 58 * scale;
		const planeH = 29 * scale;
		const texName = `label-${text}-${Math.random()}`;
		// 无底板的名牌只留字的那一块纹理(见 labelCrop.js):整幅 1024x512 一张约 2.7MB 显存,
		// 三百多个星官名首次打开要同步建近一秒。量字与画字用同一张画布(简繁转换按画布登记,两边同一份字)。
		// 带底板的(四方位牌)底板铺满整幅,照旧整幅建。
		let canvas = null;
		let measureCtx = null;
		if(!hasBg && typeof document !== 'undefined' && typeof document.createElement === 'function'){
			try{
				canvas = document.createElement('canvas');
				measureCtx = canvas.getContext('2d');
			}catch(e){
				measureCtx = null;
			}
			if(!measureCtx){ canvas = null; }
		}
		const setFont = (c)=>{
			c.font = `600 ${fpx}px sans-serif`;
			c.textAlign = 'left';
			c.textBaseline = 'alphabetic';
		};

		const mat = new BABYLON.StandardMaterial(`label-mat-${text}-${Math.random()}`, this.scene);
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		const plane = BABYLON.MeshBuilder.CreatePlane(`label-${text}`, {
			width: planeW,
			height: planeH,
			updatable: !!canvas,
		}, this.scene);
		const basePositions = canvas ? Array.from(plane.getVerticesData(BABYLON.VertexBuffer.PositionKind) || []) : null;

		let texture = null;
		let ctx = null;
		let rect = FULL;
		if(!this._labelPainters){ this._labelPainters = new Set(); }
		const painters = this._labelPainters;
		const uploads = this._labelUploads;
		let paint = null;
		// 建(或换)这张名牌的纹理:尺寸 = 裁剪块;牌面顶点同步改到原牌面里对应的子矩形。
		const bindTexture = (nextRect)=>{
			const old = texture;
			if(canvas){
				canvas.width = nextRect.w;
				canvas.height = nextRect.h;
				texture = new BABYLON.DynamicTexture(texName, canvas, this.scene, true);
			}else{
				texture = new BABYLON.DynamicTexture(texName, { width: nextRect.w, height: nextRect.h }, this.scene, true);
			}
			const mine = texture;
			texture.hasAlpha = true;
			ctx = texture.getContext();
			texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
			texture.anisotropicFilteringLevel = 8;
			// 纹理释放时摘掉重画回调(换纹理时旧的那张释放不算)
			if(texture.onDisposeObservable && typeof texture.onDisposeObservable.add === 'function'){
				texture.onDisposeObservable.add(()=>{ uploads.drop(mine); if(texture === mine){ painters.delete(paint); } });
			}
			mat.diffuseTexture = texture;
			mat.emissiveTexture = texture;
			mat.opacityTexture = texture;
			rect = nextRect;
			if(basePositions && basePositions.length){
				plane.setVerticesData(
					BABYLON.VertexBuffer.PositionKind,
					labelPlanePositions(basePositions, rect, texW, texH, planeW, planeH),
					true,
				);
				plane.refreshBoundingInfo();
			}
			if(old){ old.dispose(); }
		};
		paint = ()=>{
			let tw = null;
			// 换纹理(重画时字变宽、原裁剪块盖不住)那一次当场上传:新纹理没传完之前这张名牌不画,延后会让它空两帧
			const swapped = !!texture;
			let rebound = false;
			if(measureCtx){
				// 先量再定纹理:裁剪块盖不住这次要画的字(界面简繁切换后字变宽)就换一张
				setFont(measureCtx);
				const m = measureCtx.measureText(text);
				tw = m.width;
				const crop = labelCropRect({
					texW, texH, ty, lineWidth,
					tx: Math.max(0, (texW - tw) / 2),
					metrics: {
						width: m.width,
						asc: m.actualBoundingBoxAscent,
						desc: m.actualBoundingBoxDescent,
						left: m.actualBoundingBoxLeft,
						right: m.actualBoundingBoxRight,
					},
				});
				const want = crop ? crop.rect : FULL;
				const fits = crop ? labelRectCovers(rect, crop.need, texW, texH) : isFullLabelRect(rect, texW, texH);
				if(!texture || !fits){ bindTexture(want); rebound = swapped; }
			}else if(!texture){
				bindTexture(FULL);
			}
			ctx.clearRect(0, 0, rect.w, rect.h);
			// 仅当显式给出不透明底板时才填(默认不填,避免难看黑框)。
			if(hasBg){
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, rect.w, rect.h);
			}
			setFont(ctx);
			// Use measured left-aligned text. Some WebKit glyph paths ignore textAlign=center
			// for CJK labels, leaving the baked text offset from the billboard center.
			if(tw === null){ tw = ctx.measureText(text).width; }
			const tx = Math.max(0, (texW - tw) / 2) - rect.x;
			const by = ty - rect.y;
			// halo
			ctx.lineJoin = 'round';
			ctx.miterLimit = 2;
			ctx.lineWidth = lineWidth;
			ctx.strokeStyle = 'rgba(3,6,14,0.92)';
			ctx.strokeText(text, tx, by);
			// fill
			ctx.fillStyle = color || '#fff';
			ctx.fillText(text, tx, by);
			// 画完不当场上传:WebKit 画布延迟栅格化,当场上传 = 主线程原地等栅格化(一张约 1ms,一次几十上百张就是一个长帧);
			// 交给队列隔两帧再传(那时后台已栅格化好)。渲染循环还没转(含测试环境)时当场传,和原先一样。
			const painted = texture;
			if(rebound || !uploads.push(painted, ()=>painted.update(true))){ painted.update(true); }
		};
		paint();
		// 界面简繁切换后重画(repaintTextLabels;纹理释放时摘掉)
		painters.add(paint);
		// TRILINEAR + anisotropy(见 bindTexture)keeps the (now higher-res) label sharp when viewed
		// obliquely / at varying distance.
		plane.material = mat;
		plane.isPickable = false;
		plane.renderingGroupId = 2;
		return plane;
	},

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
		this._starUnitsCatalog = null; // 星表换了 → 播放热路径的单位向量缓存作废
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
	},

	// 星云(重)建成后按最近一次显示时刻/观测点重投影;无记录(尚未播放/步进)= 与后端全量时刻一致,免投影。
	reprojectStarsToDisplayTime(){
		if(!this._lastProjectedTime || this.disposed || !this.scene){
			return;
		}
		try{
			this.updateProjectedTime(this._lastProjectedTime, this._lastProjectedFields);
		}catch(e){ /* 投影失败不影响建云 */ }
	},

	// 只重建某一组(不走整场清场)时,把这组网格在拾取 / 重投影 / 跟随 / 天体表里的登记一并摘掉;
	// 不摘 = 已释放的网格留在表里,逐帧重投影白算一遍,点选还可能命中一个已经不存在的球。
	unregisterGroupMeshes(group){
		const meshes = group && group.getChildMeshes ? group.getChildMeshes(false) : [];
		if(!meshes || !meshes.length){
			return 0;
		}
		const gone = new Set(meshes);
		this.pickMeshes = (this.pickMeshes || []).filter((mesh)=>!gone.has(mesh));
		this.projectableMeshes = (this.projectableMeshes || []).filter((item)=>!gone.has(item && item.mesh));
		this.followMeshes = (this.followMeshes || []).filter((item)=>!gone.has(item && item.mesh));
		Object.keys(this.bodyMeshes || {}).forEach((key)=>{
			if(gone.has(this.bodyMeshes[key])){
				delete this.bodyMeshes[key];
			}
		});
		return meshes.length;
	},

	// 后台补全完整星表的那次回包:场景里别的都没变,只换星表(按名搜索的索引 + 升高星等上限时补齐用的来源),不整场重建。
	// 完整表按当前星等上限筛出来的星与场景里的点云逐颗相同(亮集是全表按星等排的前缀,默认上限下都是这样)
	//   → 点云、亮星球一颗不动,只换表;随后调用方 updateProjectedTime 按新表摆位(坐标同为 J2000,位置不变)。
	// 筛出来的不一样(多了 / 少了 / 次序不同)→ 交给 updateStars 只重建恒星。
	// 返回耗时毫秒;场景没就绪 / 点云还在建 / 回包没带星表 → 返回 -1,调用方照旧整场重建。
	applyStarCatalog(data){
		const catalog = data && data.stars && data.stars.catalog;
		if(!this.scene || this.disposed || !this.lastData || !this.starPcs || this.starBuildPending || !catalog || !catalog.length){
			return -1;
		}
		const started = nowMs();
		this.lastData = { ...this.lastData, stars: { ...(this.lastData.stars || {}), catalog } };
		const shown = this.magLimit >= STAR_MAG_LIMIT_MAX ? catalog : catalog.filter((s)=>Number(s.mag || 5) <= this.magLimit + 1e-6);
		const current = this.starCatalog || [];
		const particles = this.starPcs.particles || [];
		let same = shown.length > 0 && shown.length === current.length && particles.length === shown.length;
		for(let i = 0; same && i < shown.length; i += 1){
			const next = shown[i];
			const prev = current[i];
			if(!prev || next.id !== prev.id || Number(next.mag) !== Number(prev.mag)){
				same = false;
			}
		}
		if(same){
			this.starFullCatalog = catalog;
			this.starIndex = buildStarIndex(catalog);
			this.starCatalog = shown;
			this._starUnitsCatalog = null; // 星表对象换了 → 播放热路径的单位向量缓存按新表重算
			this.starBuiltMagLimit = this.magLimit;
		}else{
			this.updateStars(catalog);
		}
		return Math.round(nowMs() - started);
	},

	updateBrightStars(stars){
		const oldGroup = this.groups.find((group)=>group.name.indexOf('bright-stars-layer') === 0);
		if(oldGroup){
			this.unregisterGroupMeshes(oldGroup);
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
	},

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
	},

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
	},

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
	},
};
