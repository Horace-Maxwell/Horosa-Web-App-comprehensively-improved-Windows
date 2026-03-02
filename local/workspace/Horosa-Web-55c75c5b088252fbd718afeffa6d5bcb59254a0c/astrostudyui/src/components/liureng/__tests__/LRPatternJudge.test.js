import * as LRConst from '../LRConst';
import { evaluateLiuRengPatterns } from '../LRPatternJudge';

function makeLayout(mode){
	const downZi = LRConst.ZiList.slice(0);
	let upZi = [];
	if(mode === 'fuyin'){
		upZi = downZi.slice(0);
	}else if(mode === 'fanyin'){
		upZi = downZi.map((b)=>LRConst.ZiCong[b]);
	}else if(mode === 'shift2'){
		upZi = downZi.map((_, idx)=>downZi[(idx + 2) % 12]);
	}else if(mode === 'shift3'){
		upZi = downZi.map((_, idx)=>downZi[(idx + 3) % 12]);
	}else{
		upZi = downZi.map((_, idx)=>downZi[(idx + 1) % 12]);
	}
	return {
		downZi,
		upZi,
		houseTianJiang: LRConst.TianJiang.slice(0),
		yue: '子',
	};
}

function makeLiureng(dayGanZi){
	return {
		nongli: {
			dayGanZi,
			monthGanZi: '丙寅',
			yearGanZi: '乙巳',
			time: '丙子',
		},
		fourColumns: {
			year: '乙巳',
			month: '丙寅',
			day: dayGanZi,
			time: '丙子',
		},
		xun: {},
		gods: {},
		godsGan: {},
		godsMonth: {},
		godsZi: {},
		godsYear: {},
	};
}

function makeJudgeInput({ dayGanZi, mode, keRaw }){
	return {
		liureng: makeLiureng(dayGanZi || '甲子'),
		layout: makeLayout(mode || 'normal'),
		keRaw,
		sanChuan: {
			name: '',
			cuang: [],
			tianJiang: [],
		},
	};
}

describe('LRPatternJudge strict dage flow', ()=>{
	test('single 下克上 should map to 重审', ()=>{
		const keRaw = [
			['贵人', '戌', '甲'],
			['螣蛇', '巳', '寅'],
			['朱雀', '申', '辰'],
			['六合', '亥', '酉'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw }));
		expect(out.dageHits[0].name).toBe('重审');
	});

	test('single 上克下 should map to 元首', ()=>{
		const keRaw = [
			['贵人', '申', '甲'],
			['螣蛇', '巳', '寅'],
			['朱雀', '申', '辰'],
			['六合', '亥', '酉'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw }));
		expect(out.dageHits[0].name).toBe('元首');
	});

	test('multi 贼 with unique 比 should map to 知一', ()=>{
		const keRaw = [
			['贵人', '未', '甲'],
			['螣蛇', '戌', '寅'],
			['朱雀', '巳', '寅'],
			['六合', '亥', '酉'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw }));
		expect(out.dageHits[0].name).toBe('知一');
	});

	test('no near/no remote with 一三同课 should map to 帷簿（八专）', ()=>{
		const keRaw = [
			['贵人', '寅', '甲'],
			['螣蛇', '巳', '寅'],
			['朱雀', '寅', '子'],
			['六合', '午', '寅'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw }));
		expect(out.dageHits[0].name).toBe('帷簿');
	});

	test('伏吟 should map to 信任 even when near克 exists', ()=>{
		const keRaw = [
			['贵人', '戌', '甲'],
			['螣蛇', '巳', '寅'],
			['朱雀', '申', '辰'],
			['六合', '亥', '酉'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw, mode: 'fuyin' }));
		expect(out.dageHits[0].name).toBe('信任');
	});

	test('返吟 should map to 无依', ()=>{
		const keRaw = [
			['贵人', '巳', '甲'],
			['螣蛇', '寅', '巳'],
			['朱雀', '亥', '辰'],
			['六合', '卯', '亥'],
		];
		const out = evaluateLiuRengPatterns(makeJudgeInput({ keRaw, mode: 'fanyin' }));
		expect(out.dageHits[0].name).toBe('无依');
	});
});

describe('LRPatternJudge astronomy-dependent xiaoju flow', ()=>{
	test('二烦 requires sun/moon on 四仲 and 斗罡加丑未', ()=>{
		const input = makeJudgeInput({
			dayGanZi: '甲子',
			keRaw: [],
		});
		const chouIdx = input.layout.downZi.indexOf('丑');
		input.layout.upZi[chouIdx] = '辰';
		input.liureng.nongli.sunBranch = '子';
		input.liureng.nongli.moonBranch = '午';

		const out = evaluateLiuRengPatterns(input);
		expect(out.xiaojuNames).toContain('二烦');
	});

	test('二烦 should not hit when moon branch missing', ()=>{
		const input = makeJudgeInput({
			dayGanZi: '甲子',
			keRaw: [],
		});
		const chouIdx = input.layout.downZi.indexOf('丑');
		input.layout.upZi[chouIdx] = '辰';
		input.liureng.nongli.sunBranch = '子';
		input.liureng.nongli.moonBranch = '';

		const out = evaluateLiuRengPatterns(input);
		expect(out.xiaojuNames).not.toContain('二烦');
	});

	test('天寇 requires 分至 and moon on 昨支(离神)', ()=>{
		const input = makeJudgeInput({
			dayGanZi: '甲子',
			keRaw: [],
		});
		input.liureng.nongli.jieqi = '春分';
		input.liureng.nongli.moonBranch = '亥';

		const out = evaluateLiuRengPatterns(input);
		expect(out.xiaojuNames).toContain('天寇');
	});
});

describe('LRPatternJudge missing-doc patterns coverage', ()=>{
	test('天合五分型 should be identifiable by gan pairs', ()=>{
		const input = makeJudgeInput({
			dayGanZi: '甲子',
			keRaw: [
				['贵人', '甲', '己'],
				['螣蛇', '巳', '寅'],
				['朱雀', '申', '辰'],
				['六合', '亥', '酉'],
			],
		});
		input.sanChuan.cuang = ['甲子', '己丑', '丙寅'];
		const out = evaluateLiuRengPatterns(input);
		expect(out.xiaojuNames).toContain('甲己');
		expect(out.xiaojuNames).toContain('天合局');
	});

	test('宫时 should detect 绛宫时/玉堂时/明堂时 by up-down MengZhongJi mapping', ()=>{
		const jiang = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'normal', keRaw: [] }));
		expect(jiang.xiaojuNames).toContain('绛宫时');

		const yu = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'shift2', keRaw: [] }));
		expect(yu.xiaojuNames).toContain('玉堂时');

		const ming = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'shift3', keRaw: [] }));
		expect(ming.xiaojuNames).toContain('明堂时');
	});

	test('北斗 should detect 斗孟/斗仲/斗季 by where 辰 lands on down plate', ()=>{
		const douZhong = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'normal', keRaw: [] }));
		expect(douZhong.xiaojuNames).toContain('斗仲');

		const douMeng = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'shift2', keRaw: [] }));
		expect(douMeng.xiaojuNames).toContain('斗孟');

		const douJi = evaluateLiuRengPatterns(makeJudgeInput({ dayGanZi: '甲子', mode: 'shift3', keRaw: [] }));
		expect(douJi.xiaojuNames).toContain('斗季');
	});
});
