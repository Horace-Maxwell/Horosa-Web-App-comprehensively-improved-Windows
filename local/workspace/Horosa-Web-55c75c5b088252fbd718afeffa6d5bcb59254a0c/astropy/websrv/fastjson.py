# -*- coding: utf-8 -*-
"""[R5 T2] 响应 JSON 快径(单源;webchartsrv / webpredictsrv 共用;与 Windows 版同名开关 HOROSA_FAST_JSON_ENCODE)。

对纯 JSON 树,`json.dumps(obj)`(全默认参)与 `jsonpickle.encode(obj, unpicklable=False)` 逐字节相等,而前者跳过
jsonpickle 的类型巡检层(172 KB 本命盘 5.7→1.0 ms)。但核心盘响应里嵌着 flatlib 的对象(Object / House / FixedStar /
Datetime / GeoPos …,一张盘 240 余处),jsonpickle 对它们的处理 = 递归输出 `__dict__`(插入序);这里用
`default=` 钩子对**允许名单内**的类做同样的事(名单内的类:无 __getstate__ / __slots__ / 自定义 handler,
tests/test_perf_r5_batch1.py 用真盘逐字节钉住),名单外任何类型 → TypeError → 回退真 jsonpickle(回退零漂移 by construction)。
只在三个条件同时成立才走快径:开关开 + 真 jsonpickle 在场(compat 桩用 ensure_ascii=False 不等价,不套)+ 默认参。
kill:HOROSA_FAST_JSON_ENCODE=0 ⇒ 恒走原实现。STATS 供测试核「真走了快径」。

[R5 P0-3] 进程级安装 install_global(真 jsonpickle 模块):把 jsonpickle.encode 本身换成同判据、同回退的快径版,
所有挂载服务(印度盘 / 占星地图 / 推运衍生盘 / 卜类引擎…)共用;全站录制语料重放逐请求响应 sha 全同。
原 encode 保存在包装函数的 _horosa_orig 上(对拍 / 测试用 original_encode 取)。
子开关 HOROSA_FAST_JSON_GLOBAL=0 ⇒ 只保留上面两个服务的模块级 shim(T2 原范围)。
"""
import json
import math
import os

_FAST_JSON_ON = os.environ.get("HOROSA_FAST_JSON_ENCODE", "1").lower() not in ("0", "false", "no", "off")
_FAST_JSON_GLOBAL_ON = os.environ.get("HOROSA_FAST_JSON_GLOBAL", "1").lower() not in ("0", "false", "no", "off")
# 预扫的实现:迭代(缺省)/ 递归(=0 回旧)。迭代版逐节点判据与递归版相同,只省掉每个节点一次函数调用(主排盘响应
# 约 7,600 个节点:0.59 → 约 0.25 ms)。
_ITER_SCAN_ON = os.environ.get("HOROSA_FAST_JSON_ITER_SCAN", "1").lower() not in ("0", "false", "no", "off")

STATS = {"fast": 0, "fallback": 0}

_ALLOW = None


def _allowed_types():
    global _ALLOW
    if _ALLOW is None:
        allow = set()
        try:
            from flatlib.object import GenericObject, Object, House, FixedStar
            allow.update((GenericObject, Object, House, FixedStar))
        except Exception:
            pass
        try:
            from flatlib.datetime import Datetime, Date, Time
            allow.update((Datetime, Date, Time))
        except Exception:
            pass
        try:
            from flatlib.geopos import GeoPos
            allow.add(GeoPos)
        except Exception:
            pass
        _ALLOW = frozenset(allow)
    return _ALLOW


def _fast_default(o):
    # 与 jsonpickle(unpicklable=False)对普通实例的扁平化同构:递归输出 __dict__(插入序,不排序)。
    if type(o) in _allowed_types():
        d = getattr(o, "__dict__", None)
        if d is not None:
            return d
    raise TypeError("not fast-json-able: %s" % type(o).__name__)


def _fast_shape_ok_recursive(obj, _depth=0):
    """快径只接「json.dumps 与 jsonpickle(unpicklable=False) 逐字节同构」的形状;实测两者不同的形状:
    bool 字典键(True→"True" vs "true")、float 子类(numpy.float64:jsonpickle 走 py/newargs)、
    其它 int/str/dict/list 子类(jsonpickle 有专门分支)—— 全部回退真 jsonpickle。TypeError 形状
    (set / datetime / bytes / numpy 整数)由 json.dumps 自己抛出后回退,不必在此扫。"""
    if _depth > 200:
        return False
    t = type(obj)
    if t is dict:
        for k, v in obj.items():
            tk = type(k)
            if tk is not str and (tk is bool or tk not in (int, float, type(None)) or (tk is float and not math.isfinite(k))):
                return False
            if not _fast_shape_ok_recursive(v, _depth + 1):
                return False
        return True
    if t is list or t is tuple:
        for v in obj:
            if not _fast_shape_ok_recursive(v, _depth + 1):
                return False
        return True
    if t in (str, int, float, bool, type(None)):
        return True
    if t in _allowed_types():
        d = getattr(obj, "__dict__", None)
        return d is None or _fast_shape_ok_recursive(d, _depth + 1)
    if isinstance(obj, (dict, list, tuple, str, int, float)):
        return False          # 子类(OrderedDict / numpy 标量 / str 子类等):jsonpickle 有自己的分支
    # 其它类型(set / datetime / bytes / numpy 整数 / 名单外的类…)json.dumps 必经 default → _fast_default 抛
    # TypeError → 回退;在此直接判否,省掉预扫后半程与一次注定失败的 json.dumps(结果与抛错回退相同)。
    return False


_SCALAR_TYPES = (str, int, float, bool, type(None))
_KEY_OK_TYPES = (int, float, type(None))


def _fast_shape_ok_iter(obj, _depth=0):
    """与 _fast_shape_ok_recursive 逐节点同判据(深度 > 200 判否、字典键 / 子类 / 名单外类型规则一致),
    结果 = 全部节点判据的「与」;迭代遍历、标量子节点就地判定。"""
    allowed = _allowed_types()
    scalars = _SCALAR_TYPES
    stack = [(obj, _depth)]
    pop = stack.pop
    push = stack.append
    while stack:
        o, d = pop()
        if d > 200:
            return False
        t = type(o)
        if t is dict:
            nd = d + 1
            for k, v in o.items():
                tk = type(k)
                # 非有限浮点键:json.dumps 写 "NaN" / "Infinity",jsonpickle 写 repr 的 "nan" / "inf" —— 不同构,回退
                if tk is not str and (tk is bool or tk not in _KEY_OK_TYPES or (tk is float and not math.isfinite(k))):
                    return False
                if type(v) in scalars:
                    if nd > 200:
                        return False
                    continue
                push((v, nd))
        elif t is list or t is tuple:
            nd = d + 1
            for v in o:
                if type(v) in scalars:
                    if nd > 200:
                        return False
                    continue
                push((v, nd))
        elif t in scalars:
            continue
        elif t in allowed:
            dd = getattr(o, "__dict__", None)
            if dd is not None:
                push((dd, d + 1))
        else:
            return False   # 子类(OrderedDict / numpy 标量 / str 子类…)与名单外类型:同递归版,一律回退
    return True


def _fast_shape_ok(obj, _depth=0):
    if _ITER_SCAN_ON:
        return _fast_shape_ok_iter(obj, _depth)
    return _fast_shape_ok_recursive(obj, _depth)


class FastJsonEncodeShim(object):
    def __init__(self, real):
        self._real = real

    def __getattr__(self, name):
        return getattr(self._real, name)

    def encode(self, obj, unpicklable=True, **kw):
        # unpicklable 缺省与真 jsonpickle 一致(True);只有显式 False 才可能走快径。
        real_encode = self._real.encode
        if getattr(real_encode, "_horosa_fast_global", False):
            return real_encode(obj, unpicklable=unpicklable, **kw)   # 进程级快径已装:同判据只跑一遍
        return _fast_or_real(obj, unpicklable, kw, lambda: real_encode(obj, unpicklable=unpicklable, **kw))


def _fast_or_real(obj, unpicklable, kw, real_call):
    if _FAST_JSON_ON and unpicklable is False and not kw:
        if _fast_shape_ok(obj):
            try:
                out = json.dumps(obj, default=_fast_default)
                STATS["fast"] += 1
                return out
            except (TypeError, ValueError):
                pass
        STATS["fallback"] += 1
    return real_call()


def install(jsonpickle_module):
    """把真 jsonpickle 包成快径 shim(已包过则原样返回)。"""
    if isinstance(jsonpickle_module, FastJsonEncodeShim):
        return jsonpickle_module
    return FastJsonEncodeShim(jsonpickle_module)


def install_global(jsonpickle_module):
    """[R5 P0-3] 进程级:把真 jsonpickle 模块的 encode 换成快径版(同判据、同回退);幂等。
    只收显式 unpicklable=False 且无其它参数的调用,其余原样交原 encode。返回是否本次装上。"""
    if not (_FAST_JSON_ON and _FAST_JSON_GLOBAL_ON):
        return False
    orig = getattr(jsonpickle_module, "encode", None)
    if orig is None or getattr(orig, "_horosa_fast_global", False):
        return False

    def encode(value, unpicklable=True, *args, **kwargs):
        if args:
            return orig(value, unpicklable, *args, **kwargs)
        return _fast_or_real(value, unpicklable, kwargs, lambda: orig(value, unpicklable, **kwargs))

    encode._horosa_fast_global = True
    encode._horosa_orig = orig
    jsonpickle_module.encode = encode
    return True


def original_encode(jsonpickle_module):
    """取未经快径包装的 jsonpickle.encode(对拍 / 测试用)。"""
    real = getattr(jsonpickle_module, "_real", jsonpickle_module)
    enc = real.encode
    return getattr(enc, "_horosa_orig", enc)
