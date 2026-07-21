import { Component } from 'react';
import { Row, Col, InputNumber } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { buildTriplicityPeriods, buildTriplicityRulersSnapshotText, TRIPLICITY_DIVISIONS, TRIPLICITY_SYSTEMS, TRIPLICITY_SYSTEM_HINTS, TRIPLICITY_HOUSE_SIGS, TRIPLICITY_DEFAULT_OPTS, PLANETARY_PERIOD_YEARS } from '../../utils/triplicityRulers';
import { symbolWithMeaning } from './AstroExtraCommon';
import { XQSelect as Select, XQSegmented } from '../xq-ui';
import styles from '../../css/styles.less';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
// 三分体系切换项（默认多罗特＝现状）。
const TRIP_SYSTEM_OPTIONS = Object.keys(TRIPLICITY_SYSTEMS).map((k) => ({ value: k, label: TRIPLICITY_SYSTEMS[k] }));
const ANGULARITY_COLOR = { angular: 'var(--horosa-direction-level-1, #2e7d32)', succedent: 'var(--horosa-direction-level-3, #b8860b)', cadent: 'var(--horosa-cinnabar, #b71c1c)' };
const ANGULARITY_CN = { angular: '角宫·旺', succedent: '续宫·中', cadent: '果宫·衰' };

class AstroTriplicityRulers extends Component{
	constructor(props){
		super(props);
		// 三分体系初值优先取流派预设(props.tripSystem)；未传或无效则用现状默认 Dorothean(零回归)。
		const initSystem = (props.tripSystem && TRIPLICITY_SYSTEMS[props.tripSystem]) ? props.tripSystem : TRIPLICITY_DEFAULT_OPTS.system;
		this.state = { opts: { ...TRIPLICITY_DEFAULT_OPTS, system: initSystem }, data: null };
		this.rebuild = this.rebuild.bind(this);
		this.changeOpt = this.changeOpt.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this.rebuild();
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentDidUpdate(prevProps){
		// 流派预设切换 → 联动三分体系(用户随后仍可用下方分段控件本地覆盖)。
		if(prevProps.tripSystem !== this.props.tripSystem && this.props.tripSystem && TRIPLICITY_SYSTEMS[this.props.tripSystem] && this.props.tripSystem !== this.state.opts.system){
			const opts = { ...this.state.opts, system: this.props.tripSystem };
			this.setState({ opts }, () => { this.rebuild(); this.saveAISnapshot(); });
		}
		if(prevProps.value !== this.props.value || prevProps.showAstroMeaning !== this.props.showAstroMeaning){
			this.rebuild();
			if(prevProps.value !== this.props.value){
				// horosa_panel_ready_v1:本技法无自有请求,数据整份派生自 chartObj —— 「落定」= 拿到新盘那次提交。
				markPanelReady('direction');
				this.saveAISnapshot();
			}
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	saveAISnapshot(){
		const txt = buildTriplicityRulersSnapshotText(this.props.value, this.state.opts);
		saveModuleAISnapshot('triplicityrulers', txt, { tab: 'triplicityrulers' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'triplicityrulers'){ return; }
		const txt = this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	rebuild(){
		this.setState({ data: buildTriplicityPeriods(this.props.value, this.state.opts) });
	}

	changeOpt(key, val){
		const opts = { ...this.state.opts, [key]: val };
		this.setState({ opts }, () => { this.rebuild(); this.saveAISnapshot(); });
	}

	renderPeriod(p, i){
		const q = p.quality || {};
		const col = q.angularity ? ANGULARITY_COLOR[q.angularity] : 'var(--horosa-text-soft)';
		return (
			<div key={i} style={{ border: '1px solid rgba(128,128,128,0.16)', borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<span style={{ fontFamily: AstroConst.AstroFont, fontSize: 18 }}>{symbolWithMeaning(p.ruler, this.props.showAstroMeaning)}</span>
						<span style={{ fontSize: 14, fontWeight: 700, fontFamily: AstroConst.NormalFont }}>{p.rulerCn}</span>
						<span style={{ fontSize: 11.5, opacity: 0.6 }}>{p.role}</span>
					</div>
					<span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.fromAge.toFixed(0)}–{p.toAge.toFixed(0)} 岁</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 11.5, opacity: 0.8 }}>
					{p.fromDate ? <span>{p.fromDate} ~ {p.toDate}</span> : null}
					{q.house ? <span style={{ color: col }}>第{q.house}宫 · {ANGULARITY_CN[q.angularity]}</span> : null}
					{q.dignity ? <span>{q.dignity}</span> : null}
					{q.retro ? <span style={{ color: 'var(--horosa-cinnabar, #b71c1c)' }}>逆行</span> : null}
					<span style={{ opacity: 0.6 }}>行星期 {PLANETARY_PERIOD_YEARS[p.ruler]} 年</span>
				</div>
			</div>
		);
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const opts = this.state.opts;
		const d = this.state.data;
		return (
			<div className={`${styles.scrollbar}`} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 12px' }}>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>三分主星推运<span style={{ fontSize: 12, opacity: 0.55, marginLeft: 8, fontWeight: 400 }}>区间光体三分主星 · 人生阶段</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: '17px', marginBottom: 10 }}>昼生看太阳所在座、夜生看月亮所在座，取该座三颗三分主星按昼夜换序分掌人生各阶段；落角宫主鼎盛、果宫主衰减。</div>
				<div style={{ marginBottom: 12 }}>
					<div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 4 }}>三分体系</div>
					<XQSegmented value={opts.system} options={TRIP_SYSTEM_OPTIONS} onChange={(e) => this.changeOpt('system', e && e.target ? e.target.value : e)} />
					<div style={{ fontSize: 11, opacity: 0.55, lineHeight: '16px', marginTop: 6 }}>{TRIPLICITY_SYSTEM_HINTS[opts.system] || TRIPLICITY_SYSTEM_HINTS.Dorothean}</div>
				</div>
				<Row gutter={12} style={{ marginBottom: 12 }}>
					<Col span={14}>
						<div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 4 }}>划分法</div>
						<Select value={opts.division} onChange={(v) => this.changeOpt('division', v)} style={{ width: '100%' }}>
							{Object.keys(TRIPLICITY_DIVISIONS).map((k) => <Option value={k} key={k}>{TRIPLICITY_DIVISIONS[k]}</Option>)}
						</Select>
					</Col>
					<Col span={10}>
						<div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 4 }}>寿命基准（岁）</div>
						<InputNumber value={opts.lifespan} min={30} max={120} style={{ width: '100%' }} onChange={(v) => this.changeOpt('lifespan', v)} />
					</Col>
				</Row>
				{d && d.periods && d.periods.length ? (
					<div>
						<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{d.isDiurnal ? '昼' : '夜'}生盘 · 区间光体 <b>{d.sectLightCn}</b>（{d.signCn}）</div>
						{d.periods.map((p, i) => this.renderPeriod(p, i))}
						<div style={{ fontSize: 12.5, fontWeight: 700, margin: '14px 0 8px', opacity: 0.8 }}>逐宫三分主星象征（古典应用）</div>
						<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden' }}>
							{Object.keys(TRIPLICITY_HOUSE_SIGS).map((h, i) => {
								const s = TRIPLICITY_HOUSE_SIGS[h];
								return (
									<div key={h} style={{ display: 'flex', gap: 8, padding: '5px 10px', fontSize: 11, borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
										<span style={{ width: 26, fontWeight: 700, opacity: 0.6 }}>{h}宫</span>
										<span style={{ flex: 1, opacity: 0.85 }}>一主：{s.first}{s.second && s.second !== '—' ? `；二主：${s.second}` : ''}{s.third && s.third !== '—' ? `；三主：${s.third}` : ''}</span>
									</div>
								);
							})}
						</div>
					</div>
				) : (
					<div style={{ fontSize: 12.5, opacity: 0.55, padding: '12px 0' }}>缺区间光体星座数据，无法切分。请确认本命盘已排出。</div>
				)}
			</div>
		);
	}
}

export default AstroTriplicityRulers;
