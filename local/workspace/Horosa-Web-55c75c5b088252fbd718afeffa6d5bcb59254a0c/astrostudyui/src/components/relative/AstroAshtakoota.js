// 合盘页「八重合」:两张盘的月亮宿、月亮座配八项分,满分 36。算法在 astropy/astrostudy/india/extra_tables.py。
import { Component } from 'react';
import { Spin } from 'antd';
import { XQSelect as Select } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, paramsRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../astro/AstroExtraCommon';
import { kootaLabel, ashtakootaDoshas, doshaCancelText, pickedAshtakootaMaleSide, rememberAshtakootaMaleSide } from '../../utils/indiaExtraTables';

const { Option } = Select;
const MALE_SIDES = [{ value: 'inner', label: '星盘 A' }, { value: 'outer', label: '星盘 B' }];
const MUTED = { color: 'var(--horosa-muted, #999)', fontSize: 12 };
const GOLD = { color: 'var(--horosa-gold, #b8860b)' };
const BAR_TRACK = { height: 6, marginTop: 4, borderRadius: 3, background: 'var(--horosa-border)', overflow: 'hidden' };
const BAR_FILL = { height: '100%', borderRadius: 3, background: 'var(--horosa-gold, #b8860b)' };
const DOSHA_BADGE = { display: 'inline-block', marginRight: 6, padding: '0 6px', borderRadius: 4, fontSize: 12, lineHeight: '18px', color: 'var(--horosa-gold, #b8860b)', border: '1px solid var(--horosa-gold, #b8860b)' };

class AstroAshtakoota extends Component{
	constructor(props){
		super(props);
		this.state = { maleSide: null, result: null, requestKey: '', loading: false, failed: false };
		this.load = this.load.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this._pairKey = this.pairKey();
		this.load();
	}

	componentDidUpdate(){
		const pair = this.pairKey();
		if(pair !== this._pairKey){      // 换了盘,男方回到这一对的口径(本次运行里亲手改过的,否则按性别)
			this._pairKey = pair;
			if(this.state.maleSide){
				this.setState({ maleSide: null });
				return;
			}
		}
		this.report();
		const key = this.reqKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._retryTimer);
	}

	pairKey(){
		const params = this.props.params;
		return params ? JSON.stringify([params.inner, params.outer]) : '';
	}

	maleSide(){
		const params = this.props.params;
		const picked = params ? pickedAshtakootaMaleSide(params.inner, params.outer) : null;
		return this.state.maleSide || picked || this.props.maleDefault || 'inner';
	}

	// 亲手改男方:记下这一对的选择,AI 双盘挂载按同一男方算(和默认相同 = 撤销)
	changeMaleSide(value){
		const params = this.props.params;
		if(params){ rememberAshtakootaMaleSide(params.inner, params.outer, value, this.props.maleDefault || 'inner'); }
		this.setState({ maleSide: value });
	}

	renderDoshas(result){
		if(!Array.isArray(result.doshas)){ return null; }
		const items = ashtakootaDoshas(result);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">Dosha</div>
				{items.length ? items.map((item)=>(
					<div key={item.koota} style={{ marginBottom: 8, fontSize: 12 }}>
						<span style={DOSHA_BADGE}>有 Dosha</span>
						<strong>{item.label}</strong>
						<span style={MUTED}>(该项 0 分)</span>
						<div style={{ marginTop: 4 }}>{doshaCancelText(item)}</div>
					</div>
				)) : <div style={{ fontSize: 12 }}>脉、星座距两项都不是 0 分,没有 Nadi / Bhakoot Dosha</div>}
				{items.length ? <div style={MUTED}>化解条件只作标注,分数照原样;各家认不认、认哪几条说法不一</div> : null}
			</div>
		);
	}

	// 只取影响结果的字段:relative 等页签状态进键会让每次切页签都重算
	body(){
		const params = this.props.params;
		if(!params){ return null; }
		return { inner: params.inner, outer: params.outer, siderealAyanamsa: params.siderealAyanamsa, maleSide: this.maleSide() };
	}

	reqKey(){
		const body = this.body();
		return body ? paramsRequestKey(body) : '';
	}

	// 当前盘算出来的结果;旧盘的分不能留在页面和快照里
	shown(){
		const key = this.reqKey();
		return key && key === this.state.requestKey ? this.state.result : null;
	}

	report(){
		const shown = this.shown();
		if(shown !== this._reported){
			this._reported = shown;
			if(this.props.onResult){ this.props.onResult(shown); }
		}
	}

	async load(){
		const body = this.body();
		if(!body){ return; }
		this._seq = (this._seq || 0) + 1;
		const seq = this._seq;
		const key = this.reqKey();
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/ashtakoota`, { body: JSON.stringify(body), silent: true, timeoutMs: 30000 });
			if(!this._mounted || seq !== this._seq){ return; }
			const result = unwrapResult(data);
			if(!result || result.err){
				this.loadFailed(key);
				return;
			}
			clearLoadFailure(this);
			this.setState({ result, requestKey: key, loading: false, failed: false });
		}catch(e){
			if(!this._mounted || seq !== this._seq){ return; }
			this.loadFailed(key);
		}
	}

	loadFailed(key){
		parkLoadFailure(this, key);
		this.setState({ loading: false, failed: true });
		clearTimeout(this._retryTimer);
		this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
	}

	render(){
		const result = this.shown();
		return (
			<Spin spinning={this.state.loading && !result}>
				<div style={{ height: this.props.height || 640, overflow: 'auto', paddingRight: 8 }}>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">八重合</div>
						<div style={{ fontSize: 40, lineHeight: '48px', fontWeight: 700 }}>{result ? `${result.total} / ${result.max}` : '-'}</div>
						<div style={MUTED}>{result ? `月亮宿和月亮座都用恒星黄道,岁差 ${result.ayanamsa};另一套传统表合计 ${result.classicTotal}` : '月亮宿和月亮座都用恒星黄道'}</div>
						<div style={{ marginTop: 8, maxWidth: 200 }}>
							<div style={MUTED}>男方</div>
							<Select size="small" style={{ width: '100%' }} value={this.maleSide()} onChange={(value)=>this.changeMaleSide(value)}>
								{MALE_SIDES.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</div>
					</div>
					{this.state.failed && !this.state.loading && !result ? <div style={MUTED}>计算失败,稍后会自动重试</div> : null}
					{result ? (
						<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">八项得分</div>
								{result.rows.map((row)=>(
									<div key={row.name} style={{ marginBottom: 10 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
											<span>{kootaLabel(row.name)}</span>
											<span style={GOLD}>{row.score} / {row.max}</span>
										</div>
										<div style={BAR_TRACK}>
											<div style={{ ...BAR_FILL, width: `${Math.max(0, Math.min(100, row.score / row.max * 100))}%` }} />
										</div>
									</div>
								))}
							</div>
							<div style={cardStyle}>
								<SmallTable rows={result.rows} rowKey={(row)=>row.name} columns={[
									{ key: 'name', title: '项', render: (value)=>`${kootaLabel(value)}(${value})` },
									{ key: 'max', title: '满分', align: 'right' },
									{ key: 'score', title: '通行表', align: 'right' },
									{ key: 'classic', title: '传统表', align: 'right' },
								]} />
							</div>
						</div>
					) : null}
					{result ? this.renderDoshas(result) : null}
				</div>
			</Spin>
		);
	}
}

export default AstroAshtakoota;
