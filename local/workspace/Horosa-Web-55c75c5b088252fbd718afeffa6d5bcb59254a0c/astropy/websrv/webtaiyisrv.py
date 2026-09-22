import os
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_KINTAIYI_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "kintaiyi", "src")
if os.path.isdir(os.path.join(_KINTAIYI_SRC, "kintaiyi")) and _KINTAIYI_SRC not in sys.path:
    sys.path.insert(0, _KINTAIYI_SRC)

from kintaiyi.kintaiyi import Taiyi  # noqa: E402


NUM_TO_GONG = {
    1: "乾",
    2: "午",
    3: "艮",
    4: "卯",
    5: "中",
    6: "酉",
    7: "坤",
    8: "子",
    9: "巽",
}

GONG16_ORDER = list("子丑艮寅卯辰巽巳午未坤申酉戌乾亥")
DI_ZHI = list("子丑寅卯辰巳午未申酉戌亥")
BRANCH_ALIAS = {"巽": "辰", "坤": "申", "艮": "丑", "乾": "亥"}
METHOD_SOURCES = {
    0: "《太乙統宗寶鑑》",
    1: "《太乙金鏡式經》",
    2: "《太乙淘金歌》",
    3: "《太乙局》",
}
SECTION_LABELS = {
    "太乙計": "计类",
    "太乙公式類別": "古法公式",
    "公元日期": "公历",
    "干支": "干支",
    "農曆": "农历",
    "年號": "年号",
    "紀元": "纪元",
    "太歲": "太岁",
    "局式": "局式",
    "命局": "命局",
    "五子元局": "五子元局",
    "陽九": "阳九",
    "百六": "百六",
    "太乙落宮": "太乙数",
    "太乙": "太乙",
    "天乙": "天乙",
    "地乙": "地乙",
    "四神": "四神",
    "直符": "直符",
    "文昌": "文昌",
    "始擊": "始击",
    "合神": "合神",
    "計神": "计神",
    "定目": "定目",
    "君基": "君基",
    "臣基": "臣基",
    "民基": "民基",
    "五福": "五福",
    "帝符": "帝符",
    "太尊": "太尊",
    "飛鳥": "飞鸟",
    "三風": "三风",
    "五風": "五风",
    "八風": "八风",
    "大游": "大游",
    "小游": "小游",
    "主算": "主算",
    "主將": "主将",
    "主參": "主参",
    "客算": "客算",
    "客將": "客将",
    "客參": "客参",
    "定算": "定算",
    "金函玉鏡": "金函玉镜",
    "二十八宿值日": "值日宿",
    "太歲二十八宿": "太岁宿",
    "太歲值宿斷事": "太岁宿断",
    "始擊二十八宿": "始击宿",
    "始擊值宿斷事": "始击宿断",
    "十天干歲始擊落宮預測": "始击预测",
    "八門值事": "八门值事",
    "八門分佈": "八门分布",
    "八宮旺衰": "八宫旺衰",
    "推太乙當時法": "太乙当时法",
    "推主客相闗法": "主客关系",
    "推陰陽以占厄會": "阴阳厄会",
    "推三門具不具": "三门",
    "推五將發不發": "五将",
    "推多少以占勝負": "胜负",
    "推太乙風雲飛鳥助戰法": "风云飞鸟",
    "推孤單以占成敗": "孤单成败",
    "明臣基太乙所主術": "臣基主事",
    "明五福吉算所主術": "五福吉算",
    "明地乙太乙所主術": "地乙主事",
    "明天子巡狩之期術": "天子巡狩",
    "明君基太乙所主術": "君基主事",
    "明民基太乙所主術": "民基主事",
    "明五福太乙所主術": "五福主事",
    "明天乙太乙所主術": "天乙主事",
    "明值符太乙所主術": "值符主事",
    "推雷公入水": "雷公入水",
    "推臨津問道": "临津问道",
    "推獅子反擲": "狮子反掷",
    "推白雲捲空": "白云卷空",
    "推猛虎相拒": "猛虎相拒",
    "推白龍得雲": "白龙得云",
    "推回軍無言": "回军无言",
    "性別": "性别",
    "出生日期": "出生日期",
    "出生干支": "出生干支",
    "安命宮": "命宫",
    "安身宮": "身宫",
    "飛祿": "飞禄",
    "飛馬": "飞马",
    "黑符": "黑符",
    "天盤": "天盘",
    "十二命宮排列": "十二命宫",
    "陽九行限": "阳九行限",
    "百六行限": "百六行限",
    "出身卦": "出身卦",
    "年卦": "年卦",
    "月卦": "月卦",
    "日卦": "日卦",
    "時卦": "时卦",
    "分卦": "分卦",
    "運籌博弈分析": "运筹博弈",
}


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _first(value, default=""):
    if isinstance(value, (list, tuple)) and value:
        return value[0]
    if value is None:
        return default
    return value


def _string(value, default=""):
    if value is None:
        return default
    return str(value)


def _clean_text(value):
    text = _string(value).strip()
    if not text:
        return ""
    return text.replace("得None", "未得").replace("None", "未得")


def _format_lunar(value):
    if isinstance(value, dict):
        year = value.get("年", "")
        month = value.get("月", "")
        day = value.get("日", "")
        parts = []
        if year != "":
            parts.append(f"{year}年")
        if month != "":
            parts.append(f"{month}月")
        if day != "":
            parts.append(f"{day}日")
        return "".join(parts)
    return _clean_text(value)


def _sanitize_reign_year(value):
    text = _clean_text(value)
    if "中華人民共和國" in text or "中华人民共和国" in text:
        return "无"
    return text


def _compact_pair(key, value):
    val = _display_value(value)
    if not val:
        return ""
    key_text = _clean_text(key)
    if len(key_text) <= 2 and len(val) <= 4:
        return f"{key_text}{val}"
    return f"{key_text}：{val}"


def _display_value(value, label=None):
    if value is None or value == "":
        return ""
    if label == "農曆":
        return _format_lunar(value)
    if label == "年號":
        return _sanitize_reign_year(value)
    if label in ["太乙落宮", "五福", "飛鳥", "三風", "五風", "八風", "大游", "小游", "主將", "主參", "客將", "客參"]:
        palace = _palace(value)
        number = _calc_num(value)
        if palace and number:
            return f"{palace}宫（{number}）"
        return palace or _clean_text(value)
    if isinstance(value, dict):
        if label == "運籌博弈分析":
            rows = []
            for key in ["主方最優純策略", "客方最優純策略", "博弈均衡值", "主方勝率判斷", "八宮旺衰狀態", "古法推主客相闗"]:
                if key in value:
                    rows.append(f"{SECTION_LABELS.get(key, key)}：{_display_value(value.get(key))}")
            lp = value.get("LP最大勝率")
            if isinstance(lp, dict) and lp.get("建議文字"):
                rows.append(_clean_text(lp.get("建議文字")))
            return "；".join([row for row in rows if row])
        if "文" in value:
            parts = [_clean_text(value.get("文"))]
            if value.get("數") not in [None, ""]:
                parts.append(f"局数{value.get('數')}")
            if value.get("年"):
                parts.append(_clean_text(value.get("年")))
            for key, val in value.items():
                if _string(key).startswith("積"):
                    parts.append(f"{key}{val}")
            return "；".join([part for part in parts if part])
        if label == "金函玉鏡":
            parts = []
            for sub_label in ["門", "星"]:
                sub = value.get(sub_label)
                if isinstance(sub, dict):
                    row = "、".join([_compact_pair(key, val) for key, val in sub.items() if _compact_pair(key, val)])
                    if row:
                        parts.append(f"{sub_label}：{row}")
            return "；".join(parts)
        return "、".join([_compact_pair(key, val) for key, val in value.items() if _compact_pair(key, val)])
    if isinstance(value, (list, tuple)):
        if not value:
            return ""
        if len(value) == 2 and isinstance(value[1], (list, tuple)) and isinstance(value[0], (Integral, Real)):
            notes = [_display_value(item) for item in value[1]]
            return "；".join([_clean_text(value[0]), *[note for note in notes if note]])
        return "、".join([item for item in [_display_value(item) for item in value] if item])
    return _clean_text(value)


def _json_safe(value):
    if isinstance(value, dict):
        return {_string(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        return float(value)
    if hasattr(value, "item"):
        try:
            return _json_safe(value.item())
        except Exception:
            return _string(value)
    return value


def _palace(value):
    if isinstance(value, (list, tuple)):
        value = _first(value)
    if isinstance(value, int):
        return NUM_TO_GONG.get(value, "")
    try:
        return NUM_TO_GONG.get(int(value), _string(value))
    except Exception:
        return _string(value)


def _calc_num(value):
    if isinstance(value, (list, tuple)) and value:
        value = value[0]
    return _to_int(value, 0)


def _set_general(set_cal):
    val = _calc_num(set_cal) % 10
    return 5 if val == 0 else val


def _acc_num(kook):
    if not isinstance(kook, dict):
        return 0
    for key, value in kook.items():
        if str(key).startswith("積"):
            return _to_int(value, 0)
    return 0


def _build_sections(raw):
    groups = [
        ("起盘", ["太乙計", "太乙公式類別", "公元日期", "出生日期", "干支", "出生干支", "農曆", "年號", "紀元", "太歲", "局式", "命局", "五子元局", "陽九", "百六"]),
        ("命法", ["性別", "安命宮", "安身宮", "飛祿", "飛馬", "黑符", "出身卦", "年卦", "月卦", "日卦", "時卦", "分卦"]),
        ("命宫行限", ["天盤", "十二命宮排列", "陽九行限", "百六行限"]),
        ("太乙诸神", ["太乙落宮", "太乙", "天乙", "地乙", "四神", "直符", "文昌", "始擊", "合神", "計神", "定目", "君基", "臣基", "民基", "五福", "帝符", "太尊", "飛鳥"]),
        ("风游", ["三風", "五風", "八風", "大游", "小游"]),
        ("主客定算", ["主算", "主將", "主參", "客算", "客將", "客參", "定算"]),
        ("八门与宿曜", ["金函玉鏡", "二十八宿值日", "太歲二十八宿", "太歲值宿斷事", "始擊二十八宿", "始擊值宿斷事", "十天干歲始擊落宮預測", "八門值事", "八門分佈", "八宮旺衰"]),
        ("十二神", ["推太乙當時法"]),
        ("断法", ["推三門具不具", "推五將發不發", "推主客相闗法", "推陰陽以占厄會", "明天子巡狩之期術", "明君基太乙所主術", "明臣基太乙所主術", "明民基太乙所主術", "明五福太乙所主術", "明五福吉算所主術", "明天乙太乙所主術", "明地乙太乙所主術", "明值符太乙所主術", "推多少以占勝負", "推太乙風雲飛鳥助戰法", "推孤單以占成敗"]),
        ("七大兵法", ["推雷公入水", "推臨津問道", "推獅子反擲", "推白雲捲空", "推猛虎相拒", "推白龍得雲", "推回軍無言"]),
        ("博弈", ["運籌博弈分析"]),
    ]
    sections = []
    for title, keys in groups:
        rows = []
        for key in keys:
            if key in raw:
                value = _display_value(raw.get(key), key)
                if value:
                    rows.append({"label": SECTION_LABELS.get(key, key), "value": value, "sourceKey": key})
        if rows:
            sections.append({"title": title, "rows": rows})
    return sections


def _build_palace_marks(pan):
    marks = [
        {"label": "太乙", "palace": pan.get("taiyiPalace")},
        {"label": "文昌", "palace": pan.get("skyeyes")},
        {"label": "太岁", "palace": pan.get("taishui")},
        {"label": "合神", "palace": pan.get("hegod")},
        {"label": "计神", "palace": pan.get("jigod")},
        {"label": "始击", "palace": pan.get("sf")},
        {"label": "定目", "palace": pan.get("se")},
        {"label": "君基", "palace": pan.get("kingbase")},
        {"label": "臣基", "palace": pan.get("officerbase")},
        {"label": "民基", "palace": pan.get("pplbase")},
        {"label": "四神", "palace": pan.get("fgd")},
        {"label": "天乙", "palace": pan.get("skyyi")},
        {"label": "地乙", "palace": pan.get("earthyi")},
        {"label": "直符", "palace": pan.get("zhifu")},
        {"label": "飞符", "palace": pan.get("flyfu")},
        {"label": "主大", "palace": pan.get("homeGeneralPalace")},
        {"label": "主参", "palace": pan.get("homeVGenPalace")},
        {"label": "客大", "palace": pan.get("awayGeneralPalace")},
        {"label": "客参", "palace": pan.get("awayVGenPalace")},
        {"label": "定大", "palace": pan.get("setGeneralPalace")},
        {"label": "定参", "palace": pan.get("setVGenPalace")},
        {"label": "五福", "palace": pan.get("wufuPalace")},
        {"label": "帝符", "palace": pan.get("kingfu")},
        {"label": "太尊", "palace": pan.get("taijun")},
        {"label": "飞鸟", "palace": pan.get("flybird")},
        {"label": "三风", "palace": pan.get("threewindPalace")},
        {"label": "五风", "palace": pan.get("fivewindPalace")},
        {"label": "八风", "palace": pan.get("eightwindPalace")},
        {"label": "大游", "palace": pan.get("bigyoPalace")},
        {"label": "小游", "palace": pan.get("smyoPalace")},
    ]
    map16 = {palace: [] for palace in [*GONG16_ORDER, "中"]}
    map12 = {branch: [] for branch in DI_ZHI}
    for item in marks:
        palace = item.get("palace")
        if not palace:
            continue
        if palace in map16:
            map16[palace].append(item.get("label"))
        branch = BRANCH_ALIAS.get(palace, palace)
        if branch in map12:
            map12[branch].append(item.get("label"))
    return {
        "marks": marks,
        "palace16": [{"palace": palace, "items": map16[palace]} for palace in [*GONG16_ORDER, "中"]],
        "branch12": [{"branch": branch, "items": map12[branch]} for branch in DI_ZHI],
    }


def _normalize_result(raw, data, style, tn, sex):
    if isinstance(raw, dict) and "年號" in raw:
        raw["年號"] = _sanitize_reign_year(raw.get("年號", ""))
    kook_src = raw.get("局式") if isinstance(raw.get("局式"), dict) else raw.get("命局")
    kook = kook_src if isinstance(kook_src, dict) else {}
    ganzhi_src = raw.get("干支") if isinstance(raw.get("干支"), list) else raw.get("出生干支")
    ganzhi = ganzhi_src if isinstance(ganzhi_src, list) else []
    set_general = _set_general(raw.get("定算"))
    method_label = "命法不适用" if style == 5 else _clean_text(raw.get("太乙公式類別", ""))
    method_source = "命法不适用" if style == 5 else METHOD_SOURCES.get(tn, "")
    style_label = "太乙命法" if style == 5 else _clean_text(raw.get("太乙計", ""))
    normalized = {
        "source": "kintaiyi",
        "style": style,
        "styleForPan": 3 if style == 5 else style,
        "tn": tn,
        "tnForPan": 0 if style == 5 else tn,
        "sex": sex,
        "zhao": "坤造" if sex == "女" else "乾造",
        "dateStr": data.get("date", "") or raw.get("出生日期", ""),
        "timeStr": data.get("time", ""),
        "realSunTime": data.get("realSunTime", ""),
        "lunarText": _format_lunar(raw.get("農曆")),
        "jiedelta": data.get("jiedelta", ""),
        "methodLabel": method_label,
        "methodSource": method_source,
        "reignYear": _sanitize_reign_year(raw.get("年號", "")),
        "calendarEra": _clean_text(raw.get("紀元", "")),
        "ganzhi": {
            "year": ganzhi[0] if len(ganzhi) > 0 else "",
            "month": ganzhi[1] if len(ganzhi) > 1 else "",
            "day": ganzhi[2] if len(ganzhi) > 2 else "",
            "time": ganzhi[3] if len(ganzhi) > 3 else "",
            "minute": ganzhi[4] if len(ganzhi) > 4 else "",
        },
        "raw": raw,
        "sections": _build_sections(raw),
        "accNum": _acc_num(kook),
        "jiyuan": raw.get("紀元", ""),
        "kook": {
            "num": _to_int(kook.get("數"), 0),
            "text": kook.get("文", ""),
            "year": kook.get("年", ""),
            "raw": kook,
        },
        "taishui": raw.get("太歲", ""),
        "hegod": raw.get("合神", ""),
        "jigod": raw.get("計神", ""),
        "sf": raw.get("始擊", ""),
        "skyeyes": _first(raw.get("文昌"), ""),
        "se": raw.get("定目", ""),
        "taiyiNum": _to_int(raw.get("太乙落宮"), 0),
        "taiyiPalace": raw.get("太乙", ""),
        "homeCal": _calc_num(raw.get("主算")),
        "awayCal": _calc_num(raw.get("客算")),
        "setCal": _calc_num(raw.get("定算")),
        "homeGeneral": _to_int(raw.get("主將"), 0),
        "homeVGen": _to_int(raw.get("主參"), 0),
        "awayGeneral": _to_int(raw.get("客將"), 0),
        "awayVGen": _to_int(raw.get("客參"), 0),
        "setGeneral": set_general,
        "setVGen": (set_general * 3) % 10 or 5,
        "kingbase": raw.get("君基", ""),
        "officerbase": raw.get("臣基", ""),
        "pplbase": raw.get("民基", ""),
        "fgd": raw.get("四神", ""),
        "skyyi": raw.get("天乙", ""),
        "earthyi": raw.get("地乙", ""),
        "zhifu": raw.get("直符", ""),
        "flyfu": raw.get("飛符", ""),
        "wufuNum": _to_int(raw.get("五福"), 0),
        "wufuPalace": _palace(raw.get("五福")),
        "kingfu": raw.get("帝符", ""),
        "taijun": raw.get("太尊", ""),
        "flybird": _palace(raw.get("飛鳥")),
        "threewindNum": _to_int(raw.get("三風"), 0),
        "threewindPalace": _palace(raw.get("三風")),
        "fivewindNum": _to_int(raw.get("五風"), 0),
        "fivewindPalace": _palace(raw.get("五風")),
        "eightwindNum": _to_int(raw.get("八風"), 0),
        "eightwindPalace": _palace(raw.get("八風")),
        "bigyoNum": _to_int(raw.get("大游"), 0),
        "bigyoPalace": _palace(raw.get("大游")),
        "smyoNum": _to_int(raw.get("小游"), 0),
        "smyoPalace": _palace(raw.get("小游")),
        "homeGeneralPalace": _palace(raw.get("主將")),
        "homeVGenPalace": _palace(raw.get("主參")),
        "awayGeneralPalace": _palace(raw.get("客將")),
        "awayVGenPalace": _palace(raw.get("客參")),
        "setGeneralPalace": _palace(set_general),
        "setVGenPalace": _palace((set_general * 3) % 10 or 5),
        "eightDoorDuty": raw.get("八門值事", ""),
        "eightDoorMap": raw.get("八門分佈", {}),
        "eightPalacePower": raw.get("八宮旺衰", {}),
        "hostGuestRule": raw.get("推主客相闗法", ""),
        "options": {
            "styleLabel": style_label,
            "methodLabel": method_label,
            "methodSource": method_source,
            "accumLabel": method_label,
            "sexLabel": sex,
        },
    }
    marks = _build_palace_marks(normalized)
    normalized["palaceMarks"] = marks["marks"]
    normalized["palace16"] = marks["palace16"]
    normalized["branch12"] = marks["branch12"]
    return normalized


def _pan_with_game_theory(ty, style_for_pan, tn_for_pan, enable_game_theory):
    """[挂载自检 F-57] 博弈分析(kintaiyi.game_theory)依赖 scipy.optimize.linprog;随包运行时未带 scipy 时,
    此前 ImportError 沿 except 一路变成整盘「taiyi param error」——用户在页面/AI 挂载里一开「博弈分析」整个太乙盘就没了。
    现:缺依赖 → 退回不带博弈的盘并回传缺失模块名,由前端如实标注「本次未算」。依赖齐全时行为逐字不变。"""
    if not enable_game_theory:
        return ty.pan(style_for_pan, tn_for_pan, False), None
    try:
        return ty.pan(style_for_pan, tn_for_pan, True), None
    except ModuleNotFoundError as exc:
        missing = getattr(exc, "name", None) or "scipy"
        return ty.pan(style_for_pan, tn_for_pan, False), missing


class TaiYiSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def pan(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json or {}
            year = _to_int(data.get("year"), 0)
            month = _to_int(data.get("month"), 1)
            day = _to_int(data.get("day"), 1)
            hour = _to_int(data.get("hour"), 0)
            minute = _to_int(data.get("minute"), 0)
            # v2.2.1: 全局日界 + 晚子时·时柱起干 通过 thread-local 传给 kintaiyi
            # 默认均为 1=现行行为;仅 hour==23 时影响,其它 23 小时 NO-OP。
            after23_new_day = _to_int(data.get("after23NewDay"), 1)
            late_zi_hour_use_next_day = _to_int(data.get("lateZiHourUseNextDay"), 1)
            from kintaiyi import jieqi as _ty_jieqi
            _ty_jieqi.set_after23_new_day(after23_new_day)
            _ty_jieqi.set_hour_gan_use_next_day(late_zi_hour_use_next_day)
            style = _to_int(data.get("style"), 3)
            tn = _to_int(data.get("tn"), 0)
            sex = "女" if data.get("sex") in ["女", "female", "Female", 0, "0"] else "男"
            style_for_pan = 3 if style == 5 else style
            tn_for_pan = 0 if style == 5 else tn
            enable_game_theory = data.get("enableGameTheory") in [True, 1, "1", "true", "True"]
            ty = Taiyi(year, month, day, hour, minute)
            gt_missing = None
            if style == 5:
                raw = ty.taiyi_life(sex)
            else:
                raw, gt_missing = _pan_with_game_theory(ty, style_for_pan, tn_for_pan, enable_game_theory)
            raw = _json_safe(raw)
            normalized = _normalize_result(raw, data, style, tn, sex)
            if gt_missing and isinstance(normalized, dict):
                # 前端据此如实标注「开启(运行时缺 X,本次未算)」——绝不把整盘打成 param error,也绝不假装算了。
                normalized["gameTheoryUnavailable"] = gt_missing
            obj = {
                "ResultCode": 0,
                "Result": normalized,
            }
            return jsonpickle.encode(obj, unpicklable=False)
        except Exception:
            traceback.print_exc()
            obj = {
                "ResultCode": 1,
                "Result": "taiyi param error",
            }
            return jsonpickle.encode(obj, unpicklable=False)
