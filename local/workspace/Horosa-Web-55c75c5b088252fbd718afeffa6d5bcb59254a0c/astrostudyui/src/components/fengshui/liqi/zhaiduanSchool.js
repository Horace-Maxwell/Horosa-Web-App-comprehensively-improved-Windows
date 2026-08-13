// 阳宅判断与选择（registry 第四派）。契约见 ./registry.js。
// 🔴 snapshotLines 只回正文行；段头由 LiqiWorkspace.buildSnapshot 统一冠。
import React from 'react';
import { zhaiduan } from '../zhaiduan';
import { XIONGGE_10, NEI_JU_5, NEIJU_XINGXING_10, NEIJU_LIQI_2, WAI_LIUSHI_YAO, ZHAI_XING_8 } from '../fengshuiZhaiduanData';
import { POS_NAME, SHAN_ORDER, GONG_GUA } from '../fengshuiData';
import { YANGZHAI_30, YANGZHAI_30_NOTE } from '../fengshuiDuanyuData';
import EightPalaceDisk from '../charts/EightPalaceDisk';

const GONG8 = [1, 2, 3, 4, 6, 7, 8, 9];
const GONG_OPTS = [{ value: '0', label: '（未登记）' }, ...GONG8.map((g)=>({ value: String(g), label: POS_NAME[g] }))];
const XIANG_OPTS = SHAN_ORDER.map((s)=>({ value: s, label: `向${s}` }));
const YUN_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n)=>({ value: String(n), label: `${n}运` }));
const WAI_OPTS = [{ value: '', label: '（未录）' }, { value: 'shan', label: '高起之物（山）' }, { value: 'shui', label: '属水之物（水）' }];
const JX = (jx)=>(jx === 'good' ? 'good' : (jx === 'bad' ? 'bad' : ''));
const ALL_NEI = NEIJU_XINGXING_10.concat(NEIJU_LIQI_2);
const CONF_CN = { high: '高', medium: '中', low: '低' };

export const defaults = {
	xiangShan: '午', yun: 9, isCity: true,
	waiJu: {}, qiaoGong: 0, neiJu: {}, xiongGe: [], neiXiong: {}, year: new Date().getFullYear(),
};

// env.geo 由宿主自画布现取（含 gongAt 函数），不入存档；无画布时 geo 为 null → 几何检测整块不判。
export function compute(p, env) { return zhaiduan({ ...p, geo: (env && env.geo) || null }); }

export function Params({ p, patch, ui }) {
	const { sel, segField, numField } = ui;
	const toggleGe = (k)=>{
		const cur = new Set(p.xiongGe || []);
		if (cur.has(k)) { cur.delete(k); } else { cur.add(k); }
		patch({ xiongGe: Array.from(cur) });
	};
	const toggleAtom = (ck, i)=>{
		const cur = new Set((p.neiXiong || {})[ck] || []);
		if (cur.has(i)) { cur.delete(i); } else { cur.add(i); }
		patch({ neiXiong: { ...(p.neiXiong || {}), [ck]: Array.from(cur).sort((a, b)=>a - b) } });
	};
	return (<>
		<div className="horosa-fengshui-liqi-subhead">起盘与地域</div>
		{sel('向首', p.xiangShan, XIANG_OPTS, (v)=>patch({ xiangShan: v }))}
		{sel('元运', String(p.yun), YUN_OPTS, (v)=>patch({ yun: +v }))}
		{segField('地域', p.isCity ? 'city' : 'country', [{ value: 'city', label: '城市（街路作虚水）' }, { value: 'country', label: '农村（重来龙来去水）' }], (v)=>patch({ isCity: v === 'city' }))}
		{numField('年份（客星断）', p.year, (v)=>patch({ year: +v || p.year }), { min: 1864, max: 2043 })}

		<div className="horosa-fengshui-liqi-subhead">外局 · 外六事（八方各录山/水）</div>
		{GONG8.map((g)=>sel(`${POS_NAME[g]}方`, (p.waiJu || {})[g] || '', WAI_OPTS, (v)=>patch({ waiJu: { ...(p.waiJu || {}), [g]: v } }), `zdw-${g}`))}
		{sel('峤星所在之宫（回风返气）', String(p.qiaoGong || 0), GONG_OPTS, (v)=>patch({ qiaoGong: +v }))}

		<div className="horosa-fengshui-liqi-subhead">内局 · 内六事（各在何宫）</div>
		{NEI_JU_5.map((n)=>sel(n.name, String((p.neiJu || {})[n.key] || 0), GONG_OPTS, (v)=>patch({ neiJu: { ...(p.neiJu || {}), [n.key]: +v } }), `zdn-${n.key}`))}

		<div className="horosa-fengshui-liqi-subhead">阳宅凶格图解（十）</div>
		{XIONGGE_10.map((x)=>segField(`${x.name}（${x.def}）`, (p.xiongGe || []).indexOf(x.key) >= 0 ? 'y' : 'n',
			[{ value: 'y', label: '犯' }, { value: 'n', label: '否' }], ()=>toggleGe(x.key), `zdg-${x.key}`))}

		<div className="horosa-fengshui-liqi-subhead">室内凶局（逐项勾选）</div>
		{ALL_NEI.map((c)=>(<div key={`zdx-${c.key}`}>
			<div className="horosa-fengshui-liqi-subhead">{c.name}</div>
			{c.atoms.map((a, i)=>segField(a, ((p.neiXiong || {})[c.key] || []).indexOf(i) >= 0 ? 'y' : 'n',
				[{ value: 'y', label: '犯' }, { value: 'n', label: '否' }], ()=>toggleAtom(c.key, i), `zdx-${c.key}-${i}`))}
		</div>))}
	</>);
}

export function Chart({ result }) {
	const r = result;
	// 🔴 复用既有 EightPalaceDisk（理由同化煞派：自造类名无样式）。
	const palaces = GONG8.map((g)=>{
		const w = r.waiRows.find((x)=>x.gong === g);
		const ns = r.neiRows.filter((x)=>x.gong === g);
		const isQiao = !!(r.qiao && r.qiao.gong === g);
		if (!w && !ns.length && !isQiao) { return null; }
		const sec = [];
		if (w) { sec.push(`${w.kind === 'shan' ? '山' : '水'}${w.star}${w.ok ? '合' : '违'}`); }
		ns.forEach((n)=>sec.push(`${n.name}${n.ok === true ? '合' : (n.ok === false ? '违' : '')}`));
		if (isQiao) { sec.push('峤星'); }
		return { gong: g, gua: GONG_GUA[g], dir: POS_NAME[g],
			primary: w ? (w.kind === 'shan' ? '山' : '水') : '内',
			secondary: sec.join('／'),
			jx: w ? (w.ok ? 'good' : 'bad') : (ns.some((n)=>n.ok === false) ? 'bad' : (ns.some((n)=>n.ok === true) ? 'good' : '')) };
	}).filter(Boolean);
	return (
		<div className="horosa-fengshui-chart-stack">
			<EightPalaceDisk palaces={palaces}
				centerLabel={r.xiangShou ? `向首${r.xiangShou.star || '—'}` : '未排盘'} size={620} />
			<div className="horosa-fengshui-liufa-board">
				<div className={`horosa-fs-liufa-sum ${JX(r.verdict.jx)}`}>{r.verdict.text}</div>
			</div>
		</div>
	);
}

export function Panel({ result, ui, p, patch }) {
	const { card, row } = ui;
	const r = result;
	// 采纳＝把该条写进左栏「室内凶局」勾选；写入后方计入内局违数与总断（机器不代人下判）。
	const adopt = (ck, i)=>{
		if (typeof patch !== 'function') { return; }
		const cur = new Set(((p || {}).neiXiong || {})[ck] || []);
		cur.add(i);
		patch({ neiXiong: { ...((p || {}).neiXiong || {}), [ck]: Array.from(cur).sort((a, b)=>a - b) } });
	};
	return (<>
		{card('三方合参总断', <>
			{row('结论', r.verdict.text, JX(r.verdict.jx))}
			{r.xiangShou ? row('首重向首', `向首在${r.xiangShou.dir || '—'}，向星 ${r.xiangShou.star || '—'}`
				+ `${r.xiangShou.deLing === null ? '' : (r.xiangShou.deLing ? '·乘元得令' : '·未得令')}；格局 ${r.xiangShou.ge || '—'}`,
			r.xiangShou.deLing ? 'good' : (r.xiangShou.deLing === false ? 'bad' : '')) : null}
			{row('内外合参', r.neiWaiNote)}
		</>)}

		{r.ge.length ? card(`峦头断 · 阳宅凶格（${r.ge.length} 项）`, r.ge.map((x)=>row(x.name, `${x.def}——${x.harm}`, 'bad', `zdge-${x.key}`))) : null}

		{r.waiRows.length || r.qiao ? card('理气断 · 外局（收山出煞）', <>
			{r.waiRows.map((x)=>row(x.dir, x.text, x.ok === null ? '' : (x.ok ? 'good' : 'bad'), `zdwr-${x.gong}`))}
			{r.qiao ? row('峤星', `${r.qiao.note}　${r.qiao.verdict.text}`, JX(r.qiao.verdict.jx)) : null}
			{row('外局小计', `合 ${r.waiOk} · 违 ${r.waiBad}`)}
		</>) : null}

		{card('理气断 · 内局（内六事）', <>
			{r.neiRows.map((n)=>row(`${n.name}${n.dir ? `·${n.dir}` : ''}`, n.verdict, n.ok === null ? '' : (n.ok ? 'good' : 'bad'), `zdnr-${n.key}`))}
			{row('内局小计', `合 ${r.neiOk} · 违 ${r.neiBad}`)}
			<div className="horosa-fengshui-liqi-note">{r.neiJuNote}</div>
		</>)}

		{r.neiXiongRows.length ? card(`室内凶局（${r.neiXiongN} 项）`, r.neiXiongRows.map((x)=>(
			<div key={`zdnx-${x.key}`}>
				{row(`${x.cls}·${x.name}`, x.hits.join('、'), 'bad', `zdnxh-${x.key}`)}
				{row('　口径', x.text, '', `zdnxt-${x.key}`)}
			</div>
		))) : null}

		{r.geoScan ? card(`户型图几何自动检测（检出 ${r.geoScan.hits.length} · 未判 ${r.geoScan.skipped.length}）`, <>
			{row('总述', r.geoScan.verdict.text, JX(r.geoScan.verdict.jx))}
			{r.geoScan.rows.map((x, i)=>(
				<div key={`zdgs-${x.key}-${x.idx}`}>
					{row(`${x.taken ? '✓ 已采纳' : '待核'}·${x.name}`, x.label, x.taken ? 'bad' : '', `zdgsr-${i}`)}
					{row('　凭据', `${x.evidence}（可信度 ${CONF_CN[x.confidence] || x.confidence}）`, '', `zdgse-${i}`)}
					{x.taken ? null : (
						<div className="horosa-fengshui-liqi-note">
							<span className="horosa-fengshui-liqi-adopt" role="button" tabIndex={0}
								onClick={()=>adopt(x.key, x.idx)}
								onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { adopt(x.key, x.idx); } }}>
								采纳此条 → 计入左栏「室内凶局」
							</span>
						</div>
					)}
				</div>
			))}
			{r.geoScan.skipped.length ? row('未判之项', r.geoScan.skipped.map((s)=>`${s.name}（缺${s.missing}）`).join('；'), '') : null}
			<div className="horosa-fengshui-liqi-note">{r.geoScan.note}</div>
		</>) : null}

		{r.keXing ? card(`客星断（${r.keXing.ganZhi}年 · 形气为主·客星为用）`, <>
			{row('大门', `${r.keXing.menDir || '未登记'}——${r.keXing.menWarn.text}`, JX(r.keXing.menWarn.jx))}
			{row('太岁 / 岁破', `太岁在${r.keXing.taisui.dir}；岁破在${r.keXing.suipo.dir}`)}
			{row('年五黄', `${r.keXing.wuHuang.dir || '中宫'}　${r.keXing.wuHuangRule}`, 'bad')}
			{r.keXing.feiTaiSui ? row('飞太岁', `${r.keXing.feiTaiSui.text}　${r.keXing.feiTaiSui.rule}`, 'neutral') : null}
			{r.keXing.shengKe.map((k, i)=>row(k.when, k.rule, JX(k.jx), `zdk-${i}`))}
			{r.keXing.jue.map((j, i)=><div key={`zdj-${i}`} className="horosa-fengshui-liqi-note">{j}</div>)}
			<div className="horosa-fengshui-liqi-note">{r.keXing.zhuCi2}</div>
			<div className="horosa-fengshui-liqi-note">{r.keXing.teShu}</div>
			<div className="horosa-fengshui-liqi-note">🔴 {r.keXing.zhuCi}</div>
		</>) : null}

		{card('判断的三重点', r.duan3.map((d)=>row(d.name, d.text, '', `zdd-${d.key}`)))}
		{card('外六事的基本要求', WAI_LIUSHI_YAO.map((w)=>row(w.name, `${w.gist}　｜　${w.items.join('；')}`, '', `zdy-${w.key}`)))}
		{card('自身宅形之讲究（八条）', ZHAI_XING_8.map((t, i)=>row(`其${i + 1}`, t, '', `zdz-${i}`)))}
		{card('外局六类看法', r.waiJuKinds.map((w)=>row(w.name, w.text, '', `zdk6-${w.key}`)))}
		{card('选宅五原则', r.xuanZhai5.map((x)=>row(x.name, x.text, '', `zdx5-${x.key}`)))}
		{card('应避开的特殊场所（十）', r.biKai10.map((t, i)=>row(`其${i + 1}`, t, '', `zdb-${i}`)))}
		{card(`阳宅三十则（${YANGZHAI_30.length} 则全录）`, <>
			{YANGZHAI_30.map((x)=>row(`${x.no}. ${x.title}`, x.text, '', `yz-${x.no}`))}
			<div className="horosa-fengshui-liqi-note">{YANGZHAI_30_NOTE}</div>
		</>)}
		<div className="horosa-fengshui-liqi-note">{r.note}</div>
	</>);
}

export function snapshotLines(r) {
	const L = [];
	L.push(`${r.isCity ? '城市' : '农村'}阳宅 ${r.xiangShan ? `向${r.xiangShan} ` : ''}${r.yun}运 · ${r.verdict.text}`);
	if (r.xiangShou) { L.push(`首重向首：向首在${r.xiangShou.dir}，向星${r.xiangShou.star}${r.xiangShou.deLing ? '乘元得令' : '未得令'}；格局${r.xiangShou.ge}`); }
	if (r.ge.length) { L.push('峦头凶格：' + r.ge.map((x)=>`${x.name}(${x.harm})`).join('；')); }
	if (r.waiRows.length) { L.push('外局：' + r.waiRows.map((x)=>`${x.dir}${x.kind === 'shan' ? '山' : '水'}${x.star}${x.ok ? '合' : '违'}`).join(' ')); }
	if (r.qiao) { L.push(`峤星：${r.qiao.dir}（强化对宫${r.qiao.oppDir}）——${r.qiao.verdict.text}`); }
	L.push('内局：' + r.neiRows.map((n)=>`${n.name}${n.dir ? `(${n.dir})` : ''}${n.ok === null ? '未录' : (n.ok ? '合' : '违')}`).join(' '));
	if (r.neiXiongRows.length) { L.push('室内凶局：' + r.neiXiongRows.map((x)=>`${x.name}[${x.hits.join('、')}]`).join('；')); }
	// 🔴 未采纳的机器建议须**明标其为未经人工确认**，且与已确认者分行——
	//    否则 AI 报告会把机器所疑当作已定之事写死。
	if (r.geoScan) {
		const pend = r.geoScan.rows.filter((x)=>!x.taken);
		if (pend.length) {
			L.push('【待核·机器建议，未经人工确认，不可作已定之事】户型图几何检出：'
				+ pend.map((x)=>`${x.name}·${x.label}`).join('；'));
		}
		if (r.geoScan.skipped.length) {
			L.push(`【几何检测未判 ${r.geoScan.skipped.length} 项（缺相应标记）——「未检出」不等于「无此凶局」】`);
		}
	}
	if (r.keXing) {
		L.push(`客星（${r.keXing.ganZhi}）：太岁${r.keXing.taisui.dir}/岁破${r.keXing.suipo.dir}/年五黄${r.keXing.wuHuang.dir || '中'}`
			+ (r.keXing.feiTaiSui ? `/飞太岁${r.keXing.feiTaiSui.dir}` : ''));
		L.push(`大门：${r.keXing.menWarn.text}`);
		L.push(`🔴 ${r.keXing.zhuCi}`);
	}
	L.push(`内外合参：${r.neiWaiNote}`);
	return L;
}

export default { defaults, compute, Params, Chart, Panel, snapshotLines };
