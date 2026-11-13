"""PerChart 的宫位一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from multiprocessing.dummy import Pool as ThreadPool
from flatlib import const
from flatlib import utils
from flatlib.ephem import swe as _swe
from astrostudy.perchart_parts.chart_tables import custHouse_Equal_MC_Middle, custHouse_Fortuna_Whole


class HousesMixin:
    """宫位:自定义宫制(福点整宫制)/ 南半球盘换算 / 赤经落宫 / 地平上下。"""

    def _cuspEquatorial(self, lon, lat=0.0):
        """宫头赤经赤纬:按本日真黄赤交角,恒星盘先加回岁差(与 flatlib sweHouses 同一换算)。
        南半球盘翻转之后,盘上黄经比天上的位置多 180°(只换了星座标签),先转回去再换 —— 赤经赤纬、地平上下是天上的事实,
        不随标签变;各点自带的 ra / decl 本来也没跟着翻。"""
        if getattr(self.chart, 'halfTurned', False):
            lon = (lon + 180.0) % 360.0
        jd = self.chart.date.jd
        with self.chart._siderealContext():
            offset = _swe.tropicalOffset(jd, getattr(self.chart, 'flags', 0))
        return _swe.eclipticToEquatorial(lon, lat or 0.0, _swe.trueObliquity(jd), offset)

    def custHouse(self):
        if self.houseCust == None:
            return

        if self.houseCust == custHouse_Equal_MC_Middle:
            mc = self.chart.getAngle(const.MC)
            startlon = (mc.lon - 15 + 360) % 360
            houses_list = [
                const.HOUSE10, const.HOUSE11, const.HOUSE12,
                const.HOUSE1, const.HOUSE2, const.HOUSE3,
                const.HOUSE4, const.HOUSE5, const.HOUSE6,
                const.HOUSE7, const.HOUSE8, const.HOUSE9
            ]
            for obj in houses_list:
                house = self.chart.getHouse(obj)
                house.relocate(startlon)
                house.size = 30
                house.hsys = custHouse_Equal_MC_Middle
                ra, decl = self._cuspEquatorial(house.lon, house.lat)
                house.ra = ra
                house.decl = decl
                startlon = (startlon + 30) % 360

        if self.houseCust == custHouse_Fortuna_Whole:
            self._placeFortunaWholeHouses()

    def _placeFortunaWholeHouses(self):
        """福点整宫制:以福点所在整座起第 1 宫。构造期(custHouse)按初算福点先定一次;
        setupPlanets 里站心月(_applyTopoMoon)/希腊点变体(_applyLotVariants)重定位福点后再定一次 —— 此前只在构造期
        定宫,夜盘关反转 / 选变体 / 开站心月且福点贴座界时第 1 宫 ≠ 盘上福点所在座。缺省(无变体无站心月)福点不动 → 两次同座,零回归。"""
        flon = None
        try:
            fortuna = self.chart.getObject(const.PARS_FORTUNA)
            if fortuna is not None and getattr(fortuna, 'lon', None) is not None:
                flon = fortuna.lon
        except Exception:
            flon = None
        if flon is None:
            # 回退：自 ASC + 昼夜光体手算福点（昼: ASC+Moon-Sun / 夜: ASC+Sun-Moon）
            try:
                asc = self.chart.getAngle(const.ASC)
                sun = self.chart.getObject(const.SUN)
                moon = self.chart.getObject(const.MOON)
                if asc is None or sun is None or moon is None:
                    return
                if self._diurnalWithSectBuffer():   # G13 福点回退同走 sect 缓冲(默认 geo 零回归)
                    flon = (asc.lon + moon.lon - sun.lon) % 360
                else:
                    flon = (asc.lon + sun.lon - moon.lon) % 360
            except Exception:
                return
        startlon = (int(flon // 30) * 30) % 360
        houses_list = [
            const.HOUSE1, const.HOUSE2, const.HOUSE3,
            const.HOUSE4, const.HOUSE5, const.HOUSE6,
            const.HOUSE7, const.HOUSE8, const.HOUSE9,
            const.HOUSE10, const.HOUSE11, const.HOUSE12
        ]
        for obj in houses_list:
            house = self.chart.getHouse(obj)
            house.relocate(startlon)
            house.size = 30
            # 用 WHOLE_SIGN 让 inHouse 走整宫分支(无 -5° 偏移)→ 落宫判定正确;
            # 「福点整宫制」标签由盘级 hsys 参数(24)驱动,不靠逐宫 house.hsys。
            house.hsys = const.HOUSES_WHOLE_SIGN
            ra, decl = self._cuspEquatorial(house.lon, house.lat)
            house.ra = ra
            house.decl = decl
            startlon = (startlon + 30) % 360

    def relocateSouthChart(self, obj):
        lon = (obj.lon + 180) % 360
        obj.relocate(lon)

    def relocateSouthObjects(self, objs):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        pool = ThreadPool(8)
        results = pool.map(self.relocateSouthChart, objs)
        pool.close()
        pool.join()

    def setupSouthChart(self):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        # 站心月先算、再随各点一起翻转:本盘的翻转在首次 reinit 之前,留给 reinit 去算的话,
        # 月亮会被盖回未翻转的位置、希腊点按「翻转过的日与上升 + 未翻转的月」重投。不开站心月时这一步不动任何点。
        self._applyTopoMoon()
        self.relocateSouthObjects(self.chart.houses)
        self.relocateSouthObjects(self.chart.angles)
        self.relocateSouthObjects(self.chart.objects)
        self.relocateSouthObjects(self.chart.pars)
        # 自此盘上黄经 = 天上位置 + 180°;按黄经换赤道坐标的判定(昼夜 / 地平上下 / 福点整宫宫头)据此转回
        self.chart.halfTurned = True

        self.reinit()

    def _houseByRa(self, ra):
        """[WP-6] 赤经落宫:12 宫头按 ra 排序成区间(环绕),返回 ra 命中的宫 id;数据缺返 None。"""
        try:
            if ra is None:
                return None
            hs = [(float(h.ra), h.id) for h in self.chart.houses if getattr(h, 'ra', None) is not None]
            if len(hs) != 12:
                return None
            hs.sort()
            r = float(ra) % 360.0
            for i in range(12):
                lo = hs[i][0]
                hi = hs[(i + 1) % 12][0]
                if lo <= hi:
                    if lo <= r < hi:
                        return hs[i][1]
                else:   # 环绕段
                    if r >= lo or r < hi:
                        return hs[i][1]
            return hs[-1][1]
        except Exception:
            return None

    def isAboveHorizon(self, planet):
        mc = self.chart.getAngle(const.MC)

        # Get ecliptical positions and check if the
        # planet is above the horizon.
        lat = self.chart.pos.lat
        # 按盘上「此刻」的黄经黄纬判(组合盘等搬点盘随之变):星与天顶同一换算 —— 本日真黄赤交角、恒星盘先加回岁差。
        # 不用星体自带的 ra:J2000 / B1950 类岁差下它在历元赤道系,与当日天顶赤经不同系。
        # 十三分 / 调波 / 龙盘等派生盘在 reinit_derived 里改按本命真高度判(地平上下取本命)。
        ra, decl = self._cuspEquatorial(planet.lon, getattr(planet, 'lat', 0.0) or 0.0)
        mcRA = self._cuspEquatorial(mc.lon, 0.0)[0]
        return utils.isAboveHorizon(ra, decl, mcRA, lat)
