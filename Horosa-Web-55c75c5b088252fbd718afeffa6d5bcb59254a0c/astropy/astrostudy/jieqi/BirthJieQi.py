import flatlib
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const

from astrostudy.helper import distance
from . import jieqiconst


def takeTime(obj):
    return obj['jdn']


class BirthJieQi:

    def __init__(self, data):
        date = data['date']
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']
        self.pos = GeoPos(self.lat, self.lon)

        self.ad = 1
        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 3:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]
            if int(self.year) < 0:
                self.ad = -1
        else:
            self.ad = -1
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]

        parts = self.time.split(':')
        self.hour = parts[0]
        self.minute = parts[1]
        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)
        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.useLocalMao = 0;
        if 'useLocalMao' in data.keys():
            if data['useLocalMao'] == 1:
                self.useLocalMao = 1
        self.byLon = 0
        if 'byLon' in data.keys():
            if data['byLon'] == 1:
                self.byLon = 1

    def approach(self, dt, jieqiLon):
        chart = Chart(dt, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        sun = chart.getObject(const.SUN)
        delta = distance(jieqiLon, sun.lon) + 1/7200
        deltatm = delta / sun.lonspeed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = Chart(newtm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
            sun = chart.getObject(const.SUN)
            delta = distance(jieqiLon, sun.lon) + 1/7200
            deltatm = delta / sun.lonspeed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm

    def ascApproach(self, dt, sunlon):
        chart = Chart(dt, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        asc = chart.getAngle(const.ASC)
        speed = 1 / (4/60/24)
        delta = distance(sunlon, asc.lon) + 11/60
        deltatm = delta / speed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = Chart(newtm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
            asc = chart.getAngle(const.ASC)
            delta = distance(sunlon, asc.lon) + 11/60
            deltatm = delta / speed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm

    def ascApproachByRA(self, dt, sunra):
        chart = Chart(dt, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        asc = chart.getAngle(const.ASC)
        speed = 1 / (4/60/24)
        delta = distance(sunra, asc.ra) + 11/60
        deltatm = delta / speed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = Chart(newtm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
            asc = chart.getAngle(const.ASC)
            delta = distance(sunra, asc.ra) + 11/60
            deltatm = delta / speed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm


    def computeTimeZiByRA(self, chart):
        maoTm = chart.date
        sun = chart.getObject(const.SUN)
        sunra = sun.ra
        newtm = self.ascApproachByRA(maoTm, sunra)
        maostr = newtm.toCNString()
        parts = maostr.split(' ')
        self.mao = parts[1]

    def computeTimeZiByLon(self, chart):
        maoTm = chart.date
        sun = chart.getObject(const.SUN)
        sunlon = sun.lon
        newtm = self.ascApproach(maoTm, sunlon)
        maostr = newtm.toCNString()
        parts = maostr.split(' ')
        self.mao = parts[1]


    def jdToSecond(self, jd):
        tm = Datetime.fromJD(jd, self.zone)
        list = tm.getLocalGregoDate()
        day = int(abs(jd))
        sig = 1 if jd > 0 else -1
        sec = (list[5] + list[4]*60 + list[3]*3600 + day*24*3600)*sig
        return int(round(sec))

    def computeTimeZi(self, chart):
        if self.byLon == 1:
            self.computeTimeZiByLon(chart)
        else:
            self.computeTimeZiByRA(chart)

        tm = Datetime('{0}/{1}/{2}'.format(self.year, self.month, self.day), '05:00', self.zone)
        maotm = Datetime('{0}/{1}/{2}'.format(self.year, self.month, self.day), self.mao, self.zone)
        self.timeOffsetJDN = tm.jd - maotm.jd
        self.timeOffset = self.jdToSecond(self.timeOffsetJDN)

    def computeSpring(self):
        jieqistr = jieqiconst.JieQi[0]
        jieqi = jieqiconst.JieQiLon[jieqistr]
        date = '{0}/{1}'.format(self.year, jieqi['start'])
        dateTime = Datetime(date, '00:00', self.zone)
        newtm = self.approach(dateTime, jieqi['lon'])
        dtstr = newtm.toCNString()
        parts = dtstr.split(' ')
        time = "06:00"
        dateTime = Datetime(parts[0], time, self.zone)
        chart = Chart(dateTime, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        self.computeTimeZi(chart)

    def computeLocal(self):
        date = self.date
        time = "06:00"
        dateTime = Datetime(date, time, self.zone)
        chart = Chart(dateTime, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        self.computeTimeZi(chart)

    def calcChart(self):
        ids = [const.SUN, const.MOON, const.JUPITER]
        chart = Chart(self.dateTime, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN, needpars=False, IDs=ids)
        return chart

    def compute(self):
        jieqi24 = []
        res = {}
        jqs = jieqiconst.MonthToJieQi[self.month]
        idx = jieqiconst.JieQi.index(jqs[0])
        fromIdx = (idx - 2 + 24) % 24
        toIndx = (idx + 6) % 24
        if toIndx < fromIdx:
            toIndx = toIndx + 24

        year = int(self.year)
        prevyear = year - 1
        if prevyear == 0:
            prevyear = -1

        month = int(self.month)
        y = year
        lastm = month
        noaddyear = True
        hasaddyear = False
        for i in range(fromIdx, toIndx):
            key = jieqiconst.JieQi[i % 24]
            jieqi = jieqiconst.JieQiLon[key]
            parts = jieqi['start'].split('/')
            m = int(parts[0])
            if (month == 12 and m == 1) or (lastm == 12 and m == 1):
                if noaddyear:
                    y = y + 1
                    noaddyear = False
                    hasaddyear = True
            if month == 1 and m == 12:
                y = prevyear

            date = '{0}/{1}'.format(str(y), jieqi['start'])
            dateTime = Datetime(date, '00:00', self.zone)
            newtm = self.approach(dateTime, jieqi['lon'])

            timestr = newtm.toCNString()
            tparts = timestr.split('-')
            if tparts[0] == '':
                sz = len(tparts)
                tparts = tparts[1:sz]
                tparts[0] = '-' + tparts[0]
            if not hasaddyear:
                y = int(tparts[0])
                lastm = int(tparts[1])

            obj = {
                'ord': jieqi['ord'],
                'jieqi': key,
                'jie': jieqi['jie'],
                'time': timestr,
                'ad': newtm.ad(),
                'jdn': newtm.jd
            }
            jieqi24.append(obj)

        jieqi24.sort(key=takeTime)
        res['jieqi'] = self.adjustJieqi(jieqi24)

        if self.useLocalMao == 1:
            self.computeLocal()
        else:
            self.computeSpring()

        chart = self.calcChart()
        sun = chart.getObject(const.SUN)
        moon = chart.getObject(const.MOON)
        jupiter = chart.getObject(const.JUPITER)
        planets = [sun, moon, jupiter]
        if self.pos.lat < 0:
            for obj in planets:
                lon = (obj.lon + 180) % 360
                obj.relocate(lon)
        res[const.SUN] = sun
        res[const.MOON] = moon
        res[const.JUPITER] = jupiter

        res['timeOffset'] = self.timeOffset
        res['timeOffsetJDN'] = self.timeOffsetJDN
        res['birthJDN'] = self.dateTime.jd
        res['mao'] = self.mao

        return res

    def adjustJieqi(self, jieqi24):
        res = []
        idx = 0
        for i in range(0, len(jieqi24)):
            jieqi = jieqi24[i]
            res.append(jieqi)

        if self.pos.lat < 0:
            for jq in res:
                jqname = jq['jieqi']
                jq['jieqi'] = jieqiconst.SouthEarthJieQi[jqname]

        return res


