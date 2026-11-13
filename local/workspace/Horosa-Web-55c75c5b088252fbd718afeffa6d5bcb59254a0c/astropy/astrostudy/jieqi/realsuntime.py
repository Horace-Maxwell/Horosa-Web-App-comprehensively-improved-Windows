import math

from astrostudy.helper import convertLonStrToDegree


# 真太阳时偏移(秒)= 经度时差 + 均时差。均时差与 Java RealSunTimeOffset、前端 baziLunarLocal 同一式(NOAA / Meeus 级数),
# 全软件只此一个算法;旧「月-日 → 秒」查表没有年份与时刻,与此式最大差 75 秒,已废止。


def equationOfTimeMinutes(jd):
    """均时差(分钟,视减平,正 = 真太阳快);jd = UT 儒略日。"""
    T = (jd - 2451545.0) / 36525.0
    rad = math.pi / 180.0
    L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360.0
    M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T
    e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T
    eps0 = 23.43929111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600.0
    y = math.tan((eps0 / 2.0) * rad)
    y2 = y * y
    sin2L0 = math.sin(2.0 * L0 * rad)
    sinM = math.sin(M * rad)
    cos2L0 = math.cos(2.0 * L0 * rad)
    sin4L0 = math.sin(4.0 * L0 * rad)
    sin2M = math.sin(2.0 * M * rad)
    eotRad = y2 * sin2L0 - 2.0 * e * sinM + 4.0 * e * y2 * sinM * cos2L0 - 0.5 * y2 * y2 * sin4L0 - 1.25 * e * e * sin2M
    return (eotRad / rad) * 4.0


def getOffset(jdUt, gpsLon, baseLon, mode='true'):
    # mode: 'true'=真太阳时(经度时差+均时差,默认) / 'mean'=平太阳时(仅经度时差) / 'off'=钟表(不校正)
    lonTmDelta = (gpsLon - baseLon) * 240
    if mode == 'off':
        return 0
    if mode == 'mean':
        return int(lonTmDelta)
    return int(round(lonTmDelta + equationOfTimeMinutes(jdUt) * 60.0))


def getOffsetBylonstr(jdUt, lonstr, baseLon, mode='true'):
    londeg = convertLonStrToDegree(lonstr)
    return getOffset(jdUt, londeg, baseLon, mode)


def getBaseLonByZone(zone):
    # 数值时区(小时偏移,如 8 / -5 / 5.5)直接换算基准经度;纯数值字符串亦容错。
    # 否则 zone[0:1] 索引会对 int/float 时区崩溃(「'int' object is not subscriptable」)。
    if isinstance(zone, (int, float)):
        return zone * 15
    if zone[0:1] not in ('+', '-') and (':' not in str(zone)):
        try:
            return float(zone) * 15
        except (TypeError, ValueError):
            return 0
    sym = zone[0:1]
    rest = zone[1:]
    # 解析「±HH:MM」的分钟段:原实现只取小时,印度 +05:30 被当 +05:00 → 真太阳时差半小时。
    hm = rest.split(':')
    try:
        h = int(hm[0])
    except (TypeError, ValueError):
        h = 0
    m = 0
    if len(hm) > 1 and hm[1]:
        try:
            m = int(hm[1])
        except (TypeError, ValueError):
            m = 0
    lon = (h + m / 60.0) * 15
    if sym == '+':
        return lon
    return -lon

def getOffsetByJd(jdUt, zone, lon, mode='true'):
    return getOffsetBylonstr(jdUt, lon, getBaseLonByZone(zone), mode)
