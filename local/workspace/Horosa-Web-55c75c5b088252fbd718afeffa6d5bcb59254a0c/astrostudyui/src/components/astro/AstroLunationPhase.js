import { Component } from 'react';
import moment from 'moment';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { buildLunationPhases, buildLunationPhaseSnapshotText, phaseAtAge, PHASES_8, LUNATION_DEFAULT_OPTS } from '../../utils/lunationPhase';
import styles from '../../css/styles.less';
import { markPanelReady } from '../../utils/perfMark';

class AstroLunationPhase extends Component{
	constructor(props){
		super(props);
		this.state = { opts: { ...LUNATION_DEFAULT_OPTS }, data: null };
		this.rebuild = this.rebuild.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this.rebuild();
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			// horosa_panel_ready_v1:本技法无自有请求,数据整份派生自 chartObj —— 「落定」= 拿到新盘那次提交。
			markPanelReady('direction');
			this.rebuild();
			this.saveAISnapshot();
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	saveAISnapshot(){
		const txt = buildLunationPhaseSnapshotText(this.props.value, this.state.opts);
		saveModuleAISnapshot('lunationphase', txt, { tab: 'lunationphase' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'lunationphase'){ return; }
		const txt = this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	rebuild(){
		this.setState({ data: buildLunationPhases(this.props.value, this.state.opts) });
	}

	currentAge(){
		const p = (this.props.value && this.props.value.params) ? this.props.value.params : {};
		const birth = `${p.birth || ''}`.trim();
		if(!birth){ return null; }
		const m = moment(birth.replace(/\//g, '-'), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD']);
		if(!m.isValid()){ return null; }
		return moment().diff(m, 'years', true);
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const d = this.state.data;
		const curAge = this.currentAge();
		const curPhase = (curAge != null) ? phaseAtAge(this.props.value, curAge) : null;
		return (
			<div className={`${styles.scrollbar}`} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 12px' }}>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>月相推运<span style={{ fontSize: 12, opacity: 0.55, marginLeft: 8, fontWeight: 400 }}>次限日月八相 · 约 29.5 年一轮</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: '17px', marginBottom: 10 }}>由本命日月黄经差按次限推进率推算推运月相；八相各 45°，主导人生节律的「萌发—显化—释放」循环阶段。</div>
				{d && d.natalPhase ? (
					<div>
						<div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
							<div style={{ flex: 1, minWidth: 130, padding: '10px 14px', border: '1px solid rgba(128,128,128,0.16)', borderRadius: 8 }}>
								<div style={{ fontSize: 11, opacity: 0.6 }}>本命月相</div>
								<div style={{ fontSize: 16, fontWeight: 700 }}>{d.natalPhase.name}</div>
								<div style={{ fontSize: 11, opacity: 0.6 }}>日月差 {d.natalElong.toFixed(1)}°</div>
							</div>
							{curPhase ? (
								<div style={{ flex: 1, minWidth: 130, padding: '10px 14px', border: '1px solid var(--horosa-accent, rgba(184,134,11,0.4))', borderRadius: 8, background: 'var(--horosa-accent-soft, rgba(184,134,11,0.10))' }}>
									<div style={{ fontSize: 11, opacity: 0.6 }}>当前推运月相（{curAge.toFixed(1)} 岁）</div>
									<div style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-accent, #b8860b)' }}>{curPhase.name}</div>
									<div style={{ fontSize: 11, opacity: 0.7 }}>{curPhase.keyword}</div>
								</div>
							) : null}
						</div>
						<div style={{ fontSize: 12.5, fontWeight: 700, margin: '6px 0 6px', opacity: 0.8 }}>八相循环</div>
						<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
							{PHASES_8.map((ph, i) => {
								const on = curPhase && curPhase.key === ph.key;
								return (
									<div key={ph.key} style={{ display: 'flex', gap: 8, padding: '5px 10px', fontSize: 11.5, borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', background: on ? 'var(--horosa-accent-soft, rgba(184,134,11,0.14))' : 'transparent' }}>
										<span style={{ width: 64, fontWeight: on ? 700 : 500 }}>{ph.name}</span>
										<span style={{ width: 44, opacity: 0.5 }}>{ph.lo}–{ph.hi}°</span>
										<span style={{ flex: 1, opacity: 0.8 }}>{ph.keyword}</span>
									</div>
								);
							})}
						</div>
						<div style={{ fontSize: 12.5, fontWeight: 700, margin: '6px 0 6px', opacity: 0.8 }}>推运相位时间轴</div>
						<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden' }}>
							{d.timeline.map((t, i) => {
								const on = curPhase && i < d.timeline.length - 1 && curAge != null && curAge >= t.age && curAge < d.timeline[i + 1].age;
								return (
									<div key={i} style={{ display: 'flex', gap: 8, padding: '5px 10px', fontSize: 11.5, borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', background: on ? 'var(--horosa-accent-soft, rgba(184,134,11,0.12))' : 'transparent' }}>
										<span style={{ width: 70, opacity: 0.7 }}>{t.age.toFixed(1)} 岁{t.isStart ? '·本命' : ''}</span>
										<span style={{ width: 86, opacity: 0.6 }}>{t.date || '-'}</span>
										<span style={{ flex: 1, fontWeight: 500 }}>{t.phase.name}</span>
									</div>
								);
							})}
						</div>
					</div>
				) : (
					<div style={{ fontSize: 12.5, opacity: 0.55, padding: '12px 0' }}>缺日月黄经数据，无法推算。请确认本命盘已排出。</div>
				)}
			</div>
		);
	}
}

export default AstroLunationPhase;
