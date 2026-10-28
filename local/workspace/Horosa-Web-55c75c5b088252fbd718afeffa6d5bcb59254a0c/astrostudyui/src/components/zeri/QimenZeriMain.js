// [奇门择日] 择日页子技法宿主:内嵌完整 <DunJiaMain>(techniqueScope='qimenzeri',左栏选项/中栏盘/
// 右栏五页签/法奇门/保存全数复用,显示路由与独立奇门页按构造恒等),左栏经 renderLeftExtra 插
// 「择日」入口,弹出找局工作台(QimenZeriWorkbench);扫描走纯本地 qimenScanEngine,pick 命中时刻
// 经 ref.applyExternalPlot 回写主盘标准链重排。
// 快照冻结纪律(天星同款):找局瞬间冻结 _scanCfg/_scanGeo/_scanOptions/_scanTree/_scanSeeds,
// 结果行跳盘/判读/概览恒用冻结值,不受此后面板改动影响;_scanUiJson 指纹驱动 resultsStale 黄条。
import { Component } from 'react';
import DunJiaMain, { dunjiaFactoryOptions } from '../dunjia/DunJiaMain';
import QimenZeriWorkbench from './QimenZeriWorkbench';
import { XQButton, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import DateTime from '../comp/DateTime';
import { getStore } from '../../utils/storageutil';
import { caseRestoreKey } from '../../utils/kentangCaseSave';
import { beginScanRun, scanRunIsCurrent, SCAN_UNCOMPILED_SENTINEL, canonicalJson } from './zeriCaseRestore';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newQimenLeaf, newQimenGroup, compileQimenTree } from '../../divination/zeri/qimenConditionTypes';
import { scanQimen, explainQimenAt, buildQimenScanSeeds } from '../../divination/zeri/qimenScanEngine';
import { buildQimenZeriSnapshotExtra } from '../../divination/zeri/qimenZeriSnapshot';
import { qimenZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { leadingYearOf } from '../../utils/dateStrSafe';
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
		this.restoreWorkbenchFromCase(true);
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
	// mounting:挂载时那一次(只还原显式载入的那条;存为事盘 / 编辑换掉的当前事盘不还原,见 kentangCaseSave.caseRestoreKey)
	restoreWorkbenchFromCase(mounting){
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
		// 读档去重键走共用件(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;
		// 编辑 / 存为事盘 / 保存编辑换掉的当前事盘不是载入 → null,不还原。禁另拼一份。
		const caseVersion = caseRestoreKey('qimenzeri', userState);
		if(!caseVersion){
			return;
		}
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
		// 本宿主的事盘却整段没有 zeri(手建 / 改类型 / AI 建档):按空存案处理 —— 结果清成「没扫过」、冻结清空、扫描代次换代,
		// 地点 / 参数清掉由主盘播种(此前直接返回,工作台留着本会话上一次的结果与口径,再存一次就写进这条)
		const zeri = payload && payload.zeri && typeof payload.zeri === 'object' ? payload.zeri : {};
		const nonEmpty = (o)=>!!(o && typeof o === 'object' && Object.keys(o).length);
		const next = {};
		if(zeri.cfg && zeri.cfg.startDate){ next.cfg = { ...this.state.cfg, ...zeri.cfg }; }
		// 存案没开过工作台(地点 / 参数为空):清掉本会话的,打开工作台时从已还原成存案的主盘播种 —— 此前留着本会话的,
		// 与这条存案无关,而且随宿主与内嵌页谁先还原而不同
		// 空对象同样当没有(此前存成 {} 的存案下次打开工作台不再播种)
		next.geo = nonEmpty(zeri.geo) ? { ...zeri.geo } : null;
		next.draftOptions = nonEmpty(zeri.options) ? { ...zeri.options } : null;
		if(zeri.tree && Array.isArray(zeri.tree.children)){ next.tree = zeri.tree; }
		const hasResults = Array.isArray(zeri.results);
		if(hasResults){
			next.results = zeri.results;
			next.truncated = !!zeri.truncated;
		}else{
			// 存案没带结果:清成「没扫过」(与其它择日宿主同,见 zeriCaseRestore);此前会话里上一次的结果照留,判读却按存案口径
			next.results = null;
			next.truncated = false;
		}
		// 按行号缓存的判读(工作台「详情」按 扫描代次:行号 取)换代,否则上一轮那一行的判读套到存案的同一行上
		next.scanEpoch = (this.state.scanEpoch || 0) + 1;
		// 内嵌遁甲页还原这条存案的盘面选项时会经 onBoardOptionsChange 镜像改写工作台参数(可能是同一拍,也可能等取盘回来后):
		// 带着「载入存案、同一条」标记的镜像一律不进工作台(存案的工作台参数为准);用户之后亲手改盘面照常镜像
		// 存案没带工作台参数时不设:内嵌页还原出的盘面选项照常镜像进来(= 跟随存案盘面)
		this._zeriRestoredCaseVersion = nonEmpty(zeri.options) ? caseVersion : null;
		// 正在找局时载入存案:作废这一次(取消 + 推进运行代次),否则找完把本次结果写回来、配着存案的口径
		if(this.state.scanning){
			this.cancelScan();
			beginScanRun(this);
			next.scanning = false;
			next.progress = null;
		}
		this.setState(next, ()=>{ this.restoreScanFreeze(hasResults); });
	}

	// 扫描冻结口径换成这条存案的(点选起盘、判读详情、快照前 N 行、「结果已过期」都读它;存档写的是冻结值优先,见 casePayloadExtra):
	// 此前载入只改状态 —— 本会话没扫过时判读全是「未知条件类型」,扫过别的时按那次的地点 / 参数 / 节气种子 / 条件树配存案的结果行。
	// 存案没带结果 → 冻结一起清空。条件树编译不出(条件类型改名 / 下线)→ 过期指纹永不相等,「结果已过期」照出
	restoreScanFreeze(hasResults){
		if(!hasResults){
			this._scanCfg = null;
			this._scanGeo = null;
			this._scanOptions = null;
			this._scanTree = null;
			this._scanSeeds = null;
			this._scanUiTree = null;
			this._scanUiJson = '';
			return;
		}
		const st = this.state || {};
		const cfg = { ...(st.cfg || {}) };
		// 地点 / 参数为空(存案没开过工作台)时冻结 null,点选 / 判读 / 存案回落到活值(与共享件 zeriCaseRestore.restoreScanFreeze 同律)
		const geo = st.geo ? { ...st.geo } : null;
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = st.draftOptions ? { ...st.draftOptions } : null;
		this._scanUiTree = st.tree ? JSON.parse(JSON.stringify(st.tree)) : null;
		let compiled = null;
		try{ compiled = st.tree ? compileQimenTree(st.tree) : null; }catch(e){ compiled = null; }
		this._scanTree = compiled;
		const startYear = leadingYearOf(cfg.startDate);
		const endYear = leadingYearOf(cfg.endDate);
		try{
			this._scanSeeds = Number.isFinite(startYear) && Number.isFinite(endYear)
				? buildQimenScanSeeds(startYear, endYear, this.buildGeoParams(geo || {}).zone) : {};
		}catch(e){ this._scanSeeds = {}; }
		// 指纹按冻结的这一份(就是此刻还原进工作台的存案值)经纯函数 uiJsonOf 算,不调 currentUiJson(与共享件 frozenUiJsonOf 同律)
		this._scanUiJson = (st.tree && !compiled) ? SCAN_UNCOMPILED_SENTINEL
			: this.uiJsonOf({ cfg: st.cfg, geo: st.geo, options: st.draftOptions, tree: st.tree });
	}

	// 内嵌 DunJiaMain 当前左栏的时空与 22 参数(genParams 同链),只读、不写 state;取不到 = {}
	boardScanContext(){
		if(!this.dunjiaRef || typeof this.dunjiaRef.getScanContext !== 'function'){
			return {};
		}
		// 渲染里也会调到(存案有结果、没带地点 / 参数时):内嵌页取不到上下文时按「没有」处理,不让整页渲染跟着抛
		let ctx = null;
		try{ ctx = this.dunjiaRef.getScanContext(); }catch(e){ return {}; }
		const params = ctx && ctx.params ? ctx.params : null;
		const out = {};
		if(params){
			out.geo = {
				zone: params.zone,
				lat: params.lat,
				lon: params.lon,
				gpsLat: params.gpsLat,
				gpsLon: params.gpsLon,
				ad: params.ad,
				pos: ctx.fields && ctx.fields.pos && ctx.fields.pos.value ? ctx.fields.pos.value : '',
			};
		}
		if(ctx && ctx.options){
			out.draftOptions = { ...ctx.options };
		}
		return out;
	}

	// 冻结地点 / 参数为空(存案没带)时的回落:工作台活值,活值也空就读主盘(只读,不播种进工作台 ——
	// 播种会改工作台、点亮「结果已过期」,而点选 / 详情 / 小盘只是要一个口径)
	fallbackGeo(){
		return this.state.geo || this.boardScanContext().geo || null;
	}

	fallbackOptions(){
		return this.state.draftOptions || this.boardScanContext().draftOptions || null;
	}

	// 首开播种 + 「从主盘重载」:时空与 22 参数取自内嵌 DunJiaMain 当前左栏(genParams 同链)。
	seedFromBoard(force){
		if(!this.dunjiaRef || typeof this.dunjiaRef.getScanContext !== 'function'){
			return;
		}
		const board = this.boardScanContext();
		const next = {};
		if(board.geo && (force || !this.state.geo)){
			next.geo = board.geo;
		}
		if(board.draftOptions && (force || !this.state.draftOptions)){
			next.draftOptions = board.draftOptions;
		}
		if(Object.keys(next).length){
			this.rebaseFreezeOnFill(next);
			this.setState(next);
		}
		return next;   // 同一拍里紧接着要用播种值的(找局)直接取它:setState 在点击的批量更新里还没提交
	}

	// 冻结地点 / 参数为空(载入的存案没带)时,之后主盘播种 / 盘面镜像第一次填进来的值就是回落值(点选 / 判读本来就按它):
	// 指纹换成填进来之后的,不因此亮「结果已过期」(此前没改任何条件,载入后或一打开工作台就提示过期)。
	// 只在填之前指纹仍相等(没有别的改动)、且那一格冻结与活值都还空着时换;之后再改照常算过期。
	rebaseFreezeOnFill(patch){
		if(!patch || !this._scanUiJson || this._scanUiJson === SCAN_UNCOMPILED_SENTINEL){ return; }
		const st = this.state || {};
		const has = (k)=>Object.prototype.hasOwnProperty.call(patch, k) && !!patch[k];
		const fillsGeo = has('geo') && !this._scanGeo && !st.geo;
		const fillsOpts = has('draftOptions') && !this._scanOptions && !st.draftOptions;
		if(!fillsGeo && !fillsOpts){ return; }
		if(this.currentUiJson() !== this._scanUiJson){ return; }
		this._scanUiJson = this.currentUiJson({ geo: fillsGeo ? patch.geo : st.geo, options: fillsOpts ? patch.draftOptions : st.draftOptions });
	}

	openSearch(){
		this.seedFromBoard(false);
		this.setState({ searchOpen: true });
	}

	reloadFromBoard(){
		this.seedFromBoard(true);
	}

	// P7 镜像:左栏「起盘选项」改动实时刷新工作台参数草稿(工作台开着时用户改左栏=罕见路径,后写胜)。
	onBoardOptionsChange(options, meta){
		if(this.unmounted){
			return;
		}
		if(meta && meta.source === 'case' && meta.caseVersion && meta.caseVersion === this._zeriRestoredCaseVersion){ return; }
		// 内嵌页随外部性别(顶栏 / 载入命盘·事盘)同步标签型 sex:只跟这一项(其余盘面选项没动;载入性别不同的存案时整份镜像
		// 会冲掉存案的工作台参数)。工作台参数还没有时照旧整份镜像 —— 否则只剩 {sex},之后打开工作台不再从主盘播种
		// 函数式:叠在同一批里先到的整份镜像(命盘还原)之上,不按已提交的旧草稿写
		if(meta && meta.source === 'gender-sync'){
			const sex = options ? options.sex : undefined;
			if(!this.state.draftOptions && options){ this.rebaseFreezeOnFill({ draftOptions: { ...options } }); }
			this.setState((s)=>{
				const cur = s.draftOptions;
				if(!cur){ return { draftOptions: { ...options } }; }
				if(sex === undefined || cur.sex === sex){ return null; }
				return { draftOptions: { ...cur, sex } };
			});
			return;
		}
		const patch = { draftOptions: { ...options } };
		this.rebaseFreezeOnFill(patch);
		this.setState(patch);
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

	// 过期判据的指纹(纯函数):给定一份工作台口径算指纹(规范化序列化,键序不同不误报)
	uiJsonOf(parts){
		const q = parts || {};
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: q.options, tree: q.tree });
	}

	// over(可选):{ geo, options } 换掉还没提交的 state(找局同一拍里播种出的值:提交后 state 就是它,指纹两边一致)
	currentUiJson(over){
		const o = over || {};
		return this.uiJsonOf({
			cfg: this.state.cfg,
			geo: o.geo !== undefined ? o.geo : this.state.geo,
			options: o.options !== undefined ? o.options : this.state.draftOptions,
			tree: this.state.tree,
		});
	}

	// 判读 / 预览的节气种子与所用地点同一时区:冻结地点在 = 找局时建的那份;冻结地点为空(存案没带地点)回落活值时,
	// 按活值时区与冻结的年份现建(年份 + 时区记忆化)—— 否则判读按活值时区、种子却是 +08:00,交节前后盘面错位
	frozenSeeds(){
		if(this._scanGeo){ return this._scanSeeds || {}; }
		const cfg = this._scanCfg || this.state.cfg || {};
		const startYear = leadingYearOf(cfg.startDate);
		const endYear = leadingYearOf(cfg.endDate);
		if(!Number.isFinite(startYear) || !Number.isFinite(endYear)){ return this._scanSeeds || {}; }
		const zone = this.buildGeoParams(this.fallbackGeo() || {}).zone;
		const key = `${startYear}|${endYear}|${zone}`;
		if(this._liveSeedsKey !== key){
			try{ this._liveSeeds = buildQimenScanSeeds(startYear, endYear, zone); }catch(e){ this._liveSeeds = {}; }
			this._liveSeedsKey = key;
		}
		return this._liveSeeds || {};
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
		const seeded = this.seedFromBoard(false) || {};
		const cfg = { ...this.state.cfg };
		// 工作台开着时载入了没带地点 / 参数的存案:播种的 setState 还没提交,读 state 是 null —— 用当场播种出的值(此前冻成 {})
		const geo = { ...(this.state.geo || seeded.geo || {}) };
		const options = { ...(this.state.draftOptions || seeded.draftOptions || {}) };
		const geoParams = this.buildGeoParams(geo);
		const startYear = leadingYearOf(cfg.startDate);
		const endYear = leadingYearOf(cfg.endDate);
		// 冻结找局快照(跳盘/判读/概览恒用冻结值)
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanSeeds = Number.isFinite(startYear) && Number.isFinite(endYear)
			? buildQimenScanSeeds(startYear, endYear, geoParams.zone)
			: {};
		// 指纹按这次实际用的地点 / 参数(播种值提交后 state 就是它;按还没提交的 state 算,一找完就亮「结果已过期」)
		this._scanUiJson = this.currentUiJson({ geo: this.state.geo || seeded.geo || null, options: this.state.draftOptions || seeded.draftOptions || null });
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			qimenZeriSchemeStore.pushHistory({ cfg, geo, options }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断找局
		}
		// 运行代次:找局途中载入存案会作废这一次,之后的进度 / 结果 / 收尾都不再写
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
			const res = await scanQimen({
				cfg,
				geoParams,
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
			// horosa_panel_ready_v1:三个终态 settle(命中/取消/失败)都收口 —— 取消与失败也算
			// 「本次交互到此为止」,不记会让该次找局永远配不上对(与遁甲 pan=null 口径一致)。
			this.setState({ scanning: false, progress: null, results: res.intervals, truncated: res.truncated }, ()=>{ markPanelReady('zeri'); });
		}catch(e){
			if(this.unmounted || !scanRunIsCurrent(this, run)){
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
		// 冻结地点为空(存案没带)时回落工作台活值,活值也空就读主盘(盘面此时已是存案的;只读,不播种进工作台):不按 +08:00、不带地点回写
		const geo = this._scanGeo || this.fallbackGeo() || {};
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
			options: { ...(this._scanOptions || this.fallbackOptions() || {}) },
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

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainQimenAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.fallbackGeo()),
			options: this._scanOptions || this.fallbackOptions() || {},
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
			jieqiYearSeeds: this.frozenSeeds(),
		});
	}

	explainRow(row){
		return Promise.resolve(this.explainRowSync(row));
	}

	// 结果行小盘预览的口径:有结果(找过 / 载入了带结果的存案)才有;冻结参数为空(存案有结果、没带参数)时回落活值,
	// 与点选 / 判读同律(其它择日宿主同为 _scan* || 活值)
	previewContext(){
		const options = this._scanOptions || (this._scanUiJson ? (this.fallbackOptions() || {}) : null);
		return options ? {
			geoParams: this.buildGeoParams(this._scanGeo || this.fallbackGeo()),
			options,
			seeds: this.frozenSeeds(),
		} : null;
	}

	// P5 composer:奇门全文快照之后拼「择日三段」(段头与 aiExport preset 🔒逐字成对)。
	composeAiSnapshot(baseText){
		try{
			const extra = buildQimenZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				// 段头的地点 / 参数与下面的判读树同一口径:有结果(找过 / 载入了带结果的存案)而冻结为空时回落工作台活值、再回落主盘;
				// 没有结果时照旧写工作台活值(没开过工作台 = 未设),与小盘预览同一判据
				geo: this._scanGeo || (this._scanUiJson ? this.fallbackGeo() : this.state.geo),
				options: this._scanOptions || (this._scanUiJson ? this.fallbackOptions() : this.state.draftOptions),
				tree: this._scanUiTree || this.state.tree,	// 冻结树:与命中行同源(活树曾致条件描述≠结果,复审 F5)
				results: this.state.results,
				truncated: this.state.truncated,
				explainAt: (row)=>this.explainRowSync(row),   // 前 N 行判读树(全局可配)
			});
			return extra ? `${baseText}\n\n${extra}` : baseText;
		}catch(e){
			return baseText;
		}
	}

	// P6 事盘附加负载:工作台态随事盘存档,重开经 restoreWorkbenchFromCase 还原(命中行截 200 防超载)。
	// 口径取扫描冻结值优先(结果行是按它找的;与其它择日宿主的 buildZeriCasePayload 同律):存的若是之后改过的活值,载回还原的口径就对不上结果
	casePayloadExtra(){
		const cfg = this._scanCfg || this.state.cfg;
		const geo = this._scanGeo || this.state.geo;
		const options = this._scanOptions || this.state.draftOptions;
		const tree = this._scanUiTree || this.state.tree;
		return {
			zeri: {
				version: 1,
				cfg: { ...(cfg || {}) },
				geo: geo ? { ...geo } : null,
				options: options ? { ...options } : null,
				tree: JSON.parse(JSON.stringify(tree)),
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
		const previewCtx = this.previewContext();
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
					optionDefaults={dunjiaFactoryOptions}   /* 载入方案的打底口径:奇门页出厂起盘选项(方案没写的键回出厂值,不取会话现值) */
					onReloadFromBoard={this.reloadFromBoard}
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
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
