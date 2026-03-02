from flatlib import const
from astrostudy.perchart import PerChart


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

        self.perchart.reinit()
