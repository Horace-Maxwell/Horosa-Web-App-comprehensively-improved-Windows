from flatlib import const
from astrostudy.perchart import PerChart


# [Q-148/T-55] 派生盘宫位口径标记:四类变换盘一律「变换后上升整宫」,前端标注据此说真话。
DERIVED_HOUSE_MODE = 'wholeFromAsc'


class ThirteenthChart:
    def __init__(self, perchart: PerChart):
        self.perchart = perchart
        moon = perchart.chart.getObject(const.MOON)
        sun = perchart.chart.getObject(const.SUN)
        self.ratio = moon.lonspeed / sun.lonspeed


    def fractalObject(self, point):
        sign = point.sign
        signlon = point.signlon
        startidx = const.LIST_SIGNS.index(sign)
        interval = 30 / self.ratio
        room = int(signlon / interval)
        room = room if room < 13 else 12
        newsigidx = (startidx + room) % 12
        newsiglon = (signlon - interval * room) / interval * 30
        newlon = newsigidx * 30 + newsiglon
        point.relocate(newlon)
        return newlon

    def fractal(self):
        for obj in self.perchart.chart.objects:
            self.fractalObject(obj)
        for obj in self.perchart.chart.pars:
            self.fractalObject(obj)

        asc = self.perchart.chart.getAngle(const.ASC)
        mc = self.perchart.chart.getAngle(const.MC)
        desc = self.perchart.chart.getAngle(const.DESC)
        ic = self.perchart.chart.getAngle(const.IC)
        asclon = self.fractalObject(asc)
        mclon = self.fractalObject(mc)
        desclon = (asclon + 180) % 360
        iclon = (mclon + 180) % 360
        desc.relocate(desclon)
        ic.relocate(iclon)

        house1lon = (int(asclon / 30) % 12) * 30

        for obj in self.perchart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = house1lon + 30*(hid - 1)
            obj.size = 30
            obj.relocate(newlon)
            # [Q-148/T-55] 四类变换盘的宫位恒是「变换后 ASC 整宫」,与请求里的分宫制无关;
            # 不打标记时前端只能照 params.hsys 回显用户分宫制 → 标注与数值分叉。
            # 手法同极区回退的 hsysFallback(House.__dict__ 直出前端)。
            obj.hsysDerived = DERIVED_HOUSE_MODE

        self.perchart.reinit()


class DodecatemoriaChart:
    """十二分盘（dodecatemoria / 印占 D12 同口径）：每座分 12 段(每段 2.5°),第 k 段落到**自本座起数**第 k 座,
    段内位置 = (座内度 × 12) mod 30。与 HarmonicChart(12)(自白羊起算 = 12 次谐波)不同:谐波盘丢掉本座,
    11/12 的星座落座全错(T-50)。newlon = ((sign + floor(d/2.5)) mod 12) × 30 + (12·d mod 30)。
    结构与 HarmonicChart 同构(relocate + reinit;房宫按新 ASC 等宫)。"""

    def __init__(self, perchart: PerChart):
        self.perchart = perchart

    @staticmethod
    def dodecatemoriaLon(lon):
        lon = lon % 360
        sign = int(lon // 30)
        d = lon - sign * 30
        part = int(d // 2.5)
        return (((sign + part) % 12) * 30 + ((d * 12) % 30)) % 360

    def dodecatemoriaObject(self, point):
        newlon = self.dodecatemoriaLon(point.lon)
        point.relocate(newlon)
        return newlon

    def apply(self):
        for obj in self.perchart.chart.objects:
            self.dodecatemoriaObject(obj)
        for obj in self.perchart.chart.pars:
            self.dodecatemoriaObject(obj)

        asc = self.perchart.chart.getAngle(const.ASC)
        mc = self.perchart.chart.getAngle(const.MC)
        desc = self.perchart.chart.getAngle(const.DESC)
        ic = self.perchart.chart.getAngle(const.IC)
        asclon = self.dodecatemoriaObject(asc)
        mclon = self.dodecatemoriaObject(mc)
        desc.relocate((asclon + 180) % 360)
        ic.relocate((mclon + 180) % 360)

        house1lon = (int(asclon / 30) % 12) * 30

        for obj in self.perchart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = house1lon + 30*(hid - 1)
            obj.size = 30
            obj.relocate(newlon)
            # [Q-148/T-55] 四类变换盘的宫位恒是「变换后 ASC 整宫」,与请求里的分宫制无关;
            # 不打标记时前端只能照 params.hsys 回显用户分宫制 → 标注与数值分叉。
            # 手法同极区回退的 hsysFallback(House.__dict__ 直出前端)。
            obj.hsysDerived = DERIVED_HOUSE_MODE

        self.perchart.reinit()


class HarmonicChart:
    """调波盘（谐波盘）：将各点黄经乘以调波数后取模 360，房宫按调波后 ASC 等宫排布。

    与 ThirteenthChart 同构（relocate + reinit），仅把每点的变换换成
    newlon = (lon * harmonic) % 360。
    """

    def __init__(self, perchart: PerChart, harmonic: int):
        self.perchart = perchart
        self.harmonic = max(1, min(int(harmonic), 360))

    def harmonicObject(self, point):
        newlon = (point.lon * self.harmonic) % 360
        point.relocate(newlon)
        return newlon

    def apply(self):
        for obj in self.perchart.chart.objects:
            self.harmonicObject(obj)
        for obj in self.perchart.chart.pars:
            self.harmonicObject(obj)

        asc = self.perchart.chart.getAngle(const.ASC)
        mc = self.perchart.chart.getAngle(const.MC)
        desc = self.perchart.chart.getAngle(const.DESC)
        ic = self.perchart.chart.getAngle(const.IC)
        asclon = self.harmonicObject(asc)
        mclon = self.harmonicObject(mc)
        desc.relocate((asclon + 180) % 360)
        ic.relocate((mclon + 180) % 360)

        house1lon = (int(asclon / 30) % 12) * 30

        for obj in self.perchart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = house1lon + 30*(hid - 1)
            obj.size = 30
            obj.relocate(newlon)
            # [Q-148/T-55] 四类变换盘的宫位恒是「变换后 ASC 整宫」,与请求里的分宫制无关;
            # 不打标记时前端只能照 params.hsys 回显用户分宫制 → 标注与数值分叉。
            # 手法同极区回退的 hsysFallback(House.__dict__ 直出前端)。
            obj.hsysDerived = DERIVED_HOUSE_MODE

        self.perchart.reinit()


class DraconicChart:
    """龙盘（黄道交点盘 / Draconic）：以月亮北交点为白羊 0° 起算，各点黄经减去北交点黄经后取模 360。

    与 HarmonicChart 同构（relocate + reinit），仅把每点变换换成
    newlon = (lon - 北交点黄经) % 360。北交点自身落 0° 白羊（定义不变量）。
    """

    def __init__(self, perchart: PerChart):
        self.perchart = perchart
        node = perchart.chart.getObject(const.NORTH_NODE)
        self.nodeLon = node.lon

    def draconicObject(self, point):
        newlon = (point.lon - self.nodeLon) % 360
        point.relocate(newlon)
        return newlon

    def apply(self):
        for obj in self.perchart.chart.objects:
            self.draconicObject(obj)
        for obj in self.perchart.chart.pars:
            self.draconicObject(obj)

        asc = self.perchart.chart.getAngle(const.ASC)
        mc = self.perchart.chart.getAngle(const.MC)
        desc = self.perchart.chart.getAngle(const.DESC)
        ic = self.perchart.chart.getAngle(const.IC)
        asclon = self.draconicObject(asc)
        mclon = self.draconicObject(mc)
        desc.relocate((asclon + 180) % 360)
        ic.relocate((mclon + 180) % 360)

        house1lon = (int(asclon / 30) % 12) * 30

        for obj in self.perchart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = house1lon + 30*(hid - 1)
            obj.size = 30
            obj.relocate(newlon)
            # [Q-148/T-55] 四类变换盘的宫位恒是「变换后 ASC 整宫」,与请求里的分宫制无关;
            # 不打标记时前端只能照 params.hsys 回显用户分宫制 → 标注与数值分叉。
            # 手法同极区回退的 hsysFallback(House.__dict__ 直出前端)。
            obj.hsysDerived = DERIVED_HOUSE_MODE

        self.perchart.reinit()
