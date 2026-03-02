import { Component } from 'react';
import { Tabs, Button } from 'antd';
import AspectInfo from './AspectInfo';
import MidpointInfo from './MidpointInfo';
import AntisciaInfo from './AntisciaInfo';
import AstroInfo from '../astro/AstroInfo';
import AstroAspect from '../astro/AstroAspect';

const TabPane = Tabs.TabPane;

const MODE_TEXT = {
	Comp: '比较盘',
	Composite: '组合盘',
	Synastry: '影响盘',
	TimeSpace: '时空中点盘',
	Marks: '马克斯盘',
};

function safeList(val){
	return Array.isArray(val) ? val : [];
}

function safeMap(val){
	return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
}

function buildFallbackUnified(result, modeKey){
	const res = result || {};
	const mode = modeKey || (res.relativeMeta ? res.relativeMeta.mode : null) || 'Comp';
	return {
		mode: mode,
		modeText: MODE_TEXT[mode] || mode,
		charts: {
			inner: res.inner || null,
			outer: res.outer || null,
			composite: (mode === 'Composite' || mode === 'TimeSpace') ? res : null,
		},
		analysis: {
			aspects: {
				inToOut: safeList(res.inToOutAsp),
				outToIn: safeList(res.outToInAsp),
			},
			midpoints: {
				inToOut: safeMap(res.inToOutMidpoint),
				outToIn: safeMap(res.outToInMidpoint),
			},
			antiscia: {
				inToOut: safeList(res.inToOutAnti),
				outToIn: safeList(res.outToInAnti),
			},
			contraAntiscia: {
				inToOut: safeList(res.inToOutCAnti),
				outToIn: safeList(res.outToInCAnti),
			},
		},
	};
}

function getUnified(result, modeKey){
	if(result && result.relativeUnified){
		const obj = result.relativeUnified;
		if(obj && obj.charts && obj.analysis){
			return obj;
		}
	}
	return buildFallbackUnified(result, modeKey);
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	return 900;
}

class RelativeFloatingPanel extends Component{
	renderCompareBody(unified, panelHeight){
		const result = this.props.result || {};
		const chartAName = this.props.chartA && this.props.chartA.record ? this.props.chartA.record.name : '星盘A';
		const chartBName = this.props.chartB && this.props.chartB.record ? this.props.chartB.record.name : '星盘B';
		const inToOutAsp = safeList(unified.analysis.aspects.inToOut);
		const outToInAsp = safeList(unified.analysis.aspects.outToIn);
		const inToOutMid = safeMap(unified.analysis.midpoints.inToOut);
		const outToInMid = safeMap(unified.analysis.midpoints.outToIn);
		const inToOutAnti = safeList(unified.analysis.antiscia.inToOut);
		const outToInAnti = safeList(unified.analysis.antiscia.outToIn);
		const inToOutCAnti = safeList(unified.analysis.contraAntiscia.inToOut);
		const outToInCAnti = safeList(unified.analysis.contraAntiscia.outToIn);

		return (
			<Tabs defaultActiveKey="aspects" size="small">
				<TabPane tab="相位" key="aspects">
					<Tabs defaultActiveKey="a2b" size="small">
						<TabPane tab="A→B" key="a2b">
							<AspectInfo
								value={{ aspects: inToOutAsp }}
								chartSources={result}
								title={chartAName}
								innerTitle={chartBName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
						<TabPane tab="B→A" key="b2a">
							<AspectInfo
								value={{ aspects: outToInAsp }}
								chartSources={result}
								title={chartBName}
								innerTitle={chartAName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
					</Tabs>
				</TabPane>
				<TabPane tab="中点" key="midpoints">
					<Tabs defaultActiveKey="a2b" size="small">
						<TabPane tab="A→B" key="a2b">
							<MidpointInfo
								value={inToOutMid}
								chartSources={result}
								title={chartAName}
								innerTitle={chartBName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
						<TabPane tab="B→A" key="b2a">
							<MidpointInfo
								value={outToInMid}
								chartSources={result}
								title={chartBName}
								innerTitle={chartAName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
					</Tabs>
				</TabPane>
				<TabPane tab="映点" key="antiscia">
					<Tabs defaultActiveKey="a2b" size="small">
						<TabPane tab="A→B" key="a2b">
							<AntisciaInfo
								value={{
									antiscias: inToOutAnti,
									cantiscias: inToOutCAnti,
								}}
								chartSources={result}
								title={chartAName}
								innerTitle={chartBName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
						<TabPane tab="B→A" key="b2a">
							<AntisciaInfo
								value={{
									antiscias: outToInAnti,
									cantiscias: outToInCAnti,
								}}
								chartSources={result}
								title={chartBName}
								innerTitle={chartAName}
								height={panelHeight}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
							/>
						</TabPane>
					</Tabs>
				</TabPane>
			</Tabs>
		);
	}

	renderSingleChartBody(chartObj, panelHeight){
		if(!chartObj){
			return <div style={{ padding: 12 }}>暂无数据，请先排盘。</div>;
		}
		return (
			<Tabs defaultActiveKey="info" size="small">
				<TabPane tab="信息" key="info">
					<AstroInfo
						value={chartObj}
						fields={this.props.fields}
						height={panelHeight}
						planetDisplay={this.props.planetDisplay}
					/>
				</TabPane>
				<TabPane tab="相位" key="asp">
					<AstroAspect
						value={chartObj}
						height={panelHeight}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
					/>
				</TabPane>
			</Tabs>
		);
	}

	renderDualChartBody(unified, panelHeight){
		const chartAName = this.props.chartA && this.props.chartA.record ? this.props.chartA.record.name : '星盘A';
		const chartBName = this.props.chartB && this.props.chartB.record ? this.props.chartB.record.name : '星盘B';
		return (
			<Tabs defaultActiveKey="chartA" size="small">
				<TabPane tab={chartAName} key="chartA">
					{this.renderSingleChartBody(unified.charts.inner, panelHeight)}
				</TabPane>
				<TabPane tab={chartBName} key="chartB">
					{this.renderSingleChartBody(unified.charts.outer, panelHeight)}
				</TabPane>
			</Tabs>
		);
	}

	renderBody(unified, panelHeight){
		if(unified.mode === 'Comp'){
			return this.renderCompareBody(unified, panelHeight);
		}
		if(unified.mode === 'Composite' || unified.mode === 'TimeSpace'){
			return this.renderSingleChartBody(unified.charts.composite, panelHeight);
		}
		if(unified.mode === 'Synastry' || unified.mode === 'Marks'){
			return this.renderDualChartBody(unified, panelHeight);
		}
		return <div style={{ padding: 12 }}>暂无可显示内容。</div>;
	}

	render(){
		if(!this.props.visible){
			return null;
		}

		const unified = getUnified(this.props.result, this.props.modeKey);
		const modeText = unified.modeText || MODE_TEXT[unified.mode] || '关系盘';
		const collapsed = !!this.props.collapsed;
		const viewportH = getViewportHeight();
		const bodyHeight = Math.max(320, Math.min(700, viewportH - 210));

		const wrapStyle = {
			position: 'fixed',
			right: 16,
			bottom: 16,
			width: 480,
			maxWidth: 'calc(100vw - 24px)',
			zIndex: 1060,
			background: '#ffffff',
			border: '1px solid #d9d9d9',
			borderRadius: 6,
			boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
		};

		const headStyle = {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '8px 10px',
			borderBottom: collapsed ? 'none' : '1px solid #f0f0f0',
			background: '#fafafa',
			borderTopLeftRadius: 6,
			borderTopRightRadius: 6,
		};

		const bodyStyle = {
			padding: 10,
			maxHeight: bodyHeight,
			overflow: 'hidden',
		};

		return (
			<div style={wrapStyle}>
				<div style={headStyle}>
					<div style={{ fontWeight: 600 }}>关系浮窗 - {modeText}</div>
					<div>
						<Button size="small" onClick={this.props.onToggleCollapse}>
							{collapsed ? '展开' : '收起'}
						</Button>
					</div>
				</div>
				{
					!collapsed && (
						<div style={bodyStyle}>
							{this.renderBody(unified, bodyHeight)}
						</div>
					)
				}
			</div>
		);
	}
}

export default RelativeFloatingPanel;
