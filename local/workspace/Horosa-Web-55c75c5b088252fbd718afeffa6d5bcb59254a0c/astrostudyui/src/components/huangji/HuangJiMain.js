import QuickDockBar from '../common/QuickDockBar';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { Component } from 'react';
import { InputNumber, Spin } from 'antd';
import DateTime from '../comp/DateTime';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { subscribeRemoteNongli, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection  } from '../xq-ui';
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

const METHOD_OPTIONS = [
	{ value: 'number', label: '先天数起卦' },
	{ value: 'datetime', label: '年月日時起卦' },
	{ value: 'direction', label: '后天方位起卦' },
	{ value: 'character', label: '字数起卦' },
];

const DEFAULT_CLASSIC = 'huangji_jingshi_shu';

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

async function postWangJi(path, payload){
	let rsp = null;
	try{
		const rawResponse = await cachedKentangFetch(buildKentangEndpoint('wangji', path), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wangji.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/wangji/${path}`, {
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
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wangji.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

// v3.5.1 收敛:结果级缓存退役 —— postWangJi 内部已走上游 utils/kentangCache
// (L1/L2/L3 + 在途去重);步进预取结果落上游缓存,真点同键即命中。保留本入口名,
// 登记的预取器与真点共用同一路径(键构造同源不变)。
function postWangJiCached(path, payload){
	return postWangJi(path, payload);
}

function fmtValue(value){
	return formatHumanValue(value);
}

// horosa_wangji_classics_ondemand_v1 —— 典籍正文按需取。
// 后端 /wangji/pan 只回典籍目录(level+title,~12KB);全书正文(皇極經世書 ~980KB)改由
// /wangji/classic 按 classicKey 取一次,存进本模块级缓存,再合并回 state 里的 sections。
// 因此:① 历史年/随机历史年/改典籍 触发的重新起盘不再各拖一份全书;② 章节切换(changeClassicSection)
// 与显示切换(changeClassicView)仍是纯本地读 state,零网络、瞬时;③ AI 快照读的是同一份已合并
// sections,正文一字不少(合并在 setState 之前完成,见 fetchPan / buildHuangJiSnapshotForFields)。
const CLASSIC_SECTION_CACHE = {};
const CLASSIC_SECTION_PENDING = {};

function classicsHaveContent(classics){
	if(!classics || !Array.isArray(classics.sections) || !classics.sections.length){
		return true; // 无章节 = 无正文可缺(旧盘/空数据不触发取数)
	}
	return classics.sections.some((item)=>item && typeof item.content === 'string');
}

// 取(并缓存)某部典籍的全文 sections;同 key 并发只发一次请求。失败回 null(调用方降级为目录态)。
function loadClassicSections(classicKey){
	const key = classicKey || DEFAULT_CLASSIC;
	if(CLASSIC_SECTION_CACHE[key]){
		return Promise.resolve(CLASSIC_SECTION_CACHE[key]);
	}
	if(CLASSIC_SECTION_PENDING[key]){
		return CLASSIC_SECTION_PENDING[key];
	}
	const task = postWangJi('classic', { classicKey: key }).then((res)=>{
		const sections = res && Array.isArray(res.sections) ? res.sections : null;
		if(sections){
			CLASSIC_SECTION_CACHE[key] = sections;
		}
		delete CLASSIC_SECTION_PENDING[key];
		return sections;
	}).catch(()=>{
		delete CLASSIC_SECTION_PENDING[key];
		return null;
	});
	CLASSIC_SECTION_PENDING[key] = task;
	return task;
}

// 把全文按章节序号合并进盘里的目录(就地写 content);长度/标题对不上则不写,宁缺勿错配。
function mergeClassicContent(classics, sections){
	if(!classics || !Array.isArray(classics.sections) || !Array.isArray(sections)){
		return false;
	}
	if(classics.sections.length !== sections.length){
		return false;
	}
	for(let i = 0; i < sections.length; i += 1){
		if(!sections[i] || sections[i].title !== classics.sections[i].title){
			return false;
		}
	}
	classics.sections.forEach((item, idx)=>{
		item.content = sections[idx].content || '';
	});
	classics.withContent = true;
	return true;
}

// 已有正文即刻返回;否则取一次再合并。绝不抛(典籍取数失败不能拖垮主盘)。
async function ensureClassicContent(pan){
	const classics = pan && pan.classics ? pan.classics : null;
	if(!classics || classicsHaveContent(classics)){
		return pan;
	}
	try{
		const sections = await loadClassicSections(classics.selectedKey || DEFAULT_CLASSIC);
		mergeClassicContent(classics, sections);
	}catch(e){
		// 降级:右栏「经典」显示目录态,与后端不可达时的既有表现一致
		console.warn('kinwangji classic fetch failed', e);
	}
	return pan;
}

// opts(可选)：{ classicSectionIndex } —— 选中典籍章节序号(与右栏「典籍」选择联动);缺省取首章(与 UI 初始态一致)。
export function buildSnapshotText(pan, xinyi, opts){
	if(!pan){
		return '暂无皇极经世数据';
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	if(xinyi && xinyi.result){
		lines.push('[心易发微]');
		Object.keys(xinyi.result).forEach((key)=>{
			lines.push(`${key}：${fmtValue(xinyi.result[key])}`);
		});
	}
	// [经典原文] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「典籍」renderClassics 同源 pan.classics。
	// 全书体量过大(百万字级)→ 快照口径=典籍 meta+章节目录(仅标题)+选中章节全文;正文原样引用零改写;无数据不产段。
	const classics = pan.classics && Array.isArray(pan.classics.sections) && pan.classics.sections.length ? pan.classics : null;
	if(classics){
		const meta = (classics.meta || []).find((item)=>item.key === classics.selectedKey);
		const rawIdx = opts && Number.isFinite(Number(opts.classicSectionIndex)) ? Number(opts.classicSectionIndex) : 0;
		const idx = Math.max(0, Math.min(rawIdx, classics.sections.length - 1));
		const selected = classics.sections[idx];
		lines.push('');
		lines.push('[经典原文]');
		if(meta){
			lines.push(`典籍：${fmtValue(meta.title)}（${fmtValue(meta.author)}）`);
			lines.push(`说明：${fmtValue(meta.description)}`);
		}
		lines.push(`章节目录（共${classics.sections.length}节，快照仅含选中章节全文）：${classics.sections.map((s)=>s.title).join('、')}`);
		if(selected){
			lines.push(`◆ ${selected.title}`);
			lines.push(`${selected.content || '本节无正文内容'}`);
		}
	}
	// [历史年表] 兜底段：后端 pan.sections 正常已含同名节(上方循环已出,避免重复段头);仅当缺失时按
	// pan.history 逐行「年份：事」补产(与右栏「年表」renderHistory 同源),防止老盘/缺节数据丢失该段。
	const hasHistorySection = (pan.sections || []).some((s)=>s && s.title === '历史年表');
	const historyRecords = Array.isArray(pan.history) ? pan.history : [];
	if(!hasHistorySection && historyRecords.length){
		lines.push('');
		lines.push('[历史年表]');
		lines.push('| 起始年 | 历时 | 朝代 | 称号 | 名 | 年号 |');
		lines.push('| --- | --- | --- | --- | --- | --- |');
		historyRecords.forEach((rec)=>{
			lines.push(`| ${fmtValue(rec.start_year)} | ${fmtValue(rec.duration)} | ${fmtValue(rec.dynasty)} | ${fmtValue(rec.title)} | ${fmtValue(rec.name)} | ${fmtValue(rec.era)} |`);
		});
	}
	return lines.join('\n').trim();
}

// 皇极经世 AI 快照(无头):按出生 fields 经 ken 后端起元会运世盘(默认皇极经世书)→ buildSnapshotText。
// aiAnalysisContext 复算用;心易发微(xinyi)属占断叠加,挂载默认不带(传 null);无 pan 即返 ''。
export async function buildHuangJiSnapshotForFields(fields, opts){
	try{
		const dt = parseFieldsDateTime(fields);
		if(!dt){
			return '';
		}
		// [挂载设置] opts 可覆盖:classicKey 典籍;xinyiMethod 心易起卦法(缺省不算=现状零回归),
		// 其余为对应法参数——与页面 xinyiOptions 同名同义,单源双端(页面/挂载)一致。
		const o = opts && typeof opts === 'object' ? opts : {};
		const pan = await postWangJi('pan', {
			...dt,
			historyYear: dt.year,
			classicKey: o.classicKey || DEFAULT_CLASSIC,
		});
		if(!pan){
			return '';
		}
		// horosa_wangji_classics_ondemand_v1:无头快照同样要拿到典籍正文([经典原文] 段读 sections[idx].content)。
		await ensureClassicContent(pan);
		let xinyi = null;
		const xm = o.xinyiMethod && o.xinyiMethod !== 'none' ? o.xinyiMethod : '';
		if(xm){
			try{
				xinyi = await postWangJi('xinyi', {
					...dt,
					method: xm,
					upperNum: o.upperNum != null ? o.upperNum : 5,
					lowerNum: o.lowerNum != null ? o.lowerNum : 10,
					upperStrokes: o.upperStrokes != null ? o.upperStrokes : 5,
					lowerStrokes: o.lowerStrokes != null ? o.lowerStrokes : 8,
					objectGua: o.objectGua || '離',
					direction: o.direction || '南',
				});
			}catch(e){ xinyi = null; /* 心易失败不拖主盘 */ }
		}
		return buildSnapshotText(pan, xinyi) || '';
	}catch(e){
		return '';
	}
}

class HuangJiMain extends Component{
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
		const dt = buildDateTimeFromFields(props.fields);
		this.state = {
			loading: false,
			pan: null,
			xinyi: null,
			rightPanelTab: 'overview',
			historyYear: dt.year * dt.ad,
			classicKey: DEFAULT_CLASSIC,
			classicSectionIndex: 0,
			classicView: 'section',
			xinyiOptions: {
				method: 'datetime',
				upperNum: 5,
				lowerNum: 10,
				upperStrokes: 5,
				lowerStrokes: 8,
				objectGua: '離',
				direction: '南',
			},
		};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.fetchXinyi = this.fetchXinyi.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.changeHistoryYear = this.changeHistoryYear.bind(this);
		this.changeClassic = this.changeClassic.bind(this);
		this.changeClassicSection = this.changeClassicSection.bind(this);
		this.changeClassicView = this.changeClassicView.bind(this);
		this.changeXinyiOption = this.changeXinyiOption.bind(this);
		this.randomHistoryYear = this.randomHistoryYear.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);
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

	componentDidUpdate(prevProps){
		if(prevProps.fields !== this.props.fields && this.props.fields){
			if(!this.restoreFromCurrentCase()){
				this.fetchPan(this.props.fields);
			}
		}
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘(pan+xinyi)即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'huangji'){
			return;
		}
		let text = '';
		try{
			// horosa_wangji_classics_ondemand_v1:本回调是同步的,不能 await 取正文。
			// 正常路径下 fetchPan/restore 已把正文合并进 state.pan;这里再做一次「模块缓存命中即同步补齐」
			// 的兜底(命中即零延迟),确保 [经典原文] 段绝不因按需取而丢正文。
			const pan = this.state.pan;
			if(pan && pan.classics && !classicsHaveContent(pan.classics)){
				mergeClassicContent(pan.classics, CLASSIC_SECTION_CACHE[pan.classics.selectedKey || DEFAULT_CLASSIC]);
			}
			text = `${buildSnapshotText(pan, this.state.xinyi, { classicSectionIndex: this.state.classicSectionIndex }) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('huangji', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('huangji');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		const xinyiOptions = options.xinyiOptions && typeof options.xinyiOptions === 'object'
			? { ...this.state.xinyiOptions, ...options.xinyiOptions }
			: this.state.xinyiOptions;
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this.setState({
			loading: false,
			pan: payload.pan || null,
			xinyi: payload.xinyi || null,
			historyYear: options.historyYear !== undefined ? options.historyYear : this.state.historyYear,
			classicKey: options.classicKey || this.state.classicKey,
			classicSectionIndex: options.classicSectionIndex !== undefined ? options.classicSectionIndex : this.state.classicSectionIndex,
			classicView: options.classicView || this.state.classicView,
			xinyiOptions,
		}, ()=>{
			const pan = this.state.pan;
			const xinyi = this.state.xinyi;
			const snapOpts = { classicSectionIndex: this.state.classicSectionIndex };
			saveModuleAISnapshotLazy('huangji', ()=>buildSnapshotText(pan, xinyi, snapOpts));
			// horosa_wangji_classics_ondemand_v1:存档盘(clickSaveCase 存的是已合并的 state.pan)本就带正文;
			// 万一是缺正文的旧档/降级档,这里异步补齐并重存快照——正文只会迟到,不会丢。
			if(pan && pan.classics && !classicsHaveContent(pan.classics)){
				ensureClassicContent(pan).then(()=>{
					if(this.unmounted || this.state.pan !== pan){
						return;
					}
					saveModuleAISnapshot('huangji', `${buildSnapshotText(pan, xinyi, snapOpts) || ''}`.trim());
					this.forceUpdate();
				}).catch(()=>{});
			}
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
					postWangJi('pan', payload).catch(()=>null);
					this.fetchXinyi(flds, false).catch(()=>null);
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
			historyYear: this.state.historyYear,
			classicKey: this.state.classicKey,
		};
	}

	// horosa_prefetch_registry_v1(PERF-R10 P6):供 CnYiBuMain 'cnyibu' 预取器按活跃子页转发。
	// 只报 pan(单阶段、确定性);构参与 fetchPan 同源(parseFieldsDateTime + 当前
	// historyYear/classicKey)⇒ 缓存键逐字节同键;classic 正文有模块缓存不需预取。
	getStepPrefetchTasks(steppedFields){
		try{
			const dt = parseFieldsDateTime(steppedFields);
			if(!dt){ return []; }
			const payload = { ...dt, historyYear: this.state.historyYear, classicKey: this.state.classicKey };
			return [{
				name: 'wangji',
				path: '/wangji/pan',
				run: ()=> postWangJiCached('pan', payload).catch(()=>{ /* 预取失败静默 */ }),
			}];
		}catch(e){
			return [];
		}
	}

	async fetchPan(fields){
		const payload = this.buildPanPayload(fields);
		if(!payload){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postWangJi('pan', payload);
			const xinyi = await this.fetchXinyi(fields, false);
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, xinyi, loading: false }, ()=>{
				// horosa_panel_ready_v1:主盘 + 心易同批落定 = 中栏与右栏画完的那一次 setState。
				markPanelReady('cnyibu');
				const snapOpts = { classicSectionIndex: this.state.classicSectionIndex };
				saveModuleAISnapshotLazy('huangji', ()=>buildSnapshotText(pan, xinyi, snapOpts));
			});
		}catch(e){
			console.warn('kinwangji backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	async fetchXinyi(fields, updateState = true){
		const dt = parseFieldsDateTime(fields || this.props.fields) || {};
		const opt = this.state.xinyiOptions;
		const payload = {
			...dt,
			method: opt.method,
			upperNum: opt.upperNum,
			lowerNum: opt.lowerNum,
			upperStrokes: opt.upperStrokes,
			lowerStrokes: opt.lowerStrokes,
			objectGua: opt.objectGua,
			direction: opt.direction,
		};
		// 自更新路径(起心易 / 心易选项实时重算)加序号守卫:连点/快速改选项时,只让最后一次结果落地,避免乱序覆盖。
		// updateState=false 的调用来自 fetchPan(由其自身 reqSeq 统筹),不参与本守卫。
		const seq = updateState ? (this.xinyiSeq = (this.xinyiSeq || 0) + 1) : null;
		const xinyi = await postWangJi('xinyi', payload);
		if(updateState && !this.unmounted && seq === this.xinyiSeq){
			this.setState({ xinyi }, ()=>{
				const pan = this.state.pan;
				const snapOpts = { classicSectionIndex: this.state.classicSectionIndex };
				saveModuleAISnapshotLazy('huangji', ()=>buildSnapshotText(pan, xinyi, snapOpts));
			});
		}
		return xinyi;
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'huangji',
			label: '皇极经世',
			payload: {
				options: {
					historyYear: this.state.historyYear,
					classicKey: this.state.classicKey,
					classicSectionIndex: this.state.classicSectionIndex,
					classicView: this.state.classicView,
					xinyiOptions: this.state.xinyiOptions,
				},
				pan: this.state.pan,
				xinyi: this.state.xinyi,
				snapshot: buildSnapshotText(this.state.pan, this.state.xinyi, { classicSectionIndex: this.state.classicSectionIndex }),
			},
		});
	}

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	}

	changeHistoryYear(value){
		const historyYear = value || new Date().getFullYear();
		this.setState({ historyYear }, ()=>this.fetchPan(this.props.fields));
	}

	changeClassic(value){
		this.setState({
			classicKey: value || DEFAULT_CLASSIC,
			classicSectionIndex: 0,
		}, ()=>this.fetchPan(this.props.fields));
	}

	changeClassicSection(value){
		const idx = parseInt(value, 10);
		this.setState({ classicSectionIndex: Number.isFinite(idx) ? idx : 0 });
	}

	changeClassicView(value){
		this.setState({ classicView: value || 'section' });
	}

	randomHistoryYear(){
		const historyYear = 1900 + Math.floor(Math.random() * 201);
		this.setState({ historyYear }, ()=>this.fetchPan(this.props.fields));
	}

	changeXinyiOption(key, value){
		const xinyiOptions = {
			...this.state.xinyiOptions,
			[key]: value,
		};
		this.setState({ xinyiOptions }, ()=>{
			// 心易选项(起卦法/卦数/物象/方位/笔画)改完即重算右栏「心易」,与历史年/经典等主盘选项的实时重算一致——
			// 此前只写 state 不重算,切起卦法/改卦数后右栏纹丝不动(需手点「起心易」才生效)= 死选项。
			// 仅在已有盘(fields 有效)时自动重算;「起心易」按钮保留,作显式触发无妨。fetchXinyi 内有序号守卫防乱序。
			if(this.state.pan){
				Promise.resolve(this.fetchXinyi(this.props.fields)).catch(()=>{});
			}
		});
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		const pan = this.state.pan;
		const classics = pan && pan.classics && pan.classics.meta ? pan.classics.meta : [];
		const classicSections = pan && pan.classics && pan.classics.sections ? pan.classics.sections : [];
		const xOpt = this.state.xinyiOptions;
		const trigrams = pan && pan.xinyiOptions ? (pan.xinyiOptions.trigrams || []) : ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'];
		const directions = pan && pan.xinyiOptions ? (pan.xinyiOptions.directions || []) : ['北', '東北', '東', '東南', '南', '西南', '西', '西北', '中'];
		return (
			<div className="horosa-huangji-input-stack">
				<div>
					<div className="horosa-side-panel-title">皇极经世设置</div>
					<div className="horosa-side-panel-subtitle">时间、心易与起盘选项</div>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				<XQSideSection iconName={sideSectionIcon('switches')} title="皇极选项" storageKey="huangji.s0" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field">
							<span>历史年</span>
							<InputNumber value={this.state.historyYear} onChange={this.changeHistoryYear} min={-4712} max={9999} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>经典</span>
							<Select value={this.state.classicKey} onChange={this.changeClassic}>
								{classics.map((item)=><Option key={item.key} value={item.key}>{item.title}</Option>)}
								{classics.length === 0 ? <Option value={DEFAULT_CLASSIC}>皇极经世书</Option> : null}
							</Select>
						</label>
						<label className="horosa-huangji-select-field is-wide">
							<span>典籍章节</span>
							<Select value={`${this.state.classicSectionIndex}`} onChange={this.changeClassicSection}>
								{classicSections.length === 0 ? <Option value="0">暂无章节</Option> : null}
								{classicSections.map((item, idx)=><Option key={`${item.title}_${idx}`} value={`${idx}`}>{item.title}</Option>)}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>典籍显示</span>
							<Select value={this.state.classicView} onChange={this.changeClassicView}>
								<Option value="section">选中章节</Option>
								<Option value="catalog">章节目录</Option>
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>历史抽取</span>
							<Button onClick={this.randomHistoryYear}>随机历史年</Button>
						</label>
					</div>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="心易发微" storageKey="huangji.s1" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>起卦法</span>
							<Select value={xOpt.method} onChange={(v)=>this.changeXinyiOption('method', v)}>
								{METHOD_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{xOpt.method === 'number' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>上卦数</span>
									<InputNumber value={xOpt.upperNum} min={1} onChange={(v)=>this.changeXinyiOption('upperNum', v || 1)} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>下卦数</span>
									<InputNumber value={xOpt.lowerNum} min={1} onChange={(v)=>this.changeXinyiOption('lowerNum', v || 1)} />
								</label>
							</>
						) : null}
						{xOpt.method === 'direction' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>物象</span>
									<Select value={xOpt.objectGua} onChange={(v)=>this.changeXinyiOption('objectGua', v)}>
										{trigrams.map((item)=><Option key={item} value={item}>{item}</Option>)}
									</Select>
								</label>
								<label className="horosa-huangji-select-field">
									<span>方位</span>
									<Select value={xOpt.direction} onChange={(v)=>this.changeXinyiOption('direction', v)}>
										{directions.map((item)=><Option key={item} value={item}>{item}</Option>)}
									</Select>
								</label>
							</>
						) : null}
						{xOpt.method === 'character' ? (
							<>
								<label className="horosa-huangji-select-field">
									<span>上/左笔画</span>
									<InputNumber value={xOpt.upperStrokes} min={1} onChange={(v)=>this.changeXinyiOption('upperStrokes', v || 1)} />
								</label>
								<label className="horosa-huangji-select-field">
									<span>下/右笔画</span>
									<InputNumber value={xOpt.lowerStrokes} min={1} onChange={(v)=>this.changeXinyiOption('lowerStrokes', v || 1)} />
								</label>
							</>
						) : null}
					</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
					<Button onClick={()=>this.fetchXinyi(this.props.fields)}>起心易</Button>
				</div>
			</div>
		);
	}

	renderHexCard(key, label, movingKey){
		const raw = this.state.pan && this.state.pan.raw ? this.state.pan.raw : {};
		const gua = raw[key] || '';
		const symbol = this.state.pan && this.state.pan.guaUnicode ? this.state.pan.guaUnicode[gua] : '';
		const moving = movingKey ? raw[movingKey] : '';
		return (
			<div className="horosa-huangji-gua-card" key={key}>
				<div className="horosa-huangji-gua-symbol">{symbol || '䷀'}</div>
				<strong>{gua || '—'}</strong>
				<span>{label}{moving ? ` · 动爻${moving}` : ''}</span>
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan){
			return <div className="horosa-huangji-empty">暂无皇极经世数据</div>;
		}
		const raw = pan.raw || {};
		const gz = raw['干支'] || [];
		const gzItems = ['年柱', '月柱', '日柱', '时柱', '分柱'].map((label, idx)=>({
			label,
			value: gz[idx] || raw[label] || '—',
		}));
		const wangxiang = pan.wangxiang && pan.wangxiang[1] ? pan.wangxiang[1] : {};
		// 會/運/世 引擎回传的是「累积索引」(如 運=192/世=2302);中央盘按 caption(一会三十运/一运十二世)
		// 显示「本会第几运 / 本运第几世」,与右栏「元会运世」section(_cycle_position)同口径。會 本就 ≤12。
		const cyclePos = (v, len)=>{ const n = parseInt(v, 10); return Number.isFinite(n) ? ((n - 1 + len * len) % len) + 1 : v; };
		const huiPos = cyclePos(raw['會'], 12);
		const yunPos = cyclePos(raw['運'], 30);
		const shiPos = cyclePos(raw['世'], 12);
		const macro = [
			this.renderHexCard('正卦', '正卦'),
			this.renderHexCard('運卦', '运卦', '運卦動爻'),
			this.renderHexCard('世卦', '世卦', '世卦動爻'),
			this.renderHexCard('旬卦', '旬卦', '旬卦動爻'),
		];
		const micro = [
			this.renderHexCard('年卦', '年卦'),
			this.renderHexCard('月卦', '月卦'),
			this.renderHexCard('日卦', '日卦'),
			this.renderHexCard('時卦', '时卦'),
			this.renderHexCard('分卦', '分卦'),
		];
		return (
			<div className="horosa-huangji-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2>皇极经世</h2>
					</div>
					<div className="horosa-huangji-board-time">{raw['日期'] || '—'}</div>
				</div>
					<div className="horosa-huangji-meta-grid">
						<div><span>节气</span><strong>{pan.solarTerm || '—'}</strong></div>
						<div><span>旺相</span><strong>旺{wangxiang['旺'] || '—'} · 相{wangxiang['相'] || '—'}</strong></div>
						<div><span>农历</span><strong>{pan.lunarDate && pan.lunarDate.text ? pan.lunarDate.text : '—'}</strong></div>
						<div className="horosa-huangji-ganzhi-card">
							<span>干支</span>
						<div className="horosa-huangji-ganzhi-grid">
							{gzItems.map((item)=>(
								<div className="horosa-huangji-ganzhi-item" key={item.label}>
									<em>{item.label}</em>
									<strong>{item.value}</strong>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="horosa-huangji-cycle-row">
					<div><span>会</span><strong>{huiPos}</strong><small>一元十二会</small></div>
					<div><span>运</span><strong>{yunPos}</strong><small>一会三十运</small></div>
					<div><span>世</span><strong>{shiPos}</strong><small>一运十二世</small></div>
				</div>
				<div className="horosa-huangji-gua-section">
					<div className="horosa-huangji-section-title">天道卦</div>
					<div className="horosa-huangji-gua-grid is-macro">{macro}</div>
				</div>
				<div className="horosa-huangji-gua-section">
					<div className="horosa-huangji-section-title">人事卦</div>
					<div className="horosa-huangji-gua-grid">{micro}</div>
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

	renderXinyi(){
		const xinyi = this.state.xinyi || (this.state.pan && this.state.pan.xinyi);
		if(!xinyi || !xinyi.result){
			return <div className="horosa-huangji-empty">暂无心易发微数据</div>;
		}
		const result = xinyi.result;
		return (
			<div className="horosa-huangji-xinyi">
				<div className="horosa-huangji-gua-grid is-xinyi">
					{['本卦', '變卦', '互卦'].map((key)=>(
						<div className="horosa-huangji-gua-card" key={key}>
							<div className="horosa-huangji-gua-symbol">{this.state.pan && this.state.pan.guaUnicode ? this.state.pan.guaUnicode[result[key]] : '䷀'}</div>
							<strong>{fmtValue(result[key])}</strong>
							<span>{key.replace('變', '变')}</span>
						</div>
					))}
				</div>
				{this.renderRows(xinyi.sections || [{ title: '心易发微', rows: Object.keys(result).map((key)=>({ label: key, value: result[key] })) }])}
			</div>
		);
	}

	renderHistory(){
		const records = this.state.pan && this.state.pan.history ? this.state.pan.history : [];
		if(!records.length){
			return <div className="horosa-huangji-empty">暂无历史年表</div>;
		}
		return this.renderRows([{
			title: `${this.state.historyYear}年历史对照`,
			rows: records.reduce((rows, rec, idx)=>{
				rows.push({ label: `记录${idx + 1}`, value: `${fmtValue(rec.dynasty)} ${fmtValue(rec.title)} ${fmtValue(rec.name)} ${fmtValue(rec.era)}` });
				rows.push({ label: '范围', value: `${rec.start_year}起，${rec.duration}年` });
				return rows;
			}, []),
		}]);
	}

	renderClassics(){
		const classics = this.state.pan && this.state.pan.classics ? this.state.pan.classics : null;
		if(!classics || !classics.sections || !classics.sections.length){
			return <div className="horosa-huangji-empty">暂无经典文本</div>;
		}
		const meta = (classics.meta || []).find((item)=>item.key === classics.selectedKey);
		const idx = Math.max(0, Math.min(this.state.classicSectionIndex || 0, classics.sections.length - 1));
		const selectedSection = classics.sections[idx];
		const displaySections = this.state.classicView === 'catalog'
			? classics.sections
			: (selectedSection ? [selectedSection] : []);
		return (
			<div className="horosa-huangji-classics">
				{meta ? (
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">{meta.title}</div>
						<div className="horosa-huangji-info-row"><span>作者</span><strong>{meta.author}</strong></div>
						<div className="horosa-huangji-info-row"><span>说明</span><strong>{meta.description}</strong></div>
					</div>
				) : null}
				<div className="horosa-huangji-classic-list">
					{displaySections.map((section, sectionIdx)=>(
						<div className="horosa-huangji-classic-section" key={`${section.title}_${sectionIdx}`}>
							<strong>{section.title}</strong>
							<p>{this.state.classicView === 'catalog' ? (section.content || '本节无正文内容').slice(0, 420) : (section.content || '本节无正文内容')}</p>
							{this.state.classicView === 'catalog' && section.content && section.content.length > 420 ? <em>已显示摘要，可在左侧选择本章查看全文。</em> : null}
						</div>
					))}
				</div>
			</div>
		);
	}

	renderRightPanel(){
		const pan = this.state.pan;
		const activeKey = ['overview', 'gua', 'xinyi', 'classics', 'history'].indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
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
				<TabPane tab="卦象" key="gua">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'gua'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(pan ? (pan.sections || []).slice(2, 4) : [])}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="心易" key="xinyi">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'xinyi'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderXinyi()}</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="经典" key="classics">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'classics'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderClassics()}</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="年表" key="history">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'history'}>{() => (
						<div className="horosa-huangji-section-list">{this.renderHistory()}</div>
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
				page="huangji"
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
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
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
										<div className="horosa-side-panel-title">皇极信息</div>
										<div className="horosa-side-panel-subtitle">卦象、心易与年表</div>
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

export default HuangJiMain;
