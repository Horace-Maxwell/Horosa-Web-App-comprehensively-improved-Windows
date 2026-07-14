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

	test('空参返回空串', () => {
		expect(buildTongshuSnapshotText(null, null)).toBe('');
	});
});
