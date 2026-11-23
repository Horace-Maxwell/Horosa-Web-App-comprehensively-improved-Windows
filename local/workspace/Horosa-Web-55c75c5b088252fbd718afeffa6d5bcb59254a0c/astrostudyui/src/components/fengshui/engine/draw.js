// 风水纳气盘引擎 · 画布绘制:整盘、罗盘与盘面皮肤、门线、八卦盘、户型框、纳气盘、标记
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { GUA_8 } from '../baguaCore';
import { SECTORS, WIND_COLOR, WATER_COLOR, DISK_SKINS } from './constants';

export const drawMethods = {
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
	},

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
	},

	getDiskGeom(sf, off) {
		const center = this.getDiskCenter();
		if (!center) return null;
		const cx = center.x * sf + off.x;
		const cy = center.y * sf + off.y;
		const radius = this.getMaxDiskRadius(center) * this.diskScale * sf;
		if (radius <= 0) return null;
		return { cx, cy, radius, diskRotation: this.getDiskRotation() };
	},

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
	},

	getSkinImage() {
		const skin = DISK_SKINS.find((s) => s.key === this.diskSkin);
		if (!skin || !skin.src) return null;
		const img = this.skinImages[skin.src];
		return img && img.complete && img.naturalWidth ? { img, skin } : null;
	},

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
	},

	// 八卦阳宅盘：8 卦各 45° 铺满 + 成员房间高亮 + 卦名。skinMode=true 时只画高亮（皮肤已是底图）。
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
	},

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
	},

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
	},

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
	},
};
