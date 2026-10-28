import os
import sys
import sys as _sys
import traceback

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.horosa_engine_common import (
    require_civil_ymd as _require_civil_ymd,
    clean_text as _clean_text,
    plain_json_safe as _json_safe,
    plain_row as _row,
    to_int as _to_int,
)


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
            _require_civil_ymd(year, month, day)   # 不存在的日期报错(改历缺口 / 2 月 30 日 / 公元 0 年)
            # v2.2.1: 全局日界 + 晚子时·时柱起干 两个开关。
            # 默认均为 1(现行行为, hour==23 进位 + 时干用次日干起子时)。
            # 仅 hour==23 时影响,其它 23 小时一律 NO-OP。
            # 用 thread-local 设给 kinqimen 引擎,无需改 Qimen 类签名(每个请求独立设)。
            after23_new_day = _to_int(data.get("after23NewDay"), 1)
            late_zi_hour_use_next_day = _to_int(data.get("lateZiHourUseNextDay"), 1)
            # v2.2.1: 通过 sys.modules 拿到已经被 config.py/kinqimen.py 加载的 jieqi 模块
            # (vendor/kinqimen/jieqi.py,sys.path 加在 module load 时)。两个开关是 jieqi 的线程局部量:
            # 设不上就整请求报错(绝不静默沿用本线程上一个请求的口径);算完在 finally 里撤掉,不留到下一请求。
            _qm_jieqi = _sys.modules.get('jieqi')
            if _qm_jieqi is None or not hasattr(_qm_jieqi, 'set_after23_new_day') \
                    or not hasattr(_qm_jieqi, 'set_hour_gan_use_next_day'):
                raise RuntimeError('kinqimen 日界开关不可用')
            _qm_jieqi.set_after23_new_day(after23_new_day)
            _qm_jieqi.set_hour_gan_use_next_day(late_zi_hour_use_next_day)
            # horosa_qimen_req_memo_v1:必须在两个开关设定**之后** begin(键含开关值只是纵深防御);
            # begin 即清,finally 里 end + 撤开关(kill-switch HOROSA_QIMEN_REQ_MEMO 在 jieqi 模块内裁决)。
            if hasattr(_qm_jieqi, 'begin_request_memo'):
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
        finally:
            _qm = _sys.modules.get('jieqi')
            if _qm is not None:
                if hasattr(_qm, 'end_request_memo'):
                    _qm.end_request_memo()
                if hasattr(_qm, 'clear_request_switches'):
                    _qm.clear_request_switches()
