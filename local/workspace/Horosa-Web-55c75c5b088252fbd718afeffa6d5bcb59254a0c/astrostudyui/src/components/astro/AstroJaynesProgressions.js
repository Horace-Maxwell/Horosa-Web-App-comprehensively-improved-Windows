import { Component } from 'react';
import { Spin, Select } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, cardStyle, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import { buildStarAndLotPositionLines, buildHouseCuspLines, buildPredictiveBirthLines, buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import ProgMethodPanel, { MINOR_VARIANT_OPTIONS } from './AstroProgChart';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = Tabs.TabPane;
const { Option } = Select;

function today(){
	const dt = new Date();
	return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, '0')}-${`${dt.getDate()}`.padStart(2, '0')}`;
}

function typeLabel(t){ return t === 'contraparallel' ? '反平行' : '平行'; }

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

function methodTab(method){
	return method.method === 'secondary' ? '二次推运' : (method.method === 'tertiary' ? '三次推运' : '小推运');
}

// 赤纬推运 AI 快照（无头）：内部 fetch /astroextra/jaynesprog。无数据返回 ''。
// opts（AI 挂载「每技法设置」）：targetDate + targetTime（目标时刻）+ minorVariant（小推运月长，缺省 engine=现状）。
export async function buildJaynesProgSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = opts && typeof opts === 'object' ? opts : {};
	const targetDate = `${o.targetDate || ''}`.trim() || today();
	const targetTime = `${o.targetTime || ''}`.trim() || '12:00:00';
	const minorVariant = `${o.minorVariant || ''}`.trim() || 'engine';
	let result = null;
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/jaynesprog`, {
			body: JSON.stringify({ ...chartParams(chartObj), targetDate, targetTime, minorVariant, orb: 1.0 }),
			timeoutMs: 45000,
		});
		result = unwrapResult(data) || {};
	}catch(e){ return ''; }
	const methods = Array.isArray(result.methods) ? result.methods : [];
	const sec = methods.find((m) => m.method === 'secondary') || methods[0];
	if(!sec || !Array.isArray(sec.parallels) || sec.parallels.length === 0){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const lines = [];
	lines.push('[赤纬推运（Declination）]');
	lines.push('赤纬推运：推运后看赤纬平行/反平行（下表为二次推运，截至今日）。');
	// 目标日期与推运时刻的映射必须写明(推运法本义:目标日期折算成推运时刻;只写派生时刻会被误读为没吃目标日期)。
	lines.push(`目标日期：${targetDate} ${targetTime}（各法推运时刻=按该法折算，见各小节）`);
	const natalStars = buildStarAndLotPositionLines(chartObj);
	const natalHouses = buildHouseCuspLines(chartObj);
	// [YB v42] 生辰行并入既有 [本命盘配置] 段头部(裸行版,不新开段;无生辰数据 → 输出与现状逐字一致)。
	const natalBirth = safeHelperLines(buildPredictiveBirthLines, chartObj);
	const natalDecls = Array.isArray(result.natalDeclinations) ? result.natalDeclinations : [];
	if(natalStars.length || natalHouses.length || natalBirth.length){
		lines.push('');
		lines.push('[本命盘配置]');
		if(natalBirth.length){ lines.push(...natalBirth); }
		if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
		if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
		// [YB v42] UI 赤纬图有本命赤纬列,此前不入快照 → ◆ 子题段内纯增(平行/反平行的本命侧参照)。
		if(natalDecls.length){
			lines.push('');
			lines.push('◆ 本命赤纬');
			lines.push('| 点 | 赤纬 |');
			lines.push('| --- | --- |');
			natalDecls.forEach((d) => { lines.push(`| ${sym(d.id)} | ${fmtNum(d.decl, 2)}° |`); });
		}
	}
	lines.push('');
	lines.push('[时段盘 赤纬平行/反平行]');
	lines.push('| 推运点 | 类型 | 本命点 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	sec.parallels.slice(0, 80).forEach((p) => {
		lines.push(`| ${sym(p.a)} | ${typeLabel(p.type)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
	});
	// [YB v42] UI 有 二次/三次/小推运 三法 Tab + 推运赤纬表,此前导出只有二次推运平行表。
	// 单次 fetch 已带回全部三法(与组件同一接口同一回包),零额外成本 → 三法全量各出小节,
	// 段内纯增(◆ 子题并入既有 [时段盘 赤纬平行/反平行] 段,既有二次推运平行表逐字不动)。
	const pushMethodBlocks = (m, withParallels) => {
		if(!m){ return; }
		const label = methodTab(m);
		const when = m.progressedDate && m.progressedDate.datetime ? m.progressedDate.datetime : '';
		if(Array.isArray(m.declinations) && m.declinations.length){
			lines.push('');
			lines.push(`◆ ${label} 推运赤纬`);
			if(when){ lines.push(`推运时刻：${when}`); }
			lines.push('| 点 | 赤纬 |');
			lines.push('| --- | --- |');
			m.declinations.forEach((d) => { lines.push(`| ${sym(d.id)} | ${fmtNum(d.decl, 2)}° |`); });
		}
		if(withParallels && Array.isArray(m.parallels) && m.parallels.length){
			lines.push('');
			lines.push(`◆ ${label} 赤纬平行/反平行`);
			lines.push('| 推运点 | 类型 | 本命点 | 误差 |');
			lines.push('| --- | --- | --- | --- |');
			m.parallels.slice(0, 80).forEach((p) => {
				lines.push(`| ${sym(p.a)} | ${typeLabel(p.type)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
			});
		}
	};
	pushMethodBlocks(sec, false);
	methods.forEach((m) => { if(m && m !== sec){ pushMethodBlocks(m, true); } });
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, chartObj));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'jaynesprog'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

// 赤纬推运（Declination）：二次/三次/小推运。每个子 tab → 左固定推运双盘 + 右可滚动 赤纬 / 平行·反平行表。
class AstroJaynesProgressions extends Component{
	constructor(props){
		super(props);
		this.state = { targetDate: today(), targetTime: '12:00:00', minorVariant: 'engine', loading: false, result: null, requestKey: '', methodTab: 'secondary' };
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
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'jaynesprog' || !this.props.value){ return; }
		buildJaynesProgSnapshotText(this.props.value, { minorVariant: this.state.minorVariant }).then((txt) => { evt.detail.snapshotText = txt || ''; }).catch(() => {});
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ setTimeout(this.load, 0); }
	}

	changeMethodTab(key){
		this.setState({ methodTab: key });
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/jaynesprog`, {
				body: JSON.stringify({ ...chartParams(this.props.value), targetDate: this.state.targetDate, targetTime: this.state.targetTime, minorVariant: this.state.minorVariant, orb: 1.0 }),
				timeoutMs: 45000,
			});
			if(!this._mounted) return;
			clearLoadFailure(this);
			// horosa_panel_ready_v1:赤纬推运 结果(中栏盘 + 右栏表同源于 result)落定的那一次 setState。
			this.setState({ result: unwrapResult(data) || {}, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
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
						<span style={{ fontWeight: 600 }}>赤纬推运（平行 / 反平行）</span>
						<label>目标日期 <input type="date" value={this.state.targetDate} onChange={(e) => this.setState({ targetDate: e.target.value })} /></label>
						<label>时间 <input type="time" step="1" value={this.state.targetTime} onChange={(e) => this.setState({ targetTime: e.target.value })} /></label>
						<label>月长算法 <Select size="small" style={{ width: 150 }} value={this.state.minorVariant} onChange={(v)=>this.setState({ minorVariant: v })}>
							{MINOR_VARIANT_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
						</Select></label>
						<Button size="small" onClick={this.load}>计算推运</Button>
						<span>年龄天数：{fmtNum(result.ageDays, 1)}</span>
					</div>
					{/* horosa_freeze_subtabs_v1:每个推运法一张盘 + 一套表,此前**全部**方法常驻重渲
					    (改目标日期/月长算法都把所有方法重画一遍)。改受控 + FreezeSubTab:只画前台那一个;
					    切回时拿本轮最新 children 立即渲一帧,不卸载、不重发请求、不丢滚动位置。 */}
					<Tabs activeKey={methodKey} onChange={this.changeMethodTab} tabPosition="top" style={{ flex: '1 1 auto' }}>
						{(result.methods || []).map((method) => (
							<TabPane tab={methodTab(method)} key={method.method}>
								<FreezeSubTab active={methodKey === method.method}>
								<ProgMethodPanel
									value={this.props.value}
									method={method}
									targetDate={this.state.targetDate}
									targetTime={this.state.targetTime}
									mode="declination"
									natalDeclinations={result.natalDeclinations}
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

export default AstroJaynesProgressions;
