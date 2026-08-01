# -*- coding: utf-8 -*-
"""G8 三旗盘 + G11 校时判据层。

G8 守:判定 100% 委托 gochara(吉凶/Vedha 零新写)· blocker_filter 缺省行为逐字
不变 · goodHousesByPlanet 抽顶层(行内不重复携带)。
G11 守:Pranapada 宫判据(🔴 第 3 宫 neutral,权威未列 —— 歧义 A9)· RP 自指消解
(歧义 A8)· 事件宫组逐字对 §12.5 · 步长诊断以 KP 最窄 Sub 0°40′ 为准 · runs 合并。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from flatlib import const  # noqa: E402

from astrostudy.india import tripataki as tp  # noqa: E402
from astrostudy.india import rectification as rf  # noqa: E402
from astrostudy.india.gochara import apply_vedha, transit_from_reference  # noqa: E402


# ── G8 三旗 ────────────────────────────────────────────────────────────────
def _signs(**kw):
    m = {'sun': const.SUN, 'moon': const.MOON, 'mars': const.MARS, 'mercury': const.MERCURY,
         'jupiter': const.JUPITER, 'venus': const.VENUS, 'saturn': const.SATURN,
         'rahu': const.NORTH_NODE, 'ketu': const.SOUTH_NODE}
    return {m[k]: v for k, v in kw.items()}


def test_month_rows_delegate_gochara_verbatim():
    """三旗单月行 == gochara 两步(transit_from_reference + apply_vedha)逐字段一致。"""
    signs = _signs(sun=const.GEMINI, saturn=const.TAURUS, jupiter=const.LEO,
                   moon=const.ARIES, mars=const.CANCER)
    center = const.ARIES
    expect = transit_from_reference(center, signs, 'tripataki')
    apply_vedha(expect, center, signs)
    got = tp.month_rows(center, signs, 1, '2026-01-01')
    for e, g in zip(expect, got['rows']):
        for key in ('planet', 'house', 'good', 'vedhaHouse', 'vedhaBy', 'effective'):
            assert e.get(key) == g.get(key), (e['planet'], key)


def test_flag_groups_are_kendradi_presentation_only():
    signs = _signs(sun=const.ARIES, mars=const.CANCER, saturn=const.LIBRA)
    got = tp.month_rows(const.ARIES, signs, 1)
    by_planet = {r['planet']: r for r in got['rows']}
    assert by_planet[const.SUN]['flagGroup'] == 'kendra'       # house 1
    assert by_planet[const.MARS]['flagGroup'] == 'kendra'      # house 4
    assert by_planet[const.SATURN]['flagGroup'] == 'kendra'    # house 7
    assert tp.LAYOUT_SOURCE == 'horosa_derived_kendradi'


def test_build_tripataki_top_level_good_houses():
    months = [{'index': i + 1, 'label': f'2026-{i+1:02d}-01',
               'signs': _signs(sun=const.LIST_SIGNS[i % 12])} for i in range(12)]
    res = tp.build_tripataki(months, {'moon': const.ARIES, 'saturn': const.LIBRA})
    assert res['monthBasis'] == 'equal12'
    assert set(res['byCenter'].keys()) == {'moon', 'saturn'}
    assert len(res['byCenter']['moon']['months']) == 12
    # 顶层一份 goodHousesByPlanet,行内不再携带
    assert const.SUN in res['goodHousesByPlanet']
    for m in res['byCenter']['moon']['months']:
        for r in m['rows']:
            assert 'goodHouses' not in r
    # 缺中心 → 该中心显式降级
    res2 = tp.build_tripataki(months, {'moon': None})
    assert res2['byCenter']['moon']['available'] is False


def test_blocker_filter_default_identical_and_optional():
    """blocker_filter 缺省 = 现状逐字不变;过滤掉遮蔽者后 effective 翻真。"""
    # 构造:木星落吉位 2(自 ARIES 中心),罗睺落其 vedha 宫 12(=PISCES)
    signs = _signs(jupiter=const.TAURUS, rahu=const.PISCES, sun=const.LEO)
    base = transit_from_reference(const.ARIES, signs, 't')
    apply_vedha(base, const.ARIES, signs)
    jup = next(r for r in base if r['planet'] == const.JUPITER)
    assert jup['good'] and jup['vedhaBy'] == const.NORTH_NODE and not jup['effective']
    # 罗计不作遮蔽者(§8.3 可选流派)
    filt = transit_from_reference(const.ARIES, signs, 't')
    apply_vedha(filt, const.ARIES, signs,
                blocker_filter=lambda p: p not in (const.NORTH_NODE, const.SOUTH_NODE))
    jup2 = next(r for r in filt if r['planet'] == const.JUPITER)
    assert jup2['effective'] is True and jup2['vedhaBy'] is None


# ── G11 判据层 ─────────────────────────────────────────────────────────────
def test_ishta_kaal_ghati_pala():
    r = rf.ishta_kaal(90.0)                    # 日出后 90 分
    assert r['ghati'] == 3 and abs(r['pala'] - 45.0) < 1e-6
    assert rf.ishta_kaal(-10.0)['beforeSunrise'] is True


def test_pranapada_verdict_house3_neutral():
    """🔴 歧义 A9:第 3 宫权威未列 → neutral 且 0 分,绝不擅自归吉/归疑。"""
    # PP 落双子(60°),Lagna 白羊(0°) → 第 3 宫
    r = rf.pranapada_verdict(65.0, 5.0, None)
    assert r['fromLagna']['house'] == 3
    assert r['fromLagna']['verdict'] == 'neutral'
    assert r['neutralNote'] is not None
    # 吉宫与疑宫
    assert rf.pranapada_verdict(35.0, 5.0, None)['fromLagna']['verdict'] == 'good'      # 2 宫
    assert rf.pranapada_verdict(155.0, 5.0, None)['fromLagna']['verdict'] == 'suspect'  # 6 宫
    # 综合取更差(保守)
    both = rf.pranapada_verdict(155.0, 5.0, 100.0)
    assert both['overall'] == 'suspect' and both['score'] == -1.0


def test_rp_hit_score_anchor_and_candidate_self_exclusion():
    """🔴 歧义 A8:candidate 模式自动移除候选自身三级主,防判据恒真。"""
    lords = {'signLord': 'Mars', 'starLord': 'Venus', 'subLord': 'Jupiter'}
    # anchor 模式:RP 集独立给定,子主命中权重 3
    r = rf.rp_hit_score(lords, ['Jupiter', 'Sun'], 'anchor')
    assert r['hits']['subLord']['hit'] and r['score'] == 3.0
    # candidate 模式:全部自指项被移出 → 零命中
    r2 = rf.rp_hit_score(lords, ['Mars', 'Venus', 'Jupiter'], 'candidate')
    assert set(r2['rpSelfExcluded']) == {'Mars', 'Venus', 'Jupiter'}
    assert r2['score'] == 0.0
    # candidate 模式下非自指项仍可命中
    r3 = rf.rp_hit_score(lords, ['Mars', 'Saturn'], 'candidate')
    assert r3['rpCompared'] == ['Saturn'] and r3['score'] == 0.0


def test_event_house_groups_verbatim_and_custom():
    """事件宫组逐字对 §12.5;亲丧走 custom(A10,非权威明示)。"""
    assert rf.EVENT_HOUSE_GROUPS['marriage']['houses'] == (2, 7, 11)
    assert rf.EVENT_HOUSE_GROUPS['illness']['houses'] == (6, 8, 12)
    assert rf.EVENT_HOUSE_GROUPS['travel']['houses'] == (3, 9, 12)
    r = rf.event_score('marriage', {'maha': {7, 4}, 'antar': {1}, 'pratyantar': {11}})
    assert r['levels']['maha']['overlap'] == [7]
    assert r['levels']['antar']['overlap'] == []
    assert r['levels']['pratyantar']['overlap'] == [11]
    assert r['score'] == 4.0                     # maha×3 + pratyantar×1
    rc = rf.event_score('custom', {'maha': {4}}, custom_houses=[4, 9])
    assert rc['available'] and rc['label'].startswith('自定义')
    assert rf.event_score('custom', {'maha': {4}})['available'] is False


def test_resolution_diagnostics_kp_narrowest_sub():
    """最窄 Sub = 13°20′×6/120 = 0°40′;步进超限须给收窄建议。"""
    assert abs(rf.KP_NARROWEST_SUB_DEG - 2.0 / 3.0) < 1e-9
    ok = rf.resolution_diagnostics([10.0, 10.3, 10.6], 60)
    assert ok['adequate'] is True
    bad = rf.resolution_diagnostics([10.0, 12.0, 14.0], 60)   # 2°/步 ≫ 0°40′
    assert bad['adequate'] is False
    assert bad['suggestedStepSeconds'] < 60
    assert bad['suggestedStepSeconds'] >= 1


def test_merge_runs():
    samples = [{'sub': 'Venus'}, {'sub': 'Venus'}, {'sub': 'Sun'}, {'sub': 'Venus'}]
    runs = rf.merge_runs(samples, 'sub')
    assert [r['value'] for r in runs] == ['Venus', 'Sun', 'Venus']
    assert runs[0]['count'] == 2 and runs[0]['fromIndex'] == 0 and runs[0]['toIndex'] == 1


def test_combine_scores_linear():
    r = rf.combine_scores(1.0, 3.0, [{'available': True, 'score': 4.0}])
    assert abs(r['total'] - (1.0 + 2.0 * 3.0 + 2.0 * 4.0)) < 1e-9


def test_solar_return_moment_cross_day_and_leap():
    """🔴 太阳返照求根金标(W1-F B2/B3 根修锁):
    ① 解出时刻的太阳黄经回本命值(残差 < 0.01°,平速迭代三轮);
    ② 真回归可跨出生日纪念日(旧式 clamp 到当日边界会偏至数宫)——1990/3/15 盘
      2027/2031/2035 三年实测落 3-16 凌晨,断言至少存在跨日解;
    ③ 2/29 生日 + 平年:归一 2/28 并回 adjusted 标记(此前两路由行为分叉)。"""
    from websrv.webindiasrv import IndiaAstroSrv
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    from astrostudy.india.jyotish_engine import safe_get
    from flatlib import const
    base = {'date': '1990/3/15', 'time': '12:30:00', 'zone': '+08:00',
            'lat': '39n54', 'lon': '116e24', 'indiaHsys': 0, 'indiaAyanamsa': 'lahiri'}
    natal = IndiaChartKernel(dict(base))
    nsun = float(safe_get(natal.chart, const.SUN).lon)

    def build(ds, ts):
        return IndiaChartKernel(dict(base, date=ds, time=ts))

    cross = 0
    for y in (2027, 2031, 2032, 2035):
        dt, adj = IndiaAstroSrv._solar_return_moment(build, y, 3, 15, nsun)
        assert adj is False
        r = float(safe_get(build(dt.strftime('%Y/%m/%d'), dt.strftime('%H:%M:%S')).chart, const.SUN).lon)
        resid = abs(((r - nsun + 180.0) % 360.0) - 180.0)
        assert resid < 0.01, (y, resid)
        if (dt.month, dt.day) != (3, 15):
            cross += 1
    assert cross >= 3, '2027/2031/2035 应为跨日解(旧 clamp 行为回归)'
    # ③ 2/29 平年归一(target 用 2/29 生日自己的太阳黄经)
    base29 = dict(base, date='1992/2/29')
    n29 = float(safe_get(IndiaChartKernel(dict(base29)).chart, const.SUN).lon)

    def build29(ds, ts):
        return IndiaChartKernel(dict(base29, date=ds, time=ts))

    dt29, adj29 = IndiaAstroSrv._solar_return_moment(build29, 2025, 2, 29, n29)
    assert adj29 is True
    r29 = float(safe_get(build29(dt29.strftime('%Y/%m/%d'), dt29.strftime('%H:%M:%S')).chart, const.SUN).lon)
    assert abs(((r29 - n29 + 180.0) % 360.0) - 180.0) < 0.01
