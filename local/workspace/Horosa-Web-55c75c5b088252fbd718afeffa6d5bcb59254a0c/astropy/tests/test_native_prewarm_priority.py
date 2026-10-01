# -*- coding: utf-8 -*-
"""首启原生库预检的顺序表覆盖哨兵(配对 Horosa_Desktop_Installer/config/native_prewarm_priority.json)。

桌面壳装包后会按顺序表逐个触发原生库的系统首次加载评估(约 0.1 秒一个、系统侧串行),
「启动一定会加载的那批」必须排在前面(顺序表前 startupTiers 档),否则用户装完立刻打开时
排前面的可能不是服务真正要的。本哨兵用内嵌解释器照服务启动那样挂载 + 预热一遍,把进程里
真正加载的原生库列出来,逐个核对是否都落在启动档内。依赖变了(新增一个启动期要装的原生包)
→ 这里红 → 把它加进顺序表。

开发机 site-packages 比打包多出 UI 依赖(streamlit / pyarrow…,打包脚本排除),照瘦身哨兵的
meta_path 阻断模拟,不计入。没有内嵌运行时(CI / 别的机器)则跳过。
"""
import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
WEB = os.path.join(REPO, 'Horosa-Web')
PRIORITY = os.path.join(REPO, 'Horosa_Desktop_Installer', 'config', 'native_prewarm_priority.json')
EMBEDDED_PY = os.path.join(REPO, 'runtime', 'mac', 'python', 'bin', 'python3')

# horosa_mac_only_test_guard_v1(Windows 适配,跨平台安全,建议上游化):顺序表是 macOS 安装器资产
# (Horosa_Desktop_Installer/config/…),Windows 树没有该目录 —— 与其 FileNotFoundError 红,不如按
# 「本树没有被测资产」跳过;macOS 树上文件在,两条测试原样跑。
pytestmark = pytest.mark.skipif(
    not os.path.exists(PRIORITY),
    reason='native_prewarm_priority.json (macOS installer asset) is not part of this tree',
)

sys.path.insert(0, os.path.dirname(__file__))
from test_runtime_deps_slim import FORBIDDEN_RUNTIME_MODULES  # noqa: E402  打包排除表单源


def _load_priority():
    with open(PRIORITY, encoding='utf-8') as f:
        return json.load(f)


def _tier_of(rel, tiers):
    for idx, tier in enumerate(tiers):
        if any(needle in rel for needle in tier):
            return idx
    return len(tiers)


def test_priority_table_is_well_formed():
    cfg = _load_priority()
    tiers = cfg['tiers']
    assert isinstance(tiers, list) and len(tiers) >= 4
    assert 1 <= cfg['startupTiers'] <= len(tiers)
    for tier in tiers:
        assert tier and all(isinstance(x, str) and x for x in tier)
    # 解释器与 JVM 本体、标准库扩展、预热要装的包,顺序不能倒
    assert _tier_of('runtime/mac/python/bin/python3.12', tiers) < _tier_of('runtime/mac/python/lib/python3.12/lib-dynload/_ssl.so', tiers)
    assert _tier_of('runtime/mac/java/lib/server/libjvm.dylib', tiers) < _tier_of('runtime/mac/python/lib/python3.12/lib-dynload/_ssl.so', tiers)
    assert _tier_of('runtime/mac/python/lib/python3.12/site-packages/pandas/_libs/x.so', tiers) < cfg['startupTiers']
    assert _tier_of('runtime/mac/python/lib/python3.12/site-packages/never_heard_of/x.so', tiers) == len(tiers)


@pytest.mark.skipif(not os.path.exists(EMBEDDED_PY), reason='no embedded runtime on this machine')
def test_startup_native_images_are_all_in_startup_tiers():
    code = r'''
import sys, os, json, ctypes
FORBIDDEN = %r

class _Blocker:
    def find_spec(self, name, path=None, target=None):
        if name.split('.')[0] in FORBIDDEN:
            raise ModuleNotFoundError('blocked-by-slim-sentinel: %%s' %% name)
        return None

sys.meta_path.insert(0, _Blocker())
import importlib.util as _ilu
_orig_find_spec = _ilu.find_spec
def _slim_find_spec(name, package=None):
    if name.split('.')[0] in FORBIDDEN:
        return None
    return _orig_find_spec(name, package)
_ilu.find_spec = _slim_find_spec

import cherrypy
import websrv.webchartsrv as srv
cherrypy.tree.mount(srv.WebChartSrv(), '/')
srv.mount_core_services()
srv.mount_kentang_services(cherrypy)
srv._run_warmups()
assert srv.STARTUP_GATE.is_set()
libsys = ctypes.CDLL(None)
libsys._dyld_image_count.restype = ctypes.c_uint32
libsys._dyld_get_image_name.restype = ctypes.c_char_p
libsys._dyld_get_image_name.argtypes = [ctypes.c_uint32]
images = [libsys._dyld_get_image_name(i).decode('utf-8', 'replace') for i in range(libsys._dyld_image_count())]
print('IMAGES_JSON ' + json.dumps(images))
'''
    env = {
        'HOME': os.environ.get('HOME', '/tmp'),
        'PATH': '/usr/bin:/bin:/usr/sbin:/sbin',
        'PYTHONPATH': os.pathsep.join([os.path.join(WEB, 'flatlib-ctrad2'), ROOT, os.path.join(WEB, 'vendor')]),
        'PYTHONNOUSERSITE': '1',
        'PYTHONDONTWRITEBYTECODE': '1',
        'HOROSA_TRUSTED_RUNTIME': '1',
        'HOROSA_STARTUP_LEDGER': '0',
    }
    proc = subprocess.run([EMBEDDED_PY, '-c', code % (FORBIDDEN_RUNTIME_MODULES,)], capture_output=True, text=True,
                          cwd=ROOT, env=env, timeout=600)
    assert proc.returncode == 0, 'stdout=%s\nstderr=%s' % (proc.stdout[-1500:], proc.stderr[-3000:])
    line = [l for l in proc.stdout.splitlines() if l.startswith('IMAGES_JSON ')]
    assert line, proc.stdout[-1500:]
    images = json.loads(line[-1][len('IMAGES_JSON '):])
    runtime_prefix = os.path.realpath(os.path.join(REPO, 'runtime', 'mac')) + os.sep
    rels = sorted({'runtime/mac/' + os.path.realpath(p)[len(runtime_prefix):]
                   for p in images if os.path.realpath(p).startswith(runtime_prefix)})
    assert len(rels) >= 60, '预热后进程里的运行时原生库太少(%d),哨兵没量到真实启动面:%s' % (len(rels), rels[:10])
    cfg = _load_priority()
    late = [(rel, _tier_of(rel, cfg['tiers'])) for rel in rels if _tier_of(rel, cfg['tiers']) >= cfg['startupTiers']]
    assert late == [], ('启动期真加载的原生库没排进顺序表的启动档(把它的包加进 native_prewarm_priority.json):%s' % late)
