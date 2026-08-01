import { Component } from 'react';
import { message } from 'antd';
import AstroChart3D from './AstroChart3D';
import Astro3DSettingsPanel from './Astro3DSettingsPanel';
import { fetchChart3DState } from '../../services/astro3d';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import AstroInfo from '../astro/AstroInfo';
import AstroAspect from '../astro/AstroAspect';
import AstroPlanet from '../astro/AstroPlanet';
import AstroLots from '../astro/AstroLots';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameRawPatch } from '../../utils/geoName';
import { getHousesOption } from '../comp/CompHelper'
import {
	XQButton,
	XQPanel,
	XQSectionTitle,
	XQSelect,
	XQTabs,
	XQToolbar,
	XQSideSection,
} from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P2]
import * as AstroConst from '../../constants/AstroConst';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = XQTabs.TabPane;
const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

// 中心体选项(WS-2 全行星中心盘):值 = 后端 chart3d 白名单键(center 单参数,
// 中心增多不加参);'geo' = 本命地心默认路径(引擎零改),其余走 /chart3d/state
const CENTER_MODE_OPTIONS = [
	{ value: 'geo', label: '地心(默认)' },
	{ value: 'helio', label: '日心' },
	{ value: 'moon', label: '月心' },
	{ value: 'mercury', label: '水星心' },
	{ value: 'venus', label: '金星心' },
	{ value: 'mars', label: '火星心' },
	{ value: 'jupiter', label: '木星心' },
	{ value: 'saturn', label: '土星心' },
	{ value: 'uranus', label: '天王心' },
	{ value: 'neptune', label: '海王心' },
	{ value: 'pluto', label: '冥王心' },
];

class AstroChartMain3D extends Component{
	// jieqi/印度等变体传 hidemodes/hidezodiacal → 盘型选择连带隐藏(盘语义绑定地心,主限无义)。

	constructor(props) {
		super(props);
		this.state = {
			centerMode: 'geo',
			tabH: null,   // [右栏满高] 实测 tabs 内容高;null=回退旧扣高公式
			// horosa_freeze_subtabs_v1:右栏 5 个子页签原为 defaultActiveKey(非受控),
			// 拿不到 activeKey 就无法冻结。改受控:初值仍是 '1'(信息),onChange 记进 state,
			// 用户可见行为逐字不变。
			sideTab: '1',
		}
		this.changeSideTab = (key)=>{ this.setState({ sideTab: key }); };
		// 右栏 tabs 实测高:写死扣高(height-252)与各卡实际高度脱节 → 底部大空白;RO 量真值。
		this.attachSideTabsRO = (node)=>{
			if(!node || node === this._sideTabsNode || typeof ResizeObserver === 'undefined'){ return; }
			if(this._sideRO){ try{ this._sideRO.disconnect(); }catch(e){} }
			this._sideTabsNode = node;
			this._sideRO = new ResizeObserver(()=>{ clearTimeout(this._sideROT); this._sideROT = setTimeout(()=>{
				try{
					const nav = node.querySelector('.ant-tabs-nav');
					const h = Math.floor(node.clientHeight - (nav ? nav.offsetHeight : 46) - 2);
					if(h > 160 && Math.abs(h - (this.state.tabH || 0)) > 6){ this.setState({ tabH: h }); }
				}catch(e){}
			}, 80); });
			try{ this._sideRO.observe(node); }catch(e){}
		};
		this._centerReq = 0;   // 中心盘请求序号(快速连切时只认最新一发)

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);
		this.changeCenterMode = this.changeCenterMode.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				return;
			};
		}
	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
				confirmed: tm.confirmed,
			});
		}
	}

	changeZodiacal(val){
		if(this.props.onChange){
			const parsed = AstroConst.parseZodiacSelectValue(val);
			this.props.onChange({
				zodiacal: parsed.zodiacal,
				siderealAyanamsa: parsed.siderealAyanamsa,
			});
		}
	}

	changeHsys(val){
		if(this.props.onChange){
			this.props.onChange({
				hsys: val,
			});
		}
	}

	changeSouthChart(val){
		if(this.props.fields.gpsLat === undefined || this.props.fields.gpsLat === null || this.props.fields.gpsLat.value >= 0){
			return;
		}
		if(this.props.onChange){
			this.props.onChange({
				southchart: val,
			});
		}
	}

	// —— WS-2 全行星中心盘(中心体切换) ——

	/** /chart3d/state 构参:fields 的 date/time/zone/ad/lat/lon(与 fieldsToParams 同格式)。
	 *  fieldsOverride 供步进预取传【已步进 fields】——与真点共用同一构参路径 = 缓存键逐字节同键。 */
	buildChart3DParams(center, fieldsOverride){
		const f = fieldsOverride || this.props.fields;
		if(!f || !f.date || !f.date.value || !f.time || !f.time.value || !f.lat || !f.lon){
			return null;
		}
		return {
			date: f.date.value.format('YYYY/MM/DD'),
			time: f.time.value.format('HH:mm:ss'),
			zone: f.date.value.zone,
			ad: f.date.value.ad,
			lat: f.lat.value,
			lon: f.lon.value,
			center: center,
		};
	}

	/** 失败回落:警示 + 选择器回地心 + 引擎完全退出多中心逻辑;并作废一切在途响应 */
	revertCenterToGeo(warnText){
		if(warnText){
			message.warning(warnText);
		}
		this._centerReq = (this._centerReq || 0) + 1; // 在途响应按 seq 判据全部作废
		if(this.state.centerMode !== 'geo'){
			this.setState({ centerMode: 'geo' });
		}
		const engine = this.chart3dRef ? this.chart3dRef.astro3d : null;
		if(engine){
			engine.setCenterMode('geo');
		}
	}

	/** 取数并驱动引擎:同中心=数据刷新,换中心=换系动画(引擎内判);序号防连切错序 */
	applyCenterMode(center){
		const engine = this.chart3dRef ? this.chart3dRef.astro3d : null;
		if(center === 'geo'){
			if(engine){
				engine.setCenterMode('geo');
			}
			return;
		}
		const params = this.buildChart3DParams(center);
		if(!engine || !params){
			this.revertCenterToGeo('3D 引擎未就绪,已回到地心');
			return;
		}
		this._centerReq = (this._centerReq || 0) + 1;
		const seq = this._centerReq;
		fetchChart3DState(params).then((rsp)=>{
			// 只按 seq 判废:缓存命中时 resolve 在 microtask 先于 React setState 提交,
			// 读 this.state.centerMode 会把合法响应误判成过期(实爆:切日心被静默丢弃);
			// revert/再切换都 bump seq,序号判据已完备。
			if(seq !== this._centerReq){
				return;   // 已被更新的选择/回退接管
			}
			// boundless 协议:业务数据包在 Result 字段(照 models/astro 的 rsp.Result 剥壳先例);
			// 直判 rsp.bodies 恒 undefined → 曾把 99KB 合法响应误报成「计算失败」。
			const payload = (rsp && rsp.Result !== undefined && rsp.Result !== null) ? rsp.Result : rsp;
			if(!payload || payload.err || !payload.bodies || !payload.bodies.length){
				this.revertCenterToGeo('中心盘计算失败,已回到地心');
				return;
			}
			const eng = this.chart3dRef ? this.chart3dRef.astro3d : null;
			if(!eng){
				this.revertCenterToGeo('3D 引擎未就绪,已回到地心');
				return;
			}
			eng.setCenterMode(center, payload);
		}).catch(()=>{
			if(seq !== this._centerReq){
				return;
			}
			this.revertCenterToGeo('中心盘计算失败,已回到地心');
		});
	}

	changeCenterMode(val){
		const center = val || 'geo';
		if(center === this.state.centerMode){
			return;
		}
		this.setState({ centerMode: center });
		this.applyCenterMode(center);
	}

	componentDidUpdate(prevProps){
		// 非地心模式下盘数据变化(改时间/地点)→ 同中心重取 3D 状态原地刷新;
		// 地心默认路径零涉(条件恒假)
		if(this.state.centerMode !== 'geo'
			&& prevProps.value !== this.props.value
			&& this.props.value && !this.props.value.err){
			this.applyCenterMode(this.state.centerMode);
		}
		// horosa_panel_ready_v1:3D 盘没有「数据落定的 setState」可挂 —— chartObj 由 models/astro
		// 推给 props,右栏各表由它同步派生,中栏是 WebGL 画布(three.js 自有 rAF 循环)。
		// 故就绪点取「携带新 chartObj 的这次 React 提交完成」,markPanelReady 内的双 rAF 再把
		// 落点推到下一个绘制帧。⚠ 口径说明:它计入 React 侧右栏画完 + 引擎收到新数据后的首帧,
		// 但**不**保证 3D 换系动画播完(那是动画时长,不属于「画完」预算)。
		// ⚠ currentTab 守卫必需:本组件**同时**被 JieQiChartsMain 当作「XX3D盘」子页签复用
		// (那里不传 currentTab)。markPanelReady 消费的是全局唯一的交互起点,不设防的话
		// 节气页里的这个实例会把 'jieqichart' 那次交互抢走、记成 'astrochart3D' —— 记错格
		// 比不记更坏。只有 pages/index.js 顶层那一个实例(传 currentTab)才打点。
		if(this.props.currentTab === 'astrochart3D' && prevProps.value !== this.props.value){
			markPanelReady('astrochart3D');
		}
	}

	changeGeo(rec){
		if(this.props.onChange){
			const payload = {
				lon: convertLonToStr(rec.lng),
				lat: convertLatToStr(rec.lat),
				gpsLon: rec.gpsLng,
				gpsLat: rec.gpsLat
			};
			// 选地点 → 时区自动校正(与 2D 占星一致:重锚出生时刻到新偏移、保留钟面时刻;手动改过则用 rec.zone)
			const chartObj = this.props.value;
			const f = this.props.fields || {};
			const curZone = (chartObj && chartObj.params) ? chartObj.params.zone : (f.zone ? f.zone.value : null);
			const birth = (chartObj && chartObj.params) ? chartObj.params.birth : null;
			if(birth){
				const dt = new DateTime();
				if(curZone){ dt.setZone(curZone); }
				if(birth.length > 11){ dt.parse(birth, 'YYYY-MM-DD HH:mm:ss'); }else{ dt.parse(birth, 'YYYY-MM-DD'); }
				const z = resolveGeoZone(rec, dt.format ? dt.format('YYYY-MM-DD') : null);
				if(z && dt.setZone){ dt.setZone(z); }
				payload.tm = dt;
				payload.ad = dt.ad;
				payload.zone = dt.zone;
			}else{
				const z = resolveGeoZone(rec, null);
				if(z){ payload.zone = z; }
			}
			Object.assign(payload, geoNameRawPatch(rec));
			this.props.onChange(payload);
		}
	}

	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		// horosa_prefetch_registry_v1(PERF-R10 P6):3D 星盘步进预取 —— 仅非地心中心盘打后端
		// (geo=纯前端引擎零网络);构参与真点同一 buildChart3DParams 路径(fieldsOverride 版),
		// fetchChart3DState 自带 stateMem+在途合流,叠加 dedupe '/chart3d' 前缀三层落桶。
		this._stepPrefetcher = (steppedFields)=>{
			try{
				const center = this.state.centerMode;
				if(!center || center === 'geo'){ return []; }
				const params = this.buildChart3DParams(center, steppedFields);
				if(!params){ return []; }
				return [{
					name: `chart3d:${center}`,
					path: '/chart3d/state',
					run: ()=> fetchChart3DState(params, { silent: true, retry: { retries: 0 } }).catch(()=>{ /* 预取失败静默 */ }),
				}];
			}catch(e){
				return [];
			}
		};
		registerStepPrefetcher('astrochart3D', this._stepPrefetcher);
	}

	componentWillUnmount(){
		clearTimeout(this._sideROT);
		if(this._sideRO){ try{ this._sideRO.disconnect(); }catch(e){} }
		if(this._stepPrefetcher){
			unregisterStepPrefetcher('astrochart3D', this._stepPrefetcher);
			this._stepPrefetcher = null;
		}
	}

	render(){
		let chartObj = this.props.value;
		let fields = this.props.fields;
		let dt = new DateTime();
		// 部分态 chartObj(有 params 无 zone)按缺失处理回退 fields,防 setZone(undefined) 崩渲染
		if(chartObj && chartObj.params && chartObj.params.zone){
			dt.setZone(chartObj.params.zone);
		}else{
			dt.setZone(fields.zone.value);
		}
		let dtstr = chartObj ? chartObj.params.birth : null;
		if(dtstr){
			if(dtstr.length > 11){
				dt.parse(dtstr, 'YYYY-MM-DD HH:mm:ss');
			}else{
				dt.parse(dtstr, 'YYYY-MM-DD');
			}
		}	

		let height = this.props.height ? this.props.height : 760;
		let chartHeight = Math.max(360, height - 28);
		let tabHeight = this.state.tabH || (height - 252);
		let showzodical = true;
		let showhsys = true;
		let showdateselector = true;
		let showlots = true;
		let indiahsys = false;
		// 中心体切换(WS-2):新 prop hidemodes 显式关闭;jieqi/印度/希腊等变体
		// (均传 hidezodiacal=1,fields 形态各异且盘语义绑定地心)一并隐藏,
		// 既有变体 props 不必新增传参即保持原工作方式
		let showmodes = true;
		if(this.props.hidemodes || this.props.hidezodiacal){
			showmodes = false;
		}
		if(this.props.hidezodiacal){
			showzodical = false
		}
		if(this.props.hidehsys){
			showhsys = false;
		}
		if(this.props.hidedateselector){
			showdateselector = false;
			tabHeight = tabHeight + 112;
		}
		if(this.props.hidelots){
			showlots = false;
		}
		if(this.props.indiahsys){
			indiahsys = true;
			showhsys = false;
		}

		// horosa_freeze_subtabs_v1 ★复核补丁(horosa_controlled_tab_clamp_v1):
		// 右栏 Tabs 已从 defaultActiveKey(非受控)改为受控 activeKey。受控之下,
		// 「希腊点」(key '4')是**条件渲染**的面板(showlots=false 时整个 TabPane 不存在)——
		// 一旦 activeKey 指向一个不存在的面板,rc-tabs 的兜底(把 activeKey 拉回现存面板)
		// 只写内部 state,受控模式下被外部 activeKey 覆盖回来 → 右栏**整块空白、无页签高亮**。
		// 非受控时代 rc-tabs 自己就能纠偏,所以这是「受控化」带来的新风险,必须在这里补齐。
		// 计算态钳位(不 setState,避免 render 里改状态):面板不存在就回落到「信息」。
		// showlots 目前由静态 prop hidelots 决定(顶层实例恒 true),故正常路径下逐字不变。
		const sideTab = (!showlots && this.state.sideTab === '4') ? '1' : this.state.sideTab;

		let needChart3D = false;
		if((this.props.currentTab && this.props.currentTab === 'astrochart3D') || this.props.needChart3D){
			needChart3D = true;
		}

		return (
			<div className="horosa-3d-page xq-chart-renderer xq-chart-renderer-3d">
				<XQPanel className="horosa-3d-stage">
					<div className="horosa-3d-stage-title">
						<div>
							<div className="horosa-3d-eyebrow">三维天球</div>
							<div className="horosa-3d-title">3D 星盘</div>
						</div>
						{/* [主限天球入口下线] 原「星盘/主限天球」切换移除——主限天球只从星运页进入。 */}
						<div className="horosa-3d-hint">双击画布进入或退出全屏</div>
					</div>
					<div className="horosa-3d-canvas-wrap">
						{/* [主限天球入口下线·2026-08-01 清理] 原 boardMode==='pdsphere' 分支已删:
						    boardMode 在 constructor 里硬编码 'chart' 且全文件无任何 setState 改它,
						    该条件恒 false —— 是死路径。但它那行静态 import AstroPDSphere 会把
						    PDSphereEngine + three 白白拖进本 3D chunk。主限天球只从星运页进入。 */}
						<AstroChart3D
							ref={(inst)=>{ this.chart3dRef = inst; }}
							value={chartObj}
							fields={this.props.fields}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							height={chartHeight}
							needChart3D={needChart3D}
						/>
					</div>
				</XQPanel>
				<XQPanel className="horosa-3d-side">
					{/* [观象P2] 3D 页右栏三段式:时间(不折叠)/盘面参数/地点;XQSectionTitle 升级可折叠段 */}
					{showdateselector ? (
						<XQSideSection iconName={sideSectionIcon('time')} title="时间" collapsible={false}>
						<div className="horosa-3d-time">
							<PlusMinusTime value={dt} onChange={this.changeTime} />
						</div>
						</XQSideSection>
					) : null}
					<XQSideSection iconName={sideSectionIcon('chartStyle')} title="盘面参数" storageKey="astro3d.params" className="horosa-side-input-section">
					<div className="horosa-3d-control-grid">
						{showzodical ? (
							<XQSelect
								onChange={this.changeZodiacal}
								value={AstroConst.zodiacSelectValue(this.props.fields.zodiacal.value, this.props.fields.siderealAyanamsa && this.props.fields.siderealAyanamsa.value)}
								dropdownMatchSelectWidth={false}
								size='small'
							>
								{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
									<OptGroup label={grp.group} key={grp.group}>
										{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
									</OptGroup>
								))}
							</XQSelect>
						) : null}
						{showhsys ? (
							<XQSelect
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size='small'
							>
								{ getHousesOption() }
							</XQSelect>
						) : null}
						{showhsys ? (
							<XQSelect
								onChange={this.changeSouthChart}
								value={this.props.fields.southchart.value}
								size='small'
							>
								<Option value={0}>天文星座</Option>
								<Option value={1}>涵义星座</Option>
							</XQSelect>
						) : null}
						{indiahsys ? (
							<XQSelect
								onChange={this.changeHsys}
								value={this.props.fields.hsys.value}
								size='small'
							>
								<Option value={0}>整宫制</Option>
								<Option value={5}>Vehlow Equal</Option>
							</XQSelect>
						) : null}
						{showmodes ? (
							<XQSelect
								onChange={this.changeCenterMode}
								value={this.state.centerMode}
								dropdownMatchSelectWidth={false}
								size='small'
							>
								{CENTER_MODE_OPTIONS.map((item)=>(
									<Option value={item.value} key={item.value}>{item.label}</Option>
								))}
							</XQSelect>
						) : null}
					</div>
					</XQSideSection>
					{showdateselector ? (
						<XQToolbar className="horosa-3d-geo">
							<GeoCoordModal
								onOk={this.changeGeo}
								lat={this.props.fields.gpsLat.value}
								lng={this.props.fields.gpsLon.value}
							>
								<XQButton size='small' iconName="locastro">经纬度选择</XQButton>
							</GeoCoordModal>
							<span>{this.props.fields.lon.value + ' ' + this.props.fields.lat.value}</span>
						</XQToolbar>
					) : null}
					<div className="horosa-3d-tabs-fill" ref={this.attachSideTabsRO}>
					{/* horosa_freeze_subtabs_v1：右栏 5 个面板此前全内联 —— 首次激活后永久挂载，
					    此后每次改时间/改宫制/切中心体都把看不见的相位表、行星表、希腊点表一并重渲，
					    直接吃掉「右栏画完」的预算。函数式 children：从未激活过的面板连元素都不建；
					    已激活过的在非激活期跳过 re-render，切回时拿本轮最新 chartObj 立即渲一帧
					    —— 不卸载、不重取、不丢滚动位置。 */}
					<XQTabs activeKey={sideTab} onChange={this.changeSideTab} tabPosition='top' className="horosa-3d-tabs">
						<TabPane tab="信息" key="1">
							<FreezeSubTab active={sideTab === '1'}>{()=>(
							<AstroInfo height={tabHeight}
								value={chartObj} fields={fields}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							)}</FreezeSubTab>
						</TabPane>
						<TabPane tab="相位" key="2">
							<FreezeSubTab active={sideTab === '2'}>{()=>(
							<AstroAspect
								value={chartObj} height={tabHeight}
								lotsDisplay={this.props.lotsDisplay}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							)}</FreezeSubTab>
						</TabPane>
						<TabPane tab="行星" key="3">
							<FreezeSubTab active={sideTab === '3'}>{()=>(
							<AstroPlanet
								value={chartObj}
								height={tabHeight}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							)}</FreezeSubTab>
						</TabPane>
						{showlots ? (
							<TabPane tab="希腊点" key="4">
								<FreezeSubTab active={sideTab === '4'}>{()=>(
								<AstroLots value={chartObj} height={tabHeight} showAstroMeaning={this.props.showAstroMeaning}/>
								)}</FreezeSubTab>
							</TabPane>
						) : null}
						<TabPane tab="显示" key="5">
							{/* WS-1:显示设置迁右栏(替代画布内 lil-gui);engineTick=chartObj 变化触发面板重同步 */}
							{/* ⚠ 本面板 eager：它挂载即向 3D 引擎同步显示开关（getEngine/engineTick 属对外注册型副作用），
							    延迟首渲会让「显示」设置在用户第一次点开该页签之前不生效 —— 那是功能降级。
							    故只取冻结语义（非激活期不重渲）、不取延迟首渲。 */}
							<FreezeSubTab active={sideTab === '5'} eager>
								<Astro3DSettingsPanel
									getEngine={()=>this.chart3dRef && this.chart3dRef.astro3d}
									engineTick={chartObj ? chartObj.chartId : ''}
								/>
							</FreezeSubTab>
						</TabPane>
					</XQTabs>
					</div>
				</XQPanel>
			</div>
		);
	}

}

export default AstroChartMain3D;
