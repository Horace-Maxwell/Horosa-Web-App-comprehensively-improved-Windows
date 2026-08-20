import React, { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Tag } from 'antd';
import DateTime from '../comp/DateTime';
import TongshuControls from './TongshuControls';
import { TONGSHU_SCHOOL_MAP } from './tongshuSchools';
import { yongshiVerdict } from './tongshuData';
import { loadTongshuSettings, saveTongshuSettings } from './tongshuStore';
import { buildTongshuSnapshotText } from './tongshuSnapshot';
import { buildHuangliDay } from './huangliDay';
import { donggongDay } from './tongshu/donggong';
import { qimenDieShuDay } from './tongshu/qimenDieShu';
import { sanyuanLiexiuDay, sanyuanYearPoints } from './tongshu/sanyuanLiexiu';
import { wutuMonth } from './tongshu/wutu';
import { xuankongDay, xuankongForHour } from './tongshu/xuankong';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
import { markInteractionStart, markPanelReady } from '../../utils/perfMark';
import { calendarPanelShouldUpdate } from './NongLiMain';

const MODULE = 'calendar-tongshu';

function verdictTone(level) { return level === 'good' ? 'is-good' : (level === 'bad' ? 'is-bad' : 'is-neutral'); }

// 董公中栏：本月逐日值日（建除 + 金神七煞/三吉星 + 所选用事宜/忌），点击选日。
// horosa_kentang_result_cache_v1(通书择日):本页每一次 setState(选日/换用事/换时辰/换流派)
// 都把当前流派的中右栏【整体重算】一遍 —— 董公中栏是本月逐日 donggongDay + buildHuangliDay +
// yongshiVerdict(31 天 × 3 次纯计算),三垣要跨 y-1/y/y+1 三年求加临点,玄空要排 12 时辰日课。
// 这些全是**纯函数**:入参只有公历整数(+用事串/仙命年),无随机、无「现在时刻」依赖、无副作用
// → 同键必同值,缓存与重算逐值等价。上限 256 条 LRU(≈8 个月的各流派派生)。
// 关 horosa.perf.techniqueResultCache → 每次现算(=今日行为,逐字一致)。
const TS_MEM = new Map();
const TS_MEM_MAX = 256;
function tsMemo(key, build) {
	if (!techniqueResultCacheEnabled()) { return build(); }
	if (TS_MEM.has(key)) { return TS_MEM.get(key); }
	const val = build();
	TS_MEM.set(key, val);
	if (TS_MEM.size > TS_MEM_MAX) {
		const first = TS_MEM.keys().next().value;
		if (first !== undefined) { TS_MEM.delete(first); }
	}
	return val;
}

// 董公本月逐日数据(纯计算部分):月+用事为键 memo;JSX(activeYmd 高亮)留在组件里现拼。
function donggongMonthData(y, m, event) {
	return tsMemo(`dg|${y}|${m}|${event || ''}`, ()=>{
		const days = new Date(y, m, 0).getDate();
		const out = [];
		for (let d = 1; d <= days; d++) {
			out.push({
				d,
				ymd: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
				r: donggongDay({ y, m, d }),
				yv: yongshiVerdict(buildHuangliDay(y, m, d), event),
			});
		}
		return out;
	});
}

// 董公中栏：本月逐日值日（建除 + 金神七煞/三吉星 + 所选用事宜/忌），点击选日。
function DonggongMonth({ y, m, activeYmd, event, onPick }) {
	const rows = donggongMonthData(y, m, event).map(({ d, ymd, r, yv })=> (
		<div key={d} className={`horosa-tongshu-dayrow ${ymd === activeYmd ? 'is-active' : ''} ${yv.level === 'yi' ? 'is-yi-day' : (yv.level === 'ji' || yv.level === 'conflict' ? 'is-ji-day' : '')}`} onClick={()=> onPick(ymd)}>
			<span className='horosa-tongshu-dayrow-d'>{d}</span>
			<span className='horosa-tongshu-dayrow-gz'>{r.dayGZ}</span>
			<span className='horosa-tongshu-dayrow-jc'>{r.jianchu}</span>
			{yv.level === 'yi' ? <Tag className='horosa-huangli-tag is-good'>宜{event}</Tag> : null}
			{yv.level === 'ji' ? <Tag className='horosa-huangli-tag is-bad'>忌{event}</Tag> : null}
			{yv.level === 'conflict' ? <Tag className='horosa-huangli-tag is-bad'>{event}·宜忌相冲</Tag> : null}
			{r.jinshen.hit ? <Tag className='horosa-huangli-tag is-bad'>金神七煞</Tag> : null}
			{r.sanxing ? <Tag className='horosa-huangli-tag is-good'>{r.sanxing}</Tag> : null}
		</div>
	));
	return <div className='horosa-tongshu-month'>{rows}</div>;
}

// 董公右栏：选中日详断。
function DonggongDetail({ y, m, d, event }) {
	const r = donggongDay({ y, m, d });
	const yv = yongshiVerdict(buildHuangliDay(y, m, d), event);
	const hitEvent = event && (yv.level !== 'neutral' || r.text.indexOf(event) >= 0);
	return (
		<div className='horosa-tongshu-detail'>
			<div className='horosa-tongshu-detail-head'>
				<span className='horosa-tongshu-detail-date'>{r.y}-{String(r.m).padStart(2, '0')}-{String(r.d).padStart(2, '0')}</span>
				<Tag className='horosa-huangli-gz'>{r.dayGZ}日</Tag>
				<Tag className='horosa-huangli-gz'>{r.monthName}·{r.jianchu}{r.zhi}日</Tag>
			</div>
			{event ? (
				<div className={`horosa-tongshu-verdict ${yv.level === 'yi' ? 'is-good' : (yv.level === 'ji' || yv.level === 'conflict' ? 'is-bad' : 'is-neutral')}`}>
					{yv.level === 'yi' ? `本日通书宜「${event}」（宜 ${yv.hits.join('、')}）`
						: (yv.level === 'ji' ? `本日通书忌「${event}」（忌 ${yv.hits.join('、')}）`
							: (yv.level === 'conflict' ? `本日通书对「${event}」宜忌相冲（命中 ${yv.hits.join('、')}）——按凶优先，慎用`
								: `本日通书于「${event}」无明确宜忌，参酌下方董公断语与建除`))}
				</div>
			) : null}
			<div className={`horosa-tongshu-verdict ${verdictTone(r.verdict.level)}`}>{r.verdict.text}</div>

			{r.jinshen.hit ? (
				<div className='horosa-tongshu-warn'>⚠ 金神七煞：{r.jinshen.full} 值日，诸事忌之，切不可犯（煞贡/直星/人专三吉星亦不能解）。</div>
			) : null}
			{r.sanxing ? (
				<div className='horosa-tongshu-good'>三吉星：{r.sanxing} 值日，最吉，用之可获吉，能解凶星。</div>
			) : null}

			<div className='horosa-huangli-section'>
				<div className='horosa-huangli-section-title'>董公断语{hitEvent ? `（含「${event}」）` : ''}</div>
				<div className='horosa-huangli-section-body'>
					<div className={`horosa-tongshu-banyu ${hitEvent ? 'is-hit' : ''}`}>{r.text || '（无）'}</div>
				</div>
			</div>

			<div className='horosa-huangli-section'>
				<div className='horosa-huangli-section-title'>三煞方 · 节气</div>
				<div className='horosa-huangli-section-body'>
					<div className='horosa-huangli-kv'><span className='horosa-huangli-kv-label'>三煞方</span>
						<span className='horosa-huangli-kv-value is-bad'>{r.sansha.dir || '—'}（{(r.sansha.zhi || []).join('')}{r.sansha.ju ? '·' + r.sansha.ju : ''}）忌修造动土</span></div>
					{(r.notes || []).map((n, i)=> <div key={i} className='horosa-tongshu-note-line'>{n}</div>)}
				</div>
			</div>
		</div>
	);
}

// 奇门叠数：12 时辰各自叠数与吉凶（出行择时），点击看诗解。选中时辰由 TongshuMain 持有。
function QimenPanes({ y, m, d, selHour, onSelHour }) {
	const r = tsMemo(`qm|${y}|${m}|${d}`, ()=> qimenDieShuDay({ y, m, d }));
	const active = selHour ? r.rows.find((x)=> x.hourZhi === selHour) : (r.rows.find((x)=> x.jx === '吉') || r.rows[0]);
	return {
		mid: (
			<div className='horosa-tongshu-qimen'>
				<div className='horosa-tongshu-qimen-head'>{r.dayGZ}日 · 出行择时</div>
				<div className='horosa-tongshu-qimen-best'>吉时：{r.bestHours.length ? r.bestHours.join('、') : '本日无吉时，宜静守'}</div>
				<div className='horosa-tongshu-hours'>
					{r.rows.map((row)=> (
						<div key={row.hourZhi}
							className={`horosa-tongshu-hour ${row.jx === '吉' ? 'is-good' : 'is-bad'} ${active && active.hourZhi === row.hourZhi ? 'is-active' : ''}`}
							onClick={()=> onSelHour && onSelHour(row.hourZhi)}>
							<span className='horosa-tongshu-hour-zhi'>{row.hourZhi}时</span>
							<span className='horosa-tongshu-hour-range'>{row.range}</span>
							<span className='horosa-tongshu-hour-sum'>叠{row.sum}</span>
							<Tag className={`horosa-huangli-tag ${row.jx === '吉' ? 'is-good' : 'is-bad'}`}>{row.jx}</Tag>
						</div>
					))}
				</div>
			</div>
		),
		right: active ? (
			<div className='horosa-tongshu-detail'>
				<div className='horosa-tongshu-detail-head'>
					<span className='horosa-tongshu-detail-date'>{active.hourZhi}时（{active.range}）</span>
					<Tag className={`horosa-huangli-tag ${active.jx === '吉' ? 'is-good' : 'is-bad'}`}>叠数 {active.sum}·{active.jx}</Tag>
				</div>
				<div className='horosa-huangli-section'>
					<div className='horosa-huangli-section-title'>诗曰</div>
					<div className='horosa-huangli-section-body'><div className='horosa-tongshu-banyu'>{active.shi || '（无）'}</div></div>
				</div>
				<div className='horosa-huangli-section'>
					<div className='horosa-huangli-section-title'>解</div>
					<div className='horosa-huangli-section-body'><div className='horosa-tongshu-banyu'>{active.jie || '（原书此数缺解）'}</div></div>
				</div>
			</div>
		) : <div className='horosa-empty-hint'>点击时辰查看诗解</div>,
	};
}

// 三垣列宿：本日天帝加临 + 距最近加临 + 十六吉曜按「用事类」高亮断语库。
function SanyuanPanes({ y, m, d, use = '建宅', onPick }) {
	const r = tsMemo(`sy|${y}|${m}|${d}`, ()=> sanyuanLiexiuDay({ y, m, d }));
	const yearPts = (yy)=> tsMemo(`syp|${yy}`, ()=> sanyuanYearPoints(yy));
	const points = yearPts(y);
	const hitNames = new Set(r.hitStars.map((s)=> s.name));
	const USE_FIELDS = ['建宅', '安葬', '修造', '造命'];
	const useField = USE_FIELDS.includes(use) ? use : '建宅';
	// 距最近天帝加临日（含跨年前后）：跨 y-1/y/y+1 三年取全部点位求最小天差。
	const sel = new Date(y, m - 1, d).getTime();
	const allPts = [...yearPts(y - 1), ...points, ...yearPts(y + 1)];
	let nearest = null;
	allPts.forEach((p)=>{
		const [py, pm, pd] = p.ymd.split('-').map((n)=> parseInt(n, 10));
		const diff = Math.round((new Date(py, pm - 1, pd).getTime() - sel) / 86400000);
		if (!nearest || Math.abs(diff) < Math.abs(nearest.diff)) { nearest = { ...p, diff }; }
	});
	// 当前用事类下有断语的曜（排前），供中栏计数与右栏排序。
	const useStars = r.stars.filter((s)=> s[useField]);
	return {
		mid: (
			<div className='horosa-tongshu-sanyuan'>
				<div className='horosa-tongshu-sanyuan-head'>本日天帝加临</div>
				{r.hitStars.length ? (
					r.hitStars.map((s)=> <div key={s.name} className='horosa-tongshu-hitstar'>⭐ {s.name}值日（{s.hitInfo}）· 制煞解厄百事吉</div>)
				) : (
					<div className='horosa-tongshu-note-line'>
						本日非天帝加临。
						{nearest ? <>最近加临：<b>{nearest.ymd}</b>（{nearest.info}，{nearest.diff === 0 ? '即今日' : (nearest.diff > 0 ? `${nearest.diff}天后` : `${-nearest.diff}天前`)}）。</> : null}
					</div>
				)}
				<div className='horosa-huangli-section' style={{ marginTop: 10 }}>
					<div className='horosa-huangli-section-title'>用事类「{useField}」· 吉曜断语（{useStars.length} 曜）</div>
					<div className='horosa-huangli-section-body horosa-tongshu-note-line'>
						下方右栏十六吉曜依此高亮对应断语。三垣古法仅天帝有节气定位，余曜精确加临须七政星历（不臆造）。
					</div>
				</div>
				<div className='horosa-huangli-section' style={{ marginTop: 10 }}>
					<div className='horosa-huangli-section-title'>{y} 年天帝加临日</div>
					<div className='horosa-huangli-section-body'>
						{points.length ? points.map((p, i)=> (
							<div key={i} className='horosa-tongshu-point' onClick={()=> onPick && onPick(p.ymd)}>
								{p.ymd}　{p.name}　<span className='horosa-tongshu-note-line'>{p.info}</span>
							</div>
						)) : <span className='horosa-huangli-muted'>—</span>}
					</div>
				</div>
			</div>
		),
		right: (
			<div className='horosa-tongshu-liexiu'>
				<div className='horosa-tongshu-liexiu-head'>三垣列宿 · 十六吉曜（用事类：{useField}）</div>
				{r.stars.map((s)=> (
					<div key={s.name} className={`horosa-tongshu-star ${hitNames.has(s.name) ? 'is-hit' : ''}`}>
						<div className='horosa-tongshu-star-name'>{s.name}{hitNames.has(s.name) ? ' ⭐加临' : ''}</div>
						{s.desc ? <div className='horosa-tongshu-star-desc'>{s.desc}</div> : null}
						{USE_FIELDS.map((k)=> (s[k] ? (
							<div key={k} className={`horosa-tongshu-star-field ${k === useField ? 'is-active' : ''}`}><span className='horosa-tongshu-star-key'>{k}</span>{s[k]}</div>
						) : null))}
					</div>
				))}
			</div>
		),
	};
}

// 天元乌兔：本月逐日乌兔值星（太阳/太阴/九星），点击选日。
function WutuPanes({ y, m, d, onPick }) {
	const M = tsMemo(`wt|${y}|${m}|${d}`, ()=> wutuMonth({ y, m, d }));
	const activeYmd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	const active = M.rows.find((r)=> r.ymd === activeYmd) || M.rows[0];
	const starCls = (jx)=> (jx === 'good' ? 'is-good' : 'is-bad');
	return {
		mid: (
			<div className='horosa-tongshu-wutu'>
				<div className='horosa-tongshu-wutu-head'>月朔 {M.shuoGZ}日 · 乌兔值星</div>
				<div className='horosa-tongshu-wutu-best'>太阳日：{M.sunDays.map((x)=> x.dayGZ).join('、') || '—'}　太阴日：{M.moonDays.map((x)=> x.dayGZ).join('、') || '—'}</div>
				<div className='horosa-tongshu-month'>
					{M.rows.map((r)=> (
						<div key={r.ymd} className={`horosa-tongshu-dayrow ${r.ymd === (active && active.ymd) ? 'is-active' : ''}`} onClick={()=> onPick(r.ymd)}>
							<span className='horosa-tongshu-dayrow-d'>{r.dayInMonth}</span>
							<span className='horosa-tongshu-dayrow-gz'>{r.dayGZ}</span>
							<span className={`horosa-tongshu-dayrow-jc ${starCls(r.jx)}`}>{r.star}</span>
							{r.isSun ? <Tag className='horosa-huangli-tag is-good'>太阳·上吉</Tag> : null}
							{r.isMoon ? <Tag className='horosa-huangli-tag is-good'>太阴·次吉</Tag> : null}
						</div>
					))}
				</div>
			</div>
		),
		right: active ? (
			<div className='horosa-tongshu-detail'>
				<div className='horosa-tongshu-detail-head'>
					<span className='horosa-tongshu-detail-date'>{active.ymd}</span>
					<Tag className='horosa-huangli-gz'>{active.dayGZ}日</Tag>
				</div>
				<div className={`horosa-tongshu-verdict ${active.jx === 'good' ? 'is-good' : 'is-bad'}`}>乌兔值星：{active.star}（{active.jx === 'good' ? '吉' : '凶'}）</div>
				{active.isSun ? <div className='horosa-tongshu-good'>太阳值日·上吉：日月木金水为吉星，太阳值日最吉，宜造葬修整。</div> : null}
				{active.isMoon ? <div className='horosa-tongshu-good'>太阴值日·次吉：太阴吉星，事事相宜。</div> : null}
				{active.jx === 'bad' ? <div className='horosa-tongshu-warn'>{active.star}为凶星（土孛火罗计），忌用。</div> : null}
				<div className='horosa-huangli-section'>
					<div className='horosa-huangli-section-title'>玉函天星诀</div>
					<div className='horosa-huangli-section-body'>
						<div className='horosa-tongshu-note-line'>九星：太阳·太阴·木星·金星·水星为吉；土星·孛星·火星·罗喉·计都为凶。太阳到向、太阴到山最吉。</div>
						<div className='horosa-tongshu-note-line'>此法为一家之法（源自述保留态度），宜与老黄历、董公合参。</div>
					</div>
				</div>
			</div>
		) : <div className='horosa-empty-hint'>选择日期查看乌兔值星</div>,
	};
}

// 玄空五机→标签色：进神五吉=吉(绿)、退神(生出/克出)=凶(红)、其余(无关/缺)=平。
const XK_GOOD_REL = ['生入', '克入', '同旺', '生成', '合十'];
function xkRelJx(t) { if (!t) { return 'neutral'; } if (XK_GOOD_REL.indexOf(t) >= 0) { return 'good'; } if (t === '生出' || t === '克出') { return 'bad'; } return 'neutral'; }
function xkTagCls(jx) { return jx === 'good' ? 'is-good' : (jx === 'bad' ? 'is-bad' : 'is-neutral'); }

// 三元玄空：12 时辰玄空日课（五吉/日课吉凶），点击看四柱卦象。
function XuankongPanes({ y, m, d, mingYear, selHour, onSelHour }) {
	const D = tsMemo(`xk|${y}|${m}|${d}|${mingYear || ''}`, ()=> xuankongDay({ y, m, d }, mingYear));
	const hz = selHour || (D.rows.find((x)=> x.level.jx === 'good') || D.rows[0]).hourZhi;
	const full = tsMemo(`xkh|${y}|${m}|${d}|${hz}|${mingYear || ''}`, ()=> xuankongForHour({ y, m, d, hourZhi: hz }, mingYear));
	const P = full.pillars;
	// rel 为完整五机名（生入/克入/同旺/生成/合十/生出/克出/无关），按进神吉·退神凶着色。
	const rowOf = (label, p, rel)=> (
		<div className='horosa-tongshu-sizhu-row'>
			<span className='horosa-tongshu-sizhu-lab'>{label}</span>
			<span className='horosa-tongshu-sizhu-gz'>{p.gz}</span>
			<span className='horosa-tongshu-sizhu-gua'>{p.gua}</span>
			<span className='horosa-tongshu-sizhu-wx'>{p.wxNum}{p.wxElem}</span>
			<span className='horosa-tongshu-sizhu-yun'>{p.yun}运</span>
			{(rel && rel !== '无关') ? <Tag className={`horosa-huangli-tag ${xkTagCls(xkRelJx(rel))}`}>{rel}</Tag> : (label !== '日' ? <Tag className='horosa-huangli-tag is-neutral'>{rel === '无关' ? '无关' : '—'}</Tag> : null)}
		</div>
	);
	return {
		mid: (
			<div className='horosa-tongshu-xuankong'>
				<div className='horosa-tongshu-xuankong-head'>{D.day.gz}日课 · 择时（宜上吉+）</div>
				<div className='horosa-tongshu-xuankong-best'>{D.bestHours.join('、') || '本日无上吉时'}</div>
				<div className='horosa-tongshu-hours'>
					{D.rows.map((row)=> (
						<div key={row.hourZhi} className={`horosa-tongshu-hour ${xkTagCls(row.level.jx)} ${row.hourZhi === hz ? 'is-active' : ''}`} onClick={()=> onSelHour && onSelHour(row.hourZhi)}>
							<span className='horosa-tongshu-hour-zhi'>{row.hourZhi}时</span>
							<span className='horosa-tongshu-hour-range'>{row.timeGZ}</span>
							<span className='horosa-tongshu-hour-sum'>{row.timeGua}</span>
							<Tag className={`horosa-huangli-tag ${xkTagCls(row.level.jx)}`}>{row.level.name}</Tag>
						</div>
					))}
				</div>
			</div>
		),
		right: (
			<div className='horosa-tongshu-detail'>
				<div className='horosa-tongshu-detail-head'>
					<span className='horosa-tongshu-detail-date'>{hz}时日课</span>
					<Tag className={`horosa-huangli-tag ${xkTagCls(full.level.jx)}`}>{full.level.name}</Tag>
				</div>
				<div className='horosa-huangli-section'>
					<div className='horosa-huangli-section-title'>日课四柱卦象（以日柱为主）</div>
					<div className='horosa-huangli-section-body'>
						{rowOf('时', P.time, full.wuji.timeRel)}
						{rowOf('日', P.day, null)}
						{rowOf('月', P.month, full.wuji.monthRel)}
						{rowOf('年', P.year, full.wuji.yearRel)}
						{full.ming ? rowOf('仙命', full.ming, full.dayVsMingRel || full.dayVsMing) : null}
					</div>
				</div>
				{full.geju ? <div className='horosa-tongshu-good'>格局：{full.geju.name}——{full.geju.note}</div> : null}
				<div className='horosa-tongshu-note-line'>五吉（进神）：生入/克入/同旺/生成/合十。上上吉=年月时对日皆五吉；上吉=月时或年时对日五吉；吉=时对日五吉；退神（生出/克出，时泄耗日气）为凶。</div>
				<div className='horosa-tongshu-note-line'>坐向卦须六十四卦天圆图（源未载 24 山→64 卦，本法从缺）。</div>
			</div>
		),
	};
}

class TongshuMain extends Component {
	// v3.6.0 收敛注(#78 双 sCU 防复发):上游同位置也带一份通用 wrapperPropsEqual 渲染守卫,
	// 与本类内另一份我方细化守卫在同一类内重复(JS 后者静默胜出)。按「单一 sCU」纪律移除上游份,
	// 我方守卫语义为其超集(state 引用变照常放行 + 页面专属无关键剔除)。
	constructor(props) {
		super(props);
		const settings = loadTongshuSettings();
		this.state = { settings, date: new DateTime(), qimenHour: null };
		this.onSettingChange = this.onSettingChange.bind(this);
		this.onDateChange = this.onDateChange.bind(this);
		this.pickDay = this.pickDay.bind(this);
		this.onSelHour = this.onSelHour.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	ymd() { return this.state.date.format('YYYY-MM-DD'); }

	// horosa_panel_ready_v1:本页纯本地派生 —— setState 提交完成即中右栏画完,
	// 故「落数回调」就是就绪点(无网络、无二次 setState)。
	settle() {
		this.saveAISnapshot();
		markPanelReady('calendar');
	}

	onSettingChange(patch) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(改选项)
		const settings = { ...this.state.settings, ...patch };
		saveTongshuSettings(settings);
		this.setState({ settings }, ()=> this.settle());
	}

	onDateChange(dt) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(切时间)
		this.setState({ date: dt.value }, ()=> this.settle());
	}

	pickDay(ymd) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(点选日期)
		const dt = new DateTime().parse(`${ymd} 12:00:00`, 'yyyy-MM-dd HH:mm:ss');
		this.setState({ date: dt }, ()=> this.settle());
	}

	// 时辰选择（奇门叠数 / 三元玄空共用）。原为 render 内联箭头 → 每次重渲都造新函数,
	// 现绑定成稳定引用(顺带给下游 memo 化留出可能)。
	onSelHour(h) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(换时辰)
		// 换时辰后同步刷新 AI 快照(奇门叠数/三元玄空两处调用点共用本方法,一处即全覆盖)。
		this.setState({ qimenHour: h }, ()=> { this.settle(); this.saveAISnapshot(); });
	}

	saveAISnapshot() {
		const text = `${buildTongshuSnapshotText(this.state.settings, this.ymd(), { hour: this.state.qimenHour }) || ''}`.trim();
		if (text) { saveModuleAISnapshot(MODULE, text); }
		return text;
	}

	handleSnapshotRefreshRequest(evt) {
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if (moduleName !== MODULE) { return; }
		const text = this.saveAISnapshot();
		if (text && evt && evt.detail && typeof evt.detail === 'object') { evt.detail.snapshotText = text; }
	}

	componentDidMount() {
		if (typeof window !== 'undefined') {
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.saveAISnapshot();
		// horosa_panel_ready_v1:本页首次挂载是同步渲染(无请求、无二次 setState),
		// 故挂载完成即「画完」;CalendarMain 换页签时为未挂载子页开的那次计时在此收尾。
		markPanelReady('calendar');
	}

	componentWillUnmount() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// horosa_panel_scu_v1:本页【零消费】props.fields —— 渲染只看 state + props.height。
	shouldComponentUpdate(nextProps, nextState) {
		return calendarPanelShouldUpdate(this.props, nextProps, this.state, nextState);
	}

	renderPanes() {
		const s = this.state.settings;
		const ymd = this.ymd();
		const [y, m, d] = ymd.split('-').map((n)=> parseInt(n, 10));
		if (s.school === 'donggong') {
			return {
				mid: <DonggongMonth y={y} m={m} activeYmd={ymd} event={s.event} onPick={this.pickDay} />,
				right: <DonggongDetail y={y} m={m} d={d} event={s.event} />,
			};
		}
		if (s.school === 'qimen') {
			return QimenPanes({ y, m, d, selHour: this.state.qimenHour, onSelHour: this.onSelHour });
		}
		if (s.school === 'sanyuanliexiu') {
			return SanyuanPanes({ y, m, d, use: s.liexiuUse, onPick: this.pickDay });
		}
		if (s.school === 'wutu') {
			return WutuPanes({ y, m, d, onPick: this.pickDay });
		}
		if (s.school === 'sanyuan') {
			return XuankongPanes({ y, m, d, mingYear: s.mingYear, selHour: this.state.qimenHour, onSelHour: this.onSelHour });
		}
		const school = TONGSHU_SCHOOL_MAP[s.school] || {};
		const stub = <div className='horosa-empty-hint'>「{school.label}」正在开发中，敬请期待。</div>;
		return { mid: stub, right: stub };
	}

	render() {
		let height = this.props.height ? this.props.height : 760;
		if (height === '100%') { height = '100%'; } else { height = height - 30; }
		const { mid, right } = this.renderPanes();
		return (
			<div className='horosa-tongshu-workbench' style={{ height }}>
				<aside className='horosa-tongshu-left'>
					<TongshuControls
						settings={this.state.settings}
						onChange={this.onSettingChange}
						dateValue={this.state.date}
						onDateChange={this.onDateChange}
					/>
				</aside>
				<section className='horosa-tongshu-mid'>{mid}</section>
				<aside className='horosa-tongshu-right'>{right}</aside>
			</div>
		);
	}
}

export default TongshuMain;
