"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements functions which are useful
    for flatlib. Basically, it converts internal objects 
    and lists from the ephemeris to flatlib.objects and 
    flatlib.lists.
    
    Flatlib users will want to use this module for 
    accessing the ephemeris.
    
"""

import copy
import os
import threading
from collections import OrderedDict

import swisseph
from . import eph
from . import swe
from flatlib import const
from flatlib import utils

from flatlib.datetime import Datetime
from flatlib.object import (GenericObject, Object,
                            House, FixedStar)
from flatlib.lists import (GenericList, ObjectList,
                           HouseList, FixedStarList)


# v3.0.1 perf ROUND-5 (HOROSA_STAR_LRU):恒星批(67 恒星 / 28 宿)只依赖
# (IDs, date.jd, pos, height, flags, sidereal 上下文) —— 与宫位制/容许度/相位设置完全无关。
# 「改设置重排同一命盘」时这些输入不变,但每次仍全量重取(swisseph 逐星重扫 sefstars.txt,~460ms/盘)。
# 有界 LRU(8 条,线程安全):**存入与命中都走 deepcopy** —— 缓存内永远是"出厂原样"的批,消费者
# (relocateSouthObjects 的 +180°、su28 的 ra 调整)改的是自己的副本,互不串染 → 值与全新计算
# 逐字节一致(同键取数确定性已实测)。deepcopy ~2-3ms vs 重算 ~130ms。kill-switch:HOROSA_STAR_LRU=0。
_STAR_LRU_ENABLED = os.environ.get('HOROSA_STAR_LRU', '1').lower() not in ('0', 'false', 'no', 'off')
_STAR_LRU_MAX = 8
_STAR_LRU = OrderedDict()
_STAR_LRU_LOCK = threading.Lock()


def _siderealCtxKey():
    ctx = swe._SIDEREAL_CONTEXT
    return (getattr(ctx, 'mode', None), getattr(ctx, 't0', 0.0), getattr(ctx, 'ayan_t0', 0.0))


def _starLruLookup(kind, IDs, date, pos, height, flags):
    key = (kind, tuple(IDs), date.jd, pos.lat, pos.lon, height, flags, _siderealCtxKey())
    with _STAR_LRU_LOCK:
        hit = _STAR_LRU.get(key)
        if hit is not None:
            _STAR_LRU.move_to_end(key)
            return key, copy.deepcopy(hit)
    return key, None


def _starLruStore(key, starList):
    pristine = copy.deepcopy(starList)
    with _STAR_LRU_LOCK:
        _STAR_LRU[key] = pristine
        _STAR_LRU.move_to_end(key)
        while len(_STAR_LRU) > _STAR_LRU_MAX:
            _STAR_LRU.popitem(last=False)


# === Objects === #

def calcMiddle(obj1, obj2, date, pos, height=150):
    lon = (obj1.lon + obj2.lon) / 2
    lat = (obj1.lat + obj2.lat) / 2
    if abs(lon - obj1.lon) > 90:
        lon = (lon + 180) % 360
    obj = {
        'id': obj1.id + obj2.id,
        'type': const.OBJ_MIDDLE,
        'lon': lon,
        'lat': lat,
    }
    eq = utils.eqCoords(obj['lon'], obj['lat'])
    obj['ra'] = eq[0]
    obj['decl'] = eq[1]
    za = swisseph.azalt(date.jd, 0, [pos.lon, pos.lat, height], 1000, 20, [obj['lon'], obj['lat'], 0])
    obj['azimuth'] = za[0]
    obj['altitudeTrue'] = za[1]
    obj['altitudeAppa'] = za[2]
    res = Object.fromDict(obj)
    res.relocate(res.lon)
    return res

def getObject(ID, date, pos, height=150, flags=swe.SEDEFAULT_FLAG):
    """ Returns an ephemeris object. """
    obj = eph.getObject(ID, date.jd, pos.lat, pos.lon, flags)
    za = swisseph.azalt(date.jd, 0, [pos.lon, pos.lat, height], 1000, 20, [obj['lon'], obj['lat'], 0])
    obj['azimuth'] = za[0]
    obj['altitudeTrue'] = za[1]
    obj['altitudeAppa'] = za[2]
    return Object.fromDict(obj)

def getObjectList(IDs, date, pos, height=150, flags=swe.SEDEFAULT_FLAG):
    """ Returns a list of objects. """
    objList = []
    for ID in IDs:
        try:
            objList.append(getObject(ID, date, pos, height, flags))
        except Exception:
            # 个别天体在其星历物理域外(如凯龙限 AD675-4649)时跳过该星,
            # 整盘照常(与 ACG 单星降级同语义);域内任何星不会走到这里。
            continue
    res = ObjectList(objList)
    try:
        if IDs.index(const.SUN) >= 0 and IDs.index(const.MOON) >= 0:
            obj1 = res.get(const.MOON)
            obj2 = res.get(const.SUN)
            obj = calcMiddle(obj1, obj2, date, pos, height)
            obj.id = const.MOONSUN
            objList.append(obj)
    except ValueError:
        pass

    try:
        if IDs.index(const.SATURN) >= 0 and IDs.index(const.MARS) >= 0:
            obj1 = res.get(const.SATURN)
            obj2 = res.get(const.MARS)
            obj = calcMiddle(obj1, obj2, date, pos, height)
            obj.id = const.SATURNMARS
            objList.append(obj)
    except ValueError:
        pass

    try:
        if IDs.index(const.JUPITER) >= 0 and IDs.index(const.VENUS) >= 0:
            obj1 = res.get(const.JUPITER)
            obj2 = res.get(const.VENUS)
            obj = calcMiddle(obj1, obj2, date, pos, height)
            obj.id = const.JUPITERVENUS
            objList.append(obj)
    except ValueError:
        pass

    return ObjectList(objList)


# === Houses and angles === #

def getHouses(date, pos, hsys, height=150, flag=0):
    """ Returns the lists of houses and angles.
    
    Since houses and angles are computed at the
    same time, this function should be fast.
    
    """
    houses, angles = eph.getHouses(date.jd, pos.lat, pos.lon, hsys, flag)
    hList = [House.fromDict(house) for house in houses]
    aList = [GenericObject.fromDict(angle) for angle in angles]
    for obj in aList:
        za = swisseph.azalt(date.jd, 0, [pos.lon, pos.lat, height], 1000, 20, [obj.lon, obj.lat, 0])
        obj.azimuth = za[0]
        obj.altitudeTrue = za[1]
        obj.altitudeAppa = za[2]

    return (HouseList(hList), GenericList(aList))
    
def getHouseList(date, pos, hsys):
    """ Returns a list of houses. """
    return getHouses(date, pos, hsys)['houses']

def getAngleList(date, pos, hsys):
    """ Returns a list of angles (Asc, MC..) """
    return getHouses(date, pos, hsys)['angles']


# === Fixed stars === #

def getFixedStar(ID, date, pos, height, flags=swe.SEDEFAULT_FLAG):
    """ Returns a fixed star from the ephemeris. """
    star = eph.getFixedStar(ID, date.jd, flags)
    za = swisseph.azalt(date.jd, 0, [pos.lon, pos.lat, height], 1000, 20, [star['lon'], star['lat'], 0])
    star['azimuth'] = za[0]
    star['altitudeTrue'] = za[1]
    star['altitudeAppa'] = za[2]
    return FixedStar.fromDict(star)

def getFixedStarSu28(ID, date, pos, height, flags=swe.SEDEFAULT_FLAG):
    """ Returns a fixed star from the ephemeris. """
    star = eph.getFixedStarSu28(ID, date.jd, flags)
    za = swisseph.azalt(date.jd, 0, [pos.lon, pos.lat, height], 1000, 20, [star['lon'], star['lat'], 0])
    star['azimuth'] = za[0]
    star['altitudeTrue'] = za[1]
    star['altitudeAppa'] = za[2]
    return FixedStar.fromDict(star)

def getFixedStarList(IDs, date, pos, height, flags=swe.SEDEFAULT_FLAG):
    """ Returns a list of fixed stars. """
    if _STAR_LRU_ENABLED:
        key, hit = _starLruLookup('stars67', IDs, date, pos, height, flags)
        if hit is not None:
            return hit
        starList = [getFixedStar(ID, date, pos, height, flags) for ID in IDs]
        res = FixedStarList(starList)
        _starLruStore(key, res)
        return res
    starList = [getFixedStar(ID, date, pos, height, flags) for ID in IDs]
    return FixedStarList(starList)

def getFixedStarSu28List(IDs, date, pos, height, flags=swe.SEDEFAULT_FLAG):
    """ Returns a list of fixed stars. """
    if _STAR_LRU_ENABLED:
        key, hit = _starLruLookup('su28', IDs, date, pos, height, flags)
        if hit is not None:
            return hit
        starList = [getFixedStarSu28(ID, date, pos, height, flags) for ID in IDs]
        res = FixedStarList(starList)
        _starLruStore(key, res)
        return res
    starList = [getFixedStarSu28(ID, date, pos, height, flags) for ID in IDs]
    return FixedStarList(starList)


# === Solar returns === #

def nextSolarReturn(date, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns the next date when sun is at longitude 'lon'. """
    jd = eph.nextSolarReturn(date.jd, lon, flags)
    return Datetime.fromJD(jd, date.utcoffset)

def prevSolarReturn(date, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns the previous date when sun is at longitude 'lon'. """
    jd = eph.prevSolarReturn(date.jd, lon, flags)
    return Datetime.fromJD(jd, date.utcoffset)


# === Sunrise and sunsets === #

def nextSunrise(date, pos):
    """ Returns the date of the next sunrise. """
    jd = eph.nextSunrise(date.jd, pos.lat, pos.lon)
    return Datetime.fromJD(jd, date.utcoffset)

def nextSunset(date, pos):
    """ Returns the date of the next sunset. """
    jd = eph.nextSunset(date.jd, pos.lat, pos.lon)
    return Datetime.fromJD(jd, date.utcoffset)

def lastSunrise(date, pos):
    """ Returns the date of the last sunrise. """
    jd = eph.lastSunrise(date.jd, pos.lat, pos.lon)
    return Datetime.fromJD(jd, date.utcoffset)

def lastSunset(date, pos):
    """ Returns the date of the last sunset. """
    jd = eph.lastSunset(date.jd, pos.lat, pos.lon)
    return Datetime.fromJD(jd, date.utcoffset)


# === Station === #

def nextStation(ID, date):
    """ Returns the aproximate date of the next station. """
    jd = eph.nextStation(ID, date.jd)
    return Datetime.fromJD(jd, date.utcoffset)


# === Eclipses === #

def prevSolarEclipse(date):
    """ Returns the Datetime of the maximum phase of the
    previous global solar eclipse.

    """

    eclipse = swe.solarEclipseGlobal(date.jd, backward=True)
    return Datetime.fromJD(eclipse['maximum'], date.utcoffset)

def nextSolarEclipse(date):
    """ Returns the Datetime of the maximum phase of the
    next global solar eclipse.

    """

    eclipse = swe.solarEclipseGlobal(date.jd, backward=False)
    return Datetime.fromJD(eclipse['maximum'], date.utcoffset)

def prevLunarEclipse(date):
    """ Returns the Datetime of the maximum phase of the
    previous global lunar eclipse.

    """

    eclipse = swe.lunarEclipseGlobal(date.jd, backward=True)
    return Datetime.fromJD(eclipse['maximum'], date.utcoffset)

def nextLunarEclipse(date):
    """ Returns the Datetime of the maximum phase of the
    next global lunar eclipse.

    """

    eclipse = swe.lunarEclipseGlobal(date.jd, backward=False)
    return Datetime.fromJD(eclipse['maximum'], date.utcoffset)
