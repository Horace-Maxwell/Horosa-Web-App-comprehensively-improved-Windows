// 主限天球引擎 · 选中行:清除、迫星组转角、选中行的路径弧 / 应星高亮 / 卡片、头顶标签卡
// 从 PDSphereEngine.js 按职责拆出的 PDSphereEngine 方法:this 仍是 PDSphereEngine 实例,门面里 mixinMethods(PDSphereEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { sph } from '../sphMath';
import { makeTextSprite, makeRingSprite } from '../labelSprite';
import * as AstroText from '../../../constants/AstroText';
import { unitOf, northPointOf, greatCircleThrough, eclipticPoleOf, effectiveEq, isConverseRow, promRotationRad, CIRCLE_KIND_RENDER, FRAME_HIGHLIGHT_TARGET, VIRTUAL_POINT_KINDS, declCircleGreatIntersect, declCirclePolylineHit, moverOfRow, sigEqOf } from '../pdSphereMath';
import { PD_COLOR } from './sceneConst';
import { pointGlyphOf, aspectDegOf, basePointIdOf } from './pointNames';

export const selectionMethods = {
	clearSelection(){
		if(this._selection){
			if(this._selection.marker && this._selection.marker.parent){
				this._selection.marker.parent.remove(this._selection.marker);
			}
			this._disposeObject(this._selection.marker);
			// 相位连线/度数标签(挂 skyGroup)逐一移除释放
			(this._selection.extraSky || []).forEach((obj)=>{
				if(obj.parent){
					obj.parent.remove(obj);
				}
				this._disposeObject(obj);
			});
			// 还原迫星/应星点观感
			(this._selection.restore || []).forEach((fn)=>fn());
			this._selection = null;
		}
		this._clearTrail();
		this._removeLabelCard();
		this._clearGroup(this.selGroup);
		// 运动组整组清空+归零(其内全部为选中行资产,随选随建)
		this._clearGroup(this.dirGroup);
		if(this.dirGroup && this.dirGroup.rotation){
			this._applyDirRotation(0);
		}
		this._clearTrueMotion();
	},

	/** 旋转中枢:dirGroup 与真位层同角同步 + 逐帧真位更新(全部旋转赋值必经此处) */
	_applyDirRotation(y){
		if(this.dirGroup && this.dirGroup.rotation){
			this.dirGroup.rotation.y = y;
		}
		if(this.trueGroup && this.trueGroup.rotation){
			this.trueGroup.rotation.y = y;
		}
		this._updateTrueMotion();
	},

	/**
	 * 选中主限表某行(idx = res.rows 下标):
	 *  - 迫星:等赤纬周日圈(cat='Z' 用 declZ 投影口径,'M' 用真赤纬)+ 活动标(随天球转)
	 *  - 应星:circles[sig] 按 kind → CIRCLE_KIND_RENDER 渲染(高亮大圈/大圆/多段线/细弧)
	 *  - 天球回到 0 位(播放恒从 0 起步)
	 * @returns {null|{row, conv}} 无效行返 null
	 */
	selectRow(idx){
		if(this.disposed || !this.res || !Array.isArray(this.res.rows)){
			return null;
		}
		const row = this.res.rows[idx];
		if(!row){
			return null;
		}
		this._playToken += 1;   // 作废在途播放
		this._tweenActive = false;
		this.clearSelection();
		// skyGroup 恒 0(本命参照系,不再随播转动——历史姿态防御性归零);运动组同归零
		this.skyGroup.rotation.y = 0;
		this._applyDirRotation(0);

		const points = this.res.points || {};
		const circles = this.res.circles || {};
		const conv = isConverseRow(row);
		const dirColor = conv ? PD_COLOR.converse : PD_COLOR.direct;
		const R = this.radius;
		const restore = [];
		const pulseTargets = [];

		// —— 行级动/静分派(号序法律条文见 pdSphereMath 头注;fixture 670/670 实证) ——
		// mover='sig':Z 类·行星族应星动,靶=迫星相位点赤经圈(arc = RA(sig,真纬) − RA(promZ));
		// mover='prom':轴类应星/M/T 类迫星动,靶=轴圈/位置圈(旧几何本就正确的那族)。
		// 坐标口径:迫星恒 zero-lat 投影(effectiveEq);应星恒真黄纬(sigEqOf——旧误对应星取 raZ)。
		const promPt = points[row.prom];
		const promEff = effectiveEq(promPt, row.cat);
		const sigPt = points[row.sig];
		const sigEqT = sigEqOf(sigPt);
		const mover = moverOfRow(row);   // 恒 'prom'(应星固定、迫星动);sig 分支已成惰性死支,保留不害
		const moverPt = mover === 'sig' ? sigPt : promPt;
		const moverEq = mover === 'sig' ? sigEqT : promEff;
		const targetDeg = promRotationRad(row) * 180 / Math.PI;   // 迫星旋转:planet 族 +arc 落应星赤经圈,轴/M/T 族 −arc

		// —— 动方「预定路径弧」:观测者固定系中,自动方本命位沿其赤纬圈延伸恰 arc 度的虚线弧
		// +末端箭头=「将要走的路」;播放时进度实线 setDrawRange 渐现=「已走过的路」。
		// 数学:rotation.y=α 时组内点世界赤经=ra+α(sph 推导),direct 目标角为负。
		const PATH_SEGS = 96;
		let progressLine = null;
		if(moverPt){
			const pathPts = [];
			for(let i = 0; i <= PATH_SEGS; i += 1){
				const p = sph(moverEq.ra + targetDeg * (i / PATH_SEGS), moverEq.decl, R * 1.004);
				pathPts.push(new THREE.Vector3(p.x, p.y, p.z));
			}
			const dashGeom = new THREE.BufferGeometry().setFromPoints(pathPts);
			const dashLine = new THREE.Line(dashGeom, new THREE.LineDashedMaterial({
				color: dirColor, transparent: true, opacity: 0.5,
				dashSize: R * 0.035, gapSize: R * 0.025,
			}));
			dashLine.computeLineDistances();
			this.selGroup.add(dashLine);
			// 末端方向箭头(小锥,朝弧切线方向)
			const tip = pathPts[PATH_SEGS];
			const prev = pathPts[PATH_SEGS - 1];
			const dir = tip.clone().sub(prev).normalize();
			const cone = new THREE.Mesh(
				new THREE.ConeGeometry(Math.max(1.4, R * 0.014), Math.max(3.2, R * 0.032), 10),
				new THREE.MeshBasicMaterial({ color: dirColor, transparent: true, opacity: 0.85 })
			);
			cone.position.copy(tip);
			cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
			this.selGroup.add(cone);
			// 进度实线(播放中 setDrawRange 渐现;初始 0=不可见)
			const progGeom = new THREE.BufferGeometry().setFromPoints(pathPts);
			progGeom.setDrawRange(0, 0);
			progressLine = new THREE.Line(progGeom, new THREE.LineBasicMaterial({
				color: dirColor, transparent: true, opacity: 0.95,
			}));
			this.selGroup.add(progressLine);
		}

		// 动方活动标(挂 dirGroup,唯一随播转者):
		//  mover='prom':相位行=「本体glyph+相位glyph」组合字;映点/界=中文短标;本体行=glyph;
		//  mover='sig':应星本体 glyph(真黄纬位)——被引导滑向迫星相位点赤经圈(内核半弧比例号序)。
		//  白字烘焙+material 染方向色。🔴 moverPt 守卫:缺点则无标(effectiveEq 回落 (0,0) 幽灵防)。
		const promBaseId = basePointIdOf(row.prom);
		const sigBaseId = basePointIdOf(row.sig);
		const cnNameOf = (baseId)=>{
			const cn = AstroText.AstroMsgCN[baseId];
			if(cn !== undefined && cn !== null && `${cn}`.length){
				return `${cn}`;
			}
			if(`${baseId}`.indexOf('House') === 0){
				return `${`${baseId}`.slice(5)}宫`;
			}
			// S/P 扩展体语义短名(与表格/时间轴同源;恒星保英文名)
			const mc = /^Cusp(\d+)$/.exec(`${baseId}`);
			if(mc){ return `第${mc[1]}宫头`; }
			if(`${baseId}` === 'Syzygy'){ return '产前朔望'; }
			if(`${baseId}` === 'Spirit'){ return '精神点'; }
			if(`${baseId}`.indexOf('Pars ') === 0){ return `${`${baseId}`.slice(5)}点`; }
			return `${baseId}`;
		};
		const dirCss = conv ? '#00e0e0' : '#ffd700';
		const aspRawDeg = (/^[DSN]_.+_(\d+)$/.exec(`${row.prom || ''}`) || [])[1];
		const aspGlyphChar = aspRawDeg !== undefined ? AstroText.AstroMsg[`Asp${aspRawDeg}`] : null;
		const tintSprite = (sp)=>{
			if(sp && sp.material && sp.material.color && sp.material.color.set){
				sp.material.color.set(dirCss);
			}
			return sp;
		};
		let marker = null;
		if(moverPt){
			if(mover === 'sig'){
				const sigGlyph = pointGlyphOf(sigBaseId, this._starBases);
				marker = tintSprite(makeTextSprite(sigGlyph.text, {
					worldSize: Math.max(8.5, R * 0.06), color: '#ffffff', glow: true,
					...(sigGlyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				}));
			}else{
				const bodyGlyph = pointGlyphOf(promBaseId, this._starBases);
				if(promPt.kind === 'aspect' && bodyGlyph.astroFont && aspGlyphChar && aspRawDeg !== '0'){
					marker = tintSprite(makeTextSprite(`${bodyGlyph.text}${aspGlyphChar}`, {
						worldSize: Math.max(8.5, R * 0.06), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
					}));
				}else if(VIRTUAL_POINT_KINDS.has(promPt.kind) && promPt.kind !== 'aspect'){
					const kindTxt = promPt.kind === 'term' ? '界' : (`${row.prom}`.indexOf('C_') === 0 ? '反映' : '映');
					marker = makeTextSprite(`${cnNameOf(promBaseId)}·${kindTxt}`, {
						worldSize: Math.max(6.5, R * 0.046), color: dirCss, glow: true,
					});
				}else{
					// 恒星迫星活动标同带 ★(与本体点一致);宫头/阿点由 pointGlyphOf 短标覆盖。
					const isStarMv = promPt.kind === 'star';
					marker = tintSprite(makeTextSprite(isStarMv ? `★${bodyGlyph.text}` : bodyGlyph.text, {
						worldSize: isStarMv ? Math.max(7, R * 0.048) : Math.max(8.5, R * 0.06), color: '#ffffff', glow: true,
						...(bodyGlyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
				}
			}
			if(marker){
				const mp = sph(moverEq.ra, moverEq.decl, R);
				marker.position.set(mp.x, mp.y, mp.z);
				this.dirGroup.add(marker);
			}
		}

		// 靶线分派:
		//  mover='sig' → 迫星相位点·赤经圈(过天极与 promZ 的大圆,前端自构粗管——后端 circles
		//    是旧「应星圈」假设产物,行星族不再消费);
		//  mover='prom' → 后端 circles[sig] kind 分派(轴圈/位置圈/多段线/细圈,该族旧几何本就正确)。
		const circle = circles[row.sig];
		const kind = circle && circle.type;
		const render = CIRCLE_KIND_RENDER[kind];
		if(mover === 'sig'){
			if(promPt){
				const basis = greatCircleThrough({ x: 0, y: 1, z: 0 }, unitOf(promEff.ra, promEff.decl));
				if(basis){
					const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
					this.selGroup.add(tube);
					pulseTargets.push({ material: tube.material, mode: 'emissive' });
					// 线名标注:机器走赤道——名实相符(旧「黄道相位」贴赤道线=名实不符,用户实爆)
					const lineTag = makeTextSprite('迫星相位点·赤经圈', {
						worldSize: Math.max(6, R * 0.042), color: dirColor, glow: true,
					});
					const ltp = sph(promEff.ra, Math.min(72, Math.max(-72, promEff.decl + 30)), R * 1.05);
					lineTag.position.set(ltp.x, ltp.y, ltp.z);
					this.selGroup.add(lineTag);
				}
			}
		}else{
		if(circle && !render){
			console.warn('[AstroPDSphere] 未登记的应星位置圈 kind:', kind);
		}
		if(render === 'frame-highlight'){
			// ASC/MC/Vertex:对应地平框架大圈原位高亮(Tube 叠在细线上)
			const basis = this._frameBasis && this._frameBasis[FRAME_HIGHLIGHT_TARGET[kind]];
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}else if(render === 'great-circle' && sigPt){
			// Regio/Campanus 位置圈:过地平南北点与应星的大圆(北点与应星叉积得法向量;应星恒真纬)
			const northVec = northPointOf(this.res.frame);
			const basis = northVec ? greatCircleThrough(northVec, unitOf(sigEqT.ra, sigEqT.decl)) : null;
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}else if(render === 'polyline' && circle){
			// Placidus / legacy:半弧比例等值线采样;Topocentric / Placidus 极下法:按应星的极精确采样的大圆;断段自然断开(极圈不可解区间零连线)
			// polyline 圈选中期粗管化:细线在满盘同色系里不显眼(用户实读「没碰到」),
			// 段多段线走 CatmullRom(tension 0 过点)Tube;段仍自然断开(极圈不可解区间零管)。
			(circle.points || []).forEach((seg)=>{
				if(!Array.isArray(seg) || seg.length < 2){
					return;
				}
				const pts = seg.map((p)=>{
					const v = sph(p.ra, p.decl, R);
					return new THREE.Vector3(v.x, v.y, v.z);
				});
				try{
					const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
					const tube = new THREE.Mesh(
						new THREE.TubeGeometry(curve, Math.max(32, pts.length * 2), Math.max(0.42, R * 0.0028), 8, false), // 同步减细
						new THREE.MeshStandardMaterial({
							color: 0x000000, emissive: new THREE.Color(dirColor), emissiveIntensity: 1.0,
							transparent: true, opacity: 0.92,
						})
					);
					this.selGroup.add(tube);
					pulseTargets.push({ material: tube.material, mode: 'emissive' });
				}catch(e){
					// Tube 构建失败回退细线(观感降级,语义不丢)
					const line = new THREE.Line(
						new THREE.BufferGeometry().setFromPoints(pts),
						new THREE.LineBasicMaterial({ color: dirColor, transparent: true, opacity: 0.95 })
					);
					this.selGroup.add(line);
					pulseTargets.push({ material: line.material, mode: 'color', baseColor: dirColor });
				}
			});
		}else if(render === 'thin-arc' && sigPt){
			// hour-circle:过天极的应星时圈;ecliptic-meridian:过黄道极的应星黄道经圈(应星恒真纬)
			// 选中期一律粗管(旧 0.72 细线被淹没=「成相位线」看不见的直接元凶)
			const pole = kind === 'ecliptic-meridian'
				? (()=>{
					const ep = eclipticPoleOf((this.res.frame && this.res.frame.epsMean) || 23.44);
					return unitOf(ep.ra, ep.decl);
				})()
				: { x: 0, y: 1, z: 0 };
			const basis = greatCircleThrough(pole, unitOf(sigEqT.ra, sigEqT.decl));
			if(basis){
				const tube = this._buildGreatCircleTube(basis.u, basis.w, dirColor);
				this.selGroup.add(tube);
				pulseTargets.push({ material: tube.material, mode: 'emissive' });
			}
		}
		} // mover==='prom' 靶线分派 else 收口

		// —— 迫星侧身份标注:父组按动方分派 ——
		//  mover='prom':迫星资产挂 dirGroup 随组转(旧正确族);
		//  mover='sig':迫星相位点是「固定靶」——本体 glyph/相位点标/直线连线/坐标卡全部静止挂
		//    selGroup;此时活动标(dirGroup)=应星 glyph,应星卡随动。
		const promSideGrp = mover === 'prom' ? this.dirGroup : this.selGroup;
		const extraSky = []; // 运动资产改由组整组清理,此数组仅保字段兼容(恒空)
		if(promPt){
			// 圈选环撤销(用户定案「参与相位的星体不用圈起来了」):glyph 本体+方向色染+标注卡已足辨识
			const aspTxt = aspectDegOf(row.prom);
			const promCard = makeTextSprite(`迫星·${cnNameOf(promBaseId)}${aspTxt ? `·${aspTxt}` : ''}`, {
				worldSize: Math.max(7, R * 0.05), color: dirColor, glow: true,
			});
			const pcp = sph(promEff.ra, Math.min(84, promEff.decl + 10), R * 1.1);
			promCard.position.set(pcp.x, pcp.y, pcp.z);
			promSideGrp.add(promCard);
			// mover='sig' 时相位点本身要有静止标(动方标已让位给应星):组合 glyph 钉在相位点位
			if(mover === 'sig'){
				const bodyGlyphS = pointGlyphOf(promBaseId, this._starBases);
				const aspPtMark = (promPt.kind === 'aspect' && bodyGlyphS.astroFont && aspGlyphChar && aspRawDeg !== '0')
					? tintSprite(makeTextSprite(`${bodyGlyphS.text}${aspGlyphChar}`, {
						worldSize: Math.max(8, R * 0.055), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
					}))
					: tintSprite(makeTextSprite(bodyGlyphS.text, {
						worldSize: Math.max(8, R * 0.055), color: '#ffffff', glow: true,
						...(bodyGlyphS.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
				const app = sph(promEff.ra, promEff.decl, R);
				aspPtMark.position.set(app.x, app.y, app.z);
				this.selGroup.add(aspPtMark);
			}
			// 完整语义坐标行:λ(黄道)+α/δ(赤道)——标注卡从不显数值(体检第4项)。
			const _fmtDeg = (v)=>{
				let d = Math.floor(Math.abs(v)); let m = Math.round((Math.abs(v) - d) * 60);
				if(m >= 60){ m = 0; d += 1; } // 分四舍五入至 60 → 进位入度,免出现 …°60′
				return `${v < 0 ? '-' : ''}${d}°${m < 10 ? '0' : ''}${m}′`;
			};
			// 南半球读法:球上画的是真位置,黄经读数与表、盘一样按读法转 labelTurn 度(普通盘 = 0)
			const _labelTurn = Number(this.res && this.res.labelTurn) || 0;
			const coordTxt = `λ=${_fmtDeg((((Number(promPt.lon) + _labelTurn) % 360) + 360) % 360)} β=${_fmtDeg(Number(promPt.lat) || 0)} · α=${_fmtDeg(promEff.ra)} δ=${_fmtDeg(promEff.decl)}`;
			const coordCard = makeTextSprite(coordTxt, {
				worldSize: Math.max(5.2, R * 0.036), color: dirColor, minLuma: 0.55,
			});
			const ccp = sph(promEff.ra, Math.min(80, promEff.decl + 16), R * 1.1);
			coordCard.position.set(ccp.x, ccp.y, ccp.z);
			promSideGrp.add(coordCard);
			// Z 类:黄道投影点 (raZ,declZ) 常驻金菱形,细虚线连真体
			// (月亮 β≈5° 真体明显离黄道圈 —— 弧几何用投影点,物理位置是真体,两者都画才不糊)。
			const isMundoCard = `${row.cat || ''}` === 'M';
			if(!isMundoCard && Number.isFinite(Number(promPt.raZ))){
				const trueP = sph(Number(promPt.ra), Number(promPt.decl), R);
				const projP = sph(Number(promPt.raZ), Number(promPt.declZ), R);
				const tv = new THREE.Vector3(trueP.x, trueP.y, trueP.z);
				const pv = new THREE.Vector3(projP.x, projP.y, projP.z);
				if(tv.distanceTo(pv) > R * 0.006){
					const diamond = new THREE.Mesh(
						new THREE.OctahedronGeometry(Math.max(1.1, R * 0.011)),
						new THREE.MeshBasicMaterial({ color: 0xd8ab52 })
					);
					diamond.position.copy(pv);
					promSideGrp.add(diamond);
					const tie = new THREE.Line(
						new THREE.BufferGeometry().setFromPoints([tv, pv]),
						new THREE.LineDashedMaterial({ color: 0xd8ab52, transparent: true, opacity: 0.5, dashSize: R * 0.018, gapSize: R * 0.014 })
					);
					tie.computeLineDistances();
					promSideGrp.add(tie);
				}
			}
			// 虚点迫星:本体星 glyph 副本+本体↔被引导点连线(中点相位 glyph,用户定案)——
			// skyGroup 原件将被显隐策略藏起,运动组内的副本才是「随周日转动的迫星本体」。
			if(VIRTUAL_POINT_KINDS.has(promPt.kind)){
				let bodyPt = null;
				Object.keys(points).some((k)=>{
					const cand = points[k];
					if(cand && !VIRTUAL_POINT_KINDS.has(cand.kind) && basePointIdOf(k) === promBaseId){
						bodyPt = cand;
						return true;
					}
					return false;
				});
				if(bodyPt){
					const bodyEq = effectiveEq(bodyPt, row.cat);
					// 本体星 glyph 副本(白字+方向色染;略小于被引导点标)
					const bodyGlyphB = pointGlyphOf(promBaseId, this._starBases);
					const bodySprite = tintSprite(makeTextSprite(bodyGlyphB.text, {
						worldSize: Math.max(7, R * 0.05), color: '#ffffff', glow: true,
						...(bodyGlyphB.astroFont ? { fontFamily: 'ywastrochart' } : {}),
					}));
					const bpPos = sph(bodyEq.ra, bodyEq.decl, R);
					bodySprite.position.set(bpPos.x, bpPos.y, bpPos.z);
					promSideGrp.add(bodySprite);
					// 用户定案「相位线直接用直线连结 promissor 和相位点」:大圆弧→弦直线
					//(线穿球内,线框天球下清晰可见;直线无 slerp 除零问题,180° 对分照画=直径线)。
					const p1 = sph(bodyEq.ra, bodyEq.decl, R);
					const p2 = sph(promEff.ra, promEff.decl, R);
					const tvA = new THREE.Vector3(p1.x, p1.y, p1.z);
					const tvB = new THREE.Vector3(p2.x, p2.y, p2.z);
					if(tvA.distanceTo(tvB) > R * 0.004){
						const link = new THREE.Line(
							new THREE.BufferGeometry().setFromPoints([tvA, tvB]),
							new THREE.LineBasicMaterial({ color: dirColor, transparent: true, opacity: 0.55 })
						);
						promSideGrp.add(link);
						// 本体圈选环撤销(用户定案);直线+glyph 已表达来源
						// 弦中点相位 glyph(用户定案「中间用相位glyph标识出来」;billboard 任意位置可读)
						if(aspGlyphChar && aspRawDeg !== '0'){
							const mv = tvA.clone().add(tvB).multiplyScalar(0.5);
							const aspMid = tintSprite(makeTextSprite(`${aspGlyphChar}`, {
								worldSize: Math.max(6.5, R * 0.048), color: '#ffffff', glow: true, fontFamily: 'ywastrochart',
							}));
							aspMid.position.set(mv.x, mv.y, mv.z);
							promSideGrp.add(aspMid);
						}
					}
				}
			}
		}
		if(sigPt){
			// 应星卡:mover='sig' 随动挂 dirGroup(跟着应星滑),否则静止 selGroup;坐标恒真纬。
			const sigCard = makeTextSprite(`应星·${cnNameOf(sigBaseId)}`, {
				worldSize: Math.max(7, R * 0.05), color: dirColor, glow: true,
			});
			const scp = sph(sigEqT.ra, Math.max(-84, sigEqT.decl - 10), R * 1.1);
			sigCard.position.set(scp.x, scp.y, scp.z);
			(mover === 'sig' ? this.dirGroup : this.selGroup).add(sigCard);
			// —— 相遇几何按动方分派 ——
			//  mover='sig':命中点=迫星相位点赤经圈 ∩ 应星赤纬圈(解析直取:同 RA、应星赤纬);
			//    静止端=相位点本身,连线沿赤经圈纵向,播放至 t=1 应星滑入命中点。
			//  mover='prom':旧正统几何(动方赤纬圈 ∩ 应星位置圈真交点;kind 分派;解不出回落 RA 平移)。
			//  M 类:半弧比例空间角,只高亮命中点不画定角连线。
			if(promPt){
				const isMundo = `${row.cat || ''}` === 'M';
				const rawAsp = aspectDegOf(row.prom) || aspectDegOf(row.sig);
				let endP;
				let staticAnchorV;   // 命中连线的静止端(sig 动=迫星相位点;prom 动=应星本体)
				let circleName;
				if(mover === 'sig'){
					endP = sph(promEff.ra, sigEqT.decl, R);
					const ap = sph(promEff.ra, promEff.decl, R);
					staticAnchorV = new THREE.Vector3(ap.x, ap.y, ap.z);
					circleName = '赤经圈';
				}else{
					const fallbackP = sph(promEff.ra + targetDeg, promEff.decl, R);
					endP = fallbackP;
					let hitBasis = null;
					if(render === 'frame-highlight'){
						hitBasis = this._frameBasis && this._frameBasis[FRAME_HIGHLIGHT_TARGET[kind]];
					}else if(render === 'great-circle'){
						const nv = northPointOf(this.res.frame);
						hitBasis = nv ? greatCircleThrough(nv, unitOf(sigEqT.ra, sigEqT.decl)) : null;
					}else if(render === 'thin-arc'){
						const pole = kind === 'ecliptic-meridian'
							? (()=>{ const ep = eclipticPoleOf((this.res.frame && this.res.frame.epsMean) || 23.44); return unitOf(ep.ra, ep.decl); })()
							: { x: 0, y: 1, z: 0 };
						hitBasis = greatCircleThrough(pole, unitOf(sigEqT.ra, sigEqT.decl));
					}
					if(hitBasis){
						const hits = declCircleGreatIntersect(promEff.decl, hitBasis);
						if(hits && hits.length){
							const fv = new THREE.Vector3(fallbackP.x, fallbackP.y, fallbackP.z);
							let bestV = null;
							hits.forEach((h)=>{
								const hv = new THREE.Vector3(h.x * R, h.y * R, h.z * R);
								if(!bestV || hv.distanceTo(fv) < bestV.distanceTo(fv)){ bestV = hv; }
							});
							if(bestV){ endP = { x: bestV.x, y: bestV.y, z: bestV.z }; }
						}
					}else if(render === 'polyline' && circle){
						const hit = declCirclePolylineHit(promEff.decl, circle.points);
						if(hit){ endP = sph(hit.ra, hit.decl, R); }
					}
					const sp = sph(sigEqT.ra, sigEqT.decl, R);
					staticAnchorV = new THREE.Vector3(sp.x, sp.y, sp.z);
					circleName = kind === 'meridian' ? '子午圈'
						: kind === 'horizon-east' ? '地平·升'
							: kind === 'prime-vertical' ? '卯酉圈'
								: kind === 'hour-circle' ? '时圈'
									: kind === 'ecliptic-meridian' ? '黄道经圈'
										: render === 'polyline' ? '半弧位置圈' : '位置圈';
				}
				const ev = new THREE.Vector3(endP.x, endP.y, endP.z);
				// 名实分层文案(用户实爆「赤道线标黄道相位」):相位取黄道(定义)·抵达走赤道机器(圈)
				const aspTxt2 = isMundo
					? `世俗相位 ${rawAsp || '合'}(半弧比例)`
					: `${rawAsp ? `黄道取相位 ${rawAsp} · ` : ''}${circleName}相遇`;
				if(isMundo){
					// M 类:位置圈命中点高亮环(不画定角连线)
					const hitRing = makeRingSprite(dirColor, Math.max(9, R * 0.065));
					hitRing.position.set(ev.x, ev.y, ev.z);
					this.selGroup.add(hitRing);
				}else{
					const gap = ev.distanceTo(staticAnchorV);
					if(gap > R * 0.01){
						const linkGeom = new THREE.BufferGeometry().setFromPoints([ev, staticAnchorV]);
						const link = new THREE.Line(linkGeom, new THREE.LineDashedMaterial({
							color: dirColor, transparent: true, opacity: 0.75,
							dashSize: R * 0.03, gapSize: R * 0.02,
						}));
						link.computeLineDistances();
						this.selGroup.add(link);
					}
				}
				const midV = ev.clone().add(staticAnchorV).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.08);
				const aspLabel = makeTextSprite(aspTxt2, { worldSize: Math.max(6.5, R * 0.048), color: dirColor, glow: true });
				aspLabel.position.set(midV.x, midV.y, midV.z);
				this.selGroup.add(aspLabel);
				// 命中点标(选中即现,固定系):被引导点将抵达的位置圈命中点。
				// 双环靶已撤(用户定案「怎么还有这么大的圆环」——球心视角下尤为突兀):只留小芯点,
				// t=1 随圈脉冲即足以钉住「成相位落点」。
				const targetCore = new THREE.Mesh(
					new THREE.SphereGeometry(Math.max(1.1, R * 0.01), 10, 10),
					new THREE.MeshBasicMaterial({ color: dirColor })
				);
				targetCore.position.copy(ev);
				this.selGroup.add(targetCore);
				pulseTargets.push({ material: targetCore.material, mode: 'color', baseColor: dirColor });
			}
		}

		// 显隐策略(用户定案「盘上始终只留这两个星体以及 promissor 的对应相位点」):
		//  应星:skyGroup 原位高亮(染方向色+放大;skyGroup 恒 0 → 纹丝不动=固定征象本体);
		//  迫星本体/被引导虚点的 skyGroup 原件:隐藏(dirGroup 运动组接管其呈现,防「原地残影+运动副本」双影);
		//  其余一切点:聚焦档=整体隐去;全显档=淡显 0.55 供对照;
		//  toggle 显示中的无关虚点:聚焦下同隐。
		const sigPid = row.sig;
		let promBodyPid = null;
		if(promPt && VIRTUAL_POINT_KINDS.has(promPt.kind)){
			Object.keys(points).some((k)=>{
				const cand = points[k];
				if(cand && !VIRTUAL_POINT_KINDS.has(cand.kind) && basePointIdOf(k) === promBaseId){
					promBodyPid = k;
					return true;
				}
				return false;
			});
		}
		this.pointMeshMap.forEach((entry, pid)=>{
			const hideEntry = ()=>{
				const dv = entry.dot.visible;
				entry.dot.visible = false;
				restore.push(()=>{
					entry.dot.visible = entry.isVirtual ? !!this.virtualToggles[entry.kind] : dv;
				});
				if(entry.label){
					const lv = entry.label.visible;
					entry.label.visible = false;
					restore.push(()=>{ entry.label.visible = lv; });
				}
			};
			if(pid === sigPid){
				// 应星动(行星族):skyGroup 原件隐藏——dirGroup 运动副本接管其呈现(防双影)
				if(mover === 'sig'){
					hideEntry();
					return;
				}
				// 迫星动族:应星原位高亮(白字底稿 material 染方向色;放大走纵横比安全通道)
				const mat = entry.dot.material;
				if(mat && mat.color && mat.color.setHex){
					mat.color.setHex(dirColor);
				}
				entry.selK = 1.45;
				this._scaleDot(entry, entry.selK);
				restore.push(()=>{
					if(mat && mat.color && mat.color.setHex){
						mat.color.setHex(entry.baseColor);
					}
					entry.selK = 1;
					this._scaleDot(entry, 1);
				});
				return;
			}
			if(pid === row.prom || (promBodyPid && pid === promBodyPid)){
				hideEntry();
				return;
			}
			if(entry.isVirtual){
				if(this.focusMode && entry.dot.visible){ hideEntry(); }
				return;
			}
			if(this.focusMode){
				hideEntry();
				return;
			}
			// 全显档:退避淡显(旧观感保留作对照)
			const dm = entry.dot.material;
			const prevOpacity = dm.opacity;
			const prevTransparent = dm.transparent;
			dm.transparent = true;
			dm.opacity = 0.55;
			restore.push(()=>{
				dm.opacity = prevOpacity;
				dm.transparent = prevTransparent;
			});
		});

		this._selection = { idx, row, conv, mover, marker, pulseTargets, restore, extraSky, progressLine, pathSegs: PATH_SEGS,
			rotTarget: promRotationRad(row) };   // 真位层进度分母(rotation.y/rotTarget = 播放进度 f)
		this._buildTrueMotionLayer(row, conv);
		// 球心档下选中行新建的 sprite 资产补视距缩放(traverse 只补新面孔,已补的走 __vsBase 幂等)
		if((this._spriteViewK || 1) !== 1){ this._setSpriteViewScale(this._spriteViewK); }
		this.wake(3);
		return { row, conv };
	},

	// —— 头顶标签卡:direct=金 / converse=青(labelSprite billboard,恒面向相机) ——
	_showLabelCard(text, conv){
		this._removeLabelCard();
		if(!text){
			return;
		}
		const sprite = makeTextSprite(text, {
			worldSize: Math.max(9, this.radius * 0.07),
			color: conv ? PD_COLOR.converse : PD_COLOR.direct,
			glow: true,
		});
		sprite.position.set(0, this.radius * 1.24, 0);
		this.selGroup.add(sprite);
		this._labelCard = sprite;
		// 播放 + 脉冲结束后自动撤卡(最长弧 4s + 脉冲 1.1s + 余量)
		this._labelTimer = setTimeout(()=>{
			this._removeLabelCard();
			this.wake(1);
		}, 6200);
	},

	_removeLabelCard(){
		if(this._labelTimer){
			clearTimeout(this._labelTimer);
			this._labelTimer = null;
		}
		if(this._labelCard){
			if(this._labelCard.parent){
				this._labelCard.parent.remove(this._labelCard);
			}
			this._disposeObject(this._labelCard);
			this._labelCard = null;
		}
	},
};
