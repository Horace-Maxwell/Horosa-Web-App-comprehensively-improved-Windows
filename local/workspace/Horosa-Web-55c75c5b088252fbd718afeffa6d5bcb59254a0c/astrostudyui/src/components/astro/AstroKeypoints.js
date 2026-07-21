import { Component } from 'react';
import moment from 'moment';
import { Row, Col } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { buildKeypoints, buildKeypointsSnapshotText, RELEASE_MODES, KEYPOINTS_DEFAULT_OPTS } from '../../utils/keypoints120';
import { symbolWithMeaning } from './AstroExtraCommon';
import { XQSelect as Select } from '../xq-ui';
import styles from '../../css/styles.less';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;

class AstroKeypoints extends Component{
	constructor(props){
		super(props);
		this.state = { opts: { ...KEYPOINTS_DEFAULT_OPTS }, data: null };
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
		const txt = buildKeypointsSnapshotText(this.props.value, this.state.opts);
		saveModuleAISnapshot('keypoints', txt, { tab: 'keypoints' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'keypoints'){ return; }
		const txt = this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	rebuild(){
		this.setState({ data: buildKeypoints(this.props.value, this.state.opts) });
	}

	changeOpt(key, val){
		const opts = { ...this.state.opts, [key]: val };
		this.setState({ opts }, () => { this.rebuild(); this.saveAISnapshot(); });
	}

	currentAge(){
		const p = (this.props.value && this.props.value.params) ? this.props.value.params : {};
		const birth = `${p.birth || ''}`.trim();
		if(!birth){ return null; }
		const m = moment(birth.replace(/\//g, '-'), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD']);
		if(!m.isValid()){ return null; }
		return moment().diff(m, 'years');
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const opts = this.state.opts;
		const d = this.state.data;
		const curAge = this.currentAge();
		return (
			<div className={`${styles.scrollbar}`} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 12px' }}>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>数字相位推运<span style={{ fontSize: 12, opacity: 0.55, marginLeft: 8, fontWeight: 400 }}>120 年关键点 · 小年因数激活</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: '17px', marginBottom: 10 }}>各星与「自释放点起第 k 个星座」挂钩数字 k；凡年龄为 k 或其小年之倍数即激活（过运传递：释放点 → 该星），两端星体组合于该年被引动。</div>
				<Row gutter={12} style={{ marginBottom: 12 }}>
					<Col span={12}>
						<div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 4 }}>释放点</div>
						<Select value={opts.mode} onChange={(v) => this.changeOpt('mode', v)} style={{ width: '100%' }}>
							{Object.keys(RELEASE_MODES).map((k) => <Option value={k} key={k}>{RELEASE_MODES[k]}</Option>)}
						</Select>
					</Col>
				</Row>
				{d && d.positions && d.positions.length ? (
					<div style={{ fontSize: 11.5, opacity: 0.8, marginBottom: 10, padding: '8px 10px', border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 4 }}>星位挂钩</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
							{d.positions.map((x) => (
								<span key={x.planet}><span style={{ fontFamily: AstroConst.AstroFont }}>{symbolWithMeaning(x.planet, this.props.showAstroMeaning)}</span> 第{x.k}座·小年{x.period}</span>
							))}
						</div>
					</div>
				) : null}
				{d && d.rows && d.rows.length ? (
					<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden' }}>
						<div style={{ display: 'flex', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, opacity: 0.7, background: 'rgba(128,128,128,0.05)' }}>
							<span style={{ width: 34 }}>年龄</span>
							<span style={{ width: 60 }}>因数</span>
							<span style={{ flex: 1 }}>位置激活</span>
							<span style={{ flex: 1 }}>小年激活</span>
						</div>
						{d.rows.map((row, i) => {
							const active = curAge != null && row.age === curAge;
							return (
								<div key={i} style={{ display: 'flex', gap: 6, padding: '5px 10px', fontSize: 11.5, borderTop: '1px solid rgba(128,128,128,0.06)', background: active ? 'var(--horosa-accent-soft, rgba(184,134,11,0.14))' : 'transparent' }}>
									<span style={{ width: 34, fontWeight: active ? 700 : 400 }}>{row.age}</span>
									<span style={{ width: 60, opacity: 0.6 }}>{row.factors.length ? row.factors.map((f) => f.join('×')).join(' ') : '质'}</span>
									<span style={{ flex: 1 }}>{row.posActive.map((x) => x.planetCn).join('·') || '-'}</span>
									<span style={{ flex: 1 }}>{row.tableActive.map((x) => x.planetCn).join('·') || '-'}</span>
								</div>
							);
						})}
					</div>
				) : (
					<div style={{ fontSize: 12.5, opacity: 0.55, padding: '12px 0' }}>缺释放点数据，无法计算。请确认本命盘已排出。</div>
				)}
			</div>
		);
	}
}

export default AstroKeypoints;
