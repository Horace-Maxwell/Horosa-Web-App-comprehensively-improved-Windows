// 印占「行运」页的穿界表:七星入座、入宿、入足、入 Kakshya 的时刻。算法在 astropy/astrostudy/india/transit_events.py。
// 当前所选的星、事件、范围与结果写进印占快照(按出生时空认盘);重算期间清空,旧表不留给 AI。
import { Component } from 'react';
import { XQSelect as Select } from '../../xq-ui';
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import { dispatchModuleSnapshotRefresh } from '../../../utils/moduleSnapshotRefresh';
import { unwrapResult, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../AstroExtraCommon';
import {
	TRANSIT_DAY_OPTIONS, TRANSIT_KIND_OPTIONS, TRANSIT_PLANET_OPTIONS, TRANSIT_DEFAULT_SELECTION, extraPointName, transitEventText, transitRelationText,
	indiaTransitBirthSig, setIndiaTransitSnapshot, INDIA_TABLE_SETTINGS, savedTransitSelection,
} from '../../../utils/indiaExtraTables';

const { Option } = Select;

class IndiaTransitEvents extends Component{
	constructor(props){
		super(props);
		// 所选三项:缺省 → 本机保存值 → 宿主内存(切页签回来照原样)
		this.state = { ...TRANSIT_DEFAULT_SELECTION, ...savedTransitSelection(), result: null, requestKey: '', loading: false, failed: false, ...(props.memo || {}) };
	}

	componentDidMount(){
		this._mounted = true;
		this.report();
		if(this.state.requestKey !== this.reqKey()){ this.load(); }
	}

	remember(patch){
		if(this.props.memo){ Object.assign(this.props.memo, patch); }
	}

	componentDidUpdate(){
		this.report();
		const key = this.reqKey();
		if(key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._retryTimer);
	}

	body(){
		const { transitPlanet, transitKind, transitDays } = this.state;
		return { ...this.props.params, transitStart: this.props.start, transitPlanet, transitKind, transitDays };
	}

	reqKey(){ return JSON.stringify(this.body()); }

	// 当前所选算出来的表;换了星 / 事件 / 范围 / 起始日还没算好时为 null
	shown(){
		return this.state.result && this.state.requestKey === this.reqKey() ? this.state.result : null;
	}

	// 表变了才重写这张盘的快照槽,并请本盘所在的页(印占页 / 择日宿主槽 snapshotScope)按此刻所见重存快照
	report(){
		const result = this.shown();
		const params = this.props.params || {};
		const birthSig = indiaTransitBirthSig(params);
		if(result === this._reported && birthSig === this._reportedSig){ return; }
		if(this._reportedSig && this._reportedSig !== birthSig){ setIndiaTransitSnapshot(null, this._reportedSig); }
		this._reported = result;
		this._reportedSig = birthSig;
		const { transitPlanet, transitKind, transitDays } = this.state;
		setIndiaTransitSnapshot(result ? {
			birthSig, start: this.props.start, transitPlanet, transitKind, transitDays, ayanamsa: params.siderealAyanamsa, result,
		} : null, birthSig);
		dispatchModuleSnapshotRefresh(this.props.snapshotScope || 'indiachart');
	}

	async load(){
		this._seq = (this._seq || 0) + 1;
		const seq = this._seq;
		const key = this.reqKey();
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/transitevents`, { body: JSON.stringify(this.body()), silent: true, timeoutMs: 30000 });
			if(!this._mounted || seq !== this._seq){ return; }
			const result = unwrapResult(data);
			if(!result || result.err){
				this.loadFailed(key);
				return;
			}
			clearLoadFailure(this);
			this.remember({ result, requestKey: key });
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

	renderSelect(field, label, options){
		return (
			<div className="horosa-india-select-field">
				<span>{label}</span>
				<Select size="small" style={{ width: '100%' }} value={this.state[field]} onChange={(value)=>{ this.remember({ [field]: value }); INDIA_TABLE_SETTINGS.save({ [field]: value }); this.setState({ [field]: value }); }}>
					{options.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
				</Select>
			</div>
		);
	}

	render(){
		const result = this.shown();
		const fresh = !!result;
		const rows = fresh ? result.rows : [];
		return (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">穿界时刻</div>
				<div className="horosa-india-select-grid">
					{this.renderSelect('transitPlanet', '星', TRANSIT_PLANET_OPTIONS)}
					{this.renderSelect('transitKind', '事件', TRANSIT_KIND_OPTIONS)}
					{this.renderSelect('transitDays', '范围', TRANSIT_DAY_OPTIONS)}
				</div>
				{fresh ? (
					<SmallTable rows={rows} maxHeight={360} scrollClassName="horosa-india-scroll-box" rowKey={(row, idx)=>`${row.jd}${row.planet}${idx}`} columns={[
						{ key: 'date', title: '时刻', render: (value, row)=>`${value} ${`${row.time}`.slice(0, 5)}` },
						{ key: 'planet', title: '星', render: extraPointName },
						{ key: 'kind', title: '进入', render: (value, row)=>transitEventText(row) },
						{ key: 'relation', title: '座主', render: transitRelationText },
					]} />
				) : <div className="horosa-india-dasha-empty">{this.state.failed && !this.state.loading ? '计算失败,稍后会自动重试' : '计算中...'}</div>}
				{fresh && result.truncated ? <div className="horosa-india-card-note">事件共 {result.total} 条,只列前 {rows.length} 条,可以缩短范围或只看一颗星。</div> : null}
			</div>
		);
	}
}

export default IndiaTransitEvents;
