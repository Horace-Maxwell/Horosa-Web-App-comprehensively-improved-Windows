from flatlib import const
from astrostudy.perchart import PerChart
from astrostudy import helper

# perchart.hsys 列表里 Porphyry 的下标(列表只在末尾追加,下标稳定)
PORPHYRY_INDEX = 9
# 组合盘改按组合上升起整宫时逐宫打的标记(与十三分 / 调波等派生盘的 hsysDerived 同一机制,前端据此改标注、折叠宫主表)
COMPOSITE_WHOLE_MODE = 'compositeWholeFromAsc'


class ChartComposite:

    def __init__(self, inner, outer):
        self.innerData = inner
        self.outerData = outer
        # 宫制按请求(此前这里恒写 0 = 整宫,左栏「宫制」是死开关)。缺省仍整宫。
        if self.innerData.get('hsys') is None:
            self.innerData['hsys'] = 0
        self.outerData['hsys'] = self.innerData['hsys']
        self.houseNote = ''
        self.wholeDerived = False
        self.polarFallback = None

    def _useWholeSign(self, note):
        # 改用整宫制重建两盘:宫对象、落宫判断(整宫不前移 5°)与盘头宫制名都随之是真整宫,
        # 不会出现「宫头挪到整宫边界、宫对象仍按原宫制判落宫」的错位。
        # 极区统一改 Porphyry 之后仍合不出:两句都留(先说哪一盘极区,再说回落整宫)
        self.houseNote = '{};{}'.format(self.houseNote, note) if self.houseNote else note
        self.wholeDerived = True
        self.polarFallback = None
        self.innerData['hsys'] = 0
        self.outerData['hsys'] = 0
        return PerChart(self.innerData), PerChart(self.outerData)

    @staticmethod
    def _fallbackOf(chart):
        houses = list(chart.chart.houses)
        return getattr(houses[0], 'hsysFallback', None) if houses else None

    def compute(self):
        innerChart = PerChart(self.innerData)
        outerChart = PerChart(self.outerData)

        requested = int(self.innerData.get('hsys') or 0)
        wholeFamily = requested == 0 or any(
            getattr(h, 'hsys', None) == const.HOUSES_WHOLE_SIGN for h in innerChart.chart.houses)
        cusps = None
        if requested != 0 and wholeFamily:
            # 整宫一类的自定义宫制(如福点整宫制):组合盘没有可取中点的独立宫头,统一按组合上升起整宫
            innerChart, outerChart = self._useWholeSign('整宫一类宫制在组合盘上统一按组合上升所在星座起第一宫')
        elif not wholeFamily:
            fbA = self._fallbackOf(innerChart)
            fbB = self._fallbackOf(outerChart)
            if fbA or fbB:
                # 极区:任一盘的所选宫制无解(已回退 Porphyry)→ 两盘统一按 Porphyry 重建再取中,并写明是哪一盘。
                # 此前只看 A 的标记:只有 B 回退时取中 = A 的所选制宫头与 B 的 Porphyry 宫头混合,且没有任何标记;
                # 只有 A 回退时标记说 Porphyry,实际一半是所选制。
                which = '两盘' if (fbA and fbB) else ('星盘A' if fbA else '星盘B')
                self.houseNote = '{}在所选宫制下处于极区无解,两盘统一改用 Porphyry 合出组合宫头'.format(which)
                self.polarFallback = 'Porphyry'
                self.innerData['hsys'] = PORPHYRY_INDEX
                self.outerData['hsys'] = PORPHYRY_INDEX
                innerChart = PerChart(self.innerData)
                outerChart = PerChart(self.outerData)
            cusps = self.midpointCusps(innerChart, outerChart)
            if cusps is None:
                # 该宫制在这对盘上合不出合法宫头(宫序颠倒 / 宫宽越界)→ 回落整宫,并如实标注
                innerChart, outerChart = self._useWholeSign(
                    ('Porphyry 在这对星盘上也合不出有效宫头' if self.polarFallback else '所选宫制在这对星盘上合不出有效宫头')
                    + ',已改按整宫制(组合上升所在星座起第一宫)显示')

        # 组合中点须取短弧中点(germany/midpoint.py 同口径):直接平均在跨 0° 白羊点时
        # 会落到对面(355°+5° 给 180° 而非 0°),整对行星翻到对宫。
        for objA in innerChart.chart.objects:
            objB = outerChart.chart.getObject(objA.id)
            objA.relocate(self.shortArcMid(objA.lon, objB.lon))

        for objA in innerChart.chart.angles:
            objB = outerChart.chart.getAngle(objA.id)
            objA.relocate(self.shortArcMid(objA.lon, objB.lon))

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

        if cusps is not None:
            # 象限 / 等宫等宫制:组合宫头 = 两盘同号宫头的短弧中点(与行星、四轴同一取中口径)
            for obj in innerChart.chart.houses:
                hid = int(obj.id[5:7])
                obj.size = cusps[hid][1]
                obj.relocate(cusps[hid][0])
        else:
            house1lon = (int(asclon / 30) % 12) * 30
            for obj in innerChart.chart.houses:
                hid = int(obj.id[5:7])
                newlon = house1lon + 30*(hid - 1)
                obj.size = 30
                obj.relocate(newlon)

        for obj in innerChart.chart.houses:
            if self.wholeDerived:
                obj.hsysDerived = COMPOSITE_WHOLE_MODE
            if self.polarFallback:
                obj.hsysFallback = self.polarFallback
        innerChart.reinit()
        res = helper.getChartObj(self.innerData, innerChart)
        if self.houseNote and isinstance(res, dict):
            res['compositeHouseNote'] = self.houseNote
        return res

    @staticmethod
    def shortArcMid(a, b):
        deg = (a + b) / 2
        if abs(deg - a) > 90:
            deg = (deg + 180) % 360
        return deg % 360

    def midpointCusps(self, innerChart, outerChart):
        # 两盘同号宫头取短弧中点;合出来必须宫序不乱、每宫宽 (0°, 180°)、一周合 360°,
        # 否则判算不出(返回 None,调用方回落整宫)。返回 {宫号: (宫头经度, 宫宽)}。
        cusps = {}
        for objA in innerChart.chart.houses:
            hid = int(objA.id[5:7])
            objB = outerChart.chart.getHouse(objA.id)
            if objB is None:
                return None
            cusps[hid] = self.shortArcMid(objA.lon, objB.lon)
        if sorted(cusps.keys()) != list(range(1, 13)):
            return None
        out = {}
        for hid in range(1, 13):
            nxt = cusps[1] if hid == 12 else cusps[hid + 1]
            size = (nxt - cusps[hid]) % 360
            if not (0 < size < 180):
                return None
            out[hid] = (cusps[hid], size)
        if abs(sum(v[1] for v in out.values()) - 360) > 1e-6:
            return None
        return out
