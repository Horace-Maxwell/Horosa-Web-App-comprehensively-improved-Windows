# -*- coding: utf-8 -*-
"""蠢子数诗词库按进程只建一次(HOROSA_CHUNZI_DB_MEMO)。

原 /chunzi/pan 每请求重读 4,574 条诗词 CSV 并整表建代码索引;现共享一个只读实例。
判据:覆盖该端点全部查询形态的请求序列,缓存开 / 关两档输出逐字节相同;缓存开时正序、倒序
各跑一遍也逐字节相同(请求之间无串染);缓存开时整段只建库一次。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import cherrypy  # noqa: E402

from websrv import webchunzisrv as CZ  # noqa: E402

BASE = {
    'year': 1990, 'month': 5, 'day': 18, 'hour': 10, 'minute': 0, 'second': 0,
    'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27',
    'gender': '1', 'after23NewDay': 1, 'lateZiHourUseNextDay': 1,
    'chunziKeMode': 'auto', 'chunziKe': '3', 'chunziLunarMode': 'auto', 'chunziLunarMonth': 4, 'chunziLunarDay': 24,
    'chunziLookupCode': '', 'chunziKeyword': '', 'chunziTags': '', 'chunziMansion': '', 'chunziHourBranch': '',
    'chunziResultLimit': '20',
}
VARIANTS = [
    {},
    {'chunziKeMode': 'manual', 'chunziKe': '7'},
    {'chunziKeMode': 'none'},
    {'chunziLunarMode': 'manual', 'chunziLunarMonth': 11, 'chunziLunarDay': 3},
    {'chunziLunarMode': 'none'},
    {'chunziLookupCode': '室巨9未'},
    {'chunziLookupCode': '室巨9未,角陰13酉,不存在的代码'},
    {'chunziKeyword': '父'},
    {'chunziTags': '父,母'},
    {'chunziMansion': '毕'},
    {'chunziHourBranch': '午'},
    {'gender': '0'},
    {'chunziResultLimit': '50', 'chunziKeyword': '子'},
    {'year': 2024, 'month': 2, 'day': 10, 'hour': 23, 'minute': 30, 'date': '2024-02-10', 'time': '23:30:00'},
]


def _service():
    for name in dir(CZ):
        obj = getattr(CZ, name)
        if isinstance(obj, type) and hasattr(obj, 'pan') and obj.__module__ == CZ.__name__:
            return obj()
    raise AssertionError('找不到 /chunzi 服务类')


def _run(svc, variants):
    outs = []
    for v in variants:
        payload = dict(BASE)
        payload.update(v)
        cherrypy.request.json = payload
        cherrypy.request.method = 'POST'
        cherrypy.request.headers = {}
        out = svc.pan()
        outs.append(out.decode('utf-8') if isinstance(out, bytes) else out)
    return outs


def test_memo_on_off_identical_and_no_cross_request_bleed(monkeypatch):
    svc = _service()
    builds = {'n': 0}
    real = CZ.ChunZiShu

    def counting():
        builds['n'] += 1
        return real()

    monkeypatch.setattr(CZ, 'ChunZiShu', counting)
    monkeypatch.setattr(CZ, '_CHUNZI_DB', [None])
    monkeypatch.setattr(CZ, '_CHUNZI_DB_MEMO_ON', True)
    on = _run(svc, VARIANTS)
    on_rev = list(reversed(_run(svc, list(reversed(VARIANTS)))))
    assert builds['n'] == 1                           # 整段只建库一次
    monkeypatch.setattr(CZ, '_CHUNZI_DB_MEMO_ON', False)
    off = _run(svc, VARIANTS)
    assert builds['n'] == 1 + len(VARIANTS)           # 关:每请求新建(旧行为)
    for v, a, b, c in zip(VARIANTS, on, on_rev, off):
        assert a == c, v
        assert a == b, v
        assert '"err"' not in a[:60], v
