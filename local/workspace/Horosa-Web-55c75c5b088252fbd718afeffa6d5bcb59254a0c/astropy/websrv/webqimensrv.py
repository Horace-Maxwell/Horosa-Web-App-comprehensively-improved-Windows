import os
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_KINQIMEN_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "kinqimen")
if os.path.isfile(os.path.join(_KINQIMEN_SRC, "kinqimen.py")) and _KINQIMEN_SRC not in sys.path:
    sys.path.insert(0, _KINQIMEN_SRC)

import config  # noqa: E402
import kinqimen  # noqa: E402


MODE_LABELS = {
    "year": "年家奇门",
    "hour": "时家奇门",
    "minute": "刻家奇门",
    "golden": "金函玉镜",
    "overall": "综合排盘",
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


def _palace_rows(raw):
    rows = []
    for gua in list("巽離坤震中兌艮坎乾"):
        parts = []
        for label, key in [("天盘", "天盤"), ("地盘", "地盤"), ("门", "門"), ("星", "星"), ("神", "神")]:
            val = raw.get(key, {}).get(gua, "") if isinstance(raw.get(key), dict) else ""
            if val:
                parts.append(f"{label}{val}")
        if parts:
            rows.append({"label": f"{gua}宫", "value": "、".join(parts)})
    return rows


def _build_sections(selected, all_raw, mode, option):
    sections = [{
        "title": "起盘",
        "rows": [
            _row("起盘方式", MODE_LABELS.get(mode, mode)),
            _row("排盘方式", selected.get("排盤方式", {1: "拆補", 2: "置閏", 3: "茅山", 4: "無閏"}.get(option, ""))),
            _row("干支", selected.get("干支")),
            _row("节气", selected.get("節氣")),
            _row("排局", selected.get("排局") or selected.get("局")),
            _row("旬首", selected.get("旬首")),
            _row("旬空", selected.get("旬空")),
            _row("局日", selected.get("局日")),
            _row("天乙", selected.get("天乙")),
        ],
    }]
    zfzs = selected.get("值符值使")
    if isinstance(zfzs, dict):
        sections.append({
            "title": "值符值使",
            "rows": [_row(key, val) for key, val in zfzs.items()],
        })
    palace = _palace_rows(selected)
    if palace:
        sections.append({"title": "九宫", "rows": palace})
    for title, key in [("马星", "馬星"), ("长生运", "長生運"), ("暗干飞干", "暗干")]:
        val = selected.get(key)
        if val:
            rows = [_row(key, val)]
            if key == "暗干" and selected.get("飛干"):
                rows.append(_row("飛干", selected.get("飛干")))
            sections.append({"title": title, "rows": rows})
    golden = all_raw.get("金函玉鏡(日家奇門)") if isinstance(all_raw, dict) else None
    if isinstance(golden, dict):
        sections.append({
            "title": "金函玉镜",
            "rows": [
                _row("局", golden.get("局")),
                _row("鹤神", golden.get("鶴神")),
                _row("星", golden.get("星")),
                _row("门", golden.get("門")),
                _row("神", golden.get("神")),
            ],
        })
    minute = all_raw.get("刻家奇門") if isinstance(all_raw, dict) else None
    if isinstance(minute, dict) and minute is not selected:
        sections.append({
            "title": "刻家奇门",
            "rows": [
                _row("干支", minute.get("干支")),
                _row("排局", minute.get("排局")),
                _row("值符值使", minute.get("值符值使")),
                _row("暗干", minute.get("暗干")),
                _row("飞干", minute.get("飛干")),
            ],
        })
    year_pan = ""
    if isinstance(selected.get("年家"), str):
        year_pan = selected.get("年家")
    elif isinstance(all_raw, dict) and isinstance(all_raw.get("年家奇門"), str):
        year_pan = all_raw.get("年家奇門")
    if year_pan:
        sections.append({"title": "年家", "rows": [_row("年家奇门", year_pan)]})
    return sections


def _mode_result(qimen_obj, mode, option, school="轉盤"):
    if mode == "year":
        return {"年家": qimen_obj.ypan()}
    if mode == "minute":
        return qimen_obj.pan_minute(option)
    if mode == "golden":
        return qimen_obj.gpan()
    if mode == "overall":
        return qimen_obj.pan(option, school)
    return qimen_obj.pan(option, school)


class QiMenSrv:
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
            # v2.2.1: 全局日界 + 晚子时·时柱起干 两个开关。
            # 默认均为 1(现行行为, hour==23 进位 + 时干用次日干起子时)。
            # 仅 hour==23 时影响,其它 23 小时一律 NO-OP。
            # 用 thread-local 设给 kinqimen 引擎,无需改 Qimen 类签名(每个请求独立设)。
            after23_new_day = _to_int(data.get("after23NewDay"), 1)
            late_zi_hour_use_next_day = _to_int(data.get("lateZiHourUseNextDay"), 1)
            # v2.2.1: 通过 sys.modules 拿到已经被 config.py/kinqimen.py 加载的 jieqi 模块。
            # 这是 vendor/kinqimen/jieqi.py (sys.path 加在 module load 时)。
            # ★ 预初始化 None:try 体若在赋值前抛,下面的 memo 分支不得 UnboundLocalError
            #   (webchartsrv.py:291 同类前科)。
            _qm_jieqi = None
            try:
                import sys as _sys
                _qm_jieqi = _sys.modules.get('jieqi')
                if _qm_jieqi is not None and hasattr(_qm_jieqi, 'set_after23_new_day'):
                    _qm_jieqi.set_after23_new_day(after23_new_day)
                if _qm_jieqi is not None and hasattr(_qm_jieqi, 'set_hour_gan_use_next_day'):
                    _qm_jieqi.set_hour_gan_use_next_day(late_zi_hour_use_next_day)
            except Exception:
                pass
            # horosa_qimen_req_memo_v1:必须在两个开关设定**之后** begin(键含开关值只是纵深
            # 防御);begin 即清 ⇒ 异常路径无需 finally(纯函数+含开关键,残留在语义上无害,
            # 下一请求 begin 即清;kill-switch HOROSA_QIMEN_REQ_MEMO 在 jieqi 模块内裁决)。
            if _qm_jieqi is not None and hasattr(_qm_jieqi, 'begin_request_memo'):
                _qm_jieqi.begin_request_memo()
            # 定局法 → option:1拆补/2置闰/3茅山/4无闰(qijuMethod 优先,缺则回退数字 option,默认 2 置闰保持旧默认)
            _qm_option_map = {"chaibu": 1, "zhirun": 2, "maoshan": 3, "wurun": 4}
            option = _qm_option_map.get(_clean_text(data.get("qijuMethod")), _to_int(data.get("option"), 2))
            mode = _clean_text(data.get("qimenMode"), "hour")
            if mode not in MODE_LABELS:
                mode = "hour"
            # 盤式 school:飛盤(洛書飛布九神)/轉盤(預設活盤)。僅時家/綜合分量套用。
            school = "飛盤" if _clean_text(data.get("school")) in ("飞盘", "飛盤") else "轉盤"

            qimen_obj = kinqimen.Qimen(year, month, day, hour, minute)
            selected = _json_safe(_mode_result(qimen_obj, mode, option, school))
            all_raw = _json_safe(qimen_obj.overall(option, school))
            all_raw["年家奇門"] = qimen_obj.ypan()
            if mode == "golden":
                selected["年家"] = qimen_obj.ypan()
            normalized = {
                "source": "kinqimen",
                "engine": "kinqimen",
                "mode": mode,
                "modeLabel": MODE_LABELS.get(mode, mode),
                "dateStr": data.get("date", ""),
                "timeStr": data.get("time", ""),
                "realSunTime": data.get("realSunTime", ""),
                "jiedelta": data.get("jiedelta", ""),
                "qijuMethod": "zhirun" if option == 2 else "chaibu",
                "option": option,
                "school": "飞盘" if school == "飛盤" else "转盘",
                "selected": selected,
                "raw": selected,
                "allRaw": all_raw,
                "sections": _build_sections(selected, all_raw, mode, option),
                "capabilities": {
                    "modes": ["year", "hour", "minute", "golden", "overall"],
                    "methods": ["chaibu", "zhirun"],
                    "unsupportedByKinqimen": ["月家完整盘"],
                },
            }
            return jsonpickle.encode({
                "ResultCode": 0,
                "Result": normalized,
            }, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({
                "ResultCode": -1,
                "Result": "qimen calculation failed",
            }, unpicklable=False)
