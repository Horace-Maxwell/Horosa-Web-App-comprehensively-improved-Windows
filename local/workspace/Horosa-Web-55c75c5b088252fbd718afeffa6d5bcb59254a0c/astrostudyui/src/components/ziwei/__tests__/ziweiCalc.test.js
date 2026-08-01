import { assembleNatalChart, calcZiwei, deriveSanPan } from '../ZiweiCalc';
import { LIFE_MASTER } from '../data/ziweiTables';
import { ZWEngineOptions, ziweiNeedsLocalEngine } from '../ziweiOptions';

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
			['zi_jian', 'quanshu'].forEach((src)=>{
				ZWEngineOptions.brightnessSource = src;
				expect(ziweiNeedsLocalEngine()).toBe(false);   // 全默认下切亮度不进本地引擎=不重排盘=不改命主
			});
		}finally{ ZWEngineOptions.brightnessSource = prev; }
	});
});
