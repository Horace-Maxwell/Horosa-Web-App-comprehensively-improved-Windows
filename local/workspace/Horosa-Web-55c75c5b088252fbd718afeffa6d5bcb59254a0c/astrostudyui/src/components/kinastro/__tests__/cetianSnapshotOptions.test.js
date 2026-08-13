/**
 * 策天飞星·AI 挂载无头重算链直测（QA-4：防死齿轮的机械证明）。
 *
 * 链路：aiAnalysisContext(record.*→optionsOverride 显式 21 键,已有哨兵锁)
 *   → buildKinAstroSnapshotForFields(optionsOverride→payload 合并)   ← 本测试
 *   → postKinAstro(payload→服务端消费,API 压测矩阵覆盖)
 * mock cachedKentangFetch 捕获真实下发 payload;服务端 snapshot 用 payload 回显模拟,
 * 从而「逐键改值→快照字节变化」可在 jest 内闭环断言。
 */
import { buildKinAstroSnapshotForFields } from '../KinAstroMain';
import { cachedKentangFetch } from '../../../utils/kentangCache';

jest.mock('../../../utils/kentangCache', () => ({
  cachedKentangFetch: jest.fn(),
}));
jest.mock('../../../utils/stepPrefetch', () => ({
  primeStepPrefetch: jest.fn(),
  consumePrefetchedPan: jest.fn(() => null),
}));

// antd form 形状(parseFieldsDateTime 约定):date/time 为 {value: moment};stub format 返回固定串。
const FIELDS = {
  date: { value: { format: () => '1975-12-29' } },
  time: { value: { format: () => '20:00:00' } },
  zone: { value: '8' }, lat: { value: '26.0667' }, lon: { value: '119.3167' },
  gender: { value: '1' },
};

const YIYU_KEYS = {
  brightnessSchool: ['yiyu', 'quanji'],
  shenGongMode: ['yizheng', 'literal'],
  daxianMode: ['yiyu', 'legacy'],
  tianluoMode: ['benshu', 'zhongtian'],
  palaceNameMode: ['common', 'monk'],
  liunianYear: [2026, 1999],
  liunianQishaMode: ['shengshi', 'suishu'],
  showLiunian: [1, 0],
  showShensha: [1, 0],
  showZaYao: [1, 0],
  showDuanjue: [1, 0],
  showXiu: [1, 0],
  showBianyao: [1, 0],
};
const LEGACY_KEYS = {
  method: ['book', 'kentang'],
  lunarMode: ['sxtwl', 'classic'],
  starOrder: ['reverse', 'forward'],
  showBrightness: [1, 0],
  showWuXingJu: [1, 0],
  showSihua: [1, 0],
  showFlying: [1, 0],
  showSolarTerm: [1, 0],
};

let captured;
beforeEach(() => {
  captured = [];
  cachedKentangFetch.mockReset();
  cachedKentangFetch.mockImplementation(async (url, opts) => {
    const payload = JSON.parse(opts.body);
    captured.push(payload);
    // 服务端模拟:snapshot=payload 回显 → 快照文本随任一键变化而变化。
    return {
      text: async () => JSON.stringify({
        ResultCode: 0,
        Result: { snapshot: `SNAP::${JSON.stringify(payload)}`, sections: [] },
      }),
    };
  });
});

describe('策天挂载无头重算:optionsOverride→payload→快照', () => {
  test('全 21 键透传进 payload(非空值覆盖)', async () => {
    const override = {};
    Object.keys(YIYU_KEYS).forEach((k) => { override[k] = YIYU_KEYS[k][1]; });
    Object.keys(LEGACY_KEYS).forEach((k) => { override[k] = LEGACY_KEYS[k][1]; });
    const snap = await buildKinAstroSnapshotForFields(FIELDS, 'cetian', override);
    expect(captured.length).toBe(1);
    const payload = captured[0];
    Object.keys(override).forEach((k) => {
      expect(payload[k]).toBe(override[k]);
    });
    expect(snap).toContain('SNAP::');
  });

  test('空值(空串/null/undefined)不覆盖 payload(零回归口径)', async () => {
    await buildKinAstroSnapshotForFields(FIELDS, 'cetian', {
      brightnessSchool: '', shenGongMode: null, daxianMode: undefined, liunianYear: 2026,
    });
    const payload = captured[0];
    expect(payload.brightnessSchool).toBeUndefined();
    expect(payload.shenGongMode).toBeUndefined();
    expect(payload.daxianMode).toBeUndefined();
    expect(payload.liunianYear).toBe(2026);
  });

  test('逐键改值 → payload 与快照逐键变化(21 键无死齿轮)', async () => {
    const allKeys = { ...YIYU_KEYS, ...LEGACY_KEYS };
    for (const key of Object.keys(allKeys)) {
      const [a, b] = allKeys[key];
      const snapA = await buildKinAstroSnapshotForFields(FIELDS, 'cetian', { [key]: a });
      const snapB = await buildKinAstroSnapshotForFields(FIELDS, 'cetian', { [key]: b });
      const pA = captured[captured.length - 2];
      const pB = captured[captured.length - 1];
      expect(pA[key]).toBe(a);
      expect(pB[key]).toBe(b);
      expect(snapA).not.toBe(snapB);   // 快照随该键变化 → 该齿轮活
    }
  });

  test('showXxx=0(falsy 数字)必须照样透传(0 被跳过=显示开关死齿轮)', async () => {
    await buildKinAstroSnapshotForFields(FIELDS, 'cetian', {
      showLiunian: 0, showShensha: 0, showZaYao: 0, showDuanjue: 0,
      showXiu: 0, showBianyao: 0, showBrightness: 0,
    });
    const payload = captured[0];
    ['showLiunian', 'showShensha', 'showZaYao', 'showDuanjue', 'showXiu', 'showBianyao', 'showBrightness']
      .forEach((k) => { expect(payload[k]).toBe(0); });
  });
});
