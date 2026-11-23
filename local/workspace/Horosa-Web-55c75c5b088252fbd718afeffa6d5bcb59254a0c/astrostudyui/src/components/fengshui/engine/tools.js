// 风水纳气盘引擎 · 操作与设置:载入户型图、画框 / 画门 / 放标记、清除与选择、各项角度 / 透明度 / 比例 / 模式 / 皮肤 / 朝向设置、平移与吸附开关、加标记
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { normalizeDeg } from '../fengshuiGeom';
import { MARKER_TYPES, BAGUA_MARKER_TYPES, DISK_SKINS } from './constants';

export const toolMethods = {
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
	},

	startDrawRect() {
		if (!this.imgLoaded) return;
		this.mode = 'drawRect';
		this.canvas.style.cursor = 'crosshair';
		this.rect.active = false;
		this.rect.rotation = 0;
		this.setStatus('模式：绘制矩形。在图上拖动完成框选。');
		this.emit();
	},

	startDrawDoor() {
		if (!this.imgLoaded) return;
		this.mode = 'drawDoorLine';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：绘制门向。请从门内向门外画一条线。');
		this.emit();
	},

	startPlaceMarker() {
		if (!this.imgLoaded) return;
		this.mode = 'placeMarker';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：放置标记。点击画布位置放置。');
		this.emit();
	},

	resetRect() {
		this.rect = { x: 0, y: 0, w: 0, h: 0, rotation: 0, active: false };
		this.setStatus('已重置房屋框。');
		this.drawAll();
		this.pushHistory();
		this.emit();
	},

	clearMarkers() {
		this.markers = this.markers.filter((m) => (m.mode || 'naqi') !== this.techMode);
		this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	},

	deleteMarker(id) {
		this.markers = this.markers.filter((m) => m.id !== id);
		if (this.selectedMarkerId === id) this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	},

	selectMarker(id) {
		this.selectedMarkerId = id;
		this.drawAll();
		this.emit();
	},

	setFilter(f) { this.currentFilter = f; this.emit(); },

	setMarkerType(id) { this.markerType = id; this.emit(); },

	// 角度框无 0–360 限制:越界(如 -400)只补一次 360 后仍为负,落宫判据把负余角判为北。三处一律归一到 [0,360)。
	setUnitAngle(v) {
		this.unitAzimuth = v === '' || v === null || Number.isNaN(parseFloat(v)) ? null : normalizeDeg(parseFloat(v));
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	},

	setDoorAngle(v) {
		this.doorImageAngle = v === '' || v === null || Number.isNaN(parseFloat(v)) ? null : normalizeDeg(parseFloat(v));
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	},

	setOpacity(v) { this.globalAlpha = parseFloat(v); this.drawAll(); this.scheduleHistoryPush(); this.emit(); },

	setDiskScale(v) { this.diskScale = Math.max(1, parseFloat(v)); this.drawAll(); this.scheduleHistoryPush(); this.emit(); },

	setRectRotation(v) { this.rect.rotation = parseFloat(v) || 0; this.drawAll(); this.scheduleHistoryPush(); this.emit(); },

	setDiskCenterMode(m) {
		this.diskCenterMode = m;
		if (m === 'custom') this.setStatus('自定义盘心：按住 Shift 在画布点击设定。');
		this.drawAll();
		this.pushHistory();
		this.emit();
	},

	setPeriodMode(m) { this.periodMode = m; this.drawAll(); this.pushHistory(); this.emit(); },

	// ── 模式 / 罗盘皮肤 / 灶口朝向 / 成员（P0 骨架 + 八卦）─────────
	setTechMode(m) {
		if (m !== 'naqi' && m !== 'bagua') return;
		this.techMode = m;
		this.markerType = (m === 'bagua' ? BAGUA_MARKER_TYPES : MARKER_TYPES)[0].id;
		if (this.mode === 'placeMarker' || this.mode === 'drawStoveFacing' || this.mode === 'drawBaguaNorth') { this.mode = 'none'; this.canvas.style.cursor = 'default'; }
		this.selectedMarkerId = null;
		this.drawAll();
		this.pushHistory();
		this.emit();
	},

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
	},

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
	},

	// 八卦阳宅：单一「正北方向(度)」。
	setBaguaOrient(v) {
		this.baguaOrient = v === '' || v === null || v === undefined || Number.isNaN(parseFloat(v)) ? null : normalizeDeg(parseFloat(v));
		this.drawAll();
		this.scheduleHistoryPush();
		this.emit();
	},

	startBaguaNorth() {
		if (!this.imgLoaded) return;
		this.mode = 'drawBaguaNorth';
		this.canvas.style.cursor = 'crosshair';
		this.setStatus('模式：画正北方向。从盘心向正北画一条线。');
		this.emit();
	},

	togglePan() {
		this.panMode = !this.panMode;
		this.canvas.style.cursor = this.panMode ? 'grab' : 'default';
		this.setStatus(this.panMode ? '拖拽模式：拖动画布移动' : '拖拽模式已关闭');
		this.emit();
	},

	toggleSnap() { this.snapEnabled = !this.snapEnabled; this.setStatus(this.snapEnabled ? '吸附对齐已开启' : '吸附对齐已关闭'); this.emit(); },

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
	},

	// 当前模式的标记（旧存档无 mode 视为 naqi，保后向兼容）。
	currentModeMarkers() {
		return this.markers.filter((m) => (m.mode || 'naqi') === this.techMode);
	},

	// 纳气标记(不随 techMode):纳气快照 / vm.summary 专用。
	naqiMarkers() {
		return this.markers.filter((m) => (m.mode || 'naqi') === 'naqi');
	},
};
