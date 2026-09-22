# -*- coding: utf-8 -*-
"""WI-02 偕日相 phasis / WI-03 喜乐 joy / WI-04 宗派 sect 测试(古典参数补全)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart


class _Fake(object):
    pass


def _chart(time='12:00:00'):
    return perchart.PerChart({
        'date': '2025/03/01', 'time': time, 'zone': '+00:00',
        'lat': '40N00', 'lon': '000E00', 'ad': 1, 'hsys': 'PLACIDUS',
    })


def test_phase_boundaries():
    pc = _chart(); pc.getChartObj()
    sun = _Fake(); sun.lon = 0.0

    def phase(body, elong):
        p = _Fake(); p.lon = float(elong)
        pc.setupPhasis(p, body, sun)
        return p.phase

    # 金星可见弧 5°(<焦伤阈 8.5°)→ 焦伤吃满到 8.5°:4°焦伤、8.5°自由光、近核心。
    # [Q-254/T-224 ①] 缺省焦伤阈由 8° 统一为 8.5°(与「太阳关系」行同 1647 口径),8.0° 现落焦伤带内。
    assert phase('Venus', 4.0) == 'combust'
    assert phase('Venus', 8.0) == 'combust'
    assert phase('Venus', 8.5) == 'free'
    assert phase('Venus', 0.1) == 'cazimi'
    # 土星弧 11°(>8.5°)→ 有日光束下带 8.5~11°。
    assert phase('Saturn', 4.0) == 'combust'
    assert phase('Saturn', 9.5) == 'underBeams'
    assert phase('Saturn', 12.0) == 'free'


def test_joy_mapping():
    pc = _chart(); pc.getChartObj()
    JOY = {'Mercury': 1, 'Moon': 3, 'Venus': 5, 'Mars': 6, 'Sun': 9, 'Jupiter': 11, 'Saturn': 12}
    for oid, jh in JOY.items():
        p = pc.chart.get(oid)
        assert p.joyHouse == jh
        assert p.joy == (p.wholeSignHouse == jh)


def test_sect_day():
    pc = _chart('12:00:00'); pc.getChartObj()
    assert pc.chart.isDiurnal() is True
    assert pc.chart.get('Sun').ofSect is True
    assert pc.chart.get('Jupiter').ofSect is True
    assert pc.chart.get('Saturn').ofSect is True
    assert pc.chart.get('Moon').ofSect is False
    assert pc.chart.get('Venus').ofSect is False
    assert pc.chart.get('Mars').ofSect is False


def _feral_chart(date, time, lat='26N04', lon='119E19', zone='+08:00'):
    pc = perchart.PerChart({'date': date, 'time': time, 'zone': zone, 'lat': lat, 'lon': lon, 'ad': 1, 'hsys': 1})
    pc.getChartObj()
    return {o.id: o for o in pc.chart.objects}


def test_feral_logic():
    # 野逸 = 与七政皆不成托勒密相位(0/60/90/120/180)。相位判定复用本盘 dynchart(moiety 容许度,
    # 与星图所绘/相位tab 同源),且**双向并集**(任一方向成相即非野逸)——不另设固定容许度。
    # 真野逸:1987/03/15 水星与七政皆无相 → feral。
    omap = _feral_chart('1987/03/15', '12:00:00')
    assert omap['Mercury'].feral is True
    # 回归守卫(用户实盘 2025/06/14 02:12:30):月对水冲 11.7°、月六合土 10.2°(>旧固定 7° 但在 moiety 容许内)
    # → 月非野逸;土亦非(双向并集:月→土 成相,两者皆非野逸)。旧 7° 容许度曾误标月为野逸。
    o2 = _feral_chart('2025/06/14', '02:12:30')
    assert o2['Moon'].feral is False
    assert o2['Saturn'].feral is False


def test_sect_night():
    pc = _chart('00:00:00'); pc.getChartObj()
    assert pc.chart.isDiurnal() is False
    assert pc.chart.get('Moon').ofSect is True
    assert pc.chart.get('Venus').ofSect is True
    assert pc.chart.get('Mars').ofSect is True
    assert pc.chart.get('Sun').ofSect is False
    assert pc.chart.get('Jupiter').ofSect is False
    assert pc.chart.get('Saturn').ofSect is False
