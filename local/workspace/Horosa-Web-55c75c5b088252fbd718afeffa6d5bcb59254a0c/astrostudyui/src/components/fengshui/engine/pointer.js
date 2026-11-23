// 风水纳气盘引擎 · 指针与键盘:命中标记、光标样式、按下 / 移动 / 抬起、快捷键
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { rotatePoint } from '../fengshuiGeom';

export const pointerMethods = {
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
	},

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
	},

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
	},

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
	},

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
	},

	handleKey(e) {
		const key = (e.key || '').toLowerCase();
		const isMod = e.metaKey || e.ctrlKey;
		const editing = e.target && (['input', 'textarea'].includes((e.target.tagName || '').toLowerCase()) || e.target.isContentEditable);
		if (isMod && key === 'z' && !e.shiftKey) { if (!editing) { e.preventDefault(); this.undo(); } return; }
		if (isMod && (key === 'y' || (key === 'z' && e.shiftKey))) { if (!editing) { e.preventDefault(); this.redo(); } return; }
		if (e.key === 'Escape') { this.mode = 'none'; this.canvas.style.cursor = 'default'; this.emit(); }
	},
};
