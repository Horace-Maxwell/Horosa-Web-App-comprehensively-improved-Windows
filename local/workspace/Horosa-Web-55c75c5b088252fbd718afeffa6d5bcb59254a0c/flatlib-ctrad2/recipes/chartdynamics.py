"""
    Author: João Ventura <flatangleweb@gmail.com>
    
    
    This recipe shows sample code for handling some 
    of the chart dynamics.

"""
import sys
from flatlib import const
from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.tools.chartdynamics import ChartDynamics

def excludeBad(x):
    return x != 'exile' and x != 'fall'

def isGood(x):
    return x == 'exalt' or x == 'ruler'

# Build a chart for a date and location
date = Datetime('1976/07/06', '21:07', '+08:00')
pos = GeoPos('26n05', '119e18')
chart = Chart(date, pos)

# Build ChartDynamics object
dyn = ChartDynamics(chart)

# Which dignities of Jupiter belong to Sun
dign = dyn.inDignities(const.JUPITER, const.SUN)
print(dign)   # ['dayTrip', 'ruler']

# In which dignities Jupiter receives Mars
dign = dyn.receives(const.JUPITER, const.MARS)
print(dign)   # ['nightTrip']

# Mutual receptions between Sun and Moon
#  - Sun receives the Moon in diurnal triplicity
#  - Moon receives the Sun in the participant triplicity
dign = dyn.mutualReceptions(const.SUN, const.MOON)
print(dign)   # [('dayTrip', 'partTrip')]

# Last separation and next application of 
asps = dyn.immediateAspects(const.SUN, const.MAJOR_ASPECTS)
print(asps)   # (None, {'id': 'Saturn', 'orb': 12.1391, 'asp': 120})

# Void of course
voc = dyn.isVOC(const.MERCURY)
print(voc)    # False
print()

print()
for itemA in const.LIST_SEVEN_PLANETS:
    for itemB in const.LIST_SEVEN_PLANETS:
        if itemA != itemB:
            rec = dyn.reMutualReceptions(itemA, itemB)
            if len(rec) > 0:
                print('%s<->%s, %s' % (itemA, itemB, rec))

print()
for itemA in const.LIST_SEVEN_PLANETS:
    for itemB in const.LIST_SEVEN_PLANETS:
        if itemA != itemB:
            rec = dyn.receives(itemA, itemB)
            if len(rec) > 0:
                filter_ = ['exile', 'fall']
                elelist = []
                for ele in rec:
                    if ele not in filter_:
                        elelist.append(ele)
                if len(elelist) > 1 or 'exalt' in elelist or 'ruler' in elelist:
                    print('%s->%s, %s' % (itemA, itemB, elelist))

print()
print('aspectsByCat')
print()
for itemA in const.LIST_SEVEN_PLANETS:
    res = dyn.aspectsByCat(itemA, const.MAJOR_ASPECTS)
    print('%s: %s' % (itemA, res))
    print()

print('immediateAspects')
print()
for itemA in const.LIST_SEVEN_PLANETS:
    res = dyn.immediateAspects(itemA, const.MAJOR_ASPECTS)
    print('%s: %s' % (itemA, res))
    print()

print()
for itemA in const.LIST_SEVEN_PLANETS:
    for itemB in const.LIST_SEVEN_PLANETS:
        if itemA != itemB:
            orgab = dyn.inDignities(itemA, itemB)
            orgba = dyn.inDignities(itemB, itemA)
            ablist = list(filter(excludeBad, orgab))
            balist = list(filter(excludeBad, orgba))
            abgood = list(filter(isGood, ablist))
            bagood = list(filter(isGood, balist))
            if (len(ablist) > 1 and len(balist) > 1) or (len(abgood) > 0 and len(bagood) > 0):
                print('%s - %s: %s %s' % (itemA, itemB, ablist, balist))
                print()

print()
asc = chart.getAngle(const.ASC)
moon = chart.getObject(const.MOON)
moonanti = moon.antiscia()
print(moon)
print(asc.signlon - moonanti.signlon)

vocmoon = dyn.isVOC(const.MOON)
print('%s voc:%s' % (const.MOON, vocmoon))

print()
stars = chart.getFixedStars()
for star in stars:
    print(star)

zaur = chart.getFixedStar(const.STAR_ZAUR)
print(zaur)
