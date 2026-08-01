// 量化盘 四流派软预设守卫(WP-1):classic=现状零回归基线、cosmo Basic Five、后端参数映射。
import { SCHOOL_OPTIONS, SCHOOL_PRESETS, personalSetForSchool, schoolToBackendParams, presetForSchool } from '../UranianSchools';
import { ARIES_POINT, SOUTH_NODE, SUN, MOON, ASC, MC, NORTH_NODE } from '../../../constants/AstroConst';

describe('UranianSchools 四流派预设', () => {
  it('4 流派选项齐全', () => {
    expect(SCHOOL_OPTIONS.map((o) => o.value)).toEqual(['classic', 'pure', 'uranian', 'cosmo']);
  });

  it('classic = 现状零回归基线(虚星开/90°盘/orb1/无十字指针/折叠盘)', () => {
    const w = SCHOOL_PRESETS.classic;
    expect(w.includeTnp).toBe(true);
    expect(w.dialBase).toBe(90);
    expect(w.orbMidpoint).toBe(1.0);
    expect(w.crossPointer).toBe(false);
    expect(w.cosmogramDefault).toBe(false);
  });

  it('classic 个人点含白羊点 + 南交(汉堡六点+白羊)', () => {
    const keys = SCHOOL_PRESETS.classic.personalKeys;
    expect(keys).toContain(ARIES_POINT);
    expect(keys).toContain(SOUTH_NODE);
  });

  it('cosmo Basic Five:无虚星 / 无白羊点 / 无南交 / orbPersonal=5 / 默认宇宙图', () => {
    const c = SCHOOL_PRESETS.cosmo;
    expect(c.includeTnp).toBe(false);
    expect(c.personalKeys).toEqual([SUN, MOON, ASC, MC, NORTH_NODE]);
    expect(c.personalKeys).not.toContain(ARIES_POINT);
    expect(c.orbPersonal).toBe(5.0);
    expect(c.ephemBase).toBe(45);
    expect(c.cosmogramDefault).toBe(true);
  });

  it('pure 纯净派:十字指针开 + orb 0.5 + 无宫框', () => {
    expect(SCHOOL_PRESETS.pure.crossPointer).toBe(true);
    expect(SCHOOL_PRESETS.pure.orbMidpoint).toBe(0.5);
    expect(SCHOOL_PRESETS.pure.showHouseFrames).toBe(false);
  });

  it('personalSetForSchool 返回 Set;cosmo 5 点、classic 7 点', () => {
    expect(personalSetForSchool('cosmo').size).toBe(5);
    expect(personalSetForSchool('classic').size).toBe(7);
    expect(personalSetForSchool('cosmo').has(ARIES_POINT)).toBe(false);
  });

  it('schoolToBackendParams 只发白名单键(D3:剔除 Java 层静默丢弃的 includeTnp/orbMidpoint/orbPersonal)', () => {
    // 后端 include_tnp 由 school 反推、orb/personalOrb 由调用方 live 值覆盖;frames 供无 live 状态调用方兜底。
    expect(schoolToBackendParams('cosmo')).toEqual({ school: 'cosmo', frames: false });
    expect(schoolToBackendParams('classic')).toEqual({ school: 'classic', frames: true });
    // 防回潮:任何新键出现在返回值 = 必须已登记 GermanyTechController 白名单(见函数头注释)。
    expect(Object.keys(schoolToBackendParams('uranian')).sort()).toEqual(['frames', 'school']);
  });

  it('未知流派回退 classic', () => {
    expect(presetForSchool('nonsense')).toBe(SCHOOL_PRESETS.classic);
  });
});
