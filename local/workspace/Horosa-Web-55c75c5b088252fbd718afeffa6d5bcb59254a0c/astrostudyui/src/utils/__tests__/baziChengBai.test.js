/**
 * 成败救应（§9.2.2）+ 从势格（§9.3.1）+ 两神成象（§9.3.4）golden。
 * chengBai 为 computeGejuYongShen 纯新增键；bianGe 新增 从势/两神成象 两支（既有支判据未动）。
 */
import { computeGejuYongShen } from '../baziGejuYongShen';
import { buildLocalBaziResult } from '../baziLunarLocal';

function stem(cell, element, relative){ return { cell, element, relative }; }
function S(label, key, percent){ return { label, key, percent }; }
function ws(verdict, samePercent, scores){ return { dayMaster: { verdict, samePercent }, scores }; }

// 甲日酉月（本气辛=官，单藏不透）正官格底盘；year/time 可替换造破格/救应。
function guanFour(yearStem, yearZhi, timeStem, timeZhi){
	return {
		day: { stem: stem('甲', 'Wood', '日元'), branch: { cell: '子' }, stemInBranch: [stem('癸', 'Water', '印')] },
		month: { stem: stem('癸', 'Water', '印'), branch: { cell: '酉' }, stemInBranch: [stem('辛', 'Metal', '官')] },
		year: { stem: yearStem, branch: { cell: yearZhi }, stemInBranch: [] },
		time: { stem: timeStem, branch: { cell: timeZhi }, stemInBranch: [] },
	};
}
const MID = ws('中和', 50, [S('木', 'Wood', 20), S('火', 'Fire', 20), S('土', 'Earth', 20), S('金', 'Metal', 20), S('水', 'Water', 20)]);

describe('成败救应（§9.2.2）', () => {
	test('成格：正官格相神（财戊）透干得力', () => {
		const r = computeGejuYongShen(guanFour(stem('戊', 'Earth', '财'), '辰', stem('丙', 'Fire', '食'), '寅'), MID);
		expect(r.geju.name).toBe('正官格');
		expect(r.chengBai.verdict).toBe('成格');
		expect(r.chengBai.xiang).toEqual({ how: '透干', gan: '戊', el: '土' });
		expect(r.chengBai.breaks).toEqual([]);
	});
	test('破格：伤官（丁）见官、无合无制', () => {
		const four = guanFour(stem('丁', 'Fire', '伤'), '丑', stem('戊', 'Earth', '财'), '辰');
		four.month.stem = stem('己', 'Earth', '才'); // 去掉月干癸，免其水克丁成救应
		const r = computeGejuYongShen(four, MID);
		expect(r.chengBai.verdict).toBe('破格');
		expect(r.chengBai.breaks).toEqual(['伤官见官']);
		expect(r.chengBai.rescues).toEqual([]);
	});
	test('败中复成：伤官丁被壬合去', () => {
		const four = guanFour(stem('丁', 'Fire', '伤'), '丑', stem('壬', 'Water', '枭'), '申');
		four.month.stem = stem('己', 'Earth', '才');
		const r = computeGejuYongShen(four, MID);
		expect(r.chengBai.verdict).toBe('败中复成');
		expect(r.chengBai.rescues).toEqual(['丁被壬合去']);
	});
	test('败中复成：伤官丁被癸（水）克制', () => {
		const r = computeGejuYongShen(guanFour(stem('丁', 'Fire', '伤'), '丑', stem('戊', 'Earth', '财'), '辰'), MID);
		expect(r.chengBai.verdict).toBe('败中复成'); // 月干癸克丁＝伤官配印之救
		expect(r.chengBai.rescues).toEqual(['癸(水)克制丁']);
	});
	test('破格：月令逢冲（酉卯）', () => {
		const r = computeGejuYongShen(guanFour(stem('戊', 'Earth', '财'), '卯', stem('丙', 'Fire', '食'), '寅'), MID);
		expect(r.chengBai.verdict).toBe('破格');
		expect(r.chengBai.breaks).toEqual(['月令酉逢冲']);
	});
	test('七杀格：财透无食制 → 破格；添食神即无此破', () => {
		const sha = (timeStem) => ({
			day: { stem: stem('甲', 'Wood', '日元'), branch: { cell: '子' }, stemInBranch: [] },
			month: { stem: stem('壬', 'Water', '枭'), branch: { cell: '申' }, stemInBranch: [stem('庚', 'Metal', '杀')] },
			year: { stem: stem('戊', 'Earth', '财'), branch: { cell: '辰' }, stemInBranch: [] },
			time: { stem: timeStem, branch: { cell: '亥' }, stemInBranch: [] },
		});
		const broke = computeGejuYongShen(sha(stem('己', 'Earth', '才')), MID);
		expect(broke.chengBai.breaks).toContain('财党生杀攻身（无食制）');
		const saved = computeGejuYongShen(sha(stem('丙', 'Fire', '食')), MID);
		expect(saved.chengBai.breaks.filter((b) => b.indexOf('财党') >= 0)).toEqual([]);
	});
});

describe('从势格（§9.3.1，先于从弱判）', () => {
	const four = {
		day: { stem: stem('甲', 'Wood', '日元'), branch: { cell: '午' }, stemInBranch: [stem('丁', 'Fire', '伤')] },
		month: { stem: stem('戊', 'Earth', '财'), branch: { cell: '申' }, stemInBranch: [stem('庚', 'Metal', '杀')] },
		year: { stem: stem('丙', 'Fire', '食'), branch: { cell: '戌' }, stemInBranch: [stem('戊', 'Earth', '财')] },
		time: { stem: stem('庚', 'Metal', '杀'), branch: { cell: '巳' }, stemInBranch: [stem('丙', 'Fire', '食')] },
	};
	test('食财官三势均停 → 从势格（不落从财/从儿）', () => {
		const r = computeGejuYongShen(four, ws('身弱', 8, [S('火', 'Fire', 28), S('土', 'Earth', 30), S('金', 'Metal', 27), S('木', 'Wood', 8), S('水', 'Water', 7)]));
		const b = r.bianGe.find((x) => x.type === '从势');
		expect(b).toBeTruthy();
		expect(b.name).toBe('从势格');
		expect(r.bianGe.find((x) => x.type === '从弱')).toBeUndefined();
	});
	test('一势独大 → 仍走从弱（从财），不误报从势', () => {
		const r = computeGejuYongShen(four, ws('身弱', 8, [S('土', 'Earth', 55), S('金', 'Metal', 20), S('火', 'Fire', 10), S('木', 'Wood', 8), S('水', 'Water', 7)]));
		expect(r.bianGe.find((x) => x.type === '从势')).toBeUndefined();
		expect(r.bianGe.find((x) => x.type === '从弱').name).toBe('从财格');
	});
});

describe('两神成象（§9.3.4）', () => {
	const two = (dayEl, dayGan) => ({
		day: { stem: stem(dayGan, dayEl, '日元'), branch: { cell: '子' }, stemInBranch: [stem('癸', 'Water', '印')] },
		month: { stem: stem('壬', 'Water', '枭'), branch: { cell: '亥' }, stemInBranch: [stem('壬', 'Water', '枭')] },
		year: { stem: stem('乙', 'Wood', '劫'), branch: { cell: '卯' }, stemInBranch: [stem('乙', 'Wood', '劫')] },
		time: { stem: stem('甲', 'Wood', '比'), branch: { cell: '寅' }, stemInBranch: [stem('甲', 'Wood', '比')] },
	});
	test('水木各半 → 水木相生两象（母子有序）', () => {
		const r = computeGejuYongShen(two('Wood', '甲'), ws('身强', 95, [S('木', 'Wood', 50), S('水', 'Water', 45), S('火', 'Fire', 3), S('土', 'Earth', 1), S('金', 'Metal', 1)]));
		const b = r.bianGe.find((x) => x.type === '两神成象');
		expect(b).toBeTruthy();
		expect(b.name).toBe('水木相生两象');
	});
	test('木土各半 → 相成两象、取火通关', () => {
		const r = computeGejuYongShen(two('Wood', '甲'), ws('中和', 50, [S('木', 'Wood', 48), S('土', 'Earth', 45), S('火', 'Fire', 4), S('金', 'Metal', 2), S('水', 'Water', 1)]));
		const b = r.bianGe.find((x) => x.type === '两神成象');
		expect(b.name).toBe('木土相成两象');
		expect(b.yong).toContain('火通关');
	});
	test('第三行超阈（>8%）→ 不成象', () => {
		const r = computeGejuYongShen(two('Wood', '甲'), ws('中和', 50, [S('木', 'Wood', 45), S('水', 'Water', 40), S('火', 'Fire', 15), S('土', 'Earth', 0), S('金', 'Metal', 0)]));
		expect((r.bianGe || []).find((x) => x.type === '两神成象')).toBeUndefined();
	});
});

describe('零回归：既有键面与正常盘', () => {
	test('2026-06-22 集成盘：chengBai 新键存在、bianGe 仍 null、既有键全在', () => {
		const gy = buildLocalBaziResult({
			date: '2026-06-22', time: '18:00:00', zone: '+08:00',
			lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0, gender: 1, timeAlg: 1,
		}).bazi.gejuYongShen;
		expect(gy.bianGe).toBeNull();
		expect(gy).toHaveProperty('chengBai');
		expect(['成格', '破格', '败中复成', '待复核']).toContain(gy.chengBai.verdict);
		['geju', 'yongshen', 'tiaohou', 'zaGe', 'bingyao', 'tongguan', 'gejuYong', 'schools'].forEach((k) => {
			expect(gy).toHaveProperty(k);
		});
	});
});
