"""PerChart 的时间一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
import math
from flatlib.datetime import Datetime
from flatlib.chart import Chart
from flatlib import const
from flatlib.ephem import swe
from astrostudy.helper import distance
from astrostudy.jieqi.realsuntime import getOffsetByDate
from astrostudy.perchart_parts.chart_tables import dayerStar, timerStar


class TimingMixin:
    """时间:出生时刻串 / 日主星 / 日出日没 / 时主星。"""

    def getBirthStr(self):
        str = '{0}-{1}-{2} {3}'.format(self.year, self.month, self.day, self.time)
        return str

    def getDayerStar(self):
        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        return daystar

    # v3.0.1 perf ROUND-5:日出求解(最多 50 次迭代建瘦 Chart)同一请求跑 2-3 次('sunRiseTime' 键 +
    # getTimerStar 内 + guolao yumao 模式再一次)。memo 结果 dict;消费者只读 timeStr/datetime.jd,
    # 从不改写(已核)。重复调用逐字节等值已实测。
    def getSunRiseTime(self):
        if self._sunRiseCache is None:
            self._sunRiseCache = self._computeSunRiseTime()
        return self._sunRiseCache

    def _computeSunRiseTime(self):
        dt = Datetime(self.date, "05:00:00", self.zone)
        dist = 99
        speed = 1 / (4 / 60 / 24)
        count = 1
        thredholds = 50
        while abs(dist) > 0.5 and count < thredholds:
            chart = Chart(dt, self.pos, self.zodiacal, hsys=self.house, IDs=[const.SUN], needpars=False)
            asc = chart.getAngle(const.ASC)
            sun = chart.getObject(const.SUN)
            dist = distance(sun.lon, asc.lon) / 2
            deltatm = dist / speed
            newjd = dt.jd + deltatm
            dt = Datetime.fromJD(newjd, self.zone)
            count = count + 1

        if count >= thredholds:
            dt = Datetime(self.date, "05:00:00", self.zone)

        sunT = dt.toCNString()
        parts = sunT.split(' ')
        res = {
            'datetime': dt,
            'timeStr': parts[1]
        }
        return res

    def getSunSetTime(self):
        # 日没:太阳落在下降点(西方地平)。算法同 getSunRiseTime 迭代法,改以 DESC 为目标、起 17:00。
        dt = Datetime(self.date, "17:00:00", self.zone)
        dist = 99
        speed = 1 / (4 / 60 / 24)
        count = 1
        thredholds = 50
        while abs(dist) > 0.5 and count < thredholds:
            chart = Chart(dt, self.pos, self.zodiacal, hsys=self.house, IDs=[const.SUN], needpars=False)
            desc = chart.getAngle(const.DESC)
            sun = chart.getObject(const.SUN)
            dist = distance(sun.lon, desc.lon) / 2
            deltatm = dist / speed
            newjd = dt.jd + deltatm
            dt = Datetime.fromJD(newjd, self.zone)
            count = count + 1

        if count >= thredholds:
            dt = Datetime(self.date, "17:00:00", self.zone)

        sunT = dt.toCNString()
        parts = sunT.split(' ')
        res = {
            'datetime': dt,
            'timeStr': parts[1]
        }
        return res


    def getTimerStar(self):
        # 西洋盘族(非七政请求)的「时主星」改与格局页行星时表同一函数单源
        # (astroextra.compute_planetary_hours:swisseph rise_trans 含折射 + 民用时区子夜起算),
        # 此前两套算法在 sunrise / equal24 档、出生近小时边界或离时区中央经线远时落不同小时(同屏矛盾)。
        # 七政请求(带 doubingSu28 / guolaoLifeMode 标记)或显式带 trueSolarTime(报时星太阳时三档,G6 / Q-199 已审)
        # 保留下方太阳时算法;西洋盘族从不送这三键。
        if isinstance(self.data, dict) and ('doubingSu28' not in self.data) and ('guolaoLifeMode' not in self.data) and ('trueSolarTime' not in self.data):
            try:
                from astrostudy.astroextra import compute_planetary_hours
                hour_mode_w = self.data.get('planetaryHourMethod') or 'sunrise'
                res = compute_planetary_hours({
                    'date': self.date, 'time': self.time, 'zone': self.zone,
                    'lat': self.lat, 'lon': self.lon, 'planetaryHourMethod': hour_mode_w,
                })
                if res and res.get('hours'):
                    cur = [h for h in res['hours'] if h.get('current')]
                    if cur and cur[0].get('ruler'):
                        return cur[0]['ruler']
            except Exception:
                pass   # 极区无升降 / 星历异常 → 回落下方旧算法(表无行时时主星仍有值)
        birth = '{0}-{1}-{2}'.format(self.year, self.month, self.day)
        # G6 报时星太阳时:true=真(经度时差+均时差,默认零回归)/mean=平(仅经度)/off=钟表(不校正)。
        solarMode = self.data.get('trueSolarTime', 'true') if isinstance(self.data, dict) else 'true'
        if solarMode not in ('true', 'mean', 'off'):
            solarMode = 'true'
        tmoffset = getOffsetByDate(birth, self.zone, self.lon, solarMode)
        offsetjdn = tmoffset / 3600.0 / 24.0

        dt = Datetime(self.date, self.time, self.zone)
        jdn = dt.jd + offsetjdn
        bdt = Datetime.fromJD(jdn, self.zone)
        bdtstr = bdt.toCNString()
        bdtparts = bdtstr.split(' ')
        birttm = bdtparts[1]

        # 跨子夜修正:太阳时校正把出生推过子夜时,旧码出生小时回卷(23:50→00:06)而星期与日出不回卷
        #   → 日出法差值多/少一整天(等价 +3 星),真 / 平两档子夜前后算错。
        #   日出法:行星日自「钟表日期」当日日出起,星期取校正前日期;小时数用儒略日差(不回卷,负值=前一行星日尾段,7 星循环同余自洽)。
        #   等长 24 时制:行星日=校正后当地日 0 时起 → 星期随校正后日期(bdt)。
        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        timerIdx = timerStar.index(daystar)
        day_equal24 = bdt.date.dayofweek()
        parts = birttm.split(':')
        h = int(parts[0]) + float(parts[1])/60
        if len(parts) > 2:
            h = h + float(parts[2])/3600

        sunTObj = self.getSunRiseTime()
        sunjdn = sunTObj['datetime'].jd + offsetjdn

        # 行星时制式 planetaryHourMethod(默认 'sunrise'=现状零回归):
        #   'sunrise' = 日出起算·等长 60 分钟小时(本实现历史口径);
        #   'unequal' = 昼夜不等时(传统主流):真日出→真日没 12 等分为昼时,日没→次日出 12 等分为夜时
        #               (界取 swisseph rise_trans 含折射;极昼夜无解回落 sunrise 口径);
        #   'equal24' = 当日 0 时起 24 等分等长时,时主序仍迦勒底降序从当日日主起。
        hour_mode = self.data.get('planetaryHourMethod') if isinstance(self.data, dict) else None
        if hour_mode == 'equal24':
            delta = int(math.floor(h)) % 24
            idx = (timerStar.index(dayerStar[day_equal24]) + delta + 28) % 7
            return timerStar[idx]
        if hour_mode == 'unequal':
            try:
                geopos = (self.chart.pos.lon, self.chart.pos.lat, 0.0)
                jd0 = self.dateTime.jd
                # 取「当日」界:从前一日中午向后找日出/日没,拼出覆盖出生时刻的昼/夜段。
                rr, tr = swe.swisseph.rise_trans(jd0 - 1.5, swe.swisseph.SUN, swe.swisseph.CALC_RISE, geopos)
                rs, ts = swe.swisseph.rise_trans(jd0 - 1.5, swe.swisseph.SUN, swe.swisseph.CALC_SET, geopos)
                if rr == 0 and rs == 0:
                    rises = [tr[0]]
                    sets = [ts[0]]
                    for _ in range(3):
                        rr2, tr2 = swe.swisseph.rise_trans(rises[-1] + 0.2, swe.swisseph.SUN, swe.swisseph.CALC_RISE, geopos)
                        rs2, ts2 = swe.swisseph.rise_trans(sets[-1] + 0.2, swe.swisseph.SUN, swe.swisseph.CALC_SET, geopos)
                        if rr2 != 0 or rs2 != 0:
                            raise ValueError('polar')
                        rises.append(tr2[0])
                        sets.append(ts2[0])
                    # 找覆盖 jd0 的段:最近一次「日出 ≤ jd0」→若其后的日没 > jd0=昼段;否则夜段(日没→下一日出)。
                    last_rise = max([x for x in rises if x <= jd0], default=None)
                    last_set = max([x for x in sets if x <= jd0], default=None)
                    if last_rise is not None and (last_set is None or last_rise > last_set):
                        # 昼段:last_rise → 其后第一个日没
                        next_set = min([x for x in sets if x > last_rise])
                        seg_len = (next_set - last_rise) / 12.0
                        hour_idx = int((jd0 - last_rise) / seg_len)
                        seg_day_jd = last_rise
                        night = False
                    else:
                        next_rise = min([x for x in rises if x > last_set])
                        seg_len = (next_rise - last_set) / 12.0
                        hour_idx = 12 + int((jd0 - last_set) / seg_len)
                        # 夜段归属「日没那天」的行星日(昼起日主)。
                        seg_day_jd = last_set - 0.25
                        night = True
                    _ = night
                    seg_dt = Datetime.fromJD(seg_day_jd + offsetjdn, self.zone)
                    seg_dow = seg_dt.date.dayofweek()
                    seg_daystar = dayerStar[seg_dow]
                    seg_timer_idx = timerStar.index(seg_daystar)
                    return timerStar[(seg_timer_idx + hour_idx + 28) % 7]
            except Exception:
                pass   # 极昼夜/星历异常 → 回落 sunrise 口径

        # 日出后第 N 个小时:floor(经过时长)。原 int(h)-int(sunH) 数的是「跨过几个整点」,
        # 日出 6:50 生于 7:10(仅过 20 分钟)会被错算成第 2 小时;日出前出生 floor 给负数,
        # (timerIdx-2)%7 与「前一日第 22 时」在 7 星循环下同余,口径自洽。
        # 经过时长以儒略日差计(出生与日出同加偏移 → 差值与太阳时档无关,且跨子夜不回卷)。
        delta = int(math.floor((jdn - sunjdn) * 24.0))
        idx = (timerIdx + delta + 28) % 7
        star = timerStar[idx]
        return star
