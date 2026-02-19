from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper
from astrostudy.germany.midpoint import MidPoint

class ChartComp:

    def __init__(self, inner, outer):
        self.innerData = inner
        self.outerData = outer

    def compute(self):
        innerChart = PerChart(self.innerData)
        outerChart = PerChart(self.outerData)

        innerObjs = [obj for obj in innerChart.chart.objects]
        innerObjs.extend([obj for obj in innerChart.chart.angles])

        outerObjs = [obj for obj in outerChart.chart.objects]
        outerObjs.extend([obj for obj in outerChart.chart.angles])

        res = []
        for obj in outerObjs:
            asp = {
                'id': obj.id,
                'objects': []
            }
            for innerObj in innerObjs:
                natasp = {
                    'id': innerObj.id,
                    'aspect': -1
                }
                delta = obj.lon - innerObj.lon if obj.lon >= innerObj.lon else innerObj.lon - obj.lon
                if delta < 1:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < 1 or abs(delta - 300) < 1:
                    tmpdelta = abs(delta - 60)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 300)
                    natasp['aspect'] = 60
                    natasp['delta'] = tmpdelta
                elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                    tmpdelta = abs(delta - 90)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 270)
                    natasp['aspect'] = 90
                    natasp['delta'] = tmpdelta
                elif abs(delta - 120) < 1 or abs(delta - 240) < 1:
                    tmpdelta = abs(delta - 120)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 240)
                    natasp['aspect'] = 120
                    natasp['delta'] = tmpdelta
                elif abs(delta - 180) < 1:
                    natasp['aspect'] = 180
                    natasp['delta'] = abs(delta - 180)
                if natasp['aspect'] >= 0:
                    asp['objects'].append(natasp)
            res.append(asp)

        inToOutres = []
        for obj in innerObjs:
            asp = {
                'id': obj.id,
                'objects': []
            }
            for outerObj in outerObjs:
                natasp = {
                    'id': outerObj.id,
                    'aspect': -1
                }
                delta = obj.lon - outerObj.lon if obj.lon >= outerObj.lon else outerObj.lon - obj.lon
                if delta < 1:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < 1 or abs(delta - 300) < 1:
                    tmpdelta = abs(delta - 60)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 300)
                    natasp['aspect'] = 60
                    natasp['delta'] = abs(delta - 60)
                elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                    tmpdelta = abs(delta - 90)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 270)
                    natasp['aspect'] = 90
                    natasp['delta'] = tmpdelta
                elif abs(delta - 120) < 1 or abs(delta - 240) < 1:
                    tmpdelta = abs(delta - 120)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 240)
                    natasp['aspect'] = 120
                    natasp['delta'] = tmpdelta
                elif abs(delta - 180) < 1:
                    natasp['aspect'] = 180
                    natasp['delta'] = abs(delta - 180)
                if natasp['aspect'] >= 0:
                    asp['objects'].append(natasp)
            inToOutres.append(asp)

        obj = {
            'inner': helper.getChartObj(self.innerData, innerChart),
            'outer': helper.getChartObj(self.outerData, outerChart),
            'outToInAsp': res,
            'inToOutAsp': inToOutres,
            'inToOutAnti': self.antiAtoB(innerObjs, outerObjs),
            'outToInAnti': self.antiAtoB(outerObjs, innerObjs),
            'inToOutCAnti': self.cantiAtoB(innerObjs, outerObjs),
            'outToInCAnti': self.cantiAtoB(outerObjs, innerObjs),
            'inToOutMidpoint': self.midpointAtoB(innerChart, outerChart),
            'outToInMidpoint': self.midpointAtoB(outerChart, innerChart)
        }
        return obj


    def antiAtoB(self, objsA, objsB):
        res = []
        for objA in objsA:
            for objB in objsB:
                if objA.id == objB.id:
                    continue
                delta = abs(objA.lon - objB.antisciaPoint["lon"])
                if delta < 1:
                    obj = {
                        'idA': objA.id,
                        'idB': objB.id,
                        'delta': delta
                    }
                    res.append(obj)
        return res

    def cantiAtoB(self, objsA, objsB):
        res = []
        for objA in objsA:
            for objB in objsB:
                if objA.id == objB.id:
                    continue
                delta = abs(objA.lon - objB.cantisciaPoint["lon"])
                if delta < 1:
                    obj = {
                        'idA': objA.id,
                        'idB': objB.id,
                        'delta': delta
                    }
                    res.append(obj)
        return res

    def midpointAtoB(self, chartA, chartB):
        midpnt = MidPoint(chartB)
        midpoints = midpnt.getMidpoints()
        objs = [obj for obj in chartA.chart.objects]
        objs.extend([obj for obj in chartA.chart.angles])

        asps = {}
        for obj in objs:
            asps[obj.id] = []
            for mid in midpoints:
                delta = abs(obj.lon - mid['lon'])
                if delta < 1:
                    resmid = {
                        'midpoint': mid,
                        'delta': delta,
                        'aspect': 0
                    }
                    asps[obj.id].append(resmid)
                elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                    tmpdelta = abs(delta - 90)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 270)
                    resmid = {
                        'midpoint': mid,
                        'delta': tmpdelta,
                        'aspect': 90
                    }
                    asps[obj.id].append(resmid)
                elif abs(delta - 180) < 1:
                    resmid = {
                        'midpoint': mid,
                        'delta': abs(delta - 180),
                        'aspect': 180
                    }
                    asps[obj.id].append(resmid)
        return asps
