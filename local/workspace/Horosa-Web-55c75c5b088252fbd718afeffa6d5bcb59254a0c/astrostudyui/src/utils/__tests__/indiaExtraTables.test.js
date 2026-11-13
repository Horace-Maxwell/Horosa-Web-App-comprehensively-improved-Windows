import fs from 'fs';
import path from 'path';
import {
	buildAshtakootaLines, buildExtraTableLines, buildYogaTableLines, dirahColumns, dirahScore, extraLon, extraPointName, kootaLabel,
	maleSideOf, sphutaLabel, transitEventText, transitRelationText, yogaRowCond, yogaRowHit,
} from '../indiaExtraTables';

const ROW = { id: 7, name: 'Ardha Chandra', zh: '半月', group: '形状', nature: 'good', hit: true, classicHit: false, cond: '甲', classicCond: '乙' };
const YOGA = { available: true, hits: 1, classicHits: 0, rows: [ROW, { ...ROW, id: 8, hit: false, classicHit: false }] };
const EXTRA = {
	available: true,
	samaya: [{ planet: 'Sun', value: 24 }],
	dirah: [{ planet: 'Sun', scores: { 2: 45, 11: -15 }, sum: 30 }],
	dirahTypes: { 2: '擢升', 8: '死敌', 11: '宫位' },
	sphuta: [{ name: 'Trisphuta', lon: 248.12, sign: 8 }],
};
const KOOTA = { rows: [{ name: 'Nadi', max: 8, score: 0, classic: 0 }], total: 28, classicTotal: 26, max: 36, maleSide: 'outer', groomSign: 0, brideSign: 11, groomNakshatra: 1, brideNakshatra: 27 };

describe('印占判定表文字', ()=>{
	test('口径切换读各自的列', ()=>{
		expect(yogaRowHit(ROW, 'improved')).toBe(true);
		expect(yogaRowHit(ROW, 'classic')).toBe(false);
		expect(yogaRowCond(ROW, 'classic')).toBe('乙');
		expect(yogaRowCond({ cond: '甲' }, 'classic')).toBe('甲');
	});

	test('快照只列成立的条目,两列都写', ()=>{
		const text = buildYogaTableLines(YOGA).join('\n');
		expect(text).toContain('成立 1 条(经典写法 0 条)');
		expect(text).toContain('半月(Ardha Chandra)');
		expect(text).toContain('| 成立 | 不成立 |');
		expect(text.match(/半月/g)).toHaveLength(1);
	});

	test('只有经典成立的条目写经典条件', ()=>{
		const row = { ...ROW, hit: false, classicHit: true };
		const text = buildYogaTableLines({ ...YOGA, rows: [row] }).join('\n');
		expect(text).toContain('| 不成立 | 成立 | 乙 |');
	});

	test('无数据不产段', ()=>{
		expect(buildYogaTableLines(null)).toEqual([]);
		expect(buildYogaTableLines({ available: false })).toEqual([]);
		expect(buildExtraTableLines({ available: false })).toEqual([]);
		expect(buildAshtakootaLines({})).toEqual([]);
	});
});

describe('补充表', ()=>{
	test('Dirah 只出现到过的项', ()=>{
		expect(dirahColumns(EXTRA.dirah, EXTRA.dirahTypes)).toEqual(['2', '11']);
	});

	test('分值带符号,没有就空', ()=>{
		expect(dirahScore(45)).toBe('+45');
		expect(dirahScore(-15)).toBe('-15');
		expect(dirahScore(0)).toBe('0');
		expect(dirahScore(undefined)).toBe('');
	});

	test('快照含三张表', ()=>{
		const text = buildExtraTableLines(EXTRA).join('\n');
		expect(text).toContain('Graha Samaya');
		expect(text).toContain('| 擢升 | 宫位 | 合计 |');
		expect(text).toContain('三合点(Trisphuta)');
		expect(buildExtraTableLines({ ...EXTRA, polar: true }).join('\n')).toContain('Porphyry');
		const western = buildExtraTableLines({ ...EXTRA, dirahWestern: [{ planet: 'Sun', scores: { 6: 1 } }], dirahClassic: [{ planet: 'Sun', sum: -5 }] }).join('\n');
		expect(western).toContain('| 同序宫 |');
		expect(western).toContain('经典口径');
		expect(text).toContain('射手 8.12°');
	});

	test('黄经和名字', ()=>{
		expect(extraLon(-1)).toBe('双鱼 29.00°');
		expect(extraPointName('North Node')).toBe('罗睺');
		expect(sphutaLabel('未知')).toBe('未知');
		expect(kootaLabel('Nadi')).toBe('脉');
	});
});

describe('八重合', ()=>{
	test('男方按记录性别定', ()=>{
		expect(maleSideOf(1, 0)).toBe('inner');
		expect(maleSideOf(0, 1)).toBe('outer');
		expect(maleSideOf('女', undefined)).toBe('outer');
		expect(maleSideOf(undefined, 1)).toBe('outer');
		expect(maleSideOf(undefined, undefined)).toBe('inner');
		expect(maleSideOf(1, 1)).toBe('inner');
		expect(maleSideOf(0, 0)).toBe('inner');
	});

	test('快照写明男方和两套表', ()=>{
		const text = buildAshtakootaLines(KOOTA).join('\n');
		expect(text).toContain('合计 28 / 36(另一套传统表 26)');
		expect(text).toContain('男方:星盘 B');
		expect(text).toContain('脉(Nadi)');
	});
});

describe('穿界表', ()=>{
	test('四种事件的写法', ()=>{
		expect(transitEventText({ kind: 'sign', sign: 3 })).toBe('巨蟹');
		expect(transitEventText({ kind: 'nakshatra', number: 24 })).toBe('第 24 宿');
		expect(transitEventText({ kind: 'pada', number: 4, retrograde: true })).toBe('第 4 足(逆)');
		expect(transitEventText({ kind: 'kakshya', number: 3, sign: 10, lord: 'Mars' })).toBe('水瓶第 3 段 · 火');
		expect(transitEventText({ kind: 'kakshya', number: 8, sign: 0, lord: 'Asc' })).toBe('白羊第 8 段 · 上升');
	});

	test('与座主的关系', ()=>{
		expect(transitRelationText('own')).toBe('自座');
		expect(transitRelationText('enemy')).toBe('敌');
	});
});

describe('接线', ()=>{
	const SRC = path.resolve(__dirname, '../..');
	const read = (file)=>fs.readFileSync(path.join(SRC, file), 'utf8');

	test('合盘页签已登记,主请求绕开八重合', ()=>{
		expect(read('constants/SubTabRegistry.js')).toContain("'Ashtakoota'");
		expect(read('components/astro/AstroRelative.js')).toContain("this.state.currentTab === 'Ashtakoota'");
	});

	test('Java 转发了男方参数', ()=>{
		const java = fs.readFileSync(path.resolve(SRC, '../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		expect(java).toContain('"/ashtakoota"');
		expect(java).toContain('params.put("maleSide"');
	});

	test('穿界表的参数都在 Java 白名单里', ()=>{
		const java = fs.readFileSync(path.resolve(SRC, '../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		expect(java).toContain('"/transitevents"');
		['transitStart', 'transitDays', 'transitPlanet', 'transitKind', 'siderealAyanamsa'].forEach((key)=>{ expect(java).toContain(`"${key}"`); });
	});
});

describe('西占 Dirah 标签', ()=>{
	test('第 8 项写的是成相,不是合', ()=>{
		// eslint-disable-next-line global-require
		const { DIRAH_WESTERN_TYPES } = require('../indiaExtraTables');
		expect(DIRAH_WESTERN_TYPES[8]).toBe('与木星成相');
	});
});
