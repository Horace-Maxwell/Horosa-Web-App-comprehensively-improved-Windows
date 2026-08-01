import traceback

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    authoritative_pillars,
    build_snapshot,
    clean_text,
    ensure_kinastro_path,
    gender_cn,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
)


ensure_kinastro_path()

from astro.shaozi import (  # noqa: E402
    ShaoziBirthData,
    ShaoziFullShenShu,
    ShaoziShenShu,
    calculate_ganzhi_from_datetime,
)


KE_OPTIONS = ["初刻", "二刻", "三刻", "四刻", "五刻", "六刻", "七刻", "八刻"]
GANZHI_STEMS = "甲乙丙丁戊己庚辛壬癸"
GANZHI_BRANCHES = "子丑寅卯辰巳午未申酉戌亥"


def _normalize_ganzhi(value, fallback):
    text = clean_text(value)
    if len(text) == 2 and text[0] in GANZHI_STEMS and text[1] in GANZHI_BRANCHES:
        return text
    return fallback


def _result_attr(result, name, default=""):
    return getattr(result, name, default)


def _build_sections(pan):
    basic = pan.get("basic", {})
    pillars = pan.get("pillars", [])
    shaozi = pan.get("shaozi", {})
    full = pan.get("full", {})
    key = full.get("key", {}) or {}
    yuanhui = full.get("yuanhui", {}) or {}

    sections = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("性别", pan.get("gender")),
                row("刻数", pan.get("ke")),
                row("64钥匙细调", "启用" if pan.get("useKey") else "关闭"),
                row("四柱来源", "手动覆写" if pan.get("pillarOverride") else "自动换算"),
            ],
        },
        {
            "title": "四柱",
            "rows": [row(item.get("label"), item.get("ganzhi")) for item in pillars],
        },
        {
            "title": "四位起数",
            "rows": [
                row("年位", f"{shaozi.get('yearDigit')}（{shaozi.get('guaYear')}）"),
                row("月位", f"{shaozi.get('monthDigit')}（{shaozi.get('guaMonth')}）"),
                row("日位", f"{shaozi.get('dayDigit')}（{shaozi.get('guaDay')}）"),
                row("时位", f"{shaozi.get('hourDigit')}（{shaozi.get('guaHour')}）"),
                row("条文号", shaozi.get("tiaowenId")),
                row("集", shaozi.get("collection")),
                row("卦名", shaozi.get("guaName")),
            ],
        },
        {
            "title": "河洛纳音",
            "rows": [
                row("年河洛", shaozi.get("heLuoYear")),
                row("日河洛", shaozi.get("heLuoDay")),
                row("年纳音", shaozi.get("nayinYear")),
                row("日纳音", shaozi.get("nayinDay")),
                row("日主五行", shaozi.get("dayElement")),
            ],
        },
        {
            "title": "完整结构",
            "rows": [
                row("基础数", full.get("base_number")),
                row("条文编号", full.get("tiaowen_id")),
                row("卦象", full.get("gua")),
                row("天干总数", (full.get("calculation") or {}).get("天干總數")),
                row("地支总数", (full.get("calculation") or {}).get("地支總數")),
                row("河洛数", (full.get("calculation") or {}).get("河洛數")),
                row("天数成卦", (full.get("calculation") or {}).get("天數成卦")),
                row("地数成卦", (full.get("calculation") or {}).get("地數成卦")),
            ],
        },
        {
            "title": "64钥匙",
            "rows": [
                row("钥匙名", key.get("名稱")),
                row("说明", key.get("說明")),
                row("特殊事项", key.get("特殊事項")),
                row("时辰信息", key.get("時辰資訊")),
                row("运限信息", key.get("運限資訊")),
                row("命格指标", key.get("命格指標")),
                row("常用标记", {
                    "克妻": key.get("has_克妻"),
                    "过房": key.get("has_過房"),
                    "填房": key.get("has_填房"),
                    "贵子": key.get("has_貴子"),
                    "孤": key.get("has_孤"),
                    "泰": key.get("has_泰"),
                    "否": key.get("has_否"),
                }),
            ],
        },
        {
            "title": "元会运世",
            "rows": [
                row("推定年份", yuanhui.get("birth_year")),
                row("周期", yuanhui.get("cycles")),
                row("人生阶段", yuanhui.get("life_stage")),
                row("时代阶段", yuanhui.get("era_stage")),
                row("错误", yuanhui.get("error")),
            ],
        },
        {
            "title": "条文",
            "rows": [
                row("基础条文", shaozi.get("tiaowenText")),
                row("完整条文", full.get("tiaowen_text")),
            ],
        },
    ]
    return sections


class ShaoZiSrv:
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
            ke = clean_text(data.get("ke"), "初刻")
            if ke not in KE_OPTIONS:
                ke = "初刻"
            use_key = bool(data.get("useKey", True))
            gender = gender_cn(data.get("gender"), "男")
            # v2.2.1: 同时传 after23 + lateZi 双开关
            gz = calculate_ganzhi_from_datetime(dt, data.get("after23NewDay", 1), data.get("lateZiHourUseNextDay", 1))
            # 🔴 标准四柱换全局权威口径(立春界/定气月/儒略JDN,全域含 BC)。
            #    现代域两者一致=零回归;1/2 月未过立春与 BC 年才有差(那正是要修的)。
            #    取不到权威实现时保留旧值,故用 update 而非整体替换。
            _auth_gz = authoritative_pillars(dt, data)
            if _auth_gz:
                gz = dict(gz)
                gz.update(_auth_gz)
            override_values = [data.get("yearGz"), data.get("monthGz"), data.get("dayGz"), data.get("hourGz")]
            pillar_override = any(clean_text(item) for item in override_values)
            year_gz = _normalize_ganzhi(data.get("yearGz"), gz["year"])
            month_gz = _normalize_ganzhi(data.get("monthGz"), gz["month"])
            day_gz = _normalize_ganzhi(data.get("dayGz"), gz["day"])
            hour_gz = _normalize_ganzhi(data.get("hourGz"), gz["hour"])

            engine = ShaoziShenShu()
            result = engine.calculate(ShaoziBirthData(
                birth_dt=dt,
                year_gz=year_gz,
                month_gz=month_gz,
                day_gz=day_gz,
                hour_gz=hour_gz,
                gender=gender,
            ))
            full = json_safe(ShaoziFullShenShu().cast_plate(
                year_gz=year_gz,
                month_gz=month_gz,
                day_gz=day_gz,
                hour_gz=hour_gz,
                ke=ke,
                use_key=use_key,
            ))

            pillars = [
                {"key": "year", "label": "年柱", "ganzhi": year_gz},
                {"key": "month", "label": "月柱", "ganzhi": month_gz},
                {"key": "day", "label": "日柱", "ganzhi": day_gz},
                {"key": "hour", "label": "时柱", "ganzhi": hour_gz},
            ]
            shaozi = {
                "yearDigit": _result_attr(result, "year_digit"),
                "monthDigit": _result_attr(result, "month_digit"),
                "dayDigit": _result_attr(result, "day_digit"),
                "hourDigit": _result_attr(result, "hour_digit"),
                "tiaowenId": _result_attr(result, "tiaowen_id"),
                "guaName": _result_attr(result, "gua_name"),
                "tiaowenText": _result_attr(result, "tiaowen_text"),
                "collection": _result_attr(result, "collection"),
                "guaYear": _result_attr(result, "gua_year"),
                "guaMonth": _result_attr(result, "gua_month"),
                "guaDay": _result_attr(result, "gua_day"),
                "guaHour": _result_attr(result, "gua_hour"),
                "heLuoYear": _result_attr(result, "he_luo_year"),
                "heLuoDay": _result_attr(result, "he_luo_day"),
                "nayinYear": _result_attr(result, "nayin_year"),
                "nayinDay": _result_attr(result, "nayin_day"),
                "dayElement": _result_attr(result, "day_element"),
                "note": _result_attr(result, "note"),
            }
            pan = {
                "source": "kinastro",
                "engine": "kinastro-shaozi",
                "technique": "shaozi",
                "title": "邵子神数",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "gender": gender,
                "ke": ke,
                "useKey": use_key,
                "pillarOverride": pillar_override,
                "pillars": pillars,
                "basic": json_safe(result),
                "shaozi": shaozi,
                "full": full,
                "classics": kinastro_source_sections("邵子神数", "洛书九宫起集、后天八卦配卦、四位条文号与 64 钥匙细调。"),
                "capabilities": {
                    "inputs": ["date", "time", "gender", "ke", "useKey", "yearGz", "monthGz", "dayGz", "hourGz"],
                    "outputs": ["fourPillars", "fourDigits", "tiaowen", "helu", "nayin", "fullStructure", "64Keys", "yuanhui"],
                    "keOptions": KE_OPTIONS,
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "shaozi calculation failed"}, unpicklable=False)
