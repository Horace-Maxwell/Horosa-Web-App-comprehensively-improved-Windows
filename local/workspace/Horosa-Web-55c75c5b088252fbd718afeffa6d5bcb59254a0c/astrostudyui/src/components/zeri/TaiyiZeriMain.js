// [Z3·太乙择日] 择日页子技法宿主:内嵌完整 <TaiYiMain>(techniqueScope='taiyizeri' 独立
// 快照槽,与主太乙页 keep-alive 并存互不竞写)。宿主自管 fields
// (左栏入口板块经 renderLeftExtra 插槽进 TaiYiMain 左栏最顶),pick 后 hook.fun 重排。
// 快照冻结纪律(天星/奇门/黄历同款):_scanCfg/_scanGeo/_scanOptions/_scanTree/_scanNatal;
// _scanUiJson 指纹驱动 resultsStale。
import { Component } from 'react';
import TaiYiMain from '../taiyi/TaiYiMain';
import TaiyiZeriWorkbench from './TaiyiZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newTaiyiLeaf, newTaiyiGroup, compileTaiyiTree } from '../../divination/zeri/taiyiZeriConditionTypes';
import { scanTaiyi, explainTaiyiAt, computeTaiyiScanPan } from '../../divination/zeri/taiyiZeriScanEngine';
import { buildTaiyiZeriSnapshotExtra } from '../../divination/zeri/taiyiZeriSnapshot';
import { taiyiZeriSchemeStore } from '../../divination/zeri/schemeStore';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newTaiyiGroup('all'), children: [newTaiyiLeaf('geju_kind')] };
}
function mkField(v){
	return { value: v };
}
function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}


export default class TaiyiZeriMain extends Component{
	constructor(props){
		super(props);
		const today = todayStr();
		const now = new Date();
		const nowText = `${today} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:00`;
		this.state = {
			searchOpen: false,
			pickText: nowText,	// 当前起盘时刻(左栏入口板块显示;pick 改它)
			cfg: { startDate: today, startTime: '00:00', endDate: today, endTime: '23:59' },
			geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, pos: '北京' },
			options: { tn: 0 },	// 🔴 仅 tn 有判别力(换日/晚子时/tenching 对太乙判定面零效果——积数按绝对时辰序列,2026-08-28 dump 实证三档同盘,死开关铁律不入参数区)
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

	currentUiJson(){
		return JSON.stringify({ cfg: this.state.cfg, geo: this.state.geo, options: this.state.options, tree: this.state.tree });
	}

	// [Q-585/T-?] 性别跟随工作台口径 options.sex(1=男 / 0=女):此前写死 1,内嵌太乙页左栏一改性别,
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
				geoParams: this.buildGeoParams(geo, options),   // [Q-585] 性别跟随本次扫描口径
				options,
				tree: compiled,
				signal: this._abort.signal,
				onProgress: (p)=>{
					if(this.unmounted){
						return;
					}
					this.setState({ progress: p, results: p.partial && p.partial.length ? p.partial : this.state.results });
				},
			});
			if(this.unmounted){
				return;
			}
			this.setState({ scanning: false, progress: null, results: res.intervals, truncated: res.truncated });
		}catch(e){
			if(this.unmounted){
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
		this.setState({ pickText: text, searchOpen: false }, ()=>{
			// 🔴 pick 后把 memo 钉成同一份冻结 fields:pickText 变→memo 键变→render 新引用
			// →TaiYiMain 按引用自触发**活值**重排,与下面 hook.fun(冻结值)竞速——扫后改过
			// 参数再 pick 时后到者胜,冻结口径被活值盘覆盖+恒双请求(复审 F4)。钉引用后
			// render 复用冻结份=零自触发;用户此后改左栏参数→键变→正常活值重排。
			const frozen = this.buildFields(true);
			this._fieldsKey = JSON.stringify([this.state.pickText, this.state.geo, this.state.options]);
			this._fieldsMemo = frozen;
			// [挂载自检 F-37] 先回写工作台口径(tn)到太乙页左栏,再起盘:显示盘/母快照=扫描判定口径。
			this.applyWorkbenchCalibre().then(()=>{
				if(this.taiyiHook && typeof this.taiyiHook.fun === 'function'){
					this.taiyiHook.fun(frozen);
				}
			});
		});
	}

	// [Q-268/T-261] 扫描口径 = 内嵌太乙页当前流派六轴(school)/十精(tenching)/转盘(rotation) + 工作台 tn:
	// 此前扫描恒默认流派(只变显示盘),流派三轴非默认时 4014/4380 盘判定与所见相反。时基/盘式仍按引擎定谳
	// (钟表时·时计,见 computeTaiyiScanPan 注)。
	effectiveScanOptions(){
		const h = this.taiyiHook;
		let page = null;
		try{ page = (h && typeof h.getOptions === 'function') ? h.getOptions() : null; }catch(e){ page = null; }
		const fromPage = {};
		if(page && typeof page === 'object'){
			if(page.school && typeof page.school === 'object'){ fromPage.school = { ...page.school }; }
			if(page.tenching !== undefined && page.tenching !== null){ fromPage.tenching = page.tenching; }
			if(page.rotation !== undefined && page.rotation !== null){ fromPage.rotation = page.rotation; }
		}
		return { ...fromPage, ...(this.state.options || {}) };
	}

	// [挂载自检 F-37] 工作台口径 → 母组件左栏(hook.applyOptions);母组件未挂 hook 时静默(旧行为)。
	applyWorkbenchCalibre(){
		const o = this._scanOptions || this.state.options || {};
		const partial = {};
		if(o.tn !== undefined && o.tn !== null && `${o.tn}` !== ''){ partial.tn = Number(o.tn); }
		const h = this.taiyiHook;
		return (h && typeof h.applyOptions === 'function' && Object.keys(partial).length) ? h.applyOptions(partial) : Promise.resolve();
	}

	// [Q-453] 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainTaiyiAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo, this._scanOptions || this.state.options),   // [Q-585]
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
				explainAt: (row)=>this.explainRowSync(row),   // [Q-453] 前 N 行判读树(全局可配)
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
		const key = JSON.stringify([this.state.pickText, this.state.geo, this.state.options]);
		if(this._fieldsKey !== key){
			this._fieldsKey = key;
			this._fieldsMemo = this.buildFields();
		}
		return this._fieldsMemo;
	}

	// frozen=true(pick 起盘):用扫描冻结快照——所见行=所判口径(奇门母本纪律;扫后改
	// 参数再 pick,活值会用新口径起旧结果行的盘,审查实抓)。初排/左栏改动仍走活值。
	buildFields(frozen){
		const t = mkDT(this.state.pickText);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const o = (frozen && this._scanOptions) || this.state.options || {};
		return {
			date: mkField(t),
			time: mkField(t.clone ? t.clone() : t),
			ad: mkField(1),
			zone: mkField(geo.zone !== undefined ? geo.zone : '+08:00'),
			lon: mkField(geo.lon),
			lat: mkField(geo.lat),
			gpsLat: mkField(geo.gpsLat),
			gpsLon: mkField(geo.gpsLon),
			pos: mkField(geo.pos || ''),
			gender: mkField(this.genderOf(o)),   // [Q-585] 跟随工作台 options.sex
			after23NewDay: mkField(o.after23NewDay !== undefined ? o.after23NewDay : 0),
			lateZiHourUseNextDay: mkField(o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : 1),
		};
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-taiyi-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<TaiYiMain
						fields={this.buildFieldsMemo()}
						hook={this.taiyiHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="taiyizeri"
						dispatch={this.props.dispatch}   /* [挂载自检 F-36] 存档钮此前在宿主内是死钮(不传 dispatch → openKentangCaseDrawer 早退) */
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
					onOptionsChange={(options)=>this.setState({ options })}
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					previewGeo={this._scanGeo || this.state.geo}   /* [Q-271/ZC-22] 冻结地点:概览口径=扫描口径 */
					previewOptions={this._scanOptions || this.state.options}   /* [Q-271/ZC-22] 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewPan={(d, t)=>computeTaiyiScanPan(this.buildGeoParams(this._scanGeo || this.state.geo, this._scanOptions || this.effectiveScanOptions()), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t)}   /* [Q-585] */
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
