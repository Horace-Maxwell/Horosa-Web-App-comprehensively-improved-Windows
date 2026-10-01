# horosa_py_early_gate_v1(PERF-R13 P1;v3.11.3 起与上游分级门 test_startup_gate_tiers.py 并存)—— 首屏门金标
# (与 test_warmup_parallel.py 同台架:stub 各段,直测调度骨架与门工具)。
#   三道门:EARLY_GATE(首屏门,Windows-ahead)· CORE_GATE(上游核心门 + 宽限)· STARTUP_GATE(全门,语义恒为旧单门)。
#   开(HOROSA_PY_EARLY_GATE=1):EARLY_GATE 在 PD + 首屏面核心装完即开、india/kentang 之前;CORE_GATE 在卜类段之前开
#      (上游不变量);STARTUP_GATE 在全部段之后。非卜类请求首屏门开即放行、不经核心门宽限;卜类挂载点恒等全门。
#   关(缺省):EARLY_GATE 与 STARTUP_GATE 同刻、都在全部段之后 —— 请求时序退回上游分级门(上游金标原样)。
#   路由:kentang 挂载点按 KENTANG_SERVICE_SPECS 现读,不手写清单。
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
    srv.EARLY_GATE.clear()
    srv._CORE_GATE_OPENED_AT[0] = None
    srv._GATE_FIRST_WAIT_LOGGED[0] = False


def _snap():
    return (srv.EARLY_GATE.is_set(), srv.CORE_GATE.is_set(), srv.STARTUP_GATE.is_set())


def _run(monkeypatch, early, order):
    monkeypatch.setenv('HOROSA_PY_EARLY_GATE', '1' if early else '0')
    monkeypatch.setenv('HOROSA_PY_WARMUP_PARALLEL', '0')
    monkeypatch.setattr(srv, '_warm_real_astropy', lambda: order.append(('astropy',) + _snap()))
    monkeypatch.setattr(srv, '_warmup_stage_pd', lambda: order.append(('pd',) + _snap()))

    def core(only_keys=None, exclude_keys=None, label='core services', seg='py.warmup_core'):
        tag = 'core' if only_keys is None else 'core:' + ','.join(sorted(only_keys))
        order.append((tag,) + _snap())

    monkeypatch.setattr(srv, '_warmup_stage_core', core)
    monkeypatch.setattr(srv, '_warmup_stage_india', lambda: order.append(('india',) + _snap()))
    monkeypatch.setattr(srv, '_warmup_stage_kentang', lambda: order.append(('kentang',) + _snap()))
    # 门后段(postgate core / kentang modules / xuanshi)不在本金标范围:全部关掉,零后端依赖
    monkeypatch.setenv('HOROSA_ELECTIONSCAN_POSTGATE', '0')
    monkeypatch.setenv('HOROSA_KENTANG_MODULE_PREWARM', '0')
    monkeypatch.setenv('HOROSA_XUANSHI_WARMUP', '0')
    _reset()
    srv._run_warmups()


def _fake_request(monkeypatch, method='POST', script_name='', path_info='/'):
    req = types.SimpleNamespace(method=method, script_name=script_name, path_info=path_info)
    monkeypatch.setattr(srv, 'cherrypy', types.SimpleNamespace(request=req))
    return req


def _call_tool_timed():
    t0 = time.perf_counter()
    srv._startup_gate_tool()
    return time.perf_counter() - t0


def test_early_gate_opens_after_first_screen_before_kentang(monkeypatch):
    order = []
    _run(monkeypatch, True, order)
    names = [o[0] for o in order]
    assert names[:3] == ['astropy', 'pd', 'core'], names
    assert 'core:cetian' in names and 'india' in names and 'kentang' in names
    by = {o[0]: o for o in order}
    # 首屏面装完前三道门全关;首屏面装完后(cetian/india/kentang 段跑的时候)首屏门已开、全门未开
    assert by['pd'][1:] == (False, False, False) and by['core'][1:] == (False, False, False)
    assert by['core:cetian'][1] is True and by['india'][1] is True and by['kentang'][1] is True
    assert by['india'][3] is False and by['kentang'][3] is False
    # 上游不变量:核心门在卜类段之前开、在 cetian/india 段之前不开
    assert by['core:cetian'][2] is False and by['india'][2] is False and by['kentang'][2] is True
    assert _snap() == (True, True, True)


def test_early_gate_off_keeps_upstream_gate_timing(monkeypatch):
    order = []
    _run(monkeypatch, False, order)
    names = [o[0] for o in order]
    assert names == ['astropy', 'pd', 'core', 'india', 'kentang'], names
    # 缺省态:首屏门与全门都在全部段之后;核心门只在卜类段之前开(上游 test_startup_gate_tiers 同款不变量)
    assert all(o[1] is False and o[3] is False for o in order), order
    assert [o[2] for o in order] == [False, False, False, False, True], order
    assert _snap() == (True, True, True)


def test_tool_lets_core_request_through_on_early_gate_without_grace(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_EARLY_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '1500')
    _reset()
    marks = []
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: marks.append((seg, kw.get('extra'))))
    _fake_request(monkeypatch, script_name='', path_info='/')
    threading.Timer(0.10, srv.EARLY_GATE.set).start()
    waited = _call_tool_timed()
    # 首屏门 0.10s 开即放行 —— 不等核心门、不吃 1.5s 宽限;全门与核心门始终没开
    assert 0.08 <= waited < 0.40, waited
    assert not srv.STARTUP_GATE.is_set() and not srv.CORE_GATE.is_set()
    first_wait = [m for m in marks if m[0] == 'py.gate_first_wait']
    assert first_wait and first_wait[0][1]['via'] == 'early'
    # 首屏门已开:后续非卜类请求零等待
    _fake_request(monkeypatch, script_name='/predict', path_info='/pd')
    assert _call_tool_timed() < 0.05


def test_tool_kentang_request_ignores_early_gate_and_waits_full(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_EARLY_GATE', '1')
    _reset()
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: None)
    srv.EARLY_GATE.set()
    srv._open_core_gate()
    _fake_request(monkeypatch, script_name='/qimen', path_info='/pan')
    threading.Timer(0.30, srv.STARTUP_GATE.set).start()
    waited = _call_tool_timed()
    assert 0.25 <= waited < 0.80, waited   # 卜类挂载点恒等全门(顺序免疫层)


def test_tool_early_gate_off_falls_back_to_upstream_tiered_gate(monkeypatch):
    monkeypatch.setenv('HOROSA_PY_EARLY_GATE', '0')
    monkeypatch.setenv('HOROSA_PY_TIERED_GATE', '1')
    monkeypatch.setenv('HOROSA_PY_CORE_GATE_GRACE_MS', '200')
    _reset()
    marks = []
    monkeypatch.setattr(srv, 'ledger_mark', lambda seg, **kw: marks.append((seg, kw.get('extra'))))
    srv.EARLY_GATE.set()   # 关着时首屏门状态不参与放行判定
    _fake_request(monkeypatch, script_name='', path_info='/')
    threading.Timer(0.10, srv._open_core_gate).start()
    waited = _call_tool_timed()
    assert 0.25 <= waited < 0.60, waited   # 核心门 0.10s + 宽限 0.20s = 上游分级门时序
    first_wait = [m for m in marks if m[0] == 'py.gate_first_wait']
    assert first_wait and first_wait[0][1]['via'] == 'core'


def test_gate_routing_by_mount():
    assert '/taiyi' in srv._KENTANG_MOUNTS and '/qimen' in srv._KENTANG_MOUNTS
    assert '/predict' not in srv._KENTANG_MOUNTS and '' not in srv._KENTANG_MOUNTS
    for spec in srv.KENTANG_SERVICE_SPECS:
        assert spec['mount'] in srv._KENTANG_MOUNTS


def test_first_screen_exclude_is_cetian_only():
    assert srv.FIRST_SCREEN_CORE_EXCLUDE == frozenset({'cetian'})
    keys = {s['key'] for s in srv.CORE_SERVICE_SPECS}
    assert srv.FIRST_SCREEN_CORE_EXCLUDE <= keys
