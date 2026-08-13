// 水龙 · 平洋水法（registry 第二派）。契约见 ./registry.js。
// 🔴 snapshotLines 只回正文行；段头由 LiqiWorkspace.buildSnapshot 统一冠。
import React from 'react';
import { shuilong } from '../shuilong';
import {
	DIXING_5, SHUILONG_4JI, SHUI_8JI_ZI, SHUI_8XIONG_ZI, SHUILONG_XUE_6, SHUILONG_3GE,
	XIDAO_LOUDAO, XIU_CHI_LONG, ZHAOSHEN, SHUILONG_JIGE, SHUILONG_XIONGGE, SHUILONG_WUXING,
} from '../fengshuiShuilongData';

const optsOf = (arr, get, blank = '（不定）')=>[{ value: '', label: blank }, ...arr.map(get)];
const DIXING_OPTS = DIXING_5.map((d)=>({ value: d, label: d }));
const JX_CLASS = (jx)=>(jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-warn' : ''));

export const defaults = {
	dixing: '平原', pingGangJianShui: true, ji: '', xuanwu: '', chanRao: 1,
	jiZi: [], xiongZi: [], xueXing: '', geKey: '', xidao: '', huanbao: 0, zhuanzhe: 0,
	xiuchi: '', houKong: null, zhaoshen: '', jiGe: '', xiongGe: '', wuxing: '',
};

export function compute(p) { return shuilong(p); }

export function Params({ p, patch, ui }) {
	const { sel, segField, numField } = ui;
	const toggleArr = (key, v)=>{
		const cur = new Set(p[key] || []);
		if (cur.has(v)) { cur.delete(v); } else { cur.add(v); }
		patch({ [key]: Array.from(cur) });
	};
	return (<>
		<div className="horosa-fengshui-liqi-subhead">分派</div>
		{sel('地形', p.dixing, DIXING_OPTS, (v)=>patch({ dixing: v }))}
		{p.dixing === '平冈' ? segField('平冈见水', p.pingGangJianShui ? 'y' : 'n', [{ value: 'y', label: '见水(归水龙)' }, { value: 'n', label: '不见水(归山龙)' }], (v)=>patch({ pingGangJianShui: v === 'y' })) : null}
		<div className="horosa-fengshui-liqi-subhead">龙（水）</div>
		{sel('水龙四级', p.ji, optsOf(SHUILONG_4JI, (x)=>({ value: x.name, label: x.name })), (v)=>patch({ ji: v }))}
		{segField('玄武之水', p.xuanwu || 'na', [{ value: 'rao', label: '绕抱' }, { value: 'na', label: '未定' }, { value: 'ge', label: '直横/反跳(割脉)' }], (v)=>patch({ xuanwu: v === 'na' ? '' : v }))}
		{numField('枝水缠护层数', p.chanRao, (v)=>patch({ chanRao: Math.max(1, Math.min(3, +v || 1)) }), { min: 1, max: 3 })}
		{numField('环抱重数', p.huanbao, (v)=>patch({ huanbao: Math.max(0, Math.min(9, +v || 0)) }), { min: 0, max: 9 })}
		{numField('水之转折数', p.zhuanzhe, (v)=>patch({ zhuanzhe: Math.max(0, Math.min(9, +v || 0)) }), { min: 0, max: 9 })}
		<div className="horosa-fengshui-liqi-subhead">水形八字（吉）</div>
		{SHUI_8JI_ZI.map((z)=>segField(`${z.zi}（${z.def}）`, (p.jiZi || []).indexOf(z.zi) >= 0 ? 'y' : 'n',
			[{ value: 'y', label: '合' }, { value: 'n', label: '否' }], ()=>toggleArr('jiZi', z.zi), `jz-${z.zi}`))}
		<div className="horosa-fengshui-liqi-subhead">水形八字（凶）</div>
		{SHUI_8XIONG_ZI.map((z)=>segField(`${z.zi}（${z.def}）`, (p.xiongZi || []).indexOf(z.zi) >= 0 ? 'y' : 'n',
			[{ value: 'y', label: '犯' }, { value: 'n', label: '否' }], ()=>toggleArr('xiongZi', z.zi), `xz-${z.zi}`))}
		<div className="horosa-fengshui-liqi-subhead">穴 / 格</div>
		{sel('水龙穴形', p.xueXing, optsOf(SHUILONG_XUE_6, (x)=>({ value: x.name, label: `${x.name}（${x.def}）` })), (v)=>patch({ xueXing: v }))}
		{sel('水龙三大格', p.geKey, optsOf(SHUILONG_3GE, (x)=>({ value: x.key, label: x.name })), (v)=>patch({ geKey: v }))}
		{sel('息道/漏道', p.xidao, optsOf(XIDAO_LOUDAO, (x)=>({ value: x.name, label: `${x.name}（${x.def.slice(0, 12)}…）` })), (v)=>patch({ xidao: v }))}
		{segField('穴后', p.houKong === true ? 'kong' : (p.houKong === false ? 'gao' : 'na'), [{ value: 'kong', label: '空/有吉水' }, { value: 'na', label: '未定' }, { value: 'gao', label: '高' }], (v)=>patch({ houKong: v === 'kong' ? true : (v === 'gao' ? false : null) }))}
		{sel('水龙五星', p.wuxing, optsOf(['金', '水', '土', '木', '火'], (x)=>({ value: x, label: `${x}星（${SHUILONG_WUXING.ji.indexOf(x) >= 0 ? '吉' : '忌'}）` })), (v)=>patch({ wuxing: v }))}
		<div className="horosa-fengshui-liqi-subhead">格局 / 照神</div>
		{sel('水龙吉格', p.jiGe, optsOf(SHUILONG_JIGE, (x)=>({ value: x.name, label: `${x.name}(${x.n}图)` })), (v)=>patch({ jiGe: v }))}
		{sel('水龙凶格', p.xiongGe, optsOf(SHUILONG_XIONGGE, (x)=>({ value: x.name, label: x.name })), (v)=>patch({ xiongGe: v }))}
		{sel('秀龙/痴龙', p.xiuchi, optsOf(XIU_CHI_LONG, (x)=>({ value: x.name, label: x.name })), (v)=>patch({ xiuchi: v }))}
		{sel('照神', p.zhaoshen, optsOf(ZHAOSHEN, (x)=>({ value: x.when, label: x.when })), (v)=>patch({ zhaoshen: v }))}
	</>);
}

export function Chart({ result }) {
	const r = result;
	return (
		<div className="horosa-fengshui-chart-stack">
			<div className="horosa-fengshui-xingshi-board">
				<div className={`horosa-fengshui-xingshi-total ${JX_CLASS(r.grade.jx)}`}>
					<div className="xt-num">{r.total}</div><div className="xt-lbl">{r.grade.text}</div>
				</div>
				<div className="horosa-fengshui-xingshi-bars">
					{r.items.map((it)=>(
						<div key={it.key} className="horosa-fengshui-xingshi-bar">
							<span className="xb-key">{it.name}</span>
							<span className={`xb-score ${JX_CLASS(it.jx)}`}>{it.score > 0 ? `+${it.score}` : it.score}</span>
						</div>
					))}
				</div>
			</div>
			<div className="horosa-fengshui-liufa-board">
				<div className={`horosa-fs-liufa-item ${JX_CLASS(r.pai.fa === 'shui' ? 'good' : 'neutral')}`}>
					<div className="lf-name">{r.pai.label}</div>
					<div className="lf-verdict">{r.pai.by}</div>
				</div>
				{r.items.filter((it)=>it.jx === 'bad').map((it)=>(
					<div key={it.key} className="horosa-fs-liufa-item is-warn">
						<div className="lf-name">{it.name}</div><div className="lf-verdict">{it.verdict}</div>
					</div>
				))}
				<div className={`horosa-fs-liufa-sum ${JX_CLASS(r.grade.jx)}`}>
					{r.priority.text}（合 {r.goodN} · 违 {r.badN}）
				</div>
			</div>
		</div>
	);
}

export function Panel({ result, ui }) {
	const { card, row } = ui;
	const r = result;
	return (<>
		{card('分派', <>{row('地形→龙法', `${r.pai.label}`, r.pai.fa === 'shui' ? 'good' : '')}
			{row('判据', r.pai.by)}{row('尺度', r.gaocun)}
			<div className="horosa-fengshui-liqi-note">{r.dixingEquivNote}</div></>)}
		{r.items.length ? card('逐项判定', r.items.map((it)=>row(it.name, `${it.verdict}（${it.score > 0 ? '+' : ''}${it.score}）`, it.jx === 'neutral' ? '' : it.jx, `sl-${it.key}`))) : null}
		{r.ge ? card(`立向建议（${r.ge.name}）`, <>
			{r.lixiang.map((l, i)=>row(l.when, `${l.how}${l.note ? `——${l.note}` : ''}`, 'good', `lx-${i}`))}
			{r.ge.houyin ? row('后荫门槛', r.ge.houyin, 'neutral') : null}
			{r.ge.zhuyi ? row('注意', r.ge.zhuyi, 'neutral') : null}
		</>) : null}
		{r.ji ? card('规模判读', r.guimo.map((g)=>row(`${g.size}者`, g.jie, '', `gm-${g.size}`))) : null}
		{card('平洋四原则', r.siYuanZe.map((y)=>row(y.name, y.pt, '', `py-${y.name}`)))}
		{card('葬法与穴后', <>
			{row('穴后', r.houkongRule.jue, 'neutral')}
			{row('离水', r.houkongRule.dist)}
			{row('葬深', `${r.zangfa.shen}；${r.zangfa.jinji}`, 'bad')}
			{row('附加', r.zangfa.fujia)}
		</>)}
		{card('开面判据', row('平洋开面', r.kaimian, 'neutral'))}
		<div className="horosa-fengshui-liqi-note">{r.note}</div>
	</>);
}

export function snapshotLines(r) {
	const L = [];
	L.push(`分派：${r.pai.label}（${r.pai.by}）· ${r.gaocun}`);
	if (r.items.length) { L.push('逐项：' + r.items.map((it)=>`${it.name}${it.verdict}(${it.score > 0 ? '+' : ''}${it.score})`).join('；')); }
	L.push(`总分 ${r.total} · ${r.grade.text}（合${r.goodN}·违${r.badN}）`);
	if (r.ge) { L.push(`三大格：${r.ge.name} → 立向 ${r.lixiang.map((l)=>`${l.when}宜${l.how}`).join('；')}`); }
	if (r.jiZi.length || r.xiongZi.length) { L.push(`水形字：吉[${r.jiZi.join('')}] 凶[${r.xiongZi.join('')}]`); }
	L.push(r.priority.text);
	L.push(r.note);
	return L;
}

export default { defaults, compute, Params, Chart, Panel, snapshotLines };
