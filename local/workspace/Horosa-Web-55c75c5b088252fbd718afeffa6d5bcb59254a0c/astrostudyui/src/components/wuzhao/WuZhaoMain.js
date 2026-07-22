import QuickDockBar from '../common/QuickDockBar';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Component } from 'react';
import { InputNumber, Spin } from 'antd';
import DateTime from '../comp/DateTime';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { subscribeRemoteNongli, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { stepPrefetchEnabled, kentangCacheEnabled } from '../../utils/perfFlags';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { formatHumanValue } from '../../utils/humanReadableFields';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { parseDateParts } from '../../utils/dateStrSafe';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const { Option } = Select;
const { TabPane } = Tabs;

const MODE_OPTIONS = [
	{ value: 'ganzhi', label: '干支起盘' },
	{ value: 'day', label: '日干起盘' },
	{ value: 'hour', label: '时干起盘' },
	{ value: 'minute', label: '分干起盘' },
	{ value: 'tang', label: '唐代正法揲筮' },
];

const POSITION_ORDER = ['兆', '木鄉', '火鄉', '土鄉', '金鄉', '水鄉'];
const DEFAULT_SPLITS = [18, 8, 5, 2, 1, 1];

function appendUnique(list, value){
	const text = value ? `${value}`.replace(/\/$/, '') : '';
	if(text && /^https?:\/\/.+/i.test(text) && list.indexOf(text) < 0){
		list.push(text);
	}
}

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
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	};
}

async function postWuZhaoRaw(path, payload){
	const roots = [];
	const endpoints = [];
	if(typeof window !== 'undefined'){
		try{
			const params = new URLSearchParams(window.location.search || '');
			['wuzhaoSrv', 'kinwuzhaoSrv', 'kinastroSrv', 'kentangSrv', 'kinSrv'].forEach((key)=>{
				appendUnique(roots, params.get(key));
			});
		}catch(e){}
	}
	appendUnique(roots, ServerRoot);
	if(/:9999(?:\/)?$/i.test(ServerRoot)){
		appendUnique(roots, ServerRoot.replace(/:9999(?:\/)?$/i, ':8892'));
	}
	appendUnique(roots, 'http://127.0.0.1:8892');
	appendUnique(endpoints, buildKentangEndpoint('wuzhao', path));
	roots.forEach((root)=>appendUnique(endpoints, `${root}/wuzhao/${path}`));
	appendUnique(endpoints, `${ServerRoot}/wuzhao/${path}`);

	let lastError = null;
	for(let i=0; i<endpoints.length; i++){
		try{
			const rawResponse = await cachedKentangFetch(endpoints[i], {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
				},
				body: JSON.stringify(payload),
			}, { retries: 0 });
			const rawText = await rawResponse.text();
			const rsp = rawText ? JSON.parse(rawText) : null;
			if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
				throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wuzhao.local.fetch.failed');
			}
			return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
		}catch(e){
			lastError = e;
		}
	}
	try{
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/wuzhao/${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		const rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wuzhao.fetch.failed');
		}
		return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
	}catch(e){
		lastError = e || lastError;
	}
	throw lastError || new Error('wuzhao.fetch.failed');
}

// horosa_kentang_result_cache_v1 —— 五兆 /wuzhao/pan 直连缓存,**带确定性判据**。
// 🔴 五兆并非整体确定性:后端 webwuzhaosrv._calculate 里
//    day/hour/minute/tang 四种起盘在【未给手动折竹数】时走 kinwuzhao.WuzhaoCalculator.random_split
//    (random.randint,每次不同)——对这条路缓存会把随机揲筮结果钉死 = 功能降级,严禁。
//    只有 ① mode==='ganzhi'(干支数值法 gangzhi_paipan,纯计算)
//        ② manual===true(手动折竹:manualSplits 全量入 payload,后端不再摇随机)
//    这两种才是「同 payload 必同盘」。故下方 wuzhaoCacheable 为准入闸,不满足即直连(与今日逐字一致)。
// v3.5.1 收敛:结果级缓存退役 —— Raw 内部已走上游 utils/kentangCache;上述「自动揲筮
// 不可缓存」的守卫下沉到 kentangCache.payloadCacheable(horosa_wuzhao_random_guard_v1,
// Windows-ahead:上游矩阵把 wuzhao 误标 deterministic,fetch 级缓存会把无 seed 的
// random.randint 揲筮钉死 —— 在唯一缓存层拦,比在每个调用点拦更不可能漏)。
function postWuZhao(path, payload){
	return postWuZhaoRaw(path, payload);
}

function fmtValue(value){
	return formatHumanValue(value);
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无五兆数据';
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

function modeUsesManualSplits(mode){
	return ['day', 'hour', 'minute', 'tang'].indexOf(mode) >= 0;
}

// AI 起课时间挂载入口:默认 mode='ganzhi'(干支起例,纯时间确定)+ 不报数;opts 允许用户在挂载设置里覆盖 mode/number/manual/manualSplits。
export async function buildWuZhaoSnapshotForFields(fields, opts){
	const dt = parseFieldsDateTime(fields);
	if(!dt){ return ''; }
	try{
		const o = opts || {};
		const mode = (o.mode === 'day' || o.mode === 'hour' || o.mode === 'minute' || o.mode === 'tang' || o.mode === 'ganzhi') ? o.mode : 'ganzhi';
		const number = o.number !== undefined && o.number !== null ? Number(o.number) || 0 : 0;
		const manual = !!o.manual;
		const manualSplits = Array.isArray(o.manualSplits) && o.manualSplits.length === 6 ? o.manualSplits : DEFAULT_SPLITS;
		const pan = await postWuZhao('pan', { ...dt, mode, number, manual, manualSplits });
		return buildSnapshotText(pan);
	}catch(e){ return ''; }
}

class WuZhaoMain extends Component{
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
			mode: 'ganzhi',
			number: 0,
			manual: false,
			manualSplits: DEFAULT_SPLITS,
		};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.changeMode = this.changeMode.bind(this);
		this.changeManual = this.changeManual.bind(this);
		this.changeSplit = this.changeSplit.bind(this);
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
		if(this.skipNextOptionFetch){
			this.skipNextOptionFetch = false;
			return;
		}
		if(prevState.mode !== this.state.mode
			// [X1·P1-9] 报数只在干支起盘参算:其余模式改之不得触发重取(自动揲筮无 seed,重取=随机重掷假「生效」)。
			|| (prevState.number !== this.state.number && this.state.mode === 'ganzhi')
			|| prevState.manual !== this.state.manual
			|| prevState.manualSplits !== this.state.manualSplits){
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

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'wuzhao'){
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
			saveModuleAISnapshot('wuzhao', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('wuzhao');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			// 🔴 [X1] 去重命中曾返 false → componentDidUpdate 落 else 分支 fetchPan,
			// 把已还原的冻结盘网络重取覆盖:manual=false 的自动揲筮无 seed,重取=重掷,还原盘≠保存盘。
			// 已持有冻结盘 → 返 true 拦下重取;盘确实丢了才放行向下重还原。
			if(this.state.pan){ return true; }
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this.skipNextOptionFetch = true;
		this.setState({
			loading: false,
			pan: payload.pan || null,
			mode: options.mode || this.state.mode,
			number: options.number !== undefined ? options.number : this.state.number,
			manual: options.manual !== undefined ? !!options.manual : this.state.manual,
			manualSplits: options.manualSplits instanceof Array ? options.manualSplits : this.state.manualSplits,
		}, ()=>{
			const pan = this.state.pan;
			saveModuleAISnapshotLazy('wuzhao', ()=>buildSnapshotText(pan));
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
			// [R3-A2] 步进方向提示:驱动 astro model settle 后 /chart ±步预取(消费后即剥离)
			...(value.step ? { __stepHint: value.step } : {}),
		});
		this.prefetchDraftPan();
	}

	// [R3-A4] 草稿时间一变即预取该时刻 pan:字段源与 clickPlot 完全同源
	// (getTimeFieldsFromSelector),payload 走 buildPanPayload 单源 → 键逐字节等;
	// 用户点「起盘」即缓存命中 ≈ 瞬间。失败静默;开关关=零行为。
	prefetchDraftPan(){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(this.prefetchDraftTimer){ clearTimeout(this.prefetchDraftTimer); }
			this.prefetchDraftTimer = setTimeout(()=>{
				this.prefetchDraftTimer = null;
				if(this.unmounted){ return; }
				try{
					const flds = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
					const payload = this.buildPanPayload(flds);
					if(!payload){ return; }
					postWuZhao('pan', payload).catch(()=>null);
				}catch(e){ /* 预取失败无害 */ }
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
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

	// [R3-A4] pan 请求体单源:fetchPan 与草稿预取共用同一构造 → 缓存键逐字节等(预取生效前提)。
	buildPanPayload(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){ return null; }
		return {
			...dt,
			mode: this.state.mode,
			number: this.state.number,
			manual: this.state.manual,
			manualSplits: this.state.manualSplits,
		};
	}

	async fetchPan(fields){
		const payload = this.buildPanPayload(fields);
		if(!payload){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postWuZhao('pan', payload);
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:pan 落定 = 中栏与右栏(皆由 pan 派生)画完的那一次 setState。
				markPanelReady('cnyibu');
				saveModuleAISnapshotLazy('wuzhao', ()=>buildSnapshotText(pan));
			});
		}catch(e){
			console.warn('kinwuzhao backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'wuzhao',
			label: '五兆',
			payload: {
				options: {
					mode: this.state.mode,
					number: this.state.number,
					manual: this.state.manual,
					manualSplits: this.state.manualSplits,
				},
				pan: this.state.pan,
				snapshot: buildSnapshotText(this.state.pan),
			},
		});
	}

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	}

	changeMode(value){
		const nextMode = value || 'ganzhi';
		this.setState({ mode: nextMode, manual: modeUsesManualSplits(nextMode) ? this.state.manual : false });
	}

	changeManual(value){
		if(!modeUsesManualSplits(this.state.mode)){
			this.setState({ manual: false });
			return;
		}
		this.setState({ manual: value === 'manual' });
	}

	changeSplit(index, value){
		const next = [...this.state.manualSplits];
		next[index] = value || 1;
		this.setState({ manualSplits: next });
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		const canUseManualSplits = modeUsesManualSplits(this.state.mode);
		const manualModeValue = canUseManualSplits ? (this.state.manual ? 'manual' : 'auto') : 'computed';
		return (
			<div className="horosa-huangji-input-stack horosa-wuzhao-input-stack">
				<div>
					<div className="horosa-side-panel-title">五兆设置</div>
					<div className="horosa-side-panel-subtitle">时间、起盘法与揲筮选项</div>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				<XQSideSection iconName="other" title="五兆选项" storageKey="wuzhao.opts" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>起盘方式</span>
							<Select value={this.state.mode} onChange={this.changeMode}>
								{MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>报数</span>
							{/* [X1·P1-9] 报数仅「干支起盘」参算(vendor five_zhao_paipan 不吃 num);其余模式禁用免「改了触发随机重掷」假生效。
							    max 收 9:后端 >9 即 mod9,曾致左栏显 45 而概览/AI 显 0 同屏矛盾(0-9 已覆盖全等价域)。 */}
							<InputNumber value={this.state.number} min={0} max={9} disabled={this.state.mode !== 'ganzhi'} onChange={(v)=>this.setState({ number: v || 0 })} />
							{this.state.mode !== 'ganzhi' ? <em className="horosa-guice-hint">本起盘方式不吃报数(仅干支起盘参算)</em> : null}
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>揲筮模式</span>
							<Select value={manualModeValue} disabled={!canUseManualSplits} onChange={this.changeManual}>
								{!canUseManualSplits ? <Option value="computed">干支计算</Option> : null}
								<Option value="auto">自动随机</Option>
								<Option value="manual">手动复现</Option>
							</Select>
						</label>
					</div>
				</XQSideSection>
				<XQSideSection iconName="quickComposite" title="手动六数" storageKey="wuzhao.manual" className="horosa-huangji-input-section">
					<div className="horosa-wuzhao-split-grid">
						{POSITION_ORDER.map((item, idx)=>(
							<label className="horosa-huangji-select-field" key={item}>
								<span>{item.replace('鄉', '乡')}</span>
								<InputNumber
									value={this.state.manualSplits[idx]}
									min={1}
									max={35}
									disabled={!canUseManualSplits || !this.state.manual}
									onChange={(v)=>this.changeSplit(idx, v)}
								/>
							</label>
						))}
					</div>
					<div className="horosa-wuzhao-split-note">
						{canUseManualSplits ? '手动复现只在选择“手动复现”后参与日干、时干、分干与唐代正法计算。' : '干支起盘使用年月日时分干支与报数计算，不调用手动六数。'}
					</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
				</div>
			</div>
		);
	}

	renderPositionCard(item){
		const flags = item.flags || [];
		return (
			<div className="horosa-wuzhao-position-card" key={item.key}>
				<div className="horosa-wuzhao-position-head">
					<strong>{item.label}</strong>
					<span>{item.palace || '—'}宫</span>
				</div>
				<div className="horosa-wuzhao-number">{fmtValue(item.number)}</div>
				<div className="horosa-wuzhao-position-main">
					<span>{fmtValue(item.element)}</span>
					<span>{fmtValue(item.relation)}</span>
					<span>{fmtValue(item.beast)}</span>
				</div>
				<div className="horosa-wuzhao-position-foot">
					<span>{item.prosperity ? `旺相 ${item.prosperity}` : '旺相 —'}</span>
					<em>{flags.length ? flags.join(' · ') : '无特殊标记'}</em>
				</div>
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan){
			return <div className="horosa-huangji-empty">暂无五兆数据</div>;
		}
		const gz = pan.ganzhi || {};
		const gzItems = [
			{ label: '年柱', value: gz.year },
			{ label: '月柱', value: gz.month },
			{ label: '日柱', value: gz.day },
			{ label: '时柱', value: gz.hour },
			{ label: '分柱', value: gz.minute },
		];
		const positions = pan.positions || [];
		return (
			<div className="horosa-wuzhao-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2 className="horosa-wuzhao-title">五兆</h2>
					</div>
					<div className="horosa-huangji-board-time">{`${fmtValue(pan.dateStr)} ${fmtValue(pan.timeStr)}`}</div>
				</div>
				<div className="horosa-huangji-meta-grid horosa-wuzhao-meta-grid">
					<div><span>起盘方式</span><strong>{pan.modeLabel || '—'}</strong></div>
					<div><span>节气</span><strong>{pan.solarTerm || '—'}</strong></div>
					<div><span>农历</span><strong>{pan.lunarDate && pan.lunarDate.text ? pan.lunarDate.text : '—'}</strong></div>
					<div><span>上/下柱</span><strong>{fmtValue(pan.upperGanzhi)} / {fmtValue(pan.lowerGanzhi)}</strong></div>
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
				<div className="horosa-wuzhao-board-grid">
					{positions.map((item)=>this.renderPositionCard(item))}
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

	renderClassics(){
		const classics = this.state.pan && this.state.pan.classics ? this.state.pan.classics : null;
		if(!classics || !classics.sections || !classics.sections.length){
			return <div className="horosa-huangji-empty">暂无五兆古籍目录</div>;
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
		const flagRows = [];
		(pan && pan.positions ? pan.positions : []).forEach((item)=>{
			if(item.flags && item.flags.length){
				flagRows.push({ label: item.label, value: item.flags.join('、') });
			}
		});
		const activeKey = ['overview', 'positions', 'flags'].indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
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
				<TabPane tab="六位" key="positions">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'positions'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(2, 8) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="标记" key="flags">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'flags'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows([{ title: '孤虚关籥将军', rows: flagRows.length ? flagRows : [{ label: '标记', value: '无' }] }])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.pan,
			primary: { key: 'plot', label: '起盘', onClick: ()=>this.clickPlot() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="wuzhao"
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
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-wuzhao-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
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
										<div className="horosa-side-panel-title">五兆信息</div>
										<div className="horosa-side-panel-subtitle">六位与标记</div>
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

export default WuZhaoMain;
