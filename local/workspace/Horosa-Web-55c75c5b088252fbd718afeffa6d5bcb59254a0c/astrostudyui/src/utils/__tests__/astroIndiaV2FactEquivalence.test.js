// [印占 v2 表化 · 值零丢失证明] buildJyotishSnapshotLines 把约 34 段流水散文改成 GFM 表后,
// 必须证明「排版变、事实零丢失」。做法:
//   基线 = git show HEAD 的改前实现(见 fixtures/indiaJyotishBaselineHead.js,散文版);
//   现行 = 当前 IndiaChart.js 的表化实现;
//   同一 fixture chartObj 各跑一遍,对每个段做:
//     (A) fact 多重集相等 —— 剔掉 GFM 表头/分隔行(表头词非事实),剩下 token 多重集必须逐一相等;
//     (B) 逐行元组集相等 —— 每行 token 排序成元组,行集合相等(关系型行:主语重复也不串行)。
//   再跑否定对照:改一个真值 → 比对器必须报红(证明比对非平凡)。
// token 口径 /[一-龥A-Za-z0-9~+.]+/g:所有分隔符(｜：·（）,→/ 空格 ° – ◀)均在字符集外,故列改行/冒号改竖线不产生/丢失 token。
import { buildJyotishSnapshotLines as current } from '../../components/astro/IndiaChart';
import { buildJyotishSnapshotLinesBaseline as baseline } from './fixtures/indiaJyotishBaselineHead';

const TOK = /[一-龥A-Za-z0-9~+.]+/g;
// GFM 分隔行:两竖线之间只含竖线/空格/冒号/半角连字符('---')。空单元格占位符 '—' 是全角破折号(U+2014),
// 不在此类,故纯占位数据行不会被误判为分隔行。
const isSep = (ln)=>/^\s*\|[\s:|-]+\|\s*$/.test(String(ln));
// 去掉 gfmTable 骨架:每遇分隔行,删该行及其紧邻的上一行(表头);gfmTable 恒为[表头,分隔,...数据],故上一行必是表头。
function stripScaffold(lines){
	const arr = Array.isArray(lines) ? lines : [lines];
	const drop = new Set();
	arr.forEach((ln, i)=>{ if(isSep(ln)){ drop.add(i); if(i > 0){ drop.add(i - 1); } } });
	return arr.filter((_, i)=>!drop.has(i));
}
const toks = (s)=>(String(s).match(TOK) || []);
// (A) 全段 token 多重集(排序后逐一比较)。
const factBag = (lines)=>stripScaffold(lines).reduce((acc, ln)=>acc.concat(toks(ln)), []).sort();
// (B) 逐行元组集:每行 token 排序拼成元组,行集合排序;比多重集更严(值串到别的行会被抓)。
const factRows = (lines)=>stripScaffold(lines).map((ln)=>toks(ln).sort().join('')).sort();

// 覆盖尽量多段的 fixture:每个改动段都给可辨识的独立真值,便于比对有实义。
const FIXTURE = { jyotish: {
	panchanga: {
		vara: { label: '周日', lord: { label: '太阳' } },
		tithi: { index: 5, name: 'Panchami', paksha: 'Shukla' },
		nakshatra: { label: '娄宿', detail: { deity: 'Yama', gana: 'Manushya', yoniAnimal: '蛇' } },
		yoga: { name: 'Siddhi' }, karana: { name: 'Bava' },
	},
	jaimini: { charaKarakas: [
		{ karakaLabel: 'AK', karaka: 'Atmakaraka', label: '罗睺', planet: 'North Node', sign: 'Cancer', signLabel: '巨蟹', signlon: 28.283, karakaDegree: 28.283 },
		{ karakaLabel: 'DK', karaka: 'Darakaraka', label: '太阳', planet: 'Sun', sign: 'Aries', signLabel: '白羊', signlon: 5.14, karakaDegree: 5.14 },
	] },
	nodeRasiDrishti: [
		{ giverLabel: '罗睺', targetSignLabel: '天蝎' },
		{ giverLabel: '计都', targetSignLabel: '金牛' },
	],
	strengths: {
		planetaryStates: [
			{ label: '木星', sign: 'Cancer', signLabel: '巨蟹', signlon: 5.2, house: 4, dignity: 'exaltation', vargottama: true, retrograde: false, combust: false, baladi: { label: '青年' }, nakshatra: { name: 'Pushya', pada: 1 }, lajjitadi: [{ label: 'Garvita' }] },
			{ label: '水星', sign: 'Aries', signLabel: '白羊', signlon: 12.7, house: 1, dignity: 'neutral', vargottama: false, retrograde: true, combust: true, baladi: { label: '少年' }, nakshatra: { name: 'Ashwini', pada: 4 } },
		],
		vargaDignity: [
			{ label: '木星', d1: '巨蟹', amsa: { shadvarga: { count: 4, amsa: 'Simhasana' }, saptavarga: { count: 5 }, dasavarga: { count: 7 }, shodasavarga: { count: 10 } } },
			{ label: '水星', d1: '白羊', amsa: {} },
		],
	},
	ashtakavarga: {
		available: true,
		sarvaBySign: [{ label: '白羊', bindu: 30 }, { label: '金牛', bindu: 28 }],
		sodhyaPinda: { Sun: { rasiPinda: 120, grahaPinda: 40, total: 160 }, Moon: { rasiPinda: 90, grahaPinda: 30, total: 120 } },
	},
	shadbala: { planets: [
		{ label: '木星', totalRupa: 7.5, ishta: 42.3, kashta: 17.7, uchchaBala: 55.1 },
		{ label: '水星', totalRupa: 5.2, ishta: 30.0, kashta: 30.0, uchchaBala: 12.4 },
	] },
	shadbalaBphs: { Sun: { vimsopaka: { shadvarga: { total: 12.5 }, saptavarga: { total: 11 }, dasavarga: { total: 13 }, shodasavarga: { total: 10.5 } } } },
	muhurta: {
		horaTable: { weekday: 2, rows: [
			{ index: 1, period: 'day', lord: 'Mars', lordCN: '火星', start: '2026-06-23 06:11:00' },
			{ index: 2, period: 'day', lord: 'Sun', lordCN: '太阳', start: '2026-06-23 07:00:00' },
		] },
		choghadia: { weekday: 4, rows: [
			{ index: 1, period: 'day', key: 'Shubh', cn: '吉', nature: 'good', start: '2026-06-23 06:00:00' },
			{ index: 2, period: 'night', key: 'Kaal', cn: '时', nature: 'bad', start: '2026-06-23 19:20:00' },
		] },
		panchaka: { typeLabel: 'Mrityu', remainder: 3, isPanchaka: true },
		abhijit: { auspicious: true },
	},
	dasha: {
		mula: { available: true, mahadashas: [
			{ round: 1, planetCN: '金星', house: 7, years: 20 },
			{ round: 1, planetCN: '太阳', house: 1, years: 6 },
			{ round: 2, planetCN: '月亮', house: 4, years: 10 },
		] },
		sudarshanaChakra: { available: true, rows: [
			{ year: 30, current: true, slLabel: '狮子', clLabel: '巨蟹', jlLabel: '白羊' },
			{ year: 31, current: false, slLabel: '处女', clLabel: '狮子', jlLabel: '金牛' },
		] },
		naisargika: { available: true, mode: 'varahamihira', periods: [
			{ planet: 'Moon', planetCN: '月', years: 1, startAge: 0, endAge: 1, start: '1990-03-15', end: '1991-03-15' },
			{ planet: 'Saturn', planetCN: '土', years: 50, startAge: 70, endAge: 120, start: '2060-03-14', end: '2110-03-15' },
		] },
	},
	supplementaryLagnas: { available: true,
		chandraLagna: { key: 'chandraLagna', label: '月上升', sign: 'Cancer', signLabel: '巨蟹' },
		karakamsa: { key: 'karakamsa', label: 'Karakamsa', sign: 'Scorpio', signLabel: '天蝎' },
		induLagna: { key: 'induLagna', label: 'Indu 财富上升', sign: 'Aquarius', signLabel: '水瓶', sumKala: 20, stepS: 8 },
	},
	nadi: {
		available: true,
		bhriguBindu: { lon: 240.9611, sign: 'Sagittarius', signLabel: '射手', nakshatra: { name: 'Mula', pada: 1 } },
		d150: [
			{ planet: 'Sun', nadiamsa: 77, sign: 'Leo', signLabel: '狮子' },
			{ planet: 'Moon', nadiamsa: 33, sign: 'Cancer', signLabel: '巨蟹' },
		],
	},
	ayurdaya: { available: true,
		pindayu: { baseYears: 98.55, contributions: [
			{ planetCN: '日', fullYears: 19, years: 16.915 },
			{ planetCN: '土', fullYears: 20, years: 16.134 },
		] },
		nisargayu: { naturalYears: [{ planetCN: '日', years: 20 }, { planetCN: '月', years: 1 }] },
	},
	upagraha: {
		available: true,
		specialLagnas: {
			bhavaLagna: { label: 'Bhava Lagna', lon: 95.5 },
			horaLagna: { label: 'Hora Lagna', lon: 155.2 },
			pranapada: { variantSunrise: 12.3, variantBirth: 44.8 },
		},
		timeBased: [
			{ key: 'Gulika', lon: 210.4, note: '土之子' },
			{ key: 'Maandi', lon: 15.9 },
		],
		sunBased: [{ key: 'Kaala', lon: 88.1 }],
	},
	outerPlanets: { available: true, planets: [
		{ label: '天王星', sign: 'Taurus', signLabel: '金牛', signlon: 18.3, retrograde: true, house: 2, nakshatra: 'Rohini', pada: 3 },
	] },
	shashtiamsa: { available: true, beneficCount: 4, maleficCount: 3, planets: [
		{ planet: 'Sun', segment: 12, sign: 'Leo', signLabel: '狮子', nature: 'benefic' },
		{ planet: 'Mars', segment: 47, sign: 'Aries', signLabel: '白羊', nature: 'malefic' },
	] },
	vargaVariants: { available: true, charts: [
		{ label: 'D30', variants: [{ label: 'Parashara' }, { label: 'Traditional' }], planets: [
			{ planet: 'Sun', differs: true, cells: [{ signLabel: '白羊' }, { signLabel: '天蝎' }] },
			{ planet: 'Moon', differs: false, cells: [{ signLabel: '巨蟹' }, { signLabel: '巨蟹' }] },
		] },
	] },
	functionalNature: { grahas: [
		{ planetLabel: '木星', functionalNature: 'benefic', isYogakaraka: false, isMaraka: false, isBadhaka: false, housesRuled: [9, 12] },
		{ planetLabel: '土星', functionalNature: 'yogakaraka', isYogakaraka: true, isMaraka: false, isBadhaka: true, housesRuled: [10, 11] },
	] },
	bhavaBala: { available: true, strongest: 10, weakest: 6, houses: [
		{ house: 1, rupas: 8.42, rank: 1 }, { house: 6, rupas: 3.11, rank: 12 },
	] },
	grahaYuddha: { available: true, pairs: [
		{ winnerLabel: '木星', loserLabel: '金星', sepDeg: 0.42 },
	] },
	extendedDashas: {
		conditional: {
			ashtottari: { label: 'Ashtottari', totalYears: 108, available: true, firstLord: { label: '太阳' } },
			yogini: { label: 'Yogini', totalYears: 36, available: false, firstLord: { label: '月亮' } },
		},
		chara: { seedLabel: '天秤', seed: 'Libra', direction: 'reverse', mahadashas: [{ rasiLabel: '天秤', rasi: 'Libra', years: 9 }] },
	},
	kartari: { available: true, yogas: [
		{ targetLabel: '月亮', typeLabel: 'Papa Kartari', prevLabels: ['火星'], nextLabels: ['土星'] },
	] },
	sudarshana: { available: true, rows: [
		{ planetLabel: '木星', houseFromLagna: 4, houseFromSun: 10, houseFromMoon: 7 },
		{ planetLabel: '金星', houseFromLagna: 7, houseFromSun: 1, houseFromMoon: 10 },
	] },
	kp: {
		rulingPlanets: { set: ['太阳', '月亮', '火星'] },
		kpLevels: {
			太阳: { Nak: '昴', Sub: '木', Prati: '金', Sook: '土', Praana: '水', Deha: '日' },
			月亮: { Nak: '娄', Sub: '火', Prati: '日', Sook: '木', Praana: '金', Deha: '月' },
		},
		cuspalSubLords: [
			{ house: 1, starLord: '火星', subLord: '木星' },
			{ house: 2, starLord: '金星', subLord: '土星' },
		],
		significators: {
			太阳: { ranked: [1, 5, 9] },
			月亮: { ranked: [4, 7] },
		},
	},
	grahaMaitri: { available: true, planetLabels: ['日', '月', '火'], matrix: [
		{ planetLabel: '日', cells: [{ planetLabel: '日', self: true }, { planetLabel: '月', compoundCn: '友' }, { planetLabel: '火', compoundCn: '中' }] },
		{ planetLabel: '月', cells: [{ planetLabel: '日', compoundCn: '友' }, { planetLabel: '月', self: true }, { planetLabel: '火', compoundCn: '敌' }] },
		{ planetLabel: '火', cells: [{ planetLabel: '日', compoundCn: '友' }, { planetLabel: '月', compoundCn: '中' }, { planetLabel: '火', self: true }] },
	] },
	gochara: {
		available: true,
		fromMoon: [
			{ planetLabel: '木星', signLabel: '狮子', house: 5, good: true, effective: true, av: { savBindu: 30, bavBindu: 5 } },
			{ planetLabel: '土星', signLabel: '摩羯', house: 8, auspicious: false, effective: false, av: { savBindu: 22, bavBindu: 2 } },
		],
		saturnAfflictions: { sadeSati: { active: true, phaseLabel: '顶点' } },
		fromLagna: [
			{ planetLabel: '木星', house: 11, good: true },
			{ planetLabel: '火星', house: 6, auspicious: false },
		],
	},
	remedies: { table: [
		{ planetCn: '日', gem: '红宝石', metal: '铜', mantraCount: 7000, deity: ['Surya'] },
		{ planetCn: '土', gem: '蓝宝石', metal: '铁', mantraCount: 23000, deity: ['Shani', 'Hanuman'] },
	] },
	arudha: { argala: {
		1: { netStronger: 'argala', argalaCount: 3, virodhaCount: 1 },
		7: { netStronger: 'virodha', argalaCount: 1, virodhaCount: 2 },
	} },
	rasiDasha: {
		narayana: { available: true, mahadashas: [
			{ rasi: 'Aries', years: 7, deity: 'Agni' },
			{ rasi: 'Taurus', years: 2.5 },
		] },
		kalachakra: { available: true, mahadashas: [{ rasi: 'Cancer', years: 21 }] },
	},
	tajaka: {
		harshaBala: { 太阳: { total: 15.0 }, 月亮: { total: 8.5 } },
		panchaVargeeyaBala: { 太阳: { total: 12.34 }, 月亮: { total: 9.87 } },
		dasas: { mudda: { available: true, sequence: [{ key: 'Sun', days: 18.6 }, { key: 'Moon', days: 30.1 }] } },
	},
	yogas: { available: true, summary: { total: 2, strong: 1, medium: 1, weak: 0 }, items: [
		{ zhName: '五大人瑜伽', name: 'Hamsa', category: 'Pancha Mahapurusha', levelLabel: '强', score: 85, planetLabels: ['木星'] },
		{ name: 'Gajakesari', category: 'Lunar', levelLabel: '中', score: 60, planetLabels: ['木星', '月亮'] },
	] },
} };

const baseOut = baseline(FIXTURE);
const curOut = current(FIXTURE);
const sectionKeys = Object.keys(baseOut);

describe('印占 v2 表化 · fact 等价（值零丢失证明）', ()=>{
	it('fixture 覆盖足够多段（≥30 段进入比对）', ()=>{
		expect(sectionKeys.length).toBeGreaterThanOrEqual(30);
	});

	it('段键集合改前后完全一致（无段丢失/新增/改名）', ()=>{
		expect(Object.keys(curOut).sort()).toEqual(Object.keys(baseOut).sort());
	});

	// 逐段:fact 多重集(A) + 逐行元组集(B) 双判等价。
	sectionKeys.forEach((key)=>{
		it(`段【${key}】改前散文 ↔ 改后表化 事实零丢失`, ()=>{
			expect(factBag(curOut[key])).toEqual(factBag(baseOut[key]));
			expect(factRows(curOut[key])).toEqual(factRows(baseOut[key]));
		});
	});

	it('否定对照:任改一个真值 → 比对器报红（证明比对非平凡）', ()=>{
		// 深拷贝 fixture,把卡拉卡首星用度 28.283→99.999(→ 表格 fx 后 100.00),现行输出对基线应不再等价。
		const mutated = JSON.parse(JSON.stringify(FIXTURE));
		mutated.jyotish.jaimini.charaKarakas[0].karakaDegree = 99.999;
		mutated.jyotish.jaimini.charaKarakas[0].signlon = 99.999;
		const curMut = current(mutated);
		const KEY = '卡拉卡（8 Chara Karakas）';
		// 未改前:现行 vs 基线 等价(基准成立)。
		expect(factRows(curOut[KEY])).toEqual(factRows(baseOut[KEY]));
		// 改一个值后:现行(改) vs 基线(原) 必不等价 —— 多重集与元组集都应报红。
		expect(factBag(curMut[KEY])).not.toEqual(factBag(baseOut[KEY]));
		expect(factRows(curMut[KEY])).not.toEqual(factRows(baseOut[KEY]));
		// 具体:新值 100.00 出现、旧值 28.28 消失,证明比对真的盯着数值。
		expect(curMut[KEY].join('\n')).toMatch(/100\.00/);
		expect(curMut[KEY].join('\n')).not.toMatch(/28\.28/);
	});

	it('否定对照(关系型串行):把一行的值搬到另一行 → 逐行元组集报红', ()=>{
		// 构造两行同构表,现行输出;再人工把 shadbala 两星总力对调 → 全局多重集不变,但逐行元组集应变。
		const swapped = JSON.parse(JSON.stringify(FIXTURE));
		swapped.jyotish.shadbala.planets[0].totalRupa = 5.2; // 木星←水星值
		swapped.jyotish.shadbala.planets[1].totalRupa = 7.5; // 水星←木星值
		const curSwap = current(swapped);
		const KEY = 'Shadbala 六力';
		// 对调后全局多重集相同(7.50/5.20 都还在)。
		expect(factBag(curSwap[KEY])).toEqual(factBag(baseOut[KEY]));
		// 但逐行元组集不同(木星现在配 5.20、水星配 7.50)→ 证明 factRows 抓得住串行。
		expect(factRows(curSwap[KEY])).not.toEqual(factRows(baseOut[KEY]));
	});

	it('基线夹具确为改前散文实现（防夹具被误替换成表化版）', ()=>{
		const s = baseOut['卡拉卡（8 Chara Karakas）'].join('\n');
		expect(s).toMatch(/：/); // 散文用全角冒号
		expect(s).not.toMatch(/\| --- \|/); // 无 GFM 分隔行
	});
});
