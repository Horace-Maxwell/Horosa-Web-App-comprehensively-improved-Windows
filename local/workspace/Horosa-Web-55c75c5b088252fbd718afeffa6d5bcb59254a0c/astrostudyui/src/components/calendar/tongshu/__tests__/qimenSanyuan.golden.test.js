// 奇门叠数 + 三垣列宿 golden。失败=数据/引擎错，不得改测试将就。
import { dieshuOf, qimenDieShuDay } from '../qimenDieShu';
import { QIMEN_DIESHU_TABLE, QIMEN_GAN_NUM, QIMEN_ZHI_NUM } from '../qimenData';
import { sanyuanLiexiuDay, sanyuanYearPoints } from '../sanyuanLiexiu';
import { SANYUAN_STARS } from '../sanyuanData';

describe('奇门叠数（裴晋公）', () => {
	test('配数表锚点', () => {
		expect(QIMEN_GAN_NUM['甲']).toBe(9);
		expect(QIMEN_GAN_NUM['戊']).toBe(5);
		expect(QIMEN_ZHI_NUM['子']).toBe(9);
		expect(QIMEN_ZHI_NUM['巳']).toBe(4);
	});

	test('13~27 表齐全，24=吉（采信修正）', () => {
		for (let n = 13; n <= 27; n++) { expect(QIMEN_DIESHU_TABLE[n]).toBeTruthy(); expect(QIMEN_DIESHU_TABLE[n].shi.length).toBeGreaterThan(0); }
		expect(QIMEN_DIESHU_TABLE[24].jx).toBe('吉');
		expect(QIMEN_DIESHU_TABLE[27].jx).toBe('凶');
	});

	test('例题：甲子日午时=27凶、卯时=24吉', () => {
		expect(dieshuOf('甲', '子', '午').sum).toBe(27);
		expect(dieshuOf('甲', '子', '午').jx).toBe('凶');
		expect(dieshuOf('甲', '子', '卯').sum).toBe(24);
		expect(dieshuOf('甲', '子', '卯').jx).toBe('吉');
	});

	test('全日 12 时辰值域皆 13~27', () => {
		const r = qimenDieShuDay({ y: 2026, m: 7, d: 13 });
		expect(r.rows.length).toBe(12);
		r.rows.forEach((row)=>{ expect(row.sum).toBeGreaterThanOrEqual(13); expect(row.sum).toBeLessThanOrEqual(27); });
	});
});

describe('三垣列宿加临（古法·约略版）', () => {
	test('十六吉曜齐全，天帝有节气偏移', () => {
		expect(SANYUAN_STARS.length).toBe(16);
		const tiandi = SANYUAN_STARS.find((s)=> s.name === '天帝');
		expect(tiandi.jieqiOffsets).toEqual([['芒种', 4], ['大雪', 3]]);
		// 坟墓仅有掌管义、无四类断语（忠于原书）。
		const fenmu = SANYUAN_STARS.find((s)=> s.name === '坟墓');
		expect(fenmu.desc.length).toBeGreaterThan(0);
		expect(fenmu.建宅).toBe('');
	});

	test('天帝加临日：2026 芒种+4=06-09、大雪+3=12-10', () => {
		const points = sanyuanYearPoints(2026).filter((p)=> p.name === '天帝').map((p)=> p.ymd);
		expect(points).toContain('2026-06-09');
		expect(points).toContain('2026-12-10');
	});

	test('加临判定：06-09 天帝加临；07-13 无吉曜加临', () => {
		const hit = sanyuanLiexiuDay({ y: 2026, m: 6, d: 9 });
		expect(hit.hitStars.map((s)=> s.name)).toContain('天帝');
		const miss = sanyuanLiexiuDay({ y: 2026, m: 7, d: 13 });
		expect(miss.hitStars.length).toBe(0);
	});
});
