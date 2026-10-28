"""Shared helpers for Horosa kinastro-backed adapters."""

import os
import sys

import swisseph

from astrostudy.civil_calendar import (  # noqa: F401  civil_ymd_valid / CivilDateTime 由各 kinastro 适配器经本模块导入
    CivilDateTime,
    astro_year,
    civil_datetime,
    civil_julday_display,
    civil_revjul,
    civil_ymd_valid,
    display_year,
    format_civil_date,
)

# 与适配层通用工具同一来源(本模块只自留依赖 display_text / 全域时间承载 / vendor 路径的那部分)。
from websrv.horosa_engine_common import (  # noqa: F401  下列名字由各 kinastro 适配器经本模块导入
    DISPLAY_REPLACEMENTS,
    annotate_day_boundary,
    day_boundary_of,
    build_snapshot,
    clean_text,
    coord_to_float,
    gender_cn,
    json_safe,
    parse_datetime_fields,
    timezone_to_float,
    to_float,
    to_int,
)

try:
    from zhconv import convert as zh_convert
except Exception:
    zh_convert = None

# 桌面 runtime 不打包 streamlit(UI 框架,≈330MB 依赖树;排盘计算零调用)。
# kinastro vendor 模块顶层 `import streamlit`,计算路径只用 @st.cache_data 装饰器。
# 此处在 sys.modules 预注入兼容桩(vendor 文件零改,本模块是全部 kentang adapter
# 的公共入口、且在 vendor import 之前加载):cache_data 退化为透传装饰器,其余
# 属性 no-op。开发机装有 streamlit 时真包优先,行为不变。
# 配套哨兵:astropy/tests/test_runtime_deps_slim.py + 打包脚本 kentang import gate。
def _ensure_streamlit_stub():
    try:
        import streamlit  # noqa: F401  真包在场,无需桩
        return
    except ImportError:
        pass
    import types

    def _cache_data(*args, **_kwargs):
        if args and callable(args[0]) and not _kwargs:
            return args[0]  # 裸 @st.cache_data 直接装饰形态

        def _wrap(fn):
            return fn
        return _wrap

    class _StubModule(types.ModuleType):
        def __getattr__(self, _name):
            # stub_dunder_guard_v1:dunder(双下划线)探测一律按「属性不存在」拒答,
            # 绝不能返回函数。此前对任意属性返回 _noop 函数,导致 __file__ 也拿到函数:
            # inspect.getmodule() 会遍历 sys.modules 逐个读模块 __file__(期望 str),
            # 真 astropy(PyPI 天文库,kintaiyi 太乙引擎的依赖)导入期恰好走这条内省 →
            # 桩在场时 `filename.endswith` 炸 AttributeError → kintaiyi 导入永久失败,
            # CherryPy 把 AttributeError 当「无此路由」→ /taiyi/pan 整进程静默 404
            # (v3.2.0 太乙事故的真实根因;七政/玄学史预热先注入桩、太乙首点必在其后,
            # 故瘦身发货包必现)。dunder 拒答后 hasattr(stub,'__file__')=False,
            # inspect/pickle/copy 等标准内省安全跳过;vendor 计算路径只用具名属性
            # (st.cache_data/st.warning 等),桩语义不变。
            if _name.startswith("__") and _name.endswith("__"):
                raise AttributeError(_name)

            def _noop(*_args, **_kw):
                return None
            return _noop

    stub = _StubModule("streamlit")
    stub.__horosa_slim_stub__ = True  # 哨兵测试据此区分桩与真包
    stub.cache_data = _cache_data
    stub.cache_resource = _cache_data
    components = _StubModule("streamlit.components")
    v1 = _StubModule("streamlit.components.v1")
    # 子桩同带哨兵标记(显式实例属性,不经 __getattr__,dunder 拒答不影响读取)。
    components.__horosa_slim_stub__ = True
    v1.__horosa_slim_stub__ = True
    stub.components = components
    components.v1 = v1
    sys.modules["streamlit"] = stub
    sys.modules["streamlit.components"] = components
    sys.modules["streamlit.components.v1"] = v1


_ensure_streamlit_stub()


CUR_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_ROOT_DIR = os.path.abspath(os.path.join(CUR_DIR, "..", "..", ".."))  # 路径常量(非环境开关)
KINASTRO_SRC = os.path.join(WEB_ROOT_DIR, "vendor", "kinastro")


def ensure_kinastro_path():
    if KINASTRO_SRC not in sys.path:
        sys.path.insert(0, KINASTRO_SRC)


# horosa_display_trans_v1:DISPLAY_REPLACEMENTS
# 全部 1字→1字 ⇒ 逐项 str.replace(每字符串 ~125 次全串遍历)可无损换成**单遍** C 级
# str.translate。等价条件:
#   ① 全键值单字符 —— _DISPLAY_TRANS_OK 在 import 时机械核验;未来有人混入多字符项,
#     自动整体退回旧循环(双保险,勿删);
#   ② 无链式替换(某项的**值**又是另一项的**键**)—— 键全繁体、值全简体;
#     astropy/tests/test_perf_r5_batch3.py 以不变量断言钉死,改表破坏该性质会立即红。
# 热路径:display_safe 递归清洗整棵 vendor 载荷,20 个 kentang 技法逐响应过这里。
# kill:HOROSA_DISPLAY_TRANS=0 ⇒ 旧循环路径,逐字节旧行为。
_DISPLAY_TRANS_ON = os.environ.get("HOROSA_DISPLAY_TRANS", "1").lower() not in ("0", "false", "no", "off")
_DISPLAY_TRANS_OK = all(len(k) == 1 and len(v) == 1 for k, v in DISPLAY_REPLACEMENTS.items())
_DISPLAY_TRANS = str.maketrans(DISPLAY_REPLACEMENTS) if _DISPLAY_TRANS_OK else None


def display_text(value):
    text = clean_text(value)
    if _DISPLAY_TRANS_ON and _DISPLAY_TRANS is not None:
        text = text.translate(_DISPLAY_TRANS)
    else:
        for old, new in DISPLAY_REPLACEMENTS.items():
            text = text.replace(old, new)
    if zh_convert:
        try:
            text = zh_convert(text, "zh-cn")
        except Exception:
            pass
    return text.replace("None", "无")


SOURCE_REPLACEMENTS = {new: old for old, new in DISPLAY_REPLACEMENTS.items() if old != new}
# 同前提同证明(逆映射同为 1:1 单字符;金标同文件覆盖)。
_SOURCE_TRANS = str.maketrans(SOURCE_REPLACEMENTS) if _DISPLAY_TRANS_OK else None


def source_text(value):
    """Convert UI-friendly simplified text back to kinastro source text when needed."""
    text = clean_text(value)
    if zh_convert:
        try:
            text = zh_convert(text, "zh-tw")
        except Exception:
            pass
    if _DISPLAY_TRANS_ON and _SOURCE_TRANS is not None:
        return text.translate(_SOURCE_TRANS)
    for old, new in SOURCE_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def display_safe(value):
    """Recursively normalize vendor text for Horosa UI display."""
    if isinstance(value, dict):
        return {display_text(key): display_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [display_safe(item) for item in value]
    if isinstance(value, str):
        return display_text(value)
    return json_safe(value)


def format_value(value):
    if value is None or value == "":
        return ""
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            text = format_value(val)
            if text:
                parts.append(f"{display_text(key)}：{text}")
        return "；".join(parts)
    if isinstance(value, (list, tuple, set)):
        return "、".join([format_value(item) for item in value if format_value(item)])
    if isinstance(value, bool):
        return "是" if value else "否"
    return display_text(value)


def row(label, value, extra=None):
    item = {"label": label, "value": format_value(value) or "—"}
    if extra:
        item.update(extra)
    return item


# 全年份域时刻承载 = astrostudy.civil_calendar.CivilDateTime(单一来源;旧名保留给既有导入方)。
ExtremeDateTime = CivilDateTime


def parse_datetime(data):
    """与卜类后端同一入口:解析 = horosa_engine_common.parse_datetime_fields(公元前 '-Y-MM-DD'、ad=-1、1~5 位年;
    缺日期报错,不回落写死年份);承载 = civil_calendar.civil_datetime(1582-10-15 ~ 9999 年 stdlib datetime,
    其余 CivilDateTime;不存在的日期报错,绝不改成当月 1 日)。"""
    year, month, day, hour, minute, second = parse_datetime_fields(data)
    return civil_datetime(year, month, day, hour, minute, second)


# ── vendor 引擎的历法换算(单一入口)──────────────────────────────────────────────
# 部分 vendor 引擎(如七政)拿到年月日后自己调 swe.julday,不带历法参数 = 恒按外推格里历 + 天文年读;
# 而用户日期按全站口径是民用历(1582-10-15 以前儒略历、历史纪年)。原样交进去,1582 年以前差 10 天起。
# 适配层喂这类引擎前一律经 vendor_greg_ymd 换成「同一天的格里历年月日」(vendor 源码不动、可整包替换);
# 引擎回写的日期(格里历)经 vendor_civil_ymd / vendor_civil_date 换回民用历再显示。
# 1582-10-15 以后两者都是恒等(同一组整数),结果逐位不变。静态守卫:tests/test_civil_calendar_guard.py。

def vendor_greg_ymd(year, month, day, add_days=0):
    """民用日期(历史纪年)+ 偏移天数 → 同一天的外推格里历 (天文年, 月, 日),交给按格里历读日期的 vendor 引擎。"""
    jd0 = civil_julday_display(year, month, day, 0.0) + int(add_days)
    gy, gm, gd, _h = swisseph.revjul(jd0, swisseph.GREG_CAL)
    return int(gy), int(gm), int(gd)


def vendor_civil_ymd(greg_year, greg_month, greg_day):
    """vendor 引擎回写的外推格里历 (天文年, 月, 日) → 民用 (历史纪年, 月, 日)。"""
    jd_noon = swisseph.julday(int(greg_year), int(greg_month), int(greg_day), 12.0, swisseph.GREG_CAL)
    y, m, d, _h = civil_revjul(jd_noon)
    return display_year(y), int(m), int(d)


def vendor_civil_date(text):
    """vendor 引擎回写的格里历日期串('1500-01-10' / '-299-07-05',天文年)→ 民用日期串(与 format_civil_date 同形)。
    读不出的原样返回。"""
    raw = clean_text(text)
    if not raw:
        return text
    head = raw.split(" ")[0]
    neg = head.startswith("-")
    parts = head.lstrip("-").split("-")
    try:
        gy, gm, gd = int(parts[0]), int(parts[1]), int(parts[2])
    except Exception:
        return text
    y, m, d = vendor_civil_ymd(-gy if neg else gy, gm, gd)
    out = format_civil_date(astro_year(y), m, d)
    return out + raw[len(head):]


def gender_mf(value, default="M"):
    return "F" if gender_cn(value, "男") == "女" else "M"


GANZHI_STEMS = "甲乙丙丁戊己庚辛壬癸"
GANZHI_BRANCHES = "子丑寅卯辰巳午未申酉戌亥"


def normalize_ganzhi(value, fallback):
    """两字干支(天干 + 地支)原样返回,其余一律回 fallback。"""
    text = clean_text(value)
    if len(text) == 2 and text[0] in GANZHI_STEMS and text[1] in GANZHI_BRANCHES:
        return text
    return fallback


def authoritative_pillars(dt, data=None):
    """标准四柱的单一权威口径。

    🔴 铁律(用户拍板):凡展示标准「年柱/月柱/日柱/时柱」的技法,四柱必等于全局权威
    extreme_pillars —— 天文年立春界(公历 1/2 月且未过立春归上一年)、定气月、儒略 JDN
    (全域含 BC)。各 vendor 引擎自带的简化换算没有立春界,于是「2026-01-15 的年柱」
    会算成丙午而非乙巳;远古/BC 年更是整片偏数十日。

    日界(23 点是否进次日)与晚子时(时干取次日)语义随参数透传,不因换权威而丢失;
    月柱要用真太阳黄经定气,故时区也一并传入。取不到权威实现时返回 None ——
    由调用方保留各自旧值,不让整张盘失败 —— 调用方须把「未取到权威四柱」记进回包 partialErrors(不静默顶替)。
    """
    d = data or {}
    db = day_boundary_of(d)   # 日界单源:缺键按出厂缺省,并由调用方经 annotate_day_boundary 写进回包
    try:
        from kin_year_domain import extreme_pillars
    except Exception:
        return None
    try:
        y, m, dd, h, _zi = extreme_pillars(
            dt.year, dt.month, dt.day, dt.hour, getattr(dt, "minute", 0) or 0,
            after23=db["after23NewDay"],
            hour_gan_next=db["lateZiHourUseNextDay"],
            zone_hours=timezone_to_float(d.get("zone"), 8.0),
        )
    except Exception:
        return None
    if not (y and m and dd and h):
        return None
    return {"year": y, "month": m, "day": dd, "hour": h}


def read_vendor_text(filename, fallback=""):
    path = os.path.join(KINASTRO_SRC, filename)
    if not os.path.isfile(path):
        return fallback
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read().strip()
    return content or fallback


def kinastro_source_sections(system_name, description):
    return {
        "meta": [{
            "key": "kinastro",
            "title": f"kinastro / {system_name}",
            "author": "kentang2017",
            "description": description,
        }],
        "selectedKey": "kinastro",
        "sections": [
            {"title": "来源说明", "content": description},
            {"title": "项目归属", "content": "计算核心来自 kentang2017/kinastro。星阙仅保留本页面技法需要的输入、计算结果与可读断语，不展示上游工程配置或依赖清单。"},
            {"title": "授权", "content": "上游项目 pyproject.toml 标注 MIT License；第三方贡献已在星阙第三方声明中按 kentang2017/kinastro 记录。"},
        ],
        "links": [
            {
                "name": "kinastro",
                "url": "https://github.com/kentang2017/kinastro",
                "description": "kentang2017 多体系占星排盘项目。",
            },
        ],
    }
