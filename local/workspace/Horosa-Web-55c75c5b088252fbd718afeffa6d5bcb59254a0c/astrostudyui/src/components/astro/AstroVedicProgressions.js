import { Component } from 'react';
import { Spin, Select } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, cardStyle, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import ProgMethodPanel, { MINOR_VARIANT_OPTIONS } from './AstroProgChart';
import { buildVedicProgSnapshotText } from './astroProgSnapshot';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = Tabs.TabPane;
const { Option } = Select;

function today(){
	const dt = new Date();
	return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`;
}

function methodTab(method){
	return method.method === 'secondary' ? '二次推运' : (method.method === 'tertiary' ? '三次推运' : '小推运');
}

// [#80] builder 已抽到共享 astroProgSnapshot.js(恒星/回归两支同源);此处按原名再导出,
// 既有 import 路径不变。
export { buildVedicProgSnapshotText };

// 恒星推运（sidereal）：二次/三次/小推运。每个子 tab → 左固定 sidereal 推运双盘 + 右可滚动位置/相位表。
class AstroVedicProgressions extends Component{
	constructor(props){
		super(props);
		this.state = {
			targetDate: today(),
			targetTime: '12:00:00',
			minorVariant: DIRECTION_PAGE_SETTINGS.load().minorVariant,   // 上次亲手设的月长算法(三个推运页共用;没存过 = synodic)
			loading: false,
			result: null,
			requestKey: '',
			// 受控子页签(原 defaultActiveKey='secondary'):FreezeSubTab 需要知道哪一页在前台。
			methodTab: 'secondary',
		};
		this.load = this.load.bind(this);
		this.changeMethodTab = this.changeMethodTab.bind(this);
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
		// [挂载自检] 导出=页面所见:带页面目标时刻(此前只传月长算法,导出恒「今日 12:00」)。
		buildVedicProgSnapshotText(this.props.value, { targetDate: this.state.targetDate, targetTime: this.state.targetTime, minorVariant: this.state.minorVariant }).then((txt) => { evt.detail.snapshotText = txt || ''; }).catch(() => {});
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `vedicprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			setTimeout(this.load, 0);
		}
	}

	changeMethodTab(key){
		this.setState({ methodTab: key });
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
			// horosa_panel_ready_v1:恒星推运结果(中栏盘 + 右栏表同源于 result)落定的那一次 setState。
			this.setState({ result, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
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
		// [双滚动条根治 2026-09-18] 面板高不再用「工作区高−常数」估算(常数与真实工具条/页签高不等 → 多出的十几像素把外层面板撑出第二条滚动条);
		// 内层 Tabs 走定高链(app.less .horosa-direction-page .ant-tabs-top …),面板 100% 跟随容器,任何缩放/字号/窗高零常数。
		const panelH = '100%';
		// 受控 activeKey:方法列表由后端结果决定,页签集合会随结果变化 —— 用户选过的键仍在就保持,
		// 否则回落到 'secondary'(原 defaultActiveKey);再不在就取首个,绝不停在不存在的键上显示空白。
		const methodKeys = (result.methods || []).map((m)=>m.method);
		let methodKey = this.state.methodTab;
		if(methodKeys.indexOf(methodKey) < 0){
			methodKey = methodKeys.indexOf('secondary') >= 0 ? 'secondary' : methodKeys[0];
		}
		return (
			<Spin spinning={this.state.loading}>
				<div style={{ height, display: 'flex', flexDirection: 'column' }}>
					<div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
						<span style={{ fontWeight: 600 }}>恒星推运（Sidereal）</span>
						<label>目标日期 <input type="date" value={this.state.targetDate} onChange={(e) => this.setState({ targetDate: e.target.value })} /></label>
						<label>时间 <input type="time" step="1" value={this.state.targetTime} onChange={(e) => this.setState({ targetTime: e.target.value })} /></label>
						<label>月长算法 <Select size="small" style={{ width: 150 }} value={this.state.minorVariant} onChange={(v)=>{ DIRECTION_PAGE_SETTINGS.save({ minorVariant: v }); this.setState({ minorVariant: v }); }}>
							{MINOR_VARIANT_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
						</Select></label>
						<Button size="small" onClick={this.load}>计算推运</Button>
						<span>年龄天数：{fmtNum(result.ageDays, 1)}</span>
					</div>
					{/* horosa_freeze_subtabs_v1:每个推运法一张盘 + 一套表,此前**全部**方法常驻重渲
					    (改目标日期/月长算法都把所有方法重画一遍)。改受控 + FreezeSubTab:只画前台那一个;
					    切回时拿本轮最新 children 立即渲一帧,不卸载、不重发请求、不丢滚动位置。 */}
					<Tabs activeKey={methodKey} onChange={this.changeMethodTab} tabPosition="top" style={{ flex: '1 1 auto', minHeight: 0 }}>
						{(result.methods || []).map((method) => (
							<TabPane tab={methodTab(method)} key={method.method}>
								<FreezeSubTab active={methodKey === method.method}>
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
								</FreezeSubTab>
							</TabPane>
						))}
					</Tabs>
				</div>
			</Spin>
		);
	}
}

export default AstroVedicProgressions;
