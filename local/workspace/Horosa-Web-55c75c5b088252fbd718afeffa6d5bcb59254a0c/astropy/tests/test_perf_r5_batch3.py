# -*- coding: utf-8 -*-
"""kentang 引擎热路径哨兵:奇门 memo 两开关 + kin 系六十甲子常量开关(开关名与 Windows 版相同)。

守的四件事:
  1. 奇门:memo 开/关(进程内翻模块旗标)同参输出逐字节相同,且开时 memo 真命中;
  2. 奇门:越界 option 仍是 None → 调用方 TypeError → 服务层 -1 信封(_select_ju **不给默认值**,
     否则越界请求会从「错误信封」悄悄变成「按拆补出盘」= 功能改变);
  3. kin 系(太乙 / 六壬 / 五兆 / 神易数 / 金口诀 / 分野):copy-return 契约(每次新容器)+ 开/关等值
     —— 每个模块在独立子进程里核(vendor 各包顶层模块同名 config/jieqi,进程内互相顶替);
  4. 静态守卫:pan_sky_minute 永不入 memo(调用方就地 del sky["中"]);kinqimen 共享 jiazi 常量零就地变异。
"""
import json
import os
import re
import subprocess
import sys
import types

import pytest

_VENDOR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "vendor"))
_KINQIMEN_DIR = os.path.join(_VENDOR, "kinqimen")
if _KINQIMEN_DIR not in sys.path:
    sys.path.insert(0, _KINQIMEN_DIR)

try:
    import config as kq_config  # noqa: E402
    import kinqimen as kq  # noqa: E402
    _IMPORT_OK = "kinqimen" in os.path.abspath(kq_config.__file__)
except Exception:  # pragma: no cover
    _IMPORT_OK = False

pytestmark = pytest.mark.skipif(not _IMPORT_OK, reason="vendor/kinqimen 不可导入或被同名模块顶替")

_DTS = [(2026, 5, 15, 0, 12), (1990, 5, 18, 23, 30), (2024, 2, 10, 23, 5), (2000, 1, 1, 12, 0), (1911, 7, 30, 23, 10)]


def _jieqi_mod():
    J = getattr(kq_config, "_memo_host", None)
    assert J is not None and "kinqimen" in os.path.abspath(J.__file__)
    return J


def _set_day_switches(J, after23, hour_next):
    if hasattr(J, "set_after23_new_day"):
        J.set_after23_new_day(after23)
    if hasattr(J, "set_hour_gan_use_next_day"):
        J.set_hour_gan_use_next_day(hour_next)


def _qimen_snapshot(dt, option):
    q = kq.Qimen(*dt)
    out = {
        "pan": q.pan(option),
        "pan_fei": q.pan(option, "飛盤"),
        "gpan": q.gpan(),
        "ypan": q.ypan(),
        "pan_minute": q.pan_minute(option),
        "feipan": q.pan_feipan(option),
    }
    return q, json.dumps(out, ensure_ascii=False, sort_keys=True, default=str)


@pytest.mark.parametrize("after23,hour_next", [(1, 1), (0, 1), (1, 0)])
def test_qimen_memo_on_off_byte_identical_and_hits(monkeypatch, after23, hour_next):
    J = _jieqi_mod()
    _set_day_switches(J, after23, hour_next)
    for dt in _DTS:
        for option in (1, 2, 3, 4):
            # 开:与服务层同序 —— 设完日界开关再 begin(begin 即清)
            monkeypatch.setattr(J, "_REQ_MEMO_ON", True)
            monkeypatch.setattr(kq, "_PAN_MEMO_ENABLED", True)
            J.begin_request_memo()
            q_on, s_on = _qimen_snapshot(dt, option)
            assert q_on._memo and len(q_on._memo) > 0, "实例级 memo 未命中"
            assert len(getattr(J._TLS, "req_memo", {})) > 0, "请求级 memo 未命中"
            # 关:旗标翻 False → begin 拆容器、新实例 _memo=None → 全体直通
            monkeypatch.setattr(J, "_REQ_MEMO_ON", False)
            monkeypatch.setattr(kq, "_PAN_MEMO_ENABLED", False)
            J.begin_request_memo()
            assert getattr(J._TLS, "req_memo", None) is None
            q_off, s_off = _qimen_snapshot(dt, option)
            assert q_off._memo is None
            assert s_on == s_off, "memo 开/关输出不同:%s option=%s" % (dt, option)
    J.end_request_memo()


def test_qimen_req_memo_returns_fresh_containers_and_passes_unhashable():
    J = _jieqi_mod()
    J.begin_request_memo()
    try:
        calls = []

        def _f(*a):
            calls.append(a)
            return [1, 2, 3]

        w = J._req_memo(_f)
        r1 = w(1, 2)
        r2 = w(1, 2)
        assert r1 == r2 and r1 is not r2, "list 出参必须是浅拷贝(每次新容器契约)"
        assert len(calls) == 1, "同键第二次必须命中"
        assert w([9]) == [1, 2, 3] and len(calls) == 2, "不可哈希实参必须直通原函数"
    finally:
        J.end_request_memo()
    assert w(1, 2) == [1, 2, 3] and len(calls) == 3, "end 之后必须直通"


def test_qimen_out_of_range_option_stays_error_path():
    dt = _DTS[1]
    for bad in (0, 5, 9, -1, "x", None):
        assert kq_config._select_ju(bad, *dt) is None
        with pytest.raises(TypeError):
            kq_config.zhifu_pai(*dt, bad)
    for good in (1, 2, 3, 4):
        assert isinstance(kq_config._select_ju(good, *dt), str)


def test_kinqimen_static_guards():
    src = {n: open(os.path.join(_KINQIMEN_DIR, n), encoding="utf-8").read() for n in ("config.py", "jieqi.py", "kinqimen.py")}
    # 4a. pan_sky_minute 永不入 memo(调用方就地 del sky["中"])
    assert "pan_sky_minute = _memo_host._req_memo" not in src["config.py"]
    assert not re.search(r"@_instance_memo\s*\n\s*def pan_sky_minute", src["kinqimen.py"])
    # 4b. _select_ju 的 .get(option) 不许带默认值
    body = src["config.py"].split("def _select_ju(")[1].split("\ndef ")[0]
    code = re.sub(r'"""[\s\S]*?"""', "", body)          # 只看代码,docstring 里的反例不算
    code = "\n".join(l.split("#")[0] for l in code.splitlines())
    assert ".get(option)" in code and ".get(option," not in code
    # 4c. 共享 jiazi 常量:直接或经变量承接后都不许就地变异
    mut = r"\.(append|insert|pop|remove|sort|reverse|extend|clear)\("
    for n, s in src.items():
        assert not re.search(r"jiazi\(\)\s*" + mut, s), n
        for var in set(re.findall(r"^\s*(\w+)\s*=\s*(?:config\.|jieqi\.)?jiazi\(\)\s*$", s, re.M)):
            assert not re.search(r"\b%s\s*%s" % (var, mut), s), (n, var)
            assert not re.search(r"\b%s\s*\[[^\]]*\]\s*=[^=]" % var, s), (n, var)
            assert not re.search(r"\bdel\s+%s\b" % var, s), (n, var)


# ── 3. kin 系 copy-return + 开/关等值(每模块独立子进程,避免顶层同名模块互相顶替)────────
_CHILD = r'''
import sys, json, types
spec = json.loads(sys.argv[1])
sys.path.insert(0, spec["path"])
ns = {}
exec(spec["imp"], ns)
m = ns["m"]
res = {}
for label, expr in spec["checks"]:
    try:
        m._KIN_CONST_ON = True
        a = eval(expr, {"m": m, "types": types}); b = eval(expr, {"m": m, "types": types})
        m._KIN_CONST_ON = False
        c = eval(expr, {"m": m, "types": types})
        m._KIN_CONST_ON = True
        fresh = (a is not b) if isinstance(a, (list, dict)) and not label.endswith("(shared)") else True
        res[label] = {"eq_on": a == b, "fresh": fresh, "eq_off": a == c, "n": len(a) if hasattr(a, "__len__") else None}
    except Exception as e:
        res[label] = {"error": type(e).__name__ + ": " + str(e)[:120]}
print(json.dumps(res))
'''

_KIN_SPECS = [
    {"path": os.path.join(_VENDOR, "kintaiyi", "src"), "imp": "import kintaiyi.config as m",
     "checks": [("jiazi", "m.jiazi()"), ("jiazi_accum", "m.jiazi_accum('甲子')"), ("minutes_jiazi_d", "m.minutes_jiazi_d('甲子')")]},
    {"path": os.path.join(_VENDOR, "kintaiyi", "src"), "imp": "import kintaiyi.jieqi as m",
     "checks": [("jiazi", "m.jiazi()"), ("ke_jiazi_d", "m.ke_jiazi_d('甲子')")]},
    {"path": os.path.join(_VENDOR, "kintaiyi", "src"), "imp": "import kintaiyi.kinliuren as m",
     "checks": [("jiazi", "m.jiazi()"), ("Liuren.jiazi", "m.Liuren.jiazi(types.SimpleNamespace(Gan='甲乙丙丁戊己庚辛壬癸', Zhi='子丑寅卯辰巳午未申酉戌亥'))")]},
    {"path": os.path.join(_VENDOR, "kinwuzhao"), "imp": "import config as m",
     "checks": [("jiazi", "m.jiazi()"), ("minutes_jiazi_d", "m.minutes_jiazi_d('甲子')")]},
    {"path": os.path.join(_VENDOR, "kinwuzhao"), "imp": "import jieqi as m",
     "checks": [("jiazi", "m.jiazi()"), ("ke_jiazi_d", "m.ke_jiazi_d('甲子')"), ("minutes_jiazi_d", "m.minutes_jiazi_d()")]},
    {"path": os.path.join(_VENDOR, "shenyishu"), "imp": "import shenyishu as m", "checks": [("jiazi", "m.jiazi()")]},
    {"path": os.path.join(_VENDOR, "kinjinkou"), "imp": "from kinjinkou.jinkoujue import jinkoujue_api as m", "checks": [("jiazi", "m.jiazi()")]},
    {"path": os.path.join(_VENDOR, "kinastro"), "imp": "from astro.fendjing import fendjing_calculator as m",
     "checks": [("_jiazi_seq(shared)", "m._jiazi_seq()"), ("_find_lunar_month", "m._find_lunar_month('甲子')"), ("_find_lunar_hour", "m._find_lunar_hour('甲子')")]},
]


@pytest.mark.parametrize("spec", _KIN_SPECS, ids=[s["imp"].split()[-1] if s["imp"].startswith("import") else s["imp"].split()[-1] for s in _KIN_SPECS])
def test_kin_jiazi_const_copy_return_and_switch_equivalence(spec):
    env = dict(os.environ, PYTHONNOUSERSITE="1", HOROSA_KIN_JIAZI_CONST="1")
    r = subprocess.run([sys.executable, "-c", _CHILD, json.dumps(spec)], capture_output=True, text=True, env=env, timeout=120)
    assert r.returncode == 0, r.stderr[-800:]
    res = json.loads(r.stdout.strip().splitlines()[-1])
    for label, v in res.items():
        assert "error" not in v, (label, v)
        assert v["eq_on"] and v["fresh"] and v["eq_off"], (label, v)
        assert v["n"] in (None,) or v["n"] > 0, (label, v)


# ── 组 B:kentang 显示层单遍翻译 + 印占瑜伽有序遍历 ─────────────────────────────────────
_ASTROPY_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ASTROPY_ROOT not in sys.path:
    sys.path.insert(0, _ASTROPY_ROOT)


def _kinastro_common():
    from websrv.kentang import kinastro_common as K
    return K


def test_display_translate_table_invariants():
    """translate 与逐项 replace 等价的两个前提:全 1 字→1 字;无链式(某项的值又是另一项的键)。"""
    K = _kinastro_common()
    D = K.DISPLAY_REPLACEMENTS
    assert D and all(len(k) == 1 and len(v) == 1 for k, v in D.items())
    assert not any(v in D for k, v in D.items() if v != k), "出现链式替换:逐项 replace 会二次替换而 translate 不会"
    assert K._DISPLAY_TRANS_OK and K._DISPLAY_TRANS is not None and K._SOURCE_TRANS is not None


def test_display_translate_equals_loop_on_real_payload_strings(monkeypatch):
    K = _kinastro_common()
    D = K.DISPLAY_REPLACEMENTS
    corpus = ["".join(D.keys()), "".join(D.values()), "乾坤震巽坎離艮兌 甲子 值符 天蓬 開門 休門 None 陽遁一局上元",
              "太乙 文昌 始擊 主算 客算 定目 計神 直符 阴阳 日曆 時辰 亥時 甲寅 x_y", "", "abc123", "無中生有"]
    # 再拿一批真实产出:全部 vendor 服务的显示前字符串太散,用替换表键值的两两组合模拟最坏交叉
    keys = list(D.keys())
    for i in range(0, len(keys) - 1, 7):
        corpus.append(keys[i] + D[keys[i]] + keys[i + 1] + D[keys[i + 1]])

    def _loop_display(text):
        for old, new in D.items():
            text = text.replace(old, new)
        return text

    def _loop_source(text):
        for old, new in K.SOURCE_REPLACEMENTS.items():
            text = text.replace(old, new)
        return text

    for s in corpus:
        assert s.translate(K._DISPLAY_TRANS) == _loop_display(s), repr(s)
        assert s.translate(K._SOURCE_TRANS) == _loop_source(s), repr(s)
    # 端到端:开关开 / 关(旗标翻转)输出逐字节相同
    for s in corpus:
        monkeypatch.setattr(K, "_DISPLAY_TRANS_ON", True)
        on = (K.display_text(s), K.source_text(s))
        monkeypatch.setattr(K, "_DISPLAY_TRANS_ON", False)
        off = (K.display_text(s), K.source_text(s))
        assert on == off, repr(s)


_YOGA_CHILD = r'''
import sys, json, os
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, os.path.join(sys.argv[1], "..", "flatlib-ctrad2"))
from astrostudy.india import yoga_engine as Y
src = open(Y.__file__, encoding="utf-8").read()
print(json.dumps({"benefics": sorted(Y.NATURAL_BENEFICS), "malefics": sorted(Y.NATURAL_MALEFICS),
                  "classical": list(Y.CLASSICAL_PLANETS), "yoga_planets": list(Y.YOGA_PLANETS)}))
'''


def test_yoga_engine_never_iterates_natural_sets_directly():
    """遍历 set 会继承进程哈希序 → 同一张盘跨进程 yogas[].planets / 文案顺序漂移。改为遍历有序列表再按集合过滤。"""
    path = os.path.join(_ASTROPY_ROOT, "astrostudy", "india", "yoga_engine.py")
    src = open(path, encoding="utf-8").read()
    assert not re.search(r"for\s+\w+\s+in\s+NATURAL_(MALEFICS|BENEFICS)\b", src), "直接遍历 set(顺序不确定)"
    assert not re.search(r"\[\s*p\s+for\s+p\s+in\s+NATURAL_(MALEFICS|BENEFICS)\b", src), "推导式直接遍历 set"
    # 两个不同哈希种子的进程看到的集合成员一致、有序列表一致(顺序来源已是列表)
    outs = []
    for seed in ("1", "42"):
        env = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONHASHSEED=seed)
        r = subprocess.run([sys.executable, "-c", _YOGA_CHILD, _ASTROPY_ROOT], capture_output=True, text=True, env=env, timeout=120)
        assert r.returncode == 0, r.stderr[-600:]
        outs.append(json.loads(r.stdout.strip().splitlines()[-1]))
    assert outs[0] == outs[1]
    assert set(outs[0]["benefics"]) <= set(outs[0]["classical"])
    assert set(outs[0]["malefics"]) <= set(outs[0]["yoga_planets"])
