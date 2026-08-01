import traceback

import cherrypy
import jsonpickle
import swisseph as swe

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    build_snapshot,
    clean_text,
    ensure_kinastro_path,
    gender_cn,
    gender_mf,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
    to_int,
    timezone_to_float,
)


ensure_kinastro_path()

# 策天引擎已摘出至自有树(astrostudy);此处仅复用其朔望月换算工具。
from astrostudy.cetian_ziwei import _solar_to_lunar  # noqa: E402
from astro.chinstar.chinstar import (  # noqa: E402
    BRANCHES,
    HOSTS,
    MONTH_STAR_START,
    NOBLE_DESC,
    PAIRING_TABLE,
    PALACE_NAMES,
    PERSONALITY_DICT,
    POOR_DESC,
    QIN_ELEMENT,
    QIN_NAMES,
    SAN_YUAN_TABLE,
    SEASON_QIN,
    SWALLOW_RULES,
    WanHuaXianQin,
    ZHENG_XIANG_DICT,
    lookup_fulu_patterns,
    lookup_gui_ge,
    lookup_jian_ge,
    lookup_pinjian_patterns,
    lookup_xiangtai,
)


CALENDAR_MODES = {
    "autoLunar": "自动换算农历",
    "manualLunar": "手动农历",
    "solarAsLunar": "公历数值入式",
}


def _lunar_from_solar(dt, timezone):
    jd = swe.julday(dt.year, dt.month, dt.day, dt.hour + dt.minute / 60.0 - timezone)
    lunar_year, lunar_month, lunar_day, is_leap = _solar_to_lunar(jd)
    return lunar_year, lunar_month, lunar_day, is_leap


def _normalize_palette():
    return [
        {
            "host": host,
            "qin": qin,
            "element": QIN_ELEMENT.get(qin, ""),
        }
        for host, qin in zip(HOSTS, QIN_NAMES)
    ]


def _build_palace_cards(chart):
    twelve = ((chart.get("palaces") or {}).get("twelve") or {})
    stars = chart.get("stars") or {}
    derived = (chart.get("stars") or {}).get("derived") or {}
    star_map = [
        (("命",), "命星", stars.get("ming_xing")),
        (("財帛", "财帛"), "财帛星", derived.get("財帛星") or derived.get("财帛星")),
        (("兄弟",), "兄弟星", derived.get("兄弟星")),
        (("田宅",), "田宅星", derived.get("田宅星")),
        (("子女", "子息"), "子息星", derived.get("子息星")),
        (("奴僕", "奴仆"), "奴仆星", derived.get("奴僕星") or derived.get("奴仆星")),
        (("夫妻", "妻妾"), "妻妾星", derived.get("妻妾星")),
        (("疾厄",), "疾厄星", derived.get("疾厄星")),
        (("遷移", "迁移"), "迁移星", derived.get("遷移星") or derived.get("迁移星")),
        (("官祿", "官禄"), "官禄星", derived.get("官祿星") or derived.get("官禄星")),
        (("福德",), "福德星", derived.get("福德星")),
        (("相貌",), "相貌星", derived.get("相貌星")),
    ]

    def normalize(value):
        return (
            str(value or "")
            .replace("宮", "宫")
            .replace("財", "财")
            .replace("僕", "仆")
            .replace("遷", "迁")
            .replace("祿", "禄")
            .replace("妾", "妻")
            .replace("宫", "")
        )

    def palace_star_line(name):
        normalized_name = normalize(name)
        for names, label, qin in star_map:
            if qin and any(normalize(item) in normalized_name for item in names):
                return f"{label}：{qin}"
        return ""

    cards = []
    for idx, (name, branch) in enumerate(twelve.items()):
        matched = [item for item in [palace_star_line(name)] if item]
        cards.append({
            "key": f"{idx}_{name}",
            "name": name,
            "branch": branch,
            "stars": matched,
        })
    return cards


def _build_sections(pan):
    chart = pan.get("xianqin", {})
    basic = chart.get("basic_info", {}) or {}
    palaces = chart.get("palaces", {}) or {}
    stars = chart.get("stars", {}) or {}
    pattern = chart.get("pattern", {}) or {}
    literature = pan.get("literature", {}) or {}
    dayun = chart.get("dayun", {}) or {}
    liunian = chart.get("liunian", []) or []
    shensha = chart.get("shensha", {}) or {}
    sections = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("入式历法", pan.get("calendarModeLabel")),
                row("农历年", basic.get("year")),
                row("农历月", basic.get("month")),
                row("农历日", basic.get("day")),
                row("小时", basic.get("hour")),
                row("性别", basic.get("gender")),
                row("三元", basic.get("san_yuan")),
                row("昼夜", basic.get("day_night")),
                row("季令", basic.get("season")),
            ],
        },
        {
            "title": "三宫",
            "rows": [
                row("胎宫", (palaces.get("tai_gong") or {}).get("branch")),
                row("命宫", (palaces.get("ming_gong") or {}).get("branch")),
                row("身宫", (palaces.get("shen_gong") or {}).get("branch")),
            ],
        },
        {
            "title": "三星·元辰",
            "rows": [
                row("胎星", stars.get("tai_xing")),
                row("命星", stars.get("ming_xing")),
                row("身星", stars.get("shen_xing")),
                row("元辰禽", stars.get("yuanchen_xing")),
            ],
        },
        {
            "title": "大限",
            "rows": (
                [
                    row("起运虚岁", dayun.get("start_age")),
                    row("行限方向", "顺行" if dayun.get("forward") else "逆行"),
                    row("命宫天干", dayun.get("palace_stem")),
                ]
                + [
                    row(f"{lim.get('age_start')}-{lim.get('age_end')}岁", lim.get("palace_branch") + "宫")
                    for lim in dayun.get("limits", [])
                ]
                + [row("方向说明", dayun.get("note"))]
            ),
        },
        {
            "title": "流年小限",
            "rows": (
                [row("起法", "胎星起一岁,逐年一宿往前演(胎斗→一岁斗、二岁牛…)")]
                + [row(f"{item.get('age')}岁", item.get("qin")) for item in liunian[:12]]
            ),
        },
        {
            "title": "神煞·待校",
            "rows": [
                row("孤辰", (shensha.get("guchen") or "") + "宫" if shensha.get("guchen") else None),
                row("寡宿", (shensha.get("guasu") or "") + "宫" if shensha.get("guasu") else None),
                row("鉴形赋", "开篇:三才奠位,五行化生。主旨:颜回仁学早岁夭亡,盗跖凶顽年高矍铄(论穷达寿夭)。中段逐字待纸本核。"),
                row("三世相", "体系B(前世/今生/来世·三世书):以生年尾数配农历生月查财禄/田园/婚姻表。三世书表逐字待纸本核,本期未算。"),
            ],
        },
        {
            "title": "衍生星",
            "rows": [row(key, value) for key, value in (stars.get("derived") or {}).items()],
        },
        {
            "title": "十二宫",
            "rows": [row(key, value) for key, value in (palaces.get("twelve") or {}).items()],
        },
        {
            "title": "吞啖合战",
            "rows": [row(key, value) for key, value in (chart.get("swallow_analysis") or {}).items()],
        },
        {
            "title": "情性与格局",
            "rows": [
                row("胎星情性", (chart.get("personality") or {}).get("tai_xing")),
                row("命星情性", (chart.get("personality") or {}).get("ming_xing")),
                row("格局", pattern.get("grade")),
                row("判语", pattern.get("reason")),
                row("相胎赋", literature.get("xiangtai")),
                row("贵格", literature.get("gui")),
                row("贱格", literature.get("jian")),
                row("福禄上格", literature.get("fulu")),
                row("贫贱下命", literature.get("pinjian")),
            ],
        },
        {
            "title": "二十八宿禽",
            "rows": [row(item["host"], f"{item['qin']} · {item['element']}") for item in pan.get("palette", [])],
        },
        {
            "title": "十二宫顺序",
            "rows": [row(str(idx + 1), name) for idx, name in enumerate(PALACE_NAMES)],
        },
        {
            "title": "三元起宿",
            "rows": [row(key, value) for key, value in SAN_YUAN_TABLE.items()],
        },
        {
            "title": "合宿表",
            "rows": [row(key, value) for key, value in PAIRING_TABLE.items()],
        },
        {
            "title": "科名月宿",
            "rows": [row(f"{key}月", value) for key, value in MONTH_STAR_START.items()],
        },
        {
            "title": "四季得时",
            "rows": [row(key, value) for key, value in SEASON_QIN.items()],
        },
        {
            "title": "情性赋全表",
            "rows": [row(key, value) for key, value in PERSONALITY_DICT.items()],
        },
        {
            "title": "二十八宿正像",
            "rows": [row(key, value) for key, value in ZHENG_XIANG_DICT.items()],
        },
        {
            "title": "吞啖合战规则",
            "rows": [row(key, value) for key, value in SWALLOW_RULES.items()],
        },
        {
            "title": "贵贱赋摘要",
            "rows": [
                row("古人贵赋", NOBLE_DESC),
                row("古人贱赋", POOR_DESC),
            ],
        },
    ]
    return sections


class XianQinSrv:
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
            mode = clean_text(data.get("calendarMode"), "autoLunar")
            if mode not in CALENDAR_MODES:
                mode = "autoLunar"
            timezone = timezone_to_float(data.get("zone") or data.get("timezone"), 8.0)
            is_leap = False
            if mode == "manualLunar":
                lunar_year = to_int(data.get("lunarYear"), dt.year)
                lunar_month = max(1, min(12, to_int(data.get("lunarMonth"), dt.month)))
                lunar_day = max(1, min(30, to_int(data.get("lunarDay"), dt.day)))
            elif mode == "solarAsLunar":
                lunar_year, lunar_month, lunar_day = dt.year, dt.month, min(30, dt.day)
            else:
                lunar_year, lunar_month, lunar_day, is_leap = _lunar_from_solar(dt, timezone)

            gender = gender_mf(data.get("gender"), "M")
            chart = json_safe(WanHuaXianQin().build_chart(lunar_year, lunar_month, lunar_day, dt.hour, gender))
            stars = chart.get("stars", {}) or {}
            tai_xing = stars.get("tai_xing", "")
            ming_xing = stars.get("ming_xing", "")
            literature = {
                "xiangtai": lookup_xiangtai(ming_xing, tai_xing),
                "gui": lookup_gui_ge(tai_xing) + lookup_gui_ge(ming_xing),
                "jian": lookup_jian_ge(tai_xing) + lookup_jian_ge(ming_xing),
                "fulu": lookup_fulu_patterns(tai_xing) + lookup_fulu_patterns(ming_xing),
                "pinjian": lookup_pinjian_patterns(tai_xing) + lookup_pinjian_patterns(ming_xing),
            }
            pan = {
                "source": "kinastro",
                "engine": "kinastro-xianqin",
                "technique": "xianqin",
                "title": "万化仙禽",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "calendarMode": mode,
                "calendarModeLabel": CALENDAR_MODES[mode],
                "timezone": timezone,
                "lunar": {
                    "year": lunar_year,
                    "month": lunar_month,
                    "day": lunar_day,
                    "isLeap": is_leap,
                },
                "gender": gender_cn(data.get("gender"), "男"),
                "xianqin": chart,
                "palaceCards": _build_palace_cards(chart),
                "palette": _normalize_palette(),
                "literature": json_safe(literature),
                "rules": {
                    "palaceNames": json_safe(PALACE_NAMES),
                    "sanYuanTable": json_safe(SAN_YUAN_TABLE),
                    "pairingTable": json_safe(PAIRING_TABLE),
                    "monthStarStart": json_safe(MONTH_STAR_START),
                    "seasonQin": json_safe(SEASON_QIN),
                    "personality": json_safe(PERSONALITY_DICT),
                    "zhengXiang": json_safe(ZHENG_XIANG_DICT),
                    "swallowRules": json_safe(SWALLOW_RULES),
                },
                "classics": kinastro_source_sections("万化仙禽", "二十八宿禽星、十二宫、吞啖合战、相胎赋与贵贱格。"),
                "capabilities": {
                    "inputs": ["date", "time", "gender", "calendarMode", "lunarYear", "lunarMonth", "lunarDay"],
                    "outputs": ["sanYuan", "taiGong", "mingGong", "shenGong", "taiMingShenStars", "derivedStars", "swallow", "personality", "patterns", "xiangtai", "guijian", "palaceRules", "pairing", "seasonRules", "zhengXiang"],
                    "calendarModes": [{"key": key, "label": label} for key, label in CALENDAR_MODES.items()],
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "xianqin calculation failed"}, unpicklable=False)
