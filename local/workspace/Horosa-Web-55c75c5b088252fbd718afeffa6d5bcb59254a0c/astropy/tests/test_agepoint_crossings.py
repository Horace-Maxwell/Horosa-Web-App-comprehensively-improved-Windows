# -*- coding: utf-8 -*-
"""年龄推进点「关键岁数(合本命)」连续解:每宫 6 年线性插值求精确穿越岁数,不再只在整岁 ±1° 判合。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.agepoint import crossings_of  # noqa: E402


def test_equal_houses_exact_ages():
    kc = [i * 30.0 for i in range(12)]            # 等宫 30°,年龄点 5°/年
    natal = {'Sun': 17.0, 'Moon': 100.0, 'Mars': 359.0}
    cs = crossings_of(kc, natal, 72)
    by = {c['aspectTo']: c['age'] for c in cs}
    assert abs(by['Sun'] - 3.4) < 1e-9
    assert abs(by['Moon'] - 20.0) < 1e-9
    assert abs(by['Mars'] - 71.8) < 1e-9
    assert len(cs) == 3


def test_cycle_repeats_beyond_72_and_unequal_houses():
    kc = [0.0, 60.0, 90.0, 120.0, 150.0, 180.0, 210.0, 240.0, 270.0, 300.0, 330.0, 345.0]   # 第 1 宫 60°、第 12 宫 15°
    natal = {'Sun': 30.0, 'Moon': 352.5}
    cs = crossings_of(kc, natal, 150)
    sun = [c['age'] for c in cs if c['aspectTo'] == 'Sun']
    moon = [c['age'] for c in cs if c['aspectTo'] == 'Moon']
    assert sun == [3.0, 75.0, 147.0]        # 第 1 宫 60° 跨 6 年 → 30° 处 3 岁
    assert moon == [69.0, 141.0]           # 第 12 宫 15° 跨 6 年 → 7.5° 处 3 岁 → 66+3
    # 旧口径(整岁 ±1°):等宫 5°/年下 3.4 岁穿越在 3 岁点差 2° → 漏报;新口径必报
    kc2 = [i * 30.0 for i in range(12)]
    assert any(abs(c['age'] - 3.4) < 1e-9 for c in crossings_of(kc2, {'Sun': 17.0}, 72))


def test_sidereal_chart_age_point_uses_chart_zodiac():
    """恒星黄道盘:年龄点起于盘上升点(恒星黄经),合本命岁数与回归盘一致(整体平移不改几何);
    此前宫头恒回归黄经、本命星恒星黄经互比 → 0 岁 AP 仍 124.05、合本命集合全错。"""
    from astrostudy.perchart import PerChart
    from astrostudy import agepoint
    base = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1}
    trop = agepoint.compute(PerChart(dict(base)))
    sid = agepoint.compute(PerChart(dict(base, zodiacal=1, siderealAyanamsa='lahiri')))
    assert abs(trop['asc'] - 124.05) < 0.05
    assert abs(sid['asc'] - 100.32) < 0.05                  # 盘上升点(lahiri 恒星黄经),非回归 124.05
    assert sid['points'][0]['apLon'] == sid['asc']
    assert [(c['age'], c['aspectTo']) for c in sid['crossings']] == [(c['age'], c['aspectTo']) for c in trop['crossings']]


# ── 四项口径:推进方式 / 事件 / 年长 / 年限 ──
_BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27'}


def _ap(**over):
    from astrostudy.perchart import PerChart
    from astrostudy import agepoint
    return agepoint.compute(PerChart(dict(_BASE, **over)))


def _ap_lon_at(res, age):
    """按结果里的推进宫头,算任意(小数)岁数的年龄点黄经:6 年一宫、宫内线性。"""
    kc = res['kochCusps']
    h = int(age // 6) % 12
    frac = (age % 6) / 6.0
    span = (kc[(h + 1) % 12] - kc[h]) % 360.0
    return (kc[h] + frac * span) % 360.0


def test_method_koch_uses_koch_cusps_every_six_years():
    """Koch 档:年龄 6k 岁恰在第 k+1 宫 Koch 宫头(swisseph 'K')。"""
    import swisseph
    from astrostudy.perchart import PerChart
    r = _ap(apMethod='koch')
    chart = PerChart(dict(_BASE)).getChart()
    cusps = swisseph.houses_ex2(chart.date.jd, 31 + 38 / 60.0, 118 + 27 / 60.0, b'K', 0)[0]
    kc = [float(c) for c in (cusps[1:13] if len(cusps) >= 13 else cusps[:12])]
    for k in range(12):
        assert abs((r['points'][6 * k]['apLon'] - kc[k] + 180) % 360 - 180) < 0.01
    assert r['houseSystem'] == 'Koch'


def test_method_equal5_is_five_degrees_per_year_from_asc():
    """等速档:年龄点 = 上升 + 5°/年,与宫制无关。"""
    r = _ap(apMethod='equal5')
    r2 = _ap(apMethod='equal5', hsys=1)
    for age in (0, 1, 7, 13, 35, 59, 72):
        want = (r['asc'] + 5.0 * age) % 360.0
        assert abs((r['points'][age]['apLon'] - want + 180) % 360 - 180) < 0.011
        assert r2['points'][age]['apLon'] == r['points'][age]['apLon']
    assert r['houseSystem'] == 'Equal'


def test_events_full_hits_every_point_and_aspect_once_per_cycle():
    """全部事件档:16 个点 × 合 / 左右六合四分三分 / 冲 = 128 个目标,一周 72 年内各被经过一次,
    且每次事件时刻的年龄点黄经 = 目标黄经;只报合档 = 七星各一次。"""
    from astrostudy import agepoint
    r = _ap(apEvents='full')
    assert len(agepoint.FULL_POINTS) == 16 and len(agepoint.FULL_ASPECTS) == 8
    keys = {(c['aspectTo'], c['aspect'], c['side']) for c in r['crossings']}
    assert len(r['crossings']) == len(keys) == 128
    kc = r['kochCusps']
    for c in r['crossings']:
        h = int(c['age'] // 6) % 12
        rate = ((kc[(h + 1) % 12] - kc[h]) % 360.0) / 6.0          # 该宫每年走的度数
        d = (_ap_lon_at(r, c['age']) - c['apLon'] + 180) % 360 - 180
        assert abs(d) < rate * 0.0051 + 0.011, c                   # 岁数回包取 2 位小数、黄经取 2 位小数
    conj = _ap(apEvents='conj')
    assert sorted(c['aspectTo'] for c in conj['crossings']) == sorted(agepoint.PLANET_POINTS)
    assert all(c['aspect'] == 0 for c in conj['crossings'])


def test_year_option_converts_ages_to_dates():
    """年长档:事件日期 = 出生 + 精确岁数 × 年长;岁数不随年长变。"""
    from astrostudy import agepoint
    from astrostudy.perchart import PerChart
    from astrostudy.astroextra_parts.common import date_time_from_jd
    jd0 = PerChart(dict(_BASE)).getChart().date.jd
    trop, sid = _ap(apYear='tropical'), _ap(apYear='sidereal')
    assert [c['age'] for c in trop['crossings']] == [c['age'] for c in sid['crossings']]
    for res, key in ((trop, 'tropical'), (sid, 'sidereal')):
        for c in res['crossings'][::17]:
            # 回包岁数只留 2 位小数(≈ 3.7 日),日期按未取整岁数算 → 比对允许 ±4 日
            import datetime as _dt
            want = _dt.date.fromisoformat(date_time_from_jd(jd0 + c['age'] * agepoint.YEAR_DAYS[key], '+08:00')['date'])
            assert abs((_dt.date.fromisoformat(c['date']) - want).days) <= 4
    late = [c for c in trop['crossings'] if c['age'] > 50][0]
    t_date = late['date']
    s_date = next(c['date'] for c in sid['crossings'] if (c['aspectTo'], c['aspect'], c['side']) == (late['aspectTo'], late['aspect'], late['side']))
    assert t_date != s_date      # 50 岁后两种年长相差约 0.7 日以上


def test_span_option_extends_cycle():
    """年限档:逐岁行 = 年限 + 1 行;72 岁后同一目标每 72 年再经过一次。"""
    for span in (72, 100, 120, 144):
        r = _ap(apMaxAge=span)
        assert r['maxAge'] == span and len(r['points']) == span + 1
        assert all(c['age'] <= span for c in r['crossings'])
    r = _ap(apMaxAge=144)
    first = {}
    for c in r['crossings']:
        k = (c['aspectTo'], c['aspect'], c['side'])
        if k in first:
            assert abs(c['age'] - first[k] - 72) < 0.011
        else:
            first[k] = c['age']


def test_unknown_settings_fall_back_to_defaults():
    r = _ap(apMethod='x', apEvents='y', apYear='z', apMaxAge='abc')
    assert r['settings'] == {'apMethod': 'koch', 'apEvents': 'full', 'apYear': 'tropical', 'apMaxAge': 72}
