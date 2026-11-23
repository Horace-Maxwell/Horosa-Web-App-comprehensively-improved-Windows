// 3D 星盘 · 搭建与释放:初始化、网格 / 地球释放与整体销毁、应用选项、性能面板、场景 / 相机 / 光照 / 渲染器、纹理编码
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from '../vendor/DRACOLoader';
import Stats from 'three/examples/jsm/libs/stats.module';
import * as AstroConst from '../../../constants/AstroConst';
import { ensureAstroFont } from '../labelSprite';
import * as AstroHelper from '../../astro/AstroHelper';
import { setLoading, setLoadingText } from '../../../utils/request';
import { getPosOffset } from './bodyScale';
import { markModelUnavailableNow, clearModelUnavailableMark, shouldSkipModelLoad } from './modelAvailability';
import { traverseMaterials, ChartOptKey, SUN_INTENSITY_DEFAULT, AMBIENT_INTENSITY_DEFAULT } from './sceneConst';

export const setupTeardownMethods = {
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

	},

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
	},

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
	},

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
	},

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
	},

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
				this.group.traverse((o)=>{ if(o.name === 'SunHalo' && o.material){ o.material.opacity = Math.max(0, Math.min(1, val / SUN_INTENSITY_DEFAULT)); } });
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
					const op = Math.max(0, Math.min(1, val / AMBIENT_INTENSITY_DEFAULT));   // 锚=缺省(此前锚 0.7、缺省 0.3:首次碰滑杆星点骤暗到 43%)
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
	},

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
    },

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
	},

	initCamera(){
		let fov = this.chartOpt['摄像机视野'];
		this.camera = new THREE.PerspectiveCamera(fov, this.width / this.height, 0.1, this.radius * this.maxCamDistRatio);
		this.setupCameraPos()
	},

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
	},

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
	},

	updateTextureEncoding() {
		// r0.185:纹理侧 .encoding 已废,改 .colorSpace(输出侧同名迁移 outputColorSpace)。
		const colorSpace = this.chartOpt['纹理编码'] === 'sRGB' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
		this.renderer.outputColorSpace = colorSpace;
		traverseMaterials(this.group, (material) => {
			if (material.map) material.map.colorSpace = colorSpace;
			if (material.emissiveMap) material.emissiveMap.colorSpace = colorSpace;
			if (material.map || material.emissiveMap) material.needsUpdate = true;
		});
	},
};
