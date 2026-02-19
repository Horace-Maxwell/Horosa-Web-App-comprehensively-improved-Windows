from flatlib import const
from astrostudy.perchart import PerChart


class Chart10:
    def __init__(self, perchart:PerChart):
        self.perchart = perchart
        self.ratio = 10


    def fractalObject(self, point):
        sign = point.sign
        signlon = point.signlon
        interval = 30 / self.ratio
        room = int(signlon / interval)
        room = room if room < 9 else 9
        sigidx = const.LIST_SIGNS.index(sign)
        newsigidx = sigidx
        if sigidx % 2 == 0:
            newsigidx = (sigidx + room) % 12
        else:
            newsigidx = (sigidx + room + 8) % 12

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
