import { Component } from 'react';
import { Spin, Select } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, cardStyle, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import ProgMethodPanel, { MINOR_VARIANT_OPTIONS } from './AstroProgChart';

const TabPane = Tabs.TabPane;
const { Option } = Select;

function today(){
	const dt = new Date();
	return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`;
}

function methodTab(method){
	return method.method === 'secondary' ? '二次推运' : (method.method === 'tertiary' ? '三次推运' : '小推运');
}

// 推运（回归黄道）：二次/三次/小推运。每个子 tab → 左固定推运双盘 + 右可滚动行星位置/相位表（ProgMethodPanel）。
// 小推运月长算法用顶栏「月长算法」选择器（minorVariant），默认 engine=现状。
class AstroProgressions extends Component{
	constructor(props){
		super(props);
		this.state = {
			targetDate: today(),
			targetTime: '12:00:00',
			minorVariant: 'engine',
			loading: false,
			result: null,
			requestKey: '',
		};
		this.load = this.load.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }
	componentWillUnmount(){ this._mounted = false; }

	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ setTimeout(this.load, 0); }
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `progressions|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					targetDate: this.state.targetDate,
					targetTime: this.state.targetTime,
					minorVariant: this.state.minorVariant,
					orb: 1.5,
				}),
				timeoutMs: 45000,
			});
			if(!this._mounted) return;
			clearLoadFailure(this);
			this.setState({ result: unwrapResult(data) || {}, loading: false, requestKey: key });
		}catch(e){
			// 失败不把 key 记成已完成(改日期失败=永远没反应);泊车该 key,窗口期后自动重试。
			parkLoadFailure(this, key);
			if(!this._mounted) return;
			this.setState({ loading: false });
		}
	}

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		const height = this.props.height || 700;
		const panelH = Math.max(360, height - 104);
		return (
			<Spin spinning={this.state.loading}>
				<div style={{ height, display: 'flex', flexDirection: 'column' }}>
					<div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
						<label>目标日期 <input type="date" value={this.state.targetDate} onChange={(e)=>this.setState({ targetDate: e.target.value })} /></label>
						<label>时间 <input type="time" step="1" value={this.state.targetTime} onChange={(e)=>this.setState({ targetTime: e.target.value })} /></label>
						<label>月长算法 <Select size="small" style={{ width: 150 }} value={this.state.minorVariant} onChange={(v)=>this.setState({ minorVariant: v })}>
							{MINOR_VARIANT_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
						</Select></label>
						<Button size="small" onClick={this.load}>计算推运</Button>
						<span>年龄天数：{fmtNum(result.ageDays, 1)}</span>
					</div>
					<Tabs defaultActiveKey="secondary" tabPosition="top" style={{ flex: '1 1 auto' }}>
						{(result.methods || []).map((method)=>(
							<TabPane tab={methodTab(method)} key={method.method}>
								<ProgMethodPanel
									value={this.props.value}
									method={method}
									targetDate={this.state.targetDate}
									targetTime={this.state.targetTime}
									mode="tropical"
									height={panelH}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									showAstroMeaning={this.props.showAstroMeaning}
								/>
							</TabPane>
						))}
					</Tabs>
				</div>
			</Spin>
		);
	}
}

export default AstroProgressions;
