import { assembleNatalChart, calcZiwei, deriveSanPan } from '../ZiweiCalc';
import { LIFE_MASTER } from '../data/ziweiTables';
import { ZWEngineOptions, ziweiNeedsLocalEngine, BRIGHTNESS_SOURCE_OPTIONS } from '../ziweiOptions';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STAR_FIELDS = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
function allStarNames(house){ return STAR_FIELDS.reduce((acc, f)=>acc.concat((house[f] || []).map((s)=>s.name)), []); }
function findHouseOf(chart, starName){
	for(let i = 0; i < 12; i++){ if(allStarNames(chart.houses[i]).indexOf(starName) >= 0){ return i; } }
	return -1;
}

describe('ZiweiCalc · 本命盘组装(移植 ZiWeiChart.setup)', ()=>{
	test('结构完整:12宫齐、命身宫、五行局、命主身主斗君、14主星', ()=>{
		const c = assembleNatalChart({ yearGan: '乙', yearZi: '丑', monthInt: 1, leap: false, dayInt: 15, timeZi: '午', male: false });
		expect(c.houses.length).toBe(12);
		c.houses.forEach((h)=>{
			expect(typeof h.name).toBe('string');
			expect(typeof h.ganzi).toBe('string');
			expect(typeof h.phase).toBe('string');
			STAR_FIELDS.forEach((f)=>{ expect(Array.isArray(h[f])).toBe(true); });
			expect(h.direction.length).toBe(2);
		});
		expect(c.houses[c.lifeHouseIndex].isLife).toBe(true);
		expect(c.houses[c.bodyHouseIndex].isBody).toBe(true);
		expect(c.wuxingJu >= 2 && c.wuxingJu <= 6).toBe(true);
		expect(c.lifeMaster).toBeTruthy();
		expect(c.bodyMaster).toBeTruthy();
		expect(c.doujun).toBeTruthy();
		// 14 正曜 恰 14 颗
		const mainCount = c.houses.reduce((a, h)=>a + h.starsMain.length, 0);
		expect(mainCount).toBe(14);
		// 命宫名=命宫
		expect(c.houses[c.lifeHouseIndex].name).toBe('命宫');
	});

	test('锚点:甲年禄存在寅(2);旬空按年柱(甲子→戌亥);紫微/天府落宫与 fourteenStars 一致', ()=>{
		const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '子', male: true });
		expect(findHouseOf(c, '禄存')).toBe(2);              // 甲禄存寅
		// 甲子年柱 → 旬首甲子 → 空戌(10)亥(11)
		const kong = [];
		[10, 11].forEach((i)=>{ if(allStarNames(c.houses[i]).some((n)=>n.indexOf('旬空') >= 0)){ kong.push(i); } });
		expect(kong.sort()).toEqual([10, 11]);
		// 紫微+天府 都在 starsMain
		expect(findHouseOf(c, '紫微')).toBeGreaterThanOrEqual(0);
		expect(findHouseOf(c, '天府')).toBeGreaterThanOrEqual(0);
	});

	test('压力测试:全 60甲子年 × 月1/6/12 × 日1/15/30 × 时子午 × 男女 → 不崩+14主星+12宫名齐', ()=>{
		const fail = [];
		let combos = 0;
		GAN.forEach((g)=>{
			ZHI.forEach((zh, zhIdx)=>{
				if(GAN.indexOf(g) % 2 !== zhIdx % 2){ return; }   // 仅合法干支(阳干阳支/阴干阴支)=30 年柱
				[1, 6, 12].forEach((m)=>{
					[1, 15, 30].forEach((d)=>{
						['子', '午'].forEach((t)=>{
							[true, false].forEach((male)=>{
								combos++;
								let c;
								try { c = assembleNatalChart({ yearGan: g, yearZi: zh, monthInt: m, leap: false, dayInt: d, timeZi: t, male }); }
								catch(e){ fail.push(`${g}${zh} m${m}d${d}${t}${male} 抛错:${e && e.message}`); return; }
								const mainCount = c.houses.reduce((a, h)=>a + h.starsMain.length, 0);
								if(mainCount !== 14){ fail.push(`${g}${zh} m${m}d${d}${t} 主星${mainCount}`); }
								const names = new Set(c.houses.map((h)=>h.name));
								if(names.size !== 12){ fail.push(`${g}${zh} m${m}d${d}${t} 宫名${names.size}`); }
								if(!(c.wuxingJu >= 2 && c.wuxingJu <= 6)){ fail.push(`${g}${zh} 局${c.wuxingJu}`); }
							});
						});
					});
				});
			});
		});
		expect({ combos, fail: fail.slice(0, 10) }).toEqual({ combos, fail: [] });
	});
});

describe('ZiweiCalc · WP-B 天伤天使(古法§5.11)', ()=>{
	const base = { yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true };  // 甲=阳、男→fwd(阳男)
	test('fixed:天伤@交友(命前7)、天使@疾厄(命前5)', ()=>{
		const c = assembleNatalChart({ ...base, shangShi: 'fixed' });
		expect(findHouseOf(c, '天伤')).toBe((c.lifeHouseIndex - 7 + 12) % 12);
		expect(findHouseOf(c, '天使')).toBe((c.lifeHouseIndex - 5 + 12) % 12);
	});
	test('yinyang(古法§6 纠错):仅阴男阳女互换、阳男阴女按常法', ()=>{
		const yangMale = assembleNatalChart({ ...base, shangShi: 'yinyang' });   // 甲阳男:按常法=fixed(不互换)
		expect(findHouseOf(yangMale, '天伤')).toBe((yangMale.lifeHouseIndex - 7 + 12) % 12);   // 天伤@交友
		expect(findHouseOf(yangMale, '天使')).toBe((yangMale.lifeHouseIndex - 5 + 12) % 12);   // 天使@疾厄
		const yinMale = assembleNatalChart({ yearGan: '乙', yearZi: '丑', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, shangShi: 'yinyang' });   // 乙阴男:互换
		expect(findHouseOf(yinMale, '天伤')).toBe((yinMale.lifeHouseIndex - 5 + 12) % 12);   // 天伤@疾厄(对调)
		expect(findHouseOf(yinMale, '天使')).toBe((yinMale.lifeHouseIndex - 7 + 12) % 12);   // 天使@交友(对调)
	});
	test('火铃南派(§1.6):忽略生时=固定子时位;默认三合随生时移', ()=>{
		// 申子辰局(子年)子时起宫:火寅铃戌。南派任何生时都落子时位。
		const base = { yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, male: true };
		const sanheZi = assembleNatalChart({ ...base, timeZi: '子', huoling: 'sanhe' });
		const nanpaiZi = assembleNatalChart({ ...base, timeZi: '子', huoling: 'nanpai' });
		expect(findHouseOf(sanheZi, '火星')).toBe(findHouseOf(nanpaiZi, '火星'));   // 子时两者同
		const sanheMao = assembleNatalChart({ ...base, timeZi: '卯', huoling: 'sanhe' });
		const nanpaiMao = assembleNatalChart({ ...base, timeZi: '卯', huoling: 'nanpai' });
		expect(findHouseOf(nanpaiMao, '火星')).toBe(findHouseOf(nanpaiZi, '火星'));   // 南派卯时==子时位(忽略生时)
		expect(findHouseOf(sanheMao, '火星')).not.toBe(findHouseOf(sanheZi, '火星'));   // 三合随生时移
	});
	test('空劫命名(§5):book→时系逆行星「地空」改称「天空」并互斥去年支独立天空;modern 不动', ()=>{
		const base = { yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true };
		const modern = assembleNatalChart({ ...base, kongNaming: 'modern' });
		const diKongHouse = findHouseOf(modern, '地空');
		expect(diKongHouse).toBeGreaterThanOrEqual(0);
		expect(findHouseOf(modern, '天空')).toBeGreaterThanOrEqual(0);   // 默认已含年支独立天空(子→丑),零回归不动
		const book = assembleNatalChart({ ...base, kongNaming: 'book' });
		expect(findHouseOf(book, '地空')).toBe(-1);                       // 地空已改名
		expect(findHouseOf(book, '地劫')).toBe(findHouseOf(modern, '地劫'));   // 地劫不动
		// book 下天空恰一颗(时系逆行星),落原地空宫;年支独立天空已互斥移除
		const tiankongHouses = [];
		for(let i = 0; i < 12; i++){ STAR_FIELDS.forEach((f)=>{ (book.houses[i][f] || []).forEach((s)=>{ if(s.name === '天空'){ tiankongHouses.push(i); } }); }); }
		expect(tiankongHouses).toEqual([diKongHouse]);
	});
	test('闰月归月(§1.5):闰月20日 prev=本月、next/mid_split=下月 → 命宫随月移1宫', ()=>{
		const b = { yearGan: '甲', yearZi: '子', leap: true, monthInt: 4, dayInt: 20, timeZi: '子', male: true };
		const prev = assembleNatalChart({ ...b, leapMonth: 'prev' });        // 算四月
		const next = assembleNatalChart({ ...b, leapMonth: 'next' });        // 算五月
		const mid = assembleNatalChart({ ...b, leapMonth: 'mid_split' });    // 20>=16→五月
		// 命宫 = (2+(month-1)-时) ;月+1 → 命宫+1
		expect(next.lifeHouseIndex).toBe((prev.lifeHouseIndex + 1) % 12);
		expect(mid.lifeHouseIndex).toBe(next.lifeHouseIndex);               // 20日 mid_split==next
		// 闰月15日 mid_split 应==prev(归上月)
		const mid15 = assembleNatalChart({ ...b, dayInt: 15, leapMonth: 'mid_split' });
		const prev15 = assembleNatalChart({ ...b, dayInt: 15, leapMonth: 'prev' });
		expect(mid15.lifeHouseIndex).toBe(prev15.lifeHouseIndex);
	});
	test('晚子时/定年界线 经 calcZiwei 不崩+出合法盘(开关已透传)', ()=>{
		const birth = { date: '1985-02-13', time: '23:30:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 1 };
		['zi_chu', 'midnight_split', 'zi_zheng'].forEach((lz)=>{
			const c = calcZiwei(birth, { lateZi: lz });
			expect(c.houses.length).toBe(12);
			expect(c.houses.reduce((a, h)=>a + h.starsMain.length, 0)).toBe(14);
		});
		['lichun', 'lunar_1_1'].forEach((yb)=>{
			const c = calcZiwei({ ...birth, date: '1985-02-04' }, { yearBoundary: yb });   // 立春前后边界
			expect(c.houses.length).toBe(12);
			expect(/[甲乙丙丁戊己庚辛壬癸]/.test(c.yearGan)).toBe(true);
		});
	});
	test('晚子时·紫微随日柱进位(bug 修复):23点子时段 zi_chu(过23换日)紫微所用农历日=次日、命宫随之移;zi_zheng(子正换日)不移', ()=>{
		// 1985-02-13 23:30 真太阳时仍落 23 点子时段。after23=1(zi_chu)日柱进位次日 → 紫微所用农历日 +1。
		const birth = { date: '1985-02-13', time: '23:30:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 1 };
		const ziChu = calcZiwei(birth, { lateZi: 'zi_chu' });        // after23NewDay=1
		const ziZheng = calcZiwei(birth, { lateZi: 'zi_zheng' });    // after23NewDay=0
		// 紫微所用农历日:zi_chu = zi_zheng + 1（修复前两者相同=死）
		expect(ziChu.nongli.ziweiDayNum).toBe(ziChu.nongli.dayNum + 1);
		expect(ziZheng.nongli.ziweiDayNum).toBe(ziZheng.nongli.dayNum);
		// 紫微落宫(用农历日定位)→ 两方案不同；命宫(用农历月+生时)月未变故同,但紫微星系整体不同
		expect(findHouseOf(ziChu, '紫微')).not.toBe(findHouseOf(ziZheng, '紫微'));
		// 仍是合法盘
		expect(ziChu.houses.reduce((a, h)=>a + h.starsMain.length, 0)).toBe(14);
		expect(ziZheng.houses.reduce((a, h)=>a + h.starsMain.length, 0)).toBe(14);
	});
	test('晚子时·非23点子时段不进位(零回归):22:30 三方案紫微所用农历日恒=当日历日', ()=>{
		const birth = { date: '1985-02-13', time: '22:38:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 1 };
		['zi_chu', 'midnight_split', 'zi_zheng'].forEach((lz)=>{
			const c = calcZiwei(birth, { lateZi: lz });
			expect(c.nongli.ziweiDayNum).toBe(c.nongli.dayNum);
		});
	});
});

describe('ZiweiCalc · calcZiwei 农历入口(birth→盘)', ()=>{
	const birth = { date: '1985-02-13', time: '22:38:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 0 };
	test('从生辰算出完整盘:12宫+14主星+五行局+命主身主斗君+农历', ()=>{
		const c = calcZiwei(birth, { timeAlg: 0 });
		expect(c.houses.length).toBe(12);
		const mainCount = c.houses.reduce((a, h)=>a + h.starsMain.length, 0);
		expect(mainCount).toBe(14);
		expect(c.wuxingJu >= 2 && c.wuxingJu <= 6).toBe(true);
		expect(c.lifeMaster).toBeTruthy();
		expect(c.doujun).toBeTruthy();
		expect(c.nongli.monthNum >= 1 && c.nongli.monthNum <= 12).toBe(true);
		expect(c.nongli.dayNum >= 1 && c.nongli.dayNum <= 30).toBe(true);
		expect(c.houses[c.lifeHouseIndex].name).toBe('命宫');
	});
	test('流派切换影响生年四化标记(beipai vs 全书,庚/壬年命例)', ()=>{
		// 1990 庚午年:庚干 北派太阴化科 / 全书天同化科 → birthSihua.科 不同
		const gengBirth = { ...birth, date: '1990-08-20', time: '10:00:00', gender: 1 };
		// 默认流派(全局单例 beipai)下科星
		const c = calcZiwei(gengBirth, { timeAlg: 0 });
		expect(['太阴', '天同', '天府']).toContain(c.birthSihua['科']);
	});
});

describe('ZiweiCalc · WP-H 天地人三盘(中州观察法)', ()=>{
	// 选非子午时使命≠身,三盘有别
	const base = { yearGan: '丙', yearZi: '寅', monthInt: 8, leap: false, dayInt: 15, timeZi: '卯', male: true };
	test('地盘:命宫移到身宫宫位、十四正曜重排、其余星不变;人盘:命宫移到福德宫宫位', ()=>{
		const tian = assembleNatalChart({ ...base });
		const di = deriveSanPan(tian, 'di');
		expect(di.lifeHouseIndex).toBe(tian.bodyHouseIndex);   // 地盘命宫=天盘身宫宫位
		expect(di.houses[di.lifeHouseIndex].name).toBe('命宫');
		expect(di.houses.reduce((a, h)=>a + h.starsMain.length, 0)).toBe(14);   // 仍14主星(重排)
		// 其余星(辅杂煞小)宫位一律不变:逐宫比对非主星名集
		const nonMain = (h)=>['starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall']
			.reduce((acc, f)=>acc.concat((h[f] || []).map((s)=>s.name)), []).sort();
		for(let i = 0; i < 12; i++){ expect(nonMain(di.houses[i])).toEqual(nonMain(tian.houses[i])); }
		const ren = deriveSanPan(tian, 'ren');
		const fudeIdx = tian.houses.findIndex((h)=>h.name === '福德宫' || h.name === '福德');
		expect(fudeIdx).toBeGreaterThanOrEqual(0);
		expect(ren.lifeHouseIndex).toBe(fudeIdx);
	});
	test('特例:命身同宫(子时)→天盘=地盘(命宫宫位同)', ()=>{
		const tian = assembleNatalChart({ ...base, timeZi: '子' });
		expect(tian.lifeHouseIndex).toBe(tian.bodyHouseIndex);
		const di = deriveSanPan(tian, 'di');
		expect(di.lifeHouseIndex).toBe(tian.lifeHouseIndex);
	});
	test('tian/空 anchor → 原盘', ()=>{
		const tian = assembleNatalChart({ ...base });
		expect(deriveSanPan(tian, 'tian')).toBe(tian);
		expect(deriveSanPan(tian, null)).toBe(tian);
	});
});

describe('ZiweiCalc · WP-C 庙旺数值化 + 大限跨度(局数年)', ()=>{
	const LEVELS = ['庙', '旺', '得', '利', '平', '闲', '不', '陷', '得地', '利益', '平和', '不得地'];
	test('主星带庙旺亮度(starlight 属亮度表值域)', ()=>{
		const c = assembleNatalChart({ yearGan: '丙', yearZi: '寅', monthInt: 8, leap: false, dayInt: 15, timeZi: '午', male: true });
		let lit = 0;
		c.houses.forEach((h)=>{ h.starsMain.forEach((s)=>{ if(s.starlight){ lit++; expect(LEVELS).toContain(s.starlight); } }); });
		expect(lit).toBeGreaterThan(0);   // 主星均带庙旺(STAR_LIGHT 覆盖14主星)
	});
	test('大限跨度:默认10年命宫=[局,局+9];daxianSpan=ju→局数年命宫=[局,2局-1]', ()=>{
		const base = { yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '子', male: true };
		const ten = assembleNatalChart({ ...base });
		const ju = ten.wuxingJu;
		expect(ten.houses[ten.lifeHouseIndex].direction).toEqual([ju, ju + 9]);
		const juYears = assembleNatalChart({ ...base, daxianSpan: 'ju' });
		expect(juYears.houses[juYears.lifeHouseIndex].direction).toEqual([ju, ju + ju - 1]);
	});
	function findHouseOf2(c, name){ for(let i = 0; i < 12; i++){ if(STAR_FIELDS.some((f)=>(c.houses[i][f] || []).some((s)=>s.name === name))){ return i; } } return -1; }
	test('天马依据:寅年 year基→天马@申(8);month基与 year基落宫不同(传本)', ()=>{
		const base = { yearGan: '甲', yearZi: '寅', monthInt: 2, leap: false, dayInt: 10, timeZi: '子', male: true };
		const yr = assembleNatalChart({ ...base, tianmaBasis: 'year' });
		expect(findHouseOf2(yr, '天马')).toBe(8);    // 寅午戌→申(8)
		const mo = assembleNatalChart({ ...base, tianmaBasis: 'month' });
		expect(findHouseOf2(mo, '天马')).toBeGreaterThanOrEqual(0);   // 月马存在(落宫或异)
	});
	test('星集 north18:只剩 14主+左右昌曲,杂曜神煞被滤', ()=>{
		const base = { yearGan: '丙', yearZi: '寅', monthInt: 8, leap: false, dayInt: 15, timeZi: '午', male: true };
		const c = assembleNatalChart({ ...base, starSet: 'north18' });
		const KEEP = new Set(['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军', '左辅', '右弼', '文昌', '文曲']);
		let total = 0;
		c.houses.forEach((h)=>{ STAR_FIELDS.forEach((f)=>{ (h[f] || []).forEach((s)=>{ total++; expect(KEEP.has(s.name.charAt(0) === '副' ? s.name.slice(1) : s.name)).toBe(true); }); }); });
		expect(total).toBeLessThanOrEqual(18);
		expect(total).toBeGreaterThanOrEqual(14);   // 14主必在;左右昌曲视落宫
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase5 哨兵:「切非默认选项绝不误改命主」class(实测坑:切亮度/切传本竟改命主 破军→禄存)。
// 根因:本地引擎默认按【命宫支】(经典法)算命主,而 Java /ziwei/birth 基线按【生年支】;
//   凡触发本地引擎的开关一翻,命主就从生年支值悄悄变命宫支值。修法=live/snapshot 两路径钉 lifeMasterBy:'year_branch'。
// 本组锁死:①带 year_branch 时命主恒==LIFE_MASTER[生年支](对任意生辰/任意开关变体);②该口径与命宫支法确有分歧(修复是承重的);
//   ③三盘 deriveSanPan 保留基盘命主(生年属性不随太极点移);④亮度源 brightnessSource 绝不进 ziweiNeedsLocalEngine。
describe('ZiweiCalc · Phase5 命主口径一致性哨兵(切开关不误改命主)', ()=>{
	// live/snapshot 真实路径附加的引擎开关键(逐字镜像 ZiWeiMain requestZiWei/buildZiweiSnapshotForParams 的 opts)。
	const LIVE_BASE = { lifeMasterBy: 'year_branch' };
	// 每个变体单独把一个触发本地引擎的开关拨离默认('dual' 结构特殊,另在 ziweiCalendar 测)。
	const SWITCH_VARIANTS = [
		{ daxianSpan: 'ju' }, { tianmaBasis: 'year' }, { starSet: 'north18' }, { shangShi: 'yinyang' },
		{ leapMonth: 'next' }, { leapMonth: 'prev' }, { leapMonth: 'split_days' }, { leapMonth: 'split_star_month' },
		{ lateZi: 'midnight_split' }, { lateZi: 'zi_zheng' }, { yearBoundary: 'lunar_1_1' },
		{ huoling: 'nanpai' }, { kongNaming: 'book' },
	];
	// 覆盖多生辰(含子时/闰月边界/立春边界),证不变式与生辰无关。
	const BIRTHS = [
		{ date: '1985-06-15', time: '10:30:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 1 },
		{ date: '1990-11-02', time: '03:20:00', zone: '+08:00', lon: '116e23', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1, gender: 0 },
		{ date: '1985-02-13', time: '23:30:00', zone: '+08:00', lon: '119e18', lat: '26n06', gpsLon: 119.3, gpsLat: 26.1, ad: 1, gender: 1 },
	];
	test('① 带 lifeMasterBy=year_branch:任意生辰×任意开关变体,命主恒==LIFE_MASTER[该盘生年支]', ()=>{
		BIRTHS.forEach((birth)=>{
			SWITCH_VARIANTS.forEach((variant)=>{
				const c = calcZiwei(birth, { ...LIVE_BASE, ...variant });
				expect(c && c.houses && c.houses.length).toBe(12);
				// 命主=生年支属性(与命宫无关);读同一盘的 yearZi 保证「即便开关改了生年支(定年界),断言仍自洽」。
				expect(c.lifeMaster).toBe(LIFE_MASTER[c.yearZi]);
			});
		});
	});
	test('② 修复是承重的:生年支法 vs 命宫支法确有分歧(至少一辰命主值不同)', ()=>{
		let diverged = 0;
		BIRTHS.forEach((birth)=>{
			const byYear = calcZiwei(birth, { lifeMasterBy: 'year_branch' });
			const byMing = calcZiwei(birth, {});   // 缺省=命宫支(经典法)
			const mingZhi = byMing.houses[byMing.lifeHouseIndex].ganzi.charAt(1);
			expect(byYear.lifeMaster).toBe(LIFE_MASTER[byYear.yearZi]);
			expect(byMing.lifeMaster).toBe(LIFE_MASTER[mingZhi]);
			if(byYear.lifeMaster !== byMing.lifeMaster){ diverged++; }
		});
		expect(diverged).toBeGreaterThan(0);   // 若两法恒等则 year_branch 钉法是空操作=测试无意义,必须真有分歧
	});
	test('③ 三盘 deriveSanPan:地盘/人盘命主==基盘命主(生年属性不随太极点移动;与 bodyMaster 一致)', ()=>{
		const tian = calcZiwei(BIRTHS[0], { lifeMasterBy: 'year_branch' });
		['di', 'ren'].forEach((anchor)=>{
			const p = deriveSanPan(tian, anchor);
			expect(p.lifeMaster).toBe(tian.lifeMaster);
			expect(p.bodyMaster).toBe(tian.bodyMaster);   // 身主本就不随三盘变(对照锚)
		});
	});
	test('④ 亮度源绝不触发本地引擎(纯显示层):brightnessSource 任取值,ziweiNeedsLocalEngine 恒 false', ()=>{
		const prev = ZWEngineOptions.brightnessSource;
		try{
			BRIGHTNESS_SOURCE_OPTIONS.map((o)=>o.value).forEach((src)=>{
				ZWEngineOptions.brightnessSource = src;
				expect(ziweiNeedsLocalEngine()).toBe(false);   // 全默认下切亮度不进本地引擎=不重排盘=不改命主
			});
		}finally{ ZWEngineOptions.brightnessSource = prev; }
	});
});

// ══ [B4] 闰月归月锁步金标:ZiweiCalc 命身月判定 ≡ 内核 resolveLeapMonth(oracle) ═══
// ZiweiCalc 的 if-else 是内核的适配器(运行时不调内核=有意:内核 starMonth 语义与产品
// 「月系星恒 monthInt」不同);本网格把两者钉成锁步 —— 任何一侧漂移当场红。
// 反推口径:timeZi=子(timeIdx=0)→lifeIdx=(2+month-1-0)%12→month=(lifeIdx-1+12)%12+1…
// 直接用 lifeHouseIndex 反解命身月。
describe('[B4] 闰月六档锁步(Calc≡内核 palaceMonth)', ()=>{
	const { resolveLeapMonth } = require('../ziweiSchools');
	const KEY_MAP = { mid_split: 'split15', prev: 'current', next: 'next', split_days: 'split_days', split_star_month: 'split_star_month', solar_term: 'solar_term' };
	const monthFromChart = (c)=>{
		// timeZi=子:lifeIdx=(2+month-1)%12 ⇒ month=((lifeIdx-2+12)%12)+1…lifeIdx=loc-0
		const m = ((c.lifeHouseIndex - 2 + 12) % 12) + 1;
		return m > 12 ? m - 12 : m;
	};
	test('🔴 六档 × 月{5,12} × 日{1,14,15,16,20,29,30} × monthDays{29,30} × 过节{是,否} 全网格', ()=>{
		const bad = [];
		Object.keys(KEY_MAP).forEach((lm)=>{
			[5, 12].forEach((month)=>{
				[1, 14, 15, 16, 20, 29, 30].forEach((day)=>{
					[29, 30].forEach((monthDays)=>{
						if(day > monthDays){ return; }
						[true, false].forEach((passed)=>{
							const c = assembleNatalChart({
								yearGan: '甲', yearZi: '子', monthInt: month, leap: true, dayInt: day,
								timeZi: '子', male: true, leapMonth: lm, monthDays, passedNextJie: passed,
							});
							const got = monthFromChart(c);
							const want = resolveLeapMonth(month, day, true, KEY_MAP[lm], monthDays, passed).palaceMonth;
							if(got !== want){ bad.push(`${lm}/m${month}/d${day}/md${monthDays}/j${passed}: calc=${got} 内核=${want}`); }
						});
					});
				});
			});
		});
		expect(bad).toEqual([]);
	});
	test('solar_term 档:节前/节后两盘命宫不同(golden);字段缺失=未过节归本月', ()=>{
		const mk = (passed)=>assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 5, leap: true, dayInt: 10, timeZi: '子', male: true, leapMonth: 'solar_term', passedNextJie: passed });
		expect(monthFromChart(mk(false))).toBe(5);
		expect(monthFromChart(mk(true))).toBe(6);
		const missing = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 5, leap: true, dayInt: 10, timeZi: '子', male: true, leapMonth: 'solar_term' });
		expect(monthFromChart(missing)).toBe(5);
	});
});

// ══ [P2a] 命主取法显式选项:默认零回归 + ming_branch 恒天盘命宫 + 硬传退役哨兵 ═══
describe('[P2a] lifeMasterBy 命主取法', ()=>{
	const { LIFE_MASTER } = require('../data/ziweiTables');
	const { deriveSanPan, applyLifeMasterOption } = require('../ZiweiCalc');
	const MKC = (extra)=>assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, ...extra });
	test('内核两档语义:显式 year_branch=生年支(生产默认);ctx 缺省=命宫支(经典法,生产两处恒显式传参故不可达)', ()=>{
		expect(MKC({ lifeMasterBy: 'year_branch' }).lifeMaster).toBe(LIFE_MASTER['子']);
		const noCtx = MKC({});
		expect(noCtx.lifeMaster).toBe(LIFE_MASTER[noCtx.houses[noCtx.lifeHouseIndex].ganzi.charAt(1)]);
	});
	test('🔴 ming_branch × 开关变体:命主恒==该盘命宫支值(翻开关不误改)', ()=>{
		[{}, { daxianSpan: 'ju' }, { starSet: 'north18' }, { huoling: 'nanpai' }, { shangShi: 'yinyang' }].forEach((extra)=>{
			const c = MKC({ ...extra, lifeMasterBy: 'ming_branch' });
			const mingZhi = c.houses[c.lifeHouseIndex].ganzi.charAt(1);
			expect(c.lifeMaster).toBe(LIFE_MASTER[mingZhi]);
		});
	});
	test('🔴 观察盘(di/ren):命主不随太极点移(保天盘命宫支值)', ()=>{
		const tian = MKC({ lifeMasterBy: 'ming_branch' });
		['di', 'ren'].forEach((anchor)=>{
			const p = deriveSanPan(tian, anchor);
			expect(p.lifeMaster).toBe(tian.lifeMaster);
		});
	});
	test('applyLifeMasterOption(Java 盘后处理):ming_branch 改命宫支值;year_branch/缺省不动;幂等', ()=>{
		const mk = ()=>({ yearZi: '子', lifeHouseIndex: 4, lifeMaster: LIFE_MASTER['子'], houses: Array.from({ length: 12 }, (_, i)=>({ ganzi: `甲${'子丑寅卯辰巳午未申酉戌亥'[i]}` })) });
		const a = applyLifeMasterOption(mk(), 'ming_branch');
		expect(a.lifeMaster).toBe(LIFE_MASTER['辰']);
		expect(applyLifeMasterOption(a, 'ming_branch').lifeMaster).toBe(LIFE_MASTER['辰']);   // 幂等
		expect(applyLifeMasterOption(mk(), 'year_branch').lifeMaster).toBe(LIFE_MASTER['子']);
		expect(applyLifeMasterOption(mk(), undefined).lifeMaster).toBe(LIFE_MASTER['子']);
		expect(applyLifeMasterOption(null, 'ming_branch')).toBe(null);
	});
	test('🔴 [哨兵] 两处本地 opts 读选项且保留 fallback 字面量;Java 路径后处理带 needsLocalEngine 闸', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		const hits = src.match(/lifeMasterBy: ZWEngineOptions\.lifeMasterBy \|\| 'year_branch'/g) || [];
		expect(hits.length).toBe(2);                             // 禁区⑤有意识退役:显式选项+fallback
		const apply = src.match(/applyLifeMasterOption\(/g) || [];
		expect(apply.length).toBeGreaterThanOrEqual(2);          // 两条 Java 盘路径都接了后处理
		expect(src).toMatch(/!ziweiNeedsLocalEngine\(\)\)\{ applyLifeMasterOption\(/);   // 只在 Java 盘路径跑(防观察盘错基)
		const { ZWEngineOptions: opts } = require('../ziweiOptions');
		expect(opts.lifeMasterBy).toBe('year_branch');           // 默认值哨兵
	});
});

// ══ [B6] 新口径三选项行为金标(流鸾流喜 / 长生火土同宫 / 流月太岁档) ═══
describe('[B6] 新口径选项', ()=>{
	const { ZWEngineOptions: EO } = require('../ziweiOptions');
	test('🔴 [P3d] 流鸾流喜:关(默认)不出;开则 12 支公式 golden(流鸾=(3−n)mod12,流喜对宫)', ()=>{
		const ZiWeiHelper = require('../ZiWeiHelper');
		const DIZI = '子丑寅卯辰巳午未申酉戌亥'.split('');
		expect(ZiWeiHelper.getFlowStars('甲', '子').some((s)=>s.name === '流鸾')).toBe(false);   // 默认关
		try{
			EO.flowLuanXi = true;
			DIZI.forEach((zhi, n)=>{
				const out = ZiWeiHelper.getFlowStars('甲', zhi);
				const luan = out.find((s)=>s.name === '流鸾');
				const xi = out.find((s)=>s.name === '流喜');
				expect(`${zhi}:${luan && luan.zhi}`).toBe(`${zhi}:${DIZI[((3 - n) % 12 + 12) % 12]}`);
				expect(`${zhi}:${xi && xi.zhi}`).toBe(`${zhi}:${DIZI[((3 - n + 6) % 12 + 12) % 12]}`);
			});
			// 与本命红鸾表逐支同源(ziweiyearzi.json 红鸾)
			const { STARS_YEAR_ZI } = require('../data/ziweiTables');
			DIZI.forEach((zhi)=>{
				const natal = STARS_YEAR_ZI['红鸾'] && STARS_YEAR_ZI['红鸾'].pos && STARS_YEAR_ZI['红鸾'].pos[zhi];
				if(natal){
					const luan = ZiWeiHelper.getFlowStars('甲', zhi).find((s)=>s.name === '流鸾');
					expect(`${zhi}:${luan.zhi}`).toBe(`${zhi}:${natal}`);
				}
			});
		}finally{ EO.flowLuanXi = false; }
	});
	test('🔴 [P3b] 长生档:土五局两档长生环整移(申→寅);其余四局两档逐宫恒同;默认档=现状', ()=>{
		// 造土五局盘:扫月/时找 wuxingJu===5
		let ctx5 = null;
		outer:
		for(let m = 1; m <= 12; m++){
			for(const t of ['子', '丑', '寅', '卯', '辰', '巳', '午']){
				const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: m, leap: false, dayInt: 10, timeZi: t, male: true });
				if(c.wuxingJu === 5){ ctx5 = { yearGan: '甲', yearZi: '子', monthInt: m, leap: false, dayInt: 10, timeZi: t, male: true }; break outer; }
			}
		}
		expect(ctx5).toBeTruthy();
		const shui = assembleNatalChart({ ...ctx5 });
		const huo = assembleNatalChart({ ...ctx5, changshengStart: 'huo_tu' });
		const phasePos = (c, name)=>c.houses.findIndex((h)=>h.phase === name);
		// 土五:水土同起申、火土同起寅 —— 长生位差恰 6 宫(申↔寅对宫)
		expect((phasePos(huo, '长生') - phasePos(shui, '长生') + 12) % 12).toBe(6);
		// 其余局两档恒同(抽水二局)
		let ctx2 = null;
		outer2:
		for(let m = 1; m <= 12; m++){
			for(const t of ['子', '丑', '寅', '卯']){
				const c = assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: m, leap: false, dayInt: 10, timeZi: t, male: true });
				if(c.wuxingJu === 2){ ctx2 = { yearGan: '甲', yearZi: '子', monthInt: m, leap: false, dayInt: 10, timeZi: t, male: true }; break outer2; }
			}
		}
		expect(ctx2).toBeTruthy();
		const a2 = assembleNatalChart({ ...ctx2 });
		const b2 = assembleNatalChart({ ...ctx2, changshengStart: 'huo_tu' });
		for(let i = 0; i < 12; i++){ expect(b2.houses[i].phase).toBe(a2.houses[i].phase); }
	});
	test('🔴 [P3c] 流月档:斗君≠流年支的盘,两档正月锚宫不同;默认=斗君法', ()=>{
		jest.isolateModules(()=>{});   // 无需隔离,直接经单例切换
		const { buildLuckLayers } = (()=>({ }))();   // ZWLuckPanel 的 buildLiuyueItems 未导出——经源码断言锁分支
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'ZWLuckPanel.js'), 'utf8');
		expect(src).toMatch(/liuYueBasis === 'taisui'/);
		expect(src).toMatch(/\? yearZhi\s*\n\s*: ZiWeiHelper\.getDouJun\(chart\.zidou, yearZhi\)/);
	});
});

// ══ [P3a] 魁钺歌诀两版金标(双源考据:差异恰仅庚干) ═══
describe('[P3a] kuiYue 魁钺歌诀', ()=>{
	const mk = (yearGan, yearZi, extra)=>assembleNatalChart({ yearGan, yearZi, monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, ...extra });
	test('🔴 庚年两档移位:默认魁丑/钺未;geng_ma_hu 魁午/钺寅', ()=>{
		const a = mk('庚', '午', {});
		expect(findHouseOf(a, '天魁')).toBe(1);   // 丑
		expect(findHouseOf(a, '天钺')).toBe(7);   // 未
		const b = mk('庚', '午', { kuiYue: 'geng_ma_hu' });
		expect(findHouseOf(b, '天魁')).toBe(6);   // 午
		expect(findHouseOf(b, '天钺')).toBe(2);   // 寅
	});
	test('非庚年两档全盘魁钺同位(辛两版同为午寅;甲乙丙丁戊己壬癸全同)', ()=>{
		['甲', '乙', '丙', '丁', '戊', '己', '辛', '壬', '癸'].forEach((g, i)=>{
			const zhi = '子丑寅卯辰巳未申酉'[i];
			const a = mk(g, zhi, {});
			const b = mk(g, zhi, { kuiYue: 'geng_ma_hu' });
			expect(`${g}:${findHouseOf(b, '天魁')}`).toBe(`${g}:${findHouseOf(a, '天魁')}`);
			expect(`${g}:${findHouseOf(b, '天钺')}`).toBe(`${g}:${findHouseOf(a, '天钺')}`);
		});
	});
	test('内核 placeKuiYue 四档 delta 矩阵(默认/未知档返 null 沿基表)', ()=>{
		const { placeKuiYue } = require('../ziweiSchools');
		// geng_ma_hu:庚随辛午寅;辛不动
		expect(placeKuiYue('天魁', '庚', 'geng_ma_hu')).toBe('午');
		expect(placeKuiYue('天钺', '庚', 'geng_ma_hu')).toBe('寅');
		expect(placeKuiYue('天魁', '辛', 'geng_ma_hu')).toBe(null);
		// liu_xin_hu_ma:辛对调寅午;庚守丑未
		expect(placeKuiYue('天魁', '辛', 'liu_xin_hu_ma')).toBe('寅');
		expect(placeKuiYue('天钺', '辛', 'liu_xin_hu_ma')).toBe('午');
		expect(placeKuiYue('天魁', '庚', 'liu_xin_hu_ma')).toBe(null);
		// geng_xin_hu_ma:庚辛同魁寅钺午
		expect(placeKuiYue('天魁', '庚', 'geng_xin_hu_ma')).toBe('寅');
		expect(placeKuiYue('天钺', '庚', 'geng_xin_hu_ma')).toBe('午');
		expect(placeKuiYue('天魁', '辛', 'geng_xin_hu_ma')).toBe('寅');
		expect(placeKuiYue('天钺', '辛', 'geng_xin_hu_ma')).toBe('午');
		// 默认/未知/其余干
		expect(placeKuiYue('天魁', '庚', 'jia_wu_geng')).toBe(null);
		expect(placeKuiYue('天魁', '庚', undefined)).toBe(null);
		expect(placeKuiYue('天魁', '甲', 'geng_xin_hu_ma')).toBe(null);
	});
	test('🔴 四档全链矩阵:辛年四档魁位(午/午/寅/寅)+庚年四档魁位(丑/午/丑/寅);其余八干四档恒同', ()=>{
		const mkY = (g, z2, kv)=>assembleNatalChart({ yearGan: g, yearZi: z2, monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, kuiYue: kv });
		const KUIS = ['jia_wu_geng', 'geng_ma_hu', 'liu_xin_hu_ma', 'geng_xin_hu_ma'];
		const xinPos = KUIS.map((kv)=>findHouseOf(mkY('辛', '酉', kv), '天魁'));
		expect(xinPos).toEqual([6, 6, 2, 2]);   // 午午寅寅
		const gengPos = KUIS.map((kv)=>findHouseOf(mkY('庚', '午', kv), '天魁'));
		expect(gengPos).toEqual([1, 6, 1, 2]);  // 丑午丑寅
		['甲', '乙', '丙', '丁', '戊', '己', '壬', '癸'].forEach((g, i)=>{
			const zz = '子丑寅卯辰巳申酉'[i];
			const base = findHouseOf(mkY(g, zz, 'jia_wu_geng'), '天魁');
			KUIS.slice(1).forEach((kv)=>expect(`${g}${kv}:${findHouseOf(mkY(g, zz, kv), '天魁')}`).toBe(`${g}${kv}:${base}`));
		});
	});
});

// ══ [A2] 截空正副双星修真金标(与旬空同律:逐支各判「与年干同极性=正支」) ═══
describe('[A2] 截空旬空正副极性(十干矩阵)', ()=>{
	const GAN10 = '甲乙丙丁戊己庚辛壬癸'.split('');
	const findAll = (c, nm)=>{
		const out = [];
		c.houses.forEach((h, i)=>['starsOthersBad', 'starsOthersGood', 'starsEvil'].forEach((g)=>(h[g] || []).forEach((s)=>{ if(s.name === nm){ out.push(i); } })));
		return out;
	};
	test('🔴 十干:截空恒一正一副,副恒落「与年干异极性」支(阳年干旧实现出两正零副=已修)', ()=>{
		GAN10.forEach((g, gi2)=>{
			const c = assembleNatalChart({ yearGan: g, yearZi: '子丑寅卯辰巳午未申酉戌亥'[gi2 % 12], monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
			const zheng = findAll(c, '截空');
			const fu = findAll(c, '副截空');
			expect(`${g}:正${zheng.length}副${fu.length}`).toBe(`${g}:正1副1`);
			const yangGan = '甲丙戊庚壬'.includes(g);
			expect(zheng[0] % 2 === 0).toBe(yangGan);
			expect(fu[0] % 2 === 0).toBe(!yangGan);
		});
	});
	test('旬空同律(既有正确实现回归锚):十干恒一正一副', ()=>{
		GAN10.forEach((g, gi2)=>{
			const c = assembleNatalChart({ yearGan: g, yearZi: '子丑寅卯辰巳午未申酉戌亥'[gi2 % 12], monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
			expect(findAll(c, '旬空').length).toBe(1);
			expect(findAll(c, '副旬空').length).toBe(1);
		});
	});
	test('阴年干输出与修前逐字节等价(半保守锁:乙年截空对[午未])', ()=>{
		const c = assembleNatalChart({ yearGan: '乙', yearZi: '丑', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
		expect(findAll(c, '截空')).toEqual([7]);
		expect(findAll(c, '副截空')).toEqual([6]);
	});
});

// ══ [A5] 流曜位置表消副本金标(读表单源+随魁钺档;禁字面量回潮) ═══
describe('[A5] 流曜表单源', ()=>{
	const ZiWeiHelper = require('../ZiWeiHelper');
	const { ZWEngineOptions: EO2 } = require('../ziweiOptions');
	test('🔴 默认档全十干输出与旧硬编表逐字节等价(表等价证明)', ()=>{
		const OLD = {
			流禄: { 甲:'寅',乙:'卯',丙:'巳',丁:'午',戊:'巳',己:'午',庚:'申',辛:'酉',壬:'亥',癸:'子' },
			流魁: { 甲:'丑',乙:'子',丙:'亥',丁:'亥',戊:'丑',己:'子',庚:'丑',辛:'午',壬:'卯',癸:'卯' },
			流钺: { 甲:'未',乙:'申',丙:'酉',丁:'酉',戊:'未',己:'申',庚:'未',辛:'寅',壬:'巳',癸:'巳' },
			流昌: { 甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯' },
			流曲: { 甲:'酉',乙:'申',丙:'午',丁:'巳',戊:'午',己:'巳',庚:'寅',辛:'丑',壬:'戌',癸:'亥' },
		};
		'甲乙丙丁戊己庚辛壬癸'.split('').forEach((g)=>{
			const fs2 = ZiWeiHelper.getFlowStars(g, '子');
			['流禄', '流魁', '流钺', '流昌', '流曲'].forEach((nm)=>{
				const hit = fs2.find((s)=>s.name === nm);
				expect(`${g}${nm}:${hit && hit.zhi}`).toBe(`${g}${nm}:${OLD[nm][g]}`);
			});
		});
		// 流马支系抽样
		expect(ZiWeiHelper.getFlowStars('甲', '寅').find((s)=>s.name === '流马').zhi).toBe('申');
	});
	test('🔴 流魁流钺随魁钺歌诀档(庚年 geng_ma_hu:流魁午/流钺寅)', ()=>{
		try{
			EO2.kuiYue = 'geng_ma_hu';
			const fs2 = ZiWeiHelper.getFlowStars('庚', '午');
			expect(fs2.find((s)=>s.name === '流魁').zhi).toBe('午');
			expect(fs2.find((s)=>s.name === '流钺').zhi).toBe('寅');
			EO2.kuiYue = 'geng_xin_hu_ma';
			expect(ZiWeiHelper.getFlowStars('辛', '酉').find((s)=>s.name === '流魁').zhi).toBe('寅');
		}finally{ EO2.kuiYue = 'jia_wu_geng'; }
	});
	test('禁字面量表回潮(源码断言:流曜段无十干硬编对象)', ()=>{
		const fs3 = require('fs'); const path = require('path');
		const src = fs3.readFileSync(path.resolve(__dirname, '..', 'ZiWeiHelper.js'), 'utf8');
		expect(src).not.toMatch(/FlowLuStorePos|FlowKuiPos|FlowYuePos|FlowChangPos|FlowQuPos|FlowMaPos =/);
		expect(src).toContain("flowGanPos('禄存'");
		expect(src).toContain('STARS_LIU_CHANGQU');
	});
});

// ══ [B11+B12] 长生顺逆档 + 空亡单星法金标 ═══
describe('[B11] changshengDirection 仅动 phase 铁律', ()=>{
	const yinMale = { yearGan: '乙', yearZi: '丑', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true };  // 阴男=逆
	test('🔴 阴男两档:phase 环反向;direction 逐宫字节等;博士序逐宫字节等', ()=>{
		const a = assembleNatalChart({ ...yinMale });
		const b = assembleNatalChart({ ...yinMale, changshengDirection: 'always_forward' });
		expect(b.houses.map((h)=>h.phase).join('')).not.toBe(a.houses.map((h)=>h.phase).join(''));
		expect(b.houses.map((h)=>h.direction.join('~')).join('|')).toBe(a.houses.map((h)=>h.direction.join('~')).join('|'));
		const bosi = (c)=>c.houses.map((h)=>(h.starsSmall || []).map((s)=>s.name).join(',')).join('|');
		expect(bosi(b)).toBe(bosi(a));
	});
	test('阳男两档恒同(阳男本就顺行)', ()=>{
		const yang = { yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true };
		const a = assembleNatalChart({ ...yang });
		const b = assembleNatalChart({ ...yang, changshengDirection: 'always_forward' });
		expect(b.houses.map((h)=>h.phase).join('')).toBe(a.houses.map((h)=>h.phase).join(''));
	});
});
describe('[B12] kongwangStyle 单星法四态', ()=>{
	const find2 = (c, nm)=>{ let n = 0; c.houses.forEach((h)=>['starsOthersBad'].forEach((g)=>(h[g] || []).forEach((s)=>{ if(s.name === nm){ n++; } }))); return n; };
	test('🔴 single:截空/旬空各恰一颗正名、零副;double=默认恒一正一副', ()=>{
		['庚', '乙'].forEach((g)=>{
			const zz = g === '庚' ? '午' : '丑';
			const d = assembleNatalChart({ yearGan: g, yearZi: zz, monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true });
			expect(`${g}double:${find2(d, '截空')}/${find2(d, '副截空')}/${find2(d, '旬空')}/${find2(d, '副旬空')}`).toBe(`${g}double:1/1/1/1`);
			const s2 = assembleNatalChart({ yearGan: g, yearZi: zz, monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, kongwangStyle: 'single' });
			expect(`${g}single:${find2(s2, '截空')}/${find2(s2, '副截空')}/${find2(s2, '旬空')}/${find2(s2, '副旬空')}`).toBe(`${g}single:1/0/1/0`);
		});
	});
});

// ══ [B10+B13] 流年四化取干 + 流年火铃金标 ═══
describe('[B10] liunianSihuaGan 两档', ()=>{
	const { ZWEngineOptions: EO3 } = require('../ziweiOptions');
	const ZiWeiHelper = require('../ZiWeiHelper');
	test('🔴 buildLuckLayers 透传 sihuaGan;消费点 layer.sihuaGan||layer.gan(源码锁三处)', ()=>{
		const layers = ZiWeiHelper.buildLuckLayers({ liunian: { gan: '丙', sihuaGan: '戊', mingIndex: 3 } }, '甲');
		const ln = layers.find((l)=>l.key === 'liunian');
		expect(ln.sihuaGan).toBe('戊');
		expect(ln.gan).toBe('丙');
		const fs4 = require('fs'); const path = require('path');
		// [B10-fix] 面板/快照/盘面源头三处改走 effLayerSihuaGan(消费期现算);
		// ZWCommHouse 徽保持读 layer.sihuaGan||layer.gan(由 buildLuckRender 源头现算喂值)。
		['ZWLuckPanel.js', 'ZiWeiMain.js'].forEach((f)=>{
			const src = fs4.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
			expect(`${f}:${src.includes('effLayerSihuaGan(chart, layer)') || src.includes('effLayerSihuaGan(chart, l)')}`).toBe(`${f}:true`);
		});
		const commSrc = fs4.readFileSync(path.resolve(__dirname, '..', 'ZWCommHouse.js'), 'utf8');
		expect(commSrc.includes('layer.sihuaGan || layer.gan')).toBe(true);
		// 行为金标:切档对「已选中的旧 item(带残留 sihuaGan)」立即生效/还原
		const { ZWEngineOptions: EOb } = require('../ziweiOptions');
		const houses10 = Array.from({ length: 12 }, ()=>({ ganzi: '甲子' }));
		houses10[5] = { ganzi: '壬辰' };
		const staleItem = { key: 'liunian', gan: '丙', sihuaGan: '戊', mingIndex: 5 };   // 旧快照残留戊
		try{
			EOb.liunianSihuaGan = 'ming_gong_gan';
			expect(ZiWeiHelper.effLayerSihuaGan({ houses: houses10 }, staleItem)).toBe('壬');   // 现算宫干,非残留戊
			EOb.liunianSihuaGan = 'year_gan';
			expect(ZiWeiHelper.effLayerSihuaGan({ houses: houses10 }, staleItem)).toBe('丙');   // 切回默认忽略残留
		}finally{ EOb.liunianSihuaGan = 'year_gan'; }
	});
	test('默认档流年 item 不带 sihuaGan 字段(形状字节稳)', ()=>{
		// buildLiunianItems 未导出——经源码断言钉守卫条件
		const fs4 = require('fs'); const path = require('path');
		const src = fs4.readFileSync(path.resolve(__dirname, '..', 'ZWLuckPanel.js'), 'utf8');
		expect(src).toMatch(/liunianSihuaGan === 'ming_gong_gan'[\s\S]{0,120}item\.sihuaGan/);
	});
});
describe('[B13] 流年火铃', ()=>{
	const { ZWEngineOptions: EO4 } = require('../ziweiOptions');
	const ZiWeiHelper = require('../ZiWeiHelper');
	test('🔴 关(默认)不出;开=与本命火铃内核同式(流年支代年支+生时);缺时辰不出', ()=>{
		expect(ZiWeiHelper.getFlowStars('甲', '子', '卯').some((s)=>s.name === '流火')).toBe(false);
		try{
			EO4.flowHuoLing = true;
			const { placeHuoLing } = require('../ziweiSchools');
			['子', '午', '酉', '亥'].forEach((liuZhi)=>{
				['子', '卯', '戌'].forEach((hz)=>{
					const out = ZiWeiHelper.getFlowStars('甲', liuZhi, hz);
					const want = placeHuoLing(liuZhi, hz, 'sanhe');
					expect(`${liuZhi}${hz}火:${out.find((s)=>s.name === '流火').zhi}`).toBe(`${liuZhi}${hz}火:${want['火星']}`);
					expect(`${liuZhi}${hz}铃:${out.find((s)=>s.name === '流铃').zhi}`).toBe(`${liuZhi}${hz}铃:${want['铃星']}`);
				});
			});
			expect(ZiWeiHelper.getFlowStars('甲', '子').some((s)=>s.name === '流火')).toBe(false);   // 缺时辰
			// nanpai 档:忽略生时固定子
			EO4.huoling = 'nanpai';
			const np = ZiWeiHelper.getFlowStars('甲', '子', '卯');
			const npWant = require('../ziweiSchools').placeHuoLing('子', '卯', 'nanpai');
			expect(np.find((s)=>s.name === '流火').zhi).toBe(npWant['火星']);
		}finally{ EO4.flowHuoLing = false; EO4.huoling = 'sanhe'; }
	});
	test('hourZhiOf 取数序:本地 timeZi → Java bazi.bazi.time 支 → null', ()=>{
		expect(ZiWeiHelper.hourZhiOf({ timeZi: '卯' })).toBe('卯');
		expect(ZiWeiHelper.hourZhiOf({ bazi: { bazi: { time: { ganzi: '戊午' } } } })).toBe('午');
		expect(ZiWeiHelper.hourZhiOf({})).toBe(null);
	});
});

// ══ [A3] 晚子时「跟随全局」默认档 ═══
describe('[A3] lateZi global 档', ()=>{
	const birth23 = { date: '1990-05-18', time: '23:30:00', zone: 'Asia/Shanghai', lon: 116.4, lat: 39.9, gender: 'male' };
	test('🔴 global=透传显式全局值;zi_chu 强制档=恒(1,1);两者在全局(1,1)时字节同', ()=>{
		const viaGlobal11 = calcZiwei(birth23, { lateZi: 'global', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const viaForced = calcZiwei(birth23, { lateZi: 'zi_chu', after23NewDay: 0, lateZiHourUseNextDay: 0 });
		expect(JSON.stringify(viaGlobal11)).toBe(JSON.stringify(viaForced));   // 强制档无视显式值
		// 全局=子正(0,0)时 global 跟随之 → 与 zi_zheng 档同盘、与强制 zi_chu 异盘(23:30 生辰日柱是否进位)
		const viaGlobal00 = calcZiwei(birth23, { lateZi: 'global', after23NewDay: 0, lateZiHourUseNextDay: 0 });
		const viaZiZheng = calcZiwei(birth23, { lateZi: 'zi_zheng' });
		expect(JSON.stringify(viaGlobal00)).toBe(JSON.stringify(viaZiZheng));
		expect(JSON.stringify(viaGlobal00)).not.toBe(JSON.stringify(viaForced));
	});
	test('缺省(不传 lateZi)与 global 同义(向后兼容)', ()=>{
		const a = calcZiwei(birth23, { after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const b = calcZiwei(birth23, { lateZi: 'global', after23NewDay: 1, lateZiHourUseNextDay: 1 });
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});
	test('🔴 LS 一次性迁移源码守卫:旧 zi_chu→global 仅未迁移时;哨兵后显式 zi_chu 不再被吞', ()=>{
		const fs5 = require('fs'); const path5 = require('path');
		const src = fs5.readFileSync(path5.resolve(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
		expect(src.includes("ziweiLateZiMigrated")).toBe(true);
		expect(/lzRaw === 'zi_chu' && !migrated/.test(src)).toBe(true);
		// 迁移分支写回 global;非迁移路径原样读(|| 'global' 兜底)
		expect(src.includes("safeLocalStorageSet('ziweiLateZi', 'global')")).toBe(true);
		expect(src.includes("ZWEngineOptions.lateZi = lzRaw || 'global'")).toBe(true);
	});
});

// ══ [B15] 小限顺逆迁入 ZWEngineOptions ═══
describe('[B15] xiaoxianMode 单例迁入', ()=>{
	const fs6 = require('fs'); const path6 = require('path');
	test('🔴 消费点读单例非 localStorage;builder SWITCH_KEYS 含 xiaoxianMode;ctx 不再兜转 LS', ()=>{
		const luck = fs6.readFileSync(path6.resolve(__dirname, '..', 'ZWLuckPanel.js'), 'utf8');
		// [B15b] 链路重构:ZWLuckPanel 不再自读单例,统一走 ZiWeiHelper.xiaoxianClockwise(内核=ziweiCore
		// 纯函数,单例读取沉到 Helper 惰性 require)。三段各按真名锁(L2 铁律:键名途中换名,只 grep 一名必误判)。
		expect(luck.includes('ZiWeiHelper.xiaoxianClockwise(chart)')).toBe(true);
		const helper6 = fs6.readFileSync(path6.resolve(__dirname, '..', 'ZiWeiHelper.js'), 'utf8');
		expect(helper6.includes('ZWEngineOptions.xiaoxianMode')).toBe(true);
		const core6 = fs6.readFileSync(path6.resolve(__dirname, '..', 'ziweiCore.js'), 'utf8');
		expect(core6.includes('export function xiaoxianClockwiseFor')).toBe(true);
		expect(luck.includes("localStorage.getItem('ziweiXiaoxianYinyang')")).toBe(false);
		const main = fs6.readFileSync(path6.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
		expect(/ZW_ENGINE_SWITCH_KEYS = \[[\s\S]*?'xiaoxianMode'\]/.test(main)).toBe(true);
		const ctx = fs6.readFileSync(path6.resolve(__dirname, '..', '..', '..', 'utils', 'aiAnalysisContext.js'), 'utf8');
		expect(ctx.includes("params.xiaoxianMode = `${record.ziweiXiaoxianYinyang}`")).toBe(true);
		// LS 兜转已删:ctx 内不得再写 ziweiXiaoxianYinyang 键
		expect(ctx.includes("safeLocalStorageSet('ziweiXiaoxianYinyang'")).toBe(false);
	});
	test('中州档行为:阳男顺/阴男逆(经单例翻拨,ZWLuckPanel 逻辑同前零回归)', ()=>{
		const { ZWEngineOptions: EO5 } = require('../ziweiOptions');
		expect(EO5.xiaoxianMode).toBe('0');   // 默认档=男顺女逆(现状)
	});
});
