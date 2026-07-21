"""Shared helpers for Horosa kinastro-backed adapters."""

import os
import sys
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from numbers import Integral, Real

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
HOROSA_WEB_ROOT = os.path.abspath(os.path.join(CUR_DIR, "..", "..", ".."))
KINASTRO_SRC = os.path.join(HOROSA_WEB_ROOT, "vendor", "kinastro")


def ensure_kinastro_path():
    if KINASTRO_SRC not in sys.path:
        sys.path.insert(0, KINASTRO_SRC)


def to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def to_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def clean_text(value, default=""):
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if is_dataclass(value):
        return json_safe(asdict(value))
    if isinstance(value, dict):
        return {clean_text(key): json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        return float(value)
    if hasattr(value, "item"):
        try:
            return json_safe(value.item())
        except Exception:
            return clean_text(value)
    return value


DISPLAY_REPLACEMENTS = {
    "萬": "万",
    "數": "数",
    "條": "条",
    "鑰": "钥",
    "體": "体",
    "傳": "传",
    "陰": "阴",
    "陽": "阳",
    "宮": "宫",
    "時": "时",
    "節": "节",
    "曆": "历",
    "歲": "岁",
    "貴": "贵",
    "賤": "贱",
    "祿": "禄",
    "權": "权",
    "庫": "库",
    "壽": "寿",
    "屬": "属",
    "點": "点",
    "後": "后",
    "運": "运",
    "順": "顺",
    "逆": "逆",
    "極": "极",
    "碼": "码",
    "圖": "图",
    "評": "评",
    "斷": "断",
    "靈": "灵",
    "應": "应",
    "對": "对",
    "請": "请",
    "異": "异",
    "滿": "满",
    "執": "执",
    "開": "开",
    "閉": "闭",
    "張": "张",
    "翌": "翼",
    "軫": "轸",
    "婁": "娄",
    "畢": "毕",
    "龍": "龙",
    "馬": "马",
    "雞": "鸡",
    "豬": "猪",
    "離": "离",
    "虛": "虚",
    "飛": "飞",
    "啗": "啖",
    "戰": "战",
    "體": "体",
    "兌": "兑",
    "鐵": "铁",
    "財": "财",
    "遷": "迁",
    "祿": "禄",
    "雙": "双",
    "總": "总",
    "計": "计",
    "親": "亲",
    "姊": "姐",
    "參": "参",
    "來": "来",
    "無": "无",
    "鳥": "鸟",
    "風": "风",
    "黃": "黄",
    "鵲": "鹊",
    "聲": "声",
    "書": "书",
    "過": "过",
    "機": "机",
    "傷": "伤",
    "種": "种",
    "結": "结",
    "發": "发",
    "記": "记",
    "講": "讲",
    "間": "间",
    "內": "内",
    "尋": "寻",
    "單": "单",
    "榮": "荣",
    "華": "华",
    "興": "兴",
    "緣": "缘",
    "為": "为",
    "鮮": "鲜",
    "歸": "归",
    "飄": "飘",
    "別": "别",
    "丟": "丢",
    "喪": "丧",
    "該": "该",
    "讓": "让",
    "選": "选",
    "變": "变",
    "關": "关",
    "難": "难",
    "羅": "罗",
    "氣": "气",
    "業": "业",
    "強": "强",
    "門": "门",
    "澤": "泽",
    "綿": "绵",
    "職": "职",
    "邊": "边",
    "豐": "丰",
    "凜": "凛",
    "聖": "圣",
    "學": "学",
    "類": "类",
    "婦": "妇",
    "兒": "儿",
    "樂": "乐",
    "罷": "罢",
    "鄉": "乡",
    "輩": "辈",
    "顯": "显",
    "賢": "贤",
    "國": "国",
    "紅": "红",
    "綠": "绿",
    "廟": "庙",
    "剋": "克",
}


def display_text(value):
    text = clean_text(value)
    for old, new in DISPLAY_REPLACEMENTS.items():
        text = text.replace(old, new)
    if zh_convert:
        try:
            text = zh_convert(text, "zh-cn")
        except Exception:
            pass
    return text.replace("None", "无")


SOURCE_REPLACEMENTS = {new: old for old, new in DISPLAY_REPLACEMENTS.items() if old != new}


def source_text(value):
    """Convert UI-friendly simplified text back to kinastro source text when needed."""
    text = clean_text(value)
    if zh_convert:
        try:
            text = zh_convert(text, "zh-tw")
        except Exception:
            pass
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


class ExtremeDateTime:
    """全年份域轻量时间承载(stdlib datetime 域限 1~9999;BC/万年后用本类)。

    只承诺 kinastro 系 srv 实际消费面:year/month/day/hour/minute/second 属性 +
    strftime(%Y/%m/%d/%H/%M/%S,%Y 带符号原样)。域内仍返 stdlib datetime,行为零变。
    """

    def __init__(self, year, month, day, hour=0, minute=0, second=0):
        self.year = year
        self.month = month
        self.day = day
        self.hour = hour
        self.minute = minute
        self.second = second

    def strftime(self, fmt):
        out = fmt.replace("%Y", str(self.year))
        out = out.replace("%m", "%02d" % self.month).replace("%d", "%02d" % self.day)
        out = out.replace("%H", "%02d" % self.hour).replace("%M", "%02d" % self.minute)
        return out.replace("%S", "%02d" % self.second)


def parse_datetime(data):
    date_text = clean_text(data.get("date")).replace("/", "-")
    time_text = clean_text(data.get("time"))
    if date_text:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                source = f"{date_text} {time_text}".strip() if "%H" in fmt else date_text
                return datetime.strptime(source, fmt)
            except Exception:
                pass
    year = to_int(data.get("year"), 2025)
    month = max(1, min(12, to_int(data.get("month"), 1)))
    day = max(1, min(31, to_int(data.get("day"), 1)))
    hour = max(0, min(23, to_int(data.get("hour"), 0)))
    minute = max(0, min(59, to_int(data.get("minute"), 0)))
    second = max(0, min(59, to_int(data.get("second"), 0)))
    if year < 1 or year > 9999:
        # BC/万年后:stdlib datetime 越域,轻量承载(带符号年直传引擎;strftime 面已覆盖)
        return ExtremeDateTime(year, month, day, hour, minute, second)
    try:
        dt = datetime(year, month, day, hour, minute, second)
    except ValueError:
        dt = datetime(year, month, 1, hour, minute, second)
    return dt


def gender_cn(value, default="男"):
    text = clean_text(value)
    if text in ("0", "2", "女", "female", "F", "f"):
        return "女"
    if text in ("1", "男", "male", "M", "m"):
        return "男"
    return default


def gender_mf(value, default="M"):
    return "F" if gender_cn(value, "男") == "女" else "M"


def timezone_to_float(value, default=8.0):
    text = clean_text(value)
    if not text:
        return default
    try:
        return float(text)
    except Exception:
        pass
    text = text.upper().replace("UTC", "").replace("GMT", "").strip()
    if not text:
        return default
    sign = -1 if text.startswith("-") else 1
    text = text.lstrip("+-")
    if ":" in text:
        h, m = text.split(":", 1)
        return sign * (to_float(h, default) + to_float(m, 0) / 60.0)
    return sign * to_float(text, default)


def coord_to_float(value, default=0.0):
    text = clean_text(value)
    if not text:
        return default
    lower = text.lower()
    if not any(mark in lower for mark in ("e", "w", "n", "s", "°", "'", '"')):
        try:
            return float(text)
        except Exception:
            pass
    sign = -1 if ("w" in lower or "s" in lower or lower.startswith("-")) else 1
    for mark in ("e", "w", "n", "s", "°", "d"):
        lower = lower.replace(mark, " ")
    parts = [p for p in lower.replace("'", " ").replace('"', " ").split() if p]
    if not parts:
        return default
    deg = abs(to_float(parts[0], default))
    minute = abs(to_float(parts[1], 0.0)) if len(parts) > 1 else 0.0
    second = abs(to_float(parts[2], 0.0)) if len(parts) > 2 else 0.0
    return sign * (deg + minute / 60.0 + second / 3600.0)


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


def build_snapshot(pan):
    lines = []
    for section in pan.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for item in section.get("rows", []):
            lines.append(f"{item.get('label')}：{item.get('value')}")
        lines.append("")
    return "\n".join(lines).strip()
