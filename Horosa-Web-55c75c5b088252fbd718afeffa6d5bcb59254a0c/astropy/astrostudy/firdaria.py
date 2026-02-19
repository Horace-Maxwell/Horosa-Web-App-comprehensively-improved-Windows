
import math
from flatlib import const
from flatlib.chart import Chart
from flatlib.ephem import ephem
from flatlib.datetime import Datetime
from astrostudy import helper

DiurnalMainDirect = [
    const.SUN,
    const.VENUS,
    const.MERCURY,
    const.MOON,
    const.SATURN,
    const.JUPITER,
    const.MARS,
    const.NORTH_NODE,
    const.SOUTH_NODE
]

NocturnalMainDirect = [
    const.MOON,
    const.SATURN,
    const.JUPITER,
    const.MARS,
    const.NORTH_NODE,
    const.SOUTH_NODE,
    const.SUN,
    const.VENUS,
    const.MERCURY
]

SubDirect = [
    const.SUN,
    const.VENUS,
    const.MERCURY,
    const.MOON,
    const.SATURN,
    const.JUPITER,
    const.MARS
]

SubDirectLen = len(SubDirect)

SubDirectIndex = {}
SubDirectIndex[const.SUN] = 0
SubDirectIndex[const.VENUS] = 1
SubDirectIndex[const.MERCURY] = 2
SubDirectIndex[const.MOON] = 3
SubDirectIndex[const.SATURN] = 4
SubDirectIndex[const.JUPITER] = 5
SubDirectIndex[const.MARS] = 6

PlanetRulerTime = {}
PlanetRulerTime[const.SUN] = 10
PlanetRulerTime[const.VENUS] = 8
PlanetRulerTime[const.MERCURY] = 13
PlanetRulerTime[const.MOON] = 9
PlanetRulerTime[const.SATURN] = 11
PlanetRulerTime[const.JUPITER] = 12
PlanetRulerTime[const.MARS] = 7
PlanetRulerTime[const.NORTH_NODE] = 3
PlanetRulerTime[const.SOUTH_NODE] = 2

def compute(chart):
    res = []
    zone = chart.date.utcoffset
    dt = chart.date

    maindirect = NocturnalMainDirect
    isdiurnal = chart.isDiurnal()
    if isdiurnal:
        maindirect = DiurnalMainDirect
    i = 0
    date = Datetime.fromJD(dt.jd, zone)
    for dir in maindirect:
        dirobj = {
            'mainDirect': dir,
            'subDirect': []
        }
        datestr = date.toCNString()
        parts = datestr.split(' ')
        if dir == const.NORTH_NODE:
            subobj = {
                'subDirect': const.NORTH_NODE,
                'date': parts[0]
            }
            dirobj['subDirect'].append(subobj)
            deltaday = PlanetRulerTime[const.NORTH_NODE] * 365.2421904
            jd = date.jd + deltaday
            date = Datetime.fromJD(jd, zone)

            res.append(dirobj)
            continue
        elif dir == const.SOUTH_NODE:
            subobj = {
                'subDirect': const.SOUTH_NODE,
                'date': parts[0]
            }
            dirobj['subDirect'].append(subobj)
            deltaday = PlanetRulerTime[const.SOUTH_NODE] * 365.2421904
            jd = date.jd + deltaday
            date = Datetime.fromJD(jd, zone)

            res.append(dirobj)
            continue

        j = SubDirectIndex[dir]
        avg = PlanetRulerTime[dir] / SubDirectLen
        deltaday = avg * 365.2421904
        k = 0
        while k < SubDirectLen:
            datestr = date.toCNString()
            parts = datestr.split(' ')
            subobj = {
                'subDirect': SubDirect[j],
                'date': parts[0]
            }
            dirobj['subDirect'].append(subobj)

            jd = date.jd + deltaday
            date = Datetime.fromJD(jd, zone)

            j = (j + 1) % SubDirectLen
            k = k + 1

        res.append(dirobj)
        i = i + 1

    return res



