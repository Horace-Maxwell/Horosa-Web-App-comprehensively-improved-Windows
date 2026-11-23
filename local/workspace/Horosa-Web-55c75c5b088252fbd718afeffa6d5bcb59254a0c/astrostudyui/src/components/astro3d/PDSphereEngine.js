// 主限法 3D 天球轻引擎(WS-3)。
//
// 为什么独立轻引擎而不塞进 Astro3D 主引擎:主限天球是赤道坐标框架(Y=天北极)+
// 地平三圈 + 周日运动播放的专用场景,与黄道系本命 3D 盘(行星模型/地球/28宿/GUI)
// 无共享网格;塞进 Astro3D = 主引擎再涨一个坐标系分支(WS-2 多中心刚控制住体量)。
// 本类只借四样公共件:sphMath 摆点公式 / morphMath 缓动 / labelSprite 名牌 /
// Astro3D 的按需渲染状态机形态(wake/needsFrames/animate 同构,idle 停 rAF)。
//
// 场景图(方向语义重构后):
//   root
//   ├─ skyGroup    赤道网格+黄道+本命点/虚点 —— 本命参照系,rotation 恒 0(应星与其余
//   │              星点原地不动=主限 directio 的「应星固定」正统语义)
//   ├─ dirGroup    迫星运动组:被引导点标(本体glyph+相位glyph)+本体星+相位连线 ——
//   │              周日运动播放即本组 rotation.y 补间(rotation.y=θ ⇔ 组内点赤经整体 +θ)
//   ├─ frameGroup  地平三圈(地平/子午/卯酉)+ 天顶/东点/北点标注 —— 观测者系恒静止
//   └─ selGroup    选中行覆盖层:预定路径弧 + 应星位置圈高亮 + 应星圈环/卡 + 渐隐尾迹 + 头顶标签卡
//
// 纯数学(自检公式/目标角/kind 映射)全部住 pdSphereMath(jest 直测);本类只消费。
// 场景常量与点位命名在 ./pdSphere/(sceneConst · pointNames);方法按职责拆在 ./pdSphere/ 下(setupView · frames · points ·
// selection · playback),类后 mixinMethods 挂回原型;构造、渲染循环与销毁留在本类。读源码的检查读「子模块 + 门面」全集。
import { mixinMethods } from '../../utils/mixinMethods';
import { setupViewMethods } from './pdSphere/setupView';
import { frameMethods } from './pdSphere/frames';
import { pointMethods } from './pdSphere/points';
import { selectionMethods } from './pdSphere/selection';
import { playbackMethods } from './pdSphere/playback';
export { PD_COLOR, PD_LEVELS } from './pdSphere/sceneConst';
export { pdStarBaseIds, pointGlyphOf } from './pdSphere/pointNames';

class PDSphereEngine{

	constructor(opt){
		this.dom = opt.dom;
		this.width = opt.width;
		this.height = opt.height;
		this.onError = opt.onError || null; // 建场步骤失败上报(错误卡);缺省 null=仅 console
		this._opt = opt; // 注入点引用(createRenderer/createControls,测试专用)
		this.radius = Math.max(60, Math.min(this.width, this.height) / 2 - 42);

		// 虚点三类独立 toggle(默认相位点开、映点/界关;localStorage 记忆)+聚焦/全显模式
		this.virtualToggles = { aspect: true, antiscia: false, term: false };
		this.focusMode = true; // true=选中退避(柔和 0.55);false=全显不退避
		// 视角档:globe=天球仪外视(既有默认,零观感回归)/ observer=观测者视(按 frame 派生:
		// 面南、东左西右、天顶朝上,周日运动读作肉眼东升西落)。默认 globe——新档效果截图交用户定夺后再议默认。
		this.viewMode = 'globe';
		try{
			const vt = JSON.parse(localStorage.getItem('horosa.pdsphere.virtualToggles') || 'null');
			if(vt && typeof vt === 'object'){ this.virtualToggles = { aspect: !!vt.aspect, antiscia: !!vt.antiscia, term: !!vt.term }; }
			this.focusMode = localStorage.getItem('horosa.pdsphere.focusMode') !== 'all';
			const vm = localStorage.getItem('horosa.pdsphere.viewMode');
			if(vm === 'observer' || vm === 'globe' || vm === 'center'){ this.viewMode = vm; } // 三档
		}catch(_){ }
		// 框架圈分层显隐(用户定案「别的圈也要能选择」):六圈独立开关+标注总开关。
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
		// 拾取监听清理(同 OrbitControls 教训:不摘会闭包吊住引擎)+星空层卸载
		if(this.renderer && this.renderer.domElement && typeof this.renderer.domElement.removeEventListener === 'function'){
			if(this._onPickMove){ this.renderer.domElement.removeEventListener('pointermove', this._onPickMove); }
			if(this._onPickClick){ this.renderer.domElement.removeEventListener('click', this._onPickClick); }
			// 球心档环视监听同拆
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
		// 🔴 球心档必须跳过 OrbitControls.update():其每帧「半径钳回 minDistance(1.15R)
		// + lookAt(球心)」会把居于球心的相机顶出到天顶方向 1.15R 俯视原点(真机=「天顶」大白点居中、
		// 几何全错),并逐帧清洗自定义环视旋转(=拖不动)。enabled=false 只拦输入不拦 update()。
		if(this.orbits && this.viewMode !== 'center'){
			this.orbits.update();
		}
		this.renderer.render(this.scene, this.camera);
	}

}
mixinMethods(PDSphereEngine, setupViewMethods, frameMethods, pointMethods, selectionMethods, playbackMethods);   // 方法按职责拆在 ./pdSphere/ 下(见各文件头),挂回原型

export default PDSphereEngine;
