// 改造化煞（registry 第三派）。契约见 ./registry.js。
// 🔴 snapshotLines 只回正文行；段头由 LiqiWorkspace.buildSnapshot 统一冠。
import React from 'react';
import { huasha } from '../huasha';
import { XINGSHA_20, QISHA_TRIGGER, BUPIAN_5 } from '../fengshuiHuashaData';
import { POS_NAME, SHAN_ORDER, GONG_GUA } from '../fengshuiData';
import EightPalaceDisk from '../charts/EightPalaceDisk';

const GONG8 = [1, 2, 3, 4, 6, 7, 8, 9];
const GONG_OPTS = [{ value: '0', label: '（未登记）' }, ...GONG8.map((g)=>({ value: String(g), label: POS_NAME[g] }))];
const XIANG_OPTS = SHAN_ORDER.map((s)=>({ value: s, label: `向${s}` }));
const YUN_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n)=>({ value: String(n), label: `${n}运` }));
const TRIG_OPTS = [{ value: '', label: '（未录）' }, ...QISHA_TRIGGER.map((t)=>({ value: t.key, label: t.label }))];
const JX = (jx)=>(jx === 'good' ? 'good' : (jx === 'bad' ? 'bad' : ''));

export const defaults = {
	zhaiType: 'yang', xiangShan: '午', yun: 9,
	xingSha: [], env: {}, year: new Date().getFullYear(),
	lishiGong: 0, duTianGong: 0, anJianGong: 0,
	zuoShanForRike: '', lingXingUse: '', lingXingShangShan: false,
};

export function compute(p) { return huasha(p); }

export function Params({ p, patch, ui }) {
	const { sel, segField, numField } = ui;
	const shaOf = (key)=>(p.xingSha || []).find((s)=>s.key === key) || null;
	const toggleSha = (key)=>{
		const cur = (p.xingSha || []).slice();
		const i = cur.findIndex((s)=>s.key === key);
		if (i >= 0) { cur.splice(i, 1); } else { cur.push({ key, gong: 0 }); }
		patch({ xingSha: cur });
	};
	const setShaGong = (key, gong)=>{
		const cur = (p.xingSha || []).map((s)=>(s.key === key ? { ...s, gong: Number(gong) || 0 } : s));
		patch({ xingSha: cur });
	};
	return (<>
		<div className="horosa-fengshui-liqi-subhead">宅类与飞星盘</div>
		{segField('宅类', p.zhaiType, [{ value: 'yang', label: '阳宅' }, { value: 'yin', label: '阴宅' }], (v)=>patch({ zhaiType: v }))}
		{sel('向首（取飞星盘）', p.xiangShan, XIANG_OPTS, (v)=>patch({ xiangShan: v }))}
		{sel('元运', String(p.yun), YUN_OPTS, (v)=>patch({ yun: +v }))}
		{numField('年份（日课煞）', p.year, (v)=>patch({ year: +v || p.year }), { min: 1864, max: 2043 })}
		{sel('坐山（岁破对校·空=只判方位）', p.zuoShanForRike, [{ value: '', label: '（不校坐山）' }, ...SHAN_ORDER.map((s)=>({ value: s, label: `坐${s}` }))], (v)=>patch({ zuoShanForRike: v }))}

		<div className="horosa-fengshui-liqi-subhead">八方实况（气煞发不发的闸）</div>
		{GONG8.map((g)=>sel(`${POS_NAME[g]}方`, p.env[g] || '', TRIG_OPTS, (v)=>patch({ env: { ...p.env, [g]: v } }), `hsenv-${g}`))}

		<div className="horosa-fengshui-liqi-subhead">形煞二十（勾选并登记受煞方）</div>
		{XINGSHA_20.map((x)=>{
			const on = !!shaOf(x.key);
			return (<div key={`hsx-${x.key}`}>
				{segField(x.name, on ? 'y' : 'n', [{ value: 'y', label: '犯' }, { value: 'n', label: '否' }], ()=>toggleSha(x.key), `hsx-${x.key}`)}
				{on ? sel(`　${x.name}·受煞方`, String((shaOf(x.key) || {}).gong || 0), GONG_OPTS, (v)=>setShaGong(x.key, v), `hsg-${x.key}`) : null}
			</div>);
		})}

		<div className="horosa-fengshui-liqi-subhead">令星煞</div>
		{p.zhaiType === 'yin'
			? segField('当令向星上山', p.lingXingShangShan ? 'y' : 'n', [{ value: 'y', label: '是' }, { value: 'n', label: '否' }], (v)=>patch({ lingXingShangShan: v === 'y' }))
			: sel('当令向星之宫作何用', p.lingXingUse, [{ value: '', label: '（未错位）' },
				{ value: 'zao', label: '厨房灶位' }, { value: 'wei', label: '卫生间' }, { value: 'chu', label: '储藏间' }], (v)=>patch({ lingXingUse: v }))}

		<div className="horosa-fengshui-liqi-subhead">传本未给判据者（须自行登记宫位）</div>
		{sel('力士所临之宫', String(p.lishiGong || 0), GONG_OPTS, (v)=>patch({ lishiGong: +v }))}
		{sel('戊己都天所临之宫', String(p.duTianGong || 0), GONG_OPTS, (v)=>patch({ duTianGong: +v }))}
		{sel('暗建煞所临之宫', String(p.anJianGong || 0), GONG_OPTS, (v)=>patch({ anJianGong: +v }))}
	</>);
}

export function Chart({ result }) {
	const r = result;
	// 🔴 复用既有 EightPalaceDisk：自造 div + 自造类名在样式表里没有定义，
	//    中栏会退化成无样式裸文本（真机只读 innerText 时看不出来，此坑已入哨兵）。
	const byGong = {};
	const put = (g, tag, name, jx)=>{
		if (!g) { return; }
		if (!byGong[g]) { byGong[g] = { gong: g, gua: GONG_GUA[g], dir: POS_NAME[g], items: [], jx: '' }; }
		byGong[g].items.push(`${tag}·${name}`);
		if (jx === 'bad') { byGong[g].jx = 'bad'; }
	};
	r.xingSha.forEach((x)=>put(x.gong, '形', x.name, 'bad'));
	r.qiShaRike.filter((x)=>x.hit !== false).forEach((x)=>put(x.gong, '日', x.name, x.fires ? 'bad' : ''));
	r.qiShaLiqi.forEach((x)=>put(x.gong, '理', x.name, x.fires ? 'bad' : ''));
	if (r.lingXing && r.lingXing.hit && r.lingXing.gong) { put(r.lingXing.gong, '理', '令星煞', 'bad'); }
	const palaces = Object.keys(byGong).map((g)=>{
		const c = byGong[g];
		return { gong: c.gong, gua: c.gua, dir: c.dir,
			// 数组:两条煞名各占一行(挤成一行会被截掉尾字,实测「理·先后天火煞」丢过「火煞」)
			primary: String(c.items.length), secondary: c.items.slice(0, 2), jx: c.jx };
	});
	return (
		<div className="horosa-fengshui-chart-stack">
			<EightPalaceDisk palaces={palaces} centerLabel={`化煞 ${r.total} 项`} size={620} />
			<div className="horosa-fengshui-liufa-board">
				<div className={`horosa-fs-liufa-sum ${JX(r.verdict.jx)}`}>{r.verdict.text}</div>
			</div>
		</div>
	);
}

export function Panel({ result, ui }) {
	const { card, row } = ui;
	const r = result;
	return (<>
		{card('总断', <>{row('结论', r.verdict.text, JX(r.verdict.jx))}
			{row('远近之限', r.yuanJin)}
			{row('危害三等', r.weiHai3.map((w)=>`${w.level}：${w.text}`).join('；'))}</>)}

		{r.xingSha.length ? card(`形煞（${r.xingSha.length} 项）`, r.xingSha.map((x)=>(
			<div key={`hp-${x.key}`}>
				{row(`${x.name}${x.dir ? `·${x.dir}` : ''}`, x.def, 'bad', `hpd-${x.key}`)}
				{row('　危害', x.harm, '', `hph-${x.key}`)}
				{x.ying ? row('　应人', x.ying, '', `hpy-${x.key}`) : null}
				{row('　化解', x.fixList.map((f, i)=>`${i + 1}. ${f}`).join('　'), 'good', `hpf-${x.key}`)}
			</div>
		))) : null}

		{r.qiShaRike.length ? card(`气煞·日课类（力猛而速${r.year ? `　${r.year} 年` : ''}）`, r.qiShaRike.map((x)=>(
			<div key={`hr-${x.key}`}>
				{row(`${x.name}${x.dir ? `·${x.dir}` : ''}`, `${x.detail || x.def}${x.fires ? '　【该方有动象/恶山恶水，须即化解】' : '　（该方安静无动象，一般不出灾）'}`,
					x.hit === false ? '' : (x.fires ? 'bad' : ''), `hrd-${x.key}`)}
				{x.note ? row('　口径', x.note, 'neutral', `hrn-${x.key}`) : null}
				{x.hit === false ? null : row('　化解', x.fixList.join('　'), 'good', `hrf-${x.key}`)}
			</div>
		))) : null}

		{r.qiShaLiqi.length ? card(`气煞·理气类（力大而缓·${r.qiShaLiqi.length} 项）`, r.qiShaLiqi.map((x, i)=>(
			<div key={`hl-${x.key}-${x.gong}-${i}`}>
				{row(`${x.name}·${x.dir}`, `${x.label}（山${x.stars.shan}·向${x.stars.xiang}·运${x.stars.yun}）`
					+ `${x.fires ? '　【该方有动象/恶山恶水，须即化解】' : '　（该方安静无动象，一般不出灾）'}`, x.fires ? 'bad' : '', `hld-${x.key}-${x.gong}`)}
				{row('　危害', x.harm, '', `hlh-${x.key}-${x.gong}`)}
				{x.conflict ? row('　存疑', x.conflict, 'neutral', `hlc-${x.key}-${x.gong}`) : null}
				{row('　化解', x.fixList.map((f, k)=>`${k + 1}. ${f}`).join('　'), 'good', `hlf-${x.key}-${x.gong}`)}
			</div>
		))) : null}

		{r.lingXing ? card('令星煞', <>
			{row('当令向星', `${r.lingXing.wangXiangStar} 居 ${r.lingXing.dir || '—'}`)}
			{row('判定', r.lingXing.verdict.text, JX(r.lingXing.verdict.jx))}
			{row('释义', r.lingXing.def)}
			{r.lingXing.hit ? row('危害', r.lingXing.harm, 'bad') : null}
			{r.lingXing.hit ? row('化解', r.lingXing.fixList.map((f, i)=>`${i + 1}. ${f}`).join('　'), 'good') : null}
		</>) : null}

		{r.wupin.length ? card('本案所需化解用品', r.wupin.map((w)=>row(w.name, w.use, '', `hw-${w.key}`))) : null}

		{card('补偏救弊五法', BUPIAN_5.map((b)=>row(b.name, `【${b.when}】${b.how}`, '', `hb-${b.key}`)))}
		{card('形煞之物四类', r.leibie.map((l)=>row(l.name, l.items, '', `hlb-${l.name}`)))}
		<div className="horosa-fengshui-liqi-note">{r.qiShaNote}</div>
		<div className="horosa-fengshui-liqi-note">{r.note}</div>
	</>);
}

export function snapshotLines(r) {
	const L = [];
	L.push(`${r.isYin ? '阴宅' : '阳宅'} ${r.xiangShan ? `向${r.xiangShan} ` : ''}${r.yun}运 · ${r.verdict.text}`);
	if (r.xingSha.length) {
		L.push('形煞：' + r.xingSha.map((x)=>`${x.name}${x.dir ? `(${x.dir})` : ''}—${x.harm}`).join('；'));
		L.push('形煞化解：' + r.xingSha.map((x)=>`${x.name}→${x.fixList.join('／')}`).join('；'));
	}
	const rk = r.qiShaRike.filter((x)=>x.hit !== false);
	if (rk.length) {
		L.push('气煞·日课：' + rk.map((x)=>`${x.name}${x.dir ? `(${x.dir})` : ''}${x.fires ? '·有动象须化' : '·静无灾'}`).join('；'));
	}
	if (r.qiShaLiqi.length) {
		L.push('气煞·理气：' + r.qiShaLiqi.map((x)=>`${x.dir}${x.name}(山${x.stars.shan}向${x.stars.xiang}运${x.stars.yun})${x.fires ? '·有动象须化' : '·静无灾'}`).join('；'));
	}
	if (r.lingXing && r.lingXing.hit) { L.push(`令星煞：${r.lingXing.verdict.text}（当令向星 ${r.lingXing.wangXiangStar} 居 ${r.lingXing.dir}）`); }
	if (r.wupin.length) { L.push('化解用品：' + r.wupin.map((w)=>w.name).join('、')); }
	L.push(`口径：${r.qiShaNote}`);
	return L;
}

export default { defaults, compute, Params, Chart, Panel, snapshotLines };
