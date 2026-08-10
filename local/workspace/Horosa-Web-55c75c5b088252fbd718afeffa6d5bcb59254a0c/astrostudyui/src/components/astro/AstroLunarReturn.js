import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import { XQSelect as Select, XQTabs as Tabs } from '../xq-ui';
import AstroChart from './AstroChart';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { convertToArray} from '../../utils/helper';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPredictiveSnapshotText, } from '../../utils/predictiveAiSnapshot';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const TabPane = Tabs.TabPane;
const Option = Select.Option;

class AstroLunarReturn extends Component{

	constructor(props) {
		super(props);

		this.unmounted = false;

		this.submit = this.submit.bind(this);
		this.fieldsChanged = this.fieldsChanged.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.genAspectDom = this.genAspectDom.bind(this);
		this.changeDblChartType = this.changeDblChartType.bind(this);
		this.changeChartTab = this.changeChartTab.bind(this);
		this.renderPlanetLabel = this.renderPlanetLabel.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		let qryparam = this.genNatalParams(this.props.value);
		let dt = new DateTime();
		if(qryparam.datetime){
			dt = qryparam.datetime;
		}

		this.state = {
			params: {
				date: qryparam.date,
				time: qryparam.time,
				ad: qryparam.ad ? qryparam.ad : 1,
				zone: qryparam.zone,
				lon: qryparam.lon,
				lat: qryparam.lat,
				hsys: qryparam.hsys,
				zodiacal: qryparam.zodiacal, siderealAyanamsa: qryparam.siderealAyanamsa,
				tradition: qryparam.tradition,
				datetime: dt,
				dirLat: qryparam.lat,
				dirLon: qryparam.lon,
				dirZone: qryparam.zone,
				gpsLat: qryparam.gpsLat,
				gpsLon: qryparam.gpsLon,
				tmType: 'y',
				nodeRetrograde: false,
				asporb: 1,
			},
			dirChart: null,
			inverse: true,
			secDirChart: null,
			// 受控子页签(原 defaultActiveKey 非受控):FreezeSubTab 需要知道哪一页在前台。
			// 初值 = 原 defaultActiveKey='singlechart',首屏行为逐字不变。
			chartTab: 'singlechart',
		}

		if(this.state.params.date){
			let dtstr = this.state.params.datetime.format('YYYY-MM-DD');
			if(dtstr === this.state.params.date){
				this.state.params.datetime.add(1, 'd');
			}
		}else{
			let tm = new DateTime();
			this.state.params.date = tm.format('YYYY-MM-DD');
			this.state.params.datetime.add(1, 'd');
		}


		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted || chartObj === undefined || chartObj === null){
					return;
				}
				let param = this.genNatalParams(chartObj);
				let params = {
					...this.state.params,
					...param,
				};
				this.setState({
					params: params
				}, ()=>{
					this.requestData();
				})
			};

		}
	}

	renderPlanetLabel(chartWrap, id){
		const text = appendPlanetHouseInfoById(
			AstroText.AstroMsg[id],
			chartWrap,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		return (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
	}

	genNatalParams(chartObj){
		// horosa_no_mutate_chart_params_v1(PERF-R9 Ship 6):此前是 `let qryparam = chartObj.params`
		// 然后直接 `qryparam.date = …` —— 就地变异**共享的盘对象**。副作用是真的:
		// AstroExtraCommon.chartRequestKey 把 params.date/time 计入请求键,于是「本技法有没有被挂载过」
		// 会改变其它技法的缓存键。改为在本地副本上派生(birth 仍是唯一真源,chartParams 侧本就有同款回退),
		// 盘对象自此只读 —— 这也是任何按引用比较的 memo/sCU 能成立的前提。
		const src = (chartObj && chartObj.params) ? chartObj.params : {};
		let qryparam = { ...src };
		let datetime = new DateTime();
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
			let dtstr = datetime.format('yyyy') + parts[0].substr(4) + ' ' + parts[1];
			if(parts[1].length < 8){
				dtstr = dtstr + ':00';
			}
			datetime.parse(dtstr, 'yyyy-MM-dd HH:mm:ss');
		}
		let params = {
			date: qryparam.date,
			time: qryparam.time,
			datetime: datetime,
			ad: qryparam.ad ? qryparam.ad : 1,
			zone: qryparam.zone,
			lon: qryparam.lon,
			lat: qryparam.lat,
			gpsLon: qryparam.gpsLon,
			gpsLat: qryparam.gpsLat,
			hsys: qryparam.hsys,
			zodiacal: qryparam.zodiacal, siderealAyanamsa: qryparam.siderealAyanamsa,
			tradition: qryparam.tradition,
		};
		return params;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		params.datetime = params.datetime.format('YYYY-MM-DD HH:mm');
		params.dirZone = params.datetime.zone;
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	async requestDirection(params){
		// 空回包/请求失败防御:后端未就绪、无效生辰等场景 request 可能抛错或返回空——
		// 静默保持现盘,不产生 Unhandled Rejection(request 失败 resolve undefined 是全仓契约)。
		let data = null;
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换 —— 印占同款范式)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		try{
			data = await request(`${Constants.ServerRoot}/predict/lunarreturn`, {
				body: JSON.stringify(params),
				silent: silentTechniquePanelsEnabled(),
			});
		}catch(e){
			this.setState({ updating: false });
			return;
		}
		const result = data ? data[Constants.ResultKey] : null;
		if(!result){
			this.setState({ updating: false });
			return;
		}

		let tm = new DateTime();
		let dt = tm.parse(params.datetime, 'YYYY-MM-DD HH:mm:ss');
		if(params.dirZone){
			dt.setZone(params.dirZone);
		}
		const st = {
			dirChart: result,
			updating: false,
			params: {
				...params,
				datetime: dt,
			},
		};
		if(result.secLuneReturn){
			st.secDirChart = result.secLuneReturn;
		}else{
			st.secDirChart = null;
		}

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:推运盘数据落定(中栏盘 + 右栏相位同源于 st.dirChart)的唯一提交点。
			markPanelReady('direction');
			const chartValue = this.props.value;
			saveModuleAISnapshotLazy('lunarreturn', ()=>buildPredictiveSnapshotText(chartValue, st.params, result, 'lunarreturn'), {
				module: 'lunarreturn',
			});
		});
	}

	submit(values){
		let params = {
			...this.state.params
		};
		params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss');
		params.dirLat = values.lat;
		params.dirLon = values.lon;
		if(values.zone){
			params.dirZone = values.zone;
		}

		this.requestDirection(params);
	}

	fieldsChanged(changedFields){
		let params = {
			...this.state.params
		}

		if(changedFields.datetime && changedFields.datetime.value){
			if(changedFields.datetime.value instanceof DateTime){
				params.datetime = changedFields.datetime.value;
			}else{
				params.datetime = changedFields.datetime.value.time;
			}
			params.ad = changedFields.datetime.value.ad;
		}
		if(changedFields.lat){
			params.dirLat = changedFields.lat.value;
		}
		if(changedFields.lon){
			params.dirLon = changedFields.lon.value;
		}
		if(changedFields.zone){
			params.dirZone = changedFields.zone.value;
		}
		if(changedFields.gpsLat){
			params.gpsLat = changedFields.gpsLat.value;
		}
		if(changedFields.gpsLon){
			params.gpsLon = changedFields.gpsLon.value;
		}
		if(changedFields.tmType){
			params.tmType = changedFields.tmType.value;
		}
		if(changedFields.asporb){
			params.asporb = changedFields.asporb.value;
		}
		if(changedFields.nodeRetrograde){
			params.nodeRetrograde = changedFields.nodeRetrograde.value;
		}

		this.setState({
			params: params
		});
	}

	// horosa_aspect_dom_memo_v1(PERF-R9 Ship 6):右栏相位清单的输出**只**由三样东西决定 ——
	// state.dirChart(推运结果对象,每次请求整体替换)、props.value(本命盘)、props.showPlanetHouseInfo
	// (renderPlanetLabel 唯一读到的 prop)。三者引用全同 ⇒ 输出逐字节相同,直接复用上次的元素树:
	// 「更新中」角标开合、子页签切换、父组件重渲等与相位无关的重渲不再重建数百个 React 元素。
	// 任一引用变化(含内容整体替换)立即重建 —— 不存在陈旧,亦不依赖任何深比较。
	genAspectDom(){
		const cache = this._aspectDomCache;
		if(cache
			&& cache.dir === this.state.dirChart
			&& cache.natal === this.props.value
			&& cache.phi === this.props.showPlanetHouseInfo){
			return cache.dom;
		}
		const dom = this.buildAspectDom();
		this._aspectDomCache = {
			dir: this.state.dirChart,
			natal: this.props.value,
			phi: this.props.showPlanetHouseInfo,
			dom: dom,
		};
		return dom;
	}

	buildAspectDom(){
		if(this.state.dirChart === undefined || this.state.dirChart === null){
			return null;
		}

		let aspects = this.state.dirChart.chart.aspects;
		let divs = [];
		for(let i=0; i<aspects.length; i++){
			let obj = aspects[i];
			if(obj.objects.length === 0){
				continue;
			}
			let coldivs = [];
			let natalObjs = obj.objects;
			for(let j=0; j<natalObjs.length; j++){
				let natalObj = natalObjs[j];
				let asp = natalObj.aspect;
				let dom = (
					<div key={natalObj.natalId + j}>
						<span style={{fontFamily: AstroConst.AstroFont}}>&emsp;{AstroText.AstroMsg['Asp' + asp]}&nbsp;</span>
						<span>{this.renderPlanetLabel(this.props.value, natalObj.natalId)}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(natalObj.delta * 1000)/1000}
						</span>
					</div>
				);
				coldivs.push(dom);
			}
			let domtitle = (
				<Col key={i} span={12}>
					<div>
						<span style={{fontFamily: AstroConst.NormalFont}}>行运&nbsp;</span>
						<span>{this.renderPlanetLabel(this.state.dirChart, obj.directId)}</span>
					</div>
					{coldivs}
				</Col>
			);
			divs.push(domtitle);
		}

		let rows = [];
		let cols = [];
		for(let i=0; i<divs.length; i++){
			if(i % 2 === 0){
				if(i > 0){
					let dom = (
						<div key={`row-${i}`}>
							<Row>
								{cols}
							</Row>
							<Divider dashed />
						</div>
					);	
					rows.push(dom);		
				}
				cols = [];
			}
			cols.push(divs[i]);
		}
		rows.push((
			<Row key="row-last">
				{cols}
			</Row>
		));

		let dom = (
			<div>
				{rows}
			</div>
		);
		return dom;
	}

	changeDblChartType(value){
		this.setState({
			inverse: value,
		});
	}

	changeChartTab(key){
		this.setState({ chartTab: key });
	}

	componentDidMount(){
		this.unmounted = false;
		this.requestData();
		// 实时刷新:AI 导出/分析前广播 horosa:refresh-module-snapshot 时,用「当前显示盘」同步重建快照,
		// 避免 reload/缓存为空时导出报「当前页面没有可导出文本」。
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'lunarreturn'){
			return;
		}
		const result = this.state ? this.state.dirChart : null;
		if(!result){
			return;
		}
		let text = '';
		try{
			text = `${buildPredictiveSnapshotText(this.props.value, this.state.params, result, 'lunarreturn') || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('lunarreturn', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	render(){
		let chartObj = {
			natualChart: this.props.value,
			dirChart: this.state.dirChart,
			inverse: this.state.inverse,
		};

		let rChart = null;
		if(this.state.dirChart && this.state.dirChart.dirChart){
			rChart = this.state.dirChart.dirChart;
		}

		let secChartObj = null;
		let secRChart = null;
		if(this.state.secDirChart && this.state.secDirChart.dirChart){
			secChartObj = {
				natualChart: this.props.value,
				dirChart: this.state.secDirChart,
				inverse: this.state.inverse,	
			}
			secRChart = this.state.secDirChart.dirChart;
		}

		let param = this.state.params;
		let tm = new DateTime();
		let fields = {
			startDate: {
				value: tm.parse(param.date, 'YYYY-MM-DD'),
				name: ['startDate'],
			},
			yearMonth: true,
			onlyYear: false,
			needZone: true,
			datetime: {
				value: param.datetime,
				name: ['datetime'],
			},
			lat: {
				value: param.dirLat,
				name: ['lat'],
			},
			lon: {
				value: param.dirLon,
				name: ['lon'],
			},
			gpsLat: {
				value: param.gpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: param.gpsLon,
				name: ['gpsLon'],
			},
			tmType: {
				value: param.tmType,
				name: ['tmType'],
			},
			nodeRetrograde: {
				value: param.nodeRetrograde,
				name: ['nodeRetrograde'],
			},
			asporb: {
				value: param.asporb,
				name: ['asporb'],
			},
			tmTasporbype: {
				value: param.asporb,
				name: ['tmTasporbype'],
			},
			ad: {
				value: param.ad,
				name: ['ad'],
			},
		};
		let fieldsary = convertToArray(fields);

		let aspdom = this.genAspectDom();

		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};
		let chartHeight = height - 50;
		// 受控 activeKey 的可用键集合:第二返照(对比)盘是条件渲染的,盘不在时该键不存在 ——
		// 受控 Tabs 若停在已消失的键会显示空白,故此处兜回首页签(非受控时代由 antd 内部兜)。
		const availChartTabs = ['singlechart', 'nautalchart', 'doublechart'];
		if(secRChart){ availChartTabs.push('secsinglechart'); }
		if(secChartObj){ availChartTabs.push('secdoublechart'); }
		const chartTab = availChartTabs.indexOf(this.state.chartTab) >= 0 ? this.state.chartTab : 'singlechart';

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						{/* keep-stale 角标:重取期间旧返照盘留在盘面,右上角提示「更新中…」;首次加载(无旧盘)不显示 */}
						<div style={{ position: 'relative' }}>
						{this.state.updating && this.state.dirChart ? <UpdatingBadge /> : null}
						{/* horosa_freeze_subtabs_v1:最多五张盘此前全部常驻重渲(每次切时间/改选项都画 5 张)。
						    改受控 + FreezeSubTab:只有前台那张参与重渲;切回时拿本轮最新 children 立即渲一帧,
						    不卸载、不重发请求、不丢滚动位置。截图只取激活面板,AI 快照走数据不走 DOM。 */}
						<Tabs
							activeKey={chartTab} tabPosition='bottom'
							onChange={this.changeChartTab}
							style={{ height: height }}
						>
							<TabPane tab="返照盘" key="singlechart">
								<FreezeSubTab active={chartTab === 'singlechart'}>
									<AstroChart value={rChart}
										wheelArt={this.props.wheelArt}
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										height={chartHeight}
									/>
								</FreezeSubTab>
							</TabPane>
							<TabPane tab="原命盘" key="nautalchart">
								<FreezeSubTab active={chartTab === 'nautalchart'}>
									<AstroChart value={chartObj.natualChart}
										wheelArt={this.props.wheelArt}
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										height={chartHeight}
									/>
								</FreezeSubTab>
							</TabPane>
							<TabPane tab="对比盘" key="doublechart">
								<FreezeSubTab active={chartTab === 'doublechart'}>
									<AstroDoubleChart value={chartObj}
										height={chartHeight}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartDisplay={this.props.chartDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
								</FreezeSubTab>
							</TabPane>
							{
								secRChart && (
									<TabPane tab="第二返照盘" key="secsinglechart">
										<FreezeSubTab active={chartTab === 'secsinglechart'}>
											<AstroChart value={secRChart}
												wheelArt={this.props.wheelArt}
												chartDisplay={this.props.chartDisplay}
												planetDisplay={this.props.planetDisplay}
												lotsDisplay={this.props.lotsDisplay}
												showAstroMeaning={this.props.showAstroMeaning}
												height={chartHeight}
											/>
										</FreezeSubTab>
									</TabPane>

								)
							}
							{
								secChartObj && (
									<TabPane tab="第二返照对比盘" key="secdoublechart">
										<FreezeSubTab active={chartTab === 'secdoublechart'}>
											<AstroDoubleChart value={secChartObj}
												height={chartHeight}
												planetDisplay={this.props.planetDisplay}
												lotsDisplay={this.props.lotsDisplay}
												chartDisplay={this.props.chartDisplay}
												showAstroMeaning={this.props.showAstroMeaning}
											/>
										</FreezeSubTab>
									</TabPane>
								)
							}
						</Tabs>
						</div>
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<AstroDirectionForm {...fields}
										fieldsAry={fieldsary}
										geo={true}
										ignoreNodeRetrograde={true}
										onFieldsChange={this.fieldsChanged}
										onSubmit={this.submit}
									/>
								</Col>
							</Row>
							<Row style={{marginTop: 50}}>
								<Col span={24}>
									<Select value={this.state.inverse} onChange={this.changeDblChartType} style={{width: "100%"}}>
										<Option value={true}>返照盘在内盘</Option>
										<Option value={false}>原命盘在内盘</Option>
									</Select>
								</Col>
							</Row>
							<Divider orientation="left">相位</Divider>
							{aspdom}
						</div>
					</Col>
				</Row>
			</div>
		)
	}
}

export default AstroLunarReturn;
