// 3D 星盘 · 调节面板:相机 / 地球 / 配色 / 星体各组、二十八宿选择、环境光、星体显隐与距离缩放、斗柄
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min';
import * as AstroConst from '../../../constants/AstroConst';
import { sph } from '../sphMath';
import { getPlanetRadius } from './bodyScale';
import { traverseMaterials, ChartOptKey, CAM_DIST_RATIO_MIN, SUN_INTENSITY_DEFAULT, AMBIENT_INTENSITY_DEFAULT, colorToHex } from './sceneConst';

export const guiMethods = {
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

		let camdist = folder.add(this.chartOpt, '摄像机与球心距离', CAM_DIST_RATIO_MIN, this.maxCamDistRatio).step(0.1);   // 半径倍数
		camdist.onChange((val)=>{
			safeLocalStorageSet(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

	},

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

	},

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
		let sunIns = colorFolder.add(this.chartOpt, '太阳光强度', 0, SUN_INTENSITY_DEFAULT);   // 范围收窄到有效段(缺省 = 封顶,再往上无变化)
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
		let ambIns = colorFolder.add(this.chartOpt, '环境光强度', 0, AMBIENT_INTENSITY_DEFAULT);   // 范围收窄到有效段(缺省 = 封顶)
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

	},

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

	},

	selectSu28(){
		let val = this.chartOpt['使用虚拟28宿'];
		this.group.remove(this.su28Group);
		this.group.remove(this.su28VirGroup);
		if(val){
			this.group.add(this.su28VirGroup);
		}else{
			this.group.add(this.su28Group);
		}
		// 运行时切换只走这里(建盘时是 selectSu28 → hideStars 两步):挂回所选一组后再按「隐藏28宿距星」应用一次,
		// 此前隐藏开着时切换,距星组被无条件挂回 → 开关显示「隐藏」画面却有距星
		if(this.chartOpt['隐藏28宿距星']){
			this.hideStars(true, val ? this.su28VirGroup : this.su28Group);
		}
	},

	// 环境光两档对星点精灵的可见效果(强度→透明度,锚=缺省;颜色→tint):建盘与运行时改共用一处
	applyAmbientToSprite(sprite){
		if(!sprite || !sprite.material){ return; }
		const ins = Number(this.chartOpt['环境光强度']);
		if(Number.isFinite(ins)){
			sprite.material.opacity = Math.max(0, Math.min(1, ins / AMBIENT_INTENSITY_DEFAULT));
			sprite.material.transparent = true;
		}
		const col = this.chartOpt['环境光颜色'];
		if(col !== undefined && col !== null){
			try{ sprite.material.color.setHex(colorToHex(col)); }catch(e){ /* 非法色值忽略 */ }
		}
	},

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
	},

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
	},

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
	},

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
	},

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
	},
};
