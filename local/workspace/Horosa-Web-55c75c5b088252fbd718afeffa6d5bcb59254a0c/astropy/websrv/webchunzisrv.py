import traceback
import re

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    authoritative_pillars,
    build_snapshot,
    clean_text,
    display_safe,
    display_text,
    ensure_kinastro_path,
    gender_cn,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
    source_text,
    timezone_to_float,
    to_int,
)


ensure_kinastro_path()

from astro.chunzi import ChunZiShu, BRANCHES, MANSIONS_28  # noqa: E402
from astro.shaozi import calculate_ganzhi_from_datetime  # noqa: E402


KE_OPTIONS = [{"value": str(item), "label": f"{item}刻"} for item in range(1, 11)]
MANSION_OPTIONS = [{"value": item, "label": item} for item in MANSIONS_28]
RESULT_LIMIT_OPTIONS = [{"value": item, "label": f"{item}条"} for item in (10, 20, 30, 50)]


def _valid(value, choices, fallback):
    text = clean_text(value)
    return text if text in choices else fallback


def _gender_for_chunzi(value):
    return "乾" if gender_cn(value, "男") == "男" else "坤"


def _auto_ke(dt):
    return max(1, min(10, (dt.minute // 12) + 1))


def _verse_to_dict(czs, item):
    code = clean_text(item.get("code"))
    explained = czs.explain(code) if code else {}
    return {
        "code": display_text(code),
        "rawCode": code,
        "category": display_text(item.get("category")),
        "star": display_text(item.get("star")),
        "degree": item.get("degree"),
        "branch": display_text(item.get("branch")),
        "mansion28": display_text(item.get("mansion28")),
        "sevenGovernors": display_text(item.get("seven_governors")),
        "verse": display_text(item.get("verse")),
        "explain": display_safe(explained),
    }


def _chart_verse_to_dict(czs, item):
    data = json_safe(item)
    return _verse_to_dict(czs, {
        "code": data.get("code"),
        "category": data.get("category"),
        "star": data.get("star"),
        "degree": data.get("degree"),
        "branch": data.get("branch"),
        "verse": data.get("verse"),
        "mansion28": data.get("category"),
        "seven_governors": data.get("star"),
    })


def _rows_for_verses(verses, limit=12):
    rows = []
    for item in verses[:limit]:
        head = [
            item.get("category"),
            item.get("star"),
            f"{item.get('degree')}度" if item.get("degree") else "",
            item.get("branch"),
        ]
        rows.append(row(
            item.get("code"),
            f"{' · '.join([clean_text(part) for part in head if clean_text(part)])}｜{item.get('verse')}",
        ))
    return rows


def _split_codes(value):
    text = clean_text(value)
    if not text:
        return []
    return [item for item in re.split(r"[\s,，、;；]+", text) if clean_text(item)]


def _build_sections(pan):
    chunzi = pan.get("chunzi", {})
    analysis = chunzi.get("analysis", {}) or {}
    parents = analysis.get("parents", {}) or {}
    spouse = analysis.get("spouse", {}) or {}
    children = analysis.get("children", {}) or {}
    search = chunzi.get("search", {}) or {}
    lookup = search.get("lookup") or {}
    lookup_results = search.get("lookupResults") or {}
    keyword = search.get("keyword") or {}
    tags = search.get("tags") or {}
    mansion = search.get("mansion") or {}
    hour = search.get("hour") or {}
    limit = max(5, min(50, to_int(chunzi.get("resultLimit"), 20)))
    rows = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("性别", pan.get("gender")),
                row("时区", pan.get("timezoneText")),
                row("刻法", chunzi.get("keModeLabel")),
                row("刻", chunzi.get("keValueLabel")),
                row("月日匹配", chunzi.get("lunarModeLabel")),
                row("农历月日", chunzi.get("lunarText")),
                row("显示数量", f"{limit}条"),
            ],
        },
        {
            "title": "四柱",
            "rows": [row(item.get("label"), item.get("ganzhi")) for item in chunzi.get("pillars", [])],
        },
        {
            "title": "代码来源",
            "rows": [
                row("时辰候选", len(chunzi.get("hourCodes", []))),
                row("月日候选", len(chunzi.get("monthDayCodes", []))),
                row("起盘代码", chunzi.get("codes")),
                row("条文库", chunzi.get("verseCount")),
            ],
        },
        {
            "title": "结构解析",
            "rows": [
                row("父母", {
                    "父属": parents.get("father"),
                    "母属": parents.get("mother"),
                    "父先亡": parents.get("father_first"),
                    "母先亡": parents.get("mother_first"),
                }),
                row("妻宫", {
                    "属相": spouse.get("zodiac"),
                    "侧室": spouse.get("concubine"),
                    "再娶": spouse.get("remarriage"),
                }),
                row("子息", {
                    "数量": children.get("count"),
                    "带石皮": children.get("stone_skin"),
                }),
                row("事业", analysis.get("career")),
                row("刑冲", analysis.get("conflicts")),
                row("寿元", analysis.get("longevity")),
                row("特记", analysis.get("flags")),
            ],
        },
        {
            "title": "候选条文",
            "rows": _rows_for_verses(chunzi.get("verses", []), limit=limit),
        },
    ]
    if lookup:
        rows.append({"title": "代码查询", "rows": _rows_for_verses([lookup], limit=1)})
    if lookup_results.get("codes"):
        rows.append({
            "title": "批量代码查询",
            "rows": [
                row("代码", lookup_results.get("codes")),
                row("命中数", lookup_results.get("count")),
                *_rows_for_verses(lookup_results.get("results", []), limit=limit),
            ],
        })
    if keyword.get("keyword"):
        rows.append({
            "title": "关键词检索",
            "rows": [
                row("关键词", keyword.get("keyword")),
                row("命中数", keyword.get("count")),
                *_rows_for_verses(keyword.get("results", []), limit=limit),
            ],
        })
    if tags.get("tags"):
        rows.append({
            "title": "多标签检索",
            "rows": [
                row("标签", tags.get("tags")),
                row("命中数", tags.get("count")),
                *_rows_for_verses(tags.get("results", []), limit=limit),
            ],
        })
    if mansion.get("mansion"):
        rows.append({
            "title": "宿名检索",
            "rows": [
                row("宿名", mansion.get("mansion")),
                row("命中数", mansion.get("count")),
                *_rows_for_verses(mansion.get("results", []), limit=limit),
            ],
        })
    if hour.get("branch"):
        rows.append({
            "title": "时辰检索",
            "rows": [
                row("时辰", f"{hour.get('branch')}时"),
                row("命中数", hour.get("count")),
                *_rows_for_verses(hour.get("results", []), limit=limit),
            ],
        })
    return rows


class ChunZiSrv:
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
            gender = _gender_for_chunzi(data.get("gender"))
            gz = calculate_ganzhi_from_datetime(dt, data.get("after23NewDay", 1))
            # 🔴 标准四柱换全局权威口径(立春界/定气月/儒略JDN,全域含 BC)。
            #    现代域两者一致=零回归;1/2 月未过立春与 BC 年才有差(那正是要修的)。
            #    取不到权威实现时保留旧值,故用 update 而非整体替换。
            _auth_gz = authoritative_pillars(dt, data)
            if _auth_gz:
                gz = dict(gz)
                gz.update(_auth_gz)
            pillars = [
                {"key": "year", "label": "年柱", "ganzhi": display_text(gz["year"])},
                {"key": "month", "label": "月柱", "ganzhi": display_text(gz["month"])},
                {"key": "day", "label": "日柱", "ganzhi": display_text(gz["day"])},
                {"key": "hour", "label": "时柱", "ganzhi": display_text(gz["hour"])},
            ]

            auto_ke = _auto_ke(dt)
            ke_mode = clean_text(data.get("chunziKeMode") or data.get("keMode"), "auto")
            if ke_mode not in ("auto", "manual", "none"):
                ke_mode = "auto"
            manual_ke = max(1, min(10, to_int(data.get("chunziKe") or data.get("ke"), auto_ke)))
            selected_ke = None if ke_mode == "none" else (manual_ke if ke_mode == "manual" else auto_ke)
            result_limit = max(5, min(50, to_int(data.get("chunziResultLimit") or data.get("resultLimit"), 20)))

            lunar_mode = clean_text(data.get("chunziLunarMode") or data.get("lunarMode"), "auto")
            if lunar_mode not in ("auto", "manual", "none"):
                lunar_mode = "auto"
            lunar_month = None
            lunar_day = None
            if lunar_mode != "none":
                lunar_month = max(1, min(12, to_int(data.get("chunziLunarMonth") or data.get("lunarMonth"), dt.month)))
                lunar_day = max(1, min(30, to_int(data.get("chunziLunarDay") or data.get("lunarDay"), min(30, dt.day))))

            czs = ChunZiShu()
            chart = czs.cast_chart(
                gender,
                gz["year"],
                gz["month"],
                gz["day"],
                gz["hour"],
                ke=selected_ke,
                lunar_month=lunar_month,
                lunar_day=lunar_day,
            )
            hour_codes = czs.get_hour_codes(gender, gz["hour"], ke=selected_ke)
            month_day_codes = czs.get_month_day_codes(gender, lunar_month, lunar_day) if lunar_month and lunar_day else []
            verses = [_chart_verse_to_dict(czs, item) for item in chart.verses]

            lookup_code = clean_text(data.get("chunziLookupCode") or data.get("lookupCode"))
            lookup_code_source = source_text(lookup_code)
            keyword = clean_text(data.get("chunziKeyword") or data.get("keyword"))
            keyword_source = source_text(keyword)
            tag_text = clean_text(data.get("chunziTags") or data.get("tags"))
            tags = [item.strip() for item in tag_text.replace("，", ",").split(",") if item.strip()]
            source_tags = [source_text(item) for item in tags]
            mansion_name = _valid(data.get("chunziMansion") or data.get("mansion"), MANSIONS_28, "室")
            hour_branch = _valid(data.get("chunziHourBranch") or data.get("hourBranch"), BRANCHES, gz["hour"][1])

            search = {}
            lookup_codes = _split_codes(lookup_code)
            source_lookup_codes = [source_text(item) for item in lookup_codes]
            if lookup_codes:
                lookup = czs.get_verse(source_lookup_codes[0])
                if lookup:
                    search["lookup"] = _verse_to_dict(czs, lookup)
                else:
                    search["lookup"] = {"code": display_text(lookup_codes[0]), "verse": "未找到此代码"}
                if len(lookup_codes) > 1:
                    batch_items = [_verse_to_dict(czs, item) for item in czs.batch_lookup(source_lookup_codes)]
                    search["lookupResults"] = {
                        "codes": [display_text(item) for item in lookup_codes],
                        "count": len([item for item in batch_items if item.get("verse") and "无此代码" not in item.get("verse")]),
                        "results": batch_items,
                    }
            if keyword:
                items = [_verse_to_dict(czs, item) for item in czs.search(keyword_source, limit=result_limit)]
                search["keyword"] = {"keyword": display_text(keyword), "count": len(items), "results": items}
            if tags:
                items = [_verse_to_dict(czs, item) for item in czs.search_by_tags(source_tags, limit=result_limit)]
                search["tags"] = {"tags": [display_text(item) for item in tags], "count": len(items), "results": items}
            if mansion_name:
                items = [_verse_to_dict(czs, item) for item in czs.get_verses_by_mansion(mansion_name, limit=result_limit)]
                search["mansion"] = {"mansion": display_text(mansion_name), "count": len(items), "results": items}
            if hour_branch:
                items = [_verse_to_dict(czs, item) for item in czs.get_verses_by_hour(hour_branch)[:result_limit]]
                search["hour"] = {"branch": display_text(hour_branch), "count": len(items), "results": items}

            chunzi = {
                "genderCode": gender,
                "genderLabel": "乾造" if gender == "乾" else "坤造",
                "pillars": pillars,
                "bazi": " ".join([item["ganzhi"] for item in pillars]),
                "keMode": ke_mode,
                "keModeLabel": {"auto": "自动换算", "manual": "手动指定", "none": "不取刻数"}[ke_mode],
                "keValue": selected_ke,
                "keValueLabel": f"{selected_ke}刻" if selected_ke else "不取",
                "autoKe": auto_ke,
                "lunarMode": lunar_mode,
                "lunarModeLabel": {"auto": "随当前日期", "manual": "手动月日", "none": "关闭"}[lunar_mode],
                "lunarMonth": lunar_month,
                "lunarDay": lunar_day,
                "lunarText": f"{lunar_month}月{lunar_day}日" if lunar_month and lunar_day else "不取",
                "resultLimit": result_limit,
                "codes": [display_text(item) for item in chart.codes],
                "hourCodes": [display_text(item) for item in hour_codes],
                "monthDayCodes": [display_text(item) for item in month_day_codes],
                "verses": verses,
                "analysis": display_safe(chart.analysis),
                "search": search,
                "verseCount": len(czs.df),
                "raw": json_safe(chart.to_dict()),
            }
            pan = {
                "source": "kinastro",
                "engine": "kinastro-chunzi",
                "technique": "chunzi",
                "title": "蠢子数",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "gender": gender_cn(data.get("gender"), "男"),
                "timezone": timezone_value,
                "timezoneText": f"UTC{timezone_value:+g}",
                "chunzi": chunzi,
                "classics": kinastro_source_sections("蠢子数", "接入 kinastro 的蠢子数纏度资料库，以二十八宿、七政四余、度数和地支组成代码，按时辰、刻数、农历月日与关键词检索候选条文。"),
                "capabilities": {
                    "inputs": ["date", "time", "timezone", "gender", "keMode", "ke", "lunarMode", "lunarMonth", "lunarDay", "lookupCode", "keyword", "tags", "mansion", "hourBranch", "resultLimit"],
                    "outputs": ["fourPillars", "hourCandidates", "monthDayCandidates", "verseLookup", "batchLookup", "keywordSearch", "tagSearch", "mansionSearch", "parsedFamilySpouseChildren"],
                    "keOptions": KE_OPTIONS,
                    "mansionOptions": MANSION_OPTIONS,
                    "hourBranches": [{"value": item, "label": item} for item in BRANCHES],
                    "resultLimitOptions": RESULT_LIMIT_OPTIONS,
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "chunzi calculation failed"}, unpicklable=False)
