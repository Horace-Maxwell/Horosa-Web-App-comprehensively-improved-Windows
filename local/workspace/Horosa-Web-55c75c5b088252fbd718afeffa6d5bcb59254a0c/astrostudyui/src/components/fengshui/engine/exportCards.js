// 风水纳气盘引擎 · 判读与导出:纳气 / 八卦分析与探针、AI 快照正文、合成画布、PNG / 报告 PNG / 报告 PDF 导出
// 从 fengshuiEngine.js 按职责拆出的 FengShuiEngine 方法:this 仍是 FengShuiEngine 实例,门面里 mixinMethods(FengShuiEngine, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { formatAngle } from '../fengshuiGeom';
import { harmForMarker, HARM_MAP, evalDragonTiger, scoreNaqi, gradeOf, REMEDY_LIB } from '../naqiRules';
import { GUA_8, composeHexagram, computeTiming, HEXAGRAM_TEXTS, HEXAGRAM_META, guaBySectorNum, computeRankShift, namePositionRelation, featureJudgment, GUA_TO_ROLE } from '../baguaCore';
import { withOriginalScript } from '../../../utils/scriptMode';
import { printHtmlDocument } from '../../../utils/printHtmlDocument';
import { TIPS, ADVICE, DISK_SKINS, sectorAdjacent } from './constants';

export const exportCardMethods = {
	// ── 快照（AI 分析挂载文本）──────────────────────────────────
	buildAiSnapshotText() {
		if (this.techMode === 'bagua') return this.buildBaguaSnapshotText();
		return this.buildNaqiSnapshotText();
	},

	buildNaqiSnapshotText() {
		const periodLabel = this.periodMode === 'current' ? '1964-2044' : '2044-2124';
		const headerLines = [
			`生成时间：${new Date().toLocaleString()}`,
			`单元门角度：${formatAngle(this.unitAzimuth)}   入户门角度：${formatAngle(this.doorImageAngle)}   盘旋转：${formatAngle(this.getDiskRotation())}   运期：${periodLabel}`,
		];
		// 纳气快照只遍历纳气标记(与判定面板 currentModeMarkers 同源);此前把「父/母/厨房灶」等八卦标记
		// 列入 [标记判定]/[冲突清单],期望方位因无 category 被写成水位。
		const naqiList = this.naqiMarkers();
		const details = naqiList.map((m) => {
			const ev = this.evaluateMarker(m);
			const position = ev.sector ? `${ev.sector.num}·${ev.sector.name}·${ev.actual === 'wind' ? '气位' : '水位'}` : (ev.center ? '中宫(盘心,不计)' : '未定位');
			return { marker: m, ev, position };
		});
		const markerLines = naqiList.length
			? ['| 序 | 标记 | 位置 | 状态 |', '| --- | --- | --- | --- |',
				...details.map((d, i) => {
					const st = d.ev.center ? '不计' : d.marker.category === 'neutral' ? '观察' : d.ev.ok ? '位置合适' : '位置冲突';
					return `| ${i + 1}. | ${d.marker.label} | ${d.position} | ${st} |`;
				})]
			: ['暂无标记'];
		const conflictLines = details.filter((d) => d.marker.category !== 'neutral' && d.ev.sector && !d.ev.ok)
			.map((d) => `${d.marker.label}：${d.position}（期望 ${d.ev.expected === 'wind' ? '气位' : '水位'}）`);
		const unknownLines = details.filter((d) => !d.ev.sector && !d.ev.center).map((d) => `${d.marker.label}：未定位`);
		const stats = { windOk: 0, waterOk: 0, windBad: 0, waterBad: 0, unknown: 0 };
		details.forEach((d) => {
			if (d.ev.center) return;   // 中宫不计
			if (!d.ev.sector) stats.unknown += 1;
			else if (d.marker.category === 'wind') d.ev.ok ? (stats.windOk += 1) : (stats.windBad += 1);
			else if (d.marker.category === 'water') d.ev.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
		});
		const statsLine = `气位正确 ${stats.windOk} 项，气位冲突 ${stats.windBad} 项；水位正确 ${stats.waterOk} 项，水位冲突 ${stats.waterBad} 项；未定位 ${stats.unknown} 项。`;
		const suggestionLines = [];
		if (!naqiList.length) suggestionLines.push('当前没有标注，可先放置门、窗、床、灶、沙发等关键点。');
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
	},

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
		}) : ['暂无成员，请在户型图上放置成员标记'];
		push('成员卦象', memberRows);
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
	},

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
	},

	// 稳健下载：anchor 必须挂到 DOM 才能在 webview/壳内可靠触发（脱离 DOM 的 click 常被拦）。
	downloadDataUrl(filename, dataUrl) {
		const link = document.createElement('a');
		link.download = filename;
		link.href = dataUrl;
		link.rel = 'noopener';
		document.body.appendChild(link);
		link.click();
		setTimeout(() => { try { document.body.removeChild(link); } catch (e) { /* noop */ } }, 0);
	},

	// 导出内容永远是简体原文(界面繁体时 canvas 画字不转换,见 utils/scriptMode.withOriginalScript)
	exportPng() {
		return withOriginalScript(() => this._exportPngRaw());
	},

	_exportPngRaw() {
		const ex = this.renderCompositeCanvas();
		if (!ex) return;
		const name = this.techMode === 'bagua' ? '八卦阳宅-盘面.png' : '纳气盘-盘面.png';
		this.downloadDataUrl(name, ex.toDataURL('image/png'));
	},

	// 报告分区（按模式产出 {title, accent, lines:[{text,tone}]}）。tone: normal/good/bad/muted。
	reportSections() {
		const L = (arr) => arr.map((x) => (typeof x === 'string' ? { text: x, tone: 'normal' } : x));
		if (this.techMode === 'bagua') {
			const an = this.buildBaguaAnalysis();
			const secs = [];
			secs.push({ title: '起盘信息', accent: '#b88a3e', lines: L([`正北方向 ${formatAngle(this.baguaOrient)}　盘旋转 ${formatAngle(this.getDiskRotation())}　盘心＝房屋正中（太极点）`]) });
			const ml = [];
			if (!an.members.length) ml.push({ text: '暂无成员，请在户型图上放置成员标记。', tone: 'muted' });
			an.members.forEach((m) => {
				if (!m.roomGua || !m.hex) { ml.push({ text: `${m.role}（${m.benmingGua}）：标记未落在盘内`, tone: 'muted' }); return; }
				const tag = (m.meta && m.meta.tag) || 'neutral';
				const tone = tag === 'caution' ? 'bad' : tag === 'auspicious' ? 'good' : 'normal';
				const rk = m.rankShift && m.rankShift.dir !== '平' ? `　${m.rankShift.dir} ${m.rankShift.years} 年` : '';
				const sx = m.shenxing && m.shenxing.same ? '　名位相同·家和' : '';
				ml.push({ text: `${m.role} · 居${m.roomDir} · ${m.hex.name}（应期 ${m.timing ? m.timing.window : ''}${rk}${sx}）`, tone });
				if (m.text && m.text.xiang) ml.push({ text: `　${m.text.xiang}`, tone: 'muted' });
			});
			secs.push({ title: '成员卦象', accent: '#1497a8', lines: ml });
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
			text: `${m.label}：${m.sector ? `${m.sector.name} · ${m.actual === 'wind' ? '气位' : '水位'}` : (m.center ? '中宫(盘心,不计)' : '未定位')}（${m.category === 'neutral' ? '观察' : m.kitchen ? '厨房' : m.ok ? '位置合适' : '位置冲突'}）`,
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
	},

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
	},

	// 导出内容永远是简体原文(界面繁体时 canvas 画字不转换,见 utils/scriptMode.withOriginalScript)
	exportReportPng() {
		return withOriginalScript(() => this._exportReportPngRaw());
	},

	_exportReportPngRaw() {
		const rc = this.buildReportCanvas();
		if (!rc) return;
		const name = this.techMode === 'bagua' ? '八卦阳宅-判定报告.png' : '纳气盘-判定报告.png';
		this.downloadDataUrl(name, rc.toDataURL('image/png'));
	},

	// 导出内容永远是简体原文(界面繁体时 canvas 画字不转换,见 utils/scriptMode.withOriginalScript)
	exportReportPdf() {
		return withOriginalScript(() => this._exportReportPdfRaw());
	},

	_exportReportPdfRaw() {
		const rc = this.buildReportCanvas();
		if (!rc) return;
		const dataUrl = rc.toDataURL('image/png');
		const reportTitle = this.techMode === 'bagua' ? '八卦阳宅判定报告' : '纳气盘判定报告';
		// 隐藏 iframe 打印(桌面 webview 吞 window.open 新窗口,旧写法点了没反应)
		return printHtmlDocument([
			`<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title>`,
			'<style>body{margin:0;padding:24px;font-family:"PingFang SC",sans-serif;background:#fff;}img{width:100%;max-width:100%;}</style>',
			'</head><body>',
			`<img src="${dataUrl}" />`,
			'</body></html>',
		].join(''));
	},

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
				actual: e.ev.actual, ok: e.ev.ok, kitchen: !!e.kitchen, harm, center: !!e.ev.center,
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
	},

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
	},

	// ── 八卦阳宅法分析（读图上 bagua 标记：成员→名上位下64卦+应期+排位+形神；格局→四类象）──
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
	},
};
