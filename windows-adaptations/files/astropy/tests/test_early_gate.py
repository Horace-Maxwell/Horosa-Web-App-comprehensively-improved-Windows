# horosa_py_early_gate_v1(PERF-R13 P1)—— 两道启动门金标(与 test_warmup_parallel.py 同台架:stub 各段,直测调度骨架)。
#   开(HOROSA_PY_EARLY_GATE=1):STARTUP_GATE 在 PD + 首屏面核心装完即开、india/kentang 之前;KENTANG_GATE 在 kentang 之后。
#   关(缺省):两道门同刻、且都在全部段之后 —— 与旧单门逐字节同时序。
#   路由:kentang 挂载点选 KENTANG_GATE,其余选 STARTUP_GATE(按 KENTANG_SERVICE_SPECS 现读,不手写清单)。
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import websrv.webchartsrv as srv  # noqa: E402


def _reset():
    srv.STARTUP_GATE.clear()
    srv.KENTANG_GATE.clear()


def _run(monkeypatch, early, order):
    monkeypatch.setenv('HOROSA_PY_EARLY_GATE', '1' if early else '0')
    monkeypatch.setenv('HOROSA_PY_WARMUP_PARALLEL', '0')
    monkeypatch.setattr(srv, '_warm_real_astropy', lambda: order.append(('astropy', srv.STARTUP_GATE.is_set(), srv.KENTANG_GATE.is_set())))
    monkeypatch.setattr(srv, '_warmup_stage_pd', lambda: order.append(('pd', srv.STARTUP_GATE.is_set(), srv.KENTANG_GATE.is_set())))

    def core(only_keys=None, exclude_keys=None, label='core services', seg='py.warmup_core'):
        tag = 'core' if only_keys is None else 'core:' + ','.join(sorted(only_keys))
        order.append((tag, srv.STARTUP_GATE.is_set(), srv.KENTANG_GATE.is_set()))

    monkeypatch.setattr(srv, '_warmup_stage_core', core)
    monkeypatch.setattr(srv, '_warmup_stage_india', lambda: order.append(('india', srv.STARTUP_GATE.is_set(), srv.KENTANG_GATE.is_set())))
    monkeypatch.setattr(srv, '_warmup_stage_kentang', lambda: order.append(('kentang', srv.STARTUP_GATE.is_set(), srv.KENTANG_GATE.is_set())))
    # 门后段(postgate core / kentang modules / xuanshi)不在本金标范围:全部关掉,零后端依赖
    monkeypatch.setenv('HOROSA_ELECTIONSCAN_POSTGATE', '0')
    monkeypatch.setenv('HOROSA_KENTANG_MODULE_PREWARM', '0')
    monkeypatch.setenv('HOROSA_XUANSHI_WARMUP', '0')
    _reset()
    srv._run_warmups()


def test_early_gate_opens_after_first_screen_before_kentang(monkeypatch):
    order = []
    _run(monkeypatch, True, order)
    names = [o[0] for o in order]
    assert names[:3] == ['astropy', 'pd', 'core'], names
    assert 'core:cetian' in names and 'india' in names and 'kentang' in names
    # 首屏面装完前门必关;india/kentang 段跑的时候首屏门已开、kentang 门未开
    by = {o[0]: o for o in order}
    assert by['pd'][1] is False and by['core'][1] is False
    assert by['india'][1] is True and by['india'][2] is False
    assert by['kentang'][1] is True and by['kentang'][2] is False
    assert srv.STARTUP_GATE.is_set() and srv.KENTANG_GATE.is_set()


def test_early_gate_off_keeps_single_gate_timing(monkeypatch):
    order = []
    _run(monkeypatch, False, order)
    names = [o[0] for o in order]
    assert names == ['astropy', 'pd', 'core', 'india', 'kentang'], names
    assert all(o[1] is False and o[2] is False for o in order), order   # 全部段都在两道门之前
    assert srv.STARTUP_GATE.is_set() and srv.KENTANG_GATE.is_set()


def test_gate_routing_by_mount():
    assert '/taiyi' in srv._KENTANG_MOUNTS and '/qimen' in srv._KENTANG_MOUNTS
    assert '/predict' not in srv._KENTANG_MOUNTS and '' not in srv._KENTANG_MOUNTS
    for spec in srv.KENTANG_SERVICE_SPECS:
        assert spec['mount'] in srv._KENTANG_MOUNTS


def test_first_screen_exclude_is_cetian_only():
    assert srv.FIRST_SCREEN_CORE_EXCLUDE == frozenset({'cetian'})
    keys = {s['key'] for s in srv.CORE_SERVICE_SPECS}
    assert srv.FIRST_SCREEN_CORE_EXCLUDE <= keys
