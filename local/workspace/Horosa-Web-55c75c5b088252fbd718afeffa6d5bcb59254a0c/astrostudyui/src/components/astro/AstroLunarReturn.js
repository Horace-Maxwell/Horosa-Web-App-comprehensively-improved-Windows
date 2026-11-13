import React, { Component } from 'react';
import { Row, Col} from 'antd';
import { XQSelect as Select } from '../xq-ui';
import AstroChart from './AstroChart';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import { pointName } from '../../utils/directedFigures';
import { SideColumn, SidePanelHead, AspectTable, WheelSplit, FillCard } from './progPageLayout';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { convertToArray} from '../../utils/helper';
import DateTime from '../comp/DateTime';
import { returnPickerSeed } from '../../utils/returnPickerSeed';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPredictiveSnapshotText, } from '../../utils/predictiveAiSnapshot';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import UpdatingBadge from '../common/UpdatingBadge';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { natalClassicalParams, transitOrbDefault, followTransitOrb } from './AstroExtraCommon';
import { pruneStaleClassicalParams } from '../../utils/classicalChartGlobals';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { markPanelReady } from '../../utils/perfMark';

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
		this.changeDblChartType = this.changeDblChartType.bind(this);
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
				nodeRetrograde: false,   // 本页不显示「南北交逆移」控件(后端也不吃这个键):恒出厂值,不读星运族共用的保存值 —— 否则页面导出的快照会印出一个看不见也改不了的「是」
				asporb: transitOrbDefault(),
				// 首次请求就带本命盘的古典口径与容许度(与 genNatalParams 同源);不带的话第一张推运盘按出厂口径算,换一次盘才对上
				...natalClassicalParams(qryparam),
			},
			dirChart: null,
			inverse: DIRECTION_PAGE_SETTINGS.load().lunarReturnInverse,   // 上次亲手选的双盘内外圈
			secDirChart: null,
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
				// 增量 merge 粘滞剔除:非默认改回默认后 param 不带键,旧值不得残留(见 classicalChartGlobals)。
				let params = pruneStaleClassicalParams({
					...this.state.params,
					...param,
				}, param);
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
		// 「今年 / 此刻」按本盘时区(DateTime.nowForChart);东八区盘逐位不变
		let datetime = DateTime.nowForChart(qryparam.zone);
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
			datetime = returnPickerSeed(qryparam.birth, DateTime.nowForChart(qryparam.zone));   // 今年 + 出生月日时分(民用历日期串单源解析)
		}
		// 选择器起始时刻按本命时区计(DateTime 缺省 +08:00),否则非东八区盘的返照/流年盘时区串成东八区。
		if(qryparam.zone){ datetime.setZone(qryparam.zone); }
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
			// 古典口径段(单源):此前只带 4-6 基础键,改界系/三分/宫头5°律后与主盘口径静默分叉。
			...natalClassicalParams(qryparam),
		};
		return params;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		// 先取时区再格式化:此前格式化成字符串后再取 .zone 得 undefined → 首算按本命时区、步进后又按选择器缺省 +08:00 → 非东八区本命盘跳变。
		const _dtv = params.datetime;
		params.dirZone = (_dtv && _dtv.zone) ? _dtv.zone : undefined;
		params.datetime = _dtv.format('YYYY-MM-DD HH:mm');
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	async requestDirection(params){
		// 乱序/混代防(B 断面):双在途旧响应后回=盘面与快照回滚;快照 chartValue
		// 此前取回调时刻 props=与响应混代——请求时捕获,与 params/result 同代(响应内产范式)。
		const seq = ++this._reqSeq || (this._reqSeq = 1);
		const dirChartSig = natalSourceKey(params);   // 本次结果出自哪位命主(读时与当前盘比,见 shownDirChart)
		const chartValueAtRequest = this.props.value;
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
			if(this.unmounted || seq !== this._reqSeq){ return; }
			this.setState({ updating: false });
			return;
		}
		if(this.unmounted || seq !== this._reqSeq){ return; }
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
			dirChartSig,
			updating: false,
			params: {
				...params,
				datetime: dt,
			},
		};
		if(result.secLuneReturn){
			st.secDirChart = result.secLuneReturn;
			st.secDirChartSig = dirChartSig;
		}else{
			st.secDirChart = null;
		}

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:推运盘数据落定(中栏盘 + 右栏相位同源于 st.dirChart)的唯一提交点。
			markPanelReady('direction');
			const chartValue = chartValueAtRequest;
			saveModuleAISnapshotLazy('lunarreturn', ()=>buildPredictiveSnapshotText(chartValue, st.params, result, 'lunarreturn'), this.snapshotMeta());
		});
	}

	submit(values){
		let params = {
			...this.state.params
		};
		params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss');
		params.dirLat = values.lat;
		params.dirLon = values.lon;
		// 表单无 zone 项:「提交」沿用 state 里上一次响应写回的旧时区,改时区后自动请求在途时点提交
		// → 序号守卫只认后发请求,旧时区胜出、盘面与下拉一起回退。改为与自动请求同源:取所选日期时间自带的时区。
		const dtZone = values.datetime && (values.datetime.zone || (values.datetime.time && values.datetime.time.zone));
		if(values.zone || dtZone){
			params.dirZone = values.zone || dtZone;
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

	changeDblChartType(value){
		DIRECTION_PAGE_SETTINGS.save({ lunarReturnInverse: value });
		this.setState({
			inverse: value,
		});
	}

	componentDidMount(){
		this.unmounted = false;
		this._detachTransitOrb = followTransitOrb(this);
		this.requestData();
		// 实时刷新:AI 导出/分析前广播 horosa:refresh-module-snapshot 时,用「当前显示盘」同步重建快照,
		// 避免 reload/缓存为空时导出报「当前页面没有可导出文本」。
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._detachTransitOrb){ this._detachTransitOrb(); }
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 写槽 meta 单一来源:平时写槽与刷新应答共用(刷新一次后槽的 meta 不变)
	snapshotMeta(){
		return { module: 'lunarreturn' };
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'lunarreturn'){
			return;
		}
		const result = this.shownDirChart();
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
			saveModuleAISnapshot('lunarreturn', text, this.snapshotMeta());   // 刷新应答与平时写槽同一份 meta
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	// 派生盘只与它出自的那张命盘配对:换盘后新盘在途、或新盘取盘失败时,state 里仍是上一位命主的结果 → 当没有
	shownDirChart(){
		return pickKeyedDerived(this.state.dirChart, this.state.dirChartSig, natalSourceKey(this.props.value));
	}

	shownSecDirChart(){
		return pickKeyedDerived(this.state.secDirChart, this.state.secDirChartSig, natalSourceKey(this.props.value));
	}

	render(){
		let chartObj = {
			natualChart: this.props.value,
			dirChart: this.shownDirChart(),
			inverse: this.state.inverse,
		};

		let rChart = null;
		if(this.shownDirChart() && this.shownDirChart().dirChart){
			rChart = this.shownDirChart().dirChart;
		}

		let secChartObj = null;
		let secRChart = null;
		if(this.shownSecDirChart() && this.shownSecDirChart().dirChart){
			secChartObj = {
				natualChart: this.props.value,
				dirChart: this.shownSecDirChart(),
				inverse: this.state.inverse,	
			}
			secRChart = this.shownSecDirChart().dirChart;
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


		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};
		let chartHeight = height - 50;
		const chartView = this.state.chartView || 'singlechart';

		return (
			<div>
				{/* 盘大小与右栏宽度与星运其它带盘页同一套算法(progPageLayout.WheelSplit) */}
				<WheelSplit style={{ height: height - 10 }} renderWheel={(wheelSize, wheelH)=>(
					<div style={{ width: wheelSize, height: wheelH }}>
							{/* keep-stale 角标:重取期间旧返照盘留在盘面,右上角提示「更新中…」;首次加载(无旧盘)不显示 */}
							<div style={{ position: 'relative' }}>
							{this.state.updating && this.shownDirChart() ? <UpdatingBadge /> : null}
							{/* 各盘由右栏「显示」切换,只画选中的那张,盘按满高(此前盘下一排页签把盘压矮) */}
							{chartView === 'singlechart' ? (
								<AstroChart value={rChart} 
								wheelArt={this.props.wheelArt}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								height={wheelH}
								/>
							) : chartView === 'nautalchart' ? (
								<AstroChart value={chartObj.natualChart} 
								wheelArt={this.props.wheelArt}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								height={wheelH}
								/>
							) : chartView === 'doublechart' ? (
								<AstroDoubleChart value={chartObj} 
								height={wheelH}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								/>
							) : chartView === 'secsinglechart' && secRChart ? (
								<AstroChart value={secRChart} 
								wheelArt={this.props.wheelArt}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								height={wheelH}
								/>
							) : chartView === 'secdoublechart' && secChartObj ? (
								<AstroDoubleChart value={secChartObj}
								height={wheelH}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								/>
							) : null}
							</div>
					</div>
				)} side={(
					<React.Fragment>
							{/* 右栏与星运其它带盘页同一个件:固定头(时间与设置,不随滚动)+ 下半整体滚动;顶部留安全距离 */}
							<SideColumn style={{ height: '100%' }} head={(
								<div>
									<SidePanelHead title="月亮返照" desc="月亮回到本命黄经的时刻起盘,每月一盘;地点可改为当时所在地。" />
									<Row>
										<Col span={24}>
											<AstroDirectionForm {...fields}
											settingsTitle="返照设置"
											geoLabel="返照地点"
												fieldsAry={fieldsary}
												geo={true}
												ignoreNodeRetrograde={true}
												extraControls={(
												<React.Fragment>
												<Col span={12}>
													<div className="horosa-balbillus-label">显示</div>
													<Select value={chartView} onChange={(v)=>this.setState({ chartView: v })} style={{ width: '100%' }}>
														<Option value="singlechart">返照盘</Option>
														<Option value="nautalchart">原命盘</Option>
														<Option value="doublechart">对比盘</Option>
														{secRChart ? <Option value="secsinglechart">第二返照盘</Option> : null}
														{secChartObj ? <Option value="secdoublechart">第二返照对比盘</Option> : null}
													</Select>
												</Col>
												<Col span={12} title={['doublechart', 'secdoublechart'].indexOf(this.state.chartView || 'singlechart') >= 0 ? undefined : '只在「对比盘」「第二返照对比盘」视图里生效'}>
														<div className="horosa-balbillus-label">内外盘</div>
														{/* 内外圈只在对比盘(双圈)里画得出来;单盘视图下置灰,免得拨了没反应 */}
														<Select value={this.state.inverse} onChange={this.changeDblChartType} disabled={['doublechart', 'secdoublechart'].indexOf(this.state.chartView || 'singlechart') < 0} style={{width: "100%"}}>
															<Option value={true}>返照盘在内盘</Option>
															<Option value={false}>原命盘在内盘</Option>
														</Select>
													</Col>
												</React.Fragment>
											)}
												onFieldsChange={this.fieldsChanged}
												onSubmit={this.submit}
											/>
										</Col>
									</Row>
								</div>
							)}>
								<FillCard grow title="相位">
									<AspectTable chart={this.shownDirChart()} moverTitle="返照星" renderPoint={(id, side)=>(<span style={{ whiteSpace: 'nowrap' }}>{this.renderPlanetLabel(side === 'dir' ? this.shownDirChart() : this.props.value, id)} {pointName(id)}</span>)} />
								</FillCard>
							</SideColumn>
					</React.Fragment>
				)} />
			</div>
		)
	}
}

export default AstroLunarReturn;
