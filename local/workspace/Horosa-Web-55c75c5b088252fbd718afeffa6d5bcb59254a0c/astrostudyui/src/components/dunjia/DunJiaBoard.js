import { Component } from 'react';
import { Popover } from 'antd';
import { BaZiColor, ZhiColor } from '../../msg/bazimsg';
import sealedImage from '../../assets/sealed.png';
import { buildQimenXiangTipObj, formatQimenDocLineToHtml } from './QimenXiangDoc';
import { chartSCUEnabled } from '../../utils/perfFlags';
import { shallowPropsEqual } from '../../utils/chartUpdateGuard';

// 遁甲盘子组件(根因 E/fan-out):此前 DunJiaMain.renderBoard 把九宫×每宫约5个 Popover(共 ~45 个)+ 表头悬浮
// 全部内联在父 render 里。父任意 setState(切盘类/开传本设置 Modal/右栏状态/起盘 loading…)→ 整个父重渲 →
// 这 45 个 Popover 全部重建(antd Popover 重挂开销不小)→「越用越卡」。
// 抽成独立 PureComponent-式子组件 + shouldComponentUpdate:盘面输出只取 (pan, boardScale) 两项 props,
//   逐项相等 → 跳过本次冗余 re-render;任一变 → 照常重渲。**只跳冗余、绝不漏渲**:
//   pan 是后端每次起盘返回的新对象(任何参数/数据变更都改其引用),boardScale 是标量,引用/值比既完整又廉价。
// 渲染内容与原 renderBoard 逐字一致(仅 this.state.pan→this.props.pan、this.calcBoardScale()→this.props.boardScale),
// 故 byte-perfect 零回归。kill-switch:localStorage horosa.perf.chartSCU=0 后刷新 → sCU 永真 = 回到每次重渲旧行为。
// 注:本组件内 4 个渲染辅助(renderQimenDocPopover/renderQimenHoverNode/renderQimenHoverInline/renderCell)与
// 表头小工具(safe/parseDisplayDateHm/getBaZiStemColor/...)均为「纯」:只读入参与模块级常量,不读任何实例状态,
// 故自带一份拷贝(与 DunJiaMain 右栏所用同口径),避免与父组件互相 import 形成环依赖,且本盘改动可独立回退。

const DUNJIA_BOARD_BASE_HEIGHT = 870;

const DUNJIA_LEGEND_ITEMS = [
	{ key: 'jixing', label: '击刑', color: '#cf1322', bg: 'rgba(207, 19, 34, 0.10)' },
	{ key: 'rumu', label: '入墓', color: '#8b5e3c', bg: 'rgba(139, 94, 60, 0.12)' },
	{ key: 'both', label: '击刑+入墓', color: '#722ed1', bg: 'rgba(114, 46, 209, 0.10)' },
	{ key: 'menpo', label: '门迫', color: '#fa8c16', bg: 'rgba(250, 140, 22, 0.12)' },
	{ key: 'kongwang', label: '空亡', color: '#2f54eb', bg: 'rgba(47, 84, 235, 0.10)' },
	{ key: 'yima', label: '🐎 驿马', color: 'var(--horosa-text, #262626)', bg: 'rgba(140, 140, 140, 0.10)' },
];

const GAN_COLOR_MAP = {
	甲: BaZiColor.PositiveWood,
	乙: BaZiColor.NegativeWood,
	丙: BaZiColor.PositiveFire,
	丁: BaZiColor.NegativeFire,
	戊: BaZiColor.PositiveEarth,
	己: BaZiColor.NegativeEarth,
	庚: BaZiColor.PositiveMetal,
	辛: BaZiColor.NegativeMetal,
	壬: BaZiColor.PositiveWater,
	癸: BaZiColor.NegativeWater,
};

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

function getBaZiStemColor(stem){
	return GAN_COLOR_MAP[safe(stem, '')] || 'var(--horosa-text, #333333)';
}

function getBaZiBranchColor(branch){
	return ZhiColor[safe(branch, '')] || 'var(--horosa-text, #333333)';
}

function parseDisplayDateHm(rawText){
	const text = `${safe(rawText, '')}`.trim();
	if(!text){
		return null;
	}
	const normalized = text.replace('T', ' ').replace('Z', ' ').trim();
	const dateMatch = normalized.match(/([-+]?\d{1,6})[/-](\d{1,2})[/-](\d{1,2})/);
	const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
	if(!dateMatch && !timeMatch){
		return null;
	}
	const yyyy = dateMatch ? `${dateMatch[1]}` : '';
	const mm = dateMatch ? `${dateMatch[2]}`.padStart(2, '0') : '';
	const dd = dateMatch ? `${dateMatch[3]}`.padStart(2, '0') : '';
	const hh = timeMatch ? `${timeMatch[1]}`.padStart(2, '0') : '';
	return {
		date: yyyy ? `${yyyy}年${mm}月${dd}日` : '',
		hm: timeMatch ? `${hh}:${timeMatch[2]}` : '',
	};
}

function getBoardTimeInfo(pan){
	const solar = parseDisplayDateHm(pan && pan.realSunTime);
	const direct = parseDisplayDateHm(`${safe(pan && pan.dateStr, '')} ${safe(pan && pan.timeStr, '')}`);
	const clockDate = safe(direct && direct.date, '');
	const clockHm = safe(direct && direct.hm, '') || (safe(pan && pan.timeStr, '').length >= 5 ? safe(pan && pan.timeStr, '').substr(0, 5) : '--:--');
	if(solar && (solar.date || solar.hm)){
		return {
			dateText: solar.date || clockDate || '日期--',
			clockHm,
			solarHm: solar.hm || '--:--',
		};
	}
	if(clockDate || clockHm){
		return {
			dateText: clockDate || '日期--',
			clockHm,
			solarHm: clockHm,
		};
	}
	return {
		dateText: '时间--',
		clockHm: '--:--',
		solarHm: '--:--',
	};
}

const DUNJIA_BOARD_SCU_KEYS = ['pan', 'boardScale'];

class DunJiaBoard extends Component{
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true; // kill-switch:回到无条件重渲
		}
		return !shallowPropsEqual(this.props, nextProps, DUNJIA_BOARD_SCU_KEYS);
	}

	// [H-B] 词条标题按「全名档」补类别后缀(星/门/神);title 已含该字则不重复。
	tipTitleOf(tipObj){
		if(!tipObj){ return ''; }
		const full = !!(this.props.pan && this.props.pan.options && this.props.pan.options.fullNameTips);
		if(!full){ return tipObj.title; }
		const sfx = tipObj.type === 'star' ? '星' : (tipObj.type === 'door' ? '门' : (tipObj.type === 'god' ? '神' : ''));
		const t = String(tipObj.title || '');
		return sfx && !t.endsWith(sfx) ? t + sfx : t;
	}

	renderQimenDocPopover(tipObj){
		if(!tipObj){
			return null;
		}
		const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
		return (
			<div style={{ maxWidth: 560, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
				<div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, color: 'var(--horosa-text, #1f1f1f)' }}>
					{this.tipTitleOf(tipObj)}
				</div>
				<div style={{ borderTop: '1px solid var(--horosa-border, #d9d9d9)', margin: '6px 0 8px' }} />
				{blocks.map((block, idx)=>{
					if(!block){
						return null;
					}
					if(block.type === 'blank'){
						return <div key={`qimen_doc_blank_${idx}`} style={{ height: 6 }} />;
					}
					if(block.type === 'divider'){
						return <div key={`qimen_doc_divider_${idx}`} style={{ borderTop: '1px solid var(--horosa-border, #e8e8e8)', margin: '6px 0' }} />;
					}
					if(block.type === 'subTitle'){
						return (
							<div key={`qimen_doc_subtitle_${idx}`} style={{ margin: '4px 0 6px' }}>
								<div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #262626)' }}>{block.text}</div>
								<div style={{ borderTop: '1px solid var(--horosa-border, #efefef)', marginTop: 4 }} />
							</div>
						);
					}
					const html = formatQimenDocLineToHtml(block.text || '');
					return (
						<div
							key={`qimen_doc_text_${idx}`}
							style={{ fontSize: 13, lineHeight: '21px', color: 'var(--horosa-text, #262626)', whiteSpace: 'pre-wrap' }}
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					);
				})}
			</div>
		);
	}

	renderQimenHoverNode(type, text, style, key){
		const raw = `${text || ''}`.trim();
		const tipObj = buildQimenXiangTipObj(type, raw);
		const node = (
			<div key={key} style={{ ...style, cursor: tipObj ? 'help' : 'default' }}>
				{text || ' '}
			</div>
		);
		if(!tipObj){
			return node;
		}
		return (
			<Popover
				key={`${key}_popover`}
				trigger="hover"
				placement="bottomLeft"
				content={this.renderQimenDocPopover(tipObj)}
				overlayStyle={{ maxWidth: 600 }}
			>
				{node}
			</Popover>
		);
	}

	// ⑥ 行内悬浮:把与盘面同款的奇门象意 hover 套到 header 行内元素(年月日时天干 / 值符=九星 / 值使=八门),不破坏行内排版。
	renderQimenHoverInline(type, text, child, key){
		const tipObj = buildQimenXiangTipObj(type, `${text || ''}`.trim());
		if(!tipObj){
			return child;
		}
		return (
			<Popover
				key={key}
				trigger="hover"
				placement="bottom"
				content={this.renderQimenDocPopover(tipObj)}
				overlayStyle={{ maxWidth: 600 }}
			>
				<span style={{ cursor: 'help' }}>{child}</span>
			</Popover>
		);
	}

	// [H-G] 古籍金函系日家格:正方宫格,门(上)+星(下)大字竖排(书表行序),按书定吉凶着色(吉红/凶墨/平灰);
	//   左上=方位·卦名,右下=卦名+洛书宫号,喜神/大吉徽章;中宫=本干支之星。
	renderJinhanCell(cell){
		const jiColor = (ji)=>ji === '吉' ? '#c41e28' : (ji === '凶' ? 'var(--horosa-text, #1f1f1f)' : 'var(--horosa-muted, #9c9c9c)');
		const LUOSHU_CN = { 坎: '一', 坤: '二', 震: '三', 巽: '四', 中: '五', 乾: '六', 兑: '七', 艮: '八', 离: '九' };
		const chip = (text, top)=>(
			<div style={{ position: 'absolute', top, right: 8, fontSize: 12, lineHeight: '18px', padding: '0 7px', borderRadius: 9, color: '#c41e28', background: 'rgba(196, 30, 40, 0.08)', border: '1px solid rgba(196, 30, 40, 0.35)' }}>{text}</div>
		);
		return (
			<div key={`cell_${cell.palaceNum}`} className="horosa-dunjia-cell" style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid var(--horosa-border, #d9d9d9)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: cell.isCenter ? 'var(--horosa-bg-soft, rgba(140, 140, 140, 0.05))' : 'transparent' }}>
				<div style={{ position: 'absolute', top: 7, left: 9, fontSize: 13, lineHeight: '17px', color: 'var(--horosa-muted, #8c8c8c)' }}>
					{cell.isCenter ? '中宫' : cell.jinhanDir}
				</div>
				{cell.isXiShen ? chip('喜神', 7) : null}
				{cell.isDaJi ? chip('大吉', cell.isXiShen ? 29 : 7) : null}
				{cell.isCenter ? null : (
					<div style={{ fontSize: 40, lineHeight: '46px', fontWeight: 700, letterSpacing: 2, color: jiColor(cell.jinhanDoorJi) }}>{cell.door}门</div>
				)}
				<div style={{ fontSize: 40, lineHeight: '46px', fontWeight: 700, letterSpacing: 2, color: jiColor(cell.jinhanStarJi) }}>{cell.tianXing}</div>
				<div style={{ position: 'absolute', bottom: 7, right: 9, fontSize: 13, lineHeight: '17px', color: 'var(--horosa-muted, #8c8c8c)' }}>
					{cell.isCenter ? '中五' : `${cell.palaceName}${LUOSHU_CN[cell.palaceName] || ''}`}
				</div>
			</div>
		);
	}

	renderCell(cell){
		if(cell && cell.isJinhan){ return this.renderJinhanCell(cell); }
		const titleColor = cell.hasKongWang
			? '#2f54eb'
			: (cell.isCenter ? 'var(--horosa-muted, #c7c7c7)' : 'var(--horosa-text-soft, #5f5f5f)');
		let tianGanColor = 'var(--horosa-text, #262626)';
		if(cell.hasJiXing && cell.hasRuMu){
			tianGanColor = '#722ed1';
		}else if(cell.hasJiXing){
			tianGanColor = '#cf1322';
		}else if(cell.hasRuMu){
			tianGanColor = '#8b5e3c';
		}
		// 八神不跟随值符或天盘干状态染色，保持独立显示。
		const godColor = 'var(--horosa-text, #262626)';
		const line2Color = cell.hasMenPo ? '#fa8c16' : 'var(--horosa-text, #262626)';
		// 飞盘九门含中门(数据层 FEI_GATE_HOME[5]='中' 已随飞填宫),直接取门;无门留空格。
		const doorDisp = cell.door || ' ';
		const line3Color = 'var(--horosa-text, #262626)';
		const diGanColor = 'var(--horosa-text, #262626)';
		const centerMinorColor = 'var(--horosa-muted, #8c8c8c)';
		const unifiedFont = 34;
		const insetX = 52;
		const insetY = 40;
		const isGenPalace = cell.palaceNum === 7 || cell.palaceName === '艮';
		const yiMaStyle = isGenPalace
			? { position: 'absolute', left: 10, bottom: 8, fontSize: 20, lineHeight: '20px', color: 'var(--horosa-text, #111)' }
			: { position: 'absolute', top: 8, right: 10, fontSize: 20, lineHeight: '20px', color: 'var(--horosa-text, #111)' };

		const palacePosMap = {
			1: { right: 12, bottom: 8 }, // 巽：靠中宫（右下）
			2: { left: '50%', bottom: 8, transform: 'translateX(-50%)' }, // 离：靠中宫（下中）
			3: { left: 12, bottom: 8 }, // 坤：靠中宫（左下）
			4: { right: 12, top: '50%', transform: 'translateY(-50%)' }, // 震：靠中宫（右中）
			6: { left: 12, top: '50%', transform: 'translateY(-50%)' }, // 兑：靠中宫（左中）
			7: { right: 12, top: 8 }, // 艮：靠中宫（右上）
			8: { left: '50%', top: 8, transform: 'translateX(-50%)' }, // 坎：靠中宫（上中）
			9: { left: 12, top: 8 }, // 乾：靠中宫（左上）
		};
		const palaceStyle = palacePosMap[cell.palaceNum] || null;
		const wuHeMap = {
			甲: '己',
			乙: '庚',
			丙: '辛',
			丁: '壬',
			戊: '癸',
			己: '甲',
			庚: '乙',
			辛: '丙',
			壬: '丁',
			癸: '戊',
		};
		const centerGan = cell.tianGan || cell.diGan || '';
		const centerHeGan = centerGan ? (wuHeMap[centerGan] || '') : '';
		const centerItems = [];
		if(centerGan){
			centerItems.push({ text: centerGan, color: centerMinorColor });
		}
		if(centerHeGan){
			centerItems.push({ text: `五合${centerHeGan}`, color: centerMinorColor });
		}

		// 转盘中宫无神(仅天盘干+五合);飞盘九星九神含中宫(天禽/九地飞入)→ 走常规格(无门)显示。
		if(cell.isCenter && !cell.isFeipan){
			return (
				<div
					key={`cell_${cell.palaceNum}`}
					style={{
						background: 'var(--horosa-panel-soft, #f6f6f6)',
						borderRadius: 14,
						border: '1px solid var(--horosa-border, #ececec)',
						height: 214,
						padding: 0,
						position: 'relative',
					}}
				>
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							transform: 'translate(-50%, -50%)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 4,
						}}
					>
						{centerItems.map((item, idx)=>(
							<div
								key={`center_item_${idx}`}
								style={{
									fontSize: 32,
									lineHeight: '32px',
									fontWeight: 700,
									color: item.color,
								}}
							>
								{item.text}
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div
				key={`cell_${cell.palaceNum}`}
				style={{
					background: 'var(--horosa-panel-soft, #f6f6f6)',
					borderRadius: 14,
					border: '1px solid var(--horosa-border, #ececec)',
					height: 214,
					padding: 0,
					position: 'relative',
				}}
			>
					{cell.isYiMa && (
						<div style={yiMaStyle}>🐎</div>
					)}

				{this.renderQimenHoverNode(
					'stem',
					cell.tianGan || ' ',
					{
						position: 'absolute',
						left: insetX,
						top: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: tianGanColor,
						fontWeight: 700,
					},
					`qimen_tiangan_${cell.palaceNum}`
				)}
				{cell.anGan ? (
					<div style={{ position: 'absolute', left: insetX + unifiedFont + 6, top: insetY + 6, fontSize: 16, lineHeight: '16px', color: 'var(--horosa-muted, #8c8c8c)', fontWeight: 600 }}>
						{cell.anGan}{cell.anZhi ? cell.anZhi : ''}
					</div>
				) : null}
				{this.renderQimenHoverNode(
					'stem',
					cell.diGan || ' ',
					{
						position: 'absolute',
						left: insetX,
						bottom: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: diGanColor,
						fontWeight: 700,
					},
					`qimen_digan_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'god',
					cell.god || ' ',
					{
						position: 'absolute',
						right: insetX,
						top: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: godColor,
						fontWeight: 700,
					},
					`qimen_god_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'star',
					cell.tianXing || ' ',
					{
						position: 'absolute',
						right: insetX,
						bottom: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line3Color,
						fontWeight: 700,
					},
					`qimen_star_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'door',
					doorDisp,
					{
						position: 'absolute',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%, -50%)',
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line2Color,
						fontWeight: 700,
					},
					`qimen_door_${cell.palaceNum}`
				)}

				{!!palaceStyle && (
					<div
						style={{
							position: 'absolute',
							color: titleColor,
							fontSize: 15,
							lineHeight: '15px',
							fontWeight: 700,
							...palaceStyle,
						}}
					>
						{this.renderQimenHoverInline('palace', cell.palaceName, <span>{cell.palaceName}</span>, `pn_${cell.palaceNum}`)}
					</div>
				)}
			</div>
		);
	}

	render(){
		const pan = this.props.pan;
		if(!pan){
			return null;
		}
		const cellSize = 214;
		const boardGap = 10;
		const boardWidth = (cellSize * 3) + (boardGap * 2);
		const boardScale = this.props.boardScale;
		const scaledWidth = Math.round(boardWidth * boardScale);
		const scaledHeight = Math.round(DUNJIA_BOARD_BASE_HEIGHT * boardScale);
		const timeInfo = getBoardTimeInfo(pan);
		const dateTitle = timeInfo.dateText;
		const shiftTitle = pan && pan.shiftPalace > 0 ? `（顺转${pan.shiftPalace}宫）` : '';
		const timeLine = `直接时间：${timeInfo.clockHm}  真太阳时：${timeInfo.solarHm}`;
		const pillars = [
			{
				key: 'year',
				label: '年',
				gan: (pan.ganzhi.year || '').substr(0, 1),
				zhi: (pan.ganzhi.year || '').substr(1, 1),
			},
			{
				key: 'month',
				label: '月',
				gan: (pan.ganzhi.month || '').substr(0, 1),
				zhi: (pan.ganzhi.month || '').substr(1, 1),
			},
			{
				key: 'day',
				label: '日',
				gan: (pan.ganzhi.day || '').substr(0, 1),
				zhi: (pan.ganzhi.day || '').substr(1, 1),
			},
			{
				key: 'time',
				label: '时',
				gan: (pan.ganzhi.time || '').substr(0, 1),
				zhi: (pan.ganzhi.time || '').substr(1, 1),
			},
			// [H-F] 刻家:第五柱=刻柱(时柱锚法,首刻即时柱逐刻进一);非刻家盘 keGanZhi='' 自动不出
			...(pan.keGanZhi ? [{
				key: 'ke',
				label: '刻',
				gan: (pan.keGanZhi || '').substr(0, 1),
				zhi: (pan.keGanZhi || '').substr(1, 1),
			}] : []),
		].map((item)=>({
			...item,
			ganColor: getBaZiStemColor(item.gan),
			zhiColor: getBaZiBranchColor(item.zhi),
		}));
		return (
			<div
				className="horosa-dunjia-board-shell xq-chart-renderer xq-chart-renderer-qimen"
				style={{ width: scaledWidth, height: scaledHeight, maxWidth: '100%', margin: '0 auto' }}
			>
					<div style={{ width: boardWidth, transform: `scale(${boardScale})`, transformOrigin: 'top left' }}>
						<div
							className="horosa-dunjia-board-summary"
							style={{
								padding: 12,
								borderRadius: 14,
								background: 'var(--horosa-surface-solid, #fbfbfb)',
								border: '1px solid var(--horosa-border, #efefef)',
								marginBottom: 8,
								width: boardWidth,
								maxWidth: '100%',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
									<div style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
										<span style={{ fontSize: 18, lineHeight: '22px', fontWeight: 700, color: 'var(--horosa-text, #222)' }}>
											{dateTitle}
										</span>
										<span
											style={{
												marginLeft: '1.2em',
												fontSize: 18,
												lineHeight: '22px',
												fontWeight: 700,
												color: 'var(--horosa-text, #222)',
												whiteSpace: 'nowrap',
											}}
										>
										{timeLine}
									</span>
								</div>
								<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
									<div style={{ fontSize: 17, lineHeight: '22px', fontWeight: 800, color: 'var(--horosa-astro-gold, #b8860b)', whiteSpace: 'nowrap' }}>
										{pan.options.boardTag || ''}
									</div>
									{shiftTitle ? (
										<div style={{ fontSize: 14, lineHeight: '18px', fontWeight: 700, color: 'var(--horosa-text-soft, #595959)' }}>
											{shiftTitle}
										</div>
									) : null}
								</div>
							</div>
							<div
								style={{
									marginTop: 6,
									display: 'flex',
									alignItems: 'flex-end',
									gap: 14,
								}}
							>
								{pillars.map((p)=>(
									<div key={`pillar_${p.key}`} style={{ display: 'flex', alignItems: 'center' }}>
										<div
											style={{
												display: 'flex',
												flexDirection: 'column',
												alignItems: 'center',
												lineHeight: 1,
												fontWeight: 700,
												fontSize: 32,
											}}
										>
											{this.renderQimenHoverInline('stem', p.gan, <span style={{ color: p.ganColor }}>{p.gan || ' '}</span>, `qimen_hd_gan_${p.key}`)}
											{this.renderQimenHoverInline('branch', p.zhi, <span style={{ color: p.zhiColor, marginTop: 4 }}>{p.zhi || ' '}</span>, `qimen_hd_zhi_${p.key}`)}
										</div>
										<span
											style={{
												marginLeft: 6,
												color: 'var(--horosa-muted, #8c8c8c)',
												fontSize: 24,
												lineHeight: 1,
												fontWeight: 700,
											}}
										>
											{p.label}
										</span>
									</div>
								))}
							</div>
							{pan.isJinhan && pan.jinhan ? (
								<div style={{ marginTop: 6, fontSize: 16, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #202020)' }}>
									{pan.juText} 日干支:{pan.jinhan.dayGz} 喜神:{pan.jinhan.xiShen} 大吉方:{pan.jinhan.daJiFang || '—'}
								</div>
							) : (
								<div style={{ marginTop: 6, fontSize: 16, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #202020)' }}>
									{pan.juText} 值符:{this.renderQimenHoverInline('star', pan.zhiFu, <span>{pan.zhiFu}</span>, 'qimen_hd_zhifu')} 值使:{this.renderQimenHoverInline('door', pan.zhiShi, <span>{pan.zhiShi}</span>, 'qimen_hd_zhishi')}
								</div>
							)}
							{pan.isJinhan && pan.jinhan ? (
								<div style={{ marginTop: 4, fontSize: 14, lineHeight: '18px', color: 'var(--horosa-text-soft, #595959)' }}>
									大吉时-{pan.jinhan.jiShi}（{pan.jinhan.pantype}盘·{pan.options.jinhanMenPaiLabel || '书表直录'}）
								</div>
							) : (
								<div style={{ marginTop: 4, fontSize: 14, lineHeight: '18px', color: 'var(--horosa-text-soft, #595959)' }}>
									{pan.options.kongMarkBoth && pan.xunKong ? `日空-${pan.xunKong.日空 || ''}·时空-${pan.xunKong.时空 || ''}` : `${pan.options.kongModeLabel}-${pan.kongWang}`} 旬首-{pan.xunShou}
								</div>
							)}
							{pan.allKong ? (
								<div style={{ marginTop: 2, fontSize: 13, lineHeight: '17px', color: 'var(--horosa-text-soft, #595959)' }}>
									年空-{pan.allKong.年空} 月空-{pan.allKong.月空} 日空-{pan.allKong.日空} 时空-{pan.allKong.时空}
								</div>
							) : null}
						</div>
						<div className="horosa-dunjia-grid-wrap" style={{ position: 'relative', width: boardWidth, maxWidth: '100%' }}>
							<div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${cellSize}px)`, gap: boardGap, ...(pan.isJinhan ? { gridAutoRows: `${cellSize}px` } : {}) }}>
								{pan.cells.map((cell)=>this.renderCell(cell))}
							</div>
							{pan.fengJu ? (
								<div
									style={{
										position: 'absolute',
										left: '50%',
										top: '50%',
										transform: 'translate(-50%, -50%)',
										width: '62%',
										maxWidth: 430,
										opacity: 0.22,
										pointerEvents: 'none',
										zIndex: 9,
									}}
								>
									<img src={sealedImage} alt="雷霆都司印章" style={{ width: '100%', height: 'auto', display: 'block' }} />
								</div>
							) : null}
						</div>
						<div className="horosa-dunjia-board-tags" style={{ marginTop: 12 }}>
							{DUNJIA_LEGEND_ITEMS.map((item)=>(
								<span
									key={item.key}
									className="horosa-dunjia-legend-tag"
									style={{
										'--qimen-legend-color': item.color,
										'--qimen-legend-bg': item.bg,
									}}
								>
									{item.label}
								</span>
							))}
						</div>
					</div>
			</div>
		);
	}
}

export default DunJiaBoard;
