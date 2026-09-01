// [择日概览·三式] 三式合一盘·实例无关共享渲染 —— 从 SanShiUnitedMain 机械迁出
// renderTop/renderMiddle/renderBottom 及五个子绘制(JSX 逐节点不变;this.state/props → props 解构,
// outerDataCache 单槽缓存 → useMemo 同语义)。主页经薄壳传实例态;择日概览浮窗自装 props
// (fetchChart + fetchQimenPan/normalizeKinqimenData + buildLiuRengLayout/buildKeData/buildSanChuan
// 全同源函数,零平行实现)。盘面样式/结构改这里(单源)。
// ⚠ 与 SanShiUnitedMain 互为 import(它 import 本组件,本文件 import 它的工具函数)——
// 全部是 function/const 声明的迟绑定引用,渲染时才取值,ESM/CJS 循环均安全;勿改成会在
// 模块求值期就执行的引用形态。
import React, { Fragment, useMemo } from 'react';
import styles from './SanShiUnitedMain.less';
import { buildLiuRengHouseTipObj, buildLiuRengShenTipObj } from '../liureng/LRShenJiangDoc';
import { buildQimenXiangTipObj } from '../dunjia/QimenXiangDoc';
import { isMeaningEnabled, wrapWithMeaning } from '../astro/AstroMeaningPopover';
import {
	safe, fmtDirect, fmtSolar, getChartYue, getOuterChartKey, buildOuterData,
	buildSanshiWeakSolid, computeSanshiXun, buildShenShaMap, buildPillarFromPan,
	buildOuterBranchMeaningTip, buildOuterHouseMeaningTip, buildOuterStarMeaningTip, clamp,
	fmtLunar, getGanzhiParts, getOuterLabelLayout, getOuterStarsLayout, padOuterStarsRow,
	shortTianJiang, splitGanZhi, toQimenMeaningTip,
	LIURENG_RING_LAYOUT, OUTER_RING_LAYOUT, QIMEN_CORNER_PALACES, QIMEN_RING_POSITIONS, WEAK_SOLID_POS,
} from './SanShiUnitedMain';

// props: { chartWrap, dunjia, lrLayout, keData, sanChuan, nongli, liureng, fields, displaySolarTime,
//          outerCoord?, showWeakSolid?, showAstroMeaning?, boardSize? }
export default function SanshiUnitedBoard(props){
	const { chartWrap, dunjia, lrLayout, keData, sanChuan, nongli, liureng, fields, displaySolarTime,
		showAstroMeaning } = props;
	const outerCoord = props.outerCoord || 'ecliptic';
	const showWeakSolid = props.showWeakSolid !== undefined ? props.showWeakSolid : true;
	const boardSize = props.boardSize || 720;
	const astroChartTop = chartWrap && chartWrap.chart ? chartWrap.chart : null;
	const outerChartKey = getOuterChartKey(chartWrap);
	// 单槽缓存同语义:chartKey/coord 变才重算
	const outerData = useMemo(()=>buildOuterData(astroChartTop, outerCoord), [outerChartKey, outerCoord]);

	function renderTop(boardSize){
		// nongli/liureng/dunjia/displaySolarTime 来自组件 props(解构见组件体)
		// fields 由薄壳按主页原分支(hasPlotted?plottedFields:activeFields)算好直供
		const solar = fmtSolar(fields, dunjia, nongli, displaySolarTime);
		const direct = fmtDirect(fields);
		const pillars = [
			{ label: '年', gz: buildPillarFromPan(dunjia, 'year') },
			{ label: '月', gz: buildPillarFromPan(dunjia, 'month') },
			{ label: '日', gz: buildPillarFromPan(dunjia, 'day') },
			{ label: '时', gz: buildPillarFromPan(dunjia, 'time') },
		];
		const chartWrapLocal = chartWrap;
		const astroChart = chartWrapLocal && chartWrapLocal.chart ? chartWrap.chart : null;
		const yuejiang = (liureng && liureng.yue) || getChartYue(astroChart) || '--';
		const nianming = (liureng && liureng.nianMing) || ((dunjia && dunjia.ganzhi && dunjia.ganzhi.year) ? dunjia.ganzhi.year.substring(1, 2) : '--');
		const shenShaMap = buildShenShaMap(dunjia);
		const names = ['驿马', '日德', '幕贵', '日禄', '天马', '破碎'];
		const values = [
			(dunjia && dunjia.yiMa && dunjia.yiMa.yimaZhi) ? dunjia.yiMa.yimaZhi : '—',
			safe(shenShaMap['日德'], '—'),
			safe(shenShaMap['幕贵'], '—'),
			safe(shenShaMap['日禄'], '—'),
			safe(shenShaMap['天马'], '—'),
			safe(shenShaMap['破碎'], '—'),
		];
		const dateText = direct.date || solar.date || '---- -- --';
		const directHm = direct.hm || '--:--';
		const solarHm = solar.hm || '--:--';
		const lunarText = (safe(nongli && nongli.month) + safe(nongli && nongli.day)) || fmtLunar(nongli) || '农历--';
		return (
			<div className={styles.topBox} style={{ width: boardSize, maxWidth: '100%' }}>
				<div className={styles.topLeft}>
					<div className={styles.datePanel}>
						<div className={styles.dateRow}>
							<div className={styles.dateLabel}>农历</div>
							<div className={styles.dateValue}>
								<span className={styles.dateMainText}>{lunarText}</span>
								<span className={styles.dateMetaText}>
									<span className={styles.dateMetaLabel}>直接时间</span>
									<span className={styles.dateMetaValue}>{directHm}</span>
								</span>
							</div>
						</div>
						<div className={styles.dateRow}>
							<div className={styles.dateLabel}>日期</div>
							<div className={styles.dateValue}>
								<span className={styles.dateMainText}>{dateText}</span>
								<span className={styles.dateMetaText}>
									<span className={styles.dateMetaLabel}>真太阳时</span>
									<span className={styles.dateMetaValue}>{solarHm}</span>
								</span>
							</div>
						</div>
					</div>

					<div className={styles.pillarArea}>
						<div className={styles.pillarLeft}>
							<div className={styles.pillarBlocks}>
								{pillars.map((item)=>{
									const parts = getGanzhiParts(item.gz);
									return (
										<div className={styles.pillarBox} key={`pillar_${item.label}`}>
											<div className={styles.pillarGan}>{parts.gan}</div>
											<div className={styles.pillarZhi}>{parts.zhi}</div>
										</div>
									);
								})}
							</div>
							<div className={styles.pillarTags}>
								{pillars.map((item)=>(
									<div key={`ptag_${item.label}`} className={styles.pillarTagDot}>{item.label}</div>
								))}
							</div>
						</div>
						<div className={styles.metaPairWrap}>
							<div className={styles.metaPair}>
								<div className={styles.metaTitle}>月将</div>
								<div className={styles.metaValue}>{yuejiang}</div>
							</div>
							<div className={styles.metaPair}>
								<div className={styles.metaTitle}>年命</div>
								<div className={styles.metaValue}>{nianming}</div>
							</div>
						</div>
					</div>
				</div>
				<div className={styles.ssBox}>
					<div className={styles.ssCol}>
						{names.map((n)=>(
							<div className={styles.ssItem} key={`ssn_${n}`}>{n}</div>
						))}
					</div>
					<div className={styles.ssCol}>
						{values.map((v, idx)=>(
							<div className={styles.ssValue} key={`ssv_${names[idx]}`}>{v}</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	function renderOuterMarks(outerData, midFont, boardSize){
		// 外圈文字按盘面尺寸连续缩放，避免在小窗口被最小字号“卡住”。
		const scale = clamp((boardSize || 600) / 600, 0.62, 1.35);
		const houseFont = clamp(Math.round(18 * scale), 10, 34);
		const branchFont = clamp(Math.round(17 * scale), 9, 32);
		const starFont = clamp(Math.round(16 * scale), 9, 30);
		const showMeaning = isMeaningEnabled(showAstroMeaning);
		// 七政四余式「虚实」红绿点(八字源:四柱地支定实/四柱旬空推虚);仅 showWeakSolid 开启时算,默认显示。
		const weakSolidMap = showWeakSolid ? buildSanshiWeakSolid(dunjia) : null;
		return OUTER_RING_LAYOUT.map((item)=>{
			const houses = outerData.housesByBranch[item.branch] || [];
			const stars = outerData.starsByBranch[item.branch] || [];
			const starsFull = outerData.starsByBranchFull && outerData.starsByBranchFull[item.branch]
				? outerData.starsByBranchFull[item.branch]
				: [];
			const starsMeta = outerData.starsByBranchMeta && Array.isArray(outerData.starsByBranchMeta[item.branch]) && outerData.starsByBranchMeta[item.branch].length
				? outerData.starsByBranchMeta[item.branch]
				: stars.map((txt, idx)=>({
					shortTxt: txt,
					fullTxt: starsFull[idx] || txt,
					objId: null,
				}));
			const starsLayout = getOuterStarsLayout(item.branch, starFont);
			const starRows = [];
			for(let i=0; i<starsMeta.length; i += starsLayout.perRow){
				const row = starsMeta.slice(i, i + starsLayout.perRow);
				const paddedRow = padOuterStarsRow(row, starsLayout.perRow, starsLayout.rowJustify);
				starRows.push(paddedRow);
			}
			const houseTxt = houses.length ? houses.join('/') : '';
			const houseMeaning = buildOuterHouseMeaningTip(houses);
			const labelLayout = getOuterLabelLayout(item.branch, houseFont);
			const branchMeaning = buildOuterBranchMeaningTip(item.branch);
			return (
				<div
					key={`outer_${item.branch}`}
					className={`${styles.outerCell} ${styles[`outerCell_${item.side}`]}`}
					style={{
						left: `${item.x0}%`,
						top: `${item.y0}%`,
						width: `${item.x1 - item.x0}%`,
						height: `${item.y1 - item.y0}%`,
					}}
				>
					{wrapWithMeaning(
						<span
							className={`${styles.outerLabel} ${styles.outerHouse}`}
							data-meaning-placement="top"
							style={{
								fontSize: houseFont,
								lineHeight: `${houseFont}px`,
								...labelLayout.house,
							}}
						>
							{houseTxt}
						</span>,
						showMeaning,
						houseMeaning
					)}
					{wrapWithMeaning(
						<span
							className={`${styles.outerLabel} ${styles.outerBranch}`}
							data-meaning-placement="top"
							style={{
								fontSize: branchFont,
								lineHeight: `${branchFont}px`,
								...labelLayout.branch,
							}}
						>
							{item.branch}
						</span>,
						showMeaning,
						branchMeaning
					)}
						{(()=>{
							// 虚实红绿点:贴该地支宫格「朝盘心」一侧逐宫定位(WEAK_SOLID_POS);红=虚/绿=实,色同七政四余。
							const ws = weakSolidMap && weakSolidMap[item.branch];
							if(!ws || (!ws.weak && !ws.solid)){ return null; }
							const dotR = clamp(Math.round(4.5 * scale), 4, 8);
							const dots = [];
							if(ws.solid){ dots.push({ k: 'solid', c: 'var(--moira-green, #008000)', t: `实${ws.solidPillars.join('')}` }); }
							if(ws.weak){ dots.push({ k: 'weak', c: 'var(--moira-red, #ff0000)', t: `虚${ws.weakPillars.join('')}` }); }
							return (
								<span className={styles.outerWeakSolid} style={WEAK_SOLID_POS[item.branch] || { top: 2, right: 3 }} title={dots.map((d)=>d.t).join(' ')}>
									{dots.map((d)=>(<i key={d.k} className={styles.outerWeakSolidDot} style={{ width: dotR, height: dotR, background: d.c }} />))}
								</span>
							);
						})()}
						{starsMeta.length ? (
							<div
								className={styles.outerStars}
								style={{
									fontSize: starFont,
									lineHeight: `${Math.round(starFont * 1.12)}px`,
									...starsLayout.style,
								}}
							>
								{starRows.map((row, idx)=>(
									<div
										key={`outer_star_row_${item.branch}_${idx}`}
										className={styles.outerStarsRow}
										style={{ justifyContent: starsLayout.rowJustify }}
									>
											{row.map((star, rowIdx)=>(
												star
													? (
														<span key={`outer_star_wrap_${item.branch}_${idx}_${rowIdx}`}>
															{wrapWithMeaning(
																<span
																	className={styles.outerStarItem}
																	data-meaning-placement="top"
																	style={{ fontSize: starFont, lineHeight: `${Math.round(starFont * 1.12)}px` }}
																>
																	{safe(star.shortTxt, '')}
																</span>,
																showMeaning,
																buildOuterStarMeaningTip(star)
															)}
														</span>
													)
													: (
														<span
															key={`outer_star_pad_${item.branch}_${idx}_${rowIdx}`}
															className={`${styles.outerStarItem} ${styles.outerStarPlaceholder}`}
															style={{ fontSize: starFont, lineHeight: `${Math.round(starFont * 1.12)}px` }}
														>
															占位
														</span>
													)
											))}
										</div>
									))}
							</div>
						) : null}
					</div>
			);
		});
	}

	function renderLiuRengMarks(layout, midFont, boardSize){
		if(!layout || !layout.downZi || !layout.upZi || !layout.houseTianJiang){
			return null;
		}
		const showMeaning = isMeaningEnabled(showAstroMeaning);
		const scale = clamp((boardSize || 600) / 600, 0.62, 1.35);
		return layout.downZi.map((branch, idx)=>{
			const pos = LIURENG_RING_LAYOUT[branch];
			if(!pos){
				return null;
			}
			const up = layout.upZi[idx] || '';
			const jiang = layout.houseTianJiang[idx] || '';
			const god = shortTianJiang(layout.houseTianJiang[idx] || '');
			const shenTip = buildLiuRengShenTipObj(up);
			const jiangTip = buildLiuRengHouseTipObj(jiang, up, branch);
			const isCardinal = pos.kind === 'cardinal';
			// 六壬圈字体随盘面连续缩放：四正位略大于角位。
			const font = isCardinal
				? clamp(Math.round(20 * scale), 10, 36)
				: clamp(Math.round(18 * scale), 9, 34);
			if(!isCardinal){
				const leftNum = parseFloat(`${pos.left}`) || 50;
				const topNum = parseFloat(`${pos.top}`) || 50;
				const dx = leftNum - 50;
				const dy = topNum - 50;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const ux = dx / len;
				const uy = dy / len;
				// 角三角：地支远离中心，神将靠近中心；使用径向分离保证可读。
				// outerShift 由 3.1 调小到 2.0(仅此一处改动):重心到两条直角边各约 3.7%,
				// 原值外推后只剩 0.6%≈4.7px,而角位字半宽约 10.5px ⇒ 字压出外框(用户实圈)。
				// 调小后余量 1.7%≈13.2px,字不再压框;与神将的分离仍有 4.5%≈35px(字宽 21px)，不叠字。
				const outerShift = 2.0;
				const innerShift = 2.5;
				const ziLeft = `${leftNum + (ux * outerShift)}%`;
				const ziTop = `${topNum + (uy * outerShift)}%`;
				const godLeft = `${leftNum - (ux * innerShift)}%`;
				const godTop = `${topNum - (uy * innerShift)}%`;
				return [
					<Fragment key={`lr_zi_wrap_${branch}_${idx}`}>
						{wrapWithMeaning(
							<div
								className={`${styles.lrMark} ${styles.lrMarkZiItem}`}
								data-meaning-placement="top"
								style={{
									left: ziLeft,
									top: ziTop,
									fontSize: font,
									lineHeight: `${font}px`,
									transform: 'translate(-50%, -50%)',
								}}
							>
								{up}
							</div>,
							showMeaning,
							shenTip
						)}
					</Fragment>,
					<Fragment key={`lr_god_wrap_${branch}_${idx}`}>
						{wrapWithMeaning(
							<div
								className={`${styles.lrMark} ${styles.lrMarkGodItem}`}
								data-meaning-placement="top"
								style={{
									left: godLeft,
									top: godTop,
									fontSize: font,
									lineHeight: `${font}px`,
									transform: 'translate(-50%, -50%)',
								}}
							>
								{god}
							</div>,
							showMeaning,
							jiangTip
						)}
					</Fragment>,
				];
			}
			const leftNum = parseFloat(`${pos.left}`) || 50;
			const topNum = parseFloat(`${pos.top}`) || 50;
			const dx = leftNum - 50;
			const dy = topNum - 50;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			const tx = -uy;
			const ty = ux;
			// 规则：地支始终远离中心，神将始终靠近中心；二者分开独立定位。
			const outerShift = isCardinal
				? Math.max(12, Math.round(font * 0.66))
				: Math.max(12, Math.round(font * 0.68));
			const innerShift = isCardinal
				? Math.max(10, Math.round(font * 0.54))
				: Math.max(9, Math.round(font * 0.54));
			const tangentShift = isCardinal ? 0 : Math.max(6, Math.round(font * 0.38));
			const ziShiftX = Math.round((ux * outerShift) + (tx * tangentShift));
			const ziShiftY = Math.round((uy * outerShift) + (ty * tangentShift));
			const godShiftX = Math.round((-ux * innerShift) - (tx * tangentShift));
			const godShiftY = Math.round((-uy * innerShift) - (ty * tangentShift));
			const ziTransform = `translate(calc(-50% + ${ziShiftX}px), calc(-50% + ${ziShiftY}px))`;
			const godTransform = `translate(calc(-50% + ${godShiftX}px), calc(-50% + ${godShiftY}px))`;
			return [
				<Fragment key={`lr_zi_wrap_${branch}_${idx}`}>
					{wrapWithMeaning(
						<div
							className={`${styles.lrMark} ${styles.lrMarkZiItem}`}
							data-meaning-placement="top"
							style={{
								left: pos.left,
								top: pos.top,
								fontSize: font,
								lineHeight: `${font}px`,
								transform: ziTransform,
							}}
						>
							{up}
						</div>,
						showMeaning,
						shenTip
					)}
				</Fragment>,
				<Fragment key={`lr_god_wrap_${branch}_${idx}`}>
					{wrapWithMeaning(
						<div
							className={`${styles.lrMark} ${styles.lrMarkGodItem}`}
							data-meaning-placement="top"
							style={{
								left: pos.left,
								top: pos.top,
								fontSize: font,
								lineHeight: `${font}px`,
								transform: godTransform,
							}}
						>
							{god}
						</div>,
						showMeaning,
						jiangTip
					)}
				</Fragment>,
			];
		});
	}

	function renderQimenBlock(palaceNum, qimenMap, midFont, boardSize){
		const cell = qimenMap[palaceNum] || {};
		const pos = QIMEN_RING_POSITIONS[palaceNum];
		if(!pos){
			return null;
		}
		// 以宫格可用空间为准缩放，优先避免门框压住四角干神星。
		const size = boardSize || 600;
		const qScale = clamp(size / 600, 0.62, 1.28);
		const ringCellPx = size * 0.111;
		const qimenFont = clamp(Math.round(19 * qScale), 10, 28);
		const doorMaxByCell = Math.round(ringCellPx * 0.34);
		const doorSize = clamp(Math.round(22 * qScale), 9, doorMaxByCell);
		const doorFont = clamp(Math.round(doorSize * 0.68), 8, Math.max(8, doorSize - 4));
		const doorBorder = clamp(Math.round(1.1 * qScale * 10) / 10, 0.8, 1.6);
		const isCorner = QIMEN_CORNER_PALACES.has(palaceNum);
		const showMeaning = isMeaningEnabled(showAstroMeaning);
		const tianGanTip = toQimenMeaningTip(buildQimenXiangTipObj('stem', safe(cell.tianGan, '')));
		const godTip = toQimenMeaningTip(buildQimenXiangTipObj('god', safe(cell.god, '')));
		const diGanTip = toQimenMeaningTip(buildQimenXiangTipObj('stem', safe(cell.diGan, '')));
		const starTip = toQimenMeaningTip(buildQimenXiangTipObj('star', safe(cell.tianXing, '')));
		const doorTip = toQimenMeaningTip(buildQimenXiangTipObj('door', safe(cell.door, '')));
		return (
			<div
				key={`qm_${palaceNum}`}
				className={`${styles.qmBlock}${isCorner ? ` ${styles.qmBlockCorner}` : ''}`}
				style={{ left: pos.left, top: pos.top }}
			>
				<div className={styles.qmRingCell} />
				{wrapWithMeaning(
					<div className={styles.qmTianGan} data-meaning-placement="top" style={{ fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.tianGan, ' ')}</div>,
					showMeaning,
					tianGanTip
				)}
				{wrapWithMeaning(
					<div className={styles.qmGod} data-meaning-placement="top" style={{ fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.god, ' ')}</div>,
					showMeaning,
					godTip
				)}
				{wrapWithMeaning(
					<div className={styles.qmDiGan} data-meaning-placement="top" style={{ fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.diGan, ' ')}</div>,
					showMeaning,
					diGanTip
				)}
				{wrapWithMeaning(
					<div className={styles.qmStar} data-meaning-placement="top" style={{ fontSize: qimenFont, lineHeight: `${qimenFont}px`, ...(cell.isJinhan && cell.jinhanStarJi ? { color: cell.jinhanStarJi === '吉' ? '#c41e28' : (cell.jinhanStarJi === '凶' ? 'var(--horosa-text, #1f1f1f)' : 'var(--horosa-muted, #8c8c8c)') } : {}) }}>{safe(cell.tianXing, ' ')}</div>,
					showMeaning,
					starTip
				)}
				{wrapWithMeaning(
					<div
						className={styles.qmDoorBox}
						data-meaning-placement="top"
						style={{ width: doorSize, height: doorSize, borderWidth: doorBorder }}
					>
						<div className={styles.qmDoor} style={{ fontSize: doorFont, lineHeight: `${doorFont}px` }}>{safe(cell.door, ' ')}</div>
					</div>,
					showMeaning,
					doorTip
				)}
				{cell.anGan ? (
					<div style={{ position: 'absolute', right: 4, top: 2, fontSize: Math.max(10, Math.round(qimenFont * 0.55)), lineHeight: '1.2', color: 'var(--horosa-text-soft, #8c6a3f)' }}>
						{cell.anGan}{cell.anZhi || ''}
					</div>
				) : null}
			</div>
		);
	}

	function renderCenterBlock(midFont, boardSize){
		const keRaw = keData && Array.isArray(keData.raw) ? keData.raw : [];
		const lrLayout = lrLayout || {};
		const upZi = Array.isArray(lrLayout.upZi) ? lrLayout.upZi : [];
		const downZi = Array.isArray(lrLayout.downZi) ? lrLayout.downZi : [];
		const getDiByUp = (up)=>{
			const idx = upZi.indexOf(`${up || ''}`);
			if(idx < 0){
				return '';
			}
			return downZi[idx] || '';
		};
		// 中宫四课按用户习惯固定为：从左到右 四、三、二、一。
		const keOrder = [
			{ idx: 3, label: '四课' },
			{ idx: 2, label: '三课' },
			{ idx: 1, label: '二课' },
			{ idx: 0, label: '一课' },
		];
		const keCols = keOrder.map((one)=>{
			const item = keRaw[one.idx] || [];
			const zhi = safe(item[1], '—');
			const godRaw = safe(item[0], '');
			const di = getDiByUp(zhi);
			return {
				label: one.label,
				// 两层天干上下位置互换（上层取 item[1]，下层取 item[2]）。
				main1: zhi,
				main2: safe(item[2], '—'),
				god: shortTianJiang(godRaw),
				shenTip: buildLiuRengShenTipObj(zhi),
				jiangTip: buildLiuRengHouseTipObj(godRaw, zhi, di || zhi),
			};
		});
		const chuan = sanChuan;
		const chuanLabels = ['初传', '中传', '末传'];
		const chuanRows = [0, 1, 2].map((idx)=>{
			const gz = chuan && chuan.cuang ? safe(chuan.cuang[idx], '') : '';
			const parsed = splitGanZhi(gz);
			const godRaw = chuan && chuan.tianJiang ? safe(chuan.tianJiang[idx], '') : '';
			const di = getDiByUp(parsed.zhi);
			return {
				label: chuanLabels[idx],
				gan: parsed.gan,
				zhi: parsed.zhi,
				god: shortTianJiang(godRaw),
				shenTip: buildLiuRengShenTipObj(parsed.zhi),
				jiangTip: buildLiuRengHouseTipObj(godRaw, parsed.zhi, di || parsed.zhi),
			};
		});
		const showMeaning = isMeaningEnabled(showAstroMeaning);
		const edgePad = 2;
		const centerPx = Math.max(140, Math.round((boardSize || 500) * 0.334));
		const availableH = Math.max(90, centerPx - edgePad * 2);
		const centerScale = clamp((boardSize || 600) / 600, 0.62, 1.35);
		// 目标：四课(3行) + 三传(3行) 统一字号，并占中宫约85%可用高度，避免缩放时过挤。
		const targetTextH = Math.max(72, Math.round(availableH * 0.85));
		const linePx = clamp(Math.round(targetTextH / 6), 12, 52);
		const sectionH = linePx * 3;
		const txtSize = clamp(Math.min(Math.round(linePx * 0.95), Math.round(30 * centerScale)), 11, 46);
		return (
			<div key="qm_center" className={`${styles.qmBlock} ${styles.qmCenter}`} style={{ left: '50%', top: '50%' }}>
				<div
					className={styles.centerKe}
					style={{
						fontSize: txtSize,
						lineHeight: `${linePx}px`,
						top: edgePad,
						height: sectionH,
					}}
				>
					{keCols.map((col, idx)=>(
						<div key={`ke_col_${idx}`} className={styles.centerKeCol} style={{ height: sectionH }}>
							{wrapWithMeaning(
								<div className={styles.centerKeGray} data-meaning-placement="top">{col.god}</div>,
								showMeaning,
								col.jiangTip
							)}
							{wrapWithMeaning(
								<div className={styles.centerKeMain} data-meaning-placement="top">{col.main1}</div>,
								showMeaning,
								col.shenTip
							)}
							<div className={styles.centerKeMain}>{col.main2}</div>
						</div>
					))}
				</div>
				<div
					className={styles.centerChuan}
					style={{
						fontSize: txtSize,
						lineHeight: `${linePx}px`,
						bottom: edgePad,
						height: sectionH,
					}}
				>
					{chuanRows.map((row, idx)=>(
						<div key={`chuan_row_${idx}`} className={styles.centerChuanRow}>
							<span className={styles.centerChuanGray}>{row.gan || ''}</span>
							{wrapWithMeaning(
								<span className={styles.centerChuanMain} data-meaning-placement="top">{row.zhi}</span>,
								showMeaning,
								row.shenTip
							)}
							{wrapWithMeaning(
								<span className={styles.centerChuanGray} data-meaning-placement="top">{row.god}</span>,
								showMeaning,
								row.jiangTip
							)}
						</div>
					))}
				</div>
			</div>
		);
	}

	function renderBoardSvg(){
		return (
			<svg className={styles.boardSvg} viewBox="0 0 1000 1000" preserveAspectRatio="none">
				<rect x="0" y="0" width="1000" height="1000" className={styles.fillOuterRing} />
				<rect x="111" y="111" width="778" height="778" className={styles.fillQimenRing} />
				<rect x="222" y="222" width="556" height="556" className={styles.fillLiurengRing} />
				<rect x="333.33" y="333.33" width="333.34" height="333.34" className={styles.fillCenter} />

				<rect x="1" y="1" width="998" height="998" className={styles.strokeMain} />
				<line x1="333.33" y1="0" x2="333.33" y2="1000" className={styles.strokeMain} />
				<line x1="666.67" y1="0" x2="666.67" y2="1000" className={styles.strokeMain} />
				<line x1="0" y1="333.33" x2="1000" y2="333.33" className={styles.strokeMain} />
				<line x1="0" y1="666.67" x2="1000" y2="666.67" className={styles.strokeMain} />

				<rect x="111" y="111" width="778" height="778" className={styles.strokeSub} />
				<rect x="222" y="222" width="556" height="556" className={styles.strokeSub} />
				<rect x="333.33" y="333.33" width="333.34" height="333.34" className={styles.strokeSub} />

					<line x1="0" y1="0" x2="111" y2="111" className={styles.strokeMain} />
					<line x1="1000" y1="0" x2="889" y2="111" className={styles.strokeMain} />
					<line x1="0" y1="1000" x2="111" y2="889" className={styles.strokeMain} />
					<line x1="1000" y1="1000" x2="889" y2="889" className={styles.strokeMain} />

					<line x1="111" y1="111" x2="222" y2="222" className={styles.strokeMain} />
					<line x1="889" y1="111" x2="778" y2="222" className={styles.strokeMain} />
					<line x1="111" y1="889" x2="222" y2="778" className={styles.strokeMain} />
					<line x1="889" y1="889" x2="778" y2="778" className={styles.strokeMain} />

					<line x1="222" y1="222" x2="333.33" y2="333.33" className={styles.strokeMain} />
					<line x1="778" y1="222" x2="666.67" y2="333.33" className={styles.strokeMain} />
					<line x1="222" y1="778" x2="333.33" y2="666.67" className={styles.strokeMain} />
					<line x1="778" y1="778" x2="666.67" y2="666.67" className={styles.strokeMain} />

				<line x1="333.33" y1="222" x2="333.33" y2="333.33" className={styles.strokeSub} />
				<line x1="666.67" y1="222" x2="666.67" y2="333.33" className={styles.strokeSub} />

				<line x1="333.33" y1="666.67" x2="333.33" y2="778" className={styles.strokeSub} />
				<line x1="666.67" y1="666.67" x2="666.67" y2="778" className={styles.strokeSub} />

				<line x1="222" y1="333.33" x2="333.33" y2="333.33" className={styles.strokeSub} />
				<line x1="222" y1="666.67" x2="333.33" y2="666.67" className={styles.strokeSub} />

				<line x1="666.67" y1="333.33" x2="778" y2="333.33" className={styles.strokeSub} />
				<line x1="666.67" y1="666.67" x2="778" y2="666.67" className={styles.strokeSub} />
			</svg>
		);
	}

	function renderMiddle(boardSize){
		const chartWrapLocal = chartWrap;
		const astroChart = chartWrapLocal && chartWrapLocal.chart ? chartWrap.chart : null;
		const outerChartKey = getOuterChartKey(chartWrap);
		// outerData 缓存改由组件体 useMemo(chartKey+coord)承担 —— 语义同单槽缓存
		const midFont = Math.max(10, Math.round(boardSize * 0.018));
		const qimenMap = {};
		if(dunjia && dunjia.cells){
			dunjia.cells.forEach((c)=>{
				qimenMap[c.palaceNum] = c;
			});
		}
		const qmBlocks = [1, 2, 3, 4, 6, 7, 8, 9].map((num)=>renderQimenBlock(num, qimenMap, midFont, boardSize));
		return (
			<div className={styles.middleWrap} style={{ width: boardSize, maxWidth: '100%' }}>
				<div className={styles.middleBoard} style={{ width: boardSize, height: boardSize }}>
					{renderBoardSvg()}
					<div className={styles.boardLayer}>
						{renderOuterMarks(outerData, midFont, boardSize)}
						{renderLiuRengMarks(lrLayout, midFont, boardSize)}
						{qmBlocks}
						{renderCenterBlock(midFont, boardSize)}
					</div>
				</div>
			</div>
		);
	}

	function renderBottom(boardSize){
		const pan = dunjia;
		// 旬字段统一走 computeSanshiXun(与概览/快照单一来源):本旬=日柱旬 / 旬仪=时柱旬首+六仪 /
		// 旬空=日空 / 时空=时柱旬空。避免 normalizeKinqimenData 把 xunShou/fuTou 覆盖成六仪、及繁简键失配。
		const { benXun: xun, xunYi: futo, riKong: kong, shiKong: shikong } = computeSanshiXun(pan);
		const dunType = safe(pan && pan.yinYangDun, '—');
		const dunJu = pan && pan.juShu !== undefined && pan.juShu !== null ? `${pan.juShu}局` : '—';
		return (
			<div className={styles.bottomBox} style={{ width: boardSize, maxWidth: '100%' }}>
				<div className={styles.bottomGrid}>
					<div className={styles.bottomCell}><span>本旬</span><b>{xun}</b></div>
					<div className={styles.bottomCell}><span>旬仪</span><b>{futo}</b></div>
					<div className={styles.bottomCell}><span>旬空</span><b>{kong}</b></div>
					<div className={styles.bottomCell}><span>时空</span><b>{shikong}</b></div>
				</div>
				<div className={styles.bottomRight}>
					<div>{dunType}</div>
					<div>{dunJu}</div>
				</div>
			</div>
		);
	}
	return (
		// fitContent(概览浮窗用):boardStack 的 height:100%+overflow:hidden 是主页定高栏语境;
		// 自然流容器里会压缩内容并裁掉底条(真机实抓 stack 853/内容 885)——内联覆盖,主页不传=零回归。
		<div className={styles.boardStack} style={props.fitContent ? { height: 'auto', overflow: 'visible' } : undefined}>
			{renderTop(boardSize)}
			{renderMiddle(boardSize)}
			{renderBottom(boardSize)}
		</div>
	);
}
