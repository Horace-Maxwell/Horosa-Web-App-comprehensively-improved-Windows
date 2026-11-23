// 世俗盘页(组件类在这里;模块级常量与卡片段按职责拆在 main/ 下):tables(盘种 / 入境、中文名表、配色、周期与时代分期、
//   尊贵、宫位与地理分区表格)→ cards(右栏卡片段与排盘设置跨会话保留)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
// 组件方法同样按职责拆在 main/ 下(compute · leftPanels · westernCards · vedicCards · cycleCards),类后 mixinMethods 挂回原型;构造、生命周期与 render 留在类里。
// components/mundane/MundaneMain.js
// 世俗盘 Mundane：类型选择器统辖多种世俗盘——
//   入宫盘（四正入宫，精确入宫时刻）/ 新月图 / 满月图 / 日食图 / 月食图 / 地区盘 / 行星周期（木土大合相纪元）。
// 入宫：/jieqi 精确节气种子 + /chart。新月满月/日月食：momentPipeline（/astroextra/ephemeris）扫描事件 → 选中按精确时刻排盘。
// 地区盘：预置/自定义历史建置时刻 + 12 世俗宫义。行星周期：/astroextra/greatconj 精算木土大合。
// 解读层：divination/mundane/describe（行星落世俗宫判词、食的元素/分度判词）。
import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import DivinationChartShell from '../divination/DivinationChartShell';
import { hiddenBodiesFor } from '../../divination/mundane/ruleset';
import { seedShellFromSaved } from '../../utils/divinationShellSettings';
import { currentYear } from './main/tables';
import { MUNDANE_SETTING_EXTRA_KEYS, MUNDANE_PAGE_SETTINGS } from './main/cards';
import { mixinMethods } from '../../utils/mixinMethods';
import { computeMethods } from './main/compute';
import { leftPanelMethods } from './main/leftPanels';
import { westernCardMethods } from './main/westernCards';
import { vedicCardMethods } from './main/vedicCards';
import { cycleCardMethods } from './main/cycleCards';
export { formatMundaneHouseTable, formatMundaneChorographyTable } from './main/tables';
export { buildMundaneCardSections, MUNDANE_PAGE_SETTINGS } from './main/cards';

class MundaneMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		// 壳只在构造时读 defaults / initialExtra:这里用保存值播种一次(引用恒定)。没存过 = 原来的出厂值逐字相同。
		this._seed = seedShellFromSaved(MUNDANE_PAGE_SETTINGS,
			{ tradition: 1, zodiacal: 0, hsys: 0 },
			{ mundaneRuleset: 'modern', mundaneType: 'ingress', ingressTerm: '春分', ingressYear: currentYear(), scanYear: currentYear() },
			MUNDANE_SETTING_EXTRA_KEYS);
		const savedBb = MUNDANE_PAGE_SETTINGS.load();
		this.state = {
			casting: false, err: '',
			gcStart: 1300, gcEnd: 2200, gcLoading: false, gcResults: null, gcErr: '', gcPair: 'jupiter-saturn', gcAspect: 0, gcMode: 'ages',
			scanLoading: false, scanRows: null, scanErr: '', scanType: '', eclipseDetail: null,
			regionAddOpen: false, regionForm: { name: '', date: '', time: '12:00:00', zone: '+08:00', lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9 },
			bbStart: 1900, bbEnd: 2050, bbSet: savedBb.bbSet, bbHarm: savedBb.bbHarm, bbLoading: false, bbErr: '', bbData: null,
			mundaneRightTab: 'overview',
			progFoundingYear: null, progTargetYear: null,
			srData: null, srLoading: false, srErr: '', srYear: null, srKey: null,
			patData: null, patLoading: false, patErr: '', patKey: null,
			secData: null, secLoading: false, secErr: '', secYear: null, secKey: null,
			relocData: null, relocLoading: false, relocErr: '', relocCity: null,
			seasonSeed: null, seasonSeedYear: null, seasonLoading: false, seasonErr: '',
		};
		this.computeMundaneReturn = this.computeMundaneReturn.bind(this);
		this.computeMundanePatterns = this.computeMundanePatterns.bind(this);
		this.computeMundaneSecondary = this.computeMundaneSecondary.bind(this);
		this.computeMundaneRelocation = this.computeMundaneRelocation.bind(this);
		this.castIngress = this.castIngress.bind(this);
		this.computeGreatConj = this.computeGreatConj.bind(this);
		this.computeBarbault = this.computeBarbault.bind(this);
		this.scanEvents = this.scanEvents.bind(this);
	}

	componentDidMount(){
		this.computeGreatConj();
	}

	render(){
		return (
			<DivinationChartShell
				hostState={this.state}
				beforeSaveCase={(chart, fields, extra)=>this.ensureCycleTableText(chart, extra)}   /* 右栏读本页 state;壳的渲染守卫把函数类属性都当没变,要靠这一项知道本页状态变了 */
				title="世俗盘"
				wheelArt={this.props.wheelArt}   /* 盘面美术 / 外环样式随「设置→星盘设置」全局变更(壳内订阅同步) */
				chartStyle={this.props.chartStyle}
				kicker="世俗设置"
				pageClass="horosa-mundane-page"
				castNowLabel="此刻起盘"
				defaults={this._seed.defaults}
				initialExtra={this._seed.initialExtra}
				restoreBaseline={this._seed.restoreBaseline}   /* 载入事盘:事盘里没有的设置键回出厂值,不沿用本机保存的偏好 */
				onUserFieldChange={(patch)=>MUNDANE_PAGE_SETTINGS.save(patch)}   /* 壳左栏亲手改黄道 / 宫制 → 落盘 */
				fields={this.props.fields}
				height={this.props.height}
				chartDisplay={this.props.chartDisplay}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
				dispatch={this.props.dispatch}
				saveModule="mundane"
				buildAiSnapshot={(chart, fields, extra) => this.buildAiSnapshot(chart, fields, extra)}
				// 流派渲染白名单:古典/中世纪派中盘不绘 ♅♆♇ glyph 与其相位线(纯渲染过滤,
				// 盘仍全量算;modern/barbault 返回 null=零过滤,默认档渲染逐字节一致)。
				hideBodies={(chartObj, extra) => hiddenBodiesFor((extra || {}).mundaneRuleset)}
				renderLeftExtra={(args) => this.renderLeftExtra(args)}
				renderRight={(args) => this.renderRight(args)}
			/>
		);
	}
}
mixinMethods(MundaneMain, computeMethods, leftPanelMethods, westernCardMethods, vedicCardMethods, cycleCardMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default MundaneMain;
