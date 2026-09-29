import os
from flatlib import angle
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib.ephem import swe
from astrostudy.helper import getChartObj

from astrostudy.helper import distance
from . import jieqiconst

# v3.0.1 perf ROUND-3 R1 (HOROSA_JIEQI_FAST_APPROACH): approach() converges on the JD when the Sun reaches
# a target longitude. The original loop rebuilt a full flatlib Chart per iteration only to read Sun.lon and
# Sun.lonspeed — a Chart constructs ~100 swe.calc_ut calls (LIST_OBJECTS_TRADITIONAL + houses + arabic parts).
# 24 terms × ~3-5 iterations = 7,200-12,000 wasted swe calls per /jieqi/year. Direct swe.sweObject(SUN, jd,
# SEDEFAULT_FLAG) returns the same {lon, lonspeed} (chart.py:76 sets the same flag for TROPICAL, which is
# what the original passed to Chart(...)). Convergence judgement, delta formula, and Datetime.fromJD chain
# unchanged → result byte-identical to the Chart-based path.
_JIEQI_FAST_APPROACH = os.environ.get('HOROSA_JIEQI_FAST_APPROACH', '1').lower() not in ('0', 'false', 'no', 'off')
_JIEQI_FAST_APPROACH_LOGGED = False

def _logJieqiFastApproach():
    global _JIEQI_FAST_APPROACH_LOGGED
    if not _JIEQI_FAST_APPROACH_LOGGED:
        _JIEQI_FAST_APPROACH_LOGGED = True
        try:
            import logging
            logging.getLogger(__name__).debug('[jieqi.fastApproach] used (HOROSA_JIEQI_FAST_APPROACH on)')
        except Exception:
            pass

def takeTime(obj):
    return obj['jdn']

class YearJieQi:

    def __init__(self, data):
        self.year = data['year']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']
        self.pos = GeoPos(self.lat, self.lon)
        self.ad = -1 if int(self.year) < 0 else 1

        if 'jieqis' in data.keys():
            jieqis = data['jieqis']
            if isinstance(jieqis, (list, tuple, set)):
                self.jieqis = set(jieqis)
            elif isinstance(jieqis, str):
                self.jieqis = set([jieqis]) if jieqis != '' else set()
            else:
                self.jieqis = set()
        else:
            self.jieqis = set()

        if 'seedOnly' in data.keys():
            raw = data['seedOnly']
            if isinstance(raw, str):
                self.seedOnly = raw.lower() in ('1', 'true', 'yes', 'on')
            else:
                self.seedOnly = bool(raw)
        else:
            self.seedOnly = False

        if 'hsys' in data.keys():
            self.hsys = data['hsys']
        else:
            self.hsys = 0

        if 'zodiacal' in data.keys():
            self.zodiacal = data['zodiacal']
        else:
            self.zodiacal = 0

        if 'doubingSu28' in data.keys():
            self.doubingSu28 = data['doubingSu28']
        else:
            self.doubingSu28 = 0

        self.params = {}
        self.params['zone'] = self.zone
        self.params['lat'] = self.lat
        self.params['lon'] = self.lon
        self.params['hsys'] = self.hsys
        self.params['zodiacal'] = self.zodiacal
        self.params['doubingSu28'] = self.doubingSu28
        self.params['predictive'] = False

    def compute(self):
        if self.seedOnly:
            return {
                'jieqi24': self.computeJieQi(False),
                'charts': {}
            }
        return self.computeJieQi(True)

    def filterJieqi24(self, jieqi24):
        if jieqi24 is None or len(jieqi24) < 24:
            return jieqi24
        res = []
        if jieqi24[23]['jieqi'] == '小寒':
            res.append(jieqi24[23])
            for i in range(0, 23):
                res.append(jieqi24[i])
        else:
            return jieqi24
        return res

    # 求解目标 = 节气黄经本身(此前目标再多加 1/7200 度,交节时刻系统性晚约 12 秒,交节后 12 秒内出生的月柱与本地引擎不同)。
    def approach(self, dt, jieqiLon):
        if _JIEQI_FAST_APPROACH:
            _logJieqiFastApproach()
            sun = swe.sweObject(const.SUN, dt.jd, swe.SEDEFAULT_FLAG)
            delta = distance(jieqiLon, sun['lon'])
            deltatm = delta / sun['lonspeed']
            newjd = dt.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
            while abs(delta) > 0.0003:
                sun = swe.sweObject(const.SUN, newtm.jd, swe.SEDEFAULT_FLAG)
                delta = distance(jieqiLon, sun['lon'])
                deltatm = delta / sun['lonspeed']
                newjd = newtm.jd + deltatm
                newtm = Datetime.fromJD(newjd, self.zone)
            return newtm
        # kill-switch fallback (HOROSA_JIEQI_FAST_APPROACH=0): original Chart-based loop
        chart = Chart(dt, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
        sun = chart.getObject(const.SUN)
        delta = distance(jieqiLon, sun.lon)
        deltatm = delta / sun.lonspeed
        newjd = dt.jd + deltatm
        newtm = Datetime.fromJD(newjd, self.zone)
        while abs(delta) > 0.0003:
            chart = Chart(newtm, self.pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)
            sun = chart.getObject(const.SUN)
            delta = distance(jieqiLon, sun.lon)
            deltatm = delta / sun.lonspeed
            newjd = newtm.jd + deltatm
            newtm = Datetime.fromJD(newjd, self.zone)
        return newtm

    def computeJieQi(self, needChart):
        jieqicharts = {}
        jieqi24 = []
        tmpjieqi24 = {} if needChart and len(self.jieqis) > 0 else None
        res = {}

        terms = list(jieqiconst.JieQiLon.keys())
        if len(self.jieqis) > 0:
            terms = [key for key in terms if key in self.jieqis]

        for key in terms:
            jieqi = jieqiconst.JieQiLon[key]
            date = '{0}/{1}'.format(self.year, jieqi['start'])
            dateTime = Datetime(date, '00:00', self.zone)
            newtm = self.approach(dateTime, jieqi['lon'])

            dtstr = jieqiconst.cnTimeRounded(newtm)
            obj = {
                'ord': jieqi['ord'],
                'jieqi': key,
                'jie': jieqi['jie'],
                'time': dtstr,
                'tm': newtm,
                'jdn': newtm.jd,
                'ad': newtm.ad()
            }
            jieqi24.append(obj)

            if tmpjieqi24 is not None:
                parts = dtstr.split(' ')
                tmpjieqi24[key] = {
                    'date': parts[0],
                    'time': parts[1]
                }

        jieqi24.sort(key=takeTime)
        jieqi24 = self.filterJieqi24(jieqi24)
        if self.pos.lat < 0:
            for jq in jieqi24:
                jqname = jq['jieqi']
                jq['jieqi'] = jieqiconst.SouthEarthJieQi[jqname]

        if needChart == True:
            res['jieqi24'] = jieqi24

            if tmpjieqi24 is not None:
                for key in self.jieqis:
                    if key in tmpjieqi24.keys():
                        self.params['date'] = tmpjieqi24[key]['date']
                        self.params['time'] = tmpjieqi24[key]['time']
                        self.params['name'] = key
                        from astrostudy.perchart import PerChart
                        perchart = PerChart(self.params)
                        jieqicharts[key] = getChartObj(self.params, perchart)

            res['charts'] = jieqicharts
            return res
        else:
            return jieqi24

    def computeOneJieQi(self, jieqi):
        date = '{0}/{1}'.format(self.year, jieqi['start'])
        dateTime = Datetime(date, '00:00', self.zone)
        newtm = self.approach(dateTime, jieqi['lon'])

        dtstr = jieqiconst.cnTimeRounded(newtm)
        parts = dtstr.split(' ')

        obj = {
            'ord': jieqi['ord'],
            'time': dtstr,
            'date': parts[0],
            'tm': newtm,
            'jdn': newtm.jd,
            'jie': jieqi['jie'],
            'ad': newtm.ad()
        }

        return obj

    def computeOneJieQiByName(self, jieqi):
        jq = jieqiconst.JieQiLon[jieqi]
        return self.computeOneJieQi(jq)
