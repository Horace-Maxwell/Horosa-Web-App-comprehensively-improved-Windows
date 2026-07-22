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

async function postTaiXuanRaw(path, payload){
	let rsp = null;
	try{
		const rawResponse = await cachedKentangFetch(buildKentangEndpoint('taixuan', path), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'taixuan.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/taixuan/${path}`, {
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
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'taixuan.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

// v3.5.1 收敛:结果级缓存退役 —— Raw 内部已走上游 utils/kentangCache(seedInBody:
// 同 payload[含 seed]→同卦;「起筮」换 seed=换键必重取,随机语义零损失)。
function postTaiXuan(path, payload){
	return postTaiXuanRaw(path, payload);
}

function fmtValue(value){
	return formatHumanValue(value);
}

// [太玄经全文] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「全文」tab renderAllLines 同源
// pan.taixuan.allLines(当值首九赞初一…上九逐条全文),经文原样引用零改写;数据缺失不产段。
// 独立成块:后端 /taixuan/pan 恒写 pan.snapshot(早返回路径),全文段必须两条路径都拼——
// 初版只挂在 sections 循环之后=永不执行的死码(独立复核咬出)。
function buildTaixuanQuanwenBlock(pan){
	const allLines = pan && pan.taixuan && Array.isArray(pan.taixuan.allLines) ? pan.taixuan.allLines : [];
	if(!allLines.length){
		return '';
	}
	const lines = ['[太玄经全文]'];
	const headName = pan.taixuan && pan.taixuan.gua && pan.taixuan.gua.name ? pan.taixuan.gua.name : '';
	if(headName){
		lines.push(`当值首：${fmtValue(headName)}`);
	}
	allLines.forEach((item)=>{
		// name 也过 fmtValue:后端偶发缺 name(null/undefined)时快照不外泄裸「null/undefined」串(压测边角加固)。
		lines.push(`◆ ${fmtValue(item.name)}：${fmtValue(item.content)}`);
	});
	return lines.join('\n');
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无太玄数据';
	}
	const quanwen = buildTaixuanQuanwenBlock(pan);
	if(pan.snapshot){
		return quanwen ? `${pan.snapshot}\n\n${quanwen}` : pan.snapshot;
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	if(quanwen){
		lines.push(quanwen);
		lines.push('');
	}
	return lines.join('\n').trim();
}

// AI 起课时间挂载入口:把当前时间/地点 fields 推到 kentang taixuan 后端起一盘 → 返回快照文本。
// seed 默认由起课时间的 yyyyMMddHHmm 派生(不随 Date.now() 漂移),保证同一时间反复挂载得同一卦,符合「时间起卦」语义。
// opts.seed(用户在挂载设置里覆盖) 优先级最高;opts.seed===undefined 或 0 仍走时间派生。
export async function buildTaiXuanSnapshotForFields(fields, opts){
	const dt = parseFieldsDateTime(fields);
	if(!dt){ return ''; }
	try{
		const optSeed = opts && opts.seed !== undefined && opts.seed !== null && opts.seed !== '' ? Number(opts.seed) : null;
		const seed = (Number.isFinite(optSeed) && optSeed > 0)
			? Math.floor(optSeed) % 1000000000
			: (parseInt(dt.date.replace(/-/g, ''), 10) * 10000 + dt.hour * 100 + dt.minute) % 1000000000;
		const pan = await postTaiXuan('pan', { ...dt, seed });
		return buildSnapshotText(pan);
	}catch(e){ return ''; }
}

class TaiXuanMain extends Component{
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

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'taixuan'){
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
			saveModuleAISnapshot('taixuan', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('taixuan');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			// [X1·P2-7] 与 wuzhao 同类修:去重命中曾返 false → fields 再变时落 else 分支 fetchPan
			// 覆盖已还原冻结盘;已持有盘 → 返 true 拦下,盘丢了才放行向下重还原。
			if(this.state.pan){ return true; }
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
			saveModuleAISnapshotLazy('taixuan', ()=>buildSnapshotText(pan));
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

	// horosa_prefetch_registry_v1(PERF-R10 P6):供 CnYiBuMain 'cnyibu' 预取器按活跃子页转发。
	// 太玄的 random 由 payload.seed 确定性播种(FE-2 已核),步进只变时间、seed 取当前值
	// —— 与用户步进后真点的请求逐字节同键;起筮换 seed 走别的路径,不受影响。
	getStepPrefetchTasks(steppedFields){
		try{
			const dt = parseFieldsDateTime(steppedFields);
			if(!dt){ return []; }
			const payload = { ...dt, seed: this.state.seed };
			return [{
				name: 'taixuan',
				path: '/taixuan/pan',
				run: ()=> postTaiXuan('pan', payload).catch(()=>{ /* 预取失败静默 */ }),
			}];
		}catch(e){
			return [];
		}
	}

	async fetchPan(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postTaiXuan('pan', {
				...dt,
				seed: this.state.seed,
			});
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:pan 落定 = 中栏与右栏(皆由 pan 派生)画完的那一次 setState。
				markPanelReady('cnyibu');
				saveModuleAISnapshotLazy('taixuan', ()=>buildSnapshotText(pan));
			});
		}catch(e){
			console.warn('taixuanshifa backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'taixuan',
			label: '太玄',
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
			<div className="horosa-huangji-input-stack horosa-taixuan-input-stack">
				<div>
					<div className="horosa-side-panel-title">太玄设置</div>
					<div className="horosa-side-panel-subtitle">时间与起筮复现选项</div>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				<XQSideSection iconName="other" title="太玄选项" storageKey="taixuan.opts" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>起筮种子</span>
							<InputNumber value={this.state.seed} min={0} max={999999999} onChange={(v)=>this.setState({ seed: v || 0 })} />
						</label>
					</div>
					<div className="horosa-taixuan-note">太玄筮法上游使用随机揲筮。星阙用种子固定本盘，点击“重起”会换一组新筮数。</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
					<Button onClick={this.randomizeSeed}>重起</Button>
				</div>
			</div>
		);
	}

	renderLineDiagram(){
		const tx = this.state.pan && this.state.pan.taixuan ? this.state.pan.taixuan : {};
		const places = tx.fourPlaces || [];
		return (
			<div className="horosa-taixuan-line-stack">
				{places.map((item)=>(
					<div className="horosa-taixuan-line-row" key={item.key}>
						<span>{item.label}</span>
						<strong>{item.symbol || '—'}</strong>
					</div>
				))}
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan || !pan.taixuan){
			return <div className="horosa-huangji-empty">暂无太玄数据</div>;
		}
		const tx = pan.taixuan || {};
		const gz = pan.ganzhi || {};
		const xh = tx.xuanHead || {};
		const winter = pan.winterSolstice || {};
		const gzItems = [
			{ label: '年柱', value: gz.year },
			{ label: '月柱', value: gz.month },
			{ label: '日柱', value: gz.day },
			{ label: '时柱', value: gz.hour },
		];
		return (
			<div className="horosa-taixuan-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2 className="horosa-taixuan-title">太玄筮法</h2>
					</div>
					<div className="horosa-huangji-board-time">{`${fmtValue(pan.dateStr)} ${fmtValue(pan.hour)}时`}</div>
				</div>
				<div className="horosa-huangji-meta-grid horosa-taixuan-meta-grid">
					<div><span>首</span><strong>{fmtValue(tx.gua && tx.gua.name)}</strong></div>
					<div><span>起筮时段</span><strong>{fmtValue(tx.period)}</strong></div>
					<div><span>玄首</span><strong>{fmtValue(xh.number)}，{fmtValue(xh.relation)}</strong></div>
					<div><span>星宿</span><strong>{fmtValue(tx.starLodge && tx.starLodge.text)}</strong></div>
					<div><span>方州部家</span><strong>{fmtValue(tx.head)}</strong></div>
					<div><span>休咎</span><strong>{fmtValue(xh.judgment)}</strong></div>
					<div><span>占 / 玄赞</span><strong>{fmtValue(tx.zhanNumber)} / {fmtValue(xh.xuanZan)}</strong></div>
					<div><span>冬至起算</span><strong>{fmtValue(winter.date)}，{fmtValue(winter.days)}日</strong></div>
					<div className="horosa-huangji-ganzhi-card">
						<span>干支</span>
						<div className="horosa-huangji-ganzhi-grid">
							{gzItems.map((item)=>(
								<div className="horosa-huangji-ganzhi-item" key={item.label}>
									<em>{item.label}</em>
									<strong>{fmtValue(item.value)}</strong>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="horosa-taixuan-main-grid">
					<div className="horosa-taixuan-symbol-card">
						<div className="horosa-taixuan-symbol-head">
							<span>筮得</span>
							<strong>{fmtValue(tx.zhou)}</strong>
						</div>
						{this.renderLineDiagram()}
					</div>
					<div className="horosa-taixuan-text-card">
						<span>首辞</span>
						<strong>{fmtValue(tx.gua && tx.gua.text)}</strong>
						<div className="horosa-taixuan-selected-lines">
							{(tx.selectedLines || []).map((item)=>(
								<div key={item.name}>
									<em>{item.name}</em>
									<p>{fmtValue(item.content)}</p>
								</div>
							))}
						</div>
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

	renderAllLines(){
		const lines = this.state.pan && this.state.pan.taixuan ? (this.state.pan.taixuan.allLines || []) : [];
		if(!lines.length){
			return <div className="horosa-huangji-empty">暂无全文</div>;
		}
		return (
			<div className="horosa-taixuan-all-lines">
				{lines.map((item)=>(
					<div className="horosa-huangji-classic-section" key={item.name}>
						<strong>{item.name}</strong>
						<p>{fmtValue(item.content)}</p>
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
		const activeKey = ['overview', 'head', 'lines', 'fulltext'].indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs">
				<TabPane tab="概览" key="overview">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
						<div className="horosa-huangji-section-list">
							{/* 概览=「起盘」节(sections[0]);玄首/方州部家归各自页签,避免「玄首」节在两个页签重复显示。 */}
							{this.renderRows(pan ? (pan.sections || []).slice(0, 1) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="玄首" key="head">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'head'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(1, 3) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="表" key="lines">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'lines'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(3, 4) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="全文" key="fulltext">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'fulltext'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderAllLines()}</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.pan,
			primary: { key: 'reseed', label: '起筮', onClick: ()=>this.randomizeSeed() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="taixuan"
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
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-taixuan-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
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
										<div className="horosa-side-panel-title">太玄信息</div>
										<div className="horosa-side-panel-subtitle">玄首、表与全文</div>
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

export default TaiXuanMain;
