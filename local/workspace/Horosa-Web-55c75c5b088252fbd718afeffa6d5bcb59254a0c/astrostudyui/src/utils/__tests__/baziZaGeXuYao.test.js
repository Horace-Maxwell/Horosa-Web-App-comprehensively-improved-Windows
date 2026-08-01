/**
 * 虚邀暗冲杂格 golden（§9.4 后半，机械判据+真假标注）。
 * 既有八格条目零回归（无 group/quality 键、顺序在前）；虚邀组必带 quality 真/假/待复核 + broken。
 */
import { computeZaGe } from '../baziZaGe';

function P(gz, sEl, bEl){ return { stem: { cell: gz.charAt(0), element: sEl }, branch: { cell: gz.charAt(1), element: bEl } }; }
function four(y, m, d, t){ return { year: y, month: m, day: d, time: t }; }
function pick(r, name){ return (r || []).find((x) => x.name === name); }

describe('虚邀暗冲 · 真格', () => {
	test('飞天禄马：庚子日多子、无午无丑 → 真', () => {
		const g = pick(computeZaGe(four(P('壬子'), P('戊子'), P('庚子'), P('丙子'))), '飞天禄马格');
		expect(g).toBeTruthy();
		expect(g.group).toBe('虚邀暗冲');
		expect(g.quality).toBe('真');
		expect(g.broken).toEqual([]);
	});
	test('井栏叉：庚申日申子辰全、无丙丁巳午 → 真', () => {
		const g = pick(computeZaGe(four(P('甲辰'), P('戊子'), P('庚申'), P('戊寅'))), '井栏叉格');
		expect(g.quality).toBe('真');
	});
	test('六乙鼠贵：乙亥日丙子时、局清 → 真', () => {
		const g = pick(computeZaGe(four(P('己卯'), P('丁卯'), P('乙亥'), P('丙子'))), '六乙鼠贵格');
		expect(g.quality).toBe('真');
	});
	test('拱禄：癸亥日癸丑时虚拱子禄 → 真；拱贵：甲子日丙寅时虚拱丑贵 → 真', () => {
		const lu = pick(computeZaGe(four(P('丁巳'), P('丙辰'), P('癸亥'), P('癸丑'))), '拱禄格');
		expect(lu.quality).toBe('真');
		expect(lu.cond).toContain('子');
		const gui = pick(computeZaGe(four(P('戊辰'), P('丁巳'), P('甲子'), P('丙寅'))), '拱贵格');
		expect(gui.quality).toBe('真');
	});
	test('趋乾：甲日多亥无巳 → 真；趋艮：壬日多寅无申 → 真', () => {
		expect(pick(computeZaGe(four(P('乙亥'), P('丁亥'), P('甲戌'), P('丙子'))), '趋乾格').quality).toBe('真');
		expect(pick(computeZaGe(four(P('壬寅'), P('壬寅'), P('壬戌'), P('辛丑'))), '趋艮格').quality).toBe('真');
	});
});

describe('虚邀暗冲 · 填实/冲合破格判假', () => {
	test('飞天禄马：局见午（填实）→ 假 + broken 列明', () => {
		const g = pick(computeZaGe(four(P('壬午'), P('戊子'), P('庚子'), P('丙子'))), '飞天禄马格');
		expect(g.quality).toBe('假');
		expect(g.broken).toContain('午填实');
	});
	test('飞天禄马：局见丑（合绊子）→ 假', () => {
		const g = pick(computeZaGe(four(P('乙丑'), P('戊子'), P('庚子'), P('丙子'))), '飞天禄马格');
		expect(g.quality).toBe('假');
		expect(g.broken).toContain('子被丑合绊');
	});
	test('六乙鼠贵：年透庚见午 → 假（官杀显+午冲子）', () => {
		const g = pick(computeZaGe(four(P('庚午'), P('丁卯'), P('乙亥'), P('丙子'))), '六乙鼠贵格');
		expect(g.quality).toBe('假');
		expect(g.broken).toEqual(expect.arrayContaining(['官杀显', '午冲子']));
	});
	test('拱禄：禄支填实 → 假', () => {
		const g = pick(computeZaGe(four(P('甲子'), P('丙辰'), P('癸亥'), P('癸丑'))), '拱禄格');
		expect(g.quality).toBe('假');
		expect(g.broken).toContain('子填实');
	});
	test('合禄：戊日庚申时见寅 → 假（寅冲申）', () => {
		const g = pick(computeZaGe(four(P('甲寅'), P('乙丑'), P('戊辰'), P('庚申'))), '合禄格');
		expect(g.quality).toBe('假');
		expect(g.broken).toContain('寅冲申');
	});
});

describe('月库杂气财官', () => {
	const mk = (timeGan) => four(
		P('庚戌'),
		{ stem: { cell: '戊' }, branch: { cell: '辰' }, stemInBranch: [
			{ cell: '戊', relative: '才' }, { cell: '乙', relative: '劫' }, { cell: '癸', relative: '印' },
		] },
		P('甲子'),
		P(`${timeGan}亥`),
	);
	test('辰月库藏印、癸透出 → 真', () => {
		const g = pick(computeZaGe(mk('癸')), '杂气财官格');
		expect(g).toBeTruthy();
		expect(g.quality).toBe('真');
		expect(g.cond).toContain('癸(印)');
	});
	test('库闭不透（但年支戌冲辰=库开）→ 真；改无冲无透 → 待复核', () => {
		expect(pick(computeZaGe(mk('丁')), '杂气财官格').quality).toBe('真'); // 戌冲辰开库
		const closed = mk('丁');
		closed.year = P('庚午');
		expect(pick(computeZaGe(closed), '杂气财官格').quality).toBe('待复核');
	});
});

describe('零回归：既有八格条目形状不变', () => {
	test('天元一气格条目无 group/quality 新键、仍居数组前段', () => {
		const r = computeZaGe(four(P('甲子'), P('甲戌'), P('甲申'), P('甲午')));
		const g = pick(r, '天元一气格');
		expect(g).toEqual({ name: '天元一气格', cond: '四天干相同', note: '纯而有用为贵，全看地支配合。' });
		const xu = r.filter((x) => x.group === '虚邀暗冲');
		xu.forEach((x) => { expect(r.indexOf(x)).toBeGreaterThan(r.indexOf(g)); });
	});
	test('平常盘（无任何格）仍返回 null', () => {
		expect(computeZaGe(four(P('丙午'), P('甲午'), P('丁卯'), P('己酉')))).toBeNull();
	});
});
