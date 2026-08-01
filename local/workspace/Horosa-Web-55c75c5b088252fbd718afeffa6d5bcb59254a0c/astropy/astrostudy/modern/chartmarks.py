from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper

class ChartMarks:

    def __init__(self, inner, outer):
        middata = inner.copy()
        dt = helper.getMiddleDate(inner['date'], inner['time'], outer['date'], outer['time'],
                                  inner.get('zone'), outer.get('zone'))
        middata['date'] = dt['date']
        middata['time'] = dt['time']

        pos = helper.getMiddleSpace(inner['lat'], inner['lon'], outer['lat'], outer['lon'])
        middata['lat'] = pos['lat']
        middata['lon'] = pos['lon']

        middata['predictive'] = False
        middata['tradition'] = False

        self.innerData = inner.copy()
        self.outerData = outer.copy()
        self.innerData['predictive'] = False
        self.innerData['tradition'] = False
        self.outerData['predictive'] = False
        self.outerData['tradition'] = False

        # middata 时刻按 inner 区口径表达(首次中点回落 zone1=inner),故 zone2 传 inner 区
        dt = helper.getMiddleDate(self.innerData['date'], self.innerData['time'], middata['date'], middata['time'],
                                  self.innerData.get('zone'), self.innerData.get('zone'))
        self.innerData['date'] = dt['date']
        self.innerData['time'] = dt['time']

        pos = helper.getMiddleSpace(self.innerData['lat'], self.innerData['lon'], middata['lat'], middata['lon'])
        self.innerData['lat'] = pos['lat']
        self.innerData['lon'] = pos['lon']

        dt = helper.getMiddleDate(self.outerData['date'], self.outerData['time'], middata['date'], middata['time'],
                                  self.outerData.get('zone'), self.innerData.get('zone'))
        self.outerData['date'] = dt['date']
        self.outerData['time'] = dt['time']

        pos = helper.getMiddleSpace(self.outerData['lat'], self.outerData['lon'], middata['lat'], middata['lon'])
        self.outerData['lat'] = pos['lat']
        self.outerData['lon'] = pos['lon']

    def compute(self):
        innerChart = PerChart(self.innerData)
        outerChart = PerChart(self.outerData)
        obj = {
            'inner': helper.getChartObj(self.innerData, innerChart),
            'outer': helper.getChartObj(self.outerData, outerChart)
        }
        return obj
