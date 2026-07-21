from flatlib import const
from flatlib.ephem import ephem as flatlib_ephem
from astrostudy.perchart import PerChart

LIST_OBJ = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.NORTH_NODE, const.SOUTH_NODE, const.URANUS, const.NEPTUNE, const.PLUTO,
    const.DARKMOON, const.PURPLE_CLOUDS
]

def takeLon(obj):
    return obj['lon']


# 个人点核心五点(宇宙生物学 Basic Five):Asc/MC/日/月/北交。
# personalOrb 仅作用于「相位目标」落在这五点时的放宽(宇宙生物学个人点宽容许度)。
BASIC_FIVE = (const.ASC, const.MC, const.SUN, const.MOON, const.NORTH_NODE)


class MidPoint:
    # uranian=False(默认):与历史实现逐字节一致,供合盘(modern/chartcomp.py)复用,绝不改其输出。
    # uranian=True(量化盘 /germany/midpoint 专用):
    #   ① 中点对来源纳入 Asc/MC(四轴)+ 8 颗 TNP 虚星(汉堡学派核心,原实现遗漏);
    #   ② 无序对各算一个近中点(短弧),消除原 A-B/B-A 双算 + 浮点精确去重导致的近/远重复;
    #   ③ 相位判断跨 0° 归一(修原 abs 差未归一致 mid≈359、obj≈0 漏判);orb 可配;
    #   ④ TNP 也作相位目标(捕获 TNP 落中点轴)。
    #
    # includeTnp / personalOrb 仅 uranian=True 分支生效,默认=现行为(零回归):
    #   includeTnp=False  → 8 颗 TNP 既不入中点对、也不作相位目标(宇宙生物学不用虚星);
    #   personalOrb=None  → 无分叉,全程用 self.orb;给定数值时仅「相位目标落 Basic Five」放宽到该值。
    # uranian=False(合盘 modern/chartcomp.py 复用)逐字节不变:tnpObjs 恒空,这两个参数完全无作用。
    def __init__(self, perchart: PerChart, orb=1.0, uranian=False, includeTnp=True, personalOrb=None):
        self.perchart = perchart
        self.uranian = bool(uranian)
        try:
            self.orb = float(orb)
        except (TypeError, ValueError):
            self.orb = 1.0
        if not (0 < self.orb <= 10):
            self.orb = 1.0
        self.includeTnp = bool(includeTnp)
        # personalOrb=None → 不分叉;否则校验为合法正容许度(同 orb 口径),非法则回退 None(无分叉)。
        self.personalOrb = None
        if personalOrb is not None:
            try:
                po = float(personalOrb)
                if 0 < po <= 30:
                    self.personalOrb = po
            except (TypeError, ValueError):
                self.personalOrb = None
        # 逐星取:个别小体在其星历物理域外(如凯龙 AD675-4649)时该星缺席,
        # 其余照常(域内全员在场,行为与旧实现一致)。
        self.objects = []
        for _oid in LIST_OBJ:
            try:
                _obj = self.perchart.chart.getObject(_oid)
            except KeyError:
                continue
            if _obj is not None:
                self.objects.append(_obj)
        self.tnpObjs = []
        if self.uranian:
            chart = perchart.chart
            angleObjs = [a for a in chart.angles if a.id in (const.ASC, const.MC)]
            if self.includeTnp:
                for uid in const.LIST_URANIAN:
                    try:
                        self.tnpObjs.append(flatlib_ephem.getObject(uid, perchart.dateTime, perchart.pos))
                    except Exception:
                        pass
            self.objects = self.objects + angleObjs + self.tnpObjs

    def getAspects(self, obj, mids):
        if self.uranian:
            return self._getAspectsUranian(obj, mids)
        # —— 历史路径(合盘复用,逐字节不变)——
        asps = {}
        asps[obj.id] = []
        for mid in mids:
            asp = {
                'idA': mid['idA'],
                'idB': mid['idB'],
                'aspect': -1
            }
            delta = abs(mid['lon'] - obj.lon)
            if delta < 1:
                asp['aspect'] = 0
                asp['delta'] = delta
            elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                tmpdelta = abs(delta - 90)
                if tmpdelta > 1:
                    tmpdelta = abs(delta - 270)
                asp['aspect'] = 90
                asp['delta'] = tmpdelta
            elif abs(delta - 180) < 1:
                asp['aspect'] = 180
                asp['delta'] = abs(delta - 180)

            if asp['aspect'] > -1:
                asps[obj.id].append(asp)
        return asps

    def _getAspectsUranian(self, obj, mids):
        # 相位目标 obj 落 Basic Five(Asc/MC/日/月/北交)且 personalOrb 给定 → 用放宽容许度;
        # 否则用通用 orb。personalOrb=None 时全程 orb,无任何分叉(零回归)。
        orb = self.personalOrb if (self.personalOrb is not None and obj.id in BASIC_FIVE) else self.orb
        asps = {obj.id: []}
        for mid in mids:
            d = abs(mid['lon'] - obj.lon) % 360.0   # 跨 0° 归一到 0..180
            if d > 180.0:
                d = 360.0 - d
            asp = {'idA': mid['idA'], 'idB': mid['idB'], 'aspect': -1}
            if d < orb:                # 合(90°盘上 0/90/180/270 经归一后落 0 或 90 或 180)
                asp['aspect'] = 0
                asp['delta'] = d
            elif abs(d - 90.0) < orb:  # 刑(含 270 折叠)
                asp['aspect'] = 90
                asp['delta'] = abs(d - 90.0)
            elif abs(d - 180.0) < orb:  # 冲
                asp['aspect'] = 180
                asp['delta'] = abs(d - 180.0)
            if asp['aspect'] > -1:
                asps[obj.id].append(asp)
        return asps

    def getMidpoints(self):
        if self.uranian:
            return self._getMidpointsUranian()
        # —— 历史路径(合盘复用,逐字节不变)——
        midsdeg = set()
        mids = []
        objs = []
        for obj in self.objects:
            if not (obj in const.LIST_MIDDLE_POINTS):
                objs.append(obj)

        for objA in objs:
            for objB in objs:
                if objA.id == objB.id:
                    continue
                mid = (objA.lon + objB.lon) / 2.0
                if abs(mid - objA.lon) > 90:
                    mid = (mid + 180) % 360
                if mid in midsdeg:
                    continue
                sigidx = int(mid / 30)
                pnt = {
                    'lon': mid,
                    'signlon': mid % 30,
                    'sign': const.LIST_SIGNS[sigidx],
                    'idA': objA.id,
                    'idB': objB.id
                }
                mids.append(pnt)
                midsdeg.add(mid)
        mids.sort(key=takeLon)
        return mids;

    def _getMidpointsUranian(self):
        objs = [o for o in self.objects if o not in const.LIST_MIDDLE_POINTS]
        mids = []
        n = len(objs)
        for i in range(n):
            for j in range(i + 1, n):
                objA = objs[i]
                objB = objs[j]
                mid = (objA.lon + objB.lon) / 2.0
                if abs(mid - objA.lon) > 90:
                    mid = (mid + 180) % 360
                sigidx = int(mid / 30) % 12
                mids.append({
                    'lon': mid,
                    'signlon': mid % 30,
                    'sign': const.LIST_SIGNS[sigidx],
                    'idA': objA.id,
                    'idB': objB.id
                })
        mids.sort(key=takeLon)
        return mids


    def calculate(self):
        mids = self.getMidpoints()
        asps = {}
        # 相位目标:四轴 + 行星(+ uranian 时附 TNP)。非 uranian 时 tnpObjs 为空,与历史一致。
        targets = list(self.perchart.chart.angles) + list(self.perchart.chart.objects) + self.tnpObjs
        for obj in targets:
            objasp = self.getAspects(obj, mids)
            if len(objasp[obj.id]) > 0:
                asps[obj.id] = objasp[obj.id]

        res = {
            'midpoints': mids,
            'aspects': asps
        }
        return res
