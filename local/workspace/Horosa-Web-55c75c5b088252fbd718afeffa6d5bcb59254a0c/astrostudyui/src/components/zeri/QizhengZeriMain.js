// 择日页子技法宿主:内嵌完整 <GuoLaoChartMain>(techniqueScope='qizhengzeri'
// 独立快照槽,与主七政页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进七政左栏最顶),pick 后 /chart+七政链重排(后端显示)。
// 🔴 扫描=远端 astropy /qizhengelectionscan(swisseph 直连分钟粒度;判定表 guolao_const↔
// guolaoData 成对同源);93 天限单请求,结果区间分钟级(与本地时辰引擎族不同形)。
import { Component } from 'react';
import { readGlobalZeriSnapshotExplainRows } from '../../utils/zeriSnapshotPrefs';
import { zeriCaseSnapshotText, refreshZeriSlot, restoreZeriWorkbenchFromCase, buildZeriCasePayload, beginScanRun, scanRunIsCurrent, plottedFieldsOf, canonicalJson } from './zeriCaseRestore';
import GuoLaoChartMain from '../guolao/GuoLaoChartMain';
import { QIZHENG_ZERI_LOCKED } from '../../divination/zeri/zeriPageCalibre';
import { GUOLAO_AYANAMSA_PAGE_ONLY_KEY } from '../guolao/GuoLaoChartStyle';
import QizhengZeriWorkbench, { qizhengWorkbenchParamFields } from './QizhengZeriWorkbench';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newQizhengLeaf, newQizhengGroup, compileQizhengTree } from '../../divination/zeri/qizhengZeriConditionTypes';
import { fetchQizhengElectionScan, fetchQizhengElectionExplain } from '../../services/electionScan';
import { runSegmentedRemoteScan } from '../../divination/zeri/scanOrchestrator';
import { wallTextToMs, msToWallText } from '../../divination/zeri/hourlyScanEngine';
import { buildQizhengZeriSnapshotExtra } from '../../divination/zeri/qizhengZeriSnapshot';
import { qizhengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { fetchChart } from '../../services/astro';
import { mergeEmbedPatch, withEmbedPatch, chartParamWithEmbedPatch } from '../../utils/scopedFieldsSink';
import { castChartFor } from '../../utils/derivedChartSource';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';

const ZERI_SCOPE = 'qizhengzeri';
const ZERI_LABEL = '七政择日';

function initialTree(){
	return { ...newQizhengGroup('all'), children: [newQizhengLeaf('dignity')] };
}

// 工作台缺省参数(远端扫描口径)
export function qizhengZeriDefaultOptions(){
	return { su28Mode: 2, nodeType: 'mean', lilithType: 'mean' };
}
// 完整口径(工作台全部参数的出厂值;构造 / 载入存案 / 载入方案三处共用,见 zeriOptionDefaults)
export function qizhengZeriFullDefaultOptions(){
	return buildFullDefaults(qizhengWorkbenchParamFields(), qizhengZeriDefaultOptions());
}

export default class QizhengZeriMain extends Component{
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
			options: qizhengZeriFullDefaultOptions(),
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
		// 先还原存案(命中则还原后重排),没有存案才按当前工作台拉底盘
		if(!restoreZeriWorkbenchFromCase(this, ZERI_SCOPE)){   // 载入存案还原工作台态
			this.requestChartAndPlot();
		}
	}

	componentDidUpdate(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);
	}

	// 载入存案还原工作台后按还原后的点选时刻 / 地点重拉底盘重排(此前只在底盘数据换了时才重取)
	replotAfterRestore(){
		this._fieldsMemo = null;
		this._fieldsKey = null;
		this.requestChartAndPlot(false);
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
		// frozen 时优先用 onPickInterval 钉好的那一份(与 render 传给 GuoLaoChartMain 的同一引用),
		// 否则宿主发的是冻结值、内嵌页 genParams() 读的却是 render 活值 → 显示盘与母快照按新口径起旧结果行。
		const fields = this.buildFieldsMemo();   // 底板口径由备忘逻辑定(点选后叠在冻结底板上;工作台改了回到活值)
		const plottedFrozen = !!this._plotFrozen;   // 这份 fields 的底板口径(备忘里可能刚翻成活值)
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
			name: '七政择日',
			cid: null,
		}, this.state.embedPatch);
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
					this._lastPlotFrozen = plottedFrozen;   // 所见那张盘的底板口径(存案用;工作台改了没重排时 memo 已翻成活值)
					// 🔴 用发起本次请求的同一份 fields(曾现取活值配旧 Result=fields/底盘错配)
					this.qizhengHook.fun(fields, Result);
				}
			});
		}).catch(()=>{ /* 后端不可达:盘区留空 */ });
	}

	// 存为事盘:此前本宿主无存档钮 → CASE_TYPE_OPTIONS 登记的「七政择日」事盘类型恒无实例(源层挂载恒无产出)。
	// 快照取本宿主槽(母技法全文+择日三段,母组件经 composeAiSnapshot 存入 scope 槽);缺槽时至少存择日三段。
	// 事盘源层按 payload.module=本 scope 认领 payload.snapshot(与 qimenzeri 同律)。
	saveCase(){
		if(!this.props.dispatch){ return; }
		// 快照 = 页面此刻所见(先请内嵌页按当前盘 + 当前择时结果重存再读;见 zeriCaseSnapshotText)
		const snapshot = zeriCaseSnapshotText(this, ZERI_SCOPE);
		const plotted = plottedFieldsOf(this.qizhengHook);   // 所见那张盘实际所用的 fields(取不到 = null,按宿主自己的重建)
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存案的时间地点 = 所见那张盘(叠过覆盖层;底板按最后一次实际起盘的冻结口径)
			fields: plotted || (this._lastPlotFrozen !== undefined ? this.buildFields(!!this._lastPlotFrozen) : this.buildFieldsMemo()),
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
				label="七政择日"
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
		return qizhengZeriFullDefaultOptions();
	}

	// 载入存案时还原扫描冻结口径用(zeriCaseRestore):与 runSearch 同一编译器
	compileScanTree(tree){
		return compileQizhengTree(tree);
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
		// 运行代次:扫描途中载入存案会作废这一次(取消 + 推进代次),之后的进度 / 结果 / 收尾都不再写(见 zeriCaseRestore)
		const run = beginScanRun(this);
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({ scanning: true, results: null, truncated: false, scanErr: '', scanProgress: null, scanEpoch: this.state.scanEpoch + 1 });
		try{
			const out = await runSegmentedRemoteScan({
				payload: this.buildScanPayload(compiled),
				fetchFn: fetchQizhengElectionScan,
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
				// 扫描完成即重存本槽:内嵌七政页在场且有盘 → 它按「七政全文 + 择时三段」重存(此前直写三段版,把全文顶掉);
				// 降级自足:kinastro 档 / chart 断链下内嵌页产不出基底文本 → 写宿主三段兜底(否则槽恒空、扫出结果导出却报无内容)。
				refreshZeriSlot(this, 'qizhengzeri');
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
		// 与太乙宿主同律:点选 = 按扫描冻结口径看盘。在 setState 之前置好冻结标记与底板键,这一次渲染的备忘
		// 就按冻结值建 → 内嵌七政页(requestGuolaoBundle→genParams 读 props.fields;坚七政档按引用自重排)拿到的就是扫描口径
		// (此前回调里才钉:那一拍拿到活值,坚七政档多发一次活值请求);用户此后改左栏参数 → 指纹变 → 正常按活值重排。
		this._plotFrozen = true;
		this._fieldsBaseKey = JSON.stringify([text, this.state.geo, this.state.options]);
		this.setState({ pickText: text, searchOpen: false, embedPatch: {}, embedRev: (this.state.embedRev || 0) + 1 }, ()=>{
			this.requestChartAndPlot(true);
		});
	}

	// 判读树是服务端异步:扫描完成后预取前 N 行(全局可配,缺省 3=3 次轻量请求),取齐再重存本槽快照;
	// 新一轮扫描 / 卸载作废旧批(epoch)。builder 经 explainAt 读缓存(缺=只列清单,零回归)。
	prefetchSnapshotExplains(rows){
		this._snapshotExplains = null;
		const n = Math.min(readGlobalZeriSnapshotExplainRows(), Array.isArray(rows) ? rows.length : 0);
		const epoch = (this._explainEpoch = (this._explainEpoch || 0) + 1);
		if(!n){ return; }
		Promise.all(rows.slice(0, n).map((r)=>Promise.resolve().then(()=>this.explainRow(r)).catch(()=>null))).then((list)=>{
			if(this.unmounted || epoch !== this._explainEpoch){ return; }
			this._snapshotExplains = list;
			refreshZeriSlot(this, 'qizhengzeri');
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
		// 工作台扫描口径(宿制/罗计交点/月孛)进 pick 后显示盘:母组件按 fields.doubingSu28/guolaoNodeType/
		// guolaoLilithType 优先(guolaoSu28ModeFromFields/guolaoFieldValue),此前硬编 2/mean/mean → 显示盘≠命中判定口径。
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
			gender: mkField(1),
			timeAlg: mkField(1),
			// 七政 fieldsToParams/GuoLaoInput 消费全键(缺则 undefined.value 红屏——真机两连抓;
			// 值=主页默认档,grep 两文件 fields.<k>.value 全集补齐)
			name: mkField('七政择日'),
			tradition: mkField(1),
			strongRecption: mkField(0),
			simpleAsp: mkField(0),
			virtualPointReceiveAsp: mkField(0),
			doubingSu28: mkField(o.su28Mode !== undefined && o.su28Mode !== null && `${o.su28Mode}` !== '' ? Number(o.su28Mode) : 2),
			guolaoAyanamsa: mkField(''),
			// 恒星岁差只认本页:空档即郑式(左栏显示的就是起盘用的),不回落七政页记住的岁差
			[GUOLAO_AYANAMSA_PAGE_ONLY_KEY]: mkField(1),
			guolaoBodyMode: mkField('taiyin'),
			guolaoEqTropicalAnchor: mkField('dongzhi'),
			guolaoGufaPrecess: mkField(0),
			// 命主取法 / 行运法 / 童限基数留空 = 随本页左栏(内嵌页右栏与 AI 内容都按本页的显示偏好取,底板不再写死)
			guolaoLifeMasterMode: mkField(''),
			guolaoLifeMode: mkField('asc'),
			guolaoLilithType: mkField(o.lilithType === 'true' ? 'true' : 'mean'),
			guolaoMinorLimitType: mkField(''),
			guolaoNodeMode: mkField('north_ketu'),
			guolaoNodeType: mkField(o.nodeType === 'true' ? 'true' : 'mean'),
			guolaoTongxianBase: mkField(''),
			guolaoTrueSolarTime: mkField('true'),
			guolaoTuibianMethod: mkField('jiyuan'),
			houseStartMode: mkField(0),
			szshape: mkField(0),
			after23NewDay: mkField(1),
			lateZiHourUseNextDay: mkField(1),
		}, this.state.embedPatch);
	}

	// render 传内嵌七政页的 fields 走 memo:指纹(pick 时刻 / 地点 / 扫描口径)不变则复用同一引用,
	// 既避免工作台每次 setState 都让内嵌页重排,也让 pick 后钉住的冻结份稳定活到下一次参数变更。
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

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }), ()=>{
			if(this.unmounted || (meta && meta.recompute === false)){ return; }
			this.requestChartAndPlot(!!this._plotFrozen);
		});
	}

	// 备忘键:起盘时刻 / 地点 / 工作台口径 / 覆盖层代次
	fieldsMemoKey(){
		return JSON.stringify([this.state.pickText, this.state.geo, this.state.options, this.state.embedRev || 0]);
	}
	fieldsBaseKey(){
		return JSON.stringify([this.state.pickText, this.state.geo, this.state.options]);
	}

	render(){
		const embedFields = this.buildFieldsMemo();
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			<div className="horosa-zeri-qizheng-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<GuoLaoChartMain
						value={castChartFor(this.state.chartValue, embedFields)}   /* 底盘只在与内嵌页起盘时刻地点一致时交下去(取失败 / 在途时是上一刻的) */
						fields={embedFields}
						hook={this.qizhengHook}
						height={this.props.height}
						techniqueScope="qizhengzeri"
						dispatch={this.props.dispatch}   /* 同紫微宿主 */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
						zeriLocked={QIZHENG_ZERI_LOCKED}
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
					optionDefaults={qizhengZeriFullDefaultOptions}
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
