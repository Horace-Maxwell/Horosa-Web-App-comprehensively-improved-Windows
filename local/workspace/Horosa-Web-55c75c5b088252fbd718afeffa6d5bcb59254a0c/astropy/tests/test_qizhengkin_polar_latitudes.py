# -*- coding: utf-8 -*-
"""七政四余(七政):极圈以内的出生地也要起得出盘。

内置引擎用 Placidus 宫位制的调用取上升与天顶,而 Placidus 在极圈以内没有定义,星历库直接报错 —— 北纬 66° 能起、
67° 整盘起不出来。上升 / 天顶本身与宫位制无关,极圈内照样有值:报错时改用处处有定义的 Porphyry 取同一对值。
极圈以外仍走原来那一次调用,结果不变。
"""
import os
import random

import pytest
import swisseph as swe

import flatlib.ephem.swe  # noqa: F401  副作用:注册星历文件路径

from websrv.webqizhengkinsrv import compute_qizheng_kin_pan

_CALCULATOR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "vendor", "kinastro", "astro", "qizheng", "calculator.py"))


def _req(date, time, zone, lat, lon, gender=1):
    return {"date": date, "time": time, "zone": zone, "gpsLat": lat, "gpsLon": lon, "gender": gender}


POLAR = [
    ("特罗姆瑟 北纬 69.65°", _req("1990-01-13", "12:07:00", "+01:00", 69.6492, 18.9553)),
    ("朗伊尔城 北纬 78.22°(极昼)", _req("1995-06-21", "00:30:00", "+02:00", 78.2232, 15.6267, 0)),
    ("刚过北极圈 北纬 67°", _req("1990-01-13", "12:07:00", "+01:00", 67.0, 18.9553)),
    ("南极圈内 南纬 75°", _req("2000-12-21", "06:00:00", "+00:00", -75.0, 0.0)),
]


@pytest.mark.parametrize("label,data", POLAR, ids=[p[0] for p in POLAR])
def test_polar_births_produce_a_full_chart(label, data):
    pan = compute_qizheng_kin_pan(data)
    assert isinstance(pan, dict) and len(pan) >= 15
    assert len(str(pan)) > 20000  # 整盘内容在,不是空壳


def test_placidus_itself_still_fails_inside_the_polar_circle():
    """前提没变:星历库的 Placidus 在极圈内确实报错(哪天它不报了,这个兜底就可以拿掉)。"""
    jd = swe.julday(1990, 1, 13, 11.1)
    with pytest.raises(swe.Error):
        swe.houses(jd, 69.6492, 18.9553, b"P")
    asc, mc = swe.houses(jd, 69.6492, 18.9553, b"O")[1][:2]
    assert 0.0 <= asc < 360.0 and 0.0 <= mc < 360.0


def test_ascendant_and_midheaven_do_not_depend_on_the_house_system():
    """极圈以外,两种宫位制给的上升 / 天顶逐例相同 —— 所以兜底取到的就是同一对值,极圈以外的结果也不会因它而变。"""
    rng = random.Random(20261122)
    for _ in range(1500):
        jd = swe.julday(rng.randint(1800, 2200), rng.randint(1, 12), rng.randint(1, 28), rng.random() * 24.0)
        lat, lon = rng.uniform(-66.0, 66.0), rng.uniform(-180.0, 180.0)
        placidus = swe.houses(jd, lat, lon, b"P")[1]
        porphyry = swe.houses(jd, lat, lon, b"O")[1]
        assert placidus[0] == porphyry[0] and placidus[1] == porphyry[1], (jd, lat, lon)


def test_fallback_marker_survives_vendor_updates():
    src = open(_CALCULATOR, encoding="utf-8").read()
    assert "horosa_qizheng_polar_ascmc_v1" in src
    assert "except swe.Error:" in src
