"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)


    This module provides useful functions for
    handling profections.

"""

import math
from flatlib import const
from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib.ephem import ephem


def compute(chart, date, asporb, nodeRetrograde=False):
    """ Returns a solararc chart for a given
    date.

    """

    #
    deltadays = (date.jd - chart.date.jd) / 365.2421904
    jddate = chart.date.jd + deltadays
    date = Datetime.fromJD(jddate, chart.date.utcoffset)

    daychart = Chart(date, chart.pos, chart.zodiacal)
    sun = daychart.get(const.SUN)
    orgsun = chart.get(const.SUN)

    rotation = sun.lon - orgsun.lon;

    # Create a copy of the chart and rotate content
    pChart = chart.copy()
    for obj in pChart.objects:
        if nodeRetrograde and (obj.id == const.NORTH_NODE or obj.id == const.SOUTH_NODE):
            obj.relocate(obj.lon - rotation)
        else:
            obj.relocate(obj.lon + rotation)
    for house in pChart.houses:
        house.relocate(house.lon + rotation)
    for angle in pChart.angles:
        angle.relocate(angle.lon + rotation)
    for par in pChart.pars:
        par.relocate(par.lon + rotation)

    natalObjs = [obj for obj in chart.objects]
    natalObjs.extend([obj for obj in chart.angles])

    objs = [obj for obj in pChart.objects]
    objs.extend([obj for obj in pChart.angles])

    orb = 1 if asporb < 0 else asporb
    res = []
    for obj in objs:
        asp = {
            'directId': obj.id,
            'objects': []
        }
        for natobj in natalObjs:
            natasp = {
                'natalId': natobj.id,
                'aspect': -1
            }
            delta = obj.lon - natobj.lon if obj.lon >= natobj.lon else natobj.lon - obj.lon
            if delta < orb:
                natasp['aspect'] = 0
                natasp['delta'] = delta
            elif abs(delta - 45) < orb or abs(delta - 315) < orb:
                tmpdelta = abs(delta - 45)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 315)
                natasp['aspect'] = 45
                natasp['delta'] = tmpdelta
            elif abs(delta - 90) < orb or abs(delta - 270) < orb:
                tmpdelta = abs(delta - 90)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 270)
                natasp['aspect'] = 90
                natasp['delta'] = tmpdelta
            elif abs(delta - 135) < orb or abs(delta - 225) < orb:
                tmpdelta = abs(delta - 135)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 225)
                natasp['aspect'] = 135
                natasp['delta'] = tmpdelta
            elif abs(delta - 180) < orb:
                natasp['aspect'] = 180
                natasp['delta'] = abs(delta - 180)
            if natasp['aspect'] >= 0:
                asp['objects'].append(natasp)
        res.append(asp)

    resobj = {
        'objects': objs,
        'aspects': res,
        'chart': pChart
    }
    return resobj