import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import QuickDockBar from '../common/QuickDockBar';
import { randomStr } from '../../utils/helper';
import AstroGermany from '../germany/AstroGermany';
import HellenAstroMain from '../hellenastro/HellenAstroMain';
import Dwadasamsa12Main from '../hellenastro/Dwadasamsa12Main';
import LocAstroMain from '../loc/LocAstroMain';
import OtherBuMain from '../otherbu/OtherBuMain';
import AstroHarmonicLab from './AstroHarmonicLab';
import AstroDraconicLab from './AstroDraconicLab';
import AstroRelocationLab from './AstroRelocationLab';
import HoraryMain from '../horary/HoraryMain';
import ElectionMain from '../election/ElectionMain';
import MundaneMain from '../mundane/MundaneMain';
import { warmGermanyMidpoint } from '../germany/AstroMidpoint';
import { stepPrefetchEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

const TabPane = Tabs.TabPane;
const AUX_TABS = ['germanytech', 'hellenastro', 'dwadasamsa', 'locastro', 'relocation', 'harmonic', 'draconic', 'otherbu', 'horary', 'election', 'mundane'];

class AuxChartMain extends Component{

	constructor(props) {
		super(props);

		const subtab = this.props.currentSubTab ? this.props.currentSubTab : 'germanytech';
		const tab = AUX_TABS.indexOf(subtab) >= 0 ? subtab : 'germanytech';
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
				germanytech:{
					fun: null
				},
				hellenastro:{
					fun: null
				},
				dwadasamsa:{
					fun: null
				},
				locastro:{
					fun: null
				},
				relocation:{
					fun: null
				},
				harmonic:{
					fun: null
				},
				draconic:{
					fun: null
				},
				otherbu:{
					fun: null
				},
				horary:{
					fun: null
				},
				election:{
					fun: null
				},
				mundane:{
					fun: null
				},
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.findTab = this.findTab.bind(this);
		this.callCurrentHook = this.callCurrentHook.bind(this);
		this.renderQuickDock = this.renderQuickDock.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				this.callCurrentHook(fields, chartObj);
			};
			// PERF-R9 Ship 7:辅盘默认子页=量化盘(germanytech),其 /germany/midpoint 只吃
			// fields + 存储流派,与主 /chart 无关 —— 在 /chart 返回之前并行发出。
			// 只在当前真在 germanytech 子页时发(其余子页发它=白打网络)。
			// 闸:horosa.perf.prewarmRequests(关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.findTab() !== 'germanytech'){
					return;
				}
				try{
					warmGermanyMidpoint(flds || this.props.fields);
				}catch(e){ /* 预热失败无害 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):/germany/midpoint 是确定性纯计算
			// (同 生辰+流派/容许度 恒同中点盘)→ 登记步进预取,落 requestDedupe L1/L2。
			// 🔴 登记在组件内:目标子页由 this.state.currentTab 决定,模块级无从判断。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('auxchart', (steppedFields)=>{
					if(this.findTab() !== 'germanytech' || !steppedFields){
						return [];
					}
					return [{
						name: 'germany:midpoint',
						path: '/germany/midpoint',
						run: ()=> warmGermanyMidpoint(steppedFields),
					}];
				});
			}
		}
	}

	// horosa_auxchart_scu_v1(PERF-R9 Ship 6):辅盘容器 sCU —— 照 AstroChartMain / BaZi /
	// GuaZhanMain / DiceMain 既有范式,直接用 wrapperPropsEqual(全 props 机械浅比,键数或任一
	// 非函数键换引用即返 true;kill-switch horosa.perf.chartSCU 关=恒重渲旧行为)。
	// 🔴 为什么必须跳过【函数型 props】:pages/index.js 的 changeCond 是组件体内的函数声明,
	//    AstroIndex 每渲一次就是新引用。若把 onChange 纳入比较,本 sCU 恒返 true = 完全空转
	//    (这正是初版的实况)。跳过安全的理由见 wrapperPropsEqual 注释:闭包捕获的是数据 props,
	//    数据一变必触发重渲,重渲时子盘自然拿到新闭包,不存在「用旧闭包派发陈旧 payload」。
	// state 变化(切子页签 / hook 表)一律先返 true;dock 的 forceUpdate 本就绕过 sCU,不受影响。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true; // 切子页签 / hook 表变动 —— 一律照渲
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	findTab(){
		const tab = this.state.currentTab ? this.state.currentTab : 'germanytech';
		return AUX_TABS.indexOf(tab) >= 0 ? tab : 'germanytech';
	}

	callCurrentHook(fields, chartObj){
		const tab = this.findTab();
		const hook = this.state.hook[tab];
		if(hook && hook.fun){
			hook.fun(fields || this.props.fields, chartObj || this.props.chart);
		}
	}

	changeTab(key){
		this.setState({
			currentTab: key,
		}, ()=>{
			this.callCurrentHook(this.props.fields, this.props.chart);
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}
		});
	}

	// 外部（如从事件盘列表 applyCase 还原卜卦/择日案例）改动 currentSubTab 时，切到对应子盘。
	componentDidUpdate(prevProps){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const key = this.props.currentSubTab;
			if(AUX_TABS.indexOf(key) >= 0 && key !== this.state.currentTab){
				this.setState({ currentTab: key }, ()=>{
					this.callCurrentHook(this.props.fields, this.props.chart);
				});
			}
		}
	}

	// 快捷栏契约:原 11 键=右侧 Tabs 的静态镜像(目录化),全部撤除;辅盘无独立起盘/保存,只留 AI。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="auxchart"
				className="horosa-aux-quick-dock"
				hasResult={!!this.props.chart}
				dispatch={this.props.dispatch}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const childHeight = Math.max(height - 36, 560);
		const tab = this.findTab();

		// horosa_freeze_subtabs_v1(PERF-R9 Ship 6):11 个子盘各包一层 FreezeSubTab(函数式 children)。
		// 未激活过 → 连元素都不建;激活过后切走 → 冻结(DOM/实例/state 全留,不卸载不重取);
		// 切回 → sCU 返 true,拿本轮最新 props 立刻渲一帧,零陈旧零闪烁。
		return (
			<div id={this.state.divId} className="horosa-auxchart-page">
				<div className="horosa-auxchart-layout">
					<Tabs
						defaultActiveKey={tab} tabPosition='right'
						activeKey={tab}
						onChange={this.changeTab}
						className="xq-tabs-rail horosa-auxchart-tabs"
						style={{ height: '100%' }}
					>
						<TabPane tab="量化盘" key="germanytech">
							<FreezeSubTab active={tab === 'germanytech'}>{()=>(
							<AstroGermany
								onChange={this.props.onChange}
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chart={this.props.chart}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.germanytech}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="十三分盘" key="hellenastro">
							<FreezeSubTab active={tab === 'hellenastro'}>{()=>(
							<HellenAstroMain
								value={this.props.chart}
								onChange={this.props.onChange}
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartStyle={this.props.chartStyle}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.hellenastro}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="十二分盘" key="dwadasamsa">
							<FreezeSubTab active={tab === 'dwadasamsa'}>{()=>(
							<Dwadasamsa12Main
								onChange={this.props.onChange}
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartStyle={this.props.chartStyle}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.dwadasamsa}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="占星地图" key="locastro">
							<FreezeSubTab active={tab === 'locastro'}>{()=>(
							<LocAstroMain
								value={this.props.chart}
								onChange={this.props.onChange}
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								hook={this.state.hook.locastro}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="重置盘" key="relocation">
							<FreezeSubTab active={tab === 'relocation'}>{()=>(
							<AstroRelocationLab
								value={this.props.chart}
								fields={this.props.fields}
								height={childHeight}
								chartStyle={this.props.chartStyle}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="调波盘" key="harmonic">
							<FreezeSubTab active={tab === 'harmonic'}>{()=>(
							<AstroHarmonicLab
								value={this.props.chart}
								height={childHeight}
								chartStyle={this.props.chartStyle}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="龙盘" key="draconic">
							<FreezeSubTab active={tab === 'draconic'}>{()=>(
							<AstroDraconicLab
								value={this.props.chart}
								height={childHeight}
								chartStyle={this.props.chartStyle}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="骰子" key="otherbu">
							<FreezeSubTab active={tab === 'otherbu'}>{()=>(
							<OtherBuMain
								height={childHeight}
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.otherbu}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="卜卦盘" key="horary">
							<FreezeSubTab active={tab === 'horary'}>{()=>(
							<HoraryMain
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.horary}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="择日盘" key="election">
							<FreezeSubTab active={tab === 'election'}>{()=>(
							<ElectionMain
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.election}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>

						<TabPane tab="世俗盘" key="mundane">
							<FreezeSubTab active={tab === 'mundane'}>{()=>(
							<MundaneMain
								fields={this.props.fields}
								fieldsAry={this.props.fieldsAry}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.mundane}
								dispatch={this.props.dispatch}
							/>
							)}</FreezeSubTab>
						</TabPane>
					</Tabs>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}

export default AuxChartMain;
