// 主限天球引擎 · 天球结构线:黄道、框架图层、宫首、赤道网格、赤纬圈 / 大圆线与管、地平三圈、信标强调
// 从 PDSphereEngine.js 按职责拆出的 PDSphereEngine 方法:this 仍是 PDSphereEngine 实例,门面里 mixinMethods(PDSphereEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { sph } from '../sphMath';
import { makeTextSprite } from '../labelSprite';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { unitOf, zenithOf, eastPointOf, northPointOf, greatCircleThrough } from '../pdSphereMath';
import { houseCusps, eclLonToEq, cuspSystemOfFrame } from '../pdHouseCusps';
import { PD_COLOR, PD_LEVELS, TWO_PI, GreatCircleCurve } from './sceneConst';

export const frameMethods = {
	// —— 黄道大圈(金色)+「黄道」标注+春分点标记:挂 skyGroup 随周日转(天文正确) ——
	// λ→赤道系:decl=asin(sinε·sinλ), ra=atan2(cosε·sinλ, cosλ);ε 取当日真黄赤交角。
	_buildEcliptic(frame){
		const R = this.radius;
		const eps = ((frame && (frame.eps || frame.epsMean)) || 23.44) * Math.PI / 180;
		const eclPoint = (lambdaDeg, radius)=>{
			const lam = lambdaDeg * Math.PI / 180;
			const decl = Math.asin(Math.sin(eps) * Math.sin(lam)) * 180 / Math.PI;
			const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI;
			return sph(ra, decl, radius);
		};
		const pts = [];
		for(let i = 0; i <= 144; i += 1){
			const p = eclPoint(i * 2.5, R);
			pts.push(new THREE.Vector3(p.x, p.y, p.z));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
			color: 0xd9a94e, transparent: true, opacity: 0.9,
		}));
		// 黄道圈层组:线+30° 刻度=圈体;春分点/圈名/星座 glyph=标注子组
		const gEcl = this._frameLayerGroup('ecliptic', this.skyGroup);
		gEcl.grp.add(line);
		// 春分点(λ=0)小标 + 圈名标注(λ=100° 处,避开春分标)
		const vp = eclPoint(0, R);
		const vpDot = new THREE.Mesh(
			new THREE.SphereGeometry(Math.max(1, R * 0.009), 10, 10),
			new THREE.MeshBasicMaterial({ color: 0xd9a94e })
		);
		vpDot.position.set(vp.x, vp.y, vp.z);
		gEcl.labelSub.add(vpDot);
		const vpLabel = makeTextSprite('春分点', { worldSize: Math.max(6, R * 0.045), color: '#d9a94e', glow: true });
		const vlp = eclPoint(0, R * 1.06);
		vpLabel.position.set(vlp.x, vlp.y, vlp.z);
		gEcl.labelSub.add(vpLabel);
		const nameLabel = makeTextSprite('黄道', { worldSize: Math.max(7, R * 0.05), color: '#e7bd75', glow: true });
		const nlp = eclPoint(100, R * 1.05);
		nameLabel.position.set(nlp.x, nlp.y, nlp.z);
		gEcl.labelSub.add(nameLabel);
		// 12 星座符号刻度环+30° 刻度短线:黄道带任何视角一眼可辨(体检「黄道易误认」)。
		// emoji → ywastrochart 字形('a'-'l',与 2D 盘同源;emoji 走系统彩色字体=丑+跨端漂移)。
		const SIGN_GLYPHS = [
			AstroConst.ARIES, AstroConst.TAURUS, AstroConst.GEMINI, AstroConst.CANCER,
			AstroConst.LEO, AstroConst.VIRGO, AstroConst.LIBRA, AstroConst.SCORPIO,
			AstroConst.SAGITTARIUS, AstroConst.CAPRICORN, AstroConst.AQUARIUS, AstroConst.PISCES,
		].map((id)=>`${AstroText.AstroMsg[id] || ''}`);
		// 南半球读法:天球上各点画的是真位置,星座标签相对真黄经转了 labelTurn 度(回包给;普通盘没有这一项 = 0)
		const labelTurnSigns = ((Math.round((Number(this.res && this.res.labelTurn) || 0) / 30) % 12) + 12) % 12;
		for(let k = 0; k < 12; k += 1){
			const lam0 = k * 30;
			const pIn = eclPoint(lam0, R * 0.985);
			const pOut = eclPoint(lam0, R * 1.03);
			const tick = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(pIn.x, pIn.y, pIn.z),
					new THREE.Vector3(pOut.x, pOut.y, pOut.z),
				]),
				new THREE.LineBasicMaterial({ color: PD_COLOR.ecliptic, transparent: true, opacity: 0.8 })
			);
			gEcl.grp.add(tick);
			const gl = makeTextSprite(SIGN_GLYPHS[(k + labelTurnSigns) % 12], { worldSize: Math.max(5.5, R * 0.04), color: '#d8ab52', minLuma: 0.55, fontFamily: 'ywastrochart' });
			const gp = eclPoint(lam0 + 15, R * 1.05);
			gl.position.set(gp.x, gp.y, gp.z);
			gEcl.labelSub.add(gl);
		}
	},

	// —— 赤道坐标框架:24 时圈(=12 条过天极大圆)细线 + 赤纬 0/±30/±60 圈 ——
	/** 圈层组:每个框架圈一个 Group(圈体)+内嵌 labelSub(文字/方位点)。
	 *  圈开关控 grp.visible,标注总开关控 labelSub.visible —— 嵌套可见性天然实现「圈开∧标注开」。 */
	_frameLayerGroup(key, parent){
		const grp = new THREE.Group();
		const labelSub = new THREE.Group();
		grp.add(labelSub);
		parent.add(grp);
		grp.visible = this.frameLayers[key] !== false;
		labelSub.visible = this.frameLayers.labels !== false;
		this._frameLayerGroups[key] = { grp, labelSub };
		return { grp, labelSub };
	},

	/** 外部开关:圈层显隐(Pane 顶栏 checkbox 调用;写 localStorage + 就地生效) */
	setFrameLayers(patch){
		this.frameLayers = { ...this.frameLayers, ...(patch || {}) };
		safeLocalStorageSet('horosa.pdsphere.frameLayers', JSON.stringify(this.frameLayers)); // FL-4 配额纪律:与本文件其余持久键同走 safeStorage
		Object.keys(this._frameLayerGroups).forEach((k)=>{
			const ent = this._frameLayerGroups[k];
			if(!ent){ return; }
			ent.grp.visible = this.frameLayers[k] !== false;
			ent.labelSub.visible = this.frameLayers.labels !== false;
		});
		this.wake(2);
	},

	/** 后天宫位宫首显示开关。宫制随「定局分宫」pdFrame(见 setPdFrame);
	 *  宫首=固定征象点(挂 skyGroup 恒 0 → 播放中不动,与真值一致)。 */
	setHouseDisplay(on){
		this._showHouses = !!on;
		this._rebuildHouseCusps();
	},

	/** 定局分宫切换:宫首宫制随之重算(与 2D 盘 pane 同口径;值同 pdFrame 白名单)。 */
	setPdFrame(frame){
		const next = `${frame || 'alcabitius'}`;
		if(this._pdFrame === next){ return; }
		this._pdFrame = next;
		this._rebuildHouseCusps();
	},

	/** 重建 12 宫首:黄道面内径向短刻度 + 宫号 1-12(客户端 pdHouseCusps 由 frame armc/phi/eps 算)。
	 *  campanus 等分宫涉卯酉圈的系统只出四轴(cusps 中间宫为 null,跳过)。setData 与 toggle 均调。 */
	_rebuildHouseCusps(){
		if(!this._houseGroup){ this._houseGroup = new THREE.Group(); this.skyGroup.add(this._houseGroup); }
		this._clearGroup(this._houseGroup);
		if(!this._showHouses || !this.res || !this.res.frame){ this.wake(2); return; }
		const f = this.res.frame;
		const eps = Number(f.epsMean || f.eps || 23.44);
		// 后天宫位宫首随「定局分宫」pdFrame(P0 解耦后分宫是一等维,盘 pane 已跟随;
		// 天球此前恒 Alchabitius = 切分宫后天球宫位不动的死显示)。未实现闭式的分宫
		// (campanus/morinus/koch)落四轴,不臆造中间宫首。
		let cusps = null;
		const cuspSys = cuspSystemOfFrame(this._pdFrame || 'alcabitius');
		try{ cusps = houseCusps(cuspSys, Number(f.armc), Number(f.phi), eps).cusps; }catch(e){ cusps = null; }
		if(!Array.isArray(cusps)){ this.wake(2); return; }
		const R = this.radius;
		const HOUSE_COL = 0xb98cff; // 宫位紫(与框架圈/黄道色区分)
		cusps.forEach((lam, idx)=>{
			if(lam == null || !Number.isFinite(lam)){ return; }
			const eq = eclLonToEq(lam, eps);
			const isAngle = idx === 0 || idx === 9 || idx === 3 || idx === 6; // 四轴(1/4/7/10 宫)略强
			const pIn = sph(eq.ra, eq.decl, R * 0.965);
			const pOut = sph(eq.ra, eq.decl, R * (isAngle ? 1.05 : 1.03));
			const tick = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pIn.x, pIn.y, pIn.z), new THREE.Vector3(pOut.x, pOut.y, pOut.z)]),
				new THREE.LineBasicMaterial({ color: HOUSE_COL, transparent: true, opacity: isAngle ? 0.95 : 0.72 })
			);
			this._houseGroup.add(tick);
			const label = makeTextSprite(`${idx + 1}`, {
				worldSize: Math.max(isAngle ? 6 : 5, R * (isAngle ? 0.046 : 0.038)),
				color: '#c9a8ff', minLuma: 0.55, glow: true,
			});
			const lp = sph(eq.ra, eq.decl, R * 1.085);
			label.position.set(lp.x, lp.y, lp.z);
			this._houseGroup.add(label);
		});
		this.wake(2);
	},

	_buildEquatorialGrid(){
		const R = this.radius;
		const positions = [];
		const pushCirclePolyline = (samplePoint, segments)=>{
			let prev = null;
			for(let i = 0; i <= segments; i += 1){
				const p = samplePoint(i / segments);
				if(prev){
					positions.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
				}
				prev = p;
			}
		};
		// 24 时圈:每 15° 赤经一条,ra 与 ra+180 共成一条过天极大圆 → 12 条大圆
		const ncp = { x: 0, y: 1, z: 0 };
		for(let h = 0; h < 12; h += 1){
			const w = unitOf(h * 15, 0);
			pushCirclePolyline((t)=>{
				const a = t * TWO_PI;
				const c = Math.cos(a);
				const s = Math.sin(a);
				return { x: (ncp.x * c + w.x * s) * R, y: (ncp.y * c + w.y * s) * R, z: (ncp.z * c + w.z * s) * R };
			}, 96);
		}
		// 赤纬圈 ±30/±60(赤道单独亮线)
		[-60, -30, 30, 60].forEach((decl)=>{
			pushCirclePolyline((t)=>sph(t * 360, decl, R), 120);
		});
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		const grid = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
			color: PD_COLOR.grid, transparent: true, opacity: PD_LEVELS.grid, // 四级明度:网格退为极淡辅助
		}));
		// 网格与天赤道分属两个圈层组(用户要求逐圈可选;网格无文字标注)
		const gGrid = this._frameLayerGroup('grid', this.skyGroup);
		gGrid.grp.add(grid);

		// 天赤道(decl=0)稍亮,提供旋转参照
		const gEq = this._frameLayerGroup('equator', this.skyGroup);
		gEq.grp.add(this._buildDeclCircleLine(0, PD_COLOR.equator, 0.9));
		// 圈名标注:天赤道(用户定案「不标注根本不知道看的是什么」)
		const eqLabel = makeTextSprite('天赤道', { worldSize: Math.max(7, this.radius * 0.05), color: '#7fb2e0', glow: true });
		const eqp = sph(100, 0, this.radius * 1.05);
		eqLabel.position.set(eqp.x, eqp.y, eqp.z);
		gEq.labelSub.add(eqLabel);
	},

	/** 等赤纬圈 Line(迫星周日圈与赤道线共用;dashed=迫星圈观感) */
	_buildDeclCircleLine(declDeg, color, opacity, dashed){
		const R = this.radius;
		const pts = [];
		for(let i = 0; i <= 180; i += 1){
			const p = sph(i * 2, declDeg, R);
			pts.push(new THREE.Vector3(p.x, p.y, p.z));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const material = dashed
			? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: R * 0.035, gapSize: R * 0.02 })
			: new THREE.LineBasicMaterial({ color, transparent: true, opacity });
		const line = new THREE.Line(geom, material);
		if(dashed){
			line.computeLineDistances();
		}
		return line;
	},

	/** 大圆 Line(基向量参数式) */
	_buildGreatCircleLine(u, w, color, opacity){
		const R = this.radius;
		const pts = [];
		for(let i = 0; i <= 180; i += 1){
			const a = (i / 180) * TWO_PI;
			const c = Math.cos(a);
			const s = Math.sin(a);
			pts.push(new THREE.Vector3((u.x * c + w.x * s) * R, (u.y * c + w.y * s) * R, (u.z * c + w.z * s) * R));
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
		return line;
	},

	/** 大圆高亮 Tube(应星位置圈;MeshStandardMaterial 零灯光下仅 emissive 可见 → 脉冲有真 emissive 通道) */
	_buildGreatCircleTube(u, w, color){
		const curve = new GreatCircleCurve(u, w, this.radius);
		// 管径减细(用户实测 0.0052 档「遮挡太多信息」)
		const tubeR = Math.max(0.42, this.radius * 0.0028);
		const geom = new THREE.TubeGeometry(curve, 220, tubeR, 8, true);
		const material = new THREE.MeshStandardMaterial({
			color: 0x000000,
			emissive: new THREE.Color(color),
			emissiveIntensity: 1.0,
			transparent: true,
			opacity: 0.92,
		});
		return new THREE.Mesh(geom, material);
	},

	// —— 地平三圈:地平圈/子午圈/卯酉圈 + 天顶/东点/北点标注(观测者系,恒静止) ——
	_buildHorizonFrame(frame){
		const R = this.radius; // 🔴 circleName(:407) 引用 R:方法作用域必须声明(fee54b4b 引入圈名时漏,真机 ReferenceError 连坐黄道/星点/wake 全不执行)
		const z = zenithOf(frame);
		const e = eastPointOf(frame);
		const zenithVec = unitOf(z.ra, z.decl);
		const eastVec = unitOf(e.ra, e.decl);
		const northVec = northPointOf(frame);   // 天顶×东点(φ=0 时=天北极,亦正确)
		const basis = { horizon: null, meridian: null, primeVertical: null };

		// 三圈各自圈层组(无条件建组:φ=±90 退化缺线时方位点标注仍有归宿)
		const gHor = this._frameLayerGroup('horizon', this.frameGroup);
		const gMer = this._frameLayerGroup('meridian', this.frameGroup);
		const gPV = this._frameLayerGroup('primeVertical', this.frameGroup);

		// 地平圈:过东点/北点(两者皆 ⊥ 天顶,P(t)=E·cos t+N·sin t 恒在地平面)
		if(northVec){
			basis.horizon = { u: eastVec, w: northVec };
			gHor.grp.add(this._buildGreatCircleLine(eastVec, northVec, PD_COLOR.horizon, 0.95));
		}
		// 子午圈:过天顶与天北极(φ=±90 天顶=天极 → 退化,跳过)
		const ncp = { x: 0, y: 1, z: 0 };
		const meridianBasis = greatCircleThrough(zenithVec, ncp);
		if(meridianBasis){
			basis.meridian = meridianBasis;
			gMer.grp.add(this._buildGreatCircleLine(meridianBasis.u, meridianBasis.w, PD_COLOR.meridian, 0.8));
		}
		// 卯酉圈:过东点与天顶
		const pvBasis = greatCircleThrough(eastVec, zenithVec);
		if(pvBasis){
			basis.primeVertical = pvBasis;
			gPV.grp.add(this._buildGreatCircleLine(pvBasis.u, pvBasis.w, PD_COLOR.primeVertical, 0.8));
		}
		this._frameBasis = basis;

		// 天顶/东点/北点标注(小点 + 名牌;按语义归圈:天顶→子午/东点→卯酉/北点→地平)
		const mark = (vec, text, labelSub)=>{
			if(!vec){
				return;
			}
			const R = this.radius;
			const dotGeom = new THREE.SphereGeometry(Math.max(0.9, R * 0.008), 10, 10);
			const dot = new THREE.Mesh(dotGeom, new THREE.MeshBasicMaterial({ color: PD_COLOR.frameLabel }));
			dot.position.set(vec.x * R, vec.y * R, vec.z * R);
			labelSub.add(dot);
			const label = makeTextSprite(text, { worldSize: Math.max(7, R * 0.055), color: PD_COLOR.frameLabel, glow: true });
			label.position.set(vec.x * R * 1.07, vec.y * R * 1.07, vec.z * R * 1.07);
			labelSub.add(label);
		};
		mark(zenithVec, '天顶', gMer.labelSub);
		mark(eastVec, '东点', gPV.labelSub);
		mark(northVec, '北点', gHor.labelSub);
		// 圈名标注:地平/子午/卯酉(各取圈上不与点标冲突的位置;色随各圈主题色)
		const circleName = (vec, text, colorHex, labelSub)=>{
			const label = makeTextSprite(text, { worldSize: Math.max(6.5, R * 0.046), color: colorHex, glow: true });
			label.position.set(vec.x * R * 1.05, vec.y * R * 1.05, vec.z * R * 1.05);
			labelSub.add(label);
		};
		// 地平圈:东点与北点之间(绕天顶轴 45°);子午圈:天顶→北 45°;卯酉圈:天顶→东 45°
		const mid = (a, b)=>{
			const v = { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
			const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
			return { x: v.x / len, y: v.y / len, z: v.z / len };
		};
		circleName(mid(eastVec, northVec), '地平圈', '#7fd191', gHor.labelSub);
		circleName(mid(zenithVec, northVec), '子午圈', '#c39ae0', gMer.labelSub);
		circleName(mid(zenithVec, eastVec), '卯酉圈', '#7fc9c2', gPV.labelSub);

		// 周日方向浮标:地平圈东/西点外侧「东·升/西·落」——常驻淡显(0.45),播放中提亮(1.0),
		// 把「周日旋转的物理方向」钉在画面上(观测者一眼读出星从东升、向西落)。
		this._dirBeacons = [];
		const beacon = (vec, text)=>{
			if(!vec){ return; }
			const s2 = makeTextSprite(text, { worldSize: Math.max(6.5, R * 0.048), color: PD_COLOR.direct, glow: true });
			s2.position.set(vec.x * R * 1.14, vec.y * R * 1.14 + R * 0.03, vec.z * R * 1.14);
			if(s2.material){ s2.material.transparent = true; s2.material.opacity = 0.45; }
			gHor.labelSub.add(s2);   // 周日浮标钉在地平圈东西点 → 随地平圈层显隐
			this._dirBeacons.push(s2);
		};
		beacon(eastVec, '东 · 升 ↑');
		beacon({ x: -eastVec.x, y: -eastVec.y, z: -eastVec.z }, '↓ 西 · 落');
	},

	/** 播放期方向浮标提亮/还原(playRow 起播提亮,播完与复位还原淡显) */
	_setBeaconEmphasis(on){
		(this._dirBeacons || []).forEach((s2)=>{
			if(s2.material){ s2.material.opacity = on ? 1.0 : 0.45; }
		});
	},
};
