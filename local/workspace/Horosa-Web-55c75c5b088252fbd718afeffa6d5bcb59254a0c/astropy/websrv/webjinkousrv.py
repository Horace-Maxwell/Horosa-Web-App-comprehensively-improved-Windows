import os
import re
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle
import pendulum

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_KINJINKOU_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "kinjinkou")
if os.path.isdir(os.path.join(_KINJINKOU_SRC, "kinjinkou")) and _KINJINKOU_SRC not in sys.path:
    sys.path.insert(0, _KINJINKOU_SRC)

from kinjinkou import JinkoujueApi  # noqa: E402


DI_ZHI = list("子丑寅卯辰巳午未申酉戌亥")
GAN = list("甲乙丙丁戊己庚辛壬癸")
ROW_KEYS = ["人元", "贵神", "将神", "地分"]


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
    if not text:
        return default
    return text.replace("None", "").strip()


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


def _branch(value, default=""):
    text = _clean_text(value)
    for ch in text:
        if ch in DI_ZHI:
            return ch
    return default


def _pendulum_tz(value):
    text = _clean_text(value)
    if not text or re.match(r"^[+-]\d{2}:?\d{2}$", text):
        return "Asia/Hong_Kong"
    return text


def _gan(value, default=""):
    text = _clean_text(value)
    for ch in text:
        if ch in GAN:
            return ch
    return default


def _parse_ganzhi_name(value):
    text = _clean_text(value)
    name = ""
    match = re.search(r"（([^）]+)）", text)
    if match:
        name = _clean_text(match.group(1))
    plain = re.sub(r"（[^）]*）", "", text)
    return {
        "gan": _gan(plain),
        "branch": _branch(plain),
        "ganZhi": plain,
        "name": name,
    }


def _sign(yinyang):
    return "+" if yinyang == "阳" else ("-" if yinyang == "阴" else "")


def _nayin(value):
    text = _clean_text(value)
    return text[2:] if text.startswith("纳音") else text


def _extract_ganzhi(text):
    parts = _clean_text(text).replace("干支：", "").split("空亡：")[0].split()
    return {
        "year": parts[0] if len(parts) > 0 else "",
        "month": parts[1] if len(parts) > 1 else "",
        "day": parts[2] if len(parts) > 2 else "",
        "time": parts[3] if len(parts) > 3 else "",
    }


def _row(label, src):
    parsed = _parse_ganzhi_name(src.get("干支", ""))
    element = _clean_text(src.get("五行"))
    sign = _sign(_clean_text(src.get("阴阳")))
    power_state = _clean_text(src.get("旺衰"))
    gan = parsed["gan"]
    content = parsed["branch"] or parsed["ganZhi"]
    if label in ["人元", "地分"]:
        content = parsed["ganZhi"] or content
        gan = ""
    return {
        "label": label,
        "gan": gan or "-",
        "content": content or "—",
        "ganZhi": parsed["ganZhi"],
        "branch": parsed["branch"],
        "shenjiang": parsed["name"] or "-",
        "element": element,
        "yinYang": _clean_text(src.get("阴阳")),
        "sign": sign,
        "season": power_state,
        "power": f"{element}{sign}{power_state}" if element or sign or power_state else "—",
        "nayin": _nayin(src.get("纳音")),
        "isYong": _clean_text(src.get("用神")) == "用",
        "raw": src,
    }


def _build_sections(normalized):
    return [{
        "title": "起课",
        "rows": [
            {"label": "占时", "value": normalized["zhanshi"]},
            {"label": "月将", "value": normalized["yuejiang"]},
            {"label": "地分", "value": normalized["difen"]},
            {"label": "四大空亡", "value": normalized["siDaKong"]},
            {"label": "年柱", "value": normalized["ganzhi"]["year"]},
            {"label": "月柱", "value": normalized["ganzhi"]["month"]},
            {"label": "日柱", "value": normalized["ganzhi"]["day"]},
            {"label": "时柱", "value": normalized["ganzhi"]["time"]},
        ],
    }, {
        "title": "三盘",
        "rows": [
            {"label": item["di"], "value": f"天盘{item['tian']} 将神{item['jiang']} 神盘{item['shen']} 贵神{item['gui']}"}
            for item in normalized["plates"]
        ],
    }, {
        "title": "四课",
        "rows": [
            {"label": item["label"], "value": f"{item['ganZhi'] or item['content']} {item['shenjiang']} {item['power']}{' 用' if item['isYong'] else ''}".strip()}
            for item in normalized["rows"]
        ],
    }]


def _normalize(raw, text, data):
    zhanshi = raw.get("占时", {}) if isinstance(raw.get("占时"), dict) else {}
    pan = raw.get("盘", {}) if isinstance(raw.get("盘"), dict) else {}
    ke = raw.get("课", {}) if isinstance(raw.get("课"), dict) else {}
    ganzhi_text = ""
    if isinstance(zhanshi.get("占时"), dict):
        ganzhi_text = zhanshi.get("占时", {}).get("干支", "")
    ganzhi = _extract_ganzhi(ganzhi_text)
    rows = [_row(label, ke.get(label, {}) if isinstance(ke.get(label), dict) else {}) for label in ROW_KEYS]
    yong = next((row for row in rows if row.get("isYong")), None)
    plates = []
    for idx in range(1, 13):
        item = pan.get(str(idx), {}) if isinstance(pan.get(str(idx)), dict) else {}
        plates.append({
            "index": idx,
            "di": _clean_text(item.get("地盘")),
            "tian": _clean_text(item.get("天盘")),
            "jiang": _clean_text(item.get("将神")),
            "shen": _clean_text(item.get("神盘")),
            "gui": _clean_text(item.get("贵神")),
        })
    normalized = {
        "source": "kinjinkou",
        "dateStr": data.get("date", ""),
        "timeStr": data.get("time", ""),
        "realSunTime": data.get("realSunTime", ""),
        "jiedelta": data.get("jiedelta", ""),
        "difen": data.get("difen") or (next((row.get("content") for row in rows if row.get("label") == "地分"), "") or ""),
        "yuejiang": _clean_text(zhanshi.get("月将", {}).get("干支") if isinstance(zhanshi.get("月将"), dict) else data.get("yuejiang")),
        "zhanshi": data.get("zhanshi") or _branch(ganzhi.get("time")),
        "siDaKong": _clean_text(zhanshi.get("四大空亡"), "无"),
        "xunKong": "",
        "ganzhi": ganzhi,
        "rows": rows,
        "yongYao": {
            "label": yong.get("label") if yong else "",
            "sign": yong.get("sign") if yong else "",
            "reason": "由 kinjinkou 阴阳用神规则判定" if yong else "",
        },
        "plates": plates,
        "rawText": text,
        "raw": raw,
    }
    normalized["sections"] = _build_sections(normalized)
    return normalized


class JinKouSrv:
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
            second = _to_int(data.get("second"), 0)
            # v2.2.1: 全局日界 + 晚子时·时柱起干 — 直接给 kinjinkou.jinkoujue.jinkoujue_api 设 thread-local。
            # jinkoujue_api.py 是 kinjinkou 真正算 hour pillar 的地方。
            after23_new_day = _to_int(data.get("after23NewDay"), 1)
            late_zi_hour_use_next_day = _to_int(data.get("lateZiHourUseNextDay"), 1)
            try:
                from kinjinkou.jinkoujue import jinkoujue_api as _jk_api
                if hasattr(_jk_api, 'set_after23_new_day'):
                    _jk_api.set_after23_new_day(after23_new_day)
                if hasattr(_jk_api, 'set_hour_gan_use_next_day'):
                    _jk_api.set_hour_gan_use_next_day(late_zi_hour_use_next_day)
            except Exception:
                pass
            difen = _branch(data.get("difen"), "子")
            yuejiang = _branch(data.get("yuejiang")) or None
            zhanshi = _branch(data.get("zhanshi")) or None
            if 1 <= year <= 9999:
                dt = pendulum.datetime(year, month, day, hour, minute, second, tz=_pendulum_tz(data.get("zone")))
            else:
                # 全年份域:pendulum 域限 1~9999;下游 paipan 只读 y/m/d/h/min 五字段,
                # 域外用轻量承载(gangzhi1 已接全域回退,BC/远期口径与主链一致)
                from types import SimpleNamespace
                dt = SimpleNamespace(year=year, month=month, day=day, hour=hour, minute=minute, second=second)
            api = JinkoujueApi()
            raw = _json_safe(api.paipan(dt, difen=difen, yuejiang=yuejiang, zhanshi=zhanshi))
            text = api.print_pan() or ""
            normalized = _normalize(raw, text, {
                **data,
                "difen": difen,
                "yuejiang": yuejiang or "",
                "zhanshi": zhanshi or "",
            })
            return jsonpickle.encode({
                "ResultCode": 0,
                "Result": normalized,
            }, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({
                "ResultCode": 1,
                "Result": "jinkou param error",
            }, unpicklable=False)
