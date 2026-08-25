import * as THREE from 'three';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// DRACOLoader 走本仓 patched 副本:r0.185 原件顶部用 import.meta.url(webpack4 不支持,
// 编译直接炸);本仓恒 setDecoderPath 指 public/gltf/draco,默认 URL 无用武之地。
import { DRACOLoader } from './vendor/DRACOLoader';
import Stats from 'three/examples/jsm/libs/stats.module';
// three r0.185(2026-07 升级):dat.gui.module 已随 three 移除,lil-gui 是官方后继(API 兼容
// dat.GUI 的 addFolder/add/onChange 面);WS-1 将全废此面板换 xq-ui,此为升级过渡。
import GUI from 'three/examples/jsm/libs/lil-gui.module.min';
// Font/TextGeometry 自 r133 移出核心:Font 在 FontLoader 模块,TextGeometry 独立模块。
// (WS-1 标签系统换 sprite atlas 后此二者退役。)
import { Font } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import ywastrochart from '../../assets/ywastrochart.json';
import helvetica from '../../assets/helvetica.json';
import * as AstroConst from '../../constants/AstroConst';
import { astro3dOnDemandEnabled, astro3dSpriteLabelsEnabled, astro3dMorphEnabled } from '../../utils/perfFlags';
// 球面摆点公共式(WS-0 抽取,原 6+ 处逐字重复;零依赖纯模块=jest 可测,WS-3 赤道系复用)
import { sph } from './sphMath';
// WS-1b 改时间滑移补间:最短弧/归一化/缓动纯数学(零依赖模块=jest 可测)
import { norm360, shortestArcDelta, easeInOutCubic } from './morphMath';
// WS-1 标签换代:canvas sprite(1 quad/标签,billboard 恒可读);flag 关=旧 TextGeometry
import { makeTextSprite, ensureAstroFont, makeStarSprite } from './labelSprite';
// WS-2 全行星中心盘:通用行星中心盘场景构建器(一个类吃全部非地心中心)
import PlanetocentricMode from './PlanetocentricMode';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import { setLoading, setLoadingText,} from '../../utils/request';
import { getAzimuthStr } from '../../utils/helper';
import { calcNormalVector, } from '../graph/GraphHelper';
import styles from './astro3d.less';

const PosOffset = {
	DefaultOffset: 6,
};

PosOffset[AstroConst.SUN] = 12;
PosOffset[AstroConst.MOON] = 3;
PosOffset[AstroConst.MERCURY] = 8;
PosOffset[AstroConst.VENUS] = 6;
PosOffset[AstroConst.MARS] = 10;
PosOffset[AstroConst.JUPITER] = 14.2;
PosOffset[AstroConst.SATURN] = 18.5;
PosOffset[AstroConst.URANUS] = 22.2;
PosOffset[AstroConst.NEPTUNE] = 26.1;
PosOffset[AstroConst.PLUTO] = 28.1;
PosOffset[AstroConst.CHIRON] = 12;
PosOffset[AstroConst.NORTH_NODE] = 5;
PosOffset[AstroConst.SOUTH_NODE] = 5;
PosOffset[AstroConst.SYZYGY] = 5;
PosOffset[AstroConst.PARS_FORTUNA] = PosOffset.DefaultOffset;
PosOffset[AstroConst.DARKMOON] = 4;
PosOffset[AstroConst.PURPLE_CLOUDS] = 2;
PosOffset[AstroConst.PHOLUS] = 13;
PosOffset[AstroConst.CERES] = 13;
PosOffset[AstroConst.PALLAS] = 13;
PosOffset[AstroConst.JUNO] = 13;
PosOffset[AstroConst.VESTA] = 13;
PosOffset[AstroConst.INTP_APOG] = 13;
PosOffset[AstroConst.INTP_PERG] = 13;

function getPosOffset(name){
	let offset = PosOffset[name];
	if(offset){
		return offset;
	}
	return PosOffset.DefaultOffset;
}

const PlanetRadius = {
	DefaultR: 8,
	Earth: 120,
}
PlanetRadius[AstroConst.SUN] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MOON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MERCURY] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.VENUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MARS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.JUPITER] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SATURN] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.URANUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.NEPTUNE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PLUTO] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.CHIRON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.NORTH_NODE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SOUTH_NODE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SYZYGY] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PARS_FORTUNA] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.DARKMOON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PURPLE_CLOUDS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PHOLUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.CERES] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PALLAS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.JUNO] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.VESTA] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.INTP_APOG] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.INTP_PERG] = PlanetRadius.DefaultR;

function getPlanetRadius(name){
	let r = PlanetRadius[name];
	if(r){
		return r;
	}
	return PlanetRadius.DefaultR;
}

// WS-1b:补间共用 Y 轴(黄道北极方向);setFromAxisAngle 不修改轴向量,可安全共享
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function traverseMaterials (object, callback) {
	object.traverse((node) => {
		if (!node.isMesh) return;
		const materials = Array.isArray(node.material) ? node.material : [node.material];
		materials.forEach(callback);
	});
}


const ChartOptKey = 'chart3dOpt';
const ModelUnavailableAtKey = 'horosa3dModelUnavailableAt';
const ModelUnavailableCooldown = 10 * 60 * 1000;

function getStorageValue(storage, key){
	if(!storage){
		return '';
	}
	try{
		return storage.getItem(key) || '';
	}catch(err){
		return '';
	}
}

function setStorageValue(storage, key, value){
	if(!storage){
		return;
	}
	try{
		storage.setItem(key, value);
	}catch(err){
		// ignore storage exceptions
	}
}

function removeStorageValue(storage, key){
	if(!storage){
		return;
	}
	try{
		storage.removeItem(key);
	}catch(err){
		// ignore storage exceptions
	}
}

function getModelUnavailableAt(){
	if(typeof window === 'undefined'){
		return 0;
	}
	// 🔴 冷却只认 session 级:模型是本地静态资源,失败=瞬时故障(dev/后端重启、首启 race),
	// localStorage 级长冷却会把一次 8s 超时钉死成「之后每次进页都满天 TextGeometry 简化模式」
	// (实爆:被当成「3D 盘改坏了」)。localStorage 旧标记视为遗留脏数据,读到即清。
	removeStorageValue(window.localStorage, ModelUnavailableAtKey);
	return Number(getStorageValue(window.sessionStorage, ModelUnavailableAtKey) || 0);
}

function markModelUnavailableNow(){
	if(typeof window === 'undefined'){
		return;
	}
	// 只写 sessionStorage(同上:冷却不跨会话)
	setStorageValue(window.sessionStorage, ModelUnavailableAtKey, `${Date.now()}`);
}

function clearModelUnavailableMark(){
	if(typeof window === 'undefined'){
		return;
	}
	removeStorageValue(window.localStorage, ModelUnavailableAtKey);
	removeStorageValue(window.sessionStorage, ModelUnavailableAtKey);
}

function shouldSkipModelLoad(){
	if(typeof navigator !== 'undefined' && navigator.onLine === false){
		return true;
	}
	const unavailableAt = getModelUnavailableAt();
	if(!unavailableAt){
		return false;
	}
	return (Date.now() - unavailableAt) < ModelUnavailableCooldown;
}
  
class Astro3D {
	constructor(option){
		this.maxCamDistRatio = 30;
		this.radiusOffset = 50;
		this.initOption(option);
		// 调试口(排障用,localStorage horosa.debug.astro3d=1 时暴露;与 Stats 门控同族)
		try{ if(typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('horosa.debug.astro3d') === '1'){ window.__astro3d = this; } }catch(e){ /* 忽略 */ }

		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.orbits = null;
		this.stats = null;
		this.group = null;
		this.skyGroup = null;
		this.earthGroup = null;
		this.lightGroup = null;
		this.gui = null;

		this.planetMap = new Map();
		this.planetEarthMap = new Map();
		this.planetMeshMap = new Map();

		this.starMap = new Map();
		this.beidouMap = new Map();
		this.su28Map = new Map();
		this.su28VirMap = new Map();
		this.beijiMap = new Map();

		this.starGroup = null;
		this.beidouGroup = null;
		this.beijiGroup = null;
		this.su28Group = null;
		this.su28VirGroup = null;
		this.doubingGroup = null;

		this.normalFont = new Font(helvetica);
		this.chartFont = new Font(ywastrochart);

		this.clips = [];
		this.mixer = null;

		this.earthMesh = null;
		this.earthAxes = null;
		this.doubingGroup = null;
		this.sunDirectLight = null;

		this.chartOpt = {
			maxEarthRadius: this.radius - 20,
			'地球自转轴': false,
			'有云地球': true,
			'隐藏地球': false,
			'隐藏地球附近星体': true,
			'地球半径': PlanetRadius.Earth,
			'星盘背景': AstroConst.Astro3DColor.ChartBackgroud,
			'纹理编码': 'sRGB',
			'太阳光颜色': 0xffffff,
			'天球线条颜色': '#ff0000',
			'太阳光强度': 6.5,
			'环境光颜色': 0xffffff,
			'环境光强度': 0.3,
			'文本颜色': AstroConst.Astro3DColor.TextStroke,
			'恒星距离行星圈': 50,
			'恒星半径': 1.5,
			'使用虚拟28宿': false,
			'隐藏28宿距星': false,
			'隐藏北极和北斗': false,
			'隐藏其它恒星': false,
			'显示斗柄连线': false,
			'摄像机视野': 45,
			'摄像机旋转': false,
			'摄像机天球经度': 0,
			'摄像机天球纬度': 45,
			'摄像机与球心距离': this.radius * 3.5,
		};
		let json = localStorage.getItem(ChartOptKey);
		if(json){
			// 本地值损坏不能让 3D 视图挂载抛错 → 忽略走默认
			try{
				let opt = JSON.parse(json);
				if(opt && typeof opt === 'object'){
					this.chartOpt = {
						...this.chartOpt,
						...opt,
					};
				}
			}catch(e){ /* ignore */ }
		}
		this.chartOpt.maxEarthRadius = this.radius - 20;

		let dom = document.getElementById(this.chartId);
		this.planetHintDiv = document.createElement('div');
		this.planetHintDiv.className = styles.astro3dtap;
		dom.appendChild(this.planetHintDiv);

		this.disposed = false;
		this.rafId = null;

		// WS-2 多中心模式系统:'geo' 默认=现状零改;非 geo 时本命 group 隐藏、
		// PlanetocentricMode 覆盖组接管(setCenterMode('geo') 完全退出)
		this.chartMode = 'geo';
		this.pctrMode = null;         // 当前覆盖组(PlanetocentricMode 实例)
		this._pctrRetiring = null;    // 换系动画中淡出的旧覆盖组(收尾时释放)
		this._pctrShell = false;      // 半径档:false=sqrt 缩放(默认)/true=等半径壳层
		this._centerToken = 0;        // 换系动画接管令牌(快速连切时旧场即刻作废)
		this._centerTweenActive = false;   // 换系动画独立帧预算(不借共享 _tweenActive)

		this.mouseVec = new THREE.Vector2();
		this.clickHandler = this.clickHandler.bind(this);
		this.touchHandler = this.touchHandler.bind(this);
	}

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
	}

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
	}

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
	}

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
	}

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
	}

	// —— WS-1b 改时间滑移补间(2026-07-16) ——
	// 病根:拨时间/步进 → chartObj 变 → needRecreate 全量 disposeMesh+重建(恒星/28宿/
	// 网格文本数百对象全部重造)= 卡顿 + 画面硬切跳变。
	// 修法:行星按新旧黄经差的最短弧 ~600ms easeInOutCubic tween 到位,宫轴组同旋、
	// ASC 整组同旋、太阳光/地球自转跟随;恒星/28宿层不重建(不随时间变,只随 ASC 整组
	// 旋转);相位线端点在动 → 起步撤线,终帧按新盘重建+淡入。终帧交账(宫轴/轴线/天球
	// 纬圈/地球系)走与全量重建同一批生成函数精确重建,零口径分叉。
	// 黄道制/宫位制/南北盘切换 = 坐标语义变化,仍走全量重建。

	/** 坐标语义字段读值(fields 形态 {key:{value}};缺省视为 undefined) */
	morphFieldVal(fields, key){
		if(!fields || !fields[key]){
			return undefined;
		}
		return fields[key].value;
	}

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
	}

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
	}

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
	}

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
		this.group.rotation.y = (270 - asc) * DEG;
		this.group.userData._vAscLon = norm360(asc);
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
	}

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
	}

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
	}

	/** 终帧交账:天球纬圈组(含 ASC/MC 黄纬特征圈)按新盘重建 */
	rebuildSkyLat(){
		if(this.skyLatGroup && this.skyLatGroup.parent){
			this.skyLatGroup.parent.remove(this.skyLatGroup);
			this.disposeGroupDeep(this.skyLatGroup);
		}
		this.skyLatGroup = this.initLatLine(this.radius, AstroConst.Astro3DColor.SkyLine, true);
		this.skyGroup.add(this.skyLatGroup);
	}

	/** 撤下全部相位线(补间起步用;组保留在 skyGroup 挂点上) */
	clearAspects(){
		if(this.aspectGroup){
			this.disposeGroupDeep(this.aspectGroup);
			this.aspectGroup.children = [];
		}
	}

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
	}

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
	}

	resize(width, height){
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.wake(2);   // 唤醒源③:尺寸变化
	}

	transPosition(position) {
		let world_vector = new THREE.Vector3(position.x, position.y, position.z);
		let vector = world_vector.project(this.camera);
		let halfWidth = this.width / 2;
		let halfHeight = this.height / 2;
		return {
			x: Math.round(vector.x * halfWidth + halfWidth),
			y: Math.round(-vector.y * halfHeight + halfHeight)
		};
	}

	calcMousePoint(){
		if(this.disposed){
			return;
		}
		let ary = this.getPlanetsAry();
		let raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(this.mouseVec, this.camera);
		let intersects = raycaster.intersectObjects(ary);
		// 🔴 命中列表按 distance 升序;曾 forEach 全遍历、每次整体重写提示卡 →
		// 最后一次(最远的那颗)胜出,重叠天体点选恒显被挡住的那个。改为取首个有效命中即停。
		let hinted = false;
		for(let i = 0; i < intersects.length; i++){
			if(this.showPlanetHint(intersects[i]) !== false){
				hinted = true;
				break;
			}
		}
		if(!hinted){
			this.hidePlanetHint();
		}
	}

	showPlanetHint(obj){
		let vec = obj.point;
		// raycast 可能命中程序化星体的子件(光晕 sprite/glyph 名牌,Group 结构)——沿 parent 链
		// 上溯取 planet;拾到纯装饰件或无黄经数据(signlon 缺失)的对象时静默跳过,不出提示卡。
		let node = obj.object;
		let planet = null;
		while(node && (planet === undefined || planet === null)){
			planet = node.planet;
			node = node.parent;
		}
		if(planet === undefined || planet === null || planet.signlon === undefined || planet.signlon === null){
			return false;   // 纯装饰件/无数据 → 让调用方继续找下一个命中
		}
		let degparts = AstroHelper.splitDegree(planet.signlon);
		let ntxt = AstroText.AstroMsgCN[planet.id];
		if(ntxt === undefined || ntxt === null){
			ntxt = planet.name ? planet.name : planet.id;
		}
		if(planet.animal){
			ntxt = ntxt + planet.animal;
		}
		if(planet.isBeiji){
			ntxt = '北极星，' + ntxt;
		}
		// WS-1b:信息卡结构化 —— 标题(星名)+副行(星座度数)+明细行(标签/数值两端对齐);
		// 数据口径与旧卡逐字一致(千分度圆整/getAzimuthStr),只换排版与主题化样式。
		let signTxt = AstroText.AstroMsgCN[planet.sign];
		let degLine = (signTxt !== undefined && signTxt !== null)
			? `${signTxt}座 ${degparts[0]}º${degparts[1]}'`
			: `${degparts[0]}º${degparts[1]}'`;
		const fmtDeg = (v)=>`${Math.round(v*1000)/1000}º`;
		const row = (label, value)=>`<li><span>${label}</span><span>${value}</span></li>`;
		// WS-2:多中心盘天体无地平量(非地心中心物理上无地平)——undefined 字段整行跳过;
		// 地心盘字段齐全,degRow 输出与旧 row 逐字一致(零行为变化)
		const degRow = (label, v)=>((v === undefined || v === null || Number.isNaN(v)) ? '' : row(label, fmtDeg(v)));
		let rows = degRow('黄经', planet.lon)
			+ degRow('黄纬', planet.lat)
			+ degRow('赤经', planet.ra)
			+ degRow('赤纬', planet.decl)
			+ degRow('真地平纬度', planet.altitudeTrue)
			+ degRow('视地平纬度', planet.altitudeAppa)
			+ ((planet.azimuth === undefined || planet.azimuth === null) ? '' : row('地平经度', getAzimuthStr(planet.azimuth)))
			+ ((planet.distAU === undefined || planet.distAU === null) ? '' : row('距离', `${Math.round(planet.distAU * 1000) / 1000} AU`));
		let dom = `<div class="${styles.astro3dtapTitle}">${ntxt}</div>`
			+ `<div class="${styles.astro3dtapDeg}">${degLine}</div>`
			+ `<ul>${rows}</ul>`;

		// ⚠️ [缩放域判定·2026-08-24] 此处**不需要** zoomDomain 换算,勿"顺手补齐"。
		// xy 来自 transPosition = THREE 投影到 canvas 内部像素(基于 this.width/height =
		// option.width/height,布局域);planetHintDiv 是 .astro3dtap{position:absolute},挂在
		// 同一 canvas 容器内 ⇒ 取值与写回同属 CSS 域,零跨域。加换算反而制造新错位。
		let xy = this.transPosition(vec);
		let w = 300;
		let h = 210;

		if(this.width - xy.x <= w){
			this.planetHintDiv.style.left = (xy.x - w) + 'px';
		}else{
			this.planetHintDiv.style.left = xy.x + 'px';
		}
		if(this.height - xy.y <= h){
			this.planetHintDiv.style.top = (xy.y - h) + 'px';
		}else{
			this.planetHintDiv.style.top = xy.y + 'px';
		}
		this.planetHintDiv.style.width = w + 'px';
		// 高度自适应内容(卡片化后写死高度会留空白;上方翻转判断仍用估高 h)
		this.planetHintDiv.style.height = '';

		this.planetHintDiv.innerHTML = dom;
		this.planetHintDiv.style.display = 'block';

	}

	hidePlanetHint(){
		this.planetHintDiv.innerHTML = '';
		this.planetHintDiv.style = 'display:none;';
	}

	clickHandler(event){
		this.mouseVec.x = (event.offsetX / this.width) * 2 - 1;
		this.mouseVec.y = -(event.offsetY / this.height) * 2 + 1;
		this.calcMousePoint();
	}

	touchHandler(event){
		// 🔴 clientX/Y 是**视口**坐标,this.width/height 是**元素**尺寸 —— 曾直接相除,
		// 触屏命中判定恒偏画布左上角在页面中的位移(顶栏/侧栏高度)。
		// 与 clickHandler 的 offsetX/offsetY(元素内坐标)对齐:先减 rect 再按缩放归一。
		const dom = document.getElementById(this.chartId);
		const rect = dom && dom.getBoundingClientRect ? dom.getBoundingClientRect() : null;
		const t = event.changedTouches[0];
		const sx = rect && rect.width ? (this.width / rect.width) : 1;
		const sy = rect && rect.height ? (this.height / rect.height) : 1;
		const x = (t.clientX - (rect ? rect.left : 0)) * sx;
		const y = (t.clientY - (rect ? rect.top : 0)) * sy;
		this.mouseVec.x = (x / this.width) * 2 - 1;
		this.mouseVec.y = -(y / this.height) * 2 + 1;
		this.calcMousePoint();	
	}

	registerClick(){
		let dom = document.getElementById(this.chartId);
		dom.addEventListener('click', this.clickHandler);
		dom.addEventListener('touchend', this.touchHandler);
		// 唤醒源⑤:点击/触点(命中检测可能改选中态/hint,按需渲染下补帧)
		if(!this._wakeOnPointer){
			this._wakeOnPointer = ()=>this.wake(1);
		}
		dom.addEventListener('pointerdown', this._wakeOnPointer);
	}

	unregisterClick(){
		let dom = document.getElementById(this.chartId);
		dom.removeEventListener('click', this.clickHandler);
		dom.removeEventListener('touchend', this.touchHandler);
		if(this._wakeOnPointer){
			dom.removeEventListener('pointerdown', this._wakeOnPointer);
		}
	}

	playAllClips() {
		this.clips.forEach((clip) => {
			this.mixer.clipAction(clip).reset().play();
		});
	}

	init(){
		setLoading(true);

		// WS-1:占星字形字体预热(sprite 标签用;若首绘时未就绪,就绪后补帧重画由重建路径兜)
		ensureAstroFont().then(()=>this.wake(2));

		this.registerClick();
		this.hidePlanetHint();

		this.initScene();
		this.initCamera();
		this.initLight();
		this.initRenderer();
		this.initStats();

		this.initOrbit();

		this.disposed = false;
		this.animate();		

		if(shouldSkipModelLoad()){
			this.initMesh();
			this.initGUI();
			setLoadingText(null);
			setLoading(false);
			return;
		}

		const manager = new THREE.LoadingManager();
		let loader = new GLTFLoader(manager);
		loader.setCrossOrigin('*');
		const dracoLoader = new DRACOLoader();
		loader.setDRACOLoader( dracoLoader );
		// 3D 行星模型只从本地静态资源加载:历史远端模型源已下线,且桌面版承诺
		// 排盘功能零额外出站(隐私政策·网络说明的据实基础)。本地缺模型文件时
		// 由 loader error 立即降级简化模式,不再有远端重试/等待。
		const localSource = {
			name: 'local',
			modelUrl: './gltf/planets4k.glb',
			decoderPath: './gltf/draco/',
		};
		const modelSources = [localSource];
		let sourceIdx = 0;
		let settled = false;
		let timeoutId = setTimeout(()=>{
			if(settled){
				return;
			}
			settled = true;
			markModelUnavailableNow();
			this.initMesh();
			this.initGUI();
			this.wake(2); // 按需渲染:异步降级重建后必须唤醒,否则 idle 停帧=黑屏
			console.info('3D model loading timeout, fallback to simplified mode.');
			setLoadingText(null);
			setLoading(false);
		}, 8000);
		const loadModel = ()=>{
			if(settled){
				return;
			}
			const source = modelSources[sourceIdx];
			dracoLoader.setDecoderPath(source.decoderPath);
			loader.load(
				source.modelUrl,
				(gltf)=>{
					if(settled){
						return;
					}
					settled = true;
					clearTimeout(timeoutId);
					clearModelUnavailableMark();
					let scene = gltf.scene || gltf.scenes[0];
					scene.children.map((item, idx)=>{
						let name = item.name;
						if(item instanceof THREE.Mesh){
							this.planetMeshMap.set(name, item);
						}
					});

					this.clips = gltf.animations || [];
					if(this.mixer){
						this.mixer.stopAllAction();
						this.mixer.uncacheRoot(this.mixer.getRoot());
						this.mixer = null;			  
					}
					if(this.clips.length){
						this.mixer = new THREE.AnimationMixer(this.scene);
					}

					this.initMesh();
					this.initGUI();
					this.wake(2); // 按需渲染:模型异步就绪重建后唤醒
					setLoadingText(null);
					setLoading(false);
				},
				(xhr)=>{
					if(settled){
						return;
					}
					let val = 0;
					if(xhr.total){
						val = xhr.loaded / xhr.total * 100;
					}
					let txt = (Math.round(val * 1000) / 1000 ) + '% loaded';
					if(xhr.total && xhr.loaded === xhr.total){
						setLoadingText(null);
					}else{
						setLoadingText(txt);
					}
				},
				(err)=>{
					if(settled){
						return;
					}
					console.info(`[Astro3D] load from ${source.name} failed`, err);
					sourceIdx += 1;
					if(sourceIdx < modelSources.length){
						loadModel();
						return;
					}
					settled = true;
					clearTimeout(timeoutId);
					markModelUnavailableNow();
					this.initMesh();
					this.initGUI();
					this.wake(2); // 按需渲染:加载失败降级重建后唤醒
					console.info('3D model unavailable, fallback to simplified mode.');
					setLoadingText(null);
					setLoading(false);
				}
			);
		};
		loadModel();

	}

	disposeGroup(grp){
		grp.children.map((item, idx)=>{
			item.traverse((itm)=>{
				// 星体对象可为 Mesh/Sprite/Group(glyph sprite 化后):逐项守卫深清理,
				// Sprite 的 CanvasTexture 一并释放(防反复出盘攒纹理泄漏)
				if(itm.geometry){ itm.geometry.dispose(); }
				if(itm.material){
					if(itm.material.map && itm.material.map.dispose){ itm.material.map.dispose(); }
					itm.material.dispose();
				}
			});
		});
	}

	disposeMesh(){
		this.disposed = true;
		if(this.mixer){
			this.mixer.stopAllAction();
		}

		this.disposeGroup(this.group);

		this.skyGroup.children = [];
		this.earthGroup.children = [];
		this.lightGroup.children = [];
		this.group.remove(this.skyGroup);
		this.group.remove(this.earthGroup);
		this.group.remove(this.lightGroup);

		if(!this.chartOpt['显示斗柄连线']){
			this.disposeGroup(this.doubingGroup);	
			this.doubingGroup.children = [];
		}
		if(this.chartOpt['隐藏28宿距星']){
			this.disposeGroup(this.su28Group);	
			this.su28Group.children = [];
			this.disposeGroup(this.su28VirGroup);	
			this.su28VirGroup.children = [];
		}
		if(this.chartOpt['隐藏北极和北斗']){
			this.disposeGroup(this.beidouGroup);	
			this.disposeGroup(this.beijiGroup);	
			this.beidouGroup.children = [];
			this.beijiGroup.children = [];
		}
		if(this.chartOpt['隐藏其它恒星']){
			this.disposeGroup(this.starGroup);	
			this.starGroup.children = [];
		}
		this.group.remove(this.su28Group);
		this.group.remove(this.su28VirGroup);
		this.group.remove(this.beidouGroup);
		this.group.remove(this.beijiGroup);
		this.group.remove(this.starGroup);
		this.group.remove(this.doubingGroup);

		this.group.children = [];
		this.scene.remove(this.group);

		this.beijiMap.clear();	
		this.beidouMap.clear();	
		this.su28Map.clear();	
		this.su28VirMap.clear();	
		this.starMap.clear();	
		this.planetMap.clear();	
		this.planetEarthMap.clear();	
	}

	disposeEarth(){
		if(this.mixer){
			this.mixer.stopAllAction();
		}

		this.earthGroup.children.map((item, idx)=>{
			item.traverse((itm)=>{
				if(itm instanceof THREE.Mesh){
					itm.geometry.dispose();
					itm.material.dispose();
				}	
			});
		});	
		this.earthGroup.children = [];
		this.group.remove(this.earthGroup);

		this.earthGroup = new THREE.Group();
		this.group.add(this.earthGroup);

		this.planetEarthMap.forEach((mesh)=>{
			this.skyGroup.remove(mesh);
			// 行星对象现可为 Sprite/Group(glyph 本体+太阳晕),不再恒是 Mesh —— traverse
			// 深清理并逐项守卫,防 .geometry 不存在时崩(实爆:「有云地球」开关触发 initEarth)
			mesh.traverse((itm)=>{
				if(itm.geometry){ itm.geometry.dispose(); }
				if(itm.material){
					if(itm.material.map){ itm.material.map.dispose(); }
					itm.material.dispose();
				}
			});
		});
		this.planetEarthMap.clear();
	}

	dispose(){
		this.disposed = true;
		if(this.rafId){
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		// WS-2:覆盖组(含换系动画中的退休组)整链释放 —— sprite canvas 纹理
		// 只有 PlanetocentricMode.disposeDeep 认得,必须先于 disposeGroup(scene)
		this.disposePctr();
		this.unregisterClick();
		if(this.mixer){
			this.mixer.stopAllAction();
			this.mixer.uncacheRoot(this.mixer.getRoot());
			this.mixer = null;			  	
		}

		if(this.scene){
			this.disposeGroup(this.scene);	

			if(!this.chartOpt['显示斗柄连线']){
				this.disposeGroup(this.doubingGroup);	
				this.doubingGroup.children = [];
			}
			if(this.chartOpt['隐藏地球'] && this.earthMesh){
				this.earthMesh.geometry.dispose();
				this.earthMesh.material.dispose();
				this.earthMesh = null;
			}
			if(!this.chartOpt['地球自转轴'] && this.earthAxes &&
				this.earthAxes.geometry && this.earthAxes.material){
				this.earthAxes.geometry.dispose();
				this.earthAxes.material.dispose();
				this.earthAxes = null;
			}
			if(this.chartOpt['隐藏28宿距星']){
				this.disposeGroup(this.su28Group);	
				this.su28Group.children = [];
				this.disposeGroup(this.su28VirGroup);	
				this.su28VirGroup.children = [];
			}
			if(this.chartOpt['隐藏北极和北斗']){
				this.disposeGroup(this.beidouGroup);	
				this.disposeGroup(this.beijiGroup);	
				this.beidouGroup.children = [];
				this.beijiGroup.children = [];
			}
			if(this.chartOpt['隐藏其它恒星']){
				this.disposeGroup(this.starGroup);	
				this.starGroup.children = [];
			}
	
		}
		if(this.renderer){
			this.renderer.dispose();
			this.renderer.forceContextLoss();
		}
		if(this.orbits && this.orbits.dispose){
			this.orbits.dispose();   // OrbitControls 在 canvas 上挂的 pointer/wheel/contextmenu 监听器,不释放则闭包吊住整个 Astro3D 实例,连带其图形资源不被 GC
			this.orbits = null;
		}
		if(this.gui && this.gui.destroy){ this.gui.destroy(); this.gui = null; }
		if(this.stats && this.stats.dom && this.stats.dom.parentNode){ this.stats.dom.parentNode.removeChild(this.stats.dom); }
		this.stats = null;
		this.planetMeshMap.forEach((itm)=>{
			itm.geometry.dispose();
			itm.material.dispose();
		});
		this.beijiMap.clear();	
		this.beidouMap.clear();	
		this.su28Map.clear();	
		this.su28VirMap.clear();	
		this.starMap.clear();	
		this.planetMeshMap.clear();
		this.planetMap.clear();	
		this.planetEarthMap.clear();	
	}

	// —— WS-1:设置项统一应用入口(dat/lil-gui 面板与右栏 xq-ui 面板共用) ——
	// 写 chartOpt → 持久化 → 按 key 应用到场景 → 补帧。外部(React 面板)只调本方法,
	// 绝不直改 chartOpt(应用逻辑单源,防两面板行为分叉)。
	applyOption(key, val){
		this.chartOpt[key] = val;
		safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt));
		const toHex = (v)=>{
			if(typeof v === 'string'){ return parseInt(v.replace('#', ''), 16); }
			return v;
		};
		switch(key){
			case '摄像机旋转': this.orbits.autoRotate = val; break;
			case '摄像机视野': this.camera.fov = val; this.camera.updateProjectionMatrix(); break;
			case '摄像机天球经度':
			case '摄像机天球纬度':
			case '摄像机与球心距离': this.setupCameraPos(); break;
			case '纹理编码': this.updateTextureEncoding(); break;
			case '地球半径':
			case '有云地球':
				this.initEarth();
				if(this.chartOpt['隐藏地球附近星体']){ this.hideEarthPlanets(); }
				break;
			case '隐藏地球': this.hideEarth(); break;
			case '地球自转轴': this.hideEarthAxes(); break;
			case '隐藏地球附近星体': this.hideEarthPlanets(); break;
			case '星盘背景': if(this.renderer){ this.renderer.setClearColor(val); } break;
			case '天球线条颜色':
				this.group.traverse((o)=>{ if(o.material && o.material.mtype === 'SkyGrid'){ o.material.color.setHex(toHex(val)); } });
				break;
			case '太阳光颜色':
				// 灯保留;可见效果 = 太阳晕 sprite 色调(SpriteMaterial.color tint 画布纹理)
				this.sunDirectLight.color.setHex(toHex(val));
				this.group.traverse((o)=>{ if(o.name === 'SunHalo' && o.material){ o.material.color.setHex(toHex(val)); } });
				break;
			case '太阳光强度':
				// 场内材质全为线框/精灵(不受光)——灯只对未来受光材质生效;可见效果接到太阳晕:
				// 默认 6.5 → opacity 1(封顶,零回归),向下拖 = 晕渐隐。
				this.sunDirectLight.intensity = val;
				this.group.traverse((o)=>{ if(o.name === 'SunHalo' && o.material){ o.material.opacity = Math.max(0, Math.min(1, val / 6.5)); } });
				break;
			case '环境光颜色':
				// 灯保留;可见效果 = 恒星/距星精灵色调 tint(整场星色氛围)
				this.lightGroup.children.forEach((item)=>{
					if(item.name === 'AmbientLight'){ item.color.setHex(toHex(val)); }
				});
				[this.starGroup, this.beidouGroup, this.beijiGroup, this.su28Group, this.su28VirGroup].forEach((g)=>{
					if(!g){ return; }
					g.traverse((o)=>{ if(o.isSprite && o.material){ o.material.color.setHex(toHex(val)); } });
				});
				break;
			case '环境光强度':
				// 同上:灯保留;可见效果接到恒星/距星精灵亮度(默认 0.7 → opacity 1 封顶零回归,向下=星点渐隐)。
				this.lightGroup.children.forEach((item)=>{
					if(item.name === 'AmbientLight'){ item.intensity = val; }
				});
				{
					const op = Math.max(0, Math.min(1, val / 0.7));
					[this.starGroup, this.beidouGroup, this.beijiGroup, this.su28Group, this.su28VirGroup].forEach((g)=>{
						if(!g){ return; }
						g.traverse((o)=>{ if(o.isSprite && o.material){ o.material.opacity = op; o.material.transparent = true; } });
					});
				}
				break;
			case '文本颜色':
				traverseMaterials(this.group, (material)=>{
					if(material.mtype === 'TextMesh'){ material.color.setHex(toHex(val)); }
				});
				// sprite 标签画布烧色:运行时以 SpriteMaterial.color tint 即时呈现(乘法混色近似);
				// 重出盘时 genText 读 chartOpt 全量按新色重绘(精确)。
				this.group.traverse((o)=>{ if(o.isSprite && o.material && o.material.mtype === 'TextSpriteMesh'){ o.material.color.setHex(toHex(val)); } });
				break;
			case '恒星距离行星圈': this.distStars(val); break;
			case '恒星半径': this.scaleStars(val); break;
			case '使用虚拟28宿': this.selectSu28(); break;
			case '隐藏28宿距星':
				if(this.chartOpt['使用虚拟28宿']){ this.hideStars(val, this.su28VirGroup); }
				else{ this.hideStars(val, this.su28Group); }
				break;
			case '隐藏北极和北斗': this.hideStars(val, this.beidouGroup, this.beijiGroup); break;
			case '隐藏其它恒星': this.hideStars(val, this.starGroup); break;
			case '显示斗柄连线': this.showDoubing(val); break;
			default: break;
		}
		this.wake(2);
	}

	initCameraGUI(){
		let folder = this.gui.addFolder('摄像机');
		let camrot = folder.add(this.chartOpt, '摄像机旋转');
		camrot.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.orbits.autoRotate = val;
		});

		let camfov = folder.add(this.chartOpt, '摄像机视野', 30 , 120);
		camfov.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.camera.fov = val;
			this.camera.updateProjectionMatrix();
		})

		let camlon = folder.add(this.chartOpt, '摄像机天球经度', 0 , 360);
		camlon.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

		let camlat = folder.add(this.chartOpt, '摄像机天球纬度', -90 , 90);
		camlat.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

		let camdist = folder.add(this.chartOpt, '摄像机与球心距离', this.radius * 2 , this.radius * this.maxCamDistRatio);
		camdist.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

	}

	initEarthGUI(){
		let earthFolder = this.gui.addFolder('地球');

		const encodingCtrl = earthFolder.add(this.chartOpt, '纹理编码', ['sRGB', 'Linear']);
		encodingCtrl.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.updateTextureEncoding();
		});

		let minR = getPlanetRadius(AstroConst.VENUS);
		let earthR = earthFolder.add(this.chartOpt, '地球半径', minR, this.chartOpt.maxEarthRadius);
		earthR.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.initEarth();
			if(this.chartOpt['隐藏地球附近星体']){
				this.hideEarthPlanets()
			}	
		});

		let cloud = earthFolder.add(this.chartOpt, '有云地球');
		cloud.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.initEarth();
			if(this.chartOpt['隐藏地球附近星体']){
				this.hideEarthPlanets()
			}	
		});

		let hideEarth = earthFolder.add(this.chartOpt, '隐藏地球');
		hideEarth.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarth()
		});

		let earthAx = earthFolder.add(this.chartOpt, '地球自转轴');
		earthAx.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarthAxes()
		});

		let hideEarthPlanets = earthFolder.add(this.chartOpt, '隐藏地球附近星体');
		hideEarthPlanets.onChange(()=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarthPlanets()
		});

	}

	initColorGUI(){
		let colorFolder = this.gui.addFolder('颜色');

		let bk = colorFolder.addColor(this.chartOpt, '星盘背景');
		bk.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			let color = val;
			if(this.renderer){
				this.renderer.setClearColor(color);
			}
		});

		let sunC = colorFolder.addColor(this.chartOpt, '太阳光颜色');
		sunC.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			let value = val;
			if ( typeof value === 'string' ) {
				value = value.replace( '#', '0x' );
			}
			this.sunDirectLight.color.setHex(value);
		});
		let sunIns = colorFolder.add(this.chartOpt, '太阳光强度', 0, 10);
		sunIns.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.sunDirectLight.intensity = val;
		});

		let ambC = colorFolder.addColor(this.chartOpt, '环境光颜色');
		ambC.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			let value = val;
			if ( typeof value === 'string' ) {
				value = value.replace( '#', '0x' );
			}
			this.lightGroup.children.map((item, idx)=>{
				if(item.name && item.name === 'AmbientLight'){
					item.color.setHex(value);
				}
			});
		});
		let ambIns = colorFolder.add(this.chartOpt, '环境光强度', 0, 2);
		ambIns.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.lightGroup.children.map((item, idx)=>{
				if(item.name && item.name === 'AmbientLight'){
					item.intensity = val;
				}
			});
		});

		let txtC = colorFolder.addColor(this.chartOpt, '文本颜色');
		txtC.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			let value = val;
			if ( typeof value === 'string' ) {
				value = value.replace( '#', '0x' );
			}
			traverseMaterials(this.group, (material) => {
				if (material.mtype && material.mtype === 'TextMesh'){
					material.color.setHex(value);
				} 
			});
		});

	}

	initStarGUI(){
		let starFolder = this.gui.addFolder('恒星');
		let starDist = starFolder.add(this.chartOpt, '恒星距离行星圈', 0, 500);
		starDist.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.distStars(val);
		});

		let starRadius = starFolder.add(this.chartOpt, '恒星半径', 0.5, 8);
		starRadius.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.scaleStars(val);
		});

		let su28Type = starFolder.add(this.chartOpt, '使用虚拟28宿');
		su28Type.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt));
			this.selectSu28();
		});

		let hideSu28 = starFolder.add(this.chartOpt, '隐藏28宿距星');
		hideSu28.onChange((val)=>{
			if(this.chartOpt['使用虚拟28宿']){
				this.hideStars(val, this.su28VirGroup);
			}else{
				this.hideStars(val, this.su28Group);
			}
		});

		let hideBeidou = starFolder.add(this.chartOpt, '隐藏北极和北斗');
		hideBeidou.onChange((val)=>{
			this.hideStars(val, this.beidouGroup, this.beijiGroup);
		});

		let hideStar = starFolder.add(this.chartOpt, '隐藏其它恒星');
		hideStar.onChange((val)=>{
			this.hideStars(val, this.starGroup);
		});

		let showDoubing = starFolder.add(this.chartOpt, '显示斗柄连线');
		showDoubing.onChange((val)=>{
			this.showDoubing(val);
		});

	}

	selectSu28(){
		let val = this.chartOpt['使用虚拟28宿'];
		this.group.remove(this.su28Group);
		this.group.remove(this.su28VirGroup);
		if(val){
			this.group.add(this.su28VirGroup);
		}else{
			this.group.add(this.su28Group);
		}
	}

	hideStars(val, group1, group2){
		safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt));
		if(group1){
			if(val){
				this.group.remove(group1);
			}else{
				let found = false;
				this.group.children.map((item, idx)=>{
					if(item === group1){
						found = true;
					}
				});
				if(!found){
					this.group.add(group1);
				}	
			}
		}

		if(group2){
			if(val){
				this.group.remove(group2);
			}else{
				let found = false;
				this.group.children.map((item, idx)=>{
					if(item === group2){
						found = true;
					}
				});
				if(!found){
					this.group.add(group2);
				}	
			}
		}
	}

	showDoubing(val){
		safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt));
		if(val){
			let found = false;
			this.group.children.map((item, idx)=>{
				if(item === this.doubingGroup){
					found = true;
				}
			});
			if(!found){
				this.group.add(this.doubingGroup);
			}	

		}else{
			this.group.remove(this.doubingGroup);
		}
	}

	initGUI(){
		// WS-1:显示设置迁右栏 xq-ui 面板(双主题,走 applyOption 单源)。
		// flag horosa.perf.astro3dXqPanel=0 → 回画布内 lil-gui 旧观感(下方旧路径整体保留)。
		let useXqPanel = true;
		try{
			useXqPanel = window.localStorage.getItem('horosa.perf.astro3dXqPanel') !== '0';
		}catch(e){ /* 默认新面板 */ }
		if(useXqPanel){
			this.gui = null;
			return;
		}
		this.gui = new GUI({
			width: 240,
			hideable: true,
		});
		// 唤醒源④:面板任意设置变化(lil-gui 的全局 onChange —— dat.GUI 无此 API,
		// 各 controller 自己的 onChange 只改场景数据,按需渲染下须补一帧)。
		if(typeof this.gui.onChange === 'function'){
			this.gui.onChange(()=>this.wake(2));
		}

		this.initCameraGUI();
		this.initEarthGUI();
		this.initColorGUI();
		this.initStarGUI();

		let dom = document.getElementById(this.chartId);
		dom.appendChild(this.gui.domElement);
		this.gui.domElement.style = 'position: absolute; right: 10px; top: 10px; z-index: 5;'
		this.gui.close();
	}

	distStars(val){
		let r = this.radius + val;
		const place = (star)=>{
			const p = sph(star.planet.lon, star.planet.lat, r);
			star.position.set(p.x, p.y, p.z);
		};
		this.beijiMap.forEach(place);
		this.starMap.forEach(place);
		this.su28Map.forEach(place);
		this.su28VirMap.forEach(place);
		this.beidouMap.forEach(place);

		this.group.remove(this.doubingGroup);
		this.disposeGroup(this.doubingGroup);
		this.doubingGroup.children = [];
		this.genDoubingLine();
	}

	scaleStars(val){
		// 星对象两代并存:旧 TextGeometry 网格(按 boundingBox 归一)/ 新 label sprite(无预算包围盒,
		// 直接把 val 当目标世界尺寸)。boundingBox 惰性补算,仍缺(sprite)= sprite 路径,绝不解引 null 崩栈。
		const rescale = (star)=>{
			const g = star && star.geometry;
			if(g && !g.boundingBox && typeof g.computeBoundingBox === 'function'){
				try{ g.computeBoundingBox(); }catch(e){ /* sprite/退化几何 */ }
			}
			if(g && g.boundingBox && g.boundingBox.max && g.boundingBox.max.y){
				const ratio = 1 / g.boundingBox.max.y * val;
				star.scale.set(ratio, ratio, ratio);
				return;
			}
			if(star && star.isSprite){ star.scale.set(val, val, 1); return; }
			if(star && star.scale){ star.scale.setScalar(val); }
		};
		this.beijiMap.forEach(rescale);
		this.starMap.forEach(rescale);
		this.su28Map.forEach(rescale);
		this.su28VirMap.forEach(rescale);
		this.beidouMap.forEach(rescale);
	}

	initStats() {
		// WS-0:Stats 面板改 debug 门控(旧=永远挂着,每帧 stats.update() 白税+左上角常驻 FPS 表)。
		// 开法:localStorage horosa.debug.astro3dStats='1' 后重进 3D 页。
		try{
			if(window.localStorage.getItem('horosa.debug.astro3dStats') !== '1'){
				this.stats = null;
				return;
			}
		}catch(e){
			this.stats = null;
			return;
		}
		let stats = new Stats();
		let dom = document.getElementById(this.chartId);
		dom.appendChild(stats.domElement);
		stats.domElement.style = 'position: absolute; left: 3px; top: 0px;'
        this.stats = stats;
    }

	initScene(){
		this.scene = new THREE.Scene();
		this.lightGroup = new THREE.Group();
		this.group = new THREE.Group();
		this.skyGroup = new THREE.Group();
		this.earthGroup = new THREE.Group();

		this.group.add(this.earthGroup);
		this.group.add(this.skyGroup);
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
	}

	setupCameraPos(){
		let r = this.chartOpt['摄像机与球心距离'];
		let lon = this.chartOpt['摄像机天球经度'];
		let lat = this.chartOpt['摄像机天球纬度'];
		const p = sph(lon, lat, r);
		this.camera.position.set(p.x, p.y, p.z);
		this.camera.lookAt(this.scene.position);
		this.camera.updateProjectionMatrix();
	}

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
	}

	/** 相机球面缓动飞行:lon 最短弧 + lat 线性 + 距离 log 插值;flag 无关(纯交互增强) */
	flyToPreset(key){
		const preset = this.getCameraPresets()[key];
		if(!preset){
			return;
		}
		const cur = this.camera.position;
		const curR = cur.length();
		const curLat = Math.asin(cur.y / (curR || 1)) * 180 / Math.PI;
		const curLon = ((Math.atan2(-cur.z, cur.x) * 180 / Math.PI) + 360) % 360;
		const dstR = this.chartOpt['摄像机与球心距离'];
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
			const p = sph(lon, lat, r);
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
	}

	initCamera(){
		let fov = this.chartOpt['摄像机视野'];
		this.camera = new THREE.PerspectiveCamera(fov, this.width / this.height, 0.1, this.radius * this.maxCamDistRatio);
		this.setupCameraPos()
	}

	initLight(){
		let ambColor = this.chartOpt['环境光颜色'];
		let ambIns = this.chartOpt['环境光强度'];
		let light = new THREE.AmbientLight(ambColor, ambIns);
		light.name = 'AmbientLight';
		this.lightGroup.add(light);

		let R = this.radius + getPosOffset(AstroConst.SUN);
		let sun = AstroHelper.getObject(this.chartObj, AstroConst.SUN);
		let sunColor = this.chartOpt['太阳光颜色'];
		let sunIns = this.chartOpt['太阳光强度'];

		let y = R * Math.sin(sun.lat * Math.PI / 180);
		let tmpR = R * Math.cos(sun.lat * Math.PI / 180);
		let x = tmpR * Math.cos(sun.lon * Math.PI / 180);
		let z = -tmpR * Math.sin(sun.lon * Math.PI / 180);

		this.sunDirectLight = new THREE.DirectionalLight(sunColor, sunIns);
		this.sunDirectLight.name = 'SunLight';
		this.sunDirectLight.position.set(x, y, z);

		this.lightGroup.add(this.sunDirectLight);
	}

	initRenderer(){
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
		});
		// r0.185:outputEncoding→outputColorSpace;gammaFactor 已废;physicallyCorrectLights
		// 已是默认(原代码本就显式开物理正确 → 升级后灯光强度语义不变,免重标定)。
		this.renderer.outputColorSpace = this.chartOpt['纹理编码'] === 'sRGB' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
		this.renderer.setSize(this.width, this.height);
		// WS-0:pixelRatio 封顶 2 —— Retina 3x 屏上 3x 渲染面积是 2.25 倍无感知税
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.setClearColor(this.chartOpt['星盘背景']);

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		let dom = document.getElementById(this.chartId);
		dom.appendChild(this.renderer.domElement);

		// WS-0:WebGL 上下文丢失自愈(旧代码零监听 → GPU 驱动重置/后台回收后黑屏无解,
		// 只能整页刷新)。lost 须 preventDefault(默认行为=永不 restore),停循环;
		// restored → 走既有全重建路径(needRecreate 语义由外层 drawChart 提供,此处
		// 直接以当前参数重建材质/纹理最稳:上下文丢失后 GPU 资源全失效)。
		this.renderer.domElement.addEventListener('webglcontextlost', (ev)=>{
			ev.preventDefault();
			this._contextLost = true;
			if(this.rafId){
				window.cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		}, false);
		this.renderer.domElement.addEventListener('webglcontextrestored', ()=>{
			this._contextLost = false;
			// 材质/纹理已由 three 内部重新上传;拉起渲染循环补一帧即可
			this.wake(3);
		}, false);
	}

	updateTextureEncoding() {
		// r0.185:纹理侧 .encoding 已废,改 .colorSpace(输出侧同名迁移 outputColorSpace)。
		const colorSpace = this.chartOpt['纹理编码'] === 'sRGB' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
		this.renderer.outputColorSpace = colorSpace;
		traverseMaterials(this.group, (material) => {
			if (material.map) material.map.colorSpace = colorSpace;
			if (material.emissiveMap) material.emissiveMap.colorSpace = colorSpace;
			if (material.map || material.emissiveMap) material.needsUpdate = true;
		});
	}

	hideEarthAxes(){
		if(this.chartOpt['地球自转轴']){
			let found = false;
			this.earthGroup.children.map((item, idx)=>{
				if(item === this.earthAxes){
					found = true;
				}
			});
			if(!found){
				this.earthGroup.add(this.earthAxes);
			}
		}else{
			this.earthGroup.remove(this.earthAxes);
		}
	}

	hideEarth(){
		if((this.chartDispNum & AstroConst.CHART_3D_EARTH) !== AstroConst.CHART_3D_EARTH || 
			this.earthMesh === undefined || this.earthMesh === null){
			return;
		}
		if(this.chartOpt['隐藏地球']){
			this.earthGroup.remove(this.earthMesh);
		}else{
			let found = false;
			this.earthGroup.children.map((item, idx)=>{
				if(item === this.earthMesh){
					found = true;
				}
			});
			if(!found){
				this.earthGroup.add(this.earthMesh);
			}
		}
	}

	hideEarthPlanets(){
		if(this.chartOpt['隐藏地球附近星体']){
			this.planetEarthMap.forEach((mesh)=>{
				this.skyGroup.remove(mesh);
			})
		}else{
			this.planetEarthMap.forEach((mesh)=>{
				this.skyGroup.add(mesh);
			})
		}
	}

	genEarth(){
		if(this.earthAxes === undefined || this.earthAxes === null){
			let r = this.radius + 100;
			let vec1 = new THREE.Vector3(0, r, 0);
			let vec2 = new THREE.Vector3(0, -r, 0);
			let dir = new THREE.Vector3().subVectors(vec1, vec2).normalize();
			let length = r*2;
			let hLen = 15;
			let hWid = 5;
			let hex = AstroConst.Astro3DColor.AxesColor;
			this.earthAxes = new THREE.ArrowHelper(dir, vec2, length, hex, hLen, hWid);
		}

		if((this.chartDispNum & AstroConst.CHART_3D_EARTH) !== AstroConst.CHART_3D_EARTH){
			return;
		}

		let name = 'Earth';
		if(this.chartOpt['有云地球']){
			name = 'EarthCloud';
		}
		let mesh = this.planetMeshMap.get(name);
		if(mesh){
			let tmp = this.earthMesh;
			if(tmp){
				this.earthGroup.remove(tmp);
			}
			let r = this.chartOpt['地球半径'];
			this.earthMesh = mesh.clone();
			this.earthMesh.position.set(0, 0, 0);	
			let ratio = r / mesh.geometry.boundingBox.max.y;
			this.earthMesh.scale.set(ratio, ratio, ratio);
	
			let mc = AstroHelper.getObject(this.chartObj, AstroConst.MC);
			let gpslon = this.chartObj.params.gpsLon;
			if(gpslon === undefined || gpslon === null){
				gpslon = this.fields.gpsLon.value;
			}
			let delta = mc.lon - gpslon;
			this.earthMesh.rotateY(delta * Math.PI / 180);
			// WS-1b:记建盘自转角(补间以此为基准反解姿态;_vDelta 为补间中间态)
			this.earthMesh.userData._mcDelta = delta;

			this.earthGroup.add(this.earthMesh);
			if(tmp){
				tmp.geometry.dispose();
				tmp.material.dispose();
			}
		}

	}

	genFullCircle(radius, color){
		let circle = new THREE.EllipseCurve(0, 0, radius, radius, 
			0, 2*Math.PI, false, 0);
		let points = circle.getPoints(50);
		let geometry = new THREE.BufferGeometry().setFromPoints( points );
		let material = new THREE.LineBasicMaterial( { color : color } );
		let line = new THREE.Line(geometry, material);
		return line;
	}

	genCircle(radius, color, degree){
		let circle = null;
		let points = null;
		if(degree !== undefined && degree !== null){
			if(degree % 30 === 0){
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					0, 2*Math.PI, false, 0);
				points = circle.getPoints(50);	
			}else if(degree % 10 === 0){
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-1.5*Math.PI/180, 1.5*Math.PI/180, false, 0);	
				points = circle.getPoints(3);
			}else if(degree % 5 === 0){
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-1*Math.PI/180, 1*Math.PI/180, false, 0);	
				points = circle.getPoints(3);
			}else{
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-0.5*Math.PI/180, 0.5*Math.PI/180, false, 0);	
					points = circle.getPoints(3);
			}
		}else{
			circle = new THREE.EllipseCurve(0, 0, radius, radius, 
				0, 2*Math.PI, false, 0);
			points = circle.getPoints(50);
		}
		let geometry = new THREE.BufferGeometry().setFromPoints( points );
		let material = new THREE.LineBasicMaterial( { color : color } );
		let line = new THREE.Line(geometry, material);
		return line;
	}

	genDegree(radius, color, degree){
		let circle = null;
		let points = null;
		if(degree !== undefined && degree !== null){
			if(degree % 10 === 0){
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-1.5*Math.PI/180, 1.5*Math.PI/180, false, 0);	
				points = circle.getPoints(3);
			}else if(degree % 5 === 0){
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-1*Math.PI/180, 1*Math.PI/180, false, 0);	
				points = circle.getPoints(3);
			}else{
				circle = new THREE.EllipseCurve(0, 0, radius, radius, 
					-0.5*Math.PI/180, 0.5*Math.PI/180, false, 0);	
					points = circle.getPoints(3);
			}
		}else{
			circle = new THREE.EllipseCurve(0, 0, radius, radius, 
				0, 2*Math.PI, false, 0);
			points = circle.getPoints(50);
		}
		let geometry = new THREE.BufferGeometry().setFromPoints( points );
		let material = new THREE.LineBasicMaterial( { color : color } );
		let line = new THREE.Line(geometry, material);
		return line;
	}

	genText(text, size){
		let cl = this.chartOpt['文本颜色'];
		let sz = 5;
		if(size){
			sz = size;
		}
		if(astro3dSpriteLabelsEnabled()){
			// worldSize×1.5:TextGeometry 的 size 是字面高,sprite 含行高留白,系数对齐观感
			return makeTextSprite(text, { worldSize: sz * 1.5, color: cl, minLuma: 0.55 });
		}
		let txtGeom = new TextGeometry(text, {
			font: this.normalFont,
			size: sz,
			height: 1,
			curveSegments: 12,
			bevelEnabled: false,
			bevelThickness: 0.1,
			bevelSize: 0,
			bevelOffset: 0,
			bevelSegments: 0
		});

		var material = new THREE.MeshBasicMaterial( { color: cl } );
		material.mtype = 'TextMesh';
		var mesh = new THREE.Mesh(txtGeom,  material);
		return mesh;
	}

	genHouseText(text){
		let cl = this.chartOpt['文本颜色'];
		if(astro3dSpriteLabelsEnabled()){
			return makeTextSprite(text, { worldSize: 15 * 1.5, color: cl, minLuma: 0.55 });
		}
		let txtGeom = new TextGeometry(text, {
			font: this.normalFont,
			size: 15,
			height: 1,
			curveSegments: 12,
			bevelEnabled: false,
			bevelThickness: 0.1,
			bevelSize: 0,
			bevelOffset: 0,
			bevelSegments: 0
		});

		var material = new THREE.MeshBasicMaterial( { color: cl } );
		material.mtype = 'TextMesh';
		var mesh = new THREE.Mesh(txtGeom, material);
		return mesh;
	}

	genSignText(degree){
		let idx = Math.floor(degree / 30);
		let sig = AstroConst.LIST_SIGNS[idx];
		let text = AstroText.AstroMsg[sig];
		let color = AstroConst.Astro3DColor[sig];
		if(astro3dSpriteLabelsEnabled()){
			// 星座字形走 ywastrochart 网页字体(与 2D 盘同源;ensureAstroFont 已在 init 预热)
			return makeTextSprite(text, { worldSize: 20 * 1.5, color: color, fontFamily: 'ywastrochart', minLuma: 0.6, glow: true });
		}
		let txtGeom = new TextGeometry(text, {
			font: this.chartFont,
			size: 20,
			height: 1,
			curveSegments: 12,
			bevelEnabled: false,
			bevelThickness: 0.1,
			bevelSize: 0,
			bevelOffset: 0,
			bevelSegments: 0
		});

		var mesh = new THREE.Mesh(txtGeom, new THREE.MeshBasicMaterial( { color: color } ) );
		return mesh;
	}


	initLonLine(R, color, needSig){
		// WS-0 几何合并:旧实现 360 度×(1 Group+1 Line) = 720+ 场景对象、360 draw call
		// (sky+earth 两套即 700+),是 draw call 数百的主源。改为顶点预旋转到位后合入单
		// BufferGeometry → 1 个 LineSegments = 1 draw call;渲染结果逐像素等价
		// (旧路径:EllipseCurve XY 面小弧 + grp.rotateY(i°) ≡ sph(i, ±half, R) 直算)。
		// 文字/星座符号保留独立对象(每 15° 一个,数量少;朝向等价:同轴 rotY 可加,
		// 原「父 rotY(i)∘子 rotY(90°)」= 单对象 rotY(90°+i°))。
		let group = new THREE.Group();
		const verts = [];
		const N_SEG = 3;
		for(let i = 0; i < 360; i += 1){
			// 刻度长短与旧 genDegree 同档:10°=±1.5°,5°=±1°,其余 ±0.5°(needSig=false 的
			// 纬网变体旧走 genCircle 全圆 —— 全仓实调仅 needSig=true 一处,统一走刻度弧)
			const half = i % 10 === 0 ? 1.5 : (i % 5 === 0 ? 1 : 0.5);
			let prev = null;
			for(let k = 0; k <= N_SEG; k += 1){
				const lat = -half + (2 * half * k) / N_SEG;
				const p = sph(i, lat, R);
				if(prev){
					verts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
				}
				prev = p;
			}
		}
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
		const merged = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: color }));
		merged.name = 'lonTicksMerged';
		group.add(merged);

		for(let i = 0; i < 360; i += 1){
			if(i % 15 === 0){
				let txt = i + 'º';
				let degtxt = this.genText(txt, 3);
				const p = sph(i, 0, R);
				degtxt.position.set(p.x, p.y, p.z);
				degtxt.rotateY(Math.PI / 2 + i * Math.PI / 180);
				group.add(degtxt);
			}else if(needSig && i > 0 && (i + 1) % 15 === 0 && (i + 1) % 30 !== 0){
				let degtxt = this.genSignText(i);
				const p = sph(i, -5, R);
				degtxt.position.set(p.x, p.y, p.z);
				degtxt.rotateY(Math.PI / 2 + i * Math.PI / 180);
				group.add(degtxt);
			}
		}
		return group;
	}

	genLatDegText(group, r, y, deg, dirtxt){
		for(let i=0; i<12; i++){
			let rad = 30 * i * Math.PI / 180;
			let degtxt = this.genText(deg+dirtxt, 2);
			let cx = r * Math.cos(rad);
			let cz = -r * Math.sin(rad);
			degtxt.position.set(cx, y, cz);
			degtxt.rotateY((30 * i + 90) * Math.PI/180);
			group.add(degtxt);	
		}
	}

	initLatLine(R, color, isSky){
		let group = new THREE.Group();
		let sz = 1;
		if(isSky){
			if((this.chartDispNum & AstroConst.CHART_3D_SKYBALL_LATLINE) === AstroConst.CHART_3D_SKYBALL_LATLINE){
				sz = 9;
			}
		}else{
			if((this.chartDispNum & AstroConst.CHART_3D_EARTH_LATLINE) === AstroConst.CHART_3D_EARTH_LATLINE){
				sz = 9;
			}
		}

		for(let i=0; i<sz; i++){
			let deg = i * 90 / sz
			let y = R * Math.sin(deg * Math.PI / 180);
			let r = R * Math.cos(deg * Math.PI / 180);
			let lat = this.genFullCircle(r, color);
			lat.rotateX(90 * Math.PI / 180);
			lat.position.set(0, y, 0);
			group.add(lat);

			if(i > 0){
				this.genLatDegText(group, r, y, deg, 'N');

				lat = this.genCircle(r, color);
				lat.rotateX(90 * Math.PI / 180);
				lat.position.set(0, -y, 0);
				group.add(lat);	

				this.genLatDegText(group, r, -y, deg, 'S');
			}
		}

		let asc = AstroHelper.getObject(this.chartObj, AstroConst.ASC);
		let desc = AstroHelper.getObject(this.chartObj, AstroConst.DESC);
		let mc = AstroHelper.getObject(this.chartObj, AstroConst.MC);
		let ic = AstroHelper.getObject(this.chartObj, AstroConst.IC);   // 曾误取 MC → IC 纬圈判据恒假、永不绘制
		let ary = [asc.decl, mc.decl];
		let eps = 0.00027;
		if(isSky){
			ary = [asc.lat, mc.lat];
			if((this.chartDispNum & AstroConst.CHART_3D_SKYBALL_LATLINE) === AstroConst.CHART_3D_SKYBALL_LATLINE){
				if(Math.abs(asc.lat - desc.lat) > eps){
					ary.push(desc.lat);
				}
				if(Math.abs(mc.lat - ic.lat) > eps){
					ary.push(ic.lat);
				}
				ary.forEach((deg)=>{
					let y = R * Math.sin(deg * Math.PI / 180);
					let r = R * Math.cos(deg * Math.PI / 180);
					let lat = this.genFullCircle(r, color);
					lat.rotateX(90 * Math.PI / 180);
					lat.position.set(0, y, 0);
					group.add(lat);	
				})				
			}
		}else{
			if((this.chartDispNum & AstroConst.CHART_3D_EARTH_LATLINE) === AstroConst.CHART_3D_EARTH_LATLINE){
				if(Math.abs(asc.decl - desc.decl) > eps){
					ary.push(desc.decl);
				}
				if(Math.abs(mc.decl - ic.decl) > eps){
					ary.push(ic.decl);
				}
				ary.forEach((deg)=>{
					let y = R * Math.sin(deg * Math.PI / 180);
					let r = R * Math.cos(deg * Math.PI / 180);
					let lat = this.genFullCircle(r, color);
					lat.rotateX(90 * Math.PI / 180);
					lat.position.set(0, y, 0);
					group.add(lat);	
				})				
			}
		}

		return group;
	}

	genPlanetText(planetid, text, color, size){
		let sz = 16;
		if(size){
			sz = size;
		}
		if((this.chartDispNum & AstroConst.CHART_3D_PLANET_SYM) !== AstroConst.CHART_3D_PLANET_SYM){
			let mesh = this.planetMeshMap.get(planetid);
			if(mesh){
				return mesh.clone();
			}
			// 模型缺位回退落到下方 glyph sprite —— 用户定案:行星=glyph 符号本体
			// (与 2D 盘同认知,不加点/晕/名牌三件套);太阳独享淡金晕(光源意象)。
		}
		// sprite flag 开(默认)=billboard 占星字形:亮度下限抬升(深色行星色黑底可读)+
		// 同色柔光两遍(自发光观感);关=旧 TextGeometry 立体字。
		if(astro3dSpriteLabelsEnabled()){
			const glyph = makeTextSprite(text, { worldSize: sz * 1.6, color, fontFamily: 'ywastrochart', minLuma: 0.62, glow: true });
			if(planetid === AstroConst.SUN){
				const grp = new THREE.Group();
				const halo = makeStarSprite('#ffdf9e', sz * 3.6, 0.1);
				halo.name = 'SunHalo';
				// [接线转正] 太阳晕透明度受「太阳光强度」驱动(0-10,默认 6.5 = 现观感 1.0 封顶不回归)
				const _si = Number(this.chartOpt['太阳光强度']);
				if(halo.material && Number.isFinite(_si)){ halo.material.opacity = Math.max(0, Math.min(1, _si / 6.5)); }
				grp.add(halo);
				grp.add(glyph);
				return grp;
			}
			return glyph;
		}

		let txtGeom = new TextGeometry(text, {
			font: this.chartFont,
			size: sz,
			height: 1,
			curveSegments: 12,
			bevelEnabled: false,
			bevelThickness: 0.1,
			bevelSize: 0,
			bevelOffset: 0,
			bevelSegments: 0
		});

		let mesh = new THREE.Mesh(txtGeom, new THREE.MeshBasicMaterial( { color: color } ) );
		return mesh;
	}

	genAspectText(asp){
		let text = AstroText.AstroMsg['Asp' + asp];
		let color = AstroConst.Astro3DColor.TextStroke;
		if(text === undefined || text === null){
			text = asp + '';
		}
		// sprite flag 开(默认):相位符号 billboard 恒可读(立体字侧视=白条);关=旧观感
		if(astro3dSpriteLabelsEnabled()){
			return makeTextSprite(text, { worldSize: 14, color, fontFamily: 'ywastrochart', minLuma: 0.6 });
		}

		let txtGeom = new TextGeometry(text, {
			font: this.chartFont,
			size: 12,
			height: 1,
			curveSegments: 12,
			bevelEnabled: false,
			bevelThickness: 0.1,
			bevelSize: 0,
			bevelOffset: 0,
			bevelSegments: 0
		});

		var mesh = new THREE.Mesh(txtGeom, new THREE.MeshBasicMaterial( { color: color } ) );
		return mesh;
	}

	genPlanetMesh(planet, size){
		let txt = AstroText.AstroMsg[planet.id];
		let color = AstroConst.Astro3DColor[planet.id];
		if(color === undefined || color === null){
			color = AstroConst.Astro3DColor.PlanetStroke;
		}
		if((this.chartDispNum & AstroConst.CHART_PLANETCOLORWITHSIGN) === AstroConst.CHART_PLANETCOLORWITHSIGN){
			color = AstroConst.Astro3DColor[planet.sign];
		}
		let mesh = this.genPlanetText(planet.id, txt, color, size);

		return mesh;
	}

	genAspect(planetA, planetB, asp){
		let meshA = this.planetMap.get(planetA.id);
		let meshB = this.planetMap.get(planetB.id);
		if(meshA === undefined || meshA === null || meshB === undefined || meshB === null){
			return null;
		}

		let vecA = meshA.position.clone();
		let vecB = meshB.position.clone();
		let pnts = [vecA, vecB];
		let geometry = new THREE.BufferGeometry();
		geometry.setFromPoints(pnts)

		let color = AstroConst.Astro3DColor['Asp' + asp];
		if(color === undefined || color === null){
			color = AstroConst.Astro3DColor.PlanetStroke;
		}
		let material = new THREE.LineBasicMaterial( { color: color } );
		let line = new THREE.Line( geometry, material );
		let asptxt = this.genAspectText(asp);
		let midVec = vecA.clone();
		midVec.add(vecB);
		midVec.divideScalar(2);
		asptxt.position.set(midVec.x, midVec.y, midVec.z);

		let grp = new THREE.Group();
		grp.add(line);
		grp.add(asptxt);

		return grp;
	}

	initAspect(planetA, aspect){
		let appl = aspect.Applicative;
		let sep = aspect.Separative;
		let aspary = aspect.Exact.map((elm)=>{
			return elm;
		});
		for(let idx=0; idx<sep.length; idx++){
			aspary.push(sep[idx]);
		}
		for(let idx=0; idx<appl.length; idx++){
			aspary.push(appl[idx]);
		}
		let needThreePlanetAspLines = (this.chartDispNum & AstroConst.CHART_THREEPLANETASP) === AstroConst.CHART_THREEPLANETASP;

		for(let i=0; i<aspary.length; i++){
			let item = aspary[i];
			if(!this.planetDisp.has(item.id)){
				continue;
			}	
			let planetB = AstroHelper.getObject(this.chartObj, item.id);
			if(planetB === undefined || planetB === null 
				|| (needThreePlanetAspLines === false && AstroConst.THREE_PLANETS.has(planetA.id)
					&& AstroConst.THREE_PLANETS.has(planetB.id))){
				continue;
			}

			let mesh = this.genAspect(planetA, planetB, item.asp);
			if(mesh){
				this.aspectGroup.add(mesh);
			}
		}

	}

	initAspects(){
		// WS-1b:相位线独立成组(补间需整组撤换+终帧重建淡入;仍挂 skyGroup 下,渲染层级不变)
		if(this.aspectGroup && this.aspectGroup.parent === this.skyGroup){
			this.disposeGroupDeep(this.aspectGroup);
			this.aspectGroup.children = [];
		}else{
			this.aspectGroup = new THREE.Group();
			this.skyGroup.add(this.aspectGroup);
		}
		if((this.chartDispNum & AstroConst.CHART_ASP_LINES) !== AstroConst.CHART_ASP_LINES){
			return;
		}

		for(let key in this.chartObj.aspects.normalAsp){
			if(!this.planetDisp.has(key)){
				continue;
			}
			let aspect = this.chartObj.aspects.normalAsp[key];
			let planetA = AstroHelper.getObject(this.chartObj, key);
			if(planetA === undefined || planetA === null){
				continue;
			}
			this.initAspect(planetA, aspect);
		}
	}

	initPlanets(R, planetmap, size){
		let planets = this.chartObj.chart.objects;
		for(let i=0; i<planets.length; i++){
			let planet = planets[i];
			if(!this.planetDisp.has(planet.id)){
				continue;
			}

			let r = R + getPosOffset(planet.id);
			let mesh = this.genPlanetMesh(planet, size);
			let y = r * Math.sin(planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(planet.lon * Math.PI / 180);
			mesh.position.set(x, y, z);
			mesh.rotateY((planet.lon+90) * Math.PI / 180);

			mesh.planet = planet;
			mesh.name = planet.id;

			planetmap.set(planet.id, mesh);
			this.skyGroup.add(mesh);
		}
	}

	initAxesLines(){
		// WS-1b:四轴箭头独立成组(仍挂 skyGroup 下,渲染层级不变;终帧交账整组重建)
		if(this.axesGroup && this.axesGroup.parent){
			this.axesGroup.parent.remove(this.axesGroup);
			this.disposeGroupDeep(this.axesGroup);
		}
		this.axesGroup = new THREE.Group();
		this.skyGroup.add(this.axesGroup);
		if((this.chartDispNum & AstroConst.CHART_ANGLELINE) !== AstroConst.CHART_ANGLELINE){
			return;
		}

		let angle = [AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC];
		let angVecs = angle.map((item, idx)=>{
			let r = this.radius + getPosOffset(item);
			let planet = AstroHelper.getObject(this.chartObj, item);

			let y = r * Math.sin(planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(planet.lon * Math.PI / 180);

			let vec = new THREE.Vector3(x, y, z);	
			return vec;
		});

		let dir1 = new THREE.Vector3().subVectors(angVecs[0], angVecs[1]);
		let dir2 = new THREE.Vector3().subVectors(angVecs[2], angVecs[3]);
		dir1.normalize();
		dir2.normalize();

		let len1 = angVecs[0].distanceTo(angVecs[1]);
		let len2 = angVecs[2].distanceTo(angVecs[3]);
		let hLen = 15;
		let hWid = 5;
		let hex = AstroConst.Astro3DColor.AxesColor;
		let arrow1 = new THREE.ArrowHelper(dir1, angVecs[1], len1, hex, hLen, hWid);
		this.axesGroup.add(arrow1);

		let arrow2 = new THREE.ArrowHelper(dir2, angVecs[3], len2, hex, hLen, hWid);
		this.axesGroup.add(arrow2);

	}

	initHouses(r, color){
		// WS-1b:宫轴组挂名引用 + 每宫记建盘经度(补间同旋按差值转组;终帧交账整组重建)
		if(this.houseGroup && this.houseGroup.parent){
			this.houseGroup.parent.remove(this.houseGroup);
			this.disposeGroupDeep(this.houseGroup);
		}
		let group = new THREE.Group();
		let houses = this.chartObj.chart.houses;
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let grp = new THREE.Group();
			let deg = house.lon;
			grp.userData._houseId = house.id;
			grp.userData._builtLon = deg;
			let lon = this.genFullCircle(r, color);
			lon.rotateY(deg * Math.PI / 180);
			grp.add(lon);

			let txtdeg = deg + house.size / 2;
			let txt = house.id.substr(5);
			let htxt = this.genHouseText(txt);
			let txtr = r - 30;

			let y = txtr * Math.sin(30 * Math.PI / 180);
			let tmpR = txtr * Math.cos(30 * Math.PI / 180);
			let x = tmpR * Math.cos(txtdeg * Math.PI / 180);
			let z = -tmpR * Math.sin(txtdeg * Math.PI / 180);

			htxt.position.set(x, y, z);
			htxt.rotateY((txtdeg+90) * Math.PI / 180);
			grp.add(htxt);

			group.add(grp);
		}

		this.houseGroup = group;
		this.skyGroup.add(group);
	}

	initSkyBall(){
		// [可调线色] 天球网格(经圈/纬圈/宫位圈)颜色走 chartOpt(默认红,与旧常量同观感);
		// 生成后统一打 mtype='SkyGrid' 标记 → applyOption 运行时按标遍历改色(相位线/宫轴不受染)。
		const skyLineColor = this.chartOpt['天球线条颜色'] || AstroConst.Astro3DColor.SkyLine;
		let longroup = this.initLonLine(this.radius, skyLineColor, true);
		// WS-1b:纬圈组挂名引用(含 ASC/MC 黄纬特征圈,随盘变 → 补间终帧交账要重建它)
		let latgroup = this.initLatLine(this.radius, skyLineColor, true);
		this.skyLatGroup = latgroup;
		const tagSkyGrid = (g)=>{ g.traverse((o)=>{ if(o.isLine || o.isLineSegments){ if(o.material){ o.material.mtype = 'SkyGrid'; } } }); };
		tagSkyGrid(longroup);
		tagSkyGrid(latgroup);

		this.skyGroup.add(longroup);
		this.skyGroup.add(latgroup);

		this.initPlanets(this.radius, this.planetMap, 16);
		this.initAspects();
		this.initAxesLines();

		let r = this.radius;
		const houseGroupMark = new Set(this.skyGroup.children);
		this.initHouses(r, skyLineColor);
		// initHouses 直接 add 进 skyGroup:对新增子组补打标
		this.skyGroup.children.forEach((c)=>{ if(!houseGroupMark.has(c)){ tagSkyGrid(c); } });
	}
	
	initEarthLon(R, color){
		let dispLon = (this.chartDispNum & AstroConst.CHART_3D_EARTH_LONLINE) === AstroConst.CHART_3D_EARTH_LONLINE;
		let txtsz = 2;
		let group = new THREE.Group();
		for(let i=0; i<360; i++){
			let grp = new THREE.Group();
			if(i % 10 === 0){
				if(dispLon){
					let lon = this.genFullCircle(R, color);
					grp.add(lon);	
				}

				if(!dispLon){
					txtsz = 4;
				}
				let txt = i + 'º';
				let degtxt = this.genText(txt, txtsz);
				degtxt.position.set(R, 0, 0);
				degtxt.rotateY(Math.PI/2);
				grp.add(degtxt);	
			}
			let deg = this.genDegree(R, 0xff0000, i);
			grp.add(deg);

			if(i > 0){
				grp.rotateY(i * Math.PI / 180);
			}
			group.add(grp);
		}

		let asc = AstroHelper.getObject(this.chartObj, AstroConst.ASC);
		let desc = AstroHelper.getObject(this.chartObj, AstroConst.DESC);
		let mc = AstroHelper.getObject(this.chartObj, AstroConst.MC);
		let ic = AstroHelper.getObject(this.chartObj, AstroConst.IC);   // 曾误取 MC → IC 纬圈判据恒假、永不绘制
		let ary = [asc.ra, mc.ra];
		let eps = 0.00027;
		if(Math.abs(asc.ra - desc.ra) > eps){
			ary.push(desc.ra);
		}
		if(Math.abs(mc.ra - ic.ra) > eps){
			ary.push(ic.ra);
		}

		if(dispLon){
			ary.forEach((degree)=>{
				let grp = new THREE.Group();
				let lon = this.genFullCircle(R, color);
				grp.add(lon);	
				grp.rotateY(degree * Math.PI / 180);
				group.add(grp);
			});
		}

		return group;
	}

	initEarth(){
		this.disposeEarth();

		this.genEarth();
		
		let r = this.earthRadius;
		if(this.chartOpt['地球半径'] > r){
			r = this.chartOpt['地球半径'];
		}
		let delta = this.radius - this.chartOpt.maxEarthRadius;
		let lineR = r + delta;
		if(lineR > this.radius ||
			(this.chartDispNum & AstroConst.CHART_3D_EARTH_RADIUS_SAMESKY) === AstroConst.CHART_3D_EARTH_RADIUS_SAMESKY){
			lineR = this.radius;
		}

		let longroup = this.initEarthLon(lineR, AstroConst.Astro3DColor.EarthLine);
		let latgroup = this.initLatLine(lineR, AstroConst.Astro3DColor.EarthLine);
		this.earthGroup.add(longroup);
		this.earthGroup.add(latgroup);

		this.earthGroup.rotateX(-23.44 * Math.PI / 180);

		let planetPosR = lineR;
		if(r >= this.chartOpt.maxEarthRadius - 5){
			planetPosR = this.radius;
		}
		this.initPlanets(planetPosR, this.planetEarthMap, 16);

		if(this.chartOpt['隐藏地球'] && this.earthMesh){
			this.hideEarth()
		}
		if(this.chartOpt['地球自转轴'] && this.earthAxes){
			this.hideEarthAxes()
		}

	}

	initFixedStars(stars, modelId, starmap, stargroup){
		let r = this.radius + this.chartOpt['恒星距离行星圈'];
		// WS-1 星空美化:3D 模型缺位常态(远端模型源已下线、包内无 glb)下,恒星曾统一渲染成
		// 「Unknown」黄色立体字=满天黄条。sprite 标签 flag 开(默认)时改程序化发光光点:
		// 普通星暖白、北斗亮白、北极星金色偏大、28宿青金;北斗/北极附名字标签(重要星)。
		// flag 关(kill-switch)=旧文字观感原样。hover 提示/点击拾取走 mesh.planet 不变。
		const useStarSprite = astro3dSpriteLabelsEnabled() && this.planetMeshMap.size === 0;
		const STAR_STYLES = {
			Polaris:        { color: '#ffd97a', size: 3.4, core: 0.32 },
			BigDipper:      { color: '#f2f7ff', size: 2.6, core: 0.28 },
			Su28:           { color: '#cfe6d8', size: 2.4, core: 0.28 },
			PolarCandidate: { color: '#e8ecff', size: 2.0, core: 0.25 },
			Star:           { color: '#fff4d8', size: 1.8, core: 0.22 },
		};
		stars.forEach((star)=>{
			if(modelId !== 'Su28' && (this.su28Map.has(star.id) || this.su28Map.has(star.id) ||
				this.beidouMap.has(star.id) || this.beijiMap.has(star.id))){
				return;
			}

			let mesh;
			let starR = this.chartOpt['恒星半径'];
			if(useStarSprite){
				const style = STAR_STYLES[modelId] || STAR_STYLES.Star;
				mesh = makeStarSprite(style.color, style.size * Math.max(0.5, starR), style.core);
				// 名字不做常显标签(满天名字=视觉噪音;Sprite 子对象还继承父 scale 会爆尺寸)——
				// hover 提示卡照旧给全名,重要星靠色彩/尺寸分级(北极金、北斗白、28宿青金)辨识。
			}else{
				let txt = AstroText.AstroMsg.Unknown;
				mesh = this.genPlanetText(modelId, txt, AstroConst.Astro3DColor.PlanetStroke, 1);
				if(mesh.geometry.boundingBox === null){
					mesh.geometry.computeBoundingBox();
				}
				let ratio = 1 / mesh.geometry.boundingBox.max.y * starR;
				mesh.scale.set(ratio, ratio, ratio);
			}

			let y = r * Math.sin(star.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.lon * Math.PI / 180);
			mesh.position.set(x, y, z);

			mesh.planet = star;
			mesh.name = star.name;
			if(modelId === 'Polaris'){
				mesh.isBeiji = true;
				mesh.planet.isBeiji = true;
			}
			starmap.set(star.id, mesh);

			stargroup.add(mesh);
		});
	}

	initSu28(){
		let stars = this.chartObj.chart.su28Adjust;
		let modelId = 'Su28';
		this.initFixedStars(stars, modelId, this.su28Map, this.su28Group);

		stars = this.chartObj.chart.su28Virtual;
		modelId = 'Su28';
		this.initFixedStars(stars, modelId, this.su28VirMap, this.su28VirGroup);
	}

	initStars(){
		this.initSu28();
		
		let stars = [];
		if(this.chartObj.chart.beiji.length){
			for(let i=0; i<this.chartObj.chart.beiji.length-1; i++){
				stars.push(this.chartObj.chart.beiji[i]);
			}
			let modelId = 'PolarCandidate';
			if(!this.planetMeshMap.has(modelId)){
				modelId = 'Star';
			}
			this.initFixedStars(stars, modelId, this.beijiMap, this.beijiGroup);
			
			let polarIdx = this.chartObj.chart.beiji.length-1;
			stars = [this.chartObj.chart.beiji[polarIdx]];
		}else{
			stars = [this.chartObj.chart.beiji];
		}
		let modelId = 'Polaris';
		this.initFixedStars(stars, modelId, this.beijiMap, this.beijiGroup);
		
		stars = this.chartObj.chart.beidou;
		modelId = 'BigDipper';
		this.initFixedStars(stars, modelId, this.beidouMap, this.beidouGroup);
		
		stars = this.chartObj.chart.fixedStars;
		modelId = 'Star';
		this.initFixedStars(stars, modelId, this.starMap, this.starGroup);

	}

	getStarObj(id){
		let mesh = this.beidouMap.get(id);
		if(mesh){
			return mesh;
		}

		mesh = this.su28Map.get(id);
		if(this.chartOpt['使用虚拟28宿']){
			mesh = this.su28VirMap.get(id);
		}
		if(mesh){
			return mesh;
		}
		
		mesh = this.starMap.get(id);
		if(mesh){
			return mesh;
		}

		mesh = this.beijiMap.get(id);
		return mesh;
	}

	genCircleByPoint(axis, startPoint, color){
		let points = [];
		for(let i=0; i<=72; i++){
			let vec = startPoint.clone();
			let deg = i*5;
			vec.applyAxisAngle(axis, deg * Math.PI / 180);
			points.push(vec);
		}

		let curve = new THREE.CatmullRomCurve3(points);
		let pnts = curve.getPoints(50);
		let geometry = new THREE.BufferGeometry().setFromPoints( points );
		let material = new THREE.LineBasicMaterial({ color: color });
		let mesh = new THREE.Line(geometry, material);

		return mesh;
	}

	initTwoStarCircle(id1, id2){
		let star1 = this.getStarObj(id1);
		let star2 = this.getStarObj(id2);
		let planet1 = star1.planet;
		let planet2 = star2.planet;
		let color = AstroConst.Astro3DColor.EarthLine;
		let r = this.earthRadius;

		let vec1 = star1.position.clone();
		let vec2 = star2.position.clone();
		let org = new THREE.Vector3();
		let normVec = new THREE.Vector3();
		calcNormalVector(vec1.x, vec1.y, vec1.z, vec2.x, vec2.y, vec2.z, org.x, org.y, org.z, normVec);
		
		let mesh = this.genCircleByPoint(normVec, vec1, color);
		return mesh;
	}

	genDoubingLine(){
		let mesh = this.initTwoStarCircle('Mizar', 'Alkaid');
		this.doubingGroup.add(mesh);
		this.showDoubing(this.chartOpt['显示斗柄连线']);
	}

	initMesh(){
		this.initSkyBall();
		this.initEarth();
		this.initStars();

		this.genDoubingLine();

		let asc = AstroHelper.getObject(this.chartObj, AstroConst.ASC);
		this.group.rotateY((270-asc.lon) * Math.PI / 180);

		if(this.chartOpt['隐藏地球附近星体']){
			this.hideEarthPlanets()
		}

		this.selectSu28();
		this.hideStars(this.chartOpt['隐藏北极和北斗'], this.beidouGroup, this.beijiGroup);
		this.hideStars(this.chartOpt['隐藏其它恒星'], this.starGroup);
		if(this.chartOpt['使用虚拟28宿']){
			this.hideStars(this.chartOpt['隐藏28宿距星'], this.su28VirGroup);
		}else{
			this.hideStars(this.chartOpt['隐藏28宿距星'], this.su28Group);
		}
	}

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
	}

	// —— WS-2 多中心模式系统(全行星中心盘 + 任意两中心换系动画) ——
	// 最小侵入铁律:chartMode='geo'(默认)时以下全部旁路,地心默认路径零改;
	// 非 geo = 本命 group.visible=false + PlanetocentricMode 覆盖组(挂 scene 根,
	// 无 ASC 旋转 —— 非地心中心物理上无地平,春分点恒 +x);setCenterMode('geo')
	// 完全退出新逻辑并恢复本命组。
	// 换系动画(通用实现):两端位置皆已知 —— 对两端都在的天体 3D 位置 1.2s
	// easeInOutCubic + 每星 60ms 级联错峰(内圈先动);旧/新中心体对飞交换;轨道/
	// 相位线 opacity 淡出入。地心↔任意行星心同一套代码(地心端锚点=本命行星
	// 世界坐标 + 地球=原点)。_tweenActive 挂按需渲染,动画期 rAF 不停、结束即歇。

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
	}

	getCenterMode(){
		return this.chartMode;
	}

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
	}

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
	}

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
	}

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
	}

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
	}

	// —— WS-0 按需渲染状态机 ——
	// 病根:旧 animate() 持续 rAF 全速渲染,空闲也烧 GPU(挂后台 tab 都在烧)。
	// 修法:idle 停 rAF;唤醒源清单化 = ①controls start/change(交互+阻尼自续) ②setParams
	// ③resize ④主题变化(drawChart 重建路径自带) ⑤hover 命中变化 ⑥autoRotate/tween 活动。
	// kill-switch:horosa.perf.astro3dOnDemand=0 → 回持续 rAF 旧行为。
	wake(frames = 1){
		this._wakeFrames = Math.max(this._wakeFrames || 0, frames);
		if(this.rafId === null || this.rafId === undefined){
			if(!this.disposed){
				// 🔴 不可同步调 animate():render→orbits.update() 在阻尼下会同步派发 'change'
				// 再进 wake,而 rafId 要到 animate 尾部才赋值,同步链上恒为 null → 无限递归
				// 栈爆(实爆:拖转)。先占位 rafId 再入帧,同步 re-entry 被上方判断挡住。
				this.rafId = window.requestAnimationFrame(()=>{
					this.animate();
				});
			}
		}
	}

	needsFrames(){
		if(this.orbits && this.orbits.autoRotate){
			return true;
		}
		if(this._tweenActive){
			return true;
		}
		if(this._centerTweenActive){
			return true;   // WS-2 换系动画独立帧预算(geo 默认恒 undefined,零涉)
		}
		return (this._wakeFrames || 0) > 0;
	}

	animate(){
		if(this.disposed){
			this.rafId = null;
			return;
		}
		if(!this.hide){
			this.render();
		}
		if(this._wakeFrames > 0){
			this._wakeFrames -= 1;
		}
		if(astro3dOnDemandEnabled() && !this.needsFrames()){
			// idle:停 rAF(交互事件/唤醒源会再拉起);hide 态同样停,解 hide 时 drawChart→wake
			this.rafId = null;
			return;
		}
		this.rafId = window.requestAnimationFrame(()=>{
			this.animate();
		});
	}

	render(){
		this.orbits.update();
		if(this.stats){
			this.stats.update();
		}

		if(this.renderer === null){
			return;
		}

		this.renderer.render(this.scene, this.camera);
	}

}

export default Astro3D;
