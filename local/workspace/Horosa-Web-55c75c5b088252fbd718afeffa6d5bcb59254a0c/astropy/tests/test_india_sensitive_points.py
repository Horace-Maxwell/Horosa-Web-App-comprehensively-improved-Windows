# -*- coding: utf-8 -*-
"""G2/G3/G4 · 敏感点 Sphuta(权威 §20.5 / §17.5 / §22.5)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from flatlib import const  # noqa: E402

from astrostudy.india import sensitive_points as sp  # noqa: E402


# ── G2 生育点 ──────────────────────────────────────────────────────────────
def test_beeja_kshetra_formula():
    """公式逐字:Beeja=(Sun+Venus+Jupiter)%360;Kshetra=(Moon+Mars+Jupiter)%360。"""
    r = sp.beeja_kshetra_sphuta(100.0, 200.0, 300.0, 10.0, 20.0)
    assert abs(r['beeja']['lon'] - (100 + 200 + 300) % 360) < 1e-9      # 240
    assert abs(r['kshetra']['lon'] - (10 + 20 + 300) % 360) < 1e-9      # 330
    assert r['beeja']['rasi']['sign'] == const.SAGITTARIUS
    assert r['kshetra']['rasi']['sign'] == const.PISCES


def test_beeja_kshetra_missing_source_degrades():
    r = sp.beeja_kshetra_sphuta(None, 200.0, 300.0, 10.0, 20.0)
    assert r['beeja']['available'] is False
    assert r['kshetra']['available'] is True          # 各点独立降级


def test_beeja_verdict_uses_both_sign_and_navamsa():
    r = sp.beeja_kshetra_sphuta(100.0, 200.0, 300.0, 10.0, 20.0)
    for key in ('beeja', 'kshetra'):
        item = r[key]
        assert item['verdict'] in ('favorable', 'unfavorable', 'mixed')
        assert item['rasi']['lordNature'] in ('benefic', 'malefic', 'neutral')
        assert item['navamsa']['lordNature'] in ('benefic', 'malefic', 'neutral')


# ── G3 Gandanta / Sandhi ──────────────────────────────────────────────────
def test_gandanta_three_junctions_and_orb():
    """三处水火交界 ±0°48′;窗外一分即出。"""
    for j in (0.0, 120.0, 240.0):
        for off in (-0.7999, -0.4, 0.0, 0.4, 0.7999):
            assert sp.gandanta_status((j + off) % 360.0)['inGandanta'], (j, off)
        for off in (-0.9, 0.9):
            assert not sp.gandanta_status((j + off) % 360.0)['inGandanta'], (j, off)
    # 非交界座界(如 30°=白羊↔金牛)绝不判 Gandanta
    assert not sp.gandanta_status(30.0)['inGandanta']
    assert not sp.gandanta_status(29.9)['inGandanta']


def test_gandanta_wrap_at_zero():
    """Revati↔Ashwini 跨黄道零点是唯一 wrap 用例:359°13′ 起即入界。"""
    g = sp.gandanta_status(359.5)
    assert g['inGandanta'] and g['junction'] == 'Pisces-Aries' and g['side'] == 'end'
    g2 = sp.gandanta_status(0.3)
    assert g2['inGandanta'] and g2['side'] == 'start'
    assert abs(g2['arcminToBoundary'] - 18.0) < 0.1


def test_rasi_sandhi_any_boundary():
    assert sp.rasi_sandhi_status(29.5)['inSandhi']
    assert sp.rasi_sandhi_status(29.5)['position'] == 'sign_end'
    assert sp.rasi_sandhi_status(60.5)['inSandhi']
    assert sp.rasi_sandhi_status(60.5)['position'] == 'sign_start'
    assert not sp.rasi_sandhi_status(15.0)['inSandhi']


def test_boundary_flags_only_hits():
    hits = sp.boundary_flags_for({const.MOON: 120.3, const.SUN: 45.0, 'Lagna': 240.5})
    names = {h['body'] for h in hits}
    assert const.MOON in names and 'Lagna' in names and const.SUN not in names


# ── G4 死亡指示点(仅风险标注)──────────────────────────────────────────
def test_drekkana22_arithmetic():
    """21 个 Drekkana = 7 座整 → 第 22 个恰始于自 Lagna Drekkana 起第 8 座同位。"""
    d = sp.death_indicator_points(5.0, None)     # Lagna 白羊第 1 Drekkana(idx 0)
    dr = d['drekkana22']
    assert dr['segmentIndex'] == 22              # (0+21)%36 → 0-based 21 → 1-based 22
    assert dr['containingSign'] == const.SCORPIO  # 第 22 段 = 210°–220° = 天蝎首段
    assert dr['lord'] is not None
    assert d['navamsa64FromMoon'] is None        # 缺月 → 该口径置 None 不编值


def test_navamsa64_two_reckonings_present():
    d = sp.death_indicator_points(15.0, 100.0)
    assert d['navamsa64FromMoon'] is not None
    assert d['navamsa64FromLagna'] is not None
    assert d['navamsa64FromMoon']['countedTo'] == 64
    # 64 = 12×5+4 ⇒ 64th Navamsa 的 D9 座 = 起点 D9 座 + 3(第 4 座)
    from astrostudy.india.varga import varga_position
    start_idx = int((100.0) / (10.0 / 3.0))
    start_d9_sign = int(varga_position(start_idx * (10.0 / 3.0) + (10.0 / 6.0), 9) // 30.0)
    got_sign = d['navamsa64FromMoon']['navamsaSign']
    assert const.LIST_SIGNS[(start_d9_sign + 3) % 12] == got_sign


def test_death_indicators_never_output_lifespan():
    """🔴 伦理红线:输出键里绝不含寿数类字段,且免责文案恒在。"""
    d = sp.death_indicator_points(15.0, 100.0)
    flat = str(d)
    for banned in ('lifespan', 'lifeYears', '寿数', '享年'):
        assert banned not in flat
    assert '不构成任何寿命预测' in d['disclaimer']


def test_mrityu_bhaga_empty_table_returns_none():
    """表空 ⇒ None(= 待录入,非「无命中」);录入后形状测试另守。"""
    assert sp.MRITYU_BHAGA == {}
    assert sp.mrityu_bhaga_hits({const.SUN: 10.0}) is None
