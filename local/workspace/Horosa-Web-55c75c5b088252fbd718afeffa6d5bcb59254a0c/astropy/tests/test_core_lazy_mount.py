# [B5] 核心 14 服务惰性挂载契约钉。
# 背景:webchartsrv 顶层同步 import 14 个非 kentang 服务曾是 py.interp_start→imports_done
# 的主墙;B5 改 CORE_SERVICE_SPECS + _LazyMountedService(复用 kentang 在产代理),
# warmup 线程在 STARTUP_GATE 开门前逐个预装 —— 任何业务 POST 的最早可服务时刻不晚于旧方案。
# 此文件钉三件事:①spec 表完整且指向真模块/真类;②预装严格先于开门(语义不变的根据);
# ③kill-switch 在位(HOROSA_CORE_LAZY=0 可回饿加载)。
import importlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXPECTED_MOUNTS = {
    "predict": "/predict",
    "india": "/india",
    "modern": "/modern",
    "germany": "/germany",
    "jieqi": "/jieqi",
    "chart3d": "/chart3d",
    "jdn": "/jdn",
    "calc": "/calc",
    "qizhengelection": "/qizhengelection",
    "acg": "/location",
    "cetian": "/cetian",
    "astroextra": "/astroextra",
    "planetarium": "/planetarium",
}


def _specs():
    from websrv.webchartsrv import CORE_SERVICE_SPECS
    return CORE_SERVICE_SPECS


def test_spec_table_covers_all_core_mounts():
    core = {sp["key"]: sp["mount"] for sp in _specs()}
    for key, mount in EXPECTED_MOUNTS.items():
        assert core.get(key) == mount, (key, mount, core.get(key))


def test_every_spec_points_to_real_module_and_class():
    # 防手抖拼错:spec 若指向不存在的 module/class,挂载不炸(零导入),
    # 到预装/首请求才 500 —— 在测试期就把这类错拦死。
    for sp in _specs():
        mod = importlib.import_module(sp["module"])
        assert hasattr(mod, sp["class_name"]), sp


def test_prewarm_runs_before_startup_gate_opens():
    src = open(os.path.join(ROOT, "websrv", "webchartsrv.py"), encoding="utf-8").read()
    i_prewarm = src.find("prewarm_core_services()")
    i_gate = src.find("STARTUP_GATE.set()")
    assert 0 < i_prewarm < i_gate, (
        "核心预装必须在 STARTUP_GATE.set() 之前 —— 这是「任何业务 POST 最早可服务时刻"
        "不晚于旧饿加载」语义的唯一根据,顺序倒置=首个请求可能踩冷加载")


def test_lazy_killswitch_present():
    src = open(os.path.join(ROOT, "websrv", "webchartsrv.py"), encoding="utf-8").read()
    assert re.search(r"HOROSA_CORE_LAZY", src)
    from websrv.webchartsrv import _core_lazy_enabled
    old = os.environ.get("HOROSA_CORE_LAZY")
    try:
        os.environ["HOROSA_CORE_LAZY"] = "0"
        assert _core_lazy_enabled() is False
        os.environ["HOROSA_CORE_LAZY"] = "1"
        assert _core_lazy_enabled() is True
    finally:
        if old is None:
            os.environ.pop("HOROSA_CORE_LAZY", None)
        else:
            os.environ["HOROSA_CORE_LAZY"] = old
