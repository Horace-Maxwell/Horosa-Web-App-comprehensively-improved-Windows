"""PerChart 的宫位一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from multiprocessing.dummy import Pool as ThreadPool
from flatlib import const
from flatlib import utils
from astrostudy.perchart_parts.chart_tables import custHouse_Equal_MC_Middle, custHouse_Fortuna_Whole


class HousesMixin:
    """宫位:自定义宫制(福点整宫制)/ 南半球盘换算 / 赤经落宫 / 地平上下。"""

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
                ra, decl = utils.eqCoords(house.lon, house.lat)
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
            ra, decl = utils.eqCoords(house.lon, house.lat)
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

        self.relocateSouthObjects(self.chart.houses)
        self.relocateSouthObjects(self.chart.angles)
        self.relocateSouthObjects(self.chart.objects)
        self.relocateSouthObjects(self.chart.pars)

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
        mcRA, mcDecl = utils.eqCoords(mc.lon, 0)
        return utils.isAboveHorizon(planet.ra, planet.decl, mcRA, lat)
