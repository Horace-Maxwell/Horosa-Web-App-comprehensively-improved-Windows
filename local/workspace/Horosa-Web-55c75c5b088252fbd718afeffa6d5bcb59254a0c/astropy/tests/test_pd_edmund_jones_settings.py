# -*- coding: utf-8 -*-
"""Edmund Jones(In Zodiaco)与顺逆 / 相位侧设置:
- 弧取绝对值、不分方向:只出顺向 / 只出逆向 / 新式逆向 都与全部输出逐行相同(此前按正负筛,只出逆向时整表几乎为空);
- 只出左旋:按真正的左旋相位点 Q = λ迫 + θ 一律用赤经式 |RA应 − RA_Q + θ|(合 / 冲同式),独立复算一行。"""
import math
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import swisseph  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1,
        'zodiacal': 0, 'tradition': False, 'predictive': True, 'pdaspects': [0, 60, 90, 120, 180], 'pdYears': 100,
        'pdMethod': 'in_zodiaco_abs', 'pdtype': 0}


def _rows(**over):
    p = dict(BASE, pdDirect=True, pdConverse=True)
    p.update(over)
    return sorted((round(float(a), 9), pid, sid) for a, pid, sid, *_ in PerChart(p).getPredict().getPrimaryDirection() or [])


def test_direction_filters_do_not_apply():
    allrows = _rows()
    assert allrows
    assert _rows(pdDirect=True, pdConverse=False) == allrows
    assert _rows(pdDirect=False, pdConverse=True) == allrows
    assert _rows(pdTradConverse=0) == allrows
    assert _rows(pdTradConverse=0, pdDirect=True, pdConverse=False) == allrows
    assert _rows(pdTradConverse=0, pdDirect=False, pdConverse=True) == allrows


def _n180(x):
    return (x + 180.0) % 360.0 - 180.0


def test_sinister_uses_true_sinister_point_ra_formula():
    rows = _rows(pdAspectSide=2)
    ids = {pid for _, pid, _ in rows}
    assert not any(str(i).startswith('D_') for i in ids)
    pc = PerChart(dict(BASE, pdAspectSide=2))
    chart = pc.getChart()
    eps = float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])
    moon, sun = chart.get('Moon'), chart.get('Sun')
    hit = [a for a, pid, sid in rows if pid == 'S_Moon_120' and sid == 'N_Sun_0']
    assert hit, '月亮左三分 → 太阳 行应存在'
    ra_q = swisseph.cotrans([(float(moon.lon) + 120.0) % 360.0, 0.0, 1.0], -eps)[0]
    ra_s = swisseph.cotrans([float(sun.lon), float(sun.lat), 1.0], -eps)[0]
    want = abs(_n180(ra_s - ra_q + 120.0))
    assert abs(hit[0] - want) < 1e-6
    # 只出右旋 = 缺省输出里的半弧行 + 冲(不含左旋行)
    dex = _rows(pdAspectSide=1)
    assert not any(str(pid).startswith('S_') for _, pid, _ in dex)
