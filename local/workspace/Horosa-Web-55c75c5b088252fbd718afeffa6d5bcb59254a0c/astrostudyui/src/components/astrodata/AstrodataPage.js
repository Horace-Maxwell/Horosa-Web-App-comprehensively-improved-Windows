import React from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { APPEARANCE_DARK } from '../../utils/appearance';
import { openExternalUrl } from '../../utils/aiAnalysisDesktop';

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
 */
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
		// 稳定 src:主题初值只进 URL 一次(改 src 会重载 iframe → 白拉 38MB),之后靠 postTheme 更新。
		this.initialSrc = 'astrodata/index.html?theme=' + this.themeName();
	}

	themeName(){
		return this.props.resolvedAppearance === APPEARANCE_DARK ? 'dark' : 'light';
	}

	componentDidMount(){
		window.addEventListener('message', this.onMsg);
	}

	componentDidUpdate(prevProps){
		if(prevProps.resolvedAppearance !== this.props.resolvedAppearance){
			this.postTheme();
		}
	}

	componentWillUnmount(){
		window.removeEventListener('message', this.onMsg);
	}

	postTheme = () => {
		const frame = this.iframeRef.current;
		if(frame && frame.contentWindow){
			frame.contentWindow.postMessage({ type: 'astrodata:setTheme', theme: this.themeName() }, '*');
		}
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
		return (
			<iframe
				ref={this.iframeRef}
				title="Astrodata"
				src={this.initialSrc}
				onLoad={this.postTheme}
				style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 56px)', border: 'none', display: 'block' }}
			/>
		);
	}
}

export default AstrodataPage;
