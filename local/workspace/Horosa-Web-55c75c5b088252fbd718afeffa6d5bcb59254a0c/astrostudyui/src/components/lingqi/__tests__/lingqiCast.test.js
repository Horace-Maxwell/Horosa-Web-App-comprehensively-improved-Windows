// 灵棋经起卦引擎不变量:同 seed 字节幂等 / faces↔counts 一致 / 恰 12 次消费(层序固定)/
// facesFromCounts 往返 / 时间种子同分钟恒同 / 三才数性与耦敌(只标明文两对)/ 六戊检测 / 诗句重排。
import {
	castLingqi, facesFromCounts, computeTimeSeed, resolveLingqiSeed,
	sanCaiOf, pairRelation, isWuDay, splitVerse, SHU_XING,
} from '../core/lingqiCast';

describe('castLingqi 掷棋', () => {
	test('同 seed 字节幂等;faces 与 counts 一致;counts∈0..4', () => {
		const a = castLingqi('seed-甲子-1');
		const b = castLingqi('seed-甲子-1');
		expect(a).toEqual(b);
		expect(a.counts.length).toBe(3);
		expect(a.faces.length).toBe(3);
		a.counts.forEach((n, i) => {
			expect(n).toBeGreaterThanOrEqual(0);
			expect(n).toBeLessThanOrEqual(4);
			expect(a.faces[i].length).toBe(4);
			expect(a.faces[i].filter(Boolean).length).toBe(n);
		});
	});

	test('不同 seed 通常不同卦(1000 seed 覆盖多种组合;分布 sanity:非退化)', () => {
		const seen = new Set();
		for (let i = 0; i < 1000; i++) {
			seen.add(castLingqi(`s-${i}`).counts.join(','));
		}
		// 125 组合中二项分布可达大多数;至少覆盖 60 种即证非退化(层内 P(2)=6/16 最集中)
		expect(seen.size).toBeGreaterThan(60);
	});

	test('facesFromCounts:前 k 枚朝上、越界钳制、与 counts 往返', () => {
		expect(facesFromCounts([2, 0, 4])).toEqual([
			[true, true, false, false],
			[false, false, false, false],
			[true, true, true, true],
		]);
		expect(facesFromCounts([9, -3, 1.7])[0]).toEqual([true, true, true, true]);
		expect(facesFromCounts(null)[1]).toEqual([false, false, false, false]);
	});
});

describe('种子来源', () => {
	const mkFields = (dateStr, timeStr) => ({
		date: { value: { format: (f) => ({ YYYY: dateStr.slice(0, 4), MM: dateStr.slice(5, 7), DD: dateStr.slice(8, 10) }[f]) } },
		time: { value: { format: (f) => ({ HH: timeStr.slice(0, 2), mm: timeStr.slice(3, 5) }[f]) } },
	});

	test('时间种子:同分钟恒同,不同分钟不同;域 [0, 2147483647)', () => {
		const f = mkFields('2026-08-10', '15:29');
		expect(computeTimeSeed(f)).toBe(computeTimeSeed(f));
		expect(computeTimeSeed(f)).not.toBe(computeTimeSeed(mkFields('2026-08-10', '15:30')));
		expect(computeTimeSeed(f)).toBeGreaterThanOrEqual(0);
		expect(computeTimeSeed(f)).toBeLessThan(2147483647);
	});

	test('resolveLingqiSeed 三态:manual 原样串化 / time_seed 前缀 t- / random 前缀 rnd-', () => {
		expect(resolveLingqiSeed('manual', 42, null)).toBe('42');
		expect(resolveLingqiSeed('manual', null, null)).toBe('0');
		const f = mkFields('2026-08-10', '15:29');
		expect(resolveLingqiSeed('time_seed', null, f)).toBe(`t-${computeTimeSeed(f)}`);
		expect(resolveLingqiSeed('random', null, null)).toMatch(/^rnd-\d+$/);
	});
});

describe('三才数性与耦敌(刘基后序明文,不推衍)', () => {
	test('数性表:0覆 1少陽 2少隂 3太陽 4老隂', () => {
		expect(SHU_XING[0]).toBe('覆');
		expect(SHU_XING[1]).toBe('少陽');
		expect(SHU_XING[2]).toBe('少隂');
		expect(SHU_XING[3]).toBe('太陽');
		expect(SHU_XING[4]).toBe('老隂');
	});

	test('🔴 耦敌只标明文两对:1+2=耦(悦) / 3+4=敵(争);其余一律 null', () => {
		expect(pairRelation(1, 2).kind).toBe('ou');
		expect(pairRelation(2, 1).kind).toBe('ou');
		expect(pairRelation(3, 4).kind).toBe('di');
		expect(pairRelation(4, 3).kind).toBe('di');
		// 无明文组合穷举校验
		for (let a = 0; a <= 4; a++) {
			for (let b = 0; b <= 4; b++) {
				const isOu = (a === 1 && b === 2) || (a === 2 && b === 1);
				const isDi = (a === 3 && b === 4) || (a === 4 && b === 3);
				const r = pairRelation(a, b);
				if (isOu) { expect(r.kind).toBe('ou'); } else if (isDi) { expect(r.kind).toBe('di'); } else { expect(r).toBeNull(); }
			}
		}
	});

	test('sanCaiOf:层角色(上君/中臣/下民)、阴阳多寡与倾向语', () => {
		const sc = sanCaiOf([1, 2, 3]);
		expect(sc.layers.map((l) => l.role)).toEqual(['君', '臣', '民']);
		expect(sc.layers.map((l) => l.realm)).toEqual(['天', '人', '地']);
		expect(sc.yang).toBe(2);   // 1,3 为阳
		expect(sc.yin).toBe(1);    // 2 为阴
		expect(sc.tendency).toBe('陽多者道同而助');
		expect(sc.relations.find((r) => r.between === '上中').kind).toBe('ou');
		const sc2 = sanCaiOf([2, 4, 0]);
		expect(sc2.yang).toBe(0);
		expect(sc2.yin).toBe(2);
		expect(sc2.tendency).toBe('隂盛者志異而乖');
		const sc3 = sanCaiOf([1, 2, 0]);
		expect(sc3.tendency).toBe('');   // 均势不判
	});
});

describe('六戊日检测', () => {
	test('bazi.day.stem.cell 形态 + dayGanZi 串形态双兼容;非戊/空值 false', () => {
		expect(isWuDay({ bazi: { day: { stem: { cell: '戊' } } } })).toBe(true);
		expect(isWuDay({ bazi: { day: { stem: { cell: '甲' } } } })).toBe(false);
		expect(isWuDay({ dayGanZi: '戊辰' })).toBe(true);
		expect(isWuDay({ dayGanZi: '己巳' })).toBe(false);
		expect(isWuDay(null)).toBe(false);
		expect(isWuDay({})).toBe(false);
	});
});

describe('诗句重排 splitVerse', () => {
	test('齐言双倍段对半切(源文本行界丢失的连排);不齐言保持原样', () => {
		// 7 言基准,14 字段切成 7+7
		expect(splitVerse('天門日射彩雲開　大降洪恩布九垓萬物一時沾聖化　蒼生鼔舞醉金罍'))
			.toEqual(['天門日射彩雲開', '大降洪恩布九垓', '萬物一時沾聖化', '蒼生鼔舞醉金罍']);
		// 5 言正常段
		expect(splitVerse('變豹成文彩　乗龍福自臻\n赤身成富貴　事事可更新'))
			.toEqual(['變豹成文彩', '乗龍福自臻', '赤身成富貴', '事事可更新']);
		// 不齐言(4+6)不强切
		expect(splitVerse('孝以動天　誠以感神益增')).toEqual(['孝以動天', '誠以感神益增']);
		expect(splitVerse('')).toEqual([]);
	});
});
