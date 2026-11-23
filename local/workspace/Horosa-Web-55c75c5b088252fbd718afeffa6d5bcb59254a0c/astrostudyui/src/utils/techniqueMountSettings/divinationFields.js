// 卜类技法的挂载字段组(奇门 / 太乙 / 六壬 / 金口诀 / 六爻 / 卜卦 / 择日 / 三式合一等)与扁平键读取
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { PAIPAN_OPTIONS as QIMEN_PAIPAN_OPTIONS, TUIYAN_VIEW_OPTIONS as QIMEN_TUIYAN_VIEW_OPTIONS, TUIYAN_GONG_OPTIONS as QIMEN_TUIYAN_GONG_OPTIONS, QIJU_METHOD_OPTIONS as QIMEN_QIJU_METHOD_OPTIONS, qijuMethodOptionsFor, qijuMethodSelectValue, SCHOOL_OPTIONS as QIMEN_SCHOOL_OPTIONS, ZHIRUN_LEAP_OPTIONS as QIMEN_ZHIRUN_LEAP_OPTIONS, qijuMethodUsesJieqiFa, ZHISHI_OPTIONS as QIMEN_ZHISHI_OPTIONS, YUEJIA_QIJU_OPTIONS as QIMEN_YUEJIA_QIJU_OPTIONS, KONG_MODE_OPTIONS as QIMEN_KONG_MODE_OPTIONS, MA_MODE_OPTIONS as QIMEN_MA_MODE_OPTIONS, CHART_CATEGORY_OPTIONS as QIMEN_CHART_CATEGORY_OPTIONS, SEX_OPTIONS as QIMEN_SEX_OPTIONS, YIXING_OPTIONS as QIMEN_YIXING_OPTIONS, GODS_PRESET_OPTIONS as QIMEN_GODS_PRESET_OPTIONS, ANGAN_MODE_OPTIONS as QIMEN_ANGAN_MODE_OPTIONS, JIGONG_MODE_OPTIONS as QIMEN_JIGONG_MODE_OPTIONS, FEI_MEN_ZHONG_CAN_LABELS as QIMEN_FEI_MEN_ZHONG_CAN_LABELS, mixLayerDefaultLabel as qimenMixLayerDefaultLabel, MIX_LAYER_LABELS as QIMEN_MIX_LAYER_LABELS, SHIFT_ZHIFU_OPTIONS as QIMEN_SHIFT_ZHIFU_OPTIONS, YEARJIA_JU_OPTIONS as QIMEN_YEARJIA_JU_OPTIONS, DAYJIA_JU_OPTIONS as QIMEN_DAYJIA_JU_OPTIONS, KEJIA_FENDUN_OPTIONS as QIMEN_KEJIA_FENDUN_OPTIONS, JINHAN_MENPAI_OPTIONS as QIMEN_JINHAN_MENPAI_OPTIONS } from '../../components/dunjia/DunJiaCalc';
import { STYLE_OPTIONS as TAIYI_STYLE_OPTIONS, METHOD_OPTIONS as TAIYI_METHOD_OPTIONS, TIME_BASIS_OPTIONS as TAIYI_TIME_BASIS_OPTIONS, GAME_THEORY_OPTIONS as TAIYI_GAME_THEORY_OPTIONS } from '../../components/taiyi/TaiYiCalc';
// 太乙流派六轴(纯 core 叶子;regenerateTaiyiSnapshot 组装 school_* → applyTaiyiSchool 几何重算)。
import { TAIYI_SCHOOL_OPTIONS } from '../../components/taiyi/core/taiyiSchool';
// 六壬占事类型(叶子数据;builder [占断向导] 段消费)。
import { ZHANDUAN_CATEGORIES } from '../../components/liureng/LRZhanDuanDoc';
import { WuXing as LR_WUXING } from '../../components/liureng/LRConst';
// 六爻判读设置(叶子数据:流派预设/占测事项/神煞表)。
import { LIUYAO_SCHOOL_OPTIONS, LIUYAO_PRESETS } from '../../components/gua/liuyaoSchools';
import { YONGSHEN_CATEGORIES } from '../../components/gua/liuyaoYongShen';
import { DEFAULT_SHENSHA_SET, SHENSHA_META } from '../../components/gua/liuyaoShenSha';
// 卜卦判读参数(HORARY_PARAM_SPEC scope='horary' 单源,随 spec 自动扩,勿写死键数) / 择日流派口径 13 键(叶子单源;齿轮 hp_/ep_ 扁平键,regenerate 解码)。
import { HORARY_QUESTION_SCOPED_KEYS, HORARY_PARAM_SPEC, horaryJudgeOpts, horaryStoredSchool } from '../../divination/horary/horarySchools';
import { judgeLayerOverrides } from '../judgeLayerOverrides';
import * as AstroConst from '../../constants/AstroConst';
import { ELECTION_PARAM_SPEC } from '../../divination/election/electionParams';
// 择日手术部位(黄道 12 座 → 身体部位;叶子数据)。
import { SIGN_ORDER, SIGNS } from '../../divination/data/signs';
import { ASC_RA_MODE_DEFAULT, ASC_RA_MODE_OPTIONS } from '../ascRaMode';
import { ON_OFF, TIME_FIELDS, dayBoundaryLabelled, DAY_BOUNDARY_FIELDS, DIZHI_12, HSYS_OPTIONS, ZODIACAL_OPTIONS, TIME_ALG_OPTIONS } from './fieldAtoms';

// 金口诀合占(所问类别/问事时段):JinKouCalc 处在与 aiAnalysisContext 的循环导入链上,
// 以 aiAnalysisContext 为入口时其常量在本模块 init 期为 undefined(文件头同款告诫)→
// 内联镜像其 key/label,techniqueMountSettings.test 断言 === 源常量防漂移(LIUREN_QI_METHODS 范式)。
const JINKOU_ASK_OPTIONS_M = [
	{ value: 'qiucai', label: '财' }, { value: 'guantu', label: '官' }, { value: 'guansi', label: '官司' },
	{ value: 'xueye', label: '功名' }, { value: 'jibing', label: '病' }, { value: 'hunyue', label: '婚' },
	{ value: 'huaiyun', label: '孕' },
];

const JINKOU_TIME_OPTIONS_M = [
	{ value: 'day', label: '日内' }, { value: 'year', label: '一年' }, { value: 'default', label: '常规' },
];

// 注：卜卦/择日/六壬起课的选项常量定义在「大组件」(HoraryMain/ElectionMain/LiuRengMain) 内，它们与 aiAnalysisContext
// 形成循环导入（aiAnalysisContext→techniqueMountSettings→大组件→…→aiAnalysisContext）；当 aiAnalysisContext 为入口时
// init 顺序会让这些常量在 .map 时为 undefined（抛错）。故此处「内联镜像」其值断开循环，并由 techniqueMountSettings.test.js
// 断言「内联值 === 源组件常量」防漂移（见 LIUREN_QI_METHODS / HORARY_CATEGORIES / ELECTION_TOPICS）。
// ↓↓↓ 内联镜像「大组件」常量（断循环导入；单测断言 === 源常量防漂移）。
// 镜像 LiuRengMain.QI_METHODS（25 法，key/name 一致）。
const LIUREN_QI_METHODS = [
	{ key: 'zheng', name: '正时正将' },
	{ key: 'bake2', name: '十二客·月建加太岁' },
	{ key: 'bake3', name: '十二客·太岁加月建' },
	{ key: 'bake4', name: '十二客·月建加日干' },
	{ key: 'bake5', name: '十二客·岁干加正时' },
	{ key: 'bake6', name: '十二客·月将加日干' },
	{ key: 'bake7', name: '十二客·月将加太岁' },
	{ key: 'bake8', name: '十二客·太岁加月将' },
	{ key: 'bake9', name: '十二客·月将加本命' },
	{ key: 'bake10', name: '十二客·月将加行年' },
	{ key: 'bake11', name: '十二客·太岁加本命' },
	{ key: 'bake12', name: '十二客·太岁加行年' },
	{ key: 'tsjs', name: '太岁加时' },
	{ key: 'yjjs', name: '月建加时' },
	{ key: 'xnjs', name: '行年加时' },
	{ key: 'bmjs', name: '本命加时' },
	{ key: 'cike1', name: '次客·一筹' },
	{ key: 'cike2', name: '次客·二筹' },
	{ key: 'cike3', name: '次客·三筹' },
	{ key: 'alnr', name: '年日对齐·陈旧事' },
	{ key: 'alns', name: '年时对齐·深远事' },
	{ key: 'alyr', name: '月日对齐·催迫事' },
	{ key: 'alys', name: '月时对齐·灵活事' },
	{ key: 'xuanshi', name: '选时·事发之时' },
	{ key: 'yanshu', name: '演数·随感之数(加时)' },
	{ key: 'baoshu', name: '报数/端法·活时(÷12定支)' },
];

// 镜像 HoraryMain.HORARY_CATEGORIES（20 类，value/label 一致;批2 新增 失物/消息 两类）。
const HORARY_CATEGORIES = [
	{ value: 'general', label: '综合 · 能否成事' },
	{ value: 'wealth', label: '财物 · 借贷（二宫）' },
	{ value: 'lost', label: '失物寻回（二宫动产）' },
	{ value: 'family', label: '兄弟 · 亲属（三宫）' },
	{ value: 'message', label: '消息真假 · 书信（三宫）' },
	{ value: 'property', label: '房产 · 田宅（四宫）' },
	{ value: 'father', label: '父亲 · 尊长（父母宫参数定 4/10）' },
	{ value: 'mother', label: '母亲（父母宫参数定 10/4）' },
	{ value: 'pregnancy', label: '子嗣 · 怀孕（五宫）' },
	{ value: 'health', label: '疾病 · 健康（六宫）' },
	{ value: 'lost_animal', label: '走失活物（六宫/大畜十二宫）' },
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'trade', label: '买卖 · 交易（七宫四角）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];

// 镜像 ElectionMain.ELECTION_TOPICS（26 类，value/label 一致）。
const ELECTION_TOPICS = [
	{ value: 'marriage', label: '结婚 / 订婚' },
	{ value: 'business', label: '创业 / 开业 / 开市' },
	{ value: 'organization', label: '团体组织成立' },
	{ value: 'move_in', label: '入宅 / 迁居' },
	{ value: 'buy_property', label: '购屋 / 租屋' },
	{ value: 'buy_land', label: '购地' },
	{ value: 'renovation', label: '整修 / 动土 / 破土' },
	{ value: 'trade', label: '买卖交易' },
	{ value: 'buy_car', label: '购车 / 交车' },
	{ value: 'contract', label: '签约 / 承诺' },
	{ value: 'registration', label: '登记 / 申请' },
	{ value: 'diet', label: '节食 / 戒习惯' },
	{ value: 'pursue_love', label: '追求爱情 / 求职' },
	{ value: 'team_departure', label: '队伍出发 / 比赛' },
	{ value: 'surgery', label: '手术' },
	{ value: 'medication', label: '用药 / 服药' },   // 引擎早有用药判据(月落主病星座+吉相),此前页面不可达
	{ value: 'banquet', label: '宴会 / 就职典礼' },
	{ value: 'travel', label: '出行' },
	{ value: 'blessing', label: '祈福 / 安香 / 法会' },
	{ value: 'general_day', label: '大众吉日' },
	{ value: 'planting', label: '播种 / 种植 / 农耕' },
	{ value: 'sailing', label: '海行 / 航海' },
	{ value: 'litigation', label: '诉讼 / 战阵 / 竞争' },
	{ value: 'release', label: '释囚 / 解约脱身' },
	{ value: 'haircut', label: '理发 / 剪甲' },
	{ value: 'talisman', label: '制作护符' },
];

// 奇门遁甲：镜像 DunJiaCalc/DunJiaMain DEFAULT_OPTIONS 与 aiAnalysisContext DEFAULT_QIMEN_OPTIONS 的关键排盘选项。
// （faRelatedPeople 是「内容/数据」非排盘选项，不入此 schema。）
// 直接复用 DunJiaCalc 的官方选项常量（值/标签 100% 与排盘引擎一致，杜绝手写错值喂坏 calcDunJia）。
// 奇门/三式页面 DEFAULT_OPTIONS 与存档是布尔,挂载 schema 是 0/1 下拉:B 类基线直接取存档 → 下拉 value=false 无匹配档(显示空档),
// 选「…(默认)」(0)时剪枝比较 '0'!=='false' 判为覆盖(误计「已自定义」且强制重算)。八键统一归一 0/1('0'/'1'/布尔/数字)。
const BOOL01 = (v)=>((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0);

// 显示条件与奇门页 / 三式合一页同一判据(页面上不出现 / 置灰的项,齿轮里也不出现;隐藏项不计覆盖也不下发)
const qmPaiPan = (d)=>Number(d.paiPanType === undefined || d.paiPanType === null || d.paiPanType === '' ? 3 : d.paiPanType);

const qmFeiOrMix = (d)=>d.school === '飞盘' || d.school === '混合';

export const QIMEN_FIELDS = [
	{ name: 'paiPanType', label: '排盘', type: 'select', default: 3, group: '排盘', options: QIMEN_PAIPAN_OPTIONS },
	// 档位随排盘体例(与奇门页 / 三式合一页同一判据 qijuMethodOptionsFor):非时家刻家只有「本家默认 / 阴盘」,节气四法回显为本家默认
	{ name: 'qijuMethod', label: '起局', type: 'select', default: 'zhirun', group: '排盘', options: QIMEN_QIJU_METHOD_OPTIONS,
		optionsFor: (d)=>qijuMethodOptionsFor(qmPaiPan(d)), displayValue: (v, d)=>qijuMethodSelectValue(qmPaiPan(d), v) },
	{ name: 'school', label: '盘式', type: 'select', default: '转盘', group: '排盘', options: QIMEN_SCHOOL_OPTIONS },
	{ name: 'shuziReportNumber', label: '报数', type: 'text', default: '', group: '排盘', showWhen: (d)=>d.qijuMethod === 'shuzi' },
	{ name: 'zhirunLeapDays', label: '置闰天数', type: 'select', default: 9, group: '排盘', options: QIMEN_ZHIRUN_LEAP_OPTIONS,
		showWhen: (d)=>d.qijuMethod === 'zhirun' && qijuMethodUsesJieqiFa(qmPaiPan(d)) },
	// jieQiType 已删:页面无控件(live 硬钉 1)、引擎内唯一消费是标签、标签不进快照 → 三重死项。
	{ name: 'zhiShiType', label: '值使', type: 'select', default: 0, group: '排盘', options: QIMEN_ZHISHI_OPTIONS, showWhen: (d)=>!qmFeiOrMix(d) },
	{ name: 'yueJiaQiJuType', label: '月家起局', type: 'select', default: 0, group: '排盘', options: QIMEN_YUEJIA_QIJU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 1 },
	{ name: 'kongMode', label: '空亡', type: 'select', default: 'day', group: '排盘', options: QIMEN_KONG_MODE_OPTIONS },
	{ name: 'yimaMode', label: '驿马', type: 'select', default: 'day', group: '排盘', options: QIMEN_MA_MODE_OPTIONS },
	// 盘类(命局/事局):快照「盘类：」行 + 法奇门用神取向消费;性别:快照「命式：」行(曾缺 → 起课源输出 undefined)。
	{ name: 'chartCategory', label: '盘类', type: 'select', default: 'shi', group: '排盘', options: QIMEN_CHART_CATEGORY_OPTIONS },
	{ name: 'sex', label: '性别', type: 'select', default: 1, group: '排盘', options: QIMEN_SEX_OPTIONS },
	// 移星域修正:引擎域 0-7 八档(YIXING_OPTIONS),此前 switch 只暴露 0/1=顺转2~7宫六档在挂载侧丢失。
	{ name: 'shiftPalace', label: '移星', type: 'select', default: 0, group: '排盘', options: QIMEN_YIXING_OPTIONS },
	// fengJu 引擎默认为布尔 false → 用布尔语义,normalize 到 true/false（与 DEFAULT_OPTIONS 字节一致）。
	// 标签与页面同(「封局」未封局 / 已封局);此前写成「法奇门叠加层」,那是另一项功能,关它像是关掉法奇门分析
	{ name: 'fengJu', label: '封局', type: 'select', options: [{ value: false, label: '未封局' }, { value: true, label: '已封局' }], default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	// 八神取神/暗干族
	{ name: 'godsPreset', label: '八神取神', type: 'select', default: 'baihu_xuanwu', group: '排盘', options: QIMEN_GODS_PRESET_OPTIONS },
	{ name: 'anGanMode', label: '暗干', type: 'select', default: 'off', group: '排盘', options: QIMEN_ANGAN_MODE_OPTIONS },
	{ name: 'jiGongMode', label: '中宫寄宫', type: 'select', default: 'kun', group: '排盘', options: QIMEN_JIGONG_MODE_OPTIONS },
	{ name: 'feiXingShun', label: '九星飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenShun', label: '九门飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiShenShun', label: '九神飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenZhongCan', label: '中门飞宫', type: 'select', default: 1, group: '排盘', options: [{ value: 1, label: QIMEN_FEI_MEN_ZHONG_CAN_LABELS.on }, { value: 0, label: QIMEN_FEI_MEN_ZHONG_CAN_LABELS.off }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenZhongShow', label: '中宫门位显示', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '留空(默认)' }, { value: 1, label: '标「中」字样' }], normalize: BOOL01, showWhen: (d)=>qmFeiOrMix(d) && BOOL01(d.feiMenZhongCan) === 0 },
	{ name: 'mixTian', label: '天盘层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('zhuan') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixXing', label: '九星层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('zhuan') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixMen', label: '八门层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('fei') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixShen', label: '九神层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('fei') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'kongMarkBoth', label: '空亡标注', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '单一模式(默认)' }, { value: 1, label: '日空时空并标' }], normalize: BOOL01 },
	{ name: 'showAllKong', label: '四柱空亡', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '不显示(默认)' }, { value: 1, label: '显示年月日时空' }], normalize: BOOL01 },
	{ name: 'shiftZhiFuMode', label: '移星值符', type: 'select', default: 'follow', group: '排盘', options: QIMEN_SHIFT_ZHIFU_OPTIONS, showWhen: (d)=>Number(d.shiftPalace) > 0 },
	{ name: 'yearJiaJu', label: '年家定局', type: 'select', default: 'sanyuan', group: '排盘', options: QIMEN_YEARJIA_JU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 0 },
	{ name: 'dayJiaJu', label: '日家定局', type: 'select', default: 'yiyuan', group: '排盘', options: QIMEN_DAYJIA_JU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 2 },
	{ name: 'keJiaFenDun', label: '刻家分遁', type: 'select', default: 'zihou', group: '排盘', options: QIMEN_KEJIA_FENDUN_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 4 },
	{ name: 'keZiZhengHuanShi', label: '子正换时', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '子时23点起(默认)' }, { value: 1, label: '子正0点换时' }], normalize: BOOL01, showWhen: (d)=>qmPaiPan(d) === 4 },
	{ name: 'jinhanMenPai', label: '八门排法', type: 'select', default: 'book', group: '排盘', options: QIMEN_JINHAN_MENPAI_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 6 },
	// 与上面 fengJu 同款布尔 normalize:两页(奇门/三式合一)的 DEFAULT_OPTIONS 里 showAnZhi 都是布尔,
	// 而 switch 的 onChange 恒产 1/0 → 剪枝拿 '0' 与 'false' 比,拨开再拨回会被计为「已自定义 1 项」并触发
	// 一次无谓的强制重算(产物不变)。default 同步改 false 与存档字节一致;三式合一子组由本条 reTag 派生,自动同步。
	{ name: 'showAnZhi', label: '暗支(随暗干)', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	// 寄干 / 天禽 / 推演:纯显示,随开关进快照(默认关=现状零回归);飞盘中宫自有星干,寄干 / 天禽不适用(页面同样不出这两项)
	{ name: 'showJiGan', label: '寄干', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>`${d.school || ''}` !== '飞盘' },
	{ name: 'showTianQin', label: '天禽', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>`${d.school || ''}` !== '飞盘' },
	{ name: 'tuiYanView', label: '推演显示', type: 'select', default: 'off', group: '排盘', options: QIMEN_TUIYAN_VIEW_OPTIONS },
	{ name: 'tuiYanGong', label: '推演用神宫', type: 'select', default: 'shigan', group: '排盘', options: QIMEN_TUIYAN_GONG_OPTIONS, showWhen: (d)=>!!d.tuiYanView && `${d.tuiYanView}` !== 'off' },
	// 十二建星:纯显示(奇门页盘外环 / 三式盘地支旁 + 右栏卡),开了快照多一行日值 / 时值;不改任何子盘(三式合一经 reTag 同名共用)
	{ name: 'showJianChu', label: '十二建星', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	...TIME_FIELDS.map(dayBoundaryLabelled('日界')),
	// 法奇门「相关人员」(页面从命盘库多选,护其生年干):命盘档案 id 逗号分隔;重算按页面同一函数取生年干、覆盖存档名单;空 = 随存档
	{ name: 'relatedRecordIds', label: '相关人员·命盘档案 id(逗号分隔,空=随存档)', type: 'text', default: '', blankFollowsBaseline: true, group: '法奇门', placeholder: '命盘的记录 id(list_records 查)' },
];

// 太乙：复用 TaiYiCalc 官方选项常量（盘式 / 古法公式 / 时间基准 / 博弈），默认对齐 TaiYiMain state.options + fetchTaiyiPan 现状。
// 盘式 = 太乙命法时页面隐藏古法公式 / 博弈 / 流派设置整段(命法盘不消费它们),齿轮同
const taiyiNotLife = (d)=>Number(d && d.style) !== 5;

export const TAIYI_FIELDS = [
	{ name: 'style', label: '盘式', type: 'select', default: 3, group: '盘式', options: TAIYI_STYLE_OPTIONS },
	{ name: 'tn', label: '古法公式', type: 'select', default: 0, group: '盘式', options: TAIYI_METHOD_OPTIONS, showWhen: taiyiNotLife },
	{ name: 'timeBasis', label: '时间基准', type: 'select', default: 'direct', group: '盘式', options: TAIYI_TIME_BASIS_OPTIONS },
	{ name: 'gameTheory', label: '博弈', type: 'select', default: 0, group: '盘式', options: TAIYI_GAME_THEORY_OPTIONS, showWhen: taiyiNotLife },
	// 命法盘性别:仅盘式=太乙命法(style=5)时,fetchTaiyiPan→后端 webtaiyisrv:401/521 消费 sex 改命法盘 → showWhen 条件揭示,默认男 prune 零回归。
	{ name: 'sex', label: '命法性别', type: 'select', default: '男', group: '盘式', showWhen: (d)=>Number(d.style) === 5, options: [
		{ value: '男', label: '男' },
		{ value: '女', label: '女' },
	] },
	// 流派六轴(计神方向/文昌重留/客算间辰/三基起宫/游神方向/始击坐标):regenerateTaiyiSnapshot 组装
	// school_* → applyTaiyiSchool 起盘后几何重算主客算/神煞 —— 后端已通,曾只差齿轮。默认 default=从盘零回归。
	...['jishen', 'wenchang', 'keJianChen', 'sanji', 'youshen', 'shijiCoord'].map((ax)=>({
		name: 'school_' + ax,
		label: '流派·' + ({ jishen: '计神方向', wenchang: '文昌重留', keJianChen: '客算间辰', sanji: '三基起宫', youshen: '游神方向', shijiCoord: '始击坐标' })[ax],
		type: 'select', default: 'default', group: '流派', showWhen: taiyiNotLife,
		options: (TAIYI_SCHOOL_OPTIONS[ax] || []).map((o)=>({ value: o.value, label: o.label })),
	})),
	// 太乙也吃日界/晚子时：fetchTaiyiPan(TaiYiCalc) 透传到 buildLocalBaziResult 算四柱/时柱。
	// 曾 default:0 且无 globalCurrent(对齐旧 fetchTaiyiPan 兜底 0),与页面缺省 defaultAfter23NewDay()(出厂 23 点换日)
	//   不一:起课时间源挂载太乙时 23:00-23:59 盘与页面不一,且同一快照内 nongli 请求按「齿轮→记录→全局」取日界、taiyi/pan 却按 0。
	//   改与奇门/三式同用 DAY_BOUNDARY_FIELDS(default=globalCurrent=实时全局),fetchTaiyiPan 兜底同步改 defaultAfter23NewDay()。
	...DAY_BOUNDARY_FIELDS.map(dayBoundaryLabelled('换日')),
];

// 太玄筮法 / 荆诀 起筮种子:留空 = 随存档种子(没存则由起课时间 yyyyMMddHHmm 派生,确定性);填数 → 走该 seed(覆盖派生)。
// 0 是页面允许、后端接受的合法种子:缺省改用空串哨兵,此前缺省 0 被剪掉,显式选种子 0 表达不了(清空也落回 0)。
// blankFollowsBaseline:清空输入框 = 随存档(不算覆盖、不下发),此前清空被当成显式空值 → 重算按时间另起一卦。
// allowEntropySeed:随机起的那一次,种子是一段真随机记录(tr1-…,见 utils/trueRandom.js)而不是数字 —— 软件代摇建事盘时照样放行、原样下发。
export const TAIXUAN_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=随存档 / 按起课时间派生)', type: 'number', default: '', min: 0, group: '起筮', placeholder: '空 → 随存档 / 按时间派生', blankFollowsBaseline: true, allowEntropySeed: true },
];

export const JINGJUE_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=随存档 / 按起课时间派生)', type: 'number', default: '', min: 0, group: '起筮', placeholder: '空 → 随存档 / 按时间派生', blankFollowsBaseline: true, allowEntropySeed: true },
];

// 五兆:WuZhaoMain.state 默认 mode='ganzhi' number=0 manual=false manualSplits=DEFAULT_SPLITS。
// 随机起兆法(揲筮/自动掷钱)在挂载场景按时间点重算,每次结果不同即不可复现 →
// builder 会回落干支起例;欲用揲筮请开手动复现、欲用掷钱请关自动掷并填定六掷。
export const WUZHAO_FIELDS = [
	// 标签明示复现条件(随机起兆在挂载「按时间点重算」下不可复现;条件不满足且存档无兆数时 builder 回落干支起例并在快照写明)。
	// 字段名 / 档名与五兆页同(「起盘方式」「揲筮模式」);括注是挂载才有的复现条件
	{ name: 'mode', label: '起盘方式', type: 'select', default: 'ganzhi', group: '起例', options: [
		{ value: 'ganzhi', label: '干支起盘(默认,纯时间)' },
		{ value: 'day', label: '日干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'hour', label: '时干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'minute', label: '分干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'tang', label: '唐代正法揲筮(需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'dunhuang', label: '敦煌校录揲筮(仅存档带兆数时可复现,否则按干支起盘)' },
		{ value: 'qian', label: '以钱代筮(需关「每次起盘重掷」并填六掷,否则按干支起盘)' },
		{ value: 'zhushu', label: '直输五兆数' },
	]},
	{ name: 'shifaVariant', label: '筮法口径 (敦煌校录揲筮)', type: 'select', default: 'guayi', group: '起例',
		showWhen: (d)=>(d.mode === 'dunhuang'), options: [
			{ value: 'guayi', label: '挂一回加（0策水·5火·10木·15金·20土）' },
			{ value: 'jiaolu', label: '校录原案（0策土·5水·10火·15木·20金）' },
		]},
	{ name: 'qianAuto', label: '每次起盘重掷 (以钱代筮)', type: 'switch', options: ON_OFF, default: 1, group: '起例',
		showWhen: (d)=>(d.mode === 'qian'), normalize: (v)=>(v === true || v === 1 || v === '1') },
	{ name: 'qianThrows', label: '六掷阳面数 (逗号分隔 0-4,如 1,2,3,3,3,4;关「每次起盘重掷」后生效)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'qian' && !(d.qianAuto === true || `${d.qianAuto}` === '1' || d.qianAuto === undefined)),   /* 以钱代筮且关自动掷才读 */
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'zhaoNums', label: '五兆卜数 (逗号分隔 1-5,一水二火三木四金五土)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'zhushu'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'xingshenMonth', label: '行神月制', type: 'select', default: 'lunar', group: '断法', options: [
		{ value: 'lunar', label: '农历月（《要诀略》本法）' },
		{ value: 'jieqi', label: '节气月（月建）' },
	]},
	{ name: 'mingZhi', label: '年命支 (行年/年立/官禄位用,留空则该类留白)', type: 'select', default: '', group: '断法', options: [
		{ value: '', label: '未指定' },
		{ value: '子', label: '子' }, { value: '丑', label: '丑' }, { value: '寅', label: '寅' },
		{ value: '卯', label: '卯' }, { value: '辰', label: '辰' }, { value: '巳', label: '巳' },
		{ value: '午', label: '午' }, { value: '未', label: '未' }, { value: '申', label: '申' },
		{ value: '酉', label: '酉' }, { value: '戌', label: '戌' }, { value: '亥', label: '亥' },
	]},
	{ name: 'gender', label: '性别 (行年/年立用)', type: 'select', default: '', group: '断法', options: [
		{ value: '', label: '未指定' },
		{ value: 'male', label: '男' },
		{ value: 'female', label: '女' },
	]},
	// 报数只在干支起例参算(页面其余起法置灰),值域 0–9 与页面同
	{ name: 'number', label: '报数 (干支起盘读取;0=不用)', type: 'number', default: 0, min: 0, max: 9, group: '起例', showWhen: (d)=>(d.mode || 'ganzhi') === 'ganzhi' },   // 无「报数类」模式
	// 页面是「揲筮模式」下拉(自动随机 / 手动复现),存档是布尔:归一成 0/1 才对得上档(builder 读 !!o.manual)
	{ name: 'manual', label: '揲筮模式', type: 'select', options: [{ value: 0, label: '自动随机' }, { value: 1, label: '手动复现' }], default: 0, group: '起例', showWhen: (d)=>['day', 'hour', 'minute', 'tang'].indexOf(d.mode) >= 0, normalize: (v)=>((v === true || v === 1 || v === '1') ? 1 : 0) },
	// 手动六数:仅 manual=开 时生效。WuZhaoMain:156 builder 读 opts.manualSplits(6 数组)进重算请求,入口:986 已传,
	//   但 schema 此前漏字段 → manual 开关形同虚设(恒走 DEFAULT_SPLITS)。text 逗号输入 normalize 成 6 数组;留空=默认零回归。
	{ name: 'manualSplits', label: '手动六数 (逗号分隔,如 18,8,5,2,1,1;留空=随存档)', type: 'text', default: '', group: '起例',
		// 页面同判据:日 / 时 / 分干起盘、唐法揲筮且开手动分爻才读手动六数
		showWhen: (d)=>['day', 'hour', 'minute', 'tang'].indexOf(d.mode) >= 0 && (d.manual === 1 || d.manual === true || d.manual === '1'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
];

// 神易数:ShenYiShuMain.state 默认 hourSource='auto' manualHour=0 seasonSource='auto' manualSeason='夏'。
export const SHENYISHU_FIELDS = [
	{ name: 'hourSource', label: '入式小时', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动取时间小时' },
		{ value: 'manual', label: '手动指定小时' },
	]},
	{ name: 'manualHour', label: '手动小时 (0-23)', type: 'number', default: 0, min: 0, max: 23, group: '起盘', showWhen: (d)=>d.hourSource === 'manual' },   // 只在时辰来源 = 手动时生效(页面同)
	{ name: 'seasonSource', label: '五行季令', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动按公历月份取季令（三月一季）' },
		{ value: 'manual', label: '手动指定季令' },
	]},
	{ name: 'manualSeason', label: '手动季令', type: 'select', default: '夏', group: '起盘', showWhen: (d)=>d.seasonSource === 'manual', options: [
		{ value: '春', label: '春' },
		{ value: '夏', label: '夏' },
		{ value: '秋', label: '秋' },
		{ value: '冬', label: '冬' },
	]},
];

// 六壬起课法：buildLiuRengSnapshotText 第 8 参 castOpts 直接读这些键 + guireng/wuxing 走顶层。
export const LIURENG_FIELDS = [
	// 起课法：复用 LiuRengMain 导出的 QI_METHODS（25 法，值/名与排盘引擎同源，杜绝手写错值）。
	// 起课时间算法(缺省真太阳时 = 后端历来写死的口径,剪枝后字节零回归);
	// 与页面新控件同键同域,选「直接时间」即与三式合一六壬层(时柱取自吃 timeAlg 的奇门)同口径。
	// 三式合一子组里它属 SANSHI_SHARED_TIME_KEYS,由奇门那份统一呈现,故此处不会出现重复齿轮。
	{ name: 'timeAlg', label: '起课时间算法', type: 'select', default: 0, group: '起课', options: [
		{ value: 0, label: '真太阳时（默认）' }, { value: 1, label: '直接时间' },
	] },
	{ name: 'castMethod', label: '起课法', type: 'select', default: 'zheng', group: '起课',
		options: LIUREN_QI_METHODS.map((m)=>({ value: m.key, label: m.name })) },
	// 选时支：仅 castMethod='xuanshi' 时有效（条件揭示，避免"对不上"）。默认 ''=用占时支（LiuRengMain:3944 兜底=现状）。
	{ name: 'xuanShiZhi', label: '选时·事发支', type: 'select', default: '', group: '起课',
		showWhen: (d)=>d && d.castMethod === 'xuanshi',
		options: [{ value: '', label: '默认（用占时支）' }, ...DIZHI_12.map((zi)=>({ value: zi, label: `${zi}时` }))] },
	// 演数/报数：castMethod='yanshu'(加时) 或 'baoshu'(÷12定支) 时有效。默认 ''=引擎兜底（现状）。
	{ name: 'yanShuNum', label: '演数/报数', type: 'text', default: '', group: '起课',
		showWhen: (d)=>d && (d.castMethod === 'yanshu' || d.castMethod === 'baoshu') },
	{ name: 'yueJiangMethod', label: '换将', type: 'select', default: 'zhongqi', group: '起课', options: [
		{ value: 'zhongqi', label: '中气过宫（默认）' },
		{ value: 'jieqi', label: '节气换将' },
		{ value: 'richan', label: '太阳过宫·日躔（含岁差）' },
	] },
	{ name: 'fenZhouYe', label: '分昼夜', type: 'select', default: 'chenhun', group: '起课', options: [
		{ value: 'chenhun', label: '晨昏分昼夜（默认）' },
		{ value: 'maoyou', label: '卯酉分昼夜' },
		{ value: 'yinshen', label: '寅申分昼夜' },
	] },
	// 涉害取舍流派(默认 app=仅下贼上,已固定)。snapshot 仅非默认时记。
	{ name: 'seHaiMethod', label: '涉害取舍', type: 'select', default: 'app', group: '起课', options: [
		{ value: 'app', label: '仅下贼上(默认)' },
		{ value: 'standard', label: '标准深浅两向' },
		{ value: 'mengzhongji', label: '直取孟仲季' },
	] },
	{ name: 'seHaiBoundary', label: '涉害起讫', type: 'select', default: 'app', group: '起课', options: [
		{ value: 'app', label: '计起点不计本家(默认)' },
		{ value: 'both', label: '两端皆计' },
		{ value: 'neither', label: '皆不计' },
	] },
	{ name: 'shiRuKe', label: '始入课', type: 'select', default: false, group: '起课', options: [
		{ value: false, label: '并入重审(默认)' },
		{ value: true, label: '单列·九法变十法' },
	] },
	{ name: 'yearShenShaSort', label: '年神排序', type: 'select', default: 'sanyuan', group: '取神', options: [
		{ value: 'sanyuan', label: '四利三元序(默认)' },
		{ value: 'suigui', label: '太岁排轮(太阴异)' },
	] },
	// 只在「六壬法贵人」(guireng=0)下起作用(页面同条件置灰;三式合一同)
	{ name: 'yinyangSystem', label: '昼夜阳阴归属', type: 'select', default: 'danmu', group: '取神', showWhen: (d)=>Number(d.guireng) === 0, options: [
		{ value: 'danmu', label: '旦暮系(默认)' },
		{ value: 'yinyang', label: '星历阳阴系' },
	] },
	{ name: 'tuWangShuai', label: '土旺衰', type: 'select', default: 'siji', group: '取神', options: [
		{ value: 'siji', label: '四季月土旺(默认)' },
		{ value: 'huotu', label: '火土同宫(土随火)' },
	] },
	// 占事类型:builder 据它产 [占断向导] 整段(主用神/落点/宜忌/三传提示)。默认 general=现状。
	{ name: 'zhanCategory', label: '占事类型', type: 'select', default: 'general', group: '取神',
		options: ZHANDUAN_CATEGORIES.map((c)=>({ value: c.key, label: c.name })) },
	{ name: 'guireng', label: '贵人体系', type: 'select', default: 2, group: '取神', options: [
		{ value: 2, label: '星占法贵人（默认）' },
		{ value: 0, label: '六壬法贵人' },
		{ value: 1, label: '遁甲法贵人' },
		{ value: 3, label: '甲戊兼牛羊' },
		{ value: 4, label: '干合阳阴贵' },
	] },
	// 页面缺省随日干五行(起课回包按日干切,用户手选后才钉住):缺省 'auto' 剪掉不下发 → 重算按本课日干现算,与页面同源
	// (此前无头兜底写死「土」,日干非土时「起课时间」挂载与页面两张十二长生表;金口诀早已同样改过)。
	// 存档事盘恒带页面当时已解析的五行,基线即存档值。档名取六壬页原文(LRConst.WuXing 同序)。
	{ name: 'wuxing', label: '十二长生', type: 'select', default: 'auto', group: '取神', options: [
		{ value: 'auto', label: '自动（随日干五行）' },
		...LR_WUXING.map((w)=>({ value: w.elem, label: `十二长生：${w.elem}--${w.ganzi}` })),
	] },
];

// 金口诀：regenerateJinkouSnapshot / generateCaseTechniqueSnapshot 读 payload.{diFen,guireng,wuxing}（顶层）。
export const JINKOU_FIELDS = [
	// 地分：取课基准。默认 sentinel 'auto'（按占时支）——而非具体地支。
	// 坑修：若默认写「子」，用户显式选「子」会因 '子'==='子' 被 prune 丢弃 → regen 落 resolveJinKouDiFen 首分支的占时支，
	// 齿轮显「子」实际却用时支、且永远钉不成「子」。改 sentinel 后：
	//   - 默认 'auto' → prune 丢弃 → payload.diFen 缺省 → regen 的 resolveJinKouDiFen 首分支 currentZi='' → 回退占时支(=现状)。
	//   - 选具体地支(≠'auto') → prune 保留 → payload.diFen 落 currentZi → 真钉该地分。
	// regen 无需改（resolveJinKouDiFen 首分支「currentZi || timeBranch」：有则用、缺则时支；normalizeZiFromText('auto')='' 不会误判）。
	{ name: 'diFen', label: '地分', type: 'select', default: 'auto', group: '课式',
		options: [{ value: 'auto', label: '自动（按占时支）' }, ...DIZHI_12.map((zi)=>({ value: zi, label: zi }))] },   // 档名与金口诀页同
	// 贵神体系：默认 0（六壬法贵人）=== JinKouMain state.guireng:0（修原 schema 误标默认 2 → prune 误判持久化的 bug）。
	// 页面本身锁 0（左栏无此控件，参考典籍亦无「遁甲法/星占法贵人」之目），故 1/2 只在
	// 挂载快照里生效、与页面所见不一致 —— 标签明示，避免用户以为改了它页面会跟着变。
	// 流派差异请改用「贵人昼夜表」（实务派 / 大六壬古法），那一档页面与快照同步。
	{ name: 'guireng', label: '贵神体系', type: 'select', default: 0, group: '取神', options: [
		{ value: 0, label: '六壬法贵人（默认，与页面一致）' },
		{ value: 2, label: '星占法贵人（仅快照，页面不变）' },
		{ value: 1, label: '遁甲法贵人（仅快照，页面不变）' },
	], optionShown: (o)=>`${o.value}` === '0' },   // 页面锁六壬法:另两档只在存档已是它们时列出
	// 页面真实缺省是「随日干五行」(state.wuxingAuto=true),此处此前写死「土（默认）」
	// → 日干非土时,「起课时间」挂载出来的十二长生段与页面两张表。改 'auto' 为缺省(prune 丢弃 →
	// regen 按课的日干现算,与页面同源);存档事盘恒带页面当时已解析的 wuxing,走不到此档。
	{ name: 'wuxing', label: '十二长生五行', type: 'select', default: 'auto', group: '取神', options: [
		{ value: 'auto', label: '自动（随日干五行）' },
		...LR_WUXING.map((w)=>({ value: w.elem, label: `${w.elem}·${w.ganzi}` })),   // 档名与金口诀页同
	] },
	// 月将 / 占时：regen 透传给 buildJinKouData（已加 opt.yueJiang/opt.zhanShi 覆盖逻辑）→ 改将神/贵神落位，真改快照。
	// 默认 'auto'（按节气取月将 / 按时支取占时）=== JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'yueJiang', label: '月将', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: zi })),
	] },
	{ name: 'zhanShi', label: '占时', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: zi })),
	] },
	// 流派 / 盘法（J2）：regenerateJinkouSnapshot 已透传 payload.{schoolYueJiang,schoolGuiTable,schoolGuiPan,panShi}
	// 给 buildJinKouData（缺省 undefined → 内部默认派 = 现状,零回归）。默认值 === JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'schoolYueJiang', label: '月将换将', type: 'select', default: 'zhongqi', group: '流派', options: [
		{ value: 'zhongqi', label: '中气换将（默认）' },
		{ value: 'jiaojie', label: '交节即换' },
	] },
	{ name: 'schoolGuiTable', label: '贵人昼夜表', type: 'select', default: 'shiwu', group: '流派', options: [
		{ value: 'shiwu', label: '实务派（默认）' },
		{ value: 'liuren', label: '六壬古法' },
	] },
	{ name: 'schoolGuiPan', label: '起贵神盘', type: 'select', default: 'di', group: '流派', options: [
		{ value: 'di', label: '地盘法（默认）' },
		{ value: 'tian', label: '天盘法' },
	] },
	{ name: 'panShi', label: '盘式', type: 'select', default: 'yang', group: '流派', options: [
		{ value: 'yang', label: '传统阳盘（默认）' },
		{ value: 'yin', label: '阴盘·旺衰' },
	] },
	// 土之十二长生两派：默认「水土同宫」(申)＝现状；「火土同宫」(寅) 为少数派。
	// 只改十二长生表与阴盘长生打分，起盘四位不动；缺省经 prune 丢弃 → 字节级零回归。
	{ name: 'soilChangSheng', label: '土长生', type: 'select', default: 'shen', group: '流派', options: [
		{ value: 'shen', label: '水土同宫·申（默认）' },
		{ value: 'yin', label: '火土同宫·寅' },
	] },
	// 专题起式（B3/B4）：regenerateJinkouSnapshot 透传 payload.{topicKey,shiJianKind}
	// 给 buildJinKouData → 快照追加 [专题起式] 段。缺省 ''＝不选＝整段不产，经 prune 丢弃 → 字节级零回归。
	{ name: 'topicKey', label: '专题', type: 'select', default: '', group: '专题', options: [
		{ value: '', label: '不用（默认）' },
		{ value: 'yunyu', label: '测孕育' },
		{ value: 'xuntiangang', label: '寻天罡·失物' },
		{ value: 'jiazhai', label: '测家宅' },
		{ value: 'guijian', label: '测贵贱' },
		{ value: 'banzhi', label: '测瘢痣' },
		{ value: 'dajing', label: '测打井' },
		{ value: 'fujiashi', label: '复加时·十二方位' },
	] },
	// 合占扣题(所问类别/问事时段):[合占扣题与内外] 段消费;默认 未限定/常规 = 现状零回归。
	{ name: 'askKey', label: '所问类别', type: 'select', default: '', group: '专题',
		options: [{ value: '', label: '未限定（默认）' }, ...JINKOU_ASK_OPTIONS_M] },
	{ name: 'timeScope', label: '问事时段', type: 'select', default: 'default', group: '专题',
		options: JINKOU_TIME_OPTIONS_M },
	{ name: 'shiJianKind', label: '测年月日', type: 'select', default: '', group: '专题', options: [
		{ value: '', label: '不用（默认）' },
		{ value: 'year', label: '测一年' },
		{ value: 'month', label: '测一月' },
		{ value: 'day', label: '测一日' },
	] },
	// 本命属相 / 行年虚岁不入 schema：二者由「问测人出生时间」单一真值源派生（页面与还原路径同律），
	// 放成可手填就会出现「设置里填兔、出生档是龙」谁说了算的分叉，故只读不设。
	// 时间基准:重算按它取四柱 / 占时的时间算法(regenerateJinkouSnapshot → /liureng/gods 带 timeAlg),与页面同一口径;
	// 缺省直接时间 = 页面缺省。两档与金口诀页同(直接时间 / 真太阳时,与太乙页同一份档名)。
	{ name: 'timeBasis', label: '时间基准', type: 'select', default: 'direct', group: '课式', options: TAIYI_TIME_BASIS_OPTIONS },
];

// 六爻:卦与动爻取自已存起卦结果(payload.gua),恒不重起 —— 以下全为判读口径,经
// payload.liuyaoSettings(optionsPath)→ mergeLiuyaoGearSettings 与存档 gua.liuyaoSettings 合并后
// buildGuaSnapshotText 重算判读层(analyzeLiuyao 前两参恒取冻结卦,数学上不可能改卦象)。
// 默认 = DEFAULT_LIUYAO_SETTINGS 等价值 → prune 全剪 = 现状零回归。
// 不登五键:coinFace(起卦输入)/writeDir(装卦表行序)/biangua(中栏页签)/changshengUse/changshengYinYang(纯中右栏显示,不入快照)。
const LY_BOOL = (v)=>(v === true || v === 1 || v === '1');

export const SIXYAO_FIELDS = [
	// 与页面同:「自定义」与不单列的流派(旧事盘的「卜筮正宗」,与通用逐项相同)只在现值是它时补一项显示名,下拉不露内部键名
	{ name: 'school', label: '流派预设(切换即套该派细项)', type: 'select', default: 'default', group: '流派与用神',
		options: [
			...LIUYAO_SCHOOL_OPTIONS.map((o)=>({ value: o.value, label: o.label })),
			{ value: 'custom', label: '自定义' },
			...Object.keys(LIUYAO_PRESETS).filter((k)=>LIUYAO_PRESETS[k].hidden).map((k)=>({ value: k, label: LIUYAO_PRESETS[k].label })),
		],
		optionShown: (o)=>o.value !== 'custom' && !(LIUYAO_PRESETS[o.value] && LIUYAO_PRESETS[o.value].hidden) },
	{ name: 'askType', label: '占测事项(用神取用)', type: 'select', default: 'self', group: '流派与用神',
		options: YONGSHEN_CATEGORIES.map((c)=>({ value: c.key, label: c.label })) },
	{ name: 'yongOverride', label: '用神(手选)', type: 'select', default: '', group: '流派与用神',
		options: [{ value: '', label: '自动(跟占测事项)' }, ...['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].map((k)=>({ value: k, label: k }))] },
	{ name: 'benming', label: '本命(年支)', type: 'select', default: '', group: '流派与用神',
		options: [{ value: '', label: '不用（默认）' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
	{ name: 'tuChangsheng', label: '土长生', type: 'select', default: 'water', group: '取法', options: [
		{ value: 'water', label: '水土同宫（默认）' }, { value: 'fire', label: '火土同宫' }, { value: 'off', label: '不标长生' },
	] },
	{ name: 'bianyaoScope', label: '变爻范围', type: 'select', default: 'traditional', group: '取法', options: [
		{ value: 'traditional', label: '传统(回头本位)（默认）' }, { value: 'blind', label: '盲派(作用他爻)' },
	] },
	{ name: 'fushen', label: '飞伏', type: 'select', default: 'missing', group: '取法', options: [
		{ value: 'missing', label: '仅缺用神取（默认）' }, { value: 'all', label: '逐爻全标' },
	] },
	{ name: 'yuepoMode', label: '月破', type: 'select', default: 'inMonth', group: '取法', options: [
		{ value: 'inMonth', label: '当月有效（默认）' }, { value: 'always', label: '不论出月' },
	] },
	{ name: 'shishen', label: '世身', type: 'select', default: 'off', group: '取法', options: [
		{ value: 'off', label: '不用（默认）' }, { value: 'standard', label: '子午持世身居初' }, { value: 'lichunfeng', label: '亥子持世身居初' },
	] },
	// 页面上这项是「考据声明项」并已置灰(纳甲动变结构中不存在戌↔丑的本变对,两口径在一切实卦
	// 中输出恒同,金标 liuyaoOptionMatrixAudit 锁此事实)。齿轮面无置灰位,故把同一声明写进标签,避免「可拨无说明」。
	{ name: 'jinTuiTu', label: '进退神土路（考据声明项：纳甲无戌↔丑本变对，两档输出恒同）', type: 'select', default: 'chain', group: '取法', options: [
		{ value: 'chain', label: '丑辰未戌连环（默认）' }, { value: 'break', label: '戌丑断开' },
	] },
	{ name: 'tianshiSchool', label: '天时占法', type: 'select', default: 'fumu', group: '取法', options: [
		{ value: 'fumu', label: '通行(父母雨子孙晴)（默认）' }, { value: 'ancient', label: '古法多套(五家分列)' },
	] },
	{ name: 'yearBoundary', label: '定年界线(年支神煞源)', type: 'select', default: 'lichun', group: '取法', options: [
		{ value: 'lichun', label: '立春换岁（默认）' }, { value: 'lunar', label: '正月初一' },
	] },
	{ name: 'guashen', label: '卦身', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'sixGods', label: '六神', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'yuqi', label: '余气', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'yingqi', label: '应期', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	// 原标签「断诀命中/占类断语」大于实现:此闸只控 analyzeLiuyao 的 duanJue(通例命中),
	// 而 [占类断语] 段的断语摘要/历史占例/天时分列随卦恒出、三层环境与世应属核心内容也不受它控。
	// 按「标签只许等于实现」缩回实况(输出零变化)。
	{ name: 'doctrine', label: '断诀命中(通例;占类断语恒随卦出)', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'gufa', label: '古法进阶', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'yueLiushen', label: '月建六神', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'guirenFa', label: '贵人歌诀', type: 'select', default: 'standard', group: '神煞', options: [
		{ value: 'standard', label: '甲戊庚牛羊(庚丑未)' }, { value: 'geng_ma_hu', label: '庚辛逢马虎(庚寅午)' }] },
	{ name: 'shenshaOn', label: '基础神煞', type: 'switch', options: ON_OFF, default: true, group: '神煞', normalize: LY_BOOL },
	{ name: 'shenshaBase', label: '神煞起例', type: 'select', default: 'day', group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: [{ value: 'day', label: '以日干支起（默认）' }, { value: 'year', label: '以年干支起' }] },
	{ name: 'shenshaSet', label: '基础神煞集', type: 'multiselect', default: DEFAULT_SHENSHA_SET.slice(), group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: SHENSHA_META.map((m)=>({ value: m.name, label: m.name })) },
	// 扩展神煞只暴露总开关:set=null 语义为「启用即全选」,逐项清单留页面弹窗(内容型多选不进齿轮)。
	{ name: 'shenshaExOn', label: '扩展神煞(断易天机)', type: 'switch', options: ON_OFF, default: false, group: '神煞', normalize: LY_BOOL },
];

// 卜卦盘 / 择日盘：类别 topicId。regenerate 透传 options.topicId（缺省=现状）。
// 复用各自主页面权威常量（HORARY_CATEGORIES 20 类 / ELECTION_TOPICS 26 类），杜绝手写错值——
// 原 schema 仅列 8/6 类且含不存在的假值（horary 'lost' 实为 'theft'；election 'construction/medical' 实为 'renovation/surgery'）。
// 判读参数(卜卦专属,HORARY_PARAM_SPEC scope='horary' 单源自动扩):齿轮扁平键 hp_<key>,
// 默认 '' = 随流派(prune 剪掉,四层优先级回落流派/全局/内建 = 现状);switch 型以 1/0 显式覆盖。
// regenerateHorarySnapshot 解码 hp_* → horaryJudgeOpts 第二参(与页面「判读参数」面板同层级)。
// 判读参数自带的「空串」档(问者性别「不指定」、同主一星「不特别处置」)与齿轮的「随流派」哨兵撞值:齿轮里改用这个值表达它,
// 解码时映射回空串;存档里显式存的空串展平成它(flattenHoraryStored)。开关型存档是布尔,齿轮归一成 1/0
export const HORARY_JUDGE_EMPTY = '__none';

const HORARY_SWITCH_NORMALIZE = (v)=>(v === '' || v === undefined || v === null ? '' : ((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0));

// 齿轮判读键(hp_<键>)是不是「这一问」的键(换派保留;单源 HORARY_QUESTION_SCOPED_KEYS)
export function horaryJudgeFieldQuestionScoped(f){ return !!f && HORARY_QUESTION_SCOPED_KEYS.indexOf(`${f.name}`.replace(/^hp_/, '')) >= 0; }

export const HORARY_JUDGE_FIELDS = HORARY_PARAM_SPEC
	.filter((sp)=>sp.scope === 'horary')
	.map((sp)=>({
		name: 'hp_' + sp.key,
		label: `判读·${sp.label}`,
		type: 'select',
		default: '',
		// 空档 =「随流派」:只记亲手改动键的宿主选回它时删键,不存空串 —— 存下的空串在重算里是「去掉案例存档这一项」
		blankMeansFollowSchool: true,
		// 只记亲手键的宿主里同时选了流派:与案例流派不同的案例换派后存档逐项覆盖整组作废(horaryGearSchoolChanged),随所选流派
		unsetBlankLabel: (d)=>((d && Array.isArray(d.__unsetKeys) && d.__unsetKeys.indexOf('horarySchool') < 0 && d.horarySchool)
			? '不设（案例流派与所选相同 = 随案例存档；不同 = 随所选流派）' : null),
		group: `判读参数·${sp.group || '其他'}`,
		...(sp.type === 'switch' ? { normalize: HORARY_SWITCH_NORMALIZE } : {}),
		// 「撤回含换座变体」是「撤回作独立破坏」的子开关(页面同:母开关实际为关时置灰)—— 母开关实际值 = 齿轮显式值,否则随流派 / 全局
		...(sp.key === 'refranationIncludeSignChange' ? { showWhen: (d)=>{
			const own = HORARY_SWITCH_NORMALIZE(d && d.hp_refranationAsDestruction);
			if(own !== ''){ return own === 1; }
			try{ return !!horaryJudgeOpts(d && d.horarySchool, null, judgeLayerOverrides()).refranationAsDestruction; }catch(_e){ return true; }
		} } : {}),
		options: sp.type === 'switch'
			? [{ value: '', label: '随流派（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' }]
			: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value === '' ? HORARY_JUDGE_EMPTY : o.value, label: o.label })))],
	}));

// 卜卦存档没写流派 = 页面默认档(经典主流);判断「换没换派」两边都按它补齐,否则存档缺流派时选经典主流也被当成换派
export const horarySchoolOrDefault = (v)=>(v === undefined || v === null || v === '' ? 'classical' : `${v}`);

// 卜卦 / 择日盘面参数(页面「盘面参数」同三键):空 = 随存档 / 随流派(不下发,零回归);选了 = 存档与流派之后最后覆盖(重算 explicitDivinationChartParams)。
// 此前只有页面设置有这三键 → 无头起盘(cast_technique)改不到盘。
const DIVINATION_CHART_PARAM_KEYS = ['hsys', 'zodiacal', 'siderealAyanamsa'];

const DIVINATION_CHART_PARAM_FIELDS = [
	{ name: 'hsys', label: '宫制', type: 'select', default: '', blankFollowsBaseline: true, group: '盘面参数', options: [{ value: '', label: '随存档 / 流派（默认）' }, ...HSYS_OPTIONS] },
	{ name: 'zodiacal', label: '黄道', type: 'select', default: '', blankFollowsBaseline: true, group: '盘面参数', options: [{ value: '', label: '随存档（默认）' }, ...ZODIACAL_OPTIONS] },
	{ name: 'siderealAyanamsa', label: '岁差制（黄道=恒星时生效）', type: 'select', default: '', blankFollowsBaseline: true, group: '盘面参数', options: [{ value: '', label: '随存档（默认 Lahiri）' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS] },
];

// 存档层 payload.settings 的三键 + 齿轮写过的顶层同名键(覆盖层压存档层)→ 基线
function divinationChartParamsStored(p){
	const st = p.settings && typeof p.settings === 'object' ? p.settings : {};
	const out = {};
	DIVINATION_CHART_PARAM_KEYS.forEach((k)=>{
		if(st[k] !== undefined && st[k] !== null && st[k] !== ''){ out[k] = st[k]; }
		if(p[k] !== undefined && p[k] !== null && p[k] !== ''){ out[k] = p[k]; }
	});
	return out;
}

export const geoPlanetaryChartOn = (d)=>!!d && (d.planetaryChart === true || `${d.planetaryChart}` === '1');

export const HORARY_FIELDS = [
	{ name: 'topicId', label: '问题类别', type: 'select', default: 'general', group: '裁决', options: HORARY_CATEGORIES },
	// 卜卦流派(horarySchools 七档;默认经典主流=页面默认口径)。储存记录另经 payload.extra.horarySchool 自动还原。
	// 扩档:文艺复兴(1647 基线)/序列判读(无-orb)——与 UI 档同键同名。
	{ name: 'horarySchool', label: '流派', type: 'select', default: 'classical', group: '裁决', blankFollowsBaseline: true, options: [   // 空串 / null = 没设(随存档)
		{ value: 'classical', label: '经典主流' },
		{ value: 'renaissance', label: '文艺复兴' },
		{ value: 'strict', label: '当代严谨' },
		{ value: 'sequence', label: '序列判读' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'medieval', label: '中世纪' },
		{ value: 'modern', label: '现代心理' },
	] },
	...HORARY_JUDGE_FIELDS,
	...DIVINATION_CHART_PARAM_FIELDS,
	// questionText/castingCamp/定盘自评 = 逐案内容非排盘口径(faRelatedPeople 同理),不入齿轮;
	// regenerate 已随存档 extra 回放([定盘考量] 段与 radicality 保真)。
];

// 择日流派口径 13 键(ELECTION_PARAM_SPEC 单源):齿轮扁平键 ep_<key>,'' = 随流派(现状)。
const ELECTION_PARAM_FIELDS = ELECTION_PARAM_SPEC.map((sp)=>({
	name: 'ep_' + sp.key,
	label: `口径·${sp.label}`,
	type: 'select',
	default: '',
	blankMeansFollowSchool: true,   // 同卜卦 hp_*:只记亲手键的宿主选回空档时删键
	group: `流派口径·${sp.group || '其他'}`,
	options: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value, label: o.label })))],
}));

// 卜卦/择日盘存档层 → schema 字段名展平(供 baselineSource;齿轮 merge 仍写 payload 顶层扁平键,重算读顶层优先于 extra)。
// 六爻存档层 gua.liuyaoSettings(神煞为嵌套 shensha:{on,base,set} / shenshaEx:{on,set})→ 展平成 schema 四扁平键
// (mergeLiuyaoGearSettings 的反向;此前基线直接返回嵌套对象 → 四键恒缺 → 存「新派/盲派」神煞预设的事盘在挂载里开/关神煞被剪)。
export function flattenLiuyaoStored(payload){
	const ls = payload && payload.gua && typeof payload.gua === 'object' && payload.gua.liuyaoSettings && typeof payload.gua.liuyaoSettings === 'object'
		? payload.gua.liuyaoSettings : null;
	if(!ls){ return null; }
	const out = { ...ls };
	const ss = ls.shensha && typeof ls.shensha === 'object' ? ls.shensha : null;
	if(ss){
		if(ss.on !== undefined){ out.shenshaOn = !!ss.on; }
		if(ss.base !== undefined && ss.base !== null){ out.shenshaBase = ss.base; }
		if(Array.isArray(ss.set)){ out.shenshaSet = ss.set.slice(); }
	}
	const ex = ls.shenshaEx && typeof ls.shenshaEx === 'object' ? ls.shenshaEx : null;
	if(ex && ex.on !== undefined){ out.shenshaExOn = !!ex.on; }
	return out;
}

// payload.options 打底 + 顶层扁平键覆盖(kentang 报数法四技法通用)。
// 太乙流派六轴:存档是对象(独立太乙 options.school / 三式合一 options.taiyiSchool),齿轮是平铺键(school_* / taiyiSchool_*);
// 基线把对象摊平成齿轮键 —— 此前按平铺键取 → 存了非默认流派的事盘抽屉显示「默认」,拨回默认被剪掉(重算仍按存档流派)。
export function flattenTaiyiSchoolStored(payload, objKey, prefix){
	const p = payload && typeof payload === 'object' ? payload : {};
	const oo = p.options && typeof p.options === 'object' ? p.options : {};
	const out = { ...oo };
	const sch = oo[objKey];
	if(sch && typeof sch === 'object'){
		Object.keys(sch).forEach((k)=>{ if(out[prefix + k] === undefined){ out[prefix + k] = sch[k]; } });
	}
	return out;
}

export function flattenOptionsStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const oo = p.options && typeof p.options === 'object' ? p.options : {};
	const out = { ...oo };
	Object.keys(p).forEach((k)=>{ if(k !== 'options' && k !== 'snapshot' && k !== 'module' && k !== 'pan' && k !== 'fieldSnapshot' && p[k] !== undefined && p[k] !== null && typeof p[k] !== 'object'){ out[k] = p[k]; } });
	return out;
}

// 只读上下文键的说明(AI 工具报「此刻不显示,由谁决定」时用;键名本身不给人看)
const MOUNT_CONTEXT_LABELS = {
	__tarotCorrespondenceOn: '本盘存档的「显示进阶对应」关着',
	__tarotCorrespondenceVariant: '本盘存档的「显示进阶对应」关着或牌组没有变体',
};

export function mountContextLabel(key){
	return MOUNT_CONTEXT_LABELS[key] || '';
}

// 显隐:取不到存档(同类默认 / 模板编辑这类不对应某张盘的宿主)时照出;取到时按存档的门控
export const tarotCorrespondenceShown = (ctxKey)=>(d)=>{
	const v = d ? d[ctxKey] : undefined;
	return v === undefined || v === null || `${v}` === '1';
};

export function flattenHoraryStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const ex = p.extra && typeof p.extra === 'object' ? p.extra : {};
	const out = {};
	const topic = p.topicId || p.questionCategory || ex.topicId || ex.questionCategory;
	if(topic){ out.topicId = topic; }
	// 存档流派(没存流派按存档宫制反推,与页面同一判据):抽屉显示的是这张盘实际按的流派,选它不算换派
	if(ex.horarySchool || (p.settings && typeof p.settings === 'object' && p.settings.hsys !== undefined && p.settings.hsys !== null && p.settings.hsys !== '')){ out.horarySchool = horaryStoredSchool(p); }
	const ov = ex.horaryOverrides && typeof ex.horaryOverrides === 'object' ? ex.horaryOverrides : {};
	// 显式存的空串档(「不指定」「不特别处置」)= 齿轮的 HORARY_JUDGE_EMPTY,不是「随流派」
	Object.keys(ov).forEach((k)=>{ if(ov[k] !== undefined && ov[k] !== null){ out['hp_' + k] = ov[k] === '' ? HORARY_JUDGE_EMPTY : ov[k]; } });
	// 齿轮曾写过的顶层扁平键(hp_*/horarySchool)也是「现状」的一部分(覆盖层压存档层)。
	Object.keys(p).forEach((k)=>{ if(k === 'horarySchool' || k.indexOf('hp_') === 0){ if(p[k] !== undefined && p[k] !== null){ out[k] = p[k]; } } });
	return { ...out, ...divinationChartParamsStored(p) };
}

export function flattenElectionStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const ex = p.extra && typeof p.extra === 'object' ? p.extra : {};
	const out = {};
	const topic = p.topicId || ex.topicId;
	if(topic){ out.topicId = topic; }
	['westSchool', 'tradeSide', 'talismanStar', 'surgeryPart'].forEach((k)=>{ if(ex[k] !== undefined && ex[k] !== null && ex[k] !== ''){ out[k] = ex[k]; } });
	if(ex.surgeryPartOpposite !== undefined && ex.surgeryPartOpposite !== null){ out.surgeryPartOpposite = (ex.surgeryPartOpposite === true || ex.surgeryPartOpposite === 1 || ex.surgeryPartOpposite === '1') ? 1 : 0; }
	const ep = ex.electionParams && typeof ex.electionParams === 'object' ? ex.electionParams : {};
	Object.keys(ep).forEach((k)=>{ if(ep[k] !== undefined && ep[k] !== null && ep[k] !== ''){ out['ep_' + k] = ep[k]; } });
	Object.assign(out, divinationChartParamsStored(p));
	// 存档危象日参照(extra.crisisBase = { date, moonLon })→ 齿轮 crisisDate 显示存档日期;选同一天 = 不覆盖
	if(ex.crisisBase && typeof ex.crisisBase === 'object' && ex.crisisBase.date){ out.crisisDate = `${ex.crisisBase.date}`; }
	Object.keys(p).forEach((k)=>{ if(['westSchool', 'tradeSide', 'talismanStar', 'surgeryPart', 'surgeryPartOpposite', 'crisisDate', 'natalRecordId'].indexOf(k) >= 0 || k.indexOf('ep_') === 0){ if(p[k] !== undefined && p[k] !== null){ out[k] = p[k]; } } });
	return out;
}

export const ELECTION_FIELDS = [
	{ name: 'topicId', label: '用事类型', type: 'select', default: 'marriage', group: '择日', options: ELECTION_TOPICS },
	// 西方子流派(westernSchools 五档;默认现代主流=零回归)。储存记录另经 payload.extra.westSchool 自动还原。
	{ name: 'westSchool', label: '西方流派', type: 'select', default: 'modern_main', group: '择日', options: [
		{ value: 'modern_main', label: '现代主流' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'persian', label: '波斯-阿拉伯' },
		{ value: 'renaissance', label: '文艺复兴' },
		{ value: 'modern_revival', label: '古典复兴' },
	] },
	...ELECTION_PARAM_FIELDS,
	// 事类专项(regenerate pick() 顶层优先已接;默认 '' = 不指定 = 现状):
	// 事类专项随用事类型出现(与择日页同:交易 / 护符 / 手术各自的专项控件只在该类下显示)
	{ name: 'tradeSide', label: '买卖方向（1宫=行事者）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'trade', options: [
		{ value: '', label: '不指定（通用判据）' },
		{ value: 'sell', label: '售出——强己方（1宫主），令买家来你' },
		{ value: 'buy', label: '购入——强货主方（7宫主），所购有实' },
	] },
	{ name: 'talismanStar', label: '护符主星（护符类）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'talisman', options: [
		{ value: '', label: '不指定（默认）' },
		...['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((k)=>({ value: k, label: ({ sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' })[k] })),
	] },
	{ name: 'surgeryPart', label: '手术部位（星座主管）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'surgery', options: [
		{ value: '', label: '不指定（默认）' },
		...SIGN_ORDER.map((sg)=>({ value: sg, label: `${SIGNS[sg].cn} · ${(SIGNS[sg].body_parts || []).join('/')}` })),
	] },
	{ name: 'surgeryPartOpposite', label: '部位禁忌延及对宫（诸家多延及，默认不延）', type: 'switch', options: ON_OFF, default: 0, group: '事类专项',
		normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.topicId === 'surgery' && !!d.surgeryPart },
	// crisisBase(危象日基准)= 病始日期排盘派生对象(需取盘),属逐案数据非口径 → 不入齿轮,随存档 extra 回放。
	// 危象日参照(页面「病始日期」;手术 / 用药两类才有):给了日期 = 同地点当日正午取月黄经算危象日;空 = 随存档
	{ name: 'crisisDate', label: '病始日期(危象日参照,空=随存档)', type: 'date', default: '', blankFollowsBaseline: true, group: '事类专项', showWhen: (d)=>d.topicId === 'surgery' || d.topicId === 'medication' },
	// 本命合参(页面「选本命盘」):命盘档案 id;按择日盘同一口径起本命盘出「本命合参」段;空 = 不合参
	{ name: 'natalRecordId', label: '本命合参·命盘档案 id(空=不合参)', type: 'text', default: '', blankFollowsBaseline: true, group: '合参', placeholder: '命盘的记录 id(list_records 查)' },
	...DIVINATION_CHART_PARAM_FIELDS,
];

// 三式合一：合并 六壬/奇门/太乙 三子组可调项。各子组 regen 均读 payload.options 的对应键（键名互不冲突）；
// regenerateSanshiUnifiedSnapshot 额外把 payload.options 作为 liureng 的 options 传入（补六壬子组缺口）。
// 共享时间键（timeAlg 仅奇门用；日界/晚子时奇门+太乙共用，同生辰本应一致）去重为一份置「时间换算」组。
const SANSHI_SHARED_TIME_KEYS = ['timeAlg', 'after23NewDay', 'lateZiHourUseNextDay'];

const reTagSanshi = (fields, prefix)=>fields
	.filter((f)=>!SANSHI_SHARED_TIME_KEYS.includes(f.name))
	.map((f)=>({ ...f, group: `${prefix}·${f.group || '设置'}` }));

// 三式合一的六壬层锁「正时正将」(页面不出起课法 / 选时 / 演数,pickSanshiLiurengCastOpts 同锁):齿轮不列这三项,重算也按正时正将
// 三式合一页没有这几项控件(起课恒正时正将;占事类型 / 十二长生页面不设):齿轮不列,重算按页面固定口径
const SANSHI_LIURENG_LOCKED_KEYS = ['castMethod', 'xuanShiZhi', 'yanShuNum', 'zhanCategory', 'wuxing'];

// 🔴 太乙子组键名必须对齐三式合一页面存档:页面 state.options 用 taiyiStyle/taiyiAccum/taiyiSchema(对象),
// 而 TAIYI_FIELDS 用 style/tn/school_* —— 且 options.school 已被奇门盘式(字符串)占用、sex 与奇门共键(1/0)。
// 曾原名平铺 → 存过的三式合一事盘太乙盘式/公式/流派挂载重算全落默认(regenerateTaiyiSnapshot 双源读已配套)。
const SANSHI_TAIYI_RENAME = { style: 'taiyiStyle', tn: 'taiyiAccum', timeBasis: 'taiyiTimeBasis' };   // 三式太乙区已有同源控件,齿轮同名

const reTagSanshiTaiyi = (fields)=>fields
	.filter((f)=>!SANSHI_SHARED_TIME_KEYS.includes(f.name))
	// sex 与奇门共键(1/0 数字域,太乙侧 regenerate 归一为男/女)。timeBasis 不再过滤:三式太乙区已补同源控件(键 taiyiTimeBasis,缺省 direct)。
	.filter((f)=>f.name !== 'sex')
	.map((f)=>{
		const name = SANSHI_TAIYI_RENAME[f.name] || (f.name.indexOf('school_') === 0 ? `taiyiSchool_${f.name.slice(7)}` : f.name);
		// 合一盘式不承载太乙命法盘(页面不列命法,独立太乙页另有):不列命法档(已选者仍显示)
		const extra = f.name === 'style' ? { optionShown: (o)=>Number(o.value) !== 5 } : {};
		// 显示条件里的盘式键在合一页叫 taiyiStyle:映射回去再判
		if(typeof f.showWhen === 'function'){ const sw = f.showWhen; extra.showWhen = (d)=>sw({ ...(d || {}), style: d && d.taiyiStyle !== undefined ? d.taiyiStyle : (d && d.style) }); }
		return { ...f, ...extra, name, group: `太乙·${f.group || '设置'}` };
	});

export const SANSHI_UNITED_FIELDS = [
	...reTagSanshi(LIURENG_FIELDS.filter((f)=>SANSHI_LIURENG_LOCKED_KEYS.indexOf(f.name) < 0), '大六壬'),
	...reTagSanshi(QIMEN_FIELDS, '奇门'),
	...reTagSanshiTaiyi(TAIYI_FIELDS),
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS.map(dayBoundaryLabelled('日界')),
	// 十二建星(建除十二神)随奇门子组 reTag 进来(同名 showJianChu):三式盘外圈地支旁 + 右栏卡,快照「概览」段多一行日值 / 时值
	// 外圈两项:三式合一页设置(horosa.sanshi.settings.v1),档里没有 → 跟页面现值;决定「八宫逐宫」段里外圈星盘、人事宫位落哪一支
	{ name: 'outerCoord', label: '外圈分宫', type: 'select', default: 'ecliptic', group: '外圈',
		globalCurrent: ()=>sanshiPageSetting('outerCoord'),
		options: [{ value: 'ecliptic', label: '黄道（默认）' }, { value: 'equatorial', label: '赤道（赤经）' }] },
	{ name: 'ascRaMode', label: '上升取法', type: 'select', default: ASC_RA_MODE_DEFAULT, group: '外圈',
		globalCurrent: ()=>sanshiPageSetting('ascRaMode'),
		showWhen: (d)=>`${d.outerCoord || ''}` === 'equatorial',
		options: ASC_RA_MODE_OPTIONS.map((o)=>({ value: o.value, label: o.value === ASC_RA_MODE_DEFAULT ? `${o.label}（默认）` : o.label })) },
];

function sanshiPageSetting(key){
	try{ return require('../../components/sanshi/SanShiUnitedMain').SANSHI_PAGE_SETTINGS.load()[key]; }catch(e){ return undefined; }
}
