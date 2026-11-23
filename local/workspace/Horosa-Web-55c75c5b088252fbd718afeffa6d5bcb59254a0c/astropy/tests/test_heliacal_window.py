# -*- coding: utf-8 -*-
"""偕日升没「是否在出生前后七天内」:高纬度先排除再搜索,结果必须与直接搜索逐例相同。

直接搜索 = 向星历库要「出生前十五天之后的第一次事件」,离出生不超过七天就标;两种事件各自判定。
高纬度下它一次要 0.3–5 秒,所以对拍用例里真去搜的次数压得很少,排除条件本身放到中低纬度上强制启用来大样本验证。"""
import random

import pytest
import swisseph

import flatlib.ephem.swe  # noqa: F401  副作用:注册星历文件路径
from flatlib import const

from astrostudy import heliacal_window as hw
from astrostudy.perchart import PerChart
from astrostudy.perchart_parts.chart_tables import ARCUS_VISIONIS

_ATMO = [1013.25, 15.0, 40.0, 0.25]
_OBS = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
_FLAG = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
_PLANETS = (const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)
_IDS = {const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
        const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN}


def _direct(jd, lon, lat, name):
    """参照:不做任何排除,两种事件各自直接搜。"""
    for event, label in ((swisseph.HELIACAL_RISING, 'morningRising'), (swisseph.HELIACAL_SETTING, 'eveningSetting')):
        try:
            tret = swisseph.heliacal_ut(jd - 15.0, [lon, lat, 0.0], _ATMO, _OBS, name, event, _FLAG)
        except Exception:
            continue
        if abs(tret[0] - jd) <= 7.0:
            return label
    return None


def _elongation(jd, body):
    p, _ = swisseph.calc_ut(jd, body, swisseph.FLG_SWIEPH)
    s, _ = swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)
    return abs(((p[0] - s[0] + 180.0) % 360.0) - 180.0)


def _window_hit_cases(seed, lats, count):
    """与排盘同一入口条件:该星与太阳的距角落在可见弧 ±5° 以内。"""
    rng = random.Random(seed)
    out = []
    while len(out) < count:
        jd = swisseph.julday(rng.randint(1850, 2150), rng.randint(1, 12), rng.randint(1, 28), rng.random() * 24.0)
        lat = rng.choice(lats) + rng.uniform(-0.9, 0.9)
        lon = rng.uniform(-180.0, 180.0)
        for name in _PLANETS:
            if abs(_elongation(jd, _IDS[name]) - ARCUS_VISIONIS[name]) <= 5.0:
                out.append((jd, lon, lat, name))
    return out[:count]


@pytest.fixture(autouse=True)
def _fresh_cache():
    hw.clear_cache()
    yield
    hw.clear_cache()


def test_below_polar_latitude_searches_directly():
    stats = {}
    cases = _window_hit_cases(11, [0.0, 25.0, 40.0, 52.0, 60.0, -35.0, -58.0], 120)
    for jd, lon, lat, name in cases:
        assert hw.compute_phasis_event(jd, lon, lat, name, stats) == _direct(jd, lon, lat, name)
    assert stats.get('skipped', 0) == 0  # 这些纬度星历库本来就快:不先排除,路径与原来一样
    assert stats['searched'] >= len(cases)


def test_exclusion_never_drops_an_event(monkeypatch):
    """排除条件本身的大样本验证:在中低纬度上强制启用(这里直接搜很快),逐例与直接搜相同,且窗内事件一个不丢。"""
    monkeypatch.setattr(hw, 'POLAR_LATITUDE', 0.0)
    stats = {}
    labels = {}
    cases = _window_hit_cases(29, [0.0, 15.0, 30.0, 40.0, 48.0, 55.0, 60.0, -35.0, -55.0], 900)
    for jd, lon, lat, name in cases:
        got = hw.compute_phasis_event(jd, lon, lat, name, stats)
        assert got == _direct(jd, lon, lat, name), (jd, lon, lat, name)
        labels[got] = labels.get(got, 0) + 1
    assert labels.get('morningRising', 0) > 40 and labels.get('eveningSetting', 0) > 40  # 样本里确有两类事件
    assert stats['skipped'] > stats['searched']  # 多数搜索被排除掉了(否则这条验证没有力度)


# 高纬度实例(出生时刻儒略日, 经度, 纬度, 星),事件都不在窗内;直接搜一次约 0.5–3 秒。
_POLAR_NIGHT = (2447904.9632, 18.07, 75.0, const.VENUS)     # 1990-01-13 北纬 75°:前后七天太阳都不升起
_POLAR_DAY = (2448072.9632, 18.07, 70.0, const.JUPITER)     # 1990-06-30:没有暗空
_POLAR_AUTUMN = (2448174.9632, 18.07, 70.0, const.MERCURY)  # 1990-10-10:清晨一侧只差一点看得见
_POLAR_CASES = [_POLAR_NIGHT, _POLAR_DAY, _POLAR_AUTUMN]


def test_polar_cases_match_direct_search_and_skip_the_slow_searches():
    for jd, lon, lat, name in _POLAR_CASES:
        stats = {}
        got = hw.compute_phasis_event(jd, lon, lat, name, stats)
        assert got == _direct(jd, lon, lat, name), (jd, name)
        assert stats.get('skipped', 0) >= 1, (jd, name, stats)


def test_polar_night_and_polar_day_skip_both_searches():
    night, day = {}, {}
    assert hw.compute_phasis_event(*_POLAR_NIGHT, night) is None
    assert hw.compute_phasis_event(*_POLAR_DAY, day) is None
    assert night == {'skipped': 2}
    assert day == {'skipped': 2}
    # 清晨一侧最好的时刻也比该星暗 0.67 等(粗看算「可能」,细看确认看不见):两次都不用搜
    autumn = {}
    assert hw.compute_phasis_event(*_POLAR_AUTUMN, autumn) is None
    assert autumn == {'skipped': 2}


def test_polar_events_inside_the_window_are_kept():
    """高纬度窗内确有事件的实例:先排除不能把它排掉。"""
    found = {}
    for jd, lon, lat, name in _window_hit_cases(202, [64.5, 66.0, 68.0, -65.0], 420):
        got = hw.compute_phasis_event(jd, lon, lat, name)
        if got is not None:
            found[got] = found.get(got, 0) + 1
            assert got == _direct(jd, lon, lat, name), (jd, lon, lat, name)
    assert found == {'morningRising': 6, 'eveningSetting': 4}


def test_events_are_judged_independently(monkeypatch):
    def rising_fails(birth_jd, geopos, obj, event):
        if event == swisseph.HELIACAL_RISING:
            raise RuntimeError('no heliacal date found')
        return True

    monkeypatch.setattr(hw, '_search', rising_fails)
    assert hw.compute_phasis_event(2451545.0, 10.0, 40.0, const.VENUS) == 'eveningSetting'
    monkeypatch.setattr(hw, '_search', lambda *a: True)
    assert hw.compute_phasis_event(2451545.0, 10.0, 40.0, const.VENUS) == 'morningRising'  # 两者都在窗内:晨星初现优先
    monkeypatch.setattr(hw, '_search', lambda *a: False)
    assert hw.compute_phasis_event(2451545.0, 10.0, 40.0, const.VENUS) is None


def test_anything_uncertain_falls_back_to_the_search(monkeypatch):
    calls = []
    monkeypatch.setattr(hw, '_search', lambda birth_jd, geopos, obj, event: calls.append(event) or False)

    def broken(*args, **kwargs):
        raise RuntimeError('boom')

    monkeypatch.setattr(swisseph, 'vis_limit_mag', broken)
    # 可见度函数出错:不许当成「看不见」,照原样两次都去搜(取一例行星确在地平线上的高纬度秋夜)
    jd = swisseph.julday(1990, 10, 10, 11.1)
    assert hw.compute_phasis_event(jd, 18.07, 70.0, const.JUPITER) is None
    assert len(calls) == 2
    # 不在表里的星名:同样直接搜
    calls.clear()
    assert hw._may_be_visible([], 0.0, 2, [0.0, 70.0, 0.0], 'Sirius', 70.0, True) is True


def test_shared_planet_name_constants_are_not_rewritten():
    """星历库的可见度函数会把传进去的星名字符串就地改成小写;共享的星名常量不能被它碰到。"""
    for jd, lon, lat, name in _POLAR_CASES:
        hw.compute_phasis_event(jd, lon, lat, name)
    jd = swisseph.julday(1990, 10, 10, 11.1)
    for name in _PLANETS:
        hw.compute_phasis_event(jd, 18.07, 70.0, name)
    assert (const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN) == ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')
    assert {'Mercury': 1, 'Venus': 2}.get(const.VENUS) == 2  # 哈希与内容仍然一致
    assert set(hw._BODY_IDS) == set(ARCUS_VISIONIS)  # 排盘会问到的星,这里都认得


def test_results_are_cached_per_planet_moment_and_place(monkeypatch):
    calls = []
    real = hw.compute_phasis_event

    def counting(*args, **kwargs):
        calls.append(args)
        return real(*args, **kwargs)

    monkeypatch.setattr(hw, 'compute_phasis_event', counting)
    args = (2448175.9632, 18.07, 45.0, const.MERCURY)
    first = hw.phasis_event(*args)
    assert hw.phasis_event(*args) == first and len(calls) == 1
    hw.phasis_event(2448175.9632, 18.07, 46.0, const.MERCURY)
    hw.phasis_event(2448175.9632, 18.07, 45.0, const.VENUS)
    assert len(calls) == 3
    monkeypatch.setattr(hw, '_CACHE_MAX', 2)
    hw.phasis_event(2448176.0, 0.0, 0.0, const.MARS)
    assert len(hw._cache) == 2


def test_chart_builder_goes_through_the_window_module(monkeypatch):
    seen = []
    monkeypatch.setattr('astrostudy.perchart_parts.planets.phasis_event',
                        lambda jd, lon, lat, obj: seen.append((round(lat, 2), obj)) or 'morningRising')
    chart = PerChart({'date': '1990/01/13', 'time': '12:07:00', 'zone': '+01:00', 'lon': '18e04', 'gpsLon': 18.07,
                      'lat': '70n00', 'gpsLat': 70.0, 'hsys': 0, 'tradition': False, 'predictive': False, 'zodiacal': 0})
    assert seen and all(lat == 70.0 for lat, _obj in seen)
    hit = [obj for _lat, obj in seen]
    for obj in hit:
        assert chart.chart.get(obj).phasisEvent == 'morningRising'
