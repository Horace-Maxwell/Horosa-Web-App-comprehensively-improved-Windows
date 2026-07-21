import os

import flatlib
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const

from astrostudy.helper import distance
from . import jieqiconst

# v3.0.1 perf ROUND-5 (HOROSA_JIEQI_FAST_APPROACH,与 NongLi/YearJieQi 同一开关):
# _ascChart 的瘦 Chart 快路径开关。kill-switch 同 HOROSA_JIEQI_FAST_APPROACH=0。
_JIEQI_FAST_APPROACH = os.environ.get('HOROSA_JIEQI_FAST_APPROACH', '1').lower() not in ('0', 'false', 'no', 'off')


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
            elif int(data.get('ad', 1)) < 0:
                # 显式 ad=-1 + 正年字符串('7040/07/19'):旧逻辑无条件按 AD 算,
                # 节气窗整体错到 AD 侧 → 下游(Java BaZi.setup)窗口不包生辰而崩。
                self.ad = -1
                self.year = '-{0}'.format(self.year)
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

    # v3.0.1 perf ROUND-5(同 HOROSA_JIEQI_FAST_APPROACH 开关): 卯时/上升求解只读 ASC 角,但原实现每次
    # 迭代构建**默认 Chart**(全行星+宫位+阿拉伯点)。宫位/四角由 ephem.getHouses 计算,与 IDs/needpars
    # 完全无关(flatlib chart.py) → 用 needpars=False + IDs=[SUN] 的瘦 Chart,ASC 逐字节相同
    # (实测 1985/1993/2024 三例 identical,单次 compute 125-154ms → 43-50ms)。
    def _ascChart(self, tm):
        if _JIEQI_FAST_APPROACH:
            return Chart(tm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN,
                         IDs=[const.SUN], needpars=False)
        return Chart(tm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)

    def ascApproach(self, dt, sunlon):
        chart = self._ascChart(dt)
        asc = chart.getAngle(const.ASC)
        speed = 1 / (4/60/24)
        delta = distance(sunlon, asc.lon) + 11/60
        deltatm = delta / speed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = self._ascChart(newtm)
            asc = chart.getAngle(const.ASC)
            delta = distance(sunlon, asc.lon) + 11/60
            deltatm = delta / speed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm

    def ascApproachByRA(self, dt, sunra):
        chart = self._ascChart(dt)
        asc = chart.getAngle(const.ASC)
        speed = 1 / (4/60/24)
        delta = distance(sunra, asc.ra) + 11/60
        deltatm = delta / speed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = self._ascChart(newtm)
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
                    if y == 0:
                        # 无公元 0 年:BC1(-1)跨年进到 AD1
                        y = 1
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
        # 包含性自愈:深古/远期年份(如 BC7040)节气初值系统性漂移可致整窗偏到生辰
        # 一侧——下游(四柱交节定位)假设生辰落窗内,窗外即负索引崩。此处以已得窗口
        # 为锚,沿黄经 ±15° 逐节气延伸,直到窗口包住生辰(带上限;正常年零迭代零变)。
        birth_jd = self.dateTime.jd
        guard = 0
        # 下游先定位≤生辰的最后一个节气、逢「气」再退一格到「节」、再 ±2 取交节——最坏向前吃 3 格,两侧各保 ≥4 才绝对无越界。
        while jieqi24 and guard < 30 and sum(1 for q in jieqi24 if q['jdn'] <= birth_jd) < 4:
            first = jieqi24[0]
            pidx = jieqiconst.JieQi.index(first['jieqi'])
            pkey = jieqiconst.JieQi[(pidx - 1) % 24]
            pinfo = jieqiconst.JieQiLon[pkey]
            seed = Datetime.fromJD(first['jdn'] - 15.2, self.zone)
            newtm = self.approach(seed, pinfo['lon'])
            jieqi24.insert(0, {
                'ord': pinfo['ord'], 'jieqi': pkey, 'jie': pinfo['jie'],
                'time': newtm.toCNString(), 'ad': newtm.ad(), 'jdn': newtm.jd,
            })
            guard += 1
        while jieqi24 and guard < 30 and sum(1 for q in jieqi24 if q['jdn'] > birth_jd) < 4:
            last = jieqi24[-1]
            nidx = jieqiconst.JieQi.index(last['jieqi'])
            nkey = jieqiconst.JieQi[(nidx + 1) % 24]
            ninfo = jieqiconst.JieQiLon[nkey]
            seed = Datetime.fromJD(last['jdn'] + 15.2, self.zone)
            newtm = self.approach(seed, ninfo['lon'])
            jieqi24.append({
                'ord': ninfo['ord'], 'jieqi': nkey, 'jie': ninfo['jie'],
                'time': newtm.toCNString(), 'ad': newtm.ad(), 'jdn': newtm.jd,
            })
            guard += 1
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


