// [择日概览·太乙] 十六宫盘·实例无关共享渲染 —— 从 TaiYiMain.renderLeft 机械迁出(JSX 逐节点不变,
// this.* → props/模块函数)。主页经薄壳传实例态;择日概览浮窗自装 props(fetchTaiyiPan 起盘)。
// 盘面样式/结构改这里(单源);TaiYiMain 不再持有第二份绘制代码。
// props: { pan, showBoardMark, selectedPalace, onSelectPalace(idx|null), boardHostRef?, gejuList? }
import React from 'react';
import { computeGeju } from './core/taiyiGeju';
// horosa_taiyi_boardsvg_shenmeaning_import_v1:shenMeaning 用于宫位悬浮主事文本,上游漏 import
// (触发即 ReferenceError,选中/悬浮正宫时崩)。绑定门实抓;建议上游化。
import { TAIYI_GONG_INFO, shenMeaning } from './core/taiyiDuanfa';

const LAYER2_NUMS = ['二', '七', '六', '一', '八', '三', '四', '九'];
const LAYER3_BRANCH_GUA = ['午', '未', '坤', '申', '酉', '戌', '乾', '亥', '子', '丑', '艮', '寅', '卯', '辰', '巽', '巳'];
const LAYER4_FIXED = ['大威', '天道', '大武', '武德', '太簇', '阴主', '阴德', '大义', '地主', '阳德', '和德', '吕申', '高丛', '太阳', '大炅', '大神'];
export const TAIYI_FONT = '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif';

export function polarPoint(cx, cy, r, angleDeg){
	const rad = angleDeg * Math.PI / 180;
	return {
		x: cx + r * Math.cos(rad),
		y: cy + r * Math.sin(rad),
	};
}

// TaiYiMain.formatDisplayValue 的纯函数版(递归格式化 sections 值)
export function formatTaiyiDisplayValue(value){
	if(value === undefined || value === null || value === ''){
		return '—';
	}
	if(Array.isArray(value)){
		return value.map((item) => formatTaiyiDisplayValue(item)).filter((item) => item && item !== '—').join('、') || '—';
	}
	if(typeof value === 'object'){
		const text = Object.keys(value).map((key) => {
			const item = formatTaiyiDisplayValue(value[key]);
			if(!item || item === '—'){
				return '';
			}
			return `${key}：${item}`;
		}).filter(Boolean).join('；');
		return text || '—';
	}
	return `${value}`.replace(/得None/g, '未得').replace(/None/g, '未得');
}

export function taiyiSectionValue(pan, sourceKey, fallback = '—'){
	const sections = pan && pan.sections ? pan.sections : [];
	for(let i = 0; i < sections.length; i += 1){
		const rows = sections[i].rows || [];
		for(let j = 0; j < rows.length; j += 1){
			if(rows[j].sourceKey === sourceKey || rows[j].label === sourceKey){
				return formatTaiyiDisplayValue(rows[j].value);
			}
		}
	}
	return fallback;
}

export default function TaiyiBoardSvg(props){
	const gejuList = props.gejuList || (props.pan ? computeGeju(props.pan) : []);
		const pan = props.pan;
		if (!pan) {
			return <div className="horosa-taiyi-empty horosa-taiyi-board-empty">暂无太乙盘数据</div>;
		}
		const width = 860;
		const height = 720;
		const centerX = 430;
		const centerY = 360;
		const r0 = 78;
		const r1 = 124;
		const r2 = 172;
		const r3 = 222;
		const r4 = 304;
		const stroke = 'var(--horosa-border-strong, #111)';
		const textColor = 'var(--horosa-text, #111)';
		const textWeight = '500';
			const palaceInfo = {};
			(pan.palaces || []).forEach((p) => {
				palaceInfo[p.palace] = p.items || [];
			});
			const layer5 = LAYER3_BRANCH_GUA.map((p) => (palaceInfo[p] ? palaceInfo[p].slice(0) : []));
			const pillars = pan && pan.ganzhi ? pan.ganzhi : {};
			const panOptions = pan && pan.options ? pan.options : {};
			const topLeftInfo = [
				`农历：${pan.lunarText || '—'}`,
				`直接时间：${pan.clockTime || '—'}　真太阳时：${pan.realSunTime || '—'}`,
				`年柱：${pillars.year || '—'}　月柱：${pillars.month || '—'}`,
				`日柱：${pillars.day || '—'}　时柱：${pillars.time || '—'}`,
				`节气：${pan.jiedelta || '—'}`,
				`计法：${panOptions.styleLabel || '—'}　古法：${panOptions.methodLabel || panOptions.accumLabel || '—'}`,
				`年号：${pan.reignYear || taiyiSectionValue(pan, '年號')}`,
				`纪元：${pan.calendarEra || pan.jiyuan || taiyiSectionValue(pan, '紀元')}`,
			];
			const topMetaX = 14;
			const topMetaY = 4;
			const topMetaLineHeight = 17;
			const topMetaFontSize = 13;
			const bottomRightInfo = [
				`积数:${pan.accNum}`,
				`命式:${pan.zhao}`,
				`局:${pan.kook ? pan.kook.text : ''}`,
				`定算:${pan.setCal}`,
				`主算:${pan.homeCal}`,
			`客算:${pan.awayCal}`,
			`太乙数:${pan.taiyiNum}`,
		];
		// 顶部「农历」行裁切·结构性根治(2026-06-12,用户三度实告):
		// 历史上这里给 svg 加过「按实测可视盒算的显式像素 width/height」想兜底遮挡,但那恰恰是裁切之源——
		// 测量在 flex 布局/窗口缩放下易过期偏大,svg 元素遂超出 wrap,而 wrap align-items:center 居中 +
		// overflow:hidden → 顶部(农历行)被切。彻底删除内联像素覆盖:svg 只靠 viewBox + preserveAspectRatio
		// 'xMidYMid meet' + CSS width/height:100%。meet 的定义即「整个 viewBox 等比缩放至完全装入视口」,
		// svg 元素 == 容器尺寸(100%)永不溢出 → 数学上不可能裁切,宽高比不符时四周留白居中。无需任何 JS 测量。
		const boardSvgStyle = { background: 'transparent', textRendering: 'geometricPrecision' };
		// 第二道硬保险:viewBox 顶部留 24 单位 padding(底部 8)。农历行画在 y=4,几乎贴 viewBox 顶 →
		// meet 缩放后顶部 padding 被压成 ~1px,矮窗下随时可能被亚像素/字体上沿吃掉。把 viewBox 上沿
		// 抬到 -24,农历行上方恒有 28 单位空白,任何缩放比下都映射成肉眼可见的安全余量,绝不贴顶。
		const VB_PAD_TOP = 24;
		const VB_PAD_BOTTOM = 8;
		const boardViewBox = `0 ${-VB_PAD_TOP} ${width} ${height + VB_PAD_TOP + VB_PAD_BOTTOM}`;
		return (
			<div className="horosa-taiyi-board-canvas" ref={props.boardHostRef}>
					<div className="horosa-taiyi-board-svg-wrap">
						<svg
							className="horosa-taiyi-board-svg"
							viewBox={boardViewBox}
							preserveAspectRatio="xMidYMid meet"
							style={boardSvgStyle}
						>
							<circle cx={centerX} cy={centerY} r={r0} fill="none" stroke={stroke} strokeWidth="2.5" />
							<circle cx={centerX} cy={centerY} r={r1} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r2} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r3} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r4} fill="none" stroke={stroke} strokeWidth="2.5" />

								<text
									x={topMetaX}
									y={topMetaY}
									textAnchor="start"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize={topMetaFontSize}
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{topLeftInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_${lineIdx}`} x={topMetaX} dy={lineIdx === 0 ? 0 : topMetaLineHeight}>
											{line}
										</tspan>
									))}
								</text>
								<text
									x={width - 20}
									y={height - 20 - ((bottomRightInfo.length - 1) * 20)}
									textAnchor="end"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize="15"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{bottomRightInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_bottom_${lineIdx}`} x={width - 20} dy={lineIdx === 0 ? 0 : 20}>
											{line}
										</tspan>
									))}
								</text>

							{LAYER2_NUMS.map((_, idx) => {
								const angle = -112.5 + idx * 45;
								const p1 = polarPoint(centerX, centerY, r0, angle);
								const p2 = polarPoint(centerX, centerY, r1, angle);
								return (
									<line
										key={`l2_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.8"
									/>
								);
							})}

							{LAYER3_BRANCH_GUA.map((_, idx) => {
								const angle = -101.25 + idx * 22.5;
								const p1 = polarPoint(centerX, centerY, r1, angle);
								const p2 = polarPoint(centerX, centerY, r4, angle);
								return (
									<line
										key={`l345_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.5"
									/>
								);
							})}

								<text
									x={centerX}
									y={centerY - 12}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="48"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									五
							</text>
								<text
									x={centerX}
									y={centerY + 30}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="34"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									中宫
							</text>

							{LAYER2_NUMS.map((txt, idx) => {
								const angle = -90 + idx * 45;
								const p = polarPoint(centerX, centerY, (r0 + r1) / 2, angle);
								return (
									<text
										key={`l2_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="36"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER3_BRANCH_GUA.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = polarPoint(centerX, centerY, (r1 + r2) / 2, angle);
								return (
									<text
										key={`l3_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="34"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER4_FIXED.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = polarPoint(centerX, centerY, (r2 + r3) / 2, angle);
								return (
									<text
										key={`l4_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="23"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{layer5.map((lines, idx) => {
								const angle = -90 + idx * 22.5;
								const p = polarPoint(centerX, centerY, (r3 + r4) / 2, angle);
								const merged = (lines || []).filter(Boolean).slice(0, 3);
								const fontSize = merged.length >= 3 ? 14 : (merged.length === 2 ? 15 : 16);
								const lineHeight = merged.length >= 3 ? 16 : 17;
								const firstDy = -((merged.length - 1) * lineHeight) / 2;
								if (!merged.length) {
									return null;
								}
								return (
									<text
										key={`l5_txt_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize={fontSize}
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
										{merged.map((ln, lnIdx) => (
											<tspan key={`l5_tspan_${idx}_${lnIdx}`} x={p.x} dy={lnIdx === 0 ? firstDy : lineHeight}>
												{ln}
											</tspan>
										))}
									</text>
								);
							})}

							{/* P0-7 盘面增强(由「盘面标注」开关控制):太乙落宫高亮 + 八正宫分野(门·州·绝气) + 文昌/始击主客配色 + 中宫注 */}
							{pan && props.showBoardMark && (() => {
								const ZHENG_ANGLE = { 午: -90, 坤: -45, 酉: 0, 乾: 45, 子: 90, 艮: 135, 卯: 180, 巽: 225 };
								const ZHENG_NUM = { 午: 2, 坤: 7, 酉: 6, 乾: 1, 子: 8, 艮: 3, 卯: 4, 巽: 9 };
								const ringAngle = (ps) => { const i = LAYER3_BRANCH_GUA.indexOf(ps); return i < 0 ? null : -90 + i * 22.5; };
								const els = [];
								// 正宫落点→绝气(分野底染色)。淡填八正宫扇区,气象一目了然(最底层,opacity 极低不压盘)。
								const QI_FILL = { 绝阳: 'var(--horosa-danger, #c0563a)', 绝阴: 'var(--horosa-info, #4a7fb5)', 绝气: 'var(--horosa-text-muted, #8a8a8a)', 易气: 'var(--horosa-accent, #d7ad69)', 和: 'var(--horosa-ok, #5a9367)' };
								const sectorPath = (ang) => {
									const a0 = ang - 11.25, a1 = ang + 11.25;
									const s1 = polarPoint(centerX, centerY, r1, a0), s2 = polarPoint(centerX, centerY, r4, a0);
									const s3 = polarPoint(centerX, centerY, r4, a1), s4 = polarPoint(centerX, centerY, r1, a1);
									return `M${s1.x},${s1.y} L${s2.x},${s2.y} A${r4},${r4} 0 0 1 ${s3.x},${s3.y} L${s4.x},${s4.y} A${r1},${r1} 0 0 0 ${s1.x},${s1.y} Z`;
								};
								Object.keys(ZHENG_ANGLE).forEach((ps) => {
									const info = TAIYI_GONG_INFO[ZHENG_NUM[ps]];
									const col = info && QI_FILL[info.qi];
									if (col) { els.push(<path key={`ty-qi-${ps}`} d={sectorPath(ZHENG_ANGLE[ps])} fill={col} fillOpacity="0.05" stroke="none" />); }
								});
								// 主客配色微染:主方(文昌+主大将正宫)金、客方(始击+客大将)蓝(叠在分野底染之上,opacity 低)。
								const tintSector = (ps, color, key) => { const ang = ringAngle(ps); if (ang === null) { return; } els.push(<path key={key} d={sectorPath(ang)} fill={color} fillOpacity="0.08" stroke="none" />); };
								tintSector(pan.skyeyes, 'var(--horosa-accent, #d7ad69)', 'tint-wc');
								tintSector(pan.homeGeneralPalace, 'var(--horosa-accent, #d7ad69)', 'tint-hg');
								tintSector(pan.sf, 'var(--horosa-info, #4a7fb5)', 'tint-sj');
								tintSector(pan.awayGeneralPalace, 'var(--horosa-info, #4a7fb5)', 'tint-ag');
								const tA = ZHENG_ANGLE[pan.taiyiPalace];
								if (tA !== undefined) {
									const a0 = tA - 11.25, a1 = tA + 11.25;
									const q1 = polarPoint(centerX, centerY, r1, a0), q2 = polarPoint(centerX, centerY, r4, a0);
									const q3 = polarPoint(centerX, centerY, r4, a1), q4 = polarPoint(centerX, centerY, r1, a1);
									els.push(<path key="ty-hl" d={`M${q1.x},${q1.y} L${q2.x},${q2.y} A${r4},${r4} 0 0 1 ${q3.x},${q3.y} L${q4.x},${q4.y} A${r1},${r1} 0 0 0 ${q1.x},${q1.y} Z`} fill="var(--horosa-accent, #d7ad69)" fillOpacity="0.14" stroke="var(--horosa-accent, #d7ad69)" strokeWidth="1.5" />);
								}
								Object.keys(ZHENG_ANGLE).forEach((ps) => {
									const info = TAIYI_GONG_INFO[ZHENG_NUM[ps]];
									if (!info) { return; }
									const fyAng = ZHENG_ANGLE[ps];
									const pp = polarPoint(centerX, centerY, r4 + 18, fyAng);
									const fyCos = Math.cos(fyAng * Math.PI / 180);
									const fyAnchor = fyCos > 0.35 ? 'start' : (fyCos < -0.35 ? 'end' : 'middle');
									els.push(<text key={`ty-fy-${ps}`} x={pp.x} y={pp.y} textAnchor={fyAnchor} dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="11" fontFamily={TAIYI_FONT}>{`${info.men}·${info.zhou}·${info.qi}`}</text>);
								});
								// 目/将 markers:四目(昌/击/计/定)内环 r4+40、主客大将外环 r4+62,分环避重叠;r=8 小圆+白字。
								const mark = (ps, color, lb, key, rad) => {
									const ang = ringAngle(ps); if (ang === null) { return; }
									const pp = polarPoint(centerX, centerY, rad, ang);
									els.push(<circle key={`ty-mk-${key}`} cx={pp.x} cy={pp.y} r="8" fill={color} />);
									els.push(<text key={`ty-mkt-${key}`} x={pp.x} y={pp.y} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="none" fontSize="10.5" fontFamily={TAIYI_FONT}>{lb}</text>);
								};
								mark(pan.skyeyes, 'var(--horosa-accent, #d7ad69)', '昌', 'wc', r4 + 40);
								mark(pan.sf, 'var(--horosa-info, #4a7fb5)', '击', 'sj', r4 + 40);
								mark(pan.jigod, 'var(--horosa-text-muted, #8a8a8a)', '计', 'js', r4 + 40);   // 计神(中性)
								mark(pan.se, 'var(--horosa-text-soft, #6c6c6c)', '定', 'dm', r4 + 40);       // 定目(次要)
								mark(pan.homeGeneralPalace, 'var(--horosa-accent, #d7ad69)', '主', 'hg', r4 + 62);   // 主大将(金·外环)
								mark(pan.awayGeneralPalace, 'var(--horosa-info, #4a7fb5)', '客', 'ag', r4 + 62);     // 客大将(蓝·外环)
								// P1-5 格局连线:太乙↔文昌/始击/主客大将,凶色虚线(掩=同宫描圈,对=长虚线,击=大将连线);「关」为数理关系无落点、不连线。
								const POS_OF = { 太乙: pan.taiyiPalace, 文昌: pan.skyeyes, 始击: pan.sf, 主大将: pan.homeGeneralPalace, 客大将: pan.awayGeneralPalace };
								const boardAngle = (ps) => { const i = LAYER3_BRANCH_GUA.indexOf(ps); return i < 0 ? null : -90 + i * 22.5; };
								gejuList.forEach((g, gi) => {
									const fp = POS_OF[g.from], tp = POS_OF[g.to];
									const fa = boardAngle(fp), ta = boardAngle(tp);
									if (fp == null || tp == null || fa === null || ta === null) { return; }
									const rr = (r1 + r2) / 2;
									if (fp === tp) {
										const c = polarPoint(centerX, centerY, rr, fa);
										els.push(<circle key={`gj-${gi}`} cx={c.x} cy={c.y} r="28" fill="none" stroke="var(--horosa-danger, #c0563a)" strokeWidth="2" strokeDasharray="4 3" />);
									} else {
										const a = polarPoint(centerX, centerY, rr, fa), b = polarPoint(centerX, centerY, rr, ta);
										els.push(<line key={`gj-${gi}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--horosa-danger, #c0563a)" strokeWidth="2" strokeDasharray={g.kind === 'dui' ? '9 5' : '4 3'} />);
									}
								});
								els.push(<text key="ty-zz" x={centerX} y={centerY + 56} textAnchor="middle" dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="13" fontFamily={TAIYI_FONT}>考治不居</text>);
								// 图例(右下角):昌/击/计/定/主/客 markers 释义 + 分野气色。停放 viewBox 右下空白,不压盘面。
								const LEGEND = [['昌', 'var(--horosa-accent, #d7ad69)', '文昌'], ['击', 'var(--horosa-info, #4a7fb5)', '始击'], ['计', 'var(--horosa-text-muted, #8a8a8a)', '计神'], ['定', 'var(--horosa-text-soft, #6c6c6c)', '定目'], ['主', 'var(--horosa-accent, #d7ad69)', '主大将'], ['客', 'var(--horosa-info, #4a7fb5)', '客大将']];
								const lgX = width - 96, lgY0 = 44;
								LEGEND.forEach(([lb, col, desc], li) => {
									const ly = lgY0 + li * 20;
									els.push(<circle key={`lg-c-${li}`} cx={lgX} cy={ly} r="7" fill={col} />);
									els.push(<text key={`lg-l-${li}`} x={lgX} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="none" fontSize="9.5" fontFamily={TAIYI_FONT}>{lb}</text>);
									els.push(<text key={`lg-d-${li}`} x={lgX + 13} y={ly} dominantBaseline="middle" fill="var(--horosa-text-muted, #8a8a8a)" stroke="none" fontSize="11" fontFamily={TAIYI_FONT}>{desc}</text>);
								});
								return els;
							})()}

							{/* P1-5 宫位点击(由「盘面标注」开关控制):16 透明命中扇区 + 信息面板(驻神/正间/门州气/格局/主事) */}
							{pan && props.showBoardMark && (() => {
								const els = [];
								const ZN = { 午: 2, 坤: 7, 酉: 6, 乾: 1, 子: 8, 艮: 3, 卯: 4, 巽: 9 };
								const POS = { 太乙: pan.taiyiPalace, 文昌: pan.skyeyes, 始击: pan.sf, 主大将: pan.homeGeneralPalace, 客大将: pan.awayGeneralPalace, 计神: pan.jigod, 定目: pan.se };
								const sel = props.selectedPalace;
								for (let idx = 0; idx < 16; idx++) {
									const a0 = -90 + idx * 22.5 - 11.25, a1 = -90 + idx * 22.5 + 11.25;
									const q1 = polarPoint(centerX, centerY, r1, a0), q2 = polarPoint(centerX, centerY, r4, a0);
									const q3 = polarPoint(centerX, centerY, r4, a1), q4 = polarPoint(centerX, centerY, r1, a1);
									const on = sel === idx;
									els.push(<path key={`hit-${idx}`} d={`M${q1.x},${q1.y} L${q2.x},${q2.y} A${r4},${r4} 0 0 1 ${q3.x},${q3.y} L${q4.x},${q4.y} A${r1},${r1} 0 0 0 ${q1.x},${q1.y} Z`} fill={on ? 'var(--horosa-accent, #d7ad69)' : '#ffffff'} fillOpacity={on ? 0.12 : 0} stroke={on ? 'var(--horosa-accent, #d7ad69)' : 'none'} strokeWidth="1.5" style={{ cursor: 'pointer' }} onClick={() => props.onSelectPalace && props.onSelectPalace(on ? null : idx)} />);
								}
								if (sel !== null && sel >= 0) {
									const lp = LAYER3_BRANCH_GUA[sel], shen = LAYER4_FIXED[sel], isZ = sel % 2 === 0;
									const info = isZ ? TAIYI_GONG_INFO[ZN[lp]] : null;
									const zhu = (layer5[sel] || []).filter(Boolean);
									const gj = gejuList.filter((g) => POS[g.from] === lp || POS[g.to] === lp);
									const roles = Object.keys(POS).filter((k) => POS[k] === lp);
									const ln = [`${lp}·${shen}（${isZ ? '正宫' : '间神'}）${roles.length ? '  ←' + roles.join('/') : ''}`];
									const sm = shenMeaning(lp);
									if (sm) { ln.push(`主事:${sm}`); }
									if (info) { ln.push(`${ZN[lp]}${info.gua}·${info.men}·${info.zhou}·${info.qi}`); }
									if (zhu.length) { ln.push(`驻神:${zhu.join('、').slice(0, 22)}`); }
									if (gj.length) { ln.push(`格局:${gj.map((g) => g.name).join('、')}`); }
									// 弹窗锚到 viewBox 最底空白条(原 by=height-24-bh 偏上、压住盘面下半);下移到底部并贴左下角,
									// 圆盘在 860×720 里两侧/底部留白处停放,最大化减少对盘面的遮挡(点同宫可关闭)。
									const bw = 320, bh = ln.length * 20 + 16, bx = 10, by = height + VB_PAD_BOTTOM - bh - 4;
									els.push(<rect key="pp-bg" x={bx} y={by} width={bw} height={bh} rx="8" fill="var(--horosa-surface-raised, #16140f)" fillOpacity="0.96" stroke="var(--horosa-accent, #d7ad69)" strokeWidth="1.2" />);
									els.push(<text key="pp-tx" x={bx + 12} y={by + 20} fill="var(--horosa-text, #e8e2d2)" stroke="none" fontSize="14" fontFamily={TAIYI_FONT}>{ln.map((t, i) => <tspan key={i} x={bx + 12} dy={i === 0 ? 0 : 20}>{t}</tspan>)}</text>);
								}
								return els;
							})()}
						</svg>
					</div>
			</div>
		);
}
