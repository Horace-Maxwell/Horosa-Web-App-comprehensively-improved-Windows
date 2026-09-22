import os
import math
import json
import re
import time
import traceback

import cherrypy
import swisseph

try:
    import jsonpickle
except ImportError:
    class _JsonpickleCompat:
        @staticmethod
        def encode(obj, unpicklable=False):
            return json.dumps(obj, ensure_ascii=False, default=str)

    jsonpickle = _JsonpickleCompat()

from flatlib import const
from flatlib import utils
from flatlib.ephem import swe
from astrostudy.perchart import (
    PerChart, getHSys,
    SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL,
    _moira_ayanamsha,
)
from websrv.helper import enable_crossdomain


_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
_FIXSTARS_PATH = os.path.join(_ROOT, "flatlib-ctrad2", "flatlib", "resources", "swefiles", "fixstars.cat")
_BSC5_PATH = os.path.join(_ROOT, "astropy", "resources", "bsc5-horosa.json")
_STAR_CACHE = None
_BSC5_CACHE = None
_BASE_STAR_CACHE = None


ZODIAC_LABELS = [
    "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
    "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
]

ZODIAC_IDS = [
    const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
    const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES,
]

PLANETARIUM_OBJECTS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE,
    const.PLUTO, const.NORTH_NODE, const.SOUTH_NODE,
]
PLANETARIUM_OBJECT_IDS = set(PLANETARIUM_OBJECTS)

QIZHENG_SIYU = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE,
]

# 升落中天 / 视运动轨迹 用：天文馆星体 id -> 瑞士星历行星号(swe planet number)。
# 仅含真实可见天体(实有圆面、确有升落与连续轨迹);月交点是数学点、无升落圆面,不入此列。
PLANETARIUM_SWE_BODIES = [
    (const.SUN, 0, "太阳"),
    (const.MOON, 1, "月亮"),
    (const.MERCURY, 2, "水星"),
    (const.VENUS, 3, "金星"),
    (const.MARS, 4, "火星"),
    (const.JUPITER, 5, "木星"),
    (const.SATURN, 6, "土星"),
    (const.URANUS, 7, "天王星"),
    (const.NEPTUNE, 8, "海王星"),
    (const.PLUTO, 9, "冥王星"),
]
# 默认日月五星 + 天海冥(全 10 真实天体,均默认精确升落/轨迹);月交点是数学点、无升落圆面,不入此列。
# includeOuter 仅作兼容保留(默认已含外行星,故为幂等),不再门控外行星。
_DEFAULT_RISESET_TRAIL_IDS = {
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO,
}


def _norm_degree(value):
    res = float(value) % 360.0
    return res + 360.0 if res < 0 else res


def _zodiac_info(lon):
    lon = _norm_degree(lon)
    idx = int(lon // 30) % 12
    return {
        "zodiacSign": ZODIAC_LABELS[idx],
        "zodiacSignId": ZODIAC_IDS[idx],
        "zodiacDegree": lon - idx * 30,
    }


def _visibility_info(item, sun_altitude=None):
    alt = _num(item.get("altitudeAppa", item.get("altitudeTrue", 0)))
    mag = item.get("mag", None)
    is_above = alt > 0
    twilight = None
    if sun_altitude is not None:
        # [Q-372/T-351] sun_altitude 是**视高度**(altitudeAppa,已含折射);再拿 -0.833°(几何高度用的
        # 折射+半径阈值)比等于折射算两次 → 视高度落在 (-0.833°, 0°] 的数分钟里后端记 day、前端与帮助
        # 按视高度 > 0° 已入民用晨昏,两端不同口径。统一为视高度 0°(与前端 skyModeFromSunAlt / 帮助同)。
        if sun_altitude > 0:
            twilight = "day"
        elif sun_altitude > -6:
            twilight = "civil"
        elif sun_altitude > -12:
            twilight = "nautical"
        elif sun_altitude > -18:
            twilight = "astronomical"
        else:
            twilight = "night"
    visible = is_above
    if mag is not None and sun_altitude is not None and sun_altitude > -6 and _num(mag, 99) > 1.5:
        visible = False
    if alt > 60:
        horizon_state = "高空"
    elif alt > 15:
        horizon_state = "可见"
    elif alt > 0:
        horizon_state = "近地平"
    elif alt > -6:
        horizon_state = "地平线下"
    else:
        horizon_state = "不可见"
    return {
        "visible": visible,
        "aboveHorizon": is_above,
        "horizonState": horizon_state,
        "twilight": twilight,
    }


def _moon_phase_info(bodies):
    sun = next((item for item in bodies if item.get("id") == const.SUN), None)
    moon = next((item for item in bodies if item.get("id") == const.MOON), None)
    if not sun or not moon:
        return None
    elongation = _norm_degree(_num(moon.get("lon")) - _num(sun.get("lon")))
    illumination = (1 - math.cos(math.radians(elongation))) / 2
    age = elongation / 360.0 * 29.530588853
    if elongation < 22.5 or elongation >= 337.5:
        name = "朔"
    elif elongation < 67.5:
        name = "蛾眉月"
    elif elongation < 112.5:
        name = "上弦"
    elif elongation < 157.5:
        name = "盈凸月"
    elif elongation < 202.5:
        name = "望"
    elif elongation < 247.5:
        name = "亏凸月"
    elif elongation < 292.5:
        name = "下弦"
    else:
        name = "残月"
    return {
        "phaseAngle": elongation,
        "illumination": illumination,
        "ageDays": age,
        "phaseName": name,
        "waxing": elongation < 180,
    }


def _num(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _ra_hours_to_deg(parts):
    h = _num(parts[0])
    m = _num(parts[1])
    s = _num(parts[2])
    return (h + m / 60.0 + s / 3600.0) * 15.0


def _decl_to_deg(parts):
    deg_txt = str(parts[0]).strip()
    sign = -1.0 if deg_txt.startswith("-") else 1.0
    d = abs(_num(deg_txt))
    m = abs(_num(parts[1] if len(parts) > 1 else 0))
    s = abs(_num(parts[2] if len(parts) > 2 else 0))
    return sign * (d + m / 60.0 + s / 3600.0)


def _ra_text_to_deg(value):
    vals = re.findall(r"[-+]?\d+(?:\.\d+)?", value or "")
    if len(vals) < 3:
        return None
    return (_num(vals[0]) + _num(vals[1]) / 60.0 + _num(vals[2]) / 3600.0) * 15.0


def _dec_text_to_deg(value):
    txt = value or ""
    vals = re.findall(r"[-+]?\d+(?:\.\d+)?", txt)
    if len(vals) < 3:
        return None
    sign = -1.0 if txt.strip().startswith("-") else 1.0
    return sign * (abs(_num(vals[0])) + abs(_num(vals[1])) / 60.0 + abs(_num(vals[2])) / 3600.0)


def _precess_j2000_to_date(jd, ra, decl):
    """J2000 平赤道 (ra, decl) → 当日平赤道(度)。Meeus《天文算法》21.3 / 21.4(IAU 1976 系数),与前端
    planetariumProjection.precessJ2000ToDate 同公式同系数(两端逐位一致才不出「暂停态后端投影 vs 播放态前端投影」两套位置)。
    只做平岁差(章动 ≤17″ / 光行差 ≤20″ 在星点直径量级以下,不加)。"""
    T = (float(jd) - 2451545.0) / 36525.0
    zeta = math.radians((2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600.0)
    z = math.radians((2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600.0)
    theta = math.radians((2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600.0)
    ra0 = math.radians(float(ra))
    dec0 = math.radians(float(decl))
    a = math.cos(dec0) * math.sin(ra0 + zeta)
    b = math.cos(theta) * math.cos(dec0) * math.cos(ra0 + zeta) - math.sin(theta) * math.sin(dec0)
    c = math.sin(theta) * math.cos(dec0) * math.cos(ra0 + zeta) + math.cos(theta) * math.sin(dec0)
    ra1 = math.degrees(math.atan2(a, b) + z)
    dec1 = math.degrees(math.asin(max(-1.0, min(1.0, c))))
    return _norm_degree(ra1), dec1


def _true_obliquity_deg(jd):
    """当日真黄赤交角(度,含章动;Swiss Ephemeris)。天文馆黄道线 / 距星置宿 / 行星轨迹的黄→赤转换用它,
    不用 flatlib 的固定 23.44°(那是星盘模块的历史口径,天文馆是真实天球)。"""
    try:
        return float(swisseph.calc_ut(float(jd), swisseph.ECL_NUT)[0][0])
    except Exception:
        traceback.print_exc()
        T = (float(jd) - 2451545.0) / 36525.0
        return (23 * 3600 + 26 * 60 + 21.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T ** 3) / 3600.0


def _ecl_to_eq_of_date(jd, lon, lat=0.0):
    """当日黄道 (lon, lat) → 当日赤道 (ra, decl),度;按当日真黄赤交角。"""
    eq = swisseph.cotrans([float(lon), float(lat), 1.0], -_true_obliquity_deg(jd))
    return _norm_degree(eq[0]), float(eq[1])


def _altaz_from_equatorial(jd, pos, ra, decl, height=150.0, press=1000.0, temp=20.0):
    za = swisseph.azalt(
        jd,
        swisseph.EQU2HOR,
        [pos.lon, pos.lat, height],
        press,
        temp,
        [ra, decl, 1],
    )
    return {
        "azimuth": za[0],
        "altitudeTrue": za[1],
        "altitudeAppa": za[2],
    }


def _altaz_from_ecliptic(jd, pos, lon, lat=0.0, height=150.0, press=1000.0, temp=20.0):
    za = swisseph.azalt(
        jd,
        swisseph.ECL2HOR,
        [pos.lon, pos.lat, height],
        press,
        temp,
        [lon, lat, 1],
    )
    return {
        "azimuth": za[0],
        "altitudeTrue": za[1],
        "altitudeAppa": za[2],
    }


def _read_star_catalog():
    global _STAR_CACHE
    if _STAR_CACHE is not None:
        return _STAR_CACHE

    stars = []
    if not os.path.exists(_FIXSTARS_PATH):
        _STAR_CACHE = stars
        return stars

    with open(_FIXSTARS_PATH, "r", encoding="utf-8", errors="ignore") as fh:
        seen = set()
        for idx, line in enumerate(fh):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [item.strip() for item in line.split(",")]
            if len(parts) < 14:
                continue
            try:
                mag = float(parts[13])
            except Exception:
                continue
            if mag > 6.5 or mag >= 99:
                continue
            label = parts[0] or parts[1] or "Star"
            label_lower = label.lower()
            bayer_lower = (parts[1] or "").lower()
            if "cluster" in label_lower or "galaxy" in label_lower or label_lower.startswith("gal.") or label_lower == "great attractor" or bayer_lower in ("m31", "m44"):
                continue
            ra = _ra_hours_to_deg(parts[3:6])
            decl = _decl_to_deg(parts[6:9])
            dedupe_key = (parts[1] or label or "", round(ra, 5), round(decl, 5))
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            stars.append({
                "id": f"catalog-{idx}",
                "name": label,
                "bayer": parts[1],
                "ra": _norm_degree(ra),
                "decl": decl,
                "mag": mag,
                "kind": "catalogStar",
            })
    _STAR_CACHE = stars
    return stars


def _read_bsc5_catalog():
    global _BSC5_CACHE
    if _BSC5_CACHE is not None:
        return _BSC5_CACHE

    stars = []
    if not os.path.exists(_BSC5_PATH):
        _BSC5_CACHE = stars
        return stars

    try:
        with open(_BSC5_PATH, "r", encoding="utf-8") as fh:
            rows = json.load(fh)
    except Exception:
        traceback.print_exc()
        _BSC5_CACHE = stars
        return stars

    for row in rows:
        ra = _ra_text_to_deg(row.get("RA"))
        decl = _dec_text_to_deg(row.get("Dec"))
        if ra is None or decl is None:
            continue
        mag = _num(row.get("Vmag"), 99)
        if mag > 6.5:
            continue
        bayer = row.get("B") or ""
        flamsteed = row.get("F") or ""
        constell = row.get("C") or ""
        name = row.get("N") or (f"{bayer} {constell}".strip()) or (f"{flamsteed} {constell}".strip()) or f"HR {row.get('HR', '')}".strip()
        stars.append({
            "id": f"bsc5-{row.get('HR', len(stars))}",
            "name": name,
            "bayer": bayer,
            "flamsteed": flamsteed,
            "constellation": constell,
            "ra": _norm_degree(ra),
            "decl": decl,
            "mag": mag,
            "colorIndex": row.get("B-V"),
            "colorTemperature": _num(row.get("K"), None),
            "spectralClass": row.get("SpectralCls"),
            "kind": "catalogStar",
        })
    stars.sort(key=lambda rec: rec.get("mag", 99))
    _BSC5_CACHE = stars
    return stars


def _base_star_catalog():
    global _BASE_STAR_CACHE
    if _BASE_STAR_CACHE is not None:
        return _BASE_STAR_CACHE
    stars = list(_read_bsc5_catalog() or _read_star_catalog())
    stars.sort(key=lambda rec: rec.get("mag", 99))
    _BASE_STAR_CACHE = stars
    return stars


def _plain_obj(obj):
    res = {
        "id": getattr(obj, "id", ""),
        "name": getattr(obj, "name", None) or getattr(obj, "id", ""),
        "type": getattr(obj, "type", ""),
        "lon": _num(getattr(obj, "lon", 0)),
        "lat": _num(getattr(obj, "lat", 0)),
        "ra": _num(getattr(obj, "ra", 0)),
        "decl": _num(getattr(obj, "decl", 0)),
        "azimuth": _num(getattr(obj, "azimuth", 0)),
        "altitudeTrue": _num(getattr(obj, "altitudeTrue", 0)),
        "altitudeAppa": _num(getattr(obj, "altitudeAppa", 0)),
        "mag": getattr(obj, "mag", None),
        "sign": getattr(obj, "sign", None),
        "signlon": getattr(obj, "signlon", None),
        "house": getattr(obj, "house", None),
        "su28": getattr(obj, "su28", None),
    }
    res.update(_zodiac_info(res["lon"]))
    if getattr(obj, "lonspeed", None) is not None:
        res["lonspeed"] = obj.lonspeed
    # 透传 latspeed → 前端帧循环按 latspeed × dtJd 外推月亮黄纬,免去每 2.5s 校准跳变(月亮 lat 振幅 ±5°、周期 27d)。
    if getattr(obj, "latspeed", None) is not None:
        res["latspeed"] = obj.latspeed
    res.update(_visibility_info(res))
    return res


def _force_pure_astronomy(data):
    """天文馆=纯天文(纯瑞士星历真实天象),与星盘/七政四余绝对独立,只借宫位(hsys)+ 观测地/时间。
    强制纯天文参数,无视图表的黄道模式/宿度制/岁差等占星设置——否则选恒星黄道或七政宿度制时,
    二十八宿会随图表宿度制落到黄道线上。原地改 data。返回 data 便于测试。"""
    data["zodiacal"] = 0            # 真实回归黄道(IAU 岁差),不继承图表恒星黄道
    data["siderealAyanamsa"] = ""   # 不施加岁差偏移
    data["doubingSu28"] = 0         # 二十八宿恒用真实距星(荀爽活体赤道距星),不继承图表宿度制
    data["guolaoZhengSidereal"] = 0
    data["termsVariant"] = 0
    return data


def _fix_moira_su28_equatorial(su28_items, su28mode, jd):
    """回归今制/回归开禧/恒星制郑式:su28 距星按黄道置宿(getMoiraFixedStarSu28 给 ra=lon、decl=0、lat=0),
    是黄道经度标记而非真实赤道坐标。天文馆是真实天球,须据黄经重算赤道 ra/decl——否则二十八宿全落赤道线
    (默认即回归今制,访问七政后全局 doubingSu28=2 带入天文馆即触发该 bug)。恒星制郑式黄经为恒星黄经,补岁差转回归黄经。
    原地修改 su28_items。荀爽/赤道恒星制(已是真实赤道距星)不在此列,不动。"""
    if su28mode not in (SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL):
        return su28_items
    ayan = _moira_ayanamsha(jd) if su28mode == SU28_MODE_ZHENG_SIDEREAL else 0.0
    for item in su28_items:
        trop_lon = _norm_degree(_num(item.get("lon", item.get("ra", 0))) + ayan)
        eq = _ecl_to_eq_of_date(jd, trop_lon, 0)   # 当日真黄赤交角(原 utils.eqCoords 固定 23.44°,T-203)
        item["ra"] = _norm_degree(eq[0])
        item["decl"] = _num(eq[1])
    return su28_items


# [Q-371/T-350] 天文馆「二十八宿距星星点」:胃宿 / 鬼宿在 REAL 口径下取的是 41 Ari / η Cnc 再加经验赤经修正(赤纬不改),
# 星点 (ra, decl) 不对应任何真实星位。传统距星是 35 Ari(HR 801)/ θ Cnc(HR 3357):给这两项附 trueStar(J2000 → 当日历元
# + 地平坐标),前端星点按它画;宿界(item.ra)不动——鬼宿赤经修正方向是否笔误另裁。
_TRUE_DISTANCE_STARS = {
    const.START_WEI: ("bsc5-801", "35 Ari"),
    const.START_GUI: ("bsc5-3357", "θ Cnc"),
}


def _attach_true_distance_stars(su28_items, perchart, catalog=None):
    if not su28_items:
        return su28_items
    try:
        cat = catalog if catalog is not None else _base_star_catalog()
        by_id = {s.get("id"): s for s in (cat or [])}
    except Exception:
        return su28_items
    jd = perchart.dateTime.jd
    for item in su28_items:
        spec = _TRUE_DISTANCE_STARS.get(item.get("id"))
        if not spec:
            continue
        star = by_id.get(spec[0])
        if not star:
            continue
        try:
            ra_d, decl_d = _precess_j2000_to_date(jd, star["ra"], star["decl"])
            true_star = {"id": spec[0], "name": spec[1], "raJ2000": star["ra"], "declJ2000": star["decl"], "ra": ra_d, "decl": decl_d}
            true_star.update(_altaz_from_equatorial(jd, perchart.pos, ra_d, decl_d))
            item["trueStar"] = true_star
        except Exception:
            traceback.print_exc()
    return su28_items


def _build_catalog_stars(perchart, limit, catalog=None):
    stars = []
    catalog = catalog if catalog is not None else _base_star_catalog()
    for star in catalog:
        item = dict(star)
        # BSC5 是 J2000 历元:地平坐标按当日历元岁差后再算(T-203);payload 里 ra/decl 仍留 J2000(前端按帧岁差,星表可跨时刻复用)
        ra_d, decl_d = _precess_j2000_to_date(perchart.dateTime.jd, item["ra"], item["decl"])
        item.update(_altaz_from_equatorial(perchart.dateTime.jd, perchart.pos, ra_d, decl_d))
        item.update(_visibility_info(item))
        stars.append(item)
    if limit and len(stars) > limit:
        return stars[:limit]
    return stars


def _chart_objects(perchart):
    objects = []
    for key in perchart.chart.objects.content.keys():
        obj = perchart.chart.objects.content[key]
        if getattr(obj, "id", None) in PLANETARIUM_OBJECT_IDS:
            objects.append(obj)
    objects.sort(key=lambda item: _num(getattr(item, "lon", 0)))
    return objects


def _safe_perchart_list(perchart, method_name):
    try:
        method = getattr(perchart, method_name)
        return method()
    except Exception:
        traceback.print_exc()
        return []


def _build_line_from_equatorial(perchart, points, key, label):
    res = []
    for item in points:
        row = {
            "ra": _norm_degree(item["ra"]),
            "decl": _num(item["decl"]),
        }
        row.update(_altaz_from_equatorial(perchart.dateTime.jd, perchart.pos, row["ra"], row["decl"]))
        res.append(row)
    return {
        "key": key,
        "label": label,
        "points": res,
    }


def _build_line_from_ecliptic(perchart, start, end, step, key, label):
    points = []
    lon = start
    while lon <= end:
        eq = _ecl_to_eq_of_date(perchart.dateTime.jd, _norm_degree(lon), 0)   # 黄道线按当日真黄赤交角(T-203:原固定 23.44°)
        row = {
            "lon": _norm_degree(lon),
            "lat": 0,
            "ra": _norm_degree(eq[0]),
            "decl": eq[1],
        }
        row.update(_altaz_from_ecliptic(perchart.dateTime.jd, perchart.pos, row["lon"], 0))
        points.append(row)
        lon += step
    return {
        "key": key,
        "label": label,
        "points": points,
    }


def _build_overlays(perchart):
    horizon = []
    for az in range(0, 361, 5):
        horizon.append({
            "azimuth": az,
            "altitudeTrue": 0,
            "altitudeAppa": 0,
        })

    meridian_points = []
    for alt in range(-80, 91, 5):
        meridian_points.append({
            "azimuth": 180,
            "altitudeTrue": alt,
            "altitudeAppa": alt,
        })

    equator_points = []
    for ra in range(0, 361, 5):
        row = {
            "ra": ra,
            "decl": 0,
        }
        row.update(_altaz_from_equatorial(perchart.dateTime.jd, perchart.pos, ra, 0))
        equator_points.append(row)

    zodiac = []
    for idx, name in enumerate(ZODIAC_LABELS):
        start = idx * 30
        line = _build_line_from_ecliptic(perchart, start, start + 30, 2, f"zodiac-{idx}", name)
        line["startLon"] = start
        line["endLon"] = start + 30
        zodiac.append(line)

    houses = []
    try:
        chart = perchart.chart
        for house in chart.houses:
            row = _plain_obj(house)
            row.update(_altaz_from_ecliptic(perchart.dateTime.jd, perchart.pos, row["lon"], 0))
            houses.append(row)
    except Exception:
        traceback.print_exc()

    return {
        "horizon": {
            "key": "horizon",
            "label": "地平线",
            "points": horizon,
        },
        "meridian": {
            "key": "meridian",
            "label": "子午线",
            "points": meridian_points,
        },
        "equator": {
            "key": "equator",
            "label": "天赤道",
            "points": equator_points,
        },
        "ecliptic": _build_line_from_ecliptic(perchart, 0, 360, 2, "ecliptic", "黄道"),
        "zodiac": zodiac,
        "houses": houses,
    }


def _resolve_riseset_trail_ids(data):
    """决定升落/轨迹要算哪些星：默认日月五星;includeOuter 真则加天/海/冥。
    亦支持显式 riseSetObjects/trailObjects 列表(取交集),否则用门控默认集。"""
    want_outer = data.get("includeOuter") in (True, 1, "1", "true", "True")
    ids = set(_DEFAULT_RISESET_TRAIL_IDS)
    if want_outer:
        ids |= {const.URANUS, const.NEPTUNE, const.PLUTO}
    return ids


def _local_time_from_jd_ut(jd_ut, utc_offset_jd):
    """瑞士星历升落返回的是 UT 儒略日;转成观测地本地时显示。
    utc_offset_jd 为本地相对 UT 的偏移(天为单位,东为正)。返回 {jd(UT), iso(本地), hour(本地小时浮点)}。"""
    if jd_ut is None:
        return None
    local_jd = jd_ut + utc_offset_jd
    y, mo, d, frac_h = swisseph.revjul(local_jd)
    total_sec = int(round(frac_h * 3600.0))
    # 进位防 60:00 / 跨日(revjul 已给出本地日历日,这里只规整秒）
    hh = total_sec // 3600
    mm = (total_sec % 3600) // 60
    ss = total_sec % 60
    carry_day = 0
    if hh >= 24:
        carry_day = hh // 24
        hh = hh % 24
    return {
        "jd": jd_ut,
        "hour": frac_h,
        "iso": "%04d-%02d-%02d %02d:%02d:%02d" % (y, mo, d + carry_day, hh, mm, ss),
        "time": "%02d:%02d:%02d" % (hh, mm, ss),
    }


def _utc_offset_days(perchart):
    """从 perchart.dateTime.utcoffset(flatlib Time:[sign,h,m,s])取本地相对 UT 偏移(天)。"""
    try:
        sign, h, m, s = perchart.dateTime.utcoffset.toList()
        days = (h + m / 60.0 + s / 3600.0) / 24.0
        return -days if sign == "-" else days
    except Exception:
        return 0.0


def _rise_set_for_body(jd_day_start_ut, swe_id, geopos, press, temp, utc_offset_jd):
    """算单星当日(从当地日初 UT 起向后一日窗口)的 升 / 上中天 / 落 时刻。
    用 swe.rise_trans;BIT_DISC_CENTER 取圆面中心(与几何升落一致,稳态)。
    极区永昼/永夜(res=-2 circumpolar)或异常 → 该项 null(优雅降级)。"""
    flag_disc = getattr(swisseph, "BIT_DISC_CENTER", 256)
    out = {"rise": None, "transit": None, "set": None}
    plan = (
        ("rise", getattr(swisseph, "CALC_RISE", 1) | flag_disc),
        ("transit", getattr(swisseph, "CALC_MTRANSIT", 4)),
        ("set", getattr(swisseph, "CALC_SET", 2) | flag_disc),
    )
    for key, rsmi in plan:
        try:
            res, tret = swisseph.rise_trans(
                jd_day_start_ut, swe_id, rsmi, geopos, press, temp, swisseph.FLG_SWIEPH
            )
            if res == 0 and tret and tret[0]:
                out[key] = _local_time_from_jd_ut(tret[0], utc_offset_jd)
        except Exception:
            traceback.print_exc()
            out[key] = None
    return out


def _build_rise_set(perchart, data):
    """为门控选中的星算当日升落中天。返回 {bodyId: {rise,transit,set}}（每项含本地 iso/time + UT jd 或 null）。
    窗口取观测地『当日 0 时(本地)』对应的 UT 儒略日为搜索起点，向后一日。"""
    pos = perchart.pos
    geopos = [float(pos.lon), float(pos.lat), 150.0]
    press, temp = 1013.25, 15.0
    utc_offset_jd = _utc_offset_days(perchart)
    # 当地日初(本地 00:00)对应的 UT jd：本地民用日的起点向后搜一日，覆盖整日升落。
    local_midnight_ut = math.floor(perchart.dateTime.jd + utc_offset_jd + 0.5) - 0.5 - utc_offset_jd
    want = _resolve_riseset_trail_ids(data)
    result = {}
    for body_id, swe_id, _name in PLANETARIUM_SWE_BODIES:
        if body_id not in want:
            continue
        result[body_id] = _rise_set_for_body(
            local_midnight_ut, swe_id, geopos, press, temp, utc_offset_jd
        )
    return result


def _build_trails(perchart, data):
    """为门控选中的星算一段日期窗口内的视运动轨迹(赤道 ra/decl 点列,与 bodies/overlays 同口径=当日历元真赤道)。
    默认 ±45 天、步长 1 天;可配 trailDays(总跨度的一半,即 ±N)与 trailStep(天)。
    位置按真实历表逐点算,留(station)/逆行段自然连续,无跳变。"""
    jd0 = perchart.dateTime.jd
    try:
        half_days = abs(int(data.get("trailDays", 45)))
    except Exception:
        half_days = 45
    half_days = max(1, min(half_days, 400))  # 安全上限,防超长窗口拖慢
    try:
        step = float(data.get("trailStep", 1.0))
    except Exception:
        step = 1.0
    if step <= 0:
        step = 1.0
    step = max(0.25, min(step, 30.0))

    flags = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED
    want = _resolve_riseset_trail_ids(data)
    trails = []
    # 采样偏移序列(天):从 -half 到 +half,含 0(当前时刻一定在点列里,轨迹必过星体)。
    offsets = []
    d = -float(half_days)
    while d <= half_days + 1e-9:
        offsets.append(round(d, 6))
        d += step
    if 0.0 not in offsets:
        offsets.append(0.0)
        offsets.sort()

    for body_id, swe_id, name in PLANETARIUM_SWE_BODIES:
        if body_id not in want:
            continue
        points = []
        for off in offsets:
            try:
                calc = swisseph.calc_ut(jd0 + off, swe_id, flags)[0]
            except Exception:
                traceback.print_exc()
                continue
            lon, lat = calc[0], calc[1]
            lonspeed = calc[3] if len(calc) > 3 else 0.0
            eq = _ecl_to_eq_of_date(jd0 + off, _norm_degree(lon), lat)   # 轨迹点按各自时刻的真黄赤交角(T-203)
            points.append({
                "offsetDays": off,
                "ra": _norm_degree(eq[0]),
                "decl": _num(eq[1]),
                "lon": _norm_degree(lon),
                "lonspeed": _num(lonspeed),
                "retrograde": _num(lonspeed) < 0,
            })
        trails.append({
            "id": body_id,
            "name": name,
            "points": points,
        })
    return trails


def _truthy_flag(data, *keys):
    """门控判定:任一 key 为真(True/1/'1'/'true')即开启。默认不开 → 默认请求零额外开销。"""
    for key in keys:
        val = data.get(key)
        if val in (True, 1, "1", "true", "True"):
            return True
    return False


class PlanetariumSrv:
    exposed = True

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def index(self):
        return self.state()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def state(self):
        enable_crossdomain()
        started = time.perf_counter()
        try:
            data = cherrypy.request.json if cherrypy.request.method == "POST" else {}
            data = data or {}
            data.setdefault("hsys", 1)
            data.setdefault("predictive", False)
            data.setdefault("needpars", False)
            _force_pure_astronomy(data)
            requested_objects = data.get("objlists") or PLANETARIUM_OBJECTS
            data["objlists"] = [item for item in requested_objects if item in PLANETARIUM_OBJECT_IDS]
            perchart = PerChart(data)
            catalog_limit = int(data.get("starLimit", 9000))
            include_catalog = catalog_limit != 0
            include_overlays = data.get("includeOverlays", True) is not False
            include_traditions = data.get("includeTraditions", True) is not False
            base_catalog = _base_star_catalog() if include_catalog else None

            bodies = [_plain_obj(item) for item in _chart_objects(perchart)]
            sun_body = next((item for item in bodies if item.get("id") == const.SUN), None)
            sun_altitude = sun_body.get("altitudeAppa") if sun_body else None
            for item in bodies:
                item.update(_visibility_info(item, sun_altitude))
            su28 = [_plain_obj(item) for item in _safe_perchart_list(perchart, "getFixedStarSu28")] if include_traditions else []
            if include_traditions:
                _fix_moira_su28_equatorial(su28, getattr(perchart, "su28Mode", 0), perchart.dateTime.jd)
                _attach_true_distance_stars(su28, perchart, base_catalog if include_catalog else None)
            beidou = [_plain_obj(item) for item in _safe_perchart_list(perchart, "getBeiDou")] if include_traditions else []
            fixed_stars = [_plain_obj(item) for item in _safe_perchart_list(perchart, "getFixedStars")] if include_traditions else []
            for group in (su28, beidou, fixed_stars):
                for item in group:
                    item.update(_visibility_info(item, sun_altitude))
            catalog_stars = _build_catalog_stars(perchart, catalog_limit, base_catalog) if include_catalog else []
            for item in catalog_stars:
                item.update(_visibility_info(item, sun_altitude))
            moon_phase = _moon_phase_info(bodies)
            sky_mode = "night"
            if sun_altitude is not None:
                # [Q-372/T-351] 视高度阈值 0°(见 _visibility_info 注)。
                if sun_altitude > 0:
                    sky_mode = "day"
                elif sun_altitude > -6:
                    sky_mode = "civilTwilight"
                elif sun_altitude > -12:
                    sky_mode = "nauticalTwilight"
                elif sun_altitude > -18:
                    sky_mode = "astronomicalTwilight"

            # 门控:仅当显式请求才算升落中天 / 视运动轨迹。默认不算 → res 字节级不变(零回归)。
            want_rise_set = _truthy_flag(data, "includeRiseSet", "riseSet")
            want_trails = _truthy_flag(data, "includeTrails", "trails")
            rise_set = _build_rise_set(perchart, data) if want_rise_set else None
            trails = _build_trails(perchart, data) if want_trails else None

            res = {
                "version": "planetarium-v1",
                "schema": {
                    "id": "horosa.planetarium.state",
                    "version": 1,
                    "sections": ["observer", "bodies", "stars", "overlays", "traditions", "sky", "meta"],
                },
                "observer": {
                    "date": data.get("date"),
                    "time": data.get("time"),
                    "zone": data.get("zone"),
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "gpsLat": data.get("gpsLat"),
                    "gpsLon": data.get("gpsLon"),
                    "jd": perchart.dateTime.jd,
                    "locationName": data.get("pos") or data.get("name") or "未命名地点",
                },
                "bodies": bodies,
                "stars": {
                    "catalog": catalog_stars,
                    "fixed": fixed_stars,
                    "epoch": "J2000",   # catalog 的 ra/decl 历元;azimuth/altitude 已按当日历元岁差后计算
                    "source": "Yale Bright Star Catalog v5, with Swiss Ephemeris Alt-Az projection",
                    "magLimit": 6.5,
                    "catalogFields": ["id", "name", "ra", "decl", "azimuth", "altitudeAppa", "mag", "colorIndex", "colorTemperature", "constellation", "visible"],
                },
                "overlays": _build_overlays(perchart) if include_overlays else {},
                "traditions": {
                    "su28": su28,
                    "beidou": beidou,
                    "qizhengSiyu": [item for item in bodies if item["id"] in QIZHENG_SIYU],
                },
                "sky": {
                    "mode": sky_mode,
                    "sunAltitude": sun_altitude,
                    "moonPhase": moon_phase,
                },
                "meta": {
                    "catalogCount": len(base_catalog) if base_catalog is not None else 0,
                    "bsc5CatalogCount": len(_read_bsc5_catalog()) if include_catalog else 0,
                    "swissFixedStarCount": len(_read_star_catalog()) if include_catalog else 0,
                    "renderedCatalogCount": len(catalog_stars),
                    "lightweight": not include_catalog or not include_overlays or not include_traditions,
                    "hsys": getHSys(data.get("hsys", 1)),
                    "zodiacal": perchart.zodiacal,
                    "timingMs": {
                        "total": round((time.perf_counter() - started) * 1000, 2),
                    },
                },
            }
            # 门控字段:只在开启时追加,默认请求的 res 保持字节级不变。
            if want_rise_set:
                # 把每星升落挂到对应 body 上(riseSet),并提供顶层 events.riseSet 映射便于整表渲染。
                # 注:traditions.qizhengSiyu 是 bodies 的子集视图(同一批 dict 引用),
                # 故七政星也会反映各自的 riseSet——语义一致(七政之升落即其升落),非额外计算。
                rs_by_id = rise_set or {}
                for item in bodies:
                    if item.get("id") in rs_by_id:
                        item["riseSet"] = rs_by_id[item["id"]]
                res["events"] = {
                    "riseSet": rs_by_id,
                    "fields": ["rise", "transit", "set"],
                    "timeIsLocal": True,
                    "note": "本地时刻(observer zone);transit=上中天;极区永昼/永夜为 null",
                }
            if want_trails:
                res["trails"] = trails or []
                res["trailMeta"] = {
                    "frame": "equatorial-of-date",
                    "coords": ["ra", "decl"],
                    "centerJd": perchart.dateTime.jd,
                    "note": "与 bodies/overlays 同口径(当日历元真赤道);points 含 offsetDays/lon/lonspeed/retrograde;0 偏移=当前时刻",
                }
            return jsonpickle.encode(res, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"err": "planetarium param error"}, unpicklable=False)
