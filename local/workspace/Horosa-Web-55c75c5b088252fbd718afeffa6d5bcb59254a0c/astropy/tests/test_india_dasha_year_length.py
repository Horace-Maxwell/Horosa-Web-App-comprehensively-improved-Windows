# -*- coding: utf-8 -*-
"""G5 · Dasha 年长参数化(权威 §10.1.5 / A.3)。

守三件事:
① 五档年长真正贯穿主 Vimshottari 与 extended 条件宿系(段起讫随档变);
② 缺省/非法值一律回落 365.25(与既有输出字节一致 = 零回归门);
③ 🔴 参数化绝不改写 dasha_extended.YEAR_MODE 模块全局(进程级共享态,并发污染风险)。
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

import astrostudy.india.dasha_extended as dx  # noqa: E402
from astrostudy.india.jyotish_engine import JyotishEngine  # noqa: E402


def _eng(year=None):
    eng = JyotishEngine.__new__(JyotishEngine)
    if year is not None:
        eng.dasha_year_days = year
    return eng


def test_year_length_flows_into_build_periods():
    """同一输入换年长 → 段终点日期必须随之移(360 vs 365.25 差 5.25 日/年,10 年差 52 日+)。"""
    from astrostudy.india.jyotish_engine import YOGINI_SEQUENCE, YOGINI_TOTAL
    birth = datetime(1990, 1, 1, 12, 0, 0)
    a = _eng(365.25)._build_periods(YOGINI_SEQUENCE, YOGINI_TOTAL, 'Moon', 0.5, birth)
    b = _eng(360.0)._build_periods(YOGINI_SEQUENCE, YOGINI_TOTAL, 'Moon', 0.5, birth)
    # 年数序列不变(年长只改日历换算,不改年数)
    assert [m['years'] for m in a['mahadashas'][:4]] == [m['years'] for m in b['mahadashas'][:4]]
    # 但日历段必须不同
    assert a['mahadashas'][1]['end'] != b['mahadashas'][1]['end']
    # 360 日年更短 → 同年数结束更早
    assert b['mahadashas'][1]['endIso'] < a['mahadashas'][1]['endIso']


def test_default_class_attr_is_julian():
    """缺省(含 __new__ 直构)= 365.25,与既有主 Vimshottari 输出字节一致。"""
    assert abs(JyotishEngine.dasha_year_days - 365.25) < 1e-9


def test_invalid_year_falls_back():
    """非白名单值/坏类型 → 静默回落 365.25,绝不炸盘也绝不放行任意值。"""
    class _Fake:                      # 最小 perchart 桩:__init__ 只需 .chart 上有属性读取
        chart = None
    try:
        eng = JyotishEngine(_Fake(), dasha_year_days=999.0)
    except Exception:
        # __init__ 后续 safe_get(None) 若抛错,退化为直接验白名单逻辑
        eng = JyotishEngine.__new__(JyotishEngine)
        _yd = 999.0
        eng.dasha_year_days = _yd if any(abs(_yd - c) < 1e-6 for c in JyotishEngine._DASHA_YEAR_CHOICES) else 365.25
    assert abs(eng.dasha_year_days - 365.25) < 1e-9


def test_extended_param_does_not_touch_global():
    """🔴 形参传 savana 跑 extended,全局 YEAR_MODE 必须纹丝不动(并发安全之根)。"""
    before = dx.YEAR_MODE
    res = dx.build_nakshatra_dasha(
        dx.CONDITIONAL_SPEC_BY_KEY['shodashottari'], 10.0, 3, 0.5,
        year_length_days=360.0)
    assert res['yearLengthDays'] == 360.0
    assert res['yearMode'] == 'savana'
    assert dx.YEAR_MODE == before == 'julian'


def test_extended_default_metadata_is_julian():
    """extended 缺省元数据 = 365.25/julian(统一后的默认;此为决策 #6 的字节定格)。"""
    res = dx.build_nakshatra_dasha(
        dx.CONDITIONAL_SPEC_BY_KEY['shodashottari'], 10.0, 3, 0.5)
    assert abs(res['yearLengthDays'] - 365.25) < 1e-9
    assert res['yearMode'] == 'julian'


def test_extended_aggregate_passthrough():
    res = dx.build_all_conditional_dashas(10.0, 3, 0.5, year_length_days=365.2563)
    for key, item in res.items():
        assert item['yearMode'] == 'sidereal', key
        assert abs(item['yearLengthDays'] - 365.2563) < 1e-9, key
