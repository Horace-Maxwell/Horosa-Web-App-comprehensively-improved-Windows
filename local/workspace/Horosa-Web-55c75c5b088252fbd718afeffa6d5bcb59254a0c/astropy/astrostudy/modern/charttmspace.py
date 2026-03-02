from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper

class ChartTimeSpace:

    def __init__(self, inner, outer):
        self.data = inner.copy()
        dt = helper.getMiddleDate(inner['date'], inner['time'], outer['date'], outer['time'])
        self.data['date'] = dt['date']
        self.data['time'] = dt['time']

        pos = helper.getMiddleSpace(inner['lat'], inner['lon'], outer['lat'], outer['lon'])
        self.data['lat'] = pos['lat']
        self.data['lon'] = pos['lon']

        self.data['predictive'] = False
        self.data['tradition'] = False


    def compute(self):
        perchart = PerChart(self.data)
        return helper.getChartObj(self.data, perchart)