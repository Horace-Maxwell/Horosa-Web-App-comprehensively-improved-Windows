"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    

    This module provides useful functions for 
    handling profections.
    
"""

import math
from flatlib import const
from flatlib.ephem import ephem


def compute(chart, date, fixedObjects=False, nodeRetrograde=False):
    """ Returns a profection chart for a given
    date. Receives argument 'fixedObjects' to
    fix chart objects in their natal locations.
    
    """
    
    sun = chart.getObject(const.SUN)
    prevSr = ephem.prevSolarReturn(date, sun.lon, chart.flags)
    nextSr = ephem.nextSolarReturn(date, sun.lon, chart.flags)
    
    # In one year, rotate chart 30º
    # 目标时刻恰为返照点时 prevSr==nextSr(分母为 0,如生日当天整点起小限):
    # 此时年内行度=0(新一年起点),不做除法。
    span = nextSr.jd - prevSr.jd
    rotation = 30 * (date.jd - prevSr.jd) / span if span > 1e-9 else 0.0
    
    # Include 30º for each previous year
    age = math.floor((date.jd - chart.date.jd) / 365.2421904)
    rotation = 30 * age + rotation
    
    # Create a copy of the chart and rotate content
    pChart = chart.copy()
    for obj in pChart.objects:
        if not fixedObjects:
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

    return pChart