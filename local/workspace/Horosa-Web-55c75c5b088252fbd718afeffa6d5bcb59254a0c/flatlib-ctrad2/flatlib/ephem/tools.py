"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements functions specifically 
    for the ephem subpackage.
    
"""

from . import swe
from flatlib import angle
from flatlib import const
from flatlib import utils
from flatlib.tools import arabicparts


# One arc-second error for iterative algorithms
MAX_ERROR = 0.0003


# === Object positions === #

def pfLon(jd, lat, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns the ecliptic longitude of Pars Fortuna.
    It considers diurnal or nocturnal conditions.
    
    """
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    moon = swe.sweObjectLon(const.MOON, jd, flags)
    sidflag = flags & swe.SEFLG_SIDEREAL
    if sidflag == 0:
        asc = swe.sweHousesLon(jd, lat, lon, const.HOUSES_DEFAULT)[1][0]
    else:
        asc = swe.sweHousesLon(jd, lat, lon, const.HOUSES_DEFAULT, swe.SEFLG_SIDEREAL)[1][0]

    if isDiurnal(jd, lat, lon, flags):
        return angle.norm(asc + moon - sun)
    else:
        return angle.norm(asc + sun - moon)


def pcLon(jd, lat, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns the ecliptic longitude of Purple Cloud.

    """
    res = 188.6849 + 360 * (jd - 2451543.5) / 10226.78132
    res = res % 360
    return res if res >= 0 else res + 360

def pcRA(lon, lat):
    return utils.eqCoords(lon, lat)[0]

# === Diurnal  === #

def isDiurnal(jd, lat, lon, flags=swe.SEDEFAULT_FLAG):
    """ Returns true if the sun is above the horizon
    of a given date and location. 
    
    """
    sun = swe.sweObject(const.SUN, jd, flags)
    sidflag = flags & swe.SEFLG_SIDEREAL
    if sidflag == 0:
        mc = swe.sweHousesLon(jd, lat, lon, const.HOUSES_DEFAULT)[1][1]
    else:
        mc = swe.sweHousesLon(jd, lat, lon, const.HOUSES_DEFAULT, swe.SEFLG_SIDEREAL)[1][1]
    ra, decl = utils.eqCoords(sun['lon'], sun['lat'])
    mcRA, _ = utils.eqCoords(mc, 0.0)
    return utils.isAboveHorizon(ra, decl, mcRA, lat)
    

# === Iterative algorithms === #

def syzygyJD(jd, flags=swe.SEDEFAULT_FLAG):
    """ Finds the latest new or full moon and
    returns the julian date of that event. 
    
    """
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    moon = swe.sweObjectLon(const.MOON, jd, flags)
    dist = angle.distance(sun, moon)
    
    # Offset represents the Syzygy type. 
    # Zero is conjunction and 180 is opposition.
    offset = 180 if (dist >= 180) else 0
    while abs(dist) > MAX_ERROR:
        jd = jd - dist / 13.1833  # Moon mean daily motion
        sun = swe.sweObjectLon(const.SUN, jd, flags)
        moon = swe.sweObjectLon(const.MOON, jd, flags)
        dist = angle.closestdistance(sun - offset, moon)
    return jd

def solarReturnJD(jd, lon, forward=True, flags=swe.SEDEFAULT_FLAG):
    """ Finds the julian date before or after 
    'jd' when the sun is at longitude 'lon'. 
    It searches forward by default.
    
    """
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    if forward:
        dist = angle.distance(sun, lon)
    else:
        dist = -angle.distance(lon, sun)
        
    while abs(dist) > MAX_ERROR:
        jd = jd + dist / 0.9833  # Sun mean motion
        sun = swe.sweObjectLon(const.SUN, jd, flags)
        dist = angle.closestdistance(sun, lon)
    return jd


# === Other algorithms === #

def nextStationJD(ID, jd, flags=swe.SEDEFAULT_FLAG):
    """ Finds the aproximate julian date of the
    next station of a planet.

    """
    speed = swe.sweObject(ID, jd, flags)['lonspeed']
    for i in range(2000):
        nextjd = jd + i / 2
        nextspeed = swe.sweObject(ID, nextjd, flags)['lonspeed']
        if speed * nextspeed <= 0:
            return nextjd
    return None
