// 3D 星盘引擎:类定义在这里;模块级助手与类方法按职责拆在 ./astro3dMain/ 下,
// 方法拆片 paramsMorph · interaction · setupTeardown · gui · cameraCenter · chartMeshes · skyStars,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../utils/safeStorage';
// DRACOLoader 走本仓 patched 副本:r0.185 原件顶部用 import.meta.url(webpack4 不支持,
// 编译直接炸);本仓恒 setDecoderPath 指 public/gltf/draco,默认 URL 无用武之地。
// three r0.185(2026-07 升级):dat.gui.module 已随 three 移除,lil-gui 是官方后继(API 兼容
// dat.GUI 的 addFolder/add/onChange 面);WS-1 将全废此面板换 xq-ui,此为升级过渡。
// Font/TextGeometry 自 r133 移出核心:Font 在 FontLoader 模块,TextGeometry 独立模块。
// (WS-1 标签系统换 sprite atlas 后此二者退役。)
import { Font } from 'three/examples/jsm/loaders/FontLoader';
import ywastrochart from '../../assets/ywastrochart.json';
import helvetica from '../../assets/helvetica.json';
import * as AstroConst from '../../constants/AstroConst';
import { astro3dOnDemandEnabled } from '../../utils/perfFlags';
// 球面摆点公共式(WS-0 抽取,原 6+ 处逐字重复;零依赖纯模块=jest 可测,WS-3 赤道系复用)
// WS-1b 改时间滑移补间:最短弧/归一化/缓动纯数学(零依赖模块=jest 可测)
// WS-1 标签换代:canvas sprite(1 quad/标签,billboard 恒可读);flag 关=旧 TextGeometry
// WS-2 全行星中心盘:通用行星中心盘场景构建器(一个类吃全部非地心中心)
import styles from './astro3d.less';
import { PlanetRadius } from './astro3dMain/bodyScale';
import { ChartOptKey, CAM_DIST_RATIO_DEFAULT, SUN_INTENSITY_DEFAULT, AMBIENT_INTENSITY_DEFAULT } from './astro3dMain/sceneConst';
import { mixinMethods } from '../../utils/mixinMethods';
import { paramsMorphMethods } from './astro3dMain/paramsMorph';
import { interactionMethods } from './astro3dMain/interaction';
import { setupTeardownMethods } from './astro3dMain/setupTeardown';
import { guiMethods } from './astro3dMain/gui';
import { cameraCenterMethods } from './astro3dMain/cameraCenter';
import { chartMeshMethods } from './astro3dMain/chartMeshes';
import { skyStarMethods } from './astro3dMain/skyStars';


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
			'太阳光强度': SUN_INTENSITY_DEFAULT,
			'环境光颜色': 0xffffff,
			'环境光强度': AMBIENT_INTENSITY_DEFAULT,
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
			// 此值改为「半径倍数」(缺省 3.5),不再是绝对像素:
			// 天球半径 = 画布 CSS 高/2,随缩放档、窗口大小而变;旧版把首次建盘时的绝对距离(半径×3.5,如 1155)存进
			// localStorage,之后任何一档缩放下半径变了、距离没变 → 缩小档球体撑爆画面、放大档缩成一小团。
			// 倍数语义与画布尺寸无关,任何缩放档取景一致;旧存量(绝对像素)在 normalizeCamDistance 一次性折算。
			'摄像机与球心距离': CAM_DIST_RATIO_DEFAULT,
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
		{
			const rawDist = this.chartOpt['摄像机与球心距离'];
			const normDist = this.normalizeCamDistance(rawDist);
			if(normDist !== rawDist){
				this.chartOpt['摄像机与球心距离'] = normDist;
				safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt));   // 旧绝对像素 → 倍数,落盘一次
			}
		}

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

	// —— WS-1b 改时间滑移补间(2026-07-16) ——
	// 病根:拨时间/步进 → chartObj 变 → needRecreate 全量 disposeMesh+重建(恒星/28宿/
	// 网格文本数百对象全部重造)= 卡顿 + 画面硬切跳变。
	// 修法:行星按新旧黄经差的最短弧 ~600ms easeInOutCubic tween 到位,宫轴组同旋、
	// ASC 整组同旋、太阳光/地球自转跟随;恒星/28宿层不重建(不随时间变,只随 ASC 整组
	// 旋转);相位线端点在动 → 起步撤线,终帧按新盘重建+淡入。终帧交账(宫轴/轴线/天球
	// 纬圈/地球系)走与全量重建同一批生成函数精确重建,零口径分叉。
	// 黄道制/宫位制/南北盘切换 = 坐标语义变化,仍走全量重建。

	// —— WS-2 多中心模式系统(全行星中心盘 + 任意两中心换系动画) ——
	// 最小侵入铁律:chartMode='geo'(默认)时以下全部旁路,地心默认路径零改;
	// 非 geo = 本命 group.visible=false + PlanetocentricMode 覆盖组(挂 scene 根,
	// 无 ASC 旋转 —— 非地心中心物理上无地平,春分点恒 +x);setCenterMode('geo')
	// 完全退出新逻辑并恢复本命组。
	// 换系动画(通用实现):两端位置皆已知 —— 对两端都在的天体 3D 位置 1.2s
	// easeInOutCubic + 每星 60ms 级联错峰(内圈先动);旧/新中心体对飞交换;轨道/
	// 相位线 opacity 淡出入。地心↔任意行星心同一套代码(地心端锚点=本命行星
	// 世界坐标 + 地球=原点)。_tweenActive 挂按需渲染,动画期 rAF 不停、结束即歇。

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
mixinMethods(Astro3D, paramsMorphMethods, interactionMethods, setupTeardownMethods, guiMethods, cameraCenterMethods, chartMeshMethods, skyStarMethods);   // 方法按职责拆在 ./astro3dMain/ 下(见各文件头),挂回原型

export default Astro3D;
