# -*- coding: utf-8 -*-
"""[Q-258/T-221][Q-338/T-319] 福点整宫制(hsys=24)× 福点反转 / 变体 / 站心月:第 1 宫须 = 最终福点所在整座。
夜盘关反转:福点换式(相差可达数十度)→ 旧码第 1 宫仍按夜式福点定 → 与盘上福点不同座。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const
from astrostudy import perchart, astroextra

HSYS_FORTUNA_WHOLE = perchart.hsys.index(perchart.custHouse_Fortuna_Whole)
NIGHT = {'date': '1990/05/18', 'time': '23:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E28', 'ad': 1}


def _pc(extra):
    d = astroextra.base_params(dict(NIGHT))
    d['hsys'] = HSYS_FORTUNA_WHOLE
    d.update(extra)
    pc = perchart.PerChart(d)
    pc.getChartObj()
    return pc


def _house1_and_pf(pc):
    h1 = pc.chart.getHouse(const.HOUSE1).lon
    pf = pc.chart.getObject(const.PARS_FORTUNA).lon
    return h1 % 360.0, pf % 360.0


def test_default_night_house1_matches_fortuna_sign():
    h1, pf = _house1_and_pf(_pc({}))
    assert abs(h1 - (int(pf // 30) * 30)) < 1e-6


def test_lot_reversal_off_house1_follows_relocated_fortuna():
    pc_def = _pc({})
    pc_off = _pc({'lotReversal': 0})
    h1d, pfd = _house1_and_pf(pc_def)
    h1o, pfo = _house1_and_pf(pc_off)
    assert not pc_off.isDiurnal
    assert abs(pfd - pfo) > 1.0          # 夜盘关反转 → 福点换式
    assert abs(h1o - (int(pfo // 30) * 30)) < 1e-6   # 第 1 宫 = 最终福点所在座
    for hid in (const.HOUSE1, const.HOUSE7):
        assert pc_off.chart.getHouse(hid).size == 30


def test_lot_projection_sign_keeps_house1_on_fortuna_sign():
    pc = _pc({'lotProjection': 'sign'})
    h1, pf = _house1_and_pf(pc)
    # [Q-259 2026-09-18] 座序计数后福点带 ASC 座内度(不再钉 0°);从福点起十二宫的第 1 宫仍坐福点所在座之首
    assert abs(h1 - int(pf // 30) * 30) < 1e-6
