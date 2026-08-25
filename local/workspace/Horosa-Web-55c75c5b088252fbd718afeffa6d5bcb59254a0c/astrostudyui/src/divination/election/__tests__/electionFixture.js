// 择日引擎 golden 固定盘 fixture。
// 手工构造、字段与 chartFacts.js 逐项对照的自洽 mock Result(非真实星历,值固定即可)。
// 用途:锚「默认路径输出逐字不变」——西方深化各 WP 落地前后,默认(现代主流)输出必须与 .snap 完全一致。
// ⚠️ 本文件是 golden 的一部分:改这里=改 golden,须走「重生成+人工核 diff 只有纯增」纪律。

function obj(id, lon, sign, signlon, house, patch){
	return {
		id, lon, sign, signlon, house,
		movedir: 'Direct', lonspeed: 0.5,
		aboveHorizon: false, isPeregrining: false, isVOC: false,
		selfDignity: [], dignities: {}, antisciaPoint: null,
		hayyiz: null, outOfBounds: false, oobDelta: null,
		phase: null, phasisEvent: null, joy: false, ofSect: true,
		mansion: null, degreeGender: null, feral: false,
		monomoiria: null, ninthPart: null, darijan: null,
		...(patch || {}),
	};
}

// 固定盘:2025-03-15 10:30 +08:00 北京 · 白羊 15° 上升(昼盘)。
// 故意踩中若干红线/吉象,让 golden 覆盖主要分支:
//   火星巨蟹落陷入 4 宫(角宫凶星无援)、水星双鱼逆行、月土三合入相(timing)、金木六合+映点。
export function buildMockResult(){
	const objects = [
		obj('Sun', 354.9, 'Pisces', 24.9, 'House12', { lonspeed: 0.99, aboveHorizon: true }),
		obj('Moon', 97.0, 'Cancer', 7.0, 'House4', { selfDignity: ['ruler'], lonspeed: 13.2 }),
		obj('Mercury', 340.0, 'Pisces', 10.0, 'House12', { selfDignity: ['exile', 'fall'], movedir: 'Retrograde', lonspeed: -0.8, aboveHorizon: true }),
		obj('Venus', 25.0, 'Aries', 25.0, 'House1', { selfDignity: ['exile'], lonspeed: 1.1 }),
		obj('Mars', 100.0, 'Cancer', 10.0, 'House4', { selfDignity: ['fall'], lonspeed: 0.55 }),
		obj('Jupiter', 65.0, 'Gemini', 5.0, 'House3', { selfDignity: ['exile'], lonspeed: 0.12 }),
		obj('Saturn', 335.5, 'Pisces', 5.5, 'House12', { lonspeed: 0.11, aboveHorizon: true }),
		obj('Uranus', 54.0, 'Taurus', 24.0, 'House2', { lonspeed: 0.05 }),
		obj('Neptune', 358.0, 'Pisces', 28.0, 'House12', { lonspeed: 0.03, aboveHorizon: true }),
		obj('Pluto', 302.0, 'Aquarius', 2.0, 'House11', { lonspeed: 0.02, aboveHorizon: true }),
		obj('North Node', 2.0, 'Aries', 2.0, 'House12', { lonspeed: -0.05, aboveHorizon: true }),
		obj('South Node', 182.0, 'Libra', 2.0, 'House6', { lonspeed: -0.05 }),
		obj('Pars Fortuna', 117.1, 'Cancer', 27.1, 'House4', { lonspeed: 0 }),
		obj('Asc', 15.0, 'Aries', 15.0, 'House1', { lonspeed: 0 }),
		obj('MC', 285.0, 'Capricorn', 15.0, 'House10', { lonspeed: 0 }),
		obj('Desc', 195.0, 'Libra', 15.0, 'House7', { lonspeed: 0 }),
		obj('IC', 105.0, 'Cancer', 15.0, 'House4', { lonspeed: 0 }),
	];

	const houseMap = {};
	const houseSigns = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
	const houseRulers = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
	const housePlanets = {
		1: ['Venus'], 2: ['Uranus'], 3: ['Jupiter'], 4: ['Moon', 'Mars', 'Pars Fortuna'],
		6: ['South Node'], 10: [], 11: ['Pluto'], 12: ['Sun', 'Mercury', 'Saturn', 'Neptune', 'North Node'],
	};
	for(let i = 1; i <= 12; i++){
		houseMap['House' + i] = {
			sign: houseSigns[i - 1], lon: 15.0 + (i - 1) * 30,
			ruler: houseRulers[i - 1], planets: housePlanets[i] || [],
		};
	}

	return {
		chart: {
			// [H1 形状迁移] 后端真形状:antiscias 在 chart 下且分 antiscia/cantiscia 双桶(旧顶层扁平=死链共犯形状)
			antiscias: { antiscia: [['Venus', 'Jupiter', 0.8]], cantiscia: [] },
			objects,
			isDiurnal: true,
			timerStar: 'Venus', dayerStar: 'Saturn',
			dayofweek: 6, nongli: null,
		},
		houseMap,
		params: { date: '2025-03-15', gpsLat: 39.9, gpsLon: 116.38 },
		aspects: {
			normalAsp: {
				Moon: {
					Applicative: [{ id: 'Saturn', asp: 120, orb: 1.5 }],
					Separative: [{ id: 'Mars', asp: 0, orb: 3.0 }],
					Exact: [], None: [], Obvious: [],
				},
				Venus: {
					Applicative: [{ id: 'Jupiter', asp: 60, orb: 2.0 }],
					Separative: [], Exact: [], None: [], Obvious: [],
				},
			},
		},
		receptions: {
			normal: [{ beneficiary: 'Moon', beneficiaryDignity: [], supplier: 'Saturn', supplierRulerShip: ['term'] }],
			abnormal: [],
		},
		mutuals: { normal: [], abnormal: [] },
		surround: {},
	};
}

export default buildMockResult;
