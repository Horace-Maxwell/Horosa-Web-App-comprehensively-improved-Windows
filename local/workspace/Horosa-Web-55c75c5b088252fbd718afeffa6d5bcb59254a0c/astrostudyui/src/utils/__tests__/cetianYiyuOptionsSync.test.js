/**
 * 策天飞星·移语本选项三方同键哨兵（死开关根治锁）。
 *
 * 铁律：每个排盘选项键必须同时存在于
 *   ① KinAstroMain.buildPayload（页面重排下发）
 *   ② techniqueMountSettings cetian schema（AI 挂载齿轮）
 *   ③ aiAnalysisContext case 'cetian' 的 optionsOverride 显式透传（无头重算）
 * 任一缺位 = 该键在对应链路上是死开关（UI 显示已改、快照/盘面逐字节不变）。
 * 采用机械提取（源文本字面量键）而非运行时 mock —— 与奇门 RECALC 哨兵同范式。
 */
import fs from 'fs';
import path from 'path';

import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../aiAnalysisContext';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

// 移语本新增 13 键 + 既有 8 键 = 服务端 pan() 消费的全部 cetian 选项键。
const YIYU_KEYS = [
  'brightnessSchool', 'shenGongMode', 'daxianMode', 'tianluoMode', 'palaceNameMode',
  'liunianYear', 'liunianQishaMode',
  'showLiunian', 'showShensha', 'showZaYao', 'showDuanjue', 'showXiu', 'showBianyao',
];
const LEGACY_KEYS = [
  'method', 'lunarMode', 'starOrder',
  'showBrightness', 'showWuXingJu', 'showSihua', 'showFlying', 'showSolarTerm',
];
const ALL_KEYS = [...LEGACY_KEYS, ...YIYU_KEYS];

describe('策天移语本选项三方同键', () => {
  test('① buildPayload 下发全部 21 键', () => {
    const src = read('components/kinastro/KinAstroMain.js');
    const block = src.slice(src.indexOf("if(this.config.serviceKey === 'cetian'){"));
    const scoped = block.slice(0, block.indexOf('\n\t\t}'));
    ALL_KEYS.forEach((key) => {
      expect(scoped).toContain(`payload.${key} = `);
    });
  });

  test('② 挂载 schema 登记全部 21 键（book 键挂 when.method=book）', () => {
    const schema = getTechniqueSettingsSchema('cetian');
    expect(schema).toBeTruthy();
    const byName = {};
    (schema.fields || []).forEach((f) => { byName[f.name] = f; });
    ALL_KEYS.forEach((key) => {
      expect(byName[key]).toBeTruthy();
    });
    YIYU_KEYS.forEach((key) => {
      expect(byName[key].when).toEqual({ method: 'book' });
    });
  });

  test('③ aiAnalysisContext cetian 分派显式透传全部 21 键', () => {
    const src = read('utils/aiAnalysisContext.js');
    const start = src.indexOf("case 'cetian':");
    const block = src.slice(start, src.indexOf('});', start));
    ALL_KEYS.forEach((key) => {
      expect(block).toContain(`${key}: record.${key}`);
    });
  });

  test('左栏控件与 state 默认值齐备（13 新键各有控件绑定）', () => {
    const src = read('components/kinastro/KinAstroMain.js');
    const stateKeys = [
      'cetianBrightnessSchool', 'cetianShenGongMode', 'cetianDaxianMode',
      'cetianTianluoMode', 'cetianPalaceNameMode', 'cetianLiunianYear',
      'cetianLiunianQishaMode', 'cetianShowLiunian', 'cetianShowShensha',
      'cetianShowZaYao', 'cetianShowDuanjue', 'cetianShowXiu', 'cetianShowBianyao',
    ];
    stateKeys.forEach((key) => {
      expect(src).toContain(`${key}: `);            // state 默认值
      expect(src).toContain(`this.state.${key}`);   // 控件读值
      // 每个控件变更必须挂 clickPlot 全量重排（写而不动作 = 死开关）
      const idx = src.indexOf(`this.setState({ ${key}`);
      expect(idx).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 120)).toContain('this.clickPlot');
    });
  });

  test('四本账归属：命盘账在/事盘账不在/导出 preset 53 段', () => {
    // 策天为纯命盘技法：起课性事盘不适用（挂载重算按出生时间,事盘绝不按时间复算铁律）。
    expect(ANALYSIS_CHART_TECHNIQUES).toContain('cetian');
    expect(ANALYSIS_CASE_TECHNIQUES).not.toContain('cetian');
    // 导出 preset = 书法(移语本增强+僧道宫名变体)∪原法 全段并集,漂移即咬。
    expect(AI_EXPORT_PRESET_SECTIONS.cetian).toHaveLength(53);
    ['运限', '断诀', '星曜别名', '神煞·岁前', '衣鉢宮', '僧道宮', '飞化规则']
      .forEach((sec) => expect(AI_EXPORT_PRESET_SECTIONS.cetian).toContain(sec));
  });

  test('schema 默认值与左栏 state 默认一致（移语本默认口径）', () => {
    const schema = getTechniqueSettingsSchema('cetian');
    const byName = {};
    (schema.fields || []).forEach((f) => { byName[f.name] = f; });
    expect(byName.brightnessSchool.default).toBe('yiyu');
    expect(byName.shenGongMode.default).toBe('yizheng');
    expect(byName.daxianMode.default).toBe('yiyu');
    expect(byName.tianluoMode.default).toBe('benshu');
    expect(byName.palaceNameMode.default).toBe('common');
    expect(byName.liunianQishaMode.default).toBe('shengshi');
    ['showLiunian', 'showShensha', 'showZaYao', 'showDuanjue', 'showXiu', 'showBianyao']
      .forEach((k) => expect(byName[k].default).toBe(1));
  });
});
