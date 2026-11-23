// 风水纳气盘引擎 · 几何与视图:缩放与坐标换算、盘心与旋转、中宫与扇区判定、内局几何输入、吸附、画布尺寸与视图缩放、标记判定
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { rotatePoint, angleInSector } from '../fengshuiGeom';
import { pointerToLocal } from '../../../utils/zoomDomain';
import { SECTORS, WIND_NUMS, WATER_NUMS, SNAP_TOLERANCE } from './constants';

export const geometryMethods = {
	// ── 几何 ───────────────────────────────────────────────────
	getCombinedScale() {
		return this.scale * this.viewScale;
	},

	getRectCenter() {
		return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 };
	},

	getMousePos(evt) {
		// 鼠标(视觉域)→ 画布逻辑坐标(布局域,与 viewW/viewH 同域):按「画布布局宽 ÷ rect 宽」折算,不问缩放值。
		// 此前直接 clientX − rect.left,缩放档下落点 / 拖拽 / 命中与鼠标差 z 倍。
		const p = pointerToLocal(evt, this.canvas);
		return { x: p.x, y: p.y };
	},

	screenToImage(pos) {
		const c = this.getCombinedScale();
		return { x: (pos.x - this.viewOffset.x) / c, y: (pos.y - this.viewOffset.y) / c };
	},

	getDiskRotation() {
		if (this.techMode === 'bagua') {
			if (this.baguaOrient === null || Number.isNaN(this.baguaOrient)) return 0;
			return this.baguaOrient;
		}
		if (this.unitAzimuth === null || this.doorImageAngle === null) return 0;
		if (Number.isNaN(this.unitAzimuth) || Number.isNaN(this.doorImageAngle)) return 0;
		return this.doorImageAngle - this.unitAzimuth;
	},

	isWindSector(num) {
		if (this.periodMode === 'current') return WIND_NUMS.has(num);
		return WATER_NUMS.has(num);
	},

	getDiskCenter() {
		if (!this.rect.active) return null;
		// 八卦阳宅法固定用房屋正中(帮助如是);盘心四档只在纳气左栏出现,此前纳气改过盘心后切八卦按错盘心算且无处改回。
		if (this.techMode === 'bagua') return this.getRectCenter();
		if (this.diskCenterMode === 'house') return this.getRectCenter();
		if (this.diskCenterMode === 'custom') return this.customCenter || this.getRectCenter();
		if (this.diskCenterMode === 'marker') {
			const m = this.markers.find((x) => x.id === this.selectedMarkerId);
			return m ? { x: m.x, y: m.y } : this.getRectCenter();
		}
		if (this.diskCenterMode === 'door') {
			const m = this.markers.find((x) => x.type === 'entryDoor');
			return m ? { x: m.x, y: m.y } : this.getRectCenter();
		}
		return this.getRectCenter();
	},

	// 供「室内凶局几何自动检测」取用的结构化输入。
	// 🔴 方位一律由本引擎的 getSectorForPoint 现算（含盘面旋转），检测侧不自铺九宫；
	//    房屋框只是矩形，故无「轮廓多边形」——缺角一项会如实落在「未判之项」，不臆造。
	// 🔴 中宫：扇区表 SECTORS 只有外八方、并无中宫，若只问 getSectorForPoint，
	//    「卫生间在中宫」一项永不可能命中（＝死判据）。故中宫按九宫之常法取
	//    房屋框的**居中九分之一**（先转入框的本地坐标，故随框旋转而动）。
	inCenterPalace(pt) {
		const center = this.getRectCenter();
		const local = rotatePoint(pt, center, -this.rect.rotation);
		return Math.abs(local.x - center.x) <= this.rect.w / 6
			&& Math.abs(local.y - center.y) <= this.rect.h / 6;
	},

	buildNeijuGeoInput() {
		if (!this.rect.active || !this.rect.w || !this.rect.h) { return null; }
		const gongOf = (pt)=>{
			if (this.inCenterPalace(pt)) { return 5; }
			const s = this.getSectorForPoint(pt);
			return s ? s.num : null;
		};
		const markers = this.currentModeMarkers().map((m)=>({ type: m.type, x: m.x, y: m.y, gong: gongOf(m) }));
		return {
			rect: { w: this.rect.w, h: this.rect.h },
			outline: null,
			markers,
			gongAt: (x, y)=>gongOf({ x, y }),
		};
	},

	getMaxDiskRadius(center) {
		if (!this.rect.active) return 0;
		const rc = this.getRectCenter();
		const hw = this.rect.w / 2;
		const hh = this.rect.h / 2;
		const corners = [
			{ x: rc.x - hw, y: rc.y - hh },
			{ x: rc.x + hw, y: rc.y - hh },
			{ x: rc.x + hw, y: rc.y + hh },
			{ x: rc.x - hw, y: rc.y + hh },
		];
		let max = 0;
		corners.forEach((c) => {
			const r = rotatePoint(c, rc, this.rect.rotation);
			const d = Math.hypot(r.x - center.x, r.y - center.y);
			if (d > max) max = d;
		});
		return max;
	},

	snapPointToRect(pos) {
		if (!this.snapEnabled || !this.rect.active) return pos;
		const tol = SNAP_TOLERANCE / this.getCombinedScale();
		const center = this.getRectCenter();
		const local = rotatePoint(pos, center, -this.rect.rotation);
		let lx = local.x;
		let ly = local.y;
		const hw = this.rect.w / 2;
		const hh = this.rect.h / 2;
		[center.x - hw, center.x, center.x + hw].forEach((line) => {
			if (Math.abs(lx - line) <= tol) lx = line;
		});
		[center.y - hh, center.y, center.y + hh].forEach((line) => {
			if (Math.abs(ly - line) <= tol) ly = line;
		});
		// 不吸到中心交点:两轴都吸到中线会把标记钉在盘心(方位无定义);放开偏差较大的那一轴。
		if (lx === center.x && ly === center.y) {
			if (Math.abs(local.x - center.x) >= Math.abs(local.y - center.y)) lx = local.x; else ly = local.y;
		}
		return rotatePoint({ x: lx, y: ly }, center, this.rect.rotation);
	},

	snapRectToImage() {
		if (!this.snapEnabled || !this.imgLoaded) return;
		if (Math.abs(this.rect.rotation) > 0.5) return;
		if (this.rect.w <= 0 || this.rect.h <= 0) return;
		const tol = SNAP_TOLERANCE / this.getCombinedScale();
		const cx = [
			{ edge: this.rect.x, target: 0, offset: 0 },
			{ edge: this.rect.x + this.rect.w, target: this.img.width, offset: this.rect.w },
			{ edge: this.rect.x + this.rect.w / 2, target: this.img.width / 2, offset: this.rect.w / 2 },
		];
		const cy = [
			{ edge: this.rect.y, target: 0, offset: 0 },
			{ edge: this.rect.y + this.rect.h, target: this.img.height, offset: this.rect.h },
			{ edge: this.rect.y + this.rect.h / 2, target: this.img.height / 2, offset: this.rect.h / 2 },
		];
		cx.forEach((c) => { if (Math.abs(c.edge - c.target) <= tol) this.rect.x = c.target - c.offset; });
		cy.forEach((c) => { if (Math.abs(c.edge - c.target) <= tol) this.rect.y = c.target - c.offset; });
	},

	// ── 画布尺寸：铺满工作区 + 户型图居中（纳气盘可越出图边不被裁）──
	resize() {
		const host = this.canvas.parentElement;
		if (!host) return;
		// 画布恒等于宿主盒(宿主 overflow:hidden):此前给了 320 CSS px 的裸底线,放大档 / 小窗下宿主不足 320 时画布比宿主高出一截,
		// 底部那截被宿主裁掉、户型图也按「虚高」居中而偏下。宿主量不到(页签未激活时 display:none → 0)才回落到 320,免得建出零尺寸画布。
		const w = host.clientWidth > 0 ? host.clientWidth : 320;
		const h = host.clientHeight > 0 ? host.clientHeight : 320;
		// Retina：backing store 按 dpr 放大、CSS 保持逻辑像素、坐标系 setTransform 回逻辑像素
		//（本应用仅 macOS=全 2x 屏,不处理则罗盘/户型图/canvas 文字永远半分辨率发虚;
		//  3D 视图早已同款处理）。布局/鼠标仍用逻辑 viewW/viewH(鼠标坐标经 getMousePos 折回布局域,见该处注释)。
		const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
		this.dpr = dpr;
		this.viewW = w;
		this.viewH = h;
		this.canvas.width = Math.round(w * dpr);
		this.canvas.height = Math.round(h * dpr);
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (this.imgLoaded) {
			this.scale = Math.min((w * 0.92) / this.img.width, (h * 0.92) / this.img.height);
			this.recenter();
		}
		this.drawAll();
	},

	recenter() {
		const c = this.getCombinedScale();
		this.viewOffset = {
			x: ((this.viewW || this.canvas.width) - this.img.width * c) / 2,
			y: ((this.viewH || this.canvas.height) - this.img.height * c) / 2,
		};
	},

	setViewScale(newScale, anchor) {
		const clamped = Math.max(0.4, Math.min(3.0, newScale));
		const combined = this.getCombinedScale();
		const nextCombined = this.scale * clamped;
		const point = anchor || { x: (this.viewW || this.canvas.width) / 2, y: (this.viewH || this.canvas.height) / 2 };
		const imgX = (point.x - this.viewOffset.x) / combined;
		const imgY = (point.y - this.viewOffset.y) / combined;
		this.viewScale = clamped;
		this.viewOffset = { x: point.x - imgX * nextCombined, y: point.y - imgY * nextCombined };
		this.drawAll();
		this.emit();
	},

	zoomIn() { this.setViewScale(this.viewScale * 1.1); },

	zoomOut() { this.setViewScale(this.viewScale / 1.1); },

	resetView() { this.viewScale = 1; this.recenter(); this.drawAll(); this.emit(); },

	// ── 判定 ───────────────────────────────────────────────────
	// 标记与盘心重合(容差=2 屏幕像素):atan2(0,0)=0 会把它钉在「指北角 90°−盘旋转」那一扇区,
	// 与真实方位无关却进合冲/破局/评分 —— 盘心=入户门时的入户门自身、盘心=选中标记时的床桌沙发自身、吸附到中心的标记
	// 都会中招。判「中宫/不计」:不给扇区、不进合冲与扣分。
	isAtDiskCenter(marker) {
		const center = this.getDiskCenter();
		if (!center) return false;
		const tol = 2 / Math.max(1e-6, this.getCombinedScale());
		return Math.hypot(marker.x - center.x, marker.y - center.y) <= tol;
	},

	getSectorForPoint(marker) {
		const center = this.getDiskCenter();
		if (!center) return null;
		if (this.isAtDiskCenter(marker)) return null;
		const dx = marker.x - center.x;
		const dy = marker.y - center.y;
		const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
		let compass = angle + 90;
		if (compass < 0) compass += 360;
		let rotated = compass - this.getDiskRotation();
		if (rotated < 0) rotated += 360;
		rotated %= 360;
		for (const sector of SECTORS) {
			if (angleInSector(rotated, sector.start, sector.end)) return sector;
		}
		return null;
	},

	evaluateMarker(marker) {
		const sector = this.getSectorForPoint(marker);
		// 中宫(与盘心重合):不计 —— ok=true(不算冲突、不扣分),center 标记供显示层写「中宫(盘心,不计)」。
		if (!sector && this.isAtDiskCenter(marker)) return { sector: null, expected: marker.category, actual: null, ok: true, center: true };
		if (!sector) return { sector: null, expected: marker.category, actual: null, ok: marker.category === 'neutral' };
		const actual = this.isWindSector(sector.num) ? 'wind' : 'water';
		const ok = marker.category === 'neutral' || marker.category === actual;
		return { sector, expected: marker.category, actual, ok };
	},
};
