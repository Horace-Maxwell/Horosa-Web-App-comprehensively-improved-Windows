import QuickDockBar from '../common/QuickDockBar';
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
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { formatHumanValue } from '../../utils/humanReadableFields';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { parseDateParts } from '../../utils/dateStrSafe';
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
import { cachedKentangCall, kentangCacheKey } from '../../services/_kentangResultCache';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const { TabPane } = Tabs;
const { Option } = Select;

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

async function postShenYiShuRaw(path, payload){
	let rsp = null;
	try{
		const rawResponse = await fetch(buildKentangEndpoint('shenyishu', path), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		});
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'shenyishu.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await fetch(`${ServerRoot}/shenyishu/${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		});
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'shenyishu.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

// horosa_kentang_result_cache_v1 —— 神易数 /shenyishu/pan 直连缓存(LRU 48)。
// 确定性论证:payload = parseFieldsDateTime(fields)(格式化字串+整数)+ hourSource/manualHour/
// seasonSource/manualSeason 四个显式选项;后端 webshenyishusrv.py 全文无 random / 无 datetime.now()
// (已 grep 核对)→ 同 payload 必同盘。切 tab/切页回来即命中;关闸逐字回到直连。
function postShenYiShu(path, payload){
	const bodyKey = kentangCacheKey(payload);
	if(!techniqueResultCacheEnabled() || !bodyKey){
		return postShenYiShuRaw(path, payload);
	}
	return cachedKentangCall(
		'shenyishu/pan',
		payload,
		()=>postShenYiShuRaw(path, payload),
		{ key: `${path}|${bodyKey}`, max: 48 }
	);
}

function fmtValue(value){
	return formatHumanValue(value);
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无神易数数据';
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

// AI 起课时间挂载入口:hourSource/seasonSource 默认 'auto';opts 允许挂载设置里覆盖。
export async function buildShenYiShuSnapshotForFields(fields, opts){
	const dt = parseFieldsDateTime(fields);
	if(!dt){ return ''; }
	try{
		const o = opts || {};
		const hourSource = o.hourSource === 'manual' ? 'manual' : 'auto';
		const manualHour = o.manualHour !== undefined && o.manualHour !== null ? Number(o.manualHour) || 0 : 0;
		const seasonSource = o.seasonSource === 'manual' ? 'manual' : 'auto';
		const manualSeason = ['春', '夏', '秋', '冬'].indexOf(o.manualSeason) >= 0 ? o.manualSeason : '夏';
		const pan = await postShenYiShu('pan', { ...dt, hourSource, manualHour, seasonSource, manualSeason });
		return buildSnapshotText(pan);
	}catch(e){ return ''; }
}

class ShenYiShuMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			loading: false,
			pan: null,
			rightPanelTab: 'overview',
			hourSource: 'auto',
			manualHour: 0,
			seasonSource: 'auto',
			manualSeason: '夏',
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

	// [PERF-R9 Ship 6] 重 wrapper sCU（照 AstroChartMain / BaZi / GuaZhanMain 既有范式）——
	// 全 props 机械浅比（函数型视为恒等，详 wrapperPropsEqual；开关 horosa.perf.chartSCU 关=恒重渲旧行为），
	// state 换引用照常重渲（setState 恒换引用，故本组件自身任何状态变化一律不受影响）。
	// 收益：容器（CnYiBuMain / AuxChartMain）的 dock 每动作补三拍 forceUpdate —— forceUpdate 只跳过
	// 自身 sCU，子组件的照跑 —— 此后这三拍不再重建本重组件的整棵 JSX。
	// 🔴 正确性：只在【全部 props 逐键相等】时跳过；键数不等 / 任一非函数键换引用即返 true。
	//    本组件不依赖【父重渲】来拉模块级可变态：农历远程缓存走 subscribeRemoteNongli → this.forceUpdate()，
	//    forceUpdate 本就绕过自身 sCU，故不会因本改动而漏刷。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.unmounted = false;
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(this.restoreFromCurrentCase(true)){
			return;
		}
		const dt = parseFieldsDateTime(this.props.fields);
		this.setState({ manualHour: dt ? dt.hour : 0 }, ()=>{
			this.fetchPan(this.props.fields);
		});
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.fields !== this.props.fields && this.props.fields){
			const dt = parseFieldsDateTime(this.props.fields);
			const nextState = {};
			if(dt && this.state.hourSource === 'auto' && this.state.manualHour !== dt.hour){
				nextState.manualHour = dt.hour;
			}
			if(Object.keys(nextState).length){
				this.setState(nextState, ()=>{
					if(!this.restoreFromCurrentCase()){
						this.fetchPan(this.props.fields);
					}
				});
			}else{
				if(!this.restoreFromCurrentCase()){
					this.fetchPan(this.props.fields);
				}
			}
		}
		if(this.skipNextOptionFetch){
			this.skipNextOptionFetch = false;
			return;
		}
		if(prevState.hourSource !== this.state.hourSource
			|| prevState.manualHour !== this.state.manualHour
			|| prevState.seasonSource !== this.state.seasonSource
			|| prevState.manualSeason !== this.state.manualSeason){
			this.fetchPan(this.props.fields);
		}
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'shenyishu'){
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
			saveModuleAISnapshot('shenyishu', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('shenyishu');
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
		this.skipNextOptionFetch = true;
		this.setState({
			loading: false,
			pan: payload.pan || null,
			hourSource: options.hourSource || this.state.hourSource,
			manualHour: options.manualHour !== undefined ? options.manualHour : this.state.manualHour,
			seasonSource: options.seasonSource || this.state.seasonSource,
			manualSeason: options.manualSeason || this.state.manualSeason,
		}, ()=>{
			const pan = this.state.pan;
			saveModuleAISnapshotLazy('shenyishu', ()=>buildSnapshotText(pan));
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

	async fetchPan(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postShenYiShu('pan', {
				...dt,
				hourSource: this.state.hourSource,
				manualHour: this.state.manualHour,
				seasonSource: this.state.seasonSource,
				manualSeason: this.state.manualSeason,
			});
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:pan 落定 = 中栏与右栏(皆由 pan 派生)画完的那一次 setState。
				markPanelReady('cnyibu');
				saveModuleAISnapshotLazy('shenyishu', ()=>buildSnapshotText(pan));
			});
		}catch(e){
			console.warn('shenyishu backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'shenyishu',
			label: '神易数',
			payload: {
				options: {
					hourSource: this.state.hourSource,
					manualHour: this.state.manualHour,
					seasonSource: this.state.seasonSource,
					manualSeason: this.state.manualSeason,
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
			<div className="horosa-huangji-input-stack horosa-shenyishu-input-stack">
				<div>
					<div className="horosa-side-panel-title">神易数设置</div>
					<div className="horosa-side-panel-subtitle">时间与兵占选项</div>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				<XQSideSection iconName="quickTransit" title="兵占选项" storageKey="shenyishu.opts" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>入式小时</span>
							<Select value={this.state.hourSource} onChange={(value)=>this.setState({ hourSource: value })}>
								<Option value="auto">自动取时间小时</Option>
								<Option value="manual">手动指定小时</Option>
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>手动小时</span>
							<InputNumber value={this.state.manualHour} min={0} max={23} disabled={this.state.hourSource !== 'manual'} onChange={(v)=>this.setState({ manualHour: v || 0 })} />
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>五行季令</span>
							<Select value={this.state.seasonSource} onChange={(value)=>this.setState({ seasonSource: value })}>
								<Option value="auto">自动按月份取季令</Option>
								<Option value="manual">手动指定季令</Option>
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>手动季令</span>
							<Select value={this.state.manualSeason} disabled={this.state.seasonSource !== 'manual'} onChange={(value)=>this.setState({ manualSeason: value })}>
								<Option value="春">春</Option>
								<Option value="夏">夏</Option>
								<Option value="秋">秋</Option>
								<Option value="冬">冬</Option>
							</Select>
						</label>
					</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
				</div>
			</div>
		);
	}

	renderPillars(){
		const ss = this.state.pan && this.state.pan.shenyishu ? this.state.pan.shenyishu : {};
		return (
			<div className="horosa-shenyishu-pillar-grid">
				{(ss.pillars || []).map((item)=>(
					<div className="horosa-shenyishu-pillar-card" key={item.key}>
						<span>{item.label}</span>
						<strong>{fmtValue(item.ganzhi)}</strong>
						<em>{fmtValue(item.wuxing)}</em>
					</div>
				))}
			</div>
		);
	}

	renderRoles(){
		const ss = this.state.pan && this.state.pan.shenyishu ? this.state.pan.shenyishu : {};
		return (
			<div className="horosa-shenyishu-role-grid">
				{(ss.roles || []).map((item)=>(
					<div className="horosa-shenyishu-role-card" key={item.key}>
						<span>{item.key} · {item.role}</span>
						<strong>{fmtValue(item.number)} → {fmtValue(item.gua)}</strong>
						<em>{fmtValue(item.yinyang)}数</em>
					</div>
				))}
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan || !pan.shenyishu){
			return <div className="horosa-huangji-empty">暂无神易数数据</div>;
		}
		const ss = pan.shenyishu || {};
		const jixiong = ss.jixiong || {};
		const zhuke = ss.zhuke || {};
		return (
			<div className="horosa-taixuan-board horosa-shenyishu-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2 className="horosa-taixuan-title">神易数</h2>
					</div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				<div className="horosa-huangji-meta-grid horosa-taixuan-meta-grid horosa-shenyishu-meta-grid">
					<div><span>入式小时</span><strong>{fmtValue(pan.hour)}时</strong></div>
					<div><span>五行季令</span><strong>{fmtValue(pan.season)}</strong></div>
					<div><span>总数</span><strong>{fmtValue(ss.total)}</strong></div>
					<div><span>连山卦</span><strong>{fmtValue(ss.lianshan)}</strong></div>
					<div><span>归藏卦</span><strong>{fmtValue(ss.guicang)}</strong></div>
					<div><span>八卦</span><strong>{fmtValue(ss.bagua)}</strong></div>
					<div><span>吉凶</span><strong>{fmtValue(jixiong.level)} · {fmtValue(jixiong.score)}</strong></div>
				</div>
				{this.renderPillars()}
				<div className="horosa-taixuan-main-grid horosa-shenyishu-main-grid">
					<div className="horosa-taixuan-symbol-card horosa-shenyishu-symbol-card">
						<div className="horosa-taixuan-symbol-head">
							<span>兵占三位</span>
							<strong>{fmtValue(ss.total)}</strong>
						</div>
						{this.renderRoles()}
					</div>
					<div className="horosa-taixuan-text-card horosa-shenyishu-text-card">
						<span>主客判断</span>
						<strong>{fmtValue(zhuke.結論)}</strong>
						<div className="horosa-shenyishu-reason-list">
							{(zhuke.分析 || []).map((item, idx)=>(
								<p key={`${item}_${idx}`}>{fmtValue(item)}</p>
							))}
						</div>
						<span>吉凶结论</span>
						<strong>{fmtValue(jixiong.detail)}</strong>
						<div className="horosa-shenyishu-reason-list">
							{(jixiong.reasons || []).map((item, idx)=>(
								<p key={`${item}_${idx}`}>{fmtValue(item)}</p>
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

	renderShensha(){
		const ss = this.state.pan && this.state.pan.shenyishu ? this.state.pan.shenyishu : {};
		const list = ss.shensha || [];
		if(!list.length){
			return <div className="horosa-huangji-empty">暂无神煞</div>;
		}
		return (
			<div className="horosa-shenyishu-shensha-grid">
				{list.map((item)=>(
					<div className="horosa-shenyishu-shensha-card" key={item.label}>
						<span>{item.label}</span>
						<strong>{fmtValue(item.value)}</strong>
					</div>
				))}
			</div>
		);
	}

	renderWuxing(){
		const ss = this.state.pan && this.state.pan.shenyishu ? this.state.pan.shenyishu : {};
		const rules = ss.wuxingRules || {};
		return (
			<div className="horosa-huangji-section-list">
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">五行生克</div>
					<div className="horosa-huangji-info-row"><span>相生</span><strong>{fmtValue(rules.sheng)}</strong></div>
					<div className="horosa-huangji-info-row"><span>相克</span><strong>{fmtValue(rules.ke)}</strong></div>
					<div className="horosa-huangji-info-row"><span>季令</span><strong>{fmtValue(rules.season)}（{rules.seasonSource === 'manual' ? '手动' : '自动'}）</strong></div>
				</div>
				<div className="horosa-shenyishu-shensha-grid">
					{(rules.seasonStrength || []).map((item)=>(
						<div className="horosa-shenyishu-shensha-card" key={item.label}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.value)}</strong>
						</div>
					))}
				</div>
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
		const sections = pan ? (pan.sections || []) : [];
		const activeKey = ['overview', 'pillars', 'wuxing', 'military', 'shensha'].indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs">
				<TabPane tab="概览" key="overview">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(sections.slice(0, 6))}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="干支" key="pillars">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'pillars'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(sections.slice(1, 3))}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="五行" key="wuxing">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'wuxing'}>{() => this.renderWuxing()}</FreezeSubTab>
				</TabPane>
				<TabPane tab="兵占" key="military">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'military'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(sections.slice(4, 6))}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞" key="shensha">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'shensha'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderShensha()}{this.renderRows(sections.slice(7, 8))}</div>
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
				page="shenyishu"
				className="horosa-huangji-quick-dock horosa-shenyishu-quick-dock"
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
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-taixuan-redesign horosa-shenyishu-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
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
										<div className="horosa-side-panel-title">神易数信息</div>
										<div className="horosa-side-panel-subtitle">干支、五行与兵占</div>
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

export default ShenYiShuMain;
