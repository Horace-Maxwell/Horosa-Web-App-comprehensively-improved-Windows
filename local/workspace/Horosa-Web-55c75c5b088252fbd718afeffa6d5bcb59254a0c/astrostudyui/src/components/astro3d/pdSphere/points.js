// 主限天球引擎 · 点位与真位层:本命点 / 虚点、点与名牌随视距缩放、天体速度、复合运动真位层的建 / 更新 / 清除与信息回报
// 从 PDSphereEngine.js 按职责拆出的 PDSphereEngine 方法:this 仍是 PDSphereEngine 实例,门面里 mixinMethods(PDSphereEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import * as THREE from 'three';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { sph } from '../sphMath';
import { makeTextSprite, liftLuma } from '../labelSprite';
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { effectiveEq, VIRTUAL_POINT_KINDS, elapsedDaysForArc, properSpeedOfPoint, eclToEqTrue, trueMotionDeltaLon, formatElapsedHM } from '../pdSphereMath';
import { PD_COLOR, PD_LEVELS } from './sceneConst';
import { pointGlyphOf, basePointIdOf } from './pointNames';

export const pointMethods = {
	// —— 本命点/虚点:全部以引擎真实 (ra,decl) 摆点(kind ∈ term/antiscia/aspect = 小号灰点) ——
	_buildPoints(points){
		const R = this.radius;
		this.pointMeshMap.clear();
		Object.keys(points).forEach((pid)=>{
			const pt = points[pid];
			if(!pt){
				return;
			}
			const isVirtual = VIRTUAL_POINT_KINDS.has(pt.kind);
			const baseId = basePointIdOf(pid);
			// 行星色沿用 Astro3D 行星色表(Astro3DColor),缺项回退 PlanetStroke;虚点恒灰
			let color = AstroConst.Astro3DColor[baseId];
			if(color === undefined || color === null){
				color = AstroConst.Astro3DColor.PlanetStroke;
			}
			const pos = sph(pt.ra, pt.decl, R);
			let dot;
			let label = null;
			let tint = null;
			if(isVirtual && pt.kind === 'aspect'){
				// 相位点=「本体 glyph + 相位 glyph」(用户定案:一堆白点没意义,须按标准标注)。
				// id 形如 D_Saturn_60/S_Sun_90/N_Moon_180;末段数=相位度,合(0)只出本体 glyph。
				const glyph = pointGlyphOf(baseId, this._starBases);
				const aspM = /^[DSN]_.+_(\d+)$/.exec(`${pid}`);
				const aspDeg = aspM ? aspM[1] : null;
				const aspChar = (aspDeg && aspDeg !== '0') ? AstroText.AstroMsg[`Asp${aspDeg}`] : null;
				const txt = (glyph.astroFont && aspChar) ? `${glyph.text}${aspChar}` : glyph.text;
				dot = makeTextSprite(txt, {
					worldSize: Math.max(5.5, R * 0.04),   // 略小于本体(相位点密,防糊)
					color: '#ffffff', glow: true, minLuma: 0.5,
					...(glyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				});
				if(dot.material && dot.material.color && dot.material.color.setHex){ dot.material.color.setHex(PD_COLOR.virtualPoint); }
				if(dot.userData){ dot.userData.__pmEntry = true; }   // 视距补偿由 _scaleDot 管
				dot.visible = !!this.virtualToggles[pt.kind];         // 随「相位点」toggle 显隐
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}else if(isVirtual){
				// 映点/界(已无 toggle,恒隐;保留最小灰点呈现,选中行涉及点由 selectRow 显影)。
				dot = new THREE.Mesh(
					new THREE.SphereGeometry(Math.max(0.9, R * 0.008), 10, 10),
					new THREE.MeshBasicMaterial({ color: PD_COLOR.virtualPoint, transparent: true, opacity: PD_LEVELS.virtualShown })
				);
				dot.visible = !!this.virtualToggles[pt.kind];
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}else{
				// 实体点=glyph 即本体(去光球,用户定案):不再画色球+悬空名牌两件套,
				// 发光 glyph 精灵直接落在 (ra,decl) 位置本身。底稿恒白字烘焙,行星色经
				// liftLuma 抬亮后由 material 乘性染色 —— 选中/悬停重染方向色时得纯正色
				// (彩字×金=浑浊;白字×任意色=该色,连同光晕同色随染)。
				const glyph = pointGlyphOf(baseId, this._starBases);
				const cssBase = typeof color === 'string' ? color : `#${(color >>> 0).toString(16).padStart(6, '0')}`;
				tint = parseInt(liftLuma(cssBase, 0.6).slice(1), 16);
				// 恒星点 ★ 前缀标识 + 收敛字号(星名长,等高会撑太宽);宫头/阿点走默认短标。
				const isStarPt = pt.kind === 'star';
				dot = makeTextSprite(isStarPt ? `★${glyph.text}` : glyph.text, {
					worldSize: isStarPt ? Math.max(6.5, R * 0.045) : Math.max(8, R * 0.058),
					color: '#ffffff',
					glow: true,
					...(glyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				});
				if(dot.material && dot.material.color && dot.material.color.setHex){
					dot.material.color.setHex(tint);
				}
				if(dot.userData){ dot.userData.__pmEntry = true; } // 视距补偿绕开(由 _scaleDot 管)
				dot.position.set(pos.x, pos.y, pos.z);
				this.skyGroup.add(dot);
			}
			this.pointMeshMap.set(pid, {
				dot,
				label,
				isVirtual,
				kind: pt.kind || '', // 三类虚点 toggle 用
				isSprite: !isVirtual || pt.kind === 'aspect', // 实体点+相位点 glyph 均 sprite(纵横比安全)
				baseColor: tint !== null ? tint : ((dot.material.color && dot.material.color.getHex && dot.material.color.getHex()) || 0xffffff),
				baseScale: dot.scale.x,
				baseScaleY: dot.scale.y,
				selK: 1, // 选中态缩放档(悬停在其上再乘 1.35)
			});
		});
	},

	/** 点位缩放:sprite 纵横比安全(x=画布比例×k, y=世界高×k);球体沿用 setScalar。
	 *  乘视距补偿 _spriteViewK:球心档相机距天球面 ≈R(外视 2.75R),等 worldSize 视觉
	 *  放大 2.75× 糊脸 —— 内视统一 0.4× 补偿,退出还原。 */
	_scaleDot(entry, k){
		if(!entry || !entry.dot || !entry.dot.scale){
			return;
		}
		if(entry.isSprite){
			const vk = this._spriteViewK || 1;
			entry.dot.scale.set((entry.baseScale || 1) * k * vk, (entry.baseScaleY || entry.baseScale || 1) * k * vk, 1);
		}else{
			entry.dot.scale.setScalar((entry.baseScale || 1) * k);
		}
	},

	/** 全场 sprite 视距补偿(球心档 0.4 / 其余 1):非点位 sprite 首见记 __vsBase 初始尺寸
	 *  后按档重算;点位条目走 _scaleDot(保留 selK/hover 语义)。selectRow/setData 重建资产后
	 *  须重调以覆盖新建 sprite。 */
	_setSpriteViewScale(k){
		this._spriteViewK = k;
		if(this.scene && this.scene.traverse){
			this.scene.traverse((o)=>{
				if(!o || !o.isSprite || !o.scale || !o.userData){ return; }
				if(o.userData.__pmEntry){ return; } // 点位条目由 _scaleDot 统一管
				if(!o.userData.__vsBase){ o.userData.__vsBase = { x: o.scale.x, y: o.scale.y }; }
				o.scale.set(o.userData.__vsBase.x * k, o.userData.__vsBase.y * k, 1);
			});
		}
		this.pointMeshMap.forEach((entry)=>{
			if(entry.isSprite){ this._scaleDot(entry, entry.selK || 1); }
		});
		this.wake(2);
	},

	// —— 行选择:迫星等赤纬周日圈 + 应星位置圈高亮 + 迫星活动标(播放载体) ——
	// ═══ 复合运动·真位层 ═══
	/** 外部喂入 /chart objects 的瞬时黄经速表(baseId→°/日;含逆行负值);选中态热更新 */
	setBodySpeeds(map){
		this._bodySpeeds = map && typeof map === 'object' ? map : {};
		if(this._selection){
			this._buildTrueMotionLayer(this._selection.row, this._selection.conv);
			this._updateTrueMotion();
			this._emitTrueMotionInfo();   // 持姿态热更:重建曾清掉信息行,须按当前进度报回
		}
		this.wake(1);
	},

	/** 复合运动开关(设置面板;localStorage 记忆) */
	setTrueMotion(on){
		this.trueMotionOn = !!on;
		safeLocalStorageSet('horosa.pdsphere.trueMotion', this.trueMotionOn ? '1' : '0');
		if(!this.trueMotionOn){
			this._clearTrueMotion();
		}else if(this._selection){
			this._buildTrueMotionLayer(this._selection.row, this._selection.conv);
			this._updateTrueMotion();
			this._emitTrueMotionInfo();   // 持姿态重开:同上,信息行随层一并回归
		}
		this.wake(2);
	},

	_clearTrueMotion(){
		if(this.trueGroup){ this._clearGroup(this.trueGroup); }
		this._trueEntries = [];
		if(typeof this.onTrueMotionInfo === 'function'){
			try{ this.onTrueMotionInfo(null); }catch(_){ }
		}
	},

	/** 建层:诸实体曜真位点(淡亮小点) + 迫星真相位点(方向色环点+漂移线)。
	 *  冻结迫星(dirGroup 活动标)仍是命中载体;本层只画「同一时间里星体真正在哪」。 */
	_buildTrueMotionLayer(row, conv){
		this._clearTrueMotion();
		if(!this.trueMotionOn || !row || !this.res || !this.res.frame){
			return;
		}
		const points = this.res.points || {};
		const R = this.radius;
		const speedOf = (baseId)=>this._bodySpeeds[baseId];
		const dirColor = conv ? PD_COLOR.converse : PD_COLOR.direct;
		const dirCss = conv ? '#00e0e0' : '#ffd700';
		// 迫星相位偏移(N_Saturn_0 的 0):合相相位点与本体同经 → ① 里跳过该本体防双影叠字。
		const promBase = basePointIdOf(row.prom);
		const promAspM = /_(\d+)$/.exec(`${row.prom || ''}`);
		const promAtBody = (`${row.prom}` === promBase) || (promAspM && promAspM[1] === '0');
		// ① 诸实体曜:星体 glyph 本符,真位统一银白(PD_COLOR.truePos)—— 🔴 用户定案两轮:
		//    双影必须一眼可分,但不加环形徽记(环圈碍读),纯色域区分即可。
		//    三色分域:本命=行星本色 / 冻结迫星=方向金·青 / 真位=银白;glyph 形状保星体身份。
		//    μ=0 者真位恒等本命,不入层。
		const trueCss = '#dbe7f5';
		// 🔴 一体一影去重:pd3d 里本命星体 pid 多为 N_<body>_0 形(kind='planet'),与可能并存的
		// 裸 <body> 条目同源同星 —— 曾按 pid 面遍历致同一星体两条银白 glyph 叠影
		// (且 N 形与裸形 β 口径可异,叠影还错位);防叠字守卫也曾只认裸 pid 恒不命中。
		// 现按 basePointIdOf 维度去重(首见入层),promAtBody 跳过同按 base 判。
		const seenBase = new Set();
		Object.keys(points).forEach((pid)=>{
			const pt = points[pid];
			if(!pt || VIRTUAL_POINT_KINDS.has(pt.kind) || pt.kind === 'star'){
				return;
			}
			const base = basePointIdOf(pid);
			if(seenBase.has(base)){
				return;
			}
			const mu = properSpeedOfPoint(pid, pt.kind, speedOf);
			if(!mu){
				return;
			}
			seenBase.add(base);
			if(promAtBody && base === promBase){
				return;   // 合相/本体迫星:②的真位双影即其真位,本体重复画会叠字
			}
			const glyph = pointGlyphOf(base, this._starBases);
			const spr = makeTextSprite(glyph.text, {
				worldSize: Math.max(7, R * 0.05), color: '#ffffff', glow: true,
				...(glyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
			});
			if(spr.material && spr.material.color && spr.material.color.set){ spr.material.color.set(trueCss); }
			if(spr.material){ spr.material.opacity = 0.9; }
			if(spr.userData){ spr.userData.__pmEntry = true; }
			this.trueGroup.add(spr);
			this._trueEntries.push({ mesh: spr, pid, lon0: Number(pt.lon) || 0, latUse: Number(pt.lat) || 0, mu, isProm: false });
		});
		// ② 迫星真相位点:与冻结活动标同一 glyph 组合字(本体+相位符)、方向色染色,成对「冻结/真位」双影;
		//    漂移线连「本命冻结位 → 真位」(线长即公转位移,经典「引至本命位 vs 真位」之差)。界迫星 μ=0 → 真=冻结。
		const promPt = points[row.prom];
		if(promPt){
			const mu = properSpeedOfPoint(row.prom, promPt.kind, speedOf);
			if(mu){
				const mundo = `${row.cat || ''}` === 'M';
				const latUse = mundo ? (Number(promPt.lat) || 0) : 0;
				const bodyGlyph = pointGlyphOf(promBase, this._starBases);
				const aspChar = (promAspM && promAspM[1] !== '0') ? AstroText.AstroMsg[`Asp${promAspM[1]}`] : null;
				const txt = (bodyGlyph.astroFont && aspChar) ? `${bodyGlyph.text}${aspChar}` : bodyGlyph.text;
				const twin = makeTextSprite(txt, {
					worldSize: Math.max(7.5, R * 0.054), color: '#ffffff', glow: true,
					...(bodyGlyph.astroFont ? { fontFamily: 'ywastrochart' } : {}),
				});
				// 🔴 真位银白、冻结迫星方向色 —— 曾同为方向色致双影无从分辨(用户实测指正);
				// 漂移线保方向色,把「冻结→真位」配成一对且标注所属向运。
				if(twin.material && twin.material.color && twin.material.color.set){ twin.material.color.set(trueCss); }
				if(twin.material){ twin.material.opacity = 0.95; }
				if(twin.userData){ twin.userData.__pmEntry = true; }
				this.trueGroup.add(twin);
				const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
				const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: dirColor, transparent: true, opacity: 0.8 }));
				this.trueGroup.add(line);
				const frozen = effectiveEq(promPt, row.cat);
				const fp = sph(frozen.ra, frozen.decl, R);
				this._trueEntries.push({ mesh: twin, line, frozenPos: fp, pid: row.prom, lon0: Number(promPt.lon) || 0, latUse, mu, isProm: true });
			}
		}
		this._updateTrueMotion();
	},

	/** 逐帧:按播放进度 f 更新真位点(λ(f)=λ0+μ·Δt·f → 赤道 → 摆点;含迫星漂移线) */
	_updateTrueMotion(){
		if(!this._trueEntries.length){
			return;
		}
		const sel = this._selection;
		if(!sel || !this.res || !this.res.frame){
			return;
		}
		const eps = Number(this.res.frame.eps) || 0;
		const R = this.radius;
		const target = sel.rotTarget || 0;
		const f = Math.abs(target) < 1e-9 ? 0 : Math.max(0, Math.min(1, this.dirGroup.rotation.y / target));
		// 静止(f≈0)真位恒等本命 → 整层隐藏(重合双像纯噪);一动即现,复位即敛。
		if(this.trueGroup){ this.trueGroup.visible = this.trueMotionOn && f > 1e-4; }
		this._trueEntries.forEach((en)=>{
			const dLon = trueMotionDeltaLon(en.mu, sel.row.arc, f);
			const eq = eclToEqTrue(en.lon0 + dLon, en.latUse, eps);
			const p = sph(eq.ra, eq.decl, R);
			en.mesh.position.set(p.x, p.y, p.z);
			if(en.line && en.frozenPos){
				const pos = en.line.geometry.attributes.position;
				pos.setXYZ(0, en.frozenPos.x, en.frozenPos.y, en.frozenPos.z);
				pos.setXYZ(1, p.x, p.y, p.z);
				pos.needsUpdate = true;
			}
		});
	},

	/** 播放/拖拽落定时向宿主报「历时 + 各曜真位漂移」(DOM 信息行;逐帧不发防重烘) */
	_emitTrueMotionInfo(){
		if(typeof this.onTrueMotionInfo !== 'function'){
			return;
		}
		if(!this.trueMotionOn || !this._selection || !this._trueEntries.length){
			try{ this.onTrueMotionInfo(null); }catch(_){ }
			return;
		}
		const sel = this._selection;
		const target = sel.rotTarget || 0;
		const f = Math.abs(target) < 1e-9 ? 0 : Math.max(0, Math.min(1, this.dirGroup.rotation.y / target));
		const days = elapsedDaysForArc(sel.row.arc) * f;
		const drifts = this._trueEntries
			.map((en)=>({ pid: en.pid, isProm: !!en.isProm, dLon: trueMotionDeltaLon(en.mu, sel.row.arc, f) }))
			.filter((d)=>Math.abs(d.dLon) > 0.005)
			.sort((a, b)=>(b.isProm - a.isProm) || (Math.abs(b.dLon) - Math.abs(a.dLon)))
			.slice(0, 4);
		try{ this.onTrueMotionInfo({ elapsedText: formatElapsedHM(days), days, drifts }); }catch(_){ }
	},
};
