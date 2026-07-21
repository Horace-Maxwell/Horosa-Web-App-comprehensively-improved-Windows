"""Registry for kentang2017-backed calculation services.

This file is the only place the root CherryPy app should know about
Kentang-backed service mounts. Each concrete adapter remains in its own
one web service adapter module so the raw vendor library, Horosa normalization, and
HTTP route stay identifiable.
"""


KENTANG_SERVICE_SPECS = [
    {
        "key": "taiyi",
        "engine": "kintaiyi",
        "mount": "/taiyi",
        "module": "websrv.webtaiyisrv",
        "class_name": "TaiYiSrv",
    },
    {
        "key": "jinkou",
        "engine": "kinjinkou",
        "mount": "/jinkou",
        "module": "websrv.webjinkousrv",
        "class_name": "JinKouSrv",
    },
    {
        "key": "qimen",
        "engine": "kinqimen",
        "mount": "/qimen",
        "module": "websrv.webqimensrv",
        "class_name": "QiMenSrv",
    },
    {
        "key": "wangji",
        "engine": "kinwangji",
        "mount": "/wangji",
        "module": "websrv.webwangjisrv",
        "class_name": "WangJiSrv",
    },
    {
        "key": "wuzhao",
        "engine": "kinwuzhao",
        "mount": "/wuzhao",
        "module": "websrv.webwuzhaosrv",
        "class_name": "WuZhaoSrv",
    },
    {
        "key": "taixuan",
        "engine": "taixuanshifa",
        "mount": "/taixuan",
        "module": "websrv.webtaixuansrv",
        "class_name": "TaiXuanSrv",
    },
    {
        "key": "jingjue",
        "engine": "jingjue",
        "mount": "/jingjue",
        "module": "websrv.webjingjuesrv",
        "class_name": "JingJueSrv",
    },
    {
        "key": "shenyishu",
        "engine": "shenyishu",
        "mount": "/shenyishu",
        "module": "websrv.webshenyishusrv",
        "class_name": "ShenYiShuSrv",
    },
    {
        "key": "geomancy",
        "engine": "astronomical_geomancy",
        "mount": "/geomancy",
        "module": "websrv.webgeomancysrv",
        "class_name": "GeomancySrv",
    },
    {
        "key": "shaozi",
        "engine": "kinastro-shaozi",
        "mount": "/shaozi",
        "module": "websrv.webshaozisrv",
        "class_name": "ShaoZiSrv",
    },
    {
        "key": "tieban",
        "engine": "kinastro-tieban",
        "mount": "/tieban",
        "module": "websrv.webtiebansrv",
        "class_name": "TieBanSrv",
    },
    {
        "key": "fendjing",
        "engine": "kinastro-fendjing",
        "mount": "/fendjing",
        "module": "websrv.webfendjingsrv",
        "class_name": "FenDingJingSrv",
    },
    {
        "key": "beiji",
        "engine": "kinastro-beiji",
        "mount": "/beiji",
        "module": "websrv.webbeijisrv",
        "class_name": "BeiJiSrv",
    },
    {
        "key": "nanji",
        "engine": "kinastro-nanji",
        "mount": "/nanji",
        "module": "websrv.webnanjisrv",
        "class_name": "NanJiSrv",
    },
    {
        "key": "chunzi",
        "engine": "kinastro-chunzi",
        "mount": "/chunzi",
        "module": "websrv.webchunzisrv",
        "class_name": "ChunZiSrv",
    },
    {
        "key": "xianqin",
        "engine": "kinastro-xianqin",
        "mount": "/xianqin",
        "module": "websrv.webxianqinsrv",
        "class_name": "XianQinSrv",
    },
    {
        "key": "qizhengkin",
        "engine": "kinastro-qizheng",
        "mount": "/qizhengkin",
        "module": "websrv.webqizhengkinsrv",
        "class_name": "QiZhengKinSrv",
    },
    {
        "key": "xuanshi",
        "engine": "xuanshi_history",
        "mount": "/xuanshi",
        "module": "websrv.webxuanshisrv",
        "class_name": "XuanShiSrv",
    },
]


import importlib
import os
import sys
import threading
import traceback

# horosa_kentang_prewarm_modules_v1:请求路径内惰性 import 的重模块,由后台预热线程提前装载。
# 只 import 不调用 —— 零盘面副作用。新增条目前请先实测「首次 vs 之后」确有秒级差,否则不值当。
KENTANG_PREWARM_MODULES = [
    # 太乙·博弈论(793 行):仅在勾选 enableGameTheory 时才被 kintaiyi.pan 导入。
    "kintaiyi.game_theory",
]


class KentangServiceLoadError(RuntimeError):
    """A kentang service failed to import / resolve its class / instantiate.

    Deliberately NOT an ``AttributeError``: CherryPy's object dispatcher walks the mount
    tree with ``getattr(node, name, None)``, which swallows AttributeError as "no such
    route" — that is exactly how the v3.2.0 太乙 failure became a permanent, traceback-free
    404. Any load failure must surface loudly with a logged traceback, never a silent 404.
    """


# KENTANG_LAZY_MOUNT_SELF_HEAL — 绝不 purge 的公共包前缀(自愈净化白名单外的保护):
# 桩/适配器污染只可能落在 websrv 适配器模块与 vendor 引擎包前缀内;
# astropy/cherrypy 等公共依赖被误 purge 反而制造新的半导入残骸。
_PURGE_PROTECT_PREFIXES = ("astropy", "cherrypy", "numpy", "pandas", "erfa", "yaml")


def _import_kentang_service_module(spec):
    """KENTANG_LAZY_MOUNT_SELF_HEAL — import a kentang service adapter module, self-healing a
    poisoned ``sys.modules`` cache.

    Root cause this guards (三式合一 太乙 ``kintaiyi_unavailable`` 类事故): a transient import
    hiccup (payload materialization race / stub interaction) can leave the adapter module — or
    its vendored engine package (e.g. ``kintaiyi``) — cached in ``sys.modules`` WITHOUT the
    expected service class defined. A plain ``__import__`` then returns that partial cached
    module; the subsequent ``getattr(module, class_name)`` raises ``AttributeError``; and if
    that ever reaches CherryPy's dispatcher, the route returns **404 for the entire life of
    the process** with no traceback.

    Guard: after importing, if the module is missing its service class, purge the adapter
    module AND its vendor engine package (plus any partial submodules) from ``sys.modules``
    and re-import once from clean state. If it is still incomplete, raise a real
    ``KentangServiceLoadError`` so the failure surfaces loudly rather than as a silent 404."""
    module_name = spec["module"]
    class_name = spec["class_name"]
    engine = spec.get("engine")
    first_error = None
    try:
        module = __import__(module_name, fromlist=[class_name])
        if getattr(module, class_name, None) is not None:
            return module
    except Exception as exc:
        first_error = exc  # a poisoned engine submodule can make the first import raise — purge + retry below
    # Poisoned / partial cache: purge the adapter module AND its engine package (+ any partial
    # submodules) from sys.modules, then re-import once from a clean state.
    prefixes = [module_name]
    if engine:
        prefixes.append(engine)
    for key in list(sys.modules):
        if any(key == p or key.startswith(p + ".") for p in prefixes):
            if key.split(".")[0] in _PURGE_PROTECT_PREFIXES:
                continue
            sys.modules.pop(key, None)
    try:
        module = __import__(module_name, fromlist=[class_name])
    except Exception as exc:
        raise KentangServiceLoadError(
            "kentang service %r module %r failed to import (first error: %r)"
            % (spec.get("key"), module_name, first_error or exc)
        ) from exc
    if getattr(module, class_name, None) is None:
        raise KentangServiceLoadError(
            "kentang service %r module %r loaded without class %r (first error: %r)"
            % (spec.get("key"), module_name, class_name, first_error)
        )
    return module


def _load_service(spec):
    try:
        module = _import_kentang_service_module(spec)
        service_cls = getattr(module, spec["class_name"])
        return service_cls()
    except Exception:
        # 响亮失败:完整 traceback 落日志,绝不让加载失败降级成 dispatcher 的静默 404。
        print("[kentang] FATAL load %s (%s)" % (spec.get("key"), spec.get("module")), flush=True)
        traceback.print_exc()
        raise


def _kentang_lazy_enabled():
    """HOROSA_KENTANG_LAZY=0 回饿加载(默认懒挂载)。"""
    value = os.environ.get("HOROSA_KENTANG_LAZY", "1").strip().lower()
    return value not in ("0", "false", "no", "off")


class _LazyMountedService(object):
    """惰性挂载代理(WS-3d):挂载时零导入,首个请求才加载真服务。

    价值:kentang 饿加载森林(18 服务 + vendor 引擎 + xuanshi SQLite 底座)占启动
    关键路径 1.2-1.9s;懒挂载把它挪出 mounts 段,监听后由 prewarm_kentang_services
    在后台线程逐个补装(空闲预热吃掉首点成本,用户首点通常已就绪)。

    协议要点:
    · CherryPy object dispatcher 用 getattr 遍历挂载树 → 本代理 __getattr__ 首次被
      问任何路由属性时完成真服务加载再转发;
    · 加载失败抛 KentangServiceLoadError(绝不是 AttributeError)→ dispatcher 不吞,
      HTTP 500 响亮暴露,且下个请求会重试加载(不永久钉死);
    · dunder 一律拒答 —— 与 kinastro_common stub_dunder_guard_v1 同一课:
      inspect 等内省工具拿到意外的 __file__/__wrapped__ 会在别人代码里炸;
    · 并发首请求由锁串行,只加载一次。
    """

    def __init__(self, spec):
        object.__setattr__(self, "_horosa_spec", spec)
        object.__setattr__(self, "_horosa_real", None)
        object.__setattr__(self, "_horosa_lock", threading.Lock())

    def _horosa_load(self):
        real = object.__getattribute__(self, "_horosa_real")
        if real is not None:
            return real
        lock = object.__getattribute__(self, "_horosa_lock")
        with lock:
            real = object.__getattribute__(self, "_horosa_real")
            if real is None:
                spec = object.__getattribute__(self, "_horosa_spec")
                real = _load_service(spec)
                object.__setattr__(self, "_horosa_real", real)
        return real

    def __getattr__(self, name):
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        if name.startswith("_horosa_"):
            raise AttributeError(name)
        real = self._horosa_load()
        return getattr(real, name)


def mount_kentang_services(cherrypy):
    lazy = _kentang_lazy_enabled()
    for spec in KENTANG_SERVICE_SPECS:
        if lazy:
            cherrypy.tree.mount(_LazyMountedService(spec), spec["mount"])
        else:
            cherrypy.tree.mount(_load_service(spec), spec["mount"])


def prewarm_kentang_services():
    """空闲预热(监听后后台 warmup 线程调):逐个完成懒服务真加载。

    吞错——预热失败只打日志,留给首个真实请求以 KentangServiceLoadError 响亮 500
    (加载路径与请求路径同一条,绝无「预热吞掉故障」的口径分叉)。
    返回 (loaded, failed) 计数,供账本/日志。
    """
    import cherrypy as _cherrypy

    loaded = 0
    failed = 0
    for spec in KENTANG_SERVICE_SPECS:
        try:
            app = _cherrypy.tree.apps.get(spec["mount"])
            root = getattr(app, "root", None)
            if isinstance(root, _LazyMountedService):
                root._horosa_load()
                loaded += 1
        except Exception:
            failed += 1
            print("[kentang] prewarm failed %s" % spec.get("key"), flush=True)
            traceback.print_exc()

    return loaded, failed


def prewarm_kentang_modules():
    """horosa_kentang_prewarm_modules_v1:预装「请求路径内惰性 import」的重模块。

    服务挂载之外还有一类成本:模块在**请求路径内**才被 import。典型是
    kintaiyi.pan(enable_game_theory=True) 才 `from .game_theory import TaiyiGame`,
    而 game_theory 是 793 行的重模块 —— 实测冷导入 **528ms**,温(sys.modules 命中)
    0.001ms。用户在太乙里第一次勾「博弈论」白等的就是这 528ms,与算法无关。

    ⚠️ **必须在 STARTUP_GATE 打开之后调**,绝不能并进 prewarm_kentang_services():
    后者跑在门**之前**,把 528ms 加进去等于直接把启动门推迟 528ms(启动预算是硬线)。
    同一文件里 xuanshi_summary_warmup_v1 立的就是这个规矩 —— 预热只许吃空闲,不许
    延长任何人的等待窗。

    其它约束:只 import、不调用任何函数 ⇒ 零盘面副作用,任何请求的输出逐字节不变;
    吞错 ⇒ 失败时真实请求仍走原来的 import 并按原样报错(口径不分叉)。
    返回 (warmed, failed) 计数供日志。
    """
    warmed = 0
    failed = 0
    for modname in KENTANG_PREWARM_MODULES:
        try:
            importlib.import_module(modname)
            warmed += 1
        except Exception:
            failed += 1
            print("[kentang] module prewarm failed %s" % modname, flush=True)
            traceback.print_exc()
    return warmed, failed
