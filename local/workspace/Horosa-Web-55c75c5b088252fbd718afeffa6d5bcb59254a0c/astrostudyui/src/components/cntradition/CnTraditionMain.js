import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
import GuaSymDesc from '../gua/GuaSymDesc';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import CuanGong12 from '../commtools/CuanGong12';
import BaziPithy from '../commtools/BaziPithy';

const TabPane = Tabs.TabPane;

class CnTraditionMain extends Component{

	constructor(props) {
		super(props);

		const subtab = this.props.currentSubTab ? this.props.currentSubTab : 'guasym';
		const validTabs = ['guasym', 'cuangong12', 'pithy'];
		const tab = validTabs.indexOf(subtab) >= 0 ? subtab : 'guasym';
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
				guasym:{
					fun: null
				},
				cuangong12: {
					fun: null
				},
				pithy: {
					fun: null
				},
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.findTab = this.findTab.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				let subtab = this.findTab();
				if(hook[subtab] && hook[subtab].fun){
					hook[subtab].fun(fields);
				}
				// horosa_panel_ready_v1(复核补接):'cntradition' 是【顶层】技法页签,doHook 的 hooking()
				// 只调用 currentTab 对应的这一枚 hook.fun,故此处消费的必是本页签自己的交互起点
				// (与 CommToolsMain「抽屉里不可打点」的情形不同,不存在抢别的技法样本的问题)。
				// 本页中右栏为纯静态知识面板(不消费 fields/chartObj),fields 一提交即为终态 ⇒
				// 此刻就是「中栏+右栏画完」。缺了它,在辅助页改时间会只留 start 不留 end,该技法永远量不到。
				// markPanelReady 自带 generation 去重 + 未开始交互时为空操作,重复调用无副作用。
				markPanelReady('cntradition');
				setTimeout(()=>{
					if(this.props.dispatch){
						this.props.dispatch({
							type: 'astro/save',
							payload: {
								currentSubTab: subtab,
							}
						});
					}			
				}, 500);
			};
			// horosa_chart_free_declared_v1(PERF-R9 Ship 7 接线)—— 本行是本文件唯一的 Windows
			// overlay 改动标记:下面这条 `hook.chartFree = true` 声明 + utils/techniqueChartFree.js
			// 的同名登记,两者缺一即哨兵/契约测试红。Mac 同步冲掉它 = 辅助页退回「等一次 /chart」。
			// 🔴 chartFree 契约(PERF-R9 Ship 7 接线):辅助页中右栏【零】消费共享 chartObj ——
			// 本组件只做子页路由、只向下传 fields(render 里不向任何子组件传 chart/value)。
			// 声明后 fetchByFields 对本页走快车道:fields 立即提交、不等 /chart 网络。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
		}

	}

	findTab(){
		let subtab = this.state.currentTab ? this.state.currentTab : 'guasym';
		for(let key in this.state.hook){
			if(key === subtab){
				return key;
			}
		}
		let key = 'guasym';
		return key;
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			if(hook[key].fun){
				hook[key].fun(this.props.fields);
			}
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


	render(){
		// 根 Tabs 改充满父面板（原 props.height-20 定死像素高 → 底部黑条）。
		let tab = this.findTab();

		return (
			<div id={this.state.divId} className="horosa-cntradition-page">
				<Tabs
					defaultActiveKey={tab} tabPosition='right'
					className="xq-tabs-rail"
					activeKey={tab}
					onChange={this.changeTab}
					style={{ height: '100%', minHeight: 0 }}
				>
					{/* horosa_freeze_subtabs_v1 接线：本 Tabs 已受控（activeKey={tab} + onChange）。
					    函数式 children：从未激活过的页签连 React 元素都不创建；已激活过的永不卸载，
					    非激活期间只跳过 re-render，切回时拿本轮最新 children 立刻渲一帧（零陈旧、零闪烁）。
					    三个子页都是无 props 的静态知识面板（GuaSymDesc/CuanGong12/BaziPithy），
					    自身无对外注册的挂载副作用，故无需 eager。 */}
					<TabPane tab="八卦类象" key="guasym">
						<FreezeSubTab active={tab === 'guasym'}>{()=>(
							<TechniqueErrorBoundary label="八卦类象"><GuaSymDesc /></TechniqueErrorBoundary>
						)}</FreezeSubTab>
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12">
						<FreezeSubTab active={tab === 'cuangong12'}>{()=>(
							<TechniqueErrorBoundary label="十二串宫"><CuanGong12 /></TechniqueErrorBoundary>
						)}</FreezeSubTab>
					</TabPane>

					<TabPane tab="八字规则" key="pithy">
						<FreezeSubTab active={tab === 'pithy'}>{()=>(
							<TechniqueErrorBoundary label="八字规则"><BaziPithy /></TechniqueErrorBoundary>
						)}</FreezeSubTab>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CnTraditionMain;
