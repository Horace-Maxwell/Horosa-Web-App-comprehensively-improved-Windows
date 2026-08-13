// 大玄空（单盘挨星）· 派模块（registry 范式首派）。
// 契约见 ./registry.js：{ defaults, compute, Params, Chart, Panel, snapshotLines }。
// 🔴 snapshotLines 只回正文行，段头【风水·派名】由 LiqiWorkspace.buildSnapshot 统一冠 —— 自带段头会产双段头、
//    被 AI 导出的段过滤器当独立段切坏。
import React from 'react';
import EightPalaceDisk from '../charts/EightPalaceDisk';
import { daxuankong } from '../daxuankong';
import { SHAN_ORDER, YUN_YEARS } from '../fengshuiData';
import { DAXUANKONG_ENV_OPTS, DAXUANKONG_ENV_CN } from '../fengshuiLiqiDeepData';

const SHAN_OPTS = SHAN_ORDER.map((s)=>({ value: s, label: s }));
const YUN_OPTS = Object.keys(YUN_YEARS).map((y)=>({ value: +y, label: `${y}运 ${YUN_YEARS[y][0]}–${YUN_YEARS[y][1]}` }));
const ZHAI_OPTS = [{ value: 'yang', label: '阳宅' }, { value: 'yin', label: '阴宅(父母星)' }];
const HALF_OPTS = [{ value: 'first', label: '前十年(归上元)' }, { value: 'second', label: '后十年(归下元)' }];
const ENV_GONGS = [
	{ gong: 1, label: '坎(北)' }, { gong: 2, label: '坤(西南)' }, { gong: 3, label: '震(东)' }, { gong: 4, label: '巽(东南)' },
	{ gong: 6, label: '乾(西北)' }, { gong: 7, label: '兑(西)' }, { gong: 8, label: '艮(东北)' }, { gong: 9, label: '离(南)' },
];
const JX_CLASS = (jx)=>(jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-warn' : ''));

export const defaults = {
	zuoShan: '子', yun: 9, wuYunHalf: 'first', zhaiType: 'yang', envs: {},
	year: new Date().getFullYear(),
};

export function compute(p) {
	return daxuankong({
		zuoShan: p.zuoShan, yun: p.yun, wuYunHalf: p.wuYunHalf,
		zhaiType: p.zhaiType, envs: p.envs, year: p.year,
	});
}

export function Params({ p, patch, ui }) {
	const { sel, segField } = ui;
	return (<>
		{segField('阴阳宅', p.zhaiType, ZHAI_OPTS, (v)=>patch({ zhaiType: v }))}
		{sel('元运', p.yun, YUN_OPTS, (v)=>patch({ yun: +v }))}
		{p.yun === 5 ? segField('五运归属', p.wuYunHalf, HALF_OPTS, (v)=>patch({ wuYunHalf: v })) : null}
		{sel('坐山', p.zuoShan, SHAN_OPTS, (v)=>patch({ zuoShan: v }))}
		<div className="horosa-fengshui-liqi-subhead">八方形势（正神宜满·零神宜空）</div>
		{ENV_GONGS.map((g)=>sel(g.label, p.envs[g.gong] || '', DAXUANKONG_ENV_OPTS,
			(v)=>patch({ envs: { ...p.envs, [g.gong]: v } }), `dxk-env-${g.gong}`))}
	</>);
}

export function Chart({ result }) {
	const palaces = result.palaces.map((x)=>({
		gong: x.gong, gua: x.gua, dir: x.dir,
		primary: `${x.star}`,
		secondary: x.env ? `${x.roleName.slice(0, 2)}·${DAXUANKONG_ENV_CN[x.env] || ''}` : x.roleName.slice(0, 2),
		jx: x.jx,
	}));
	return (
		<div className="horosa-fengshui-chart-stack">
			<EightPalaceDisk palaces={palaces} centerLabel={`${result.center}入中·${result.forward ? '顺' : '逆'}`} size={620} />
			<div className="horosa-fengshui-liufa-board">
				<div className={`horosa-fs-liufa-item ${JX_CLASS(result.ju.jx)}`}>
					<div className="lf-name">{result.ju.key === 'he' ? '合局' : (result.ju.key === 'fan' ? '反局' : '合反待定')}</div>
					<div className="lf-verdict">{result.ju.text}</div>
				</div>
				<div className={`horosa-fs-liufa-sum ${JX_CLASS(result.ju.jx)}`}>
					{result.yuanLabel} · 正神 {result.zhengStars.join('')} / 零神 {result.lingStars.join('')}（合 {result.goodN} · 反 {result.badN}）
				</div>
			</div>
		</div>
	);
}

export function Panel({ result, ui }) {
	const { card, row } = ui;
	const r = result;
	return (<>
		{card(`起盘（${r.zhaiType === 'yin' ? '阴宅·父母星' : '阳宅·挨星'}）`, <>
			{row('坐山', `${r.zuoShan}（${r.zuoGua || '—'}宫）`, 'good')}
			{row('入中星', `${r.center}${r.zhaiType === 'yin' ? '（父母星）' : ''} · ${r.centerNature.roleName}${r.centerNature.yinYang ? `（${r.centerNature.yinYang}星）` : ''}`)}
			{row('飞布', r.forward ? '顺飞' : '逆飞')}
			{row('元属', `${r.yuanLabel}${r.wuYunHalf ? `（五运${r.wuYunHalf === 'second' ? '后' : '前'}十年）` : ''}`)}
		</>)}
		{r.wuHuangNote ? <div className="horosa-fengshui-liqi-note">{r.wuHuangNote}</div> : null}
		{card('八宫挨星', r.palaces.map((p)=>row(
			`${p.gua}${p.isZuo ? '·坐' : (p.isXiang ? '·向' : '')}`,
			`${p.star} ${p.roleName.slice(0, 2)}${p.env ? ` · ${p.envCn}` : ''}${p.verdict ? ` → ${p.verdict}` : ''}`,
			p.jx === 'neutral' ? '' : p.jx, `dxk-p-${p.gong}`)))}
		{card('合局判定', <>
			{row('结论', r.ju.text, r.ju.jx === 'neutral' ? '' : r.ju.jx)}
			{r.palaces.filter((p)=>p.poLing).map((p)=>row('水破令星', `${p.gua}方当令星${p.star}见去水口·主损丁`, 'bad', `dxk-pl-${p.gong}`))}
			{r.palaces.filter((p)=>p.star === 5 && p.env).map((p)=>row('五黄水法', `${p.gua}方 ${p.wuHuangWarn}`, p.env === 'qu' ? 'bad' : '', `dxk-wh-${p.gong}`))}
			{r.palaces.filter((p)=>p.heShi).map((p)=>row('合十主财', `${p.gua}方挨星${p.star}与${r.yun}运合十`, 'good', `dxk-hs-${p.gong}`))}
			{r.palaces.filter((p)=>p.heSC).map((p)=>row('合生成主贵', `${p.gua}方挨星${p.star}与${r.yun}运合生成`, 'good', `dxk-sc-${p.gong}`))}
		</>)}
		{card('断应（八条）', r.duanying.map((d)=>row(d.title, d.text, '', `dxk-dy-${d.key}`)))}
		<div className="horosa-fengshui-liqi-note">{r.note}</div>
	</>);
}

// 只回正文行；段头由宿主统一冠。
export function snapshotLines(r) {
	const L = [];
	L.push(`坐${r.zuoShan}（${r.zuoGua || '—'}宫）${r.yun}运 · ${r.yuanLabel} · ${r.zhaiType === 'yin' ? '阴宅(父母星)' : '阳宅(挨星)'}`);
	L.push(`${r.center}入中${r.centerNature.yinYang ? `（${r.centerNature.roleName}·${r.centerNature.yinYang}星）` : `（${r.centerNature.roleName}）`} · ${r.forward ? '顺飞' : '逆飞'}`);
	L.push('八宫挨星：' + r.palaces.map((p)=>`${p.gua}${p.star}${p.env ? `(${p.envCn})` : ''}`).join(' '));
	L.push(`正神 ${r.zhengStars.join('')} / 零神 ${r.lingStars.join('')} · ${r.ju.text}（合${r.goodN}·反${r.badN}）`);
	const warn = r.palaces.filter((p)=>p.jx === 'bad');
	if (warn.length) { L.push('警示：' + warn.map((p)=>`${p.gua}方${p.verdict || p.wuHuangWarn}`).join('；')); }
	const good = r.palaces.filter((p)=>p.heShi || p.heSC);
	if (good.length) { L.push('合十合生成：' + good.map((p)=>`${p.gua}方${p.star}${p.heShi ? '合十主财' : '合生成主贵'}`).join('；')); }
	if (r.wuHuangNote) { L.push(r.wuHuangNote); }
	return L;
}

export default { defaults, compute, Params, Chart, Panel, snapshotLines };
