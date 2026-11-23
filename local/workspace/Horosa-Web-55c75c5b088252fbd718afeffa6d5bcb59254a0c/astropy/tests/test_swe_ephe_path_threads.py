# -*- coding: utf-8 -*-
"""星历路径的「设过就不重设」短路,必须按线程认。

星历库把「星历路径」这份状态存在哪,各平台不一样:macOS 上整个进程一份,Linux 上每个线程各一份。
短路只记进程级状态时,Linux 上排盘服务的工作线程从没设过路径却被当成设好了 —— 用的是库的缺省路径,
小行星星历文件找不到(凯龙等整颗算不出来,整盘失败),行星悄悄退回库内置的近似星历。
这里锁:新线程头一回必须真设一次;同一线程之后照旧短路;别的线程改过路径 / 关过文件后各线程都会重设;
Linux 上另把路径导出成进程内的环境变量,不经这一层、直接调星历库的代码在新线程里也找得到文件。
"""
import os
import sys
import threading

import pytest
import swisseph

from flatlib.ephem import swe


@pytest.fixture
def spy(monkeypatch):
    """记下每一次「真正调到库里」的设路径:(线程名, 路径)。"""
    calls = []
    real = swe._SET_EPHE_PATH

    def counting(path):
        calls.append((threading.current_thread().name, path))
        return real(path)

    monkeypatch.setattr(swe, '_SET_EPHE_PATH', counting)
    swe.ensureEphePath()        # 主线程先处在「已设好」的状态
    calls.clear()
    yield calls
    swe.ensureEphePath()


def _in_thread(name, fn):
    box = {}

    def run():
        try:
            box['value'] = fn()
        except Exception as exc:  # noqa: BLE001  测试里要把线程里的异常带回主线程
            box['error'] = exc

    t = threading.Thread(target=run, name=name)
    t.start()
    t.join()
    if 'error' in box:
        raise box['error']
    return box.get('value')


def test_fast_path_is_on_and_main_thread_does_not_reset(spy):
    assert swe._EPHE_FASTPATH is True
    for _ in range(50):
        swe.ensureEphePath()
    assert spy == []            # 主线程里路径没人动过:一次都不重设(提速的那一半没丢)


def test_a_new_thread_sets_the_path_once_then_short_circuits(spy):
    def work():
        for _ in range(50):
            swe.ensureEphePath()

    _in_thread('worker-a', work)
    assert spy == [('worker-a', swe.SEACTIVE_PATH)]     # 头一回真设,之后短路
    spy.clear()
    _in_thread('worker-b', work)
    assert spy == [('worker-b', swe.SEACTIVE_PATH)]     # 每个新线程各设一次
    spy.clear()
    swe.ensureEphePath()
    assert spy == []                                    # 主线程不受影响


def test_another_thread_changing_the_path_makes_everyone_reset(spy, tmp_path):
    other = str(tmp_path)
    _in_thread('changer', lambda: swisseph.set_ephe_path(other))    # 经守卫:进程级记录变成别的路径
    assert spy == [('changer', other)]
    spy.clear()
    swe.ensureEphePath()                                            # 主线程:进程级记录对不上 → 重设
    assert spy == [(threading.current_thread().name, swe.SEACTIVE_PATH)]
    spy.clear()
    swe.ensureEphePath()
    assert spy == []


def test_empty_path_from_vendor_code_keeps_the_packaged_path(spy):
    """内置第三方引擎到处写 set_ephe_path(""):守卫把它换成打包的星历目录,并记在调用它的那个线程名下。"""
    _in_thread('vendor', lambda: swisseph.set_ephe_path(''))
    assert spy == [('vendor', swe.SEACTIVE_PATH)]


def test_closing_ephemeris_files_invalidates_the_record(spy):
    swe.closeEphemerisFiles()
    swe.ensureEphePath()
    assert spy == [(threading.current_thread().name, swe.SEACTIVE_PATH)]


def test_chiron_computes_in_a_fresh_thread_through_the_chart_library():
    """经本模块取星:任何平台的新线程里都要算得出小行星(Linux 上靠线程级记录,macOS 上本来就行)。"""
    jd = swisseph.julday(1990, 1, 1, 4.0)
    main = swe.sweObject('Chiron', jd)['lon']
    assert _in_thread('fresh', lambda: swe.sweObject('Chiron', jd)['lon']) == main


def test_linux_exports_the_path_for_code_that_calls_the_library_directly(monkeypatch):
    if os.environ.get('SE_EPHE_PATH'):
        pytest.skip('外部已设 SE_EPHE_PATH(Linux 上本模块导入时就会设):这条只在没设过的进程里验导出逻辑')
    try:
        monkeypatch.setattr(sys, 'platform', 'darwin')
        swe._exportEphePathForNewThreads('/some/ephe')
        assert 'SE_EPHE_PATH' not in os.environ                 # macOS:那份状态是进程级的,不导出
        monkeypatch.setattr(sys, 'platform', 'linux')
        swe._exportEphePathForNewThreads('')
        assert 'SE_EPHE_PATH' not in os.environ                 # 没有路径可导
        swe._exportEphePathForNewThreads('/some/ephe')
        assert os.environ['SE_EPHE_PATH'] == '/some/ephe'
        swe._exportEphePathForNewThreads('/another')
        assert os.environ['SE_EPHE_PATH'] == '/some/ephe'       # 外部(或先前)已经设好的不覆盖
    finally:
        # 这个环境变量在库里优先于传入的路径:留在进程里会让后面所有测试去一个不存在的目录找星历文件
        os.environ.pop('SE_EPHE_PATH', None)


@pytest.mark.skipif(not sys.platform.startswith('linux'), reason='库的状态每线程一份只在 Linux 上成立')
def test_on_linux_a_fresh_thread_calling_the_library_directly_finds_the_files():
    """不经本模块、直接调星历库:新线程里也要找得到小行星星历文件(靠进程内导出的环境变量)。"""
    assert os.environ.get('SE_EPHE_PATH')
    jd = swisseph.julday(1990, 1, 1, 4.0)
    main = swisseph.calc_ut(jd, swisseph.CHIRON, swisseph.FLG_SWIEPH)[0][0]
    assert _in_thread('direct', lambda: swisseph.calc_ut(jd, swisseph.CHIRON, swisseph.FLG_SWIEPH)[0][0]) == main
