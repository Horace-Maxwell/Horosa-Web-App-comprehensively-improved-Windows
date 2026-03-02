from flatlib import const
from astrostudy.perchart import PerChart

START_INDEX = {}
START_INDEX[const.ARIES] = const.LIST_SIGNS.index(const.ARIES)
START_INDEX[const.TAURUS] = const.LIST_SIGNS.index(const.CAPRICORN)
START_INDEX[const.GEMINI] = const.LIST_SIGNS.index(const.LIBRA)
START_INDEX[const.CANCER] = const.LIST_SIGNS.index(const.CANCER)
START_INDEX[const.LEO] = const.LIST_SIGNS.index(const.ARIES)
START_INDEX[const.VIRGO] = const.LIST_SIGNS.index(const.CAPRICORN)
START_INDEX[const.LIBRA] = const.LIST_SIGNS.index(const.LIBRA)
START_INDEX[const.SCORPIO] = const.LIST_SIGNS.index(const.CANCER)
START_INDEX[const.SAGITTARIUS] = const.LIST_SIGNS.index(const.ARIES)
START_INDEX[const.CAPRICORN] = const.LIST_SIGNS.index(const.CAPRICORN)
START_INDEX[const.AQUARIUS] = const.LIST_SIGNS.index(const.LIBRA)
START_INDEX[const.PISCES] = const.LIST_SIGNS.index(const.CANCER)

class Chart8:
    def __init__(self, perchart:PerChart):
        self.perchart = perchart
        self.ratio = 9


    def fractalObject(self, point):
        sign = point.sign
        signlon = point.signlon
        startidx = START_INDEX[sign]
        interval = 30 / self.ratio
        room = int(signlon / interval)
        room = room if room < 8 else 8
        newsigidx = (startidx + room) % 12
        newsiglon = (signlon - interval * room) / interval * 30
        newlon = newsigidx * 30 + newsiglon
        point.relocate(newlon)
        return newlon

    def fractal(self):
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
        if self.perchart.house == const.HOUSES_VEHLOW_EQUAL:
            house1lon = (asclon - 15 + 360) % 360

        for obj in self.perchart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = (house1lon + 30*(hid - 1)) % 360
            obj.size = 30
            obj.relocate(newlon)

        for obj in self.perchart.chart.objects:
            self.fractalObject(obj)
        for obj in self.perchart.chart.pars:
            self.fractalObject(obj)


        self.perchart.reinit()
