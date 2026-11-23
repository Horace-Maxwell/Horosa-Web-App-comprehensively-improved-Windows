// 风水纳气盘引擎 · 视图模型与状态:通知、视图模型、状态行、存取快照、撤销 / 重做历史
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { formatAngle } from '../fengshuiGeom';
import { HISTORY_LIMIT } from './constants';

export const stateMethods = {
	// ── 视图模型 ───────────────────────────────────────────────
	emit() {
		this.onChange(this.getViewModel());
	},

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
		// 纳气统计只看纳气标记(两法共用标注历史;八卦标记无 category,此前被计成「未定位」/水位冲突)。
		const naqiOnly = this.naqiMarkers();
		naqiOnly.forEach((m) => {
			const ev = this.evaluateMarker(m);
			if (ev.center) return;   // 中宫不计
			if (!ev.sector) stats.unknown += 1;
			else if (m.category === 'wind') ev.ok ? (stats.windOk += 1) : (stats.windBad += 1);
			else if (m.category === 'water') ev.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
		});
		const summary = naqiOnly.length
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
	},

	setStatus(text) {
		this.status = text;
	},

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
	},

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
	},

	initHistory() {
		this.historyStack = [this.captureState()];
		this.redoStack = [];
	},

	pushHistory() {
		if (this.historyLocked) return;
		this.historyStack.push(this.captureState());
		if (this.historyStack.length > HISTORY_LIMIT) this.historyStack.shift();
		this.redoStack = [];
	},

	scheduleHistoryPush() {
		if (this.historyLocked) return;
		clearTimeout(this.historyTimer);
		this.historyTimer = setTimeout(() => this.pushHistory(), 350);
	},

	undo() {
		if (this.historyStack.length < 2) return;
		const cur = this.historyStack.pop();
		this.redoStack.push(cur);
		this.applySnapshot(this.historyStack[this.historyStack.length - 1]);
		this.setStatus('已撤销上一步。');
		this.emit();
	},

	redo() {
		if (this.redoStack.length === 0) return;
		const next = this.redoStack.pop();
		this.historyStack.push(next);
		this.applySnapshot(next);
		this.setStatus('已重做一步。');
		this.emit();
	},
};
