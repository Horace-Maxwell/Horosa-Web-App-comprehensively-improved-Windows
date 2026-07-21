import { Component } from 'react';
import { Modal } from 'antd';
import { XQSelect, XQButton, XQSideSection } from '../xq-ui';
import DivinationChartShell from '../divination/DivinationChartShell';
import ElectionJudgment from './ElectionJudgment';
import { fetchChart } from '../../services/astro';
import { buildChartParams } from '../../divination/engine/chartRequest';
import { buildFacts } from '../../divination/engine/chartFacts';
import { runElection } from '../../divination/election/electionEngine';
import { generateCandidates, rankResults, buildScanRecommendation } from '../../divination/election/workflow';
import ChartSearchModal from '../astro/ChartSearchModal';
import { fetchMundaneEvents, chartAtMoment } from '../../divination/mundane/momentPipeline';
import { fetchPreciseJieqiSeed } from '../../utils/preciseCalcBridge';
import { WEST_SCHOOLS, WEST_SCHOOL_ORDER, schoolOf } from '../../divination/election/westernSchools';
import { SIGNS, SIGN_ORDER } from '../../divination/data/signs';
import moment from 'moment';
import { markPanelReady } from '../../utils/perfMark';

const Option = XQSelect.Option;

export const ELECTION_TOPICS = [
	{ value: 'marriage', label: '结婚 / 订婚' },
	{ value: 'business', label: '创业 / 开业 / 开市' },
	{ value: 'organization', label: '团体组织成立' },
	{ value: 'move_in', label: '入宅 / 迁居' },
	{ value: 'buy_property', label: '购屋 / 租屋' },
	{ value: 'buy_land', label: '购地' },
	{ value: 'renovation', label: '整修 / 动土 / 破土' },
	{ value: 'trade', label: '买卖交易' },
	{ value: 'buy_car', label: '购车 / 交车' },
	{ value: 'contract', label: '签约 / 承诺' },
	{ value: 'registration', label: '登记 / 申请' },
	{ value: 'diet', label: '节食 / 戒习惯' },
	{ value: 'pursue_love', label: '追求爱情 / 求职' },
	{ value: 'team_departure', label: '队伍出发 / 比赛' },
	{ value: 'surgery', label: '手术 / 用药' },
	{ value: 'banquet', label: '宴会 / 就职典礼' },
	{ value: 'travel', label: '出行' },
	{ value: 'blessing', label: '祈福 / 安香 / 法会' },
	{ value: 'general_day', label: '大众吉日' },
];

const GRADE_DOT = { 极佳: '#2f9e6f', 不错: '#1aa3b8', 中等: '#3b82f6', 欠佳: '#e07a3b', '不宜（含红线）': '#cf3b3b' };

class ElectionMain extends Component{
	constructor(props){
		super(props);
		this.state = { scanning: false, scanResults: null, scanOpen: false, scanMode: 'hours', natalRec: null, natalFacts: null, natalLoading: false, mundaneSet: null, mundaneLoading: false, crisisLoading: false };
		this._fields = null; this._setTime = null; this._topicId = 'marriage';
		this.runScan = this.runScan.bind(this);
		this.useCandidate = this.useCandidate.bind(this);
		this.selectNatal = this.selectNatal.bind(this);
		this.clearNatal = this.clearNatal.bind(this);
		this.fetchMundaneSet = this.fetchMundaneSet.bind(this);
		this.clearMundane = this.clearMundane.bind(this);
	}

	geoFromFields(){
		const f = this._fields || {};
		return {
			zone: f.zone ? f.zone.value : '+08:00',
			lon: f.lon ? f.lon.value : '116e23',
			lat: f.lat ? f.lat.value : '39n54',
			gpsLat: f.gpsLat ? f.gpsLat.value : 39.9,
			gpsLon: f.gpsLon ? f.gpsLon.value : 116.38,
			hsys: f.hsys ? f.hsys.value : 0,
			zodiacal: f.zodiacal ? f.zodiacal.value : 0, siderealAyanamsa: f.siderealAyanamsa ? f.siderealAyanamsa.value : '',
			tradition: f.tradition ? f.tradition.value : 1,
		};
	}

	async fetchMundaneSet(){
		const baseDt = this._fields && this._fields.date && this._fields.date.value;
		if(!baseDt || !baseDt.format){ return; }
		const baseStr = baseDt.format('YYYY-MM-DD');
		const geo = this.geoFromFields();
		const minus = (d) => moment(baseStr, 'YYYY-MM-DD').subtract(d, 'days').format('YYYY-MM-DD');
		const fieldsLike = { zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, hsys: geo.hsys, zodiacal: geo.zodiacal, siderealAyanamsa: geo.siderealAyanamsa, tradition: geo.tradition };
		const mk = async (m) => { if(!m){ return null; } const R = await chartAtMoment(m, fieldsLike); return R ? buildFacts(R) : null; };
		this.setState({ mundaneLoading: true });
		try{
			const lun = await fetchMundaneEvents({ startDate: minus(45), endDate: baseStr, zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, kinds: ['lunations'] });
			const newMoons = (lun.lunations || []).filter((l) => l.phase === 'New Moon');
			const fullMoons = (lun.lunations || []).filter((l) => l.phase === 'Full Moon');
			const lastNew = newMoons[newMoons.length - 1];
			const lastFull = fullMoons[fullMoons.length - 1];
			const ecl = await fetchMundaneEvents({ startDate: minus(220), endDate: baseStr, zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, kinds: ['eclipses'] });
			const eclList = ecl.eclipses || [];
			const lastEcl = eclList[eclList.length - 1];
			const [newMoonF, fullMoonF, eclipseF] = await Promise.all([mk(lastNew && lastNew.localTime), mk(lastFull && lastFull.localTime), mk(lastEcl && lastEcl.localTime)]);
			let ingressF = null;
			try{
				const seed = await fetchPreciseJieqiSeed({ year: String(baseDt.format('YYYY')), ad: baseDt.ad != null ? baseDt.ad : 1, zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, timeAlg: 0, jieqis: ['春分'] });
				const hit = seed && seed['春分'];
				if(hit && hit.time){ const R = await chartAtMoment(hit.time, fieldsLike); ingressF = R ? buildFacts(R) : null; }
			}catch(e){ /* noop */ }
			this.setState({ mundaneSet: { ingress: ingressF, newMoon: newMoonF, fullMoon: fullMoonF, eclipse: eclipseF }, mundaneLoading: false });
		}catch(e){ this.setState({ mundaneLoading: false }); }
	}

	clearMundane(){ this.setState({ mundaneSet: null }); }

	// WP-8 危象日:病始日期(正午)排盘取月黄经,存 extra.crisisBase(引擎纯陈述不扣分)。
	async fetchCrisisBase(dateStr, setExtra){
		if(!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)){ setExtra({ crisisBase: null }); return; }
		const geo = this.geoFromFields();
		const fieldsLike = { zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, hsys: geo.hsys, zodiacal: geo.zodiacal, siderealAyanamsa: geo.siderealAyanamsa, tradition: geo.tradition };
		this.setState({ crisisLoading: true });
		try{
			const R = await chartAtMoment(`${dateStr} 12:00:00`, fieldsLike);
			const F = R ? buildFacts(R) : null;
			const moonLon = F && F.planets.moon ? F.planets.moon.lon : null;
			setExtra({ crisisBase: moonLon != null ? { date: dateStr, moonLon } : null });
		}catch(e){ setExtra({ crisisBase: null }); }
		this.setState({ crisisLoading: false });
	}

	async selectNatal(rec){
		if(!rec || !rec.birth){ return; }
		const parts = `${rec.birth}`.split(' ');
		const params = {
			ad: rec.ad != null ? rec.ad : 1,
			date: parts[0], time: parts[1] || '12:00:00',
			zone: rec.zone, lat: rec.lat, lon: rec.lon,
			gpsLat: rec.gpsLat, gpsLon: rec.gpsLon,
			hsys: (this._fields && this._fields.hsys ? this._fields.hsys.value : 0),
			zodiacal: (this._fields && this._fields.zodiacal ? this._fields.zodiacal.value : 0), siderealAyanamsa: (this._fields && this._fields.siderealAyanamsa ? this._fields.siderealAyanamsa.value : ''), tradition: 1, predictive: 0, pdaspects: [0, 60, 90, 120, 180],
		};
		this.setState({ natalLoading: true });
		try{
			const rsp = await fetchChart(params, { cache: true });
			const R = rsp && rsp.Result;
			const natalFacts = R ? buildFacts(R) : null;
			this.setState({ natalRec: rec, natalFacts, natalLoading: false });
		}catch(e){ this.setState({ natalLoading: false }); }
	}

	clearNatal(){ this.setState({ natalRec: null, natalFacts: null }); }

	runScan(mode){
		const baseDt = this._fields && this._fields.date && this._fields.date.value;
		if(!baseDt){ return; }
		const cands = generateCandidates(baseDt, mode, mode === 'hours' ? { startHour: 6, endHour: 22 } : { days: 14 });
		this.setState({ scanning: true, scanOpen: true, scanResults: null, scanMode: mode });
		const topicId = this._topicId;
		Promise.all(cands.map((c) => {
			const f = {
				...this._fields,
				date: { value: c.dt, name: ['date'] },
				time: { value: c.dt.clone ? c.dt.clone() : c.dt, name: ['time'] },
				ad: { value: c.dt.ad, name: ['ad'] },
				zone: { value: c.dt.zone, name: ['zone'] },
			};
			return fetchChart(buildChartParams(f), { cache: true }).then((rsp) => {
				const R = rsp && rsp.Result;
				if(!R) return null;
				const rep = runElection(R, topicId, null, null, this._elecOpts || { westSchool: this._westSchool });
				return {
					label: c.label, dt: c.dt, idx: c.idx,
					score: rep.overall.score, grade: rep.overall.gradeCn,
					crit: rep.hard_flags.filter((x) => x.severity === 'critical').length,
					high: rep.hard_flags.filter((x) => x.severity === 'high').length,
				};
			}).catch(() => null);
		})).then((rows) => {
			this.setState({ scanning: false, scanResults: rankResults(rows) });
		});
	}

	useCandidate(dt){
		if(this._setTime){ this._setTime(dt); }
		this.setState({ scanOpen: false });
	}

	renderLeftExtra({ extra, setExtra, fields, setTime, patchFields }){
		this._fields = fields; this._setTime = setTime; this._topicId = extra.topicId || 'marriage';
		this._westSchool = extra.westSchool || 'modern_main';
		this._elecOpts = { westSchool: this._westSchool, surgeryPart: extra.surgeryPart || null, crisisBase: extra.crisisBase || null };
		const curSchool = schoolOf(this._westSchool);
		return (
			<XQSideSection iconName="target" title="择日设置" storageKey="election.opts" className="horosa-side-input-section horosa-election-opts">
				<div className="horosa-field-label">西方流派</div>
				<XQSelect style={{ width: '100%' }} size="small"
					value={this._westSchool}
					dropdownMatchSelectWidth={false}
					onChange={(val) => {
						setExtra({ westSchool: val });
						// 宫制联动:该档定义了宫制且与当前不同 → 换宫制重排(patchFields 自动 refetch);
						// 现代主流档 hsys=null 不联动(保持用户当前宫制=零回归)。
						const sch = schoolOf(val);
						if(sch.hsys !== null && fields.hsys && fields.hsys.value !== sch.hsys){
							patchFields({ hsys: sch.hsys });
						}
					}}>
					{WEST_SCHOOL_ORDER.map((id) => (
						<Option key={id} value={id}>{WEST_SCHOOLS[id].cn}</Option>
					))}
				</XQSelect>
				<div className="horosa-divi-note" style={{ marginTop: 4, fontSize: 11, lineHeight: 1.55, opacity: 0.72 }}>{curSchool.desc}</div>
				<div className="horosa-field-label" style={{ marginTop: 12 }}>用事类型</div>
				<XQSelect style={{ width: '100%' }} size="small"
					value={extra.topicId || 'marriage'}
					onChange={(val) => setExtra({ topicId: val })}>
					{ELECTION_TOPICS.map((t) => (<Option key={t.value} value={t.value}>{t.label}</Option>))}
				</XQSelect>
				{this._topicId === 'surgery' ? (
					<div style={{ marginTop: 8 }}>
						<div className="horosa-field-label">手术部位（星座主管）</div>
						<XQSelect style={{ width: '100%' }} size="small" allowClear
							placeholder="选部位后判「月不落部位星座」"
							value={extra.surgeryPart || undefined}
							dropdownMatchSelectWidth={false}
							onChange={(val) => setExtra({ surgeryPart: val || null })}>
							{SIGN_ORDER.map((sg) => (
								<Option key={sg} value={sg}>{SIGNS[sg].cn} · {(SIGNS[sg].body_parts || []).join('/')}</Option>
							))}
						</XQSelect>
						<div className="horosa-field-label" style={{ marginTop: 8 }}>病始日期（危象日参照，可选）</div>
						<input type="date" className="horosa-native-date" style={{ width: '100%', boxSizing: 'border-box' }}
							value={(extra.crisisBase && extra.crisisBase.date) || ''}
							onChange={(e) => this.fetchCrisisBase(e.target.value, setExtra)} />
						{this.state.crisisLoading ? <div className="horosa-divi-note" style={{ marginTop: 4 }}>取病始时刻月位…</div> : null}
					</div>
				) : null}
				<div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
					<XQButton size="small" iconName="search" onClick={() => this.runScan('hours')}>本日逐时择优</XQButton>
					<XQButton size="small" onClick={() => this.runScan('days')}>未来14日</XQButton>
				</div>
				{/* 本命合参 + 时势合参:并排两列(已选态为紧凑 chip,姓名省略号 + × 清除) */}
				<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className="horosa-field-label" style={{ marginBottom: 6 }}>本命合参（可选）</div>
						{this.state.natalRec ? (
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 6px 4px 9px', borderRadius: 8, background: 'var(--horosa-accent-soft, rgba(184,134,11,0.08))', border: '1px solid var(--horosa-border-soft, rgba(184,134,11,0.18))' }}
								title={`${this.state.natalRec.name || '本命'} · ${this.state.natalRec.birth}`}>
								<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{this.state.natalRec.name || '本命'}</span>
								<XQButton size="small" iconName="delete" title="清除" onClick={this.clearNatal} />
							</div>
						) : (
							<ChartSearchModal onOk={this.selectNatal}>
								<XQButton size="small" style={{ width: '100%' }} loading={this.state.natalLoading}>选本命盘</XQButton>
							</ChartSearchModal>
						)}
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className="horosa-field-label" style={{ marginBottom: 6 }}>时势合参（可选）</div>
						{this.state.mundaneSet ? (
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 6px 4px 9px', borderRadius: 8, background: 'var(--horosa-accent-soft, rgba(184,134,11,0.08))', border: '1px solid var(--horosa-border-soft, rgba(184,134,11,0.18))' }}
								title="已拉时势盘（入宫 / 新满月 / 食）">
								<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>已拉时势盘</span>
								<XQButton size="small" iconName="delete" title="清除" onClick={this.clearMundane} />
							</div>
						) : (
							<XQButton size="small" style={{ width: '100%' }} loading={this.state.mundaneLoading} onClick={this.fetchMundaneSet}>拉时势盘</XQButton>
						)}
					</div>
				</div>
			</XQSideSection>
		);
	}

	renderRight({ chart, extra }){
		// horosa_panel_ready_v1:择日盘中栏(壳画的盘)+右栏(判读)同源于 chart，本组件不发主盘请求。
		// 注意:逐时/14 日「择优扫描」(runScan)是用户另点按钮触发的后台批量排盘,**不是**
		// 「点击→画完」路径,故不在其 setState 上打点(否则会把秒级扫描配到上一次交互的起点上,污染 p95)。
		if(chart && chart !== this._readyChart){
			this._readyChart = chart;
			markPanelReady('auxchart');
		}
		return <ElectionJudgment chart={chart} topicId={extra.topicId || 'marriage'} westSchool={extra.westSchool || 'modern_main'} surgeryPart={extra.surgeryPart || null} crisisBase={extra.crisisBase || null} natalFacts={this.state.natalFacts} mundaneSet={this.state.mundaneSet} />;
	}

	renderScanModal(){
		const r = this.state.scanResults;
		return (
			<Modal
				title={this.state.scanMode === 'hours' ? '本日逐时择优（6:00–22:00）' : '未来 14 日同时刻择优'}
				open={this.state.scanOpen}
				onCancel={() => this.setState({ scanOpen: false })}
				footer={null}
				width={460}
			>
				{this.state.scanning ? <div style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>逐一排盘评分中…</div> : null}
				{r && r.length ? (
					<div>
						<div className="horosa-divi-note" style={{ marginBottom: 10 }}>{buildScanRecommendation(r)}「没有完美的择日盘」——以下为窗口内消去法排名，分高者先。</div>
						{r.map((row, i) => (
							<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px dashed rgba(148,163,184,.2)' }}>
								<span style={{ width: 18, textAlign: 'right', opacity: 0.5, fontSize: 12 }}>{i + 1}</span>
								<span style={{ width: 78, fontWeight: 600 }}>{row.label}</span>
								<span style={{ width: 8, height: 8, borderRadius: 4, background: GRADE_DOT[row.grade] || '#888', flexShrink: 0 }} />
								<span style={{ width: 40 }}>{row.score}</span>
								<span style={{ flex: 1, fontSize: 12, opacity: 0.8 }}>{row.grade}{row.crit ? ` · 严重${row.crit}` : (row.high ? ` · 较重${row.high}` : '')}</span>
								<XQButton size="small" onClick={() => this.useCandidate(row.dt)}>用此刻</XQButton>
							</div>
						))}
					</div>
				) : (this.state.scanning ? null : <div style={{ padding: 16, opacity: 0.6 }}>无候选结果。</div>)}
			</Modal>
		);
	}

	render(){
		return (
			<div style={{ height: '100%', flex: '1 1 auto', minWidth: 0, width: '100%' }}>
				<DivinationChartShell
					title="择日盘"
					kicker="择日设置"
					pageClass="horosa-election-page"
					defaults={{ tradition: 1, zodiacal: 0, hsys: 0 }}
					initialExtra={{ topicId: 'marriage' }}
					fields={this.props.fields}
					height={this.props.height}
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
					showAstroMeaning={this.props.showAstroMeaning}
					dispatch={this.props.dispatch}
					saveModule="election"
					renderLeftExtra={(args) => this.renderLeftExtra(args)}
					renderRight={(args) => this.renderRight(args)}
				/>
				{this.renderScanModal()}
			</div>
		);
	}
}

export default ElectionMain;
