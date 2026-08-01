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


def compute(chart, date, asporb, nodeRetrograde=False, arcSource=const.SUN):
    """ Returns a solararc chart for a given
    date. arcSource 默认太阳(=太阳弧);改为月亮/任意行星 => 行星弧/月亮弧。
    默认 const.SUN 与原行为字节级等价。

    """

    #
    deltadays = (date.jd - chart.date.jd) / 365.2421904
    jddate = chart.date.jd + deltadays
    date = Datetime.fromJD(jddate, chart.date.utcoffset)

    daychart = Chart(date, chart.pos, chart.zodiacal)
    sun = daychart.get(arcSource)
    orgsun = chart.get(arcSource)

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
            # delta 是 |黄经差| ∈ [0,360)。下面每个相位都判了自身与 360 补角(45/315、90/270、
            # 135/225),唯独合相只判了 delta<orb 一侧 → 一星在 0.2°、另一星在 359.5° 时实际
            # 相距 0.9°(是合相),delta=359.3 却落不进任何分支,合相整条丢失。补上 360 侧。
            if delta < orb or delta > 360 - orb:
                natasp['aspect'] = 0
                natasp['delta'] = delta if delta < orb else 360 - delta
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