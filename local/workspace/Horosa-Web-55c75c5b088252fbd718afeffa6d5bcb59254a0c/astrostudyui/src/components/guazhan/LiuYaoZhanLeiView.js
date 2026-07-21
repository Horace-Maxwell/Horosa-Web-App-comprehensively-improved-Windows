// 右栏「占类」页:鬼谷辨爻法+占类专用对照卡(即时可用,数据来自 tianjiZhanleiCore)+
// 歌赋断语库(tianjiDoctrine 由抽取管线生成后动态注入;未生成时显示提示)。
import React, { useState, useEffect } from 'react';
import { BIANYAO_FA, QUE_LIUQIN, SIGUA_ILLNESS, BING_WEI, GUI_ZHENG, YAO_FANG, JI_RANG, LIUSHEN_SONG, LIUSHEN_SUI,
	ZEI_SHOUFA, CANG_WU_FANG, XUN_ZEI_ZONG, YING_ZEI_WO, TAO_CANG, ZOU_FANG_BAGUA, YINXIN_BAGUA, XINGGE_ZHI,
	JIULIU_ZISUN, NIUMA_GUA, TIANHE_GUI, CAN_GUI_YAO, LIUCHU_BENMING } from '../gua/data/tianjiZhanleiCore';
import { guaLoreOf } from '../gua/data/tianjiGuaLore';
import { LiuYaoXunWu } from './LiuYaoCastPad';
import { loadDoctrine, setDoctrine, ASK_TO_DOCTRINE } from '../gua/data/liuyaoDoctrineCache'; // 共享单一真值源(UI+AI 快照)

const C = { text: 'var(--horosa-astro-text, #efe4d2)', muted: 'var(--horosa-astro-muted, #928b82)', label: 'var(--horosa-astro-label, #d6c7b0)', line: 'var(--horosa-astro-line, rgba(215,173,105,0.18))', accent: 'var(--horosa-accent, #e7bd75)', accentSoft: 'var(--horosa-accent-soft, rgba(231,189,117,0.14))', danger: 'var(--horosa-danger, #ff756c)' };
// askType → 占类门(辨爻法键 + 专用卡集)
const ASK_TO_MEN = {
	lost: ['遗失', '盗贼', '逃亡'], travel: ['出行', '行人', '音信', '觅人'], lawsuit: ['词讼', '斗殴'],
	home: ['家宅', '田禾', '迁移', '香火', '地理'], guishen: ['鬼神六亲', '鬼神神位', '鬼神杂祟', '怪异', '咒诅'],
	study: ['选举', '求事'], guochao: ['国朝'],
	self: ['求事'], opponent: ['趋谒'], wealth: ['求财', '买卖'], career: ['选举', '仕宦', '词讼'],
	marriage_m: ['分娩'], marriage_f: ['分娩'], illness: ['疾病凶象', '疾病身位', '医药'], parents: ['家宅', '田禾'],
	children: ['六畜', '春蚕'], doctor: ['医药'], sibling: ['斗殴'], thief: ['盗贼', '遗失', '逃亡'],
	weather_rain: [], weather_sun: [],
};
// ASK_TO_DOCTRINE 已迁至共享 liuyaoDoctrineCache(UI 与 AI 快照单一真值源,防口径分叉)。
function DoctrineMen({ men, rows, defaultOpen }){
	const [open, setOpen] = useState(!!defaultOpen);
	let lastSrc = null;
	return (
		<div style={{ marginBottom: 6 }}>
			<div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.label, padding: '3px 0', userSelect: 'none' }}>
				{open ? '▾' : '▸'} {men} <span style={{ color: C.muted, fontWeight: 400 }}>({rows.length} 条)</span>
			</div>
			{open ? (
				<div style={{ maxHeight: '40vh', overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, lineHeight: 1.8 }}>
					{rows.map((r, i) => {
						const showSrc = r.source && r.source !== lastSrc;
						lastSrc = r.source || lastSrc;
						// 冗余标题行(正文=来源名,如「鬼谷辨爻法」)已由 ◈ 源头显示 → 只保留分节头,不再重复成一行
						const dupTitle = r.text === r.source;
						// 短碎片(单词/无句读,如占天时「雨/动布/微细」、占身命「足趾/项手」)→ 内联芯片流,不再块状竖排
						const isFrag = !!r.text && r.text.length <= 5 && !/[。，、；：？！,.]/.test(r.text) && !/^[[（(【]/.test(r.text);
						return (
							<React.Fragment key={i}>
								{showSrc ? <div style={{ color: C.accent, fontWeight: 600, margin: '6px 0 2px', width: '100%' }}>◈ {r.source}</div> : null}
								{dupTitle ? null : (isFrag
									? <span style={{ display: 'inline-block', margin: '2px 5px 2px 0', padding: '1px 8px', borderRadius: 8, background: C.accentSoft, fontSize: 12 }}>{r.text}</span>
									: <div style={{ color: r.text.indexOf('（') === 0 || r.text.indexOf('今注') >= 0 ? C.muted : C.text }}>{r.text}</div>)}
							</React.Fragment>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
function Card({ title, children }){
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ fontSize: 12, fontWeight: 600, color: C.accent, margin: '4px 0 6px' }}>{title}</div>
			<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.text }}>{children}</div>
		</div>
	);
}
const KV = ({ obj }) => (
	<div style={{ fontSize: 12, lineHeight: 1.7, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '2px 12px' }}>
		{Object.keys(obj).filter((k) => k !== 'note').map((k) => <div key={k} style={{ overflowWrap: 'anywhere' }}><b style={{ color: C.label }}>{k}</b>:{Array.isArray(obj[k]) ? obj[k].join('、') : obj[k]}</div>)}
		{obj.note ? <div style={{ color: C.muted, gridColumn: '1 / -1' }}>注:{obj.note}</div> : null}
	</div>
);

let doctrineData = null; // 抽取生成的 tianjiDoctrine.js 动态注入
export function setZhanleiDoctrine(d){ doctrineData = d; setDoctrine(d); }
try{ // 走共享 loadDoctrine 单一 loader(同时填充 AI 快照缓存,防显示/导出口径分叉);不存在=首版未抽取,静默
	loadDoctrine().then((d) => { doctrineData = d; }).catch(() => {});
}catch(e){ /* ignore */ }

export default function LiuYaoZhanLeiView({ analysis, currentGuaName, castLines }){
	const [doc, setDoc] = useState(doctrineData);
	useEffect(() => {
		if(!doc){ loadDoctrine().then((d) => { doctrineData = d; setDoc(d); }).catch(() => {}); }
	}, []);
	const s = (analysis && analysis.settings) || {};
	const mens = ASK_TO_MEN[s.askType] || ['求事'];
	const lore = currentGuaName ? guaLoreOf(currentGuaName) : null;
	const isIllness = s.askType === 'illness' || s.askType === 'doctor';
	const isThief = s.askType === 'thief' || s.askType === 'lost';
	return (
		<div>
			{lore ? <Card title="本卦历史占例(诸卦得之例)"><div>{lore.who}{lore.event},{lore.result}{lore.note ? <span style={{ color: C.muted }}>(勘注:{lore.note})</span> : ''}</div></Card> : null}
			{mens.map((men) => BIANYAO_FA[men] ? (
				<Card key={men} title={`鬼谷辨爻法·${men}`}>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12 }}>
						{BIANYAO_FA[men].map((v, i) => <span key={i} style={{ background: C.accentSoft, borderRadius: 8, padding: '1px 8px' }}>{['初', '二', '三', '四', '五', '上'][i]}爻·{v}</span>)}
					</div>
				</Card>
			) : null)}
			{isIllness ? (
				<div>
					<Card title="疾病对照(病位三套/症候/治法/祭禳)">
						<KV obj={{ 爻位病位甲: BING_WEI.yaoSunBin.join('/'), 爻位病位乙: BING_WEI.yaoYuanGui.join('/'), 卦宫病位: Object.keys(BING_WEI.baguaGong).map((k) => k + BING_WEI.baguaGong[k]).join('、') }} />
						<KV obj={GUI_ZHENG.细} />
						<KV obj={YAO_FANG.药型} />
						<KV obj={JI_RANG} />
						<div style={{ color: C.muted, fontSize: 12 }}>{YAO_FANG.忌食}</div>
					</Card>
					<Card title="占病凶卦表(多家并存)">
						{SIGUA_ILLNESS.map((t, i) => <div key={i} style={{ fontSize: 12 }}><b style={{ color: C.label }}>{t.source}</b>:{t.guas.join('、')}{t.note ? `(${t.note})` : ''}{t.guas.indexOf(currentGuaName) >= 0 ? <b style={{ color: C.danger }}>　◀本卦命中</b> : ''}</div>)}
					</Card>
				</div>
			) : null}
			{isThief ? (
				<div>
					<Card title="盗贼/遗失对照"><KV obj={ZEI_SHOUFA} /><KV obj={CANG_WU_FANG} /><KV obj={XUN_ZEI_ZONG} /><KV obj={YING_ZEI_WO} /><KV obj={TAO_CANG} /><KV obj={ZOU_FANG_BAGUA} /></Card>
					<Card title="寻物方位小盘(今法·双向量)"><LiuYaoXunWu lines={castLines} /></Card>
				</div>
			) : null}
			<Card title="通用对照(六神案由/祟类/性情/音信/九流/本命)">
				<KV obj={LIUSHEN_SONG} /><KV obj={LIUSHEN_SUI} /><KV obj={XINGGE_ZHI} /><KV obj={YINXIN_BAGUA} /><KV obj={JIULIU_ZISUN} /><KV obj={LIUCHU_BENMING} />
			</Card>
			<Card title="六亲不全卦名单"><KV obj={QUE_LIUQIN} /></Card>
			{s.askType === 'children' ? <Card title="田禾/蚕桑对照"><KV obj={TIANHE_GUI} /><div style={{ fontSize: 12 }}>鬼临各爻(蚕):{CAN_GUI_YAO.map((v, i) => `${i + 1}爻${v}`).join('、')}</div></Card> : null}
			{currentGuaName && NIUMA_GUA[currentGuaName] ? <Card title="卦名直断(牛马章)"><div>{currentGuaName}:{NIUMA_GUA[currentGuaName]}</div></Card> : null}
			<Card title="歌赋断语库(断易天机·按占测事项筛选)">
				{doc ? (() => {
					const keys = Object.keys(doc);
					const words = ASK_TO_DOCTRINE[s.askType] || [];
					const hit = keys.filter((k) => words.some((w) => k.indexOf(w) >= 0));
					const zong = keys.find((k) => k.indexOf('总断') >= 0);
					const show = (zong ? [zong] : []).concat(hit.filter((k) => k !== zong));
					return (
						<div>
							{show.map((k, i) => <DoctrineMen key={k} men={k} rows={doc[k]} defaultOpen={i === (show.length > 1 ? 1 : 0)} />)}
							<div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>全库 {keys.length} 门 {keys.reduce((n, k) => n + doc[k].length, 0)} 条;正文照录原书,括注与今注为整理性文字。</div>
						</div>
					);
				})() : <div style={{ color: C.muted, fontSize: 12 }}>断语库载入中…</div>}
			</Card>
		</div>
	);
}
