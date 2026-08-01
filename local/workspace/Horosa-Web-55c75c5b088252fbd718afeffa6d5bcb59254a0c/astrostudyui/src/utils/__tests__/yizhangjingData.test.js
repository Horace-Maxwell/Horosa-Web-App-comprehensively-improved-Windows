// 一掌经·数据表条目数守卫(WP-A):程序化生成的 12 新表 + 逐星 jingyue/nianyun + 时组诗,
// 条目数达标即证生成完整(防手抄漏条/脚本回退)。断语内容为公有领域术数通则。
import DATA from '../data/yizhangjingData.json';
import LORE from '../data/yizhangjingLore.json';

const STARS = ['天貴', '天厄', '天權', '天破', '天奸', '天文', '天福', '天驛', '天孤', '天刃', '天藝', '天壽'];

describe('一掌经 数据表条目数(WP-A)', () => {
	test('逐星 经曰诗/年上运程 各 12 条齐', () => {
		STARS.forEach((s) => {
			expect(typeof DATA.data[s].jingyue).toBe('string');
			expect(DATA.data[s].jingyue.length).toBeGreaterThan(8);
			expect(typeof DATA.data[s].nianyun).toBe('string');
			expect(DATA.data[s].nianyun.length).toBeGreaterThan(8);
		});
	});
	test('位置速断 12×4(年/月/日/时)齐', () => {
		expect(Object.keys(DATA.posQuick)).toHaveLength(12);
		STARS.forEach((s) => {
			['nian', 'yue', 'ri', 'shi'].forEach((k) => expect(typeof DATA.posQuick[s][k]).toBe('string'));
		});
	});
	test('各柱逢星速断 ≥16 条,含 pillar/stars/text', () => {
		expect(DATA.pillarQuick.length).toBeGreaterThanOrEqual(16);
		DATA.pillarQuick.forEach((r) => { expect(r.pillar).toBeTruthy(); expect(Array.isArray(r.stars)).toBe(true); expect(r.text).toBeTruthy(); });
	});
	test('九品:星组合 9 品 + 孤克 3 格 + 定义版 9 品', () => {
		expect(DATA.ninePin.combo).toHaveLength(9);
		expect(DATA.ninePin.guke).toHaveLength(3);
		expect(DATA.ninePin.define).toHaveLength(9);
		// combo 每品 patterns 皆四星
		DATA.ninePin.combo.forEach((g) => g.patterns.forEach((p) => expect(p).toHaveLength(4)));
	});
	test('星组合互见 ≥15、刑害歌 12 支、六道 6 道、十二宫寓意 12、B套神 12、异名 12、时组诗 3', () => {
		expect(DATA.pairRule.length).toBeGreaterThanOrEqual(15);
		expect(Object.keys(DATA.branchHarm)).toHaveLength(12);
		expect(Object.keys(DATA.daoTraits)).toHaveLength(6);
		expect(Object.keys(DATA.palaceMeaning)).toHaveLength(12);
		expect(Object.keys(DATA.flowShenText)).toHaveLength(12);
		expect(Object.keys(DATA.starAlias)).toHaveLength(12);
		expect(Object.keys(LORE.poems.hourGroup)).toHaveLength(3);
	});
	test('异名 A/B/C 三系齐;C 系仅异名(卯=天赦/辰=天如/酉=天秘)', () => {
		Object.keys(DATA.starAlias).forEach((zhi) => {
			['A', 'B', 'C'].forEach((sys) => expect(typeof DATA.starAlias[zhi][sys]).toBe('string'));
		});
		expect(DATA.starAlias['卯'].C).toBe('天赦');
		expect(DATA.starAlias['辰'].B).toBe('天合');
		expect(DATA.starAlias['酉'].C).toBe('天秘');
	});
	test('六道·前世身份两条 + 共通特质', () => {
		Object.keys(DATA.daoTraits).forEach((dao) => {
			expect(DATA.daoTraits[dao].prevLife).toHaveLength(2);
			expect(DATA.daoTraits[dao].traits).toBeTruthy();
		});
	});
	test('B套十二神三列(吉凶/主疾病/主性格)齐', () => {
		Object.keys(DATA.flowShenText).forEach((shen) => {
			['ji', 'ill', 'character'].forEach((k) => expect(DATA.flowShenText[shen][k]).toBeTruthy());
		});
	});
});
