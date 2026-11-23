// 印占星盘取盘与 AI 快照(组件类在这里;模块级实现按职责拆在 indiaChart/ 下,依赖只朝前一层):
//   request(页面字段 → 请求参数、缓存键与请求去重)→ dashaLines(快照分段工具与大运段)→ jyotishLines(快照正文主体)
//   → snapshot(快照组装、口径行、行运段、附加分盘简表与按字段无头起盘)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Component } from 'react';
import AstroChartMain from './AstroChartMain';
import IndiaEastChart from './IndiaEastChart';
import IndiaNorthChart from './IndiaNorthChart';
import IndiaSouthChart from './IndiaSouthChart';
import * as AstroConst from '../../constants/AstroConst';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { fieldsToParams, resolveIndiaFractal, resolveIndiaLabel, buildIndiaChartCacheKey, requestIndiaChartData } from './indiaChart/request';
import { buildIndiaSnapshotText } from './indiaChart/snapshot';
export { fieldsToParams, requestIndiaChartData, buildIndiaWarmParams } from './indiaChart/request';
export { DASHA_ANTAR_ROW_MAX, buildAntardashaTableLines } from './indiaChart/dashaLines';
export { buildJyotishSnapshotLines } from './indiaChart/jyotishLines';
export { indiaCalibreLine, replaceIndiaCalibreLine, indiaPartialErrorLines, buildIndiaSnapshotDataSections, indiaTransitEventParams, indiaTransitSnapshotLines, appendIndiaTransitSection, resolveIndiaHeadlessParams, planIndiaExtraVargas, pickIndiaVargaBriefLines, buildIndiaSnapshotForFields } from './indiaChart/snapshot';

class IndiaChart extends Component{
	constructor(props) {
		super(props);
		this.state = {
			chartObj: null,
		};

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);
		this.getIndiaOptionOverrides = this.getIndiaOptionOverrides.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			// suppressFetch:本实例不自取(数据由父层 chartObj prop 提供,避免单盘模式重复取数+二次渲染)。
			// hook.fun 设为 noop,使父层 hook.fun() 调用不触发本实例 fetch。
			this.props.hook.fun = this.props.suppressFetch ? (()=>{}) : (fields)=>{
				this.requestChartObj(fields);
			};
			// 所见那张盘实际所用的 fields(请求过了代次校验、确定上屏的那一次):择日宿主存案取它 —— 内嵌页自己重排、宿主改了工作台没重排、覆盖层里没确定的草稿,都不会让存案的时间地点与所见不一致
			this.props.hook.getPlottedFields = ()=>this._plottedFields || null;
		}

	}

	getIndiaOptionOverrides(){
		const overrides = {};
		if(this.props.indiaHsys !== undefined && this.props.indiaHsys !== null){
			overrides.indiaHsys = this.props.indiaHsys;
		}
		if(this.props.indiaAyanamsa !== undefined && this.props.indiaAyanamsa !== null){
			overrides.indiaAyanamsa = this.props.indiaAyanamsa;
		}
		if(this.props.indiaNodeType !== undefined && this.props.indiaNodeType !== null){
			overrides.indiaNodeType = this.props.indiaNodeType;
		}
		return overrides;
	}

	async requestChart(params, sourceFields){
		// 请求代次:只认最后一次发出的(挂载即按当时的 fields 取一次,紧接着按另一组 fields 再取 —— 如择日载入存案按冻结口径重排 ——
		// 两个回包谁晚到谁上屏,就可能是前一组的盘)
		const seq = (this._chartReqSeq = (this._chartReqSeq || 0) + 1);
		let result = null;
		try{
			result = await requestIndiaChartData(params);
		}catch(e){
			result = null;
		}

		const st = {
			chartObj: result,
		};

		if(!this._mounted || seq !== this._chartReqSeq) return;
		if(result){ this._plottedFields = sourceFields || null; }
		this.setState(st);
		if(this.props.onChartLoad){
			this.props.onChartLoad(result, params);
		}
		const snapshotFields = sourceFields || this.props.fields;
		this._lastSnapshotChartnum = params ? params.chartnum : null;
		const snapshotText = buildIndiaSnapshotText(result, snapshotFields, params ? params.chartnum : null, this.props.hook);
		if(snapshotText){
			const fractal = resolveIndiaFractal(params ? params.chartnum : null, this.props.hook);
			const label = resolveIndiaLabel(fractal, this.props.hook);
			this.persistSnapshot(snapshotText, fractal, { fractal, label });
		}
	}

	// 快照落槽单一出口。择日内嵌实例(snapshotScope=宿主槽名,如 indiazeri)只写宿主槽,正文 = 印占全文 + 宿主拼的择时三段
	// (composeAiSnapshot,与八字 / 紫微等内嵌宿主同律);此前一律写主印占的三个槽 —— 择日页的盘顶掉印占页的快照,
	// 择日槽却始终空着(导出报「没有可导出文本」)。缺省(主印占页)写三槽,零回归。返回实际落槽的正文。
	persistSnapshot(text, fractal, meta){
		const scope = this.props.snapshotScope;
		if(scope){
			let composed = text;
			if(typeof this.props.composeAiSnapshot === 'function'){
				try{ composed = `${this.props.composeAiSnapshot(text) || text}`; }catch(e){ composed = text; }
			}
			saveModuleAISnapshot(scope, composed, meta);
			return composed;
		}
		saveModuleAISnapshot('indiachart', text, meta);
		saveModuleAISnapshot('indiachart_current', text, meta);
		if(fractal !== null && fractal !== undefined){
			saveModuleAISnapshot(`indiachart_${fractal}`, text, meta);
		}
		return text;
	}

	requestChartObj(fields){
		let params = null;
		try{
			if(fields){
				params = fieldsToParams(fields, this.getIndiaOptionOverrides());
				if(params.chartnum === undefined || params.chartnum === null){
					params.chartnum = 1;
				}
			}else{
				params = this.genParams();
			}
		}catch(e){
			this.setState({
				chartObj: null,
			});
			return;
		}
		this.requestChart(params, fields || this.props.fields);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields, this.getIndiaOptionOverrides());
		if(this.props.chartnum){
			params.chartnum = this.props.chartnum;
		}
		return params;
	}

	onFieldsChange(values){
		if(this.props.onChange){
			this.props.onChange(values);
		}
	}

	componentDidMount(){
		this._mounted = true;
		// [制度化] AI 导出实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填——
		// 不依赖懒存缓存是否在(reload 后未重排时缓存为空,此前缺此监听 → 显示有盘却报
		// 「当前页面没有可导出文本」;与 ZiWeiMain 同款范式)。所有实例都监听:单盘模式显示的是
		// suppressFetch 副本(数据在 props.chartObj),handler 兼容两形态+先到先得幂等防竞写。
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// suppressFetch:不自取,数据走父层 chartObj prop。
		if(this.props.suppressFetch){
			return;
		}
		this.requestChartObj();
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 与排盘完成路径同口径的数据源:result=this.state.chartObj(盘渲染读的同一份),
	// chartnum=最近一次写入用的 _lastSnapshotChartnum。写三键(通用/current/分盘号)与写入点一致。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? `${evt.detail.module || ''}` : '';
		// 择日内嵌实例只应答宿主槽;主印占页的槽不归它答(否则择日页的盘会被当成印占页此刻的盘)
		const scope = this.props.snapshotScope;
		if(scope ? moduleName !== scope : moduleName.indexOf('indiachart') !== 0){
			return;
		}
		// 先到先得幂等:已有实例回填则不再覆盖(多实例并存时任一有数据者胜出,绝不互踩)。
		if(evt && evt.detail && `${evt.detail.snapshotText || ''}`.trim()){
			return;
		}
		// 兼容两形态:自取实例=state.chartObj;suppressFetch 副本=父层 props.chartObj(单盘模式显示的正是副本)。
		const result = (this.state && this.state.chartObj) || this.props.chartObj || null;
		if(!result){
			return;
		}
		let text = '';
		let fractal = null;
		try{
			text = `${buildIndiaSnapshotText(result, this.props.fields, this._lastSnapshotChartnum || null, this.props.hook) || ''}`.trim();
			fractal = resolveIndiaFractal(this._lastSnapshotChartnum || null, this.props.hook);
		}catch(e){
			text = '';
		}
		if(text){
			const saved = this.persistSnapshot(text, fractal, { fractal, label: resolveIndiaLabel(fractal, this.props.hook) });
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = saved;
			}
		}
	}

	componentDidUpdate(prevProps){
		// suppressFetch:不自取,数据走父层 chartObj prop(父层在同一 inflight resolve 时写入)。
		if(this.props.suppressFetch){
			return;
		}
		let prevKey = '';
		let nextKey = '';
		try{
			const prevOverrides = {};
			if(prevProps.indiaHsys !== undefined && prevProps.indiaHsys !== null){
				prevOverrides.indiaHsys = prevProps.indiaHsys;
			}
			if(prevProps.indiaAyanamsa !== undefined && prevProps.indiaAyanamsa !== null){
				prevOverrides.indiaAyanamsa = prevProps.indiaAyanamsa;
			}
			if(prevProps.indiaNodeType !== undefined && prevProps.indiaNodeType !== null){
				prevOverrides.indiaNodeType = prevProps.indiaNodeType;
			}
			const prevParams = fieldsToParams(prevProps.fields, prevOverrides);
			if(prevProps.chartnum){
				prevParams.chartnum = prevProps.chartnum;
			}
			prevKey = buildIndiaChartCacheKey(prevParams);
			nextKey = buildIndiaChartCacheKey(this.genParams());
		}catch(e){
			return;
		}
		if(prevKey !== nextKey){
			this.requestChartObj();
		}
	}

	render(){
		let fields = this.props.fields;
		// suppressFetch:渲染用父层提供的 chartObj(本实例不自取);为 null/falsy 时下游渲染器显占位/载入态。
		let chartObj = this.props.suppressFetch ? this.props.chartObj : this.state.chartObj;
		let height = this.props.height ? this.props.height : 760;
		let fractal = resolveIndiaFractal(this.props.chartnum, this.props.hook);
		let label = resolveIndiaLabel(fractal, this.props.hook);
		let indiaChartStyle = AstroConst.normalizeIndiaChartStyle(this.props.indiaChartStyle);
		const IndiaChartRenderer = indiaChartStyle === AstroConst.INDIA_CHART_STYLE_NORTH
			? IndiaNorthChart
			: (indiaChartStyle === AstroConst.INDIA_CHART_STYLE_EAST ? IndiaEastChart : IndiaSouthChart);

		if(this.props.chartOnly){
			return (
				<div className="horosa-india-chart-instance horosa-india-chart-only">
					<IndiaChartRenderer
						value={chartObj}
						chartnum={fractal}
						label={label}
						height={height}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						degreeDisplayMode={this.props.degreeDisplayMode}
						aspectSourceId={this.props.aspectSourceId}
						aspectParadigm={this.props.aspectParadigm}
						onPlanetClick={this.props.onPlanetClick}
						planetGlyphMode={this.props.planetGlyphMode}
						counterClockwise={this.props.counterClockwise}
						lagnaRef={this.props.lagnaRef}
						overlayPoints={this.props.overlayPoints}
					/>
				</div>
			);
		}

		return (
			<div className="horosa-india-chart-instance">
					<AstroChartMain
						value={chartObj}
					onChange={this.onFieldsChange}
					fields={fields}
					hidezodiacal={1}
					hidehsys={1}
					indiahsys={1}
					height={height}
					chartRenderer={({chartObj: currentChartObj, height: chartHeight})=>(
						<IndiaChartRenderer
							value={currentChartObj}
							chartnum={fractal}
							label={label}
							height={chartHeight}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							degreeDisplayMode={this.props.degreeDisplayMode}
							aspectSourceId={this.props.aspectSourceId}
							aspectParadigm={this.props.aspectParadigm}
							onPlanetClick={this.props.onPlanetClick}
							planetGlyphMode={this.props.planetGlyphMode}
							counterClockwise={this.props.counterClockwise}
							lagnaRef={this.props.lagnaRef}
							overlayPoints={this.props.overlayPoints}
						/>
					)}
						chartDisplay={this.props.chartDisplay}
						indiaChartStyle={indiaChartStyle}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						showPlanetHouseInfo={this.props.showPlanetHouseInfo}
						showAstroMeaning={this.props.showAstroMeaning}
						dispatch={this.props.dispatch}
					/>
			</div>
		);
	}
}

export default IndiaChart;
