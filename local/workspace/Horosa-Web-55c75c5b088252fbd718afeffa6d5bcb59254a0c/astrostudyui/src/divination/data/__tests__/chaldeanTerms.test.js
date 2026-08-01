// 迦勒底界(界系 3)昼/夜界主表 + termsTableForVariant 分发的正确性守卫。
// 守:① 白羊昼表锚定(有源)② 夜表=昼表土水互换 ③ 每座宽度和=30 无缝 ④ 变体分发正确(异于埃及/托勒密/莉莉)。
import { CHALDEAN_TERMS_DAY, CHALDEAN_TERMS_NIGHT, termsTableForVariant } from '../hellenisticData';
import { whichTerm } from '../../../components/astro/AstroHelper';
import * as AstroConst from '../../../constants/AstroConst';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

describe('迦勒底界昼/夜表', () => {
  it('白羊昼表锚定:Jupiter0-8 / Venus8-15 / Saturn15-21 / Mercury21-26 / Mars26-30', () => {
    expect(CHALDEAN_TERMS_DAY.Aries).toEqual([
      ['Jupiter', 0, 8], ['Venus', 8, 15], ['Saturn', 15, 21], ['Mercury', 21, 26], ['Mars', 26, 30],
    ]);
  });

  it('夜表 = 昼表土↔水位置互换(白羊:15-21 段 Saturn→Mercury,21-26 段 Mercury→Saturn)', () => {
    expect(CHALDEAN_TERMS_NIGHT.Aries).toEqual([
      ['Jupiter', 0, 8], ['Venus', 8, 15], ['Mercury', 15, 21], ['Saturn', 21, 26], ['Mars', 26, 30],
    ]);
  });

  it('12 座昼/夜表:每座 5 段、宽度和=30、首段起 0、无缝衔接', () => {
    [CHALDEAN_TERMS_DAY, CHALDEAN_TERMS_NIGHT].forEach((tbl) => {
      SIGNS.forEach((sg) => {
        const segs = tbl[sg];
        expect(segs).toHaveLength(5);
        expect(segs[0][1]).toBe(0);
        expect(segs[segs.length - 1][2]).toBe(30);
        for (let i = 1; i < segs.length; i++) {
          expect(segs[i][1]).toBe(segs[i - 1][2]); // 无缝
        }
      });
    });
  });

  it('夜表仅与昼表在土/水两位置不同(余皆同)', () => {
    SIGNS.forEach((sg) => {
      const d = CHALDEAN_TERMS_DAY[sg].map((x) => x[0]);
      const n = CHALDEAN_TERMS_NIGHT[sg].map((x) => x[0]);
      const diff = d.map((v, i) => (v !== n[i] ? v : null)).filter(Boolean);
      if (diff.length) {
        expect(new Set(diff)).toEqual(new Set(['Saturn', 'Mercury']));
      }
    });
  });
});

describe('termsTableForVariant 分发', () => {
  const EGY = { Aries: [['EGY', 0, 30]] };
  const TET = { Aries: [['TET', 0, 30]] };
  const LIL = { Aries: [['LIL', 0, 30]] };
  const base = [EGY, TET, LIL];

  it('变体 0/1/2 取传入的埃及/托勒密/莉莉表', () => {
    expect(termsTableForVariant(0, true, base, EGY)).toBe(EGY);
    expect(termsTableForVariant(1, true, base, EGY)).toBe(TET);
    expect(termsTableForVariant(2, false, base, EGY)).toBe(LIL);
  });

  it('变体 3 + 昼 → 迦勒底昼表;变体 3 + 夜 → 迦勒底夜表', () => {
    expect(termsTableForVariant(3, true, base, EGY)).toBe(CHALDEAN_TERMS_DAY);
    expect(termsTableForVariant(3, false, base, EGY)).toBe(CHALDEAN_TERMS_NIGHT);
  });

  it('迦勒底界异于埃及界(白羊界主序不同 = 用户所指「不应相同」)', () => {
    const egyptianAries = ['Jupiter', 'Venus', 'Mercury', 'Mars', 'Saturn']; // 埃及白羊界主序
    const chaldeanDayAries = CHALDEAN_TERMS_DAY.Aries.map((x) => x[0]);
    expect(chaldeanDayAries).not.toEqual(egyptianAries);
  });
});

describe('whichTerm 按所选界系取界主(右栏「位于X界」同口径)', () => {
  it('白羊 16°:埃及界=水(12-20)、迦勒底昼界=土(15-21)→ 不同界主', () => {
    const egy = whichTerm('Aries', 16, AstroConst.EGYPTIAN_TERMS);
    const chaldDay = whichTerm('Aries', 16, CHALDEAN_TERMS_DAY);
    expect(egy).not.toBe('未知');
    expect(chaldDay).not.toBe('未知');
    expect(egy).not.toBe(chaldDay); // 切界系后界主显示确实变
  });

  it('缺省 termsTable → 埃及(零回归);传迦勒底夜表 → 按夜表取', () => {
    expect(whichTerm('Aries', 16)).toBe(whichTerm('Aries', 16, AstroConst.EGYPTIAN_TERMS));
    // 白羊 16° 迦勒底夜表=水(15-21,土水互换),昼表=土 → 昼夜不同
    expect(whichTerm('Aries', 16, CHALDEAN_TERMS_NIGHT)).not.toBe(whichTerm('Aries', 16, CHALDEAN_TERMS_DAY));
  });
});

describe('界内变体(狮子土星优先/双子校勘)——与后端 push_request_terms 单源同构', () => {
	const base = AstroConst.TERMS_TABLES_BY_VARIANT;
	const EGY = AstroConst.EGYPTIAN_TERMS;

	it('v1+leoBoundFirst → 狮子首界土星(与后端 _TETRABIBLOS_LEO_SATURN_FIRST 逐格一致),余座不动', () => {
		const t = termsTableForVariant(1, true, base, EGY, { leoBoundFirst: 1 });
		expect(t.Leo).toEqual([['Saturn', 0, 6], ['Mercury', 6, 13], ['Jupiter', 13, 19], ['Venus', 19, 25], ['Mars', 25, 30]]);
		expect(t.Aries).toEqual(base[1].Aries);
		expect(whichTerm('Leo', 5, t)).not.toBe(whichTerm('Leo', 5, base[1]));   // 狮子5°:土 vs 木
	});

	it('v2+geminiBoundEmended → 双子界4/5对调(与后端 _LILLY_GEMINI_EMENDED 逐格一致),余座不动', () => {
		const t = termsTableForVariant(2, true, base, EGY, { geminiBoundEmended: '1' });
		expect(t.Gemini).toEqual([['Mercury', 0, 7], ['Jupiter', 7, 14], ['Venus', 14, 21], ['Mars', 21, 25], ['Saturn', 25, 30]]);
		expect(t.Cancer).toEqual(base[2].Cancer);
	});

	it('零回归锚:不传 opts/键为 0 → 恒基表引用;变体只在对应界系生效(v0+leo 不变、v1+gemini 不变)', () => {
		expect(termsTableForVariant(1, true, base, EGY)).toBe(base[1]);
		expect(termsTableForVariant(1, true, base, EGY, { leoBoundFirst: 0 })).toBe(base[1]);
		expect(termsTableForVariant(0, true, base, EGY, { leoBoundFirst: 1 })).toBe(base[0]);
		expect(termsTableForVariant(1, true, base, EGY, { geminiBoundEmended: 1 })).toBe(base[1]);
		expect(termsTableForVariant(2, true, base, EGY, { leoBoundFirst: 1 })).toBe(base[2]);
	});

	it('变体表 memo:同基表两次调用同引用(渲染热路径零重建)', () => {
		const a = termsTableForVariant(1, true, base, EGY, { leoBoundFirst: 1 });
		const b = termsTableForVariant(1, false, base, EGY, { leoBoundFirst: true });
		expect(a).toBe(b);
	});
});
