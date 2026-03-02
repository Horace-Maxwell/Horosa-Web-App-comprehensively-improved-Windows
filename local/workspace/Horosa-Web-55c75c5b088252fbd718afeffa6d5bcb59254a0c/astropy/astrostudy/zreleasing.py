import math
from flatlib.datetime import Datetime
from flatlib import const
from astrostudy import helper

ZRYEARDAYS = 360
ZRMONTHDAYS = 30
ZRWEEKDAYS = 2.5
ZRDAYDAYS = 2.5/12

ZRLevels = [ZRYEARDAYS, ZRMONTHDAYS, ZRWEEKDAYS, ZRDAYDAYS]

ZodiacalReleasing = {}

ZodiacalReleasing[const.ARIES] = 15
ZodiacalReleasing[const.TAURUS] = 8
ZodiacalReleasing[const.GEMINI] = 20
ZodiacalReleasing[const.CANCER] = 25
ZodiacalReleasing[const.LEO] = 19
ZodiacalReleasing[const.VIRGO] = 20
ZodiacalReleasing[const.LIBRA] = 8
ZodiacalReleasing[const.SCORPIO] = 15
ZodiacalReleasing[const.SAGITTARIUS] = 12
ZodiacalReleasing[const.CAPRICORN] = 27
ZodiacalReleasing[const.AQUARIUS] = 30
ZodiacalReleasing[const.PISCES] = 12

def computeLevelInfo(sign, startDate: Datetime, levelIdx):
    unitdays = ZRLevels[levelIdx]
    unitcnt = ZodiacalReleasing[sign]
    totaldays = unitdays * unitcnt

    datestr = startDate.toCNString()
    parts = datestr.split(' ')

    res = {
        'sign': sign,
        'level':  levelIdx + 1,
        'date': parts[0],
        'days': totaldays
    }
    return res

def computeLevel(startSign, startDate: Datetime, levelIdx, stopLevelIdx, zone):
    if levelIdx > stopLevelIdx or stopLevelIdx > 3 or stopLevelIdx < 0 or levelIdx < 0:
        return None

    signidx = const.LIST_SIGNS.index(startSign)
    levelInfo = computeLevelInfo(startSign, startDate, levelIdx)
    totaldays = levelInfo['days'];
    cnt = 0
    idx = signidx
    nextDate = startDate
    sublevel = []
    while cnt < totaldays:
        sublevelSign = const.LIST_SIGNS[idx]
        sublevelObj = computeLevel(sublevelSign, nextDate, levelIdx + 1, stopLevelIdx, zone)
        if sublevelObj == None:
            return levelInfo

        days = sublevelObj['days']
        daydelta = days if cnt + days < totaldays else totaldays - cnt + 1
        nextDate = Datetime.fromJD(nextDate.jd + daydelta, zone)
        cnt = cnt + daydelta
        sublevel.append(sublevelObj)
        idx = (idx + 1) % 12
        if idx == signidx:
            idx = (idx + 6) % 12

    levelInfo['sublevel'] = sublevel
    return levelInfo

def compute(perchart, startSign, stopLevelIdx=3):
    totaldays = 36524.21904
    signidx = const.LIST_SIGNS.index(startSign)
    cnt = 0
    idx = signidx
    nextDate = perchart.chart.date
    zr = []
    while(cnt < totaldays):
        sign = const.LIST_SIGNS[idx]
        level = computeLevel(sign, nextDate, 0, stopLevelIdx, perchart.zone)
        zr.append(level)
        days = level['days']
        cnt = cnt + days
        nextDate = Datetime.fromJD(nextDate.jd + days, perchart.zone)
        idx = (idx + 1) % 12

    return zr