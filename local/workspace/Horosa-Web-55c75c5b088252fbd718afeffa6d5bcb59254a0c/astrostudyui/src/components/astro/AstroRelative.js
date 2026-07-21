import React, { Component } from 'react';
import { Row, Col, } from 'antd';
import { XQButton as Button, XQSearch as Search, XQTabs as Tabs } from '../xq-ui';
import ChartSearchModal from './ChartSearchModal'
import AstroCompare from '../relative/AstroCompare'
import AstroComposite from '../relative/AstroComposite'
import AstroSynastry from '../relative/AstroSynastry'
import AstroTimeSpace from '../relative/AstroTimeSpace'
import AstroMarks from '../relative/AstroMarks'
import AstroRelativeScore from '../relative/AstroRelativeScore'
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroText from '../../constants/AstroText';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';

const TabPane = Tabs.TabPane;

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function aspectText(asp){
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp || ''}`;
	}
	return `${n}˚`;
}

function relationNameByKey(key){
	if(key === 'Comp'){
		return '比较盘';
	}
	if(key === 'Composite'){
		return '组合盘';
	}
	if(key === 'Synastry'){
		return '影响盘';
	}
	if(key === 'TimeSpace'){
		return '时空中点盘';
	}
	if(key === 'Marks'){
		return '马克斯盘';
	}
	return key || '合盘';
}

function pushAspectArray(lines, title, list){
	if(!list || list.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 星B | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	list.forEach((obj)=>{
		const objId = obj.id !== undefined ? obj.id : obj.directId;
		const objs = obj.objects || [];
		if(objs.length === 0){
			lines.push(`| ${msg(objId)} | 无 | — | — |`);
			return;
		}
		objs.forEach((natalObj, k)=>{
			const natalId = natalObj.id !== undefined ? natalObj.id : natalObj.natalId;
			lines.push(`| ${k === 0 ? msg(objId) : '—'} | ${msg(natalId)} | ${aspectText(natalObj.aspect)} | ${round3(natalObj.delta)} |`);
		});
	});
}

function pushMidpointMap(lines, title, mapObj){
	if(!mapObj){
		return;
	}
	const keys = Object.keys(mapObj);
	if(keys.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 中点 | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	keys.forEach((key)=>{
		const arr = mapObj[key] || [];
		if(arr.length === 0){
			lines.push(`| ${msg(key)} | 无 | — | — |`);
			return;
		}
		arr.forEach((asp, k)=>{
			const midpoint = asp.midpoint || {};
			lines.push(`| ${k === 0 ? msg(key) : '—'} | ${msg(midpoint.idA)}·${msg(midpoint.idB)} | ${aspectText(asp.aspect)} | ${round3(asp.delta)} |`);
		});
	});
}

function pushAntisciaArray(lines, title, arr, typeLabel){
	if(!arr || arr.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 星B | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	arr.forEach((item)=>{
		lines.push(`| ${msg(item.idA)} | ${msg(item.idB)} | ${typeLabel} | ${round3(item.delta)} |`);
	});
}

export function buildRelativeSnapshotText(comp){
	const lines = [];
	const relationName = relationNameByKey(comp.currentTab);
	const res = comp.result || {};

	lines.push('[关系起盘信息]');
	lines.push(`盘型：${relationName}`);
	if(comp.chartA && comp.chartA.record){
		lines.push(`星盘A：${comp.chartA.record.name} ${comp.chartA.record.birth}`);
		lines.push(`星盘A经纬度：${comp.chartA.record.lon} ${comp.chartA.record.lat}`);
	}
	if(comp.chartB && comp.chartB.record){
		lines.push(`星盘B：${comp.chartB.record.name} ${comp.chartB.record.birth}`);
		lines.push(`星盘B经纬度：${comp.chartB.record.lon} ${comp.chartB.record.lat}`);
	}
	if(comp.params){
		lines.push(`宫制：${comp.params.hsys}`);
		lines.push(`黄道：${comp.params.zodiacal}`);
	}

	if(comp.currentTab === 'Comp'){
		pushAspectArray(lines, 'A对B相位', res.inToOutAsp);
		pushAspectArray(lines, 'B对A相位', res.outToInAsp);
		pushMidpointMap(lines, 'A对B中点相位', res.inToOutMidpoint);
		pushMidpointMap(lines, 'B对A中点相位', res.outToInMidpoint);
		pushAntisciaArray(lines, 'A对B映点', res.inToOutAnti, '映点');
		pushAntisciaArray(lines, 'A对B反映点', res.inToOutCAnti, '反映点');
		pushAntisciaArray(lines, 'B对A映点', res.outToInAnti, '映点');
		pushAntisciaArray(lines, 'B对A反映点', res.outToInCAnti, '反映点');
	}

	// [YD] 段名按盘型拆分:时空中点盘/马克斯盘此前与组合盘/影响盘共用段名 → 设置面永远无法
	// 分开勾选、导出文本不辨盘型。组合盘/影响盘保持原段名(老用户勾选/旧快照零影响),
	// 时空/马克斯用独立段名(纯增,已登 preset)。
	if((comp.currentTab === 'Composite' || comp.currentTab === 'TimeSpace') && res.chart){
		lines.push('');
		lines.push(comp.currentTab === 'TimeSpace' ? '[时空中点·合成图盘]' : '[合成图盘]');
		lines.push(buildAstroSnapshotContent(res, null, { headerless: true }));
	}

	if((comp.currentTab === 'Synastry' || comp.currentTab === 'Marks') && (res.inner || res.outer)){
		const marks = comp.currentTab === 'Marks';
		if(res.inner && res.inner.chart){
			lines.push('');
			lines.push(marks ? '[马克斯·影响图盘-星盘A]' : '[影响图盘-星盘A]');
			lines.push(buildAstroSnapshotContent(res.inner, null, { headerless: true }));
		}
		if(res.outer && res.outer.chart){
			lines.push('');
			lines.push(marks ? '[马克斯·影响图盘-星盘B]' : '[影响图盘-星盘B]');
			lines.push(buildAstroSnapshotContent(res.outer, null, { headerless: true }));
		}
	}

	if(comp.currentTab === 'Score'){
		lines.push('');
		lines.push('[关系量化]');
		lines.push(`契合分数：${res.score !== undefined && res.score !== null ? res.score : '-'}（0–100，50 为中性；越高越顺畅，越低张力越大）`);
		const pushScoreAsps = (title, list)=>{
			const arr = (list || []).slice(0, 12);
			if(arr.length === 0){
				return;
			}
			lines.push('');
			lines.push(`[${title}]`);
			lines.push('| 星A | 星B | 相位 | 权重 | 误差 |');
			lines.push('| --- | --- | --- | --- | --- |');
			arr.forEach((it)=>{
				lines.push(`| ${msg(it.a)} | ${msg(it.b)} | ${aspectText(it.aspect)} | ${round3(it.impact)} | ${round3(it.orb)} |`);
			});
		};
		pushScoreAsps('顺畅连接', res.highlights);
		pushScoreAsps('张力连接', res.challenges);
	}
	return lines.join('\n');
}

class AstroRelative extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: 'Comp',
			currentRelative: 0,
			chartA: null,
			chartB: null,
			hook: {
				Comp:{
					txt:'比较盘',
					relative: 0,
					result: null,
					fun: null
				},
				Composite:{
					txt:'组合盘',
					relative: 1,
					result: null,
					fun: null
				},
				Synastry:{
					txt:'影响盘',
					relative: 2,
					result: null,
					fun: null
				},
				TimeSpace:{
					txt:'时空中点盘',
					relative: 3,
					result: null,
					fun: null
				},
					Marks:{
						txt:'马克斯盘',
						relative: 4,
						result: null,
						fun: null
					},
					Score:{
						txt:'关系量化',
						relative: 0,
						result: null,
						fun: null
					},

			},
		}

		this.changeTab = this.changeTab.bind(this);
		this.selectChartA = this.selectChartA.bind(this);
		this.selectChartB = this.selectChartB.bind(this);
		this.clickDoChart = this.clickDoChart.bind(this);
		this.doChart = this.doChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.saveRelativeSnapshot = this.saveRelativeSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleRelativeOnChange = this.handleRelativeOnChange.bind(this);
		// 子盘高度动态测量:props.height 来自 models/astro.js 硬编码 660 从不随窗口尺寸变,
		// 导致大屏下「比较/组合/影响/时空中点/马克斯」5 子盘底部出现大块空白(原 fallback 760 同病)。
		// ResizeObserver 测真实 chart-row 容器高度,优先用测量值,既向后兼容(无值时仍用 props/旧 fallback)
		// 又自适应明暗主题/窗口缩放/侧栏开合。
		this.chartRowRef = React.createRef();
		this.measuredHeight = null;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let res = hook[this.state.currentTab].result;
					hook[this.state.currentTab].fun(res);
				}
			};
		}

	}

	componentDidMount(){
		this._mounted = true;
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 测真实 chart-row 容器高度并随窗口/侧栏变化自适应。
		if(typeof window !== 'undefined' && typeof window.ResizeObserver === 'function' && this.chartRowRef && this.chartRowRef.current){
			const el = this.chartRowRef.current;
			const measure = ()=>{
				try{
					const h = el.getBoundingClientRect().height;
					if(h > 0 && Math.abs((this.measuredHeight || 0) - h) > 2){
						this.measuredHeight = h;
						this.forceUpdate();
					}
				}catch(e){}
			};
			measure();
			this.chartRowObserver = new window.ResizeObserver(measure);
			this.chartRowObserver.observe(el);
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(this.chartRowObserver){
			try{ this.chartRowObserver.disconnect(); }catch(e){}
			this.chartRowObserver = null;
		}
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 子盘左栏「黄道/分宫制/恒星 ayanāṃśa」onChange:不能复用 changeCond(会先去 fetchByFields 拉一次本命盘,
	// 而本命盘 fields 与当前合盘用户视图无关→返回非 200 时静默不更新,fields 永远不变,中央盘没反应——本轮真因)。
	// 此处直接 astro/save 写入 fields,componentDidUpdate 会感知到字段变化并自动 doChart(),重拉 /modern/relative。
	handleRelativeOnChange(values){
		if(!values || !this.props.dispatch || !this.props.fields){
			return;
		}
		const flds = { ...this.props.fields };
		if(values.hsys !== undefined && values.hsys !== null && flds.hsys){
			flds.hsys = { ...flds.hsys, value: values.hsys };
		}
		if(values.zodiacal !== undefined && values.zodiacal !== null && flds.zodiacal){
			flds.zodiacal = { ...flds.zodiacal, value: values.zodiacal };
		}
		if(values.siderealAyanamsa !== undefined && values.siderealAyanamsa !== null){
			const cur = flds.siderealAyanamsa || { value: '', name: ['siderealAyanamsa'] };
			flds.siderealAyanamsa = { ...cur, value: values.siderealAyanamsa };
		}
		this.props.dispatch({
			type: 'astro/save',
			payload: { fields: flds },
		});
	}

	componentDidUpdate(prevProps, prevState){
		if(
			prevState.currentTab !== this.state.currentTab
			|| prevState.currentRelative !== this.state.currentRelative
			|| prevState.chartA !== this.state.chartA
			|| prevState.chartB !== this.state.chartB
			|| prevState.hook !== this.state.hook
		){
			this.saveRelativeSnapshot();
		}
		// 用户在子盘左栏改「黄道/分宫制/恒星 ayanāṃśa」→ models/astro.js fields 全局更新 → 经 props 流到本组件。
		// 但 doChart() 已绑定旧 fields,需在此 watch 并自动重新拉合盘,否则中央盘不会随选择变(用户反馈「点了没反应」真因之二)。
		const prevF = (prevProps && prevProps.fields) || {};
		const curF = (this.props && this.props.fields) || {};
		const fieldChanged = (
			(prevF.zodiacal && curF.zodiacal && prevF.zodiacal.value !== curF.zodiacal.value)
			|| (prevF.hsys && curF.hsys && prevF.hsys.value !== curF.hsys.value)
			|| ((prevF.siderealAyanamsa && curF.siderealAyanamsa && prevF.siderealAyanamsa.value !== curF.siderealAyanamsa.value))
		);
		if(fieldChanged && this.state.chartA && this.state.chartB){
			this.doChart();
		}
	}

	saveRelativeSnapshot(){
		try{
			const currentHook = this.state.hook && this.state.hook[this.state.currentTab]
				? this.state.hook[this.state.currentTab]
				: null;
			const result = currentHook ? currentHook.result : null;
			if(!result){
				return '';
			}
			const params = this.genParams() || {};
			const snapshotText = buildRelativeSnapshotText({
				currentTab: this.state.currentTab,
				currentRelative: this.state.currentRelative,
				chartA: this.state.chartA,
				chartB: this.state.chartB,
				params,
				result,
			});
			if(!snapshotText){
				return '';
			}
			saveModuleAISnapshot('relative', snapshotText, {
				relation: this.state.currentTab,
				chartA: this.state.chartA && this.state.chartA.record ? this.state.chartA.record.name : null,
				chartB: this.state.chartB && this.state.chartB.record ? this.state.chartB.record.name : null,
			});
			return snapshotText;
		}catch(e){
			return '';
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'relative'){
			return;
		}
		const snapshotText = this.saveRelativeSnapshot();
		if(snapshotText && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	genParams(){
		if(this.state.chartA === null || this.state.chartB === null){
			return null;
		}
		let recA = this.state.chartA.record;
		let recB = this.state.chartB.record;
		let birthA = recA.birth.split(' ');
		let birthB = recB.birth.split(' ');

		let params = {
			inner: {
				date: birthA[0],
				time: birthA[1],
				zone: recA.zone,
				lat: recA.lat,
				lon: recA.lon
			},
			outer: {
				date: birthB[0],
				time: birthB[1],
				zone: recB.zone,
				lat: recB.lat,
				lon: recB.lon
			},
			hsys: 0,
			zodiacal: 0,
			siderealAyanamsa: '',
			relative: this.state.currentRelative
		}

		if(this.props.fields){
			params.hsys = this.props.fields.hsys.value;
			params.zodiacal = this.props.fields.zodiacal.value;
			params.siderealAyanamsa = this.props.fields.siderealAyanamsa ? this.props.fields.siderealAyanamsa.value : '';
		}

		return params;
	}

	async doChart(){
		if(this.state.chartA === null || this.state.chartB === null){
			return;
		}

		const params = this.genParams();
		if(params === null){
			return;
		}

		// 合盘(含时空中点盘) 必须走主排盘后端 :9999(Constants.ServerRoot)：request() 会对 body 做 RSA 加密，
		// 仅 Java 后端有解密拦截器并回标准 {result} 信封；chart 服务 :8899(Python) 既不解密(收到密文→json_in 400→无 CORS→net::ERR_FAILED)
		// 也不回 {result} 信封。v2.6.1(fc7ab74) 误把此处改成 resolveKentangServiceRoot('taiyi')(→:8899) 导致「合盘每个技法都用不了」，此处恢复 :9999。
		// 后端未就绪/请求失败时 request 可能抛错或返回 undefined → 必须优雅吞掉，否则 `data[ResultKey]` 抛错让整个合盘组件崩成空白、横幅自动重试也救不回。
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		let data = null;
		try{
			data = await request(`${Constants.ServerRoot}/modern/relative`, {
				body: JSON.stringify(params),
				silent: silentTechniquePanelsEnabled(),
			});
		}catch(e){
			data = null;
		}
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null){
			// 服务未就绪 → 保持上次状态、等横幅自动重试再 doChart，不崩;只收角标
			if(this._mounted){
				this.setState({ updating: false });
			}
			return;
		}

		const res = data[Constants.ResultKey];

		let hook = this.state.hook;
		hook[this.state.currentTab].result = res;
		const st = {
			hook: hook,
			updating: false,
		};

		if(!this._mounted) return;
		this.setState(st, ()=>{
			let hook = this.state.hook[this.state.currentTab];
			if(hook && hook.fun){
				hook.fun(res);
			}
			this.saveRelativeSnapshot();
		});

	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
			currentRelative: hook[key].relative
		}, ()=>{
			if(this.state.chartA !== null && this.state.chartB !== null){
				this.doChart();
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				})
			}
		});

	}

	selectChartA(rec){
		if(this.props.fields){
			rec.hsys = this.props.fields.hsys.value;
			rec.zodiacal = this.props.fields.zodiacal.value;
		}

		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartA: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			this.setState({
				chartA: null
			})
		}
	}

	selectChartB(rec){
		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartB: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			this.setState({
				chartB: null
			})
		}		
	}

	clickDoChart(){
		this.doChart()
	}


	render(){
		// 优先用实测容器高度(随窗口缩放/侧栏开合自适应);未测出时回退 props.height(原行为) 再回退 760。
		// -50 是给上方输入条留出空间,实测高度已是 chart-row 自身,不需要再减。
		let height;
		if(this.measuredHeight && this.measuredHeight > 0){
			height = Math.round(this.measuredHeight);
		}else{
			height = this.props.height ? this.props.height : 760;
			height = height - 50;
		}

		let chartAtxt = this.state.chartA ? this.state.chartA.txt : null;
		let chartBtxt = this.state.chartB ? this.state.chartB.txt : null;

		let hook = this.state.hook;

		return (
			<div className="horosa-relative-page">
				<Row gutter={12}>
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartA}>
							<Search placeholder="星盘A" value={chartAtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartB}>
							<Search placeholder="星盘B" value={chartBtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<Button onClick={this.clickDoChart}>排盘</Button>
					</Col>
				</Row>
				{/* position:relative=角标定位上下文;宿主收敛处统一发请求,故角标只挂盘容器一处、不进各子盘 */}
				<Row className="horosa-relative-chart-row" gutter={12} style={{marginTop: 10, position: 'relative'}} ref={this.chartRowRef}>
					<Col span={24}>
						{this.state.updating && hook[this.state.currentTab] && hook[this.state.currentTab].result ? <UpdatingBadge /> : null}
						<Tabs 
							defaultActiveKey={this.state.currentTab} tabPosition='right'
							onChange={this.changeTab}
							className="horosa-relative-tabs"
							style={{ height: height }}
						>
							<TabPane tab="比较盘" key="Comp">
									<AstroCompare
										value={hook.Comp.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										hook={hook.Comp}	
									/>
							</TabPane>
							<TabPane tab="组合盘" key="Composite">
									<AstroComposite 
										value={hook.Composite.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										hook={hook.Composite}	
									/>
							</TabPane>
							<TabPane tab="影响盘" key="Synastry">
									<AstroSynastry 
										value={hook.Synastry.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										hook={hook.Synastry}	
									/>
							</TabPane>
							<TabPane tab="时空中点盘" key="TimeSpace">
									<AstroTimeSpace 
										value={hook.TimeSpace.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										hook={hook.TimeSpace}	
									/>
							</TabPane>
								<TabPane tab="马克斯盘" key="Marks">
										<AstroMarks 
											value={hook.Marks.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										hook={hook.Marks}	
										/>
								</TabPane>
								<TabPane tab="关系量化" key="Score">
										<AstroRelativeScore
											params={this.genParams()}
											height={height}
											onResult={(r)=>{ hook.Score.result = r; this.saveRelativeSnapshot(); }}
										/>
								</TabPane>

							</Tabs>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroRelative;
