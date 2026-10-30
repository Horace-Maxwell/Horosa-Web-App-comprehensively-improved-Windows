# -*- coding: utf-8 -*-
"""主限法度数换算(时间钥匙)按定义守卫。

每档钥匙各有明确定义,本文件用独立算法逐项复核,防止以后被拟合值或别的口径悄悄替换:
  · 静态常数取定义的精确式(符号量度「每座 N 年」族 = 30°/N,Cardano 0°59'12",Symbolic Moon = 月亮平均日行 13°10'35" 等);
  · Simmonite = 出生当天世界时 0 时 → 次日 0 时的太阳赤经行度;生日黄经日行 = 同一天的黄经行度;
  · Kepler = Brahe = 出生前一个真午夜 → 出生后一个真午夜(出生地太阳下中天)的太阳赤经行度,用 rise_trans 独立求下中天核对;
  · 真太阳弧:正负弧都看出生后太阳走过 |弧| 赤经的天数;「逆向弧用出生前太阳」开时负弧改看出生前倒行的太阳;
  · 上升弧 / 垂直弧:赤经中天前进 |弧| → 上升点 / 宿命点黄经前移 Δλ → 出生后太阳黄经走过 Δλ 的天数(独立细步 + 二分复算);
  · 表格(弧 → 年)与主限法盘(年 → 弧)共用一个换算出口,逐档互逆;前端钥匙清单每一档后端都认。
  · 「（经典）」键(传统程序的写法):真太阳弧按平黄赤交角换太阳赤经;Kepler / Brahe 取出生后第一个真午夜起的那一整天;
    Wöllner / Synodic Year / Novenary / Symbolic Moon 取写死的截断常数。
"""
import math
import re
from pathlib import Path

import pytest
import swisseph

from astrostudy import pd_engine, perchart, perpredict
from astrostudy.perpredict import STATIC_TIME_KEY_SCALES, _pdTimeKeyScale

CHART = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 0,
    'pdYears': 100, 'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}
UI_SYNC = Path(__file__).resolve().parents[2] / 'astrostudyui' / 'src' / 'utils' / 'primaryDirectionSync.js'


def _predict(**over):
    d = dict(CHART)
    d.update(over)
    return perpredict.PerPredict(perchart.PerChart(d))


def _ra(jd):
    return swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_EQUATORIAL)[0][0]


def _lon(jd):
    return swisseph.calc_ut(jd, swisseph.SUN)[0][0]


def test_static_constants_are_their_definitions():
    S = STATIC_TIME_KEY_SCALES
    assert S['Ptolemy'] == 1.0
    assert S['Naibod'] == S['NaibodRA'] == pytest.approx(0.9856473354, abs=1e-12)
    assert S['Cardano'] == pytest.approx((59 + 12 / 60.0) / 60.0, abs=1e-12)
    assert S['Umar'] == pytest.approx(72 / 73, abs=1e-15)
    assert S['SymbolicYear'] == pytest.approx(360 / 365.25, abs=1e-15)
    assert S['SymbolicMoon'] == pytest.approx(13 + 10 / 60.0 + 35 / 3600.0, abs=1e-12)
    assert S['SynodicYear'] == pytest.approx(12 * 29.530588853 / 360.0, abs=1e-12)
    assert S['Kundig'] == S['SymbolicDegree'] == 1.0
    # 符号量度「每座 N 年」族:每年 30°/N
    for key, years_per_sign in (('Quinary', 5), ('Septenary', 7), ('Novenary', 9), ('Duodenary', 12), ('SubDuodenary', 144)):
        assert S[key] == pytest.approx(30.0 / years_per_sign, abs=1e-15), key
    assert S['SymbolicWeek'] == pytest.approx(1 / 7, abs=1e-15)      # 1° = 7 年
    assert S['SelfMeasure'] == pytest.approx(13 / 7, abs=1e-15)
    assert S['Plantiko'] == pytest.approx(60 / 59.3, abs=1e-15)
    assert S['Wollner'] == 0.98604
    assert S['SymbolicMonth'] == 4.0 and S['Quarterly'] == 0.25
    # 「经典」档:传统程序常用的常数原样取
    assert S['WollnerClassic'] == 0.9860361213 and S['WollnerClassic'] == pytest.approx(1.0 - 50.27 / 3600.0, abs=2e-8)
    assert S['SynodicYearClassic'] == 0.98435 and S['NovenaryClassic'] == 3.3333 and S['SymbolicMoonClassic'] == 13.167
    # 角点计时是动态钥匙,不得以比例常数冒充
    assert 'AscendantArc' not in S and 'VerticalArc' not in S


def test_birthday_keys_are_ut_day_sun_motion():
    pc = perchart.PerChart(dict(CHART))
    chart = pc.getChart()
    jd = float(chart.date.jd)
    j0 = math.floor(jd - 0.5) + 0.5
    assert _pdTimeKeyScale('Simmonite', chart=chart) == pytest.approx((_ra(j0 + 1) - _ra(j0)) % 360, abs=1e-12)
    assert _pdTimeKeyScale('BirthdaySunLon', chart=chart) == pytest.approx((_lon(j0 + 1) - _lon(j0)) % 360, abs=1e-12)


@pytest.mark.parametrize('date,time,zone,lat,lon', [
    ('1990/03/15', '12:30:00', '+08:00', '39N54', '116E28'),
    ('1975/06/21', '23:50:00', '-05:00', '40N43', '74W00'),
    ('2024/04/05', '05:06:00', '-08:00', '57S52', '124W46'),
    ('1961/09/24', '00:10:00', '+00:00', '51N30', '0W07'),
])
def test_kepler_brahe_true_midnight_ra(date, time, zone, lat, lon):
    pc = perchart.PerChart(dict(CHART, date=date, time=time, zone=zone, lat=lat, lon=lon))
    chart = pc.getChart()
    jd = float(chart.date.jd)
    pp = perpredict.PerPredict(pc)
    geolon = pp._coreParseCoord(lon)
    geolat = pp._coreParseCoord(lat)
    # 独立:rise_trans 逐个找太阳下中天,取夹住出生时刻的那两个
    geopos = (geolon, geolat, 0.0)
    t = swisseph.rise_trans(jd - 2.0, swisseph.SUN, swisseph.CALC_ITRANSIT, geopos)[1][0]
    ts = [t]
    for _ in range(4):
        ts.append(swisseph.rise_trans(ts[-1] + 0.01, swisseph.SUN, swisseph.CALC_ITRANSIT, geopos)[1][0])
    before = max(x for x in ts if x <= jd)
    after = min(x for x in ts if x > jd)
    assert after - before == pytest.approx(1.0, abs=0.01)
    expect = (_ra(after) - _ra(before)) % 360
    k = _pdTimeKeyScale('Kepler', chart=chart, geolon=geolon)
    assert k == pytest.approx(expect, abs=1e-9)
    assert _pdTimeKeyScale('Brahe', chart=chart, geolon=geolon) == k
    # 经典:出生后第一个真午夜 → 再下一个真午夜
    first = after
    nxt = min(x for x in ts if x > first + 0.5)
    kc = _pdTimeKeyScale('KeplerClassic', chart=chart, geolon=geolon)
    assert kc == pytest.approx((_ra(nxt) - _ra(first)) % 360, abs=1e-9)
    assert _pdTimeKeyScale('BraheClassic', chart=chart, geolon=geolon) == kc and abs(kc - k) > 1e-6


def test_true_solar_arc_forward_for_both_signs_and_regressive_option():
    jd = float(perchart.PerChart(dict(CHART)).getChart().date.jd)
    for arc in (3.7, 30.0, 61.25):
        fwd = pd_engine.key_placidus_true_solar_arc(arc, jd)
        assert pd_engine.key_placidus_true_solar_arc(-arc, jd) == pytest.approx(-fwd, abs=1e-9)
        # 出生后 fwd 天太阳赤经恰走过 arc
        assert ((_ra(jd + fwd) - _ra(jd)) % 360) == pytest.approx(arc % 360, abs=1e-8)
        back = abs(pd_engine.key_placidus_true_solar_arc(-arc, jd, regressive=True))
        assert ((_ra(jd) - _ra(jd - back)) % 360) == pytest.approx(arc % 360, abs=1e-8)
        assert abs(back - fwd) > 1e-4                       # 两种口径确实不同
        assert pd_engine.key_placidus_true_solar_arc(arc, jd, regressive=True) == pytest.approx(fwd, abs=1e-12)


def test_true_solar_arc_classic_uses_mean_obliquity():
    """经典真太阳弧:太阳视黄经 / 黄纬按平黄赤交角(不计交角章动)换赤经,出生后 d 天累计走过 |弧|。"""
    jd = float(perchart.PerChart(dict(CHART)).getChart().date.jd)

    def ra_mean(t):
        lon, lat = swisseph.calc_ut(t, swisseph.SUN)[0][:2]
        eps0 = swisseph.calc_ut(t, swisseph.ECL_NUT)[0][1]
        return swisseph.cotrans((lon, lat, 1.0), -eps0)[0]

    for arc in (3.7, 30.0, 61.25):
        d = pd_engine.key_placidus_true_solar_arc(arc, jd, mean_obliquity=True)
        assert ((ra_mean(jd + d) - ra_mean(jd)) % 360) == pytest.approx(arc % 360, abs=1e-8)
        assert abs(d - pd_engine.key_placidus_true_solar_arc(arc, jd)) > 1e-5        # 与真交角写法确有差别
        assert pd_engine.solar_arc_for_years(d, jd, mean_obliquity=True) == pytest.approx(arc, abs=1e-8)


def _angle(armc, phi, eps, point):
    ascmc = swisseph.houses_armc(armc % 360.0, phi, eps, b'O')[1]
    return ascmc[3] if point == 'vertex' else ascmc[0]


def _indep_angle_years(arc, jd, armc, phi, eps, point):
    """独立复算:0.05° 细步展开角点前移 Δλ,再二分求太阳黄经前移 Δλ 的天数。"""
    n = max(1, int(math.ceil(abs(arc) / 0.05)))
    prev, dl = _angle(armc, phi, eps, point), 0.0
    for i in range(1, n + 1):
        cur = _angle(armc + abs(arc) * i / n, phi, eps, point)
        dl += ((cur - prev + 180.0) % 360.0) - 180.0
        prev = cur
    dl = abs(dl)
    lo, hi = 0.0, dl * 1.2 + 2.0
    l0 = _lon(jd)
    for _ in range(80):
        mid = (lo + hi) / 2
        moved = ((_lon(jd + mid) - l0) % 360.0) + 360.0 * math.floor(mid / 370.0)
        lo, hi = (mid, hi) if moved < dl else (lo, mid)
    return (lo + hi) / 2


@pytest.mark.parametrize('point', ['asc', 'vertex'])
@pytest.mark.parametrize('arc', [-6.908459, 0.530393, 25.0, -61.5])
def test_angle_arc_keys_follow_definition(point, arc):
    jd = 2460406.004166667
    phi, lon = -(57 + 52 / 60.0), -(124 + 46 / 60.0)
    armc = swisseph.houses_ex(jd, phi, lon, b'O')[1][2]
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1]
    y = pd_engine.key_angle_arc(arc, jd, armc, phi, eps, point)
    assert math.copysign(1, y) == math.copysign(1, arc)
    assert abs(y) == pytest.approx(_indep_angle_years(arc, jd, armc, phi, eps, point), abs=2e-6)
    back = pd_engine.angle_arc_for_years(abs(y), jd, armc, phi, eps, point)
    assert back == pytest.approx(abs(arc), abs=1e-7)


def test_angle_arc_known_values():
    """南纬 57°52′ / 西经 124°46′ 一例:上升弧 −6.908459° ≈ 4.52048 年,垂直弧 −0.530393° ≈ 0.75426 年(按定义的独立原型值)。"""
    jd = 2460406.004166667
    phi, lon = -(57 + 52 / 60.0), -(124 + 46 / 60.0)
    armc = swisseph.houses_ex(jd, phi, lon, b'O')[1][2]
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1]
    assert abs(pd_engine.key_angle_arc(-6.908459, jd, armc, phi, eps, 'asc')) == pytest.approx(4.520479, abs=2e-6)
    assert abs(pd_engine.key_angle_arc(-0.530393, jd, armc, phi, eps, 'vertex')) == pytest.approx(0.754256, abs=2e-6)


def _ui_time_keys():
    src = UI_SYNC.read_text(encoding='utf-8')
    body = re.search(r'export const SUPPORTED_PD_TIME_KEYS = \[(.*?)\];', src, re.S).group(1)
    return re.findall(r"'([A-Za-z]+)'", body)


def test_every_ui_key_is_handled_by_backend():
    keys = _ui_time_keys()
    assert len(keys) == len(set(keys)) == 38
    handled = set(STATIC_TIME_KEY_SCALES) | {'TrueSolarArc', 'TrueSolarArcMean', 'VanDam', 'SymbolicSolarArc', 'AscendantArc',
                                              'VerticalArc', 'Simmonite', 'BirthdaySunLon', 'Kepler', 'Brahe',
                                              'KeplerClassic', 'BraheClassic', 'User'}
    assert set(keys) == handled
    assert {k.lower() for k in perpredict._PD_DYNAMIC_SOLAR_RA_KEYS} >= {'truesolararc', 'vandam'}
    assert set(perpredict._PD_ANGLE_ARC_KEYS) == {'ascendantarc', 'verticalarc'}
    assert set(perpredict.PER_CHART_TIME_KEY_FALLBACK) == {'simmonite', 'birthdaysunlon', 'kepler', 'brahe',
                                                            'keplerclassic', 'braheclassic'}


@pytest.mark.parametrize('key', [k for k in [
    'Ptolemy', 'Naibod', 'TrueSolarArc', 'TrueSolarArcMean', 'VanDam', 'SymbolicSolarArc', 'Simmonite', 'BirthdaySunLon',
    'Kepler', 'KeplerClassic', 'AscendantArc', 'VerticalArc', 'Novenary', 'NovenaryClassic', 'SymbolicMoonClassic',
    'SubDuodenary', 'SymbolicWeek', 'User']])
def test_table_and_dial_converters_are_inverse(key):
    pp = _predict(pdTimeKey=key, pdTimeKeyCustom=2.5)
    chart = pp.perchart.getChart()
    years_of_arc, arc_of_years = pp._pdTimeKeyConverter(chart)
    for arc in (0.75, 12.0, 47.3):
        y = years_of_arc(arc)
        assert y > 0
        assert arc_of_years(y, False) == pytest.approx(arc, abs=1e-6)


def test_regressive_switch_only_moves_negative_arc_dates():
    base = _predict(pdTimeKey='TrueSolarArc', pdConverse=True, pdDirect=True).getPrimaryDirection()
    reg = _predict(pdTimeKey='TrueSolarArc', pdConverse=True, pdDirect=True, pdSolarArcRegressive=1).getPrimaryDirection()
    assert [r[0] for r in base] == [r[0] for r in reg]                       # 弧不动
    pos_same = all(a[4] == b[4] for a, b in zip(base, reg) if a[0] > 0)
    neg_diff = any(a[4] != b[4] for a, b in zip(base, reg) if a[0] < 0)
    assert pos_same and neg_diff
    # 其它钥匙不受此开关影响
    p1 = _predict(pdTimeKey='Naibod', pdConverse=True).getPrimaryDirection()
    p2 = _predict(pdTimeKey='Naibod', pdConverse=True, pdSolarArcRegressive=1).getPrimaryDirection()
    assert [r[4] for r in p1] == [r[4] for r in p2]
