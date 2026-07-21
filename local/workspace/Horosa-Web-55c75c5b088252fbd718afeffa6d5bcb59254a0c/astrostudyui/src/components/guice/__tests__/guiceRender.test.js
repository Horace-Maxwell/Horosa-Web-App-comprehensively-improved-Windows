// 皇极轨策 · 组件渲染冒烟（SSR，捕获运行时 JSX 错）+「改选项中右栏必都变」实证。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GuiceMain from '../GuiceMain';
import { DEFAULT_GUICE_SETTINGS } from '../guiceSchools';

// 🔴 VALUE 是排盘所出之真形状 —— 逐键经浏览器实测真对象核过,不得照想当然自造。
//    此前本文件喂的是自造的 FIELDS({nongli:{value:{yearZhi…}}}),仓里压根没有那个形状:
//    props.fields 只是表单字段(date/time/zone/lat/lon…),其上无 nongli;农历干支在
//    props.value.chart.nongli 上。喂自造形状 → 测的是自己的想象 → 21 例全绿而真机
//    「所需之输入未足,本法不可起卦」(live 实跑才抓出)。
//    三处反直觉:时柱在 bazi.time(非 hour);nongli.year 是干支非公历年(公历年自 date 取);
//    干支之字在 stem.cell / branch.cell。
const zhu = (ganzi) => ({
  ganzi, stem: { cell: ganzi[0] }, branch: { cell: ganzi[1] },
});
const VALUE = { chart: { nongli: {
  date: '2000-06-26', year: '庚辰', monthInt: 5, dayInt: 25, leap: false,
  bazi: { year: zhu('庚辰'), month: zhu('壬午'), day: zhu('丙申'), time: zhu('甲午') },
} } };
const FIELDS = { date: '2000-06-26', time: '12:00', zone: 8 };   // 真 fields 之貌(无 nongli)

// 起卦所得为冻结值 → 直接注入 state（模拟已起之卦：火泽睽六爻动）
const render = (slot, settings, gua) => {
  const props = { slot, fields: FIELDS, value: VALUE };
  const el = React.createElement(GuiceMain, props);
  const inst = new GuiceMain(props);
  inst.state = { ...inst.state, settings: { ...DEFAULT_GUICE_SETTINGS, ...settings },
    gua: gua || { up: '离', lo: '兑', dongYao: 6, fa: 'time', steps: [] }, inputs: {}, shiyingInputs: {}, auxTab: 'overview' };
  inst.props = props;
  void el;
  return renderToStaticMarkup(inst.render());
};

describe('轨策 · 渲染冒烟', () => {
  test('中栏渲染不抛且有内容', () => {
    const h = render('center');
    expect(h).toContain('horosa-guice-page');
    expect(h).toContain('火泽睽');
  });
  test('右栏渲染不抛', () => { expect(render('aux')).toBeTruthy(); });
  test('左栏渲染不抛（含起卦之钮）', () => {
    const h = render('controls');
    expect(h).toContain('起卦');
  });
  test('未起卦 → 空态，不抛', () => {
    const inst = new GuiceMain({ slot: 'center', fields: FIELDS, value: VALUE });
    inst.props = { slot: 'center', fields: FIELDS, value: VALUE };
    expect(renderToStaticMarkup(inst.render())).toContain('horosa-huangji-empty');
  });
  test('缺时地 → 仍出盘（不因缺 context 而全失）', () => {
    const inst = new GuiceMain({ slot: 'center', fields: {} });
    inst.state = { ...inst.state, gua: { up: '离', lo: '兑', dongYao: 6, fa: 'time', steps: [] }, inputs: {}, shiyingInputs: {} };
    inst.props = { slot: 'center', fields: {} };
    expect(renderToStaticMarkup(inst.render())).toContain('horosa-guice-page');
  });
});

describe('轨策 · 改选项 → 中右栏都必变（防「勾了没反应」）', () => {
  // 演数与配卦径入两栏；十应唯右栏有其目（中栏本不列十应）—— 据实分之
  test.each([['yanshuFa', 'ce', 'gui'], ['qiguaShu', 'xiantian', 'houtian']])('改「%s」→ 中右栏皆变', (key, a, b) => {
    ['center', 'aux'].forEach((slot) => {
      expect(render(slot, { [key]: a })).not.toBe(render(slot, { [key]: b }));
    });
  });
  test('改「十应之套」→ 右栏变（中栏本无十应之目）', () => {
    expect(render('aux', { shiyingSet: 'xinyifawei' })).not.toBe(render('aux', { shiyingSet: 'rizhen' }));
  });
  test('大定：切至九畴之系 → 中栏多出大定起数', () => {
    expect(render('center', { qiguaShu: 'jiuchou' })).toContain('大定起数');
    expect(render('center', { qiguaShu: 'xiantian' })).not.toContain('大定起数');
  });
  test('左栏：切数系至梅花 → 神煞/时方之控件隐（死控件不留）', () => {
    const a = render('controls', { shuXi: 'zhouyi' });
    const b = render('controls', { shuXi: 'meihua' });
    expect(a).toContain('神煞');
    expect(b).not.toContain('神煞');
  });
  test('左栏：切起卦法 → 其专属输入随之换', () => {
    // 断言落到控件之 label（<span>丈数</span>）—— 丈尺占之 hint 文案含「寸数不用」四字，全文匹配会误判
    const label = (h, t) => h.indexOf(`<span>${t}</span>`) >= 0;
    expect(label(render('controls', { qiguaFa: 'zhangchi' }), '丈数')).toBe(true);
    expect(label(render('controls', { qiguaFa: 'chicun' }), '寸数')).toBe(true);
    expect(label(render('controls', { qiguaFa: 'zhangchi' }), '寸数')).toBe(false);
    expect(label(render('controls', { qiguaFa: 'zizhan' }), '所占之字')).toBe(true);
  });
  test('🔴 起卦法之控件只一（不与元表重出）', () => {
    const h = render('controls');
    expect((h.match(/<span>起卦法<\/span>/g) || []).length).toBe(1);
  });
  test('左栏：切十应之套 → 其目随之换（折叠未展则只出其题，故验题）', () => {
    expect(render('controls', { shiyingSet: 'xinyifawei' })).toContain('心易发微版');
    expect(render('controls', { shiyingSet: 'rizhen' })).toContain('日辰秘文版');
    expect(render('controls', { shiyingSet: 'meihua' })).toContain('梅花原书版');
  });
});

describe('轨策 · 渲染产物不得漏出字面 null/undefined', () => {
  test.each([['center'], ['aux'], ['controls']])('%s 栏零字面 null/undefined/NaN/[object', (slot) => {
    const text = render(slot).replace(/<[^>]*>/g, ' ');
    ['null', 'undefined', 'NaN', '[object'].forEach((bad) => expect(text).not.toContain(bad));
  });
  test('乾为天（乾坤无互 → 互其变卦）中栏照出其由，且零字面 null', () => {
    const h = render('center', {}, { up: '乾', lo: '乾', dongYao: 5, fa: 'time', steps: [] });
    expect(h).toContain('乾坤无互');
    expect(h.replace(/<[^>]*>/g, ' ')).not.toContain('undefined');
  });
});

// 🔴 此前【无一例真走 doQiGua】—— 各例都把已起之卦直接注入 state,故 ctx() 取数源与八个
//    字段名全错也无人发觉(真机上「年月日时起例」这种只要时刻的法子都起不出卦)。补此端到端例。
describe('轨策 · 真起卦端到端(ctx 取数须真通,非注入既成之卦)', () => {
  const newInst = (settings) => {
    const props = { fields: FIELDS, value: VALUE };
    const inst = new GuiceMain(props);
    inst.props = props;
    inst.state = { ...inst.state, settings: { ...DEFAULT_GUICE_SETTINGS, ...settings }, inputs: {}, shiyingInputs: {} };
    inst.setState = (patch) => { inst.state = { ...inst.state, ...(typeof patch === 'function' ? patch(inst.state) : patch) }; };
    return inst;
  };

  test('ctx 自 props.value.chart.nongli 取全八项(全非空)', () => {
    const c = newInst().ctx();
    expect(c).toMatchObject({
      yearZhi: '辰', monthZhi: '午', lunarMonth: 5, lunarDay: 25,
      hourZhi: '午', year: 2000, dayGan: '丙',
      pillars: ['庚辰', '壬午', '丙申', '甲午'],
    });
  });

  test('🔴 年月日时起例:点起卦即出卦,不得报「所需之输入未足」', () => {
    const inst = newInst({ qiguaFa: 'time' });
    inst.doQiGua();
    expect(inst.state.error).toBe('');
    expect(inst.state.gua).toBeTruthy();
    expect(inst.state.gua.up).toBeTruthy();
    expect(inst.state.gua.lo).toBeTruthy();
    expect(inst.state.gua.dongYao).toBeGreaterThanOrEqual(1);
    expect(inst.state.gua.dongYao).toBeLessThanOrEqual(6);
  });

  test('🔴 起卦既成,三栏皆出真内容(非空态)', () => {
    const inst = newInst({ qiguaFa: 'time' });
    inst.doQiGua();
    const h = renderToStaticMarkup(inst.render());
    expect(h).toContain('轨策设置');      // 左栏
    expect(h).toContain('轨策信息');      // 右栏
    expect(h).not.toContain('请择起卦法而起卦');
    expect(h.replace(/<[^>]*>/g, ' ')).not.toContain('undefined');
  });

  test('🔴 ctx 空(未排盘)→ 明说不可起卦,不抛也不臆造一个卦', () => {
    const props = { fields: {}, value: null };
    const inst = new GuiceMain(props);
    inst.props = props;
    inst.setState = (patch) => { inst.state = { ...inst.state, ...patch }; };
    expect(() => inst.doQiGua()).not.toThrow();
    expect(inst.state.gua).toBeNull();
    expect(inst.state.error).toBeTruthy();
  });

  test('🔴 换盘(value 变)→ 同法所起之卦随之变(ctx 真入演算,非摆设)', () => {
    const a = newInst({ qiguaFa: 'time' }); a.doQiGua();
    const b = newInst({ qiguaFa: 'time' });
    b.props = { fields: FIELDS, value: { chart: { nongli: {
      date: '1990-03-03', year: '庚午', monthInt: 2, dayInt: 7, leap: false,
      bazi: { year: zhu('庚午'), month: zhu('己卯'), day: zhu('丁丑'), time: zhu('壬寅') },
    } } } };
    b.doQiGua();
    expect(b.state.error).toBe('');
    const key = (x) => `${x.state.gua.up}${x.state.gua.lo}${x.state.gua.dongYao}`;
    expect(key(a)).not.toBe(key(b));
  });
});
