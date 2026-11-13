"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements functions for retrieving 
    astronomical and astrological data from an ephemeris.
    
    It is as middle layer between the Swiss Ephemeris 
    and user software. Objects are treated as python 
    dicts and jd/lat/lon as float.
  
"""

from . import swe
from . import tools
from flatlib import angle
from flatlib import const
from flatlib import utils
from flatlib.tools import arabicparts


# === Objects === #

def getObject(ID, jd, lat, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns an object for a specific date and 
    location.
    
    """
    if ID == const.SOUTH_NODE:
        obj = swe.sweObject(const.NORTH_NODE, jd, flags)
        # 南交是北交的对点:黄经、赤经各加 180°,黄纬、赤纬取反(连同速度)
        obj.update({
            'id': const.SOUTH_NODE,
            'lon': angle.norm(obj['lon'] + 180),
            'lat': -obj['lat'],
            'latspeed': -obj['latspeed'],
            'ra': angle.norm(obj['ra'] + 180),
            'decl': -obj['decl'],
            'declspeed': -obj['declspeed'],
        })
    elif ID == const.PARS_FORTUNA:
        pflon = tools.pfLon(jd, lat, lon, flags)
        ra = swe.eclipticToEquatorial(pflon, 0.0, swe.trueObliquity(jd), swe.tropicalOffset(jd, flags))   # 恒星盘先加回岁差
        realra = ra[0]
        obj = {
            'id': ID,
            'lon': pflon,
            'lat': 0,
            'lonspeed': 0,
            'latspeed': 0,
            'ra': realra,
            'decl': ra[1],
            'raspeed': 0,
            'declspeed': 0
        }
    elif ID == const.PURPLE_CLOUDS:
        pclon = tools.pcLon(jd, lat, lon, flags)
        pcRA = swe.eclipticToEquatorial(pclon, 0.0, swe.trueObliquity(jd), swe.tropicalOffset(jd, flags))
        realra = pcRA[0]
        obj = {
            'id': ID,
            'lon': pclon,
            'lat': 0,
            'lonspeed': 0,
            'latspeed': 0,
            'ra': realra,
            'decl': pcRA[1],
            'raspeed': 0,
            'declspeed': 0
        }
    elif ID == const.SYZYGY:
        szjd = tools.syzygyJD(jd)
        obj = swe.sweObject(const.MOON, szjd, flags)
        obj['id'] = const.SYZYGY
    else:
        obj = swe.sweObject(ID, jd, flags)

    _signInfo(obj)
    return obj


# === Houses === #

def getHouses(jd, lat, lon, hsys, flag=0):
    """ Returns lists of houses and angles. """
    houses, angles = swe.sweHouses(jd, lat, lon, hsys, flag)

    for house in houses:
        _signInfo(house)
    for angle in angles:
        _signInfo(angle)
    return (houses, angles)


# === Fixed stars === #

def getFixedStar(ID, jd, flags=swe.SEDEFAULT_FLAG):
    """ Returns a fixed star. """
    star = swe.sweFixedStar(ID, jd, flags)
    _signInfo(star)
    return star

def getFixedStarSu28(ID, jd, flags=swe.SEDEFAULT_FLAG):
    """ Returns a fixed star. """
    star = swe.sweFixedStarSu28(ID, jd, flags)
    _signInfo(star)
    return star


# === Solar returns === #

def nextSolarReturn(jd, lon, flags=swe.SEDEFAULT_FLAG):
    """ Return the JD of the next solar return. """
    return tools.solarReturnJD(jd, lon, True, flags)

def prevSolarReturn(jd, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns the JD of the previous solar return. """
    return tools.solarReturnJD(jd, lon, False, flags)


# === Sunrise and sunsets === #
    
def nextSunrise(jd, lat, lon):
    """ Returns the JD of the next sunrise. """
    return swe.sweNextTransit(const.SUN, jd, lat, lon, 'RISE')

def nextSunset(jd, lat, lon):
    """ Returns the JD of the next sunset. """
    return swe.sweNextTransit(const.SUN, jd, lat, lon, 'SET')

def lastSunrise(jd, lat, lon):
    """ Returns the JD of the last sunrise. """
    return nextSunrise(jd - 1.0, lat, lon)

def lastSunset(jd, lat, lon):
    """ Returns the JD of the last sunset. """
    return nextSunset(jd - 1.0, lat, lon)


# === Stations === #

def nextStation(ID, jd):
    """ Returns the aproximate jd of the next station. """
    return tools.nextStationJD(ID, jd)


# === Other functions === #

def _signInfo(obj):
    """ Appends the sign id and longitude to an object. """
    lon = obj['lon']
    obj.update({
        'sign': const.LIST_SIGNS[int(lon / 30)],
        'signlon': lon % 30
    })
