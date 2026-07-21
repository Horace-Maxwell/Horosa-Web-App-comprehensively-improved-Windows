import datetime
import os
import random
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import cnlunar
import jsonpickle

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_TAIXUAN_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "taixuanshifa")


def _import_taixuan():
    """Import taixuanshifa in isolation so vendor top-level modules stay contained."""
    previous_modules = {name: sys.modules.get(name) for name in ("taixuanshifa",)}
    for name in previous_modules:
        sys.modules.pop(name, None)
    inserted = False
    if _TAIXUAN_SRC not in sys.path:
        sys.path.insert(0, _TAIXUAN_SRC)
        inserted = True
    try:
        import taixuanshifa as taixuan_core  # noqa: E402
        return taixuan_core
    finally:
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        if inserted:
            try:
                sys.path.remove(_TAIXUAN_SRC)
            except ValueError:
                pass


taixuan_core = _import_taixuan()


POSITION_LABELS = ["方", "州", "部", "家"]
DIGIT_LABELS = {1: "一", 2: "二", 3: "三"}
LINE_SYMBOLS = {
    "1": "▅▅▅▅▅▅▅▅▅▅",
    "2": "▅▅▅▅  ▅▅▅▅",
    "3": "▅▅  ▅▅  ▅▅",
}
LINE_ORDER = ["初一", "次二", "次三", "次四", "次五", "次六", "次七", "次八", "上九"]
PERIOD_LINES = {
    "旦": ["初一", "次五", "次七"],
    "夕": ["次三", "次四", "次八"],
    "日中": ["次二", "次六", "上九"],
    "夜中": ["次二", "次六", "上九"],
}
DIVINE_YINYANG = {
    "旦陽": ["旦筮阳首", "一从二从三从", "大休"],
    "日中陰": ["日中筮阴首", "一从二从三违", "始中休终咎"],
    "夜中陰": ["夜中筮阴首", "一从二从三违", "始中休终咎"],
    "夕陰": ["夕筮阴首", "一违二从三从", "始咎中终休"],
    "日中陽": ["日中筮阳首", "一违二违三从", "始中咎终休"],
    "夜中陽": ["夜中阳首", "一违二违三从", "始中咎终休"],
    "夕陽": ["夕筮阳首", "一从二违三违", "始休中终咎"],
    "旦陰": ["旦筮阴首", "一违二违三违", "大咎"],
}


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _clean_text(value, default=""):
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _json_safe(value):
    if isinstance(value, dict):
        return {_clean_text(key): _json_safe(val) for key, val in value.items()}
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
            return _clean_text(value)
    return value


def _format_value(value):
    if value is None or value == "":
        return ""
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            text = _format_value(val)
            if text:
                parts.append(f"{key}：{text}")
        return "；".join(parts)
    if isinstance(value, list):
        return "、".join([_format_value(item) for item in value if _format_value(item)])
    return _clean_text(value)


def _row(label, value):
    return {"label": label, "value": _format_value(value) or "—"}


def _read_vendor_text(filename, fallback=""):
    path = os.path.join(_TAIXUAN_SRC, filename)
    if not os.path.isfile(path):
        return fallback
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read().strip()
    return content or fallback


def _related_links():
    return [
        {
            "name": "taixuanshifa",
            "url": "https://github.com/kentang2017/taixuanshifa",
            "description": "kentang2017 太玄筮法 Python 项目。",
        },
        {
            "name": "PyPI taixuanshifa",
            "url": "https://pypi.org/project/taixuanshifa/",
            "description": "上游 README 中列出的 PyPI 包页面。",
        },
    ]


def _source_sections():
    readme = _read_vendor_text("README.md", "暂无 README 内容。")
    intro_marker = "## **1. Introduction"
    install_marker = "## **2. Installation"
    intro = readme
    if intro_marker in readme and install_marker in readme:
        intro = readme.split(intro_marker, 1)[1].split(install_marker, 1)[0].strip()
    features = ""
    feature_marker = "## **Features"
    if feature_marker in readme and intro_marker in readme:
        features = readme.split(feature_marker, 1)[1].split(intro_marker, 1)[0].strip()
    link_lines = [f"{item['name']}：{item['description']}（{item['url']}）" for item in _related_links()]
    return {
        "meta": [{
            "key": "taixuan_readme",
            "title": "taixuanshifa 来源内容",
            "author": "Ken Tang / kentang2017",
            "description": "上游未提供单独古籍 Markdown；星阙从 README 和核心 81 首数据中整理展示。",
        }],
        "selectedKey": "taixuan_readme",
        "sections": [
            {"title": "项目简介", "content": intro},
            {"title": "功能摘要", "content": features or "暂无功能摘要。"},
            {"title": "相关项目", "content": "\n".join(link_lines)},
        ],
        "links": _related_links(),
    }


def _period_for_hour(hour):
    hours = list(range(24))
    return taixuan_core.multi_key_dict_get({
        tuple(hours[6:12]): "旦",
        tuple(hours[12:18]): "日中",
        tuple(hours[18:24]): "夕",
        tuple(hours[0:6]): "夜中",
    }, hour)


def _with_seed(seed, func):
    state = random.getstate()
    try:
        random.seed(seed)
        return func()
    finally:
        random.setstate(state)


def _lunar_payload(year, month, day, hour):
    lunar = cnlunar.Lunar(datetime.datetime(year, month, day, hour, 0))
    return {
        "text": f"{lunar.lunarYearCn}年{lunar.lunarMonthCn[:-1]}{lunar.lunarDayCn}日",
        "year": lunar.lunarYearCn,
        "month": lunar.lunarMonthCn,
        "day": lunar.lunarDayCn,
    }


def _ganzhi_payload(year, month, day, hour):
    # 🔴 四柱统一走权威 extreme_pillars(与八字/主链一致:天文年立春界/定气月/儒略JDN)。
    # cnlunar 域限 1~9999(BC datetime 越域)且远古口径异;现代域两者一致(已验 AD2026=丙午乙未
    # 甲午乙亥),故全域换权威=现代零回归+修 BC(旧:庚子癸未…≠八字乙未庚辰己卯)。
    try:
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, 0)
        return {"year": _y, "month": _m, "day": _d, "hour": _h, "raw": [_y, _m, _d, _h]}
    except Exception:
        pass
    lunar = cnlunar.Lunar(datetime.datetime(year, month, day, hour, 0))
    return {
        "year": lunar.year8Char,
        "month": lunar.month8Char,
        "day": lunar.day8Char,
        "hour": lunar.twohour8Char,
        "raw": [lunar.year8Char, lunar.month8Char, lunar.day8Char, lunar.twohour8Char],
    }


def _winter_solstice_payload(year, month, day, hour):
    tx = taixuan_core.Taixuan(year, month, day, hour)
    solstice = tx.getdz_date()
    return {
        "date": solstice.strftime("%Y-%m-%d"),
        "days": tx.getdz(),
    }


def _calculate(year, month, day, hour, seed):
    tx = taixuan_core.Taixuan(year, month, day, hour)
    zhou, zhan_number, digits = _with_seed(seed, tx.qigua_number)
    gua_number = int(zhou)
    gua_details = taixuan_core.taixuandict.get(gua_number) or {}
    gua = gua_details.get("卦") or {}
    if not gua:
        raise ValueError(f"taixuan hexagram not found: {gua_number}")

    period = _period_for_hour(hour)
    cnums = [DIGIT_LABELS.get(item, str(item)) for item in digits]
    head = "{}方{}州{}部{}家".format(cnums[0], cnums[1], cnums[2], cnums[3])
    xzlist = {
        "一家": 1, "二家": 2, "三家": 3,
        "一部": 0, "二部": 3, "三部": 6,
        "一州": 0, "二州": 9, "三州": 18,
        "一方": 0, "二方": 27, "三方": 54,
    }
    xuan_head = xzlist.get(head[0:2]) + xzlist.get(head[2:4]) + xzlist.get(head[4:6]) + xzlist.get(head[6:8])
    xuan_yinyang = taixuan_core.yy(xuan_head)
    head_relation = {"陽": "从", "陰": "违"}.get(xuan_yinyang)
    judgment = DIVINE_YINYANG.get(period + xuan_yinyang, ["—", "—", "—"])
    zhan_base = (xuan_head - 1) * 9
    biao_base = (xuan_head - 1) * 3
    xuan_zan = zhan_base // 2
    lodge = dict(zip(list(range(365)), taixuan_core.yearsu)).get(xuan_zan)
    selected_names = PERIOD_LINES.get(period, [])
    selected_lines = [{"name": name, "content": gua_details.get(name, "")} for name in selected_names]
    all_lines = [{"name": name, "content": gua_details.get(name, "")} for name in LINE_ORDER]
    gua_name = list(gua.keys())[0]
    gua_text = list(gua.values())[0]
    four_places = [
        {
            "key": POSITION_LABELS[idx],
            "value": value,
            "label": f"{DIGIT_LABELS.get(value, value)}{POSITION_LABELS[idx]}",
            "symbol": LINE_SYMBOLS.get(str(value), ""),
        }
        for idx, value in enumerate(digits)
    ]
    return {
        "guaNumber": gua_number,
        "digits": digits,
        "zhou": zhou,
        "zhanNumber": zhan_number,
        "gua": {"name": gua_name, "text": gua_text},
        "period": period,
        "fourPlaces": four_places,
        "head": head,
        "xuanHead": {
            "number": xuan_head,
            "yinYang": xuan_yinyang,
            "relation": head_relation,
            "method": judgment[0],
            "sequence": judgment[1],
            "judgment": judgment[2],
            "zhanBase": zhan_base,
            "biaoBase": biao_base,
            "xuanZan": xuan_zan,
        },
        "starLodge": {"text": f"{lodge}度" if lodge else "—", "raw": lodge},
        "selectedLines": selected_lines,
        "allLines": all_lines,
        "raw": _json_safe(gua_details),
    }


def _build_sections(payload):
    gz = payload.get("ganzhi", {})
    tx = payload.get("taixuan", {})
    xh = tx.get("xuanHead", {})
    winter = payload.get("winterSolstice", {})
    return [
        {
            "title": "起盘",
            "rows": [
                _row("起筮时间", f"{payload.get('dateStr')} {payload.get('hour', 0):02d}时"),
                _row("农历", payload.get("lunarDate", {}).get("text")),
                _row("年柱", gz.get("year")),
                _row("月柱", gz.get("month")),
                _row("日柱", gz.get("day")),
                _row("时柱", gz.get("hour")),
                _row("起筮时段", tx.get("period")),
                _row("起筮种子", payload.get("seed")),
                _row("冬至起算", winter.get("date")),
                _row("距冬至日", f"{winter.get('days')}日" if winter.get("days") is not None else None),
            ],
        },
        {
            "title": "玄首",
            "rows": [
                _row("筮得", tx.get("zhou")),
                _row("首序", tx.get("guaNumber")),
                _row("占位", tx.get("zhanNumber")),
                _row("首", tx.get("gua", {}).get("name")),
                _row("首辞", tx.get("gua", {}).get("text")),
                _row("方州部家", tx.get("head")),
                _row("玄首", f"{xh.get('number')}，{xh.get('relation')}"),
                _row("阴阳", xh.get("yinYang")),
                _row("起筮法", xh.get("method")),
                _row("休咎序", xh.get("sequence")),
                _row("休咎", xh.get("judgment")),
                _row("赞基", xh.get("zhanBase")),
                _row("表基", xh.get("biaoBase")),
                _row("玄赞", xh.get("xuanZan")),
                _row("星宿", tx.get("starLodge", {}).get("text")),
            ],
        },
        {
            "title": "方州部家",
            "rows": [_row("筮数", tx.get("digits"))] + [_row(item.get("key"), item.get("label")) for item in tx.get("fourPlaces", [])],
        },
        {
            "title": "表",
            "rows": [_row(item.get("name"), item.get("content")) for item in tx.get("selectedLines", [])],
        },
    ]


def _build_snapshot(payload):
    lines = []
    for section in payload.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for row in section.get("rows", []):
            lines.append(f"{row.get('label')}：{row.get('value')}")
        lines.append("")
    return "\n".join(lines).strip()


class TaiXuanSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def pan(self):
        enable_crossdomain()
        try:
            if cherrypy.request.method == "OPTIONS":
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            data = cherrypy.request.json or {}
            # [X1·P2-8] cnlunar 历表支持域 1900-2100:旧下限 1500 令 1500-1899 年起筮恒后端失败。
            # 🔴 raw_year=原始年(四柱/seed 用,走权威 extreme_pillars 全域正确);year=clamp 年(仅
            #    cnlunar 农历/冬至辅助显示用,历表域限妥协)。此前四柱也用 clamp 年 → BC/远古四柱当
            #    1900 算(庚子癸未…≠八字乙未庚辰己卯);太玄起卦本为随机蓍草,与年份无关不受影响。
            raw_year = _to_int(data.get("year"), 2026)
            year = max(1900, min(2100, raw_year))
            month = max(1, min(12, _to_int(data.get("month"), 1)))
            day = max(1, min(31, _to_int(data.get("day"), 1)))
            hour = max(0, min(23, _to_int(data.get("hour"), 0)))
            seed = _to_int(data.get("seed"), raw_year * 1000000 + month * 10000 + day * 100 + hour)
            datetime.datetime(year, month, day, hour, 0)

            taixuan = _calculate(year, month, day, hour, seed)
            normalized = {
                "source": "taixuanshifa",
                "engine": "taixuanshifa",
                "dateStr": data.get("date", f"{year:04d}-{month:02d}-{day:02d}"),
                "timeStr": data.get("time", f"{hour:02d}:00:00"),
                "year": year,
                "month": month,
                "day": day,
                "hour": hour,
                "seed": seed,
                "lunarDate": _lunar_payload(year, month, day, hour),
                "ganzhi": _ganzhi_payload(raw_year, month, day, hour),
                "winterSolstice": _winter_solstice_payload(year, month, day, hour),
                "taixuan": taixuan,
                "classics": _source_sections(),
                "capabilities": {
                    "inputs": ["date", "time", "hour", "seed"],
                    "outputs": [
                        "guaNumber", "zhou", "digits", "zhanNumber", "xuanHead", "xuanZan",
                        "zhanBase", "biaoBase", "fourPlaces", "period", "starLodge",
                        "selectedLines", "allLines", "winterSolstice", "readme",
                    ],
                },
            }
            normalized["sections"] = _build_sections(normalized)
            normalized["snapshot"] = _build_snapshot(normalized)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "taixuan calculation failed"}, unpicklable=False)
