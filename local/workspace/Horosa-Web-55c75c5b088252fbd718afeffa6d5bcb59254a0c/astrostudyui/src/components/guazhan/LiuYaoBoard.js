// 六爻装卦表 + 用神 + 动变 + 旬空(展示层)。纯展示:吃 analyzeLiuyao 产出,流派/开关一变即随之刷新。
// 配色统一走 --horosa-* 暗黑令牌 + 五行(八字)色板,明暗两态均清晰。
import React from 'react';
import { CHISHI_JUE, FADONG_JUE, LIUSHEN_FADONG, YAOWEI_XIANG, ZHANLEI_GANGYAO, GU_FU, MINGJIA_TABLE } from '../gua/liuyaoReference';
import { ZHI_CANGGAN, TIANGAN_HE, TIANGAN_HE_HUA, LIUCHONG, LIUHE, SANHE, SANHUI, HAI, PO, DIZHI, TIANGAN, CHANGSHENG_START, CHANGSHENG_START_ALT, LIUSHEN_START } from '../gua/LiuYaoConst';

// 设计令牌(暗黑友好,带回落)
const C = {
	text: 'var(--horosa-astro-text, #efe4d2)',
	muted: 'var(--horosa-astro-muted, #928b82)',
	label: 'var(--horosa-astro-label, #d6c7b0)',
	line: 'var(--horosa-astro-line, rgba(215,173,105,0.18))',
	lineStrong: 'var(--horosa-astro-line-strong, rgba(231,190,119,0.42))',
	panel: 'var(--horosa-astro-panel, #0d1d2b)',
	accent: 'var(--horosa-accent, #e7bd75)',
	accentSoft: 'var(--horosa-accent-soft, rgba(231,189,117,0.14))',
	danger: 'var(--horosa-danger, #ff756c)',
	jade: 'var(--horosa-jade, #73c59a)',
	cinnabar: 'var(--horosa-cinnabar, #ec644e)',
};
// 五行(八字)色 —— 六亲按其爻五行着色,与全 app 干支配色统一
const WX_COLOR = {
	木: 'var(--horosa-bazi-wood, #66c486)',
	火: 'var(--horosa-bazi-fire, #ff5f50)',
	土: 'var(--horosa-bazi-earth, #c08a4c)',
	金: 'var(--horosa-bazi-metal, #f0c979)',
	水: 'var(--horosa-bazi-water, #5f8fff)',
};
const WANGSHUAI_COLOR = { 旺: C.jade, 相: C.jade, 休: C.muted, 囚: C.danger, 死: C.danger };

function yaoSymbol(yin){ return yin ? '⚋' : '⚊'; }
// 爻题(阳爻九/阴爻六 + 位):初九/九二/九三/九四/九五/上九(阴则六)
function yaoTi(pos, yin){
	const yy = yin ? '六' : '九';
	if(pos === 1){ return '初' + yy; }
	if(pos === 6){ return '上' + yy; }
	return yy + ['', '', '二', '三', '四', '五'][pos];
}

function Cell({ children, style, title, align }){
	return (
		<td title={title} style={{ padding: '5px 7px', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap', textAlign: align || 'left', ...style }}>{children}</td>
	);
}
function Th({ children, style }){
	return <th style={{ padding: '6px 7px', borderBottom: `1.5px solid ${C.lineStrong}`, color: C.label, fontWeight: 600, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap', ...style }}>{children}</th>;
}

// ── 旬空卡(右栏顶) ──
export function LiuYaoXunKong({ analysis }){
	if(!analysis){ return null; }
	const day = analysis.kongPair || '—';
	const mon = analysis.monthKong || '';
	return (
		<div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', marginBottom: 8, background: C.accentSoft, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 13, color: C.text }}>
			<span style={{ color: C.label, fontWeight: 600 }}>旬空</span>
			<span>日空 <b style={{ color: C.accent }}>{day}</b></span>
			{mon ? <span>月空 <b style={{ color: C.accent }}>{mon}</b></span> : null}
		</div>
	);
}

export function LiuYaoZhuangTable({ analysis, movingSet, title, hideXunKong }){
	if(!analysis || !analysis.yaos){ return null; }
	const { yaos, shenSha, liuShen, fushenAll, guaShen, palaceType, settings, guaXing, heHui } = analysis;
	const moving = movingSet || new Set();
	const shaPer = shenSha && shenSha.perYao ? shenSha.perYao : null;
	const shenBody = guaShen ? guaShen.body : null;
	const showSha = !!(settings && settings.shensha && settings.shensha.on);
	const showLiu = !!(settings && settings.sixGods);
	const showBian = moving.size > 0;
	const rows = (settings && settings.writeDir === 'topDown') ? yaos.slice() : yaos.slice().reverse(); // 上爻在上(默认)/初爻在上
	return (
		<div>
			{title ? <div style={{ fontSize: 13, fontWeight: 600, color: C.label, margin: '2px 0 6px' }}>{title}</div> : null}
			{hideXunKong ? null : <LiuYaoXunKong analysis={analysis} />}
			<div style={{ overflowX: 'auto', border: `1px solid ${C.line}`, borderRadius: 8 }}>
				<table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', color: C.text }}>
					<thead>
						<tr style={{ background: C.accentSoft }}>
							{showLiu ? <Th>六神</Th> : null}
							<Th>伏神</Th>
							<Th>本卦六爻</Th>
							<Th style={{ textAlign: 'center' }}>世应</Th>
							<Th style={{ textAlign: 'center' }}>旺衰</Th>
							<Th>日·月</Th>
							<Th>状态</Th>
							{showSha ? <Th>神煞</Th> : null}
							{showBian ? <Th>动→变</Th> : null}
						</tr>
					</thead>
					<tbody>
						{rows.map((y) => {
							const idx = y.pos - 1;
							const isMoving = moving.has(y.pos);
							const fu = (fushenAll && fushenAll[idx]) || y.fushen;
							const liu = showLiu && liuShen && liuShen[idx] ? liuShen[idx].liushen : '';
							const shaList = shaPer && shaPer[idx] ? shaPer[idx].shensha : [];
							const statusTags = [];
							if(y.yuePo){ statusTags.push({ t: '月破' + (settings && settings.yuepoMode === 'always' ? '·长期' : '·当月'), c: C.danger, title: (y.yuepoDetail && y.yuepoDetail.note) || '' }); }
							if(y.xunKong){ statusTags.push({ t: y.voidKind || '旬空', c: y.voidKind === '真空' ? C.danger : C.accent, title: y.zhenKongJue || '' }); }
							if(y.ruMu){ statusTags.push({ t: '入墓', c: C.accent }); }
							// WP-5:十二长生完整阶段,受 changshengUse 控制(off 不显 / four 只生旺墓绝 / full12 全 12 宫);原硬编只显 3 个已修。
							const _csUse = (settings && settings.changshengUse) || 'four';
							if(_csUse !== 'off' && y.changsheng && (_csUse === 'full12' || ['长生', '帝旺', '墓', '绝'].indexOf(y.changsheng) >= 0)){
								const _c = (y.changsheng === '长生' || y.changsheng === '帝旺') ? C.jade
									: (['墓', '绝', '死', '病'].indexOf(y.changsheng) >= 0 ? C.danger : C.muted);
								statusTags.push({ t: y.changsheng, c: _c });
							}
							if(y.anDong === '暗动'){ statusTags.push({ t: '暗动', c: C.jade }); }
							(y.sanCeng || []).forEach((t)=>{ if(t === '岁破' || t === '日破'){ statusTags.push({ t, c: C.danger }); } });
							if(y.yuqiStrong){ statusTags.push({ t: '余气强', c: C.jade }); }
							const isShen = shenBody && y.zhi === shenBody;
							return (
								<tr key={y.pos} style={isMoving ? { background: C.accentSoft } : null}>
									{showLiu ? <Cell style={{ color: C.muted }}>{liu}</Cell> : null}
									<Cell style={{ color: C.muted, fontSize: 12 }}>
										{fu && fu.liuqin ? <span><span style={{ color: WX_COLOR[fu.wuxing] || C.muted }}>{fu.zhi}{fu.wuxing}</span>{fu.liuqin}</span> : '—'}
									</Cell>
									<Cell>
										<span style={{ fontFamily: 'monospace', fontSize: 16, color: isMoving ? C.accent : C.text, marginRight: 6 }}>{yaoSymbol(y.yin)}</span>
										<span title={ZHI_CANGGAN[y.zhi] ? `藏干 ${ZHI_CANGGAN[y.zhi]}` : undefined} style={{ color: WX_COLOR[y.wuxing] || C.text, fontWeight: 600, cursor: ZHI_CANGGAN[y.zhi] ? 'help' : undefined }}>{(analysis.gans && analysis.gans[idx]) || ''}{y.zhi}{y.wuxing}</span>
										<span style={{ color: C.text, marginLeft: 2 }}>{y.liuqin}</span>
											<span style={{ color: C.muted, marginLeft: 6, fontSize: 11 }}>{yaoTi(y.pos, y.yin)}</span>
										{isMoving ? <span style={{ color: C.accent, marginLeft: 4, fontSize: 12 }}>{y.yin ? '✕' : '○'}</span> : null}
										{isShen ? <span title="卦身" style={{ marginLeft: 4, color: C.cinnabar }}>★</span> : null}
									{analysis.shiShen && analysis.shiShen.pos === y.pos ? <span title="世身" style={{ marginLeft: 4, color: C.accent }}>◆</span> : null}
									</Cell>
									<Cell align="center" style={{ fontWeight: 700, color: y.shiYing === '世' ? C.cinnabar : (y.shiYing === '应' ? C.accent : C.muted) }}>{y.shiYing || ''}</Cell>
									<Cell align="center" style={{ color: WANGSHUAI_COLOR[y.wangShuai] || C.text, fontWeight: 600 }}>{y.wangShuai}</Cell>
									<Cell style={{ fontSize: 11, lineHeight: 1.5 }}>{riYueMiniCell(analysis, idx)}</Cell>
									<Cell style={{ fontSize: 12 }}>
										{statusTags.length ? statusTags.map((s, i) => (<span key={i} title={s.title || undefined} style={{ color: s.c, marginRight: 5, cursor: s.title ? 'help' : undefined }}>{s.t}</span>)) : <span style={{ color: C.muted }}>—</span>}
									</Cell>
									{showSha ? <Cell style={{ fontSize: 12, color: C.muted }}>{(shaList || []).join('·') || '—'}</Cell> : null}
									{showBian ? <Cell style={{ fontSize: 12 }}>{renderBianCell(analysis, y.pos)}</Cell> : null}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
				卦序：<span style={{ color: C.label }}>{palaceType ? `${palaceType.palace}宫·${palaceType.type}` : '—'}</span>
				{guaShen ? <span>　卦身：<span style={{ color: C.cinnabar }}>{guaShen.body}</span>{guaShen.onChart ? '' : '(不上卦)'}</span> : ''}
				{guaXing && guaXing.ben ? <span>　卦象：<span style={{ color: C.accent }}>{guaXing.ben}</span>{guaXing.bian ? <span>→{guaXing.bian}</span> : ''}</span> : ''}
				{heHui && heHui.length ? <span>　<span style={{ color: C.jade }}>{heHui.map((h) => `${h.type}(${h.zhis}${h.wuxing}${h.hasMoving ? '·动' : ''})`).join('、')}</span></span> : ''}
			</div>
		</div>
	);
}

// [F1] 装卦表紧凑「日·月」列:两行小标签(生=jade/克冲破=danger/合=accent/值=cinnabar),完整 why 走 title。
function ryTagTone(tone){ return tone === 'bad' ? C.danger : tone === 'good' ? C.jade : C.accent; }
function ryMiniLine(label, rel){
	const tags = (rel && rel.tags) || [];
	const why = tags.map((t) => t.why).filter(Boolean).join('·');
	return (
		<div title={why || undefined} style={{ cursor: why ? 'help' : undefined }}>
			<span style={{ color: C.muted }}>{label}</span>
			{tags.length ? tags.map((t, i) => <span key={i} style={{ color: ryTagTone(t.tone), marginLeft: 3 }}>{t.t}</span>) : <span style={{ color: C.muted, marginLeft: 3 }}>—</span>}
		</div>
	);
}
function riYueMiniCell(analysis, idx){
	const ry = analysis.riYue && analysis.riYue.perYao ? analysis.riYue.perYao[idx] : null;
	if(!ry){ return <span style={{ color: C.muted }}>—</span>; }
	return (<span>{ryMiniLine('日', ry.day)}{ryMiniLine('月', ry.month)}</span>);
}

function renderBianCell(analysis, pos){
	const db = analysis.dongBian;
	if(!db || !db.moves){ return ''; }
	const m = db.moves.find((x) => x.pos === pos);
	if(!m){ return <span style={{ color: C.muted }}>—</span>; }
	const tags = [];
	if(m.jinShen){ tags.push('进神'); }
	if(m.tuiShen){ tags.push('退神'); }
	if(m.fanYin){ tags.push('反吟'); }
	if(m.fuYin){ tags.push('伏吟'); }
	if(m.huiTou.sheng){ tags.push('回头生'); }
	if(m.huiTou.ke){ tags.push('回头克'); }
	if(m.huiTou.chong){ tags.push('回头冲'); }
	if(m.huiTou.he){ tags.push('回头合'); }
	if(m.huaKong){ tags.push('化空'); }
	if(m.huaPo){ tags.push('化破'); }
	if(m.huaMu){ tags.push('化墓'); }
	if(m.huaJue){ tags.push('化绝'); }
	return (
		<span>
			<span style={{ color: WX_COLOR[m.bian.wuxing] || C.text }}>{m.bian.zhi}{m.bian.wuxing}</span>
			<span>{m.bian.liuqin}</span>
			{tags.length ? <span style={{ color: C.accent, marginLeft: 4 }}>{tags.join('·')}</span> : null}
		</span>
	);
}

// ── 关联卦(之/互/伏神/综/错):各卦完整装卦(与本卦同口径,六亲以本卦宫为我) ──
const EMPTY_SET = new Set();
export function LiuYaoRelatedCards({ analysis }){
	if(!analysis || !analysis.related){ return null; }
	const r = analysis.related;
	const cards = [
		{ key: 'bian', label: '之卦', a: (analysis.settings && analysis.settings.biangua === 'movingOnly') ? null : r.bian },
		{ key: 'hu', label: '互卦', a: r.hu },
		{ key: 'fu', label: '伏神卦', a: r.fu },
		{ key: 'zong', label: '综卦', a: r.zong },
		{ key: 'cuo', label: '错卦', a: r.cuo },
	].filter((c) => c.a && c.a.yaos);
	if(!cards.length){ return null; }
	return (
		<div style={{ marginTop: 14 }}>
			<div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 8, borderTop: `1px solid ${C.lineStrong}`, paddingTop: 10 }}>关联卦（完整装卦 · 六亲皆按本卦宫）</div>
			{cards.map((c) => {
				const typ = c.a.palaceType ? `${c.a.palaceType.palace}宫·${c.a.palaceType.type}` : '';
				return (
					<div key={c.key} style={{ marginBottom: 14 }}>
						<LiuYaoZhuangTable analysis={c.a} movingSet={EMPTY_SET} title={`${c.label}　${c.a.name}${typ ? `（${typ}）` : ''}`} hideXunKong />
					</div>
				);
			})}
		</div>
	);
}

// ── 用神视图 ──
export function LiuYaoYongShenView({ analysis }){
	if(!analysis || !analysis.yongShen){ return null; }
	const ys = analysis.yongShen;
	const locTxt = (loc) => {
		if(!loc || !loc.candidates || loc.candidates.length === 0){ return <span style={{ color: C.muted }}>不上卦{hasFu(analysis) ? '(看伏神)' : ''}</span>; }
		return loc.candidates.map((cc) => `第${cc.pos}爻${cc.flags && cc.flags.length ? '(' + cc.flags.join('·') + ')' : ''}`).join('、');
	};
	const rows = [
		{ k: '占测事项', v: ys.label, hi: C.accent },
		{ k: '用神', v: <span><b style={{ color: C.cinnabar }}>{ys.yong}</b>　{locTxt(ys.located.yong)}</span> },
	];
	if(ys.secondary && ys.located.secondary){ rows.push({ k: '次用神', v: <span><b>{ys.secondary}</b>　{locTxt(ys.located.secondary)}</span> }); }
	if(ys.roles){
		rows.push({ k: '原神(生用神)', v: <span><b style={{ color: C.jade }}>{ys.roles.yuan}</b>　{locTxt(ys.located.yuan)}</span> });
		rows.push({ k: '忌神(克用神)', v: <span><b style={{ color: C.danger }}>{ys.roles.ji}</b>　{locTxt(ys.located.ji)}</span> });
		rows.push({ k: '仇神(生忌神)', v: <span><b style={{ color: C.accent }}>{ys.roles.chou}</b>　{locTxt(ys.located.chou)}</span> });
	}
	if(analysis.guaShen){ rows.push({ k: '卦身', v: <span><b style={{ color: C.cinnabar }}>{analysis.guaShen.body}</b>{analysis.guaShen.onChart ? '(上卦)' : '(不上卦)'}</span> }); }
	if(ys.note){ rows.push({ k: '取用说明', v: <span style={{ color: C.muted }}>{ys.note}</span> }); }
	return (
		<div style={{ fontSize: 13, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
			{rows.map((r, i) => (
				<div key={r.k} style={{ display: 'flex', padding: '7px 10px', background: i % 2 ? 'transparent' : C.accentSoft, borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : 'none' }}>
					<div style={{ width: 104, color: C.label, flex: '0 0 auto', fontWeight: 600 }}>{r.k}</div>
					<div style={{ flex: 1, color: r.hi || C.text }}>{r.v}</div>
				</div>
			))}
		</div>
	);
}

function hasFu(analysis){ return analysis.yaos && analysis.yaos.some((y) => y.fushen); }

// ── 神煞视图(概览):各神煞落支 + 临爻 ──
export function LiuYaoShenShaView({ analysis }){
	if(!analysis || !analysis.shenSha){ return null; } // 神煞开关关 → 不显
	const shaMap = analysis.shenSha.shaMap || {};
	const perYao = analysis.shenSha.perYao || [];
	const names = Object.keys(shaMap);
	if(!names.length){ return <div style={{ color: C.muted, fontSize: 12 }}>(已启用神煞,本盘无落支)</div>; }
	return (
		<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
			{names.map((nm, i) => {
				const zhis = shaMap[nm] || [];
				const onYao = perYao.filter((y) => y.shensha && y.shensha.indexOf(nm) >= 0).map((y) => `${y.pos}爻`);
				return (
					<div key={nm} style={{ display: 'flex', padding: '6px 10px', background: i % 2 ? 'transparent' : C.accentSoft, borderBottom: i < names.length - 1 ? `1px solid ${C.line}` : 'none', fontSize: 13 }}>
						<div style={{ width: 84, color: C.label, fontWeight: 600, flex: '0 0 auto' }}>{nm}</div>
						<div style={{ flex: 1 }}>
							<span style={{ color: C.accent }}>{zhis.join('、')}</span>
							<span style={{ color: onYao.length ? C.cinnabar : C.muted, marginLeft: 10 }}>{onYao.length ? `临 ${onYao.join('/')}` : '不上卦'}</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── 典籍补齐:共用小卡/命中标签/日月引动行(概览与断诀 tab 同一渲染,防口径分叉) ──
const YAO_NAME = { 6: '上爻', 5: '五爻', 4: '四爻', 3: '三爻', 2: '二爻', 1: '初爻' };
function MCard({ title, sub, children }){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>{title}{sub ? <span style={{ color: C.muted, fontWeight: 400 }}>　{sub}</span> : null}</div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.text }}>{children}</div>
		</div>
	);
}
const MHit = ({ children, tone }) => (
	<span style={{ display: 'inline-block', margin: '2px 6px 2px 0', padding: '1px 8px', borderRadius: 10, fontSize: 12, background: C.accentSoft, color: tone === 'bad' ? C.danger : tone === 'good' ? C.jade : C.accent }}>{children}</span>
);
// 日辰/月建对某爻的引动(生=jade/克冲破=danger/合=accent/值=cinnabar,why 走文尾)
function RiYueLine({ label, rel }){
	const tags = (rel && rel.tags) || [];
	const whys = [];
	tags.forEach((t) => { if(t.why && whys.indexOf(t.why) < 0){ whys.push(t.why); } });
	return (
		<div style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 12, alignItems: 'baseline' }}>
			<span style={{ width: 32, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>{label}</span>
			<span style={{ flex: 1 }}>
				{tags.length
					? tags.map((t, i) => <MHit key={i} tone={t.tone === 'bad' ? 'bad' : t.tone === 'good' ? 'good' : undefined}>{t.t}</MHit>)
					: <span style={{ color: C.muted }}>不生不克(平)</span>}
				{whys.length ? <span style={{ color: C.muted, marginLeft: 2 }}>{whys.join('·')}</span> : null}
			</span>
		</div>
	);
}

// [F1] 日辰·月建对六爻引动(概览+断诀共用);始终渲染(核心外力,不加开关)。
export function LiuYaoRiYueView({ analysis }){
	const ry = analysis && analysis.riYue;
	if(!ry || !ry.perYao || !ry.perYao.length){ return null; }
	return (
		<MCard title="日辰 · 月建 对六爻的引动">
			<div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.7 }}>
				日辰 <b style={{ color: C.cinnabar }}>{ry.dayGan}{ry.dayZhi}</b> 为断卦之君,能生克冲合全卦;月建 <b style={{ color: C.jade }}>{ry.monthGan}{ry.monthZhi}</b> 司令,主一月旺衰。铁律:爻不反作用于月日。
			</div>
			<div style={{ display: 'grid', gap: 6 }}>
				{ry.perYao.slice().reverse().map((p) => (
					<div key={p.pos} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 8px' }}>
						<div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
							<b style={{ color: C.accent }}>{YAO_NAME[p.pos] || `第${p.pos}爻`}</b>
							<span style={{ color: C.text, fontWeight: 600 }}>{p.gan}{p.zhi}</span>
							<span style={{ color: C.label }}>{p.liuqin}</span>
						</div>
						<RiYueLine label="日辰" rel={p.day} />
						<RiYueLine label="月建" rel={p.month} />
					</div>
				))}
			</div>
		</MCard>
	);
}

// [F1] 扩展神煞·月令神煞逐爻(受 shenshaEx.on gating,由 facade 决定是否有数据)。
export function LiuYaoShenShaExView({ analysis }){
	const ex = analysis && analysis.shenShaEx;
	if(!ex || !ex.perYao || !ex.perYao.some((p) => p.shensha.length)){ return null; }
	return (
		<MCard title="扩展神煞 · 月令神煞(逐爻)">
			{ex.perYao.slice().reverse().filter((p) => p.shensha.length).map((p) => (
				<div key={p.pos} style={{ padding: '2px 0', fontSize: 12 }}>
					<b style={{ color: C.accent }}>{YAO_NAME[p.pos] || `第${p.pos}爻`}</b>
					<span style={{ color: C.label, margin: '0 6px' }}>{p.zhi}</span>
					{p.shensha.map((nm) => <MHit key={nm}>{nm}</MHit>)}
				</div>
			))}
		</MCard>
	);
}

// [F1] 月建六神(月令定局):本月六神各值一支(定局),再看卦中何爻临之。
// 六神只落六支,卦中未必爻爻皆临 → 列全六爻(临者标神、不临标「不临」),并先给出本月定局全表,免「只四个」之惑。
export function LiuYaoYueLiuShenView({ analysis }){
	const yl = analysis && analysis.yueLiuShenAnn;
	if(!yl || !yl.perYao || !yl.perYao.length){ return null; }
	const map = yl.map || {};
	const yaos = (analysis && analysis.yaos) || [];
	const GODS = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
	const GOD_COLOR = { 青龙: C.jade, 朱雀: C.cinnabar, 勾陈: C.accent, 螣蛇: C.accent, 白虎: C.danger, 玄武: C.muted };
	const anyHit = yl.perYao.some((p) => p.hits.length);
	return (
		<MCard title="月建六神(月令定局)">
			{/* 本月六神所值之支(定局全表) */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8, paddingBottom: 7, borderBottom: `1px dashed ${C.line}` }}>
				{GODS.map((g) => (
					<span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 8px', borderRadius: 10, fontSize: 12, border: `1px solid ${C.line}`, background: C.accentSoft }}>
						<b style={{ color: GOD_COLOR[g] || C.accent }}>{g}</b><span style={{ color: C.text }}>{map[g] || '—'}</span>
					</span>
				))}
			</div>
			{/* 逐爻:临本月六神者标出,不临者标「不临」——六爻全列,不再只显命中 */}
			<div>
				{yl.perYao.slice().reverse().map((p) => {
					const zhi = (yaos[p.pos - 1] || {}).zhi || '';
					return (
						<div key={p.pos} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0', fontSize: 12 }}>
							<b style={{ color: C.accent, minWidth: 34 }}>{YAO_NAME[p.pos] || `第${p.pos}爻`}</b>
							<span style={{ color: C.label, minWidth: 18 }}>{zhi}</span>
							<span>{p.hits.length ? p.hits.map((nm) => <MHit key={nm} tone={GOD_COLOR[nm] === C.jade ? 'good' : GOD_COLOR[nm] === C.danger ? 'bad' : undefined}>{nm}</MHit>) : <span style={{ color: C.muted }}>不临</span>}</span>
						</div>
					);
				})}
			</div>
			{!anyHit ? <div style={{ color: C.muted, fontSize: 11.5, marginTop: 4 }}>本卦六爻地支皆不落本月六神之支(六神只值六支,未临属常态)。</div> : null}
		</MCard>
	);
}

// [A1-A4] 世应关系 / 卦变吉凶 / 动态四态 / 间爻(概览显要位置)。
const REL_TONE = { 世应相冲: 'bad', 应克世: 'bad', 世克应: 'good', 应生世: 'good', 世应相合: 'good', 世生应: undefined, 比和: undefined };
export function LiuYaoManualCards({ analysis }){
	if(!analysis){ return null; }
	const sy = analysis.shiYingRel;
	const gb = analysis.guaBianDuan;
	const dt = analysis.dongTai;
	const jy = analysis.jianYao || [];
	const yaoBox = (y, who, wtone) => (
		<span>
			<span style={{ color: C.muted, fontSize: 11 }}>{who}</span>
			<b style={{ color: wtone, marginLeft: 3 }}>{y.liuqin}</b>
			<span style={{ color: WX_COLOR[y.wuxing] || C.text, marginLeft: 2 }}>{y.zhi}{y.wuxing}</span>
		</span>
	);
	return (
		<MCard title="世应 · 卦变 · 动态 · 间爻">
			{sy ? (
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
					<div style={{ width: 60, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>世应关系</div>
					<div style={{ flex: 1 }}>
						{yaoBox(sy.shiYao, `世${sy.shiPos}`, C.cinnabar)}
						<MHit tone={REL_TONE[sy.rel]}>{sy.rel || '—'}</MHit>
						{yaoBox(sy.yingYao, `应${sy.yingPos}`, C.accent)}
						{sy.bothVoid ? <span style={{ color: C.danger, marginLeft: 6, fontSize: 12 }}>世应俱空</span> : null}
						{sy.note ? <span style={{ color: C.muted, marginLeft: 6, fontSize: 12 }}>{sy.note}</span> : null}
					</div>
				</div>
			) : null}
			{gb ? (
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
					<div style={{ width: 60, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>卦变</div>
					<div style={{ flex: 1 }}>
						<span style={{ color: C.accent }}>{gb.ben}</span><span style={{ color: C.muted, margin: '0 4px' }}>→</span><span style={{ color: C.accent }}>{gb.bian}</span>
						<MHit tone={gb.duan.indexOf('成') >= 0 && gb.duan.indexOf('后成') >= 0 ? 'good' : undefined}>{gb.duan}</MHit>
					</div>
				</div>
			) : null}
			{dt ? (
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
					<div style={{ width: 60, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>动态</div>
					<div style={{ flex: 1 }}>
						<MHit tone={dt.tai === '独发' ? 'good' : undefined}>{dt.tai}</MHit>
						<span style={{ color: C.muted, fontSize: 12 }}>{dt.count}爻动{dt.note ? `　${dt.note}` : ''}</span>
					</div>
				</div>
			) : null}
			{jy.length ? (
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', flexWrap: 'wrap' }}>
					<div style={{ width: 60, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>间爻</div>
					<div style={{ flex: 1 }}>
						{jy.map((j) => <span key={j.pos} style={{ marginRight: 10 }}><span style={{ color: C.muted, fontSize: 11 }}>{YAO_NAME[j.pos]}</span> <b style={{ color: C.text }}>{j.liuqin}</b><span style={{ color: C.muted }}>{j.zhi}</span></span>)}
						<span style={{ color: C.muted, fontSize: 12 }}>世应之间·中介/媒人/第三方</span>
					</div>
				</div>
			) : null}
		</MCard>
	);
}

// ── 动变视图 ──
export function LiuYaoDongBianView({ analysis }){
	if(!analysis || !analysis.dongBian){ return null; }
	const db = analysis.dongBian;
	const related = analysis.related || {};
	if(db.movingCount === 0){
		return (
			<div style={{ fontSize: 13, color: C.text }}>
				<div style={{ color: C.muted, padding: '8px 10px', background: C.accentSoft, borderRadius: 6 }}>无动爻,卦不变(静卦,以世应、用神旺衰断)。</div>
				<RelatedLine related={related} />
			</div>
		);
	}
	return (
		<div style={{ fontSize: 13, color: C.text }}>
			<div style={{ marginBottom: 8, padding: '7px 10px', background: C.accentSoft, borderRadius: 6 }}>
				变卦：<b style={{ color: C.accent }}>{db.bianGua ? db.bianGua.name : '—'}</b>
				{db.guaFuYin ? <span style={{ color: C.danger }}>　(卦伏吟)</span> : ''}{db.guaFanYin ? <span style={{ color: C.danger }}>　(卦反吟)</span> : ''}
			</div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
				{db.moves.map((m, i) => (
					<div key={m.pos} style={{ padding: '7px 10px', borderBottom: i < db.moves.length - 1 ? `1px solid ${C.line}` : 'none' }}>
						<span style={{ color: C.label }}>第{m.pos}爻</span>
						<span style={{ color: WX_COLOR[m.ben.wuxing] || C.text }}>{m.ben.zhi}{m.ben.wuxing}</span>{m.ben.liuqin}
						<span style={{ color: C.muted, margin: '0 6px' }}>→</span>
						<span style={{ color: WX_COLOR[m.bian.wuxing] || C.text }}>{m.bian.zhi}{m.bian.wuxing}</span>{m.bian.liuqin}
						<span style={{ marginLeft: 8, color: C.accent, fontSize: 12 }}>{bianTags(m)}</span>
					</div>
				))}
			</div>
			{db.blindEffects && db.blindEffects.length ? (
				<div style={{ marginTop: 8, padding: '7px 10px', background: C.accentSoft, borderRadius: 6 }}>
					<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 4 }}>盲派 · 变爻作用本卦他爻</div>
					{db.blindEffects.map((e, i) => (
						<div key={i} style={{ fontSize: 12, color: C.text, padding: '1px 0' }}>
							第{e.from}爻(变)<span style={{ color: C.muted, margin: '0 4px' }}>{e.rel}</span>第{e.to}爻 {e.toLiuqin}
						</div>
					))}
				</div>
			) : null}
			<RelatedLine related={related} />
		</div>
	);
}

function bianTags(m){
	const t = [];
	if(m.jinShen){ t.push('进神'); } if(m.tuiShen){ t.push('退神'); }
	if(m.fanYin){ t.push('反吟'); } if(m.fuYin){ t.push('伏吟'); }
	if(m.huiTou.sheng){ t.push('回头生'); } if(m.huiTou.ke){ t.push('回头克'); }
	if(m.huiTou.chong){ t.push('回头冲'); } if(m.huiTou.he){ t.push('回头合'); }
	if(m.huaKong){ t.push('化空'); } if(m.huaPo){ t.push('化破'); } if(m.huaMu){ t.push('化墓'); } if(m.huaJue){ t.push('化绝'); }
	return t.join('·');
}

// ── 参考(只读卡):持世诀/六亲发动/六神发动/爻位象/常见占类(WP-L);高亮当前持世六亲 ──
function RefBlock({ title, children }){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>{title}</div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>{children}</div>
		</div>
	);
}
function RefRow({ k, v, hi, i, n }){
	return (
		<div style={{ display: 'flex', padding: '5px 9px', fontSize: 12, background: hi ? C.accentSoft : (i % 2 ? 'transparent' : 'rgba(127,127,127,0.04)'), borderBottom: i < n - 1 ? `1px solid ${C.line}` : 'none' }}>
			<div style={{ width: 92, flex: '0 0 auto', color: hi ? C.cinnabar : C.label, fontWeight: 600 }}>{k}{hi ? ' ◀持世' : ''}</div>
			<div style={{ flex: 1, color: C.text }}>{v}</div>
		</div>
	);
}
// [T8·顶级美化] 爻位象:三分栏表(身/宅/人事列头分色),取代原「足｜宅基｜…」挤压一格。
function YaoWeiXiangBlock(){
	const cols = '46px 1fr 1fr 1.15fr';
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>爻位象<span style={{ color: C.muted, fontWeight: 400 }}>（身 / 宅 / 人事）</span></div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
				<div style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 11, fontWeight: 600, background: 'rgba(127,127,127,0.07)', borderBottom: `1px solid ${C.line}` }}>
					<div style={{ padding: '4px 8px', color: C.muted }}>爻位</div>
					<div style={{ padding: '4px 8px', color: C.accent }}>身</div>
					<div style={{ padding: '4px 8px', color: C.jade }}>宅</div>
					<div style={{ padding: '4px 8px', color: C.cinnabar }}>人事</div>
				</div>
				{YAOWEI_XIANG.slice().reverse().map((y, i) => (
					<div key={y.pos} style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 12, background: i % 2 ? 'transparent' : 'rgba(127,127,127,0.035)', borderBottom: i < 5 ? `1px solid ${C.line}` : 'none' }}>
						<div style={{ padding: '5px 8px', color: C.label, fontWeight: 600 }}>{['初', '二', '三', '四', '五', '上'][y.pos - 1]}爻</div>
						<div style={{ padding: '5px 8px', color: C.text }}>{y.body}</div>
						<div style={{ padding: '5px 8px', color: C.text }}>{y.home}</div>
						<div style={{ padding: '5px 8px', color: C.text }}>{y.person}</div>
					</div>
				))}
			</div>
		</div>
	);
}
// [T8·顶级美化] 常见占类断法纲要:每类一张卡(占类名+用神药丸,吉/凶分色两段),取代原挤压一行。
function ZhanLeiGangYaoBlock(){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>常见占类断法纲要</div>
			<div style={{ display: 'grid', gap: 6 }}>
				{ZHANLEI_GANGYAO.map((z) => (
					<div key={z.key} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 9px', background: 'rgba(127,127,127,0.03)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
							<span style={{ fontWeight: 700, color: C.label, fontSize: 12.5 }}>{z.name}</span>
							<span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11.5, background: C.accentSoft, color: C.cinnabar, fontWeight: 600 }}>用神 {z.yong}</span>
						</div>
						<div style={{ display: 'flex', gap: 14, fontSize: 12, flexWrap: 'wrap', lineHeight: 1.5 }}>
							<span style={{ flex: '1 1 40%', minWidth: 0 }}><span style={{ color: C.jade, fontWeight: 700 }}>吉</span>&nbsp;<span style={{ color: C.text }}>{z.ji}</span></span>
							<span style={{ flex: '1 1 40%', minWidth: 0 }}><span style={{ color: C.danger, fontWeight: 700 }}>凶</span>&nbsp;<span style={{ color: C.text }}>{z.xiong}</span></span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
// [B2] 断卦总纲·古赋(折叠长文)
function GuFuBlock(){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>断卦总纲 · 古赋</div>
			<div style={{ display: 'grid', gap: 6 }}>
				{GU_FU.map((g) => (
					<details key={g.name} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 9px', background: 'rgba(127,127,127,0.03)' }}>
						<summary style={{ cursor: 'pointer', color: C.label, fontWeight: 600, fontSize: 12.5 }}>{g.name}<span style={{ color: C.muted, fontWeight: 400, marginLeft: 8 }}>{g.tag}</span></summary>
						<div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.85, color: C.text }}>{g.text}</div>
						{g.note ? <div style={{ marginTop: 5, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{g.note}</div> : null}
					</details>
				))}
			</div>
		</div>
	);
}
// [B3] 代表性名家与地域支系(表)
function MingjiaBlock(){
	const cols = '1.1fr 1.5fr 0.8fr';
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>名家支系<span style={{ color: C.muted, fontWeight: 400 }}>（断法侧重·起盘同一）</span></div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
				<div style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 11, fontWeight: 600, background: 'rgba(127,127,127,0.07)', borderBottom: `1px solid ${C.line}` }}>
					<div style={{ padding: '4px 8px', color: C.muted }}>名家/支系</div>
					<div style={{ padding: '4px 8px', color: C.accent }}>侧重</div>
					<div style={{ padding: '4px 8px', color: C.jade }}>备注</div>
				</div>
				{MINGJIA_TABLE.map((m, i) => (
					<div key={m.name} style={{ display: 'grid', gridTemplateColumns: cols, fontSize: 12, background: i % 2 ? 'transparent' : 'rgba(127,127,127,0.035)', borderBottom: i < MINGJIA_TABLE.length - 1 ? `1px solid ${C.line}` : 'none' }}>
						<div style={{ padding: '5px 8px', color: C.label, fontWeight: 600 }}>{m.name}</div>
						<div style={{ padding: '5px 8px', color: C.text }}>{m.focus}</div>
						<div style={{ padding: '5px 8px', color: C.muted }}>{m.note}</div>
					</div>
				))}
			</div>
		</div>
	);
}
// [数据表查用] 地支关系/藏干/天干五合/十二长生起例/六神起例(引擎已有数据,纯只读查用)
function relPairs(map){ const seen = new Set(); const out = []; DIZHI.forEach((z) => { const t = map[z]; if(!t || seen.has(z + t) || seen.has(t + z)){ return; } seen.add(z + t); out.push(`${z}${t}`); }); return out.join('　'); }
function DataTablesBlock(){
	const row = (k, v) => (
		<div style={{ display: 'flex', padding: '5px 9px', fontSize: 12, borderBottom: `1px solid ${C.line}` }}>
			<div style={{ width: 66, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>{k}</div>
			<div style={{ flex: 1, color: C.text, lineHeight: 1.6 }}>{v}</div>
		</div>
	);
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>数据表 · 查用<span style={{ color: C.muted, fontWeight: 400 }}>（起例速查）</span></div>
			<details style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
				<summary style={{ cursor: 'pointer', padding: '6px 9px', color: C.label, fontWeight: 600, fontSize: 12.5, background: 'rgba(127,127,127,0.05)' }}>地支关系 · 藏干 · 天干五合 · 长生起例 · 六神起例</summary>
				<div>
					{row('六冲', relPairs(LIUCHONG))}
					{row('六合', relPairs(LIUHE))}
					{row('三合局', Object.keys(SANHE).map((k) => `${k}${SANHE[k]}`).join('　'))}
					{row('三会方', Object.keys(SANHUI).map((k) => `${k}${SANHUI[k]}`).join('　'))}
					{row('六害', relPairs(HAI))}
					{row('相破', relPairs(PO))}
					{row('地支藏干', DIZHI.map((z) => `${z}藏${ZHI_CANGGAN[z]}`).join('　'))}
					{row('天干五合', Object.keys(TIANGAN_HE_HUA).map((k) => `${k}合${TIANGAN_HE_HUA[k]}`).join('　'))}
					{row('长生起例', `金长生巳·木长生亥·水长生申·火长生寅·土长生${CHANGSHENG_START['土']}(水土同宫,异说火土同宫在${CHANGSHENG_START_ALT['土']})`)}
					<div style={{ display: 'flex', padding: '5px 9px', fontSize: 12 }}>
						<div style={{ width: 66, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>六神起例</div>
						<div style={{ flex: 1, color: C.text, lineHeight: 1.6 }}>{TIANGAN.map((g) => `${g}起${LIUSHEN_START[g]}`).join('　')}<span style={{ color: C.muted }}>　(按日干,自初爻起顺排青龙→玄武)</span></div>
					</div>
				</div>
			</details>
		</div>
	);
}
export function LiuYaoReference({ analysis }){
	const chiShi = analysis && analysis.yaos ? (analysis.yaos.find((y) => y.shiYing === '世') || {}).liuqin : '';
	const liuqinList = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
	const liushenList = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
	return (
		<div>
			<RefBlock title="诸爻持世诀">
				{liuqinList.map((lq, i) => (<RefRow key={lq} k={lq + '持世'} v={CHISHI_JUE[lq]} hi={chiShi === lq} i={i} n={liuqinList.length} />))}
			</RefBlock>
			<RefBlock title="六亲发动诀(发动必生一克一)">
				{liuqinList.map((lq, i) => (<RefRow key={lq} k={lq + '动'} v={<span><span style={{ color: C.danger }}>{FADONG_JUE[lq].ke}</span>　<span style={{ color: C.jade }}>{FADONG_JUE[lq].sheng}</span></span>} i={i} n={liuqinList.length} />))}
			</RefBlock>
			<RefBlock title="六神发动歌">
				{liushenList.map((sn, i) => (<RefRow key={sn} k={sn + '动'} v={LIUSHEN_FADONG[sn]} i={i} n={liushenList.length} />))}
			</RefBlock>
			<YaoWeiXiangBlock />
			<ZhanLeiGangYaoBlock />
			<GuFuBlock />
			<MingjiaBlock />
			<DataTablesBlock />
		</div>
	);
}

function RelatedLine({ related }){
	return (
		<div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
			错卦：<span style={{ color: C.label }}>{related.cuo ? related.cuo.name : '—'}</span>
			综卦：<span style={{ color: C.label }}>{related.zong ? related.zong.name : '—'}</span>
			互卦：<span style={{ color: C.label }}>{related.hu ? related.hu.name : '—'}</span>
		</div>
	);
}

// ── 占天时(晴雨)· 古法分列 ────────────────────────────────────────────────
// 仅在「天时占法」设为古法档时出现(通行档 analysis.tianshi 恒 null,此卡整体不渲染)。
// 🔴 按家分列、不合成单一结论 —— 古籍自陈各家「多有冲突之处,使人不知所从」;每条都带
// 「依据」(原文说法)与「本卦」(命中实况)两栏,便于逐条对着古籍复核。
export function LiuYaoTianshiView({ analysis }){
	const ts = analysis && analysis.tianshi;
	if(!ts || !Array.isArray(ts.houses) || !ts.houses.length){ return null; }
	return (
		<div style={{ marginTop: 12 }}>
			<div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
				<span style={{ color: C.label, fontWeight: 600, fontSize: 13 }}>占天时(晴雨)· 古法分列</span>
				<span style={{ color: C.muted, fontSize: 11 }}>{ts.houses.length} 家命中</span>
			</div>
			{ts.disclaimer ? (
				<div style={{ color: C.muted, fontSize: 11, lineHeight: 1.7, marginBottom: 8, padding: '6px 9px',
					background: C.accentSoft, border: `1px solid ${C.line}`, borderRadius: 6 }}>{ts.disclaimer}</div>
			) : null}
			{ts.houses.map((h)=>(
				<div key={h.source} style={{ marginBottom: 10 }}>
					<div style={{ color: C.accent, fontWeight: 600, fontSize: 12, marginBottom: 4,
						borderBottom: `1px solid ${C.line}`, paddingBottom: 3 }}>《{h.source}》<span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>{h.hits.length} 条</span></div>
					{h.hits.map((x, i)=>(
						<div key={`${h.source}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', fontSize: 12, color: C.text }}>
							<span style={{ flex: '0 0 auto', minWidth: 62, textAlign: 'center', padding: '1px 6px', borderRadius: 4,
								background: C.accentSoft, border: `1px solid ${C.line}`, color: C.accent, fontSize: 11 }}>{x.tag || '—'}</span>
							<span style={{ flex: '1 1 auto', lineHeight: 1.7 }}>
								{x.rule}
								<span style={{ color: C.muted, marginLeft: 6, fontSize: 11 }}>← {x.detail}</span>
							</span>
						</div>
					))}
				</div>
			))}
			{Array.isArray(ts.notImplemented) && ts.notImplemented.length ? (
				<div style={{ color: C.muted, fontSize: 11, lineHeight: 1.7, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.line}` }}>
					{ts.notImplemented.map((n)=>(
						<div key={n.source}>未采:{n.source} —— {n.why}</div>
					))}
				</div>
			) : null}
		</div>
	);
}
