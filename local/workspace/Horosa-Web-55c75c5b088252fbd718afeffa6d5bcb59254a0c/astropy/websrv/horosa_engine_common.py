"""websrv 适配层共用的小工具(单一来源):参数强转、文本清洗、JSON 化、繁→简显示替换、盘面快照。

使用方:策天 / 地占直接导入;kentang/kinastro_common 从这里取不依赖 display_text 的那一批;
各卜类适配器的 `_to_int` / `_clean_text` / `_json_safe` / `_format_value` / `_row` /
`_build_snapshot` / `_with_seed` 也以 `import … as 原名` 从这里取。本模块无副作用。
"""

import random
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from numbers import Integral, Real

from astrostudy.civil_calendar import (
    CivilDateTime, civil_datetime, civil_ymd_valid, display_year, format_display_date, parse_civil_date,
    stdlib_datetime_ok,
)

try:
    from zhconv import convert as zh_convert
except Exception:
    zh_convert = None


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
    if isinstance(value, (datetime, date, CivilDateTime)):
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


def plain_json_safe(value):
    """卜类适配器的 JSON 化:只处理 dict / list / tuple / 数值 / 带 .item() 的标量,
    其它原样返回(不像 json_safe 那样转日期、dataclass、set)。"""
    if isinstance(value, dict):
        return {clean_text(key): plain_json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain_json_safe(item) for item in value]
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        return float(value)
    if hasattr(value, "item"):
        try:
            return plain_json_safe(value.item())
        except Exception:
            return clean_text(value)
    return value


def plain_format_value(value):
    """卜类适配器的行内取值:dict 拼「键：值；」、list 拼「、」,不做繁→简替换(与 format_value 不同)。"""
    if value is None or value == "":
        return ""
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            text = plain_format_value(val)
            if text:
                parts.append(f"{key}：{text}")
        return "；".join(parts)
    if isinstance(value, list):
        return "、".join([plain_format_value(item) for item in value if plain_format_value(item)])
    return clean_text(value)


def plain_row(label, value):
    return {"label": label, "value": plain_format_value(value) or "—"}


def with_seed(seed, func):
    """以固定种子跑 func,结束后把全局 random 状态还原。"""
    state = random.getstate()
    try:
        random.seed(seed)
        return func()
    finally:
        random.setstate(state)


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
    "兌": "兑",
    "鐵": "铁",
    "財": "财",
    "遷": "迁",
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
ParsedDT = CivilDateTime


def require_civil_ymd(year, month, day):
    """卜类后端入口的日期存在性判据(单源 civil_ymd_valid):2 月 30 日、1582-10-05..14 改历缺口、公元 0 年
    报错,绝不按别的日子起盘。年份历史纪年(公元前为负)。返回原样 (年, 月, 日)。"""
    if not civil_ymd_valid(year, month, day):
        try:
            label = format_display_date(year, month, day)
        except (TypeError, ValueError):
            label = '{0}-{1}-{2}'.format(year, month, day)
        raise ValueError('日期不存在: {0}(1582-10-05 至 10-14 为改历缺口;历史纪年没有公元 0 年)'.format(label))
    return int(year), int(month), int(day)


def parse_datetime_fields(data):
    """请求体 → (年, 月, 日, 时, 分, 秒);年为历史纪年(公元前为负、无 0 年)。kinastro / 卜类后端共用的唯一解析入口。
    - date 经 civil_calendar.parse_civil_date:'-0300-03-10' / '-300/3/10' / '0050-06-01' / '12000-01-01' 都认;
      ad=-1 搭配不带负号的年 = 公元前该年(与起盘入参 ad 同义);date 可带时刻尾巴('YYYY-MM-DD HH:MM[:SS]')。
    - date 缺失 / 认不出时才读 year / month / day / hour / minute / second 字段;两者都没有 → ValueError(缺日期),
      绝不拿写死的年份充数(旧实现回落 2025:只给公元前 date 的调用方静默得到 2025 年的盘)。
    - 月 / 日 / 时 / 分 / 秒越界钳到合法域(与旧实现同)。"""
    date_text = clean_text(data.get("date"))
    time_text = clean_text(data.get("time"))
    y = m = d = None
    if date_text:
        try:
            ay, m, d = parse_civil_date(date_text, to_int(data.get("ad"), 1))
            y = display_year(ay)
        except Exception:
            y = None
        if not time_text and len(date_text.split()) > 1:
            time_text = date_text.split()[1]
    hh = mm = ss = 0
    if time_text:
        tp = time_text.split(":")
        try:
            hh = int(tp[0]) if len(tp) > 0 and tp[0] != "" else 0
            mm = int(tp[1]) if len(tp) > 1 else 0
            ss = int(float(tp[2])) if len(tp) > 2 and tp[2] != "" else 0
        except Exception:
            hh = mm = ss = 0
    if y is None:
        y = to_int(data.get("year"), None)
        if y is None or y == 0:
            raise ValueError("缺少日期(date 或 year)")
        m = to_int(data.get("month"), 1)
        d = to_int(data.get("day"), 1)
        hh = to_int(data.get("hour"), hh)
        mm = to_int(data.get("minute"), mm)
        ss = to_int(data.get("second"), ss)
    return (y, max(1, min(12, m)), max(1, min(31, d)),
            max(0, min(23, hh)), max(0, min(59, mm)), max(0, min(59, ss)))


def parse_datetime(data):
    """请求体 → 时刻承载(解析单源 parse_datetime_fields,承载单源 civil_calendar.civil_datetime):
    1582-10-15 ~ 9999 年是 stdlib datetime(与旧实现逐位相同);更早(含 1582 年以前的儒略闰日 1500-02-29)
    与公元前 / 万年以后是 CivilDateTime。日期不存在(2 月 30 日、1582-10-10)→ ValueError,绝不改日充数。"""
    y, m, d, hh, mm, ss = parse_datetime_fields(data)
    return civil_datetime(y, m, d, hh, mm, ss)


_DAY_BOUNDARY_KEYS = ("after23NewDay", "lateZiHourUseNextDay")


def _switch01(value):
    """开关值形归一(与前端 dayBoundaryResolve 同口径):1 / '1' / True / 'true' → 1;0 / '0' / False / 'false' → 0;
    其余(缺键 / 空串 / 认不出)→ None。其它整数按真假(与旧 to_int 后按真假判同义)。"""
    if value is True or value is False:
        return 1 if value else 0
    if isinstance(value, Integral):
        return 1 if value else 0
    text = clean_text(value).lower()
    if text in ("1", "true", "yes", "on"):
        return 1
    if text in ("0", "false", "no", "off"):
        return 0
    try:
        return 1 if int(text) else 0
    except Exception:
        return None


def day_boundary_of(data):
    """请求体 → 日界两键(单一来源)。
    页面 / 无头 / AI 挂载构请求时一律经前端 chartDayBoundary 带齐两键(缺键取用户全局设置);
    后端缺键(外部 REST 直调只给日期)才按出厂缺省 1 / 1(23 点换日、晚子时时干用次日),并在 defaulted 里点名,
    由 annotate_day_boundary 写进回包,绝不静默。字符串 '0' 一律按 0(旧写法 data.get(键, 1) 原样交给引擎,'0' 被当真)。"""
    d = data or {}
    out = {"defaulted": []}
    for key in _DAY_BOUNDARY_KEYS:
        v = _switch01(d.get(key))
        if v is None:
            out["defaulted"].append(key)
            v = 1
        out[key] = v
    return out


DAY_BOUNDARY_LABELS = {
    "after23NewDay": {1: "23 点换日", 0: "24 点换日"},
    "lateZiHourUseNextDay": {1: "晚子时时干用次日", 0: "晚子时时干用当日"},
}


def day_boundary_note(info):
    """日界口径说明(回包 / 盘面行):『23 点换日 · 晚子时时干用次日』,缺键的注明按出厂缺省。"""
    parts = [DAY_BOUNDARY_LABELS[k][info[k]] for k in _DAY_BOUNDARY_KEYS]
    text = " · ".join(parts)
    if info.get("defaulted"):
        text += "(请求未带日界设置,按出厂缺省)"
    return text


def annotate_day_boundary(pan, info):
    """把本次所用日界口径写进回包:pan['dayBoundary'] 恒有;缺键按出厂缺省时在第一节加一行「日界口径」(随快照进 AI)。
    在 sections 建好之后、snapshot 之前调用。"""
    pan["dayBoundary"] = dict(info, note=day_boundary_note(info))
    if info.get("defaulted"):
        sections = pan.get("sections") or []
        if sections and isinstance(sections[0].get("rows"), list):
            sections[0]["rows"].append(row("日界口径", pan["dayBoundary"]["note"]))
    return pan


def gender_cn(value, default="男"):
    text = clean_text(value)
    if text in ("0", "2", "女", "female", "F", "f"):
        return "女"
    if text in ("1", "男", "male", "M", "m"):
        return "男"
    return default


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


def build_snapshot(pan):
    lines = []
    for section in pan.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for item in section.get("rows", []):
            lines.append(f"{item.get('label')}：{item.get('value')}")
        lines.append("")
    return "\n".join(lines).strip()
