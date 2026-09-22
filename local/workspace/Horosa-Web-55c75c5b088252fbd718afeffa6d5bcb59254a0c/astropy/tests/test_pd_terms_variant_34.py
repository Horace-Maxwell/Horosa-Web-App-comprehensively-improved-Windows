# -*- coding: utf-8 -*-
"""[Q-519/T-481] 主限法「界」/界推运在界系 3(迦勒底)/4(自定义)档:此前两处只映射 1/2,其余一律埃及界 → 取请求级生效表。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from flatlib.dignities import essential, tables  # noqa: E402
from astrostudy import pd_engine, perchart  # noqa: E402
from astrostudy.termdirection import TermDirection  # noqa: E402


def _with_terms(table, fn):
    orig = essential.TERMS
    essential.TERMS = table
    try:
        return fn()
    finally:
        essential.TERMS = orig


def test_term_boundaries_variant3_uses_active_chaldean_table():
    egy = pd_engine.term_boundaries(0)
    cha = _with_terms(perchart._CHALDEAN_TERMS_DAY, lambda: pd_engine.term_boundaries(3))
    assert cha != egy
    aries = [t for t in cha if t[1] == 0]
    assert aries[0][0] == 'Jupiter' and abs(aries[0][2] - 0.0) < 1e-9   # 迦勒底火象昼序:木 0-8
    assert [t[0] for t in aries] == ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Mars']
    # 0/1/2 档字节不变(不读生效表)
    assert _with_terms(perchart._CHALDEAN_TERMS_DAY, lambda: pd_engine.term_boundaries(0)) == egy
    assert _with_terms(perchart._CHALDEAN_TERMS_DAY, lambda: pd_engine.term_boundaries(1)) == pd_engine.term_boundaries(1)


def test_term_boundaries_variant4_uses_active_custom_table():
    rows = [[['jupiter', 6], ['venus', 6], ['mercury', 6], ['mars', 6], ['saturn', 6]] for _ in range(12)]
    custom = perchart._buildCustomTermsTable(rows)
    assert custom is not None
    out = _with_terms(custom, lambda: pd_engine.term_boundaries(4))
    aries = [t for t in out if t[1] == 0]
    assert [round(t[2], 6) for t in aries] == [0.0, 6.0, 12.0, 18.0, 24.0]


def test_termdirection_build_terms_variant3():
    td = TermDirection.__new__(TermDirection)
    td.clockwise = True
    td.terms_variant = 3
    res = _with_terms(perchart._CHALDEAN_TERMS_DAY, lambda: td._buildTerms())
    assert res['Aries']['Jupiter'] == 0.0
    td.terms_variant = 0
    res0 = _with_terms(perchart._CHALDEAN_TERMS_DAY, lambda: td._buildTerms())
    assert res0['Aries']['Jupiter'] == 0.0 and 'Venus' in res0['Aries'] and res0['Aries']['Venus'] == 6.0   # 埃及:白羊 木0-6 金6-12
