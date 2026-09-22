"""[挂载自检 F-57] 太乙博弈分析:随包运行时缺 scipy 时走纯 numpy 两阶段单纯形,须与 scipy highs 同解。
判别向量:200 张随机 4×4 零和支付矩阵 + 模块内真实支付矩阵,主/客两个 LP 的目标值与可行性逐一对拍;
再把 _scipy_linprog 置 None 跑 TaiyiGame 全流程,均衡值与 scipy 路径一致(≤1e-7)。"""
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kintaiyi", "src"))

from kintaiyi import game_theory as gt  # noqa: E402

scipy_linprog = pytest.importorskip("scipy.optimize").linprog


def _lps(A):
    m, n = A.shape
    c1 = np.zeros(m + 1); c1[-1] = -1.0
    A1 = np.zeros((n, m + 1))
    for j in range(n):
        A1[j, :m] = -A[:, j]; A1[j, m] = 1.0
    E1 = np.zeros((1, m + 1)); E1[0, :m] = 1.0
    c2 = np.zeros(n + 1); c2[-1] = 1.0
    A2 = np.zeros((m, n + 1))
    for i in range(m):
        A2[i, :n] = A[i, :]; A2[i, n] = -1.0
    E2 = np.zeros((1, n + 1)); E2[0, :n] = 1.0
    return [(c1, A1, np.zeros(n), E1, np.array([1.0]), [(0.0, None)] * m + [(None, None)]),
            (c2, A2, np.zeros(m), E2, np.array([1.0]), [(0.0, None)] * n + [(None, None)])]


@pytest.mark.parametrize("seed", range(4))
def test_fallback_matches_scipy_on_random_games(seed):
    rng = np.random.default_rng(seed)
    for _ in range(50):
        A = rng.uniform(-5, 5, (4, 4))
        for (c, A_ub, b_ub, A_eq, b_eq, bounds) in _lps(A):
            r1 = scipy_linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method="highs")
            r2 = gt._linprog_fallback(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds)
            assert r1.success and r2.success
            assert abs(r1.fun - r2.fun) < 1e-7
            assert np.all(A_ub @ r2.x - b_ub <= 1e-7)
            # horosa_numpy2_scalar_assert_v1(Windows 侧移植适配;建议上游化 Mac):A_eq @ r2.x 是 shape (1,) 的一维数组,
            # `float()` 只接受 0 维 —— NumPy 1.25 起 DeprecationWarning、NumPy 2.x 直接 TypeError(内嵌运行时 numpy 2.4.2 实撞,
            # 4 个参数化用例全红)。取 [0] 后两代 numpy 同义;被测的 fallback 产品码本身与 numpy 2 相容(全流程用例通过)。
            assert abs(float((A_eq @ r2.x)[0]) - 1.0) < 1e-9
            assert np.all(r2.x[:-1] >= -1e-9)


def test_taiyi_game_without_scipy_equals_scipy_path(monkeypatch):
    from kintaiyi.kintaiyi import Taiyi
    ty = Taiyi(2026, 5, 15, 10, 12)
    with_scipy = gt.TaiyiGame(ty.pan(3, 0, False))._求Nash均衡()
    monkeypatch.setattr(gt, "_scipy_linprog", None)
    without = gt.TaiyiGame(ty.pan(3, 0, False))._求Nash均衡()
    assert abs(with_scipy[0] - without[0]) < 1e-7
    assert np.allclose(with_scipy[1].sum(), 1.0) and np.allclose(without[1].sum(), 1.0)
    assert np.allclose(without[2].sum(), 1.0)
