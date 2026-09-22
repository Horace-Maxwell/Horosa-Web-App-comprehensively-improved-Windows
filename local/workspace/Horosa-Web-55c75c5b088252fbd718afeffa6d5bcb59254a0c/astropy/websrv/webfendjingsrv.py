import traceback

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    build_snapshot,
    clean_text,
    display_text,
    ensure_kinastro_path,
    gender_cn,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
    timezone_to_float,
)


ensure_kinastro_path()

from astro.fendjing import compute_fendjing_chart  # noqa: E402
from astro.fendjing.fendjing_calculator import TIANGAN, load_twogan_data  # noqa: E402


STEM_OPTIONS = [{"value": item, "label": item} for item in TIANGAN]
TEXT_KEYS = ("判斷", "命格", "基業", "兄弟", "行藏", "婚姻", "子息", "收成")


def _valid_stem(value, fallback):
    text = clean_text(value)
    return text if text in TIANGAN else fallback


def _mingge_name(mingge):
    if isinstance(mingge, (list, tuple)) and mingge:
        return display_text(mingge[0])
    return display_text(mingge)


def _mingge_text(mingge):
    if isinstance(mingge, (list, tuple)):
        return "\n".join([display_text(item) for item in mingge[1:] if clean_text(item)])
    return display_text(mingge)


def _apply_manual_twogan(chart, year_stem, hour_stem):
    key = f"{year_stem}{hour_stem}"
    twogan_data = load_twogan_data()
    text = twogan_data.get(key, {})
    next_chart = dict(chart)
    next_chart["two_gan_key"] = key
    for item in TEXT_KEYS:
        next_chart[item] = text.get(item, "")
    return next_chart


def _build_sections(pan):
    fendjing = pan.get("fendjing", {})
    pillars = pan.get("pillars", [])
    six_sections = fendjing.get("sections", {})
    return [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("性别", pan.get("gender")),
                row("时区", pan.get("timezoneText")),
                row("两头钳来源", "手动指定" if fendjing.get("stemOverride") else "年干与时干自动换算"),
            ],
        },
        {"title": "四柱", "rows": [row(item.get("label"), item.get("ganzhi")) for item in pillars]},
        {
            "title": "两头钳",
            "rows": [
                row("两头钳", fendjing.get("twoGanKey")),
                row("年干", fendjing.get("yearStem")),
                row("时干", fendjing.get("hourStem")),
                row("组合库", fendjing.get("dataSize")),
            ],
        },
        {
            "title": "命格",
            "rows": [
                row("格名", fendjing.get("minggeName")),
                row("格文", fendjing.get("minggeText")),
            ],
        },
        {"title": "判断", "rows": [row("判断", fendjing.get("judgment"))]},
        {
            "title": "六段断语",
            "rows": [
                row("基业", six_sections.get("foundation")),
                row("兄弟", six_sections.get("siblings")),
                row("行藏", six_sections.get("conduct")),
                row("婚姻", six_sections.get("marriage")),
                row("子息", six_sections.get("children")),
                row("收成", six_sections.get("harvest")),
            ],
        },
    ]


class FenDingJingSrv:
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
            dt = parse_datetime(data)
            timezone_value = timezone_to_float(data.get("zone") or data.get("timezone"), 8.0)
            chart = compute_fendjing_chart(
                dt.year,
                dt.month,
                dt.day,
                dt.hour,
                dt.minute,
                timezone=timezone_value,
                after23_new_day=data.get("after23NewDay", 1),
                hour_gan_use_next_day=data.get("lateZiHourUseNextDay", 1),   # [Q-264/T-247] 全局「晚子时」
            )
            stem_override = bool(data.get("stemOverride"))
            year_stem = _valid_stem(data.get("yearStem"), chart.get("year_gz", "甲")[0])
            hour_stem = _valid_stem(data.get("hourStem"), chart.get("hour_gz", "甲")[0])
            if stem_override:
                chart = _apply_manual_twogan(chart, year_stem, hour_stem)
            else:
                year_stem = chart.get("year_gz", "甲")[0]
                hour_stem = chart.get("hour_gz", "甲")[0]

            twogan_data = load_twogan_data()
            mingge = chart.get("命格") or []
            pillars = [
                {"key": "year", "label": "年柱", "ganzhi": chart.get("year_gz")},
                {"key": "month", "label": "月柱", "ganzhi": chart.get("month_gz")},
                {"key": "day", "label": "日柱", "ganzhi": chart.get("day_gz")},
                {"key": "hour", "label": "时柱", "ganzhi": chart.get("hour_gz")},
            ]
            fendjing = {
                "twoGanKey": display_text(chart.get("two_gan_key")),
                "yearStem": display_text(year_stem),
                "hourStem": display_text(hour_stem),
                "stemOverride": stem_override,
                "judgment": display_text(chart.get("判斷")),
                "minggeName": _mingge_name(mingge),
                "minggeText": _mingge_text(mingge),
                "sections": {
                    "foundation": display_text(chart.get("基業")),
                    "siblings": display_text(chart.get("兄弟")),
                    "conduct": display_text(chart.get("行藏")),
                    "marriage": display_text(chart.get("婚姻")),
                    "children": display_text(chart.get("子息")),
                    "harvest": display_text(chart.get("收成")),
                },
                "dataSize": len(twogan_data),
                "raw": json_safe(chart),
            }
            pan = {
                "source": "kinastro",
                "engine": "kinastro-fendjing",
                "technique": "fendjing",
                "title": "鬼谷分定经",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "gender": gender_cn(data.get("gender"), "男"),
                "timezone": timezone_value,
                "timezoneText": f"UTC{timezone_value:+g}",
                "pillars": pillars,
                "fendjing": fendjing,
                "classics": kinastro_source_sections("鬼谷分定经", "接入 kinastro 的鬼谷分定经两头钳，以出生年干与时干组合调用上游 twogan 数据库，并展示命格、判断与六段古文断语。"),
                "capabilities": {
                    "inputs": ["date", "time", "timezone", "gender", "stemOverride", "yearStem", "hourStem"],
                    "outputs": ["fourPillars", "twoGan", "mingge", "judgment", "lifeSections"],
                    "stemOptions": STEM_OPTIONS,
                    "twoGanCombinations": len(twogan_data),
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "fendjing calculation failed"}, unpicklable=False)
