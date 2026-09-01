// [Z8·印度择日] 择日页子技法宿主:内嵌完整 <IndiaChartMain>(fields 单参 hook 驱动,
// 印度页=A 类星盘系无 module 快照槽——挂载走「择时三段自足」:宿主扫描后
// saveModuleAISnapshot('indiazeri', 三段文本),印度盘全文见主印度页,帮助明示)。
// 🔴 扫描=远端 astropy /indiaelectionscan(Muhurta:Panchanga 五肢/Lagna/日凶段/本命组
// Tara·Chandra,分钟粒度);[十二轮] 前端按月分段编排,总范围 ≤5 年(py 93 天限=单段防呆)。本命=工作台直选本命月宿/月座两键(印度页盘面可查)。
import { Component } from 'react';
import IndiaChartMain from '../astro/IndiaChartMain';
import IndiaZeriWorkbench from './IndiaZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newIndiaLeaf, newIndiaGroup, compileIndiaTree } from '../../divination/zeri/indiaZeriConditionTypes';
import { fetchIndiaElectionScan, fetchIndiaElectionExplain } from '../../services/electionScan';
import { runSegmentedRemoteScan } from '../../divination/zeri/scanOrchestrator';
import { buildIndiaZeriSnapshotExtra } from '../../divination/zeri/indiaZeriSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { indiaZeriSchemeStore } from '../../divination/zeri/schemeStore';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newIndiaGroup('all'), children: [newIndiaLeaf('tithi')] };
}
function mkField(v){
	return { value: v };
}
function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}

export default class IndiaZeriMain extends Component{
	constructor(props){
		super(props);
		const today = todayStr();
		const now = new Date();
		const nowText = `${today} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:00`;
		this.state = {
			searchOpen: false,
			pickText: nowText,
			cfg: { startDate: today, startTime: '00:00', endDate: today, endTime: '23:59' },
			geo: { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, pos: '北京' },
			// 远端扫描口径(判别力 pytest 金标证:su28Mode 两档宿界差/nodeType 罗计位差/lilithType 孛位差)
			// 远端扫描口径(判别力 pytest 金标证:ayanamsa 制差/nodeType 罗睺位差);本命两键
			// (natalMoonNak 1-27/natalMoonSign 1-12,0=未设)解锁 Tara/Chandra 本命组。
			options: { ayanamsa: 'lahiri', nodeType: 'mean', natalMoonNak: 0, natalMoonSign: 0 },
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
		this.renderLeftExtra = this.renderLeftExtra.bind(this);
		this.runSearch = this.runSearch.bind(this);
		this.cancelScan = this.cancelScan.bind(this);
		this.onPickInterval = this.onPickInterval.bind(this);
		this.explainRow = this.explainRow.bind(this);
		this.onGeoChange = this.onGeoChange.bind(this);
		this.composeAiSnapshot = this.composeAiSnapshot.bind(this);
	}

	componentDidMount(){
		this.requestChartAndPlot();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 印度页 fields 单参 hook 驱动(无 chartObj 需求):pick 后直接重排。
	requestChartAndPlot(frozen){
		if(this.indiaHook && typeof this.indiaHook.fun === 'function'){
			this.indiaHook.fun(this.buildFields(frozen));
		}
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="印度择日"
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
		const nak = Number(o.natalMoonNak) || 0;
		const sign = Number(o.natalMoonSign) || 0;
		if(nak > 0 || sign > 0){
			payload.natal = {};
			if(nak > 0){ payload.natal.moonNak = nak; }
			if(sign > 0){ payload.natal.moonSign = sign - 1; }	// 后端 0..11
		}
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
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({ scanning: true, results: null, truncated: false, scanErr: '', scanEpoch: this.state.scanEpoch + 1, scanProgress: null });
		try{
			const out = await runSegmentedRemoteScan({
				payload: this.buildScanPayload(compiled),
				fetchFn: fetchIndiaElectionScan,
				signal: this._abort.signal,
				onProgress: (p)=>{ if(!this.unmounted){ this.setState({ scanProgress: p }); } },
			});
			if(this.unmounted){
				return;
			}
			// durationMin:后端 start/end 是扫描 zone 的墙钟串——按 UTC 假定手动差分
			// (本机处 DST 时区且区间跨换令时刻,new Date 字符串解析会偏 ±60 分,审查实抓);
			// pickEnd=end 内缩 1 分钟(边界分钟是判定翻转瞬间,本地引擎同律;恰在边界起盘
			// 可能落界外侧出上一时辰盘)。
			const wallMs = (s)=>{
				const m = /^(-?\d+)-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(`${s}`);
				return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : NaN;
			};
			const fmtWall = (ms)=>{
				const d = new Date(ms);
				const p2 = (n)=>(n < 10 ? `0${n}` : `${n}`);
				return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
			};
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
				// [Z8] 挂载自足:印度页无 module 快照槽,择时三段由宿主直写(indiazeri 槽)
				try{ saveModuleAISnapshot('indiazeri', this.composeAiSnapshot('') || ''); }catch(e2){ /* 静默 */ }
			});
		}catch(e){
			if(this.unmounted){
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
		this.setState({ pickText: text, searchOpen: false }, ()=>{
			this.requestChartAndPlot(true);
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
			gender: mkField(1),
			timeAlg: mkField(1),
			name: mkField('印度择日'),
			// canBuildIndiaChartParams 必需四键(缺则 Dasha/分盘请求静默不发——真机实抓)
			tradition: mkField(1),
			strongRecption: mkField(0),
			simpleAsp: mkField(0),
			virtualPointReceiveAsp: mkField(0),
		};
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			<div className="horosa-zeri-india-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<IndiaChartMain
					fields={this.buildFields()}
					hook={this.indiaHook}
					height={this.props.height}
					renderLeftExtra={this.renderLeftExtra}
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
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
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
