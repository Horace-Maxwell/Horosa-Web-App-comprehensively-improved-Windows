"""
Pytest conftest for astropy tests.

Injects the in-tree flatlib-ctrad2, the astropy package root, and the vendor
root onto sys.path, so tests can import `astrostudy.*` / `flatlib.*` and the
shared全域权威 `kin_year_domain`(vendor/ 根,extreme_pillars 单一真值,被
kinastro/kinwangji 等引擎与四柱权威金标共用)exactly as the runtime does,
without requiring an editable install or PYTHONPATH env var.

🔴 vendor/ 曾漏登:test_shaozi/test_shushu 顶层 `from kin_year_domain import`
在无外部 PYTHONPATH 时 collection 直接报错(ModuleNotFoundError)——四柱权威金标
静默不跑=BC/极端年四柱回归无人拦。补进后全域权威金标随 `pytest tests/` 常驻。
"""
import sys
from pathlib import Path

_ASTROPY_ROOT = Path(__file__).resolve().parent.parent           # .../Horosa-Web/astropy
_HOROSA_WEB_ROOT = _ASTROPY_ROOT.parent                          # .../Horosa-Web
_FLATLIB_ROOT = _HOROSA_WEB_ROOT / 'flatlib-ctrad2'              # .../Horosa-Web/flatlib-ctrad2
_VENDOR_ROOT = _HOROSA_WEB_ROOT / 'vendor'                       # .../Horosa-Web/vendor (kin_year_domain)

for p in (_FLATLIB_ROOT, _ASTROPY_ROOT, _VENDOR_ROOT):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)
