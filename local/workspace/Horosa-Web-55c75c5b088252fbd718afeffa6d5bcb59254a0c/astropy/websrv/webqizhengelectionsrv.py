# 天星择日双轮盘数据端点(对照 Moira ChartTab/Calculate 的动盘一侧;算法源=swisseph):
# 一次往返给全 动盘所需——11 政余体的黄经/罗盘方位角/高度/速度、11 套分宫 cusps、asc/mc、
# 日月出没(极区退化同 Moira:纬度归零重试)、立命时刻 asc(日出/正午/日落/自定义)、
# 太阳分速(方位角 ±30s 差分)、真太阳时(均时差+经度差)。
# 形制照 QiZhengKinSrv:jsonpickle {ResultCode, Result};不依赖 kentang vendor。
import math
import traceback

import cherrypy
import jsonpickle
import swisseph

from flatlib.datetime import Datetime
from astrostudy.civil_calendar import civil_revjul, format_civil_date
from websrv.helper import enable_crossdomain

# 政余十一曜(swisseph id;罗计随 nodeType 平/真,月孛=远地点 mean/oscu,紫炁由前端透传)
_SUN = swisseph.SUN
_BODIES = [
    ("Sun", "日", swisseph.SUN),
    ("Moon", "月", swisseph.MOON),
    ("Venus", "金", swisseph.VENUS),
    ("Jupiter", "木", swisseph.JUPITER),
    ("Mercury", "水", swisseph.MERCURY),
    ("Mars", "火", swisseph.MARS),
    ("Saturn", "土", swisseph.SATURN),
]

_HSYS_CODES = ["P", "K", "O", "R", "C", "A", "V", "X", "H", "T", "B"]

# Moira 天星择日 28 宿距星表(娄起顺排;宿名↔星名对应照 Moira 资源表注释行,
# swisseph 星名走 sefstars 命名列 ",name" 形式,与 Moira computeStar 同款)。
_MOIRA_SU28_STARS = [
    ("娄", "beAri"), ("胃", "ta-6Eri"), ("昴", "16Tau"), ("毕", "epTau"),
    ("觜", "laOri"), ("参", "zeOri"), ("井", "muGem"), ("鬼", "xiPup"),
    ("柳", "laDra"), ("星", "alPyx"), ("张", "chUMa"), ("翼", "gaCom"),
    ("轸", "gaCrv"), ("角", "alVir"), ("亢", "laCen"), ("氐", "xi-2Lib"),
    ("房", "piSco"), ("心", "siSco"), ("尾", "alHer"), ("箕", "ga-2Sgr"),
    ("斗", "muLyr"), ("牛", "beCap"), ("女", "epAqr"), ("虚", "gaEqu"),
    ("危", "alAqr"), ("室", "alPeg"), ("壁", "psPeg"), ("奎", "piAnd"),
]


def _norm(deg):
    v = float(deg) % 360.0
    return v + 360.0 if v < 0 else v


def _parse_dt(date, time, zone):
    parts = str(date).replace("-", "/").split("/")
    if len(parts) == 4:
        date = "-{0}/{1}/{2}".format(parts[1], parts[2], parts[3])
    else:
        date = "{0}/{1}/{2}".format(parts[0], parts[1], parts[2])
    return Datetime(date, time, zone)


def _zone_hours(zone):
    try:
        txt = str(zone or "8:00").replace("+", "")
        neg = txt.startswith("-")
        if neg:
            txt = txt[1:]
        hh, _, mm = txt.partition(":")
        val = float(hh) + (float(mm or 0) / 60.0)
        return -val if neg else val
    except Exception:
        return 8.0


def _azalt(jd_ut, geopos, lon_ecl, lat_ecl):
    res = swisseph.azalt(jd_ut, swisseph.ECL2HOR, geopos, 1013.25, 15.0, [float(lon_ecl), float(lat_ecl), 0.0])
    # swisseph 方位以南为零 → 罗盘向(0=北,顺时针)
    return {
        "azimuth": _norm(res[0] + 180.0),
        "altitudeTrue": res[1],
        "altitudeAppa": res[2],
    }


def _calc_body(jd_ut, swe_id):
    flags = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED
    res, _ = swisseph.calc_ut(jd_ut, swe_id, flags)
    return {"lon": _norm(res[0]), "lat": res[1], "speed": res[3]}


def _rise_set(jd_local_midnight_ut, swe_id, geopos, which):
    # 视盘上缘+大气折射(swisseph 默认)——与 Moira 的日出日落口径一致(盘心版会差 ~2 分)
    try:
        res, tret = swisseph.rise_trans(
            jd_local_midnight_ut, swe_id, which, geopos, 0.0, 0.0, swisseph.FLG_SWIEPH
        )
        if res == 0 and tret and tret[0]:
            return tret[0]
    except Exception:
        pass
    # Moira 同款极区退化:纬度归零(赤道)重试
    try:
        eq_pos = [geopos[0], 0.0, geopos[2]]
        res, tret = swisseph.rise_trans(
            jd_local_midnight_ut, swe_id, which, eq_pos, 0.0, 0.0, swisseph.FLG_SWIEPH
        )
        if res == 0 and tret and tret[0]:
            return tret[0]
    except Exception:
        pass
    return None


def _fmt_local_hms(jd_ut, zone_hours):
    if jd_ut is None:
        return None
    local = jd_ut + zone_hours / 24.0
    frac = (local + 0.5) % 1.0
    secs = int(round(frac * 86400.0)) % 86400
    return "{:02d}:{:02d}:{:02d}".format(secs // 3600, (secs % 3600) // 60, secs % 60)


class QiZhengElectionSrv:
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
            if data.get("ping"):
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            date = data.get("date")
            time = data.get("time") or "12:00:00"
            zone = data.get("zone") or "8:00"
            lat = float(data.get("gpsLat"))
            lon = float(data.get("gpsLon"))
            height = float(data.get("height") or 0.0)
            node_type = data.get("nodeType") or "mean"
            lilith_type = data.get("lilithType") or "mean"
            ayanamsa_deg = float(data.get("ayanamsaDeg") or 0.0)
            life_mode = data.get("eleLifeMode") or "sunrise"
            life_custom = data.get("eleLifeCustomTime") or ""
            extra_bodies = data.get("extraBodies") or []

            tm = _parse_dt(date, time, zone)
            jd_ut = float(tm.jd)
            zone_hours = _zone_hours(zone)
            geopos = [lon, lat, height]

            # 十一曜:七政 + 罗计(node) + 月孛(远地点) + 紫炁(透传黄经)
            node_id = swisseph.TRUE_NODE if node_type == "true" else swisseph.MEAN_NODE
            apog_id = getattr(swisseph, "OSCU_APOG", 13) if lilith_type == "true" else swisseph.MEAN_APOG
            planets = []

            def push(pid, label, lon_ecl, lat_ecl, speed):
                lon_t = _norm(lon_ecl + ayanamsa_deg)  # 恒星制回加(Moira Calculate:788 同义);回归制 ayanamsaDeg=0
                az = _azalt(jd_ut, geopos, lon_t, lat_ecl)
                planets.append({
                    "id": pid,
                    "label": label,
                    "lonTropical": lon_t,
                    "lat": lat_ecl,
                    "speedLon": speed,
                    "retrograde": speed < 0,
                    "azimuth": az["azimuth"],
                    "altitudeTrue": az["altitudeTrue"],
                    "altitudeAppa": az["altitudeAppa"],
                })

            for pid, label, swe_id in _BODIES:
                b = _calc_body(jd_ut, swe_id)
                push(pid, label, b["lon"], b["lat"], b["speed"])
            node = _calc_body(jd_ut, node_id)
            push("Rahu", "罗", node["lon"], 0.0, node["speed"])       # 北交=罗(默认北罗南计;南北对调由前端罗计口径处理)
            push("Ketu", "计", _norm(node["lon"] + 180.0), 0.0, node["speed"])
            apog = _calc_body(jd_ut, apog_id)
            push("Lilith", "孛", apog["lon"], apog["lat"], apog["speed"])
            skipped_extras = []
            for idx, extra in enumerate(extra_bodies):
                try:
                    push(str(extra.get("id") or "Extra"), str(extra.get("label") or "炁"),
                         float(extra.get("lon")), float(extra.get("lat") or 0.0), float(extra.get("speed") or 0.0))
                except Exception:
                    # 值形坏的附加星体:略过并落账(回包 skippedExtraBodies),不静默消失
                    skipped_extras.append(idx)

            # 11 套分宫 cusps(黄道动盘分宫制,一次全给 → 前端切换零往返)
            houses_by_system = {}
            asc = mc = None
            for code in _HSYS_CODES:
                try:
                    cusps, ascmc = swisseph.houses_ex(jd_ut, lat, lon, code.encode("ascii"))
                    houses_by_system[code] = [
                        _norm(c + ayanamsa_deg) for c in list(cusps)[:12]
                    ]
                    if asc is None:
                        asc = _norm(ascmc[0] + ayanamsa_deg)
                        mc = _norm(ascmc[1] + ayanamsa_deg)
                except Exception:
                    houses_by_system[code] = None
            # 单套失败(极地 Placidus 等)→ 空缺由前端退等宫

            # 日月出没(本地当日零点为搜索起点)
            local_midnight_ut = math.floor(jd_ut + zone_hours / 24.0 + 0.5) - 0.5 - zone_hours / 24.0
            rise_flag = getattr(swisseph, "CALC_RISE", 1)
            set_flag = getattr(swisseph, "CALC_SET", 2)
            sunrise_jd = _rise_set(local_midnight_ut, _SUN, geopos, rise_flag)
            sunset_jd = _rise_set(local_midnight_ut, _SUN, geopos, set_flag)
            moonrise_jd = _rise_set(local_midnight_ut, swisseph.MOON, geopos, rise_flag)
            moonset_jd = _rise_set(local_midnight_ut, swisseph.MOON, geopos, set_flag)

            # 立命时刻 asc(照 Moira pick_choice:日出/日落立命 = 该时刻上升;正午=当地正午;自定义)
            life_jd = jd_ut
            if life_mode == "sunrise" and sunrise_jd:
                life_jd = sunrise_jd
            elif life_mode == "sunset" and sunset_jd:
                life_jd = sunset_jd
            elif life_mode == "noon":
                life_jd = local_midnight_ut + 0.5
            elif life_mode == "custom" and life_custom:
                try:
                    life_jd = float(_parse_dt(date, life_custom, zone).jd)
                except Exception:
                    life_jd = jd_ut
            try:
                _, life_ascmc = swisseph.houses_ex(life_jd, lat, lon, b"O")
                life_deg = _norm(life_ascmc[0] + ayanamsa_deg)
            except Exception:
                life_deg = asc

            # 太阳分速(方位角 ±30 秒差分,照 Moira computePlanetAzimuthSpeed)
            sun_now = _calc_body(jd_ut, _SUN)
            az1 = _azalt(jd_ut - 30.0 / 86400.0, geopos, sun_now["lon"], sun_now["lat"])["azimuth"]
            az2 = _azalt(jd_ut + 30.0 / 86400.0, geopos, sun_now["lon"], sun_now["lat"])["azimuth"]
            diff = az2 - az1
            if diff > 180.0:
                diff -= 360.0
            if diff < -180.0:
                diff += 360.0
            sun_az_speed = abs(diff)  # 度/分钟(60 秒窗)

            # 真太阳时 = 钟面 + 均时差 + 4分/度 ×(经度 − 时区中央经线)
            try:
                eot = float(swisseph.time_equ(jd_ut))  # 单 float,单位=天(视减平)
            except Exception:
                eot = 0.0
            eot_min = eot * 1440.0
            lon_corr_min = 4.0 * (lon - zone_hours * 15.0)
            true_solar_jd = jd_ut + (eot_min + lon_corr_min) / 1440.0
            true_solar = _fmt_local_hms(true_solar_jd, zone_hours)

            # 静盘时刻宫位(内盘 1 宫头须与静盘上升同源同时刻;缺参则省略,前端回退动盘套)
            static_houses = None
            static_asc = None
            static_date = data.get("staticDate")
            static_time = data.get("staticTime")
            if static_date:
                try:
                    static_jd = float(_parse_dt(static_date, static_time or "12:00:00", zone).jd)
                    static_houses = {}
                    for code in _HSYS_CODES:
                        try:
                            s_cusps, s_ascmc = swisseph.houses_ex(static_jd, lat, lon, code.encode("ascii"))
                            static_houses[code] = [
                                _norm(c + ayanamsa_deg) for c in list(s_cusps)[:12]
                            ]
                            if static_asc is None:
                                static_asc = _norm(s_ascmc[0] + ayanamsa_deg)
                        except Exception:
                            static_houses[code] = None
                except Exception:
                    static_houses = None
                    static_asc = None

            # 28 宿距星黄经界(照 Moira 天星择日:宿界=距星实时黄经,娄起顺排,与 Moira
            # stellar_names 同一张星表;择日盘全黄经体系,宿环/宿名判定用此而非主链赤道宿界)。
            # 用静盘时刻(宿环属内盘静盘);缺静盘时刻回退动盘时刻(距星日移<0.1角秒,无感)。
            stellar_lon = None
            try:
                su_jd = static_jd if static_date and static_houses is not None else jd_ut
                stellar_lon = []
                for su_name, star_name in _MOIRA_SU28_STARS:
                    xx = swisseph.fixstar_ut("," + star_name, su_jd)[0]
                    stellar_lon.append({"name": su_name, "lon": _norm(float(xx[0]) + ayanamsa_deg)})
                stellar_lon.sort(key=lambda item: item["lon"])
            except Exception:
                stellar_lon = None

            result = {
                "jdUt": jd_ut,
                "planets": planets,
                "housesBySystem": houses_by_system,
                "staticHousesBySystem": static_houses,
                "staticAsc": static_asc,
                "stellarLon": stellar_lon,
                "ascmc": {"asc": asc, "mc": mc},
                "rise": {
                    "sunrise": _fmt_local_hms(sunrise_jd, zone_hours),
                    "sunset": _fmt_local_hms(sunset_jd, zone_hours),
                    "moonrise": _fmt_local_hms(moonrise_jd, zone_hours),
                    "moonset": _fmt_local_hms(moonset_jd, zone_hours),
                    "sunriseJd": sunrise_jd,
                    "sunsetJd": sunset_jd,
                },
                "lifeDeg": life_deg,
                "lifeJd": life_jd,
                "sunAzimuthSpeedDegPerMin": sun_az_speed,
                "trueSolarTime": true_solar,
                "equationOfTimeMin": eot_min,
            }
            if skipped_extras:
                result["skippedExtraBodies"] = skipped_extras
            return jsonpickle.encode({"ResultCode": 0, "Result": result}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "qizheng election calculation failed"}, unpicklable=False)

    # 日月食搜索(Moira search_solar/lunar_eclipse):起始日起向后逐个,最多 N 个。
    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def eclipses(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json or {}
            date = data.get("date")
            zone = data.get("zone") or "8:00"
            count = min(int(data.get("count") or 8), 24)
            kind = data.get("kind") or "solar"
            tm = _parse_dt(date, "00:00:00", zone)
            jd = float(tm.jd)
            zone_hours = _zone_hours(zone)
            out = []
            for _ in range(count):
                if kind == "solar":
                    res, tret = swisseph.sol_eclipse_when_glob(jd, swisseph.FLG_SWIEPH, 0, False)
                else:
                    res, tret = swisseph.lun_eclipse_when(jd, swisseph.FLG_SWIEPH, 0, False)
                if not tret or not tret[0]:
                    break
                peak = tret[0]
                local = peak + zone_hours / 24.0
                y, m, d, ut = civil_revjul(local)
                out.append({
                    "jd": peak,
                    "date": format_civil_date(y, m, d),
                    "time": _fmt_local_hms(peak, zone_hours),
                    "kindFlag": res,
                })
                jd = peak + 1.0
            return jsonpickle.encode({"ResultCode": 0, "Result": out}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "eclipse search failed"}, unpicklable=False)

    # 方位搜索(Moira search_azimuth):某曜到达目标罗盘方位的时刻,向后 N 天逐步扫描+细化。
    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def azimuthsearch(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json or {}
            date = data.get("date")
            time = data.get("time") or "00:00:00"
            zone = data.get("zone") or "8:00"
            lat = float(data.get("gpsLat"))
            lon = float(data.get("gpsLon"))
            target = _norm(float(data.get("targetAz")))
            days = min(int(data.get("days") or 3), 30)
            body_label = data.get("body") or "日"
            id_map = {label: swe_id for _, label, swe_id in _BODIES}
            swe_id = id_map.get(body_label, _SUN)
            tm = _parse_dt(date, time, zone)
            jd0 = float(tm.jd)
            zone_hours = _zone_hours(zone)
            geopos = [lon, lat, 0.0]

            def az_at(jd):
                b = _calc_body(jd, swe_id)
                return _azalt(jd, geopos, b["lon"], b["lat"])["azimuth"]

            def diff(jd):
                d = az_at(jd) - target
                while d > 180.0:
                    d -= 360.0
                while d < -180.0:
                    d += 360.0
                return d

            hits = []
            step = 5.0 / 1440.0  # 5 分钟粗扫
            prev_jd = jd0
            prev_d = diff(jd0)
            end = jd0 + days
            jd = jd0 + step
            while jd <= end and len(hits) < 20:
                cur_d = diff(jd)
                if prev_d == 0.0 or (prev_d < 0 < cur_d) or (cur_d < 0 < prev_d):
                    lo, hi = prev_jd, jd
                    dlo = prev_d
                    for _ in range(24):  # 二分至秒级
                        mid = (lo + hi) / 2.0
                        dm = diff(mid)
                        if (dlo < 0 < dm) or (dm < 0 < dlo):
                            hi = mid
                        else:
                            lo, dlo = mid, dm
                    hit = (lo + hi) / 2.0
                    local = hit + zone_hours / 24.0
                    y, m, d, _ut = civil_revjul(local)
                    hits.append({
                        "jd": hit,
                        "date": format_civil_date(y, m, d),
                        "time": _fmt_local_hms(hit, zone_hours),
                        "azimuth": az_at(hit),
                    })
                prev_jd, prev_d = jd, cur_d
                jd += step
            return jsonpickle.encode({"ResultCode": 0, "Result": hits}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "azimuth search failed"}, unpicklable=False)
