// [Z4·紫微择日] 择日页子技法宿主:内嵌完整 <ZiWeiMain>(techniqueScope='ziweizeri' 独立
// 快照槽,与主紫微页 keep-alive 并存互不竞写)。宿主自管 fields(左栏入口板块经
// renderLeftExtra 插槽进 ZiWeiMain 左栏最顶),pick 命中时刻 hook.fun(fields) 重排。
// 快照冻结纪律(天星/奇门/黄历/八字/太乙同款):_scanCfg/_scanGeo/_scanOptions/_scanTree/
// _scanNatal;_scanUiJson 指纹驱动 resultsStale。显示盘=主页链(默认档走 Java 盘),扫描
// 判定=本地 lite 引擎 Java 兼容口径——两侧一致性由 ziweiZeriEngine 24 例网格金标看守。
import { Component } from 'react';
import ZiWeiMain from '../ziwei/ZiWeiMain';
import ZiweiZeriWorkbench from './ZiweiZeriWorkbench';
import ZeriHostEntry from './ZeriHostEntry';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { newZiweiLeaf, newZiweiGroup, compileZiweiTree } from '../../divination/zeri/ziweiZeriConditionTypes';
import { scanZiwei, explainZiweiAt, computeZiweiScanPan } from '../../divination/zeri/ziweiZeriScanEngine';
import { buildZiweiZeriSnapshotExtra } from '../../divination/zeri/ziweiZeriSnapshot';
import { ziweiZeriSchemeStore } from '../../divination/zeri/schemeStore';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newZiweiGroup('all'), children: [newZiweiLeaf('ming_zhu_xing')] };
}
function mkField(v){
	return { value: v };
}
function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}

// 解析本命(工作台「用事人本命」区):lite 排一次本命紫微盘取命宫地支(+命主随注)。
// 判定与扫描同引擎同口径(Java 兼容三键)——本命命宫与主页默认态盘一致。
const ZHI12_N = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function resolveNatal({ date, time, zone, gender }){
	try{
		const p = computeZiweiScanPan({ zone: zone || '+08:00' }, { gender: gender === 0 ? 0 : 1 }, date, time || '12:00:00');
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

export default class ZiweiZeriMain extends Component{
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
			// 扫描参数:timeAlg/gender 常驻;其余引擎键 undefined=默认(引擎内 Java 兼容三键兜底),
			// 工作台 15 键全参数可调(逐键判别力已由 ziweiZeriEngine 金标证)。
			options: { timeAlg: 1, gender: 1 },
			natal: null,          // 用事人本命(resolveNatal 产物;选填,解锁本命组条件)
			natalInput: { date: '', time: '12:00', zone: '+08:00', gender: 1 },
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

	// [布局改造] 左栏入口板块(经 ZiWeiMain renderLeftExtra 插槽进其左栏最顶;顶条方案废除——
	// 用户反馈横条占整行,照天星「征象搜索」左栏形制)。
	renderLeftExtra(){
		return (
			<ZeriHostEntry
				label="紫微择日"
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
			compiled = compileZiweiTree(this.state.tree);
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
			ziweiZeriSchemeStore.pushHistory({ cfg, geo, options, natal }, this.state.tree);
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
			const res = await scanZiwei({
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
			if(this.ziweiHook && typeof this.ziweiHook.fun === 'function'){
				this.ziweiHook.fun(this.buildFields(true));
			}
		});
	}

	explainRow(row){
		return Promise.resolve(explainZiweiAt({
			geoParams: this.buildGeoParams(this._scanGeo || this.state.geo),
			options: { ...(this._scanOptions || this.state.options || {}), _natal: this._scanNatal },
			tree: this._scanTree,
			t: row.pick || `${row.start}:00`,
		}));
	}

	composeAiSnapshot(baseText){
		try{
			const extra = buildZiweiZeriSnapshotExtra({
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
			timeAlg: mkField(o.timeAlg !== undefined ? o.timeAlg : 1),
		};
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail tabpane flex 宿主显式撑满(奇门/黄历同律)。
			<div className="horosa-zeri-ziwei-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				<div style={{ flex: 1, minHeight: 0 }}>
					<ZiWeiMain
						fields={this.buildFields()}
						hook={this.ziweiHook}
						height={this.props.height ? this.props.height - 40 : undefined}
						techniqueScope="ziweizeri"
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
					onPreviewPan={(d, t)=>computeZiweiScanPan(this.buildGeoParams(this._scanGeo || this.state.geo), { ...(this._scanOptions || this.state.options || {}) }, d, t)}
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
