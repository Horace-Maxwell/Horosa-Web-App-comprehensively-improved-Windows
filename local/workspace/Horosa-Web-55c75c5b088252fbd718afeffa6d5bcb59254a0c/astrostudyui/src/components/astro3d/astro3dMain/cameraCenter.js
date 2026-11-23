// 3D 星盘 · 相机与中心模式:组转角、相机距离、机位预设与飞行、轨道控制、日心 / 地心等中心模式切换与补间
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { sph } from '../sphMath';
import { shortestArcDelta, easeInOutCubic } from '../morphMath';
import PlanetocentricMode from '../PlanetocentricMode';
import * as AstroHelper from '../../astro/AstroHelper';
import { CAM_DIST_RATIO_DEFAULT, CAM_DIST_RATIO_MIN } from './sceneConst';

export const cameraCenterMethods = {
	// 盘面整组绕黄极转 (270 − 上升点)(initMesh / 补间 applyMorphFrame),相机却按未旋转世界系定位
	// → 「春分点」等预设与「摄像机天球经度」滑杆只在上升点 = 270° 时对准。统一口径:预设/滑杆值 = 黄道经度,
	// 换算成世界系时加上组旋转角;读回相机经度时减去。
	groupRotationDeg(){
		return this.group ? (this.group.rotation.y * 180 / Math.PI) : 0;
	},

	// 相机距离:存的是半径倍数。旧存量是绝对像素(> maxCamDistRatio 即可判定,典型 700~2000),它对应的半径
	// 是「首次建盘那次」的画布,现已不可知 —— 按当前半径折算会失真(实测:1.25 档存下的 822 在 0.7 档折成 1.3 倍,
	// 夹到 2 倍后球体仍撑爆画面),所以旧存量一律回到缺省 3.5 倍(旧语义本就随缩放失真,不值得保留);
	// 之后用户再调滑杆存的就是倍数,任何缩放档/窗口尺寸取景一致。
	normalizeCamDistance(v){
		let n = Number(v);
		if(!Number.isFinite(n) || n <= 0 || n > this.maxCamDistRatio){ return CAM_DIST_RATIO_DEFAULT; }
		return Math.min(this.maxCamDistRatio, Math.max(CAM_DIST_RATIO_MIN, n));
	},

	camDistance(){
		return this.normalizeCamDistance(this.chartOpt['摄像机与球心距离']) * this.radius;
	},

	setupCameraPos(){
		let r = this.camDistance();
		let lon = this.chartOpt['摄像机天球经度'];
		let lat = this.chartOpt['摄像机天球纬度'];
		const p = sph(Number(lon) + this.groupRotationDeg(), lat, r);
		this.camera.position.set(p.x, p.y, p.z);
		this.camera.lookAt(this.scene.position);
		this.camera.updateProjectionMatrix();
	},

	// 组旋转角变化 Δ(度)时把相机绕黄极同步转 Δ:用户当前视角相对盘面(黄道经度)不变(相机随盘面同框架)。
	rotateCameraWithGroup(deltaDeg){
		if(!this.camera || !Number.isFinite(deltaDeg) || Math.abs(deltaDeg) < 1e-9){
			return;
		}
		const cur = this.camera.position;
		const r = cur.length();
		if(!(r > 0)){ return; }
		const lat = Math.asin(cur.y / r) * 180 / Math.PI;
		const lon = ((Math.atan2(-cur.z, cur.x) * 180 / Math.PI) + 360) % 360;
		const p = sph(lon + deltaDeg, lat, r);
		this.camera.position.set(p.x, p.y, p.z);
		this.camera.lookAt(this.scene.position);
	},

	// —— WS-1 相机预设+缓动飞行(手写 rAF 缓动,本仓范式不引 gsap) ——
	// 场景为黄道坐标系(Y=黄道北极);北天极按黄赤交角摆(WS-2 接当日真 eps 前取均值)。
	// 出生地地平(天顶方向)依赖 chartObj 的 ASC:取 asc.lon 方向的地平上方视角。
	getCameraPresets(){
		const asc = this.chartObj && AstroHelper.getObject(this.chartObj, 'Asc');
		const presets = {
			vernal: { lon: 0, lat: 0, name: '春分点' },
			northPole: { lon: 90, lat: 66.56, name: '北天极' },
			eclipticPole: { lon: 0, lat: 89.9, name: '黄道极' },
		};
		if(asc && asc.lon !== undefined){
			presets.horizonAsc = { lon: asc.lon, lat: 15, name: '出生地地平' };
		}
		return presets;
	},

	/** 相机球面缓动飞行:lon 最短弧 + lat 线性 + 距离 log 插值;flag 无关(纯交互增强) */
	flyToPreset(key){
		const preset = this.getCameraPresets()[key];
		if(!preset){
			return;
		}
		const cur = this.camera.position;
		const curR = cur.length();
		const curLat = Math.asin(cur.y / (curR || 1)) * 180 / Math.PI;
		const rot = this.groupRotationDeg();   // 黄道经度 ↔ 世界经度 换算
		const curLon = ((Math.atan2(-cur.z, cur.x) * 180 / Math.PI) - rot + 720) % 360;
		const dstR = this.camDistance();
		let dLon = shortestArcDelta(curLon, preset.lon);   // 最短弧(与滑移补间同源公式)
		const t0 = performance.now();
		const dur = 1200;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			const e = easeInOutCubic(t);
			const lon = curLon + dLon * e;
			const lat = curLat + (preset.lat - curLat) * e;
			const r = Math.exp(Math.log(curR) + (Math.log(dstR) - Math.log(curR)) * e);
			const p = sph(lon + this.groupRotationDeg(), lat, r);
			this.camera.position.set(p.x, p.y, p.z);
			this.camera.lookAt(this.scene.position);
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	initOrbit(){
		let controls = new OrbitControls(this.camera, this.renderer.domElement);
		controls.autoRotate = this.chartOpt['摄像机旋转'];    //是否自动旋转
		// WS-0:阻尼开启(交互更顺滑)。阻尼要求每帧 update —— 与按需渲染状态机配合:
		// damping 衰减期 controls.update() 产生位移会再触发 'change' 事件 → wake 链式自续,
		// 静止后 change 停 → wakeFrames 耗尽 → rAF 停(idle 0 渲染)。
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.enableZoom = true;    //是否可以缩放
		controls.minDistance = 0.1;   //设置相机距离原点的最近距离
		controls.maxDistance = this.radius * this.maxCamDistRatio;  //设置相机距离原点的最远距离
		controls.enablePan = true;   //是否开启右键拖拽

		// 按需渲染唤醒源①:用户交互(拖转/缩放/平移)与阻尼衰减
		controls.addEventListener('start', ()=>this.wake(2));
		controls.addEventListener('change', ()=>this.wake(2));

		this.orbits = controls;
	},

	/**
	 * 模式总入口。center='geo' → 退出覆盖组(带回飞动画);非 geo + 同中心 →
	 * 数据原地刷新(改时间等);非 geo + 换中心 → 换系动画。
	 * @param {string} center  'geo'|'helio'|'moon'|'mercury'|...|'pluto'
	 * @param {object} state3d /chart3d/state 响应(center='geo' 时可省)
	 */
	setCenterMode(center, state3d){
		const c = center || 'geo';
		if(this.disposed || !this.scene){
			return;
		}
		if(c === 'geo'){
			if(this.chartMode === 'geo' && !this.pctrMode){
				// 已在地心稳态(零动作,默认路径零改),或回飞收尾中(重复点地心
				// no-op:退休组由其收尾闭包自然落地,不做瞬间清场)
				return;
			}
			this.startCenterTransition('geo', null);
			return;
		}
		if(!state3d || !state3d.bodies || !state3d.bodies.length){
			return;
		}
		if(this.chartMode === c && this.pctrMode){
			// 同中心数据刷新:原地更新,不走换系动画
			this.pctrMode.update(state3d);
			this.wake(2);
			return;
		}
		this.startCenterTransition(c, state3d);
	},

	getCenterMode(){
		return this.chartMode;
	},

	/** 半径两档切换:sqrt 缩放(默认)/等半径壳层;非地心在场时就地重铺 */
	setCenterShellMode(flag){
		this._pctrShell = !!flag;
		if(this.pctrMode && this.pctrMode.state){
			const st = this.pctrMode.state;
			this.pctrMode.dispose();
			const mode = new PlanetocentricMode();
			this.scene.add(mode.build(st, { radius: this.radius, shell: this._pctrShell }));
			this.pctrMode = mode;
			this.wake(2);
		}
	},

	/**
	 * 旧端锚点采集:id → 场景世界坐标。覆盖组在场(含被打断仍在飞的退休组)取其
	 * 当前实际位置(连切中心时从中间态续飞);否则取本命行星世界坐标(group 带
	 * ASC 旋转必须取 world),地球=中心原点。旧中心体锚点=其中心组当前位置。
	 */
	collectCenterAnchors(){
		const anchors = new Map();
		const src = this.pctrMode || this._pctrRetiring;
		if(src && src.state){
			src.bodyMap.forEach((grp, id)=>{
				anchors.set(id, grp.position.clone());
			});
			if(src.centerBodyId && !anchors.has(src.centerBodyId)){
				anchors.set(src.centerBodyId,
					src.centerGroup ? src.centerGroup.position.clone() : new THREE.Vector3(0, 0, 0));
			}
		}else{
			this.scene.updateMatrixWorld(true);
			this.planetMap.forEach((mesh, id)=>{
				anchors.set(id, mesh.getWorldPosition(new THREE.Vector3()));
			});
			anchors.set('Earth', new THREE.Vector3(0, 0, 0));
		}
		return anchors;
	},

	/** 换系过渡:构建两端飞位/淡出入计划并启动补间(token 支持连切接管) */
	startCenterTransition(center, newState){
		this._centerToken = (this._centerToken || 0) + 1;
		const token = this._centerToken;
		const anchors = this.collectCenterAnchors();

		// 双重打断兜底:上一场未收尾的退休组即刻清(其收尾闭包已被 token 作废)
		if(this._pctrRetiring){
			this._pctrRetiring.dispose();
			this._pctrRetiring = null;
		}

		const items = [];   // 天体飞位 { obj, from, to, delay, dur, scaleIn|scaleOut }
		const fades = [];   // 线材质   { material, from, to, delay, dur }
		const STAG = 60;    // 每星级联错峰
		const DUR = 1200;   // 单星 1.2s easeInOutCubic

		if(center !== 'geo'){
			const oldPctr = this.pctrMode;
			this.pctrMode = null;
			const mode = new PlanetocentricMode();
			const root = mode.build(newState, { radius: this.radius, shell: this._pctrShell });
			this.scene.add(root);
			this.pctrMode = mode;
			this.chartMode = center;
			this.group.visible = false;   // 本命组退场(幂等;回 geo 时恢复)

			// 旧覆盖组:天体即时退场(视觉连续性由新组同位起飞接管),线短淡出后整组清
			if(oldPctr){
				if(oldPctr.bodiesGroup){ oldPctr.bodiesGroup.visible = false; }
				if(oldPctr.centerGroup){ oldPctr.centerGroup.visible = false; }
				oldPctr.lineMaterials().forEach((entry)=>{
					fades.push({ material: entry.material, from: entry.material.opacity, to: 0, delay: 0, dur: 300 });
				});
				this._pctrRetiring = oldPctr;
			}

			// 飞位计划:两端都在=旧位起飞;新入场=终点原地 scale-in;按终点半径升序错峰
			const entries = [];
			mode.bodyMap.forEach((grp, id)=>{
				entries.push({ id: id, obj: grp, to: grp.position.clone() });
			});
			entries.sort((a, b)=>a.to.length() - b.to.length());
			entries.forEach((ent, idx)=>{
				const from = anchors.get(ent.id);
				if(from){
					items.push({ obj: ent.obj, from: from.clone(), to: ent.to, delay: idx * STAG, dur: DUR });
				}else{
					items.push({ obj: ent.obj, from: null, to: ent.to, delay: idx * STAG, dur: DUR, scaleIn: true });
				}
			});
			// 旧新中心体对飞:新中心体从旧端位置飞进原点(旧中心体已是 bodies 普通天体在上表飞出)
			const centerFrom = anchors.get(mode.centerBodyId);
			if(centerFrom && mode.centerGroup){
				items.push({ obj: mode.centerGroup, from: centerFrom.clone(), to: new THREE.Vector3(0, 0, 0), delay: 0, dur: DUR });
			}
			// 新组轨道/相位线:后半程淡入(天体大致就位后成形)
			mode.lineMaterials().forEach((entry)=>{
				fades.push({ material: entry.material, from: 0, to: entry.baseOpacity, delay: DUR * 0.5, dur: DUR * 0.75 });
			});

			this.runCenterTween(token, items, fades, ()=>{
				if(this._pctrRetiring){
					this._pctrRetiring.dispose();
					this._pctrRetiring = null;
				}
			});
		}else{
			// 目标=地心:覆盖组天体飞回本命世界坐标,线淡出;终帧撤组、亮本命
			const oldPctr = this.pctrMode;
			this.pctrMode = null;
			this.chartMode = 'geo';
			if(!oldPctr){
				// 双重打断到空场(如回飞途中再点地心):被杀旧场的帧预算旗标就地收回
				this._centerTweenActive = false;
				this.group.visible = true;
				this.wake(2);
				return;
			}
			this._pctrRetiring = oldPctr;
			this.scene.updateMatrixWorld(true);
			const entries = [];
			oldPctr.bodyMap.forEach((grp, id)=>{
				entries.push({ id: id, obj: grp, from: grp.position.clone() });
			});
			entries.sort((a, b)=>a.from.length() - b.from.length());
			entries.forEach((ent, idx)=>{
				let to = null;
				if(ent.id === 'Earth'){
					to = new THREE.Vector3(0, 0, 0);   // 地球飞回中心(与本命语义合账)
				}else{
					const mesh = this.planetMap.get(ent.id);
					if(mesh){
						to = mesh.getWorldPosition(new THREE.Vector3());
					}
				}
				if(to){
					items.push({ obj: ent.obj, from: ent.from, to: to, delay: idx * STAG, dur: DUR });
				}else{
					// 本命端不在场(如 planetDisp 未勾选):原地缩隐退场
					items.push({ obj: ent.obj, from: ent.from, to: null, delay: idx * STAG, dur: DUR, scaleOut: true });
				}
			});
			// 旧中心体对飞:飞回其本命世界坐标(如火星心的火星回地心盘火星位)
			if(oldPctr.centerGroup && oldPctr.centerBodyId){
				const nativeMesh = this.planetMap.get(oldPctr.centerBodyId);
				if(nativeMesh){
					items.push({
						obj: oldPctr.centerGroup,
						from: oldPctr.centerGroup.position.clone(),
						to: nativeMesh.getWorldPosition(new THREE.Vector3()),
						delay: 0,
						dur: DUR,
					});
				}else{
					items.push({ obj: oldPctr.centerGroup, from: oldPctr.centerGroup.position.clone(), to: null, delay: 0, dur: DUR, scaleOut: true });
				}
			}
			oldPctr.lineMaterials().forEach((entry)=>{
				fades.push({ material: entry.material, from: entry.material.opacity, to: 0, delay: 0, dur: 480 });
			});
			this.runCenterTween(token, items, fades, ()=>{
				if(this._pctrRetiring){
					this._pctrRetiring.dispose();
					this._pctrRetiring = null;
				}
				this.group.visible = true;
				this.wake(2);
			});
		}
	},

	/** 换系补间执行器:手写 rAF(同 startMorph/flyToPreset 范式不引 gsap) */
	runCenterTween(token, items, fades, onDone){
		let total = 0;
		items.forEach((it)=>{ total = Math.max(total, it.delay + it.dur); });
		fades.forEach((f)=>{ total = Math.max(total, f.delay + f.dur); });
		if(!total){
			this._centerTweenActive = false;
			if(onDone){ onDone(); }
			this.wake(2);
			return;
		}
		// 起步即落起点态(错峰未开动的天体停在旧位;scale-in 项先隐)
		items.forEach((it)=>{
			if(it.from){
				it.obj.position.copy(it.from);
			}
			if(it.scaleIn){
				it.obj.scale.set(0.001, 0.001, 0.001);
			}
		});
		fades.forEach((f)=>{
			f.material.opacity = f.from;
		});
		const t0 = performance.now();
		// 独立帧预算旗标挂按需渲染(needsFrames() 恒真):不借共享 _tweenActive ——
		// 换系被 token 打断走早退路径时若悬挂共享旗标 = rAF 永不歇;若误清又会
		// 冻住并行中的相机预设飞行/滑移补间的帧预算
		this._centerTweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._centerTweenActive = false;
				return;
			}
			if(token !== this._centerToken){
				return;   // 已被新换系接管(旗标由接管场次的 runCenterTween 主导)
			}
			const now = performance.now() - t0;
			items.forEach((it)=>{
				const t = Math.min(1, Math.max(0, (now - it.delay) / it.dur));
				const e = easeInOutCubic(t);
				if(it.from && it.to){
					it.obj.position.set(
						it.from.x + (it.to.x - it.from.x) * e,
						it.from.y + (it.to.y - it.from.y) * e,
						it.from.z + (it.to.z - it.from.z) * e,
					);
				}else if(it.scaleIn){
					const s = Math.max(0.001, e);
					it.obj.scale.set(s, s, s);
				}else if(it.scaleOut){
					const s = Math.max(0.001, 1 - e);
					it.obj.scale.set(s, s, s);
				}
			});
			fades.forEach((f)=>{
				const t = Math.min(1, Math.max(0, (now - f.delay) / f.dur));
				f.material.opacity = f.from + (f.to - f.from) * t;
			});
			if(now < total){
				window.requestAnimationFrame(step);
			}else{
				this._centerTweenActive = false;
				if(onDone){ onDone(); }
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},

	/** 覆盖组整链释放(含换系动画中的退休组);dispose/切实例用 */
	disposePctr(){
		if(this.pctrMode){
			this.pctrMode.dispose();
			this.pctrMode = null;
		}
		if(this._pctrRetiring){
			this._pctrRetiring.dispose();
			this._pctrRetiring = null;
		}
	},
};
