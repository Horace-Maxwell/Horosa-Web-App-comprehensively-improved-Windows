import React from 'react';
import { connect  } from 'dva';
import { Spin, } from 'antd';
import DateTime from '../components/comp/DateTime';
import LoginForm from '../components/user/LoginForm';
import RegisterForm from '../components/user/RegisterForm';
import ResetPwdForm from '../components/user/ResetPwdForm';
import ChangePwdForm from '../components/user/ChangePwdForm';
import ChangeParamsFormComp from '../components/user/ChangeParamsFormComp';
import ChartAddFormComp from '../components/user/ChartAddFormComp';
import ChartEditFormComp from '../components/user/ChartEditFormComp';
import ChartList from '../components/user/ChartList';
import CaseAddFormComp from '../components/user/CaseAddFormComp';
import CaseEditFormComp from '../components/user/CaseEditFormComp';
import CaseList from '../components/user/CaseList';
import AstroFormComp from '../components/astro/AstroFormComp';
import AstroChartMain from '../components/astro/AstroChartMain';
import TechniqueErrorBoundary from '../components/common/TechniqueErrorBoundary';
import { cityDbIdlePreloadEnabled } from '../utils/perfFlags';

// 流畅度:可预取的 lazy —— 启动仍只载首包(快),首屏就绪后空闲时段后台预载全部技法 chunk,
// 用户切任何技法时模块早已就绪(零等待)。preload 引用同一 factory,React.lazy 缓存同一 promise。
// WS-N3(2026-07-16):悬停预取注册表迁至 utils/navPreload.js —— 模块选择器/快捷坞等公共组件
// 也要消费,从 pages 导入会成 components ← pages 循环依赖;此处声明时登记,消费方 import util。
const LAZY_PRELOAD_QUEUE = [];   // {factory, order}
// order: 1=hot(高频技法,先预载) 1.5=城市大库(见下) 2=normal 3=heavy(3D/天文馆等重可视化,殿后)
function lazyPreloadable(factory, opts = {}){
	// [P0 chunk 自愈] HMR 撕裂/更新中途换包时 import() 可能 resolve 出「无 default 的空模块」——
	// React.lazy 会把这次坏结果永久缓存(React 17 settle 后状态钉死),边界重挂救不回。
	// 工厂层自愈:坏结果不进缓存(下次真正重试 import),并抛明确错误交边界卡走「刷新重载」路。
	let cachedGood = null;
	const healingFactory = ()=>{
		if(cachedGood){ return cachedGood; }
		const p = Promise.resolve().then(factory).then((m)=>{
			if(!m || !m.default){
				throw new Error('Lazy chunk resolved empty (stale HMR / 更新中途换包): 请刷新页面');
			}
			cachedGood = p;
			return m;
		});
		return p;
	};
	const C = React.lazy(healingFactory);
	LAZY_PRELOAD_QUEUE.push({ factory: healingFactory, order: opts.order || 2 });
	if(opts.navKey){
		registerNavPreload(opts.navKey, healingFactory);
	}
	// 🔒 黑屏根因修复:外层 <React.Suspense>(本文件 ~541 行)仅罩住主工作区,而抽屉(小工具/辅助/
	//   印度盘等,渲染于 1400+ 行)在其作用域之外 → lazy chunk 尚未空闲预载完就打开抽屉时,组件 suspend
	//   却无 Suspense 兜底 → 抛 "A React component suspended while rendering, but no fallback UI was
	//   specified" 冒泡到根卸载整树 = 整页黑屏(小工具两端皆崩、辅助八卦时序相关皆源于此)。
	//   故每个 lazy 模块自带:Suspense(加载中显 Spin)+ error boundary(模块求值/render 崩则局部回退卡片,绝不黑全屏)。
	const Wrapped = (props) => (
		<TechniqueErrorBoundary>
			<React.Suspense fallback={<div style={{padding:40,textAlign:'center'}}><Spin size="large" tip="加载中…" /></div>}>
				<C {...props} />
			</React.Suspense>
		</TechniqueErrorBoundary>
	);
	Wrapped.displayName = 'LazyBoundary';
	return Wrapped;
}
// 首屏可交互后逐个空闲预载(每次 1 个,绝不与用户操作抢主线程;requestIdleCallback 降级 setTimeout)。
let lazyPreloadStarted = false;
function startIdlePreload(){
	if(lazyPreloadStarted) return;
	lazyPreloadStarted = true;
	// 概率序:hot(高频技法)→normal→heavy(重可视化);同档保声明序。
	// 此前按 import 声明序(3D/天文馆最先)与真实使用频率倒挂,高频技法反而最后就绪。
	const queue = LAZY_PRELOAD_QUEUE.slice()
		.sort((a, b) => a.order - b.order)
		.map((e) => e.factory);
	const next = ()=>{
		const f = queue.shift();
		if(!f) return;
		Promise.resolve().then(f).catch(()=>{}).finally(()=>{
			if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
				window.requestIdleCallback(next, { timeout: 3000 });
			}else{
				setTimeout(next, 300);
			}
		});
	};
	// 首帧后 1s 再开始(原 2s;预载走 requestIdleCallback 空闲档,不与首屏交互抢主线程,
	// 提前 1s = 高频技法更早就绪;首屏回归由 ladder 账本把关)。
	setTimeout(()=>{
		if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
			window.requestIdleCallback(next, { timeout: 3000 });
		}else{
			setTimeout(next, 300);
		}
	}, 1000);
}

// horosa_city_db_idle_preload_v1(PERF-R9 Ship 6):把最大的那块 chunk 提前。
// 构建产物里 104.*.async.js = 3.85MB,内容就是 src/data/citiesFull.json(全量城市/地名库)。
// 它此前【完全不在】任何空闲预载队列里 —— 只有用户打开经纬度选择器时
// GeoCoordSelector.componentDidMount 才动态 import,于是「点开选地点」当场付 3.85MB 的
// 取包 + JSON.parse,是全站最大的单次现付成本;而改出生地/事件地是首屏之后最常发生的操作之一。
// 故登记进队列,order 1.5 = 排在全部 hot 技法 chunk 之后、normal 之前(队列本身仍是
// requestIdleCallback 逐个执行、用户一交互就让路,不与首屏抢主线程)。
// 只改「何时付」,不改任何取数/匹配/渲染语义:GeoCoordSelector 那边的 import() 一字未动,
// 预载过则它秒回,未预载(或关闸)则完全是旧行为。
// kill-switch:safeLocalStorageSet('horosa.perf.cityDbIdlePreload','0') 后刷新。
if(cityDbIdlePreloadEnabled()){
	LAZY_PRELOAD_QUEUE.push({ factory: () => import('../data/citiesFull.json'), order: 1.5 });
}

// 3D 星盘动态化(首包瘦身):babylon 系重组件不入主包;lazyPreloadable 自带 Suspense+错误边界,并进 idle 预取队列(用户点击时通常已就绪)。
const AstroChartMain3D = lazyPreloadable(() => import('../components/astro3d/AstroChartMain3D'), { order: 3, navKey: 'astrochart3D' });
const PlanetariumMain = lazyPreloadable(() => import('../components/planetarium/PlanetariumMain'), { order: 3, navKey: 'planetarium' });
const AuxChartMain = lazyPreloadable(() => import('../components/auxchart/AuxChartMain'), { order: 1, navKey: 'auxchart' });
const IndiaChartMain = lazyPreloadable(() => import('../components/astro/IndiaChartMain'), { order: 1, navKey: 'indiachart' });
// [B6] 合盘转 lazy(此前 eager 拖整组件进首屏;快照链亦已在 aiAnalysisContext 动态化,饿链全断)。
const AstroRelative = lazyPreloadable(() => import('../components/astro/AstroRelative'), { order: 2, navKey: 'relativechart' });
const AstroDirectMain = lazyPreloadable(() => import('../components/direction/AstroDirectMain'), { order: 1, navKey: 'direction' });
import AspSelector from '../components/astro/AspSelector';
import AstroOrbSetting from '../components/astro/AstroOrbSetting';
import PlanetSelector from '../components/astro/PlanetSelector';
import ChartDisplaySelector from '../components/astro/ChartDisplaySelector';
import ChartsGps from '../components/user/ChartsGps';
// [B6] 笔记面板转 lazy:其饿链拖 Quill+node-forge 进首屏 vendors(explorer 实测);lazyPreloadable 自带 Suspense+边界。
const ChartMemo = lazyPreloadable(() => import('../components/comp/ChartMemo'), { order: 3 });
import FreezeInactive from '../components/comp/FreezeInactive';
const JieQiChartsMain = lazyPreloadable(() => import('../components/jieqi/JieQiChartsMain'), { order: 2, navKey: 'jieqichart' });
const CnTraditionMain = lazyPreloadable(() => import('../components/cntradition/CnTraditionMain'), { order: 2, navKey: 'cntradition' });
const CnYiBuMain = lazyPreloadable(() => import('../components/cnyibu/CnYiBuMain'), { order: 2, navKey: 'cnyibu' });
const XuanShiMain = lazyPreloadable(() => import('../components/xuanshi/XuanShiMain'), { order: 3, navKey: 'xuanshi' });
const AstrodataPage = lazyPreloadable(() => import('../components/astrodata/AstrodataPage'), { order: 3, navKey: 'astrodata' });
const CalendarMain = lazyPreloadable(() => import('../components/calendar/CalendarMain'), { order: 2, navKey: 'calendar' });
const FengShuiMain = lazyPreloadable(() => import('../components/fengshui/FengShuiMain'), { order: 2, navKey: 'fengshui' });
const SanShiUnitedMain = lazyPreloadable(() => import('../components/sanshi/SanShiUnitedMain'), { order: 2, navKey: 'sanshiunited' });
const AIAnalysisMain = lazyPreloadable(() => import('../components/aianalysis/AIAnalysisMain'), { order: 1, navKey: 'aianalysis' });
// WS-N3:此前四项无 navKey → 不在悬停预取注册表,主导航/抽屉/dock 掠过恒 no-op,只能等
// order 2/3 的 idle 队列殿后 —— 补 navKey(与 drawerNavigationPages/openDrawer 的 key 同名)。
const BookMain = lazyPreloadable(() => import('../components/reader/BookMain'), { order: 3, navKey: 'astroreader' });
const MediaMain = lazyPreloadable(() => import('../components/multimedia/MediaMain'), { order: 3, navKey: 'liveplayer' });
const AdminToolsMain = lazyPreloadable(() => import('../components/admintools/AdminToolsMain'), { order: 3, navKey: 'admintools' });
const GuoLaoChartMain = lazyPreloadable(() => import('../components/guolao/GuoLaoChartMain'), { order: 1, navKey: 'guolao' });
const CommToolsMain = lazyPreloadable(() => import('../components/commtools/CommToolsMain'), { order: 2, navKey: 'commtools' });
import DLFeature from '../components/deeplearn/DLFeature';
import HomePageSetup from '../components/HomePageSetup';
import BaZi from '../components/cntradition/BaZi';
const ZiWeiMain = lazyPreloadable(() => import('../components/ziwei/ZiWeiMain'), { order: 1, navKey: 'ziwei' });
const GuaZhanMain = lazyPreloadable(() => import('../components/guazhan/GuaZhanMain'), { order: 1, navKey: 'guazhan' });
const LiuRengMain = lazyPreloadable(() => import('../components/lrzhan/LiuRengMain'), { order: 1, navKey: 'liureng' });
const DunJiaMain = lazyPreloadable(() => import('../components/dunjia/DunJiaMain'), { order: 1, navKey: 'dunjia' });
const TaiYiMain = lazyPreloadable(() => import('../components/taiyi/TaiYiMain'), { order: 1, navKey: 'taiyi' });
const ShuSuanMain = lazyPreloadable(() => import('../components/shusuan/ShuSuanMain'), { order: 2, navKey: 'shusuan' });
const MingOtherMain = lazyPreloadable(() => import('../components/mingother/MingOtherMain'), { order: 2, navKey: 'mingother' });
import * as AstroConst from '../constants/AstroConst';
import {convertToArray} from '../utils/helper';
import { APPEARANCE_DARK } from '../utils/appearance';
import XQIcon from '../components/xq-icons';
import { XQDrawer as Drawer, XQModal, XQTabs } from '../components/xq-ui';
import { scheduleUnconfirmedTimeDispatch, cancelPendingTimeDispatch } from '../utils/timeDispatchScheduler';
// horosa_interaction_span_v1(PERF-R9 Ship 0a):交互起点打点。改之前 ':refresh-start' 全仓
// 只有 changeTab 打过,切时间/改选项一次都不打 —— 于是 markChartRefreshEnd 拿上次切页签的
// 陈旧 start 配 measure,量出秒级垃圾,「点击→显示」这个要验收的数根本量不出来。
import { markInteractionStart, setCurrentTechnique } from '../utils/perfMark';
import { registerNavPreload, preloadNavByKey } from '../utils/navPreload';

const TabPane = XQTabs.TabPane;

const mainTabIcons = {
    占星: <XQIcon name="astro" />,
    星盘: <XQIcon name="astro" />,
    星运: <XQIcon name="direction" />,
    八字: <XQIcon name="bazi" />,
    紫微: <XQIcon name="ziwei" />,
    '3D': <XQIcon name="threeD" />,
    三维盘: <XQIcon name="threeD" />,
    天文馆: <XQIcon name="globe" />,
    七政: <XQIcon name="qizheng" />,
    印占: <XQIcon name="vedic" />,
    辅盘: <XQIcon name="aux" />,
    合盘: <XQIcon name="composite" />,
    数算: <XQIcon name="quickPrimary" />,
    七政四余: <XQIcon name="qizheng" />,
    印度占星: <XQIcon name="vedic" />,
    三式: <XQIcon name="sanshi" />,
    三式合一: <XQIcon name="sanshi" />,
    六壬: <XQIcon name="liureng" />,
    遁甲: <XQIcon name="qimen" />,
    六爻: <XQIcon name="liuyao" />,
    太乙: <XQIcon name="taiyi" />,
    分至: <XQIcon name="solstice" />,
    节气盘: <XQIcon name="solstice" />,
    风水: <XQIcon name="fengshui" />,
    其他: <XQIcon name="other" />,
    其他术数: <XQIcon name="other" />,
    AI分析: <XQIcon name="ai" />,
    黄历: <XQIcon name="calendar" />,
    玄学史: <XQIcon name="other" />,
    数据库: <XQIcon name="database" />,
    '3D星盘': <XQIcon name="sphere3d" />,
    辅助: <XQIcon name="support" />,
    书籍阅读: <XQIcon name="book" />,
    星阙直播: <XQIcon name="live" />,
    管理工具: <XQIcon name="admin" />,
};

// keywords：该模块内部的术法/别名串（简体 + 常见叫法），供导航搜索匹配「模块内术法」。
// 例：搜「卜卦盘」命中「辅盘」、搜「金口诀」命中「其他(卜)」。新增模块/术法须同步补此处（见 AGENTS.md）。
const navigationPages = [
    { label: '占星', key: 'astrochart', icon: 'astro', group: '命', keywords: '西洋占星 本命盘 占星地图 ACG 星体地图 希腊星术 古典占星 寿命 界推运 12分度 主宰链 阿拉伯点 容许度' },
    { label: '星运', key: 'direction', icon: 'direction', group: '命', keywords: '推运 主限法 太阳弧 波斯向运 法达星限 十年大运 黄道星释 行星弧 小限法 流年法 太阳返照 月亮返照 三分主星 Balbillus 赤纬推运 恒星推运 二次推运 行星年龄 129年系统 数字相位 月相推运 多重回归 关键点 回归轴 年龄推进点 星历' },
    { label: '八字', key: 'bazi', icon: 'bazi', group: '命', keywords: '八字 四柱 子平 盲派 滴天髓 大运 流年' },
    { label: '紫微', key: 'ziwei', icon: 'ziwei', group: '命', keywords: '紫微斗数 飞星 大限 小限 流年 四化 命宫' },
    { label: '七政', key: 'guolao', icon: 'qizheng', group: '命', keywords: '七政四余 政余 五星 果老星宗 二十八宿 宿度' },
    { label: '印占', key: 'indiachart', icon: 'vedic', group: '命', keywords: '印度占星 吠陀 Vedic 分宫制 岁差 ayanamsa 月宿 nakshatra 北印 南印 东印 印度盘 分盘 vargas 十六分盘 D9 D10 D60 Vimshottari Yogini Ashtottari 大运 dasha KP 副星 Shadbala 沙宾力 Yoga 瑜伽 Gulika 上升 Lagna Muhurta Tajika Argala Gochara Prasna 副星虚点' },
    { label: '辅盘', key: 'auxchart', icon: 'aux', group: '命', keywords: '卜卦盘 择日盘 世俗盘 十三分盘 十二分盘 调波盘 谐波盘 龙盘 中点盘 量化盘 汉堡盘 占星地图 星体地图 astrocartography ACG 重置盘 骰子 卜卦 择日' },
    { label: '合盘', key: 'relativechart', icon: 'composite', group: '命', keywords: '合盘 关系盘 比较盘 组合盘 影响盘 时空中点盘 马克斯盘 关系量化 中点合成 synastry composite davison marks' },
    { label: '数算', key: 'shusuan', icon: 'quickPrimary', group: '命', keywords: '邵子神数 铁板神数 河洛理数 参评数 北极神数 南极神数 蠢子数 神数正传 大定神数 条文 秘数 十二辟卦 太玄玉景 起数' },
    { label: '其他', key: 'mingother', icon: 'other', group: '命', keywords: '演禽 仙禽 策天 策天飞星 一掌经 掌经 十二星 六道 yizhangjing' },
    { label: '三式', key: 'sanshiunited', icon: 'sanshi', group: '卜', keywords: '三式合一 六壬 奇门 太乙' },
    { label: '六壬', key: 'liureng', icon: 'liureng', group: '卜', keywords: '大六壬 六壬 三传 四课 神煞 七政' },
    { label: '遁甲', key: 'dunjia', icon: 'qimen', group: '卜', keywords: '奇门遁甲 奇门 法奇门' },
    { label: '六爻', key: 'guazhan', icon: 'liuyao', group: '卜', keywords: '六爻 纳甲 卜卦 摇卦 装卦' },
    { label: '太乙', key: 'taiyi', icon: 'taiyi', group: '卜', keywords: '太乙神数 太乙' },
    { label: '分至', key: 'jieqichart', icon: 'solstice', group: '卜', keywords: '节气盘 分至 二分二至' },
    { label: '风水', key: 'fengshui', icon: 'fengshui', group: '卜', keywords: '风水 纳气盘 八卦阳宅 阳宅 理气 罗盘 八宅 大游年 东西四宅 门主灶 玄空 玄空飞星 兼向 替卦 三合 十二长生 水法 立向 黄泉 拨砂 穿山 透地 分金 金锁玉关 过路阴阳 乾坤国宝 龙门八局 紫白 紫白飞星 辅星水法 翻卦 净阴净阳 纳甲 玄空大卦 六十四卦 卦运 形势 峦头 龙穴砂水向 择日 造命 太岁 三煞 岁破 坐向 元运' },
    { label: '其他', key: 'cnyibu', icon: 'other', group: '卜', keywords: '金口诀 五兆 太玄 荆诀 神易数 皇极经世 宿占 统摄法 地占 天文地占 护盾盘 判官 调和者 16图形 盾牌盘 四片盘 Hakata 异或表盘 Sikidy 塔罗 tarot 韦特 RWS 马赛 托特 Thoth 雷诺曼 Lenormand 埃及塔罗 扑克占卜 大牌 小牌 权杖 圣杯 宝剑 星币 凯尔特十字 皇极轨策 轨策 策数 轨数 万物数 周易数 梅花易数 体用 互卦 三要十应 大定神数 元会运世 邵子 小成图 小成圖 股市卦 飞宫小奇门 小奇门 飞宫 小六壬 掌诀 大安 留连 速喜 赤口 小吉 空亡' },
    { label: 'AI分析', key: 'aianalysis', icon: 'ai', group: '工具', keywords: 'AI 分析 挂载 报告 大模型' },
    { label: '天文馆', key: 'planetarium', icon: 'globe', group: '工具', keywords: '天文馆 星空 观星 星图 babylon' },
    { label: '黄历', key: 'calendar', icon: 'calendar', group: '工具', keywords: '黄历 农历 老黄历 择日 宜忌 节气' },
    { label: '辅助', key: 'cntradition', icon: 'support', group: '工具', keywords: '辅助 工具 真太阳时 八卦类象 类象 卦象 十二串宫 十二宫 八字规则 规则速查' },
    { label: '玄学史', key: 'xuanshi', icon: 'other', group: '工具', keywords: '玄学史 历史 星象 天象 列传 朝代 地图 关系 二十四史 野载 正史 omen 玄史 中国玄学史' },
    { label: '3D星盘', key: 'astrochart3D', icon: 'sphere3d', group: '工具', keywords: '3D 星盘 三维 天球 立体 球面 星空 相位 映点 接纳 互容 围攻 夹宫 希腊点 3d' },
    { label: '数据库', key: 'astrodata', icon: 'database', group: '工具', keywords: '数据库 名人 命例 名人星盘 星盘库 案例库 出生数据 Rodden AstroDatabank 名人库 celebrity 星盘目录' },
];

// 悬停预取:鼠标掠过导航项即预载对应 lazy chunk(React.lazy 幂等,重复调用零成本;
// 已预载/主包组件 = no-op)。「其他」在命/卜两组重名 → 两个 key 都取。
// 主导航渲染 label(mainTab),预取按 key —— navigationPages 之外的三个主 tab
// (内容/管理组,不进模块选择器)手工补映射,否则其悬停恒 no-op。
const NAV_LABEL_TO_KEYS = {
	书籍阅读: ['astroreader'],
	星阙直播: ['liveplayer'],
	管理工具: ['admintools'],
};
for(const page of navigationPages){
	if(!NAV_LABEL_TO_KEYS[page.label]){
		NAV_LABEL_TO_KEYS[page.label] = [];
	}
	NAV_LABEL_TO_KEYS[page.label].push(page.key);
}
function preloadNavByLabel(label){
	const keys = NAV_LABEL_TO_KEYS[label];
	if(!keys){
		return;
	}
	for(const key of keys){
		preloadNavByKey(key);
	}
}

// 占星主面板「相关技法」快捷入口 —— 纯静态数据,hoist 到模块级(每次 render 复用同一引用),
// 避免内联字面量每帧换引用击穿下游 sCU/memo(配合 B 层重组件 sCU 真生效)。
const ASTROCHART_FEATURE_LINKS = [
    { label: '星运', key: 'direction', desc: '推运、返照与时序' },
    { label: '辅盘', key: 'auxchart', desc: '量化、十三分与地图' },
    { label: '合盘', key: 'relativechart', desc: '关系与组合分析' },
    { label: '分至', key: 'jieqichart', desc: '节气与太阳时点' },
];

const fullHeightWorkspaceTabs = new Set([
    'astrochart',
    'direction',
    'bazi',
    'ziwei',
    'guolao',
    'indiachart',
    'auxchart',
    'relativechart',
    'shusuan',
    'mingother',
    'sanshiunited',
    'liureng',
    'dunjia',
    'guazhan',
    'taiyi',
    'jieqichart',
    'fengshui',
    'cnyibu',
    'aianalysis',
    'astrochart3D',
    'planetarium',
    'calendar',
    'cntradition',
    'xuanshi',
    'astrodata',
]);

function mainTab(label, group, options = {}){
    const icon = mainTabIcons[label] || <XQIcon name="astro" />;
    return (
        <span
            className={`horosa-main-tab-label${options.hidden ? ' horosa-main-tab-hidden' : ''}`}
            title={label}
            aria-label={label}
            onMouseEnter={() => preloadNavByLabel(label)}
        >
            <span className="horosa-main-tab-icon">{icon}</span>
            <span className="horosa-main-tab-copy">
                {group ? <span className="horosa-main-tab-group">{group}</span> : null}
                <span className="horosa-main-tab-text">{label}</span>
            </span>
        </span>
    );
}

// ── 切页流畅度:脏标记签名 ──────────────────────────────────────────────────
// changeTab 旧逻辑每次切 tab 都同步 predictHook[key].fun(fields) 强制重算/重取目标技法
// (实测紫微 ~870ms 同步计算 + ~1920ms 由其内部 setState 触发的重渲 ≈ 3s,即用户「切页卡」根因)。
// XQTabs 是 keep-alive(切过的面板不卸载、内容仍在),所以盘没变时这次刷新是纯浪费。
// 修法:给每个 tab 记「上次刷新时的输入签名」。签名 = 全部 fields 值 + chartObj.chartId
//   - chartId 在模型每次出盘都 randomStr(8) 重新生成(见 astro.js 4 处),是「盘换了」的可靠廉价信号;
//   - fields 全量值兜底「只改设置(未触发 /chart 重取)也要刷新」的场景。
// 目标 tab 当前签名 === 上次刷新签名 → 跳过 fun(keep-alive 已是最新,切换瞬间);
// 签名变了(改了盘/参数)才刷新并记录新签名 → 盘变必刷新,零功能降级。
function stableFieldValueToken(value){
    if(value === null || value === undefined){
        return '';
    }
    // moment / Date 等:用 valueOf() 取 epoch 毫秒(稳定且廉价,避免每次 format)。
    if(typeof value === 'object'){
        if(typeof value.valueOf === 'function'){
            const v = value.valueOf();
            if(typeof v === 'number' || typeof v === 'string'){
                return String(v);
            }
        }
        try{
            return JSON.stringify(value);
        }catch(e){
            return '';
        }
    }
    return String(value);
}

function computeRefreshSignature(fields, chartObj){
    let sig = 'cid:' + ((chartObj && chartObj.chartId) || '');
    if(fields){
        const keys = Object.keys(fields).sort();
        for(let i = 0; i < keys.length; i++){
            const k = keys[i];
            const fld = fields[k];
            const value = (fld && typeof fld === 'object' && 'value' in fld) ? fld.value : fld;
            sig += '|' + k + '=' + stableFieldValueToken(value);
        }
    }
    return sig;
}
// ────────────────────────────────────────────────────────────────────────────

function AstroIndex({dispatch, astro, app, user, rules, }){
    // 首屏就绪后空闲预载全部技法 chunk(不影响启动;切技法零等待)。
    React.useEffect(()=>{
        startIdlePreload();
        // WS-3c 空闲预热队列:chunk 预载(上行,1s 起步)之后错峰启动(4s 起步),
        // 动态 import 高频本地引擎模块(常量表/JIT 挪进空闲)——暖后任意技法首点亚秒;
        // 用户任何交互即让路;kill-switch horosa.perf.idleWarmQueue。
        import('../utils/idleWarmQueue').then((m)=>{ m.startIdleWarmQueue(); }).catch(()=>{});
    }, []);
    // 每个 tab「上次刷新时的输入签名」(脏标记)。用 ref:可变、跨渲染留存、改它不触发重渲。
    const tabRefreshSigRef = React.useRef({});
    const { tokenImg, registerFields, loginFields, loading, loadingText, refresh, chartDisplay, chartStyle, indiaChartStyle, aspects, planetDisplay, lotsDisplay, resolvedAppearance, showPdBounds, showPlanetHouseInfo, showAstroMeaning, showOnlyRulExaltReception, schoolPreset, tripSystem, voidClassical} = app;
    const {
        pwdFields,
        userInfo,
        charts,
        currentChart,
        admin,
        pageSize,
        pageIndex,
        total,
        cases,
        currentCase,
        casePageSize,
        casePageIndex,
        caseTotal,
    } = user;
 	const { height, fields, chartObj, drawerVisible, predictHook, memo, memoType, currentTab, currentSubTab, deeplearn} = astro;
    const { ziwei, } = rules;
    // horosa_gesture_start_v1:把「当前是哪个技法」告诉观测层。perfMark 用一个捕获期
    // pointerdown/keydown 监听给**所有**交互提供起点(技法内部的选项改动不经过 changeCond,
    // 此前一律没有起点 ⇒ owner 验收口径里的「选项」那一半根本量不出来);监听本身拿不到
    // 「现在在哪个技法」,故由这里推给它。纯观测,失败静默。
    React.useEffect(()=>{
        setCurrentTechnique(currentTab);
    }, [currentTab]);
    // PERF-R8 P0(纯观测):chartObj 提交后 double-rAF 打 render-complete —— 两帧后浏览器
    // 必已完成本次提交的布局与绘制,与 refresh-end 配对量化前端渲染份额。失败静默。
    React.useEffect(()=>{
        if(!(chartObj && chartObj.chartId)){ return; }
        try{
            if(typeof performance !== 'undefined' && performance.mark && typeof requestAnimationFrame === 'function'){
                requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
                    try{
                        performance.mark('horosa:chart:render-complete');
                        if(performance.measure){
                            performance.measure('horosa:chart:render', 'horosa:chart:refresh-end', 'horosa:chart:render-complete');
                        }
                    }catch(e){ /* observation only */ }
                }); });
            }
        }catch(e){ /* observation only */ }
    }, [chartObj && chartObj.chartId]);
    // PERF-R8 P2:排盘成功后的数据层空闲预热 —— 把「用户首点某技法才付的取数成本」挪进
    // 空闲时段:走各技法**自己导出的 builder + 缓存入口**(key/body 与真实首点逐字节一致,
    // 结果自然落各自 L1;首点=命中即时)。组以 chartId 为代(新盘作废旧组);任务内动态
    // import(不拖 chunk 进主包,顺带引擎预热);全部 silent、只进确定性端点、交互即让路。
    // 双闸:horosa.perf.idleWarmQueue(总)/ horosa.perf.dataWarmTasks(细)。失败静默。
    React.useEffect(()=>{
        if(!(chartObj && chartObj.chartId) || !fields || !(fields.date && fields.date.value)){ return; }
        const warmFields = fields;
        const warmChartObj = chartObj;
        // PERF-R9 Ship 7:任务清单从此处写死的 4 条数组,改为 utils/dataWarmTasks 的注册表
        // (登记序=首点概率序=执行序)。页面组件不再持有技法知识 —— 新技法接线只需在
        // dataWarmTasks 加一行登记,漏项一目了然(本轮就是这样补上紫微/遁甲/太乙/分至的)。
        Promise.all([
            import('../utils/idleWarmQueue'),
            import('../utils/dataWarmTasks'),
        ]).then(([queue, registry])=>{
            if(!queue || typeof queue.scheduleDataWarmGroup !== 'function'){ return; }
            if(!registry || typeof registry.buildDataWarmTasks !== 'function'){ return; }
            queue.scheduleDataWarmGroup(chartObj.chartId, registry.buildDataWarmTasks(warmFields, warmChartObj));
        }).catch(()=>{ /* 预热不可用=回到现状 */ });
    }, [chartObj && chartObj.chartId]);

    
    function closeDrawer(){
        dispatch({
            type: 'astro/closeDrawer',
            payload:{},
        });
    }

    function openDrawer(key){
        dispatch({
            type: 'astro/openDrawer',
            payload:{
                key: key,
            },
        });
    }

    function changeTab(key){
        // 切页流畅度:盘(fields+chartId)签名未变 → 跳过 predictHook.fun(keep-alive 面板已最新 → 切换瞬间);
        // 变了才刷新并记签名 → 盘变必刷新、零降级。刷新放 dispatch 之后 setTimeout(0) → 切换观感瞬间、刷新随后带 spinner。
        const currentSig = computeRefreshSignature(fields, chartObj);
        const needRefresh = !!(predictHook[key] && predictHook[key].fun) && tabRefreshSigRef.current[key] !== currentSig;

        const cnTraditionTabs = ['guasym', 'cuangong12', 'pithy'];
        const cnYiBuTabs = ['suzhan', 'jinkou', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu'];
        const auxChartTabs = ['germanytech', 'hellenastro', 'locastro', 'harmonic', 'otherbu', 'horary', 'election'];
        let nextSubTab = null;
        if(key === 'cntradition'){
            nextSubTab = cnTraditionTabs.indexOf(currentSubTab) >= 0 ? currentSubTab : 'guasym';
        }else if(key === 'cnyibu'){
            nextSubTab = cnYiBuTabs.indexOf(currentSubTab) >= 0 ? currentSubTab : 'suzhan';
        }else if(key === 'auxchart'){
            nextSubTab = auxChartTabs.indexOf(currentSubTab) >= 0 ? currentSubTab : 'germanytech';
        }else if(key === 'direction' || key === 'relativechart'){
            nextSubTab = currentSubTab;
        }
        
        dispatch({
            type: 'astro/save',
            payload:{
                chartObj: chartObj,
                currentTab: key,
                currentSubTab: nextSubTab,
            },
        });

        // 盘变了才刷新目标技法,且延迟到切换 paint 之后(切换瞬间、刷新随后带 spinner);盘没变=跳过=纯瞬间。
        if(needRefresh){
            tabRefreshSigRef.current[key] = currentSig;
            // perf:userTimingMarks —— 「切页→技法刷新开始」User-Timing 打点(纯观测,DevTools/
            // Performance 面板可读;量化点击→显示的前端份额)。失败静默。
            try{ if(typeof performance !== 'undefined' && performance.mark){ performance.mark(`horosa:tab:${key}:refresh-start`); } }catch(e){ /* observation only */ }
            setTimeout(()=>{
                if(!(predictHook[key] && predictHook[key].fun)){ return; }
                if(key === 'indiachart' || key === 'cntradition' || key === 'jieqichart'
                    || key === 'otherbu' || key === 'cnyibu' || key === 'germanytech'
                    || key === 'guolao' || key === 'hellenastro'  || key === 'astrochart'
                    || key === 'locastro' || key === 'admintools' || key === 'astrochart3D'
                    || key === 'planetarium'
                    || key === 'fengshui' || key === 'sanshiunited' || key === 'aianalysis'
                    || key === 'bazi' || key === 'ziwei' || key === 'guazhan'
                    || key === 'liureng' || key === 'dunjia' || key === 'taiyi'
                    || key === 'shusuan' || key === 'mingother'
                    || key === 'auxchart'){
                    predictHook[key].fun(fields);
                }else if(key === 'astroreader'){
                    predictHook[key].fun();
                }else{
                    predictHook[key].fun(chartObj);
                }
            }, 0);
        }

    }

    // horosa_change_cond_no_mutate_v1 —— 就地变异根治。
    // 旧写法 `{...fields}` **只拷了顶层**:`flds.date` 与 `fields.date` 是同一个对象,
    // `flds.date.value = x` 改的是 state 里那个对象本身 ⇒ 「旧 fields」与「新 fields」的
    // 嵌套对象引用完全相同,任何按引用比较的 React.memo / shouldComponentUpdate 都会判
    // 「没变」而跳过重渲(或反过来:整树重渲,因为顶层引用永远是新的)。这正是本轮渲染
    // 优化的**前提** —— 不修它,后面加多少 memo 都是白加。
    // 与 models/astro.js 的 fetchByChartData 早已修好的是同一个 bug(注释见该文件 ~1260)。
    // setFld 一律产出**新对象**;`{...(prev || {name:[name]})}` 保留原有 name 数组与其它
    // 键,value 立即覆盖 ⇒ 与旧代码那几处「不存在则以默认值新建再赋值」逐字段等价。
    const setFld = (obj, name, value) => {
        obj[name] = { ...(obj[name] || { name: [name] }), value };
        return obj[name];
    };

    function changeCond(values){
        let flds = {
            ...fields,
        };
        if(values.nohook){
            flds.nohook = true;
        }

        if(values.tm !== undefined && values.tm != null){
            let birth = values.tm;
            setFld(flds, 'date', birth.clone());
            setFld(flds, 'time', birth.clone());
            setFld(flds, 'ad', birth.ad);
            setFld(flds, 'zone', birth.zone);
        }

        if(values.hsys !== undefined && values.hsys !== null){
            setFld(flds, 'hsys', values.hsys);
        }
        if(values.zodiacal !== undefined && values.zodiacal !== null){
            setFld(flds, 'zodiacal', values.zodiacal);
        }
        if(values.siderealAyanamsa !== undefined && values.siderealAyanamsa !== null){
            setFld(flds, 'siderealAyanamsa', values.siderealAyanamsa);
        }
        if(values.termsVariant !== undefined && values.termsVariant !== null){
            // 界系：流派预设(G20)一次性带入界 → 写 fields.termsVariant，由 fieldsToParams 条件透传(0 不下发，零回归)。
            // 同时同步 app.termsVariant(界系 UI 记忆，与 ChartDisplaySelector 单改一致)。
            setFld(flds, 'termsVariant', values.termsVariant);
            dispatch({ type: 'app/save', payload: { termsVariant: values.termsVariant } });
        }
        if(values.triplicity !== undefined && values.triplicity !== null){
            // 三分集(G20-P2)：流派预设带入 → 写 fields.triplicity，由 fieldsToParams 条件透传(Dorothean 不下发，零回归)。
            // 后端 push_request_trip 据此换尊贵表;同步 app.tripSystem(三分显示，与 G14 选择器一致)。
            setFld(flds, 'triplicity', values.triplicity);
            dispatch({ type: 'app/save', payload: { tripSystem: values.triplicity } });
        }
        if(values.lon !== undefined && values.lon !== null){
            setFld(flds, 'lon', values.lon);
            setFld(flds, 'lat', values.lat);
            setFld(flds, 'gpsLon', values.gpsLon);
            setFld(flds, 'gpsLat', values.gpsLat);
        }
        if(values.pos !== undefined){
            // 经纬度查找选点带回的地名 → 写 fields.pos(显示于「地点」+ 随盘储存 + 进 AI 快照);
            // 空串=据实清空(地图裸点逆地理失败/手输经纬无地名),不带 pos 键=仅改时区不动地名。
            setFld(flds, 'pos', `${values.pos || ''}`);
        }
        if(values.southchart !== undefined && values.southchart !== null){
            setFld(flds, 'southchart', values.southchart);
        }
        // Windows-ahead defensive guard: a restored/imported chart payload may omit a
        // form field or carry a numeric `lat`; ensureField guarantees the field object
        // exists, and `lat` is String()-coerced before .toLowerCase() below (a numeric
        // lat would otherwise throw). Guarded by release_selfcheck.py.
        const ensureField = (obj, name) => {
            if(obj && !obj[name]){ obj[name] = { value: undefined }; }
            return obj ? obj[name] : { value: undefined };
        };
        if(ensureField(flds, 'lat').value >= 0){
            let lat = String(flds.lat.value);
            if(lat.toLowerCase().indexOf('n') >= 0){
                // 同上(horosa_change_cond_no_mutate_v1):经 setFld 写新对象,
                // 不再对 ensureField 取回的既有字段对象就地赋值。
                setFld(flds, 'southchart', 0);
            }
        }

        const isUnconfirmedTime = values && values.tm !== undefined && values.tm !== null && values.confirmed === false;
        if(isUnconfirmedTime){
            const queuedPayload = {
                ...flds,
                __requestOptions: {
                    silent: true,
                },
                // 步进方向提示(WP-P1):effect 内剥离后驱动「下一步」预取,绝不落 state.fields
                ...(values.step ? { __stepHint: values.step } : {}),
            };
            // 交互起点:必须在防抖调度**之前**打,否则量到的是「防抖之后」而不是「用户点下」。
            markInteractionStart(currentTab);
            // 防抖改形(极速化大修 WP-E):leading 立发 + trailing 合并 —— 单次操作 0ms 起跑
            // (旧式纯 trailing 每次白等 180ms);连点首发立即、中间全并、末发 trailing 兜底;
            // 乱序由 fetchByFields 的 epoch 兜。调度器独立成 utils/timeDispatchScheduler
            // (index.js 闭包无法 fake-timers 单测;开关 horosa.perf.leadingDebounce 在其内)。
            scheduleUnconfirmedTimeDispatch((payload)=>{
                dispatch({
                    type: 'astro/fetchByFields',
                    payload,
                });
            }, queuedPayload);
            return flds;
        }

        // confirmed(「确定」等)直发前取消在途 trailing —— 否则旧 trailing 会追发一枪陈旧 payload
        cancelPendingTimeDispatch();

        markInteractionStart(currentTab);
        dispatch({
            type: 'astro/fetchByFields',
            payload: flds,
        });

        return flds;
    }

    function endRefresh(){
        setTimeout(()=>{
            dispatch({
                type: 'app/endRefresh',
                payload: {},
            });               
        }, 1000);
    }
    
    AstroConst.setColorTheme(resolvedAppearance === APPEARANCE_DARK ? 8 : AstroConst.DefaultColorTheme);
    
    let idxstyle = {
        backgroundColor: 'var(--horosa-bg)',
        height: height,
    };

    if(refresh){
        endRefresh();
    }

    let tip = '载入中...';
    if(loadingText){
        tip = loadingText;
    }

    // [更新徽标定位] 把「更新中…」小徽标钉到当前技法中间盘的右上角(而非窗口角);找不到盘则回退 CSS 默认(窗口右上)。
    // ref 回调:徽标挂载即测量当前可见的中盘容器 rect,就地定位——一处改,全技法通用。
    const positionUpdatingBadge = (el)=>{
        if(!el || typeof document === 'undefined'){ return; }
        try{
            const vis = (s)=> s && s.offsetParent !== null && s.getBoundingClientRect().width > 120;
            let stage = null;
            const cand = document.querySelectorAll('.horosa-chart-stage-redesign, .horosa-chart-stage');
            for(let i = 0; i < cand.length; i++){ if(vis(cand[i])){ stage = cand[i]; break; } }
            if(!stage){
                const grids = document.querySelectorAll('.horosa-astro-redesign-grid');
                for(let j = 0; j < grids.length; j++){ const mid = grids[j].children[1]; if(vis(mid)){ stage = mid; break; } }
            }
            if(stage){
                const r = stage.getBoundingClientRect();
                el.style.top = Math.round(r.top + 10) + 'px';
                el.style.right = Math.round(window.innerWidth - r.right + 12) + 'px';
                el.style.left = 'auto';
            }
        }catch(e){ /* 定位失败回退 CSS 默认位置 */ }
    };

    let aryfields = convertToArray(fields);
    let arychartflds = convertToArray(currentChart);
    let arycaseflds = convertToArray(currentCase);
    let aryregflds = convertToArray(registerFields);
    let aryloginflds = convertToArray(loginFields);
    const drawerNavigationPages = navigationPages.concat(
        userInfo ? [
            { label: '书籍阅读', key: 'astroreader', icon: 'book', group: '内容' },
            { label: '星阙直播', key: 'liveplayer', icon: 'live', group: '内容' },
        ] : [],
        admin ? [{ label: '管理工具', key: 'admintools', icon: 'admin', group: '管理' }] : []
    );

    const activeMainTab = currentTab === 'yanqin' ? 'mingother' : currentTab;
    const isFullHeightWorkspaceTab = fullHeightWorkspaceTabs.has(activeMainTab);
    const rootTabsHeight = isFullHeightWorkspaceTab ? 'calc(100vh - 72px)' : height;

	// 顶层兜底:TabPane 之外的 chrome(导航/抽屉/快捷坞)崩溃也不白屏(技法页级隔离见 FreezeInactive)
	return (
		<TechniqueErrorBoundary label="应用">
		<div style={idxstyle}>
        {/* [连续调整不打断] 去满屏压暗遮罩:请求进行中改为右上角非阻塞「更新中…」小徽标;
            盘面 keep-stale(各技法本就在重算时保留旧盘态,不清空),故调时间可连续不闪。 */}
        {loading ? <div className="horosa-workspace-updating" ref={positionUpdatingBadge}>{tip || '更新中…'}</div> : null}
        <Spin spinning={false}>
            <React.Suspense fallback={<div style={{padding:40,textAlign:'center'}}><Spin size="large" tip="加载中…" /></div>}>
            <XQTabs
                defaultActiveKey="astrochart" tabPosition='left' onChange={changeTab}
                activeKey={activeMainTab}
                className={`mainRootTabs horosa-nav-in-drawer horosa-unified-shell-active${isFullHeightWorkspaceTab ? ' horosa-astro-shell-active' : ''}${activeMainTab === 'bazi' ? ' horosa-bazi-shell-active' : ''}${activeMainTab === 'dunjia' ? ' horosa-dunjia-shell-active' : ''}${activeMainTab === 'sanshiunited' ? ' horosa-sanshi-shell-active' : ''}`}
                style={{ height: rootTabsHeight }}
            >
                <TabPane tab={mainTab('占星', '命')} key="astrochart">
                  <FreezeInactive active={activeMainTab === "astrochart"}>
	                    <AstroChartMain
	                        value={chartObj}
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        chartStyle={chartStyle}
                        aspects={aspects}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPdBounds={showPdBounds}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        showOnlyRulExaltReception={showOnlyRulExaltReception}
	                        schoolPreset={schoolPreset}
	                        tripSystem={tripSystem}
	                        voidClassical={voidClassical}
	                        memo={memo}
	                        dispatch={dispatch}
	                        hook={predictHook.astrochart}
                            onNavigate={changeTab}
                            showQuickActions={true}
                            featureLinks={ASTROCHART_FEATURE_LINKS}
	                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('星运', null, { hidden: true })} key="direction">
                  <FreezeInactive active={activeMainTab === "direction"}>
	                    <AstroDirectMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        chartObj={chartObj}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        tripSystem={tripSystem}
	                        hook={predictHook.direction}
	                        dispatch={dispatch}
	                        currentSubTab={currentSubTab}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('八字')} key="bazi">
                  <FreezeInactive active={activeMainTab === "bazi"}>
                    <BaZi
                        height={height}
                        fields={fields}
                        hook={predictHook.bazi}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('紫微')} key="ziwei">
                  <FreezeInactive active={activeMainTab === "ziwei"}>
                    <ZiWeiMain
                        height={height}
                        fields={fields}
                        hook={predictHook.ziwei}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('七政')} key="guolao">
                  <FreezeInactive active={activeMainTab === "guolao"}>
                    <GuoLaoChartMain 
                        value={chartObj} 
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        indiaChartStyle={indiaChartStyle}
                        planetDisplay={planetDisplay}
                        lotsDisplay={lotsDisplay}
                        hook={predictHook.guolao}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('印占')} key="indiachart">
                  <FreezeInactive active={activeMainTab === "indiachart"}>
	                    <IndiaChartMain
                        onChange={changeCond}
                        fields={fields} 
                        fieldsAry={aryfields}
                        height={height} 
                        chartDisplay={chartDisplay}
                        indiaChartStyle={indiaChartStyle}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.indiachart}
	                        dispatch={dispatch}
	                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('辅盘', null, { hidden: true })} key="auxchart">
                  <FreezeInactive active={activeMainTab === "auxchart"}>
                    <AuxChartMain
                        chart={chartObj}
                        onChange={changeCond}
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
                        lotsDisplay={lotsDisplay}
                        showPlanetHouseInfo={showPlanetHouseInfo}
                        showAstroMeaning={showAstroMeaning}
                        hook={predictHook.auxchart}
                        chartStyle={chartStyle}
                        dispatch={dispatch}
                        currentSubTab={currentSubTab}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('合盘', null, { hidden: true })} key="relativechart">
                  <FreezeInactive active={activeMainTab === "relativechart"}>
	                    <AstroRelative
                        fields={fields}
                        fieldsAry={aryfields}
                        height={height}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        chartStyle={chartStyle}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        hook={predictHook.relativechart}
	                        dispatch={dispatch}
	                        onChange={changeCond}
	                        currentSubTab={currentSubTab}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('数算', null, { hidden: true })} key="shusuan">
                  <FreezeInactive active={activeMainTab === "shusuan"}>
                    <ShuSuanMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.shusuan}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('其他', null, { hidden: true })} key="mingother">
                  <FreezeInactive active={activeMainTab === "mingother"}>
                    <MingOtherMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.mingother}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('三式', '卜')} key="sanshiunited">
                  <FreezeInactive active={activeMainTab === "sanshiunited"}>
	                    <SanShiUnitedMain
	                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
	                        chartObj={chartObj}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        dispatch={dispatch}
	                        hook={predictHook.sanshiunited}
	                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('六壬')} key="liureng">
                  <FreezeInactive active={activeMainTab === "liureng"}>
                    <LiuRengMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.liureng}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('遁甲')} key="dunjia">
                  <FreezeInactive active={activeMainTab === "dunjia"}>
                    <DunJiaMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.dunjia}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('六爻')} key="guazhan">
                  <FreezeInactive active={activeMainTab === "guazhan"}>
                    <GuaZhanMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.guazhan}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('太乙')} key="taiyi">
                  <FreezeInactive active={activeMainTab === "taiyi"}>
                    <TaiYiMain
                        value={chartObj}
                        height={height}
                        fields={fields}
                        hook={predictHook.taiyi}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('分至', null, { hidden: true })} key="jieqichart">
                  <FreezeInactive active={activeMainTab === "jieqichart"}>
	                    <JieQiChartsMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
	                        lotsDisplay={lotsDisplay}
	                        showPlanetHouseInfo={showPlanetHouseInfo}
	                        showAstroMeaning={showAstroMeaning}
	                        chartStyle={chartStyle}
	                        hook={predictHook.jieqichart}
	                        dispatch={dispatch}
	                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('风水')} key="fengshui">
                  <FreezeInactive active={activeMainTab === "fengshui"}>
                    <FengShuiMain
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        hook={predictHook.fengshui}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('其他')} key="cnyibu">
                  <FreezeInactive active={activeMainTab === "cnyibu"}>
                    <CnYiBuMain
                        chart={chartObj}
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
                        hook={predictHook.cnyibu}
                        dispatch={dispatch}
                        currentSubTab={currentSubTab}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('AI分析', '工具')} key="aianalysis">
                  <FreezeInactive active={activeMainTab === "aianalysis"}>
                    <AIAnalysisMain
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        chartObj={chartObj}
                        dispatch={dispatch}
                        hook={predictHook.aianalysis}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('天文馆', '工具')} key="planetarium">
                  <FreezeInactive active={activeMainTab === "planetarium"}>
                    <PlanetariumMain
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        dispatch={dispatch}
                        hook={predictHook.planetarium}
                        active={activeMainTab === 'planetarium'}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('黄历')} key="calendar">
                  <FreezeInactive active={activeMainTab === "calendar"}>
                    <CalendarMain
                        height={height} 
                        fields={fields}
                        fieldsAry={aryfields}
                        hook={predictHook.calendar}
                        dispatch={dispatch}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('辅助')} key="cntradition">
                  <FreezeInactive active={activeMainTab === "cntradition"}>
                    <CnTraditionMain
                        chart={chartObj}
                        height={height}
                        fields={fields}
                        fieldsAry={aryfields}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
                        hook={predictHook.cntradition}
                        dispatch={dispatch}
                        currentSubTab={currentSubTab}
                    />
                  </FreezeInactive>
                </TabPane>


                <TabPane tab={mainTab('玄学史', '工具')} key="xuanshi">
                  <FreezeInactive active={activeMainTab === "xuanshi"}>
                    <XuanShiMain
                        height={height}
                        fields={fields}
                        dispatch={dispatch}
                        predictHook={predictHook}
                    />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('数据库', '工具')} key="astrodata">
                  <FreezeInactive active={activeMainTab === "astrodata"}>
                    <AstrodataPage dispatch={dispatch} resolvedAppearance={resolvedAppearance} />
                  </FreezeInactive>
                </TabPane>

                <TabPane tab={mainTab('3D星盘', '工具')} key="astrochart3D">
                  <FreezeInactive active={activeMainTab === "astrochart3D"}>
                    <AstroChartMain3D
                        value={chartObj}
                        onChange={changeCond}
                        fields={fields}
                        fieldsAry={aryfields}
                        height={height}
                        currentTab={activeMainTab}
                        chartDisplay={chartDisplay}
                        planetDisplay={planetDisplay}
                        lotsDisplay={lotsDisplay}
                        showPlanetHouseInfo={showPlanetHouseInfo}
                        showAstroMeaning={showAstroMeaning}
                        dispatch={dispatch}
                        hook={predictHook.astrochart3D}
                    />
                  </FreezeInactive>
                </TabPane>



                {
                    userInfo && (
                        <TabPane tab={mainTab('书籍阅读', '内容与管理')} key="astroreader">
                          <FreezeInactive active={activeMainTab === "astroreader"}>
                            <BookMain 
                                height={height}
                                userInfo={userInfo}
                                dispatch={dispatch}
                                hook={predictHook.astroreader}
                            />
                          </FreezeInactive>
                        </TabPane>
                    )
                }

                {
                    userInfo && (
                        <TabPane tab={mainTab('星阙直播')} key="liveplayer">
                          <FreezeInactive active={activeMainTab === "liveplayer"}>
                            <MediaMain 
                                height={height}
                                dispatch={dispatch}
                                userInfo={userInfo}
                                currentSubTab={currentSubTab}
                                admin={admin}
                            />
                          </FreezeInactive>
                        </TabPane>
                    )
                }

                {
                    admin && (
                        <TabPane tab={mainTab('管理工具')} key="admintools">
                          <FreezeInactive active={activeMainTab === "admintools"}>
                            <AdminToolsMain />
                          </FreezeInactive>
                        </TabPane>
                    )
                }

            </XQTabs>
            </React.Suspense>

            <Drawer
                title='星盘配置'
                width={720}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.query}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <AstroFormComp 
                    { ...fields }
                    fields={fields}
                    fieldsAry={aryfields}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='注册'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.register}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <RegisterForm 
                    {...registerFields}
                    tokenImg={tokenImg}
                    fields={registerFields}
                    fieldsAry={aryregflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='登录'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.login}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <LoginForm 
                    {...loginFields}
                    fields={loginFields}
                    fieldsAry={aryloginflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='忘记密码'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.resetpwd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ResetPwdForm 
                    {...registerFields}
                    tokenImg={tokenImg}
                    fields={registerFields}
                    fieldsAry={aryregflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='修改密码'
                width={300}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.changepwd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChangePwdForm 
                    {...pwdFields}
                    fields={pwdFields}
                    fieldsAry={convertToArray(pwdFields)}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='修改参数'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.changeparams}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChangeParamsFormComp 
                    {...fields}
                    fields={fields}
                    fieldsAry={aryfields}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='添加星盘'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartadd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartAddFormComp 
                    {...currentChart}
                    fields={currentChart}
                    fieldsAry={arychartflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='编辑星盘'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartedit}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartEditFormComp 
                    {...currentChart}
                    fields={currentChart}
                    fieldsAry={arychartflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='星盘列表'
                width={950}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.chartlist}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartList
                    height={height} 
                    userInfo={userInfo}
                    charts={charts}
                    pageSize={pageSize}
                    pageIndex={pageIndex}
                    total={total}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='添加起课'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.caseadd}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <CaseAddFormComp
                    {...currentCase}
                    fields={currentCase}
                    fieldsAry={arycaseflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='编辑起课'
                width={700}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.caseedit}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <CaseEditFormComp
                    {...currentCase}
                    fields={currentCase}
                    fieldsAry={arycaseflds}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='起课列表'
                width={950}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.caselist}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <CaseList
                    height={height}
                    userInfo={userInfo}
                    cases={cases}
                    casePageSize={casePageSize}
                    casePageIndex={casePageIndex}
                    caseTotal={caseTotal}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='相位选择'
                width={250}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectasp}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <AspSelector
                    value={aspects}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='容许度设置'
                width={280}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectorb}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}
            >
                <AstroOrbSetting
                    fields={fields}
                    chartObj={chartObj}
                    dispatch={dispatch}
                    onClose={closeDrawer}
                />
            </Drawer>

            <Drawer
                title='显示星体'
                width={250}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectplanet}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <PlanetSelector
                    value={planetDisplay}
                    lots={lotsDisplay}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='星盘组件'
                width={560}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.selectchartdisplay}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartDisplaySelector
                    value={chartDisplay}
                    showPdBounds={fields && fields.showPdBounds ? fields.showPdBounds.value : showPdBounds}
                    showPlanetHouseInfo={showPlanetHouseInfo}
                    showAstroMeaning={showAstroMeaning}
                    showOnlyRulExaltReception={showOnlyRulExaltReception}
                    termsVariant={fields && fields.termsVariant ? fields.termsVariant.value : 0}
                    voidClassical={voidClassical}
                    fields={fields}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='我的星盘分布'
                width={900}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={true}
                open={drawerVisible.chartsgps}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartsGps
                    height={height} 
                    charts={charts}
                    userInfo={userInfo}
                    dispatch={dispatch}
                />
            </Drawer>

            <Drawer
                title='命盘批注'
                width={500}
                placement="right"
                destroyOnClose={true}
                onClose={closeDrawer}
                maskClosable={true}
                open={drawerVisible.memo}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <ChartMemo
                    memoType={memoType}
                    memo={memo}
                    currentSubTab={currentSubTab}
                    currentTab={activeMainTab}
                    userInfo={userInfo}
                    currentChart={currentChart}
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

            <Drawer
                title='小工具'
                width={960}
                placement="left"
                className="horosa-commtools-drawer"
                destroyOnClose={true}
                onClose={closeDrawer}
                maskClosable={true}
                open={drawerVisible.commtools}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <CommToolsMain
                    fields={fields}
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

            <Drawer
                title='人生事件设置'
                width={1000}
                placement="left"
                onClose={closeDrawer}
                maskClosable={true}
                destroyOnClose={false}
                open={drawerVisible.chartdeeplearn}
                style={{
                    height: 'calc(100% - 0px)',
                    overflow: 'auto',
                    paddingBottom: 53,
                    backgroundColor: 'transparent',
                }}        
            >
                <DLFeature
                    {...currentChart}
                    fields={currentChart}
                    fieldsAry={arychartflds}
                    deeplearn={deeplearn}
                    height={height} 
                    dispatch={dispatch}
                    loading={loading}
                />
            </Drawer>

            <XQModal
                title={null}
                footer={null}
                centered
                closable={false}
                width={1228}
                destroyOnClose={true}
                maskClosable={true}
                open={drawerVisible.homepage}
                onCancel={closeDrawer}
                className="xq-nav-popup"
                transitionName="xq-nav-popup-motion"
                maskTransitionName="xq-nav-popup-mask-motion"
            >
                <div className="xq-nav-popup-shell">
                    <HomePageSetup
                        dispatch={dispatch}
                        loading={loading}
                        pages={drawerNavigationPages}
                        currentKey={activeMainTab}
                        onNavigate={changeTab}
                        onOpenTools={()=>openDrawer('commtools')}
                        onClose={closeDrawer}
                    />
                </div>
            </XQModal>

        </Spin>
		</div>
		</TechniqueErrorBoundary>
	);
}

function mapStateToProps(state){
    const { astro, app, user, rules, } = state;

    return {
		astro: astro,
        app: app,
        user: user,
        rules: rules,
    };
}

export default connect(mapStateToProps)(AstroIndex);
