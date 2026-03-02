from flatlib import const
from astrostudy.perchart import PerChart

LIST_OBJ = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.NORTH_NODE, const.SOUTH_NODE, const.URANUS, const.NEPTUNE, const.PLUTO,
    const.DARKMOON, const.PURPLE_CLOUDS
]

def takeLon(obj):
    return obj['lon']


class MidPoint:
    def __init__(self, perchart:PerChart):
        self.perchart = perchart
        self.objects = [self.perchart.chart.getObject(id) for id in LIST_OBJ]


    def getAspects(self, obj, mids):
        asps = {}
        asps[obj.id] = []
        for mid in mids:
            asp = {
                'idA': mid['idA'],
                'idB': mid['idB'],
                'aspect': -1
            }
            delta = abs(mid['lon'] - obj.lon)
            if delta < 1:
                asp['aspect'] = 0
                asp['delta'] = delta
            elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                tmpdelta = abs(delta - 90)
                if tmpdelta > 1:
                    tmpdelta = abs(delta - 270)
                asp['aspect'] = 90
                asp['delta'] = tmpdelta
            elif abs(delta - 180) < 1:
                asp['aspect'] = 180
                asp['delta'] = abs(delta - 180)

            if asp['aspect'] > -1:
                asps[obj.id].append(asp)
        return asps

    def getMidpoints(self):
        midsdeg = set()
        mids = []
        objs = []
        for obj in self.objects:
            if not (obj in const.LIST_MIDDLE_POINTS):
                objs.append(obj)

        for objA in objs:
            for objB in objs:
                if objA.id == objB.id:
                    continue
                mid = (objA.lon + objB.lon) / 2.0
                if abs(mid - objA.lon) > 90:
                    mid = (mid + 180) % 360
                if mid in midsdeg:
                    continue
                sigidx = int(mid / 30)
                pnt = {
                    'lon': mid,
                    'signlon': mid % 30,
                    'sign': const.LIST_SIGNS[sigidx],
                    'idA': objA.id,
                    'idB': objB.id
                }
                mids.append(pnt)
                midsdeg.add(mid)
        mids.sort(key=takeLon)
        return mids;


    def calculate(self):
        mids = self.getMidpoints()
        asps = {}
        for obj in self.perchart.chart.angles:
            objasp = self.getAspects(obj, mids)
            if len(objasp[obj.id]) > 0:
                asps[obj.id] = objasp[obj.id]
        for obj in self.perchart.chart.objects:
            objasp = self.getAspects(obj, mids)
            if len(objasp[obj.id]) > 0:
                asps[obj.id] = objasp[obj.id]

        res = {
            'midpoints': mids,
            'aspects': asps
        }
        return res

