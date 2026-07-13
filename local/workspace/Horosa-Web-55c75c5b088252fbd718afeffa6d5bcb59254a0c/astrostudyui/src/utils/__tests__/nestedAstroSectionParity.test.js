// [MU parity] 嵌套 astro 盘体 Type-B 防回归:合盘[合成图盘]/节气[X3D盘] 下嵌入 buildAstroSnapshotContent
// 的 [起盘信息]…[可能性] 子段头,会被 splitContentSections 当顶层段拆出 → 自定义过父技法段的用户按
// 父段名过滤会把盘体删净只剩空壳头。根治=嵌入调用传 {headerless:true},子段头转 `· X` 标签收进父段原子。
// 同轮修 suzhan 遁甲外盘不再污染共享 'qimen' 槽(buildQimenSnapshotText 已删)。
import fs from 'fs';
import { buildAstroSnapshotContent } from '../astroAiSnapshot';

const CHART = {
	chart: {
		objects: [{ name: '太阳', signlon: 15, sign: '狮子', house: 5 }],
		houses: [{ index: 1, sign: '白羊', lon: 0 }],
		aspects: [],
	},
	params: { birth: '1990-06-15 14:30', zone: '+08:00' },
};

describe('[MU] buildAstroSnapshotContent headerless 模式', () => {
	test('默认(无 headerless)产方括号段头 [起盘信息](零回归)', () => {
		const out = buildAstroSnapshotContent(CHART, null);
		expect(out).toMatch(/^\[起盘信息\]$/m);
	});
	test('headerless:true → 段头转 `· 起盘信息` 标签,不再有整行 [起盘信息](收进父段原子)', () => {
		const out = buildAstroSnapshotContent(CHART, null, { headerless: true });
		expect(out).not.toMatch(/^\[起盘信息\]$/m);
		expect(out).toMatch(/^· 起盘信息$/m);
	});
	test('空盘 headerless 不抛、返回空', () => {
		expect(buildAstroSnapshotContent(null, null, { headerless: true })).toBe('');
	});
});

describe('[MU] relative/jieqi 嵌入调用传 headerless(源扫防回退)', () => {
	test('AstroRelative 三处 buildAstroSnapshotContent 调用均带 headerless:true', () => {
		const src = fs.readFileSync(require.resolve('../../components/astro/AstroRelative.js'), 'utf8');
		const calls = src.match(/buildAstroSnapshotContent\([^)]*\)/g) || [];
		expect(calls.length).toBeGreaterThanOrEqual(3);
		calls.forEach((c) => expect(c).toMatch(/headerless:\s*true/));
	});
	test('JieQiChartsMain 的 buildAstroSnapshotContent 调用带 headerless:true', () => {
		const src = fs.readFileSync(require.resolve('../../components/jieqi/JieQiChartsMain.js'), 'utf8').replace(/\0/g, '');
		const calls = src.match(/buildAstroSnapshotContent\([^)]*\)/g) || [];
		expect(calls.length).toBeGreaterThanOrEqual(1);
		calls.forEach((c) => expect(c).toMatch(/headerless:\s*true/));
	});
});

describe('[MU] suzhan 不污染共享 qimen 槽', () => {
	test('SuZhanMain 无「写 qimen 模块槽」的真实调用(注释提及不算)', () => {
		const src = fs.readFileSync(require.resolve('../../components/suzhan/SuZhanMain.js'), 'utf8').replace(/\0/g, '');
		// 真实调用形态(含回调箭头/参数),注释里的散文提及不会命中:
		expect(src).not.toMatch(/=>\s*buildQimenSnapshotText\(/);
		expect(src).not.toMatch(/saveModuleAISnapshotLazy\('qimen',\s/);
		expect(src).not.toMatch(/saveModuleAISnapshot\('qimen',\s/);
		// buildQimenSnapshotText 函数定义也应已删(function 声明形态):
		expect(src).not.toMatch(/function\s+buildQimenSnapshotText/);
	});
});
