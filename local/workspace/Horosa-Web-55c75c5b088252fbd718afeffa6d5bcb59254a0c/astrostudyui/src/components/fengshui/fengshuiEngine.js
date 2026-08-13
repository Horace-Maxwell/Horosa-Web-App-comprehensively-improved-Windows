// 风水纳气盘引擎（从 public/fengshui/app.js 移植为框架无关模块）。
// 由 React 组件持有：构造时传入 canvas 与 onChange(viewModel) 回调；
// 所有画布绘制/几何/判定/历史/导出/快照逻辑在此，React 只渲染 Antd 控件并调用本类方法。
// 注意：画布按工作区尺寸铺满、户型图居中绘制，纳气盘可延伸到图外空白区而不被裁切。

import { rotatePoint, angleInSector, formatAngle } from './fengshuiGeom';
import { harmForMarker, HARM_MAP, evalDragonTiger, scoreNaqi, gradeOf, REMEDY_LIB } from './naqiRules';
import { GUA_8, composeHexagram, computeTiming, HEXAGRAM_TEXTS, HEXAGRAM_META, guaBySectorNum, computeRankShift, namePositionRelation, featureJudgment, GUA_TO_ROLE } from './baguaCore';

export const SECTORS = [
	{ num: 1, name: '北(坎)', start: 337.5, end: 22.5 },
	{ num: 8, name: '东北(艮)', start: 22.5, end: 67.5 },
	{ num: 3, name: '东(震)', start: 67.5, end: 112.5 },
	{ num: 4, name: '东南(巽)', start: 112.5, end: 157.5 },
	{ num: 9, name: '南(离)', start: 157.5, end: 202.5 },
	{ num: 2, name: '西南(坤)', start: 202.5, end: 247.5 },
	{ num: 7, name: '西(兑)', start: 247.5, end: 292.5 },
	{ num: 6, name: '西北(乾)', start: 292.5, end: 337.5 },
];

export const MARKER_TYPES = [
	{ id: 'entryDoor', label: '入户门', short: '门', category: 'wind', color: '#c34f3a' },
	{ id: 'window', label: '窗户', short: '窗', category: 'wind', color: '#b05445' },
	{ id: 'balcony', label: '阳台', short: '阳', category: 'wind', color: '#c76a3c' },
	{ id: 'stove', label: '灶台', short: '灶', category: 'wind', color: '#d26a4e' },
	{ id: 'sofa', label: '沙发', short: '沙', category: 'wind', color: '#b76b58' },
	{ id: 'bed', label: '床', short: '床', category: 'wind', color: '#a8615e' },
	{ id: 'desk', label: '书桌', short: '桌', category: 'wind', color: '#9e5a6a' },
	{ id: 'altar', label: '神龛', short: '龛', category: 'wind', color: '#8c4e44' },
	{ id: 'petBed', label: '宠物床', short: '宠', category: 'wind', color: '#a96a5b' },
	{ id: 'sink', label: '水槽', short: '槽', category: 'water', color: '#2b5ea0' },
	{ id: 'washbasin', label: '洗手池', short: '洗', category: 'water', color: '#2e6ea7' },
	{ id: 'toilet', label: '马桶', short: '厕', category: 'water', color: '#2f5c88' },
	{ id: 'drain', label: '下水管', short: '管', category: 'water', color: '#2a5a93' },
	{ id: 'washingMachine', label: '洗衣机', short: '机', category: 'water', color: '#2f6f9c' },
	{ id: 'bathroom', label: '卫生间', short: '卫', category: 'water', color: '#275783' },
	{ id: 'custom', label: '自定义', short: '标', category: 'neutral', color: '#6b655a' },
];

// 八卦阳宅标记调色板：成員（8 角色直选，角色→本命卦）+ 四类象格局（灶/厕/厅/门）。
// 落点后由 getSectorForPoint 取扇区→卦自动判读，无需任何表单。
export const BAGUA_MARKER_TYPES = [
	{ id: 'm-fu', label: '父', short: '父', kind: 'member', role: '父', benmingGua: '乾', color: '#b5793a' },
	{ id: 'm-mu', label: '母', short: '母', kind: 'member', role: '母', benmingGua: '坤', color: '#c06aa0' },
	{ id: 'm-zhangzi', label: '长子', short: '长子', kind: 'member', role: '长子', benmingGua: '震', color: '#3f8a6a' },
	{ id: 'm-cizi', label: '次子', short: '次子', kind: 'member', role: '次子', benmingGua: '坎', color: '#3a6e9c' },
	{ id: 'm-sanzi', label: '三子', short: '三子', kind: 'member', role: '三子', benmingGua: '艮', color: '#6b8a3f' },
	{ id: 'm-zhangnv', label: '长女', short: '长女', kind: 'member', role: '长女', benmingGua: '巽', color: '#1497a8' },
	{ id: 'm-cinv', label: '次女', short: '次女', kind: 'member', role: '次女', benmingGua: '离', color: '#c0603a' },
	{ id: 'm-sannv', label: '三女', short: '三女', kind: 'member', role: '三女', benmingGua: '兑', color: '#9a5aa0' },
	{ id: 'f-kitchen', label: '厨房灶', short: '灶', kind: 'feature', feature: 'kitchen', color: '#cf1322' },
	{ id: 'f-toilet', label: '厕所', short: '厕', kind: 'feature', feature: 'toilet', color: '#8b5e3c' },
	{ id: 'f-living', label: '客厅', short: '厅', kind: 'feature', feature: 'living', color: '#6b8aa0' },
	{ id: 'f-door', label: '大门', short: '门', kind: 'feature', feature: 'door', color: '#c0883a' },
];

const WIND_NUMS = new Set([6, 7, 8, 9]);
const WATER_NUMS = new Set([1, 2, 3, 4]);
const WIND_COLOR = 'rgb(180, 30, 30)';
const WATER_COLOR = 'rgb(20, 30, 100)';
const SNAP_TOLERANCE = 8;
const HISTORY_LIMIT = 80;

const TIPS = [
	'楼门朝向以卫星地图为准，门内朝门外，记录真北角度。',
	'家门方向在户型图上画出，令两箭头平行后再判定。',
	'房屋主体以矩形为准，扩大范围导致空缺大于实体时不再扩大。',
	'盘心放在太极点，八方颜色与数字即可判断气位与水位。',
];
const ADVICE = '气位建议放置：门、窗、灶台、沙发、床、书桌、神龛、宠物床等。水位建议放置：水槽、洗手池、马桶、下水管、洗衣机、厕所等。';

// 罗盘盘面皮肤（纯视觉层；判读始终用 SECTORS 数学）。northOffset 为南上图相对北上盘的旋转校准（预览微调）。
export const DISK_SKINS = [
	{ key: 'draw', label: '绘制盘', src: null, northOffset: 0, scale: 1 },
	{ key: 'naqi-luopan', label: '纳气罗盘', src: '/fengshui/skins/naqi-luopan.png', northOffset: 180, scale: 1 },
	{ key: 'bagua-24', label: '二十四山阳宅图', src: '/fengshui/skins/bagua-24.png', northOffset: 180, scale: 1 },
];

const SECTOR_INDEX = {};
SECTORS.forEach((s, i) => { SECTOR_INDEX[s.num] = i; });
// 扇区物理相邻（数组循环，相差 ≤1）——用于厨房洗菜池归类（与灶台同/邻扇区）。
function sectorAdjacent(a, b) {
	const ia = SECTOR_INDEX[a];
	const ib = SECTOR_INDEX[b];
	if (ia === undefined || ib === undefined) return false;
	const d = Math.abs(ia - ib);
	return d === 0 || d === 1 || d === SECTORS.length - 1;
}

export default class FengShuiEngine {
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.onChange = options.onChange || (() => {});

		this.img = new Image();
		this.imgLoaded = false;
		this.scale = 1;
		this.viewScale = 1;
		this.viewOffset = { x: 0, y: 0 };

		this.rect = { x: 0, y: 0, w: 0, h: 0, rotation: 0, active: false };
		this.mode = 'none';
		this.isDragging = false;
		this.startPoint = { x: 0, y: 0 };
		this.activeHandle = null;
		this.initialRectState = null;
		this.dragMarkerId = null;
		this.panStart = null;
		this.panMode = false;
		this.snapEnabled = true;

		this.unitAzimuth = null;
		this.doorImageAngle = null;
		this.globalAlpha = 0.3;
		this.diskScale = 1;
		this.diskCenterMode = 'house';
		this.customCenter = null;
		this.periodMode = 'current';

		this.markers = [];
		this.selectedMarkerId = null;
		this.markerIdSeed = 1;
		this.currentFilter = 'all';
		this.markerType = MARKER_TYPES[0].id;

		// 模式 / 八卦朝向 / 罗盘皮肤（默认 naqi + draw = 现状零回归）
		this.techMode = 'naqi'; // 'naqi' | 'bagua'
		this.baguaOrient = null; // 八卦阳宅：单一「正北方向(度)」，驱动盘旋转
		this.diskSkin = 'draw';
		this.skinImages = {}; // src -> HTMLImageElement 缓存
		this.facingMarkerId = null; // 正在标灶口朝向的灶台标记

		this.status = '请上传户型图开始。';

		this.historyStack = [];
		this.redoStack = [];
		this.historyLocked = false;
		this.historyTimer = null;

		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);

		canvas.addEventListener('mousedown', this._onMouseDown);
		canvas.addEventListener('mousemove', this._onMouseMove);
		window.addEventListener('mouseup', this._onMouseUp);

		this.initHistory();
		this.emit();
	}

	destroy() {
		this.canvas.removeEventListener('mousedown', this._onMouseDown);
		this.canvas.removeEventListener('mousemove', this._onMouseMove);
		window.removeEventListener('mouseup', this._onMouseUp);
		if (this.historyTimer) clearTimeout(this.historyTimer);
	}

	// ── 视图模型 ───────────────────────────────────────────────
	emit() {
		this.onChange(this.getViewModel());
	}

	getViewModel() {
		const markers = this.markers.map((m) => {
			const ev = this.evaluateMarker(m);
			return {
				id: m.id,
				label: m.label,
				short: m.short,
				category: m.category,
				color: m.color,
				sector: ev.sector ? { num: ev.sector.num, name: ev.sector.name } : null,
				actual: ev.actual,
				ok: ev.ok,
			};
		});
		const stats = { windOk: 0, waterOk: 0, windBad: 0, waterBad: 0, unknown: 0 };
		this.markers.forEach((m) => {
			const ev = this.evaluateMarker(m);
			if (!ev.sector) stats.unknown += 1;
			else if (m.category === 'wind') ev.ok ? (stats.windOk += 1) : (stats.windBad += 1);
			else if (m.category === 'water') ev.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
		});
		const summary = this.markers.length
			? `气位正确 ${stats.windOk} 项，气位冲突 ${stats.windBad} 项；水位正确 ${stats.waterOk} 项，水位冲突 ${stats.waterBad} 项；未定位 ${stats.unknown} 项。`
			: '';
		return {
			status: this.status,
			imgLoaded: this.imgLoaded,
			rectActive: this.rect.active,
			rectRotation: this.rect.rotation || 0,
			unitAzimuth: this.unitAzimuth,
			doorImageAngle: this.doorImageAngle,
			unitAngleText: formatAngle(this.unitAzimuth),
			doorAngleText: formatAngle(this.doorImageAngle),
			diskRotationText: formatAngle(this.getDiskRotation()),
			globalAlpha: this.globalAlpha,
			diskScale: this.diskScale,
			diskCenterMode: this.diskCenterMode,
			periodMode: this.periodMode,
			snapEnabled: this.snapEnabled,
			panMode: this.panMode,
			zoomPct: Math.round(this.viewScale * 100),
			markerType: this.markerType,
			currentFilter: this.currentFilter,
			selectedMarkerId: this.selectedMarkerId,
			techMode: this.techMode,
			diskSkin: this.diskSkin,
			baguaOrient: this.baguaOrient,
			naqi: this.techMode === 'naqi' ? this.buildNaqiAnalysis() : null,
			bagua: this.techMode === 'bagua' ? this.buildBaguaAnalysis() : null,
			markers,
			summary,
			canUndo: this.historyStack.length >= 2,
			canRedo: this.redoStack.length > 0,
			snapshotText: this.buildAiSnapshotText(),
		};
	}

	setStatus(text) {
		this.status = text;
	}

	// ── 历史（撤销/重做）─────────────────────────────────────────
	captureState() {
		return {
			rect: { ...this.rect },
			markers: this.markers.map((m) => ({ ...m })),
			unitAzimuth: this.unitAzimuth,
			doorImageAngle: this.doorImageAngle,
			globalAlpha: this.globalAlpha,
			diskScale: this.diskScale,
			diskCenterMode: this.diskCenterMode,
			customCenter: this.customCenter ? { ...this.customCenter } : null,
			periodMode: this.periodMode,
			selectedMarkerId: this.selectedMarkerId,
			markerIdSeed: this.markerIdSeed,
			techMode: this.techMode,
			baguaOrient: this.baguaOrient,
			diskSkin: this.diskSkin,
		};
	}

	applySnapshot(s) {
		if (!s) return;
		this.historyLocked = true;
		this.rect = { ...s.rect };
		this.markers = s.markers.map((m) => ({ ...m }));
		this.unitAzimuth = s.unitAzimuth;
		this.doorImageAngle = s.doorImageAngle;
		this.globalAlpha = s.globalAlpha;
		this.diskScale = s.diskScale;
		this.diskCenterMode = s.diskCenterMode;
		this.customCenter = s.customCenter ? { ...s.customCenter } : null;
		this.periodMode = s.periodMode;
		this.selectedMarkerId = s.selectedMarkerId ?? null;
		this.markerIdSeed = s.markerIdSeed ?? this.markers.reduce((mx, m) => Math.max(mx, m.id), 0) + 1;
		this.techMode = s.techMode || 'naqi';
		this.baguaOrient = s.baguaOrient ?? null;
		this.diskSkin = s.diskSkin || 'draw';
		this.drawAll();
		this.historyLocked = false;
	}

	initHistory() {
		this.historyStack = [this.captureState()];
		this.redoStack = [];
	}

	pushHistory() {
		if (this.historyLocked) return;
		this.historyStack.push(this.captureState());
		if (this.historyStack.length > HISTORY_LIMIT) this.historyStack.shift();
		this.redoStack = [];
	}

	scheduleHistoryPush() {
		if (this.historyLocked) return;
		clearTimeout(this.historyTimer);
		this.historyTimer = setTimeout(() => this.pushHistory(), 350);
	}

	undo() {
		if (this.historyStack.length < 2) return;
		const cur = this.historyStack.pop();
		this.redoStack.push(cur);
		this.applySnapshot(this.historyStack[this.historyStack.length - 1]);
		this.setStatus('已撤销上一步。');
		this.emit();
	}

	redo() {
		if (this.redoStack.length === 0) return;
		const next = this.redoStack.pop();
		this.historyStack.push(next);
		this.applySnapshot(next);
		this.setStatus('已重做一步。');
		this.emit();
	}

	// ── 几何 ───────────────────────────────────────────────────
	getCombinedScale() {
		return this.scale * this.viewScale;
	}

	getRectCenter() {
		return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 };
	}

	getMousePos(evt) {
		const r = this.canvas.getBoundingClientRect();
		return { x: evt.clientX - r.left, y: evt.clientY - r.top };
	}

	screenToImage(pos) {
		const c = this.getCombinedScale();
		return { x: (pos.x - this.viewOffset.x) / c, y: (pos.y - this.viewOffset.y) / c };
	}

	getDiskRotation() {
		if (this.techMode === 'bagua') {
			if (this.baguaOrient === null || Number.isNaN(this.baguaOrient)) return 0;
			return this.baguaOrient;
		}
		if (this.unitAzimuth === null || this.doorImageAngle === null) return 0;
		if (Number.isNaN(this.unitAzimuth) || Number.isNaN(this.doorImageAngle)) return 0;
		return this.doorImageAngle - this.unitAzimuth;
	}

	isWindSector(num) {
		if (this.periodMode === 'current') return WIND_NUMS.has(num);
		return WATER_NUMS.has(num);
	}

	getDiskCenter() {
		if (!this.rect.active) return null;
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
	}

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
	}

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
	}

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
	}

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
		return rotatePoint({ x: lx, y: ly }, center, this.rect.rotation);
	}

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
	}

	// ── 画布尺寸：铺满工作区 + 户型图居中（纳气盘可越出图边不被裁）──
	resize() {
		const host = this.canvas.parentElement;
		if (!host) return;
		const w = Math.max(320, host.clientWidth);
		const h = Math.max(320, host.clientHeight);
		// Retina：backing store 按 dpr 放大、CSS 保持逻辑像素、坐标系 setTransform 回逻辑像素
		//（本应用仅 macOS=全 2x 屏,不处理则罗盘/户型图/canvas 文字永远半分辨率发虚;
		//  3D 视图早已同款处理）。布局/鼠标仍用逻辑 viewW/viewH(getBoundingClientRect 本就是 CSS px)。
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
	}

	recenter() {
		const c = this.getCombinedScale();
		this.viewOffset = {
			x: ((this.viewW || this.canvas.width) - this.img.width * c) / 2,
			y: ((this.viewH || this.canvas.height) - this.img.height * c) / 2,
		};
	}

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
	}

	zoomIn() { this.setViewScale(this.viewScale * 1.1); }
	zoomOut() { this.setViewScale(this.viewScale / 1.1); }
	resetView() { this.viewScale = 1; this.recenter(); this.drawAll(); this.emit(); }

	// ── 绘制 ───────────────────────────────────────────────────
	drawAll() {
		const { ctx, canvas } = this;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!this.imgLoaded) return;
		const c = this.getCombinedScale();
		ctx.drawImage(this.img, this.viewOffset.x, this.viewOffset.y, this.img.width * c, this.img.height * c);
		if (this.rect.w !== 0 && this.rect.h !== 0) this.drawRotatedRect(ctx, c, this.viewOffset);
		if (this.rect.active) this.drawDisk(ctx, c, this.viewOffset);
		this.drawMarkers(ctx, c, this.viewOffset);
	}

	// 按模式 + 皮肤选择盘面绘制。
	drawDisk(ctx, sf, off) {
		const skin = this.getSkinImage();
		if (this.techMode === 'bagua') {
			if (skin) this.drawDiskSkin(ctx, sf, off, skin);
			this.drawBaguaDisk(ctx, sf, off, !!skin);
			return;
		}
		if (skin) { this.drawDiskSkin(ctx, sf, off, skin); this.drawDoorLines(ctx, sf, off); return; }
		this.drawNaQiDisk(ctx, sf, off);
	}

	getDiskGeom(sf, off) {
		const center = this.getDiskCenter();
		if (!center) return null;
		const cx = center.x * sf + off.x;
		const cy = center.y * sf + off.y;
		const radius = this.getMaxDiskRadius(center) * this.diskScale * sf;
		if (radius <= 0) return null;
		return { cx, cy, radius, diskRotation: this.getDiskRotation() };
	}

	// 透明罗盘皮肤：旋转贴图（南上图 + northOffset 校准）。
	drawDiskSkin(ctx, sf, off, { img, skin }) {
		const g = this.getDiskGeom(sf, off);
		if (!g) return;
		const r = g.radius * (skin.scale || 1);
		ctx.save();
		ctx.translate(g.cx, g.cy);
		ctx.rotate(((g.diskRotation + (skin.northOffset || 0)) * Math.PI) / 180);
		ctx.globalAlpha = Math.min(1, this.globalAlpha + 0.5);
		ctx.drawImage(img, -r, -r, r * 2, r * 2);
		ctx.restore();
		ctx.globalAlpha = 1;
	}

	// 单元门线（绿）+ 入户门线（红虚），供皮肤/八卦模式叠加对位。
	drawDoorLines(ctx, sf, off) {
		const g = this.getDiskGeom(sf, off);
		if (!g) return;
		if (this.unitAzimuth !== null && !Number.isNaN(this.unitAzimuth)) {
			const ur = ((this.unitAzimuth - 90) * Math.PI) / 180;
			ctx.save(); ctx.translate(g.cx, g.cy);
			ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ur) * g.radius * 1.1, Math.sin(ur) * g.radius * 1.1);
			ctx.strokeStyle = '#1f7a67'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
		}
		if (this.doorImageAngle !== null && !Number.isNaN(this.doorImageAngle)) {
			const dr = ((this.doorImageAngle - 90) * Math.PI) / 180;
			ctx.save(); ctx.translate(g.cx, g.cy);
			ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(dr) * g.radius, Math.sin(dr) * g.radius);
			ctx.strokeStyle = 'rgba(216,79,79,0.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
		}
	}

	// 八卦阳宅盘：8 卦各 45° 铺满 + 成員房间高亮 + 卦名。skinMode=true 时只画高亮（皮肤已是底图）。
	drawBaguaDisk(ctx, sf, off, skinMode = false) {
		const g = this.getDiskGeom(sf, off);
		if (!g) return;
		const { cx, cy, radius, diskRotation } = g;
		const roomRoles = {};
		this.buildBaguaAnalysis().members.forEach((r) => { if (r.roomGua) { (roomRoles[r.roomGua] = roomRoles[r.roomGua] || []).push(r.role); } });
		const guaOf = (sector) => { const m = sector.name.match(/\((.)\)/); return m ? GUA_8.find((x) => x.gua === m[1]) : null; };
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate((diskRotation * Math.PI) / 180);
		SECTORS.forEach((sector) => {
			const gua = guaOf(sector);
			const sr = ((sector.start - 90) * Math.PI) / 180;
			const er = ((sector.end - 90) * Math.PI) / 180;
			if (!skinMode) {
				ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, sr, er);
				ctx.globalAlpha = Math.max(0.04, Math.min(0.4, this.globalAlpha * 0.4));
				ctx.fillStyle = gua && gua.sex === 'M' ? 'rgb(180,140,70)' : 'rgb(50,120,140)';
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sr) * radius, Math.sin(sr) * radius);
				ctx.strokeStyle = 'rgba(120,120,120,0.5)'; ctx.lineWidth = 1; ctx.stroke();
			}
			if (gua && roomRoles[gua.gua]) {
				ctx.beginPath(); ctx.arc(0, 0, radius, sr, er); ctx.strokeStyle = '#c0883a'; ctx.lineWidth = 3; ctx.stroke();
			}
		});
		ctx.globalAlpha = 1;
		SECTORS.forEach((sector) => {
			const gua = guaOf(sector);
			if (!gua) return;
			let mid = (sector.start + sector.end) / 2;
			if (sector.start > sector.end) mid = (sector.start + sector.end + 360) / 2;
			if (mid >= 360) mid -= 360;
			const mr = ((mid - 90) * Math.PI) / 180;
			const tr = radius * 0.66;
			ctx.save();
			ctx.translate(Math.cos(mr) * tr, Math.sin(mr) * tr);
			ctx.rotate((-diskRotation * Math.PI) / 180);
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			if (!skinMode) {
				ctx.fillStyle = 'rgba(40,40,40,0.92)'; ctx.font = `bold ${radius * 0.08}px "PingFang SC"`;
				ctx.fillText(`${gua.gua}·${gua.family}`, 0, -radius * 0.04);
			}
			const roles = roomRoles[gua.gua];
			if (roles && roles.length) { ctx.fillStyle = '#c0883a'; ctx.font = `bold ${radius * 0.075}px "PingFang SC"`; ctx.fillText(roles.join('·'), 0, radius * 0.07); }
			ctx.restore();
		});
		ctx.restore();
		this.drawDoorLines(ctx, sf, off);
	}

	drawRotatedRect(ctx, sf, off) {
		const center = this.getRectCenter();
		ctx.save();
		ctx.translate(center.x * sf + off.x, center.y * sf + off.y);
		ctx.rotate((this.rect.rotation * Math.PI) / 180);
		const sw = this.rect.w * sf;
		const sh = this.rect.h * sf;
		ctx.strokeStyle = '#1f7a67';
		ctx.lineWidth = 2;
		ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
		ctx.beginPath();
		ctx.strokeStyle = 'rgba(31, 122, 103, 0.4)';
		ctx.lineWidth = 1;
		ctx.moveTo(-sw / 2, -sh / 2);
		ctx.lineTo(sw / 2, sh / 2);
		ctx.moveTo(sw / 2, -sh / 2);
		ctx.lineTo(-sw / 2, sh / 2);
		ctx.stroke();
		if (this.rect.active && this.mode !== 'drawRect') {
			const hs = 6;
			ctx.fillStyle = '#fff';
			ctx.strokeStyle = '#333';
			ctx.lineWidth = 1;
			[
				{ x: -sw / 2, y: -sh / 2 }, { x: sw / 2, y: -sh / 2 },
				{ x: sw / 2, y: sh / 2 }, { x: -sw / 2, y: sh / 2 },
			].forEach((p) => {
				ctx.beginPath();
				ctx.arc(p.x, p.y, hs, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			});
		}
		ctx.restore();
		ctx.beginPath();
		ctx.arc(center.x * sf + off.x, center.y * sf + off.y, 4, 0, Math.PI * 2);
		ctx.fillStyle = '#c34f3a';
		ctx.fill();
	}

	drawNaQiDisk(ctx, sf, off) {
		const center = this.getDiskCenter();
		if (!center) return;
		const cx = center.x * sf + off.x;
		const cy = center.y * sf + off.y;
		const radius = this.getMaxDiskRadius(center) * this.diskScale * sf;
		if (radius <= 0) return;
		const diskRotation = this.getDiskRotation();
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate((diskRotation * Math.PI) / 180);
		ctx.globalAlpha = this.globalAlpha;
		SECTORS.forEach((sector) => {
			const sr = ((sector.start - 90) * Math.PI) / 180;
			const er = ((sector.end - 90) * Math.PI) / 180;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, radius, sr, er);
			ctx.fillStyle = this.isWindSector(sector.num) ? WIND_COLOR : WATER_COLOR;
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(sr) * radius, Math.sin(sr) * radius);
			ctx.strokeStyle = '#111';
			ctx.lineWidth = 1.4;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(er) * radius, Math.sin(er) * radius);
			ctx.stroke();
		});
		ctx.globalAlpha = 1;
		SECTORS.forEach((sector) => {
			let mid = (sector.start + sector.end) / 2;
			if (sector.start > sector.end) mid = (sector.start + sector.end + 360) / 2;
			if (mid >= 360) mid -= 360;
			const mr = ((mid - 90) * Math.PI) / 180;
			const tr = radius * 0.7;
			ctx.save();
			ctx.translate(Math.cos(mr) * tr, Math.sin(mr) * tr);
			ctx.rotate((-diskRotation * Math.PI) / 180);
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#fff';
			ctx.font = `bold ${radius * 0.18}px "Avenir Next"`;
			ctx.shadowColor = 'rgba(0,0,0,0.45)';
			ctx.shadowBlur = 4;
			ctx.fillText(sector.num, 0, -radius * 0.08);
			ctx.font = `bold ${radius * 0.11}px "PingFang SC"`;
			ctx.fillText(sector.name, 0, radius * 0.12);
			ctx.restore();
		});
		if (this.unitAzimuth !== null && !Number.isNaN(this.unitAzimuth)) {
			const ur = ((this.unitAzimuth - 90) * Math.PI) / 180;
			const al = radius * 1.15;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(ur) * al, Math.sin(ur) * al);
			ctx.strokeStyle = '#1f7a67';
			ctx.lineWidth = 3;
			ctx.shadowColor = 'rgba(0,0,0,0.4)';
			ctx.shadowBlur = 2;
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.save();
			ctx.translate(Math.cos(ur) * al, Math.sin(ur) * al);
			ctx.rotate(ur);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(-10, -6);
			ctx.lineTo(-10, 6);
			ctx.closePath();
			ctx.fillStyle = '#1f7a67';
			ctx.fill();
			ctx.restore();
			ctx.save();
			ctx.translate(Math.cos(ur) * al, Math.sin(ur) * al);
			ctx.rotate((-diskRotation * Math.PI) / 180);
			ctx.fillStyle = '#1f7a67';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(`单元门 ${Math.round(this.unitAzimuth)}°`, 0, -14);
			ctx.restore();
		}
		ctx.restore();
		if (this.doorImageAngle !== null && !Number.isNaN(this.doorImageAngle)) {
			const dr = ((this.doorImageAngle - 90) * Math.PI) / 180;
			ctx.save();
			ctx.translate(cx, cy);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(dr) * radius, Math.sin(dr) * radius);
			ctx.strokeStyle = 'rgba(216, 79, 79, 0.7)';
			ctx.setLineDash([4, 4]);
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();
		}
	}

	drawMarkers(ctx, sf, off, visualScale = 1) {
		// visualScale：标记圆点/字号/描边的「视觉尺寸」缩放。屏上恒为 1(常量像素);
		// 导出走图片原生分辨率(sf=1、坐标即图片 px),3000px 级户型照若仍用 7px 圆点
		// 和 11px 字会小到不可见 → 由调用方按比例放大。
		const vs = Math.max(1, visualScale || 1);
		this.currentModeMarkers().forEach((marker) => {
			const x = marker.x * sf + off.x;
			const y = marker.y * sf + off.y;
			const selected = marker.id === this.selectedMarkerId;
			const radius = (selected ? 9 : 7) * vs;
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fillStyle = marker.color;
			ctx.fill();
			if ((marker.mode || 'naqi') === 'bagua') {
				ctx.strokeStyle = selected ? '#c0883a' : '#fff';
				ctx.lineWidth = 2 * vs; ctx.stroke();
				// 圈下方写角色/格局名（柔光衬底 + 深字，覆于户型图上清晰，无硬描边）
				const cap = marker.kind === 'member' ? marker.role : marker.label;
				ctx.font = 'bold ' + Math.round(11 * vs) + 'px "PingFang SC"';
				ctx.textAlign = 'center'; ctx.textBaseline = 'top';
				ctx.save();
				ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 4 * vs;
				ctx.fillStyle = '#2a2018';
				ctx.fillText(cap, x, y + radius + 2 * vs);
				ctx.fillText(cap, x, y + radius + 2 * vs);
				ctx.restore();
			} else {
				const ev = this.evaluateMarker(marker);
				ctx.strokeStyle = !ev.ok && ev.expected !== 'neutral' ? '#b14032' : '#fff';
				ctx.lineWidth = 2 * vs; ctx.stroke();
				ctx.fillStyle = '#fff';
				ctx.font = 'bold ' + Math.round(11 * vs) + 'px sans-serif';
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.fillText(marker.short, x, y + 0.5 * vs);
			}
		});
	}

	// ── 判定 ───────────────────────────────────────────────────
	getSectorForPoint(marker) {
		const center = this.getDiskCenter();
		if (!center) return null;
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
	}

	evaluateMarker(marker) {
		const sector = this.getSectorForPoint(marker);
		if (!sector) return { sector: null, expected: marker.category, actual: null, ok: marker.category === 'neutral' };
		const actual = this.isWindSector(sector.num) ? 'wind' : 'water';
		const ok = marker.category === 'neutral' || marker.category === actual;
		return { sector, expected: marker.category, actual, ok };
	}

	// ── 快照（AI 分析挂载文本）──────────────────────────────────
	buildAiSnapshotText() {
		if (this.techMode === 'bagua') return this.buildBaguaSnapshotText();
		return this.buildNaqiSnapshotText();
	}

	buildNaqiSnapshotText() {
		const periodLabel = this.periodMode === 'current' ? '1964-2044' : '2044-2124';
		const headerLines = [
			`生成时间：${new Date().toLocaleString()}`,
			`单元门角度：${formatAngle(this.unitAzimuth)}   入户门角度：${formatAngle(this.doorImageAngle)}   盘旋转：${formatAngle(this.getDiskRotation())}   运期：${periodLabel}`,
		];
		const details = this.markers.map((m) => {
			const ev = this.evaluateMarker(m);
			const position = ev.sector ? `${ev.sector.num}·${ev.sector.name}·${ev.actual === 'wind' ? '气位' : '水位'}` : '未定位';
			return { marker: m, ev, position };
		});
		const markerLines = this.markers.length
			? ['| 序 | 标记 | 位置 | 状态 |', '| --- | --- | --- | --- |',
				...details.map((d, i) => {
					const st = d.marker.category === 'neutral' ? '观察' : d.ev.ok ? '位置合适' : '位置冲突';
					return `| ${i + 1}. | ${d.marker.label} | ${d.position} | ${st} |`;
				})]
			: ['暂无标记'];
		const conflictLines = details.filter((d) => d.marker.category !== 'neutral' && d.ev.sector && !d.ev.ok)
			.map((d) => `${d.marker.label}：${d.position}（期望 ${d.ev.expected === 'wind' ? '气位' : '水位'}）`);
		const unknownLines = details.filter((d) => !d.ev.sector).map((d) => `${d.marker.label}：未定位`);
		const stats = { windOk: 0, waterOk: 0, windBad: 0, waterBad: 0, unknown: 0 };
		details.forEach((d) => {
			if (!d.ev.sector) stats.unknown += 1;
			else if (d.marker.category === 'wind') d.ev.ok ? (stats.windOk += 1) : (stats.windBad += 1);
			else if (d.marker.category === 'water') d.ev.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
		});
		const statsLine = `气位正确 ${stats.windOk} 项，气位冲突 ${stats.windBad} 项；水位正确 ${stats.waterOk} 项，水位冲突 ${stats.waterBad} 项；未定位 ${stats.unknown} 项。`;
		const suggestionLines = [];
		if (!this.markers.length) suggestionLines.push('当前没有标注，可先放置门、窗、床、灶、沙发等关键点。');
		else {
			if (stats.windBad > 0) suggestionLines.push('存在气位冲突，建议将气位类标注调整到气位扇区。');
			if (stats.waterBad > 0) suggestionLines.push('存在水位冲突，建议将水位类标注调整到水位扇区。');
			if (stats.unknown > 0) suggestionLines.push('有未定位标注，请确认盘心、房屋框或角度输入。');
			if (stats.windBad === 0 && stats.waterBad === 0 && stats.unknown === 0) suggestionLines.push('当前标注均在合适位置，可继续完善细节。');
		}
		const out = [];
		const push = (title, rows) => { out.push(`[${title}]`); (rows || []).forEach((l) => out.push(`${l}`)); out.push(''); };
		push('起盘信息', headerLines);
		push('标记判定', [statsLine, ...markerLines]);
		push('冲突清单', conflictLines.length ? conflictLines : ['暂无冲突标记']);
		if (unknownLines.length) push('未定位标注', unknownLines);
		const na = this.buildNaqiAnalysis();
		const harmRows = na.markers.filter((x) => x.harm).map((x) => `| ${x.label} | ${(x.sector && x.sector.name) || '—'} | ${x.harm.label} | ${x.harm.affect} |`);
		na.houseHarms.forEach((h) => harmRows.push(`| ${h.label} | — | — | ${h.affect} |`));
		if (harmRows.length) push('破局危害', ['| 标记 | 方位 | 危害 | 影响 |', '| --- | --- | --- | --- |', ...harmRows]);
		if (na.dragonTiger) push('龙虎灶台', [`${na.dragonTiger.pattern}·${na.dragonTiger.text}`]);
		else if (na.dragonTigerHint) push('龙虎灶台', [na.dragonTigerHint]);
		if (na.probe) push('移动盘', [`${na.probe.centerLabel}为太极：${na.probe.items.map((i) => `${i.label}在${i.sectorName}${i.windOrWater ? (i.windOrWater === 'wind' ? '·气位' : '·水位') : ''}`).join('；')}`]);
		push('吉凶评分', [`综合 ${na.score} 分（${na.grade}）`]);
		if (na.remedies.length) push('缓解建议', na.remedies.flatMap((r) => r.items));
		push('使用要点', TIPS);
		push('建议汇总', suggestionLines);
		push('纳气建议', [ADVICE]);
		while (out.length && !out[out.length - 1]) out.pop();
		return out.join('\n');
	}

	buildBaguaSnapshotText() {
		const skinLabel = (DISK_SKINS.find((s) => s.key === this.diskSkin) || {}).label || '绘制盘';
		const out = [];
		const push = (title, rows) => { out.push(`[${title}]`); (rows || []).forEach((l) => out.push(`${l}`)); out.push(''); };
		push('起盘信息', [
			`生成时间：${new Date().toLocaleString()}`,
			`单元门角度：${formatAngle(this.unitAzimuth)}   入户门角度：${formatAngle(this.doorImageAngle)}   盘旋转：${formatAngle(this.getDiskRotation())}   盘面样式：${skinLabel}`,
		]);
		push('八卦定位', [`正北角度：${formatAngle(this.baguaOrient)}`, ...GUA_8.map((g) => `${g.dir}${g.gua}（${g.family}）`)]);
		const an = this.buildBaguaAnalysis();
		const memberRows = an.members.length ? an.members.map((m) => {
			if (!m.roomGua) return `${m.role}（${m.benmingGua}）：标记未落在盘内`;
			if (!m.hex) return `${m.role}（${m.benmingGua}）·居${m.roomDir}：方位有误`;
			const sx = m.shenxing && m.shenxing.same ? '（名位相同·家和万事兴）' : '';
			return `${m.role}·居${m.roomDir}·${m.hex.name}${sx}：${m.text ? m.text.xiang : ''}`;
		}) : ['暂无成員，请在户型图上放置成員标记'];
		push('成員卦象', memberRows);
		const featureRows = an.features.map((f) => (f.judge ? f.judge.text : `${f.label}：标记未落在盘内`));
		if (featureRows.length) push('四类象格局', featureRows);
		const timingRows = an.members.filter((m) => m.hex && m.timing).map((m) => {
			const base = `${m.timing.window}${m.timing.accelerated ? '·偏快' : m.timing.slowed ? '·偏缓' : ''}`;
			const rk = m.rankShift && m.rankShift.dir !== '平' ? `，排位${m.rankShift.dir}约 ${m.rankShift.years} 年` : '';
			return `${m.role}·${m.hex.name}：${base}${rk}`;
		});
		if (timingRows.length) push('应期成格', timingRows);
		const adviceRows = an.members.filter((m) => m.text).map((m) => `${m.role}·${m.hex.name}：${m.text.advice}`);
		if (adviceRows.length) push('改运建议', adviceRows);
		while (out.length && !out[out.length - 1]) out.pop();
		return out.join('\n');
	}

	// ── 导出 ───────────────────────────────────────────────────
	renderCompositeCanvas() {
		if (!this.imgLoaded) return null;
		const ex = document.createElement('canvas');
		ex.width = this.img.width;
		ex.height = this.img.height;
		const ectx = ex.getContext('2d');
		ectx.drawImage(this.img, 0, 0);
		if (this.rect.w !== 0 && this.rect.h !== 0) this.drawRotatedRect(ectx, 1, { x: 0, y: 0 });
		if (this.rect.active) this.drawDisk(ectx, 1, { x: 0, y: 0 });
		// 标记视觉尺寸按「图片 px / 屏幕逻辑 px」放大,使导出图上看到的圆点/字号与屏上一致
		this.drawMarkers(ectx, 1, { x: 0, y: 0 }, 1 / Math.max(0.0001, this.getCombinedScale()));
		return ex;
	}

	// 稳健下载：anchor 必须挂到 DOM 才能在 webview/壳内可靠触发（脱离 DOM 的 click 常被拦）。
	downloadDataUrl(filename, dataUrl) {
		const link = document.createElement('a');
		link.download = filename;
		link.href = dataUrl;
		link.rel = 'noopener';
		document.body.appendChild(link);
		link.click();
		setTimeout(() => { try { document.body.removeChild(link); } catch (e) { /* noop */ } }, 0);
	}

	exportPng() {
		const ex = this.renderCompositeCanvas();
		if (!ex) return;
		const name = this.techMode === 'bagua' ? '八卦阳宅-盘面.png' : '纳气盘-盘面.png';
		this.downloadDataUrl(name, ex.toDataURL('image/png'));
	}

	// 报告分区（按模式产出 {title, accent, lines:[{text,tone}]}）。tone: normal/good/bad/muted。
	reportSections() {
		const L = (arr) => arr.map((x) => (typeof x === 'string' ? { text: x, tone: 'normal' } : x));
		if (this.techMode === 'bagua') {
			const an = this.buildBaguaAnalysis();
			const secs = [];
			secs.push({ title: '起盘信息', accent: '#b88a3e', lines: L([`正北方向 ${formatAngle(this.baguaOrient)}　盘旋转 ${formatAngle(this.getDiskRotation())}　盘心＝房屋正中（太极点）`]) });
			const ml = [];
			if (!an.members.length) ml.push({ text: '暂无成員，请在户型图上放置成員标记。', tone: 'muted' });
			an.members.forEach((m) => {
				if (!m.roomGua || !m.hex) { ml.push({ text: `${m.role}（${m.benmingGua}）：标记未落在盘内`, tone: 'muted' }); return; }
				const tag = (m.meta && m.meta.tag) || 'neutral';
				const tone = tag === 'caution' ? 'bad' : tag === 'auspicious' ? 'good' : 'normal';
				const rk = m.rankShift && m.rankShift.dir !== '平' ? `　${m.rankShift.dir} ${m.rankShift.years} 年` : '';
				const sx = m.shenxing && m.shenxing.same ? '　名位相同·家和' : '';
				ml.push({ text: `${m.role} · 居${m.roomDir} · ${m.hex.name}（应期 ${m.timing ? m.timing.window : ''}${rk}${sx}）`, tone });
				if (m.text && m.text.xiang) ml.push({ text: `　${m.text.xiang}`, tone: 'muted' });
			});
			secs.push({ title: '成員卦象', accent: '#1497a8', lines: ml });
			if (an.features.length) {
				secs.push({ title: '四类象格局', accent: '#cf1322', lines: an.features.map((f) => ({
					text: f.judge ? f.judge.text : `${f.label}：标记未落在盘内`,
					tone: f.judge && f.judge.tag === 'caution' ? 'bad' : f.judge && f.judge.tag === 'auspicious' ? 'good' : 'normal',
				})) });
			}
			const adv = an.members.filter((m) => m.text).map((m) => `${m.role} · ${m.hex ? m.hex.name : ''}：${m.text.advice}`);
			if (adv.length) secs.push({ title: '改运建议', accent: '#b88a3e', lines: L(adv) });
			return { title: '八卦阳宅判定报告', sections: secs };
		}
		const na = this.buildNaqiAnalysis();
		const period = this.periodMode === 'current' ? '1964-2044' : '2044-2124';
		const gradeColor = na.grade === '吉' ? '#b88a3e' : na.grade === '平' ? '#1497a8' : '#cf1322';
		const w = na.markers.filter((m) => m.category === 'wind');
		const wa = na.markers.filter((m) => m.category === 'water' && !m.kitchen);
		const summary = `气位 ${w.filter((m) => m.ok && m.sector).length}/${w.length} 合适，水位 ${wa.filter((m) => m.ok && m.sector).length}/${wa.length} 合适。`;
		const secs = [];
		secs.push({ title: '起盘信息', accent: '#b88a3e', lines: L([`单元门 ${formatAngle(this.unitAzimuth)}　入户门 ${formatAngle(this.doorImageAngle)}　盘旋转 ${formatAngle(this.getDiskRotation())}　运期 ${period}`]) });
		secs.push({ title: `吉凶评分 ${na.score} 分（${na.grade}）`, accent: gradeColor, lines: L([summary]) });
		const mkLines = na.markers.length ? na.markers.map((m) => ({
			text: `${m.label}：${m.sector ? `${m.sector.name} · ${m.actual === 'wind' ? '气位' : '水位'}` : '未定位'}（${m.category === 'neutral' ? '观察' : m.kitchen ? '厨房' : m.ok ? '位置合适' : '位置冲突'}）`,
			tone: m.category === 'neutral' ? 'muted' : (m.ok || m.kitchen) ? 'good' : m.sector ? 'bad' : 'muted',
		})) : [{ text: '暂无标记', tone: 'muted' }];
		secs.push({ title: '标记判定', accent: '#1497a8', lines: mkLines });
		const harmL = na.markers.filter((m) => m.harm).map((m) => ({ text: `${m.label}：${m.harm.affect}`, tone: 'bad' }));
		(na.houseHarms || []).forEach((h) => harmL.push({ text: `${h.label}：${h.affect}`, tone: 'bad' }));
		if (harmL.length) secs.push({ title: '破局危害', accent: '#cf1322', lines: harmL });
		if (na.dragonTiger) secs.push({ title: '龙虎灶台', accent: '#b88a3e', lines: L([`${na.dragonTiger.pattern}：${na.dragonTiger.text}`]) });
		const rem = (na.remedies || []).flatMap((r) => r.items);
		if (rem.length) secs.push({ title: '缓解建议', accent: '#1497a8', lines: L(rem) });
		return { title: '纳气盘判定报告', sections: secs };
	}

	buildReportCanvas() {
		const composite = this.renderCompositeCanvas();
		if (!composite) return null;
		const { title, sections } = this.reportSections();
		const W = 1080;
		const PAD = 40;
		const GAP = 12;
		const LH = 23;
		const HEADER = 78;
		const FOOTER = 46;
		const contentW = W - PAD * 2;
		const innerW = contentW - 36;
		const scaleImg = Math.min(1, contentW / composite.width);
		const imgW = Math.round(composite.width * scaleImg);
		const imgH = Math.round(composite.height * scaleImg);
		const imgX = Math.round((W - imgW) / 2);
		const wrap = (ctx, text, maxWidth) => {
			const chars = `${text}`.split('');
			const out = [];
			let line = '';
			chars.forEach((ch) => { const t = line + ch; if (ctx.measureText(t).width > maxWidth && line) { out.push(line); line = ch; } else line = t; });
			if (line) out.push(line);
			return out;
		};
		const round = (ctx, x, y, ww, hh, r) => {
			ctx.beginPath();
			ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
			ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
		};
		const measure = document.createElement('canvas').getContext('2d');
		measure.font = '14px "PingFang SC", sans-serif';
		const blocks = sections.map((sec) => {
			const wl = [];
			sec.lines.forEach((ln) => { wrap(measure, ln.text, innerW).forEach((row) => wl.push({ text: row, tone: ln.tone })); });
			return { ...sec, wl, h: 30 + wl.length * LH + 16 };
		});
		const bodyH = blocks.reduce((s, b) => s + b.h + GAP, 0);
		const H = HEADER + PAD + imgH + PAD + bodyH + FOOTER;
		const cv = document.createElement('canvas');
		cv.width = W; cv.height = H;
		const c = cv.getContext('2d');
		c.fillStyle = '#faf7f0'; c.fillRect(0, 0, W, H);
		c.fillStyle = '#b88a3e'; c.fillRect(0, 0, W, HEADER);
		c.fillStyle = '#fffaf0'; c.font = 'bold 26px "PingFang SC", sans-serif';
		c.fillText(title, PAD, 42);
		c.fillStyle = 'rgba(255,250,240,0.86)'; c.font = '13px "PingFang SC", sans-serif';
		const skinLabel = (DISK_SKINS.find((s) => s.key === this.diskSkin) || {}).label || '绘制盘';
		c.fillText(`星阙 · 风水　|　生成 ${new Date().toLocaleString()}　|　盘面 ${skinLabel}`, PAD, 64);
		let y = HEADER + PAD;
		c.save();
		c.shadowColor = 'rgba(0,0,0,0.14)'; c.shadowBlur = 12; c.shadowOffsetY = 4;
		round(c, imgX, y, imgW, imgH, 8); c.fillStyle = '#fff'; c.fill();
		c.restore();
		c.drawImage(composite, 0, 0, composite.width, composite.height, imgX, y, imgW, imgH);
		round(c, imgX, y, imgW, imgH, 8); c.strokeStyle = 'rgba(0,0,0,0.14)'; c.lineWidth = 1; c.stroke();
		y += imgH + PAD;
		blocks.forEach((b) => {
			round(c, PAD, y, contentW, b.h, 10); c.fillStyle = '#ffffff'; c.fill();
			c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1; c.stroke();
			c.fillStyle = b.accent || '#b88a3e'; round(c, PAD, y, 4, b.h, 2); c.fill();
			c.fillStyle = '#1b1812'; c.font = 'bold 16px "PingFang SC", sans-serif';
			c.fillText(b.title, PAD + 18, y + 26);
			let ty = y + 50;
			c.font = '14px "PingFang SC", sans-serif';
			b.wl.forEach((ln) => {
				c.fillStyle = ln.tone === 'bad' ? '#cf1322' : ln.tone === 'good' ? '#0f8a78' : ln.tone === 'muted' ? '#8a8276' : '#3a342a';
				c.fillText(ln.text, PAD + 18, ty); ty += LH;
			});
			y += b.h + GAP;
		});
		c.fillStyle = '#8a8276'; c.font = '12px "PingFang SC", sans-serif';
		c.fillText('本报告为方位之参考，吉凶需合命盘综合参看。', PAD, y + 22);
		return cv;
	}

	exportReportPng() {
		const rc = this.buildReportCanvas();
		if (!rc) return;
		const name = this.techMode === 'bagua' ? '八卦阳宅-判定报告.png' : '纳气盘-判定报告.png';
		this.downloadDataUrl(name, rc.toDataURL('image/png'));
	}

	exportReportPdf() {
		const rc = this.buildReportCanvas();
		if (!rc) return;
		const dataUrl = rc.toDataURL('image/png');
		const reportTitle = this.techMode === 'bagua' ? '八卦阳宅判定报告' : '纳气盘判定报告';
		const win = window.open('', '_blank');
		if (!win) return;
		win.document.write([
			`<!doctype html><html><head><title>${reportTitle}</title>`,
			'<style>body{margin:0;padding:24px;font-family:"PingFang SC",sans-serif;background:#fff;}img{width:100%;max-width:100%;}</style>',
			'</head><body>',
			`<img src="${dataUrl}" />`,
			'<scr' + 'ipt>window.onload=function(){window.print();};</scr' + 'ipt>',
			'</body></html>',
		].join(''));
		win.document.close();
	}

	// ── 控件动作（React 调用）──────────────────────────────────
	loadImageFile(file) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			this.img = new Image();
			this.img.onload = () => {
				this.imgLoaded = true;
				this.viewScale = 1;
				this.resize();
				this.startDrawRect();
				this.setStatus('图片已加载，已进入手动框选模式。');
				this.initHistory();
				this.emit();
			};
			this.img.src = event.target.result;
		};
		reader.readAsDataURL(file);
	}

	startDrawRect() {
		if (!this.imgLoaded) return;
		this.mode = 'drawRect';
		this.canvas.style.cursor = 'crosshair';
		this.rect.active = false;
		this.rect.rotation = 0;
		this.setStatus('模式：绘制矩形。在图上拖动完成框选。');
		this.emit();
	}

	startDrawDoor() {
		if (!this.imgLoaded) return;
		this.mode = 'drawDoorLine';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：绘制门向。请从门内向门外画一条线。');
		this.emit();
	}

	startPlaceMarker() {
		if (!this.imgLoaded) return;
		this.mode = 'placeMarker';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：放置标记。点击画布位置放置。');
		this.emit();
	}

	resetRect() {
		this.rect = { x: 0, y: 0, w: 0, h: 0, rotation: 0, active: false };
		this.setStatus('已重置房屋框。');
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	clearMarkers() {
		this.markers = this.markers.filter((m) => (m.mode || 'naqi') !== this.techMode);
		this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	deleteMarker(id) {
		this.markers = this.markers.filter((m) => m.id !== id);
		if (this.selectedMarkerId === id) this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	selectMarker(id) {
		this.selectedMarkerId = id;
		this.drawAll();
		this.emit();
	}

	setFilter(f) { this.currentFilter = f; this.emit(); }
	setMarkerType(id) { this.markerType = id; this.emit(); }

	setUnitAngle(v) {
		this.unitAzimuth = v === '' || v === null ? null : parseFloat(v);
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	}

	setDoorAngle(v) {
		this.doorImageAngle = v === '' || v === null ? null : parseFloat(v);
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	}

	setOpacity(v) { this.globalAlpha = parseFloat(v); this.drawAll(); this.scheduleHistoryPush(); this.emit(); }
	setDiskScale(v) { this.diskScale = Math.max(1, parseFloat(v)); this.drawAll(); this.scheduleHistoryPush(); this.emit(); }
	setRectRotation(v) { this.rect.rotation = parseFloat(v) || 0; this.drawAll(); this.scheduleHistoryPush(); this.emit(); }

	setDiskCenterMode(m) {
		this.diskCenterMode = m;
		if (m === 'custom') this.setStatus('自定义盘心：按住 Shift 在画布点击设定。');
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	setPeriodMode(m) { this.periodMode = m; this.drawAll(); this.pushHistory(); this.emit(); }

	// ── 模式 / 罗盘皮肤 / 灶口朝向 / 成員（P0 骨架 + 八卦）─────────
	setTechMode(m) {
		if (m !== 'naqi' && m !== 'bagua') return;
		this.techMode = m;
		this.markerType = (m === 'bagua' ? BAGUA_MARKER_TYPES : MARKER_TYPES)[0].id;
		if (this.mode === 'placeMarker' || this.mode === 'drawStoveFacing' || this.mode === 'drawBaguaNorth') { this.mode = 'none'; this.canvas.style.cursor = 'default'; }
		this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	setDiskSkin(key) {
		this.diskSkin = key;
		const skin = DISK_SKINS.find((s) => s.key === key);
		if (skin && skin.src && !this.skinImages[skin.src]) {
			const img = new Image();
			img.onload = () => { this.drawAll(); this.emit(); };
			img.src = skin.src;
			this.skinImages[skin.src] = img;
		}
		this.drawAll();
		this.emit();
	}

	getSkinImage() {
		const skin = DISK_SKINS.find((s) => s.key === this.diskSkin);
		if (!skin || !skin.src) return null;
		const img = this.skinImages[skin.src];
		return img && img.complete && img.naturalWidth ? { img, skin } : null;
	}

	startStoveFacing(markerId) {
		if (!this.imgLoaded) return;
		const m = this.markers.find((x) => x.id === markerId && x.type === 'stove');
		if (!m) return;
		this.facingMarkerId = markerId;
		this.selectedMarkerId = markerId;
		this.mode = 'drawStoveFacing';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：标灶口朝向。从灶台向下厨者面对的方向画一条线。');
		this.emit();
	}

	// 八卦阳宅：单一「正北方向(度)」。
	setBaguaOrient(v) {
		this.baguaOrient = v === '' || v === null || v === undefined ? null : parseFloat(v);
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	}

	startBaguaNorth() {
		if (!this.imgLoaded) return;
		this.mode = 'drawBaguaNorth';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：画正北方向。从盘心向正北画一条线。');
		this.emit();
	}

	// ── 纳气盘法分析（破局危害 / 双卫 / 龙虎 / 评分 / 移动盘）─────
	buildNaqiAnalysis() {
		const naqiMarkers = this.currentModeMarkers();
		const evals = naqiMarkers.map((m) => ({ m, ev: this.evaluateMarker(m) }));
		const stoves = evals.filter((e) => e.m.type === 'stove' && e.ev.sector);
		evals.forEach((e) => {
			e.kitchen = e.m.type === 'sink' && !!e.ev.sector && stoves.some((s) => sectorAdjacent(s.ev.sector.num, e.ev.sector.num));
		});
		const markers = evals.map((e) => {
			const broken = e.m.category !== 'neutral' && e.ev.sector && !e.ev.ok && !e.kitchen;
			const harm = broken ? harmForMarker(e.m.category, e.ev.actual, e.ev.sector.num) : null;
			return {
				id: e.m.id, label: e.m.label, short: e.m.short, type: e.m.type, category: e.m.category, color: e.m.color,
				sector: e.ev.sector ? { num: e.ev.sector.num, name: e.ev.sector.name } : null,
				actual: e.ev.actual, ok: e.ev.ok, kitchen: !!e.kitchen, harm,
				facingAngle: (e.m.facingAngle === null || e.m.facingAngle === undefined) ? null : e.m.facingAngle,
			};
		});
		const harms = markers.filter((x) => x.harm).map((x) => x.harm);
		const bathInWind = evals.filter((e) => (e.m.type === 'bathroom' || e.m.type === 'toilet') && e.ev.sector && e.ev.actual === 'wind').length;
		const houseHarms = [];
		if (bathInWind >= 2) { houseHarms.push(HARM_MAP['double-bath']); harms.push(HARM_MAP['double-bath']); }
		let dragonTiger = null;
		let dragonTigerHint = null;
		const stove = naqiMarkers.find((m) => m.type === 'stove');
		if (stove) {
			const kitchen = evals.find((e) => e.kitchen);
			if (stove.facingAngle === null || stove.facingAngle === undefined) dragonTigerHint = '请先标灶口朝向（点灶台“画灶口朝向”）';
			else if (!kitchen) dragonTigerHint = '请在厨房放置水槽（与灶台同/邻扇区）';
			else dragonTiger = evalDragonTiger(stove, kitchen.m, stove.facingAngle);
		}
		const windOk = markers.filter((x) => x.category === 'wind' && x.ok && x.sector).length;
		const waterOk = markers.filter((x) => x.category === 'water' && x.ok && x.sector && !x.kitchen).length;
		const score = scoreNaqi({ windOk, waterOk, harms, dragonTiger });
		const grade = gradeOf(score);
		const dtRemedy = dragonTiger && dragonTiger.remedyKey ? [dragonTiger.remedyKey] : [];
		const remedyKeys = Array.from(new Set([...harms.map((h) => h && h.remedyKey), ...dtRemedy].filter(Boolean)));
		const remedies = remedyKeys.map((k) => ({ key: k, items: REMEDY_LIB[k] || [] }));
		return { markers, harms, houseHarms, dragonTiger, dragonTigerHint, score, grade, remedies, probe: this.buildProbe() };
	}

	buildProbe() {
		if (this.diskCenterMode !== 'marker') return null;
		const naqiMarkers = this.currentModeMarkers();
		const center = naqiMarkers.find((m) => m.id === this.selectedMarkerId);
		if (!center || !['bed', 'desk', 'sofa'].includes(center.type)) return null;
		const items = naqiMarkers.filter((m) => m.id !== center.id && (m.category === 'wind' || m.category === 'water')).map((m) => {
			const ev = this.evaluateMarker(m);
			return { label: m.label, sectorName: ev.sector ? ev.sector.name : '未定位', windOrWater: ev.sector ? ev.actual : null };
		});
		return { centerLabel: center.label, items };
	}

	// ── 八卦阳宅法分析（读图上 bagua 标记：成員→名上位下64卦+应期+排位+形神；格局→四类象）──
	buildBaguaAnalysis() {
		const list = this.currentModeMarkers();
		const dirOf = (gua) => (gua ? (GUA_8.find((g) => g.gua === gua) || {}).dir || '' : '');
		const sectorGuaOf = (m) => {
			const sector = this.getSectorForPoint(m);
			return { sector: sector ? { num: sector.num, name: sector.name } : null, gua: sector ? guaBySectorNum(sector.num) : null };
		};
		const members = list.filter((m) => m.kind === 'member').map((m) => {
			const { sector, gua: roomGua } = sectorGuaOf(m);
			const benmingGua = m.benmingGua;
			const hex = roomGua ? composeHexagram(benmingGua, roomGua) : null;
			return {
				id: m.id, role: m.role, benmingGua, color: m.color, sector, roomGua, roomDir: dirOf(roomGua),
				hex, text: hex ? HEXAGRAM_TEXTS[hex.no] : null, meta: hex ? HEXAGRAM_META[hex.no] : null,
				timing: hex ? computeTiming(hex, { benmingGua, roomGua }) : null,
				rankShift: roomGua ? computeRankShift(benmingGua, roomGua) : null,
				shenxing: roomGua ? namePositionRelation(benmingGua, roomGua) : null,
			};
		});
		const features = list.filter((m) => m.kind === 'feature').map((m) => {
			const { sector, gua } = sectorGuaOf(m);
			return { id: m.id, feature: m.feature, label: m.label, short: m.short, color: m.color, sector, gua, roomDir: dirOf(gua), family: gua ? GUA_TO_ROLE[gua] : '', judge: gua ? featureJudgment(m.feature, gua) : null };
		});
		return { members, features };
	}

	togglePan() {
		this.panMode = !this.panMode;
		this.canvas.style.cursor = this.panMode ? 'grab' : 'default';
		this.setStatus(this.panMode ? '拖拽模式：拖动画布移动' : '拖拽模式已关闭');
		this.emit();
	}

	toggleSnap() { this.snapEnabled = !this.snapEnabled; this.setStatus(this.snapEnabled ? '吸附对齐已开启' : '吸附对齐已关闭'); this.emit(); }

	addMarkerAt(pos) {
		const bagua = this.techMode === 'bagua';
		const pool = bagua ? BAGUA_MARKER_TYPES : MARKER_TYPES;
		const type = pool.find((t) => t.id === this.markerType) || pool[0];
		if (!type) return;
		const sp = this.snapPointToRect(pos);
		const marker = bagua
			? { id: this.markerIdSeed++, mode: 'bagua', type: type.id, label: type.label, short: type.short, kind: type.kind, role: type.role || null, benmingGua: type.benmingGua || null, feature: type.feature || null, color: type.color, x: sp.x, y: sp.y }
			: { id: this.markerIdSeed++, mode: 'naqi', type: type.id, label: type.label, short: type.short, category: type.category, color: type.color, x: sp.x, y: sp.y };
		this.markers.push(marker);
		this.selectedMarkerId = marker.id;
		this.drawAll();
		this.pushHistory();
		this.emit();
	}

	// 当前模式的标记（旧存档无 mode 视为 naqi，保后向兼容）。
	currentModeMarkers() {
		return this.markers.filter((m) => (m.mode || 'naqi') === this.techMode);
	}

	getMarkerAtPos(pos) {
		const threshold = 10;
		const c = this.getCombinedScale();
		const list = this.currentModeMarkers();
		for (let i = list.length - 1; i >= 0; i -= 1) {
			const m = list[i];
			const dx = m.x * c + this.viewOffset.x - pos.x;
			const dy = m.y * c + this.viewOffset.y - pos.y;
			if (Math.hypot(dx, dy) <= threshold) return m;
		}
		return null;
	}

	updateCursorStyle(pos) {
		if (this.panMode) { this.canvas.style.cursor = 'grab'; return; }
		if (!this.rect.active) { this.canvas.style.cursor = 'default'; return; }
		if (this.getMarkerAtPos(pos)) { this.canvas.style.cursor = 'grab'; return; }
		const imgPos = this.screenToImage(pos);
		const center = this.getRectCenter();
		const local = rotatePoint(imgPos, center, -this.rect.rotation);
		const hw = this.rect.w / 2;
		const hh = this.rect.h / 2;
		const dx = local.x - center.x;
		const dy = local.y - center.y;
		const hs = 8 / this.getCombinedScale() + 5;
		if ((Math.abs(dx + hw) < hs && Math.abs(dy + hh) < hs) || (Math.abs(dx - hw) < hs && Math.abs(dy - hh) < hs)) this.canvas.style.cursor = 'nwse-resize';
		else if ((Math.abs(dx - hw) < hs && Math.abs(dy + hh) < hs) || (Math.abs(dx + hw) < hs && Math.abs(dy - hh) < hs)) this.canvas.style.cursor = 'nesw-resize';
		else if (Math.abs(dx) < hw && Math.abs(dy) < hh) this.canvas.style.cursor = 'move';
		else this.canvas.style.cursor = 'default';
	}

	// ── 鼠标事件 ───────────────────────────────────────────────
	_onMouseDown(e) {
		if (!this.imgLoaded) return;
		const pos = this.getMousePos(e);
		const imgPos = this.screenToImage(pos);
		this.startPoint = pos;
		this.isDragging = true;
		if (this.panMode && e.button === 0) {
			this.mode = 'panning';
			this.panStart = { x: pos.x, y: pos.y, offsetX: this.viewOffset.x, offsetY: this.viewOffset.y };
			this.canvas.style.cursor = 'grabbing';
			return;
		}
		if (this.mode === 'placeMarker') {
			this.addMarkerAt(imgPos);
			this.isDragging = false;
			const placed = this.markers.find((m) => m.id === this.selectedMarkerId);
			// 放灶台后自动进入「画灶口朝向」，免去再点按钮。
			if (placed && this.techMode === 'naqi' && placed.type === 'stove') {
				this.startStoveFacing(placed.id);
				return;
			}
			this.mode = 'none';
			this.canvas.style.cursor = 'default';
			this.setStatus('标记已放置。');
			this.emit();
			return;
		}
		if (this.diskCenterMode === 'custom' && e.shiftKey) {
			this.customCenter = imgPos;
			this.setStatus('已更新自定义盘心。');
			this.drawAll();
			this.isDragging = false;
			this.mode = 'none';
			this.pushHistory();
			this.emit();
			return;
		}
		if (this.mode === 'drawRect') {
			this.rect.x = imgPos.x; this.rect.y = imgPos.y; this.rect.w = 0; this.rect.h = 0;
			return;
		}
		if (this.mode === 'drawDoorLine' || this.mode === 'drawStoveFacing' || this.mode === 'drawBaguaNorth') return;
		const hit = this.getMarkerAtPos(pos);
		if (hit) {
			this.selectedMarkerId = hit.id;
			this.dragMarkerId = hit.id;
			this.mode = 'dragMarker';
			this.canvas.style.cursor = 'grabbing';
			this.drawAll();
			this.emit();
			return;
		}
		if (this.rect.active) {
			const center = this.getRectCenter();
			const local = rotatePoint(imgPos, center, -this.rect.rotation);
			const hw = this.rect.w / 2;
			const hh = this.rect.h / 2;
			const dx = local.x - center.x;
			const dy = local.y - center.y;
			const hs = 8 / this.getCombinedScale() + 5;
			if (Math.abs(dx + hw) < hs && Math.abs(dy + hh) < hs) { this.mode = 'resizingRect'; this.activeHandle = 'tl'; }
			else if (Math.abs(dx - hw) < hs && Math.abs(dy + hh) < hs) { this.mode = 'resizingRect'; this.activeHandle = 'tr'; }
			else if (Math.abs(dx - hw) < hs && Math.abs(dy - hh) < hs) { this.mode = 'resizingRect'; this.activeHandle = 'br'; }
			else if (Math.abs(dx + hw) < hs && Math.abs(dy - hh) < hs) { this.mode = 'resizingRect'; this.activeHandle = 'bl'; }
			else if (Math.abs(dx) < hw && Math.abs(dy) < hh) { this.mode = 'movingRect'; this.canvas.style.cursor = 'move'; }
			else { this.mode = 'none'; this.isDragging = false; return; }
			this.initialRectState = { ...this.rect };
		}
		if (!this.rect.active) { this.isDragging = false; this.mode = 'none'; }
	}

	_onMouseMove(e) {
		if (!this.imgLoaded) return;
		const pos = this.getMousePos(e);
		if (!this.isDragging) { this.updateCursorStyle(pos); return; }
		const imgPos = this.screenToImage(pos);
		const c = this.getCombinedScale();
		const deltaX = (pos.x - this.startPoint.x) / c;
		const deltaY = (pos.y - this.startPoint.y) / c;
		if (this.mode === 'panning' && this.panStart) {
			this.viewOffset.x = this.panStart.offsetX + (pos.x - this.panStart.x);
			this.viewOffset.y = this.panStart.offsetY + (pos.y - this.panStart.y);
			this.drawAll();
			return;
		}
		if (this.mode === 'drawRect') { this.rect.w = deltaX; this.rect.h = deltaY; this.drawAll(); return; }
		if (this.mode === 'drawDoorLine' || this.mode === 'drawStoveFacing' || this.mode === 'drawBaguaNorth') {
			this.drawAll();
			this.ctx.beginPath();
			this.ctx.moveTo(this.startPoint.x, this.startPoint.y);
			this.ctx.lineTo(pos.x, pos.y);
			this.ctx.strokeStyle = this.mode === 'drawBaguaNorth' ? '#3a6ea5' : this.mode === 'drawStoveFacing' ? '#e08a3c' : '#d84f4f';
			this.ctx.lineWidth = 2;
			this.ctx.stroke();
			return;
		}
		if (this.mode === 'movingRect') {
			this.rect.x = this.initialRectState.x + deltaX;
			this.rect.y = this.initialRectState.y + deltaY;
			this.drawAll();
			return;
		}
		if (this.mode === 'resizingRect') {
			const rad = (-this.initialRectState.rotation * Math.PI) / 180;
			const ldx = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
			const ldy = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);
			let nx = this.initialRectState.x;
			let ny = this.initialRectState.y;
			let nw = this.initialRectState.w;
			let nh = this.initialRectState.h;
			if (this.activeHandle === 'br') { nw += ldx; nh += ldy; }
			else if (this.activeHandle === 'bl') { nx += ldx; nw -= ldx; nh += ldy; }
			else if (this.activeHandle === 'tr') { ny += ldy; nh -= ldy; nw += ldx; }
			else if (this.activeHandle === 'tl') { nx += ldx; ny += ldy; nw -= ldx; nh -= ldy; }
			this.rect.x = nx; this.rect.y = ny; this.rect.w = nw; this.rect.h = nh;
			this.drawAll();
			return;
		}
		if (this.mode === 'dragMarker') {
			const m = this.markers.find((x) => x.id === this.dragMarkerId);
			if (m) { const sp = this.snapPointToRect(imgPos); m.x = sp.x; m.y = sp.y; this.drawAll(); }
		}
	}

	_onMouseUp(e) {
		if (!this.imgLoaded || !this.isDragging) return;
		this.isDragging = false;
		const pos = this.getMousePos(e);
		if (this.mode === 'panning') { this.mode = 'none'; this.canvas.style.cursor = this.panMode ? 'grab' : 'default'; this.drawAll(); return; }
		if (this.mode === 'drawRect') {
			this.rect.active = true;
			if (this.rect.w < 0) { this.rect.x += this.rect.w; this.rect.w = Math.abs(this.rect.w); }
			if (this.rect.h < 0) { this.rect.y += this.rect.h; this.rect.h = Math.abs(this.rect.h); }
			this.snapRectToImage();
			const c = this.getCombinedScale();
			if (this.rect.w < 5 / c || this.rect.h < 5 / c) { this.rect.active = false; this.setStatus('房屋框过小，请重新绘制。'); }
			else this.setStatus('房屋框已完成，可拖动或微调旋转。');
			this.mode = 'none';
			this.pushHistory();
		} else if (this.mode === 'drawDoorLine') {
			const dx = pos.x - this.startPoint.x;
			const dy = pos.y - this.startPoint.y;
			let mapDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
			if (mapDeg < 0) mapDeg += 360;
			this.doorImageAngle = mapDeg;
			this.setStatus(`入户门角度已设定：${Math.round(this.doorImageAngle)}°`);
			this.mode = 'none';
			this.pushHistory();
		} else if (this.mode === 'drawBaguaNorth') {
			const dx = pos.x - this.startPoint.x;
			const dy = pos.y - this.startPoint.y;
			let mapDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
			if (mapDeg < 0) mapDeg += 360;
			this.baguaOrient = mapDeg;
			this.setStatus(`正北方向已设定：${Math.round(mapDeg)}°`);
			this.mode = 'none';
			this.pushHistory();
		} else if (this.mode === 'drawStoveFacing') {
			const dx = pos.x - this.startPoint.x;
			const dy = pos.y - this.startPoint.y;
			let mapDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
			if (mapDeg < 0) mapDeg += 360;
			const m = this.markers.find((x) => x.id === this.facingMarkerId);
			if (m) m.facingAngle = mapDeg;
			this.facingMarkerId = null;
			this.setStatus(`灶口朝向已设定：${Math.round(mapDeg)}°`);
			this.mode = 'none';
			this.pushHistory();
		} else if (this.mode === 'movingRect' || this.mode === 'resizingRect') {
			if (this.rect.w < 0) { this.rect.x += this.rect.w; this.rect.w = Math.abs(this.rect.w); }
			if (this.rect.h < 0) { this.rect.y += this.rect.h; this.rect.h = Math.abs(this.rect.h); }
			this.snapRectToImage();
			this.mode = 'none';
			this.pushHistory();
		} else if (this.mode === 'dragMarker') {
			this.mode = 'none';
			this.pushHistory();
		}
		this.drawAll();
		this.canvas.style.cursor = 'default';
		this.emit();
	}

	handleKey(e) {
		const key = (e.key || '').toLowerCase();
		const isMod = e.metaKey || e.ctrlKey;
		const editing = e.target && (['input', 'textarea'].includes((e.target.tagName || '').toLowerCase()) || e.target.isContentEditable);
		if (isMod && key === 'z' && !e.shiftKey) { if (!editing) { e.preventDefault(); this.undo(); } return; }
		if (isMod && (key === 'y' || (key === 'z' && e.shiftKey))) { if (!editing) { e.preventDefault(); this.redo(); } return; }
		if (e.key === 'Escape') { this.mode = 'none'; this.canvas.style.cursor = 'default'; this.emit(); }
	}
}
