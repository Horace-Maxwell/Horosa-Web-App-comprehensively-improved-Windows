# 分级门金标:核心门在卜类段之前开、全门语义不变;门工具对「卜类挂载点 / 其余业务请求 / 探活」三类请求的放行时序;
# 总开关回旧行为。段本体全部用桩(不真装模块,零后端依赖),直测调度骨架与门工具。
import os
import sys
import threading
import time
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import websrv.webchartsrv as srv  # noqa: E402


def _reset():
    srv.STARTUP_GATE.clear()
    srv.CORE_GATE.clear()
    srv._CORE_GATE_OPENED_AT[0] = None
    srv._GATE_FIRST_WAIT_LOGGED[0] = False


def _stub_stages(monkeypatch, core, india, kentang, parallel):
    monkeypatch.setenv('HOROSA_PY_WARMUP_PARALLEL', '1' if parallel else '0')
    monkeypatch.setattr(srv, '_warm_real_astropy', lambda: None)
    monkeypatch.setattr(srv, '_warmup_stage_pd', lambda: None)
    monkeypatch.setattr(srv, '_warmup_stage_core', core)
    monkeypatch.setattr(srv, '_warmup_stage_india', india)
    monkeypatch.setattr(srv, '_warmup_stage_kentang', kentang)


def _fake_request(monkeypatch, method='POST', script_name='', path_info='/'):
    req = types.SimpleNamespace(method=method, script_name=script_name, path_info=path_info)
    monkeypatch.setattr(srv, 'cherrypy', types.SimpleNamespace(request=req))
    return req


def _call_tool_timed():
    t0 = time.perf_counter()
    srv._startup_gate_tool()
    return time.perf_counter() - t0


def test_kentang_mount_table_covers_every_kentang_service():
    from websrv.kentang.registry import KENTANG_SERVICE_SPECS
    assert srv._KENTANG_MOUNTS == frozenset(s['mount'] for s in KENTANG_SERVICE_SPECS)
    assert '/qimen' in srv._KENTANG_MOUNTS and '/taiyi' in srv._KENTANG_MOUNTS
    # 核心服务挂载点一个都不能落进卜类表(否则主排盘族会被当成卜类请求挡到全门)
    assert not (srv._KENTANG_MOUNTS & set(s['mount'] for s in srv.CORE_SERVICE_SPECS))
    assert '' not in srv._KENTANG_MOUNTS and '/' not in srv._KENTANG_MOUNTS


def _core_opens_before_kentang_finishes(monkeypatch, parallel):
    seen = {}
    release = threading.Event()

    def core():
        assert not srv.CORE_GATE.is_set(), '核心门在核心段完成前被打开'

    def india():
        assert not srv.CORE_GATE.is_set(), '核心门在印度盘段完成前被打开'

    def kentang():
        # 卜类段进行中:核心门应在有限时间内打开,全门必须仍关
        seen['core_open_during_kentang'] = srv.CORE_GATE.wait(timeout=2.0)
        seen['full_open_during_kentang'] = srv.STARTUP_GATE.is_set()
        release.set()

    _stub_stages(monkeypatch, core, india, kentang, parallel)
    _reset()
    srv._run_warmups()
    assert release.is_set()
    assert seen['core_open_during_kentang'] is True
    assert seen['full_open_during_kentang'] is False
    assert srv.CORE_GATE.is_set() and srv.STARTUP_GATE.is_set()


def test_core_gate_opens_before_kentang_stage_serial(monkeypatch):
    _core_opens_before_kentang_finishes(monkeypatch, parallel=False)


def test_core_gate_opens_before_kentang_stage_parallel(monkeypatch):
    _core_opens_before_kentang_finishes(monkeypatch, parallel=True)


def test_core_gate_waits_for_slow_core_stage_in_parallel_mode(monkeypatch):
    # 并行档:卜类段先完、核心段后完 —— 核心门必须等核心段,全门等全部
    order = []

    def core():
        time.sleep(0.15)
        order.append(('core_done', srv.CORE_GATE.is_set()))

    def kentang():
        order.append(('kentang_done', srv.CORE_GATE.is_set(), srv.STARTUP_GATE.is_set()))

    _stub_stages(monkeypatch, core, lambda: None, kentang, parallel=True)
    _reset()
    srv._run_warmups()
    assert ('core_done', False) in order
    assert ('kentang_done', False, False) in order
    assert srv.CORE_GATE.is_set() and srv.STARTUP_GATE.is_set()


def test_tool_passes_everything_once_full_gate_is_open(monkeypatch):
    _reset()
    srv.STARTUP_GATE.set()
    for script_name in ('', '/predict', '/qimen'):
        _fake_request(monkeypatch, script_name=script_name)
        assert _call_tool_timed() < 0.05


def test_tool_lets_probes_through_before_any_gate(monkeypatch):
    _reset()
    for method in ('GET', 'OPTIONS', 'HEAD'):
        _fake_request(monkeypatch, method=method, script_name='/qimen')
        assert _call_tool_timed() < 0.05


def test_core_request_passes_after_grace_when_kentang_is_slow(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '200')
    _reset()
    marks = []
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: marks.append((seg, kw.get('extra'))))
    _fake_request(monkeypatch, script_name='', path_info='/')
    threading.Timer(0.10, srv._open_core_gate).start()
    waited = _call_tool_timed()
    # 核心门 0.10 s 开 + 宽限 0.20 s;全门始终没开
    assert 0.25 <= waited < 0.60, waited
    assert not srv.STARTUP_GATE.is_set()
    first_wait = [m for m in marks if m[0] == 'py.gate_first_wait']
    assert first_wait and first_wait[0][1]['via'] == 'core' and first_wait[0][1]['path'] == '/'


def test_core_request_follows_full_gate_when_kentang_finishes_within_grace(monkeypatch):
    # 平时的形态:卜类段紧跟着就完 —— 请求在全门打开的那一刻放行,与单门相同
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '1500')
    _reset()
    marks = []
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: marks.append((seg, kw.get('extra'))))
    _fake_request(monkeypatch, script_name='/predict', path_info='/pd')
    threading.Timer(0.05, srv._open_core_gate).start()
    threading.Timer(0.30, srv.STARTUP_GATE.set).start()
    waited = _call_tool_timed()
    assert 0.25 <= waited < 0.70, waited
    assert srv.STARTUP_GATE.is_set()
    first_wait = [m for m in marks if m[0] == 'py.gate_first_wait']
    assert first_wait and first_wait[0][1]['via'] == 'full'


def test_late_core_request_does_not_pay_the_grace_again(monkeypatch):
    # 宽限从核心门打开那一刻起算,不是每个请求各等一遍
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '150')
    _reset()
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: None)
    srv._open_core_gate()
    time.sleep(0.20)
    _fake_request(monkeypatch, script_name='')
    assert _call_tool_timed() < 0.05


def test_kentang_request_always_waits_for_full_gate(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '50')
    _reset()
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: None)
    srv._open_core_gate()
    _fake_request(monkeypatch, script_name='/qimen', path_info='/pan')
    threading.Timer(0.35, srv.STARTUP_GATE.set).start()
    waited = _call_tool_timed()
    assert 0.30 <= waited < 0.80, waited


def test_killswitch_restores_single_gate(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '0')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '50')
    _reset()
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: None)
    srv._open_core_gate()
    _fake_request(monkeypatch, script_name='', path_info='/')
    threading.Timer(0.35, srv.STARTUP_GATE.set).start()
    waited = _call_tool_timed()
    assert 0.30 <= waited < 0.80, waited


def test_grace_env_is_clamped_and_tolerates_garbage(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', 'abc')
    assert srv._core_gate_grace_seconds() == 1.5
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '-5')
    assert srv._core_gate_grace_seconds() == 0.0
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '999999999')
    assert srv._core_gate_grace_seconds() == 60.0
    monkeypatch.delenv('HOROSA_PY_CORE_GATE_GRACE_MS', raising=False)
    assert srv._core_gate_grace_seconds() == 1.5
