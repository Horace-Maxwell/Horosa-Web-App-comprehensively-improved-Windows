// 天文馆 · Babylon 场景渲染器(类本体:构造与销毁;其余方法按职责拆在同目录 renderer*.js,类后 mixinMethods 挂回原型)。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { pointerLocalRatio } from '../../../utils/zoomDomain';
import { BABYLON, STAR_MAG_LIMIT_MAX, DEFAULT_LAYERS } from './constants';
import { LabelUploadQueue } from './labelUploadQueue';
import { mixinMethods } from '../../../utils/mixinMethods';
import { rendererSceneMethods } from './rendererScene';
import { rendererViewMethods } from './rendererView';
import { rendererProjectionMethods } from './rendererProjection';
import { rendererStarMethods } from './rendererStars';
import { rendererGridMethods } from './rendererGrids';
import { rendererAsterismMethods } from './rendererAsterisms';
import { rendererInteractionMethods } from './rendererInteraction';
import { nowMs } from './skyMath';
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
		// 名牌纹理画完隔两帧再上传(见 labelUploadQueue.js);渲染循环每帧 tick
		this._labelUploads = new LabelUploadQueue();
		this._surfaceTextures = new Map();   // 日月行星表面贴图,跨全量重建留用(见 createSurfaceTexture)
		this._surfaceMats = [];              // 正挂着留用贴图的材质,清场前要先摘
		this.disposed = false;
		this._asterismBuildToken = 0;
		this._asterismBuildJob = null;
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
				|| (t < this._settleUntil)
				// 名牌上传队列按「帧」计龄、每帧只传一小片:队列未空时保持满帧,否则静止降帧会把几十张名牌拖成数秒才露齐
				|| (this._labelUploads.size > 0);
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
		this._labelUploads.tick();
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
		this._labelUploads.tick();
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
		this.disposeSurfaceTextures();
		this._labelUploads.clear();
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
mixinMethods(PlanetariumRenderer, rendererSceneMethods, rendererViewMethods, rendererProjectionMethods, rendererStarMethods, rendererGridMethods, rendererAsterismMethods, rendererInteractionMethods);   // 方法按职责拆在同目录各文件里(见各文件头),挂回原型
