jest.mock('../../utils/helper', ()=>({
	randomStr: ()=> 'mocked',
}));

import ChuangChart from './ChuangChart';

function buildChart(){
	const upZi = ['未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午'];
	const downZi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const ke = [
		['玄武', '申', '癸'],
		['朱雀', '卯', '申'],
		['玄武', '申', '丑'],
		['朱雀', '卯', '申'],
	];
	return new ChuangChart({
		owner: null,
		chartObj: { nongli: { dayGanZi: '癸丑' } },
		nongli: { dayGanZi: '癸丑' },
		ke,
		liuRengChart: {
			upZi,
			downZi,
			houseTianJiang: new Array(12).fill('贵人'),
		},
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});
}

function buildChartForXun(){
	const upZi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const downZi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const chart = new ChuangChart({
		owner: null,
		chartObj: { nongli: { dayGanZi: '癸丑' } },
		nongli: { dayGanZi: '癸丑' },
		ke: [
			['贵人', '子', '癸'],
			['贵人', '丑', '子'],
			['贵人', '子', '丑'],
			['贵人', '丑', '子'],
		],
		liuRengChart: {
			upZi,
			downZi,
			houseTianJiang: new Array(12).fill('贵人'),
		},
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});
	chart.getSangCuang = ()=>({
		cuang: ['未', '子', '丑'],
		name: 'mock',
	});
	return chart;
}

// 八专(甲寅日,干支同位:甲寄寅=日支寅)+ 天盘=地盘+4(即 #46 的戌将午时课式)。
// 四课无近克,虽日干甲遥克 2/4 课上神戌(木克土),但课经明训:八专两课无克「不复取遥克」
// (遥者远也,干支同位无远可言)→ 正解为八专课(阳日干上神顺数三:午→申),而非弹射。
// 🔴 曾把九法列举序号误读为判定优先级、判成弹射并锁进金标(#46 实报),此例即纠正锚。
function buildChartBaZhuanYaoKe(){
	const downZi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const upZi   = ['辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯'];
	const ke = [
		['贵人', '午', '甲'],
		['贵人', '戌', '午'],
		['贵人', '午', '寅'],
		['贵人', '戌', '午'],
	];
	return new ChuangChart({
		owner: null,
		chartObj: { nongli: { dayGanZi: '甲寅' } },
		nongli: { dayGanZi: '甲寅' },
		ke,
		liuRengChart: {
			upZi,
			downZi,
			houseTianJiang: new Array(12).fill('贵人'),
		},
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});
}

describe('ChuangChart', ()=>{
	it('counts duplicated 贼课 as one课 and sets 初传 to 卯', ()=>{
		const chart = buildChart();
		const sangCuang = chart.getSangCuang();
		expect(sangCuang.cuang[0]).toBe('卯');

		chart.genCuangs();
		expect(chart.cuangs.cuang[0]).toBe('空卯');
	});

	it('maps 甲辰旬 branch 未 to 丁未 instead of 己未', ()=>{
		const chart = buildChartForXun();
		chart.genCuangs();
		expect(chart.cuangs.cuang[0]).toBe('丁未');
	});

	it('八专两课无近克时不复取遥克:甲寅日天盘+4 → 八专课 申午午(#46)', ()=>{
		const chart = buildChartBaZhuanYaoKe();
		const sangCuang = chart.getSangCuang();
		expect(sangCuang.name).toBe('八专课');
		expect(sangCuang.cuang).toEqual(['申', '午', '午']);
	});

	// #62:伏吟末传守卫四态直检(含真实六十日不可达的「初子中卯」理论向,按明令全覆盖)。
	it('伏吟末传守卫:初中子卯互刑取冲(卯子→午/子卯→酉),非环透传与自刑取冲不变', ()=>{
		const chart = buildChart();
		expect(chart.getFuYinLastCuang('卯', '子')).toBe('午');   // #62 实病向:末传由卯勘正为午
		expect(chart.getFuYinLastCuang('子', '卯')).toBe('酉');   // 理论反向(六十日不可达)亦守
		expect(chart.getFuYinLastCuang('亥', '子')).toBe('卯');   // 中子而初非卯:正常刑链透传
		expect(chart.getFuYinLastCuang('丑', '戌')).toBe('未');   // 三环刑链透传不变
		expect(chart.getFuYinLastCuang('巳', '午')).toBe('子');   // 中传自刑(午)仍取冲——原规则
	});
});

// 次客已改为「筹支加时」起课法(自月将算筹支→加时重排上下盘),逻辑移到 LiuRengMain.liurengChouBranch;
// 三传由 ChuangChart 在新天盘上正常发用,不再由 ChuangChart 改写。筹支算法测试见 lrzhan/__tests__/liurengCike.test.js。
