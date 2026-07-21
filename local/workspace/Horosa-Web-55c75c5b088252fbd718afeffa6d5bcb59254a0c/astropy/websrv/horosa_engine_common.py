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


class ParsedDT:
    """任意年份的轻量日期时刻承载(stdlib datetime 只到 9999 年,大年/极端年会丢)。
    消费方(策天/春子/分金/北极/七政kin)只读字段与 dateStr/timeStr 兜底 strftime。"""

    __slots__ = ("year", "month", "day", "hour", "minute", "second")

    def __init__(self, year, month, day, hour=0, minute=0, second=0):
        self.year = year
        self.month = month
        self.day = day
        self.hour = hour
        self.minute = minute
        self.second = second

    def strftime(self, fmt):
        return (fmt.replace("%Y", "%04d" % self.year)
                   .replace("%m", "%02d" % self.month)
                   .replace("%d", "%02d" % self.day)
                   .replace("%H", "%02d" % self.hour)
                   .replace("%M", "%02d" % self.minute)
                   .replace("%S", "%02d" % self.second))

    def __repr__(self):
        return "%04d-%02d-%02d %02d:%02d:%02d" % (
            self.year, self.month, self.day, self.hour, self.minute, self.second)


def parse_datetime(data):
    # 手写解析,支持 1~5 位年(strptime 承载 datetime 上限 9999,大年会静默失败,
    # 旧实现随后回落 year=2025 → 用户输入远年得到 2025 的盘,零提示。此处根治)。
    date_text = clean_text(data.get("date")).replace("/", "-")
    time_text = clean_text(data.get("time"))
    y = m = d = None
    if date_text:
        parts = date_text.split("-")
        if len(parts) == 3:
            try:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
            except Exception:
                y = None
    hh = mm = ss = 0
    if time_text:
        tp = time_text.split(":")
        try:
            hh = int(tp[0]) if len(tp) > 0 and tp[0] != "" else 0
            mm = int(tp[1]) if len(tp) > 1 else 0
            ss = int(tp[2]) if len(tp) > 2 else 0
        except Exception:
            hh = mm = ss = 0
    if y is None:
        y = to_int(data.get("year"), 2025)
        m = max(1, min(12, to_int(data.get("month"), 1)))
        d = max(1, min(31, to_int(data.get("day"), 1)))
        hh = max(0, min(23, to_int(data.get("hour"), hh)))
        mm = max(0, min(59, to_int(data.get("minute"), mm)))
        ss = max(0, min(59, to_int(data.get("second"), ss)))
    m = max(1, min(12, m))
    d = max(1, min(31, d))
    hh = max(0, min(23, hh))
    mm = max(0, min(59, mm))
    ss = max(0, min(59, ss))
    # stdlib 域内仍返回真 datetime(下游行为与旧实现逐字节一致);域外用轻量承载。
    if 1 <= y <= 9999:
        try:
            return datetime(y, m, d, hh, mm, ss)
        except ValueError:
            return datetime(y, m, 1, hh, mm, ss)
    return ParsedDT(y, m, d, hh, mm, ss)


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
