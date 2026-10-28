// 择日页子技法宿主:内嵌完整 <IndiaChartMain>(fields 单参 hook 驱动,
// 印度页=A 类星盘系无 module 快照槽——挂载走「择时三段自足」:宿主扫描后
// refreshZeriSlot(宿主,'indiazeri') 写三段文本,印度盘全文见主印度页,帮助明示)。
// 🔴 扫描=远端 astropy /indiaelectionscan(Muhurta:Panchanga 五肢/Lagna/日凶段/本命组
// Tara·Chandra,分钟粒度);前端按月分段编排,总范围 ≤5 年(py 93 天限=单段防呆)。本命=工作台直选本命月宿/月座两键(印度页盘面可查)。
import { Component } from 'react';
import { readGlobalZeriSnapshotExplainRows } from '../../utils/zeriSnapshotPrefs';
import { zeriCaseSnapshotText, refreshZeriSlot, restoreZeriWorkbenchFromCase, buildZeriCasePayload, beginScanRun, scanRunIsCurrent, plottedFieldsOf, canonicalJson } from './zeriCaseRestore';
import IndiaChartMain from '../astro/IndiaChartMain';
import { INDIA_ZERI_LOCKED, indiaWorkbenchToPage, lockedValuesOf, zeriRestoredLockMarks } from '../../divination/zeri/zeriPageCalibre';
import IndiaZeriWorkbench, { indiaWorkbenchParamFields } from './IndiaZeriWorkbench';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newIndiaLeaf, newIndiaGroup, compileIndiaTree } from '../../divination/zeri/indiaZeriConditionTypes';
import { fetchIndiaElectionScan, fetchIndiaElectionExplain } from '../../services/electionScan';
import { runSegmentedRemoteScan } from '../../divination/zeri/scanOrchestrator';
import { wallTextToMs, msToWallText } from '../../divination/zeri/hourlyScanEngine';
import { buildIndiaZeriSnapshotExtra } from '../../divination/zeri/indiaZeriSnapshot';
import { indiaNatalPayload } from '../../divination/zeri/indiaZeriNatal';
import { indiaZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { mergeEmbedPatch, withEmbedPatch } from '../../utils/scopedFieldsSink';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';

const ZERI_SCOPE = 'indiazeri';
const ZERI_LABEL = '印度择日';

function initialTree(){
	return { ...newIndiaGroup('all'), children: [newIndiaLeaf('tithi')] };
}

// 工作台缺省参数(远端扫描口径 + 本命两键 0 = 未设)
export function indiaZeriDefaultOptions(){
	return { ayanamsa: 'lahiri', nodeType: 'mean', natalMoonNak: 0, natalMoonSign: 0 };
}
// 完整口径(工作台全部参数的出厂值;构造 / 载入存案 / 载入方案三处共用,见 zeriOptionDefaults)
export function indiaZeriFullDefaultOptions(){
	return buildFullDefaults(indiaWorkbenchParamFields(), indiaZeriDefaultOptions());
}

export default class IndiaZeriMain extends Component{
	constructor(props){
		super(props);
		const today = todayStr();
		const now = new Date();
		const nowText = `${today} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:00`;
		this.state = {
			searchOpen: false,
			embedPatch: {},	// 内嵌页左栏亲手改的字段:只进本宿主,不写主盘(见 utils/scopedFieldsSink)
			embedRev: 0,
			pickText: nowText,
			cfg: { startDate: today, startTime: '00:00', endDate: today, endTime: '23:59' },
			geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, pos: '北京' },
			// 远端扫描口径(判别力 pytest 金标证:su28Mode 两档宿界差/nodeType 罗计位差/lilithType 孛位差)
			// 远端扫描口径(判别力 pytest 金标证:ayanamsa 制差/nodeType 罗睺位差);本命两键
			// (natalMoonNak 1-27/natalMoonSign 1-12,0=未设)解锁 Tara/Chandra 本命组。
			options: indiaZeriFullDefaultOptions(),
			tree: initialTree(),
			chartValue: null,
			scanning: false,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		this.indiaHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanUiJson = '';
		this.openSearch = this.openSearch.bind(this);
		this.saveCase = this.saveCase.bind(this);
		this.renderLeftExtra = this.renderLeftExtra.bind(this);
		this.runSearch = this.runSearch.bind(this);
		this.cancelScan = this.cancelScan.bind(this);
		this.onPickInterval = this.onPickInterval.bind(this);
		this.explainRow = this.explainRow.bind(this);
		this.onGeoChange = this.onGeoChange.bind(this);
		this.composeAiSnapshot = this.composeAiSnapshot.bind(this);
		this.onEmbedFieldsChange = this.onEmbedFieldsChange.bind(this);
	}

	componentDidMount(){
		// 先还原存案(命中则还原后重排),没有存案才按当前工作台起盘
		if(!restoreZeriWorkbenchFromCase(this, ZERI_SCOPE)){   // 载入存案还原工作台态
			this.requestChartAndPlot();
		}
	}

	componentDidUpdate(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);
	}

	// 载入存案还原工作台后重排
	replotAfterRestore(){
		this.requestChartAndPlot(false);
	}

	// 载入存案之后(zeriCaseRestore 调):存案覆盖层里带着非锁定值的分宫制(锁定之前存的存案)→ 记下显式标记,内嵌页据此解锁并写明。
	// 只有这里置标记:内嵌页里别的入口(流派预设等)改不出「由存案复原」
	onZeriCaseRestored(){
		const patch = this.state.embedPatch || {};
		const values = {};
		Object.keys(patch).forEach((k)=>{ const v = patch[k]; values[k] = v && typeof v === 'object' && 'value' in v ? v.value : v; });
		this.setState({ zeriRestoredLocks: zeriRestoredLockMarks(INDIA_ZERI_LOCKED, values) });
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 印度页 fields 单参 hook 驱动(无 chartObj 需求):pick 后直接重排。
	// 扫描口径 → 内嵌印度页(hook.applyZeriCalibre;zeriPageCalibre.indiaWorkbenchToPage + INDIA_ZERI_LOCKED)
	applyWorkbenchCalibre(){
		const o = this._scanOptions || this.state.options || {};
		const partial = { ...indiaWorkbenchToPage(o), ...lockedValuesOf(INDIA_ZERI_LOCKED) };
		const h = this.indiaHook;
		return (h && typeof h.applyZeriCalibre === 'function') ? h.applyZeriCalibre(partial) : Promise.resolve();
	}

	requestChartAndPlot(frozen){
		this._plotFrozen = !!frozen;   // 记下底板口径:内嵌页之后改字段按同一底板重排
		this._lastPlotFrozen = !!frozen;   // 所见那张盘的底板口径(存案回退用;render 不改它)
		if(frozen){ this._plotBaseKey = JSON.stringify([this.state.pickText, this.state.geo, this.state.options]); }
		if(this.indiaHook && typeof this.indiaHook.fun === 'function'){
			this.indiaHook.fun(this.buildFields(frozen));
		}
	}

	// 存为事盘:此前本宿主无存档钮 → CASE_TYPE_OPTIONS 登记的「印度择日」事盘类型恒无实例(源层挂载恒无产出)。
	// 快照取本宿主槽(母技法全文+择日三段,母组件经 composeAiSnapshot 存入 scope 槽);缺槽时至少存择日三段。
	// 事盘源层按 payload.module=本 scope 认领 payload.snapshot(与 qimenzeri 同律)。
	saveCase(){
		if(!this.props.dispatch){ return; }
		// 快照 = 页面此刻所见(先请内嵌页按当前盘 + 当前择时结果重存再读;见 zeriCaseSnapshotText)
		const snapshot = zeriCaseSnapshotText(this, ZERI_SCOPE);
		const plotted = plottedFieldsOf(this.indiaHook);   // 所见那张盘实际所用的 fields(取不到 = null,按宿主自己的重建)
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 取不到所见盘时按最后一次实际重排的底板口径重建(_plotFrozen 会在 render 里因底板键变了被置回,不能代表所见那张盘)
			fields: plotted || this.buildFields(this._lastPlotFrozen !== undefined ? !!this._lastPlotFrozen : !!this._plotFrozen),
			module: ZERI_SCOPE,
			label: ZERI_LABEL,
			payload: {
				module: ZERI_SCOPE,
				zeri: buildZeriCasePayload(this, plotted)   /* 补 geo/options/natal/pickText,载入存案可还原工作台与点选时刻 */,
				snapshot,
			},
		});
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="印度择日"
				onSave={this.props.dispatch ? this.saveCase : undefined}
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

	// 载入存案 / 方案的打底口径(zeriCaseRestore / 工作台方案载入):出厂完整缺省,不取会话现值
	zeriFullDefaultOptions(){
		return indiaZeriFullDefaultOptions();
	}

	// 载入存案时还原扫描冻结口径用(zeriCaseRestore):与 runSearch 同一编译器
	compileScanTree(tree){
		return compileIndiaTree(tree);
	}

	// 过期判据的指纹(纯函数):给定一份工作台口径算指纹(规范化序列化,键序不同不误报)。扫描时 / 现在按 currentUiJson,
	// 载入存案按冻结的那一份(zeriCaseRestore.frozenUiJsonOf;绝不按此刻页面现算)
	uiJsonOf(parts){
		const q = parts || {};
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: q.options, tree: q.tree });
	}

	currentUiJson(){
		return this.uiJsonOf(this.state);
	}

	buildScanPayload(compiled, frozen){
		// frozen=true:用扫描时冻结快照(详情判读口径必须=结果口径;扫描后改地点/参数,
		// 详情若吃活值=旧结果配新口径——自查实抓,本地引擎族 _scan* 同律)
		const cfg = (frozen && this._scanCfg) || this.state.cfg;
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const o = (frozen && this._scanOptions) || this.state.options || {};
		const payload = {
			startDate: cfg.startDate,
			startTime: `${cfg.startTime || '00:00'}:00`,
			endDate: cfg.endDate,
			endTime: `${cfg.endTime || '23:59'}:59`,
			zone: geo.zone !== undefined ? geo.zone : '+08:00',
			gpsLat: geo.gpsLat,
			gpsLon: geo.gpsLon,
			ayanamsa: o.ayanamsa || 'lahiri',
			nodeType: o.nodeType || 'mean',
			conditions: compiled,
		};
		const natal = indiaNatalPayload(o.natalMoonNak, o.natalMoonSign);   // 与外部调用同一出处(月座后端 0..11)
		if(natal){ payload.natal = natal; }
		return payload;
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileIndiaTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		const options = { ...(this.state.options || {}) };
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			indiaZeriSchemeStore.pushHistory({ cfg, geo, options }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断
		}
		// 运行代次:扫描途中载入存案会作废这一次(取消 + 推进代次),之后的进度 / 结果 / 收尾都不再写(见 zeriCaseRestore)
		const run = beginScanRun(this);
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({ scanning: true, results: null, truncated: false, scanErr: '', scanEpoch: this.state.scanEpoch + 1, scanProgress: null });
		try{
			const out = await runSegmentedRemoteScan({
				payload: this.buildScanPayload(compiled),
				fetchFn: fetchIndiaElectionScan,
				signal: this._abort.signal,
				onProgress: (p)=>{ if(!this.unmounted && scanRunIsCurrent(this, run)){ this.setState({ scanProgress: p }); } },
			});
			if(this.unmounted || !scanRunIsCurrent(this, run)){
				return;
			}
			// durationMin:后端 start/end 是扫描 zone 的墙钟串——按 UTC 假定手动差分
			// (本机处 DST 时区且区间跨换令时刻,new Date 字符串解析会偏 ±60 分,审查实抓);
			// pickEnd=end 内缩 1 分钟(边界分钟是判定翻转瞬间,本地引擎同律;恰在边界起盘
			// 可能落界外侧出上一时辰盘)。
			const wallMs = (s)=>{
				const m = /^(-?\d+-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(`${s}`);
				return m ? wallTextToMs(`${m[1]} ${m[2]}`) : NaN;   // 墙钟单一来源(0-99 年不走 Date.UTC)
			};
			const fmtWall = msToWallText;   // 年补足 4 位(墙钟单一来源)
			const rows = (out.intervals || []).map((iv)=>{
				const sMs = wallMs(iv.start);
				const eMs = wallMs(iv.end);
				const ok = Number.isFinite(sMs) && Number.isFinite(eMs);
				return {
					start: iv.start,
					end: iv.end,
					pick: iv.pick,
					pickEnd: ok && eMs - sMs > 60000 ? fmtWall(eMs - 60000) : iv.pick,
					startMs: 0,
					endMs: 0,
					durationMin: ok ? Math.max(1, Math.round((eMs - sMs) / 60000)) : 1,
				};
			});
			this.setState({ scanning: false, results: rows, truncated: !!out.truncated }, ()=>{
				// 挂载自足:印度页无 module 快照槽,择时三段由宿主直写(indiazeri 槽)
				refreshZeriSlot(this, 'indiazeri');
				this.prefetchSnapshotExplains(rows);   // 判读树是服务端异步:预取前 N 行后重存本槽快照
			});
		}catch(e){
			if(this.unmounted || !scanRunIsCurrent(this, run)){
				return;
			}
			if(e && e.name === 'AbortError'){
				this.setState({ scanning: false });
			}else{
				this.setState({ scanning: false, scanErr: (e && e.message) || '择时失败' });
			}
		}
	}

	cancelScan(){
		if(this._abort){
			this._abort.abort();
		}
	}

	onPickInterval(row, which){
		const raw = (which === 'end' ? (row.pickEnd || row.end) : (row.pick || row.start)) || row.start;
		const text = raw.length === 16 ? `${raw}:00` : raw;
		// 冻结标记与底板键在 setState 之前置好:这一次渲染就把冻结 fields 交给内嵌页(回调里的起盘再置一次,同值)
		this._plotFrozen = true;
		this._plotBaseKey = JSON.stringify([text, this.state.geo, this.state.options]);
		// 点选 = 回到扫描口径(分宫制回写锁定值):存案复原标记一并清掉
		this.setState({ pickText: text, searchOpen: false, embedPatch: {}, embedRev: (this.state.embedRev || 0) + 1, zeriRestoredLocks: null }, ()=>{
			// 扫描口径回写内嵌印度页(岁差制 / 交点按扫描冻结的工作台值,分宫制按锁定值),再起盘
			this.applyWorkbenchCalibre().then(()=>{ if(!this.unmounted){ this.requestChartAndPlot(true); } });
		});
	}

	// 判读树是服务端异步:扫描完成后预取前 N 行(全局可配,缺省 3=3 次轻量请求),取齐再重存本槽快照;
	// 新一轮扫描 / 卸载作废旧批(epoch)。builder 经 explainAt 读缓存(缺=只列清单,零回归)。
	// 载入存案没带结果时重存一次本槽快照(否则槽里还是上一轮扫描的三段,再存案会把它存进去)
	prefetchSnapshotExplains(rows){
		this._snapshotExplains = null;
		const n = Math.min(readGlobalZeriSnapshotExplainRows(), Array.isArray(rows) ? rows.length : 0);
		const epoch = (this._explainEpoch = (this._explainEpoch || 0) + 1);
		if(!n){ return; }
		Promise.all(rows.slice(0, n).map((r)=>Promise.resolve().then(()=>this.explainRow(r)).catch(()=>null))).then((list)=>{
			if(this.unmounted || epoch !== this._explainEpoch){ return; }
			this._snapshotExplains = list;
			refreshZeriSlot(this, 'indiazeri');
		});
	}

	explainRow(row){
		const payload = this.buildScanPayload(this._scanTree, true);
		payload.t = (row.pick || row.start || '').slice(0, 16);
		return fetchIndiaElectionExplain(payload).then((r)=>({
			tree: r.tree,
		}));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildIndiaZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
				tree: this._scanUiTree || this.state.tree,	// 冻结树:与命中行同源(活树曾致条件描述≠结果,复审 F5)
				results: this.state.results,
				truncated: this.state.truncated,
				explainAt: (row, i)=>(this._snapshotExplains ? this._snapshotExplains[i] || null : null),   // 预取缓存
			});
			return extra ? `${baseText ? `${baseText}\n\n` : ''}${extra}` : baseText;
		}catch(e){
			return baseText;
		}
	}

	// frozen=true(pick 起盘):地点用扫描冻结快照——所见行=所判口径(奇门母本纪律)。
	buildFields(frozen){
		const t = mkDT(this.state.pickText);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
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
			gender: mkField(1),
			timeAlg: mkField(1),
			name: mkField('印度择日'),
			// 工作台岁差制 / 罗计交点随点选起盘进印占显示盘(此前只进扫描:选 Raman 搜得上升白羊,点起盘按 Lahiri 仍双鱼)
			indiaAyanamsa: mkField((((frozen && this._scanOptions) || this.state.options || {}).ayanamsa) || 'lahiri'),
			indiaNodeType: mkField((((frozen && this._scanOptions) || this.state.options || {}).nodeType) === 'true' ? 'true' : 'mean'),
			// canBuildIndiaChartParams 必需四键(缺则 Dasha/分盘请求静默不发——真机实抓)
			tradition: mkField(1),
			strongRecption: mkField(0),
			simpleAsp: mkField(0),
			virtualPointReceiveAsp: mkField(0),
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
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			<div className="horosa-zeri-india-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<IndiaChartMain
					techniqueScope={ZERI_SCOPE}   /* 内嵌实例:选项只改本盘,不记新盘缺省、不写主盘字段 */
					fields={this.buildFields(!!this._plotFrozen)}
					hook={this.indiaHook}
					height={this.props.height}
					dispatch={this.props.dispatch}   /* 宿主此前不传 dispatch:22 项大运流派开关与盘式在宿主内全死(同 T-18 族第四宿主) */
					onScopedFieldsChange={this.onEmbedFieldsChange}
					renderLeftExtra={this.renderLeftExtra}
					zeriLocked={INDIA_ZERI_LOCKED}
					zeriRestoredLocks={this.state.zeriRestoredLocks || null}   /* 载入存案复原来的锁定项(显式标记;见 onZeriCaseRestored) */
				/>
				</div>
			<IndiaZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={(options)=>this.setState({ options })}
					optionDefaults={indiaZeriFullDefaultOptions}
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					previewOptions={this._scanOptions || this.state.options}   /* 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewExplain={this.explainRow}
					previewGeo={this._scanGeo || this.state.geo}
					onTreeChange={(tree)=>this.setState({ tree })}
					onRun={this.runSearch}
					onCancelScan={this.cancelScan}
					onPickInterval={this.onPickInterval}
					onExplain={this.explainRow}
					scanEpoch={this.state.scanEpoch}
					resultsStale={resultsStale}
					scanning={this.state.scanning}
					progress={this.state.scanProgress || null}
					results={this.state.results}
					truncated={this.state.truncated}
					scanErr={this.state.scanErr}
				/>
			</div>
		);
	}
}
