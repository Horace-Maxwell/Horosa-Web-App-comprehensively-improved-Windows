# -*- coding: utf-8 -*-
"""WI-27 参照星定位(巴比伦式·定名距星表):每七政最近的「计数之星」(30 颗楔文距星)+
黄经距(<1°标合)+ 楔文式 上/下·前/后 cubit/finger 读法(1 cubit≈2.2°=24 finger)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import astroextra


def test_babylonian_reference_stars():
    r = astroextra.analyze_chart({
        'date': '2020/01/13', 'time': '21:18:14', 'zone': '+08:00',
        'lat': '26N04', 'lon': '119E19', 'ad': 1, 'hsys': 'ALCABITUS',
    })
    rows = r['babylonianStars']
    assert rows
    for x in rows:
        assert x['planet'] and x['star'] and 'cn' in x
        assert x['dist'] >= 0.0
        assert x['conj'] == (x['dist'] < 1.0)   # 合判定 = 黄经距<1°
        # 楔文读法字段:上/下 × 前/后 + cubit/finger(finger ∈ [0,24))
        assert x['latDir'] in ('上', '下') and x['lonDir'] in ('前', '后')
        assert x['cubits'] >= 0 and 0 <= x['fingers'] < 24
        # cubit/finger 与黄经距自洽(1 cubit = 2.2° = 24 finger)
        approx = (x['cubits'] + x['fingers'] / 24.0) * 2.2
        assert abs(approx - x['dist']) < 2.2 / 24 + 0.05
    # 此盘月亮合王星(Regulus,<1°)——定名表与旧亮星启发式在此锚点一致。
    moon = [x for x in rows if x['planet'] == 'Moon']
    assert moon and moon[0]['star'] == 'α Leo' and moon[0]['conj'] is True


def test_babylonian_star_table_positions():
    """30 颗定名距星表:恒星黄道(毕宿锚)下锚点星黄经与楔文记录档吻合(±0.5°)。"""
    import swisseph
    swisseph.set_sid_mode(swisseph.SIDM_ALDEBARAN_15TAU, 0, 0)
    jd = swisseph.julday(2020, 1, 1, 0.0)
    flag = swisseph.FLG_SWIEPH | swisseph.FLG_SIDEREAL
    anchors = {
        'Aldebaran': 45.0,           # 金牛 15°(锚定义)
        'Antares': 225.0,            # 天蝎 15°
        'Regulus': 125.2,            # 狮 5°
        'Spica': 179.1,              # 处女 29°
        'Pollux': 88.8,              # 双子 29°
        'Zuben Elgenubi': 200.4,     # 天秤 20°
    }
    for name, want in anchors.items():
        (xx, _nm, _rf) = swisseph.fixstar2_ut(name, jd, flag)
        assert abs((xx[0] % 360.0) - want) < 0.5, name
