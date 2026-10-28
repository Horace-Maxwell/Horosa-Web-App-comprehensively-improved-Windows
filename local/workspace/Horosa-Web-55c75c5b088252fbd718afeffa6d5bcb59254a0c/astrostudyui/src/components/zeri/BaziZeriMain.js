// 择日页子技法宿主:内嵌完整 <BaZi>(techniqueScope='bazizeri' 独立快照槽,
// 与主八字页 keep-alive 并存互不竞写)。八字页无自有左栏(用全局命盘链)——宿主自管 fields
// (左栏入口板块经 renderLeftExtra 插槽进 BaZi 左栏最顶),pick 命中时刻改 fields 重排(标准链)。
// 快照冻结纪律(天星/奇门/黄历同款):_scanCfg/_scanGeo/_scanOptions/_scanTree/_scanNatal;
// _scanUiJson 指纹驱动 resultsStale。
import { Component } from 'react';
import { zeriCaseSnapshotText, restoreZeriWorkbenchFromCase, buildZeriCasePayload, beginScanRun, scanRunIsCurrent, plottedFieldsOf, canonicalJson } from './zeriCaseRestore';
import BaZi from '../cntradition/BaZi';
import BaziZeriWorkbench, { baziWorkbenchParamFields } from './BaziZeriWorkbench';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newBaziLeaf, newBaziGroup, compileBaziTree } from '../../divination/zeri/baziZeriConditionTypes';
import { scanBazi, explainBaziAt, computeBaziScanPan } from '../../divination/zeri/baziZeriScanEngine';
import { buildBaziZeriSnapshotExtra } from '../../divination/zeri/baziZeriSnapshot';
import { baziZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { buildLocalBaziResult, BAZI_ADJUST_JIEQI_SENT } from '../../utils/baziLunarLocal';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { mergeEmbedPatch, withEmbedPatch } from '../../utils/scopedFieldsSink';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';
import { zeriNatalInputDefault, normalizeSavedNatal } from './zeriNatal';
import { BAZI_PAGE_SCAN_KEYS, BAZI_PAGE_FACTORY, pickKeys, splitPageKeys, withPageFactory } from '../../divination/zeri/zeriPageCalibre';

const ZERI_SCOPE = 'bazizeri';
const ZERI_LABEL = '八字择日';

function initialTree(){
	return { ...newBaziGroup('all'), children: [newBaziLeaf('shensha_has')] };
}

// 解析本命(工作台「用事人本命」区):全量核一次取年支/日干/日支/喜用(gejuYongShen)。
export function resolveNatal({ date, time, zone, gender }){
	try{
		const r = buildLocalBaziResult({ date, time: time || '12:00:00', zone: zone || '+08:00', ad: 1, gender: gender === 0 ? 0 : 1 });
		const four = r && r.bazi && r.bazi.fourColumns;
		if(!four){ return null; }
		const gz = (k)=>(four[k] && (four[k].ganzi || four[k].ganZhi)) || '';
		const gy = r.bazi.gejuYongShen;
		const CN_WX = { Metal: '金', Wood: '木', Water: '水', Fire: '火', Earth: '土' };
		const xiyong = (gy && gy.yongshen && Array.isArray(gy.yongshen.xi))
			? gy.yongshen.xi.map((w)=>CN_WX[w] || w).filter(Boolean)
			: [];
		return {
			yearZhi: gz('year').charAt(1),
			dayGan: gz('day').charAt(0),
			dayZhi: gz('day').charAt(1),
			xiyong,
			label: `${gz('year')}年 ${gz('day')}日${xiyong.length ? ` 喜${xiyong.join('')}` : ''}`,
		};
	}catch(e){
		return null;
	}
}

// 工作台缺省参数单源(页面构造与 AI 择日搜索共用) —— godKeyPos 字符串档(W0 死开关根修;旧数值经引擎归一垫片兼容)
// 完整口径(工作台全部参数的出厂值;构造 / 载入存案 / 载入方案三处共用,见 zeriOptionDefaults)
export function baziZeriFullDefaultOptions(){
	return buildFullDefaults(baziWorkbenchParamFields(), baziZeriDefaultOptions());
}
export function baziZeriDefaultOptions(){
	return { timeAlg: 0, after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay(), godKeyPos: '年', phaseType: 0 };
}

export default class BaziZeriMain extends Component{
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
			// 五参数缺省与主八字页出厂值同(models/astro.js:timeAlg 0 真太阳时 / godKeyPos '年' / phaseType 0 火土同;日界两键=全局现值),
			// 帮助称「同枚举同默认」且 pick 会把工作台值写进内嵌八字页 —— 此前 1/'年日'/2 三处不同,点一行显示盘即按工作台缺省改口径。
			options: baziZeriFullDefaultOptions(),
			natal: null,          // 用事人本命(resolveNatal 产物;选填,解锁本命组条件)
			natalInput: zeriNatalInputDefault(),   // 构造缺省单源(载入没有本命的存案时照它复位)
			tree: initialTree(),
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		// BaZi 重排是 hook 驱动(chartFree 快车道,fields prop 变化不自触发):宿主持 hook,
		// pick 后手动 hook.fun(新 fields) 走标准重排链。
		this.baziHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanNatal = null;
		this._scanNatalInput = null;
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
		this.onWorkbenchOptionsChange = this.onWorkbenchOptionsChange.bind(this);
		this.onPageCalibreChange = this.onPageCalibreChange.bind(this);
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 存为事盘:此前本宿主无存档钮 → CASE_TYPE_OPTIONS 登记的「八字择日」事盘类型恒无实例(源层挂载恒无产出)。
	// 快照取本宿主槽(母技法全文+择日三段,母组件经 composeAiSnapshot 存入 scope 槽);缺槽时至少存择日三段。
	// 事盘源层按 payload.module=本 scope 认领 payload.snapshot(与 qimenzeri 同律)。
	componentDidMount(){
		// 内嵌页挂载即按这一拍的底板起盘:记下底板口径(存案的时间地点 = 所见那张盘;之后每次实际重排更新)
		if(this._lastPlotFrozen === undefined){ this._lastPlotFrozen = !!this._plotFrozen; }
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);   // 载入存案还原工作台态(此前五宿主写而不读)
	}

	// 实际重排都经这里:内嵌页是 hook 驱动(fields 变了不自重排),所见那张盘的底板 = 最后一次重排时的冻结口径
	plotWith(frozen){
		this._lastPlotFrozen = !!frozen;
		this.baziHook.fun(this.buildFields(!!frozen));
	}

	componentDidUpdate(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);
	}

	// 载入存案还原工作台后重排(内嵌页是 hook 驱动,fields 变了不自重排)
	replotAfterRestore(){
		if(this.baziHook && typeof this.baziHook.fun === 'function'){
			this.plotWith(false);
		}
	}

	saveCase(){
		if(!this.props.dispatch){ return; }
		// 快照 = 页面此刻所见(先请内嵌页按当前盘 + 当前择时结果重存再读;见 zeriCaseSnapshotText)
		const snapshot = zeriCaseSnapshotText(this, ZERI_SCOPE);
		const plotted = plottedFieldsOf(this.baziHook);   // 所见那张盘实际所用的 fields(取不到 = null,按宿主自己的重建)
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存案的时间地点 = 所见那张盘(叠过覆盖层):底板按最后一次实际重排的冻结口径 —— 点选后改了工作台却没重排时,
			// render 里冻结标记已翻成活值,此前存成活值,与快照 / 载回的盘对不上
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

	// [布局改造] 左栏入口板块(经 BaZi renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="八字择日"
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
		return baziZeriFullDefaultOptions();
	}

	// 载入存案时还原扫描冻结口径用(zeriCaseRestore):与 runSearch 同一编译器
	compileScanTree(tree){
		return compileBaziTree(tree);
	}

	// 过期判据的指纹(纯函数):给定一份工作台口径算指纹。扫描时 / 现在按 currentUiJson(options = 此刻的扫描口径),
	// 载入存案按冻结的那一份(zeriCaseRestore.frozenUiJsonOf)。页面键缺席 = 出厂值(旧存案没带,当时按出厂口径扫)
	uiJsonOf(parts){
		const q = parts || {};
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: withPageFactory(q.options, BAZI_PAGE_SCAN_KEYS, BAZI_PAGE_FACTORY), natal: q.natal, tree: q.tree });
	}

	// 现在的指纹:扫描口径按 effectiveScanOptions(工作台参数 + 内嵌八字页当前的页面口径键)—— 内嵌页左栏改了南半球月令 /
	// 命宫起法,「结果已过期」照亮
	currentUiJson(){
		return this.uiJsonOf({ ...this.state, options: this.effectiveScanOptions() });
	}

	// 扫描口径 = 工作台五参数 + 内嵌八字页当前的南半球月令 / 命宫起法(zeriPageCalibre.BAZI_PAGE_SCAN_KEYS;页面键以页面为准)。
	// 此前扫描不读这两项:南纬 × 对冲 / 子平数法命宫时,点开的盘与扫描判的月柱 / 命宫不是同一个
	effectiveScanOptions(){
		const h = this.baziHook;
		let page = null;
		try{ page = (h && typeof h.getBaziOptions === 'function') ? h.getBaziOptions() : null; }catch(e){ page = null; }
		return { ...(this.state.options || {}), ...pickKeys(page, BAZI_PAGE_SCAN_KEYS) };
	}

	// 工作台参数改动(含载入方案 / 历史):页面口径键回写内嵌八字页,其余进工作台参数;
	// 载入的方案一个页面键都没带(页面口径进方案之前存的)→ 那时扫描按出厂口径 → 页面键回出厂值
	onWorkbenchOptionsChange(options, meta){
		const split = splitPageKeys(options || {}, BAZI_PAGE_SCAN_KEYS);
		const page = (meta && meta.source === 'scheme' && !Object.keys(split.page).length) ? { ...BAZI_PAGE_FACTORY } : split.page;
		const h = this.baziHook;
		if(Object.keys(page).length && h && typeof h.applyBaziOptions === 'function'){ h.applyBaziOptions(page); }
		this.setState({ options: split.rest });
	}

	onPageCalibreChange(){
		if(this.unmounted){ return; }
		this.setState((s)=>({ pageCalibreRev: (s.pageCalibreRev || 0) + 1 }));
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

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileBaziTree(this.state.tree);
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
			baziZeriSchemeStore.pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断
		}
		// 运行代次:扫描途中载入存案会作废这一次(取消 + 推进代次),之后的进度 / 结果 / 收尾都不再写(见 zeriCaseRestore)
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
			const res = await scanBazi({
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
		// 点选 = 按扫描冻结口径看盘;之后内嵌页改字段仍叠在这张冻结底板上。在 setState 之前置好:
		// 这一次渲染就把冻结 fields 交给内嵌页(此前在回调里才置,那一拍内嵌页左栏 / 快照头是活值)
		this._plotFrozen = true;
		this._plotBaseKey = JSON.stringify([text, this.state.geo, this.state.options]);
		this.setState({ pickText: text, searchOpen: false, embedPatch: {}, embedRev: (this.state.embedRev || 0) + 1 }, ()=>{
			// 页面口径键按扫描冻结值回写内嵌八字页,再起盘:所见那张盘 = 扫描判的那张
			const h = this.baziHook;
			// 冻结口径没带页面键(页面口径进扫描之前存的存案)= 当时按出厂口径扫:回写出厂值(判读也按它),不留着页面现值
			const page = pickKeys(withPageFactory(this._scanOptions || this.effectiveScanOptions(), BAZI_PAGE_SCAN_KEYS, BAZI_PAGE_FACTORY), BAZI_PAGE_SCAN_KEYS);
			Promise.resolve(h && typeof h.applyBaziOptions === 'function' ? h.applyBaziOptions(page) : null).then(()=>{
				if(!this.unmounted && h && typeof h.fun === 'function'){ this.plotWith(true); }
			});
		});
	}

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainBaziAt({
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
			const extra = buildBaziZeriSnapshotExtra({
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

	// 宿主自管 fields:pick 时刻+择日地点+扫描口径参数合成 BaZi 标准 fields 形状。
	// frozen=true(pick 起盘):用扫描冻结快照——所见行=所判口径(奇门母本纪律;扫后改
	// 参数再 pick,活值会用新口径起旧结果行的盘,审查实抓)。初排/左栏改动仍走活值。
	buildFields(frozen){
		const t = mkDT(this.state.pickText);
		const geo = (frozen && this._scanGeo) || this.state.geo || {};
		const o = (frozen && this._scanOptions) || this.state.options || {};
		const dflt = baziZeriDefaultOptions();   // 缺键回落与工作台出厂值同源(此前写死 1 / 2 / '年日',与扫描 0 / 0 / '年' 不同)
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
			timeAlg: mkField(o.timeAlg !== undefined ? o.timeAlg : dflt.timeAlg),
			phaseType: mkField(o.phaseType !== undefined ? o.phaseType : dflt.phaseType),
			godKeyPos: mkField(o.godKeyPos !== undefined ? o.godKeyPos : dflt.godKeyPos),
			after23NewDay: mkField(o.after23NewDay !== undefined ? o.after23NewDay : dflt.after23NewDay),
			lateZiHourUseNextDay: mkField(o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : dflt.lateZiHourUseNextDay),
			adjustJieqi: mkField(BAZI_ADJUST_JIEQI_SENT),   // 与八字页同一来源(恒 0:本地引擎不实现节气按纬度调整)
		}, this.state.embedPatch);
	}

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }), ()=>{
			if(this.unmounted || (meta && meta.recompute === false)){ return; }
			if(this.baziHook && typeof this.baziHook.fun === 'function'){
				this.plotWith(!!this._plotFrozen);
			}
		});
	}

	render(){
		// 点选之后工作台的时刻 / 地点 / 口径又改了 → 回到活值底板(与改动前同:内嵌页跟着工作台走)
		if(this._plotFrozen && this._plotBaseKey !== JSON.stringify([this.state.pickText, this.state.geo, this.state.options])){ this._plotFrozen = false; }
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-bazi-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<BaZi
						fields={this.buildFields(!!this._plotFrozen)}
						hook={this.baziHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="bazizeri"
						dispatch={this.props.dispatch}   /* 同紫微宿主 */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						onPageCalibreChange={this.onPageCalibreChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<BaziZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={this.onWorkbenchOptionsChange}
					optionDefaults={baziZeriFullDefaultOptions}
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
					previewOptions={this._scanOptions || this.effectiveScanOptions()}   /* 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewPan={(d, t)=>computeBaziScanPan(this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t)}
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
