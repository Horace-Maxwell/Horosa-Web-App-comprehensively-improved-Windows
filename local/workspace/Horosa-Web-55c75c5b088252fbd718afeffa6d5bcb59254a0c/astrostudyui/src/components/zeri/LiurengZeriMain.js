// [Z5·六壬择日] 择日页子技法宿主:内嵌完整 <LiuRengMain>(techniqueScope='liurengzeri'
// 独立快照槽,与主六壬页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进 LiuRengMain 左栏最顶),pick 后 /chart+起课链重排(后端显示)。
// 快照冻结纪律同族:_scanCfg/_scanGeo/_scanOptions/_scanTree/_scanNatal;_scanUiJson
// 指纹驱动 resultsStale。显示盘=主页后端链;扫描判定=本地 lite 供数+主页同一排盘函数族
// (涉害核同源)——三个供数差异窗(月将换将时刻/昼夜界折射窗/四柱 golden 满防)帮助分册明示。
import { Component } from 'react';
import LiuRengMain from '../lrzhan/LiuRengMain';
import LiurengZeriWorkbench from './LiurengZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newLiurengLeaf, newLiurengGroup, compileLiurengTree } from '../../divination/zeri/liurengZeriConditionTypes';
import { scanLiureng, explainLiurengAt, computeLiurengScanPan } from '../../divination/zeri/liurengZeriScanEngine';
import { buildLiurengZeriSnapshotExtra } from '../../divination/zeri/liurengZeriSnapshot';
import { liurengZeriSchemeStore } from '../../divination/zeri/schemeStore';
import { buildLrChartLite } from '../../divination/zeri/liurengLocal';
import { fetchChart } from '../../services/astro';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newLiurengGroup('all'), children: [newLiurengLeaf('ke_name')] };
}
function mkField(v){
	return { value: v };
}
function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}

// 解析本命(工作台「用事人本命」区):四柱 lite 取本命年支+行年支(男一岁起寅顺行,
// 女一岁起申逆行,虚岁=候选年-生年+1;与主六壬页行年口径同族)。
const ZHI12_N = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function resolveNatal({ date, time, zone, gender }){
	try{
		const r = buildLrChartLite({ zone: zone || '+08:00' }, {}, date, time || '12:00:00');
		if(!r){ return null; }
		const yearGz = ((r.fourColumns || {}).year || {}).ganzi || ((r.fourColumns || {}).year || {}).ganZhi || '';
		const mingZhi = yearGz.charAt(1);
		if(!mingZhi){ return null; }
		const bornYear = Number(`${date}`.slice(0, 4));
		const male = gender !== 0;
		// 🔴 行年是**候选时刻年**的函数(虚岁=候选年-生年+1),不在此预算——扫描窗最长
		// 1830 天≈5 个行年,按「点击扫描时的系统年」冻结=跨年样本整支错位(审查实抓)。
		// natal 只带 bornYear/male,行年由求值 ctx.xingnian() 按 pan 候选年现算。
		return {
			mingZhi,
			bornYear,
			male,
			label: `本命${mingZhi} · 行年随候选年推(男寅顺女申逆)`,
		};
	}catch(e){
		return null;
	}
}

export default class LiurengZeriMain extends Component{
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
			// 扫描参数六键(逐键判别力由 liurengZeriEngine 金标证:贵人流派/阴阳系/月将两档/
			// 换日/晚子时/时基;昼夜=日出方程自动判,非档位)。
			options: { guirengType: 0, yueMode: 'zhongqi', after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay() },	// 日界两键=全局**现值**(主六壬页同源;复审 F8)	// timeAlg 恒真太阳(主页 gods 固有口径,非可调档)
			natal: null,          // 用事人本命(resolveNatal 产物;选填,解锁本命组条件)
			natalInput: { date: '', time: '12:00', zone: '+08:00', gender: 1 },
			tree: initialTree(),
			chartValue: null,	// 后端 /chart Result(六壬起排需 value.chart 底盘;宿主自管,pick 后重拉)
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		// LiuRengMain 重排是 hook 驱动(fields prop 变化不自触发):宿主持 hook,
		// pick 后手动 hook.fun(新 fields) 走标准重排链。
		this.liurengHook = {};
		this._abort = null;
		this._scanCfg = null;
		this._scanGeo = null;
		this._scanOptions = null;
		this._scanTree = null;
		this._scanNatal = null;
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
		// 初排当前时刻(主六壬页由全局命盘链供 value;宿主自管同形链)
		this.requestChartAndPlot();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	// 拉 /chart 底盘并触发六壬起排(hook.fun 双参:fields+chartObj——LiuRengMain
	// startPaiPanByFields 需 value.chart,缺则静默不排,真机实抓)。
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
			name: '六壬择日',
			cid: null,
			// 🔴 口径三键与扫描 options 全等(真机实抓:漏 timeAlg 时底盘走后端默认真太阳,
			// 03:01 钟表被排成 02:41 丑时盘,三传/课名与扫描徽标整盘背离——pick 所见≠扫描所判)
			timeAlg: 0,	// 恒真太阳(主页六壬 gods 固有口径)
			after23NewDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.after23NewDay !== undefined ? o.after23NewDay : 1; })(),
			lateZiHourUseNextDay: (()=>{ const o = (frozen && this._scanOptions) || this.state.options || {}; return o.lateZiHourUseNextDay !== undefined ? o.lateZiHourUseNextDay : 1; })(),
		};
		// 代际号:连续两次 pick(或初排与 pick 竞争)后到者胜——旧响应静默丢弃(乱序覆盖实抓)
		const epoch = (this._chartEpoch = (this._chartEpoch || 0) + 1);
		fetchChart(param, { silent: true }).then((rsp)=>{
			if(this.unmounted || epoch !== this._chartEpoch || !rsp || !rsp.Result || !rsp.Result.params){
				return;
			}
			const Result = rsp.Result;
			Result.chartId = `lrz${Date.now().toString(36)}`;
			this.setState({ chartValue: Result }, ()=>{
				if(this.liurengHook && typeof this.liurengHook.fun === 'function'){
					// 🔴 用发起本次请求的同一份 fields(曾现取活值配旧 Result=fields/底盘错配)
					this.liurengHook.fun(fields, Result);
				}
			});
		}).catch(()=>{ /* 后端不可达:盘区留空,择时判定(本地引擎)不受影响 */ });
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	// [布局改造] 左栏入口板块(经 LiuRengMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="六壬择日"
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
		return JSON.stringify({ cfg: this.state.cfg, geo: this.state.geo, options: this.state.options, natal: this.state.natal, tree: this.state.tree });
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
			compiled = compileLiurengTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		const geo = { ...(this.state.geo || {}) };
		const options = { ...(this.state.options || {}) };
		const natal = this.state.natal ? { ...this.state.natal } : null;
		this._scanCfg = cfg;
		this._scanGeo = geo;
		this._scanOptions = options;
		this._scanTree = compiled;
		this._scanNatal = natal;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			liurengZeriSchemeStore.pushHistory({ cfg, geo, options, natal }, this.state.tree);
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
			const res = await scanLiureng({
				cfg,
				geoParams: this.buildGeoParams(geo),
				options: { ...options, _natal: natal },
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
			this.requestChartAndPlot(true);
		});
	}

	explainRow(row){
		return Promise.resolve(explainLiurengAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: { ...(this._scanOptions || this.state.options || {}), _natal: this._scanNatal },
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
		}));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildLiurengZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				geo: this._scanGeo || this.state.geo,
				natal: this._scanNatal || this.state.natal,
				tree: this._scanUiTree || this.state.tree,	// 冻结树:与命中行同源(活树曾致条件描述≠结果,复审 F5)
				results: this.state.results,
				truncated: this.state.truncated,
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
			gender: mkField(o.gender !== undefined ? o.gender : 1),
			timeAlg: mkField(0),
		};
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-liureng-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<LiuRengMain
						value={this.state.chartValue}
						fields={this.buildFields()}
						hook={this.liurengHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="liurengzeri"
						composeAiSnapshot={this.composeAiSnapshot}
						renderLeftExtra={this.renderLeftExtra}
					/>
				</div>
				<LiurengZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					geo={this.state.geo}
					onGeoChange={this.onGeoChange}
					options={this.state.options}
					onOptionsChange={(options)=>this.setState({ options })}
					natal={this.state.natal}
					natalInput={this.state.natalInput}
					onNatalInputChange={(natalInput)=>this.setState({ natalInput })}
					onResolveNatal={()=>{
						const n = resolveNatal(this.state.natalInput);
						this.setState({ natal: n });
						return n;
					}}
					onClearNatal={()=>this.setState({ natal: null })}
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					onPreviewPan={(d, t)=>computeLiurengScanPan(this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.state.options || {}) }, d, t)}
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
