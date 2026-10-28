# -*- coding: utf-8 -*-
"""测试收集完整性:仓里每一份 test_*.py 都必须在某一道门里跑,或登记「不进门 + 理由」。

基线 `pytest tests/` 只收集 astropy/tests;放在别处的测试(vendor 引擎目录、flatlib、发布脚本目录)若没有别的门点名,
就是从不跑的死测试 —— 今天绿,改坏了也没人知道。新增未登记即红;登记的门里已不再点名它即红。
"""
import subprocess
from pathlib import Path

import test_vendor_suites_gate as vendor_gate

_ASTROPY = Path(__file__).resolve().parent.parent
_WEB = _ASTROPY.parent
_REPO = _WEB.parent
# horosa_win_layout_webdir_v1:产品目录名按实际检出取(Windows 仓里产品源在 local/workspace/Horosa-Web-<sha>/,不叫 Horosa-Web)
_WEBDIR = _WEB.name
_COLLECTED = f"{_WEBDIR}/astropy/tests/"

# 由别的门点名运行:路径 → 点名它的门(该文件里必须出现这份测试的文件名)
OTHER_GATES = {
    "Horosa_Desktop_Installer/scripts/test_prepare_sign_seed.py": "Horosa_Desktop_Installer/scripts/preflight/segments/release.sh",
    "Horosa_Desktop_Installer/scripts/test_prev_parts_modes.py": "Horosa_Desktop_Installer/scripts/preflight/segments/release.sh",
    "Horosa_Desktop_Installer/scripts/test_sign_payload_cached.py": "Horosa_Desktop_Installer/scripts/preflight/segments/release.sh",
    "Horosa_Desktop_Installer/scripts/test_sign_runtime_payload_native_cache.py": "Horosa_Desktop_Installer/scripts/preflight/segments/release.sh",
}

# 不进门:路径或目录前缀(以 / 结尾)→ 理由
EXCLUDED = {
    f"{_WEBDIR}/vendor/kinastro/tests/": "上游原样带来的整站测试;本仓只带入并改过其中部分模块(铁板已入门),这套与裁剪后的副本不配套:"
                                         "依赖未带入的 streamlit 运行时与子模块、含上游自身的语法错,在本仓副本上 42 败 3 错,是上游状态而非本仓回归",
}


def _tracked_tests():
    try:
        out = subprocess.run(["git", "ls-files", "-z", "--", "*test_*.py"], cwd=str(_REPO), capture_output=True, check=True).stdout
        files = [p for p in out.decode("utf-8").split("\0") if p]
    except Exception:
        files = [p.relative_to(_REPO).as_posix() for p in _REPO.rglob("test_*.py")
                 if "node_modules" not in p.parts and "runtime" not in p.parts]
    return sorted(f for f in files if Path(f).name.startswith("test_") and not f.startswith(_COLLECTED))


def _gated_by_vendor_suites(rel):
    target = (_REPO / rel).resolve()
    for _name, cwd, args in vendor_gate.SUITES:
        for a in args:
            if a.startswith("-") or a == "pytest":
                continue
            p = (cwd / a).resolve()
            if p == target or (p.is_dir() and p in target.parents):
                return True
    return False


def _excluded(rel):
    return any(rel == k or (k.endswith("/") and rel.startswith(k)) for k in EXCLUDED)


def test_every_test_file_is_in_a_gate_or_registered():
    orphans = [rel for rel in _tracked_tests()
               if not (_gated_by_vendor_suites(rel) or rel in OTHER_GATES or _excluded(rel))]
    assert orphans == []


def test_other_gates_still_name_their_tests():
    # 这份检出里测试文件与门都不在的条目跳过(检出可能不含某些目录);测试在、门不在或门不再点名 = 红
    stale = []
    for rel, gate in OTHER_GATES.items():
        gate_path = _REPO / gate
        if not (_REPO / rel).is_file() and not gate_path.is_file():
            continue
        if not (_REPO / rel).is_file() or not gate_path.is_file() or Path(rel).name not in gate_path.read_text(encoding="utf-8"):
            stale.append(f"{rel} ← {gate}")
    assert stale == []


def test_registries_have_no_stale_entries():
    tracked = set(_tracked_tests())
    assert sorted(k for k in EXCLUDED
                  if (_REPO / k).exists() and not any(t == k or (k.endswith("/") and t.startswith(k)) for t in tracked)) == []


def test_detector_sees_an_orphan():
    assert not _gated_by_vendor_suites(f"{_WEBDIR}/vendor/kinastro/tests/test_x.py")
    assert _gated_by_vendor_suites(f"{_WEBDIR}/vendor/kinqimen/test_qimen_calendar.py")
    assert _gated_by_vendor_suites(f"{_WEBDIR}/vendor/kinwangji/tests/test_basic.py")
