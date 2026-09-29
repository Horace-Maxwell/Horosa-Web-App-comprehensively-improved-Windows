// 八字岁数 / 年份口径:盘数据里的 age 一律是虚岁(出生即 1 岁);公元前 / 域外年份回退 Java 的结果在取数入口对齐;
// 旧版界面与 AI 快照的岁数随「年龄」档(虚岁 / 周岁);年份跨公元纪元不出现不存在的「0 年」。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { alignJavaBaziAges, buildBaziSnapshotForParams } from '../BaZi';
import { baziAgeText, baziAgeValue } from '../baziAgeText';
import { buildSmallYears } from '../BaZiLuckFlowPanel';
import SmallDirection from '../SmallDirection';
import MDSDirect from '../MDSDirect';
import MainDirection from '../MainDirection';
import { addDisplayYears, displayYearDiff } from '../../../utils/dateStrSafe';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';

const BJ = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1, gender: 1, phaseType: 0, godKeyPos: '年日' };
// 旧版组件文件本身不 import React(构建时由打包器注入),SSR 冒烟时补全局。
global.React = React;
const html = (el)=>renderToStaticMarkup(el);

describe('Java 回退结果的岁数对齐为虚岁', ()=>{
	test('公元年份:大运岁 = 起运年 − 出生年 + 1,小运岁从 1 起', ()=>{
		const r = alignJavaBaziAges({ bazi: {
			nongli: { clockTime: '1990-05-18 10:00:00' },
			direction: [{ age: 9, startYear: 1999 }, { age: 19, startYear: 2009 }],
			smallDirection: [{ age: 0, year: 1990 }, { age: 1, year: 1991 }],
		} });
		expect(r.bazi.direction.map((d)=>d.age)).toEqual([10, 20]);
		expect(r.bazi.smallDirection.map((d)=>d.age)).toEqual([1, 2]);
	});

	test('公元前出生、起运落在公元后:不多算不存在的 0 年(修复前后 Java 岁数都对齐到同一虚岁)', ()=>{
		// 公元前 5 年 5 月出生、公元 3 年起运:前5→前1 是 1–5 岁,公元 1–3 年是 6–8 岁 → 虚岁 8
		for(const javaAge of [8, 7]){
			const r = alignJavaBaziAges({ bazi: {
				nongli: { clockTime: '-0005-05-18 10:00:00' },
				direction: [{ age: javaAge, startYear: 3 }, { age: javaAge + 10, startYear: 13 }],
			} });
			expect(r.bazi.direction.map((d)=>d.age)).toEqual([8, 18]);
		}
	});

	test('缺出生时刻时退回逐项 +1;无大运 / 空结果不抛', ()=>{
		const r = alignJavaBaziAges({ bazi: { direction: [{ age: 3 }] } });
		expect(r.bazi.direction[0].age).toBe(4);
		expect(alignJavaBaziAges(null)).toBe(null);
		expect(alignJavaBaziAges({})).toEqual({});
	});

	test('与本地引擎同一张盘逐步一致', ()=>{
		const local = buildLocalBaziResult(BJ).bazi;
		const javaShape = { bazi: {
			nongli: { clockTime: '1990-05-18 10:00:00' },
			direction: local.direction.map((d)=>({ startYear: d.startYear, age: d.startYear - 1990 })),
			smallDirection: local.smallDirection.map((d, i)=>({ year: d.year, age: i })),
		} };
		alignJavaBaziAges(javaShape);
		expect(javaShape.bazi.direction.map((d)=>d.age)).toEqual(local.direction.map((d)=>d.age));
		expect(javaShape.bazi.smallDirection.map((d)=>d.age)).toEqual(local.smallDirection.map((d)=>d.age));
	});
});

describe('岁数显示单源', ()=>{
	test('虚岁「N岁」/ 周岁「N−1周岁」/ 未传档原样「N周岁」', ()=>{
		expect(baziAgeText(10, 'nominal')).toBe('10岁');
		expect(baziAgeText(10, 'real')).toBe('9周岁');
		expect(baziAgeText(1, 'real')).toBe('0周岁');
		expect(baziAgeText(10)).toBe('10周岁');
		expect(baziAgeText(10, undefined, '岁')).toBe('10岁');
		expect(baziAgeText(undefined, 'nominal')).toBe('');
		expect(baziAgeValue(10, 'real')).toBe(9);
	});
});

describe('显示年算术(无公元 0 年)', ()=>{
	test('跨纪元', ()=>{
		expect(addDisplayYears(-1, 1)).toBe(1);
		expect(addDisplayYears(-5, 4)).toBe(-1);
		expect(addDisplayYears(-5, 5)).toBe(1);
		expect(addDisplayYears(1, -1)).toBe(-1);
		expect(displayYearDiff(-5, 3)).toBe(7);
		expect(displayYearDiff(-1, 1)).toBe(1);
	});
	test('公元年份与直接加减逐一相同', ()=>{
		for(const y of [1, 2, 99, 1990, 2024, 9999]){
			for(const n of [0, 1, 9, 10, 37]){
				expect(addDisplayYears(y, n)).toBe(y + n);
				expect(displayYearDiff(y, y + n)).toBe(n);
			}
		}
	});
	test('行运面板小运期年份:公元前 5 年出生、公元 3 年起运 → 前5…前1、1、2,没有 0 年', ()=>{
		const years = buildSmallYears({ smallDirection: [] }, -5, 3, '庚', 'nominal');
		expect(years.map((y)=>y.year)).toEqual([-5, -4, -3, -2, -1, 1, 2]);
		expect(years.map((y)=>y.age)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		// 公元前 1 年 = 天文 0 年 = 庚申;公元 1 年 = 辛酉
		expect(years[4].liunianPillar.ganzi).toBe('庚申');
		expect(years[5].liunianPillar.ganzi).toBe('辛酉');
	});
});

describe('旧版界面岁数随「年龄」档', ()=>{
	const small = { smallDirection: [{ year: 1990, age: 1, direct: { ganzi: '丁巳' }, yearGanzi: { ganzi: '庚午' } }] };
	test('小运表:虚岁「1岁」/ 周岁「0周岁」/ 反推八字等未传档原样', ()=>{
		expect(html(<SmallDirection value={small} ageStyle="nominal" />)).toContain('1岁');
		expect(html(<SmallDirection value={small} ageStyle="nominal" />)).not.toContain('周岁');
		expect(html(<SmallDirection value={small} ageStyle="real" />)).toContain('0周岁');
		expect(html(<SmallDirection value={small} />)).toContain('1周岁');
	});
	test('行运概略大运卡', ()=>{
		const dir = { age: 10, startYear: 1999, mainDirect: { ganzi: '壬午' }, subDirect: [] };
		expect(html(<MDSDirect value={dir} ageStyle="real" />)).toContain('9周岁');
		expect(html(<MDSDirect value={dir} ageStyle="nominal" />)).toContain('10岁');
		expect(html(<MDSDirect value={dir} />)).toContain('10周岁');
	});
	test('大运页「上运时间」取首步大运岁数(本地引擎盘此前是空白)', ()=>{
		const rec = { directTime: '1999-11-02 08:00:00', direction: [{ age: 10, startYear: 1999, mainDirect: { ganzi: '壬午' }, subDirect: [] }] };
		expect(html(<MainDirection value={rec} height={600} ageStyle="nominal" />)).toContain('上运时间：10岁 1999');
		expect(html(<MainDirection value={rec} height={600} ageStyle="real" />)).toContain('上运时间：9周岁 1999');
	});
});

describe('AI 快照「流年行运概略」起始年龄随「年龄」档', ()=>{
	test('虚岁逐字不变 / 周岁减一并标周岁', async ()=>{
		const local = buildLocalBaziResult(BJ).bazi;
		const first = local.direction[0];
		const nominal = await buildBaziSnapshotForParams({ ...BJ });
		expect(nominal).toContain(`| 板块1 | ${first.startYear} | ${first.age}岁 |`);
		const real = await buildBaziSnapshotForParams({ ...BJ, ageStyle: 'real' });
		expect(real).toContain(`| 板块1 | ${first.startYear} | ${first.age - 1}周岁 |`);
	});
});
