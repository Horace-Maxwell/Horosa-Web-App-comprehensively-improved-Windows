// 择日页子技法宿主:内嵌完整 <TaiYiMain>(techniqueScope='taiyizeri' 独立
// 快照槽,与主太乙页 keep-alive 并存互不竞写)。宿主自管 fields
// (左栏入口板块经 renderLeftExtra 插槽进 TaiYiMain 左栏最顶),pick 后 hook.fun 重排。
// 快照冻结纪律(天星/奇门/黄历同款):_scanCfg/_scanGeo/_scanOptions/_scanTree/_scanNatal;
// _scanUiJson 指纹驱动 resultsStale。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { Component } from 'react';
import TaiYiMain, { TAIYI_PAGE_SETTINGS } from '../taiyi/TaiYiMain';
import TaiyiZeriWorkbench, { taiyiWorkbenchParamFields } from './TaiyiZeriWorkbench';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { beginScanRun, scanRunIsCurrent, canonicalJson } from './zeriCaseRestore';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newTaiyiLeaf, newTaiyiGroup, compileTaiyiTree } from '../../divination/zeri/taiyiZeriConditionTypes';
import { scanTaiyi, explainTaiyiAt, computeTaiyiScanPan } from '../../divination/zeri/taiyiZeriScanEngine';
import { buildTaiyiZeriSnapshotExtra } from '../../divination/zeri/taiyiZeriSnapshot';
import { taiyiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { TAIYI_PAGE_SCAN_KEYS, TAIYI_ZERI_LOCKED, TAIYI_RETIRED_OPTION_KEYS, lockedValuesOf, pickKeys, splitPageKeys, withoutKeys } from '../../divination/zeri/zeriPageCalibre';
import { mergeEmbedPatch, withEmbedPatch } from '../../utils/scopedFieldsSink';
import { getStore } from '../../utils/storageutil';
import { caseRestoreKey } from '../../utils/kentangCaseSave';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';

function initialTree(){
	return { ...newTaiyiGroup('all'), children: [newTaiyiLeaf('geju_kind')] };
}


// 工作台缺省参数单源(页面构造与 AI 择日搜索共用) —— 仅 tn 有判别力(换日 / 晚子时 / tenching 对太乙判定面零效果:积数按绝对时辰序列)
// 完整口径(工作台全部参数的出厂值;构造 / 载入方案共用,见 zeriOptionDefaults)
export function taiyiZeriFullDefaultOptions(){
	return buildFullDefaults(taiyiWorkbenchParamFields(), taiyiZeriDefaultOptions());
}
export function taiyiZeriDefaultOptions(){
	return { tn: 0 };
}

export default class TaiyiZeriMain extends Component{
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
			options: taiyiZeriFullDefaultOptions(),
			tree: initialTree(),
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		// ⚠ TaiYiMain 与八字**不同律**:它按 fields prop **引用**自触发重排(didUpdate
		// prevProps.fields !== fields → requestNongli)——render 必须传 memo 引用
		// (buildFieldsMemo),否则工作台每次 setState 都轰后端。pick 仍走 hook.fun 显式重排。
		this.taiyiHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
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

	// 本页已挂着时载入事盘:内嵌太乙按 fields 引用变化才还原,而这里的 fields 走记忆化、载入时引用不变 →
	// 显式载入一换(caseRestoreKey:载入的 cid / 载入代次)就请它还原一次(它自带去重;不是太乙择日的事盘直接返回)
	componentDidUpdate(){
		let key = '';
		try{
			const store = getStore();
			const u = store && store.user ? store.user : null;
			key = caseRestoreKey('taiyizeri', u) || '';
		}catch(e){ key = ''; }
		if(key === this._lastCaseKey){ return; }
		this._lastCaseKey = key;
		if(key && this.taiyiHook && typeof this.taiyiHook.restoreCase === 'function'){ this.taiyiHook.restoreCase(); }
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	// [布局改造] 左栏入口板块(经 TaiYiMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="太乙择日"
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
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: q.options, tree: q.tree });
	}

	// 过期判据的指纹:扫描口径按 effectiveScanOptions(工作台参数 + 内嵌页当前的页面口径键)—— 内嵌页左栏改了页面键,
	// 「结果已过期」与改工作台参数一样亮(内嵌页经 onPageCalibreChange 告知本宿主重渲染)
	currentUiJson(){
		return this.uiJsonOf({ ...this.state, options: this.effectiveScanOptions() });
	}

	// 性别跟随工作台口径 options.sex(1=男 / 0=女):此前写死 1,内嵌太乙页左栏一改性别,
	//   盘按新值算(坤造·女)而宿主下拉仍显男;再选男时 fields 不变 → 不触发重排,回不到男。
	genderOf(options){
		const o = options || this.state.options || {};
		return Number(o.sex) === 0 ? 0 : 1;
	}

	buildGeoParams(geo, options){
		const g = geo || {};
		return {
			zone: g.zone !== undefined && g.zone !== null ? g.zone : '+08:00',
			lon: g.lon,
			lat: g.lat,
			gpsLon: g.gpsLon,
			gpsLat: g.gpsLat,
			ad: g.ad !== undefined ? g.ad : 1,
			gender: this.genderOf(options),
		};
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileTaiyiTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		const options = this.effectiveScanOptions();
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			taiyiZeriSchemeStore.pushHistory({ cfg, geo, options }, this.state.tree);
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
			const res = await scanTaiyi({
				cfg,
				geoParams: this.buildGeoParams(geo, options),   // 性别跟随本次扫描口径
				options,
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
		// 🔴 点选 = 按扫描冻结口径看盘;之后内嵌页改字段仍叠在这张冻结底板上。在 setState 之前置好冻结标记与底板键:
		// 这一次渲染的备忘就按冻结值建、交给 TaiYiMain(此前回调里才钉 —— 那一拍 TaiYiMain 拿到活值、按引用自触发一次活值重排,
		// 与下面按冻结值的那次竞速,扫后改过工作台再点旧结果行时显示盘可能是活值口径)
		this._plotFrozen = true;
		this._fieldsBaseKey = JSON.stringify([text, this.state.geo, this.state.options]);
		this.setState({ pickText: text, searchOpen: false, embedPatch: {}, embedRev: (this.state.embedRev || 0) + 1 }, ()=>{
			// 与 render 交给 TaiYiMain 的同一份(同引用 → 内嵌页按引用的自触发与下面 hook.fun 按同一身份去重)
			const frozen = this.buildFieldsMemo();
			// 先回写工作台口径(tn)到太乙页左栏,再起盘:显示盘/母快照=扫描判定口径。
			this.applyWorkbenchCalibre().then(()=>{
				if(this.taiyiHook && typeof this.taiyiHook.fun === 'function'){
					this.taiyiHook.fun(frozen);
				}
			});
		});
	}

	// 载入方案的打底口径(工作台方案载入):出厂完整缺省,不取会话现值
	zeriFullDefaultOptions(){
		return taiyiZeriFullDefaultOptions();
	}

	// 工作台参数改动(含载入方案 / 历史):其中的页面口径键回写内嵌页(方案里的页面口径 = 存方案时内嵌页的值),
	// 其余进工作台参数 —— 页面键不住在工作台参数里(住了会压住内嵌页左栏当前值)。
	// 载入的方案一个页面键都没带(页面口径进方案之前存的):那时扫描恒按出厂页面口径 → 页面键回出厂值,不沿用内嵌页现值
	// 旧方案 / 历史里的已剔除死键(十精 / 转盘)载入时去掉:既不进工作台、也不写进内嵌页
	onWorkbenchOptionsChange(options, meta){
		const split = splitPageKeys(withoutKeys(options || {}, TAIYI_RETIRED_OPTION_KEYS), TAIYI_PAGE_SCAN_KEYS);
		const rest = split.rest;
		const page = (meta && meta.source === 'scheme' && !Object.keys(split.page).length)
			? pickKeys(TAIYI_PAGE_SETTINGS.defaults(), TAIYI_PAGE_SCAN_KEYS) : split.page;
		const h = this.taiyiHook;
		if(Object.keys(page).length && h && typeof h.applyOptions === 'function'){
			// 回写后按新口径重排内嵌盘(与左栏亲手改同效:左栏显示的口径 = 盘)
			Promise.resolve(h.applyOptions(page)).then(()=>{ if(!this.unmounted){ this.replotEmbedded(); } });
		}
		this.setState({ options: rest });
	}

	// 按当前底板重排内嵌盘
	replotEmbedded(){ const h = this.taiyiHook; if(h && typeof h.fun === 'function'){ h.fun(this.buildFieldsMemo()); } }

	onPageCalibreChange(){
		if(this.unmounted){ return; }
		this.setState((s)=>({ pageCalibreRev: (s.pageCalibreRev || 0) + 1 }));
	}

	// 扫描口径 = 内嵌太乙页当前流派六轴(school) + 工作台 tn:
	// 此前扫描恒默认流派(只变显示盘),流派三轴非默认时 4014/4380 盘判定与所见相反。时基/盘式仍按引擎定谳
	// (钟表时·时计,见 computeTaiyiScanPan 注)。
	// 页面键(zeriPageCalibre.TAIYI_PAGE_SCAN_KEYS)以页面为准;盘式 / 时间基准 / 博弈在择日里锁定(TAIYI_ZERI_LOCKED)。
	effectiveScanOptions(){
		const h = this.taiyiHook;
		let page = null;
		try{ page = (h && typeof h.getOptions === 'function') ? h.getOptions() : null; }catch(e){ page = null; }
		const fromPage = pickKeys(page, TAIYI_PAGE_SCAN_KEYS);
		if(fromPage.school && typeof fromPage.school !== 'object'){ delete fromPage.school; }
		return { ...(this.state.options || {}), ...fromPage };
	}

	// 扫描口径 → 母组件左栏(hook.applyOptions):工作台 tn、页面流派键按冻结值、锁定三键按锁定值;母组件未挂 hook 时静默(旧行为)。
	applyWorkbenchCalibre(){
		const o = this._scanOptions || this.state.options || {};
		const partial = { ...pickKeys(o, TAIYI_PAGE_SCAN_KEYS), ...lockedValuesOf(TAIYI_ZERI_LOCKED) };
		if(o.tn !== undefined && o.tn !== null && `${o.tn}` !== ''){ partial.tn = Number(o.tn); }
		const h = this.taiyiHook;
		return (h && typeof h.applyOptions === 'function' && Object.keys(partial).length) ? h.applyOptions(partial) : Promise.resolve();
	}

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainTaiyiAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo, this._scanOptions || this.state.options),
			options: this._scanOptions || this.state.options || {},
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
		});
	}

	explainRow(row){
		return Promise.resolve(this.explainRowSync(row));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildTaiyiZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
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

	// 宿主自管 fields:pick 时刻+择日地点+扫描口径参数合成 BaZi 标准 fields 形状。
	// 🔴 render 传 TaiYiMain 的 fields 必须走 memo:TaiYiMain 是五被托管主组件中唯一按
	// fields **引用**自触发全量重排的(prevProps.fields !== fields → requestNongli 两次
	// 后端请求+loading 遮罩)——行内新对象=工作台每次 setState(改条件/onProgress tick)
	// 都触发重排风暴(审查实抓)。指纹不变则复用同一引用。
	buildFieldsMemo(){
		const key = this.fieldsMemoKey();
		if(this._fieldsKey !== key){
			// 点选时刻 / 工作台地点口径变了 → 回到活值底板;只是内嵌页改了字段(覆盖层代次变)→ 仍叠在上一次的底板上
			const base = this.fieldsBaseKey();
			if(this._fieldsBaseKey !== base){ this._plotFrozen = false; }
			this._fieldsBaseKey = base;
			this._fieldsKey = key;
			this._fieldsMemo = this.buildFields(!!this._plotFrozen);
		}
		return this._fieldsMemo;
	}

	// frozen=true(pick 起盘):用扫描冻结快照——所见行=所判口径(奇门母本纪律;扫后改
	// 参数再 pick,活值会用新口径起旧结果行的盘,审查实抓)。初排/左栏改动仍走活值。
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
			gender: mkField(this.genderOf(o)),   // 跟随工作台 options.sex
			after23NewDay: mkField(o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay()),
			lateZiHourUseNextDay: mkField(o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : defaultLateZiHourUseNextDay()),
		}, this.state.embedPatch);
	}

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		// 内嵌太乙页按 fields 引用自触发重排(备忘键含覆盖层代次),这里不再调 hook,免双请求
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }));
	}

	// 备忘键:起盘时刻 / 地点 / 工作台口径 / 覆盖层代次
	fieldsMemoKey(){
		return JSON.stringify([this.state.pickText, this.state.geo, this.state.options, this.state.embedRev || 0]);
	}
	fieldsBaseKey(){
		return JSON.stringify([this.state.pickText, this.state.geo, this.state.options]);
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-taiyi-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<TaiYiMain
						onPageCalibreChange={this.onPageCalibreChange}   /* 内嵌页口径变了 → 重算「结果已过期」 */
						fields={this.buildFieldsMemo()}
						hook={this.taiyiHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="taiyizeri"
						zeriLocked={TAIYI_ZERI_LOCKED}   /* 扫描恒时计 / 钟表时 / 不用博弈:内嵌页这三项置灰 */
						dispatch={this.props.dispatch}   /* 存档钮此前在宿主内是死钮(不传 dispatch → openKentangCaseDrawer 早退) */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<TaiyiZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={this.onWorkbenchOptionsChange}
					optionDefaults={taiyiZeriFullDefaultOptions}
					getSchemeOptions={()=>this.effectiveScanOptions()}   /* 方案连内嵌页的页面口径键一起存 */
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					previewGeo={this._scanGeo || this.state.geo}   /* 冻结地点:概览口径=扫描口径 */
					previewOptions={this._scanOptions || this.state.options}   /* 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewPan={(d, t)=>computeTaiyiScanPan(this.buildGeoParams(this._scanGeo || this.state.geo, this._scanOptions || this.effectiveScanOptions()), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t)}
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
