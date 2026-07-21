import { buildGuicePan } from '../core/guicePan';
import { qiGuaByTime } from '../core/guiceQiGua';
import { getGuiceOptionsKey, DEFAULT_GUICE_SETTINGS } from '../guiceSchools';

const G = qiGuaByTime({ yearZhi: '辰', lunarMonth: 5, lunarDay: 25, hourZhi: '午' });   // 火泽睽 六爻动
const CTX = { yearZhi: '辰', monthZhi: '午', year: 2000, hourZhi: '午', pillars: ['庚辰', '壬午', '丙申', '甲午'], dayGan: '丙' };

describe('轨策·盘 · 一盘之全（中右栏同源）', () => {
  test('起卦所得入盘：火泽睽 六爻动', () => {
    const p = buildGuicePan({ gua: G, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS });
    expect([p.gua.up, p.gua.lo, p.gua.dongYao]).toEqual(['离', '兑', 6]);
    expect(p.gua.name).toBe('火泽睽');
    expect(p.bianName).toBe('雷泽归妹');
  });
  test('六件皆出：演数/卦变/断法/十应/历史 + 大定（唯九畴之系用之）', () => {
    const p = buildGuicePan({ gua: G, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS });
    expect(p.yan.value).toBeGreaterThan(0);
    expect(p.bian.hu.tiHu).toBeTruthy();
    expect(p.duan.tiYong).toBeTruthy();
    expect(p.ying.items).toHaveLength(10);
    expect(p.lishi.zhiNian.gua).toBe('小过');   // 2000 年
    expect(p.dading).toBeNull();               // 默认非九畴 → 不出，不臆造
    const d = buildGuicePan({ gua: G, ctx: CTX, settings: { ...DEFAULT_GUICE_SETTINGS, qiguaShu: 'jiuchou' } });
    expect(d.dading.value).toBeGreaterThan(0);
  });
  // 🔴 此处曾有一条「十个开关逐个翻转 → 盘必变」，其实并不守这句话:
  //    它把翻了也不变的四个(qiguaFa/addHour/shenSha/shiFang)列进 noCalcEffect 白名单,
  //    说「其属起卦与断之层，不改演算，然选项键必变 → 快照必刷」,于是只验其【键】变。
  //    可键变不等于盘变 —— 那四个里有三个于引擎【零消费】,是彻底的死开关(live 实跑翻之
  //    中右栏纹丝不动),而这条测试恰恰替它们出具了「豁免」。教训:白名单一开,守的就不是
  //    原话了;判据须是「盘真的不同」,而非「键真的不同」。
  //    今真闸在 guiceSwitches.test.js「机械遍历:每个开关翻之,盘必真的不同(死开关总闸)」,
  //    其无白名单、机械遍历、且以 GUICE_OPTION_KEYS 反查漏登。此处不再重复一条弱的。
  test('选项键随开关变（快照刷新之触发；「盘必真异」之强闸在 guiceSwitches）', () => {
    expect(getGuiceOptionsKey({ ...DEFAULT_GUICE_SETTINGS, yanshuFa: 'gui' }))
      .not.toBe(getGuiceOptionsKey(DEFAULT_GUICE_SETTINGS));
  });
  test('缺卦/坏卦 → null，不抛', () => {
    expect(buildGuicePan({ gua: null, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS })).toBeNull();
    expect(buildGuicePan({ gua: { up: '甲', lo: '兑', dongYao: 6 }, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS })).toBeNull();
  });
  test('缺时地 → 该项为空而盘仍出（不因缺 context 而全盘失）', () => {
    const p = buildGuicePan({ gua: G, ctx: {}, settings: DEFAULT_GUICE_SETTINGS });
    expect(p.yan.value).toBeGreaterThan(0);
    expect(p.lishi.zhiNian).toBeNull();
    expect(p.dading).toBeNull();
  });
  test('🔴 互卦之处不出六十四卦名（只出两个八卦）', () => {
    const p = buildGuicePan({ gua: G, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS });
    expect(JSON.stringify(p.bian.hu)).not.toMatch(/为[天泽火雷风水山地]|[火水风雷山泽天地][火水风雷山泽天地][^,}"]/);
    expect(p.bian.hu.shangHu.length).toBe(1);
    expect(p.bian.hu.xiaHu.length).toBe(1);
  });
});
