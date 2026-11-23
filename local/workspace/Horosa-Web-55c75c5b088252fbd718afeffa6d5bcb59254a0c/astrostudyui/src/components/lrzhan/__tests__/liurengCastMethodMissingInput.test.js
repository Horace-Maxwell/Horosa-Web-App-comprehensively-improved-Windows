// 六壬:所选起课法缺它要的输入(本命支 / 行年支 / 所选时辰 / 所报之数)时,盘其实没按所选法起 —— 快照「起课法」一行必须如实写。
// 此前标题照写所选法(外部智能体按起课时间起「本命加时」得到的是正时正将的盘,标题却是本命加时)。
import { computeQiXY, buildLiuRengCastOverride, liurengCastMethodMissingInput, QI_METHODS } from '../main/castLayout';
import { buildLiuRengSnapshotText } from '../main/snapshot';

// 太阳在天蝎 → 月将卯(getChartYue 读太阳所在座);四柱只给起课法用得到的那几项
const chartObj = { objects: [{ id: 'Sun', sign: 'Scorpio', lon: 231 }], nongli: { time: '甲子', dayGanZi: '甲辰', monthGanZi: '甲午', yearGanZi: '丙午' } };
const NEED = {
	bake9: ['本命支', { benmingZhi: '寅' }], bake11: ['本命支', { benmingZhi: '寅' }], bmjs: ['本命支', { benmingZhi: '寅' }],
	bake10: ['行年支', { xingnianZhi: '卯' }], bake12: ['行年支', { xingnianZhi: '卯' }], xnjs: ['行年支', { xingnianZhi: '卯' }],
	xuanshi: ['所选时辰', { xuanShiZhi: '酉' }], yanshu: ['所报之数', { yanShuNum: 7 }], baoshu: ['所报之数', { yanShuNum: '27' }],
};

describe('六壬起课法缺输入的判定(与 computeQiXY 同源)', ()=>{
	test('九档要输入的法:缺 = 报缺什么,给了 = 不报;其余各法恒不报', ()=>{
		QI_METHODS.forEach((m)=>{
			const need = NEED[m.key];
			if(!need){ expect(liurengCastMethodMissingInput(m.key, {})).toBe(''); return; }
			expect(liurengCastMethodMissingInput(m.key, {})).toBe(need[0]);
			expect(liurengCastMethodMissingInput(m.key, need[1])).toBe('');
		});
		// 登记的九档一档不少(法表增删时这里跟着红)
		expect(Object.keys(NEED).filter((k)=>QI_METHODS.some((m)=>m.key === k)).length).toBe(9);
	});
	test('给的不是十二支 / 不是数 = 缺', ()=>{
		expect(liurengCastMethodMissingInput('bmjs', { benmingZhi: '甲' })).toBe('本命支');
		expect(liurengCastMethodMissingInput('xuanshi', { xuanShiZhi: 'x' })).toBe('所选时辰');
		expect(liurengCastMethodMissingInput('baoshu', { yanShuNum: 'abc' })).toBe('所报之数');
		expect(liurengCastMethodMissingInput('yanshu', { yanShuNum: 0 })).toBe('');
	});
	test('判「缺」的每一档,盘确实没按所选输入起(给与不给两次的天盘起支 / 地盘临位不同或缺的那支为空)', ()=>{
		Object.keys(NEED).forEach((k)=>{
			const none = computeQiXY(k, chartObj, '申', {});
			const full = computeQiXY(k, chartObj, '申', NEED[k][1]);
			const noneOv = buildLiuRengCastOverride(chartObj, { castMethod: k });
			const fullOv = buildLiuRengCastOverride(chartObj, { castMethod: k, ...NEED[k][1] });
			expect(noneOv && noneOv.yue && noneOv.timeZhi).toBeTruthy();   // 缺输入盘也起得出来(所以才必须标注)
			expect(`${none.X}${none.Y}` !== `${full.X}${full.Y}` || `${noneOv.yue}${noneOv.timeZhi}` !== `${fullOv.yue}${fullOv.timeZhi}`).toBe(true);
		});
	});
});

describe('快照「起课法」一行如实标注', ()=>{
	const liureng = { nongli: chartObj.nongli };
	const lineOf = (opts)=>{
		let text = '';
		try{ text = buildLiuRengSnapshotText({ date: '2026-11-13', time: '10:24:00', zone: '+08:00', lon: '116e23', lat: '39n54' }, liureng, null, chartObj, 2, '木', 1, opts) || ''; }catch(e){ text = `THROW:${e && e.message}`; }
		return (text.split('\n').find((l)=>l.indexOf('起课法：') === 0) || text.slice(0, 120));
	};
	test('缺本命支:写明未生效与实际所用两支;给了本命支:只写法名', ()=>{
		expect(lineOf({ castMethod: 'bmjs' })).toMatch(/^起课法：本命加时（缺本命支，此法未生效；实际按「.加.」起）$/);
		expect(lineOf({ castMethod: 'bmjs', benmingZhi: '寅' })).toBe('起课法：本命加时');
	});
	test('正时正将与不要输入的法:原样只写法名(字节级不变)', ()=>{
		expect(lineOf({})).toBe(`起课法：${QI_METHODS[0].name}`);
		expect(lineOf({ castMethod: 'tsjs' })).toBe(`起课法：${QI_METHODS.find((m)=>m.key === 'tsjs').name}`);
	});
	test('报数没给数:标注;给了数:法名 + 报数行照旧', ()=>{
		expect(lineOf({ castMethod: 'baoshu' })).toMatch(/缺所报之数，此法未生效/);
		expect(lineOf({ castMethod: 'baoshu', yanShuNum: 27 })).toBe(`起课法：${QI_METHODS.find((m)=>m.key === 'baoshu').name}`);
	});
});
