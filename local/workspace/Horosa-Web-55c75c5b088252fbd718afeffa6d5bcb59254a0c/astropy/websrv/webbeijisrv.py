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
    to_int,
    format_timezone_label,
    timezone_to_float,
)


ensure_kinastro_path()

from astro.beiji.calculator import compute_beiji, compute_ke, get_calculator  # noqa: E402
from astro.beiji.constants import KE_LABELS  # noqa: E402


KE_OPTIONS = [{"value": str(idx + 1), "label": display_text(label)} for idx, label in enumerate(KE_LABELS)]
QUERY_GROUPS = {
    "family": {"parents", "siblings", "first_wife_surname", "remarriage_wife_surname", "children"},
    "fortune": {"character", "wealth", "career", "health"},
}


def _query_to_dict(item):
    data = json_safe(item)
    extra = data.get("extra") or {}
    return {
        "type": clean_text(data.get("query_type")),
        "label": display_text(data.get("query_label")),
        "palaceCode": data.get("palace_code"),
        "palaceName": display_text(data.get("palace_name")),
        "code": clean_text(data.get("code")),
        "verse": display_text(data.get("verse")),
        "surname": display_text(data.get("surname")),
        "extra": json_safe(extra),
    }


def _dayun_to_dict(item):
    data = json_safe(item)
    return {
        "index": data.get("index"),
        "stemBranch": display_text(data.get("stem_branch")),
        "direction": display_text(data.get("direction")),
        "startAge": data.get("start_age"),
        "endAge": data.get("end_age"),
        "palace": data.get("palace"),
        "code": clean_text(data.get("code")),
        "verse": display_text(data.get("verse")),
    }


def _query_rows(queries):
    rows = []
    for item in queries:
        detail = [
            f"{item.get('palaceName')}宫",
            f"码 {item.get('code')}",
            f"姓 {item.get('surname')}" if item.get("surname") else "",
        ]
        rows.append(row(item.get("label"), " · ".join([part for part in detail if part])))
        rows.append(row(f"{item.get('label')}断语", item.get("verse")))
    return rows


def _search_rows(search):
    rows = []
    lookup = search.get("lookup") or {}
    if lookup:
        rows.append(row(f"代碼 {lookup.get('code')}", lookup.get("verse")))
    keyword = clean_text(search.get("keyword"))
    results = search.get("results") or []
    if keyword:
        rows.append(row("关键词", keyword))
        rows.append(row("命中数", search.get("count")))
        for item in results:
            rows.append(row(f"码 {item.get('code')}", item.get("verse")))
    return rows


def _build_sections(pan):
    beiji = pan.get("beiji", {})
    queries = beiji.get("queries", [])
    dayun = beiji.get("dayun", [])
    family = [item for item in queries if item.get("type") in QUERY_GROUPS["family"]]
    fortune = [item for item in queries if item.get("type") in QUERY_GROUPS["fortune"]]
    start_rows = [
        row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
        row("性别", pan.get("gender")),
        row("时区", pan.get("timezoneText")),
        row("刻法", beiji.get("keModeLabel")),
        row("刻", f"{beiji.get('keValue')}（{beiji.get('keLabel')}）"),
    ]
    if beiji.get("keMode") == "manual":
        start_rows.append(row("自动刻", f"{beiji.get('autoKeValue')}（{beiji.get('autoKeLabel')}）"))
    sections = [
        {
            "title": "起盘",
            "rows": start_rows,
        },
        {
            "title": "年时",
            "rows": [
                row("年干", beiji.get("yearStem")),
                row("年支", beiji.get("yearBranch")),
                row("生肖", beiji.get("yearShengxiao")),
                row("时辰", f"{beiji.get('hourBranch')}时"),
            ],
        },
        {
            "title": "条文索引",
            "rows": [
                row("条文库", beiji.get("verseCount")),
                row("查询数", len(queries)),
                row("大运数", len(dayun)),
                row("列号", beiji.get("colIndex")),
            ],
        },
        {"title": "家亲", "rows": _query_rows(family)},
        {"title": "财官性情", "rows": _query_rows(fortune)},
        {
            "title": "大运",
            "rows": [
                row(
                    f"第{item.get('index')}运 {item.get('startAge')}-{item.get('endAge')}岁",
                    f"{item.get('stemBranch')} · {item.get('direction')}行 · 码 {item.get('code')} · {item.get('verse')}",
                )
                for item in dayun
            ],
        },
        {"title": "完整条文", "rows": _query_rows(queries)},
    ]
    search_rows = _search_rows(beiji.get("search") or {})
    if search_rows:
        sections.insert(4, {"title": "条文检索", "rows": search_rows})
    return sections


class BeiJiSrv:
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
            gender = gender_cn(data.get("gender"), "男")
            timezone_value = timezone_to_float(data.get("zone") or data.get("timezone"), 8.0)
            auto_ke = compute_ke(dt.hour, dt.minute)
            manual_ke = max(1, min(8, to_int(data.get("beijiKe") or data.get("keValue") or data.get("ke"), auto_ke)))
            ke_mode = clean_text(data.get("beijiKeMode") or data.get("keMode"), "auto")
            use_manual_ke = ke_mode == "manual" or bool(data.get("useKe"))
            selected_ke = manual_ke if use_manual_ke else auto_ke
            lookup_code = clean_text(data.get("beijiLookupCode") or data.get("lookupCode"))
            lookup_code = "".join([char for char in lookup_code if char.isdigit()])[:4]
            keyword = clean_text(data.get("beijiKeyword") or data.get("keyword"))

            result = compute_beiji(
                year=dt.year,
                month=dt.month,
                day=dt.day,
                hour=dt.hour,
                minute=dt.minute,
                gender=gender,
                ke=selected_ke,
            )
            calc = get_calculator()
            queries = [_query_to_dict(item) for item in result.queries]
            dayun = [_dayun_to_dict(item) for item in calc.calculate_dayun(result.birth_input)]
            search = {}
            if len(lookup_code) == 4:
                search["lookup"] = {"code": lookup_code, "verse": display_text(calc.lookup(lookup_code))}
            if len(keyword) >= 2:
                matches = [(code, display_text(verse)) for code, verse in calc.search_verses(keyword)]
                search["keyword"] = display_text(keyword)
                search["count"] = len(matches)
                search["results"] = [
                    {"code": clean_text(code), "verse": display_text(verse)}
                    for code, verse in matches[:20]
                ]
                search["truncated"] = len(matches) > 20
            query_groups = {
                "family": [item for item in queries if item.get("type") in QUERY_GROUPS["family"]],
                "fortune": [item for item in queries if item.get("type") in QUERY_GROUPS["fortune"]],
            }
            col_indices = [
                (item.get("extra") or {}).get("col_index")
                for item in queries
                if (item.get("extra") or {}).get("col_index")
            ]
            beiji = {
                "yearStem": display_text(result.year_stem),
                "yearBranch": display_text(result.year_branch),
                "yearShengxiao": display_text(result.year_shengxiao),
                "hourBranch": display_text(result.hour_branch),
                "keValue": result.ke_value,
                "keLabel": display_text(result.ke_label),
                "keMode": "manual" if use_manual_ke else "auto",
                "keModeLabel": "手动指定" if use_manual_ke else "自动换算",
                "autoKeValue": auto_ke,
                "autoKeLabel": display_text(KE_LABELS[auto_ke - 1]),
                "colIndex": col_indices[0] if col_indices else "",
                "queries": queries,
                "queryGroups": query_groups,
                "dayun": dayun,
                "search": search,
                "verseCount": len(calc.db),
                "raw": json_safe(result),
            }
            pan = {
                "source": "kinastro",
                "engine": "kinastro-beiji",
                "technique": "beiji",
                "title": "北极神数",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "gender": gender,
                "timezone": timezone_value,
                "timezoneText": format_timezone_label(timezone_value),
                "beiji": beiji,
                "classics": kinastro_source_sections("北极神数", "接入 kinastro 的北极神数，以出生年、月、日、时、刻与性别推定年干支、时辰、九项条文查询与八步大运。"),
                "capabilities": {
                    "inputs": ["date", "time", "timezone", "gender", "keMode", "ke", "lookupCode", "keyword"],
                    "outputs": ["yearStemBranch", "hourBranch", "ke", "queryResults", "dayun", "verseLibrary", "lookup", "search"],
                    "keOptions": KE_OPTIONS,
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "beiji calculation failed"}, unpicklable=False)
