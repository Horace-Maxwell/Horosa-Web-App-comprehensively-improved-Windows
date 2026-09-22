// 通书择日 AI 快照 builder（董公）。控件含 DateTimeSelector（内部组件走自动 JSX 运行时，
// jest classic runtime SSR 会 React undefined，非本模块问题）→ 控件渲染由 preview E2E 验，此处只测引擎/快照。
import { buildTongshuSnapshotText } from '../tongshuSnapshot';
import { DEFAULT_TONGSHU_SETTINGS } from '../tongshuSchools';

describe('通书择日 AI 快照 · 董公', () => {
	const text = buildTongshuSnapshotText({ ...DEFAULT_TONGSHU_SETTINGS, school: 'donggong', event: '嫁娶' }, '2026-07-13');

	test('含分区段头与董公真值', () => {
		expect(text).toContain('[通书择日]');
		expect(text).toContain('流派：董公择日');
		expect(text).toContain('六月·执子日');
		expect(text).toContain('董公断语：');
		expect(text).toContain('三煞方：西');
	});

	test('未实现流派回落占位不抛', () => {
		const t = buildTongshuSnapshotText({ ...DEFAULT_TONGSHU_SETTINGS, school: 'wutu' }, '2026-07-13');
		expect(t).toContain('流派：天元乌兔');
	});

	test('[Q-271/ZC-28] 用事行只对声明 needs.event 的流派输出;出厂设置与缓存键无 zuoShan 幽灵', () => {
		expect(text).toContain('用事：嫁娶');
		['qimen', 'sanyuanliexiu', 'wutu', 'sanyuan'].forEach((school) => {
			expect(buildTongshuSnapshotText({ ...DEFAULT_TONGSHU_SETTINGS, school }, '2026-07-13')).not.toContain('用事：');
		});
		expect(DEFAULT_TONGSHU_SETTINGS.zuoShan).toBeUndefined();
		const { getTongshuOptionsKey } = require('../tongshuSchools');
		expect(getTongshuOptionsKey(DEFAULT_TONGSHU_SETTINGS)).toBe('donggong|嫁娶|建宅|甲子|');   // 五段:school|event|liexiuUse|mingYear|date(无 zuoShan 段)
	});

	test('空参返回空串', () => {
		expect(buildTongshuSnapshotText(null, null)).toBe('');
	});
});
