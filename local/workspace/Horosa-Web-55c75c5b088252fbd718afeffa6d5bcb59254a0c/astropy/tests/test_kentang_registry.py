# -*- coding: utf-8 -*-
"""kentang registry 结构哨兵(自 websrv/kentang/test_registry.py 迁入 tests/ 使 pytest 必收集)。

历史教训:原文件不在 tests/ 收集范围内成了「死测试」,cetian 迁出 registry 改为
webchartsrv 直挂后其断言早已过期却从未红过。迁入 + 修正断言,并加「cetian 不在
registry(由 webchartsrv 直挂)」的反向钉,防止再漂。
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from websrv.kentang.registry import KENTANG_SERVICE_SPECS  # noqa: E402


def test_service_specs_are_unique_and_complete():
    required = {"key", "engine", "mount", "module", "class_name"}
    keys = [spec["key"] for spec in KENTANG_SERVICE_SPECS]
    engines = [spec["engine"] for spec in KENTANG_SERVICE_SPECS]
    mounts = [spec["mount"] for spec in KENTANG_SERVICE_SPECS]

    assert len(keys) == len(set(keys))
    assert len(engines) == len(set(engines))
    assert len(mounts) == len(set(mounts))

    for spec in KENTANG_SERVICE_SPECS:
        assert required.issubset(spec.keys())
        assert spec["mount"].startswith("/")
        assert spec["module"].startswith("websrv.")
        assert spec["class_name"].endswith("Srv")


def test_current_kentang_modules_are_registered():
    by_key = {spec["key"]: spec for spec in KENTANG_SERVICE_SPECS}
    expected = {
        "taiyi": ("kintaiyi", "/taiyi"),
        "jinkou": ("kinjinkou", "/jinkou"),
        "qimen": ("kinqimen", "/qimen"),
        "wangji": ("kinwangji", "/wangji"),
        "wuzhao": ("kinwuzhao", "/wuzhao"),
        "taixuan": ("taixuanshifa", "/taixuan"),
        "jingjue": ("jingjue", "/jingjue"),
        "shenyishu": ("shenyishu", "/shenyishu"),
        "geomancy": ("astronomical_geomancy", "/geomancy"),
        "shaozi": ("kinastro-shaozi", "/shaozi"),
        "tieban": ("kinastro-tieban", "/tieban"),
        "fendjing": ("kinastro-fendjing", "/fendjing"),
        "beiji": ("kinastro-beiji", "/beiji"),
        "nanji": ("kinastro-nanji", "/nanji"),
        "chunzi": ("kinastro-chunzi", "/chunzi"),
        "xianqin": ("kinastro-xianqin", "/xianqin"),
        "qizhengkin": ("kinastro-qizheng", "/qizhengkin"),
        "xuanshi": ("xuanshi_history", "/xuanshi"),
    }
    assert set(by_key) == set(expected), (
        "registry 键集漂移:新增/删除服务须同步本测试与冒烟探针清单")
    for key, (engine, mount) in expected.items():
        assert by_key[key]["engine"] == engine
        assert by_key[key]["mount"] == mount


def test_cetian_moved_out_of_registry_and_directly_mounted():
    """cetian 已重写为自有引擎并迁出 registry(旧死测试曾断言它还在——过期)。
    钉:registry 无 cetian;webchartsrv 直挂 /cetian。"""
    keys = {spec["key"] for spec in KENTANG_SERVICE_SPECS}
    assert "cetian" not in keys
    # [B5] 直挂已升级为 CORE_SERVICE_SPECS 惰性挂载(webchartsrv 自持,不回 registry):
    # 断言按语义查表 —— cetian 在核心 spec 表且落 /cetian、指向自有引擎模块。
    from websrv.webchartsrv import CORE_SERVICE_SPECS
    core = {sp["key"]: sp for sp in CORE_SERVICE_SPECS}
    assert "cetian" in core, "cetian 应在 webchartsrv 核心服务表"
    assert core["cetian"]["mount"] == "/cetian"
    assert core["cetian"]["module"] == "websrv.webcetiansrv"
