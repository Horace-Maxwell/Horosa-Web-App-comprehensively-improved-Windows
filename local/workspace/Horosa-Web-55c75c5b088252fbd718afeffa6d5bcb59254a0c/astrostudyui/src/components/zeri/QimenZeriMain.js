// [奇门择日] 择日页子技法宿主:内嵌完整 <DunJiaMain>(techniqueScope='qimenzeri',左栏选项/中栏盘/
// 右栏五页签/法奇门/保存全数复用,显示路由与独立奇门页按构造恒等),左栏经 renderLeftExtra 插
// 「择日」入口,弹出找局工作台(QimenZeriWorkbench);扫描走纯本地 qimenScanEngine,pick 命中时刻
// 经 ref.applyExternalPlot 回写主盘标准链重排。
// 快照冻结纪律(天星同款):找局瞬间冻结 _scanCfg/_scanGeo/_scanOptions/_scanTree/_scanSeeds,
// 结果行跳盘/判读/概览恒用冻结值,不受此后面板改动影响;_scanUiJson 指纹驱动 resultsStale 黄条。
import { Component } from 'react';
import DunJiaMain from '../dunjia/DunJiaMain';
import QimenZeriWorkbench from './QimenZeriWorkbench';
import { XQButton, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import DateTime from '../comp/DateTime';
import { getStore } from '../../utils/storageutil';
import { caseApplySeqSuffix } from '../../utils/kentangCaseSave';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newQimenLeaf, newQimenGroup, compileQimenTree } from '../../divination/zeri/qimenConditionTypes';
import { scanQimen, explainQimenAt, buildQimenScanSeeds } from '../../divination/zeri/qimenScanEngine';
import { buildQimenZeriSnapshotExtra } from '../../divination/zeri/qimenZeriSnapshot';
import { qimenZeriSchemeStore } from '../../divination/zeri/schemeStore';
// [Windows-only] horosa_panel_ready_v1(P5):奇门分册找局的「画完」观测钉(键=顶层页签 'zeri',
// 与天星分册同键 —— 观测按页配对,分册切换不换键)。
import { markPanelReady } from '../../utils/perfMark';

function initialTree(){
	return { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
}

export default class QimenZeriMain extends Component{
	constructor(props){
		super(props);
		const now = new DateTime();
		const today = now.format ? now.format('YYYY-MM-DD') : '';
		this.state = {
			searchOpen: false,
			cfg: { startDate: today, startTime: '00:00', endDate: today, endTime: '23:59' },
			geo: null,            // {zone,lat,lon,gpsLat,gpsLon,pos,ad} 首开播种自主盘,可在工作台改
			draftOptions: null,   // 22 参数草稿:开工作台时播种自主盘左栏,亦随左栏改动镜像(P7)
			tree: initialTree(),
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		this.dunjiaRef = null;
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanSeeds = null;
		this._scanUiJson = '';
		this.lastRestoredCaseId = null;
		this.captureDunjia = this.captureDunjia.bind(this);
		this.renderLeftExtra = this.renderLeftExtra.bind(this);
		this.openSearch = this.openSearch.bind(this);
		this.runSearch = this.runSearch.bind(this);
		this.cancelScan = this.cancelScan.bind(this);
		this.onPickInterval = this.onPickInterval.bind(this);
		this.explainRow = this.explainRow.bind(this);
		this.onGeoChange = this.onGeoChange.bind(this);
		this.onDraftOptionsChange = this.onDraftOptionsChange.bind(this);
		this.onBoardOptionsChange = this.onBoardOptionsChange.bind(this);
		this.reloadFromBoard = this.reloadFromBoard.bind(this);
		this.composeAiSnapshot = this.composeAiSnapshot.bind(this);
		this.casePayloadExtra = this.casePayloadExtra.bind(this);
	}

	componentDidMount(){
		this.restoreWorkbenchFromCase();
	}

	componentDidUpdate(){
		this.restoreWorkbenchFromCase();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	captureDunjia(inst){
		this.dunjiaRef = inst;
	}

	// 事盘重开:DunJiaMain(scope 过滤)自还原 options/相关人员;这里补还原工作台态 payload.zeri。
	restoreWorkbenchFromCase(){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		if(caseType !== 'qimenzeri' && sourceModule !== 'qimenzeri'){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		// 载入代次后缀走共用件(kentangCaseSave.caseApplySeqSuffix):不带它则同一条记录第二次载入
		// 会被下面那道去重守卫拦掉,屏幕上仍是用户后来新起的卦。禁另抄一份。
		const caseVersion = `${cid}|${updateTime}${caseApplySeqSuffix(userState)}`;
		if(this.lastRestoredCaseId === caseVersion){
			return;
		}
		this.lastRestoredCaseId = caseVersion;
		let payload = currentCase.payload ? currentCase.payload.value : null;
		if(typeof payload === 'string'){
			try{
				payload = JSON.parse(payload);
			}catch(e){
				payload = null;
			}
		}
		const zeri = payload && payload.zeri && typeof payload.zeri === 'object' ? payload.zeri : null;
		if(!zeri){
			return;
		}
		const next = {};
		if(zeri.cfg && zeri.cfg.startDate){ next.cfg = { ...this.state.cfg, ...zeri.cfg }; }
		if(zeri.geo){ next.geo = { ...zeri.geo }; }
		if(zeri.options){ next.draftOptions = { ...zeri.options }; }
		if(zeri.tree && Array.isArray(zeri.tree.children)){ next.tree = zeri.tree; }
		if(Array.isArray(zeri.results)){
			next.results = zeri.results;
			next.truncated = !!zeri.truncated;
		}
		this.setState(next);
	}

	// 首开播种 + 「从主盘重载」:时空与 22 参数取自内嵌 DunJiaMain 当前左栏(genParams 同链)。
	seedFromBoard(force){
		if(!this.dunjiaRef || typeof this.dunjiaRef.getScanContext !== 'function'){
			return;
		}
		const ctx = this.dunjiaRef.getScanContext();
		const params = ctx && ctx.params ? ctx.params : null;
		const next = {};
		if(params && (force || !this.state.geo)){
			next.geo = {
				zone: params.zone,
				lat: params.lat,
				lon: params.lon,
				gpsLat: params.gpsLat,
				gpsLon: params.gpsLon,
				ad: params.ad,
				pos: ctx.fields && ctx.fields.pos && ctx.fields.pos.value ? ctx.fields.pos.value : '',
			};
		}
		if(ctx && ctx.options && (force || !this.state.draftOptions)){
			next.draftOptions = { ...ctx.options };
		}
		if(Object.keys(next).length){
			this.setState(next);
		}
	}

	openSearch(){
		this.seedFromBoard(false);
		this.setState({ searchOpen: true });
	}

	reloadFromBoard(){
		this.seedFromBoard(true);
	}

	// P7 镜像:左栏「起盘选项」改动实时刷新工作台参数草稿(工作台开着时用户改左栏=罕见路径,后写胜)。
	onBoardOptionsChange(options){
		if(this.unmounted){
			return;
		}
		this.setState({ draftOptions: { ...options } });
	}

	onDraftOptionsChange(options){
		this.setState({ draftOptions: { ...options } });
	}

	onGeoChange(rec){
		if(!rec){
			return;
		}
		// GeoCoordModal 原始 rec(gpsLng/lng 键)与方案库归一形({gpsLon,...})双形兼容。
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

	buildGeoParams(geo){
		const g = geo || {};
		return {
			zone: g.zone !== undefined && g.zone !== null ? g.zone : '+08:00',
			lon: g.lon,
			lat: g.lat,
			gpsLon: g.gpsLon,
			gpsLat: g.gpsLat,
			ad: g.ad !== undefined ? g.ad : 1,
			gender: 1,
		};
	}

	currentUiJson(){
		return JSON.stringify({
			cfg: this.state.cfg,
			geo: this.state.geo,
			options: this.state.draftOptions,
			tree: this.state.tree,
		});
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileQimenTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		this.seedFromBoard(false);
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		const options = { ...(this.state.draftOptions || {}) };
		const geoParams = this.buildGeoParams(geo);
		const startYear = parseInt(`${cfg.startDate}`.slice(0, 4), 10);
		const endYear = parseInt(`${cfg.endDate}`.slice(0, 4), 10);
		// 冻结找局快照(跳盘/判读/概览恒用冻结值)
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanSeeds = Number.isFinite(startYear) && Number.isFinite(endYear)
			? buildQimenScanSeeds(startYear, endYear, geoParams.zone)
			: {};
		this._scanUiJson = this.currentUiJson();
		try{
			qimenZeriSchemeStore.pushHistory({ cfg, geo, options }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断找局
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
			const res = await scanQimen({
				cfg,
				geoParams,
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
			// horosa_panel_ready_v1:三个终态 settle(命中/取消/失败)都收口 —— 取消与失败也算
			// 「本次交互到此为止」,不记会让该次找局永远配不上对(与遁甲 pan=null 口径一致)。
			this.setState({ scanning: false, progress: null, results: res.intervals, truncated: res.truncated }, ()=>{ markPanelReady('zeri'); });
		}catch(e){
			if(this.unmounted){
				return;
			}
			if(e && e.name === 'AbortError'){
				this.setState({ scanning: false, progress: null }, ()=>{ markPanelReady('zeri'); });
			}else{
				this.setState({ scanning: false, progress: null, scanErr: (e && e.message) || '找局失败' }, ()=>{ markPanelReady('zeri'); });
			}
		}
	}

	cancelScan(){
		if(this._abort){
			this._abort.abort();
		}
	}

	// 点击结果行:命中时刻 + 找局冻结的地点/参数,经 applyExternalPlot 回写主盘标准链重排,关工作台看盘。
	onPickInterval(row, which){
		if(!this.dunjiaRef || typeof this.dunjiaRef.applyExternalPlot !== 'function'){
			return;
		}
		const geo = this._scanGeo || this.state.geo || {};
		const zone = geo.zone !== undefined && geo.zone !== null ? geo.zone : '+08:00';
		const dt = new DateTime();
		if(dt.setZone){
			dt.setZone(zone);
		}
		const raw = (which === 'end' ? (row.pickEnd || row.end) : (row.pick || row.start)) || row.start;
		const text = raw.length === 16 ? `${raw}:00` : raw;
		const parsed = dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : null;
		if(!parsed){
			return;
		}
		const patch = {
			date: parsed,
			time: parsed.clone ? parsed.clone() : parsed,
			ad: parsed.ad,
			zone,
			options: { ...(this._scanOptions || this.state.draftOptions || {}) },
		};
		if(geo.gpsLon !== undefined && geo.gpsLon !== null){
			patch.gpsLon = geo.gpsLon;
			patch.gpsLat = geo.gpsLat;
			patch.lon = geo.lon !== undefined && geo.lon !== null ? geo.lon : convertLonToStr(geo.gpsLon);
			patch.lat = geo.lat !== undefined && geo.lat !== null ? geo.lat : convertLatToStr(geo.gpsLat);
			if(geo.pos){
				patch.pos = geo.pos;
			}
		}
		this.dunjiaRef.applyExternalPlot(patch);
		this.setState({ searchOpen: false });
	}

	explainRow(row){
		return Promise.resolve(explainQimenAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: this._scanOptions || this.state.draftOptions || {},
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
			jieqiYearSeeds: this._scanSeeds,
		}));
	}

	// P5 composer:奇门全文快照之后拼「择日三段」(段头与 aiExport preset 🔒逐字成对)。
	composeAiSnapshot(baseText){
		try{
			const extra = buildQimenZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
				options: this._scanOptions || this.state.draftOptions,
				tree: this.state.tree,
				results: this.state.results,
				truncated: this.state.truncated,
			});
			return extra ? `${baseText}\n\n${extra}` : baseText;
		}catch(e){
			return baseText;
		}
	}

	// P6 事盘附加负载:工作台态随事盘存档,重开经 restoreWorkbenchFromCase 还原(命中行截 200 防超载)。
	casePayloadExtra(){
		return {
			zeri: {
				version: 1,
				cfg: { ...this.state.cfg },
				geo: this.state.geo ? { ...this.state.geo } : null,
				options: this.state.draftOptions ? { ...this.state.draftOptions } : null,
				tree: JSON.parse(JSON.stringify(this.state.tree)),
				results: Array.isArray(this.state.results) ? this.state.results.slice(0, 200) : null,
				truncated: !!this.state.truncated,
			},
		};
	}

	renderLeftExtra(){
		return (
			<XQSideSection iconName={sideSectionIcon('search')} title="择日" collapsible={false}>
				<div style={{ padding: '4px 0' }}>
					<XQButton type="primary" style={{ width: '100%' }} onClick={this.openSearch}>
						奇门择日…
					</XQButton>
					<div className="horosa-divi-note" style={{ marginTop: 6 }}>
						工作台内选时间范围/地点/参数与格局·盘面条件,逐时辰找局,结果点击即起盘。
					</div>
				</div>
			</XQSideSection>
		);
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		const previewCtx = this._scanOptions ? {
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: this._scanOptions,
			seeds: this._scanSeeds || {},
		} : null;
		return (
			// rail(xq-tabs)的 tabpane 是 flex 容器:宿主必须显式撑满,否则按内容宽收缩、右侧留大空带
			// (真机圈报:占位/盘面被挤成 1122px 窄条;天星壳自带撑满声明故无此病)。
			<div className="horosa-zeri-qimen-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0 }}>
				<DunJiaMain
					ref={this.captureDunjia}
					fields={this.props.fields}
					height={this.props.height}
					dispatch={this.props.dispatch}
					value={this.props.chart}
					techniqueScope="qimenzeri"
					caseEventPrefix="奇门择日"
					showQuickDock={false}
					composeAiSnapshot={this.composeAiSnapshot}
					casePayloadExtra={this.casePayloadExtra}
					onOptionsChange={this.onBoardOptionsChange}
					renderLeftExtra={this.renderLeftExtra}
				/>
				<QimenZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.draftOptions || {}}
					onOptionsChange={this.onDraftOptionsChange}
					onReloadFromBoard={this.reloadFromBoard}
					tree={this.state.tree}
					onTreeChange={(tree)=>this.setState({ tree })}
					onRun={this.runSearch}
					onCancelScan={this.cancelScan}
					onPickInterval={this.onPickInterval}
					onExplain={this.explainRow}
					previewCtx={previewCtx}
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
