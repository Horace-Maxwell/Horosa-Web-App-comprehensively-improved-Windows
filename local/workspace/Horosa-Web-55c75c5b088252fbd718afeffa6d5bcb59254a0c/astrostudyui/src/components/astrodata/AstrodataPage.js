import React from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { APPEARANCE_DARK } from '../../utils/appearance';
import { openExternalUrl } from '../../utils/aiAnalysisDesktop';
import { getDeclaredZoom } from '../../utils/zoomDomain';

/**
 * Astrodata —— A/AA 名人星盘目录(内嵌「工具 · 数据库」页)。
 *
 * 页面本体(index.html + astrodata-aa.sqlite.gz + vendor/)在 public/astrodata/,本组件用 iframe 载入。
 * iframe 全程离线(sql.js + fflate 解压 gz,浏览器内查询),桌面/Web 同构;首次点开该 tab 才挂载
 * (antd Tabs 惰性挂载未访问面板)→ 38MB 数据不影响启动。
 *
 * 主题:内嵌页不做自带明暗按钮,直接跟随宿主 app 的明暗(resolvedAppearance)——
 *   初值走 iframe URL `?theme=`(防首帧闪对比色),后续变化走 postMessage(不改 src、不重载 38MB)。
 *
 * 「加入命盘」:详情抽屉按钮 → iframe postMessage({type:'astrodata:importChart', chart}) → 本组件
 * 校验消息来源后 dispatch(user/addLocalChartQuiet)。该 effect 字符串 birth 安全、静默入库并刷新
 * 「星盘列表」,不弹抽屉/不导航;之后任意技法页的「星盘列表」即含该名人,点选即按其出生数据排盘。
 *
 * 🔴 壳缩放(2026-09-17 用户在新机 Tahoe 的 APP 实报:缩小后右侧/底部空一截、放大后被裁):
 *   标准化 zoom 引擎(Tahoe WebKit)下,处在被 zoom 的宿主里的 iframe,其内页视口按 iframe 的**物理**
 *   尺寸(未除以 z)计 CSS px,再整体按 z 缩放 ⇒ 内页只画到 z 倍宽高(本机 WebKit 离屏实测:1400 宽、
 *   z=0.8 时内页布局视口 1400 而非 1750,渲染只占 1120)。修法两步、不认引擎:
 *   ① iframe 元素反缩放 zoom = 1/z ⇒ 它的有效缩放回到 1,内页视口 = iframe 视觉尺寸(逐位对齐);
 *   ② 把 z 交给内页(URL 初值 + postMessage 实时),内页自己 documentElement.style.zoom = z,
 *      于是内页与宿主同样放大,布局视口 = 视觉尺寸 / z(实测 1750 ✓)。z=1 时两步都不写 = 现状。
 *   宿主换档(⌘±)后壳会派发 resize,这里跟着重读声明缩放;documentElement 的 style 变更另挂
 *   MutationObserver 兜底。
 */

// 宿主声明缩放:documentElement.style.zoom 优先(壳注入 / global.js 镜像),缺席回落 shellZoom 单源;近 1 视为 1。
export function readFrameHostZoom(){
	try{
		const z = Number(getDeclaredZoom());
		if(z && z > 0 && isFinite(z) && Math.abs(z - 1) >= 0.001){ return z; }
	}catch(e){ /* ignore */ }
	return 1;
}

// iframe 元素的反缩放值:宿主 z≠1 → '1/z'(六位小数,避免 0.8 → 1.25 之类累进误差);z=1 → ''(不写)。
export function frameCounterZoom(z){
	if(!z || !isFinite(z) || z <= 0 || Math.abs(z - 1) < 0.001){ return ''; }
	return String(Math.round((1 / z) * 1e6) / 1e6);
}

// iframe 的兜底最小高:只防容器高度链失效时塌成 150px 缺省,不参与正常铺满(高度由容器 100% 链给)。
// 🔴 勿写成「一屏减页头」之类的视口公式:①页头真实占位 75px≠56px,②写在被反缩放的 iframe 元素上时它的
//   1px = 宿主布局域的 1/z px —— 本机 WebKit 实测(1400×900,z=0.8)旧公式把 iframe 撑到 1069/855 自身 px,
//   比容器(840 视觉 px)高一截,正好又制造底部溢出。
export function frameMinHeight(){
	return '300px';
}

class AstrodataPage extends React.Component {
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.iframeRef = React.createRef();
		this.hostZoom = readFrameHostZoom();
		this.counterApplied = false;
		// 稳定 src:主题初值只进 URL 一次(改 src 会重载 iframe → 白拉 38MB),之后靠 postMessage 更新。
		// 缩放不进 URL:是否需要反缩放要等 iframe 加载后实测才知道(见 needsCounterZoom),届时经 postMessage 下发。
		this.initialSrc = 'astrodata/index.html?theme=' + this.themeName();
	}

	themeName(){
		return this.props.resolvedAppearance === APPEARANCE_DARK ? 'dark' : 'light';
	}

	componentDidMount(){
		window.addEventListener('message', this.onMsg);
		window.addEventListener('resize', this.onResize);
		try{
			if(typeof MutationObserver === 'function'){
				this.zoomObserver = new MutationObserver(() => { this.syncZoom(false); });
				this.zoomObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
			}
		}catch(e){ this.zoomObserver = null; }
		this.syncZoom(true);
	}

	componentDidUpdate(prevProps){
		if(prevProps.resolvedAppearance !== this.props.resolvedAppearance){
			this.postTheme();
		}
	}

	componentWillUnmount(){
		window.removeEventListener('message', this.onMsg);
		window.removeEventListener('resize', this.onResize);
		if(this.zoomObserver){
			try{ this.zoomObserver.disconnect(); }catch(e){ /* ignore */ }
			this.zoomObserver = null;
		}
	}

	onResize = () => { this.syncZoom(false); };

	// 🔴 不认引擎、只认实测:先把 iframe 放回「无反缩放」态,量内页视口宽(documentElement.clientWidth,同源可读)
	// 与 iframe 自身布局宽(clientWidth,宿主布局域)是否一致。
	//   一致(旧语义引擎:内页视口本就 = 布局尺寸,内容随宿主一起缩放)→ 什么都不做,与修前逐字节相同;
	//   不一致(标准化 zoom 引擎:内页视口按物理尺寸计,内容被缩 z 倍)→ iframe zoom=1/z + 内页自己 zoom=z。
	// 量不到(未加载 / 跨源)→ 不动。这样旧 macOS、新 Tahoe 以及未来任何 zoom 语义都各自成立,不需要版本分支。
	needsCounterZoom(frame, z){
		if(!frame || !z || Math.abs(z - 1) < 0.001){ return false; }
		try{
			const doc = frame.contentDocument;
			const innerW = doc && doc.documentElement ? doc.documentElement.clientWidth : 0;
			const frameW = frame.clientWidth;
			if(!(innerW > 0) || !(frameW > 0)){ return false; }
			// 标准化引擎:innerW ≈ frameW × z(物理);旧引擎:innerW ≈ frameW。取二者中更接近者。
			const dStd = Math.abs(innerW - frameW * z);
			const dOld = Math.abs(innerW - frameW);
			return dStd < dOld;
		}catch(e){ return false; }
	}

	// 反缩放 iframe(按实测决定)+ 把 z 发给内页。force=true 无条件重判(首挂 / iframe onLoad);否则只在 z 变了才写。
	syncZoom(force){
		const z = readFrameHostZoom();
		const changed = z !== this.hostZoom;
		if(!force && !changed){ return; }
		this.hostZoom = z;
		const frame = this.iframeRef.current;
		if(!frame){ return; }
		let counter = false;
		try{
			frame.style.zoom = '';   // 先回到无反缩放态再量,避免上一档的反缩放污染读数
			counter = this.needsCounterZoom(frame, z);
			frame.style.zoom = counter ? frameCounterZoom(z) : '';
		}catch(e){ /* ignore */ }
		this.counterApplied = counter;
		this.postZoom();
	}

	// 内页 zoom:只有做了反缩放才让内页自己放大到 z;否则内页维持 1(宿主缩放已由引擎带进去)。
	postZoom = () => {
		const frame = this.iframeRef.current;
		if(frame && frame.contentWindow){
			try{ frame.contentWindow.postMessage({ type: 'astrodata:setZoom', zoom: this.counterApplied ? this.hostZoom : 1 }, '*'); }catch(e){ /* ignore */ }
		}
	};

	postTheme = () => {
		const frame = this.iframeRef.current;
		if(frame && frame.contentWindow){
			frame.contentWindow.postMessage({ type: 'astrodata:setTheme', theme: this.themeName() }, '*');
		}
	};

	onFrameLoad = () => {
		this.postTheme();
		this.syncZoom(true);
	};

	onMsg = (e) => {
		const d = e && e.data;
		if(!d || !d.type){ return; }
		// 同源健壮性:仅接受本页 iframe 发来的消息,忽略其它窗口伪造的同类型消息。
		const frame = this.iframeRef.current;
		if(frame && e.source && e.source !== frame.contentWindow){ return; }
		if(d.type === 'astrodata:importChart' && d.chart){
			this.props.dispatch({ type: 'user/addLocalChartQuiet', payload: d.chart });
			return;
		}
		// 外链(来源 Astro-Databank / Wikipedia / CC 等):桌面 webview 里 target=_blank 无反应 → 交宿主在系统浏览器打开。
		if(d.type === 'astrodata:openExternal' && d.url){
			openExternalUrl(d.url);
		}
	};

	render(){
		// 相对根路径:桌面(file/hash 路由)与 dev(`/`)皆解析为 <root>/astrodata/index.html。
		// 高度沿容器 100% 链传导;min-height 用布局视口变量(勿用 vh:缩放≠1 时与容器域劈叉)。
		// 首帧不写反缩放(要等加载后实测才知道该不该写,见 syncZoom);onLoad / 换档时由 syncZoom 直接改 DOM。
		const style = { width: '100%', height: '100%', minHeight: frameMinHeight(this.hostZoom), border: 'none', display: 'block' };
		return (
			<iframe
				ref={this.iframeRef}
				title="Astrodata"
				src={this.initialSrc}
				onLoad={this.onFrameLoad}
				style={style}
			/>
		);
	}
}

export default AstrodataPage;
