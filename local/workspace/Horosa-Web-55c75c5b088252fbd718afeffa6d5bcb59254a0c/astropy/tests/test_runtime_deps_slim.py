# -*- coding: utf-8 -*-
"""运行时依赖瘦身哨兵。

桌面 runtime 只打包排盘计算真正 import 的依赖。历史教训:cetian_ziwei 顶层
`import streamlit` 一行把 streamlit→pyarrow/pandas/plotly ≈330MB 依赖树拖进
安装包与启动 import 链(业务代码对它们零调用)。

双管:
  1) 静态扫描:astrostudy/websrv 所有 .py 的「未受 try 保护的模块级 import 禁包」
     必须为零(新增顶层重依赖立即红);
  2) 动态阻断:以 meta_path 模拟「runtime 无禁包」环境,import 全服务入口必须成功
     且禁包不在 sys.modules(证明桩兜底有效、服务链不依赖)。
配对:package_runtime_payload.sh 的 site-packages 排除表(一处新增,两处同改)。
注:本哨兵须在干净解释器里跑动态部分——pytest 收集其它用例可能已 import 服务链,
    故动态部分用 subprocess 起独立进程执行。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# 禁包:UI 框架与其重依赖(排盘计算零引用;若未来某功能确需,先移出本表再打包)。
# pandas 不在表内:kentang chunzi 计算路径真实使用(read_csv/DataFrame 过滤),必须打包。
FORBIDDEN_RUNTIME_MODULES = [
    'streamlit', 'pyarrow', 'plotly', 'altair', 'pydeck',
]

# kentang adapter(vendor 顶层 import streamlit,由 kinastro_common 的 sys.modules
# 桩兜住)——动态阻断下这些模块必须依然可 import(等价于打包脚本的 kentang gate)。
# 全量 8 个 kinastro adapter(历史只列 5,shaozi/tieban/nanji 曾是覆盖盲区)+
# webtaiyisrv(kintaiyi→真 astropy 消费者:钉死「astropy × streamlit 桩」交互路径,
# v3.2.0 太乙静默 404 的事故面,此前零覆盖)。
KENTANG_ADAPTERS = [
    'websrv.webfendjingsrv', 'websrv.webbeijisrv', 'websrv.webchunzisrv',
    'websrv.webxianqinsrv', 'websrv.webqizhengkinsrv',
    'websrv.webshaozisrv', 'websrv.webtiebansrv', 'websrv.webnanjisrv',
    'websrv.webtaiyisrv',
]


def _iter_py_files():
    for base in ('astrostudy', 'websrv'):
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, base)):
            dirnames[:] = [d for d in dirnames if d != '__pycache__']
            for fn in filenames:
                if fn.endswith('.py'):
                    yield os.path.join(dirpath, fn)


def test_static_no_unguarded_toplevel_heavy_imports():
    """模块级(0 缩进、无 try 保护)import 禁包 = 零。"""
    pat = re.compile(
        r'^(?:import\s+(%s)\b|from\s+(%s)\b)' % (
            '|'.join(FORBIDDEN_RUNTIME_MODULES), '|'.join(FORBIDDEN_RUNTIME_MODULES)))
    offenders = []
    for path in _iter_py_files():
        with open(path, encoding='utf-8') as f:
            in_try = 0
            for i, line in enumerate(f, 1):
                stripped = line.rstrip('\n')
                if re.match(r'^try\s*:', stripped):
                    in_try += 1
                    continue
                # 回到 0 缩进的非 except/finally/空行 → try 块结束
                if in_try and stripped and not stripped[0] in ' \t' \
                        and not re.match(r'^(except|finally|else)\b', stripped):
                    in_try = 0
                if in_try:
                    continue
                if pat.match(stripped):
                    offenders.append('%s:%d: %s' % (os.path.relpath(path, ROOT), i, stripped.strip()))
    assert offenders == [], (
        '未受 try 保护的顶层重依赖 import(会进安装包+拖慢启动):\n%s\n'
        '请改为 try+桩(参照 cetian_ziwei)或函数内惰性 import,并核对打包排除表'
        % '\n'.join(offenders))


def test_service_chain_importable_without_heavy_deps():
    """meta_path 阻断禁包后,全服务入口 import 成功且禁包零加载(独立进程)。"""
    code = r'''
import sys, os
sys.path.insert(0, %r)
FORBIDDEN = %r

class _Blocker:
    # Python3.12 import 系统只走 find_spec(PEP 451);此处 raise ModuleNotFoundError
    # 模拟「包不存在」的导入面语义。
    def find_spec(self, name, path=None, target=None):
        top = name.split('.')[0]
        if top in FORBIDDEN:
            raise ModuleNotFoundError('blocked-by-slim-sentinel: %%s' %% name)
        return None

sys.meta_path.insert(0, _Blocker())

# 探测面语义:真实缺包时 importlib.util.find_spec 返回 None(astropy 的
# optional_deps 正是靠它判 HAS_PYARROW)。meta_path 的 raise 会误伤这类探测,
# 故对 util.find_spec 打补丁按「不存在」返 None——双钩子合起来才是精确的缺包模拟。
import importlib.util as _ilu
_orig_find_spec = _ilu.find_spec
def _slim_find_spec(name, package=None):
    if name.split('.')[0] in FORBIDDEN:
        return None
    return _orig_find_spec(name, package)
_ilu.find_spec = _slim_find_spec
import websrv.webchartsrv  # noqa: F401  全服务 import 链
for adapter in %r:
    __import__(adapter)  # kentang adapter:streamlit 桩兜底下必须可 import
# 真包不得加载;kinastro_common 注入的兼容桩(__horosa_slim_stub__)不算违规
loaded = set()
for m, mod in list(sys.modules.items()):
    top = m.split('.')[0]
    if top in FORBIDDEN and not getattr(sys.modules.get(top), '__horosa_slim_stub__', False):
        loaded.add(top)
hits = sorted(loaded)
assert hits == [], 'forbidden loaded: %%r' %% hits

# 桩兜底下计算核心可用且结构完整
from astrostudy.cetian_ziwei import compute_cetian_ziwei_chart
chart = compute_cetian_ziwei_chart(
    year=1990, month=6, day=15, hour=10, minute=30,
    timezone=8.0, latitude=39.9, longitude=116.4,
    location_name='', gender='男')
assert chart is not None and getattr(chart, 'palaces', None)
print('SLIM_OK')
''' % (ROOT, FORBIDDEN_RUNTIME_MODULES, KENTANG_ADAPTERS)
    proc = subprocess.run(
        [sys.executable, '-c', code], capture_output=True, text=True,
        cwd=ROOT, timeout=300)
    assert proc.returncode == 0 and 'SLIM_OK' in proc.stdout, (
        'stdout=%s\nstderr=%s' % (proc.stdout[-2000:], proc.stderr[-4000:]))


def _requirement_names(path):
    names = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('-r'):
                continue
            names.append((re.split(r'[<>=!~ \[;]', line, 1)[0].lower(), line))
    return names


def test_linux_requirements_are_the_mac_list_minus_the_ui_frameworks():
    """Linux 上跑批量 / 命题验证的依赖清单 = mac 清单去掉界面框架(与桌面安装包同一张排除表)。
    两份清单各写各的会漂:这里钉住「只差禁包」;mac 清单加了依赖、Linux 清单没跟上即红。"""
    req = os.path.abspath(os.path.join(ROOT, '..', '..', 'scripts', 'requirements'))
    # horosa_mac_only_test_guard_v1(Windows 适配,跨平台安全,建议上游化):两份清单是 macOS / Linux 的依赖清单
    # (仓库根 scripts/requirements/),Windows 树没有该目录(内嵌解释器的依赖集由打包侧的载荷锁钉住)——
    # 与其 FileNotFoundError 红,不如按「本树没有被测资产」跳过;清单在的树上原样跑。
    if not os.path.isdir(req):
        import pytest
        pytest.skip('scripts/requirements (macOS / Linux dependency lists) is not part of this tree')
    mac = _requirement_names(os.path.join(req, 'mac-python.txt'))
    linux = _requirement_names(os.path.join(req, 'linux-python.txt'))
    expected = [(n, line) for n, line in mac if n not in FORBIDDEN_RUNTIME_MODULES]
    assert linux == expected, 'linux-python.txt 应当恰是 mac-python.txt 去掉 %s' % FORBIDDEN_RUNTIME_MODULES
    dropped = sorted(n for n, _line in mac if n in FORBIDDEN_RUNTIME_MODULES)
    assert dropped == ['plotly', 'streamlit']          # mac 清单里直接点名的界面框架就这两个(其余禁包是它们带进来的)
    with open(os.path.join(req, 'linux-python.txt'), encoding='utf-8') as f:
        assert '-r mac-python.txt' not in f.read()     # 不再整份引用 mac 清单(那样界面框架又装回来)
