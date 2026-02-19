import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import Stats from 'three/examples/jsm/libs/stats.module';
import dat from 'three/examples/jsm/libs/dat.gui.module';
import ywastrochart from '../../assets/ywastrochart.json';
import helvetica from '../../assets/helvetica.json';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import { Chart3DServer,} from '../../utils/constants';
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

function traverseMaterials (object, callback) {
	object.traverse((node) => {
		if (!node.isMesh) return;
		const materials = Array.isArray(node.material) ? node.material : [node.material];
		materials.forEach(callback);
	});
}


const ChartOptKey = 'chart3dOpt';
  
class Astro3D {
	constructor(option){
		this.maxCamDistRatio = 30;
		this.radiusOffset = 50;
		this.initOption(option);

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

		this.normalFont = new THREE.Font(helvetica);
		this.chartFont = new THREE.Font(ywastrochart);

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
			let opt = JSON.parse(json);
			this.chartOpt = {
				...this.chartOpt,
				...opt,
			};
		}
		this.chartOpt.maxEarthRadius = this.radius - 20;

		let dom = document.getElementById(this.chartId);
		this.planetHintDiv = document.createElement('div');
		this.planetHintDiv.className = styles.astro3dtap;
		dom.appendChild(this.planetHintDiv);

		this.disposed = false;
		this.rafId = null;

		this.mouseVec = new THREE.Vector2();
		this.clickHandler = this.clickHandler.bind(this);
		this.touchHandler = this.touchHandler.bind(this);
	}

	getPlanetsAry(){
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

		this.disposeMesh();
		this.initOption(option);
		this.chartOpt.maxEarthRadius = this.radius - 20;

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

		this.disposed = false;
	}

	resize(width, height){
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
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
		if(intersects.length){
			intersects.forEach((obj)=>{
				this.showPlanetHint(obj)
			});	
		}else{
			this.hidePlanetHint();
		}
	}

	showPlanetHint(obj){
		let vec = obj.point;
		let planet = obj.object.planet;
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
		let name = `<li>${ntxt}，${AstroText.AstroMsgCN[planet.sign]}座${degparts[0]}º${degparts[1]}'</li>`;
		let lon = `<li>黄经：${Math.round(planet.lon*1000)/1000}º</li>`;
		let lat = `<li>黄纬：${Math.round(planet.lat*1000)/1000}º</li>`;
		let ra = `<li>赤经：${Math.round(planet.ra*1000)/1000}º</li>`;
		let decl = `<li>赤纬：${Math.round(planet.decl*1000)/1000}º</li>`;
		let altitude = `<li>真地平纬度：${Math.round(planet.altitudeTrue*1000)/1000}º</li>`;
		let altitudeAppa = `<li>视地平纬度：${Math.round(planet.altitudeAppa*1000)/1000}º</li>`;
		let azimuth = `<li>地平经度：${getAzimuthStr(planet.azimuth)}`;
		let dom = `<ul>${name}${lon}${lat}${ra}${decl}${altitude}${altitudeAppa}${azimuth}</ul>`;

		let xy = this.transPosition(vec);
		let w = 300;
		let h = 180;

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
		this.planetHintDiv.style.height = h + 'px';

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
		let x = event.changedTouches[0].clientX;
		let y = event.changedTouches[0].clientY;
		this.mouseVec.x = (x / this.width) * 2 - 1;
		this.mouseVec.y = -(y / this.height) * 2 + 1;
		this.calcMousePoint();	
	}

	registerClick(){
		let dom = document.getElementById(this.chartId);
		dom.addEventListener('click', this.clickHandler);
		dom.addEventListener('touchend', this.touchHandler);
	}

	unregisterClick(){
		let dom = document.getElementById(this.chartId);
		dom.removeEventListener('click', this.clickHandler);
		dom.removeEventListener('touchend', this.touchHandler);
	}

	playAllClips() {
		this.clips.forEach((clip) => {
			this.mixer.clipAction(clip).reset().play();
		});
	}

	init(){	
		setLoading(true);

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

		const manager = new THREE.LoadingManager();
		let loader = new GLTFLoader(manager);
		loader.setCrossOrigin('*');
		const dracoLoader = new DRACOLoader();
		loader.setDRACOLoader( dracoLoader );
		const modelSources = [
			{
				name: 'local',
				modelUrl: './gltf/planets4k.glb',
				decoderPath: './gltf/draco/',
			},
			{
				name: 'remote',
				modelUrl: `${Chart3DServer}/gltf/planets4k.glb`,
				decoderPath: `${Chart3DServer}/gltf/draco/`,
			},
		];
		let sourceIdx = 0;
		let settled = false;
		let timeoutId = setTimeout(()=>{
			if(settled){
				return;
			}
			settled = true;
			this.initMesh();
			this.initGUI();
			console.warn('3D model loading timeout, fallback to simplified mode.');
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
					console.warn(`[Astro3D] load from ${source.name} failed`, err);
					sourceIdx += 1;
					if(sourceIdx < modelSources.length){
						loadModel();
						return;
					}
					settled = true;
					clearTimeout(timeoutId);
					this.initMesh();
					this.initGUI();
					console.warn('3D model unavailable, fallback to simplified mode.');
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
				if(itm instanceof THREE.Mesh){
					itm.geometry.dispose();
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
			mesh.geometry.dispose();
			mesh.material.dispose();
		});
		this.planetEarthMap.clear();
	}

	dispose(){
		this.disposed = true;
		if(this.rafId){
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
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

	initCameraGUI(){
		let folder = this.gui.addFolder('摄像机');
		let camrot = folder.add(this.chartOpt, '摄像机旋转');
		camrot.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.orbits.autoRotate = val;
		});

		let camfov = folder.add(this.chartOpt, '摄像机视野', 30 , 120);
		camfov.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.camera.fov = val;
			this.camera.updateProjectionMatrix();
		})

		let camlon = folder.add(this.chartOpt, '摄像机天球经度', 0 , 360);
		camlon.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

		let camlat = folder.add(this.chartOpt, '摄像机天球纬度', -90 , 90);
		camlat.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

		let camdist = folder.add(this.chartOpt, '摄像机与球心距离', this.radius * 2 , this.radius * this.maxCamDistRatio);
		camdist.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.setupCameraPos();
		})

	}

	initEarthGUI(){
		let earthFolder = this.gui.addFolder('地球');

		const encodingCtrl = earthFolder.add(this.chartOpt, '纹理编码', ['sRGB', 'Linear']);
		encodingCtrl.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.updateTextureEncoding();
		});

		let minR = getPlanetRadius(AstroConst.VENUS);
		let earthR = earthFolder.add(this.chartOpt, '地球半径', minR, this.chartOpt.maxEarthRadius);
		earthR.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.initEarth();
			if(this.chartOpt['隐藏地球附近星体']){
				this.hideEarthPlanets()
			}	
		});

		let cloud = earthFolder.add(this.chartOpt, '有云地球');
		cloud.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.initEarth();
			if(this.chartOpt['隐藏地球附近星体']){
				this.hideEarthPlanets()
			}	
		});

		let hideEarth = earthFolder.add(this.chartOpt, '隐藏地球');
		hideEarth.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarth()
		});

		let earthAx = earthFolder.add(this.chartOpt, '地球自转轴');
		earthAx.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarthAxes()
		});

		let hideEarthPlanets = earthFolder.add(this.chartOpt, '隐藏地球附近星体');
		hideEarthPlanets.onChange(()=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.hideEarthPlanets()
		});

	}

	initColorGUI(){
		let colorFolder = this.gui.addFolder('颜色');

		let bk = colorFolder.addColor(this.chartOpt, '星盘背景');
		bk.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			let color = val;
			if(this.renderer){
				this.renderer.setClearColor(color);
			}
		});

		let sunC = colorFolder.addColor(this.chartOpt, '太阳光颜色');
		sunC.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			let value = val;
			if ( typeof value === 'string' ) {
				value = value.replace( '#', '0x' );
			}
			this.sunDirectLight.color.setHex(value);
		});
		let sunIns = colorFolder.add(this.chartOpt, '太阳光强度', 0, 10);
		sunIns.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.sunDirectLight.intensity = val;
		});

		let ambC = colorFolder.addColor(this.chartOpt, '环境光颜色');
		ambC.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
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
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.lightGroup.children.map((item, idx)=>{
				if(item.name && item.name === 'AmbientLight'){
					item.intensity = val;
				}
			});
		});

		let txtC = colorFolder.addColor(this.chartOpt, '文本颜色');
		txtC.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
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
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.distStars(val);
		});

		let starRadius = starFolder.add(this.chartOpt, '恒星半径', 0.5, 8);
		starRadius.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt))
			this.scaleStars(val);
		});

		let su28Type = starFolder.add(this.chartOpt, '使用虚拟28宿');
		su28Type.onChange((val)=>{
			localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt));
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
		localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt));
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
		localStorage.setItem(ChartOptKey, JSON.stringify(this.chartOpt));
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
		this.gui = new dat.GUI({
			width: 240,
			hideable: true,
		});

		this.initCameraGUI();
		this.initEarthGUI();
		this.initColorGUI();
		this.initStarGUI();

		let dom = document.getElementById(this.chartId);
		dom.appendChild(this.gui.domElement);
		this.gui.domElement.style = 'position: absolute; right: -10px; top: 10px;'
		this.gui.close();
	}

	distStars(val){
		let r = this.radius + val;
		this.beijiMap.forEach((star)=>{
			let y = r * Math.sin(star.planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.planet.lon * Math.PI / 180);
			star.position.set(x, y, z);	
		});
		this.starMap.forEach((star)=>{
			let y = r * Math.sin(star.planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.planet.lon * Math.PI / 180);
			star.position.set(x, y, z);	
		});
		this.su28Map.forEach((star)=>{
			let y = r * Math.sin(star.planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.planet.lon * Math.PI / 180);
			star.position.set(x, y, z);	
		});
		this.su28VirMap.forEach((star)=>{
			let y = r * Math.sin(star.planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.planet.lon * Math.PI / 180);
			star.position.set(x, y, z);	
		});
		this.beidouMap.forEach((star)=>{
			let y = r * Math.sin(star.planet.lat * Math.PI / 180);
			let tmpR = r * Math.cos(star.planet.lat * Math.PI / 180);
			let x = tmpR * Math.cos(star.planet.lon * Math.PI / 180);
			let z = -tmpR * Math.sin(star.planet.lon * Math.PI / 180);
			star.position.set(x, y, z);	
		});

		this.group.remove(this.doubingGroup);
		this.disposeGroup(this.doubingGroup);
		this.doubingGroup.children = [];
		this.genDoubingLine();
	}

	scaleStars(val){
		this.beijiMap.forEach((star)=>{
			let ratio = 1 / star.geometry.boundingBox.max.y * val;
			star.scale.set(ratio, ratio, ratio);
		});
		this.starMap.forEach((star)=>{
			let ratio = 1 / star.geometry.boundingBox.max.y * val;
			star.scale.set(ratio, ratio, ratio);
		});
		this.su28Map.forEach((star)=>{
			let ratio = 1 / star.geometry.boundingBox.max.y * val;
			star.scale.set(ratio, ratio, ratio);
		});
		this.su28VirMap.forEach((star)=>{
			let ratio = 1 / star.geometry.boundingBox.max.y * val;
			star.scale.set(ratio, ratio, ratio);
		});
		this.beidouMap.forEach((star)=>{
			let ratio = 1 / star.geometry.boundingBox.max.y * val;
			star.scale.set(ratio, ratio, ratio);
		});
	}

	initStats() {
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
		let y = r * Math.sin(lat * Math.PI / 180);
		let tmpR = r * Math.cos(lat * Math.PI / 180);
		let x = tmpR * Math.cos(lon * Math.PI / 180);
		let z = -tmpR * Math.sin(lon * Math.PI / 180);
		this.camera.position.set(x, y, z);
		this.camera.lookAt(this.scene.position);
		this.camera.updateProjectionMatrix();
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
		this.renderer.outputEncoding = this.chartOpt['纹理编码'] === 'sRGB' ? THREE.sRGBEncoding : THREE.LinearEncoding;
		this.renderer.gammaFactor = 2.2;
		this.renderer.physicallyCorrectLights = true;
		this.renderer.setSize(this.width, this.height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(this.chartOpt['星盘背景']);

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		let dom = document.getElementById(this.chartId);
		dom.appendChild(this.renderer.domElement);
	}

	updateTextureEncoding() {
		const encoding = this.chartOpt['纹理编码'] === 'sRGB' ? THREE.sRGBEncoding : THREE.LinearEncoding;
		this.renderer.outputEncoding = encoding;
		traverseMaterials(this.group, (material) => {
			if (material.map) material.map.encoding = encoding;
			if (material.emissiveMap) material.emissiveMap.encoding = encoding;
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
		let txtGeom = new THREE.TextGeometry(text, {
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
		let txtGeom = new THREE.TextGeometry(text, {
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

		let cl = this.chartOpt['文本颜色'];

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
		let txtGeom = new THREE.TextGeometry(text, {
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
		let group = new THREE.Group();
		for(let i=0; i<360; i++){
			let grp = new THREE.Group();
			let lon = null;
			if(needSig){
				lon = this.genDegree(R, color, i);
			}else{
				lon = this.genCircle(R, color, i);
			}
			grp.add(lon);

			if(i % 30 === 0){
				let txt = i + 'º';
				let degtxt = this.genText(txt, 3);
				degtxt.position.set(R, 0, 0);
				degtxt.rotateY(Math.PI/2);
				grp.add(degtxt);	
			}else if(i % 15 === 0){
				let txt = i + 'º';
				let degtxt = this.genText(txt, 3);
				degtxt.position.set(R, 0, 0);
				degtxt.rotateY(Math.PI/2);
				grp.add(degtxt);
			}else if(needSig && i > 0 && (i+1)%15 === 0 && (i+1)%30 !== 0){
				let degtxt = this.genSignText(i);
				let offset = -5;
				let x = R * Math.cos(offset * Math.PI / 180);
				let z = 0;
				let y = R * Math.sin(offset * Math.PI / 180);
				degtxt.position.set(x, y, z);	
				degtxt.rotateY(Math.PI/2);
				grp.add(degtxt);	
			}

			if(i > 0){
				grp.rotateY(i * Math.PI / 180);
			}
			group.add(grp);
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
		let ic = AstroHelper.getObject(this.chartObj, AstroConst.MC);
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
		}

		let txtGeom = new THREE.TextGeometry(text, {
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

		let txtGeom = new THREE.TextGeometry(text, {
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
				this.skyGroup.add(mesh);
			}
		}

	}

	initAspects(){
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
		this.skyGroup.add(arrow1);

		let arrow2 = new THREE.ArrowHelper(dir2, angVecs[3], len2, hex, hLen, hWid);
		this.skyGroup.add(arrow2);

	}

	initHouses(r, color){
		let group = new THREE.Group();
		let houses = this.chartObj.chart.houses;
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let grp = new THREE.Group();
			let deg = house.lon;
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

		this.skyGroup.add(group);
	}

	initSkyBall(){
		let longroup = this.initLonLine(this.radius, AstroConst.Astro3DColor.SkyLine, true);
		let latgroup = this.initLatLine(this.radius, AstroConst.Astro3DColor.SkyLine, true);

		this.skyGroup.add(longroup);
		this.skyGroup.add(latgroup);

		this.initPlanets(this.radius, this.planetMap, 16);
		this.initAspects();
		this.initAxesLines();

		let r = this.radius;
		this.initHouses(r, AstroConst.Astro3DColor.SkyLine);
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
		let ic = AstroHelper.getObject(this.chartObj, AstroConst.MC);
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
		stars.forEach((star)=>{
			if(modelId !== 'Su28' && (this.su28Map.has(star.id) || this.su28Map.has(star.id) || 
				this.beidouMap.has(star.id) || this.beijiMap.has(star.id))){
				return;
			}

			let txt = AstroText.AstroMsg.Unknown;
			let mesh = this.genPlanetText(modelId, txt, AstroConst.Astro3DColor.PlanetStroke, 1);
			if(mesh.geometry.boundingBox === null){
				mesh.geometry.computeBoundingBox();
			}
			let starR = this.chartOpt['恒星半径'];
			let ratio = 1 / mesh.geometry.boundingBox.max.y * starR;
			mesh.scale.set(ratio, ratio, ratio);
			
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
		controls.enableDamping = false;  // 使动画循环使用时阻尼或自转 意思是否有惯性 
		controls.enableZoom = true;    //是否可以缩放 
		controls.minDistance = 0.1;   //设置相机距离原点的最近距离 
		controls.maxDistance = this.radius * this.maxCamDistRatio;  //设置相机距离原点的最远距离 
		controls.enablePan = true;   //是否开启右键拖拽
		
		this.orbits = controls;
	}
	
	animate(){
		if(this.disposed){
			this.rafId = null;
			return;
		}
		if(!this.hide){
			this.render();
		}
		this.rafId = window.requestAnimationFrame(()=>{
			this.animate();
		});
	}

	render(){
		this.orbits.update();
		this.stats.update();

		if(this.renderer === null){
			return;
		}

		this.renderer.render(this.scene, this.camera);
	}

}

export default Astro3D;
