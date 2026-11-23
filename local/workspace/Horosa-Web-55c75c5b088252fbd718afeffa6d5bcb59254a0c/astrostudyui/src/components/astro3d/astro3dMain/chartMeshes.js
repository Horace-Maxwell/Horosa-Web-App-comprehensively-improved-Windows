// 3D 星盘 · 盘面网格与文字:地球显隐、圆与刻度、宫 / 星座 / 经纬度 / 行星 / 相位文字、行星与相位网格、轴线与宫位
// 从 Astro3D.js 按职责拆出的 Astro3D 方法:this 仍是 Astro3D 实例,门面里 mixinMethods(Astro3D, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import * as AstroConst from '../../../constants/AstroConst';
import { astro3dSpriteLabelsEnabled } from '../../../utils/perfFlags';
import { sph } from '../sphMath';
import { makeTextSprite, makeStarSprite } from '../labelSprite';
import * as AstroText from '../../../constants/AstroText';
import * as AstroHelper from '../../astro/AstroHelper';
import { getPosOffset } from './bodyScale';
import { SUN_INTENSITY_DEFAULT, colorToHex } from './sceneConst';

export const chartMeshMethods = {
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
	},

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
	},

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
	},

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

	},

	genFullCircle(radius, color){
		let circle = new THREE.EllipseCurve(0, 0, radius, radius,
			0, 2*Math.PI, false, 0);
		let points = circle.getPoints(50);
		let geometry = new THREE.BufferGeometry().setFromPoints( points );
		let material = new THREE.LineBasicMaterial( { color : color } );
		let line = new THREE.Line(geometry, material);
		return line;
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
				if(halo.material && Number.isFinite(_si)){ halo.material.opacity = Math.max(0, Math.min(1, _si / SUN_INTENSITY_DEFAULT)); }
				// 建盘同时应用「太阳光颜色」色调(此前只运行时改才生效)
				{ const _sc = this.chartOpt['太阳光颜色']; if(halo.material && _sc !== undefined && _sc !== null){ try{ halo.material.color.setHex(colorToHex(_sc)); }catch(e){ /* 非法色值忽略 */ } } }
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
	},

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
	},

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
	},

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
	},

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

	},

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
	},

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
	},

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

	},

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
	},
};
