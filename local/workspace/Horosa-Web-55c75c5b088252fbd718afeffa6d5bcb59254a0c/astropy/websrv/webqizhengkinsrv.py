import traceback
from datetime import datetime

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    annotate_day_boundary,
    day_boundary_of,
    build_snapshot,
    clean_text,
    coord_to_float,
    display_safe,
    display_text,
    ensure_kinastro_path,
    gender_cn,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
    to_int,
    timezone_to_float,
    civil_ymd_valid,
    vendor_civil_date,
    vendor_civil_ymd,
    vendor_greg_ymd,
)


ensure_kinastro_path()

from astro.qizheng.calculator import compute_chart  # noqa: E402
from astro.qizheng.constants import (  # noqa: E402
    EARTHLY_BRANCHES,
    TWENTY_EIGHT_MANSIONS_ANCIENT,
    TWENTY_EIGHT_MANSIONS_LIMING,
    ZODIAC_SIGN_ELEMENTS,
)
from astro.qizheng.ming_gong_interp import get_li_ming_text, get_planet_in_ming_text  # noqa: E402
from astro.qizheng.qizheng_electional import ACTIVITY_TYPES, find_auspicious_dates  # noqa: E402
from astro.qizheng.qizheng_dasha import compute_dasha  # noqa: E402
from astro.qizheng.qizheng_transit import compute_transit, compute_transit_now  # noqa: E402
from astro.qizheng.shensha import compute_shensha, get_bazi_stems_branches  # noqa: E402
from astro.qizheng.zhangguo import compute_zhangguo  # noqa: E402


def _fmt_degree(value, digits=2):
    try:
        num = float(value)
    except Exception:
        return "—"
    return f"{num:.{digits}f}°"


def _fmt_time(data, dt):
    date_text = clean_text(data.get("date"), dt.strftime("%Y-%m-%d")).replace("/", "-")
    time_text = clean_text(data.get("time"), dt.strftime("%H:%M:%S"))
    return date_text, time_text


_SIGN_IDX_TO_BRANCH = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11]


def _normalize_degree(value):
    try:
        return float(value) % 360.0
    except Exception:
        return 0.0


def _ecl_to_mansion_text(lon):
    lon = _normalize_degree(lon)
    sign_idx = int(lon / 30.0)
    sign_deg_float = lon - sign_idx * 30.0
    branch_idx = _SIGN_IDX_TO_BRANCH[sign_idx]
    branch_name = EARTHLY_BRANCHES[branch_idx]
    sign_elem = ZODIAC_SIGN_ELEMENTS[sign_idx]
    deg_int = int(sign_deg_float)
    remaining = (sign_deg_float - deg_int) * 60.0
    arc_min = int(remaining)
    arc_sec = round((remaining - arc_min) * 60.0)
    if arc_sec == 60:
        arc_sec = 0
        arc_min += 1
    if arc_min == 60:
        arc_min = 0
        deg_int += 1
    if deg_int >= 30:
        deg_int = 0
    return f"{deg_int:02d}{branch_name}{sign_elem}{arc_min:02d}'{arc_sec:02d}"


def _mansion_for_lon(lon, mansion_list):
    lon = _normalize_degree(lon)
    ordered = sorted(mansion_list, key=lambda item: _normalize_degree(item.get("start_lon", 0)))
    selected = ordered[-1] if ordered else {}
    next_item = ordered[0] if ordered else {}
    for idx, item in enumerate(ordered):
        start = _normalize_degree(item.get("start_lon", 0))
        if lon >= start:
            selected = item
            next_item = ordered[(idx + 1) % len(ordered)]
        else:
            break
    start_lon = _normalize_degree(selected.get("start_lon", lon))
    if lon < start_lon:
        lon += 360.0
    return selected, next_item, lon - start_lon


def _mansion_system_to_dict(chart, mansion_list, label):
    boundaries = []
    for item in mansion_list:
        boundaries.append({
            "name": f"{item.get('name')}{item.get('element')}",
            "animal": item.get("animal"),
            "group": item.get("group"),
            "position": _ecl_to_mansion_text(item.get("start_lon")),
        })
    planets = []
    for planet in chart.planets:
        mansion, _next, degree = _mansion_for_lon(planet.longitude, mansion_list)
        mansion_start = _normalize_degree(mansion.get("start_lon", planet.longitude))
        planets.append(display_safe({
            "name": planet.name,
            "element": planet.element,
            "mansion": mansion.get("name"),
            "mansionElement": mansion.get("element"),
            "mansionDegree": _ecl_to_mansion_text(mansion_start + degree),
            "zodiacPosition": _ecl_to_mansion_text(planet.longitude),
            "altitude": _fmt_degree(getattr(planet, "altitude", 0.0), 1),
            "status": "逆行" if planet.retrograde else "顺行",
        }))
    return display_safe({
        "label": label,
        "boundaries": boundaries,
        "planets": planets,
    })


def _parse_civil_ymd(value, fallback):
    """'YYYY-MM-DD' / 'YYYY/MM/DD'(可带负号、不足 4 位或 5 位年;历史纪年)→ (年, 月, 日);
    空 / 读不出 / 不存在的日期 → fallback(三元组)。"""
    text = clean_text(value, "")
    if not text:
        return fallback
    head = text.split(" ")[0].replace("/", "-")
    neg = head.startswith("-")
    parts = head.lstrip("-").split("-")
    try:
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    except Exception:
        return fallback
    if neg:
        y = -y
    if y == 0 or not civil_ymd_valid(y, m, d):
        return fallback
    return y, m, d


def _parse_iso_time(value, fallback):
    text = clean_text(value, "")
    if not text:
        return fallback.hour, fallback.minute
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.hour, parsed.minute
        except Exception:
            pass
    return fallback.hour, fallback.minute


def _gender_vendor(value):
    return "female" if gender_cn(value, "男") == "女" else "male"


def _planet_to_dict(planet):
    return display_safe({
        "name": planet.name,
        "longitude": planet.longitude,
        "longitudeText": _fmt_degree(planet.longitude),
        "latitude": planet.latitude,
        "latitudeText": _fmt_degree(planet.latitude),
        "signWestern": planet.sign_western,
        "signChinese": planet.sign_chinese,
        "signDegree": planet.sign_degree,
        "signDegreeText": _fmt_degree(planet.sign_degree),
        "element": planet.element,
        "retrograde": planet.retrograde,
        "status": "逆行" if planet.retrograde else "顺行",
        "palaceIndex": planet.palace_index,
        "mansionName": planet.mansion_name,
        "mansionDegree": planet.mansion_degree,
        "mansionText": f"{planet.mansion_name}{_fmt_degree(planet.mansion_degree)}" if planet.mansion_name else "—",
        "signElement": planet.sign_element,
        "isQidu": planet.is_qidu,
        "altitude": planet.altitude,
        "altitudeText": _fmt_degree(planet.altitude),
    })


def _house_to_dict(house, planets, shensha_map):
    house_planets = [_planet_to_dict(p) for p in planets if getattr(p, "palace_index", -1) == house.index]
    gods = shensha_map.get(house.branch, [])
    return display_safe({
        "index": house.index,
        "name": house.name,
        "branch": house.branch,
        "branchName": house.branch_name,
        "cusp": house.cusp,
        "cuspText": _fmt_degree(house.cusp),
        "signWestern": house.sign_western,
        "signChinese": house.sign_chinese,
        "planets": house_planets,
        "shensha": gods,
    })


def _dasha_to_dict(result):
    data = json_safe(result)
    periods = display_safe(data.get("periods", []))
    current_idx = data.get("current_period_idx", -1)
    current = periods[current_idx] if isinstance(current_idx, int) and 0 <= current_idx < len(periods) else None
    return display_safe({
        "periods": periods,
        "currentIndex": current_idx,
        "current": current,
        "currentAge": data.get("current_age"),
        "flowYearBranch": data.get("flow_year_branch"),
        "flowYearBranchName": EARTHLY_BRANCHES[data.get("flow_year_branch")] if isinstance(data.get("flow_year_branch"), int) and data.get("flow_year_branch") >= 0 else "",
        "flowYearPalace": data.get("flow_year_palace"),
    })


def _shensha_to_dict(result):
    raw_items = json_safe(result.items)
    items = []
    for item in raw_items:
        branch = item.get("branch")
        items.append(display_safe({
            **item,
            "branchName": EARTHLY_BRANCHES[branch] if isinstance(branch, int) and 0 <= branch < len(EARTHLY_BRANCHES) else "",
        }))
    branch_map = {}
    for key, values in result.branch_map.items():
        name = EARTHLY_BRANCHES[key] if 0 <= key < len(EARTHLY_BRANCHES) else str(key)
        branch_map[name] = display_safe(values)
    return {
        "items": items,
        "branchMap": branch_map,
    }


def _zhangguo_to_dict(result):
    readings = display_safe(json_safe(result.matched_readings))
    patterns = display_safe(json_safe(result.all_patterns))
    grouped = {}
    for item in patterns:
        category = item.get("category") or "其他"
        grouped.setdefault(category, []).append(item)
    return {
        "readings": readings,
        "patternCount": len(patterns),
        "patternsByCategory": grouped,
    }


def _transit_to_dict(result):
    # vendor 回写的是交进去的格里历年月日 → 换回民用历再显示
    year, month, day = vendor_civil_ymd(result.year, result.month, result.day)
    return display_safe({
        "year": year,
        "month": month,
        "day": day,
        "hour": result.hour,
        "minute": result.minute,
        "timezone": result.timezone,
        "julianDay": result.julian_day,
        "planets": [_planet_to_dict(item) for item in result.planets],
    })


def _electional_to_dict(result):
    data = json_safe(result)
    dates = []
    for item in data.get("rated_dates", [])[:30]:
        dates.append(display_safe({
            "date": vendor_civil_date(item.get("date")),
            "weekday": item.get("weekday"),
            "stemBranch": item.get("stem_branch"),
            "score": item.get("score"),
            "auspiciousStars": item.get("auspicious_stars", []),
            "inauspiciousStars": item.get("inauspicious_stars", []),
            "suitableFor": item.get("suitable_for", []),
            "avoid": item.get("avoid", []),
        }))
    criteria = data.get("criteria") or "general"
    activity = ACTIVITY_TYPES.get(criteria, ACTIVITY_TYPES["general"])
    return display_safe({
        "startDate": vendor_civil_date(data.get("start_date")),
        "endDate": vendor_civil_date(data.get("end_date")),
        "criteria": criteria,
        "criteriaName": activity.get("cn"),
        "bestDate": vendor_civil_date(data.get("best_date")),
        "ratedDates": dates,
    })


def _mansions_to_dict(chart):
    return [
        _mansion_system_to_dict(chart, TWENTY_EIGHT_MANSIONS_LIMING, "今制"),
        _mansion_system_to_dict(chart, TWENTY_EIGHT_MANSIONS_ANCIENT, "古制"),
    ]


def _build_sections(pan):
    qz = pan.get("qizheng", {})
    chart = qz.get("chart", {})
    bazi = qz.get("bazi", {})
    rows = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("地点", pan.get("location")),
                row("时区", pan.get("timezoneText")),
                row("性别", pan.get("gender")),
                row("经度", pan.get("longitudeText")),
                row("纬度", pan.get("latitudeText")),
                row("节气月", chart.get("solarMonth")),
                row("时辰", chart.get("hourBranchName")),
                row("命宫地支", chart.get("mingGongBranchName")),
                row("上升", chart.get("ascendantText")),
                row("中天", chart.get("midheavenText")),
                row("立命", chart.get("limingText")),
            ],
        },
        {
            "title": "四柱",
            "rows": [
                row("年柱", bazi.get("year_pillar")),
                row("月柱", bazi.get("month_pillar")),
                row("日柱", bazi.get("day_pillar")),
                row("时柱", bazi.get("hour_pillar")),
            ],
        },
        {
            "title": "星曜",
            "rows": [
                row(item.get("name"), {
                    "星次": item.get("signChinese"),
                    "西座": item.get("signWestern"),
                    "星度": item.get("signDegreeText"),
                    "宿度": item.get("mansionText"),
                    "黄经": item.get("longitudeText"),
                    "纬度": item.get("latitudeText"),
                    "高度": item.get("altitudeText"),
                    "五行": item.get("element"),
                    "状态": item.get("status"),
                    "岐度": "是" if item.get("isQidu") else "否",
                })
                for item in qz.get("planets", [])
            ],
        },
        {
            "title": "十二宫",
            "rows": [
                row(item.get("name"), {
                    "地支": item.get("branchName"),
                    "星次": item.get("signChinese"),
                    "宫头": item.get("cuspText"),
                    "星曜": [p.get("name") for p in item.get("planets", [])],
                    "神煞": item.get("shensha", [])[:8],
                })
                for item in qz.get("houses", [])
            ],
        },
    ]
    if qz.get("shensha", {}).get("items"):
        rows.append({
            "title": "神煞",
            "rows": [
                row(branch, names)
                for branch, names in (qz.get("shensha", {}).get("branchMap") or {}).items()
            ],
        })
    if qz.get("dasha", {}).get("periods"):
        dasha = qz.get("dasha", {})
        rows.append({
            "title": "年限",
            "rows": [
                row("当前年龄", dasha.get("currentAge")),
                row("当前大限", dasha.get("current")),
                row("流年", f"{dasha.get('flowYearBranchName')}｜{dasha.get('flowYearPalace')}"),
                *[
                    row(item.get("palace_name") or item.get("palaceName"), f"{item.get('start_age', item.get('startAge'))}-{item.get('end_age', item.get('endAge'))}岁｜{item.get('lord')}｜{item.get('branch_name', item.get('branchName'))}")
                    for item in dasha.get("periods", [])
                ],
            ],
        })
    if qz.get("transit"):
        rows.append({
            "title": "流时",
            "rows": [
                row("流时", f"{qz['transit'].get('year')}-{qz['transit'].get('month')}-{qz['transit'].get('day')} {qz['transit'].get('hour')}:{qz['transit'].get('minute')}"),
                *[
                    row(item.get("name"), {
                        "星次": item.get("signChinese"),
                        "星度": item.get("signDegreeText"),
                        "宿度": item.get("mansionText"),
                        "状态": item.get("status"),
                    })
                    for item in qz["transit"].get("planets", [])
                ],
            ],
        })
    if qz.get("electional", {}).get("ratedDates"):
        electional = qz.get("electional", {})
        rows.append({
            "title": "择日",
            "rows": [
                row("用途", electional.get("criteriaName")),
                row("日期范围", f"{electional.get('startDate')} 至 {electional.get('endDate')}"),
                row("首选日期", electional.get("bestDate")),
                *[
                    row(f"{item.get('date')} {item.get('weekday')} {item.get('stemBranch')}", {
                        "评分": item.get("score"),
                        "吉星": item.get("auspiciousStars"),
                        "忌星": item.get("inauspiciousStars"),
                        "宜": item.get("suitableFor"),
                        "忌": item.get("avoid"),
                    })
                    for item in electional.get("ratedDates", [])[:12]
                ],
            ],
        })
    if qz.get("mansions"):
        for system in qz.get("mansions", []):
            rows.append({
                "title": f"{system.get('label')}宿度",
                "rows": [
                    row("宿界", "  ".join([
                        f"{item.get('name')}: {item.get('position')}"
                        for item in system.get("boundaries", [])
                    ])),
                    *[
                        row(item.get("name"), {
                            "五行": item.get("element"),
                            "入宿": item.get("mansion"),
                            "宿元素": item.get("mansionElement"),
                            "入宿度": item.get("mansionDegree"),
                            "黄道位置": item.get("zodiacPosition"),
                            "高度角": item.get("altitude"),
                            "状态": item.get("status"),
                        })
                        for item in system.get("planets", [])
                    ],
                ],
            })
    if qz.get("zhangguo", {}).get("readings"):
        rows.append({
            "title": "张果断语",
            "rows": [
                row(f"{item.get('star')}临{item.get('branch')}", f"{item.get('reading_type') or item.get('readingType')}｜{item.get('description')}")
                for item in qz.get("zhangguo", {}).get("readings", [])[:24]
            ],
        })
    if qz.get("mingGong", {}).get("items"):
        rows.append({
            "title": "命宫解读",
            "rows": [
                row(item.get("title"), item.get("text"))
                for item in qz.get("mingGong", {}).get("items", [])
            ],
        })
    return rows


class QiZhengKinSrv:
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
            pan = compute_qizheng_kin_pan(data)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "qizheng kinastro calculation failed"}, unpicklable=False)


def compute_qizheng_kin_pan(data):
    """请求体 → 七政四余(kinastro 引擎)整盘。HTTP 入口与测试共用。"""
    dt = parse_datetime(data)
    timezone_value = timezone_to_float(data.get("zone") or data.get("timezone"), 8.0)
    lat = coord_to_float(data.get("gpsLat") or data.get("lat"), 0.0)
    lon = coord_to_float(data.get("gpsLon") or data.get("lon"), 0.0)
    location_name = clean_text(data.get("pos") or data.get("locationName") or data.get("location"), "星阙地点")
    gender_value = _gender_vendor(data.get("gender"))
    date_text, time_text = _fmt_time(data, dt)

    # vendor 引擎按外推格里历读年月日:换成同一天的格里历再交(1582 以后恒等)
    birth_gy, birth_gm, birth_gd = vendor_greg_ymd(dt.year, dt.month, dt.day)
    chart = compute_chart(
        birth_gy,
        birth_gm,
        birth_gd,
        dt.hour,
        dt.minute,
        timezone_value,
        lat,
        lon,
        location_name=location_name,
        gender=gender_value,
    )
    # 用戶語義（拍板,字面直覺版）:
    #   after23NewDay=1「23点算第二天」=23時起日柱進位次日(jd+1)
    #   after23NewDay=0「24点算第二天」=23時仍守今(jd 不變)
    # v2.2.1 第二全局开关 lateZi(hour_gan_use_next_day):
    #   lateZi=1(默认): 時柱跨日按"次日日干"起子時(=庚子,與 lunar.js Exact 一致)
    #   lateZi=0: 時柱跟日柱一致(同一 cdate 的日干起子時)
    # 仅 hour==23 时两开关生效,其它 23 小时一律 NO-OP。
    _db = day_boundary_of(data)
    after23 = _db["after23NewDay"]
    late_zi = _db["lateZiHourUseNextDay"]
    jd_for_day = chart.julian_day + (1.0 if dt.hour == 23 and after23 else 0.0)
    if dt.hour == 23:
        if late_zi:
            # lateZi=1: 时柱用次日日干起子时
            jd_for_hour = chart.julian_day + 1.0
        else:
            # lateZi=0: 时柱跟日柱一致
            jd_for_hour = jd_for_day
    else:
        jd_for_hour = chart.julian_day
    shensha = compute_shensha(
        dt.year,
        chart.solar_month,
        jd_for_day,
        chart.hour_branch,
        timezone_value,
        chart.ming_gong_branch,
    )
    # 八字四柱:日柱用 jd_for_day,時柱用 jd_for_hour(獨立計算)。
    bazi_day_part = get_bazi_stems_branches(
        dt.year,
        chart.solar_month,
        jd_for_day,
        chart.hour_branch,
        timezone_value,
    )
    bazi_hour_part = get_bazi_stems_branches(
        dt.year,
        chart.solar_month,
        jd_for_hour,
        chart.hour_branch,
        timezone_value,
    )
    # 覆蓋時柱: 用 jd_for_hour 算出的 hour_stem/hour_pillar 替換。
    bazi_day_part["hour_stem"] = bazi_hour_part["hour_stem"]
    bazi_day_part["hour_pillar"] = bazi_hour_part["hour_pillar"]
    bazi = display_safe(bazi_day_part)
    current_year = max(1, to_int(data.get("qizhengKinCurrentYear") or data.get("currentYear"), datetime.now().year))
    dasha = compute_dasha(dt.year, chart.ming_gong_branch, gender_value, chart.houses, current_year=current_year)
    zhangguo = compute_zhangguo(chart.planets, chart.houses, gender=gender_value)
    electional_days = max(1, min(60, to_int(data.get("qizhengKinElectionalDays") or data.get("electionalDays"), 30)))
    electional_criteria = clean_text(data.get("qizhengKinElectionalCriteria") or data.get("electionalCriteria"), "general")
    if electional_criteria not in ACTIVITY_TYPES:
        electional_criteria = "general"
    es_y, es_m, es_d = _parse_civil_ymd(data.get("qizhengKinElectionalStartDate") or data.get("electionalStartDate"), (dt.year, dt.month, dt.day))
    el_sy, el_sm, el_sd = vendor_greg_ymd(es_y, es_m, es_d)
    el_ey, el_em, el_ed = vendor_greg_ymd(es_y, es_m, es_d, add_days=electional_days - 1)
    electional = find_auspicious_dates(
        el_sy,
        el_sm,
        el_sd,
        el_ey,
        el_em,
        el_ed,
        timezone=timezone_value,
        criteria=electional_criteria,
    )

    transit_mode = clean_text(data.get("qizhengKinTransitMode") or data.get("transitMode"), "none")
    transit = None
    if transit_mode == "now":
        transit = compute_transit_now(timezone_value)
    elif transit_mode == "same":
        transit = compute_transit(birth_gy, birth_gm, birth_gd, dt.hour, dt.minute, timezone_value)
    elif transit_mode == "custom":
        tr_y, tr_m, tr_d = _parse_civil_ymd(data.get("qizhengKinTransitDate") or data.get("transitDate"), (dt.year, dt.month, dt.day))
        transit_hour, transit_minute = _parse_iso_time(data.get("qizhengKinTransitTime") or data.get("transitTime"), dt)
        transit_gy, transit_gm, transit_gd = vendor_greg_ymd(tr_y, tr_m, tr_d)
        transit = compute_transit(
            transit_gy,
            transit_gm,
            transit_gd,
            transit_hour,
            transit_minute,
            timezone_value,
        )

    shensha_data = _shensha_to_dict(shensha)
    planets = [_planet_to_dict(item) for item in chart.planets]
    houses = [_house_to_dict(item, chart.planets, shensha.branch_map) for item in chart.houses]
    ming_branch_name = EARTHLY_BRANCHES[chart.ming_gong_branch] if 0 <= chart.ming_gong_branch < len(EARTHLY_BRANCHES) else ""
    ming_house = next((h for h in chart.houses if h.branch == chart.ming_gong_branch), None)
    ming_planets = [p for p in chart.planets if ming_house and p.palace_index == ming_house.index]
    ming_items = []
    li_text = get_li_ming_text(ming_branch_name)
    if li_text:
        ming_items.append({"title": f"立命{ming_branch_name}", "text": display_text(li_text)})
    for planet in ming_planets:
        text = get_planet_in_ming_text(planet.name)
        if text:
            ming_items.append({"title": f"{display_text(planet.name)}入命", "text": display_text(text)})

    qizheng = {
        "chart": display_safe({
            "julianDay": chart.julian_day,
            "ascendant": chart.ascendant,
            "ascendantText": _fmt_degree(chart.ascendant),
            "midheaven": chart.midheaven,
            "midheavenText": _fmt_degree(chart.midheaven),
            "liming": chart.liming_lon,
            "limingText": _fmt_degree(chart.liming_lon),
            "solarMonth": chart.solar_month,
            "hourBranch": chart.hour_branch,
            "hourBranchName": EARTHLY_BRANCHES[chart.hour_branch],
            "mingGongBranch": chart.ming_gong_branch,
            "mingGongBranchName": ming_branch_name,
        }),
        "bazi": bazi,
        "planets": planets,
        "houses": houses,
        "shensha": shensha_data,
        "dasha": _dasha_to_dict(dasha),
        "transit": _transit_to_dict(transit) if transit else None,
        "electional": _electional_to_dict(electional),
        "zhangguo": _zhangguo_to_dict(zhangguo),
        "mansions": _mansions_to_dict(chart),
        "mingGong": {
            "branch": ming_branch_name,
            "house": display_text(ming_house.name) if ming_house else "",
            "planets": [display_text(item.name) for item in ming_planets],
            "items": ming_items,
        },
    }
    pan = {
        "source": "kinastro",
        "engine": "kinastro-qizheng",
        "technique": "qizheng",
        "title": "七政四余",
        "dateStr": date_text,
        "timeStr": time_text,
        "gender": gender_cn(data.get("gender"), "男"),
        "timezone": timezone_value,
        "timezoneText": f"UTC{timezone_value:+g}",
        "latitude": lat,
        "longitude": lon,
        "latitudeText": _fmt_degree(lat, 4),
        "longitudeText": _fmt_degree(lon, 4),
        "location": display_text(location_name),
        "qizheng": qizheng,
        "classics": kinastro_source_sections("七政四余", "接入 kentang2017/kinastro 的七政四余天文计算、十二宫、神煞、张果星宗断语、年限大运与命宫解读。"),
        "capabilities": {
            "inputs": ["date", "time", "timezone", "latitude", "longitude", "gender", "currentYear", "transitMode", "transitDate", "transitTime", "electionalStartDate", "electionalCriteria", "electionalDays"],
            "outputs": ["sevenGovernors", "fourRemainders", "houses", "fourPillars", "shensha", "dasha", "transit", "zhangguoReadings", "mingGongInterpretation", "electionalDates", "twentyEightMansions"],
            "transitModes": [
                {"value": "none", "label": "关闭"},
                {"value": "same", "label": "同刻"},
                {"value": "now", "label": "此刻"},
                {"value": "custom", "label": "自定"},
            ],
            "electionalCriteria": [
                {"value": key, "label": value.get("cn")}
                for key, value in ACTIVITY_TYPES.items()
            ],
        },
    }
    pan["sections"] = _build_sections(pan)
    annotate_day_boundary(pan, _db)
    pan["snapshot"] = build_snapshot(pan)
    return pan
