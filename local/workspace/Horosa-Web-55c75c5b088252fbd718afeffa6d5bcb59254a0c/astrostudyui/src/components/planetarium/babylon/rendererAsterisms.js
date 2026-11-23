// 天文馆渲染器 · 星官(分片建造)、行星轨迹、星座连线与边界、二十八宿分区与网格、传统图层
// 从 PlanetariumRenderer.js 按职责拆出的 PlanetariumRenderer 方法:this 仍是 PlanetariumRenderer 实例,门面里 mixinMethods(PlanetariumRenderer, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { equatorialToHorizontal, projectedEquatorialItem } from '../planetariumProjection';
import CONSTELLATION_LINES from '../../../data/constellationLines.json';
import CONSTELLATION_BOUNDS from '../../../data/constellationBounds.json';
import CHINESE_ASTERISMS from '../../../data/chineseAsterisms.json';
import { rareSafeText } from '../../../utils/rareChars';
import { BABYLON, BODY_RADIUS, LINE_RADIUS, BODY_COLORS, SU28_PALACE_COLORS, su28SequenceIndex, asterismColor, ASTERISM_BUILD_SLICE_MS } from './constants';
import { nowMs, clamp, toSkyVector, normalizeDegrees, observerFromData } from './skyMath';
import { circularMidpoint, su28DisplayName, allAboveHorizon } from './itemText';

export const rendererAsterismMethods = {
	// 完整星官(312,旗舰)。数据 src/data/chineseAsterisms.json:每条星官 stars[{ra,decl,mag}] + lines[[i,j]],
	// ra/decl = J2000 真赤道十进制度。🔴纯天文铁律:坐标全走真实 ra/decl → projectedEquatorialItem → toSkyVector
	// (projectable 随天转),无 zodiacal/宿度制/岁差污染。按 group/symbol 四象三垣配色;每星官在其最亮星(mag 最小)
	// 处贴名 billboard。line.metadata.layerKey='xingguan' 供 layerAllowsMesh 在重投影时门控(隐藏即跳过重建)。
	// 星官(312)懒构建:默认关不建(省开场近半网格);开层时建一次(_asterismsBuilt 守,非降级、默认零回归)。
	// 🚀 跨帧分片建:312 个名牌纹理 + 1153 条线一口气建要占主线程几百毫秒到一秒多(播放中表现为画面顿住、
	// 恢复后天球往前一跳)。改成每帧只建几毫秒的量,期间整组不显示,建完一次性露出并按当前显示时刻重投影
	// (不出现「建了一半的星官」,也不出现按旧时刻摆放的线)。没有 requestAnimationFrame 的环境(单测 / 无头)照旧同步建完。
	// 代次号:清场 / 销毁后旧的续建回调自己退出,不往已拆掉的组里塞网格。
	ensureChineseAsterismsBuilt(){
		if(this._asterismsBuilt){ return; }
		this._asterismsBuilt = true;
		const token = (this._asterismBuildToken = (this._asterismBuildToken || 0) + 1);
		const job = this.beginChineseAsterisms((this.lastData && this.lastData.observer) || {});
		const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : null;
		if(!raf){
			while(this.buildChineseAsterismAt(job)){ /* 同步建完 */ }
			this.applyLayerVisibility();
			return;
		}
		this._asterismBuildJob = job;
		job.group.setEnabled(false);
		const pump = ()=>{
			if(token !== this._asterismBuildToken || this.disposed || !this.scene){ return; }
			const started = nowMs();
			let more = true;
			while(more && nowMs() - started < ASTERISM_BUILD_SLICE_MS){
				more = this.buildChineseAsterismAt(job);
			}
			if(more){ raf(pump); return; }
			this._asterismBuildJob = null;
			this.applyLayerVisibility();
			// 分片期间新建的线 / 名牌按建造起点的时刻摆放,显示时刻可能已经走开(播放中 / 单步后):露出前统一摆到当前显示时刻。
			this.reprojectStarsToDisplayTime();
		};
		pump();
	},

	// 作废在途的星官分片建造(清场 / 销毁时调;已建出的网格随组一起释放)。
	cancelChineseAsterismBuild(){
		this._asterismBuildToken = (this._asterismBuildToken || 0) + 1;
		this._asterismBuildJob = null;
	},

	// 同步整建(分片路径的等价物;保留给不分片的调用方)。
	createChineseAsterisms(observer){
		const job = this.beginChineseAsterisms(observer);
		while(this.buildChineseAsterismAt(job)){ /* 逐星官建完 */ }
		return job.group;
	},

	beginChineseAsterisms(observer){
		const group = this.makeGroup('asterism-xingguan-layer');
		const obs = observerFromData(observer);
		const radius = LINE_RADIUS + 26; // 略内于三垣墙(+38),与西方星座连线(+18)分层
		return {
			group,
			obs,
			jd: (obs && obs.jd) || 2451545,
			refr: this.refractionActive(),
			radius,
			labelRadius: radius + 8,
			asterisms: (CHINESE_ASTERISMS && CHINESE_ASTERISMS.asterisms) || [],
			index: 0,
		};
	},

	// 建第 job.index 个星官(线 + 名牌),返回是否还有下一个。
	buildChineseAsterismAt(job){
		const { group, obs, jd, refr, radius, labelRadius, asterisms } = job;
		if(job.index >= asterisms.length){ return false; }
		const ai = job.index;
		const item = asterisms[ai];
		job.index += 1;
		const stars = ((item && item.stars) || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
		if(stars.length){
			const color = asterismColor(item);
			// 连线:逐 [i,j] 连成员星(用原始 stars 索引,过滤前的下标)。
			(item.lines || []).forEach((seg, si)=>{
				if(!Array.isArray(seg) || seg.length < 2){ return; }
				const a = (item.stars || [])[seg[0]];
				const b = (item.stars || [])[seg[1]];
				if(!a || !b || !Number.isFinite(Number(a.ra)) || !Number.isFinite(Number(a.decl)) || !Number.isFinite(Number(b.ra)) || !Number.isFinite(Number(b.decl))){ return; }
				const pts = [
					projectedEquatorialItem({ ra: a.ra, decl: a.decl, epoch: 'J2000' }, jd, obs, refr),
					projectedEquatorialItem({ ra: b.ra, decl: b.decl, epoch: 'J2000' }, jd, obs, refr),
				];
				const line = this.createLine(`asterism-xingguan-${ai}-${si}`, pts, color, 0.62, group, radius, true);
				if(line){ line.metadata = { layerKey: 'xingguan' }; }
			});
			// 名:贴在最亮星(mag 最小)处;无 mag 取首星。
			let anchor = stars[0];
			let minMag = Number(stars[0].mag);
			stars.forEach((s)=>{ const m = Number(s.mag); if(Number.isFinite(m) && (!Number.isFinite(minMag) || m < minMag)){ minMag = m; anchor = s; } });
			const name = rareSafeText(item.name || item.pinyin || '');   // 名牌是画在贴图上的字:本机画不出的字换通行写法
			if(name){
				const labelSrc = { ra: anchor.ra, decl: anchor.decl, epoch: 'J2000' };
				const plane = this.createTextPlane(name, 24, '#dbe6f5', 'rgba(0,0,0,0)');
				plane.position = toSkyVector(projectedEquatorialItem(labelSrc, jd, obs, refr), labelRadius);
				plane.parent = group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'xingguan', layerKey: 'xingguan' };
				this.registerProjectableMesh(plane, labelSrc, labelRadius);
			}
		}
		return job.index < asterisms.length;
	},

	// 行星视运动轨迹(planetTrails)。数据来自后端 data.trails([{id,name,points:[{offsetDays,ra,decl,...}]}],
	// 当日历元真赤道,与 bodies 同口径)。每星一条 polyline,按该 body 颜色;projectable 随天转。轨迹必过当前星位
	// (offset0 在点列)。line.metadata.layerKey='planetTrails' 供 layerAllowsMesh 门控。仅在 data.trails 存在时绘制
	// (= 仅开启该层并带 includeTrails 重取后);默认无 trails → 留壳零开销。
	createPlanetTrails(data){
		const group = this.makeGroup('asterism-trails-layer');
		const obs = observerFromData(data && data.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const trails = (data && Array.isArray(data.trails)) ? data.trails : [];
		trails.forEach((trail, ti)=>{
			const pointsRaw = (trail && Array.isArray(trail.points)) ? trail.points : [];
			const pts = pointsRaw
				.filter((p)=>p && Number.isFinite(Number(p.ra)) && Number.isFinite(Number(p.decl)))
				.map((p)=>projectedEquatorialItem({ ra: p.ra, decl: p.decl }, jd, obs, refr));
			if(pts.length < 2){ return; }
			const color = BODY_COLORS[trail.id] || new BABYLON.Color3(0.7, 0.78, 0.92);
			const line = this.createLine(`asterism-trail-${trail.id || ti}`, pts, color, 0.62, group, LINE_RADIUS + 6, true);
			if(line){ line.metadata = { layerKey: 'planetTrails', body: { displayName: trail.name || trail.id } }; }
		});
		return group;
	},

	// 行星轨迹层刚打开时的那次重取:回包里只有 trails 是新东西,别的(星、网格、名牌、星官…)场景里都已经有了。
	// 只把轨迹补进现有场景,不整场拆掉重建(整场重建实测 350–800ms,其中画轨迹本身只 5ms)。
	// 返回耗时毫秒;场景还没有数据(没法只补)时返回 -1,调用方照旧整场 updateData。
	applyPlanetTrails(data){
		if(!this.scene || !this.lastData || !data || !Array.isArray(data.trails)){ return -1; }
		const started = nowMs();
		const isTrailGroup = (group)=>!!(group && group.name && group.name.indexOf('asterism-trails-layer') === 0);
		const isTrailMesh = (mesh)=>!!mesh && isTrailGroup(mesh.parent);
		this.projectableLines = (this.projectableLines || []).filter((item)=>!isTrailMesh(item && item.mesh));
		this.groups = (this.groups || []).filter((group)=>{
			if(isTrailGroup(group)){ group.dispose(false, true); return false; }
			return true;
		});
		this.lastData = { ...this.lastData, trails: data.trails };
		// 轨迹点是赤道坐标;先按回包自己的观测点 / 时刻摆,调用方随后 updateProjectedTime 统一摆到显示时刻
		this.createPlanetTrails({ observer: data.observer || this.lastData.observer, trails: data.trails });
		this.applyLayerVisibility();
		return Math.round(nowMs() - started);
	},

	// 西方 88 星座连线(E2)。数据来自 src/data/constellationLines.json(待权威开放数据集);空 = 留壳。
	createConstellationLines(observer){
		const group = this.makeGroup('constellation-line-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_LINES && CONSTELLATION_LINES.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl, epoch: 'J2000' }, jd, obs, refr));
				this.createLine(`constellation-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.5, 0.62, 0.85), 0.35, group, LINE_RADIUS + 18, true);
			});
		});
		return group;
	},

	// IAU 星座边界(E2,可选)。数据来自 src/data/constellationBounds.json;空 = 留壳。
	createConstellationBounds(observer){
		const group = this.makeGroup('constellation-bound-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_BOUNDS && CONSTELLATION_BOUNDS.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl, epoch: 'J2000' }, jd, obs, refr));
				this.createLine(`constellation-bound-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.45, 0.5, 0.6), 0.22, group, LINE_RADIUS + 16, true);
			});
		});
		return group;
	},

	createSu28Sectors(items, observer){
		const normalizedObserver = observerFromData(observer);
		// The 28 宿 are EQUATORIAL (赤道宿度): the mansions are placed by their distance-stars'
		// right ascension, NOT the ecliptic. Order/split by ra. Sectors come from the 28
		// distance-STARS only — the su28 list also carries planet markers via fillPlanetSu28,
		// which must not split the intervals (now that A2 re-projects them they'd be visible).
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return;
		}
		const group = this.makeGroup('su28-sector-layer');
		const sectorRadius = BODY_RADIUS - 22;
		const labelRadius = BODY_RADIUS - 2;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const midDecl = clamp((Number(item.decl) + Number(next.decl)) / 2, -72, 78);
			const sectorLabel = su28DisplayName(item);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const segmentVisible = this.showBelowHorizon() || allAboveHorizon([item, next]);
			const segment = this.createLine(
				`su28-sector-${item.id || item.name || idx}`,
				[item, next],
				color,
				0.7,
				group,
				sectorRadius,
				true,
			);
			if(segment){
				segment.metadata = { layerKind: 'su28Sector', label: `${sectorLabel}区间` };
				segment.setEnabled(segmentVisible);
				const registered = this.projectableLines.find((lineItem)=>lineItem.mesh === segment);
				if(registered){
					registered.visibilityMode = 'allAbove';
					registered.lastProjectedSources = [item, next];
				}
			}
			const labelSource = {
				ra: midRa,
				decl: midDecl,
				name: `${sectorLabel}区间`,
				altitudeAppa: 0,
				azimuth: 0,
			};
			const label = this.createTextPlane(`${sectorLabel}区间`, 26, '#dceeff', 'rgba(0,0,0,0)');
			label.position = toSkyVector(projectedEquatorialItem(labelSource, normalizedObserver && normalizedObserver.jd ? normalizedObserver.jd : 2451545, normalizedObserver), labelRadius);
			label.parent = group;
			label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			label.metadata = { labelKind: 'su28Sector' };
			label.setEnabled(segmentVisible);
			this.registerProjectableMesh(label, labelSource, labelRadius, {
				visibilityMode: 'allAbove',
				visibilitySources: [item, next],
				lastProjectedSources: [item, next],
			});
		});
	},

	// 二十八宿赤道网格(纯天文·赤道制):28 距星的「真实赤经」即宿界 —— 每条经圈是过天极的赤道大圆,
	// 绝不走宿度制/黄道投影(纯天文铁律)。取数同 createSu28Sectors(只用 28 距星,planet markers 不分界),
	// 画法同 createCoordinateGrid 的经圈(decl 扫,equatorialToHorizontal 投影,projectable 随天转)。
	// 四象配色(每 7 宿一象);宿界经圈略强调,象内可选 10° 赤纬纬线;沿赤道标宿名。metadata.gridKey='su28Grid'。
	createSu28Grid(items, observer){
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return null;
		}
		const group = this.makeGroup('grid-su28-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = 756; // 贴赤道刻度盘外缘(赤道网格 754 / 赤道刻度 756),与赤道网格区分
		const density = 96;
		// 过极大圆 decl 采样到 ±90(含极点):与赤道网格 vRange[-90,90] 同口径 —— equatorialToHorizontal 在极点返
		// 有限值(方位任意但 toSkyVector 落到天极轴点),故 28 条线在天极干净收敛、无断口/无留洞(±89.5 会在极点留洞=线断)。
		const declLo = -90;
		const declHi = 90;
		const dvs = (declHi - declLo) / density;
		// ① 经圈:每距星赤经一条过极大圆。宿界(第一条/每象首宿)略强调。
		sectorStars.forEach((item, idx)=>{
			const ra = normalizeDegrees(item.ra);
			// 四象配色/象首按传统宿序(角起),而非赤经升序 idx(否则整体偏移一象);宿名不识别则退回 idx。
			const seq = su28SequenceIndex(item);
			const ord = seq >= 0 ? seq : idx;
			const color = SU28_PALACE_COLORS[Math.floor(ord / 7) % SU28_PALACE_COLORS.length];
			const isPalaceHead = (ord % 7 === 0); // 每象首宿(角/斗/奎/井)经圈略强调
			const pts = [];
			for(let d = declLo; d <= declHi + 1e-9; d += dvs){
				pts.push({ ...equatorialToHorizontal(ra, d, jd, obs, refr), ra, decl: d });
			}
			const line = this.createLine(`grid-su28-mer-${item.id || item.name || idx}`, pts, color, isPalaceHead ? 0.42 : 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		});
		// ② 仅赤道腰线(decl=0):二十八宿以赤道为腰,去掉同心纬圈(用户:同心圆使盘面模糊),只留赤道一条。
		const equatorColor = new BABYLON.Color3(0.86, 0.74, 0.46);
		const us = 360 / density;
		{
			const pts = [];
			for(let u = 0; u <= 360 + 1e-9; u += us){
				const ra = u % 360;
				pts.push({ ...equatorialToHorizontal(ra, 0, jd, obs, refr), ra, decl: 0 });
			}
			const line = this.createLine('grid-su28-par-0', pts, equatorColor, 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		}
		// ③ 沿赤道(decl=0)标宿名:每宿区间中点处一枚 billboard,字号适中、防极点拥挤(都在赤道附近)。
		const labelRadius = radius + 6;
		const gate = !!this.layers.su28Grid;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const labelColor = `#${color.toHexString().slice(1)}`;
			const sectorLabel = su28DisplayName(item);
			const labelSource = { ra: midRa, decl: 0, name: sectorLabel, altitudeAppa: 0, azimuth: 0 };
			const plane = this.createTextPlane(sectorLabel, 24, labelColor, 'rgba(0,0,0,0)');
			plane.position = toSkyVector(projectedEquatorialItem(labelSource, jd, obs, refr), labelRadius);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { gridKey: 'su28Grid', labelKind: 'su28GridName' };
			plane.setEnabled(gate);
			this.registerProjectableMesh(plane, labelSource, labelRadius);
		});
		return group;
	},

	createTraditionalLayer(kind, items, color, diameter){
		const group = this.makeGroup(`${kind}-layer`);
		items.forEach((raw)=>{
			// 二十八宿星点按传统距星真实位置画(后端 trueStar:胃=35 Ari / 鬼=θ Cnc,当日历元 + 地平坐标);
			// 宿界/宿区间仍按 item.ra(REAL 口径含经验赤经修正)——两者此前同用修正后坐标,星点不落在任何真实星位上。
			const ts = kind === 'su28' && raw && raw.trueStar && Number.isFinite(Number(raw.trueStar.ra)) ? raw.trueStar : null;
			const item = ts ? { ...raw, ra: ts.ra, decl: ts.decl, azimuth: ts.azimuth, altitudeTrue: ts.altitudeTrue, altitudeAppa: ts.altitudeAppa, distanceStar: ts.name } : raw;
			const mesh = BABYLON.MeshBuilder.CreateSphere(`${kind}-${item.id || item.name}`, { diameter: diameter || 5, segments: 8 }, this.scene);
			mesh.position = toSkyVector(item, BODY_RADIUS - 28);
			mesh.material = this.material(`${kind}-mat-${item.id || item.name}`, color, 0.9);
			mesh.parent = group;
			mesh.metadata = { body: { ...item, displayName: item.name || item.id, layer: kind } };
			this.pickMeshes.push(mesh);
			this.registerProjectableMesh(mesh, item, BODY_RADIUS - 28);
			if(item.id){ this.bodyMeshes[item.id] = mesh; }
			if(item.name){ this.bodyMeshes[item.name] = mesh; }
		});
		if(kind === 'beidou' && items.length > 1){
			this.createLine('beidou-line', items, color, 0.72, group, BODY_RADIUS - 28, true);
		}
	},
};
