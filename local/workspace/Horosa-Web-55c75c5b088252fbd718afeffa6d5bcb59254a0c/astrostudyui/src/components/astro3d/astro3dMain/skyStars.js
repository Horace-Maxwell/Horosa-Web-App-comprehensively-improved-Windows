// 3D 星盘 · 天球与恒星:天球、地球经线与地球、恒星、二十八宿、星体、双星圈与斗柄线、整盘网格
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import * as AstroConst from '../../../constants/AstroConst';
import { astro3dSpriteLabelsEnabled } from '../../../utils/perfFlags';
import { makeStarSprite } from '../labelSprite';
import * as AstroText from '../../../constants/AstroText';
import * as AstroHelper from '../../astro/AstroHelper';
import { calcNormalVector } from '../../graph/GraphHelper';

export const skyStarMethods = {
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
	},

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
	},

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

	},

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
				this.applyAmbientToSprite(mesh);   // 建盘即按环境光强度/颜色应用
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
	},

	initSu28(){
		let stars = this.chartObj.chart.su28Adjust;
		let modelId = 'Su28';
		this.initFixedStars(stars, modelId, this.su28Map, this.su28Group);

		stars = this.chartObj.chart.su28Virtual;
		modelId = 'Su28';
		this.initFixedStars(stars, modelId, this.su28VirMap, this.su28VirGroup);
	},

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

	},

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
	},

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
	},

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
	},

	genDoubingLine(){
		let mesh = this.initTwoStarCircle('Mizar', 'Alkaid');
		this.doubingGroup.add(mesh);
		this.showDoubing(this.chartOpt['显示斗柄连线']);
	},

	initMesh(){
		this.initSkyBall();
		this.initEarth();
		this.initStars();

		this.genDoubingLine();

		let asc = AstroHelper.getObject(this.chartObj, AstroConst.ASC);
		this.group.rotateY((270-asc.lon) * Math.PI / 180);
		if(this.camera){ this.setupCameraPos(); }   // 组旋转后按黄道经纬重定相机(初建时相机先于组旋转定位)

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
	},
};
