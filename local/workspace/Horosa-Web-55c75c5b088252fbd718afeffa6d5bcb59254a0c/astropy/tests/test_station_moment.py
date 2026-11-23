# -*- coding: utf-8 -*-
"""星历表里「留」的时刻(astroextra_parts/ephemeris.py):由位置求黄经的极值点,扫描格点与起算时刻无关,取到分钟。

要锁的三件事:① 报出来的那一刻确是黄经的极值(前后黄经都在同一侧),而不是星历库速度量过零的那一刻
(后者对慢星偏出几十秒到一分钟);② 同一个天象,不管从哪一刻起算、给哪个命例算,都是同一个数;
③ 位置加一点末位噪声(= 换一台机器),结果不变。"""
import hashlib
import random

import pytest
import swisseph as swe
from flatlib import const

from astrostudy.astroextra_parts import common
from astrostudy.astroextra_parts import ephemeris as E

PLANETS = [const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO]
Y2030 = (swe.julday(2030, 1, 1, 0.0), swe.julday(2031, 1, 1, 0.0))


def _rows(start, end, zone='+08:00', planets=PLANETS):
    return [(e['datetime'], e['body'], e['direction']) for e in E.calc_stations(start, end, zone, planets)]


def test_the_year_2030_station_list_is_pinned():
    rows = _rows(*Y2030)
    assert len(rows) == 18
    assert rows[0] == ('2030-01-11 13:45:00', 'Mercury', 'Direct')
    assert ('2030-07-17 00:28:00', 'Neptune', 'Retrograde') in rows
    assert ('2030-09-28 16:27:00', 'Uranus', 'Retrograde') in rows
    assert all(dt.endswith(':00') for dt, _b, _d in rows)                  # 取到分钟
    # 同一颗星顺留 / 逆留交替
    for body in PLANETS:
        dirs = [d for _dt, b, d in rows if b == body]
        assert all(a != b for a, b in zip(dirs, dirs[1:])), (body, dirs)


def test_the_reported_moment_is_the_extremum_of_longitude():
    for body in (const.MERCURY, const.VENUS, const.JUPITER, const.SATURN, const.NEPTUNE, const.PLUTO):
        ev = E.calc_stations(*Y2030, '+00:00', [body])[0]
        moment, direction = E.station_moment(body, ev['jd'] - 0.4, ev['jd'] + 0.4)
        here = common.swe_lon(body, moment)[0]
        before = common.norm180(common.swe_lon(body, moment - 1.0 / 24)[0] - here)
        after = common.norm180(common.swe_lon(body, moment + 1.0 / 24)[0] - here)
        assert before * after > 0, body                                     # 前后一小时都在同一侧 = 极值
        assert abs(before - after) < 1e-2 * abs(before), body               # 且两侧对称(极值点居中;冥王星位置本身的噪声约占千分之三)
        assert (direction == 'Retrograde') == (before < 0), body            # 逆留 = 黄经的极大
        assert abs(E.lon_rate(body, moment)) < 5e-9, body                   # 由位置求的变化率在这一刻是零
        assert abs(ev['jd'] - moment) <= 0.5 / 1440 + 1e-9                  # 报出来的是它取到分钟


def test_engine_speed_zero_is_a_different_and_later_moment_for_slow_planets():
    # 说明为什么不用星历库的速度量:对海王星,它过零的时刻比黄经极值晚一分钟左右
    ev = [e for e in E.calc_stations(*Y2030, '+00:00', [const.NEPTUNE]) if e['direction'] == 'Retrograde'][0]
    moment, _ = E.station_moment(const.NEPTUNE, ev['jd'] - 0.4, ev['jd'] + 0.4)
    by_speed = E.refine_crossing(lambda x: common.swe_lon(const.NEPTUNE, x)[1], ev['jd'] - 0.4, ev['jd'] + 0.4, 40)
    assert 30 < (by_speed - moment) * 86400 < 120


def test_the_same_event_reads_the_same_whatever_the_scan_start():
    base = _rows(*Y2030)
    rnd = random.Random(5)
    for _ in range(8):
        a, b = rnd.random() * 3, rnd.random() * 3
        wide = [(e['datetime'], e['body'], e['direction']) for e in E.calc_stations(Y2030[0] - a, Y2030[1] + b, '+08:00', PLANETS)
                if Y2030[0] <= e['jd'] <= Y2030[1]]
        assert wide == base
    # 窗口只含事件前后几个小时也找得到它(扫描两头各多看一天)
    nep = [e for e in E.calc_stations(*Y2030, '+08:00', [const.NEPTUNE])][0]
    near = E.calc_stations(nep['jd'] - 0.1, nep['jd'] + 0.1, '+08:00', [const.NEPTUNE])
    assert [(e['datetime'], e['direction']) for e in near] == [(nep['datetime'], nep['direction'])]
    assert E.calc_stations(nep['jd'] + 0.2, nep['jd'] + 5.0, '+08:00', [const.NEPTUNE]) == []   # 窗口外的不报


def test_last_bit_noise_in_the_positions_does_not_move_the_result(monkeypatch):
    base = _rows(*Y2030)
    real = common.swe_lon

    def noisy(scale, salt):
        def fn(body, jd, *args, **kwargs):
            lon, speed, xx = real(body, jd, *args, **kwargs)
            h = hashlib.sha256(('%s|%r|%s' % (body, jd, salt)).encode()).digest()
            unit = int.from_bytes(h[:8], 'big') / 2.0 ** 64 - 0.5           # 每个取样点各自的、确定的 ±0.5
            return (lon + unit * 2 * scale) % 360.0, speed, xx
        return fn

    for scale, salt in ((2e-11, 'a'), (2e-11, 'b'), (1e-10, 'c'), (1e-10, 'd')):   # 2e-11 度 ≈ 不同处理器之间的位置差
        monkeypatch.setattr(E, 'swe_lon', noisy(scale, salt))
        assert _rows(*Y2030) == base, (scale, salt)


def test_weights_are_an_exact_least_squares_derivative():
    w = E._station_weights()
    assert len(w) == 2 * E._STATION_HALF + 1
    xs = list(range(-E._STATION_HALF, E._STATION_HALF + 1))
    assert abs(sum(w)) < 1e-12                                              # 常数的导数是 0
    assert abs(sum(wi * x for wi, x in zip(w, xs)) - 1.0) < 1e-12           # x 的导数是 1
    for power in (2, 3, 4):                                                 # 四次以内的多项式在中心处导数精确
        assert abs(sum(wi * x ** power for wi, x in zip(w, xs))) < 1e-7, power
    assert all(abs(a + b) < 1e-15 for a, b in zip(w, reversed(w)))          # 反对称


@pytest.mark.parametrize('zone', ['+00:00', '-05:00', '+05:30', '+09:00'])
def test_minute_rounding_holds_in_whole_minute_zones(zone):
    assert all(e['time'].endswith(':00') for e in E.calc_stations(*Y2030, zone, [const.NEPTUNE, const.MERCURY]))


def test_station_sampling_stays_out_of_request_memo():
    """留的采样点不进请求级黄经缓存(只是不缓存,结果不变);扫描结束后外层缓存照旧可用。"""
    from astrostudy.astroextra_parts import common, ephemeris
    from flatlib import const
    lo, hi = 2461100.0, 2461101.0
    plain = [ephemeris.lon_rate(const.MERCURY, jd) for jd in (lo, lo + 0.25, hi)]
    with common.swe_lon_memo():
        memo = common._SWE_LON_TL.memo
        assert memo is not None
        before = len(memo)
        cached = [ephemeris.lon_rate(const.MERCURY, jd, common.swe_lon(const.MERCURY, jd)[0]) for jd in (lo, lo + 0.25, hi)]
        assert common._SWE_LON_TL.memo is memo                      # 采样完外层缓存原样放回
        assert len(memo) - before <= 3                              # 只多了三次参考点,25 × 3 个采样点一个没进
        common.swe_lon(const.VENUS, lo)
        assert len(memo) - before <= 4
    assert cached == plain


def test_clock_offset_infinite_is_ignored():
    from astrostudy import clock
    assert clock._valid_offset('inf') is None
    assert clock._valid_offset(float('-inf')) is None
    assert clock._valid_offset('1e400') is None
    assert clock._valid_offset('480') == 480
