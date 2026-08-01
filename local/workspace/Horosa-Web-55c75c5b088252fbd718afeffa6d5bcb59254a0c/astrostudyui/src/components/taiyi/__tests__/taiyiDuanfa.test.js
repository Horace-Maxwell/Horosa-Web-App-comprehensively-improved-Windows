import { computeGeju } from '../core/taiyiGeju';
import { suanFrom, computeShenSuan, computeFenye, computeVictory, computeTaisuiAlias, activeDoorJixiong, computeEhui, shenMeaning, computeSanyuan, computeShiJing, computeWuziyuan, computeHeShen, LIUHE } from '../core/taiyiDuanfa';

describe('太乙 格局(§14)', () => {
	const base = { taiyiPalace: '艮', taiyiNum: 3, skyeyes: '子', sf: '午', homeGeneral: 5, awayGeneral: 5 };
	test('掩:文昌与太乙同落点', () => {
		const g = computeGeju({ ...base, skyeyes: '艮' });
		expect(g.some((x) => x.kind === 'yan' && x.name.includes('文昌'))).toBe(true);
	});
	test('掩:始击与太乙同落点', () => {
		const g = computeGeju({ ...base, sf: '艮' });
		expect(g.some((x) => x.kind === 'yan' && x.name.includes('始击'))).toBe(true);
	});
	test('囚:主大将宫=太乙宫', () => {
		const g = computeGeju({ ...base, homeGeneral: 3 });
		expect(g.some((x) => x.kind === 'qiu')).toBe(true);
	});
	test('格:主大将宫=太乙对冲宫(3↔6)', () => {
		const g = computeGeju({ ...base, homeGeneral: 6 });
		expect(g.some((x) => x.kind === 'ge')).toBe(true);
	});
	test('对:太乙与始击隔宫相对(艮idx2↔坤idx10)', () => {
		const g = computeGeju({ ...base, sf: '坤' });
		expect(g.some((x) => x.kind === 'dui')).toBe(true);
	});
	test('无格局返回空数组', () => {
		expect(computeGeju({ ...base, skyeyes: '卯', sf: '酉', homeGeneral: 4, awayGeneral: 7 })).toEqual([]);
	});
	// —— 补九式 提/挟/关/击 ——
	test('挟:文昌始击分居太乙两侧相邻间神(艮idx2 → 丑idx1/寅idx3)', () => {
		const g = computeGeju({ ...base, skyeyes: '丑', sf: '寅' });
		expect(g.some((x) => x.kind === 'xie')).toBe(true);
	});
	test('提:二目与太乙同象限(子idx0/寅idx3/艮idx2 皆象限0)且主客大将在正宫', () => {
		const g = computeGeju({ ...base, skyeyes: '子', sf: '寅', homeGeneral: 4, awayGeneral: 7 });
		expect(g.some((x) => x.kind === 'ti')).toBe(true);
	});
	test('关:主客算皆长(≥11)且同和数(12/16)', () => {
		const g = computeGeju({ ...base, homeCal: 12, awayCal: 16 });
		expect(g.some((x) => x.kind === 'guan')).toBe(true);
	});
	test('击:始击(午·宫2)与主大将同宫(2)', () => {
		const g = computeGeju({ ...base, sf: '午', homeGeneral: 2 });
		expect(g.some((x) => x.kind === 'ji')).toBe(true);
	});
	test('提/挟/关/击 在无格局态不误报(与5式空数组同基)', () => {
		const g = computeGeju({ ...base, skyeyes: '卯', sf: '酉', homeGeneral: 4, awayGeneral: 7 });
		expect(g.some((x) => ['ti', 'xie', 'guan', 'ji'].includes(x.kind))).toBe(false);
	});
});

describe('太乙 诸神之算 几何法 suanFrom(§28)', () => {
	test('子→艮 = 8(单跳)', () => { expect(suanFrom('子', '艮')).toBe(8); });
	test('卯→艮 = 37(绕环)', () => { expect(suanFrom('卯', '艮')).toBe(37); });
	test('间神起点(丑)取后一正宫+base1,不抛', () => { expect(typeof suanFrom('丑', '艮')).toBe('number'); });
	test('无效输入返回 null', () => { expect(suanFrom('', '艮')).toBeNull(); expect(suanFrom('子', '')).toBeNull(); });
	test('computeShenSuan 五算齐出带数理', () => {
		const r = computeShenSuan({ taiyiPalace: '艮', taiyiNum: 3, wufuNum: 9, kingbase: '巳', officerbase: '子', pplbase: '巳', sf: '午' });
		expect(r['君基算']).toHaveProperty('value');
		expect(r['君基算']).toHaveProperty('tags');
		expect(r['五福算'].value).toBeGreaterThan(0);
		expect(r['始击算'].value).toBeGreaterThan(0);
	});
});

describe('太乙 分野/胜负/古名', () => {
	test('分野:太乙临3艮→青州·和', () => {
		const f = computeFenye({ taiyiNum: 3, taiyiPalace: '艮', sf: '午' });
		expect(f.taiyi.zhou).toBe('青州');
		expect(f.taiyi.qi).toBe('和');
		expect(f.shiji.zhou).toBe('荆州'); // 午=离2=荆州
	});
	test('胜负:主算>客算→主胜', () => {
		const v = computeVictory({ homeCal: 33, awayCal: 22, taiyiNum: 3 }, []);
		expect(v.side).toBe('主胜');
		expect(v.reasons.length).toBeGreaterThanOrEqual(1);
	});
	test('胜负:客算>主算→客胜', () => {
		expect(computeVictory({ homeCal: 12, awayCal: 26, taiyiNum: 3 }, []).side).toBe('客胜');
	});
	test('胜负:相等→势均', () => {
		expect(computeVictory({ homeCal: 16, awayCal: 16, taiyiNum: 3 }, []).side).toBe('势均');
	});
	test('太岁古名:丙午→柔兆敦牂', () => {
		expect(computeTaisuiAlias({ ganzhi: { year: '丙午' } })).toBe('柔兆敦牂');
	});
	test('太岁古名:甲寅→阏逢摄提格', () => {
		expect(computeTaisuiAlias({ ganzhi: { year: '甲寅' } })).toBe('阏逢摄提格');
	});
});

describe('太乙 八门吉凶 / 厄会', () => {
	test('值使门吉凶:開門→大吉、死門→大凶', () => {
		expect(activeDoorJixiong({ eightDoorDuty: '開門值事' })).toEqual({ door: '开', jixiong: '大吉' });
		expect(activeDoorJixiong({ eightDoorDuty: '死門當值' })).toEqual({ door: '死', jixiong: '大凶' });
		expect(activeDoorJixiong({ eightDoorDuty: '' })).toBeNull();
	});
	test('厄会:主算33重阳厄/客算22重阴厄/定算5无门厄', () => {
		const e = computeEhui({ taiyiPalace: '艮', homeCal: 33, awayCal: 22, setCal: 5 });
		expect(e).toEqual(expect.arrayContaining(['主算重阳厄(33)', '客算重阴厄(22)', '定算无门厄(5)']));
	});
	test('厄会:无厄会→空数组', () => {
		expect(computeEhui({ taiyiPalace: '艮', homeCal: 16, awayCal: 12, setCal: 8 })).toEqual([]);
	});
});

describe('太乙 十六神主事(§8.2)/ 三元(§3.1)', () => {
	test('十六神主事:子=动摇言语、巽=申命号令、坤=刑罚', () => {
		expect(shenMeaning('子')).toBe('动摇·言语');
		expect(shenMeaning('巽')).toBe('申命·号令');
		expect(shenMeaning('坤')).toBe('刑罚');
		expect(shenMeaning('未')).toBe('阴私');
		expect(shenMeaning('')).toBe('');
	});
	test('三元:一/四纪上元、二/五纪中元、三/六纪下元', () => {
		expect(computeSanyuan({ jiyuan: '第一纪甲子元' })).toBe('上元');
		expect(computeSanyuan({ jiyuan: '第一紀甲子元' })).toBe('上元'); // 繁体「紀」(后端真实格式)
		expect(computeSanyuan({ jiyuan: '第二纪某元' })).toBe('中元');
		expect(computeSanyuan({ jiyuan: '第三纪某元' })).toBe('下元');
		expect(computeSanyuan({ jiyuan: '第四纪某元' })).toBe('上元');
		expect(computeSanyuan({ jiyuan: '' })).toBe('');
	});
});

describe('太乙 十精/五子元/六合(§3.2/§10)', () => {
	const pan = {
		skyeyes: '申', sf: '艮', jigod: '申',
		homeGeneral: 6, homeGeneralPalace: '酉', homeVGen: 8, homeVGenPalace: '子',
		awayGeneral: 4, awayGeneralPalace: '卯', awayVGen: 2, awayVGenPalace: '午',
		kingbase: '巳', officerbase: '子', pplbase: '巳', hegod: '未', accNum: 10155943,
	};
	test('十精:今义 10 项(二目+八将)有序,含落点/宫', () => {
		const r = computeShiJing(pan);
		expect(r).toHaveLength(10);
		expect(r.map((x) => x.name)).toEqual(['文昌', '始击', '计神', '主大将', '主参将', '客大将', '客参将', '君基', '臣基', '民基']);
		expect(r[0]).toMatchObject({ name: '文昌', at: '申' });
		expect(r[3].at).toBe('酉(6宫)');       // 主大将=酉·6宫
		expect(computeShiJing(null)).toBeNull();
	});
	test('五子元:(积年%360)//72 → 五元之一', () => {
		// 10155943 % 360 = 343 → 343//72 = 4 → 壬子元
		expect(computeWuziyuan(pan)).toBe('壬子元');
		expect(computeWuziyuan({ accNum: 0 })).toBe('');
		expect(computeWuziyuan({ accNum: 72 })).toBe('丙子元');   // 72//72=1
	});
	test('六合表 + 合神六合', () => {
		expect(LIUHE['子']).toBe('丑');
		expect(LIUHE['午']).toBe('未');
		expect(computeHeShen(pan)).toMatchObject({ hegod: '未', he: '午' });
		expect(computeHeShen({})).toBeNull();
	});
});
