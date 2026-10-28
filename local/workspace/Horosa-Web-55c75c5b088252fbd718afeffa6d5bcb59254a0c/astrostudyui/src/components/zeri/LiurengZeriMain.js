// 择日页子技法宿主:内嵌完整 <LiuRengMain>(techniqueScope='liurengzeri'
// 独立快照槽,与主六壬页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进 LiuRengMain 左栏最顶),pick 后 /chart+起课链重排(后端显示)。
// 快照冻结纪律同族:_scanCfg/_scanGeo/_scanOptions/_scanTree/_scanNatal;_scanUiJson
// 指纹驱动 resultsStale。显示盘=主页后端链;扫描判定=本地 lite 供数+主页同一排盘函数族
// (涉害核同源)——三个供数差异窗(月将换将时刻/昼夜界折射窗/四柱 golden 满防)帮助分册明示。
import { Component } from 'react';
import LiuRengMain from '../lrzhan/LiuRengMain';
import LiurengZeriWorkbench, { liurengWorkbenchParamFields } from './LiurengZeriWorkbench';
import { LIURENG_PAGE_SETTINGS } from '../lrzhan/main/castLayout';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { beginScanRun, scanRunIsCurrent, canonicalJson } from './zeriCaseRestore';
import DateTime from '../comp/DateTime';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newLiurengLeaf, newLiurengGroup, compileLiurengTree } from '../../divination/zeri/liurengZeriConditionTypes';
import { scanLiureng, explainLiurengAt, computeLiurengScanPan } from '../../divination/zeri/liurengZeriScanEngine';
import { buildLiurengZeriSnapshotExtra } from '../../divination/zeri/liurengZeriSnapshot';
import { liurengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { buildLrChartLite } from '../../divination/zeri/liurengLocal';
import { LIURENG_PAGE_SCAN_KEYS, LIURENG_ZERI_LOCKED, liurengWorkbenchToPage, lockedValuesOf, pickKeys, splitPageKeys } from '../../divination/zeri/zeriPageCalibre';
import { fetchChart } from '../../services/astro';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { mergeEmbedPatch, withEmbedPatch, chartParamWithEmbedPatch } from '../../utils/scopedFieldsSink';
import { castChartFor } from '../../utils/derivedChartSource';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';
import { zeriNatalInputDefault, normalizeSavedNatal } from './zeriNatal';
import { leadingYearOf } from '../../utils/dateStrSafe';

function initialTree(){
	return { ...newLiurengGroup('all'), children: [newLiurengLeaf('ke_name')] };
}

// 解析本命(工作台「用事人本命」区):四柱 lite 取本命年支+行年支(男一岁起寅顺行,
// 女一岁起申逆行,虚岁=候选年-生年+1;与主六壬页行年口径同族)。
export function resolveNatal({ date, time, zone, gender }){
	try{
		const r = buildLrChartLite({ zone: zone || '+08:00' }, {}, date, time || '12:00:00');
		if(!r){ return null; }
		const yearGz = ((r.fourColumns || {}).year || {}).ganzi || ((r.fourColumns || {}).year || {}).ganZhi || '';
		const mingZhi = yearGz.charAt(1);
		if(!mingZhi){ return null; }
		const bornYear = leadingYearOf(date);
		const male = gender !== 0;
		// 🔴 行年是**候选时刻年**的函数(虚岁=候选年-生年+1),不在此预算——扫描窗最长
		// 1830 天≈5 个行年,按「点击扫描时的系统年」冻结=跨年样本整支错位(审查实抓)。
		// natal 只带 bornYear/male,行年由求值 ctx.xingnian() 按 pan 候选年现算。
		return {
			mingZhi,
			bornYear,
			male,
			// 解析所用的生辰随本命一起冻结(存案 / 方案照存):点结果行时回写内嵌六壬页的卜卦人出生,盘面行年与扫描判的是同一个人
			birth: { date: `${date}`, time: time || '12:00:00', zone: zone || '+08:00', gender: male ? 1 : 0 },
			label: `本命${mingZhi} · 行年随候选年推(男寅顺女申逆)`,
		};
	}catch(e){
		return null;
	}
}

// 用事人本命 → 内嵌六壬页卜卦人出生的字段形(applyBirth)。本命带解析所用的生辰 → 照它;本命是早先存下的(只有生年 / 性别)
// → 用同次冻结的本命输入框,但生年 / 性别必须与本命一致(对不上就不回写,宁可维持现状也不换成另一个人);没有本命 → null
export function natalBirthFieldsOf(natal, natalInput){
	const n = natal && typeof natal === 'object' ? natal : null;
	if(!n || !n.bornYear){ return null; }
	let b = n.birth && typeof n.birth === 'object' && n.birth.date ? n.birth : null;
	if(!b && natalInput && natalInput.date && parseYearFromDateStr(`${natalInput.date}`) === Number(n.bornYear)
		&& (natalInput.gender === 0 ? false : true) === !!n.male){
		b = natalInput;
	}
	if(!b){ return null; }
	const timeText = `${b.time || '12:00'}`.length === 5 ? `${b.time}:00` : `${b.time || '12:00:00'}`;
	const zone = b.zone || '+08:00';
	const raw = new DateTime();
	if(typeof raw.setZone === 'function'){ raw.setZone(zone); }
	const dt = raw.parse ? raw.parse(`${b.date} ${timeText}`, 'YYYY-MM-DD HH:mm:ss') : raw;
	return {
		date: mkField(dt),
		time: mkField(dt && dt.clone ? dt.clone() : dt),
		zone: mkField(zone),
		gender: mkField(n.male ? 1 : 0),
	};
}

// 工作台缺省参数单源(页面构造与 AI 择日搜索共用) —— 日界两键=全局现值(主六壬页同源);timeAlg 恒真太阳(主页 gods 固有口径,非可调档)
// 完整口径(工作台全部参数的出厂值;构造 / 载入方案共用,见 zeriOptionDefaults)
export function liurengZeriFullDefaultOptions(){
	return buildFullDefaults(liurengWorkbenchParamFields(), liurengZeriDefaultOptions());
}
export function liurengZeriDefaultOptions(){
	return { guirengType: 2, yueMode: 'zhongqi', after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay() };
}

export default class LiurengZeriMain extends Component{
	constructor(props){
		super(props);
		const today = todayStr();
		const now = new Date();
		const nowText = `${today} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:00`;
		this.state = {
			searchOpen: false,
			embedPatch: {},	// 内嵌页左栏亲手改的字段:只进本宿主,不写主盘(见 utils/scopedFieldsSink)
			embedRev: 0,
			pickText: nowText,	// 当前起盘时刻(左栏入口板块显示;pick 改它)
			cfg: { startDate: today, startTime: '00:00', endDate: today, endTime: '23:59' },
			geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, pos: '北京' },
			// 扫描参数六键(逐键判别力由 liurengZeriEngine 金标证:贵人流派/阴阳系/月将两档/
			// 换日/晚子时/时基;昼夜=日出方程自动判,非档位)。
			// 贵人体系缺省 2=星占法(主六壬页 guireng:2 同默认;此前 0=六壬法,pick 回写把主页左栏从星占法改成六壬法)
			options: liurengZeriFullDefaultOptions(),
			natal: null,          // 用事人本命(resolveNatal 产物;选填,解锁本命组条件)
			natalInput: zeriNatalInputDefault(),   // 构造缺省单源(载入没有本命的存案时照它复位)
			tree: initialTree(),
			chartValue: null,	// 后端 /chart Result(六壬起排需 value.chart 底盘;宿主自管,pick 后重拉)
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		// LiuRengMain 重排是 hook 驱动(fields prop 变化不自触发):宿主持 hook,
		// pick 后手动 hook.fun(新 fields) 走标准重排链。
		this.liurengHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanNatal = null;
		this._scanNatalInput = null;
		this._scanUiJson = '';
		this.openSearch = this.openSearch.bind(this);
		this.renderLeftExtra = this.renderLeftExtra.bind(this);
		this.runSearch = this.runSearch.bind(this);
		this.cancelScan = this.cancelScan.bind(this);
		this.onPickInterval = this.onPickInterval.bind(this);
		this.explainRow = this.explainRow.bind(this);
		this.onGeoChange = this.onGeoChange.bind(this);
		this.composeAiSnapshot = this.composeAiSnapshot.bind(this);
		this.onEmbedFieldsChange = this.onEmbedFieldsChange.bind(this);
		this.onWorkbenchOptionsChange = this.onWorkbenchOptionsChange.bind(this);
		this.onPageCalibreChange = this.onPageCalibreChange.bind(this);
	}

	componentDidMount(){
		// 初排当前时刻(主六壬页由全局命盘链供 value;宿主自管同形链)
		this.requestChartAndPlot();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 拉 /chart 底盘并触发六壬起排(hook.fun 双参:fields+chartObj——LiuRengMain
	// startPaiPanByFields 需 value.chart,缺则静默不排,真机实抓)。
	// opts.chartOnly:只取底盘交给内嵌页(hook.setChart),不起课 —— 载入存案时课由存档复原
	requestChartAndPlot(frozen, opts){
		const chartOnly = !!(opts && opts.chartOnly);
		this._plotFrozen = !!frozen;   // 记下底板口径:内嵌页之后改字段按同一底板重排
		if(frozen){ this._plotBaseKey = JSON.stringify([this.state.pickText, this.state.geo, this.state.options]); }
		const fields = this.buildFields(frozen);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const dt = fields.date.value;
		const param = chartParamWithEmbedPatch({
			date: dt.format ? dt.format('YYYY/MM/DD') : '',
			time: dt.format ? dt.format('HH:mm:ss') : '',
			ad: 1,
			zone: geo.zone !== undefined ? geo.zone : '+08:00',
			lon: geo.lon,
			lat: geo.lat,
			gpsLon: geo.gpsLon,
			gpsLat: geo.gpsLat,
			pos: geo.pos || '',
			gender: 1,
			name: '六壬择日',
			cid: null,
			// 日界两键与扫描 options 全等(底盘口径与扫描判定同一时刻)。时间算法不在这里传:/chart 不收这个键
			// (农历换算口径要用 nongliTimeAlg),底盘本就按真太阳时 —— 与扫描恒用的真太阳时一致。
			after23NewDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay(); })(),
			lateZiHourUseNextDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : defaultLateZiHourUseNextDay(); })(),
		}, this.state.embedPatch);
		// 代际号:连续两次 pick(或初排与 pick 竞争)后到者胜——旧响应静默丢弃(乱序覆盖实抓)
		const epoch = (this._chartEpoch = (this._chartEpoch || 0) + 1);
		// 取这一刻的底盘失败(后端不可达 / 回包不成形):盘区留空 —— 内嵌页换了时刻地点就清掉上一课,同一课只改设置留存;
		// 载入存案只换底盘的那条(chartOnly)不清:课由存档复原,不是上一课
		const unavailable = ()=>{
			if(this.unmounted || epoch !== this._chartEpoch || chartOnly){ return; }
			if(this.liurengHook && typeof this.liurengHook.chartUnavailable === 'function'){ this.liurengHook.chartUnavailable(fields); }
		};
		fetchChart(param, { silent: true }).then((rsp)=>{
			if(this.unmounted || epoch !== this._chartEpoch){
				return;
			}
			if(!rsp || !rsp.Result || !rsp.Result.params){
				unavailable();
				return;
			}
			const Result = rsp.Result;
			Result.chartId = `lrz${Date.now().toString(36)}`;
			this.setState({ chartValue: Result }, ()=>{
				if(chartOnly){
					if(this.liurengHook && typeof this.liurengHook.setChart === 'function'){ this.liurengHook.setChart(fields, Result); }
					return;
				}
				if(this.liurengHook && typeof this.liurengHook.fun === 'function'){
					// 🔴 用发起本次请求的同一份 fields(曾现取活值配旧 Result=fields/底盘错配)
					this.liurengHook.fun(fields, Result);
				}
			});
		}).catch(()=>{ unavailable(); /* 择时判定(本地引擎)不受影响 */ });
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	// [布局改造] 左栏入口板块(经 LiuRengMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="六壬择日"
				onOpen={this.openSearch}
			/>
		);
	}

	onGeoChange(rec){
		if(!rec){
			return;
		}
		if(rec.gpsLng !== undefined || rec.lng !== undefined){
			const gpsLat = rec.gpsLat !== undefined ? rec.gpsLat : rec.lat;
			const gpsLon = rec.gpsLng !== undefined ? rec.gpsLng : rec.lng;
			this.setState({
				geo: {
					...(this.state.geo || {}),
					gpsLat,
					gpsLon,
					lat: convertLatToStr(gpsLat),
					lon: convertLonToStr(gpsLon),
					pos: rec.name || (this.state.geo && this.state.geo.pos) || '',
					zone: rec.zone !== undefined && rec.zone !== null ? rec.zone : (this.state.geo && this.state.geo.zone),
				},
			});
			return;
		}
		this.setState({ geo: { ...(this.state.geo || {}), ...rec } });
	}

	// 过期判据的指纹(纯函数):给定一份扫描口径算指纹(规范化序列化,键序不同不误报);扫描时与现在都经 currentUiJson 取
	uiJsonOf(parts){
		const q = parts || {};
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: q.options, natal: q.natal, tree: q.tree });
	}

	// 过期判据的指纹:扫描口径按 effectiveScanOptions(工作台参数 + 内嵌页当前的页面口径键)—— 内嵌页左栏改了页面键,
	// 「结果已过期」与改工作台参数一样亮(内嵌页经 onPageCalibreChange 告知本宿主重渲染)
	currentUiJson(){
		return this.uiJsonOf({ ...this.state, options: this.effectiveScanOptions() });
	}

	buildGeoParams(geo){
		const g = geo || {};
		return {
			zone: g.zone !== undefined && g.zone !== null ? g.zone : '+08:00',
			lon: g.lon,
			lat: g.lat,
			gpsLon: g.gpsLon,
			gpsLat: g.gpsLat,
			ad: g.ad !== undefined ? g.ad : 1,
			gender: (this.state.options && this.state.options.gender) !== undefined ? this.state.options.gender : 1,
		};
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileLiurengTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		const options = this.effectiveScanOptions();
		const natal = this.state.natal ? { ...this.state.natal } : null;
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanNatal = natal;
		this._scanNatalInput = this.state.natalInput ? { ...this.state.natalInput } : null;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			liurengZeriSchemeStore.pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断
		}
		// 运行代次:只认最后一次开始的扫描(取消后立刻重扫时,上一轮晚到的进度 / 结果 / 收尾不再写)
		const run = beginScanRun(this);
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({
			scanning: true,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: this.state.scanEpoch + 1,
		});
		try{
			const res = await scanLiureng({
				cfg,
				geoParams: this.buildGeoParams(geo),
				options: { ...options, _natal: natal },
				tree: compiled,
				signal: this._abort.signal,
				onProgress: (p)=>{
					if(this.unmounted || !scanRunIsCurrent(this, run)){
						return;
					}
					this.setState({ progress: p, results: p.partial && p.partial.length ? p.partial : this.state.results });
				},
			});
			if(this.unmounted || !scanRunIsCurrent(this, run)){
				return;
			}
			this.setState({ scanning: false, progress: null, results: res.intervals, truncated: res.truncated });
		}catch(e){
			if(this.unmounted || !scanRunIsCurrent(this, run)){
				return;
			}
			if(e && e.name === 'AbortError'){
				this.setState({ scanning: false, progress: null });
			}else{
				this.setState({ scanning: false, progress: null, scanErr: (e && e.message) || '择时失败' });
			}
		}
	}

	cancelScan(){
		if(this._abort){
			this._abort.abort();
		}
	}

	// 点击结果行:pick 时刻改 fields 全链重排(BaZi 标准链),关工作台看盘。
	onPickInterval(row, which){
		const raw = (which === 'end' ? (row.pickEnd || row.end) : (row.pick || row.start)) || row.start;
		const text = raw.length === 16 ? `${raw}:00` : raw;
		// 冻结标记与底板键在 setState 之前置好:这一次渲染就把冻结 fields 交给内嵌页(回调里的起盘再置一次,同值)
		this._plotFrozen = true;
		this._plotBaseKey = JSON.stringify([text, this.state.geo, this.state.options]);
		this.setState({ pickText: text, searchOpen: false, embedPatch: {}, embedRev: (this.state.embedRev || 0) + 1 }, ()=>{
			// 先回写工作台口径到六壬页起课选项,再拉底盘起课:显示盘/母快照=扫描判定口径。
			this.applyWorkbenchCalibre().then(()=>this.requestChartAndPlot(true));
		});
	}

	// 载入方案的打底口径(工作台方案载入):出厂完整缺省,不取会话现值
	zeriFullDefaultOptions(){
		return liurengZeriFullDefaultOptions();
	}

	// 工作台参数改动(含载入方案 / 历史):其中的页面口径键回写内嵌页(方案里的页面口径 = 存方案时内嵌页的值),
	// 其余进工作台参数 —— 页面键不住在工作台参数里(住了会压住内嵌页左栏当前值)。
	// 载入的方案一个页面键都没带(页面口径进方案之前存的):那时扫描恒按出厂页面口径 → 页面键回出厂值,不沿用内嵌页现值
	onWorkbenchOptionsChange(options, meta){
		const split = splitPageKeys(options || {}, LIURENG_PAGE_SCAN_KEYS);
		const rest = split.rest;
		const page = (meta && meta.source === 'scheme' && !Object.keys(split.page).length)
			? pickKeys(LIURENG_PAGE_SETTINGS.defaults(), LIURENG_PAGE_SCAN_KEYS) : split.page;
		const h = this.liurengHook;
		if(Object.keys(page).length && h && typeof h.applyCastFields === 'function'){
			// 回写后按新口径重排内嵌盘(与左栏亲手改同效:左栏显示的口径 = 盘)
			Promise.resolve(h.applyCastFields(page)).then(()=>{ if(!this.unmounted){ this.replotEmbedded(); } });
		}
		this.setState({ options: rest });
	}

	// 按当前底板重排内嵌盘
	replotEmbedded(){ this.requestChartAndPlot(!!this._plotFrozen); }

	onPageCalibreChange(){
		if(this.unmounted){ return; }
		this.setState((s)=>({ pageCalibreRev: (s.pageCalibreRev || 0) + 1 }));
	}

	// 扫描口径 = 工作台三键(贵人 / 月将 / 阴阳系)+ 内嵌六壬页当前的分昼夜 / 涉害三键(zeriPageCalibre 单源):
	// 此前扫描恒按出厂口径,在内嵌页左栏改过涉害取舍的,点开的课名 / 三传与命中行不一致。页面键以页面为准。
	effectiveScanOptions(){
		const h = this.liurengHook;
		let page = null;
		try{ page = (h && typeof h.getCastOptions === 'function') ? h.getCastOptions() : null; }catch(e){ page = null; }
		return { ...(this.state.options || {}), ...pickKeys(page, LIURENG_PAGE_SCAN_KEYS) };
	}

	// 扫描口径 → 六壬页(hook.applyCastFields):工作台三键按页面键名(zeriPageCalibre.liurengWorkbenchToPage)、
	// 页面四键按冻结值、起课法回写锁定值(正时正将)。母组件未挂 hook 时静默(旧行为)。
	applyWorkbenchCalibre(){
		const o = this._scanOptions || this.state.options || {};
		const partial = { ...liurengWorkbenchToPage(o), ...pickKeys(o, LIURENG_PAGE_SCAN_KEYS), ...lockedValuesOf(LIURENG_ZERI_LOCKED) };
		const h = this.liurengHook;
		const jobs = [];
		if(h && typeof h.applyCastFields === 'function' && Object.keys(partial).length){ jobs.push(h.applyCastFields(partial)); }
		// 逐盘输入:有用事人本命时,卜卦人出生 / 性别随本命回写(zeriPageCalibre.LIURENG_PER_CHART_INPUTS);没填本命不动
		const birth = natalBirthFieldsOf(this._scanUiJson ? this._scanNatal : this.state.natal, this._scanUiJson ? this._scanNatalInput : this.state.natalInput);
		if(birth && h && typeof h.applyBirth === 'function'){ jobs.push(h.applyBirth(birth)); }
		return Promise.all(jobs);
	}

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainLiurengAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: { ...(this._scanOptions || this.state.options || {}), _natal: this._scanNatal },
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
		});
	}

	explainRow(row){
		return Promise.resolve(this.explainRowSync(row));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildLiurengZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
				natal: this._scanNatal || this.state.natal,
				tree: this._scanUiTree || this.state.tree,	// 冻结树:与命中行同源(活树曾致条件描述≠结果,复审 F5)
				results: this.state.results,
				truncated: this.state.truncated,
				explainAt: (row)=>this.explainRowSync(row),   // 前 N 行判读树(全局可配)
			});
			return extra ? `${baseText ? `${baseText}\n\n` : ''}${extra}` : baseText;
		}catch(e){
			return baseText;
		}
	}

	// 宿主自管 fields:pick 时刻+择日地点+性别/时基合成 ZiWeiMain 标准 fields 形
	// (buildZiweiBirthParams 消费面:date/time/ad/zone/lon/lat/gps*/gender/timeAlg;
	// after23/lateZi 取工作台的,与扫描同口径)。
	// frozen=true(pick 起盘):用扫描冻结快照——所见行=所判口径(奇门母本纪律)。
	buildFields(frozen){
		const t = mkDT(this.state.pickText);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const o = (frozen && this._scanOptions) || this.state.options || {};
		return withEmbedPatch({
			date: mkField(t),
			time: mkField(t.clone ? t.clone() : t),
			ad: mkField(1),
			zone: mkField(geo.zone !== undefined ? geo.zone : '+08:00'),
			lon: mkField(geo.lon),
			lat: mkField(geo.lat),
			gpsLat: mkField(geo.gpsLat),
			gpsLon: mkField(geo.gpsLon),
			pos: mkField(geo.pos || ''),
			gender: mkField(o.gender !== undefined ? o.gender : 1),
			timeAlg: mkField(0),
			// 日界 / 晚子时干随工作台(与扫描同一口径、同一缺省,见 liurengLocal.buildLrChartLite):不带时起课请求按后端缺省
			// 23 点换日,23–24 点的命中行点开是次日日干的课,与扫描判的不是同一课
			after23NewDay: mkField(o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay()),
			lateZiHourUseNextDay: mkField(o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : defaultLateZiHourUseNextDay()),
		}, this.state.embedPatch);
	}

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }), ()=>{
			if(this.unmounted){ return; }
			// 载入存案(覆盖层整个换成存案时刻、课由存档复原):按存案时刻只换底盘(代际号同时作废在途的初排 ——
			// 首次挂载时宿主初排按择日页当前时刻,回来会按当前时刻重新起课、把存档的课盖掉)
			if(meta && meta.replace && meta.recompute === false){ this.requestChartAndPlot(!!this._plotFrozen, { chartOnly: true }); return; }
			if(meta && meta.recompute === false){ return; }
			this.requestChartAndPlot(!!this._plotFrozen);
		});
	}

	render(){
		// 点选之后工作台的时刻 / 地点 / 口径又改了 → 回到活值底板(与改动前同:内嵌页跟着工作台走)
		if(this._plotFrozen && this._plotBaseKey !== JSON.stringify([this.state.pickText, this.state.geo, this.state.options])){ this._plotFrozen = false; }
		const embedFields = this.buildFields(!!this._plotFrozen);
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-liureng-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<LiuRengMain
						onPageCalibreChange={this.onPageCalibreChange}   /* 内嵌页口径变了 → 重算「结果已过期」 */
						value={castChartFor(this.state.chartValue, embedFields)}   /* 底盘只在与内嵌页起课时刻地点一致时交下去(取失败 / 在途时是上一刻的) */
						fields={embedFields}
						hook={this.liurengHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="liurengzeri"
						zeriLocked={LIURENG_ZERI_LOCKED}   /* 扫描只按正时正将起课:内嵌页起课法置灰 */
						dispatch={this.props.dispatch}   /* 存档钮此前在宿主内是死钮 */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<LiurengZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={this.onWorkbenchOptionsChange}
					optionDefaults={liurengZeriFullDefaultOptions}
					getSchemeOptions={()=>this.effectiveScanOptions()}   /* 方案连内嵌页的页面口径键一起存 */
					natal={this.state.natal}
					natalInput={this.state.natalInput}
					onNatalInputChange={(natalInput)=>this.setState({ natalInput })}
					onResolveNatal={()=>{
						const n = resolveNatal(this.state.natalInput);
						this.setState({ natal: n });
						return n;
					}}
					onClearNatal={()=>this.setState({ natal: null })}
					onRestoreNatal={(n)=>this.setState({ natal: normalizeSavedNatal(n) })}   /* 方案载入回灌本命(坏形 = 没有) */
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					previewGeo={this._scanGeo || this.state.geo}   /* 冻结地点:概览口径=扫描口径 */
					previewOptions={this._scanOptions || this.state.options}   /* 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewPan={(d, t)=>computeLiurengScanPan(this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t)}
					onTreeChange={(tree)=>this.setState({ tree })}
					onRun={this.runSearch}
					onCancelScan={this.cancelScan}
					onPickInterval={this.onPickInterval}
					onExplain={this.explainRow}
					scanEpoch={this.state.scanEpoch}
					resultsStale={resultsStale}
					scanning={this.state.scanning}
					progress={this.state.progress}
					results={this.state.results}
					truncated={this.state.truncated}
					scanErr={this.state.scanErr}
				/>
			</div>
		);
	}
}
