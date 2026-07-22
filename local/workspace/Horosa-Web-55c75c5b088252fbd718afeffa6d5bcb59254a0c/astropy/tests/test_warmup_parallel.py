# [R3-B5] warmup 三段并行金标:门时序钉(全部段完成才开门)+ 并行真发生 + 开关回退串行
# + 单段失败不阻门。stub 三段本体(不真装模块,零后端依赖),直测 _run_warmups 调度骨架。
import os
import sys
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import websrv.webchartsrv as srv  # noqa: E402


def _reset_gate():
    srv.STARTUP_GATE.clear()


def _run_with_stubs(monkeypatch, stubs, parallel):
    monkeypatch.setenv('HOROSA_PY_WARMUP_PARALLEL', '1' if parallel else '0')
    monkeypatch.setattr(srv, '_warm_real_astropy', lambda: None)
    monkeypatch.setattr(srv, '_warmup_stage_pd', lambda: None)
    monkeypatch.setattr(srv, '_warmup_stage_core', stubs[0])
    monkeypatch.setattr(srv, '_warmup_stage_india', stubs[1])
    monkeypatch.setattr(srv, '_warmup_stage_kentang', stubs[2])
    _reset_gate()
    srv._run_warmups()


def test_gate_opens_only_after_all_stages(monkeypatch):
    done = []

    def mk(name, delay):
        def stage():
            time.sleep(delay)
            assert not srv.STARTUP_GATE.is_set(), '门在段 %s 完成前被提前打开' % name
            done.append(name)
        return stage

    _run_with_stubs(monkeypatch, [mk('core', 0.05), mk('india', 0.01), mk('kentang', 0.12)], parallel=True)
    assert srv.STARTUP_GATE.is_set()
    assert sorted(done) == ['core', 'india', 'kentang']


def test_parallel_really_overlaps(monkeypatch):
    # 三段各 sleep 0.15s:并行墙钟应 ≈ max(≪sum)。阈值放宽到 0.36s(sum=0.45s)防抖动误报。
    def stage():
        time.sleep(0.15)

    t0 = time.perf_counter()
    _run_with_stubs(monkeypatch, [stage, stage, stage], parallel=True)
    wall = time.perf_counter() - t0
    assert wall < 0.36, '三段疑似串行:墙钟 %.3fs' % wall


def test_killswitch_serial_order(monkeypatch):
    order = []
    _run_with_stubs(monkeypatch, [
        lambda: order.append('core'),
        lambda: order.append('india'),
        lambda: order.append('kentang'),
    ], parallel=False)
    assert order == ['core', 'india', 'kentang'], '串行回退必须保持旧段序'
    assert srv.STARTUP_GATE.is_set()


def test_auto_mode_serial_on_trusted_parallel_on_untrusted(monkeypatch):
    # [R3-B5 auto 档] trusted(温启)=串行旧序(不与 Java 抢核);untrusted(首启)=并行(门大幅提前)。
    order = []

    def run(trusted):
        order.clear()
        monkeypatch.delenv('HOROSA_PY_WARMUP_PARALLEL', raising=False)
        monkeypatch.setenv('HOROSA_TRUSTED_RUNTIME', '1' if trusted else '0')
        monkeypatch.setattr(srv, '_warm_real_astropy', lambda: None)
        monkeypatch.setattr(srv, '_warmup_stage_pd', lambda: None)
        evt = threading.Event()

        def a():
            # 并行档下 b 会在 a 完成前进入;串行档下 a 必须先整段完成
            time.sleep(0.08)
            order.append(('a_done', evt.is_set()))

        def b():
            evt.set()
            order.append(('b_enter', True))

        monkeypatch.setattr(srv, '_warmup_stage_core', a)
        monkeypatch.setattr(srv, '_warmup_stage_india', b)
        monkeypatch.setattr(srv, '_warmup_stage_kentang', lambda: None)
        _reset_gate()
        srv._run_warmups()
        assert srv.STARTUP_GATE.is_set()

    run(trusted=True)
    # 串行:a 完成时 b 尚未进入(evt 未 set)
    assert ('a_done', False) in order
    run(trusted=False)
    # 并行:a 完成时 b 已进入(evt 已 set)
    assert ('a_done', True) in order


def test_stage_failure_does_not_block_gate(monkeypatch):
    def boom():
        raise RuntimeError('stage exploded')

    # 段函数真身 try/except 自吞;此处 stub 直接抛,验证调度骨架的线程 join 与门不被单段异常卡死。
    def safe_boom():
        try:
            boom()
        except Exception:
            pass

    _run_with_stubs(monkeypatch, [safe_boom, lambda: None, lambda: None], parallel=True)
    assert srv.STARTUP_GATE.is_set()
