// 一掌经 WP-H 流派预设 × golden 生辰锁定：5 预设 × 4 生辰 = 20 盘。
// 证明：①每盘结构完整+快照非空+确定性 ②预设真联动（跨预设产出确有差异=非死开关）
// ③品级变体真改九品/命格。预设→opts 经 YZJ_STATE_TO_OPT 映射（与 buildYizhangjingOpts 同源）。
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from '../yizhangjingReport';
import { YZJ_PRESETS, YZJ_STATE_TO_OPT } from '../../components/kinastro/KinAstroMain';

const PRESETS = ['guben', 'michuan', 'define', 'chuangong', 'tongxing'];

// 4 golden 生辰夹具（年支/月/日/时支/性别，构造合成 bazi）
const BIRTHS = [
	{ nongli: { yearGZByLunar: '丁巳', shengXiaoLunar: '蛇', monthNum: 5, dayNum: 17, leap: false, clockTime: '1977-06-01 17:30:00' }, fourColumns: { time: { ganzi: '己酉' }, month: { ganzi: '丙午' }, day: { ganzi: '戊申' }, year: { ganzi: '丁巳' } }, gender: 'Male' },
	{ nongli: { yearGZByLunar: '庚子', shengXiaoLunar: '鼠', monthNum: 1, dayNum: 9, leap: false, clockTime: '1960-02-06 18:00:00' }, fourColumns: { time: { ganzi: '乙酉' }, day: { ganzi: '甲子' }, month: { ganzi: '戊寅' }, year: { ganzi: '庚子' } }, gender: 'Male' },
	{ nongli: { yearGZByLunar: '甲午', shengXiaoLunar: '马', monthNum: 8, dayNum: 22, leap: false, clockTime: '2014-09-15 03:20:00' }, fourColumns: { time: { ganzi: '丙寅' }, day: { ganzi: '庚辰' }, month: { ganzi: '癸酉' }, year: { ganzi: '甲午' } }, gender: 'Female' },
	{ nongli: { yearGZByLunar: '辛未', shengXiaoLunar: '羊', monthNum: 11, dayNum: 3, leap: false, clockTime: '1991-12-08 09:00:00' }, fourColumns: { time: { ganzi: '癸巳' }, day: { ganzi: '丁丑' }, month: { ganzi: '庚子' }, year: { ganzi: '辛未' } }, gender: 'Female' },
];

// 预设 → opts（与 KinAstroMain.buildYizhangjingOpts 同映射；DayunLen 转数）
function presetToOpts(key) {
	const p = YZJ_PRESETS[key];
	const opts = {};
	Object.keys(YZJ_STATE_TO_OPT).forEach((f) => {
		let v = p[f];
		if (f === 'DayunLen') v = parseInt(v, 10);
		opts[YZJ_STATE_TO_OPT[f]] = v;
	});
	return opts;
}

describe('一掌经 WP-H 流派预设 × golden 锁定（20 盘）', () => {
	test('20 盘各结构完整 + 快照非空 + 确定性', () => {
		PRESETS.forEach((key) => {
			const opts = presetToOpts(key);
			BIRTHS.forEach((bz, bi) => {
				const m = buildYizhangjingModel(bz, opts);
				expect(m).toBeTruthy();
				expect(m.chart.pillars).toHaveLength(4);
				expect(m.chart.mingStar).toBeTruthy();
				expect(m.renshi).toHaveLength(12);
				expect(m.sishi.rows).toHaveLength(4);
				const snap = buildYizhangjingSnapshotText(m);
				expect(snap.length).toBeGreaterThan(200);
				// 确定性：同预设同生辰二次一致
				const m2 = buildYizhangjingModel(bz, presetToOpts(key));
				expect(buildYizhangjingSnapshotText(m2)).toBe(snap);
			});
		});
	});
	test('预设真联动：逐年法/大限运长跨预设产出确有差异（非死开关）', () => {
		const bz = BIRTHS[0];
		// michuan(小限·7年) vs define(流年·10年) → 快照必不同
		const sMi = buildYizhangjingSnapshotText(buildYizhangjingModel(bz, presetToOpts('michuan')));
		const sDef = buildYizhangjingSnapshotText(buildYizhangjingModel(bz, presetToOpts('define')));
		expect(sMi).not.toBe(sDef);
		// define 走流年 → 无小限行；michuan 走小限 → 有小限
		expect(sMi).toMatch(/小限一宫一年/);
		expect(sDef).not.toMatch(/小限一宫一年/);
		expect(sDef).toMatch(/流年十二神/);
	});
	test('品级变体（define 未变体、单独 variant）真改九品/命格', () => {
		const bz = BIRTHS[2];
		const std = buildYizhangjingModel(bz, { gradeSet: 'standard' });
		const vr = buildYizhangjingModel(bz, { gradeSet: 'variant' });
		// 变体口径下 gradeCount 或 nineGradeExact 至少一处随天驿归属变化（若该盘含天驿）
		const hasTianYi = std.chart.pillars.some((p) => p.star === '天驛');
		if (hasTianYi) {
			expect(JSON.stringify(std.chart.gradeCount)).not.toBe(JSON.stringify(vr.chart.gradeCount));
		} else {
			// 不含天驿则字节不变（变体只动天驿）
			expect(std.chart.fourPalaceRank).toBe(vr.chart.fourPalaceRank);
		}
	});
});
