// 右栏「断诀」页:开局信息卡(三层环境+禄马生旺墓)+通例命中+碎金赋链+飞伏生克+应期+金锁八要素+新派打分+古法进阶组。
// 纯展示,吃 analyzeLiuyao 产出;设置一变即随之刷新。
import React from 'react';
import { DIZHI, TIANGAN, ZHI_YINYANG, CHANGSHENG_START, CHANGSHENG_STAGES } from '../gua/LiuYaoConst';
import { LiuYaoRiYueView, LiuYaoShenShaExView, LiuYaoYueLiuShenView } from './LiuYaoBoard';
import { MANGPAI_SHIKAN } from '../gua/liuyaoReference';

const C = {
	text: 'var(--horosa-astro-text, #efe4d2)', muted: 'var(--horosa-astro-muted, #928b82)',
	label: 'var(--horosa-astro-label, #d6c7b0)', line: 'var(--horosa-astro-line, rgba(215,173,105,0.18))',
	accent: 'var(--horosa-accent, #e7bd75)', accentSoft: 'var(--horosa-accent-soft, rgba(231,189,117,0.14))',
	danger: 'var(--horosa-danger, #ff756c)', jade: 'var(--horosa-jade, #73c59a)', cinnabar: 'var(--horosa-cinnabar, #ec644e)',
};
const zi = (i) => DIZHI[((i % 12) + 12) % 12];
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
// 生旺墓:classic 五行不分阴阳顺行;ziping 阳顺阴逆(阴长生=阳之死位)
function shengWangMu(wx, isYin, mode){
	const start = CHANGSHENG_START[wx];
	if(!start){ return null; }
	const s = DIZHI.indexOf(start);
	if(mode !== 'ziping' || !isYin){
		return { 长生: start, 帝旺: zi(s + 4), 墓: zi(s + 8) };
	}
	const yinStart = zi(s + 7); // 阳之死位=阴之长生
	const ys = DIZHI.indexOf(yinStart);
	return { 长生: yinStart, 帝旺: zi(ys - 4), 墓: zi(ys - 8) };
}
function ganYin(gan){ return TIANGAN.indexOf(gan) % 2 === 1; }

function Card({ title, children }){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>{title}</div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.text }}>{children}</div>
		</div>
	);
}
function Row({ k, v }){
	return (
		<div style={{ display: 'flex', padding: '3px 0' }}>
			<div style={{ width: 108, flex: '0 0 auto', color: C.label, fontWeight: 600 }}>{k}</div>
			<div style={{ flex: 1 }}>{v}</div>
		</div>
	);
}
const Hit = ({ children, tone }) => (
	<span style={{ display: 'inline-block', margin: '2px 6px 2px 0', padding: '1px 8px', borderRadius: 10, fontSize: 12, background: C.accentSoft, color: tone === 'bad' ? C.danger : tone === 'good' ? C.jade : C.accent }}>{children}</span>
);

// [B1] 盲派十看诀:逐条尽量挂当前盘命中(复用已算字段)
function shiKanHits(a){
	const H = {};
	const yaos = a.yaos || [];
	const dj = a.duanJue || {};
	const db = a.dongBian || {};
	const moves = db.moves || [];
	H.kong = yaos.filter((y) => y.xunKong).map((y) => `第${y.pos}爻${y.liuqin}${y.voidKind || '空'}`);
	H.chong = [].concat((dj.anDong || []).map((pp) => `第${pp}爻暗动`), (dj.chongSan || []).map((pp) => `第${pp}爻日破`));
	H.wangshuai = [];
	H.dongbian = moves.filter((m) => m.jinShen || m.tuiShen || m.huaMu || m.huaJue || m.huaKong).map((m) => `第${m.pos}爻${[m.jinShen && '进神', m.tuiShen && '退神', m.huaMu && '化墓', m.huaJue && '化绝', m.huaKong && '化空'].filter(Boolean).join('')}`);
	H.shensha = a.shenSha ? Object.keys(a.shenSha.shaMap || {}) : [];
	const yloc = a.yongShen && a.yongShen.located && a.yongShen.located.yong;
	H.yongwei = (yloc && yloc.primary) ? [`用神在第${yloc.primary}爻`] : (a.yongShen && a.yongShen.yong ? ['用神不上卦(看伏神)'] : []);
	H.fushen = yaos.filter((y) => y.fushen).map((y) => `第${y.pos}爻伏${(y.fushen && y.fushen.liuqin) || ''}`);
	H.fanfuyin = [].concat(db.guaFanYin ? ['卦反吟'] : [], db.guaFuYin ? ['卦伏吟'] : [], moves.filter((m) => m.fanYin).map((m) => `第${m.pos}爻反吟`), moves.filter((m) => m.fuYin).map((m) => `第${m.pos}爻伏吟`));
	H.waiying = [];
	H.rongyi = [];
	return H;
}
function ShiKanCard({ analysis }){
	const s = analysis.settings || {};
	const H = shiKanHits(analysis);
	const open = s.school === 'mangpai';
	const SOFT = { waiying: '外象·程序不计', rongyi: '来人气色·程序不计', wangshuai: '见装卦表旺衰列' };
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>盲派 · 十看诀次第</div>
			<details open={open} style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
				<summary style={{ cursor: 'pointer', padding: '6px 10px', color: C.label, fontWeight: 600, fontSize: 12.5, background: C.accentSoft }}>断卦次第(一看空 → 十观容){open ? '' : ' · 展开'}</summary>
				<div style={{ padding: '4px 0' }}>
					{MANGPAI_SHIKAN.map((x) => {
						const hits = H[x.hit] || [];
						return (
							<div key={x.n} style={{ padding: '5px 10px', borderTop: `1px solid ${C.line}`, fontSize: 12 }}>
								<div><b style={{ color: C.cinnabar }}>{x.n}. {x.k}</b>　<span style={{ color: C.muted }}>{x.hint}</span></div>
								<div style={{ marginTop: 2 }}>{hits.length ? hits.map((h, i) => <Hit key={i}>{h}</Hit>) : <span style={{ color: C.muted }}>{SOFT[x.hit] || '本盘无'}</span>}</div>
							</div>
						);
					})}
				</div>
			</details>
		</div>
	);
}

export default function LiuYaoDuanJueView({ analysis, ctx }){
	if(!analysis){ return <div style={{ color: C.muted, fontSize: 13 }}>请先起卦。</div>; }
	const s = analysis.settings || {};
	const env = analysis.env || {};
	const dj = analysis.duanJue;
	const yq = analysis.yingqi;
	const gf = analysis.gufa;
	const c = ctx || {};
	const mode = s.changshengYinYang || 'ziping';
	const dayGan = c.dayGan || '';
	const luma = dayGan ? { lu: LU[dayGan], ma: c.dayZhi ? YIMA[c.dayZhi] : '', swm: shengWangMu(GAN_WX[dayGan], ganYin(dayGan), mode) } : null;
	const yongLoc = analysis.yongShen && analysis.yongShen.located && analysis.yongShen.located.yong;
	const yongYao = yongLoc && yongLoc.primary ? analysis.yaos[yongLoc.primary - 1] : null;
	const yongSwm = yongYao ? shengWangMu(yongYao.wuxing, ZHI_YINYANG[yongYao.zhi] === '阴', mode) : null;
	const yongLu = yongYao ? (ZHI_YINYANG[yongYao.zhi] === '阴' ? (yongSwm && yongSwm.帝旺) : null) : null;
	return (
		<div>
			<Card title="开局信息(三层环境)">
				{/* [T8·顶级美化] 三层环境=太岁(年)/月建(月)/日建(日) 三级并列,各显干支+其破+学理,取代原扁平三行。 */}
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
					{[
						{ tier: '太岁', sub: '一年之主', zhi: env.taiSui, poName: '岁破', po: env.suiPo, note: '' },
						{ tier: '月建', sub: '一月司令', zhi: env.yueJian, poName: '月破', po: env.yuePo, note: '最忌爻冲月建' },
						{ tier: '日建', sub: '一日之君', zhi: env.riZhi, poName: '日破', po: env.riPo, note: '日下暗中之应' },
					].map((t) => (
						<div key={t.tier} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 6px 7px', textAlign: 'center', background: C.accentSoft }}>
							<div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{t.tier}<span style={{ opacity: 0.7 }}>·{t.sub}</span></div>
							<div style={{ fontSize: 19, fontWeight: 700, color: C.accent, lineHeight: 1.15 }}>{t.zhi || '—'}</div>
							<div style={{ fontSize: 11, color: C.danger, marginTop: 3 }}>{t.poName} {t.po || '—'}</div>
							{t.note ? <div style={{ fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.3 }}>{t.note}</div> : null}
						</div>
					))}
				</div>
				{analysis.nayinDay ? <Row k="日辰纳音" v={`${analysis.nayinDay.name}(${analysis.nayinDay.wuxing})`} /> : null}
				{luma ? <Row k={`日干禄马生旺墓(${mode === 'ziping' ? '分阴阳' : '古法'})`} v={`禄${luma.lu || '—'}·马${luma.ma || '—'}·生${luma.swm.长生}·旺${luma.swm.帝旺}·墓${luma.swm.墓}`} /> : null}
				{yongYao && yongSwm ? <Row k="用神禄马生旺墓" v={`${yongYao.liuqin}${yongYao.zhi}:禄${yongLu || (yongSwm ? DIZHI[(DIZHI.indexOf(CHANGSHENG_START[yongYao.wuxing]) + 3) % 12] : '—')}·马${YIMA[yongYao.zhi] || '—'}·生${yongSwm.长生}·旺${yongSwm.帝旺}·墓${yongSwm.墓}`} /> : null}
				{analysis.shiShen ? <Row k={`世身(${analysis.shiShen.mode === 'lichunfeng' ? '亥子起' : '子午起'})`} v={`第${analysis.shiShen.pos}爻 ${analysis.shiShen.zhi}${analysis.shiShen.wuxing}${analysis.shiShen.liuqin}`} /> : null}
			</Card>
			{/* [F1] 日月引动/扩展神煞/月建六神 三卡=LiuYaoBoard 导出组件,概览与断诀共用同一渲染(防口径分叉) */}
			<LiuYaoRiYueView analysis={analysis} />
			<LiuYaoShenShaExView analysis={analysis} />
			<LiuYaoYueLiuShenView analysis={analysis} />
			<ShiKanCard analysis={analysis} />
			{dj ? (
				<Card title="通例命中">
					{dj.anDong.length ? <div><Hit tone="good">暗动</Hit>{dj.anDong.map((p) => `第${p}爻`).join('、')}(静而旺相被日冲,能生克他爻)</div> : null}
					{dj.chongSan.length ? <div><Hit tone="bad">日破冲散</Hit>{dj.chongSan.map((p) => `第${p}爻`).join('、')}</div> : null}
					{dj.jueSheng.map((j, i) => <div key={i}><Hit tone="good">绝处逢生</Hit>第{j.pos}爻{j.liuqin},动爻{j.savers.join('/')}生之</div>)}
					{dj.heChong.map((j, i) => <div key={i}><Hit>合处逢冲</Hit>第{j.pos}爻{j.liuqin}被日{j.by}:{j.duan}</div>)}
					{dj.suiGuan ? <div><Hit tone="bad">{dj.suiGuan.hits.map((h) => h.kind).join('·')}</Hit>{dj.suiGuan.duan}</div> : null}
					{dj.zhuGui ? <div><Hit tone="bad">助鬼伤身</Hit>{dj.zhuGui.duan}</div> : null}
					{dj.wuGui ? <div><Hit>无鬼无气</Hit>{dj.wuGui.duan}</div> : null}
					{dj.mieMo ? <div><Hit tone="bad">四卦{dj.mieMo.kind}例</Hit>{dj.mieMo.duan}({dj.mieMo.season})</div> : null}
					{dj.chengGang.length ? <div><Hit>承刚</Hit>{dj.chengGang.map((p) => `第${p}爻`).join('、')}(阴居阳下)</div> : null}
					{dj.xieQi.map((x, i) => <div key={i}><Hit>泄气</Hit>第{x.pos}爻{x.duan}</div>)}
					{!dj.anDong.length && !dj.chongSan.length && !dj.jueSheng.length && !dj.heChong.length && !dj.suiGuan && !dj.zhuGui && !dj.wuGui && !dj.mieMo && !dj.chengGang.length && !dj.xieQi.length ? <span style={{ color: C.muted }}>本盘无通例命中。</span> : null}
				</Card>
			) : null}
			{dj && dj.suiJinFu && dj.suiJinFu.length ? (
				<Card title="碎金赋·动爻作用链(对用神)">
					{dj.suiJinFu.map((ch, i) => (
						<div key={i} style={{ padding: '3px 0' }}>
							<b style={{ color: ch.kind.indexOf('忌') >= 0 ? C.danger : C.jade }}>{ch.kind}</b> 第{ch.from}爻{ch.liuqin}
							{ch.notes.map((n, j) => <div key={j} style={{ color: C.muted, fontSize: 12, paddingLeft: 12 }}>· {n}</div>)}
						</div>
					))}
				</Card>
			) : null}
			{dj && dj.feiFu && dj.feiFu.length ? (
				<Card title="飞伏生克">
					{dj.feiFu.map((f, i) => (
						<div key={i} style={{ padding: '2px 0' }}>第{f.pos}爻 <b style={{ color: C.accent }}>{f.rel}</b> {f.duan}
							{f.usable ? <span style={{ color: f.usable.usable ? C.jade : C.danger, marginLeft: 8, fontSize: 12 }}>{f.usable.usable ? '伏神可用' : '伏神难出'}({f.usable.reasons.join('·')})</span> : null}
						</div>
					))}
				</Card>
			) : null}
			{dj && dj.jinSuoShi ? (
				<Card title="金锁八要素(世爻)">
					{dj.jinSuoShi.map((e) => <Hit key={e.k} tone={e.on ? (('刑冲克墓空'.indexOf(e.k) >= 0) ? 'bad' : 'good') : undefined}>{e.k}{e.on ? '✓' : '—'}</Hit>)}
					<div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>德合刑冲克旺墓空:明其向背则休咎自分。</div>
				</Card>
			) : null}
			{dj && dj.xinpaiShi ? (
				<Card title="新派旺衰量化(世 · 用神)">
					<div><b style={{ color: C.label }}>世爻</b>　综合 <b style={{ color: C.accent }}>{dj.xinpaiShi.score}</b> 分 → <b style={{ color: C.cinnabar }}>{dj.xinpaiShi.grade}</b></div>
					<div style={{ color: C.muted, fontSize: 12 }}>{dj.xinpaiShi.parts.join(' / ')}　({dj.xinpaiShi.note})</div>
					{dj.xinpaiYong ? (
						<div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.line}` }}>
							<div><b style={{ color: C.label }}>用神{dj.xinpaiYongLiuqin}</b>　综合 <b style={{ color: C.accent }}>{dj.xinpaiYong.score}</b> 分 → <b style={{ color: C.cinnabar }}>{dj.xinpaiYong.grade}</b></div>
							<div style={{ color: C.muted, fontSize: 12 }}>{dj.xinpaiYong.parts.join(' / ')}</div>
						</div>
					) : <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>用神不上卦(无量化)</div>}
				</Card>
			) : null}
			{yq ? (
				<Card title="应期候选">
					{yq.rules.concat(yq.byAsk || []).map((r, i) => (
						<div key={i} style={{ padding: '2px 0' }}>
							<b style={{ color: C.jade }}>{r.rule}</b> → {r.targets.map((t) => <Hit key={t}>{t}</Hit>)}
							<span style={{ color: C.muted, fontSize: 12 }}>[{r.scope}·{r.source}]{r.hint ? ` ${r.hint}` : ''}</span>
						</div>
					))}
				</Card>
			) : null}
			{gf ? (
				<div>
					{gf.shengJiang ? (
						<Card title={`升降(${gf.shengJiang.zhongqi})`}>
							<Row k={gf.shengJiang.upYao.name} v={`第${gf.shengJiang.upYao.pos}爻(${gf.shengJiang.upYao.zhi})${gf.shengJiang.upMatch ? '·得度' : '·阴阳反度(主退损)'}`} />
							<Row k={gf.shengJiang.downYao.name} v={`第${gf.shengJiang.downYao.pos}爻(${gf.shengJiang.downYao.zhi})`} />
							{gf.shengJiang.keSheng ? <div style={{ color: C.danger }}>动爻(第{gf.shengJiang.keSheng.fromPos}爻)克升爻,应{gf.shengJiang.keSheng.atZhi}月凶。</div> : null}
						</Card>
					) : null}
					{gf.sixteenPos ? (
						<Card title="京房十六变">
							<div>本卦在本宫十六变序中为第 <b style={{ color: C.accent }}>{gf.sixteenPos.step}</b> 变·<b style={{ color: C.cinnabar }}>{gf.sixteenPos.vname}</b>{gf.sixteenPos.duan ? `(${gf.sixteenPos.duan})` : ''}</div>
							<div style={{ marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>{(gf.sixteen || []).map((sq) => `${sq.step}${sq.vname}·${sq.name}`).join(' → ')}</div>
						</Card>
					) : null}
					{gf.guaSheng && gf.guaSheng.hits.length ? (
						<Card title="卦生(月卦身所生之爻)">
							卦身{gf.guaSheng.body}({gf.guaSheng.bodyWx})生{gf.guaSheng.target} → {gf.guaSheng.hits.map((h) => `第${h.pos}爻${h.liuqin}${h.liushen ? `(${h.liushen})` : ''}`).join('、')}
						</Card>
					) : null}
					{gf.zhiFu ? (
						<Card title="直符四建">
							{gf.zhiFu.perFu.map((f) => <div key={f.name}>{f.jian}<b style={{ color: C.accent }}>{f.name}</b>({f.zhi}{f.wuxing}) {f.yaoPos.length ? `临第${f.yaoPos.join('/')}爻` : '不上卦'}</div>)}
							{gf.zhiFu.noneOn ? <div style={{ color: C.danger, fontSize: 12 }}>四直皆不上卦:所为先聚后相抛。</div> : null}
						</Card>
					) : null}
					{gf.sanXian ? (
						<Card title="三限荣枯(前后各十五年)">
							{gf.sanXian.seg.map((sg) => <div key={sg.pos} style={{ fontSize: 12 }}>{sg.side}·第{sg.pos}爻 {sg.zhi}{sg.wuxing}{sg.liuqin} 管 {sg.years} 年{sg.moving ? '·动' : ''}</div>)}
							{gf.sanXian.bianSeg ? <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>之卦:{gf.sanXian.bianSeg.map((b) => `${b.pos}爻${b.zhi}(${b.zhu})`).join('、')}</div> : null}
							<div style={{ marginTop: 4, fontSize: 12 }}>流年({gf.sanXian.shiYang ? '阳世顺行' : '阴世逆行'}):{gf.sanXian.liuNian.map((n) => `${n.year}年${n.zhi}`).join('、')}…</div>
						</Card>
					) : null}
					{gf.baJie ? (
						<Card title={`八节卦气(${gf.baJie.jie})`}>
							<div style={{ fontSize: 12 }}>{Object.keys(gf.baJie.map).map((k) => `${k}${gf.baJie.map[k]}`).join('　')}</div>
							{gf.baJie.neiTai ? <div style={{ marginTop: 4 }}>内卦气:<b style={{ color: C.accent }}>{gf.baJie.neiTai.state || '—'}</b>{gf.baJie.neiTai.isTai ? '(内胎之象)' : ''}</div> : null}
						</Card>
					) : null}
					{gf.pastFuture ? (
						<Card title="过去未来(以卦身为界)">
							{gf.pastFuture.perYao.map((p) => `${p.pos}爻${p.phase}`).join('、')}
						</Card>
					) : null}
				</div>
			) : null}
		</div>
	);
}
