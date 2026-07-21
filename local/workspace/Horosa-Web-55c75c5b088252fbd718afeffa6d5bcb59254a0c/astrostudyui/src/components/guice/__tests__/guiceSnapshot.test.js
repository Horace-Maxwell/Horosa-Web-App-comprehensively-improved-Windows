// 皇极轨策 · AI 快照金标。段头须与 aiExport 之段表逐字一致（否则严格切片零命中→整盘兜底）。
import { buildGuiceSnapshotText } from '../guiceSnapshot';
import { buildGuicePan } from '../core/guicePan';
import { qiGuaByTime } from '../core/guiceQiGua';
import { DEFAULT_GUICE_SETTINGS } from '../guiceSchools';

const G = qiGuaByTime({ yearZhi: '辰', lunarMonth: 5, lunarDay: 25, hourZhi: '午' });
const CTX = { yearZhi: '辰', monthZhi: '午', year: 2000, hourZhi: '午', pillars: ['庚辰', '壬午', '丙申', '甲午'], dayGan: '丙', askEvent: '问行止' };
const pan = (o) => buildGuicePan({ gua: G, ctx: CTX, settings: { ...DEFAULT_GUICE_SETTINGS, ...o } });

export const GUICE_SECTION_HEADS = ['[占事直断]', '[起卦]', '[演数]', '[四位]', '[卦变]', '[断法]', '[三要十应]', '[元会运世]', '[大定起数]'];

describe('轨策·快照 · 段头齐备', () => {
  test('八段常出（大定唯九畴之系出）', () => {
    const t = buildGuiceSnapshotText(pan());
    GUICE_SECTION_HEADS.filter((h) => h !== '[大定起数]').forEach((h) => expect(t).toContain(h));
    expect(t).not.toContain('[大定起数]');
    expect(buildGuiceSnapshotText(pan({ qiguaShu: 'jiuchou' }))).toContain('[大定起数]');
  });
  test('走 GFM 表（每段皆有表头分隔行）', () => {
    const t = buildGuiceSnapshotText(pan());
    expect((t.match(/\| --- \|/g) || []).length).toBeGreaterThanOrEqual(7);
  });
  test('占事入首段（占卜立框）', () => {
    expect(buildGuiceSnapshotText(pan())).toContain('问行止');
  });
  test('🔴 零字面 null/undefined/NaN/[object', () => {
    ['null', 'undefined', 'NaN', '[object'].forEach((bad) => {
      expect(buildGuiceSnapshotText(pan())).not.toContain(bad);
      expect(buildGuiceSnapshotText(pan({ qiguaShu: 'jiuchou' }))).not.toContain(bad);
    });
  });
  // 诸开关之生效各有其分际 —— 据实分之，不假装「个个都改快照」：
  //   · 径改演算者：演数 / 数字配卦 / 十应名目
  //   · 有条件者：寄宫（唯后天正数与九畴之系用之，五行生成数本无寄宫）；定数（唯大定出之）
  //   · 不入演算者：数系 / 神煞 / 时方 / 加时 / 起卦法 —— 其变见于选项键与左栏，快照不必随之
  test('🔴 径改演算之开关 → 快照必变', () => {
    const base = buildGuiceSnapshotText(pan());
    [['yanshuFa', 'gui'], ['qiguaShu', 'houtian'], ['shiyingSet', 'rizhen']].forEach(([k, v]) => {
      expect(buildGuiceSnapshotText(pan({ [k]: v }))).not.toBe(base);
    });
  });
  test('🔴 有条件之开关：于其所辖之档内必变，其外不动（此即其分际，非失效）', () => {
    // 寄宫唯「四位遇五或十」者见其别 —— 本盘(火泽睽六爻动)之数 12299，四位无五无十，故不触发。
    // 另取坤为地一爻动（11825，零位为五）验之。
    const K = (o) => buildGuiceSnapshotText(buildGuicePan({
      gua: { up: '坤', lo: '坤', dongYao: 1, fa: 'baoshu' }, ctx: CTX,
      settings: { ...DEFAULT_GUICE_SETTINGS, ...o },
    }));
    expect(K({ qiguaShu: 'houtian', jiGongMode: 'wuGen' })).not.toBe(K({ qiguaShu: 'houtian', jiGongMode: 'wuKun' }));
    // 五行生成数本无寄宫 → 纵遇五亦不随此开关而变
    expect(K({ qiguaShu: 'xiantian', jiGongMode: 'wuGen' })).toBe(K({ qiguaShu: 'xiantian', jiGongMode: 'wuKun' }));
    // 本盘四位无五无十 → 后天正数下亦不随之变（此为盘之实，非开关失效）
    expect(buildGuiceSnapshotText(pan({ qiguaShu: 'houtian', jiGongMode: 'wuGen' })))
      .toBe(buildGuiceSnapshotText(pan({ qiguaShu: 'houtian', jiGongMode: 'wuKun' })));
    // 定数：大定下变；其外不出大定段
    expect(buildGuiceSnapshotText(pan({ qiguaShu: 'jiuchou', dadingTable: 'dading' })))
      .not.toBe(buildGuiceSnapshotText(pan({ qiguaShu: 'jiuchou', dadingTable: 'xinyifawei' })));
  });
  test('空参/坏盘 → 空串，不抛', () => {
    expect(buildGuiceSnapshotText(null)).toBe('');
    expect(buildGuiceSnapshotText({})).toBe('');
    expect(buildGuiceSnapshotText({ gua: null })).toBe('');
  });
  test('十应未录者显式标「未录」—— 不臆造', () => {
    expect(buildGuiceSnapshotText(pan())).toContain('（未录）');
  });
  test('🔴 互卦之处只出八卦名，不出六十四卦名', () => {
    const t = buildGuiceSnapshotText(pan());
    const huRow = t.split('\n').find((l) => l.indexOf('| 体互 |') >= 0);
    expect(huRow).toBeTruthy();
    expect(huRow.replace(/\| 体互 \| /, '').replace(/ \|$/, '').trim().length).toBe(1);
  });
});
