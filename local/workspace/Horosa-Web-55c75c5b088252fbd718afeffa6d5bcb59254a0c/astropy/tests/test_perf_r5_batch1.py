# -*- coding: utf-8 -*-
"""[R5 第 1 批] T1 星历路径短路 + T2 JSON 快径 —— 逐字节零漂移 + 开关回退 + 结构安全(close 作废追踪)。
零功能变化的根据全在这里:同一张盘、同一个响应对象,开关开 / 关两条路的字节必须相等。"""
import json
import os
import re
import sys
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import swisseph
from flatlib.ephem import swe as fswe
from astrostudy import perchart as pc_mod
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request
from astrostudy.guostarsect.guostarsect import GuoStarSect
from astrostudy.helper import getPredictivesObj

BASE = {'date': '1990/05/18', 'time': '23:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E28', 'ad': 1,
        'hsys': 1, 'zodiacal': 0, 'tradition': 0, 'predictive': True, 'doubingSu28': 0, 'strongRecption': False,
        'simpleAsp': False, 'virtualPointReceiveAsp': False, 'southchart': 0, 'asporb': 0}


def _chart_obj(extra=None):
    d = dict(BASE)
    if extra:
        d.update(extra)
    tok = push_classical_request(d)
    try:
        pc = PerChart(d)
        gs = GuoStarSect(pc)
        obj = {
            'chart': pc.getChartObj(), 'receptions': pc.getReceptions(), 'mutuals': pc.getMutuals(),
            'declParallel': pc.getParallel(),
            'aspects': {'normalAsp': pc.getAspects(), 'immediateAsp': pc.getImmediateAspects(), 'signAsp': pc.getSignAspects()},
            'lots': pc.getPars(pc.chart),
            'surround': {'planets': pc.surroundPlanets(), 'attacks': pc.surroundAttacks(), 'houses': pc.surroundHouses(),
                         'besiegement': pc.besiegementDetail()},
            'guoStarSect': {'houses': gs.allTerm()},
        }
        pr = getPredictivesObj(d, pc)
        if pr is not None:
            obj['predictives'] = pr
        return obj
    finally:
        pop_classical_request(tok)


# ── T2 JSON 快径 ──────────────────────────────────────────────────────────────

def _shim_and_real():
    from websrv import webchartsrv as W
    from websrv import fastjson as FJ
    shim = W.jsonpickle
    assert type(shim).__name__ == 'FastJsonEncodeShim', '真 jsonpickle 在场时 webchartsrv 必须套 shim'
    # 对拍基准一律取「未经快径包装」的原 encode:进程级快径装上后 shim._real.encode 本身也是快径版,
    # 拿它当基准 = 自己比自己(判别力归零)。
    real = type('RealJsonpickle', (), {'encode': staticmethod(FJ.original_encode(shim))})()
    return FJ, shim, real


def _fast_taken(FJ, fn):
    before = dict(FJ.STATS)
    out = fn()
    return out, FJ.STATS['fast'] - before['fast'], FJ.STATS['fallback'] - before['fallback']


def test_fastjson_real_chart_response_byte_identical_and_fast_path_taken():
    FJ, shim, real = _shim_and_real()
    assert FJ._FAST_JSON_ON is True
    for extra in ({}, {'predictive': False}, {'zodiacal': 1}, {'hsys': 3, 'tradition': 1}):
        obj = _chart_obj(extra)
        (fast, n_fast, n_fb) = _fast_taken(FJ, lambda: shim.encode(obj, unpicklable=False))
        slow = real.encode(obj, unpicklable=False)
        assert fast == slow, extra                      # 逐字节相同(含 240 余处 flatlib 对象的扁平化)
        assert (n_fast, n_fb) == (1, 0), extra          # 真走了快径,不是靠回退撑起的相等
        assert len(fast) > 100 * 1024


def test_fastjson_solar_return_response_byte_identical():
    FJ, shim, real = _shim_and_real()
    d = dict(BASE); d['tradition'] = False
    tok = push_classical_request(d)
    try:
        pc = PerChart(d)
        predict = pc.getPredict()
        params = {'date': d['date'], 'time': d['time'], 'zone': d['zone'], 'lat': d['lat'], 'lon': d['lon'], 'hsys': d['hsys']}
        res = predict.getSolarReturn(params)
    finally:
        pop_classical_request(tok)
    (fast, n_fast, n_fb) = _fast_taken(FJ, lambda: shim.encode(res, unpicklable=False))
    assert fast == real.encode(res, unpicklable=False)
    assert n_fast == 1 and n_fb == 0


def test_fastjson_unknown_class_falls_back_not_flattened():
    FJ, shim, real = _shim_and_real()

    class Stranger(object):
        def __init__(self):
            self.a = 1
    obj = {'x': Stranger()}
    (out, n_fast, n_fb) = _fast_taken(FJ, lambda: shim.encode(obj, unpicklable=False))
    assert out == real.encode(obj, unpicklable=False)
    assert (n_fast, n_fb) == (0, 1)                      # 名单外 → 回退,绝不自行扁平化


def test_fastjson_synthetic_edge_trees_byte_identical():
    FJ, shim, real = _shim_and_real()
    trees = [
        {'中文': '日　庙　旺', 'k': [1, 2.5, -0.0, 1e16, 2 ** 63, True, None, '']},
        {1: 'int-key', 2: {'nested': [[], {}, 'x']}, 'z': 12345678901234567890},
        [{'a': 'é  😀'}, 'tab\t', 'nl\n', 'quote"', 'slash/'],
        {'float': [0.1, 1 / 3, 123456789.123456789, 1e-7, 5e-324]},
        [],
        {},
        'bare string',
        3.0,
    ]
    for t in trees:
        assert shim.encode(t, unpicklable=False) == real.encode(t, unpicklable=False), repr(t)[:80]


def test_fastjson_non_json_type_falls_back_to_real():
    FJ, shim, real = _shim_and_real()
    obj = {'when': datetime.datetime(2026, 9, 24, 12, 0, 0), 'obj': object()}
    assert shim.encode(obj, unpicklable=False) == real.encode(obj, unpicklable=False)


def test_fastjson_switch_off_delegates(monkeypatch):
    FJ, shim, real = _shim_and_real()
    calls = []
    monkeypatch.setattr(shim, '_real', type('R', (), {'encode': staticmethod(lambda obj, **kw: calls.append(kw) or 'REAL')})())
    monkeypatch.setattr(FJ, '_FAST_JSON_ON', False)
    assert shim.encode({'a': 1}, unpicklable=False) == 'REAL'
    assert calls and calls[0].get('unpicklable') is False


def test_fastjson_non_default_args_never_take_fast_path(monkeypatch):
    FJ, shim, real = _shim_and_real()
    calls = []
    monkeypatch.setattr(shim, '_real', type('R', (), {'encode': staticmethod(lambda obj, **kw: calls.append(kw) or 'REAL')})())
    assert shim.encode({'a': 1}, unpicklable=True) == 'REAL'
    assert shim.encode({'a': 1}, unpicklable=False, indent=2) == 'REAL'
    assert len(calls) == 2


def test_fastjson_predict_service_also_shimmed():
    from websrv import webpredictsrv as P
    from websrv import fastjson as FJ
    assert type(P.jsonpickle).__name__ == 'FastJsonEncodeShim'
    assert P.jsonpickle.encode({'a': [1, 'b']}, unpicklable=False) == FJ.original_encode(P.jsonpickle)({'a': [1, 'b']}, unpicklable=False)


def test_chart_request_dump_print_removed():
    src = open(os.path.join(os.path.dirname(__file__), '..', 'websrv', 'webchartsrv.py'), encoding='utf-8').read()
    idx = src.index('def index(self):')
    body = src[idx: src.index('    def ', idx + 10)]
    # 只认真语句(行首 print(data)),注释里的说明文字不算
    assert not re.search(r'(?m)^\s*print\(data\)', body)


# ── T1 星历路径短路 ────────────────────────────────────────────────────────────

class _Counter:
    def __init__(self, real):
        self.real = real
        self.n = 0

    def __call__(self, path):
        self.n += 1
        return self.real(path)


def _count_set_path(monkeypatch, fastpath, fn):
    counter = _Counter(fswe._SET_EPHE_PATH)
    monkeypatch.setattr(fswe, '_SET_EPHE_PATH', counter)
    monkeypatch.setattr(fswe, '_EPHE_FASTPATH', fastpath)
    out = fn()
    return counter.n, out


def test_ephe_fastpath_skips_redundant_set_path_and_keeps_bytes(monkeypatch):
    FJ, shim, real = _shim_and_real()
    n_off, off = _count_set_path(monkeypatch, False, lambda: real.encode(_chart_obj({'time': '22:15:00'}), unpicklable=False))
    n_on, on = _count_set_path(monkeypatch, True, lambda: real.encode(_chart_obj({'time': '22:15:00'}), unpicklable=False))
    assert on == off                      # 逐字节相同
    assert n_off >= 100, n_off            # 旧路:每张盘重设上百次
    assert n_on <= 3, n_on                # 短路:至多首次建立(追踪已生效则 0)


def test_ephe_fastpath_restores_after_external_reset(monkeypatch):
    monkeypatch.setattr(fswe, '_EPHE_FASTPATH', True)
    fswe.ensureEphePath()
    counter = _Counter(fswe._SET_EPHE_PATH)
    monkeypatch.setattr(fswe, '_SET_EPHE_PATH', counter)
    fswe.ensureEphePath()
    assert counter.n == 0                 # 无人改动 → 跳过
    swisseph.set_ephe_path('')            # 外部把路径重置(kinastro 模块的老习惯)—— 经守卫入口,追踪同步
    assert counter.n == 1
    assert fswe._EPHE_PATH_ACTIVE == fswe._candidateEphePath()   # 空串被守卫换成打包路径
    fswe.ensureEphePath()
    assert counter.n == 1 or fswe._EPHE_PATH_ACTIVE == fswe.SEACTIVE_PATH


def test_ephe_close_invalidates_tracker(monkeypatch):
    monkeypatch.setattr(fswe, '_EPHE_FASTPATH', True)
    fswe.ensureEphePath()
    assert fswe._EPHE_PATH_ACTIVE == fswe.SEACTIVE_PATH
    fswe.closeEphemerisFiles()
    assert fswe._EPHE_PATH_ACTIVE is None
    counter = _Counter(fswe._SET_EPHE_PATH)
    monkeypatch.setattr(fswe, '_SET_EPHE_PATH', counter)
    fswe.ensureEphePath()
    assert counter.n == 1                 # close 之后必重设
    assert fswe._EPHE_PATH_ACTIVE == fswe.SEACTIVE_PATH


def test_ephe_external_reset_invalidates_jpl_tracker(monkeypatch):
    """C 侧 swe_set_ephe_path 会重置 JPL 文件名:外部模块重设路径之后,ensureEphePath 必须把 JPL 文件也重设回来
    (改前短路只看路径,JPL 追踪不作废 → JPL 模式下 kinastro 端点之后的计算静默退回缺省星历)。"""
    calls = []
    monkeypatch.setattr(fswe, '_EPHE_FASTPATH', True)
    monkeypatch.setattr(fswe, 'SEACTIVE_JPL_FILE', 'probe-jpl.eph')
    monkeypatch.setattr(fswe, '_JPL_FILE_ACTIVE', None)
    monkeypatch.setattr(swisseph, 'set_jpl_file', lambda f: calls.append(f))
    fswe.ensureEphePath()
    fswe.ensureEphePath()
    assert calls == ['probe-jpl.eph']        # 建立后短路
    swisseph.set_ephe_path('')               # 外部重设路径(经守卫)
    assert fswe._JPL_FILE_ACTIVE is None
    fswe.ensureEphePath()
    assert calls == ['probe-jpl.eph', 'probe-jpl.eph']


def test_ephe_switch_off_always_sets(monkeypatch):
    monkeypatch.setattr(fswe, '_EPHE_FASTPATH', False)
    counter = _Counter(fswe._SET_EPHE_PATH)
    monkeypatch.setattr(fswe, '_SET_EPHE_PATH', counter)
    fswe.ensureEphePath()
    fswe.ensureEphePath()
    assert counter.n == 2


# ── T3 相位请求级 memo ────────────────────────────────────────────────────────

def test_aspect_memo_scope_off_outside_critical_section():
    from flatlib import aspects as A
    assert A._aspectMemoTable() is None           # 临界区外零记忆 = 旧行为
    A.enterAspectMemoScope()
    try:
        assert isinstance(A._aspectMemoTable(), dict)
        A.enterAspectMemoScope()                   # 可重入
        A.exitAspectMemoScope()
        assert isinstance(A._aspectMemoTable(), dict)
    finally:
        A.exitAspectMemoScope()
    assert A._aspectMemoTable() is None


def test_aspect_memo_chart_bytes_identical_and_hits(monkeypatch):
    from flatlib import aspects as A
    FJ, shim, real = _shim_and_real()
    monkeypatch.setattr(A, '_ASPECT_MEMO_ON', False)
    off = real.encode(_chart_obj({'time': '21:05:00'}), unpicklable=False)
    monkeypatch.setattr(A, '_ASPECT_MEMO_ON', True)
    calls = {'compute': 0, 'dict': 0}
    orig_compute = A._aspectDictCompute
    orig_dict = A._aspectDict

    def counting_compute(o1, o2, lst):
        calls['compute'] += 1
        return orig_compute(o1, o2, lst)

    def counting_dict(o1, o2, lst):
        calls['dict'] += 1
        return orig_dict(o1, o2, lst)
    monkeypatch.setattr(A, '_aspectDictCompute', counting_compute)
    monkeypatch.setattr(A, '_aspectDict', counting_dict)
    on = real.encode(_chart_obj({'time': '21:05:00'}), unpicklable=False)
    assert on == off                                        # 逐字节相同
    assert calls['dict'] > 1000 and calls['compute'] < calls['dict'] * 0.75, calls   # 真有命中


def test_aspect_memo_returns_independent_dict():
    from flatlib import aspects as A
    from flatlib import const
    d = dict(BASE)
    tok = push_classical_request(d)
    try:
        pc = PerChart(d)
        sun = pc.chart.get(const.SUN); moon = pc.chart.get(const.MOON)
        a = A._aspectDict(sun, moon, const.MAJOR_ASPECTS)
        b = A._aspectDict(sun, moon, const.MAJOR_ASPECTS)
        if a:
            assert a == b and a is not b                    # 命中给浅拷贝,调用方改不坏表
            a['type'] = -999
            assert A._aspectDict(sun, moon, const.MAJOR_ASPECTS)['type'] != -999
    finally:
        pop_classical_request(tok)


# ── T5 请求优先级车道 ────────────────────────────────────────────────────────

def _lane_run(P, enabled):
    import threading, time as _t
    P.set_priority_lane_enabled(enabled)
    order = []
    holder_has_lock = threading.Event(); release_holder = threading.Event(); bg_ready = threading.Event()

    def holder():                      # 一个预取正占着临界区(模拟正在算的预取)
        P.set_request_priority('prefetch')
        tok = P.push_classical_request({}); holder_has_lock.set(); release_holder.wait(5); P.pop_classical_request(tok)

    def bg():                          # 第二个预取:先到、先排队
        P.set_request_priority('prefetch'); bg_ready.set()
        tok = P.push_classical_request({}); order.append('bg'); P.pop_classical_request(tok)

    def fg():                          # 前台:后到
        P.set_request_priority('fg')
        tok = P.push_classical_request({}); order.append('fg'); P.pop_classical_request(tok)
    th = threading.Thread(target=holder); th.start(); holder_has_lock.wait(5)
    tb = threading.Thread(target=bg); tb.start(); bg_ready.wait(5); _t.sleep(0.05)
    tf = threading.Thread(target=fg); tf.start(); _t.sleep(0.05)
    release_holder.set()
    for t in (th, tb, tf):
        t.join(10)
    P.set_request_priority(None)
    return order


def test_priority_lane_foreground_jumps_ahead_of_prefetch():
    from astrostudy import perchart as P
    orders = [_lane_run(P, True) for _ in range(5)]
    assert all(o == ['fg', 'bg'] for o in orders), orders   # 前台永远先于排在它前面的预取


def test_priority_lane_off_still_completes_both():
    from astrostudy import perchart as P
    try:
        order = _lane_run(P, False)
        assert sorted(order) == ['bg', 'fg']                # 关闸:不保证先后,只保证都完成
    finally:
        P.set_priority_lane_enabled(True)


def test_priority_lane_prefetch_never_starves():
    import time as _t
    from astrostudy import perchart as P
    P.set_priority_lane_enabled(True)
    orig = P._PRIORITY_YIELD_MAX_S
    P._PRIORITY_YIELD_MAX_S = 0.2
    try:
        with P._PRIORITY_COND:
            P._PRIORITY_FG_WAITING[0] += 1            # 伪造一个永不到来的前台
        P.set_request_priority('prefetch')
        t0 = _t.monotonic(); tok = P.push_classical_request({}); dt = _t.monotonic() - t0
        P.pop_classical_request(tok)
        assert 0.15 <= dt < 2.0, dt                   # 让路有上限
    finally:
        with P._PRIORITY_COND:
            P._PRIORITY_FG_WAITING[0] -= 1
        P._PRIORITY_YIELD_MAX_S = orig
        P.set_request_priority(None)


def test_priority_lane_unknown_header_is_foreground():
    from astrostudy import perchart as P
    P.set_request_priority('weird'); assert P.get_request_priority() == 'fg'
    P.set_request_priority(None); assert P.get_request_priority() == 'fg'
    P.set_request_priority('prefetch'); assert P.get_request_priority() == 'prefetch'
    P.set_request_priority(None)


def test_ephe_guard_is_the_process_wide_entry_and_direct_reset_is_recorded():
    """外部模块(如 cetian_ziwei)直调 swisseph.set_ephe_path("") 必须仍经守卫:全局猴补在位,
    且置空后守卫登记的是候选文件路径(不是 "")、随后 ensureEphePath 不会误判跳过。"""
    import swisseph
    from flatlib.ephem import swe as fswe
    assert swisseph.set_ephe_path is fswe._guardedSetEphePath
    before = fswe._EPHE_PATH_ACTIVE
    swisseph.set_ephe_path("")
    assert fswe._EPHE_PATH_ACTIVE not in (None, "")
    assert fswe._EPHE_PATH_ACTIVE == (fswe._candidateEphePath() or "")
    fswe.ensureEphePath()   # 无参:按守卫登记的当前路径判断是否需要重设;这里必须不抛


def test_fast_json_edge_shapes_fall_back_to_byte_identical_jsonpickle():
    """与 jsonpickle(unpicklable=False)字节不同的形状(bool 键 / numpy 标量 / dict·str 子类 /
    set·datetime·bytes)一律回退,出参逐字节同真 jsonpickle。"""
    import collections, datetime
    import jsonpickle
    from websrv import fastjson as F
    shim = F.install(jsonpickle)
    S = type('S', (str,), {})
    cases = [{True: 1, False: 0}, {'s': {1, 2}}, {'d': datetime.datetime(2026, 9, 24, 1, 2)}, {'b': b'ab'},
             {'o': collections.OrderedDict([('z', 1), ('a', 2)])}, {'s': S('x')}, {1: 'a', 2.5: 'b', None: 'c'},
             {'a': [1, 2.5, 'x', None, True], 'b': {'c': (1, 2)}, 'u': '星阙\u2028'},
             {float('nan'): 'n', float('inf'): 'i'}, {'k': {float('-inf'): 1}}]
    try:
        import numpy as np
        cases += [{'f': np.float64(1.5)}, {'i': np.int64(3)}, {'b': np.bool_(True)}]
    except Exception:
        pass
    for obj in cases:
        assert shim.encode(obj, unpicklable=False) == jsonpickle.encode(obj, unpicklable=False), obj
