# -*- coding: utf-8 -*-
"""主限法 钥匙补齐 + 界系变体守卫(P0-6 / P0-7)。

  User 自定义钥匙:每年度数由 pdTimeKeyCustom 承载(弧不变,日期随 rate 变)。
  Kepler/VanDam 升逐年真行动态(与 Placidus 真太阳弧同设施);NaibodRA/AscendantArc 命名对齐。
  界系变体 termsVariant(0 埃及默认/1 托勒密/2 莉莉)贯通 PD 界行(T_ 行)与分配星时间线。
  默认全部 = 现状(字节零回归,golden 另行看守)。
"""
import json

import pytest

from astrostudy import perchart, perpredict
from astrostudy.perpredict import STATIC_TIME_KEY_SCALES, _pdTimeKeyScale


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}


def _rows(**over):
    cd = dict(BASE)
    cd.update(over)
    return perpredict.PerPredict(perchart.PerChart(cd)).getPrimaryDirection()


def test_static_table_new_keys():
    assert STATIC_TIME_KEY_SCALES['NaibodRA'] == STATIC_TIME_KEY_SCALES['Naibod']
    assert STATIC_TIME_KEY_SCALES['AscendantArc'] == 1.0
    assert STATIC_TIME_KEY_SCALES['Ptolemy'] == 1.0     # 铁律字面量


def test_user_key_scale_and_fallback():
    assert _pdTimeKeyScale('User', custom=2.5) == 2.5
    assert _pdTimeKeyScale('User', custom=None) == 1.0
    assert _pdTimeKeyScale('User', custom='bogus') == 1.0
    assert _pdTimeKeyScale('User', custom=999) == 1.0   # 越域回退


def test_user_key_changes_dates_not_arcs():
    u1 = _rows(pdTimeKey='User', pdTimeKeyCustom=1.0)
    u2 = _rows(pdTimeKey='User', pdTimeKeyCustom=2.0)
    assert [r[0] for r in u1] == [r[0] for r in u2]
    assert [r[4] for r in u1[:5]] != [r[4] for r in u2[:5]]


def test_kepler_vandam_are_dynamic():
    p = _rows()
    for key in ('Kepler', 'VanDam'):
        k = _rows(pdTimeKey=key)
        assert [r[0] for r in k] == [r[0] for r in p]           # 弧不动
        assert [r[4] for r in k[:5]] != [r[4] for r in p[:5]]   # 日期动态


def test_naibod_ra_alias_identical():
    a = json.dumps(_rows(pdTimeKey='NaibodRA'), default=str)
    b = json.dumps(_rows(pdTimeKey='Naibod'), default=str)
    assert a == b


def test_terms_variant_defaults_and_differs():
    e = json.dumps(_rows(pdTerms=True), default=str)
    e0 = json.dumps(_rows(pdTerms=True, termsVariant=0), default=str)
    t1 = json.dumps(_rows(pdTerms=True, termsVariant=1), default=str)
    t2 = json.dumps(_rows(pdTerms=True, termsVariant=2), default=str)
    assert e == e0                          # 默认=埃及,零回归
    assert e != t1 and e != t2 and t1 != t2  # 三表两两有差


def test_terms_variant_row_counts():
    for v in (0, 1, 2):
        rows = _rows(pdTerms=True, termsVariant=v)
        assert len({r[1] for r in rows if r[1].startswith('T_')}) == 60, v


def test_distributions_follow_variant():
    d0 = perpredict.PerPredict(perchart.PerChart(dict(BASE))).getDistributions()
    cd = dict(BASE)
    cd['termsVariant'] = 2
    d2 = perpredict.PerPredict(perchart.PerChart(cd)).getDistributions()
    assert json.dumps(d0, default=str) != json.dumps(d2, default=str)
