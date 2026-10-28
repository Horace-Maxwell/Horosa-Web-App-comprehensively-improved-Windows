// 择日页子技法宿主:内嵌完整 <SanShiUnitedMain>(techniqueScope='sanshizeri'
// 独立快照槽,与主三式合一页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进三式左栏最顶),pick 后 /chart+起盘链重排(后端显示)。
// 快照冻结纪律同族;显示盘=主页后端链(三家后端);扫描判定=三家本地引擎(六壬/奇门/太乙
// 各自判定单源全数继承,sanshiZeriEngine 金标+各家 parity 看守);跨家复合条件一棵树混排。
import { Component } from 'react';
import SanShiUnitedMain, { QIMEN_OPTIONS as SANSHI_QIMEN_OPTIONS, SANSHI_PAGE_SETTINGS } from '../sanshi/SanShiUnitedMain';
import { buildFullDefaults } from './zeriOptionDefaults';
import SanshiZeriWorkbench, { sanshiWorkbenchParamFields } from './SanshiZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import { beginScanRun, scanRunIsCurrent, canonicalJson } from './zeriCaseRestore';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newSanshiLeaf, newSanshiGroup, compileSanshiTree } from '../../divination/zeri/sanshiZeriConditionTypes';
import { scanSanshi, explainSanshiAt, computeSanshiScanPan } from '../../divination/zeri/sanshiZeriScanEngine';
import { buildQimenScanSeeds } from '../../divination/zeri/qimenScanEngine';
import { buildSanshiZeriSnapshotExtra } from '../../divination/zeri/sanshiZeriSnapshot';
import { sanshiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { buildLrChartLite } from '../../divination/zeri/liurengLocal';
import { fetchChart } from '../../services/astro';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { QM_SEED_KEYS } from '../../divination/zeri/sanshiOptionSplit';
import { SANSHI_LR_PAGE_SCAN_KEYS, SANSHI_TY_PAGE_SCAN_KEYS, SANSHI_ZERI_LOCKED, liurengWorkbenchToPage, lockedValuesOf, pickKeys, splitPageKeys } from '../../divination/zeri/zeriPageCalibre';
// 宿主从内嵌三式页取的全部页面键(奇门家播种 + 六壬家 + 太乙家)
const SANSHI_HOST_PAGE_KEYS = [...QM_SEED_KEYS, ...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS];
import { mergeEmbedPatch, withEmbedPatch, chartParamWithEmbedPatch } from '../../utils/scopedFieldsSink';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';
import { zeriNatalInputDefault, normalizeSavedNatal } from './zeriNatal';
import { leadingYearOf } from '../../utils/dateStrSafe';

function initialTree(){
	return { ...newSanshiGroup('all'), children: [newSanshiLeaf('lr_ke_name')] };
}

// 解析本命(工作台「用事人本命」区;三式=六壬家 lr_bm_* 条件用):四柱 lite 取本命年支+行年支(男一岁起寅顺行,
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
		// 🔴 行年是候选时刻年的函数,不预算冻结(跨年扫描整支错位,审查实抓)——
		// natal 只带 bornYear/male,ctx.xingnian() 按候选年现算(与独立六壬择日同修)。
		return {
			mingZhi,
			bornYear,
			male,
			label: `本命${mingZhi} · 行年随候选年推(男寅顺女申逆)`,
		};
	}catch(e){
		return null;
	}
}

// 工作台缺省参数单源:六壬 / 太乙两键 + 奇门家工作台六键(取三式页奇门缺省同值:此前缺这六键,内嵌三式页左栏
// 改过排盘 / 盘式 / 值使 / 空亡 / 驿马后,点结果行不回写,点开的局与扫描所判不同)+ 共享日界(全局现值)
// 完整口径(工作台全部参数的出厂值;构造 / 载入方案共用,见 zeriOptionDefaults)
export function sanshiZeriFullDefaultOptions(){
	return buildFullDefaults(sanshiWorkbenchParamFields(), sanshiZeriDefaultOptions());
}
export function sanshiZeriDefaultOptions(){
	const q = SANSHI_QIMEN_OPTIONS;
	return {
		guirengType: 2, yueMode: 'zhongqi', taiyiAccum: 0,
		paiPanType: q.paiPanType, qijuMethod: q.qijuMethod, school: q.school, zhiShiType: q.zhiShiType, kongMode: q.kongMode, yimaMode: q.yimaMode,
		zhirunLeapDays: q.zhirunLeapDays, yueJiaQiJuType: q.yueJiaQiJuType, shiftPalace: q.shiftPalace,
		after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay(), timeAlg: 0,
	};
}

export default class SanshiZeriMain extends Component{
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
			// merged 平铺 options(splitSanshiOptions 单源拆三家;键名与三式主页 schema 同律):
			// 六壬 guirengType/yueMode+太乙 taiyiAccum+奇门盘式键+共享日界,全在工作台可调。
			options: sanshiZeriFullDefaultOptions(),	// 日界=全局现值(复审 F8 同族)
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
		// SanShiUnitedMain 重排是 hook 驱动(fields prop 变化不自触发):宿主持 hook,
		// pick 后手动 hook.fun(新 fields) 走标准重排链。
		this.sanshiHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanNatal = null;
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
	requestChartAndPlot(frozen){
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
			name: '三式择日',
			cid: null,
			// 日界两键与扫描 options 全等(底盘口径与扫描判定同一时刻)。时间算法不在这里传:/chart 不收这个键
			// (农历换算口径要用 nongliTimeAlg)。底盘只供月将、昼夜与外圈;六壬 / 奇门的日、时柱由三式页按回写的时间算法取,与扫描同一口径。
			after23NewDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay(); })(),
			lateZiHourUseNextDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : defaultLateZiHourUseNextDay(); })(),
		}, this.state.embedPatch, { extraKeys: ['zodiacal', 'siderealAyanamsa', 'hsys'] });
		// 代际号:连续两次 pick(或初排与 pick 竞争)后到者胜——旧响应静默丢弃(乱序覆盖实抓)
		const epoch = (this._chartEpoch = (this._chartEpoch || 0) + 1);
		fetchChart(param, { silent: true }).then((rsp)=>{
			if(this.unmounted || epoch !== this._chartEpoch || !rsp || !rsp.Result || !rsp.Result.params){
				return;
			}
			const Result = rsp.Result;
			Result.chartId = `lrz${Date.now().toString(36)}`;
			this.setState({ chartValue: Result }, ()=>{
				if(this.sanshiHook && typeof this.sanshiHook.fun === 'function'){
					// 🔴 用发起本次请求的同一份 fields(曾现取活值配旧 Result=fields/底盘错配)
					this.sanshiHook.fun(fields, Result);
				}
				// 首盘代点(未起盘态 sync 只存草稿;已起盘态 sync 自动重排,plot 幂等无害)
				setTimeout(()=>{
					if(!this.unmounted && this.sanshiHook && typeof this.sanshiHook.plot === 'function'){
						this.sanshiHook.plot();
					}
				}, 0);
			});
		}).catch(()=>{ /* 后端不可达:盘区留空,择时判定(本地引擎)不受影响 */ });
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	// [布局改造] 左栏入口板块(经 LiuRengMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="三式择日"
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
			compiled = compileSanshiTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		// 奇门家播种:内嵌三式页当前奇门引擎 options 打底(暗干/暗支/八神/寄宫/移星等左栏档随扫描),
		// 工作台 13 键覆盖其上(与奇门择日「遁甲页全部 options」同律;hook 未挂时=旧行为)。
		const options = this.effectiveScanOptions();
		const natal = this.state.natal ? { ...this.state.natal } : null;
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanNatal = natal;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			sanshiZeriSchemeStore.pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree);
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
			const res = await scanSanshi({
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
			// 先回写工作台口径到三式页 options,再拉底盘起盘:显示盘/母快照=扫描判定口径。
			this.applyWorkbenchCalibre().then(()=>this.requestChartAndPlot(true));
		});
	}

	// 载入方案的打底口径(工作台方案载入):出厂完整缺省,不取会话现值
	zeriFullDefaultOptions(){
		return sanshiZeriFullDefaultOptions();
	}

	// 工作台参数改动(含载入方案 / 历史):其中的页面口径键回写内嵌页(方案里的页面口径 = 存方案时内嵌页的值),
	// 其余进工作台参数 —— 页面键不住在工作台参数里(住了会压住内嵌页左栏当前值)。
	// 载入的方案一个页面键都没带(页面口径进方案之前存的):那时扫描恒按出厂页面口径 → 页面键回出厂值,不沿用内嵌页现值
	onWorkbenchOptionsChange(options, meta){
		const split = splitPageKeys(options || {}, SANSHI_HOST_PAGE_KEYS);
		const rest = split.rest;
		const page = (meta && meta.source === 'scheme' && !Object.keys(split.page).length)
			? pickKeys(SANSHI_PAGE_SETTINGS.defaults(), SANSHI_HOST_PAGE_KEYS) : split.page;
		const h = this.sanshiHook;
		if(Object.keys(page).length && h && typeof h.applyOptions === 'function'){
			// 回写后按新口径重排内嵌盘(与左栏亲手改同效:左栏显示的口径 = 盘)
			Promise.resolve(h.applyOptions(page)).then(()=>{ if(!this.unmounted){ this.replotEmbedded(); } });
		}
		this.setState({ options: rest });
	}

	// 按当前底板重排内嵌盘
	replotEmbedded(){ this.requestChartAndPlot(!!this._plotFrozen); }

	onPageCalibreChange(){
		if(this.unmounted){ return; }
		this.setState((s)=>({ pageCalibreRev: (s.pageCalibreRev || 0) + 1 }));
	}

	// 扫描口径 = 工作台键 + 内嵌三式页当前的页面键(奇门家 QM_SEED_KEYS、六壬家分昼夜 / 涉害三键、太乙家流派表);
	// 页面键以页面为准(两组键不重叠;旧方案里存下的页面键不再压住页面当前值)。
	effectiveScanOptions(){
		return { ...(this.state.options || {}), ...this.seedQimenOptions(), ...this.seedPageOptions() };
	}

	// 从内嵌三式页取六壬家 / 太乙家页面键(zeriPageCalibre 单源)
	seedPageOptions(){
		const h = this.sanshiHook;
		let page = null;
		try{ page = (h && typeof h.getOptions === 'function') ? h.getOptions() : null; }catch(e){ page = null; }
		return pickKeys(page, [...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS]);
	}

	// 从内嵌三式页取奇门家播种键(QM_SEED_KEYS 白名单;undefined 不写)。
	seedQimenOptions(){
		const h = this.sanshiHook;
		const qm = (h && typeof h.getQimenOptions === 'function') ? h.getQimenOptions() : null;
		const out = {};
		if(!qm || typeof qm !== 'object'){ return out; }
		QM_SEED_KEYS.forEach((k)=>{ if(qm[k] !== undefined){ out[k] = qm[k]; } });
		return out;
	}

	// 工作台口径 → 三式页 options(hook.applyOptions):六壬 guirengType→guireng / yueMode→yueJiangMethod /
	// yinyangSystem 原名;奇门 paiPanType/qijuMethod/school/zhiShiType/kongMode/yimaMode/timeAlg 原名;太乙 taiyiAccum 原名
	// (与 sanshiOptionSplit 同一改名规则)。母组件未挂 hook 时静默(旧行为)。
	applyWorkbenchCalibre(){
		const o = this._scanOptions || this.state.options || {};
		// 六壬工作台三键按页面键名;页面键(奇门播种 / 六壬分昼夜涉害 / 太乙流派)按冻结值
		const partial = { ...liurengWorkbenchToPage(o), ...pickKeys(o, [...QM_SEED_KEYS, ...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS]) };
		// 其余工作台键原名回写:键集就是工作台参数区那张表(单源;改名的两键上面已处理)
		sanshiWorkbenchParamFields().map((f)=>f.key).filter((k)=>k !== 'guirengType' && k !== 'yueMode').forEach((k)=>{
			if(o[k] !== undefined && o[k] !== null && `${o[k]}` !== ''){ partial[k] = o[k]; }
		});
		// 阴盘(报数定局):报数随起局一起回写 —— 扫描按工作台的报数定局,三式页留着自己的报数(内嵌页缺省空 = 退回节气定局)
		// 就是另一局。工作台报数为空时同样写空,与扫描同局。
		if(o.qijuMethod === 'shuzi' && partial.shuziReportNumber === undefined){ partial.shuziReportNumber = ''; }
		// 太乙家盘式 / 时间基准 / 博弈回写锁定值(最后盖,任何来源都不得改掉锁定)
		Object.assign(partial, lockedValuesOf(SANSHI_ZERI_LOCKED));
		const h = this.sanshiHook;
		return (h && typeof h.applyOptions === 'function' && Object.keys(partial).length) ? h.applyOptions(partial) : Promise.resolve();
	}

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainSanshiAt({
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
			const extra = buildSanshiZeriSnapshotExtra({
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
	// after23/lateZi 显示盘走全局默认——扫描侧口径由工作台参数独立冻结)。
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
		}, this.state.embedPatch);
	}

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }), ()=>{
			if(this.unmounted || (meta && meta.recompute === false)){ return; }
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
			<div className="horosa-zeri-sanshi-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<SanShiUnitedMain
						onPageCalibreChange={this.onPageCalibreChange}   /* 内嵌页口径变了 → 重算「结果已过期」 */
						chartObj={this.state.chartValue}	/* 🔴 props 名=chartObj(组件读 props.chartObj||props.chart;曾传 value= 六壬家底盘断链:月将「—」/六壬 tab 空,用户截图实报)。原样交下去:三式页自己按起课签名比对,对不上时留上一课 + 更新中、等这一刻的底盘 */
						fields={embedFields}
						hook={this.sanshiHook}
						zeriLocked={SANSHI_ZERI_LOCKED}   /* 太乙家扫描恒时计 / 钟表时 / 不用博弈:内嵌页这三项置灰 */
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="sanshizeri"
						dispatch={this.props.dispatch}   /* 存档钮此前在宿主内是死钮 */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<SanshiZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={this.onWorkbenchOptionsChange}
					optionDefaults={sanshiZeriFullDefaultOptions}
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
					onPreviewPan={(d, t)=>{
						const y = leadingYearOf(d);
						const zone = ((this._scanGeo || this.state.geo) || {}).zone || '+08:00';
						if(!this._previewSeeds || this._previewSeedsKey !== `${y}|${zone}`){
							this._previewSeeds = buildQimenScanSeeds(y, y + 1, zone);
							this._previewSeedsKey = `${y}|${zone}`;
						}
						return computeSanshiScanPan({ seeds: this._previewSeeds, natal: this._scanNatal }, this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t);
					}}
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
