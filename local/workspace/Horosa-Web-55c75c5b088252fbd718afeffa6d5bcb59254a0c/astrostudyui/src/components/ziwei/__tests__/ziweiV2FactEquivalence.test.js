// 紫微 v2 表化改造 · 数值不变证明(golden 重生成纪律第 2 步):
// fixtures/ziweiV2Baseline.json = 改造前 buildZiweiSnapshotForParams 在同一夹具下的逐字输出(2026-07-11 抓取)。
// 断言:剥掉排版字符与结构标签后,新旧输出的「事实 token 多重集」完全相等 ——
// 证明表化/◆子题只动排版,盘面数值(宫名/干支/大限区间/星曜四化/运限层)一个不多一个不少。
// ⚠️ 若本测试红:说明改动碰了数值而非排版,必须回查,禁止直接重录基线将就。
jest.mock('d3', () => ({}));
const DIZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
function makeHouses() {
	const houseNames = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
	const houses = [];
	for (let i = 0; i < 12; i++) {
		houses.push({
			id: `h${i}`,
			name: houseNames[(i - 2 + 12) % 12],
			ganzi: GANS[i % 10] + DIZI[i],
			direction: [6 + i * 6, 6 + i * 6 + 5],
			starsMain: i === 2 ? ['紫微', '贪狼'] : (i === 5 ? ['武曲'] : []),
			starsAssist: i === 0 ? ['左辅'] : [],
			starsEvil: [], starsOthersGood: [], starsOthersBad: [], starsSmall: [], stars: [],
		});
	}
	return houses;
}
const mockState = {
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
	default: jest.fn(async () => ({ Result: { chart: JSON.parse(JSON.stringify(mockState.chart)), patterns: [] } })),
}));

import { buildZiweiSnapshotForParams } from '../ZiWeiMain';
const baseline = require('./fixtures/ziweiV2Baseline.json');

const BASE_PARAMS = {
	date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38',
	gender: 1, timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1,
};

// 结构标签(v1 逐宫重复 12 次 vs v2 表头出现 1 次,属排版词非事实)——从多重集剔除。
const STRUCTURE_LABELS = new Set(['宫位', '干支', '大限', '星曜', '四化括注', '起盘信息', '宫位总览', '来因宫', '运限']);

export function extractFacts(text){
	const tokens = `${text || ''}`.match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const counts = new Map();
	tokens.forEach((t)=>{
		if(STRUCTURE_LABELS.has(t)){ return; }
		counts.set(t, (counts.get(t) || 0) + 1);
	});
	return counts;
}

function diffFacts(a, b){
	const out = [];
	const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k)=>{
		const av = a.get(k) || 0;
		const bv = b.get(k) || 0;
		if(av !== bv){ out.push(`${k}: 旧${av} vs 新${bv}`); }
	});
	return out;
}

// 声明的补缺纯增行(审计:左栏信息卡内容此前显示了但快照没有)。本夹具 chart 只有 zidou+gender
// (无 bazi/lifeMaster/bodyMaster/doujun/nongli.year),故新增恰为这两行——多一行少一行都算证明失败。
const DECLARED_NEW_LINES = ['子斗：子', '命局：男'];

function withDeclaredAdditions(oldFacts){
	const merged = new Map(oldFacts);
	extractFacts(DECLARED_NEW_LINES.join('\n')).forEach((v, k)=>{
		merged.set(k, (merged.get(k) || 0) + v);
	});
	return merged;
}

describe('紫微 v2 数值不变证明(基线 fixture ↔ 新 builder)', () => {
	it('默认盘:旧事实零丢失,新增恰为声明的补缺行(子斗/命局)', async () => {
		const now = await buildZiweiSnapshotForParams({ ...BASE_PARAMS });
		const diff = diffFacts(withDeclaredAdditions(extractFacts(baseline.plain)), extractFacts(now));
		expect(diff).toEqual([]);
	});

	it('带运限盘(大限+流年+流月+流日+流时):同上严格相等', async () => {
		const now = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [2], liunian: [1996], liuyue: [3], liuri: [1], liushi: [0] } });
		const diff = diffFacts(withDeclaredAdditions(extractFacts(baseline.withPeriod)), extractFacts(now));
		expect(diff).toEqual([]);
	});

	it('v2 形态锚:宫位总览为 GFM 表(表头+分隔行+12 行),运限头行带 ◆', async () => {
		const now = await buildZiweiSnapshotForParams({ ...BASE_PARAMS, period: { daxian: [2], liunian: [], liuyue: [], liuri: [], liushi: [] } });
		expect(now).toContain('| 宫位 | 干支 | 大限 | 星曜（四化括注） |');
		expect(now).toContain('| --- | --- | --- | --- |');
		expect((now.match(/^\| /gm) || []).length).toBe(14); // 表头+12 宫(分隔行以 | - 开头不匹配 "| ")
		expect(now).toContain('◆ 大限：');
	});
});
