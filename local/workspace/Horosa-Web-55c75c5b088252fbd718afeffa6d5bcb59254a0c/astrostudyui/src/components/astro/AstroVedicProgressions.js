import { Component } from 'react';
import { Spin, Select } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import { buildStarAndLotPositionLines, buildHouseCuspLines, buildPredictiveBirthLines, buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import ProgMethodPanel, { MINOR_VARIANT_OPTIONS } from './AstroProgChart';

const TabPane = Tabs.TabPane;
const { Option } = Select;

function today(){
	const dt = new Date();
	return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`;
}

const EVENT_POINTS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Asc', 'MC'];

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

function methodTab(method){
	return method.method === 'secondary' ? '二次推运' : (method.method === 'tertiary' ? '三次推运' : '小推运');
}

// 恒星推运 AI 快照（无头）：内部 fetch /astroextra/progressions + zodiacal:1，与组件同口径。无数据返回 ''。
// opts（AI 挂载「每技法设置」）：targetDate + targetTime（目标时刻）+ minorVariant（小推运月长，缺省 engine=现状）。
export async function buildVedicProgSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = opts && typeof opts === 'object' ? opts : {};
	const targetDate = `${o.targetDate || ''}`.trim() || today();
	const targetTime = `${o.targetTime || ''}`.trim() || '12:00:00';
	const minorVariant = `${o.minorVariant || ''}`.trim() || 'engine';
	let result = null;
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
			body: JSON.stringify({
				...chartParams(chartObj),
				zodiacal: 1,
				targetDate,
				targetTime,
				minorVariant,
				orb: 1.5,
			}),
			timeoutMs: 45000,
		});
		result = unwrapResult(data) || {};
	}catch(e){
		return '';
	}
	const methods = (result && Array.isArray(result.methods)) ? result.methods : [];
	const secondary = methods.find((m) => m.method === 'secondary') || methods[0];
	if(!secondary || !Array.isArray(secondary.positions) || secondary.positions.length === 0){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const lines = [];
	lines.push('[恒星推运（Vedic Sidereal）]');
	lines.push('二次/三次/小限推运在恒星黄道（sidereal）下计算；下表为二次推运（截至今日）。');
	// 目标日期与推运时刻的映射必须写明(推运法本义:目标日期折算成推运时刻;只写派生时刻会被误读为没吃目标日期)。
	lines.push(`目标日期：${targetDate} ${targetTime}（各法推运时刻=按该法折算，见各小节）`);
	const natalStars = buildStarAndLotPositionLines(chartObj);
	const natalHouses = buildHouseCuspLines(chartObj);
	// [YB v42] 生辰行并入既有 [本命盘配置] 段头部(裸行版,不新开段;无生辰数据 → 输出与现状逐字一致)。
	const natalBirth = safeHelperLines(buildPredictiveBirthLines, chartObj);
	if(natalStars.length || natalHouses.length || natalBirth.length){
		lines.push('');
		lines.push('[本命盘配置]');
		if(natalBirth.length){ lines.push(...natalBirth); }
		if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
		if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
	}
	lines.push('');
	lines.push('[时段盘配置 二次推运位置]');
	lines.push('| 点 | 恒星推运位置 |');
	lines.push('| --- | --- |');
	secondary.positions.filter((p) => EVENT_POINTS.indexOf(p.id) >= 0).forEach((p) => {
		lines.push(`| ${sym(p.id)} | ${fmtDegree(p)} |`);
	});
	// [YB v42] UI 有 二次/三次/小推运 三法 Tab + 与本命相位表,此前导出只有二次推运位置一张表。
	// 单次 fetch 已带回全部三法(与组件同一接口同一回包),零额外成本 → 三法全量各出小节,
	// 段内纯增(◆ 子题并入既有 [时段盘配置 二次推运位置] 段,既有二次推运表逐字不动)。
	const aspTxt = (v) => (AstroText.AstroTxtMsg[`Asp${fmtNum(v, 0)}`] || `${fmtNum(v, 0)}°`);
	const pushMethodBlocks = (m, withPositions) => {
		if(!m){ return; }
		const label = methodTab(m);
		const when = m.progressedDate && m.progressedDate.datetime ? m.progressedDate.datetime : '';
		if(withPositions && Array.isArray(m.positions) && m.positions.length){
			lines.push('');
			lines.push(`◆ ${label} 推运位置`);
			if(when){ lines.push(`推运时刻：${when}`); }
			lines.push('| 点 | 恒星推运位置 | 速度 |');
			lines.push('| --- | --- | --- |');
			m.positions.filter((p) => EVENT_POINTS.indexOf(p.id) >= 0).forEach((p) => {
				lines.push(`| ${sym(p.id)} | ${fmtDegree(p)} | ${fmtNum(p.lonspeed, 4)} |`);
			});
		}
		if(Array.isArray(m.aspectsToNatal) && m.aspectsToNatal.length){
			lines.push('');
			lines.push(`◆ ${label} 与本命相位`);
			lines.push('| 推运点 | 相位 | 本命点 | 误差 |');
			lines.push('| --- | --- | --- | --- |');
			m.aspectsToNatal.slice(0, 120).forEach((p) => {
				lines.push(`| ${sym(p.a)} | ${aspTxt(p.aspect)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
			});
		}
	};
	pushMethodBlocks(secondary, false);
	methods.forEach((m) => { if(m && m !== secondary){ pushMethodBlocks(m, true); } });
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, chartObj));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'vedicprog'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

// 恒星推运（sidereal）：二次/三次/小推运。每个子 tab → 左固定 sidereal 推运双盘 + 右可滚动位置/相位表。
class AstroVedicProgressions extends Component{
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
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, `vedicprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			this.load();
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'vedicprog' || !this.props.value){ return; }
		buildVedicProgSnapshotText(this.props.value, { minorVariant: this.state.minorVariant }).then((txt) => { evt.detail.snapshotText = txt || ''; }).catch(() => {});
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `vedicprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `vedicprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/progressions`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					zodiacal: 1,
					targetDate: this.state.targetDate,
					targetTime: this.state.targetTime,
					minorVariant: this.state.minorVariant,
					orb: 1.5,
				}),
				timeoutMs: 45000,
			});
			const result = unwrapResult(data) || {};
			if(!this._mounted) return;
			clearLoadFailure(this);
			this.setState({ result, loading: false, requestKey: key });
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
						<span style={{ fontWeight: 600 }}>恒星推运（Sidereal）</span>
						<label>目标日期 <input type="date" value={this.state.targetDate} onChange={(e) => this.setState({ targetDate: e.target.value })} /></label>
						<label>时间 <input type="time" step="1" value={this.state.targetTime} onChange={(e) => this.setState({ targetTime: e.target.value })} /></label>
						<label>月长算法 <Select size="small" style={{ width: 150 }} value={this.state.minorVariant} onChange={(v)=>this.setState({ minorVariant: v })}>
							{MINOR_VARIANT_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
						</Select></label>
						<Button size="small" onClick={this.load}>计算推运</Button>
						<span>年龄天数：{fmtNum(result.ageDays, 1)}</span>
					</div>
					<Tabs defaultActiveKey="secondary" tabPosition="top" style={{ flex: '1 1 auto' }}>
						{(result.methods || []).map((method) => (
							<TabPane tab={methodTab(method)} key={method.method}>
								<ProgMethodPanel
									value={this.props.value}
									method={method}
									targetDate={this.state.targetDate}
									targetTime={this.state.targetTime}
									mode="sidereal"
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

export default AstroVedicProgressions;
