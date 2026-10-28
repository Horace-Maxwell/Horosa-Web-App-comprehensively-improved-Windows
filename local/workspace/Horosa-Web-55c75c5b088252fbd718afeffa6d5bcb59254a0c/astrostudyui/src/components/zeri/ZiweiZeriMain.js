// 择日页子技法宿主:内嵌完整 <ZiWeiMain>(techniqueScope='ziweizeri' 独立
// 快照槽,与主紫微页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进 ZiWeiMain 左栏最顶),pick 命中时刻 hook.fun(fields) 重排。
// 快照冻结纪律(天星/奇门/黄历/八字/太乙同款):_scanCfg/_scanGeo/_scanOptions/_scanTree/
// _scanNatal;_scanUiJson 指纹驱动 resultsStale。显示盘=主页链(默认档走 Java 盘),扫描
// 判定=本地 lite 引擎 Java 兼容口径——两侧一致性由 ziweiZeriEngine 24 例网格金标看守。
import { Component } from 'react';
import { zeriCaseSnapshotText, restoreZeriWorkbenchFromCase, buildZeriCasePayload, beginScanRun, scanRunIsCurrent, plottedFieldsOf, canonicalJson } from './zeriCaseRestore';
import ZiWeiMain from '../ziwei/ZiWeiMain';
import ZiweiZeriWorkbench from './ZiweiZeriWorkbench';
import { ZIWEI_ZERI_WORKBENCH_FIELDS, ZWEngineOptions, ziweiZeriCalibreText } from '../ziwei/ziweiOptions';
import { ZIWEI_PAGE_SCAN_KEYS, ZIWEI_PAGE_FACTORY, withPageFactory } from '../../divination/zeri/zeriPageCalibre';
import { buildFullDefaults } from './zeriOptionDefaults';
import ZeriHostEntry from './ZeriHostEntry';
import { openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newZiweiLeaf, newZiweiGroup, compileZiweiTree } from '../../divination/zeri/ziweiZeriConditionTypes';
import { scanZiwei, explainZiweiAt, computeZiweiScanPan, ziweiPageScanOptions } from '../../divination/zeri/ziweiZeriScanEngine';
import { buildZiweiZeriSnapshotExtra } from '../../divination/zeri/ziweiZeriSnapshot';
import { ziweiZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { mergeEmbedPatch, withEmbedPatch } from '../../utils/scopedFieldsSink';
import { pad2, todayStr, mkField, mkDT } from './zeriHostUtils';
import { zeriNatalInputDefault, normalizeSavedNatal } from './zeriNatal';

const ZERI_SCOPE = 'ziweizeri';
const ZERI_LABEL = '紫微择日';

function initialTree(){
	return { ...newZiweiGroup('all'), children: [newZiweiLeaf('ming_zhu_xing')] };
}

// 解析本命(工作台「用事人本命」区):lite 排一次本命紫微盘取命宫地支(+命主随注)。
// 判定与扫描同引擎同口径(排盘口径取内嵌紫微页,缺省 = Java 兼容三键)——本命命宫与紫微页所见一致。
const ZHI12_N = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function resolveNatal({ date, time, zone, gender }, pageOptions){
	try{
		const p = computeZiweiScanPan({ zone: zone || '+08:00' }, { ...(pageOptions || {}), gender: gender === 0 ? 0 : 1 }, date, time || '12:00:00');
		if(!p){ return null; }
		const mingZhi = ZHI12_N[p.lifeHouseIndex];
		return {
			mingZhi,
			label: `命宫${mingZhi} · 命主${p.lifeMaster || '?'}`,
		};
	}catch(e){
		return null;
	}
}

// 工作台缺省参数单源(页面构造与 AI 择日搜索共用)
export function ziweiZeriDefaultOptions(){
	return { timeAlg: 1, gender: 1 };
}
// 扫描口径单源(择日宿主与 AI 择日搜索同一构参):工作台的性别 / 时间算法 + 紫微设置的排盘口径(页面键以紫微设置为准)
export function ziweiZeriScanOptions(workbench, engine){
	const wb = { ...(workbench || {}) };
	ZIWEI_PAGE_SCAN_KEYS.concat(['ziweiLunarBasis']).forEach((k)=>{ delete wb[k]; });
	return { ...wb, ...ziweiPageScanOptions(engine) };
}

// 过期指纹里的扫描口径:页面键缺席的补出厂值后再按扫描口径单源整形(旧存案 / 方案没带页面键 = 当时按出厂口径扫;
// 更早的工作台若带过定年界线之类,按它当时的值算)—— 与扫描时的口径逐键可比
export function ziweiFingerprintOptions(options){
	const o = options && typeof options === 'object' ? options : {};
	return ziweiZeriScanOptions(o, withPageFactory(o, ZIWEI_PAGE_SCAN_KEYS, ZIWEI_PAGE_FACTORY));
}

// 过期提示里的口径说明:本结果按的排盘口径与现在的紫微设置不同 → 两者各是什么;相同(过期是因为别的改动)→ 空
export function ziweiStaleCalibreNote(frozenOptions, currentOptions){
	const was = ziweiZeriCalibreText(ziweiFingerprintOptions(frozenOptions));
	const now = ziweiZeriCalibreText(ziweiFingerprintOptions(currentOptions));
	return was === now ? '' : `本结果按「${was}」扫描,现在是「${now}」;点结果行起出的盘按现在的设置`;
}

// 完整口径(工作台全部参数的出厂值;构造 / 载入存案 / 载入方案三处共用,见 zeriOptionDefaults)
export function ziweiZeriFullDefaultOptions(){
	return buildFullDefaults(ZIWEI_ZERI_WORKBENCH_FIELDS, ziweiZeriDefaultOptions());
}

export default class ZiweiZeriMain extends Component{
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
			// 工作台参数(性别 / 时间算法)的出厂值;排盘口径取自内嵌紫微页(effectiveScanOptions)。存案 / 方案 / 历史存的是扫描口径全键。
			options: ziweiZeriFullDefaultOptions(),
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
		// ZiWeiMain 重排是 hook 驱动(chartFree 快车道,fields prop 变化不自触发):宿主持 hook,
		// pick 后手动 hook.fun(新 fields) 走标准重排链。
		this.ziweiHook = {};
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
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 存为事盘:此前本宿主无存档钮 → CASE_TYPE_OPTIONS 登记的「紫微择日」事盘类型恒无实例(源层挂载恒无产出)。
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
		this.ziweiHook.fun(this.buildFields(!!frozen));
	}

	componentDidUpdate(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);
	}

	// 载入存案还原工作台后重排(内嵌页是 hook 驱动,fields 变了不自重排)
	replotAfterRestore(){
		if(this.ziweiHook && typeof this.ziweiHook.fun === 'function'){
			this.plotWith(false);
		}
	}

	saveCase(){
		if(!this.props.dispatch){ return; }
		// 快照 = 页面此刻所见(先请内嵌页按当前盘 + 当前择时结果重存再读;见 zeriCaseSnapshotText)
		const snapshot = zeriCaseSnapshotText(this, ZERI_SCOPE);
		const plotted = plottedFieldsOf(this.ziweiHook);   // 所见那张盘实际所用的 fields(取不到 = null,按宿主自己的重建)
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

	// [布局改造] 左栏入口板块(经 ZiWeiMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="紫微择日"
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
		return ziweiZeriFullDefaultOptions();
	}

	// 载入存案时还原扫描冻结口径用(zeriCaseRestore):与 runSearch 同一编译器
	compileScanTree(tree){
		return compileZiweiTree(tree);
	}

	// 过期判据的指纹(纯函数):给定一份工作台口径算指纹。扫描时 / 现在按 currentUiJson(options = 此刻的扫描口径),
	// 载入存案按冻结的那一份(zeriCaseRestore.frozenUiJsonOf)—— 两边同一算法,只差 options 的来源
	uiJsonOf(parts){
		const q = parts || {};
		return canonicalJson({ cfg: q.cfg, geo: q.geo, options: ziweiFingerprintOptions(q.options), natal: q.natal, tree: q.tree });
	}

	// 现在的指纹:扫描口径按工作台参数 + 内嵌紫微页当前的排盘口径 —— 扫描之后在紫微页改了口径 → 「结果已过期」
	currentUiJson(){
		return this.uiJsonOf({ ...this.state, options: this.effectiveScanOptions() });
	}

	// 扫描口径 = 工作台的性别 / 时间算法 + 内嵌紫微页当前的排盘口径(zeriPageCalibre.ZIWEI_PAGE_SCAN_KEYS;页面键以页面为准)。
	// 此前扫描写死 Java 兼容三键、只吃工作台,内嵌盘按紫微页画:紫微页开了立春年界 / 全星集 / 人盘之类,所见 ≠ 所判
	effectiveScanOptions(){
		return ziweiZeriScanOptions(this.state.options, ZWEngineOptions);
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
			compiled = compileZiweiTree(this.state.tree);
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
			ziweiZeriSchemeStore.pushHistory({ cfg, geo, options, natal, natalInput: this.state.natalInput }, this.state.tree);
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
			const res = await scanZiwei({
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
			if(this.ziweiHook && typeof this.ziweiHook.fun === 'function'){
				this.plotWith(true);
			}
		});
	}

	// 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainZiweiAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: { ...(this._scanOptions || this.effectiveScanOptions()), _natal: this._scanNatal },
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
		});
	}

	explainRow(row){
		return Promise.resolve(this.explainRowSync(row));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildZiweiZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
				natal: this._scanNatal || this.state.natal,
				options: this._scanOptions || this.effectiveScanOptions(),	// 配置段明标扫描口径 vs 显示盘口径

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
			timeAlg: mkField(o.timeAlg !== undefined ? o.timeAlg : 1),
		}, this.state.embedPatch);
	}

	// 内嵌页左栏亲手改的字段(时间 / 地点 / 性别 / 时间算法 …)只进本宿主的覆盖层,绝不写主盘(见 utils/scopedFieldsSink);
	// 点选择时结果起盘 / 载入存案时清空
	onEmbedFieldsChange(patch, meta){
		this.setState((s)=>({ embedPatch: mergeEmbedPatch(s.embedPatch, patch, meta), embedRev: (s.embedRev || 0) + 1 }), ()=>{
			if(this.unmounted || (meta && meta.recompute === false)){ return; }
			if(this.ziweiHook && typeof this.ziweiHook.fun === 'function'){
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
			<div className="horosa-zeri-ziwei-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<ZiWeiMain
						fields={this.buildFields(!!this._plotFrozen)}
						hook={this.ziweiHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="ziweizeri"
						dispatch={this.props.dispatch}   /* 宿主内左栏口径控件此前不传 dispatch → onFieldsChange 门控下什么都不发生(六壬/三式/太乙/奇门四宿主已传) */
						onScopedFieldsChange={this.onEmbedFieldsChange}
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<ZiweiZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={(options)=>this.setState({ options })}
					optionDefaults={ziweiZeriFullDefaultOptions}
					pageOptions={this.effectiveScanOptions()}   /* 取自内嵌紫微页的排盘口径(工作台只读显示;方案只存工作台参数,载入不改你的紫微设置) */
					natal={this.state.natal}
					natalInput={this.state.natalInput}
					onNatalInputChange={(natalInput)=>this.setState({ natalInput })}
					onResolveNatal={()=>{
						const n = resolveNatal(this.state.natalInput, ziweiPageScanOptions(ZWEngineOptions));
						this.setState({ natal: n });
						return n;
					}}
					onClearNatal={()=>this.setState({ natal: null })}
					onRestoreNatal={(n)=>this.setState({ natal: normalizeSavedNatal(n) })}   /* 方案载入回灌本命(坏形 = 没有) */
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					previewGeo={this._scanGeo || this.state.geo}   /* 冻结地点:概览口径=扫描口径 */
					previewOptions={this._scanOptions || this.effectiveScanOptions()}   /* 冻结参数:搜索后改参数不改旧结果行的盘 */
					onPreviewPan={(d, t)=>computeZiweiScanPan(this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.effectiveScanOptions()) }, d, t)}
					onTreeChange={(tree)=>this.setState({ tree })}
					onRun={this.runSearch}
					onCancelScan={this.cancelScan}
					onPickInterval={this.onPickInterval}
					onExplain={this.explainRow}
					scanEpoch={this.state.scanEpoch}
					resultsStale={resultsStale}
					staleCalibreNote={resultsStale && this._scanOptions ? ziweiStaleCalibreNote(this._scanOptions, this.effectiveScanOptions()) : ''}   /* 本结果的排盘口径 vs 现在的紫微设置(点结果行不回写设置;载入存案后最常见) */
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
