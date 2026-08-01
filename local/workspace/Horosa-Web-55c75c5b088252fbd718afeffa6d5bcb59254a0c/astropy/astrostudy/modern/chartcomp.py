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
                # 归一化到 [0,180] 最短分离角(同 perpredict.getAspects 修正):
                # 跨 0° 合相不再漏报,且不再依赖 300/270/240 补角分支。
                delta = abs(obj.lon - innerObj.lon)
                if delta > 180:
                    delta = 360 - delta
                if delta < 1:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < 1:
                    natasp['aspect'] = 60
                    natasp['delta'] = abs(delta - 60)
                elif abs(delta - 90) < 1:
                    natasp['aspect'] = 90
                    natasp['delta'] = abs(delta - 90)
                elif abs(delta - 120) < 1:
                    natasp['aspect'] = 120
                    natasp['delta'] = abs(delta - 120)
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
                delta = abs(obj.lon - outerObj.lon)
                if delta > 180:
                    delta = 360 - delta
                if delta < 1:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < 1:
                    natasp['aspect'] = 60
                    natasp['delta'] = abs(delta - 60)
                elif abs(delta - 90) < 1:
                    natasp['aspect'] = 90
                    natasp['delta'] = abs(delta - 90)
                elif abs(delta - 120) < 1:
                    natasp['aspect'] = 120
                    natasp['delta'] = abs(delta - 120)
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
                # 跨 0° 的映点接触需折回最短分离角
                if delta > 180:
                    delta = 360 - delta
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
                if delta > 180:
                    delta = 360 - delta
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
                # 归一化到 [0,180] 最短分离角(同文件相位/映点四处同款;曾漏此处 →
                # 跨白羊 0° 的中点合相被静默丢弃,刑/冲因对称分支侥幸不受影响)
                if delta > 180:
                    delta = 360 - delta
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
