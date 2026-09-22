# -*- coding: utf-8 -*-
"""[Q-337/T-318] 虚点接纳相位开启 + 慢行星留驻窗口:aspectsByCat 主动方 movement=Stationary 此前 KeyError → 整张盘 param error。
现留驻归入「无运动」桶(结果形状不变)。锚:2020-04-26 02:53 +08:00 31n14 121e28(冥王留点时刻)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra


def _pc(vp):
    pc = perchart.PerChart(astroextra.base_params({
        'date': '2020/04/26', 'time': '02:53:00', 'zone': '+08:00',
        'lat': '31N14', 'lon': '121E28', 'ad': 1, 'hsys': 0, 'virtualPointReceiveAsp': vp,
    }))
    pc.getChartObj()
    return pc


def test_get_aspects_with_virtual_points_does_not_raise():
    pc = _pc(True)
    res = pc.getAspects()
    assert isinstance(res, dict) and res
    for asp in res.values():
        assert set(asp.keys()) >= {'Applicative', 'Separative', 'Exact', 'None', 'Obvious'}
        assert 'Stationary' not in asp


def test_default_path_unchanged_shape():
    pc = _pc(False)
    res = pc.getAspects()
    assert isinstance(res, dict) and res
