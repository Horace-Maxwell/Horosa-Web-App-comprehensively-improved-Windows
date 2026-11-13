"""量化盘(汉堡学派)WP-11 平行/赤纬接触测试。

守住:
 1. 同号 |Δdecl|≤orb = parallel;异号 |abs−abs|≤orb = contraParallel(本仓 perchart 同源口径)。
 2. include_tnp=True 时 8 TNP 入算且赤纬为真值(读对象自带的本日真赤纬,与主盘行星同一出口)。
 3. 四轴(Asc/MC/Desc/IC)绝不入算。
 4. NaN/None 赤纬安全跳过、不抛栈。
"""
import gzip
import json
from pathlib import Path

from astrostudy import perchart
from astrostudy.germany.declination import (
    compute_declination, _finite, LIST_DECL_PLANET, _tnp_decls,
)
from flatlib import const

_CORPUS = (
    Path(__file__).resolve().parent
    / 'data' / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)


def _sample_chart_data():
    with gzip.open(_CORPUS, 'rt', encoding='utf-8') as f:
        return json.loads(f.readline())['chart_data']


CD = _sample_chart_data()


def _perchart():
    return perchart.PerChart(dict(CD))


_AXES = (const.ASC, const.MC, const.DESC, const.IC)


def test_returns_three_buckets():
    res = compute_declination(_perchart())
    assert set(res.keys()) == {'parallel', 'contraParallel', 'decls'}
    assert isinstance(res['parallel'], list)
    assert isinstance(res['contraParallel'], list)
    assert isinstance(res['decls'], dict)


def test_axes_excluded():
    # 四轴绝不出现在 decls 或任何接触对里(Asc.decl 是地理纬度,非真赤纬)。
    res = compute_declination(_perchart(), include_tnp=True)
    assert not any(ax in res['decls'] for ax in _AXES), '四轴不入 decls'
    for pair in res['parallel'] + res['contraParallel']:
        assert pair['a'] not in _AXES and pair['b'] not in _AXES, '四轴不入接触对'


def test_planets_present():
    # 10 行星都应有真赤纬入 decls(读 perchart.decl)。
    res = compute_declination(_perchart(), include_tnp=False)
    for oid in LIST_DECL_PLANET:
        assert oid in res['decls'], f'{oid} 缺真赤纬'
    # include_tnp=False 时不含任何 TNP。
    assert not any(u in res['decls'] for u in const.LIST_URANIAN)


def test_include_tnp_adds_eight_with_real_decl():
    res = compute_declination(_perchart(), include_tnp=True)
    present = [u for u in const.LIST_URANIAN if u in res['decls']]
    assert len(present) == 8, f'include_tnp=True 应含 8 TNP,实得 {present}'
    # 关键:TNP 赤纬必须是真值,不能全是历表默认 0.0(否则说明没现算)。
    tnp_decls = _tnp_decls(_perchart())
    assert len(tnp_decls) == 8
    assert any(abs(v) > 1e-6 for v in tnp_decls.values()), 'TNP 赤纬不应恒为 0(必须是本日真赤纬)'


def test_parallel_same_sign_within_orb():
    # 构造同号、差 0.4° → 平行;orb=1。受控替身确定性验证判别逻辑。
    res = compute_declination(_StubPC({const.SUN: 12.0, const.MOON: 12.4}), include_tnp=False)
    pairs = {(p['a'], p['b']) for p in res['parallel']}
    assert (const.SUN, const.MOON) in pairs or (const.MOON, const.SUN) in pairs
    # 异号桶里不应有这对。
    cpairs = {(p['a'], p['b']) for p in res['contraParallel']}
    assert (const.SUN, const.MOON) not in cpairs and (const.MOON, const.SUN) not in cpairs


def test_contra_parallel_opposite_sign_within_orb():
    # 异号、|abs−abs|=0.3° → 反平行。
    res = compute_declination(_StubPC({const.SUN: 12.0, const.MOON: -12.3}), include_tnp=False)
    cpairs = {(p['a'], p['b']) for p in res['contraParallel']}
    assert (const.SUN, const.MOON) in cpairs or (const.MOON, const.SUN) in cpairs
    ppairs = {(p['a'], p['b']) for p in res['parallel']}
    assert (const.SUN, const.MOON) not in ppairs and (const.MOON, const.SUN) not in ppairs


def test_out_of_orb_no_contact():
    # 同号但差 5° > orb=1 → 无接触。
    res = compute_declination(_StubPC({const.SUN: 12.0, const.MOON: 17.0}), include_tnp=False)
    assert res['parallel'] == [] and res['contraParallel'] == []


def test_orb_widens_contacts():
    pc_vals = {const.SUN: 12.0, const.MOON: 14.5}  # 同号差 2.5°
    narrow = compute_declination(_StubPC(pc_vals), orb=1.0, include_tnp=False)
    wide = compute_declination(_StubPC(pc_vals), orb=3.0, include_tnp=False)
    assert narrow['parallel'] == []
    assert len(wide['parallel']) == 1


def test_nan_and_none_safe():
    # 一点 NaN、一点 None、一点正常 → 不崩,坏点被跳过。
    res = compute_declination(
        _StubPC({const.SUN: float('nan'), const.MOON: None, const.MARS: 5.0}),
        include_tnp=False,
    )
    assert const.SUN not in res['decls']
    assert const.MOON not in res['decls']
    assert const.MARS in res['decls']
    assert res['parallel'] == [] and res['contraParallel'] == []


def test_finite_helper():
    assert _finite(None) is None
    assert _finite(float('nan')) is None
    assert _finite(float('inf')) is None
    assert _finite('x') is None
    assert _finite(3) == 3.0
    assert _finite(-2.5) == -2.5


def test_node_axis_is_never_a_contact():
    # 南北交是定义对点:赤纬恒互为相反数,任何盘都「反平行、差 0」—— 不列(与主盘赤纬平行同一组对点)。
    # 替身:北交 -21.4 / 南交 +21.4 正是真盘的样子;太阳 +21.0 与二者都在容许度内,照常成对。
    res = compute_declination(_StubPC({const.NORTH_NODE: -21.4, const.SOUTH_NODE: 21.4, const.SUN: 21.0}),
                              include_tnp=False)
    pairs = [{p['a'], p['b']} for p in res['parallel'] + res['contraParallel']]
    assert {const.NORTH_NODE, const.SOUTH_NODE} not in pairs
    assert {const.SUN, const.SOUTH_NODE} in pairs and {const.SUN, const.NORTH_NODE} in pairs
    real = compute_declination(_perchart(), orb=10.0, include_tnp=False)
    assert const.NORTH_NODE in real['decls'] and const.SOUTH_NODE in real['decls']
    assert abs(real['decls'][const.NORTH_NODE] + real['decls'][const.SOUTH_NODE]) < 1e-3
    assert {const.NORTH_NODE, const.SOUTH_NODE} not in [{p['a'], p['b']} for p in real['parallel'] + real['contraParallel']]


def test_invalid_orb_falls_back():
    # orb 非法回退 1.0:差 2.5° 同号在 orb=1 下无接触。
    res = compute_declination(_StubPC({const.SUN: 12.0, const.MOON: 14.5}), orb=-1, include_tnp=False)
    assert res['parallel'] == []


# ── 受控替身:让平行/反平行判别可在固定赤纬下确定性验证(不依赖真历表数值漂移)──
class _StubPC:
    """只暴露 declination.py 需要的最小面:chart.getObject(id).decl;include_tnp=False 时
    _tnp_decls 不被调用,故无需 dateTime/pos。"""
    def __init__(self, decl_map):
        self._m = decl_map
        outer = self

        class _Chart:
            @staticmethod
            def getObject(oid):
                if oid not in outer._m:
                    raise KeyError(oid)
                o = type('O', (), {})()
                o.decl = outer._m[oid]
                return o
        self.chart = _Chart()
