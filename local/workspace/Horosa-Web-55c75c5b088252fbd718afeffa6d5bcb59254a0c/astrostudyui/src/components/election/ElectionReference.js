// components/election/ElectionReference.js
// 择日「表格速查」Modal:世界盘/三系界表/36面/行星时 7×24/28宿/Behenian 15/埃及凶日。
// 全部由数据模块单一真值生成,零手抄;实务查阅用,不参与计算。
import { Component } from 'react';
import { Modal } from 'antd';
import { XQTabs, XQButton } from '../xq-ui';
import { EGYPTIAN_TERMS, PTOLEMAIC_TERMS, TETRABIBLOS_TERMS, FACES } from '../../divination/data/dignities';
import { CHALDEAN_TERMS_DAY, CHALDEAN_TERMS_NIGHT, SIGN_EN } from '../../divination/data/hellenisticData';
import { SIGNS, SIGN_ORDER } from '../../divination/data/signs';
import { PLANETS } from '../../divination/data/planets';
import { LUNAR_MANSIONS } from '../../divination/data/lunarMansions';
import { FIXED_STARS } from '../../divination/data/fixedStars';
import { EGYPTIAN_DAYS } from '../../divination/data/egyptianDays';
import { DAY_RULERS } from '../../divination/data/planetaryHours';
import { THEMA_MUNDI, THEMA_MUNDI_ASPECT_LESSONS, THEMA_MUNDI_NOTES } from '../../divination/data/themaMundi';

const TabPane = XQTabs.TabPane;
const cn = (k) => (PLANETS[k] || {}).cn || k;
const short = (k) => ({ sun: '日', moon: '月', mercury: '水', venus: '金', mars: '火', jupiter: '木', saturn: '土' })[k] || k;

const tableStyle = { width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'center' };
const cellB = { padding: '3px 5px', borderTop: '1px dashed rgba(148,163,184,.2)' };

// 迦勒底序(慢→快)行星时环:任一日第 1 时=值日星,逐时进一位。
const CHALDEAN_HOUR_RING = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
function hourRuler(weekday, hour1to24){
	const start = CHALDEAN_HOUR_RING.indexOf(DAY_RULERS[weekday]);
	return CHALDEAN_HOUR_RING[(start + hour1to24 - 1) % 7];
}

function TermsTable({ table }){
	return (
		<div style={{ overflowX: 'auto' }}>
			<table style={tableStyle}>
				<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>座</th>{[1, 2, 3, 4, 5].map((i) => <th key={i} style={cellB}>界{i}</th>)}</tr></thead>
				<tbody>
					{SIGN_ORDER.map((sg) => (
						<tr key={sg}>
							<td style={{ ...cellB, fontWeight: 600 }}>{SIGNS[sg].cn}</td>
							{(table[sg] || []).map((seg, i) => (
								<td key={i} style={cellB}>{short(seg[0])} {seg[1]}–{seg[2]}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ChaldeanTable({ table }){
	return (
		<div style={{ overflowX: 'auto' }}>
			<table style={tableStyle}>
				<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>座</th><th style={cellB}>0–8</th><th style={cellB}>8–15</th><th style={cellB}>15–21</th><th style={cellB}>21–26</th><th style={cellB}>26–30</th></tr></thead>
				<tbody>
					{SIGN_ORDER.map((sg, i) => {
						const segs = table[SIGN_EN[i]] || [];
						return (
							<tr key={sg}>
								<td style={{ ...cellB, fontWeight: 600 }}>{SIGNS[sg].cn}</td>
								{segs.map((seg, k) => <td key={k} style={cellB}>{short(String(seg[0]).toLowerCase())}</td>)}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

class ElectionReference extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	render(){
		return (
			<>
				<XQButton size="small" style={{ width: '100%', marginTop: 8 }} iconName="book" onClick={() => this.setState({ open: true })}>表格速查（界·面·行星时·28宿·恒星·凶日）</XQButton>
				<Modal open={this.state.open} onCancel={() => this.setState({ open: false })} footer={null} width={760} title="择日表格速查">
					<XQTabs defaultActiveKey="thema" className="horosa-inspector-tabs">
						<TabPane tab="世界盘" key="thema">
							<div className="horosa-divi-note" style={{ marginBottom: 6 }}>Thema Mundi 为教学构造盘（非生辰）：巨蟹上升、七曜各居己庙 15°——体系「何以如此」的原型。</div>
							<table style={tableStyle}>
								<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>位</th><th style={cellB}>座</th><th style={cellB}>星</th><th style={cellB}>说明</th></tr></thead>
								<tbody>{THEMA_MUNDI.map((r) => (
									<tr key={r.pos}><td style={cellB}>{r.pos}</td><td style={cellB}>{r.signCn} 15°</td><td style={{ ...cellB, fontWeight: 600 }}>{r.cn}</td><td style={cellB}>{r.note}</td></tr>
								))}</tbody>
							</table>
							<div style={{ marginTop: 8 }}>
								{THEMA_MUNDI_ASPECT_LESSONS.map((t, i) => <div key={i} className="horosa-divi-testi"><span className="dot">·</span><span>{t}</span></div>)}
							</div>
							{THEMA_MUNDI_NOTES.map((t, i) => <div key={'n' + i} className="horosa-divi-note">{t}</div>)}
						</TabPane>
						<TabPane tab="三系界表" key="terms">
							<div className="horosa-divi-card-head">埃及界（实务主流）</div>
							<TermsTable table={EGYPTIAN_TERMS} />
							<div className="horosa-divi-card-head" style={{ marginTop: 10 }}>托勒密界·经典传本</div>
							<TermsTable table={PTOLEMAIC_TERMS} />
							<div className="horosa-divi-card-head" style={{ marginTop: 10 }}>托勒密界·校勘本</div>
							<TermsTable table={TETRABIBLOS_TERMS} />
							<div className="horosa-divi-card-head" style={{ marginTop: 10 }}>迦勒底界（重构·昼）</div>
							<ChaldeanTable table={CHALDEAN_TERMS_DAY} />
							<div className="horosa-divi-card-head" style={{ marginTop: 10 }}>迦勒底界（重构·夜=土水互换）</div>
							<ChaldeanTable table={CHALDEAN_TERMS_NIGHT} />
							<div className="horosa-divi-note">迦勒底界无传世古表，为「口述规则＋三分逻辑」之忠实重构；界不跨座连续。</div>
						</TabPane>
						<TabPane tab="36 面" key="faces">
							<table style={tableStyle}>
								<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>座</th><th style={cellB}>0–10°</th><th style={cellB}>10–20°</th><th style={cellB}>20–30°</th></tr></thead>
								<tbody>{SIGN_ORDER.map((sg) => (
									<tr key={sg}><td style={{ ...cellB, fontWeight: 600 }}>{SIGNS[sg].cn}</td>{FACES[sg].map((p, i) => <td key={i} style={cellB}>{cn(p)}</td>)}</tr>
								))}</tbody>
							</table>
							<div className="horosa-divi-note">迦勒底降序 土→木→火→日→金→水→月，锚定火星主白羊 0–10；36÷7 有余 → 火星连主双鱼末面与白羊首面之接缝。</div>
						</TabPane>
						<TabPane tab="行星时 7×24" key="hours">
							<div style={{ overflowX: 'auto' }}>
								<table style={tableStyle}>
									<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>时</th>{['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((d) => <th key={d} style={cellB}>{d}</th>)}</tr></thead>
									<tbody>
										{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
											<tr key={h} style={h === 1 || h === 13 ? { fontWeight: 700 } : null}>
												<td style={cellB}>{h}{h === 1 ? ' ☀' : (h === 13 ? ' ☾' : '')}</td>
												{[0, 1, 2, 3, 4, 5, 6].map((wd) => <td key={wd} style={cellB}>{short(hourRuler(wd, h))}</td>)}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="horosa-divi-note">第 1 时始于日出、第 13 时始于日落；昼夜各 12 等分为不等时。任一日第 1 时＝值日星，逐时循迦勒底序。</div>
						</TabPane>
						<TabPane tab="28 宿" key="mansions">
							<div style={{ overflowX: 'auto' }}>
								<table style={{ ...tableStyle, textAlign: 'left' }}>
									<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>#</th><th style={cellB}>名</th><th style={cellB}>性质</th><th style={cellB}>用途</th></tr></thead>
									<tbody>{LUNAR_MANSIONS.map((m) => (
										<tr key={m.n} style={m.good === false ? { opacity: 0.75 } : null}>
											<td style={cellB}>{m.n}</td><td style={cellB}>{m.name}（{m.alt}）</td><td style={cellB}>{m.nature}</td><td style={cellB}>{m.use}</td>
										</tr>
									))}</tbody>
								</table>
							</div>
						</TabPane>
						<TabPane tab="Behenian 15" key="behenian">
							<div style={{ overflowX: 'auto' }}>
								<table style={{ ...tableStyle, textAlign: 'left' }}>
									<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>星</th><th style={cellB}>宝石</th><th style={cellB}>草药</th><th style={cellB}>护符用途</th></tr></thead>
									<tbody>{FIXED_STARS.filter((s) => s.behenian).map((s) => (
										<tr key={s.name_en}>
											<td style={{ ...cellB, fontWeight: 600 }}>{s.name_cn}{s.royal ? `（四王者·${s.royal.watcher}）` : ''}</td>
											<td style={cellB}>{s.behenian.gem || '待核'}</td>
											<td style={cellB}>{s.behenian.herb || '待核'}</td>
											<td style={cellB}>{s.behenian.use}</td>
										</tr>
									))}</tbody>
								</table>
							</div>
							<div className="horosa-divi-note">制作恒星护符：月合该星或与之成相时为其时；末位诸本有摇光↔北落师门之异，两皆列出。</div>
						</TabPane>
						<TabPane tab="埃及凶日" key="egyptian">
							<div style={{ overflowX: 'auto' }}>
								<table style={tableStyle}>
									<thead><tr style={{ opacity: 0.65 }}><th style={cellB}>月</th><th style={cellB}>凶日</th></tr></thead>
									<tbody>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
										<tr key={m}><td style={cellB}>{m} 月</td><td style={cellB}>{(EGYPTIAN_DAYS[m] || []).join('、') || '—'}</td></tr>
									))}</tbody>
								</table>
							</div>
							<div className="horosa-divi-note">中世纪历书固定年历日（与天象无关），忌开新事、尤忌医疗放血；仅作低权重提醒。</div>
						</TabPane>
					</XQTabs>
				</Modal>
			</>
		);
	}
}

export default ElectionReference;
