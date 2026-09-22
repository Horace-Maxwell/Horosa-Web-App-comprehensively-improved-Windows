"""[挂载自检 F-57] 太乙「博弈分析」缺 scipy 时优雅降级:退回无博弈盘 + 回传缺失模块名;依赖齐全时行为不变。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "websrv"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import webtaiyisrv  # noqa: E402


class _FakeTy:
    def __init__(self, raise_on_gt=True):
        self.raise_on_gt = raise_on_gt
        self.calls = []

    def pan(self, style, tn, gt):
        self.calls.append((style, tn, gt))
        if gt and self.raise_on_gt:
            raise ModuleNotFoundError("No module named 'scipy'", name="scipy")
        return {"style": style, "gt": gt}


def test_missing_scipy_degrades_to_plain_pan_and_reports_module():
    ty = _FakeTy(raise_on_gt=True)
    raw, missing = webtaiyisrv._pan_with_game_theory(ty, 3, 0, True)
    assert raw == {"style": 3, "gt": False}
    assert missing == "scipy"
    assert ty.calls == [(3, 0, True), (3, 0, False)]


def test_game_theory_available_keeps_result_and_no_flag():
    ty = _FakeTy(raise_on_gt=False)
    raw, missing = webtaiyisrv._pan_with_game_theory(ty, 3, 0, True)
    assert raw == {"style": 3, "gt": True}
    assert missing is None
    assert ty.calls == [(3, 0, True)]


def test_disabled_game_theory_never_touches_import():
    ty = _FakeTy(raise_on_gt=True)
    raw, missing = webtaiyisrv._pan_with_game_theory(ty, 3, 0, False)
    assert raw == {"style": 3, "gt": False}
    assert missing is None
    assert ty.calls == [(3, 0, False)]
