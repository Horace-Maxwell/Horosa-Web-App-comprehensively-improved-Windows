// 技法页「排盘设置跨会话保留」登记表(制度的单一登记处)。
//
// 由来:用户实报「排盘设置改了之后,每次重开软件都要重设」。根子是各页的排盘口径只活在组件 state 里,
// 而「这一页到底哪些选项该保留」从来没有一张表 —— 新页整页漏掉、老页加了新选项也没人想起来。
// 本表让它变成机器可查的事:每页一条,写明
//   storageKey  落盘键(须在 storageKeyRegistry 登记为 settings、进备份面)
//   file        页面源文件(相对 src/)
//   exportName  页面里 definePageSettings(...) 的导出名
//   fields      保留哪些键(须与源文件里 schema 的键**逐个相同**,合同测试机械比对)
//   exempt      该页用户可改、但**明确不保留**的键,每个必须写理由(输入 / 随命主 / 归全局设置管 / 逐盘操作 …)
//   changeVia   该页「用户亲手改选项」走的入口形态,合同测试据此把页面里出现的可改键全部枚举出来:
//                 'stateKey'  —— 控件直接绑 this.state.X(value / checked)
//                 'optionKey' —— 统一走 onOptionChange('X', …)
//                 'extraKey'  —— 选项收在宿主盘壳的 extra 里,页面用 setExtra({ X: … }) 改
//                 'shellOnly' —— 页面自己没有可改选项,只有盘壳左栏的盘面字段(黄道 / 宫制)
//                 'stateDiff' —— 入口太多的页:componentDidUpdate 里按保留键前后值统一落盘;前提 = 本页零非用户入口
//                                (不回灌事盘、不接宿主下发口径),合同测试机械看守;分母 = 构造函数 state 字面量的全部键
//               枚举出来的每个键必须落在 fields ∪ exempt 里:页面加了新选项却没表态「留不留」= 合同测试红。
//   stateAlias  (可选)页面 render 里给 this.state 起的别名(如 const s = this.state → 's'),枚举器据此认 s.X。
//   consumers   (可选)设置件单独成文件、由多个组件共用时,列出这些组件:读 / 写 / 可改键枚举都在它们身上查。
//   keyAliases  (可选)组件 state 键名 → 本表字段名(叫法不同或各页各存时用)。
//
// 全站口径:只保留「设置」(口径 / 流派 / 算法 / 显示偏好),不保留「输入」(时间地点 / 占事 / 起卦数字 / 逐盘手填);
// 只在用户亲手改控件的 handler 里落盘 —— 载入命盘事盘回灌、宿主页下发口径、全局设置广播都不落。
// 与别的东西相交处的四条(合同测试 pageSettingsCaseAndHostSemantics 看守):
//   · 载入事盘 / 记录:记录里没有的设置键回出厂值,不沿用保存值;
//   · map 型字段只落亲手改的那个子键(store.saveMapEntry),不把 state 里整张表存下去;
//   · 择日宿主里内嵌的技法页:宿主扫描口径取自内嵌盘的(奇门择日)才共用保存值,扫描引擎另有钉死口径的(六壬 / 太乙 / 三式择日)不读不写;
//   · 离不开逐课输入的起法 / 模式不进候选;没有该控件的页不读共享保存值。
// 同一条理由适用于一批键时用它展开(登记表仍是逐键表态,只是不把同一句话抄几十遍)。
const sameReason = (keys, reason)=>keys.reduce((acc, k)=>{ acc[k] = reason; return acc; }, {});

export const PAGE_SETTINGS_REGISTRY = [
	{
		page: 'liureng', storageKey: 'horosa.liureng.settings.v1', file: 'components/lrzhan/LiuRengMain.js', exportName: 'LIURENG_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['timeAlg', 'guireng', 'castMethod', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai'],
		exempt: {
			wuxing: '十二长生五行缺省随日干;保留了就再也回不到「随日干」',
			xuanShiZhi: '选时时辰是每一课的输入',
			yanShuNum: '演数 / 报数数字是每一课的输入',
			zhanCategory: '占事类型是每一课的输入',
			xiangOn: '取象开关早已由旧键 liurengXiangOn 保留',
			chartType: '盘式早已由旧键 liurengPanView 保留',
			bifaQuery: '毕法检索词,输入',
		},
	},
	{
		page: 'dunjia', storageKey: 'horosa.dunjia.settings.v1', file: 'components/dunjia/DunJiaMain.js', exportName: 'DUNJIA_PAGE_SETTINGS', changeVia: ['optionKey', 'stateKey'],
		fields: ['paiPanType', 'zhiShiType', 'yueJiaQiJuType', 'qijuMethod', 'school', 'kongMode', 'yimaMode', 'timeAlg', 'zhirunLeapDays', 'godsPreset', 'jiGongMode', 'anGanMode', 'shiftZhiFuMode', 'yearJiaJu', 'dayJiaJu', 'keJiaFenDun', 'jinhanMenPai', 'mixTian', 'mixXing', 'mixMen', 'mixShen', 'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow', 'kongMarkBoth', 'showAllKong', 'keZiZhengHuanShi', 'showAnZhi', 'fullNameTips'],
		exempt: {
			sex: '性别随命主',
			shuziReportNumber: '报数是每一课的输入',
			shuziInput: '报数输入框的内容是每一课的输入',
			chartCategory: '盘类(事盘 / 命盘)是这一张盘的属性',
			faRelatedPeople: '法奇门相关人是每一课的输入',
			shiftPalace: '移星换斗是逐盘操作',
			fengJu: '封局是逐盘状态',
			after23NewDay: '23 点换日归全局设置管(全局现值为准;页内改动只覆盖本会话)',
			lateZiHourUseNextDay: '晚子时归全局设置管(同上)',
		},
	},
	{
		page: 'taiyi', storageKey: 'horosa.taiyi.settings.v1', file: 'components/taiyi/TaiYiMain.js', exportName: 'TAIYI_PAGE_SETTINGS', changeVia: ['optionKey', 'stateKey'],
		fields: ['style', 'tn', 'timeBasis', 'gameTheory', 'showBoardMark', 'school'],
		exempt: {
			sex: '命法性别随盘的性别',
			after23NewDay: '23 点换日归全局设置管',
			lateZiHourUseNextDay: '晚子时归全局设置管',
		},
	},
	{
		page: 'sanshiunited', storageKey: 'horosa.sanshi.settings.v1', file: 'components/sanshi/SanShiUnitedMain.js', exportName: 'SANSHI_PAGE_SETTINGS', changeVia: ['optionKey', 'stateKey'],
		fields: ['timeAlg', 'guireng', 'paiPanType', 'zhiShiType', 'yueJiaQiJuType', 'qijuMethod', 'school', 'kongMode', 'yimaMode', 'zhirunLeapDays', 'godsPreset', 'jiGongMode', 'anGanMode', 'shiftZhiFuMode', 'yearJiaJu', 'dayJiaJu', 'keJiaFenDun', 'jinhanMenPai', 'mixTian', 'mixXing', 'mixMen', 'mixShen', 'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow', 'kongMarkBoth', 'showAllKong', 'keZiZhengHuanShi', 'showAnZhi', 'taiyiStyle', 'taiyiAccum', 'taiyiTimeBasis', 'gameTheory', 'taiyiSchool', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai', 'outerCoord', 'showWeakSolid'],
		exempt: {
			mode: '命局 / 事局是「这一盘存去哪」的逐盘属性',
			chartCategory: '盘类是逐盘属性',
			faRelatedPeople: '法奇门相关人是每一课的输入',
			sex: '性别随命主',
			shuziReportNumber: '报数是每一课的输入',
			shiftPalace: '移星换斗是逐盘操作',
			fengJu: '封局是逐盘状态',
			after23NewDay: '23 点换日归全局设置管',
			lateZiHourUseNextDay: '晚子时归全局设置管',
		},
	},
	{
		page: 'jinkou', storageKey: 'horosa.jinkou.settings.v1', file: 'components/jinkou/JinKouMain.js', exportName: 'JINKOU_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['schoolYueJiang', 'schoolGuiTable', 'schoolGuiPan', 'panShi', 'soilChangSheng', 'timeBasis'],
		exempt: {
			diFenSource: '地分来源是每一课的输入',
			diFenSourceInput: '地分来源的手填内容是每一课的输入',
			askKey: '合占扣题是每一课的输入',
			shiJianKind: '专题时间类是每一课的输入',
			topicKey: '专题起式是每一课的输入',
			timeScope: '时段是每一课的输入',
			yueJiang: '月将覆写是每一课的输入(缺省自动)',
			zhanShi: '占时覆写是每一课的输入(缺省自动)',
			diFenAuto: '地分自动 / 手选是每一课的状态',
			wuxingAuto: '十二长生五行缺省随日干;保留了就再也回不到「随日干」',
		},
	},
	{
		page: 'wuzhao', storageKey: 'horosa.wuzhao.settings.v1', file: 'components/wuzhao/WuZhaoMain.js', exportName: 'WUZHAO_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['mode', 'shifaVariant', 'xingshenMonth', 'beastView', 'centerView'],
		exempt: {
			number: '干支起兆的报数是每一课的输入',
			qianThrows: '掷钱结果是每一课的输入',
			zhaoNums: '五兆数是每一课的输入',
			manualSplits: '手分蓍策是每一课的输入',
			leizhanTab: '类占门类是浏览位置,不是口径',
			mingZhi: '本命支随问卜人,是每一课的输入',
			gender: '性别随问卜人',
		},
	},
	{
		page: 'geomancy', storageKey: 'horosa.geomancy.settings.v1', file: 'components/geomancy/GeomancyMain.js', exportName: 'GEOMANCY_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['seedMode', 'tradition', 'readingScope', 'zodiacSystem', 'granular', 'planetaryChart', 'planetaryChartZodiac', 'planetaryChartNodes', 'planetaryChartExtras', 'showUnicodeGlyph', 'triangleSchool'],   // triangleSchool 是一排按钮(onClick),枚举器看不到,这里手工登记
		exempt: {
			question: '所问是每一卦的输入',
			questionType: '问类是每一卦的输入',
			quesitedHouse: '所问宫是每一卦的输入',
			manualSeed: '手工种子是每一卦的输入',
			castNumbersText: '报数是每一卦的输入',
			turnTo: '转宫是逐盘操作',
		},
	},
	{
		page: 'tarot', storageKey: 'horosa.tarot.settings.v1', file: 'components/tarot/TarotMain.js', exportName: 'TAROT_PAGE_SETTINGS', changeVia: 'stateKey', stateAlias: 's',
		fields: ['deckId', 'spreadType', 'artStyle', 'seedMode', 'useReversals', 'useDignities', 'variant', 'showCorrespondences', 'meaningSystem', 'showBottomCard', 'showCutCard', 'majorsOverlay', 'includeBlank', 'courtElementSystem', 'courtZodiacSystem', 'edVersion', 'reversalMode', 'reversalGen', 'astroModern', 'suitElementSwap', 'crossingUpright', 'ookTable', 'dummettOrder', 'verdictMode', 'quintMode', 'timingMethod', 'timingUnit'],
		exempt: {
			question: '所问是每一局的输入',
			manualSeed: '手动种子是每一局的输入',
			sig: '指示牌随问卜人的性别 / 年龄 / 星座,是每一局的输入',
		},
	},
	{
		// 一身多技法:策天飞星 / 演禽 / 一掌经 / 数算诸法(邵子 · 铁板 · 鬼谷分定经 · 北极 · 南极 · 蠢子数 · 参评数 · 河洛理数 · 神数正传)
		page: 'kinastro', storageKey: 'horosa.kinastro.settings.v1', file: 'components/kinastro/KinAstroMain.js', exportName: 'KINASTRO_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['cetianMethod', 'cetianLunarMode', 'cetianStarOrder', 'cetianShowWuXingJu', 'cetianShowSihua', 'cetianShowFlying', 'cetianShowBrightness', 'cetianShowSolarTerm', 'cetianBrightnessSchool', 'cetianShenGongMode', 'cetianDaxianMode', 'cetianTianluoMode', 'cetianPalaceNameMode', 'cetianLiunianQishaMode', 'cetianShowLiunian', 'cetianShowShensha', 'cetianShowZaYao', 'cetianShowDuanjue', 'cetianShowXiu', 'cetianShowBianyao', 'useKey', 'tiebanMethod', 'tiebanSchool', 'tiebanKeSystem', 'tiebanDayunSteps', 'chunziResultLimit', 'canpingMethod', 'canpingDayun', 'heluoQuHuaGong', 'heluoZiShu', 'heluoJiGong', 'heluoZhiZun', 'heluoPureGanKun', 'heluoLiunianStep2', 'heluoLiuYueMode', 'heluoHuangdiOffset', 'heluoShowLiuRi', 'zhengchuanSchool', 'yizhangjingPreset', 'yizhangjingShunni', 'yizhangjingMingGong', 'yizhangjingDayunLen', 'yizhangjingStartAge', 'yizhangjingXiaoStart', 'yizhangjingXiaoDir', 'yizhangjingAnnual', 'yizhangjingFlowSet', 'yizhangjingTongxian', 'yizhangjingChongfan', 'yizhangjingDingYue', 'yizhangjingLeapRule', 'yizhangjingZaoZi', 'yizhangjingStarNaming', 'yizhangjingDaoTerm', 'yizhangjingGradeSet', 'yizhangjingShensha'],
		exempt: {
			gender: '性别随命主',
			cetianLiunianYear: '流年年份是每次查看的输入(缺省今年)',
			...sameReason(['ke', 'tiebanKe', 'beijiKe', 'chunziKe', 'tiebanStartAge', 'tiebanTwinFen', 'tiebanGuofang'], '刻数 / 起运年龄 / 双胞胎分 / 过房养子随命主,是每一盘的输入'),
			...sameReason(['pillarOverride', 'yearGz', 'monthGz', 'dayGz', 'hourGz', 'fendjingStemOverride', 'fendjingYearStem', 'fendjingHourStem', 'beijiKeMode', 'chunziKeMode', 'chunziLunarMode', 'chunziLunarMonth', 'chunziLunarDay', 'calendarMode', 'lunarYear', 'lunarMonth', 'lunarDay', 'nanjiMode', 'nanjiAfterLichun', 'nanjiLunarYear', 'nanjiSolarMonth', 'nanjiDay', 'nanjiHourZhi', 'nanjiDayGan', 'nanjiDayZhi', 'chunziHourBranch', 'chunziMansion'], '手动覆写 / 手动指定模式与它的手填值是一体的,是每一盘的输入;只留模式不留值,重开后会拿缺省值起一张错盘'),
			...sameReason(['fatherBirthYear', 'fatherDeathYear', 'motherBirthYear', 'motherDeathYear', 'siblingsInfo', 'maritalStatus', 'childrenInfo'], '六亲考刻资料随命主,是每一盘的输入'),
			...sameReason(['beijiLookupCode', 'beijiKeyword', 'chunziLookupCode', 'chunziKeyword', 'chunziTags', 'nanjiSection', 'nanjiJianchu', 'nanjiXiu', 'nanjiPasswordCode', 'nanjiChart', 'nanjiPalace', 'nanjiDegree'], '查询码 / 关键词 / 推演宫 / 密码表 / 星图 / 宿度是查询位置,不是口径'),
			...sameReason(['zhengchuanAskGz', 'zhengchuanFatherAge', 'zhengchuanMotherAge', 'zhengchuanYuan', 'zhengchuanDadingYear', 'zhengchuanAge', 'zhengchuanDayun', 'zhengchuanXiaoyun', 'zhengchuanSuijun', 'zhengchuanAskHourZhi', 'zhengchuanEnv', 'zhengchuanItem', 'zhengchuanSound', 'zhengchuanKe', 'zhengchuanGong', 'zhengchuanXqZhi', 'zhengchuanXqYushu'], '神数正传各流派的求测时辰 / 父母年龄 / 元运 / 流年 / 查询项目是每一次推演的输入'),
		},
	},
	{
		// 卜卦盘的选项不在组件 state 里,而在盘壳的 extra 里(setExtra({ X: … }))与壳的盘面字段里(黄道 / 宫制,经 onUserFieldChange 回调)
		page: 'horary', storageKey: 'horosa.horary.settings.v1', file: 'components/horary/HoraryMain.js', exportName: 'HORARY_PAGE_SETTINGS', changeVia: 'extraKey',
		fields: ['horarySchool', 'horaryOverrides', 'chartFocus', 'overlayPerfection', 'overlayAntiscia', 'overlayTerms', 'overlayStars', 'zodiacal', 'siderealAyanamsa', 'hsys'],
		exempt: {
			questionText: '所问之事是每一问的输入',
			questionCategory: '问题类别是每一问的输入',
			castingCamp: '起盘阵营与问卜者时地是一体的,是每一问的输入',
			querent: '问卜者时刻 / 地点是每一问的输入',
			sincerityConfirmed: '问题真诚自评是对这一问的表态',
			confirmYouthMatch: '体貌合上升是对这一位问卜者的表态',
			isEventChart: '是否事件盘是这一张盘的属性',
		},
	},
	{
		page: 'mundane', storageKey: 'horosa.mundane.settings.v1', file: 'components/mundane/MundaneMain.js', exportName: 'MUNDANE_PAGE_SETTINGS', changeVia: 'extraKey',
		fields: ['mundaneRuleset', 'mundaneOrbScheme', 'mundaneIngressRule', 'solunarWeights', 'solunarOrb', 'vedicDashaYearLen', 'zodiacal', 'siderealAyanamsa', 'hsys'],
		exempt: {
			...sameReason(['mundaneType', 'mhKind', 'solunarType'], '起哪种盘 / 问哪类事是每一张盘的输入'),
			...sameReason(['ingressTerm', 'ingressYear', 'ingressMoment', 'scanYear', 'solunarYear', 'vedicYear', 'vedicFoundingYear', 'vedicNatalAsc'], '节气 / 年份 / 时刻 / 立国年与命宫是每一张盘的输入'),
			...sameReason(['regionKey', 'regionCn', 'regionFoundingYear'], '地区 / 国家是每一张盘的输入'),
		},
	},
	{
		page: 'election', storageKey: 'horosa.election.settings.v1', file: 'components/election/ElectionMain.js', exportName: 'ELECTION_PAGE_SETTINGS', changeVia: 'extraKey',
		fields: ['westSchool', 'electionParams', 'zodiacal', 'siderealAyanamsa', 'hsys'],
		exempt: {
			...sameReason(['topicId', 'tradeSide', 'talismanStar', 'surgeryPart', 'surgeryPartOpposite', 'crisisBase'], '用事类型 / 买卖方 / 护符星 / 手术部位 / 危机盘基准是每一次择日的输入'),
		},
	},
	{
		// 本页自己没有 extra 设置项,口径只有盘壳左栏的黄道 / 宫制(经 onUserFieldChange 回调落盘)
		page: 'tianxingzeri', storageKey: 'horosa.zeri.tianxing.settings.v1', file: 'components/zeri/TianxingElectionMain.js', exportName: 'TIANXING_PAGE_SETTINGS', changeVia: 'shellOnly',
		fields: ['zodiacal', 'siderealAyanamsa', 'hsys'],
		exempt: {},
	},
	{
		// 星运族:十几个独立组件共用一份(同一位用户的口径只有一套)。设置件单独成文件,各组件是 consumers。
		page: 'direction', storageKey: 'horosa.direction.settings.v1', file: 'utils/directionPageSettings.js', exportName: 'DIRECTION_PAGE_SETTINGS', changeVia: 'stateKey',
		consumers: ['components/astro/AstroDirectionForm.js', 'components/astro/AstroGivenYear.js', 'components/astro/AstroLunarReturn.js', 'components/astro/AstroSolarReturn.js', 'components/astro/AstroProfection.js', 'components/astro/AstroSolarArc.js', 'components/astro/AstroPlanetaryArc.js', 'components/astro/AstroPersianDirected.js', 'components/astro/AstroProgressions.js', 'components/astro/AstroJaynesProgressions.js', 'components/astro/AstroVedicProgressions.js', 'components/astro/AstroPlanetaryAges.js', 'components/astro/AstroTriplicityRulers.js', 'components/astro/AstroEphemeris.js', 'components/astro/AstroDecennials.js', 'components/astro/AstroBalbillus.js', 'components/astro/AstroKeypoints.js'],
		// 组件里的 state 键名 → 本表字段名(同一含义在不同组件里叫法不同 / 各页各存)
		keyAliases: { includeTransits: 'ephemerisTransits', division: 'triplicityDivision', lifespan: 'triplicityLifespan', inverse: 'givenYearInverse', rateKey: 'persianRateKey', direction: 'persianDirection', maxYears: 'persianMaxYears', mode: 'balbillusMode', startPlanet: 'balbillusStartPlanet', yearType: 'balbillusYearType', settings: 'decennialStartMode' /* 十年大运四项收在 state.settings 这个对象里,枚举器只看得到对象名 */ },
		stateAlias: 'opts',
		fields: ['nodeRetrograde', 'minorVariant', 'yearBand', 'triplicityDivision', 'triplicityLifespan', 'ephemerisTransits', 'givenYearInverse', 'lunarReturnInverse', 'solarReturnInverse', 'persianRateKey', 'persianDirection', 'persianMaxYears', 'decennialStartMode', 'decennialOrderType', 'decennialDayMethod', 'decennialCalendarType', 'profGrain', 'profStart', 'balbillusStartPlanet', 'balbillusYearType', 'balbillusMode', 'keypointsMode'],
		exempt: {
			...sameReason(['targetDate', 'targetTime', 'startDate', 'endDate'], '目标日期 / 起止日期是每一次查看的输入'),
			system: '三分体系初值随本盘排盘口径与流派预设;页内改动只覆盖本会话',
			aiMode: 'AI 输出范围(全部 L1 / 某个 L1 下的 L2 …)是查看位置,不是口径',
			asporb: '容许度初值归「星盘设置」的全局行运容许度管;页内改动只覆盖本会话',
		},
	},
	{
		page: 'guazhan', storageKey: 'horosa.guazhan.settings.v1', file: 'components/guazhan/GuaZhanMain.js', exportName: 'GUAZHAN_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['custGuaDongYao', 'numGuaDongYao'],
		exempt: {
			...sameReason(['upGuaIdx', 'downGuaIdx', 'currentGua', 'number'], '上下卦 / 成卦 / 起卦数字是每一卦的输入'),
		},
	},
	{
		page: 'huangji', storageKey: 'horosa.huangji.settings.v1', file: 'components/huangji/HuangJiMain.js', exportName: 'HUANGJI_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['xinyiMethod'],
		exempt: {
			historyYear: '历史年是每次查看的输入',
			...sameReason(['classicKey', 'classicSectionIndex', 'classicView'], '经典 / 章节 / 显示方式是阅读位置,不是排盘口径'),
		},
	},
	{
		page: 'planetarium', storageKey: 'horosa.planetarium.settings.v1', file: 'components/planetarium/PlanetariumBabylon.js', exportName: 'PLANETARIUM_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['layers', 'magLimit', 'viewMode'],
		exempt: {
			time: '观测时刻是每次查看的输入',
			searchQuery: '搜索词是视图态',
		},
	},
	{
		// 改设置的入口有三十多个且零非用户入口 → componentDidUpdate 里按保留键前后值统一落盘(前提由合同测试看守)
		page: 'acg', storageKey: 'horosa.acg.settings.v1', file: 'components/acg/AstroAcg.js', exportName: 'ACG_PAGE_SETTINGS', changeVia: 'stateDiff',
		fields: ['lines', 'projection', 'mapStyle', 'showLabels', 'showGeo', 'showLS', 'showAspects', 'showPoints', 'showMidpoints', 'showLots', 'showCrossings', 'showCuspLines', 'showStars', 'showStarParans', 'showTreasure', 'showZones', 'zoneWidth', 'showGeodetic', 'geodetic', 'geodeticVar', 'geodeticZero', 'hsys', 'orb', 'mode', 'coord', 'posType', 'horizon', 'nodeType', 'lilithType', 'draconic', 'harmonic', 'vibration', 'showVibration', 'midpointMode', 'ayanamsa', 'lsMode', 'paranMode'],
		exempt: {
			...sameReason(['acgData', 'linesSet', 'pointReport', 'pointLoading', 'clickMarker'], '后端数据 / 由 lines 派生的集合 / 落点报告,不是设置'),
			...sameReason(['drawerVisible', 'layersOpen', 'refOpen', 'pointOpen', 'lsDialOpen'], '抽屉 / 面板开合是视图态'),
			...sameReason(['ccgPlay', 'ccgDate', 'ccgTime', 'ccgMix'], 'CCG 时间地图的目标时刻与播放态是每次查看的输入'),
			...sameReason(['relMode', 'relDate', 'relTime', 'relPos', 'relZone', 'showRelCross'], '关系盘的 B 盘资料与其渲染层是每次查看的输入'),
			lotsCustom: '自定义阿拉伯点公式是每次查看的输入',
		},
	},
	{
		page: 'babylon', storageKey: 'horosa.babylon.settings.v1', file: 'components/babylon/BabylonMain.js', exportName: 'BABYLON_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['schemeId', 'overrides'],
		exempt: {},
	},
	{
		page: 'fengshui', storageKey: 'horosa.fengshui.settings.v1', file: 'components/fengshui/FengShuiMain.js', exportName: 'FENGSHUI_PAGE_SETTINGS', changeVia: 'stateKey',
		fields: ['school', 'diskSkin'],   // diskSkin(盘面样式)住在画布引擎的视图模型里(value={vm.diskSkin}),枚举器看不到,这里手工登记
		exempt: {},
	},
];
