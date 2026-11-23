// 奇门盘面附加层的独立对拍:暗干「时干加值使·按天盘干序转」、寄干 / 天禽落宫、翻宫链、转宫。
// 这里不调引擎里的任何助手,只按各自的定义另写一遍(直接读盘上九宫的天盘干 / 地盘干 / 星 / 门),
// 在 2026 全年逐日十二个时辰的真盘上与引擎的结果逐宫比 —— 两份实现互不相干,对得上才算数。
import { computeQimenScanPan, buildQimenScanSeeds } from '../../../divination/zeri/qimenScanEngine';
import { JIGONG_MODE_OPTIONS } from '../calc/options';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const BASE = { paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1, kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false, timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1 };
const SEEDS = buildQimenScanSeeds(2026, 2026, '+08:00');

// 盘面格子编号:1 巽 · 2 离 · 3 坤 · 4 震 · 5 中 · 6 兑 · 7 艮 · 8 坎 · 9 乾
const RING = [8, 7, 4, 1, 2, 3, 6, 9];   // 坎 艮 震 巽 离 坤 兑 乾:顺时针一圈
const KUN = 3;
const OPPOSITE = { 8: 2, 2: 8, 7: 3, 3: 7, 4: 6, 6: 4, 1: 9, 9: 1 };
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const JIAZI = Array.from({ length: 60 }, (_, i)=>`${GAN[i % 10]}${ZHI[i % 12]}`);
const XUN_YI = { 甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸' };
const xunHead = (gz)=>{ const i = JIAZI.indexOf(gz); return JIAZI[i - (i % 10)]; };
const ZHI_PALACE = { 子: 8, 丑: 7, 寅: 7, 卯: 4, 辰: 1, 巳: 1, 午: 2, 未: 3, 申: 3, 酉: 6, 戌: 9, 亥: 9 };
const HOME_STAR = { 8: '蓬', 7: '任', 4: '冲', 1: '辅', 2: '英', 3: '芮禽内', 6: '柱', 9: '心' };
const HOME_DOOR = { 8: '休', 7: '生', 4: '伤', 1: '杜', 2: '景', 3: '死', 6: '惊', 9: '开' };
// 先天八卦位(写成后天宫的格子编号):坎→兑 离→震 乾→离 坤→坎 震→艮 巽→坤 艮→乾 兑→巽
const XIANTIAN = { 8: 6, 2: 4, 9: 2, 3: 8, 4: 7, 1: 3, 7: 9, 6: 1 };

const DATES = [];
for(let m = 1; m <= 12; m++){
	const days = new Date(2026, m, 0).getDate();
	for(let d = 1; d <= days; d++){ DATES.push(`2026-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`); }
}
const TIMES = Array.from({ length: 12 }, (_, i)=>`${`${i * 2}`.padStart(2, '0')}:30:00`);
const eachPan = (opts, fn)=>{
	let n = 0;
	DATES.forEach((date)=>TIMES.forEach((time)=>{
		const pan = computeQimenScanPan(GEO, { ...BASE, ...opts }, SEEDS, date, time);
		const by = {};
		pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
		fn(pan, by, `${date} ${time}`);
		n += 1;
	}));
	return n;
};
// 天盘寄宫 = 从坤宫出发的那颗星(天芮,带着天禽)现在落的宫 = 天盘干等于坤宫地盘干的那一宫
const tianJiOf = (by)=>RING.find((n)=>by[n].tianGan === by[KUN].diGan);
// 中宫寄宫各档(取自选项表;缺省寄坤)
const JI_MODES = JIGONG_MODE_OPTIONS.map((o)=>o.value).filter((v)=>v !== 'kun');

describe('天盘干随星走:全年真盘', ()=>{
	// 转盘的天盘干由九星带着各自本宫的地盘干走:每一宫的天盘干 = 临在该宫那颗星的本宫地盘干(天禽寄坤,随天芮)。
	const STAR_HOME = { 蓬: 8, 任: 7, 冲: 4, 辅: 1, 英: 2, 芮: 3, 内: 3, 禽: 3, 柱: 6, 心: 9 };
	it('逐宫成立;值符星本宫就是寄宫、时干又落中五宫时整盘不动(天盘干 = 地盘干)', ()=>{
		const seen = { centre: 0, stationary: 0 };
		eachPan({}, (pan, by, at)=>{
			RING.forEach((n)=>expect([at, n, by[n].tianGan]).toEqual([at, n, by[STAR_HOME[`${by[n].tianXing}`.charAt(0)]].diGan]));
			if(pan.zhiFuPalace === 5){
				seen.centre += 1;
				if(RING.every((n)=>STAR_HOME[`${by[n].tianXing}`.charAt(0)] === n)){
					seen.stationary += 1;
					RING.forEach((n)=>expect([at, n, by[n].tianGan]).toEqual([at, n, by[n].diGan]));
				}
			}
		});
		expect(seen.centre).toBeGreaterThan(300);
		expect(seen.stationary).toBeGreaterThanOrEqual(40);
	});
	it('2026-01-12 酉时(阳遁八局,丁酉时,值符天芮,时干丁在中五):星、门、天盘干都在本宫', ()=>{
		const pan = computeQimenScanPan(GEO, { ...BASE }, SEEDS, '2026-01-12', '18:30:00');
		const by = {};
		pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
		expect([pan.juText, pan.ganzhi.time, pan.zhiFu]).toEqual(['阳遁八局中元', '丁酉', '天内']);
		expect(RING.map((n)=>by[n].tianXing).join('')).toBe('蓬任冲辅英内柱心');
		expect(RING.map((n)=>by[n].door).join('')).toBe('休生伤杜景死惊开');
		expect(RING.map((n)=>by[n].tianGan).join('')).toBe(RING.map((n)=>by[n].diGan).join(''));
		expect(RING.map((n)=>by[n].tianGan).join('')).toBe('庚戊壬癸己辛乙丙');
	});
	it('中宫寄宫换成别的档(寄艮 / 随遁 / 按季 / 按八节):同样逐宫成立,值符是天禽的时辰由寄宫之星代它领盘', ()=>{
		// 寄宫决定中五宫的干寄在哪、值符入中时落哪一宫;九星的本宫不变。
		// 旬首遁仪就在中五宫(值符天禽)时,天禽没有宫可出发,由本宫是寄宫的那颗星代它领盘:九星层、值符名、天盘干是同一颗星。
		const STAR_NAME = { 蓬: '天蓬', 任: '天任', 冲: '天冲', 辅: '天辅', 英: '天英', 内: '天内', 柱: '天柱', 心: '天心' };
		const leads = {};
		JI_MODES.forEach((mode)=>{
			let n = 0;
			let qin = 0;
			DATES.filter((_, i)=>i % 5 === 0).forEach((date)=>TIMES.forEach((time)=>{
				const pan = computeQimenScanPan(GEO, { ...BASE, jiGongMode: mode, showJiGan: true, showTianQin: true }, SEEDS, date, time);
				const by = {};
				pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
				n += 1;
				RING.forEach((p)=>expect([mode, date, time, p, by[p].tianGan]).toEqual([mode, date, time, p, by[STAR_HOME[`${by[p].tianXing}`.charAt(0)]].diGan]));
				// 地盘寄干所在的宫就是这一刻的寄宫;天禽与天盘寄干落在「本宫是寄宫的那颗星」现在所在的宫
				const ji = RING.filter((p)=>by[p].jiDiGan);
				expect([mode, date, time, ji.length]).toEqual([mode, date, time, 1]);
				const carrier = RING.filter((p)=>STAR_HOME[`${by[p].tianXing}`.charAt(0)] === ji[0]);
				expect([mode, date, time, carrier.length]).toEqual([mode, date, time, 1]);
				expect([mode, date, time, RING.filter((p)=>by[p].tianQin)]).toEqual([mode, date, time, carrier]);
				expect([mode, date, time, RING.filter((p)=>by[p].jiTianGan)]).toEqual([mode, date, time, carrier]);
				if(XUN_YI[xunHead(pan.ganzhi.time)] !== by[5].diGan){ return; }
				qin += 1;
				// 值符天禽:值符名 = 代它领盘的那颗星;那颗星落在值符所在的宫(时干落中五宫时落寄宫)
				const leadStar = `${by[carrier[0]].tianXing}`.charAt(0);
				expect([mode, date, time, pan.zhiFu]).toEqual([mode, date, time, STAR_NAME[leadStar]]);
				expect([mode, date, time, carrier[0]]).toEqual([mode, date, time, pan.zhiFuPalace === 5 ? ji[0] : pan.zhiFuPalace]);
				leads[leadStar] = (leads[leadStar] || 0) + 1;
			}));
			expect(n).toBe(73 * 12);
			expect(qin).toBeGreaterThan(80);
		});
		// 代天禽的星各档都出现过:坤宫那一位(内)之外,至少还有艮任 / 巽辅 / 乾心(四维),八节档另有四正
		expect(Object.keys(leads).sort()).toEqual(['任', '内', '冲', '心', '柱', '英', '蓬', '辅'].sort());
	});
	it('2026-01-01 子时(阳遁四局,丙子时,甲戌旬遁己在中五 → 值符天禽):寄艮时由天任领盘,寄坤时由天内领盘,两档都是星干同步', ()=>{
		const at = (mode)=>{
			const pan = computeQimenScanPan(GEO, { ...BASE, jiGongMode: mode }, SEEDS, '2026-01-01', '00:30:00');
			const by = {};
			pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
			return { pan, by };
		};
		const kun = at('kun');
		const gen = at('yang_gen_yin_kun');
		expect([kun.pan.juText.slice(0, 4), kun.pan.ganzhi.time, kun.by[5].diGan]).toEqual(['阳遁四局', '丙子', '己']);
		expect([kun.pan.zhiFu, gen.pan.zhiFu]).toEqual(['天内', '天任']);
		[kun, gen].forEach(({ by })=>RING.forEach((p)=>expect(by[p].tianGan).toBe(by[STAR_HOME[`${by[p].tianXing}`.charAt(0)]].diGan)));
		// 时干丙在坤宫:寄坤 = 坤宫之星(内)原地不动;寄艮 = 艮宫之星(任)带着艮宫的干转到坤宫
		expect(RING.map((p)=>kun.by[p].tianXing).join('')).toBe('蓬任冲辅英内柱心');
		expect(gen.by[KUN].tianXing).toBe('任');
		expect(gen.by[KUN].tianGan).toBe(gen.by[7].diGan);
	});
	it('移星换宫后重定值符:值符是天禽时,值符标记落在代它领盘的那颗星所在的宫,值符名就是那颗星', ()=>{
		const STAR_NAME = { 蓬: '天蓬', 任: '天任', 冲: '天冲', 辅: '天辅', 英: '天英', 内: '天内', 柱: '天柱', 心: '天心' };
		['kun', ...JI_MODES].forEach((mode)=>{
			let qin = 0;
			DATES.filter((_, i)=>i % 7 === 0).forEach((date)=>TIMES.forEach((time)=>{
				const pan = computeQimenScanPan(GEO, { ...BASE, jiGongMode: mode, shiftPalace: 2, shiftZhiFuMode: 'recalc' }, SEEDS, date, time);
				const by = {};
				pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
				if(XUN_YI[xunHead(pan.ganzhi.time)] !== by[5].diGan){ return; }
				qin += 1;
				expect([mode, date, time, pan.zhiFuPalace === 5]).toEqual([mode, date, time, false]);
				expect([mode, date, time, STAR_NAME[`${by[pan.zhiFuPalace].tianXing}`.charAt(0)]]).toEqual([mode, date, time, pan.zhiFu]);
				if(mode === 'kun'){ expect([date, time, pan.zhiFu]).toEqual([date, time, '天内']); }
			}));
			expect(qin).toBeGreaterThan(50);
		});
	});
	it('随遁寄宫的两个方向与各自配套的借门:阳艮阴坤配「阳生阴死」,阳坤阴艮配「阳死阴生」;值符不是天禽时借门档不起作用', ()=>{
		const PAIRS = [
			{ jiGongMode: 'yang_gen_yin_kun', zhiShiType: 1, yang: [7, '生门', '天任'], yin: [KUN, '死门', '天内'] },
			{ jiGongMode: 'yang_kun_yin_gen', zhiShiType: 3, yang: [KUN, '死门', '天内'], yin: [7, '生门', '天任'] },
		];
		PAIRS.forEach((pair)=>{
			const seen = { 阳: 0, 阴: 0 };
			DATES.filter((_, i)=>i % 4 === 0).forEach((date)=>TIMES.forEach((time)=>{
				const opts = { ...BASE, jiGongMode: pair.jiGongMode, zhiShiType: pair.zhiShiType, showJiGan: true };
				const pan = computeQimenScanPan(GEO, opts, SEEDS, date, time);
				const by = {};
				pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
				const yy = pan.juText.charAt(0);
				const want = yy === '阳' ? pair.yang : pair.yin;
				// 地盘寄干所在的宫 = 这一刻的寄宫
				expect([pair.jiGongMode, date, time, RING.filter((p)=>by[p].jiDiGan)]).toEqual([pair.jiGongMode, date, time, [want[0]]]);
				if(XUN_YI[xunHead(pan.ganzhi.time)] !== by[5].diGan){
					// 值符不是天禽:借门档不起作用,与缺省借门档整盘相同
					const base = computeQimenScanPan(GEO, { ...opts, zhiShiType: 0 }, SEEDS, date, time);
					expect([date, time, pan.zhiShi, pan.cells.map((c)=>c.door).join('')]).toEqual([date, time, base.zhiShi, base.cells.map((c)=>c.door).join('')]);
					return;
				}
				seen[yy] += 1;
				// 值符天禽:借的门是寄宫的本门,代它领盘的星是寄宫的本星 —— 门与星成对
				expect([pair.jiGongMode, date, time, pan.zhiShi, pan.zhiFu]).toEqual([pair.jiGongMode, date, time, want[1], want[2]]);
			}));
			expect(seen.阳).toBeGreaterThan(30);
			expect(seen.阴).toBeGreaterThan(30);
		});
	});
});

describe('暗干「时干加值使·按天盘干序转」:全年真盘独立对拍', ()=>{
	it('各宫暗干 = 天盘干圈(寄宫连寄干)整圈转到「时干落值使宫」', ()=>{
		const seen = { jia: 0, fuyin: 0, centerStem: 0 };
		const total = eachPan({ anGanMode: 'tianpan_zhuan' }, (pan, by, at)=>{
			const tianJi = tianJiOf(by);
			const stems = (n)=>`${by[n].tianGan}${n === tianJi ? by[5].diGan : ''}`;
			let target = pan.ganzhi.time.charAt(0);
			if(target === '甲'){ target = XUN_YI[xunHead(pan.ganzhi.time)]; seen.jia += 1; }
			if(target === by[5].diGan){ seen.centerStem += 1; }
			const from = RING.findIndex((n)=>stems(n).indexOf(target) >= 0);
			const to = RING.indexOf(pan.zhiShiPalace === 5 ? KUN : pan.zhiShiPalace);
			expect([at, from >= 0, to >= 0]).toEqual([at, true, true]);
			if(from === to){ seen.fuyin += 1; }
			const want = {};
			const got = {};
			for(let k = 0; k < 8; k++){
				want[RING[(to + k) % 8]] = stems(RING[(from + k) % 8]);
				got[RING[k]] = by[RING[k]].anGan;
			}
			expect({ at, ...got }).toEqual({ at, ...want });
			expect(by[pan.zhiShiPalace === 5 ? KUN : pan.zhiShiPalace].anGan).toContain(target);   // 时干落在值使宫
		});
		expect(total).toBe(DATES.length * 12);
		// 样本里三种特殊情形都出现过:甲时(取旬首遁仪)、时干正是中五宫寄出去的那个干、时干本就在值使宫(暗干 = 天盘原样)
		expect(seen.jia).toBeGreaterThan(300);
		expect(seen.centerStem).toBeGreaterThan(300);
		expect(seen.fuyin).toBeGreaterThan(100);
	});
	it('例盘(阴遁三局,辛亥时,值使生门落坎):辛 → 己丙 → 癸 → 丁 → 庚 → 壬 → 戊 → 乙', ()=>{
		const pan = computeQimenScanPan(GEO, { ...BASE, anGanMode: 'tianpan_zhuan' }, SEEDS, '2026-06-27', '21:30:00');
		const by = {};
		pan.cells.forEach((c)=>{ by[c.palaceNum] = c; });
		expect([pan.juText, pan.ganzhi.time, pan.zhiShi, pan.zhiShiPalace]).toEqual(['阴遁三局中元', '辛亥', '生门', 8]);
		expect(RING.map((n)=>by[n].tianGan).join('')).toBe('己癸丁庚壬戊乙辛');   // 天盘:坎己(寄丙)艮癸 震丁 巽庚 离壬 坤戊 兑乙 乾辛
		expect(RING.map((n)=>by[n].anGan)).toEqual(['辛', '己丙', '癸', '丁', '庚', '壬', '戊', '乙']);
	});
});

describe('寄干 / 天禽落宫:全年真盘独立对拍', ()=>{
	it('地盘寄在坤宫;天盘寄干与天禽落在「从坤宫出发的那颗星」所在的宫,别的宫没有', ()=>{
		eachPan({ showJiGan: true, showTianQin: true }, (pan, by, at)=>{
			const star = RING.filter((n)=>'芮禽内'.indexOf(`${by[n].tianXing}`.charAt(0)) >= 0);
			expect([at, star.length]).toEqual([at, 1]);
			expect([at, tianJiOf(by)]).toEqual([at, star[0]]);   // 两种找法(按星 / 按天盘干)落在同一宫
			RING.forEach((n)=>{
				expect([at, n, by[n].jiDiGan || '']).toEqual([at, n, n === KUN ? by[5].diGan : '']);
				expect([at, n, by[n].jiTianGan || '']).toEqual([at, n, n === star[0] ? by[5].diGan : '']);
				expect([at, n, !!by[n].tianQin]).toEqual([at, n, n === star[0]]);
			});
		});
	});
	it('不开开关 = 盘上没有这三个键', ()=>{
		const pan = computeQimenScanPan(GEO, { ...BASE }, SEEDS, '2026-06-27', '21:30:00');
		pan.cells.forEach((c)=>{
			expect(c.jiDiGan).toBeUndefined();
			expect(c.jiTianGan).toBeUndefined();
			expect(c.tianQin).toBeUndefined();
		});
	});
});

describe('翻宫:全年真盘独立对拍', ()=>{
	// 上翻(往过去):本宫天盘干 → 地盘上同干的宫;下翻(往将来):本宫地盘干 → 天盘上同干的宫;各最多三步,回到走过的宫即止。
	// 寄出去的中五宫干算所寄之宫的第二个干(可被找到,但不从它起步)。
	const walk = (by, start, fromKey, toKey, extraAt, extra)=>{
		const steps = [];
		const seen = new Set([start]);
		let cur = start;
		for(let i = 0; i < 3; i++){
			const gan = by[cur][fromKey];
			const next = RING.find((n)=>by[n][toKey] === gan || (n === extraAt && extra === gan));
			if(!gan || !next || seen.has(next)){ break; }
			steps.push({ num: next, gan });
			seen.add(next);
			cur = next;
		}
		return steps;
	};
	it('用神宫 = 天盘时干所在宫;上翻 / 下翻链逐步相同;天地盘同干时翻宫无效', ()=>{
		const seen = { fuyin: 0, full: 0 };
		eachPan({ tuiYanView: 'fan' }, (pan, by, at)=>{
			let target = pan.ganzhi.time.charAt(0);
			if(target === '甲'){ target = XUN_YI[xunHead(pan.ganzhi.time)]; }
			const tianJi = tianJiOf(by);
			const start = RING.find((n)=>by[n].tianGan === target) || (by[5].diGan === target ? tianJi : 0);
			const t = pan.tuiYan;
			expect([at, t.start]).toEqual([at, start]);
			const fuyin = by[start].tianGan === by[start].diGan;
			expect([at, t.fan.fuyin]).toEqual([at, fuyin]);
			if(fuyin){
				seen.fuyin += 1;
				expect([at, t.fan.up, t.fan.down]).toEqual([at, [], []]);
				return;
			}
			const up = walk(by, start, 'tianGan', 'diGan', KUN, by[5].diGan);
			const down = walk(by, start, 'diGan', 'tianGan', tianJi, by[5].diGan);
			expect({ at, up: t.fan.up, down: t.fan.down }).toEqual({ at, up, down });
			if(up.length === 3 && down.length === 3){ seen.full += 1; }
			// 盘上的标记与链一致
			const tags = {};
			const add = (n, tag)=>{ (tags[n] = tags[n] || []).push(tag); };
			add(start, '用');
			up.forEach((st, i)=>add(st.num, `上${i + 1}`));
			down.forEach((st, i)=>add(st.num, `下${i + 1}`));
			RING.forEach((n)=>expect([at, n, by[n].tuiYanTags || []]).toEqual([at, n, tags[n] || []]));
		});
		expect(seen.fuyin).toBeGreaterThan(100);
		expect(seen.full).toBeGreaterThan(1000);
	});
});

describe('转宫:全年真盘独立对拍', ()=>{
	it('空亡宫转对冲宫;星门全在本宫(大伏吟)时转先天八卦位', ()=>{
		const seen = { daFuyin: 0, startKong: 0 };
		eachPan({ tuiYanView: 'zhuan' }, (pan, by, at)=>{
			const z = pan.tuiYan.zhuan;
			const kong = Array.from(new Set(`${pan.kongWang}`.split('').map((b)=>ZHI_PALACE[b]))).sort();
			expect([at, z.kong.map((k)=>k.from).sort()]).toEqual([at, kong]);
			z.kong.forEach((k)=>expect([at, k.from, k.to]).toEqual([at, k.from, OPPOSITE[k.from]]));
			expect([at, z.startKong]).toEqual([at, kong.indexOf(pan.tuiYan.start) >= 0]);
			if(z.startKong){ seen.startKong += 1; }
			const daFuyin = RING.every((n)=>HOME_STAR[n].indexOf(`${by[n].tianXing}`.charAt(0)) >= 0 && HOME_DOOR[n] === `${by[n].door}`.charAt(0));
			expect([at, z.daFuyin]).toEqual([at, daFuyin]);
			if(daFuyin){
				seen.daFuyin += 1;
				expect([at, z.startXianTian]).toEqual([at, XIANTIAN[pan.tuiYan.start]]);
				const byFrom = (rows)=>rows.slice().sort((x, y)=>x[0] - y[0]);
				expect(byFrom(z.xianTian.map((x)=>[x.from, x.to]))).toEqual(byFrom(RING.map((n)=>[n, XIANTIAN[n]])));
				// 大伏吟 = 天盘干与地盘干也逐宫相同
				RING.forEach((n)=>expect([at, n, by[n].tianGan]).toEqual([at, n, by[n].diGan]));
			}else{
				expect([at, z.xianTian, z.startXianTian]).toEqual([at, [], 0]);
			}
		});
		expect(seen.daFuyin).toBeGreaterThan(100);
		expect(seen.startKong).toBeGreaterThan(100);
	});
});
