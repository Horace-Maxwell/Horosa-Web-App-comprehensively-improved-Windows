# -*- coding: utf-8 -*-
"""请求内黄经 memo(astroextra.swe_lon,HOROSA_SWE_LON_MEMO)。

同一请求里同 (天体, jd, 中心, 站心坐标) 只算一次;结果只取决于这四项 → 与每次现算逐字节相同。
范围 = 一次请求:webchartsrv 的请求工具按服务前缀开启、请求结束清空;进程内直调默认不开。
判据:星历表 / 返照端点开关两档输出逐字节相同且确实少算;站心分支命中时照旧置点;置点失败那次不进 memo;
memo 只活在作用域内;请求工具与前缀在位。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import cherrypy  # noqa: E402
import swisseph  # noqa: E402

from astrostudy import astroextra as AX  # noqa: E402
from websrv import webchartsrv as W  # noqa: E402
from websrv.kentang.registry import _load_service  # noqa: E402

_SVC = _load_service([s for s in W.CORE_SERVICE_SPECS if s['mount'] == '/astroextra'][0])

SEED = {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'ad': 1,
        'hsys': 1, 'tradition': False, 'predictive': False, 'zodiacal': 'Tropical', 'siderealAyanamsa': ''}
CASES = [
    ('ephemeris', dict(SEED, startDate='2026-09-01', endDate='2026-10-15', includeTransits=True)),
    ('ephemeris', dict(SEED, startDate='2026-09-01', endDate='2026-10-15', includeTransits=False)),
    ('ephemeris', dict(SEED, startDate='1999-12-20', endDate='2000-01-20', includeTransits=True)),
    ('returns', dict(SEED)),
    ('progressions', dict(SEED)),
]


def _call(method, payload):
    cherrypy.request.json = dict(payload)
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = getattr(_SVC, method)()
    return out.decode('utf-8') if isinstance(out, bytes) else out


def test_outputs_identical_memo_on_off_and_fewer_ephemeris_calls(monkeypatch):
    real = swisseph.calc_ut
    counts = {'n': 0}

    def counting(*a, **kw):
        counts['n'] += 1
        return real(*a, **kw)

    monkeypatch.setattr(swisseph, 'calc_ut', counting)
    off, n_off = [], 0
    for method, p in CASES:
        off.append(_call(method, p))
    n_off = counts['n']
    counts['n'] = 0
    on = []
    for method, p in CASES:
        with AX.swe_lon_memo():
            on.append(_call(method, p))
    n_on = counts['n']
    for (method, p), a, b in zip(CASES, off, on):
        assert a == b, (method, p.get('startDate'))
        assert '"err"' not in a[:40], method
    assert n_on < n_off            # 真去掉了同请求重复计算


def test_topo_branch_still_sets_position_and_failed_set_is_not_memoized(monkeypatch):
    calls = []
    real_set = swisseph.set_topo

    def recording_set(lon, lat, alt):
        calls.append((lon, lat, alt))
        return real_set(lon, lat, alt)

    monkeypatch.setattr(swisseph, 'set_topo', recording_set)
    jd = 2461000.5
    with AX.swe_lon_memo():
        a = AX.swe_lon('Mars', jd, 'topo', 31.6, 118.4, 10.0)
        b = AX.swe_lon('Mars', jd, 'topo', 31.6, 118.4, 10.0)   # 命中 memo
        assert a is b
        assert len(calls) == 2                                   # 命中时照旧置点(全局站心状态与原来一致)
        c = AX.swe_lon('Mars', jd, 'topo', 'bad', 118.4, 10.0)  # 置点失败(float 抛错被吞)
        d = AX.swe_lon('Mars', jd, 'topo', 'bad', 118.4, 10.0)
        assert c is not d                                        # 失败那次不进 memo
    plain = AX.swe_lon('Mars', jd, 'topo', 31.6, 118.4, 10.0)
    assert plain == a


def test_memo_lives_only_inside_scope():
    assert getattr(AX._SWE_LON_TL, 'memo', None) is None
    with AX.swe_lon_memo():
        assert AX._SWE_LON_TL.memo is not None or not AX._SWE_LON_MEMO_ON
        with AX.swe_lon_memo():                 # 嵌套沿用外层
            pass
        assert AX._SWE_LON_TL.memo is not None or not AX._SWE_LON_MEMO_ON
    assert AX._SWE_LON_TL.memo is None
    x = AX.swe_lon('Sun', 2461000.5)
    y = AX.swe_lon('Sun', 2461000.5)
    assert x is not y and x == y                # 作用域外不 memo


def test_request_tool_registered_for_service_prefix():
    assert '/astroextra/' in W._SWE_LON_MEMO_PREFIXES
    src = open(W.__file__, encoding='utf-8').read()
    assert "cherrypy.tools.swe_lon_memo = cherrypy.Tool('before_handler', _swe_lon_memo_tool" in src
    assert "req.hooks.attach('on_end_request', ax.swe_lon_memo_end)" in src


def test_memo_key_separates_center_and_topo_position():
    jd = 2461000.5
    plain = {
        'geo': AX.swe_lon('Mars', jd, 'geo'),
        'helio': AX.swe_lon('Mars', jd, 'helio'),
        'topoA': AX.swe_lon('Moon', jd, 'topo', 31.6, 118.4, 0.0),
        'topoB': AX.swe_lon('Moon', jd, 'topo', -33.9, 151.2, 0.0),
    }
    with AX.swe_lon_memo():
        memo = {
            'geo': AX.swe_lon('Mars', jd, 'geo'),
            'helio': AX.swe_lon('Mars', jd, 'helio'),
            'topoA': AX.swe_lon('Moon', jd, 'topo', 31.6, 118.4, 0.0),
            'topoB': AX.swe_lon('Moon', jd, 'topo', -33.9, 151.2, 0.0),
        }
    assert memo == plain
    assert memo['geo'][0] != memo['helio'][0]
    assert memo['topoA'][0] != memo['topoB'][0]
