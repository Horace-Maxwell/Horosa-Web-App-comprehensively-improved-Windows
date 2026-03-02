import { buildJinKouData, calcJinKouWangElem, buildJinKouWangShuaiMap } from './JinKouCalc';

function mockLiuReng(data){
	return {
		nongli: {
			dayGanZi: '甲辰',
			time: '申时',
			monthGanZi: '丙申',
			...(data && data.nongli ? data.nongli : {}),
		},
		fourColumns: {
			month: { ganzi: '丙申' },
			...(data && data.fourColumns ? data.fourColumns : {}),
		},
		xun: {
			'旬空': '寅卯',
			'旬首': '甲辰',
			...(data && data.xun ? data.xun : {}),
		},
		season: {
			'金': '囚',
			'木': '旺',
			'水': '休',
			'火': '相',
			'土': '死',
			...(data && data.season ? data.season : {}),
		},
		gods: data && data.gods ? data.gods : {},
		godsGan: data && data.godsGan ? data.godsGan : {},
		godsMonth: data && data.godsMonth ? data.godsMonth : {},
		godsZi: data && data.godsZi ? data.godsZi : {},
		godsYear: data && data.godsYear ? data.godsYear : { taisui1: {} },
	};
}

describe('JinKouCalc', ()=>{
	it('matches textbook sample for 甲日申时 with 地分午', ()=>{
		const data = buildJinKouData(mockLiuReng(), {
			diFen: '午',
			guirengType: 0,
		});
		expect(data.ready).toBe(true);
		expect(data.diFen).toBe('午');
		expect(data.renYuanGan).toBe('庚');
		expect(data.guiName).toBe('青龙');
		expect(data.guiZi).toBe('寅');
		expect(data.jiangZi).toBe('卯');
		expect(data.jiangName).toBe('太冲');
	});

	it('matches textbook table for 甲日申时 with 地分子', ()=>{
		const data = buildJinKouData(mockLiuReng(), {
			diFen: '子',
			guirengType: 0,
		});
		expect(data.renYuanGan).toBe('甲');
		expect(data.guiZi).toBe('亥');
		expect(data.jiangZi).toBe('酉');
	});

	it('calculates 四大空亡 from 旬首', ()=>{
		const dataZi = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '戌亥',
				'旬首': '甲子',
			},
		}), {
			diFen: '子',
			guirengType: 0,
		});
		expect(dataZi.siDaKong).toBe('水');

		const dataWu = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '辰巳',
				'旬首': '甲午',
			},
		}), {
			diFen: '午',
			guirengType: 0,
		});
		expect(dataWu.siDaKong).toBe('水');

		const dataYin = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '子丑',
				'旬首': '甲寅',
			},
		}), {
			diFen: '寅',
			guirengType: 0,
		});
		expect(dataYin.siDaKong).toBe('金');

		const dataShen = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '午未',
				'旬首': '甲申',
			},
		}), {
			diFen: '申',
			guirengType: 0,
		});
		expect(dataShen.siDaKong).toBe('金');

		const dataOther = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '寅卯',
				'旬首': '甲辰',
			},
		}), {
			diFen: '辰',
			guirengType: 0,
		});
		expect(dataOther.siDaKong).toBe('');
	});

	it('calculates 旺 element by textbook rules', ()=>{
		expect(calcJinKouWangElem(['金', '木', '水', '火'])).toBe('水');
		expect(calcJinKouWangElem(['木', '火', '水', '土'])).toBe('木');
		expect(calcJinKouWangElem(['金', '木', '火', '土'])).toBe('火');
		expect(calcJinKouWangElem(['木', '木', '火', '火'])).toBe('火');
		expect(calcJinKouWangElem(['木', '木', '土', '土'])).toBe('木');
		expect(calcJinKouWangElem(['水', '水', '金', '金'])).toBe('水');
		expect(calcJinKouWangElem(['金', '金', '木', '水'])).toBe('金');
	});

	it('builds 旺相休囚死 map from 旺 element', ()=>{
		const map = buildJinKouWangShuaiMap('水');
		expect(map['水']).toBe('旺');
		expect(map['木']).toBe('相');
		expect(map['金']).toBe('休');
		expect(map['土']).toBe('囚');
		expect(map['火']).toBe('死');
	});
});
