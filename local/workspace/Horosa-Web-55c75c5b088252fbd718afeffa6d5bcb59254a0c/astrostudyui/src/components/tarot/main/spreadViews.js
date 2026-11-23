// 塔罗页 · 中栏牌阵:牌位连线、单张牌、指示牌位、牌阵 / 矩阵 / 开钥(OOK)视图
// 从 TarotMain.js 按职责拆出的 TarotMain 方法:this 仍是 TarotMain 实例,门面里 mixinMethods(TarotMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { isTrumpArcana } from '../engine/arcana';
import React from 'react';
import { getDeck, getDeckCards } from '../engine/deckRegistry';
import { displayNameCn, displayNameEn, cardMeaning, correspondenceCell, correspondenceView } from '../engine/cardSchema';
import { SPREADS } from '../engine/spreads';
import { minorScaleColor } from '../engine/colorScales';
import { cardImageUrl, deckHasRealArt } from '../engine/cardArt';
import { MAJORS_CORR, pathJoin } from '../decks/correspondences';
import { SCALE_META, SCALE_ORDER, scaleColor } from '../engine/colorScales';
import { PUBLIC_DOMAIN_ATTRIBUTION } from '../decks/meanings78';
import { pressable } from '../../../utils/pressable';
import { SUIT_COLOR, computeGeoLayout } from './layout';

export const spreadViewMethods = {
	// G6:牌阵连线 SVG（生命树 22 路径 / 凯尔特十字臂 / 关系人物连线 / 金字塔层级引导），置于牌下淡色。
	renderSpreadLines(reading, geo, spread){
		const type = reading.spreadType;
		if(!['tree_of_life', 'celtic', 'celtic6', 'celtic11', 'relation', 'relation7', 'pyramid10'].includes(type)){ return null; }
		const W = geo.W;
		const H = geo.H;
		const px = (p) => ({ x: p.x * W, y: geo.padY + p.y * geo.innerH });
		const posByI = {};
		spread.positions.forEach((p) => { posByI[p.i] = p; });
		const gold = 'var(--horosa-astro-gold, #d7ad69)';
		const lines = [];
		const line = (key, a, b, opacity, dash, w) => {
			if(!a || !b){ return; }
			const pa = px(a); const pb = px(b);
			lines.push(<line key={key} x1={pa.x.toFixed(1)} y1={pa.y.toFixed(1)} x2={pb.x.toFixed(1)} y2={pb.y.toFixed(1)} stroke={gold} strokeWidth={w || 1} strokeOpacity={opacity} strokeDasharray={dash || ''} />);
		};
		if(type === 'tree_of_life'){
			// 连线用的变体与占象同一对应视角:进阶对应关着时按牌组缺省(看不见的变体不改连线)
			const rdeck = getDeck(reading.deckId);
			const lineVariant = correspondenceView(rdeck, reading.settings, (rdeck && rdeck.caps) || {}).variant;
			MAJORS_CORR.forEach((m, mi) => {
				const j = pathJoin(m.id, lineVariant);
				if(!j){ return; }
				line(`path${mi}`, posByI[j[0]], posByI[j[1]], 0.34, '', 1);
			});
		}else if(type === 'celtic' || type === 'celtic6' || type === 'celtic11'){
			[3, 4, 5, 6].forEach((k) => line(`arm${k}`, posByI[1], posByI[k], 0.24, '3 3', 1));
		}else if(type === 'relation' || type === 'relation7'){
			line('r1', posByI[1], posByI[3], 0.3, '3 3', 1);
			line('r2', posByI[2], posByI[3], 0.3, '3 3', 1);
		}else if(type === 'pyramid10'){
			const layers = [[1, 2, 3, 4], [5, 6, 7], [8, 9], [10]];
			for(let L = 0; L < layers.length - 1; L++){
				layers[L].forEach((bi) => layers[L + 1].forEach((ti) => line(`py${bi}_${ti}`, posByI[bi], posByI[ti], 0.14, '', 0.6)));
			}
		}
		if(!lines.length){ return null; }
		return <svg className="horosa-tarot-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 0 }}>{lines}</svg>;
	},

	renderCard(draw, compact){
		const card = draw.card;
		if(!card){ return null; }
		const deck = this.currentDeck();
		const caps = this.caps();
		const isTarot = caps.readingMethod === 'tarot';
		const color = card.suitColor || SUIT_COLOR[card.suit] || SUIT_COLOR.major;
		const kwArr = String(cardMeaning(card, draw.isReversed, this.state.meaningSystem, this.state.reversalMode) || '').split('、');
		const kw = kwArr.slice(0, compact ? 2 : 3).join('、');
		const showCorr = isTarot && this.state.showCorrespondences && !compact;
		const dignity = draw.dignity;
		// TP3:色阶点扩展到小牌(数字=辉耀行×四界/宫廷=质点行;大牌仍为路径四阶色)。
		const scaleSwatches = caps.colorScale ? SCALE_ORDER.map((sk) => ({ sk, meta: SCALE_META[sk], c: isTrumpArcana(card.arcana) ? scaleColor(card, sk) : minorScaleColor(card, sk) })).filter((x) => x.c) : null;
		const cnName = isTarot ? displayNameCn(card, deck) : card.name_cn;
		const enName = isTarot ? displayNameEn(card, deck) : (card.playingCard || card.name_en);
		const imgUrl = this.state.artStyle === 'image' ? cardImageUrl(this.state.deckId, card) : null;
		return (
			<div key={`${draw.position.i}-${draw.cardId}`} className="horosa-tarot-card" style={{ borderColor: color, cursor: 'pointer' }} title="点击看牌详情" {...pressable(() => this.setState({ detailCard: card }))}>
				<div className="horosa-tarot-card-pos">{draw.position.label}</div>
				<div className="horosa-tarot-card-face" style={{ color, transform: draw.isReversed ? 'rotate(180deg)' : 'none' }}>
					<div className="horosa-tarot-card-visual">
						{imgUrl ? <img className="horosa-tarot-card-img" src={imgUrl} alt={cnName} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; const s = e.currentTarget.parentElement.querySelector('.horosa-tarot-card-symbol'); if(s){ s.style.display = ''; } }} /> : null}
						<span className="horosa-tarot-card-symbol" style={imgUrl ? { display: 'none' } : null}>{card.symbol}</span>
					</div>
					<span className="horosa-tarot-card-name">{cnName}</span>
					<span className="horosa-tarot-card-en">{enName}</span>
				</div>
				{caps.reversals !== false ? <div className={`horosa-tarot-card-orient${draw.isReversed ? ' is-reversed' : ''}`}>{this.orientLabel(draw)}</div> : null}
				{scaleSwatches && scaleSwatches.length ? <div className="horosa-tarot-corr horosa-tarot-scales">{scaleSwatches.map((x) => <span key={x.sk} className="horosa-tarot-scale-dot" title={`${x.meta.label}（${x.meta.world}）${x.c.name}`}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: x.c.hex, verticalAlign: 'middle' }} /></span>)}<span className="horosa-tarot-scale-lbl">四色阶</span></div> : null}
				{showCorr ? <div className="horosa-tarot-corr">{correspondenceCell(card, deck, this.state, caps)}</div> : null}
				{dignity ? <div className={`horosa-tarot-dignity is-${dignity.strength === '强' ? 'strong' : dignity.strength === '弱' ? 'weak' : 'neutral'}`} title={dignity.notes}>尊位·{dignity.strength}</div> : null}
				<div className="horosa-tarot-card-kw">{kw}</div>
			</div>
		);
	},

	renderSignificatorSlot(){
		const reading = this.state.reading;
		if(!reading || !reading.significator || !reading.significator.card){ return null; }
		const deck = this.currentDeck();
		const card = reading.significator.card;
		const color = SUIT_COLOR[card.suit] || SUIT_COLOR.major;
		return (
			<div className="horosa-tarot-sig-card" style={{ borderColor: color }}>
				<div className="horosa-tarot-sig-ribbon">指示牌</div>
				<div className="horosa-tarot-card-face" style={{ color }}>
					<span className="horosa-tarot-card-symbol">{card.symbol}</span>
					<span className="horosa-tarot-card-name">{displayNameCn(card, deck)}</span>
				</div>
			</div>
		);
	},

	renderCenter(){
		const reading = this.state.reading;
		const spread = reading ? SPREADS[reading.spreadType] : SPREADS[this.state.spreadType];
		if(!reading || !reading.draws || !reading.draws.length){
			if(reading && reading.firstReversal && reading.firstReversal.error){
				return <div className="horosa-tarot-empty">{reading.firstReversal.error}</div>;
			}
			return <div className="horosa-tarot-empty">请选择流派与牌阵并点「抽牌」</div>;
		}
		// G7 开钥:中栏走专属分堆视图(四界/十二宫/旬/质点 分区 + 指示牌落点 + 计数链),而非几何散牌。
		if(reading.spreadType === 'opening_of_key'){ return this.renderOokCenter(reading); }
		// TP5 matrix 大阵(行标签网格):22 张英雄/抉择、15 张四中心、26 张潜流、31 张月历、九步解题。
		if(spread.layout === 'matrix' && spread.matrix){ return this.renderMatrixCenter(reading, spread); }
		const n = reading.draws.length;
		const compact = n > 5;
		// 真实几何:位置带 x/y 且张数 ≤13(凯尔特十字/生命树/十二宫/马蹄铁/关系/croix)→ 绝对定位;否则网格(单/三/年度/GT)。
		const useGeometry = n <= 13 && spread.positions.every((p) => typeof p.x === 'number' && typeof p.y === 'number') && !['single', 'three', 'three_sit'].includes(reading.spreadType);
		if(useGeometry){
			const isImg = this.state.artStyle === 'image' && deckHasRealArt(this.state.deckId);
			const geo = computeGeoLayout(spread.positions, isImg);
			// TP5 图钥(因果七杯):中央静置一张不入抽的构图之钥(以其牌面结构定七位之义)。
			const fixedCenterCard = spread.fixedCenter ? getDeckCards(this.state.deckId).find((c) => c.sid === spread.fixedCenter) : null;
			return (
				<div className="horosa-tarot-stage">
					<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
					{this.renderSignificatorSlot()}
					<div className="horosa-tarot-geo" style={{ width: geo.W, maxWidth: '100%', height: geo.H, margin: '0 auto', flex: '0 0 auto', position: 'relative' }}>{this.renderSpreadLines(reading, geo, spread)}
						{fixedCenterCard ? (
							<div className="horosa-tarot-geo-slot" style={{ left: '50%', top: `${((geo.padY + 0.5 * geo.innerH) / geo.H * 100).toFixed(3)}%`, width: geo.slotW, transform: 'translate(-50%,-50%)', opacity: 0.75 }}>{/* 不入抽的示意卡整卡淡化:≥ 0.7 档,卡内信息字乘后仍 ≥ 3:1 */}
								<div className="horosa-tarot-card" style={{ borderStyle: 'dashed' }}>
									<div className="horosa-tarot-card-pos">图钥(不入抽)</div>
									<div className="horosa-tarot-card-face" style={{ color: SUIT_COLOR[fixedCenterCard.suit] || SUIT_COLOR.major }}>
										<span className="horosa-tarot-card-symbol">{fixedCenterCard.symbol}</span>
										<span className="horosa-tarot-card-name">{this.cardLabel(fixedCenterCard)}</span>
									</div>
								</div>
							</div>
						) : null}
						{reading.draws.map((d, idx) => {
							const pos = d.position;
							// 横压牌与第 1 位同点 → 旋转 90° 叠放(唯一蓄意重叠);认位置的 crossFixed,三种凯尔特十字一视同仁
							const crossing = !!pos.crossFixed;
							return (
								<div key={`geo-${pos.i}-${d.cardId}`} className={crossing ? 'horosa-tarot-geo-slot is-crossing' : 'horosa-tarot-geo-slot'} style={{ left: `${pos.x * 100}%`, top: `${((geo.padY + pos.y * geo.innerH) / geo.H * 100).toFixed(3)}%`, width: geo.slotW, transform: `translate(-50%,-50%)${crossing ? ' rotate(90deg)' : ''}`, '--deal-i': idx }}>
									{this.renderCard(d, true)}
								</div>
							);
						})}
					</div>
					<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
				</div>
			);
		}
		const cols = n <= 3 ? n : (n <= 5 ? 5 : (n <= 10 ? 5 : (n <= 36 ? 8 : 8)));
		return (
			<div className="horosa-tarot-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
				{this.renderSignificatorSlot()}
				<div className="horosa-tarot-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
					{reading.draws.map((d) => this.renderCard(d, compact || n > 13))}
				</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	},

	// TP5 matrix 大阵渲染:行标签列 + n 列网格;有 colLabels 则加表头行;空槽留白。复用 renderCard(compact)。
	renderMatrixCenter(reading, spread){
		const m = spread.matrix;
		const rows = m.rowLabels.length;
		const byCell = {};
		reading.draws.forEach((d) => {
			if(d.position && d.position.row !== undefined){ byCell[`${d.position.row}_${d.position.col}`] = d; }
		});
		const gridStyle = { display: 'grid', gridTemplateColumns: `72px repeat(${m.cols}, minmax(0, 1fr))`, gap: 6, alignItems: 'stretch', width: '100%' };
		const cellStyle = { minHeight: 96, display: 'flex', alignItems: 'stretch', justifyContent: 'center' };
		const labelStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--horosa-astro-gold, #d7ad69)', textAlign: 'center', lineHeight: 1.4, padding: '0 2px' };
		const out = [];
		if(m.colLabels && m.colLabels.length){
			out.push(<div key="corner" />);
			m.colLabels.forEach((cl, ci) => out.push(<div key={`cl${ci}`} style={{ ...labelStyle, minHeight: 20 }}>{cl}</div>));
		}
		for(let r = 0; r < rows; r++){
			out.push(<div key={`rl${r}`} style={labelStyle}>{m.rowLabels[r]}</div>);
			for(let c = 0; c < m.cols; c++){
				const d = byCell[`${r}_${c}`];
				out.push(<div key={`c${r}_${c}`} style={cellStyle}>{d ? this.renderCard(d, true) : <div style={{ color: 'var(--horosa-text-secondary)', alignSelf: 'center', fontSize: 18 }}>·</div>}</div>);
			}
		}
		return (
			<div className="horosa-tarot-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
				{this.renderSignificatorSlot()}
				<div className="horosa-tarot-matrix" style={gridStyle}>{out}</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	},

	// G7 开钥专属分堆视图:5 操作各成分区,显指示牌落堆(四界/十二宫/旬/质点)+ 环形计数链(mini 牌面,逆位翻转)。
	renderOokCenter(reading){
		const ook = reading && reading.ook;
		const deck = this.currentDeck();
		if(!ook){ return <div className="horosa-tarot-empty">开钥仅 Golden Dawn / Thoth 牌组 + 已选指示牌可用；请在左栏选定指示牌。</div>; }
		if(ook.error){ return <div className="horosa-tarot-empty">{ook.error}</div>; }
		const sig = reading.significator && reading.significator.card;
		const miniCard = (item, key, isSig) => {
			const c = item && item.card;
			if(!c){ return null; }
			const color = c.suitColor || SUIT_COLOR[c.suit] || SUIT_COLOR.major;
			return (
				<div key={key} className={`horosa-tarot-ook-mini${isSig ? ' is-sig' : ''}`} style={{ borderColor: color }} title={displayNameCn(c, deck)}>
					<span className="horosa-tarot-ook-mini-sym" style={{ color, transform: item.isReversed ? 'rotate(180deg)' : 'none' }}>{c.symbol}</span>
					<span className="horosa-tarot-ook-mini-name">{displayNameCn(c, deck)}</span>
				</div>
			);
		};
		return (
			<div className="horosa-tarot-stage horosa-tarot-ook-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · 开钥五操作（分堆视图）</div>
				{sig ? <div className="horosa-tarot-ook-sig">指示牌锚点：<b>{displayNameCn(sig, deck)}</b> <span style={{ color: SUIT_COLOR[sig.suit] || SUIT_COLOR.major }}>{sig.symbol}</span></div> : null}
				<div className="horosa-tarot-ook-zones">
					{ook.operations.map((op) => (
						<div key={op.op} className="horosa-tarot-ook-zone">
							<div className="horosa-tarot-ook-zone-head">
								<span className="horosa-tarot-ook-badge">操作{op.op}</span>
								<span className="horosa-tarot-ook-opname">{op.name}</span>
								<span className="horosa-tarot-ook-pile">→ 落「{op.pileLabel}」· {op.pileSize} 张</span>
							</div>
							<div className="horosa-tarot-ook-chain">
								{(op.chain || []).length ? op.chain.map((it, i) => (
									<React.Fragment key={i}>
										{i > 0 ? <span className="horosa-tarot-ook-arrow">›</span> : null}
										{miniCard(it, i, i === 0)}
									</React.Fragment>
								)) : <span className="horosa-tarot-empty" style={{ padding: 0, color: 'var(--horosa-text-secondary)' }}>指示牌未落此堆</span>}
							</div>
						</div>
					))}
					{ook.op5 ? (
						<div className="horosa-tarot-ook-zone is-op5">
							<div className="horosa-tarot-ook-zone-head"><span className="horosa-tarot-ook-badge">操作5</span><span className="horosa-tarot-ook-opname">{ook.op5.name}</span></div>
							<div className="horosa-tarot-ook-line">{ook.op5.summary}</div>
						</div>
					) : null}
				</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	},
};
