from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper

class ChartComposite:

    def __init__(self, inner, outer):
        self.innerData = inner
        self.outerData = outer
        self.innerData['hsys'] = 0
        self.outerData['hsys'] = 0

    def compute(self):
        innerChart = PerChart(self.innerData)
        outerChart = PerChart(self.outerData)

        for objA in innerChart.chart.objects:
            objB = outerChart.chart.getObject(objA.id)
            deg = (objA.lon + objB.lon) / 2
            objA.relocate(deg)

        for objA in innerChart.chart.angles:
            objB = outerChart.chart.getAngle(objA.id)
            deg = (objA.lon + objB.lon) / 2
            objA.relocate(deg)

        asc = innerChart.chart.getAngle(const.ASC)
        desc = innerChart.chart.getAngle(const.DESC)
        mc = innerChart.chart.getAngle(const.MC)
        ic = innerChart.chart.getAngle(const.IC)
        asclon = asc.lon
        mclon = mc.lon
        desclon = (asclon + 180) % 360
        iclon = (mclon + 180) % 360
        desc.relocate(desclon)
        ic.relocate(iclon)

        house1lon = (int(asclon / 30) % 12) * 30

        for obj in innerChart.chart.houses:
            hid = int(obj.id[5:7])
            newlon = house1lon + 30*(hid - 1)
            obj.size = 30
            obj.relocate(newlon)

        innerChart.reinit()
        return helper.getChartObj(self.innerData, innerChart)
