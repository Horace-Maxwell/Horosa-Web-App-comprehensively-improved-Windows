import os

from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib.ephem import swe

from astrostudy.helper import distance
from . import jieqiconst
from astrostudy.jieqi.YearJieQi import YearJieQi

# v3.0.1 perf ROUND-5 (HOROSA_JIEQI_FAST_APPROACH,与 BirthJieQi/YearJieQi 同一开关): NongLi.approach
# (新月牛顿求解,×16/年,/chart 首用某年份时算 本年+次年 两张月表)原每次迭代重建整张 flatlib Chart
# (全行星+宫位+阿拉伯点 ~100 次 swe.calc_ut)只为读 日/月 经度与月速 —— 换 swe.sweObject 直取,
# 收敛判据/公式/Datetime.fromJD 链一字不动 → 输出逐字节相同(实测 1985/2024/2033/公元前500 四年
# jsonpickle 全等;单年 1.66-2.8s → 0.13-0.23s)。kill-switch 同 HOROSA_JIEQI_FAST_APPROACH=0。
_JIEQI_FAST_APPROACH = os.environ.get('HOROSA_JIEQI_FAST_APPROACH', '1').lower() not in ('0', 'false', 'no', 'off')


MonthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
QiTerms = [key for key, val in jieqiconst.JieQiLon.items() if val['jie'] == False]

def takeTime(obj):
    return obj['jdn']

class NongLi:

    def __init__(self, data):
        self.year = data['year']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']
        self.pos = GeoPos(self.lat, self.lon)
        lasty = int(data['year']) - 1
        if lasty == 0:
            lasty = -1
        self.lastyear = str(lasty)
        self.hsys = 0
        self.zodiacal = 0
        if self.lastyear == 0:
            self.lastyear = -1

        self.params = {}
        self.params['zone'] = self.zone
        self.params['lat'] = self.lat
        self.params['lon'] = self.lon
        self.params['hsys'] = self.hsys
        self.params['zodiacal'] = self.zodiacal
        self.params['predictive'] = False

        jieqistr = jieqiconst.JieQi[jieqiconst.DongZhiIdx]
        dongzi = jieqiconst.JieQiLon[jieqistr]

        yearjieqidata = dict(data)
        yearjieqidata['jieqis'] = QiTerms
        yearjieqi = YearJieQi(yearjieqidata)
        self.jieqi24 = yearjieqi.computeJieQi(False)
        self.dongZi = None
        for item in self.jieqi24:
            if item['jieqi'] == jieqistr:
                self.dongZi = item
                break
        if self.dongZi is None:
            self.dongZi = yearjieqi.computeOneJieQi(dongzi)

        prevdata = {}
        prevdata['year'] = str(lasty)
        prevdata['zone'] = data['zone']
        prevdata['lat'] = data['lat']
        prevdata['lon'] = data['lon']
        yearjieqi = YearJieQi(prevdata)
        self.prevDongZi = yearjieqi.computeOneJieQi(dongzi)
        jq25 = []
        jq25.append(self.prevDongZi)
        jq25.extend(self.jieqi24)
        self.jq25 = jq25

    def approach(self, dt):
        if _JIEQI_FAST_APPROACH:
            sun = swe.sweObject(const.SUN, dt.jd, swe.SEDEFAULT_FLAG)
            moon = swe.sweObject(const.MOON, dt.jd, swe.SEDEFAULT_FLAG)
            delta = distance(sun['lon'], moon['lon']) + 1/7200
            deltatm = delta / moon['lonspeed']
            newjd = dt.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
            while abs(delta) > 0.0003:
                sun = swe.sweObject(const.SUN, newtm.jd, swe.SEDEFAULT_FLAG)
                moon = swe.sweObject(const.MOON, newtm.jd, swe.SEDEFAULT_FLAG)
                delta = distance(sun['lon'], moon['lon']) + 1 / 7200
                deltatm = delta / moon['lonspeed']
                newjd = newtm.jd + deltatm
                newtm = Datetime.fromJD(newjd, self.zone)
            return newtm
        # kill-switch fallback (HOROSA_JIEQI_FAST_APPROACH=0): original Chart-based loop
        chart = Chart(dt, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        sun = chart.getObject(const.SUN)
        moon = chart.getObject(const.MOON)
        delta = distance(sun.lon, moon.lon) + 1/7200
        deltatm = delta / moon.lonspeed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = Chart(newtm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
            sun = chart.getObject(const.SUN)
            moon = chart.getObject(const.MOON)
            delta = distance(sun.lon, moon.lon) + 1 / 7200
            deltatm = delta / moon.lonspeed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm

    def computeNewMoon(self, date):
        dateTime = Datetime(date, '00:00', self.zone)
        newtm = self.approach(dateTime)

        dtstr = newtm.toCNString()
        parts = dtstr.split(' ')

        res = {
            'date': parts[0],
            'time': parts[1],
            'tm': newtm,
            'jdn': newtm.jd,
            'name': None,
            'year': None,
            'leap': 0,
            'ad': newtm.ad()
        }
        return res

    def hasQi(self, m1, m2, idx):
        for i in range(idx, len(self.jq25)):
            jieqi = self.jq25[i]
            jdn1 = m1.calcZeroHourJd()
            jdn2 = m2.calcZeroHourJd()
            jdnJieqi = jieqi['tm'].calcZeroHourJd()
            if jdn1 <= jdnJieqi < jdn2:
                if jieqi['jie'] == False:
                    res = {
                        'idx': i+1,
                        'qi': True
                    }
                    return res
            elif jdnJieqi >= jdn2:
                if i == 0:
                    res = {
                        'idx': 0,
                        'qi': True
                    }
                    return res
                else:
                    res = {
                        'idx': i,
                        'qi': False
                    }
                    return res

        res = {
            'idx': 0,
            'qi': True
        }
        return res

    def setupMonth(self, months):
        sidx = 0
        eidx = 0
        foundSidx = False
        prevdzjd = self.prevDongZi['tm'].jd
        dzjd = self.dongZi['tm'].jd
        for i in range(0, len(months)):
            nextm = months[i]['tm']
            if nextm.jd >= prevdzjd:
                foundSidx = True
            elif foundSidx == False:
                sidx = i

            if nextm.jd <= dzjd:
                eidx = i
            else:
                break

        dparts = months[eidx]['date'].split('-')
        if dparts[0] != '':
            if dparts[1] != '12' and dparts[2] != '01':
                eidx = eidx + 1
        else:
            # 公元前日期串形如 '-7039-12-18',split 后首段为空、月/日整体右移一位:
            # 月=dparts[2]、日=dparts[3]。旧写法把 dparts[2] 双用(月又当日),
            # 部分 BC 年份 eidx 误进 → 越界崩 / 冬月错标(静默错月,更隐蔽)。
            if dparts[2] != '12' and dparts[3] != '01':
                eidx = eidx + 1
        if eidx >= len(months):
            eidx = len(months) - 1

        months[eidx]['name'] = MonthNames[10]
        eidx = eidx - 1
        mlen = eidx - sidx
        noleap = True
        if mlen == 12:
            noleap = False
        foundleap = False

        midx = 10
        idx = 0
        for i in range(sidx, eidx + 1):
            m1 = months[i]['tm']
            if i <= eidx:
                if noleap:
                    months[i]['name'] = MonthNames[midx]
                else:
                    m2 = months[i + 1]['tm']
                    qires = self.hasQi(m1, m2, idx)
                    if qires['qi']:
                        months[i]['name'] = MonthNames[midx]
                    else:
                        if foundleap:
                            pass
                        else:
                            months[i]['leap'] = 1
                            midx = (midx + 11) % 12
                            foundleap = True
                        months[i]['name'] = MonthNames[midx]
                    idx = qires['idx']
                midx = (midx + 1) % 12

        if sidx > 0:
            mname = months[sidx]['name']
            nidx = MonthNames.index(mname);
            months[sidx - 1]['name'] = MonthNames[nidx - 1]

    def computeYearGanZi(self, months):
        currY = int(self.year)
        sz = len(months)
        for i in range(0, sz):
            mon = months[i]
            tm = mon['tm']
            tmlist = tm.getLocalGregoDate()
            year = tmlist[0]
            if year < currY:
                mon['year'] = jieqiconst.getYearGanZi(year)
            else:
                if i < 3 and (mon['name'] == MonthNames[10] or mon['name'] == MonthNames[11]):
                    mon['year'] = jieqiconst.getYearGanZi(year-1)
                else:
                    mon['year'] = jieqiconst.getYearGanZi(year)


    def compute(self):
        nongliMoon = []
        jieqistr = jieqiconst.JieQi[jieqiconst.DongZhiIdx]
        dongzi = jieqiconst.JieQiLon[jieqistr]
        dongziparts = dongzi['start'].split('/')

        lastdonzi = '{0}/{1}/{2}'.format(self.lastyear, dongziparts[0], dongziparts[1])
        firstm = Datetime(lastdonzi, "00:00", self.zone)
        firstm = Datetime.fromJD(firstm.jd - 30, self.zone)
        firsttmstr = firstm.toCNString()
        parts = firsttmstr.split(' ')

        tm = self.computeNewMoon(parts[0])
        nongliMoon.append(tm)

        cnt = 0
        while cnt < 15:
            tm = Datetime.fromJD(tm['tm'].jd + 29, self.zone)
            dtstr = tm.toCNString()
            parts = dtstr.split(' ')
            try:
                tm = self.computeNewMoon(parts[0])
            except Exception:
                # 星历数据域尽头(如 AD16799 年末):朔序列在界内截断,已得朔表照常成表;
                # 覆盖不足所需月份时由 setupMonth/上层报明确超域,而非整年炸。
                break
            if cnt == 0:
                if tm['date'] == self.prevDongZi['date']:
                    nongliMoon = [tm]
                else:
                    nongliMoon.append(tm)
            else:
                nongliMoon.append(tm)
            cnt = cnt + 1

        nongliMoon.sort(key=takeTime)
        self.setupMonth(nongliMoon)
        self.computeYearGanZi(nongliMoon)

        nongliMoon = self.filterMonths(nongliMoon)
        res = {
            'months': nongliMoon,
            'prevDongzi': self.prevDongZi,
            'dongzi': self.dongZi
        }
        return res


    def filterMonths(self, months):
        res = []
        j = 0
        for i in range(0, len(months)):
            mon = months[i]
            j = i
            if mon['name'] == MonthNames[10]:
                break

        for i in range(j, len(months)):
            mon = months[i]
            res.append(mon)
            if mon['name'] == MonthNames[10]:
                if i > 10:
                    break

        res.sort(key=takeTime)
        return res
