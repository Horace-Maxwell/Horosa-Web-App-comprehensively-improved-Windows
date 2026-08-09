import { PAIPAN_OPTIONS, QIJU_METHOD_OPTIONS, SCHOOL_OPTIONS, calcDunJia, isKinqimenMode, birthToYearGan, buildDunJiaSnapshotText, buildQimenWangShuai, computeShuziYongShenGong, normalizeKinqimenData, panFeipan } from '../DunJiaCalc';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';
import { buildLocalJieqiYearSeed } from '../../../utils/localNongliAdapter';

function makeFields(dateStr, timeStr){
	return {
		date: {
			value: {
				format: ()=>dateStr,
			},
		},
		time: {
			value: {
				format: ()=>timeStr,
			},
		},
		zone: { value: '+08:00' },
	};
}

function makeNongli(){
	return {
		yearJieqi: '丙午',
		year: '丙午',
		monthGanZi: '庚寅',
		dayGanZi: '壬戌',
		jieqi: '立春',
		jiedelta: '立春后第14天',
		birth: '2026-02-17 21:50:07',
		month: '正月',
		day: '初一',
		leap: false,
	};
}

function makeOptions(extra = {}){
	return {
		paiPanType: 3,
		qijuMethod: 'chaibu',
		zhiShiType: 0,
		yueJiaQiJuType: 1,
		kongMode: 'day',
		yimaMode: 'day',
		shiftPalace: 0,
		fengJu: false,
		...extra,
	};
}

function pickMap(mapObj){
	const out = {};
	[1, 2, 3, 4, 6, 7, 8, 9].forEach((key)=>{
		out[key] = mapObj[key];
	});
	return out;
}

function getGanzi(pillar){
	return (pillar && (pillar.ganzhi || pillar.ganZhi)) || '';
}

function buildLocalNongliForTest(date, time){
	const local = buildLocalBaziResult({
		date,
		time,
		zone: '+08:00',
		lon: '120e00',
		lat: '0n00',
		gpsLon: 120,
		gpsLat: 0,
		ad: 1,
		gender: 1,
		timeAlg: 1,
		after23NewDay: 0,
	});
	const bazi = local.bazi;
	const four = bazi.fourColumns;
	return {
		...bazi.nongli,
		bazi,
		yearGanZi: getGanzi(four.year),
		yearJieqi: getGanzi(four.year),
		monthGanZi: getGanzi(four.month),
		dayGanZi: getGanzi(four.day),
		time: getGanzi(four.time),
		timeGanZi: getGanzi(four.time),
	};
}

describe('DunJiaCalc options', ()=>{
	test('排盘体例:年/月/日/刻家(0/1/2/4)走本地全盘,时家(3)走 Ken 后端;综合(5)无确切算法未暴露', ()=>{
		expect(PAIPAN_OPTIONS.map((item)=>item.value)).toEqual([0, 1, 2, 3, 4, 6]);   // [H-F] 刻家(4)复活;[H-G] 金函系日家(6)=查表独立体系;综合(5)仍不暴露
		PAIPAN_OPTIONS.forEach((item)=>{
			// 年/月/日/刻家/金函日家走本地 calcDunJia;时家走 Ken 后端(转盘字节护栏)。
			expect(isKinqimenMode(item.value)).toBe(item.value === 3);
		});
		expect(isKinqimenMode(5)).toBe(true);   // 综合仍后端分支
	});

	test('paiPanType(年/月/日/时) produces different juText', ()=>{
		const fields = makeFields('2026-02-17', '21:50:07');
		const nongli = makeNongli();
		const juSet = new Set();
		[0, 1, 2, 3].forEach((paiPanType)=>{
			const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType }), {});
			juSet.add(pan.juText);
		});
		expect(juSet.size).toBeGreaterThan(1);
	});

	test('yueJiaQiJuType changes result under 月家奇门', ()=>{
		const fields = makeFields('2026-02-17', '21:50:07');
		const nongli = makeNongli();
		const panA = calcDunJia(fields, nongli, makeOptions({ paiPanType: 1, yueJiaQiJuType: 0 }), {});
		const panB = calcDunJia(fields, nongli, makeOptions({ paiPanType: 1, yueJiaQiJuType: 1 }), {});
		expect(panA.juText).not.toEqual(panB.juText);
	});

	test('zhiShiType changes 值使 when 值符 is 天内', ()=>{
		const nongli = makeNongli();
		let foundTime = null;
		for(let h=0; h<24; h++){
			const hh = `${h}`.padStart(2, '0');
			const fields = makeFields('2026-02-17', `${hh}:50:07`);
			const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 0 }), {});
			if(pan && pan.zhiFu === '天内'){
				foundTime = `${hh}:50:07`;
				break;
			}
		}
		if(!foundTime){
			// 部分历法/参数组合下未必会命中“芮禽”时刻，此时退化为稳定性校验：
			// 不要求值使变化，但要求不同 zhiShiType 不抛错且有可用结果。
			const fallbackFields = makeFields('2026-02-17', '21:50:07');
			const pan0 = calcDunJia(fallbackFields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 0 }), {});
			const pan1 = calcDunJia(fallbackFields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 1 }), {});
			const pan2 = calcDunJia(fallbackFields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 2 }), {});
			expect(pan0 && pan0.zhiShi).toBeTruthy();
			expect(pan1 && pan1.zhiShi).toBeTruthy();
			expect(pan2 && pan2.zhiShi).toBeTruthy();
			return;
		}
		const fields = makeFields('2026-02-17', foundTime);
		const pan0 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 0 }), {});
		const pan1 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 1 }), {});
		const pan2 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 2 }), {});
		const zhiShiSet = new Set([pan0.zhiShi, pan1.zhiShi, pan2.zhiShi]);
		expect(zhiShiSet.size).toBeGreaterThan(1);
		// 🔴 值使门「名」变了还不够 —— 八门在盘上的实际起排也必须跟着变。
		// 此前 panDoor 调 zhifuNZhishi 时漏传 ext,天禽值符时恒退 0 档(死门起排),
		// 于是标题的值使门名换了、盘面八门却一动不动,两者自相矛盾。
		const doorSig = (p)=>JSON.stringify((p.cells || []).map((c)=>(c && c.door) || ''));
		const doorSet = new Set([doorSig(pan0), doorSig(pan1), doorSig(pan2)]);
		expect(doorSet.size).toBeGreaterThan(1);
	});

	test('unsupported qijuMethod falls back to 拆补', ()=>{
		const fields = makeFields('2026-02-17', '21:50:07');
		const nongli = makeNongli();
		const panChaibu = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'chaibu' }), {});
		const panUnknown = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'feipan' }), {});
		expect(panUnknown.juText).toEqual(panChaibu.juText);
		expect(panUnknown.options.qijuMethodLabel).toEqual('拆补');
	});

	test('值符落中宫但非天禽时，不应套用天禽值使规则', ()=>{
		const fields = makeFields('2026-02-18', '18:17:13');
		const nongli = {
			yearJieqi: '丙午',
			year: '丙午',
			monthGanZi: '庚寅',
			dayGanZi: '癸亥',
			jieqi: '立春',
			jiedelta: '立春后第14天',
			birth: '2026-02-18 18:17:13',
			month: '正月',
			day: '初二',
			leap: false,
		};
		const pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'chaibu', zhiShiType: 0 }), {});
		expect(pan.zhiFu).toEqual('天柱');
		expect(pan.zhiShi).toEqual('惊门');
	});

	test('繁体节气（驚蟄）应与简体节气一致', ()=>{
		const fields = makeFields('2025-03-20', '10:10:00');
		const base = {
			yearJieqi: '乙巳',
			year: '乙巳',
			monthGanZi: '己卯',
			dayGanZi: '戊子',
			jiedelta: '',
			birth: '2025-03-20 10:10:00',
			month: '二月',
			day: '廿一',
			leap: false,
		};
		const panSimple = calcDunJia(fields, { ...base, jieqi: '惊蛰' }, makeOptions({ qijuMethod: 'chaibu' }), {});
		const panTrad = calcDunJia(fields, { ...base, jieqi: '驚蟄' }, makeOptions({ qijuMethod: 'chaibu' }), {});
		expect(panTrad.juText).toEqual(panSimple.juText);
		expect(panTrad.zhiShi).toEqual(panSimple.zhiShi);
	});

	test('天盘奇仪应随时干飞布，匹配旧版遁甲样本', ()=>{
		const fields = makeFields('1998-02-20', '20:48:00');
		const nongli = {
			yearJieqi: '戊寅',
			year: '戊寅',
			monthGanZi: '甲寅',
			dayGanZi: '戊戌',
			time: '壬戌',
			jieqi: '雨水',
			jiedelta: '雨水后第1天',
			birth: '1998-02-20 20:48:00',
			month: '正月',
			day: '廿四',
			leap: false,
		};
		const pan = calcDunJia(fields, nongli, makeOptions({
			qijuMethod: 'chaibu',
			timeAlg: 1,
		}), {});
		expect(pan.juText).toEqual('阳遁九局上元');
		expect(pickMap(pan.tianGan)).toEqual({
			1: '庚',
			2: '丙',
			3: '丁',
			4: '戊',
			6: '己',
			7: '壬',
			8: '辛',
			9: '乙',
		});
		expect(pickMap(pan.diPan)).toEqual({
			1: '壬',
			2: '戊',
			3: '庚',
			4: '辛',
			6: '丙',
			7: '乙',
			8: '己',
			9: '丁',
		});
		expect(pickMap(pan.renPan)).toEqual({
			1: '死',
			2: '惊',
			3: '开',
			4: '景',
			6: '休',
			7: '杜',
			8: '伤',
			9: '生',
		});
		expect(pickMap(pan.shenPan)).toEqual({
			1: '符',
			2: '蛇',
			3: '阴',
			4: '天',
			6: '合',
			7: '地',
			8: '玄',
			9: '虎',
		});
		expect(pan.zhiFu).toEqual('天内');
		expect(pan.zhiShi).toEqual('死门');
	});

	test('1994-01-17 甲寅时奇门盘拆补应对齐 Horosa APP 样本', ()=>{
		const fields = makeFields('1994-01-17', '04:59:00');
		const nongli = {
			yearJieqi: '癸酉',
			year: '癸酉',
			monthGanZi: '乙丑',
			dayGanZi: '癸卯',
			time: '甲寅',
			jieqi: '小寒',
			jiedelta: '小寒后第12天',
			birth: '1994-01-17 04:59:00',
			month: '腊月',
			day: '初六',
			leap: false,
		};
		const pan = calcDunJia(fields, nongli, makeOptions({
			qijuMethod: 'chaibu',
			timeAlg: 1,
		}), {});
		expect(pan.juText).toEqual('阳遁八局中元');
		expect(pan.zhiFu).toEqual('天辅');
		expect(pan.zhiShi).toEqual('杜门');
		expect(pan.kongWang).toEqual('辰巳');
		expect(pan.xunShou).toEqual('甲午');
		expect(pickMap(pan.tianGan)).toEqual({
			1: '癸',
			2: '己',
			3: '辛',
			4: '壬',
			6: '乙',
			7: '戊',
			8: '庚',
			9: '丙',
		});
		expect(pickMap(pan.diPan)).toEqual({
			1: '癸',
			2: '己',
			3: '辛',
			4: '壬',
			6: '乙',
			7: '戊',
			8: '庚',
			9: '丙',
		});
		expect(pickMap(pan.renPan)).toEqual({
			1: '杜',
			2: '景',
			3: '死',
			4: '伤',
			6: '惊',
			7: '生',
			8: '休',
			9: '开',
		});
		expect(pickMap(pan.shenPan)).toEqual({
			1: '符',
			2: '蛇',
			3: '阴',
			4: '天',
			6: '合',
			7: '地',
			8: '玄',
			9: '虎',
		});
		const stars = {};
		pan.cells.forEach((cell)=>{
			stars[cell.palaceNum] = cell.tianXing;
		});
		expect(pickMap(stars)).toEqual({
			1: '辅',
			2: '英',
			3: '内',
			4: '冲',
			6: '柱',
			7: '任',
			8: '蓬',
			9: '心',
		});
	});

	test('1994-01-17 甲寅时奇门盘置润应使用当前日柱定三元', ()=>{
		const fields = makeFields('1994-01-17', '04:59:00');
		const nongli = {
			yearJieqi: '癸酉',
			year: '癸酉',
			monthGanZi: '乙丑',
			dayGanZi: '癸卯',
			time: '甲寅',
			jieqi: '小寒',
			jiedelta: '小寒后第12天',
			birth: '1994-01-17 04:59:00',
			month: '腊月',
			day: '初六',
			leap: false,
		};
		const context = {
			jieqiYearSeeds: {
				1993: {
					大雪: { term: '大雪', time: '1993-12-07 23:30:00', dateKey: '19931207', dayGanzhi: '癸亥' },
				},
				1994: {
					芒种: { term: '芒种', time: '1994-06-06 00:00:00', dateKey: '19940606', dayGanzhi: '癸亥' },
					大雪: { term: '大雪', time: '1994-12-07 00:00:00', dateKey: '19941207', dayGanzhi: '丁卯' },
				},
			},
		};
		const pan = calcDunJia(fields, nongli, makeOptions({
			qijuMethod: 'zhirun',
			timeAlg: 1,
		}), context);
		expect(pan.juText).toEqual('阳遁八局中元');
		expect(pan.zhiFu).toEqual('天辅');
		expect(pan.zhiShi).toEqual('杜门');
		expect(pickMap(pan.tianGan)).toEqual({
			1: '癸',
			2: '己',
			3: '辛',
			4: '壬',
			6: '乙',
			7: '戊',
			8: '庚',
			9: '丙',
		});
		expect(pickMap(pan.shenPan)).toEqual({
			1: '符',
			2: '蛇',
			3: '阴',
			4: '天',
			6: '合',
			7: '地',
			8: '玄',
			9: '虎',
		});
	});

	test('本地节气 fallback 按准确交节时刻判断当前节气', ()=>{
		const beforeDaxue = buildLocalNongliForTest('2047-12-07', '13:10:00');
		const afterDaxue = buildLocalNongliForTest('2047-12-07', '13:12:00');
		expect(beforeDaxue.jieqi).toEqual('小雪');
		expect(afterDaxue.jieqi).toEqual('大雪');
	});

	test('默认晚子时不提前换日，拆补与手机版口径一致', ()=>{
		const fields = makeFields('1982-07-28', '23:48:00');
		const nongli = buildLocalNongliForTest('1982-07-28', '23:48:00');
		const defaultPan = calcDunJia(fields, nongli, makeOptions({
			qijuMethod: 'chaibu',
			timeAlg: 1,
		}), {});
		const ziZhengPan = calcDunJia(fields, nongli, makeOptions({
			qijuMethod: 'chaibu',
			timeAlg: 1,
			after23NewDay: 0,
		}), {});
		// 用户语义(拍板,见 DunJiaCalc:DAY_SWITCH_OPTIONS): after23NewDay=0「24点算第二天」=日柱进位次日。
		expect(defaultPan.options.daySwitchLabel).toEqual('24点算第二天');
		expect(defaultPan.juText).toEqual(ziZhengPan.juText);
		expect(defaultPan.ganzhi.day).toEqual(ziZhengPan.ganzhi.day);
		expect(defaultPan.ganzhi.time).toEqual(ziZhengPan.ganzhi.time);
		expect(pickMap(defaultPan.tianGan)).toEqual(pickMap(ziZhengPan.tianGan));
	});

	// 置闰超神接气:2015-12-22(超神距未达置闰阈值 dgap=8<9)→ 冬至阳遁七局中元(本引擎口径;用户确认正确,
	//   参考实现按 dgap≥8 闰大雪给阴七,以本引擎为准)。中宫值符(天内寄中)时天盘照常飞布,非伏吟。
	test('置闰超神接气:2015-12-22 冬至阳遁七局中元(dgap=8<9不置闰),中宫值符天盘飞布', ()=>{
		const fields = makeFields('2015-12-22', '11:42:00');
		const nongli = buildLocalNongliForTest('2015-12-22', '11:42:00');
		const context = {
			jieqiYearSeeds: {
				2014: buildLocalJieqiYearSeed(2014, '+08:00'),
				2015: buildLocalJieqiYearSeed(2015, '+08:00'),
			},
		};
		const pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'zhirun', timeAlg: 1 }), context);
		expect(pan.juText).toEqual('阳遁七局中元');
		expect(pan.zhiFu).toEqual('天内');
		expect(pickMap(pan.diPan)).toEqual({ 1: '丁', 2: '庚', 3: '壬', 4: '癸', 6: '戊', 7: '己', 8: '辛', 9: '乙' });
		expect(pickMap(pan.tianGan)).toEqual({ 1: '壬', 2: '戊', 3: '乙', 4: '庚', 6: '辛', 7: '丁', 8: '癸', 9: '己' });
	});
});

describe('DunJiaCalc · WP-C 茅山 / 无闰 定局法', ()=>{
	test('QIJU_METHOD_OPTIONS 含 茅山布局 / 无闰', ()=>{
		expect(QIJU_METHOD_OPTIONS.map((o)=>o.value)).toEqual(['zhirun', 'chaibu', 'maoshan', 'wurun', 'shuzi']);
	});

	test('茅山 / 无闰 在有交节种子时出有效盘且标注正确', ()=>{
		const fields = makeFields('2015-12-22', '11:42:00');
		const nongli = buildLocalNongliForTest('2015-12-22', '11:42:00');
		const context = {
			jieqiYearSeeds: {
				2014: buildLocalJieqiYearSeed(2014, '+08:00'),
				2015: buildLocalJieqiYearSeed(2015, '+08:00'),
			},
		};
		const panMaoshan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'maoshan', timeAlg: 1 }), context);
		const panWurun = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'wurun', timeAlg: 1 }), context);
		expect(panMaoshan.juText).toMatch(/[阳阴]遁[一二三四五六七八九]局(上元|中元|下元)/);
		expect(panWurun.juText).toMatch(/[阳阴]遁[一二三四五六七八九]局(上元|中元|下元)/);
		expect(panMaoshan.options.qijuMethodLabel).toEqual('茅山');
		expect(panWurun.options.qijuMethodLabel).toEqual('无闰');
	});

	test('茅山缺交节种子时安全退拆补（不抛错）', ()=>{
		const fields = makeFields('2026-02-17', '21:50:07');
		const nongli = makeNongli();
		const panMaoshan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, qijuMethod: 'maoshan' }), {});
		const panChaibu = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, qijuMethod: 'chaibu' }), {});
		// 无种子 → 茅山退拆补 → juText 与拆补一致
		expect(panMaoshan.juText).toEqual(panChaibu.juText);
	});
});

describe('DunJiaCalc · WP-A 飞盘排盘 + 九神', ()=>{
	function indexCells(pan){
		const byNum = {};
		(pan.cells || []).forEach((c)=>{ byNum[c.palaceNum] = c; });
		return byNum;
	}
	function starMap(pan){
		const out = {};
		(pan.cells || []).forEach((c)=>{ out[c.palaceNum] = c.tianXing; });
		return out;
	}
	// 公历 2026-05-15 00:12 → 丙午年 癸巳月 己丑日 甲子时,立夏下元,阳遁7局拆补(成盘样本)。
	const feiNongli = {
		yearJieqi: '丙午',
		year: '丙午',
		monthGanZi: '癸巳',
		dayGanZi: '己丑',
		time: '甲子',
		jieqi: '立夏',
		jiedelta: '立夏后第10天',
		birth: '2026-05-15 00:12:00',
		month: '三月',
		day: '廿九',
		leap: false,
	};

	test('飞盘九神含中宫九地·勾陈·太常·朱雀,不被替换为虎玄(对齐成盘样本)', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const pan = calcDunJia(fields, feiNongli, makeOptions({
			qijuMethod: 'chaibu',
			timeAlg: 1,
			school: '飞盘',
		}), {});
		expect(pan.juText).toEqual('阳遁七局下元');
		expect(pan.school).toEqual('飞盘');
		expect(pan.options.schoolLabel).toEqual('飞盘（飞宫）');
		// 飞九神:雀@巽1 阴@离2 勾@坤3 常@震4 地@中5 符@兑6 蛇@艮7 合@坎8 天@乾9
		expect(pickMap(pan.shenPan)).toEqual({
			1: '雀', 2: '阴', 3: '勾', 4: '常', 6: '符', 7: '蛇', 8: '合', 9: '天',
		});
		expect(pan.shenPan[5]).toEqual('地');   // 中宫照飞九地(转盘中宫无神)
		// cells.god 保真(buildCells 飞盘守卫不替换)
		const cells = indexCells(pan);
		expect(cells[5].god).toEqual('地');
		// 中宫 cell 须带 isFeipan 标记(驱动 renderCell 中宫走常规格、显九地/天禽);转盘 cell 反之
		expect(cells[5].isFeipan).toBe(true);
		expect(cells[5].isCenter).toBe(true);
		expect(cells[3].god).toEqual('勾');     // 转盘此处必为'虎'
		expect(cells[1].god).toEqual('雀');     // 转盘此处必为'玄'
		expect(cells[4].god).toEqual('常');     // 太常仅九神有,转盘八神无
		// 飞九星(天禽有本位,不替换为芮)
		expect(starMap(pan)).toEqual({
			1: '辅', 2: '英', 3: '芮', 4: '冲', 5: '禽', 6: '柱', 7: '任', 8: '蓬', 9: '心',
		});
		// 飞八门
		expect(pickMap(pan.renPan)).toEqual({
			1: '杜', 2: '景', 3: '死', 4: '伤', 6: '惊', 7: '生', 8: '休', 9: '开',
		});
		// 飞天盘干(dsky=0,随星归位)
		expect(pickMap(pan.tianGan)).toEqual({
			1: '丁', 2: '庚', 3: '壬', 4: '癸', 6: '戊', 7: '己', 8: '辛', 9: '乙',
		});
		expect(pan.zhiFu).toEqual('天柱');
		expect(pan.zhiShi).toEqual('惊门');
	});

	test('同一时刻 转盘 vs 飞盘:转盘无九神字、飞盘九神并存、地盘共用', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const zhuan = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '转盘' }), {});
		const fei = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '飞盘' }), {});
		const zhuanGods = Object.keys(zhuan.shenPan).map((k)=>zhuan.shenPan[k]).join('');
		expect(/[勾常雀]/.test(zhuanGods)).toBe(false);   // 转盘八神无 勾/常/雀
		expect(zhuan.school).toEqual('转盘');
		const feiGods = Object.keys(fei.shenPan).map((k)=>fei.shenPan[k]).join('');
		expect(/勾/.test(feiGods)).toBe(true);
		expect(/常/.test(feiGods)).toBe(true);
		expect(/雀/.test(feiGods)).toBe(true);
		expect(zhuan.diPan).toEqual(fei.diPan);            // 地盘三奇六仪转飞共用
		// 转盘 cell 不带 isFeipan(中宫走原天盘干+五合格,字节护栏)
		const zhuanCenter = (zhuan.cells || []).find((c)=>c.isCenter);
		expect(zhuanCenter && zhuanCenter.isFeipan).toBe(false);
	});

	test('school 缺省/非法值退回转盘', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const panDefault = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1 }), {});
		const panBad = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '乱填' }), {});
		expect(panDefault.school).toEqual('转盘');
		expect(panBad.school).toEqual('转盘');
		expect(panBad.options.schoolLabel).toEqual('转盘（排宫）');
	});

	test('数字起局(原阴盘):空报数→退节气拆补(同转盘);有报数→报数定局换盘;与盘式正交(§5.5)', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const zhuan = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '转盘' }), {});
		// 数字起局 + 空报数 → 退节气拆补,盘面字节同转盘(占位不崩);盘式默认转盘
		const shuziEmpty = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'shuzi', timeAlg: 1 }), {});
		expect(shuziEmpty.diPan).toEqual(zhuan.diPan);
		expect(shuziEmpty.tianPan).toEqual(zhuan.tianPan);
		expect(shuziEmpty.renPan).toEqual(zhuan.renPan);
		expect(shuziEmpty.shenPan).toEqual(zhuan.shenPan);
		expect(shuziEmpty.school).toEqual('转盘');
		expect(shuziEmpty.shuziInfo).toBeNull();
		// 有报数 → 报数各位求和%9(余0作9)定局数,换盘(立夏=阳遁;1234→和10→10%9=1局)
		const shuziNum = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'shuzi', timeAlg: 1, shuziReportNumber: '1234' }), {});
		expect(shuziNum.shuziInfo).not.toBeNull();
		expect(shuziNum.shuziInfo.sum).toEqual(10);
		expect(shuziNum.shuziInfo.gong).toEqual(1);
		expect(shuziNum.juText).toContain('阳遁一局');
		const snap = buildDunJiaSnapshotText(shuziNum);
		expect(snap).toContain('报数 1234');
		expect(snap).toContain('用神宫 1');
		// 数字×盘式正交:数字起局也可配飞盘(局同,盘式飞宫)
		const shuziFei = calcDunJia(fields, feiNongli, makeOptions({ qijuMethod: 'shuzi', timeAlg: 1, school: '飞盘', shuziReportNumber: '1234' }), {});
		expect(shuziFei.school).toEqual('飞盘');
		expect(shuziFei.juText).toContain('阳遁一局');
	});

	test('SCHOOL_OPTIONS 含 转盘(排宫)/飞盘(飞宫)/飞转(混合) 三盘式', ()=>{
		expect(SCHOOL_OPTIONS.map((o)=>o.value)).toEqual(['转盘', '飞盘', '混合']);
		expect(SCHOOL_OPTIONS.map((o)=>o.label)).toEqual(['转盘（排宫）', '飞盘（飞宫）', '飞转（混合）']);
	});

	test('旧数据迁移:school=阴盘(旧盘式)→引擎兜底走报数定局(qijuMethod=shuzi),盘式回落转盘', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		// 旧存命盘/事盘/AI 快照:school='阴盘' + 报数(无 qijuMethod=shuzi)→ 仍出报数定局(立夏阳遁;1234→和10→1局)
		const legacy = calcDunJia(fields, feiNongli, makeOptions({ school: '阴盘', shuziReportNumber: '1234', timeAlg: 1 }), {});
		expect(legacy.school).toEqual('转盘');              // 阴盘盘式回落转盘
		expect(legacy.shuziInfo).not.toBeNull();           // 报数定局已生效(兜底迁移 qijuMethod→shuzi)
		expect(legacy.shuziInfo.gong).toEqual(1);
		expect(legacy.juText).toContain('阳遁一局');
	});

	// 后端飞盘 routing:模拟后端 kinqimen pan_feipan 响应(EX1_fei,繁体卦键)经 normalizeKinqimenData
	// 合并,须与本地 panFeipan 飞盘逐宫一致(九神含中宫、不替虎玄/禽芮)→ 飞盘走后端显示不瞎动。
	test('后端飞盘 response → normalizeKinqimenData 与本地飞盘一致(不瞎动)', ()=>{
		const backendFeiSelected = {
			排盤方式: '拆補', 盤式: '飛盤', 干支: '丙午年癸巳月己丑日甲子時', 旬首: '庚',
			旬空: { 日空: '午未', 時空: '戌亥' }, 排局: '陽遁七局下', 節氣: '立夏',
			值符值使: { 值符天干: ['甲子', '戊'], 值符星宮: ['柱', '兌'], 值使門宮: ['驚', '兌'] },
			天盤: { 坎: '辛', 坤: '壬', 震: '癸', 巽: '丁', 中: '丙', 乾: '乙', 兌: '戊', 艮: '己', 離: '庚' },
			地盤: { 兌: '戊', 艮: '己', 離: '庚', 坎: '辛', 坤: '壬', 震: '癸', 巽: '丁', 中: '丙', 乾: '乙' },
			門: { 坎: '休', 坤: '死', 震: '傷', 巽: '杜', 中: '中', 乾: '開', 兌: '驚', 艮: '生', 離: '景' }, // 九门含中门(统一9门飞,中5得中门)
			星: { 坎: '蓬', 坤: '芮', 震: '沖', 巽: '輔', 中: '禽', 乾: '心', 兌: '柱', 艮: '任', 離: '英' },
			神: { 坎: '合', 坤: '勾', 震: '常', 巽: '雀', 中: '地', 乾: '天', 兌: '符', 艮: '蛇', 離: '陰' },
			馬星: { 天馬: '辰', 丁馬: '亥', 驛馬: '寅' },
		};
		const fields = makeFields('2026-05-15', '00:12:00');
		const opts = makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '飞盘', paiPanType: 3 });
		const localFei = calcDunJia(fields, feiNongli, opts, {});
		const backendPan = { selected: backendFeiSelected, raw: backendFeiSelected, allRaw: {}, sections: [], mode: 'hour', modeLabel: '时家奇门', capabilities: null };
		const merged = normalizeKinqimenData(backendPan, localFei, opts, feiNongli);
		// 四盘逐宫与本地飞盘一致(不瞎动)
		expect(merged.shenPan).toEqual(localFei.shenPan);
		expect(merged.renPan).toEqual(localFei.renPan);
		expect(merged.tianGan).toEqual(localFei.tianGan);
		expect(pickMap(merged.diPan)).toEqual(pickMap(localFei.diPan));
		// 九神含中宫地、有勾常雀、无虎玄
		expect(merged.shenPan[5]).toEqual('地');
		const gods = Object.keys(merged.shenPan).map((k)=>merged.shenPan[k]).join('');
		expect(/[勾常雀]/.test(gods)).toBe(true);
		expect(/[虎玄]/.test(gods)).toBe(false);
		// cells 中宫保真 + 值符值使
		const byNum = {};
		merged.cells.forEach((c)=>{ byNum[c.palaceNum] = c; });
		expect(byNum[5].god).toEqual('地');
		expect(byNum[5].isFeipan).toBe(true);
		expect(merged.zhiFu).toEqual(localFei.zhiFu);
		expect(merged.zhiShi).toEqual(localFei.zhiShi);
	});

	// 后端转盘(时/刻/综合走 Ken):8 星天禽寄芮,后端给「禽/芮/禽芮」→ 显示层一律归「内」(天内)。
	// 用户报障:时家(置闰·转盘)乾宫仍显「禽」+右栏旺相/值符未改 → 锁 normalizeKinqimenData 转盘归一。
	test('后端转盘 response → 天禽/芮一律显「内」(board+旺相+值符),全盘无禽芮残留(用户:禽改内)', ()=>{
		const backendZhuanSelected = {
			排盤方式: '置閏', 盤式: '轉盤', 干支: '丙午年甲午月乙丑日壬午時', 旬首: '戊',
			旬空: { 日空: '戌亥', 時空: '' }, 排局: '陰遁九局上元', 節氣: '夏至',
			值符值使: { 值符天干: ['甲辰', '壬'], 值符星宮: ['芮', '坤'], 值使門宮: ['死', '兌'] }, // 中宫值符星=芮
			天盤: { 巽: '癸', 離: '丁', 坤: '丙', 震: '乙', 中: '壬', 兌: '戊', 艮: '辛', 坎: '庚', 乾: '己' },
			地盤: { 巽: '癸', 離: '丁', 坤: '丙', 震: '乙', 中: '壬', 兌: '戊', 艮: '辛', 坎: '庚', 乾: '己' },
			門: { 巽: '杜', 離: '景', 坤: '死', 震: '傷', 中: '', 兌: '驚', 艮: '生', 坎: '休', 乾: '開' },
			星: { 巽: '任', 離: '沖', 坤: '輔', 震: '蓬', 中: '', 兌: '英', 艮: '心', 坎: '柱', 乾: '禽' }, // 乾=禽(5星寄芮), 中空
			神: { 巽: '符', 離: '蛇', 坤: '陰', 震: '合', 中: '', 兌: '虎', 艮: '地', 坎: '玄', 乾: '天' },
			馬星: { 驛馬: '寅' },
		};
		const fields = makeFields('2026-06-20', '12:52:00');
		const opts = makeOptions({ school: '转盘', paiPanType: 3, qijuMethod: 'zhirun' });
		const localZhuan = calcDunJia(fields, makeNongli(), opts, {});
		const backendPan = { selected: backendZhuanSelected, raw: backendZhuanSelected, allRaw: {}, sections: [], mode: 'minute', modeLabel: '刻家奇门', capabilities: null };
		const merged = normalizeKinqimenData(backendPan, localZhuan, opts, makeNongli());
		const byNum = {};
		merged.cells.forEach((c)=>{ byNum[c.palaceNum] = c; });
		// 乾9宫(后端星=禽)→显「内」,不留「禽」(用户截图 bug)
		expect(byNum[9].tianXing).toEqual('内');
		// 全盘任何宫不残留 禽/芮(转盘8星天禽寄芮一律内)
		expect(/[禽芮]/.test(merged.cells.map((c)=>c.tianXing).join(''))).toBe(false);
		// 中宫值符星=芮 → 值符显「天内」(非 芮禽)
		expect(merged.zhiFu).toEqual('天内');
		// 右栏旺相(读 c.tianXing)同步:乾宫星=内
		const wsByNum = {};
		buildQimenWangShuai(merged).palaces.forEach((p)=>{ wsByNum[p.palaceNum] = p; });
		expect(wsByNum[9].star).toEqual('内');
	});
});

describe('DunJiaCalc · WP-E 旺相休囚死(§17.1)', ()=>{
	const wsNongli = {
		yearJieqi: '丙午', year: '丙午', monthGanZi: '癸巳', dayGanZi: '己丑', time: '甲子',
		jieqi: '立夏', jiedelta: '立夏后第10天', birth: '2026-05-15 00:12:00',
		month: '三月', day: '廿九', leap: false,
	};
	test('按月令五行定 星/门 旺相休囚死(巳月=火令:火旺土相木休水囚金死)', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const pan = calcDunJia(fields, wsNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '转盘' }), {});
		const ws = buildQimenWangShuai(pan);
		expect(ws.monthBranch).toEqual('巳');
		expect(ws.monthElem).toEqual('火');
		const byNum = {};
		ws.palaces.forEach((p)=>{ byNum[p.palaceNum] = p; });
		// 离2 天英(火)→旺;坎8 天蓬(水)→囚;兑6 天柱(金)→死;坤3 天芮(土)→相;巽1 天辅(木)→休
		expect(byNum[2].star).toEqual('英');
		expect(byNum[2].starWangShuai).toEqual('旺');
		expect(byNum[8].star).toEqual('蓬');
		expect(byNum[8].starWangShuai).toEqual('囚');
		expect(byNum[6].star).toEqual('柱');
		expect(byNum[6].starWangShuai).toEqual('死');
		expect(byNum[3].starWangShuai).toEqual('相');
		expect(byNum[1].starWangShuai).toEqual('休');
		// 门同理:坎8 休门(水)→囚;离2 景门(火)→旺
		expect(byNum[8].doorWangShuai).toEqual('囚');
		expect(byNum[2].doorWangShuai).toEqual('旺');
		// 中宫不入旺衰列表(filter isCenter)
		expect(ws.palaces.find((p)=>p.palaceNum === 5)).toBeUndefined();
	});
	test('AI 快照含旺相休囚死段', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const pan = calcDunJia(fields, wsNongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1 }), {});
		const snap = buildDunJiaSnapshotText(pan);
		expect(snap).toContain('[旺相休囚死·月令能量]');
		expect(snap).toContain('火令');
	});
});

// WP-E：AI 快照四同步——[全局速览] 段落 + 命/事局语义随 pan.options.chartCategory 单一真值翻转。
describe('DunJiaCalc · WP-E AI 快照:全局速览 + 命/事局语义(pan.options.chartCategory 单一真值)', ()=>{
	const nongli = {
		yearJieqi: '丙午', year: '丙午', monthGanZi: '癸巳', dayGanZi: '己丑', time: '甲子',
		jieqi: '立夏', jiedelta: '立夏后第10天', birth: '2026-05-15 00:12:00',
		month: '三月', day: '廿九', leap: false,
	};
	function panFor(cat){
		const fields = makeFields('2026-05-15', '00:12:00');
		const pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1, school: '转盘' }), {});
		if(cat){ pan.options.chartCategory = cat; }
		return pan;
	}
	test('快照含 [全局速览] 段（九遁/三奇得使/吉凶格/六害分布/符使落宫，与概览页同源）', ()=>{
		const snap = buildDunJiaSnapshotText(panFor('shi'));
		expect(snap).toContain('[全局速览]');
		expect(snap).toContain('九遁：');
		expect(snap).toContain('三奇得使：');
		expect(snap).toContain('吉格 ');
		expect(snap).toContain('凶格 ');
		expect(snap).toContain('六害分布：');
		expect(snap).toContain('值符落宫：');
	});
	test('事局：日干＝实质 / 时干＝表象（用神分论措辞同步）', ()=>{
		const snap = buildDunJiaSnapshotText(panFor('shi'));
		expect(snap).toContain('事局（日干＝实质 / 时干＝表象）');
		expect(snap).toContain('事之表象');            // 用神分论 yongShenText 事局措辞
		expect(snap).not.toContain('命局（日干＝内心');
	});
	test('命局：日干＝内心 / 时干＝外在（用神分论措辞随之翻转）', ()=>{
		const snap = buildDunJiaSnapshotText(panFor('ming'));
		expect(snap).toContain('命局（日干＝内心 / 时干＝外在）');
		expect(snap).toContain('此人外在');            // 用神分论 yongShenText 命局措辞
		expect(snap).not.toContain('事局（日干＝实质');
	});
	test('缺 chartCategory（未戳）默认事局（向后兼容，calcDunJia 不写该字段）', ()=>{
		const pan = panFor(null);
		expect(pan.options.chartCategory).toBeUndefined();
		const snap = buildDunJiaSnapshotText(pan);
		expect(snap).toContain('事局（日干＝实质 / 时干＝表象）');
	});
});

describe('DunJiaCalc · WP-0 前后端局审计(置闰超神接气诊断)', ()=>{
	function localZhirun(dateStr, timeStr){
		const fields = makeFields(dateStr, timeStr);
		const nongli = buildLocalNongliForTest(dateStr, timeStr);
		const y = Number(dateStr.slice(0, 4));
		const context = { jieqiYearSeeds: { [y - 1]: buildLocalJieqiYearSeed(y - 1, '+08:00'), [y]: buildLocalJieqiYearSeed(y, '+08:00') } };
		const pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'zhirun', timeAlg: 1 }), context);
		const panChaibu = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'chaibu', timeAlg: 1 }), context);
		return { zhirun: pan.juText, chaibu: panChaibu.juText, jieqi: nongli.jieqi };
	}
	// 本地 calcDunJia(置闰,带 jieqi 种子)必须与后端 kinqimen + 参考 EX3 一致(前后端局一致性,无传本歧义)。
	test('2026-08-20 处暑超神:置闰=阴遁一局上元(对齐 EX3/后端),拆补=阴遁二局上元(立秋)', ()=>{
		const r = localZhirun('2026-08-20', '10:00:00');
		expect(r.chaibu).toEqual('阴遁二局上元');   // 立秋(曆法节气)
		expect(r.zhirun).toEqual('阴遁一局上元');   // 处暑(超神接气,符头超前5日)
	});
	test('2026-06-20 夏至界:置闰=阴遁九局上元(超神入夏至,本地==后端),拆补=阳遁六局上元(芒种)', ()=>{
		const r = localZhirun('2026-06-20', '06:49:52');
		expect(r.chaibu).toEqual('阳遁六局上元');   // 芒种(曆法节气=纯节气)
		expect(r.zhirun).toEqual('阴遁九局上元');   // 超神接气入夏至,与后端一致(此前"前后端不一致"实为对比/飞盘缺种子所致)
	});
});

describe('DunJiaCalc · WP-E 数字奇门报数定用神宫(§5.5 通则)', ()=>{
	test('除9取余(余0作9)→用神宫 + 卦/方位', ()=>{
		// 1234 → 和10 → 10%9=1 → 坎1宫正北
		expect(computeShuziYongShenGong('1234')).toEqual({ digits: '1234', sum: 10, gong: 1, gua: '坎', direction: '正北' });
		// 18 → 和9 → 9%9=0 → 作9宫(离正南)
		expect(computeShuziYongShenGong('18')).toEqual({ digits: '18', sum: 9, gong: 9, gua: '离', direction: '正南' });
		// 9 → 和9 → 9宫离
		expect(computeShuziYongShenGong('9').gong).toEqual(9);
		// 含非数字字符(手机号带符号)→ 只取数字
		expect(computeShuziYongShenGong('13-8').sum).toEqual(12);   // 1+3+8
		expect(computeShuziYongShenGong('13-8').gong).toEqual(3);   // 12%9=3 震
	});
	test('空/非法输入安全返回 null', ()=>{
		expect(computeShuziYongShenGong('')).toBeNull();
		expect(computeShuziYongShenGong('abc')).toBeNull();
		expect(computeShuziYongShenGong(null)).toBeNull();
	});
});

describe('DunJiaCalc · WP-D 月家起局(经典「年符头定局法」,五年一元)', ()=>{
	function yueJiaJuText(yearGz, monthGz, qjType){
		const nongli = {
			yearJieqi: yearGz, year: yearGz, monthGanZi: monthGz || '庚寅', dayGanZi: '壬戌', time: '壬子',
			jieqi: '立春', jiedelta: '立春后第14天', birth: '2026-02-17 21:50:07',
			month: '正月', day: '初一', leap: false,
		};
		const fields = makeFields('2026-02-17', '21:50:07');
		const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 1, yueJiaQiJuType: qjType || 0 }), {});
		return pan.juText;
	}
	// 月家「年符头定局」(经典又法/年干支定局):局由年柱符头(最近甲/己年)定,整个 5 年元块同一局,皆阴遁。
	// 符头支 子午卯酉=上元阴七 / 寅申巳亥=中元阴一 / 辰戌丑未=下元阴四。月柱仅作值符值使锚点(不改局)。
	// 真值核验:用户 4 参考盘 + 课本非典型例(2003癸未→符头己卯→上元阴七)= 5/5。
	//   〔淘汰传本〕「逐10月递减(上7→6…2)」对 2026 给阴二,不符 → 弃用。
	test('年符头定局:符头支 子午卯酉=上七 / 寅申巳亥=中一 / 辰戌丑未=下四(4参考盘+课本非典型)', ()=>{
		expect(yueJiaJuText('丙午', '甲午')).toEqual('阴遁四局下元');   // 2026:符头甲辰(辰)→下四
		expect(yueJiaJuText('乙巳', '丁亥')).toEqual('阴遁四局下元');   // 2025:符头甲辰(辰)→下四
		expect(yueJiaJuText('戊辰', '癸亥')).toEqual('阴遁七局上元');   // 2048:符头甲子(子)→上七
		expect(yueJiaJuText('癸酉', '乙卯')).toEqual('阴遁一局中元');   // 2053:符头己巳(巳)→中一
		expect(yueJiaJuText('癸未', '丁巳')).toEqual('阴遁七局上元');   // 课本非典型:2003→符头己卯(卯)→上七
		expect(yueJiaJuText('甲子', '丙寅')).toEqual('阴遁七局上元');   // 符头本身:子→上七
		expect(yueJiaJuText('己巳', '丙寅')).toEqual('阴遁一局中元');   // 巳→中一
		expect(yueJiaJuText('甲戌', '丙寅')).toEqual('阴遁四局下元');   // 戌→下四
	});
	test('整(5年)元块同局:同年不同月局数不变;同元块各年同局(月仅作值符值使锚点)', ()=>{
		const a = yueJiaJuText('丙午', '庚寅');
		expect(a).toEqual('阴遁四局下元');
		expect(yueJiaJuText('丙午', '甲午')).toEqual(a);   // 同年换月,局不变
		expect(yueJiaJuText('丙午', '戊子')).toEqual(a);
		expect(yueJiaJuText('甲辰', '丙寅')).toEqual('阴遁四局下元');   // 2024 同甲辰元块
		expect(yueJiaJuText('丁未', '丙寅')).toEqual('阴遁四局下元');   // 2027 同甲辰元块
	});
	test('年支直取变体(yueJiaQiJuType=1):丙午年支午→上元阴七(与符头法不同,供对比)', ()=>{
		expect(yueJiaJuText('丙午', '甲午', 1)).toEqual('阴遁七局上元');
	});
});

describe('DunJiaCalc · 日家起局(经典「又法·节气三元六十日一局」)', ()=>{
	function dayJiaJu(date, time){
		const nongli = buildLocalNongliForTest(date, time);
		const y = Number(date.slice(0, 4));
		const seeds = {};
		[y - 1, y, y + 1].forEach((yy)=>{ seeds[yy] = buildLocalJieqiYearSeed(yy, '+08:00'); });
		const pan = calcDunJia(makeFields(date, time), nongli, makeOptions({ paiPanType: 2 }), { jieqiYearSeeds: seeds });
		return pan.juText;
	}
	// 后端种子约定:seeds[y].冬至 = 年内冬至 Dec(y)(本地 buildLocalJieqiYearSeed 给 Dec(y-1));线上真实走后端,
	//   dayJiaHalfYear 须按「至日实际年份」兼容两种约定(否则 12-22 退阴九,#3 实障)。本 helper 模拟后端约定。
	function dayJiaJuBackendSeed(date, time){
		const nongli = buildLocalNongliForTest(date, time);
		const y = Number(date.slice(0, 4));
		const seeds = {};
		[y - 1, y, y + 1].forEach((yy)=>{
			const loc = buildLocalJieqiYearSeed(yy, '+08:00');         // 冬至=Dec(yy-1)、夏至=Jun(yy)
			const next = buildLocalJieqiYearSeed(yy + 1, '+08:00');    // 其冬至=Dec(yy)
			seeds[yy] = { ...loc, 冬至: next && next.冬至 };            // 重铸为后端约定:冬至=Dec(yy)
		});
		const pan = calcDunJia(makeFields(date, time), nongli, makeOptions({ paiPanType: 2 }), { jieqiYearSeeds: seeds });
		return pan.juText;
	}
	// 又法日奇门:冬至后第1/2/3甲子(各60日)=阳遁 1/7/4;夏至后第1/2/3甲子=阴遁 9/3/6;至甲子取最近甲子(超30日置闰)。
	// 真值核验(用户 5 参考盘)= 5/5;⚠️阴遁序取 9·3·6(非又法原文 9·2·6)——1964癸亥落中块=阴三(9·2·6 会给阴二,真软件证伪)。
	//   〔淘汰传本〕日支定局(乙丑→阳六)、findYuan符头元(丁酉→阴九)均不符。
	test('60日块对齐 5 参考盘(2026/2053阳·2025/2048/1964阴;含1964癸亥=阴三定阴遁序9·3·6)', ()=>{
		expect(dayJiaJu('2026-06-20', '12:52:00')).toEqual('阳遁一局上元');   // 冬至后第1甲子(上块)→阳一
		expect(dayJiaJu('2053-03-12', '14:35:00')).toEqual('阳遁七局中元');   // 冬至后第2甲子(中块)→阳七
		expect(dayJiaJu('2025-11-24', '12:00:00')).toEqual('阴遁六局下元');   // 夏至后第3甲子(下块)→阴六
		expect(dayJiaJu('2048-11-28', '14:35:00')).toEqual('阴遁六局下元');   // 夏至后第3甲子(下块)→阴六
		expect(dayJiaJu('1964-11-10', '16:44:00')).toEqual('阴遁三局中元');   // 夏至后第2甲子(中块)→阴三(锁阴遁序9·3·6)
		expect(dayJiaJu('2100-06-20', '18:08:00')).toEqual('阳遁一局上元');   // 远期:冬至2099(壬辰z28≤30不翻)→上块→阳一(锁至甲子规则)
	});
	// 至界锁:夏至(2026-06-21)前后,阴阳遁须按「至」翻转(非节令"芒种"滞后)。06-20阳一 / 06-22阴九。
	test('夏至界阴阳遁翻转:06-20=阳遁一局 / 06-22=阴遁九局(以至定半年,非滞后节令)', ()=>{
		expect(dayJiaJu('2026-06-20', '17:30:00')).toEqual('阳遁一局上元');   // 夏至前→阳遁(至=冬至2025)
		expect(dayJiaJu('2026-06-22', '17:30:00')).toEqual('阴遁九局上元');   // 夏至后→阴遁九局(至=夏至2026·第1甲子上块)
		expect(dayJiaJu('2026-12-22', '12:30:00')).toEqual('阳遁一局上元');   // 冬至(12-22)后→阳遁(至=本年冬至,须次年种子区分本年末冬至)
	});
	// #3 实障锁:线上后端种子约定(seeds[y].冬至=Dec(y))下,12-22 须仍判阳一(此前 dayJiaHalfYear 按索引年取 dzEnd=Dec(y+1)→退阴九)。
	test('后端种子约定(年内冬至)下日家不退化:12-22=阳一 / 09-07=阴三 / 06-22=阴九 / 06-20=阳一', ()=>{
		expect(dayJiaJuBackendSeed('2026-12-22', '12:30:00')).toEqual('阳遁一局上元');  // 本年末冬至后→阳一(核心回归)
		expect(dayJiaJuBackendSeed('2026-09-07', '12:00:00')).toEqual('阴遁三局中元');  // 夏至后→阴三(与本地约定一致)
		expect(dayJiaJuBackendSeed('2026-06-22', '17:30:00')).toEqual('阴遁九局上元');  // 夏至后第1块→阴九
		expect(dayJiaJuBackendSeed('2026-06-20', '17:30:00')).toEqual('阳遁一局上元');  // 夏至前→阳一
	});
});

describe('DunJiaCalc · 飞盘飞布(值符落时干宫;九星阳顺阴逆飞九宫;八门九宫飞·中宫入门;九神阳勾雀/阴白玄)', ()=>{
	// 九星/九神序+飞向取自经典书例(阳一局丙申/阴四局丁巳);八门按参考实现「入中宫飞九宫」(非书本跳中5)。
	test('阳遁一局·丙申时:九星顺飞/九神勾常雀/八门九宫飞', ()=>{
		const fp = panFeipan({ time: '丙申' }, '阳遁一局上元');
		expect(fp.starGua).toEqual({ 坎: '心', 坤: '柱', 震: '任', 巽: '英', 中: '蓬', 乾: '芮', 兑: '冲', 艮: '辅', 离: '禽' });
		expect(fp.shenGua).toEqual({ 坎: '阴', 坤: '合', 震: '勾', 巽: '常', 中: '雀', 乾: '地', 兑: '天', 艮: '符', 离: '蛇' });
		expect(fp.menGua).toEqual({ 震: '休', 巽: '死', 中: '伤', 乾: '杜', 艮: '开', 离: '惊', 坎: '生', 坤: '景', 兑: '中' }); // 值使杜@乾6,九门飞含中门(伤@中5/中门@兑7)
		expect(fp.zfzs.值符星宫).toEqual(['辅', '艮']);
		expect(fp.zfzs.值使门宫).toEqual(['杜', '乾']);
	});
	test('阴遁四局·丁巳时:九星逆飞/九神白虎玄武/八门九宫飞', ()=>{
		const fp = panFeipan({ time: '丁巳' }, '阴遁四局上元');
		expect(fp.starGua).toEqual({ 巽: '芮', 离: '心', 坤: '辅', 震: '冲', 中: '蓬', 兑: '任', 艮: '柱', 坎: '禽', 乾: '英' });
		expect(fp.shenGua).toEqual({ 巽: '合', 离: '地', 坤: '常', 震: '虎', 中: '阴', 兑: '符', 艮: '天', 坎: '玄', 乾: '蛇' });
		expect(fp.menGua).toEqual({ 震: '休', 坤: '死', 坎: '伤', 离: '杜', 兑: '开', 乾: '惊', 中: '生', 巽: '景', 艮: '中' }); // 值使生@中5(逆飞),中门@艮8
		expect(fp.zfzs.值符星宫).toEqual(['任', '兑']);
		expect(fp.zfzs.值使门宫).toEqual(['生', '中']);   // 参考实现:值使落中宫(不寄)
	});
	// 参考锚点实测:2026-06-20 时乙酉,阴遁九局,值符甲申庚天柱落坎1/值使惊门落乾6。逐宫(九星/九门/九神)对齐参考实现。
	test('参考实现锚点·阴遁九局·乙酉时:九星/九门/九神逐宫对齐 参考实现', ()=>{
		const fp = panFeipan({ time: '乙酉' }, '阴遁九局上元');
		expect(fp.starGua).toEqual({ 巽: '辅', 离: '任', 坤: '心', 震: '禽', 中: '冲', 兑: '蓬', 艮: '英', 坎: '柱', 乾: '芮' });
		expect(fp.shenGua).toEqual({ 巽: '玄', 离: '蛇', 坤: '天', 震: '地', 中: '常', 兑: '合', 艮: '阴', 坎: '符', 乾: '虎' });
		expect(fp.menGua).toEqual({ 震: '休', 坤: '死', 坎: '伤', 离: '杜', 兑: '开', 乾: '惊', 中: '生', 巽: '景', 艮: '中' }); // 中门@艮8(已对参考实现)
		// 天盘干:地盘整体随值符平移(P-Hv),阴遁≠星各带本宫(此前漏检的天干bug)——逐宫对齐参考实现:坎1=庚/巽4=乙…
		expect(fp.tianpanGua).toEqual({ 巽: '乙', 离: '辛', 坤: '己', 震: '戊', 中: '丙', 兑: '癸', 艮: '壬', 坎: '庚', 乾: '丁' });
		expect(fp.zfzs.值符星宫).toEqual(['柱', '坎']);
		expect(fp.zfzs.值使门宫).toEqual(['惊', '乾']);
	});
	// 参考锚点实测·中宫值符(旬首遁仪落中5→值符=天禽、值使=「中门」):用户给值 6-22→中门@震3 / 02-04→中门@坎1。
	// 用同算法路径的构造输入锁定:旬首甲辰遁壬恒@中5(阳一/阴九壬皆居中)→Hv=5;时干定 xord,阴逆 丙午(xord3)→震3、阳顺 己酉(xord6)→坎1。
	test('中宫值符·飞盘九门:值使=中门,阴遁丙午→震3 / 阳遁己酉→坎1(对齐 参考实现 用户实测)', ()=>{
		const fpYin = panFeipan({ time: '丙午' }, '阴遁九局上元');   // 旬首甲辰遁壬@中5→Hv=5;xord=3,阴逆→Pu=震3
		expect(fpYin.zfzs.值符星宫[0]).toEqual('禽');               // 中宫值符=天禽
		expect(fpYin.zfzs.值使门宫).toEqual(['中', '震']);          // 值使=中门,落震3
		expect(fpYin.menGua.震).toEqual('中');
		const fpYang = panFeipan({ time: '己酉' }, '阳遁一局上元');  // 旬首甲辰遁壬@中5→Hv=5;xord=6,阳顺→Pu=坎1
		expect(fpYang.zfzs.值符星宫[0]).toEqual('禽');
		expect(fpYang.zfzs.值使门宫).toEqual(['中', '坎']);         // 值使=中门,落坎1
		expect(fpYang.menGua.坎).toEqual('中');
	});
});

describe('DunJiaCalc · birthToYearGan（相关人员生年干，按立春分界）', ()=>{
	test('立春前后年柱天干不同（2000 立春约2/4：2/3→己、2/5→庚）', ()=>{
		expect(birthToYearGan('2000-02-03 12:00:00')).toEqual('己');
		expect(birthToYearGan('2000-02-05 12:00:00')).toEqual('庚');
	});
	test('常规年份取年柱天干（1990 庚午年→庚）', ()=>{
		expect(birthToYearGan('1990-06-15 10:30:00')).toEqual('庚');
	});
	test('缺日期/空串/非法值安全返回空', ()=>{
		expect(birthToYearGan('')).toEqual('');
		expect(birthToYearGan(null)).toEqual('');
		expect(birthToYearGan('not-a-date')).toEqual('');
	});
});

// 标准参考盘(用户提供,2026-06-20 12:52 丙午年甲午月乙丑日壬午时·辛亥刻):各家逐宫对齐。
// palaceNum=grid 位(1巽2离3坤4震5中6兑7艮8坎9乾);禽随芮(中5无星、天禽并入天芮宫,显'芮')。
describe('DunJiaCalc · 各家排盘对齐标准参考盘(年/月/日家)', ()=>{
	const fields = makeFields('2026-06-20', '12:52:00');
	const nongli = buildLocalNongliForTest('2026-06-20', '12:52:00');
	function starMapOf(pan){
		const m = {};
		(pan.cells || []).forEach((c)=>{ if(c.palaceNum !== 5){ m[c.palaceNum] = c.tianXing; } });
		return m;
	}
	test('年家=阴遁七局下元,值符天冲@离9/值使伤门@坎1,逐宫对齐参考盘', ()=>{
		const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 0, school: '转盘', timeAlg: 1 }), {});
		expect(pan.juText).toContain('阴遁七局');
		expect(pan.zhiFu).toEqual('天冲');
		expect(pan.zhiShi).toEqual('伤门');
		expect(pan.zhiFuPalace).toEqual(2);
		expect(pan.zhiShiPalace).toEqual(8);
		expect(pickMap(pan.diPan)).toEqual({ 1: '辛', 2: '丙', 3: '癸', 4: '壬', 6: '戊', 7: '乙', 8: '丁', 9: '己' });
		expect(pickMap(pan.tianGan)).toEqual({ 1: '乙', 2: '壬', 3: '辛', 4: '丁', 6: '丙', 7: '己', 8: '戊', 9: '癸' });
		expect(pickMap(pan.renPan)).toEqual({ 1: '死', 2: '惊', 3: '开', 4: '景', 6: '休', 7: '杜', 8: '伤', 9: '生' });
		expect(pickMap(pan.shenPan)).toEqual({ 1: '蛇', 2: '符', 3: '天', 4: '阴', 6: '地', 7: '合', 8: '虎', 9: '玄' });
		expect(starMapOf(pan)).toEqual({ 1: '任', 2: '冲', 3: '辅', 4: '蓬', 6: '英', 7: '心', 8: '柱', 9: '内' });
	});
	test('月家=阴遁四局(符头甲辰→下元),值符天蓬@坎1/值使休门@坎1(伏吟),逐宫对齐参考盘', ()=>{
		const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 1, school: '转盘', timeAlg: 1, yueJiaQiJuType: 0 }), {});
		expect(pan.juText).toContain('阴遁四局');
		expect(pan.zhiFu).toEqual('天蓬');
		expect(pan.zhiShi).toEqual('休门');
		expect(pan.zhiFuPalace).toEqual(8);
		expect(pan.zhiShiPalace).toEqual(8);
		expect(pickMap(pan.diPan)).toEqual({ 1: '戊', 2: '壬', 3: '庚', 4: '己', 6: '丁', 7: '癸', 8: '辛', 9: '丙' });
		expect(pickMap(pan.tianGan)).toEqual(pickMap(pan.diPan));   // 伏吟:天盘奇仪=地盘
		expect(pickMap(pan.renPan)).toEqual({ 1: '杜', 2: '景', 3: '死', 4: '伤', 6: '惊', 7: '生', 8: '休', 9: '开' });
		expect(pickMap(pan.shenPan)).toEqual({ 1: '玄', 2: '虎', 3: '合', 4: '地', 6: '阴', 7: '天', 8: '符', 9: '蛇' });
		expect(starMapOf(pan)).toEqual({ 1: '辅', 2: '英', 3: '内', 4: '冲', 6: '柱', 7: '任', 8: '蓬', 9: '心' });
	});
	test('日家=阳遁一局上元(节气三元1·7·4),值符天蓬@离9/值使休门@坤2,逐宫对齐参考盘', ()=>{
		const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 2, school: '转盘', timeAlg: 1 }), {});
		expect(pan.juText).toContain('阳遁一局');
		expect(pan.zhiFu).toEqual('天蓬');
		expect(pan.zhiShi).toEqual('休门');
		expect(pan.zhiFuPalace).toEqual(2);
		expect(pan.zhiShiPalace).toEqual(3);
		expect(pickMap(pan.diPan)).toEqual({ 1: '辛', 2: '乙', 3: '己', 4: '庚', 6: '丁', 7: '丙', 8: '戊', 9: '癸' });
		expect(pickMap(pan.tianGan)).toEqual({ 1: '癸', 2: '戊', 3: '丙', 4: '丁', 6: '庚', 7: '己', 8: '乙', 9: '辛' });
		expect(pickMap(pan.renPan)).toEqual({ 1: '惊', 2: '开', 3: '休', 4: '死', 6: '生', 7: '景', 8: '杜', 9: '伤' });
		expect(pickMap(pan.shenPan)).toEqual({ 1: '天', 2: '符', 3: '蛇', 4: '地', 6: '阴', 7: '玄', 8: '虎', 9: '合' });
		expect(starMapOf(pan)).toEqual({ 1: '心', 2: '蓬', 3: '任', 4: '柱', 6: '冲', 7: '内', 8: '英', 9: '辅' });
	});
});

// 第2标准参考盘(用户提供,2025-11-24 21:52 乙巳年丁亥月丁酉日辛亥时·癸巳刻):验证各家局法泛化(非仅对1样本)。
describe('DunJiaCalc · 各家对齐第2标准参考盘(2025-11-24)', ()=>{
	const fields = makeFields('2025-11-24', '21:52:00');
	const nongli = buildLocalNongliForTest('2025-11-24', '21:52:00');
	const ctx = { jieqiYearSeeds: { 2024: buildLocalJieqiYearSeed(2024, '+08:00'), 2025: buildLocalJieqiYearSeed(2025, '+08:00') } };
	function meta(pp, qm){ return calcDunJia(fields, nongli, makeOptions({ paiPanType: pp, qijuMethod: qm || 'chaibu', school: '转盘', timeAlg: 1, yueJiaQiJuType: 0 }), ctx); }
	test('年家=阴遁七局,值符天冲@艮8/值使伤门@坤2', ()=>{
		const p = meta(0);
		expect(p.juText).toContain('阴遁七局');
		expect(p.zhiFu).toEqual('天冲'); expect(p.zhiShi).toEqual('伤门');
		expect(p.zhiFuPalace).toEqual(7); expect(p.zhiShiPalace).toEqual(3);
	});
	test('月家=阴遁四局(符头甲辰→下元),值符@兑7/值使死门@艮8', ()=>{
		const p = meta(1);
		expect(p.juText).toContain('阴遁四局');
		expect(p.zhiShi).toEqual('死门');
		expect(p.zhiFuPalace).toEqual(6); expect(p.zhiShiPalace).toEqual(7);
	});
	test('日家=阴遁六局(60日块·夏至后第3甲子下元),值符天冲@离9/值使伤门@离9', ()=>{
		const p = meta(2);
		expect(p.juText).toContain('阴遁六局');
		expect(p.zhiFu).toEqual('天冲'); expect(p.zhiShi).toEqual('伤门');
		expect(p.zhiFuPalace).toEqual(2); expect(p.zhiShiPalace).toEqual(2);
	});
	test('时家拆补=阴遁五局上元', ()=>{
		expect(meta(3, 'chaibu').juText).toEqual('阴遁五局上元');
	});
});

describe('DunJiaCalc · 压力测试 全盘式 × 定局 × 排盘 笛卡尔扫描(WP-F)', ()=>{
	const SCHOOLS = ['转盘', '飞盘', '混合'];
	const METHODS = ['chaibu', 'zhirun', 'maoshan', 'wurun', 'shuzi'];
	const PAIPAN = [0, 1, 2, 3, 4];   // [H-F] 刻家(4)复活(十分局);金函(6)=查表独立体系另测;综合(5)仍下架
	// 含超神/接气/至界/年界/晚子时边界,真盘历法(buildLocalNongliForTest)
	const DATES = [
		['2026-08-20', '10:00:00'],   // 处暑超神(置闰=阴一上元)
		['2026-06-20', '12:14:00'],   // 夏至界(超神入夏至)
		['2026-05-15', '00:12:00'],   // 立夏下元(飞盘 golden 日)
		['2026-02-17', '21:50:07'],   // 立春后(常规)
		['2015-12-22', '11:42:00'],   // 冬至(阳遁起点)
		['2026-11-07', '23:30:00'],   // 立冬·晚子时边界
		['2026-12-22', '12:30:00'],   // 冬至界(日家须次年种子定本年末冬至→阳遁,#3)
		['2100-06-20', '18:08:00'],   // 远期(至甲子规则,百年外历法稳健)
	];
	// 预算:每日 nongli + 交节种子各算一次(buildLocalJieqiYearSeed 昂贵),笛卡尔内复用。
	// 含 y+1 种子:日家冬至界(晚12月过冬至)须次年冬至定半年/至甲子,否则退夏至阴遁(#3)。
	const prepared = DATES.map(([d, t])=>{
		const y = Number(d.slice(0, 4));
		return {
			d, t,
			fields: makeFields(d, t),
			nongli: buildLocalNongliForTest(d, t),
			context: { jieqiYearSeeds: { [y - 1]: buildLocalJieqiYearSeed(y - 1, '+08:00'), [y]: buildLocalJieqiYearSeed(y, '+08:00'), [y + 1]: buildLocalJieqiYearSeed(y + 1, '+08:00') } },
		};
	});

	test('全 3×5×4×8=480 组合:不崩 + 九宫齐全 + juText合法 + 盘式语义自洽 + 飞盘/混合含中宫中门', ()=>{
		const failures = [];
		let combos = 0;
		prepared.forEach(({ fields, nongli, context, d, t })=>{
			SCHOOLS.forEach((school)=>{
				METHODS.forEach((qijuMethod)=>{
					PAIPAN.forEach((paiPanType)=>{
						combos++;
						const tag = `${d} ${t} ${school}/${qijuMethod}/pp${paiPanType}`;
						let pan;
						try {
							pan = calcDunJia(fields, nongli, makeOptions({ school, qijuMethod, paiPanType, timeAlg: 1 }), context);
						} catch(e){ failures.push(`${tag} 抛错: ${e && e.message}`); return; }
						if(!pan){ failures.push(`${tag} 空盘`); return; }
						const nums = (pan.cells || []).map((c)=>c.palaceNum).sort((a, b)=>a - b);
						if(JSON.stringify(nums) !== '[1,2,3,4,5,6,7,8,9]') failures.push(`${tag} 九宫缺: ${nums}`);
						if(!/[阳阴]遁[一二三四五六七八九]局(上元|中元|下元)/.test(pan.juText || '')) failures.push(`${tag} juText非法: ${pan.juText}`);
						const gods = Object.keys(pan.shenPan || {}).map((k)=>pan.shenPan[k]).join('');
						if(school === '飞盘' || school === '混合'){
							// 飞盘=九神飞泊;混合(飞转)=星转·门飞·九神(专题§4.2),九神/八门同走飞盘。两者皆含中宫神+中门。
							if(pan.school !== school) failures.push(`${tag} school≠${school}: ${pan.school}`);
							if(!pan.shenPan || !pan.shenPan[5]) failures.push(`${tag} ${school}中宫无神`);
							// 九神签名=太常(常):阳遁含勾/常/雀、阴遁含虎/常/玄,太常阴阳通用;转盘八神(符蛇阴合虎玄地天)恒无常。
							// (虎/玄 不可作判别:阴遁飞盘九神本就含白虎/玄武,与转盘八神共用。)
							if(!/常/.test(gods)) failures.push(`${tag} ${school}缺太常(九神签名): ${gods}`);
							// 统一9门飞:飞盘/混合恒含「中门」(中宫值符时值使=中门居Pu;非中宫值符时中门作第9门随飞填宫),不漏宫。
							const feiDoors = (pan.cells || []).map((c)=>c.door || '').join('');
							if(feiDoors.indexOf('中') < 0) failures.push(`${tag} ${school}缺中门(九门飞应填满): ${feiDoors}`);
						} else {
							if(pan.school !== school) failures.push(`${tag} school≠${school}: ${pan.school}`);
							if(/常/.test(gods)) failures.push(`${tag} ${school}混入九神(太常): ${gods}`);
						}
					});
				});
			});
		});
		expect(combos).toBe(SCHOOLS.length * METHODS.length * PAIPAN.length * prepared.length);
		expect(failures).toEqual([]);
	}, 60000);

	test('回归(用户报障):同时刻 飞盘神 ≠ 转盘神(切换盘式必出不同盘),地盘共用', ()=>{
		const failures = [];
		prepared.forEach(({ fields, nongli, context, d })=>{
			METHODS.forEach((qijuMethod)=>{
				const tag = `${d} ${qijuMethod}`;
				const zhuan = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType: 3, timeAlg: 1, school: '转盘' }), context);
				const fei = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType: 3, timeAlg: 1, school: '飞盘' }), context);
				if(JSON.stringify(fei.shenPan) === JSON.stringify(zhuan.shenPan)) failures.push(`${tag} 飞盘神==转盘神(切换无效!)`);
				if(JSON.stringify(fei.diPan) !== JSON.stringify(zhuan.diPan)) failures.push(`${tag} 飞盘地盘≠转盘地盘(地盘三奇六仪应共用)`);
			});
		});
		expect(failures).toEqual([]);
	}, 30000);

	test('字节护栏:缺省 school 与显式转盘逐宫一致(默认转盘不瞎动)', ()=>{
		const failures = [];
		prepared.forEach(({ fields, nongli, context, d })=>{
			METHODS.forEach((qijuMethod)=>{
				[0, 1, 3].forEach((paiPanType)=>{
					const tag = `${d} ${qijuMethod}/pp${paiPanType}`;
					const def = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType, timeAlg: 1 }), context);
					const zhuan = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType, timeAlg: 1, school: '转盘' }), context);
					['diPan', 'tianPan', 'renPan', 'shenPan'].forEach((k)=>{
						if(JSON.stringify(def[k]) !== JSON.stringify(zhuan[k])) failures.push(`${tag} ${k} 缺省≠转盘`);
					});
					if(def.juText !== zhuan.juText) failures.push(`${tag} juText 缺省≠转盘`);
					if(def.zhiFu !== zhuan.zhiFu) failures.push(`${tag} 值符 缺省≠转盘`);
					if(def.zhiShi !== zhuan.zhiShi) failures.push(`${tag} 值使 缺省≠转盘`);
				});
			});
		});
		expect(failures).toEqual([]);
	}, 30000);

	test('混合(飞转)合成律:天盘/星=转盘、八门/九神=飞盘、地盘三方共用(专题§4.2)', ()=>{
		const failures = [];
		prepared.forEach(({ fields, nongli, context, d })=>{
			METHODS.forEach((qijuMethod)=>{
				const tag = `${d} ${qijuMethod}`;
				const zhuan = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType: 3, timeAlg: 1, school: '转盘' }), context);
				const fei = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType: 3, timeAlg: 1, school: '飞盘' }), context);
				const hun = calcDunJia(fields, nongli, makeOptions({ qijuMethod, paiPanType: 3, timeAlg: 1, school: '混合' }), context);
				// 星转:天盘干+九星 同转盘
				if(JSON.stringify(hun.tianPan) !== JSON.stringify(zhuan.tianPan)) failures.push(`${tag} 混合天盘≠转盘`);
				if(JSON.stringify(hun.tianXing) !== JSON.stringify(zhuan.tianXing)) failures.push(`${tag} 混合九星≠转盘`);
				// 门飞·神飞:八门+九神 同飞盘
				if(JSON.stringify(hun.renPan) !== JSON.stringify(fei.renPan)) failures.push(`${tag} 混合八门≠飞盘`);
				if(JSON.stringify(hun.shenPan) !== JSON.stringify(fei.shenPan)) failures.push(`${tag} 混合九神≠飞盘`);
				// 地盘三奇六仪 转/飞/混 三方共用
				if(JSON.stringify(hun.diPan) !== JSON.stringify(zhuan.diPan)) failures.push(`${tag} 混合地盘≠转盘`);
				if(hun.school !== '混合') failures.push(`${tag} 混合 school≠混合`);
			});
		});
		expect(failures).toEqual([]);
	}, 30000);

	test('数字奇门报数:1..300 全出合法用神宫(数字和%9,余0作9)+ 非法输入安全', ()=>{
		const failures = [];
		for(let n = 1; n <= 300; n++){
			const r = computeShuziYongShenGong(String(n));
			if(!r){ failures.push(`${n} 返回空`); continue; }
			if(!(r.gong >= 1 && r.gong <= 9)) failures.push(`${n} gong越界: ${r.gong}`);
			const ds = String(n).split('').reduce((a, c)=>a + Number(c), 0);
			const exp = (ds % 9) === 0 ? 9 : (ds % 9);
			if(r.gong !== exp) failures.push(`${n} gong=${r.gong}≠${exp}`);
			if(!r.gua || !r.direction) failures.push(`${n} 缺卦/方位`);
		}
		['', '   ', 'abc', null, undefined].forEach((bad)=>{
			if(computeShuziYongShenGong(bad) !== null) failures.push(`非法[${String(bad)}]应返回 null`);
		});
		expect(failures).toEqual([]);
	});

	test('数字盘(数字起局+报数):报数 sweep → 报数定局合法全盘 + shuziInfo + 不崩', ()=>{
		const failures = [];
		const REPORTS = ['1', '9', '18', '1234', '13800138000', '99999', '0', '777'];
		prepared.forEach(({ fields, nongli, context, d })=>{
			REPORTS.forEach((rpt)=>{
				const tag = `${d} 报${rpt}`;
				let pan;
				try {
					pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'shuzi', shuziReportNumber: rpt, paiPanType: 3, timeAlg: 1 }), context);
				} catch(e){ failures.push(`${tag} 抛错: ${e && e.message}`); return; }
				if(!pan){ failures.push(`${tag} 空盘`); return; }
				const nums = (pan.cells || []).map((c)=>c.palaceNum).sort((a, b)=>a - b);
				if(JSON.stringify(nums) !== '[1,2,3,4,5,6,7,8,9]') failures.push(`${tag} 九宫缺`);
				const digits = rpt.replace(/[^0-9]/g, '');
				if(digits){
					if(!pan.shuziInfo) failures.push(`${tag} 缺 shuziInfo`);
					const sum = digits.split('').reduce((a, c)=>a + Number(c), 0);
					const exp = (sum % 9) === 0 ? 9 : (sum % 9);
					const juCn = '一二三四五六七八九'[exp - 1];
					if(!(pan.juText || '').includes(`${juCn}局`)) failures.push(`${tag} 局≠报数定局(期${juCn}局): ${pan.juText}`);
				}
			});
		});
		expect(failures).toEqual([]);
	});

	test('月家整年同局:全 12 月皆出合法局 + 同年元/局固定(丙午=符头甲辰→下元四,月不改局)', ()=>{
		const failures = [];
		// 丙午年五虎遁(庚寅起正月):寅..丑
		const MONTH_GZ = ['庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑'];
		const fields = makeFields('2026-02-17', '21:50:07');
		const yuans = new Set();
		MONTH_GZ.forEach((mgz, i)=>{
			const nongli = {
				yearJieqi: '丙午', year: '丙午', monthGanZi: mgz, dayGanZi: '壬戌', time: '壬子',
				jieqi: '立春', jiedelta: '立春后第14天', birth: '2026-02-17 21:50:07', month: '正月', day: '初一', leap: false,
			};
			const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 1, yueJiaQiJuType: 0 }), {});
			if(!/[阳阴]遁[一二三四五六七八九]局(上元|中元|下元)/.test(pan.juText || '')) failures.push(`月${i + 1}(${mgz}) juText非法: ${pan.juText}`);
			const m = (pan.juText || '').match(/(上元|中元|下元)/);
			if(m) yuans.add(m[1]);
		});
		if(yuans.size !== 1) failures.push(`同年元应固定,实得: ${[...yuans].join('/')}`);
		expect(failures).toEqual([]);
	});
});

describe('DunJiaCalc · 本轮新增 golden(混合/茅山/置闰天数)', ()=>{
	const seedCache = {};
	function seedsFor(y){
		[y - 1, y, y + 1].forEach((yy)=>{ if(!seedCache[yy]) seedCache[yy] = buildLocalJieqiYearSeed(yy, '+08:00'); });
		return { jieqiYearSeeds: { [y - 1]: seedCache[y - 1], [y]: seedCache[y], [y + 1]: seedCache[y + 1] } };
	}

	test('飞转(混合)§4.3:中5 有门有神无星 + 天盘/星=转盘、门/神=飞盘 + 局同转盘(2026-03-21 09:30)', ()=>{
		const d = '2026-03-21'; const t = '09:30:00'; const y = 2026;
		const fields = makeFields(d, t);
		const nongli = buildLocalNongliForTest(d, t);
		const ctx = seedsFor(y);
		const opt = (school)=>makeOptions({ school, qijuMethod: 'chaibu', paiPanType: 3, timeAlg: 1 });
		const zhuan = calcDunJia(fields, nongli, opt('转盘'), ctx);
		const fei = calcDunJia(fields, nongli, opt('飞盘'), ctx);
		const hun = calcDunJia(fields, nongli, opt('混合'), ctx);
		expect(hun.school).toEqual('混合');
		expect(hun.options.schoolLabel).toEqual('飞转（混合）');
		// 春分日 阳遁某局(合法);混合定局口径同转盘(都走拆补)
		expect(/阳遁[一二三四五六七八九]局/.test(hun.juText || '')).toBe(true);
		expect(hun.juText).toEqual(zhuan.juText);
		// §4.2 合成律:天盘干+九星同转盘、八门+九神同飞盘、地盘三方共用
		expect(hun.tianPan).toEqual(zhuan.tianPan);
		expect(hun.tianXing).toEqual(zhuan.tianXing);
		expect(hun.renPan).toEqual(fei.renPan);
		expect(hun.shenPan).toEqual(fei.shenPan);
		expect(hun.diPan).toEqual(zhuan.diPan);
		// §4.3 核心:中5 有门(飞)、有神(飞九神)、无星(星转不入中)
		const c5 = (hun.cells || []).find((c)=>c.palaceNum === 5);
		expect(c5).toBeTruthy();
		expect(String(c5.door || '').length > 0).toBe(true);
		expect(String(c5.god || '').length > 0).toBe(true);
		expect(String(c5.tianXing || '')).toEqual('');
	});

	test('茅山(满3进下一节气):2026-08-20 立秋下元=阴遁八局(专题§2.1/§2.4)', ()=>{
		const d = '2026-08-20'; const t = '10:00:00'; const y = 2026;
		const fields = makeFields(d, t);
		const nongli = buildLocalNongliForTest(d, t);
		const ctx = seedsFor(y);
		const pan = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'maoshan', paiPanType: 3, timeAlg: 1 }), ctx);
		expect(pan.juText).toContain('阴遁八局');
		expect(pan.juText).toContain('下元');
		// 茅山是 时家定局,盘式默认转盘,九宫齐全
		const nums = (pan.cells || []).map((c)=>c.palaceNum).sort((a, b)=>a - b);
		expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	test('茅山节气边界(满3元滚下一节气·时刻感知):2026 芒种末→夏至上元(非夏至当天上点钟错回上元)', ()=>{
		const y = 2026; const ctx = seedsFor(y);
		var run = function(d, t){ return calcDunJia(makeFields(d, t), buildLocalNongliForTest(d, t), makeOptions({ qijuMethod: 'maoshan', paiPanType: 3, timeAlg: 1 }), ctx).juText; };
		// 边界前:芒种下元(满2元未满3)
		expect(run('2026-06-20', '23:00:00')).toContain('阳遁九局');
		expect(run('2026-06-20', '23:00:00')).toContain('下元');
		// 夏至当天但在交节(午后)之前:仍属芒种、且满3元 → 滚到夏至上元(阴9上元),不得错回芒种上元
		const early = run('2026-06-21', '08:00:00');
		expect(early).toContain('阴遁九局');
		expect(early).toContain('上元');
		// 夏至交节之后:夏至上元(阴9上元),与边界前夕连续(无 下元→上元 回退)
		const after = run('2026-06-22', '08:00:00');
		expect(after).toContain('阴遁九局');
		expect(after).toContain('上元');
	});

	test('置闰天数(zhirunLeapDays)参数化:默认(9)字节=未传;阈值在临界盘换局(大于9天 vs 大于等于9天)', ()=>{
		// (a) 默认值=现行行为:zhirunLeapDays:9 与未传 逐宫字节一致(护栏日不漂)
		const guard = [['1998-01-17', '12:00:00'], ['1994-01-17', '12:00:00'], ['2015-12-22', '11:42:00']];
		guard.forEach(([d, t])=>{
			const y = Number(d.slice(0, 4));
			const ctx = seedsFor(y);
			const fields = makeFields(d, t); const nongli = buildLocalNongliForTest(d, t);
			const def = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'zhirun', paiPanType: 3, timeAlg: 1 }), ctx);
			const nine = calcDunJia(fields, nongli, makeOptions({ qijuMethod: 'zhirun', paiPanType: 3, timeAlg: 1, zhirunLeapDays: 9 }), ctx);
			expect(nine.juText).toEqual(def.juText);
			expect(nine.diPan).toEqual(def.diPan);
			expect(nine.tianPan).toEqual(def.tianPan);
		});
		// (b) 阈值生效:2018 大雪置闰窗口取两个稳定盘(各连续多日同结果,非交节边缘,确定性)
		const ctx2018 = seedsFor(2018);
		const calcLeap = (d, t, leap)=>calcDunJia(makeFields(d, t), buildLocalNongliForTest(d, t), makeOptions({ qijuMethod: 'zhirun', paiPanType: 3, timeAlg: 1, zhirunLeapDays: leap }), ctx2018);
		// 至点锚语义(与 kinqimen zhirun_jieqi 同源,1940-2060 全域平价互证):
		// value=9=「满9天即闰(dgap≥9,默认·主流)」、value=8=「满8天即闰(dgap≥8,从宽)」。
		// 2018 大雪 dgap=9 → 两阈值同判闰(旧「>9 vs ≥9」口径的期望已随旧法废弃)。
		const both = calcLeap('2018-12-20', '12:00:00', 9);
		const both8 = calcLeap('2018-12-20', '12:00:00', 8);
		expect(both.juText).toEqual('阴遁七局中元');
		expect(both8.juText).toEqual(both.juText);
		// 新临界盘:2016-06-03(芒种窗 dgap=8,5 日稳定非交节边缘)— ≥9 不闰 / ≥8 闰,两阈值分歧
		const ctx2016 = seedsFor(2016);
		const calcLeap16 = (d, t, leap)=>calcDunJia(makeFields(d, t), buildLocalNongliForTest(d, t), makeOptions({ qijuMethod: 'zhirun', paiPanType: 3, timeAlg: 1, zhirunLeapDays: leap }), ctx2016);
		const crit9 = calcLeap16('2016-06-03', '12:00:00', 9);
		const crit8 = calcLeap16('2016-06-03', '12:00:00', 8);
		expect(crit9.juText).toEqual('阳遁三局中元');
		expect(crit8.juText).toEqual('阳遁二局中元');
		expect(crit9.juText).not.toEqual(crit8.juText);
		// 非临界盘:2018-12-10(置闰窗内但未及阈值)— 两阈值同局,阈值改不影响非临界盘
		const safe9 = calcLeap('2018-12-10', '12:00:00', 9);
		const safe8 = calcLeap('2018-12-10', '12:00:00', 8);
		expect(safe9.juText).toEqual(safe8.juText);
	}, 30000);
});
