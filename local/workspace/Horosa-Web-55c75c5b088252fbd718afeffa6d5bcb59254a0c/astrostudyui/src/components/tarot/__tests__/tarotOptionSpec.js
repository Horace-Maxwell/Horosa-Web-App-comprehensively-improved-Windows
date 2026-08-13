// 【塔罗全功能规格对照表】选项 → 生效上下文 → 预期计算(中栏) → 预期显示(右栏/中栏)
// 本表是验收基准,也是三类哨兵的唯一数据源:
//   ①规格完备性(SETTINGS_STATE_MAP 每键必须登记于此,漏登即红)
//   ②死开关验证(逐键切值:引擎签名或显示文本必须真变)
//   ③组合压力矩阵(成对覆盖 + 冲突组合 + 边界值)
// layer 语义:'board'=改牌面/结构(牌面决定类,不入挂载齿轮) · 'read'=只改判读文本(判读类,入齿轮) · 'both'
// ctx:该键生效所需的前置上下文(牌组/牌阵/其他设置);tab:该键的显示变化应在右栏哪一页可见。
export const OPTION_SPEC = [
	// ——— 牌面决定类(board):改的是抽到什么牌、什么朝向、什么结构 ———
	{
		key: 'reversals', label: '逆位开关', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'celtic' }, tab: 'meanings',
		calc: '关=同一 order 但朝向全正(只掩朝向不改抽到的牌);开=逐张按 p=0.5 定朝向',
		show: '牌面正逆徽章、牌义表「正逆」列随之变;关时逆位读法/产生方式两控件整体隐藏',
	},
	{
		key: 'reversalGen', label: '逆位产生方式', layer: 'board', values: ['shuffle', 'fingers3', 'all'],
		ctx: { deckId: 'rws', spreadType: 'celtic', reversals: true }, tab: 'meanings',
		calc: 'shuffle=逐张 rng;fingers3=独立种子流选 3 张翻转(全阵逆位≤3);all=非横置位全逆。三者 order 恒同,只换朝向',
		show: '中栏各牌朝向与牌义表正逆列;左栏出对应说明行',
	},
	{
		key: 'crossingUpright', label: '交叉牌横置', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'celtic', reversals: true }, tab: 'meanings',
		calc: '开=凯尔特位2(crossFixed)恒正读并标 crossed;关=按洗牌朝向读',
		show: '该位徽章显示「横置」而非正/逆;快照正逆列同步',
	},
	{
		key: 'includeBlank', label: '空白牌入池', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'meanings',
		calc: '开=池 78→79(第 79 张空白牌参与洗牌),整副 order 因 size 改变而重排',
		show: '若抽中则显示「空白牌□」,其对应行为「—(空白牌无对应)」',
	},
	{
		key: 'majorsOverlay', label: '大牌加盖', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'celtic' }, tab: 'meanings',
		calc: '开且大牌≥4或过半 → 每张大牌自余牌序依次盖一张小牌(含其朝向)',
		show: '牌义表该行下出「盖:…」缩进行;总览出加盖提示;快照 [逐牌详解] 后附加盖行',
	},
	{
		key: 'showCutCard', label: '切牌(心态)', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'overview',
		calc: '开=独立种子流 `${seed}|cut` 定切位,取该位牌(含朝向);不影响 draws',
		show: '总览出「切牌(心态)」行;快照 [牌阵综览] 同步',
	},
	{
		key: 'showBottomCard', label: '牌底牌(基调)', layer: 'board', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'overview',
		calc: '开=取剔除指示牌后 order 末位牌(含朝向)',
		show: '总览出「牌底牌(基调)」行;快照 [牌阵综览] 同步',
	},
	{
		key: 'sig', label: '指示牌', layer: 'board',
		values: [{ mode: 'none' }, { mode: 'manual', manualId: 'wands_king' }, { mode: 'auto', gender: 'female', age: 41, sign: 'Leo' }],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'overview',
		calc: '选定后该牌自池中剔除(order 与 reversed 同步剔除对齐),故 draws 整体改变',
		show: '中栏出指示牌卡;开钥须有指示牌方可成阵',
	},
	// ——— 判读类(read):同一副牌,只改判读文本 ———
	{
		key: 'meaningSystem', label: '牌义体系', layer: 'read', values: ['manual', 'waite', 'degrees'],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'meanings',
		calc: 'cardMeaning 三轨分派:逐牌唯一义 / 数字原型×花色派生义 / 马赛数字度(度义+危险面)',
		show: '牌义表「关键义」列与总览关键词随轨切换;degrees 轨出「第N度…(危险:…)」',
	},
	{
		key: 'reversalMode', label: '逆位读法', layer: 'read',
		values: ['stored', 'blocked', 'internal', 'opposite', 'reduced', 'excess', 'delayed', 'projection', 'misuse', 'negation', 'breakthrough', 're_words', 'retreat'],
		ctx: { deckId: 'rws', spreadType: 'celtic', reversals: true, reversalGen: 'all' }, tab: 'meanings',
		calc: '逆位牌文案按 13 式生成;retreat 走回退链(数字回前一号/王牌回十/大牌回前号/宫廷回落)',
		show: '牌义表逆位行文案随式变;左栏出该式的说明注',
	},
	{
		key: 'variant', label: '字母/路径变体', layer: 'read', values: ['A', 'B', 'C'],
		ctx: { deckId: 'rws', spreadType: 'three', showCorrespondences: true }, tab: 'meanings',
		calc: 'B=皇帝/星星字母与路径整对互换;C=大陆派字母(愚人=Shin 起),路径不显',
		show: '牌面对应行与牌义表「对应」列的希伯来/路径段随变',
	},
	{
		key: 'showCorrespondences', label: '显示进阶对应', layer: 'read', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'meanings',
		calc: '不改计算,仅决定是否追加对应叠层后缀(路径连质点/象限/辉耀)',
		show: '中栏卡片对应行与牌义表对应列出现与否;开时左栏另出变体/宫廷体系/现代行星注',
	},
	{
		key: 'dignities', label: '元素尊位', layer: 'read', values: [true, false],
		ctx: { deckId: 'golden_dawn', spreadType: 'three' }, tab: 'meanings',
		calc: '开=逐位按左右邻元素算 dignify(同+2/友+1/敌-1),挂 draw.dignity',
		show: '中栏尊位徽章、牌义表「尊位」列;快照尊位列由「—」变为强弱与理由',
	},
	{
		key: 'edVersion', label: '尊位版本', layer: 'read', values: ['modern', 'mathers'],
		ctx: { deckId: 'golden_dawn', spreadType: 'three', dignities: true }, tab: 'meanings',
		calc: 'mathers 档:火土/风水由中立升为「稍微支持」(+0.5),影响 score 与 notes',
		show: '尊位徽章强弱与其 title 说明随之变;快照尊位列理由文案变',
	},
	{
		key: 'suitElementSwap', label: '火/风互换', layer: 'read', values: [true, false],
		ctx: { deckId: 'golden_dawn', spreadType: 'celtic', dignities: true }, tab: 'synthesis',
		calc: '仅小牌花色层:权杖火→风、宝剑风→火;影响元素统计、主导元素、阴阳极性与尊位',
		show: '综合页元素分布/主导元素/极性行随变;尊位徽章可能改判',
	},
	{
		key: 'astroModern', label: '现代行星注', layer: 'read', values: [true, false],
		ctx: { deckId: 'rws', spreadType: 'three', showCorrespondences: true }, tab: 'meanings',
		calc: '不改计算;三元素大牌(愚人/吊人/审判)对应行附「近代 天王星/海王星/冥王星」',
		show: '牌义表对应列相应大牌多出近代行星段',
	},
	{
		key: 'courtElementSystem', label: '宫廷元素体系', layer: 'read', values: ['gd', 'alt'],
		ctx: { deckId: 'rws', spreadType: 'celtic', showCorrespondences: true }, tab: 'meanings',
		calc: 'alt=位阶制(王土/后水/骑火/侍风),改宫廷牌的元素中元素显示',
		show: '宫廷牌对应列由「火中火 Fire of Fire」变为「火中之土(位阶制)」',
	},
	{
		key: 'courtZodiacSystem', label: '宫廷星座体系', layer: 'read', values: ['gd_span', 'simple'],
		ctx: { deckId: 'rws', spreadType: 'celtic', showCorrespondences: true }, tab: 'meanings',
		calc: 'simple=单座制(后本位/王固定/骑变动,侍无星座),改宫廷牌黄道段显示',
		show: '宫廷牌对应列由「20°天蝎→20°射手」变为「狮子座(单座制)」',
	},
	{
		key: 'verdictMode', label: 'Yes/No 定局法', layer: 'read',
		values: ['majority', 'orientation', 'single', 'numeric', 'polarity', 'weighted_center', 'anchor', 'single3'],
		ctx: { deckId: 'rws', spreadType: 'seven_v', reversals: true }, tab: 'verdict',
		calc: '八法各自的 score 口径;anchor 读 spread.anchor 锚位;single3 出三态判词',
		show: '定局页 Yes/No 卡的判词与 score 随法变;部分法另出 note 行',
	},
	{
		key: 'quintMode', label: '精华牌口径', layer: 'read', values: ['standard', 'fool22'],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'verdict',
		calc: 'fool22=愚人计 22、归约上限 22;三张阵另算分组加法(总和/外显/左/右)',
		show: '定局页精华牌可能改牌;fool22 另出「数值加法(三张)」行',
	},
	{
		key: 'timingMethod', label: '计时法', layer: 'read',
		values: ['suit_unit', 'major_number', 'major_zodiac', 'decan_full', 'ace_hunt'],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'verdict',
		calc: '五法各自算法(花色单位/另取大牌数字/另取大牌星座区间/旬星全谱/52 子集翻至王牌)',
		show: '定局页计时卡行数与内容整体改变;快照 [定局] 计时行随之',
	},
	{
		key: 'timingUnit', label: '计时单位', layer: 'read', values: ['天', '周', '月'],
		ctx: { deckId: 'rws', spreadType: 'three', timingMethod: 'major_number' }, tab: 'verdict',
		calc: '仅大牌数字法:N 个单位内的单位名',
		show: '计时行「约 N 天/周/月内」随之变;仅该法时左栏才出此控件',
	},
	{
		key: 'ookTable', label: '开钥计数表', layer: 'read', values: ['standard', 'sephira'],
		ctx: { deckId: 'golden_dawn', spreadType: 'opening_of_key', sig: { mode: 'manual', manualId: 'wands_king' } }, tab: 'ook',
		calc: '宫廷计数值切换(通行 4/侍7 ↔ 质点 王2/后3/骑6/侍9),改环形计数链走位',
		show: '开钥页各操作的计数链牌序变;中栏分堆视图 mini 链同步',
	},
	{
		key: 'dummettOrder', label: '大牌顺序注记', layer: 'read', values: ['A', 'B', 'C'],
		ctx: { deckId: 'visconti', spreadType: 'three' }, tab: 'overview',
		calc: '不重排牌序(该派仅区域特征注记之别)',
		show: '左栏该控件下的注记行文案随 A/B/C 变',
	},
	{
		key: 'artStyle', label: '牌面样式', layer: 'read', values: ['symbol', 'image'],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'overview',
		calc: '不改计算;image 时几何布局按真实牌面比例重算容器高',
		show: '中栏卡片出 <img> 或符号;仅有 PD 真实牌面的牌组才出此控件',
	},
	{
		key: 'question', label: '所问之事', layer: 'read', values: ['', '这段关系的走向'],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'overview',
		calc: '不改抽牌;随 reading 与存档带走',
		show: '总览「所问」卡出现与否;快照 [牌阵综览] 出「所问:」行',
	},
	{
		key: 'birth', label: '生日(生命牌)', layer: 'read',
		values: [{ year: '', month: '', day: '', refYear: '' }, { year: 1990, month: 6, day: 15, refYear: 2026 }],
		ctx: { deckId: 'rws', spreadType: 'three' }, tab: 'birthcards',
		calc: '人格牌=(月+日+年)归约≤22、灵魂牌=再归约≤9、流年牌=(月+日+流年)归约',
		show: '生命牌页由「输入完整生日后显示」变为人格/灵魂/流年三行;快照出 [生命牌] 段',
	},
];

// 牌组 × 牌阵 的结构性规格(压测遍历用)
export const DECK_SPEC = [
	{ id: 'rws', size: 78, method: 'tarot', blank: true, hasArt: true },
	{ id: 'tdm', size: 78, method: 'tarot', blank: true, meaningDefault: 'degrees' },
	{ id: 'thoth', size: 78, method: 'tarot', blank: true, ook: true, dignities: true },
	{ id: 'golden_dawn', size: 78, method: 'tarot', blank: true, ook: true, dignities: true },
	{ id: 'bota', size: 78, method: 'tarot', blank: true },
	{ id: 'wirth', size: 22, method: 'tarot', meaningDefault: 'degrees' },
	{ id: 'egyptian', size: 22, method: 'tarot', meaningDefault: 'degrees' },
	{ id: 'etteilla', size: 78, method: 'tarot' },
	{ id: 'lenormand', size: 36, method: 'lenormand' },
	{ id: 'kipper', size: 36, method: 'lenormand' },
	{ id: 'sibilla', size: 52, method: 'cartomancy' },
	{ id: 'cartomancy', size: 52, method: 'cartomancy' },
	{ id: 'minchiate', size: 97, method: 'tarot' },
	{ id: 'visconti', size: 78, method: 'tarot', dummett: true, meaningDefault: 'degrees' },
];

// 引擎签名:把一次 reading 的全部可观测量压成一串(牌面层判据)
export function boardSignature(r){
	if(!r){ return 'null'; }
	const draws = (r.draws || []).map((d) => `${d.cardId}${d.crossed ? 'X' : d.isReversed ? 'R' : 'U'}${d.overlay ? `+${d.overlay.cardId}` : ''}${d.dignity ? `@${d.dignity.strength}` : ''}`).join('|');
	const cut = r.cutCard && r.cutCard.card ? `${r.cutCard.card.id}${r.cutCard.isReversed ? 'R' : 'U'}` : '-';
	const bottom = r.bottomCard && r.bottomCard.card ? `${r.bottomCard.card.id}${r.bottomCard.isReversed ? 'R' : 'U'}` : '-';
	const ook = r.ook && r.ook.operations ? r.ook.operations.map((o) => (o.chain || []).map((it) => it.card && it.card.id).join('>')).join(';') : '-';
	const fr = r.firstReversal ? `${r.firstReversal.count || r.firstReversal.error || ''}` : '-';
	const pool = (r.draws || []).length + (r.restIds || []).length;
	return `${draws}#cut=${cut}#bot=${bottom}#ook=${ook}#fr=${fr}#pool=${pool}`;
}
