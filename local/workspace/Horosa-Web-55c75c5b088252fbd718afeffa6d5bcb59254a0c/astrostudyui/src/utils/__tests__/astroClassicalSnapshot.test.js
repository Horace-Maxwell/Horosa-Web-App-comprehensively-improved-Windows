import { buildAstroSnapshotContent, buildClassicalAnalysisSection } from '../astroAiSnapshot';

// 自检(第四同步 AI挂载 + 导出):西占快照[古典]段 = 逐曜古典状态 + 围攻详断。
// 断言只用「我方逐字输出的固定标签」(与 msg() 翻译无关),与 AstroInfo.js 古典渲染同源。
const mkChart = (extra = {})=>({
	chart: {
		isDiurnal: true,
		stars: [],
		houses: [],
		objects: [
			{ id: 'Sun', sign: 'Pisces', signlon: 0.5, house: 'House9', joy: true, joyHouse: 9,
				ofSect: true, degreeQuality: 'D', degreeGender: 'masculine',
				mansion: { idx: 28, cn: '鱼腹', nature: '吉', use: '行船' },
				apogeeDir: 'rising', numberTrend: 'decreasing',
				monomoiria: 'Mars', ninthPart: 'Pisces', darijan: 'Mars' },
			{ id: 'Moon', sign: 'Gemini', signlon: 10, house: 'House11', outOfBounds: true, oobDelta: 1.23, oobMode: 'going', lightTrend: 'waxing', apogeeDir: 'falling', numberTrend: 'increasing' },
			{ id: 'Mercury', sign: 'Aquarius', signlon: 6, house: 'House8', phase: 'combust', phasisElong: 3.2, feral: true, specialDegree: { pitted: true, azemene: false, fortune: false } },
		],
		...extra,
	},
	params: {},
	lots: [],
	aspects: {},
	receptions: {},
	mutuals: {},
	declParallel: {},
	surround: {
		besiegement: [
			{ target: 'Mercury', type: 'MarsSaturn', kind: '围攻', nature: '凶', targetRetro: false, severe: true,
				besiegers: [
					{ id: 'Mars', aspect: 0, season: '春', retro: false, delta: 2.1, restrained: [], counterBesieged: false },
					{ id: 'Saturn', aspect: 0, season: '夏', retro: true, delta: 2.3, restrained: ['Jupiter'], counterBesieged: true },
				],
				defense: [ { id: 'Venus', aspect: 0, side: '春', against: 'Mars', orb: 1.5, byBody: false, strong: true } ] },
			{ target: 'Moon', type: 'SunMoon', kind: '围耀', nature: '贵', targetRetro: false, severe: null,
				besiegers: [ { id: 'Sun', aspect: 60, season: '中', retro: false, delta: 1.0, restrained: [], counterBesieged: false } ],
				defense: [] },
		],
	},
});

describe('西占 AI 快照[古典]段', ()=>{
	const out = buildAstroSnapshotContent(mkChart(), null);

	it('含[古典]段标题与两个子节', ()=>{
		expect(out).toContain('[古典]');
		expect(out).toContain('逐曜古典状态');
		expect(out).toContain('围攻详断');
	});

	it('逐曜古典状态:出界/喜乐/宗派/野逸/度数性质·阳阴/月站/远地点·数·光/度数主星 标签齐全', ()=>{
		expect(out).toContain('出界+1.23°（远行）');   // 月·oobMode going
		expect(out).toContain('喜乐（9宫）');
		expect(out).toContain('同宗');                  // ofSect true
		expect(out).toContain('野逸');
		expect(out).toContain('暗度');                  // degreeQuality D
		expect(out).toContain('阳性度');                // masculine
		expect(out).toContain('月站鱼腹（吉）');
		expect(out).toContain('升·趋远地点');
		expect(out).toContain('数减·渐迟');             // decreasing
		expect(out).toContain('光增·渐盈');             // 月 waxing
		expect(out).toContain('焦伤（距日3.2°）');       // phase combust + elong
		expect(out).toContain('陷度');                  // specialDegree pitted
		expect(out).toContain('单度主星');
		expect(out).toContain('九分');
		expect(out).toContain('Darijan');
	});

	it('围攻详断:三围名/性 + 凶剧见血 + 日木制约 + 围魏救赵 + 协防(以身/遥光·强弱) + 断语', ()=>{
		expect(out).toContain('围攻（凶）');
		expect(out).toContain('凶剧见血');
		expect(out).toContain('日木制约凶减半');
		expect(out).toContain('围魏救赵');
		expect(out).toContain('协防：');
		expect(out).toContain('遥光');                  // byBody false
		expect(out).toContain('·强');                   // strong true
		expect(out).toContain('智力特异·语言障碍');     // 围攻 Mercury 断语
		expect(out).toContain('围耀（贵）');
		expect(out).toContain('致贵·领袖魅力·载众载民'); // 围耀 断语
	});

	it('无任何七政对象时不产出[古典]空段', ()=>{
		// 完全无七政对象(空 objects)→ 逐曜古典/围攻/围绕/melothesia 全空 → [古典] 段应当缺席。
		const bare = { chart: { isDiurnal: true, stars: [], houses: [], objects: [] }, params: {}, lots: [], aspects: {}, receptions: {}, mutuals: {}, declParallel: {}, surround: {} };
		const o2 = buildAstroSnapshotContent(bare, null);
		expect(o2).not.toContain('[古典]');
	});
});

describe('古典格局派生分析段 buildClassicalAnalysisSection', ()=>{
	const analysis = {
		classicalPatterns: { doryphory: [{ planet: 'Mercury', light: 'Sun', elong: -7.87 }], overcoming: [{ over: 'Sun', under: 'Mars', aspect: 'square', overSign: 'Pisces', underSign: 'Gemini' }], besieging: [] },
		aspectDynamics: { translation: [{ mover: 'Moon', from: 'Mercury', to: 'Sun' }], collection: [{ collector: 'Sun', p1: 'Mercury', p2: 'Venus' }], aversion: [{ a: 'Sun', b: 'Mercury' }], bending: [] },
		topicAlmuten: [{ topic: '婚配', house: 7, significator: 'Venus', almuten: 'Mars' }],
		accidentalDignity: [{ planet: 'Venus', score: 14, factors: ['角宫+5', '自由光+5'] }],
		fixedStarHits: [{ star: 'Aldebaran', cn: '毕宿五', point: 'Mars', behenian: true, royal: '东' }],
		planetaryHours: { dayRuler: 'Mercury', sunrise: '06:31', sunset: '17:44' },
		egyptianCalendar: { siriusRising: '1991-08-06', decanIndex: 11, decanSign: 'Cancer', decanRuler: 'Mercury' },
		babylonianStars: [{ planet: 'Mercury', star: 'Deneb Algedi', cn: '垒壁阵', conj: true }],
		patterns: [{ type: 't_square', label: 'T-Square', points: ['Venus', 'Jupiter', 'Uranus'], apex: 'Venus' }],
		distribution: { elements: { Fire: 1, Earth: 6, Air: 0, Water: 3 }, modes: { Cardinal: 6, Fixed: 3, Mutable: 1 }, hemispheres: { east: 2, west: 8, above: 4, below: 6 } },
		temperament: { temperaments: { Choleric: 1, Melancholic: 6, Sanguine: 5, Phlegmatic: 2 }, qualities: { Hot: 6, Cold: 8, Dry: 7, Humid: 7 } },
		almutem: { winner: 'Venus', totals: { Venus: 29, Saturn: 29, Moon: 23 } },
	};

	it('格式化 analyze_chart 全部键(护卫/优势/传光/聚光/不合意/逐题/偶然/恒星/行星时/埃及/巴比伦/相位格局/分布/气质/Almuten 无遗漏)', ()=>{
		const out = buildClassicalAnalysisSection(analysis);
		expect(out).toContain('[古典格局]');
		['护卫', '优势相位', '传光', '聚光', '不合意', '逐题主星', '偶然尊贵', '恒星触发', '比尼', '王者', '行星时', '埃及历', '巴比伦参照星',
			'相位格局', 'T-Square', '分布权重', '元素', '气质评估', '忧郁', 'Almuten 总主'].forEach((t)=> expect(out).toContain(t));
	});

	it('极区:siriusRising 缺失但有上升旬 → 埃及历仍呈现十分宫(不整块丢)', ()=>{
		const polar = { egyptianCalendar: { siriusRising: null, decanIndex: 36, decanSign: 'Pisces', decanRuler: 'Mars' } };
		const out = buildClassicalAnalysisSection(polar);
		expect(out).toContain('埃及历');
		expect(out).toContain('上升第36旬');
	});

	it('空/无 analysis → 空段(优雅降级,不抛)', ()=>{
		expect(buildClassicalAnalysisSection(null)).toBe('');
		expect(buildClassicalAnalysisSection({})).toBe('');
	});
});

describe('AI 四同步补齐 16 项 GAP — 用户名条目逐一覆盖', ()=>{
	// 单尽:在 mock chart 上塞全所有 GAP 触发字段,buildAstroSnapshotContent 须输出对应所有标签。
	const fullChart = {
		chart: {
			isDiurnal: true,
			stars: [],
			houses: [
				{ id: 'House1', sign: 'Aries', signlon: 0 },
				{ id: 'House4', sign: 'Cancer', signlon: 0 },
				{ id: 'House7', sign: 'Libra', signlon: 0 },
				{ id: 'House10', sign: 'Capricorn', signlon: 0 },
			],
			objects: [
				// Asc 用于 命主星 派生
				{ id: 'Asc', sign: 'Aries', signlon: 5, lon: 5 },
				// Sun: 29° → 歧度;有 face;落座 Aries → 头部 melothesia
				{ id: 'Sun', sign: 'Aries', signlon: 29, house: 'House1', lon: 29, dignities: { face: 'Mars' } },
				// Moon: viaCombust, nakshatra
				{ id: 'Moon', sign: 'Scorpio', signlon: 28, house: 'House8', lon: 238, isViaCombust: true },
				{ id: 'Mars', sign: 'Aries', signlon: 10, house: 'House1', lon: 10 },
				{ id: 'Mercury', sign: 'Pisces', signlon: 1, house: 'House12', lon: 331, isViaRepression: true },
				{ id: 'Venus', sign: 'Taurus', signlon: 5, house: 'House2', lon: 35 },
				{ id: 'Jupiter', sign: 'Sagittarius', signlon: 5, house: 'House9', lon: 245 },
				{ id: 'Saturn', sign: 'Capricorn', signlon: 5, house: 'House10', lon: 275 },
			],
			nakshatras: { Moon: { index: 18, name: 'Jyeshtha', label: '心宿', pada: 2, lord: 'Mercury' } },
			antiscias: {}, surround: {},
		},
		params: { birth: '1991-02-20 14:00:00', zone: '+08:00' },
		lots: [], aspects: {},
		receptions: {
			normal: [{ beneficiary: 'Sun', supplier: 'Moon', supplierRulerShip: ['exile'] }],
			abnormal: [],
		},
		mutuals: {},
		declParallel: {},
		surround: {},
	};

	it('FIX-16 命主星 显式标签出现在起盘信息', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('命主星：');
	});

	it('FIX-1 宫神星(houseRows) 出现在主宰星链', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('宫神星(houseRows)');
		// [v2 表化重钉] v1 行「1宫(座)：宫主 X 落 …」→ GFM 表行「| 1宫 | 座 | 宫主 | 落宫 | 落座 |」。
		expect(out).toMatch(/\| 1宫 \| [^|\n]+ \| [^|\n]+ \| [^|\n]+ \| [^|\n]+ \|/);
	});

	it('FIX-7 月宿 nakshatra 出现在行星段', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		// [v2 表化重钉] v1 行「月宿：第18宿 …」→ ◆位置与速度 表「月宿」列 cell(值零变化)。
		expect(out).toContain('月宿');
		expect(out).toMatch(/\|[^|\n]*第18宿 Jyeshtha（心宿） 第2步·宿主水星[^|\n]*\|/);
	});

	it('FIX-12 29°歧度 + 燃烧之路 + 压抑之路 在落座行', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('位于歧度');
		expect(out).toContain('位于燃烧之路');
		expect(out).toContain('位于压抑之路');
	});

	it('FIX-15 接纳「拒绝」标识(supplier 在受纳星座为 exile)', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('（拒绝）');
	});

	it('FIX-13 度数主星补 Face(面主)', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('面主');
	});

	it('FIX-11 身体部位 Melothesia 在古典段', ()=>{
		const out = buildAstroSnapshotContent(fullChart, null);
		expect(out).toContain('身体部位(Melothesia)');
	});
});

describe('AI 四同步补齐 — buildClassicalAnalysisSection 派生分析 5 项 GAP', ()=>{
	const fullAnalysis = {
		classicalPatterns: { doryphory: [], overcoming: [], besieging: [] },
		aspectDynamics: { translation: [], collection: [], aversion: [], bending: [] },
		topicAlmuten: [{ topic: '父亲', house: 4, significator: 'Saturn', almuten: 'Saturn' }],
		accidentalDignity: [],
		fixedStarHits: [],
		planetaryHours: {
			dayRuler: 'Mercury', sunrise: '06:31', sunset: '17:44',
			hours: [
				{ index: 1, ruler: 'Mercury', diurnal: true, current: false },
				{ index: 12, ruler: 'Sun', diurnal: true, current: true },
				{ index: 1, ruler: 'Mars', diurnal: false, current: false },
				{ index: 12, ruler: 'Moon', diurnal: false, current: false },
			],
		},
		egyptianCalendar: { siriusRising: '1991-08-06', siriusYear: 1991, decanIndex: 11, decanSign: 'Cancer', decanRuler: 'Mercury' },
		babylonianStars: [],
		almutem: { winner: 'Venus', totals: { Venus: 29, Saturn: 29, Sun: 6 } },
		extraLots: [
			{ label: '爱欲点', category: '七点', sign: 'Leo', signlon: 12.34 },
			{ label: '必然点', category: '七点', sign: 'Virgo', signlon: 5.67 },
		],
	};

	it('FIX-3 Topical Almuten 含自然象征', ()=>{
		const out = buildClassicalAnalysisSection(fullAnalysis);
		expect(out).toContain('自然象征');
	});

	it('FIX-4 行星时 24 时辰昼夜分列', ()=>{
		const out = buildClassicalAnalysisSection(fullAnalysis);
		expect(out).toContain('昼时：');
		expect(out).toContain('夜时：');
		expect(out).toContain('←当前');   // FIX-4 current 标识
	});

	it('FIX-5 埃及历含 siriusYear 岁年', ()=>{
		const out = buildClassicalAnalysisSection(fullAnalysis);
		expect(out).toContain('岁年 1991');
	});

	it('FIX-2 Almuten 逐星得分全表(按分降序)', ()=>{
		const out = buildClassicalAnalysisSection(fullAnalysis);
		expect(out).toContain('Almuten 逐星得分：');
		// 三个得分行(Venus29 / Saturn29 / Sun6)按降序出现:Sun(6)的位置必须在 29 行之后。
		expect(out).toContain(' 29');
		expect(out).toContain(' 6');
		const six = out.indexOf(' 6');
		const twentyNine = out.indexOf(' 29');
		expect(six).toBeGreaterThan(twentyNine);
	});

	it('FIX-6 阿拉伯点扩展(extraLots)按 label+category+度数输出', ()=>{
		const out = buildClassicalAnalysisSection(fullAnalysis);
		expect(out).toContain('阿拉伯点(扩展)');
		expect(out).toContain('爱欲点');
		expect(out).toContain('（七点）');
	});
});
