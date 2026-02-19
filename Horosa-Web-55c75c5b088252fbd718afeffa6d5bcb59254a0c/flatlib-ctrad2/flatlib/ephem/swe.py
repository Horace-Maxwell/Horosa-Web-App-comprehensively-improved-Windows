"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements a simple interface with the C 
    Swiss Ephemeris using the pyswisseph library.
    
    The pyswisseph library must be already installed and
    accessible.
  
"""

import math
import swisseph
from flatlib import angle
from flatlib import const
from flatlib import utils


SEFLG_JPLEPH = 1    # use JPL ephemeris
SEFLG_SWIEPH = 2    # use SWISSEPH ephemeris, default
SEFLG_MOSEPH = 4    # use Moshier ephemeris
SEFLG_HELCTR = 8    # return heliocentric position
SEFLG_TRUEPOS = 16  # return true positions, not apparent
SEFLG_J2000 = 32    # no precession, i.e. give J2000 equinox
SEFLG_NONUT = 64    # no nutation, i.e. mean equinox of date
SEFLG_SPEED3 = 128  # speed from 3 positions (do not use it, SEFLG_SPEED is faster and preciser.)
SEFLG_SPEED = 256   # high precision speed (analyt. comp.)
SEFLG_NOGDEFL = 512 # turn off gravitational deflection
SEFLG_NOABERR = 1024 # turn off 'annual' aberration of light
SEFLG_ASTROMETRIC = SEFLG_NOABERR | SEFLG_NOGDEFL # astrometric positions
SEFLG_EQUATORIAL = 2048 # equatorial positions are wanted
SEFLG_XYZ = 4096    # cartesian, not polar, coordinates
SEFLG_RADIANS = 8192    # coordinates in radians, not degree
SEFLG_BARYCTR = 16384   # barycentric positions
SEFLG_TOPOCTR = 32 * 1024 # topocentric positions
SEFLG_SIDEREAL = 64 * 1024  # sidereal positions
SEFLG_ICRS = 128 * 1024 # ICRS (DE406 reference frame)
SEFLG_DPSIDEPS_1980 = 256 * 1024 # reproduce JPL Horizons * 1962 - today to 0.002 arcsec
SEFLG_JPLHOR = SEFLG_DPSIDEPS_1980
SEFLG_JPLHOR_APPROX = 512 * 1024 # approximate JPL Horizons 1962 - today

SEDEFAULT_FLAG = swisseph.FLG_SWIEPH + swisseph.FLG_SPEED

SE_SIDM_LAHIRI = 1
SE_SIDM_J2000 = 18
SE_SIDM_J1900 = 19
SE_SIDM_B1950 = 20
SEDEFAULT_SIDM__MODE = SE_SIDM_LAHIRI

# Map objects
SWE_OBJECTS = {
    const.SUN: 0,
    const.MOON: 1,
    const.MERCURY: 2, 
    const.VENUS: 3,
    const.MARS: 4,
    const.JUPITER: 5, 
    const.SATURN: 6,
    const.URANUS: 7,
    const.NEPTUNE: 8, 
    const.PLUTO: 9,
    const.CHIRON: 15, 
    const.NORTH_NODE: 10,
    const.DARKMOON: 12,
    const.PHOLUS: 16,
    const.CERES: 17,
    const.PALLAS: 18,
    const.JUNO: 19,
    const.VESTA: 20,
    const.INTP_APOG: 21,
    const.INTP_PERG: 22
}

# Map house systems
SWE_HOUSESYS = {
    const.HOUSES_PLACIDUS: b'P',
    const.HOUSES_KOCH: b'K', 
    const.HOUSES_PORPHYRIUS: b'O',
    const.HOUSES_REGIOMONTANUS: b'R',
    const.HOUSES_CAMPANUS: b'C',
    const.HOUSES_EQUAL: b'A',
    const.HOUSES_EQUAL_2: b'E',
    const.HOUSES_VEHLOW_EQUAL: b'V',
    const.HOUSES_WHOLE_SIGN: b'W',
    const.HOUSES_MERIDIAN: b'X', 
    const.HOUSES_AZIMUTHAL: b'H',
    const.HOUSES_POLICH_PAGE: b'T', 
    const.HOUSES_ALCABITUS: b'B',
    const.HOUSES_SRIPATI: b'S',
    const.HOUSES_MORINUS: b'M',
    const.HOUSES_EQUAL_MC: b'D'
}


# ==== Internal functions ==== #

def setPath(path):
    """ Sets the path for the swe files. """
    swisseph.set_ephe_path(path)


# === Object functions === #

def sweObject(obj, jd, flags=SEDEFAULT_FLAG):
    """ Returns an object from the Ephemeris. """
    sweObj = SWE_OBJECTS[obj]
    swisseph.set_sid_mode(SEDEFAULT_SIDM__MODE)
    sweList = swisseph.calc_ut(jd, sweObj, flags)[0]
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = swisseph.calc_ut(jd, sweObj, newflags)[0]
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360

    return {
        'id': obj,
        'lon': sweList[0],
        'lat': sweList[1],
        'lonspeed': sweList[3],
        'latspeed': sweList[4],
        'ra': ra,
        'decl': eqlist[1],
        'raspeed': eqlist[3],
        'declspeed': eqlist[4]
    }
    
def sweObjectLon(obj, jd, flags=SEDEFAULT_FLAG):
    """ Returns the longitude of an object. """
    sweObj = SWE_OBJECTS[obj]
    swisseph.set_sid_mode(SEDEFAULT_SIDM__MODE)
    sweList = swisseph.calc_ut(jd, sweObj, flags)[0]
    return sweList[0]


def sweNextTransit(obj, jd, lat, lon, flag):
    """ Returns the julian date of the next transit of
    an object. The flag should be 'RISE' or 'SET'. 
    
    """
    sweObj = SWE_OBJECTS[obj]
    flag = swisseph.CALC_RISE if flag == 'RISE' else swisseph.CALC_SET
    trans = swisseph.rise_trans(jd, sweObj, lon, lat, 0, 0, 0, flag)
    return trans[1][0]



# === Houses and angles === #
        
def sweHouses(jd, lat, lon, hsys, flag=0):
    """ Returns lists of houses and angles. """
    hlist = None
    ascmc = None
    swhsys = SWE_HOUSESYS[hsys]
    if flag == 0:
        hlist, ascmc = swisseph.houses(jd, lat, lon, swhsys)
    else:
        if flag == swisseph.FLG_RADIANS:
            hlist, ascmc = swisseph.houses_ex(jd, lat, lon, swhsys, swisseph.FLG_RADIANS)
        else:
            hlist, ascmc = swisseph.houses_ex(jd, lat, lon, swhsys, swisseph.FLG_SIDEREAL)
    # Add first house to the end of 'hlist' so that we
    # can compute house sizes with an iterator 
    hlist += (hlist[0],)
    houses = [
        {
            'hsys': hsys,
            'id': const.LIST_HOUSES[i],
            'lon': hlist[i], 
            'size': angle.distance(hlist[i], hlist[i+1])
        } for i in range(12)
    ]
    for house in houses:
        eqcod = swisseph.cotrans([house['lon'], 0, 1], const.ECLI2EQ_OBLIQUITY)
        house['ra'] = eqcod[0]
        house['decl'] = eqcod[1]

    descLon = angle.norm(ascmc[0] + 180)
    icLon = angle.norm(ascmc[1] + 180)

    ascEclip = swisseph.cotrans([ascmc[4], lat, 1], const.EQ2ECLI_OBLIQUITY)
    descRA= swisseph.cotrans([descLon, ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)
    mcRA = swisseph.cotrans([ascmc[1], ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)
    icRA = swisseph.cotrans([icLon, ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)

    angles = [
        {'id': const.ASC, 'lon': ascmc[0], 'lat': ascEclip[1], 'ra': ascmc[4], 'decl': lat},
        {'id': const.DESC, 'lon': descLon, 'lat': ascEclip[1], 'ra': descRA[0], 'decl': descRA[1]},
        {'id': const.MC, 'lon': ascmc[1], 'lat': ascEclip[1], 'ra': mcRA[0], 'decl': mcRA[1]},
        {'id': const.IC, 'lon': icLon, 'lat': ascEclip[1], 'ra': icRA[0], 'decl': icRA[1]}
    ]
    return (houses, angles)
    
def sweHousesLon(jd, lat, lon, hsys, flag=0):
    """ Returns lists with house and angle longitudes. """
    hlist = None
    ascmc = None
    hsys = SWE_HOUSESYS[hsys]
    if flag == 0:
        hlist, ascmc = swisseph.houses(jd, lat, lon, hsys)
    else:
        if flag == swisseph.FLG_RADIANS:
            hlist, ascmc = swisseph.houses_ex(jd, lat, lon, hsys, swisseph.FLG_RADIANS)
        else:
            hlist, ascmc = swisseph.houses_ex(jd, lat, lon, hsys, swisseph.FLG_SIDEREAL)

    angles = [
        ascmc[0],
        ascmc[1],
        angle.norm(ascmc[0] + 180), 
        angle.norm(ascmc[1] + 180)
    ]
    return (hlist, angles)


# === Fixed stars === #

# Beware: the swisseph.fixstar_mag function is really 
# slow because it parses the fixstars.cat file every 
# time..

def sweFixedStar(star, jd, flags=SEDEFAULT_FLAG):
    """ Returns a fixed star from the Ephemeris. """
    swisseph.set_sid_mode(SEDEFAULT_SIDM__MODE)
    sweList = swisseph.fixstar_ut(star, jd, flags)[0]
    mag = swisseph.fixstar_mag(star)
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = swisseph.fixstar_ut(star, jd, newflags)[0]
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360
    try:
        name = const.STAR_NAMES[star]
    except:
        name = star
    return {
        'id': star,
        'name': name,
        'mag': mag,
        'lon': sweList[0],
        'lat': sweList[1],
        'ra': ra,
        'decl': eqlist[1]
    }


def sweFixedStarSu28(star, jd, flags=SEDEFAULT_FLAG):
    """ Returns a fixed star from the Ephemeris. """
    swisseph.set_sid_mode(SEDEFAULT_SIDM__MODE)
    sweList = swisseph.fixstar_ut(star, jd, flags)[0]
    mag = swisseph.fixstar_mag(star)
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = swisseph.fixstar_ut(star, jd, newflags)[0]
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360
    idx = const.LIST_FIXED_SU28.index(star)
    su = const.LIST_FIXED_SU28_NAME[idx]
    return {
        'id': star,
        'name': su,
        'wuxing': const.Su28WuXing[su],
        'animal': const.Su28Animal[su],
        'mag': mag,
        'lon': sweList[0],
        'lat': sweList[1],
        'ra': ra,
        'decl': eqlist[1]
    }



# === Eclipses === #

def solarEclipseGlobal(jd, backward):
    """ Returns the jd details of previous or next global solar eclipse. """

    sweList = swisseph.sol_eclipse_when_glob(jd, backward=backward)
    return {
        'maximum': sweList[1][0],
        'begin': sweList[1][2],
        'end': sweList[1][3],
        'totality_begin': sweList[1][4],
        'totality_end': sweList[1][5],
        'center_line_begin': sweList[1][6],
        'center_line_end': sweList[1][7],
    }

def lunarEclipseGlobal(jd, backward):
    """ Returns the jd details of previous or next global lunar eclipse. """

    sweList = swisseph.lun_eclipse_when(jd, backward=backward)
    return {
        'maximum': sweList[1][0],
        'partial_begin': sweList[1][2],
        'partial_end': sweList[1][3],
        'totality_begin': sweList[1][4],
        'totality_end': sweList[1][5],
        'penumbral_begin': sweList[1][6],
        'penumbral_end': sweList[1][7],
    }
