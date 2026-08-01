// 一掌经 WP-F 流派预设映射守卫 + 逐年法互斥/显示层不改盘 判据。
// 从 KinAstroMain 导出的预设常量直验：5 预设 × 16 字段齐、键名合法、
// 显示层开关（星名/六道）不进盘算键、逐年法互斥字段成对。
import { YZJ_PRESETS, YZJ_PRESET_STATEMAP, YZJ_STATE_TO_OPT, YZJ_PRESET_LABELS } from '../KinAstroMain';

const PRESET_KEYS = ['guben', 'michuan', 'define', 'chuangong', 'tongxing'];

describe('一掌经 WP-F 流派预设映射', () => {
	test('5 预设齐，各含 16 字段（STATEMAP 全覆盖）', () => {
		expect(Object.keys(YZJ_PRESETS).sort()).toEqual(PRESET_KEYS.slice().sort());
		expect(YZJ_PRESET_STATEMAP).toHaveLength(16);
		PRESET_KEYS.forEach((k) => {
			YZJ_PRESET_STATEMAP.forEach((f) => {
				expect(YZJ_PRESETS[k]).toHaveProperty(f);
				expect(YZJ_PRESETS[k][f]).not.toBeUndefined();
			});
		});
	});
	test('每套预设名有标签', () => {
		PRESET_KEYS.forEach((k) => expect(typeof YZJ_PRESET_LABELS[k]).toBe('string'));
		expect(YZJ_PRESET_LABELS.custom).toBe('自定义');
	});
	test('闰月细则一律 half（零回归口径；夜半折半为手选变体不入预设）', () => {
		PRESET_KEYS.forEach((k) => expect(YZJ_PRESETS[k].LeapRule).toBe('half'));
	});
	test('预设表逐行取值符合流派对照（抽样锚点）', () => {
		// 秘传：阳男阴女·时上起命·7年·秘传起运·小限·随盘向·甲组
		expect(YZJ_PRESETS.michuan).toMatchObject({ Shunni: 'yangNanYinNv', MingGong: 'shiShang', DayunLen: '7', StartAge: 'mi', Annual: 'xiaoxian', XiaoDir: 'chart', FlowSet: 'A' });
		// 古本：男顺女逆·数至卯·10年·1岁·小限一律顺行
		expect(YZJ_PRESETS.guben).toMatchObject({ Shunni: 'menShunNvNi', MingGong: 'shuZhiMao', DayunLen: '10', StartAge: 'age1', XiaoDir: 'always' });
		// 定义版：流年·月柱小限·饿鬼道·异传·早子开·童限关
		expect(YZJ_PRESETS.define).toMatchObject({ Annual: 'liunian', XiaoStart: 'yue', DaoTerm: 'edao', Chongfan: 'beta', ZaoZi: true, Tongxian: false });
		// 串宫压运：乙组流年
		expect(YZJ_PRESETS.chuangong).toMatchObject({ Annual: 'liunian', FlowSet: 'B' });
	});
	test('STATE_TO_OPT：星名/六道/品级为显示层键，不落盘算主键（防误改盘）', () => {
		// 显示层三键映射到 opts 的显示键（starNaming/daoTerm/gradeSet），非四柱/命宫算法键
		expect(YZJ_STATE_TO_OPT.StarNaming).toBe('starNaming');
		expect(YZJ_STATE_TO_OPT.DaoTerm).toBe('daoTerm');
		expect(YZJ_STATE_TO_OPT.GradeSet).toBe('gradeSet');
		// 逐年法与小限方向成对可控
		expect(YZJ_STATE_TO_OPT.Annual).toBe('annualMethod');
		expect(YZJ_STATE_TO_OPT.XiaoDir).toBe('xiaoxianDir');
	});
	test('偏离计数逻辑：改一字段 → 1 项（模拟 yzjDeviationCount 纯算）', () => {
		const base = YZJ_PRESETS.michuan;
		const cur = { ...base, DayunLen: '10' }; // 改大限运长
		const dev = YZJ_PRESET_STATEMAP.filter((f) => cur[f] !== base[f]).length;
		expect(dev).toBe(1);
		const dev0 = YZJ_PRESET_STATEMAP.filter((f) => base[f] !== base[f]).length;
		expect(dev0).toBe(0);
	});
});
