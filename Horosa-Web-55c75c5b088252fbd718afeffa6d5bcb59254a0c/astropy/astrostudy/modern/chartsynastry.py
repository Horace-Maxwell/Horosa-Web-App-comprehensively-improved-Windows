from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper

def takeLon(obj):
    return obj.lon


class ChartSynastry:

    def __init__(self, inner, outer):
        self.innerData = inner
        self.outerData = outer

    def compute(self):
        innerChart = PerChart(self.innerData)
        innerChart1 = PerChart(self.innerData)
        outerChart = PerChart(self.outerData)

        for objA in innerChart.chart.objects:
            objB = outerChart.chart.getObject(objA.id)
            objA.relocate(objB.lon)


        for objB in outerChart.chart.objects:
            objA = innerChart1.chart.getObject(objB.id)
            objB.relocate(objA.lon)

            outerChart.chart.otherAngles = innerChart.chart.angles.copy()

        innerChart.reinit()
        outerChart.reinit()

        orgInnerAngles = [obj.copy() for obj in innerChart.chart.angles]
        orgOuterAngles = [obj.copy() for obj in outerChart.chart.angles]

        for ang in innerChart.chart.angles:
            ang2 = outerChart.chart.getAngle(ang.id)
            ang.relocate(ang2.lon)
        for ang in outerChart.chart.angles:
            ang2 = innerChart1.chart.getAngle(ang.id)
            ang.relocate(ang2.lon)

        obj = {
            'inner': helper.getChartObj(self.innerData, innerChart),
            'outer': helper.getChartObj(self.outerData, outerChart)
        }
        obj['inner']['orgAngles'] = orgInnerAngles
        obj['outer']['orgAngles'] = orgOuterAngles
        obj['inner']['orgAngles'].sort(key=takeLon)
        obj['outer']['orgAngles'].sort(key=takeLon)

        return obj