import { Component } from 'react';
import { message } from 'antd';
import AstroChart3D from './AstroChart3D';
import Astro3DSettingsPanel from './Astro3DSettingsPanel';
import { fetchChart3DState } from '../../services/astro3d';
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
import AstroPDSphere from './AstroPDSphere';
import * as AstroConst from '../../constants/AstroConst';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

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
	// [WP-5.1] 盘型:星盘(既有 3D 主盘)|主限天球(复用 AstroPDSphere;localStorage 记忆)。
	// jieqi/印度等变体传 hidemodes/hidezodiacal → 盘型选择连带隐藏(盘语义绑定地心,主限无义)。

	constructor(props) {
		super(props);
		// [主限天球入口下线] 3D 星盘页不再提供「主限天球」盘型切换(只从星运页进入);boardMode 固定 chart。
		const _bm = 'chart';
		this.state = {
			centerMode: 'geo',
			boardMode: _bm,
			tabH: null,   // [右栏满高] 实测 tabs 内容高;null=回退旧扣高公式
		}
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
		// [WP-5.1] 主限天球简版构参:fields 直读+主限默认(方法/时间钥匙/顺行;与星运页
		// 不共享设置态——本页无主限设置面,固定学理默认;畸形日期 NaN 守卫同口径)。
		this.buildPdSphereRequest = ()=>{
			const f = this.props.fields || {};
			const gv = (k, d)=>(f[k] && f[k].value !== undefined && f[k].value !== null ? f[k].value : d);
			const dateValue = f.date && f.date.value;
			const timeValue = f.time && f.time.value;
			if(!dateValue || !timeValue || !dateValue.format || !timeValue.format){ return null; }
			const dateStr = dateValue.format('YYYY/MM/DD');
			const timeStr = timeValue.format('HH:mm:ss');
			if(`${dateStr}`.indexOf('NaN') >= 0 || `${timeStr}`.indexOf('NaN') >= 0){ return null; }
			return {
				date: dateStr, time: timeStr,
				ad: dateValue.ad !== undefined ? dateValue.ad : 1,
				zone: gv('zone', undefined), lat: gv('lat', undefined), lon: gv('lon', undefined),
				gpsLat: gv('gpsLat', undefined), gpsLon: gv('gpsLon', undefined),
				hsys: gv('hsys', 0), southchart: gv('southchart', 0),
				zodiacal: gv('zodiacal', 0), siderealAyanamsa: gv('siderealAyanamsa', ''),
				tradition: gv('tradition', 0), strongRecption: gv('strongRecption', 0),
				simpleAsp: gv('simpleAsp', 0), virtualPointReceiveAsp: gv('virtualPointReceiveAsp', 0),
				doubingSu28: gv('doubingSu28', 0),
				predictive: true, includePrimaryDirection: true, showPdBounds: 1,
				pdtype: 0, pdMethod: 'core_alchabitius', pdTimeKey: 'Ptolemy', pdYears: 100,
				pdDirect: 1, pdConverse: 1, pdAntiscia: 0, pdTerms: 0,
				pdaspects: [0, 60, 90, 120, 180],
			};
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

	/** /chart3d/state 构参:props.fields 的 date/time/zone/ad/lat/lon(与 fieldsToParams 同格式) */
	buildChart3DParams(center){
		const f = this.props.fields;
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

	componentWillUnmount(){ clearTimeout(this._sideROT); if(this._sideRO){ try{ this._sideRO.disconnect(); }catch(e){} } }

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
						{this.state.boardMode === 'pdsphere' && showmodes ? (
							<AstroPDSphere
								value={this.props.value}
								buildRequest={this.buildPdSphereRequest}
								pdMethod={'core_alchabitius'}
								pdTimeKey={'Ptolemy'}
								pdType={0}
								height={chartHeight}
							/>
						) : (
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
						)}
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
					<XQTabs defaultActiveKey="1" tabPosition='top' className="horosa-3d-tabs">
						<TabPane tab="信息" key="1">
							<AstroInfo height={tabHeight}
								value={chartObj} fields={fields}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</TabPane>
						<TabPane tab="相位" key="2">
							<AstroAspect
								value={chartObj} height={tabHeight}
								lotsDisplay={this.props.lotsDisplay}
								planetDisplay={this.props.planetDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</TabPane>
						<TabPane tab="行星" key="3">
							<AstroPlanet
								value={chartObj}
								height={tabHeight}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</TabPane>
						{showlots ? (
							<TabPane tab="希腊点" key="4">
								<AstroLots value={chartObj} height={tabHeight} showAstroMeaning={this.props.showAstroMeaning}/>
							</TabPane>
						) : null}
						<TabPane tab="显示" key="5">
							{/* WS-1:显示设置迁右栏(替代画布内 lil-gui);engineTick=chartObj 变化触发面板重同步 */}
							<Astro3DSettingsPanel
								getEngine={()=>this.chart3dRef && this.chart3dRef.astro3d}
								engineTick={chartObj ? chartObj.chartId : ''}
							/>
						</TabPane>
					</XQTabs>
					</div>
				</XQPanel>
			</div>
		);
	}

}

export default AstroChartMain3D;
