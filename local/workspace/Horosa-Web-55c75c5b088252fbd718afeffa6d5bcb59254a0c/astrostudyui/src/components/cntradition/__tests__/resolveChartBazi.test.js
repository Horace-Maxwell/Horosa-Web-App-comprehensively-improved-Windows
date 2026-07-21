import { resolveChartBazi } from '../BaZi';

// 🔴 全年份域金标(前端·细盘大运/流年列补源)。真机症:极端年份(BC/lunar-js 域外)八字细盘
// 「大运」「流年」两列内容空——core 走 Java /bazi/birth 无 direction,细盘 getCurrentDirection(rec.direction)
// 拿不到大运块。resolveChartBazi 在此时把独立 /bazi/direct(directBazi)的 direction 合入喂细盘的 rec;
// 可靠年 core 自带 direction → 返回原 core 引用(字节零回归)。
describe('resolveChartBazi · 细盘 direction 补源', () => {
	const directBazi = {
		direction: [{ startYear: -12025, mainDirect: { ganzi: '辛巳' }, subDirect: [{ ganzi: '乙未' }] }],
		directTime: '-12025-08-01 10:30:00',
		smallDirection: [{ ganzi: '丙申' }],
	};

	test('🔴 BC/域外:core 无 direction → 合入 directBazi 的 direction/directTime/smallDirection', () => {
		const core = { fourColumns: {}, nongli: { year: '乙未' } }; // Java /bazi/birth core:无 direction
		const out = resolveChartBazi(core, directBazi);
		expect(Array.isArray(out.direction)).toBe(true);
		expect(out.direction.length).toBe(1);
		expect(out.direction[0].mainDirect.ganzi).toBe('辛巳');
		expect(out.directTime).toBe('-12025-08-01 10:30:00');
		expect(out.smallDirection.length).toBe(1);
		expect(out.nongli.year).toBe('乙未'); // core 其余字段保真
	});

	test('可靠年:core 自带 direction → 返回原 core 引用(零回归,不被 directBazi 覆盖)', () => {
		const localDir = [{ startYear: 2020, mainDirect: { ganzi: '甲子' }, subDirect: [{ ganzi: '庚子' }] }];
		const core = { direction: localDir, directTime: '2020-01-01 00:00:00', nongli: {} };
		const out = resolveChartBazi(core, directBazi);
		expect(out).toBe(core); // 同一引用,未复制未覆盖
		expect(out.direction[0].mainDirect.ganzi).toBe('甲子');
	});

	test('directBazi 尚未加载(null/空 direction):返回原 core,绝不抛', () => {
		const core = { nongli: {} };
		expect(resolveChartBazi(core, null)).toBe(core);
		expect(resolveChartBazi(core, { direction: [] })).toBe(core);
		expect(resolveChartBazi(core, {})).toBe(core);
	});

	test('core 为 null/undefined:优雅返回空对象,绝不抛', () => {
		expect(resolveChartBazi(null, null)).toEqual({});
		expect(resolveChartBazi(undefined, directBazi).direction[0].mainDirect.ganzi).toBe('辛巳');
	});
});
