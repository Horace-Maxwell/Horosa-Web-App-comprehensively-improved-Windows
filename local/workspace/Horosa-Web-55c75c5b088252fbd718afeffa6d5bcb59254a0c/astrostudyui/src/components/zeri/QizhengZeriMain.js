// [Z7·七政择日] 择日页子技法宿主:内嵌完整 <GuoLaoChartMain>(techniqueScope='qizhengzeri'
// 独立快照槽,与主七政页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进七政左栏最顶),pick 后 /chart+七政链重排(后端显示)。
// 🔴 扫描=远端 astropy /qizhengelectionscan(swisseph 直连分钟粒度;判定表 guolao_const↔
// guolaoData 成对同源);93 天限单请求,结果区间分钟级(与本地时辰引擎族不同形)。
import { Component } from 'react';
import GuoLaoChartMain from '../guolao/GuoLaoChartMain';
import QizhengZeriWorkbench from './QizhengZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newQizhengLeaf, newQizhengGroup, compileQizhengTree } from '../../divination/zeri/qizhengZeriConditionTypes';
import { fetchQizhengElectionScan, fetchQizhengElectionExplain } from '../../services/electionScan';
import { runSegmentedRemoteScan } from '../../divination/zeri/scanOrchestrator';
import { buildQizhengZeriSnapshotExtra } from '../../divination/zeri/qizhengZeriSnapshot';
import { qizhengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { fetchChart } from '../../services/astro';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newQizhengGroup('all'), children: [newQizhengLeaf('dignity')] };
}
function mkField(v){
	return { value: v };
}
function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}

export default class QizhengZeriMain extends Component{
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
			options: { su28Mode: 2, nodeType: 'mean', lilithType: 'mean' },
			tree: initialTree(),
			chartValue: null,
			scanning: false,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		this.qizhengHook = {};
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

	// 拉 /chart 底盘并触发七政重排(GuoLaoChartMain hook.fun(fields, chartObj) 双参,
	// 与六壬/三式宿主同律;chart 断链时盘区留空,远端扫描不受影响)。
	requestChartAndPlot(frozen){
		const fields = this.buildFields(frozen);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const dt = fields.date.value;
		const param = {
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
			name: '七政择日',
			cid: null,
		};
		// 代际号:连续两次 pick(或初排与 pick 竞争)后到者胜——旧响应静默丢弃(乱序覆盖实抓)
		const epoch = (this._chartEpoch = (this._chartEpoch || 0) + 1);
		fetchChart(param, { silent: true }).then((rsp)=>{
			if(this.unmounted || epoch !== this._chartEpoch || !rsp || !rsp.Result || !rsp.Result.params){
				return;
			}
			const Result = rsp.Result;
			Result.chartId = `qzz${Date.now().toString(36)}`;
			this.setState({ chartValue: Result }, ()=>{
				if(this.qizhengHook && typeof this.qizhengHook.fun === 'function'){
					// 🔴 用发起本次请求的同一份 fields(曾现取活值配旧 Result=fields/底盘错配)
					this.qizhengHook.fun(fields, Result);
				}
			});
		}).catch(()=>{ /* 后端不可达:盘区留空 */ });
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="七政择日"
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
		return {
			startDate: cfg.startDate,
			startTime: `${cfg.startTime || '00:00'}:00`,
			endDate: cfg.endDate,
			endTime: `${cfg.endTime || '23:59'}:59`,
			zone: geo.zone !== undefined ? geo.zone : '+08:00',
			gpsLat: geo.gpsLat,
			gpsLon: geo.gpsLon,
			su28Mode: o.su28Mode !== undefined ? o.su28Mode : 2,
			nodeType: o.nodeType || 'mean',
			lilithType: o.lilithType || 'mean',
			conditions: compiled,
		};
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileQizhengTree(this.state.tree);
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
			qizhengZeriSchemeStore.pushHistory({ cfg, geo, options }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断
		}
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({ scanning: true, results: null, truncated: false, scanErr: '', scanProgress: null, scanEpoch: this.state.scanEpoch + 1 });
		try{
			const out = await runSegmentedRemoteScan({
				payload: this.buildScanPayload(compiled),
				fetchFn: fetchQizhengElectionScan,
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
				// [D5] 降级自足:kinastro 档/chart 断链下 GuoLaoChartMain 产不出基底文本,
				// compose 不可达 → 'qizhengzeri' 槽恒空(扫出结果导出却报无内容,审查实抓)。
				// 扫描完成即直写三段版兜底;主链正常时后续重排懒存(compose 包基底)覆写成全版。
				try{ saveModuleAISnapshot('qizhengzeri', this.composeAiSnapshot('') || ''); }catch(e2){ /* 静默 */ }
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
		return fetchQizhengElectionExplain(payload).then((r)=>({
			tree: r.tree,
		}));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildQizhengZeriSnapshotExtra({
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
			// 七政 fieldsToParams/GuoLaoInput 消费全键(缺则 undefined.value 红屏——真机两连抓;
			// 值=主页默认档,grep 两文件 fields.<k>.value 全集补齐)
			name: mkField('七政择日'),
			tradition: mkField(1),
			strongRecption: mkField(0),
			simpleAsp: mkField(0),
			virtualPointReceiveAsp: mkField(0),
			doubingSu28: mkField(2),
			guolaoAyanamsa: mkField(''),
			guolaoBodyMode: mkField('taiyin'),
			guolaoEqTropicalAnchor: mkField('dongzhi'),
			guolaoGufaPrecess: mkField(0),
			guolaoLifeMasterMode: mkField('gong'),
			guolaoLifeMode: mkField('asc'),
			guolaoLilithType: mkField('mean'),
			guolaoMinorLimitType: mkField('minor'),
			guolaoNodeMode: mkField('north_ketu'),
			guolaoNodeType: mkField('mean'),
			guolaoTongxianBase: mkField('tong10'),
			guolaoTrueSolarTime: mkField('true'),
			guolaoTuibianMethod: mkField('jiyuan'),
			houseStartMode: mkField(0),
			szshape: mkField(0),
			after23NewDay: mkField(1),
			lateZiHourUseNextDay: mkField(1),
		};
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			<div className="horosa-zeri-qizheng-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<GuoLaoChartMain
						value={this.state.chartValue}
						fields={this.buildFields()}
						hook={this.qizhengHook}
						height={this.props.height}
						techniqueScope="qizhengzeri"
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<QizhengZeriWorkbench
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
