import QuickDockBar from '../common/QuickDockBar';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Component } from 'react';
import { InputNumber, Spin } from 'antd';
import DateTime from '../comp/DateTime';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { subscribeRemoteNongli, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { formatHumanValue } from '../../utils/humanReadableFields';
import { parseDateParts } from '../../utils/dateStrSafe';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const { TabPane } = Tabs;

function parseFieldsDateTime(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){
		return null;
	}
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = fields.time.value.format('HH:mm:ss');
	// BC 安全解析:'-7040-07-19' 裸 split('-') 会撕成 [NaN,7040,7,19](年 NaN 静默传播)
	const _dp = parseDateParts(dateStr);
	const d = _dp ? [_dp.year, _dp.month, _dp.day] : [];
	const t = timeStr.split(':').map((item)=>parseInt(item, 10));
	if(d.length < 3 || t.length < 2){
		return null;
	}
	return {
		year: d[0],
		month: d[1],
		day: d[2],
		hour: t[0],
		minute: t[1],
		second: t[2] || 0,
		date: dateStr,
		time: timeStr,
		zone: fields.zone && fields.zone.value ? fields.zone.value : '',
	};
}

function defaultSeed(){
	return Math.floor((Date.now() + Math.random() * 1000000) % 1000000000);
}

// 🔴 故意【不加】horosa_kentang_result_cache_v1 结果缓存:荆诀是蓍草随机分揲
// (webjingjuesrv.py 的 seed 默认 random.randint,每次现摇),同 payload 不必同卦;
// 缓存会把某一次分揲结果钉死 = 功能降级(与 _requestCache.js 头部禁令一致)。
async function postJingJue(path, payload){
	let rsp = null;
	try{
		const rawResponse = await cachedKentangFetch(buildKentangEndpoint('jingjue', path), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'jingjue.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/jingjue/${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'jingjue.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

function fmtValue(value){
	return formatHumanValue(value);
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无荆诀数据';
	}
	if(pan.snapshot){
		return pan.snapshot;
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

// AI 起课时间挂载入口:同 taixuan 范式,seed 默认由起课时间派生; opts.seed 可被用户在挂载设置里覆盖。
export async function buildJingJueSnapshotForFields(fields, opts){
	const dt = parseFieldsDateTime(fields);
	if(!dt){ return ''; }
	try{
		const optSeed = opts && opts.seed !== undefined && opts.seed !== null && opts.seed !== '' ? Number(opts.seed) : null;
		const seed = (Number.isFinite(optSeed) && optSeed > 0)
			? Math.floor(optSeed) % 1000000000
			: (// 🔴 起课种子 BC 安全:旧式 replace(/-/g,'') 连负号一并抹 → BC 年与同数公元年折叠。
		// AD 年保持旧数字拼合逐位不变(「同一时间反复挂载同一卦」,历史存档/解读可复现);
		// mod 1e9 后年份只存个位,BC 仅把年位 +5 平移 —— 同数 BC/AD 必异 seed,AD 字节零回归。
		((dt.year >= 0 ? dt.year : Math.abs(dt.year) + 5) * 10000 + dt.month * 100 + dt.day) * 10000 + dt.hour * 100 + dt.minute) % 1000000000;
		const pan = await postJingJue('pan', { ...dt, seed });
		return buildSnapshotText(pan);
	}catch(e){ return ''; }
}

class JingJueMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.state = {
			loading: false,
			pan: null,
			rightPanelTab: 'overview',
			seed: defaultSeed(),
		};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.randomizeSeed = this.randomizeSeed.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				if(!this.restoreFromCurrentCase()){
					this.fetchPan(fields || this.props.fields);
				}
			};
		}
	}


	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.unmounted = false;
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(!this.restoreFromCurrentCase(true)){
			this.fetchPan(this.props.fields);
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.fields !== this.props.fields && this.props.fields){
			if(!this.restoreFromCurrentCase()){
				this.fetchPan(this.props.fields);
			}
		}
		if(this.skipNextSeedFetch){
			this.skipNextSeedFetch = false;
			return;
		}
		if(prevState.seed !== this.state.seed){
			this.fetchPan(this.props.fields);
		}
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'jingjue'){
			return;
		}
		const pan = this.state ? this.state.pan : null;
		if(!pan){
			return;
		}
		let text = '';
		try{
			text = `${buildSnapshotText(pan) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('jingjue', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('jingjue');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this.skipNextSeedFetch = true;
		this.setState({
			loading: false,
			pan: payload.pan || null,
			seed: options.seed !== undefined ? options.seed : this.state.seed,
		}, ()=>{
			const pan = this.state.pan;
			saveModuleAISnapshotLazy('jingjue', ()=>buildSnapshotText(pan));
		});
		return true;
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	// [自由起盘] 左栏经纬度选择 → 经纬 + 时区自动校正 + 重锚时间 + 地名(经度影响真太阳时→时柱)。
	changeGeo(rec){
		this.onFieldsChange(geoPatchFromRec(rec, this.props.fields));
	}
	onTimeChanged(value){
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
			// [R3-A2] 步进方向提示:驱动 settle 后 /chart ±步预取(消费后即剥离)
			...(value.step ? { __stepHint: value.step } : {}),
		});
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		const patch = {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		return {
			...(baseFields || {}),
			...patch,
		};
	}

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		if(nextFields.date && nextFields.time && nextFields.zone){
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
		}
		this.fetchPan(nextFields);
	}

	randomizeSeed(){
		this.setState({ seed: defaultSeed() });
	}

	async fetchPan(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postJingJue('pan', {
				...dt,
				seed: this.state.seed,
			});
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:pan 落定 = 中栏与右栏(皆由 pan 派生)画完的那一次 setState。
				markPanelReady('cnyibu');
				saveModuleAISnapshotLazy('jingjue', ()=>buildSnapshotText(pan));
			});
		}catch(e){
			console.warn('jingjue backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'jingjue',
			label: '荆诀',
			payload: {
				options: {
					seed: this.state.seed,
				},
				pan: this.state.pan,
				snapshot: buildSnapshotText(this.state.pan),
			},
		});
	}

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		return (
			<div className="horosa-huangji-input-stack horosa-jingjue-input-stack">
				<div>
					<div className="horosa-side-panel-title">荆诀设置</div>
					<div className="horosa-side-panel-subtitle">时间与起课复现选项</div>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				{/* [左栏统一] 收编 XQSideSection(原图标保留,卡片类透传) */}
				<XQSideSection iconName="quickNote" title="荆诀选项" storageKey="jingjue.opts" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>起筮种子</span>
							<InputNumber value={this.state.seed} min={0} max={999999999} onChange={(v)=>this.setState({ seed: v || 0 })} />
						</label>
					</div>
					<div className="horosa-taixuan-note">上游荆诀使用随机三十算起课。星阙用种子固定本课，点击“重起”会换一组新三分。</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起课</Button>
					<Button onClick={this.randomizeSeed}>重起</Button>
				</div>
			</div>
		);
	}

	renderGroups(){
		const jj = this.state.pan && this.state.pan.jingjue ? this.state.pan.jingjue : {};
		const groups = jj.groups || [];
		return (
			<div className="horosa-jingjue-group-stack">
				{groups.map((item)=>(
					<div className="horosa-jingjue-group-row" key={item.key}>
						<span>{item.key}</span>
						<strong>{fmtValue(item.count)} 算</strong>
						<em>余 {fmtValue(item.remainder)}</em>
					</div>
				))}
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan || !pan.jingjue){
			return <div className="horosa-huangji-empty">暂无荆诀数据</div>;
		}
		const jj = pan.jingjue || {};
		const gua = jj.gua || {};
		return (
			<div className="horosa-taixuan-board horosa-jingjue-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2 className="horosa-taixuan-title">荆诀</h2>
					</div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				<div className="horosa-huangji-meta-grid horosa-taixuan-meta-grid horosa-jingjue-meta-grid">
					<div><span>干卦</span><strong>{fmtValue(gua.name)}</strong></div>
					<div><span>吉凶</span><strong>{fmtValue(gua.verdict)}</strong></div>
					<div><span>卦键</span><strong>{fmtValue(jj.key)}</strong></div>
					<div><span>三分余数</span><strong>{fmtValue(jj.remainders)}</strong></div>
					<div><span>关键词</span><strong>{fmtValue(gua.keyword)}</strong></div>
					<div><span>祟提示</span><strong>{fmtValue(gua.spirit)}</strong></div>
					<div><span>起筮种子</span><strong>{fmtValue(pan.seed)}</strong></div>
				</div>
				<div className="horosa-taixuan-main-grid horosa-jingjue-main-grid">
					<div className="horosa-taixuan-symbol-card horosa-jingjue-symbol-card">
						<div className="horosa-taixuan-symbol-head">
							<span>三十算</span>
							<strong>{fmtValue(jj.key)}</strong>
						</div>
						{this.renderGroups()}
					</div>
					<div className="horosa-taixuan-text-card horosa-jingjue-text-card">
						<span>卦义</span>
						<strong>{fmtValue(gua.text)}</strong>
					</div>
				</div>
			</div>
		);
	}

	renderRows(sections){
		const list = sections || [];
		if(!list.length){
			return <div className="horosa-huangji-empty">暂无数据</div>;
		}
		return list.map((section)=>(
			<div className="horosa-huangji-info-card" key={section.title}>
				<div className="horosa-huangji-info-heading">{section.title}</div>
				{(section.rows || []).map((row, idx)=>(
					<div className="horosa-huangji-info-row" key={`${section.title}_${row.label}_${idx}`}>
						<span>{row.label}</span>
						<strong>{fmtValue(row.value)}</strong>
					</div>
				))}
			</div>
		));
	}

	renderAllGua(){
		const items = this.state.pan && this.state.pan.jingjue ? (this.state.pan.jingjue.allGua || []) : [];
		if(!items.length){
			return <div className="horosa-huangji-empty">暂无十六卦</div>;
		}
		return (
			<div className="horosa-jingjue-gua-list">
				{items.map((item)=>(
					<div className="horosa-huangji-classic-section horosa-jingjue-gua-card" key={item.key}>
						<strong>{item.name} · {item.key} · {item.verdict}</strong>
						<em>{fmtValue(item.keyword)}</em>
						<p>{fmtValue(item.text)}</p>
					</div>
				))}
			</div>
		);
	}

	renderClassics(){
		const classics = this.state.pan && this.state.pan.classics ? this.state.pan.classics : null;
		if(!classics || !classics.sections || !classics.sections.length){
			return <div className="horosa-huangji-empty">暂无来源说明</div>;
		}
		return (
			<div className="horosa-huangji-classics">
				{(classics.meta || []).map((item)=>(
					<div className="horosa-huangji-info-card" key={item.key}>
						<div className="horosa-huangji-info-heading">{item.title}</div>
						<div className="horosa-huangji-info-row"><span>作者</span><strong>{item.author}</strong></div>
						<div className="horosa-huangji-info-row"><span>说明</span><strong>{item.description}</strong></div>
					</div>
				))}
				<div className="horosa-huangji-classic-list">
					{classics.sections.map((section)=>(
						<div className="horosa-huangji-classic-section" key={section.title}>
							<strong>{section.title}</strong>
							<p>{section.content}</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderRightPanel(){
		const pan = this.state.pan;
		const activeKey = ['overview', 'cast', 'gua'].indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs">
				<TabPane tab="概览" key="overview">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(0, 2) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="起课" key="cast">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'cast'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(0, 3) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="十六卦" key="gua">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'gua'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderAllGua()}</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.pan,
			primary: { key: 'reseed', label: '重起', onClick: ()=>this.randomizeSeed() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="jingjue"
				className="horosa-huangji-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height, minHeight: height, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}else if(height === '100%'){
			height = 760;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}else{
			height = height - 20;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}
		return (
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-taixuan-redesign horosa-jingjue-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
								<div className="horosa-huangji-board-host">{this.renderCenter()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">荆诀信息</div>
										<div className="horosa-side-panel-subtitle">起课与十六卦</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</Spin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}

export default JingJueMain;
