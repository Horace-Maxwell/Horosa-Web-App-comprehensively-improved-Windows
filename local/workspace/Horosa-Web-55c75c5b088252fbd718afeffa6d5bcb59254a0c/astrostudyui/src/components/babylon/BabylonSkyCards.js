// 巴比伦天象实算卡片:本盘七曜所行三道 / ziqpu 星钟 / 目标年取数 / 周期现象(后端实算,与 AI 快照同一份数据)。
import { BABYLON_PHENOMENON_CN, BABYLON_SKY_PATH_CN, BABYLON_SKY_PLANET_CN, beruText, babylonStampMinute, babylonMonthDayMinute, babylonVisibilityNote } from '../../utils/babylonAiSnapshot';

const fmtDeg = (v)=>{
	const n = Number(v);
	if(!Number.isFinite(n)){ return '—'; }
	const a = Math.abs(n);
	return `${n < 0 ? '−' : '+'}${Math.floor(a)}°${String(Math.round((a % 1) * 60)).padStart(2, '0')}′`;
};
const fix = (v, d)=>(Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—');

export function SkyPathsCard({ sky }){
	if(!sky || !Array.isArray(sky.paths)){ return null; }
	return (
		<div className="horosa-babylon-card">
			<div className="horosa-babylon-card-title">本盘七曜所行之道(实算赤纬)</div>
			<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
				<thead><tr><th style={{ whiteSpace: 'nowrap' }}>曜</th><th style={{ whiteSpace: 'nowrap' }}>赤纬</th><th style={{ whiteSpace: 'nowrap' }}>道</th><th style={{ whiteSpace: 'nowrap' }}>距道界</th></tr></thead>
				<tbody>
					{sky.paths.map((r)=>(
						<tr key={r.id}><td>{BABYLON_SKY_PLANET_CN[r.id] || r.id}</td><td className="num">{fmtDeg(r.decl)}</td><td>{BABYLON_SKY_PATH_CN[r.path] || r.path}</td><td className="num">{fix(Math.abs(r.margin), 2)}°</td></tr>
					))}
				</tbody>
			</table></div>
			<div className="horosa-babylon-caveat">赤纬在 ±17° 之内属 Anu 道,以北 Enlil 道,以南 Ea 道。</div>
		</div>
	);
}

export function SkyZiqpuCard({ sky }){
	const rows = sky && sky.ziqpu && sky.ziqpu.rows;
	if(!Array.isArray(rows) || !rows.length){ return null; }
	return (
		<div className="horosa-babylon-card">
			<div className="horosa-babylon-card-title">本盘 ziqpu 星钟(26 星,出生时刻)</div>
			<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
				<thead><tr><th style={{ whiteSpace: 'nowrap' }}>星</th><th style={{ whiteSpace: 'nowrap' }}>时角</th><th style={{ whiteSpace: 'nowrap' }}>距下次中天</th><th style={{ whiteSpace: 'nowrap' }}>下次过中天</th><th style={{ whiteSpace: 'nowrap' }} title="两个数都是本星与上一颗星之间的间隔:古 = 古文所载的 UŠ,今 = 实算赤经差(度)">距上一星 古/今</th></tr></thead>
				<tbody>
					{rows.map((r)=>(
						<tr key={r.no} style={r.state ? { fontWeight: 600 } : undefined}>
							<td>{r.no}. {r.name}<div style={{ fontSize: 11, opacity: 0.75 }}>{r.star}{r.state === 'now' ? ' · 刚过中天' : (r.state === 'next' ? ' · 将过中天' : '')}</div></td>
							<td className="num">{fix(r.ha, 1)}°</td>
							<td>{beruText(r.in)}</td>
							<td style={{ whiteSpace: 'nowrap' }}>{babylonMonthDayMinute(r.next)}</td>
							<td className="num">{r.iv}/{fix(r.civ, 1)}</td>
						</tr>
					))}
				</tbody>
			</table></div>
			<div className="horosa-babylon-caveat">时角 = 出生地天顶赤经 − 星的赤经(已过中天的时长按时角折算);1 UŠ = 1° = 4 分钟,1 bēru = 30 UŠ = 2 小时。「距上一星」两个数都是本星与表中上一颗星的间隔:「古」是古文所载的 UŠ,「今」是按出生时刻实算的赤经差(度);第 1 颗的上一星是表末的第 26 颗。</div>
		</div>
	);
}

export function SkyGoalYearCard({ sky }){
	const rows = sky && sky.goalYear;
	if(!Array.isArray(rows) || !rows.length){ return null; }
	return (
		<div className="horosa-babylon-card">
			<div className="horosa-babylon-card-title">本盘目标年实算(回推时刻与本时刻对比)</div>
			<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
				<thead><tr><th style={{ whiteSpace: 'nowrap' }}>曜</th><th style={{ whiteSpace: 'nowrap' }}>回推</th><th style={{ whiteSpace: 'nowrap' }}>回推时刻</th><th style={{ whiteSpace: 'nowrap' }}>黄经差</th><th style={{ whiteSpace: 'nowrap' }}>距日 回推 / 本时</th><th style={{ whiteSpace: 'nowrap' }}>会合周期数</th><th style={{ whiteSpace: 'nowrap' }}>恒星周期数</th></tr></thead>
				<tbody>
					{rows.map((r, i)=>(
						<tr key={`${r.id}${i}`}>
							<td>{BABYLON_SKY_PLANET_CN[r.id] || r.id}</td>
							<td className="num">{r.years ? `${r.years} 年` : '223 月'}</td>
							<td>{r.date}</td>
							<td className="num">{fix(r.dl, 2)}°</td>
							<td className="num">{fix(r.el0, 1)}° / {fix(r.el, 1)}°</td>
							<td className="num">{fix(r.syn, 3)}</td>
							<td className="num">{fix(r.sid, 3)}</td>
						</tr>
					))}
				</tbody>
			</table></div>
			<div className="horosa-babylon-caveat">月亮回推 223 个平均朔望月;其余各曜取同一民用日期往前数周期年。黄经差越小,这个周期在本盘越准。</div>
		</div>
	);
}

export function SkyPhenomenaCard({ sky }){
	const rows = sky && sky.phenomena;
	if(!Array.isArray(rows) || !rows.length){ return null; }
	return (
		<div className="horosa-babylon-card">
			<div className="horosa-babylon-card-title">本盘周期现象(出生前后各一个会合周期)</div>
			{rows.map((p)=>(
				<div key={p.id} style={{ marginBottom: 8 }}>
					<div style={{ fontWeight: 600 }}>
						{BABYLON_SKY_PLANET_CN[p.id] || p.id}
						<span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 8 }}>
							{babylonVisibilityNote(p)}
						</span>
					</div>
					<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
						<thead><tr><th style={{ whiteSpace: 'nowrap' }}>符</th><th style={{ whiteSpace: 'nowrap' }}>现象</th><th style={{ whiteSpace: 'nowrap' }}>术语</th><th style={{ whiteSpace: 'nowrap' }}>时刻</th><th style={{ whiteSpace: 'nowrap' }}>距出生</th></tr></thead>
						<tbody>
							{(p.events || []).map((e)=>(
								<tr key={`${e.kind}${e.jd}`} style={e.state ? { fontWeight: 600 } : undefined}>
									<td>{e.sym || ''}</td>
									<td>{BABYLON_PHENOMENON_CN[e.kind] || e.kind}{e.delayed ? ' · 高纬推迟' : ''}{e.state === 'last' ? ' · 出生前最近' : (e.state === 'next' ? ' · 出生后最近' : '')}</td>
									<td>{e.akk || ''}</td>
									<td style={{ whiteSpace: 'nowrap' }}>{babylonStampMinute(e.date)}</td>
									<td className="num">{fix(e.days, 0)} 日</td>
								</tr>
							))}
						</tbody>
					</table></div>
				</div>
			))}
			<div className="horosa-babylon-caveat">合、冲、留按星历求根;晨始见 Γ、晨末见 Σ、夕始见 Ξ、夕末见 Ω 用可见度模型推算,观测者在出生地(气压 1013.25 mbar、15 °C、湿度 40%、年龄 26、双目视力 1),与古代观测相差一两天是常事。高纬地区有些现象不会出现,表里就不列;纬度超过 65° 可见度模型不成立,只列合、冲、留。每个会合周期各只有一次始见、一次末见;高纬夏夜天不够黑时,它们会推迟到离日 40° 以外才发生,照列在表里,标「高纬推迟」。</div>
		</div>
	);
}
