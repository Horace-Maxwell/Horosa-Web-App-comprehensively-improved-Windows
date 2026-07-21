// 主限法 3D 天球轻引擎(WS-3)。
//
// 为什么独立轻引擎而不塞进 Astro3D 主引擎:主限天球是赤道坐标框架(Y=天北极)+
// 地平三圈 + 周日运动播放的专用场景,与黄道系本命 3D 盘(行星模型/地球/28宿/GUI)
// 无共享网格;塞进 Astro3D = 主引擎再涨一个坐标系分支(WS-2 多中心刚控制住体量)。
// 本类只借四样公共件:sphMath 摆点公式 / morphMath 缓动 / labelSprite 名牌 /
// Astro3D 的按需渲染状态机形态(wake/needsFrames/animate 同构,idle 停 rAF)。
//
// 场景图([G3] 方向语义重构后):
//   root
//   ├─ skyGroup    赤道网格+黄道+本命点/虚点 —— 本命参照系,rotation 恒 0(应星与其余
//   │              星点原地不动=主限 directio 的「应星固定」正统语义)
//   ├─ dirGroup    迫星运动组:被引导点标(本体glyph+相位glyph)+本体星+相位连线 ——
//   │              周日运动播放即本组 rotation.y 补间(rotation.y=θ ⇔ 组内点赤经整体 +θ)
//   ├─ frameGroup  地平三圈(地平/子午/卯酉)+ 天顶/东点/北点标注 —— 观测者系恒静止
//   └─ selGroup    选中行覆盖层:预定路径弧 + 应星位置圈高亮 + 应星圈环/卡 + 渐隐尾迹 + 头顶标签卡
//
// 纯数学(自检公式/目标角/kind 映射)全部住 pdSphereMath(jest 直测);本类只消费。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { sph } from './sphMath';
import { easeInOutCubic } from './morphMath';
import { makeTextSprite, makeRingSprite, makeStarSprite, liftLuma } from './labelSprite';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {
	unitOf, zenithOf, eastPointOf, northPointOf, horizonSelfCheck,
	greatCircleThrough, eclipticPoleOf, effectiveEq, isConverseRow,
	playTargetAngleRad, promRotationRad, playDurationMs,
	CIRCLE_KIND_RENDER, FRAME_HIGHLIGHT_TARGET, VIRTUAL_POINT_KINDS,
	declCircleGreatIntersect, declCirclePolylineHit,
	moverOfRow, sigEqOf,
} from './pdSphereMath';
import { houseCusps, eclLonToEq } from './pdHouseCusps';   // [E1] 后天宫位宫首显示

// 主题色(黑底天球,与 Astro3D ChartBackgroud 同底色系)
// [WP-E] export=纯加法:语义色键契约由 smoke 测试看守(ecliptic 键缺失曾致刻度线静默白色)。
export const PD_COLOR = {
	background: 0x000000,
	grid: 0x24405e,            // 赤经时圈/赤纬圈细线
	equator: 0x3f6f9e,         // 天赤道(稍亮)
	horizon: 0x59a86c,         // 地平圈
	meridian: 0xa06bc4,        // 子午圈
	primeVertical: 0x3e9d94,   // 卯酉圈
	frameLabel: 0xd7e3f4,      // 天顶/东点/北点标注
	virtualPoint: 0x8a8a8a,    // 虚点(映点/界/相位点)小号灰点
	direct: 0xffd700,          // 顺向 direct = 金色
	converse: 0x00e0e0,        // 逆向 converse = 青色
	ecliptic: 0xd8ab52,        // 黄道带 12 星座刻度线(与星座符号 #d8ab52 同族金;补前为 undefined→刻度线渲染白色+material 警告)
};

// [WP-D] 四级明度体系常量表(集中可调;层级:辅助网格→主结构圈→标准点位→选中链最亮):
// 赤道网格退为极淡辅助线,地平三圈/黄道为主结构,本命点标准亮度,选中链(selectRow 高亮)最亮。
export const PD_LEVELS = {
	grid: 0.16,          // 赤道网格(时圈/纬圈):极淡辅助(原 0.55 与主结构圈抢层级)
	virtualShown: 0.22,  // 虚点 toggle 全显模式透明度(原 0.9 满球灰点噪音;选中行涉及点显影高亮不受此限)
	starfieldMax: 0.5,   // 程序化星空背景单点最大透明度(装饰层,永不与数据层抢焦点)
};

const TWO_PI = Math.PI * 2;

/** 大圆参数曲线:P(t)=R·(u·cos2πt + w·sin2πt) —— TubeGeometry 的路径输入 */
class GreatCircleCurve extends THREE.Curve{
	constructor(u, w, R){
		super();
		this.u = u;
		this.w = w;
		this.R = R;
	}

	getPoint(t, optionalTarget){
		const a = t * TWO_PI;
		const c = Math.cos(a);
		const s = Math.sin(a);
		const v = optionalTarget || new THREE.Vector3();
		return v.set(
			(this.u.x * c + this.w.x * s) * this.R,
			(this.u.y * c + this.w.y * s) * this.R,
			(this.u.z * c + this.w.z * s) * this.R
		);
	}
}

/** 点位短名(名牌用):行星走 ywastrochart 字形(与 2D/3D 盘同源),宫/无字形词条回退中文 */
function pointGlyphOf(baseId){
	if(`${baseId}`.indexOf('House') === 0){
		return { text: `${`${baseId}`.slice(5)}宫`, astroFont: false };
	}
	const glyph = AstroText.AstroMsg[baseId];
	if(glyph !== undefined && glyph !== null && `${glyph}`.length <= 3){
		return { text: `${glyph}`, astroFont: true };
	}
	const cn = AstroText.AstroMsgCN[baseId];
	return { text: cn ? `${cn}` : `${baseId}`, astroFont: false };
}

/** 相位度数(D/S/N_x_120 → '120°';0=合相;非相位形态 → null) —— 连线中点标注用 */
function aspectDegOf(pid){
	const m = /^[DSN]_.+_(\d+)$/.exec(`${pid || ''}`);
	if(!m){
		return null;
	}
	return m[1] === '0' ? '合' : `${m[1]}°`;
}

/** 点位 id 的本体(N_Sun_0 → Sun;T_Venus_Aries → Venus;A/C_x → x) —— 取色/字形用 */
function basePointIdOf(pid){
	const parts = `${pid || ''}`.split('_');
	if(parts.length < 2){
		return `${pid || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
		return parts[1];
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

class PDSphereEngine{

	constructor(opt){
		this.dom = opt.dom;
		this.width = opt.width;
		this.height = opt.height;
		this.onError = opt.onError || null; // 建场步骤失败上报(错误卡);缺省 null=仅 console
		this._opt = opt; // 注入点引用(createRenderer/createControls,测试专用)
		this.radius = Math.max(60, Math.min(this.width, this.height) / 2 - 42);

		// [WP-3] 虚点三类独立 toggle(默认相位点开、映点/界关;localStorage 记忆)+聚焦/全显模式
		this.virtualToggles = { aspect: true, antiscia: false, term: false };
		this.focusMode = true; // true=选中退避(柔和 0.55);false=全显不退避
		// [WP-A] 视角档:globe=天球仪外视(既有默认,零观感回归)/ observer=观测者视(按 frame 派生:
		// 面南、东左西右、天顶朝上,周日运动读作肉眼东升西落)。默认 globe——新档效果截图交用户定夺后再议默认。
		this.viewMode = 'globe';
		try{
			const vt = JSON.parse(localStorage.getItem('horosa.pdsphere.virtualToggles') || 'null');
			if(vt && typeof vt === 'object'){ this.virtualToggles = { aspect: !!vt.aspect, antiscia: !!vt.antiscia, term: !!vt.term }; }
			this.focusMode = localStorage.getItem('horosa.pdsphere.focusMode') !== 'all';
			const vm = localStorage.getItem('horosa.pdsphere.viewMode');
			if(vm === 'observer' || vm === 'globe' || vm === 'center'){ this.viewMode = vm; } // [P2] 三档
		}catch(_){ }
		// [L1] 框架圈分层显隐(用户定案「别的圈也要能选择」):六圈独立开关+标注总开关。
		// 承载=嵌套组:圈开关→grp.visible / labels→labelSub.visible,「圈开∧标注开」由 THREE 嵌套可见性天然实现。
		this.frameLayers = {
			ecliptic: true, equator: true, grid: true,
			horizon: true, meridian: true, primeVertical: true, labels: true,
		};
		try{
			const fl = JSON.parse(localStorage.getItem('horosa.pdsphere.frameLayers') || 'null');
			if(fl && typeof fl === 'object'){
				Object.keys(this.frameLayers).forEach((k)=>{
					if(typeof fl[k] === 'boolean'){ this.frameLayers[k] = fl[k]; }
				});
			}
		}catch(_){ }
		this._frameLayerGroups = {};   // key → { grp, labelSub };setData 全量重建时重置
		this.disposed = false;
		this.rafId = null;
		this._wakeFrames = 0;
		this._tweenActive = false;
		this._playToken = 0;
		this._contextLost = false;

		this.res = null;            // /predict/pd3d 响应(rows/points/circles/frame)
		this.pointMeshMap = new Map();   // pid → { dot, label, baseColor, baseScale }
		this._frameBasis = null;    // { horizon:{u,w}, meridian:{u,w}|null, primeVertical:{u,w}|null }
		this._selection = null;     // { idx, row, marker, pulseTargets:[{material,kind}], trail }
		this._labelCard = null;
		this._labelTimer = null;
	}

	// —— 生命周期 ——
	init(){
		this.scene = new THREE.Scene();
		this.root = new THREE.Group();
		this.skyGroup = new THREE.Group();
		this.dirGroup = new THREE.Group();   // [G3] 迫星运动组:唯一随播转动的载体(skyGroup 恒 0)
		this.frameGroup = new THREE.Group();
		this.selGroup = new THREE.Group();
		this.root.add(this.skyGroup);
		this.root.add(this.dirGroup);
		this.root.add(this.frameGroup);
		this.root.add(this.selGroup);
		this.scene.add(this.root);

		this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, Math.max(0.5, this.radius * 0.02), this.radius * 6); // [WP-3] near/far 收窄(0.1→R*0.02 / R*12→R*6:深度精度翻倍,远近裁剪仍余量充足)
		const camPos = sph(-58, 24, this.radius * 2.75);
		this.camera.position.set(camPos.x, camPos.y, camPos.z);
		this.camera.lookAt(this.scene.position);

		// [WP-4] 可注入渲染器/控制器(opt.createRenderer/createControls):jsdom 无 WebGL,
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
		this._buildStarfield();   // [WP-D] 程序化星空氛围层(flag 可关)
		this._initPicking();      // [WP-D] 3D 拾取:hover 提亮 / click 选最近应期行

		this.animate();
	}

	// —— [WP-D] 星空背景:程序化远景星点(makeStarSprite,静止装饰层挂 root 外圈,
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
	}

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
	}

	// —— [WP-D] 3D 拾取:pointermove hover 实体点提亮(cursor pointer),click 通知 UI 选最近应期行。
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
			// [G1] 还原/施加均走 _scaleDot(sprite 纵横比安全);selK=选中态基档,悬停在其上再乘 1.35
			const prev = this._hoverPid && this.pointMeshMap.get(this._hoverPid);
			if(prev && prev.dot){ this._scaleDot(prev, prev.selK || 1); }
			this._hoverPid = pid;
			const cur = pid && this.pointMeshMap.get(pid);
			if(cur && cur.dot){ this._scaleDot(cur, (cur.selK || 1) * 1.35); }
			el.style.cursor = pid ? 'pointer' : '';
			this.wake(1);
		};
		this._onPickClick = (ev)=>{
			// [P2] 球心档拖拽松手抑制一次(环视≠点星选行)
			if(this._suppressPickClick){ this._suppressPickClick = false; return; }
			let pid = null;
			try{ pid = pick(ev); }catch(_){ pid = null; }
			if(pid && typeof this.onPickPoint === 'function'){ this.onPickPoint(pid); }
		};
		el.addEventListener('pointermove', this._onPickMove);
		el.addEventListener('click', this._onPickClick);
	}

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
	}

	// —— 数据装载(全量重建内容组;选择态清空) ——
	setData(res){
		if(this.disposed || !res || !res.frame){
			return;
		}
		// [A6] 同签零重建:res 内容与上次逐字节相同(时间轴/选项来回拨、请求层缓存命中重投递)
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
		this._playToken += 1;   // 作废在途播放/补间
		this._tweenActive = false;
		this.clearSelection();
		this._clearGroup(this.skyGroup);
		this._clearGroup(this.frameGroup);
		this._frameLayerGroups = {};   // [L1] 圈层登记表随组清空重置(init 空骨架的旧登记项已成孤儿)
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
		// [E1] 后天宫位宫首:_houseGroup 随 skyGroup 清空重置(setData 已 _clearGroup(skyGroup));
		//   若开关开着,按新 frame + 当前宫制重建(宫制随请求切换 → frame.pdMethod 变即新 cusps)。
		this._houseGroup = null;
		step('宫首', ()=>this._rebuildHouseCusps());
		// [WP-A] observer/center 档相机位按 frame 派生:新数据到达即重定位(globe 档不动=零回归)
		if(this.viewMode === 'observer' || this.viewMode === 'center'){
			step('视角', ()=>this.applyViewMode(this.viewMode, false));
		}
		// [P2] 球心档下重建的全场 sprite 补视距缩放
		if((this._spriteViewK || 1) !== 1){ this._setSpriteViewScale(this._spriteViewK); }
		this.wake(3);
		if(stepErrs.length && typeof this.onError === 'function'){
			try{ this.onError(stepErrs.join('；')); }catch(_){ }
		}
	}

	// [WP-3] 外部开关:虚点三类/聚焦模式(Pane UI 调用;写 localStorage+就地生效)
	setVirtualToggles(vt){
		this.virtualToggles = { aspect: !!vt.aspect, antiscia: !!vt.antiscia, term: !!vt.term };
		safeLocalStorageSet('horosa.pdsphere.virtualToggles', JSON.stringify(this.virtualToggles));
		this.pointMeshMap.forEach((entry)=>{
			if(entry.isVirtual && entry.kind){ entry.dot.visible = !!this.virtualToggles[entry.kind]; }
		});
		this.wake(2);
	}
	setFocusMode(on){
		this.focusMode = !!on;
		safeLocalStorageSet('horosa.pdsphere.focusMode', this.focusMode ? 'focus' : 'all');
		// 重放当前选中(退避策略即时生效)
		if(this._selection){ const idx = this._selection.idx; this.selectRow(idx); }
		this.wake(2);
	}

	// —— [WP-A] 双视角档:globe=天球仪外视(既有) / observer=观测者视(面南,东左西右,天顶朝上) ——
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
	}

	// —— [P2] 球心观察档(planetarium 式):相机置球心,拖拽环视(yaw 绕天顶/pitch 绕视右轴),
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
		// [P5] 球心档字形「超级放大」(用户定案):相机已正居球心(update 清洗根修后),标签距离≈R,
		// 1.35× 净观感≈外视 3.7 倍——旧 0.32 缩是 update 顶出病灶时代的错误补偿方向,修正后全看不清。
		this._setSpriteViewScale(1.35);
		this.wake(3);
	}

	_exitCenterView(){
		if(this.orbits){ this.orbits.enabled = true; }
		if(this._preCenter && this.camera){
			this.camera.fov = this._preCenter.fov;
			this.camera.updateProjectionMatrix();
		}
		this._setSpriteViewScale(1);
	}

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
	}

	/** 切换/回正视角;animate=600ms 相机飞行(位置插值+归一化到目标距离,up 同步渐变)。
	 *  [P2] 'center'=球心档:瞬切(向球心插值会穿模,不飞行),独立拖拽/FOV 手感。 */
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
	}

	// —— 黄道大圈(金色)+「黄道」标注+春分点标记:挂 skyGroup 随周日转(天文正确) ——
	// λ→赤道系:decl=asin(sinε·sinλ), ra=atan2(cosε·sinλ, cosλ);ε 取当日真黄赤交角。
	_buildEcliptic(frame){
		const R = this.radius;
		const eps = ((frame && (frame.eps || frame.epsMean)) || 23.44) * Math.PI / 180;
		const eclPoint = (lambdaDeg, radius)=>{
			const lam = lambdaDeg * Math.PI / 180;
			const decl = Math.asin(Math.sin(eps) * Math.sin(lam)) * 180 / Math.PI;
			const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI;
			return sph(ra, decl, radius);
		};
		const pts = [];
		for(let i = 0; i <= 144; i += 1){
			const p = eclPoint(i * 2.5, R);
			pts.push(new THREE.Vector3(p.x, p.y, p.z));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
			color: 0xd9a94e, transparent: true, opacity: 0.9,
		}));
		// [L1] 黄道圈层组:线+30° 刻度=圈体;春分点/圈名/星座 glyph=标注子组
		const gEcl = this._frameLayerGroup('ecliptic', this.skyGroup);
		gEcl.grp.add(line);
		// 春分点(λ=0)小标 + 圈名标注(λ=100° 处,避开春分标)
		const vp = eclPoint(0, R);
		const vpDot = new THREE.Mesh(
			new THREE.SphereGeometry(Math.max(1, R * 0.009), 10, 10),
			new THREE.MeshBasicMaterial({ color: 0xd9a94e })
		);
		vpDot.position.set(vp.x, vp.y, vp.z);
		gEcl.labelSub.add(vpDot);
		const vpLabel = makeTextSprite('春分点', { worldSize: Math.max(6, R * 0.045), color: '#d9a94e', glow: true });
		const vlp = eclPoint(0, R * 1.06);
		vpLabel.position.set(vlp.x, vlp.y, vlp.z);
		gEcl.labelSub.add(vpLabel);
		const nameLabel = makeTextSprite('黄道', { worldSize: Math.max(7, R * 0.05), color: '#e7bd75', glow: true });
		const nlp = eclPoint(100, R * 1.05);
		nameLabel.position.set(nlp.x, nlp.y, nlp.z);
		gEcl.labelSub.add(nameLabel);
		// [WP-3] 12 星座符号刻度环+30° 刻度短线:黄道带任何视角一眼可辨(体检「黄道易误认」)。
		// [G2] emoji → ywastrochart 字形('a'-'l',与 2D 盘同源;emoji 走系统彩色字体=丑+跨端漂移)。
		const SIGN_GLYPHS = [
			AstroConst.ARIES, AstroConst.TAURUS, AstroConst.GEMINI, AstroConst.CANCER,
			AstroConst.LEO, AstroConst.VIRGO, AstroConst.LIBRA, AstroConst.SCORPIO,
			AstroConst.SAGITTARIUS, AstroConst.CAPRICORN, AstroConst.AQUARIUS, AstroConst.PISCES,
		].map((id)=>`${AstroText.AstroMsg[id] || ''}`);
		for(let k = 0; k < 12; k += 1){
			const lam0 = k * 30;
			const pIn = eclPoint(lam0, R * 0.985);
			const pOut = eclPoint(lam0, R * 1.03);
			const tick = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(pIn.x, pIn.y, pIn.z),
					new THREE.Vector3(pOut.x, pOut.y, pOut.z),
				]),
				new THREE.LineBasicMaterial({ color: PD_COLOR.ecliptic, transparent: true, opacity: 0.8 })
			);
			gEcl.grp.add(tick);
			const gl = makeTextSprite(SIGN_GLYPHS[k], { worldSize: Math.max(5.5, R * 0.04), color: '#d8ab52', minLuma: 0.55, fontFamily: 'ywastrochart' });
			const gp = eclPoint(lam0 + 15, R * 1.05);
			gl.position.set(gp.x, gp.y, gp.z);
			gEcl.labelSub.add(gl);
		}
	}

	// —— 赤道坐标框架:24 时圈(=12 条过天极大圆)细线 + 赤纬 0/±30/±60 圈 ——
	/** [L1] 圈层组:每个框架圈一个 Group(圈体)+内嵌 labelSub(文字/方位点)。
	 *  圈开关控 grp.visible,标注总开关控 labelSub.visible —— 嵌套可见性天然实现「圈开∧标注开」。 */
	_frameLayerGroup(key, parent){
		const grp = new THREE.Group();
		const labelSub = new THREE.Group();
		grp.add(labelSub);
		parent.add(grp);
		grp.visible = this.frameLayers[key] !== false;
		labelSub.visible = this.frameLayers.labels !== false;
		this._frameLayerGroups[key] = { grp, labelSub };
		return { grp, labelSub };
	}

	/** [L1] 外部开关:圈层显隐(Pane 顶栏 checkbox 调用;写 localStorage + 就地生效) */
	setFrameLayers(patch){
		this.frameLayers = { ...this.frameLayers, ...(patch || {}) };
		safeLocalStorageSet('horosa.pdsphere.frameLayers', JSON.stringify(this.frameLayers)); // FL-4 配额纪律:与本文件其余持久键同走 safeStorage
		Object.keys(this._frameLayerGroups).forEach((k)=>{
			const ent = this._frameLayerGroups[k];
			if(!ent){ return; }
			ent.grp.visible = this.frameLayers[k] !== false;
			ent.labelSub.visible = this.frameLayers.labels !== false;
		});
		this.wake(2);
	}

	/** [E1] 后天宫位宫首显示开关。宫制取 frame.pdMethod(数据实际所用,随 后天宫位下拉重取而变);
	 *  宫首=固定征象点(挂 skyGroup 恒 0 → 播放中不动,与真值一致)。 */
	setHouseDisplay(on){
		this._showHouses = !!on;
		this._rebuildHouseCusps();
	}

	/** [E1] 重建 12 宫首:黄道面内径向短刻度 + 宫号 1-12(客户端 pdHouseCusps 由 frame armc/phi/eps 算)。
	 *  campanus 等分宫涉卯酉圈的系统只出四轴(cusps 中间宫为 null,跳过)。setData 与 toggle 均调。 */
	_rebuildHouseCusps(){
		if(!this._houseGroup){ this._houseGroup = new THREE.Group(); this.skyGroup.add(this._houseGroup); }
		this._clearGroup(this._houseGroup);
		if(!this._showHouses || !this.res || !this.res.frame){ this.wake(2); return; }
		const f = this.res.frame;
		const eps = Number(f.epsMean || f.eps || 23.44);
		// [E1] 后天宫位显示恒 Alchabitius(用户定案「我们只做 alchabitius」;不随推运方位法变)。
		let cusps = null;
		try{ cusps = houseCusps('core_alchabitius', Number(f.armc), Number(f.phi), eps).cusps; }catch(e){ cusps = null; }
		if(!Array.isArray(cusps)){ this.wake(2); return; }
		const R = this.radius;
		const HOUSE_COL = 0xb98cff; // 宫位紫(与框架圈/黄道色区分)
		cusps.forEach((lam, idx)=>{
			if(lam == null || !Number.isFinite(lam)){ return; }
			const eq = eclLonToEq(lam, eps);
			const isAngle = idx === 0 || idx === 9 || idx === 3 || idx === 6; // 四轴(1/4/7/10 宫)略强
			const pIn = sph(eq.ra, eq.decl, R * 0.965);
			const pOut = sph(eq.ra, eq.decl, R * (isAngle ? 1.05 : 1.03));
			const tick = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pIn.x, pIn.y, pIn.z), new THREE.Vector3(pOut.x, pOut.y, pOut.z)]),
				new THREE.LineBasicMaterial({ color: HOUSE_COL, transparent: true, opacity: isAngle ? 0.95 : 0.72 })
			);
			this._houseGroup.add(tick);
			const label = makeTextSprite(`${idx + 1}`, {
				worldSize: Math.max(isAngle ? 6 : 5, R * (isAngle ? 0.046 : 0.038)),
				color: '#c9a8ff', minLuma: 0.55, glow: true,
			});
			const lp = sph(eq.ra, eq.decl, R * 1.085);
			label.position.set(lp.x, lp.y, lp.z);
			this._houseGroup.add(label);
		});
		this.wake(2);
	}

	_buildEquatorialGrid(){
		const R = this.radius;
		const positions = [];
		const pushCirclePolyline = (samplePoint, segments)=>{
			let prev = null;
			for(let i = 0; i <= segments; i += 1){
				const p = samplePoint(i / segments);
				if(prev){
					positions.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
				}
				prev = p;
			}
		};
		// 24 时圈:每 15° 赤经一条,ra 与 ra+180 共成一条过天极大圆 → 12 条大圆
		const ncp = { x: 0, y: 1, z: 0 };
		for(let h = 0; h < 12; h += 1){
			const w = unitOf(h * 15, 0);
			pushCirclePolyline((t)=>{
				const a = t * TWO_PI;
				const c = Math.cos(a);
				const s = Math.sin(a);
				return { x: (ncp.x * c + w.x * s) * R, y: (ncp.y * c + w.y * s) * R, z: (ncp.z * c + w.z * s) * R };
			}, 96);
		}
		// 赤纬圈 ±30/±60(赤道单独亮线)
		[-60, -30, 30, 60].forEach((decl)=>{
			pushCirclePolyline((t)=>sph(t * 360, decl, R), 120);
		});
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		const grid = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
			color: PD_COLOR.grid, transparent: true, opacity: PD_LEVELS.grid, // [WP-D] 四级明度:网格退为极淡辅助
		}));
		// [L1] 网格与天赤道分属两个圈层组(用户要求逐圈可选;网格无文字标注)
		const gGrid = this._frameLayerGroup('grid', this.skyGroup);
		gGrid.grp.add(grid);

		// 天赤道(decl=0)稍亮,提供旋转参照
		const gEq = this._frameLayerGroup('equator', this.skyGroup);
		gEq.grp.add(this._buildDeclCircleLine(0, PD_COLOR.equator, 0.9));
		// 圈名标注:天赤道(用户定案「不标注根本不知道看的是什么」)
		const eqLabel = makeTextSprite('天赤道', { worldSize: Math.max(7, this.radius * 0.05), color: '#7fb2e0', glow: true });
		const eqp = sph(100, 0, this.radius * 1.05);
		eqLabel.position.set(eqp.x, eqp.y, eqp.z);
		gEq.labelSub.add(eqLabel);
	}

	/** 等赤纬圈 Line(迫星周日圈与赤道线共用;dashed=迫星圈观感) */
	_buildDeclCircleLine(declDeg, color, opacity, dashed){
		const R = this.radius;
		const pts = [];
		for(let i = 0; i <= 180; i += 1){
			const p = sph(i * 2, declDeg, R);
			pts.push(new THREE.Vector3(p.x, p.y, p.z));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const material = dashed
			? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: R * 0.035, gapSize: R * 0.02 })
			: new THREE.LineBasicMaterial({ color, transparent: true, opacity });
		const line = new THREE.Line(geom, material);
		if(dashed){
			line.computeLineDistances();
		}
		return line;
	}

	/** 大圆 Line(基向量参数式) */
	_buildGreatCircleLine(u, w, color, opacity){
		const R = this.radius;
		const pts = [];
		for(let i = 0; i <= 180; i += 1){
			const a = (i / 180) * TWO_PI;
			const c = Math.cos(a);
			const s = Math.sin(a);
			pts.push(new THREE.Vector3((u.x * c + w.x * s) * R, (u.y * c + w.y * s) * R, (u.z * c + w.z * s) * R));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
		return line;
	}

	/** 大圆高亮 Tube(应星位置圈;MeshStandardMaterial 零灯光下仅 emissive 可见 → 脉冲有真 emissive 通道) */
	_buildGreatCircleTube(u, w, color){
		const curve = new GreatCircleCurve(u, w, this.radius);
		// [L1] 管径减细(用户实测 0.0052 档「遮挡太多信息」)
		const tubeR = Math.max(0.42, this.radius * 0.0028);
		const geom = new THREE.TubeGeometry(curve, 220, tubeR, 8, true);
		const material = new THREE.MeshStandardMaterial({
			color: 0x000000,
			emissive: new THREE.Color(color),
			emissiveIntensity: 1.0,
			transparent: true,
			opacity: 0.92,
		});
		return new THREE.Mesh(geom, material);
	}

	// —— 地平三圈:地平圈/子午圈/卯酉圈 + 天顶/东点/北点标注(观测者系,恒静止) ——
	_buildHorizonFrame(frame){
		const R = this.radius; // 🔴 circleName(:407) 引用 R:方法作用域必须声明(fee54b4b 引入圈名时漏,真机 ReferenceError 连坐黄道/星点/wake 全不执行)
		const z = zenithOf(frame);
		const e = eastPointOf(frame);
		const zenithVec = unitOf(z.ra, z.decl);
		const eastVec = unitOf(e.ra, e.decl);
		const northVec = northPointOf(frame);   // 天顶×东点(φ=0 时=天北极,亦正确)
		const basis = { horizon: null, meridian: null, primeVertical: null };

		// [L1] 三圈各自圈层组(无条件建组:φ=±90 退化缺线时方位点标注仍有归宿)
		const gHor = this._frameLayerGroup('horizon', this.frameGroup);
		const gMer = this._frameLayerGroup('meridian', this.frameGroup);
		const gPV = this._frameLayerGroup('primeVertical', this.frameGroup);

		// 地平圈:过东点/北点(两者皆 ⊥ 天顶,P(t)=E·cos t+N·sin t 恒在地平面)
		if(northVec){
			basis.horizon = { u: eastVec, w: northVec };
			gHor.grp.add(this._buildGreatCircleLine(eastVec, northVec, PD_COLOR.horizon, 0.95));
		}
		// 子午圈:过天顶与天北极(φ=±90 天顶=天极 → 退化,跳过)
		const ncp = { x: 0, y: 1, z: 0 };
		const meridianBasis = greatCircleThrough(zenithVec, ncp);
		if(meridianBasis){
			basis.meridian = meridianBasis;
			gMer.grp.add(this._buildGreatCircleLine(meridianBasis.u, meridianBasis.w, PD_COLOR.meridian, 0.8));
		}
		// 卯酉圈:过东点与天顶
		const pvBasis = greatCircleThrough(eastVec, zenithVec);
		if(pvBasis){
			basis.primeVertical = pvBasis;
			gPV.grp.add(this._buildGreatCircleLine(pvBasis.u, pvBasis.w, PD_COLOR.primeVertical, 0.8));
		}
		this._frameBasis = basis;

		// 天顶/东点/北点标注(小点 + 名牌;[L1] 按语义归圈:天顶→子午/东点→卯酉/北点→地平)
		const mark = (vec, text, labelSub)=>{
			if(!vec){
				return;
			}
			const R = this.radius;
			const dotGeom = new THREE.SphereGeometry(Math.max(0.9, R * 0.008), 10, 10);
			const dot = new THREE.Mesh(dotGeom, new THREE.MeshBasicMaterial({ color: PD_COLOR.frameLabel }));
			dot.position.set(vec.x * R, vec.y * R, vec.z * R);
			labelSub.add(dot);
			const label = makeTextSprite(text, { worldSize: Math.max(7, R * 0.055), color: PD_COLOR.frameLabel, glow: true });
			label.position.set(vec.x * R * 1.07, vec.y * R * 1.07, vec.z * R * 1.07);
			labelSub.add(label);
		};
		mark(zenithVec, '天顶', gMer.labelSub);
		mark(eastVec, '东点', gPV.labelSub);
		mark(northVec, '北点', gHor.labelSub);
		// 圈名标注:地平/子午/卯酉(各取圈上不与点标冲突的位置;色随各圈主题色)
		const circleName = (vec, text, colorHex, labelSub)=>{
			const label = makeTextSprite(text, { worldSize: Math.max(6.5, R * 0.046), color: colorHex, glow: true });
			label.position.set(vec.x * R * 1.05, vec.y * R * 1.05, vec.z * R * 1.05);
			labelSub.add(label);
		};
		// 地平圈:东点与北点之间(绕天顶轴 45°);子午圈:天顶→北 45°;卯酉圈:天顶→东 45°
		const mid = (a, b)=>{
			const v = { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
			const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
			return { x: v.x / len, y: v.y / len, z: v.z / len };
		};
		circleName(mid(eastVec, northVec), '地平圈', '#7fd191', gHor.labelSub);
		circleName(mid(zenithVec, northVec), '子午圈', '#c39ae0', gMer.labelSub);
		circleName(mid(zenithVec, eastVec), '卯酉圈', '#7fc9c2', gPV.labelSub);

		// [WP-A] 周日方向浮标:地平圈东/西点外侧「东·升/西·落」——常驻淡显(0.45),播放中提亮(1.0),
		// 把「周日旋转的物理方向」钉在画面上(观测者一眼读出星从东升、向西落)。
		this._dirBeacons = [];
		const beacon = (vec, text)=>{
			if(!vec){ return; }
			const s2 = makeTextSprite(text, { worldSize: Math.max(6.5, R * 0.048), color: PD_COLOR.direct, glow: true });
			s2.position.set(vec.x * R * 1.14, vec.y * R * 1.14 + R * 0.03, vec.z * R * 1.14);
			if(s2.material){ s2.material.transparent = true; s2.material.opacity = 0.45; }
			gHor.labelSub.add(s2);   // [L1] 周日浮标钉在地平圈东西点 → 随地平圈层显隐
			this._dirBeacons.push(s2);
		};
		beacon(eastVec, '东 · 升 ↑');
		beacon({ x: -eastVec.x, y: -eastVec.y, z: -eastVec.z }, '↓ 西 · 落');
	}

	/** [WP-A] 播放期方向浮标提亮/还原(playRow 起播提亮,播完与复位还原淡显) */
	_setBeaconEmphasis(on){
		(this._dirBeacons || []).forEach((s2)=>{
			if(s2.material){ s2.material.opacity = on ? 1.0 : 0.45; }
		});
	}

	// —— 本命点/虚点:全部以引擎真实 (ra,decl) 摆点(kind ∈ term/antiscia/aspect = 小号灰点) ——
	_buildPoints(points){
		const R = this.radius;
		this.pointMeshMap.clear();
		Object.keys(points).forEach((pid)=>{
			const pt = points[pid];
			if(!pt){
				return;
			}
			const isVirtual = VIRTUAL_POINT_KINDS.has(pt.kind);
			const baseId = basePointIdOf(pid);
			// 行星色沿用 Astro3D 行星色表(Astro3DColor),缺项回退 PlanetStroke;虚点恒灰
			let color = AstroConst.Astro3DColor[baseId];
			if(color === undefined || color === null){
				color = AstroConst.Astro3DColor.PlanetStroke;
			}
			const pos = sph(pt.ra, pt.decl, R);
			let dot;
			let label = null;
			let tint = null;
			if(isVirtual && pt.kind === 'aspect'){
				// [E1] 相位点=「本体 glyph + 相位 glyph」(用户定案:一堆白点没意义,须按标准标注)。
				// id 形如 D_Saturn_60/S_Sun_90/N_Moon_180;末段数=相位度,合(0)只出本体 glyph。
				const glyph = pointGlyphOf(baseId);
				const aspM = /^[DSN]_.+_(\d+)$/.exec(`${pid}`);
				const aspDeg = aspM ? aspM[1] : null;
				const aspChar = (aspDeg && aspDeg !== '0') ? AstroText.AstroMsg[`Asp${aspDeg}`] : null;
				const txt = (glyph.astroFont && aspChar) ? `${glyph.text}${aspChar}` : glyph.text;
				dot = makeTextSprite(txt, {
					worldSize: Math.max(5.5, R * 0.04),   // 略小于本体(相位点密,防糊)
					color: '#ffffff', glow: true, minLuma: 0.5,
					...(glyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				});
				if(dot.material && dot.material.color && dot.material.color.setHex){ dot.material.color.setHex(PD_COLOR.virtualPoint); }
				if(dot.userData){ dot.userData.__pmEntry = true; }   // [P2] 视距补偿由 _scaleDot 管
				dot.visible = !!this.virtualToggles[pt.kind];         // 随「相位点」toggle 显隐
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}else if(isVirtual){
				// 映点/界(已无 toggle,恒隐;保留最小灰点呈现,选中行涉及点由 selectRow 显影)。
				dot = new THREE.Mesh(
					new THREE.SphereGeometry(Math.max(0.9, R * 0.008), 10, 10),
					new THREE.MeshBasicMaterial({ color: PD_COLOR.virtualPoint, transparent: true, opacity: PD_LEVELS.virtualShown })
				);
				dot.visible = !!this.virtualToggles[pt.kind];
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}else{
				// [G1] 实体点=glyph 即本体(去光球,用户定案):不再画色球+悬空名牌两件套,
				// 发光 glyph 精灵直接落在 (ra,decl) 位置本身。底稿恒白字烘焙,行星色经
				// liftLuma 抬亮后由 material 乘性染色 —— 选中/悬停重染方向色时得纯正色
				// (彩字×金=浑浊;白字×任意色=该色,连同光晕同色随染)。
				const glyph = pointGlyphOf(baseId);
				const cssBase = typeof color === 'string' ? color : `#${(color >>> 0).toString(16).padStart(6, '0')}`;
				tint = parseInt(liftLuma(cssBase, 0.6).slice(1), 16);
				dot = makeTextSprite(glyph.text, {
					worldSize: Math.max(8, R * 0.058),
					color: '#ffffff',
					glow: true,
					...(glyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				});
				if(dot.material && dot.material.color && dot.material.color.setHex){
					dot.material.color.setHex(tint);
				}
				if(dot.userData){ dot.userData.__pmEntry = true; } // [P2] 视距补偿绕开(由 _scaleDot 管)
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}
			this.pointMeshMap.set(pid, {
				dot,
				label,
				isVirtual,
				kind: pt.kind || '', // [WP-3] 三类虚点 toggle 用
				isSprite: !isVirtual || pt.kind === 'aspect', // [G1/E1] 实体点+相位点 glyph 均 sprite(纵横比安全)
				baseColor: tint !== null ? tint : ((dot.material.color && dot.material.color.getHex && dot.material.color.getHex()) || 0xffffff),
				baseScale: dot.scale.x,
				baseScaleY: dot.scale.y,
				selK: 1, // 选中态缩放档(悬停在其上再乘 1.35)
			});
		});
	}

	/** [G1] 点位缩放:sprite 纵横比安全(x=画布比例×k, y=世界高×k);球体沿用 setScalar。
	 *  [P2] 乘视距补偿 _spriteViewK:球心档相机距天球面 ≈R(外视 2.75R),等 worldSize 视觉
	 *  放大 2.75× 糊脸 —— 内视统一 0.4× 补偿,退出还原。 */
	_scaleDot(entry, k){
		if(!entry || !entry.dot || !entry.dot.scale){
			return;
		}
		if(entry.isSprite){
			const vk = this._spriteViewK || 1;
			entry.dot.scale.set((entry.baseScale || 1) * k * vk, (entry.baseScaleY || entry.baseScale || 1) * k * vk, 1);
		}else{
			entry.dot.scale.setScalar((entry.baseScale || 1) * k);
		}
	}

	/** [P2] 全场 sprite 视距补偿(球心档 0.4 / 其余 1):非点位 sprite 首见记 __vsBase 初始尺寸
	 *  后按档重算;点位条目走 _scaleDot(保留 selK/hover 语义)。selectRow/setData 重建资产后
	 *  须重调以覆盖新建 sprite。 */
	_setSpriteViewScale(k){
		this._spriteViewK = k;
		if(this.scene && this.scene.traverse){
			this.scene.traverse((o)=>{
				if(!o || !o.isSprite || !o.scale || !o.userData){ return; }
				if(o.userData.__pmEntry){ return; } // 点位条目由 _scaleDot 统一管
				if(!o.userData.__vsBase){ o.userData.__vsBase = { x: o.scale.x, y: o.scale.y }; }
				o.scale.set(o.userData.__vsBase.x * k, o.userData.__vsBase.y * k, 1);
			});
		}
		this.pointMeshMap.forEach((entry)=>{
			if(entry.isSprite){ this._scaleDot(entry, entry.selK || 1); }
		});
		this.wake(2);
	}

	// —— 行选择:迫星等赤纬周日圈 + 应星位置圈高亮 + 迫星活动标(播放载体) ——
	clearSelection(){
		if(this._selection){
			if(this._selection.marker && this._selection.marker.parent){
				this._selection.marker.parent.remove(this._selection.marker);
			}
			this._disposeObject(this._selection.marker);
			// 相位连线/度数标签(挂 skyGroup)逐一移除释放
			(this._selection.extraSky || []).forEach((obj)=>{
				if(obj.parent){
					obj.parent.remove(obj);
				}
				this._disposeObject(obj);
			});
			// 还原迫星/应星点观感
			(this._selection.restore || []).forEach((fn)=>fn());
			this._selection = null;
		}
		this._clearTrail();
		this._removeLabelCard();
		this._clearGroup(this.selGroup);
		// [G3] 运动组整组清空+归零(其内全部为选中行资产,随选随建)
		this._clearGroup(this.dirGroup);
		if(this.dirGroup && this.dirGroup.rotation){
			this.dirGroup.rotation.y = 0;
		}
	}

	/**
	 * 选中主限表某行(idx = res.rows 下标):
	 *  - 迫星:等赤纬周日圈(cat='Z' 用 declZ 投影口径,'M' 用真赤纬)+ 活动标(随天球转)
	 *  - 应星:circles[sig] 按 kind → CIRCLE_KIND_RENDER 渲染(高亮大圈/大圆/折线/细弧)
	 *  - 天球回到 0 位(播放恒从 0 起步)
	 * @returns {null|{row, conv}} 无效行返 null
	 */
	selectRow(idx){
		if(this.disposed || !this.res || !Array.isArray(this.res.rows)){
			return null;
		}
		const row = this.res.rows[idx];
		if(!row){
			return null;
		}
		this._playToken += 1;   // 作废在途播放
		this._tweenActive = false;
		this.clearSelection();
		// [G3] skyGroup 恒 0(本命参照系,不再随播转动——历史姿态防御性归零);运动组同归零
		this.skyGroup.rotation.y = 0;
		this.dirGroup.rotation.y = 0;

		const points = this.res.points || {};
		const circles = this.res.circles || {};
		const conv = isConverseRow(row);
		const dirColor = conv ? PD_COLOR.converse : PD_COLOR.direct;
		const R = this.radius;
		const restore = [];
		const pulseTargets = [];

		// —— [D1] 行级动/静分派(号序法律条文见 pdSphereMath 头注;fixture 670/670 实证) ——
		// mover='sig':Z 类·行星族应星动,靶=迫星相位点赤经圈(arc = RA(sig,真纬) − RA(promZ));
		// mover='prom':轴类应星/M/T 类迫星动,靶=轴圈/位置圈(旧几何本就正确的那族)。
		// 坐标口径:迫星恒 zero-lat 投影(effectiveEq);应星恒真黄纬(sigEqOf——旧误对应星取 raZ)。
		const promPt = points[row.prom];
		const promEff = effectiveEq(promPt, row.cat);
		const sigPt = points[row.sig];
		const sigEqT = sigEqOf(sigPt);
		const mover = moverOfRow(row);   // [D2] 恒 'prom'(应星固定、迫星动);sig 分支已成惰性死支,保留不害
		const moverPt = mover === 'sig' ? sigPt : promPt;
		const moverEq = mover === 'sig' ? sigEqT : promEff;
		const targetDeg = promRotationRad(row) * 180 / Math.PI;   // [D2] 迫星旋转:planet 族 +arc 落应星赤经圈,轴/M/T 族 −arc

		// —— 动方「预定路径弧」:观测者固定系中,自动方本命位沿其赤纬圈延伸恰 arc 度的虚线弧
		// +末端箭头=「将要走的路」;播放时进度实线 setDrawRange 渐现=「已走过的路」。
		// 数学:rotation.y=α 时组内点世界赤经=ra+α(sph 推导),direct 目标角为负。
		const PATH_SEGS = 96;
		let progressLine = null;
		if(moverPt){
			const pathPts = [];
			for(let i = 0; i <= PATH_SEGS; i += 1){
				const p = sph(moverEq.ra + targetDeg * (i / PATH_SEGS), moverEq.decl, R * 1.004);
				pathPts.push(new THREE.Vector3(p.x, p.y, p.z));
			}
			const dashGeom = new THREE.BufferGeometry().setFromPoints(pathPts);
			const dashLine = new THREE.Line(dashGeom, new THREE.LineDashedMaterial({
				color: dirColor, transparent: true, opacity: 0.5,
				dashSize: R * 0.035, gapSize: R * 0.025,
			}));
			dashLine.computeLineDistances();
			this.selGroup.add(dashLine);
			// 末端方向箭头(小锥,朝弧切线方向)
			const tip = pathPts[PATH_SEGS];
			const prev = pathPts[PATH_SEGS - 1];
			const dir = tip.clone().sub(prev).normalize();
			const cone = new THREE.Mesh(
				new THREE.ConeGeometry(Math.max(1.4, R * 0.014), Math.max(3.2, R * 0.032), 10),
				new THREE.MeshBasicMaterial({ color: dirColor, transparent: true, opacity: 0.85 })
			);
			cone.position.copy(tip);
			cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
			this.selGroup.add(cone);
			// 进度实线(播放中 setDrawRange 渐现;初始 0=不可见)
			const progGeom = new THREE.BufferGeometry().setFromPoints(pathPts);
			progGeom.setDrawRange(0, 0);
			progressLine = new THREE.Line(progGeom, new THREE.LineBasicMaterial({
				color: dirColor, transparent: true, opacity: 0.95,
			}));
			this.selGroup.add(progressLine);
		}

		// [D1] 动方活动标(挂 dirGroup,唯一随播转者):
		//  mover='prom':相位行=「本体glyph+相位glyph」组合字;映点/界=中文短标;本体行=glyph;
		//  mover='sig':应星本体 glyph(真黄纬位)——被引导滑向迫星相位点赤经圈(内核 §8.1 号序)。
		//  白字烘焙+material 染方向色。🔴 moverPt 守卫:缺点则无标(effectiveEq 回落 (0,0) 幽灵防)。
		const promBaseId = basePointIdOf(row.prom);
		const sigBaseId = basePointIdOf(row.sig);
		const cnNameOf = (baseId)=>{
			const cn = AstroText.AstroMsgCN[baseId];
			if(cn !== undefined && cn !== null && `${cn}`.length){
				return `${cn}`;
			}
			if(`${baseId}`.indexOf('House') === 0){
				return `${`${baseId}`.slice(5)}宫`;
			}
			return `${baseId}`;
		};
		const dirCss = conv ? '#00e0e0' : '#ffd700';
		const aspRawDeg = (/^[DSN]_.+_(\d+)$/.exec(`${row.prom || ''}`) || [])[1];
		const aspGlyphChar = aspRawDeg !== undefined ? AstroText.AstroMsg[`Asp${aspRawDeg}`] : null;
		const tintSprite = (sp)=>{
			if(sp && sp.material && sp.material.color && sp.material.color.set){
				sp.material.color.set(dirCss);
			}
			return sp;
		};
		let marker = null;
		if(moverPt){
			if(mover === 'sig'){
				const sigGlyph = pointGlyphOf(sigBaseId);
				marker = tintSprite(makeTextSprite(sigGlyph.text, {
					worldSize: Math.max(8.5, R * 0.06), color: '#ffffff', glow: true,
					...(sigGlyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				}));
			}else{
				const bodyGlyph = pointGlyphOf(promBaseId);
				if(promPt.kind === 'aspect' && bodyGlyph.astroFont && aspGlyphChar && aspRawDeg !== '0'){
					marker = tintSprite(makeTextSprite(`${bodyGlyph.text}${aspGlyphChar}`, {
						worldSize: Math.max(8.5, R * 0.06), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
					}));
				}else if(VIRTUAL_POINT_KINDS.has(promPt.kind) && promPt.kind !== 'aspect'){
					const kindTxt = promPt.kind === 'term' ? '界' : (`${row.prom}`.indexOf('C_') === 0 ? '反映' : '映');
					marker = makeTextSprite(`${cnNameOf(promBaseId)}·${kindTxt}`, {
						worldSize: Math.max(6.5, R * 0.046), color: dirCss, glow: true,
					});
				}else{
					marker = tintSprite(makeTextSprite(bodyGlyph.text, {
						worldSize: Math.max(8.5, R * 0.06), color: '#ffffff', glow: true,
						...(bodyGlyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
				}
			}
			const mp = sph(moverEq.ra, moverEq.decl, R);
			marker.position.set(mp.x, mp.y, mp.z);
			this.dirGroup.add(marker);
		}

		// [D1] 靶线分派:
		//  mover='sig' → 迫星相位点·赤经圈(过天极与 promZ 的大圆,前端自构粗管——后端 circles
		//    是旧「应星圈」假设产物,行星族不再消费);
		//  mover='prom' → 后端 circles[sig] kind 分派(轴圈/位置圈/折线/细圈,该族旧几何本就正确)。
		const circle = circles[row.sig];
		const kind = circle && circle.type;
		const render = CIRCLE_KIND_RENDER[kind];
		if(mover === 'sig'){
			if(promPt){
				const basis = greatCircleThrough({ x: 0, y: 1, z: 0 }, unitOf(promEff.ra, promEff.decl));
				if(basis){
					const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
					this.selGroup.add(tube);
					pulseTargets.push({ material: tube.material, mode: 'emissive' });
					// 线名标注:机器走赤道——名实相符(旧「黄道相位」贴赤道线=名实不符,用户实爆)
					const lineTag = makeTextSprite('迫星相位点·赤经圈', {
						worldSize: Math.max(6, R * 0.042), color: dirColor, glow: true,
					});
					const ltp = sph(promEff.ra, Math.min(72, Math.max(-72, promEff.decl + 30)), R * 1.05);
					lineTag.position.set(ltp.x, ltp.y, ltp.z);
					this.selGroup.add(lineTag);
				}
			}
		}else{
		if(circle && !render){
			console.warn('[AstroPDSphere] 未登记的应星位置圈 kind:', kind);
		}
		if(render === 'frame-highlight'){
			// ASC/MC/Vertex:对应地平框架大圈原位高亮(Tube 叠在细线上)
			const basis = this._frameBasis && this._frameBasis[FRAME_HIGHLIGHT_TARGET[kind]];
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}else if(render === 'great-circle' && sigPt){
			// Regio/Campanus 位置圈:过地平南北点与应星的大圆(北点与应星叉积得法向量;应星恒真纬)
			const northVec = northPointOf(this.res.frame);
			const basis = northVec ? greatCircleThrough(northVec, unitOf(sigEqT.ra, sigEqT.decl)) : null;
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}else if(render === 'polyline' && circle){
			// Placidus/Topocentric/legacy:采样折线,断段自然断开(极圈不可解区间零连线)
			// [P1] polyline 圈选中期粗管化:细线在满盘同色系里不显眼(用户实读「没碰到」),
			// 段折线走 CatmullRom(tension 0 过点)Tube;段仍自然断开(极圈不可解区间零管)。
			(circle.points || []).forEach((seg)=>{
				if(!Array.isArray(seg) || seg.length < 2){
					return;
				}
				const pts = seg.map((p)=>{
					const v = sph(p.ra, p.decl, R);
					return new THREE.Vector3(v.x, v.y, v.z);
				});
				try{
					const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
					const tube = new THREE.Mesh(
						new THREE.TubeGeometry(curve, Math.max(32, pts.length * 2), Math.max(0.42, R * 0.0028), 8, false), // [L1] 同步减细
						new THREE.MeshStandardMaterial({
							color: 0x000000, emissive: new THREE.Color(dirColor), emissiveIntensity: 1.0,
							transparent: true, opacity: 0.92,
						})
					);
					this.selGroup.add(tube);
					pulseTargets.push({ material: tube.material, mode: 'emissive' });
				}catch(e){
					// Tube 构建失败回退细线(观感降级,语义不丢)
					const line = new THREE.Line(
						new THREE.BufferGeometry().setFromPoints(pts),
						new THREE.LineBasicMaterial({ color: dirColor, transparent: true, opacity: 0.95 })
					);
					this.selGroup.add(line);
					pulseTargets.push({ material: line.material, mode: 'color', baseColor: dirColor });
				}
			});
		}else if(render === 'thin-arc' && sigPt){
			// hour-circle:过天极的应星时圈;ecliptic-meridian:过黄道极的应星黄道经圈(应星恒真纬)
			// [P1] 选中期一律粗管(旧 0.72 细线被淹没=「成相位线」看不见的直接元凶)
			const pole = kind === 'ecliptic-meridian'
				? (()=>{
					const ep = eclipticPoleOf((this.res.frame && this.res.frame.epsMean) || 23.44);
					return unitOf(ep.ra, ep.decl);
				})()
				: { x: 0, y: 1, z: 0 };
			const basis = greatCircleThrough(pole, unitOf(sigEqT.ra, sigEqT.decl));
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}
		} // [D1] mover==='prom' 靶线分派 else 收口

		// —— [D1] 迫星侧身份标注:父组按动方分派 ——
		//  mover='prom':迫星资产挂 dirGroup 随组转(旧正确族);
		//  mover='sig':迫星相位点是「固定靶」——本体 glyph/相位点标/直线连线/坐标卡全部静止挂
		//    selGroup;此时活动标(dirGroup)=应星 glyph,应星卡随动。
		const promSideGrp = mover === 'prom' ? this.dirGroup : this.selGroup;
		const extraSky = []; // [G3] 运动资产改由组整组清理,此数组仅保字段兼容(恒空)
		if(promPt){
			// [P4] 圈选环撤销(用户定案「参与相位的星体不用圈起来了」):glyph 本体+方向色染+标注卡已足辨识
			const aspTxt = aspectDegOf(row.prom);
			const promCard = makeTextSprite(`迫星·${cnNameOf(promBaseId)}${aspTxt ? `·${aspTxt}` : ''}`, {
				worldSize: Math.max(7, R * 0.05), color: dirColor, glow: true,
			});
			const pcp = sph(promEff.ra, Math.min(84, promEff.decl + 10), R * 1.1);
			promCard.position.set(pcp.x, pcp.y, pcp.z);
			promSideGrp.add(promCard);
			// [D1] mover='sig' 时相位点本身要有静止标(动方标已让位给应星):组合 glyph 钉在相位点位
			if(mover === 'sig'){
				const bodyGlyphS = pointGlyphOf(promBaseId);
				const aspPtMark = (promPt.kind === 'aspect' && bodyGlyphS.astroFont && aspGlyphChar && aspRawDeg !== '0')
					? tintSprite(makeTextSprite(`${bodyGlyphS.text}${aspGlyphChar}`, {
						worldSize: Math.max(8, R * 0.055), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
					}))
					: tintSprite(makeTextSprite(bodyGlyphS.text, {
						worldSize: Math.max(8, R * 0.055), color: '#ffffff', glow: true,
						...(bodyGlyphS.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
				const app = sph(promEff.ra, promEff.decl, R);
				aspPtMark.position.set(app.x, app.y, app.z);
				this.selGroup.add(aspPtMark);
			}
			// [WP-2 双坐标] 完整语义坐标行:λ(黄道)+α/δ(赤道)——标注卡从不显数值(体检第4项)。
			const _fmtDeg = (v)=>{
				let d = Math.floor(Math.abs(v)); let m = Math.round((Math.abs(v) - d) * 60);
				if(m >= 60){ m = 0; d += 1; } // 分四舍五入至 60 → 进位入度,免出现 …°60′
				return `${v < 0 ? '-' : ''}${d}°${m < 10 ? '0' : ''}${m}′`;
			};
			const coordTxt = `λ=${_fmtDeg(((Number(promPt.lon) % 360) + 360) % 360)} β=${_fmtDeg(Number(promPt.lat) || 0)} · α=${_fmtDeg(promEff.ra)} δ=${_fmtDeg(promEff.decl)}`;
			const coordCard = makeTextSprite(coordTxt, {
				worldSize: Math.max(5.2, R * 0.036), color: dirColor, minLuma: 0.55,
			});
			const ccp = sph(promEff.ra, Math.min(80, promEff.decl + 16), R * 1.1);
			coordCard.position.set(ccp.x, ccp.y, ccp.z);
			promSideGrp.add(coordCard);
			// [WP-2 双坐标] Z 类:黄道投影点 (raZ,declZ) 常驻金菱形,细虚线连真体
			// (月亮 β≈5° 真体明显离黄道圈 —— 弧几何用投影点,物理位置是真体,两者都画才不糊)。
			const isMundoCard = `${row.cat || ''}` === 'M';
			if(!isMundoCard && Number.isFinite(Number(promPt.raZ))){
				const trueP = sph(Number(promPt.ra), Number(promPt.decl), R);
				const projP = sph(Number(promPt.raZ), Number(promPt.declZ), R);
				const tv = new THREE.Vector3(trueP.x, trueP.y, trueP.z);
				const pv = new THREE.Vector3(projP.x, projP.y, projP.z);
				if(tv.distanceTo(pv) > R * 0.006){
					const diamond = new THREE.Mesh(
						new THREE.OctahedronGeometry(Math.max(1.1, R * 0.011)),
						new THREE.MeshBasicMaterial({ color: 0xd8ab52 })
					);
					diamond.position.copy(pv);
					promSideGrp.add(diamond);
					const tie = new THREE.Line(
						new THREE.BufferGeometry().setFromPoints([tv, pv]),
						new THREE.LineDashedMaterial({ color: 0xd8ab52, transparent: true, opacity: 0.5, dashSize: R * 0.018, gapSize: R * 0.014 })
					);
					tie.computeLineDistances();
					promSideGrp.add(tie);
				}
			}
			// [G3] 虚点迫星:本体星 glyph 副本+本体↔被引导点连线(中点相位 glyph,用户定案)——
			// skyGroup 原件将被显隐策略藏起,运动组内的副本才是「随周日转动的迫星本体」。
			if(VIRTUAL_POINT_KINDS.has(promPt.kind)){
				let bodyPt = null;
				Object.keys(points).some((k)=>{
					const cand = points[k];
					if(cand && !VIRTUAL_POINT_KINDS.has(cand.kind) && basePointIdOf(k) === promBaseId){
						bodyPt = cand;
						return true;
					}
					return false;
				});
				if(bodyPt){
					const bodyEq = effectiveEq(bodyPt, row.cat);
					// 本体星 glyph 副本(白字+方向色染;略小于被引导点标)
					const bodyGlyphB = pointGlyphOf(promBaseId);
					const bodySprite = tintSprite(makeTextSprite(bodyGlyphB.text, {
						worldSize: Math.max(7, R * 0.05), color: '#ffffff', glow: true,
						...(bodyGlyphB.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
					const bpPos = sph(bodyEq.ra, bodyEq.decl, R);
					bodySprite.position.set(bpPos.x, bpPos.y, bpPos.z);
					promSideGrp.add(bodySprite);
					// [P1] 用户定案「相位线直接用直线连结 promissor 和相位点」:大圆弧→弦直线
					//(线穿球内,线框天球下清晰可见;直线无 slerp 除零问题,180° 对分照画=直径线)。
					const p1 = sph(bodyEq.ra, bodyEq.decl, R);
					const p2 = sph(promEff.ra, promEff.decl, R);
					const tvA = new THREE.Vector3(p1.x, p1.y, p1.z);
					const tvB = new THREE.Vector3(p2.x, p2.y, p2.z);
					if(tvA.distanceTo(tvB) > R * 0.004){
						const link = new THREE.Line(
							new THREE.BufferGeometry().setFromPoints([tvA, tvB]),
							new THREE.LineBasicMaterial({ color: dirColor, transparent: true, opacity: 0.55 })
						);
						promSideGrp.add(link);
						// [P4] 本体圈选环撤销(用户定案);直线+glyph 已表达来源
						// 弦中点相位 glyph(用户定案「中间用相位glyph标识出来」;billboard 任意位置可读)
						if(aspGlyphChar && aspRawDeg !== '0'){
							const mv = tvA.clone().add(tvB).multiplyScalar(0.5);
							const aspMid = tintSprite(makeTextSprite(`${aspGlyphChar}`, {
								worldSize: Math.max(6.5, R * 0.048), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
							}));
							aspMid.position.set(mv.x, mv.y, mv.z);
							promSideGrp.add(aspMid);
						}
					}
				}
			}
		}
		if(sigPt){
			// [D1] 应星卡:mover='sig' 随动挂 dirGroup(跟着应星滑),否则静止 selGroup;坐标恒真纬。
			const sigCard = makeTextSprite(`应星·${cnNameOf(sigBaseId)}`, {
				worldSize: Math.max(7, R * 0.05), color: dirColor, glow: true,
			});
			const scp = sph(sigEqT.ra, Math.max(-84, sigEqT.decl - 10), R * 1.1);
			sigCard.position.set(scp.x, scp.y, scp.z);
			(mover === 'sig' ? this.dirGroup : this.selGroup).add(sigCard);
			// —— [D1] 相遇几何按动方分派 ——
			//  mover='sig':命中点=迫星相位点赤经圈 ∩ 应星赤纬圈(解析直取:同 RA、应星赤纬);
			//    静止端=相位点本身,连线沿赤经圈纵向,播放至 t=1 应星滑入命中点。
			//  mover='prom':旧正统几何(动方赤纬圈 ∩ 应星位置圈真交点;kind 分派;解不出回落 RA 平移)。
			//  M 类:半弧比例空间角,只高亮命中点不画定角连线。
			if(promPt){
				const isMundo = `${row.cat || ''}` === 'M';
				const rawAsp = aspectDegOf(row.prom) || aspectDegOf(row.sig);
				let endP;
				let staticAnchorV;   // 命中连线的静止端(sig 动=迫星相位点;prom 动=应星本体)
				let circleName;
				if(mover === 'sig'){
					endP = sph(promEff.ra, sigEqT.decl, R);
					const ap = sph(promEff.ra, promEff.decl, R);
					staticAnchorV = new THREE.Vector3(ap.x, ap.y, ap.z);
					circleName = '赤经圈';
				}else{
					const fallbackP = sph(promEff.ra + targetDeg, promEff.decl, R);
					endP = fallbackP;
					let hitBasis = null;
					if(render === 'frame-highlight'){
						hitBasis = this._frameBasis && this._frameBasis[FRAME_HIGHLIGHT_TARGET[kind]];
					}else if(render === 'great-circle'){
						const nv = northPointOf(this.res.frame);
						hitBasis = nv ? greatCircleThrough(nv, unitOf(sigEqT.ra, sigEqT.decl)) : null;
					}else if(render === 'thin-arc'){
						const pole = kind === 'ecliptic-meridian'
							? (()=>{ const ep = eclipticPoleOf((this.res.frame && this.res.frame.epsMean) || 23.44); return unitOf(ep.ra, ep.decl); })()
							: { x: 0, y: 1, z: 0 };
						hitBasis = greatCircleThrough(pole, unitOf(sigEqT.ra, sigEqT.decl));
					}
					if(hitBasis){
						const hits = declCircleGreatIntersect(promEff.decl, hitBasis);
						if(hits && hits.length){
							const fv = new THREE.Vector3(fallbackP.x, fallbackP.y, fallbackP.z);
							let bestV = null;
							hits.forEach((h)=>{
								const hv = new THREE.Vector3(h.x * R, h.y * R, h.z * R);
								if(!bestV || hv.distanceTo(fv) < bestV.distanceTo(fv)){ bestV = hv; }
							});
							if(bestV){ endP = { x: bestV.x, y: bestV.y, z: bestV.z }; }
						}
					}else if(render === 'polyline' && circle){
						const hit = declCirclePolylineHit(promEff.decl, circle.points);
						if(hit){ endP = sph(hit.ra, hit.decl, R); }
					}
					const sp = sph(sigEqT.ra, sigEqT.decl, R);
					staticAnchorV = new THREE.Vector3(sp.x, sp.y, sp.z);
					circleName = kind === 'meridian' ? '子午圈'
						: kind === 'horizon-east' ? '地平·升'
							: kind === 'prime-vertical' ? '卯酉圈'
								: kind === 'hour-circle' ? '时圈'
									: kind === 'ecliptic-meridian' ? '黄道经圈'
										: render === 'polyline' ? '半弧位置圈' : '位置圈';
				}
				const ev = new THREE.Vector3(endP.x, endP.y, endP.z);
				// [D1] 名实分层文案(用户实爆「赤道线标黄道相位」):相位取黄道(定义)·抵达走赤道机器(圈)
				const aspTxt2 = isMundo
					? `世俗相位 ${rawAsp || '合'}(半弧比例)`
					: `${rawAsp ? `黄道取相位 ${rawAsp} · ` : ''}${circleName}相遇`;
				if(isMundo){
					// M 类:位置圈命中点高亮环(不画定角连线)
					const hitRing = makeRingSprite(dirColor, Math.max(9, R * 0.065));
					hitRing.position.set(ev.x, ev.y, ev.z);
					this.selGroup.add(hitRing);
				}else{
					const gap = ev.distanceTo(staticAnchorV);
					if(gap > R * 0.01){
						const linkGeom = new THREE.BufferGeometry().setFromPoints([ev, staticAnchorV]);
						const link = new THREE.Line(linkGeom, new THREE.LineDashedMaterial({
							color: dirColor, transparent: true, opacity: 0.75,
							dashSize: R * 0.03, gapSize: R * 0.02,
						}));
						link.computeLineDistances();
						this.selGroup.add(link);
					}
				}
				const midV = ev.clone().add(staticAnchorV).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.08);
				const aspLabel = makeTextSprite(aspTxt2, { worldSize: Math.max(6.5, R * 0.048), color: dirColor, glow: true });
				aspLabel.position.set(midV.x, midV.y, midV.z);
				this.selGroup.add(aspLabel);
				// [P1→P6] 命中点标(选中即现,固定系):被引导点将抵达的位置圈命中点。
				// 双环靶已撤(用户定案「怎么还有这么大的圆环」——球心视角下尤为突兀):只留小芯点,
				// t=1 随圈脉冲即足以钉住「成相位落点」。
				const targetCore = new THREE.Mesh(
					new THREE.SphereGeometry(Math.max(1.1, R * 0.01), 10, 10),
					new THREE.MeshBasicMaterial({ color: dirColor })
				);
				targetCore.position.copy(ev);
				this.selGroup.add(targetCore);
				pulseTargets.push({ material: targetCore.material, mode: 'color', baseColor: dirColor });
			}
		}

		// [G3] 显隐策略(用户定案「盘上始终只留这两个星体以及 promissor 的对应相位点」):
		//  应星:skyGroup 原位高亮(染方向色+放大;skyGroup 恒 0 → 纹丝不动=固定征象本体);
		//  迫星本体/被引导虚点的 skyGroup 原件:隐藏(dirGroup 运动组接管其呈现,防「原地残影+运动副本」双影);
		//  其余一切点:聚焦档=整体隐去;全显档=淡显 0.55 供对照;
		//  toggle 显示中的无关虚点:聚焦下同隐。
		const sigPid = row.sig;
		let promBodyPid = null;
		if(promPt && VIRTUAL_POINT_KINDS.has(promPt.kind)){
			Object.keys(points).some((k)=>{
				const cand = points[k];
				if(cand && !VIRTUAL_POINT_KINDS.has(cand.kind) && basePointIdOf(k) === promBaseId){
					promBodyPid = k;
					return true;
				}
				return false;
			});
		}
		this.pointMeshMap.forEach((entry, pid)=>{
			const hideEntry = ()=>{
				const dv = entry.dot.visible;
				entry.dot.visible = false;
				restore.push(()=>{
					entry.dot.visible = entry.isVirtual ? !!this.virtualToggles[entry.kind] : dv;
				});
				if(entry.label){
					const lv = entry.label.visible;
					entry.label.visible = false;
					restore.push(()=>{ entry.label.visible = lv; });
				}
			};
			if(pid === sigPid){
				// [D1] 应星动(行星族):skyGroup 原件隐藏——dirGroup 运动副本接管其呈现(防双影)
				if(mover === 'sig'){
					hideEntry();
					return;
				}
				// 迫星动族:应星原位高亮(白字底稿 material 染方向色;放大走纵横比安全通道)
				const mat = entry.dot.material;
				if(mat && mat.color && mat.color.setHex){
					mat.color.setHex(dirColor);
				}
				entry.selK = 1.45;
				this._scaleDot(entry, entry.selK);
				restore.push(()=>{
					if(mat && mat.color && mat.color.setHex){
						mat.color.setHex(entry.baseColor);
					}
					entry.selK = 1;
					this._scaleDot(entry, 1);
				});
				return;
			}
			if(pid === row.prom || (promBodyPid && pid === promBodyPid)){
				hideEntry();
				return;
			}
			if(entry.isVirtual){
				if(this.focusMode && entry.dot.visible){ hideEntry(); }
				return;
			}
			if(this.focusMode){
				hideEntry();
				return;
			}
			// 全显档:退避淡显(旧观感保留作对照)
			const dm = entry.dot.material;
			const prevOpacity = dm.opacity;
			const prevTransparent = dm.transparent;
			dm.transparent = true;
			dm.opacity = 0.55;
			restore.push(()=>{
				dm.opacity = prevOpacity;
				dm.transparent = prevTransparent;
			});
		});

		this._selection = { idx, row, conv, mover, marker, pulseTargets, restore, extraSky, progressLine, pathSegs: PATH_SEGS };
		// [P2] 球心档下选中行新建的 sprite 资产补视距缩放(traverse 只补新面孔,已补的走 __vsBase 幂等)
		if((this._spriteViewK || 1) !== 1){ this._setSpriteViewScale(this._spriteViewK); }
		this.wake(3);
		return { row, conv };
	}

	// —— 播放([G3]):dirGroup.rotation.y 0 → −arc·π/180(easeInOutCubic;converse 负弧自然反向)——
	// 运动组独转:应星/黄道/其余点全部静止,唯迫星组被周日运动引导(directio 正统)。
	// [WP-B] 连播衔接:非本命姿态起播时先 300ms 缓动回 0 再进入正式播放——
	// selectRow 起手会硬置 rotation=0(路径弧/marker 按 rotation=0 烘焙,不可从中途姿态直转),
	// 旧行为=瞬间跳回本命再播(跳变);现=柔和回 0 → _playRowCore。
	playRow(idx, cardText, onDone){
		const curY = this.dirGroup ? this.dirGroup.rotation.y : 0;
		if(Math.abs(curY) > 1e-6){
			this._playToken += 1;
			const token = this._playToken;
			const t0 = performance.now();
			this._tweenActive = true;
			const back = ()=>{
				if(this.disposed){ this._tweenActive = false; return; }
				if(token !== this._playToken){ return; }
				const t = Math.min(1, (performance.now() - t0) / 300);
				this.dirGroup.rotation.y = curY * (1 - easeInOutCubic(t));
				this.wake(1);
				if(t < 1){
					window.requestAnimationFrame(back);
				}else{
					this._tweenActive = false;
					this._playRowCore(idx, cardText, onDone);
				}
			};
			this.wake(2);
			window.requestAnimationFrame(back);
			return;
		}
		this._playRowCore(idx, cardText, onDone);
	}

	_playRowCore(idx, cardText, onDone){
		const sel = this.selectRow(idx);
		if(!sel){
			return;
		}
		const row = sel.row;
		const target = promRotationRad(row);   // [D2] 迫星旋转角(族定号序;应星固定)
		const dur = playDurationMs(row.arc);
		this._playToken += 1;
		const token = this._playToken;
		this._showLabelCard(cardText, sel.conv);
		this._trailInit(sel.conv); // [WP-4] 接回渐隐尾迹(死代码复活:头注早已宣称,基建全在,只差三处接线)
		this._setBeaconEmphasis(true); // [WP-A] 播放期周日方向浮标提亮

		const t0 = performance.now();
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;   // 新播放/新数据已接管(不碰 _tweenActive,由接管方主导)
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			const eased = easeInOutCubic(t);
			this.dirGroup.rotation.y = target * eased;
			// 走过的路实线渐现(setDrawRange 与转角同步 —— 轨迹随转动陆续出现,不提前铺)
			const selNow = this._selection;
			if(selNow && selNow.progressLine){
				selNow.progressLine.geometry.setDrawRange(0, Math.max(0, Math.floor(eased * selNow.pathSegs) + 1));
			}
			this._trailAppend(); // [WP-4] 迫星活动标残影逐帧记点
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this._pulseSelection(token);   // t=1:应星位置圈 emissive 脉冲 2 次
				this._trailFade(token);        // [WP-4] 尾迹渐隐收场
				this._setBeaconEmphasis(false); // [WP-A] 播完浮标回淡显
				if(onDone){
					onDone();
				}
				// [WP-B] 播放停在命中姿态(默认)——与时间轴拖拽路径行为统一,天球停驻在「事件发生时的天空」。
				// 显式开启「播完自动复位」(设置 checkbox → localStorage horosa.pdsphere.autoResetAfterPlay='1')
				// 才走 900ms 缓动回 0(旧 WP-3 行为);连播不再依赖此块——playRow 起手自带 300ms 回 0 衔接。
				let autoReset = false;
				try{ autoReset = localStorage.getItem('horosa.pdsphere.autoResetAfterPlay') === '1'; }catch(_){ }
				if(autoReset){
					const fromY = this.dirGroup.rotation.y;
					if(Math.abs(fromY) > 1e-6){
						const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 600; // 停留 0.6s 再回
						const backStep = ()=>{
							if(this.disposed || token !== this._playToken){ return; }
							const now2 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
							if(now2 < t1){ window.requestAnimationFrame(backStep); return; }
							const k = Math.min(1, (now2 - t1) / 900);
							this.dirGroup.rotation.y = fromY * (1 - easeInOutCubic(k));
							this.wake(1);
							if(k < 1){ window.requestAnimationFrame(backStep); }
						};
						window.requestAnimationFrame(backStep);
					}
				}
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	}

	/** 时间轴拖拽落点:选行后直接补间到该行弧位(600ms,无尾迹/脉冲 —— 播放专属观感不稀释) */
	rotateToRow(idx){
		const sel = this.selectRow(idx);
		if(!sel){
			return;
		}
		const target = promRotationRad(sel.row);   // [D2] 迫星旋转角(族定号序;应星固定)
		this._playToken += 1;
		const token = this._playToken;
		const from = this.dirGroup.rotation.y;
		const t0 = performance.now();
		const dur = 600;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			this.dirGroup.rotation.y = from + (target - from) * easeInOutCubic(t);
			const selNow = this._selection;
			if(selNow && selNow.progressLine && Math.abs(target) > 1e-9){
				const frac = Math.max(0, Math.min(1, this.dirGroup.rotation.y / target));
				selNow.progressLine.geometry.setDrawRange(0, Math.floor(frac * selNow.pathSegs) + 1);
			}
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	}

	/** 复位:天球转回 0 位(选择保留) */
	// [WP-5.4] 导出附图用:render 后同步读帧(WebGL preserveDrawingBuffer=false 下唯一可靠路)。
	// stub renderer(jsdom smoke)无真 toDataURL → 守卫返 null,由截图链降级,绝不抛。
	captureFrame(){
		try{
			const el = this.renderer && this.renderer.domElement;
			if(!el || typeof el.toDataURL !== 'function'){
				return null;
			}
			this.renderer.render(this.scene, this.camera);
			const dataUrl = el.toDataURL('image/png');
			if(!dataUrl || dataUrl.length < 2000){
				return null;
			}
			return { dataUrl, width: el.width || 0, height: el.height || 0 };
		}catch(e){
			return null;
		}
	}

	resetRotation(){
		this._playToken += 1;
		const token = this._playToken;
		// [WP-B] 复位=回本命姿态:同时清「走过的路」轨迹线(原漏清——复位后轨迹残留在 0 姿态上错位)。
		const selNow = this._selection;
		if(selNow && selNow.progressLine){
			selNow.progressLine.geometry.setDrawRange(0, 0);
		}
		this._setBeaconEmphasis(false); // [WP-A] 复位浮标回淡显
		// [WP-A] 复位同时回正视角到当前档默认位(带缓动;视角=观感的一部分,复位应一并归位)
		this.applyViewMode(this.viewMode, true);
		const from = this.dirGroup ? this.dirGroup.rotation.y : 0;
		if(!this.dirGroup || Math.abs(from) < 1e-9){
			return;
		}
		const t0 = performance.now();
		const dur = 500;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			this.dirGroup.rotation.y = from * (1 - easeInOutCubic(t));
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	}

	// —— 尾迹:播放中逐帧记录迫星活动标世界位(观测者系),顶点色头亮尾黑=渐隐观感 ——
	_trailInit(conv){
		this._clearTrail();
		this._trail = {
			pts: [],
			color: new THREE.Color(conv ? PD_COLOR.converse : PD_COLOR.direct),
			line: null,
		};
	}

	_trailAppend(){
		if(!this._trail || !this._selection || !this._selection.marker){
			return;
		}
		const v = new THREE.Vector3();
		this._selection.marker.getWorldPosition(v);
		const pts = this._trail.pts;
		pts.push(v);
		if(pts.length > 420){
			pts.shift();
		}
		if(pts.length < 2){
			return;
		}
		// 逐帧重建折线(≤420 顶点,播放期专属开销;LineBasicMaterial 顶点色:黑底上
		// 头亮尾黑 + additive = 透明度衰减观感,免自定义 shader)
		if(this._trail.line){
			this.selGroup.remove(this._trail.line);
			this._disposeObject(this._trail.line);
		}
		const n = pts.length;
		const positions = new Float32Array(n * 3);
		const colors = new Float32Array(n * 3);
		for(let i = 0; i < n; i += 1){
			positions[i * 3] = pts[i].x;
			positions[i * 3 + 1] = pts[i].y;
			positions[i * 3 + 2] = pts[i].z;
			const k = n > 1 ? (i / (n - 1)) : 1;   // 头(新)=1,尾(旧)→0
			colors[i * 3] = this._trail.color.r * k;
			colors[i * 3 + 1] = this._trail.color.g * k;
			colors[i * 3 + 2] = this._trail.color.b * k;
		}
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		}));
		this._trail.line = line;
		this.selGroup.add(line);
	}

	_trailFade(token){
		if(!this._trail || !this._trail.line){
			return;
		}
		const material = this._trail.line.material;
		const t0 = performance.now();
		const dur = 900;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			if(material){
				material.opacity = 0.9 * (1 - t);
			}
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				this._clearTrail();
				this.wake(1);
			}
		};
		window.requestAnimationFrame(step);
	}

	_clearTrail(){
		if(this._trail && this._trail.line){
			this.selGroup.remove(this._trail.line);
			this._disposeObject(this._trail.line);
		}
		this._trail = null;
	}

	// —— t=1 应星位置圈脉冲:sin²(2πt) 包络恰 2 个峰;Tube 走真 emissiveIntensity,
	//    Line(采样折线/细弧,LineBasicMaterial 无 emissive 通道)等效走颜色提白 ——
	_pulseSelection(token){
		if(!this._selection || !this._selection.pulseTargets.length){
			return;
		}
		const targets = this._selection.pulseTargets;
		const white = new THREE.Color(0xffffff);
		const t0 = performance.now();
		const dur = 1100;
		this._tweenActive = true;
		const step = ()=>{
			if(this.disposed){
				this._tweenActive = false;
				return;
			}
			if(token !== this._playToken){
				return;
			}
			const t = Math.min(1, (performance.now() - t0) / dur);
			const envelope = Math.pow(Math.sin(TWO_PI * t), 2);   // t∈[0,1] 峰在 0.25/0.75 → 2 次脉冲
			targets.forEach((tg)=>{
				if(!tg.material){
					return;
				}
				if(tg.mode === 'emissive'){
					tg.material.emissiveIntensity = 1 + 1.8 * envelope;
				}else if(tg.material.color){
					const base = new THREE.Color(tg.baseColor);
					tg.material.color.copy(base.lerp(white, envelope * 0.85));
				}
			});
			if(t < 1){
				window.requestAnimationFrame(step);
			}else{
				this._tweenActive = false;
				targets.forEach((tg)=>{
					if(!tg.material){
						return;
					}
					if(tg.mode === 'emissive'){
						tg.material.emissiveIntensity = 1;
					}else if(tg.material.color && tg.baseColor !== undefined){
						tg.material.color.setHex(tg.baseColor);
					}
				});
				this.wake(1);
			}
		};
		this.wake(2);
		window.requestAnimationFrame(step);
	}

	// —— 头顶标签卡:direct=金 / converse=青(labelSprite billboard,恒面向相机) ——
	_showLabelCard(text, conv){
		this._removeLabelCard();
		if(!text){
			return;
		}
		const sprite = makeTextSprite(text, {
			worldSize: Math.max(9, this.radius * 0.07),
			color: conv ? PD_COLOR.converse : PD_COLOR.direct,
			glow: true,
		});
		sprite.position.set(0, this.radius * 1.24, 0);
		this.selGroup.add(sprite);
		this._labelCard = sprite;
		// 播放 + 脉冲结束后自动撤卡(最长弧 4s + 脉冲 1.1s + 余量)
		this._labelTimer = setTimeout(()=>{
			this._removeLabelCard();
			this.wake(1);
		}, 6200);
	}

	_removeLabelCard(){
		if(this._labelTimer){
			clearTimeout(this._labelTimer);
			this._labelTimer = null;
		}
		if(this._labelCard){
			if(this._labelCard.parent){
				this._labelCard.parent.remove(this._labelCard);
			}
			this._disposeObject(this._labelCard);
			this._labelCard = null;
		}
	}

	// —— 释放(disposeGroupDeep 口径:geometry/material/贴图全释放,幂等安全) ——
	_disposeObject(obj){
		if(!obj){
			return;
		}
		if(obj.traverse){
			obj.traverse((node)=>{
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
		}
	}

	_clearGroup(grp){
		// children 非真数组(jest three-stub 的 Proxy 属性恒 truthy → while 死循环;或异常形态)直接跳过——
		// 生产 children 恒为数组,零语义变。
		if(!grp || !Array.isArray(grp.children)){
			return;
		}
		this._disposeObject(grp);
		while(grp.children.length){
			grp.remove(grp.children[0]);
		}
	}

	dispose(){
		this.disposed = true;
		this._playToken += 1;
		this._tweenActive = false;
		// [WP-D] 拾取监听清理(同 OrbitControls 教训:不摘会闭包吊住引擎)+星空层卸载
		if(this.renderer && this.renderer.domElement && typeof this.renderer.domElement.removeEventListener === 'function'){
			if(this._onPickMove){ this.renderer.domElement.removeEventListener('pointermove', this._onPickMove); }
			if(this._onPickClick){ this.renderer.domElement.removeEventListener('click', this._onPickClick); }
			// [P2] 球心档环视监听同拆
			const el = this.renderer.domElement;
			if(this._onCenterDown){ el.removeEventListener('pointerdown', this._onCenterDown); }
			if(this._onCenterMove){ el.removeEventListener('pointermove', this._onCenterMove); }
			if(this._onCenterUp){
				el.removeEventListener('pointerup', this._onCenterUp);
				el.removeEventListener('pointerleave', this._onCenterUp);
			}
			if(this._onCenterWheel){ el.removeEventListener('wheel', this._onCenterWheel); }
		}
		if(this._starfield){
			this._clearGroup(this._starfield);
			if(this.root && this.root.remove){ this.root.remove(this._starfield); }
			this._starfield = null;
		}
		if(this._labelTimer){
			clearTimeout(this._labelTimer);
			this._labelTimer = null;
		}
		if(this.rafId){
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.clearSelection();
		this._clearGroup(this.skyGroup);
		this._clearGroup(this.frameGroup);
		this._clearGroup(this.selGroup);
		this.pointMeshMap.clear();
		if(this.orbits && this.orbits.dispose){
			// OrbitControls 的 pointer/wheel 监听不释放会闭包吊住整个引擎实例(Astro3D 同教训)
			this.orbits.dispose();
		}
		if(this.renderer){
			if(this.renderer.domElement){
				this.renderer.domElement.removeEventListener('webglcontextlost', this._onCtxLost, false);
				this.renderer.domElement.removeEventListener('webglcontextrestored', this._onCtxRestored, false);
				if(this.renderer.domElement.parentNode){
					this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
				}
			}
			this.renderer.dispose();
			this.renderer = null;
		}
	}

	// —— 按需渲染状态机(Astro3D WS-0 同构:idle 停 rAF;新引擎恒按需,无旧行为包袱) ——
	wake(frames = 1){
		this._wakeFrames = Math.max(this._wakeFrames || 0, frames);
		if(this.rafId === null || this.rafId === undefined){
			if(!this.disposed){
				// 🔴 不可同步调 animate():render→orbits.update() 在阻尼下同步派发 'change'
				// 再进 wake,同步链上 rafId 恒为 null → 无限递归栈爆(与 Astro3D.wake 同款病,
				// 同款修法:先占位 rafId 再入帧,同步 re-entry 被上方判断挡住)。
				this.rafId = window.requestAnimationFrame(()=>{
					this.animate();
				});
			}
		}
	}

	needsFrames(){
		if(this._tweenActive){
			return true;
		}
		return (this._wakeFrames || 0) > 0;
	}

	animate(){
		if(this.disposed){
			this.rafId = null;
			return;
		}
		if(!this._contextLost){
			this.render();
		}
		if(this._wakeFrames > 0){
			this._wakeFrames -= 1;
		}
		if(!this.needsFrames()){
			this.rafId = null;   // idle:停 rAF(交互/播放/数据变化会再 wake 拉起)
			return;
		}
		this.rafId = window.requestAnimationFrame(()=>{
			this.animate();
		});
	}

	render(){
		if(!this.renderer){
			return;
		}
		// 🔴 [P2 实爆根因] 球心档必须跳过 OrbitControls.update():其每帧「半径钳回 minDistance(1.15R)
		// + lookAt(球心)」会把居于球心的相机顶出到天顶方向 1.15R 俯视原点(真机=「天顶」大白点居中、
		// 几何全错),并逐帧清洗自定义环视旋转(=拖不动)。enabled=false 只拦输入不拦 update()。
		if(this.orbits && this.viewMode !== 'center'){
			this.orbits.update();
		}
		this.renderer.render(this.scene, this.camera);
	}

}

export default PDSphereEngine;
