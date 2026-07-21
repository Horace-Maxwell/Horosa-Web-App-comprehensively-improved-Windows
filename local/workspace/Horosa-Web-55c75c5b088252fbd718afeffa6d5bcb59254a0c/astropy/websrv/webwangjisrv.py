import os
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import cn2an
import jsonpickle
from cn2an import an2cn

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_KINWANGJI_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "kinwangji")
if os.path.isdir(os.path.join(_KINWANGJI_SRC, "kinwangji")) and _KINWANGJI_SRC not in sys.path:
    sys.path.insert(0, _KINWANGJI_SRC)

from kinwangji.wanji import display_pan, lunar_date_d, one2two, wanji_four_gua  # noqa: E402
from kinwangji.jieqi import gong_wangzhuai, jq  # noqa: E402
from kinwangji.history import history_for_year  # noqa: E402
from kinwangji.classics import get_sections, list_classics  # noqa: E402
from kinwangji.xinyi import (  # noqa: E402
    DIRECTION_GUA,
    TRIGRAM_CODE,
    character_qigua,
    datetime_qigua,
    direction_qigua,
    number_qigua,
)


GUA_UNICODE = {
    "乾": "䷀", "坤": "䷁", "屯": "䷂", "蒙": "䷃", "需": "䷄",
    "訟": "䷅", "師": "䷆", "比": "䷇", "小畜": "䷈", "履": "䷉",
    "泰": "䷊", "否": "䷋", "同人": "䷌", "大有": "䷍", "謙": "䷎",
    "豫": "䷏", "隨": "䷐", "蠱": "䷑", "臨": "䷒", "觀": "䷓",
    "噬嗑": "䷔", "賁": "䷕", "剝": "䷖", "復": "䷗", "無妄": "䷘",
    "大畜": "䷙", "頤": "䷚", "大過": "䷛", "坎": "䷜", "離": "䷝",
    "咸": "䷞", "恆": "䷟", "遯": "䷠", "大壯": "䷡", "晉": "䷢",
    "明夷": "䷣", "家人": "䷤", "睽": "䷥", "蹇": "䷦", "解": "䷧",
    "損": "䷨", "益": "䷩", "夬": "䷪", "姤": "䷫", "萃": "䷬",
    "升": "䷭", "困": "䷮", "井": "䷯", "革": "䷰", "鼎": "䷱",
    "震": "䷲", "艮": "䷳", "漸": "䷴", "歸妹": "䷵", "豐": "䷶",
    "旅": "䷷", "巽": "䷸", "兌": "䷹", "渙": "䷺", "節": "䷻",
    "中孚": "䷼", "小過": "䷽", "既濟": "䷾", "未濟": "䷿",
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


def _gua_row(label, name, moving_line=None):
    if not name:
        text = "—"
    else:
        text = f"{GUA_UNICODE.get(name, '')} {one2two(name).strip()}".strip()
    if moving_line:
        text = f"{text}，动爻：{moving_line}"
    return _row(label, text)


def _cycle_position(value, cycle_length):
    return ((int(value) - 1) % cycle_length) + 1


def _format_lunar_date(year, month, day):
    lunar = lunar_date_d(year, month, day)
    lunar_year = lunar.get("年")
    lunar_month = lunar.get("月")
    lunar_day = lunar.get("日")
    try:
        text = "{}{}月{}日".format(
            cn2an.transform(str(lunar_year) + "年", "an2cn"),
            an2cn(lunar_month),
            an2cn(lunar_day),
        )
    except Exception:
        text = f"{lunar_year}年{lunar_month}月{lunar_day}日"
    return {
        "year": lunar_year,
        "month": lunar_month,
        "day": lunar_day,
        "text": text,
    }


def _contains_sensitive_modern_era(value):
    text = _clean_text(value)
    needles = ["中華人民共和國", "中华人民共和国", "中华人民", "中華人民"]
    return any(item in text for item in needles)


def _sanitize_history_records(records):
    clean = []
    for rec in records or []:
        if any(_contains_sensitive_modern_era(val) for val in rec.values()):
            clean.append({
                "start_year": rec.get("start_year"),
                "duration": rec.get("duration"),
                "dynasty": "无",
                "title": "无",
                "name": "无",
                "era": "无",
            })
            continue
        clean.append({
            "start_year": rec.get("start_year"),
            "duration": rec.get("duration"),
            "dynasty": _clean_text(rec.get("dynasty"), "无"),
            "title": _clean_text(rec.get("title"), "无"),
            "name": _clean_text(rec.get("name"), "无"),
            "era": _clean_text(rec.get("era"), "无"),
        })
    return clean


# horosa_wangji_classics_ondemand_v1:典籍全书(皇極經世書 ~980KB md)不再随每次 /wangji/pan 下发。
# get_sections() 每次都重读 + 正则重切整册 md;这里加模块级解析缓存(数据随包只读、进程内恒定,
# 命中即零 I/O),并按 with_content 分档:
#   * /wangji/pan → 只出 level+title(章节目录,前端左栏下拉与 UI 初始渲染够用),盘体从 ~1.96MB 降到 ~12KB;
#   * /wangji/classic → 出全文,前端按 classicKey 模块级缓存一次,合并回 state 里的 sections。
# 章节切换/显示切换因此仍是纯本地(全文已在客户端),AI 快照亦不缺正文。
_SECTIONS_CACHE = {}


def _cached_sections(key):
    cached = _SECTIONS_CACHE.get(key)
    if cached is None:
        cached = get_sections(key)
        _SECTIONS_CACHE[key] = cached
    return cached


def _classic_payload(key, with_content=False):
    meta = list_classics()
    valid_keys = [item["key"] for item in meta]
    selected = key if key in valid_keys else (valid_keys[0] if valid_keys else "")
    sections = []
    if selected:
        sections = _cached_sections(selected)
    out = []
    for item in sections:
        row = {
            "level": item.get("level"),
            "title": item.get("title", ""),
        }
        if with_content:
            row["content"] = item.get("content", "")
        out.append(row)
    return {
        "meta": meta,
        "selectedKey": selected,
        "sections": out,
        "withContent": bool(with_content),
    }


def _build_sections(result, solar_term, wangxiang, history_records, lunar_date):
    gz = result.get("干支", [])
    state_to_trigram = wangxiang[1] if isinstance(wangxiang, tuple) and len(wangxiang) > 1 else {}
    sections = [
        {
            "title": "起盘",
            "rows": [
                _row("起卦时间", result.get("日期")),
                _row("农历", lunar_date.get("text")),
                _row("节气", solar_term),
                _row("旺", state_to_trigram.get("旺")),
                _row("相", state_to_trigram.get("相")),
                _row("年柱", gz[0] if len(gz) > 0 else ""),
                _row("月柱", gz[1] if len(gz) > 1 else ""),
                _row("日柱", gz[2] if len(gz) > 2 else ""),
                _row("时柱", gz[3] if len(gz) > 3 else ""),
                _row("分柱", gz[4] if len(gz) > 4 else ""),
            ],
        },
        {
            "title": "元会运世",
            "rows": [
                _row("会", f"{result.get('會')}（{_cycle_position(result.get('會'), 12)}/12）"),
                _row("运", f"{result.get('運')}（{_cycle_position(result.get('運'), 30)}/30）"),
                _row("世", f"{result.get('世')}（{_cycle_position(result.get('世'), 12)}/12）"),
            ],
        },
        {
            "title": "天道卦",
            "rows": [
                _gua_row("正卦", result.get("正卦")),
                _gua_row("运卦", result.get("運卦"), result.get("運卦動爻")),
                _gua_row("世卦", result.get("世卦"), result.get("世卦動爻")),
                _gua_row("旬卦", result.get("旬卦"), result.get("旬卦動爻")),
            ],
        },
        {
            "title": "人事卦",
            "rows": [
                _gua_row("年卦", result.get("年卦")),
                _gua_row("月卦", result.get("月卦")),
                _gua_row("日卦", result.get("日卦")),
                _gua_row("时卦", result.get("時卦")),
                _gua_row("分卦", result.get("分卦")),
            ],
        },
    ]
    history_rows = []
    for rec in history_records or []:
        years = f"{rec.get('start_year', '')}起，{rec.get('duration', '')}年"
        history_rows.extend([
            _row("年代", years),
            _row("朝代", rec.get("dynasty")),
            _row("称号", rec.get("title")),
            _row("名讳", rec.get("name")),
            _row("年号", rec.get("era")),
        ])
    sections.append({"title": "历史年表", "rows": history_rows or [_row("历史年表", "无")]})
    return sections


def _build_snapshot(pan):
    lines = []
    for section in pan.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for row in section.get("rows", []):
            lines.append(f"{row.get('label')}：{row.get('value')}")
        lines.append("")
    if pan.get("xinyi"):
        lines.append("[心易发微]")
        for key, val in pan["xinyi"].items():
            lines.append(f"{key}：{_format_value(val) or '—'}")
    return "\n".join(lines).strip()


def _xinyi_result(data):
    method = _clean_text(data.get("method"), "number")
    if method == "datetime":
        result = datetime_qigua(
            _to_int(data.get("year"), 2025),
            _to_int(data.get("month"), 1),
            _to_int(data.get("day"), 1),
            _to_int(data.get("hour"), 0),
        )
    elif method == "direction":
        result = direction_qigua(
            _clean_text(data.get("objectGua"), "乾"),
            _clean_text(data.get("direction"), "北"),
            _to_int(data.get("hour"), 0),
        )
    elif method == "character":
        result = character_qigua(
            max(1, _to_int(data.get("upperStrokes"), 5)),
            max(1, _to_int(data.get("lowerStrokes"), 8)),
        )
    else:
        method = "number"
        result = number_qigua(
            max(1, _to_int(data.get("upperNum"), 5)),
            max(1, _to_int(data.get("lowerNum"), 10)),
        )
    return {
        "method": method,
        "result": _json_safe(result),
        "sections": [{
            "title": "心易发微",
            "rows": [_row(key, val) for key, val in result.items()],
        }],
    }


class WangJiSrv:
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
            year = _to_int(data.get("year"), 2025)
            month = _to_int(data.get("month"), 1)
            day = _to_int(data.get("day"), 1)
            hour = _to_int(data.get("hour"), 0)
            minute = _to_int(data.get("minute"), 0)
            history_year = _to_int(data.get("historyYear"), year)
            classic_key = _clean_text(data.get("classicKey"), "huangji_jingshi_shu")
            # 子初/子正換日：透過 thread-local 把全局換日設置注入 wangji 引擎（避免深透傳）
            from kinwangji.wanji import set_after23_new_day as _wanji_set_a23
            from kinwangji.jieqi import set_after23_new_day as _jieqi_set_a23
            _a23 = _to_int(data.get("after23NewDay"), 1)
            _wanji_set_a23(_a23)
            _jieqi_set_a23(_a23)
            # v2.2.1: 晚子时·时柱起干 thread-local 注入
            _lz = _to_int(data.get("lateZiHourUseNextDay"), 1)
            try:
                from kinwangji.jieqi import set_hour_gan_use_next_day as _jieqi_set_lz
                _jieqi_set_lz(_lz)
            except (ImportError, AttributeError):
                pass
            try:
                from kinwangji.wanji import set_hour_gan_use_next_day as _wanji_set_lz
                _wanji_set_lz(_lz)
            except (ImportError, AttributeError):
                pass
            result = _json_safe(wanji_four_gua(year, month, day, hour, minute))
            solar_term = jq(year, month, day, hour, minute)
            wangxiang = gong_wangzhuai(solar_term)
            lunar_date = _format_lunar_date(year, month, day)
            history_records = _sanitize_history_records(history_for_year(history_year))
            pan_text = display_pan(year, month, day, hour, minute)
            normalized = {
                "source": "kinwangji",
                "engine": "kinwangji",
                "dateStr": data.get("date", result.get("日期", "").split(" ")[0]),
                "timeStr": data.get("time", result.get("日期", "").split(" ")[-1]),
                "raw": result,
                "lunarDate": lunar_date,
                "solarTerm": solar_term,
                "wangxiang": _json_safe(wangxiang),
                "historyYear": history_year,
                "history": history_records,
                # horosa_wangji_classics_ondemand_v1:盘体只带典籍目录(level+title);
                # 正文由前端 /wangji/classic 按 classicKey 取一次并本地缓存。
                "classics": _classic_payload(classic_key),
                "fullText": pan_text,
                "guaUnicode": GUA_UNICODE,
                "xinyiOptions": {
                    "methods": ["number", "datetime", "direction", "character"],
                    "trigrams": list(TRIGRAM_CODE.keys()),
                    "directions": list(DIRECTION_GUA.keys()),
                },
                "capabilities": {
                    "inputs": [
                        "date",
                        "time",
                        "historyYear",
                        "classicKey",
                        "classicSection",
                        "xinyiMethod",
                        "xinyiNumber",
                        "xinyiDirection",
                        "xinyiCharacterStrokes",
                    ],
                    "outputs": [
                        "yuanHuiYunShi",
                        "nineHexagrams",
                        "solarTerm",
                        "lunarDate",
                        "gangzhi",
                        "history",
                        "classics",
                        "displayPanText",
                        "xinyi",
                    ],
                },
            }
            normalized["sections"] = _build_sections(result, solar_term, wangxiang, history_records, lunar_date)
            try:
                normalized["xinyi"] = _xinyi_result({
                    "method": "datetime",
                    "year": year,
                    "month": month,
                    "day": day,
                    "hour": hour,
                })
            except Exception:
                normalized["xinyi"] = None
            normalized["snapshot"] = _build_snapshot(normalized)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "wangji calculation failed"}, unpicklable=False)

    # horosa_wangji_classics_ondemand_v1:典籍全文按需端点(纯只读、无随机/无 now、无副作用)。
    # 入参 classicKey;回全 sections(level+title+content),供前端按 key 缓存一次后本地切章。
    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def classic(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json or {}
            classic_key = _clean_text(data.get("classicKey"), "huangji_jingshi_shu")
            payload = _classic_payload(classic_key, with_content=True)
            return jsonpickle.encode({"ResultCode": 0, "Result": payload}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "classic load failed"}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def xinyi(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json or {}
            return jsonpickle.encode({"ResultCode": 0, "Result": _xinyi_result(data)}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "xinyi calculation failed"}, unpicklable=False)
