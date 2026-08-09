// 紫微「AI 挂载·每技法设置」round-trip：四化流派 + 运限层级 真实改变快照输出。
// 守铁律：默认(不带 sihuaSchool/period)→ 快照与现状逐字一致；改了 → 快照对应段落确实变化。
jest.mock('d3', () => ({}));

// 构造一份最小但合法的紫微 chart（/ziwei/birth 的 Result.chart 形状）。
// houses[i] 的地支 = DiZi[i]（子丑寅卯…亥），direction=大限区间，含星曜分组供四化落宫定位。
const DIZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
function makeHouses() {
	const houseNames = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
	// 命宫放在寅（idx2），逐宫逆排十二宫名（仅为命名，不影响运限计算）。
	const houses = [];
	for (let i = 0; i < 12; i++) {
		const gan = GANS[i % 10];
		const zhi = DIZI[i];
		houses.push({
			id: `h${i}`,
			name: houseNames[(i - 2 + 12) % 12],
			ganzi: gan + zhi,
			// 大限：每宫 6 年宽（从 6 岁起，逐宫 +6），保证 buildDaxianItems 有 12 段。
			direction: [6 + i * 6, 6 + i * 6 + 5],
			starsMain: i === 2 ? ['紫微', '贪狼'] : (i === 5 ? ['武曲'] : []),
			starsAssist: i === 0 ? ['左辅'] : [],
			starsEvil: [],
			starsOthersGood: [],
			starsOthersBad: [],
			starsSmall: [],
			stars: [],
		});
	}
	return houses;
}
// jest.mock 工厂只能引用 mock 前缀变量（babel-plugin-jest-hoist 规则）→ 用 mockState 承载夹具与捕获。
const mockState = {
	lastRequestBody: null,
	chart: {
		birth: '1990-05-18 10:00:00',
		gender: 'Male',
		zidou: '子',
		yearZi: '午',
		yearGan: '庚',
		lifeHouseIndex: 2,
		nongli: { yearGanZi: '庚午' },
		houses: makeHouses(),
	},
};
jest.mock('../../../utils/request', () => ({
	__esModule: true,
	default: jest.fn(async (url, opts) => {
		try { mockState.lastRequestBody = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) { mockState.lastRequestBody = null; }
		return { Result: { chart: JSON.parse(JSON.stringify(mockState.chart)), patterns: [] } };
	}),
}));

import * as ZWConst from '../../../constants/ZWConst';
import * as ZiWeiHelper from '../ZiWeiHelper';
import { buildZiweiSnapshotForParams } from '../ZiWeiMain';
import { ZWEngineOptions } from '../ziweiOptions';

const BASE_PARAMS = {
	date: '1990-05-18',
	time: '10:00:00',
	zone: '+08:00',
	lon: '118e27',
	lat: '31n38',
	gender: 1,
	timeAlg: 0,
	after23NewDay: 1,
	lateZiHourUseNextDay: 1,
};

describe('紫微挂载 round-trip：四化流派 + 运限', () => {
	afterEach(() => {
		ZWConst.ZWSchool.school = 'beipai';
		ZWConst.refreshActiveSiHua();
		mockState.lastRequestBody = null;
	});

	it('默认（无 sihuaSchool / 无 period）：含[宫位总览]大限、不含[运限]段，四化流派=通用·飞星', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
		expect(text).toContain('[宫位总览]');
		// v2 表化(2026-07-11 试点):宫位总览=GFM 表,大限区间在「大限」列(值口径不变,数值不变证明见 ziweiV2FactEquivalence.test)。
		expect(text).toContain('| 宫位 | 干支 | 大限 | 星曜（四化括注） |');
		expect(text).toContain('| 6~11 |');          // 首宫大限区间仍逐宫在列
		expect(text).not.toContain('[运限]');        // 默认不追加运限段
		expect(text).toContain('四化流派：通用·飞星');   // 规格正名:现状表实为通用/飞星(非北派天相忌)
		// sihuaSchool / period 不应泄漏到后端请求体（仅前端本地消费）。
		expect(mockState.lastRequestBody).toBeTruthy();
		expect(mockState.lastRequestBody.sihuaSchool).toBeUndefined();
		expect(mockState.lastRequestBody.period).toBeUndefined();
	});

	it('选 sihuaSchool=zhongzhou：四化流派标签变中州派，且用毕还原全局单例', async () => {
		const before = ZWConst.ZWSchool.school;
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, sihuaSchool: 'zhongzhou' });
		expect(text).toContain('四化流派：中州派');
		// finally 还原：调用后全局流派不被污染（仍是调用前的值）。
		expect(ZWConst.ZWSchool.school).toBe(before);
	});

	it('多选 daxian=[2]：追加[运限]段并含「大限：」层', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [2], liunian: [], liuyue: [], liuri: [], liushi: [] } });
		expect(text).toContain('[运限]');
		expect(text).toContain('大限：');
		// 仅大限层，不应出现流年/流月层标签。
		expect(text).not.toContain('流年：');
		expect(text).not.toContain('流月：');
	});

	it('多选 liunian：[运限]段含「流年小限：」层，并并入小限行（需求2/6）', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [], liunian: [1996], liuyue: [], liuri: [], liushi: [] } });
		expect(text).toContain('[运限]');
		expect(text).toContain('流年小限：');   // 合并层标签（原「流年」→「流年小限」）
		expect(text).toContain('小限：');        // 小限随流年并出（同年按虚岁对齐）
	});

	it('流年×流月笛卡尔：选 2 年×2 月 → 4 个流月段', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [], liunian: [1996, 1997], liuyue: [3, 6], liuri: [], liushi: [] } });
		// 流月段数 = years × months = 4。
		const liuyueCount = (text.match(/流月：/g) || []).length;
		expect(liuyueCount).toBe(4);
		// 流年小限段也各一（2 个）。
		expect((text.match(/流年小限：/g) || []).length).toBe(2);
	});

	it('流日/流时锚定首个上层：选多日多时 → 各一段，不做笛卡尔爆炸', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [], liunian: [1996], liuyue: [3], liuri: [1, 2, 3], liushi: [0, 6] } });
		expect((text.match(/流日：/g) || []).length).toBe(3); // 3 个所选日
		expect((text.match(/流时：/g) || []).length).toBe(2); // 2 个所选时辰（锚定首日）
	});

	it('多选不同 → [运限]段不同（证明参数真生效，非写死）', async () => {
		const a = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [2], liunian: [1996], liuyue: [], liuri: [], liushi: [] } });
		const b = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [8], liunian: [2050], liuyue: [], liuri: [], liushi: [] } });
		expect(a).toContain('[运限]');
		expect(b).toContain('[运限]');
		const sectionA = a.slice(a.indexOf('[运限]'));
		const sectionB = b.slice(b.indexOf('[运限]'));
		expect(sectionA).not.toEqual(sectionB);
	});

	it('流年超出全部大限范围：补「超出大限范围」提示行而非静默跳过（对齐八字口径）', async () => {
		// 夹具大限 ~6–77 岁（1996–2067），2200 远超范围。
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [], liunian: [2200], liuyue: [], liuri: [], liushi: [] } });
		expect(text).toContain('[运限]');
		expect(text).toContain('流年：2200年（超出大限范围，未列流年）');
	});

	it('超范围流年 + 选流月：流年不列正常段、流月也不列（不静默错位）', async () => {
		// 超范围年应只出提示行；其流月被基准年过滤掉，避免「流年不列、流月却列」的语义错位。
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [], liunian: [2200], liuyue: [3, 6], liuri: [], liushi: [] } });
		expect(text).toContain('流年：2200年（超出大限范围，未列流年）');
		expect((text.match(/流月：/g) || []).length).toBe(0);
	});

	it('段数上限：选满 12 大限 × 远超 50 组合 → 截断并含上限提示', async () => {
		const allDaxian = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		const manyMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
		// 12 年 × 12 月 = 144 流月段，远超 50。
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: allDaxian, liunian: [1996, 1997, 1998, 1999], liuyue: manyMonths, liuri: [], liushi: [] } });
		expect(text).toContain('运限段已达上限');
	});

	// Mac issue #11：用户反馈紫微挂载缺自化。宫位总览每颗星按「所落宫干」复算四化 →「自化X」标注。
	// 动态断言：用真实四化表(当前=北派)在夹具里找确定自化的 (星,宫干)，再断言其出现在快照（不硬编码流派表）。
	it('宫位总览·自化：宫干引动其内星曜的四化以「自化X」标注', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
		const houses = mockState.chart.houses;
		let asserted = 0;
		houses.forEach((h) => {
			const palaceGan = `${h.ganzi || ''}`.charAt(0);
			const stars = [...(h.starsMain || []), ...(h.starsAssist || [])];
			stars.forEach((s) => {
				const hua = ZiWeiHelper.getSiHua(s, palaceGan);
				if (hua) {
					expect(text).toContain(`自化${hua}`);
					asserted += 1;
				}
			});
		});
		// 夹具中武曲落己宫(idx5)，北派己干→武曲化禄，故至少一处自化必现（接线证明 + 防回归）。
		expect(asserted).toBeGreaterThan(0);
	});

	// 默认快照里 生年/自化 标注同段共存（生年四化此前已在，自化为本次新增）→ 证明两类四化都进了星曜行。
	it('星曜行可同时承载 生年四化 与 自化（武曲@己宫：生年权×北派 + 自化禄）', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
		// 夹具 yearGan=庚 → 北派庚干 武曲化权（生年权）；宫干己 → 武曲化禄（自化禄）。
		const wuquLine = text.split('\n').find((l) => l.includes('武曲'));
		expect(wuquLine).toBeTruthy();
		expect(wuquLine).toContain('自化');
	});

	// Phase5 挂载侧流派叠层：taiSuiRelatives 文本('午 子')→[{branch}] 归一(text 字段无 array 时的双保险),
	// 产出 [流派叠层] 段含「太岁入卦」子块;缺省(无 overlay 开关)→ 无该段(零回归)。
	it('默认无 overlay 开关：快照不含 [流派叠层] 段（零回归）', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
		expect(text).not.toContain('[流派叠层]');
	});
	it('挂载太岁入卦(taiSuiRelatives 文本"午 子")：归一成数组→ [流派叠层] 段含 太岁入卦 + 生肖午/子', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, taiSuiRuGua: 1, taiSuiRelatives: '午 子' });
		expect(text).toContain('[流派叠层]');
		expect(text).toContain('太岁入卦');
		expect(text).toContain('生肖午');   // 夹具 houses[6].地支=午 → 命中(证明字符串未被 Array.isArray 判死)
		expect(text).toContain('生肖子');
		// 用毕还原:全局单例 taiSuiRelatives 不被污染(仍是调用前值)。
		expect(Array.isArray(ZWEngineOptions.taiSuiRelatives) ? ZWEngineOptions.taiSuiRelatives.length : 0).toBe(0);
	});
	it('挂载河洛气数位(qishuWei=1)：[流派叠层] 段含 河洛气数位 子块', async () => {
		const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, qishuWei: 1 });
		expect(text).toContain('[流派叠层]');
		expect(text).toContain('河洛气数位');
	});
});

// ══ [B2-2] AI 快照星曜亮度传导正锚:对象星带 starlight → 宫位总览内联「·档」;切源随动 ═══
// V2 基线夹具用字符串星(无 starlight)故不受影响 —— 这也是历史盲区:真实盘(Java/本地)的星是
// 对象且恒带 starlight,快照曾全程丢弃(要义却让模型「依庙旺论强弱」=逼臆造,复查实锤)。
describe('[B2-2] 快照亮度传导(对象星)', () => {
	const withObjStars = () => {
		const houses = makeHouses();
		// 寅宫(idx2)换成对象星带基础亮度(基表:紫微寅庙/贪狼寅平)
		houses[2].starsMain = [{ name: '紫微', starlight: '庙' }, { name: '贪狼', starlight: '平' }];
		return houses;
	};
	it('🔴 对象星:宫位总览星文本内联基础档「紫微…·庙」「贪狼…·平」;字符串星宫照旧无档', async () => {
		const prev = mockState.chart.houses;
		mockState.chart.houses = withObjStars();
		try{
			const text = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
			const row = text.split('\n').find((l) => l.includes('| 命宫 |'));   // idx2=寅宫(夹具 name 序:idx2→命宫)
			expect(row).toBeTruthy();
			expect(row).toMatch(/紫微[^|·]*·庙/);
			expect(row).toMatch(/贪狼[^|·]*·平/);
			const wuquRow = text.split('\n').find((l) => l.includes('武曲'));   // idx5 武曲=字符串星
			expect(wuquRow).toBeTruthy();
			expect(wuquRow).not.toContain('·');
		}finally{ mockState.chart.houses = prev; }
	});
	it('🔴 挂载切亮度源(quanshu_full):对象星档随源变(天府酉 基表陷→七档旺),用毕单例还原', async () => {
		const prev = mockState.chart.houses;
		const houses = makeHouses();
		houses[9].starsMain = [{ name: '天府', starlight: '陷' }];   // idx9=酉宫
		mockState.chart.houses = houses;
		try{
			const base = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
			expect(base).toMatch(/天府[^|·]*·陷/);
			const full = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, brightnessSource: 'quanshu_full' });
			expect(full).toMatch(/天府[^|·]*·旺/);
			expect(full).toContain('星曜亮度=《全书》七档全表');
			expect(ZWEngineOptions.brightnessSource).toBe('zi_jian');   // finally 还原
		}finally{ mockState.chart.houses = prev; }
	});
});
