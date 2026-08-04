import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Popover, Modal } from 'antd';
import AstroChart from '../astro/AstroChart';
import PlusMinusTime from '../astro/PlusMinusTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameRawPatch } from '../../utils/geoName';
import { getHousesOption } from '../comp/CompHelper';
import { XQButton, XQSegmented, XQSelect, XQTabs, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import XQIcon from '../xq-icons';
import * as AstroConst from '../../constants/AstroConst';
import { fetchChart } from '../../services/astro';
import { buildChartParams } from '../../divination/engine/chartRequest';
import { submitStepPrefetch } from '../../utils/stepPrefetch';
import { stepSelectPrefetchEnabled } from '../../utils/perfFlags';
import DateTime from '../comp/DateTime';
import { GLOSSARY } from '../../divination/data/glossary';
import { openDivinationCaseDrawer, getDivinationSavedCasePayload } from '../../utils/divinationCaseSave';
import { getClassicalChartGlobals, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';

// 「设置→星盘设置」全局古典参数 → 本盘热同步键集(缺省=全量;卜卦页收窄——
// 流派学理绑定的键(界系/双子界序/福点反转/宫制/星群)恒以流派为准,不被全局改动冲掉)。
const DEFAULT_GLOBAL_SYNC_KEYS = ['termsVariant', 'geminiBoundEmended', 'westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal',
	'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter', 'fixedStarOrb', 'fixedStarOrbMode', 'antisciaOrb'];

const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

// 步长步进(y/M/d/h/m 档;m 档=4分钟×n,与 DateTimeSelector 分钟档一致)。
// changeTime 的 settle 后预取与 handleStepSelect 的选步长预取共用此单源,防两处加法漂移。
function stepDt(dt, unit, dir){
	if(!dt || typeof dt.clone !== 'function'){ return null; }
	const nd = dt.clone();
	if(unit === 'y'){ nd.addYear(dir); }
	else if(unit === 'M'){ nd.addMonth(dir); }
	else if(unit === 'd'){ nd.addDate(dir); }
	else if(unit === 'h'){ nd.addHour(dir); }
	else if(unit === 'm'){ nd.addMinute(4 * dir); }
	else { return null; }
	return nd;
}

// 卜卦盘 / 择日盘 共用的自包含三栏页（左设置+调时 / 中圆盘 / 右判断）。
// 时间/地点/设置全部用本地 state，独立于「占星」主盘，不回灌父级 astro model。
class DivinationChartShell extends Component{
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

		// 以父级 fields 为种子，覆盖本技法默认（传统守护 + 整宫制 + 回归黄道）。
		// 只新建被覆盖/会变更的 wrapper，绝不修改父级共享对象。
		const seed = { ...(props.fields || {}) };
		const defs = props.defaults || {};
		seed.tradition = { value: defs.tradition !== undefined ? defs.tradition : 1, name: ['tradition'] };
		seed.zodiacal = { value: defs.zodiacal !== undefined ? defs.zodiacal : 0, name: ['zodiacal'] };
		seed.siderealAyanamsa = { value: defs.siderealAyanamsa !== undefined ? defs.siderealAyanamsa : '', name: ['siderealAyanamsa'] };
		if(defs.hsys !== undefined){
			seed.hsys = { value: defs.hsys, name: ['hsys'] };
		}
		// 其余 defaults 键通用播种(卜卦档随带 termsVariant/lotReversal 等后端键 —— 使首帧排盘
		// 即与所选流派学理一致,不再依赖用户切档触发 patch;election 等未传的技法零行为)。
		Object.keys(defs).forEach((k)=>{
			if(k === 'tradition' || k === 'zodiacal' || k === 'siderealAyanamsa' || k === 'hsys'){ return; }
			if(defs[k] === undefined || defs[k] === null){ return; }
			seed[k] = { value: defs[k], name: [k] };
		});

		// 卜卦/择日默认起盘时刻 = 此刻（保留父级地点/时区）。父级 date.value 常为当日 0 点、
		// time.value 才含真实时分，两者分离；这里统一用一个完整的「此刻」DateTime，避免错位。
		const now = new DateTime();
		const pdate = props.fields && props.fields.date && props.fields.date.value;
		const pzone = (pdate && pdate.zone) || (props.fields && props.fields.zone && props.fields.zone.value);
		if(pzone){ now.setZone(pzone); }
		seed.date = { value: now, name: ['date'] };
		seed.time = { value: now.clone(), name: ['time'] };
		seed.ad = { value: now.ad, name: ['ad'] };
		seed.zone = { value: now.zone, name: ['zone'] };

		this.state = {
			fields: seed,
			chart: null,
			busy: false,
			err: null,
			chartStyle: AstroConst.normalizeChartStyle ? AstroConst.normalizeChartStyle(undefined) : 'current',
			extra: props.initialExtra || {},
			glossaryOpen: false,
		};

		this._reqSeq = 0;
		this._appliedCaseVersion = null;

		this.refetch = this.refetch.bind(this);
		this.saveCase = this.saveCase.bind(this);
		this.changeTime = this.changeTime.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeField = this.changeField.bind(this);
		this.changeChartStyle = this.changeChartStyle.bind(this);
		this.castNow = this.castNow.bind(this);
		this.setExtra = this.setExtra.bind(this);
		this.setTimeDt = this.setTimeDt.bind(this);
		this.patchFields = this.patchFields.bind(this);
		this.handleStepSelect = this.handleStepSelect.bind(this);
		this._lastStepSel = null;   // 选步长 5s 去重态(同 unit 反复点不重复排队)
	}

	setTimeDt(dt){
		if(!dt){ return; }
		this.changeTime({ time: dt, ad: dt.ad });
	}

	// 「存为事件盘」：把当前时间/地点/设置/类别写进 App 事件盘库（与占星盘同一管道）。
	saveCase(){
		if(!this.props.dispatch || !this.props.saveModule){
			return;
		}
		// astro 类事盘(如世俗盘)可传 buildAiSnapshot(chart, fields) → 存档即带格式化 AI 快照,挂载更全面。
		let aiSnapshot;
		if(typeof this.props.buildAiSnapshot === 'function' && this.state.chart){
			try{ aiSnapshot = this.props.buildAiSnapshot(this.state.chart, this.state.fields, this.state.extra); }catch(e){ aiSnapshot = undefined; }
		}
		openDivinationCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.state.fields,
			module: this.props.saveModule,
			extra: this.state.extra,
			aiSnapshot,
		});
	}

	componentDidMount(){
		this._mounted = true;
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleClassicalGlobalsChanged = this.handleClassicalGlobalsChanged.bind(this);
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			window.addEventListener(CLASSICAL_GLOBALS_EVENT, this.handleClassicalGlobalsChanged);
		}
		if(!this.applyRestoreIfAny()){
			this.refetch();
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			if(this.handleSnapshotRefreshRequest){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
			if(this.handleClassicalGlobalsChanged){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this.handleClassicalGlobalsChanged); }
		}
	}

	// 「设置→星盘设置」改古典参数 → 本盘热同步:仅收编 globalSyncKeys 白名单键
	// (卜卦页传收窄集,流派绑定键不被冲);与当前值相同则不动(零无谓重排)。
	handleClassicalGlobalsChanged(){
		const keys = Array.isArray(this.props.globalSyncKeys) ? this.props.globalSyncKeys : DEFAULT_GLOBAL_SYNC_KEYS;
		const g = getClassicalChartGlobals();
		const patch = {};
		keys.forEach((k)=>{
			if(g[k] === undefined){ return; }
			const cur = this.state.fields[k] && this.state.fields[k].value !== undefined ? this.state.fields[k].value : undefined;
			if(cur !== g[k]){ patch[k] = g[k]; }
		});
		if(Object.keys(patch).length){ this.patchFields(patch); }
	}

	// AI导出:在本模块 tab(如世俗盘)导出时响应刷新事件,用 buildAiSnapshot 把格式化快照写回 detail.snapshotText。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || !this.props.saveModule || evt.detail.module !== this.props.saveModule){ return; }
		if(typeof this.props.buildAiSnapshot === 'function' && this.state.chart){
			try{ evt.detail.snapshotText = this.props.buildAiSnapshot(this.state.chart, this.state.fields, this.state.extra) || ''; }catch(e){ /* keep empty */ }
		}
	}

	componentDidUpdate(){
		// (PERF-R12 W3b-Z5 评估后不做:同一挂载期第二次「应用案例」正是靠这里轮询新 caseVersion
		// 被拾起 —— 任何「已应用即跳过」式守卫都会吞掉它 = 功能降级;每 update 一次 localStorage
		// 读是它换来的正确性成本,保留。)
		this.applyRestoreIfAny();
	}

	// 从事件盘列表「应用」一条卜卦/择日案例后，把保存的时间/地点/设置/类别还原到本盘。
	// 用 caseVersion 防重复灌入（之后手动调时间不会被反复覆盖）。
	applyRestoreIfAny(){
		const mod = this.props.saveModule;
		if(!mod){
			return false;
		}
		let c = null;
		try{ c = getDivinationSavedCasePayload(mod); }catch(e){ c = null; }
		if(!c || !c.caseVersion || c.caseVersion === this._appliedCaseVersion){
			return false;
		}
		this._appliedCaseVersion = c.caseVersion;
		const patch = {};
		// 时间：保存为 'YYYY-MM-DD HH:mm:ss' 字符串，按 user/applyCase 同法解析回 DateTime。
		if(c.divTime){
			const dt = new DateTime();
			const zone = c.zone || (this.state.fields.zone && this.state.fields.zone.value);
			if(zone){ dt.setZone(zone); }
			const parsed = dt.parse ? dt.parse(c.divTime, 'YYYY-MM-DD HH:mm:ss') : null;
			if(parsed){
				patch.date = parsed;
				patch.time = parsed.clone ? parsed.clone() : parsed;
				patch.ad = parsed.ad;
				if(zone){ patch.zone = zone; }
			}
		}
		if(c.lon !== undefined && c.lon !== null && c.lon !== ''){ patch.lon = c.lon; }
		if(c.lat !== undefined && c.lat !== null && c.lat !== ''){ patch.lat = c.lat; }
		if(c.gpsLon !== undefined && c.gpsLon !== null){ patch.gpsLon = c.gpsLon; }
		if(c.gpsLat !== undefined && c.gpsLat !== null){ patch.gpsLat = c.gpsLat; }
		if(c.pos){ patch.pos = c.pos; }
		// 技法设置（黄道/宫制/守护 + 古典占星参数）随案还原（present 才还原,老案例缺键零行为）。
		const settings = (c.payload && c.payload.settings) || null;
		if(settings){
			if(settings.zodiacal !== undefined){ patch.zodiacal = settings.zodiacal; }
			if(settings.hsys !== undefined){ patch.hsys = settings.hsys; }
			if(settings.tradition !== undefined){ patch.tradition = settings.tradition; }
			['termsVariant', 'geminiBoundEmended', 'westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal',
				'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter', 'fixedStarOrb', 'fixedStarOrbMode', 'antisciaOrb',
				'viaCombustaVariant'].forEach((k)=>{   // 与 divinationCaseSave 落档键列表成对(存/还原白名单必须 lockstep)
				if(settings[k] !== undefined && settings[k] !== null){ patch[k] = settings[k]; }
			});
		}
		// 问题类别(horary) / 用事类型(election) + 通用 extra(世俗盘 ingress* 等) 还原到 extra。
		const ex = (c.payload && c.payload.extra && typeof c.payload.extra === 'object') ? { ...c.payload.extra } : {};
		if(c.payload && c.payload.questionCategory){ ex.questionCategory = c.payload.questionCategory; }
		if(c.payload && c.payload.topicId){ ex.topicId = c.payload.topicId; }
		if(Object.keys(ex).length){ this.setExtra(ex); }
		if(Object.keys(patch).length){
			this.patchFields(patch);
			return true;
		}
		return false;
	}

	refetch(){
		const params = buildChartParams(this.state.fields);
		const seq = ++this._reqSeq;
		this.setState({ busy: true, err: null });
		fetchChart(params, { cache: true }).then((rsp)=>{
			if(seq !== this._reqSeq || !this._mounted){
				return; // 过期请求或已卸载，丢弃
			}
			const chart = (rsp && rsp.Result) ? rsp.Result : null;
			this.setState({ chart, busy: false, err: chart ? null : 'no-result' }, ()=>{ this._warmAdjacent(); });
		}).catch((e)=>{
			if(seq !== this._reqSeq || !this._mounted){
				return;
			}
			console.error('DivinationChartShell fetchChart failed', e);
			this.setState({ busy: false, err: 'fetch-failed' });
		});
	}

	// 替换 fields 中若干 wrapper（新对象），再重算。
	patchFields(patch, cb){
		this.setState((s)=>{
			const fields = { ...s.fields };
			Object.keys(patch).forEach((k)=>{
				fields[k] = { value: patch[k], name: [k] };
			});
			return { fields };
		}, ()=>{ this.refetch(); if(cb){ cb(); } });
	}

	changeTime(res){
		const dt = res.time;
		if(!dt){ return; }
		this.patchFields({
			date: dt,
			time: dt.clone ? dt.clone() : dt,
			// zone 兜底:部分态 DateTime 缺 zone 时保留原值,防 undefined 入 fields(请求缺 zone 键)
			zone: dt.zone || (this.state.fields.zone && this.state.fields.zone.value),
			ad: res.ad,
		});
		// 步进方向预取(主链 WP-P1 同款下放):连续步进第二击起在途/缓存命中,出盘近乎瞬间。
		// 预取失败无害(正式请求照常);fetchChart cache:true 经请求缓存在途共享。
		if(res.step && res.step.unit && res.step.dir && dt.clone){
			try{
				this._curUnit = res.step.unit;   // 记住实际步进档(settle 后 ±1 预热用)
				const nd = stepDt(dt, res.step.unit, res.step.dir);
				if(!nd){ return; }
				const nextFields = { ...this.state.fields };
				nextFields.date = { value: nd, name: ['date'] };
				nextFields.time = { value: nd.clone ? nd.clone() : nd, name: ['time'] };
				fetchChart(buildChartParams(nextFields), { cache: true, silent: true }).catch(()=>{ /* 预取静默 */ });
			}catch(e){ /* 预取失败无害 */ }
		}
	}

	// 以当前 fields 为基,按步长档构预取任务(键=真点同一 buildChartParams 路径,逐字节等;
	// chartMem/在途去重承接命中)。handleStepSelect(±1±2) 与 _warmAdjacent(±1) 共用此单源。
	_buildStepTasks(unit, plan){
		const dt0 = this.state.fields.date && this.state.fields.date.value;
		if(!dt0 || typeof dt0.clone !== 'function'){ return []; }
		const tasks = [];
		for(const pl of plan){
			let nd = dt0;
			for(let i = 0; i < pl.k && nd; i += 1){ nd = stepDt(nd, unit, pl.dir); }
			if(!nd){ continue; }
			const f2 = { ...this.state.fields };
			f2.date = { value: nd, name: ['date'] };
			f2.time = { value: nd.clone ? nd.clone() : nd, name: ['time'] };
			let params;
			try{ params = buildChartParams(f2); }catch(e){ continue; }   // 非法日期静默跳过
			tasks.push({
				name: `divchart${pl.dir > 0 ? '+' : '-'}${pl.k}${unit}`,
				path: '/chart',   // R4-B1 运行时白名单契约:无 path 的任务会被 submitStepPrefetch 丢弃
				// silent+零重试:预取失败静默、绝不退避风暴(主链纪律同款)
				run: ()=>fetchChart(params, { cache: true, silent: true, retry: { retries: 0 } }),
			});
		}
		return tasks;
	}

	// [R3-A1 下放] 选步长即预取(卜卦/择日/世俗三盘):本盘 fields 自持(与全局 store 无关),
	// 全局 handler(store fields+fieldsToParams)对本盘是【错键空烧】——必须走本地构参。
	// 经共享调度器(idle+latest-wins+预算4+150ms 间隔)排队;同 unit 5s 去重防抖;开关同主链。
	handleStepSelect(unit){
		try{
			if(!stepSelectPrefetchEnabled() || !unit){ return; }
			this._curUnit = unit;
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			const tasks = this._buildStepTasks(unit, [{ k: 1, dir: 1 }, { k: 1, dir: -1 }, { k: 2, dir: 1 }, { k: 2, dir: -1 }]);
			if(tasks.length){ submitStepPrefetch(tasks, { budget: 4 }); }
		}catch(e){ /* 预取失败无害 */ }
	}

	// settle 后 ±1 预热:主盘取回后把当前步长档(未选过=默认 m 四分钟)前后各一步备好 ——
	// 进页/换地点/改设置后的【第一下】步进也命中缓存(与主链 settle 后预取同范式;
	// submitStepPrefetch 内部已按 stepPrefetchEnabled 总闸门控,关=零行为)。
	_warmAdjacent(){
		try{
			const tasks = this._buildStepTasks(this._curUnit || 'm', [{ k: 1, dir: 1 }, { k: 1, dir: -1 }]);
			if(tasks.length){ submitStepPrefetch(tasks, { budget: 2 }); }
		}catch(e){ /* 预取失败无害 */ }
	}

	castNow(){
		// 「此刻起卦」：取当前时刻，保留当前时区。
		const now = new DateTime();
		const z = this.state.fields.zone && this.state.fields.zone.value;
		if(z){ now.setZone(z); }
		this.changeTime({ time: now, ad: now.ad });
	}

	changeGeo(rec){
		const patch = {
			lon: convertLonToStr(rec.lng),
			lat: convertLatToStr(rec.lat),
			gpsLon: rec.gpsLng,
			gpsLat: rec.gpsLat,
		};
		// 选地点 → 时区自动校正:重锚 date/time 到新偏移(setZone 只改时区标签、保留钟面时刻);
		// 手动改过时区则沿用 rec.zone。卜卦/择日按当地民用时起盘,选异地后时刻随之归入当地时区。
		const cur = this.state.fields.date && this.state.fields.date.value;
		const ds = (cur && cur.format) ? cur.format('YYYY-MM-DD') : null;
		const z = resolveGeoZone(rec, ds);
		if(z && cur && cur.setZone){
			const nd = cur.clone ? cur.clone() : cur;
			nd.setZone(z);
			patch.date = nd;
			patch.time = nd.clone ? nd.clone() : nd;
			patch.ad = nd.ad;
			patch.zone = z;
		}
		Object.assign(patch, geoNameRawPatch(rec));
		this.patchFields(patch);
	}

	changeField(key, val){
		this.patchFields({ [key]: val });
	}

	changeChartStyle(val){
		// XQSegmented 的 onChange 传的是事件 e（非裸值），须取 e.target.value，否则 chartStyle 变成事件对象、normalize 永远兜回 current → 样式无效。
		const chartStyle = val && val.target ? val.target.value : val;
		this.setState({ chartStyle });
	}

	setExtra(patch, cb){
		this.setState((s)=>({ extra: { ...s.extra, ...patch } }), cb);
	}

	renderInputPanel(){
		const fields = this.state.fields;
		const dt = fields.date ? fields.date.value : null;
		const timeText = dt && dt.format ? dt.format('YYYY-MM-DD HH:mm:ss') : '—';
		const lon = fields.lon ? fields.lon.value : '';
		const lat = fields.lat ? fields.lat.value : '';
		const pos = fields.pos && fields.pos.value ? fields.pos.value : '当地时间';
		const timeEditor = (
			<div className="horosa-time-popover">
				<PlusMinusTime value={dt} onChange={this.changeTime} onStepSelect={this.handleStepSelect} />
			</div>
		);
		return (
			<div className="horosa-astro-context-panel horosa-astro-input-panel">
				<div className="horosa-panel-head">
					<div>
						<div className="horosa-panel-kicker">{this.props.kicker || '起盘设置'}</div>
						<div className="horosa-panel-title">{this.props.title}</div>
					</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				{!this.props.hideTime ? (
					<div className="horosa-field-block">
						<div className="horosa-field-label">时间</div>
						<Popover content={timeEditor} trigger="click" placement="rightTop" overlayClassName="horosa-time-adjust-popover">
							<button type="button" className="horosa-unified-field">
								<XQIcon name="clock" />
								<span>{timeText}</span>
							</button>
						</Popover>
						<div className="horosa-time-adjust-inline">
							<PlusMinusTime value={dt} onChange={this.changeTime} onStepSelect={this.handleStepSelect} adjustOnly />
						</div>
						{this.props.castNowLabel ? (
							<XQButton size="small" iconName="refresh" onClick={this.castNow} style={{ marginTop: 6 }}>
								{this.props.castNowLabel}
							</XQButton>
						) : null}
					</div>
				) : null}

				<div className="horosa-field-block">
					<div className="horosa-field-label">地点</div>
					<GeoCoordModal
						onOk={this.changeGeo}
						lat={fields.gpsLat ? fields.gpsLat.value : null}
						lng={fields.gpsLon ? fields.gpsLon.value : null}
					>
						<button type="button" className="horosa-unified-field horosa-place-field">
							<XQIcon name="locastro" />
							<span>
								<strong>{pos}</strong>
								<small>{lon} · {lat}</small>
							</span>
							<XQIcon name="globe" />
						</button>
					</GeoCoordModal>
				</div>
				</XQSideSection>

				{typeof this.props.renderLeftExtra === 'function'
					? this.props.renderLeftExtra({ extra: this.state.extra, setExtra: this.setExtra, fields, chart: this.state.chart, setTime: this.setTimeDt, patchFields: this.patchFields })
					: null}

				<XQSideSection iconName={sideSectionIcon('school')} title="盘面参数" storageKey="divination.chartopts" className="horosa-side-input-section">
				<div className="horosa-field-grid">
					<div className="horosa-field-block">
						<div className="horosa-field-label">黄道</div>
						<XQSelect style={{ width: '100%' }} size="small"
							value={AstroConst.zodiacSelectValue(fields.zodiacal ? fields.zodiacal.value : 0, fields.siderealAyanamsa && fields.siderealAyanamsa.value)}
							dropdownMatchSelectWidth={false}
							onChange={(val)=>{ const p = AstroConst.parseZodiacSelectValue(val); this.patchFields({ zodiacal: p.zodiacal, siderealAyanamsa: p.siderealAyanamsa }); }}>
							{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
								<OptGroup label={grp.group} key={grp.group}>
									{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
								</OptGroup>
							))}
						</XQSelect>
					</div>
					<div className="horosa-field-block">
						<div className="horosa-field-label">宫制</div>
						<XQSelect style={{ width: '100%' }} size="small"
							value={fields.hsys ? fields.hsys.value : 0}
							onChange={(val)=>this.changeField('hsys', val)}>
							{getHousesOption(true)}
						</XQSelect>
					</div>
				</div>

				<div className="horosa-chart-style-block" style={{ marginTop: 12 }}>
					<div className="horosa-side-section-title">星盘样式</div>
					<XQSegmented
						value={this.state.chartStyle}
						onChange={this.changeChartStyle}
						options={AstroConst.CHART_STYLE_OPTIONS}
					/>
				</div>
				</XQSideSection>

				<XQButton className="horosa-recalculate-button" size="small" iconName="refresh"
					onClick={this.refetch} loading={this.state.busy}>
					重算星盘
				</XQButton>
				<XQButton size="small" iconName="help" onClick={() => this.setState({ glossaryOpen: true })} style={{ marginTop: 6 }}>
					术语速查
				</XQButton>
				{(this.props.dispatch && this.props.saveModule) ? (
					<XQButton size="small" iconName="save" onClick={this.saveCase} style={{ marginTop: 6 }}>
						存为事件盘
					</XQButton>
				) : null}
			</div>
		);
	}

	render(){
		const rootClass = `horosa-astro-page horosa-astro-redesign horosa-astro-no-bottom-dock ${this.props.pageClass || ''}`.trim();
		const chartObj = this.state.chart;
		return (
			<div className={rootClass} style={{ width: '100%', flex: '1 1 auto', minWidth: 0, ...(this.props.height ? { height: this.props.height } : {}) }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout">
					<div className="horosa-astro-redesign-grid">
						{this.renderInputPanel()}
						<div className="horosa-chart-stage horosa-chart-stage-redesign">
							{chartObj ? (
								<AstroChart value={chartObj}
									chartDisplay={this.props.chartDisplay}
									chartStyle={this.state.chartStyle}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									showAstroMeaning={this.props.showAstroMeaning}
									// [批5] 键星聚焦叠层(卜卦征象宫高亮):函数型按当前盘/extra 求值;
									// 不传=undefined → AstroChart 渲染路径与既有逐字节一致(零回归)。
									keyPlanets={typeof this.props.keyPlanets === 'function' ? this.props.keyPlanets(chartObj, this.state.extra) : this.props.keyPlanets}
									// [二期] 判读叠层(完成法连线/映点/界环着色/恒星):同款函数型求值;
									// 不传=undefined → 零回归(仅卜卦页提供)。
									horaryOverlay={typeof this.props.horaryOverlay === 'function' ? this.props.horaryOverlay(chartObj, this.state.extra) : this.props.horaryOverlay}
									// 世俗盘流派渲染白名单(古典派中盘隐外行星 glyph+相位线):同款函数型;
									// 不传=undefined → 零回归(仅世俗盘提供)。
									hideBodies={typeof this.props.hideBodies === 'function' ? this.props.hideBodies(chartObj, this.state.extra) : this.props.hideBodies}
									height="100%"
								/>
							) : (
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 320, opacity: 0.65, fontSize: 13, padding: 16, textAlign: 'center' }}>
									{this.state.busy ? '排盘中…' : (this.state.err ? '排盘失败：请确认本地服务运行后点「重算星盘」。' : '排盘中…')}
								</div>
							)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel">
							{typeof this.props.renderRight === 'function'
								? this.props.renderRight({ chart: chartObj, fields: this.state.fields, extra: this.state.extra, setExtra: this.setExtra, busy: this.state.busy, setTime: this.setTimeDt, patchFields: this.patchFields })
								: null}
						</div>
					</div>
				</div>
				{this.state.glossaryOpen ? (
					<Modal title="术语速查（西洋卜卦/择日）" open={this.state.glossaryOpen} onCancel={() => this.setState({ glossaryOpen: false })} footer={null} width={480}>
						<div style={{ maxHeight: '62vh', overflow: 'auto' }}>
							{Object.keys(GLOSSARY).map((id) => (
								<div key={id} style={{ padding: '6px 2px', borderBottom: '1px dashed rgba(148,163,184,.2)', fontSize: 13, lineHeight: 1.65 }}>
									<b>{GLOSSARY[id].cn}</b>：{GLOSSARY[id].def}
								</div>
							))}
						</div>
					</Modal>
				) : null}
			</div>
		);
	}
}

export default DivinationChartShell;
