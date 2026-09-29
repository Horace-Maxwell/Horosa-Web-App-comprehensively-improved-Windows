# -*- coding: utf-8 -*-
"""交节时刻取精确黄经 + 节气时刻显示四舍五入到整秒。

此前牛顿迭代的目标是「节气黄经 + 1/7200°」,交节时刻系统性晚约 12 秒:交节后 12 秒内出生,
计算服务判上个月、八字主盘(本地引擎)判新月;显示串又直接截掉小数秒。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from flatlib import const  # noqa: E402
from flatlib.datetime import Datetime  # noqa: E402
from flatlib.ephem import swe  # noqa: E402

from astrostudy.jieqi import BirthJieQi as BJ  # noqa: E402
from astrostudy.jieqi import YearJieQi as YJ  # noqa: E402
from astrostudy.jieqi import jieqiconst  # noqa: E402

# 一秒太阳约走 0.0000116°;容差 0.00001° ≈ 0.9 秒(旧目标偏 1/7200° ≈ 0.000139°,约 12 秒,必落在容差外)
TOL_DEG = 0.00001


def _lon_error(jd, target):
    sun = swe.sweObject(const.SUN, jd, swe.SEDEFAULT_FLAG)
    d = (sun['lon'] - target) % 360.0
    return d - 360.0 if d > 180.0 else d


def test_year_jieqi_hits_exact_longitude_both_paths(monkeypatch):
    for fast in (True, False):
        monkeypatch.setattr(YJ, '_JIEQI_FAST_APPROACH', fast)
        yj = YJ.YearJieQi({'year': '2024', 'zone': '+08:00', 'lon': '120e00', 'lat': '0n00'})
        for name in ('立春', '小暑', '寒露', '冬至'):
            obj = yj.computeOneJieQiByName(name)
            err = _lon_error(obj['jdn'], jieqiconst.JieQiLon[name]['lon'])
            assert abs(err) < TOL_DEG, (fast, name, err)


def test_birth_jieqi_window_hits_exact_longitude(monkeypatch):
    for fast in (True, False):
        monkeypatch.setattr(BJ, '_JIEQI_FAST_APPROACH', fast)
        res = BJ.BirthJieQi({'date': '2024-07-06', 'time': '22:20:10', 'zone': '+08:00', 'lat': '31n38',
                             'lon': '118e27', 'byLon': 0, 'useLocalMao': 0}).compute()
        rows = [j for j in res['jieqi'] if j.get('jieqi') in jieqiconst.JieQiLon]
        assert rows
        for j in rows:
            err = _lon_error(j['jdn'], jieqiconst.JieQiLon[j['jieqi']]['lon'])
            assert abs(err) < TOL_DEG, (fast, j['jieqi'], err)


def test_2024_xiaoshu_is_not_late_by_twelve_seconds():
    # 精确交节约北京时间 22:20:04(本地引擎同值);旧目标给出约 22:20:16
    yj = YJ.YearJieQi({'year': '2024', 'zone': '+08:00', 'lon': '120e00', 'lat': '0n00'})
    obj = yj.computeOneJieQiByName('小暑')
    base = Datetime('2024/07/06', '22:20', '+08:00').jd
    secs = (obj['jdn'] - base) * 86400.0
    assert 2.0 < secs < 6.0, secs


def test_display_time_outside_utc_domain_is_left_as_is(monkeypatch):
    # 星历 UT1→UTC 换算失败时 toCNString 走纯 JD 公式,本就四舍五入 → 原样返回,不再加半秒
    import flatlib.datetime as fdt

    def boom(*a, **k):
        raise ValueError('out of domain')

    dt = Datetime.fromJD(Datetime('2024/03/20', '10:00', '+08:00').jd + 30.7 / 86400.0, '+08:00')
    monkeypatch.setattr(fdt, 'sweJdnDate', boom)
    assert jieqiconst.cnTimeRounded(dt) == dt.toCNString()
    assert dt.toCNString().endswith('10:00:31'), dt.toCNString()


def test_display_time_rounds_to_nearest_second():
    # 域内按四舍五入(截秒会早最多 1 秒)
    base = Datetime('-0500/03/21', '10:00', '+08:00')
    up = Datetime.fromJD(base.jd + 30.7 / 86400.0, '+08:00')
    down = Datetime.fromJD(base.jd + 30.3 / 86400.0, '+08:00')
    assert jieqiconst.cnTimeRounded(up).endswith('10:00:31'), jieqiconst.cnTimeRounded(up)
    assert jieqiconst.cnTimeRounded(down).endswith('10:00:30'), jieqiconst.cnTimeRounded(down)
    near_midnight = Datetime.fromJD(Datetime('-0500/06/30', '23:59', '+08:00').jd + 59.7 / 86400.0, '+08:00')
    rounded = jieqiconst.cnTimeRounded(near_midnight)
    assert near_midnight.toCNString().endswith('06-30 23:59:59'), near_midnight.toCNString()
    assert rounded.endswith('07-01 00:00:00'), rounded   # 进到次日零点
