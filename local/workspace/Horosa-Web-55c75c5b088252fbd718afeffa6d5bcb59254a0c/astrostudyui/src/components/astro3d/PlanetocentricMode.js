// 3D 星盘通用行星中心盘场景构建器(WS-2)。
//
// 一个类吃全部非地心中心(helio/moon/mercury/.../pluto)—— 不给每中心写一个类:
// 中心差异全部由后端 /chart3d/state 的数据决定(bodies 已剔中心体、轨道形态已按
// 周期表推导),本类只负责「把 state 画出来」:
//   - 中心体:太阳=发光球+大光晕(emissive 观感),行星=色球+小光晕;
//   - 各天体按 (lon,lat,dist) 摆放(sph 球面公式;半径两档:sqrt 缩放默认/等半径壳层);
//   - 名牌 = labelSprite.makeTextSprite(billboard 恒可读,与 WS-1 标签同源);
//   - 轨道线 = 后端 orbits 采样点连线(closed 首尾连成环,尾迹开线显逆行环);
//   - 相位线 = 后端 aspects 端点连线(色沿地心盘 Asp 色表);
//   - Earth 高亮描边(BackSide 金壳)= 用户视角锚点,在一切非地心盘中作为天体出现。
//
// 接口:build(state, ctx) / update(newState) / dispose();dispose 纪律照 Astro3D
// disposeGroupDeep 口径(geometry/material/texture 全释放,幂等安全)。
// 坐标框架:黄道系(与地心本命同构,sph 公式同源),root 不带 ASC 旋转 —— 非地心
// 中心物理上无地平,春分点恒在 +x。
import * as THREE from 'three';
import { sph } from './sphMath';
import { norm360 } from './morphMath';
import { makeTextSprite } from './labelSprite';
import * as AstroConst from '../../constants/AstroConst';
import { CENTER_BODY_NAME } from './ephemInterp';

// 天体观感表(色/球半径/名牌):flat 自发光观感(MeshBasicMaterial 不吃场景灯 ——
// 本命组隐藏时其 lightGroup 一并熄灭,覆盖组必须零光照依赖)
const BODY_COLOR = {
	Sun: 0xffc84d,
	Moon: 0xd9d9e3,
	Mercury: 0xb9a487,
	Venus: 0xeccf95,
	Earth: 0x4d9fff,
	Mars: 0xe0603c,
	Jupiter: 0xd8a45f,
	Saturn: 0xe3cf9a,
	Uranus: 0x7fd4d9,
	Neptune: 0x5f7fe8,
	Pluto: 0xc9b09b,
};

const BODY_NAME_CN = {
	Sun: '太阳',
	Moon: '月亮',
	Mercury: '水星',
	Venus: '金星',
	Earth: '地球',
	Mars: '火星',
	Jupiter: '木星',
	Saturn: '土星',
	Uranus: '天王星',
	Neptune: '海王星',
	Pluto: '冥王星',
};

const BODY_SIZE = {
	Sun: 10,
	Moon: 4,
	Mercury: 4.2,
	Venus: 5.4,
	Earth: 5.6,
	Mars: 4.8,
	Jupiter: 8.2,
	Saturn: 7.4,
	Uranus: 6.2,
	Neptune: 6.2,
	Pluto: 3.6,
};

const SIGN_ORDER = [
	AstroConst.ARIES, AstroConst.TAURUS, AstroConst.GEMINI, AstroConst.CANCER,
	AstroConst.LEO, AstroConst.VIRGO, AstroConst.LIBRA, AstroConst.SCORPIO,
	AstroConst.SAGITTARIUS, AstroConst.CAPRICORN, AstroConst.AQUARIUS, AstroConst.PISCES,
];

const EARTH_HIGHLIGHT_COLOR = 0xffd700;   // Earth 高亮金(用户视角锚点)
const MIN_RADIUS_RATIO = 0.07;            // sqrt 档最内圈占比(防天体叠进中心体)
const SHELL_RADIUS_RATIO = 0.92;          // 等半径壳层档半径占比

/** 光晕 sprite(canvas 径向渐变 + additive):太阳大晕=发光球观感,行星小晕提可见性 */
function makeHaloSprite(color, worldSize, opacity){
	const px = 128;
	const canvas = document.createElement('canvas');
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext('2d');
	const c = new THREE.Color(color);
	const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
	const grad = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
	grad.addColorStop(0, `rgba(${rgb},0.9)`);
	grad.addColorStop(0.35, `rgba(${rgb},0.35)`);
	grad.addColorStop(1, `rgba(${rgb},0)`);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, px, px);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		opacity: opacity,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(worldSize, worldSize, 1);
	return sprite;
}

class PlanetocentricMode {

	constructor(){
		this.root = null;
		this.bodiesGroup = null;
		this.orbitGroup = null;
		this.aspectGroup = null;
		this.centerGroup = null;
		this.bodyMap = new Map();      // id → 天体组(球/晕/名牌/描边)
		this.centerBodyId = null;      // 中心体天体名(如 'Mars')
		this.state = null;
		this.ctx = null;               // { radius, shell }
		this._maxDist = 1;
	}

	// —— 布局(半径两档) ——

	/** 距离标尺:取 bodies 与全部轨道采样点的最大 dist(轨道线永不出界) */
	computeScale(state){
		let maxDist = 0;
		(state.bodies || []).forEach((b)=>{
			if(b.dist > maxDist){ maxDist = b.dist; }
		});
		const orbits = state.orbits || {};
		Object.keys(orbits).forEach((id)=>{
			(orbits[id].samples || []).forEach((s)=>{
				if(s.dist > maxDist){ maxDist = s.dist; }
			});
		});
		this._maxDist = maxDist > 0 ? maxDist : 1;
	}

	/** dist(AU)→ 场景半径:sqrt 缩放默认(内行星不糊中心)/ 等半径壳层档 */
	layoutRadius(dist){
		const R = this.ctx.radius;
		if(this.ctx.shell){
			return R * SHELL_RADIUS_RATIO;
		}
		const r = R * Math.sqrt(Math.max(dist, 0) / this._maxDist);
		return Math.max(r, R * MIN_RADIUS_RATIO);
	}

	/** (lon,lat,dist) → 场景坐标(黄道系 sph 公式与本命盘同源) */
	positionOf(lon, lat, dist){
		return sph(lon, lat, this.layoutRadius(dist));
	}

	// —— 悬浮提示数据(与 Astro3D.showPlanetHint 消费形状对齐) ——

	hintPlanet(b){
		const lon = norm360(b.lon);
		return {
			id: b.id,
			name: BODY_NAME_CN[b.id] || b.id,
			lon: b.lon,
			lat: b.lat,
			ra: b.ra,
			decl: b.decl,
			sign: SIGN_ORDER[Math.floor(lon / 30) % 12],
			signlon: lon % 30,
			distAU: b.dist,
			speed: b.speed,
			// 无地平量(非地心中心物理上无地平):altitude/azimuth 缺省,hint 行跳过
		};
	}

	// —— 构建 ——

	/**
	 * 构建场景组并返回(调用方挂到 scene)。
	 * @param {object} state /chart3d/state 响应
	 * @param {object} ctx   { radius: 场景半径, shell: 等半径壳层档 }
	 */
	build(state, ctx){
		this.state = state;
		this.ctx = { radius: ctx.radius, shell: !!ctx.shell };
		this.computeScale(state);

		this.root = new THREE.Group();
		this.root.name = 'PlanetocentricRoot';
		this.orbitGroup = new THREE.Group();
		this.aspectGroup = new THREE.Group();
		this.bodiesGroup = new THREE.Group();
		this.root.add(this.orbitGroup);
		this.root.add(this.aspectGroup);
		this.root.add(this.bodiesGroup);

		this.buildCenter(state);
		(state.bodies || []).forEach((b)=>{
			const grp = this.buildBody(b);
			const p = this.positionOf(b.lon, b.lat, b.dist);
			grp.position.set(p.x, p.y, p.z);
			this.bodyMap.set(b.id, grp);
			this.bodiesGroup.add(grp);
		});
		this.buildOrbits(state);
		this.buildAspects(state);
		return this.root;
	}

	/** 中心体:太阳=发光球+大光晕,行星=色球+光晕;挂 root 原点 */
	buildCenter(state){
		this.centerBodyId = CENTER_BODY_NAME[state.center] || state.center;
		const id = this.centerBodyId;
		const color = BODY_COLOR[id] !== undefined ? BODY_COLOR[id] : 0xffffff;
		const isSun = id === 'Sun';
		const r = isSun ? 16 : Math.max((BODY_SIZE[id] || 6) * 1.8, 9);

		const grp = new THREE.Group();
		grp.name = `PctrCenter_${id}`;
		const mesh = new THREE.Mesh(
			new THREE.SphereGeometry(r, 32, 32),
			new THREE.MeshBasicMaterial({ color: color }),
		);
		grp.add(mesh);
		grp.add(makeHaloSprite(color, isSun ? r * 7 : r * 3.4, isSun ? 0.95 : 0.5));
		const label = makeTextSprite(BODY_NAME_CN[id] || id, { worldSize: 10, color: '#ffffff' });
		label.position.set(0, r + 12, 0);
		grp.add(label);
		if(id === 'Earth'){
			grp.add(this.buildEarthOutline(r));
		}
		this.centerGroup = grp;
		this.root.add(grp);
	}

	/** Earth 高亮描边:BackSide 金壳(轮廓描边经典法,零后处理依赖) */
	buildEarthOutline(r){
		const outline = new THREE.Mesh(
			new THREE.SphereGeometry(r, 32, 32),
			new THREE.MeshBasicMaterial({
				color: EARTH_HIGHLIGHT_COLOR,
				side: THREE.BackSide,
				transparent: true,
				opacity: 0.85,
			}),
		);
		outline.scale.set(1.35, 1.35, 1.35);
		return outline;
	}

	/** 单天体组:色球+光晕+名牌(+Earth 金描边);球体挂 .planet 供拾取悬浮 */
	buildBody(b){
		const id = b.id;
		const color = BODY_COLOR[id] !== undefined ? BODY_COLOR[id] : 0xcccccc;
		const r = BODY_SIZE[id] || 5;
		const isEarth = id === 'Earth';
		const isSun = id === 'Sun';

		const grp = new THREE.Group();
		grp.name = `PctrBody_${id}`;
		const mesh = new THREE.Mesh(
			new THREE.SphereGeometry(r, 24, 24),
			new THREE.MeshBasicMaterial({ color: color }),
		);
		mesh.planet = this.hintPlanet(b);
		mesh.name = id;
		grp.add(mesh);
		grp.add(makeHaloSprite(color, isSun ? r * 5 : r * 2.6, isSun ? 0.85 : 0.35));
		const label = makeTextSprite(BODY_NAME_CN[id] || id, {
			worldSize: 8.5,
			color: isEarth ? '#ffd700' : '#ffffff',
		});
		label.position.set(0, r + 9, 0);
		grp.add(label);
		if(isEarth){
			grp.add(this.buildEarthOutline(r));
		}
		grp.userData._bodyId = id;
		grp.userData._pickMesh = mesh;
		return grp;
	}

	/** 轨道线:closed=首尾相连成环;尾迹=开线(逆行环由采样自然显形);色随天体 */
	buildOrbits(state){
		const orbits = state.orbits || {};
		Object.keys(orbits).forEach((id)=>{
			const orbit = orbits[id];
			const samples = orbit.samples || [];
			if(samples.length < 2){
				return;
			}
			const points = samples.map((s)=>{
				const p = this.positionOf(s.lon, s.lat, s.dist);
				return new THREE.Vector3(p.x, p.y, p.z);
			});
			if(orbit.closed){
				points.push(points[0].clone());   // closed:首尾连
			}
			const geometry = new THREE.BufferGeometry().setFromPoints(points);
			const baseOpacity = orbit.closed ? 0.45 : 0.62;
			const material = new THREE.LineBasicMaterial({
				color: BODY_COLOR[id] !== undefined ? BODY_COLOR[id] : 0x888888,
				transparent: true,
				opacity: baseOpacity,
			});
			const line = new THREE.Line(geometry, material);
			line.userData._orbitId = id;
			line.userData._baseOpacity = baseOpacity;
			this.orbitGroup.add(line);
		});
	}

	/** 相位线:后端 aspects 端点连线;色沿地心盘 Asp 色表(缺省行星描边色) */
	buildAspects(state){
		(state.aspects || []).forEach((asp)=>{
			const grpA = this.bodyMap.get(asp.a);
			const grpB = this.bodyMap.get(asp.b);
			if(!grpA || !grpB){
				return;
			}
			const geometry = new THREE.BufferGeometry().setFromPoints([
				grpA.position.clone(),
				grpB.position.clone(),
			]);
			let color = AstroConst.Astro3DColor['Asp' + asp.aspect];
			if(color === undefined || color === null){
				color = AstroConst.Astro3DColor.PlanetStroke;
			}
			const baseOpacity = 0.8;
			const material = new THREE.LineBasicMaterial({
				color: color,
				transparent: true,
				opacity: baseOpacity,
			});
			const line = new THREE.Line(geometry, material);
			line.userData._baseOpacity = baseOpacity;
			this.aspectGroup.add(line);
		});
	}

	// —— 同中心数据刷新(改时间/开关月球等;换系动画走 Astro3D 的过渡通道) ——

	update(newState){
		if(!this.root){
			return;
		}
		this.state = newState;
		this.computeScale(newState);

		const alive = new Set();
		(newState.bodies || []).forEach((b)=>{
			alive.add(b.id);
			let grp = this.bodyMap.get(b.id);
			if(!grp){
				grp = this.buildBody(b);
				this.bodyMap.set(b.id, grp);
				this.bodiesGroup.add(grp);
			}else{
				const mesh = grp.userData._pickMesh;
				if(mesh){
					mesh.planet = this.hintPlanet(b);
				}
			}
			const p = this.positionOf(b.lon, b.lat, b.dist);
			grp.position.set(p.x, p.y, p.z);
		});
		// 退场天体(如 includeMoon 关闭)
		this.bodyMap.forEach((grp, id)=>{
			if(!alive.has(id)){
				this.bodiesGroup.remove(grp);
				this.disposeDeep(grp);
				this.bodyMap.delete(id);
			}
		});

		this.clearGroup(this.orbitGroup);
		this.clearGroup(this.aspectGroup);
		this.buildOrbits(newState);
		this.buildAspects(newState);
	}

	// —— 拾取 / 淡入淡出配套 ——

	/** 供 Astro3D.getPlanetsAry 拾取(悬浮提示);中心体不参与(无中心相对量) */
	getPickables(){
		const ary = [];
		this.bodyMap.forEach((grp)=>{
			if(grp.userData._pickMesh){
				ary.push(grp.userData._pickMesh);
			}
		});
		return ary;
	}

	/** 全部线材质(轨道+相位)——换系动画 opacity 淡出入用;元素含 _baseOpacity */
	lineMaterials(){
		const mats = [];
		const collect = (group)=>{
			if(!group){
				return;
			}
			group.children.forEach((node)=>{
				if(node.material){
					mats.push({
						material: node.material,
						baseOpacity: node.userData._baseOpacity !== undefined ? node.userData._baseOpacity : 1,
					});
				}
			});
		};
		collect(this.orbitGroup);
		collect(this.aspectGroup);
		return mats;
	}

	// —— 释放(照 Astro3D.disposeGroupDeep 口径:geometry/material/texture 全释放) ——

	disposeDeep(obj){
		if(!obj){
			return;
		}
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

	clearGroup(group){
		if(!group){
			return;
		}
		this.disposeDeep(group);
		group.children = [];
	}

	dispose(){
		if(!this.root){
			return;
		}
		this.disposeDeep(this.root);
		if(this.root.parent){
			this.root.parent.remove(this.root);
		}
		this.bodyMap.clear();
		this.root = null;
		this.bodiesGroup = null;
		this.orbitGroup = null;
		this.aspectGroup = null;
		this.centerGroup = null;
		this.state = null;
	}

}

export default PlanetocentricMode;
export { BODY_NAME_CN, BODY_COLOR };
