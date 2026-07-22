// 命盘图捕获挂载组件 (用真实 BaZi/ZiWeiMain 组件)
//
// 关键发现:
//   BaZi.js 和 ZiWeiMain.js 都是自己 fetch 数据(用 fetchBaziDirectCached / request signed fetch),
//   **不依赖 dva dispatch**! 只要传 props.fields(完整结构) 就能自己 fetch + setState + render.
//   props.dispatch 仅用于副作用(saveModuleAISnapshot 等), 传 noop 即可不影响主 app。
//   props.hook 是 AI 分析回调, 传 {} 即可。
//
// 接口:
//   chartType: 'bazi-fourColumns' | 'bazi-luckyDecade' | 'ziwei-12palace' | {type:'ziwei-palace-highlight', palace:'fuqi'}
//   caseRecord: 来自 listLocalCharts 的 chart 记录(含 birth/zone/lon/lat/gender 等)
//   captureExtra: { palace?: string } 紫微宫高亮(目前不影响真盘渲染, 仅传给可能识别它的子组件)
//   onCaptureReady: () => void  数据加载+渲染稳定后调一次
//   onCaptureError: (err) => void

import React from 'react';
import { Spin } from 'antd';
import DateTime from '../comp/DateTime';
import BaZi from '../cntradition/BaZi';
import ZiWeiMain from '../ziwei/ZiWeiMain';

const FRAME_STYLE = {
	width: 1400,
	minHeight: 900,
	background: '#ffffff',
	padding: 16,
	boxSizing: 'border-box',
	overflow: 'hidden',
	fontFamily: '"PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
};

// 根据 record 构造完整 fields 对象,兼容 BaZi.genParams / ZiWeiMain.genParams
// 期望字段: date.value(DateTime), time.value(DateTime), zone, lon, lat, gpsLat, gpsLon,
//          gender, timeAlg, phaseType, godKeyPos, after23NewDay, lateZiHourUseNextDay, adjustJieqi
function buildFields(record){
	if(!record) return null;
	const tm = new DateTime();
	tm.parse(record.birth || '2000-01-01 00:00:00', 'YYYY-MM-DD HH:mm:ss');
	tm.setAd(record.ad !== undefined ? record.ad : 1);
	tm.setZone(record.zone || '+08:00');
	const make = (val) => ({ value: val });
	return {
		date: make(tm),
		time: make(tm),
		zone: make(tm.zone),
		lon: make(record.lon),
		lat: make(record.lat),
		gpsLat: make(record.gpsLat),
		gpsLon: make(record.gpsLon),
		gender: make(record.gender !== undefined ? record.gender : 1),
		ad: make(tm.ad),
		pos: make(record.pos || ''),
		name: make(record.name || ''),
		timeAlg: make(record.timeAlg !== undefined ? record.timeAlg : 0),
		phaseType: make('core'),
		godKeyPos: make(0),
		after23NewDay: make(record.after23NewDay !== undefined ? record.after23NewDay : 0),
		lateZiHourUseNextDay: make(record.lateZiHourUseNextDay !== undefined ? record.lateZiHourUseNextDay : 1),
		adjustJieqi: make(0),
	};
}

// noop dispatch 让 BaZi/ZiWeiMain 内部 dispatch 调用安全失败,不影响主 app store
const noopDispatch = () => {};
// 隔离 hook,避免 BaZi/ZiWeiMain 内部 hook.fun 被覆盖到主 app 同名 hook
function makeIsolatedHook(){ return {}; }

// 错误边界 - 防 BaZi/ZiWeiMain render 异常炸到 dev overlay
class CaptureErrorBoundary extends React.Component {
	constructor(props){ super(props); this.state = { hasError: false, err: null }; }
	static getDerivedStateFromError(err){ return { hasError: true, err }; }
	componentDidCatch(err){ try { this.props.onError && this.props.onError(err); } catch(_){} }
	render(){
		if(this.state.hasError){
			return (
				<div style={{...FRAME_STYLE, height: 200, padding: 40, color:'#cf1322'}} data-capture-target={this.props.fallbackTarget || 'error'}>
					<div style={{textAlign:'center',fontSize:16,fontWeight:600,marginBottom:8}}>{this.props.caseRecord && this.props.caseRecord.name || '命主'} · 命盘渲染失败</div>
					<pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{(this.state.err && this.state.err.message) || '内部错误'}</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

export default class ChartCaptureMount extends React.Component {
	constructor(props){
		super(props);
		this.fields = buildFields(props.caseRecord);
		this.hook = makeIsolatedHook();
		this.state = { polling: true };
		this.mounted = true;
		this.readyEmitted = false;
		this.pollCount = 0;
		this.containerRef = React.createRef();
	}

	componentDidMount(){
		// 启动轮询: 真实 BaZi/ZiWeiMain 内部异步 fetch 完成后 setState 自动 render,
		// 我们用 textContent 长度作 ready 信号(命盘渲染完含星名/干支/十神等大量文字)。
		this.startReadyPoll();
	}

	componentWillUnmount(){
		this.mounted = false;
		if(this.pollTimer){ clearTimeout(this.pollTimer); this.pollTimer = null; }
	}

	startReadyPoll(){
		// 每 800ms 查一次,最多 25 次(20s 总超时)
		const POLL_MS = 800;
		const MAX_POLLS = 25;
		const MIN_TEXT_LEN = 200;  // 真盘渲染完后 textContent 通常 1000+ 字
		const tick = () => {
			if(!this.mounted || this.readyEmitted) return;
			this.pollCount++;
			const root = this.containerRef.current;
			const textLen = root ? (root.textContent || '').trim().length : 0;
			if(textLen >= MIN_TEXT_LEN){
				this.readyEmitted = true;
				try { console.info(`[ChartCaptureMount] ready after ${this.pollCount} polls (textLen=${textLen})`); } catch(_){}
				// 再多等一帧让 d3 SVG 绘制完成
				requestAnimationFrame(() => requestAnimationFrame(() => {
					if(!this.mounted) return;
					try { this.props.onCaptureReady && this.props.onCaptureReady(); } catch(_){}
				}));
				return;
			}
			if(this.pollCount >= MAX_POLLS){
				// 超时仍 emit ready, 让上层用 textContent 阈值过滤决定是否截图
				this.readyEmitted = true;
				try { console.warn(`[ChartCaptureMount] poll timeout after ${this.pollCount}x${POLL_MS}ms (textLen=${textLen})`); } catch(_){}
				try { this.props.onCaptureReady && this.props.onCaptureReady(); } catch(_){}
				return;
			}
			this.pollTimer = setTimeout(tick, POLL_MS);
		};
		this.pollTimer = setTimeout(tick, POLL_MS);
	}

	renderInner(){
		const { chartType, caseRecord } = this.props;
		const ct = typeof chartType === 'string' ? chartType : (chartType && chartType.type) || '';
		if(!caseRecord || !this.fields){
			return (
				<div data-capture-target={ct} style={{...FRAME_STYLE, padding: 40, textAlign:'center', color:'#cf1322'}}>
					<div style={{fontSize:16,fontWeight:600}}>缺少案例记录</div>
				</div>
			);
		}
		const title = `${caseRecord.name || '命主'} · ${ct.startsWith('bazi') ? '八字命盘' : '紫微斗数 12 宫盘'}`;
		const isBazi = ct.startsWith('bazi-');
		// 给一个 fixed 大尺寸容器, 让 BaZi/ZiWeiMain 能正常 layout(它们的 height/宽度可能依赖 parent 尺寸)。
		// v1.21: 紫微 12 宫盘是正方形, 大小 = min(视口宽, 视口高)。挂载时顶部输入面板会占 ~620px,
		// 若总高度不够, 盘视口被压成细条(实测仅 156px 高)。故紫微给足总高度让盘拿到接近正方形的大尺寸。
		// 紫微 12 宫盘视口由 CSS `.horosa-workspace-shell .horosa-ziwei-redesign .horosa-ziwei-chart-viewport`
		// 设为 74vh 正方形 —— 这条规则要求祖先有 `.horosa-workspace-shell`(主 app 外壳类)。v1.19 挂载缺了它,
		// 视口才退化成细条。故紫微容器加 workspace-shell 类 + 给足宽度让三列网格的中列(盘)拿到 ≥74vh 宽。
		const stageW = isBazi ? 1368 : 1700;
		const stageH = isBazi ? 820 : 1500;
		return (
			<div data-capture-target={ct} ref={this.containerRef} className="horosa-workspace-shell" style={{ ...FRAME_STYLE, width: isBazi ? 1500 : 1760 }}>
				<div style={{textAlign:'center',marginBottom:8,fontSize:16,fontWeight:600,paddingBottom:8,borderBottom:'1px solid #ddd'}}>{title}</div>
				<div style={{ width: stageW, height: stageH }}>
					{isBazi ? (
						<BaZi
							height={820}
							fields={this.fields}
							hook={this.hook}
							dispatch={noopDispatch}
						/>
					) : (
						<ZiWeiMain
							height={stageH}
							fields={this.fields}
							hook={this.hook}
							dispatch={noopDispatch}
						/>
					)}
				</div>
			</div>
		);
	}

	render(){
		const { chartType } = this.props;
		const ct = typeof chartType === 'string' ? chartType : (chartType && chartType.type) || '';
		const errorHandler = (e)=>{
			if(this.mounted){
				try { console.error('[ChartCaptureMount] boundary caught:', e); } catch(_){}
				try { this.props.onCaptureError && this.props.onCaptureError(e); } catch(_){}
				// 边界错误时也立刻 emit ready 让上层不死等
				if(!this.readyEmitted){
					this.readyEmitted = true;
					setTimeout(()=>{ try { this.props.onCaptureReady && this.props.onCaptureReady(); } catch(_){} }, 100);
				}
			}
		};
		return (
			<CaptureErrorBoundary fallbackTarget={ct} caseRecord={this.props.caseRecord} onError={errorHandler}>
				{this.renderInner()}
			</CaptureErrorBoundary>
		);
	}
}
