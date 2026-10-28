"""界表 / 三分表昼夜变体换表不吞错:按请求参数选表、无外部失败面,抛错即代码错 —— 整请求报错,不出口径不明的盘。

病理:换表块包在 `try: … except Exception: pass` 里。一旦抛错,不是「回落缺省表」,而是 essential 里留着上一张盘
换上的表(同一临界区「夜盘在前、昼盘在后」时夜表跨盘泄漏),本盘所选的迦勒底界 / 水象变体静默失效,回包无任何标记。
判据:成功路径(迦勒底界夜盘换夜表、昼盘复位;水象变体夜盘换夜表、昼盘复位)与原口径一致;参数对象取值抛错时异常上抛;
setupPlanets 不再有吞错块(静默吞错守卫登记次数同步)。
"""
import ast
import inspect

import pytest
from flatlib.dignities import essential

from astrostudy import perchart as P


def _bare(diurnal, data):
    pc = P.PerChart.__new__(P.PerChart)
    pc.isDiurnal = diurnal
    pc.data = data
    return pc


def test_chaldean_terms_night_swap_and_day_reset():
    tok = P.push_request_terms(3)
    try:
        assert essential.TERMS is P._CHALDEAN_TERMS_DAY
        _bare(False, {'termsVariant': '3'})._applyClassicalNightTables()
        assert essential.TERMS is P._CHALDEAN_TERMS_NIGHT
        _bare(True, {'termsVariant': '3'})._applyClassicalNightTables()   # 同一临界区下一张昼盘复位
        assert essential.TERMS is P._CHALDEAN_TERMS_DAY
    finally:
        P.pop_request_terms(tok)


def test_water_variant_triplicity_night_swap_and_day_reset():
    tok = P.push_request_trip('PtolemaicWaterVariant')
    try:
        _bare(False, {'triplicity': 'PtolemaicWaterVariant'})._applyClassicalNightTables()
        assert essential.TABLE is P._PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT
        _bare(True, {'triplicity': 'PtolemaicWaterVariant'})._applyClassicalNightTables()
        assert essential.TABLE is P._PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY
    finally:
        P.pop_request_trip(tok)


def test_default_request_touches_nothing():
    terms, table = essential.TERMS, essential.TABLE
    _bare(False, {})._applyClassicalNightTables()
    _bare(True, None)._applyClassicalNightTables()
    assert essential.TERMS is terms and essential.TABLE is table


class _Boom(dict):
    def get(self, *_a, **_k):
        raise RuntimeError('injected')


def test_failure_raises_instead_of_silent_stale_table():
    tok = P.push_request_terms(3)
    try:
        _bare(False, {'termsVariant': '3'})._applyClassicalNightTables()   # 上一张夜盘换上夜表
        with pytest.raises(RuntimeError):
            _bare(True, _Boom())._applyClassicalNightTables()
    finally:
        P.pop_request_terms(tok)
    assert essential.TERMS is not P._CHALDEAN_TERMS_NIGHT   # pop 还原


def test_setup_planets_has_no_swallowing_block_around_table_swap():
    for fn in (P.PerChart._applyClassicalNightTables, P.PerChart.setupPlanets):
        tree = ast.parse(_dedent(inspect.getsource(fn)))
        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                body_src = ast.dump(ast.Module(body=node.body, type_ignores=[]))
                for name in ('essential', '_applyClassicalNightTables', '_placeFortunaWholeHouses'):
                    assert name not in body_src, (fn.__name__, name)


def _dedent(src):
    import textwrap
    return textwrap.dedent(src)
