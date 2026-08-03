# -*- coding: utf-8 -*-
"""swisseph 并发安全钉。

swisseph 的 sid_mode 是 C 库进程级全局态。本仓的安全性依赖两层(均为隐式约定,故用本测试钉死):
  1) flatlib.ephem.swe 的 threading.local sidereal context + 每次调用前 applySiderealMode();
  2) 裸调用点(perchart._moira_ayanamsha / perpredict._coreTrueNodeBaseLons)的
     set_sid_mode→使用 必须是相邻直线代码 —— CPython 的 eval-breaker 只在循环回跳/
     函数入口检查,直线相邻的两个 C 调用之间不会被线程抢占。
若未来 CPython 调度语义变化、或有人在 set 与 use 之间插入任何 Python 语句(日志/取参),
本测试的双线程污染探针会变红。
"""
import threading

import swisseph

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


JD = 2462142.897916667  # 2028-04-06 ~09:33 UT
N = 1500


def test_sid_mode_set_use_adjacent_not_preempted():
    """双线程各自「set_sid_mode→get_ayanamsa_ut 相邻直线」互抢:零污染才算过。"""
    base_jd = swisseph.julday(1300, 1, 1, 0.0)
    bad = {'moira': 0, 'lahiri': 0}

    def moira_loop():
        for _ in range(N):
            swisseph.set_sid_mode(swisseph.SIDM_USER, base_jd, 4.0)
            v = swisseph.get_ayanamsa_ut(JD)
            if not (10.0 < v < 18.0):  # SIDM_USER(1300,4.0) ≈ 14.1°;LAHIRI ≈ 24.2°
                bad['moira'] += 1

    def lahiri_loop():
        for _ in range(N):
            swisseph.set_sid_mode(swisseph.SIDM_LAHIRI)
            v = swisseph.get_ayanamsa_ut(JD)
            if not (22.0 < v < 26.0):
                bad['lahiri'] += 1

    threads = [threading.Thread(target=moira_loop), threading.Thread(target=lahiri_loop)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert bad == {'moira': 0, 'lahiri': 0}, '跨线程 sid_mode 污染: %r' % bad


def test_flatlib_sidereal_context_is_thread_local():
    """flatlib 的 sidereal context 必须线程隔离:A 线程设印度制,不得影响 B 线程默认值。"""
    from flatlib.ephem import swe as fswe

    results = {}

    def thread_a():
        fswe.setSiderealContext(fswe.SE_SIDM_KRISHNAMURTI)
        results['a_mode'] = getattr(fswe._SIDEREAL_CONTEXT, 'mode', None)

    def thread_b():
        results['b_mode'] = getattr(fswe._SIDEREAL_CONTEXT, 'mode', None)

    ta = threading.Thread(target=thread_a)
    ta.start()
    ta.join()
    tb = threading.Thread(target=thread_b)
    tb.start()
    tb.join()
    assert results['a_mode'] == fswe.SE_SIDM_KRISHNAMURTI
    assert results.get('b_mode') is None, 'sidereal context 泄漏到了其他线程'


def test_bare_sid_mode_call_sites_whitelist():
    """裸 set_sid_mode 调用点白名单:新增裸调用必须评审(set/use 相邻约定)后才准入。"""
    import re
    root = os.path.join(os.path.dirname(__file__), '..')
    hits = set()
    for dirpath, dirnames, filenames in os.walk(os.path.join(root, 'astrostudy')):
        dirnames[:] = [d for d in dirnames if d != '__pycache__']
        for fn in filenames:
            if not fn.endswith('.py'):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, encoding='utf-8') as f:
                for i, line in enumerate(f, 1):
                    if re.search(r'\bset_sid_mode\s*\(', line) and not line.strip().startswith('#'):
                        rel = os.path.relpath(path, root)
                        hits.add(rel)
    expected = {
        os.path.join('astrostudy', 'perchart.py'),
        os.path.join('astrostudy', 'perpredict.py'),
        # acg/ACGraph.py:__init__ ayanamsa 恒星读数 — set_sid_mode→get_ayanamsa_ut 相邻两行(已评审符合 set/use 相邻约定;
        # 只取 ayanamsa 度数作标注,flatlib 主盘走 tropical 不受该全局态影响)。
        os.path.join('astrostudy', 'acg', 'ACGraph.py'),
        # acg/validate_acg.py:check_sidereal — 校验脚本内 set→get 相邻(单进程顺序执行,已评审)。
        os.path.join('astrostudy', 'acg', 'validate_acg.py'),
        # election_scan.py:_sidereal_offset — set_sid_mode→get_ayanamsa_ut 相邻两行(择日征象搜索
        # 恒星制只在星座/绝对黄经判定处减 ayanamsa,内部计算全走回归框架;已评审符合 set/use 相邻约定)。
        os.path.join('astrostudy', 'election_scan.py'),
    }
    # financial.py:_ayanamsa_deg — set_sid_mode→get_ayanamsa_ut 相邻两行(金融黄道制特性,已评审)。
    # 按「文件存在才计入」自适应:该文件不属于所有构建面,单一测试源在不同构建面都成立。
    fin = os.path.join('astrostudy', 'financial.py')
    if os.path.exists(os.path.join(root, fin)):
        expected.add(fin)
    assert hits == expected, '裸 set_sid_mode 调用点集合漂移(新增点须过 set/use 相邻评审): %r' % sorted(hits)
