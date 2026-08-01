// 主限法 3D 天球(WS-3)宿主组件。
//
// 数据链:AstroDirectMain.buildPrimaryDirectionRequest(与 /predict/pd 同源构参,经
// buildRequest prop 注入 —— 绝不本地复刻构参,防两处漂移)→ services/astroPd3d.fetchPd3D
// (幂等缓存+在途合流)→ PDSphereEngine(赤道天球+地平三圈+周日运动播放)。
//
// AI 快照口径:主限天球不新增快照段 —— AI 导出/挂载复用主限表既有段
// (AstroDirectMain.buildPrimaryDirectSnapshotText → saveModuleAISnapshot('primarydirect'),
// 数据=同一份 pd 表行),本组件零新增段,防 AI 段表漂移。
import { Component } from 'react';
import { safeJsonStringifyToStorage, safeLocalStorageSet } from '../../utils/safeStorage';
import { registerWebglFrameProvider } from '../../utils/pageScreenshot';
// Popover / Checkbox 随「扩展」面板抽进 PdExtensionPanel 后本文件已不再直接用到。
import { Button, Spin, Select } from 'antd';
import PdExtensionPanel from '../astro/PdExtensionPanel';
import { PD_SIGNIFICATOR_OPTIONS, PD_PROMISSOR_TYPE_OPTIONS } from '../../utils/primaryDirectionSync';
import PDSphereEngine from './PDSphereEngine';
import { fetchPd3D } from '../../services/astroPd3d';
import * as AstroText from '../../constants/AstroText';
import { getPdMethodLabel, getPdTimeKeyLabel } from '../../utils/primaryDirectionSync';
import {
	rowAgeYears, rowDateMs, isConverseRow, nearestRowIndexByAge, moverOfRow,
	bodySpeedMapOf,
} from './pdSphereMath';
import {
	TL_ZOOM_MIN, TL_ZOOM_MAX,
	clampZoom, fitPxPerYear, niceTickStep, rowGlyphSegs, estSegsWidth, packLanes, chipModeOf,
} from './pdTimelineMath';

const DIRECT_HEX = '#ffd700';     // 顺向金(与引擎 PD_COLOR.direct 同值)
const CONVERSE_HEX = '#00e0e0';   // 逆向青(与引擎 PD_COLOR.converse 同值)
const TIMELINE_H = 172; // [G4] 时间轴 3.0 轨道高(双泳道各三车道;[P5] 章档 18px 章高+22px 车距,可读性定案)
const TL_CTRL_H = 26;   // [G4] 时间轴控制行(缩放滑杆/适配/图例)
const TOOLBAR_H = 40;
const PAD_X = 26;                 // 时间轴左右留白
// [P6] 本组件底色恒深(#05080f/#070b14 写死),antd 按钮却随亮暗主题换肤 → 亮档白底钮浮在深底上
// 突兀且违背「此处颜色不随主题适配」定案 —— 全部钉死深底幽灵样式。
const BTN_DARK = { background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(150,170,205,0.45)', color: '#c8d4e8' };

// [E1] 年龄轴上限岁数选项(pdYears;后端上限 360)。
const AGE_YEARS_OPTIONS = [50, 80, 100, 120, 150, 200, 300, 360];

/** 点位 id → 中文短名(与主限表 directionObjText 同一套 id 语法;此处不带宫位注记) */
function pdPointShortName(pid){
	const text = `${pid || ''}`;
	const parts = text.split('_');
	const cn = (id)=>{
		if(id && `${id}`.indexOf('House') === 0){
			return `${`${id}`.slice(5)}宫`;
		}
		// S/P 扩展本体短名(与表格 pdBodyText 同义)
		const mc = /^Cusp(\d+)$/.exec(`${id || ''}`);
		if(mc){
			return `第${mc[1]}宫头`;
		}
		if(`${id}` === 'Syzygy'){
			return '产前朔望';
		}
		if(`${id}` === 'Spirit'){
			return '精神点';
		}
		return AstroText.AstroTxtMsg[id] || AstroText.AstroMsgCN[id] || `${id || ''}`;
	};
	if(parts.length < 2){
		return text;
	}
	if(parts[0] === 'T'){
		return `${cn(parts[2])}的${cn(parts[1])}界`;
	}
	if(parts[0] === 'A'){
		return `${cn(parts[1])}映点`;
	}
	if(parts[0] === 'C'){
		return `${cn(parts[1])}反映点`;
	}
	if(parts[0] === 'D'){
		return `${cn(parts[1])}右${parts[2]}°`;
	}
	if(parts[0] === 'S'){
		return `${cn(parts[1])}左${parts[2]}°`;
	}
	if(parts[0] === 'N'){
		if(parts[2] && parts[2] !== '0'){
			return `${cn(parts[1])}${parts[2]}°`;
		}
		return cn(parts[1]);
	}
	// P2 扩展迫星七前缀短名(时间轴章/播放盖章/AI「动画所指」同用;绝不裸 ID)
	if(parts[0] === 'PD'){
		return `${cn(parts[1])}平行点`;
	}
	if(parts[0] === 'PC'){
		return `${cn(parts[1])}反平行点`;
	}
	if(parts[0] === 'MP' || parts[0] === 'RP'){
		const axis = { '0': 'MC', '90': 'ASC', '180': 'IC', '270': 'DSC' }[parts[2]] || parts[2];
		return `${cn(parts[1])}${parts[0] === 'MP' ? '世平行' : '急平行'}·${axis}`;
	}
	if(parts[0] === 'FS'){
		return `★${cn(parts[1])}`;
	}
	if(parts[0] === 'LT'){
		return `${`${cn(parts[1])}`.replace(/^Pars /, '')}点`;
	}
	if(parts[0] === 'HC'){
		const mh = /^Cusp(\d+)$/.exec(`${parts[1] || ''}`);
		return `第${mh ? mh[1] : parts[1]}宫头`;
	}
	return text;
}

/** 弧度值 → 度分文本(逆向负弧显示绝对值,方向语义由 顺/逆 前缀承担) */
function arcDegreeText(arc){
	const num = Math.abs(Number(arc));
	if(!Number.isFinite(num)){
		return `${arc || ''}`;
	}
	let d = Math.floor(num);
	let m = Math.round((num - d) * 60);
	if(m >= 60){
		m = 0;
		d += 1; // 分进位到 60 → 度 +1,免度数少 1(如 5.999→原显 5°00′,应 6°00′)
	}
	return `${d}°${m < 10 ? '0' : ''}${m}′`;
}

/** 表行一句话摘要(工具条/时间轴 tooltip 共用) */
function rowSummary(row){
	if(!row){
		return '';
	}
	const conv = isConverseRow(row);
	return `${conv ? '逆向' : '顺向'} ${arcDegreeText(row.arc)} ${pdPointShortName(row.prom)} → ${pdPointShortName(row.sig)}${row.date ? ` · ${row.date}` : ''}`;
}

/** pd3d 请求的重取键:与 AstroDirectMain.requestPrimaryDirectionRows 的 reqKey 同字段序 */
function computeReqKey(req){
	if(!req){
		return '';
	}
	try{
		return JSON.stringify({
			date: req.date,
			time: req.time,
			zone: req.zone,
			lat: req.lat,
			lon: req.lon,
			hsys: req.hsys,
			zodiacal: req.zodiacal,
			siderealAyanamsa: req.siderealAyanamsa,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			showPdBounds: req.showPdBounds,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			// 🔴 P0/P2 九新键必须进重取键:漏键=改投影/分宫/平行/扩展/自定义率后
			// 判「同请求」跳过 fetch → 天球与时间轴死不更新(用户实测「扩展不进时间轴」)。
			pdProjection: req.pdProjection,
			pdFrame: req.pdFrame,
			pdFramework: req.pdFramework,
			pdParallel: req.pdParallel,
			pdRaptParallel: req.pdRaptParallel,
			pdTimeKeyCustom: req.pdTimeKeyCustom,
			pdSignificators: req.pdSignificators,
			pdPromissorTypes: req.pdPromissorTypes,
			termsVariant: req.termsVariant,
			pdaspects: req.pdaspects,
		});
	}catch(e){
		return '';
	}
}

// horosa_shallow_scu_v1:逐键浅比较。**未知即"变了"** —— 键数不同 / 任一键引用不同 → false。
function shallowSame(a, b){
	if(a === b){ return true; }
	if(!a || !b || typeof a !== 'object' || typeof b !== 'object'){ return false; }
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if(ka.length !== kb.length){ return false; }
	for(let i=0; i<ka.length; i++){
		const k = ka[i];
		if(!Object.prototype.hasOwnProperty.call(b, k)){ return false; }
		if(a[k] !== b[k]){ return false; }
	}
	return true;
}

class AstroPDSphere extends Component{

	constructor(props){
		super(props);
		this.state = {
			loading: false,
			err: '',
			rows: [],
			selIdx: -1,
			dragAge: null,     // 拖拽游标年龄(非拖拽态 null)
			hoverIdx: -1,      // 拖拽中最近表行(实时高亮)
			plotW: 0,          // 时间轴视口宽(测量驱动;适配档=此宽/年限)
			tlZoom: null,      // [G4] px/年 缩放(null=适配面板宽;localStorage 记忆)
			// [E1] 年龄轴岁数覆写(null=跟随主限法设置的 props.pdYears);后天宫位固定 Alchabitius,不设选择器。
			axisYears: null,   // 年龄轴上限岁数覆写(驱动 pdYears 重取 + 轴显示)
			showHouses: false, // [E1] 后天宫位(Alchabitius)宫首在黄道上的显示开关
			trueMotion: true,  // [C1] 复合运动·真位层(周日旋转×黄道自行;默认开,localStorage 记忆)
			trueInfo: null,    // [C1] 播放落定信息 {elapsedText, drifts}(引擎回调喂入;DOM 信息行)
		};
		try{
			const tz = parseFloat(localStorage.getItem('horosa.pdsphere.tlZoom'));
			if(Number.isFinite(tz) && tz > 0){ this.state.tlZoom = clampZoom(tz); }
			const ay = parseInt(localStorage.getItem('horosa.pdsphere.axisYears'), 10);
			if(Number.isFinite(ay) && ay > 0){ this.state.axisYears = Math.min(360, Math.max(20, ay)); }
			this.state.showHouses = localStorage.getItem('horosa.pdsphere.showHouses') === '1';
		}catch(_){ }
		this._tlScroll = null;   // [G4] 时间轴横向滚动容器(原生 wheel 非 passive 监听挂此)
		this._tlWheel = null;
		this.engine = null;
		this.res = null;            // 最近一次 pd3d 响应(engine 之外时间轴也消费 rows)
		this.pendingRes = null;     // 引擎未就绪(容器无尺寸)时暂存,就绪即装载
		this.unmounted = false;
		this.reqSeq = 0;
		this.lastReqKey = '';
		this.hostRef = null;
		this.rootRef = null;
		this._ro = null;
		this._raf = 0;
		this._dragTimer = null;
		this._dragging = false;

		this.handleRetry = this.handleRetry.bind(this);
		this.handlePlaySelected = this.handlePlaySelected.bind(this);
		this.handleResetRotation = this.handleResetRotation.bind(this);
		this.handleTimelineDown = this.handleTimelineDown.bind(this);
		this.handleTimelineMove = this.handleTimelineMove.bind(this);
		this.handleTimelineUp = this.handleTimelineUp.bind(this);
		this.handleTimelineLeave = this.handleTimelineLeave.bind(this);
		this.attachTlScroll = this.attachTlScroll.bind(this);
		this.setTlZoom = this.setTlZoom.bind(this);
	}

	// horosa_shallow_scu_v1:本组件此前**无 sCU** —— 宿主每次重渲(改任何选项/切子页签)都要重跑
	// 一遍时间轴 SVG 的车道排布(packLanes)+ 上百个事件节点的 map,而绝大多数这类重渲的
	// props/state 与上一次逐键同引用。这里只跳过「输入完全没变」的重复渲染:任何键引用不同、
	// 键数不同、非对象 → 一律返回 true 照常渲染,不可能漏更新。
	// 注意与 componentDidUpdate 的关系:跳过时 componentDidUpdate 不跑,故 fetchData 不被调用 ——
	// 但那一次本来 props 也没变,fetchData 会被 lastReqKey 短路,行为完全一致。
	shouldComponentUpdate(nextProps, nextState){
		if(!shallowSame(this.props, nextProps)){ return true; }
		if(!shallowSame(this.state, nextState)){ return true; }
		return false;
	}

	componentDidMount(){
		this.unmounted = false;
		// [WP-B] 「播完回位」checkbox 与引擎行为同源 localStorage,挂载时同步显示态(引擎在播放时直读该键)。
		// [WP-A] 视角档按钮同步(引擎构造器读同键,双方一致)。
		try{
			if(localStorage.getItem('horosa.pdsphere.autoResetAfterPlay') === '1'){
				this.setState({ autoResetAfterPlay: true });
			}
			if(localStorage.getItem('horosa.pdsphere.trueMotion') === '0'){
				this.setState({ trueMotion: false });   // [C1] 与引擎构造器同键同步显示态
			}
			const vm0 = localStorage.getItem('horosa.pdsphere.viewMode');
			if(vm0 === 'observer' || vm0 === 'center'){ // [P2] 三档同步(globe=缺省不必置)
				this.setState({ viewMode: vm0 });
			}
		}catch(_){ }
		this.measureAndEnsureEngine();
		if(typeof ResizeObserver !== 'undefined' && this.hostRef){
			this._ro = new ResizeObserver(()=>{
				if(this._raf){
					cancelAnimationFrame(this._raf);
				}
				this._raf = requestAnimationFrame(()=>this.measureAndEnsureEngine());
			});
			this._ro.observe(this.hostRef);
		}
		// [WP-5.4] 导出附图:注册引擎帧 provider(Word/PDF 导出遇 WebGL 页时取当前 3D 帧当附图)。
		this._unregWebglFrame = registerWebglFrameProvider(()=>(this.engine ? this.engine.captureFrame() : null));
		this.fetchData();
	}

	componentDidUpdate(prevProps){
		// FreezeInactive 冻结非激活面板 → 本钩子只在激活/参数变化时走到;
		// 参数是否真变以「与 /predict/pd 同源的重取键」判定(引用变≠值变,防无谓重拉)。
		if(prevProps.height !== this.props.height){
			this.measureAndEnsureEngine();
		}
		if(this.props.active && !prevProps.active && this.engine){
			this.engine.wake(2);
		}
		// 分宫切换 → 宫首宫制随之重画(engine 内部同值早退,不触发无谓重建)。
		if(this.engine && this.engine.setPdFrame && prevProps.pdFrame !== this.props.pdFrame){
			this.engine.setPdFrame(this.props.pdFrame);
		}
		// [C1] 盘换 → 瞬时速表热更(逆行/速度随盘;引用同即免)
		if(this.engine && this.engine.setBodySpeeds && prevProps.value !== this.props.value){
			this.engine.setBodySpeeds(bodySpeedMapOf(this.props.value));
		}
		this.fetchData();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._unregWebglFrame){
			this._unregWebglFrame();
			this._unregWebglFrame = null;
		}
		if(this._ro){
			try{
				this._ro.disconnect();
			}catch(e){ /* ignore */ }
			this._ro = null;
		}
		if(this._raf){
			cancelAnimationFrame(this._raf);
			this._raf = 0;
		}
		if(this._dragTimer){
			clearTimeout(this._dragTimer);
			this._dragTimer = null;
		}
		if(this._tlScroll && this._tlWheel){
			this._tlScroll.removeEventListener('wheel', this._tlWheel);
			this._tlScroll = null;
			this._tlWheel = null;
		}
		if(this.engine){
			this.engine.dispose();
			this.engine = null;
		}
	}

	// —— 引擎就绪(容器有真实尺寸才建;TabPane 首次激活前可能宽高 0) ——
	measureAndEnsureEngine(){
		if(this.unmounted || !this.hostRef){
			return;
		}
		const w = this.hostRef.clientWidth;
		const h = this.hostRef.clientHeight;
		if(this.state.plotW !== w){
			this.setState({ plotW: w });
		}
		if(w < 200 || h < 200){
			return;
		}
		if(!this.engine){
			this.engine = new PDSphereEngine({ dom: this.hostRef, width: w, height: h,
				onError: (msg)=>{ if(!this.unmounted){ this.setState({ err: `渲染层建场部分失败（数据已到）：${msg}。可点「重算」重试;其余部件已尽量呈现。` }); } } });
			this.engine.init();
			// [L1] checkbox 显示态与引擎真值同源(引擎构造器已读 localStorage 记忆;
			// 旧 render 兜底写死默认值 → 记忆过的开关刷新后「行为已变而勾选框没变」,一并归位)
			this.setState({
				frameLayers: { ...this.engine.frameLayers },
				virtualToggles: { ...this.engine.virtualToggles },
				focusMode: this.engine.focusMode !== false,
			});
			// [E1] 后天宫位显示初值同步引擎(localStorage 记忆的开关在首帧生效)
			// 宫首宫制随「定局分宫」——须在 setHouseDisplay 前置好,否则首帧按默认 Alcabitius 画。
			if(this.engine.setPdFrame){ this.engine.setPdFrame(this.props.pdFrame); }
			if(this.engine.setHouseDisplay){ this.engine.setHouseDisplay(!!this.state.showHouses); }
			// [C1] 复合运动:/chart objects 瞬时黄经速喂引擎(含逆行;缺则引擎回退平均日行表)+ 落定信息行回调
			if(this.engine.setBodySpeeds){ this.engine.setBodySpeeds(bodySpeedMapOf(this.props.value)); }
			this.engine.onTrueMotionInfo = (info)=>{
				if(!this.unmounted){ this.setState({ trueInfo: info }); }
			};
			// [WP-D] 3D 拾取回调:点实体天体 → 选该点参与的最近应期行(有选中行按其年龄就近;无则第一条)并播放
			this.engine.onPickPoint = (pid)=>{
				if(this.unmounted){ return; }
				const rows = this.state.rows || [];
				const cand = [];
				rows.forEach((r, i)=>{ if(r && (r.prom === pid || r.sig === pid)){ cand.push(i); } });
				if(!cand.length){ return; }
				let pick = cand[0];
				const curIdx = this.state.selIdx;
				if(curIdx >= 0 && rows[curIdx]){
					const birthMs = this.getBirthMs ? this.getBirthMs() : null;
					const refAge = rowAgeYears(rows[curIdx], birthMs);
					if(Number.isFinite(refAge)){
						let best = Infinity;
						cand.forEach((i)=>{
							const a = rowAgeYears(rows[i], birthMs);
							const d = Number.isFinite(a) ? Math.abs(a - refAge) : Infinity;
							if(d < best){ best = d; pick = i; }
						});
					}
				}
				this.selectAndPlay(pick);
			};
			if(this.pendingRes){
				this.engine.setData(this.pendingRes);
				this.pendingRes = null;
			}
		}else{
			this.engine.resize(w, h);
		}
	}

	// —— 取数(构参与 /predict/pd 完全同源:buildRequest = AstroDirectMain 已绑方法) ——
	fetchData(force){
		const build = this.props.buildRequest;
		const req = typeof build === 'function' ? build(this.props.value || {}) : null;
		if(!req){
			// base 盘缺日期等必备字段:不发请求(与 buildPrimaryDirectionRequest 的 NaN 守卫同口径)
			if(this.lastReqKey !== ''){
				this.lastReqKey = '';
			}
			return;
		}
		// [E1] 年龄轴岁数覆写打进请求(computeReqKey 含 pdYears → 覆写即触发重取;数据与轴同步扩展)。
		//  后天宫位固定 Alchabitius(不覆写 pdMethod);宫首显示纯前端派生。
		if(Number.isFinite(this.state.axisYears) && this.state.axisYears > 0){ req.pdYears = this.state.axisYears; }
		const key = computeReqKey(req);
		if(!force && key && key === this.lastReqKey){
			return;
		}
		this.lastReqKey = key;
		const seq = ++this.reqSeq;
		this.setState({ loading: true, err: '' });
		fetchPd3D(req).then((res)=>{
			if(this.unmounted || seq !== this.reqSeq){
				return;
			}
			if(!res || res.err || !res.frame){
				try{ console.warn('[AstroPDSphere] 数据判失败:', res ? { err: res.err, keys: Object.keys(res).slice(0, 12) } : res); }catch(_){ }
				this.setState({ loading: false, err: '主限天球数据获取失败：本地排盘服务未就绪或参数无效。' });
				return;
			}
			this.res = res;
			const rows = Array.isArray(res.rows) ? res.rows : [];
			this.setState({ loading: false, err: '', rows, selIdx: -1, hoverIdx: -1, dragAge: null });
			// 引擎装载与网络错误隔离:setData 内任何渲染异常曾顺着 promise 链掉进 catch,
			// 被误报成「本地排盘服务未就绪」(实爆:数据 200 而报错卡常驻)——就地捕获暴露真因。
			try{
				if(this.engine){
					this.engine.setData(res);
				}else{
					this.pendingRes = res;
					this.measureAndEnsureEngine();
				}
			}catch(e){
				try{ console.error('[AstroPDSphere] 引擎装载异常(数据已到,渲染层报错):', e); }catch(_){ }
				if(!this.unmounted){ this.setState({ err: `渲染层装载异常（数据已到）：${(e && e.message) || e}。可点「重算」重试。` }); }
			}
		}).catch((e)=>{
			try{ console.warn('[AstroPDSphere] fetch 异常:', e && (e.stack || e.message || e)); }catch(_){ }
			if(this.unmounted || seq !== this.reqSeq){
				return;
			}
			this.setState({ loading: false, err: '主限天球数据获取失败：本地排盘服务未就绪。' });
		});
	}

	handleRetry(){
		this.fetchData(true);
	}

	// —— 出生时刻(时间轴年龄基准;沿用快照链 Date.parse 解析口径) ——
	getBirthMs(){
		const params = (this.props.value && this.props.value.params) || {};
		const t = rowDateMs(params.birth);
		return Number.isFinite(t) ? t : NaN;
	}

	getAxisYears(){
		// [E1] 页内覆写优先;否则跟随主限法设置的 props.pdYears。
		if(Number.isFinite(this.state.axisYears) && this.state.axisYears > 0){
			return this.state.axisYears;
		}
		const y = Math.round(Number(this.props.pdYears));
		return Number.isFinite(y) && y > 0 ? y : 100;
	}


	// —— [G4] 时间轴缩放(px/年 唯一标尺;tlZoom=null → 适配面板宽) ——
	getPxPerYear(){
		const fit = fitPxPerYear(Math.max(120, (this.state.plotW || 320) - PAD_X * 2), this.getAxisYears());
		const z = this.state.tlZoom;
		return z ? clampZoom(z) : fit;
	}

	/** 设缩放并锚定(anchorClientX=光标锚点;null=视口中心锚定;next=null 回适配档) */
	setTlZoom(next, anchorClientX){
		const sc = this._tlScroll;
		const prev = this.getPxPerYear();
		const z = next === null ? null : clampZoom(next);
		let anchorAge = null;
		let vx = 0;
		if(sc){
			const rect = sc.getBoundingClientRect();
			vx = (anchorClientX !== null && anchorClientX !== undefined) ? (anchorClientX - rect.left) : rect.width / 2;
			anchorAge = (sc.scrollLeft + vx - PAD_X) / Math.max(0.0001, prev);
		}
		this.setState({ tlZoom: z }, ()=>{
			safeLocalStorageSet('horosa.pdsphere.tlZoom', z === null ? '' : String(z));
			if(sc && anchorAge !== null){
				const cur = this.getPxPerYear();
				sc.scrollLeft = Math.max(0, anchorAge * cur + PAD_X - vx);
			}
		});
	}

	/** 滚动容器 ref:挂原生非 passive wheel(React onWheel 是 passive,preventDefault 无效)——
	 *  Ctrl/⌘+滚轮=光标锚定缩放;竖滚轮=横向平移(剪辑软件手感) */
	attachTlScroll(el){
		if(this._tlScroll === el){
			return;
		}
		if(this._tlScroll && this._tlWheel){
			this._tlScroll.removeEventListener('wheel', this._tlWheel);
		}
		this._tlScroll = el;
		this._tlWheel = null;
		if(el){
			this._tlWheel = (e)=>{
				if(e.ctrlKey || e.metaKey){
					e.preventDefault();
					const k = Math.exp(-e.deltaY * 0.0022);
					this.setTlZoom(this.getPxPerYear() * k, e.clientX);
				}else if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
					e.preventDefault();
					el.scrollLeft += e.deltaY;
				}
			};
			el.addEventListener('wheel', this._tlWheel, { passive: false });
		}
	}

	// —— [WP-5.5] AI 快照可选行:把当前选中行的语义文本盖章进 storage,
	//    AstroDirectMain.buildPrimaryDirectSnapshotText 读取后附「当前动画所指」段。
	//    零再推导 —— 全部字段来自 row 本身(rowSummary+cat 口径字样)。
	_stampAiCurrentRow(row){
		const catTxt = row.cat === 'M' ? '世俗 In Mundo' : (row.cat === 'T' ? '界推运' : '黄道 In Zodiaco');
		safeJsonStringifyToStorage('horosa.pdsphere.aiCurrentRow', { txt: `${rowSummary(row)}（${catTxt}口径）`, ts: Date.now() });
	}

	// —— 行选择与播放 ——
	selectAndPlay(idx){
		const row = this.state.rows[idx];
		if(!row || !this.engine){
			return;
		}
		this.setState({ selIdx: idx, hoverIdx: -1 });
		this._stampAiCurrentRow(row);
		const conv = isConverseRow(row);
		// [D1] 头顶卡按实际动方叙事(用户批准口径:「A → B」= A 被引导至 B):
		//  行星族应星动 → 「应星·金星 → 迫星·福点·90°」;轴/M/T 迫星动 → 原序。
		//  时间轴章/表格保持 prom→sig 原名序不动(表意=行身份)。
		const a = pdPointShortName(row.prom);
		const b = pdPointShortName(row.sig);
		const pair = moverOfRow(row) === 'sig' ? `${b} → ${a}` : `${a} → ${b}`;
		const card = `${conv ? '逆向 Converse' : '顺向 Direct'} ${arcDegreeText(row.arc)} · ${pair}`;
		this.engine.playRow(idx, card);
	}

	selectOnly(idx){
		const row = this.state.rows[idx];
		if(!row || !this.engine){
			return;
		}
		this.setState({ selIdx: idx, hoverIdx: -1 });
		this._stampAiCurrentRow(row);
		this.engine.rotateToRow(idx);
	}

	handlePlaySelected(){
		if(this.state.selIdx >= 0){
			this.selectAndPlay(this.state.selIdx);
		}
	}

	handleResetRotation(){
		if(this.engine){
			this.engine.resetRotation();
		}
	}

	// —— 时间轴拖拽(拖=最近行实时高亮;松手 debounce 300ms 落行。主限天球以 3D 转动
	//    呈现拖点时刻,故不再 POST /predict/pdchart 取 2D 快照 —— 该端点为主限法盘
	//    (AstroPrimaryDirectionChart)专用,此处无消费方,发了就是死请求) ——
	timelineAgeFromEvent(evt){
		const svg = evt.currentTarget;
		const rect = svg.getBoundingClientRect();
		const plotW = Math.max(1, rect.width - PAD_X * 2);
		const x = evt.clientX - rect.left - PAD_X;
		const ratio = Math.max(0, Math.min(1, x / plotW));
		return ratio * this.getAxisYears();
	}

	handleTimelineDown(evt){
		// 🔴 断掉按下时的 focus 默认行为:焦点滚动会把 overflow:hidden 的祖先容器
		// 编程式滚出视口(用户实告:选中章后向上滚,整页被顶出空白)。拖拽用 pointer 事件,不受影响。
		if(evt && evt.preventDefault){ evt.preventDefault(); }
		// 🔴 拖拽期锁定 pointer 到本 svg:WebKit 拖拽 autoscroll 会自动滚动可滚祖先
		// (「拖动选中之后才发生」的真机路径),capture 后不再寻祖滚动。
		try{ if(evt && evt.currentTarget && evt.currentTarget.setPointerCapture && evt.pointerId !== undefined){ evt.currentTarget.setPointerCapture(evt.pointerId); this._tlCaptured = { el: evt.currentTarget, id: evt.pointerId }; } }catch(e){ /* 老内核无 capture,守卫链兜底 */ }
		if(!this.state.rows.length){
			return;
		}
		this._dragging = true;
		this.applyDragAge(this.timelineAgeFromEvent(evt));
	}

	handleTimelineMove(evt){
		if(!this._dragging){
			return;
		}
		this.applyDragAge(this.timelineAgeFromEvent(evt));
	}

	handleTimelineLeave(){
		// 🔴 捕获期忽略 pointerleave:capture 后指针越出 svg 仍会发一次 leave,此时释放
		// 捕获=WebKit 拖拽 autoscroll 复活(寻可滚祖先把页面顶出)。真正的结束只认 up。
		if(this._tlCaptured){ return; }
		this.handleTimelineUp();
	}

	handleTimelineUp(){
		if(this._tlCaptured){
			try{ this._tlCaptured.el.releasePointerCapture(this._tlCaptured.id); }catch(e){ /* 已释放 */ }
			this._tlCaptured = null;
		}
		if(!this._dragging){
			return;
		}
		this._dragging = false;
		const idx = this.state.hoverIdx;
		this.setState({ dragAge: null });
		if(this._dragTimer){
			clearTimeout(this._dragTimer);
		}
		this._dragTimer = setTimeout(()=>{
			this._dragTimer = null;
			if(!this.unmounted && idx >= 0){
				this.selectOnly(idx);
			}
		}, 300);
	}

	applyDragAge(age){
		const idx = nearestRowIndexByAge(this.state.rows, age, this.getBirthMs());
		this.setState({ dragAge: age, hoverIdx: idx });
	}

	// —— [G4] 时间轴 3.0(视频剪辑式):px/年 缩放标尺 + 横向滚动 + glyph 简写章 + LOD ——
	// 旧 2.0 固定宽纯色点蜂群:数百点挤死、看不出哪个是哪个(用户实测)。现:
	//   缩放:滑杆 / Ctrl+滚轮(光标锚定)/「适配」一键回全宽;竖滚轮=横向平移;
	//   LOD:px/年 ≥ TL_CHIP_MODE_MIN 出「迫星[相位]→应星」glyph 章(ywastrochart 与 2D 盘同源),
	//        更小退化为重要度分级色点 —— 几百行任何缩放都不糊;
	//   车道:章按实际宽度区间装箱防撞(双泳道各三车道);点击章=选行+播放,拖轴=按年龄检索(逻辑不变)。
	renderTimeline(){
		const rows = this.state.rows;
		const axisYears = this.getAxisYears();
		const birthMs = this.getBirthMs();
		const ppy = this.getPxPerYear();
		const plotW = Math.max(1, axisYears * ppy);
		const contentW = plotW + PAD_X * 2;
		const xOf = (age)=>PAD_X + Math.max(0, Math.min(1, age / axisYears)) * plotW;

		// [G4-LOD] 章档开关按「密度」而非仅缩放:几百行低倍全铺章=实心糊带(实测 681 行 17px/年翻车);
		// 以较挤的一条泳道事件数判可读性,拉近自然浮现章、拉远退回分级点。
		let cntD = 0;
		let cntC = 0;
		rows.forEach((row)=>{
			const age = rowAgeYears(row, birthMs);
			if(!Number.isFinite(age) || age < 0 || age > axisYears){ return; }
			if(isConverseRow(row)){ cntC += 1; }else{ cntD += 1; }
		});
		const chipMode = chipModeOf(ppy, axisYears, Math.max(cntD, cntC));

		// [P5] 章档可读性定案:11px 章字明暗双档都看不清(用户实测)→ 12.5px+18px 章高+22px 车距,
		// 填充/描边对比同步拉高;点档几何不变。
		const CHIP_H = 18;
		const SUB = chipMode ? 22 : 11;       // 车道间距(章档撑高,点档紧凑)
		const laneDirectTop = chipMode ? 16 : 20;
		const axisY = chipMode ? 84 : 78;
		const laneConverseTop = chipMode ? 92 : 98;
		const laneH = SUB * 2 + (chipMode ? CHIP_H : 9);

		// 重要度 → 半径/透明度(点档 LOD 用;迫星 id 判级,虚点=界/映点/相位点)
		const dotSpecOf = (row)=>{
			const pid = `${row.prom || ''}`;
			if(/^[TACDS]_/.test(pid)){
				return { r: 2.4, op: 0.42 };
			}
			const base = pid.indexOf('_') >= 0 ? pid.split('_')[1] || pid : pid;
			if(base === 'Sun' || base === 'Moon'){ return { r: 5, op: 0.95 }; }
			if(base === 'Mercury' || base === 'Venus' || base === 'Mars'){ return { r: 4.2, op: 0.85 }; }
			if(base === 'Jupiter' || base === 'Saturn'){ return { r: 3.6, op: 0.8 }; }
			return { r: 3, op: 0.6 };
		};

		// 事件构造(章档带 glyph 段与估宽;点档带分级半径)
		const events = [];
		rows.forEach((row, idx)=>{
			const age = rowAgeYears(row, birthMs);
			if(!Number.isFinite(age) || age < 0 || age > axisYears){
				return;
			}
			const ev = { idx, row, age, x: xOf(age), conv: isConverseRow(row) };
			if(chipMode){
				ev.segs = rowGlyphSegs(row);
				ev.w = estSegsWidth(ev.segs, 12.5, 14);
			}else{
				Object.assign(ev, dotSpecOf(row));
			}
			events.push(ev);
		});

		let placed = [];
		if(chipMode){
			placed = [
				...packLanes(events.filter((e)=>!e.conv), 3, 3).map((e)=>({ ...e, y: laneDirectTop + e.lane * SUB })),
				...packLanes(events.filter((e)=>e.conv), 3, 3).map((e)=>({ ...e, y: laneConverseTop + e.lane * SUB })),
			];
		}else{
			// 点档:沿用蜂群(大点优先/同道防撞/溢出落底行)
			const laneRows = { d: [[], [], []], c: [[], [], []] };
			[...events].sort((a, b)=>b.r - a.r).forEach((ev)=>{
				const lanes = laneRows[ev.conv ? 'c' : 'd'];
				let sub = 0;
				for(let s = 0; s < lanes.length; s += 1){
					const clash = lanes[s].some((other)=>Math.abs(other.x - ev.x) < other.r + ev.r + 1.2);
					if(!clash){
						sub = s;
						break;
					}
					sub = lanes.length - 1;
				}
				lanes[sub].push(ev);
				const top = ev.conv ? laneConverseTop : laneDirectTop;
				placed.push({ ...ev, y: top + sub * SUB });
			});
		}

		// 刻度步长随缩放自适应(相邻刻度 ≥44px)
		const step = niceTickStep(ppy);
		const ticks = [];
		for(let a = 0; a <= axisYears; a += step){
			ticks.push(a);
		}

		let todayAge = NaN;
		if(Number.isFinite(birthMs)){
			todayAge = (Date.now() - birthMs) / (365.2425 * 86400000);
		}

		return (
			<svg
				width={contentW}
				height={TIMELINE_H - 6}
				style={{ display: 'block', touchAction: 'none', cursor: rows.length ? 'ew-resize' : 'default' }}
				onPointerDown={this.handleTimelineDown}
				onPointerMove={this.handleTimelineMove}
				onPointerUp={this.handleTimelineUp}
				onPointerLeave={this.handleTimelineLeave}
			>
				{/* 泳道背景条带(主题色淡底) */}
				<rect x={PAD_X - 8} y={laneDirectTop - 5} width={plotW + 16} height={laneH + 10} rx="6"
					fill={DIRECT_HEX} fillOpacity="0.06" stroke={DIRECT_HEX} strokeOpacity="0.18" strokeWidth="1" />
				<rect x={PAD_X - 8} y={laneConverseTop - 5} width={plotW + 16} height={laneH + 10} rx="6"
					fill={CONVERSE_HEX} fillOpacity="0.05" stroke={CONVERSE_HEX} strokeOpacity="0.16" strokeWidth="1" />
				{/* 轴线 + 缩放自适应刻度 */}
				<line x1={PAD_X} y1={axisY} x2={PAD_X + plotW} y2={axisY} stroke="#55688a" strokeWidth="1" />
				{ticks.map((a)=>(
					<g key={`tick-${a}`}>
						<line x1={xOf(a)} y1={laneDirectTop - 5} x2={xOf(a)} y2={laneConverseTop + laneH + 5}
							stroke="#3d4f6e" strokeWidth="1" strokeOpacity="0.32" />
						<line x1={xOf(a)} y1={axisY - 4} x2={xOf(a)} y2={axisY + 4} stroke="#7c90b3" strokeWidth="1.2" />
						<text x={xOf(a)} y={axisY - 7} textAnchor="middle" fontSize="10.5" fill="#a8bcd8">{a}</text>
					</g>
				))}
				{/* 今日游标 */}
				{Number.isFinite(todayAge) && todayAge >= 0 && todayAge <= axisYears ? (
					<g>
						<line x1={xOf(todayAge)} y1={laneDirectTop - 12} x2={xOf(todayAge)} y2={laneConverseTop + laneH + 6}
							stroke="#ff6b6b" strokeWidth="1.4" strokeDasharray="4 3" />
						<text x={xOf(todayAge)} y={laneDirectTop - 15} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ff6b6b">今</text>
					</g>
				) : null}
				{/* 拖拽游标 */}
				{this.state.dragAge !== null ? (
					<line x1={xOf(this.state.dragAge)} y1={laneDirectTop - 10} x2={xOf(this.state.dragAge)} y2={laneConverseTop + laneH + 4}
						stroke="#c3d3ee" strokeWidth="1.2" />
				) : null}
				{/* 事件(章档 glyph 简写 / 点档分级色点;点击=选行+播放) */}
				{placed.map((ev)=>{
					const active = ev.idx === this.state.selIdx;
					const hover = ev.idx === this.state.hoverIdx;
					const color = ev.conv ? CONVERSE_HEX : DIRECT_HEX;
					if(chipMode){
						// [G4-LOD] 车道装不下的溢出事件降级为小点(局部过密时章不硬叠;点击/悬停语义同章)
						if(ev.overflow && !active){
							return (
								<circle
									key={`ev-${ev.idx}`}
									cx={ev.x} cy={ev.y + CHIP_H / 2}
									r={hover ? 3.4 : 2.2}
									fill={color} fillOpacity={hover ? 1 : 0.5}
									style={{ cursor: 'pointer' }}
									onPointerDown={(e)=>e.stopPropagation()}
									onClick={(e)=>{
										e.stopPropagation();
										this.selectAndPlay(ev.idx);
									}}
								>
									<title>{rowSummary(ev.row)}</title>
								</circle>
							);
						}
						return (
							<g
								key={`ev-${ev.idx}`}
								style={{ cursor: 'pointer' }}
								onPointerDown={(e)=>e.stopPropagation()}
								onClick={(e)=>{
									e.stopPropagation();
									this.selectAndPlay(ev.idx);
								}}
							>
								{/* [P6] 选中章:字体恒亮色(白),不描边(白描边框已撤,改同色粗边);
								    时间轴恒深底,一切颜色钉死、绝不随亮暗主题适配(用户定案) */}
								<rect x={ev.x - ev.w / 2} y={ev.y} width={ev.w} height={CHIP_H} rx="4"
									fill={color} fillOpacity={active ? 0.5 : (hover ? 0.3 : 0.2)}
									stroke={color} strokeOpacity={active ? 0.95 : 0.7}
									strokeWidth={active ? 1.6 : 1.1} />
								<text x={ev.x} y={ev.y + CHIP_H - 5} textAnchor="middle" fontSize="12.5"
									fill={active ? '#ffffff' : color} fillOpacity={1} style={{ userSelect: 'none' }}>
									{ev.segs.map((s, i)=>(
										<tspan key={`s-${i}`} style={s.astro ? { fontFamily: 'ywastrochart' } : null}>{s.t}</tspan>
									))}
								</text>
								<title>{rowSummary(ev.row)}</title>
							</g>
						);
					}
					return (
						<circle
							key={`ev-${ev.idx}`}
							cx={ev.x}
							cy={ev.y}
							r={active ? ev.r + 2.4 : (hover ? ev.r + 1.6 : ev.r)}
							fill={color}
							fillOpacity={active || hover ? 1 : ev.op}
							stroke={active ? '#ffffff' : 'none'}
							strokeWidth={active ? 1.6 : 0}
							style={{ cursor: 'pointer' }}
							onPointerDown={(e)=>e.stopPropagation()}
							onClick={(e)=>{
								e.stopPropagation();
								this.selectAndPlay(ev.idx);
							}}
						>
							<title>{rowSummary(ev.row)}</title>
						</circle>
					);
				})}
			</svg>
		);
	}

	render(){
		const height = this.props.height ? this.props.height : 640;
		const selRow = this.state.selIdx >= 0 ? this.state.rows[this.state.selIdx] : null;
		const hoverRow = this.state.hoverIdx >= 0 ? this.state.rows[this.state.hoverIdx] : null;
		const summaryRow = hoverRow || selRow;
		const methodLabel = getPdMethodLabel(this.props.pdMethod);
		const timeKeyLabel = getPdTimeKeyLabel(this.props.pdTimeKey);

		return (
			<div className="horosa-pdsphere-chrome" style={{ height, maxHeight: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: '#05080f' }}>
				{/* 工具条:方法/换算 + 选中行摘要 + 播放/复位。[P1] flexWrap+auto 高:窄容器下选项换行,
				    绝不被右缘裁掉(旧固定 40px 单行,相位点/映点/界/播完回位在星运页被右栏挤出=「选项被遮挡」)。 */}
				<div style={{
					minHeight: TOOLBAR_H, flex: '0 0 auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap',
					gap: '4px 12px', padding: '4px 12px', color: '#c8d4e8', fontSize: 12,
					borderBottom: '1px solid rgba(120,145,185,0.18)',
				}}>
					{/* [WP-C.2] 徽章二态化:pdtype 全链只有 0/1(2/3 从未下发,原四态映射的界支=死支);
				    界不是独立 pdtype 而是 pdTerms 开关(行级 cat='T'),故以尾缀「+界」呈现。 */}
				<span style={{ color: '#d8ab52', fontWeight: 600 }}>{(Number(this.props.pdType) === 1 ? 'In Mundo·世俗向运' : 'In Zodiaco·黄道向运') + (Number(this.props.pdTerms) ? ' +界' : '')}</span>
					<span style={{ color: '#8fa3c2' }}>{methodLabel} · {timeKeyLabel}</span>
					<span style={{
						flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
						color: summaryRow && isConverseRow(summaryRow) ? CONVERSE_HEX : DIRECT_HEX,
					}}>
						{summaryRow ? rowSummary(summaryRow) : (this.state.rows.length ? '点时间轴事件点播放；拖动横轴按年龄检索表行' : '')}
					</span>
					{/* [L1] 圈层显隐:六圈独立开关+标注总开关(用户定案「别的圈也要能选择」;
					    每圈=圈体+自身文字/方位点成组,标注开关只控文字层;引擎嵌套组就地生效+localStorage 记忆) */}
					<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', color: '#c8d4e8', fontSize: 13 }}>
						{[['ecliptic', '黄道'], ['equator', '赤道'], ['grid', '网格'], ['horizon', '地平'], ['meridian', '子午'], ['primeVertical', '卯酉'], ['labels', '标注']].map(([k, lb])=>{
							const fl = this.state.frameLayers || {};
							return (
								<label key={k} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
									<input type="checkbox" checked={fl[k] !== false} style={{ verticalAlign: '-2px', marginRight: 4 }}
										onChange={(e)=>{
											const on = e.target.checked;
											this.setState({ frameLayers: { ...fl, [k]: on } });
											if(this.engine && this.engine.setFrameLayers){ this.engine.setFrameLayers({ [k]: on }); }
										}}/>{lb}
								</label>
							);
						})}
					</span>
					<Button size="small" style={BTN_DARK} disabled={!selRow} onClick={this.handlePlaySelected}>播放</Button>
					<Button size="small" style={BTN_DARK} onClick={this.handleResetRotation}>复位</Button>
					{/* [P2] 三视角档循环:天球仪(外视整球,默认)→观测者(面南外视)→球心(planetarium 式内视,
					    拖拽环视+滚轮调 FOV);globe↔observer 600ms 飞行,球心瞬切 */}
					<Button size="small" style={BTN_DARK} title="点击循环:天球仪→观测者→球心" onClick={()=>{
						const cur = this.state.viewMode || 'globe';
						const next = cur === 'globe' ? 'observer' : (cur === 'observer' ? 'center' : 'globe');
						this.setState({ viewMode: next });
						if(this.engine && this.engine.applyViewMode){ this.engine.applyViewMode(next, true); }
					}}>{this.state.viewMode === 'observer' ? '观测者' : (this.state.viewMode === 'center' ? '球心' : '天球仪')}</Button>
					{/* [WP-3] 聚焦/全显 + 虚点三类 toggle(localStorage 记忆,引擎就地生效) */}
					<Button size="small" style={BTN_DARK} onClick={()=>{
						const next = !(this.state.focusMode !== false);
						this.setState({ focusMode: next });
						if(this.engine && this.engine.setFocusMode){ this.engine.setFocusMode(next); }
					}}>{this.state.focusMode !== false ? '聚焦' : '全显'}</Button>
					{this.props.onPdConfigApply ? (()=>{
						const sig = Array.isArray(this.props.pdSignificators) ? this.props.pdSignificators : [];
						const prom = Array.isArray(this.props.pdPromissorTypes) ? this.props.pdPromissorTypes : [];
						// 全量透传现值,仅换 S/P 扩展 → 主链重算,天球行/时间轴随 predictives 回流
						const apply = (nextSig, nextProm)=>{
							this.props.onPdConfigApply(this.props.pdMethod, this.props.pdTimeKey, this.props.pdYears, {
								pdtype: this.props.pdType === 1 ? 1 : 0,
								direct: this.props.pdDirect !== 0,
								converse: this.props.pdConverse === 1,
								antiscia: this.props.pdAntiscia === 1,
								terms: this.props.pdTerms === 1,
								projection: this.props.pdProjection,
								frame: this.props.pdFrame,
								framework: this.props.pdFramework,
								parallel: this.props.pdParallel === 1,
								raptParallel: this.props.pdRaptParallel === 1,
								timeKeyCustom: this.props.pdTimeKeyCustom,
								significators: nextSig,
								promissorTypes: nextProm,
								termsVariant: this.props.termsVariant,
							});
						};
						// 面板本体与表格 pane 共用(components/astro/PdExtensionPanel.js)——
						// 这里只给 dark 皮肤档与暗底按钮样式,尺寸/描边/标题层级由组件单点决定。
						return (
							<PdExtensionPanel
								variant='dark'
								significators={sig}
								promissorTypes={prom}
								onSignificatorsChange={(next)=>apply(next, prom)}
								onPromissorTypesChange={(next)=>apply(sig, next)}
								buttonStyle={BTN_DARK}
							/>
						);
					})() : null}
					{/* [P5] 勾选组可读性:12px 淡灰在窄挤态看不清(用户实测)→ 13px 亮字+加距+整组可换行 */}
					<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', color: '#c8d4e8', fontSize: 13 }}>
						{/* [E1] 映点/界两选项已删(用户定案);仅留相位点显隐。 */}
						{[['aspect', '相位点']].map(([k, lb])=>{
							const vt = this.state.virtualToggles || { aspect: true, antiscia: false, term: false };
							return (
								<label key={k} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
									<input type="checkbox" checked={!!vt[k]} style={{ verticalAlign: '-2px', marginRight: 4 }}
										onChange={(e)=>{
											const next = { ...vt, [k]: e.target.checked };
											this.setState({ virtualToggles: next });
											if(this.engine && this.engine.setVirtualToggles){ this.engine.setVirtualToggles(next); }
										}}/>{lb}
								</label>
							);
						})}
						{/* 后天宫位宫首在黄道上的显示开关(纯前端派生,随「盘面宫制」;只是显示,不改弧) */}
						<label style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} title="在黄道上标十二宫首(按主限法标签设的盘面宫制;只是显示,不改弧)">
							<input type="checkbox" checked={!!this.state.showHouses} style={{ verticalAlign: '-2px', marginRight: 4 }}
								onChange={(e)=>{
									const on = e.target.checked;
									this.setState({ showHouses: on });
									safeLocalStorageSet('horosa.pdsphere.showHouses', on ? '1' : '0');
									if(this.engine && this.engine.setHouseDisplay){ this.engine.setHouseDisplay(on); }
								}}/>宫位
						</label>
						{/* [WP-B] 播完自动复位(默认关=停在命中姿态;开=播完 900ms 缓动回本命,旧观感) */}
						<label style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
							<input type="checkbox" checked={!!this.state.autoResetAfterPlay} style={{ verticalAlign: '-2px', marginRight: 4 }}
								onChange={(e)=>{
									const on = e.target.checked;
									this.setState({ autoResetAfterPlay: on });
									safeLocalStorageSet('horosa.pdsphere.autoResetAfterPlay', on ? '1' : '0');
								}}/>播完回位
						</label>
						{/* [C1] 复合运动·真位层:周日旋转同时诸曜沿黄道自行(主限的物理实相);
						    冻结迫星仍是命中载体,真位点+漂移线呈现「本命位vs真位」之差 */}
						<label style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
							title="播放时同时呈现周日旋转与诸曜黄道自行(真位);冻结迫星仍精确命中,真位点显示同一时间星体实际所在">
							<input type="checkbox" checked={!!this.state.trueMotion} style={{ verticalAlign: '-2px', marginRight: 4 }}
								onChange={(e)=>{
									const on = e.target.checked;
									this.setState({ trueMotion: on, trueInfo: on ? this.state.trueInfo : null });
									if(this.engine && this.engine.setTrueMotion){ this.engine.setTrueMotion(on); }
								}}/>复合运动
						</label>
					</span>
				</div>

				{/* 3D 天球画布宿主 */}
				<div
					ref={(el)=>{ this.hostRef = el; }}
					style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
				>
					{/* [WP-3] 图例 HUD:方向/框架圈/黄道/赤道 一眼可查 */}
					<div style={{
						position: 'absolute', left: 10, bottom: 8, zIndex: 3, pointerEvents: 'none',
						fontSize: 11, lineHeight: 1.8, color: '#9db0cc', background: 'rgba(5,8,15,0.55)',
						padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(120,145,185,0.16)',
					}}>
						<div><span style={{ color: '#ffd700' }}>●</span> Direct 顺　<span style={{ color: '#59d4c8' }}>●</span> Converse 逆</div>
						<div><span style={{ color: '#7fd191' }}>—</span> 地平圈　<span style={{ color: '#c39ae0' }}>—</span> 子午圈　<span style={{ color: '#7fc9c2' }}>—</span> 卯酉圈</div>
						<div><span style={{ color: '#d8ab52' }}>—</span> 黄道(<span style={{ fontFamily: 'ywastrochart' }}>a</span>…宫刻度)　<span style={{ color: '#8fa3c2' }}>—</span> 天赤道网格</div>
						{this.state.trueMotion ? (
							<div><span style={{ color: '#dbe7f5' }}>●</span> <span style={{ color: '#dbe7f5' }}>真位(复合运动)</span>——银白;方向色为经典冻结位</div>
						) : null}
					</div>
					{/* [C1] 复合运动信息行:播放/拖拽落定时报「弧=多少物理历时·诸曜真位漂移」——
					    周日旋转(整层随转)×黄道自行(层内挪移)的复合;迫星漂移即「本命位vs真位」之差 */}
					{this.state.trueMotion && this.state.trueInfo && Array.isArray(this.state.trueInfo.drifts) && this.state.trueInfo.drifts.length ? (
						<div style={{
							position: 'absolute', right: 10, bottom: 8, zIndex: 3, pointerEvents: 'none',
							fontSize: 11, lineHeight: 1.7, color: '#9fd8ff', background: 'rgba(5,8,15,0.55)',
							padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(120,145,185,0.16)', maxWidth: '46%',
						}}>
							<div>复合运动 · 此弧历时{this.state.trueInfo.elapsedText}</div>
							<div>
								真位漂移
								{this.state.trueInfo.drifts.map((d)=>{
									const nm = pdPointShortName(d.pid);
									const v = Number(d.dLon) || 0;
									return `　${nm}${d.isProm ? '(迫星)' : ''} ${v > 0 ? '+' : ''}${v.toFixed(2)}°`;
								}).join('')}
							</div>
						</div>
					) : null}
					{this.state.loading ? (
						<div style={{
							position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
							justifyContent: 'center', zIndex: 3, pointerEvents: 'none',
						}}>
							<Spin tip="主限天球计算中…" />
						</div>
					) : null}
					{this.state.err ? (
						<div style={{
							position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 12,
							alignItems: 'center', justifyContent: 'center', zIndex: 3, color: '#c8d4e8', fontSize: 13,
						}}>
							<span>{this.state.err}</span>
							<Button size="small" style={BTN_DARK} onClick={this.handleRetry}>重试</Button>
						</div>
					) : null}
					{!this.state.loading && !this.state.err && !this.state.rows.length ? (
						<div style={{
							position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
							justifyContent: 'center', zIndex: 2, color: '#6d7f9b', fontSize: 13, pointerEvents: 'none',
						}}>
							当前主限设置未产出表行（调整弧算法/年限后自动重算）
						</div>
					) : null}
				</div>

				{/* [G4] 生命时间轴 3.0:控制行(缩放/适配/图例)+ 横向滚动轨道 */}
				<div style={{ flex: `0 0 ${TIMELINE_H + TL_CTRL_H}px`, height: TIMELINE_H + TL_CTRL_H, background: '#070b14', display: 'flex', flexDirection: 'column' }}>
					<div style={{
						height: TL_CTRL_H, flex: `0 0 ${TL_CTRL_H}px`, display: 'flex', alignItems: 'center',
						gap: 10, padding: '0 12px', color: '#8fa3c2', fontSize: 11,
						borderBottom: '1px solid rgba(120,145,185,0.10)',
					}}>
						<span>缩放</span>
						<input
							type="range" min={TL_ZOOM_MIN} max={TL_ZOOM_MAX} step={0.5}
							value={Math.min(TL_ZOOM_MAX, Math.max(TL_ZOOM_MIN, Math.round(this.getPxPerYear() * 2) / 2))}
							onChange={(e)=>this.setTlZoom(Number(e.target.value), null)}
							style={{ width: 150, accentColor: '#5b8def' }}
						/>
						<span style={{ minWidth: 58, fontVariantNumeric: 'tabular-nums' }}>{this.getPxPerYear().toFixed(1)} px/年</span>
						<Button size="small" style={BTN_DARK} onClick={()=>this.setTlZoom(null, null)}>适配</Button>
						{/* [E1] 年龄轴岁数可选:覆写 pdYears(数据与轴同步扩展),默认跟主限法设置 */}
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
							<span style={{ opacity: 0.65 }}>年龄轴 0–</span>
							<Select
								size="small" value={this.getAxisYears()} style={{ width: 72 }} dropdownMatchSelectWidth={false}
								dropdownClassName="horosa-pdsphere-dark-pop"
								onChange={(v)=>{ this.setState({ axisYears: v }, ()=>{ safeLocalStorageSet('horosa.pdsphere.axisYears', String(v)); this.fetchData(); }); }}
							>
								{AGE_YEARS_OPTIONS.map((y)=>(<Select.Option key={y} value={y}>{y}</Select.Option>))}
							</Select>
							<span style={{ opacity: 0.65 }}>岁 · ⌘/Ctrl+滚轮缩放 · 滚轮横移 · 点章即播</span>
						</span>
						<span style={{ flex: 1 }} />
						<span><span style={{ color: DIRECT_HEX }}>●</span> 顺向 Direct</span>
						<span><span style={{ color: CONVERSE_HEX }}>●</span> 逆向 Converse</span>
					</div>
					<div ref={this.attachTlScroll} style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
						{this.renderTimeline()}
					</div>
				</div>
			</div>
		);
	}
}

export default AstroPDSphere;
