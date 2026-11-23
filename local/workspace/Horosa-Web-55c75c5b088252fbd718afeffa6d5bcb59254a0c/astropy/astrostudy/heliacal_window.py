# -*- coding: utf-8 -*-
"""偕日升 / 偕日没是否落在出生前后七天内(本命盘「晨星初现 / 昏星初没」标记用)。

判定本身不变:向星历库要「出生前十五天之后的第一次偕日升(没)」,它离出生不超过七天就标。

慢在哪:星历库从下一次合日那天起逐日找「第一次看得见的那天」。地理纬度绝对值不小于 63° 时它改用逐日严格升落算法,
而高纬度常有连续几个月看不见的时候(极昼没有暗空、行星整夜在地平线下),要一天一天扫过去,一次搜索 0.3–5 秒;
一张盘两三颗星各搜两次,加上几个附属接口各自重起一次盘,就是几十秒。

怎么省:星历库给出的事件时刻,一定是一个「看得见」的时刻(同一套可见度模型下极限星等不低于该星星等),且偕日升在清晨
(太阳在子午线以东、还没升起)、偕日没在黄昏,且那一天太阳确有升落(极夜里的日子它一律跳过)。
所以先看出生前后七天里,对应那半边天有没有哪怕一刻看得见(每 3 分钟粗看一眼,挑出高点再每 20 秒细看):
一刻都没有 → 事件不可能在七天内 → 这一次搜索不用做。有可能看得见的才照原样去搜,结果与直接搜逐例相同。
只在纬度绝对值不小于 63° 时先做这一步;其余纬度星历库本来就快,照原样直接搜。

同一颗星、同一时刻、同一地点的结果按进程缓存:附属接口重起同一张盘时不再重搜。
"""
import math
import threading
from collections import OrderedDict

import swisseph

from flatlib import const

WINDOW_DAYS = 7.0
SEARCH_BACK_DAYS = 15.0
# 星历库在此纬度及以上改用逐日严格升落算法(其源码里的分界),搜索才慢到值得先排除
POLAR_LATITUDE = 63.0

_ATMO = (1013.25, 15.0, 40.0, 0.25)
_OBSERVER = (36.0, 1.0, 0.0, 0.0, 0.0, 0.0)
_HEL_FLAG = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
_EQU_FLAG = swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL
_EVENTS = (
    (swisseph.HELIACAL_RISING, 'morningRising', True),
    (swisseph.HELIACAL_SETTING, 'eveningSetting', False),
)
_BODY_IDS = {
    const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
    const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN,
}

# —— 先排除用的采样口径(都往「宁可多搜一次」的方向留余量;实测的事件时刻:日高 −13.9°…−2.3°,可见度差值 ≥ 0)——
_STEP_DAYS = 3.0 / 1440.0     # 每 3 分钟看一眼
_PAD_DAYS = 0.02              # 窗两头各多看半小时
_SUN_ALT_MAX = 1.0            # 太阳高过这个高度就是白天,不看
_BODY_ALT_MIN = -2.0          # 行星低于这个高度(按几何高度估,留出折射 / 视差 / 插值的余量)就是没升起,不看
_SIDE_TOLERANCE = 15.0        # 太阳在下中天前后这么多度以内,清晨黄昏两边都算
_SUN_TRANSIT_ALT_MIN = -1.3   # 太阳上中天的几何高度低于它 = 当天不升起(实测有事件的日子最低 −0.86°,即上缘加折射刚好露头),整天不看
_VIS_MARGIN = 1.0             # 粗看(3 分钟一眼):极限星等只比该星暗这么多以内的高点,再细看
_FINE_STEP_DAYS = 20.0 / 86400.0   # 细看:高点前后 3 分钟内每 20 秒一眼
_FINE_HALF_STEPS = 9
_VIS_FINE_MARGIN = 0.15       # 细看后仍比该星暗这么多以上 = 这一段确实看不见(事件时刻的差值实测 ≥ 0)
_SIDEREAL_DEG_PER_DAY = 360.98564736629

_CACHE_MAX = 512
_cache = OrderedDict()
_cache_lock = threading.Lock()


def _unwrapped(values):
    out = [values[0]]
    for i in range(1, len(values)):
        out.append(out[-1] + ((values[i] - values[i - 1] + 180.0) % 360.0 - 180.0))
    return out


def _daily_nodes(body_id, t0, count):
    """逐日节点上的赤经(展开成连续值)、赤纬。"""
    ra, dec = [], []
    for i in range(count):
        xx, _ = swisseph.calc_ut(t0 + i, body_id, _EQU_FLAG)
        ra.append(xx[0])
        dec.append(xx[1])
    return _unwrapped(ra), dec


def _window_samples(birth_jd, lon, lat):
    """窗内「不是白天、且当天太阳有升落」的采样点:(时刻, 当地恒星时°, 清晨侧?, 黄昏侧?, 距窗首天数)。
    太阳位置逐日取、其间线性插值。"""
    t0 = birth_jd - WINDOW_DAYS - _PAD_DAYS
    t1 = birth_jd + WINDOW_DAYS + _PAD_DAYS
    count = int(math.ceil(t1 - t0)) + 2
    sun_ra, sun_dec = _daily_nodes(swisseph.SUN, t0, count)
    lst0 = swisseph.sidtime(t0) * 15.0 + lon
    sin_lat = math.sin(math.radians(lat))
    cos_lat = math.cos(math.radians(lat))
    out = []
    steps = int((t1 - t0) / _STEP_DAYS) + 1
    for j in range(steps):
        offset = j * _STEP_DAYS
        i = int(offset)
        u = offset - i
        dec_deg = sun_dec[i] + (sun_dec[i + 1] - sun_dec[i]) * u
        if 90.0 - abs(lat - dec_deg) < _SUN_TRANSIT_ALT_MIN:
            continue
        dec = math.radians(dec_deg)
        lst = lst0 + offset * _SIDEREAL_DEG_PER_DAY
        hour_angle = (lst - (sun_ra[i] + (sun_ra[i + 1] - sun_ra[i]) * u)) % 360.0
        sin_alt = sin_lat * math.sin(dec) + cos_lat * math.cos(dec) * math.cos(math.radians(hour_angle))
        if math.degrees(math.asin(max(-1.0, min(1.0, sin_alt)))) >= _SUN_ALT_MAX:
            continue
        near_lower_transit = abs(hour_angle - 180.0) <= _SIDE_TOLERANCE
        # 时角 180°–360° = 太阳在子午线以东(下中天之后、上中天之前)= 清晨一侧
        out.append((t0 + offset, lst, near_lower_transit or hour_angle > 180.0, near_lower_transit or hour_angle < 180.0, offset))
    return t0, count, out


def _visibility(t, geopos, name):
    """该时刻「极限星等 − 该星星等」;星在地平线下 → None。"""
    retval, darr = swisseph.vis_limit_mag(t, geopos, list(_ATMO), list(_OBSERVER), name, _HEL_FLAG)
    if retval == -2:
        return None
    return darr[0] - darr[7]


def _stretch_may_be_visible(stretch, geopos, name):
    """一段连续采样里有没有可能看得见的时刻:只细看粗看序列的局部高点。"""
    for k, (t, value) in enumerate(stretch):
        if value <= -_VIS_MARGIN:
            continue
        if k > 0 and stretch[k - 1][1] > value:
            continue
        if k + 1 < len(stretch) and stretch[k + 1][1] > value:
            continue
        if value > -_VIS_FINE_MARGIN:
            return True
        for j in range(-_FINE_HALF_STEPS, _FINE_HALF_STEPS + 1):
            if j == 0:
                continue
            fine = _visibility(t + j * _FINE_STEP_DAYS, geopos, name)
            if fine is not None and fine > -_VIS_FINE_MARGIN:
                return True
    return False


def _may_be_visible(samples, t0, count, geopos, obj, lat, morning):
    """窗内对应那半边天,有没有哪怕一刻可能看得见这颗星。任何拿不准的情形都返回 True(照原样去搜)。"""
    body_id = _BODY_IDS.get(obj)
    if body_id is None:
        return True
    try:
        ra, dec = _daily_nodes(body_id, t0, count)
        sin_lat = math.sin(math.radians(lat))
        cos_lat = math.cos(math.radians(lat))
        min_sin_alt = math.sin(math.radians(_BODY_ALT_MIN))
        # 星历库的可见度函数会把传进去的星名字符串就地改成小写:每次都给它一份私有的、本来就是小写的副本,
        # 绝不能把共享的星名常量本身传进去(常量被改写后,全进程按星名取值的地方都会失灵)。
        name = obj.encode('ascii').decode('ascii').lower()
        stretch = []   # 时间上相邻(间隔一个步长)且星在地平线上的一段:(时刻, 差值)
        last_t = None
        for t, lst, on_morning, on_evening, offset in samples:
            if not (on_morning if morning else on_evening):
                continue
            i = int(offset)
            u = offset - i
            d = math.radians(dec[i] + (dec[i + 1] - dec[i]) * u)
            hour_angle = math.radians(lst - (ra[i] + (ra[i + 1] - ra[i]) * u))
            if sin_lat * math.sin(d) + cos_lat * math.cos(d) * math.cos(hour_angle) < min_sin_alt:
                continue
            value = _visibility(t, geopos, name)
            contiguous = last_t is not None and (t - last_t) < 1.5 * _STEP_DAYS
            if value is None or not contiguous:
                if stretch and _stretch_may_be_visible(stretch, geopos, name):
                    return True
                stretch = []
            last_t = t if value is not None else None
            if value is not None:
                stretch.append((t, value))
        return bool(stretch) and _stretch_may_be_visible(stretch, geopos, name)
    except Exception:
        return True


def _search(birth_jd, geopos, obj, event):
    """照原样问星历库:出生前十五天之后的第一次事件离出生是否不超过七天。"""
    tret = swisseph.heliacal_ut(birth_jd - SEARCH_BACK_DAYS, geopos, list(_ATMO), list(_OBSERVER), obj, event, _HEL_FLAG)
    jd = tret[0] if isinstance(tret, (list, tuple)) else tret
    return abs(jd - birth_jd) <= WINDOW_DAYS


def compute_phasis_event(birth_jd, lon, lat, obj, stats=None):
    """birth 临近(≤7 天)该星偕日升 → 'morningRising'(晨星初现);偕日没 → 'eveningSetting'(昏星初没);都不是 → None。

    两种事件各自判定:一种搜不到(星历库在若干个会合周期内找不到日期而报错),不影响另一种。
    stats(可选的 dict)累计本次「先排除掉 / 真去搜了」各几次,只供自检。
    """
    geopos = [float(lon), float(lat), 0.0]
    polar = abs(float(lat)) >= POLAR_LATITUDE
    window = None
    for event, label, morning in _EVENTS:
        if polar:
            if window is None:
                try:
                    window = _window_samples(birth_jd, float(lon), float(lat))
                except Exception:
                    window = False
            if window and not _may_be_visible(window[2], window[0], window[1], geopos, obj, float(lat), morning):
                if stats is not None:
                    stats['skipped'] = stats.get('skipped', 0) + 1
                continue
        if stats is not None:
            stats['searched'] = stats.get('searched', 0) + 1
        try:
            if _search(birth_jd, geopos, obj, event):
                return label
        except Exception:
            continue
    return None


def phasis_event(birth_jd, lon, lat, obj):
    """compute_phasis_event 的进程级缓存版(同一颗星 / 时刻 / 地点只算一次)。"""
    key = (obj, round(float(birth_jd), 7), round(float(lon), 6), round(float(lat), 6))
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    label = compute_phasis_event(birth_jd, lon, lat, obj)
    with _cache_lock:
        _cache[key] = label
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return label


def clear_cache():
    with _cache_lock:
        _cache.clear()
