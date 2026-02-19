import { calcDunJia } from '../DunJiaCalc';

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

describe('DunJiaCalc options', ()=>{
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

	test('zhiShiType changes 值使 when 值符 is 天禽', ()=>{
		const nongli = makeNongli();
		let foundTime = null;
		for(let h=0; h<24; h++){
			const hh = `${h}`.padStart(2, '0');
			const fields = makeFields('2026-02-17', `${hh}:50:07`);
			const pan = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 0 }), {});
			if(pan && pan.zhiFu === '天禽'){
				foundTime = `${hh}:50:07`;
				break;
			}
		}
		expect(foundTime).not.toBeNull();
		const fields = makeFields('2026-02-17', foundTime);
		const pan0 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 0 }), {});
		const pan1 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 1 }), {});
		const pan2 = calcDunJia(fields, nongli, makeOptions({ paiPanType: 3, zhiShiType: 2 }), {});
		const zhiShiSet = new Set([pan0.zhiShi, pan1.zhiShi, pan2.zhiShi]);
		expect(zhiShiSet.size).toBeGreaterThan(1);
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
});
