from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib import utils
from flatlib import angle
from astrostudy.helper import distance
from astrostudy.helper import convertLonToStr
from astrostudy.helper import convertLatToStr

ACG_LIST_OBJECTS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE, const.CHIRON,
    const.SOUTH_NODE, const.DARKMOON, const.PURPLE_CLOUDS
]

ACG_LIST_OBJECTS_NOCHIRON = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE,
    const.SOUTH_NODE, const.DARKMOON, const.PURPLE_CLOUDS
]

eps = 0.0003

class ACGraph:
    def __init__(self, data):
        date = data['date']
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']

        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 4:
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]
        else:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]

        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)
        if 'ad' in data.keys():
            if int(data['ad']) == 1:
                pass
            else:
                if self.date[0:1] != '-':
                    self.date = '-{0}'.format(self.date)
                    self.year = '-{0}'.format(self.year)

        self.zodiacal = const.TROPICAL
        self.house = const.HOUSES_WHOLE_SIGN

        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.pos = GeoPos(self.lat, self.lon)

        self.objlists = ACG_LIST_OBJECTS
        jd = self.dateTime.jd
        if jd > 3419437.5 or jd < 1967601.5:
            self.objlists = ACG_LIST_OBJECTS_NOCHIRON

        self.chart = Chart(self.dateTime, self.pos, self.zodiacal, hsys=self.house, IDs=self.objlists, needpars=False)

    def createChart(self, lat, lon, planetid):
        pos = GeoPos(lat, lon)
        ids = [planetid]
        return Chart(self.dateTime, pos, self.zodiacal, hsys=self.house, IDs=ids, needpars=False)

    def getNewPos(self, chartobj, angid, planetid):
        chart = chartobj
        angobj = chart.get(angid)
        planetobj = chart.get(planetid)
        ang = angobj.lon
        planet = planetobj.lon
        delta = distance(ang, planet)
        absdel = abs(delta)
        lastlon = chart.pos.lon
        lastdelta = absdel

        while absdel > eps:
            rat = 1 if absdel >= 10 else 2
            deltara = delta / rat
            lon = chart.pos.lon - deltara
            if abs(lon) > 180:
                if lon < 0:
                    lon = 360 + lon
                else:
                    lon = lon - 360

            chart = self.createChart(chart.pos.lat, lon, planetid)
            angobj = chart.get(angid)
            planetobj = chart.get(planetid)
            ang = angobj.lon
            planet = planetobj.lon
            delta = distance(ang, planet)
            absdel = abs(delta)
            if absdel >= lastdelta:
                break
            lastlon = lon
            lastdelta = absdel

        res = {
            'pos': {
                'lat': chart.pos.lat,
                'lon': lastlon
            },
            'delta': absdel,
        }
        return res

    def computeMc(self, obj, angleid):
        res = []
        chart = self.chart
        respos = self.getNewPos(chart, angleid, obj.id)
        pos = respos['pos']
        if respos['delta'] > eps:
            return res
        res.append(pos)
        return res


    def computeAsc(self, obj, angleid):
        res = []
        chart = self.chart
        respos = self.getNewPos(chart, angleid, obj.id)
        pos = respos['pos']
        if respos['delta'] > eps:
            return res
        res.append(pos)

        step = 3
        lat = 0
        maxlat = 90
        while lat < maxlat:
            tmpchart = self.createChart(lat, pos['lon'], obj.id)
            respos = self.getNewPos(tmpchart, angleid, obj.id)
            pos = respos['pos']
            if respos['delta'] > eps:
                break
            res.append(pos)
            lat = lat + step

        return res

    def compute(self):
        res = {}
        ids = self.objlists
        for id in ids:
            lines = {}
            obj = self.chart.getObject(id)
            lines['asc'] = self.computeAsc(obj, const.ASC)
            lines['desc'] = self.computeAsc(obj, const.DESC)
            lines['mc'] = self.computeMc(obj, const.MC)
            lines['ic'] = self.computeMc(obj, const.IC)

            res[obj.id] = lines

        return res
