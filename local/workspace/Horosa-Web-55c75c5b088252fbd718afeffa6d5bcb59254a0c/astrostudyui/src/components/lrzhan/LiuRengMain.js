import { lockDayBoundary, dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import React, { Component } from 'react'; // horosa_liureng_render_slice_v1:模块级 JSX 常量需 React 在作用域(jest classic runtime)
import { timeGeoFieldsChanged } from '../../utils/pendingTimeDraft';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import '../../utils/pageSettingsStore';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';
import { registerProcessCache } from '../../utils/processCacheRegistry';
import { Modal, message, Tag } from 'antd';
import { XQButton as Button, XQCard as Card, XQSelect as Select, XQTabs as Tabs, XQSwitch as Switch, XQSideSection  } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import * as LRConst from '../liureng/LRConst';
import { ZSList, ZhangSheng, liurengWangXiang, judgeKongWang } from '../liureng/LRZhangSheng';
import '../liureng/LRPanStyle';
import '../liureng/LRShenJiangDoc';
import '../liureng/ChuangChart';
import { buildXiangContext } from '../liureng/LRXiangDoc';
import { computeFrontendShenSha, computeYearShenSha, computeMonthShenSha } from '../liureng/LRShenShaDoc';
import { detectJianChuan } from '../liureng/LRJianChuanDoc';
import { analyzeKongLocations, analyzeDunGan, analyzeNianMing } from '../liureng/LRKongDunNianDoc';
import { ZHANDUAN_CATEGORIES, ZHANDUAN_DOC, RELATED_BIFA } from '../liureng/LRZhanDuanDoc';
import { matchBiFa, BIFA_LIST } from '../liureng/LRBiFaDoc';
import LRSanChuanRelationMini from '../liureng/LRSanChuanRelationMini';   // 小图与快照共用同一纯函数
import { detectGuiSpecials } from '../liureng/LRBiFa';
import { computeYingQi } from '../liureng/LRYingQiDoc';
import LiuRengChart from './LiuRengChart';
import LiuRengInput from './LiuRengInput';
import LiuRengBirthInput from './LiuRengBirthInput';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import { saveModuleAISnapshot, clearModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { castSourceKey, castChartFor, castFailureKeeps } from '../../utils/derivedChartSource';
import { loadFreshModuleAISnapshot } from '../../utils/moduleSnapshotRefresh';
import { getKentangSavedCasePayload, getKentangSavedCaseFieldsPatch, caseFieldSnapshot,  } from '../../utils/kentangCaseSave';
import {
	getBirthGanzhiLocalCache,
	getLiurengRunyearLocalCache,
	setBirthGanzhiLocalCache,
	setLiurengRunyearLocalCache,
} from '../../utils/localCalcCache';
import { defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { resolveAfter23NewDay } from '../../utils/dayBoundaryResolve';
import { chartDrawGuardEnabled, stepPrefetchEnabled, stepSelectPrefetchEnabled, techniqueResultCacheEnabled } from '../../utils/perfFlags';
// R4-B2(horosa_prefetch_registry_v1):/liureng/gods 步进预取登记 + 选步长武装(S3 收敛)。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { sendScopedFields } from '../../utils/scopedFieldsSink';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)按职责拆在 ./main/ 下;组件本体与对外导出面仍在本文件。
import {
	sameLRSigArr, readLiurengChartType, readLiurengFlag, buildBirthFields, extractGanZi, extractBranch,
	resolveGuaYearGanZi, MaleRunYearList, FemaleRunYearList, calcRunYearLocal, getSolarYearFromField,
	resolveDisplayRunYear, buildMetaRows,
} from './main/birthRunYear';
import { QIZHENG_PLANET_COLOR, QIZHENG_WUXING_COLOR, buildQiZhengItems } from './main/ganzhiHelpers';
import { QI_METHODS, YUE_JIANG_METHODS, FEN_ZHOU_YE_METHODS, LIURENG_PAGE_SETTINGS, liurengChouBranch, buildLiuRengCastOverride } from './main/castLayout';
import {
	serializeBirthDraft, deserializeBirthDraft, getAppliedBirth, liurengCaseGender, liurengBenmingXingnian,
	clonePlain, buildCacheKey, pushCache,
} from './main/panData';
import { XIAO_JU_REFERENCE_TAB_KEYS } from './main/referenceData';
import { buildReferenceDocumentText, buildOverviewReferenceText, buildLiuRengReferenceBundle, filterBiFaListByQuery } from './main/referenceMatch';
import { buildLiuRengSnapshotText } from './main/snapshot';
import { zeriLockProps, zeriRestoredLockMarks, clearZeriLockMarks } from '../../divination/zeri/zeriPageCalibre';
// 对外导出面不变:搬进子模块的导出原样重导出
export { appendMapSection, resolveDisplayRunYear } from './main/birthRunYear';
export {
	QI_METHODS, LIURENG_PAGE_SETTINGS, liurengAyanamsa, getYueJiangByMethod, computeQiXY, buildLiuRengCastOverride,
	buildLiuRengLayout, liurengSeHaiOptsOf, liurengFenZhouYeDiurnal,
} from './main/castLayout';
export {
	liurengCaseGender, buildKeData, buildSanChuanData, buildLiuRengPanRows, buildLiuRengSanChuanRows,
	buildLiuRengSuiShaRows, buildLiuRengZhangShengRows,
} from './main/panData';
export { DA_GE_META, XIAO_JU_META } from './main/referenceData';
export { buildLiuRengReferenceContext, matchDaGeReferences, matchXiaoJuReferences } from './main/referenceMatch';
export { buildLiuRengSnapshotText } from './main/snapshot';


const {Option} = Select;
const TabPane = Tabs.TabPane;

// horosa_liureng_render_slice_v1(L1):十二长生选项 12 个 <Option> 只依赖常量表 LRConst.WuXing,
// 与任何 props/state 无关,原 genWuXingDoms() 每次 render 都从头重建一遍(纯白跑)。提为模块级
// 冻结常量:引用恒稳 → 左栏子面板 sCU 浅比恒等;Select 只读消费列表,零语义差。
const WUXING_OPTION_DOMS = Object.freeze(LRConst.WuXing.map((item, idx)=>(
	<Option key={idx} value={item.elem}>十二长生：{item.elem}--{item.ganzi}</Option>
)));

// horosa_kentang_result_cache_v1 —— /liureng/gods + /liureng/runyear 的结果缓存**提升到模块级**。
// 原为 per-instance(this.godsCache 等):每次切走六壬页 → 组件卸载 → 缓存连同在途 Promise 一起蒸发,
// 切回来整趟往返重付。这两个端点是确定性纯计算(key=genGodsParams/genRunYearParams 的 JSON,
// 即请求体本身:'YYYY-MM-DD'/'HH:mm' 格式化字串 + 经纬/时区/性别/日界开关,无 Date 对象、无随机、
// 无「现在时刻」依赖),故跨实例复用与直连逐值等价。
// ns 显式写死在下面四个常量名里(**不**由 URL 派生:ServerRoot 端口每次后端启动随机,URL 派生的
// ns 会跨会话碎片化)。上限沿用原调用点的 72 / 96(pushCache 逐条传入,未改)。
// 关 horosa.perf.techniqueResultCache → 构造函数回到 new Map()(=今日的 per-instance 行为,逐字一致)。
const LIURENG_GODS_MEM = new Map();
const LIURENG_GODS_INFLIGHT = new Map();
const LIURENG_RUNYEAR_MEM = new Map();
const LIURENG_RUNYEAR_INFLIGHT = new Map();
// 模块级共享后这四张表即「进程内同参复用」缓存:照上游惯例登记清空函数(只供审计仪器取样前清空;产品运行期从不调用,零行为变化)。
registerProcessCache('liureng.godsRunyear', ()=>{ LIURENG_GODS_MEM.clear(); LIURENG_GODS_INFLIGHT.clear(); LIURENG_RUNYEAR_MEM.clear(); LIURENG_RUNYEAR_INFLIGHT.clear(); });

// 起课口径的 state 键(择日宿主经 hook.getCastOptions 取;变了经 onPageCalibreChange 告知宿主)
const LIURENG_CAST_STATE_KEYS = ['guireng', 'castMethod', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai'];

// horosa_liureng_render_slice_v1(L3):左栏「六壬设置」输入面板(时间地点/出生时间/14 项起课选项,
// 内含十几个 antd Select 重组件)原内联在宿主 render 里 —— 宿主任意 setState(收课盘结果、切右栏
// tab、改任一无关状态)都把整面板 reconcile 一遍。抽成同文件子组件 + wrapperPropsEqual 机械浅比
// sCU(全 props 逐键比较,函数型视为恒等,零手抄 key 清单 —— 详 utils/chartUpdateGuard):消费的
// 标量/引用未变 → 整面板跳过;任一真变(fields/birth 引用、任一选项标量)→ 照常重渲,绝不漏渲。
// kill-switch 同 chartSCU:关(horosa.perf.chartSCU=0)= wrapperPropsEqual 恒 false = 恒重渲旧行为。
// 起课选项回调 prop 名取 onOptionChange(= 宿主 handleCastField(键, 值)):页面设置合同扫描器按 onOptionChange('键', …)
// 认控件(切片里读的是 p.X 而非 this.state.X,换个名字它就认不出这些下拉,aiPageFacetControl 合同会把它们判成「页面上无控件」)。
class LiuRengInputPanel extends Component{
	shouldComponentUpdate(nextProps){
		return !wrapperPropsEqual(this.props, nextProps);
	}

	render(){
		const p = this.props;
		// 择日锁定项(起课法):宿主的 zeriLocked / _zeriRestoredLocks 经 props 进入(切片内 this 不是宿主);
		// 两者都是整体换引用的值(zeriRestoredLockMarks / clearZeriLockMarks 恒返新对象或 null),浅比 sCU 照常感知。
		const castLock = zeriLockProps(p.zeriLocked, 'castMethod', p.castMethod, p.zeriRestoredLocks);
		return (
			<div className="horosa-liureng-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">六壬设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与起课选项</div>
					</div>
				</div>
				{/* [择日宿主] 左栏插槽(主六壬页不传=零渲染;prop 经 renderInputPanel 铺入切片) */}
				{typeof p.renderLeftExtra === 'function' ? p.renderLeftExtra() : null}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<LiuRengInput
						fields={p.fields}
						onFieldsChange={p.onFieldsChange}
						onStepSelect={p.onStepSelect}
						timeHook={p.timeHook}
						chartType={p.chartType}
						onChartTypeChange={p.onChartTypeChange}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('time')} title="卜卦人出生时间" storageKey="liureng.s1" className="horosa-liureng-input-section">
					<LiuRengBirthInput
						fields={p.birth}
						onFieldsChange={p.onBirthChange}
						requireConfirm={true}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="liureng.s2" className="horosa-liureng-input-section">
					<div className="horosa-liureng-select-grid">
							<label className="horosa-liureng-select-field">
								<span>十二长生</span>
								<Select value={p.wuxing} onChange={p.onWuXingChange} dropdownMatchSelectWidth={false}>
									{WUXING_OPTION_DOMS}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>贵人体系</span>
								<Select value={p.guireng} onChange={p.onGuiRengChange} dropdownMatchSelectWidth={false}>
									<Option value={0}>六壬法贵人</Option>
									<Option value={1}>遁甲法贵人</Option>
									<Option value={2}>星占法贵人</Option>
									<Option value={3}>甲戊兼牛羊</Option>
									<Option value={4}>干合阳阴贵</Option>
								</Select>
							</label>
							{/* 起课时间算法:缺省真太阳时=后端历来口径(字节零回归);
							    选「直接时间」即与三式合一六壬层(时柱取自吃 timeAlg 的奇门)同口径。
							    择日里内嵌的这份不出:扫描引擎恒按真太阳时判,内嵌盘改了只会「所见≠所判」。
							    (切片子组件:宿主 usesSavedSettings() 经 p.showTimeAlg 传入) */}
							{p.showTimeAlg ? (
								<label className="horosa-liureng-select-field">
									<span>时间算法</span>
									<Select value={p.timeAlg} onChange={p.onTimeAlgChange} dropdownMatchSelectWidth={false}>
										<Option value={0}>真太阳时（默认）</Option>
										<Option value={1}>直接时间</Option>
									</Select>
								</label>
							) : null}
							<label className="horosa-liureng-select-field" title={castLock.title}>
								<span>起课法</span>
								{/* 择日内嵌:扫描只按正时正将起课,宿主传 zeriLocked 置灰(点结果行时回写锁定值) */}
								<Select value={p.castMethod} onChange={p.onCastMethodChange} dropdownMatchSelectWidth={false} disabled={!!castLock.disabled}>
									{QI_METHODS.map((m)=>(<Option key={m.key} value={m.key}>{m.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>换将</span>
								<Select value={p.yueJiangMethod} onChange={(v)=>p.onOptionChange('yueJiangMethod', v)} dropdownMatchSelectWidth={false}>
									{YUE_JIANG_METHODS.map((m)=>(<Option key={m.key} value={m.key}>{m.name}</Option>))}
								</Select>
							</label>
							{p.castMethod === 'xuanshi' ? (
							<label className="horosa-liureng-select-field horosa-liureng-select-field-wide">
								<span>选时·时辰</span>
								<Select value={p.xuanShiZhi || ''} onChange={(v)=>p.onOptionChange('xuanShiZhi', v)} dropdownMatchSelectWidth={false}>
									<Option value=''>用正时</Option>
									{LRConst.ZiList.map((z)=>(<Option key={z} value={z}>{z}时</Option>))}
								</Select>
							</label>
							) : null}
							{(p.castMethod === 'yanshu' || p.castMethod === 'baoshu') ? (
							<label className="horosa-liureng-select-field horosa-liureng-select-field-wide">
								<span>{p.castMethod === 'baoshu' ? '报数/字数/笔画' : '演数·随感之数'}</span>
								<input type='number' value={p.yanShuNum} onChange={(e)=>p.onOptionChange('yanShuNum', e.target.value)} placeholder='输入数字' style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, rgba(255,255,255,0.18))', background: 'transparent', color: 'var(--horosa-text, inherit)' }} />
							</label>
							) : null}
							<label className="horosa-liureng-select-field">
								<span>分昼夜</span>
								<Select value={p.fenZhouYe} onChange={(v)=>p.onOptionChange('fenZhouYe', v)} dropdownMatchSelectWidth={false}>
									{FEN_ZHOU_YE_METHODS.map((m)=>(<Option key={m.key} value={m.key}>{m.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>涉害取舍</span>
								<Select value={p.seHaiMethod} onChange={(v)=>p.onOptionChange('seHaiMethod', v)} dropdownMatchSelectWidth={false}>
									<Option value="app">仅下贼上(默认)</Option>
									<Option value="standard">标准深浅两向</Option>
									<Option value="mengzhongji">直取孟仲季</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>涉害起讫</span>
								<Select value={p.seHaiBoundary} onChange={(v)=>p.onOptionChange('seHaiBoundary', v)} dropdownMatchSelectWidth={false}>
									<Option value="app">计起点不计本家(默认)</Option>
									<Option value="both">两端皆计</Option>
									<Option value="neither">皆不计</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>始入课</span>
								<Select value={p.shiRuKe ? '1' : '0'} onChange={(v)=>p.onOptionChange('shiRuKe', v === '1')} dropdownMatchSelectWidth={false}>
									<Option value='0'>并入重审(默认)</Option>
									<Option value='1'>单列·九法变十法</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>取象</span>
								<Select value={p.xiangOn ? '1' : '0'} onChange={(v)=>p.onToggleXiang(v === '1')} dropdownMatchSelectWidth={false}>
									<Option value='0'>关闭</Option>
									<Option value='1'>开启</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>占事类型</span>
								<Select value={p.zhanCategory} onChange={p.onZhanCategoryChange} dropdownMatchSelectWidth={false}>
									{ZHANDUAN_CATEGORIES.map((c)=>(<Option key={c.key} value={c.key}>{c.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>年神排序</span>
								<Select value={p.yearShenShaSort} onChange={(v)=>p.onOptionChange('yearShenShaSort', v)} dropdownMatchSelectWidth={false}>
									<Option value="sanyuan">四利三元序(默认)</Option>
									<Option value="suigui">太岁排轮(太阴异)</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field" title={p.guireng !== 0 ? '星历阳阴系只在贵人体系=六壬法贵人时生效(甲乙丙辛壬癸昼夜互换);当前贵人体系下两档恒同' : undefined}>
								<span>昼夜阳阴归属</span>
								{/* 贵人≠六壬法时置灰:LRConst 只在 guirengType===0 时按此键互换昼夜 */}
								<Select value={p.yinyangSystem} disabled={p.guireng !== 0} onChange={(v)=>p.onOptionChange('yinyangSystem', v)} dropdownMatchSelectWidth={false}>
									<Option value="danmu">旦暮系(默认)</Option>
									<Option value="yinyang">星历阳阴系</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>土旺衰</span>
								<Select value={p.tuWangShuai} onChange={(v)=>p.onOptionChange('tuWangShuai', v)} dropdownMatchSelectWidth={false}>
									<Option value="siji">四季月土旺(默认)</Option>
									<Option value="huotu">火土同宫(土随火)</Option>
								</Select>
							</label>
						</div>
						<div className="horosa-liureng-action-row">
						<Button type='primary' onClick={p.onStartPaiPan}>起课</Button>
						<Button onClick={p.onSaveCase}>保存</Button>
					</div>
				</XQSideSection>
			</div>
		);
	}
}

class LiuRengMain extends Component{
	constructor(props) {
		super(props);
		let now = new DateTime();
		let birth = buildBirthFields(this.props.fields, now);
		// 上次亲手设的排盘口径 —— 只有独立六壬页读;六壬择日里内嵌的那份恒从出厂值起(扫描引擎的钉死口径 = 出厂值,
		// 显示盘必须与扫描判定同口径;工作台口径另经 applyCastFields 下发)。
		const savedSet = this.usesSavedSettings() ? LIURENG_PAGE_SETTINGS.load() : LIURENG_PAGE_SETTINGS.defaults();

		this.state = {
			birth: birth,
			calcBirth: birth,
			liureng: null,
			runyear: null,
			// 起课时间算法:0=真太阳时(缺省=后端历来写死的口径,字节零回归) / 1=直接时间。
			// 此前独立六壬页无此控件、后端写死真太阳时,而三式合一的六壬层时柱取自奇门(奇门吃 timeAlg)
			// → 全局选「直接时间」时,同一时刻两页六壬时柱可分属两个时辰。补控件使两页可对齐。
			timeAlg: savedSet.timeAlg,
			wuxing: '土',
			// 「十二长生五行」的真实缺省是**日干五行**(每次起课回包按日干重置);
			// 此前无「用户已选」记忆 → 用户选了金,一改时间/步进/再起课就被冲回日干五行,载档回灌的值同样守不住。
			// 本标记为 true 后,起课回包不再覆盖(载档回灌带存档值时一并置 true)。
			wuxingUserSet: false,
			guireng: savedSet.guireng,
			castMethod: savedSet.castMethod,
			xuanShiZhi: '',
			yanShuNum: '',
			yueJiangMethod: savedSet.yueJiangMethod,
			fenZhouYe: savedSet.fenZhouYe,
			seHaiMethod: savedSet.seHaiMethod,     // 涉害取舍:app=仅下贼上(默认·已固定)/standard=标准深浅两向/mengzhongji=直取孟仲季
			seHaiBoundary: savedSet.seHaiBoundary,   // 涉害起讫:app=计起点不计本家(默认)/both=两端皆计/neither=皆不计
			shiRuKe: savedSet.shiRuKe,         // 始入课:false=并入重审(默认)/true=单一下贼上单列始入(九法变十法)
			yearShenShaSort: savedSet.yearShenShaSort, // 年神排序:sanyuan=四利三元序(默认)/suigui=太岁排轮(太阴落宫异)
			yinyangSystem: savedSet.yinyangSystem,     // 昼夜阳阴归属:danmu=旦暮系(默认)/yinyang=星历考原阳阴系(A正法甲乙丙辛壬癸昼夜互换)
			tuWangShuai: savedSet.tuWangShuai,        // 土旺衰:siji=四季月18日土旺(默认)/huotu=火土同宫(土随火)
			calcFields: null,
			calcChart: null,
			rightPanelTab: 'dage',
			chartType: readLiurengChartType(),
			xiangOn: readLiurengFlag('liurengXiangOn', false),
			pinnedXiang: null,
			zhanCategory: 'general',
			bifaQuery: '',
		};

		this.unmounted = false;
		this.timeHook = {};
		this.pendingFields = null;
		this.birthYearGanZiCache = {};
		// horosa_kentang_result_cache_v1:命中模块级 LRU(切页往返 0 请求);关闸=每实例独立 Map(旧行为)。
		const lrShareCache = techniqueResultCacheEnabled();
		this.godsCache = lrShareCache ? LIURENG_GODS_MEM : new Map();
		this.godsInflight = lrShareCache ? LIURENG_GODS_INFLIGHT : new Map();
		this.runYearServerCache = lrShareCache ? LIURENG_RUNYEAR_MEM : new Map();
		this.runYearServerInflight = lrShareCache ? LIURENG_RUNYEAR_INFLIGHT : new Map();
		// render 内派生缓存(单槽 last-result)。render() 每次都 buildLiuRengCastOverride(新对象!)+
		// buildLiuRengReferenceBundle(~650行重算)。切右栏 tab(rightTab/activeTab 等)只改无关 state,却让二者整套重跑;
		// 且 castOverride 每次新引用 → 透传给 LiuRengChart 的 CDU 恒判「变」→ d3 整树白重画(越用越卡的真凶)。
		// 按各自实际消费的输入做签名缓存:签名全等 → 复用上次结果(引用稳定,byte-perfect 同输入同输出),
		// LiuRengChart 拿到稳定 castOverride → CDU 不再误触发;任一变 → 真重算重画。kill-switch 复用 chartDrawGuard 闸。
		this._castOverrideCache = null;
		this._refBundleCache = null;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onGuiRengChange = this.onGuiRengChange.bind(this);
		this.onCastMethodChange = this.onCastMethodChange.bind(this);
		this.handleCastField = this.handleCastField.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.requestBirthYearGanZi = this.requestBirthYearGanZi.bind(this);
		this.startPaiPanByFields = this.startPaiPanByFields.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickStartPaiPan = this.clickStartPaiPan.bind(this);
		this.saveLiuRengAISnapshot = this.saveLiuRengAISnapshot.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.onToggleXiang = this.onToggleXiang.bind(this);
		this.handleXiangPick = this.handleXiangPick.bind(this);
		this.onZhanCategoryChange = this.onZhanCategoryChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.startPaiPanByFields(fields || this.props.fields, chartObj);
			};
			// 只换底盘、不起课:择日宿主载入存案后按存案时刻取回的底盘(四课三传由存档复原,不重起;
			// 盘头农历与天地盘随之与存档同一时刻,之后点「起课」也拿得到对得上的底盘)
			this.props.hook.setChart = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				const calcChart = chartObj && chartObj.chart ? chartObj.chart : null;
				if(!fields || !calcChart){
					return;
				}
				this.setState({ calcFields: fields, calcChart });
			};
			// 择日宿主取这一刻的底盘失败:换了起课时刻 / 地点 → 屏上那一课是上一课,清掉(盘区留空);同一课只改设置 → 留存
			this.props.hook.chartUnavailable = (fields)=>{
				if(this.unmounted){ return; }
				this.settleCastChartFailure(fields);
			};
			// 并行预热:fetchByFields 等 /chart 前先把 /liureng/gods 打出去
			// (silent,经 requestDedupe 在途共享)→ 页面总延迟 sum→max。构参走 genGodsParams
			// 同源 → 与 hook 正式请求逐字节同键。失败静默,正式请求自兜底。
			// 择日宿主 pick 前回写工作台口径(贵人体系 guireng/月将法 yueJiangMethod/昼夜阳阴归属 yinyangSystem)
			// 到本页起课选项,让 pick 后显示盘/母快照与命中判定同口径(此前宿主 fields 不透传三键,显示盘按左栏旧档起课)。
			this.props.hook.applyCastFields = (partial)=>new Promise((resolve)=>{
				if(this.unmounted || !partial || typeof partial !== 'object' || !Object.keys(partial).length){ resolve(); return; }
				// 宿主回写过的锁定项不再是「由存案复原」的(见 zeriLockProps 第四参)
				this._zeriRestoredLocks = clearZeriLockMarks(this._zeriRestoredLocks, partial);
				this.setState(partial, resolve);
			});
			// 择日宿主点结果行时回写卜卦人出生(工作台「用事人本命」):盘头行年、右栏本命 / 行年与快照随之按这个人算,
			// 与扫描判本命组条件的是同一个人。出生档即刻生效(草稿 = 已应用),旧行年作废、在途的行年请求作废;之后的起课重取行年
			this.props.hook.applyBirth = (birthFields)=>new Promise((resolve)=>{
				if(this.unmounted || !birthFields || typeof birthFields !== 'object'){ resolve(); return; }
				const birth = buildBirthFields({ ...this.state.birth, ...birthFields }, new DateTime());
				this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;
				this.setState({ birth, calcBirth: birth, runyear: null }, resolve);
			});
			// 择日宿主开始择时前取本页当前起课口径(分昼夜 / 涉害三键等):扫描与点开的课同口径
			this.props.hook.getCastOptions = ()=>{
				if(this.unmounted){ return null; }
				const out = {};
				LIURENG_CAST_STATE_KEYS.forEach((k)=>{ out[k] = this.state[k]; });
				return out;
			};
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){ return; }
				try{
					const params = this.genGodsParams(flds || this.props.fields);
					if(!params){ return; }
					request(`${Constants.ServerRoot}/liureng/gods`, {
						body: JSON.stringify(params),
						silent: true,
					}).catch(()=>null);
				}catch(e){ /* 预热失败无害 */ }
			};
			// R4-B2(horosa_prefetch_registry_v1):/liureng/gods 是确定性纯计算(同时刻恒同神将)
			// → 登记步进预取,武装线(选步长/settle/切页)±depth 全窗经共享调度器构造发出
			// (享白名单闸/latest-wins/预算;S3 收敛:本地裸发路径退役为薄壳,见 prefetchStepSelect)。
			// 🔴 只登记「按时间起课」这条确定性链;六壬页若走随机/摇课起课路径,其参数不经本构造。
			if(stepPrefetchEnabled()){
				this._liurengStepPrefetcher = (steppedFields)=>{
					if(this.unmounted || !steppedFields){
						return [];
					}
					let params = null;
					try{
						params = this.genGodsParams(steppedFields);
					}catch(e){
						return [];
					}
					if(!params){
						return [];
					}
					return [{
						name: 'liureng:gods',
						path: '/liureng/gods',
						run: ()=> request(`${Constants.ServerRoot}/liureng/gods`, {
							body: JSON.stringify(params),
							silent: true,
							retry: { retries: 0 },
						}),
					}];
				};
				registerStepPrefetcher('liureng', this._liurengStepPrefetcher);
			}
		}
	}

	onFieldsChange(field){
		const patch = {
			...(field || {}),
		};
		const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
		const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
		if(hasConfirmedFlag && !confirmed){
			delete patch.__confirmed;
			this.pendingFields = {
				...(this.props.fields || {}),
				...patch,
			};
			return;
		}
		if(hasConfirmedFlag){
			delete patch.__confirmed;
		}
		this.pendingFields = null;
		// 用户拍板: 左栏改过 after23NewDay/guaAfter23NewDay 后,全局事件不再覆盖。(择日内嵌实例只记本实例,不动主页的标志)
		if(field && (Object.prototype.hasOwnProperty.call(field, 'after23NewDay') || Object.prototype.hasOwnProperty.call(field, 'guaAfter23NewDay'))){
			lockDayBoundary(this, 'after23');
			if(this.props.dispatch && !this.props.techniqueScope){
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
		}
		// v2.2.1: 左栏改过 lateZiHourUseNextDay 后,全局事件不再覆盖。
		if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
			lockDayBoundary(this, 'lateZi');
			if(this.props.dispatch && !this.props.techniqueScope){
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
		}
		// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 拉底盘重排),不写主盘
		const scoped = sendScopedFields(this.props, patch);
		if(!scoped && this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
				}
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds.fields,
					__requestOptions: {
						silent: true,
					},
					nohook: !confirmed,
				},
			});
		}
		// 即时重算: after23NewDay/guaAfter23NewDay 改变时立即重新起课(不依赖用户手动点起课)
		if(field && (Object.prototype.hasOwnProperty.call(field, 'after23NewDay') || Object.prototype.hasOwnProperty.call(field, 'guaAfter23NewDay'))){
			const updatedFields = { ...(this.props.fields || {}), ...patch };
			this.requestGods(updatedFields);
		}
	}

	onChartTypeChange(value){
		this.setState({
			chartType: value,
		});
	}

	onBirthChange(field){
		const patch = {
			...(field || {}),
		};
		if(Object.prototype.hasOwnProperty.call(patch, '__confirmed')){
			delete patch.__confirmed;
		}
		const flds = {
			...this.state.birth,
			...patch,
		};
		this.setState({
			birth: flds,
			// 出生档变更即作废旧行年:不清则改卜卦人信息后、后端行年归来前,旧档行年
			// 滞留 state——resolveDisplayRunYear 的 ±1 岁容差(立春界/岁首口径正常差)会放行改生年
			// ±1 场景的旧值。清空 → 本地年差法全量接管,起课/快照/render 三路即刻一致。
			runyear: null,
		});
	}

	startPaiPanByFields(fields, chartObj){
		const calcFields = fields || this.props.fields;
		// 底盘只认与本次起课同一时刻地点的那张(castChartFor):对不上就是上一刻的底盘(主盘在途 / 取失败),不拿它起这一课
		const chartWrap = castChartFor(chartObj === undefined || chartObj === null ? this.props.value : chartObj, calcFields);
		const calcChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		if(!calcFields || !calcChart){
			return;
		}
		// 底盘、起课时刻与课在 requestGods 回包时同一次落定:在途期间屏上仍是上一课的整套,不拼出「新底盘配上一课的课」
		this.requestGods(calcFields, calcChart);
	}

	// 底盘取失败(宿主取不到这一刻的 /chart):与屏上那一课同一起课时刻地点 → 留存;换了时刻 / 地点 → 清掉课与底盘
	// (盘区留空,连同本页 AI 快照槽),在途的起课 / 行年作废 —— 与起课取失败同一口径
	settleCastChartFailure(fields){
		if(!fields || castFailureKeeps(castSourceKey(this.state.calcFields), castSourceKey(fields))){ return; }
		this._godsReqSeq = (this._godsReqSeq || 0) + 1;
		this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;
		this.setState({ liureng: null, runyear: null, calcFields: fields, calcChart: null });
		clearModuleAISnapshot(this.props.techniqueScope || 'liureng');
	}

	// 这一课的底盘:调用方给的(已核过同一时刻)> 屏上那一课的(同一课只改设置)> 主盘(同一时刻才认);都没有 → null
	lessonChartFor(fields, castChart){
		if(castChart){ return castChart; }
		const key = castSourceKey(fields);
		if(key && key === castSourceKey(this.state.calcFields) && this.state.calcChart){ return this.state.calcChart; }
		const wrap = castChartFor(this.props.value, fields);
		return wrap && wrap.chart ? wrap.chart : null;
	}

	// 时间算法 ≠ 真太阳时:起课(天地盘 / 四课 / 三传 / 贵人 / 起课法加临 / 分昼夜 / 十二盘式)与盘头四柱同一时刻。
	// /chart 的农历恒按真太阳时,/liureng/gods 的农历随所选时间算法 —— 此前只有盘头四柱换了口径,选「直接时间」后
	// 盘头写午时、天盘却按巳时转。与三式合一 chartForLr、AI 无头重算同做法(gods 农历覆盖盘的农历)。
	// 两份农历不是同一时刻(改时间后两个请求先后回来)时不合并;按 (chart, gods 农历, 时间算法) 记忆化保持引用稳定
	// (起课缓存与盘面重画判据靠引用)。
	lrChartFor(chart){
		const ta = this.state.timeAlg;
		const ln = this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli : null;
		if(!chart || !ta || !ln || !chart.nongli){ return chart; }
		const a = chart.nongli.clockTime;
		const b = ln.clockTime;
		if(a && b && `${a}`.slice(0, 16) !== `${b}`.slice(0, 16)){ return chart; }
		const m = this._lrChartMemo;
		if(m && m.chart === chart && m.ln === ln && m.ta === ta){ return m.out; }
		const out = { ...chart, nongli: { ...chart.nongli, ...ln } };
		this._lrChartMemo = { chart, ln, ta, out };
		return out;
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		return {
			...(baseFields || this.pendingFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	clickStartPaiPan(){
		// 草稿优先(与三式合一同一口径):时间弹层里改了还没点「确定」的草稿在 pendingFields 里;
		// timeHook 挂在时间栏下方的加减微调控件上,它的值是已确认的时刻 —— 此前它排在前面,把草稿盖回旧时刻
		// (弹层改到 14 点、直接点「起课」,仍按 10 点起)。没有草稿时才用微调控件的值兜底(连点步进、父级还没跟上)。
		const nextFields = this.pendingFields || this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		const currentFields = this.props.fields || {};
		const patchFields = {};
		const patchDateTime = (key)=>{
			if(nextFields[key] && nextFields[key].value instanceof DateTime){
				patchFields[key] = { value: nextFields[key].value.clone() };
			}
		};
		const patchRaw = (key)=>{
			if(nextFields[key] && nextFields[key].value !== undefined){
				patchFields[key] = { value: nextFields[key].value };
			}
		};
		const maybePatchDateTime = (key, format)=>{
			const nextVal = nextFields[key] && nextFields[key].value instanceof DateTime ? nextFields[key].value.format(format) : '';
			const currVal = currentFields[key] && currentFields[key].value instanceof DateTime ? currentFields[key].value.format(format) : '';
			if(nextVal !== currVal){
				patchDateTime(key);
			}
		};
		const maybePatchRaw = (key)=>{
			const nextVal = nextFields[key] && nextFields[key].value !== undefined ? `${nextFields[key].value}` : '';
			const currVal = currentFields[key] && currentFields[key].value !== undefined ? `${currentFields[key].value}` : '';
			if(nextVal !== currVal){
				patchRaw(key);
			}
		};
		maybePatchDateTime('date', 'YYYY-MM-DD HH:mm:ss');
		maybePatchDateTime('time', 'YYYY-MM-DD HH:mm:ss');
		maybePatchRaw('ad');
		maybePatchRaw('zone');
		maybePatchRaw('lon');
		maybePatchRaw('lat');
		maybePatchRaw('gpsLon');
		maybePatchRaw('gpsLat');
		maybePatchRaw('gender');
		maybePatchRaw('after23NewDay');
		const needChartSync = Object.keys(patchFields).length > 0;
		this.pendingFields = null;
		if(needChartSync){
			if(sendScopedFields(this.props, patchFields)){
				return;
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/fetchByFields',
					payload: {
						...currentFields,
						...patchFields,
						__requestOptions: {
							silent: true,
						},
					},
				});
			}
			return;
		}
		this.startPaiPanByFields(nextFields);
	}

	onWuXingChange(val){
		this.setState({
			wuxing: val,
			wuxingUserSet: true,   // 用户明选 → 此后起课不再按日干重置
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng);
		});
	}

	// 只有独立六壬页读写保存值;择日宿主里内嵌的那份(techniqueScope='liurengzeri')不读不写(理由见 LIURENG_PAGE_SETTINGS 注)。
	usesSavedSettings(){
		return (this.props.techniqueScope || 'liureng') === 'liureng';
	}

	// 排盘设置落盘的唯一入口:只在用户亲手改控件的 handler 里调。非设置字段(选时时辰 / 演数数字)丢进来会被忽略。
	persistSetting(partial){
		if(!this.usesSavedSettings()){ return; }
		LIURENG_PAGE_SETTINGS.save(partial);
	}

	// 时间算法改档 → 时柱可变 → 必须真重新起课(不是纯显示层)。
	onTimeAlgChange(val){
		const next = val === 1 ? 1 : 0;
		this.persistSetting({ timeAlg: next });
		this.setState({ timeAlg: next }, ()=>{
			this.requestGods(this.props.fields);
		});
	}

	onGuiRengChange(val){
		this.persistSetting({ guireng: val });
		this.setState({
			guireng: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, val);
		});
	}

	onCastMethodChange(val){
		// 起课法仅改天地盘加临（不动 /chart 计算），同贵人体系：setState 触发重渲染即重排，无需重新起课。
		this.persistSetting({ castMethod: val });
		this.setState({
			castMethod: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		});
	}

	handleCastField(field, val){
		// 选时/演数/换将/分昼夜：同起课法，皆只改天地盘加临或昼夜，不重新起课。
		this.persistSetting({ [field]: val });
		this.setState({ [field]: val }, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		});
	}

	saveLiuRengAISnapshot(params, liureng, runyear, wuxing, guirengType){
		if(!liureng){
			return '';
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return '';
		}
		const chartObj = this.lrChartFor(this.lessonChartFor(flds));
		const finalZone = baseParams.zone !== undefined ? baseParams.zone : (flds && flds.zone ? flds.zone.value : '');
		const finalLon = baseParams.lon !== undefined ? baseParams.lon : (flds && flds.lon ? flds.lon.value : '');
		const finalLat = baseParams.lat !== undefined ? baseParams.lat : (flds && flds.lat ? flds.lat.value : '');
		const saveParams = {
			...baseParams,
			zone: finalZone,
			lon: finalLon,
			lat: finalLat,
		};
		const appliedBirth = getAppliedBirth(this.state);
		// 行年单点收口:七个调用点传入的 runyear 全是 this.state.runyear 裸拍——起课回调
		// 紧跟 requestRunYear(异步)即产快照,改出生档后后端行年未归/静默失败时恒旧;而 render 侧
		// (格局参考)一直过 resolveDisplayRunYear 本地校正 → 页面对、AI 挂载错,两路径不同构。
		// 此处与 render 同构收口:值对=幂等原样过,旧拍/缺失=本地年差法立即兜底,快照第一版即正确。
		const appliedRunYear = resolveDisplayRunYear(runyear, appliedBirth, flds);
		// 此前为 const,下方择日宿主 composeAiSnapshot 重赋值在运行时抛只读错并被 try 吞掉 → 择日三段从未进快照/存档/导出。
		let snapshotText = buildLiuRengSnapshotText(
			saveParams,
			liureng,
			appliedRunYear,
			chartObj,
			guirengType,
			wuxing,
			appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : 1,
			{
				castMethod: this.state.castMethod,
				xuanShiZhi: this.state.xuanShiZhi,
				yanShuNum: this.state.yanShuNum,
				yueJiangMethod: this.state.yueJiangMethod,
				fenZhouYe: this.state.fenZhouYe,
				zhanCategory: this.state.zhanCategory,
				seHaiMethod: this.state.seHaiMethod,
				seHaiBoundary: this.state.seHaiBoundary,
				shiRuKe: this.state.shiRuKe,
				yearShenShaSort: this.state.yearShenShaSort,
				yinyangSystem: this.state.yinyangSystem,
				tuWangShuai: this.state.tuWangShuai,
				solarYear: getSolarYearFromField(flds && flds.date ? flds.date : null),
				...liurengBenmingXingnian(appliedBirth, appliedRunYear),
			}
		);
		// 🔴 全局兜底变量只归主页实例写(extractLiuRengContent 第三优先级消费它;择日内嵌
		// 实例每次起课覆写=主六壬导出降级链吃到择日候选时刻内容,审查实抓)
		if(typeof window !== 'undefined' && (this.props.techniqueScope || 'liureng') === 'liureng'){
			window.__horosa_liureng_snapshot_text = snapshotText;
		}
		// 择日宿主 scope 化:独立快照槽+composeAiSnapshot 拼接择时三段(主页零影响)
		if(typeof this.props.composeAiSnapshot === 'function'){
			try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		saveModuleAISnapshot(this.props.techniqueScope || 'liureng', snapshotText, {
			date: saveParams.date,
			time: saveParams.time,
			zone: saveParams.zone,
			lon: saveParams.lon,
			lat: saveParams.lat,
			castMethod: this.state.castMethod,
			xuanShiZhi: this.state.xuanShiZhi || '',
			yanShuNum: `${this.state.yanShuNum || ''}`,
			yueJiangMethod: this.state.yueJiangMethod,
			fenZhouYe: this.state.fenZhouYe,
		});
		return snapshotText;
	}

	genRunYearParams(){
		let flds = getAppliedBirth(this.state);
		const calcFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const guaDate = calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.format('YYYY-MM-DD') : '';
		const guaTime = calcFields && calcFields.time && calcFields.time.value ? calcFields.time.value.format('HH:mm') : '';
		const guaAd = calcFields && calcFields.ad && calcFields.ad.value !== undefined
			? calcFields.ad.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.ad : 1);
		const guaZone = calcFields && calcFields.zone && calcFields.zone.value
			? calcFields.zone.value
			: (calcFields && calcFields.date && calcFields.date.value ? calcFields.date.value.zone : '');
		const guaLon = calcFields && calcFields.lon ? calcFields.lon.value : '';
		const guaLat = calcFields && calcFields.lat ? calcFields.lat.value : '';
		// 缺键取全局现值(此前写死 0 = 24 点换日,与页面初值 / 全局缺省不同)
		const guaAfter23 = resolveAfter23NewDay(calcFields && calcFields.after23NewDay && calcFields.after23NewDay.value);
		const params = {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gender: flds.gender.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
			guaYearGanZi: resolveGuaYearGanZi(this.state.liureng),
			guaDate: guaDate,
			guaTime: guaTime,
			guaAd: guaAd,
			guaZone: guaZone,
			guaLon: guaLon,
			guaLat: guaLat,
			guaAfter23NewDay: guaAfter23,
		}
		return params;
	}

	genGodsParams(fields){
		let params = null;
		let flds = fields ? fields : this.props.fields;
		if(flds.params){
			let dtparts = flds.params.birth.split(' ');
			params = {
				...flds.params,
				date: dtparts[0],
				time: dtparts[1],
			};

		}else{
			params = {
				date: flds.date.value.format('YYYY-MM-DD'),
				time: flds.time.value.format('HH:mm'),
				zone: flds.date.value.zone,
				ad: flds.date.value.ad,
				lon: flds.lon.value,
				lat: flds.lat.value,
			};
		}
		// 起课时间算法随参送出(后端缺省 RealSun;三条取盘路径共用本函数,缓存键随之同构)。
		// 择日内嵌恒真太阳时(扫描口径;旧存案带来的直接时间只用于照存档显示)
		params.timeAlg = this.props.techniqueScope ? 0 : (this.state.timeAlg === 1 ? 1 : 0);
		// 关键: backend liureng/gods 缺这个会用 默认值 1, 导致 dropdown 切换无效。
		if(flds.after23NewDay && flds.after23NewDay.value !== undefined){
			params.after23NewDay = flds.after23NewDay.value;
		}
		if(flds.guaAfter23NewDay && flds.guaAfter23NewDay.value !== undefined){
			params.guaAfter23NewDay = flds.guaAfter23NewDay.value;
		}
		// v2.2.1 第二全局开关·晚子时·时柱起干
		if(flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined){
			params.lateZiHourUseNextDay = flds.lateZiHourUseNextDay.value;
		}else{
			params.lateZiHourUseNextDay = defaultLateZiHourUseNextDay();
		}

		return params;
	}

	// R4-B2(S3 收敛):选步长即预取改走武装引擎 —— ±depth 全窗任务(gods 经登记表构造 +
	// /chart 主链)统一由共享调度器排队(享白名单闸/latest-wins/预算/连点保底),不再本地
	// 裸发(的 ±1 双向裸 request 语义被 ±depth 超集覆盖;5s 去重由武装线沿用)。
	prefetchStepSelect(unit){
		try{
			if(!stepPrefetchEnabled() || !stepSelectPrefetchEnabled() || !unit){ return; }
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			armStepPrefetch('unit-select', { unit });
		}catch(e){ /* 预取失败无害 */ }
	}

	async requestBirthYearGanZi(){
		const flds = getAppliedBirth(this.state);
		if(!flds || !flds.date || !flds.time){
			return '';
		}
		const key = [
			flds.date.value.format('YYYY-MM-DD'),
			flds.time.value.format('HH:mm'),
			flds.date.value.ad,
			flds.date.value.zone,
			flds.lon.value,
			flds.lat.value,
			flds.after23NewDay.value,
		].join('|');
		if(this.birthYearGanZiCache[key]){
			return this.birthYearGanZiCache[key];
		}
		const localHit = getBirthGanzhiLocalCache(key);
		if(localHit){
			this.birthYearGanZiCache[key] = localHit;
			return localHit;
		}
		const params = {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			after23NewDay: flds.after23NewDay.value,
			lateZiHourUseNextDay: flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		};
		try{
			const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			});
			const lr = data && data[Constants.ResultKey] ? data[Constants.ResultKey].liureng : null;
			const ganzi = extractGanZi(
				lr && lr.fourColumns && lr.fourColumns.year ? lr.fourColumns.year.ganzi : ''
			) || extractGanZi(lr && lr.nongli ? (lr.nongli.yearGanZi || lr.nongli.yearJieqi || lr.nongli.year) : '');
			if(ganzi){
				this.birthYearGanZiCache[key] = ganzi;
				setBirthGanzhiLocalCache(key, ganzi);
			}
			return ganzi;
		}catch(e){
			return '';
		}
	}

	async requestGods(fields, castChart){
		if(fields === undefined || fields === null){
			return;
		}
		const chart = this.lessonChartFor(fields, castChart);
		// 择日内嵌重起:本页时间算法回到真太阳时(旧存案照存档显示的直接时间到此为止)
		if(this.props.techniqueScope && this.state.timeAlg !== 0){
			this.setState({ timeAlg: 0 });
		}
		// 请求代次:只认最后一次起课(在途的起课晚回,会盖掉之后载入的存档课 / 之后再起的课);载入存案复原课时同样推进代次
		const seq = (this._godsReqSeq = (this._godsReqSeq || 0) + 1);
		const params = this.genGodsParams(fields);
		const godsKey = buildCacheKey(params);
		let result = null;
		if(godsKey && this.godsCache.has(godsKey)){
			result = clonePlain(this.godsCache.get(godsKey));
		}else if(godsKey && this.godsInflight.has(godsKey)){
			result = clonePlain(await this.godsInflight.get(godsKey));
		}else{
			const req = request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			}).then((data)=>{
				return data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			}).finally(()=>{
				if(godsKey){
					this.godsInflight.delete(godsKey);
				}
			});
			if(godsKey){
				this.godsInflight.set(godsKey, req);
			}
			result = await req;
			if(godsKey && result){
				pushCache(this.godsCache, godsKey, clonePlain(result), 72);
			}
		}
		if(seq !== this._godsReqSeq){
			return;
		}
		if(!result || !result.liureng){
			// 取失败:与屏上那一课同一起课时刻地点(只改了设置)→ 留存;换了时刻 / 地点 → 屏上那一课是上一课,
			// 清掉(连同本页 AI 快照槽),盘面回到「这一刻的底盘、课还没起出来」;之后同一组参数照常重取
			if(!castFailureKeeps(castSourceKey(this.state.calcFields), castSourceKey(fields))){
				this.setState({ liureng: null, runyear: null, calcFields: fields, calcChart: chart });
				clearModuleAISnapshot(this.props.techniqueScope || 'liureng');
			}
			return;
		}
		
		let dayGanZi = result.liureng.nongli.dayGanZi;
		let dayGan = dayGanZi.substr(0, 1);
		// 缺省随日干五行;但用户手选过(或载档带来存档值)之后不得再覆盖 —— 此前每次
		// 起课(含改时间、步进一格)都无条件重置,所选五行守不住,右栏十二长生表与取象卡随之跳回。
		let wx = this.state.wuxingUserSet ? this.state.wuxing : LRConst.GanZiWuXing[dayGan];
		const appliedBirth = buildBirthFields(this.state.birth, new DateTime());
		const st = {
			liureng: result.liureng,
			calcBirth: appliedBirth,
			wuxing: wx,
			calcFields: fields,
			calcChart: chart,
		};

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:六壬「画完」= 主盘(本次 st)+ 右栏「流年」段(requestRunYear 的
			// 二段 setState)都落定,按 owner 口径(中栏+右栏全画完)记的是后者。requestRunYear 有多条
			// 早退分支(liureng 为空 / 缺日期 / 年份校验 Modal),挂在其 promise 上两态都能收口;
			// markPanelReady 自带 generation 去重,重复调用为空操作。
			const markReady = ()=>{ markPanelReady('liureng'); };
			Promise.resolve(this.requestRunYear()).then(markReady, markReady);
			this.saveLiuRengAISnapshot(params, result.liureng, this.state.runyear, wx, this.state.guireng);
		});
	}

	async requestRunYear(){
		if(this.state.liureng === null){
			return;
		}
		// 请求代次(与起课同法):只认最后一次取行年 —— 连点步进跨年 / 连改出生档时,旧参数的行年晚回不得盖掉新值;
		// 每个 await 之后都判,载入存案复原行年时同样推进代次
		const seq = (this._runYearReqSeq = (this._runYearReqSeq || 0) + 1);
		const stale = ()=>seq !== this._runYearReqSeq || this.unmounted;
		
		const params = this.genRunYearParams();
		const fields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!fields || !fields.date || !fields.date.value){
			return;
		}
		const birthFields = getAppliedBirth(this.state);
		if(!birthFields || !birthFields.date || !birthFields.date.value){
			return;
		}
		const birthSolarYear = getSolarYearFromField(birthFields.date);
		const guaSolarYear = getSolarYearFromField(fields.date);
		// 带符号天文年比较(公元前 3044 早于公元前 3040):绝不能用 abs 年,BC 侧会反向误判
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && birthSolarYear > guaSolarYear){
			Modal.error({
				title: '出生年份必须小于卜卦年份'
			});
			return;
		}
		const genderVal = birthFields && birthFields.gender ? birthFields.gender.value : 1;
		let fallbackRunYear = null;
		if(Number.isFinite(birthSolarYear) && Number.isFinite(guaSolarYear) && guaSolarYear >= birthSolarYear){
			const age = guaSolarYear - birthSolarYear;
			const ageCycle = ((age % 60) + 60) % 60;
			const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
			fallbackRunYear = {
				age: age,
				ageCycle: ageCycle,
				year: yearList[ageCycle] || '',
			};
		}
		if(!params.guaYearGanZi && !fallbackRunYear){
			Modal.error({
				title: '无法识别卜卦年份干支，请先起课后再试',
			});
			return;
		}

		let result = fallbackRunYear ? { ...fallbackRunYear } : {};
		const runyearKey = buildCacheKey(params);
		try{
			// horosa_liureng_render_slice_v1(L4):步进尾延迟里 /liureng/runyear 与 requestBirthYearGanZi
			// 的 /liureng/gods(生辰年干支)原为串行两段 await,而二者互不相依 —— 端点不同、入参不同
			// (前者吃 生辰+卦年干支,后者只吃生辰)、结果各归各家(serverRes/runYearServerCache vs
			// birthYearGanZiCache),中间无共享可变量。仿 SanShiUnitedMain 奇门∥太乙范式:两 promise
			// 先各自起、Promise.all 等齐,缓存命中侧照旧零请求。错误隔离与串行版同义:birthGanZi 侧
			// 自带 try/catch 恒返 ''(绝不 reject);runyear 侧 reject 仍落本 catch 走 fallbackRunYear。
			// 注意:外层 gods→requestRunYear 的先后是真数据依赖(本函数参数 guaYearGanZi 取自 gods
			// 结果落的 state.liureng),不得并行,维持原序。
			const serverResPromise = (async ()=>{
				let serverRes = {};
				const localRunyearHit = runyearKey ? getLiurengRunyearLocalCache(runyearKey) : null;
				if(runyearKey && this.runYearServerCache.has(runyearKey)){
					serverRes = clonePlain(this.runYearServerCache.get(runyearKey)) || {};
				}else if(runyearKey && this.runYearServerInflight.has(runyearKey)){
					serverRes = clonePlain(await this.runYearServerInflight.get(runyearKey)) || {};
				}else if(localRunyearHit){
					serverRes = clonePlain(localRunyearHit) || {};
					pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
				}else{
					const req = request(`${Constants.ServerRoot}/liureng/runyear`, {
						body: JSON.stringify(params),
						silent: true,
					}).then((data)=>{
						return data && data[Constants.ResultKey] ? { ...data[Constants.ResultKey] } : {};
					}).finally(()=>{
						if(runyearKey){
							this.runYearServerInflight.delete(runyearKey);
						}
					});
					if(runyearKey){
						this.runYearServerInflight.set(runyearKey, req);
					}
					serverRes = await req;
					if(runyearKey){
						pushCache(this.runYearServerCache, runyearKey, clonePlain(serverRes), 96);
						setLiurengRunyearLocalCache(runyearKey, clonePlain(serverRes));
					}
				}
				return serverRes;
			})();
			const [serverRes, birthGanZi] = await Promise.all([serverResPromise, this.requestBirthYearGanZi()]);
			// 请求代次(同上游「每个 await 之后都判」):并行版两段取数只在这一个 await 点汇合,判据并在此处。
			if(stale()){ return; }
			result = {
				...serverRes,
				...result,
			};
			const guaGanZi = extractGanZi(params.guaYearGanZi) || resolveGuaYearGanZi(this.state.liureng);
			let localRunYear = calcRunYearLocal(
				birthGanZi,
				guaGanZi,
				genderVal,
				birthSolarYear,
				guaSolarYear
			);
			if(!localRunYear && fallbackRunYear){
				localRunYear = fallbackRunYear;
			}
			if(!localRunYear && serverRes.age !== undefined && serverRes.age !== null){
				const age = Number(serverRes.age);
				if(Number.isFinite(age)){
					const ageCycle = ((age % 60) + 60) % 60;
					const yearList = `${genderVal}` === '0' ? FemaleRunYearList : MaleRunYearList;
					localRunYear = {
						age: age,
						ageCycle: ageCycle,
						year: yearList[ageCycle] || serverRes.year || '',
					};
				}
			}
			if(localRunYear){
				result.year = localRunYear.year;
				result.age = localRunYear.age;
				result.ageCycle = localRunYear.ageCycle;
			}
		}catch(e){
			if(fallbackRunYear){
				result = {
					...result,
					...fallbackRunYear,
				};
			}
		}
		if(fallbackRunYear){
			if(result.year === undefined || result.year === null || result.year === ''){
				result.year = fallbackRunYear.year;
			}
			if(result.age === undefined || result.age === null || Number.isNaN(Number(result.age))){
				result.age = fallbackRunYear.age;
			}
			if(result.ageCycle === undefined || result.ageCycle === null || Number.isNaN(Number(result.ageCycle))){
				result.ageCycle = fallbackRunYear.ageCycle;
			}
		}
		
		if(stale()){ return; }
		const st = {
			runyear: result,
		};

		this.setState(st, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, result, this.state.wuxing, this.state.guireng);
		});
	}

	// 事盘回放(2026-07-05 储存审计补):此前六壬事盘存了全部 13 项设置却打不回页面——
	// 打开已存事盘时把课盘数据+每技法设置整体回放(与 太乙/奇门/卦占 同范式);
	// cid|updateTime 去重防重复回放;快照原样回写(保存时刻的真值,零重算漂移)。
	restoreFromCurrentCase(force){
		// 🔴 按本实例 scope 取事盘(曾硬编码 'liureng':择日宿主实例也吃主六壬事盘——初始盘
		// 被劫持+事盘快照原样冲进 'liurengzeri' 槽,审查实抓;DunJiaMain scope 判同律)
		const saved = getKentangSavedCasePayload(this.props.techniqueScope || 'liureng');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const p = saved.payload;
		this.lastRestoredCaseId = saved.caseVersion;
		// zhanCategory(占测事项)必须与存档侧成对 —— 缺它则载回后占断退回「通用」,与存档内的快照打架。
		const optionKeys = ['guireng', 'wuxing', 'timeAlg', 'castMethod', 'xuanShiZhi', 'yanShuNum', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai', 'zhanCategory'];
		const next = {};
		optionKeys.forEach((key)=>{
			if(p[key] !== undefined && p[key] !== null){
				next[key] = p[key];
			}
		});
		// 事盘里没有的口径键回出厂值,不沿用本机保存的偏好(见 pageSettingsStore.fillMissing 注)
		Object.assign(next, LIURENG_PAGE_SETTINGS.fillMissing(next));
		// 存档带 wuxing → 视同用户已选,载回后不被下一次起课按日干冲掉。
		if(next.wuxing !== undefined){ next.wuxingUserSet = true; }
		if(p.liureng){
			next.liureng = p.liureng;
			this._godsReqSeq = (this._godsReqSeq || 0) + 1;   // 在途的起课作废:课由存档复原
		}
		if(p.runyear !== undefined && p.runyear !== null){
			next.runyear = p.runyear;
			this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;   // 在途的行年作废:行年由存档复原
		}
		// 出生档回灌(birth=草稿、calcBirth=已应用),行年/本命按存档出生档校正,不再被当前档覆盖。
		const restoredBirth = deserializeBirthDraft(p.birthDraft);
		if(restoredBirth){
			next.birth = restoredBirth;
			next.calcBirth = buildBirthFields(restoredBirth, new DateTime());
		}
		if(!Object.keys(next).length){
			return false;
		}
		// 择日内嵌:记下哪些锁定项是由存案复原成非扫描口径的(显式标记;控件据此解锁并写明,别的入口改掉锁定项不算)
		if(this.props.zeriLocked){ this._zeriRestoredLocks = zeriRestoredLockMarks(this.props.zeriLocked, next); }
		if(this.props.techniqueScope){
			// 择日内嵌:时间算法不出控件、扫描恒按真太阳时。旧事盘带来的直接时间先照存档显示(盘面 / 快照是按它起的),
			// 下一次起课按真太阳时(genGodsParams 内嵌恒 0,并把本页时间算法改回)
			// 载入存案 = 按存案看盘:宿主覆盖层换成存案那一刻的时间地点(此前亲手改的作废),左栏与下一次起课都回到存案;
			// 盘面由存档复原,宿主因此重渲染带来的日界变化不触发重起
			// 存案取不出时间地点(补丁为空)时宿主 fields 可能不变,不置跳过标记 —— 否则标记留到下一次真实变化,把那次重起吞掉
			const casePatch = getKentangSavedCaseFieldsPatch(this.props.techniqueScope) || {};
			if(sendScopedFields(this.props, casePatch, { replace: true, recompute: false }) && Object.keys(casePatch).length){
				this._skipNextAfter23Recompute = true;
			}
		}
		this.setState(next, ()=>{
			if(p.snapshot){
				saveModuleAISnapshot(this.props.techniqueScope || 'liureng', p.snapshot);
			}
		});
		return true;
	}

	clickSaveCase(){
		if(!this.state.liureng){
			message.warning('请先完成起课后再保存');
			return;
		}
		const flds = this.state.calcFields ? this.state.calcFields : this.props.fields;
		if(!flds){
			return;
		}
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, getAppliedBirth(this.state), flds);
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		// 择日宿主内按宿主键(liurengzeri)存档:module/caseType/sourceModule 同宿主键,快照取宿主槽(含择时段)。
		const lrScope = this.props.techniqueScope || 'liureng';
		// 先请本页按此刻所见重存再读(择日宿主刚出的择时结果经 composeAiSnapshot 并入;直读槽 = 扫描前的旧文)
		const snapshot = loadFreshModuleAISnapshot(lrScope);
		const payload = {
			module: lrScope,
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: displayRunYear,
			wuxing: this.state.wuxing,
			timeAlg: this.state.timeAlg,
			guireng: this.state.guireng,
			castMethod: this.state.castMethod,
			xuanShiZhi: this.state.xuanShiZhi,
			yanShuNum: this.state.yanShuNum,
			yueJiangMethod: this.state.yueJiangMethod,
			fenZhouYe: this.state.fenZhouYe,
			seHaiMethod: this.state.seHaiMethod,
			seHaiBoundary: this.state.seHaiBoundary,
			shiRuKe: this.state.shiRuKe,
			yearShenShaSort: this.state.yearShenShaSort,
			yinyangSystem: this.state.yinyangSystem,
			tuWangShuai: this.state.tuWangShuai,
			zhanCategory: this.state.zhanCategory,
			// 起课法「九-十二客/行年加时/本命加时」在无头重算时需要本命支/行年支/公历年——
			// 页面起课经 liurengBenmingXingnian(本命档, 行年) 得到,存档此前不带 → AI 挂载重算静默退正时正将而标注仍打所选法。
			solarYear: getSolarYearFromField(flds && flds.date ? flds.date : null),
			...liurengBenmingXingnian(getAppliedBirth(this.state), displayRunYear),
			// 卜卦人出生档随存(此前不存不载 → 载回后行年/本命按当前出生档(缺省=占时)重算覆盖存档)。
			birthDraft: serializeBirthDraft(getAppliedBirth(this.state)),
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `${lrScope === 'liurengzeri' ? '六壬择日' : '六壬占断'} ${divTime}`,
						caseType: lrScope,
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						// 事盘 gender 曾取「时间与地点」区写的全局 fields.gender,而本页盘面/行年/实时快照
						//   的性别全取「卜卦人出生时间」区 → 无头重算(regenerateLiurengSnapshot 第 7 参=record.gender)的
						//   「问测人性别」可与同快照内行年顺逆矛盾。改取卜卦人性别(0/1),未填时才回落全局值。
						gender: liurengCaseGender(getAppliedBirth(this.state), flds),
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: lrScope,
					},
				},
			});
		}
	}

	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再覆盖
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			window.addEventListener('horosa:liureng-xiang-pick', this.handleXiangPick);
		}		this.restoreFromCurrentCase(true);
	}

	componentDidUpdate(prevProps, prevState){
		// 择日宿主:本页起课口径变了(亲手改 / 宿主回写 / 载入存案)→ 告诉宿主,宿主按同一套过期判据重算「结果已过期」
		if(this.props.onPageCalibreChange && prevState && LIURENG_CAST_STATE_KEYS.some((k)=>prevState[k] !== this.state[k])){
			this.props.onPageCalibreChange();
		}
		// 时间弹层里没点「确定」的草稿只对当时那张盘有效:fields 从外面换了(载入别的盘 / 此刻起课 / 择日点选)
		// 就作废,否则再点「起课」会拿旧草稿(连同旧地点)盖掉新盘
		if(prevProps && timeGeoFieldsChanged(prevProps.fields, this.props.fields)){
			this.pendingFields = null;
		}
		// 择日内嵌载入存案引起的那一次 fields 变化:盘面由存档复原,不重起。先判后还原 —— 本轮还原新置的标记
		// 留给下一轮(覆盖层生效那一轮);此前同一轮里置了就被本轮(宿主重渲染换了 fields 引用)用掉
		const skipRecompute = !!(this._skipNextAfter23Recompute && prevProps && prevProps.fields !== this.props.fields);
		if(skipRecompute){ this._skipNextAfter23Recompute = false; }
		this.restoreFromCurrentCase();
		if(skipRecompute){
			return;
		}
		// 即时重算: 当 props.fields.after23NewDay 通过全局设置 sync 改变时自动重新起课。
		// 用户拍板: 左栏已改过则跳过(最高权限)。
		if(dayBoundaryLockHeld(this, 'after23')) return;
		const prev = prevProps && prevProps.fields && prevProps.fields.after23NewDay;
		const curr = this.props && this.props.fields && this.props.fields.after23NewDay;
		if(prev && curr && prev.value !== curr.value){
			this.requestGods(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._liurengStepPrefetcher){
			unregisterStepPrefetcher('liureng', this._liurengStepPrefetcher);
			this._liurengStepPrefetcher = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			window.removeEventListener('horosa:liureng-xiang-pick', this.handleXiangPick);
		}
	}

	// 取象：左栏开关（localStorage 持久化），默认关 → 零回归。
	onToggleXiang(checked){
		const on = !!checked;
		safeLocalStorageSet('liurengXiangOn', on ? '1' : '0');
		this.setState({ xiangOn: on });
	}

	// 占断向导：切换占事类型 → 重建 AI 快照（令 AI 针对性解读）。
	onZhanCategoryChange(val){
		this.setState({ zhanCategory: val }, ()=>{
			if(this.state.liureng){
				this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
			}
		});
	}

	// 取象：接收盘面点击事件 → 钉住该元素的类象卡；再次点同一元素则取消。仅在「取象」开启时响应。
	handleXiangPick(evt){
		if(!this.state.xiangOn){
			return;
		}
		const detail = evt && evt.detail ? evt.detail : null;
		if(!detail || !detail.branch){
			return;
		}
		const cur = this.state.pinnedXiang;
		if(cur && cur.branch === detail.branch && cur.role === (detail.role || '') && (cur.jiang || '') === (detail.jiang || '')){
			this.setState({ pinnedXiang: null });
			return;
		}
		this.setState({
			pinnedXiang: {
				branch: detail.branch,
				secondBranch: detail.secondBranch || '',
				jiang: detail.jiang || '',
				role: detail.role || '',
				dayGan: detail.dayGan || '',
			},
			rightPanelTab: 'xiang',
		});
	}

	renderXiangTab(refCtx){
		const xiangOn = this.state.xiangOn;
		const pin = this.state.pinnedXiang;
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const sectionTitle = { fontWeight: 600, margin: '8px 0 4px' };
		const sectionBody = { color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' };
		const sanChuanData = (refCtx && Array.isArray(refCtx.sanChuanBranches) && refCtx.sanChuanBranches.length >= 3) ? {
			branches: refCtx.sanChuanBranches,
			gans: refCtx.sanChuanGans || [],
			dayGan: refCtx.dayGan || '',
			dayZhi: refCtx.dayZhi || '',
			xunKong: refCtx.xunKongBranches || [],
		} : null;
		const sanChuanCard = sanChuanData ? (
			<Card size='small' style={{ marginBottom: 8 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
					<span style={{ fontWeight: 600 }}>三传关系{refCtx && refCtx.courseName ? `　${refCtx.courseName}` : ''}</span>
					<Tag color='geekblue'>初→中→末</Tag>
				</div>
				<LRSanChuanRelationMini data={sanChuanData} />
			</Card>
		) : null;
		let xiangBody;
		if(!xiangOn){
			xiangBody = (<Card size='small'><div style={muted}>在左栏开启「取象」后，点击盘中地支 / 天将，即可查看其类象、五行、六亲、刑冲合害与旺衰。</div></Card>);
		}else if(!pin){
			xiangBody = (<Card size='small'><div style={muted}>点击盘中地支 / 天将以钉住其类象。</div></Card>);
		}else{
			const cx2 = buildXiangContext(pin.branch, pin.dayGan, this.state.wuxing);
			if(!cx2){
				xiangBody = (<Card size='small'><div style={muted}>暂无「{pin.branch}」的类象数据。</div></Card>);
			}else{
				const rows = [];
				if(cx2.wuxing){ rows.push(['五行', cx2.wuxing + (cx2.wuxingXiang ? `（${cx2.wuxingXiang.keyword}）` : '')]); }
				if(cx2.direction){ rows.push(['方位', cx2.direction]); }
				if(cx2.liuqin){ rows.push(['六亲', cx2.liuqin]); }
				if(cx2.zhangsheng){ rows.push([`${cx2.zhangshengElem}·长生`, cx2.zhangsheng]); }
				if(cx2.yima){ rows.push(['驿马', cx2.yima]); }
				if(pin.jiang){ rows.push(['天将', pin.jiang]); }
				const labelStyle = { color: 'var(--horosa-muted, #8c8c8c)', minWidth: 64, display: 'inline-block' };
				xiangBody = (
					<Card size='small'>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600, fontSize: 15 }}>{cx2.branch}{cx2.shenName ? `　${cx2.shenName}` : ''}</span>
							<Tag color='gold'>取象</Tag>
						</div>
						{rows.map(([k, v], i)=>(<div key={i} style={{ lineHeight: '24px' }}><span style={labelStyle}>{k}</span><span>{v}</span></div>))}
						{cx2.symbol ? (<><div style={sectionTitle}>类象</div><div style={sectionBody}>{cx2.symbol}</div></>) : null}
						{cx2.relations && cx2.relations.length ? (<><div style={sectionTitle}>刑冲合害</div><div style={sectionBody}>{cx2.relations.join('　')}</div></>) : null}
						{cx2.relationNotes && cx2.relationNotes.length ? (<><div style={sectionTitle}>刑冲破害合·断用</div><div style={sectionBody}>{cx2.relationNotes.map((r, i)=>(<div key={i} style={{ lineHeight: '20px' }}><span style={{ color: r.type === '蜜中砒霜' ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-accent, #d4a017)', fontWeight: 600 }}>{r.type}</span>：{r.note}</div>))}</div></>) : null}
						{cx2.wuxingXiang ? (<><div style={sectionTitle}>五行取象</div><div style={sectionBody}>{`人物：${cx2.wuxingXiang.person}；身体：${cx2.wuxingXiang.body}；事：${cx2.wuxingXiang.affair}`}</div></>) : null}
						<div style={{ ...muted, fontSize: 12, marginTop: 8 }}>再次点击同一元素可取消钉住。类象供参考，须合盘断之。</div>
					</Card>
				);
			}
		}
		return (<div className="horosa-liureng-reference-tab-body">{sanChuanCard}{xiangBody}</div>);
	}

	// 常用神煞小节（并入「概览」tab 顶部）：后端未直接给出、按日干支可确定的常用神煞 + 吉凶色 + 入课传高亮。
	renderShenShaSection(refCtx){
		if(!refCtx || !refCtx.dayGan){ return null; }
		const gui = detectGuiSpecials(refCtx);
		const list = computeFrontendShenSha(refCtx.dayGan, refCtx.dayZhi, refCtx.courseBranches);
		// 年神(§19.2 四利三元/太岁排轮 by 左栏开关)+ 月神(§19.3),并入概览神煞区。
		const ymList = computeYearShenSha(refCtx.yearBranch, this.state.yearShenShaSort || 'sanyuan', refCtx.courseBranches)
			.concat(computeMonthShenSha(refCtx.monthBranch, refCtx.courseBranches));
		const jc = detectJianChuan(refCtx.sanChuanBranches); // 间传24格/三合全局5局/三会方(§17)
		// 三传旺相休囚死(§20.1,土旺衰 by 左栏开关)
		const WS_COLOR = { '旺': 'var(--horosa-jx-ji, #3fa45b)', '相': 'var(--horosa-jx-he, #5fae6f)', '休': 'var(--horosa-muted,#9a8f7d)', '囚': 'var(--horosa-jx-other, #d08a3a)', '死': 'var(--horosa-jx-xiong, #e2574c)' };
		const wsList = (refCtx.sanChuanBranches || []).map((z, i) => {
			const wx = LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '';
			return { pos: ['初传', '中传', '末传'][i] || '', zhi: z, wx, ws: liurengWangXiang(wx, refCtx.monthBranch, this.state.tuWangShuai) };
		}).filter((x) => x.ws);
		// 空亡真假(§22.1):旬空二支按旺衰判真/假空(旺空假空·衰空真空)。
		const kongList = (refCtx.xunKongBranches || []).map((z) => {
			const wx = LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '';
			const j = judgeKongWang(wx, refCtx.monthBranch, this.state.tuWangShuai);
			return j ? { zhi: z, wx, kind: j.kind, ws: j.ws, basis: j.basis, inSanChuan: (refCtx.sanChuanBranches || []).indexOf(z) >= 0 } : null;
		}).filter(Boolean);
			const kongLoc = analyzeKongLocations(refCtx); // 旬空落点六处 + 陷空(§7.1/§22)
			const dunList = analyzeDunGan(refCtx); // 三传遁干特殊:遁鬼/遁甲/遁癸/遁丁(§7.2)
			const nmList = analyzeNianMing(refCtx); // 年命上神断(§7.3)
			if(!gui.length && !list.length && !ymList.length && !jc && !wsList.length && !kongList.length && !(kongLoc.hits.length || kongLoc.xianKong.length) && !dunList.length && !nmList.length){ return null; }
		const shenShaGrid = (items)=>(
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
				{items.map((s)=>(
					<div key={s.name} title={`${s.brief}（起例所临：${s.branch}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: s.inCourse ? 'rgba(212,160,23,0.12)' : 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: s.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
						<span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.name}</span>
						<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{s.branch}</span>
					</div>
				))}
			</div>
		);
		return (
			<>
				{jc ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>课体结构 · {jc.name}</span>
							<Tag color={jc.luck === 'good' ? 'green' : (jc.luck === 'bad' ? 'red' : 'gold')}>{jc.kind}{jc.wuxing ? `·${jc.wuxing}` : ''}{jc.dir ? `·${jc.dir}间` : ''}</Tag>
						</div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px' }}>{jc.text}</div>
					</Card>
				) : null}
				{wsList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>三传旺衰</span>
							<Tag color='gold'>以月令</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
							{wsList.map((w) => (
								<div key={w.pos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
									<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{w.pos}·{w.zhi}{w.wx}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: WS_COLOR[w.ws] || 'var(--horosa-text,#d8d2c7)' }}>{w.ws}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>旺相=得令、休囚死=失令；土旺衰按左栏开关。</div>
					</Card>
				) : null}
				{kongList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>空亡真假</span>
							<Tag color='gold'>旬空{kongList.map((k) => k.zhi).join('')}</Tag>
						</div>
						{kongList.map((k) => (
							<div key={k.zhi} style={{ lineHeight: '20px' }}>
								<span style={{ color: k.kind === '真空' ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-jx-ji, #3fa45b)', fontWeight: 600 }}>{k.zhi}{k.wx}·{k.kind}</span>
								<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>（{k.ws}{k.inSanChuan ? '·入传' : ''}）</span>
								<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{k.basis}</span>
							</div>
						))}
						{kongLoc.hits.length ? (
							<div style={{ borderTop: '1px dashed var(--horosa-border, rgba(255,255,255,0.12))', marginTop: 6, paddingTop: 6 }}>
								<div style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginBottom: 2 }}>落空之处（六处）</div>
								{kongLoc.hits.map((h) => (
									<div key={h.pos} style={{ lineHeight: '20px' }}><span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 600 }}>{h.pos}{h.branch}空</span><span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{h.note}</span></div>
								))}
							</div>
						) : null}
						{kongLoc.xianKong.length ? (
							<div style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginTop: 4 }}>陷空：{kongLoc.xianKong.map((x) => `${x.god}（临地盘${x.seat}）`).join('、')} 落于空地、虚而不实。</div>
						) : null}
						{kongLoc.allSanChuanKong ? (
							<div style={{ fontSize: 12, color: 'var(--horosa-jx-xiong, #e2574c)', marginTop: 4 }}>三传全空——守干上旺禄、勿轻动。</div>
						) : null}
					</Card>
				) : null}
					{dunList.length ? (
						<Card size='small' style={{ marginBottom: 8 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
								<span style={{ fontWeight: 600 }}>遁干特殊</span>
								<Tag color='volcano'>暗神</Tag>
							</div>
							{dunList.map((d) => (
								<div key={d.pos} style={{ lineHeight: '22px' }}>
									<span style={{ fontWeight: 600, color: 'var(--horosa-text, #d8d2c7)' }}>{d.pos}{d.branch}</span>
									{d.gan ? (<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>　遁{d.gan}{d.liuqin ? `·${d.liuqin}` : ''}</span>) : null}
									{d.flags.map((f) => (<Tag key={f} color={f === '遁鬼' ? 'red' : 'orange'} style={{ marginLeft: 6, transform: 'scale(0.82)' }}>{f}</Tag>))}
									<div style={{ color: 'var(--horosa-text-soft, #595959)', fontSize: 13 }}>{d.note}</div>
								</div>
							))}
							<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 4 }}>遁干藏支下不显（暗）；遁鬼防隐险、遁甲主端绪、遁癸主闭塞、遁丁主动。</div>
						</Card>
					) : null}
					{nmList.length ? (
						<Card size='small' style={{ marginBottom: 8 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
								<span style={{ fontWeight: 600 }}>年命上神</span>
								<Tag color='gold'>行年·本命</Tag>
							</div>
							{nmList.map((n) => (
								<div key={n.label} style={{ lineHeight: '22px' }}>
									<span style={{ fontWeight: 600, color: n.isKong ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-text, #d8d2c7)' }}>{n.label}{n.branch}</span>
									<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{n.note}</span>
								</div>
							))}
						</Card>
					) : null}
				{gui.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>贵神特殊态</span>
							<Tag color='red'>留意</Tag>
						</div>
						{gui.map((g)=>(<div key={g.type} style={{ lineHeight: '22px' }}><span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 600 }}>{g.type}</span>　<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>{g.note}</span></div>))}
					</Card>
				) : null}
				{list.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>常用神煞</span>
							<Tag color='gold'>按日干支</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
							{list.map((s)=>(
								<div key={s.name} title={`${s.brief}（起例所临：${s.branch}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: s.inCourse ? 'rgba(212,160,23,0.12)' : 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: s.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
									<span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.name}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{s.branch}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>金色边框＝该神煞所临之支已入课传。神煞仅供参考，须合盘断之。</div>
					</Card>
				) : null}
				{ymList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>年月神煞</span>
							<Tag color='gold'>按年支·月建</Tag>
						</div>
						{shenShaGrid(ymList)}
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>年神＝四利三元序（左栏可切太岁排轮）；月神＝以月建起。天德值或为天干。</div>
					</Card>
				) : null}
			</>
		);
	}

	// 毕法 tab：已命中（仅高置信 A 档自动命中）+ 全部毕法可检索浏览。
	renderBiFaTab(refCtx){
		const hits = refCtx ? matchBiFa(refCtx) : [];
		const all = filterBiFaListByQuery(BIFA_LIST, this.state.bifaQuery);
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const XINJUE_NOS = [93, 94, 96, 97, 98, 99, 100]; // 断法通则 / 占则，无单课盘面成局条件，仅浏览
		return (
			<div className="horosa-liureng-reference-tab-body">
				<div style={{ fontWeight: 600, margin: '2px 0 6px' }}>已命中</div>
				{hits.length ? hits.map((item)=>(
					<Card key={`bf_hit_${item.no}`} size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
							<span style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}</span>
							<Tag color='volcano'>毕法</Tag>
						</div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' }}>{item.explain}</div>
						{item.evidence && item.evidence.length ? (<div style={{ ...muted, fontSize: 12, marginTop: 4 }}>依据：{item.evidence.join('；')}</div>) : null}
					</Card>
				)) : (<Card size='small'><div style={muted}>本盘暂未机械命中可判定之毕法（仅高置信条目自动命中）。</div></Card>)}
				<div style={{ fontWeight: 600, margin: '12px 0 6px' }}>{`全部毕法（${BIFA_LIST.length} 条）`}</div>
				<input value={this.state.bifaQuery} onChange={(e)=>this.setState({ bifaQuery: e.target.value })} placeholder='检索法名 / 关键词' style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, rgba(255,255,255,0.18))', background: 'transparent', color: 'var(--horosa-text, inherit)', marginBottom: 8 }} />
					<Card size='small' style={{ marginBottom: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))' }}>
						<div style={{ fontWeight: 600, marginBottom: 4 }}>异文校勘<Tag color='gold' style={{ marginLeft: 6, transform: 'scale(0.82)' }}>百法</Tag></div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', fontSize: 13, lineHeight: '20px' }}>
							各本于条数（一百）、次第、绝大多数文字高度一致，惟数处异文：<br />
							· 第 8 法「不正」或作「不专」；<br />
							· 第 37 法「三等论」或作「三等讼」（以「论」为正）；<br />
							· 第 38 法「卦体」或作「课体」；<br />
							· 第 51／52 法各本常误编，正为 51「魁度天门」、52「罡塞鬼户」。
						</div>
					</Card>
				{all.map((item)=>(
					<div key={`bf_${item.no}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--horosa-border, rgba(255,255,255,0.06))' }}>
						<div style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}{XINJUE_NOS.indexOf(item.no) >= 0 ? (<span style={{ ...muted, fontSize: 11, marginInlineStart: 6 }}>（读法心诀·通则）</span>) : (item.tier !== 'A' ? (<span style={{ ...muted, fontSize: 11, marginInlineStart: 6 }}>（须人工核）</span>) : null)}</div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px', fontSize: 13 }}>{item.explain}</div>
					</div>
				))}
				<div style={{ ...muted, fontSize: 12, marginTop: 8 }}>断诀烈度须合时令旺衰、年命制化，非定数。</div>
			</div>
		);
	}

	// 占断 tab：按左栏所选占事类型，给主用神 / 用神落点 / 关键神将 / 宜忌 / 三传提示。
	renderZhanDuanTab(refCtx){
		const key = this.state.zhanCategory;
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const yq = computeYingQi(refCtx);
		const yingQiCard = yq.length ? (
			<Card size='small' style={{ marginTop: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 4 }}>应期（参考方向，非定论）</div>
				{yq.map((m)=>(<div key={m.method} style={{ lineHeight: '22px' }}><span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 600 }}>{m.method}</span>：{m.dirs.join('、')}　<span style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12 }}>{m.note}</span></div>))}
				<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 4 }}>应期为六壬难点，仅供参考，以实际盘综合为准。</div>
			</Card>
		) : null;
		if(!key || key === 'general'){
			return (<div className="horosa-liureng-reference-tab-body"><Card size='small'><div style={muted}>在左栏「占事类型」选择具体占事（婚姻 / 疾病 / 财运 / 官讼…），此处显示该类主用神、关键神将与宜忌。</div></Card>{yingQiCard}</div>);
		}
		const zd = ZHANDUAN_DOC[key];
		if(!zd){ return (<div className="horosa-liureng-reference-tab-body"><Card size='small'><div style={muted}>暂无该占类资料。</div></Card>{yingQiCard}</div>); }
		const relBifa = (RELATED_BIFA[key] || []).map((no)=>BIFA_LIST.find((b)=>b.no === no)).filter(Boolean);
		const godValues = refCtx && refCtx.branchGodMap ? Object.keys(refCtx.branchGodMap).map((k)=>refCtx.branchGodMap[k]) : [];
		const sectionTitle = { fontWeight: 600, margin: '8px 0 4px' };
		const sectionBody = { color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' };
		const yongLuo = [];
		if(refCtx){
			if(refCtx.ke1Up){ yongLuo.push(`日干上神 ${refCtx.ke1Up}`); }
			if(refCtx.ke3Up){ yongLuo.push(`日支上神 ${refCtx.ke3Up}`); }
			if(refCtx.runYearBranch){ yongLuo.push(`年命 ${refCtx.runYearBranch}`); }
		}
		return (
			<div className="horosa-liureng-reference-tab-body">
				<Card size='small' style={{ marginBottom: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
						<span style={{ fontWeight: 600, fontSize: 15 }}>{zd.name}</span>
						<Tag color='cyan'>占断向导</Tag>
					</div>
					<div style={sectionTitle}>主用神</div>
					<div style={sectionBody}>{(zd.mainYong || []).map((y)=>`${y.role}：${y.mean}`).join('　')}</div>
					{yongLuo.length ? (<><div style={sectionTitle}>用神落点（本盘）</div><div style={sectionBody}>{yongLuo.join('　')}</div></>) : null}
					<div style={sectionTitle}>关键神将</div>
					<div style={sectionBody}>{(zd.keyJiang || []).map((j)=>{ const present = godValues.indexOf(j) >= 0; return (<Tag key={j} color={present ? 'green' : 'default'} style={{ marginBottom: 4 }}>{present ? `${j} ✓` : j}</Tag>); })}</div>
					<div style={sectionTitle}>宜见</div>
					<div style={sectionBody}>{(zd.favor || []).map((f, i)=>(<div key={i}>· {f}</div>))}</div>
					<div style={sectionTitle}>忌见</div>
					<div style={sectionBody}>{(zd.avoid || []).map((f, i)=>(<div key={i}>· {f}</div>))}</div>
					<div style={sectionTitle}>三传提示</div>
					<div style={sectionBody}>{zd.sanChuanTip}</div>
					{relBifa.length ? (<><div style={sectionTitle}>相关毕法</div>{relBifa.map((b)=>(<div key={b.no} style={{ ...sectionBody, marginBottom: 2 }}><span style={{ fontWeight: 600 }}>{`${b.no}. ${b.name}`}</span>　{b.explain}</div>))}</>) : null}
				</Card>
				<Card size='small'><div style={{ ...muted, fontSize: 12 }}>用神落点为确定性指引，吉凶须合全盘与三传旺衰判之。</div></Card>
				{yingQiCard}
			</div>
		);
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== (this.props.techniqueScope || 'liureng')){
			return;
		}
		const snapshotText = this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		if(snapshotText && evt && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	// horosa_liureng_render_slice_v1(L3):面板本体已抽为同文件子组件 LiuRengInputPanel(sCU 见类上注释),
	// 此处只把其消费的 state 标量/引用与回调铺成 props —— 比较由 wrapperPropsEqual 机械全覆盖,零手抄清单。
	renderInputPanel(){
		return (
			<LiuRengInputPanel
				renderLeftExtra={this.props.renderLeftExtra}
				fields={this.props.fields}
				onFieldsChange={this.onFieldsChange}
				onStepSelect={this.prefetchStepSelect}
				timeHook={this.timeHook}
				chartType={this.state.chartType}
				onChartTypeChange={this.onChartTypeChange}
				birth={this.state.birth}
				onBirthChange={this.onBirthChange}
				wuxing={this.state.wuxing}
				guireng={this.state.guireng}
				timeAlg={this.state.timeAlg}
				onTimeAlgChange={this.onTimeAlgChange}
				showTimeAlg={this.usesSavedSettings()}
				castMethod={this.state.castMethod}
				zeriLocked={this.props.zeriLocked}
				zeriRestoredLocks={this._zeriRestoredLocks}
				yueJiangMethod={this.state.yueJiangMethod}
				xuanShiZhi={this.state.xuanShiZhi}
				yanShuNum={this.state.yanShuNum}
				fenZhouYe={this.state.fenZhouYe}
				seHaiMethod={this.state.seHaiMethod}
				seHaiBoundary={this.state.seHaiBoundary}
				shiRuKe={this.state.shiRuKe}
				xiangOn={this.state.xiangOn}
				zhanCategory={this.state.zhanCategory}
				yearShenShaSort={this.state.yearShenShaSort}
				yinyangSystem={this.state.yinyangSystem}
				tuWangShuai={this.state.tuWangShuai}
				onWuXingChange={this.onWuXingChange}
				onGuiRengChange={this.onGuiRengChange}
				onCastMethodChange={this.onCastMethodChange}
				onOptionChange={this.handleCastField}
				onToggleXiang={this.onToggleXiang}
				onZhanCategoryChange={this.onZhanCategoryChange}
				onStartPaiPan={this.clickStartPaiPan}
				onSaveCase={this.clickSaveCase}
			/>
		);
	}

	renderReferenceTabs(refData){
		const {
			refSummary,
			refBundle,
			xiaojuMainItems,
			xiaojuReferenceItems,
			overviewItems,
			chart,
			displayRunYear,
		} = refData;
		const ctx = refBundle && refBundle.context ? refBundle.context : null;
		// 「小局」已并入「格局」tab(旧 key 'xiaoju' 归一到 'dage',免旧状态落空白页)
		const activeTabKey = this.state.rightPanelTab === 'xiaoju' ? 'dage' : this.state.rightPanelTab;
		return (
			<Tabs
				className="horosa-liureng-tabs"
				activeKey={activeTabKey}
				onChange={(key)=>this.setState({ rightPanelTab: key })}
				animated={false}
			>
				{/* horosa_freeze_subtabs_v1:右栏 8 面板 keep-alive(无 destroyInactiveTabPane),
				    改前每次父重渲(切时间/改 13 项设置/换页签)都把 格局/信息/毕法(百余条条文 map)/
				    参考/概览/占断/取象/七政 八个面板【全部】重跑一遍,而用户只看得见其中一个。
				    函数式 FreezeSubTab:未激活过 → 连元素都不建;激活过但当前非激活 → sCU 跳过
				    (DOM/实例/滚动位置/展开态全部保留,不卸载);切回 → 拿本轮最新 children 立刻渲一帧,
				    不重发请求、不闪烁、无陈旧。kill-switch horosa.perf.freezeSubTabs=0 即回旧行为。 */}
				<TabPane tab="格局" key="dage">
					<FreezeSubTab active={activeTabKey === 'dage'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{refSummary ? (
							<Card size='small' style={{ marginBottom: 8, background: 'var(--horosa-panel-soft, #fafafa)' }}>
								<div style={{ fontSize: 12, color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px' }}>{refSummary}</div>
							</Card>
						) : null}
						<div className="horosa-side-panel-subtitle" style={{ margin: '2px 0 6px' }}>大格</div>
						{refBundle.dage && refBundle.dage.length ? refBundle.dage.map((item)=>(
							<Card key={`dage_${item.key}`} size='small' style={{ marginBottom: 8 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
									<span style={{ fontWeight: 600 }}>{item.name}</span>
									<Tag color='blue'>{item.source || '课式命中'}</Tag>
								</div>
								<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
									{buildReferenceDocumentText(item, 'dage')}
								</div>
								{item.evidence && item.evidence.length ? (
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
								) : null}
							</Card>
						)) : (
							<Card size='small' style={{ marginBottom: 8 }}>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂未命中可判定的大格。</div>
							</Card>
						)}
						<div className="horosa-side-panel-subtitle" style={{ margin: '8px 0 6px' }}>小局</div>
						{xiaojuMainItems.length ? xiaojuMainItems.map((item)=>(
							<Card key={`xiaoju_${item.key}`} size='small' style={{ marginBottom: 8 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
									<span style={{ fontWeight: 600 }}>{item.name}</span>
									<Tag color='purple'>{item.categoryName || '小局'}</Tag>
								</div>
								<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
									{buildReferenceDocumentText(item, 'xiaoju')}
								</div>
								{item.evidence && item.evidence.length ? (
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
								) : null}
							</Card>
						)) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂未命中已收录的小局条件。</div>
							</Card>
						)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="信息" key="meta">
					<FreezeSubTab active={activeTabKey === 'meta'}>{()=>{
					// horosa_liureng_render_slice_v1(L2):9 组神煞/旬空/长生 meta 卡的数据在 thunk 内现算 ——
					// 仅本面板激活时执行(FreezeSubTab 函数式 children 语义),输入取同一 commit 的 state,零陈旧。
					const metaItems = this.buildQuickMetaItems(displayRunYear);
					return (
					<div className="horosa-liureng-reference-tab-body">
						{metaItems && metaItems.length ? metaItems.map((group)=>(
							<Card key={`meta_${group.title}`} size='small' style={{ marginBottom: 8 }} title={group.title}>
								<div className="horosa-liureng-meta-list">
									{(group.rows || []).map((item, idx)=>(
										<div className="horosa-liureng-meta-row" key={`${item.key}_${idx}`}>
											<span>{item.key}</span>
											<strong>{item.value}</strong>
										</div>
									))}
								</div>
							</Card>
						)) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>起课后显示旬空/神煞/长生等信息。</div>
							</Card>
						)}
					</div>
					);
					}}</FreezeSubTab>
				</TabPane>
				<TabPane tab="毕法" key="bifa">
					<FreezeSubTab active={activeTabKey === 'bifa'}>{() => this.renderBiFaTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="参考" key="reference">
					<FreezeSubTab active={activeTabKey === 'reference'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{xiaojuReferenceItems.length ? xiaojuReferenceItems.map((item)=>(
							<Card key={`ref_${item.key}`} size='small' style={{ marginBottom: 8 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
									<span style={{ fontWeight: 600 }}>{item.name}</span>
									<Tag color='gold'>参考</Tag>
								</div>
								<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
									{buildReferenceDocumentText(item, 'xiaoju')}
								</div>
								{item.evidence && item.evidence.length ? (
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
								) : null}
							</Card>
						)) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无可展示的参考条目。</div>
							</Card>
						)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeTabKey === 'overview'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{this.renderShenShaSection(ctx)}
						{overviewItems.length ? overviewItems.map((item, idx)=>(
							<Card key={`overview_${item.key}_${idx}`} size='small' style={{ marginBottom: 8 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
									<span style={{ fontWeight: 600 }}>{item.name}</span>
									<Tag color={item.group === 'laiyi' ? 'cyan' : 'magenta'}>
										{item.group === 'laiyi' ? '天将发用来意诀' : '天将杂主吉凶'}
									</Tag>
								</div>
								<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
									{buildOverviewReferenceText(item)}
								</div>
								{item.evidence && item.evidence.length ? (
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
								) : null}
							</Card>
						)) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘未命中“天将发用来意诀/天将杂主吉凶”条目。</div>
							</Card>
						)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="占断" key="zhanduan">
					<FreezeSubTab active={activeTabKey === 'zhanduan'}>{() => this.renderZhanDuanTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="取象" key="xiang">
					<FreezeSubTab active={activeTabKey === 'xiang'}>{() => this.renderXiangTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="七政" key="qizheng">
					<FreezeSubTab active={activeTabKey === 'qizheng'}>{()=>{
					// horosa_liureng_render_slice_v1(L2):七政条目在 thunk 内现算,仅本面板激活时执行;
					// AI 快照的 [七政] 段由 buildLiuRengSnapshotText 自行调 buildQiZhengItems,与此无涉。
					const qizhengItems = buildQiZhengItems(chart);
					return (
					<div className="horosa-liureng-reference-tab-body">
						{qizhengItems && qizhengItems.length ? (
							<Card size='small'>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: 8 }}>
									{qizhengItems.map((item)=>{
										const wxColor = QIZHENG_WUXING_COLOR[item.wx] || 'var(--horosa-text, #d8d2c7)';
										const pColor = QIZHENG_PLANET_COLOR[item.name] || 'var(--horosa-text, #d8d2c7)';
										return (
											<div
												key={`qz_${item.key}`}
												style={{
													position: 'relative',
													display: 'flex',
													flexDirection: 'column',
													alignItems: 'center',
													gap: 1,
													padding: '9px 4px 7px',
													borderRadius: 10,
													background: item.isYue
														? 'linear-gradient(180deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))'
														: 'var(--horosa-panel-soft, rgba(255,255,255,0.035))',
													border: item.isYue
														? '1px solid var(--horosa-accent, #d4a017)'
														: '1px solid var(--horosa-border, rgba(255,255,255,0.08))',
													boxShadow: item.isYue ? 'inset 0 0 0 2px rgba(212,160,23,0.12)' : 'none',
												}}
											>
												{item.isYue ? (
													<span style={{ position: 'absolute', top: -7, right: -5, fontSize: 10, lineHeight: '15px', padding: '0 5px', borderRadius: 7, background: 'var(--horosa-accent, #d4a017)', color: 'var(--horosa-on-accent, #1a1206)', fontWeight: 700, whiteSpace: 'nowrap' }}>月将</span>
												) : null}
												<span style={{ fontSize: 12, fontWeight: 700, color: pColor, letterSpacing: 1 }}>
													{item.name}
													{item.retro ? <span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', marginInlineStart: 2, fontWeight: 800 }}>℞</span> : null}
												</span>
												<span style={{ fontSize: 21, fontWeight: 800, color: wxColor, lineHeight: '26px' }}>{item.branch || '—'}</span>
												<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>
													{item.wx || ''}{item.deg != null ? ` ${item.deg.toFixed(0)}°` : ''}
												</span>
											</div>
										);
									})}
								</div>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 10, lineHeight: '18px' }}>
									七政所临之宫，色按五行。<span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 700 }}>℞</span> 为逆行；
									<span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 700 }}>月将</span>即太阳过宫之神。
								</div>
							</Card>
						) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无七政数据（需含日月五星之星历）。</div>
							</Card>
						)}
					</div>
					);
					}}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	buildQuickMetaItems(displayRunYear){
		const liureng = this.state.liureng;
		if(!liureng){
			return [];
		}
		const appliedBirth = getAppliedBirth(this.state);
		const genderVal = appliedBirth && appliedBirth.gender
			? appliedBirth.gender.value
			: -1;
		const genderText = genderVal === 0 || genderVal === '0' ? '女' : '男';
		const runyear = displayRunYear || {};
		const dunDing = liureng.xun ? (liureng.xun['遁丁'] || extractBranch(liureng.xun['旬丁'])) : '';
		const yearGods = [];
		const taisui1 = liureng.godsYear ? liureng.godsYear.taisui1 : null;
		for(let i=0; i<LRConst.TaiSui.length; i++){
			const key = LRConst.TaiSui[i];
			yearGods.push({
				key,
				value: taisui1 && taisui1[key] ? taisui1[key] : '—',
			});
		}
		const zhangsheng = ZSList.map((item)=>({
			key: item,
			value: ZhangSheng.wxphase[`${this.state.wuxing}_${item}`],
		}));
		return [{
			title: '行年',
			rows: [{
				key: '行年',
				value: runyear.year ? runyear.year : '—',
			}, {
				key: '年龄',
				value: runyear.age !== undefined && runyear.age !== null ? `${runyear.age}岁` : '—',
			}, {
				key: '性别',
				value: genderText,
			}],
		}, {
			title: '旬日',
			rows: [{
				key: '旬空',
				value: liureng.xun ? liureng.xun['旬空'] : '—',
			}, {
				key: '旬首',
				value: liureng.xun ? liureng.xun['旬首'] : '—',
			}, {
				key: '旬尾',
				value: liureng.xun ? liureng.xun['旬尾'] : '—',
			}, {
				key: '遁丁',
				value: dunDing || '—',
			}],
		}, {
			title: '旺衰',
			rows: buildMetaRows(liureng.season),
		}, {
			title: '基础神煞',
			rows: buildMetaRows(liureng.gods),
		}, {
			title: '干煞',
			rows: buildMetaRows(liureng.godsGan),
		}, {
			title: '月煞',
			rows: buildMetaRows(liureng.godsMonth),
		}, {
			title: '支煞',
			rows: buildMetaRows(liureng.godsZi),
		}, {
			title: '年煞',
			rows: yearGods,
		}, {
			title: `${this.state.wuxing}十二长生`,
			rows: zhangsheng,
		}];
	}

	// 快捷栏契约:起课主键常驻(左栏起课钮在长表单下会滚出视野,主键豁免)+「此刻起课」
	// 一键把课时设为当下并重排;9 张神煞 meta 卡收进「速查」弹层(原先常驻铺满=目录化)。
	// 只补 date/time——zone/经纬是用户所在地设置,动了反而起错课;ad 不动,DateTime 为
	// 绝对时刻,历法标记只是左栏录入形态。
	clickStartNowPaiPan(){
		const now = new DateTime();
		if(sendScopedFields(this.props, { date: { value: now.clone() }, time: { value: now.clone() } })){
			this.pendingFields = null;
			return;
		}
		if(!this.props.dispatch){
			return;
		}
		const currentFields = this.props.fields || {};
		this.pendingFields = null;
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: {
				...currentFields,
				date: { value: now.clone() },
				time: { value: now.clone() },
				__requestOptions: {
					silent: true,
				},
			},
		});
	}

	// 神煞/旬空/长生等信息不再走栏内速查弹层——全部常驻右栏「信息」tab(信息不得仅在快捷栏可见)。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="lrzhan"
				className="horosa-liureng-quick-dock"
				hasResult={!!this.state.liureng}
				primary={{ key: 'paipan', label: '起课', onClick: ()=>this.clickStartPaiPan() }}
				extras={[
					{ key: 'nowCast', label: '此刻起课', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickStartNowPaiPan() },
				]}
				save={()=>this.clickSaveCase()}
				dispatch={this.props.dispatch}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760
		}else{
			height = height - 20
		}

		let chart = this.state.calcChart ? this.lrChartFor(this.state.calcChart) : null;
		let chartFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const appliedBirth = getAppliedBirth(this.state);
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, chartFields);
		const _lrExtra = liurengBenmingXingnian(appliedBirth, displayRunYear);
		const _solarYear = getSolarYearFromField(chartFields && chartFields.date ? chartFields.date : null);
		const _guardOn = chartDrawGuardEnabled();

		// ① castOverride 缓存:签名 = chart 引用 + buildLiuRengCastOverride/computeQiXY 实际消费的全部 opts 标量。
		//    全等 → 复用上次实例(引用稳定)→ 透传 LiuRengChart 的 CDU 不再误判变、d3 不白重画;任一变 → 真重算。
		const _castSig = [
			chart,
			this.state.castMethod, this.state.yueJiangMethod, this.state.fenZhouYe,
			this.state.seHaiMethod, this.state.seHaiBoundary, this.state.shiRuKe,
			this.state.yinyangSystem, _solarYear,
			this.state.xuanShiZhi, this.state.yanShuNum,
			_lrExtra.benmingZhi, _lrExtra.xingnianZhi,
		];
		let castOverride;
		if(_guardOn && this._castOverrideCache && sameLRSigArr(this._castOverrideCache.sig, _castSig)){
			castOverride = this._castOverrideCache.data;
		}else{
			castOverride = buildLiuRengCastOverride(chart, { ...this.state, benmingZhi: _lrExtra.benmingZhi, xingnianZhi: _lrExtra.xingnianZhi, solarYear: _solarYear });
			if(_guardOn){
				this._castOverrideCache = { sig: _castSig, data: castOverride };
			}
		}

		// ② refBundle 缓存:签名 = liureng/chart 引用 + guireng + 行年(仅消费 runyear.year)+ castOverride 引用(①已稳定)。
		//    切右栏 tab 不动这些 → 跳过 ~650 行参考体系重算;重排盘/换流派/换贵神/换行年 → 真重算。
		const _refSig = [
			this.state.liureng, chart, this.state.guireng,
			(displayRunYear && displayRunYear.year) || '', castOverride,
			_lrExtra.benmingZhi || '',
		];
		let refBundle;
		if(_guardOn && this._refBundleCache && sameLRSigArr(this._refBundleCache.sig, _refSig)){
			refBundle = this._refBundleCache.data;
		}else{
			refBundle = buildLiuRengReferenceBundle(this.state.liureng, chart, this.state.guireng, displayRunYear, castOverride, { benMingBranch: _lrExtra.benmingZhi });
			if(_guardOn){
				this._refBundleCache = { sig: _refSig, data: refBundle };
			}
		}
		const refContext = refBundle.context || {};
		const panStyleName = refContext.panStyle && refContext.panStyle.name ? refContext.panStyle.name : '';
		const xiaojuAllItems = Array.isArray(refBundle.xiaoju) ? refBundle.xiaoju : [];
		const xiaojuMainItems = xiaojuAllItems.filter((item)=>!XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const xiaojuReferenceItems = xiaojuAllItems.filter((item)=>XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const overviewItems = Array.isArray(refBundle.overview) ? refBundle.overview : [];
		const refSummary = [
			refContext.courseName ? `课式：${refContext.courseName}` : '',
			refContext.sanChuanText ? `三传：${refContext.sanChuanText}` : '',
			refContext.dayGanZi ? `日干支：${refContext.dayGanZi}` : '',
		].filter(Boolean).join('；');
		return (
			<div className="horosa-liureng-page horosa-astro-redesign horosa-liureng-redesign" style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-liureng-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-liureng-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-liureng-input-panel">
							{this.renderInputPanel()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-liureng-chart-panel xq-chart-renderer xq-chart-renderer-liureng">
							<div className="horosa-liureng-chart-host">
								<LiuRengChart
									value={chart}
									liureng={this.state.liureng}
									panStyleName={panStyleName}
									runyear={displayRunYear}
									gender={appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1}
									zhangshengElem={this.state.wuxing}
									guireng={this.state.guireng}
									castOverride={castOverride}
									height={height}
									fields={chartFields}
									chartType={this.state.chartType}
									timeAlg={this.state.timeAlg}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-liureng-info-panel">
							<div className="horosa-side-panel-heading horosa-liureng-info-heading">
								<div>
									<div className="horosa-side-panel-title">格局参考</div>
									<div className="horosa-side-panel-subtitle">大格、小局与参考条目</div>
								</div>
							</div>
							{/* horosa_liureng_render_slice_v1(L2):七政/信息两组条目原在此处每轮 render 先算好
							    (buildQiZhengItems + buildQuickMetaItems),而消费方只有各自 FreezeSubTab 面板 ——
							    非激活时算完即弃。改传原料(chart/displayRunYear),调用下沉进对应 thunk:面板激活才算;
							    freezeSubTabs 开关关闭 = thunk 每轮照跑 = 旧行为,无新旗标。 */}
							{this.renderReferenceTabs({
								refSummary,
								refBundle,
								xiaojuMainItems,
								xiaojuReferenceItems,
								overviewItems,
								chart,
								displayRunYear,
							})}
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>

		);
	}
}

export {
	buildLiuRengReferenceBundle,
	buildReferenceDocumentText,
	buildOverviewReferenceText,
	XIAO_JU_REFERENCE_TAB_KEYS,
	liurengChouBranch,
	buildQiZhengItems,
	QIZHENG_PLANET_COLOR,
	QIZHENG_WUXING_COLOR,
};

export default LiuRengMain;
