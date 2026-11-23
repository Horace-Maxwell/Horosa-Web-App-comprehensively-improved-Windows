// 主限天球引擎 · 搭建与视图:初始化、星空背景、拾取、尺寸、载入数据、虚点 / 聚焦开关、盘心视角进出、视图模式
// 从 PDSphereEngine.js 按职责拆出的 PDSphereEngine 方法:this 仍是 PDSphereEngine 实例,门面里 mixinMethods(PDSphereEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { chartDrawGuardEnabled } from '../../../utils/perfFlags';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { sph } from '../sphMath';
import { easeInOutCubic } from '../morphMath';
import { makeStarSprite } from '../labelSprite';
import { unitOf, zenithOf, eastPointOf, northPointOf, horizonSelfCheck } from '../pdSphereMath';
import { PD_COLOR, PD_LEVELS } from './sceneConst';
import { pdStarBaseIds } from './pointNames';

export const setupViewMethods = {
	// —— 生命周期 ——
	init(){
		this.scene = new THREE.Scene();
		this.root = new THREE.Group();
		this.skyGroup = new THREE.Group();
		this.dirGroup = new THREE.Group();   // 迫星运动组:唯一随播转动的载体(skyGroup 恒 0)
		// 复合运动·真位层:与 dirGroup 同步随周日旋转,组内诸曜再按各自黄道自行逐帧挪移 ——
		// 「自转(整组 rotation) × 公转(组内 λ(t) 位移)」复合;冻结迫星(dirGroup)仍精确命中,零碰弧法。
		this.trueGroup = new THREE.Group();
		this.frameGroup = new THREE.Group();
		this.selGroup = new THREE.Group();
		this.root.add(this.skyGroup);
		this.root.add(this.dirGroup);
		this.root.add(this.trueGroup);
		this.root.add(this.frameGroup);
		this.root.add(this.selGroup);
		this._trueEntries = [];        // {mesh,lon0,latUse,mu,isProm,line?} 真位层活动记账
		this._bodySpeeds = {};         // baseId → 瞬时黄经速(°/日;AstroPDSphere 从 /chart objects 喂入)
		this.onTrueMotionInfo = null;  // 播放落定回调({elapsedText, drifts})→ 宿主 DOM 信息行
		this.trueMotionOn = true;      // 复合运动开关(默认开;localStorage 记忆)
		try{ this.trueMotionOn = (typeof localStorage !== 'undefined' ? localStorage.getItem('horosa.pdsphere.trueMotion') : null) !== '0'; }catch(_){ }
		this.scene.add(this.root);

		this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, Math.max(0.5, this.radius * 0.02), this.radius * 6); // near/far 收窄(0.1→R*0.02 / R*12→R*6:深度精度翻倍,远近裁剪仍余量充足)
		const camPos = sph(-58, 24, this.radius * 2.75);
		this.camera.position.set(camPos.x, camPos.y, camPos.z);
		this.camera.lookAt(this.scene.position);

		// 可注入渲染器/控制器(opt.createRenderer/createControls):jsdom 无 WebGL,
		// smoke 测试注入 stub 跑真建场链;生产不传=原路径零变。
		this.renderer = this._opt && this._opt.createRenderer
			? this._opt.createRenderer()
			: new THREE.WebGLRenderer({ antialias: true });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setSize(this.width, this.height);
		// pixelRatio 封顶 2:Retina 3x 的 2.25 倍渲染面积是无感知税(WS-0 同口径)
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.setClearColor(PD_COLOR.background);
		this.dom.appendChild(this.renderer.domElement);

		// WebGL 上下文丢失自愈(Astro3D WS-0 同口径):lost 须 preventDefault 否则永不 restore
		this._onCtxLost = (ev)=>{
			ev.preventDefault();
			this._contextLost = true;
			if(this.rafId){
				window.cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		};
		this._onCtxRestored = ()=>{
			this._contextLost = false;
			this.wake(3);
		};
		this.renderer.domElement.addEventListener('webglcontextlost', this._onCtxLost, false);
		this.renderer.domElement.addEventListener('webglcontextrestored', this._onCtxRestored, false);

		const controls = this._opt && this._opt.createControls
			? this._opt.createControls(this.camera, this.renderer.domElement)
			: new OrbitControls(this.camera, this.renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.enableZoom = true;
		controls.enablePan = false;   // 主限天球恒以球心为锚,平移无语义
		controls.minDistance = this.radius * 1.15;
		controls.maxDistance = this.radius * 8;
		// 按需渲染唤醒源:用户交互与阻尼衰减(change 链式自续,静止即歇)
		controls.addEventListener('start', ()=>this.wake(2));
		controls.addEventListener('change', ()=>this.wake(2));
		this.orbits = controls;

		// 空框架先行:数据未达/获取失败时画布也有天球骨架可看(赤道网格+默认黄道),
		// 不再黑屏干等(用户实测:报错卡下曾全黑);setData 到达即全量重建。
		this._buildEquatorialGrid();
		this._buildEcliptic(null);
		this._buildStarfield();   // 程序化星空氛围层(flag 可关)
		this._initPicking();      // 3D 拾取:hover 提亮 / click 选最近应期行

		this.animate();
	},

	// —— 星空背景:程序化远景星点(makeStarSprite,静止装饰层挂 root 外圈,
	//     半径 3.6R 在 far(6R) 内;数量/亮度按星等分布,AdditiveBlending 微光不与数据层抢焦点)。
	//     flag:localStorage horosa.pdsphere.starfield='off' 关(默认开)。
	_buildStarfield(){
		try{
			if(localStorage.getItem('horosa.pdsphere.starfield') === 'off'){ return; }
		}catch(_){ }
		// 装饰层整体 try:canvas 纹理生成等任何失败只损失星空氛围,绝不牵连建场主链
		try{
			this._buildStarfieldInner();
		}catch(_){ this._starfield = null; }
	},

	_buildStarfieldInner(){
		const group = new THREE.Group();
		const R = this.radius * 3.6;
		// 固定种子伪随机(LCG):同一会话/复挂载星空稳定,避免每次进入闪变
		let seed = 20260717;
		const rand = ()=>{ seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
		for(let i = 0; i < 260; i += 1){
			const ra = rand() * 360;
			const decl = (Math.asin(rand() * 2 - 1)) * 180 / Math.PI; // 球面均匀
			const mag = rand();                                        // 伪星等:0 亮 → 1 暗
			const size = Math.max(1.6, this.radius * (0.006 + 0.016 * (1 - mag)));
			const star = makeStarSprite(mag < 0.12 ? '#ffe9bd' : '#dfe6f2', size, 0.3);
			const p = sph(ra, decl, R);
			star.position.set(p.x, p.y, p.z);
			if(star.material){ star.material.opacity = PD_LEVELS.starfieldMax * (0.35 + 0.65 * (1 - mag)); }
			group.add(star);
		}
		this._starfield = group;
		this.root.add(group);
	},

	// —— 3D 拾取:pointermove hover 实体点提亮(cursor pointer),click 通知 UI 选最近应期行。
	//     按需渲染:hover 命中变化才 wake;拾取仅对实体点(虚点小且多,误触噪音)。
	_initPicking(){
		if(!this.renderer || !this.renderer.domElement || typeof this.renderer.domElement.addEventListener !== 'function'){ return; }
		this._hoverPid = null;
		const el = this.renderer.domElement;
		// 屏幕距离拾取(而非 Raycaster.intersectObjects):行星点屏幕半径仅数 px,射线求交
		// 命中率过低(3D 小目标通病);投影到屏幕按 ≤14px 容差取最近者,并剔除球背面点。
		const pick = (ev)=>{
			if(!this.camera || !THREE.Vector3){ return null; }
			const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: this.width, height: this.height };
			const px = ev.clientX - rect.left;
			const py = ev.clientY - rect.top;
			const camPos = this.camera.position;
			const camDist2 = camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z;
			let best = null;
			let bestD = 14;
			const v = new THREE.Vector3();
			this.pointMeshMap.forEach((entry, pid)=>{
				if(entry.isVirtual || !entry.dot || entry.dot.visible === false){ return; }
				try{
					entry.dot.getWorldPosition(v);
					// 背面剔除:点到相机的距离平方 > 相机到球心距离平方 ⟹ 点在球背半侧
					const dx = v.x - camPos.x, dy = v.y - camPos.y, dz = v.z - camPos.z;
					if(dx * dx + dy * dy + dz * dz > camDist2){ return; }
					v.project(this.camera);
					if(v.z > 1 || v.z < -1){ return; }
					const sx = (v.x + 1) / 2 * (rect.width || 1);
					const sy = (1 - v.y) / 2 * (rect.height || 1);
					const d = Math.hypot(sx - px, sy - py);
					if(d < bestD){ bestD = d; best = pid; }
				}catch(_){ }
			});
			return best;
		};
		this._onPickMove = (ev)=>{
			let pid = null;
			try{ pid = pick(ev); }catch(_){ pid = null; }
			if(pid === this._hoverPid){ return; }
			// 还原/施加均走 _scaleDot(sprite 纵横比安全);selK=选中态基档,悬停在其上再乘 1.35
			const prev = this._hoverPid && this.pointMeshMap.get(this._hoverPid);
			if(prev && prev.dot){ this._scaleDot(prev, prev.selK || 1); }
			this._hoverPid = pid;
			const cur = pid && this.pointMeshMap.get(pid);
			if(cur && cur.dot){ this._scaleDot(cur, (cur.selK || 1) * 1.35); }
			el.style.cursor = pid ? 'pointer' : '';
			this.wake(1);
		};
		this._onPickClick = (ev)=>{
			// 球心档拖拽松手抑制一次(环视≠点星选行)
			if(this._suppressPickClick){ this._suppressPickClick = false; return; }
			let pid = null;
			try{ pid = pick(ev); }catch(_){ pid = null; }
			if(pid && typeof this.onPickPoint === 'function'){ this.onPickPoint(pid); }
		};
		el.addEventListener('pointermove', this._onPickMove);
		el.addEventListener('click', this._onPickClick);
	},

	resize(width, height){
		if(this.disposed || !this.renderer){
			return;
		}
		this.width = width;
		this.height = height;
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.wake(2);
	},

	// —— 数据装载(全量重建内容组;选择态清空) ——
	setData(res){
		if(this.disposed || !res || !res.frame){
			return;
		}
		// 同签零重建:res 内容与上次逐字节相同(时间轴/选项来回拨、请求层缓存命中重投递)
		// 则整场保留 —— 免整套 THREE 组清建,且不打断用户当前选中/相机/播放状态(严格更优)。
		// 序列化失败(异常大对象等)= 不短路,永远重建;开关 horosa.perf.chartDrawGuard 同图面守卫。
		if(chartDrawGuardEnabled()){
			let sig = null;
			try{ sig = JSON.stringify(res); }catch(e){ sig = null; }
			if(sig && this._lastDataSig === sig){
				return;
			}
			this._lastDataSig = sig;
		}
		this.res = res;
		this._starBases = pdStarBaseIds(res.points);
		this._playToken += 1;   // 作废在途播放/补间
		this._tweenActive = false;
		this.clearSelection();
		this._clearGroup(this.skyGroup);
		this._clearGroup(this.frameGroup);
		this._frameLayerGroups = {};   // 圈层登记表随组清空重置(init 空骨架的旧登记项已成孤儿)
		this.skyGroup.rotation.y = 0;

		// 交付自检:东点(ra=armc+90, decl=0)必在地平圈上(容差 1e-6)—— 公式失守
		// 意味着地平框架整体错位,宁可 console 报警也不静默画错。
		const chk = horizonSelfCheck(res.frame, 1e-6);
		console.assert(chk.ok, '[AstroPDSphere] 地平框架自检失败:东点应在地平圈上, dot=', chk.dot);

		// 分步建场:任一步抛错记账继续(单步失败不砸全链——曾因圈名 ReferenceError 连坐
		// 黄道/星点/wake 全没,且异常被上层吞掉 UI 零提示);收尾统一上报 onError 供错误卡。
		const stepErrs = [];
		const step = (name, fn)=>{ try{ fn(); }catch(e){ stepErrs.push(`${name}: ${(e && e.message) || e}`); try{ console.error(`[PDSphereEngine] 建场步骤「${name}」失败:`, e); }catch(_){ } } };
		step('赤道网格', ()=>this._buildEquatorialGrid());
		step('地平框架', ()=>this._buildHorizonFrame(res.frame));
		step('黄道', ()=>this._buildEcliptic(res.frame));
		step('星点', ()=>this._buildPoints(res.points || {}));
		// 后天宫位宫首:_houseGroup 随 skyGroup 清空重置(setData 已 _clearGroup(skyGroup));
		//   若开关开着,按新 frame + 当前宫制重建(宫制随请求切换 → frame.pdMethod 变即新 cusps)。
		this._houseGroup = null;
		step('宫首', ()=>this._rebuildHouseCusps());
		// observer/center 档相机位按 frame 派生:新数据到达即重定位(globe 档不动=零回归)
		if(this.viewMode === 'observer' || this.viewMode === 'center'){
			step('视角', ()=>this.applyViewMode(this.viewMode, false));
		}
		// 球心档下重建的全场 sprite 补视距缩放
		if((this._spriteViewK || 1) !== 1){ this._setSpriteViewScale(this._spriteViewK); }
		this.wake(3);
		if(stepErrs.length && typeof this.onError === 'function'){
			try{ this.onError(stepErrs.join('；')); }catch(_){ }
		}
	},

	// 外部开关:虚点三类/聚焦模式(Pane UI 调用;写 localStorage+就地生效)
	setVirtualToggles(vt){
		this.virtualToggles = { aspect: !!vt.aspect, antiscia: !!vt.antiscia, term: !!vt.term };
		safeLocalStorageSet('horosa.pdsphere.virtualToggles', JSON.stringify(this.virtualToggles));
		this.pointMeshMap.forEach((entry)=>{
			if(entry.isVirtual && entry.kind){ entry.dot.visible = !!this.virtualToggles[entry.kind]; }
		});
		this.wake(2);
	},

	setFocusMode(on){
		this.focusMode = !!on;
		safeLocalStorageSet('horosa.pdsphere.focusMode', this.focusMode ? 'focus' : 'all');
		// 重放当前选中(退避策略即时生效)
		if(this._selection){ const idx = this._selection.idx; this.selectRow(idx); }
		this.wake(2);
	},

	// —— 双视角档:globe=天球仪外视(既有) / observer=观测者视(面南,东左西右,天顶朝上) ——
	/** 目标相机位与 up(observer 依赖 frame;无数据回落 globe 位) */
	_viewCamTarget(mode){
		const D = this.radius * 2.75;
		if(mode === 'observer' && this.res && this.res.frame){
			const f = this.res.frame;
			// zenithOf 返回 {ra,decl}(球面坐标)须经 unitOf 转向量;northPointOf 直接返向量(叉积)。
			const zSph = zenithOf(f);
			const zen = zSph ? unitOf(zSph.ra, zSph.decl) : null;
			const nor = northPointOf(f);
			if(zen && nor){
				// 相机在地平北点外侧、略高于地平(仰角 20°),看向球心=面南:
				// 北半球标准面南观星姿势 → 东在画面左、西在右、天顶朝上、地平圈横陈下部。
				const el = 20 * Math.PI / 180;
				const c = Math.cos(el) * D;
				const s = Math.sin(el) * D;
				return {
					pos: { x: nor.x * c + zen.x * s, y: nor.y * c + zen.y * s, z: nor.z * c + zen.z * s },
					up: { x: zen.x, y: zen.y, z: zen.z },
				};
			}
		}
		const p = sph(-58, 24, D);
		return { pos: p, up: { x: 0, y: 1, z: 0 } };
	},

	// —— 球心观察档(planetarium 式):相机置球心,拖拽环视(yaw 绕天顶/pitch 绕视右轴),
	//     滚轮调 FOV(40–100);文字 sprite 恒 billboard 面向相机=从内看也正读,零额外适配。 ——
	_enterCenterView(){
		const cam = this.camera;
		if(!cam){ return; }
		if(!this._preCenter){ this._preCenter = { fov: cam.fov }; }
		if(this.orbits){ this.orbits.enabled = false; }
		cam.fov = 70;
		cam.updateProjectionMatrix();
		// up=观测者天顶(有 frame;肉眼仰望姿态),无数据回落世界 Y
		let up = { x: 0, y: 1, z: 0 };
		if(this.res && this.res.frame){
			const z = zenithOf(this.res.frame);
			if(z){ up = unitOf(z.ra, z.decl); }
		}
		cam.up.set(up.x, up.y, up.z);
		// 站位:球心沿天顶微抬(R*0.02=near 裁剪安全),看向东点(观星起手朝东)
		cam.position.set(up.x * this.radius * 0.02, up.y * this.radius * 0.02, up.z * this.radius * 0.02);
		let look = { x: 1, y: 0, z: 0 };
		if(this.res && this.res.frame){
			const e = eastPointOf(this.res.frame);
			if(e){ look = unitOf(e.ra, e.decl); }
		}
		cam.lookAt(look.x * this.radius, look.y * this.radius, look.z * this.radius);
		this._ensureCenterHandlers();
		// 球心档字形「超级放大」(用户定案):相机已正居球心(update 清洗根修后),标签距离≈R,
		// 1.35× 净观感≈外视 3.7 倍——旧 0.32 缩是 update 顶出病灶时代的错误补偿方向,修正后全看不清。
		this._setSpriteViewScale(1.35);
		this.wake(3);
	},

	_exitCenterView(){
		if(this.orbits){ this.orbits.enabled = true; }
		if(this._preCenter && this.camera){
			this.camera.fov = this._preCenter.fov;
			this.camera.updateProjectionMatrix();
		}
		this._setSpriteViewScale(1);
	},

	_ensureCenterHandlers(){
		if(this._centerHandlersOn || !this.renderer || !this.renderer.domElement){ return; }
		this._centerHandlersOn = true;
		const el = this.renderer.domElement;
		this._onCenterDown = (ev)=>{
			if(this.viewMode !== 'center'){ return; }
			this._centerDrag = { x: ev.clientX, y: ev.clientY, moved: 0 };
		};
		this._onCenterMove = (ev)=>{
			const d = this._centerDrag;
			if(!d || this.viewMode !== 'center' || !this.camera){ return; }
			const dx = ev.clientX - d.x;
			const dy = ev.clientY - d.y;
			d.x = ev.clientX;
			d.y = ev.clientY;
			d.moved += Math.abs(dx) + Math.abs(dy);
			const cam = this.camera;
			const qYaw = new THREE.Quaternion().setFromAxisAngle(cam.up, -dx * 0.0045);
			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
			const qPitch = new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.0045);
			cam.quaternion.premultiply(qYaw).premultiply(qPitch);
			this.wake(1);
		};
		this._onCenterUp = ()=>{
			const d = this._centerDrag;
			this._centerDrag = null;
			// 拖拽后抑制一次 pick click(拖完松手不当成「点星选行」)
			if(d && d.moved > 6){ this._suppressPickClick = true; }
		};
		this._onCenterWheel = (ev)=>{
			if(this.viewMode !== 'center' || !this.camera){ return; }
			ev.preventDefault();
			this.camera.fov = Math.max(40, Math.min(100, this.camera.fov + ev.deltaY * 0.03));
			this.camera.updateProjectionMatrix();
			this.wake(1);
		};
		el.addEventListener('pointerdown', this._onCenterDown);
		el.addEventListener('pointermove', this._onCenterMove);
		el.addEventListener('pointerup', this._onCenterUp);
		el.addEventListener('pointerleave', this._onCenterUp);
		el.addEventListener('wheel', this._onCenterWheel, { passive: false });
	},

	/** 切换/回正视角;animate=600ms 相机飞行(位置插值+归一化到目标距离,up 同步渐变)。
	 *  'center'=球心档:瞬切(向球心插值会穿模,不飞行),独立拖拽/FOV 手感。 */
	applyViewMode(mode, animate){
		const m = mode === 'center' ? 'center' : (mode === 'observer' ? 'observer' : 'globe');
		const prev = this.viewMode;
		this.viewMode = m;
		safeLocalStorageSet('horosa.pdsphere.viewMode', m);
		if(!this.camera){ return; }
		if(m === 'center'){
			this._enterCenterView();
			return;
		}
		if(prev === 'center'){
			this._exitCenterView();
		}
		const tgt = this._viewCamTarget(m);
		const cam = this.camera;
		const from = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
		const fromUp = { x: cam.up.x, y: cam.up.y, z: cam.up.z };
		const D = Math.sqrt(tgt.pos.x * tgt.pos.x + tgt.pos.y * tgt.pos.y + tgt.pos.z * tgt.pos.z);
		const setCam = (p, u)=>{
			cam.position.set(p.x, p.y, p.z);
			cam.up.set(u.x, u.y, u.z);
			cam.lookAt(0, 0, 0);
			if(this.orbits && this.orbits.update){ this.orbits.update(); }
		};
		if(!animate){
			setCam(tgt.pos, tgt.up);
			this.wake(3);
			return;
		}
		// 相机飞行用独立 token(不占 _playToken):视角切换与球姿态补间可并行——
		// resetRotation 同帧「球回 0 + 相机回位」两补间互不作废。
		this._camToken = (this._camToken || 0) + 1;
		const token = this._camToken;
		const t0 = performance.now();
		const lerp = (a, b, k)=>({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
		const step = ()=>{
			if(this.disposed || token !== this._camToken){ return; }
			const t = Math.min(1, (performance.now() - t0) / 600);
			const e = easeInOutCubic(t);
			const p = lerp(from, tgt.pos, e);
			// 位置插值后归一化到目标距离:近似大圆飞行,不穿球
			const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
			const kk = D / len;
			setCam({ x: p.x * kk, y: p.y * kk, z: p.z * kk }, lerp(fromUp, tgt.up, e));
			this.wake(1);
			if(t < 1){ window.requestAnimationFrame(step); }
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	},
};
